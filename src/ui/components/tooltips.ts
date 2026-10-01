import { toast } from "./layout";

const HOLD_MS = 550;

/**
 * Desktop gets tooltips from the native `title` attribute on hover.
 * On touch screens, holding any element with a `title` shows it as a toast instead.
 */
export function installTouchTooltips(): void {
  let timer: number | undefined;
  let shown = false;
  let startX = 0;
  let startY = 0;
  const cancel = (): void => window.clearTimeout(timer);

  document.addEventListener("pointerdown", (e) => {
    shown = false;
    if (e.pointerType === "mouse") return;
    const tip = (e.target as Element).closest<HTMLElement>("[title]")?.title;
    if (!tip) return;
    startX = e.clientX;
    startY = e.clientY;
    timer = window.setTimeout(() => {
      shown = true;
      toast(tip);
    }, HOLD_MS);
  });
  // Finger jitter fires pointermove constantly, so only a real drag cancels the hold.
  document.addEventListener("pointermove", (e) => Math.hypot(e.clientX - startX, e.clientY - startY) > 10 && cancel(), { passive: true });
  for (const type of ["pointerup", "pointercancel", "scroll"]) {
    document.addEventListener(type, cancel, { passive: true });
  }
  // Releasing a long press would otherwise also count as a tap.
  document.addEventListener(
    "click",
    (e) => {
      if (!shown) return;
      shown = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
}
