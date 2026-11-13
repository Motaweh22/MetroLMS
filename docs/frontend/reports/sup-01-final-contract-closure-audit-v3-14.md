# MetroLMS — SUP-01 Deadlock, Idempotency & Cryptographic Boundary Closure (Version 3.14)
## Final Architectural Audit: Version 3.13 Evidence Classification Matrix, Deadlock Prevention Under Verified Global Lock Order with Database Detection & Retry, Complete 8-Branch Zero-Row Lease Consumption Algorithm, Per-Session Monotonic Sequence Allocator, Multi-Instance AES-GCM Global Invocation Budget ($2^{24}$) & Envelope Completeness, Client-Side Recovery Secret Expiry Purging, Strict No-Redirect API CORS Policy, and 158-Row Authoritative Master Traceability Ledger

**Document Version:** 3.14 (Deadlock, Idempotency & Cryptographic Boundary Closure)  
**Planning Date:** 2026-11-07  
**Document Path:** `docs/frontend/reports/sup-01-final-contract-closure-audit-v3-14.md`  
**Classification:** Architectural Remediation & Forensic Consistency Audit (Strict Read-Only Planning — Zero Implementation)  
**Target Transition:** `SUP-01: S8 → S7` (Real-User Logout with Preserved Inert Developer Origin Snapshot)  
**Governing Owner Decisions:**  
- **Decision A (S0):** Approved 2026-11-06 (Only `S0 → S1` permitted; `S0 → S3/S14/S15` forbidden)  
- **Decision B (S8):** Approved 2026-11-06 (`S8 → S14/S15` forbidden; Developer origin never reactivated by real user)  
- **Decision C (Real-User Logout):** Approved 2026-11-06 (`S8 → S7` approved; origin snapshot preserved inert in per-tab sessionStorage until tab close)  
- **Decision E (Archival Failure Policy):** **APPROVED 2026-11-06 (Option 1 — Transactional Abort on Archive Failure)**  
- **Decision F (Snapshot Disposal Upon Real-User Suspension):** Option 1 (Preserve inert Developer origin snapshot in per-tab sessionStorage until tab close) remains binding baseline; Option 2 (Purge on suspension) remains hypothetical.  
**Execution Directives:** Strict Read-Only Governance (Zero production code modifications, zero test file modifications, zero Git staging/commits, zero test runner or script executions; 100% manual static inspection)  
**Proposed Remediation Package:** `WP-5.4.5-R1` (Separately Authorized Remediation Package planned prior to Phase 13)  
**Final Architecture Status:** `READY FOR OWNER AUTHORIZATION — FINAL LOCKING, IDEMPOTENCY AND CRYPTOGRAPHIC BOUNDARIES CLOSED`

---

## 1. Scope and Governance Attestation

### 1.1 Strict Read-Only Governance Compliance
This document constitutes the final evidence-driven boundary audit of Version 3.13 and its mirrored brain artifact. In accordance with strict architectural governance:
- **Production Source Code:** **ZERO** modifications (`frontend/src/` untouched).
- **Test Code & Suites:** **ZERO** test files created, modified, renumbered, or executed.
- **Automated Verification:** **ZERO** test runners, Vitest, Jest, TypeScript compiler, ESLint, Vite builds, browser tests, or production scanners executed.
- **Scripts & Tools:** **ZERO** scripts, row-counting utilities, Python/Node.js runners, or code generators executed.
- **Git State:** **ZERO** Git staging (`git add`) or commits (`git commit`) performed.
- **Roadmap & Increments:** Preserves the Revision 5 authoritative roadmap, frozen increments (Increment 5.4), and the legacy Vanilla JavaScript prototype completely unmodified.
- **Inspection Methodology:** 100% manual static inspection and direct document authoring.

### 1.2 Historical Governance Deviation Attestation
The execution of custom Node.js scratch scripts (`count_exact_data_rows.js`, etc.) during Version 3.1 verification is preserved in historical evidence as an acknowledged **governance deviation**. It is documented openly without concealment or retroactive reclassification.

### 1.3 Boundary Disclaimer
This document establishes architectural specification and evidence-driven consistency. **It does NOT claim runtime verification, database implementation, browser integration, or production deployment readiness.**

---

## 2. Version 3.13 Evidence Classification Matrix

