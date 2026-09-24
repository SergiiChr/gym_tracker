# Gym Tracker

Single page workout tracker.
Runs fully in the browser; data is kept in `localStorage`, no backend and no running costs.

## Features

- Plans with days, drag to reorder, swipe to delete.
- Two logging styles per plan:
  - **Same weight**: one weight per exercise, tap circles to log reps.
  - **Weight per set**: reps and weight for every set (pyramids, top sets).
- Exercises are shared between days and plans, so progress carries over.
  Each exercise keeps separate sets and weights per logging style, so a plan can switch style without duplicating exercises.
- Auto-increment with global rules and per-exercise overrides (step, target reps, last set only).
- Rest timer, workout history with duration, kg/lbs, JSON backup export/import.
- Presets: 5×5 A/B and HIT 4-day split.
- Tooltips on hover, or on long press on touch screens.

## Development

Requires Node 22+.

```sh
npm install
npm run dev      # local dev server with hot reload
npm test         # unit tests (vitest)
npm run build    # type-check and build the static site into dist/
npm run build:single  # same, plus one self-contained file in dist-single/
```

## Code layout

- `src/model` – data types, presets, unit conversion.
- `src/services` – storage and workout/progression logic, no DOM access (unit tested).
- `src/ui` – router, reusable components and one class per screen.
- `tests` – unit tests.

## Hosting

The build uses relative paths, so it runs from any static host.

**GitHub Pages** (default): every push to `main` runs the tests and deploys `dist/` via `.github/workflows/pages.yml`.
One-time setup: repo Settings → Pages → Source: "GitHub Actions".
The site is then at `https://<user>.github.io/gym_tracker/`.

**Single file** (tiiny.host or any host that takes one file): `npm run build:single` writes a self-contained `dist-single/index.html` with scripts, styles and icons inlined.
Pull request CI also builds it: download the `gym-tracker-single-file` artifact from the run page.

On a phone, open the site and use "Add to Home Screen" for a full screen app look.
On iPhone this also keeps the data safe: Safari deletes storage of websites not visited for 7 days, but not of Home Screen apps.
The Home Screen app and the Safari tab keep separate data.

Data lives in the browser it was entered in.
Use Settings → Export data for backups or to move to another device.
