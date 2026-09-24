import type { AppData, Unit } from "./types";

const LBS_PER_KG = 2.20462;

/** Common plate increments offered in pickers, per unit. */
export const STEP_OPTIONS: Record<Unit, number[]> = {
  kg: [0.5, 1, 1.25, 2, 2.5, 5],
  lbs: [1, 2.5, 5, 10],
};

export const DEFAULT_STEP: Record<Unit, number> = { kg: 2.5, lbs: 5 };

/** Rounds to the smallest plate step of the unit so converted weights stay loadable. */
export function convertWeight(weight: number, from: Unit, to: Unit): number {
  if (from === to) return weight;
  const raw = to === "lbs" ? weight * LBS_PER_KG : weight / LBS_PER_KG;
  const precision = to === "lbs" ? 1 : 0.25;
  return Math.round(raw / precision) * precision;
}

/** Converts every stored weight in place; weights are always stored in the unit from settings. */
export function convertData(data: AppData, to: Unit): void {
  const from = data.settings.unit;
  if (from === to) return;
  const convert = (w: number): number => convertWeight(w, from, to);
  for (const exercise of data.exercises) {
    for (const set of Object.values(exercise.schemes).flat()) set.weight = convert(set.weight);
    if (exercise.increment) exercise.increment.step = DEFAULT_STEP[to];
  }
  const logs = data.activeWorkout ? [...data.history, data.activeWorkout] : data.history;
  for (const log of logs) {
    for (const exercise of log.exercises) {
      for (const set of exercise.sets) set.weight = convert(set.weight);
    }
  }
  data.settings.increment.step = DEFAULT_STEP[to];
  data.settings.unit = to;
}

/** Trims float noise like 61.2349999 and trailing zeros. */
export function formatWeight(weight: number): string {
  return String(Math.round(weight * 100) / 100);
}