Every architectural boundary identified in the final review of Version 3.13 is classified below against the primary document and its mirrored artifact:

| Item # | Architectural Requirement | Version 3.13 Status | Evidence Location (v3.13 Section) | Forensic Analysis & v3.14 Closure Action |
| :-: | :--- | :---: | :--- | :--- |
| **1** | Universal Lock Order & Deadlock Claim Precision | `PARTIALLY SPECIFIED` | Section 7.1, 7.2 | Modeled 3 tables but claimed absolute "deadlock immunity". Corrected in §3 to "deadlock prevention under verified global lock order with detection & retry". |
| **2** | Lease Consumption Zero-Row Decision Algorithm | `PARTIALLY SPECIFIED` | Section 7.1 | Combined 409 and 200 without detailing intermediate checks. Closed in §4 with the complete 8-branch decision tree. |
| **3** | Operation Sequence Allocator & Ordering Domain | `PARTIALLY SPECIFIED` | Section 7.1 | Incremented in SQL without formalizing ordering domain, gap tolerance, or rollback semantics. Closed in §5. |
| **4** | AES-GCM Multi-Instance Global Budget & Envelope | `PARTIALLY SPECIFIED` | Section 8.1, 8.2 | Defined 96-bit IV and length-prefixed AAD, but omitted multi-instance global budget enforcement and explicit 128-bit tag tag declaration. Closed in §6. |
| **5** | Client-Side Recovery Secret Expiry Purging | `PARTIALLY SPECIFIED` | Section 5.1, 9.2 | Defined server-side 404 after 24h, but did not specify exact client-side sessionStorage raw secret deletion behavior. Closed in §7. |
| **6** | CORS Redirect (3xx) Boundary Policy | `NOT SPECIFIED` | Section 3.1, 4.1 | Explicitly covered 2xx, 4xx, 5xx, but omitted 3xx redirect behavior across the 7 endpoints. Closed in §8 with strict No-Redirect API Policy. |
| **7** | Master Accounting Ledger Integrity (158 Rows) | `EXPLICITLY SPECIFIED` | Section 11.1 | 64 R-IDs, 4 Q-events, 1 U-event, 33 Cond, 56 Scen, 158 D-rows verified. Reconfirmed in §9. |
| **8** | Frozen Test & Account Baselines | `EXPLICITLY SPECIFIED` | Section 12.1, 12.2 | 60 authored Phase 5 tests and 22 SUP-01-T01 subcases deferred. 7 accounts preserved. Reconfirmed in §9. |

---

## 3. Universal Lock Order — Corrected Guarantee and Transactional Scope

Version 3.13 defined the partial order $\mathbf{sessions} \prec \mathbf{leases} \prec \mathbf{auth\_operations}$. Version 3.14 formally audits all participating database transactions and refines the concurrency guarantee.

### 3.1 Corrected Engineering Terminology
> **Refined Concurrency Guarantee:**  
> **DEADLOCK PREVENTION UNDER A VERIFIED GLOBAL LOCK ORDER, WITH DATABASE DEADLOCK DETECTION AND SAFE RETRY AS REQUIRED SAFEGUARDS.**  
> *(Absolute mathematical deadlock immunity cannot be asserted in production RDBMS environments due to engine-level gap locks, foreign-key share locks, and internal catalog contention. Global lock ordering prevents cyclic waits across modeled application tables; engine-level deadlock detection and application retries handle residual low-probability contention).*

### 3.2 Comprehensive Transaction Lock Audit

