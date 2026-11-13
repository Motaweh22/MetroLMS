# MetroLMS — SUP-01 Authentication Semantics & Token Ownership Audit (Version 2.0)
## Final Architecture Review: Granular HTTP Status Semantics, Authoritative Revocation Contracts, S5-A State Discriminator, and Mandatory Target-Token Binding

**Document Version:** 2.0 (Final Authentication Semantics & Token Ownership Closure Audit)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-server-outcome-semantics-audit-v2-0.md`  
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

## 1. Executive Summary & Binding Owner Decisions

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 architecture reports. Versions 1.1 through 1.9 progressively analyzed the multi-snapshot archive model, atomic transactions, failure classifications, S5-A recovery UX, and ambient storage vulnerabilities.

Version 2.0 provides final closure on four remaining architectural and evidence issues:
1. **Granular HTTP 401 / 403 / 404 Status Semantics:** Disentangling HTTP 401 (unauthenticated), HTTP 403 (authenticated but unauthorized), and HTTP 404 (route/proxy vs. session-not-found) to eliminate blanket credential-purging on non-authentication errors.
2. **Unified Revocation Semantics for HTTP 200 and 204:** Establishing that status codes alone do not prove session termination; defining the mandatory Phase 12 contract requiring deterministic confirmation payloads (JSON code or explicit authoritative headers).
3. **Explicit S5-A Recovery State Discriminator:** Replacing loose heuristic checks (`hasSession && user === null && error`) with a formal state machine discriminator (`revalidationStatus === 'transient_failure'`) to cleanly isolate cold-reload network errors from ordinary form login failures.
4. **Mandatory Target-Token Ownership:** Elevating token passing from an optional parameter to a strict, non-optional signature `authApi.logout(targetToken: string)` that rejects empty tokens, eliminates ambient storage fallbacks, and binds retries to the initiating session.

All four owner decisions approved on 2026-11-06 remain binding and unaltered:
- **Decision A (`S0`):** Only `S0 → S1` is permitted; guest access cannot trigger isolated personas or Developer return.
- **Decision B (`S8`):** Real platform users in S8 cannot reactivate or elevate using old Developer snapshots.
- **Decision C (`SUP-01`):** `S8 → S7` clears real user credentials, preserves Developer origin snapshot inert in per-tab `sessionStorage` until tab closure, and suppresses all return controls.
- **Decision E (Transactional Abort — Option 1):** If archive creation or verification fails, abort logout immediately without clearing local state or active origin, remain in `S8`, and permit retry.

Neither Force Logout nor Quarantine & Evict is introduced.

---

## 2. Granular HTTP 401 / 403 / 404 Semantics & Evidence Boundaries

In earlier drafts, HTTP 401, 403, and 404 were loosely grouped together as "session invalidation" triggers. Version 2.0 establishes rigorous, source-grounded distinctions:

```
                      ┌─────────────────────────────────────────┐
                      │    HTTP Error Received from Backend     │
                      └────────────────────┬────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
   HTTP Status 401                   HTTP Status 403                   HTTP Status 404
(Unauthorized / Auth Fault)        (Forbidden / Access Denied)       (Not Found / Missing Resource)
         │                                 │                                 │
┌────────┴────────┐               ┌────────┴────────┐               ┌────────┴────────┐
│ Authoritative   │ Gateway /     │ Valid Session,  │ Account       │ Authoritative   │ Proxy / Route /
│ Auth Service    │ Proxy WAF     │ Insufficient    │ Suspended     │ Session Deleted │ HTML 404 Page
│ Invalid Code    │ Error         │ Permission      │ Auth Code     │ Auth Code       │ Error
└────────┬────────┘ ──────┬───────┘ ───────┬────────┘ ──────┬───────┘ ───────┬────────┘ ──────┬───────┘
         │                │                │                │                │                │
         ▼                ▼                ▼                ▼                ▼                ▼
   Clear Session    Treat as         DO NOT CLEAR!    Clear Session    Clear Session    Treat as
   State S7 Exit    UNKNOWN (S5-A)   Retain Session   State S7 Exit    State S7 Exit    UNKNOWN (S5-A)
