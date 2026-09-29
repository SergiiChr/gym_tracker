import { describe, expect, it } from "vitest";
import { fuzzyMatch } from "../src/services/search";

describe("fuzzyMatch", () => {
  it("matches letters in order, ignoring case and spaces", () => {
    expect(fuzzyMatch("bpr", "Bench Press")).toBe(true);
    expect(fuzzyMatch("bench PR", "Bench Press")).toBe(true);
    expect(fuzzyMatch("", "Squat")).toBe(true);
  });

  it("rejects letters out of order or missing", () => {
    expect(fuzzyMatch("pb", "Bench Press")).toBe(false);
    expect(fuzzyMatch("squatx", "Squat")).toBe(false);
  });
});
