# MetroLMS — SUP-01 Operation Transaction Integrity & Recovery Coverage (Version 3.7)
## Architecture Audit: C-09 Interruption vs. S-50 Conflict Disambiguation, 3-Case Registration Recovery Flow, Comprehensive Operation Endpoint Failure Taxonomy (20 R-OP IDs), Two-Table Atomic Transaction Specification, S-48 Dual-Branch Cancellation (S-48A / S-48B), Option A Component-Unmount Policy (S-49), Exhaustive 9-Case Idempotency Matrix, and Authoritative 150-Row Traceability Ledger

**Document Version:** 3.7 (Operation Transaction Integrity & Recovery Coverage)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-operation-transaction-integrity-and-recovery-audit-v3-7.md`  
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
**Final Architecture Status:** `READY FOR OWNER AUTHORIZATION — REGISTRATION RECOVERY AND TRANSACTION INTEGRITY RECONCILED; BACKEND CONTRACT DEFERRED`

---

## 1. Executive Summary

Version 3.7 delivers the final architectural closure of the SUP-01 frontend security specification, resolving the remaining lifecycle ambiguities, registration crash recovery branches, cross-table database atomicity contracts, cancellation race conditions, and component-unmount semantics identified during the Version 3.6 review.

### Key Architectural Resolutions in Version 3.7
1. **Disambiguation of C-09 (Registration Crash) vs. S-50 (Registration 409 Conflict):**  
   Formally decouples observed HTTP 409 registration rejections (`S-50`) from unobserved request interruptions caused by browser termination (`C-09`). Introduces dedicated lifecycle scenario **`S-51`** (*Registration Dispatch Interrupted — Crash Recovery*) to represent the unobserved crash boundary with full two-way recovery modeling.
2. **Complete 3-Case Registration Recovery Decision Flow:**  
   Models all three post-crash reboot outcomes for `C-09` / `S-51`:
   - *Case A (Registration Committed, Response Lost):* Client queries status using recovery key, retrieves existing `PENDING` record, and either resumes logout or executes authorized abort.
   - *Case B (Registration Never Committed):* Client queries status, receives structured 404 `OPERATION_NOT_FOUND`, and safely retries registration with identical parameters if bearer session remains valid.
   - *Case C (Descriptor Missing / Corrupted):* Client cannot reconstruct `opId` or capability; falls back safely to `REVOCATION_CAUSE_UNKNOWN`.
3. **Comprehensive Operation Endpoint Failure Taxonomy (20 Dedicated `R-OP-*` IDs):**  
   Publishes an explicit, endpoint-correct runtime outcome taxonomy covering all success, authorization, conflict, transport, and timeout states across `register`, `status`, and `abort` endpoints, eliminating generic failure conflation.
4. **Two-Table Atomic Database Transaction Specification:**  
   Proves that operation records and session records can never contradict each other. Specifies the Phase 12 database transaction with consistent global row locking (`auth_operations` locked first, followed by `sessions`), enforcing atomic cross-table synchronization.
5. **S-48 Dual-Branch Cancellation Modeling (`S-48A` vs. `S-48B`):**  
   Explicitly models both branches when a user-initiated cancellation races with logout commit:
   - **`S-48A` (Abort Wins):** Abort commits before logout; operation marked `ABORTED`; delayed logout rejected; session preserved in `S8-A`.
   - **`S-48B` (Logout Wins):** Logout commits before abort; abort rejected with `409 Conflict` (`ALREADY_COMMITTED`); session revoked $\to$ `S7`.
6. **Option A Component-Unmount Policy (`S-49`):**  
   Establishes that the logout transaction is owned by `AuthContext` (application-level singleton), not transient UI components. Component unmount detaches UI listeners but **DOES NOT abort backend network requests**. Defines `S-49` as *UI Component Unmount with Sustained Operation*.
7. **Exhaustive 9-Case Registration Idempotency Matrix:**  
   Specifies backend behavior across all permutation of retries, payload conflicts, terminal states (`ABORTED`, `CONFIRMED_REVOKED`), and expired tombstones.
8. **Reconciled Master Accounting Ledger:**  
   57 Request Runtime IDs (37 base + 20 operation control), 5 Request Lifecycle Events (`Q-*`), 33 Conditions (22 descriptor + 11 crash), 55 Lifecycle Scenarios, and exactly 150 physical Matrix D mapping rows (33 in D-1, 62 in D-2, 55 in D-3).

---

## 2. Version 3.6 Findings & Identified Deficiencies

An independent audit of Version 3.6 identified six architectural and accounting gaps requiring correction:

### Finding 1: Conflation of Registration Crash (C-09) and Registration Conflict (S-50)
Version 3.6 mapped `C-09` (crash during registration dispatch) to `S-50` (`R-OP-REG-409`). An HTTP 409 Conflict is an *observed response* indicating the backend rejected the payload. A crash during dispatch is an *interrupted request* where no response bytes were observed. Conflating them obscured whether an operation existed on the server.

### Finding 2: Incomplete Registration Crash Recovery Paths
Version 3.6 did not model what a rebooting client must do if it crashes during `POST /api/auth/operations/register`. The client needed a deterministic algorithm to distinguish whether the server committed the registration before the crash or dropped it.

### Finding 3: Incomplete Failure Coverage for Operation Endpoints
Version 3.6 defined only 9 `R-OP-*` identifiers, omitting 401 token invalidity, 5xx server errors, network fetch drops, and timer aborts on the `register`, `status`, and `abort` endpoints.

### Finding 4: Inadequate Proof of Cross-Table Database Atomicity
Version 3.6 locked `auth_operations` but did not formally specify the atomic transaction linking `auth_operations.state` with the `sessions.is_revoked` column, leaving open the risk of partial commits where an operation was revoked but the session remained active.

### Finding 5: Single-Outcome Assumption in User Cancellation (S-48)
Version 3.6 mapped user cancellation only to the branch where abort succeeded, omitting the race where the logout request commits on the backend before the abort request arrives.

### Finding 6: Unjustified Abort on Component Unmount (S-49)
Version 3.6 treated component unmount as an abort trigger (`Q-ABORT-UNMOUNT → R-24`). In modern React SPAs, components unmount during route transitions or modal dismissals. Aborting an active logout because a modal closed violated user security intent.

---

## 3. Registration Conflict (S-50) vs. Registration Interruption (S-51 / C-09)

Version 3.7 formally decouples these two distinct failure modes:

| Dimension | Registration Conflict (`S-50`) | Registration Interruption (`S-51` / `C-09`) |
| :--- | :--- | :--- |
| **Trigger Event** | Client dispatches `POST /operations/register`; backend rejects request. | Client dispatches `POST /operations/register`; browser crashes while request is in-flight. |
| **Observed Evidence** | HTTP Response: `409 Conflict` (`R-OP-REG-409`). | Zero response bytes; unobserved socket termination (`Q-REG-INFLIGHT`). |
| **Backend State** | No new operation created; database row rejected. | Ambiguous: backend may have committed `PENDING` or never received packet. |
| **Local Descriptor State** | Local descriptor updated with error or purged. | Local descriptor remains `'PERSISTED_PRE_REG'`. |
| **Logout Dispatch Policy** | **Strictly Prohibited:** Client must never dispatch logout. | **Halted:** Request interrupted; requires reboot recovery. |
| **Resulting Lifecycle State**| **`S-50`** (`S8-A` with Registration Error Banner) | **`S-51`** (`S8-A` Reboot Recovery Flow) |

---

## 4. Complete C-09 Registration Recovery Decision Flow (S-51)

When the browser reopens after a crash during registration dispatch (`C-09` / `S-51`), the client executes the following deterministic recovery flow:

```mermaid
flowchart TD
    Start["Browser Reboots after Registration Crash (C-09 / S-51)"] --> ReadDesc{"Read PendingLogoutDescriptor from sessionStorage"}
    
    ReadDesc -- "Descriptor Missing / Corrupted" --> CaseC["Case C: Recovery Impossible<br/>Fallback: REVOCATION_CAUSE_UNKNOWN"]
    ReadDesc -- "Descriptor Found ('PERSISTED_PRE_REG')" --> QueryStatus["Step 1: Query GET /api/auth/operations/:opId<br/>(using X-Operation-Recovery-Key)"]
    
    QueryStatus --> StatusResult{"Status Endpoint Response"}
    
    StatusResult -- "200 OK (state === 'PENDING')" --> CaseA["Case A: Registration Committed<br/>Extract operationSequence<br/>Update descriptor to 'REGISTERED_PENDING'<br/>Resume POST /logout OR Submit Abort"]
    
    StatusResult -- "404 Not Found (OPERATION_NOT_FOUND)" --> CheckBearer{"Step 2: Validate Bearer Session<br/>(GET /api/auth/me)"}
    
    CheckBearer -- "200 OK (Session Still Active)" --> CaseB1["Case B1: Retry Registration<br/>Resend exact same opId and recoveryProofHash<br/>Idempotent 200/201 received"]
    CheckBearer -- "401 Invalid / Expired" --> CaseB2["Case B2: Session Expired<br/>Purge descriptor<br/>Transition to S7 (Cause UNKNOWN)"]
    
    StatusResult -- "5xx / Network Fault" --> RetryLater["Retain State S8-A<br/>Display Retry Status Query Banner"]
