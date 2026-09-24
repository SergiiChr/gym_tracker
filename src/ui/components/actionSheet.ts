import { h } from "../dom";

export interface SheetAction {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

/** Bottom sheet with a list of choices, built on the native <dialog> element. */
export function actionSheet(title: string, actions: SheetAction[]): void {
  const dialog = h("dialog", { className: "sheet" });
  const choose = (action?: SheetAction): void => {
    dialog.close();
    action?.onSelect();
  };
  dialog.append(
    h(
      "div",
      { className: "sheet-group" },
      h("div", { className: "sheet-title" }, title),
      ...actions.map((a) => h("button", { type: "button", className: a.destructive ? "destructive" : "", onclick: () => choose(a) }, a.label)),
    ),
    h("div", { className: "sheet-group" }, h("button", { type: "button", className: "sheet-cancel", onclick: () => choose() }, "Cancel")),
  );
  // Clicking the backdrop targets the dialog itself.
  dialog.addEventListener("click", (e) => e.target === dialog && choose());
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
