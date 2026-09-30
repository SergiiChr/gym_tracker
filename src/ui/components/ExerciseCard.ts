import type { Exercise, LoggedExercise, LoggedSet, PlanMode, Unit } from "../../model/types";
import { formatWeight } from "../../model/units";
import { addSet, cycleReps, isComplete } from "../../services/workout";
import { h, svg, type Child } from "../dom";
import { repsText, schemeText } from "../format";
import { ICONS } from "../icons";
import { makeSortable, moveItem, swipeToDelete } from "./gestures";
import { confirmDelete } from "./layout";
import { numberInput } from "./forms";
import { dragHandle } from "./list";
import { actionSheet, confirmDialog } from "./popups";
import { weightInput } from "./stepper";

export interface CardHost {
  mode: PlanMode;
  unit: Unit;
  step: number;
  previous(logged: LoggedExercise, set: LoggedSet): LoggedSet | undefined;
  onSetDone(logged: LoggedExercise): void;
  /** Drops the exercise from the workout data; the card removes its own element. */
  remove(logged: LoggedExercise): void;
  /** Every exercise of the logged exercise's group, itself included. */
  alternatives(logged: LoggedExercise): Exercise[];
  /** Puts a fresh entry for another exercise of the group in place of `logged` and returns it. */
  swap(logged: LoggedExercise, exercise: Exercise): LoggedExercise;
  save(): void;
}

const COLLAPSE_DELAY_MS = 500;
const FOLD_MS = 220;
const FLIP_MS = 260;
/** The title turns like a drum rolling toward the viewer: the old one goes down and away, the next one comes over the top. */
const FLIP_OUT = "perspective(400px) translateY(60%) rotateX(-90deg)";
const FLIP_IN = "perspective(400px) translateY(-60%) rotateX(90deg)";

/**
 * One exercise in a running workout. Changes to its sets only touch this workout, not the plan.
 * Unfinished sets carry the `todo` class so the screen can find the next one.
 */
export class ExerciseCard {
  readonly element: HTMLDetailsElement;
  private readonly title = h("span", { className: "card-title" });
  private readonly detail = h("span", { className: "card-detail" });
  private readonly head = h("span", { className: "card-head" }, this.title, this.detail);
  private body: HTMLElement = h("div");

  constructor(
    private logged: LoggedExercise,
    private readonly host: CardHost,
  ) {
    const swap =
      (logged.group?.length ?? 0) > 1
        ? h(
            "button",
            {
              type: "button",
              className: "card-swap",
              title: "Swap for another exercise of this group",
              ariaLabel: "Swap exercise",
              onclick: (e: MouseEvent) => {
                e.preventDefault(); // Keeps the card from toggling.
                this.chooseSwap();
              },
            },
            svg(ICONS.swap),
          )
        : null;
    this.element = h(
      "details",
      { className: "card", open: !isComplete(logged) },
      h("summary", { title: "Tap to collapse or expand" }, dragHandle(), this.head, swap, h("span", { className: "card-check", title: "All sets done" }, svg(ICONS.check))),
      this.body,
    );
    this.refresh();
  }

  /** Rebuilds the body, e.g. after sets were added, removed or moved. */
  private refresh(): void {
    this.title.textContent = this.logged.name;
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
      const reps = first?.minReps === undefined ? String(first?.targetReps ?? 0) : repsText(first.minReps, first.targetReps);
      this.detail.textContent = `${sets.length}×${reps}${load}`;
    } else {
      this.detail.textContent = `${sets.length} ${sets.length === 1 ? "set" : "sets"}`;
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
        this.paintHint(prev, set);
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
    const removeLast =
      logged.sets.length > 0
        ? h("button", { type: "button", className: "chip", title: "Remove the last set from this workout", onclick: () => this.removeSet(logged.sets.length - 1) }, svg(ICONS.minus), "Set")
        : null;
    return h("div", { className: "card-body" }, weightRow, h("div", { className: "circles" }, ...circles.map((c) => c.cell)), this.actions(removeLast));
  }

  /** Weight per set style: a table of sets with last time's result, plain number cells and a done checkbox. */
  private perSetBody(): HTMLElement {
    const { logged, host } = this;
    const numbered = logged.sets.length > 1;
    const layout = logged.bodyweight ? "set-row no-weight" : "set-row";
    const head = h(
      "li",
      { className: `set-head ${layout}` },
      h("span", {}, "Set"),
      h("span", {}, "Last"),
      logged.bodyweight ? null : h("span", {}, host.unit),
      h("span", {}, "Reps"),
      h("span", {}),
    );
    const rows = logged.sets.map((set, i) => {
      const last = h("span", { className: "set-last" });
      const check = h("button", { type: "button", className: "set-check", ariaLabel: "Done" }, svg(ICONS.check));
      // Editing numbers doesn't complete the set: it's often done ahead of the set. Only the checkbox does.
      const reps = numberInput({
        value: set.reps,
        label: "Reps",
        className: "num-cell",
        onChange: (value) => {
          set.reps = value;
          paint();
          host.save();
        },
      });
      const weight = logged.bodyweight
        ? null
        : numberInput({
            value: set.weight,
            decimal: true,
            label: `Weight in ${host.unit}`,
            className: "num-cell",
            onChange: (value) => {
              set.weight = value;
              paint();
              host.save();
            },
          });
      // The set number doubles as the drag handle.
      const num = h("span", { className: "set-num drag-handle", title: "Drag to reorder" }, numbered ? String(i + 1) : "");
      const li = h("li", { className: "row set-li" }, h("div", { className: `row-content ${layout}` }, num, last, weight, reps, check));
      const paint = (): void => {
        reps.className = `num-cell ${set.done ? repsClass(set) : ""}`;
        check.classList.toggle("on", set.done);
        check.title = set.done ? "Done. Tap to undo" : "Mark set as done";
        li.classList.toggle("todo", !set.done);
        li.classList.toggle("done", set.done);
        this.paintLast(last, set);
      };
      check.addEventListener("click", () => {
        set.done = !set.done;
        paint();
        this.changed(set.done);
      });
      paint();
      return swipeToDelete(li, () => this.removeSet(i));
    });
    const list = h("ul", { className: "list set-list" }, head, ...rows);
    makeSortable(list, (from, to) => {
      moveItem(logged.sets, from, to);
      host.save();
      this.refresh();
    });
    return h("div", { className: "card-body" }, list, this.actions());
  }

