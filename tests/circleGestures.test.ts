// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoggedSet } from "../src/model/types";
import { createWorkout } from "../src/services/workout";
import { CHEER_MS, COUNTDOWN_MS, ExerciseCard, RESET_HOLD_MS as RESET_MS, type CardHost } from "../src/ui/components/ExerciseCard";
import { HOLD_MS } from "../src/ui/components/gestures";
import { sampleData } from "./helpers";

// happy-dom has no canvas drawing, which the card's finish runner needs; a stand-in context swallows every call.
Object.assign(HTMLCanvasElement.prototype, { getContext: () => new Proxy({}, { get: () => () => undefined }) });
// Nor does it animate, which the card's fold waits for.
Object.assign(Element.prototype, { animate: () => ({ finished: Promise.resolve() }) });

const host: CardHost = {
  mode: "fixed",
  unit: "kg",
  step: 2.5,
  previous: () => undefined,
  onSetDone: () => {},
  exercise: () => undefined,
  planDay: () => undefined,
  remove: () => {},
  alternatives: () => [],
  swap: (logged) => logged,
  save: () => {},
};

/** A same weight card for Bench (one set of 5) with its only circle. */
function setup(): { card: HTMLDetailsElement; circle: HTMLButtonElement; set: LoggedSet } {
  const { data, plan } = sampleData();
  const logged = createWorkout(data, plan, plan.days[0]!).exercises[1]!;
  const card = new ExerciseCard(logged, host).element;
  document.body.replaceChildren(card);
  return { card, circle: card.querySelector<HTMLButtonElement>(".circle:not(.circle-add)")!, set: logged.sets[0]! };
}

/** Finger down, held for `ms`, then up; browsers fire the click after the release. */
function press(el: Element, ms: number, move = 0): void {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0 }));
  if (move) el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: move, clientY: 0 }));
  vi.advanceTimersByTime(ms);
  el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

const tap = (el: Element): void => press(el, 80);
const state = (set: LoggedSet): string => (set.done ? String(set.reps) : "-");

describe("set circle taps and holds", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("logs target reps on a tap and takes one rep off on each next tap", () => {
    const { circle, set } = setup();
    const seen = Array.from({ length: 3 }, () => (tap(circle), state(set)));
    expect(seen).toEqual(["5", "4", "3"]);
    expect(circle.textContent).toBe("3");
  });

  it("counts a slow press that is still shorter than a hold as a tap", () => {
    const { circle, set } = setup();
    press(circle, HOLD_MS - 50);
    expect(state(set)).toBe("5");
  });

  it("resets a logged set after a full hold, without the release counting as a tap", () => {
    const { circle, set } = setup();
    tap(circle);
    tap(circle);
    press(circle, RESET_MS);
    expect(state(set)).toBe("-");
    expect(set.reps).toBe(5);
    expect(circle.className).toContain("todo");
  });

  it("leaves the set as it was when the hold is let go early", () => {
    const { circle, set } = setup();
    tap(circle);
    press(circle, RESET_MS / 2);
    expect(state(set)).toBe("5");
  });

  it("does nothing on a hold over a set not logged yet", () => {
    const { circle, set } = setup();
    press(circle, RESET_MS);
    expect(state(set)).toBe("-");
  });

  it("cancels the hold when the finger moves, so scrolling over a circle doesn't reset it", () => {
    const { circle, set } = setup();
    tap(circle);
    press(circle, RESET_MS, 20);
    expect(state(set)).toBe("5");
  });

  it("takes taps normally right after a hold", () => {
    const { circle, set } = setup();
    tap(circle);
    press(circle, RESET_MS);
    tap(circle);
    expect(state(set)).toBe("5");
    tap(circle);
    expect(state(set)).toBe("4");
  });

  it("marks the circle as holding only while pressed, which drives the erase animation", () => {
    const { circle } = setup();
    tap(circle);
    circle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(circle.classList.contains("holding")).toBe(true);
    vi.advanceTimersByTime(RESET_MS / 2);
    circle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(circle.classList.contains("holding")).toBe(false);
  });

  it("counts a keyboard click, which has no press, as a tap", () => {
    const { circle, set } = setup();
    press(circle, RESET_MS / 2);
    circle.click();
    expect(state(set)).toBe("5");
  });
});

describe("countdown once every set is done", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  /** Lets the fold's animations settle after the timers fired. */
  const elapse = async (ms: number): Promise<void> => void (await vi.advanceTimersByTimeAsync(ms));

  it("folds the card after the run and the cheer", async () => {
    const { card, circle } = setup();
    tap(circle);
    expect(card.classList.contains("counting")).toBe(true);
    await elapse(COUNTDOWN_MS + CHEER_MS - 1);
    expect(card.open).toBe(true);
    await elapse(1);
    expect(card.open).toBe(false);
    expect(card.classList.contains("counting")).toBe(false);
  });

  it("starts over when reps change during the countdown", async () => {
    const { card, circle } = setup();
    tap(circle);
    await elapse(COUNTDOWN_MS / 2);
    tap(circle);
    await elapse(COUNTDOWN_MS + CHEER_MS - 1);
    expect(card.open).toBe(true);
    await elapse(1);
    expect(card.open).toBe(false);
  });

  it("is called off when a set is undone", async () => {
    const { card, circle } = setup();
    tap(circle);
    press(circle, RESET_MS);
    expect(card.classList.contains("counting")).toBe(false);
    await elapse(2 * (COUNTDOWN_MS + CHEER_MS));
    expect(card.open).toBe(true);
  });

  it("keeps running when the card is moved in the page, like while another card is dragged past", async () => {
    const { card, circle } = setup();
    tap(circle);
    document.body.append(card); // Re-inserts it, which disconnects and reconnects the runner.
    await elapse(COUNTDOWN_MS + CHEER_MS);
    expect(card.open).toBe(false);
  });
});
