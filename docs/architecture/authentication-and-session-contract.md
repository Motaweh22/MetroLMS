# MetroLMS — Canonical Authentication, Session & Isolation Architecture

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Scope:** Authentication Architecture (`D-AUTH-01`), Django Server-Side HttpOnly Session Contract, CSRF Protection, Authenticated User Bootstrap (`GET /api/auth/me`), Logout API Contract & `LOGOUT_UNCONFIRMED` Failure State (`POST /api/auth/logout`), Session Expiration & Invalidation, Canonical User Identity & Tombstones (`MFR-01`, `MFR-13`, `MFR-20`), Developer Role Preview vs. Isolated Test Sessions (`D-10`, Decisions `A, B, C, E, F`), and Developer Origin Snapshot Security (`metro_lms_developer_origin_session`).
> **Governing Decisions:** [`D-AUTH-01`](decision-register.md), [`D-10`](decision-register.md), [`Decision A, B, C, E, F`](decision-register.md).
> **Last Updated:** 2026-11-07 (`CP-001` — Final Phase 1 Auth, Snapshot Security & `LOGOUT_UNCONFIRMED` Alignment)

---

## 1. Approved Target Authentication Architecture (`D-AUTH-01`)

MetroLMS uses **Django Authentication** with **Database-Backed Server-Side Sessions** stored in Microsoft SQL Server:

1. **HttpOnly & Secure Session Cookies:**
   - Upon successful login, Django sets the `sessionid` cookie with `HttpOnly`, `Secure` (in production over HTTPS), and `SameSite=Lax` (under the preferred same-origin deployment topology).
   - The browser JavaScript runtime **never** reads, parses, or stores the production session identifier or raw credentials in `localStorage` or `sessionStorage`.
2. **Django CSRF Protection:**
   - Django sets a readable `csrftoken` cookie (or exposes it via `/api/auth/csrf` / `/api/auth/me`).
   - For all state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE` — including `POST /api/auth/logout`), the centralized API client ([`frontend/src/core/api/apiClient.ts`](../../frontend/src/core/api/apiClient.ts)) extracts `csrftoken` and sends it in the `X-CSRFToken` request header.
3. **No Client Bearer Token or SSO Requirement:**
   - There is no requirement for JWT or Bearer token authentication for the browser application.
   - Single Sign-On (SSO) is excluded from current scope and may be evaluated in the future if an organizational Identity Provider is introduced.
4. **Backend Verification Requirement:**
   - Compatibility and session cleanup behavior of the Django database session backend with the selected Microsoft SQL Server connector (`mssql-django` / `pyodbc`) must be verified during Phase 12 backend integration.

---

## 2. End-to-End Authentication Lifecycle Contract

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant React as React Frontend (AuthContext + apiClient)
    participant Django as Django 5 + DRF Backend
    participant MSSQL as Microsoft SQL Server

    Note over User,MSSQL: A. Application Bootstrap / Session Revalidation (MFR-20)
    React->>Django: GET /api/auth/me (credentials: 'same-origin')
    alt Valid Active Session Cookie & Active User
        Django->>MSSQL: Lookup session & verify user status === 'active'
        Django-->>React: 200 OK { user: { id, email, name, role, department, jobTitle, initials } }
        React->>React: Hydrate AuthContext.user (isAuthenticated = true)
    else Missing/Expired Session or Suspended/Deleted User
        Django-->>React: 401 Unauthorized
        React->>React: Clear client auth state (user = null)
    end

    Note over User,MSSQL: B. Explicit Login Flow (/login)
    User->>React: Submits credentials on LoginPage.tsx
    React->>Django: POST /api/auth/login { email/username, password } + X-CSRFToken
    Django->>MSSQL: Verify Argon2id/PBKDF2 hash & create session row
    Django-->>React: 200 OK + Set-Cookie: sessionid (HttpOnly, Secure) + Set-Cookie: csrftoken
    React->>Django: GET /api/auth/me (or read user DTO from login response)
    Django-->>React: 200 OK { user }
    React->>React: Increment sessionEpoch; set AuthContext.user; navigate to target route

    Note over User,MSSQL: C. Explicit Logout Flow (POST /api/auth/logout)
    User->>React: Clicks Logout
    React->>React: Increment authOpSeqRef & advanceSessionEpoch()
    React->>Django: POST /api/auth/logout (credentials: 'same-origin') + X-CSRFToken
    Django->>MSSQL: Delete / invalidate server-side session row (django_session)
    Django-->>React: 200 OK { success: true } + Set-Cookie: sessionid=""; Max-Age=0; HttpOnly; Secure; SameSite=Lax
    React->>React: Clear active client auth state (S1->S0, S8->S7, or S3/S4->S12->S0); navigate to /login
```

