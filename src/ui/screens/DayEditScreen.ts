import { newExercise } from "../../model/presets";
import type { PlanDay, PlanMode } from "../../model/types";
import type { App } from "../App";
import { confirmDialog } from "../components/popups";
import { exercisePicker } from "../components/exercisePicker";
import { textRow } from "../components/forms";
import { makeSortable, moveItem, swipeToDelete } from "../components/gestures";
import { confirmDelete, deleteButton, emptyState, page } from "../components/layout";
import { actionRow, dragHandle, group, row } from "../components/list";
import { schemeText } from "../format";
import { ICONS } from "../icons";
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

    const slotRows = day.slots.flatMap((slot, index) => {
      const exercises = slot.flatMap((id) => store.exercise(id) ?? []);
      const [first] = exercises;
      if (!first) return [];
      const grouped = exercises.length > 1;
      const slotRow = grouped
        ? row({
            title: exercises.map((e) => e.name).join(" / "),
            subtitle: `Exercise group · ${exercises.length} exercises`,
            leading: dragHandle(),
            href: `${dayPath}/groups/${index}`,
            tip: "Acts as one exercise in a workout, swappable while training. Swipe left to remove",
          })
        : row({
            title: first.name,
            subtitle: schemeText(first.schemes[plan.mode], first.bodyweight, unit),
            leading: dragHandle(),
            href: `${dayPath}/exercises/${first.id}`,
            tip: "Edit sets, reps and weight (shared by every day using this exercise). Swipe left to remove",
          });
      return [
        swipeToDelete(
          slotRow,
          () =>
            confirmDialog({
              title: `Remove ${grouped ? "exercise group" : first.name}?`,
              message: `Only this day changes. The ${grouped ? "exercises themselves are" : "exercise itself is"} kept.`,
              action: "Remove",
              destructive: true,
              onConfirm: () => {
                day.slots.splice(index, 1);
                this.app.commit();
              },
            }),
          "Remove",
        ),
      ];
    });
    const addRow = actionRow("Add exercise", "Add an existing or new exercise to this day", () =>
      pickDayExercise(this.app, day, plan.mode, dayPath, (id) => day.slots.push([id])),
    );
    const addGroup = actionRow(
      "Add exercise group",
      "Several exercises that act as one in a workout; swap between them while training",
      () => router.go(`${dayPath}/groups/${day.slots.length}`),
      ICONS.swap,
    );
    const exercises = group("Exercises", [...slotRows, addRow, addGroup], "Weights are shared: changing an exercise here updates it in every plan and day.");
    makeSortable(exercises.querySelector("ul")!, (from, to) => {
      moveItem(day.slots, from, to);
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
}

/** Picks an exercise not yet in the day, or creates a new one and opens it under `basePath` for editing. */
export function pickDayExercise(app: App, day: PlanDay, mode: PlanMode, basePath: string, add: (id: string) => void): void {
  const { store, router } = app;
  const inDay = new Set(day.slots.flat());
  exercisePicker(
    store.data.exercises.filter((e) => !inDay.has(e.id)),
    mode,
    store.data.settings.unit,
    (exercise) => {
      add(exercise.id);
      app.commit();
    },
    (name) => {
      const exercise = newExercise(store.data.settings, name);
      store.data.exercises.push(exercise);
      add(exercise.id);
      store.save();
      router.go(`${basePath}/exercises/${exercise.id}`);
    },
  );
}
