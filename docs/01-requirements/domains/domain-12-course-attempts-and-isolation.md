# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 12 — Course Attempts & Isolation (`D-06`)

> **Document Title:** Domain 12 — Course Attempts & Isolation Business Rules  
> **Document Identifier:** `METROLMS-DOM-LRN-012`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../architecture/decision-register.md#d-01), [`D-06`](../../architecture/decision-register.md#d-06), [`D-07`](../../architecture/decision-register.md#d-07), [`D-13`](../../architecture/decision-register.md#d-13), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Guarantee strict progress, completion, and certificate isolation at the `CourseAttempt` (`attemptId`) level so that learning activity in one context (Group 1, Group 2, Renewal Cycle 1 vs. Cycle 2, or standalone self-enrollment) never leaks into or overwrites another (`D-06`).
- **Domain Boundaries:**
  - *In Scope:* `CourseAttempt` creation, lazy `attemptNumber` / `startedAt` assignment on first learning activity, unambiguous attempt resolution (`requiresAttemptSelection`), sealed historical attempts (`isSealed = true`), and post-deadline access mode (`full`, `review_only`, `none`).
  - *Out of Scope:* `EnrollmentSourceGrant` provenance creation (Domain 11) and mathematical percentage rounding (`LLD-004`, Domain 13).
- **Core Entities:** `CourseAttempt`, `AttemptProgress` *(persistence fields `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM12-01`** | **Attempt-Keyed Progress Storage (`D-06`)** | All lesson progress (`itemsProgress`), `completedItemIds`, `lastWatchedItemId`, and `progressPercent` are keyed strictly by `attemptId`, never solely by `(userId, courseId)`. | Progress Store / Service |
| **`INV-DOM12-02`** | **Lazy Attempt Activation** | Newly provisioned attempts start with `attemptNumber: null` and `startedAt: null` at `0%`. `attemptNumber` and `startedAt` are assigned only when the trainee initiates actual learning activity. | Attempt Lifecycle (`startAttempt`) |
| **`INV-DOM12-03`** | **Historical Attempt Sealing (`D-GRP-04`, `Rule B`)** | Once `isSealed === true` (upon cycle renewal or group removal), `completedItemIds`, `progressPercent`, `sealedCourseVersion`, and `lessonProgress` are immutable and immune to future `Rule B` curriculum diffs. | `LLD-002` / `LLD-003` / `LLD-004` |
| **`INV-DOM12-04`** | **Unambiguous Attempt Resolution** | When a trainee holds $> 1$ active unsealed attempt for the same `courseId` and no `attemptId`/`groupId` context is specified, the API returns `requiresAttemptSelection` rather than guessing or merging attempts. | Learning Context Resolver |
| **`INV-DOM12-05`** | **Post-Deadline Access Enforcement** | After a group cycle deadline passes, `getAttemptAccessMode` restricts mutations according to the group's post-deadline policy (`review_only` / `none` rejects activity and completion with `403`). | Learning Handlers / API |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `D-06` isolates all attempts; `D-GRP-04` seals closed cycle attempts; `WP-2.4` enforces post-deadline access barriers (`hide` vs `keep_no_cert`).
- **Current Prototype Behavior:** `frontend/src/core/groups/types.ts` (`CourseAttempt`), `core/courses/types.ts` (`AttemptProgress`), and `inMemoryStore.ts` (`resolveActiveAttemptForLearning`, `getAttemptAccessMode`, `isAttemptSealed`).
- **Implementation Gap:** Prototype resolves attempts in-memory; `CourseAttempt` table and row-level locking are deferred to Django + SQL Server.
- **Target Backend Behavior:** Django ORM enforces foreign keys from `LessonProgress` to `CourseAttempt` and blocks writes to `is_sealed = True` rows.
- **Deferred / Provisional Notice:** All `CourseAttempt` columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec / LLD | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM12-01`–`INV-DOM12-04` | [`D-06`](../../architecture/decision-register.md#d-06), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04) | [`LLD-004`](../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md), [`METROLMS-TECH-DOM-012`](../../03-technical-documentation/domains/progress/domain-12-course-attempts-and-isolation.md) | `enrollment-provenance.test.ts` (64 specs), `group-domain-reconciliation.test.ts` |
| `INV-DOM12-05` | `WP-2.4` Post-Deadline Policy | [`METROLMS-TECH-DOM-012`](../../03-technical-documentation/domains/progress/domain-12-course-attempts-and-isolation.md) | `post-deadline-access-enforcement.test.ts` (33 specs), `seven-surface-post-deadline-enforcement.test.ts` (23 specs) |

