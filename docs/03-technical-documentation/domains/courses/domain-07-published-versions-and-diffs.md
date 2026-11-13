# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 07 — Published Versions & Diffs (`Rule B`)

> **Document Title:** Technical Domain Specification — Published Course Versions & Diffs (`Rule B`)  
> **Document Identifier:** `METROLMS-TECH-DOM-007`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`Rule B`](../../../requirements/domain-business-rules.md), [`D-06`](../../../architecture/decision-register.md), [`D-12`](../../../architecture/decision-register.md), [`D-13`](../../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Types & Store Reference:**
  - `frontend/src/core/courses/types.ts`: `PublishedCourseVersion`, `PublishedCourseVersionItem`, `ChapterItem.contentVersion`, `ChapterItem.contentFingerprint`.
  - `frontend/src/features/learning-player/types/index.ts`: `LessonProgress.contentVersion`.
  - `frontend/src/core/groups/types.ts`: `CourseAttempt.isSealed`, `sealedAt`, `sealedCourseVersion`.
- **Target Backend Components (Django 5 + DRF):**
  - Atomic `CourseVersioningService` executing within SQL Server `transaction.atomic()` (`LLD-002`).
  - Immutable `PublishedCourseVersion` ledger repository and `CourseAttempt` reconciliation selector.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Snapshot Creation:**
   - Every approved publication (`executeReviewDecision` or `approveApprovalRequest`) calls `recordPublishedCourseVersionAndReconcileAttempts`.
   - Creates `PublishedCourseVersion` (`versionNumber = N + 1`) with frozen `PublishedCourseVersionItem` records containing `contentVersion` and `contentFingerprint`.
2. **6-Field Substantive Fingerprinting:**
   - Serializes `{ type, videoUrl, pdfUrl, mediaId, content, durationSeconds }` in fixed order (normalizing `undefined`/`null`/`""` to `null`, `type` defaulting to `'video'`).
   - Metadata-only changes (`title`, `description`, `order`, `duration`) keep `contentFingerprint` and `contentVersion` identical.
3. **Selective Attempt Reconciliation (`Rule B`):**
   - Only active, unsealed `CourseAttempt`s (`!isAttemptSealed(attempt)`) are reconciled.
   - Completions are cleared **only** for substantively modified `itemId`s; unchanged items remain completed; `progressPercent` recalculates deterministically (`D-12`), transitioning `'completed'` $\rightarrow$ `'in_progress'` where applicable.
   - Sealed attempts (`isSealed === true`, completed renewal cycles, revoked-only grants) remain 100% immutable.

---

## 3. Validation, Authorization & Failure Scenarios

- **Idempotency Guard:** Duplicate publication calls when `hadPendingReviewOrDraft === false` and a baseline version already exists are rejected/no-oped without creating duplicate snapshots.
- **Version-Matched Completion Check:** `isLessonCompletedForCurrentItemVersion()` rejects stale `LessonProgress` where `LessonProgress.contentVersion !== ChapterItem.contentVersion`.
- **Integration Boundaries & Constraints:** Progress rounding (`D-12`) and version-scoped certificate generation (`D-13`) are detailed in Phase 3 (Domains 13 & 15).

---

## 4. Traceability

- Business Rules: [`domain-07-published-versions-and-diffs.md`](../../../01-requirements/domains/domain-07-published-versions-and-diffs.md)
- Low-Level Design: [`LLD-002-course-versioning-diff-engine.md`](../../../02-architecture-and-design/lld/LLD-002-course-versioning-diff-engine.md)
- Implementation Report: [`t-2-3-1-published-course-versions-and-diffing-report.md`](../../../frontend/reports/t-2-3-1-published-course-versions-and-diffing-report.md)

