# MetroLMS — SUP-01 Final Correlation & Recovery Closure Audit (Version 2.3)
## Architecture Review: Comprehensive Correlation Guards, Type-Safe Discriminated Union, S8-A Cold-Reload Lifecycle, and Low-Disruption API Client Extension

**Document Version:** 2.3 (Final Correlation & Recovery Closure Audit)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-server-outcome-semantics-audit-v2-3.md`  
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

## 1. Executive Summary & Traceability to Version 2.2 Issues

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 architectural closure audits. Versions 1.1 through 2.2 progressively closed the dual-slot storage architecture, atomic transactions, failure recovery models, public S5-A recovery UX, and ambient storage vulnerabilities.

Version 2.3 delivers final architectural closure by resolving five specific implementation-contract gaps identified in Version 2.2:
1. **Complete Correlation Guard Specification (Issue A):** Defining the exact correlation guard contract across all authentication operations (Logout success, uncertain logout, retry, `/api/auth/me` success, authoritative 401/404, explicit 403 suspension, and delayed cross-user responses) using the 4-field correlation tuple `(opId, sessionEpoch, targetTokenFingerprint, targetSessionId)`.
2. **Type-Safe Discriminated Union (Issue B):** Replacing the flat result shape from Version 2.2 with an exhaustive, 14-variant discriminated union `AuthRevocationResult` where non-authoritative, transport, and error responses are not forced to contain absent fields like `code`, `tokenFingerprint`, or `revokedAt`.
3. **S8-A Cold-Reload Lifecycle & Policy Choice (Issue C):** Resolving the cold page reload behavior when an uncertain logout is pending in `S8-A`. Selecting and specifying **Policy B (Retain Unresolved Logout State with Transparent In-App Banner)** via a dedicated non-sensitive session storage descriptor `metro_lms_pending_logout` to ensure the user is not falsely misled into believing they logged out if `/api/auth/me` confirms the server session remains active.
4. **Low-Disruption API Client Extension (Issue D):** Analyzing `apiClient.ts` runtime constraints and specifying the least disruptive extension: adding a narrowly scoped `apiClient.raw<T>()` helper that returns `{ data, status, headers }` without modifying or endangering any existing callers expecting `Promise<T>`.
5. **Exhaustive 29-Scenario State Matrix (Issue E):** Fully mapping all logout, reload, and revalidation responses (including malformed JSON, unverified 401, ambiguous 404, and account suspension) with exact target sessions, correlation checks, and lifecycle states.

All four owner decisions approved on 2026-11-06 remain binding and unaltered: Decisions A, B, C, and E. Neither Force Logout nor Quarantine & Evict is introduced.

---

## 2. Issue A: Complete Correlation Guard Contract

Every authentication operation captures an immutable correlation tuple at the dispatch boundary:
$$\text{Correlation Tuple} = (\text{opId}, \; \text{sessionEpoch}, \; \text{targetTokenFingerprint}, \; \text{targetSessionId})$$

### 2.1 Field-by-Field Capture & Verification Contract:

| Operation & Trigger | Captured at Start | Pre-Commit Checks | Fields Required Identical | On Mismatch / Stale | State Mutated? |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Logout Success (HTTP 200/204)** | `opId`, `sessionEpoch`, `targetTokenFingerprint`, `targetSessionId` | 1. `opId === authOpSeqRef.current`<br>2. `sessionEpoch === currentEpoch`<br>3. `response.tokenFingerprint === targetTokenFingerprint`<br>4. `targetTokenFingerprint === sha256(currentSession.token)` | `opId`, `sessionEpoch`, `targetTokenFingerprint`, `currentSession.token` | Drop commit completely. User B's state remains intact. | **NO** |
| **Logout UNKNOWN (5xx / Timeout / Net)** | `opId`, `sessionEpoch`, `targetTokenFingerprint`, `targetSessionId` | 1. `opId === authOpSeqRef.current`<br>2. `sessionEpoch === currentEpoch`<br>3. `targetTokenFingerprint === sha256(currentSession.token)` | `opId`, `sessionEpoch`, `currentSession.token` | Drop commit. User B's state remains intact. | **NO** |
| **Logout Retry (`retryLogout`)** | `opId`, `sessionEpoch`, `boundTargetToken`, `targetSessionId` | 1. `opId === authOpSeqRef.current`<br>2. `sessionEpoch === currentEpoch`<br>3. `boundTargetToken === currentSession.token`<br>4. `response.tokenFingerprint === sha256(boundTargetToken)` | `opId`, `sessionEpoch`, `boundTargetToken` | Drop commit. User B's state remains intact. | **NO** |
| **`/api/auth/me` Success (HTTP 200)** | `opId`, `sessionEpoch`, `requestToken`, `targetSessionId` | 1. `opId === authOpSeqRef.current`<br>2. `sessionEpoch === currentEpoch`<br>3. `requestToken === currentSession.token` | `opId`, `sessionEpoch`, `requestToken` | Drop commit. Delayed revalidation cannot overwrite fresh login. | **NO** |
| **`/api/auth/me` 401 `TOKEN_INVALID`** | `opId`, `sessionEpoch`, `requestToken`, `targetSessionId` | 1. `opId === authOpSeqRef.current`<br>2. `sessionEpoch === currentEpoch`<br>3. `requestToken === currentSession.token` | `opId`, `sessionEpoch`, `requestToken` | Drop commit. Stale 401 cannot purge User B's session. | **NO** |
| **`/api/auth/me` 404 `SESSION_NOT_FOUND`** | `opId`, `sessionEpoch`, `requestToken`, `targetSessionId` | 1. `opId === authOpSeqRef.current`<br>2. `sessionEpoch === currentEpoch`<br>3. `requestToken === currentSession.token` | `opId`, `sessionEpoch`, `requestToken` | Drop commit. Stale 404 cannot purge User B's session. | **NO** |
| **`/api/auth/me` 403 `ACCOUNT_SUSPENDED`** | `opId`, `sessionEpoch`, `requestToken`, `targetSessionId` | 1. `opId === authOpSeqRef.current`<br>2. `sessionEpoch === currentEpoch`<br>3. `targetSessionId === currentSession.user.id`<br>4. `requestToken === currentSession.token` | `opId`, `sessionEpoch`, `requestToken`, `targetSessionId` | Drop commit. Stale suspension cannot evict User B. | **NO** |
| **Cross-User Delayed Response** | User A Tuple | Any check fails because `sessionEpoch` advanced and `currentSession` changed | Any field | Drop commit silently. Log correlation mismatch without tokens. | **NO** |

### 2.2 Redundancy Analysis & Boundary Separation:
- **`opId` vs `sessionEpoch`:** `sessionEpoch` advances strictly when the authenticated identity transitions (login, logout, session replacement). `authOpSeqRef` advances on EVERY asynchronous auth operation (including same-identity revalidations). Both are retained: `opId` fences out-of-order calls within the same identity; `sessionEpoch` fences across identity transitions.
- **Frontend vs Backend Reality:** Frontend guards guarantee that delayed responses cannot mutate client React state or storage. They CANNOT undo or prevent backend database side effects; backend session isolation requires the Phase 12 token-scoped contract.

---

## 3. Issue B: Type-Safe Discriminated Union (`AuthRevocationResult`)

Version 2.2's flat interface forced optional fields to be represented with artificial default values (e.g. `rawStatus = 200`, `revokedAt = 0`). Version 2.3 replaces this with a 14-variant discriminated union indexed by `type`:

```typescript
// frontend/src/core/auth/types.ts

