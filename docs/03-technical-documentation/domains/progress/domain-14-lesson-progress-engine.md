# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 14 — Lesson Progress Engine

> **Document Title:** Technical Domain Specification — Lesson Progress Engine  
> **Document Identifier:** `METROLMS-TECH-DOM-014`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../../architecture/decision-register.md#d-06), [`D-12`](../../../architecture/decision-register.md#d-12), `MFR-21`  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `isLessonLocked`, `resolveResumeLesson` (`core/domain/progress.ts`), `useLearningPlayer`, `useVideoProgressSync`, `learningApi.recordActivity` (`POST /api/courses/:courseId/items/:itemId/activity`), `learningApi.completeLesson` (`POST /api/courses/:courseId/items/:itemId/complete`), `learningHandlers.ts`.
- **Target Backend Components (Django 5 + DRF — Proposed):** Canonical item-scoped activity and completion endpoints updating `LessonProgress` rows inside `transaction.atomic()`.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Activity Synchronization (`recordActivity`):**
   - Updates `lastPositionSeconds`, monotonic `furthestWatchedSeconds`, `eligibleViewingSeconds`, `watchCount`, and `lastWatchedItemId`.
2. **Lesson Completion (`completeLesson`):**
   - Verifies sequential lock (`isLessonLocked`), `accessMode === 'full'`, and `!isSealed`.
   - Marks `completed = true`, stamps `completedAt` and `contentVersion`, recalculates `computeAttemptProgress`, and invokes `issueCourseVersionCertificate` if `100%` is reached.
3. **Preview Isolation (`MFR-21`):**
   - Non-trainee preview requests return simulated success (`justCompletedCourse: false`) with zero store/database writes.

---

## 3. Validation, Authorization & Failure Scenarios

- **Canonical Routes vs. Legacy Aliases (`API-REC-02`):** Production Django implements `/api/courses/:courseId/items/:itemId/{activity,complete}` only; the 4 MSW aliases (`/lessons/:itemId/*` and body-based `/courses/:courseId/{activity,complete}`) are excluded.
- **Test Coverage Gap:** `recordActivity` and `completeLesson` currently have UI integration tests without direct HTTP payload assertions (`TEST PRESENT, ASSERTION NOT VERIFIED`).
- **Provisional Persistence Notice:** `LessonProgress` fields remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-LRN-014`](../../../01-requirements/domains/domain-14-lesson-progress-engine.md)
- **Low-Level Design:** [`LLD-004`](../../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md)
- **Verification Evidence:** `learning-player.test.tsx` (28 specs), `phase-2-post-deadline-dom-and-msw.test.tsx` (18 specs), `course-review-visibility-and-preview.test.ts` (deferred to Gate B).

