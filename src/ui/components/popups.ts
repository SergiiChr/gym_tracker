import { fuzzyMatch } from "../../services/search";
import { h, svg, type Child } from "../dom";
import { ICONS } from "../icons";
import { searchInput } from "./forms";

export interface SheetAction {
  /** A function gets the search text, so the label can follow what is typed. */
  label: string | ((query: string) => string);
  onSelect: (query: string) => void;
  subtitle?: string;
  icon?: string;
  destructive?: boolean;
  /** Blue label with the icon in a tinted circle, like "Add …" rows in lists. */
  accent?: boolean;
  /** Marks the current choice with a check. */
  selected?: boolean;
  /** Stays visible while searching. */
  pinned?: boolean;
}

interface SheetOptions {
  subtitle?: string;
  /** Adds a search field that fuzzy-filters the choices by label; the sheet then gets a close button and full height. */
  searchPlaceholder?: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  action: string;
  /** Red action button, for choices that lose data. */
  destructive?: boolean;
  cancel?: string;
  onConfirm: () => void;
}

const DISMISS_DRAG_PX = 80;

/** Native <dialog> that closes on a backdrop tap and removes itself once closed. */
function modal(className: string, ...content: Child[]): HTMLDialogElement {
  const dialog = h("dialog", { className }, ...content);
  // Clicking the backdrop targets the dialog itself.
  dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
  dialog.addEventListener("close", () => dialog.remove());
  // A back swipe changes the screen underneath, so the popup's actions would apply to the wrong page.
  window.addEventListener("hashchange", () => dialog.close(), { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/** Pulling the sheet down by its header closes it. */
function dragToClose(dialog: HTMLDialogElement, handle: HTMLElement): void {
  let startY: number | null = null;
  handle.addEventListener("pointerdown", (e) => {
    // Capturing the pointer would steal the click from the close button.
    if ((e.target as Element).closest("button")) return;
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
    dialog.style.transition = "none";
  });
  handle.addEventListener("pointermove", (e) => {
    if (startY !== null) dialog.style.transform = `translateY(${Math.max(0, e.clientY - startY)}px)`;
  });
  const end = (e: PointerEvent): void => {
    if (startY === null) return;
    const dragged = e.clientY - startY;
    startY = null;
    dialog.style.transition = "";
    if (dragged > DISMISS_DRAG_PX) dialog.close();
    else dialog.style.transform = "";
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

/** Bottom sheet with a list of choices. */
export function actionSheet(title: string, actions: SheetAction[], options: SheetOptions = {}): void {
  const { subtitle, searchPlaceholder } = options;
  let query = "";
  const labelOf = (action: SheetAction): string => (typeof action.label === "string" ? action.label : action.label(query));
  const choose = (action?: SheetAction): void => {
    dialog.close();
    action?.onSelect(query);
  };
  const items = actions.map((action) => {
    const label = h("span", {}, labelOf(action));
    const icon = action.icon ? svg(action.icon) : null;
    const button = h(
      "button",
      { type: "button", className: `sheet-item${action.destructive ? " destructive" : ""}${action.accent ? " accent" : ""}`, onclick: () => choose(action) },
      action.accent && icon ? h("span", { className: "action-icon" }, icon) : icon,
      h("span", { className: "sheet-item-text" }, label, action.subtitle ? h("span", { className: "sheet-item-subtitle" }, action.subtitle) : null),
      action.selected ? h("span", { className: "sheet-item-check" }, svg(ICONS.check)) : null,
    );
    return { action, button, label };
  });
  const search =
    searchPlaceholder === undefined
      ? null
      : searchInput(searchPlaceholder, (text) => {
          query = text;
          for (const { action, button, label } of items) {
            label.textContent = labelOf(action);
            button.hidden = !action.pinned && !fuzzyMatch(query, label.textContent);
          }
        });
  // The dialog focuses the first control otherwise, which is the close button.
  if (search) search.autofocus = true;
  const head = h(
    "div",
    { className: "sheet-head" },
    h("div", { className: "sheet-title" }, h("h2", {}, title), subtitle ? h("p", {}, subtitle) : null),
    search ? h("button", { type: "button", className: "sheet-close", title: "Close", ariaLabel: "Close", onclick: () => choose() }, svg(ICONS.close)) : null,
  );
  const dialog = modal(
    search ? "sheet tall" : "sheet",
    head,
    search,
    h("div", { className: "sheet-items" }, ...items.map((i) => i.button)),
    search ? null : h("button", { type: "button", className: "btn tonal", onclick: () => choose() }, "Cancel"),
  );
  dragToClose(dialog, head);
}

/** Centered question with Cancel and one action; in-page replacement for confirm(), which some embedded views block. */
export function confirmDialog(options: ConfirmOptions): void {
  const dialog = modal(
    "alert",
    h("h2", {}, options.title),
    options.message ? h("p", {}, options.message) : null,
    h(
      "div",
      { className: "alert-buttons" },
      h("button", { type: "button", className: "btn tonal", onclick: () => dialog.close() }, options.cancel ?? "Cancel"),
      h(
        "button",
        {
          type: "button",
          className: `btn ${options.destructive ? "danger" : "filled"}`,
          onclick: () => {
            dialog.close();
            options.onConfirm();
          },
        },
        options.action,
      ),
    ),
  );
}
