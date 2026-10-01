import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "../src/services/log";

describe("log", () => {
  afterEach(() => {
    vi.useRealTimers();
    log.clear();
  });

  it("drops entries from earlier days on the next write", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 1, 23, 0) });
    log.error("Yesterday", new Error("old"));
    expect(log.size).toBe(1);
    vi.setSystemTime(new Date(2026, 9, 2, 8, 0));
    log.warn("Today");
    expect(log.text()).toContain("WARN Today");
    expect(log.text()).not.toContain("Yesterday");
  });

  it("keeps only the latest entries", () => {
    for (let i = 0; i < 150; i++) log.warn(`Entry ${i}`);
    expect(log.size).toBe(100);
    expect(log.text()).toContain("Entry 149");
    expect(log.text()).not.toContain("Entry 49\n");
  });
});
