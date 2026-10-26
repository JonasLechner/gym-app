# LiftNotes

A private, offline-first workout log inspired by FitNotes. Built with Expo and React Native for
iPhone and the web.

## Install on iPhone for free (PWA)

The `main` branch is deployed to GitHub Pages automatically. After Pages is enabled in the
repository settings, open:

**https://jonaslechner.github.io/gym-app/**

In Safari, tap **Share → Add to Home Screen → Add**. LiftNotes then opens from its own icon and
works offline after its first successful load. No Expo Go, account, payment, or running PC is
required.

App data stays in Safari storage on that iPhone. By default, finishing a workout also exports a
backup, alternating between `LiftNotes-backup-A.json` and `LiftNotes-backup-B.json`. Always save
both in the same Files folder and choose **Replace** when iOS asks. This keeps the newest two backup
generations outside Safari. Clearing Safari website data or deleting the home-screen app may remove
its working data, which can then be restored from either backup.

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

Keep React and storage APIs out of workout-state transformations. The store retains its existing
persistence exports for compatibility; new browser-persistence callers should import
`workoutStorage` directly.

Run focused persistence and record tests without React Native:

```bash
npx tsx --test src/workoutState.test.ts src/features/workout/exerciseRecords.test.ts
```

## CSV import

Choose **More → Import FitNotes CSV**. The importer accepts the format of the included FitNotes
export. Rows sharing a date become one workout, and duplicate sets are skipped on repeated imports.
