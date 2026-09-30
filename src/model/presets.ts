import { MY_PRESET } from "./myPreset";
import { convertWeight, DEFAULT_STEP } from "./units";
import type { AppData, Exercise, Plan, PlanDay, PlanMode, SetSpec, Settings, Unit } from "./types";

export const DATA_VERSION = 4;

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
export function newExercise(settings: Settings, name = "New exercise"): Exercise {
  return {
    id: newId(),
    name,
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

  /** Double progression at one weight: `sets` × min–max reps, starting at 0 weight. */
  range(name: string, sets: number, [min, max]: [number, number]): Exercise {
    const exercise = this.exercise({ name, sets: Array.from({ length: sets }, () => [min, 0] as const), restSec: 120 });
    for (const set of Object.values(exercise.schemes).flat()) set.maxReps = max;
    return exercise;
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
    const { pyramid, absReps } = MY_PRESET;
    const abs: readonly string[] = MY_PRESET.abs;
    const bodyweight: readonly string[] = MY_PRESET.bodyweight;
    // The pyramid lines up with the last sets, so 2 sets are 10/8 and extra leading sets repeat 12.
    const repsFor = (index: number, count: number): number => pyramid[Math.max(0, pyramid.length - count + index)]!;
    const exercises = new Map<string, Exercise>();
    const get = (name: keyof typeof MY_PRESET.exercises): Exercise => {
      const existing = exercises.get(name);
      if (existing) return existing;
      const weights = MY_PRESET.exercises[name];
      const sets = weights.map((kg, i): [number, number] => [abs.includes(name) ? absReps : repsFor(i, weights.length), kg]);
      const isBodyweight = bodyweight.includes(name);
      const exercise = this.exercise({
        name,
        sets,
        restSec: 120,
        bodyweight: isBodyweight,
        targetReps: isBodyweight ? undefined : (sets.at(-1)?.[0] ?? 8) + 2,
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
    const back = [y("Lat Pulldown", 8), y("Dumbbell Pullover", 8), y("One-arm Dumbbell Row", 8), y("Underhand Barbell Row", 8), y("Rack Deadlift", 6)];
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

  /** Three full body days in the Same weight style with double progression; "or" choices are exercise groups. */
  fullBody(): Program {
    const r = (name: string, sets: number, min: number, max: number): Exercise => this.range(name, sets, [min, max]);
    const hold = (name: string, reps: number): Exercise => this.exercise({ name, sets: [[reps, 0], [reps, 0]], restSec: 60, bodyweight: true });
    const hackSquat = r("Hack Squat", 3, 6, 10);
    const lateralRaise = r("Lateral Raise", 3, 12, 20);
    const reverseFly = r("Reverse Fly", 2, 12, 20);
    const weightedPullUp = r("Weighted Pull-up", 3, 6, 10);
    const days: [string, (Exercise | Exercise[])[]][] = [
      [
        "Day A",
        [
          hackSquat,
          r("Incline Dumbbell Press", 3, 6, 10),
          weightedPullUp,
          r("Chest-supported T-Bar Row", 3, 8, 12),
          r("Leg Curl", 2, 10, 15),
          lateralRaise,
          r("Pallof Press", 2, 10, 15),
        ],
      ],
      [
        "Day B",
        [
          r("Dumbbell Split Squat", 3, 8, 12),
          r("Dumbbell Shoulder Press", 3, 6, 10),
          r("Seated Cable Row", 3, 8, 12),
          r("Hip Thrust Machine", 3, 8, 12),
          r("Pec Fly", 2, 10, 15),
          reverseFly,
          r("Seated Calf Raise", 3, 8, 15),
          hold("Side Plank", 30),
        ],
      ],
      [
        "Day C",
        [
          [hackSquat, r("Leg Press", 3, 10, 15)],
          r("Flat Dumbbell Press", 3, 8, 12),
          [weightedPullUp, r("Lat Pulldown", 3, 8, 12)],
          r("Romanian Deadlift", 2, 8, 12),
          lateralRaise,
          [r("Face Pull", 2, 12, 20), reverseFly],
          r("Barbell Curl", 2, 8, 15),
          r("Triceps Pushdown", 2, 8, 15),
          hold("Dead Bug", 10),
        ],
      ],
    ];
    return {
      exercises: [...new Set(days.flatMap(([, slots]) => slots.flat()))],
      plan: { id: newId(), name: "Full body A/B/C", mode: "fixed", days: days.map(([name, slots]) => day(name, slots)) },
    };
  }
}

interface Program {
  exercises: Exercise[];
  plan: Plan;
}

/** A nested list of exercises becomes an exercise group. */
function day(name: string, slots: (Exercise | Exercise[])[]): PlanDay {
  return { id: newId(), name, slots: slots.map((slot) => [slot].flat().map((e) => e.id)) };
}

/** Old preset names, lowercase, mapped to clearer ones; applied to existing data when presets are added. */
const RENAMED: Record<string, string> = {
  "split squat with dumbbells": "Dumbbell Split Squat",
  "glute builder": "Hip Thrust Machine",
  "weighted pull ups": "Weighted Pull-up",
  "lying t-bar row": "Chest-supported T-Bar Row",
  "seated cable rows": "Seated Cable Row",
  "reverse flyes": "Reverse Fly",
  "pull-down": "Lat Pulldown",
};

/**
 * Adds preset plans on top of existing data, so nothing is lost; plans that already exist by name are skipped.
 * Exercises that already exist with the same name are reused, so their progress carries over.
 * A reused exercise takes the preset's sets for its logging style when it was never set up (still at 0 weight),
 * or when plans only use it in the other style, since its sets for this style are then just a copy.
 * The new sets keep the heaviest weight it had in that style, so set up weights aren't reset to 0.
 * Programs earlier in the list win the other name clashes, so My preset's real weights beat blank templates.
 */
export function addPresets(data: AppData): void {
  for (const exercise of data.exercises) exercise.name = RENAMED[exercise.name.toLowerCase()] ?? exercise.name;
  const builder = new PresetBuilder(data.settings.unit);
  const fiveByFive = builder.fiveByFive();
  const programs = [builder.myPreset(), fiveByFive, builder.hitSplit(), builder.fullBody()];
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
        const modes = data.plans.filter((p) => p.days.some((d) => d.slots.some((s) => s.includes(existing.id)))).map((p) => p.mode);
        const unused = modes.length > 0 && !modes.includes(mode);
        const heaviest = Math.max(0, ...existing.schemes[mode].map((s) => s.weight));
        if (unused || heaviest === 0) existing.schemes[mode] = exercise.schemes[mode].map((s) => ({ ...s, weight: heaviest || s.weight }));
      } else {
        byName.set(key, exercise);
        data.exercises.push(exercise);
      }
    }
    for (const day of program.plan.days) day.slots = day.slots.map((slot) => slot.map((id) => resolved.get(id) ?? id));
    data.plans.push(program.plan);
  }
  data.defaultPlanId ??= (data.plans.find((p) => p.id === fiveByFive.plan.id) ?? data.plans[0])?.id ?? null;
}

export function presetData(): AppData {
  const data = emptyData();
  addPresets(data);
  return data;
}
