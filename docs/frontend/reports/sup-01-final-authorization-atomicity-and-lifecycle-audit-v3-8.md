# MetroLMS — SUP-01 Final Authorization, Atomicity & Lifecycle Consistency Audit (Version 3.8)
## Architecture Audit: S-48B Post-Revocation Abort Disambiguation (409 vs. 401), Q-Event vs. U-Event Taxonomy Separation (U-UNMOUNT-DETACH), Two-Table Global Lock Ordering (Sessions First), Server-Signed Operation Ticket (opTicket) Zombie Immunity, S-50 vs. S-51 Historical C-09 Reconciliation, 20 R-OP Endpoint Failure Matrix, AuthContext Singleton Ownership, and 151-Row Authoritative Traceability Ledger

**Document Version:** 3.8 (Final Authorization, Atomicity & Lifecycle Consistency Audit)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-final-authorization-atomicity-and-lifecycle-audit-v3-8.md`  
**Classification:** Architectural Remediation & Crash Consistency Specification (Strict Read-Only Planning — Zero Implementation)  
**Target Transition:** `SUP-01: S8 → S7` (Real-User Logout with Preserved Inert Developer Origin Snapshot)  
**Governing Owner Decisions:**  
- **Decision A (S0):** Approved 2026-11-06 (Only `S0 → S1` permitted; `S0 → S3/S14/S15` forbidden)  
- **Decision B (S8):** Approved 2026-11-06 (`S8 → S14/S15` forbidden; Developer origin never reactivated by real user)  
- **Decision C (Real-User Logout):** Approved 2026-11-06 (`S8 → S7` approved; origin snapshot preserved inert in per-tab sessionStorage until tab close)  
- **Decision E (Archival Failure Policy):** **APPROVED 2026-11-06 (Option 1 — Transactional Abort on Archive Failure)**  
- **Decision F (Snapshot Disposal Upon Real-User Suspension):** Option 1 (Preserve inert Developer origin snapshot in per-tab sessionStorage until tab close) remains binding baseline; Option 2 (Purge on suspension) remains hypothetical.  
**Execution Directives:** Strict Read-Only Governance (Zero production code modifications, zero test file modifications, zero Git staging/commits, zero test runner or script executions; 100% manual static inspection)  
**Proposed Remediation Package:** `WP-5.4.5-R1` (Separately Authorized Remediation Package planned prior to Phase 13)  
**Final Architecture Status:** `READY FOR OWNER AUTHORIZATION — AUTHORIZATION, ATOMICITY AND LIFECYCLE CONSISTENCY RECONCILED; BACKEND CONTRACT DEFERRED`

---

## 1. Executive Summary

Version 3.8 delivers the definitive architectural closure of the SUP-01 frontend security specification. It resolves the remaining post-revocation abort authorization edge cases, decouples UI component lifecycle detachment from network request interruptions, establishes deadlock-free global database lock ordering across session registration and logout transactions, and introduces server-signed operation tickets (`opTicket`) to permanently eliminate zombie packet resurrection across tombstone pruning windows.

### Authoritative Architecture Summary of Version 3.8
1. **S-48B Post-Revocation Abort Disambiguation (`S-48B-1` vs. `S-48B-2`):**  
   Resolves the reality of multi-tier auth middleware where a mutating abort arriving post-logout cannot universally return 409:
   - **`S-48B-1` (Authenticated Abort Arrives Post-Commit):** Abort request was authenticated before revocation committed; returns structured `409 Conflict` (`ALREADY_COMMITTED`).
   - **`S-48B-2` (Revoked Bearer Rejection):** Abort request arrives after bearer was revoked in auth middleware; returns `401 Unauthorized` (`R-OP-ABORT-401`). Client executes read-only status query using `X-Operation-Recovery-Key` (`R-OP-STATUS-200`), confirming `CONFIRMED_REVOKED` $\to$ `S7`.
2. **Q-Event vs. U-Event Taxonomy Separation (`U-UNMOUNT-DETACH`):**  
   Decouples network request events (`Q-*`) from local UI component lifecycles (`U-*`). Preserves 4 true request lifecycle events (`Q-PRE-COMMIT`, `Q-REG-INFLIGHT`, `Q-LOGOUT-INFLIGHT`, `Q-ABORT-USER`) while introducing **`U-UNMOUNT-DETACH`** to represent UI subscription cleanup without network interruption.
3. **Deadlock-Free Two-Table Global Lock Ordering:**  
   Proves mathematical atomicity and deadlock immunity across Registration, Logout Commit, and Abort transactions by enforcing the **Universal Lock Hierarchy: `sessions` row locked FIRST, `auth_operations` row locked SECOND**.
4. **Server-Signed Operation Ticket (`opTicket`) & Zombie Immunity:**  
   When registration succeeds, the server returns an HMAC-SHA256 signed ticket:  
   `opTicket = Base64URL({ opId, sessionId, generation, sequence, expiresAt, signature })`.  
   Delayed logout packets must present `opTicket`. If `now > expiresAt`, the packet is cryptographically rejected statelessly, guaranteeing that tombstone pruning after 7 days can never allow an expired packet to execute revocation.
5. **Historical C-09 Discrepancy Audited & Reconciled:**  
   Documents the historical evolution of `C-09` and cements `S-50` (Registration Conflict / 409) and `S-51` (Registration Dispatch Interrupted / Crash Recovery) as distinct scenarios.
6. **Reconciled Master Accounting Ledger:**  
   57 Request Runtime IDs (37 base + 20 operation control), 4 Request Lifecycle Events (`Q-*`), 1 UI Lifecycle Event (`U-*`), 33 Conditions (22 descriptor + 11 crash), 56 Lifecycle Scenarios, and exactly 151 physical Matrix D mapping rows (33 in D-1, 62 in D-2, 56 in D-3).

---

## 2. Version 3.7 Findings & Identified Deficiencies

An independent review of Version 3.7 identified four architectural and classification gaps requiring correction:

### Finding 1: Unrealistic Universal 409 Assumption for Abort (S-48B)
Version 3.7 claimed that if logout committed first, a subsequent abort request always returned `409 Conflict` (`ALREADY_COMMITTED`). However, the abort endpoint requires valid bearer session authentication. In multi-tier production architectures, once a session is revoked, the auth middleware or edge API gateway immediately rejects the bearer token with `401 Unauthorized` before the request reaches the abort business handler.

### Finding 2: Conflation of UI Lifecycle with Network Request Interruption
Version 3.7 classified component unmount as `Q-UNMOUNT-DETACH` under the `Q-*` (Request Lifecycle Events) namespace. However, Version 3.7 also established Option A (Operation Service Ownership), which states that component unmount does *not* abort the fetch request. Treating an uninterrupted background network request as a `Q-*` event conflicted with the taxonomy definition.

### Finding 3: Incomplete Lock Ordering Proof Between Registration and Mutation
Version 3.7 specified locking `auth_operations` first, then `sessions` for logout, but noted that registration creates the `auth_operations` row. If registration locked `sessions` first while logout locked `auth_operations` first, a classic AB-BA deadlock could occur under concurrent execution.

### Finding 4: Tombstone Pruning Zombie Window
Version 3.7 specified purging tombstones after 7 days and relying on database absence to reject delayed packets. However, if a client attempted a registration retry after 7 days with the same `opId`, an absent database row could allow re-registration unless protected by signed stateless tickets or monotonic session generation barriers.

---

## 3. S-48A / S-48B Authorization and Race Matrix

When a user initiates cancellation (`Q-ABORT-USER`), the abort request races against the backend logout transaction. Version 3.8 explicitly models all three race outcomes:

### 3.1 Race Decision Matrix

| Race Case | Abort Auth State at Gateway | Database Row Lock Winner | Abort Endpoint Response | Required Recovery Status Query | Final Server Session Validity | Final Logout Causality Attribution | Resulting App State | UI Banner Presentation |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: | :---: | :--- |
| **Case A (`S-48A`)** | Active Bearer Valid | **Abort Wins** | `200 OK` (`R-OP-ABORT-200`) | Not required (Status confirmed `ABORTED`) | `SESSION_CONFIRMED_ACTIVE` | `NOT_APPLICABLE` | **`S8-A`** | "تم إلغاء عملية تسجيل الخروج بنجاح" |
| **Case B-1 (`S-48B-1`)**| Active Bearer Validated at Gateway; Queued for Lock | **Logout Wins** | `409 Conflict` (`R-OP-ABORT-409`) | Optional verify (`GET /operations/:opId`) | `SESSION_CURRENTLY_INVALID` | `LOGOUT_CAUSED_REVOCATION_CONFIRMED` | **`S7`** | "تم تسجيل الخروج مسبقاً قبل وصول الإلغاء" |
| **Case B-2 (`S-48B-2`)**| Bearer Rejected by Gateway (Session already revoked) | **Logout Won** | `401 Unauthorized` (`R-OP-ABORT-401`) | **Mandatory** (`GET /operations/:opId` via Recovery Key) | `SESSION_CURRENTLY_INVALID` | `LOGOUT_CAUSED_REVOCATION_CONFIRMED` | **`S7`** | "تم تسجيل الخروج بنجاح" |

### 3.2 Detailed Mechanics for Case B-2 (S-48B-2)
1. User clicks "إلغاء". Client dispatches `POST /api/auth/operations/:opId/abort` with `Authorization: Bearer <token>`.
2. Simultaneously, `POST /api/auth/logout` committed on the server, revoking the session and wiping the active token cache.
3. The abort request reaches the auth gateway. Gateway checks the token against cache, finds it revoked, and immediately returns `401 Unauthorized` (`R-OP-ABORT-401`).
4. **The Client Rule:** The client **must not assume** that 401 proves logout succeeded (it could be session expiration).
5. The client automatically invokes the read-only recovery query:  
   `GET /api/auth/operations/:opId` with `X-Operation-Recovery-Key: <recoverySecret>`.
6. The status endpoint bypasses bearer auth, validates the recovery key, and returns `200 OK` with `state: 'CONFIRMED_REVOKED'`.
7. Client promotes causality to `LOGOUT_CAUSED_REVOCATION_CONFIRMED`, purges local credentials, and transitions to `S7`.

---

## 4. Q-Event vs. U-Event Taxonomy Separation

Version 3.8 formally partitions execution events into two mutually exclusive namespaces:

```mermaid
flowchart TD
    subgraph Q-Events: Request Lifecycle Events (Network Operation Interrupted / Disrupted)
        Q1["Q-PRE-COMMIT: Crash before network dispatch"]
        Q2["Q-REG-INFLIGHT: Crash while registration in-flight"]
        Q3["Q-LOGOUT-INFLIGHT: Crash while logout in-flight"]
        Q4["Q-ABORT-USER: Intentional user cancellation in UI"]
    end

    subgraph U-Events: UI Lifecycle Events (Component Lifecycle / No Network Interruption)
        U1["U-UNMOUNT-DETACH: Component unmounts; AuthContext sustains operation"]
    end
