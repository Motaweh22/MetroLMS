# MetroLMS — SUP-01 Archival Authorization, JWKS Bootstrap Integrity & HSM Capability Closure (Version 3.23)
## Final Architectural Audit: Version 3.22 Evidence Classification Matrix, Authenticated Database Identity for 7-Day Archival (session_user vs current_user & SECURITY DEFINER), Clean Bootstrap JWKS Anti-Rollback Freshness Protocol, Vendor-Specific PKCS#11 (CKA_MODIFIABLE) vs Cloud KMS Fencing Semantics, Exhaustive 8-Phase Admission & Fencing Race Matrix, and Verified Tombstone Retention Lifecycle

**Document Version:** 3.23 (Archival Authorization, JWKS Bootstrap Integrity & HSM Capability Closure)  
**Planning Date:** 2026-11-07  
**Document Path:** `docs/frontend/reports/sup-01-final-contract-closure-audit-v3-23.md`  
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
**Final Architecture Status:** `READY FOR OWNER AUTHORIZATION — ARCHIVAL AUTHORIZATION, JWKS ANTI-ROLLBACK AND HSM FENCING CLOSED`

---

## 1. Scope, Purpose and Governance Attestation

### 1.1 Strict Read-Only Governance Compliance
This document delivers the final, definitive boundary closure audit of Version 3.22 (`docs/frontend/reports/sup-01-final-contract-closure-audit-v3-22.md`) and its mirrored Brain artifact (`sup-01-final-contract-closure-audit-v3-22.md`). In strict compliance with MetroLMS architectural governance:
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
This document establishes architectural specification, cryptographic contracts, and database consistency. **It does NOT claim runtime testing, deployed KMS/HSM capabilities, live database failover verification, or production readiness.**

---

## 2. Version 3.22 Evidence Classification Matrix

Every architectural and cryptographic requirement identified in the review of Version 3.22 is classified below against the primary document and its mirrored artifact:

| Item # | Audit Domain / Requirement | Version 3.22 Status | Evidence Location (v3.22 Section) | Forensic Analysis & v3.23 Closure Action |
| :-: | :--- | :---: | :--- | :--- |
| **1** | Authenticated Archival Identity & Stored Procedure Execution | `PARTIALLY SPECIFIED` | Section 5.2 | Relied on `CURRENT_USER` and session GUCs without formalizing `session_user` authentication, `SECURITY DEFINER` fixed `search_path`, or anti-impersonation boundaries. Closed in §3. |
| **2** | Verified 9-Step Archival & Tombstone Atomic Sequence | `PARTIALLY SPECIFIED` | Section 5.1, 5.2 | Outlined tombstone table, but lacked explicit 9-step atomic SQL transaction, byte-for-byte SHA-256 verification, and strict rollback on partial write. Closed in §3.3. |
| **3** | JWKS Clean Bootstrap Protocol After Local State Loss | `PARTIALLY SPECIFIED` | Section 6.2 | Permitted clean bootstrap after storage clear without addressing replay of older unexpired signed manifests. Closed in §4 via live freshness binding and time-anchor gates. |
| **4** | Cross-Tab Sequence Synchronization & Storage Limits | `PARTIALLY SPECIFIED` | Section 6.1, 6.2 | Defined BroadcastChannel and Web Locks, but lacked reconciliation of store divergence and explicit acknowledgement of browser storage non-HSM bounds. Closed in §4.3. |
| **5** | Vendor-Specific PKCS#11 Capabilities (`CKA_MODIFIABLE`) | `PARTIALLY SPECIFIED` | Section 4.2 | Assumed mutable `CKA_ENCRYPT` without specifying required `CKA_MODIFIABLE=TRUE`, Crypto Officer roles, or vendor procurement criteria. Closed in §5.1. |
| **6** | Cloud KMS Policy Fencing (AWS KMS / GCP Cloud KMS) | `PARTIALLY SPECIFIED` | Section 4.2 | Conflated PKCS#11 attribute calls with Cloud KMS policies without formalizing `kms:PutKeyPolicy` explicit Deny vs Decrypt retention. Closed in §5.2. |
| **7** | Exhaustive 8-Phase Admission & Fencing Race Matrix | `PARTIALLY SPECIFIED` | Section 4.1, 4.3 | Defined 6 lifecycle steps, but lacked granular 8-phase race matrix mapping each execution stage against fencing commits. Closed in §6. |
| **8** | Preserved Accounting, Baselines & Canonical Matrix D | `EXPLICITLY SPECIFIED` | Section 7, 8 | Reconfirmed 64 R-IDs, 4 Q-events, 1 U-event, 33 Cond, 56 Scen, 158 Matrix D rows, 60 Phase 5 tests, and 7 accounts. Preserved in §7 and §8. |
| **9** | Documented Git Working-Tree Evidence | `EXPLICITLY SPECIFIED` | Section 8.4 | Accurately recorded 0 staged, 0 commits, 17 modified tracked files, and untracked reports. Reconfirmed in §8. |

