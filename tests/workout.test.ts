import { describe, expect, it } from "vitest";
import { addSet, createWorkout, cycleReps, finishWorkout, hasUnfinishedSets, isComplete, previousSet } from "../src/services/workout";
import { sampleData } from "./helpers";

describe("workout", () => {
  it("prefills sets from the exercise, not yet done", () => {
    const { data, plan } = sampleData();
    const workout = createWorkout(data, plan, plan.days[0]!);
    expect(workout.exercises.map((e) => e.name)).toEqual(["Squat", "Bench"]);
    expect(workout.exercises[0]?.sets[1]).toEqual({ targetReps: 5, reps: 5, weight: 100, done: false, planIndex: 1 });
    expect(hasUnfinishedSets(workout)).toBe(true);
  });

  it("shares exercise progress across days", () => {
    const { data, plan } = sampleData();
    const dayA = createWorkout(data, plan, plan.days[0]!);
    for (const set of dayA.exercises[0]!.sets) set.done = true;
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
    expect(perSet.exercises[0]?.sets).toEqual([{ targetReps: 10, reps: 10, weight: 50, done: false, planIndex: 0 }]);
    Object.assign(perSet.exercises[0]!.sets[0]!, { done: true, weight: 55 });
    finishWorkout(data, perSet);

    expect(squat.schemes.perSet[0]?.weight).toBe(57.5);
    expect(squat.schemes.fixed[0]?.weight).toBe(100);
    expect(previousSet(data, squat.id, "fixed", 0)).toBeUndefined();
    expect(previousSet(data, squat.id, "perSet", 0)?.weight).toBe(55);
  });

  it("logs only completed sets and drops exercises without any", () => {
    const { data, plan } = sampleData();
    const workout = createWorkout(data, plan, plan.days[0]!);
    const [squat] = workout.exercises;
    squat!.sets[0]!.done = true;
    squat!.sets[2]!.done = true;
    data.activeWorkout = workout;
    finishWorkout(data, workout);
    expect(data.activeWorkout).toBeNull();
    expect(data.history[0]).toBe(workout);
    expect(workout.exercises.map((e) => e.name)).toEqual(["Squat"]);
    expect(workout.exercises[0]?.sets.map((s) => s.planIndex)).toEqual([0, 2]);
  });

  it("keeps workout-only set changes out of the plan", () => {
    const { data, plan, squat } = sampleData();
    const workout = createWorkout(data, plan, plan.days[0]!);
    const logged = workout.exercises[0]!;
    logged.sets.reverse();
    logged.sets.splice(0, 1);
    addSet(logged);
    for (const set of logged.sets) Object.assign(set, { done: true, weight: 110 });
    finishWorkout(data, workout);
    expect(squat.schemes.fixed).toHaveLength(5);
    // Planned sets 0-3 were done at 110; planned set 4 was removed, so no increment.
    expect(squat.schemes.fixed.map((s) => s.weight)).toEqual([110, 110, 110, 110, 100]);
    expect(workout.exercises[0]?.sets.at(-1)?.planIndex).toBeNull();
  });

  it("finds the previous result for the same planned set", () => {
    const { data, plan, squat } = sampleData();
    const workout = createWorkout(data, plan, plan.days[0]!);
    Object.assign(workout.exercises[0]!.sets[1]!, { done: true, reps: 4 });
    finishWorkout(data, workout);
    expect(previousSet(data, squat.id, "fixed", 1)?.reps).toBe(4);
    expect(previousSet(data, squat.id, "fixed", 0)).toBeUndefined();
    expect(previousSet(data, squat.id, "fixed", null)).toBeUndefined();
  });

  it("cycles reps on each circle tap", () => {
    const set = { targetReps: 2, reps: 2, weight: 0, done: false, planIndex: 0 };
    const seen = Array.from({ length: 4 }, () => (cycleReps(set), set.done ? set.reps : "-"));
    expect(seen).toEqual([2, 1, 0, "-"]);
  });

  it("reports an exercise complete once every set is done", () => {
    const { data, plan } = sampleData();
    const logged = createWorkout(data, plan, plan.days[0]!).exercises[1]!;
    expect(isComplete(logged)).toBe(false);
    logged.sets[0]!.done = true;
    expect(isComplete(logged)).toBe(true);
  });
});
