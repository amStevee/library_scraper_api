import dns from "node:dns/promises";
import http from "node:http";
import net from "node:net";
import ipaddr from "ipaddr.js";

const blockedHostSuffixes = [
  ".localhost",
  ".local",
  ".lan",
  ".internal",
  ".test",
  ".invalid",
  ".example",
  ".onion",
  ".home.arpa",
];

function createBlockedDestinationError() {
  const error = new Error("Outbound access to this destination is blocked.");
  error.code = "ERR_OUTBOUND_DESTINATION_BLOCKED";
  return error;
}

function normalizeHostname(hostname) {
  let normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  return normalized;
}

function isBlockedHostname(hostname) {
  return (
    hostname === "localhost" ||
    blockedHostSuffixes.some((suffix) => hostname.endsWith(suffix))
  );
}

function isPublicAddress(address) {
  if (address.includes("%")) return false;

  try {
    let parsedAddress = ipaddr.parse(address);
    if (
      parsedAddress.kind() === "ipv6" &&
      parsedAddress.isIPv4MappedAddress()
    ) {
      parsedAddress = parsedAddress.toIPv4Address();
    }
    return parsedAddress.range() === "unicast";
  } catch {
    return false;
  }
}

function rejectHttpResponse(response, statusCode) {
  if (response.destroyed) return;
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(statusCode, {
    connection: "close",
    "content-length": "0",
  });
  response.end();
}

