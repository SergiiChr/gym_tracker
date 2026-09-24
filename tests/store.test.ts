import { describe, expect, it } from "vitest";
import { presetData } from "../src/model/presets";
import { Store, type KeyValueStorage } from "../src/services/Store";
import { schemeText } from "../src/ui/format";
import { moveItem } from "../src/ui/components/gestures";

class MemoryStorage implements KeyValueStorage {
  private readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

describe("Store", () => {
  it("starts with presets and persists changes", () => {
    const storage = new MemoryStorage();
    const store = new Store(storage);
    expect(store.data.plans.map((p) => p.name)).toEqual(["StrongLifts 5×5", "Dorian Yates Blood & Guts"]);
    store.data.settings.defaultReps = 8;
    store.save();
    expect(new Store(storage).data.settings.defaultReps).toBe(8);
  });

  it("removes a deleted exercise from every day", () => {
    const store = new Store(new MemoryStorage());
    const squat = store.data.exercises.find((e) => e.name === "Squat")!;
    store.deleteExercise(squat.id);
    const ids = store.data.plans.flatMap((p) => p.days.flatMap((d) => d.exerciseIds));
    expect(ids).not.toContain(squat.id);
  });

  it("moves the default to another plan when the default is deleted", () => {
    const store = new Store(new MemoryStorage());
    const [first, second] = store.data.plans;
    store.deletePlan(first!.id);
    expect(store.data.defaultPlanId).toBe(second!.id);
  });

  it("round-trips export and rejects foreign JSON", () => {
    const store = new Store(new MemoryStorage());
    const json = store.exportJson();
    store.reset();
    store.importJson(json);
    expect(store.exportJson()).toBe(json);
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
    expect(schemeText(squat, "kg")).toBe("5×5 · 20 kg");
    expect(schemeText(legPress, "kg")).toBe("2 sets · 16/12 · 0 kg");
  });
});
