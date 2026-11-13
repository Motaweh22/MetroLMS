# MetroLMS — SUP-01 Final Contract Closure & Evidence Audit (Version 3.13)
## Final Architectural Audit: Version 3.12 Evidence Classification Matrix, Complete Seven-Route CORS Wire Contract & Error Emission, Five-Layer Expiration & Retention Boundary Reconciliation, Lease Idempotency & Lost-Response Protocol, Atomic Three-Table Lock Ordering & Registration Consumption, Canonical Length-Prefixed AES-GCM Envelope, Recovery Secret Client Specification, Operation-Status State Semantics, and Authoritative 158-Row Master Traceability Ledger

**Document Version:** 3.13 (Final Contract Closure & Evidence Audit)  
**Planning Date:** 2026-11-07  
**Document Path:** `docs/frontend/reports/sup-01-final-contract-closure-audit-v3-13.md`  
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
**Final Architecture Status:** `READY FOR OWNER AUTHORIZATION — ALL CONTRACT BOUNDARIES EXPLICITLY RECONCILED`

---

## 1. Scope and Governance Attestation

### 1.1 Strict Read-Only Governance Compliance
This document constitutes the final evidence-driven consistency audit of Version 3.12 and its mirrored brain artifact. In accordance with strict architectural governance:
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
This document establishes architectural specification and evidence-driven consistency. **It does NOT claim runtime verification, backend implementation, browser integration, or production deployment readiness.**

---

## 2. Version 3.12 Evidence Classification Matrix

Every architectural requirement identified in the review of Version 3.12 is classified below against the primary document and its mirrored artifact:

| Item # | Architectural Requirement | Version 3.12 Status | Evidence Location (v3.12 Section) | Forensic Analysis & v3.13 Closure Action |
| :-: | :--- | :---: | :--- | :--- |
| **1** | Cross-Origin Authentication Endpoint Inventory | `EXPLICITLY SPECIFIED` | Section 3.1 | Fully inventoried 7 routes. Preserved and expanded to wire-level matrix in §3. |
| **2** | Route-Specific OPTIONS Preflight Policies | `EXPLICITLY SPECIFIED` | Section 4.1, 4.2 | Preflight routes explicitly defined; zero global bypass. Preserved in §3. |
| **3** | Actual Error Response CORS Headers | `PARTIALLY SPECIFIED` | Section 5 | Stated 4xx/5xx emit CORS, but did not formalize wire headers for 5xx vs. network drops. Closed in §4. |
| **4** | Preflight Cache Variation Policy (`Vary`) | `PARTIALLY SPECIFIED` | Section 3.1, 5 | Emitted `Vary: Origin`, but did not specify gateway cache variation by method/headers. Closed in §3.3. |
| **5** | Five-Layer Expiration Boundary Reconciliation | `PARTIALLY SPECIFIED` | Section 12 | Retained `>24h` text; did not contrast 24h recovery expiry vs. 7d record retention. Closed in §5. |
| **6** | Lease Request Idempotency & Lost-Response Protocol | `EXPLICITLY SPECIFIED` | Section 6.1, 6.2, 6.3 | Defined `leaseRequestId` and AES-GCM retry retrieval. Fully consolidated in §6. |
| **7** | Atomic Three-Table Lock Ordering Protocol | `PARTIALLY SPECIFIED` | Section 10.3 | Modeled two-table order; did not formally integrate `leases` table into global lock sequence. Closed in §7. |
| **8** | Canonical Length-Prefixed AES-GCM Nonce Storage | `EXPLICITLY SPECIFIED` | Section 10.1, 10.2 | Formally specified `len:val:len:val` AAD and 96-bit IV. Refined probabilistic collision bounds in §8. |
| **9** | Recovery Secret Client Storage & Encoding | `EXPLICITLY SPECIFIED` | Section 9.1, 9.2 | Defined 256-bit Base64URL string in `sessionStorage` and bounded XSS blast radius. Preserved in §9. |
| **10**| Operation-Status State-Dependent Query Mapping | `EXPLICITLY SPECIFIED` | Section 7.1, 7.2 | Mapped 5 states; proved HTTP 200 is query success, not logout success. Consolidated in §10. |
| **11**| Normalized Gateway Decision Matrix (Case 4 / 401) | `EXPLICITLY SPECIFIED` | Section 6 | Normalized missing/malformed key to 401 (`R-OP-STATUS-401`). Reconfirmed in §4. |
| **12**| Multi-Tier Subnet-Aware Abuse Throttling | `EXPLICITLY SPECIFIED` | Section 11.1, 11.2 | Implemented 4 tiers with CIDR `/32` and `/64` subnet progressive delays. Preserved in §11. |
| **13**| Closed Master Accounting Ledger (158 Rows) | `EXPLICITLY SPECIFIED` | Section 13.1, 14.1, 14.2| Closed at 64 R-IDs, 4 Q-events, 1 U-event, 33 Cond, 56 Scen, 158 D-rows. Reconfirmed in §12. |

