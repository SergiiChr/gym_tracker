import { h } from "../dom";

const DELETE_WIDTH = 88;
const MOVE_THRESHOLD = 8;
/** How long a press must be held to count as a hold rather than a tap. */
export const HOLD_MS = 550;

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
 * Runs `action` when the element is pressed and held for `ms` without moving.
 * While pressed, the element has the `holding` class and `--hold-ms` is the hold time, so CSS can animate the progress in step.
 * Call it before adding the element's click listener: the click after any press longer than a tap is swallowed, even when let go early.
 * Touch tooltips skip elements marked with `data-hold`, since holding them does something else.
 */
export function onHold(el: HTMLElement, action: () => void, ms = HOLD_MS): void {
  let timer: number | undefined;
  let downAt = 0;
  let pressMs = 0;
  let startX = 0;
  let startY = 0;
  const cancel = (): void => {
    window.clearTimeout(timer);
    el.classList.remove("holding");
  };
  el.dataset.hold = "";
  el.style.setProperty("--hold-ms", `${ms}ms`);
  el.addEventListener("pointerdown", (e) => {
    downAt = Date.now();
    startX = e.clientX;
    startY = e.clientY;
    el.classList.add("holding");
    timer = window.setTimeout(() => {
      cancel();
      action();
    }, ms);
  });
  el.addEventListener("pointermove", (e) => Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_THRESHOLD && cancel());
  el.addEventListener("pointerup", () => {
    pressMs = Date.now() - downAt;
    cancel();
  });
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  // Measured at release rather than here, so a keyboard click (no press) always goes through.
  el.addEventListener("click", (e) => {
    const long = pressMs >= HOLD_MS;
    pressMs = 0;
    if (long) e.stopImmediatePropagation();
  });
}

/**
 * Drag rows (or workout cards) by their `.drag-handle` to reorder; reports the move as indexes among the items that have a handle.
 * Items without a handle (like a trailing "Add" row) stay in place.
 */
export function makeSortable(list: HTMLElement, onMove: (from: number, to: number) => void): void {
  // The handle sits inside the row link or card summary; grabbing it must not open the row or toggle the card.
  list.addEventListener("click", (e) => (e.target as Element).closest(".drag-handle") && e.preventDefault(), true);
  list.addEventListener("pointerdown", (e) => {
    const handle = (e.target as Element).closest(".drag-handle");
    const item = handle?.closest<HTMLElement>("li, details");
    // Handles of a list nested inside an item belong to that inner list.
    if (!handle || !item || item.parentElement !== list) return;
    e.preventDefault();
    const items = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>(":scope > :has(.drag-handle)")];
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
