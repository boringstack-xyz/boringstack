import { env } from "@/lib/env";
import { nowMs } from "@/lib/time/now";

import {
  ANALYTICS_EVENTS,
  ANALYTICS_PARAM_KEYS,
  ANALYTICS_PARAM_VALUE_PATTERN,
  GA_COOKIE_PATTERN
} from "./analytics.constants";
import type {
  TAnalyticsEvent,
  TAnalyticsParams,
  TAnalyticsValue
} from "./analytics.types";

const EVENT_SET: ReadonlySet<string> = new Set(ANALYTICS_EVENTS);
const PARAM_SET: ReadonlySet<string> = new Set(ANALYTICS_PARAM_KEYS);
const ID_SEGMENT_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f-]{27}|\d{6,})$/iu;

let granted = false;
let loaded = false;

/* GA4 reads its commands from the queue as `arguments` objects, not arrays. */
function gtag(..._args: unknown[]): void {
  const queue: unknown = Reflect.get(window, "dataLayer");

  if (Array.isArray(queue)) {
    queue.push(arguments);
  } else {
    Reflect.set(window, "dataLayer", [arguments]);
  }
}

function clearGaCookies(): void {
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0] ?? "";

    if (GA_COOKIE_PATTERN.test(name)) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  }
}

/* The script is requested only after consent, and only once per page load. */
function loadGtag(id: string): void {
  if (loaded) {
    return;
  }

  loaded = true;
  gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
  gtag("js", new Date(nowMs()));
  gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  const script = document.createElement("script");

  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.async = true;
  document.head.append(script);
}

/** Applies the visitor's analytics choice. Withdrawing it stops and clears GA. */
export function setAnalyticsConsent(next: boolean): void {
  const id = env.VITE_GA_MEASUREMENT_ID;

  granted = next;

  if (id === "") {
    return;
  }

  Reflect.set(window, `ga-disable-${id}`, !next);

  if (!next) {
    clearGaCookies();

    return;
  }

  loadGtag(id);
}

/** True only while the visitor accepts analytics and a measurement id is set. */
export function isAnalyticsGranted(): boolean {
  return granted && env.VITE_GA_MEASUREMENT_ID !== "";
}

/** Route path with any id-looking segment replaced, so no record ids leave the app. */
export function analyticsPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => (ID_SEGMENT_PATTERN.test(segment) ? ":id" : segment))
    .join("/");
}

export function trackPage(pathname: string): void {
  if (!isAnalyticsGranted()) {
    return;
  }

  const path = analyticsPath(pathname);

  gtag("event", "page_view", {
    page_location: `${window.location.origin}${path}`,
    page_title: path
  });
}

/** Sends an allowlisted event with allowlisted, short parameters only. */
export function trackEvent(
  name: TAnalyticsEvent,
  params: TAnalyticsParams = {}
): void {
  if (!isAnalyticsGranted() || !EVENT_SET.has(name)) {
    return;
  }

  const clean: Record<string, TAnalyticsValue> = {};

  for (const [key, value] of Object.entries(params)) {
    if (!PARAM_SET.has(key)) {
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      clean[key] = value;
    } else if (
      typeof value === "string" &&
      ANALYTICS_PARAM_VALUE_PATTERN.test(value)
    ) {
      clean[key] = value;
    }
  }

  gtag("event", name, clean);
}