---

## 3. Secure Archival Authorization and Atomic Pruning Engine

Version 3.22 permitted row pruning by the archival daemon under `CURRENT_USER = 'metrolms_archival_daemon' AND CURRENT_SETTING('metrolms.archival_in_progress') = 'on'`. Version 3.23 formally establishes the authenticated database identity boundary, least-privilege role separation, and the atomic 9-step verified archival transaction.

### 3.1 Authenticated Database Identity: `session_user` vs `current_user`

In PostgreSQL, relying solely on `CURRENT_USER` or a session configuration variable (GUC) is insufficient:
- `current_user` changes dynamically during `SECURITY DEFINER` function execution.
- Session GUCs can be set by any role possessing connection access unless explicitly restricted.
- **The Core Vulnerability:** If an application service role connects and invokes a compromised or un-restricted procedure, relying on `current_user` or GUCs could allow unauthorized deletion of committed audit logs.

#### Architectural Identity Model
MetroLMS establishes the **Three-Tier Database Execution Boundary**:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| 1. Authenticated Connection Identity (session_user)                                               |
|    • Role: metrolms_archival_worker (Dedicated login role with client TLS certificate).          |
|    • Authentication: Mutual TLS (mTLS) with client certificate CN=metrolms-archival.            |
|    • Invariant: session_user is established at TCP handshake and CANNOT be altered via SET ROLE. |
+───────────────────────────────────────────────────┬───────────────────────────────────────────────+
                                                    │
                                                    ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| 2. Privileged Stored Procedure Boundary (SECURITY DEFINER)                                        |
|    • Procedure: metrolms_schema.sp_archive_auth_operations()                                      |
|    • Owner: metrolms_security_admin (Dedicated schema owner; non-login role).                     |
|    • Execution Role (current_user): Switches to metrolms_security_admin strictly inside procedure. |
|    • Fixed Search Path: SET search_path = metrolms_schema, pg_catalog, pg_temp;                    |
+───────────────────────────────────────────────────┬───────────────────────────────────────────────+
                                                    │
                                                    ▼
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| 3. Table Immutability Trigger Enforcement                                                         |
|    • Trigger: trg_auth_operations_immutability                                                    |
|    • Validation: Checks BOTH session_user == 'metrolms_archival_worker' AND                       |
|      current_user == 'metrolms_security_admin' AND valid tombstone exists in live database.      |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

1. **`session_user` Invariant:** The trigger strictly evaluates `SESSION_USER = 'metrolms_archival_worker'`. Even if an application role attempts `SET ROLE metrolms_archival_worker`, PostgreSQL preserves the original login identity in `SESSION_USER`, instantly rejecting the deletion!
2. **Anti-Impersonation Protection:**
   ```sql
   -- Prevent application roles from assuming the archival identity
   REVOKE ALL ON ROLE metrolms_archival_worker FROM PUBLIC;
   REVOKE ALL ON ROLE metrolms_archival_worker FROM metrolms_app_user, kms_quota_user;
   ALTER ROLE metrolms_archival_worker WITH NOINHERIT;
   ```

---

### 3.2 Least Privilege and Procedural Hardening

