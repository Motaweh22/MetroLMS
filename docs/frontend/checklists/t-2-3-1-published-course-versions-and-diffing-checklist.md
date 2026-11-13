# Task Checklist: Published Course Versions & Substantive vs. Metadata Diffing (`T-2.3.1`)

> **Phase:** `Phase 2 — Domain State, Lifecycle & Curriculum Integrity`
> **Work Package:** `WP-2.3 — Curriculum Versioning, Diffing & Version-Scoped Certificates`
> **Task ID:** `T-2.3.1`
> **Requirements:** `MFR-10`, `Rule B` (`D-06`, `D-12`)
> **Target Work Package Checkpoint:** [`CP-007`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) *(Accepted & Published)*
> **Task Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`

---

## 1. Scope & Guardrails

- [x] **1.1 Preflight Documentation Review:** Read `AGENTS.md`, `docs/project-state/CURRENT.md`, `docs/project-state/active-roadmap.md`, `docs/requirements/domain-business-rules.md`, `docs/architecture/decision-register.md`, and `docs/backend/pre-backend-migration-remediation-roadmap.md` (§9.2 & §13 Phase 7).
- [x] **1.2 Current Source Inspection:** Inspect `frontend/src/core/courses/types.ts`, `frontend/src/features/learning-player/types/index.ts`, `frontend/src/mocks/store/inMemoryStore.ts`, `frontend/src/mocks/handlers/reviewHandlers.ts`, `frontend/src/mocks/handlers/builderHandlers.ts`, and `frontend/src/mocks/handlers/permissionsHandlers.ts`.
- [x] **1.3 Strict Scope Enforcement:** Restrict changes strictly to `T-2.3.1` (`PublishedCourseVersion` snapshots and `Rule B` substantive vs. metadata diffing). Defer `D-12` progress rounding / formula alignment and `D-13` / `MFR-46` version-scoped certificate issuance to `T-2.3.2`.

---

## 2. Domain Type Contracts (`T-2.3.1`)

- [x] **2.1 `PublishedCourseVersion` & `PublishedCourseVersionItem` Interfaces:** Add canonical interfaces in `frontend/src/core/courses/types.ts` (`courseId`, `versionNumber`, `publishedAt`, `publishedBy`, `items: Array<{ itemId, chapterId, type, contentVersion, contentFingerprint }>`).
- [x] **2.2 `ChapterItem` Versioning & Substantive/Metadata Fields:** Extend `ChapterItem` in `frontend/src/core/courses/types.ts` with optional `contentVersion`, `contentFingerprint`, substantive fields (`videoUrl`, `pdfUrl`, `mediaId`, `content`, `durationSeconds`), and metadata fields (`description`, `order`).
- [x] **2.3 `Course` Version Metadata & `CourseAttempt` Seal Fields:** Extend `Course` with optional `versionNumber`, `currentVersionNumber`, `publishedBy` and `CourseAttempt` with optional `isSealed`, `sealedAt`, `sealedCourseVersion`.
- [x] **2.4 `LessonProgress` Content Version Tracking:** Extend `LessonProgress` in `frontend/src/features/learning-player/types/index.ts` with optional `contentVersion?: number`.

---

## 3. Store Implementation (`frontend/src/mocks/store/inMemoryStore.ts`)

- [x] **3.1 Deterministic Substantive Fingerprinting (`computeItemSubstantiveFingerprint`):**
  - Serialize and hash only the 6 approved substantive fields (`type`, `videoUrl`, `pdfUrl`, `mediaId`, `content`, `durationSeconds`) in a fixed canonical key order.
  - Normalize `undefined`, `null`, and empty values consistently.
  - Exclude metadata-only fields (`title`, `description`, `order`, formatted `duration` string).
- [x] **3.2 `PublishedCourseVersion` Ledger & Baseline Seeding:**
  - Maintain `publishedCourseVersions: Record<string, PublishedCourseVersion[]>` in `inMemoryStore` (including `reset()`, `captureExecutionSnapshot()`, `restoreExecutionSnapshot()`, `deleteCourse()`, and `resetContentLabCourse()`).
  - Seed initial `versionNumber: 1` snapshots for pre-seeded published/live courses during `reset()` with `contentVersion: 1` on all items.
  - Expose query helpers: `getPublishedCourseVersions(courseId)`, `getLatestPublishedCourseVersion(courseId)`, `getPublishedCourseVersion(courseId, versionNumber)`.
- [x] **3.3 Draft Isolation & Security Hardening:**
  - Ensure `saveCourseDraft`, `submitCourseForReview`, and `saveStagedAdminEdits` never create a `PublishedCourseVersion` or mutate active learner progress.
  - Strip/ignore any client-supplied publication metadata (`versionNumber`, `currentVersionNumber`, `publishedAt`, `publishedBy`, and item `contentVersion` / `contentFingerprint`) in draft mutations.
  - Always derive `publishedBy` from the authenticated reviewer/approver and `publishedAt` from the authoritative store timestamp.
- [x] **3.4 Substantive vs. Metadata Diffing on Approved Publication (`Rule B`, `MFR-10`):**
  - Connect version snapshot creation and item diffing to both authoritative publication paths (`executeReviewDecision` when `outcome === 'approved'` and `approveApprovalRequest` for `courses.publish` / `COURSE_PUBLISH`).
  - Enforce idempotency so duplicate approval/publication calls do not create duplicate version snapshots.
  - Increment `item.contentVersion` (`N -> N + 1`) only when `contentFingerprint` changes.
  - Preserve `item.contentVersion` and learner completion when only metadata fields change or on no-op publication.
- [x] **3.5 Active Unsealed Attempt Invalidation & Sealed Attempt Preservation:**
  - Implement `isAttemptSealed` and `sealAttempt` (covering explicit seal flags, `expired_incomplete` status, completed/archived renewal cycles, archived predecessor groups without active continuation grants, and revoked-only grants).
  - Stamp `isSealed = true` and `sealedAt` on closing-cycle attempts in `createRenewalCycle` and `checkAndProcessAutoRenewal`.
  - When a substantive item change is published, reset completion only for the modified item in active, unsealed attempts while preserving unchanged items and preserving sealed historical attempts untouched.
  - Stamp `contentVersion` on `LessonProgress` during `markLessonComplete` and `completeAttemptLessonItem`, and enforce `contentVersion` matching for active unsealed attempts across progress readers.

---

## 4. Regression Test Suite (`WRITTEN — NOT EXECUTED`)

- [x] **4.1 Author Comprehensive Regression Tests (`frontend/src/test/course-versioning-and-diffing.test.ts`):**
  1. Initial publication creates `PublishedCourseVersion` with `versionNumber = 1` and item `contentVersion = 1`.
  2. Subsequent approved publication creates `versionNumber = 2` and preserves `versionNumber = 1`.
  3. Editing or saving a draft in `courseDrafts` does not create a published version or affect learner progress.
  4. Submitting a draft for review does not create a published version or affect learner progress.
  5. Substantive edit to `type`, `videoUrl`, `pdfUrl`, `mediaId`, `content`, or `durationSeconds` increments `contentVersion` and updates `contentFingerprint`.
  6. Metadata-only edit to `title`, `description`, `order`, or formatted `duration` string preserves `contentVersion`, `contentFingerprint`, and learner completion.
  7. Substantive edit resets completion only for the modified item in active, unsealed attempts.
  8. Unchanged items in the same active attempt remain completed.
  9. Sealed historical attempts remain unchanged after substantive edits.
  10. Duplicate approval/publication protection does not create duplicate version snapshots.
  11. No-op publication (approved without any item changes) preserves item `contentVersion` and learner completion.
  12. Multiple trainees and multiple attempts are isolated correctly when item completion is reset.
  13. Attempts cannot treat completion of an older `contentVersion` as completion of an updated item.

---

## 5. Documentation & Governance Synchronization

- [x] **5.1 Update Checklist & Index:** Mark completed items in this checklist and index it in `docs/frontend/checklists/README.md`.
- [x] **5.2 Create Implementation Report:** Write `docs/frontend/reports/t-2-3-1-published-course-versions-and-diffing-report.md` (and mirror artifact).
- [x] **5.3 Synchronize Project State:** Update `docs/project-state/active-roadmap.md` and `docs/project-state/CURRENT.md` to record `T-2.3.1` as `IMPLEMENTED — VERIFICATION PENDING` and set `T-2.3.2` as the exact next task.

---

## 6. Formal Owner Acceptance Reference

- **Work Package Acceptance:** `WP-2.3` was formally reviewed, accepted, and closed by the Owner on `2026-11-10`.
- **Checkpoint Publication:** Certified under immutable checkpoint [`CP-007-2026-11-10-wp-2-3-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md).
- **Verification Status Distinction:** Task implementation is accepted and static consistency verified (`CONSISTENT — READY FOR OWNER ACCEPTANCE`). All 15 authored regression test specifications remain `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (scheduled for consolidated runtime execution in `Phase 4 / Gate B / T-4.4.1`). Task status remains `IMPLEMENTED — VERIFICATION PENDING (GATE B)`.