  /** Add set, optional extra buttons and remove exercise, in one row at the bottom of the card. */
  private actions(...extra: Child[]): HTMLElement {
    return h(
      "div",
      { className: "card-actions" },
      h("button", { type: "button", className: "chip", title: "Add a set to this workout", onclick: () => this.addSet() }, svg(ICONS.plus), "Set"),
      ...extra,
      h(
        "button",
        { type: "button", className: "chip chip-danger", title: "Remove this exercise from this workout", ariaLabel: "Remove exercise", onclick: () => this.remove() },
        svg(ICONS.trash),
      ),
    );
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

  private remove(): void {
    confirmDelete(`${this.logged.name} from this workout`, () => {
      this.host.remove(this.logged);
      this.element.remove();
    });
  }

  /** Swaps right away when the group has one other exercise, otherwise asks which one. */
  private chooseSwap(): void {
    if (this.element.classList.contains("swapping")) return;
    const { host, logged } = this;
    const others = host.alternatives(logged).filter((e) => e.id !== logged.exerciseId);
    const [only] = others;
    if (others.length === 1 && only) {
      this.confirmSwap(only);
      return;
    }
    actionSheet(
      "Swap exercise",
      others.map((e) => ({ label: e.name, subtitle: schemeText(e.schemes[host.mode], e.bodyweight, host.unit), onSelect: () => this.confirmSwap(e) })),
      { subtitle: `Instead of ${logged.name}` },
    );
  }

  /** Logged sets belong to the exercise being swapped out, so they are dropped with it. */
  private confirmSwap(exercise: Exercise): void {
    if (!this.logged.sets.some((s) => s.done)) {
      void this.swapTo(exercise);
      return;
    }
    confirmDialog({
      title: `Swap to ${exercise.name}?`,
      message: `Sets logged for ${this.logged.name} will be discarded.`,
      action: "Swap",
      destructive: true,
      onConfirm: () => void this.swapTo(exercise),
    });
  }

  /** Folds the sets away, rolls the title over to the next exercise, then opens its sets. */
  private async swapTo(exercise: Exercise): Promise<void> {
    this.element.classList.add("swapping");
    const next = this.host.swap(this.logged, exercise);
    if (this.element.open) {
      await play(this.body, [{ height: `${this.body.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], FOLD_MS);
      this.element.open = false;
    }
    await play(this.head, [{ transform: "none", opacity: 1 }, { transform: FLIP_OUT, opacity: 0 }], FLIP_MS);
    this.logged = next;
    this.refresh();
    await play(this.head, [{ transform: FLIP_IN, opacity: 0 }, { transform: "none", opacity: 1 }], FLIP_MS);
    this.element.open = true;
    await play(this.body, [{ height: "0px", opacity: 0 }, { height: `${this.body.offsetHeight}px`, opacity: 1 }], FOLD_MS);
    this.element.classList.remove("swapping");
  }

  /** Last time's reps under a circle; green ↑ when today's weight is higher. */
  private paintHint(el: HTMLElement, set: LoggedSet): void {
    const prev = this.host.previous(this.logged, set);
    const up = prev !== undefined && !this.logged.bodyweight && set.weight > prev.weight;
    el.classList.toggle("up", up);
    el.title = up ? "Weight is up since last time" : "Reps from last workout";
    el.textContent = prev ? (up ? "↑" : String(prev.reps)) : "";
  }

  /** Last time's weight × reps for this planned set; green ↑ when today's weight is higher. */
  private paintLast(el: HTMLElement, set: LoggedSet): void {
    const prev = this.host.previous(this.logged, set);
    const up = prev !== undefined && !this.logged.bodyweight && set.weight > prev.weight;
    el.classList.toggle("up", up);
    el.title = up ? "Weight is up since last time" : "Last workout";
    if (!prev) el.textContent = "–";
    else el.textContent = `${up ? "↑ " : ""}${this.logged.bodyweight ? prev.reps : `${formatWeight(prev.weight)} × ${prev.reps}`}`;
  }
}

/** Resolves when the animation ends; the next step runs before the browser paints the end state, so nothing flickers. */
function play(el: Element, keyframes: Keyframe[], duration: number): Promise<unknown> {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return el.animate(keyframes, { duration, easing: "ease-in-out" }).finished;
}

function repsClass(set: LoggedSet): string {
  return set.reps >= set.targetReps ? "done" : "partial";
}
