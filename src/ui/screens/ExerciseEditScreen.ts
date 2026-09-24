import type { Exercise, Settings } from "../../model/types";
import { formatWeight, STEP_OPTIONS } from "../../model/units";
import { effectiveRule } from "../../services/progression";
import type { App } from "../App";
import { integerInput, numberRow, selectRow, textRow, toggleRow } from "../components/forms";
import { swipeToDelete } from "../components/gestures";
import { confirmDelete, emptyState, page } from "../components/layout";
import { actionRow, group } from "../components/list";
import { weightInput } from "../components/weightInput";
import { h } from "../dom";
import type { Screen } from "../Router";

/** Used for both new and existing exercises; new ones are created with defaults before opening. */
export class ExerciseEditScreen implements Screen {
  constructor(
    private readonly app: App,
    private readonly exerciseId: string,
    private readonly backPath: string,
  ) {}

  render(): HTMLElement {
    const { store, router } = this.app;
    const exercise = store.exercise(this.exerciseId);
    if (!exercise) return page("Exercise", { back: this.backPath }, emptyState("Exercise not found."));
    const settings = store.data.settings;
    const commit = (): void => this.app.commit();
    const save = (): void => store.save();

    return page(
      exercise.name,
      { back: this.backPath },
      group(null, [
        textRow("Name", exercise.name, (name) => ((exercise.name = name), commit())),
        toggleRow("Bodyweight", exercise.bodyweight, (on) => ((exercise.bodyweight = on), commit()), "Bodyweight exercises have no weight and no auto-increment"),
        numberRow("Rest timer (sec)", exercise.restSec, (sec) => ((exercise.restSec = sec), save()), "Countdown shown after each logged set"),
      ]),
      this.setsGroup(exercise, settings),
      exercise.bodyweight ? null : this.incrementGroup(exercise, settings),
      group(null, [
        actionRow(
          "Delete exercise",
          "Delete this exercise and remove it from every plan day",
          () =>
            confirmDelete(`exercise "${exercise.name}" from all plans`, () => {
              store.deleteExercise(exercise.id);
              router.go(this.backPath);
            }),
          true,
        ),
      ]),
    );
  }

  private setsGroup(exercise: Exercise, settings: Settings): HTMLElement {
    const save = (): void => this.app.store.save();
    const rows = exercise.sets.map((set, i) =>
      swipeToDelete(
        h(
          "li",
          { className: "row", title: "Reps and weight for this set. Swipe left to delete" },
          h(
            "div",
            { className: "row-content set-edit" },
            h("span", { className: "row-title" }, `Set ${i + 1}`),
            integerInput(set.reps, (reps) => ((set.reps = reps), save()), "reps-input"),
            h("span", { className: "muted" }, "reps"),
            exercise.bodyweight ? null : weightInput(set.weight, settings.increment.step, settings.unit, (w) => ((set.weight = w), save())),
          ),
        ),
        () =>
          confirmDelete(`set ${i + 1}`, () => {
            exercise.sets.splice(i, 1);
            this.app.commit();
          }),
      ),
    );
    const add = actionRow("Add set", "Add a set copying the last one", () => {
      const last = exercise.sets.at(-1);
      exercise.sets.push({ reps: last?.reps ?? settings.defaultReps, weight: last?.weight ?? 0 });
      this.app.commit();
    });
    return group("Sets", [...rows, add], "Current working sets. Weights update after each finished workout.");
  }

  private incrementGroup(exercise: Exercise, settings: Settings): HTMLElement {
    const commit = (): void => this.app.commit();
    const rule = effectiveRule(exercise, settings);
    const custom = exercise.increment;
    const rows = [
      toggleRow(
        "Use global settings",
        custom === null,
        (on) => ((exercise.increment = on ? null : { ...settings.increment }), commit()),
        "Turn off to set a different increment for this exercise",
      ),
    ];
    if (custom) {
      rows.push(
        toggleRow("Auto-increment", custom.enabled, (on) => ((custom.enabled = on), commit())),
        selectRow(
          `Step (${settings.unit})`,
          STEP_OPTIONS[settings.unit].map((v) => ({ value: v, label: formatWeight(v) })),
          custom.step,
          (step) => ((custom.step = step), commit()),
          "How much weight is added",
        ),
        numberRow("Target reps", custom.targetReps, (reps) => ((custom.targetReps = reps), commit()), "Reps needed on each checked set to earn an increment"),
      );
    }
    rows.push(
      toggleRow(
        "Last set only",
        exercise.incrementLastSetOnly,
        (on) => ((exercise.incrementLastSetOnly = on), commit()),
        "Check and increase only the last (top) set instead of all sets",
      ),
    );
    const which = exercise.incrementLastSetOnly ? "the last set reaches" : "every set reaches";
    const footer = rule.enabled
      ? `Weight goes up by ${formatWeight(rule.step)} ${settings.unit} next workout when ${which} ${rule.targetReps} reps.`
      : "Auto-increment is off.";
    return group("Auto-increment", rows, footer);
  }
}
