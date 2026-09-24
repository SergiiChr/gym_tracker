import { convertWeight, DEFAULT_STEP } from "./units";
import type { AppData, Exercise, Plan, PlanDay, Settings, Unit } from "./types";

export const DATA_VERSION = 1;

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

/** Blank exercise built from the defaults in settings. */
export function newExercise(settings: Settings): Exercise {
  return {
    id: newId(),
    name: "New exercise",
    bodyweight: false,
    sets: Array.from({ length: settings.defaultSets }, () => ({ reps: settings.defaultReps, weight: 0 })),
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
  sets: [reps: number, kg: number][];
  restSec?: number;
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
      bodyweight: false,
      sets: seed.sets.map(([reps, kg]) => ({ reps, weight: convertWeight(kg, "kg", this.unit) })),
      restSec: seed.restSec ?? 180,
      increment: custom
        ? { enabled: true, step: DEFAULT_STEP[this.unit] * (seed.steps ?? 1), targetReps: seed.targetReps ?? 5 }
        : null,
      incrementLastSetOnly: seed.lastSetOnly ?? false,
    };
  }

  /** Blood & Guts style: warm-up set, then one all-out working set; only the top set progresses. */
  yates(name: string, reps: number): Exercise {
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

  stronglifts(): { exercises: Exercise[]; plan: Plan } {
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
        name: "StrongLifts 5×5",
        mode: "fixed",
        days: [day("Workout A", [squat, bench, row]), day("Workout B", [squat, ohp, deadlift])],
      },
    };
  }

  dorianYates(): { exercises: Exercise[]; plan: Plan } {
    const y = (name: string, reps: number): Exercise => this.yates(name, reps);
    const chest = [y("Incline Barbell Press", 8), y("Flat Dumbbell Press", 8), y("Incline Dumbbell Fly", 8)];
    const biceps = [y("Incline Dumbbell Curl", 8), y("EZ-Bar Preacher Curl", 8)];
    const back = [y("Pull-down", 8), y("Dumbbell Pullover", 8), y("One-arm Dumbbell Row", 8), y("Yates Row", 8), y("Rack Deadlift", 6)];
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
        name: "Dorian Yates Blood & Guts",
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

function day(name: string, exercises: Exercise[]): PlanDay {
  return { id: newId(), name, exerciseIds: exercises.map((e) => e.id) };
}

/**
 * Adds preset plans on top of existing data, so nothing is lost.
 * Exercises that already exist with the same name are reused, so their progress carries over.
 */
export function addPresets(data: AppData): void {
  const builder = new PresetBuilder(data.settings.unit);
  const programs = [builder.stronglifts(), builder.dorianYates()];
  const byName = new Map(data.exercises.map((e) => [e.name.toLowerCase(), e]));
  for (const program of programs) {
    const resolved = new Map<string, string>();
    for (const exercise of program.exercises) {
      const key = exercise.name.toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        resolved.set(exercise.id, existing.id);
      } else {
        byName.set(key, exercise);
        data.exercises.push(exercise);
      }
    }
    for (const day of program.plan.days) day.exerciseIds = day.exerciseIds.map((id) => resolved.get(id) ?? id);
    data.plans.push(program.plan);
  }
  data.defaultPlanId ??= programs[0]?.plan.id ?? null;
}

export function presetData(): AppData {
  const data = emptyData();
  addPresets(data);
  return data;
}
