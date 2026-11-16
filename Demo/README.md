# MetroLMS — Isolated MSW v2 Demo API (`Demo/`)

This directory isolates the temporary **MSW v2 (Mock Service Worker)** API simulation layer (`Demo/mocks/` and `Demo/public/mockServiceWorker.js`) from the production `frontend/` React 19 application.

## Structure

- `Demo/mocks/` — MSW browser/server workers, domain handlers, fixtures, and in-memory store.
- `Demo/public/mockServiceWorker.js` — Service Worker script served only in Demo mode.

## Running Modes

- **Real Django Backend Mode (Default):**
  ```bash
  cd frontend
  npm run dev
  ```
  MSW is **disabled**. `/api/*` requests are proxied to Django (`VITE_API_TARGET`, default `http://127.0.0.1:8000`).

- **Isolated Demo Mode (MSW v2):**
  ```bash
  cd frontend
  npm run dev:demo
  ```
  Loads `Demo/mocks/browser.ts` and serves `/mockServiceWorker.js` from `Demo/public/`.

