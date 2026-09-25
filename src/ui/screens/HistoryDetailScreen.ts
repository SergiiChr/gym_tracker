import { formatWeight } from "../../model/units";
import { durationMinutes } from "../../services/workout";
import type { App } from "../App";
import { confirmDelete, emptyState, fab, page } from "../components/layout";
import { actionRow, group, row } from "../components/list";
import { formatDate, h } from "../dom";
import { ICONS } from "../icons";
import type { Screen } from "../Router";

export class HistoryDetailScreen implements Screen {
  /** `finished` shows the summary right after a workout, with a way home instead of back to history. */
  constructor(
    private readonly app: App,
    private readonly logId: string,
    private readonly finished = false,
  ) {}

  render(): HTMLElement {
    const { store, router } = this.app;
    const log = store.data.history.find((l) => l.id === this.logId);
    if (!log) return page("Workout", { back: "/history" }, emptyState("Workout not found."));
    const unit = store.data.settings.unit;

    const exercises = log.exercises.map((ex) =>
      group(
        ex.name,
        ex.sets.map((set, i) => {
          if (!set.done) return row({ title: `Set ${i + 1}`, detail: "skipped" });
          const reps = `${set.reps}/${set.targetReps} reps`;
          return row({ title: `Set ${i + 1}`, detail: ex.bodyweight ? reps : `${reps} × ${formatWeight(set.weight)} ${unit}` });
        }),
      ),
    );
    const nav = this.finished ? { back: "/", backLabel: "Home" } : { back: "/history" };
    const summary = page(
      log.dayName,
      nav,
      this.finished ? h("p", { className: "page-note" }, "Workout saved. Nice work!") : null,
      group(null, [
        row({ title: "Plan", detail: log.planName }),
        row({ title: "Date", detail: formatDate(log.startedAt) }),
        row({ title: "Duration", detail: `${durationMinutes(log)} min` }),
      ]),
      ...exercises,
      group(null, [
        actionRow(
          "Delete workout",
          "Remove this workout from history",
          () =>
            confirmDelete("this workout", () => {
              store.data.history = store.data.history.filter((l) => l !== log);
              store.save();
              router.go("/history");
            }),
          true,
        ),
      ]),
    );
    if (!this.finished) return summary;
    return h("div", {}, summary, fab(ICONS.check, "Back to the home screen", () => router.go("/"), "Done"));
  }
}
