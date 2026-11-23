/*
 * Known violations, one per merge-gate rule. The lint parity test lints this
 * file with Oxlint and with the ESLint remainder, and asserts that every rule
 * below reports at least once. Keep every binding exported so the file still
 * typechecks under noUnusedLocals.
 */
import { useEffect, useState } from "react";

export const explicitAny: any = 1;

export const nonNull = (maybe: string | undefined): string => maybe!;

export const typeAssertion = 1 as number;

export function floating(): void {
  Promise.resolve(1);
}

export function looseEquality(value: number): boolean {
  return value == 1;
}

export function missingCurly(value: boolean): number {
  if (value) return 1;
  return 0;
}

export function consoleUse(): void {
  console.log("hello");
}

export function rawFetch(): void {
  void fetch("/api/none");
}

export function HooksViolation(props: { id: number }): number {
  const [count] = useState(0);
  useEffect(() => {
    void props.id;
  }, []);
  return count;
}

export function ConditionalHook(flag: boolean): number {
  if (flag) {
    useState(0);
  }
  return 0;
}

export const eslintOnlyPrefer = (): number => {
  let never = 1;
  return never;
};

export const spacingViolation = 1;
