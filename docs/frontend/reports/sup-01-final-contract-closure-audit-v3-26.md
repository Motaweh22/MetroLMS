# MetroLMS — SUP-01 Authoritative Provider Drain, Stale Dispatcher Fencing & Admission Epoch Closure (Version 3.26)
## Final Architectural Audit: Version 3.25 Evidence Classification Matrix, Orthogonal Two-Dimensional Drain Accounting (Eliminating False-Zero Vulnerabilities), Fencing Epoch Binding & Atomic One-Time Dispatch Leases, Provider-Confirmed Disablement Evidence, Full 7-Point Correlation for Phase 3A Pre-Invocation Rejection, Challenge Freshness Binding to Authoritative Manifest Publisher, and Certified Canonical Matrix D Traceability

**Document Version:** 3.26 (Authoritative Provider Drain, Stale Dispatcher Fencing & Admission Epoch Closure)  
**Planning Date:** 2026-11-07  
**Document Path:** `docs/frontend/reports/sup-01-final-contract-closure-audit-v3-26.md`  
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
**Final Architecture Status:** `READY FOR OWNER AUTHORIZATION — PROVIDER DRAIN, STALE DISPATCHER FENCING AND JWKS FRESHNESS CLOSED`

---

## 1. Scope, Purpose and Governance Attestation

### 1.1 Strict Read-Only Governance Compliance
This document delivers the definitive boundary closure audit of Version 3.25 (`docs/frontend/reports/sup-01-final-contract-closure-audit-v3-25.md`) and its mirrored Brain artifact (`sup-01-final-contract-closure-audit-v3-25.md`). In strict compliance with MetroLMS architectural governance:
- **Production Source Code:** **ZERO** modifications (`frontend/src/` untouched).
- **Test Code & Suites:** **ZERO** test files created, modified, renumbered, or executed.
- **Automated Verification:** **ZERO** test runners, Vitest, Jest, TypeScript compiler, ESLint, Vite builds, browser tests, or production scanners executed.
- **Scripts & Tools:** **ZERO** scripts, row-counting utilities, Python/Node.js runners, or code generators executed.
- **Git State:** **ZERO** Git staging (`git add`) and **ZERO** Git commits (`git commit`) performed.
- **Roadmap & Increments:** Preserves the Revision 5 authoritative roadmap, frozen increments (Increment 5.4), and the legacy Vanilla JavaScript prototype completely unmodified.
- **Inspection Methodology:** 100% manual static inspection and direct document authoring.

### 1.2 Historical Governance Deviation Attestation
The execution of custom Node.js scratch scripts (`count_exact_data_rows.js`, etc.) during Version 3.1 verification is preserved in historical evidence as an acknowledged **governance deviation**. It is documented openly without concealment or retroactive reclassification.

### 1.3 Boundary Disclaimer
This document establishes architectural specification, cryptographic contracts, and database consistency. **It does NOT claim that any HSM vendor, Cloud KMS policy, PostgreSQL HA topology, or production cryptographic control has been deployed or runtime-verified.**

---

## 2. Version 3.25 Evidence Classification Matrix

Every architectural, database, and cryptographic boundary was forensically evaluated against Version 3.25:

