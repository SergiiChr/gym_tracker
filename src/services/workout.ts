import { newId } from "../model/presets";
import type { AppData, LoggedSet, Plan, PlanDay, PlanMode, WorkoutLog } from "../model/types";
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
        sets: exercise.schemes[plan.mode].map((s) => ({ targetReps: s.reps, reps: null, weight: s.weight })),
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

/** Saves the workout to history and updates exercise weights for next time. */
export function finishWorkout(data: AppData, workout: WorkoutLog): void {
  workout.finishedAt = Date.now();
  for (const logged of workout.exercises) {
    const exercise = data.exercises.find((e) => e.id === logged.exerciseId);
    if (exercise) applyResult(logged, exercise, workout.mode, data.settings);
  }
  data.history.unshift(workout);
  data.activeWorkout = null;
}

/** The same set from the latest finished workout in this logging style that included this exercise. */
export function previousSet(data: AppData, exerciseId: string, mode: PlanMode, index: number): LoggedSet | undefined {
  for (const log of data.history) {
    if (log.mode !== mode) continue;
    const logged = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (logged) return logged.sets[index];
  }
  return undefined;
}

/** Stronglifts-style tap: empty → target reps → one less each tap → back to empty after 0. */
export function cycleReps(set: LoggedSet): void {
  if (set.reps === null) set.reps = set.targetReps;
  else if (set.reps > 0) set.reps -= 1;
  else set.reps = null;
}

export function durationMinutes(log: WorkoutLog): number {
  return Math.round(((log.finishedAt ?? Date.now()) - log.startedAt) / 60000);
}
