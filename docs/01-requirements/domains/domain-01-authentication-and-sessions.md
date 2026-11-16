# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 01 — Authentication & Sessions

> **Document Title:** Domain 01 — Authentication & Sessions Business Rules  
> **Document Identifier:** `METROLMS-DOM-AUTH-001`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-10`](../../architecture/decision-register.md), [`Decision A, B, C, E, F`](../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Establish secure, stateful, server-authoritative user authentication, session lifecycle management, CSRF protection, and fail-closed session termination across MetroLMS, while strictly isolating development-only (`import.meta.env.DEV`) role testing workflows.
- **Domain Boundaries:**
  - *In Scope:* Credential verification, server-side session creation and invalidation (`D-AUTH-01`), CSRF enforcement, `GET /api/auth/me` session hydration, `POST /api/auth/logout` (`LOGOUT_CONFIRMED` vs. `LOGOUT_UNCONFIRMED`), monotonic `sessionEpoch` (`S7`) invalidation, and DEV-only isolated persona session transitions (`S0`–`S15`).
  - *Out of Scope:* User profile management and deletion cascades (Domain 02), RBAC capability ceilings and visual role preview (Domain 03), SSO/IdP integration (deferred indefinitely per `D-AUTH-01`), and browser-stored JWTs or WebCrypto session encryption (prohibited).
- **Actors & Responsibilities:**
  - *Unauthenticated Visitor:* Can access `/login` and public verification routes (`/verify-cert/<uuid>`), and submit credentials.
  - *Authenticated Platform User (All 6 Roles):* Holds an active server-side session (`sessionid` cookie) and CSRF token (`csrftoken`), and can initiate explicit logout.
  - *Developer (`USR_DEV_001`, DEV-only):* Sole actor permitted to initiate Isolated Role Test Sessions (`S1` $\rightarrow$ `S2` $\rightarrow$ `S3`) in `import.meta.env.DEV`.
- **Core Entities:** `ServerSession` (`django_session`), `SessionUserDTO`, `CsrfToken`, `SessionEpoch`, `DeveloperOriginSnapshot` (DEV-only, credential-free).

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM01-01`** | **Server-Side Session Exclusivity (`D-AUTH-01`)** | Production authentication uses server-side sessions transported exclusively via `HttpOnly`, `Secure`, `SameSite=Lax` `sessionid` cookies; `localStorage` / `sessionStorage` must contain zero production tokens or passwords. | Django Auth & `apiClient.ts` |
| **`INV-DOM01-02`** | **CSRF Mutation Protection (`D-AUTH-01`)** | Every state-mutating request (`POST`, `PUT`, `PATCH`, `DELETE`, including `POST /api/auth/logout`) must include a valid `X-CSRFToken` header matching the `csrftoken` cookie. | Django CSRF Middleware & `apiClient.ts` |
| **`INV-DOM01-03`** | **Active Account Revalidation (`MFR-20`)** | On mount and revalidation (`GET /api/auth/me`), suspended or permanently deleted accounts (`deletedUserTombstones`) immediately receive `401 Unauthorized` and are purged from client auth state. | Django Session View & `AuthContext.tsx` |
| **`INV-DOM01-04`** | **Fail-Closed Logout & `LOGOUT_UNCONFIRMED`** | Clicking logout immediately clears protected UI (`user = null`, `advanceSessionEpoch()`); if the server returns `403`, `5xx`, or network failure, client enters `LOGOUT_UNCONFIRMED` and blocks silent session restoration on `GET /api/auth/me`. | `AuthContext.tsx` & `authApi.ts` |
| **`INV-DOM01-05`** | **Unauthenticated Launch Prohibition (`Decision A`)** | In state `S0` (unauthenticated), only `S0 -> S1` is permitted; `S0 -> S3`, `S0 -> S14`, and `S0 -> S15` are strictly forbidden. | `AuthContext.tsx` |
| **`INV-DOM01-06`** | **Real-User Snapshot Inertness (`Decision B` & `Decision C`)** | In `S8` (real user with inert Developer snapshot) and `S8 -> S7` (real-user logout), `S14`/`S15` return controls remain hidden/blocked, `emergencyProof = null`, and `metro_lms_developer_origin_session` remains credential-free and inert. | `AuthContext.tsx` & `authStorage.ts` |
| **`INV-DOM01-07`** | **Isolated Persona Two-Slot Purge (`INV-P5-7`)** | Explicit logout during an active isolated persona session (`S3`/`S4 -> S12 -> S0`) purges both the active persona slot and `metro_lms_developer_origin_session`. | `AuthContext.tsx` & `authStorage.ts` |

