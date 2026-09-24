import { bothModes, DATA_VERSION } from "./presets";
import type { AppData, Exercise, SetSpec } from "./types";

type ExerciseV1 = Omit<Exercise, "schemes"> & { schemes?: Exercise["schemes"]; sets?: SetSpec[] };

/** Upgrades data saved by an older app version, in place. Throws on data from a newer version. */
export function migrate(data: AppData): AppData {
  if (data.version > DATA_VERSION) throw new Error(`Data version ${data.version} is newer than this app`);
  if (data.version === 1) {
    // v2: sets moved into one scheme per logging style.
    for (const exercise of data.exercises as ExerciseV1[]) {
      exercise.schemes = bothModes(exercise.sets ?? []);
      delete exercise.sets;
    }
    data.version = 2;
  }
  return data;
}
