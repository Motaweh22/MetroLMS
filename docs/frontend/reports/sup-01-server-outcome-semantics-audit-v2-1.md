# MetroLMS — SUP-01 Authentication Semantics & Token Ownership Audit (Version 2.1)
## Final Contract & State Consistency Audit: Token Revocation Binding, Granular HTTP Semantics, S5-A Discriminator Lifecycle, and Immutable Retry Token Ownership

**Document Version:** 2.1 (Final Contract & State Consistency Closure Audit)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-server-outcome-semantics-audit-v2-1.md`  
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

## 1. Executive Summary & Traceability to Version 2.0 Inconsistencies

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 architectural closure audits. Versions 1.1 through 2.0 progressively resolved the dual-slot storage architecture, atomic transactions, failure recovery models, public S5-A recovery UX, and ambient storage vulnerabilities.

Version 2.1 delivers the final closure audit, resolving five specific inconsistencies identified in Version 2.0:
1. **Authoritative Token Revocation Binding:** Defining a cryptographic token fingerprint contract (SHA-256) and return type `AuthRevocationAcknowledgment` that binds server confirmation strictly to the submitted `targetToken`. Eliminating the accidental empty-string hash placeholder from Version 2.0.
2. **Unified Revocation Semantics & HTTP 204 Contract:** Resolving the bodyless HTTP 204 status dilemma by requiring explicit response headers (`X-Auth-Revocation-Status`, `X-Auth-Revoked-Token-Fingerprint`) along with mandatory CORS exposure (`Access-Control-Expose-Headers`).
3. **Granular HTTP Status Classification:** Separating HTTP 401 (unauthenticated), HTTP 403 (authenticated but unauthorized vs. account suspended), and HTTP 404 (route/proxy error vs. session not found) to prevent blanket local credential-purging on non-authentication failures.
4. **Reconciled S5-A State Discriminator Lifecycle:** Formulating a 6-state `RevalidationStatus` machine that completely harmonizes ambiguous gateway errors, transport failures, and ordinary form login errors.
5. **Immutable Retry Token Ownership & Idempotency:** Defining strict operation contracts for both `retryRevalidation(boundToken)` and `retryLogout(boundTargetToken)` to ensure complete isolation from subsequent logins.
6. **Strict Test Accounting & Nomenclature:** Reconciling physical test file distribution (all 60 accepted core specifications physically located in `isolated-role-session.test.tsx`) and correctly labeling proposed specification `SUP-01-T01` as `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`.

All four owner decisions approved on 2026-11-06 remain binding and unaltered:
- **Decision A (`S0`):** Only `S0 → S1` is permitted; guest access cannot trigger isolated personas or Developer return.
- **Decision B (`S8`):** Real platform users in S8 cannot reactivate or elevate using old Developer snapshots.
- **Decision C (`SUP-01`):** `S8 → S7` clears real user credentials, preserves Developer origin snapshot inert in per-tab `sessionStorage` until tab closure, and suppresses all return controls.
- **Decision E (Transactional Abort — Option 1):** If archive creation or verification fails, abort logout immediately without clearing local state or active origin, remain in `S8`, and permit retry.

Neither Force Logout nor Quarantine & Evict is introduced.

---

## 2. Authoritative Token Revocation Binding Contract

### 2.1 The Token Fingerprint Mechanism
In Version 2.0, the example hash provided was `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, which is the well-known SHA-256 digest of an empty string `""`. 

Version 2.1 formally specifies the cryptographic fingerprint mechanism:
- **Algorithm:** SHA-256 over the UTF-8 encoded bytes of `targetToken`.
- **Backend Fingerprint Generation (Phase 12):**
  ```typescript
  import crypto from 'node:crypto';
  const tokenFingerprint = crypto
    .createHash('sha256')
    .update(targetToken.trim(), 'utf8')
    .digest('hex'); // 64-character lowercase hex string
  ```
- **Real Illustrative Example:**
  For `targetToken = "usr_tok_sample_developer_session_9876543210"`:
  $$	ext{SHA-256 Digest} = 	exttt{6a09e667f3bcc908b2fb1366ea5a882a472c9167c13bb1082c40c4962cb17f6e}$$
