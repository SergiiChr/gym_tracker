import { formatWeight } from "../../model/units";
import type { LoggedExercise, LoggedSet, WorkoutLog } from "../../model/types";
import { cycleReps, durationMinutes, finishWorkout, previousSet } from "../../services/workout";
import type { App } from "../App";
import { actionSheet, confirmSheet } from "../components/actionSheet";
import { emptyState, fab, page } from "../components/layout";
import { RestTimer } from "../components/RestTimer";
import { weightInput } from "../components/weightInput";
import { h } from "../dom";
import { ICONS } from "../icons";
import type { Screen } from "../Router";

/**
 * Updates its DOM in place instead of re-rendering, so open/closed cards, focus and the rest timer survive each tap.
 */
export class WorkoutScreen implements Screen {
  private readonly timer = new RestTimer();
  private clock: number | undefined;

  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const workout = this.app.store.data.activeWorkout;
    if (!workout) return page("Workout", { back: "/" }, emptyState("No workout in progress."));

    const elapsed = h("span", { className: "nav-note", title: "Workout duration" });
    const tick = (): void => void (elapsed.textContent = `${durationMinutes(workout)} min`);
    tick();
    this.clock = window.setInterval(tick, 30000);

    const cards = workout.exercises.map((ex) => this.card(workout, ex));
    return h(
      "div",
      {},
      page(workout.dayName, { back: "/", action: elapsed }, h("p", { className: "page-note" }, workout.planName), ...cards),
      this.timer.element,
      fab(ICONS.flag, "Finish or discard the workout", () => this.finishSheet(workout)),
    );
  }

  dispose(): void {
    window.clearInterval(this.clock);
    this.timer.stop();
  }

  private card(workout: WorkoutLog, logged: LoggedExercise): HTMLElement {
    const summary = h("span", { className: "card-detail" });
    const body = workout.mode === "fixed" ? this.fixedBody(logged, summary) : this.perSetBody(logged, summary);
    return h(
      "details",
      { className: "card", open: true },
      h("summary", { title: "Tap to collapse or expand" }, h("span", { className: "card-title" }, logged.name), summary),
      body,
    );
  }

  /** Stronglifts style: one weight, tap circles to log reps. */
  private fixedBody(logged: LoggedExercise, summary: HTMLElement): HTMLElement {
    const unit = this.app.store.data.settings.unit;
    const circles = logged.sets.map((set, i) => {
      const prev = h("span", { className: "set-prev" });
      const circle = h("button", { type: "button", className: "circle", title: "Tap to log reps; tap again for one rep less" });
      const update = (): void => {
        circle.textContent = String(set.reps ?? set.targetReps);
        circle.className = `circle ${repsClass(set)}`;
        this.updateHint(prev, logged, set, i, false);
      };
      circle.addEventListener("click", () => {
        const wasEmpty = set.reps === null;
        cycleReps(set);
        update();
        this.save();
        if (wasEmpty) this.startRest(logged);
      });
      update();
      return { cell: h("div", { className: "set-cell" }, circle, prev), update };
    });
    const updateSummary = (): void => {
      const first = logged.sets[0];
      const load = logged.bodyweight || !first ? "" : ` · ${formatWeight(first.weight)} ${unit}`;
      summary.textContent = `${logged.sets.length}×${first?.targetReps ?? 0}${load}`;
    };
    updateSummary();

    const weightRow = logged.bodyweight
      ? null
      : h(
          "div",
          { className: "card-row", title: "Working weight for all sets" },
          h("span", {}, "Weight"),
          weightInput(logged.sets[0]?.weight ?? 0, this.step(), unit, (value) => {
            for (const set of logged.sets) set.weight = value;
            updateSummary();
            circles.forEach((c) => c.update());
            this.save();
          }),
        );
    return h("div", { className: "card-body" }, weightRow, h("div", { className: "circles" }, ...circles.map((c) => c.cell)));
  }

  /** Traditional style: reps and weight inputs per set. */
  private perSetBody(logged: LoggedExercise, summary: HTMLElement): HTMLElement {
    const unit = this.app.store.data.settings.unit;
    summary.textContent = `${logged.sets.length} sets`;
    const rows = logged.sets.map((set, i) => {
      const hint = h("span", { className: "set-prev" });
      const reps = h("input", {
        type: "text",
        inputMode: "numeric",
        pattern: "[0-9]*",
        className: "reps-input",
        placeholder: String(set.targetReps),
        value: set.reps === null ? "" : String(set.reps),
        title: "Reps done. Leave empty if skipped",
        onfocus: () => reps.select(),
        onchange: () => {
          const wasEmpty = set.reps === null;
          const parsed = parseInt(reps.value, 10);
          set.reps = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
          reps.value = set.reps === null ? "" : String(set.reps);
          reps.className = `reps-input ${repsClass(set)}`;
          this.save();
          if (wasEmpty && set.reps !== null) this.startRest(logged);
        },
      });
      reps.className = `reps-input ${repsClass(set)}`;
      this.updateHint(hint, logged, set, i, true);
      const weight = logged.bodyweight
        ? null
        : weightInput(set.weight, this.step(), unit, (value) => {
            set.weight = value;
            this.updateHint(hint, logged, set, i, true);
            this.save();
          });
      return h(
        "div",
        { className: "set-row" },
        h("div", { className: "set-label" }, h("strong", {}, `Set ${i + 1}`), h("span", { className: "set-meta" }, h("span", { title: "Target reps" }, `${set.targetReps} reps`), hint)),
        reps,
        weight,
      );
    });
    return h("div", { className: "card-body" }, ...rows);
  }

  /** Last time's reps for this set; green when today's weight is higher. */
  private updateHint(el: HTMLElement, logged: LoggedExercise, set: LoggedSet, index: number, withWeight: boolean): void {
    const prev = previousSet(this.app.store.data, logged.exerciseId, this.app.store.data.activeWorkout?.mode ?? "fixed", index);
    const up = prev !== undefined && !logged.bodyweight && set.weight > prev.weight;
    el.classList.toggle("up", up);
    el.title = up ? "Weight is up since last time" : "Reps from last workout";
    if (!prev) el.textContent = "";
    else if (up) el.textContent = withWeight ? `↑ was ${formatWeight(prev.weight)}` : "↑";
    else el.textContent = withWeight && !logged.bodyweight ? `last ${prev.reps ?? 0}×${formatWeight(prev.weight)}` : `${prev.reps ?? 0}`;
  }

  private startRest(logged: LoggedExercise): void {
    const { store } = this.app;
    this.timer.start(store.exercise(logged.exerciseId)?.restSec ?? store.data.settings.defaultRestSec);
  }

  private step(): number {
    return this.app.store.data.settings.increment.step;
  }

  private save(): void {
    this.app.store.save();
  }

  private finishSheet(workout: WorkoutLog): void {
    const { store, router } = this.app;
    actionSheet("Workout", [
      {
        label: "Finish workout",
        onSelect: () => {
          const finish = (): void => {
            finishWorkout(store.data, workout);
            store.save();
            router.go(`/history/${workout.id}`);
          };
          const logged = workout.exercises.some((e) => e.sets.some((s) => s.reps !== null));
          if (logged) finish();
          else confirmSheet("No sets logged yet. Finish anyway?", "Finish workout", finish);
        },
      },
      {
        label: "Discard workout",
        destructive: true,
        onSelect: () =>
          confirmSheet("Discard this workout? Logged sets will be lost.", "Discard workout", () => {
            store.data.activeWorkout = null;
            store.save();
            router.go("/");
          }),
      },
    ]);
  }
}

function repsClass(set: LoggedSet): string {
  if (set.reps === null) return "pending";
  return set.reps >= set.targetReps ? "done" : "partial";
}