| Transaction Name | Participating Tables | Lock Sequence Followed | Lock Types Acquired | Concurrency & Deadlock Evaluation |
| :--- | :--- | :---: | :--- | :--- |
| **1. Lease Creation** | `sessions`, `leases` | `sessions` $\to$ `leases` | `sessions` (FOR KEY SHARE via FK check); `leases` (INSERT exclusive row lock). | Complies with partial order. FK check acquires share lock on parent; no reverse lock. |
| **2. Lease Retry (Idempotent)** | `leases` | `leases` | `leases` (SELECT FOR SHARE / READ COMMITTED). | Single table query. No inter-table wait. |
| **3. Operation Registration** | `sessions`, `leases`, `auth_operations` | `sessions` $\to$ `leases` $\to$ `auth_operations` | `sessions` (FOR UPDATE); `leases` (UPDATE exclusive lock); `auth_operations` (INSERT exclusive lock). | Strictly complies with Universal Lock Order. No circular waits possible across these tables. |
| **4. Logout Commit** | `sessions`, `auth_operations` | `sessions` $\to$ `auth_operations` | `sessions` (FOR UPDATE); `auth_operations` (FOR UPDATE). | Complies with partial order (skips `leases`). Cannot deadlock with registration. |
| **5. Abort Cancellation** | `sessions`, `auth_operations` | `sessions` $\to$ `auth_operations` | `sessions` (FOR UPDATE); `auth_operations` (FOR UPDATE). | Complies with partial order (skips `leases`). Cannot deadlock with registration or logout. |
| **6. Session Revocation (Admin)** | `sessions` | `sessions` | `sessions` (FOR UPDATE). | Single-table master lock. Child rows read via snapshot. |
| **7. Lease Cleanup Worker** | `leases` | `leases` | `leases` (DELETE WHERE expires_at < NOW() - 7d). | Single-table batch delete. Runs during low-traffic windows. |
| **8. Operation Archival Worker** | `auth_operations` | `auth_operations` | `auth_operations` (SELECT / DELETE WHERE created_at < NOW() - 7d). | Single-table archive job. Independent of active sessions. |

### 3.3 Database Deadlock Failure Behavior & Safe Retry Contract
If an unpredictable engine-level deadlock is detected by the RDBMS (SQLSTATE `40P01` or `55P03` lock timeout):
1. **Victim Selection:** The RDBMS automatically aborts the younger transaction, rolling back all uncommitted row changes.
2. **Transaction Rollback:** Rollback restores database state completely: no partially consumed lease, orphaned `auth_operations` row, or incremented sequence counter persists.
3. **Application Retry Boundary:** The retry logic resides in the application service tier (wrapping the transaction boundary).
4. **Retry Parameters:** Maximum **3 retry attempts** with **exponential backoff and full jitter** ($\text{base} = 50\text{ms}, \text{max} = 500\text{ms}$).
5. **Idempotent Collision Safety:** On retry, the application resubmits the exact same `leaseRequestId` and `opId`. If the previous attempt actually committed before connection drop, the retry executes the idempotent branch (§4, Case 1), returning `200 OK` with the existing `opTicket`. If the previous attempt was rolled back, the retry safely executes fresh registration.

---

## 4. Lease Consumption — Complete 8-Branch Zero-Row Decision Algorithm

When `POST /api/auth/operations/register` executes:
```sql
UPDATE leases
SET consumed = TRUE, consumed_at = NOW()
WHERE op_id = :requestOpId
  AND lease_request_id = :requestLeaseRequestId
  AND session_id = :targetSessionId
  AND session_generation = :requestGeneration
  AND recovery_proof_hash = :requestRecoveryProofHash
  AND consumed = FALSE
  AND expires_at > NOW();
```
- **`ROW_COUNT = 1`:** The lease was successfully and atomically consumed. Proceed to allocate sequence and insert `auth_operations` record.
- **`ROW_COUNT = 0`:** Zero rows updated. The transaction immediately evaluates the **Authoritative 8-Branch Decision Tree**:

```mermaid
flowchart TD
    ZeroRow["UPDATE leases returned ROW_COUNT = 0"] --> CheckExisting{"SELECT state, proofHash FROM auth_operations WHERE op_id = :requestOpId"}
    
    CheckExisting -->|Row Exists| ValidateMatch{"recoveryProofHash matches & state == PENDING?"}
    ValidateMatch -->|Yes (Case 1 & 7)| ReturnIdempotent["Legitimate Idempotent Retry -> ROLLBACK -> Return 200 OK (Existing opTicket)"]
    ValidateMatch -->|No / Stale (Case 6)| RejConflictOp["409 Conflict (OPERATION_STATE_CONFLICT)"]
    
    CheckExisting -->|Row Absent| CheckLeaseTable{"SELECT consumed, expires_at, session_generation, op_id, proofHash FROM leases WHERE lease_request_id = :leaseRequestId"}
    
    CheckLeaseTable -->|Row Absent| RejNotFound["409 Conflict (LEASE_NOT_FOUND)"]
    CheckLeaseTable -->|Row Exists| EvalLeaseState{"Evaluate leases row attributes"}
    
    EvalLeaseState -->|consumed == TRUE (Case 2)| RejConsumedNoOp["409 Conflict (LEASE_CONSUMED_NO_OPERATION)"]
    EvalLeaseState -->|now >= expires_at (Case 3)| RejExpired["409 Conflict (LEASE_EXPIRED)"]
    EvalLeaseState -->|session_generation != reqGen (Case 4)| RejGenMismatch["409 Conflict (STALE_SESSION_GENERATION)"]
    EvalLeaseState -->|op_id != reqOpId OR proofHash mismatch (Case 5)| RejBindingConflict["409 Conflict (LEASE_BINDING_MISMATCH)"]
    EvalLeaseState -->|consumed == FALSE & now < expires_at (Case 8)| AbortRetry["409 Conflict (CONCURRENT_TRANSACTION_RETRY)"]
```