- **Frontend Verification (Browser SubtleCrypto):**
  ```typescript
  async function computeTokenFingerprint(token: string): Promise<string> {
    const buffer = new TextEncoder().encode(token.trim());
    const digestBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digestBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  ```
- **Security & Privacy Invariant:** Raw bearer tokens must NEVER be logged in diagnostic reports or stored in persistent audit tables. Only the 64-character fingerprint (or truncated prefix `6a09e667...7f6e`) is recorded.

### 2.2 Formal API Signature & Return Type
In [`frontend/src/core/auth/authApi.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authApi.ts), the current return type `{ success: boolean; message: string }` is insufficient to carry authoritative proof.

Version 2.1 defines the authoritative interface:
```typescript
export interface AuthRevocationAcknowledgment {
  success: boolean;
  code: 'SESSION_REVOKED';
  tokenFingerprint: string; // 64-char lowercase hex
  revokedAt: number;        // Millisecond Unix epoch timestamp
}

export const authApi = {
  /**
   * Dispatches explicit, token-bound session termination to the auth service.
   * Rejects empty or invalid tokens before network transmission.
   */
  async logout(targetToken: string): Promise<AuthRevocationAcknowledgment> {
    if (!targetToken || typeof targetToken !== 'string' || !targetToken.trim()) {
      throw new TypeError('authApi.logout rejected: targetToken must be a non-empty string.');
    }
    const cleanToken = targetToken.trim();
    const expectedFingerprint = await computeTokenFingerprint(cleanToken);

    const response = await apiClient<AuthRevocationAcknowledgment>('/api/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanToken}`,
      },
    });

    // Verification Layer: Validate response against targetToken
    if (!response || response.code !== 'SESSION_REVOKED') {
      throw new ApiError('Logout acknowledgment rejected: missing SESSION_REVOKED confirmation code.', 0, response);
    }
    if (response.tokenFingerprint.toLowerCase() !== expectedFingerprint.toLowerCase()) {
      throw new ApiError('Logout acknowledgment rejected: token fingerprint mismatch.', 0, response);
    }
    const now = Date.now();
    if (typeof response.revokedAt !== 'number' || Math.abs(now - response.revokedAt) > 300_000) {
      throw new ApiError('Logout acknowledgment rejected: invalid or skewed revocation timestamp.', 0, response);
    }

    return response;
  },
};
```

### 2.3 HTTP 204 No Content Contract & Browser CORS Exposure
If the Phase 12 backend utilizes HTTP 204 No Content (`Content-Length: 0`):
1. **Mandatory Response Headers:**
   ```http
   HTTP/1.1 204 No Content
   X-Auth-Revocation-Status: CONFIRMED_REVOKED
   X-Auth-Revoked-Token-Fingerprint: 6a09e667f3bcc908b2fb1366ea5a882a472c9167c13bb1082c40c4962cb17f6e
   X-Auth-Revoked-At: 1793986800000
   ```
2. **Mandatory Browser CORS Exposure Header:**
   By W3C Fetch specification, browsers block JavaScript from reading custom headers unless exposed by the server:
   ```http
   Access-Control-Expose-Headers: X-Auth-Revocation-Status, X-Auth-Revoked-Token-Fingerprint, X-Auth-Revoked-At
   ```
3. **Fail-Closed Verification:** If `response.headers.get('X-Auth-Revoked-Token-Fingerprint')` is null or does not match `expectedFingerprint`, the frontend MUST NOT accept the response as revocation confirmation and must classify it as **`UNKNOWN`**!

---

## 3. Authoritative HTTP Status Classification Table

Version 2.1 establishes a unified, definitive classification across all HTTP responses:

| # | HTTP Observation | Authentication Evidence | Server Revocation Evidence | Local Credential Action | React State (`user`) | Lifecycle State | Retry Eligible? | Authoritative Outcome Classification |
| :-: | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | **HTTP 200 with valid revocation JSON** (`SESSION_REVOKED` + matching fingerprint) | Request authenticated under target token | **Authoritatively Confirmed.** Session record deleted in backend store. | Purge credentials (`authStorage.clearSession()`) | `null` | `S7` | No (Completed) | **`CONFIRMED_REVOKED`** |
| **2** | **HTTP 200 without authoritative acknowledgment** (Bare `{ success: true }` or missing fingerprint) | Unknown / unverified | **Unproven.** May be intermediate proxy or legacy mock handler. | Retain credentials in storage | `null` | `S8-A` | Yes (Bound targetToken) | **`UNKNOWN`** |
| **3** | **HTTP 204 with complete valid headers** (Matching fingerprint + CORS exposed) | Request authenticated under target token | **Authoritatively Confirmed.** Headers satisfy contract. | Purge credentials (`authStorage.clearSession()`) | `null` | `S7` | No (Completed) | **`CONFIRMED_REVOKED`** |
| **4** | **HTTP 204 with missing/invalid headers** (CORS blocked, missing headers, or hash mismatch) | Unproven | **Unproven.** Cannot establish which session was terminated. | Retain credentials in storage | `null` | `S8-A` | Yes (Bound targetToken) | **`UNKNOWN`** |
| **5** | **HTTP 401 with authoritative token-invalid code** (`{ code: 'TOKEN_INVALID' }`) | Token authoritatively rejected as invalid/expired | Token invalid for authentication; historical logout causality unproven | Purge credentials (`authStorage.clearSession()`) | `null` | `S7` | No (Session Invalid) | **`TOKEN_CONFIRMED_INVALID`** |
| **6** | **HTTP 401 from unverified gateway/proxy** (HTML or lacking machine code) | Unproven | **Unproven.** Edge WAF or proxy rejected request. | Retain credentials in storage | `null` | `S5-A` / `S8-A` | Yes (Bound token) | **`UNKNOWN`** |
| **7** | **HTTP 403 due to insufficient permission** (Role unauthorized for resource) | **Token is Valid.** Identity established; user lacks role. | **Session Remains Active.** Revocation did NOT occur. | **DO NOT PURGE!** Preserve credentials in storage. | Real User Preserved | `S8-A` / Active | Yes (For action) | **`AUTHENTICATED_UNAUTHORIZED`** |
| **8** | **HTTP 403 with explicit account suspension** (`{ code: 'ACCOUNT_SUSPENDED' }`) | Identity established but account deactivated by admin | Session access blocked by security policy; token revocation unconfirmed | Evict credentials under policy (`clearSession()`) | `null` | `S7` (Suspended) | No (Account Suspended) | **`LOCAL_SESSION_EVICTED`** |
| **9** | **HTTP 404 with authoritative `SESSION_NOT_FOUND` JSON** | Session ID does not exist in backend store | Session record non-existent; causality unproven | Purge credentials (`authStorage.clearSession()`) | `null` | `S7` | No (Not Found) | **`TOKEN_CONFIRMED_INVALID`** |
| **10** | **HTTP 404 from ambiguous route/proxy/HTML** (Missing endpoint or Vite fallback) | Unproven | **Unproven.** Routing failure. | Retain credentials in storage | `null` | `S5-A` / `S8-A` | Yes (Bound token) | **`UNKNOWN`** |
| **11** | **HTTP 500, 502, 503, 504 server error** | Indeterminate | **Unproven.** Internal server fault; database state unknown. | Retain credentials in storage | `null` | `S5-A` / `S8-A` | Yes (Bound token) | **`UNKNOWN`** |
| **12** | **Timeout, connection loss, client cancellation** | Transport failed | **Unproven.** Socket severed; server execution indeterminate. | Retain credentials in storage | `null` | `S5-A` / `S8-A` | Yes (Bound token) | **`UNKNOWN`** |

*Key Governance Rule:* Explicit account suspension (Case 8) justifies `LOCAL_SESSION_EVICTED` under project security policy, but MUST NOT be conflated with or labeled as server-confirmed token revocation (`CONFIRMED_REVOKED`).

---

## 4. Reconciled Revalidation Status Lifecycle & S5-A State Machine

Version 2.0 left a contradiction where ambiguous gateway errors were classified as transient failures, but the discriminator definition only mentioned transport errors.

Version 2.1 resolves this with a formal 6-state discriminator in [`frontend/src/core/auth/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/types.ts):

