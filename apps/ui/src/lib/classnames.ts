import classNames from "classnames";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — shadcn-style helper that merges Tailwind classes and resolves
 * conflicts (`p-2 p-4` → `p-4`). Use for component-internal computed classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * `classNames` — the original `classnames` API kept available because
 * `eslint-plugin-react-component-architecture/classnames-required` recognises
 * calls to either `classNames(...)` or `cn(...)` as the only legal way to
 * compose conditional `className` values (no ternaries, no template strings).
 */
export { classNames };
export default classNames;
