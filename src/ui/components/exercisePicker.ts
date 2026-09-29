import type { Exercise } from "../../model/types";
import { actionSheet } from "./actionSheet";

/**
 * Searchable sheet of exercises sorted by name.
 * The first choice creates a new exercise named after the search text, or with the default name when nothing is typed.
 */
export function exercisePicker(exercises: Exercise[], onPick: (exercise: Exercise) => void, onNew: (name: string | undefined) => void): void {
  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name));
  actionSheet(
    "Add exercise",
    [
      { label: (query) => (query ? `＋ New "${query}"` : "＋ New exercise"), pinned: true, onSelect: (query) => onNew(query || undefined) },
      ...sorted.map((e) => ({ label: e.name, onSelect: () => onPick(e) })),
    ],
    "Search exercises",
  );
}
