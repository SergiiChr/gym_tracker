import { describe, expect, it } from "vitest";
import type { LoggedExercise } from "../src/model/types";
import { applyResult, nextDay } from "../src/services/progression";
import { createWorkout, finishWorkout } from "../src/services/workout";
import { sampleData } from "./helpers";

const logged = (reps: (number | null)[], weight = 100): LoggedExercise => ({
  exerciseId: "x",
  name: "x",
  bodyweight: false,
  sets: reps.map((r, i) => ({ targetReps: 5, reps: r ?? 5, weight, done: r !== null, planIndex: i })),
});

describe("nextDay", () => {
  it("starts with the first day and rotates after each workout", () => {
    const { data, plan } = sampleData();
    expect(nextDay(plan, data)?.id).toBe("a");
    finishWorkout(data, createWorkout(data, plan, plan.days[0]!));
    expect(nextDay(plan, data)?.id).toBe("b");
    finishWorkout(data, createWorkout(data, plan, plan.days[1]!));
    expect(nextDay(plan, data)?.id).toBe("a");
  });
});

describe("applyResult", () => {
  it("increments all sets when every set hits the target", () => {
    const { data, squat } = sampleData();
    applyResult(logged([5, 5, 5, 5, 5]), squat, "fixed", data.settings);
    expect(squat.schemes.fixed.map((s) => s.weight)).toEqual([102.5, 102.5, 102.5, 102.5, 102.5]);
  });

  it("keeps the weight when a set is missed", () => {
    const { data, squat } = sampleData();
    applyResult(logged([5, 5, 5, 4, null]), squat, "fixed", data.settings);
    expect(squat.schemes.fixed.every((s) => s.weight === 100)).toBe(true);
  });

  it("saves the weight used in the workout", () => {
    const { data, squat } = sampleData();
    applyResult(logged([3, 3, 3, 3, 3], 110), squat, "fixed", data.settings);
    expect(squat.schemes.fixed[0]?.weight).toBe(110);
  });

  it("checks and increments only the last set when asked", () => {
    const { data, squat } = sampleData();
    squat.incrementLastSetOnly = true;
    applyResult(logged([1, 1, 1, 1, 5]), squat, "fixed", data.settings);
    expect(squat.schemes.fixed.map((s) => s.weight)).toEqual([100, 100, 100, 100, 102.5]);
  });

  it("uses the exercise override over global settings", () => {
    const { data, squat } = sampleData();
    squat.increment = { enabled: true, step: 5, targetReps: 3 };
    applyResult(logged([3, 3, 3, 3, 3]), squat, "fixed", data.settings);
    expect(squat.schemes.fixed[0]?.weight).toBe(105);
    squat.increment.enabled = false;
    applyResult(logged([5, 5, 5, 5, 5], 105), squat, "fixed", data.settings);
    expect(squat.schemes.fixed[0]?.weight).toBe(105);
  });

  it("never increments bodyweight exercises", () => {
    const { data, squat } = sampleData();
    squat.bodyweight = true;
    applyResult(logged([5, 5, 5, 5, 5]), squat, "fixed", data.settings);
    expect(squat.schemes.fixed[0]?.weight).toBe(100);
  });
});