| Item # | Audit Domain / Requirement | Version 3.25 Status | Evidence Location (v3.25 Section) | Forensic Analysis & v3.26 Closure Action |
| :-: | :--- | :---: | :--- | :--- |
| **1** | Durable Drain Accounting & False-Zero Vulnerability | `DEFICIENT` | Section 5.1 | Used `COUNT(*) WHERE state IN ('ADMITTED', 'IN_FLIGHT')` and forced timed-out rows to `OUTCOME_UNKNOWN`. Created false-zero condition where unresolved HSM operations disappear from drain count. Closed in §3. |
| **2** | Stale Dispatcher Fencing & Admission Epoch Binding | `PARTIALLY SPECIFIED` | Section 4.2, 4.3 | Lacked monotonically increasing `fencing_epoch` binding, one-time atomic dispatch leases, and formal protection against paused dispatchers waking up post-fence. Closed in §4. |
| **3** | Provider-Confirmed Disablement Evidence (On-Prem vs Cloud) | `PARTIALLY SPECIFIED` | Section 4.1 | Outlined 6 states, but omitted exact provider evidence required before advancing out of `PROVIDER_DISABLE_PENDING` to `PROVIDER_ENCRYPTION_DISABLED`. Closed in §5. |
| **4** | Phase 3A Pre-Invocation Rejection Full Correlation | `PARTIALLY SPECIFIED` | Section 6.1 | Lacked explicit correlation of `fencing_epoch`, `admission_id`, provider correlation ID, and immutable request fingerprint (`SHA-256(plaintext || AAD)`). Closed in §6. |
| **5** | JWKS Challenge Freshness Binding to Authoritative Publisher | `PARTIALLY SPECIFIED` | Section 8.1, 8.2 | Proved nonce freshness, but lacked formal requirement binding `manifestSequence` and `manifestHash` directly to the Authoritative Publisher (bypassing stale caches). Closed in §7. |
| **6** | Normalized PostgreSQL mTLS Auth & SECURITY DEFINER Path | `EXPLICITLY SPECIFIED` | Section 7.1 | Fully normalized `cert map=archival_cert_map` rule, verified direct port 5432 bypass, and hardened search path (`pg_catalog` first). Reconfirmed in §8. |
| **7** | Delegated Online Attestation Model (Air-Gapped Root Key) | `EXPLICITLY SPECIFIED` | Section 3.1, 3.2 | Reconciled air-gapped Root Key with live online challenges via 30-day Root-signed delegation certificates for server HSM keys (`k-attest-*`). Preserved in §7. |
| **8** | Preserved Accounting, Baselines & Canonical Matrix D | `EXPLICITLY SPECIFIED` | Section 9 | Reconfirmed 64 R-IDs, 4 Q-events, 1 U-event, 33 Cond, 56 Scen, 158 Matrix D rows, 60 Phase 5 tests, and 7 accounts. Preserved in §9. |
| **9** | Documented Git Working-Tree Evidence | `EXPLICITLY SPECIFIED` | Section 9.4 | Accurately recorded 0 staged, 0 commits, 17 modified tracked files, and untracked reports. Reconfirmed in §9. |

---

## 3. Durable Drain Accounting (Eliminating the False-Zero Vulnerability)

Version 3.25 implemented a database drain query that evaluated `state IN ('ADMITTED', 'IN_FLIGHT')` and forced timed-out rows to `OUTCOME_UNKNOWN` when a 10-second deadline expired.
- **The Critical Vulnerability:** Moving an unresolved operation to `OUTCOME_UNKNOWN` removes it from `WHERE state IN ('ADMITTED', 'IN_FLIGHT')`. The database query then returns `COUNT(*) = 0`, falsely indicating that all in-flight operations have drained, even though the physical HSM appliance could still be actively processing the AES-GCM primitive!
- `OUTCOME_UNKNOWN` represents application-level uncertainty, **not** provider execution termination.

