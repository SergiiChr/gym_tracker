import { h, svg, type Child } from "../dom";
import { ICONS } from "../icons";

export function group(header: string | null, rows: Node[], footer?: string): HTMLElement {
  return h(
    "section",
    { className: "group" },
    header ? h("h2", { className: "group-header" }, header) : null,
    h("ul", { className: "list" }, ...rows),
    footer ? h("p", { className: "group-footer" }, footer) : null,
  );
}

interface RowOptions {
  title: Child;
  subtitle?: Child;
  detail?: Child;
  leading?: Node | null;
  href?: string;
  onClick?: () => void;
  tip?: string;
  className?: string;
}

/** A list cell. Content sits in `.row-content` so gestures can slide it independently of the row. */
export function row(options: RowOptions): HTMLLIElement {
  const clickable = Boolean(options.href ?? options.onClick);
  const inner: Child[] = [
    options.leading,
    h("div", { className: "row-text" }, h("div", { className: "row-title" }, options.title), options.subtitle ? h("div", { className: "row-subtitle" }, options.subtitle) : null),
    options.detail !== undefined ? h("div", { className: "row-detail" }, options.detail) : null,
    options.href ? svg(ICONS.chevron) : null,
  ];
  const className = `row-content${clickable ? " clickable" : ""}`;
  const content = options.href
    ? h("a", { className, href: `#${options.href}`, draggable: false }, ...inner)
    : h("div", { className }, ...inner);
  if (options.onClick) content.addEventListener("click", options.onClick);
  return h("li", { className: `row ${options.className ?? ""}`, title: options.tip ?? "" }, content);
}

/** Blue text row used for "Add …" actions at the end of a list. */
export function actionRow(label: string, tip: string, onClick: () => void, destructive = false): HTMLLIElement {
  return row({ title: label, tip, onClick, className: destructive ? "row-action destructive" : "row-action" });
}

export function dragHandle(): HTMLElement {
  return h("span", { className: "drag-handle", title: "Drag to reorder" }, svg(ICONS.grip));
}
