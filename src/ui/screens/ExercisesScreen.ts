import { newExercise } from "../../model/presets";
import type { App } from "../App";
import { swipeToDelete } from "../components/gestures";
import { confirmDelete, emptyState, page, plusButton } from "../components/layout";
import { group, row } from "../components/list";
import { exerciseSummary } from "../format";
import type { Screen } from "../Router";

export class ExercisesScreen implements Screen {
  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const { store } = this.app;
    const unit = store.data.settings.unit;
    const sorted = [...store.data.exercises].sort((a, b) => a.name.localeCompare(b.name));
    const rows = sorted.map((exercise) =>
      swipeToDelete(
        row({ title: exercise.name, subtitle: exerciseSummary(exercise, unit), href: `/exercises/${exercise.id}`, tip: "Edit exercise. Swipe left to delete" }),
        () =>
          confirmDelete(`exercise "${exercise.name}" from all plans`, () => {
            store.deleteExercise(exercise.id);
            this.app.commit();
          }),
      ),
    );
    const add = plusButton("Add a new exercise", () => {
      const exercise = newExercise(store.data.settings);
      store.data.exercises.push(exercise);
      store.save();
      this.app.router.go(`/exercises/${exercise.id}`);
    });
    return page("Exercises", { back: "/", action: add }, rows.length ? group(null, rows) : emptyState("No exercises yet. Tap + to add one."));
  }
}
