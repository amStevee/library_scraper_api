# libXp — Library experience

libXp is a web app and API for collecting supported files linked from a public
library or resource page. It downloads the files, packages them into one ZIP,
and sends that archive to the visitor's browser.

The current application is the **v2 Express app**. It serves the web interface
at `/` and the harvest API at `/api/v2/harvest/`.

## What users can do

1. Open the app and paste a public library or resource-page URL.
2. Start a harvest and watch the elapsed-time indicator and patience messages.
3. Keep the tab open while libXp checks the page and collects eligible files.
4. Receive one ZIP download in the browser when the harvest is complete.

libXp collects:

- PDF and DOCX links found on the submitted page.
- Public Google Drive file links. Public Drive files of any file type may be
  collected if they can be downloaded directly.

The harvester checks the submitted page; it does **not** crawl the entire site
or follow links to additional pages. It does not sign in to a website or Google
Drive. Files that require authentication or a Google Drive confirmation step
are not supported.

Downloads are staged temporarily on the server to build the ZIP, then streamed
to the visitor's browser. The app removes the staging directory after the
archive stream closes. The browser saves the ZIP to its configured downloads
location or asks the user where to save it.

## Requirements

- Node.js **22.12.0 or later** (required by the installed Puppeteer version).
- pnpm **12.14.0**, as specified by `package.json`.
- A Chromium browser executable available to Puppeteer.

The workspace denies install/build scripts for Puppeteer and the optional
`@parcel/watcher` dependency. A fresh pnpm install therefore may not run
Puppeteer's browser-download script. Either configure
`PUPPETEER_EXECUTABLE_PATH` to an installed Chrome/Chromium executable, or
review and deliberately allow Puppeteer's install script in the pnpm workspace
configuration. Jest runs in-band and does not need the optional watcher build.

> **Deployment note:** Puppeteer is currently listed under `devDependencies`
> even though the application needs it at runtime through `puppeteer-extra`.
> A production install that omits development dependencies may therefore fail
> to launch the browser. Ensure Puppeteer is present in the deployment
> environment; consider moving it to `dependencies` before adopting
> production-only installs.

## Quick start

From the repository root:

```sh
pnpm install
pnpm start
```

On Windows PowerShell, use `pnpm.cmd` if the `pnpm` PowerShell shim is blocked:

```powershell
pnpm.cmd install
pnpm.cmd start
```

By default, the server listens on port `8080`. To change it, set `PORT` in the
process environment or in an ignored `.env` file:

```dotenv
PORT=3000
```

Then open `http://localhost:8080/` (or the configured port). The health
endpoint is `GET /health` and returns:

```json
{ "success": true }
```

## HTTP API

### `POST /api/v2/harvest/`

Request a harvest by posting JSON:

```http
POST /api/v2/harvest/
Content-Type: application/json

{
  "url": "https://library.example.edu/resources"
}
```

Example with cURL:

```sh
curl -sS \
  -D harvest-headers.txt \
  -o harvest-response.bin \
  -X POST http://localhost:8080/api/v2/harvest/ \
  -H "Content-Type: application/json" \
  -d '{"url":"https://library.example.edu/resources"}'
```

Inspect `harvest-headers.txt` before treating `harvest-response.bin` as an
archive: it contains a ZIP on successful harvests, but contains JSON when no
supported links were found or an error occurred.

For a successful harvest, the response body is the ZIP archive:

```http
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename=library_example_edu-resources.zip
X-Harvest-File-Count: 2
X-Harvest-Message: Downloaded 2 file(s).
```

`X-Harvest-File-Count` is the number of files included. `X-Harvest-Message`
summarizes the outcome; if some candidates fail but others succeed, the ZIP is
still returned with a partial-success message.

Possible responses:

| Status | Response |
|---|---|
| `200` | ZIP archive when one or more files were downloaded. |
| `200` | JSON message when the page contains no supported file links. |
| `400` | Missing/invalid URL or a URL that violates the outbound-access policy. |
| `429` | Request limit exceeded. |
| `500` | The page could not be scraped, all file downloads failed, or archive creation/streaming failed. |

