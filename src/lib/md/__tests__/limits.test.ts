import { describe, it, expect } from "vitest";
import { exceedsLimit, MAX_BYTES, byteLength } from "../limits";

describe("limits", () => {
  it("accepts content within 5 MB", () => {
    const s = "a".repeat(1024);
    expect(exceedsLimit(s)).toBe(false);
    expect(byteLength(s)).toBe(1024);
  });

  it("rejects content over 5 MB", () => {
    const s = "a".repeat(MAX_BYTES + 1);
    expect(exceedsLimit(s)).toBe(true);
  });

  it("counts multi-byte chars by bytes, not chars", () => {
    expect(byteLength("é")).toBe(2);
  });
});
