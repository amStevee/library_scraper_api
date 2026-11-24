import axios from "axios";
import http from "node:http";
import https from "node:https";
import { outboundAccessService } from "../../network/outboundAccessProvider.js";

const crossOriginSensitiveHeaders = new Set([
  "authorization",
  "cookie",
  "cookie2",
  "host",
  "origin",
  "proxy-authorization",
  "referer",
]);

function stripCrossOriginSensitiveHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers || {}).filter(
      ([name]) => !crossOriginSensitiveHeaders.has(name.toLowerCase()),
    ),
  );
}

class Api {
  connectionFailCount = 0;
  constructor() {
    const httpAgent = new http.Agent({
      keepAlive: true,
      lookup: outboundAccessService.lookup,
    });
    const httpsAgent = new https.Agent({
      keepAlive: true,
      lookup: outboundAccessService.lookup,
    });

    this.axios = axios.create({
      baseURL: process.env.baseURL,
      timeout: 60000,
      maxContentLength: 500 * 1000 * 1000,
      maxRedirects: 0,
      httpAgent,
      httpsAgent,
      headers: { "Content-Type": "application/xml" },
    });
  }

  async getStream(url, headers) {
    console.log("Downloading file...");
    let targetUrl = await outboundAccessService.validatePublicUrl(url);
    let requestHeaders = headers;

    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      const response = await this.axios.get(targetUrl.href, {
        responseType: "stream",
        headers: requestHeaders,
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (response.status < 300 || response.status >= 400) return response;

      response.data.destroy();
      const location = response.headers.location;
      if (!location || redirectCount === 5) {
        throw new Error("The resource returned too many or invalid redirects.");
      }

      const previousUrl = targetUrl;
      targetUrl = await outboundAccessService.validatePublicUrl(
        new URL(location, targetUrl),
      );
      if (targetUrl.origin !== previousUrl.origin) {
        requestHeaders = stripCrossOriginSensitiveHeaders(requestHeaders);
      }
    }

    throw new Error("The resource returned too many redirects.");
  }
}

export function createApiProvider() {
  return new Api();
}
