import puppeteer from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(stealthPlugin());

export class PuppeteerProvider {
  async lunchBrowserPage() {
    try {
      console.log(`launching browser....`);
      const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-gpu", "--enable-webgl"],
      });

      console.log("creating page...");
      const page = await browser.newPage();
      await page.setUserAgent({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
      });

      return page;
    } catch (error) {
      console.error(error);
    }
  }

  async login(user) {
    const page = this.lunchBrowserPage();
  }

  //   async loginUser(user) {
  //     const browser = await puppeteer.launch({ headless: false });
  //     const page = ;await browser.newPage()

  //     await page.setViewport({ width: 1280, height: 800 });
  //     await page.setUserAgent(
  //       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  //     );
  //   }
}

export function createPuppeteerProvider() {
  return new PuppeteerProvider();
}
