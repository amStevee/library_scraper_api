import { createHtmlParserService } from "./htmlParserService.js";
import { createCheerioProvider } from "./provider/cheerio.js";

export const htmlParserProvider = createCheerioProvider();
export const htmlParserService = createHtmlParserService(htmlParserProvider);
