import { fuzzyMatch } from "../../services/search";
import { h } from "../dom";
import { searchInput } from "./forms";

export interface SheetAction {
  /** A function gets the search text, so the label can follow what is typed. */
  label: string | ((query: string) => string);
  onSelect: (query: string) => void;
  destructive?: boolean;
  /** Stays visible while searching. */
  pinned?: boolean;
}

/**
 * Bottom sheet with a list of choices, built on the native <dialog> element.
 * `searchPlaceholder` adds a search field that fuzzy-filters the choices by label.
 */
export function actionSheet(title: string, actions: SheetAction[], searchPlaceholder?: string): void {
  const dialog = h("dialog", { className: "sheet" });
  let query = "";
  const labelOf = (action: SheetAction): string => (typeof action.label === "string" ? action.label : action.label(query));
  const choose = (action?: SheetAction): void => {
    dialog.close();
    action?.onSelect(query);
  };
  const buttons = actions.map((a) => h("button", { type: "button", className: a.destructive ? "destructive" : "", onclick: () => choose(a) }, labelOf(a)));
  const search =
    searchPlaceholder === undefined
      ? null
      : searchInput(searchPlaceholder, (text) => {
          query = text;
          actions.forEach((action, i) => {
            const button = buttons[i]!;
            button.textContent = labelOf(action);
            button.hidden = !action.pinned && !fuzzyMatch(query, button.textContent);
          });
        });
  dialog.append(
    h("div", { className: "sheet-group" }, h("div", { className: "sheet-title" }, title), search, ...buttons),
    h("div", { className: "sheet-group" }, h("button", { type: "button", className: "sheet-cancel", onclick: () => choose() }, "Cancel")),
  );
  // Clicking the backdrop targets the dialog itself.
  dialog.addEventListener("click", (e) => e.target === dialog && choose());
  dialog.addEventListener("close", () => dialog.remove());
  // A back swipe changes the screen under the sheet, so its actions would apply to the wrong page.
  window.addEventListener("hashchange", () => dialog.close(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
}

/** In-page replacement for confirm(), which some embedded views block: the action runs only when its button is tapped. */
export function confirmSheet(message: string, actionLabel: string, onConfirm: () => void): void {
  actionSheet(message, [{ label: actionLabel, destructive: true, onSelect: onConfirm }]);
}
