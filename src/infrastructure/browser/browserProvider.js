import { createBrowserService } from "./browserService.js";
import { createPuppeteerProvider } from "./providers/puppeteer.js";

export const browserProvider = createPuppeteerProvider();
export const browserService = createBrowserService(browserProvider);
