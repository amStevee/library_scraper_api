const axios = require("axios");
const https = require("https");

module.exports = function () {
  const domain = "https://www.ndic.gov.ng/publications";
  let instance;

  if (!instance) {
    //create axios instance
    instance = axios.create({
      baseURL: domain,
      timeout: 60000, // Increase time out incase of network delay or delayed server response
      maxContentLength: 500 * 1000 * 1000, // Increase maximum response ata length
      httpsAgent: new https.Agent({ keepAlive: true }),
      headers: { "Content-Type": "application/xml" },
    });
  }

  return instance;
};
