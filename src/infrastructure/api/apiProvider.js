import { createApiService } from "./apiService.js";
import { createApiProvider } from "./provider/axios.js";

export const apiProvider = createApiProvider();
export const apiService = createApiService(apiProvider);
