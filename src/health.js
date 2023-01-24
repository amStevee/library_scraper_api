const fs = require("fs");
const path = require("path");
const https = require("https");
const $ = require("cheerio");
const cheerio = require("cheerio");
const axiosInstance = require("./getAxios");

const axios = axiosInstance();
const Surl = "https://www.health.gov.ng";

// linkList sample:  "https://www.health.gov.ng/index.php?option=com_content&view=article&id=143&Itemid=512";

let = connectionFailCount = 0;
let linkList = [];
let dlinkList = [];

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
      if (raw_links.startsWith("/")) {
        linkList.push(Surl + raw_links);
      }
    }

    if (linkList.length > 0) {
      console.log(`Finished crawling links: Found ${linkList.length} links`);
      console.log(
        "--------------------------------------------------------\n\n"
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
      const response = await axios.get(link);

      // Skip where there's delayed server response
      if (response.code === "ECONNRESET") continue;

      const $ = cheerio.load(response.data);

      $("a").each(function (idx, el) {
        if ($(el)?.attr("href")?.endsWith(".pdf")) {
          let addr = $(el).attr("href");
          let dlink = Surl + addr;

          dlinkList.push({
            pathName: addr,
            url: dlink,
          });
        }
      });
    }

    console.log(dlinkList);
    if (dlinkList.length > 0) {
      console.log(`Crawling Finish: Found ${dlinkList.length} pdf links`);
      console.log(
        "--------------------------------------------------------\n\n"
      );
    }
  } catch (error) {
    if (connectionFailCount === 0) {
      connectionFailCount += 1;

      console.log(`Connection error. \n
      Reconnecting to server: ${connectionFailCount} count`);
      downloadLinks(linkList);
    }

    if (connectionFailCount === 3) {
      console.error(`Can not connect to server. Try again later.`);

      return;
    }

    // console.error("downloadLinksError: ", error);
  }
};

const downloadFiles = async (dlinkList) => {
  console.log("Creating directory to save PDF files");

  const appRoot = path.dirname(path.resolve(__dirname));

  // Had to change and restructure code due to error
  const folderName = `PDF/${Surl.split("/").pop()}`;
  const subFolderName = Surl.split("/").pop();

  try {
    if (!fs.existsSync(path.join(appRoot, folderName))) {
      fs.mkdirSync(path.join(appRoot, "PDF"));
      fs.mkdirSync(path.join(`${appRoot}/PDF`, subFolderName));
    }

    dlinkList.forEach(async (link) => {
      let name = link.pathName;
      let url = link.url;

      let file = fs
        .createWriteStream(
          `${appRoot}/${folderName}/${name.split("/").pop()}`,
          "utf-8"
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
    });

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

/// OLD LOGIC
// const FFdownloadFiles = async (dlinkList) => {
//   console.log("Creating directory to save PDF files");

//   try {
//     // Create directory to save PDF files
//     const pdfDir = path.join(__dirname, "pdfs");
//     if (!fs.existsSync(pdfDir)) {
//       fs.mkdirSync(pdfDir);
//     }

//     for (const link of dlinkList) {
//       // Create the file path for the PDF
//       const filePath = path.join(pdfDir, link.pathName);

//       // Create a write stream to save the PDF to the file path
//       const pdfWriteStream = fs.createWriteStream(filePath);

//       // Pipe the data from the GET request to the write stream
//       const response = await axios.get(link.url, { responseType: "stream" });
//       if (response.data) {
//         response.data.pipe(pdfWriteStream);
//       }

//       pdfWriteStream.on("finish", () => {
//         console.log(`PDF saved to ${filePath}`);
//       });
//     }
//   } catch (err) {
//     console.error(err);
//   }
// };

const OdownloadFiles = async (dlinkList) => {
  console.log("Creating directory to save PDF files");

  const appRoot = path.dirname(path.resolve(__dirname));

  // Had to change and restructure code due to error
  const folderName = `PDF/${Surl.split("/").pop()}`;
  const subFolderName = Surl.split("/").pop();

  try {
    if (!fs.existsSync(path.join(appRoot, folderName))) {
      // fs.mkdirSync(path.join(appRoot, "PDF"));
      //line 155 is causing an error for some reason so i had to coment it out
      fs.mkdirSync(path.join(`${appRoot}/PDF`, subFolderName));
    }

    dlinkList.forEach(async (link) => {
      let name = link.pathName;
      let url = link.url;

      let file = fs
        .createWriteStream(
          `${appRoot}/${folderName}/${name.split("/").pop()}`,
          "utf-8"
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
    });

    return;
  } catch (error) {
    console.error("downloadFilesError: ", error);
  }
};