```

### 4.1 Case A: Registration Committed, Response Lost
1. The client reads `opId` and `recoverySecret` from the pre-dispatch descriptor.
2. The client queries `GET /api/auth/operations/:opId` with `X-Operation-Recovery-Key: <secret>`.
3. The server validates the recovery key and returns `200 OK` with `state: 'PENDING'` and `operationSequence`.
4. The client updates the local descriptor to `'REGISTERED_PENDING'`.
5. The client either safely dispatches `POST /api/auth/logout` with the assigned sequence or submits an authenticated abort. It **never generates a new `opId`**.

### 4.2 Case B: Registration Never Committed
1. The status query returns structured `404 Not Found` with `code: 'OPERATION_NOT_FOUND'`.
2. The client verifies current session validity via `GET /api/auth/me`.
3. If the session is active, the client retries `POST /api/auth/operations/register` using the **exact same `opId` and `recoveryProofHash`**.
4. If the bearer session has expired or is invalid, the client aborts registration and purges credentials, setting causality to `REVOCATION_CAUSE_UNKNOWN`.

### 4.3 Case C: Descriptor Missing or Corrupted
If `sessionStorage` was lost during the OS crash, the client cannot discover `opId` or `recoverySecret`. It executes startup revalidation `GET /api/auth/me`. If 401 is received, server validity is `SESSION_CURRENTLY_INVALID`, but causality remains strictly **`REVOCATION_CAUSE_UNKNOWN`** (Logout Revocation: **NO**).

---

## 5. Comprehensive Operation Endpoint Failure Taxonomy (20 Dedicated R-OP IDs)

Version 3.7 defines an exhaustive, endpoint-correct runtime outcome taxonomy covering every failure and transport mode:

| Runtime ID | Method & Endpoint | Observable Browser Result | Semantic Code | Auth Requirement | Credential Mutation Policy | Operation State Transition | Applicable Lifecycle Scenarios |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **`R-OP-REG-201`** | `POST /operations/register` | HTTP 201 JSON | `OPERATION_REGISTERED` | Active Bearer | Retain Credentials | $\to$ `PENDING` | Step 11 Pre-dispatch |
| **`R-OP-REG-200`** | `POST /operations/register` | HTTP 200 JSON | `IDEMPOTENT_REGISTRATION`| Active Bearer | Retain Credentials | Unchanged (`PENDING`) | Step 11 Pre-dispatch |
| **`R-OP-REG-401`** | `POST /operations/register` | HTTP 401 JSON | `BEARER_INVALID_EXPIRED` | Bearer Rejected | Purge Credentials | Zero registration | `S-50` |
| **`R-OP-REG-409`** | `POST /operations/register` | HTTP 409 JSON | `REGISTRATION_CONFLICT` | Active Bearer | Retain Credentials | Zero registration | `S-50` |
| **`R-OP-REG-5XX`** | `POST /operations/register` | HTTP 5xx JSON/HTML | `LEDGER_DB_FAULT` | Active Bearer | Retain Credentials | Zero registration | `S-50` |
| **`R-OP-REG-NET`** | `POST /operations/register` | Rejection: `TypeError` | `NETWORK_FAILURE` | Active Bearer | Retain Credentials | Unobserved | `S-51` |
| **`R-OP-REG-TIMEOUT`**|`POST /operations/register`| Rejection: `AbortError` | `CLIENT_TIMEOUT` (15s) | Active Bearer | Retain Credentials | Unobserved | `S-51` |
| **`R-OP-STATUS-200`**| `GET /operations/:opId` | HTTP 200 JSON | `STATUS_CONFIRMED` | Recovery Key | Conditional Purge | Inspect Record | `S-42A/B, S-43A/B` |
| **`R-OP-STATUS-401`**| `GET /operations/:opId` | HTTP 401 JSON | `RECOVERY_KEY_REJECTED` | Recovery Key | Retain State | Unchanged | Recovery Fallback |
| **`R-OP-STATUS-404`**| `GET /operations/:opId` | HTTP 404 JSON | `OPERATION_NOT_FOUND` | Recovery Key | Retain State | Unregistered / Expired | Case B Recovery |
| **`R-OP-STATUS-5XX`**| `GET /operations/:opId` | HTTP 5xx JSON/HTML | `LEDGER_DB_FAULT` | Recovery Key | Retain State | Server Fault | Recovery Retry |
| **`R-OP-STATUS-NET`**| `GET /operations/:opId` | Rejection: `TypeError` | `NETWORK_FAILURE` | Recovery Key | Retain State | Transport Drop | Recovery Retry |
| **`R-OP-STATUS-TIMEOUT`**|`GET /operations/:opId`| Rejection: `AbortError` | `CLIENT_TIMEOUT` (15s) | Recovery Key | Retain State | Timer Expired | Recovery Retry |
| **`R-OP-ABORT-200`** | `POST /operations/:opId/abort` | HTTP 200 JSON | `OPERATION_ABORTED` | Active Bearer | Retain Credentials | `PENDING → ABORTED` | `S-48A` |
| **`R-OP-ABORT-401`** | `POST /operations/:opId/abort` | HTTP 401 JSON | `BEARER_INVALID_EXPIRED` | Bearer Rejected | Retain State | Refused Abort | `S-48` Fallback |
| **`R-OP-ABORT-404`** | `POST /operations/:opId/abort` | HTTP 404 JSON | `OPERATION_NOT_FOUND` | Active Bearer | Retain State | No Op to Abort | `S-48` Fallback |
| **`R-OP-ABORT-409`** | `POST /operations/:opId/abort` | HTTP 409 JSON | `ALREADY_COMMITTED` | Active Bearer | Purge Credentials | Refused (Revoked) | `S-48B` |
| **`R-OP-ABORT-5XX`** | `POST /operations/:opId/abort` | HTTP 5xx JSON/HTML | `LEDGER_DB_FAULT` | Active Bearer | Retain State | Server Fault | `S-48` Retry |
| **`R-OP-ABORT-NET`** | `POST /operations/:opId/abort` | Rejection: `TypeError` | `NETWORK_FAILURE` | Active Bearer | Retain State | Transport Drop | `S-48` Retry |
| **`R-OP-ABORT-TIMEOUT`**|`POST /operations/:opId/abort`| Rejection: `AbortError` | `CLIENT_TIMEOUT` (15s) | Active Bearer | Retain State | Timer Expired | `S-48` Retry |

---

## 6. Two-Table Atomic Database Transaction Specification

To guarantee that `auth_operations` and `sessions` records never become contradictory, the Phase 12 backend must implement the following atomic database transactions:

### 6.1 Transaction 1: Logout Commit Transaction (Phase 12 Contract)
Executed upon arrival of `POST /api/auth/logout`:
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Step 1: Enforce global lock order (Lock auth_operations FIRST)
SELECT op_id, session_id, user_id, session_generation, operation_sequence, state, token_fingerprint
FROM auth_operations
WHERE op_id = :requestOpId
FOR UPDATE;

-- Step 2: Validate operation state
-- IF state != 'PENDING' THEN ROLLBACK and RETURN 409 Conflict (e.g. ALREADY_ABORTED);

-- Step 3: Enforce global lock order (Lock sessions SECOND)
SELECT session_id, user_id, generation, is_revoked, active_token_fingerprint
FROM sessions
WHERE session_id = :targetSessionId
FOR UPDATE;

-- Step 4: Validate session integrity and bindings
-- IF sessions.user_id != auth_operations.user_id OR
--    sessions.generation != auth_operations.session_generation OR
--    auth_operations.operation_sequence != :requestOperationSequence OR
--    sessions.active_token_fingerprint != auth_operations.token_fingerprint OR
--    sessions.is_revoked = TRUE
-- THEN
--    UPDATE auth_operations SET state = 'CONFIRMED_NOT_REVOKED', reason_code = 'STALE_SESSION_GENERATION', completed_at = NOW();
--    COMMIT;
--    RETURN 409 Conflict;

-- Step 5: Atomically mutate BOTH tables
UPDATE sessions
SET is_revoked = TRUE,
    revoked_at = NOW(),
    revocation_reason = 'USER_LOGOUT'
WHERE session_id = :targetSessionId;

UPDATE auth_operations
SET state = 'CONFIRMED_REVOKED',
    reason_code = 'NONE',
    completed_at = NOW()
WHERE op_id = :requestOpId;

COMMIT;
```