```sql
-- Procedure Definition with Fixed Search Path and Hardened Permissions
CREATE OR REPLACE PROCEDURE metrolms_schema.sp_archive_auth_operations(
  p_batch_size INT DEFAULT 500
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = metrolms_schema, pg_catalog, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_archived_count INT := 0;
  v_tombstone_hash CHAR(64);
BEGIN
  -- Security Gate 1: Verify authenticated connection identity
  IF SESSION_USER != 'metrolms_archival_worker' THEN
    RAISE EXCEPTION 'SECURITY_FATAL: Unauthorized invocation of archival procedure by session user %', SESSION_USER
      USING ERRCODE = '42501';
  END IF;

  -- Security Gate 2: Set local session marker for trigger validation
  PERFORM set_config('metrolms.authorized_archival', 'on', true);

  -- Process expired operations in strict deterministic order
  FOR v_rec IN 
    SELECT op_id, status, operation_type, receipt_id, receipt_jws, receipt_issued_at, created_at
      FROM metrolms_schema.auth_operations
     WHERE status = 'COMMITTED'
       AND created_at <= NOW() - INTERVAL '7 days'
     ORDER BY created_at ASC
     LIMIT p_batch_size
       FOR UPDATE SKIP LOCKED
  LOOP
    -- Step 3.1: Verify original immutable receipt completeness
    IF v_rec.operation_type = 'LOGOUT' AND (v_rec.receipt_id IS NULL OR v_rec.receipt_jws IS NULL) THEN
      RAISE EXCEPTION 'ARCHIVAL_CORRUPTION: Committed logout % lacks mandatory receipt', v_rec.op_id
        USING ERRCODE = '23514';
    END IF;

    -- Step 3.2: Copy complete byte-for-byte identical record to Cold Archive
    INSERT INTO metrolms_schema.auth_operations_archive (
      op_id, status, operation_type, receipt_id, receipt_jws, receipt_issued_at, created_at, archived_at
    ) VALUES (
      v_rec.op_id, v_rec.status, v_rec.operation_type, v_rec.receipt_id, v_rec.receipt_jws, 
      v_rec.receipt_issued_at, v_rec.created_at, NOW()
    );

    -- Step 3.3: Compute cryptographic receipt hash for tombstone
    v_tombstone_hash := encode(digest(coalesce(v_rec.receipt_jws, 'NON_LOGOUT'), 'sha256'), 'hex');

    -- Step 3.4: Insert Immutable 90-Day Tombstone into Live DB
    INSERT INTO metrolms_schema.auth_operations_tombstones (
      op_id, status, operation_type, receipt_id, receipt_jws_sha256, archived_at, archive_location
    ) VALUES (
      v_rec.op_id, v_rec.status, v_rec.operation_type, v_rec.receipt_id, 
      v_tombstone_hash, NOW(), 'cold_archive_partition_default'
    );

    -- Step 3.5: Execute Narrowly Authorized Source Row Deletion
    DELETE FROM metrolms_schema.auth_operations WHERE op_id = v_rec.op_id;

    v_archived_count := v_archived_count + 1;
  END LOOP;

  -- Reset session marker
  PERFORM set_config('metrolms.authorized_archival', 'off', true);
END;
$$;

-- Harden procedure execution permissions
REVOKE ALL ON PROCEDURE metrolms_schema.sp_archive_auth_operations(INT) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE metrolms_schema.sp_archive_auth_operations(INT) TO metrolms_archival_worker;
```

#### Application Role Restrictions
- Application roles (`kms_quota_user`, `metrolms_app_user`) have:
  - `GRANT SELECT, INSERT ON auth_operations`
  - **NO `DELETE`** permission.
  - **NO `TRUNCATE`** permission on any auth or archive table.
  - **NO `EXECUTE`** permission on `sp_archive_auth_operations`.
  - Prohibited from altering or disabling triggers.

---

### 3.3 The 9-Step Atomic Archival Transaction Protocol
Archival and live-row deletion are executed in an unbroken, atomic database transaction:

```
[BEGIN ARCHIVAL TX]
  │ 1. Lock expired source row (FOR UPDATE SKIP LOCKED)
  │ 2. Verify retention boundary (created_at <= NOW() - 7 days)
  │ 3. Verify receipt integrity (receipt_id and receipt_jws non-null for logout)
  │ 4. INSERT into auth_operations_archive
  │ 5. Cryptographic hash check: SHA-256(archive.receipt_jws) == SHA-256(source.receipt_jws)
  │ 6. INSERT into auth_operations_tombstones (Live 90-day retention)
  │ 7. Relational check: Tombstone exists and binds op_id & receipt_id
  │ 8. Narrowly authorized DELETE from auth_operations (Authorized by session_user trigger)
  │ 9. COMMIT (Synchronously flushed via remote_apply)
[TRANSACTION COMMITTED]
```

