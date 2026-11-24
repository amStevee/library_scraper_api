import { jest } from "@jest/globals";

const mockGetProxyUrl = jest.fn().mockResolvedValue("http://127.0.0.1:12345");
const mockCookies = jest.fn().mockResolvedValue([]);
const mockPage = {
  browserContext: jest.fn(() => ({ cookies: mockCookies })),
  setUserAgent: jest.fn(),
};
const mockBrowser = {
  close: jest.fn(),
  newPage: jest.fn().mockResolvedValue(mockPage),
};
const mockPuppeteer = {
  launch: jest.fn().mockResolvedValue(mockBrowser),
  use: jest.fn(),
};

jest.unstable_mockModule("puppeteer-extra", () => ({
  default: mockPuppeteer,
}));
jest.unstable_mockModule("puppeteer-extra-plugin-stealth", () => ({
  default: jest.fn(() => ({})),
}));
jest.unstable_mockModule(
  "../src/v2/infrastructure/network/outboundAccessProvider.js",
  () => ({
    outboundAccessService: { getProxyUrl: mockGetProxyUrl },
  }),
);
jest.unstable_mockModule(
  "../src/v2/infrastructure/storage/storageProvider.js",
  () => ({
    storageService: {},
  }),
);
jest.unstable_mockModule("../src/v2/infrastructure/api/apiProvider.js", () => ({
  apiService: {},
}));

const { PuppeteerProvider } = await import(
  "../src/v2/infrastructure/browser/providers/puppeteer.js"
);

describe("PuppeteerProvider", () => {
  test("opens a browser page without requesting file-specific cookies", async () => {
    const provider = new PuppeteerProvider();

    const browserInstance = await provider.lunchBrowserPage();

    expect(browserInstance).toEqual({ page: mockPage });
    expect(mockCookies).not.toHaveBeenCalled();
    expect(mockBrowser.close).not.toHaveBeenCalled();
  });
});
