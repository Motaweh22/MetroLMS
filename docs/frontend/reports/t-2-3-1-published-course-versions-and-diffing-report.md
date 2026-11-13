# Implementation Report: Published Course Versions & Substantive vs. Metadata Diffing (`T-2.3.1`)

> **Phase:** `Phase 2 — Domain State, Lifecycle & Curriculum Integrity`
> **Work Package:** `WP-2.3 — Curriculum Versioning, Diffing & Version-Scoped Certificates`
> **Task ID:** `T-2.3.1`
> **Requirements:** `MFR-10`, `Rule B` (`D-06`, `D-12`)
> **Target Work Package Checkpoint:** [`CP-007`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) *(Accepted & Published)*
> **Implementation Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`
> **Test Suite Status:** `WRITTEN — NOT EXECUTED` (queued for `Phase 4 / Gate B / T-4.4.1`)

---

## 1. Executive Summary

This report records the implementation of **Task `T-2.3.1` (Published Course Versions & Substantive vs. Metadata Diffing)** under **Work Package `WP-2.3`** of the Living Master Plan ([`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md)).

The implementation enforces **`MFR-10`** and **`Rule B`** ([`docs/requirements/domain-business-rules.md`](file:///d:/LMS%20MEtro%20Project/docs/requirements/domain-business-rules.md)):
1. **Immutable `PublishedCourseVersion` Snapshot Ledger:** Every pre-seeded published course is initialized at `versionNumber: 1` with `contentVersion: 1` and a deterministic `contentFingerprint` on every `ChapterItem`. Each subsequent approved publication creates a new immutable `PublishedCourseVersion` (`versionNumber = N + 1`) while preserving all prior snapshots unchanged.
2. **Draft & Review Isolation:** Editing/saving a draft (`saveCourseDraft`), submitting a draft for review (`submitCourseForReview`), or saving staged admin edits (`saveStagedAdminEdits`) never creates a `PublishedCourseVersion` or alters active learner progress. Client-supplied publication metadata (`publishedBy`, `publishedAt`, `versionNumber`, `currentVersionNumber`, and item `contentVersion` / `contentFingerprint`) is stripped on draft save.
3. **Substantive vs. Metadata-Only Item Diffing (`Rule B`):**
   - **Substantive fields** (`type`, `videoUrl`, `pdfUrl`, `mediaId`, `content`, `durationSeconds`) are hashed in a fixed canonical key order via `computeItemSubstantiveFingerprint(item)`. When an item's fingerprint changes on approved publication, its `contentVersion` increments (`N -> N + 1`).
   - **Metadata-only fields** (`title`, `description`, `order`, formatted `duration` string) are excluded from the substantive fingerprint. Metadata-only edits preserve `item.contentVersion`, `item.contentFingerprint`, and all learner completions.
4. **Selective Reset of Active Unsealed Attempts & Preservation of Sealed Historical Attempts:**
   - When a substantive edit is published, completion is reset **only** for the substantively modified item(s) across active, unsealed `CourseAttempt`s, recalculating `progressPercent` and transitioning `status` from `'completed'` back to `'in_progress'` when applicable. Unchanged items in the same active attempt remain completed.
   - Sealed historical attempts (attempts from completed/archived renewal cycles, archived predecessor groups without active continuation grants, revoked-only grants, or explicitly sealed via `sealAttempt()`) are strictly preserved unmodified.
   - Active unsealed attempts also validate `LessonProgress.contentVersion === ChapterItem.contentVersion` via `isLessonCompletedForCurrentItemVersion()` so an older `contentVersion` completion cannot satisfy an updated item until re-completed.

---

## 2. Modified & Created Files

| File Path | Action | Summary of Changes |
| :--- | :---: | :--- |
| [`frontend/src/core/courses/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts) | `MODIFIED` | Added [`PublishedCourseVersionItem`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts#L5-L19) and [`PublishedCourseVersion`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts#L21-L39) interfaces; extended [`ChapterItem`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts#L41-L72) with `contentVersion`, `contentFingerprint`, substantive fields (`videoUrl`, `pdfUrl`, `content`, `durationSeconds`), and metadata fields (`description`, `order`); extended [`Course`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts#L106-L157) with `publishedBy`, `versionNumber`, and `currentVersionNumber`. |
| [`frontend/src/features/learning-player/types/index.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/types/index.ts) | `MODIFIED` | Extended [`LessonProgress`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/types/index.ts#L6-L24) with `contentVersion?: number`. |
| [`frontend/src/core/groups/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/groups/types.ts) | `MODIFIED` | Extended [`CourseAttempt`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/groups/types.ts#L204-L234) with `isSealed?: boolean`, `sealedAt?: string | null`, and `sealedCourseVersion?: number`. |
| [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) | `MODIFIED` | Added `publishedCourseVersions` ledger, `computeItemSubstantiveFingerprint`, `getPublishedCourseVersions`, `getLatestPublishedCourseVersion`, `getPublishedCourseVersion`, `seedInitialPublishedCourseVersion`, `isAttemptSealed`, `sealAttempt`, `isLessonCompletedForCurrentItemVersion`, `getValidCompletedItemIdsForAttempt`, `recordPublishedCourseVersionAndReconcileAttempts`, and `reconcileActiveAttemptsForSubstantiveChanges`; wired both authoritative publication paths (`executeReviewDecision` and `approveApprovalRequest`), draft metadata sanitization (`saveCourseDraft`), cycle-close sealing (`createRenewalCycle` and `checkAndProcessAutoRenewal`), and version-aware completion tracking (`markLessonComplete`, `completeAttemptLessonItem`, `getCourseProgress`, `getEligibleAttemptsForCourse`, `getGroupMetrics`, and `getUserTranscript`). |
| [`frontend/src/test/course-versioning-and-diffing.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/course-versioning-and-diffing.test.ts) | `CREATED` | Authored comprehensive Vitest regression suite (`WRITTEN — NOT EXECUTED`) covering all 13 required curriculum versioning, substantive vs. metadata diffing, unsealed attempt reset, and sealed attempt preservation scenarios. |
| [`docs/frontend/checklists/t-2-3-1-published-course-versions-and-diffing-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/t-2-3-1-published-course-versions-and-diffing-checklist.md) | `CREATED` | Task-specific verification and implementation checklist for `T-2.3.1`. |
| [`docs/frontend/checklists/README.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/README.md) | `MODIFIED` | Indexed `t-2-3-1-published-course-versions-and-diffing-checklist.md`. |
| [`docs/frontend/reports/t-2-3-1-published-course-versions-and-diffing-report.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/t-2-3-1-published-course-versions-and-diffing-report.md) | `CREATED` | Canonical implementation report for `T-2.3.1`. |

---

## 3. Technical Design & Rule B Verification Matrix

### 3.1 Substantive vs. Metadata Field Classification (`computeItemSubstantiveFingerprint`)

[`inMemoryStore.computeItemSubstantiveFingerprint`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts#L1007-L1038) serializes and hashes **only** the 6 approved substantive fields in fixed canonical order:
- `type`
- `videoUrl`
- `pdfUrl`
- `mediaId`
- `content`
- `durationSeconds`

All `undefined`, `null`, and `""` values normalize deterministically to `null` (with `type` defaulting to `'video'`), and the canonical JSON payload is hashed using 64-bit FNV-1a (`fnv1a64_<16-hex>`). Metadata-only fields (`title`, `description`, `order`, formatted `duration` string) are excluded from the fingerprint.

### 3.2 Authoritative Publication Paths & Idempotency

Both publication flows in [`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) invoke [`recordPublishedCourseVersionAndReconcileAttempts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts#L1217-L1301):
1. **Direct Review Approval (`executeReviewDecision` when `outcome === 'approved'`, [Lines 5596–5647](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts#L5596-L5647)):**
   - Guards against duplicate re-approval on an already-published course when `hadPendingReviewOrDraft` is `false` and a baseline version already exists.
2. **Governance Approval Request Execution (`approveApprovalRequest` for `courses.publish` / `COURSE_PUBLISH`, [Lines 12227–12345](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts#L12227-L12345)):**
   - Protected by atomic `in_progress` / `ALREADY_DECIDED` request guards and `hadPendingOrDraft` check.

### 3.3 Regression Test Coverage Matrix (`WRITTEN — NOT EXECUTED`)

| Test ID | Scenario | Target Method(s) | Status |
| :---: | :--- | :--- | :---: |
| `1a` | Pre-seeded published courses initialize at `versionNumber = 1` with item `contentVersion = 1` and deterministic fingerprints | `reset`, `getPublishedCourseVersions`, `computeItemSubstantiveFingerprint` | `WRITTEN — NOT EXECUTED` |
| `1b` | Newly created draft course has no published versions until approved, then creates `versionNumber = 1` with item `contentVersion = 1` | `createCourse`, `submitCourseForReview`, `executeReviewDecision` | `WRITTEN — NOT EXECUTED` |
| `2a` | Subsequent approved publications create `versionNumber = 2` and `3` (across both review and approval-request paths) while preserving `versionNumber = 1` immutably | `executeReviewDecision`, `approveApprovalRequest`, `getPublishedCourseVersion` | `WRITTEN — NOT EXECUTED` |
| `3` | Editing or saving a draft in `courseDrafts` does not create a published version or affect learner progress | `saveCourseDraft`, `getCourseProgress` | `WRITTEN — NOT EXECUTED` |
| `4` | Submitting a draft for review or saving staged admin edits does not create a published version or affect learner progress | `submitCourseForReview`, `saveStagedAdminEdits`, `getCourseProgress` | `WRITTEN — NOT EXECUTED` |
| `5` | Substantive edit to each of `videoUrl`, `durationSeconds`, `mediaId`, `content`, `type`, and `pdfUrl` increments `contentVersion` and updates `contentFingerprint` | `computeItemSubstantiveFingerprint`, `recordPublishedCourseVersionAndReconcileAttempts` | `WRITTEN — NOT EXECUTED` |
| `6` | Metadata-only edit to `title`, `description`, `order`, and formatted `duration` string preserves `contentVersion`, `contentFingerprint`, and learner completion | `recordPublishedCourseVersionAndReconcileAttempts`, `getCourseProgress` | `WRITTEN — NOT EXECUTED` |
| `7 & 8` | Substantive edit resets completion only for the modified item in active, unsealed attempts while unchanged items remain completed | `reconcileActiveAttemptsForSubstantiveChanges`, `getCourseProgress` | `WRITTEN — NOT EXECUTED` |
| `9a` | Renewal-cycle sealed historical attempts (`createRenewalCycle`) remain 100% completed while active cycle attempt is subject to `Rule B` resets | `createRenewalCycle`, `isAttemptSealed`, `getCourseProgress` | `WRITTEN — NOT EXECUTED` |
| `9b` | Explicitly sealed attempt (`sealAttempt`) remains unchanged after substantive edits | `sealAttempt`, `isAttemptSealed`, `getCourseProgress` | `WRITTEN — NOT EXECUTED` |
| `10` | Duplicate approval/publication protection prevents duplicate version snapshots | `executeReviewDecision`, `approveApprovalRequest` | `WRITTEN — NOT EXECUTED` |
| `11` | No-op publication (approved review where no items changed) creates next `PublishedCourseVersion` while preserving item `contentVersion` and learner completion | `recordPublishedCourseVersionAndReconcileAttempts` | `WRITTEN — NOT EXECUTED` |
| `12` | Multiple trainees and multiple attempts (group + standalone) are isolated correctly when item completion is reset | `reconcileActiveAttemptsForSubstantiveChanges`, `getEligibleAttemptsForCourse` | `WRITTEN — NOT EXECUTED` |
| `13a` | Active unsealed attempts reject stale `LessonProgress.contentVersion` until re-completed at the updated item `contentVersion` | `isLessonCompletedForCurrentItemVersion`, `markLessonComplete` | `WRITTEN — NOT EXECUTED` |
| `13b` | Client-supplied draft payloads cannot spoof `publishedBy`, `publishedAt`, `versionNumber`, or item `contentVersion` | `saveCourseDraft`, `executeReviewDecision` | `WRITTEN — NOT EXECUTED` |

---

## 4. Scope Boundary & Next Task

- **Scope Boundary Confirmed:** `D-12` progress rounding / formula unification across non-store callers and `D-13` / `MFR-46` version-scoped certificate issuance were strictly deferred to **`T-2.3.2`**.
- **Exact Next Task:** `Phase 2 → WP-2.3 → T-2.3.2` (`Authoritative Progress Rounding & Version-Scoped Certificate Issuance`, `MFR-09`, `MFR-46`, `D-12`, `D-13`).

---

## 5. Formal Owner Acceptance Reference

- **Work Package Acceptance:** `WP-2.3` was formally reviewed, accepted, and closed by the Owner on `2026-11-10`.
- **Checkpoint Publication:** Certified under immutable checkpoint [`CP-007-2026-11-10-wp-2-3-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md).
- **Verification Status Distinction:** Task implementation is accepted and static consistency verified (`CONSISTENT — READY FOR OWNER ACCEPTANCE`). All 15 authored regression test specifications remain `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (scheduled for consolidated runtime execution in `Phase 4 / Gate B / T-4.4.1`). Task status remains `IMPLEMENTED — VERIFICATION PENDING (GATE B)`.