```

### 2.1 HTTP 401 (Unauthorized / Authentication Failure)
- **Source Diagnostic:** In [`frontend/src/core/api/apiClient.ts#L275-L319`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/api/apiClient.ts#L275-L319), HTTP 401 throws `ApiError` with a localized message. In [`frontend/src/core/auth/AuthContext.tsx#L479-L486`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx#L479-L486), 401 clears local storage and sets `user = null`.
- **Evidence Threshold for `TOKEN_CONFIRMED_INVALID`:**
  A 401 response can ONLY be classified as `TOKEN_CONFIRMED_INVALID` if:
  1. The response originates from the application authentication service (not an edge reverse proxy, API gateway basic-auth challenge, or CDN).
  2. The response body contains a deterministic machine-readable reason code: `{ error: 'UNAUTHORIZED', code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'SESSION_TERMINATED' }`.
- **Handling of Unverified / Gateway 401:** If a 401 lacks this machine code or is emitted as HTML/plain text by an edge gateway, it must be treated as **`UNKNOWN`**! Local credentials must NOT be purged; the session remains retained in `S5-A` or `S8-A` with a recoverable connection warning.

### 2.2 HTTP 403 (Forbidden / Access Denied)
- **Architectural Principle:** HTTP 403 indicates that the user **IS successfully authenticated**, but lacks authorization or permission to perform the requested operation or access the resource.
- **Rule for Local Credentials:** Receiving HTTP 403 on `/api/auth/me` or any application endpoint **MUST NOT automatically clear the local session**!
  - Wiping credentials on 403 would log out a valid trainee or lecturer simply because they attempted to navigate to an administrative page or perform an unauthorized action.
- **Exception (Explicit Account Suspension):** Only if the backend auth service explicitly responds with `{ code: 'ACCOUNT_SUSPENDED' | 'ACCOUNT_TERMINATED' }` may local credentials be purged. Otherwise, credentials are retained, React state preserves `user`, and the application renders an unauthorized warning or redirects to `/403`.

### 2.3 HTTP 404 (Not Found / Missing Resource)
- **Architectural Principle:** HTTP 404 indicates resource non-existence. In web applications, this frequently stems from:
  1. An invalid URL path or routing misconfiguration.
  2. An intermediate reverse proxy failing to route to the upstream auth service.
  3. Single-Page Application (SPA) static asset fallback serving `index.html`.
  4. Application-level session store indicating the specific session ID is not found.
- **Evidence Threshold:** A generic HTTP 404 (especially non-JSON or HTML 404) must **NEVER clear local credentials**. It represents an infrastructure or route failure, classified strictly as **`UNKNOWN`**.
- **Exception:** Only if the backend auth service returns JSON with `{ code: 'SESSION_NOT_FOUND', sessionId: '...' }` may the frontend conclude that the session has been terminated and purge local storage.

### 2.4 Summary of Local Handling Across HTTP Categories:

| Scenario | Response Characteristics | Resulting State | Local Storage Action | User State | Banner / UI Status |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Authoritative Token Invalidation** | HTTP 401 + `{ code: 'TOKEN_INVALID' }` | `S7` | `authStorage.clearSession()` | `user = null` | "انتهت صلاحية الجلسة" (Session Expired) |
| **Unverified / Gateway 401** | HTTP 401 (HTML or no machine code) | `S5-A` | Credentials Retained | `user = null` | `SessionRecoveryCard` active on `/login` |
| **Unauthorized Action (Standard 403)** | HTTP 403 (e.g. insufficient role) | `S8-A` or Active | Credentials Retained | `user` Preserved | Render `/403` or inline permission alert |
| **Account Suspended 403** | HTTP 403 + `{ code: 'ACCOUNT_SUSPENDED' }` | `S7` | `authStorage.clearSession()` | `user = null` | "تم تعليق الحساب" (Account Suspended) |
| **Ambiguous / Route 404** | HTTP 404 (HTML or generic route missing) | `S5-A` | Credentials Retained | `user = null` | `SessionRecoveryCard` active on `/login` |
| **Authoritative Session Not Found** | HTTP 404 + `{ code: 'SESSION_NOT_FOUND' }` | `S7` | `authStorage.clearSession()` | `user = null` | "الجلسة غير موجودة" (Session Terminated) |
| **Network / Transport Failure** | Fetch error / Timeout (15 000 ms) | `S5-A` | Credentials Retained | `user = null` | `SessionRecoveryCard` active on `/login` |

