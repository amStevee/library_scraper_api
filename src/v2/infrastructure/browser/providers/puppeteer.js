import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import puppeteer from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { storageService } from "../../storage/storageProvider.js";
import { apiService } from "../../api/apiProvider.js";
import { outboundAccessService } from "../../network/outboundAccessProvider.js";
import { normalizeFileName } from "../../../lib/utils.js";

puppeteer.use(stealthPlugin());

export class PuppeteerProvider {
  connectionFailCount = 0;
  maxRetries = 5;

  async lunchBrowserPage() {
    let browser;
    try {
      console.log(`launching browser....`);
      const proxyUrl = await outboundAccessService.getProxyUrl();
      browser = await puppeteer.launch({
        headless: true,
        // executablePath: `C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`,
        args: [
          "--no-sandbox",
          "--disable-gpu",
          "--enable-webgl",
          "--unhandle-rejections=strict",
          `--proxy-server=${proxyUrl}`,
          "--proxy-bypass-list=<-loopback>",
          "--disable-quic",
          "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        ],
        defaultViewport: null,
      });

      console.log("creating page...");
      const page = await browser.newPage();
      await page.setUserAgent({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
      });

      return { page };
    } catch (error) {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error("Failed to close browser after launch error:", closeError);
        }
      }
      console.error(error);
      return null;
    }
  }

  async fetchHtml(url) {
    let page;
    try {
      const browserInstance = await this.lunchBrowserPage();
      if (!browserInstance?.page) {
        throw new Error("Unable to initialize the browser page.");
      }

      page = browserInstance.page;
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        let protocol;
        try {
          protocol = new URL(request.url()).protocol;
        } catch {
          protocol = "";
        }

        const action = ["http:", "https:"].includes(protocol)
          ? request.continue()
          : request.abort("blockedbyclient");
        void action.catch((error) => {
          if (!page.isClosed()) {
            console.error("Failed to enforce browser request policy:", error);
          }
        });
      });
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      const hrefs = [
        ...new Set(
          await page.$$eval("a[href]", (anchors) =>
            anchors.map((a) => a.href),
          ),
        ),
      ];

      this.connectionFailCount = 0;
      return { hrefs, ...browserInstance };
    } catch (error) {
      if (page) {
        try {
          await page.browser().close();
        } catch (closeError) {
          console.error("Failed to close browser after crawl error:", closeError);
        }
      }

      this.connectionFailCount += 1;

      if (this.connectionFailCount < this.maxRetries) {
        console.log(`Connection error. \n Reconnecting to server....`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.fetchHtml(url);
      } else {
        console.error("Error crawling page:", error);
        throw error;
      }
    }
  }

  async downloadFile(fileUrl, page, downloadPath, isDriveFile = false) {
    if (!page) throw new Error("Cannot download file: page is not initialized");
    if (!downloadPath)
      throw new Error("Cannot download file: download path is missing");

    const cookies = await page.browserContext().cookies(fileUrl);
    const headers = {
      "User-Agent": await page.evaluate(() => navigator.userAgent),
      Referer: page.url(),
    };
    if (cookies.length) {
      headers.Cookie = cookies
        .map(({ name, value }) => `${name}=${value}`)
        .join("; ");
    }

    let response;
    try {
      response = await apiService.getStream(fileUrl, headers);
    } catch (error) {
      if (error.response?.status === 404) {
        console.warn(`Skipping missing file (404): ${fileUrl}`);
        return null;
      }
      throw error;
    }

    const contentType = response.headers["content-type"] || "";
    if (/^text\/html\b/i.test(contentType)) {
      response.data.destroy();
      throw new Error(
        isDriveFile
          ? "Google Drive returned a web page; the file may require sign-in or confirmation."
          : "The resource returned a web page instead of a downloadable file.",
      );
    }

    const fileName = getResponseFileName(
      response.headers["content-disposition"],
      fileUrl,
      isDriveFile,
    );
    const filePath = path.join(downloadPath, fileName);
    const writeStream = await storageService.createWriteFileStream(filePath);

    try {
      await pipeline(response.data, writeStream);
    } catch (error) {
      try {
        await fs.rm(filePath, { force: true });
      } catch (cleanupError) {
        console.error(`Failed to remove partial download ${filePath}:`, cleanupError);
      }
      throw error;
    }

    return filePath;
  }

  async login(page, user) {}
}

export function createPuppeteerProvider() {
  return new PuppeteerProvider();
}

function getResponseFileName(contentDisposition, fileUrl, isDriveFile) {
  const extendedName = contentDisposition?.match(
    /filename\*\s*=\s*UTF-8''([^;]+)/i,
  )?.[1];
  const ordinaryName = contentDisposition?.match(
    /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i,
  );

  let fileName;
  if (extendedName) {
    try {
      fileName = decodeURIComponent(extendedName.trim());
    } catch (error) {
      console.warn("Ignoring malformed extended filename:", error);
      fileName = undefined;
    }
  }
  fileName ||= ordinaryName?.[1] || ordinaryName?.[2]?.trim();

  if (fileName) {
    fileName = path
      .basename(fileName.replace(/\\/g, "/"))
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/[. ]+$/, "");
  }

  if (fileName) return fileName;

  if (isDriveFile) {
    const fileId = new URL(fileUrl).searchParams.get("id");
    return `drive-file-${fileId || "download"}`;
  }

  return normalizeFileName(fileUrl);
}
