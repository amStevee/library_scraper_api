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

  async getStream(url, headers) {
    return await this.provider.getStream(url, headers);
  }
}

export function createApiService(provider) {
  return new ApiService(provider);
}
