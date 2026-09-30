import type { App } from "../App";
import { makeSortable, moveItem, swipeToDelete } from "../components/gestures";
import { confirmDelete, deleteButton, emptyState, page } from "../components/layout";
import { actionRow, dragHandle, group, row } from "../components/list";
import { confirmDialog } from "../components/popups";
import { h } from "../dom";
import { schemeText } from "../format";
import type { Screen } from "../Router";
import { pickDayExercise } from "./DayEditScreen";

/** Exercises of one exercise group in a plan day. An index past the last slot is a new group, saved once its first exercise is added. */
export class GroupEditScreen implements Screen {
  constructor(
    private readonly app: App,
    private readonly planId: string,
    private readonly dayId: string,
    private readonly index: number,
  ) {}

  render(): HTMLElement {
    const { store, router } = this.app;
    const plan = store.plan(this.planId);
    const day = plan?.days.find((d) => d.id === this.dayId);
    if (!plan || !day) return page("Exercise group", { back: `/plans/${this.planId}` }, emptyState("Day not found."));
    const dayPath = `/plans/${plan.id}/days/${day.id}`;
    const index = Math.min(this.index, day.slots.length);
    const groupPath = `${dayPath}/groups/${index}`;
    const slot = day.slots[index] ?? [];
    const removeGroup = (): void => {
      day.slots.splice(index, 1);
      store.save();
      router.go(dayPath);
    };

    const rows = slot.flatMap((id, i) => {
      const exercise = store.exercise(id);
      if (!exercise) return [];
      const exerciseRow = row({
        title: exercise.name,
        subtitle: schemeText(exercise.schemes[plan.mode], exercise.bodyweight, store.data.settings.unit),
        leading: dragHandle(),
        href: `${groupPath}/exercises/${id}`,
        tip: "Edit sets, reps and weight (shared by every day using this exercise). Swipe left to remove",
      });
      return [
        swipeToDelete(
          exerciseRow,
          () =>
            confirmDialog({
              title: `Remove ${exercise.name}?`,
              message: "Only this group changes. The exercise itself is kept.",
              action: "Remove",
              destructive: true,
              onConfirm: () => {
                slot.splice(i, 1);
                if (slot.length === 0) removeGroup();
                else this.app.commit();
              },
            }),
          "Remove",
        ),
      ];
    });
    const add = actionRow("Add exercise", "Add an alternative to this group", () =>
      pickDayExercise(this.app, day, plan.mode, groupPath, (id) => (day.slots[index] ??= []).push(id)),
    );
    const exercises = group(
      "Exercises",
      [...rows, add],
      "The first exercise is shown in a workout, then the one done last time. Tap ⟳ on the workout card to swap. Only the exercise you do is saved.",
    );
    makeSortable(exercises.querySelector("ul")!, (from, to) => {
      moveItem(slot, from, to);
      store.save();
    });

    return page(
      "Exercise group",
      { back: dayPath },
      h("p", { className: "page-note" }, "These exercises act as a single swappable exercise in a workout."),
      exercises,
      slot.length > 0 ? deleteButton("Delete group", "Remove this group from the day. The exercises are kept", () => confirmDelete("this exercise group", removeGroup)) : null,
    );
  }
}
