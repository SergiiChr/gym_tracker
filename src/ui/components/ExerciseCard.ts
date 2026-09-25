import type { LoggedExercise, LoggedSet, PlanMode, Unit } from "../../model/types";
import { formatWeight } from "../../model/units";
import { addSet, cycleReps, isComplete } from "../../services/workout";
import { h, svg } from "../dom";
import { ICONS } from "../icons";
import { makeSortable, moveItem, swipeToDelete } from "./gestures";
import { confirmDelete } from "./layout";
import { actionRow, dragHandle } from "./list";
import { stepper, weightInput } from "./stepper";

export interface CardHost {
  mode: PlanMode;
  unit: Unit;
  step: number;
  previous(logged: LoggedExercise, set: LoggedSet): LoggedSet | undefined;
  onSetDone(logged: LoggedExercise): void;
  save(): void;
}

const COLLAPSE_DELAY_MS = 500;

/**
 * One exercise in a running workout. Changes to its sets only touch this workout, not the plan.
 * Unfinished sets carry the `todo` class so the screen can find the next one.
 */
export class ExerciseCard {
  readonly element: HTMLDetailsElement;
  private readonly detail = h("span", { className: "card-detail" });
  private body: HTMLElement = h("div");

  constructor(
    private readonly logged: LoggedExercise,
    private readonly host: CardHost,
  ) {
    this.element = h(
      "details",
      { className: "card", open: !isComplete(logged) },
      h(
        "summary",
        { title: "Tap to collapse or expand" },
        h("span", { className: "card-title" }, logged.name),
        this.detail,
        h("span", { className: "card-check", title: "All sets done" }, svg(ICONS.check)),
      ),
      this.body,
    );
    this.refresh();
  }

  /** Rebuilds the body, e.g. after sets were added, removed or moved. */
  private refresh(): void {
    const body = this.host.mode === "fixed" ? this.fixedBody() : this.perSetBody();
    this.body.replaceWith(body);
    this.body = body;
    this.updateDetail();
    this.element.classList.toggle("complete", isComplete(this.logged));
  }

  private updateDetail(): void {
    const { sets, bodyweight } = this.logged;
    const first = sets[0];
    if (this.host.mode === "fixed") {
      const load = bodyweight || !first ? "" : ` · ${formatWeight(first.weight)} ${this.host.unit}`;
      this.detail.textContent = `${sets.length}×${first?.targetReps ?? 0}${load}`;
    } else {
      this.detail.textContent = `${sets.length} ${sets.length === 1 ? "set" : "sets"}${bodyweight ? "" : ` · ${this.host.unit}`}`;
    }
  }

  /** Called after any change to a set's state; collapses the card once the last set is done. */
  private changed(becameDone: boolean): void {
    this.host.save();
    if (becameDone) this.host.onSetDone(this.logged);
    const complete = isComplete(this.logged);
    const wasComplete = this.element.classList.contains("complete");
    this.element.classList.toggle("complete", complete);
    if (complete && !wasComplete) setTimeout(() => (this.element.open = false), COLLAPSE_DELAY_MS);
  }

  /** Same weight style: one weight, tap circles to log reps. */
  private fixedBody(): HTMLElement {
    const { logged, host } = this;
    const circles = logged.sets.map((set) => {
      const prev = h("span", { className: "set-prev" });
      const circle = h("button", { type: "button", className: "circle", title: "Tap to log reps; tap again for one rep less" });
      const paint = (): void => {
        circle.textContent = String(set.reps);
        circle.className = `circle ${set.done ? repsClass(set) : "todo"}`;
        this.paintHint(prev, set, false);
      };
      circle.addEventListener("click", () => {
        const wasDone = set.done;
        cycleReps(set);
        paint();
        this.changed(!wasDone && set.done);
      });
      paint();
      return { cell: h("div", { className: "set-cell" }, circle, prev), paint };
    });

    const weightRow = logged.bodyweight
      ? null
      : h(
          "div",
          { className: "card-row", title: "Working weight for all sets" },
          h("span", {}, "Weight"),
          weightInput(logged.sets[0]?.weight ?? 0, host.step, host.unit, (value) => {
            for (const set of logged.sets) set.weight = value;
            this.updateDetail();
            circles.forEach((c) => c.paint());
            host.save();
          }),
        );
    const actions = h(
      "div",
      { className: "set-actions" },
      h("button", { type: "button", title: "Add a set to this workout", onclick: () => this.addSet() }, "+ Set"),
      logged.sets.length > 0
        ? h("button", { type: "button", title: "Remove the last set from this workout", onclick: () => this.removeSet(logged.sets.length - 1) }, "− Set")
        : null,
    );
    return h("div", { className: "card-body" }, weightRow, h("div", { className: "circles" }, ...circles.map((c) => c.cell)), actions);
  }

