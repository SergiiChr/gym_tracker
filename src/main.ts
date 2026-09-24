import "./styles.css";
import { Store } from "./services/Store";
import { App } from "./ui/App";
import { installTouchTooltips } from "./ui/components/tooltips";
import { Router } from "./ui/Router";
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
const app = new App(new Store(localStorage), router);

router
  .add("/", () => new HomeScreen(app))
  .add("/start", () => new StartScreen(app))
  .add("/workout", () => new WorkoutScreen(app))
  .add("/history", () => new HistoryScreen(app))
  .add("/history/:id", (p) => new HistoryDetailScreen(app, p.id!))
  .add("/plans", () => new PlansScreen(app))
  .add("/plans/:planId", (p) => new PlanEditScreen(app, p.planId!))
  .add("/plans/:planId/days/:dayId", (p) => new DayEditScreen(app, p.planId!, p.dayId!))
  .add("/plans/:planId/days/:dayId/exercises/:id", (p) => new ExerciseEditScreen(app, p.id!, `/plans/${p.planId}/days/${p.dayId}`))
  .add("/exercises", () => new ExercisesScreen(app))
  .add("/exercises/:id", (p) => new ExerciseEditScreen(app, p.id!, "/exercises"))
  .add("/settings", () => new SettingsScreen(app));

installTouchTooltips();
router.render();
