import { newExercise } from "../../model/presets";
import type { Exercise, LoggedExercise, PlanDay, WorkoutLog } from "../../model/types";
import { applyOrderToDay, durationMinutes, finishWorkout, hasUnfinishedSets, logExercise, previousSet, swapExercise } from "../../services/workout";
import type { App } from "../App";
import { ExerciseCard, type CardHost } from "../components/ExerciseCard";
import { exercisePicker } from "../components/exercisePicker";
import { makeSortable, moveItem } from "../components/gestures";
import { emptyState, fab, page } from "../components/layout";
import { actionRow, group } from "../components/list";
import { actionSheet, confirmDialog } from "../components/popups";
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
  private readonly cards = h("div");
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
      remove: (logged) => {
        workout.exercises = workout.exercises.filter((e) => e !== logged);
        store.save();
      },
      alternatives: (logged) => (logged.group ?? []).flatMap((id) => store.exercise(id) ?? []),
      swap: (logged, exercise) => {
        const next = swapExercise(logged, exercise, workout.mode);
        workout.exercises[workout.exercises.indexOf(logged)] = next;
        store.save();
        return next;
      },
      save: () => store.save(),
    };
    this.cards.append(...workout.exercises.map((ex) => new ExerciseCard(ex, host).element));
    makeSortable(this.cards, (from, to) => {
      moveItem(workout.exercises, from, to);
      store.save();
      this.askToSavePlan(workout, "Save new order to plan?", "Save", (day) => applyOrderToDay(workout, day));
    });
    const add = actionRow("Add exercise", "Add an existing or new exercise", () => this.pickExercise(workout, host));
    this.root.append(
      page(workout.dayName, { back: "/", action: elapsed }, h("p", { className: "page-note" }, workout.planName), this.cards, group(null, [add])),
      this.timer.element,
      fab(ICONS.finish, "Finish or discard the workout", () => this.finishSheet(workout)),
    );
    return this.root;
  }

  dispose(): void {
    window.clearInterval(this.clock);
    this.timer.stop();
  }

  /** Anything not in the workout can be added, including exercises dropped from it earlier. */
  private pickExercise(workout: WorkoutLog, host: CardHost): void {
    const { store } = this.app;
    const inWorkout = new Set(workout.exercises.map((e) => e.exerciseId));
    const add = (exercise: Exercise): void => {
      const logged = logExercise(exercise, workout.mode);
      workout.exercises.push(logged);
      store.save();
      const card = new ExerciseCard(logged, host).element;
      this.cards.append(card);
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      this.askToSavePlan(workout, `Add ${exercise.name} to plan too?`, "Add", (day) => {
        if (!day.slots.some((slot) => slot.includes(exercise.id))) day.slots.push([exercise.id]);
      });
    };
    exercisePicker(
      store.data.exercises.filter((e) => !inWorkout.has(e.id)),
      workout.mode,
      store.data.settings.unit,
      add,
      (name) => {
        // A brand new exercise always goes to the exercise list, whatever is chosen for the plan.
        const exercise = newExercise(store.data.settings, name);
        store.data.exercises.push(exercise);
        add(exercise);
      },
    );
  }

  /** Changes already apply to this workout; offers to copy them to the plan day the workout came from. */
  private askToSavePlan(workout: WorkoutLog, question: string, action: string, update: (day: PlanDay) => void): void {
    const { store } = this.app;
    const day = store.plan(workout.planId)?.days.find((d) => d.id === workout.dayId);
    if (!day) return;
    confirmDialog({
      title: question,
      message: "It already applies to this workout.",
      action,
      cancel: "Not now",
      onConfirm: () => {
        update(day);
        store.save();
      },
    });
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
    const sets = workout.exercises.flatMap((e) => e.sets);
    const subtitle = `${workout.planName} · ${durationMinutes(workout)} min · ${sets.filter((s) => s.done).length} of ${sets.length} sets done`;
    actionSheet(workout.dayName, [
      {
        label: "Finish workout",
        icon: ICONS.finish,
        onSelect: () => {
          const finish = (): void => {
            finishWorkout(store.data, workout);
            store.save();
            router.go(`/finished/${workout.id}`, true);
          };
          if (!hasUnfinishedSets(workout)) return finish();
          confirmDialog({ title: "Finish workout?", message: "Unfinished sets will be discarded.", action: "Finish", onConfirm: finish });
        },
      },
      {
        label: "Discard workout",
        icon: ICONS.trash,
        destructive: true,
        onSelect: () =>
          confirmDialog({
            title: "Discard workout?",
            message: "Logged sets will be lost.",
            action: "Discard",
            destructive: true,
            onConfirm: () => {
              store.data.activeWorkout = null;
              store.save();
              router.go("/");
            },
          }),
      },
    ], { subtitle });
  }
}
