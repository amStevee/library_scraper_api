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
    console.log(linkList);
  } catch (error) {
    console.error(error);
  }
};

const downloadLinks = async (linkList) => {
  try {
    for (const link of linkList) {
      const { data } = await axios.get(link);
      const $ = cheerio.load(data);
      for (let index = 0; index < $("a")[1].attribs.href.length; index++) {
        let names = $("a")[index].attribs.href;
        console.log(names);
      }
      //   names = names.match(/doc\s*=\s*['"]([^'"]*)['"]/);
      // let dlink = Surl + names;
      // dlinkList.push({
      //   names: names,
      //   dlink: dlink,
      // });
    }
    // console.log(dlinkList);
  } catch (error) {
    console.error(error);
  }
};

const downloadFiles = async (dlinkList) => {
  const folderName = `/Users/Steven Anongo/Desktop/BRAND/projects/Library_web_scraper_api/PDF/`;
  try {
    for (const link of dlinkList) {
      if (!fs.existsSync(folderName)) {
        fs.mkdirSync(folderName);
      }
      let name = link.names + ".pdf";
      let url = link.dlink;
      let file = fs.createWriteStream(`${folderName}/${name}`);
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
      });
      // path.resolve(__dirname, "PDF", url, response.data.pipe(file));
      response.data.pipe(file);
    }
  } catch (error) {
    console.log(error);
  }
};

(async () => {
  await getWebsiteLinks(url);
  await downloadLinks(linkList);
  //   await downloadFiles(dlinkList);
})();
