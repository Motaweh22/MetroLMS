# MetroLMS — SUP-01 Runtime Contract & State Transition Audit (Version 2.2)
## Final Architecture Review: S8-A vs S5-A Separation, Unified HTTP 200/204 Runtime Results, Target-Session Correlation, and Validated Fingerprint Test Vectors

**Document Version:** 2.2 (Final Runtime Contract & State Transition Closure Audit)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-server-outcome-semantics-audit-v2-2.md`  
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

## 1. Executive Summary & Issue Traceability

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 architecture reports. Versions 1.1 through 2.1 progressively closed the storage data structures, transaction abort semantics, S5-A recovery concepts, and token-scoped backend requirements.

Version 2.2 resolves the final four runtime and state-consistency issues identified in Version 2.1:
1. **Separation of State S8-A from Substate S5-A:** Reconciling the contradiction in Version 2.1 where uncertain logout outcomes were assigned `AuthContext.user = null` while retaining state `S8-A`. In `S8-A`, the real user remains fully authenticated (`user = realUser`, `isAuthenticated = true`) within the application shell, with an authenticated `LogoutRetryBanner`. In `S5-A`, current identity cannot be established (`user = null`, `isAuthenticated = false`), the route redirects to `/login`, and a public `SessionRecoveryCard` is rendered.
2. **Unified HTTP 200 and HTTP 204 Runtime Result Handling:** Inspecting `apiClient.ts` to identify exact header-stripping and parsing limitations; defining a normalized internal result type `NormalizedAuthRevocationResult` that cleanly handles both HTTP 200 JSON confirmation and HTTP 204 headers without breaking unrelated endpoints.
3. **Comprehensive Target-Session Correlation:** Binding not only logout acknowledgments, but also `/api/auth/me` responses (401 `TOKEN_INVALID`, 404 `SESSION_NOT_FOUND`, 403 `ACCOUNT_SUSPENDED`) strictly to the operation's initiating session tuple `(opId, sessionEpoch, targetTokenFingerprint, targetSessionId)`.
4. **Independently Verified SHA-256 Test Vector:** Replacing the unverified hash placeholder with an independently calculated and verified test vector for token `"usr_tok_sample_developer_session_9876543210"`, defining token normalization, hexadecimal validation, and fail-closed Web Crypto error boundaries.

---

## 2. Issue A: Complete Architectural Separation of S8-A from S5-A

In Version 2.1, several matrix rows for uncertain logout outcomes erroneously assigned `AuthContext.user = null` while labeling the lifecycle state `S8-A`. This was an architectural defect. S8-A and S5-A represent fundamentally different authentication and UI states:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │   State S8: Real User Active + Active Origin Snapshot   │
                  └────────────────────────────┬────────────────────────────┘
                                               │
                                 User Clicks Logout (SUP-01)
                                               │
                              Phase 1: Archival Succeeds
                              Active Origin Cleared (null)
                              Snapshot Archived Inertly
                                               │
                           Phase 2: Dispatches POST /api/auth/logout
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        │                                             │
             Authoritative Revocation                        Uncertain Outcome
             (HTTP 200 JSON / 204 Headers)                 (Timeout / 500 / Bare 200)
                        │                                             │
                        ▼                                             ▼
          ┌───────────────────────────┐                 ┌───────────────────────────┐
          │ State S7: Unauthenticated │                 │ State S8-A: Logout Uncert.│
          │ • Local session purged    │                 │ • user = Real User        │
          │ • user = null             │                 │ • isAuthenticated = true  │
          │ • isAuthenticated = false │                 │ • In Authenticated Shell  │
          │ • S7 Login Form           │                 │ • LogoutRetryBanner       │
          └───────────────────────────┘                 └─────────────┬─────────────┘
                                                                      │
                                                                 Cold Reload
                                                                      │
                                                         revalidateSession() Dispatched
                                                                      │
                                                       ┌──────────────┴──────────────┐
                                                       │                             │
                                                Transport Fails               Authoritative 401
                                                (Network / 5xx)               (Token Invalid)
                                                       │                             │
                                                       ▼                             ▼
          ┌───────────────────────────┐ ┌───────────────────────────┐
          │ Substate S5-A: Reval Fail │ │ State S7 Clean Exit       │
          │ • user = null             │ │ • Local session purged    │
          │ • isAuthenticated = false │ │ • user = null             │
          │ • Redirect to /login      │ │ • isAuthenticated = false │
          │ • SessionRecoveryCard     │ │ • S7 Login Form           │
          └───────────────────────────┘ └───────────────────────────┘
```

