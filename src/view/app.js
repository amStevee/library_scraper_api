const form = document.querySelector("#harvest-form");
const urlInput = document.querySelector("#page-url");
const submitButton = form.querySelector('button[type="submit"]');
const statusMessage = document.querySelector("#harvest-status");
const progressPanel = document.querySelector("#harvest-progress");
const elapsedTime = document.querySelector("#elapsed-time");
const patienceNote = document.querySelector("#patience-note");
const patienceMessage = document.querySelector("#patience-message");
const endpoint = "/api/v2/harvest/";

let elapsedInterval;
let patienceInterval;
let patienceSlideTimeout;
let startedAt;
let patienceMessageIndex = 0;

const patienceMessages = [
  "Checking this page for PDFs, DOCX files, and public Drive links.",
  "Gathering available files from this page (not crawling the whole site).",
  "Larger files can take a little longer. Keep this tab open for your ZIP.",
  "Your collection is being prepared as one ZIP download. Thanks for waiting.",
];

function updateElapsedTime() {
  const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  elapsedTime.textContent = `${minutes}:${seconds}`;
}

function showNextPatienceMessage() {
  patienceMessage.classList.add("is-changing");
  patienceSlideTimeout = window.setTimeout(() => {
    patienceMessageIndex =
      (patienceMessageIndex + 1) % patienceMessages.length;
    patienceMessage.textContent = patienceMessages[patienceMessageIndex];
    patienceMessage.classList.remove("is-changing");
  }, 220);
}

function startProgress() {
  startedAt = Date.now();
  progressPanel.hidden = false;
  elapsedTime.textContent = "0:00";
  patienceMessageIndex = 0;
  patienceMessage.textContent = patienceMessages[patienceMessageIndex];
  patienceMessage.classList.remove("is-changing");
  patienceNote.hidden = false;
  window.requestAnimationFrame(() => patienceNote.classList.add("is-visible"));
  statusMessage.textContent = "Harvest started.";
  statusMessage.dataset.state = "loading";
  form.setAttribute("aria-busy", "true");

  elapsedInterval = window.setInterval(updateElapsedTime, 1000);
  patienceInterval = window.setInterval(showNextPatienceMessage, 5200);
}

function stopProgress() {
  window.clearInterval(elapsedInterval);
  window.clearInterval(patienceInterval);
  window.clearTimeout(patienceSlideTimeout);
  progressPanel.hidden = true;
  patienceNote.classList.remove("is-visible", "is-changing");
  patienceNote.hidden = true;
  form.removeAttribute("aria-busy");
}

function downloadArchive(blob, contentDisposition) {
  const fileName =
    contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] ||
    "libxp-resources.zip";
  const downloadUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = fileName;
  downloadLink.hidden = true;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (submitButton.disabled) return;
  if (!urlInput.reportValidity()) return;

  startProgress();
  submitButton.disabled = true;
  urlInput.disabled = true;
  submitButton.querySelector("span").textContent = "Harvesting…";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput.value.trim() }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/zip")) {
      const archive = await response.blob();
      downloadArchive(archive, response.headers.get("content-disposition"));

      const detail =
        response.headers.get("X-Harvest-Message") || "Your files are ready.";
      statusMessage.textContent = `ZIP download started. ${detail} Check your browser's downloads.`;
      statusMessage.dataset.state = "success";
      return;
    }

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        typeof result?.message === "string"
          ? result.message
          : `The harvest request failed (${response.status}). Please try again.`,
      );
      error.status = response.status;
      throw error;
    }

    const detail =
      typeof result?.message === "string" && result.message.trim()
        ? result.message.trim()
        : "The service finished processing the page.";
    const hasResources = !detail.startsWith("No downloadable");

    statusMessage.textContent = hasResources
      ? `Harvest complete. ${detail}`
      : `Harvest finished. ${detail}`;
    statusMessage.dataset.state = hasResources ? "success" : "notice";
  } catch (error) {
    if (error instanceof TypeError) {
      statusMessage.textContent =
        "The download connection could not be completed. Check your connection and try again.";
    } else if (
      error instanceof Error &&
      (error.status === 500 || error.message === "Unable to scrape URL.")
    ) {
      statusMessage.textContent =
        "libXp could not complete this harvest. Check that the page is public and try again. Files requiring sign-in or Drive confirmation are not supported.";
    } else {
      statusMessage.textContent =
        error instanceof Error
          ? error.message
          : "The harvest could not be completed. Please try again.";
    }
    statusMessage.dataset.state = "error";
  } finally {
    stopProgress();
    submitButton.disabled = false;
    urlInput.disabled = false;
    submitButton.querySelector("span").textContent = "Harvest resources";
  }
});
