import path from "node:path";
import { pipeline } from "node:stream/promises";
import axios from "axios";
import puppeteer from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { storageService } from "../../storage/storageProvider.js";
import { apiService } from "../../api/apiProvider.js";
import { normalizeHostnameToFileName } from "../../../lib/utils.js";

puppeteer.use(stealthPlugin());

export class PuppeteerProvider {
  connectionFailCount = 0;
  maxRetries = 5;

  async lunchBrowserPage() {
    try {
      console.log(`launching browser....`);
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: `C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe`,
        args: [
          "--no-sandbox",
          "--disable-gpu",
          "--enable-webgl",
          "--unhandle-rejections=strict",
        ],
        defaultViewport: null,
      });

      console.log("creating page...");
      const page = await browser.newPage();
      await page.setUserAgent({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
      });

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

      return { page, headers };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async fetchHtml(url) {
    try {
      const browserInstance = await this.lunchBrowserPage();
      if (!browserInstance.page) {
        console.log("page not initialized undefined");
        return {
          htmlContent: "",
          page: undefined,
          client: browserInstance.client,
        };
      }

      await browserInstance.page.goto(url, { waitUntil: "networkidle2" });

      const htmlContent = await browserInstance.page.content();

      return { htmlContent, ...browserInstance };
    } catch (error) {
      this.connectionFailCount += 1;

      if (this.connectionFailCount < this.maxRetries) {
        console.log(`Connection error. \n Reconnecting to server....`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.fetchHtml(url);
      } else {
        console.error(`Error Crawling page:`, error);
        throw new Error(`Faild to crawl page after reaching the retry limit.`);
      }
    }
  }

  async downloadFile(fileUrl, headers, downloadPath) {
    if (!headers)
      throw new Error("Cannot download file: missing required headers");
    if (!downloadPath)
      throw new Error("Cannot download file: download path is missing");

    const fileName = normalizeHostnameToFileName(fileUrl);

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

    const filePath = path.join(downloadPath, fileName);
    const writeStream = await storageService.createWriteFileStream(filePath);

    await pipeline(response, writeStream);
    return filePath;
  }

  async login(page, user) {}
}

export function createPuppeteerProvider() {
  return new PuppeteerProvider();
}