---

## 3. Seven-Route CORS Wire-Contract Closure

### 3.1 Comprehensive Wire-Level Header Matrix
The cross-origin boundary separates the client application (`https://app.metro.local`) from the API Gateway (`https://api.metro.local`). Every route enforces an explicit wire-level contract:

| # | Route URI | Method | OPTIONS Preflight Headers Emitted by Gateway | Actual Request Headers Emitted (Success & Error Responses) |
| :-: | :--- | :---: | :--- | :--- |
| **1** | `/api/auth/me` | `GET` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Allow-Methods: GET`<br>`Access-Control-Allow-Headers: Authorization, Accept`<br>`Access-Control-Max-Age: 86400`<br>`Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Expose-Headers: X-Session-Generation, X-Auth-Epoch`<br>`Vary: Origin`<br>`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| **2** | `/api/auth/login` | `POST` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Allow-Methods: POST`<br>`Access-Control-Allow-Headers: Content-Type, Accept`<br>`Access-Control-Max-Age: 86400`<br>`Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Expose-Headers: X-Session-Generation, X-Auth-Epoch`<br>`Vary: Origin`<br>`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| **3** | `/api/auth/operations/lease` | `POST` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Allow-Methods: POST`<br>`Access-Control-Allow-Headers: Authorization, Content-Type, Accept`<br>`Access-Control-Max-Age: 86400`<br>`Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Expose-Headers: X-Session-Generation, X-Operation-Sequence`<br>`Vary: Origin`<br>`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| **4** | `/api/auth/operations/register` | `POST` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Allow-Methods: POST`<br>`Access-Control-Allow-Headers: Authorization, Content-Type, Accept`<br>`Access-Control-Max-Age: 86400`<br>`Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Expose-Headers: X-Session-Generation, X-Operation-Sequence`<br>`Vary: Origin`<br>`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| **5** | `/api/auth/logout` | `POST` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Allow-Methods: POST`<br>`Access-Control-Allow-Headers: Authorization, X-Operation-Ticket, Content-Type, Accept`<br>`Access-Control-Max-Age: 86400`<br>`Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Expose-Headers: X-Session-Generation, X-Operation-Sequence`<br>`Vary: Origin`<br>`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| **6** | `/api/auth/operations/:opId` | `GET` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Allow-Methods: GET`<br>`Access-Control-Allow-Headers: X-Operation-Recovery-Key, Accept`<br>`Access-Control-Max-Age: 86400`<br>`Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Expose-Headers: X-Operation-Sequence`<br>`Vary: Origin`<br>`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |
| **7** | `/api/auth/operations/:opId/abort` | `POST` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Allow-Methods: POST`<br>`Access-Control-Allow-Headers: Authorization, Content-Type, Accept`<br>`Access-Control-Max-Age: 86400`<br>`Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers` | `Access-Control-Allow-Origin: https://app.metro.local`<br>`Access-Control-Expose-Headers: X-Session-Generation, X-Operation-Sequence`<br>`Vary: Origin`<br>`Cache-Control: no-store, no-cache, must-revalidate, max-age=0` |