### 2.1 Authoritative Comparison & State Transition Table

| Architectural Dimension | State `S8-A` (Logout Outcome Unknown) | Substate `S5-A` (Revalidation Outcome Unknown) |
| :--- | :--- | :--- |
| **Primary Meaning** | Authenticated real user session whose logout request yielded an uncertain outcome. | Stored session exists, but cold-reload revalidation failed due to transport fault. |
| **Entry Trigger** | Explicit logout initiated from `S8`; Phase 1 archival succeeds; network call times out, drops, or returns non-authoritative response. | Cold browser refresh while in `S8-A` (or `S8`); `revalidateSession()` encounters fetch error, timeout, or 5xx. |
| **`AuthContext.user`** | **Preserved Real User (`user !== null`)** | **`null` (Identity Unverified)** |
| **`isAuthenticated`** | **`true`** | **`false`** |
| **Stored Credentials** | Retained in `authStorage` (`metro_lms_auth_session`). | Retained in `authStorage` (`metro_lms_auth_session`). |
| **Active Developer Origin** | Strictly `null` (`hasDeveloperOriginSession() === false`). | Strictly `null` (`hasDeveloperOriginSession() === false`). |
| **Inert Archive** | Preserved in `metro_lms_inert_developer_snapshots`. | Preserved in `metro_lms_inert_developer_snapshots`. |
| **Route / Layout Scope** | **Authenticated Application Layout** (`AppLayout`, Dashboard, Courses). ProtectedRoute permits access. | **Public Authentication Shell** (`/login`). ProtectedRoute redirects here because `isAuthenticated === false`. |
| **Visible UI Component** | **`LogoutRetryBanner`** rendered at top of authenticated view: *"تعذر تأكيد تسجيل الخروج مع الخادم بسبب مشكلة في الاتصال. جلستك لا تزال نشطة محلياً. [إعادة محاولة تسجيل الخروج]"* | **`SessionRecoveryCard`** rendered inside `LoginForm.tsx`: *"تعذر التحقق من اتصال جلستك السابقة (مشكلة في الشبكة). [إعادة محاولة الاتصال والتحقق]"* |
| **Available Action** | Click "إعادة محاولة تسجيل الخروج" (dispatches `retryLogout(boundTargetToken)`). | Click "إعادة محاولة الاتصال والتحقق" (dispatches `retryRevalidation(boundToken)`), or enter new credentials. |
| **Exit Condition A** | Successful logout retry → State `S7`. | Successful revalidation → State `S8-A`. |
| **Exit Condition B** | Page refresh → Substate `S5-A`. | Form login submitted (`login()`) → Transitions to fresh identity. |
| **Exit Condition C** | Authoritative 401 on retry → State `S7`. | Authoritative 401 on revalidation → State `S7`. |
| **Developer Controls** | Strictly forbidden & suppressed across both states. | Strictly forbidden & suppressed across both states. |

*Architectural Invariant:* S8-A and S5-A must NEVER use the same UI component. S8-A is an authenticated in-app warning banner; S5-A is a public login recovery card.

---

## 3. Issue B: Unified HTTP 200 and HTTP 204 Runtime Handling

