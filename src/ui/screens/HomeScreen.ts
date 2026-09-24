import { nextDay } from "../../services/progression";
import type { App } from "../App";
import { fab, page } from "../components/layout";
import { group, row } from "../components/list";
import { h, svg } from "../dom";
import { ICONS } from "../icons";
import type { Screen } from "../Router";

export class HomeScreen implements Screen {
  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const { store } = this.app;
    const active = store.data.activeWorkout;
    const plan = store.defaultPlan();
    const next = plan && nextDay(plan, store.data);
    const icon = (markup: string, color: string): HTMLElement => h("span", { className: `row-icon ${color}` }, svg(markup));

    const startRow = active
      ? row({ title: "Resume workout", subtitle: `${active.planName} · ${active.dayName}`, href: "/workout", leading: icon(ICONS.play, "green"), tip: "Continue the workout in progress" })
      : row({ title: "Start a workout", subtitle: next ? `Next: ${plan.name} · ${next.name}` : "No plan yet", href: "/start", leading: icon(ICONS.play, "green"), tip: "Pick a workout day and start it" });

    return h(
      "div",
      {},
      page(
        "Gym Tracker",
        { largeTitle: true },
        group(null, [startRow]),
        group(null, [
          row({ title: "Workout history", href: "/history", leading: icon(ICONS.history, "orange"), tip: "Past workouts with all sets and reps" }),
          row({ title: "Workout plans", href: "/plans", leading: icon(ICONS.plans, "blue"), tip: "Create and edit plans and their days" }),
          row({ title: "Exercises", href: "/exercises", leading: icon(ICONS.dumbbell, "purple"), tip: "Exercise presets: sets, reps, weights, auto-increment" }),
          row({ title: "Settings", href: "/settings", leading: icon(ICONS.settings, "gray"), tip: "Units, defaults, auto-increment, backup" }),
        ]),
      ),
      fab(ICONS.play, active ? "Resume workout" : "Start a workout", () => this.app.router.go(active ? "/workout" : "/start")),
    );
  }
}