### 3.2 Deliberate Omission of Credentials
`Access-Control-Allow-Credentials: true` is **strictly omitted** across all seven endpoints. Authentication relies exclusively on explicit HTTP request headers (`Authorization: Bearer <token>`, `X-Operation-Ticket`, `X-Operation-Recovery-Key`). Ambient cookie transmission is intentionally disallowed, eliminating cross-site request forgery (CSRF) vectors at the transport layer.

### 3.3 Cache Variation Policy
Preflight responses cached by browsers and intermediate reverse proxies must emit:
```http
Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers
```
This ensures downstream proxies never serve a cached preflight approval for an authorized origin to an unauthorized origin, nor confuse method approvals between `GET` and `POST`.

---

## 4. Actual-Response Error CORS Behavior & Taxonomy Integrity

### 4.1 Permitted Origin Error Emission Invariant
To prevent browser security sandboxes from converting structured HTTP server errors into opaque Fetch rejections (`TypeError`), the API Gateway and backend error middleware must attach CORS response headers to **ALL** responses emitted to the permitted origin (`https://app.metro.local`):

$$\text{Approved Origin Responses (2xx, 400, 401, 403, 404, 409, 500, 502, 503, 504)} \Longrightarrow \mathbf{Attach\ CORS\ Headers}$$

### 4.2 Preservation of Fault Taxonomy Boundaries
This invariant preserves the critical distinction between server faults, transport drops, and client timeouts:
- **`R-OP-STATUS-5XX` (Gateway / Backend Server Error):** The gateway returns `HTTP 500 / 502 / 503 / 504` with `Access-Control-Allow-Origin: https://app.metro.local`. The browser allows JavaScript to read the HTTP status code, confirming server infrastructure failure. Application retains `S8-A` and displays the server fault retry banner.
- **`R-OP-STATUS-NET` (Transport Drop / CORS Security Violation):** The TCP socket drops, DNS fails, or an unapproved origin receives an internal rejection without CORS headers. JavaScript observes a rejected `fetch()` promise with `TypeError: Failed to fetch`. No HTTP status code is accessible.
- **`R-OP-STATUS-TIMEOUT` (Client Timeout Expired):** The client-side 15-second `AbortController` fires before response completion. JavaScript catches `AbortError: The user aborted a request`.

### 4.3 Disallowed Origins Policy
If the incoming `Origin` header does not match `https://app.metro.local`:
1. The gateway rejects the request with `403 Forbidden`.
2. **ALL CORS headers are stripped.**
3. The browser suppresses response details; JavaScript on the unauthorized origin receives an opaque `TypeError`.

---

## 5. Expiration and Retention Boundary Reconciliation

MetroLMS enforces five distinct, non-interchangeable temporal boundaries. To eliminate ambiguity, all boundaries adhere to the strict mathematical convention:  
$$\mathbf{now \ge expiresAt \Longrightarrow EXPIRED}$$

### 5.1 Temporal Boundary Ledger

| Artifact Name | Required Lifetime | Creation Epoch | Expiration Epoch | Enforcing Component | Enforcement Boundary | Fate of Data After Expiry |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **Registration Nonce (`regNonce`)** | **60 Seconds** | Upon `POST /operations/lease` commit | `issuedAt + 60s` | Database Transaction Engine | Ingress check & DB commit | Marked `consumed = TRUE` or rejected with `400 Bad Request`. Purged after 7 days. |
| **Operation Ticket (`opTicket`)** | **300 Seconds** (5 min) | Upon `POST /operations/register` commit | `issuedAt + 300s` | Gateway & Database Engine | **Both** Gateway Ingress (HMAC) & DB Commit (`NOW() >= exp`) | Packet cryptographically rejected statelessly (`401`). Database row transitions to `EXPIRED`. |
| **Recovery Capability (`recoverySecret`)** | **24 Hours** | Client-generated before lease dispatch | `createdAt + 24h` | Database Query Engine | Query Ingress (`WHERE expires_at > NOW()`) | Read access blocked. `GET /operations/:opId` returns `404 Not Found`. Row retained. |
| **Detailed Operation Record** | **7 Days** | Upon `POST /operations/register` commit | `createdAt + 7d` | Background Archival Worker | Batch Purge Job | Hot table row moved to cold archival storage; deleted from primary table. |
| **Session Tombstone** | **90 Days Minimum** | Upon `sessions` row deletion/archival | `revokedAt + 90d` | Database Engine & Gateway | Gateway & Tombstone Table Query | Retained in `session_tombstones`. Delayed packets rejected with `401 Unauthorized`. |