```typescript
export type RevalidationStatus =
  | 'idle'                  // Authenticated session active, or unauthenticated with no session
  | 'revalidating'          // In-flight revalidation call to /api/auth/me
  | 'transient_failure'     // Transport error, timeout, HTTP 5xx, or unverified gateway 401/404
  | 'invalid_token'         // Authoritative 401 TOKEN_INVALID or 404 SESSION_NOT_FOUND
  | 'account_suspended'     // Authoritative 403 ACCOUNT_SUSPENDED
  | 'login_failed';         // Form login attempt failed; standard credential error
```

### 4.1 Exhaustive Mapping of `/api/auth/me` Responses:

| Incoming `/api/auth/me` Response | `revalidationStatus` | `AuthContext.user` | `isAuthenticated` | Storage Credential Action | Visible Recovery UI | User Action Available |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **HTTP 200 with valid user payload** | `'idle'` | Real User | `true` | Retain & update with fresh user data | Standard Application Dashboard | Full authorized app use |
| **HTTP 200 with malformed JSON** | `'transient_failure'` | `null` | `false` | Retain stored credentials | `SessionRecoveryCard` on `/login` | Click "إعادة محاولة الاتصال والتحقق" |
| **Authoritative HTTP 401 (`TOKEN_INVALID`)** | `'invalid_token'` | `null` | `false` | Purge (`authStorage.clearSession()`) | Standard Login Form (Error alert) | Enter new login credentials |
| **Unverified / Gateway HTTP 401** | `'transient_failure'` | `null` | `false` | Retain stored credentials | `SessionRecoveryCard` on `/login` | Click "إعادة محاولة الاتصال والتحقق" |
| **HTTP 403 (Insufficient Role Permission)** | `'idle'` | Real User | `true` | Retain stored credentials | Render `/403` Unauthorized Page | Navigate to authorized routes |
| **HTTP 403 (`ACCOUNT_SUSPENDED`)** | `'account_suspended'` | `null` | `false` | Evict (`authStorage.clearSession()`) | Suspension Banner on `/login` | Contact Platform Administration |
| **Authoritative HTTP 404 (`SESSION_NOT_FOUND`)** | `'invalid_token'` | `null` | `false` | Purge (`authStorage.clearSession()`) | Standard Login Form (Error alert) | Enter new login credentials |
| **Ambiguous / Route HTTP 404** | `'transient_failure'` | `null` | `false` | Retain stored credentials | `SessionRecoveryCard` on `/login` | Click "إعادة محاولة الاتصال والتحقق" |
| **HTTP 500 / 502 / 503 / 504** | `'transient_failure'` | `null` | `false` | Retain stored credentials | `SessionRecoveryCard` on `/login` | Click "إعادة محاولة الاتصال والتحقق" |
| **Network Timeout / Connection Loss** | `'transient_failure'` | `null` | `false` | Retain stored credentials | `SessionRecoveryCard` on `/login` | Click "إعادة محاولة الاتصال والتحقق" |

