const $ = require("cheerio");
const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
// require("./getAxios");

const Surl = "https://www.health.gov.ng/";
// const url =
//   "https://www.health.gov.ng/index.php?option=com_content&view=article&id=143&Itemid=512";
let linkList = [];
let dlinkList = [];

const getWebsiteLinks = async (Surl) => {
  try {
    const response = await axios.get(Surl);
    const $ = cheerio.load(response.data);
    // const range = $("a")[1].attribs.href.length;
    const ranges = $("a").each(function (idx, el) {
      if ($(el).attr("href")) {
        return $(el).attr("href");
      }
    });

    for (let index = 0; index < ranges.length; index++) {
      let raw_links = $("a")[index].attribs.href;
      if (raw_links.startsWith("/")) {
        linkList.push(Surl + raw_links);
      }
    }
    console.log("Done");
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
        if ($(el)?.attr("href")?.endsWith(".pdf")) {
          let addr = $(el).attr("href");
          let dlink = Surl + addr;
          dlinkList.push({
            names: addr,
            dlink: dlink,
          });
        }
      });
    }
    console.log("Done Dl");
  } catch (error) {
    console.error("downloadLinksError: ", error);
  }
};

const downloadFiles = async (dlinkList) => {
  console.log("starting");
  const folderName = `./PDF/${Surl.split("/").pop()}`;
  const folderNameF = `/PDF/${Surl.split("/").pop()}`;
  try {
    if (!fs.existsSync(path.join(__dirname, folderNameF))) {
      fs.mkdirSync(path.join(__dirname, folderNameF));
    }
    dlinkList.forEach(async (link) => {
      let name = link.names;
      let url = link.dlink;

      let file = fs
        .createWriteStream(`${folderName}/${name.split("/").pop()}`)
        .on("error", (err) => {
          console.error("createWriteStreamError: ", err);
        });

      try {
        const { data } = await axios({
          url,
          method: "GET",
          responseType: "stream",
          // timeout: 60000, //optional
          // httpsAgent: new https.Agent({ keepAlive: true }),
        });
        data.pipe(file);
      } catch (error) {
        console.error(error);
      }
    });
  } catch (error) {
    console.error("downloadFilesError: ", error);
  }
};

(async () => {
  await getWebsiteLinks(Surl);
  await downloadLinks(linkList);
  await downloadFiles(dlinkList);
})();
