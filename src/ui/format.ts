import { formatWeight } from "../model/units";
import type { Exercise, PlanMode, SetSpec, Unit } from "../model/types";

export const MODE_LABELS: Record<PlanMode, string> = {
  fixed: "Same weight",
  perSet: "Weight per set",
};

/** Compact scheme like "5×5 · 60 kg" or "2 sets · 12/8 · 40–60 kg". */
export function schemeText(sets: SetSpec[], bodyweight: boolean, unit: Unit): string {
  const reps = sets.map((s) => s.reps);
  const weights = sets.map((s) => s.weight);
  const sameReps = reps.every((r) => r === reps[0]);
  const scheme = sameReps ? `${reps.length}×${reps[0] ?? 0}` : `${reps.length} sets · ${reps.join("/")}`;
  if (bodyweight) return `${scheme} · bodyweight`;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const load = min === max ? formatWeight(max) : `${formatWeight(min)}–${formatWeight(max)}`;
  return `${scheme} · ${load} ${unit}`;
}

/** Both logging styles, or one when they're still identical. */
export function exerciseSummary(exercise: Exercise, unit: Unit): string {
  const { fixed, perSet } = exercise.schemes;
  const texts = [schemeText(fixed, exercise.bodyweight, unit), schemeText(perSet, exercise.bodyweight, unit)];
  return texts[0] === texts[1] ? texts[0]! : texts.join(" | ");
}
