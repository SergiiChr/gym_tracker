import type { LoggedExercise, WorkoutLog } from "../../model/types";
import { durationMinutes, finishWorkout, hasUnfinishedSets, previousSet } from "../../services/workout";
import type { App } from "../App";
import { actionSheet, confirmSheet } from "../components/actionSheet";
import { ExerciseCard, type CardHost } from "../components/ExerciseCard";
import { emptyState, fab, page } from "../components/layout";
import { RestTimer } from "../components/RestTimer";
import { h } from "../dom";
import { ICONS } from "../icons";
import type { Screen } from "../Router";

const HIGHLIGHT_MS = 1600;

/**
 * Cards update their own DOM instead of the screen re-rendering, so open/closed cards, focus and the rest timer survive each tap.
 */
export class WorkoutScreen implements Screen {
  private readonly timer = new RestTimer(() => this.showNextSet());
  private readonly root = h("div");
  private clock: number | undefined;

  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const { store } = this.app;
    const workout = store.data.activeWorkout;
    if (!workout) return page("Workout", { back: "/" }, emptyState("No workout in progress."));

    const elapsed = h("span", { className: "nav-note", title: "Workout duration" });
    const tick = (): void => void (elapsed.textContent = `${durationMinutes(workout)} min`);
    tick();
    this.clock = window.setInterval(tick, 30000);

    const host: CardHost = {
      mode: workout.mode,
      unit: store.data.settings.unit,
      step: store.data.settings.increment.step,
      previous: (logged, set) => previousSet(store.data, logged.exerciseId, workout.mode, set.planIndex),
      onSetDone: (logged) => this.startRest(logged),
      save: () => store.save(),
    };
    const cards = workout.exercises.map((ex) => new ExerciseCard(ex, host).element);
    this.root.append(
      page(workout.dayName, { back: "/", action: elapsed }, h("p", { className: "page-note" }, workout.planName), ...cards),
      this.timer.element,
      fab(ICONS.flag, "Finish or discard the workout", () => this.finishSheet(workout)),
    );
    return this.root;
  }

  dispose(): void {
    window.clearInterval(this.clock);
    this.timer.stop();
  }

  private startRest(logged: LoggedExercise): void {
    const { store } = this.app;
    this.timer.start(store.exercise(logged.exerciseId)?.restSec ?? store.data.settings.defaultRestSec);
  }

  /** Opens, scrolls to and briefly outlines the first unfinished set. */
  private showNextSet(): void {
    const next = this.root.querySelector<HTMLElement>(".todo");
    if (!next) return;
    const card = next.closest("details");
    if (card) card.open = true;
    next.scrollIntoView({ behavior: "smooth", block: "center" });
    next.classList.remove("highlight");
    void next.offsetWidth; // Restarts the animation when the same set is highlighted twice.
    next.classList.add("highlight");
    setTimeout(() => next.classList.remove("highlight"), HIGHLIGHT_MS);
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
            router.go(`/finished/${workout.id}`, true);
          };
          if (hasUnfinishedSets(workout)) confirmSheet("You have unfinished sets, they will be discarded.", "OK", finish);
          else finish();
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