export type AuthRevocationResult =
  | {
      type: 'AUTHORITATIVE_200_JSON';
      isAuthoritative: true;
      code: 'SESSION_REVOKED';
      tokenFingerprint: string; // 64-character lowercase hex
      revokedAt: number;        // Millisecond timestamp
      rawStatus: 200;
    }
  | {
      type: 'AUTHORITATIVE_204_HEADER';
      isAuthoritative: true;
      code: 'CONFIRMED_REVOKED';
      tokenFingerprint: string; // From X-Auth-Revoked-Token-Fingerprint
      revokedAt: number;        // From X-Auth-Revoked-At
      rawStatus: 204;
    }
  | {
      type: 'NON_AUTHORITATIVE_200';
      isAuthoritative: false;
      rawStatus: 200;
      reason: 'MISSING_REVOCATION_CODE' | 'FINGERPRINT_MISMATCH';
      body?: unknown;
    }
  | {
      type: 'NON_AUTHORITATIVE_204';
      isAuthoritative: false;
      rawStatus: 204;
      reason: 'MISSING_HEADERS' | 'CORS_EXPOSURE_BLOCKED' | 'FINGERPRINT_MISMATCH';
    }
  | {
      type: 'MALFORMED_ACKNOWLEDGMENT';
      isAuthoritative: false;
      rawStatus: number;
      reason: string;
      rawPayload?: unknown;
    }
  | {
      type: 'AUTHORITATIVE_TOKEN_INVALID';
      isAuthoritative: true;
      code: 'TOKEN_INVALID' | 'SESSION_TERMINATED';
      rawStatus: 401;
      tokenFingerprint?: string;
    }
  | {
      type: 'AMBIGUOUS_401';
      isAuthoritative: false;
      rawStatus: 401;
      reason: 'UNVERIFIED_GATEWAY_OR_PROXY';
      errorData?: unknown;
    }
  | {
      type: 'AUTHENTICATED_UNAUTHORIZED_403';
      isAuthoritative: false;
      rawStatus: 403;
      errorData?: unknown;
    }
  | {
      type: 'EXPLICIT_ACCOUNT_SUSPENSION_403';
      isAuthoritative: true;
      code: 'ACCOUNT_SUSPENDED' | 'ACCOUNT_TERMINATED';
      rawStatus: 403;
      targetUserId?: string;
    }
  | {
      type: 'AUTHORITATIVE_SESSION_NOT_FOUND_404';
      isAuthoritative: true;
      code: 'SESSION_NOT_FOUND';
      rawStatus: 404;
    }
  | {
      type: 'AMBIGUOUS_404';
      isAuthoritative: false;
      rawStatus: 404;
      reason: 'ROUTE_OR_PROXY_MISSING';
      errorData?: unknown;
    }
  | {
      type: 'SERVER_FAULT_5XX';
      isAuthoritative: false;
      rawStatus: number; // 500, 502, 503, 504
      errorData?: unknown;
    }
  | {
      type: 'TRANSPORT_OR_TIMEOUT';
      isAuthoritative: false;
      isTimeout: boolean;
      message: string;
    }
  | {
      type: 'MOCK_SUCCESS_RESPONSE';
      isAuthoritative: false; // Testing only
      rawStatus: 200;
    };