  /** Weight per set style: reps and weight steppers plus a done checkbox per set. */
  private perSetBody(): HTMLElement {
    const { logged, host } = this;
    const numbered = logged.sets.length > 1;
    const rows = logged.sets.map((set, i) => {
      const hint = h("div", { className: "set-hint" });
      const check = h("button", { type: "button", className: "set-check", title: "Mark set as done", ariaLabel: "Done" }, svg(ICONS.check));
      const reps = stepper({
        value: set.reps,
        step: 1,
        decimal: false,
        label: "Reps",
        // Adjusting reps doesn't complete the set: it's often done ahead of the set. Only the checkbox does.
        onChange: (value) => {
          set.reps = value;
          paint();
          host.save();
        },
      });
      const weight = logged.bodyweight
        ? null
        : stepper({
            value: set.weight,
            step: host.step,
            decimal: true,
            label: `Weight in ${host.unit}`,
            onChange: (value) => {
              set.weight = value;
              paint();
              host.save();
            },
          });
      const li = h(
        "li",
        { className: "row" },
        h(
          "div",
          { className: "row-content set-row" },
          dragHandle(),
          numbered ? h("span", { className: "set-num" }, String(i + 1)) : null,
          reps,
          weight,
          check,
          hint,
        ),
      );
      const paint = (): void => {
        reps.className = `stepper stepper-reps ${set.done ? repsClass(set) : ""}`;
        check.classList.toggle("on", set.done);
        check.title = set.done ? "Done. Tap to undo" : "Mark set as done";
        li.classList.toggle("todo", !set.done);
        this.paintHint(hint, set, true);
      };
      check.addEventListener("click", () => {
        set.done = !set.done;
        paint();
        this.changed(set.done);
      });
      paint();
      return swipeToDelete(li, () => this.removeSet(i));
    });
    const add = actionRow("Add set", "Add a set to this workout only", () => this.addSet());
    const list = h("ul", { className: "list set-list" }, ...rows, add);
    makeSortable(list, (from, to) => {
      moveItem(logged.sets, from, to);
      host.save();
      this.refresh();
    });
    return h("div", { className: "card-body" }, list);
  }

  private addSet(): void {
    addSet(this.logged);
    this.host.save();
    this.refresh();
  }

  private removeSet(index: number): void {
    confirmDelete(`set ${index + 1} from this workout`, () => {
      this.logged.sets.splice(index, 1);
      this.host.save();
      this.refresh();
    });
  }

  /** Last time's result for this planned set; green when today's weight is higher. */
  private paintHint(el: HTMLElement, set: LoggedSet, withWeight: boolean): void {
    const { logged } = this;
    const prev = this.host.previous(logged, set);
    const up = prev !== undefined && !logged.bodyweight && set.weight > prev.weight;
    el.classList.toggle("up", up);
    el.title = up ? "Weight is up since last time" : "Result from last workout";
    if (!prev) el.textContent = "";
    else if (up) el.textContent = withWeight ? `↑ was ${formatWeight(prev.weight)}` : "↑";
    else el.textContent = withWeight && !logged.bodyweight ? `last ${prev.reps} × ${formatWeight(prev.weight)}` : `${prev.reps}`;
  }
}

function repsClass(set: LoggedSet): string {
  return set.reps >= set.targetReps ? "done" : "partial";
}
