# Task Checklist: Post-Deadline Access Enforcement (`hide` vs. `keep_no_cert`, `T-2.4.1`)

> **Phase:** `Phase 2 — Core Domain Logic Reconciliation`  
> **Work Package:** `WP-2.4 — Post-Deadline Policy (hide vs. keep_no_cert) & Phase 2 Tests`  
> **Task ID:** `T-2.4.1`  
> **Requirements:** `MFR-23`, `MFR-42`  
> **Owner Decisions:** `D-06` (Per-Attempt Progress Isolation), `D-07` (Continuation Grant Eligibility), `D-12` (Authoritative Progress Rounding), `D-13` (Version-Scoped Certificates)  
> **Upstream Dependency:** [`WP-2.3 Closure (CP-007)`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) (`COMPLETED AND ACCEPTED`)  
> **Target Work Package Checkpoint:** `CP-008` *(reserved for full WP-2.4 & Phase 2 closure — not created in this task)*  
> **Implementation Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`  
> **Test Suite Status:** `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (queued for `Phase 4 / Gate B / T-4.4.1`)  

---

## 1. Scope & Objective

Task `T-2.4.1` implements the authoritative `resolveCourseAccess(userId, courseId, now)` domain resolver, reconciles course-access evaluation across multi-source enrollment grants (`EnrollmentRecord.sources`), removes the completed-trainee exemption under `postDeadlinePolicy: 'hide'` (`MFR-42`), and enforces genuine read-only (`review_only`) and hidden/denied (`none`) access modes consistently across the seven required UI, store, and API surfaces (`MFR-23`).

---

## 2. Core Domain Contract — `resolveCourseAccess`

- [x] **2.1 Authoritative Method Signature:** Implemented `inMemoryStore.resolveCourseAccess(userId: string, courseId: string, now?: Date | string): CourseAccessMode` in [`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts).
- [x] **2.2 Domain Types Updated:** Updated `CourseAccessMode = 'full' | 'review_only' | 'none'` in [`frontend/src/core/courses/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts).
- [x] **2.3 Multi-Source Precedence Rule:** Effective course access evaluates all grants in `EnrollmentRecord.sources` (and legacy fallback where applicable) according to strict precedence:
  $$\text{Effective Access} = \max(\text{grants}) \quad \text{where} \quad \text{'full'} > \text{'review\_only'} > \text{'none'}$$
- [x] **2.4 Source-Level Grant Rules:**
  - **Active Standalone Source (`kind === 'self'`, `status === 'active'`):** Grants `'full'`. Includes independent catalog self-enrollments (`self:catalog:...`) and valid D-07 continuation grants (`self:continued:...`).
  - **Active Group Source (`kind === 'group'`, `status === 'active'`):** Grants `'full'` if the group is not archived, its renewal cycle is not archived/completed, and its effective deadline is either absent (`null`) or not yet passed (`now <= deadline`).
  - **Expired or Archived Group (`keep_no_cert`):** Grants `'review_only'`.
  - **Expired or Archived Group (`hide`):** Grants `'none'`.
  - **Revoked Enrollment Source (`status === 'revoked_by_group_removal'`):** Does not grant access (`'none'`); never invalidates independent active standalone or group sources.
- [x] **2.5 Override & Boundary Consistency:**
  - Evaluates deadline and policy overrides via `getEffectiveCourseSettings(group, courseId, now, cycle)` (course override > cycle default > group default).
  - Exact deadline boundary: `now.getTime() === deadline.getTime()` remains active (`'full'`); access changes only when `now.getTime() > deadline.getTime()`.

---

## 3. MFR-42 — Removal of Completed-Trainee Exemption Under `'hide'`