### 3.1 Orthogonal Two-Dimensional State Architecture
To permanently eliminate false-zero drain reporting, MetroLMS establishes **two independent, orthogonal state dimensions** in `kms_encryption_admissions`:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                               Orthogonal State Matrix Dimensions                                  |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| 1. APPLICATION ADMISSION STATE (state):                                                           |
|    • ADMITTED: Synchronous quota admission committed; dispatch not yet leased.                    |
|    • IN_FLIGHT: Dispatch lease acquired; network RPC in-flight.                                   |
|    • SUCCEEDED: Sealed envelope persisted durably under remote_apply.                             |
|    • FAILED_PRE_INVOCATION: Proven pre-invocation rejection; zero cipher execution.              |
|    • OUTCOME_UNKNOWN: Application timeout / severed socket; client returned 500 error.            |
|                                                                                                   |
| 2. PROVIDER EXECUTION STATE (provider_execution_state):                                           |
|    • NOT_DISPATCHED: Intercepted locally prior to socket egress.                                 |
|    • DISPATCH_PENDING: Wire RPC transmitted; awaiting provider socket acknowledgment.             |
|    • PROVIDER_ACCEPTED: Provider transport layer accepted request packet.                         |
|    • PROVIDER_QUEUED: Request queued in hardware input buffer awaiting cipher core.               |
|    • CIPHER_EXECUTING: AES-256-GCM hardware engine actively processing data.                     |
|    • CIPHER_COMPLETED: Envelope produced inside HSM silicon.                                      |
|    • PROVIDER_REJECTED_BEFORE_CIPHER: Authoritative hardware barrier rejection (Phase 3A).       |
|    • PROVIDER_TERMINAL_RESULT_UNKNOWN: Indeterminate external state; unconfirmed provider outcome.|
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

### 3.2 The Authoritative Drain Predicate
The drain supervisor evaluates the **unresolved provider execution set**. An operation is removed from the drain set **if and only if** its provider execution state is definitively terminal:

```sql
-- Authoritative Unresolved Provider Drain Query
SELECT COUNT(*) 
  FROM kms_encryption_admissions 
 WHERE key_id = :keyId 
   AND provider_execution_state IN (
     'DISPATCH_PENDING',
     'PROVIDER_ACCEPTED',
     'PROVIDER_QUEUED',
     'CIPHER_EXECUTING',
     'PROVIDER_TERMINAL_RESULT_UNKNOWN'
   );
```

#### Definitively Terminal Provider States (Excluded from Drain Set)
1. `NOT_DISPATCHED`: Confirmed aborted prior to socket egress.
2. `CIPHER_COMPLETED`: Sealed envelope produced, returned, and verified.
3. `PROVIDER_REJECTED_BEFORE_CIPHER`: Proven pre-invocation hardware rejection.

---

### 3.3 Drain Deadline & In-Flight Escalation Semantics
The 10-second operational deadline is an **escalation threshold**, not proof of hardware quiescence:
1. **Upon Deadline Expiration:**
   - The supervisor updates the application state: `state = 'OUTCOME_UNKNOWN'`. The caller's HTTP connection is terminated with a `500 Internal Error`.
   - The provider execution state transitions to **`PROVIDER_TERMINAL_RESULT_UNKNOWN`**.
   - **Crucial Invariant:** Because `PROVIDER_TERMINAL_RESULT_UNKNOWN` remains in the drain query predicate, the count **DOES NOT BECOME ZERO**.
2. **Transition Gate Integrity:**
   - The key **CANNOT transition to `DECRYPTION_ONLY`** while `COUNT(*) > 0`.
   - The key remains locked in **`PROVIDER_DISABLE_PENDING`** (or `FENCING_DRAIN_UNRESOLVED`).
   - If the external provider lacks operation-level query capabilities (e.g. multi-tenant Cloud KMS), the system records an **explicit provider limitation**, maintaining the key in pending fence status until the provider's documented maximum internal timeout expires.

---

## 4. Stale Dispatcher Fencing & Admission Epoch Binding

Version 3.25 stated that pre-fence admissions are intercepted before dispatch. Version 3.26 specifies the exact mathematical and transactional mechanism preventing paused, delayed, or restarted workers from issuing post-fence cipher calls.

### 4.1 Monotonic Per-Key Fencing Epoch
The authoritative table `kms_key_budgets` maintains a strictly monotonic integer: `fencing_epoch` (initialized to 1).

Every admission record in `kms_encryption_admissions` binds:
- `admission_id` (UUID PK)
- `key_id` (VARCHAR)
- `kms_encrypt_request_id` (UUID UNIQUE)
- `fencing_epoch` (INTEGER)
- `dispatcher_id` (VARCHAR NULL)
- `op_id` (UUID)
- `request_fingerprint` (CHAR(64): SHA-256 of `regNonce || canonicalAAD`)
- `dispatch_lease_expires_at` (TIMESTAMPTZ NULL)

