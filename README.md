# MailcowMobile

A mobile email / calendar / tasks / contacts client for [Mailcow](https://mailcow.email) servers, built with **Expo + React Native + Expo Router + TypeScript**.

> ***All credit for the server backend goes to Mailcow. Without a server we couldn't have any client.***
> ***JAWS Developers is neither affiliated nor partnered with Mailcow at this time, and the code is not considered ready for end-user use. There will be no builds until it is safe to use!***

## Features

| Feature | Status |
|---------|--------|
| 📧 Email — read (IMAP) | 🟡 UI + mock service |
| 📧 Email — send (SMTP) | 🟡 UI + mock service |
| 📧 Folders, reply, forward, delete | 🟡 UI complete |
| 📅 Calendar (CalDAV) | 🟡 UI + mock service |
| ✅ Tasks (CalDAV / VTODO) | 🟡 UI + mock service |
| 👥 Contacts (CardDAV) | 🟡 UI + mock service |
| 🔐 Login / credential storage | 🟡 UI complete |
| ⚙️ Settings | 🟡 UI complete |

> 🟡 = UI is built; real network protocol is stubbed and ready to implement.

## Quick start (development)

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Android Studio](https://developer.android.com/studio) and/or Xcode (for native simulators)

```bash
npm install
npx expo start
```

Then scan the QR code with the [Expo Go](https://expo.dev/go) app, or press `a` for Android / `i` for iOS simulator.

## Building for distribution (EAS Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Build preview APK (Android)
eas build --platform android --profile preview

# Build preview IPA (iOS)
eas build --platform ios --profile preview
```

See [Expo Application Services](https://expo.dev/eas) for full documentation.

## Project structure

```
app/
  (auth)/login.tsx        ← Login screen
  (tabs)/
    index.tsx             ← Email inbox
    calendar.tsx          ← Calendar view
    tasks.tsx             ← Tasks view
    contacts.tsx          ← Contacts view
    settings.tsx          ← Settings
  email/
    [id].tsx              ← Email detail + reply/forward/delete
    compose.tsx           ← Compose new email
components/               ← Reusable UI components
services/                 ← IMAP / SMTP / CalDAV / CardDAV service layer
store/                    ← Zustand state management
types/                    ← TypeScript type definitions
constants/Colors.ts       ← Light/dark theme colours
```

## Architecture notes

- **Expo Router** (file-based routing, similar to Next.js but for React Native)
- **Zustand** for lightweight state management
- **Service layer** (`services/`) provides the API contract for IMAP, SMTP, CalDAV, and CardDAV. Current implementations return mock data; replace with native socket modules or proxy API calls.
- **No hard-coded credentials** — passwords are stored via `expo-secure-store`

## Testing

```bash
npm test
```

## Linting

```bash
npm run lint
```

## TypeScript check

```bash
npm run typecheck
```