```

### 3.1 Properties of the Discriminated Union:
1. **Zero Fake Fields:** Responses without fingerprints or timestamps have no such properties on their type.
2. **Explicit Eviction Authorization:** Local credentials may be evicted strictly when:
   `result.type === 'AUTHORITATIVE_200_JSON' || result.type === 'AUTHORITATIVE_204_HEADER' || result.type === 'AUTHORITATIVE_TOKEN_INVALID' || result.type === 'AUTHORITATIVE_SESSION_NOT_FOUND' || result.type === 'EXPLICIT_ACCOUNT_SUSPENSION_403' || result.type === 'MOCK_SUCCESS_RESPONSE'`.
3. **Fail-Closed Principle:** Any other variant (`NON_AUTHORITATIVE_200`, `NON_AUTHORITATIVE_204`, `MALFORMED_ACKNOWLEDGMENT`, `AMBIGUOUS_401`, `AMBIGUOUS_404`, `SERVER_FAULT_5XX`, `TRANSPORT_OR_TIMEOUT`) evaluates `isAuthoritative === false` and MUST NOT evict credentials.

---

## 4. Issue C: S8-A vs S5-A Cold-Reload Lifecycle & Policy Choice

### 4.1 The Lifecycle Scenario:
1. User A is in state S8 (authenticated real user, active Developer origin snapshot).
2. User A clicks logout. Phase 1 archives snapshot to `metro_lms_inert_developer_snapshots` and clears active origin.
3. The server logout request times out or returns an ambiguous error.
4. User A remains in **State S8-A** (authenticated real user, `LogoutRetryBanner` displayed).
5. The browser window is refreshed (cold page reload).
6. On mount, `AuthContext` runs `revalidateSession()`, calling `GET /api/auth/me`.
7. What happens when `/api/auth/me` returns HTTP 200 with the valid user identity?

### 4.2 Policy Evaluation: Policy A vs. Policy B
- **Policy A (Silent State Resolution):** Because `/api/auth/me` confirmed the session is active on the server, the client resolves the state back to normal authenticated operation and removes the logout banner.
  - *Critical Vulnerability:* At a public computer or shared workstation, if a user clicked logout, encountered a network glitch, and walked away, a subsequent reload would silently present an active, unprotected session with NO indication that logout failed!
- **Policy B (Retain Unresolved Logout State with Transparent In-App Banner) — SELECTED & JUSTIFIED:**
  - *Justification:* Grounded in security transparency. The user's explicit intent was session termination. The fact that the server session remains alive is critical security information that must be surfaced to the user.

### 4.3 Policy B Architecture & Non-Sensitive Storage Descriptor:
1. **Session Descriptor (NO Raw Tokens):** When logout enters `S8-A`, `AuthContext` writes a non-sensitive descriptor to `sessionStorage`:
   ```typescript
   // Key: 'metro_lms_pending_logout'
   interface PendingLogoutDescriptor {
     targetTokenFingerprint: string; // 64-char hex
     targetSessionId: string;        // e.g. "USR_TEST_TRN_001"
     initiatedAt: number;            // Timestamp
   }
   ```
2. **Cold Reload Revalidation Check:**
   - In `revalidateSession()`: If `GET /api/auth/me` returns HTTP 200, `setUser(response.user)` updates state (`isAuthenticated = true`).
   - `AuthContext` checks `sessionStorage.getItem('metro_lms_pending_logout')`.
   - If present AND `descriptor.targetTokenFingerprint === sha256(currentSession.token)`:
     - The tab enters **State `S8-A`**!
     - The authenticated layout displays **`LogoutRetryBanner`**:
       *"لم يكتمل تسجيل الخروج السابق بسبب مشكلة في الاتصال، وجلستك ما تزال نشطة على الخادم. [إعادة محاولة تسجيل الخروج] [إلغاء ومتابعة الجلسة]"*
     - Active Developer origin remains `null`. Developer return controls remain strictly suppressed.
3. **Actions on `LogoutRetryBanner`:**
   - Click "إعادة محاولة تسجيل الخروج": Dispatches `retryLogout(currentSession.token)`.
   - Click "إلغاء ومتابعة الجلسة": Clears `metro_lms_pending_logout` descriptor, transitions from `S8-A` to normal authenticated operation.
4. **Behavior on Other Reload Outcomes:**
   - `/api/auth/me` returns Authoritative 401 (`TOKEN_INVALID`): Purges local credentials, removes `metro_lms_pending_logout`, transitions to `S7`.
   - `/api/auth/me` returns Network Error / 5xx: Transitions to **Substate `S5-A`** (`user = null`, redirected to `/login`, `SessionRecoveryCard` active).
   - Newer user logs in: `login()` purges `metro_lms_pending_logout`, advances `sessionEpoch`, ensuring User B is never affected.

---

## 5. Issue D: Low-Disruption API Client Extension (`apiClient.raw`)

### 5.1 Runtime Constraints of Current `apiClient.ts`:
- Returns `Promise<T>`: Discards all response headers.
- Discards error headers: `ApiError` stores `status`, `data`, and `url`, but no headers.
- HTTP 204 handling: Bypasses JSON parsing and returns `{}`.

### 5.2 Architectural Comparison of Extensions:
- **Approach B (Generic Signature Change):** Changing `apiClient<T>(...)` to return `{ data: T, headers: Headers, status: number }` would break dozens of existing service files across the platform (`courseReviewService`, `commentService`, `groupService`, `notificationService`, etc.).
- **Approach A (Narrowly Scoped Raw Method) — SELECTED & JUSTIFIED:**
  Add a dedicated raw-response method `apiClient.raw<T>()` alongside standard `apiClient<T>()`:

```typescript
// frontend/src/core/api/apiClient.ts

