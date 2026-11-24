import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";

class ArchiverProvider {
  async createArchiveStream(files, temporaryDirectory) {
    const archivePath = path.join(temporaryDirectory, "harvest.zip");
    const archive = new ZipArchive({ zlib: { level: 1 } });
    const output = createWriteStream(archivePath);

    await new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        archive.destroy();
        output.destroy();
        reject(error);
      };

      archive.on("warning", fail);
      archive.on("error", fail);
      output.on("error", fail);
      output.once("close", () => {
        if (settled) return;
        if (!output.writableFinished) {
          fail(new Error("Archive output closed before finishing."));
          return;
        }
        settled = true;
        resolve();
      });

      try {
        archive.pipe(output);
        for (const filePath of files) {
          archive.file(filePath, { name: path.basename(filePath) });
        }
        Promise.resolve(archive.finalize()).catch(fail);
      } catch (error) {
        fail(error);
      }
    });

    return createReadStream(archivePath);
  }
}

export function createArchiverProvider() {
  return new ArchiverProvider();
}
