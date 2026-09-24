import { describe, expect, it } from "vitest";
import { createWorkout, cycleReps, finishWorkout, previousSet } from "../src/services/workout";
import { sampleData } from "./helpers";

describe("workout", () => {
  it("prefills sets from the exercise", () => {
    const { data, plan } = sampleData();
    const workout = createWorkout(data, plan, plan.days[0]!);
    expect(workout.exercises.map((e) => e.name)).toEqual(["Squat", "Bench"]);
    expect(workout.exercises[0]?.sets[0]).toEqual({ targetReps: 5, reps: null, weight: 100 });
  });

  it("shares exercise progress across days", () => {
    const { data, plan } = sampleData();
    const dayA = createWorkout(data, plan, plan.days[0]!);
    for (const set of dayA.exercises[0]!.sets) set.reps = 5;
    finishWorkout(data, dayA);
    const dayB = createWorkout(data, plan, plan.days[1]!);
    expect(dayB.exercises[0]?.sets[0]?.weight).toBe(102.5);
  });

  it("keeps logging styles separate", () => {
    const { data, plan, squat } = sampleData();
    const perSetPlan = { ...plan, id: "perSet", mode: "perSet" as const };
    data.plans.push(perSetPlan);
    squat.schemes.perSet = [{ reps: 10, weight: 50 }];

    const perSet = createWorkout(data, perSetPlan, perSetPlan.days[1]!);
    expect(perSet.exercises[0]?.sets).toEqual([{ targetReps: 10, reps: null, weight: 50 }]);
    perSet.exercises[0]!.sets[0]!.reps = 10;
    perSet.exercises[0]!.sets[0]!.weight = 55;
    finishWorkout(data, perSet);

    expect(squat.schemes.perSet[0]?.weight).toBe(57.5);
    expect(squat.schemes.fixed[0]?.weight).toBe(100);
    expect(previousSet(data, squat.id, "fixed", 0)).toBeUndefined();
    expect(previousSet(data, squat.id, "perSet", 0)?.weight).toBe(55);
  });

  it("moves the finished workout to history", () => {
    const { data, plan } = sampleData();
    const workout = createWorkout(data, plan, plan.days[0]!);
    data.activeWorkout = workout;
    finishWorkout(data, workout);
    expect(data.activeWorkout).toBeNull();
    expect(data.history[0]).toBe(workout);
    expect(workout.finishedAt).not.toBeNull();
  });

  it("finds the previous set from the latest workout", () => {
    const { data, plan, squat } = sampleData();
    const workout = createWorkout(data, plan, plan.days[0]!);
    workout.exercises[0]!.sets[1]!.reps = 4;
    finishWorkout(data, workout);
    expect(previousSet(data, squat.id, "fixed", 1)?.reps).toBe(4);
    expect(previousSet(data, "missing", "fixed", 0)).toBeUndefined();
  });

  it("cycles reps like StrongLifts", () => {
    const set = { targetReps: 2, reps: null as number | null, weight: 0 };
    const seen = Array.from({ length: 4 }, () => (cycleReps(set), set.reps));
    expect(seen).toEqual([2, 1, 0, null]);
  });
});
