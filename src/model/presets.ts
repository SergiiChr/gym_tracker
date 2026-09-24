import { MY_PRESET } from "./myPreset";
import { convertWeight, DEFAULT_STEP } from "./units";
import type { AppData, Exercise, Plan, PlanDay, PlanMode, SetSpec, Settings, Unit } from "./types";

export const DATA_VERSION = 2;

export function newId(): string {
  return crypto.randomUUID();
}

export function defaultSettings(): Settings {
  return {
    unit: "kg",
    defaultSets: 5,
    defaultReps: 5,
    defaultRestSec: 180,
    increment: { enabled: true, step: DEFAULT_STEP.kg, targetReps: 5 },
  };
}

/** The same starting sets for every logging style; they diverge once workouts are logged. */
export function bothModes(sets: SetSpec[]): Record<PlanMode, SetSpec[]> {
  return { fixed: sets, perSet: structuredClone(sets) };
}

/** Blank exercise built from the defaults in settings. */
export function newExercise(settings: Settings): Exercise {
  return {
    id: newId(),
    name: "New exercise",
    bodyweight: false,
    schemes: bothModes(Array.from({ length: settings.defaultSets }, () => ({ reps: settings.defaultReps, weight: 0 }))),
    restSec: settings.defaultRestSec,
    increment: null,
    incrementLastSetOnly: false,
  };
}

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    settings: defaultSettings(),
    exercises: [],
    plans: [],
    defaultPlanId: null,
    history: [],
    activeWorkout: null,
  };
}

interface ExerciseSeed {
  name: string;
  /** Reps and starting weight in kg. */
  sets: readonly (readonly [reps: number, kg: number])[];
  restSec?: number;
  bodyweight?: boolean;
  /** Increment in plate steps of the current unit (2 → 5 kg or 10 lbs). */
  steps?: number;
  targetReps?: number;
  lastSetOnly?: boolean;
}

/** Builds preset exercises and plans in the given unit. */
class PresetBuilder {
  constructor(private readonly unit: Unit) {}

  exercise(seed: ExerciseSeed): Exercise {
    const custom = seed.steps !== undefined || seed.targetReps !== undefined;
    return {
      id: newId(),
      name: seed.name,
      bodyweight: seed.bodyweight ?? false,
      schemes: bothModes(seed.sets.map(([reps, kg]) => ({ reps, weight: convertWeight(kg, "kg", this.unit) }))),
      restSec: seed.restSec ?? 180,
      increment: custom
        ? { enabled: true, step: DEFAULT_STEP[this.unit] * (seed.steps ?? 1), targetReps: seed.targetReps ?? 5 }
        : null,
      incrementLastSetOnly: seed.lastSetOnly ?? false,
    };
  }

  /** High-intensity style: warm-up set, then one all-out working set; only the top set progresses. */
  topSet(name: string, reps: number): Exercise {
    return this.exercise({
      name,
      sets: [
        [reps + 4, 0],
        [reps, 0],
      ],
      restSec: 120,
      targetReps: reps + 2,
      lastSetOnly: true,
    });
  }

  /** The owner's own 4-day split; weights go up on the last (heaviest) set. */
  myPreset(): Program {
    const exercises = new Map<string, Exercise>();
    const get = (name: keyof typeof MY_PRESET.exercises): Exercise => {
      const existing = exercises.get(name);
      if (existing) return existing;
      const sets = MY_PRESET.exercises[name];
      const bodyweight = (MY_PRESET.bodyweight as readonly string[]).includes(name);
      const exercise = this.exercise({
        name,
        sets,
        restSec: 120,
        bodyweight,
        targetReps: bodyweight ? undefined : (sets.at(-1)?.[0] ?? 8) + 2,
        lastSetOnly: true,
      });
      exercises.set(name, exercise);
      return exercise;
    };
    const days = MY_PRESET.days.map((d) => day(d.name, d.exercises.map(get)));
    return { exercises: [...exercises.values()], plan: { id: newId(), name: MY_PRESET.name, mode: "perSet", days } };
  }

