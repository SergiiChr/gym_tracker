export declare class FinishRunner extends HTMLElement {
  /** Countdown length in ms, mirrors the `duration` attribute. Defaults to 3000. */
  duration: number;
  /** True while counting down; false once the finish line is reached or after stop(). */
  readonly running: boolean;
  /** Starts a full countdown with no knockdown. */
  start(): void;
  /** Restarts the countdown with a knockdown; acts as start() when not running. */
  reset(): void;
  /** Cancels the countdown and clears the canvas. */
  stop(): void;
  addEventListener(type: "finish", listener: (this: FinishRunner, ev: Event) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "finish-runner": FinishRunner;
  }
}
