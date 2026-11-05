import axios from "axios";
import https from "https";

class Api {
  connectionFailCount = 0;
  constructor() {
    this.axios = axios.create({
      baseURL: process.env.baseURL,
      timeout: 60000, // Increase time out incase of network delay or delayed server response
      maxContentLength: 500 * 1000 * 1000, // Increase maximum response ata length
      httpsAgent: new https.Agent({ keepAlive: true }),
      headers: { "Content-Type": "application/xml" },
    });
  }

  async getStream(url, headers) {
    console.log("Downloading file...");
    return (
      await axios.get(url, {
        responseType: "stream",
        headers,
      })
    ).data;
  }
}

export function createApiProvider() {
  return new Api();
}
