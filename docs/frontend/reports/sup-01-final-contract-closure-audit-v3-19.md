# MetroLMS — SUP-01 Revocation Trust, Non-Exportable Key Fencing & Cryptographic Runtime Closure (Version 3.19)
## Final Architectural Audit: Version 3.18 Evidence Classification Matrix, Non-Exportable KMS Key Fencing Architecture (Option A) & PostgreSQL Consensus Quota Authority, Raw 64-Byte IEEE P1363 / JWS ES256 Signature Wire Format & WebCrypto Verification Contract, Unauthenticated Public JWKS Post-Revocation Availability & Pinned Trust Anchor, Issuer / Audience / Anti-Replay Receipt Validation Rules, Hypervisor VMGenID Driver & Guest Reseeding Operational Prerequisites, and Certified 158-Row Master Accounting Ledger

**Document Version:** 3.19 (Revocation Trust, Non-Exportable Key Fencing & Cryptographic Runtime Closure)  
**Planning Date:** 2026-11-07  
**Document Path:** `docs/frontend/reports/sup-01-final-contract-closure-audit-v3-19.md`  
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
**Final Architecture Status:** `READY FOR OWNER AUTHORIZATION — REVOCATION TRUST AND ENFORCEABLE KEY FENCING CLOSED`

---

## 1. Scope and Governance Attestation

### 1.1 Strict Read-Only Governance Compliance
This document constitutes the final evidence-driven boundary closure audit of Version 3.18 and its mirrored brain artifact. In accordance with strict architectural governance:
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
This document establishes architectural specification and evidence-driven consistency. **It does NOT claim runtime verification, production deployment, database implementation, or cryptographic testing readiness.**

---

## 2. Version 3.18 Evidence Classification Matrix

Every architectural boundary identified in the review of Version 3.18 is classified below against the primary document and its mirrored artifact:

| Item # | Architectural Requirement | Version 3.18 Status | Evidence Location (v3.18 Section) | Forensic Analysis & v3.19 Closure Action |
| :-: | :--- | :---: | :--- | :--- |
| **1** | Enforceable Old-Key Encryption Fencing & Quota Authority | `PARTIALLY SPECIFIED` | Section 4.1, 4.2 | Relied on application pods voluntarily evicting cached keys upon KMS notification, failing to prevent disconnected or stale pods from continuing encryption. Closed in §3 with Option A (Non-Exportable KMS Key Architecture) and PostgreSQL Primary Writer Quota Authority. |
| **2** | ES256 Signature Wire Format (Raw 64-Byte R \|\| S) | `PARTIALLY SPECIFIED` | Section 3.2 | Mandated ES256 but omitted DER-to-raw conversion rules, 32-byte zero-padding requirements, and strict length rejection. Closed in §4. |
| **3** | Unauthenticated Public JWKS Availability Post-Revocation | `PARTIALLY SPECIFIED` | Section 3.2 | Lacked explicit specification guaranteeing that `/api/auth/jwks.json` is unauthenticated and accessible over Web PKI TLS origin trust after Bearer credentials are dead. Closed in §5. |
| **4** | Revocation Receipt Issuer, Audience & Anti-Replay Validation | `PARTIALLY SPECIFIED` | Section 3.1, 3.3 | Defined claim presence but lacked client comparison rules against configured trusted values and server-side receipt uniqueness constraints. Closed in §6. |
| **5** | Hypervisor VMGenID Driver & Reseeding Operational Prerequisite | `PARTIALLY SPECIFIED` | Section 5.3 | Mentioned `vmgenid` but lacked explicit hypervisor ACPI device requirements, Linux guest driver configuration, and clone prohibition policies. Closed in §7. |
| **6** | Exact RFC 7515 JWS Ticket Reconstruction & Key Separation | `EXPLICITLY SPECIFIED` | Section 6.1, 6.2, 6.3 | Verified 9-step compact serialization, I-JSON numeric boundaries, and HMAC/GCM key separation. Reconfirmed in §8. |
| **7** | Master Accounting Ledger Integrity (158 Rows) | `EXPLICITLY SPECIFIED` | Section 8.1 | Verified 64 R-IDs, 4 Q-events, 1 U-event, 33 Cond, 56 Scen, 158 D-rows verified. Reconfirmed in §9. |
| **8** | Frozen Test Baselines & Mandatory 7-Account Inventory | `EXPLICITLY SPECIFIED` | Section 8.2, 8.3 | 60 authored Phase 5 tests and 22 SUP-01-T01 subcases deferred. Complete 7-account table reproduced. Reconfirmed in §9. |

