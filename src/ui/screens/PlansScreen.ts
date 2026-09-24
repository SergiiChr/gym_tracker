import { newId } from "../../model/presets";
import type { App } from "../App";
import { swipeToDelete } from "../components/gestures";
import { confirmDelete, emptyState, page, plusButton } from "../components/layout";
import { group, row } from "../components/list";
import { h, svg } from "../dom";
import { MODE_LABELS } from "../format";
import { ICONS } from "../icons";
import type { Screen } from "../Router";

export class PlansScreen implements Screen {
  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const { store } = this.app;
    const defaultId = store.defaultPlan()?.id;
    const rows = store.data.plans.map((plan) =>
      swipeToDelete(
        row({
          title: plan.name,
          subtitle: `${plan.days.length} days · ${MODE_LABELS[plan.mode]}`,
          detail: plan.id === defaultId ? h("span", { className: "star", title: "Default plan" }, svg(ICONS.star)) : undefined,
          href: `/plans/${plan.id}`,
          tip: "Edit plan. Swipe left to delete",
        }),
        () => confirmDelete(`plan "${plan.name}"`) && (store.deletePlan(plan.id), this.app.commit()),
      ),
    );
    const add = plusButton("Add a new plan", () => {
      const plan = { id: newId(), name: "New plan", mode: "fixed" as const, days: [] };
      store.data.plans.push(plan);
      store.save();
      this.app.router.go(`/plans/${plan.id}`);
    });
    return page("Workout plans", { back: "/", action: add }, rows.length ? group(null, rows) : emptyState("No plans yet. Tap + to add one."));
  }
}
