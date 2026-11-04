

export class BrowserService {
    constructor(provider) {
        this.provider = provider;
    }

    async lunchBrowser() {
        return await this.provider.lunchBrowser();
    }

    
}

export function createBrowserService(provider) {
    return new BrowserService(provider);
}