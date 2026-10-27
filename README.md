# LiftNotes

A private, offline-first workout log inspired by FitNotes. Built with Expo and React Native for
iPhone and the web.

## Install on iPhone for free (PWA)

The `main` branch is deployed to GitHub Pages automatically. After Pages is enabled in the
repository settings, open:

**https://jonaslechner.github.io/gym-app/**

In Safari, tap **Share → Add to Home Screen → Add**. LiftNotes then opens from its own icon and
works offline once its first online visit has finished installing the offline cache. Keep it online
for that initial download. No Expo Go, account, payment, or running PC is required.

Production builds precache the complete app (HTML, JavaScript, fonts, icons, and manifest) with
content integrity checks. Updates install in a separate versioned cache and wait until existing app
windows are closed before activation, so an open workout keeps using its original build. After
downloading an update online, close all LiftNotes windows/tabs and reopen to use it.

App data stays in Safari storage on that iPhone. By default, finishing a workout also exports a
backup, alternating between `LiftNotes-backup-A.json` and `LiftNotes-backup-B.json`. Always save
both in the same Files folder and choose **Replace** when iOS asks. This keeps the newest two backup
generations outside Safari. Clearing Safari website data or deleting the home-screen app may remove
its working data, which can then be restored from either backup.

## Safely restore a JSON backup

Open **More → Restore backup** and select your JSON file. LiftNotes validates its structure, real
dates, IDs, finite weights, integer reps, routines, and settings before offering restoration.
Unrelated or malformed JSON is rejected without replacing local data.

1. Review the selected file's workout/set counts. Restoration **replaces**, rather than merges with,
   the data currently on this device.
2. Tap **Export current data first**. Save the uniquely named
   `LiftNotes-before-restore-<timestamp>.json` in Files, separately from the edited import and
   rotating A/B backups. A download starting does not prove the file has been saved.
3. Check **I saved the separate safety backup in Files**, then tap **Restore this backup** and
   confirm the replacement. Keep the safety copy until you have checked your restored history.

Close other LiftNotes windows during restoration. If local data changed after the safety export,
restoration stops and requires a fresh safety copy. A successful restore is reported only after
storage has finished writing. Supported older backups receive explicit legacy defaults; same-day
sessions follow the lossless merge policy below.

## Development

```bash
npm install
npm start
```

Scan the QR code with Expo Go, or press `w` for the web version. Create a production web build with
`npm run build:web`.

## Workout persistence boundaries

- `src/store.tsx` owns React state, loading/normalization, and store actions.
- `src/workoutState.ts` owns framework-free workout merging and adoption of saved web snapshots. ID
  generation is injected so tests can be deterministic.
- `src/workoutStorage.ts` owns synchronous browser reads/writes and the storage key shared with
  AsyncStorage. It merges a workout into the latest stored state; parse and storage failures
  propagate rather than falling back to stale data.
- `src/workoutPersistence.ts` coordinates completed-workout saving and rotating backups. Draft
  autosaves do not go through backup coordination.
- `src/backupValidation.ts` validates imported JSON without React or storage dependencies.
- `src/backupRestore.ts` owns safety-snapshot reads and guarded, awaited replacement writes;
  `src/useBackupRestore.ts` connects those operations to the export UI and store.

Keep React and storage APIs out of workout-state transformations. The store retains its existing
persistence exports for compatibility; new browser-persistence callers should import
`workoutStorage` directly.

Run behavior and offline-cache tests without React Native:

```bash
npx tsx --test src/backupValidation.test.ts src/backupRestore.test.ts src/dates.test.ts src/fitnotesImport.test.ts src/plates.test.ts src/workoutDays.test.ts src/workoutState.test.ts src/features/workout/exerciseRecords.test.ts src/features/records/personalRecords.test.ts
node --test scripts/offline.test.mjs
```

## One workout per day

Each date has at most one workout. Existing same-day sessions are merged on load/restore, retaining
all sets and combining notes. Exercises with the same name (case-insensitive) share one entry. If
any merged session is a draft, the whole day remains a draft until **Finish**. Moving a workout onto
an occupied date is rejected; selecting a date in Workout opens that date's existing workout.

## Personal records

Open **More → Personal records** for Squat, Bench, and Deadlift. The overview shows the heaviest set
for each lift, including its best reps at that weight and achievement date. Select a lift to see the
highest reps at each exact weight or its chronological weight/rep record history. Drafts and
zero-rep sets are excluded. Ties retain the first achievement date, and exercise variants are not
pooled. These records share their calculation rules with live workout trophies; estimated 1RM is not
a separate record category.

## CSV import

Choose **More → Import FitNotes CSV**. The importer accepts the format of the included FitNotes
export. Kilogram units are retained; pounds are converted to kilograms (rounded to six decimal
places). Missing/unsupported units and invalid weights reject the import before data is changed.
Rows sharing a date merge into that day's workout, retaining its draft status. Duplicate sets are
skipped on repeated imports, including imports into drafts; repeated identical sets within a single
export retain their original count.
