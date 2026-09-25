import { newId } from "../model/presets";
import type { AppData, LoggedExercise, LoggedSet, Plan, PlanDay, PlanMode, WorkoutLog } from "../model/types";
import { applyResult } from "./progression";

export function createWorkout(data: AppData, plan: Plan, day: PlanDay): WorkoutLog {
  const exercises = day.exerciseIds.flatMap((id) => {
    const exercise = data.exercises.find((e) => e.id === id);
    if (!exercise) return [];
    return [
      {
        exerciseId: exercise.id,
        name: exercise.name,
        bodyweight: exercise.bodyweight,
        sets: exercise.schemes[plan.mode].map((s, i) => ({ targetReps: s.reps, reps: s.reps, weight: s.weight, done: false, planIndex: i })),
      },
    ];
  });
  return {
    id: newId(),
    planId: plan.id,
    planName: plan.name,
    mode: plan.mode,
    dayId: day.id,
    dayName: day.name,
    startedAt: Date.now(),
    finishedAt: null,
    exercises,
  };
}

export function hasUnfinishedSets(workout: WorkoutLog): boolean {
  return workout.exercises.some((e) => e.sets.some((s) => !s.done));
}

export function isComplete(logged: LoggedExercise): boolean {
  return logged.sets.length > 0 && logged.sets.every((s) => s.done);
}

/** A copy of the last set that belongs to this workout only. */
export function addSet(logged: LoggedExercise): void {
  const last = logged.sets.at(-1);
  logged.sets.push({ targetReps: last?.targetReps ?? 5, reps: last?.targetReps ?? 5, weight: last?.weight ?? 0, done: false, planIndex: null });
}

/** Saves completed sets to history, drops the rest, and updates exercise weights for next time. */
export function finishWorkout(data: AppData, workout: WorkoutLog): void {
  workout.finishedAt = Date.now();
  for (const logged of workout.exercises) {
    const exercise = data.exercises.find((e) => e.id === logged.exerciseId);
    if (exercise) applyResult(logged, exercise, workout.mode, data.settings);
    logged.sets = logged.sets.filter((s) => s.done);
  }
  workout.exercises = workout.exercises.filter((e) => e.sets.length > 0);
  data.history.unshift(workout);
  data.activeWorkout = null;
}

/** The same planned set from the latest finished workout in this logging style that included this exercise. */
export function previousSet(data: AppData, exerciseId: string, mode: PlanMode, planIndex: number | null): LoggedSet | undefined {
  if (planIndex === null) return undefined;
  for (const log of data.history) {
    if (log.mode !== mode) continue;
    const logged = log.exercises.find((e) => e.exerciseId === exerciseId);
    const set = logged?.sets.find((s) => s.planIndex === planIndex && s.done);
    if (set) return set;
  }
  return undefined;
}

/** Circle tap: not done → done at target reps → one rep less each tap → not done again after 0. */
export function cycleReps(set: LoggedSet): void {
  if (!set.done) {
    set.done = true;
    set.reps = set.targetReps;
  } else if (set.reps > 0) {
    set.reps -= 1;
  } else {
    set.done = false;
    set.reps = set.targetReps;
  }
}

export function durationMinutes(log: WorkoutLog): number {
  return Math.round(((log.finishedAt ?? Date.now()) - log.startedAt) / 60000);
}
