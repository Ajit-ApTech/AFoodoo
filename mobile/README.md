# AFoodoo Mobile (Expo) App

This folder contains the React Native (Expo) client for the AFoodoo tiffin‑meal booking platform.

## Prerequisites
- **Node.js ≥ 20**
- **Expo CLI** (install globally with `npm i -g expo-cli`)
- A Firebase project with the same services used by the backend (Firestore, Auth, Messaging). Ensure you have the web‑app config values (apiKey, authDomain, projectId, etc.).

## Getting Started
```bash
# From the repository root
cd mobile

# Install dependencies (Expo will handle native modules)
npm install

# Create an .env file (or copy the example) with your Firebase config:
cp .env.example .env
# Edit .env and replace placeholder values with your actual Firebase project values.

# Start the development server
npm start   # or: expo start
```

The app will open the Expo DevTools in your browser. You can run it on:
- **iOS simulator** (`i`), Android emulator (`a`), or a physical device (QR code).

## Project Structure
```
mobile/
├─ src/
│  ├─ App.tsx                # Root component with navigation
│  ├─ firebaseConfig.ts      # Firebase client initialisation (use env vars)
│  ├─ types.ts               # TypeScript interfaces mirroring backend models
│  ├─ store/
│  │   └─ appStore.ts        # Zustand global store (user, active slot, menu items)
│  └─ screens/
│      ├─ AuthScreen.tsx    # Phone‑OTP login (simplified placeholder)
│      ├─ HomeScreen.tsx    # Shows active slot, live countdown, navigation
│      └─ MenuScreen.tsx    # Lists menu items for the active slot, booking button
├─ package.json               # Expo dependencies and scripts
├─ tsconfig.json              # TypeScript configuration for the app
└─ app.json                   # Expo manifest (icon, splash, etc.)
```

## Next Steps
- Implement a real phone‑OTP flow using `FirebaseRecaptchaVerifierModal`.
- Add booking confirmation screen and order‑tracking UI.
- Wire up payment integration (wallet, top‑up, etc.).
- Expand navigation to include subscriptions, wallet, profile, and feedback screens.
- Add React Query hooks for data fetching (e.g., `useQuery(['mealSlots'])`).
- Write Jest + React Native Testing Library tests for each screen.

## Notes
- The client uses **real‑time Firestore listeners** to update the UI instantly when the admin changes slots or menu items.
- Push notifications are sent via **Firebase Cloud Messaging**; make sure the device token is stored under `users/<uid>/deviceTokens` on the backend.
- All timestamps are stored as Firestore `Timestamp` objects; the UI converts them to JavaScript `Date` via `.toDate()`.

Happy coding! 🚀
