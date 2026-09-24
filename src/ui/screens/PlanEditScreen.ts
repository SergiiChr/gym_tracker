import { newId } from "../../model/presets";
import type { PlanMode } from "../../model/types";
import type { App } from "../App";
import { segmentedRow, textRow, toggleRow } from "../components/forms";
import { makeSortable, moveItem, swipeToDelete } from "../components/gestures";
import { confirmDelete, emptyState, page } from "../components/layout";
import { actionRow, dragHandle, group, row } from "../components/list";
import { MODE_LABELS } from "../format";
import type { Screen } from "../Router";

export class PlanEditScreen implements Screen {
  constructor(
    private readonly app: App,
    private readonly planId: string,
  ) {}

  render(): HTMLElement {
    const { store, router } = this.app;
    const plan = store.plan(this.planId);
    if (!plan) return page("Plan", { back: "/plans" }, emptyState("Plan not found."));
    const modes = (Object.keys(MODE_LABELS) as PlanMode[]).map((value) => ({ value, label: MODE_LABELS[value] }));

    const dayRows = plan.days.map((day) =>
      swipeToDelete(
        row({
          title: day.name,
          subtitle: `${day.exerciseIds.length} exercises`,
          leading: dragHandle(),
          href: `/plans/${plan.id}/days/${day.id}`,
          tip: "Edit day. Drag the handle to reorder, swipe left to delete",
        }),
        () =>
          confirmDelete(`day "${day.name}"`, () => {
            plan.days = plan.days.filter((d) => d !== day);
            this.app.commit();
          }),
      ),
    );
    const addDay = actionRow("Add day", "Add a workout day to this plan", () => {
      const day = { id: newId(), name: `Day ${plan.days.length + 1}`, exerciseIds: [] };
      plan.days.push(day);
      store.save();
      router.go(`/plans/${plan.id}/days/${day.id}`);
    });
    const days = group("Days", [...dayRows, addDay], "Workouts rotate through the days in this order.");
    makeSortable(days.querySelector("ul")!, (from, to) => {
      moveItem(plan.days, from, to);
      store.save();
    });

    return page(
      plan.name,
      { back: "/plans" },
      group(null, [
        textRow("Name", plan.name, (name) => ((plan.name = name), this.app.commit())),
        toggleRow(
          "Default plan",
          store.defaultPlan()?.id === plan.id,
          (on) => ((store.data.defaultPlanId = on ? plan.id : null), this.app.commit()),
          "The plan used by Start a workout",
        ),
      ]),
      group(
        "Logging style",
        [segmentedRow(modes, plan.mode, (mode) => ((plan.mode = mode), this.app.commit()), "How sets are logged during a workout")],
        "Same weight: one weight per exercise, tap circles to log reps (StrongLifts style). Weight per set: reps and weight for every set.",
      ),
      days,
      group(null, [
        actionRow(
          "Delete plan",
          "Delete this plan. Exercises and history are kept",
          () =>
            confirmDelete(`plan "${plan.name}"`, () => {
              store.deletePlan(plan.id);
              router.go("/plans");
            }),
          true,
        ),
      ]),
    );
  }
}