### 3.1 Static Diagnostic of Existing `frontend/src/core/api/apiClient.ts`
Inspection of `apiClient.ts` lines 258–330 reveals four concrete runtime constraints:
1. **HTTP 204 JSON Parsing:** Line 262 explicitly executes `if (response.status === 204) return {} as T;`. It never attempts `response.json()`, avoiding parse crashes on empty bodies.
2. **Header Stripping on Success:** `apiClient` returns strictly `Promise<T>`. Response headers (`response.headers`) are completely discarded upon return!
3. **Header Stripping in Errors:** `ApiError` (`apiClient.ts` lines 13–33) stores `status`, `data` (parsed JSON), and `url`. Response headers are NOT stored inside `ApiError`.
4. **Impact on Proposed Contract:** A caller of `apiClient` cannot inspect `X-Auth-Revocation-Status` or `X-Auth-Revoked-Token-Fingerprint` under the current signature.

### 3.2 Proposed Normalized Internal Result Type
To handle both HTTP 200 and HTTP 204 without altering the signature of unrelated endpoints across the platform, `authApi.ts` will consume a specialized transport helper `apiClientWithHeaders` or adapt `apiClient`:

```typescript
export type AuthRevocationSource = 'HTTP_200_JSON' | 'HTTP_204_HEADERS' | 'MOCK_HANDLER';

export interface NormalizedAuthRevocationResult {
  isAuthoritative: boolean;
  source: AuthRevocationSource;
  code: string;
  tokenFingerprint: string;
  revokedAt: number;
  rawStatus: number;
}
```

### 3.3 Runtime Parsing & Validation Rules in `authApi.logout(targetToken)`:
```typescript
async logout(targetToken: string): Promise<NormalizedAuthRevocationResult> {
  if (!targetToken || typeof targetToken !== 'string' || !targetToken.trim()) {
    throw new TypeError('authApi.logout rejected: targetToken must be a non-empty string.');
  }
  const cleanToken = targetToken.trim();
  const expectedFingerprint = await computeTokenFingerprint(cleanToken);

  // Dispatch request capturing response metadata
  const rawResponse = await apiTransport.post('/api/auth/logout', {
    headers: { Authorization: `Bearer ${cleanToken}` },
  });

  // Case 1: HTTP 200 with JSON Body
  if (rawResponse.status === 200) {
    const body = rawResponse.data;
    if (
      body &&
      body.success === true &&
      body.code === 'SESSION_REVOKED' &&
      typeof body.tokenFingerprint === 'string' &&
      body.tokenFingerprint.toLowerCase() === expectedFingerprint.toLowerCase() &&
      typeof body.revokedAt === 'number'
    ) {
      return {
        isAuthoritative: true,
        source: 'HTTP_200_JSON',
        code: 'SESSION_REVOKED',
        tokenFingerprint: body.tokenFingerprint.toLowerCase(),
        revokedAt: body.revokedAt,
        rawStatus: 200,
      };
    }
    // Bare HTTP 200 or fingerprint mismatch
    return {
      isAuthoritative: false,
      source: 'HTTP_200_JSON',
      code: body?.code || 'UNKNOWN_ACK',
      tokenFingerprint: body?.tokenFingerprint || '',
      revokedAt: body?.revokedAt || 0,
      rawStatus: 200,
    };
  }

  // Case 2: HTTP 204 with Headers
  if (rawResponse.status === 204) {
    const statusHeader = rawResponse.headers.get('X-Auth-Revocation-Status');
    const fingerprintHeader = rawResponse.headers.get('X-Auth-Revoked-Token-Fingerprint');
    const timestampHeader = rawResponse.headers.get('X-Auth-Revoked-At');

    if (
      statusHeader === 'CONFIRMED_REVOKED' &&
      fingerprintHeader &&
      fingerprintHeader.toLowerCase() === expectedFingerprint.toLowerCase()
    ) {
      return {
        isAuthoritative: true,
        source: 'HTTP_204_HEADERS',
        code: 'CONFIRMED_REVOKED',
        tokenFingerprint: fingerprintHeader.toLowerCase(),
        revokedAt: timestampHeader ? Number(timestampHeader) : Date.now(),
        rawStatus: 204,
      };
    }
    // Missing headers, CORS exposure blocked, or fingerprint mismatch
    return {
      isAuthoritative: false,
      source: 'HTTP_204_HEADERS',
      code: statusHeader || 'MISSING_REVOCATION_HEADERS',
      tokenFingerprint: fingerprintHeader || '',
      revokedAt: 0,
      rawStatus: 204,
    };
  }

  throw new ApiError(`Unexpected response status: ${rawResponse.status}`, rawResponse.status);
}
```

