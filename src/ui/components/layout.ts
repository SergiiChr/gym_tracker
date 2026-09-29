import { h, svg, type Child } from "../dom";
import { confirmDialog } from "./popups";
import { ICONS } from "../icons";

interface PageOptions {
  /** Hash path of the parent screen; no back button when omitted. */
  back?: string;
  backLabel?: string;
  action?: HTMLElement;
  /** Big iOS-style heading in the content instead of the compact bar title. */
  largeTitle?: boolean;
}

export function page(title: string, options: PageOptions, ...content: Child[]): HTMLElement {
  const label = options.backLabel ?? "Back";
  const back = options.back ? h("a", { className: "nav-back", href: `#${options.back}`, title: label }, svg(ICONS.back), label) : h("span");
  return h(
    "div",
    { className: "page" },
    h(
      "header",
      { className: "navbar" },
      back,
      h("div", { className: "nav-title" }, options.largeTitle ? "" : title),
      options.action ?? h("span"),
    ),
    h("main", { className: "content" }, options.largeTitle ? h("h1", { className: "large-title" }, title) : null, ...content),
  );
}

export function navButton(label: Child, tip: string, onclick: () => void): HTMLButtonElement {
  return h("button", { className: "nav-action", type: "button", title: tip, onclick }, label);
}

export function plusButton(tip: string, onclick: () => void): HTMLButtonElement {
  return navButton(svg(ICONS.plus), tip, onclick);
}

/** Round floating button in the bottom right corner. */
export function fab(icon: string, tip: string, onclick: () => void): HTMLButtonElement {
  return h("button", { className: "fab", type: "button", title: tip, onclick }, svg(icon));
}

/** Full width main action pinned to the bottom of the screen. */
export function bottomButton(label: string, tip: string, onclick: () => void): HTMLButtonElement {
  return h("button", { className: "btn filled bottom-button", type: "button", title: tip, onclick }, label);
}

/** Red button at the end of a page for deleting what the page shows. */
export function deleteButton(label: string, tip: string, onclick: () => void): HTMLButtonElement {
  return h("button", { className: "btn tonal-danger page-button", type: "button", title: tip, onclick }, label);
}

export function emptyState(text: string): HTMLElement {
  return h("p", { className: "empty" }, text);
}

export function toast(text: string): void {
  const el = h("div", { className: "toast", role: "status" }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}

export function confirmDelete(what: string, onConfirm: () => void): void {
  confirmDialog({ title: `Delete ${what}?`, message: "This can't be undone.", action: "Delete", destructive: true, onConfirm });
}