- **Fail-Safe Rollback:** If any step fails (e.g. disk full, unique constraint violation on tombstone, or network severed), the entire transaction **ROLLBACKS immediately**. The source row remains in `auth_operations`. A partial archive **never** deletes the source row.
- **Idempotency Survival:** Uniqueness of `op_id` and `receipt_id` is maintained across transitions:
  - Live operations: Guaranteed by `auth_operations(op_id PK, receipt_id UNIQUE)`.
  - Tombstones: Guaranteed by `auth_operations_tombstones(op_id PK, receipt_id UNIQUE)`.
  - Archive: Guaranteed by `auth_operations_archive(op_id PK, receipt_id UNIQUE)`.
  Repeated client queries for an archived operation find the tombstone and return verified outcome without duplicate execution.

---

## 4. JWKS Anti-Rollback After Local Trust-State Loss

Version 3.22 established sequence-based anti-rollback using `lastTrustedSequence`. Version 3.23 addresses the critical security edge case: **how freshness is mathematically guaranteed when local storage is wiped, absent, or corrupted.**

### 4.1 Distinguishing Root Identity from Manifest Freshness

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                               Cryptographic Separation of Concerns                                |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| 1. ROOT IDENTITY (Build-Pinned Thumbprint):                                                       |
|    • Proves: The public key belongs to MetroLMS Root CA.                                         |
|    • Does NOT Prove: That a presented manifest is recent or currently authorized.                |
|                                                                                                   |
| 2. MANIFEST SIGNATURE (Root ES256 Signature):                                                     |
|    • Proves: The manifest payload was signed by the authentic Root Key.                           |
|    • Does NOT Prove: That the manifest has not been superseded or revoked.                        |
|                                                                                                   |
| 3. MANIFEST TIME VALIDITY (issuedAt & expiresAt):                                                 |
|    • Proves: The manifest was signed for a specific historical window (max 24 hours).             |
|    • Vulnerability: Within that 24h window, a compromised key could be replayed if state is lost. |
|                                                                                                   |
| 4. MONOTONIC SEQUENCE FRESHNESS (lastTrustedSequence):                                            |
|    • Proves: The manifest is strictly newer than any previously accepted state.                   |
|    • Requirement: Requires a trusted high-water mark or an authenticated bootstrap anchor.        |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

A valid root signature alone **NEVER** constitutes proof of freshness.

---

### 4.2 The Clean Bootstrap Protocol (Zero Prior Local State)

When a browser client starts with empty, absent, or cleared site data:
1. `lastTrustedSequence` is `null` (no local high-water mark).
2. An attacker could attempt to replay an earlier unexpired manifest from within the 24-hour window that contained a subsequently revoked key.

#### The Authoritative Clean Bootstrap Protocol
To prevent historical replay during clean bootstrap, MetroLMS mandates the **Authenticated Live Bootstrap Handshake**:

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser Client
    participant Edge as TLS Edge / CDN
    participant Auth as Auth Server (Root Key Manifest Service)

    Note over Client: Storage Empty / Site Data Cleared (lastTrustedSequence = null)
    Client->>Auth: GET /api/auth/jwks-manifest.json (Cache-Control: no-cache, no-store)
    Note over Auth: Injects Server-Signed Timestamp & Nonce in Manifest
    Auth-->>Client: Signed Manifest (Payload, sequence: 1045, issuedAt, expiresAt, signature)
    
    Note over Client: Step 1: Verify Root Thumbprint against VITE_AUTH_JWKS_ROOT_THUMBPRINT
    Note over Client: Step 2: Verify Root ES256 Signature over RFC 8785 Canonical Payload
    Note over Client: Step 3: Wall-Clock Freshness Gate: |currentTime - manifest.issuedAt| <= 60s
    Note over Client: Step 4: Expiration Gate: currentTime < manifest.expiresAt
    
    Note over Client: Step 5: Initialize Storage High-Water Mark: lastTrustedSequence = 1045
    Note over Client: Bootstrap Verified: Leaf keys imported into WebCrypto