### 2.1 Current Prototype Implementation vs. Target Migration Boundary

| Component / Module | Current Prototype Implementation (MSW v2 Mode) | Target Django Integration Boundary (`D-AUTH-01`) |
| :--- | :--- | :--- |
| [`frontend/src/core/api/apiClient.ts`](../../frontend/src/core/api/apiClient.ts) | Reads `session?.token` from `authStorage` and injects `Authorization: Bearer ${token}`; enforces `requestEpoch` check (`StaleEpochError`) and `isRolePreviewMutationBlocked`. | Set `credentials: 'same-origin'`, read `csrftoken` cookie on unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) to attach `X-CSRFToken`. Keep `Bearer` header strictly as a dev-only MSW fallback until MSW handlers are updated to simulate cookies/sessions. |
| [`frontend/src/core/auth/authApi.ts`](../../frontend/src/core/auth/authApi.ts) | `authApi.logout()` dispatches `POST /api/auth/logout` via `apiClient`. | Continues calling `POST /api/auth/logout` with `credentials: 'same-origin'` and `X-CSRFToken`; returns server invalidation confirmation `{ success: boolean, message: string }`. |
| [`frontend/src/core/auth/AuthContext.tsx`](../../frontend/src/core/auth/AuthContext.tsx) | Manages `user`, `isAuthenticated`, `isLoading`, `login`, `logout`, mount revalidation via `GET /api/auth/me` (`MFR-20`), and isolated test session transitions. Currently `logout()` (lines 558–582) unconditionally calls `authStorage.clearDeveloperOriginSession()`, which requires `WP-1.1` / `T-1.1.1` reconciliation for `Decision C (S8 -> S7)`. | Retain `GET /api/auth/me` as the authoritative user-hydration contract. Ensure `logout()` distinguishes **Real-User Logout (`S1 -> S0` and `S8 -> S7`)** from **Isolated Persona Logout (`S3/S4 -> S12 -> S0`)** and distinguishes confirmed server-side session invalidation from local React state cleanup. |
| [`frontend/src/core/auth/authStorage.ts`](../../frontend/src/core/auth/authStorage.ts) | Stores mock `AuthSession` (`metro_lms_auth_session`) and `developerOriginSession` (`metro_lms_developer_origin_session`) in per-tab `sessionStorage`. | Never store production session identifiers or credentials in `sessionStorage`/`localStorage`. Retain dev-only isolated persona metadata strictly behind `import.meta.env.DEV`. |
| [`frontend/src/pages/LoginPage.tsx`](../../frontend/src/pages/LoginPage.tsx) | Renders RTL login form (`LoginForm.tsx`) and dev-only `DemoAccountPicker.tsx`. | Production builds (`!import.meta.env.DEV`) render only `LoginForm.tsx` over HTTPS. |
| [`frontend/src/core/auth/ProtectedRoute.tsx`](../../frontend/src/core/auth/ProtectedRoute.tsx) | Blocks unauthenticated visitors (redirecting to `/login` with `state.from`) and renders `ForbiddenPage` (`/403`) when `user.role` is not in `allowedRoles`. | Remains the client-side UX guard; Django independently enforces authentication (`401`) and RBAC (`403` / `404`) on every API endpoint. |

---

### 2.2 Logout API Contract, `LOGOUT_UNCONFIRMED` State & Session Invalidation Semantics (`POST /api/auth/logout`)