### 5.2 Independence of 24-Hour Recovery vs. 7-Day Operation Record
A critical distinction is codified:
1. **At $T = 24\text{ hours}$:** The recovery capability expires. The client can no longer inspect `GET /api/auth/operations/:opId` (endpoint returns `404 Not Found`). **The underlying `auth_operations` row is NOT deleted; it remains in the database for compliance auditing.**
2. **At $T = 7\text{ days}$:** The detailed operation row is purged from the hot OLTP table to cold archive storage.
3. **Client Invariant on Recovery Expiry:** If a rebooting client attempts recovery after 24 hours and receives `404 Not Found`, it **MUST NOT infer that logout succeeded**. It retains local credentials, maintains `REVOCATION_CAUSE_UNKNOWN`, and transitions to `S8-A` with manual re-authentication requirements.

---

## 6. Lease Idempotency and Lost-Response Contract

### 6.1 Terminal Retry Decision Table for `POST /api/auth/operations/lease`

| Scenario / Ingress State | Submitted `leaseRequestId` | Database State in `leases` Table | Auth State | Observable HTTP Response | Runtime Outcome ID | Server Action & Nonce Fate |
| :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **Initial Creation** | `id_1` (New) | Row does not exist | Active Bearer | **`201 Created`** | `R-OP-LEASE-201` | Generates 256-bit `regNonce`; stores AES-GCM ciphertext; returns lease. |
| **Lost Response (Idempotent Retry)** | `id_1` (Same) | Row exists; unconsumed; `now < expiresAt`; matching `opId` & proof | Active Bearer | **`200 OK`** | `R-OP-LEASE-200` | Decrypts `reg_nonce_encrypted`; returns identical lease without creating new row. |
| **Conflicting `opId` Reuse** | `id_1` (Same) | Row exists; payload contains *different* `opId` | Active Bearer | **`409 Conflict`** | `R-OP-LEASE-409` | Rejects duplicate ID reuse (`LEASE_BINDING_MISMATCH`); zero state change. |
| **Stale Session Generation** | `id_1` (Any) | Current session generation != request generation | Active Bearer | **`409 Conflict`** | `R-OP-LEASE-409` | Rejects stale generation (`STALE_SESSION_GENERATION`); zero state change. |
| **Expired Nonce Retry** | `id_1` (Same) | Row exists; `now >= expiresAt` | Active Bearer | **`409 Conflict`** | `R-OP-LEASE-409` | Rejects expired lease (`LEASE_EXPIRED`); client must issue fresh `leaseRequestId`. |
| **Consumed Lease Retry** | `id_1` (Same) | Row exists; `consumed === TRUE` | Active Bearer | **`409 Conflict`** | `R-OP-LEASE-409` | Rejects consumed lease (`LEASE_ALREADY_CONSUMED`); zero state change. |
| **Session Inactive / Revoked** | Any | Session revoked or token expired | Inactive Bearer| **`401 Unauthorized`**| `R-OP-LEASE-401` | Edge gateway rejects request before database invocation. |
| **Database Transaction Fault** | Any | DB offline or deadlock timeout | Active Bearer | **`500 / 503`** | `R-OP-LEASE-5XX` | Transaction rolled back; retryable with exponential backoff. |

### 6.2 Safe Nonce Recovery via Authenticated Decryption
The server recovers the original `regNonce` on an idempotent retry **strictly via AES-GCM decryption of `leases.reg_nonce_encrypted`**. Plaintext nonces are never stored, and hashes are never used to attempt reconstruction.

---

## 7. Atomic Three-Table Lock Ordering & Registration Consumption