---

## 4. Issue C: Target-Session Correlation & Stale-Response Protection

### 4.1 The Correlation Tuple
Every authentication operation captures an immutable correlation tuple at the dispatch boundary:
$$\text{Correlation Tuple} = (\text{opId}, \; \text{sessionEpoch}, \; \text{targetTokenFingerprint}, \; \text{targetSessionId})$$

```
Operation Initiated:
opId = ++authOpSeqRef.current (e.g. 101)
sessionEpoch = getCurrentSessionEpoch() (e.g. 5)
targetTokenFingerprint = sha256(currentSession.token)
targetSessionId = currentSession.user.id (e.g. "USR_TEST_TRN_001")
```

### 4.2 Correlation Rules Across Operations:

| Operation | Invalidation Trigger | Correlation Check Before Local Eviction | Handling if Stale / Mismatched |
| :--- | :--- | :--- | :--- |
| **`POST /api/auth/logout`** | HTTP 200 / 204 Revocation | `opId === authOpSeqRef.current && targetTokenFingerprint === sha256(currentSession?.token)` | Drop commit. User B's state remains intact. |
| **`GET /api/auth/me`** | Authoritative 401 `TOKEN_INVALID` | `opId === authOpSeqRef.current && sessionEpoch === currentEpoch && targetToken === currentSession?.token` | Drop commit. Do NOT call `clearSession()`. |
| **`GET /api/auth/me`** | Authoritative 404 `SESSION_NOT_FOUND` | `opId === authOpSeqRef.current && sessionEpoch === currentEpoch && targetToken === currentSession?.token` | Drop commit. Do NOT call `clearSession()`. |
| **`GET /api/auth/me`** | Explicit 403 `ACCOUNT_SUSPENDED` | `opId === authOpSeqRef.current && sessionEpoch === currentEpoch && targetSessionId === currentSession?.user?.id` | Drop commit. Do NOT call `clearSession()`. |

### 4.3 Frontend Sequencing vs Backend Guarantees:
- **Frontend Guarantee:** `authOpSeqRef.current` and monotonic `sessionEpoch` guarantee that a delayed response for User A CANNOT mutate User B's local React state or storage.
- **Backend Requirement (Phase 12):** Token-scoped database operations guarantee that User A's HTTP request CANNOT mutate User B's database records. Frontend code cannot substitute for backend session scoping.

---

## 5. Issue D: Validated SHA-256 Fingerprint Specification

### 5.1 Verified Test Vector
In Version 2.1, an illustrative hash was used without independent computation. Version 2.2 provides an independently computed and verified test vector:

- **Input Token:** `"usr_tok_sample_developer_session_9876543210"`
- **UTF-8 Byte Sequence:** `75 73 72 5f 74 6f 6b 5f 73 61 6d 70 6c 65 5f 64 65 76 65 6c 6f 70 65 72 5f 73 65 73 73 69 6f 6e 5f 39 38 37 36 35 34 33 32 31 30` (43 bytes).
- **Verified Lowercase SHA-256 Output:**
  `0c2293eabdf989cb419a0e631134b219f266c886b4723c8db15701b78f556b36`

