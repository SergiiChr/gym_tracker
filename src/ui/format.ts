import { formatWeight } from "../model/units";
import type { Exercise, PlanMode, Unit } from "../model/types";

export const MODE_LABELS: Record<PlanMode, string> = {
  fixed: "Same weight",
  perSet: "Weight per set",
};

/** Compact scheme like "5×5 · 60 kg" or "2 sets · 12/8 · 40–60 kg". */
export function schemeText(exercise: Exercise, unit: Unit): string {
  const reps = exercise.sets.map((s) => s.reps);
  const weights = exercise.sets.map((s) => s.weight);
  const sameReps = reps.every((r) => r === reps[0]);
  const scheme = sameReps ? `${reps.length}×${reps[0] ?? 0}` : `${reps.length} sets · ${reps.join("/")}`;
  if (exercise.bodyweight) return `${scheme} · bodyweight`;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const load = min === max ? formatWeight(max) : `${formatWeight(min)}–${formatWeight(max)}`;
  return `${scheme} · ${load} ${unit}`;
}
