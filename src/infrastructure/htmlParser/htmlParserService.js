export class HtmlParserService {
  constructor(provider) {
    this.provider = provider;
  }

  async getAttrHrefs(data) {
    return await this.provider.getAttrHrefs(data);
  }
}

export function createHtmlParserService(provider) {
  return new HtmlParserService(provider);
}