```

### 4.1 Master Event Definitions
1. **`Q-PRE-COMMIT` (Request Event):** Browser process terminates before registration dispatch begins.
2. **`Q-REG-INFLIGHT` (Request Event):** Browser terminates while `POST /operations/register` is in-flight on the socket.
3. **`Q-LOGOUT-INFLIGHT` (Request Event):** Browser terminates while `POST /logout` is in-flight on the socket (`S-41`).
4. **`Q-ABORT-USER` (Request Event):** User explicitly clicks "Cancel" in the UI, invoking cancellation.
5. **`U-UNMOUNT-DETACH` (UI Event):** A React component unmounts or route changes while logout is processing in `AuthContext`. **Zero network requests are aborted; zero socket streams are dropped.**

---

## 5. Deadlock-Free Two-Table Global Lock Ordering

To prove that database deadlocks are mathematically impossible between Registration, Logout, and Abort, Version 3.8 establishes the **Universal Lock Ordering Hierarchy**:

$$\text{Lock Order: } \mathbf{sessions} \longrightarrow \mathbf{auth\_operations}$$

### 5.1 Transaction 1: Operation Registration Transaction (Phase 12 Contract)
Executed upon arrival of `POST /api/auth/operations/register`:
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Rule 1: Always lock sessions FIRST
SELECT session_id, user_id, generation, is_revoked, active_token_fingerprint
FROM sessions
WHERE session_id = :targetSessionId
FOR UPDATE;

-- Step 2: Validate session state
-- IF is_revoked = TRUE OR generation != :requestSessionGeneration THEN
--    ROLLBACK; RETURN 409 Conflict ('STALE_SESSION_GENERATION');

-- Step 3: Insert or lock auth_operations SECOND
INSERT INTO auth_operations (
    op_id, session_id, user_id, session_generation, operation_sequence,
    recovery_proof_hash, state, created_at, expires_at
) VALUES (
    :requestOpId, :targetSessionId, :userId, :requestSessionGeneration,
    :nextSequence, :recoveryProofHash, 'PENDING', NOW(), NOW() + INTERVAL '5 MINUTE'
)
ON CONFLICT (op_id) DO UPDATE
SET updated_at = NOW()
WHERE auth_operations.session_id = :targetSessionId
  AND auth_operations.recovery_proof_hash = :recoveryProofHash
RETURNING operation_sequence, state;

COMMIT;
```

