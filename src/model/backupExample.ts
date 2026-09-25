/** Smallest backup that imports cleanly; shown on the Backup screen and covered by a test. */
export const MINIMAL_BACKUP = `{
  "version": 3,
  "exercises": [{
    "id": "squat",
    "name": "Squat",
    "schemes": {
      "fixed": [
        { "reps": 5, "weight": 60 }
      ]
    }
  }],
  "plans": [{
    "id": "plan1",
    "name": "My plan",
    "mode": "fixed",
    "days": [{
      "id": "dayA",
      "name": "Day A",
      "exerciseIds": ["squat"]
    }]
  }]
}`;