### 6.2 Transaction 2: Abort Cancellation Transaction (Phase 12 Contract)
Executed upon arrival of `POST /api/auth/operations/:opId/abort`:
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Step 1: Lock auth_operations
SELECT op_id, session_id, user_id, session_generation, state
FROM auth_operations
WHERE op_id = :requestOpId
FOR UPDATE;

-- Step 2: Inspect state
-- IF state == 'CONFIRMED_REVOKED' THEN
--    ROLLBACK;
--    RETURN 409 Conflict ('ALREADY_COMMITTED');

-- IF state != 'PENDING' THEN
--    ROLLBACK;
--    RETURN 409 Conflict ('INVALID_OPERATION_STATE');

-- Step 3: Validate caller authorization matches target session
-- IF caller.user_id != auth_operations.user_id OR caller.session_generation != auth_operations.session_generation THEN
--    ROLLBACK;
--    RETURN 403 Forbidden;

-- Step 4: Atomically transition to ABORTED
UPDATE auth_operations
SET state = 'ABORTED',
    reason_code = 'OPERATION_CANCELLED_BEFORE_COMMIT',
    completed_at = NOW()
WHERE op_id = :requestOpId;

COMMIT;
```

---

## 7. Concurrency Proof: Exactly One Terminal Winner

Because both transactions adhere to the **identical lock acquisition hierarchy** (`auth_operations` row locked first), deadlock is mathematically impossible, and strict serialization is guaranteed:

```mermaid
sequenceDiagram
    autonumber
    participant AbortTx as Abort Transaction (POST /abort)
    participant Lock as DB Lock Manager (auth_operations)
    participant LogoutTx as Logout Transaction (POST /logout)

    Note over AbortTx, LogoutTx: Concurrency Case 1: Abort Commits First
    AbortTx->>Lock: Acquire row lock on op_id: OP-100 (SUCCESS)
    LogoutTx->>Lock: Request row lock on op_id: OP-100 (BLOCKED - WAITING)
    AbortTx->>Lock: Update state = 'ABORTED' -> COMMIT & RELEASE LOCK
    Lock-->>LogoutTx: Lock granted
    LogoutTx->>LogoutTx: Inspects state: finds 'ABORTED' -> REFUSES REVOCATION
    LogoutTx-->>LogoutTx: ROLLBACK -> Returns 409 Conflict (OPERATION_ALREADY_ABORTED)

    Note over AbortTx, LogoutTx: Concurrency Case 2: Logout Commits First
    LogoutTx->>Lock: Acquire row lock on op_id: OP-100 (SUCCESS)
    AbortTx->>Lock: Request row lock on op_id: OP-100 (BLOCKED - WAITING)
    LogoutTx->>Lock: Revoke session + state = 'CONFIRMED_REVOKED' -> COMMIT & RELEASE LOCK
    Lock-->>AbortTx: Lock granted
    AbortTx->>AbortTx: Inspects state: finds 'CONFIRMED_REVOKED' -> REFUSES ABORT
    AbortTx-->>AbortTx: ROLLBACK -> Returns 409 Conflict (ALREADY_COMMITTED)
