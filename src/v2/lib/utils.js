import nodepath from "node:path";

async function checkFileExist(path) {
  try {
    await fs.promises.access(path);
    return true;
  } catch (error) {
    return false;
  }
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (err) {
    return false;
  }
}

function normalizeHostname(hostame) {
  if (hostame.startsWith("www")) {
    return hostame.split(".")[1].toUpperCase();
  } else {
    return hostame.split(".")[0].toUpperCase();
  }
}

function normalizeFileName(fileUrl) {
  const fileUrlObject = new URL(fileUrl);
  const fileName = nodepath
    .basename(decodeURIComponent(fileUrlObject.pathname))
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/[. ]+$/, "");

  if (!fileName) throw new Error(`Cannot determine filename for ${fileUrl}`);

  return fileName;
}

export { checkFileExist, isValidUrl, normalizeHostname, normalizeFileName };

