import { newId } from "../model/presets";
import type { AppData, Exercise, LoggedExercise, LoggedSet, Plan, PlanDay, PlanMode, SetSpec, WorkoutLog } from "../model/types";
import { applyResult } from "./progression";

/** Workout entry prefilled with the exercise's planned sets for this logging style. */
export function logExercise(exercise: Exercise, mode: PlanMode): LoggedExercise {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    bodyweight: exercise.bodyweight,
    // Under double progression sets start at the top of the range, which is also what earns the increment.
    sets: exercise.schemes[mode].map((s, i) => ({
      targetReps: s.maxReps ?? s.reps,
      reps: s.maxReps ?? s.reps,
      weight: s.weight,
      done: false,
      planIndex: i,
      minReps: s.maxReps === undefined ? undefined : s.reps,
    })),
  };
}

/** The exercise of a group done in the latest workout, or the group's first one. */
function pickFromGroup(data: AppData, ids: string[]): string | undefined {
  for (const log of data.history) {
    const done = log.exercises.find((e) => ids.includes(e.exerciseId));
    if (done) return done.exerciseId;
  }
  return ids[0];
}

/** Entry for another exercise of the same group, replacing the swapped out one with its sets. */
export function swapExercise(logged: LoggedExercise, exercise: Exercise, mode: PlanMode): LoggedExercise {
  return { ...logExercise(exercise, mode), group: logged.group };
}

export function createWorkout(data: AppData, plan: Plan, day: PlanDay): WorkoutLog {
  const exercises = day.slots.flatMap((slot) => {
    const ids = slot.filter((id) => data.exercises.some((e) => e.id === id));
    const exercise = data.exercises.find((e) => e.id === pickFromGroup(data, ids));
    if (!exercise) return [];
    const logged = logExercise(exercise, plan.mode);
    if (ids.length > 1) logged.group = ids;
    return [logged];
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
  const targetReps = last?.targetReps ?? 5;
  logged.sets.push({ targetReps, reps: targetReps, weight: last?.weight ?? 0, done: false, planIndex: null, minReps: last?.minReps });
}

/** Adds a set to the workout and to the exercise's planned sets, so later workouts get it too. */
export function addPlannedSet(logged: LoggedExercise, exercise: Exercise, mode: PlanMode): void {
  addSet(logged);
  const set = logged.sets.at(-1)!;
  const spec: SetSpec = set.minReps === undefined ? { reps: set.targetReps, weight: set.weight } : { reps: set.minReps, maxReps: set.targetReps, weight: set.weight };
  set.planIndex = exercise.schemes[mode].push(spec) - 1;
}

/** Removes a set from the workout and its planned set from the exercise; later planned sets move up one place. */
export function removePlannedSet(logged: LoggedExercise, index: number, exercise: Exercise, mode: PlanMode): void {
  const [removed] = logged.sets.splice(index, 1);
  const planIndex = removed?.planIndex;
  if (planIndex === null || planIndex === undefined) return;
  exercise.schemes[mode].splice(planIndex, 1);
  for (const set of logged.sets) if (set.planIndex !== null && set.planIndex > planIndex) set.planIndex -= 1;
}

/** Applies the workout's exercise order to the plan day; slots missing from the workout keep their place. */
export function applyOrderToDay(workout: WorkoutLog, day: PlanDay): void {
  const indexes = workout.exercises.map((e) => day.slots.findIndex((slot) => slot.includes(e.exerciseId))).filter((i) => i >= 0);
  const inWorkout = new Set(indexes);
  const ordered = [...inWorkout].map((i) => day.slots[i]!);
  day.slots = day.slots.map((slot, i) => (inWorkout.has(i) ? ordered.shift()! : slot));
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
    resetSet(set);
  }
}

/** Back to not done at target reps. */
export function resetSet(set: LoggedSet): void {
  set.done = false;
  set.reps = set.targetReps;
}

export function durationMinutes(log: WorkoutLog): number {
  return Math.round(((log.finishedAt ?? Date.now()) - log.startedAt) / 60000);
}