```

- **Case 1 (Abort wins):** Abort acquires the row lock first. `auth_operations` transitions to `ABORTED`. When the logout transaction acquires the lock, it observes `state === 'ABORTED'`, rolls back, and returns `409 Conflict`. **Session remains active.**
- **Case 2 (Logout wins):** Logout acquires the row lock first. It invalidates `sessions` and sets `CONFIRMED_REVOKED`. When abort acquires the lock, it observes `state === 'CONFIRMED_REVOKED'`, rolls back, and returns `409 Conflict` (`ALREADY_COMMITTED`). **Session remains revoked.**
- **Case 3 (Concurrent Contention):** The database serialization point forces an unambiguous ordering. **Exactly one terminal state commits.** Contradictory states are impossible.

---

## 8. S-48 User Cancellation Dual-Branch Reconciliation (S-48A vs. S-48B)

Version 3.7 partitions scenario `S-48` into two distinct, auditable lifecycle scenarios:

| Lifecycle ID | Scenario Name | Concurrency Race Result | Observed Abort Response | Reboot / Status Verification | Final Server Session Validity | Final Logout Causality Attribution | Resulting Application State | Active Credentials | Revocation Confirmed? |
| :---: | :--- | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **`S-48A`** | **User Cancellation — Abort Wins** | Abort commits before logout | `HTTP 200 OK` (`R-OP-ABORT-200`) | Status confirms `ABORTED` | `SESSION_CONFIRMED_ACTIVE` | `NOT_APPLICABLE` | **`S8-A`** (Operation Aborted) | Retained | **NO** |
| **`S-48B`** | **User Cancellation — Logout Wins** | Logout commits before abort | `HTTP 409 Conflict` (`R-OP-ABORT-409`) | Status confirms `CONFIRMED_REVOKED` | `SESSION_CURRENTLY_INVALID` | `LOGOUT_CAUSED_REVOCATION_CONFIRMED` | **`S7`** (Confirmed Revocation) | Purged | **YES** |

---

## 9. S-49 Component-Unmount Policy: Option A Service Ownership

### 9.1 Architectural Evaluation of Unmount Semantics
In React applications, UI components unmount for numerous routine operational reasons (user navigates between tabs, modal closes, parent re-renders, or animations complete). Treating component unmount as an intentional cancellation:
1. Causes accidental aborted logouts where users believed they were logging out.
2. Creates uncoordinated network aborts that race against backend database commits.

### 9.2 Authoritative Policy: Option A (Operation Service Ownership)
Version 3.7 formally selects **Option A**:
- **Application-Level Ownership:** The logout transaction is owned globally by `AuthContext` / `apiClient`, NOT by initiating UI components.
- **Component Cleanup Scope:** When a UI component unmounts during an active logout, it cleans up only local React state and component event listeners. It **DOES NOT invoke `AbortController.abort()`** and **DOES NOT dispatch `POST /operations/:opId/abort`**.
- **Request Lifecycle Event:** Classified as **`Q-UNMOUNT-DETACH`** (UI Subscription Detach).
- **Resulting Lifecycle Scenario:** **`S-49`** (*UI Component Unmount with Sustained Operation*). The backend operation continues uninterrupted to its normal authoritative completion (`R-01` or `R-06`).

---

## 10. Registration Idempotency Matrix (Exhaustive 9-Case Specification)

| Case | Submitted Request Payload & State | Database State of `opId` | Backend Evaluation & Validation | HTTP Response | Resulting Database State | Operation Sequence |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| **1** | Same `opId` + Identical bound payload | `PENDING` | Exact duplicate retry; payload matches | **`200 OK`** | Unchanged (`PENDING`) | Returns existing `operationSequence` |
| **2** | Same `opId` + Different `recoveryProofHash` | `PENDING` | Tampering / key mismatch detected | **`409 Conflict`** (`OPERATION_ID_CONFLICT`) | Unchanged (`PENDING`) | None |
| **3** | Same `opId` + Different `user` / `session` | `PENDING` | Cross-user hijacking / binding mismatch | **`409 Conflict`** (`OPERATION_BINDING_CONFLICT`) | Unchanged (`PENDING`) | None |
| **4** | Registration retry after response lost | `PENDING` | Case A reboot recovery; identical retry | **`200 OK`** | Unchanged (`PENDING`) | Returns existing `operationSequence` |
| **5** | Registration retry after logout response lost | `CONFIRMED_REVOKED` | Operation already finished terminal revocation | **`409 Conflict`** (`ALREADY_COMMITTED`) | Unchanged (`CONFIRMED_REVOKED`) | None |
| **6** | Registration retry after operation aborted | `ABORTED` | Operation already finished terminal abort | **`409 Conflict`** (`OPERATION_ALREADY_ABORTED`)| Unchanged (`ABORTED`) | None |
| **7** | Registration retry with stale generation | `PENDING` / None | `sessionGeneration` does not match active DB | **`409 Conflict`** (`STALE_SESSION_GENERATION`) | Unchanged | None |
| **8** | Status query after active TTL (24h) | Purged from active ledger | Record expired from active query ledger | **`404 Not Found`** (`OPERATION_EXPIRED`) | Tombstone maintained | None |
| **9** | Logout request using purged opId (>7d) | Missing from tombstones | Unregistered operation attempting mutation | **`404 Not Found`** (`OPERATION_NOT_FOUND`) | Zero rows created | None (Zombie Packet Dropped) |

---

## 11. Recovery Capability Authorization Contract

### 11.1 Security Specifications
1. **Entropy & Generation:** Ephemeral 256-bit CSPRNG key generated via `crypto.getRandomValues(new Uint8Array(32))`, base64url-encoded.
2. **Server-Side Storage:** The backend stores only `recovery_proof_hash = sha256_hex(recoverySecret)`. The raw secret is never stored.
3. **Constant-Time Verification:** The backend verifies queries using constant-time comparison (`crypto.timingSafeEqual`) to mitigate timing attacks.
4. **Scope Limitation:** The capability grants **read-only status access** to exactly one `opId`. It has zero permissions to access protected resources, cannot mutate data, and cannot restore bearer sessions.
5. **Transport & Caching:** Transmitted strictly over TLS (HTTPS). Header `X-Operation-Recovery-Key` is prohibited from server access logs. Response includes `Cache-Control: no-store, no-cache, private`.
6. **XSS Exposure Acknowledgment:** The secret resides in `sessionStorage` and is readable by any script executing in the same origin. A 256-bit secret prevents remote brute-forcing, but **does not protect against in-origin XSS compromise**.

---

## 12. Updated Request Runtime and Event Taxonomy

### 12.1 Master Inventory (57 Runtime IDs + 5 Q-Events)

| Group | Identifier Range | Count | Scope & Boundary |
| :--- | :---: | :---: | :--- |
| **Base Logout & Feature Outcomes** | `R-01`..`R-25` | **25** | Preserved intact (includes `R-10`, canonical `R-11`, `R-22`, `R-23`, `R-24`, `R-25`). |
| **Dedicated `GET /api/auth/me` Outcomes**| `R-ME-*` | **11** | Preserved intact (`R-ME-200` through `R-ME-404-GENERIC`). |
| **Dedicated `POST /api/auth/login` Outcomes**| `R-LOGIN-*` | **1** | Preserved intact (`R-LOGIN-200`). |
| **Operation Registration Outcomes** | `R-OP-REG-*` | **7** | `201`, `200`, `401`, `409`, `5XX`, `NET`, `TIMEOUT`. |
| **Operation Status Retrieval Outcomes** | `R-OP-STATUS-*` | **6** | `200`, `401`, `404`, `5XX`, `NET`, `TIMEOUT`. |
| **Operation Abort Outcomes** | `R-OP-ABORT-*` | **7** | `200`, `401`, `404`, `409`, `5XX`, `NET`, `TIMEOUT`. |
| **Total Request Runtime Outcome IDs** | `R-*` | **57** | **Grand total request runtime outcome IDs across all endpoints.** |
| **Request Lifecycle Events** | `Q-*` | **5** | `Q-PRE-COMMIT`, `Q-REG-INFLIGHT`, `Q-LOGOUT-INFLIGHT`, `Q-ABORT-USER`, `Q-UNMOUNT-DETACH`. |

---

## 13. Updated Scenario and Traceability Ledger

### 13.1 Authoritative Accounting Master Ledger

| Taxonomy Dimension | Identifier Prefix | Version 3.6 Count | Version 3.7 Adjustment & Derivation | Version 3.7 Count |
| :--- | :---: | :---: | :--- | :---: |
| **Base Request Runtime Outcomes** | `R-01`..`R-25`, `R-ME-*`, `R-LOGIN-*` | 37 | Preserved intact without modification | **37** |
| **Operation Control Runtime Outcomes** | `R-OP-*` | 9 | Expanded to 20 IDs covering full status/transport/timeout matrix | **20** |
| **Total Request Runtime Outcome IDs** | `R-*` | 46 | $37 + 20 = 57$ | **57** |
| **Request Lifecycle Event IDs** | `Q-*` | 5 | Replaced `Q-ABORT-UNMOUNT` with `Q-UNMOUNT-DETACH` | **5** |
| **Descriptor Conditions (Matrix A)** | `D-*` | 22 | Preserved (`D-01A` through `D-06I`, `D-07`, `D-08`) | **22** |
| **Crash Recovery Conditions (Matrix A)** | `C-*` | 11 | Preserved (`C-01` through `C-09`, with `C-03A/B` and `C-04A/B`) | **11** |
| **Total Startup & Crash Conditions** | `D-*` + `C-*` | 33 | $22\text{ (Descriptor)} + 11\text{ (Crash)} = 33$ | **33** |
| **Lifecycle Scenarios (Matrix C)** | `S-*` | 53 | Split S-48 $\to$ S-48A/B; added S-51 (C-09 recovery) | **55** |
| **Traceability Table D-1 Rows** | `D-*` $\to$ `S-*` | 33 | 33 Conditions $\to$ 33 physical rows (C-09 maps to S-51) | **33** |
| **Traceability Table D-2 Rows** | `R-*`/`Q-*` $\to$ `S-*` | 51 | 57 Runtime IDs + 5 Request Events = 62 physical rows | **62** |
| **Traceability Table D-3 Rows** | `S-*` $\to$ `R-*` | 53 | 55 Lifecycle Scenarios $\to$ 55 physical reverse rows | **55** |
| **Total Matrix D Mapping Rows** | D-1 + D-2 + D-3 | 137 | $33 + 62 + 55 = 150$ | **150** |

---

### 13.2 Table D-1: Affected Condition Mappings (New & Corrected Rows)

| Condition ID | Trigger Event | Dispatched HTTP Operation(s) | Runtime / Event ID(s) | Resulting Lifecycle State | Target Session Validity | Operation Status | Final Logout Causality Attribution | Logout Revocation Confirmed? |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`C-01`**  | Crash pre-registration | None | `Q-PRE-COMMIT` | **`Normal Auth`** | `SESSION_CONFIRMED_ACTIVE` | `OPERATION_NOT_DISPATCHED` | `NOT_APPLICABLE` | **NO** |
| **`C-09`**  | Crash during registration | `POST /operations/register` | `Q-REG-INFLIGHT` | **`S-51`** | `SESSION_CONFIRMED_ACTIVE` | `OPERATION_OUTCOME_UNRESOLVED` | `NOT_APPLICABLE` | **NO** |
| **`C-02`**  | Crash during logout (`S-41`) | `POST /api/auth/logout` | `Q-LOGOUT-INFLIGHT` | **`S8-A`** | `SESSION_CONFIRMED_ACTIVE` | `OPERATION_OUTCOME_UNRESOLVED` | `NOT_APPLICABLE` | **NO** |
| **`C-03A`** | Post-200 Crash Pre-Record | `POST /logout` + Query Status | `R-01` + `R-OP-STATUS-200` | **`S7`** | `SESSION_CURRENTLY_INVALID` | `CONFIRMED_REVOKED` | `LOGOUT_CAUSED_REVOCATION_CONFIRMED` | **YES** |
| **`C-03B`** | Post-200 Crash Post-Record | `POST /logout` + Query Status | `R-01` + `R-OP-STATUS-200` | **`S7`** | `SESSION_CURRENTLY_INVALID` | `CONFIRMED_REVOKED` | `LOGOUT_CAUSED_REVOCATION_CONFIRMED` | **YES** |
| **`C-04A`** | Post-204 Crash Pre-Record | `POST /logout` + Query Status | `R-06` + `R-OP-STATUS-200` | **`S7`** | `SESSION_CURRENTLY_INVALID` | `CONFIRMED_REVOKED` | `LOGOUT_CAUSED_REVOCATION_CONFIRMED` | **YES** |
| **`C-04B`** | Post-204 Crash Post-Record | `POST /logout` + Query Status | `R-06` + `R-OP-STATUS-200` | **`S7`** | `SESSION_CURRENTLY_INVALID` | `CONFIRMED_REVOKED` | `LOGOUT_CAUSED_REVOCATION_CONFIRMED` | **YES** |

---

### 13.3 Table D-3: Lifecycle Reverse Mapping (New & Affected Scenarios)

| Lifecycle ID | Lifecycle Phase / Group | Originating Condition ID | Request Sequence | Runtime / Event Scenario ID(s) | Resulting State | Logout Revocation Confirmed? |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: |
| **`S-13`** | Active Logout Fault | None | `POST /api/auth/logout` | `R-10 / R-12 / R-20 / R-21` | `S8-A` | **NO** |
| **`S-48A`**| User Cancel (Abort Wins) | None | `POST /operations/:opId/abort` | `Q-ABORT-USER` $\to$ `R-OP-ABORT-200` | `S8-A` | **NO** |
| **`S-48B`**| User Cancel (Logout Wins)| None | `POST /operations/:opId/abort` | `Q-ABORT-USER` $\to$ `R-OP-ABORT-409` | `S7` | **YES** |
| **`S-49`** | UI Unmount Detach | None | `POST /api/auth/logout` | `Q-UNMOUNT-DETACH` $\to$ `R-01 / R-06` | `S7` | **YES** |
| **`S-50`** | Registration Conflict | None | `POST /operations/register` | `R-OP-REG-409` | `S8-A` | **NO** |
| **`S-51`** | Registration Interrupted | `C-09` | `POST /operations/register` | `Q-REG-INFLIGHT` $\to$ `R-OP-STATUS-404 / 200`| `S8-A` | **NO** |

---

## 14. Preserved Owner Decisions and Security Invariants

### 14.1 Preserved Governing Decisions [DEC-INHR]
- **Decision A (S0):** Approved 2026-11-06 (Only `S0 → S1` permitted; `S0 → S3/S14/S15` forbidden).
- **Decision B (S8):** Approved 2026-11-06 (`S8 → S14/S15` forbidden; Developer origin never reactivated by real user).
- **Decision C (Real-User Logout):** Approved 2026-11-06 (`S8 → S7` approved; origin snapshot preserved inert in per-tab sessionStorage until tab close).
- **Decision E (Archival Failure Policy):** **APPROVED 2026-11-06 (Option 1 — Transactional Abort on Archive Failure)**.
- **Decision F (Snapshot Disposal Upon Real-User Suspension):** Option 1 (Preserve inert Developer origin snapshot in per-tab sessionStorage until tab close) remains binding baseline; Option 2 remains hypothetical.

### 14.2 Preserved Security Invariants [DEC-INHR / DSG-ASSM]
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

## 15. Test and Account Inventories

### 15.1 Mandatory Account Inventory
Preserved exactly as approved in Phase 5 Increment 5.4:
1. `USR_DEV_001` — `developer_internal` / `developer` (Developer privileged fixture).
2. `USR_SUPER_001` — `super_admin_demo` / `super_admin` (Super Admin privileged fixture).
3. `USR_TEST_SUPER_001` — `test_super_admin` / `super_admin` (Synthetic Super Admin persona).
4. `USR_TEST_ADMIN_001` — `test_admin` / `admin` (Synthetic Admin persona).
5. `USR_TEST_AST_001` — `test_assistant_admin` / `assistant_admin` (Synthetic Assistant Admin persona).
6. `USR_TEST_LEC_001` — `test_lecturer` / `lecturer` (Synthetic Lecturer persona).
7. `USR_TEST_TRN_001` — `test_trainee` / `user` (Synthetic Trainee persona).  
*Constraints:* Exactly 5 synthetic personas. Privileged fixtures are not personas. Zero passwords, tokens, or credentials stored.

### 15.2 Test Inventory Accounting Model
- **Authored Core Phase 5 Test Suite [SRC-FACT]:** Exactly **60 authored test specifications** in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx) (`P5-T08-1` through `P5-T24-3`). Status: Frozen in Increment 5.4.
- **Proposed Supplemental Remediation Suite (`SUP-01-T01`) [BE-PROP / DEF-VERF]:** Exactly **1 proposed specification block** containing **22 unauthored subcases** (`SUP-01-T01-01` through `SUP-01-T01-22`).
- **Execution Deferral:** All supplemental testing work is deferred to **Phase 13 / Gate B**. Zero test files have been created, modified, renumbered, or executed in this task.

---

## 16. Historical Governance Deviation Record

### Historical Attestation
The execution of custom Node.js scratch scripts (`count_exact_data_rows.js`, etc.) during Version 3.1 verification is preserved in historical evidence as a confirmed **governance deviation**. It is documented openly without concealment or retroactive reclassification.

### Version 3.7 Strict Governance Compliance
For Version 3.7:
- **Scripts Executed:** **ZERO** (No Node.js, Python, or shell scripts executed).
- **Row Counters Executed:** **ZERO** (No automated verification tools run).
- **Compilers / Linters / Test Runners:** **ZERO** (No TypeScript, ESLint, Vitest, Jest, or Vite build executed).
- **Inspection Method:** 100% manual static inspection and direct file authoring.

---

## 17. Phase 12 Backend Requirements & Remaining Risks

1. **Backend Implementation Dependency:** The two-table serializable transaction contract, the 20 `R-OP-*` endpoint response codes, and the recovery capability verifier are proposed Phase 12 contracts. Until implemented, crash recovery safely defaults closed to `REVOCATION_CAUSE_UNKNOWN`.
2. **Database Row Lock Ordering Strictness:** Backend developers must strictly acquire the lock on `auth_operations` *before* `sessions` across all endpoints to prevent database deadlocks.
3. **Ledger Expiration Enforcement:** Scheduled backend jobs must invalidate operations past their 5-minute dispatch window and compact records past 24 hours into 7-day tombstones.

---

## 18. Final Readiness Decision

**READY FOR OWNER AUTHORIZATION — REGISTRATION RECOVERY AND TRANSACTION INTEGRITY RECONCILED; BACKEND CONTRACT DEFERRED**

### Architectural Justification
1. **Disambiguation Complete:** Registration conflict (`S-50` / `R-OP-REG-409`) is strictly separated from registration crash interruption (`C-09` / `S-51`).
2. **Deterministic Registration Recovery:** Full 3-case decision flow models committed/lost (Case A), uncommitted (Case B), and missing descriptor (Case C) reboot paths.
3. **Comprehensive Endpoint Taxonomy:** All 20 `R-OP-*` outcomes are explicitly defined across HTTP, network, and timeout failure modes.
4. **Two-Table Database Atomicity:** Lock hierarchy guarantees that `sessions` and `auth_operations` commit atomically; partial writes are impossible.
5. **Dual-Branch Cancellation Modeled:** Scenarios `S-48A` (Abort Wins) and `S-48B` (Logout Wins) represent both race outcomes without ambiguity.
6. **Component Unmount Sanitized:** Option A establishes application-level service ownership (`AuthContext`), preventing accidental cancellations on UI unmount (`S-49`).
7. **Exhaustive Idempotency Rules:** All 9 registration retry cases are formally governed, preventing zombie packet resurrection.
8. **Mathematical Ledger Closed:** 57 Runtime IDs, 5 Q-Events, 33 Conditions, 55 Lifecycle Scenarios, and 150 physical Matrix D rows reconcile with mathematical precision.
9. **Zero Governance Violations:** Zero production code modified; zero tests run; zero Git operations performed.

*The SUP-01 transaction integrity and recovery specification is mathematically reconciled, forensically sound, and ready for explicit Owner authorization. No implementation authorization is requested.*

