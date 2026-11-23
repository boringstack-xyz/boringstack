/* The factory's one clock (lint: code-flow/no-bare-date-now), so tests can reason about time. */
export const nowMs = (): number => Date.now();

export const nowIso = (): string => new Date(nowMs()).toISOString();
