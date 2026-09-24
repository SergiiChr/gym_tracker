import { DATA_VERSION, presetData } from "../model/presets";
import type { AppData, Exercise, Plan } from "../model/types";

const STORAGE_KEY = "gym-tracker";

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Keeps data for the current page load only. */
export class MemoryStorage implements KeyValueStorage {
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

/** localStorage, or an in-memory stand-in when the browser blocks it (private mode, sandboxed previews). */
export function browserStorage(): KeyValueStorage {
  try {
    localStorage.setItem(`${STORAGE_KEY}-probe`, "1");
    localStorage.removeItem(`${STORAGE_KEY}-probe`);
    return localStorage;
  } catch {
    console.warn("localStorage is unavailable, data will not persist");
    return new MemoryStorage();
  }
}

/** Owns the app data and persists it as a single JSON blob. Callers mutate `data` and then call `save()`. */
export class Store {
  data: AppData;

  constructor(private readonly storage: KeyValueStorage) {
    this.data = this.load();
  }

  save(): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  exercise(id: string): Exercise | undefined {
    return this.data.exercises.find((e) => e.id === id);
  }

  plan(id: string | null): Plan | undefined {
    return this.data.plans.find((p) => p.id === id);
  }

  defaultPlan(): Plan | undefined {
    return this.plan(this.data.defaultPlanId) ?? this.data.plans[0];
  }

  /** Removes the exercise and its references from every plan day. History keeps its own copy. */
  deleteExercise(id: string): void {
    this.data.exercises = this.data.exercises.filter((e) => e.id !== id);
    for (const plan of this.data.plans) {
      for (const day of plan.days) day.exerciseIds = day.exerciseIds.filter((e) => e !== id);
    }
    this.save();
  }

  deletePlan(id: string): void {
    this.data.plans = this.data.plans.filter((p) => p.id !== id);
    if (this.data.defaultPlanId === id) this.data.defaultPlanId = this.data.plans[0]?.id ?? null;
    this.save();
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /** Throws on invalid input so the caller can report it; current data stays untouched. */
  importJson(json: string): void {
    const parsed = JSON.parse(json) as AppData;
    if (parsed.version !== DATA_VERSION || !Array.isArray(parsed.exercises) || !Array.isArray(parsed.plans)) {
      throw new Error("Not a gym tracker backup");
    }
    this.data = parsed;
    this.save();
  }

  reset(): void {
    this.data = presetData();
    this.save();
  }

  private load(): AppData {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return presetData();
    try {
      return JSON.parse(raw) as AppData;
    } catch {
      // Not saved back right away, so the broken blob can still be recovered until the next change.
      console.error("Stored data is corrupted, starting from presets");
      return presetData();
    }
  }
}