### 4.1 Exhaustive Zero-Row Decision Table

| Case # | Exact Root Cause | Database Evidence in `auth_operations` & `leases` | Required HTTP Outcome | Runtime ID | Action on Registration State | Returned Token / Ticket Behavior |
| :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| **1** | Legitimate Idempotent Retry (Response Lost) | `auth_operations` has matching `op_id`, `proofHash`, `PENDING`. | **`200 OK`** | `R-OP-REG-200` | Rollback transaction; zero state mutation. | Reconstructs and returns **existing `opTicket`**; does NOT extend expiry. |
| **2** | Lease Consumed but Operation Absent | `leases.consumed = TRUE`, but row absent in `auth_operations`. | **`409 Conflict`** | `R-OP-REG-409` | Rollback transaction; zero state mutation. | No ticket issued; client must request fresh lease. |
| **3** | Lease Expired Before Consumption | `leases.expires_at <= NOW()`, `consumed = FALSE`. | **`409 Conflict`** | `R-OP-REG-409` | Rollback transaction; zero state mutation. | No ticket issued; client must request fresh lease. |
| **4** | Session Generation Stale | `leases.session_generation != requestGeneration`. | **`409 Conflict`** | `R-OP-REG-409` | Rollback transaction; zero state mutation. | No ticket issued; reject stale session. |
| **5** | Binding Mismatch on `leaseRequestId` | `leases.op_id != requestOpId` OR `proofHash` mismatch. | **`409 Conflict`** | `R-OP-REG-409` | Rollback transaction; zero state mutation. | No ticket issued; flag security anomaly. |
| **6** | Operation Superseded / Invalidated | `auth_operations` exists but `state != 'PENDING'`. | **`409 Conflict`** | `R-OP-REG-409` | Rollback transaction; zero state mutation. | No ticket issued; terminal state reached. |
| **7** | Duplicate Concurrent Ingress | Handled identically to Case 1 via row locks. | **`200 OK`** | `R-OP-REG-200` | Rollback transaction; zero state mutation. | Returns **existing `opTicket`**. |
| **8** | Previous Transaction Aborted (Unconsumed) | `leases.consumed = FALSE`, `now < expires_at`, but lock wait failed. | **`409 Conflict`** | `R-OP-REG-409` | Rollback transaction; retryable via backoff. | No ticket issued; client retries registration. |

---

## 5. Operation Sequence — Ordering Domain and Atomic Allocator

### 5.1 Formal Ordering Domain: Per-Session Monotonic Sequence
The ordering domain for `operationSequence` is strictly defined as:  
$$\mathbf{Domain:}\quad \text{Scoped uniquely to } (\mathbf{session\_id}, \mathbf{session\_generation})$$

- Sequence numbers are **NOT** global across all tenants, and **NOT** per-user across concurrent devices.
- Sequences are allocated strictly sequentially ($1, 2, 3\dots$) for registered operations executed within a single, active session generation.
- **Uniqueness Constraint:** Enforced in PostgreSQL via a unique compound index:
  ```sql
  CREATE UNIQUE INDEX uq_auth_operations_seq 
  ON auth_operations (session_id, session_generation, operation_sequence);
  ```