- [x] **3.1 Elimination of `&& !progress.isCompleted`:** Removed the completed-trainee exemption from `getMyEnrolledCourses(userId)` in [`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts).
- [x] **3.2 Absolute Revocation Rule:** When a group course assignment expires under `postDeadlinePolicy: 'hide'`, that group-originated enrollment source grants `'none'` to all group members, including trainees who achieved 100% completion before the deadline.
- [x] **3.3 Historical Certificate Preservation:** Already-issued historical certificates in `this.certificates` remain permanently valid and preserved per `D-13`. Course discovery and player access are hidden without erasing past achievements.
- [x] **3.4 Independent Source Protection:** Trainees with a completed attempt in an expired `'hide'` group retain access if they hold an independent active standalone source or another active group assignment for that course.

---

## 4. `review_only` Access Mode Enforcement

- [x] **4.1 Read Operations Allowed:**
  - Trainees can view course details, lessons, and materials.
  - Trainees can read existing attempt progress via `getCourseProgress` (`accessMode: 'review_only'`).
  - Trainees can view and select eligible review attempts in `AttemptContextSelectorModal`.
  - `LearningPlayerPage` renders the prominent review-only warning banner (`data-testid="review-only-access-banner"`).
- [x] **4.2 Mutation Operations Blocked:**
  - `POST /api/courses/:courseId/items/:itemId/activity` (and `/lessons/:itemId/activity`) strictly rejected at store and API boundaries with `HTTP 403 Forbidden` (`COURSE_ACCESS_REVIEW_ONLY`).
  - `POST /api/courses/:courseId/items/:itemId/complete` (and `/lessons/:itemId/complete`) strictly rejected at store and API boundaries with `HTTP 403 Forbidden` (`COURSE_ACCESS_REVIEW_ONLY`).
  - Store methods `recordLessonActivity` and `markLessonComplete` throw `MockStoreError(..., 403, 'COURSE_ACCESS_REVIEW_ONLY')` before any state mutation.
  - Zero modifications to `lessonProgress`, `completedItemIds`, `progressPercent`, `lastWatched`, or `attempt.updatedAt`.
  - Certificate issuance strictly blocked: `issueCourseVersionCertificate` returns `null` for `review_only` attempts.

---

## 5. `none` Access Mode Enforcement

- [x] **5.1 Course Discovery Omission:**
  - Course is omitted from `getMyEnrolledCourses(userId)` and `getEnrolledCoursesForUser(userId)`.
  - Course is excluded from the trainee's `DashboardPage` continue-learning card and enrolled-count statistics.
- [x] **5.2 Direct Route & API Denial:**
  - Direct Learning Player navigation (`/courses/:courseId/learn`) rejected.
  - Progress query `GET /api/courses/:courseId/progress` returns `HTTP 403 Forbidden` (`COURSE_ACCESS_EXPIRED`).
  - Lesson activity and completion endpoints return `HTTP 403 Forbidden` (`COURSE_ACCESS_EXPIRED`).
  - `assertLearnerAttemptEntitlement` and `resolveActiveAttemptForLearning` throw `MockStoreError(..., 403, 'COURSE_ACCESS_EXPIRED')`.
- [x] **5.3 Mutation & Certification Barrier:** Zero progress mutations, zero playback updates, zero certificate creation.

---

## 6. Seven Contractual Surfaces Verification Matrix

| # | Contractual Surface | Enforcement Mechanism | Expected Outcome Under `review_only` | Expected Outcome Under `none` | Status |
| :-: | :--- | :--- | :--- | :--- | :---: |
| **1** | **My Courses Page** (`MyCoursesPage.tsx`, `getMyEnrolledCourses`) | Filtered via `resolveCourseAccess` | Course visible with `isExpired: true`, `canCertify: false`, `policyLabel: 'للمراجعة فقط (لا تمنح شهادة)'` | Course completely omitted from trainee view (even if 100% completed) | `VERIFIED (STATIC)` |
| **2** | **Student Dashboard** (`DashboardPage.tsx`, `getDashboardData`) | Sourced from `getMyEnrolledCourses` | Counted in enrolled courses; selectable for review | Excluded from enrolled count, completed count, and continue-learning card | `VERIFIED (STATIC)` |
| **3** | **Group Details Page** (`GroupDetailPage.tsx`) | Displays assigned course metrics and access status | Action button shows review option; content viewable | Course action disabled/locked or directs to denied player guard | `VERIFIED (STATIC)` |
| **4** | **Learning Player Route** (`LearningPlayerPage.tsx`, `/courses/:courseId/learn`) | Route guard, `useCourseProgress`, attempt selector | Opens with `review-only-access-banner`; attempt selectable | Denied with `403 COURSE_ACCESS_EXPIRED`; learner blocked | `VERIFIED (STATIC)` |
| **5** | **Progress Read API** (`GET /api/courses/:courseId/progress`) | `learningHandlers.ts` + `getCourseProgress` | Returns `200 OK` with `progress.accessMode === 'review_only'` | Returns `403 Forbidden` (`COURSE_ACCESS_EXPIRED`) | `VERIFIED (STATIC)` |
| **6** | **Activity & Completion APIs** (`POST .../activity`, `POST .../complete`) | `learningHandlers.ts` + `recordLessonActivity` + `markLessonComplete` | Returns `403 Forbidden` (`COURSE_ACCESS_REVIEW_ONLY`); 0 mutations | Returns `403 Forbidden` (`COURSE_ACCESS_EXPIRED`); 0 mutations | `VERIFIED (STATIC)` |
| **7** | **Certificate Issuance** (`issueCourseVersionCertificate`) | Guarded on `accessMode === 'full'` | Returns `null`; zero certificate issued | Returns `null`; zero certificate issued | `VERIFIED (STATIC)` |

---

## 7. Regression Test Inventory (Authored — Deferred to Gate B)

Authored in [`frontend/src/test/post-deadline-access-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/post-deadline-access-enforcement.test.ts):

