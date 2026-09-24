import type { Store } from "../services/Store";
import type { Router } from "./Router";

/** Shared context handed to every screen. */
export class App {
  constructor(
    readonly store: Store,
    readonly router: Router,
  ) {}

  /** Persists changes and redraws the current screen. */
  commit(): void {
    this.store.save();
    this.router.render();
  }
}