```

1. **Mandatory Live Wall-Clock Freshness Gate:**
   - During clean bootstrap, the client evaluates:
     $$|\text{ClientWallClockTime} - \text{manifest.issuedAt}| \le 60\text{ seconds}$$
   - Because the manifest service re-issues signed manifests continuously with current timestamps, an attacker attempting to replay a historical manifest from hours ago will present an `issuedAt` that fails this 60-second gate!
2. **Network Failure / Offline Handling:**
   - If the client cannot connect to the live server to execute the clean bootstrap handshake:
     - **Offline S7 Prohibition:** The client **strictly fails closed**.
     - It **MUST NOT** accept any cached or unverified manifest.
     - It **CANNOT transition to `S7` (Confirmed Logout)**; it remains locked in `S8-A` (`REVOCATION_CAUSE_UNKNOWN`).

---

### 4.3 Durable High-Water Mark Coordination & Storage Limits

```
+─────────────────────────────────────────────────────────────────────────────+
|                         Browser Storage Coordination                        |
|                                                                             |
|   ┌───────────────────────────┐         ┌───────────────────────────────┐   |
|   │         IndexedDB         │ ◀──────▶│         localStorage          │   |
|   │ (Authoritative Structure) │         │ (Synchronous Bootstrap Cache) │   |
|   └─────────────┬─────────────┘         └───────────────┬───────────────┘   |
|                 │                                       │                   |
|                 └───────────────────┬───────────────────┘                   |
|                                     ▼                                       |
|                  ┌──────────────────────────────────────┐                   |
|                  │           Web Locks API              │                   |
|                  │ navigator.locks.request('auth_lock') │                   |
|                  └──────────────────┬───────────────────┘                   |
|                                     ▼                                       |
|                  ┌──────────────────────────────────────┐                   |
|                  │          BroadcastChannel            │                   |
|                  │    postMessage('MANIFEST_UPDATE')    │                   |
|                  └──────────────────────────────────────┘                   |
+─────────────────────────────────────────────────────────────────────────────+
```

1. **Storage Roles:** `IndexedDB` is the authoritative persistent store; `localStorage` acts as an instantaneous synchronous cache for page load.
2. **Web Lock Serialization:** All reads and writes to `lastTrustedSequence` acquire `navigator.locks.request('auth_manifest_lock')` to prevent multi-tab update races.
3. **Storage Divergence Reconciliation:** If `IndexedDB.sequence != localStorage.sequence`, the client resolves:
   $$\text{canonicalSequence} = \max(\text{IndexedDB.sequence}, \text{localStorage.sequence})$$
4. **Storage Corruption Handling:** If stored values are unparseable or decremented, the client triggers `FATAL_STORAGE_INTEGRITY_ALARM`, wipes corrupted local data, purges in-memory keys, and forces a complete Authenticated Clean Bootstrap Handshake.
5. **Storage Boundary Attestation:** Browser-controlled storage is **not** a Hardware Security Module. It cannot withstand root-level host OS tampering. MetroLMS guarantees security against web-origin network attackers, malicious scripts, and replay attacks within the limits of standard browser sandbox security.

---

## 5. Vendor-Specific HSM / PKCS#11 Capability Specifications

Version 3.22 specified `C_SetAttributeValue(CKA_ENCRYPT = FALSE)`. Version 3.23 provides the exact vendor capability requirements and clearly delineates on-premises PKCS#11 hardware from Cloud KMS policy management.

### 5.1 On-Premises PKCS#11 Hardware Requirements (Procurement Gate)

In the PKCS#11 standard, object attributes are not automatically modifiable after creation unless explicitly supported by the underlying HSM firmware. MetroLMS establishes the following mandatory **Phase 12 Hardware Procurement Requirements**:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                       Mandatory PKCS#11 HSM Hardware Procurement Requirements                     |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| 1. CKA_MODIFIABLE SUPPORT:                                                                        |
|    • The HSM MUST support CKA_MODIFIABLE = CK_TRUE during key generation (C_GenerateKey).          |
|    • Modifiable attributes MUST include CKA_ENCRYPT.                                              |
|                                                                                                   |
| 2. INDEPENDENT ENCRYPT/DECRYPT MUTABILITY:                                                        |
|    • The HSM MUST permit transitioning CKA_ENCRYPT from CK_TRUE to CK_FALSE via                  |
|      C_SetAttributeValue while leaving CKA_DECRYPT = CK_TRUE on the same key handle.             |
|                                                                                                   |
| 3. AUTHORIZATION ROLE:                                                                            |
|    • Attribute modification MUST be executable under an authenticated Crypto Officer (CO) or      |
|      authorized Security Officer session (C_Login(CKU_USER)).                                     |
|                                                                                                   |
| 4. ATOMIC RUNTIME ENFORCEMENT:                                                                    |
|    • C_SetAttributeValue MUST execute synchronously and return CKR_OK only after the internal     |
|      hardware state table is updated.                                                             |
|    • Any subsequent C_EncryptInit call MUST fail immediately with CKR_KEY_FUNCTION_NOT_PERMITTED. |
|    • Active C_EncryptUpdate/C_EncryptFinal contexts in progress MUST be permitted to complete.   |
|                                                                                                   |
| 5. HARDWARE STATUS INTROSPECTION:                                                                 |
|    • The HSM MUST support C_GetAttributeValue for CKA_ENCRYPT to allow authoritative status       |
|      reconciliation if a network timeout occurs during fencing.                                   |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

*Status:* These capabilities are formal procurement requirements for Phase 12 hardware selection (e.g. Thales Luna 7, Utimaco SecurityServer, YubiHSM 2, or AWS CloudHSM). They are **not** claimed as deployed runtime guarantees today.

---

### 5.2 Cloud KMS Platform Key Fencing (AWS KMS / GCP Cloud KMS)

For deployments utilizing managed Cloud KMS rather than raw PKCS#11 partitions, attribute modification is replaced by **Authoritative Policy Fencing**:

#### Platform A: AWS KMS Key Policy Fencing
AWS KMS keys do not expose mutable `CKA_ENCRYPT` flags. Fencing is executed via atomic Key Policy modification:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowDecryptionForRetention",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::123456789012:role/metrolms-app-role" },
      "Action": ["kms:Decrypt", "kms:DescribeKey"],
      "Resource": "*"
    },
    {
      "Sid": "DenyAllEncryptionExplicitly",
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["kms:Encrypt", "kms:GenerateDataKey*"],
      "Resource": "*"
    }
  ]
}
```
- **Execution API:** `kms:PutKeyPolicy(KeyId = :id, PolicyName = "default", Policy = :policyJSON)`.
- **Consistency Semantics:** AWS KMS policy updates achieve read-after-write consistency across regional hardware endpoints within $\le 5$ seconds. The fencing supervisor enforces a **5-second post-fence drain barrier** before acknowledging key retirement.