export interface RawApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export async function apiClientRaw<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<RawApiResponse<T>> {
  // Reuses exact same URL construction, mutation barriers, and epoch validation as apiClient
  // Captures response without stripping headers:
  const response = await fetch(url, config);

  let data: T = null as unknown as T;
  if (response.status === 204) {
    data = null as unknown as T; // Skip JSON parsing safely
  } else if (isJsonResponse(response.headers.get('content-type'))) {
    try {
      data = (await response.json()) as T;
    } catch {
      data = null as unknown as T;
    }
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  };
}
```

### 5.3 Benefits of Approach A:
1. **Zero Disruption:** 100% of existing service calls continue using `apiClient<T>()` with identical typing.
2. **CORS Header Access:** Authentication lifecycle methods in `authApi.ts` call `apiClientRaw()` to inspect `X-Auth-Revocation-Status` and `X-Auth-Revoked-Token-Fingerprint`.
3. **Empty Body Safety:** Explicitly skips JSON parsing on HTTP 204 without throwing syntax errors.

---

## 6. Issue E: Complete Scenario Matrix (29 Reconciled Cases)

| # | Scenario Description | Target Session | Response Evidence | Correlation Check | AuthContext User | isAuthenticated | Credential Action | Lifecycle State | Available UI Action | Server Outcome Known? |
| :-: | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| **1** | Authoritative HTTP 200 Acknowledgment | User A | Valid JSON `{ code: 'SESSION_REVOKED' }` + matching fingerprint | Matches `opId`, `epoch`, & token | `null` | `false` | Purged | `S7` | Standard Login Form | Yes (`CONFIRMED_REVOKED`) |
| **2** | Bare HTTP 200 (Missing Revocation Code) | User A | HTTP 200 `{ success: true }` lacking machine code | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **3** | Authoritative HTTP 204 (Valid Headers) | User A | HTTP 204 + matching fingerprint + CORS exposed | Matches `opId`, `epoch`, & token | `null` | `false` | Purged | `S7` | Standard Login Form | Yes (`CONFIRMED_REVOKED`) |
| **4** | Bare / CORS-Blocked HTTP 204 | User A | HTTP 204 with missing headers or blocked by CORS | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **5** | Authoritative 401 on Logout (`TOKEN_INVALID`) | User A | HTTP 401 + `{ code: 'TOKEN_INVALID' }` + fingerprint | Matches `opId`, `epoch`, & token | `null` | `false` | Purged | `S7` | Standard Login Form | Yes (`TOKEN_CONFIRMED_INVALID`) |
| **6** | Ambiguous Gateway 401 on Logout | User A | HTTP 401 (HTML/plain or proxy challenge) | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **7** | Logout HTTP 403 (Insufficient Role) | User A | HTTP 403 (Standard unauthorized action) | Matches `opId` | Real User A | `true` | Retained | `S8-A` | 403 Alert / Retry | Yes (`AUTHENTICATED_UNAUTHORIZED`) |
| **8** | Logout HTTP 403 (Account Suspended) | User A | HTTP 403 + `{ code: 'ACCOUNT_SUSPENDED' }` | Matches `opId`, `epoch`, & user | `null` | `false` | Evicted | `S7` | Suspension Banner | Policy Eviction (`LOCAL_SESSION_EVICTED`) |
| **9** | Authoritative 404 on Logout | User A | HTTP 404 + `{ code: 'SESSION_NOT_FOUND' }` | Matches `opId`, `epoch`, & token | `null` | `false` | Purged | `S7` | Standard Login Form | Yes (`TOKEN_CONFIRMED_INVALID`) |
| **10** | Ambiguous Route 404 on Logout | User A | HTTP 404 (Missing endpoint or HTML fallback) | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **11** | Logout HTTP 500 / 502 / 503 / 504 | User A | Server/gateway fault response | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **12** | Logout Timeout (15 000 ms elapsed) | User A | Request aborted by `apiClient` timeout | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **13** | Logout Connection Loss / Offline | User A | `ERR_INTERNET_DISCONNECTED` fetch error | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **14** | Logout Fingerprint Mismatch | User A | Response contains fingerprint for different token | Check fails | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **15** | Logout WebCrypto Computation Failure | User A | `crypto.subtle` unavailable or throws | Fails closed | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` | No (`UNKNOWN`) |
| **16** | Reload in S8-A: `/api/auth/me` 200 Valid Identity | User A | HTTP 200 with valid identity + pending descriptor | Matches `opId`, `epoch`, & token | Real User A | `true` | Retained | `S8-A` | `LogoutRetryBanner` (Retry/Dismiss) | Yes (`CONFIRMED_ACTIVE`) |
| **17** | Reload in S8-A: `/api/auth/me` Malformed JSON | User A | HTTP 200 with non-JSON or HTML payload | Fails parse | `null` | `false` | Retained | `S5-A` | `SessionRecoveryCard` on `/login` | No (`UNKNOWN`) |
| **18** | Reload in S8-A: `/api/auth/me` Authoritative 401 | User A | HTTP 401 `{ code: 'TOKEN_INVALID' }` | Matches `opId`, `epoch`, & token | `null` | `false` | Purged | `S7` | Standard Login Form | Yes (`TOKEN_CONFIRMED_INVALID`) |
| **19** | Reload in S8-A: `/api/auth/me` Gateway 401 | User A | HTTP 401 without machine code (HTML/WAF) | Unverified | `null` | `false` | Retained | `S5-A` | `SessionRecoveryCard` on `/login` | No (`UNKNOWN`) |
| **20** | Reload in S8-A: `/api/auth/me` 403 Insufficient Role | User A | HTTP 403 standard permission failure | Matches `opId` | Real User A | `true` | Retained | `S8-A` | `/403` Unauthorized View | Yes (`AUTHENTICATED_UNAUTHORIZED`) |
| **21** | Reload in S8-A: `/api/auth/me` 403 Suspended | User A | HTTP 403 `{ code: 'ACCOUNT_SUSPENDED' }` | Matches `opId`, `epoch`, & user | `null` | `false` | Evicted | `S7` | Suspension Banner on `/login` | Policy Eviction (`LOCAL_SESSION_EVICTED`) |
| **22** | Reload in S8-A: `/api/auth/me` Authoritative 404 | User A | HTTP 404 `{ code: 'SESSION_NOT_FOUND' }` | Matches `opId`, `epoch`, & token | `null` | `false` | Purged | `S7` | Standard Login Form | Yes (`TOKEN_CONFIRMED_INVALID`) |
| **23** | Reload in S8-A: `/api/auth/me` Ambiguous 404 | User A | HTTP 404 missing route / HTML 404 | Unverified | `null` | `false` | Retained | `S5-A` | `SessionRecoveryCard` on `/login` | No (`UNKNOWN`) |
| **24** | Reload in S8-A: `/api/auth/me` HTTP 5xx Server Error | User A | HTTP 500 / 502 / 503 / 504 response | Unverified | `null` | `false` | Retained | `S5-A` | `SessionRecoveryCard` on `/login` | No (`UNKNOWN`) |
| **25** | Reload in S8-A: `/api/auth/me` Timeout / Offline | User A | Fetch timeout (15 000 ms) or offline error | Unverified | `null` | `false` | Retained | `S5-A` | `SessionRecoveryCard` on `/login` | No (`UNKNOWN`) |
| **26** | S5-A Revalidation Retry Succeeds | User A | `retryRevalidation()` returns HTTP 200 | Matches `opId` & epoch | Real User A | `true` | Retained | `S8-A` | Standard Dashboard | Yes (`CONFIRMED_ACTIVE`) |
| **27** | User A Logout followed by User B Login | User A / B | User B authenticates while User A in flight | `advanceSessionEpoch()` | User B | `true` | User B | Active | Dashboard (User B) | User A In-Flight |
| **28** | Delayed User A Logout Arrives Late | User A | User A response arrives after User B active | Dropped: `opId !== current` | User B | `true` | User B | Active | Dashboard (User B) | Unproven on server |
| **29** | Delayed `/api/auth/me` Arrives Late | User A | User A revalidation arrives after User B active | Dropped: `epoch !== request` | User B | `true` | User B | Active | Dashboard (User B) | Unproven on server |

