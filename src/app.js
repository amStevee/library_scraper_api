import fs from "fs";
import path from "path";
import https from "https";
import $ from "cheerio";
import cheerio from "cheerio";
import axiosInstance from "./v2/infrastructure/api/getAxios";
import { checkFileExist, isValidUrl } from "./utils";
import puppeteer from "puppeteer";

const axios = axiosInstance();
const Surl = "https://www.ndic.gov.ng/publications";

// linkList sample:  "https://www.health.gov.ng/index.php?option=com_content&view=article&id=143&Itemid=512";

let connectionFailCount = 0;
let linkList = [];
let dlinkList = [];

async function loginUser(user) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
}


const getWebsiteLinks = async (Surl) => {
  try {
    console.log(`Crawling all links from: ${Surl}`);

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
      linkList.push(raw_links);
    }

    if (linkList.length > 0) {
      console.log(`Finished crawling links: Found ${linkList.length} links`);
      console.log(
        "--------------------------------------------------------\n\n",
      );
    }

    return;
  } catch (error) {
    if (connectionFailCount === 0) {
      connectionFailCount += 1;

      getWebsiteLinks(Surl);

      console.log(`Connection error. \n
      Reconnecting to server....`);
    } else if (connectionFailCount === 5) {
      console.error(`Can not connect to server. Try again later.`);
    }
  }
};

const downloadLinks = async (linkList) => {
  try {
    console.log("Crawling links to find pdf links. this may take  a while...");

    for (const link of linkList) {
      if (link) {
        let addr = link.split("/").pop();
        let dlink = link;
        dlinkList.push({
          pathName: addr,
          url: dlink,
        });
      }
    }

    if (dlinkList.length > 0) {
      console.log(`Crawling Finish: Found ${dlinkList.length} pdf links`);
      console.log(
        "--------------------------------------------------------\n\n",
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const downloadFiles = async (dlinkList) => {
  console.log("Creating directory to save PDF files");

  const appRoot = path.dirname(path.resolve(__dirname));

  const folderName = `PDF/${Surl.split("/").pop()}`;
  const subFolderName = Surl.split("/").pop();

  try {
    const isFolderExist = await checkFileExist(path.join(appRoot, folderName));
    if (isFolderExist) {
      fs.mkdirSync(path.join(appRoot, "PDF"));
      fs.mkdirSync(path.join(`${appRoot}/PDF`, subFolderName));
    }

    for (const link of dlinkList) {
      if (!link.pathName) continue;
      let name = link.pathName;
      if (!isValidUrl(link.url)) continue;
      let url = new URL(link.url);

      if (
        !url ||
        typeof url !== "string" ||
        !url.pathname.toLowerCase().endsWith(".pdf")
      ) {
        continue;
      }

      let file = fs
        .createWriteStream(
          `${appRoot}/${folderName}/${name.split("/").pop()}`,
          "utf-8",
        )
        .on("error", (err) => {
          console.error("createWriteStreamError: ", err);
        });

      try {
        console.log("Downloading PDF file...");

        const { data } = await axios({
          url,
          method: "GET",
          responseType: "stream",
        });

        if (data) {
          console.log("PDF file Downloaded");
          data.pipe(file);
        }
      } catch (error) {
        console.error(error);
      }
    }

    return;
  } catch (error) {
    console.error("downloadFilesError: ", error);
  }
};

(async () => {
  await getWebsiteLinks(Surl);
  await downloadLinks(linkList);
  await downloadFiles(dlinkList);
})();
