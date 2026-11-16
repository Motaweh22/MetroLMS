# MetroLMS — Frontend Demo Isolation, Error Message Audit & Hardening Report

> **Document Status:** `COMPLETED AND VERIFIED (2026-11-16)`  
> **Scope:** Repository Cleanup & `Demo/` Isolation + Reference-Based Frontend Error Handling & Production Guard Hardening  
> **Authoritative Error Reference:** [`docs/frontend/loading-and-error-handling.md`](../loading-and-error-handling.md) (§5) & [`sup-01-durable-acknowledgement-and-runtime-semantics-audit-v3-4.md`](sup-01-durable-acknowledgement-and-runtime-semantics-audit-v3-4.md) (L369)

---

## 1. Repository Cleanup & `Demo/` MSW v2 Isolation

- **Isolated MSW v2 Demo Layer into `Demo/`:**
  - Relocated `frontend/src/mocks/**` → `Demo/mocks/**`.
  - Relocated `frontend/public/mockServiceWorker.js` → `Demo/public/mockServiceWorker.js`.
  - Created [`Demo/README.md`](../../../Demo/README.md) documenting `npm run dev` (real Django backend via `/api` proxy, MSW disabled) vs. `npm run dev:demo` (isolated MSW Demo mode).
- **Root Directory Cleanup:**
  - Moved `backup.md` → `docs/archive/wp-5-5-context-recovery-backup.md`.
  - Moved `pdfs/إستمــــارة مـــوظــف.pdf` → `docs/01-requirements/reference/إستمــــارة مـــوظــف.pdf` and removed empty `pdfs/`.
  - Removed untracked temporary `scratch_*` files and stale root `node_modules/.vite/` cache.
  - Preserved `legacy-reference/**` untouched (`AGENTS.md`).
- **Build & Tooling Wiring:**
  - Updated [`frontend/vite.config.ts`](../../../frontend/vite.config.ts): `@/mocks` alias → `../Demo/mocks`, `resolveDemoMswPlugin()` resolving `msw` from `frontend/node_modules`, `/mockServiceWorker.js` served in Demo mode only, and `/api` proxied to `VITE_API_TARGET` (default `http://127.0.0.1:8000`) in default `npm run dev` mode.
  - Updated [`frontend/tsconfig.app.json`](../../../frontend/tsconfig.app.json), [`frontend/eslint.config.js`](../../../frontend/eslint.config.js), [`frontend/package.json`](../../../frontend/package.json) (`"dev:demo": "vite --mode demo"`), and [`run-metro-lms.bat`](../../../run-metro-lms.bat) (`npm run dev:demo`).

---

## 2. Reference-Based Error Message Audit & Corrections

| Scenario | Previous Behavior / Message | Approved Reference-Based Message | Reference |
|---|---|---|---|
| **HTTP `503` (Service Unavailable / Inactive Worker)** | `"خدمة محاكاة واجهة البرمجة (MSW) غير متوفرة أو لم تبدأ بعد. يرجى إعادة تحميل الصفحة."` (`MSW_NOT_ACTIVE`) | `"الخدمة غير متوفرة حالياً. يرجى المحاولة بعد قليل."` (`SERVICE_UNAVAILABLE`) | `apiClient.ts` L94–96; `loading-and-error-handling.md` §5 |
| **Non-JSON `200` SPA Fallback** | `"استجابة غير متوقعة من الخادم (تم استلام مستند HTML بدلاً من بيانات JSON)..."` | `"حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً."` *(preserving `err.status === 200`, never rewritten to `500`)* | `loading-and-error-handling.md` §5 |
| **Request Timeout (`TimeoutError`)** | Fell through to generic network error | `"تعذر الاتصال بالخادم (انتهت مهلة الطلب)"` | `sup-01-...-v3-4.md` L369 |
| **Network Connection Failure** | `"تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى."` | Preserved unchanged (`status: 0`, `isNetworkError: true`) | `loading-and-error-handling.md` §5 |
| **Mock-Token Errors in UI** | Raw `validateDevMockSession()` message mentioning `mock token` / `بيئة التطوير` | Sanitized by `sanitizeErrorMessage()` to `"فشل تسجيل الدخول. يرجى المحاولة مرة أخرى."` | `AuthContext.tsx` + `apiClient.ts` |

---

## 3. Hardening Implemented

1. **Production Guard (`isDemoAuthMode`) — [`frontend/src/core/auth/AuthContext.tsx`](../../../frontend/src/core/auth/AuthContext.tsx):**
   - Exported `isDemoAuthMode(env)` explicitly returning `false` whenever `PROD === true` or `MODE === 'production'` (even if `VITE_DEMO_MODE === 'true'`), returning `false` in normal `development` (`npm run dev`), and returning `true` only in `demo` / `test` modes when `DEV === true`.
   - Aligned [`frontend/src/main.tsx`](../../../frontend/src/main.tsx), [`frontend/src/core/api/apiClient.ts`](../../../frontend/src/core/api/apiClient.ts) (mock Bearer fallback), and [`frontend/vite.config.ts`](../../../frontend/vite.config.ts) with the same Production block.
2. **Sensitive-Information Sanitization — [`frontend/src/core/api/apiClient.ts`](../../../frontend/src/core/api/apiClient.ts):**
   - Expanded `technicalPatterns` in `sanitizeErrorMessage()` to block MSW/mock-token strings, JS/TS/Python stack traces, SQL Server/ODBC exceptions (`pyodbc`, `ODBC Driver`, `MSSQLSERVER`, `ProgrammingError`, `OperationalError`, `IntegrityError`), DB connection strings (`DRIVER={`, `PWD=`, `Trusted_Connection=`), Django/DRF module exceptions, Windows/source file paths, and leaked `sessionid=`/`csrftoken=`/`Bearer` tokens, while preserving valid Arabic business/validation messages.

---

## 4. Verification Evidence (`2026-11-16`)

- **Focused Error-Handling & Guard Tests:** `npx vitest run src/test/error-messages-and-sanitization.test.ts` → **PASS (`12/12` tests in `32ms`)**.
- **Production Build:** `npx vite build` → **PASS (`2468` modules transformed, `17.03s`, `frontend/dist/mockServiceWorker.js` absent)**.
- **Live Runtime (`npm run dev`):** Verified `/` (`200`), `/mockServiceWorker.js` (`text/html`, `isJS: False`), `/api/auth/me` with Django stopped (`500` proxy error, not `MSW_NOT_ACTIVE`), and `/api/auth/me` with Django running on `127.0.0.1:8000` (`200`).
- **Live Runtime (`npm run dev:demo`):** Verified `/mockServiceWorker.js` (`200`, `application/javascript`, `hasMSW: True`) and `/api/unhandled-check` (`503`).
- **Baseline Checks (Unchanged Pre-Existing Issues):**
  - `npx tsc -b`: `exit code 2` (pre-existing `TraineeGroupItemDTO` missing `description` in `trainee-groups-dashboard-ui.test.tsx` & implicit `any` in `Demo/mocks/handlers/*.ts`; `0` new errors).
  - `npm run lint`: `exit code 1` (`208` errors, `16` warnings; `+1` warning on `isDemoAuthMode` export in `AuthContext.tsx`, `0` new errors).
  - `npx vitest run src/test/auth.test.tsx`: `12 passed, 19 failed` (pre-existing `AuthContextConsumer is not defined` baseline failures).
- **Backend Integrity:** `manage.py check --settings=config.settings.development` → `System check identified no issues (0 silenced)`.
- **Git Safety:** `0` staged files, `0` commits, `0` pushes.

