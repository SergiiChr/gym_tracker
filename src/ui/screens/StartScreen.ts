import { nextDay } from "../../services/progression";
import { createWorkout } from "../../services/workout";
import type { App } from "../App";
import { bottomButton, emptyState, navButton, page } from "../components/layout";
import { group, row } from "../components/list";
import { h } from "../dom";
import { MODE_LABELS } from "../format";
import { actionSheet, confirmDialog } from "../components/popups";
import type { Screen } from "../Router";

export class StartScreen implements Screen {
  private selectedDayId: string | undefined;

  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const { store } = this.app;
    const plan = store.defaultPlan();
    const changePlan = navButton("Change plan", "Switch to another workout plan", () => this.pickPlan());
    if (!plan || plan.days.length === 0) {
      return page("Start workout", { back: "/", action: changePlan }, emptyState("Add a plan with at least one day in Workout plans."));
    }

    const startButton = bottomButton("", "Start the selected workout day", () => this.start());
    const select = (dayId: string | undefined): void => {
      this.selectedDayId = dayId;
      const day = plan.days.find((d) => d.id === dayId);
      startButton.textContent = day ? `Start ${day.name}` : "Start";
      rows.forEach((r, i) => r.classList.toggle("selected", plan.days[i]!.id === dayId));
    };
    const rows = plan.days.map((day) => {
      const names = day.exerciseIds.map((id) => store.exercise(id)?.name).filter(Boolean);
      return row({
        title: day.name,
        subtitle: names.join(", ") || "No exercises",
        leading: h("span", { className: "radio" }),
        className: "selectable",
        tip: "Select this day",
        onClick: () => select(day.id),
      });
    });
    select(nextDay(plan, store.data)?.id);

    return h(
      "div",
      {},
      page("Start workout", { back: "/", action: changePlan }, group(`${plan.name} · ${MODE_LABELS[plan.mode]}`, rows, "Next day in order is pre-selected.")),
      startButton,
    );
  }

  private pickPlan(): void {
    const { store } = this.app;
    const current = store.defaultPlan()?.id;
    actionSheet(
      "Workout plan",
      store.data.plans.map((p) => ({
        label: p.name,
        subtitle: `${p.days.length} days · ${MODE_LABELS[p.mode]}`,
        selected: p.id === current,
        onSelect: () => {
          store.data.defaultPlanId = p.id;
          this.app.commit();
        },
      })),
    );
  }

  private start(): void {
    const { store, router } = this.app;
    const plan = store.defaultPlan();
    const day = plan?.days.find((d) => d.id === this.selectedDayId);
    if (!plan || !day) return;
    const start = (): void => {
      store.data.activeWorkout = createWorkout(store.data, plan, day);
      store.save();
      router.go("/workout");
    };
    if (!store.data.activeWorkout) return start();
    confirmDialog({
      title: "Discard current workout?",
      message: "A workout is already in progress. Starting a new one discards it.",
      action: "Discard",
      destructive: true,
      onConfirm: start,
    });
  }
}