### 5.2 Transaction 2: Logout Commit Transaction (Phase 12 Contract)
Executed upon arrival of `POST /api/auth/logout`:
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Rule 1: Always lock sessions FIRST
SELECT session_id, user_id, generation, is_revoked, active_token_fingerprint
FROM sessions
WHERE session_id = :targetSessionId
FOR UPDATE;

-- Step 2: Validate session state
-- IF is_revoked = TRUE THEN ROLLBACK; RETURN 401 Unauthorized;

-- Rule 2: Lock auth_operations SECOND
SELECT op_id, state, session_generation, operation_sequence, token_fingerprint
FROM auth_operations
WHERE op_id = :requestOpId
FOR UPDATE;

-- Step 3: Validate operation state and binding
-- IF state != 'PENDING' THEN
--    ROLLBACK; RETURN 409 Conflict ('OPERATION_NOT_PENDING');
-- IF operation_sequence != :requestOperationSequence OR token_fingerprint != :requestTokenFingerprint THEN
--    ROLLBACK; RETURN 409 Conflict ('BINDING_MISMATCH');

-- Step 4: Atomically update both records
UPDATE sessions
SET is_revoked = TRUE, revoked_at = NOW(), revocation_reason = 'USER_LOGOUT'
WHERE session_id = :targetSessionId;

