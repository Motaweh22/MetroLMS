# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 12 — Course Attempts & Isolation (`D-06`)

> **Document Title:** Technical Domain Specification — Course Attempts & Isolation  
> **Document Identifier:** `METROLMS-TECH-DOM-012`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../../architecture/decision-register.md#d-06), [`D-GRP-04`](../../../architecture/decision-register.md#d-grp-04), `WP-2.4`  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `CourseAttempt` (`core/groups/types.ts`), `AttemptProgress` (`core/courses/types.ts`), `groupsApi.getTraineeCourseAttempts` (`GET /api/users/:traineeId/courses/:courseId/attempts`), `inMemoryStore.ts` (`resolveActiveAttemptForLearning`, `getAttemptAccessMode`, `isAttemptSealed`).
- **Target Backend Components (Django 5 + DRF — Proposed):** Attempt resolution & sealing middleware/service (`LLD-004`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Attempt Provisioning & Lazy Activation:**
   - Provisioned attempts initialize with `attemptNumber: null`, `startedAt: null`, `progressPercent: 0`, `completedItemIds: []`, `isSealed: false`.
   - `startAttempt` assigns sequential `attemptNumber` and `startedAt` only on first actual learning activity.
2. **Ambiguity Resolution:**
   - When multiple unsealed attempts exist for `(userId, courseId)` and no explicit `attemptId` / `groupId` / `cycleId` is supplied, the backend returns `requiresAttemptSelection` so the Learning Player prompts the learner.
3. **Sealing & Post-Deadline Access:**
   - `isSealed = true` freezes `progressPercent`, `completedItemIds`, and `sealedCourseVersion`.
   - `getAttemptAccessMode` returns `'full'`, `'review_only'`, or `'none'` based on active cycle deadline and group post-deadline policy (`WP-2.4`).

---

## 3. Validation, Authorization & Failure Scenarios

- **403 Guards:** Attempting activity or completion on `'none'` (`COURSE_ACCESS_EXPIRED`), `'review_only'` (`COURSE_ACCESS_REVIEW_ONLY`), or `isSealed === true` fails closed with `403 Forbidden`.
- **Provisional Persistence Notice:** All `CourseAttempt` columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-LRN-012`](../../../01-requirements/domains/domain-12-course-attempts-and-isolation.md)
- **Low-Level Design:** [`LLD-004`](../../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md)
- **Verification Evidence:** `enrollment-provenance.test.ts`, `post-deadline-access-enforcement.test.ts` (33 specs), `seven-surface-post-deadline-enforcement.test.ts` (23 specs) (deferred to Gate B).

