import { jest } from "@jest/globals";
import { Readable } from "node:stream";

const mockScrapPage = jest.fn();

jest.unstable_mockModule(
  "../src/v2/services/scraping/scrapingService.js",
  () => ({
    scrapPage: mockScrapPage,
  }),
);

const { default: app } = await import("../src/v2/app.js");

let server;
let baseUrl;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  mockScrapPage.mockReset();
});

async function postHarvest(body) {
  return fetch(`${baseUrl}/api/v2/harvest/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Express app", () => {
  test("serves the libXp landing page at /", async () => {
    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    expect(await response.text()).toContain(
      "<title>libXp | Library Resource Harvester</title>",
    );
  });

  test("returns a healthy status from /health", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  test("rejects harvest requests without a URL before calling the scraper", async () => {
    const response = await postHarvest({ url: "  " });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "A URL is required." });
    expect(mockScrapPage).not.toHaveBeenCalled();
  });

  test("streams a successful ZIP with harvest metadata", async () => {
    mockScrapPage.mockResolvedValue({
      fileCount: 2,
      archiveName: "resources.zip",
      message: "Downloaded 2 file(s).",
      downloadStream: Readable.from([Buffer.from("zip-content")]),
    });

    const response = await postHarvest({
      url: "  https://library.example.edu/resources  ",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/zip/);
    expect(response.headers.get("content-disposition")).toContain(
      "resources.zip",
    );
    expect(response.headers.get("x-harvest-file-count")).toBe("2");
    expect(response.headers.get("x-harvest-message")).toBe(
      "Downloaded 2 file(s).",
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from("zip-content"),
    );
    expect(mockScrapPage).toHaveBeenCalledWith(
      "https://library.example.edu/resources",
    );
  });

  test("returns the scraper's message when no downloadable files are found", async () => {
    const message = "No downloadable resources were found.";
    mockScrapPage.mockResolvedValue({ fileCount: 0, message });

    const response = await postHarvest({
      url: "https://library.example.edu/resources",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(await response.json()).toEqual({ message });
  });

  test("maps blocked outbound destinations to a client error", async () => {
    const error = Object.assign(new Error("blocked"), {
      code: "ERR_OUTBOUND_DESTINATION_BLOCKED",
    });
    mockScrapPage.mockRejectedValue(error);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await postHarvest({
        url: "http://127.0.0.1/private",
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: "Only public HTTP(S) pages and files can be harvested.",
      });
    } finally {
      consoleError.mockRestore();
    }
  });

  test("returns a generic server error when harvesting fails", async () => {
    mockScrapPage.mockRejectedValue(new Error("internal detail"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await postHarvest({
        url: "https://library.example.edu/resources",
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        message: "Unable to scrape URL.",
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