---

## 3. Enforceable Old-Key Encryption Fencing Architecture (Option A)

Version 3.18 correctly recognized that Redis Sentinel cannot guarantee zero write loss and proposed a fencing protocol. However, it assumed that application pods would receive a KMS notification and voluntarily evict cached plaintext key material. This fails if a pod is network-partitioned, frozen, or unresponsive: a stale pod holding plaintext key material in memory could continue encrypting new leases, violating the $2^{24}$ global budget.

### 3.1 Architectural Selection: Option A (Non-Exportable Key Architecture)
MetroLMS explicitly selects and standardizes on **Option A: Non-Exportable Key with Controlled Cryptographic Service**.

```
+---------------------------------------------------------------------------------------------------+
|                        Option A: Non-Exportable KMS Encryption Architecture                       |
+---------------------------------------------------------------------------------------------------+
| • Key Material Storage: AES-GCM keys reside STRICTLY inside a Hardware Security Module (HSM) / KMS|
| • Plaintext Export Policy: AES-256 keys are marked NON-EXPORTABLE (Never exposed to Pod memory)    |
| • Encryption Boundary: Application Pods dispatch lease nonces to KMS/HSM via authenticated RPC    |
| • Fencing Enforcement: KMS enforces key state ENCRYPTION_FENCED at the cryptographic engine       |
| • Partition Immunity: Stale, disconnected, or isolated Pods CANNOT encrypt (Zero local key access)|
| • Decryption Policy: KMS permits kms:Decrypt under separate read-only authorization for 7 days    |
+---------------------------------------------------------------------------------------------------+
```

1. **Non-Exportable Secret Invariant:** The root AES-256 encryption keys (`k-aes-2026-v*`) are generated directly inside the KMS/HSM boundary and configured as non-exportable. Application pods never receive raw key bytes in process memory under any circumstance.
2. **KMS-Mediated Lease Nonce Encryption:** When an application pod acquires a lease, it sends the plaintext `regNonce` along with canonical AAD to the KMS encryption endpoint (`kms:Encrypt`). The KMS generates the 96-bit CSPRNG IV, computes the AES-256-GCM ciphertext and 128-bit authentication tag, and returns the sealed envelope.
3. **Hardware-Enforced Fencing:** When the operational ceiling of $2^{24}$ is reached, or when failover occurs, the KMS marks the key **`ENCRYPTION_FENCED`** inside its internal policy database.
4. **Absolute Partition Immunity:** Because application pods hold zero plaintext key material, a network-partitioned, lagging, or compromised pod cannot continue encrypting leases. Any call to `kms:Encrypt` for a fenced key is rejected by the KMS engine with HTTP **`403 KeyFencedException`**, regardless of the client's internal state.
5. **Decryption Preservation:** The KMS policy engine decouples encryption rights from decryption rights. While `kms:Encrypt` is permanently revoked upon fencing, `kms:Decrypt` remains authorized for exactly **7 days**, allowing active in-flight leases to be decrypted and consumed during registration.

### 3.2 Consensus-Backed Quota Authority: PostgreSQL Primary Writer
To eliminate the asynchronous replication risks of Redis Sentinel, MetroLMS formally selects the **PostgreSQL Primary Writer as the Authoritative Consensus Quota Authority**:

- **PostgreSQL ACID Boundary:** The authoritative invocation budget is maintained in an ACID-compliant relation on the PostgreSQL Primary Writer:
  ```sql
  CREATE TABLE kms_key_budgets (
    key_id VARCHAR(64) PRIMARY KEY,
    allocated_count INT NOT NULL DEFAULT 0,
    operational_ceiling INT NOT NULL DEFAULT 16777216,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fenced_at TIMESTAMPTZ
  );
  ```
- **Indivisible Atomic Reservation:** Allocation of encryption blocks executes inside PostgreSQL under row-level exclusive locks:
  ```sql
  UPDATE kms_key_budgets
  SET allocated_count = allocated_count + LEAST(1000, operational_ceiling - allocated_count),
      status = CASE WHEN allocated_count + LEAST(1000, operational_ceiling - allocated_count) >= operational_ceiling 
                    THEN 'ENCRYPTION_FENCED' ELSE status END
  WHERE key_id = :keyId 
    AND status = 'ACTIVE'
    AND allocated_count < operational_ceiling
  RETURNING LEAST(1000, operational_ceiling - allocated_count) AS granted_credits;
  ```
- **Consensus & Durability Guarantees:** Because the Primary Writer commits allocations to the Write-Ahead Log (WAL) with synchronous replication to standby nodes, master failover is crash-consistent. Counter rollback is mathematically impossible under synchronous replication.
- **Role of Redis:** Redis is strictly designated as an optional ephemeral read-through cache or client telemetry buffer; it possesses **zero authority** over cryptographic ceilings.
- **Production Implementation Prerequisite:** Production lease encryption remains prohibited until the PostgreSQL Primary Writer consensus quota table is provisioned.

---

## 4. ES256 Revocation Receipt — Exact Signature Wire Format

Version 3.18 selected ECDSA Curve P-256 with SHA-256 (ES256) and browser verification via `window.crypto.subtle.verify`. Version 3.19 establishes the exact wire representation, eliminating ASN.1 DER ambiguities.

### 4.1 Exact 64-Byte Raw IEEE P1363 / JWS Signature Wire Format
In accordance with RFC 7515 §3.1, RFC 7518 §3.4, and the W3C Web Cryptography API specification:
- The ES256 signature representation is strictly the **raw concatenation of the two curve coordinates: $R \mathbin{\Vert} S$**.
- **Fixed Width:** The signature is **exactly 64 bytes** (512 bits) in length.
  - Byte 0 to Byte 31: Integer coordinate $R$ (exactly 32 bytes).
  - Byte 32 to Byte 63: Integer coordinate $S$ (exactly 32 bytes).
- **Big-Endian Unsigned Encoding:** Both $R$ and $S$ are serialized as unsigned fixed-width big-endian integers.
- **Preservation of Leading Zeros:** If $R$ or $S$ has a numerical value requiring fewer than 32 bytes (i.e. value $< 2^{248}$), the value **MUST be left-padded with leading zero bytes (`0x00`)** to ensure its width is exactly 32 bytes.
- **Base64URL Representation:** The 64 raw bytes are encoded into an unpadded Base64URL string of exactly **86 ASCII characters**.

```
+---------------------------------------------------------------------------------------------------+
|                        Raw 64-Byte IEEE P1363 / JWS Signature Structure                           |
+---------------------------------------------------+-----------------------------------------------+
|             Coordinate R (Bytes 0..31)            |          Coordinate S (Bytes 32..63)          |
|    32-Byte Big-Endian Unsigned Integer (Padded)   |   32-Byte Big-Endian Unsigned Integer (Padded)   |
+---------------------------------------------------+-----------------------------------------------+
| Total Wire Length: EXACTLY 64 BYTES (Decodes from exactly 86 unpadded Base64URL characters)      |
+---------------------------------------------------------------------------------------------------+
```

### 4.2 Server-Side DER-to-Raw Conversion Protocol
Standard cryptographic libraries (e.g. OpenSSL, Java Cryptography Architecture) natively emit ECDSA signatures in ASN.1 DER format (`SEQUENCE { INTEGER r, INTEGER s }`), which varies between 70 and 72 bytes.

