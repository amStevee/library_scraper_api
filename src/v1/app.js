import fs from "fs";
import path from "path";
import cheerio from "cheerio";
import axios from "./axiosinstance.js";

const sourceURL = process.argv[2]; //"https://www.ndic.gov.ng/publications";

// linkList sample:  "https://www.health.gov.ng/index.php?option=com_content&view=article&id=143&Itemid=512";

function isValidUrl(url) {
  if (new URL(url)) {
    return true;
  } else {
    return false;
  }
}

let connectionFailCount = 0;
let linkList = [];
let dlinkList = [];

const getWebsiteLinks = async (sourceURL) => {
  try {
    console.log(`Crawling all links from: ${sourceURL}`);

    const response = await axios.get(sourceURL);
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

      getWebsiteLinks(sourceURL);

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

  const folderName = `PDF/${sourceURL.split("/").pop()}`;
  const subFolderName = sourceURL.split("/").pop();

  try {
    const isFolderExist = (
      await fs.promises.stat(path.join(appRoot, folderName))
    ).isDirectory();
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

        console.log("THIS IS THE DATA");

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
  await getWebsiteLinks(sourceURL);
  await downloadLinks(linkList);
  await downloadFiles(dlinkList);
})();