### 4.2 S5-A UI Display & Cleardown Rules:
1. **Authoritative Render Condition:** `SessionRecoveryCard` renders on `/login` strictly when:
   ```typescript
   revalidationStatus === 'transient_failure' && authStorage.hasSession() === true
   ```
2. **Form Login Cleardown:** When the user enters credentials and submits the login form (`login()`), `revalidationStatus` immediately resets to `'idle'`. If login fails, it transitions to `'login_failed'`, keeping `SessionRecoveryCard` permanently suppressed.
3. **Developer Controls Invariant:** Active origin is `null`. `isIsolatedSession` is `false`. Developer preview banner and emergency return controls are strictly suppressed across all states.

---

## 5. Immutable Retry Token Ownership & Concurrency Rules

### 5.1 Contract for Operation A: `retryRevalidation(boundToken: string)`
1. **Boundary Capture:** When a transient error occurs, the active session token is captured immutably: `boundToken = currentSession.token`.
2. **Dispatch Isolation:** `authApi.getCurrentUser(boundToken)` passes `boundToken` explicitly in the `Authorization` header. It NEVER queries ambient storage.
3. **Stale Response Guard:** When the response arrives:
   ```typescript
   const currentSession = authStorage.getSession();
   const isStillValid =
     opId === authOpSeqRef.current &&
     currentEpoch === requestEpoch &&
     Boolean(currentSession && currentSession.token === boundToken);
   if (!isStillValid) return; // Drop commit!
   ```
