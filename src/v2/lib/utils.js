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

export { checkFileExist, isValidUrl, normalizeHostname };
