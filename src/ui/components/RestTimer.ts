import { h } from "../dom";

/** Countdown bar shown after a set is logged. Tapping it dismisses it and calls `onDismiss`. */
export class RestTimer {
  readonly element = h("button", { type: "button", className: "rest-timer hidden", title: "Rest timer. Tap to go to the next set" });
  private endsAt = 0;
  private interval: number | undefined;

  constructor(onDismiss: () => void) {
    this.element.addEventListener("click", () => {
      this.stop();
      onDismiss();
    });
  }

  start(seconds: number): void {
    if (seconds <= 0) return;
    this.endsAt = Date.now() + seconds * 1000;
    this.element.classList.remove("hidden", "done");
    window.clearInterval(this.interval);
    this.interval = window.setInterval(() => this.tick(), 250);
    this.tick();
  }

  stop(): void {
    window.clearInterval(this.interval);
    this.element.classList.add("hidden");
  }

  private tick(): void {
    const left = Math.ceil((this.endsAt - Date.now()) / 1000);
    if (left > 0) {
      this.element.textContent = `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      return;
    }
    window.clearInterval(this.interval);
    this.element.textContent = "Rest over. Next set!";
    this.element.classList.add("done");
    navigator.vibrate?.([200, 100, 200]);
  }
}
