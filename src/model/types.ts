export type Unit = "kg" | "lbs";

/**
 * How a plan's workouts are logged.
 * "fixed": one weight per exercise, sets logged by tapping circles.
 * "perSet": every set has its own reps and weight inputs.
 */
export type PlanMode = "fixed" | "perSet";

export interface SetSpec {
  reps: number;
  weight: number;
}

export interface IncrementRule {
  enabled: boolean;
  step: number;
  /** Reps every checked set must reach for the weight to go up next time. */
  targetReps: number;
}

export interface Exercise {
  id: string;
  name: string;
  bodyweight: boolean;
  /**
   * Current working sets per logging style, shared by every plan day that uses this exercise.
   * The styles progress separately since their weights aren't comparable.
   */
  schemes: Record<PlanMode, SetSpec[]>;
  restSec: number;
  /** Null means the global rule from settings applies. */
  increment: IncrementRule | null;
  /** Only check and increment the last set (top set / pyramid style). */
  incrementLastSetOnly: boolean;
}

export interface PlanDay {
  id: string;
  name: string;
  exerciseIds: string[];
}

export interface Plan {
  id: string;
  name: string;
  mode: PlanMode;
  days: PlanDay[];
}

export interface LoggedSet {
  targetReps: number;
  reps: number;
  weight: number;
  /** Only completed sets are kept when a workout is finished. */
  done: boolean;
  /**
   * Position of the planned set this came from, or null for a set added during the workout.
   * Lets sets be reordered, removed or added mid-workout without touching the saved plan.
   */
  planIndex: number | null;
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  bodyweight: boolean;
  sets: LoggedSet[];
}

/** Names are copied so history stays readable after plans or exercises are renamed or deleted. */
export interface WorkoutLog {
  id: string;
  planId: string;
  planName: string;
  mode: PlanMode;
  dayId: string;
  dayName: string;
  startedAt: number;
  finishedAt: number | null;
  exercises: LoggedExercise[];
}

export interface Settings {
  unit: Unit;
  defaultSets: number;
  defaultReps: number;
  defaultRestSec: number;
  increment: IncrementRule;
}

export interface AppData {
  version: number;
  settings: Settings;
  exercises: Exercise[];
  plans: Plan[];
  defaultPlanId: string | null;
  /** Newest first. */
  history: WorkoutLog[];
  activeWorkout: WorkoutLog | null;
}
