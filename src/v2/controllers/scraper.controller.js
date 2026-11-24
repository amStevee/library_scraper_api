import { scrapPage } from "../services/scraping/scrapingService.js";

function streamHarvestArchive(res, harvest) {
  const { downloadStream } = harvest;
  let streamFailed = false;
  const handleStreamError = (error) => {
    if (streamFailed) return;
    streamFailed = true;
    console.error("Failed to stream harvest archive:", error);

    if (res.headersSent) {
      res.destroy(error);
    } else {
      res.status(500).json({ message: "Unable to send harvest archive." });
    }
  };

  downloadStream.once("error", handleStreamError);
  res.once("close", () => {
    if (!res.writableEnded) downloadStream.destroy();
  });

  res.status(200);
  res.attachment(harvest.archiveName);
  res.setHeader("X-Harvest-File-Count", String(harvest.fileCount));
  res.setHeader("X-Harvest-Message", harvest.message);
  downloadStream.pipe(res);
}

export default async function (req, res) {
  const { url } = req.body ?? {};
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ message: "A URL is required." });
  }

  let clientDisconnected = false;
  res.once("close", () => {
    if (!res.writableEnded) clientDisconnected = true;
  });

  let harvest;
  try {
    harvest = await scrapPage(url.trim());
    if (clientDisconnected) {
      harvest.downloadStream?.destroy();
      return;
    }

    if (harvest.fileCount === 0) {
      return res.status(200).json({ message: harvest.message });
    }

    streamHarvestArchive(res, harvest);
    return;
  } catch (error) {
    harvest?.downloadStream?.destroy();
    console.error("Harvest request failed:", error);
    if (error.code === "ERR_OUTBOUND_DESTINATION_BLOCKED") {
      return res.status(400).json({
        message: "Only public HTTP(S) pages and files can be harvested.",
      });
    }
    if (res.headersSent) return res.destroy(error);
    return res.status(500).json({ message: "Unable to scrape URL." });
  }
}
