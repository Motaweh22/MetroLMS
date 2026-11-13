# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 15 — Certificates & Verification (`D-13`)

> **Document Title:** Technical Domain Specification — Certificates & Verification  
> **Document Identifier:** `METROLMS-TECH-DOM-015`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../../architecture/decision-register.md#d-01), [`D-12`](../../../architecture/decision-register.md#d-12), [`D-13`](../../../architecture/decision-register.md#d-13), [`D-GRP-07`](../../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `CertificateRecord` (`core/courses/types.ts`), `inMemoryStore.issueCourseVersionCertificate`, `getUserCertificates`, `getAttemptCertificates`, `getCourseCertificates`, and transcript/profile readers.
- **Target Backend Components (Django 5 + DRF — Proposed):** `CertificateService` creating immutable `CertificateRecord` rows with unique constraint on `(user_id, course_id, attempt_id, course_version_number)`.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Automatic Version-Scoped Issuance (`D-13`):**
   - Triggered when `completeLesson` brings `computeAttemptProgress` to `100%` under `accessMode === 'full'` for a non-preview trainee on a published/live course.
   - Preserves existing Version `k` certificates when Version `k+1` is published and completed.
2. **Immutable Snapshots:**
   - Captures `courseTitleSnapshot`, `traineeNameSnapshot`, `courseVersionNumber`, `certificateLabel` / `certificateLabelAr` (`شهادة إتمام — الإصدار N`), `verificationCode`, and `issuedAt`.
3. **Archival & Deletion Rules:**
   - Retained across group archival (`D-GRP-07`); permanently deleted on user deletion (`D-01`).

---

## 3. Validation, Authorization & Failure Scenarios

- **No Standalone REST Endpoint Yet:** The current 110-op frontend API surface has no dedicated `/api/certificates` endpoint (certificates are read via user transcript/enrollment/store queries); adding a dedicated endpoint or public verification endpoint is a future Phase 5/12 decision if required.
- **Provisional Persistence Notice:** `CertificateRecord` columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-LRN-015`](../../../01-requirements/domains/domain-15-certificates-and-verification.md)
- **Low-Level Design:** [`LLD-004`](../../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md)
- **Verification Evidence:** `progress-rounding-and-versioned-certificates.test.ts` (19 specs), `post-deadline-access-enforcement.test.ts` (33 specs) (deferred to Gate B).