function rejectSocket(socket, statusCode) {
  if (socket.destroyed) return;
  const statusText = statusCode === 403 ? "Forbidden" : "Bad Gateway";
  socket.end(
    `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
}

class OutboundAccessService {
  constructor() {
    this.proxyServer = undefined;
    this.proxyUrl = undefined;
    this.proxyPromise = undefined;
    this.lookup = this.lookup.bind(this);
  }

  async resolvePublicAddresses(hostname) {
    const normalizedHostname = normalizeHostname(hostname);
    if (!normalizedHostname || isBlockedHostname(normalizedHostname)) {
      throw createBlockedDestinationError();
    }

    const family = net.isIP(normalizedHostname);
    const addresses = family
      ? [{ address: normalizedHostname, family }]
      : await dns.lookup(normalizedHostname, { all: true, verbatim: true });

    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => !isPublicAddress(address))
    ) {
      throw createBlockedDestinationError();
    }

    return addresses;
  }

  async validatePublicUrl(value) {
    let targetUrl;
    try {
      targetUrl = value instanceof URL ? new URL(value.href) : new URL(value);
    } catch {
      throw createBlockedDestinationError();
    }

    if (
      !["http:", "https:"].includes(targetUrl.protocol) ||
      !targetUrl.hostname ||
      targetUrl.username ||
      targetUrl.password
    ) {
      throw createBlockedDestinationError();
    }

    const expectedPort = targetUrl.protocol === "https:" ? 443 : 80;
    if (targetUrl.port && Number(targetUrl.port) !== expectedPort) {
      throw createBlockedDestinationError();
    }

    await this.resolvePublicAddresses(targetUrl.hostname);
    return targetUrl;
  }

  lookup(hostname, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    } else if (typeof options === "number") {
      options = { family: options };
    }

    const lookupOptions = options || {};
    this.resolvePublicAddresses(hostname).then(
      (addresses) => {
        const matchingAddresses = lookupOptions.family
          ? addresses.filter(
              (address) => address.family === lookupOptions.family,
            )
          : addresses;
        if (matchingAddresses.length === 0) {
          const error = new Error("No public address matches the requested family.");
          error.code = "EAI_ADDRFAMILY";
          callback(error);
          return;
        }

        if (lookupOptions.all) {
          callback(null, matchingAddresses);
          return;
        }

        const [address] = matchingAddresses;
        callback(null, address.address, address.family);
      },
      callback,
    );
  }

  getProxyUrl() {
    if (this.proxyUrl) return Promise.resolve(this.proxyUrl);
    if (!this.proxyPromise) {
      this.proxyPromise = this.startProxy().catch((error) => {
        this.proxyPromise = undefined;
        throw error;
      });
    }
    return this.proxyPromise;
  }

  async startProxy() {
    const server = http.createServer((request, response) => {
      void this.forwardHttpRequest(request, response);
    });
    server.on("connect", (request, socket, head) => {
      void this.forwardConnectRequest(request, socket, head);
    });
    server.on("upgrade", (_request, socket) => {
      rejectSocket(socket, 403);
    });
    server.on("clientError", (_error, socket) => {
      rejectSocket(socket, 400);
    });

    await new Promise((resolve, reject) => {
      const handleError = (error) => {
        server.removeListener("listening", handleListening);
        reject(error);
      };
      const handleListening = () => {
        server.removeListener("error", handleError);
        resolve();
      };

      server.once("error", handleError);
      server.once("listening", handleListening);
      server.listen(0, "127.0.0.1");
    });

    server.on("error", (error) => {
      console.error("Outbound proxy server error:", error);
    });
    server.unref();
    this.proxyServer = server;
    const { port } = server.address();
    this.proxyUrl = `http://127.0.0.1:${port}`;
    return this.proxyUrl;
  }

  async forwardHttpRequest(request, response) {
    let upstreamRequest;
    try {
      const targetUrl = new URL(request.url);
      if (
        targetUrl.protocol !== "http:" ||
        targetUrl.username ||
        targetUrl.password ||
        (targetUrl.port && Number(targetUrl.port) !== 80)
      ) {
        throw createBlockedDestinationError();
      }

      const [address] = await this.resolvePublicAddresses(targetUrl.hostname);
      if (request.aborted || response.destroyed) return;

      const headers = { ...request.headers };
      delete headers.connection;
      delete headers["keep-alive"];
      delete headers["proxy-authorization"];
      delete headers["proxy-connection"];
      delete headers["proxy-authenticate"];
      delete headers.upgrade;
      headers.host = targetUrl.host;
      headers.connection = "close";

      upstreamRequest = http.request(
        {
          hostname: address.address,
          family: address.family,
          port: targetUrl.port ? Number(targetUrl.port) : 80,
          method: request.method,
          path: `${targetUrl.pathname}${targetUrl.search}`,
          headers,
          agent: false,
        },
        (upstreamResponse) => {
          if (response.destroyed) {
            upstreamResponse.destroy();
            return;
          }
          response.writeHead(
            upstreamResponse.statusCode || 502,
            upstreamResponse.headers,
          );
          upstreamResponse.pipe(response);
        },
      );

      upstreamRequest.setTimeout(60000, () => {
        upstreamRequest.destroy(new Error("Outbound request timed out."));
      });
      upstreamRequest.on("error", () => {
        rejectHttpResponse(response, 502);
      });
      request.on("aborted", () => upstreamRequest.destroy());
      response.on("close", () => upstreamRequest.destroy());
      request.pipe(upstreamRequest);
    } catch (error) {
      upstreamRequest?.destroy();
      rejectHttpResponse(
        response,
        error.code === "ERR_OUTBOUND_DESTINATION_BLOCKED" ? 403 : 502,
      );
    }
  }

  async forwardConnectRequest(request, socket, head) {
    let upstreamSocket;
    let tunnelEstablished = false;
    try {
      const targetUrl = new URL(`http://${request.url}`);
      if (
        !targetUrl.port ||
        Number(targetUrl.port) !== 443 ||
        targetUrl.username ||
        targetUrl.password
      ) {
        throw createBlockedDestinationError();
      }

      const [address] = await this.resolvePublicAddresses(targetUrl.hostname);
      if (socket.destroyed) return;

      upstreamSocket = net.connect({
        host: address.address,
        family: address.family,
        port: 443,
      });
      upstreamSocket.setTimeout(10000, () => {
        upstreamSocket.destroy(new Error("Outbound connection timed out."));
      });
      upstreamSocket.once("connect", () => {
        if (socket.destroyed) {
          upstreamSocket.destroy();
          return;
        }
        tunnelEstablished = true;
        upstreamSocket.setTimeout(0);
        socket.write(
          "HTTP/1.1 200 Connection Established\r\nProxy-Agent: libXp\r\n\r\n",
        );
        if (head.length > 0) upstreamSocket.write(head);
        socket.pipe(upstreamSocket);
        upstreamSocket.pipe(socket);
      });
      upstreamSocket.on("error", () => {
        if (tunnelEstablished) socket.destroy();
        else rejectSocket(socket, 502);
      });
      socket.on("error", () => upstreamSocket.destroy());
      socket.on("close", () => upstreamSocket.destroy());
    } catch (error) {
      upstreamSocket?.destroy();
      if (tunnelEstablished) {
        socket.destroy();
      } else {
        rejectSocket(
          socket,
          error.code === "ERR_OUTBOUND_DESTINATION_BLOCKED" ? 403 : 502,
        );
      }
    }
  }
}

export function createOutboundAccessService() {
  return new OutboundAccessService();
}