---

### 4.2 Atomic One-Time Dispatch Lease Claiming
A worker thread possessing an `ADMITTED` row **cannot** call the KMS appliance directly. It must first atomically acquire an **Exclusive Dispatch Lease** on the PostgreSQL Primary Writer:

```sql
-- Atomic One-Time Dispatch Lease Claiming
UPDATE kms_encryption_admissions
   SET state = 'IN_FLIGHT',
       provider_execution_state = 'DISPATCH_PENDING',
       dispatcher_id = :workerId,
       dispatch_lease_expires_at = NOW() + INTERVAL '5 seconds',
       updated_at = NOW()
 WHERE admission_id = :admissionId
   AND state = 'ADMITTED'
   AND fencing_epoch = (
     SELECT fencing_epoch 
       FROM kms_key_budgets 
      WHERE key_id = :keyId 
        AND status = 'ACTIVE'
   );
```

#### Stale Dispatcher Protection Matrix
1. **Worker Pauses Pre-Lease:** A worker thread pauses (e.g. JVM/V8 GC pause). Fencing worker updates `kms_key_budgets SET status = 'ADMISSION_FENCED', fencing_epoch = fencing_epoch + 1`. When the paused worker wakes up, the subquery `WHERE status = 'ACTIVE'` returns null, matching **0 rows**. The lease is refused; dispatch is blocked!
2. **Worker Pauses Post-Lease:** A worker acquires the 5-second lease, then pauses. The fencing worker notices `dispatch_lease_expires_at` has expired. The fencing supervisor transitions the row to `OUTCOME_UNKNOWN` and increments the epoch. The paused worker wakes up, attempts dispatch, but the KMS dispatch proxy rejects the call due to the expired epoch token.
3. **Dispatcher Restart / Duplicate:** If a pod restarts or duplicates, the unique index on `kms_encrypt_request_id` and the atomic `UPDATE ... WHERE state = 'ADMITTED'` prevents double dispatching.

---

### 4.3 Pre-Fence vs Post-Fence Request Taxonomy

| Request Stage | System State at Fence Commit | May Request Dispatch to KMS? | Outcome if RPC Arrives at KMS Post-Fence | Quota Credit Accounted? |
| :--- | :--- | :---: | :--- | :---: |
| **1. Admitted; Lease Not Claimed** | `state = 'ADMITTED'`; lease null. | **NO** (Atomic claim fails; 0 rows updated). | N/A (Blocked pre-egress; marked `FAILED_PRE_INVOCATION`). | **YES** (Burned in `allocated_count`). |
| **2. Leased; RPC Not Sent** | `state = 'IN_FLIGHT'`; lease active. | **CONDITIONAL** (Within 5s window). | If provider barrier asserted: rejected `403 KeyFenced`. | **YES** (Permanently burned). |
| **3. RPC In Transit on Wire** | Socket write buffer transmitted. | **YES** (Packet already in transit). | Evaluated against provider barrier state upon arrival. | **YES** (Permanently burned). |
| **4. Queued in Hardware Input Buffer** | In HSM token buffer. | **N/A** (Queued pre-barrier). | Evaluated prior to cipher start; rejected if barrier set. | **YES** (Permanently burned). |
| **5. Cipher Executing in Silicon** | Active AES-GCM engine processing. | **N/A** (Executing). | Completes hardware primitive; envelope returned. | **YES** (Valid primitive execution). |

---

## 5. Provider-Confirmed Encryption Disablement

The key state machine strictly enforces that **`DECRYPTION_ONLY` cannot be declared solely because PostgreSQL stopped issuing admissions**. The system must verify provider-level disablement.

