# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 15 — Certificates & Verification (`D-13`)

> **Document Title:** Domain 15 — Certificates & Verification Business Rules  
> **Document Identifier:** `METROLMS-DOM-LRN-015`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../architecture/decision-register.md#d-01), [`D-12`](../../architecture/decision-register.md#d-12), [`D-13`](../../architecture/decision-register.md#d-13), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern version-scoped completion certificate issuance (`CertificateRecord`), deterministic verification codes, snapshot immutability across curriculum updates (`D-13`), retention across group archival (`D-GRP-07`), and permanent removal upon user deletion (`D-01`).
- **Domain Boundaries:**
  - *In Scope:* Eligibility gates for `issueCourseVersionCertificate`, version-scoped labels (`Certificate — Course Version N` / `شهادة إتمام — الإصدار N`), idempotency per `(userId, courseId, attemptId, courseVersionNumber)`, snapshot fields, and verification code format.
  - *Out of Scope:* PDF/print rendering styling and external QR public verification portal (no public unauthenticated certificate verification endpoint exists in the current frontend API).
- **Core Entities:** `CertificateRecord` *(persistence fields `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM15-01`** | **Version-Scoped Issuance (`D-13`)** | Every certificate is bound to a specific `courseVersionNumber` and `attemptId` (`شهادة إتمام — الإصدار N`). Completing Version 2 issues a new Version 2 certificate while keeping Version 1 intact. | `issueCourseVersionCertificate` |
| **`INV-DOM15-02`** | **Strict Eligibility Gate (`D-12`, `MFR-21`, `WP-2.4`)** | Issuance requires: (1) published/live course, (2) matching `attemptId`, (3) non-preview trainee role, (4) active `'full'` accessMode (never `'review_only'` / `keep_no_cert`), and (5) `100%` completion (`totalRequiredItems > 0 && completedRequiredItems === totalRequiredItems`). | `issueCourseVersionCertificate` (`inMemoryStore.ts` L1593) |
| **`INV-DOM15-03`** | **Idempotent Per-Version Issuance** | At most one `CertificateRecord` is issued per `(userId, courseId, attemptId, courseVersionNumber)`. | Certificate Store / DB Unique Index |
| **`INV-DOM15-04`** | **Snapshot & Verification Code Integrity** | Each record captures `courseTitleSnapshot`, `traineeNameSnapshot`, `issuedAt`, and `verificationCode` (`METRO-CERT-<COURSEID>-V<N>-<ATTEMPTID>` in prototype). | Certificate Builder |
| **`INV-DOM15-05`** | **Lifecycle Retention & Deletion (`D-01`, `D-GRP-07`)** | Certificates remain accessible in `/my-certificates` even when a training group is archived (`D-GRP-07`), but are permanently deleted when the user account is deleted (`D-01`). | User Deletion Cascade / Group Archive |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `D-13` version-scoped certificates; `D-12` strict 100% gate; `D-GRP-07` retention on archival; `D-01` cascade delete on user deletion.
- **Current Prototype Behavior:** `CertificateRecord` (`frontend/src/core/courses/types.ts` L132–146) and `inMemoryStore.issueCourseVersionCertificate` (L1593–1728). Certificates are currently read via store/profile/transcript queries; no standalone `/api/certificates` REST endpoint exists in the 110-op frontend API surface.
- **Implementation Gap:** Verification code uses deterministic concatenation in prototype rather than cryptographically unguessable server-generated code; public QR verification endpoint is not yet implemented.
- **Target Backend Behavior:** Django issues certificates atomically when `computeAttemptProgress` reaches `100%` under `'full'` accessMode, enforcing a unique constraint on `(user_id, course_id, attempt_id, course_version_number)`.
- **Proposed Improvement (Unapproved):** Use server-generated random/signed verification tokens in Phase 12 rather than predictable ID concatenation.
- **Deferred / Provisional Notice:** `CertificateRecord` schema columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec / LLD | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM15-01`–`INV-DOM15-04` | [`D-12`](../../architecture/decision-register.md#d-12), [`D-13`](../../architecture/decision-register.md#d-13) | [`LLD-004`](../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md), [`METROLMS-TECH-DOM-015`](../../03-technical-documentation/domains/certificates/domain-15-certificates-and-verification.md) | `progress-rounding-and-versioned-certificates.test.ts` (19 specs) |
| `INV-DOM15-05` | [`D-01`](../../architecture/decision-register.md#d-01), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07) | [`METROLMS-TECH-DOM-015`](../../03-technical-documentation/domains/certificates/domain-15-certificates-and-verification.md) | `post-deadline-access-enforcement.test.ts` (33 specs) |

