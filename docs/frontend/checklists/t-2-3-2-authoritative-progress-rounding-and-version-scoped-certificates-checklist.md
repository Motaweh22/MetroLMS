# T-2.3.2 Checklist — Authoritative Progress Rounding & Version-Scoped Certificate Issuance (`MFR-09`, `MFR-46`, `D-12`, `D-13`)

> **Task ID:** `Phase 2 → WP-2.3 → T-2.3.2`
> **Work Package:** `WP-2.3 — Progress Rounding (D-12), Curriculum Versioning (Rule B) & Certificates (D-13)`
> **Target Work Package Checkpoint:** [`CP-007`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) *(Accepted & Published)*
> **Upstream Dependency:** [`T-2.3.1 — Published Course Versions & Substantive vs. Metadata Diffing`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/t-2-3-1-published-course-versions-and-diffing-report.md) (`IMPLEMENTED — VERIFICATION PENDING`)
> **Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`
> **Verification Status:** `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`

---

## 1. Scope & Architectural Guardrails

- [x] **1.1 Preflight Documentation Alignment:** Read `AGENTS.md`, `CURRENT.md`, `active-roadmap.md` (§4.3, §5.2, §6, §7), `domain-business-rules.md` (§4, §6), `decision-register.md` (`D-12`, `D-13`), `pre-backend-migration-remediation-roadmap.md` (Phase 7 / `MFR-09`, `MFR-10`, `MFR-46`), and `T-2.3.1` implementation report/checklist.
- [x] **1.2 Strict Scope Enforcement:** Restrict implementation strictly to `D-12` authoritative progress rounding & clamping (`[0, 100]`, `99%` cap when `completedRequiredItems < totalRequiredItems`, `0%` on empty curriculum) and `D-13` / `MFR-46` version-scoped certificate issuance (`CertificateRecord` bound to `courseVersionNumber`, `attemptId`, `userId`, `courseId`, `verificationCode`, `issuedAt`).
- [x] **1.3 Upstream & Historical Preservation:** Preserve `T-2.3.1` (`PublishedCourseVersion` ledger & `Rule B` diffing) and all 18 uncommitted Phase 5 working-tree files without modification.

---

## 2. Authoritative Progress Rounding & Clamping (`D-12`, `MFR-09`)

- [x] **2.1 Core Calculator (`calculateTraineeProgress`):** Verify [`frontend/src/core/domain/progress.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/domain/progress.ts) enforces `Math.round((completedRequiredCount / totalRequiredCount) * 100)` clamped to `[0, 100]`, returns `0` when `totalRequiredCount === 0`, and caps displayed percentage at `99%` whenever `completedRequiredCount < totalRequiredCount` (including `199/200`).
- [x] **2.2 Store-Level `computeAttemptProgress(attemptId)` Helper:** Expose deterministic `computeAttemptProgress(attemptId)` in [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) returning `ComputedAttemptProgress` (`completedRequiredItems`, `totalRequiredItems`, `completedItemIds`, `progressPercent`, `isCompleted`, `courseVersionNumber`, `isSealed`).
- [x] **2.3 Fix `completeAttemptLessonItem` (`D-12` Violations):** Replace raw `courseItems.length > 0 ? Math.round(...) : 100` in `completeAttemptLessonItem` with `calculateTraineeProgress(courseItems.length, validCompleted.length)` and strict `isCompleted = courseItems.length > 0 && validCompleted.length === courseItems.length`.
- [x] **2.4 Unify All 7 Progress Readers onto `D-12` + `Rule B`:**
  - [x] `getAttemptProgress` & `getCourseProgress` (Learning Player & Course Details)
  - [x] `markLessonComplete`, `recordLessonActivity`, & `completeAttemptLessonItem` (Attempt Mutation Paths)
  - [x] `getEnrolledCoursesForUser` (Student Dashboard & Profile)
  - [x] `getGroupDetails` & `getGroupMetrics` (Group Supervision & Group Metrics — including `contentVersion` validation in legacy fallback)
  - [x] `getCourseAnalytics` & `getCoursePerformanceReport` (Instructor Analytics & Reports — fixing `getCoursePerformanceReport` to use `getValidCompletedItemIdsForAttempt` and `isCompleted` instead of `progressPercent >= 100`)
  - [x] `getUserTranscript` (Admin User Transcript — fixing `isCompleted || progressPercent === 100` to strict `isCompleted` and adding `contentVersion` check in legacy fallback)
  - [x] `reconcileActiveAttemptsForPublishedCourseVersion` (Post-Publish `Rule B` Attempt Reconciliation)

---

## 3. Version-Scoped Certificate Issuance (`D-13`, `MFR-46`)

