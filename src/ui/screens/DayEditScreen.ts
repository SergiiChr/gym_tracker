import { newExercise } from "../../model/presets";
import type { App } from "../App";
import { confirmDialog } from "../components/popups";
import { exercisePicker } from "../components/exercisePicker";
import { textRow } from "../components/forms";
import { makeSortable, moveItem, swipeToDelete } from "../components/gestures";
import { confirmDelete, deleteButton, emptyState, page } from "../components/layout";
import { actionRow, dragHandle, group, row } from "../components/list";
import { schemeText } from "../format";
import type { Screen } from "../Router";

export class DayEditScreen implements Screen {
  constructor(
    private readonly app: App,
    private readonly planId: string,
    private readonly dayId: string,
  ) {}

  render(): HTMLElement {
    const { store, router } = this.app;
    const plan = store.plan(this.planId);
    const day = plan?.days.find((d) => d.id === this.dayId);
    const planPath = `/plans/${this.planId}`;
    if (!plan || !day) return page("Day", { back: planPath }, emptyState("Day not found."));
    const dayPath = `${planPath}/days/${day.id}`;
    const unit = store.data.settings.unit;

    const exerciseRows = day.exerciseIds.flatMap((id, index) => {
      const exercise = store.exercise(id);
      if (!exercise) return [];
      const exerciseRow = row({
        title: exercise.name,
        subtitle: schemeText(exercise.schemes[plan.mode], exercise.bodyweight, unit),
        leading: dragHandle(),
        href: `${dayPath}/exercises/${id}`,
        tip: "Edit sets, reps and weight (shared by every day using this exercise). Swipe left to remove",
      });
      return [
        swipeToDelete(
          exerciseRow,
          () =>
            confirmDialog({
              title: `Remove ${exercise.name}?`,
              message: "Only this day changes. The exercise itself is kept.",
              action: "Remove",
              destructive: true,
              onConfirm: () => {
                day.exerciseIds.splice(index, 1);
                this.app.commit();
              },
            }),
          "Remove",
        ),
      ];
    });
    const addRow = actionRow("Add exercise", "Add an existing or new exercise to this day", () => this.pickExercise(dayPath));
    const exercises = group("Exercises", [...exerciseRows, addRow], "Weights are shared: changing an exercise here updates it in every plan and day.");
    makeSortable(exercises.querySelector("ul")!, (from, to) => {
      moveItem(day.exerciseIds, from, to);
      store.save();
    });

    return page(
      day.name,
      { back: planPath },
      group(null, [textRow("Name", day.name, (name) => ((day.name = name), this.app.commit()))]),
      exercises,
      deleteButton(
        "Delete day",
        "Delete this day from the plan",
        () =>
          confirmDelete(`day "${day.name}"`, () => {
            plan.days = plan.days.filter((d) => d !== day);
            store.save();
            router.go(planPath);
          }),
      ),
    );
  }

  private pickExercise(dayPath: string): void {
    const { store, router } = this.app;
    const day = store.plan(this.planId)?.days.find((d) => d.id === this.dayId);
    if (!day) return;
    exercisePicker(
      store.data.exercises.filter((e) => !day.exerciseIds.includes(e.id)),
      store.plan(this.planId)?.mode ?? "fixed",
      store.data.settings.unit,
      (exercise) => {
        day.exerciseIds.push(exercise.id);
        this.app.commit();
      },
      (name) => {
        const exercise = newExercise(store.data.settings, name);
        store.data.exercises.push(exercise);
        day.exerciseIds.push(exercise.id);
        store.save();
        router.go(`${dayPath}/exercises/${exercise.id}`);
      },
    );
  }
}
