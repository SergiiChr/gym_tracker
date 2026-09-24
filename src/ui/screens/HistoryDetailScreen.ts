import { formatWeight } from "../../model/units";
import { durationMinutes } from "../../services/workout";
import type { App } from "../App";
import { confirmDelete, emptyState, page } from "../components/layout";
import { actionRow, group, row } from "../components/list";
import { formatDate } from "../dom";
import type { Screen } from "../Router";

export class HistoryDetailScreen implements Screen {
  constructor(
    private readonly app: App,
    private readonly logId: string,
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
          if (set.reps === null) return row({ title: `Set ${i + 1}`, detail: "skipped" });
          const reps = `${set.reps}/${set.targetReps} reps`;
          return row({ title: `Set ${i + 1}`, detail: ex.bodyweight ? reps : `${reps} × ${formatWeight(set.weight)} ${unit}` });
        }),
      ),
    );
    return page(
      log.dayName,
      { back: "/history" },
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
          () => {
            if (!confirmDelete("this workout")) return;
            store.data.history = store.data.history.filter((l) => l !== log);
            store.save();
            router.go("/history");
          },
          true,
        ),
      ]),
    );
  }
}