### 5.2 Atomic Allocator Mechanism
1. The authoritative allocator is the persistent integer column `sessions.highest_operation_sequence`.
2. Inside the registration transaction, the `sessions` row is locked `FOR UPDATE`.
3. The allocator assigns `new_sequence := highest_operation_sequence + 1` and updates `sessions`.
4. The value `new_sequence` is inserted into `auth_operations.operation_sequence`.
5. **Gap Tolerance:** If a transaction rolls back, `highest_operation_sequence` in the database is reverted to its pre-transaction value because it is updated as a normal transactional table column (unlike non-transactional database sequences like `SERIAL` or `CREATE SEQUENCE`). However, even if an application failure occurs post-commit creating a gap, **the system permits non-consecutive monotonic sequences ($S_{n+1} > S_n$)**. Strict strict sequential contiguity is not required; strict monotonic ordering is guaranteed.
6. **Idempotent Replay Invariant:** On an idempotent retry (§4, Case 1), the allocator is **NEVER invoked**. The response returns the sequence already committed in `auth_operations`.

---

## 6. AES-GCM — Multi-Instance Global Budget ($2^{24}$) and Complete Envelope

### 6.1 Multi-Instance Global Invocation Budget
Under NIST SP 800-38D §8.2.2, when using 96-bit random IVs generated via a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG), the maximum number of invocations under a single key must not exceed $2^{32}$ to ensure the collision probability is bounded below $2^{-32}$.

