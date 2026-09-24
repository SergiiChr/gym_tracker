import "./styles.css";
import { browserStorage, Store } from "./services/Store";
import { App } from "./ui/App";
import { installTouchTooltips } from "./ui/components/tooltips";
import type { PlanMode } from "./model/types";
import { Router } from "./ui/Router";
import { BackupScreen } from "./ui/screens/BackupScreen";
import { DayEditScreen } from "./ui/screens/DayEditScreen";
import { ExerciseEditScreen } from "./ui/screens/ExerciseEditScreen";
import { ExercisesScreen } from "./ui/screens/ExercisesScreen";
import { HistoryDetailScreen } from "./ui/screens/HistoryDetailScreen";
import { HistoryScreen } from "./ui/screens/HistoryScreen";
import { HomeScreen } from "./ui/screens/HomeScreen";
import { PlanEditScreen } from "./ui/screens/PlanEditScreen";
import { PlansScreen } from "./ui/screens/PlansScreen";
import { SettingsScreen } from "./ui/screens/SettingsScreen";
import { StartScreen } from "./ui/screens/StartScreen";
import { WorkoutScreen } from "./ui/screens/WorkoutScreen";

const router = new Router(document.getElementById("app")!);
const app = new App(new Store(browserStorage()), router);

router
  .add("/", () => new HomeScreen(app))
  .add("/start", () => new StartScreen(app))
  .add("/workout", () => new WorkoutScreen(app))
  .add("/history", () => new HistoryScreen(app))
  .add("/history/:id", (p) => new HistoryDetailScreen(app, p.id!))
  .add("/plans", () => new PlansScreen(app))
  .add("/plans/:planId", (p) => new PlanEditScreen(app, p.planId!))
  .add("/plans/:planId/days/:dayId", (p) => new DayEditScreen(app, p.planId!, p.dayId!))
  .add("/plans/:planId/days/:dayId/exercises/:id", (p) => {
    const mode = app.store.plan(p.planId!)?.mode ?? "fixed";
    return new ExerciseEditScreen(app, p.id!, `/plans/${p.planId}/days/${p.dayId}`, mode);
  })
  .add("/exercises", () => new ExercisesScreen(app))
  .add("/exercises/:id", (p) => exerciseScreen(p.id!, "fixed"))
  .add("/exercises/:id/:mode", (p) => exerciseScreen(p.id!, p.mode === "perSet" ? "perSet" : "fixed"))
  .add("/settings", () => new SettingsScreen(app))
  .add("/settings/backup", () => new BackupScreen(app));

function exerciseScreen(id: string, mode: PlanMode): ExerciseEditScreen {
  return new ExerciseEditScreen(app, id, "/exercises", mode, (next) => `/exercises/${id}/${next}`);
}

installTouchTooltips();
// iOS Safari only applies :active styles when the page listens to touches.
document.addEventListener("touchstart", () => {}, { passive: true });
// Asks the browser not to evict data under storage pressure; browsers may ignore it.
void navigator.storage?.persist?.();
router.render();