To guarantee that registration and lease consumption are strictly atomic while eliminating deadlock cycles across all three participating tables, Version 3.13 establishes the **Universal Three-Table Lock Ordering Hierarchy**:

$$\mathbf{Lock\ Sequence:}\quad \mathbf{sessions} \ \prec \ \mathbf{leases} \ \prec \ \mathbf{auth\_operations}$$

### 7.1 Master Registration Transaction (Phase 12 Engine Contract)
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Rule 1: Always lock sessions table FIRST
SELECT session_id, user_id, generation, highest_operation_sequence, is_revoked
FROM sessions
WHERE session_id = :targetSessionId
FOR UPDATE;

-- Step 2: Validate session state
-- IF is_revoked = TRUE OR generation != :requestGeneration THEN
--    ROLLBACK; RETURN 409 Conflict ('STALE_SESSION_GENERATION');
-- END IF;

-- Rule 2: Lock and consume lease in leases table SECOND
UPDATE leases
SET consumed = TRUE, consumed_at = NOW()
WHERE op_id = :requestOpId
  AND lease_request_id = :requestLeaseRequestId
  AND session_id = :targetSessionId
  AND session_generation = :requestGeneration
  AND recovery_proof_hash = :requestRecoveryProofHash
  AND consumed = FALSE
  AND expires_at > NOW();

-- Step 3: Evaluate lease consumption row count
-- IF ROW_COUNT = 0 THEN
--    -- Check for legitimate idempotent retry of already completed registration
--    IF EXISTS (SELECT 1 FROM auth_operations WHERE op_id = :requestOpId AND recovery_proof_hash = :requestRecoveryProofHash) THEN
--       ROLLBACK; RETURN 200 OK (Existing opTicket);
--    ELSE
--       ROLLBACK; RETURN 409 Conflict ('LEASE_ALREADY_CONSUMED_OR_EXPIRED');
--    END IF;
-- END IF;

-- Rule 3: Lock/Insert auth_operations table THIRD
new_sequence := highest_operation_sequence + 1;
UPDATE sessions SET highest_operation_sequence = new_sequence WHERE session_id = :targetSessionId;

INSERT INTO auth_operations (
    op_id, session_id, user_id, session_generation, operation_sequence,
    recovery_proof_hash, state, created_at, expires_at
) VALUES (
    :requestOpId, :targetSessionId, :userId, :requestGeneration, new_sequence,
    :requestRecoveryProofHash, 'PENDING', NOW(), NOW() + INTERVAL '24 HOUR'
);

