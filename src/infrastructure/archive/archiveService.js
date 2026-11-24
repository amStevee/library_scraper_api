class ArchiveService {
  constructor(provider, storageService) {
    this.provider = provider;
    this.storageService = storageService;
  }

  async createArchiveStream(files, temporaryDirectory) {
    const stream = await this.provider.createArchiveStream(
      files,
      temporaryDirectory,
    );
    let cleanupPromise;

    const cleanup = () => {
      if (!cleanupPromise) {
        cleanupPromise = this.storageService
          .removeTemporaryFolder(temporaryDirectory)
          .catch((error) => {
            console.error("Failed to remove temporary archive files:", error);
          });
      }
      return cleanupPromise;
    };

    stream.once("close", () => void cleanup());

    try {
      await new Promise((resolve, reject) => {
        stream.once("open", resolve);
        stream.once("error", reject);
      });
    } catch (error) {
      stream.destroy();
      if (!stream.closed) {
        await new Promise((resolve) => stream.once("close", resolve));
      }
      await cleanup();
      throw error;
    }

    return stream;
  }
}

export function createArchiveService(provider, storageService) {
  return new ArchiveService(provider, storageService);
}