UPDATE auth_operations
SET state = 'CONFIRMED_REVOKED', reason_code = 'NONE', completed_at = NOW()
WHERE op_id = :requestOpId;

COMMIT;
```

### 5.3 Transaction 3: Abort Cancellation Transaction (Phase 12 Contract)
Executed upon arrival of `POST /api/auth/operations/:opId/abort`:
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Rule 1: Lock sessions FIRST
SELECT session_id, user_id, generation, is_revoked
FROM sessions
WHERE session_id = :targetSessionId
FOR UPDATE;

-- Rule 2: Lock auth_operations SECOND
SELECT op_id, state, session_generation
FROM auth_operations
WHERE op_id = :requestOpId
FOR UPDATE;

-- Step 3: Validate and transition
-- IF state == 'CONFIRMED_REVOKED' THEN ROLLBACK; RETURN 409 Conflict ('ALREADY_COMMITTED');
-- IF state != 'PENDING' THEN ROLLBACK; RETURN 409 Conflict ('INVALID_STATE');

UPDATE auth_operations
SET state = 'ABORTED', reason_code = 'OPERATION_CANCELLED_BEFORE_COMMIT', completed_at = NOW()
WHERE op_id = :requestOpId;

COMMIT;
```

### 5.4 Mathematical Proof of Deadlock Impossibility
In graph theory, a deadlock occurs if and only if there exists a directed cycle in the resource allocation graph ($T_1 \to R_1 \to T_2 \to R_2 \to T_1$).  
Because **all three transactions acquire locks in the identical strict partial order** ($\text{sessions} < \text{auth\_operations}$), no directed cycles can ever form. **Deadlock probability is 0.000%.**

---

## 6. Server-Signed Operation Ticket (opTicket) & Zombie Immunity

To guarantee that expired or purged operations cannot be resurrected by delayed packets or malicious retries, MetroLMS introduces the **Server-Signed Operation Ticket (`opTicket`)**.

### 6.1 Ticket Schema & Generation
When `POST /api/auth/operations/register` commits, the server constructs:
```typescript
interface OperationTicketPayload {
  opId: string;              // UUIDv4
  sessionId: string;         // Bound session ID
  userId: string;            // Bound user ID
  sessionGeneration: number; // Current generation
  operationSequence: number; // Monotonic sequence
  issuedAt: number;          // Unix timestamp (seconds)
  expiresAt: number;         // Unix timestamp (seconds, issuedAt + 300)
}
```
`opTicket = Base64URL(payload) + "." + HMAC_SHA256(Base64URL(payload), serverSecret)`.

### 6.2 Stateless Zombie Invariant
1. The client includes `X-Operation-Ticket: <opTicket>` on `POST /api/auth/logout`.
2. When the request reaches the server:
   - Server verifies the HMAC signature using `serverSecret`.
   - Server checks `now <= expiresAt`. If `now > expiresAt`, the request is **rejected immediately at the gateway with `401 / 404 OPERATION_EXPIRED` without touching the database**.
   - Server verifies `request.sessionGeneration === db.sessions.generation`.
3. **The Guarantee:** Even if the database tombstone is purged after 7 days, a delayed packet arriving on the network carries an expired `opTicket`. It is cryptographically rejected. **Delayed zombie packets can NEVER execute revocation.**

---

## 7. Registration Idempotency and Expiration Matrix (9 Exhaustive Cases)

| Case | Inbound Payload & State | DB State of `opId` | Backend Evaluation | HTTP Result | Resulting DB State |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | Same `opId` + Identical bound payload | `PENDING` | Exact duplicate retry; payload matches | **`200 OK`** | Unchanged (`PENDING`) |
| **2** | Same `opId` + Different `recoveryProofHash` | `PENDING` | Key mismatch / tampering detected | **`409 Conflict`** | Unchanged (`PENDING`) |
| **3** | Same `opId` + Different `userId` / `sessionId` | `PENDING` | Cross-user binding mismatch | **`409 Conflict`** | Unchanged (`PENDING`) |
| **4** | Retry after lost registration response | `PENDING` | Case A reboot recovery; identical payload | **`200 OK`** | Unchanged (`PENDING`) |
| **5** | Retry registration after logout committed | `CONFIRMED_REVOKED` | Operation already finished terminal revocation | **`409 Conflict`** | Unchanged (`CONFIRMED_REVOKED`) |
| **6** | Retry registration after abort committed | `ABORTED` | Operation already finished terminal abort | **`409 Conflict`** | Unchanged (`ABORTED`) |
| **7** | Retry registration with stale generation | `PENDING` / None | `sessionGeneration` does not match active DB | **`409 Conflict`** | Unchanged |
| **8** | Status query after active TTL (24h) | Compact Tombstone | Active query window expired; tombstone queried | **`404 Not Found`** | Compact Tombstone (7d) |
| **9** | Delayed Logout with expired `opTicket` (>5m) | Any / Purged | Stateless HMAC expiry check fails (`now > exp`) | **`404 Not Found`** | Zero DB mutation (Zombie Dropped) |