---

## 3. State Transition Rules

- **Allowed Transitions:**
  - *Standard Production Lifecycle:* `Unauthenticated (S0)` $\rightarrow$ `Authenticated (S1)` via valid `POST /api/auth/login` + `GET /api/auth/me`; `Authenticated (S1)` $\rightarrow$ `Unauthenticated (S0)` via `POST /api/auth/logout` (`LOGOUT_CONFIRMED`) or `401` expiry; `Authenticated (S1)` $\rightarrow$ `LOGOUT_UNCONFIRMED` on logout transport/`403`/`5xx` failure.
  - *DEV-Only Isolated Testing Lifecycle (`S0`–`S15`):* Governed completely by [`LLD-001-session-lifecycle-state-machine.md`](../../02-architecture-and-design/lld/LLD-001-session-lifecycle-state-machine.md).
- **Forbidden Transitions:**
  - `S0` $\rightarrow$ `S3` / `S14` / `S15` (`Decision A`).
  - `S8` $\rightarrow$ `S14` / `S15` (`Decision B`).
  - `S7` $\rightarrow$ `S14` / `S15` (`Decision C`).
  - Silent restoration of `AuthContext.user` from `GET /api/auth/me` while `logoutStatus === 'LOGOUT_UNCONFIRMED'`.

---

## 4. Dependencies, Unresolved Questions & Traceability

- **Cross-Domain Dependencies:**
  - *Domain 02 (Users & Profiles):* Supplies user status (`active` vs. `suspended`) and `deletedUserTombstones` checks.
  - *Domain 03 (Roles, Permissions & Switching):* Supplies `D-10` separation between Visual Role Preview and Isolated Role Test Sessions.
- **Confirmed Decisions vs. Unresolved Owner Questions:**
  - *Confirmed:* `D-AUTH-01`, `Decision A, B, C, E, F`, `D-10`, `MFR-01`, `MFR-20`, **`D-OWNER-REV-13` & `D-OWNER-REV-18` (`2026-11-14` — Unique E.164 Phone Login Identifier):** Users sign in using **phone number + password** instead of email (`POST /api/auth/login`). Each phone number must be **globally unique** across User accounts (shared phones prohibited) and **normalized to canonical E.164 format** before identity matching (no Egyptian-only restriction). Password-based authentication, server-side `django_session` (`HttpOnly`, `Secure`, `SameSite=Lax`), and `X-CSRFToken` remain unchanged (no OTP, SMS login, or passwordless flow).
  - *Unresolved / Deferred:* Compatibility verification of `django.contrib.sessions` with `mssql-django` / `pyodbc` (deferred to Backend Phase 12 per `D-AUTH-01` §8); SSO / external IdP integration (deferred indefinitely per `D-AUTH-01` §5); **`D-OWNER-REV-13`/`18` remaining open phone rules:** phone ownership verification, phone-change flow, lost-phone recovery flow, and whether historical email-login migration compatibility is needed.
- **Traceability:** [`BRD-001`](../brd/BRD-001-cairo-metro-lms-platform.md), [`SRS-001`](../srs/SRS-001-core-system-requirements.md) (`REQ-AUTH-01`..`05`), [`authentication-and-session-contract.md`](../../architecture/authentication-and-session-contract.md), [`LLD-001`](../../02-architecture-and-design/lld/LLD-001-session-lifecycle-state-machine.md).

