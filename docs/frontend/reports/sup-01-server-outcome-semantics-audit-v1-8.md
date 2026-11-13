# MetroLMS — SUP-01 Server Outcome Semantics & Retry Accessibility Audit (Version 1.8)
## Architecture Review: State Consistency, S5-A UI Accessibility, Conditional Outcome Classification, and Backend Concurrency Bounding

**Document Version:** 1.8 (Final State Consistency & Retry Accessibility Audit)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-server-outcome-semantics-audit-v1-8.md`  
**Classification:** Architectural Remediation & Test Coverage Plan (Planning Only — Zero Implementation)  
**Target Transition:** `SUP-01: S8 → S7` (Real-User Logout with Preserved Inert Developer Origin Snapshot)  
**Governing Owner Decisions:**  
- **Decision A (S0):** Approved 2026-11-06  
- **Decision B (S8):** Approved 2026-11-06  
- **Decision C (Real-User Logout):** Approved 2026-11-06  
- **Decision E (Archival Failure Policy):** **APPROVED 2026-11-06 (Option 1 — Transactional Abort)**  
**Execution Directives:** Strict Read-Only Planning Governance Preserved (Zero production code modifications, zero test changes, zero Git staging/commits, zero test runner or compiler execution)  
**Proposed Remediation Package:** `WP-5.4.5-R1` (Separately Authorized Remediation Package planned prior to Phase 13)  
**Remediation Plan Status:** `READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED`

---

## 1. Executive Summary & Binding Owner Decisions

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 architecture reports and reaffirmed four binding project decisions governing the Developer preview and isolated persona lifecycle:

1. **Decision A (Unauthenticated Boundaries — `S0`):** Only `S0 → S1` is permitted; `S0 → S3`, `S0 → S14`, and `S0 → S15` are strictly forbidden. Guest/unauthenticated sessions cannot initiate isolated testing or execute Developer return.
2. **Decision B (Identity Mismatch Restrictions — `S8`):** `S8 → S14` and `S8 → S15` are strictly forbidden; a real platform user must never consume, activate, or elevate permissions using an old Developer origin snapshot.
3. **Decision C (Real-User Logout Supplementary Transition — `SUP-01`):** `S8 → S7` is approved. When an authenticated real user logs out in state S8, the active real-user session is cleared, and the existing Developer origin snapshot is preserved in per-tab `sessionStorage`, inert and non-authorizing, until tab termination. No emergency continuity proof is generated; normal and emergency Developer return controls are completely suppressed; a fresh Developer login is required.
4. **Decision E (Archival Failure Policy — Transactional Abort):** **APPROVED (Option 1).** If Developer origin snapshot archival or read-back verification fails during an attempted logout:
   - Do not dispatch `authApi.logout()`.
   - Do not execute `authStorage.clearSession()`.
   - Do not clear the active Developer origin snapshot.
   - Preserve the current authenticated real-user session.
   - Remain in state S8 (displaying a recoverable banner in substate `S8-ERR`).
   - Permit safe retry.
   *(Option 2 — Quarantine & Evict is formally rejected)*.

Neither Force Logout nor Quarantine & Evict may be introduced.

---

## 2. State Transition Model & S5-A / S8-A Architecture

The formal Phase 5 state machine comprises states S0 through S15. The SUP-01 remediation introduces two precisely defined supplementary intermediate states to ensure total state consistency:

```
                                  [State S8: Real User Active + Active Origin Snapshot]
                                                            │
                                             User Clicks Logout (SUP-01)
                                                            │
                                  ┌─────────────────────────┴─────────────────────────┐
                                  │ Phase 1: Atomic Archival & Read-Back Verification │
                                  └─────────────────────────┬─────────────────────────┘
                                                            │
                             ┌──────────────────────────────┴──────────────────────────────┐
                             │                                                             │
                  Archival Succeeds                                              Archival FAILS
                             │                                                             │
            ┌────────────────┴────────────────┐                   ┌────────────────────────┴────────────────────────┐
            │ Active Origin Cleared           │                   │ Decision E (Option 1): Transactional Abort      │
            │ Snapshot in Inert Archive Array │                   │ • authApi.logout() NOT dispatched               │
            └────────────────┬────────────────┘                   │ • Local credentials NOT cleared                 │
                             │                                    │ • Active Origin Snapshot NOT cleared            │
            ┌────────────────┴────────────────┐                   │ • User remains authenticated in S8 (S8-ERR)     │
            │ Phase 2: Dispatch Server Logout │                   │ • Recoverable Error Shown, Retry Enabled        │
            └────────────────┬────────────────┘                   └─────────────────────────────────────────────────┘
                             │
     ┌───────────────────────┼────────────────────────────────────────┐
     │                       │                                        │
