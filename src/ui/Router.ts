export interface Screen {
  render(): HTMLElement;
  /** Stops timers or listeners when the screen is replaced. */
  dispose?(): void;
}

type Params = Record<string, string>;
type ScreenFactory = (params: Params) => Screen;

interface Route {
  parts: string[];
  create: ScreenFactory;
}

/** Hash router: "#/plans/:id" style patterns, so the app works on any static host without rewrites. */
export class Router {
  private readonly routes: Route[] = [];
  private current: Screen | undefined;
  private currentPath = "";

  constructor(private readonly root: HTMLElement) {
    window.addEventListener("hashchange", () => this.render());
  }

  add(pattern: string, create: ScreenFactory): this {
    this.routes.push({ parts: split(pattern), create });
    return this;
  }

  /** `replace` swaps the current history entry, so the back gesture skips the page being left. */
  go(path: string, replace = false): void {
    if (replace) location.replace(`#${path}`);
    else location.hash = path;
  }

  /** Re-renders the current path; keeps scroll position when the path didn't change. */
  render(): void {
    const path = location.hash.slice(1) || "/";
    const samePath = path === this.currentPath;
    const scroll = window.scrollY;
    const [route, params] = this.match(path) ?? this.match("/")!;
    this.current?.dispose?.();
    this.current = route.create(params);
    this.currentPath = path;
    this.root.replaceChildren(this.current.render());
    window.scrollTo(0, samePath ? scroll : 0);
  }

  private match(path: string): [Route, Params] | undefined {
    const parts = split(path);
    for (const route of this.routes) {
      if (route.parts.length !== parts.length) continue;
      const params: Params = {};
      const matched = route.parts.every((part, i) => {
        const actual = parts[i]!;
        if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(actual);
        return part.startsWith(":") || part === actual;
      });
      if (matched) return [route, params];
    }
    return undefined;
  }
}

function split(path: string): string[] {
  return path.split("/").filter(Boolean);
}
