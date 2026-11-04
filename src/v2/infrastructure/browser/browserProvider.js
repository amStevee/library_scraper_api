import { createBrowserService } from "./browserService";
const { createPuppeteerProvider } = require("./providers/puppeteer");

export const browserProvider = createPuppeteerProvider();
export const browserService = createBrowserService(browserProvider);
