import { siteConfig } from "../lib/site-config";

// Consent is stored locally in this browser only. Analytics stays off until the
// visitor accepts. Storage can be blocked, so every access is guarded.
const STORAGE_KEY = "boringstack-consent-v1";

type Choice = "accepted" | "declined";

function readChoice(): Choice | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(choice: Choice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Storage unavailable: the choice applies to this page view only.
  }
}

function loadAnalytics(): void {
  const analytics = siteConfig.analytics;
  if (!analytics || document.querySelector("script[data-analytics]")) return;
  const script = document.createElement("script");
  script.src = analytics.scriptUrl;
  script.defer = true;
  script.dataset.analytics = "";
  script.dataset.websiteId = analytics.websiteId;
  document.head.append(script);
}

const banner = document.querySelector<HTMLElement>("[data-consent-banner]");

function showBanner(): void {
  if (banner) banner.hidden = false;
}

function hideBanner(): void {
  if (banner) banner.hidden = true;
}

if (siteConfig.analytics) {
  const choice = readChoice();
  if (choice === "accepted") loadAnalytics();
  if (choice === null) showBanner();

  document
    .querySelector("[data-consent-accept]")
    ?.addEventListener("click", () => {
      writeChoice("accepted");
      hideBanner();
      loadAnalytics();
    });
  document
    .querySelector("[data-consent-decline]")
    ?.addEventListener("click", () => {
      writeChoice("declined");
      hideBanner();
    });
  document
    .querySelector("[data-cookie-preferences]")
    ?.addEventListener("click", showBanner);
}