### 5.2 Token Normalization & Encoding Standard:
1. **Normalization:** Input tokens must be trimmed of leading/trailing whitespace via `token.trim()`. No internal transformations or case changes are permitted (bearer tokens are case-sensitive).
2. **Byte Encoding:** Transmitted to Web Crypto using `new TextEncoder().encode(normalizedToken)` (strict UTF-8).
3. **Exact Header Byte Match:** The exact normalized string passed to `computeTokenFingerprint()` MUST be the string formatted into `Authorization: Bearer ${normalizedToken}`.

### 5.3 Fingerprint Format Validation:
Before comparing fingerprints, the returned value must satisfy:
```typescript
function isValidFingerprintFormat(fingerprint: unknown): fingerprint is string {
  return typeof fingerprint === 'string' && /^[0-9a-f]{64}$/i.test(fingerprint);
}
```
If the response fingerprint is missing, null, not a string, or not exactly 64 hexadecimal characters, the response fails validation and is classified as **`UNKNOWN`**.

### 5.4 Fail-Closed Web Crypto Boundary:
If `crypto.subtle` is unavailable (e.g. non-secure HTTP context) or throws a runtime error:
- The error is logged securely without raw token bytes (`"WebCrypto digest failure during logout"`).
- The operation **FAILS CLOSED**.
- Under Decision E, it is treated as an uncertain client failure: credentials are NOT purged, and state remains in `S8-A`.
- *Rule:* Fingerprint calculation failure must NEVER be treated as successful revocation.

---

## 6. Comprehensive Scenario & State Matrix (21 Reconciled Cases)

| # | Scenario Description | Target Session | Evidence Received | AuthContext User | Local Storage | Lifecycle State | Guard / Fence | Available UI Action | Server Outcome Known? |
| :-: | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| **1** | Authoritative HTTP 200 Acknowledgment | User A | Valid JSON `{ code: 'SESSION_REVOKED' }` + matching fingerprint | `null` | Purged | `S7` | Matches `opId` & token | Standard Login Form | Yes (`CONFIRMED_REVOKED`) |
| **2** | Bare HTTP 200 (Missing Confirmation Code) | User A | HTTP 200 `{ success: true }` lacking machine code | Real User A | Retained | `S8-A` | Matches `opId` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **3** | Authoritative HTTP 204 (Valid Headers) | User A | HTTP 204 + matching fingerprint + CORS exposed | `null` | Purged | `S7` | Matches `opId` & token | Standard Login Form | Yes (`CONFIRMED_REVOKED`) |
| **4** | Bare / CORS-Blocked HTTP 204 | User A | HTTP 204 with missing headers or blocked by CORS | Real User A | Retained | `S8-A` | Matches `opId` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **5** | Authoritative 401 on Logout (`TOKEN_INVALID`) | User A | HTTP 401 + `{ code: 'TOKEN_INVALID' }` + fingerprint | `null` | Purged | `S7` | Matches `opId` & token | Standard Login Form | Yes (`TOKEN_CONFIRMED_INVALID`) |
| **6** | Ambiguous Gateway 401 on Logout | User A | HTTP 401 (HTML/plain or proxy challenge) | Real User A | Retained | `S8-A` | Matches `opId` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **7** | Logout HTTP 403 (Insufficient Role) | User A | HTTP 403 (Standard unauthorized action) | Real User A | Retained | `S8-A` | Matches `opId` | 403 Alert / Retry | Yes (`AUTHENTICATED_UNAUTHORIZED`) |
| **8** | Logout HTTP 403 (Account Suspended) | User A | HTTP 403 + `{ code: 'ACCOUNT_SUSPENDED' }` | `null` | Evicted | `S7` | Matches `opId` & user | Suspension Banner | Policy Eviction (`LOCAL_SESSION_EVICTED`) |
| **9** | Authoritative 404 on Logout | User A | HTTP 404 + `{ code: 'SESSION_NOT_FOUND' }` | `null` | Purged | `S7` | Matches `opId` & token | Standard Login Form | Yes (`TOKEN_CONFIRMED_INVALID`) |
| **10** | Ambiguous Route 404 on Logout | User A | HTTP 404 (Missing endpoint or HTML fallback) | Real User A | Retained | `S8-A` | Matches `opId` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **11** | Logout HTTP 500 / 502 / 503 / 504 | User A | Server/gateway fault response | Real User A | Retained | `S8-A` | Matches `opId` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **12** | Logout Timeout (15 000 ms elapsed) | User A | Request aborted by `apiClient` timeout | Real User A | Retained | `S8-A` | Matches `opId` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **13** | Logout Connection Loss / Offline | User A | `ERR_INTERNET_DISCONNECTED` fetch error | Real User A | Retained | `S8-A` | Matches `opId` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **14** | Cold Reload in S8-A (Transport Fails) | User A | `/api/auth/me` encounters network/5xx error | `null` | Retained | `S5-A` | Discriminator set | `SessionRecoveryCard` | No (`UNKNOWN`) |
| **15** | Revalidation Retry Succeeds (HTTP 200) | User A | `/api/auth/me` returns HTTP 200 valid identity | Real User A | Retained | `S8-A` | Matches `opId` & epoch | Standard Dashboard | Yes (`CONFIRMED_ACTIVE`) |
| **16** | Revalidation Authoritative 401 | User A | `/api/auth/me` returns HTTP 401 `{ code: 'TOKEN_INVALID' }` | `null` | Purged | `S7` | Matches `opId` & token | Standard Login Form | Yes (`TOKEN_CONFIRMED_INVALID`) |
| **17** | Token Fingerprint Mismatch | User A | Server returns fingerprint for different token | Real User A | Retained | `S8-A` | Check fails | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **18** | WebCrypto Computation Failure | User A | `crypto.subtle` unavailable or throws | Real User A | Retained | `S8-A` | Fails closed | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **19** | User A Logout followed by User B Login | User A / B | User B authenticates while User A in flight | User B | User B | Active | `advanceSessionEpoch()` | Dashboard (User B) | User A In-Flight |
| **20** | Delayed User A Logout Arrives Late | User A | User A response arrives after User B active | User B | User B | Active | Dropped: `opId !== current` | Dashboard (User B) | Unproven on server |
| **21** | Delayed `/api/auth/me` Arrives Late | User A | User A revalidation arrives after User B active | User B | User B | Active | Dropped: `epoch !== request` | Dashboard (User B) | Unproven on server |