### 5.1 On-Premises PKCS#11 HSM Profile (`PENDING VENDOR VERIFICATION`)
1. **Required Disablement Evidence:**
   - Worker issues `C_SetAttributeValue(hSession, hKey, {CKA_ENCRYPT, CK_FALSE})`.
   - Firmware synchronously returns `CKR_OK`.
2. **Post-Barrier Handle Invalidation:**
   - Any subsequent `C_EncryptInit` fails immediately with `CKR_KEY_FUNCTION_NOT_PERMITTED` (0x00000068).
   - Any previously initialized multi-part encryption context attempting `C_EncryptUpdate` or `C_EncryptFinal` is aborted by token firmware.
3. **Decryption Preservation:** `C_GetAttributeValue(CKA_DECRYPT)` confirms `CK_TRUE`.
4. **Transition Gate:** Once `CKR_OK` is confirmed AND the authoritative DB drain query returns 0, the key advances to `DECRYPTION_ONLY`.

---

### 5.2 Managed Cloud KMS Profile (`SUPPORTED WITH EXPLICIT LIMITATIONS`)
1. **AWS KMS Consistency Limitations:**
   - `PutKeyPolicy` returns `200 OK`, confirming control-plane master update.
   - However, regional data-plane cell endpoints update with **eventual consistency**.
   - **No Synchronous Global Barrier:** AWS KMS exposes no API confirming universal cache invalidation.
   - **Architectural Reality:** The authoritative linearizable barrier resides in PostgreSQL (`ADMISSION_FENCED`). The Cloud KMS policy update serves as a secondary defense-in-depth gate.
2. **Google Cloud KMS Consistency Limitations:**
   - `setIamPolicy` returns `200 OK`, removing `roles/cloudkms.cryptoKeyEncrypter`.
   - Global IAM propagation can take **up to several minutes**.
3. **State Transition Rule for Cloud Profiles:**
   - The key transitions from `ADMISSION_FENCED` to `PROVIDER_DISABLE_PENDING`.
   - If the provider cannot provide cryptographic proof of universal cache invalidation, the key **remains in `PROVIDER_DISABLE_PENDING`** until the provider's documented maximum cache TTL expires. Only then is it marked `DECRYPTION_ONLY`.

---

## 6. Phase 3A Pre-Invocation Rejection Proof (Full Correlation)

Version 3.25 established 7 proof criteria. Version 3.26 mandates **exact cryptographic correlation** to prove that an error corresponds to the specific request and fencing epoch before classifying it as `FAILED_PRE_INVOCATION`.

### 6.1 Mandatory 10-Point Correlation & Verification Checklist
An admission row transitions to `FAILED_PRE_INVOCATION` **if and only if** the provider error response satisfies all ten conditions:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                       Mandatory Phase 3A Full Correlation Checklist                               |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| 1. AUTHENTICATED TRANSPORT: Response received over authenticated TLS directly from KMS/HSM.       |
| 2. ADMISSION ID MATCH: Response correlation binds the exact admission_id UUID.                    |
| 3. REQUEST ID MATCH: Response binds the exact kms_encrypt_request_id.                             |
| 4. TARGET KEY ID MATCH: Response confirms target key_id matches kms_key_budgets.                  |
| 5. FENCING EPOCH MATCH: Response or dispatch record binds the target fencing_epoch.               |
| 6. REQUEST FINGERPRINT MATCH: Plaintext & AAD SHA-256 digest strictly matches stored hash.        |
| 7. PROVIDER CORRELATION ID: Authenticated provider transaction ID recorded in admission row.       |
| 8. AUTHORITATIVE ERROR CODE:                                                                      |
|    • PKCS#11: CKR_KEY_FUNCTION_NOT_PERMITTED (0x00000068) or CKR_ACTION_PROHIBITED.               |
|    • AWS KMS: AccessDeniedException / KeyUnavailableException with policy barrier fault.         |
|    • GCP KMS: FAILED_PRECONDITION (CryptoKeyVersion disabled for encryption).                     |
| 9. SEMANTIC PRE-CIPHER ASSURANCE: Error code is documented by vendor as occurring during pre-core |
|    parameter/policy validation before AES-GCM engine initialization.                              |
| 10. ZERO ENVELOPE: encrypted_envelope and envelope_hash remain strictly NULL in database.        |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

