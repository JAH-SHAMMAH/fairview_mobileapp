# Fairview Portal – Mobile App

React Native (Expo + TypeScript) companion to the ExtraCare / Fairview School web portal. It talks to the **same backend** as the web app, so logins and data are shared.

## Status

| Role | Screens |
|------|---------|
| Parent | Dashboard, My children, report card (term/report pickers), attendance history, pay fees (Paystack/Flutterwave/Remita) |
| Student | Dashboard (today's lessons), exam room (timer, auto-submit, MCQ / true-false / written), exam list, progress |
| Teacher | Dashboard (classes, today's lessons), mark attendance |
| Admin / Super User | School overview, mark attendance, news feed (Super User can delete any post) |
| Everyone | News feed, notices, account / sign out |

Not yet in the app: file-upload exam answers, practice (JAMB/WAEC) tests, report entry, push notifications. Use the web portal for those. Nothing here has been tested on a device yet.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the Play Store / App Store.
2. On your computer: `npm install` then `npx expo start`.
3. Scan the QR code with Expo Go (same Wi-Fi). If your network blocks it, use `npx expo start --tunnel`.

## Configuration

Copy `.env.example` to `.env` to point at another server:

```
EXPO_PUBLIC_API_URL=https://fairview-portal.onrender.com
```

`EXPO_PUBLIC_*` values are bundled into the app and visible to anyone, so **never put passwords, tokens or connection strings in them or in any tracked file**. Login tokens are stored on the device in the secure keychain (`expo-secure-store`).

## Project layout

```
app/            screens (expo-router): login, (app)/ tabs per role
src/lib/        api client (auto token refresh), auth, role context, theme
src/components/ shared UI
```

## Checks

`npm run typecheck`

## Build for Android and iOS (EAS)

One codebase builds both apps in Expo's cloud (no Mac needed for iOS):

```
npm i -g eas-cli
eas login
eas build:configure
eas build --profile preview --platform android   # installable .apk to test
eas build --profile production --platform all    # store builds (.aab + iOS)
eas submit --platform android|ios                # upload to the stores
```

Accounts needed: Expo (free), Google Play Console (one-time $25), Apple Developer Program ($99/year, required for iOS installs outside Expo Go).