---

## 3. Unified Revocation Semantics for HTTP 200 and HTTP 204

In previous drafts, HTTP 200/204 alone was described as establishing `CONFIRMED_REVOKED`. Version 2.0 unifies the semantics to eliminate contradictions between status codes and response bodies:

### 3.1 Four Formal Revocation Response Classifications:
1. **`MOCK_SUCCESS_RESPONSE`:** The MSW mock handler ([`authHandlers.ts#L153`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/authHandlers.ts#L153)) returned its static HTTP 200 `{ success: true }`. Proves frontend state transition logic only; cannot prove server revocation.
2. **`AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT`:** A production backend response satisfying the formal Phase 12 contract:
   - Contains both the valid HTTP status code AND the agreed authoritative payload or headers.
3. **`CONFIRMED_REVOKED`:** The target session token is authoritatively invalidated across server and client. Achieved only when `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT` is processed.
4. **`UNKNOWN`:** Any response that fails to fulfill the contract (generic HTTP 200 without confirmation code, bare HTTP 204 without headers, HTTP 500, gateway errors, or network timeouts).

### 3.2 Resolving the HTTP 204 No Content Dilemma:
An HTTP 204 status code has **no response body** by HTTP specification (`Content-Length: 0`). Therefore, the client cannot parse a JSON confirmation code like `{ code: 'SESSION_REVOKED' }`.

To resolve this, the Phase 12 backend contract mandates one of two explicit mechanisms:
- **Primary Standard (Mandated for MetroLMS):** `POST /api/auth/logout` MUST return **HTTP 200 OK with JSON body**:
  ```json
  {
    "success": true,
    "code": "SESSION_REVOKED",
    "tokenHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "timestamp": 1793986800000
  }
  ```
- **Secondary Alternative (If HTTP 204 is deployed):** If the backend returns HTTP 204 No Content, it MUST supply an explicit authoritative revocation header:
  ```http
  HTTP/1.1 204 No Content
  X-Auth-Revocation-Status: CONFIRMED_REVOKED
  X-Auth-Revoked-Token-Hash: e3b0c44298fc1c14...
  ```
*Rule:* A bare HTTP 200 without the confirmation code, or a bare HTTP 204 without the `X-Auth-Revocation-Status` header, must be classified as **`UNKNOWN`**!

---

## 4. Explicit S5-A Recovery State Discriminator

### 4.1 Defect in Heuristic Check (`hasSession && user === null && error`)
Version 1.9 suggested showing the `SessionRecoveryCard` when `authStorage.hasSession() === true && user === null && error !== null`.
- **The Defect:** If a user with a stored session navigates to `/login` and enters invalid credentials into the form, `login()` fails. `login()` sets `error = 'بيانات الاعتماد غير صحيحة'` while `user === null` and `hasSession() === true`.
- Under the loose heuristic check, the login error would incorrectly trigger the `SessionRecoveryCard`, confusing an ordinary login failure with a transient network recovery condition!

### 4.2 Dedicated State Discriminator Specification
Version 2.0 defines a dedicated, unambiguous state discriminator in [`frontend/src/core/auth/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/types.ts) and [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx):

```typescript
export type RevalidationStatus =
  | 'idle'                // Normal authenticated operation, or unauthenticated with no session
  | 'revalidating'        // Background or manual revalidation in progress
  | 'transient_failure'   // Transport failure / timeout during revalidation (State S5 / S5-A)
  | 'invalid_token'       // Authoritative 401 received; credentials purged (State S7)
  | 'login_failed';       // Form login failed; ordinary authentication error
```

### 4.3 Lifecycle Rules for `revalidationStatus`:
1. **Authoritative Display Condition:**
   `SessionRecoveryCard` renders on `/login` strictly when:
   ```typescript
   revalidationStatus === 'transient_failure' && authStorage.hasSession()
   ```
2. **Setting the Discriminator:** Set strictly inside the catch block of `revalidateSession()` when the error is a transport failure or ambiguous 500 (Section 5.G).
3. **Clearing on Form Login:** When the user submits the standard login form (`login()`), `revalidationStatus` is immediately reset to `'idle'`. If login fails, it transitions to `'login_failed'`. The `SessionRecoveryCard` unmounts immediately.
4. **Supersession by New Login:** `login()` calls `advanceSessionEpoch()`, writes the new user session, and clears `revalidationStatus`. Any stale in-flight revalidation is fenced out by `currentEpoch !== requestEpoch`.
5. **Non-Sensitive Information Displayed:** Displays high-level text:
   - "تعذر التحقق من اتصال جلستك السابقة (مشكلة في الشبكة)."
   - Optional cached role description: `authStorage.getUser()?.role` (e.g. "جلسة متدرب").
   - ZERO tokens, passwords, or cryptographic digests.
6. **Cached Metadata Invariant:** Cached identity or role text is explicitly labeled as historical and must NEVER be treated as proof of current authentication. React state `user` remains `null`, `isAuthenticated` remains `false`.
7. **Developer Return Controls:** Strictly suppressed. Gated behind `isIsolatedSession === true`, which requires `hasDeveloperOriginSession() === true`. In `S5-A`, active origin is `null`.

---

## 5. Mandatory Target-Token Ownership Model & Call Site Audit

### 5.1 Elimination of Unsafe Fallbacks
Version 1.9 proposed `authApi.logout(explicitToken?: string)`. An optional parameter creates an unsafe fallback where missing arguments default to reading `authStorage.getToken()`.

Version 2.0 strictly mandates **non-optional target token passing**:
```typescript
// frontend/src/core/auth/authApi.ts
async logout(targetToken: string): Promise<{ success: boolean; message: string }> {
  if (!targetToken || typeof targetToken !== 'string' || !targetToken.trim()) {
    throw new TypeError('authApi.logout rejected: targetToken must be a non-empty string.');
  }
  return apiClient<{ success: boolean; message: string }>('/api/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${targetToken.trim()}`,
    },
  });
}
```

### 5.2 Mandatory Token Ownership Principles:
1. **Zero Ambient Storage Fallback:** `authApi.logout()` must NEVER query `authStorage.getToken()`.
2. **Pre-Dispatch Validation:** Reject missing, empty, or whitespace-only tokens before network dispatch.
3. **Click-Time Binding:** In `AuthContext.tsx#logout()`, capture `targetToken` at the initiating operation boundary:
   ```typescript
   const targetToken = authStorage.getToken();
   if (!targetToken) {
     authStorage.clearSession();
     setUser(null);
     return;
   }
   ```
4. **Retry State Binding:** Any retry operation must hold an immutable reference to `boundTargetToken`.
5. **Newer Login Isolation:** If User B logs in while User A's retry is pending, `boundTargetToken` remains User A's token. User A's retry CANNOT read or transmit User B's token.
6. **Post-Response Commit Protection:** When the logout response arrives:
   ```typescript
   if (opId !== authOpSeqRef.current || targetToken !== authStorage.getToken()) {
     // Newer authentication has occurred; drop all state updates!
     return;
   }
   ```
7. **Backend Non-Interference:** Frontend sequence guards protect React state; server-side non-interference requires the Phase 12 token-scoped revocation contract.

### 5.3 Audit of All Call Sites in Codebase:

| Call Site File | Line | Current Signature | Required Signature Update | Status |
| :--- | :---: | :--- | :--- | :--- |
| [`frontend/src/core/auth/authApi.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authApi.ts#L29) | 29 | `logout(): Promise<...>` | `logout(targetToken: string): Promise<...>` | Planned `WP-5.4.5-R1` |
| [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx#L565) | 565 | `await authApi.logout().catch(...)` | `await authApi.logout(targetToken).catch(...)` | Planned `WP-5.4.5-R1` |
| [`frontend/src/test/role-preview.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/role-preview.test.tsx#L483) | 483 | `authApi.logout()` | `authApi.logout('MOCK_DEV_TOKEN')` | Deferred Phase 13 |
| [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx#L5644) | 5644+ | *(Proposed `SUP-01-T01`)* | Explicit `targetToken` verification across all 22 cases | Deferred Phase 13 |

---

## 6. Corrected 14-Scenario State, Failure & Concurrency Matrix

| # | Scenario Description | AuthContext User | Local Credentials | Server Status | What Is Actually Known | Auth / Reval Status | Available UI Action | Retry Eligible? | Active Origin Snapshot | Inert Archive Entry | Developer Return Controls? | Newer User Affected? |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | Logout HTTP 200 with authoritative confirmation code | `null` | Cleared (`S7`) | `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT` | Server explicitly revoked target token; confirmation code verified | `'idle'` | Standard Login Form | No (S7 Reached) | `null` | Preserved | Strictly Forbidden | No |
| **2** | Logout HTTP 200 without authoritative semantics | Active (`S8-A`) | Retained (`S8-A`) | `UNKNOWN` | Bare 200 received; token revocation unestablished by contract | `'transient_failure'` | Click "إعادة محاولة تسجيل الخروج" | Yes (Bound Token) | `null` | Preserved | Strictly Forbidden | No |
| **3** | Logout HTTP 204 with agreed revocation header | `null` | Cleared (`S7`) | `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT` | Header `X-Auth-Revocation-Status: CONFIRMED` verified | `'idle'` | Standard Login Form | No (S7 Reached) | `null` | Preserved | Strictly Forbidden | No |
| **4** | Logout HTTP 401 with authoritative invalid code | `null` | Cleared (`S7`) | `TOKEN_CONFIRMED_INVALID` | Auth service confirmed session already terminated/invalid | `'idle'` | Standard Login Form | No (S7 Reached) | `null` | Preserved | Strictly Forbidden | No |
| **5** | Logout HTTP 401 from unverified gateway (HTML/plain) | Active (`S8-A`) | Retained (`S8-A`) | `UNKNOWN` | Gateway rejected request; session state unestablished | `'transient_failure'` | Click "إعادة محاولة تسجيل الخروج" | Yes (Bound Token) | `null` | Preserved | Strictly Forbidden | No |
| **6** | Logout HTTP 403 due to insufficient permission | Active (`S8-A`) | Retained (`S8-A`) | `AUTHENTICATED_UNAUTHORIZED` | Session is valid; user lacks permission for endpoint; do NOT wipe! | `'idle'` | Display 403 Alert / Retry | Yes (Bound Token) | `null` | Preserved | Strictly Forbidden | No |
| **7** | Logout HTTP 404 without authoritative machine semantics | Active (`S8-A`) | Retained (`S8-A`) | `UNKNOWN` | Route missing or gateway 404; session termination unestablished | `'transient_failure'` | Click "إعادة محاولة تسجيل الخروج" | Yes (Bound Token) | `null` | Preserved | Strictly Forbidden | No |
| **8** | `/api/auth/me` HTTP 401 with authoritative invalid code | `null` | Cleared (`S7`) | `TOKEN_CONFIRMED_INVALID` | Auth service confirmed token invalid; causality unproven | `'invalid_token'` | Standard Login Form | No (S7 Reached) | `null` | Preserved | Strictly Forbidden | No |
| **9** | `/api/auth/me` HTTP 403 with authenticated session | Real User | Retained (`S8-A`) | `CONFIRMED_ACTIVE` | Session is valid on server; user lacks specific privilege | `'idle'` | Standard Dashboard | No (Active) | `null` | Preserved | Strictly Forbidden | No |
| **10** | `/api/auth/me` HTTP 404 with ambiguous route semantics | `null` | Retained (`S5-A`) | `UNKNOWN` | Gateway/route error; session valid in storage; do NOT wipe! | `'transient_failure'` | Click "إعادة محاولة الاتصال" | Yes (`retryRevalidation`) | `null` | Preserved | Strictly Forbidden | No |
| **11** | Ordinary login failure while pending session exists | `null` | Retained (`sessionStorage`) | Unaffected | Password incorrect; stored session untouched; recovery card suppressed | `'login_failed'` | Correct Password / Retry | N/A (Form Login) | `null` | Preserved | Strictly Forbidden | No |
| **12** | S5-A recovery retry triggered by user | `null` | Retained (`S5-A`) | Unknown | Revalidation in flight via bound stored token | `'revalidating'` | Loading Spinner Active | Yes (In Flight) | `null` | Preserved | Strictly Forbidden | No |
| **13** | New login superseding old recovery state | User B Active | User B Retained | User B Active | User B logged in; epoch advanced; old recovery unmounted | `'idle'` | Dashboard (User B) | No (User A Cleared) | `null` (B) | Preserved (A) | Strictly Forbidden | No |
| **14** | Old logout response arriving after newer login | User B Active | User B Retained | User A Revoked* | Stale commit dropped by `opId` / `sessionEpoch` fence | `'idle'` | Dashboard (User B) | No | `null` (B) | Preserved (A) | Strictly Forbidden | No (Protected by Token Binding & Phase 12)* |

*\*Marked classification is conditional upon the Phase 12 token-scoped backend contract.*

---

## 7. Supplemental Test Accounting & Updated 22-Point Coverage Matrix (`SUP-01-T01`)

### Strict Test Suite Accounting:
- **Physical Test Files in Repository:** Exactly **60 accepted core specifications** physically exist in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx).
- **Physical Test Modifications:** **ZERO test files created or modified.**
- **Supplemental Specification Design:** `SUP-01-T01` is a **proposed supplemental specification designed and documented in this report**.
- **Formal Lifecycle Status:**
  `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
- **Total Test Specification Count:**
  $$	ext{60 Frozen Core Accepted} + 	ext{1 Proposed Supplemental (SUP-01-T01)} = \mathbf{61	ext{ Total Planned Specifications}}$$

### The 22-Point Supplemental Test Coverage Matrix (`SUP-01-T01-01` through `SUP-01-T01-22`):
When implemented under authorized remediation package `WP-5.4.5-R1`, specification `SUP-01-T01` must execute the following 22 verification points:

1. **`SUP-01-T01-01` (Decision E Quota Failure):** Quota failure on archival aborts logout; server logout uncalled; local session in S8; active origin intact; server status unobserved.
2. **`SUP-01-T01-02` (Decision E Corruption Failure):** Read-back hash mismatch aborts logout; server logout uncalled; local session in S8; active origin intact.
3. **`SUP-01-T01-03` (Synchronous Phase 1 Archival):** Successful archival and active-origin clearing execute in the same synchronous JavaScript tick.
4. **`SUP-01-T01-04` (MSW Mock Success Handling):** MSW static HTTP 200 clears local credentials and transitions to S7 (`MOCK_SUCCESS_RESPONSE`).
5. **`SUP-01-T01-05` (Phase 12 Authoritative Confirmation Code):** HTTP 200 with `{ code: 'SESSION_REVOKED' }` acknowledged as `AUTHORITATIVE_REVOCATION_ACKNOWLEDGMENT`.
6. **`SUP-01-T01-06` (Bare HTTP 200 Rejection):** Generic HTTP 200 lacking confirmation code treated as `UNKNOWN`; local session retained in `S8-A`.
7. **`SUP-01-T01-07` (HTTP 204 Revocation Header Contract):** HTTP 204 with `X-Auth-Revocation-Status: CONFIRMED` transitions to `S7`.
8. **`SUP-01-T01-08` (Bare HTTP 204 Rejection):** HTTP 204 lacking revocation header treated as `UNKNOWN`; local session retained in `S8-A`.
9. **`SUP-01-T01-09` (HTTP 401 Authoritative Revocation):** Logout HTTP 401 with `{ code: 'SESSION_TERMINATED' }` transitions to `S7`.
10. **`SUP-01-T01-10` (HTTP 401 Unverified Gateway):** Logout HTTP 401 (HTML/plain) treated as `UNKNOWN`; local session retained in `S8-A`.
11. **`SUP-01-T01-11` (HTTP 403 Insufficient Permission):** HTTP 403 preserves local credentials; does NOT wipe session.
12. **`SUP-01-T01-12` (HTTP 404 Ambiguous Route):** HTTP 404 route error treated as `UNKNOWN`; local credentials preserved in `S5-A`.
13. **`SUP-01-T01-13` (S5-A Recovery Card Discriminator):** `SessionRecoveryCard` renders strictly when `revalidationStatus === 'transient_failure'`.
14. **`SUP-01-T01-14` (Form Login Error Isolation):** Form login error transitions to `'login_failed'`; `SessionRecoveryCard` remains suppressed.
15. **`SUP-01-T01-15` (Revalidation Recovery CONFIRMED_ACTIVE):** `/api/auth/me` returning HTTP 200 restores `S8-A` without restoring archived Developer snapshot.
16. **`SUP-01-T01-16` (Revalidation TOKEN_CONFIRMED_INVALID):** `/api/auth/me` returning HTTP 401 clears local credentials and transitions to `S7` without claiming logout causality.
17. **`SUP-01-T01-17` (Mandatory Target Token Parameter):** `authApi.logout('')` or `authApi.logout(null)` throws `TypeError` before network dispatch.
18. **`SUP-01-T01-18` (Zero Ambient Token Fallback):** Verified that `authApi.logout(targetToken)` transmits explicit token rather than reading ambient storage.
19. **`SUP-01-T01-19` (Newer User Token Isolation):** Logout retry targeting User A never reads or transmits User B's token.
20. **`SUP-01-T01-20` (User A / User B Concurrency Fence):** User A logout resolving after User B login drops frontend commit via `authOpSeqRef` / `sessionEpoch`.
21. **`SUP-01-T01-21` (Banner Suppression Invariant):** Developer preview banner and emergency return controls are strictly suppressed across `S8-A`, `S8-ERR`, and `S5-A`.
22. **`SUP-01-T01-22` (Multi-Cycle Archival Retention):** Multiple consecutive SUP-01 cycles retain distinct historical inert snapshots without overwriting or reactivating earlier entries.

---

## 8. Multi-Tier Evidence Boundary Partitioning

1. **Tier 1: Verified Current Frontend Source:**
   - Synchronous `sessionStorage` manipulation and verification in `authStorage.ts`.
   - Sequence counter `authOpSeqRef.current` and monotonic `sessionEpoch` in `AuthContext.tsx`.
   - `ProtectedRoute.tsx` redirecting to `/login` when `user === null`.
   - `LoginForm.tsx` rendering text error but lacking interactive retry controls.
   - `apiClient.ts` reading ambient storage tokens dynamically.
2. **Tier 2: Current MSW Mock-Only Behavior:**
   - `authHandlers.ts#L153`: Statically returns HTTP 200 `{ success: true }` without token inspection.
   - Mock behavior establishes frontend lifecycle execution only; it cannot prove production server semantics.
3. **Tier 3: Proposed Frontend Recovery Design (`WP-5.4.5-R1`):**
   - Two-phase atomic archival transaction `archiveDeveloperOriginSession()` in `authStorage.ts`.
   - Decision E pre-flight abort logic in `AuthContext.tsx#logout()`.
   - Dedicated `revalidationStatus` discriminator and `SessionRecoveryCard` in `LoginForm.tsx`.
   - Mandatory `targetToken: string` signature in `authApi.logout()`.
   - Proposed supplemental test specification `SUP-01-T01`.
4. **Tier 4: Required Phase 12 Production Backend Guarantees:**
   - Token-scoped revocation: `POST /api/auth/logout` revokes strictly the targeted bearer token.
   - Authoritative machine-readable response: `{ success: true, code: 'SESSION_REVOKED' }` or explicit revocation header.
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
- **Versions 1.1 through 1.9 preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 11. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED**

*(The frontend design for SUP-01 remediation is completely reconciled. Granular HTTP 401/403/404 semantics, unified revocation confirmation contracts, S5-A state discriminator revalidationStatus, and mandatory explicit target-token passing are fully specified with exact source code evidence. Production backend requirements are formally bounded and deferred to Phase 12. Remediation package WP-5.4.5-R1 is ready for explicit owner implementation authorization).*
