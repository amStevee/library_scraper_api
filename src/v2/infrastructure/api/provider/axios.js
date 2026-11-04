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

  async fetchHtml(url) {
    console.log("Fetching HTML...");
    try {
      return await this.axios.get(url);
    } catch (error) {
      if (this.connectionFailCount === 0) {
        this.connectionFailCount += 1;

        this.fetchHtml(url);

        console.log(`Connection error. \n Reconnecting to server....`);
      } else if (this.connectionFailCount === 5) {
        console.error(`Can not connect to server. Try again later.`);
      }
    }
  }

  async getStream(url) {
    try {
      console.log("Downloading file...");
      return (
        await axios({
          url,
          method: "GET",
          responseType: "stream",
        })
      ).data;
    } catch (error) {
      console.error(error);
    }
  }
}

export function createApiProvider() {
  return new Api();
}
