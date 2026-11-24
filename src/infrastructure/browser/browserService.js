export class BrowserService {
  constructor(provider) {
    this.provider = provider;
  }

  async lunchBrowser() {
    return await this.provider.lunchBrowser();
  }

  async fetchHtml(url) {
    return await this.provider.fetchHtml(url);
  }

  async downloadFile(fileUrl, page, downloadPath, isDriveFile = false) {
    return await this.provider.downloadFile(
      fileUrl,
      page,
      downloadPath,
      isDriveFile,
    );
  }
}

export function createBrowserService(provider) {
  return new BrowserService(provider);
}