Authoritative Success   Authoritative Revocation              Ambiguous / Network Failure
(HTTP 200 / 204)       (HTTP 401/404 Token Revoked)           (HTTP 500, Timeout, Network Loss)
     │                       │                                        │
┌────┴───────────────────────┴────┐                          ┌────────┴────────────────────────────────────────┐
│ State S7: Unauthenticated       │                          │ State S8-A: Real User Active / Origin Empty     │
│ • Clear Local Session           │                          │ • Local Session Retained                        │
│ • Active Origin = null          │                          │ • Active Origin = null; Archive Preserved       │
│ • Snapshot Preserved Inert      │                          │ • Banner Suppressed; Return Forbidden           │
│ • Normal/Emerg Return Forbidden │                          │ • Safe Retry Enabled                            │
└─────────────────────────────────┘                          └───────────────────┬─────────────────────────────┘
                                                                                 │
                                                                           Page Refresh
                                                                                 │
                                                             revalidateSession() checks /api/auth/me
                                                                                 │
                                     ┌───────────────────────────────────────────┼───────────────────────────────────┐
                                     │                                           │                                   │
                              HTTP 200 (Active)                           HTTP 401/404 (Revoked)             Network Error / 500
                                     │                                           │                                   │
                          ┌──────────┴──────────┐                     ┌──────────┴──────────┐             ┌──────────┴──────────┐
                          │ State S8-A Restored │                     │ State S7 Clean Exit │             │ Substate S5-A       │
                          │ • User Authenticated│                     │ • Session Cleared   │             │ • user = null       │
                          │ • Origin = null     │                     │ • S7 Unauthenticated│             │ • Creds in Storage  │
                          │ • Retry Accessible  │                     │ • Banner Suppressed │             │ • Origin = null     │
                          └─────────────────────┘                     └─────────────────────┘             │ • Redirects /login  │
                                                                                                          └─────────────────────┘
```

### Precise State Definitions:
1. **State `S8` (Standard Identity Mismatch):** Authenticated real user session active in React state and storage; active Developer origin snapshot present in `metro_lms_developer_origin_session`.
2. **Substate `S8-ERR` (Archive Abort Failure):** Identical storage state to `S8` (user authenticated, active origin intact); `AuthContext.error` set to recoverable storage error; no network call dispatched.
3. **Supplementary State `S8-A` (Real User Active, Origin Archived):** Authenticated real user session active in React state and storage; active Developer origin snapshot is `null`; verified snapshot stored safely in inert archive `metro_lms_inert_developer_snapshots`. Developer return controls strictly forbidden and suppressed.
4. **Substate `S5-A` (Transient Transport Failure with Inert Archive):**
   - **Relationship to S5:** S5-A is a **distinct substate variant** of State S5.
   - In baseline `S5`, a persona is authenticated, cold page reload occurs, transport fails, and `authStorage.hasDeveloperOriginSession()` is `true` (normal Developer return is possible once revalidated).
   - In `S5-A`, cold page reload occurs after unknown logout failure, transport fails, but `authStorage.hasDeveloperOriginSession()` is `false` (active origin was cleared in Phase 1, snapshot is inert in archive).
   - Therefore, in `S5-A`, Developer return is **strictly forbidden both before and after revalidation**.

---

## 3. UI Accessibility Analysis for S5-A and Retry Operations

A rigorous source audit of the frontend React tree was conducted to evaluate the exact behavior when `AuthContext.user === null` in substate `S5-A`.

### Inspected Source Files & Concrete Findings:
1. [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx#L478-L510):
   - In `revalidateSession()` catch block:
     ```typescript
     } else {
       // Temporary network failure / timeout / HTTP 500 (Section 5.G / State S5)
       setUser(null);
       setEmergencyProof(null);
       setError('تعذر التحقق من صلاحية الجلسة بسبب مشكلة في الاتصال بالخادم. يرجى إعادة المحاولة.');
     }
     ```
   - Lines 508–510 define:
     ```typescript
     const retryRevalidation = useCallback(async (): Promise<void> => {
       return revalidateSession();
     }, [revalidateSession]);
     ```
   - Line 1342 exports:
     ```typescript
     isAuthenticated: Boolean(user),
     ```
   - When `user === null`, `isAuthenticated` evaluates strictly to `false`.

2. [`frontend/src/core/auth/ProtectedRoute.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/ProtectedRoute.tsx#L32-L36):
   ```typescript
   if (!isAuthenticated) {
     return <Navigate to="/login" state={{ from: location }} replace />;
   }
   ```
   - Any protected page (Dashboard, Courses, Admin panel) immediately unmounts upon entering S5-A and redirects the browser to `/login`.

