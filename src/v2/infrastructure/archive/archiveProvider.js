import { createArchiveService } from "./archiveService.js";
import { createArchiverProvider } from "./providers/archiver.js";
import { storageService } from "../storage/storageProvider.js";

export const archiveProvider = createArchiverProvider();
export const archiveService = createArchiveService(
  archiveProvider,
  storageService,
);
