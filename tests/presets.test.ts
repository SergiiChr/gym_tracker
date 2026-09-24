import { describe, expect, it } from "vitest";
import { addPresets, bothModes, emptyData, newExercise, presetData } from "../src/model/presets";

describe("presets", () => {
  it("builds My preset with four days and shared ab exercises", () => {
    const data = presetData();
    const plan = data.plans.find((p) => p.name === "My preset")!;
    expect(plan.days.map((d) => d.name)).toEqual(["Chest", "Legs", "Shoulders", "Back"]);
    expect(plan.mode).toBe("perSet");
    const [chest, , shoulders] = plan.days;
    const sitUp = data.exercises.filter((e) => e.name === "Sit Up");
    expect(sitUp).toHaveLength(1);
    expect(chest?.exerciseIds).toContain(sitUp[0]?.id);
    expect(shoulders?.exerciseIds).toContain(sitUp[0]?.id);
    expect(sitUp[0]?.bodyweight).toBe(true);
  });

  it("keeps the logged weights with 12/10/8 targets counted from the last set", () => {
    const data = presetData();
    const sets = (name: string): number[][] =>
      data.exercises.find((e) => e.name === name)!.schemes.perSet.map((s) => [s.reps, s.weight]);
    expect(sets("Incline Dumbbell Press")).toEqual([
      [12, 15],
      [12, 22.5],
      [10, 27.5],
      [8, 30],
    ]);
    expect(sets("Lateral Raise")).toEqual([
      [12, 5],
      [10, 7.5],
      [8, 10],
    ]);
    expect(sets("Barbell Curl")).toEqual([
      [10, 25],
      [8, 35],
    ]);
    expect(sets("Back Extension")).toEqual([[8, 15]]);
    expect(sets("Ab Crunch Machine")).toEqual([[20, 47.5]]);
    const press = data.exercises.find((e) => e.name === "Incline Dumbbell Press")!;
    expect(press.incrementLastSetOnly).toBe(true);
    expect(press.increment?.targetReps).toBe(10);
  });

  it("keeps My preset weights where other presets use the same exercise", () => {
    const data = presetData();
    const legExtension = data.exercises.filter((e) => e.name === "Leg Extension");
    expect(legExtension).toHaveLength(1);
    expect(legExtension[0]?.schemes.perSet.at(-1)?.weight).toBe(85);
    expect(data.defaultPlanId).toBe(data.plans.find((p) => p.name === "5×5 A/B")?.id);
  });

  it("fills in exercises that were never set up and keeps the ones that were", () => {
    const data = emptyData();
    const blank = { ...newExercise(data.settings), name: "Leg Extension" };
    const used = { ...newExercise(data.settings), name: "Hack Squat", schemes: bothModes([{ reps: 8, weight: 100 }]) };
    data.exercises.push(blank, used);
    addPresets(data);
    expect(blank.schemes.perSet.at(-1)?.weight).toBe(85);
    expect(used.schemes.perSet).toEqual([{ reps: 8, weight: 100 }]);
  });
});
