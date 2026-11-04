import { createStorageService } from "./storageService.js";

import { createFsProvider } from "./providers/localDiskStorage.js";

export const storageProvider = createFsProvider();
export const storageService = createStorageService(storageProvider);
