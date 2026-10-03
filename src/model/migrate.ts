import { bothModes, DATA_VERSION, emptyData, fullBodyPreset, newId } from "./presets";
import type { AppData, Exercise, LoggedSet, Plan, PlanDay, SetSpec } from "./types";

type ExerciseV1 = Omit<Exercise, "schemes"> & { schemes?: Exercise["schemes"]; sets?: SetSpec[] };
type PlanDayV3 = Omit<PlanDay, "slots"> & { slots?: string[][]; exerciseIds?: string[] };

/** Upgrades data saved by an older app version, in place. Throws on data from a newer version. */
export function migrate(data: AppData): AppData {
  if (data.version > DATA_VERSION) throw new Error(`Data version ${data.version} is newer than this app`);
  if (data.version === 1) {
    // v2: sets moved into one scheme per logging style.
    for (const exercise of data.exercises as ExerciseV1[]) {
      exercise.schemes = bothModes(exercise.sets ?? []);
      delete exercise.sets;
    }
    data.version = 2;
  }
  if (data.version === 2) {
    // v3: sets carry an explicit done flag and their planned position instead of null reps.
    // Hand-written backups may leave these out; withDefaults fills them in afterwards.
    const logs = [...(data.history ?? []), ...(data.activeWorkout ? [data.activeWorkout] : [])];
    for (const log of logs) {
      for (const exercise of log.exercises) {
        exercise.sets = (exercise.sets as (Omit<LoggedSet, "reps"> & { reps: number | null })[]).map((set, i) => ({
          targetReps: set.targetReps,
          reps: set.reps ?? set.targetReps,
          weight: set.weight,
          done: set.reps !== null,
          planIndex: i,
        }));
      }
    }
    data.version = 3;
  }
  if (data.version === 3) {
    // v4: days hold slots, so several exercises can share one as an exercise group.
    for (const day of data.plans.flatMap((p) => p.days) as PlanDayV3[]) {
      day.slots = (day.exerciseIds ?? []).map((id) => [id]);
      delete day.exerciseIds;
    }
    data.version = 4;
  }
  if (data.version === 4) {
    // v5: Full body exercises that kept older plain sets get the preset's rep ranges.
    // That happens when they were already used in another Same weight plan when the preset was added.
    const preset = fullBodyPreset();
    const ranges = new Map(preset.exercises.map((e) => [e.name.toLowerCase(), e.schemes.fixed[0]]));
    const plans = data.plans.filter((p) => p.name === preset.plan.name);
    const ids = new Set(plans.flatMap((p) => p.days.flatMap((d) => d.slots.flat())));
    for (const exercise of data.exercises.filter((e) => ids.has(e.id))) {
      const range = ranges.get(exercise.name.toLowerCase());
      const sets = exercise.schemes?.fixed ?? [];
      if (range?.maxReps === undefined || sets.some((s) => s.maxReps !== undefined)) continue;
      for (const set of sets) {
        set.reps = range.reps;
        set.maxReps = range.maxReps;
      }
    }
    data.version = 5;
  }
  return data;
}

/**
 * Fills in fields a hand-written backup may leave out.
 * An exercise with a scheme for only one logging style gets a copy of it for the other.
 */
export function withDefaults(data: Partial<AppData>): AppData {
  const base = emptyData();
  const settings = { ...base.settings, ...data.settings, increment: { ...base.settings.increment, ...data.settings?.increment } };
  const exercises = (data.exercises ?? []).map((e: Partial<Exercise>): Exercise => {
    const fixed = e.schemes?.fixed ?? e.schemes?.perSet ?? [];
    return {
      id: e.id ?? newId(),
      name: e.name ?? "Exercise",
      bodyweight: e.bodyweight ?? false,
      restSec: e.restSec ?? settings.defaultRestSec,
      increment: e.increment ?? null,
      incrementLastSetOnly: e.incrementLastSetOnly ?? false,
      schemes: { fixed, perSet: e.schemes?.perSet ?? structuredClone(fixed) },
    };
  });
  const plans = (data.plans ?? []).map((p: Partial<Plan>): Plan => ({
    id: p.id ?? newId(),
    name: p.name ?? "Plan",
    mode: p.mode ?? "fixed",
    days: p.days ?? [],
  }));
  return {
    ...base,
    ...data,
    settings,
    exercises,
    plans,
    defaultPlanId: data.defaultPlanId ?? plans[0]?.id ?? null,
  };
}
