import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — shadcn-style helper that merges Tailwind classes and resolves
 * conflicts (`p-2 p-4` → `p-4`). The only sanctioned way to compose
 * conditional `className` values (no ternaries, no template strings),
 * enforced by `react-component-architecture/classnames-required` — which
 * also accepts `classNames(...)` from the `classnames` package should a
 * consumer prefer that API and add the dependency themselves.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