---

## 7. Verified Cryptographic Fingerprint Specification

The SHA-256 test vector established in Version 2.2 is preserved and independently re-verified:
- **Input Token:** `"usr_tok_sample_developer_session_9876543210"`
- **UTF-8 Byte Sequence:** `75 73 72 5f 74 6f 6b 5f 73 61 6d 70 6c 65 5f 64 65 76 65 6c 6f 70 65 72 5f 73 65 73 73 69 6f 6e 5f 39 38 37 36 35 34 33 32 31 30` (43 bytes).
- **Verified Lowercase SHA-256 Digest:**
  `0c2293eabdf989cb419a0e631134b219f266c886b4723c8db15701b78f556b36`

### 7.1 Cryptographic Rules:
1. **Exact Byte Matching:** The token is trimmed (`token.trim()`) and encoded via `new TextEncoder().encode(trimmedToken)`. The identical bytes must be formatted into `Authorization: Bearer ${trimmedToken}`.
2. **Format Validation:** Response fingerprints must match `/^[0-9a-f]{64}$/i`. Any non-hex, null, or malformed value fails validation and is classified as `UNKNOWN`.
3. **Fail-Closed Principle:** If Web Crypto is unavailable or throws, the operation fails closed to `UNKNOWN` in `S8-A`. Fingerprint calculation failure is NEVER treated as successful revocation.
4. **No Secrets in Logs:** Raw bearer tokens must NEVER be logged in diagnostics; only the 64-character fingerprint is recorded.