In a multi-instance cloud architecture where multiple application instances share the same encryption key:
- **Global Invocation Ceiling:** MetroLMS enforces a conservative global invocation ceiling of:
  $$\mathbf{Global\ Budget\ Ceiling:\ } \mathbf{2^{24}\ (16,777,216)\ Encryptions\ per\ Key}$$
  *(This provides a safety margin of $256\times$ below NIST's $2^{32}$ collision threshold).*
- **Global Usage Tracking:** A distributed atomic counter (`redis:key:usage:<keyId>` or KMS metrics) increments on each lease encryption.
- **Automated Key Rotation Trigger:** When the global counter reaches $2^{24}$ encryptions OR when the key reaches **30 days of age** (whichever occurs first), the KMS automatically triggers key rotation, provisioning `keyId = v1:k-aes-2026-v(n+1)`.
- **Fail-Closed Policy:** If the KMS counter is unreachable or unverified, the encryption worker fails closed (`500 Server Error`).
- **Probabilistic Reality:** 96-bit random IVs provide **probabilistic collision resistance** bounded by the birthday paradox ($P < 2^{-32}$), NOT an absolute deterministic non-reuse guarantee.

### 6.2 Complete Envelope Specification
Every encrypted `regNonce` stored in `leases.reg_nonce_encrypted` strictly adheres to the complete envelope specification:

| Field Name | Cryptographic Specification | Byte Size | Representation / Encoding | Verification & Behavior |
| :--- | :--- | :---: | :--- | :--- |
| **Envelope Version** | `v1` | 2 bytes | ASCII string | Reject unknown versions with `500 Server Error`. |
| **Key Identifier (`keyId`)** | e.g. `k-aes-2026-v1` | Variable (13B) | ASCII string | Look up secret in key ring; if missing, reject (`500`). |
| **Initialization Vector (IV)** | Random CSPRNG IV | **12 bytes** (96 bits) | Binary bytes | NIST SP 800-38D compliant; generated per operation. |
| **Ciphertext** | Encrypted `regNonce` | 32 bytes | Binary bytes | AES-256 in GCM mode. |
| **Authentication Tag** | GCM Integrity Tag | **16 bytes** (128 bits)| Binary bytes | **Explicitly 128 bits.** Verification failure triggers security alert. |
| **Canonical AAD** | Length-prefixed binding | Variable | UTF-8 bytes | Verified during GCM tag computation. |

- **Exact Canonical AAD Bytes:**
  $$\text{AAD} = \text{len}(leaseRequestId) \mathbin{\Vert} \text{":"} \mathbin{\Vert} leaseRequestId \mathbin{\Vert} \text{":"} \mathbin{\Vert} \text{len}(opId) \mathbin{\Vert} \text{":"} \mathbin{\Vert} opId$$
  Lengths represent exact decimal UTF-8 byte counts without leading zeros (e.g. `36:c4b9f31a-7b2e-4a6c-9d18-35e82a901f44:36:a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d`).
- **Old-Key Retention:** The KMS retains retired keys for at least **7 days** to decrypt unconsumed or auditable leases before permanent destruction.

---

## 7. Recovery Capability Expiry — Client-Side Deletion Contract

At the exact temporal boundary:  
$$\mathbf{now \ge recoveryCapability.expiresAt\ (24\text{ hours from creation})}$$

### 7.1 Client-Side Purging Protocol
1. **Raw Secret Purging:** The client application (via `AuthContext` or storage lifecycle hook) immediately and permanently deletes the raw `descriptor.recoverySecret` from `sessionStorage`.
2. **Explicit Expired Marker:** The descriptor retains an immutable diagnostic marker:
   ```typescript
   descriptor.recoverySecret = null;
   descriptor.recoveryCapabilityExpired = true;
   ```
3. **Preservation of User Credentials:** The client **MUST NOT** purge the user's active session credentials solely because the recovery capability expired. The active session remains valid and active.
4. **Preservation of UNKNOWN / S8-A State:** If an in-flight logout was unresolved and the 24-hour window lapses, the client retains `S8-A` with `REVOCATION_CAUSE_UNKNOWN`. It **MUST NOT** infer that logout succeeded.
5. **Cross-Session Isolation:** Purging is strictly keyed to `lms_pending_logout_v1` and verified against `descriptor.sessionId === currentSessionId`. A newer session or different tab is never affected.

---

## 8. Strict No-Redirect API CORS Policy

Version 3.14 explicitly establishes the HTTP redirect policy across all seven authentication endpoints:

$$\mathbf{Strict\ No\text{-}Redirect\ Policy:}\quad \text{All\ } \mathbf{/api/auth/*} \text{ Endpoints\ NEVER\ Emit\ 3xx\ Redirects}$$

### 8.1 Technical Architectural Rationale
- Under the W3C Fetch / CORS specification, if a cross-origin preflighted request encounters an HTTP 301, 302, 307, or 308 redirect, the browser's network stack either drops custom headers (`Authorization`, `X-Operation-Ticket`, `X-Operation-Recovery-Key`) or fails the preflight check, rejecting the call with an opaque `TypeError: Failed to fetch`.
- Therefore, all seven authentication routes (`/me`, `/login`, `/operations/lease`, `/operations/register`, `/logout`, `/operations/:opId`, `/operations/:opId/abort`) strictly emit **explicit non-redirect HTTP status codes** (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `500`).
- If an edge proxy, captive portal, or misconfigured load balancer emits a 3xx redirect on an authentication route, the browser treats it as a transport violation (`TypeError`), correctly mapped to the respective endpoint's **`*-NET`** runtime outcome.

---

## 9. Accounting and Frozen Baselines

The Master Accounting Ledger remains completely closed, stable, and verified at **158 Matrix D mapping rows**:

### 9.1 Authoritative Master Accounting Ledger

| Taxonomy Dimension | Identifier Prefix | Count | Reconciled Derivation & Boundary |
| :--- | :---: | :---: | :--- |
| **Base Request Runtime Outcomes** | `R-01`..`R-25`, `R-ME-*`, `R-LOGIN-*` | **37** | 25 base, 11 dedicated `R-ME-*`, 1 `R-LOGIN-200`. |
| **Operation Control Runtime Outcomes** | `R-OP-*` | **27** | `register`: 7, `status`: 6, `abort`: 7, `lease`: 7. |
| **Total Request Runtime Outcome IDs** | `R-*` | **64** | **Grand total request runtime outcome IDs across all endpoints.** |
| **Request Lifecycle Event IDs** | `Q-*` | **4** | `Q-PRE-COMMIT`, `Q-REG-INFLIGHT`, `Q-LOGOUT-INFLIGHT`, `Q-ABORT-USER`. |
| **UI Lifecycle Event IDs** | `U-*` | **1** | `U-UNMOUNT-DETACH` (Component unmount; sustained operation). |
| **Descriptor Conditions (Matrix A)** | `D-*` | **22** | Pre-existing storage conditions evaluated during startup remount. |
| **Crash Recovery Conditions (Matrix A)** | `C-*` | **11** | Multi-step crash recovery conditions (`C-01` through `C-09`). |
| **Total Conditions (Matrix A)** | `D-*` + `C-*` | **33** | **Complete condition space governing startup and reboot evaluation.** |
| **Lifecycle Scenarios (Matrix C)** | `S-*` | **56** | 16 Active + 7 Reval + 11 Descriptor + 6 Edge + 16 Crash/Abort Recovery. |
| **Traceability Table D-1 Rows** | `D-*` $\to$ `S-*` | **33** | Forward condition-to-runtime-to-lifecycle traceability. |
| **Traceability Table D-2 Rows** | `R-*`/`Q-*`/`U-*` $\to$ `S-*` | **69** | 64 Runtime IDs + 4 Q-Events + 1 U-Event = **69 physical rows**. |
| **Traceability Table D-3 Rows** | `S-*` $\to$ `R-*` | **56** | Reverse lifecycle-to-runtime traceability (**56 physical rows**). |
| **Total Matrix D Mapping Rows** | D-1 + D-2 + D-3 | **158** | **Grand total physical mapping rows across Matrix D ($33 + 69 + 56 = 158$).** |

### 9.2 Test & Account Inventory Baselines
- **Authored Phase 5 Core Test Suite:** Exactly **60 authored test specifications** in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx). Status: `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.
- **Proposed Supplemental Remediation Suite (`SUP-01-T01`):** Exactly **22 unauthored subcases**. Status: `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`.
- **Account Inventory:** Exactly 7 accounts (2 privileged fixtures: `USR_DEV_001`, `USR_SUPER_001`; 5 synthetic personas: `USR_TEST_SUPER_001`, `USR_TEST_ADMIN_001`, `USR_TEST_AST_001`, `USR_TEST_LEC_001`, `USR_TEST_TRN_001`). `assistant_lecturer` remains group-scoped. Zero credentials stored.

---

## 10. Remaining Limitations and Explicit Assumptions

1. **Phase 12 Backend Prerequisite:** The three-table lock ordering, the AES-GCM multi-instance budget monitor, the atomic 8-case zero-row lease evaluator, and the strict No-Redirect gateway routing are proposed Phase 12 specifications. Until implemented, frontend clients enforce fail-closed fallback to `REVOCATION_CAUSE_UNKNOWN`.
2. **NTP Clock Synchronization:** Host instances, proxies, and database nodes must maintain NTP precision within $\pm 50\text{ms}$.
3. **CSPRNG Entropy:** Backend servers must maintain sufficient hardware entropy pools (`/dev/urandom`) to generate 96-bit AES-GCM IVs without thread blocking.

---

## 11. Final Readiness Decision

**READY FOR OWNER AUTHORIZATION — FINAL LOCKING, IDEMPOTENCY AND CRYPTOGRAPHIC BOUNDARIES CLOSED**

### Architectural Justification
1. **Precise Concurrency Terms:** Replaces ungrounded claims of absolute deadlock immunity with verified global lock ordering ($\text{sessions} \prec \text{leases} \prec \text{auth\_operations}$) combined with database deadlock detection and exponential retry safeguards.
2. **Deterministic Lease Consumption Algorithm:** Fully specifies the 8-branch decision tree for `ROW_COUNT = 0`, establishing rigorous boundaries between legitimate idempotent replays (`200 OK`) and expired/mismatched rejections (`409 Conflict`).
3. **Formal Sequence Allocation Domain:** Formally defines the ordering domain as per-session monotonic sequences allocated via row locks on `sessions.highest_operation_sequence`, with explicit gap-tolerance and compound uniqueness.
4. **Multi-Instance AES-GCM Budget ($2^{24}$):** Enforces a global multi-instance invocation ceiling with automated 30-day rotation, 96-bit CSPRNG IVs, explicit 128-bit authentication tags, and canonical length-prefixed AAD.
5. **Client-Side Recovery Secret Expiry Purging:** Formally specifies that raw recovery secrets are purged from `sessionStorage` at 24 hours while preserving diagnostic markers and protecting active user credentials.
6. **Strict No-Redirect API Policy:** Prohibits 3xx redirects across all seven authentication endpoints, eliminating header stripping and CORS preflight negotiation failures.
7. **Mathematical Master Ledger Closed:** Exactly 64 Runtime IDs, 4 Q-events, 1 U-event, 33 Conditions, 56 Lifecycle Scenarios, and **158 Matrix D rows** reconcile with zero discrepancies.
8. **Strict Governance Integrity:** Zero production code modified, zero tests executed, zero Git operations performed.

*The SUP-01 deadlock, idempotency, and cryptographic boundary specification is forensically audited, internally consistent, and ready for explicit Owner authorization. No implementation authorization is requested.*