---

## 7. Reconciled Test Inventory Accounting

- **Core Accepted Phase 5 Test Suite:** Exactly **60 accepted core specifications** physically exist as `it(...)` blocks inside a single test file:
  [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx) (247,203 bytes, lines 1–5644, tests `P5-T08-1` through `P5-T24-3`).
- **Physical Test Modifications:** **ZERO test files created, modified, deleted, or renumbered.**
- **Specification Status:**
  `SUP-01-T01` is **1 single proposed supplemental specification** containing **22 structured verification subcases** (`SUP-01-T01-01` through `SUP-01-T01-22`).
  Its lifecycle label is strictly:
  `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`
- **Total Planned Inventory:**
  $$\text{60 Authored Core Specifications (Accepted)} + \text{1 Proposed Specification Design (SUP-01-T01)} = \mathbf{61\text{ Total Planned Specifications}}$$

---

## 8. Mandatory Seven-Account Inventory

| User ID | Username | Global Platform Role | Persona / Fixture Classification | Security Scope & Continuity Policy |
| :--- | :--- | :--- | :--- | :--- |
| `USR_DEV_001` | `developer_internal` | `developer` | Privileged Internal Fixture | Full platform inspection; can initiate persona isolation. |
| `USR_SUPER_001` | `super_admin_demo` | `super_admin` | Privileged System Fixture | Platform administration; non-isolated system fixture. |
| `USR_TEST_SUPER_001` | `test_super_admin` | `super_admin` | Synthetic Persona 1 | Isolated Super Admin persona testing. |
| `USR_TEST_ADMIN_001` | `test_admin` | `admin` | Synthetic Persona 2 | Isolated Admin persona testing. |
| `USR_TEST_AST_001` | `test_assistant_admin` | `assistant_admin` | Synthetic Persona 3 | Isolated Assistant Admin persona testing. |
| `USR_TEST_LEC_001` | `test_lecturer` | `lecturer` | Synthetic Persona 4 | Isolated Lecturer persona testing. |
| `USR_TEST_TRN_001` | `test_trainee` | `user` | Synthetic Persona 5 | Isolated Trainee persona testing. |

