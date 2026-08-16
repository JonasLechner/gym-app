# LiftNotes

A private, offline-first workout log inspired by FitNotes. Built with Expo and React Native for iPhone and the web.

## Install on iPhone for free (PWA)

The `main` branch is deployed to GitHub Pages automatically. After Pages is enabled in the repository settings, open:

**https://jonaslechner.github.io/gym-app/**

In Safari, tap **Share → Add to Home Screen → Add**. LiftNotes then opens from its own icon and works offline after its first successful load. No Expo Go, account, payment, or running PC is required.

App data stays in Safari storage on that iPhone. Use **More → Export backup** regularly. Clearing Safari website data or deleting the home-screen app may remove local data.

## Development

```bash
npm install
npm start
```

Scan the QR code with Expo Go, or press `w` for the web version. Create a production web build with `npm run build:web`.

## CSV import

Choose **More → Import FitNotes CSV**. The importer accepts the format of the included FitNotes export. Rows sharing a date become one workout, and duplicate sets are skipped on repeated imports.