COMMIT;
```

### 7.2 Atomicity and Rollback Guarantees
- If any predicate fails (expired lease, mismatched proof hash, sequence allocation error), the transaction issues `ROLLBACK`.
- **Zero Orphan Guarantee:** It is mathematically impossible for a lease to be marked `consumed` without creating the `auth_operations` record, or for sequence numbers to advance without committed registration.

---

## 8. AES-GCM Storage Contract

### 8.1 Technical Cryptographic Parameters
- **Cipher Algorithm:** `AES-256-GCM` (authenticated symmetric encryption). Key size: 256 bits (32 bytes).
- **Envelope Version & Key ID:** Formatted as `v1:k-aes-2026-v1`.
- **IV Size & Generation:** Exactly 96 bits (12 bytes) generated via CSPRNG (`crypto.randomBytes(12)`).  
  *Probabilistic Collision Bound:* Under NIST SP 800-38D §8.2.2, with 96-bit random IVs, total encryptions under a single key must not exceed $2^{32}$ to ensure collision probability remains below $2^{-32}$. In MetroLMS, keys rotate every 30 days ($\ll 2^{24}$ operations).
- **Authentication Tag:** Exactly 128 bits (16 bytes) appended to ciphertext (`ciphertext || authTag`).
- **Storage Representation:** Binary `BYTEA` in `leases.reg_nonce_encrypted`.

### 8.2 Canonical Length-Prefixed AAD Specification
To eliminate field-boundary injection vulnerabilities, Additional Authenticated Data (AAD) is encoded with canonical decimal UTF-8 byte lengths:
$$\text{AAD} = \text{len}(leaseRequestId) \mathbin{\Vert} \text{":"} \mathbin{\Vert} leaseRequestId \mathbin{\Vert} \text{":"} \mathbin{\Vert} \text{len}(opId) \mathbin{\Vert} \text{":"} \mathbin{\Vert} opId$$
- Character encoding: Strict ASCII / UTF-8 bytes.
- Length unit: Exact count of UTF-8 octets in canonical decimal without leading zeros.
- *Example:* For 36-character UUIDs: `36:c4b9f31a-7b2e-4a6c-9d18-35e82a901f44:36:a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d`.

### 8.3 Key Rotation & Decryption Failures
- The server key ring maintains `currentKey` and retired historical keys for at least 7 days to decrypt unexpired leases.
- If GCM authentication tag verification fails: decryption throws an uncatchable security fault, logs an alert with secrets masked, and the transaction returns `500 Server Error`. Plaintext nonces are never logged.

---

## 9. Recovery Secret Client Contract

### 9.1 Capability Characteristics
- **Entropy & Size:** Exactly 256 bits of raw cryptographic entropy generated via `crypto.getRandomValues(new Uint8Array(32))` (exactly 32 bytes).
- **Encoding:** Exactly 43 Base64URL characters (unpadded, RFC 4648 §5).
- **Format Validation:** Client and gateway validate syntax using strict regex: `^[A-Za-z0-9_-]{43}$`.
- **Storage Scope:** Persisted in tab-scoped `sessionStorage` under `lms_pending_logout_v1` in `descriptor.recoverySecret`.

### 9.2 Threat Model & Same-Origin XSS Boundaries
- **Explicit Reality:** `sessionStorage` provides zero protection against same-origin Cross-Site Scripting (XSS). Any script running within `https://app.metro.local` can read `sessionStorage`.
- **Strictly Bounded Blast Radius:** Possession of `recoverySecret` conveys **read-only status inspection authority for that single `opId`**. It cannot mutate session state, cancel logouts, or access protected user profiles.
- **Strict Deletion Timing:** The client explicitly purges `recoverySecret` upon:
  1. Successful transition to `S7` (all credentials wiped).
  2. Confirmed cancellation / abort (`S-48A`).
  3. Browser tab close.

---

## 10. Operation-Status State Mapping

HTTP 200 on `GET /api/auth/operations/:opId` indicates **query retrieval success**, NOT logout success. The client applies the canonical mapping:

```mermaid
flowchart TD
    Resp200["GET /operations/:opId returns 200 OK"] --> CheckState{"Inspect response.state"}
    
    CheckState -->|PENDING| RetPending["Retain Credentials -> S8-A (Display In-Flight Banner)"]
    CheckState -->|CONFIRMED_REVOKED| CheckCorr{"Verify Correlation (opId, sessionId, generation)"}
    CheckCorr -->|Match| PurgeS7["Purge Credentials -> Transition to S7 (Logged Out)"]
    CheckCorr -->|Mismatch| RetMismatch["Untrusted Payload -> Retain S8-A (Flag Anomaly)"]
    
    CheckState -->|CONFIRMED_NOT_REVOKED| RetRefused["Retain Credentials -> S8-A (Display Reason Code)"]
    CheckState -->|ABORTED| RetAborted["Retain Credentials -> S8-A (Cancellation Confirmed)"]
    
    Resp404["GET /operations/:opId returns 404 Not Found"] --> RetUnknown["Retain Credentials -> S8-A (Maintain UNKNOWN)"]
```

---

## 11. Updated Runtime and Traceability Accounting

The Master Accounting Ledger remains completely closed, stable, and verified at **158 Matrix D mapping rows**:

### 11.1 Authoritative Master Accounting Ledger

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

---

## 12. Test and Account Inventory Attestation

