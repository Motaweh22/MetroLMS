# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 01 — Authentication & Sessions

> **Document Title:** Technical Domain Specification — Authentication & Sessions  
> **Document Identifier:** `METROLMS-TECH-DOM-001`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Security Architects  
> **Governing Decisions:** [`D-AUTH-01`](../../../architecture/decision-register.md#d-auth-01), [`D-10`](../../../architecture/decision-register.md), [`Decision A, B, C, E, F`](../../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:**
  - `AuthContext.tsx`: Coordinates session hydration (`GET /api/auth/me`), login, logout, and DEV-only isolated persona switching (`S0`–`S15`).
  - `apiClient.ts`: Attaches `credentials: 'same-origin'`, extracts `csrftoken` cookie into `X-CSRFToken` on unsafe HTTP methods, and enforces `requestEpoch` quarantine (`StaleEpochError`).
  - `sessionEpoch.ts`: Monotonic in-memory counter incremented on every login, logout, isolated switch, or authoritative `401`/`403`/`404` invalidation.
  - `authStorage.ts`: Per-tab `sessionStorage` manager for DEV-only `metro_lms_developer_origin_session` (strictly credential-free).
- **Target Backend Components (Django 5 + DRF):**
  - `django.contrib.auth` + `django.contrib.sessions` backed by Microsoft SQL Server (`django_session`).
  - CSRF middleware enforcing `X-CSRFToken` on `POST`, `PUT`, `PATCH`, `DELETE`.
  - Session views handling credential verification (`Argon2id`/`PBKDF2`), `HttpOnly`/`Secure`/`SameSite=Lax` cookie issuance, and matching-attribute cookie deletion on logout.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Application Bootstrap:** `AuthContext` calls `GET /api/auth/me` with `credentials: 'same-origin'`. Backend validates `sessionid` and verifies `user.status === 'active'` and non-membership in `deletedUserTombstones`.
2. **Explicit Logout & `LOGOUT_UNCONFIRMED`:**
   - Upon logout click, `AuthContext` increments `authOpSeqRef`, calls `advanceSessionEpoch()`, clears `AuthContext.user`, and routes to `/login`.
   - `200`/`204`/`401` transitions to `LOGOUT_CONFIRMED`.
   - `403` (CSRF mismatch), `5xx`, or network error enters `LOGOUT_UNCONFIRMED`, preventing silent session rehydration on subsequent `GET /api/auth/me` calls and surfacing a retry banner.
   - Real-user logout in `S8` (`Decision C: S8 -> S7`) preserves `metro_lms_developer_origin_session` inert and credential-free; isolated persona logout (`S3/S4 -> S12 -> S0`) purges both slots (`INV-P5-7`).

---

## 3. Validation, Authorization & Failure Scenarios

- **Failure Scenarios & Edge Cases:**
  - *Stale In-Flight Response:* Rejected via `StaleEpochError` when `requestEpoch !== getSessionEpoch()`.
  - *Storage Quota Exhaustion (`Decision E`):* Aborts snapshot archival transactionally, preserves `S8`, and displays Arabic recovery error.
  - *Tampered/Expired Snapshot (`S9`/`S10`/`S11`):* Fails closed, quarantines or purges corrupt state, and requires fresh login.
- **Integration Boundaries & Constraints:**
  - Zero production tokens in `localStorage`/`sessionStorage` (`D-AUTH-01`).
  - Master OpenAPI contract for `/api/auth/*` is deferred to Phase 5; `django_session` compatibility with `mssql-django` is deferred to Backend Phase 12.

---

## 4. Traceability

- Business Rules: [`domain-01-authentication-and-sessions.md`](../../../01-requirements/domains/domain-01-authentication-and-sessions.md)
- Low-Level Design: [`LLD-001-session-lifecycle-state-machine.md`](../../../02-architecture-and-design/lld/LLD-001-session-lifecycle-state-machine.md)