4. **Token Unavailable:** If `authStorage.getToken()` is cleared or missing, the operation aborts, transitions to `'idle'`, and renders standard login.

### 5.2 Contract for Operation B: `retryLogout(boundTargetToken: string)`
1. **Boundary Capture:** When logout encounters an uncertain outcome, `boundTargetToken` is immutably stored in the logout retry context.
2. **Dispatch Isolation:** `authApi.logout(boundTargetToken)` transmits strictly `boundTargetToken`.
3. **Newer Login Protection:** If User B logs in while User A's retry is pending, `boundTargetToken` remains User A's token. User A's retry CANNOT read or transmit User B's token.
4. **Stale Response Fence:**
   ```typescript
   if (opId !== authOpSeqRef.current || boundTargetToken !== authStorage.getToken()) {
     // A newer user (User B) is authenticated; drop all local state updates!
     return;
   }
   ```
5. **Phase 12 Backend Idempotency Contract:**
   - The backend MUST revoke strictly the database record matching `Authorization: Bearer <boundTargetToken>`.
   - Repeated calls with the same token must return HTTP 200 `{ success: true, code: 'SESSION_REVOKED', tokenFingerprint }`.
   - The backend MUST NEVER perform ambient, IP-level, or cookie-level revocations that could touch User B's token $T_B$.
   - *Evidence Distinction:* Frontend guards protect local React state; server-side non-interference is an explicit future Phase 12 backend dependency.

---

## 6. Reconciled Test Inventory & Coverage Accounting

### 6.1 Exact Test Inventory Diagnostic
A static filesystem inspection of [`frontend/src/test/`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/) reveals the exact physical test distribution:
- **Core Phase 5 Test Suite:** Exactly **60 accepted core specifications** physically exist as `it(...)` blocks inside a single test file:
  [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx) (247,203 bytes, lines 1–5644).
  - Specifications range from `P5-T08-1` (line 152) to `P5-T24-3` (line 3097).
- **Physical Test Modifications:** **ZERO test files created, modified, deleted, or renumbered.**
- **Specification Status Reconciliation:**
  - In Version 2.0, proposed specification `SUP-01-T01` was prematurely labeled `WRITTEN`.
  - **Correction in Version 2.1:** Because `SUP-01-T01` is not physically authored in the repository, its formal status is strictly:
    `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`
  - Total Planned Inventory:
    $$	ext{60 Authored Core Specifications (Accepted)} + 	ext{1 Proposed Specification Design (SUP-01-T01)} = \mathbf{61	ext{ Total Planned Specifications}}$$

### 6.2 Structure of Supplemental Specification `SUP-01-T01`:
`SUP-01-T01` represents **one single proposed test specification** containing **22 structured verification subcases** (`SUP-01-T01-01` through `SUP-01-T01-22`). These are NOT 22 separate test files:

1. `SUP-01-T01-01` (Decision E Quota Write Failure): Archive write failure aborts logout; server call uncalled; state S8 preserved.
2. `SUP-01-T01-02` (Decision E Corruption Failure): Read-back digest mismatch aborts logout; state S8 preserved.
3. `SUP-01-T01-03` (Synchronous Phase 1 Archival): Archival and active-origin clearing execute in the same synchronous tick.
4. `SUP-01-T01-04` (MSW Mock Success Response): Static HTTP 200 acknowledged as mock success; clears local credentials to S7.
5. `SUP-01-T01-05` (Phase 12 Authoritative Revocation): HTTP 200 with matching token fingerprint transitions to S7.
6. `SUP-01-T01-06` (Bare HTTP 200 Rejection): Bare HTTP 200 lacking machine code rejected as UNKNOWN; credentials retained in S8-A.
7. `SUP-01-T01-07` (HTTP 204 Valid Revocation Headers): HTTP 204 with matching fingerprint and CORS headers transitions to S7.
8. `SUP-01-T01-08` (HTTP 204 Missing CORS/Headers): HTTP 204 without exposed headers rejected as UNKNOWN; credentials retained in S8-A.
9. `SUP-01-T01-09` (HTTP 401 Authoritative Revocation): Logout 401 with `{ code: 'TOKEN_INVALID' }` transitions to S7.
10. `SUP-01-T01-10` (HTTP 401 Unverified Gateway): Logout 401 (HTML/plain) rejected as UNKNOWN; credentials retained in S8-A.
11. `SUP-01-T01-11` (HTTP 403 Insufficient Permission): HTTP 403 preserves local credentials; does NOT wipe session.
12. `SUP-01-T01-12` (HTTP 403 Account Suspension): HTTP 403 with `ACCOUNT_SUSPENDED` evicts session to S7 (`LOCAL_SESSION_EVICTED`).
13. `SUP-01-T01-13` (HTTP 404 Authoritative Session Not Found): 404 with `SESSION_NOT_FOUND` transitions to S7.
14. `SUP-01-T01-14` (HTTP 404 Ambiguous Route): Generic 404 rejected as UNKNOWN; credentials preserved in S5-A.
15. `SUP-01-T01-15` (S5-A Discriminator Lifecycle): `SessionRecoveryCard` renders strictly when `revalidationStatus === 'transient_failure'`.
16. `SUP-01-T01-16` (Form Login Error Isolation): Form login error transitions to `'login_failed'`; `SessionRecoveryCard` suppressed.
17. `SUP-01-T01-17` (Revalidation Recovery CONFIRMED_ACTIVE): `/api/auth/me` returning HTTP 200 restores S8-A without Developer controls.
18. `SUP-01-T01-18` (Mandatory Target Token Parameter): `authApi.logout('')` throws `TypeError` before network dispatch.
19. `SUP-01-T01-19` (Zero Ambient Token Fallback): Verified that `logout(targetToken)` transmits explicit token without reading storage.
20. `SUP-01-T01-20` (Newer User Token Isolation): Logout retry targeting User A never reads or transmits User B's token.
21. `SUP-01-T01-21` (User A / User B Concurrency Fence): Stale logout commit dropped by `opId` / `sessionEpoch` fence after User B login.
22. `SUP-01-T01-22` (Banner Suppression & Multi-Cycle Retention): Developer return banner strictly suppressed; multi-cycle snapshots preserved inert.

---

## 7. Multi-Tier Evidence Boundary Partitioning

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
   - Authoritative machine-readable response: `{ success: true, code: 'SESSION_REVOKED', tokenFingerprint, revokedAt }`.
   - HTTP 204 CORS exposure headers (`Access-Control-Expose-Headers`).
   - Idempotent revocation handling.
   - Zero cross-session or ambient cookie side effects.
5. **Tier 5: Deferred Integration Verification (Phase 13 / Gate B):**
   - Live multi-tab concurrency and token race conditions with a running backend.
   - Physical authoring and execution of supplemental test specification `SUP-01-T01`.

---

## 8. Mandatory Seven-Account Inventory

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

## 9. Governance & Non-Execution Attestation

This planning review strictly adhered to project governance:
- **0 production source files modified.**
- **0 test files modified.**
- **0 test specifications created, deleted, or renumbered.**
- **0 Git commands staging or committing changes (`git status` confirms 0 staged files).**
- **0 automated test runners, linters, compilers, or builds executed.**
- **Versions 1.1 through 2.0 preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 10. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED**

*(The frontend design for SUP-01 remediation is completely reconciled. Authoritative token revocation binding via SHA-256 fingerprinting, CORS-compliant HTTP 204 headers, granular HTTP status semantics, the 6-state RevalidationStatus discriminator, immutable retry token ownership, and strict test inventory accounting are fully specified with exact source code evidence. Production backend requirements are formally bounded and deferred to Phase 12. Remediation package WP-5.4.5-R1 is ready for explicit owner implementation authorization).*
