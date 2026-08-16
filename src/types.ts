export type SetEntry = {
  id: string;
  weight: number;
  reps: number;
  comment?: string;
};

export type ExerciseEntry = {
  id: string;
  name: string;
  category: string;
  sets: SetEntry[];
};

export type Workout = {
  id: string;
  date: string; // YYYY-MM-DD
  exercises: ExerciseEntry[];
  note?: string;
};

export type ExerciseDefinition = { id: string; name: string; category: string };
export type Routine = { id: string; name: string; exerciseIds: string[] };
export type Settings = { restSeconds: number; timerEnabled: boolean };
export type AppData = {
  workouts: Workout[];
  exercises: ExerciseDefinition[];
  routines: Routine[];
  settings: Settings;
};
