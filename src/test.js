import { axiosInstance } from "./v2/infrastructure/api/getAxios.js";
import { htmlParserService } from "./v2/infrastructure/htmlParser/htmlParserProvider.js";

const axios = axiosInstance();
const Surl = "https://www.ndic.gov.ng/publications";

async function fetchLinks(Surl) {
  try {
    const response = await axios.get(Surl);

    if (typeof response.data !== "string") return;

    if (response.data) {
      console.log(await htmlParserService.getAttrHrefs(response.data));
    }
  } catch (error) {
    console.error(error);
  }
}

fetchLinks(Surl);
