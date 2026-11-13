# MetroLMS — SUP-01 Recovery UX, Server Acknowledgment & Token Ownership Audit (Version 1.9)
## Architecture Review: S5-A Recovery UX, Revocation Acknowledgment Semantics, /api/auth/me Causality, and Token Ownership Boundaries

**Document Version:** 1.9 (Final Recovery UX, Server Acknowledgment & Token Ownership Closure Audit)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-server-outcome-semantics-audit-v1-9.md`  
**Classification:** Architectural Remediation & Test Coverage Plan (Planning Only — Zero Implementation)  
**Target Transition:** `SUP-01: S8 → S7` (Real-User Logout with Preserved Inert Developer Origin Snapshot)  
**Governing Owner Decisions:**  
- **Decision A (S0):** Approved 2026-11-06 (Only `S0 → S1` permitted; `S0 → S3/S14/S15` forbidden)  
- **Decision B (S8):** Approved 2026-11-06 (`S8 → S14/S15` forbidden; Developer origin never reactivated by real user)  
- **Decision C (Real-User Logout):** Approved 2026-11-06 (`S8 → S7` approved; origin snapshot preserved inert in per-tab sessionStorage until tab close)  
- **Decision E (Archival Failure Policy):** **APPROVED 2026-11-06 (Option 1 — Transactional Abort)**  
**Execution Directives:** Strict Read-Only Planning Governance Preserved (Zero production code modifications, zero test changes, zero Git staging/commits, zero test runner or compiler execution)  
**Proposed Remediation Package:** `WP-5.4.5-R1` (Separately Authorized Remediation Package planned prior to Phase 13)  
**Remediation Plan Status:** `READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED`

---

## 1. Executive Summary & Problem Closure Scope

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 architecture reports. Versions 1.1 through 1.8 progressively reconciled the multi-snapshot archive model, atomic transactions, failure classifications, and intermediate states (`S8-A`, `S8-ERR`, and `S5-A`). 

Version 1.9 provides the final closure on four remaining state-consistency, evidence, and user-experience issues:
1. **S5-A Recovery UX Specification:** Formulating the complete, interactive frontend user experience for substate `S5-A` (cold reload after indeterminate logout with transient transport failure) where `user === null` and the user is redirected to `/login`.
2. **Distinguishing Mock Success from Authoritative Revocation:** Formally separating MSW mock static HTTP 200 responses (`MOCK_SUCCESS_RESPONSE`) from production backend contract fulfillment (`AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT`) and authoritative session termination (`CONFIRMED_REVOKED`).
3. **Reconciling `/api/auth/me` 401/404 Semantics:** Decoupling token invalidity (`TOKEN_CONFIRMED_INVALID`) from unproven historical logout causality.
4. **Explicit Token Ownership Boundaries:** Replacing ambient storage token reads with explicit, immutable token bindings for logout and retry operations to prevent cross-user token contamination.

---

## 2. S5-A Recovery Interface — Complete UX & Architectural Specification

### 2.1 Current Source Diagnostic (Why User Has No Interactive Recovery Today)
A line-by-line inspection of current source files reveals:
1. [`frontend/src/core/auth/AuthContext.tsx#L487-L496`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx#L487-L496): When `/api/auth/me` fails with a transient network error or ambiguous HTTP 500, `AuthContext` preserves local credentials in `authStorage.getSession()`, but sets `user = null` and sets `error = 'تعذر التحقق من صلاحية الجلسة...'`.
2. [`frontend/src/core/auth/AuthContext.tsx#L1342`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx#L1342): `isAuthenticated` is exported strictly as `Boolean(user)`. When `user === null`, `isAuthenticated` is `false`.
3. [`frontend/src/core/auth/ProtectedRoute.tsx#L32-L36`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/ProtectedRoute.tsx#L32-L36): Any protected route intercepts `!isAuthenticated` and dispatches `<Navigate to="/login" state={{ from: location }} replace />`. Authenticated layouts (`AppLayout`, `Sidebar`, `MobileDrawer`) unmount immediately.
4. [`frontend/src/features/auth/components/LoginForm.tsx#L146-L152`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/auth/components/LoginForm.tsx#L146-L152): Renders `{error && <div className="login-error visible">...<span>{error}</span></div>}` as static text. It exposes **zero retry buttons**, **zero connection revalidation controls**, and **zero logout buttons**.
5. [`frontend/src/core/auth/AuthContext.tsx#L508-L510`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx#L508-L510): `retryRevalidation()` exists purely as a programmatic function in `AuthContextValue`, called only by unit test runners.

**Conclusion:** In the current codebase, a user in `S5-A` has **no interactive recovery path** and can only re-enter credentials or select a demo user.

### 2.2 Proposed S5-A Recovery UX Specification (Planned for `WP-5.4.5-R1`)

```
+-----------------------------------------------------------------------------------------+
|                                    /login Route Shell                                    |
|                                                                                         |
|  +-----------------------------------------------------------------------------------+  |
|  | [!] تعذر التحقق من اتصال جلستك السابقة بالخادم (مشكلة في الشبكة)                  |  |
|  |                                                                                   |  |
|  | الجلسة المحلية محفوظة بأمان. يمكنك إعادة الاتصال لاستئناف جلستك، أو تسجيل الدخول. |  |
|  |                                                                                   |  |
|  |  [ إعادة محاولة الاتصال والتحقق ]          [ إلغاء الجلسة المحلية ومتابعة الدخول ]  |  |
|  +-----------------------------------------------------------------------------------+  |
|                                                                                         |
|  [ Standard LoginForm Inputs: Email, Password, Demo Picker ]                            |
+-----------------------------------------------------------------------------------------+
```

The proposed UX design addresses all ten architectural requirements:
1. **Interface Placement:** The recovery interface resides inside [`frontend/src/features/auth/components/LoginForm.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/auth/components/LoginForm.tsx) as a dedicated contextual card: `SessionRecoveryCard`.
2. **Route Scope:** It belongs strictly to the **public/authentication shell** (`/login`). It does not rely on `ProtectedRoute` or `AppLayout`, which require `isAuthenticated === true`.
3. **Identification Without Exposing Secrets:** The card triggers when `authStorage.hasSession() === true` and `user === null` and `error` indicates transport failure. It displays only high-level status ("جلسة سابقة محفوظة") and optionally non-sensitive role text (e.g. `authStorage.getUser()?.role`), with zero display of bearer tokens, passwords, or cryptographic digests.
4. **Manual Retry Action:** The card provides an interactive button:
   ```tsx
   <Button
     type="button"
     variant="primary"
     isLoading={isLoading}
     onClick={() => retryRevalidation()}
   >
     إعادة محاولة الاتصال والتحقق
   </Button>
   ```
   Clicking this button sets `isLoading(true)` and dispatches `authApi.getCurrentUser()`.
5. **Outcome on Successful Revalidation:**
   - `/api/auth/me` returns HTTP 200 with the valid user payload.
   - `setUser(response.user)` updates state; `isAuthenticated` becomes `true`.
   - `LoginPage.tsx`'s navigation effect detects `isAuthenticated === true` and navigates to `targetPath` (`/dashboard`).
   - The user is cleanly restored to state `S8-A`.
   - The standard logout button in `Sidebar.tsx` / `MobileDrawer.tsx` is restored, allowing normal, safe logout retry.
6. **Outcome on Another Transport Failure:**
   - `revalidateSession()` catch block triggers; `user` remains `null`.
   - Error banner is updated with latest timestamp; `isLoading` returns to `false`.
   - The `SessionRecoveryCard` remains visible, allowing subsequent retries.
7. **Outcome on Backend Confirmation of Invalid Session (HTTP 401/403/404):**
   - Catch block executes lines 479–486 of `AuthContext.tsx`.
   - `authStorage.clearSession()` purges local credentials.
   - Stored session is cleared; `SessionRecoveryCard` unmounts.
   - Clean transition to state `S7` (Unauthenticated with Inert Developer Archive).
8. **Suppression of Developer Return Controls:**
   - Developer preview banner and emergency return controls are gated strictly by `isIsolatedSession === true` and `isEmergencyState === true`.
   - In `S5-A`, active Developer origin snapshot was cleared in Phase 1 (`authStorage.hasDeveloperOriginSession() === false`).
   - Therefore, `isIsolatedSession` is `false`, `isEmergencyState` is `false`, and no return banners or controls can ever render.
9. **Inert Developer Snapshot Preservation:**
   - The snapshot remains in `metro_lms_inert_developer_snapshots`.
   - No authentication or recovery code reads or reactivates this key. It remains inert until tab termination.
10. **Prevention of Stale / New User Confusion:**
    - If the user ignores recovery and logs in as User C, `login()` writes the new session and calls `advanceSessionEpoch()`.
    - `currentEpoch` advances. If any pending revalidation resolves late, `requestEpoch !== currentEpoch` drops the commit.
    - The old session is replaced cleanly without identity bleed.

---

## 3. Distinguishing HTTP Success Acknowledgment from Actual Revocation

Version 1.8 classified HTTP 200/204 as `CONFIRMED_REVOKED`. However, rigorous source analysis demonstrates that current test execution relies entirely on MSW mock handlers.

### 3.1 Concrete Evidence in Mock Implementation
Inspection of [`frontend/src/mocks/handlers/authHandlers.ts#L153-L157`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/authHandlers.ts#L153-L157):
```typescript
http.post('/api/auth/logout', () => {
  return HttpResponse.json({ success: true });
}),
```
- The MSW mock handler does NOT inspect `Authorization: Bearer <token>`.
- The MSW mock handler does NOT verify token validity against a session store or database.
- The MSW mock handler returns static HTTP 200 `{ success: true }` regardless of whether the token is valid, malformed, expired, or already revoked.

### 3.2 Authoritative Three-Category Classification Model
To eliminate false claims of verified server behavior, Version 1.9 establishes three distinct categories:

| Category | Source & Environment | Exact Meaning | Evidence Threshold |
| :--- | :--- | :--- | :--- |
| **`MOCK_SUCCESS_RESPONSE`** | Frontend unit tests executing against MSW (`authHandlers.ts`). | The mock handler received a `POST /api/auth/logout` call and returned its configured static JSON response. | **Verified in Current Source.** Establishes that the frontend executes its post-logout state transitions when HTTP 200 is received. |
| **`AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT`** | Production backend (Phase 12) satisfying the formal API contract. | The application backend auth service inspected the explicit bearer token, deleted the matching database session record, and returned a deterministic confirmation code. | **Required Phase 12 Backend Contract.** Cannot be established by MSW mocks. |
| **`CONFIRMED_REVOKED`** | System-wide authoritative state. | The target session token is irrevocably invalidated across both server and client. | **System Invariant.** Achieved only when `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT` is received by the client. |

### 3.3 Required Phase 12 Production Backend Contract
Before an HTTP 200/204 response can be classified as `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT`, the Phase 12 backend must implement:
1. **Token-Specific Identification:** Revocation must query and delete strictly the session record matching `Authorization: Bearer <token>`.
2. **Explicit Operation Confirmation:** The response body must include a machine-readable confirmation code: `{ success: true, code: 'SESSION_REVOKED', revokedTokenHash: '...' }`.
3. **No Blanket Revocation:** The operation must not revoke tokens belonging to other users or devices sharing an IP or subnet.
4. **Deterministic Semantics:** Generic HTTP 200 responses from web application firewalls or intermediate API proxies that lack the auth service signature must be treated as `UNKNOWN`.

---

## 4. Reconciling `/api/auth/me` 401/404 Semantics & Causality

When a cold page reload occurs in `S5-A` and `revalidateSession()` calls `GET /api/auth/me`, receiving HTTP 401 or 404 indicates that the token cannot authenticate the request.

Version 1.8 labeled this `CONFIRMED_REVOKED`. Version 1.9 decouples token invalidity from historical logout causality:

```
[GET /api/auth/me returns HTTP 401 / 404]
                   │
                   ▼
       Token is Invalid / Non-Existent
                   │
     ┌─────────────┴─────────────┐
     ▼                           ▼
Hypothesis A:               Hypothesis B:
Previous Logout             Natural Expiration (TTL),
Revoked the Session         Admin Revocation, Cache Flush
```

### 4.1 Authoritative Three-Way Distinction:
1. **Target Token Invalid for Authentication (`TOKEN_CONFIRMED_INVALID`):**
   - Authoritatively established: The backend server rejected the bearer token.
   - Local Action: Lines 479–486 of `AuthContext.tsx` execute: `authStorage.clearSession()`, `setUser(null)`, and transition to state `S7`.
2. **Target Session Revocation Status (`SESSION_TERMINATED`):**
   - Established: The session is no longer active on the server.
3. **Logout Causality (`CAUSED_BY_PREVIOUS_LOGOUT`):**
   - **UNPROVEN.** Current frontend code cannot establish whether the invalidity was caused by the previous in-flight logout request or by token TTL expiration, Redis eviction, or admin revocation.
   - **Rule:** The frontend must classify the outcome as `TOKEN_CONFIRMED_INVALID (Causality Unproven)`, transition to `S7`, and never claim that the previous logout operation was authoritatively confirmed as the cause.

---

## 5. Explicit Token Ownership Boundaries

### 5.1 Current Source Diagnostic: Ambient Storage Token Vulnerability
Inspection of current source code:
1. [`frontend/src/core/auth/authApi.ts#L29-L33`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authApi.ts#L29-L33):
   ```typescript
   async logout(): Promise<{ success: boolean; message: string }> {
     return apiClient<{ success: boolean; message: string }>('/api/auth/logout', {
       method: 'POST',
     });
   }
   ```
2. [`frontend/src/core/api/apiClient.ts#L180-L188`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/api/apiClient.ts#L180-L188):
   ```typescript
   const session = authStorage.getSession();
   if (session?.token) {
     defaultHeaders['Authorization'] = `Bearer ${session.token}`;
   }
   ```

**Critical Vulnerability:** `authApi.logout()` takes **zero arguments**. `apiClient` reads `authStorage.getSession()?.token` dynamically from ambient storage at the exact instant of fetch execution.
- If User A clicks logout, and a retry is dispatched after User B logs in, `apiClient` reads **User B's token** from `authStorage` and transmits it in the `Authorization` header!
- This would cause the backend to revoke User B's session!

### 5.2 Proposed Token Ownership Architecture (Planned for `WP-5.4.5-R1`)

To establish absolute token isolation, Version 1.9 specifies four distinct token categories:

```
1. Target Bound Token (Immutable) ──> Captured at click time: sessionToLogout.token
                                      Passed explicitly: authApi.logout(targetToken)
2. Retained Retry Token (Bound)   ──> Stored in pendingRetryToken ref/state
                                      Bound strictly to original session ID
3. Ambient Storage Token          ──> Read only for current active session
4. Newer Authenticated Token      ──> Stored under new sessionEpoch; isolated from retry
```

#### Exact Implementation Requirements for `WP-5.4.5-R1`:
1. **Explicit Token Parameter:**
   Update [`frontend/src/core/auth/authApi.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authApi.ts):
   ```typescript
   async logout(explicitToken?: string): Promise<{ success: boolean; message: string }> {
     return apiClient<{ success: boolean; message: string }>('/api/auth/logout', {
       method: 'POST',
       headers: explicitToken ? { Authorization: `Bearer ${explicitToken}` } : undefined,
     });
   }
   ```
2. **Explicit Token Capture in `logout()`:**
   In [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx):
   ```typescript
   const targetSession = authStorage.getSession();
   const targetToken = targetSession?.token;
   // Pass targetToken explicitly to ensure retry can never read ambient storage!
   await authApi.logout(targetToken);
   ```
3. **Session Epoch & Token Match Guard:**
   Before any retry or post-logout state mutation is committed:
   ```typescript
   if (opId !== authOpSeqRef.current || targetToken !== authStorage.getToken()) {
     // A newer user has authenticated; discard all local side effects!
     return;
   }
   ```
4. **Backend Concurrency Reality:**
   Frontend sequence guards prevent User A's late logout from clearing User B's React state. However, server-side protection requires the Phase 12 token-scoped revocation contract (`Authorization: Bearer <token>` revokes strictly that token).

---

## 6. Corrected State, Evidence & Lifecycle Matrix

| # | Scenario Description | AuthContext User | Local Credential Status | Server Status | What Is Actually Known | Available User Action | Retry Eligible? | Active Origin Snapshot | Inert Archive Entry | Developer Return Controls? | Newer User Affected? |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | Current S5-A (No Recovery UI) | `null` | Retained (`sessionStorage`) | Unknown | Transport failed; credentials preserved; UI redirect to `/login` | Enter new credentials or pick demo user | Programmatic Only | `null` | Preserved | Strictly Forbidden | No |
| **2** | Proposed S5-A (With Recovery UI) | `null` | Retained (`sessionStorage`) | Unknown | Transport failed; credentials preserved; recovery card rendered | Click "إعادة محاولة الاتصال" or Login | Interactive Available | `null` | Preserved | Strictly Forbidden | No |
| **3** | Revalidation Success (`/api/auth/me` 200) | Restored Real User | Retained (`S8-A`) | `CONFIRMED_ACTIVE` | Backend confirmed session valid; restored to `S8-A` | Normal dashboard use; click Logout | Yes (in S8-A) | `null` | Preserved | Strictly Forbidden | No |
| **4** | Revalidation Transport Failure | `null` | Retained (`S5-A`) | Unknown | Backend unreachable; credentials preserved; S5 error updated | Retry Revalidation or Login | Interactive Available | `null` | Preserved | Strictly Forbidden | No |
| **5** | Revalidation Token Invalid (`/api/auth/me` 401/404) | `null` | Cleared (`S7`) | `TOKEN_CONFIRMED_INVALID` | Backend rejected token; previous logout causality unproven | Login as fresh user | No (Session Cleared) | `null` | Preserved | Strictly Forbidden | No |
| **6** | Logout Mock Success (MSW HTTP 200) | `null` | Cleared (`S7`) | `MOCK_SUCCESS_RESPONSE` | MSW handler returned configured success; local state cleared | Login as fresh user | No (S7 Reached) | `null` | Preserved | Strictly Forbidden | No |
| **7** | Production Revocation Acknowledgment (Phase 12) | `null` | Cleared (`S7`) | `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT` | Production backend confirmed targeted token deleted | Login as fresh user | No (S7 Reached) | `null` | Preserved | Strictly Forbidden | No |
| **8** | Logout 401/404 (Unverified Gateway) | Active (`S8-A`) | Retained (`S8-A`) | `UNKNOWN` | Ambiguous proxy error; token revocation unestablished | Click "إعادة محاولة تسجيل الخروج" | Yes | `null` | Preserved | Strictly Forbidden | No |
| **9** | Retry after UNKNOWN | Active (`S8-A`) | Retained (`S8-A`) | `UNKNOWN` | Retrying with bound target token; Phase 1 archival bypassed | In-flight request | Yes (Debounced) | `null` | Preserved | Strictly Forbidden | No |
| **10** | Retry after Newer User Authenticates | User B Active | User B Retained | User A Revoked* | Frontend fence dropped commit; targetToken isolated | Normal dashboard use (User B) | Forbidden for User A | `null` (B) | Preserved (A) | Strictly Forbidden | No (Protected by Token Binding & Phase 12)* |

*\*Marked classification is conditional upon the Phase 12 token-scoped backend contract.*

---

## 7. Supplemental Test Accounting & 20-Point Coverage Matrix (`SUP-01-T01`)

### Strict Test Suite Accounting:
- **Physical Test Files in Repository:** Exactly **60 accepted core specifications** exist in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx).
- **Physical Test Modifications:** **ZERO test files created or modified.** No physical code additions have occurred during this planning turn.
- **Supplemental Specification Design:** `SUP-01-T01` is a **proposed supplemental specification designed and documented within this planning report**.
- **Formal Lifecycle Status:**
  `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
- **Total Test Specification Count:**
  $$	ext{60 Frozen Core Accepted} + 	ext{1 Proposed Supplemental (SUP-01-T01)} = \mathbf{61	ext{ Total Planned Specifications}}$$

### The 20-Point Supplemental Test Coverage Matrix (`SUP-01-T01`):
When implemented under authorized remediation package `WP-5.4.5-R1`, specification `SUP-01-T01` must execute the following 20 verification points:

1. **`SUP-01-T01-01` (Decision E Quota Failure):** Quota failure on archival aborts logout; server logout uncalled; local session in S8; active origin intact; server status unobserved.
2. **`SUP-01-T01-02` (Decision E Corruption Failure):** Read-back hash mismatch aborts logout; server logout uncalled; local session in S8; active origin intact.
3. **`SUP-01-T01-03` (Synchronous Phase 1 Archival):** Successful archival and active-origin clearing execute in the same synchronous JavaScript tick.
4. **`SUP-01-T01-04` (MSW Mock Success Handling):** MSW static HTTP 200 clears local credentials and transitions to S7 (`MOCK_SUCCESS_RESPONSE`).
5. **`SUP-01-T01-05` (Phase 12 Authoritative Revocation):** Production response with confirmation code acknowledged as `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT`.
6. **`SUP-01-T01-06` (HTTP 500 Unknown Outcome):** Server returns HTTP 500; session enters `S8-A`; local credentials retained; retry enabled.
7. **`SUP-01-T01-07` (Network Timeout Handling):** `apiClient` times out (15 000 ms); session enters `S8-A`; local credentials retained; retry enabled.
8. **`SUP-01-T01-08` (Connection Loss Handling):** Offline/network disconnect enters `S8-A`; local credentials retained; retry enabled.
9. **`SUP-01-T01-09` (Idempotent Retry Execution):** Retry from `S8-A` detects `hasDeveloperOriginSession() === false`; bypasses Phase 1 archival; avoids duplicate archive entries.
10. **`SUP-01-T01-10` (Current S5-A UI Diagnostic):** Verified that `ProtectedRoute` redirects to `/login` when `user === null`, where retry button is currently absent.
11. **`SUP-01-T01-11` (Proposed S5-A Recovery UX):** Proposed `SessionRecoveryCard` renders on `/login` and binds click to `retryRevalidation()`.
12. **`SUP-01-T01-12` (Revalidation Recovery CONFIRMED_ACTIVE):** `/api/auth/me` returning HTTP 200 restores `S8-A` without restoring archived Developer snapshot.
13. **`SUP-01-T01-13` (Revalidation TOKEN_CONFIRMED_INVALID):** `/api/auth/me` returning HTTP 401/404 clears local credentials and transitions to `S7` without claiming logout causality.
14. **`SUP-01-T01-14` (Revalidation Transient Failure S5-A):** `/api/auth/me` encountering transport error remains in `S5-A` with stored credentials intact.
15. **`SUP-01-T01-15` (Explicit Target Token Binding):** `authApi.logout(targetToken)` transmits explicit token rather than reading ambient storage.
16. **`SUP-01-T01-16` (Newer User Token Isolation):** Logout retry targeting User A never reads or transmits User B's token.
17. **`SUP-01-T01-17` (HTTP 401/404 Gateway Ambiguity):** Unverified gateway 401/404 treated as `UNKNOWN` rather than confirmed revoked.
18. **`SUP-01-T01-18` (User A / User B Concurrency Fence):** User A logout resolving after User B login drops frontend commit via `authOpSeqRef` / `sessionEpoch`.
19. **`SUP-01-T01-19` (Banner Suppression Invariant):** Developer preview banner and emergency return controls are strictly suppressed across `S8-A`, `S8-ERR`, and `S5-A`.
20. **`SUP-01-T01-20` (Multi-Cycle Archival Retention):** Multiple consecutive SUP-01 cycles retain distinct historical inert snapshots without overwriting or reactivating earlier entries.

---

## 8. Multi-Tier Evidence Boundary Partitioning

1. **Tier 1: Verified Current Frontend Source:**
   - Synchronous `sessionStorage` manipulation and verification in `authStorage.ts`.
   - Sequence counter `authOpSeqRef.current` and monotonic `sessionEpoch` in `AuthContext.tsx`.
   - `ProtectedRoute.tsx` redirecting to `/login` when `user === null`.
   - `LoginForm.tsx` rendering error text but lacking interactive retry controls.
   - `apiClient.ts` reading ambient storage tokens dynamically.
2. **Tier 2: Current MSW Mock-Only Behavior:**
   - `authHandlers.ts#L153`: Statically returns HTTP 200 `{ success: true }` without token inspection.
   - Mock behavior establishes frontend lifecycle execution only; it cannot prove production server semantics.
3. **Tier 3: Proposed Frontend Recovery Design (`WP-5.4.5-R1`):**
   - Two-phase atomic archival transaction `archiveDeveloperOriginSession()` in `authStorage.ts`.
   - Decision E pre-flight abort logic in `AuthContext.tsx#logout()`.
   - Public `SessionRecoveryCard` in `LoginForm.tsx` for S5-A revalidation.
   - Explicit `targetToken` binding in `authApi.logout()`.
   - Proposed supplemental test specification `SUP-01-T01`.
4. **Tier 4: Required Phase 12 Production Backend Guarantees:**
   - Token-scoped revocation: `POST /api/auth/logout` revokes strictly the targeted bearer token.
   - Authoritative machine-readable response: `{ success: true, code: 'SESSION_REVOKED' }`.
   - Idempotent revocation handling.
   - Zero cross-session or ambient cookie side effects.
5. **Tier 5: Deferred Integration Verification (Phase 13 / Gate B):**
   - Live multi-tab concurrency and token race conditions with a running backend.
   - Physical execution of supplemental test specification `SUP-01-T01`.

---

## 9. Mandatory Seven-Account Inventory

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

## 10. Governance & Non-Execution Attestation

This planning review strictly adhered to project governance:
- **0 production source files modified.**
- **0 test files modified.**
- **0 test specifications created, deleted, or renumbered.**
- **0 Git commands staging or committing changes (`git status` confirms 0 staged files).**
- **0 automated test runners, linters, compilers, or builds executed.**
- **Versions 1.1 through 1.8 preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 11. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED**

*(The frontend design for SUP-01 remediation is completely reconciled. S5-A recovery UX, mock vs. authoritative revocation semantics, /api/auth/me non-causality, and explicit token ownership boundaries are fully specified with exact source code evidence. Production backend requirements are formally bounded and deferred to Phase 12. Remediation package WP-5.4.5-R1 is ready for explicit owner implementation authorization).*
