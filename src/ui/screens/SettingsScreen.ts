import { addPresets, emptyData } from "../../model/presets";
import type { Unit } from "../../model/types";
import { convertData, formatWeight, STEP_OPTIONS } from "../../model/units";
import type { App } from "../App";
import { numberRow, segmentedRow, selectRow, toggleRow } from "../components/forms";
import { page, toast } from "../components/layout";
import { actionRow, group } from "../components/list";
import { h } from "../dom";
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
            (unit) => {
              if (!confirm(`Switch to ${unit}? All weights, including history, are converted and rounded.`)) return commit();
              convertData(store.data, unit);
              commit();
            },
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
      group("Backup", [
        actionRow("Export data", "Download all data as a JSON file", () => this.exportData()),
        actionRow("Import data", "Replace all data with a JSON backup", () => this.importData()),
      ]),
      group(
        "Data",
        [
          actionRow("Add preset plans", "Add StrongLifts 5×5 and Dorian Yates plans with their exercises", () => {
            addPresets(store.data);
            save();
            toast("Presets added");
          }),
          actionRow(
            "Clear all data",
            "Delete all plans, exercises, history and settings",
            () => {
              if (!confirm("Delete ALL plans, exercises, history and settings? This can't be undone.")) return;
              store.data = emptyData();
              commit();
            },
            true,
          ),
        ],
        "Data is stored in this browser only. Export a backup before clearing browser data.",
      ),
    );
  }

  private exportData(): void {
    const blob = new Blob([this.app.store.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    h("a", { href: url, download: `gym-tracker-${new Date().toISOString().slice(0, 10)}.json` }).click();
    URL.revokeObjectURL(url);
  }

  private importData(): void {
    const input = h("input", { type: "file", accept: "application/json,.json" });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file || !confirm("Replace all current data with this backup?")) return;
      try {
        this.app.store.importJson(await file.text());
        this.app.commit();
        toast("Backup imported");
      } catch {
        alert("This file is not a valid gym tracker backup.");
      }
    });
    input.click();
  }
}