Because **`D-AUTH-01`** uses **Django Server-Side Sessions** with **`HttpOnly`, `Secure` cookies** and **CSRF protection**, logout is a two-layer lifecycle divided cleanly between client-side state cleanup (**`WP-1.1`**) and the Django server-side session invalidation contract (**`WP-1.3`**):

#### A. Successful Logout Lifecycle (`LOGOUT_CONFIRMED`)
1. **Browser Request (`POST /api/auth/logout`):**
   - Invoked via [`authApi.logout()`](../../frontend/src/core/auth/authApi.ts#L28-L32) and [`apiClient.ts`](../../frontend/src/core/api/apiClient.ts) with `credentials: 'same-origin'` (or `'include'` when a cross-origin dev proxy is configured) so the browser automatically sends the `HttpOnly`, `Secure`, `SameSite=Lax` `sessionid` cookie.
   - Because `POST` is a state-changing method, `apiClient` extracts the readable `csrftoken` cookie and sends `X-CSRFToken: <token>` in the request header.
2. **Server-Side Session Destruction & Cookie Eviction:**
   - Django (`django.contrib.auth.logout(request)`) flushes and deletes the server-side session record in Microsoft SQL Server (`django_session` table) and invalidates the session key so any previously captured cookie value is permanently unusable.
   - Django responds with `200 OK` (`{ "success": true, "message": "تم تسجيل الخروج بنجاح" }`) or `204 No Content` and clears the `sessionid` cookie using matching scope attributes (see **Subsection D** below).
3. **Client-Side State Finalization:**
   - React clears active authenticated state (`user = null`, `isAuthenticated = false`, `authStorage.clearSession()`), increments `sessionEpoch` (`advanceSessionEpoch()`), sets logout status to `LOGOUT_CONFIRMED`, and respects **`Decision C` (`S8 -> S7` inert snapshot preservation)** vs. **isolated persona logout (`S3/S4 -> S12 -> S0` two-slot purge)** as defined in **Subsection E** below.

#### B. Network Failure, `5xx`, or CSRF Rejection — The `LOGOUT_UNCONFIRMED` State (`WP-1.3` / `T-1.3.2`)
If `POST /api/auth/logout` fails to confirm server-side session invalidation (due to a network disconnect, request timeout, `5xx` server error, or `403 Forbidden` CSRF rejection), the `HttpOnly` `sessionid` cookie may still remain active on the server and in the browser cookie jar. The frontend must enforce the **`LOGOUT_UNCONFIRMED`** state:

1. **Immediate Fail-Closed Protected UI Exit:**
   - Immediately upon user logout initiation, `AuthContext.logout()` increments `authOpSeqRef`, calls `advanceSessionEpoch()` ([`sessionEpoch.ts`](../../frontend/src/core/auth/sessionEpoch.ts)) to quarantine any in-flight responses, clears active client authentication state (`user = null`, `isAuthenticated = false`, `authStorage.clearSession()`), and routes away from protected pages to `/login`. Protected UI **never** remains open or interactive after the user clicks Logout.
2. **Explicit `LOGOUT_UNCONFIRMED` State (No False Claim of Server Session Destruction):**
   - The frontend transitions to `logoutStatus = 'LOGOUT_UNCONFIRMED'` and **must never record, log, or claim that the server-side Django session was invalidated**.
3. **Retry and Session Revalidation Path:**
   - While in `LOGOUT_UNCONFIRMED`, the frontend exposes an explicit retry/reconciliation path:
     - **Explicit Logout Retry:** Re-dispatches `POST /api/auth/logout` (refreshing the CSRF token via `GET /api/auth/csrf` or `GET /api/auth/me` first if the prior failure was a `403` CSRF mismatch).
     - **Session Revalidation Check:** Queries `GET /api/auth/me` when connectivity returns to check whether the server session is already expired (`401`) or still active (`200`).
4. **Prohibition on Silent Session Restoration:**
   - While `LOGOUT_UNCONFIRMED` is active in the current tab, if a subsequent `GET /api/auth/me` check returns `200 OK` (because the server session was never destroyed), the frontend **must NEVER silently restore the old session into an authenticated React state (`AuthContext.user`)**. Instead, it must automatically re-attempt `POST /api/auth/logout` to finish invalidating the server session (or keep the user unauthenticated on `/login` with the recovery banner until server invalidation succeeds or the user explicitly submits a fresh login, which rotates the session).
5. **Clear User-Facing Recovery Feedback:**
   - On `/login`, the user receives a clear Arabic warning banner explaining that local sign-out closed the current screen, but server session termination could not be confirmed (`تعذر تأكيد إنهاء الجلسة على الخادم بسبب خطأ في الاتصال. تم إغلاق الواجهة محلياً — يرجى إعادة المحاولة لتأكيد تسجيل الخروج الكامل.`), accompanied by a one-click retry action (`إعادة محاولة تأكيد تسجيل الخروج`).

#### C. HTTP Response Semantics for `POST /api/auth/logout`

| HTTP Response / Failure Condition | Server-Side Session State | Resulting Client Logout State | Mandatory Frontend Handling (`WP-1.3` / `T-1.3.2`) |
| :--- | :--- | :---: | :--- |
| **`200 OK` / `204 No Content`** | Server session row deleted in SQL Server; `Set-Cookie` evicts `sessionid`. | **`LOGOUT_CONFIRMED`** | Clear active client state (`S1 -> S0`, `S8 -> S7`, or `S3/S4 -> S12 -> S0`); navigate to `/login`. |
| **`401 Unauthorized` (Already-Expired or Missing Session)** | No active server session exists for the cookie. | **`LOGOUT_CONFIRMED`** *(Idempotent)* | Server confirmed no active session exists. Finalize client state cleanup (`S0` or `S7`) normally without error. |
| **Repeated Logout Request** | Already invalidated on prior request. | **`LOGOUT_CONFIRMED`** *(Idempotent)* | Safe idempotent no-op; keep client in `S0` (or `S7`) on `/login`. |
| **`403 Forbidden` (CSRF Validation Failure)** | **Server session remains ACTIVE** (Django rejected request in CSRF middleware before `logout(request)` ran). | **`LOGOUT_UNCONFIRMED`** | **NOT proof that logout succeeded.** Close protected UI immediately (`user = null`), enter `LOGOUT_UNCONFIRMED`, refresh CSRF token (`csrftoken`), and retry `POST /api/auth/logout` or display the recovery retry banner. |
| **`403 Forbidden` (Other Auth / Policy Rejection)** | Unconfirmed / potentially still active on server. | **`LOGOUT_UNCONFIRMED`** | Never treat `403` as confirmed logout. Close protected UI (`user = null`), enter `LOGOUT_UNCONFIRMED`, and surface retry/recovery banner. |
| **Network Failure / Timeout (`TypeError` / Abort)** | Unknown (request may not have reached Django). | **`LOGOUT_UNCONFIRMED`** | Close protected UI immediately (`user = null`), enter `LOGOUT_UNCONFIRMED`, block silent restoration on `GET /api/auth/me`, and display the retry/recovery banner. |
| **`5xx` Server Error (`500`, `502`, `503`, `504`)** | Unknown / unconfirmed (SQL Server or Django error before session deletion committed). | **`LOGOUT_UNCONFIRMED`** | Close protected UI immediately (`user = null`), enter `LOGOUT_UNCONFIRMED`, block silent restoration on `GET /api/auth/me`, and display the retry/recovery banner. |

#### D. Exact Cookie-Clearing Scope Rules (`HttpOnly` Session Cookie)
1. **Server-Only Cookie Eviction:** Because `sessionid` is an `HttpOnly` cookie, browser JavaScript (`document.cookie`) **cannot read, overwrite, or delete `sessionid`**, and frontend code must never attempt to manipulate `sessionid` directly.
2. **Mandatory Matching Cookie Attributes on Logout:** For the browser to evict the `sessionid` cookie upon receiving the `POST /api/auth/logout` response, Django's `Set-Cookie` deletion header **must match the exact scope attributes** used when the cookie was set:
   - `Path=/` (must match `SESSION_COOKIE_PATH = '/'`)
   - `Domain` (omitted for default host-only same-origin cookies, or matching the exact `SESSION_COOKIE_DOMAIN` if configured)
   - `HttpOnly` (`SESSION_COOKIE_HTTPONLY = True`)
   - `Secure` (`SESSION_COOKIE_SECURE = True` in HTTPS/production)
   - `SameSite=Lax` (`SESSION_COOKIE_SAMESITE = 'Lax'`)
   - `Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` (with empty value `sessionid=""`)

#### E. Client-Side Storage & State Transitions: Real-User Logout (`Decision C: S8 -> S7` in `WP-1.1`) vs. Isolated Persona Logout (`S3/S4 -> S12 -> S0`)

The client-side storage cleanup executed during `logout()` (**`WP-1.1` / `T-1.1.1`**) depends strictly on whether the current session is a **real user session** (`isIsolatedSession === false`) or an **active DEV-only isolated persona session** (`isIsolatedSession === true`):

| Logout Scenario | Source & Target State | Server-Side Action (`WP-1.3`: `POST /api/auth/logout`) | Active Session Slot (`WP-1.1`: `metro_lms_auth_session` & `AuthContext.user`) | Developer Origin Snapshot Slot (`WP-1.1`: `metro_lms_developer_origin_session`) | Continuity Proof & Return Banner (`WP-1.1`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **1. Standard Real-User or Developer Logout (No Origin Snapshot)** | `S1 -> S0` *(or standard user -> `S0`)* | Invalidates server-side session (`sessionid`) via `POST /api/auth/logout` + `X-CSRFToken`. | Cleared (`authStorage.clearSession()`, `user = null`, `sessionEpoch` incremented). | None present (`null`). | `emergencyProof = null`; no banner; routes to `/login`. |
| **2. Real-User Logout with Inert Developer Snapshot Present (`Decision C`)** | **`S8 -> S7`** (`SUP-01`) | Invalidates the **real user's** active session via `POST /api/auth/logout` + `X-CSRFToken`. | Real-user active session is cleared (`authStorage.clearSession()`, `user = null`, `isAuthenticated = false`, `sessionEpoch` incremented). | **Preserved INERT and credential-free** in per-tab `sessionStorage` until tab termination (`clearDeveloperOriginSession()` is **NOT** called when `isIsolatedSession === false`). | `emergencyProof = null`; all normal and emergency Developer return controls remain **hidden and inaccessible**; fresh Developer login is required and never silently reactivates the inert snapshot. |
| **3. Explicit Logout from Active Isolated Persona Session (`INV-P5-7`)** | **`S3/S4 -> S12 -> S0`** | Invalidates the active test session via `POST /api/auth/logout` + `X-CSRFToken`. | Active persona session is cleared (`authStorage.clearSession()`, `user = null`, `isIsolatedSession = false`, `isolatedPersona = null`, `sessionEpoch` incremented). | **Purged completely** (`authStorage.clearDeveloperOriginSession()`) — two-slot purge (`INV-P5-7`). | `emergencyProof = null`; isolated banner unmounted; routes to `/login`. |

> [!IMPORTANT]
> **Backend Integration Dependency Note (DEV Isolated Persona Sessions vs. Production Django Sessions):**
> - In the current frontend MSW prototype, isolated persona sessions (`USR_TEST_*`) and the Developer origin snapshot (`metro_lms_developer_origin_session`) are **DEV-only (`import.meta.env.DEV === true`)** client-coordinated constructs in per-tab `sessionStorage`.
> - In production builds (`!import.meta.env.DEV`), `SYNTHETIC_TEST_PERSONA_REGISTRY` is empty and isolated persona switching is completely disabled; every logout is a standard `D-AUTH-01` server-side Django session logout (`POST /api/auth/logout` with `HttpOnly` cookie clearing and `X-CSRFToken`).
> - If DEV-mode isolated persona testing is connected to a live Django development server in Phase 12, the Django dev server must either scope synthetic persona switching to a dedicated dev-only header/sub-session or ensure that logging out a real user in state `S8` invalidates only the active user's server session while leaving the client-side per-tab `metro_lms_developer_origin_session` snapshot inert in `S7`.

---

## 3. Canonical Identity & Tombstone Invariants (`Phase 1` — Frozen)

Implemented and verified in Phase 1 ([`frontend/src/core/auth/canonicalIdentity.ts`](../../frontend/src/core/auth/canonicalIdentity.ts), [`frontend/src/mocks/handlers/resolveUser.ts`](../../frontend/src/mocks/handlers/resolveUser.ts)):
1. **Single Token/Session Resolver (`MFR-01`):** All MSW handlers use the centralized `resolveAuthenticatedUser(request)` helper. Duplicate local resolvers in feature handlers are prohibited.
2. **Canonical User ID Normalization (`MFR-13`):** Every store collection (`enrollments`, `userProgress`, `courseAttempts`, `groupMembers`, `notifications`, `courseComments`, `approvalRequests`) keys user references by canonical ID (`USR001`–`USR017`, `USR_DEV_001`, `USR_SUPER_001`, etc.) via `resolveCanonicalUserId`.
3. **Deleted User Tombstones (`MFR-20`, `MFR-34`, `D-01`):** Permanently deleted user IDs and their synthetic aliases are recorded in `deletedUserTombstones: Set<string>`. Deleted demo accounts are never resurrected on lookup, and active browser sessions for suspended or deleted users are immediately invalidated upon `GET /api/auth/me` revalidation.

---

## 4. Developer Role Preview vs. Isolated Role Test Sessions (`D-10` & Phase 5)

Strictly available only in development (`import.meta.env.DEV === true`) and restricted exclusively to the authenticated singleton Developer account (`USR_DEV_001`, `role: 'developer'`):

### 4.1 Visual Role Preview (`معاينة الدور`)
- **Purpose:** Inspect how navigation menus, dashboard widgets, and page layouts render for another role (`super_admin`, `admin`, `assistant_admin`, `lecturer`, `user`, or group-scoped `assistant_lecturer` preview) without switching authenticated identity.
- **Invariants ([`RolePreviewContext.tsx`](../../frontend/src/core/auth/RolePreviewContext.tsx), [`previewMutationBarrier.ts`](../../frontend/src/core/auth/previewMutationBarrier.ts)):**
  - `AuthContext.user` remains `USR_DEV_001` (`role: 'developer'`).
  - All state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) are intercepted and blocked client-side before network dispatch with the Arabic warning toast (`ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE`).
  - Navigating into the Learning Player during preview never writes trainee lesson progress (`MFR-21`).

### 4.2 Isolated Role Test Sessions (`اختبار الصلاحيات`)
- **Purpose:** Execute end-to-end workflow and API authorization testing as an allowlisted synthetic test persona while preserving the Developer's origin session for one-click return.
- **Mandatory Seven-Account Inventory (Zero Plaintext Credentials in Docs):**

| Account Identifier | Canonical Username | Canonical Role | Category | Selectable in Isolated Switcher? |
| :--- | :--- | :--- | :--- | :---: |
| **`USR_DEV_001`** | `developer_internal` | `developer` | Privileged System Actor | **No** (Launch Origin Only) |
| **`USR_SUPER_001`** | `super_admin_demo` | `super_admin` | Privileged Real Platform Account | **No** (Protected Real Account) |
| **`USR_TEST_SUPER_001`** | `test_super_admin` | `super_admin` | Synthetic Test Persona | **Yes** (Allowlisted in DEV) |
| **`USR_TEST_ADMIN_001`** | `test_admin` | `admin` | Synthetic Test Persona | **Yes** (Allowlisted in DEV) |
| **`USR_TEST_AST_001`** | `test_assistant_admin` | `assistant_admin` | Synthetic Test Persona | **Yes** (Allowlisted in DEV) |
| **`USR_TEST_LEC_001`** | `test_lecturer` | `lecturer` | Synthetic Test Persona | **Yes** (Allowlisted in DEV) |
| **`USR_TEST_TRN_001`** | `test_trainee` | `user` | Synthetic Test Persona | **Yes** (Allowlisted in DEV) |

- **Session Lifecycle Invariants ([`Decision A, B, C, E, F`](decision-register.md)):**
  1. **Launch Gate (`Decision A`):** Only an authenticated Developer (`USR_DEV_001`) in state `S1` can launch an isolated session (`S3`). Unauthenticated guests (`S0`) cannot launch or restore sessions.
  2. **Stale In-Flight Request Quarantine (`WP-5.4.2`):** Every session transition (login, logout, isolated launch, return) increments `sessionEpoch` ([`sessionEpoch.ts`](../../frontend/src/core/auth/sessionEpoch.ts)). Any in-flight API call whose `requestEpoch` does not match the current epoch throws `StaleEpochError` and is discarded without mutating UI state.
  3. **Real-User Identity Mismatch (`Decision B`, State `S8`):** If a real non-Developer user logs in while an old Developer origin snapshot exists in `sessionStorage`, normal return (`S14`) and emergency return (`S15`) are strictly forbidden and return banners are hidden.
  4. **Real-User Logout from `S8` (`Decision C`, `SUP-01: S8 → S7`) vs. Isolated Persona Logout (`S3/S4 → S12 → S0`):** Follow the complete two-layer server + client contract in **Section 2.2** above. Logging out as a real user in state `S8` invalidates the active session via `POST /api/auth/logout`, clears the real user's active session (`user = null`), leaves the Developer origin snapshot preserved and **inert** in per-tab `sessionStorage` until tab close (`S7`), never recreates `emergencyProof`, keeps return banners hidden, and requires fresh Developer authentication. By contrast, explicit logout during an active isolated persona session (`S3` or `S4`) executes a two-slot purge (`S12 → S0`) that clears both `metro_lms_auth_session` and `metro_lms_developer_origin_session` (`INV-P5-7`).
  5. **Archival Storage Failure (`Decision E`):** If archiving the Developer origin snapshot fails due to browser storage limits, the logout transition aborts transactionally, preserving state `S8` and displaying the recoverable error message.

---

### 4.3 Developer Origin Snapshot Security Boundary (`metro_lms_developer_origin_session`)

To ensure strict compliance with **`D-AUTH-01`** (no browser-stored session identifiers or Bearer tokens) and **`Decision C (S8 -> S7)`** (inert snapshot preservation after real-user logout), the per-tab `sessionStorage` slot `metro_lms_developer_origin_session` managed in [`frontend/src/core/auth/authStorage.ts`](../../frontend/src/core/auth/authStorage.ts) is governed by the following security boundary:

1. **Strict Prohibition on Stored Credentials:**
   - The preserved `metro_lms_developer_origin_session` record **must NOT store or expose**:
     - Any production or development **session identifier** (`sessionid`),
     - Any **Bearer token** or JWT (`developerToken`, `rawToken`, `personaToken`),
     - Any **access token** or **refresh token**,
     - Any **password** or password hash,
     - Any **reusable authentication credential** or authorization header value.
2. **Approved Non-Credential Snapshot Metadata Only:**
   - `metro_lms_developer_origin_session` may store **only** non-credential restoration metadata required for DEV-only (`import.meta.env.DEV === true`) Developer Preview / isolated persona context:
     - `schemaVersion: 1`
     - `savedAt: string` (ISO-8601 timestamp)
     - `developerUser: User` (non-credential profile DTO for `USR_DEV_001` with `role: 'developer'`)
     - `developerExpiresAt: number` (non-sensitive expiration timestamp ms)
     - `personaId: string` (allowlisted synthetic persona ID `USR_TEST_*`)
3. **Complete Inertness After Real-User Logout (`Decision C: S8 -> S7`):**
   - When a real non-Developer user logs out in state `S8` (`S8 -> S7`), the preserved `metro_lms_developer_origin_session` snapshot is **strictly inert**:
     - `emergencyProof` is cleared (`null`),
     - Both normal (`S14`) and emergency (`S15`) Developer return controls are hidden and blocked,
     - The preserved snapshot **cannot independently restore an authenticated session** or authorize any API request; resuming a Developer session from `S7` requires fresh interactive Developer authentication via `/login`.
4. **Current Prototype Inspection Finding & Phase 1 Verification/Remediation Requirement:**
   - Read-only inspection of [`frontend/src/core/auth/authStorage.ts`](../../frontend/src/core/auth/authStorage.ts) confirmed that while `SanitizedQuarantinedOriginSnapshot` (lines 18–28) and `SessionContinuityDescriptor` (lines 38–47) already strip `rawToken` and `developerToken`, the MSW prototype interface `DeveloperOriginSession` (lines 58–65) and validator `isValidDeveloperOriginSession` (lines 96–98) currently still include `developerToken: string` (`mock_jwt_USR_DEV_001_test`).
   - **Mandatory Phase 1 Requirement (`WP-1.1` / `WP-1.3`):** During Phase 1 implementation, verify and remediate `DeveloperOriginSession` so that `metro_lms_developer_origin_session` stores **zero reusable authentication credentials**, remains completely inert in `S7`, and never independently restores an authenticated session.

---

## 5. Phase 1 Non-Overlapping Work Package Ownership Matrix (`WP-1.1` vs. `WP-1.2` vs. `WP-1.3`)

Every Phase 1 task has **exactly one primary Work Package owner**:

| Work Package | Primary Ownership Scope (Exclusive) | Explicitly Excluded (Owned by Sibling WP) |
| :--- | :--- | :--- |
| **`WP-1.1 — WP-5.4.5 Closure`** *(`CP-002`)* | - `Decision C` real-user logout lifecycle (`S8 -> S7`)<br>- React authentication state cleanup (`user = null`, `clearSession()`)<br>- Inert, credential-free Developer origin snapshot preservation (`metro_lms_developer_origin_session`)<br>- `emergencyProof = null` cleanup & hiding Developer return controls in `S7`<br>- Preserving isolated persona logout (`S3/S4 -> S12 -> S0` two-slot purge) unchanged<br>- Historical `WP-5.4.5` test traceability (preserving all 60 deferred specs in `isolated-role-session.test.tsx`) and Phase 5 checklist/report closure | - `sessionEpoch` & race-condition consolidation (`WP-1.2`)<br>- Django session cookie, CSRF, `GET /api/auth/me`, and `POST /api/auth/logout` HTTP/`LOGOUT_UNCONFIRMED` contract alignment (`WP-1.3`) |
| **`WP-1.2 — Session Lifecycle and Developer Isolation`** *(`CP-003`)* | - `sessionEpoch` monotonic consistency (`S7` in `sessionEpoch.ts`)<br>- Account-switch race conditions (`authOpSeqRef`, `StaleEpochError`, `<Outlet key>` reset, user/epoch-scoped draft storage)<br>- Developer Preview isolation (`RolePreviewContext.tsx`, `previewMutationBarrier.ts`, `/design-system` 404 guard)<br>- Session invalidation behavior on mount/mid-session<br>- Role and isolated-session invariants (`INV-P5-1`–`INV-P5-7`, `S0`–`S15`) across the 18 uncommitted files | - `Decision C (S8 -> S7)` logout closure (`WP-1.1`)<br>- Django `D-AUTH-01` transport, CSRF, and `POST /api/auth/logout` contract (`WP-1.3`) |
| **`WP-1.3 — Django Authentication Integration Contract`** *(`CP-004`)* | - Database-backed Django Sessions (`D-AUTH-01`)<br>- `HttpOnly` & `Secure` session cookies and cookie-clearing scope rules<br>- CSRF integration (`csrftoken` extraction & `X-CSRFToken` header)<br>- `GET /api/auth/me` bootstrap/revalidation contract<br>- `POST /api/auth/logout` API contract, HTTP response semantics (`403` CSRF != logout success), and `LOGOUT_UNCONFIRMED` state handling<br>- Centralized `apiClient` transport (`credentials: 'same-origin'`)<br>- Auth/session integration test preparation (`T-1.3.3`) | - `Decision C (S8 -> S7)` client slot preservation (`WP-1.1`)<br>- `RolePreviewContext` & draft storage epoch isolation (`WP-1.2`) |
