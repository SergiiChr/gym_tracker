import { h, svg, type Child } from "../dom";
import { confirmSheet } from "./actionSheet";
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

/** Round floating button in the bottom right corner; `label` turns it into a pill. */
export function fab(icon: string, tip: string, onclick: () => void, label?: string): HTMLButtonElement {
  return h("button", { className: label ? "fab fab-wide" : "fab", type: "button", title: tip, onclick }, svg(icon), label);
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
  confirmSheet(`Delete ${what}? This can't be undone.`, "Delete", onConfirm);
}
