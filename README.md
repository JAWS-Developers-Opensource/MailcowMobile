# MailcowMobile

## Stay Connected to Your Email Anywhere

The **Mailcow Client** is an unofficial mobile application designed to provide users with a convenient way to access and manage their Mailcow email accounts on mobile devices. With the Mailcow Client, users can easily view their inbox, read and compose emails, manage folders, and stay connected to their email accounts while on the go. The app offers a user-friendly interface and seamless integration with Mailcow's powerful email server, allowing users to stay productive and organized no matter where they are.

### Built with modern technologies
A mobile email / calendar / tasks / contacts client for [Mailcow](https://mailcow.email) servers, built with **Expo + React Native + Expo Router + TypeScript**.

---

## Join the Alpha

Interested in testing the app? **[Click here to join the alpha program](https://nextcloud.jawsdevelopers.ch/apps/forms/embed/jJmoZQBr92Nidz62po2zmryD)**

---

> ***All credit for the server backend goes to Mailcow. Without a server we couldn't have any client.***
> ***JAWS Developers is neither affiliated nor partnered with Mailcow at this time, and the code is not considered ready for end-user use. There will be no builds until it is safe to use!***

## Features

| Feature | Status |
|---------|--------|
| Email — read (IMAP) | 🟢 Needs security check |
| Email — send (SMTP) | 🟢 Needs security check |
| Folders, reply, forward, delete, drafts | 🟢 Needs security check |
| Calendar (CalDAV) | 🟢 Needs security check |
| Tasks (CalDAV / VTODO) | 🟢 Needs security check |
| Contacts (CardDAV) | 🟢 Needs security check |
| Login / credential storage | 🟢 Needs security check |
| Settings | 🟡 UI complete |

> 🟢 = Feature is connected directly to the user's Mailcow server (no backend proxy).

## Quick start (development)

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Android Studio](https://developer.android.com/studio) and/or Xcode (for native simulators)
- Custom Expo Dev Client or production build (required for native socket modules)

```bash
npm install
npx expo prebuild
npx expo run:android   # or: npx expo run:ios
npm run start:dev-client
```

> `react-native-tcp-socket` (used for IMAP/SMTP) is a native module and does not run in Expo Go.

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
- **Service layer** (`services/`) performs direct IMAP / SMTP / CalDAV / CardDAV operations against the user's Mailcow server.
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