| Suite | Category | Scenarios Covered | Count | Designation |
| :---: | :--- | :--- | :---: | :---: |
| **A** | **Resolver Truth Table** | Standalone active, group active before deadline, group no deadline, expired `hide`, expired `keep_no_cert`, archived `hide`, archived `keep_no_cert`, revoked grant, expired `hide` + active standalone, expired `hide` + active group, expired `keep_no_cert` + expired `hide`, revoked + active standalone, course-level deadline override, exact deadline boundary (`now === deadline`) | 14 | `WRITTEN — NOT EXECUTED` |
| **B** | **MFR-42 Completed-Trainee Regression** | 100% completed in expired `hide` group denied, incomplete in expired `hide` group denied, 100% completed with standalone override allowed, 100% completed with active group override allowed, historical certificate preservation | 5 | `WRITTEN — NOT EXECUTED` |
| **C** | **`review_only` Mutation Guards** | Content & progress read permitted, `recordLessonActivity` returns 403 `COURSE_ACCESS_REVIEW_ONLY`, `markLessonComplete` returns 403 `COURSE_ACCESS_REVIEW_ONLY`, attempt state byte-for-byte unchanged, no new certificate issued, attempt selector visibility | 6 | `WRITTEN — NOT EXECUTED` |
| **D** | **`none` Access Denial** | `getMyEnrolledCourses` omission, Learning Player route denial, `GET .../progress` returns 403 `COURSE_ACCESS_EXPIRED`, activity & completion return 403 `COURSE_ACCESS_EXPIRED`, zero store mutations | 5 | `WRITTEN — NOT EXECUTED` |
| **E** | **Seven-Surface Consistency** | Multi-surface agreement across My Courses, Dashboard, Group Details, Player, Read API, Mutation APIs, and Certificate Issuance | 3 | `WRITTEN — NOT EXECUTED` |
| **Total** | — | **Comprehensive Post-Deadline Policy Regression Suite** | **33** | `WRITTEN — NOT EXECUTED` |

---

## 8. Acceptance Criteria

- [x] `resolveCourseAccess(userId, courseId, now)` implemented and enforcing `full > review_only > none`.
- [x] Zero completed-trainee exemption: `&& !progress.isCompleted` removed from `getMyEnrolledCourses`.
- [x] Expired `'hide'` groups return `'none'`, omit courses from discovery, and reject routes/APIs with `403 COURSE_ACCESS_EXPIRED`.
- [x] Expired `'keep_no_cert'` groups return `'review_only'`, allow reads, reject mutations with `403 COURSE_ACCESS_REVIEW_ONLY`, and prevent new certificates.
- [x] Independent standalone enrollments and D-07 continuation grants retain `'full'` access regardless of other expired groups.
- [x] Historical certificates remain preserved and verifiable.
- [x] All 7 contractual surfaces enforce consistent access decisions.
- [x] 33 regression test specifications authored and documented.
- [x] Zero runtime test commands executed (Two-Gate Verification preserved).
- [x] 18 uncommitted Phase 5 working-tree files preserved unmodified.

---

## 9. Formal Owner Acceptance Reference

- **Owner Acceptance:** `APPROVED` (`2026-11-11`).
- **Independent Security Review Verdict:** `CONSISTENT WITH MINOR NOTES` (Targeted Read-Only Security Review for `T-2.4.1`).
- **Acceptance Scope:**
  - Authoritative domain resolver (`resolveCourseAccess`) enforcing multi-source precedence (`full > review_only > none`).
  - Strict separation between course-level access and attempt-scoped authorization (`getAttemptAccessMode`).
  - Pre-mutation barriers in `recordLessonActivity` and `markLessonComplete` rejecting unauthorized attempts with `403 COURSE_ACCESS_EXPIRED` (`'none'`) or `403 COURSE_ACCESS_REVIEW_ONLY` (`'review_only'`) prior to state modification.
  - Strict attempt-level certificate gating in `issueCourseVersionCertificate` blocking issuance on `'none'` or `'review_only'` attempts.
  - Complete elimination of completed-trainee exemption under `postDeadlinePolicy: 'hide'` (`MFR-42`).
  - D-07 continuation grant access and certificate eligibility preservation (`self:continued:...`).
- **Verification Status Distinction:** Task implementation is accepted and static consistency verified. All 33 authored regression test specifications in `frontend/src/test/post-deadline-access-enforcement.test.ts` remain `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (scheduled for consolidated runtime execution in `Phase 4 / Gate B / T-4.4.1`). Task status remains `IMPLEMENTED — VERIFICATION PENDING (GATE B)`.
- **Assigned Follow-Up Test Requirements (Non-Blocking):**
  1. *Multi-Attempt Cross-Mutation Tests:* Explicit scenarios verifying simultaneous multi-attempt coexistence (Scenario A: S1 full + G1 hide; Scenario B: S1 full + G1 review_only) to prove S1 mutates while G1 is rejected with 403. Formally assigned to `T-2.4.2` / `T-2.4.3`.
  2. *Mounted React Component DOM & MSW Network Integration:* Explicit mounted rendering for `LearningPlayerPage` / `GroupDetailPage` and direct MSW handler HTTP interception. Formally assigned to `T-2.4.2` (Seven surfaces) and `T-2.4.3` (Phase 2 test suites).
- **Work Package & Checkpoint Status:** `WP-2.4` remains `IN PROGRESS`. Next task: `T-2.4.2` (`READY TO START`). Checkpoint `CP-008` remains strictly reserved for full `WP-2.4` and `Phase 2` closure.

