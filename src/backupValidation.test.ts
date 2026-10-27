import assert from 'node:assert/strict';
import test from 'node:test';
import { backupSummary, validateBackup } from './backupValidation';
import type { AppData } from './types';

const valid = (): AppData => ({
  workouts: [
    {
      id: 'workout',
      date: '2026-01-01',
      note: 'Keep this note',
      draft: false,
      exercises: [
        {
          id: 'entry',
          name: 'Bench',
          category: 'Chest',
          sets: [{ id: 'set', weight: 60.25, reps: 8, comment: 'Keep this comment' }],
        },
      ],
    },
  ],
  exercises: [{ id: 'definition', name: 'Bench', category: 'Chest' }],
  routines: [{ id: 'routine', name: 'A', exerciseIds: ['definition'] }],
  customCategories: [{ id: 'category', name: 'Custom', color: '#abcdef' }],
  settings: {
    restSeconds: 120,
    timerEnabled: true,
    backupAfterWorkout: true,
    nextBackupSlot: 'A',
    exerciseDefaultsVersion: 1,
    lastBackupAt: '2026-01-01T10:00:00.000Z',
  },
});

test('valid backups round-trip without changing values or mutating the source', () => {
  const source = valid();
  const before = structuredClone(source);
  const parsed = validateBackup(source);
  assert.deepEqual(parsed, source);
  assert.deepEqual(source, before);
  assert.notEqual(parsed, source);
  assert.notEqual(parsed.workouts[0], source.workouts[0]);
  assert.deepEqual(backupSummary(parsed), { workouts: 1, days: 1, sets: 1 });
});

test('known older backups receive only explicit legacy defaults', () => {
  const source: any = valid();
  delete source.routines;
  delete source.customCategories;
  delete source.settings.nextBackupSlot;
  delete source.settings.exerciseDefaultsVersion;
  delete source.workouts[0].draft;
  delete source.workouts[0].note;
  const parsed = validateBackup(source);
  assert.deepEqual(parsed.routines, []);
  assert.deepEqual(parsed.customCategories, []);
  assert.equal(parsed.settings.nextBackupSlot, 'A');
  assert.equal(parsed.settings.exerciseDefaultsVersion, 0);
  assert.equal('draft' in parsed.workouts[0]!, false);
  assert.equal('note' in parsed.workouts[0]!, false);
});

test('empty databases and empty drafts are valid, but empty completed sessions are not', () => {
  const source = valid();
  source.workouts = [];
  assert.equal(validateBackup(source).workouts.length, 0);
  const draft = { ...valid().workouts[0]!, draft: true, exercises: [] };
  source.workouts = [draft];
  assert.equal(validateBackup(source).workouts[0]?.draft, true);
  assert.throws(
    () => validateBackup({ ...source, workouts: [{ ...draft, draft: false }] }),
    /completed but has no sets/,
  );
});

test('same-day legacy sessions remain available for the lossless day migration', () => {
  const source = valid();
  source.workouts.push({ ...structuredClone(source.workouts[0]!), id: 'second' });
  assert.deepEqual(backupSummary(validateBackup(source)), { workouts: 2, days: 1, sets: 2 });
});

const mutations: [string, (data: any) => void][] = [
  [
    'missing workouts',
    (data) => {
      delete data.workouts;
    },
  ],
  [
    'workouts not an array',
    (data) => {
      data.workouts = {};
    },
  ],
  [
    'unknown future root field',
    (data) => {
      data.unknown = 'unsupported';
    },
  ],
  [
    'invalid calendar day',
    (data) => {
      data.workouts[0].date = '2026-02-30';
    },
  ],
  [
    'malformed date',
    (data) => {
      data.workouts[0].date = '01.01.2026';
    },
  ],
  [
    'missing workout ID',
    (data) => {
      delete data.workouts[0].id;
    },
  ],
  [
    'duplicate workout IDs',
    (data) => {
      data.workouts.push(structuredClone(data.workouts[0]));
    },
  ],
  [
    'draft not boolean',
    (data) => {
      data.workouts[0].draft = 'false';
    },
  ],
  [
    'missing exercise sets',
    (data) => {
      delete data.workouts[0].exercises[0].sets;
    },
  ],
  [
    'negative weight',
    (data) => {
      data.workouts[0].exercises[0].sets[0].weight = -1;
    },
  ],
  [
    'weight is a string',
    (data) => {
      data.workouts[0].exercises[0].sets[0].weight = '60';
    },
  ],
  [
    'non-finite weight',
    (data) => {
      data.workouts[0].exercises[0].sets[0].weight = Infinity;
    },
  ],
  [
    'fractional reps',
    (data) => {
      data.workouts[0].exercises[0].sets[0].reps = 1.5;
    },
  ],
  [
    'negative reps',
    (data) => {
      data.workouts[0].exercises[0].sets[0].reps = -1;
    },
  ],
  [
    'duplicate set IDs',
    (data) => {
      data.workouts[0].exercises[0].sets.push(
        structuredClone(data.workouts[0].exercises[0].sets[0]),
      );
    },
  ],
  [
    'invalid set comment',
    (data) => {
      data.workouts[0].exercises[0].sets[0].comment = null;
    },
  ],
  [
    'invalid note',
    (data) => {
      data.workouts[0].note = 123;
    },
  ],
  [
    'duplicate definition IDs',
    (data) => {
      data.exercises.push({ ...data.exercises[0], name: 'Squat' });
    },
  ],
  [
    'ambiguous definition names',
    (data) => {
      data.exercises.push({ ...data.exercises[0], id: 'other', name: 'bench' });
    },
  ],
  [
    'dangling routine reference',
    (data) => {
      data.routines[0].exerciseIds = ['missing'];
    },
  ],
  [
    'invalid category color',
    (data) => {
      data.customCategories[0].color = 'not-a-color';
    },
  ],
  [
    'settings missing',
    (data) => {
      delete data.settings;
    },
  ],
  [
    'rest duration invalid',
    (data) => {
      data.settings.restSeconds = 0;
    },
  ],
  [
    'timer enabled not boolean',
    (data) => {
      data.settings.timerEnabled = 'yes';
    },
  ],
  [
    'backup enabled not boolean',
    (data) => {
      data.settings.backupAfterWorkout = 1;
    },
  ],
  [
    'unknown backup slot',
    (data) => {
      data.settings.nextBackupSlot = 'C';
    },
  ],
  [
    'invalid last backup date',
    (data) => {
      data.settings.lastBackupAt = 'nonsense';
    },
  ],
  [
    'invalid defaults version',
    (data) => {
      data.settings.exerciseDefaultsVersion = -1;
    },
  ],
];
for (const [name, mutate] of mutations) {
  test(`rejects ${name} without modifying the input`, () => {
    const source = valid();
    mutate(source);
    const before = structuredClone(source);
    assert.throws(() => validateBackup(source), /Invalid backup:/);
    assert.deepEqual(source, before);
  });
}

test('unrelated JSON, scalars and null cannot be mistaken for an empty backup', () => {
  for (const input of [{}, null, [], 'backup', 123, { hello: 'world' }])
    assert.throws(() => validateBackup(input), /Invalid backup:/);
});