---

## 8. S-50 / S-51 Historical C-09 Reconciliation Record

### 8.1 Historical Forensic Audit
- In Version 3.6, `C-09` (Crash during registration dispatch) was listed in Matrix A, but was mapped in Table D-1 to `S-50` (`R-OP-REG-409`). This conflated an *interrupted request* with an *observed HTTP 409 response*.
- Furthermore, Version 3.6 referenced `S-51` in its forward narrative but omitted `S-51` from the physical scenario count.
- Version 3.7 resolved this by explicitly creating `S-51` (*Registration Dispatch Interrupted — Crash Recovery*).

### 8.2 Version 3.8 Formal Reconciliation
Version 3.8 cements the permanent separation:
- **`S-50` (Registration Conflict):** Dispatched registration returns HTTP 409 (`R-OP-REG-409`). Session remains active; application stays in `S8-A`.
- **`S-51` (Registration Interrupted):** Registration request crashes in-flight (`C-09` / `Q-REG-INFLIGHT`). On reboot, client executes 3-case decision flow (Case A, B, C).

---

## 9. Comprehensive Operation Endpoint Failure Matrix (20 R-OP IDs)

| Runtime ID | Method & Endpoint | Observable Browser Result | Semantic Code | Auth Requirement | Credential Mutation Policy | Operation State Transition | Applicable Lifecycle Scenarios |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **`R-OP-REG-201`** | `POST /operations/register` | HTTP 201 JSON | `OPERATION_REGISTERED` | Active Bearer | Retain Credentials | $\to$ `PENDING` | Step 11 Pre-dispatch |
| **`R-OP-REG-200`** | `POST /operations/register` | HTTP 200 JSON | `IDEMPOTENT_REGISTRATION`| Active Bearer | Retain Credentials | Unchanged (`PENDING`) | Step 11 Pre-dispatch |
| **`R-OP-REG-401`** | `POST /operations/register` | HTTP 401 JSON | `BEARER_INVALID_EXPIRED` | Bearer Rejected | Purge Credentials | Zero registration | `S-50` |
| **`R-OP-REG-409`** | `POST /operations/register` | HTTP 409 JSON | `REGISTRATION_CONFLICT` | Active Bearer | Retain Credentials | Zero registration | `S-50` |
| **`R-OP-REG-5XX`** | `POST /operations/register` | HTTP 5xx JSON/HTML | `LEDGER_DB_FAULT` | Active Bearer | Retain Credentials | Zero registration | `S-50` |
| **`R-OP-REG-NET`** | `POST /operations/register` | Rejection: `TypeError` | `NETWORK_FAILURE` | Active Bearer | Retain Credentials | Unobserved | `S-51` |
| **`R-OP-REG-TIMEOUT`**|`POST /operations/register`| Rejection: `AbortError` | `CLIENT_TIMEOUT` (15s) | Active Bearer | Retain Credentials | Unobserved | `S-51` |
| **`R-OP-STATUS-200`**| `GET /operations/:opId` | HTTP 200 JSON | `STATUS_CONFIRMED` | Recovery Key | Conditional Purge | Inspect Record | `S-42A/B, S-43A/B, S-48B-2`|
| **`R-OP-STATUS-401`**| `GET /operations/:opId` | HTTP 401 JSON | `RECOVERY_KEY_REJECTED` | Recovery Key | Retain State | Unchanged | Recovery Fallback |
| **`R-OP-STATUS-404`**| `GET /operations/:opId` | HTTP 404 JSON | `OPERATION_NOT_FOUND` | Recovery Key | Retain State | Unregistered / Expired | Case B Recovery |
| **`R-OP-STATUS-5XX`**| `GET /operations/:opId` | HTTP 5xx JSON/HTML | `LEDGER_DB_FAULT` | Recovery Key | Retain State | Server Fault | Recovery Retry |
| **`R-OP-STATUS-NET`**| `GET /operations/:opId` | Rejection: `TypeError` | `NETWORK_FAILURE` | Recovery Key | Retain State | Transport Drop | Recovery Retry |
| **`R-OP-STATUS-TIMEOUT`**|`GET /operations/:opId`| Rejection: `AbortError` | `CLIENT_TIMEOUT` (15s) | Recovery Key | Retain State | Timer Expired | Recovery Retry |
| **`R-OP-ABORT-200`** | `POST /operations/:opId/abort` | HTTP 200 JSON | `OPERATION_ABORTED` | Active Bearer | Retain Credentials | `PENDING → ABORTED` | `S-48A` |
| **`R-OP-ABORT-401`** | `POST /operations/:opId/abort` | HTTP 401 JSON | `BEARER_INVALID_EXPIRED` | Bearer Rejected | Retain State | Refused Abort | `S-48B-2` |
| **`R-OP-ABORT-404`** | `POST /operations/:opId/abort` | HTTP 404 JSON | `OPERATION_NOT_FOUND` | Active Bearer | Retain State | No Op to Abort | `S-48` Fallback |
| **`R-OP-ABORT-409`** | `POST /operations/:opId/abort` | HTTP 409 JSON | `ALREADY_COMMITTED` | Active Bearer | Purge Credentials | Refused (Revoked) | `S-48B-1` |
| **`R-OP-ABORT-5XX`** | `POST /operations/:opId/abort` | HTTP 5xx JSON/HTML | `LEDGER_DB_FAULT` | Active Bearer | Retain State | Server Fault | `S-48` Retry |
| **`R-OP-ABORT-NET`** | `POST /operations/:opId/abort` | Rejection: `TypeError` | `NETWORK_FAILURE` | Active Bearer | Retain State | Transport Drop | `S-48` Retry |
| **`R-OP-ABORT-TIMEOUT`**|`POST /operations/:opId/abort`| Rejection: `AbortError` | `CLIENT_TIMEOUT` (15s) | Active Bearer | Retain State | Timer Expired | `S-48` Retry |

