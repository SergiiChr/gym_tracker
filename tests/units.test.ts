import { describe, expect, it } from "vitest";
import { convertData, convertWeight, formatWeight } from "../src/model/units";
import { sampleData } from "./helpers";

describe("units", () => {
  it("converts and rounds to loadable weights", () => {
    expect(convertWeight(100, "kg", "lbs")).toBe(220);
    expect(convertWeight(225, "lbs", "kg")).toBe(102);
    expect(convertWeight(20, "kg", "kg")).toBe(20);
  });

  it("converts all stored weights and resets the step", () => {
    const { data, squat } = sampleData();
    convertData(data, "lbs");
    expect(data.settings.unit).toBe("lbs");
    expect(data.settings.increment.step).toBe(5);
    expect(squat.schemes.fixed[0]?.weight).toBe(220);
  });

  it("formats without float noise", () => {
    expect(formatWeight(61.23499999)).toBe("61.23");
    expect(formatWeight(20)).toBe("20");
  });
});
