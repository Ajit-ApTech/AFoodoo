# 🍲 AFoodoo Tiffin Meal Booking Platform

> **AFoodoo** is a full-stack tiffin booking platform designed around fixed daily cutoff windows (Lunch 8–11 AM, Dinner 5–7 PM), real-time delivery status tracking, wallet checkout, and subscription pack management.

---

## 🏗️ Architecture & Technology Stack

- **Mobile App**: React Native (Expo SDK 53) with Zustand state management & dynamic host config (`http://10.0.2.2:8080/api` for Android emulator).
- **Backend**: Node.js + Express + TypeScript, Firebase Admin SDK (Cloud Firestore & FCM).
- **Security & Hardening**: Helmet HTTP security headers, CORS origin whitelist, `express-rate-limit` rate-limiting, and Winston structured JSON logging.
- **API Specification**: OpenAPI 3.0 with interactive Swagger UI (`http://localhost:8080/docs`).
- **DevOps & CI/CD**: Dockerfile multi-stage builds, `docker-compose.yml`, and GitHub Actions automated pipeline.

---

## ⚡ Quick-Start Guide

### Option 1: One-Click Docker Setup 🐳
Run the backend and local emulators with single command:
```bash
docker-compose up --build
```
- **Backend API**: `http://localhost:8080`
- **Swagger Documentation**: `http://localhost:8080/docs`

---

### Option 2: Local Development Setup 💻

#### 1. Backend API
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

#### 2. Mobile App (Expo)
```bash
cd mobile
npm install
npx expo start --clear
```
- Press **`a`** to launch on connected Android Studio emulator or device.

---

## 📖 API Documentation & Swagger Spec

When the backend server is running, view interactive OpenAPI Swagger documentation at:
👉 **[http://localhost:8080/docs](http://localhost:8080/docs)**

### Key Endpoints:
- `GET /health` — Health check & timestamp
- `GET /metrics` — Basic request metrics & server uptime
- `POST /api/orders` — Place order with server-side cutoff time validation
- `POST /api/orders/{id}/pay` — Update payment status
- `GET /api/subscriptions` — Fetch user subscription packs
- `PATCH /api/subscriptions/{id}/pause` — Skip/pause specific day's meal

---

## 🧪 Testing & Quality Gates

Run automated Jest unit & integration tests:
```bash
cd backend
npm test
```

Run TypeScript compilation check across projects:
```bash
cd mobile && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

---

## 🚀 Production Deployment Guide

### 1. Deploying to Google Cloud Run ☁️
```bash
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT/afoodoo-backend ./backend
gcloud run deploy afoodoo-backend \
  --image gcr.io/YOUR_GCP_PROJECT/afoodoo-backend \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=8080
```

### 2. Deploying to Render / Railway
- Connect your GitHub repository: `https://github.com/Ajit-ApTech/AFoodoo.git`
- Select **Dockerfile** as build context `./backend`.
- Add environment variables (`NODE_ENV=production`, `PORT=8080`).

---

## 📄 License
MIT License © 2026 AFoodoo Team