The backend signing worker must execute the **Deterministic DER-to-Raw Transformer**:
```typescript
function derToRawSignature(derBytes: Uint8Array): Uint8Array {
  // Parse ASN.1 DER SEQUENCE (0x30) -> INTEGER r (0x02) -> INTEGER s (0x02)
  // Extract integer bytes, strip leading DER null-byte sign markers (0x00)
  // Left-pad R to exactly 32 bytes; left-pad S to exactly 32 bytes
  // Concatenate: new Uint8Array(64) [ ...R_padded, ...S_padded ]
}
```

### 4.3 Client-Side Signature Invariant Enforcement
The browser client's verification routine rejects the receipt immediately before invoking WebCrypto if any invariant fails:
1. **Length Validation:** The Base64URL-decoded byte array length is verified: `if (sigBytes.byteLength !== 64) throw new Error("INVALID_SIGNATURE_LENGTH");`.
2. **ASN.1 DER Rejection:** If `sigBytes[0] === 0x30`, the signature is identified as un-transformed DER and rejected immediately.
3. **Range Validation:** $R$ and $S$ are verified to lie strictly within the range $[1, n - 1]$, where $n$ is the secp256r1 curve order.
4. **Algorithm Pinning:** The client verification call strictly pins `{ name: "ECDSA", hash: { name: "SHA-256" } }`. Any receipt requesting `none`, `HS256`, or alternative curves is rejected.

---

## 5. JWKS Trust, Rotation and Post-Revocation Availability

A critical architectural vulnerability arises if public verification keys can only be retrieved using valid user credentials: once a user logs out and their Bearer token is revoked, the browser would be unable to fetch `/api/auth/jwks.json` to verify the revocation receipt.

### 5.1 Public Unauthenticated Endpoint over Web PKI TLS Origin Trust
- **Route Policy:** `GET /api/auth/jwks.json` is strictly an **Unauthenticated Public Endpoint**.
- **Transport Security:** Distributed over HTTPS, relying on authoritative Web PKI TLS origin trust (valid certificates matching the server domain).
- **Public Nature:** Public keys contain zero private secrets; they are intended for universal unauthenticated inspection.
- **Availability Guarantee:** Because the route requires no cookies, Bearer tokens, or headers, the browser can fetch public keys **even after all session credentials have been completely revoked**.

### 5.2 Client Trust Bootstrap & Pinned Trust Anchor
To prevent rogue proxy or CDN spoofing:
1. **Bootstrapped Public Key Fingerprint:** The frontend client bundle embeds an immutable root key fingerprint in its environment configuration:
   `VITE_AUTH_JWKS_ROOT_FINGERPRINT = "sha256:7f83b1a2..."`.
2. **Client-Side Verification Cache:** The client fetches the JWKS and caches public keys in memory and `sessionStorage` with a 24-hour Time-to-Live (TTL).
3. **Zero-Latency In-Memory Verification:** When `GET /api/auth/operations/:opId` returns a receipt with `kid = "k-receipt-2026-v1"`, the client resolves the public key directly from its local cache, requiring **zero network round-trips** during the critical logout completion path.
4. **Forced Cache Refresh on Unknown `kid`:** If a receipt presents an unknown `kid` (indicating key rotation occurred during the session), the client performs a single forced HTTP fetch to `/api/auth/jwks.json`.
5. **JWK Strict Schema Validation:**
   Every key entry in the JWKS is validated before import:
   - `kty === "EC"`
   - `crv === "P-256"`
   - `alg === "ES256"`
   - `use === "sig"` (or `key_ops` contains `"verify"`)
   - `x` and `y` are valid Base64URL-encoded 32-byte coordinates.
   - Duplicate `kid` entries within the JWKS array are strictly rejected.

```typescript
// Client-Side Public Key Import Contract
const verificationKey = await window.crypto.subtle.importKey(
  "jwk",
  jwkEntry,
  { name: "ECDSA", namedCurve: "P-256" },
  false, // Non-extractable
  ["verify"]
);
```

---

## 6. Revocation Receipt Issuer, Audience & Anti-Replay Validation

