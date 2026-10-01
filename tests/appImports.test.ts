import { describe, expect, it } from "vitest";

/** Source of every app file, keyed by its path from this folder, like "../src/main.ts". */
const SOURCES = import.meta.glob<string>("../src/**/*.ts", { query: "?raw", import: "default", eager: true });
const SRC = new URL("../src/", import.meta.url).href;
/** Static imports and re-exports, including side effect only ones like `import "./styles.css"`. */
const IMPORT = /^\s*(?:import|export)\s(?:[^;"']*?\sfrom\s+)?["']([^"']+)["']/gm;

/**
 * The app ships with no packages: everything it imports lives in src.
 * This keeps test and build tools (all devDependencies) out of the built app.
 */
describe("app imports", () => {
  it("finds the app's source files", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(10);
  });

  it("only imports files from src, never packages or tests", () => {
    const outside = Object.entries(SOURCES).flatMap(([file, source]) =>
      [...source.matchAll(IMPORT)]
        .map((match) => match[1]!)
        .filter((path) => !path.startsWith(".") || !new URL(path, new URL(file, import.meta.url)).href.startsWith(SRC))
        .map((path) => `${file} imports ${path}`),
    );
    expect(outside).toEqual([]);
  });
});
