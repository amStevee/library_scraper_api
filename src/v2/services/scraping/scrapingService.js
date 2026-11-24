import path from "node:path";
import { archiveService } from "../../infrastructure/archive/archiveProvider.js";
import { outboundAccessService } from "../../infrastructure/network/outboundAccessProvider.js";
import { storageService } from "../../infrastructure/storage/storageProvider.js";
import { browserService } from "../../infrastructure/browser/browserProvider.js";

const supportedExtensions = new Set([".pdf", ".docx"]);

function getGoogleDriveDownloadUrl(fileUrl) {
  if (
    fileUrl.hostname !== "drive.google.com" &&
    fileUrl.hostname !== "drive.usercontent.google.com"
  ) {
    return null;
  }

  const fileIdFromPath = fileUrl.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
  const supportsIdQuery = ["/open", "/uc", "/download"].includes(
    fileUrl.pathname,
  );
  const fileId =
    fileIdFromPath ||
    (supportsIdQuery ? fileUrl.searchParams.get("id") : null);

  if (!fileId) return null;

  const downloadUrl = new URL("https://drive.google.com/uc");
  downloadUrl.searchParams.set("export", "download");
  downloadUrl.searchParams.set("id", fileId);
  return downloadUrl;
}

function getDownloadCandidates(hrefs, pageUrl) {
  const candidates = new Map();

  for (const href of hrefs) {
    const fileUrl = new URL(href, pageUrl);
    if (!["http:", "https:"].includes(fileUrl.protocol)) continue;

    const driveUrl = getGoogleDriveDownloadUrl(fileUrl);
    if (driveUrl) {
      candidates.set(driveUrl.href, {
        url: driveUrl.href,
        sourceUrl: fileUrl.href,
        isDriveFile: true,
      });
      continue;
    }

    if (supportedExtensions.has(path.extname(fileUrl.pathname).toLowerCase())) {
      candidates.set(fileUrl.href, {
        url: fileUrl.href,
        sourceUrl: fileUrl.href,
        isDriveFile: false,
      });
    }
  }

  return [...candidates.values()];
}

function getArchiveName(hostname) {
  const safeHostname = hostname.replace(/[^a-z0-9_-]/gi, "_");
  return `${safeHostname}-resources.zip`;
}

async function scrapPage(url) {
  let page;
  let temporaryDirectory;
  let completedHarvest;
  let filesToArchive;

  try {
    const webUrl = await outboundAccessService.validatePublicUrl(url);
    temporaryDirectory =
      await storageService.createTemporaryFolder("folio-harvest-");

    const browserInstance = await browserService.fetchHtml(webUrl);
    page = browserInstance.page;
    const candidates = getDownloadCandidates(browserInstance.hrefs, webUrl);

    if (candidates.length === 0) {
      await storageService.removeTemporaryFolder(temporaryDirectory);
      temporaryDirectory = undefined;
      return {
        fileCount: 0,
        archiveName: getArchiveName(webUrl.hostname),
        message:
          "No downloadable PDF, DOCX, or public Google Drive file links were found.",
      };
    }

    let downloadedCount = 0;
    let failedCount = 0;
    const files = [];

    for (const candidate of candidates) {
      try {
        const filePath = await browserService.downloadFile(
          candidate.url,
          page,
          temporaryDirectory,
          candidate.isDriveFile,
        );

        if (!filePath) {
          throw new Error("The resource was not downloaded.");
        }

        downloadedCount += 1;
        files.push(filePath);
        console.log(`Download ${path.basename(filePath)} complete.`);
      } catch (error) {
        failedCount += 1;
        console.error(`Failed to download ${candidate.sourceUrl}:`, error);
      }
    }

    if (downloadedCount === 0) {
      throw new Error(`Failed to download all ${failedCount} resource(s).`);
    }

    filesToArchive = files;
    completedHarvest = {
      fileCount: files.length,
      archiveName: getArchiveName(webUrl.hostname),
      message:
        failedCount > 0
          ? `Downloaded ${downloadedCount} file(s); ${failedCount} failed.`
          : `Downloaded ${downloadedCount} file(s).`,
    };
  } catch (error) {
    if (temporaryDirectory) {
      try {
        await storageService.removeTemporaryFolder(temporaryDirectory);
      } catch (cleanupError) {
        console.error("Failed to remove temporary harvest files:", cleanupError);
      }
    }
    throw error;
  } finally {
    if (page) {
      try {
        await page.browser().close();
      } catch (error) {
        console.error("Failed to close browser:", error);
      }
    }
  }

  try {
    const downloadStream = await archiveService.createArchiveStream(
      filesToArchive,
      temporaryDirectory,
    );
    temporaryDirectory = undefined;
    return { ...completedHarvest, downloadStream };
  } catch (error) {
    if (temporaryDirectory) {
      try {
        await storageService.removeTemporaryFolder(temporaryDirectory);
      } catch (cleanupError) {
        console.error("Failed to remove temporary harvest files:", cleanupError);
      }
    }
    throw error;
  }
}

export { scrapPage, getGoogleDriveDownloadUrl };
