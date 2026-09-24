import { nextDay } from "../../services/progression";
import { createWorkout } from "../../services/workout";
import type { App } from "../App";
import { actionSheet, confirmSheet } from "../components/actionSheet";
import { emptyState, fab, navButton, page } from "../components/layout";
import { group, row } from "../components/list";
import { h } from "../dom";
import { MODE_LABELS } from "../format";
import { ICONS } from "../icons";
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
    this.selectedDayId = nextDay(plan, store.data)?.id;

    const rows = plan.days.map((day) => {
      const names = day.exerciseIds.map((id) => store.exercise(id)?.name).filter(Boolean);
      const dayRow = row({
        title: day.name,
        subtitle: names.join(", ") || "No exercises",
        detail: "✓",
        className: day.id === this.selectedDayId ? "selectable selected" : "selectable",
        tip: "Select this day",
        onClick: () => {
          this.selectedDayId = day.id;
          for (const r of list.querySelectorAll(".selectable")) r.classList.toggle("selected", r === dayRow);
        },
      });
      return dayRow;
    });
    const section = group(`${plan.name} · ${MODE_LABELS[plan.mode]}`, rows, "Next day in order is pre-selected.");
    const list = section.querySelector("ul")!;

    return h(
      "div",
      {},
      page("Start workout", { back: "/", action: changePlan }, section),
      fab(ICONS.play, "Start the selected workout day", () => this.start(), "Start"),
    );
  }

  private pickPlan(): void {
    const { store } = this.app;
    actionSheet(
      "Workout plan",
      store.data.plans.map((p) => ({
        label: p.name,
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
    if (store.data.activeWorkout) confirmSheet("A workout is already in progress. Discard it and start a new one?", "Discard and start", start);
    else start();
  }
}
