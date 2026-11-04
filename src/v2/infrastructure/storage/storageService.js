class StorageService {
  constructor(provider) {
    this.provider = provider;
  }

  async createFolder(folderName) {
    try {
      return await this.provider.createFolder(folderName);
    } catch (error) {
      console.error(error);
    }
  }

  async createWriteFileStream(filePath, encoding) {
    return this.provider.createWriteFileStream(filePath, encoding);
  }
}

export function createStorageService(provider) {
    return new StorageService(provider)
}