When there are no supported links, the response is JSON rather than an empty
ZIP. If all candidate downloads fail, the API returns an error; if only some
fail, it returns the archive containing the successful downloads.

The bundled UI calls this API on the same origin, handles the JSON and ZIP
responses, and triggers the browser download. API clients should inspect the
response `Content-Type` before treating the body as a ZIP.

## URL and outbound-access policy

The harvester accepts only public HTTP(S) destinations on the standard web
ports: HTTP port `80` and HTTPS port `443`. Other protocols, URLs containing
credentials, non-standard ports, and destinations resolving to non-public
addresses are rejected.

The restrictions apply to the submitted page, browser navigation and its
redirects, browser subrequests, and direct file downloads. Chromium uses a
loopback-bound outbound proxy that resolves destinations and connects to the
resolved public address. File downloads use a checked DNS lookup and follow
redirects manually, revalidating each destination and limiting the redirect
chain. Cross-origin redirects do not receive cookies, authorization, or
referrer headers from the original request.

This policy intentionally prevents using libXp to fetch local/private network
resources. A public page that links only to blocked destinations will not
produce a ZIP. Keep these controls in place when changing the scraper; do not
weaken them to make localhost-based harvest tests pass.

## Architecture

```text
Browser
  └─ view/ (static HTML, CSS, client JavaScript)
      └─ POST /api/v2/harvest/
          └─ Express middleware and routes
              └─ scraper controller (HTTP contract)
                  └─ scraping service (harvest orchestration)
                      ├─ outbound-access service (URL policy and proxy)
                      ├─ browser infrastructure (Puppeteer page/link discovery)
                      ├─ API infrastructure (Axios file downloads)
                      ├─ storage infrastructure (temporary files)
                      └─ archive infrastructure (ZIP stream and cleanup)
```

Important directories:

| Path | Responsibility |
|---|---|
| `src/v2/index.js` | Loads environment configuration and starts the server. |
| `src/v2/app.js` | Express middleware, API/static mounts, and health endpoint. |
| `src/v2/routes.js`, `src/v2/routes/` | API route composition. |
| `src/v2/controllers/` | HTTP validation, response codes/headers, and stream handling. |
| `src/v2/services/scraping/` | URL/link orchestration, supported-resource selection, and harvest summary. |
| `src/v2/infrastructure/network/` | Public-destination checks, DNS pinning, and Chromium's outbound proxy. |
| `src/v2/infrastructure/browser/` | Puppeteer browser lifecycle, page inspection, and file-download adapter. |
| `src/v2/infrastructure/api/` | Axios-based HTTP download adapter and redirect handling. |
| `src/v2/infrastructure/storage/` | Temporary-directory and local filesystem operations. |
| `src/v2/infrastructure/archive/` | ZIP creation, streaming, and staging cleanup. |
| `src/v2/infrastructure/htmlParser/` | Cheerio adapter; it is not currently used by the active harvest flow. |
| `src/v2/lib/` | Shared filename and URL helpers. |
| `view/` | Landing page, styles, and browser-side harvest/download behavior. |

Keep scraping/download integrations and their third-party packages behind
infrastructure providers. The Express application and middleware are composed
in `app.js` and the route files. The controller should remain focused on HTTP
behavior; the scraping service should orchestrate behavior without
constructing ZIPs or managing raw filesystem details.

`src/v1/` contains legacy scraper code. The normal `pnpm start` command starts
`src/v2/index.js`; v1 is not mounted by the current Express app.

## Runtime behavior and limits

- The page is rendered by Puppeteer and checked for anchor links after network
  activity settles. Links are deduplicated and downloaded sequentially.
- Direct links are selected by `.pdf` and `.docx` extensions. Supported public
  Google Drive share/download URL forms are normalized to a download URL.
- HTML responses are rejected as file downloads, including Drive sign-in or
  confirmation pages.
- Browser page navigation has a 30-second timeout and retries failed page loads
  up to five times. Each Axios request has a 60-second timeout; redirect chains
  are capped at five redirects.
- The progress bar is intentionally indeterminate; the API does not expose
  per-file or percentage progress. The UI shows elapsed time and reminds users
  to keep the page open.
