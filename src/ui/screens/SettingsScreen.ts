import { addPresets, emptyData } from "../../model/presets";
import type { Unit } from "../../model/types";
import { convertData, formatWeight, STEP_OPTIONS } from "../../model/units";
import type { App } from "../App";
import { confirmDialog } from "../components/popups";
import { numberRow, segmentedRow, selectRow, toggleRow } from "../components/forms";
import { deleteButton, page, toast } from "../components/layout";
import { actionRow, group, row } from "../components/list";
import type { Screen } from "../Router";

export class SettingsScreen implements Screen {
  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const { store } = this.app;
    const settings = store.data.settings;
    const commit = (): void => this.app.commit();
    const save = (): void => store.save();
    const units: { value: Unit; label: string }[] = [
      { value: "kg", label: "kg" },
      { value: "lbs", label: "lbs" },
    ];

    return page(
      "Settings",
      { back: "/" },
      group(
        "Units",
        [
          segmentedRow(
            units,
            settings.unit,
            (unit) =>
              confirmDialog({
                title: `Switch to ${unit}?`,
                message: "All weights, including history, are converted and rounded.",
                action: "Switch",
                onConfirm: () => {
                  convertData(store.data, unit);
                  commit();
                },
              }),
            "Weight unit for the whole app",
          ),
        ],
      ),
      group(
        "New exercise defaults",
        [
          numberRow("Sets", settings.defaultSets, (v) => ((settings.defaultSets = v), save())),
          numberRow("Reps", settings.defaultReps, (v) => ((settings.defaultReps = v), save())),
          numberRow("Rest timer (sec)", settings.defaultRestSec, (v) => ((settings.defaultRestSec = v), save()), "Countdown after each logged set"),
        ],
      ),
      group(
        "Auto-increment",
        [
          toggleRow("Enabled", settings.increment.enabled, (on) => ((settings.increment.enabled = on), save()), "Add weight automatically after a successful workout"),
          selectRow(
            `Step (${settings.unit})`,
            STEP_OPTIONS[settings.unit].map((v) => ({ value: v, label: formatWeight(v) })),
            settings.increment.step,
            (step) => ((settings.increment.step = step), save()),
            "Weight added per increment. Also used by the ▲▼ buttons",
          ),
          numberRow("Target reps", settings.increment.targetReps, (v) => ((settings.increment.targetReps = v), save()), "Reps every set must reach to earn an increment"),
        ],
        "Exercises can override these rules.",
      ),
      group(null, [row({ title: "Backup & restore", href: "/settings/backup", tip: "Export or import all data as a JSON file" })]),
      group(
        "Data",
        [
          actionRow("Add preset plans", "Add the 5×5 A/B and HIT 4-day split plans with their exercises", () => {
            addPresets(store.data);
            save();
            toast("Presets added");
          }),
        ],
        "Data is stored in this browser only. Export a backup before clearing browser data.",
      ),
      deleteButton("Clear all data", "Delete all plans, exercises, history and settings", () =>
        confirmDialog({
          title: "Clear all data?",
          message: "Deletes all plans, exercises, history and settings. This can't be undone.",
          action: "Clear",
          destructive: true,
          onConfirm: () => {
            store.data = emptyData();
            commit();
          },
        }),
      ),
    );
  }
}
