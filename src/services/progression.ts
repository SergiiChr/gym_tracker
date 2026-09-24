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

/** Whether a finished exercise earned a weight increase for next time. */
export function earnedIncrement(logged: LoggedExercise, exercise: Exercise, rule: IncrementRule): boolean {
  if (!rule.enabled || exercise.bodyweight || logged.sets.length === 0) return false;
  const checked = exercise.incrementLastSetOnly ? logged.sets.slice(-1) : logged.sets;
  return checked.every((s) => (s.reps ?? 0) >= rule.targetReps);
}

/**
 * Copies weights used in the workout back to the exercise's scheme for that logging style, then applies auto-increment.
 * Sets are matched by index, so a scheme edited mid-workout keeps its extra sets untouched.
 */
export function applyResult(logged: LoggedExercise, exercise: Exercise, mode: PlanMode, settings: Settings): void {
  const scheme = exercise.schemes[mode];
  logged.sets.forEach((set, i) => {
    const spec = scheme[i];
    if (spec) spec.weight = set.weight;
  });
  const rule = effectiveRule(exercise, settings);
  if (!earnedIncrement(logged, exercise, rule)) return;
  const targets = exercise.incrementLastSetOnly ? scheme.slice(-1) : scheme;
  for (const spec of targets) spec.weight += rule.step;
}
