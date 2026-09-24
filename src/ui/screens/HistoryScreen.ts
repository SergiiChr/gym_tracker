import type { App } from "../App";
import { swipeToDelete } from "../components/gestures";
import { confirmDelete, emptyState, page } from "../components/layout";
import { group, row } from "../components/list";
import { formatDate } from "../dom";
import type { Screen } from "../Router";

export class HistoryScreen implements Screen {
  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const { store } = this.app;
    const history = store.data.history;
    const rows = history.map((log) =>
      swipeToDelete(
        row({ title: `${log.planName} · ${log.dayName}`, subtitle: formatDate(log.startedAt), href: `/history/${log.id}`, tip: "Open workout. Swipe left to delete" }),
        () => {
          if (!confirmDelete("this workout")) return;
          store.data.history = history.filter((l) => l !== log);
          this.app.commit();
        },
      ),
    );
    return page("Workout history", { back: "/" }, rows.length ? group(null, rows) : emptyState("No workouts yet."));
  }
}