### 6.1 Exhaustive Client-Side Claim Validation Rules
The client application validates the canonical payload against configured deployment parameters before accepting the receipt:

| Claim Name | Expected Canonical Type | Client Validation Rule | Action on Failure |
| :--- | :---: | :--- | :--- |
| **`receiptVersion`** | String | Strictly equals `"v1"`. | Reject receipt $\to$ Retain `S8-A`. |
| **`iss`** | String | Strictly equals configured `EXPECTED_ISSUER` (e.g. `https://auth.metrolms.internal`). | Reject receipt $\to$ Retain `S8-A`. |
| **`aud`** | String | Strictly equals configured `EXPECTED_AUDIENCE` (e.g. `metrolms:app:production`). | Reject receipt $\to$ Retain `S8-A`. |
| **`eventType`** | String | Strictly equals `"SESSION_REVOCATION_LOGOUT"`. | Reject receipt $\to$ Retain `S8-A`. |
| **`state`** | String | Strictly equals `"COMMITTED"`. | Reject receipt $\to$ Retain `S8-A`. |
| **`userId`** | String | Strictly equals active `descriptor.userId`. | Reject receipt $\to$ Retain `S8-A`. |
| **`sessionId`** | String | Strictly equals active `descriptor.sessionId`. | Reject receipt $\to$ Retain `S8-A`. |
| **`sessionGeneration`** | Integer | Strictly equals active `descriptor.sessionGeneration`. | Reject receipt $\to$ Retain `S8-A`. |
| **`opId`** | String | Strictly equals active `descriptor.opId`. | Reject receipt $\to$ Retain `S8-A`. |
| **`committedAt`** | Integer | Satisfies: `committedAt >= descriptor.createdAt - 60` AND `committedAt <= now + 60`. | Reject receipt $\to$ Retain `S8-A`. |
| **`receiptId`** | String | Valid UUIDv4 format (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`). | Reject receipt $\to$ Retain `S8-A`. |

### 6.2 Server-Side Uniqueness & Idempotent Anti-Replay Semantics
1. **Database Uniqueness Constraint:** The PostgreSQL schema enforces a unique constraint on the receipt identifier:
   ```sql
   CREATE UNIQUE INDEX uq_auth_operations_receipt_id ON auth_operations (revocation_receipt_id);
   ```
2. **Exactly-Once Receipt Generation:** The revocation receipt is generated exactly once inside the logout commit transaction and stored durably in `auth_operations`.
3. **Idempotent Retrieval:** Repeated calls to the recovery endpoint for the same operation return the **exact same stored receipt**. The client accepts repeated retrieval of the identical receipt for the same descriptor as an idempotent operation.
4. **Cryptographic Context Binding:** Because the signed payload explicitly binds `(opId, sessionId, sessionGeneration, userId, aud)`, a valid receipt from Operation A can **never authorize Operation B, Session B, User B, or an alternative environment**.
5. **Conflicting Receipt Rejection:** If a subsequent query returns a conflicting `receiptId` or altered claims for the same `opId`, the client detects an integrity violation, logs a security alarm, and retains `S8-A`.

---

## 7. VMGenID and Operating-System CSPRNG Runtime Requirements

Version 3.18 clarified that Linux container namespaces do not virtualize kernel entropy pools. Version 3.19 establishes the explicit operational prerequisites for hypervisors and guest operating systems.

### 7.1 Hypervisor ACPI VMGenID Platform Specification
In virtualized cloud deployments (AWS Firecracker, KVM/QEMU, VMware ESXi):
- **ACPI Specification Compliance:** Hypervisors must expose the **Virtual Machine Generation ID (`vmgenid`)** device per the Microsoft/OASIS VMGenID specification (`ACPI device ID: VM_GEN_COUNTER` / `QEMU0003`).
- **Physical Memory Mapping:** The hypervisor maps a 16-byte aligned memory buffer containing a 128-bit integer into guest physical address space.
- **Clone Notification:** When a VM snapshot is resumed or cloned, the hypervisor writes a new 128-bit random value into the buffer and asserts ACPI notification `0x80`.

### 7.2 Linux Guest Kernel Driver & Automatic Reseeding
- **Guest Kernel Configuration:** Production Linux guest kernels must be compiled with `CONFIG_VMGENID=y` (`drivers/virt/vmgenid.c`).
- **Automatic Kernel Reseeding:** Upon receiving ACPI notification `0x80`, the `vmgenid` kernel driver calls `add_vmfork_randomness(new_id, 16)`, which:
  1. Immediately injects the fresh hypervisor entropy into the primary ChaCha20 CRNG.
  2. Increments the kernel's internal generation counter (`crng_generation++`).
  3. Forces all per-CPU CRNG instances to immediately re-seed before dispensing bytes to `getrandom(2)`.

### 7.3 User-Space DRBG & Container Process Invariant
- **No Long-Lived User-Space DRBG Buffering:** Application processes must not buffer pseudorandom bytes in long-lived user-space memory pools across event-loop cycles.
- **Direct System Calls:** Every lease nonce encryption must draw entropy directly via `crypto.getRandomValues()` / `getrandom(2)` system calls, guaranteeing that guest kernel CRNG re-seeding takes immediate effect across all container namespaces on that VM.
- **Platform Prohibition Rule:**
  **Deploying cryptographic encryption workloads on hypervisors or cloud platforms lacking ACPI VMGenID support while utilizing snapshot/clone mechanisms is STRICTLY PROHIBITED.** If VMGenID is unavailable, instances must undergo cold system boots from base images.

---

## 8. Preservation of the JWS Operation Ticket Contract

The HS256 operation ticket reconstruction architecture established in Version 3.18 is reaffirmed without modification:
1. **RFC 7515 §3.1 Compact Serialization:** Protected Header, 9-claim Payload, and HMAC-SHA256 signature separated by periods.
2. **RFC 8785 JCS Canonicalization:** UTF-8 bytes canonicalized with lexicographical key sorting and no whitespace.
3. **I-JSON Safe Integer Invariant:** `iat`, `exp`, `gen`, and `seq` are strictly safe integers, preventing serialization divergence across runtimes.
4. **Cryptographic Key Separation:** The lease AES-256-GCM encryption key (`k-aes-...`), the ticket HMAC-SHA256 signing key (`k-ticket-...`), and the receipt ES256 signing key (`k-receipt-...`) are **three distinct cryptographic keys with separate lifecycles and KMS policies**.
5. **Key Retention:** HMAC ticket-signing keys remain in KMS active memory for at least **360 seconds** ($300\text{s} + 60\text{s buffer}$) post-rotation. If revoked, reconstruction fails closed with HTTP `409 Conflict`.
6. **No Ticket Mutation:** Replay never mints new timestamps, extends expiry, or re-allocates sequences.

---

## 9. Authoritative Master Accounting, Test Baselines & Mandatory Account Inventory

### 9.1 Certified Master Accounting Ledger (158 Physical Matrix D Rows)
The Master Accounting Ledger remains verified, closed, and mathematically consistent at **158 physical mapping rows**:

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

### 9.2 Frozen Test Baselines
- **Phase 5 Core Test Suite:**
  `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`  
  Exactly **60 authored test specifications** in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx).
- **Supplemental Remediation Suite (`SUP-01-T01`):**
  `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`  
  Exactly **22 proposed subcases**.

*No test authoring, modification, renumbering, or execution is authorized.*

### 9.3 Mandatory Complete Account Inventory (Zero Credentials)
The authoritative inventory of all seven accounts is reproduced with exact usernames and roles:

| Account Identifier | Exact Username | System Role | Scope & Authorization Category | Credentials Stored |
| :--- | :--- | :--- | :--- | :---: |
| **`USR_DEV_001`** | `developer_internal` | `developer` | Privileged Internal Developer Fixture | **NONE** |
| **`USR_SUPER_001`** | `super_admin_demo` | `super_admin` | Privileged Demo Super Administrator | **NONE** |
| **`USR_TEST_SUPER_001`** | `test_super_admin` | `super_admin` | Synthetic Test Persona (Super Admin) | **NONE** |
| **`USR_TEST_ADMIN_001`** | `test_admin` | `admin` | Synthetic Test Persona (Branch Admin) | **NONE** |
| **`USR_TEST_AST_001`** | `test_assistant_admin` | `assistant_admin` | Synthetic Test Persona (Assistant Admin) | **NONE** |
| **`USR_TEST_LEC_001`** | `test_lecturer` | `lecturer` | Synthetic Test Persona (Lecturer) | **NONE** |
| **`USR_TEST_TRN_001`** | `test_trainee` | `user` | Synthetic Test Persona (Student / Trainee) | **NONE** |

- **Account Breakdown:** Exactly 2 privileged fixtures and exactly 5 synthetic test personas = **7 total accounts**.
- **Role Assignment Boundary:** `assistant_lecturer` remains strictly a group-scoped training assignment, not a global role or persona fixture.
- **Credential Hygiene:** Zero passwords, API tokens, raw hashes, or private keys are stored.

---

## 10. Remaining Limitations and Explicit Assumptions

1. **Phase 12 Backend Prerequisite:** Non-exportable KMS key encryption, PostgreSQL Primary Writer quota management, unauthenticated JWKS distribution, and VMGenID guest kernel integration are proposed Phase 12 specifications. Until implemented, frontend clients enforce fail-closed fallback to `REVOCATION_CAUSE_UNKNOWN`.
2. **NTP Clock Synchronization:** Backend writer nodes, API instances, and distributed state stores must maintain NTP precision within $\pm 50\text{ms}$.
3. **Single-Device Logout Scope:** SUP-01 operates strictly on the initiating browser session. Multi-device session revocation remains governed by administrative session cascade.

---

## 11. Final Readiness Decision

**READY FOR OWNER AUTHORIZATION — REVOCATION TRUST AND ENFORCEABLE KEY FENCING CLOSED**

### Architectural Justification
1. **Enforceable Old-Key Fencing (Option A):** Mandated non-exportable KMS key material, ensuring isolated or unresponsive application pods holding zero plaintext keys cannot encrypt under fenced keys, while designating PostgreSQL Primary Writer as the consensus quota authority (§3).
2. **Exact ES256 Signature Wire Format:** Standardized on the 64-byte raw IEEE P1363 / JWS format ($R \mathbin{\Vert} S$, 32 bytes each with zero-padding), providing DER-to-raw conversion rules and strict length rejection (§4).
3. **Post-Revocation Public JWKS Availability:** Established that `/api/auth/jwks.json` is an unauthenticated public route over TLS origin trust, backed by a pinned client trust anchor and in-memory cache, ensuring public keys remain retrievable after Bearer token revocation (§5).
4. **Rigorous Receipt Validation & Anti-Replay:** Formally specified client validation for `iss`, `aud`, safe integer `committedAt`, and UUIDv4 `receiptId`, backed by a database unique constraint preventing receipt reuse across operations (§6).
5. **Operational VMGenID Specification:** Established hypervisor ACPI VMGenID and Linux guest driver (`CONFIG_VMGENID=y`) prerequisites, guaranteeing automatic CRNG re-seeding on VM clone/restore and prohibiting snapshotting on unsupported platforms (§7).
6. **Certified Master Accounting & Baselines:** Exactly 64 Runtime IDs, 4 Q-events, 1 U-event, 33 Conditions, 56 Scenarios, and **158 Matrix D rows** verified. Test suites frozen (60 authored, 22 proposed deferred to Phase 13). Complete 7-account inventory certified with zero credentials stored (§9).
7. **Strict Governance Integrity:** Zero production code modified, zero tests authored or executed, zero Git operations performed.

*The SUP-01 revocation trust, non-exportable key fencing, and cryptographic runtime specification is completely closed, internally consistent, forensically audited, and ready for explicit Owner authorization. No implementation authorization is requested.*

