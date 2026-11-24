import { htmlParserService } from "../../infrastructure/htmlParser/htmlParserProvider.js";
import { storageService } from "../../infrastructure/storage/storageProvider.js";
import { isValidUrl, normalizeHostname } from "../../lib/utils.js";
import { browserService } from "../../infrastructure/browser/browserProvider.js";

// const url = "https://www.ndic.gov.ng/publications";
// const url = "https://health.gov.ng/publications";

async function scrapPage(url) {
  let page;
  try {
    const webUrl = new URL(url);
    const folderName = normalizeHostname(webUrl.hostname);
    const folderPath = await storageService.createFolder(folderName);

    const browserInstance = await browserService.fetchHtml(webUrl, folderPath);
    page = browserInstance.page;
    const { hrefs } = browserInstance;

    if (!hrefs.length) return;

    const fileLinks = hrefs.filter((link) => {
      return link.endsWith(".pdf" || ".docx");
    });

    for (const link of fileLinks) {
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
          `Download ${fileUrl.pathname?.split("/").pop()} complete.`,
        );
      } catch (error) {
        console.error(error);
      }
    }
  } catch (error) {
    if (error.code === "ERR_INVALID_URL") {
      console.log(`${url} is not a valid url.`, error);
      return;
    }
    console.error(error);
  } finally {
    if (page) {
      try {
        console.log("Download completed.");
        await page.browser().close();
        return "Download complete";
      } catch (error) {
        console.error("Failed to close browser:", error);
      }
    }
  }
}

export { scrapPage };
