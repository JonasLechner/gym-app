import type { AppData, Workout } from './types';

function fail(path: string, message: string): never {
  throw new Error(`Invalid backup: ${path} ${message}`);
}

function object(value: unknown, path: string, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail(path, 'must be an object.');
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (!fields.includes(key)) fail(`${path}.${key}`, 'is not a supported field.');
  }
  return result;
}

function array(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : fail(path, 'must be an array.');
}

function text(value: unknown, path: string, allowEmpty = false): string {
  return typeof value === 'string' && (allowEmpty || value.trim().length > 0)
    ? value
    : fail(path, 'must be a string' + (allowEmpty ? '.' : ' that is not empty.'));
}

function optionalText(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : text(value, path, true);
}

function number(value: unknown, path: string, minimum = 0, integer = false): number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    (!integer || Number.isSafeInteger(value))
    ? value
    : fail(path, `must be a finite ${integer ? 'integer' : 'number'} of at least ${minimum}.`);
}

function boolean(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : fail(path, 'must be true or false.');
}

function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, 'contains duplicates.');
}

function calendarDate(value: unknown, path: string): string {
  const date = text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000'))
    return fail(path, 'must be a real date in YYYY-MM-DD format.');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    return fail(path, 'is not a real calendar date.');
  return date;
}

/** Validate before normalization, download, or replacement. Never coerce malformed data. */
export function validateBackup(input: unknown): AppData {
  const root = object(input, 'backup', [
    'workouts',
    'exercises',
    'routines',
    'customCategories',
    'settings',
  ]);
  const workouts = array(root.workouts, 'workouts').map((value, index): Workout => {
    const path = `workouts[${index}]`;
    const item = object(value, path, ['id', 'date', 'exercises', 'draft', 'note']);
    const exercises = array(item.exercises, `${path}.exercises`).map((value, index) => {
      const entryPath = `${path}.exercises[${index}]`;
      const entry = object(value, entryPath, ['id', 'name', 'category', 'sets']);
      const sets = array(entry.sets, `${entryPath}.sets`).map((value, index) => {
        const setPath = `${entryPath}.sets[${index}]`;
        const set = object(value, setPath, ['id', 'weight', 'reps', 'comment']);
        const comment = optionalText(set.comment, `${setPath}.comment`);
        return {
          id: text(set.id, `${setPath}.id`),
          weight: number(set.weight, `${setPath}.weight`),
          reps: number(set.reps, `${setPath}.reps`, 0, true),
          ...(comment === undefined ? {} : { comment }),
        };
      });
      return {
        id: text(entry.id, `${entryPath}.id`),
        name: text(entry.name, `${entryPath}.name`),
        category: text(entry.category, `${entryPath}.category`),
        sets,
      };
    });
    unique(
      exercises.map((entry) => entry.id),
      `${path}.exercise IDs`,
    );
    unique(
      exercises.flatMap((entry) => entry.sets.map((set) => set.id)),
      `${path}.set IDs`,
    );
    const draft = item.draft === undefined ? undefined : boolean(item.draft, `${path}.draft`);
    const note = optionalText(item.note, `${path}.note`);
    if (!draft && !exercises.some((entry) => entry.sets.length > 0))
      fail(path, 'is completed but has no sets.');
    return {
      id: text(item.id, `${path}.id`),
      date: calendarDate(item.date, `${path}.date`),
      exercises,
      ...(draft === undefined ? {} : { draft }),
      ...(note === undefined ? {} : { note }),
    };
  });
  unique(
    workouts.map((workout) => workout.id),
    'workout IDs',
  );

  const exercises = array(root.exercises, 'exercises').map((value, index) => {
    const path = `exercises[${index}]`;
    const item = object(value, path, ['id', 'name', 'category']);
    return {
      id: text(item.id, `${path}.id`),
      name: text(item.name, `${path}.name`),
      category: text(item.category, `${path}.category`),
    };
  });
  unique(
    exercises.map((entry) => entry.id),
    'exercise definition IDs',
  );
  unique(
    exercises.map((entry) => entry.name.trim().toLowerCase()),
    'exercise definition names',
  );

  const routines = array(root.routines === undefined ? [] : root.routines, 'routines').map(
    (value, index) => {
      const path = `routines[${index}]`;
      const item = object(value, path, ['id', 'name', 'exerciseIds']);
      const exerciseIds = array(item.exerciseIds, `${path}.exerciseIds`).map((value, index) =>
        text(value, `${path}.exerciseIds[${index}]`),
      );
      for (const id of exerciseIds) {
        if (!exercises.some((exercise) => exercise.id === id))
          fail(`${path}.exerciseIds`, 'references an unknown exercise.');
      }
      return {
        id: text(item.id, `${path}.id`),
        name: text(item.name, `${path}.name`),
        exerciseIds,
      };
    },
  );
  unique(
    routines.map((routine) => routine.id),
    'routine IDs',
  );

  const customCategories = array(
    root.customCategories === undefined ? [] : root.customCategories,
    'customCategories',
  ).map((value, index) => {
    const path = `customCategories[${index}]`;
    const item = object(value, path, ['id', 'name', 'color']);
    const color = text(item.color, `${path}.color`);
    if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color))
      fail(`${path}.color`, 'must be a hexadecimal color.');
    return { id: text(item.id, `${path}.id`), name: text(item.name, `${path}.name`), color };
  });
  unique(
    customCategories.map((category) => category.id),
    'custom category IDs',
  );
  unique(
    customCategories.map((category) => category.name.trim().toLowerCase()),
    'custom category names',
  );

  const settings = object(root.settings, 'settings', [
    'restSeconds',
    'timerEnabled',
    'backupAfterWorkout',
    'nextBackupSlot',
    'lastBackupAt',
    'exerciseDefaultsVersion',
  ]);
  const slot = settings.nextBackupSlot === undefined ? 'A' : settings.nextBackupSlot;
  if (slot !== 'A' && slot !== 'B') fail('settings.nextBackupSlot', 'must be A or B.');
  const lastBackupAt = optionalText(settings.lastBackupAt, 'settings.lastBackupAt');
  if (lastBackupAt !== undefined && !Number.isFinite(Date.parse(lastBackupAt)))
    fail('settings.lastBackupAt', 'must be a valid timestamp.');
  return {
    workouts,
    exercises,
    routines,
    customCategories,
    settings: {
      restSeconds: number(settings.restSeconds, 'settings.restSeconds', 1, true),
      timerEnabled: boolean(settings.timerEnabled, 'settings.timerEnabled'),
      backupAfterWorkout: boolean(settings.backupAfterWorkout, 'settings.backupAfterWorkout'),
      nextBackupSlot: slot,
      exerciseDefaultsVersion:
        settings.exerciseDefaultsVersion === undefined
          ? 0
          : number(settings.exerciseDefaultsVersion, 'settings.exerciseDefaultsVersion', 0, true),
      ...(lastBackupAt === undefined ? {} : { lastBackupAt }),
    },
  };
}

export function backupSummary(data: AppData) {
  return {
    workouts: data.workouts.length,
    days: new Set(data.workouts.map((workout) => workout.date)).size,
    sets: data.workouts.reduce(
      (total, workout) =>
        total + workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
      0,
    ),
  };
}
