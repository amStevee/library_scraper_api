const puppeteer = require("puppeteer");
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
        linkList.push(url + raw_links);
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
      // let names = $("a").attr("href").endsWith(".pdf");
      // console.log($("a")[1].attribs.href);
      // console.log($.html(data));
      let names = $(".menu-item > a").attr();
      console.log(names);
      //   names = names.match(/doc\s*=\s*['"]([^'"]*)['"]/);
      // let dlink = Surl + names;
      // dlinkList.push({
      //   names: names,
      //   dlink: dlink,
      // });
    }
    // console.log(dlinkList);
  } catch (error) {
    console.log(error);
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

// puppeteer
//   .launch()
//   .then(function (browser) {
//     return browser.newPage();
//   })
//   .then(function (page) {
//     return page.goto(url).then(function () {
//       return page.content();
//     });
//   })
//   .then(function (html) {
//     $("h2", html).each(function () {
//       console.log($(this).text());
//     });
//   })
//   .catch(function (err) {
//     //handle error
//   });