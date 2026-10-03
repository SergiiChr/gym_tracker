import { describe, expect, it } from "vitest";
import { addPresets, presetData } from "../src/model/presets";
import { MINIMAL_BACKUP } from "../src/model/backupExample";
import { MemoryStorage, Store } from "../src/services/Store";
import { exerciseSummary } from "../src/ui/format";
import { moveItem } from "../src/ui/components/gestures";

describe("Store", () => {
  it("starts with presets and persists changes", () => {
    const storage = new MemoryStorage();
    const store = new Store(storage);
    expect(store.data.plans.map((p) => p.name)).toEqual(["My preset", "5×5 A/B", "HIT 4-day split", "Full body A/B/C"]);
    store.data.settings.defaultReps = 8;
    store.save();
    expect(new Store(storage).data.settings.defaultReps).toBe(8);
  });

  it("removes a deleted exercise from every day", () => {
    const store = new Store(new MemoryStorage());
    const squat = store.data.exercises.find((e) => e.name === "Squat")!;
    store.deleteExercise(squat.id);
    const ids = store.data.plans.flatMap((p) => p.days.flatMap((d) => d.slots.flat()));
    expect(ids).not.toContain(squat.id);
  });

  it("removes a deleted exercise from its group and drops emptied slots", () => {
    const store = new Store(new MemoryStorage());
    const day = store.data.plans.find((p) => p.name === "Full body A/B/C")!.days[2]!;
    const [hackSquat, legPress] = day.slots[0]!;
    store.deleteExercise(hackSquat!);
    expect(day.slots[0]).toEqual([legPress]);
    store.deleteExercise(legPress!);
    expect(day.slots).toHaveLength(8);
  });

  it("moves the default to another plan when the default is deleted", () => {
    const store = new Store(new MemoryStorage());
    const [first, second] = store.data.plans;
    store.deletePlan(first!.id);
    expect(store.data.defaultPlanId).toBe(second!.id);
  });

  it("reuses existing exercises when presets are added again", () => {
    const store = new Store(new MemoryStorage());
    const count = store.data.exercises.length;
    addPresets(store.data);
    expect(store.data.exercises.length).toBe(count);
    expect(store.data.plans.length).toBe(4);
    const squatIds = new Set(store.data.exercises.filter((e) => e.name === "Squat").map((e) => e.id));
    expect(squatIds.size).toBe(1);
    expect(store.data.plans[1]?.days[0]?.slots).toContainEqual([[...squatIds][0]]);
  });

  it("upgrades version 1 data to per-mode schemes", () => {
    const storage = new MemoryStorage();
    const v1 = presetData() as unknown as { version: number; exercises: Record<string, unknown>[] };
    v1.version = 1;
    for (const e of v1.exercises) {
      e.sets = (e.schemes as { fixed: unknown }).fixed;
      delete e.schemes;
    }
    storage.setItem("gym-tracker", JSON.stringify(v1));
    const store = new Store(storage);
    const squat = store.data.exercises.find((e) => e.name === "Squat")!;
    expect(store.data.version).toBe(5);
    expect(squat.schemes.fixed).toEqual(squat.schemes.perSet);
    expect(squat.schemes.fixed).not.toBe(squat.schemes.perSet);
    expect("sets" in squat).toBe(false);
  });

  it("imports the minimal example with defaults filled in", () => {
    const store = new Store(new MemoryStorage());
    store.importJson(MINIMAL_BACKUP);
    const [squat] = store.data.exercises;
    expect(squat?.schemes.perSet).toEqual([{ reps: 5, weight: 60 }]);
    expect(squat?.schemes.perSet).not.toBe(squat?.schemes.fixed);
    expect(squat?.restSec).toBe(180);
    expect(store.data.defaultPlanId).toBe("plan1");
    expect(store.data.settings.unit).toBe("kg");
    expect(store.data.history).toEqual([]);
  });

  it("upgrades version 2 history to done flags", () => {
    const storage = new MemoryStorage();
    const v2 = presetData() as unknown as { version: number; history: unknown[] };
    v2.version = 2;
    const sets = [
      { targetReps: 5, reps: 5, weight: 60 },
      { targetReps: 5, reps: null, weight: 60 },
    ];
    v2.history = [{ id: "w", planId: "p", planName: "P", mode: "fixed", dayId: "d", dayName: "D", startedAt: 0, finishedAt: 1, exercises: [{ exerciseId: "e", name: "E", bodyweight: false, sets }] }];
    storage.setItem("gym-tracker", JSON.stringify(v2));
    const [log] = new Store(storage).data.history;
    expect(log?.exercises[0]?.sets).toEqual([
      { targetReps: 5, reps: 5, weight: 60, done: true, planIndex: 0 },
      { targetReps: 5, reps: 5, weight: 60, done: false, planIndex: 1 },
    ]);
  });

  it("upgrades version 3 day exercise lists to slots", () => {
    const storage = new MemoryStorage();
    const v3 = { version: 3, exercises: [], plans: [{ id: "p", name: "P", mode: "fixed", days: [{ id: "d", name: "D", exerciseIds: ["a", "b"] }] }] };
    storage.setItem("gym-tracker", JSON.stringify(v3));
    const day = new Store(storage).data.plans[0]?.days[0];
    expect(day).toEqual({ id: "d", name: "D", slots: [["a"], ["b"]] });
  });

  it("upgrades version 4 Full body exercises without rep ranges", () => {
    const storage = new MemoryStorage();
    const v4 = presetData();
    v4.version = 4;
    const ids = new Set(v4.plans.find((p) => p.name === "Full body A/B/C")!.days.flatMap((d) => d.slots.flat()));
    const used = v4.exercises.filter((e) => ids.has(e.id));
    const hackSquat = used.find((e) => e.name === "Hack Squat")!;
    hackSquat.schemes.fixed = [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }];
    const lateralRaise = used.find((e) => e.name === "Lateral Raise")!;
    lateralRaise.schemes.fixed = [{ reps: 15, maxReps: 25, weight: 8 }];
    storage.setItem("gym-tracker", JSON.stringify(v4));
    const exercises = new Store(storage).data.exercises;
    expect(exercises.find((e) => e.name === "Hack Squat")?.schemes.fixed).toEqual([{ reps: 6, maxReps: 10, weight: 80 }, { reps: 6, maxReps: 10, weight: 80 }]);
    expect(exercises.find((e) => e.name === "Lateral Raise")?.schemes.fixed).toEqual([{ reps: 15, maxReps: 25, weight: 8 }]);
  });

  it("round-trips export and rejects foreign JSON", () => {
    const store = new Store(new MemoryStorage());
    const json = store.exportJson();
    store.reset();
    store.importJson(json);
    expect(JSON.parse(store.exportJson())).toEqual(JSON.parse(json));
    expect(() => store.importJson('{"foo": 1}')).toThrow();
  });
});

describe("helpers", () => {
  it("moves list items", () => {
    const items = ["a", "b", "c"];
    moveItem(items, 0, 2);
    expect(items).toEqual(["b", "c", "a"]);
  });

  it("describes set schemes", () => {
    const data = presetData();
    const squat = data.exercises.find((e) => e.name === "Squat")!;
    const legPress = data.exercises.find((e) => e.name === "Leg Press")!;
    expect(exerciseSummary(squat, "kg")).toBe("5×5 · 20 kg");
    expect(exerciseSummary(legPress, "kg")).toBe("3×10–15 · 0 kg | 2 sets · 16/12 · 0 kg");
    squat.schemes.perSet = [{ reps: 10, weight: 40 }];
    expect(exerciseSummary(squat, "kg")).toBe("5×5 · 20 kg | 1×10 · 40 kg");
  });
});
