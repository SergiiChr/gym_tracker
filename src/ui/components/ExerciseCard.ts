import type { Exercise, LoggedExercise, LoggedSet, PlanMode, Unit } from "../../model/types";
import { formatWeight } from "../../model/units";
import { addPlannedSet, addSet, cycleReps, isComplete, removePlannedSet, resetSet } from "../../services/workout";
import { h, svg, type Child } from "../dom";
import { schemeText } from "../format";
import { ICONS } from "../icons";
import { makeSortable, moveItem, onHold, swipeToDelete } from "./gestures";
import { confirmDelete } from "./layout";
import { numberInput } from "./forms";
import { dragHandle } from "./list";
import { actionSheet, confirmDialog, scopeSheet } from "./popups";
import { weightInput } from "./stepper";

export interface CardHost {
  mode: PlanMode;
  unit: Unit;
  step: number;
  previous(logged: LoggedExercise, set: LoggedSet): LoggedSet | undefined;
  onSetDone(logged: LoggedExercise): void;
  /** The saved exercise that permanent set changes go to; undefined once it was deleted from the exercise list. */
  exercise(logged: LoggedExercise): Exercise | undefined;
  /** Name of the plan day the exercise can be removed from permanently; undefined when the day no longer has it. */
  planDay(logged: LoggedExercise): string | undefined;
  /** Drops the exercise from the workout data, and from the plan day too when `permanent`; the card removes its own element. */
  remove(logged: LoggedExercise, permanent: boolean): void;
  /** Every exercise of the logged exercise's group, itself included. */
  alternatives(logged: LoggedExercise): Exercise[];
  /** Puts a fresh entry for another exercise of the group in place of `logged` and returns it. */
  swap(logged: LoggedExercise, exercise: Exercise): LoggedExercise;
  save(): void;
}