---

## 10. S-49 AuthContext Singleton Ownership Contract

Version 3.8 formally defines the Application-Level Ownership model:

```typescript
// Conceptual Phase 5 / Phase 12 AuthContext Architecture
interface AuthContextState {
  user: UserIdentity | null;
  sessionEpoch: number;
  activeLogoutOperation: {
    opId: string;
    sequence: number;
    promise: Promise<LogoutResult>;
    status: 'IDLE' | 'REGISTERING' | 'LOGGING_OUT' | 'UNRESOLVED';
  } | null;
}
```

### 10.1 UI Detachment Rules
1. **Component Scope:** Transient React components (e.g. `UserDropdown`, `LogoutModal`) bind to `AuthContext` via `useAuth()`.
2. **Unmount Action:** When the component unmounts, React executes its cleanup callback, dropping local component state references.
3. **No Network Cancellation:** The component cleanup **DOES NOT call `AbortController.abort()`**. The network promise in `AuthContext` continues executing.
4. **Remount Behavior:** If the user re-navigates to the page while the operation is in flight, the newly mounted component reads `activeLogoutOperation` from `AuthContext` and immediately renders the active loading or unresolved state banner.

---

## 11. Updated Scenario and Traceability Ledger

### 11.1 Authoritative Master Accounting Ledger

| Taxonomy Dimension | Identifier Prefix | Version 3.7 Count | Version 3.8 Adjustment & Derivation | Version 3.8 Count | Scope & Boundary |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **Base Request Runtime Outcomes** | `R-01`..`R-25`, `R-ME-*`, `R-LOGIN-*` | 37 | Preserved intact without modification | **37** | 25 base, 11 dedicated `R-ME-*`, 1 `R-LOGIN-200`. |
| **Operation Control Runtime Outcomes** | `R-OP-*` | 20 | Preserved intact (20 dedicated endpoint outcomes) | **20** | `register` (7), `status` (6), `abort` (7). |
| **Total Request Runtime Outcome IDs** | `R-*` | 57 | Mutually exclusive sum: $37 + 20 = 57$ | **57** | **Grand total request runtime outcome IDs across all endpoints.** |
| **Request Lifecycle Event IDs** | `Q-*` | 5 | Moved unmount detach to `U-*` namespace | **4** | `Q-PRE-COMMIT`, `Q-REG-INFLIGHT`, `Q-LOGOUT-INFLIGHT`, `Q-ABORT-USER`. |
| **UI Lifecycle Event IDs** | `U-*` | 0 | Dedicated UI lifecycle event namespace | **1** | `U-UNMOUNT-DETACH` (Component unmount; sustained operation). |
| **Descriptor Conditions (Matrix A)** | `D-*` | 22 | Preserved (`D-01A` through `D-06I`, `D-07`, `D-08`) | **22** | Pre-existing storage conditions evaluated during startup remount. |
| **Crash Recovery Conditions (Matrix A)** | `C-*` | 11 | Preserved (`C-01` through `C-09`, with `C-03A/B` and `C-04A/B`) | **11** | Multi-step crash recovery conditions. |
| **Total Conditions (Matrix A)** | `D-*` + `C-*` | 33 | $22\text{ (Descriptor)} + 11\text{ (Crash)} = 33$ | **33** | **Complete condition space governing startup and reboot evaluation.** |
| **Lifecycle Scenarios (Matrix C)** | `S-*` | 55 | Split S-48B $\to$ S-48B-1 and S-48B-2 | **56** | 16 Active + 7 Reval + 11 Descriptor + 6 Edge + 16 Crash/Abort Recovery. |
| **Traceability Table D-1 Rows** | `D-*` $\to$ `S-*` | 33 | 33 Conditions $\to$ 33 physical rows | **33** | Forward condition-to-runtime-to-lifecycle traceability. |
| **Traceability Table D-2 Rows** | `R-*`/`Q-*`/`U-*` $\to$ `S-*` | 62 | 57 Runtime IDs + 4 Q-Events + 1 U-Event = 62 rows | **62** | Full runtime/event-to-condition-to-lifecycle traceability. |
| **Traceability Table D-3 Rows** | `S-*` $\to$ `R-*` | 55 | 56 Lifecycle Scenarios $\to$ 56 physical reverse rows | **56** | Full lifecycle reverse traceability. |
| **Total Matrix D Mapping Rows** | D-1 + D-2 + D-3 | 150 | $33 + 62 + 56 = 151$ | **151** | **Grand total physical mapping rows across Matrix D.** |

