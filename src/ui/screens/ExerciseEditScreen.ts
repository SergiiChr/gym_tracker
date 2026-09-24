import type { Exercise, PlanMode, Settings } from "../../model/types";
import { formatWeight, STEP_OPTIONS } from "../../model/units";
import { effectiveRule } from "../../services/progression";
import type { App } from "../App";
import { integerInput, numberRow, segmentedRow, selectRow, textRow, toggleRow } from "../components/forms";
import { swipeToDelete } from "../components/gestures";
import { confirmDelete, emptyState, page } from "../components/layout";
import { actionRow, group } from "../components/list";
import { weightInput } from "../components/weightInput";
import { h } from "../dom";
import { MODE_LABELS } from "../format";
import type { Screen } from "../Router";

/**
 * Used for both new and existing exercises; new ones are created with defaults before opening.
 * Shows the sets for one logging style; `modePath` adds a switch between styles (omitted when opened from a plan day).
 */
export class ExerciseEditScreen implements Screen {
  constructor(
    private readonly app: App,
    private readonly exerciseId: string,
    private readonly backPath: string,
    private readonly mode: PlanMode,
    private readonly modePath?: (mode: PlanMode) => string,
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
    const sets = exercise.schemes[this.mode];
    const fixed = this.mode === "fixed";
    const weight = (value: number, onChange: (w: number) => void): HTMLElement | null =>
      exercise.bodyweight ? null : weightInput(value, settings.increment.step, settings.unit, onChange);

    const rows: HTMLLIElement[] = [];
    const { modePath } = this;
    if (modePath) {
      const modes = (Object.keys(MODE_LABELS) as PlanMode[]).map((value) => ({ value, label: MODE_LABELS[value] }));
      rows.push(segmentedRow(modes, this.mode, (mode) => this.app.router.go(modePath(mode)), "Each logging style keeps its own sets and weights"));
    }
    if (fixed && !exercise.bodyweight) {
      rows.push(
        h(
          "li",
          { className: "row", title: "Working weight for all sets" },
          h(
            "div",
            { className: "row-content set-edit" },
            h("span", { className: "row-title" }, "Weight"),
            weight(sets[0]?.weight ?? 0, (w) => {
              for (const set of sets) set.weight = w;
              save();
            }),
          ),
        ),
      );
    }
    sets.forEach((set, i) =>
      rows.push(
        swipeToDelete(
          h(
            "li",
            { className: "row", title: "Reps for this set. Swipe left to delete" },
            h(
              "div",
              { className: "row-content set-edit" },
              h("span", { className: "row-title" }, `Set ${i + 1}`),
              integerInput(set.reps, (reps) => ((set.reps = reps), save()), "reps-input"),
              h("span", { className: "muted" }, "reps"),
              fixed ? null : weight(set.weight, (w) => ((set.weight = w), save())),
            ),
          ),
          () =>
            confirmDelete(`set ${i + 1}`, () => {
              sets.splice(i, 1);
              this.app.commit();
            }),
        ),
      ),
    );
    rows.push(
      actionRow("Add set", "Add a set copying the last one", () => {
        const last = sets.at(-1);
        sets.push({ reps: last?.reps ?? settings.defaultReps, weight: last?.weight ?? 0 });
        this.app.commit();
      }),
    );
    const footer = `Used by "${MODE_LABELS[this.mode]}" plans. Weights update after each finished workout.`;
    return group("Sets", rows, footer);
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
