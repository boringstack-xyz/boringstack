/*
 * Known violations, one per hard-ban rule. The lint parity test lints this
 * file with Oxlint and with the ESLint remainder, and asserts that every rule
 * below reports at least once. Keep every binding exported so the file still
 * typechecks under noUnusedLocals.
 */
import { readFileSync } from "node:fs";

export const explicitAny: any = 1;

export const unsafeAssignment: string = JSON.parse("1") as unknown as string;

export const nonNull = (maybe: string | undefined): string => maybe!;

export const typeAssertion = 1 as number;

export function floating(): void {
  Promise.resolve(1);
}

export function unsafeMember(value: any): string {
  return value;
}

export function consoleUse(): void {
  console.log("hello");
}

export function looseEquality(value: number): boolean {
  return value == 1;
}

export function missingCurly(value: boolean): number {
  if (value) return 1;
  return 0;
}

export let mutableBinding = 1;

export const reassigned = (): number => {
  let count = 0;
  count = 2;
  return count;
};

export function debuggerStatement(): void {
  debugger;
}

export function nonExhaustive(state: "a" | "b"): number {
  switch (state) {
    case "a":
      return 1;
  }
  return 0;
}

export function strictBoolean(text: string): boolean {
  if (text) {
    return true;
  }
  return false;
}

export function unnecessaryCondition(): boolean {
  const alwaysTrue = true;
  return alwaysTrue === true && readFileSync.length > -1;
}

export function namingConvention(): void {
  interface lowercaseInterface {
    readonly value: number;
  }
  const typed: lowercaseInterface = { value: 1 };
  void typed;
}

export function promiseReturn(): Promise<number> {
  return Promise.resolve(1);
}

export function consumer(input: string): string {
  return input;
}

export function unsafeUsage(value: any): void {
  const assigned: string = value;
  void assigned;
  value.member;
  consumer(value);
  value();
}

export var legacyVar = 1;

export enum LegacyEnum {
  A = "a",
}

export const   spacingViolation=1;