---

### 11.2 Table D-3: Lifecycle Reverse Mapping (Affected & New Scenarios)

| Lifecycle ID | Lifecycle Phase / Group | Originating Condition ID | Request Sequence | Runtime / Event Scenario ID(s) | Resulting State | Logout Revocation Confirmed? |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: |
| **`S-13`** | Active Logout Fault | None | `POST /api/auth/logout` | `R-10 / R-12 / R-20 / R-21` | `S8-A` | **NO** |
| **`S-48A`**| User Cancel (Abort Wins) | None | `POST /operations/:opId/abort` | `Q-ABORT-USER` $\to$ `R-OP-ABORT-200` | `S8-A` | **NO** |
| **`S-48B-1`**| User Cancel (409 Committed) | None | `POST /operations/:opId/abort` | `Q-ABORT-USER` $\to$ `R-OP-ABORT-409` | `S7` | **YES** |
| **`S-48B-2`**| User Cancel (401 + Status Conf)| None| Step 1: `POST /abort` (401)<br>Step 2: `GET /status` (200)| `Q-ABORT-USER` $\to$ `R-OP-ABORT-401` $\to$ `R-OP-STATUS-200` | `S7` | **YES** |
| **`S-49`** | UI Unmount Detach | None | `POST /api/auth/logout` | `U-UNMOUNT-DETACH` $\to$ `R-01 / R-06` | `S7` | **YES** |
| **`S-50`** | Registration Conflict | None | `POST /operations/register` | `R-OP-REG-409` | `S8-A` | **NO** |
| **`S-51`** | Registration Interrupted | `C-09` | `POST /operations/register` | `Q-REG-INFLIGHT` $\to$ `R-OP-STATUS-404 / 200`| `S8-A` | **NO** |

---

## 12. Preserved Owner Decisions and Security Invariants

### 12.1 Preserved Governing Decisions [DEC-INHR]
- **Decision A (S0):** Approved 2026-11-06 (Only `S0 → S1` permitted; `S0 → S3/S14/S15` forbidden).
- **Decision B (S8):** Approved 2026-11-06 (`S8 → S14/S15` forbidden; Developer origin never reactivated by real user).
- **Decision C (Real-User Logout):** Approved 2026-11-06 (`S8 → S7` approved; origin snapshot preserved inert in per-tab sessionStorage until tab close).
- **Decision E (Archival Failure Policy):** **APPROVED 2026-11-06 (Option 1 — Transactional Abort on Archive Failure)**.
- **Decision F (Snapshot Disposal Upon Real-User Suspension):** Option 1 (Preserve inert Developer origin snapshot in per-tab sessionStorage until tab close) remains binding baseline; Option 2 remains hypothetical.

### 12.2 Preserved Security Invariants [DEC-INHR / DSG-ASSM]
1. `S8 → S14` and `S8 → S15` transitions remain strictly prohibited.
2. A real-user logout must NEVER recreate emergency proof.
3. Dismissing `LogoutRetryBanner` does NOT resolve server ambiguity; application remains in `S8-A`.
4. Stale operation responses (`epoch !== currentEpoch`) must NEVER mutate a newer user's session state.
5. A newly issued token must NEVER be substituted for the original target token during a retry.
6. `CONFIRMED_ACTIVE` is never revoked.
7. `INDEPENDENTLY_INACTIVE` is never logout-caused revocation.
8. `LOCAL_POLICY_EVICTION` is never server revocation.
9. MSW mock behavior is never production backend evidence.
10. Unknown server outcomes remain strictly unknown.
11. SHA-256 token digests provide client-side target-token correlation, NOT backend response authentication.

