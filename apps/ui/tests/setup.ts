import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/*
 * jsdom has no layout engine. This stub supports observer lifecycle only;
 * size-dependent behaviour must be verified in Playwright.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    public observe = vi.fn();
    public unobserve = vi.fn();
    public disconnect = vi.fn();
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
}

/*
 * jsdom has neither IntersectionObserver nor element scrolling. Components
 * that lazy-load on visibility or scroll a row into view would throw on mount.
 * The stub records every instance so a test can push a sentinel "into view"
 * with `trigger(true)`; without a trigger it never fires on its own.
 */
export const intersectionObservers: IntersectionObserverStub[] = [];

export class IntersectionObserverStub {
  public readonly root = null;
  public readonly rootMargin = "";
  public readonly thresholds: readonly number[] = [];
  public readonly targets = new Set<Element>();
  public takeRecords = vi.fn((): IntersectionObserverEntry[] => []);
  public observe = vi.fn((target: Element) => {
    this.targets.add(target);
  });
  public unobserve = vi.fn((target: Element) => {
    this.targets.delete(target);
  });
  public disconnect = vi.fn(() => {
    this.targets.clear();
  });

  public constructor(
    private readonly callback: (
      entries: { isIntersecting: boolean; target: Element }[]
    ) => void = () => undefined
  ) {
    intersectionObservers.push(this);
  }

  public trigger(isIntersecting: boolean): void {
    this.callback(
      [...this.targets].map((target) => ({ isIntersecting, target }))
    );
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
}

if (typeof Element.prototype.scrollIntoView !== "function") {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn()
  });
}

/*
 * jsdom ships a stub `requestSubmit` that prints "Not implemented" the
 * first time React Hook Form (or any Enter-to-submit form path) calls
 * it. Replace it unconditionally with a spec-shaped polyfill so the
 * test output stays boring. Done at the very top of the setup file so
 * it lands before any other import touches a form prototype.
 */
Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
  configurable: true,
  writable: true,
  value: function requestSubmit(submitter?: HTMLElement | null): void {
    const event = new Event("submit", { bubbles: true, cancelable: true });

    if (submitter !== undefined && submitter !== null) {
      Object.defineProperty(event, "submitter", { value: submitter });
    }

    const proceed = this.dispatchEvent(event);

    if (proceed === true) {
      this.submit();
    }
  }
});

if (typeof globalThis.EventSource === "undefined") {
  class EventSourceStub {
    public onmessage: ((event: MessageEvent<string>) => void) | null = null;
    public onerror: (() => void) | null = null;
    public close(): void {
      // no-op
    }
  }

  (
    globalThis as unknown as { EventSource: typeof EventSourceStub }
  ).EventSource = EventSourceStub;
}

/*
 * lottie-web touches the canvas API at module load, which crashes jsdom.
 * Stub it across the test suite: components that pass animationData=null
 * never render the player anyway.
 */
vi.mock("lottie-react", () => ({
  default: () => null
}));

/*
 * Stub the Sentry SDK across the suite. With VITE_SENTRY_DSN unset Sentry
 * is a no-op in production anyway, but an explicit mock keeps tests off the
 * real SDK and lets specs assert capture/user calls. Covers the full surface
 * the app uses (init / captureException / setUser / addBreadcrumb /
 * browserTracingIntegration).
 */
vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({}))
}));