- Temporary staging uses the operating system's temp directory with the
  `folio-harvest-` prefix. A process crash may leave temporary files behind;
  normal completion and stream-close paths remove them.

## Troubleshooting

- **“Only public HTTP(S) pages and files can be harvested.”** Check that the
  URL uses HTTP or HTTPS on port 80 or 443 and that its DNS records resolve
  only to public addresses. Local, private, link-local, and reserved
  destinations are intentionally blocked.
- **“No downloadable … links were found.”** The submitted page may have no
  anchor links to PDFs, DOCX files, or supported public Drive URLs. libXp does
  not search other pages on the site.
- **A Google Drive link is skipped or fails.** The file must be publicly
  downloadable without signing in or completing a confirmation step.
- **The harvest takes a long time or fails to load the page.** Downloads run
  sequentially. The page load waits for network activity to settle, has a
  30-second timeout, and retries failed page loads up to five times. Keep the
  browser tab open while the request is in progress.
- **Puppeteer cannot launch Chromium.** Check the Node version, ensure a
  compatible browser executable is installed, and set
  `PUPPETEER_EXECUTABLE_PATH` if it is not in Puppeteer's default location.
- **The ZIP does not appear in the browser.** Keep the tab open until the
  request completes, then check the browser's downloads list and download
  settings. The server does not keep a completed archive for later retrieval.

## Operational and security notes

- The API has no authentication. Express rate-limits requests to 100 per
  15-minute window using the default in-memory store.
- `cors()` currently allows cross-origin requests by default. Restrict allowed
  origins before exposing the API to untrusted clients.
- If deployed behind a reverse proxy, configure Express `trust proxy` and use a
  shared rate-limit store if requests can reach multiple app instances.
- Puppeteer currently launches Chromium with `--no-sandbox`. Run the app in an
  appropriately isolated, least-privilege environment and retain host/network
  egress controls as defense in depth.
- Harvest failures can log source file URLs. Avoid putting secrets or
  credentials in submitted URLs.
- Do not expose the temporary proxy as a public service; it is designed to
  listen only on loopback.

## Developing and validating changes

Run the Jest suite with:

```sh
pnpm test
```

Jest runs in-band with Node's VM module support for the project's native ES
modules. `tests/app.test.js` starts the Express app on an ephemeral loopback
port and tests the landing page, health endpoint, harvest input validation,
ZIP response headers/body, no-file response, blocked-destination mapping, and
generic failure handling. `tests/puppeteer-provider.test.js` checks browser
page initialization using mocked browser dependencies. These tests do not
launch Chromium or make requests to external websites.

For a change:

1. Keep the active v2 request path and its response contract in mind.
2. Add focused tests when introducing behavior; include blocked-destination
   and redirect cases for networking changes. The app tests mock the scraper
   and do not replace integration tests for browser, download, or archive
   infrastructure.
3. Do not use a loopback URL as a successful harvest fixture—the SSRF policy
   should reject it. The app tests use loopback only for their local HTTP
   server, with the scraper mocked. For a successful end-to-end harvest, use
   dependency injection/mocks or an appropriately controlled public staging
   site.
4. Update this README and the visible FAQ's JSON-LD whenever user-facing
   capabilities, response behavior, or FAQ copy changes.
5. Run `pnpm test`, syntax checks for changed JavaScript, and `git diff --check`.

The codebase uses native JavaScript ES modules (`"type": "module"`). Keep
explicit `.js` extensions on local imports and follow the existing
provider/service factory pattern when adding infrastructure adapters.

## Search and sharing metadata

The static landing page includes a title and description, Open Graph/Twitter
metadata, a `WebApplication` JSON-LD block, and a `FAQPage` block that mirrors
the visible FAQs. If visible FAQ questions or answers change, update the JSON-LD
to match exactly. A deployed public domain is needed to add deployment-specific
canonical and social URL/image metadata.

## License

The repository's `LICENSE` file contains GNU General Public License version 3.
The `package.json` metadata currently says `ISC`, which conflicts with that
file. Reconcile the license metadata before publishing or redistributing the
project; this README does not resolve that discrepancy.
