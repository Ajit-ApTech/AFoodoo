# AFoodoo Backend API

This repository contains the Node.js/Express backend for the AFoodoo tiffin‑meal booking platform. It uses **Firebase Firestore** as the primary datastore and the **Firebase Admin SDK** for authentication, real‑time data, and push notifications (FCM).

## Prerequisites
- Node.js ≥ 20 (recommended)
- A Firebase project with the following services enabled:
  - Firestore (in Production mode)
  - Authentication (Phone provider)
  - Cloud Messaging
  - Cloud Storage (optional for menu images)
- Service‑account JSON file (`serviceAccountKey.json`) placed at the project root, or set `GOOGLE_APPLICATION_CREDENTIALS` env var (see `.env.example`).

## Setup
```bash
# Clone the repo (skip if already in the workspace)
# cd into the backend folder
cd backend

# Install dependencies
npm install

# Build the TypeScript sources
npm run build

# Run development server (auto‑restart on changes)
npm run dev
```

The server listens on `PORT` (default `8080`). Health check: `GET /health`.

## Project Structure
```
backend/
├─ src/
│  ├─ app.ts               # Express bootstrap, middleware, route registration
│  ├─ firebase.ts          # Firebase Admin SDK initialisation
│  ├─ types.ts             # TypeScript interfaces matching Firestore schema
│  └─ routes/
│     ├─ users.ts
│     ├─ mealSlots.ts
│     ├─ menuItems.ts
│     ├─ orders.ts
│     └─ subscriptions.ts
├─ tests/                  # Jest tests (add cutoff validation tests here)
├─ package.json
├─ tsconfig.json
└─ Dockerfile (optional)
```

## Running Tests
```bash
npm test
```

Add your Jest test files under `tests/`.

## Docker (optional)
A `Dockerfile` is provided for containerised deployment. Build and run:
```bash
docker build -t afoodoo-backend .
docker run -p 8080:8080 afoodoo-backend
```

## Next Steps
- Implement full CRUD for each collection.
- Add business‑logic endpoints (order placement with cutoff validation, subscription pause, etc.).
- Write comprehensive Jest tests, especially for cutoff edge cases.
- Hook up FCM notifications for slot opening, order status updates, etc.
