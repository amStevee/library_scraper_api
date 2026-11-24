import * as cheerio from "cheerio";

export class CheerioProvider {
  load(data) {
    console.log("Parsing Html...");
    return cheerio.load(data);
  }

  getAttrHrefs(data) {
    console.log("Crawling AttrHrefs...");
    const $ = this.load(data);

    // Cheerio treats array differently - converts elements to a standard JS array
    return $("a")
      .map((_, el) => $(el).attr("href"))
      .get();
  }
}

export function createCheerioProvider() {
  return new CheerioProvider();
}
