import { htmlParserService } from "./v2/infrastructure/htmlParser/htmlParserProvider.js";
import { storageService } from "./v2/infrastructure/storage/storageProvider.js";
import { isValidUrl, normalizeHostname } from "./v2/lib/utils.js";
import { browserService } from "./v2/infrastructure/browser/browserProvider.js";

const url = "https://www.ndic.gov.ng/publications";
// const url = "https://health.gov.ng/publications";
async function scrapUrl(url) {
  let page;
  try {
    const webUrl = new URL(url);
    const folderName = normalizeHostname(webUrl.hostname);
    const folderPath = await storageService.createFolder(folderName);

    console.time("html");
    const browserInstance = await browserService.fetchHtml(webUrl, folderPath);
    page = browserInstance.page;
    const { htmlContent } = browserInstance;

    const links =
      htmlContent &&
      Array(...(await htmlParserService.getAttrHrefs(htmlContent)));

    if (!links.length) return;

    const pdfLinks = links.filter((link) => {
      return link.endsWith(".pdf" || ".docx");
    });

    for (const link of pdfLinks) {
      let fileUrl;
      if (!isValidUrl(link)) {
        if (!isValidUrl(`${webUrl.origin}${link}`)) continue;
        fileUrl = new URL(`${webUrl.origin}${link}`);
      } else {
        fileUrl = new URL(link);
      }

      try {
        const data = await browserService.downloadFile(
          fileUrl.href,
          page,
          folderPath,
        );

        if (!data) continue;

        console.log(
          `Download ${fileUrl.pathname?.split("/").pop()} complete..`,
        );
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
  } finally {
    if (page) {
      try {
        await page.browser().close();
      } catch (error) {
        console.error("Failed to close browser:", error);
      }
    }
  }
}

scrapUrl(url);