/** Long enough to tap the last circle down to the reps actually done before the card folds away. */
const COLLAPSE_DELAY_MS = 4000;
const FOLD_MS = 220;
/** Long, so a set isn't reset by a hold meant as a tap; the number erases over the same time. */
const RESET_HOLD_MS = 3000;
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
  private readonly summary: HTMLElement;
  private body: HTMLElement = h("div");
  private collapseTimer: number | undefined;

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
    this.summary = h("summary", { title: "Tap to collapse or expand" }, dragHandle(), this.head, swap, h("span", { className: "card-check", title: "All sets done" }, svg(ICONS.check)));
    this.element = h("details", { className: "card", open: !isComplete(logged) }, this.summary, this.body);
    this.refresh();
  }

  /** Rebuilds the body, e.g. after sets were added, removed or moved. */
  private refresh(body = this.buildBody()): void {
    this.title.textContent = this.logged.name;
    this.body.replaceWith(body);
    this.body = body;
    this.updateDetail();
    this.element.classList.toggle("complete", isComplete(this.logged));
  }

  private buildBody(): HTMLElement {
    return this.host.mode === "fixed" ? this.fixedBody() : this.perSetBody();
  }

  /** Same weight cards leave the header to the title: the body already shows the weight and every set. */
  private updateDetail(): void {
    if (this.host.mode === "fixed") return;
    const count = this.logged.sets.length;
    this.detail.textContent = `${count} ${count === 1 ? "set" : "sets"}`;
  }

  /** Called after any change to a set's state; collapses the card a while after the last change that leaves every set done. */
  private changed(becameDone: boolean): void {
    this.host.save();
    if (becameDone) this.host.onSetDone(this.logged);
    const complete = isComplete(this.logged);
    this.element.classList.toggle("complete", complete);
    window.clearTimeout(this.collapseTimer);
    if (complete) this.collapseTimer = window.setTimeout(() => (this.element.open = false), COLLAPSE_DELAY_MS);
  }

  /** Same weight style: one weight, tap circles to log reps. */
  private fixedBody(): HTMLElement {
    const { logged, host } = this;
    const circles = logged.sets.map((set) => {
      const prev = h("span", { className: "set-prev" });
      const circle = h("button", { type: "button", className: "circle", title: "Tap to log reps; tap again for one rep less; hold to reset" });
      const paint = (): void => {
        circle.replaceChildren(h("span", { className: "circle-reps" }, set.reps));
        circle.className = `circle ${set.done ? repsClass(set) : "todo"}`;
        this.paintHint(prev, set);
      };
      onHold(circle, () => {
        resetSet(set);
        paint();
        this.changed(false);
      }, RESET_HOLD_MS);
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
          { className: "card-weight", title: "Working weight for all sets" },
          weightInput(logged.sets[0]?.weight ?? 0, host.step, host.unit, (value) => {
            for (const set of logged.sets) set.weight = value;
            circles.forEach((c) => c.paint());
            host.save();
          }),
        );
    const addCircle = h("button", { type: "button", className: "circle circle-add", title: "Add a set", ariaLabel: "Add set", onclick: () => this.addSet() }, svg(ICONS.plus));
    const removeLast =
      logged.sets.length > 0
        ? h("button", { type: "button", className: "chip", title: "Remove the last set from this workout", onclick: () => this.removeSet(logged.sets.length - 1) }, svg(ICONS.minus), "Set")
        : null;
    return h(
      "div",
      { className: "card-body" },
      weightRow,
      h("div", { className: "circles" }, ...circles.map((c) => c.cell), h("div", { className: "set-cell" }, addCircle)),
      this.actions(removeLast),
    );
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
    const addSet = h("button", { type: "button", className: "chip", title: "Add a set to this workout", onclick: () => this.addSet() }, svg(ICONS.plus), "Set");
    return h("div", { className: "card-body" }, list, this.actions(addSet));
  }

  /** Set buttons on the left and remove exercise on the right, in one row at the bottom of the card. */
  private actions(...buttons: Child[]): HTMLElement {
    return h(
      "div",
      { className: "card-actions" },
      ...buttons,
      h(
        "button",
        { type: "button", className: "chip chip-danger", title: "Remove this exercise from this workout", ariaLabel: "Remove exercise", onclick: () => this.remove() },
        svg(ICONS.trash),
      ),
    );
  }

  private addSet(): void {
    const { logged, host } = this;
    const exercise = host.exercise(logged);
    const add = (permanent: boolean): void => {
      if (permanent && exercise) addPlannedSet(logged, exercise, host.mode);
      else addSet(logged);
      host.save();
      this.refresh();
    };
    if (!exercise) return add(false);
    scopeSheet("Add a set", `Future ${exercise.name} workouts get it too`, add);
  }

  /** A set added during this workout isn't planned, so it can only be deleted from this workout. */
  private removeSet(index: number): void {
    const { logged, host } = this;
    const exercise = host.exercise(logged);
    const remove = (permanent: boolean): void => {
      if (permanent && exercise) removePlannedSet(logged, index, exercise, host.mode);
      else logged.sets.splice(index, 1);
      host.save();
      this.refresh();
    };
    if (!exercise || logged.sets[index]?.planIndex === null) return confirmDelete(`set ${index + 1} from this workout`, () => remove(false));
    scopeSheet(`Delete set ${index + 1}?`, `Future ${exercise.name} workouts won't have it either`, remove, true);
  }

  private remove(): void {
    const { logged, host } = this;
    const remove = (permanent: boolean): void => {
      host.remove(logged, permanent);
      this.element.remove();
    };
    const day = host.planDay(logged);
    if (!day) return confirmDelete(`${logged.name} from this workout`, () => remove(false));
    scopeSheet(`Delete ${logged.name}?`, `Also removes it from ${day}`, remove, true);
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

  /**
   * Folds the sets away, rolls the title over to the next exercise, then opens its sets.
   * The next sets are built before anything moves, so no frame mid-animation waits on that work.
   */
  private async swapTo(exercise: Exercise): Promise<void> {
    this.element.classList.add("swapping");
    this.logged = this.host.swap(this.logged, exercise);
    const body = this.buildBody();
    if (this.element.open) await this.fold(false);
    await play(this.head, [{ transform: "none", opacity: 1 }, { transform: FLIP_OUT, opacity: 0 }], FLIP_MS);
    this.refresh(body);
    await play(this.head, [{ transform: FLIP_IN, opacity: 0 }, { transform: "none", opacity: 1 }], FLIP_MS);
    await this.fold(true);
    this.element.classList.remove("swapping");
  }

  /**
   * Opens or closes the sets without animating height, which would lay out the page on every frame.
   * The card is clipped and everything below it slides by transform; the layout changes once, where the animation ends.
   */
  private async fold(open: boolean): Promise<void> {
    if (open) this.element.open = true;
    const gap = this.element.offsetHeight - this.summary.offsetHeight;
    const round = getComputedStyle(this.element).borderRadius;
    // Closing plays forwards; opening plays the same animations in reverse, from closed to open.
    const direction = open ? "reverse" : "normal";
    await Promise.all([
      play(this.element, [{ clipPath: `inset(0 0 0 0 round ${round})` }, { clipPath: `inset(0 0 ${gap}px 0 round ${round})` }], FOLD_MS, direction),
      play(this.body, [{ opacity: 1 }, { opacity: 0 }], FOLD_MS, direction),
      ...following(this.element).map((el) => play(el, [{ transform: "none" }, { transform: `translateY(${-gap}px)` }], FOLD_MS, direction)),
    ]);
    if (!open) this.element.open = false;
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
function play(el: Element, keyframes: Keyframe[], duration: number, direction: PlaybackDirection = "normal"): Promise<unknown> {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return el.animate(keyframes, { duration, direction, easing: "ease-in-out" }).finished;
}

/** Everything laid out after `el` on the page, which moves when its height changes. */
function following(el: Element): Element[] {
  const result: Element[] = [];
  for (let node: Element | null = el; node && !node.matches(".content"); node = node.parentElement) {
    for (let next = node.nextElementSibling; next; next = next.nextElementSibling) result.push(next);
  }
  return result;
}

function repsClass(set: LoggedSet): string {
  return set.reps >= set.targetReps ? "done" : "partial";
}
