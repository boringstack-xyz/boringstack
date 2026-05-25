import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

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
 * Stub it across the test suite — components that pass animationData=null
 * never render the player anyway.
 */
vi.mock("lottie-react", () => ({
  default: () => null
}));
