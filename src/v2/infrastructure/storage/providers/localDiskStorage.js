import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const pathSeperator = path.sep;

class FsProvider {
  constructor() {
    this.appRoot = path.join(os.homedir(), "Desktop");
  }
  async createFolder(folderName) {
    console.log('creating folder...')
    const folderPath = path.join(this.appRoot, folderName);
    try {
      await fs.promises.mkdir(folderPath, { recursive: true });
      console.log(`${folderPath.split(pathSeperator).pop()} directory successfuly created`)
      return folderPath
    } catch (error) {
      if (error.code === "EACCES") {
        console.error(`Permission denied to create diretory: ${folderPath}`);
      } else if (error.code === "EEXIST") {
        console.error(
          `A file already exists where you want to put  the folder: ${folderPath}`,
        );
      } else {
        console.error("Faild to create folder: ", error.message);
      }
      console.error(error); // TODO: handle failure
    }
  }

  // `${appRoot}/${folderName}/${name.split("/").pop()}`

  async createWriteFileStream(filePath, encoding) {
    return fs.createWriteStream(filePath, encoding)
  }
}

export function createFsProvider() {
  return new FsProvider();
}
