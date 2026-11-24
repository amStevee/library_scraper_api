import { scrapPage } from "../services/scraping/scrapingService.js";

export default async function (req, res) {
  let { url } = req.body;
  if (!url) return res.status(400).json({ message: "invalid url path" });
  try {
    const data = await scrapPage(url);
    if (!data) return res.status(500).json({ message: `unable to scrape url` });

    res.status(200).json({ message: data });
  } catch (error) {}
}