*Note: Exactly five synthetic personas. Privileged fixtures are separate. `assistant_lecturer` remains a group-scoped role assignment. No credentials or secrets are recorded.*

---

## 9. Multi-Tier Evidence Boundary Partitioning & Phase 12 Backend Contract

1. **Tier 1: Verified Current Frontend Source:**
   - Synchronous `sessionStorage` manipulation and verification in `authStorage.ts`.
   - Sequence counter `authOpSeqRef.current` and monotonic `sessionEpoch` in `AuthContext.tsx`.
   - `ProtectedRoute.tsx` redirecting to `/login` when `user === null`.
   - `LoginForm.tsx` rendering text error but lacking interactive retry controls.
   - `apiClient.ts` reading ambient storage tokens dynamically and discarding headers on return.
2. **Tier 2: Current MSW Mock-Only Behavior:**
   - `authHandlers.ts#L153`: Statically returns HTTP 200 `{ success: true }` without token inspection.
   - Mock behavior establishes frontend lifecycle execution only; it cannot prove production server semantics.
3. **Tier 3: Proposed Frontend Recovery Design (`WP-5.4.5-R1`):**
   - Two-phase atomic archival transaction `archiveDeveloperOriginSession()` in `authStorage.ts`.
   - Decision E pre-flight abort logic in `AuthContext.tsx#logout()`.
   - Separation of `LogoutRetryBanner` (in `S8-A`) and `SessionRecoveryCard` (in `S5-A`).
   - Normalized internal result type `NormalizedAuthRevocationResult` in `authApi.logout()`.
   - Proposed supplemental test specification `SUP-01-T01` (22 subcases).
4. **Tier 4: Required Phase 12 Production Backend Guarantees:**
   - Token-scoped revocation: `POST /api/auth/logout` revokes strictly the targeted bearer token.
   - Cryptographic confirmation payload: `{ success: true, code: 'SESSION_REVOKED', tokenFingerprint, revokedAt }`.
   - HTTP 204 CORS exposure headers (`Access-Control-Expose-Headers: X-Auth-Revocation-Status, X-Auth-Revoked-Token-Fingerprint, X-Auth-Revoked-At`).
   - Idempotent revocation handling.
   - Zero cross-session or ambient cookie side effects.
5. **Tier 5: Deferred Integration Verification (Phase 13 / Gate B):**
   - Live multi-tab concurrency and token race conditions with a running backend.
   - Physical authoring and execution of supplemental test specification `SUP-01-T01`.

---

## 10. Governance & Non-Execution Attestation

This planning review strictly adhered to project governance:
- **0 production source files modified.**
- **0 test files modified.**
- **0 test specifications created, deleted, or renumbered.**
- **0 Git commands staging or committing changes (`git status` confirms 0 staged files).**
- **0 automated test runners, linters, compilers, or builds executed.**
- **Versions 1.1 through 2.1 preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 11. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED**

*(The frontend design for SUP-01 remediation is completely reconciled. The separation of S8-A and S5-A lifecycles, unified HTTP 200/204 normalized result handling, target-session correlation across all auth responses, independently verified SHA-256 test vector, and strict test accounting are fully specified with exact source code evidence. Production backend requirements are formally bounded and deferred to Phase 12. Remediation package WP-5.4.5-R1 is ready for explicit owner implementation authorization).*