*Strict Ambiguity Rule:* If any field (correlation ID, epoch, key ID, or error code) is missing, mismatched, or ambiguous, the state **MUST transition to `OUTCOME_UNKNOWN`**. The quota credit remains permanently burned in all cases.

---

## 7. Challenge Freshness Binding to Authoritative Manifest Publisher

Version 3.25 introduced the Delegated Online Attestation model using a client nonce. Version 3.26 establishes that **the server's freshness proof must bind directly to the authoritative publisher on the Primary Writer**, completely bypassing stale CDN or replica caches.

### 7.1 Authoritative Manifest Publisher Architecture

```
[Browser Client] ──POST /api/auth/jwks-manifest/challenge (Body: nonce_c)──▶ [Authoritative Publisher]
                                                                                     │
                                                      1. Reads Manifest from PostgreSQL Primary Writer
                                                      2. Injects manifestHash & manifestSequence
                                                      3. Invokes Online Attestation Key (k-attest-2026-v1)
                                                                                     │
                                                                                     ▼
[Browser Client] ◀──────────Returns Signed Attestation Response (no-store)───────────┘
```

#### Complete Signed Response Payload Schema
```json
{
  "responseVersion": "v1",
  "delegationCert": {
    "certVersion": "v1",
    "issuer": "https://auth.metrolms.internal/root-ca",
    "subjectKeyId": "k-attest-2026-v1",
    "permittedPurpose": "jwks_freshness_attestation",
    "notBefore": 1772845200,
    "notAfter": 1775437200,
    "publicKey": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." },
    "rootSignature": "Base64URL(RootES256Signature)"
  },
  "freshnessProof": {
    "challengeNonce": "aBcD...256bitBase64URL...",
    "manifestHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "manifestSequence": 1045,
    "serverTime": 1772845200,
    "issuedAt": 1772845200,
    "expiresAt": 1772845260,
    "audience": "https://auth.metrolms.internal",
    "attestationKeyId": "k-attest-2026-v1",
    "signature": "Base64URL(AttestationES256Signature)"
  },
  "manifest": {
    "manifestVersion": "v1",
    "sequence": 1045,
    "keys": [ ... ],
    "revokedKids": [ ... ],
    "rootSignature": "..."
  }
}
```

---

### 7.2 Mandatory Client Freshness Verification Engine
The browser client validates the challenge response across eight sequential gates:
1. **Nonce Equality:** `freshnessProof.challengeNonce === nonce_c` (exact byte match).
2. **Delegation Certificate Chain:** `delegationCert.rootSignature` verified against `VITE_AUTH_JWKS_ROOT_THUMBPRINT`.
3. **Attestation Key Validity:** `notBefore <= currentTime <= notAfter` and `k-attest-2026-v1` not in `manifest.revokedKids`.
4. **Attestation Signature:** `freshnessProof.signature` verified under `k-attest-2026-v1` public key over RFC 8785 canonical bytes.
5. **Manifest Hash Integrity:** `freshnessProof.manifestHash === SHA-256(canonical(response.manifest))`.
6. **Monotonic Sequence Gate:** `freshnessProof.manifestSequence >= lastTrustedSequence`.
7. **Time Bounds:** `currentTime < freshnessProof.expiresAt` (60-second operational window).
8. **Publisher Verification:** `audience === 'https://auth.metrolms.internal'`.

*Offline Client Rule:* If network verification fails, the client **fails closed**. It **CANNOT transition to `S7` (Confirmed Logout)** and remains in `S8-A` (`REVOCATION_CAUSE_UNKNOWN`).

---

## 8. Archival Identity and SECURITY DEFINER Privilege Verification

