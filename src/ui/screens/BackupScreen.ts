import { MINIMAL_BACKUP } from "../../model/backupExample";
import type { App } from "../App";
import { confirmSheet } from "../components/actionSheet";
import { page, toast } from "../components/layout";
import { actionRow, group } from "../components/list";
import { h } from "../dom";
import type { Screen } from "../Router";

export class BackupScreen implements Screen {
  constructor(private readonly app: App) {}

  render(): HTMLElement {
    const unit = this.app.store.data.settings.unit;
    return page(
      "Backup & restore",
      { back: "/settings" },
      group(
        null,
        [
          actionRow("Export data", "Download all data as a JSON file", () => this.exportData()),
          actionRow("Import data", "Replace all data with a JSON backup", () => this.importData()),
        ],
        "Data is stored in this browser only. Export a backup before clearing browser data or switching devices. On iPhone, add the app to the Home Screen: Safari may delete website data after 7 days without a visit.",
      ),
      group(
        "Data format",
        [
          h(
            "li",
            { className: "row" },
            h(
              "div",
              { className: "row-content format-hint" },
              h(
                "ul",
                {},
                h("li", {}, "A JSON file, like the one Export produces."),
                h("li", {}, "Exercises need an id and a name; plan days list exercise ids in order."),
                h("li", {}, `Plan "mode": "fixed" is Same weight, "perSet" is Weight per set.`),
                h("li", {}, `Weights are in ${unit}. A scheme for one mode is copied to the other.`),
                h("li", {}, "Settings, history and other fields are optional and get defaults."),
              ),
              h("pre", { className: "code" }, MINIMAL_BACKUP),
            ),
          ),
          actionRow("Copy example", "Copy the example to the clipboard", () => this.copyExample()),
        ],
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
      if (!file) return;
      const json = await file.text();
      confirmSheet("Replace all current data with this backup?", "Replace data", () => {
        try {
          this.app.store.importJson(json);
          this.app.commit();
          toast("Backup imported");
        } catch {
          toast("This file is not a gym tracker backup. Nothing was changed.");
        }
      });
    });
    input.click();
  }

  private copyExample(): void {
    navigator.clipboard.writeText(MINIMAL_BACKUP).then(
      () => toast("Example copied"),
      () => toast("Couldn't copy. Select the example text instead."),
    );
  }
}