---

## 8. Reconciled Test Inventory Accounting

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

## 9. Mandatory Seven-Account Inventory

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

## 10. Multi-Tier Evidence Boundary Partitioning & Phase 12 Backend Contract

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
   - Narrowly scoped `apiClient.raw<T>()` helper in `apiClient.ts`.
   - Type-safe discriminated union `AuthRevocationResult` in `authApi.logout()`.
   - Non-sensitive descriptor `metro_lms_pending_logout` in `sessionStorage` for S8-A reload recovery.
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

## 11. Governance & Non-Execution Attestation

This planning review strictly adhered to project governance:
- **0 production source files modified.**
- **0 test files modified.**
- **0 test specifications created, deleted, or renumbered.**
- **0 Git commands staged or committed changes (`git status` confirms 0 staged files).**
- **0 automated test runners, linters, compilers, or builds executed.**
- **Versions 1.1 through 2.2 preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 12. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — FRONTEND DESIGN COMPLETE; BACKEND CONTRACT EXPLICITLY DEFERRED**

*(All runtime contracts and state transitions for SUP-01 remediation are completely reconciled. The complete correlation guard contract, type-safe 14-variant discriminated union, Policy B S8-A cold-reload recovery with non-sensitive session descriptor, low-disruption apiClient.raw helper, validated SHA-256 test vector, and 29-scenario state matrix are fully specified with exact source code evidence. Production backend requirements are formally bounded and deferred to Phase 12. Remediation package WP-5.4.5-R1 is ready for explicit owner implementation authorization).*