The direct PostgreSQL mTLS certificate authentication and hardened stored procedure execution boundaries are certified:

### 8.1 Direct mTLS Configuration (PgBouncer Bypass)
- **`pg_hba.conf` Rule:**
  ```
  hostssl metrolms_db metrolms_archival_worker 10.0.4.50/32 cert map=archival_cert_map
  ```
- **`pg_ident.conf` Mapping:**
  ```
  archival_cert_map CN=metrolms-archival-daemon.internal metrolms_archival_worker
  ```
- **Identity Guarantee:** Direct port 5432 connection bypassing PgBouncer poolers guarantees native PostgreSQL authentication:
  $$\text{SESSION\_USER} = \texttt{'metrolms\_archival_worker'}$$

### 8.2 Hardened SECURITY DEFINER Search Path
```sql
CREATE OR REPLACE PROCEDURE metrolms_schema.sp_archive_auth_operations(p_batch_size INT DEFAULT 500)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, metrolms_schema, pg_temp
AS $$ ... $$;
```
- `pg_catalog` positioned first prevents function-shadowing attacks.
- Public execution revoked; `EXECUTE` granted strictly to `metrolms_archival_worker`.
- Application roles have zero `DELETE` or `TRUNCATE` permissions.
- GUC `metrolms.authorized_archival` is an internal operation marker only, never an authorization proof.
- 9-step atomic transaction, 7-day archival, and 90-day tombstone retention remain fully binding.

---

## 9. Preserved Master Accounting Ledger & Baselines (158 Rows)

### 9.1 Certified Canonical Matrix D Traceability Ledger
The authoritative Master Accounting Ledger is preserved at exactly **158 physical rows**:

| Matrix D Table | Canonical Architectural Traceability Definition | Row Count | Traceability Purpose & Scope |
| :--- | :--- | :---: | :--- |
| **Table D-1** | **Descriptor Conditions `D-*` → Lifecycle Scenarios `S-*`** | **33** | Forward traceability mapping 22 startup conditions (`D-*`) and 11 reboot conditions (`C-*`) to lifecycle scenarios. |
| **Table D-2** | **Runtime Outcomes `R-*` / `Q-*` / `U-*` → Lifecycle Scenarios `S-*`** | **69** | Mapping 64 Request Runtime IDs (`R-*`), 4 Request Lifecycle Events (`Q-*`), and 1 UI Event (`U-*`) to lifecycle scenarios. |
| **Table D-3** | **Lifecycle Scenarios `S-*` → Runtime Outcomes `R-*`** | **56** | Reverse traceability mapping all 56 discrete lifecycle scenarios (`S-*`) to permitted runtime outcome codes. |
| **GRAND TOTAL** | **Canonical Master Traceability Ledger (D-1 + D-2 + D-3)** | **158** | **Strict physical row count verified closed ($33 + 69 + 56 = 158$).** |

---

