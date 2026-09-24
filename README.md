# Gym Tracker

Single page workout tracker inspired by StrongLifts.
Runs fully in the browser; data is kept in `localStorage`, no backend and no running costs.

## Features

- Plans with days, drag to reorder, swipe to delete.
- Two logging styles per plan:
  - **Same weight** (StrongLifts style): one weight per exercise, tap circles to log reps.
  - **Weight per set**: reps and weight for every set (pyramids, top sets).
- Exercises are shared between days and plans, so progress carries over.
  Each exercise keeps separate sets and weights per logging style, so a plan can switch style without duplicating exercises.
- Auto-increment with global rules and per-exercise overrides (step, target reps, last set only).
- Rest timer, workout history with duration, kg/lbs, JSON backup export/import.
- Presets: StrongLifts 5×5 and Dorian Yates Blood & Guts.
- Tooltips on hover, or on long press on touch screens.

## Development

Requires Node 22+.

```sh
npm install
npm run dev      # local dev server with hot reload
npm test         # unit tests (vitest)
npm run build    # type-check and build the static site into dist/
```

## Code layout

- `src/model` – data types, presets, unit conversion.
- `src/services` – storage and workout/progression logic, no DOM access (unit tested).
- `src/ui` – router, reusable components and one class per screen.
- `tests` – unit tests.

## Hosting

`npm run build` produces a static site in `dist/` with relative paths, so it runs from any static host.

- **tiiny.host**: zip the contents of `dist/` and upload it.
  CI also builds it: open the latest CI run on GitHub and download the `gym-tracker-site` artifact.
- **GitHub Pages** (free, updates on every push): Settings → Pages → Source "GitHub Actions", then add a deploy workflow using `actions/deploy-pages`.

On a phone, open the site and use "Add to Home Screen" for a full screen app look.

Data lives in the browser it was entered in.
Use Settings → Export data for backups or to move to another device.
