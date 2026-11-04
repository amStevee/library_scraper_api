import { apiService } from "./v2/infrastructure/api/apiProvider.js";
import { htmlParserService } from "./v2/infrastructure/htmlParser/htmlParserProvider.js";
import { storageService } from "./v2/infrastructure/storage/storageProvider.js";
import { pipeline } from "node:stream/promises";
import { isValidUrl, normalizeHostname } from "./v2/lib/utils.js";

// const url = "https://www.ndic.gov.ng/publications";
const url = "https://health.gov.ng/publications";

async function scrapUrl(url) {
  try {
    const webUrl = new URL(url);

    console.time("html");
    const { data } = await apiService.fetchHtml(webUrl);
    const links =
      data && Array(...(await htmlParserService.getAttrHrefs(data)));

    if (!links.length) return;

    const folderName = normalizeHostname(webUrl.hostname);
    const folderPath = await storageService.createFolder(folderName);

    const pdfLinks = links.filter((link) => {
      return link.endsWith(".pdf" || ".docx");
    });

    for (const link of pdfLinks) {
      let downloadLink;
      if (!isValidUrl(link)) {
        if (!isValidUrl(`${webUrl.origin}${link}`)) continue;
        downloadLink = new URL(`${webUrl.origin}${link}`);
      } else {
        downloadLink = new URL(link).origin;
      }

      try {
        const data = await apiService.getStream(downloadLink);

        if (!data) continue;

        const filePath = `${folderPath}/${downloadLink.pathname?.split("/").pop()?.split("?")[0]}`;

        const writeStream = await storageService.createWriteFileStream(
          filePath,
          "utf-8",
        );
        await pipeline(data, writeStream);
      } catch (error) {
        console.error(error);
      }
    }

    console.timeEnd("html");
  } catch (error) {
    if (error.code === "ERR_INVALID_URL") {
      console.log(`${url} is not a valid url.`, error);
      return;
    }
    console.error(error);
  }
}

scrapUrl(url);