  fiveByFive(): Program {
    const fiveByFive = (kg: number): [number, number][] => Array.from({ length: 5 }, () => [5, kg]);
    const squat = this.exercise({ name: "Squat", sets: fiveByFive(20) });
    const bench = this.exercise({ name: "Bench Press", sets: fiveByFive(20) });
    const row = this.exercise({ name: "Barbell Row", sets: fiveByFive(30) });
    const ohp = this.exercise({ name: "Overhead Press", sets: fiveByFive(20) });
    const deadlift = this.exercise({ name: "Deadlift", sets: [[5, 40]], steps: 2 });
    return {
      exercises: [squat, bench, row, ohp, deadlift],
      plan: {
        id: newId(),
        name: "5×5 A/B",
        mode: "fixed",
        days: [day("Workout A", [squat, bench, row]), day("Workout B", [squat, ohp, deadlift])],
      },
    };
  }

  hitSplit(): Program {
    const y = (name: string, reps: number): Exercise => this.topSet(name, reps);
    const chest = [y("Incline Barbell Press", 8), y("Flat Dumbbell Press", 8), y("Incline Dumbbell Fly", 8)];
    const biceps = [y("Incline Dumbbell Curl", 8), y("EZ-Bar Preacher Curl", 8)];
    const back = [y("Pull-down", 8), y("Dumbbell Pullover", 8), y("One-arm Dumbbell Row", 8), y("Underhand Barbell Row", 8), y("Rack Deadlift", 6)];
    const shoulders = [y("Seated Dumbbell Press", 8), y("Side Lateral Raise", 10), y("Rear Delt Raise", 10)];
    const triceps = [y("Triceps Pushdown", 8), y("Lying Triceps Extension", 8)];
    const legs = [
      y("Leg Extension", 12),
      y("Leg Press", 12),
      y("Hack Squat", 10),
      y("Lying Leg Curl", 8),
      y("Stiff-leg Deadlift", 8),
      y("Standing Calf Raise", 10),
    ];
    return {
      exercises: [...chest, ...biceps, ...back, ...shoulders, ...triceps, ...legs],
      plan: {
        id: newId(),
        name: "HIT 4-day split",
        mode: "perSet",
        days: [
          day("Chest & Biceps", [...chest, ...biceps]),
          day("Legs", legs),
          day("Shoulders & Triceps", [...shoulders, ...triceps]),
          day("Back", back),
        ],
      },
    };
  }
}

interface Program {
  exercises: Exercise[];
  plan: Plan;
}

function day(name: string, exercises: Exercise[]): PlanDay {
  return { id: newId(), name, exerciseIds: exercises.map((e) => e.id) };
}

/**
 * Adds preset plans on top of existing data, so nothing is lost; plans that already exist by name are skipped.
 * Exercises that already exist with the same name are reused, so their progress carries over.
 * A reused exercise still at 0 weight takes the preset's sets, since it was never set up.
 * Programs earlier in the list win those name clashes, so My preset's real weights beat blank templates.
 */
export function addPresets(data: AppData): void {
  const builder = new PresetBuilder(data.settings.unit);
  const fiveByFive = builder.fiveByFive();
  const programs = [builder.myPreset(), fiveByFive, builder.hitSplit()];
  const planNames = new Set(data.plans.map((p) => p.name));
  const byName = new Map(data.exercises.map((e) => [e.name.toLowerCase(), e]));
  for (const program of programs.filter((p) => !planNames.has(p.plan.name))) {
    const { mode } = program.plan;
    const resolved = new Map<string, string>();
    for (const exercise of program.exercises) {
      const key = exercise.name.toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        resolved.set(exercise.id, existing.id);
        if (existing.schemes[mode].every((s) => s.weight === 0)) existing.schemes[mode] = exercise.schemes[mode];
      } else {
        byName.set(key, exercise);
        data.exercises.push(exercise);
      }
    }
    for (const day of program.plan.days) day.exerciseIds = day.exerciseIds.map((id) => resolved.get(id) ?? id);
    data.plans.push(program.plan);
  }
  data.defaultPlanId ??= (data.plans.find((p) => p.id === fiveByFive.plan.id) ?? data.plans[0])?.id ?? null;
}

export function presetData(): AppData {
  const data = emptyData();
  addPresets(data);
  return data;
}
