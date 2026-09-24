import { h } from "../dom";

const DELETE_WIDTH = 88;
const MOVE_THRESHOLD = 8;

/**
 * iOS-style swipe left to reveal a Delete button.
 * `onDelete` runs only after the button is tapped, so callers can still confirm.
 */
export function swipeToDelete(row: HTMLLIElement, onDelete: () => void, label = "Delete"): HTMLLIElement {
  const content = row.querySelector<HTMLElement>(".row-content")!;
  let startX = 0;
  let startY = 0;
  let offset = 0;
  let base = 0;
  let tracking = false;
  let swiping = false;

  const settle = (open: boolean): void => {
    base = open ? -DELETE_WIDTH : 0;
    row.classList.toggle("open", open);
    content.style.transition = "transform 0.2s ease";
    content.style.transform = `translateX(${base}px)`;
  };
  const button = h("button", { type: "button", className: "row-delete", title: label, onclick: () => (settle(false), onDelete()) }, label);
  row.classList.add("swipeable");
  row.prepend(button);

  content.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest(".drag-handle, input, select, button")) return;
    tracking = true;
    swiping = false;
    startX = e.clientX;
    startY = e.clientY;
    content.style.transition = "none";
  });
  content.addEventListener("pointermove", (e) => {
    if (!tracking) return;
    const dx = e.clientX - startX;
    if (!swiping) {
      if (Math.abs(e.clientY - startY) > MOVE_THRESHOLD) tracking = false;
      if (Math.abs(dx) < MOVE_THRESHOLD) return;
      swiping = true;
      row.classList.add("open");
      content.setPointerCapture(e.pointerId);
    }
    offset = Math.min(0, Math.max(-DELETE_WIDTH * 1.5, base + dx));
    content.style.transform = `translateX(${offset}px)`;
  });
  const end = (): void => {
    if (swiping) settle(offset < -DELETE_WIDTH / 2);
    tracking = false;
  };
  content.addEventListener("pointerup", end);
  content.addEventListener("pointercancel", end);
  // A swipe or a tap on an opened row must not also follow the row's link.
  content.addEventListener(
    "click",
    (e) => {
      if (!swiping && base === 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!swiping) settle(false);
      swiping = false;
    },
    true,
  );
  return row;
}

/**
 * Drag rows by their `.drag-handle` to reorder; reports the move as indexes among the rows that have a handle.
 * Rows without a handle (like a trailing "Add" row) stay in place.
 */
export function makeSortable(list: HTMLElement, onMove: (from: number, to: number) => void): void {
  // The handle sits inside the row link; grabbing it must not open the row.
  list.addEventListener("click", (e) => (e.target as Element).closest(".drag-handle") && e.preventDefault(), true);
  list.addEventListener("pointerdown", (e) => {
    const handle = (e.target as Element).closest(".drag-handle");
    const item = handle?.closest<HTMLElement>("li");
    if (!handle || !item) return;
    e.preventDefault();
    const items = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>(":scope > li:has(.drag-handle)")];
    const from = items().indexOf(item);
    let startY = e.clientY;
    item.classList.add("dragging");
    (handle as HTMLElement).setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent): void => {
      let dy = ev.clientY - startY;
      const index = items().indexOf(item);
      const prev = items()[index - 1];
      const next = items()[index + 1];
      // Neighbours are moved rather than the item itself, which would drop its pointer capture.
      if (next && dy > next.offsetHeight / 2) {
        item.before(next);
        startY += next.offsetHeight;
      } else if (prev && dy < -prev.offsetHeight / 2) {
        item.after(prev);
        startY -= prev.offsetHeight;
      }
      dy = ev.clientY - startY;
      item.style.transform = `translateY(${dy}px)`;
    };
    const up = (): void => {
      handle.removeEventListener("pointermove", move as EventListener);
      item.classList.remove("dragging");
      item.style.transform = "";
      const to = items().indexOf(item);
      if (to !== from) onMove(from, to);
    };
    handle.addEventListener("pointermove", move as EventListener);
    handle.addEventListener("pointerup", up, { once: true });
    handle.addEventListener("pointercancel", up, { once: true });
  });
}

export function moveItem<T>(items: T[], from: number, to: number): void {
  const [item] = items.splice(from, 1);
  if (item !== undefined) items.splice(to, 0, item);
}
