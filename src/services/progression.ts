import type { AppData, Exercise, IncrementRule, LoggedExercise, Plan, PlanDay, PlanMode, Settings } from "../model/types";

export function effectiveRule(exercise: Exercise, settings: Settings): IncrementRule {
  return exercise.increment ?? settings.increment;
}

/** The day after the last one done in this plan, or the first day. */
export function nextDay(plan: Plan, data: AppData): PlanDay | undefined {
  const last = data.history.find((log) => log.planId === plan.id);
  const index = last ? plan.days.findIndex((d) => d.id === last.dayId) : -1;
  return plan.days[(index + 1) % plan.days.length];
}

/**
 * Whether a finished exercise earned a weight increase for next time.
 * Checks the planned sets (or only the last one), so a planned set removed or left undone blocks the increase.
 */
export function earnedIncrement(logged: LoggedExercise, exercise: Exercise, rule: IncrementRule, plannedSets: number): boolean {
  if (!rule.enabled || exercise.bodyweight || plannedSets === 0) return false;
  const indexes = exercise.incrementLastSetOnly ? [plannedSets - 1] : [...Array(plannedSets).keys()];
  return indexes.every((i) => logged.sets.some((s) => s.planIndex === i && s.done && s.reps >= rule.targetReps));
}

/**
 * Copies weights of completed sets back to the exercise's scheme for that logging style, then applies auto-increment.
 * Sets are matched by their planned position, so sets added, moved or removed mid-workout leave the plan's layout as is.
 */
export function applyResult(logged: LoggedExercise, exercise: Exercise, mode: PlanMode, settings: Settings): void {
  const scheme = exercise.schemes[mode];
  for (const set of logged.sets) {
    const spec = set.done && set.planIndex !== null ? scheme[set.planIndex] : undefined;
    if (spec) spec.weight = set.weight;
  }
  const rule = effectiveRule(exercise, settings);
  if (!earnedIncrement(logged, exercise, rule, scheme.length)) return;
  const targets = exercise.incrementLastSetOnly ? scheme.slice(-1) : scheme;
  for (const spec of targets) spec.weight += rule.step;
}