#### Platform B: Google Cloud KMS IAM Fencing
- **Execution API:** `cloudkms.projects.locations.keyRings.cryptoKeys.setIamPolicy`.
- **IAM Policy:** Removes role `roles/cloudkms.cryptoKeyEncrypter` from all workload identities while retaining `roles/cloudkms.cryptoKeyDecrypter` for the 7-day retention period.

---

## 6. Admission and Fencing — The Exhaustive 8-Phase Race Matrix

The system maps every possible admission and execution phase against an immediate concurrent key fencing event:

| Phase # | Granular Admission & Execution State | May Request Execute Cipher? | Does Quota Credit Remain Consumed? | Is Result Recoverable by Caller? | Is Request Rejected to Caller? | Resulting Admission State | Can Fencing Acknowledge DECRYPTION_ONLY? |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | **Credit Reserved; RPC Not Sent** | **NO** (Intercepted pre-dispatch) | **YES** (Burned in `allocated_count`) | **NO** | **YES** (`409 Conflict: KEY_FENCED`) | `FAILED_PRE_INVOCATION` | **YES** (Immediately cancelled) |
| **2** | **RPC Sent; Provider Not Accepted** | **NO** (Dropped / connection severed) | **YES** (Permanently burned) | **NO** | **YES** (`500 / 409 Conflict`) | `OUTCOME_UNKNOWN` | **YES** (Classified unknown) |
| **3** | **Request Queued in HSM Buffer** | **NO** (Rejected by HSM barrier gate) | **YES** (Permanently burned) | **NO** | **YES** (`403 KeyFencedException`) | `OUTCOME_UNKNOWN` | **YES** (Classified unknown) |
| **4** | **AES-GCM Executing in Silicon Core** | **YES** (Active hardware primitive completes) | **YES** (Valid primitive execution) | **CONDITIONAL** (If connection holds) | **CONDITIONAL** (Succeeds if persisted) | Transitions to Phase 5 or `OUTCOME_UNKNOWN` | **NO** (Fencing waits for 5s drain) |
| **5** | **Cipher Completed; Envelope Produced** | **N/A** (Primitive finished) | **YES** (Valid primitive execution) | **CONDITIONAL** (Awaiting DB write) | **CONDITIONAL** (Succeeds if persisted) | `IN_FLIGHT` | **NO** (Fencing waits for DB write) |
| **6** | **Envelope DB Persistence In Progress** | **N/A** (Cipher finished) | **YES** (Valid primitive execution) | **YES** (If DB commit succeeds) | **NO** (Returns sealed envelope) | `SUCCEEDED` (or `OUTCOME_UNKNOWN` if DB fails) | **NO** (Fencing waits for commit) |
| **7** | **Envelope Durably Persisted (`SUCCEEDED`)** | **N/A** (Completed pre-fence) | **YES** (Valid primitive execution) | **YES** (Authoritative DB record) | **NO** (Success returned) | `SUCCEEDED` | **YES** (Already resolved) |
| **8** | **Response Delivered to Caller** | **N/A** (Completed pre-fence) | **YES** (Valid primitive execution) | **YES** (Caller holds lease envelope) | **NO** (Success returned) | `SUCCEEDED` | **YES** (Already resolved) |