3. [`frontend/src/pages/LoginPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LoginPage.tsx#L1-L36) & [`frontend/src/features/auth/components/LoginForm.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/auth/components/LoginForm.tsx#L146-L152):
   - `LoginForm.tsx` renders the error message string:
     ```tsx
     {error && (
       <div className="login-error visible" id="login-error" role="alert">
         <span aria-hidden="true">⚠️</span>
         <span>{error}</span>
       </div>
     )}
     ```
   - **Crucial Finding:** `LoginForm.tsx` contains **NO retry button**, **NO connection revalidation button**, and **NO logout button**.
   - `Sidebar.tsx` and `MobileDrawer.tsx` (which contain the authenticated logout button) are only mounted inside `AppLayout.tsx`, which is gated behind `<ProtectedRoute>`. In `/login`, those navigation bars are completely absent.

4. [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx#L2143-L2145):
   - In test specification `P5-T16-1`, recovery from transient failure is tested via direct programmatic invocation:
     ```typescript
     await act(async () => {
       await capturedAuth?.retryRevalidation?.();
     });
     ```
   - `retryRevalidation` is only invoked programmatically by test harnesses; **no UI component in the current codebase calls it**.

### Architectural Resolution of the 7 S5-A Questions:
1. **Distinct State or Substate?** S5-A is a distinct substate of S5. In S5, `hasDeveloperOriginSession() === true`. In S5-A, `hasDeveloperOriginSession() === false` and the snapshot is archived in inert storage.
2. **Recoverable Interface Present in Source?** **NO.** The current UI renders the error text in `.login-error` but exposes no interactive button or control for `retryRevalidation` or `logout`. It is an unevidenced assumption to claim such a UI control exists today.
3. **Is Retry Accessible When `user === null`?** In the current UI, **NO**. Because the tab is redirected to `/login`, authenticated navigation is unmounted, and `LoginForm` only accepts new credentials or demo account selection.
4. **How Target Token is Retained:** The original session token remains safely persisted in `sessionStorage` under key `metro_lms_auth_session` because `authStorage.clearSession()` is NOT called during transient failure (lines 488–495).
5. **Prevention of Stale Retry Using Newer Token:** If a new user logs in via `/login`, `login()` writes the new user session and calls `advanceSessionEpoch()`. Any pending or retry operation referencing the old token is discarded by the `isRevalidationCurrent` lifecycle fence (`token !== requestToken` or `epoch !== requestEpoch`).
6. **Navigation or Reload in S5-A:**
   - Navigating within `/login` keeps the user on `/login`.
   - Refreshing the page re-executes `revalidateSession()`. If the network is still down, the tab remains in S5-A. If the network has recovered, `revalidateSession()` calls `GET /api/auth/me`.
7. **UI Restoration Upon Revalidation:**
   - When `revalidateSession()` succeeds (network restored), `setUser(response.user)` updates React state.
   - `isAuthenticated` becomes `true`.
   - `ProtectedRoute` permits rendering protected routes (redirects from `/login` back to target page).
   - Because `authStorage.hasDeveloperOriginSession()` is `false`, `isIsolatedSession` is `false`, `isolatedPersona` is `null`, and `emergencyProof` is `null`.
   - The UI restores the standard real-user dashboard with **zero Developer banner** and **zero return controls**.
   - The user is now in `S8-A`, where the standard logout button is visible and accessible in the authenticated header/sidebar, allowing them to perform a normal logout retry!

---

## 4. Reconciled Retry Semantics & Token Ownership Guards

Retrying a logout cannot be treated as uniformly safe simply because a frontend function can dispatch an HTTP request. Each retry scenario must be analyzed against both frontend state and backend contracts:

| Retry Context | Eligibility & Necessity | Frontend Pre-conditions | Backend Contract Dependency | Safety Classification |
| :--- | :--- | :--- | :--- | :--- |
| **Retry after `CONFIRMED_ACTIVE`** | **Allowed & Necessary.** (Session is definitely still alive on server). | Local session active in `S8-A`. `hasDeveloperOriginSession() === false`. Archival Phase 1 is bypassed. | Backend revokes target token. | Fully safe. Prevents duplicate archive entries; terminates live session. |
| **Retry after `UNKNOWN`** | **Allowed & Prudent.** (Server outcome was indeterminate; token might be alive). | Local session active in `S8-A`. Archival Phase 1 is bypassed. Dispatches `POST /api/auth/logout`. | Requires backend **idempotent revocation**. If already revoked on first try, backend must return 200/204 or deterministic code. | Conditionally safe. Safe on frontend; requires Phase 12 idempotent backend contract. |
| **Retry after `CONFIRMED_REVOKED`** | **Unnecessary & Redundant.** (Server session already terminated, local session cleared). | Local session is already `null` (`S7`). UI logout button is unmounted. | If somehow sent, backend treats already-revoked token idempotently. | Redundant no-op. Frontend state prevents execution. |
| **Repeated Rapid Retries (Idempotency)** | **Allowed (Debounced).** (User clicks retry multiple times before first completes). | `authOpSeqRef` drops superseded commits. Local state only updates on final resolution. | Backend handles concurrent identical revocation requests without deadlocks or 500s. | Conditionally safe. Frontend fences commits; backend must guarantee idempotency. |
| **Retry After Newer User Authenticates** | **STRICTLY FORBIDDEN.** (User B has authenticated in the tab). | Frontend `requestToken !== currentSession.token` fence blocks execution. | Backend **token-scoped revocation** guarantees User A token never affects User B. | Structurally blocked by frontend token binding and Phase 12 token scoping. |

### Token Ownership Guard Specification:
In any retry implementation, `POST /api/auth/logout` MUST explicitly bind to the exact token of the target session:
```typescript
const targetToken = sessionToLogout.token;
// Never read ambient authStorage.getToken() if the active session has changed!
```
Under Phase 12, the backend will validate `Authorization: Bearer <targetToken>`, ensuring that even if User A's retry is received after User B logs in, only User A's server session record is affected.

---

## 5. Authoritative vs. Conditional Server Outcome Classification

Version 1.7 categorized HTTP 401/404 as `CONFIRMED_REVOKED` and HTTP 500 as `UNKNOWN`. Version 1.8 establishes the exact conditions under which status classifications are valid:

### 1. HTTP 401 / 404 from `POST /api/auth/logout`:
- **Current Source Finding:** In the current frontend, `apiClient.ts` throws `ApiError` for 401/404. The current MSW mock handler (`authHandlers.ts#L153`) statically returns HTTP 200 and never produces 401/404.
- **Ambiguity in Unverified Gateways:** In a live network, HTTP 401 can be emitted by an edge proxy due to expired gateway tokens or clock skew. HTTP 404 can be emitted by a misconfigured load balancer if the routing path is missing.
- **Classification Rule:** HTTP 401/404 can **ONLY be classified as `CONFIRMED_REVOKED` conditionally** upon a Phase 12 backend contract specifying:
  1. The target session is identified strictly by its bearer token.
  2. The response explicitly indicates that the targeted session is invalid, expired, or already terminated.
  3. The response is generated by the application server auth service, not an intermediate proxy or missing route.
  4. The response payload contains a deterministic machine-readable code (e.g., `{ code: 'SESSION_TERMINATED' }`).
  *Without these four verified conditions, HTTP 401/404 must be treated as `UNKNOWN`!*

### 2. HTTP 500 / 502 / 503 / 504 from `POST /api/auth/logout`:
- **Classification:** Strictly **`UNKNOWN`**.
- **Reason:** A server error indicates an internal fault. The database transaction might have committed the revocation before encountering a serialization error, or it might have aborted before touching the database.
- The client cannot know the server state. The local session must be retained in `S8-A` to permit retry.

### 3. HTTP 200 / 204 from `POST /api/auth/logout`:
- **Classification:** Strictly **`CONFIRMED_REVOKED`**.
- Server explicitly acknowledges that the session is terminated. Local credentials are wiped, transitioning to `S7`.

---

## 6. Corrected Decision E Archive-Failure Semantics

In Version 1.7's failure matrix, archive failure was listed as:
`Server Status = Active` and `Authoritative Known Status = CONFIRMED_ACTIVE`.

**This was an architectural error.** When Phase 1 archival fails:
1. `authApi.logout()` is **never dispatched**.
2. No HTTP packet is transmitted to the server.
3. No server outcome is observed or established.
4. Existing server status is **unestablished at this instant** (it remains whatever it was prior to clicking logout).
5. Local user credentials remain authenticated in React state and `sessionStorage`.
6. Active Developer origin snapshot remains preserved in `metro_lms_developer_origin_session`.
7. Tab remains in state **`S8`** (displaying a recoverable banner in substate `S8-ERR`).

*Local authentication must never be equated with fresh server confirmation.*

---

## 7. Server-Side Concurrency Evidence Boundary

When User A dispatches logout, User B authenticates, and User A's logout resolves late:

```
Timeline:
T1: User A clicks logout (Token A). Phase 1 archives snapshot.
T2: apiClient dispatches POST /api/auth/logout (Bearer Token A).
T3: User B logs in (Token B). authOpSeqRef increments. sessionEpoch advances.
T4: User A logout HTTP response arrives at browser.
```

### 1. Verified Frontend Evidence:
- At T4, `AuthContext.tsx#logout()` checks `if (opId === authOpSeqRef.current)`.
- Because `opId (User A) !== authOpSeqRef.current (User B)`, the callback drops its commit.
- `authStorage.clearSession()` is NOT called; User B's React state and storage credentials are NOT wiped.
- **This proves client-side state protection.**

### 2. What Frontend Guards CANNOT Prove:
- The frontend guard cannot undo or prevent whatever the backend server did when it processed the HTTP packet for Token A.
- If the backend possessed a defective global logout implementation (revoking by IP, user ID, or ambient cookie), User B's server session would be destroyed on the backend despite frontend sequence guards.

### 3. Required Future Backend Contract (Phase 12):
- **Token-Scoped Isolation:** The backend MUST revoke strictly the single database record matching `Authorization: Bearer <Token A>`.
- Token B is completely independent and unaffected.
- **Evidence Label:** User B's server-side session integrity is **NOT verified in current code**; it is an **explicit future Phase 12 backend dependency**.

---

## 8. Corrected 16-Scenario Failure-Mode & Lifecycle Matrix

| # | Scenario Description | Local Status | Server Status | Authoritative Known Status | Retain Local Creds? | User Retry Eligible? | Active Origin Snapshot | Inert Archive Entry | Developer Return Controls? | Newer User Affected? |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | Server confirms successful revocation (HTTP 200/204) | Cleared (`S7`) | Revoked | `CONFIRMED_REVOKED` | No | No (Done) | `null` | Archived | Strictly Forbidden | No |
| **2** | Server explicitly confirms session active (`/api/auth/me` 200) | Active (`S8-A`) | Active | `CONFIRMED_ACTIVE` | Yes | Yes (Logout) | `null` | Archived | Strictly Forbidden | No |
| **3** | HTTP 500 Internal Server Error during logout | Active (`S8-A`) | Unknown | `UNKNOWN` | Yes | Yes (Logout) | `null` | Archived | Strictly Forbidden | No |
| **4** | Network timeout (15 000 ms elapsed in `apiClient`) | Active (`S8-A`) | Unknown | `UNKNOWN` | Yes | Yes (Logout) | `null` | Archived | Strictly Forbidden | No |
| **5** | Connection loss / Offline (`ERR_INTERNET_DISCONNECTED`) | Active (`S8-A`) | Unknown | `UNKNOWN` | Yes | Yes (Logout) | `null` | Archived | Strictly Forbidden | No |
| **6** | Client cancellation after HTTP dispatch | Active (`S8-A`) | Unknown | `UNKNOWN` | Yes | Yes (Logout) | `null` | Archived | Strictly Forbidden | No |
| **7** | `/api/auth/me` on reload confirms active session (HTTP 200) | Active (`S8-A`) | Active | `CONFIRMED_ACTIVE` | Yes | Yes (Logout) | `null` | Archived | Strictly Forbidden | No |
| **8** | `/api/auth/me` on reload returns HTTP 401/404 | Cleared (`S7`) | Revoked* | `CONFIRMED_REVOKED`* | No | No (Done) | `null` | Archived | Strictly Forbidden | No |
| **9** | `/api/auth/me` on reload returns Network Error / 500 | Retained (`S5-A`) | Unknown | `UNKNOWN` | Yes | Programmatic | `null` | Archived | Strictly Forbidden | No |
| **10** | Page reload immediately after unknown logout | Retained (`S5-A`) | Unknown | `UNKNOWN` | Yes | Programmatic | `null` | Archived | Strictly Forbidden | No |
| **11** | Retry after confirmed revocation (idempotent call) | Cleared (`S7`) | Revoked | `CONFIRMED_REVOKED` | No | No (Done) | `null` | Archived | Strictly Forbidden | No |
| **12** | Retry after unknown outcome succeeds (HTTP 200) | Cleared (`S7`) | Revoked | `CONFIRMED_REVOKED` | No | No (Done) | `null` | Archived | Strictly Forbidden | No |
| **13** | User A logout completes after User B logs in | User B Active | User A Revoked* | `CONFIRMED_REVOKED` (A)* | User B Retained | No (A Done) | `null` (B) | Archived (A) | Strictly Forbidden | No (Protected by Phase 12)* |
| **14** | `AbortController.abort()` cancels in-flight logout | Active (`S8-A`) | Unknown | `UNKNOWN` | Yes | Yes (Logout) | `null` | Archived | Strictly Forbidden | No |
| **15** | Decision E Archive Write Fails (Quota Exceeded) | Active (`S8`) | Unestablished | **UNOBSERVED** | Yes | Yes (Retry) | **Preserved** | Unmodified | Strictly Forbidden | No |
| **16** | Decision E Read-Back Verification Fails (Corruption) | Active (`S8`) | Unestablished | **UNOBSERVED** | Yes | Yes (Retry) | **Preserved** | Unmodified | Strictly Forbidden | No |

*\*Marked classifications are conditional upon the future Phase 12 token-scoped backend contract.*

---

## 9. Supplemental Test Accounting & 18-Point Coverage Matrix (`SUP-01-T01`)

### Strict Accounting & Status Distinction:
- **Physical Test Files in Repository:** Exactly **60 accepted core specifications** exist in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx).
- **Physical Test Modifications:** **ZERO test files have been created or modified.** No test cases have been added to the codebase during this planning audit.
- **Supplemental Specification Design:** `SUP-01-T01` is a **proposed supplemental specification designed and documented in this report**.
- **Formal Lifecycle Status:**
  `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
  *(This status reflects that the design of the specification is fully authored in planning documentation, while its code insertion at lines 5644+ and execution are strictly deferred to Phase 13 / Gate B under authorized remediation package `WP-5.4.5-R1`)*.
- **Total Test Specification Count:**
  $$	ext{60 Frozen Core Accepted} + 	ext{1 Proposed Supplemental (SUP-01-T01)} = \mathbf{61	ext{ Total Planned Specifications}}$$

### The 18-Point Supplemental Test Coverage Matrix (`SUP-01-T01`):
When implemented under `WP-5.4.5-R1`, test specification `SUP-01-T01` must execute the following 18 distinct verification cases:

1. **`SUP-01-T01-01` (Decision E Quota Failure):** Quota failure on archival aborts logout; server logout uncalled; local session in S8; active origin intact; server status unobserved.
2. **`SUP-01-T01-02` (Decision E Corruption Failure):** Read-back hash mismatch aborts logout; server logout uncalled; local session in S8; active origin intact.
3. **`SUP-01-T01-03` (Synchronous Phase 1 Archival):** Successful archival and active-origin clearing execute in the same synchronous JavaScript tick.
4. **`SUP-01-T01-04` (HTTP 200 Confirmed Revocation):** Server returns HTTP 200; local credentials cleared; `S8 → S7` completed cleanly.
5. **`SUP-01-T01-05` (HTTP 500 Unknown Outcome):** Server returns HTTP 500; session enters `S8-A`; local credentials retained; retry enabled.
6. **`SUP-01-T01-06` (Network Timeout Handling):** `apiClient` times out (15 000 ms); session enters `S8-A`; local credentials retained; retry enabled.
7. **`SUP-01-T01-07` (Connection Loss Handling):** Offline/network disconnect enters `S8-A`; local credentials retained; retry enabled.
8. **`SUP-01-T01-08` (Idempotent Retry Execution):** Retry from `S8-A` detects `hasDeveloperOriginSession() === false`; bypasses Phase 1 archival; avoids duplicate archive entries.
9. **`SUP-01-T01-09` (S5-A Entry on Cold Reload):** Cold reload after unknown logout with network down sets `user = null`, retains stored credentials, and sets S5 error.
10. **`SUP-01-T01-10` (S5-A UI Accessibility Boundary):** Verified that `ProtectedRoute` redirects to `/login` when `user === null`, where retry button is currently absent.
11. **`SUP-01-T01-11` (Revalidation Recovery CONFIRMED_ACTIVE):** Programmatic `retryRevalidation()` returning HTTP 200 restores `S8-A` without restoring archived Developer snapshot.
12. **`SUP-01-T01-12` (Revalidation Recovery CONFIRMED_REVOKED):** Programmatic `retryRevalidation()` returning HTTP 401/404 clears local credentials and transitions to `S7`.
13. **`SUP-01-T01-13` (Revalidation Transient Failure S5-A):** Programmatic `retryRevalidation()` encountering transport error remains in `S5-A` with stored credentials intact.
14. **`SUP-01-T01-14` (Token Ownership Binding):** Logout retry is bound strictly to target session token, preventing consumption of a newer authenticated token.
15. **`SUP-01-T01-15` (HTTP 401/404 Conditional Classification):** Verified that HTTP 401/404 without machine code is treated as `UNKNOWN` rather than confirmed revoked.
16. **`SUP-01-T01-16` (User A / User B Concurrency Fence):** User A logout resolving after User B login drops frontend commit via `authOpSeqRef` / `sessionEpoch`.
17. **`SUP-01-T01-17` (Banner Suppression Invariant):** Developer preview banner and emergency return controls are strictly suppressed across `S8-A`, `S8-ERR`, and `S5-A`.
18. **`SUP-01-T01-18` (Multi-Cycle Archival Retention):** Multiple consecutive SUP-01 cycles retain distinct historical inert snapshots without overwriting or reactivating earlier entries.

---

## 10. Multi-Tier Evidence Boundary Partitioning

To maintain strict truth-in-documentation and prevent unevidenced assumptions, findings are partitioned into five explicit tiers:

### Tier 1: Verified From Current Frontend Source Code
- Synchronous `sessionStorage` manipulation and verification in `authStorage.ts`.
- `AuthContext.tsx` sequence counter `authOpSeqRef.current` and monotonic `sessionEpoch`.
- `ProtectedRoute.tsx` redirecting to `/login` when `user === null`.
- `LoginForm.tsx` rendering text error but lacking interactive retry controls.
- `apiClient.ts` 15-second timeout and `ApiError` normalization.

### Tier 2: Current MSW Mock-Only Behavior
- [`authHandlers.ts#L153`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/authHandlers.ts#L153): Statically returns HTTP 200 `{ success: true }`.
- Mock handlers do not evaluate bearer tokens, simulate database sessions, or produce realistic server concurrency.
- **Mock behavior cannot prove production server semantics.**

### Tier 3: Proposed Frontend Behavior (Not Yet Implemented)
- Two-phase atomic archival transaction `archiveDeveloperOriginSession()` in `authStorage.ts`.
- Decision E pre-flight abort logic in `AuthContext.tsx#logout()`.
- Interactive retry control or reconnection UI in `LoginForm.tsx` or `AppLayout.tsx`.
- Proposed supplemental test specification `SUP-01-T01`.

### Tier 4: Required Future Backend Guarantees (Phase 12)
- Token-scoped revocation: `POST /api/auth/logout` revokes strictly the targeted bearer token.
- Idempotent revocation: Duplicate logout requests return safe 200/204 or deterministic code.
- Deterministic error payloads: HTTP 401/404 explicitly includes machine-readable reason code.
- Zero cross-session or ambient cookie side effects.

### Tier 5: Deferred Integration Verification (Phase 13 / Gate B)
- Live multi-tab concurrency and token race conditions with a running backend.
- End-to-end browser automation validating physical storage across tabs.
- Physical execution of supplemental test specification `SUP-01-T01`.

---

## 11. Mandatory Seven-Account Inventory

The project test and authorization matrix strictly comprises seven accounts:

| User ID | Username | Global Platform Role | Persona / Fixture Classification | Security Scope & Continuity Policy |
| :--- | :--- | :--- | :--- | :--- |
| `USR_DEV_001` | `developer_internal` | `developer` | Privileged Internal Fixture | Full platform inspection; can initiate persona isolation. |
| `USR_SUPER_001` | `super_admin_demo` | `super_admin` | Privileged System Fixture | Platform administration; non-isolated system fixture. |
| `USR_TEST_SUPER_001` | `test_super_admin` | `super_admin` | Synthetic Persona 1 | Isolated Super Admin persona testing. |
| `USR_TEST_ADMIN_001` | `test_admin` | `admin` | Synthetic Persona 2 | Isolated Admin persona testing. |
| `USR_TEST_AST_001` | `test_assistant_admin` | `assistant_admin` | Synthetic Persona 3 | Isolated Assistant Admin persona testing. |
| `USR_TEST_LEC_001` | `test_lecturer` | `lecturer` | Synthetic Persona 4 | Isolated Lecturer persona testing. |
| `USR_TEST_TRN_001` | `test_trainee` | `user` | Synthetic Persona 5 | Isolated Trainee persona testing. |

*Note: Exactly five synthetic personas. `assistant_lecturer` is a group-scoped role assignment, not a global role or persona fixture. No credentials or secrets are stored in reports.*

---

## 12. Exact Future Implementation Files (`WP-5.4.5-R1`)

Under a future separately authorized remediation package (`WP-5.4.5-R1`):
1. [`frontend/src/core/auth/authStorage.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authStorage.ts):
   - Add `INERT_DEVELOPER_SNAPSHOTS_STORAGE_KEY = 'metro_lms_inert_developer_snapshots'`.
   - Add types `InertDeveloperSnapshotArchiveEntry` and `InertDeveloperSnapshotArchive`.
   - Implement synchronous, two-phase atomic archiving transaction `archiveDeveloperOriginSession()`.
   - Add read-only accessor `getInertDeveloperSnapshots()`.
2. [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx):
   - In `logout()`: Implement Decision E pre-flight transactional abort before calling `authApi.logout()`.
   - Bind retry operations to specific target session tokens.
3. [`frontend/src/features/auth/components/LoginForm.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/auth/components/LoginForm.tsx):
   - Design connection recovery / retry UI when in substate `S5-A`.
4. [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx):
   - Author supplemental specification `SUP-01-T01` (lines 5644+) implementing the 18-point coverage matrix.
5. [`docs/frontend/reports/phase-05-increment-04-wp-5.4.5-implementation-report.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/phase-05-increment-04-wp-5.4.5-implementation-report.md):
   - Increment to Version 4.0; document 61 total specifications.
6. [`docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md):
   - Update checklist status to `[Completed — Ready for Owner Acceptance]`.

---

## 13. Governance & Non-Execution Attestation

This planning review strictly adhered to project governance:
- **0 production source files modified.**
- **0 test files modified.**
- **0 test specifications created, deleted, or renumbered.**
- **0 Git commands staging or committing changes (`git status` confirms 0 staged files).**
- **0 automated test runners, linters, compilers, or builds executed.**
- **Versions 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, and 1.7 preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 14. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED**

*(All state consistency transitions, S5-A UI accessibility boundaries, token-scoped retry semantics, conditional HTTP 401/404 classifications, unobserved Decision E archive failure rows, client vs backend concurrency boundaries, and the expanded 18-point test coverage matrix have been rigorously reconciled against inspected source code. The frontend architecture design is complete, and production backend requirements are formally bounded and deferred to Phase 12. Remediation package WP-5.4.5-R1 is ready for explicit owner implementation authorization).*
