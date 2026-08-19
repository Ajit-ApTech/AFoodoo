# 🍲 AFoodoo Tiffin Meal Booking Platform

> **AFoodoo** is a full-stack tiffin booking platform designed around fixed daily cutoff windows (Lunch 8–11 AM, Dinner 5–7 PM), real-time delivery status tracking, wallet checkout, subscription pack management, and an operational Admin Web Portal connected directly to Real Cloud Firebase.

---

## 🏗️ Architecture & Technology Stack

- **Mobile App**: React Native (Expo SDK 53) with Zustand state management, ThemeContext (System/Light/Dark mode), and dynamic host config (`http://10.0.2.2:8080/api` for Android emulator).
- **Admin Web Portal**: Next.js 14 App Router + Tailwind CSS + Recharts + React Query, connected directly to Real Cloud Firebase (Firestore, Auth, and Storage).
- **Backend API**: Node.js + Express + TypeScript, Firebase Admin SDK (Cloud Firestore & FCM push triggers).
- **Security & Hardening**: Helmet HTTP security headers, CORS origin whitelist, `express-rate-limit` rate-limiting, and Winston structured JSON logging.
- **API Specification**: OpenAPI 3.0 with interactive Swagger UI (`http://localhost:8080/docs`).
- **DevOps & CI/CD**: Dockerfile multi-stage builds, `docker-compose.yml`, and GitHub Actions automated pipeline.

---

## ⚡ Quick-Start Guide

### 1. Backend API ⚙️
```bash
cd backend
npm install
npm run dev
```
- Server: `http://localhost:8080`
- Swagger Docs: `http://localhost:8080/docs`

### 2. Admin Web Portal (`admin/`) 💻
```bash
cd admin
npm install
npm run dev
```
- Open Web Portal: **[http://localhost:3000](http://localhost:3000)**
- Default Super Admin Credentials:
  - **Email**: `admin@afoodoo.com`
  - **Password**: `AdminPass123!`

### 3. Customer Mobile App (Expo) 📱
```bash
cd mobile
npm install
npx expo start --clear
```
- Press **`a`** to launch on connected Android Studio emulator or device.

---

## 🔑 Operational Admin Portal Modules

1. **Dashboard Snapshot & Live Counter**: Real-time counter of incoming orders before cutoff synced live with Cloud Firestore.
2. **Meal Slot & Cutoff Management**: Define booking-open, booking-cutoff, and delivery windows; edits update customer mobile app countdowns live.
3. **Food Menu & Photos (Cloud Firebase Storage)**: Upload food photos to Cloud Firebase Storage (`afoodoo.firebasestorage.app`), schedule weekly menus, and mark sold-out items.
4. **User Management & Wallet Auditing**: Searchable user directory, manual wallet credit/debit with mandatory audit log reason, and user blocking/flagging.
5. **Live Order Queue & Rider Zone Dispatch**: Order status progression (`Booked` → `Preparing` → `Out for Delivery` → `Delivered`), OTP verification viewer, and reusable container return tracking.
6. **Subscriptions Management**: View active subscription packs, pause/resume allocations, and credit bonus meals.
7. **Revenue & Performance Analytics**: Recharts visualizations for weekly revenue trends (Lunch vs. Dinner), top dishes, zone breakdowns, rider performance, and CSV report export.
8. **Push Broadcaster**: Dispatch targeted FCM notifications to all mobile users or customer segments.
9. **System Audit Logs**: Immutable audit log of all wallet overrides, cutoff changes, user bans, and price edits.

---

## 📖 API Documentation & Swagger Spec

When the backend server is running, view interactive OpenAPI Swagger documentation at:
👉 **[http://localhost:8080/docs](http://localhost:8080/docs)**
