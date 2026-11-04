class ApiService {
  constructor(provider) {
    this.provider = provider;
  }

  async fetchHtml(url) {
    try {
      return await this.provider.fetchHtml(url);
    } catch (error) {
      console.error(error);
    }
  }

  async getStream(link) {
    try {
      return await this.provider.getStream(link);
    } catch (error) {
      console.error(error);
    }
  }
}

export function createApiService(provider) {
  return new ApiService(provider);
}