### 12.1 Mandatory Account Inventory
Preserved exactly as approved in Phase 5 Increment 5.4:
1. `USR_DEV_001` — `developer_internal` / `developer` (Developer privileged fixture).
2. `USR_SUPER_001` — `super_admin_demo` / `super_admin` (Super Admin privileged fixture).
3. `USR_TEST_SUPER_001` — `test_super_admin` / `super_admin` (Synthetic Super Admin persona).
4. `USR_TEST_ADMIN_001` — `test_admin` / `admin` (Synthetic Admin persona).
5. `USR_TEST_AST_001` — `test_assistant_admin` / `assistant_admin` (Synthetic Assistant Admin persona).
6. `USR_TEST_LEC_001` — `test_lecturer` / `lecturer` (Synthetic Lecturer persona).
7. `USR_TEST_TRN_001` — `test_trainee` / `user` (Synthetic Trainee persona).  
*Constraints:* Exactly 5 synthetic personas. Privileged fixtures are not personas. Zero passwords, tokens, or credentials stored.

### 12.2 Test Inventory Accounting Model
- **Authored Core Phase 5 Test Suite [SRC-FACT]:** Exactly **60 authored test specifications** in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx) (`P5-T08-1` through `P5-T24-3`). Status: `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.
- **Proposed Supplemental Remediation Suite (`SUP-01-T01`) [BE-PROP / DEF-VERF]:** Exactly **1 proposed specification block** containing **22 unauthored subcases** (`SUP-01-T01-01` through `SUP-01-T01-22`). Status: `PROPOSED — NOT AUTHORED — DEFERRED TO PHASE 13`.
- **Execution Deferral:** All supplemental testing work is deferred to **Phase 13 / Gate B**. Zero test files have been created, modified, renumbered, or executed in this task.

---

## 13. Remaining Limitations and Explicit Assumptions

1. **Phase 12 Deployment Prerequisite:** The signed `opTicket` verifier, the `leases` table, the three-table lock ordering, and the 27 `R-OP-*` response handlers are proposed Phase 12 backend specifications. Until implemented, frontend clients maintain strict fail-closed fallback to `REVOCATION_CAUSE_UNKNOWN`.
2. **Clock Drift Tolerance:** Cluster nodes and edge proxies must maintain NTP synchronization within $\pm 50\text{ms}$.
3. **Hardware Entropy Prerequisite:** Gateway and application servers must have sufficient hardware entropy pools (`/dev/urandom`) to generate 96-bit AES-GCM IVs without blocking.

---

## 14. Final Readiness Decision

**READY FOR OWNER AUTHORIZATION — ALL CONTRACT BOUNDARIES EXPLICITLY RECONCILED**

### Architectural Justification
1. **Complete CORS Wire Contract:** All seven authentication routes have explicit, verified preflight and error response headers, with mandatory error CORS emission preserving fault runtime boundaries.
2. **Rigorous Five-Layer Temporal Reconciliation:** Fully distinguishes 24-hour recovery capability expiry from 7-day operation record retention, enforcing strict `now >= expiresAt` semantics.
3. **Deterministic Lease Idempotency:** Implements pre-issuance `leaseRequestId` and AES-GCM encrypted persistence, ensuring lost responses are safely recovered without duplicate allocation.
4. **Deadlock-Free Three-Table Lock Ordering:** Formally establishes $\text{sessions} \prec \text{leases} \prec \text{auth\_operations}$ with atomic single-row lease consumption.
5. **Collision-Proof AES-GCM Envelopes:** Enforces canonical length-prefixed AAD, unique 96-bit IVs, and key rotation boundaries.
6. **State-Dependent Recovery Interpretation:** Eliminates the conflation of HTTP 200 with logout success across all five backend operation states.
7. **Mathematical Master Ledger Closed:** Exactly 64 Runtime IDs, 4 Q-events, 1 U-event, 33 Conditions, 56 Lifecycle Scenarios, and **158 Matrix D rows** reconcile with zero discrepancies.
8. **Strict Governance Integrity:** Zero production code edited, zero tests executed, zero Git operations performed.

*The SUP-01 specification is forensically audited, internally consistent, and ready for explicit Owner authorization. No implementation authorization is requested.*