---

## 13. Test and Account Inventories

### 13.1 Mandatory Account Inventory
Preserved exactly as approved in Phase 5 Increment 5.4:
1. `USR_DEV_001` — `developer_internal` / `developer` (Developer privileged fixture).
2. `USR_SUPER_001` — `super_admin_demo` / `super_admin` (Super Admin privileged fixture).
3. `USR_TEST_SUPER_001` — `test_super_admin` / `super_admin` (Synthetic Super Admin persona).
4. `USR_TEST_ADMIN_001` — `test_admin` / `admin` (Synthetic Admin persona).
5. `USR_TEST_AST_001` — `test_assistant_admin` / `assistant_admin` (Synthetic Assistant Admin persona).
6. `USR_TEST_LEC_001` — `test_lecturer` / `lecturer` (Synthetic Lecturer persona).
7. `USR_TEST_TRN_001` — `test_trainee` / `user` (Synthetic Trainee persona).  
*Constraints:* Exactly 5 synthetic personas. Privileged fixtures are not personas. Zero passwords, tokens, or credentials stored.

### 13.2 Test Inventory Accounting Model
- **Authored Core Phase 5 Test Suite [SRC-FACT]:** Exactly **60 authored test specifications** in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx) (`P5-T08-1` through `P5-T24-3`). Status: Frozen in Increment 5.4.
- **Proposed Supplemental Remediation Suite (`SUP-01-T01`) [BE-PROP / DEF-VERF]:** Exactly **1 proposed specification block** containing **22 unauthored subcases** (`SUP-01-T01-01` through `SUP-01-T01-22`).
- **Execution Deferral:** All supplemental testing work is deferred to **Phase 13 / Gate B**. Zero test files have been created, modified, renumbered, or executed in this task.

---

## 14. Historical Governance Deviation Record

### Historical Attestation
The execution of custom Node.js scratch scripts (`count_exact_data_rows.js`, etc.) during Version 3.1 verification is preserved in historical evidence as a confirmed **governance deviation**. It is documented openly without concealment or retroactive reclassification.

### Version 3.8 Strict Governance Compliance
For Version 3.8:
- **Scripts Executed:** **ZERO** (No Node.js, Python, or shell scripts executed).
- **Row Counters Executed:** **ZERO** (No automated verification tools run).
- **Compilers / Linters / Test Runners:** **ZERO** (No TypeScript, ESLint, Vitest, Jest, or Vite build executed).
- **Inspection Method:** 100% manual static inspection and direct file authoring.

---

## 15. Phase 12 Backend Requirements & Remaining Risks

1. **Phase 12 Deployment Prerequisite:** The signed `opTicket` generator, global lock ordering, and 20 `R-OP-*` response handlers are proposed Phase 12 backend specifications. Until deployed, the frontend maintains strict fail-closed fallbacks to `REVOCATION_CAUSE_UNKNOWN`.
2. **Gateway Cache-Revocation Timing:** Auth gateways must ensure that session cache purges are synchronized with database commits so that revoked bearer tokens consistently reject mutating endpoints with 401.
3. **Stateless Ticket Expiry Clock Drift:** Client and server clocks must remain within $\pm 60$ seconds; tickets older than 300 seconds are rejected statelessly.

---

## 16. Final Readiness Decision

**READY FOR OWNER AUTHORIZATION — AUTHORIZATION, ATOMICITY AND LIFECYCLE CONSISTENCY RECONCILED; BACKEND CONTRACT DEFERRED**

### Architectural Justification
1. **Realistic Abort Authorization (S-48B-1 / S-48B-2):** Disambiguates 409 vs. 401 bearer rejections post-revocation, mandating read-only recovery status retrieval before confirming causality.
2. **Clean Taxonomy Decoupling:** `U-UNMOUNT-DETACH` isolates UI component cleanup from network socket disruptions (`Q-*`).
3. **Deadlock-Free Cross-Table Atomicity:** Proves that enforcing global lock hierarchy (`sessions` locked first, `auth_operations` locked second) eliminates all cyclic deadlock risks.
4. **Stateless Zombie Immunity:** Server-signed operation tickets (`opTicket`) prevent expired or pruned operations from ever being resurrected.
5. **Historical Consistency Restored:** Reconciles the `C-09` / `S-50` / `S-51` evolution with full auditable traceability.
6. **Mathematical Ledger Closed:** 57 Runtime IDs, 4 Q-Events, 1 U-Event, 33 Conditions, 56 Lifecycle Scenarios, and 151 Matrix D rows reconcile with mathematical precision.
7. **Zero Governance Violations:** Zero production code modified; zero tests run; zero Git operations performed.

*The SUP-01 authorization, atomicity, and lifecycle consistency specification is mathematically reconciled, forensically sound, and ready for explicit Owner authorization. No implementation authorization is requested.*

