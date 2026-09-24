import { emptyData, newExercise } from "../src/model/presets";
import type { AppData, Exercise, Plan } from "../src/model/types";

/** Data with one fixed-mode plan of two days sharing a "Squat" exercise. */
export function sampleData(): { data: AppData; squat: Exercise; bench: Exercise; plan: Plan } {
  const data = emptyData();
  const squat: Exercise = { ...newExercise(data.settings), name: "Squat", sets: Array.from({ length: 5 }, () => ({ reps: 5, weight: 100 })) };
  const bench: Exercise = { ...newExercise(data.settings), name: "Bench", sets: [{ reps: 5, weight: 60 }] };
  const plan: Plan = {
    id: "plan",
    name: "Plan",
    mode: "fixed",
    days: [
      { id: "a", name: "A", exerciseIds: [squat.id, bench.id] },
      { id: "b", name: "B", exerciseIds: [squat.id] },
    ],
  };
  data.exercises.push(squat, bench);
  data.plans.push(plan);
  data.defaultPlanId = plan.id;
  return { data, squat, bench, plan };
}
