import { newExercise } from "../../model/presets";
import type { App } from "../App";
import { actionSheet } from "../components/actionSheet";
import { textRow } from "../components/forms";
import { makeSortable, moveItem, swipeToDelete } from "../components/gestures";
import { confirmDelete, emptyState, page } from "../components/layout";
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
        subtitle: schemeText(exercise, unit),
        leading: dragHandle(),
        href: `${dayPath}/exercises/${id}`,
        tip: "Edit sets, reps and weight (shared by every day using this exercise). Swipe left to remove",
      });
      return [
        swipeToDelete(
          exerciseRow,
          () => {
            if (!confirm(`Remove ${exercise.name} from this day? The exercise itself is kept.`)) return;
            day.exerciseIds.splice(index, 1);
            this.app.commit();
          },
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
      group(null, [
        actionRow(
          "Delete day",
          "Delete this day from the plan",
          () => {
            if (!confirmDelete(`day "${day.name}"`)) return;
            plan.days = plan.days.filter((d) => d !== day);
            store.save();
            router.go(planPath);
          },
          true,
        ),
      ]),
    );
  }

  private pickExercise(dayPath: string): void {
    const { store, router } = this.app;
    const day = store.plan(this.planId)?.days.find((d) => d.id === this.dayId);
    if (!day) return;
    const available = store.data.exercises
      .filter((e) => !day.exerciseIds.includes(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    actionSheet("Add exercise", [
      {
        label: "＋ New exercise",
        onSelect: () => {
          const exercise = newExercise(store.data.settings);
          store.data.exercises.push(exercise);
          day.exerciseIds.push(exercise.id);
          store.save();
          router.go(`${dayPath}/exercises/${exercise.id}`);
        },
      },
      ...available.map((e) => ({
        label: e.name,
        onSelect: () => {
          day.exerciseIds.push(e.id);
          this.app.commit();
        },
      })),
    ]);
  }
}