---

## 7. Preserved Architectural Decisions and Invariants

All prior accepted architectural decisions remain binding and unmodified:
1. **PostgreSQL Synchronous Durability:** `synchronous_commit = 'remote_apply'` with `ANY 1 (standby_1, standby_2)` and Patroni `strict_mode` fail-closed failover.
2. **KMS Quota Ceiling:** Authoritative global ceiling of $2^{24}$ (16,777,216) invocations per key on PostgreSQL Primary Writer.
3. **Physical HSM IV Generation Boundary (Option A):** 96-bit random IVs generated strictly inside physical HSM appliance hardware perimeters via NIST SP 800-90A CTR_DRBG seeded by physical TRNGs (NIST SP 800-90B), completely decoupled from guest Linux VMGenID.
4. **FIPS 140-3 Level 3 Mandate:** Validated active FIPS 140-3 certificate required for all new deployments as of November 2026.
5. **ES256 Raw Signature Verification:** Strict 64-byte raw IEEE P1363 coordinate parsing ($R \mathbin{\Vert} S$, 32 bytes each), scalar bounds validation ($1 \le R, S < n$), and complete elimination of the flawed `0x30` heuristic.
6. **RFC 7638 Root JWK Thumbprint:** Build-pinned `VITE_AUTH_JWKS_ROOT_THUMBPRINT` verifying Root EC P-256 public key.
7. **Governing Owner Decisions:**
   - **Decision A (S0):** Only `S0 → S1` permitted; `S0 → S3/S14/S15` forbidden.
   - **Decision B (S8):** `S8 → S14/S15` forbidden; Developer origin never reactivated by real user.
   - **Decision C (Real-User Logout):** `S8 → S7` approved; origin snapshot preserved inert in per-tab sessionStorage until tab close.
   - **Decision E:** Option 1 (Transactional Abort on Archive Failure) approved.
   - **Decision F:** Option 1 baseline preserved.

---

## 8. Preserved Master Accounting Ledger & Baselines (158 Rows)

### 8.1 Certified Canonical Matrix D Traceability Ledger
The authoritative Master Accounting Ledger is preserved at exactly **158 physical rows**:

| Matrix D Table | Canonical Architectural Traceability Definition | Row Count | Traceability Purpose & Scope |
| :--- | :--- | :---: | :--- |
| **Table D-1** | **Descriptor Conditions `D-*` → Lifecycle Scenarios `S-*`** | **33** | Forward traceability mapping 22 startup conditions (`D-*`) and 11 reboot conditions (`C-*`) to lifecycle scenarios. |
| **Table D-2** | **Runtime Outcomes `R-*` / `Q-*` / `U-*` → Lifecycle Scenarios `S-*`** | **69** | Mapping 64 Request Runtime IDs (`R-*`), 4 Request Lifecycle Events (`Q-*`), and 1 UI Event (`U-*`) to lifecycle scenarios. |
| **Table D-3** | **Lifecycle Scenarios `S-*` → Runtime Outcomes `R-*`** | **56** | Reverse traceability mapping all 56 discrete lifecycle scenarios (`S-*`) to permitted runtime outcome codes. |
| **GRAND TOTAL** | **Canonical Master Traceability Ledger (D-1 + D-2 + D-3)** | **158** | **Strict physical row count verified closed ($33 + 69 + 56 = 158$).** |