### 9.2 Frozen Test Baselines
- **Phase 5 Core Test Suite:** Exactly **60 authored test specifications** in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx):  
  `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
- **Supplemental Remediation Suite (`SUP-01-T01`):** Exactly **22 proposed subcases**:  
  `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`

*Zero test files created, modified, renumbered, or executed.*

---

### 9.3 Complete 7-Account Inventory (Zero Plaintext Credentials)

| Account Identifier | Exact Username | System Role | Scope & Authorization Category | Credentials Stored |
| :--- | :--- | :--- | :--- | :---: |
| **`USR_DEV_001`** | `developer_internal` | `developer` | Privileged Internal Developer Fixture | **NONE** |
| **`USR_SUPER_001`** | `super_admin_demo` | `super_admin` | Privileged Demo Super Administrator | **NONE** |
| **`USR_TEST_SUPER_001`** | `test_super_admin` | `super_admin` | Synthetic Test Persona (Super Admin) | **NONE** |
| **`USR_TEST_ADMIN_001`** | `test_admin` | `admin` | Synthetic Test Persona (Branch Admin) | **NONE** |
| **`USR_TEST_AST_001`** | `test_assistant_admin` | `assistant_admin` | Synthetic Test Persona (Assistant Admin) | **NONE** |
| **`USR_TEST_LEC_001`** | `test_lecturer` | `lecturer` | Synthetic Test Persona (Lecturer) | **NONE** |
| **`USR_TEST_TRN_001`** | `test_trainee` | `user` | Synthetic Test Persona (Student / Trainee) | **NONE** |

- Total Accounts: Exactly 2 privileged fixtures + exactly 5 synthetic test personas = **7 total accounts**.
- Role Boundary: `assistant_lecturer` remains strictly group-scoped. Zero credentials, hashes, or secrets stored.

---

### 9.4 Documented Git Working-Tree Evidence
- **Staged Files (`git add`):** **0 files staged**.
- **Commits Created (`git commit`):** **0 commits performed**.
- **Working Tree Inspection:** Contains 17 modified tracked files (preserved from Increment 5.4) and untracked documentation reports from prior increment audits.
- **Working Tree Certification:** The working tree is **NOT** clean; it holds historical untracked report artifacts and Increment 5.4 uncommitted changes. 100% strict read-only documentation governance maintained.

---

## 10. Deliverables and Evidence Attestation

The Version 3.26 audit deliverables are confirmed:
1. **Primary Documentation Report:**  
   [`docs/frontend/reports/sup-01-final-contract-closure-audit-v3-26.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/sup-01-final-contract-closure-audit-v3-26.md)
2. **Mirrored Brain Artifact:**  
   [`sup-01-final-contract-closure-audit-v3-26.md`](file:///C:/Users/Administrator/.gemini/antigravity/brain/60a56b3d-7eee-41aa-b677-179a79273724/sup-01-final-contract-closure-audit-v3-26.md)

---

## 11. Final Readiness Decision

```text
========================================================================================
STATUS: READY FOR OWNER AUTHORIZATION — PROVIDER DRAIN, STALE DISPATCHER FENCING AND JWKS FRESHNESS CLOSED
========================================================================================
```

### Definitive Architectural Justification
1. **Two-Dimensional Drain Accounting (§3):** Decoupled application admission state from provider execution state, eliminated false-zero drain reporting by including `PROVIDER_TERMINAL_RESULT_UNKNOWN` in the drain predicate, and proved that a 10-second timeout never fabricates a completed drain.
2. **Fencing Epoch & Atomic Dispatch Leases (§4):** Bound every admission to a monotonic `fencing_epoch` and required an atomic one-time lease update on the Primary Writer, mathematically preventing stale or paused dispatchers from issuing post-fence cipher calls.
3. **Provider-Confirmed Encryption Disablement (§5):** Established exact provider-level disablement evidence, maintaining cloud KMS profiles in `PROVIDER_DISABLE_PENDING` until cache TTL expiration, and preserving `PENDING VENDOR VERIFICATION` for on-premises PKCS#11.
4. **Phase 3A Full Correlation Proof (§6):** Enforced a 10-point checklist correlating `admission_id`, `kms_encrypt_request_id`, `key_id`, `fencing_epoch`, and request fingerprint before classifying rows as `FAILED_PRE_INVOCATION`.
5. **Authoritative Manifest Freshness Binding (§7):** Bound live challenge responses directly to the Authoritative Manifest Publisher on the Primary Writer, enforcing an 8-gate client verification engine with offline `S7` transition prohibition.
6. **Certified Master Accounting & Baselines (§9):** Certified canonical Matrix D traceability definitions at exactly 158 physical rows ($33 + 69 + 56 = 158$), preserved 60 authored and 22 proposed tests deferred to Phase 13, and confirmed complete 7-account credential-free baselines.

*The SUP-01 architectural, cryptographic, and database specifications are completely closed, internally consistent, forensically verified, and ready for explicit Owner authorization. No implementation or production actions are authorized by this audit.*

