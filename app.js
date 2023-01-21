const $ = require("cheerio");
const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");

const Surl = "https://www.health.gov.ng";
const url =
  "https://www.health.gov.ng/index.php?option=com_content&view=article&id=143&Itemid=512";
let linkList = [];
let dlinkList = [];

const getWebsiteLinks = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const range = $("a")[1].attribs.href.length;
    for (let index = 0; index < range; index++) {
      let raw_links = $("a")[index].attribs.href;
      if (raw_links.startsWith("/")) {
        linkList.push(Surl + raw_links);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const downloadLinks = async (linkList) => {
  try {
    for (const link of linkList) {
      const { data } = await axios.get(link);
      const $ = cheerio.load(data);
      $("a").each(function (idx, el) {
        if ($(el).attr("href").endsWith(".pdf")) {
          let addr = $(el).attr("href");
          let dlink = Surl + addr;
          dlinkList.push({
            names: addr,
            dlink: dlink,
          });
          return;
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
};

const downloadFiles = async (dlinkList) => {
  const folderName = `${Surl.split("/").pop()}/`;
  try {
    for (const link of dlinkList) {
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }
      let name = link.names;
      let url = link.dlink;
      let file = fs.createWriteStream(`${folderName}/${name.split("/").pop()}`);
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
      });
      // path.resolve(__dirname, "PDF", url, response.data.pipe(file));
      response.data.pipe(file);
    }
  } catch (error) {
    console.error(error);
  }
};

(async () => {
  await getWebsiteLinks(url);
  await downloadLinks(linkList);
  await downloadFiles(dlinkList);
})();