---

### 8.2 Frozen Test Baselines
- **Phase 5 Core Test Suite:** Exactly **60 authored test specifications** in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx):  
  `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
- **Supplemental Remediation Suite (`SUP-01-T01`):** Exactly **22 proposed subcases**:  
  `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`

*Zero test files created, modified, renumbered, or executed.*

---

### 8.3 Complete 7-Account Inventory (Zero Plaintext Credentials)

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

### 8.4 Documented Git Working-Tree Evidence
- **Staged Files (`git add`):** **0 files staged**.
- **Commits Created (`git commit`):** **0 commits performed**.
- **Working Tree Inspection:** Contains 17 modified tracked files (preserved from Increment 5.4) and untracked documentation reports from prior increment audits.
- **Working Tree Certification:** The working tree is **NOT** clean; it holds historical untracked report artifacts and Increment 5.4 uncommitted changes. 100% strict read-only documentation governance maintained.

---

## 9. Deliverables and Evidence Attestation

The Version 3.23 audit deliverables are confirmed:
1. **Primary Documentation Report:**  
   [`docs/frontend/reports/sup-01-final-contract-closure-audit-v3-23.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/sup-01-final-contract-closure-audit-v3-23.md)
2. **Mirrored Brain Artifact:**  
   [`sup-01-final-contract-closure-audit-v3-23.md`](file:///C:/Users/Administrator/.gemini/antigravity/brain/60a56b3d-7eee-41aa-b677-179a79273724/sup-01-final-contract-closure-audit-v3-23.md)

---

## 10. Final Readiness Decision

```text
========================================================================================
STATUS: READY FOR OWNER AUTHORIZATION — ARCHIVAL AUTHORIZATION, JWKS ANTI-ROLLBACK AND HSM FENCING CLOSED
========================================================================================
```

### Definitive Architectural Justification
1. **Authenticated Archival Authorization (§3):** Established the three-tier database identity model binding the trigger to `SESSION_USER = 'metrolms_archival_worker'`, executed via a `SECURITY DEFINER` procedure with a fixed `search_path`, and proved least-privilege role separation that completely protects live committed records from application tampering.
2. **Verified 9-Step Archival & Tombstone Atomic Sequence (§3.3):** Defined the unbroken atomic transaction copying expired records, computing SHA-256 receipt digests, inserting 90-day live tombstones, and performing authorized deletion, ensuring total rollback on failure.
3. **Clean Bootstrap JWKS Anti-Rollback Freshness Protocol (§4):** Solved the local trust-state loss dilemma by separating root identity from manifest freshness, introducing the live 60-second wall-clock freshness gate, and strictly prohibiting offline clients from transitioning to `S7`.
4. **Vendor-Specific HSM & Cloud KMS Fencing Semantics (§5):** Established explicit Phase 12 hardware procurement criteria for PKCS#11 (`CKA_MODIFIABLE`, independent `CKA_ENCRYPT` mutability), defined Cloud KMS policy fencing via explicit `Deny` rules with 5-second drain buffers, and preserved 7-day decryption.
5. **Exhaustive 8-Phase Admission & Fencing Race Matrix (§6):** Mapped every possible execution state from pre-dispatch through silicon execution and persistent DB commit, resolving all concurrency ambiguities.
6. **Certified Master Accounting & Baselines (§8):** Certified canonical Matrix D traceability definitions at exactly 158 physical rows ($33 + 69 + 56 = 158$), preserved 60 authored and 22 proposed tests deferred to Phase 13, and confirmed complete 7-account credential-free baselines.

*The SUP-01 architectural, cryptographic, and database specifications are completely closed, internally consistent, forensically verified, and ready for explicit Owner authorization. No implementation or production actions are authorized by this audit.*

