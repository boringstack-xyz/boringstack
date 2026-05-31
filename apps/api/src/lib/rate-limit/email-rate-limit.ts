/**
 * Lightweight per-email rate limiter. In-memory only — sufficient for
 * single-process deployments (the default target of this template).
 * For horizontal scale, swap in a Valkey-backed implementation.
 *
 * Used on endpoints that trigger external email delivery (resend-verification,
 * forgot-password) to prevent inbox-spam attacks from distributed IPs.
 */
import { nowMs } from "../time/now";

class EmailRateLimiter {
  private static readonly windowMs = 300_000; // 5 minutes
  private static readonly maxAttempts = 3;
  private static readonly sweepIntervalMs = 600_000; // 10 minutes

  private readonly attempts = new Map<string, number[]>();

  constructor() {
    setInterval(() => {
      this.sweep();
    }, EmailRateLimiter.sweepIntervalMs).unref();
  }

  check(email: string): boolean {
    const now = nowMs();
    const key = email.toLowerCase().trim();
    const timestamps = this.attempts.get(key) ?? [];

    // Prune stale entries outside the window
    const valid = timestamps.filter(
      (timestamp) => now - timestamp < EmailRateLimiter.windowMs
    );

    if (valid.length >= EmailRateLimiter.maxAttempts) {
      this.attempts.set(key, valid);

      return false;
    }

    valid.push(now);
    this.attempts.set(key, valid);

    return true;
  }

  /**
   * Housekeeping: sweep the map periodically so it doesn't grow forever.
   * Called automatically every 10 minutes; safe to call manually in tests.
   */
  sweep(): void {
    const now = nowMs();

    for (const [key, timestamps] of this.attempts) {
      const valid = timestamps.filter(
        (timestamp) => now - timestamp < EmailRateLimiter.windowMs
      );

      if (valid.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, valid);
      }
    }
  }
}

export const emailRateLimiter = new EmailRateLimiter();
