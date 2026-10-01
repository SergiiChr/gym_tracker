const STORAGE_KEY = "gym-tracker-log";
/** Caps a day with a repeating error, so the log can't crowd out workout data in storage. */
const MAX_ENTRIES = 100;

type Level = "error" | "warn";

/**
 * Keeps today's latest errors and warnings across reloads, so they can be exported from settings.
 * Entries from earlier days are dropped on load and on the next write.
 * Storage failures are ignored: logging must never break the app, and entries still live in memory.
 */
class Log {
  private entries: string[] = load();

  error(message: string, cause?: unknown): void {
    this.add("error", message, cause);
  }

  warn(message: string, cause?: unknown): void {
    this.add("warn", message, cause);
  }

  get size(): number {
    return this.entries.length;
  }

  text(): string {
    return this.entries.join("\n");
  }

  clear(): void {
    this.entries = [];
    persist(this.entries);
  }

  private add(level: Level, message: string, cause: unknown): void {
    console[level](message, cause ?? "");
    this.entries = [...this.entries.filter(isToday), `${new Date().toISOString()} ${level.toUpperCase()} ${message}${describe(cause)}`].slice(-MAX_ENTRIES);
    persist(this.entries);
  }
}

/** Safari's stack has no message line, so the message is always written first. */
function describe(cause: unknown): string {
  if (cause === undefined) return "";
  if (!(cause instanceof Error)) return `: ${String(cause)}`;
  return `: ${cause.name}: ${cause.message}${cause.stack ? `\n${cause.stack}` : ""}`;
}

/** Entries start with their ISO timestamp; the day is compared in local time, like the user's day. */
function isToday(entry: string): boolean {
  return new Date(entry.split(" ", 1)[0]!).toDateString() === new Date().toDateString();
}

function load(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]).filter(isToday);
  } catch {
    return [];
  }
}

function persist(entries: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage is blocked or full; entries stay in memory for this page load.
  }
}

export const log = new Log();
