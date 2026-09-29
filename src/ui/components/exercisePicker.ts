import type { Exercise, PlanMode, Unit } from "../../model/types";
import { schemeText } from "../format";
import { ICONS } from "../icons";
import { actionSheet } from "./popups";

/**
 * Searchable sheet of exercises sorted by name, each with its sets and weight for `mode`.
 * The first choice creates a new exercise named after the search text, or with the default name when nothing is typed.
 */
export function exercisePicker(
  exercises: Exercise[],
  mode: PlanMode,
  unit: Unit,
  onPick: (exercise: Exercise) => void,
  onNew: (name: string | undefined) => void,
): void {
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
  actionSheet(
    "Add exercise",
    [
      {
        label: (query) => (query ? `New "${query}"` : "New exercise"),
        icon: ICONS.plus,
        accent: true,
        pinned: true,
        onSelect: (query) => onNew(query || undefined),
      },
      ...sorted.map((e) => ({ label: e.name, subtitle: schemeText(e.schemes[mode], e.bodyweight, unit), onSelect: () => onPick(e) })),
    ],
    { searchPlaceholder: "Search exercises" },
  );
}
