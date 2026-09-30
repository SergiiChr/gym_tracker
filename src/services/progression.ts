import type { AppData, Exercise, IncrementRule, LoggedExercise, Plan, PlanDay, PlanMode, SetSpec, Settings } from "../model/types";

export function effectiveRule(exercise: Exercise, settings: Settings): IncrementRule {
  return exercise.increment ?? settings.increment;
}

/** The day after the last one done in this plan, or the first day. */
export function nextDay(plan: Plan, data: AppData): PlanDay | undefined {
  const last = data.history.find((log) => log.planId === plan.id);
  const index = last ? plan.days.findIndex((d) => d.id === last.dayId) : -1;
  return plan.days[(index + 1) % plan.days.length];
}

/** Sets have rep ranges, and the weight goes up once every set reaches the top of its range. */
export function isDoubleProgression(sets: SetSpec[]): boolean {
  return sets.some((s) => s.maxReps !== undefined);
}

/** Positions of the planned sets that are checked and get the increment; double progression always uses all of them. */
function checkedSets(exercise: Exercise, scheme: SetSpec[]): number[] {
  const all = [...scheme.keys()];
  return exercise.incrementLastSetOnly && !isDoubleProgression(scheme) ? all.slice(-1) : all;
}

/**
 * Whether a finished exercise earned a weight increase for next time.
 * Checks the planned sets, so a planned set removed or left undone blocks the increase.
 */
export function earnedIncrement(logged: LoggedExercise, exercise: Exercise, rule: IncrementRule, scheme: SetSpec[]): boolean {
  if (!rule.enabled || exercise.bodyweight || scheme.length === 0) return false;
  return checkedSets(exercise, scheme).every((i) => {
    const target = scheme[i]!.maxReps ?? rule.targetReps;
    return logged.sets.some((s) => s.planIndex === i && s.done && s.reps >= target);
  });
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
  if (!earnedIncrement(logged, exercise, rule, scheme)) return;
  for (const i of checkedSets(exercise, scheme)) scheme[i]!.weight += rule.step;
}
