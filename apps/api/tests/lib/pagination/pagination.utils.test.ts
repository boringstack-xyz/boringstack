import { describe, expect, test } from "bun:test";
import { PaginationUtils } from "../../../src/lib/pagination";

describe("PaginationUtils.parseParams", () => {
  test("defaults: page=1, limit=20, offset=0", () => {
    expect(PaginationUtils.parseParams({})).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });
  });

  test("clamps page to >= 1", () => {
    expect(PaginationUtils.parseParams({ page: 0 }).page).toBe(1);
    expect(PaginationUtils.parseParams({ page: -5 }).page).toBe(1);
  });

  test("clamps limit to [1, 100]", () => {
    expect(PaginationUtils.parseParams({ limit: 0 }).limit).toBe(1);
    expect(PaginationUtils.parseParams({ limit: 999 }).limit).toBe(100);
  });

  test("computes offset from page+limit", () => {
    expect(PaginationUtils.parseParams({ page: 3, limit: 25 }).offset).toBe(50);
  });
});

describe("PaginationUtils.createMeta", () => {
  test("computes totalPages and hasNext/hasPrev", () => {
    const meta = PaginationUtils.createMeta(2, 10, 35);

    expect(meta.totalPages).toBe(4);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
  });

  test("first page: hasPrev=false", () => {
    const meta = PaginationUtils.createMeta(1, 10, 35);

    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(true);
  });

  test("last page: hasNext=false", () => {
    const meta = PaginationUtils.createMeta(4, 10, 35);

    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  test("empty result: totalPages=0, no next/prev", () => {
    const meta = PaginationUtils.createMeta(1, 10, 0);

    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });
});

describe("PaginationUtils.createResponse", () => {
  test("wraps data + meta", () => {
    const meta = PaginationUtils.createMeta(1, 10, 1);
    const res = PaginationUtils.createResponse([{ id: "x" }], meta);

    expect(res.data).toHaveLength(1);
    expect(res.meta).toBe(meta);
  });
});