- [x] **3.1 Domain Types (`CertificateRecord` & `ComputedAttemptProgress`):** Define and export `CertificateRecord` and `ComputedAttemptProgress` in [`frontend/src/core/courses/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts), and expose optional `certificates?: CertificateRecord[]` on `CourseProgress` ([`frontend/src/features/learning-player/types/index.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/types/index.ts)), `UserTranscriptCourseItem`, and `UserTranscriptDTO` ([`frontend/src/core/user-management/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/user-management/types.ts)).
- [x] **3.2 Store Certificate Collection & Lifecycle:** Add `certificates: CertificateRecord[]` to `InMemoryStore` with support in `reset()`, `captureExecutionSnapshot()`, `restoreExecutionSnapshot()`, and `deleteCourse()`.
- [x] **3.3 `issueCourseVersionCertificate` & Query Helpers:** Implement `issueCourseVersionCertificate`, `getUserCertificates`, `getAttemptCertificates`, and `getCourseCertificates` in `inMemoryStore.ts`:
  - [x] Bind each certificate to `userId` (canonical), `courseId`, `attemptId`, `attemptNumber`, `courseVersionNumber` (`courseVersion`), `certificateLabel` (`Certificate — Course Version N`), `certificateLabelAr` (`شهادة إتمام — الإصدار N`), `courseTitleSnapshot`, `traineeNameSnapshot`, `verificationCode`, and `issuedAt`.
  - [x] Enforce idempotency per `(userId, courseId, attemptId, courseVersionNumber)` so repeated completion calls or re-reads never duplicate certificates.
  - [x] Preserve Version 1 certificate intact when Version 2 is published (`Rule B` progress drop from `100%` to `< 100%`), and issue a separate Version 2 certificate when Version 2 is subsequently completed.
  - [x] Support distinct attempt-scoped certificates across separate attempts (e.g., Group Cycle 1 vs. Group Cycle 2) and retained continuation attempts (`D-07` `self:continued:${groupId}:${attemptId}`).
  - [x] Block certificate issuance when `accessMode === 'review_only'` (`keep_no_cert`), when course is unpublished/draft, in preview mode (`MFR-21`), or when completion is `< 100%` (including `199/200` `99%` cap).
- [x] **3.4 Automatic Issuance on Attempt Completion:** Trigger `issueCourseVersionCertificate` automatically inside `markLessonComplete`, `completeAttemptLessonItem`, and `reconcileActiveAttemptsForPublishedCourseVersion` (when a newly published version is already 100% satisfied by an active attempt under `'full'` access mode, e.g., after a metadata-only edit or item deletion).

---

## 4. Regression Test Suite (`WRITTEN — NOT EXECUTED`)

- [x] **4.1 Author `frontend/src/test/progress-rounding-and-versioned-certificates.test.ts`:**
  - [x] Scenarios 1–9: `D-12` Progress Rounding (`0/5 -> 0%`, `1/3 -> 33%`, `2/3 -> 67%`, `1/6 -> 17%`, `5/6 -> 83%`, `3/3 -> 100%`, `0/0 -> 0% & isCompleted: false`, `199/200 -> 99% & isCompleted: false`, `200/200 -> 100% & isCompleted: true`)
  - [x] Scenarios 10–13: Cross-Surface Progress Consistency (`Rule B` substantive addition `3/3 -> 3/4 = 75%`, substantive replacement `3/3 -> 2/3 = 67%`, metadata-only rename `3/3 -> 100%`, and identical percentage across all 7 progress readers)
  - [x] Scenarios 14–22: `D-13` Version-Scoped Certificates (Version 1 issuance, Version 2 publish preservation of Version 1 cert, Version 2 completion issuing second cert, idempotency per `(userId, courseId, attemptId, courseVersionNumber)`, separate attempts issuing separate certs, `D-07` continuation attempt eligibility, `review_only` / `keep_no_cert` non-issuance, draft/unpublished non-issuance, and `199/200` non-issuance)

---

## 5. Documentation & State Synchronization

- [x] **5.1 Implementation Report:** Create [`docs/frontend/reports/t-2-3-2-authoritative-progress-rounding-and-version-scoped-certificates-report.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/t-2-3-2-authoritative-progress-rounding-and-version-scoped-certificates-report.md), mirror to conversation artifact directory, and index in `docs/frontend/reports/README.md`.
- [x] **5.2 Project State Synchronization:** Update `docs/project-state/active-roadmap.md` and `docs/project-state/CURRENT.md` to set `T-2.3.2` to `IMPLEMENTED — VERIFICATION PENDING` (preserving `WP-2.3` as `IN PROGRESS` and `CP-007` reserved for Owner acceptance).

---

## 6. Formal Owner Acceptance Reference

- **Work Package Acceptance:** `WP-2.3` was formally reviewed, accepted, and closed by the Owner on `2026-11-10`.
- **Checkpoint Publication:** Certified under immutable checkpoint [`CP-007-2026-11-10-wp-2-3-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md).
- **Verification Status Distinction:** Task implementation is accepted and static consistency verified (`CONSISTENT — READY FOR OWNER ACCEPTANCE`). All 22 authored regression test specifications remain `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (scheduled for consolidated runtime execution in `Phase 4 / Gate B / T-4.4.1`). Task status remains `IMPLEMENTED — VERIFICATION PENDING (GATE B)`.


