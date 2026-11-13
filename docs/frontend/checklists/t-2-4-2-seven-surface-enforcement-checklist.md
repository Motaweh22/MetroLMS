# MetroLMS — Task Checklist: Seven-Surface Post-Deadline Access Enforcement (`T-2.4.2`)

> **Document Status:** `ACTIVE — OWNER ACCEPTED (IMPLEMENTED — VERIFICATION PENDING / GATE B)`  
> **Phase:** `Phase 2 — Core Domain Logic Reconciliation`  
> **Work Package:** `WP-2.4 — Post-Deadline Policy (hide vs. keep_no_cert) & Phase 2 Tests` (`IN PROGRESS`)  
> **Task ID & Name:** `T-2.4.2: Enforce 'none' (403) and 'review_only' (403 on writes, no new cert) across all 7 surfaces (MFR-23, 42)`  
> **Requirements Addressed:** `MFR-23`, `MFR-42`  
> **Owner Decisions:** `D-06`, `D-07`, `D-12`, `D-13`  
> **Target Checkpoint:** `CP-008` *(reserved for full `WP-2.4` acceptance and `Phase 2` closure; unpublished)*  
> **Last Updated:** 2026-11-11 (Owner Accepted)

---

## 1. Task Objective & Context

The authoritative objective of Task `T-2.4.2` is to enforce the post-deadline access policies (`hide` vs. `keep_no_cert`) consistently across all **seven contractual surfaces** of MetroLMS, verify strict **attempt-scoped authorization** so that course-level full access from one source never elevates an unrelated attempt, and provide dedicated regression coverage closing the **multi-attempt cross-mutation** test gap identified in the `T-2.4.1` Security Review.

---

## 2. Seven Enforcement Surfaces Verification Matrix

| Surface ID & Name | Inspected & Updated Modules | Contractual Behavior under `full` | Contractual Behavior under `review_only` (`keep_no_cert`) | Contractual Behavior under `none` (`hide`) | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Surface 1: My Courses** | [`MyCoursesPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/MyCoursesPage.tsx), [`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) (`getMyEnrolledCourses`) | Course visible with normal progress, "قيد التدريب" / "مكتمل", and "متابعة التعلم" CTA. | Course visible with `isExpired: true`, `canCertify: false`, red `منتهية الصلاحية` badge, and disclaimer `منتهية الصلاحية — للمطالعة بدون شهادة`. | Course completely excluded from the trainee's enrolled courses list (even if 100% completed). | `IMPLEMENTED` |
| **Surface 2: Student Dashboard** | [`DashboardPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/DashboardPage.tsx), [`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) (`getDashboardData`) | Included in `enrolledCount` and `completedCount`; eligible for `continueLearning` card. | Retained in `enrolledCount`; eligible for `continueLearning` card in review mode. | Completely excluded from `enrolledCount`, `completedCount`, and `continueLearning` cards. | `IMPLEMENTED` |
| **Surface 3: Group Details** | [`GroupDetailPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx) | Action button shows "متابعة الدورة التدريبية" / "بدء المقرر الآن" linking to `/courses/:id/learn?groupId=:id`. | Course shows `للمطالعة فقط (بدون شهادة)` badge; action button shows "مراجعة المحتوى (للمطالعة فقط)" (`variant="outline"`, eye icon). | Course shows `منتهية الصلاحية — مغلق` badge; action button is disabled with lock icon: "انتهت المهلة — المقرر غير متاح". | `IMPLEMENTED` |
| **Surface 4: Learning Player** | [`LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx), [`useCourseProgress.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/hooks/useCourseProgress.ts), [`ImageViewer.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/ImageViewer.tsx), [`DocumentViewer.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/DocumentViewer.tsx) | Normal interactive player, lesson completion allowed, celebration on 100%. | Renders warning banner; viewers display `isReadOnly` badge ("وضع المراجعة والاطلاع فقط"); manual completion disabled. | Access denied; renders full-screen lock screen (`data-testid="player-access-expired"`) with return navigation. | `IMPLEMENTED` |
| **Surface 5: Progress Read API** | `GET /api/courses/:courseId/progress`, [`learningHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/learningHandlers.ts), [`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) (`getCourseProgress`) | Returns HTTP `200` with `progress.accessMode = 'full'`. | Returns HTTP `200` with `progress.accessMode = 'review_only'`. | Returns HTTP `403` with structured error `{ code: 'COURSE_ACCESS_EXPIRED', message: '...' }`. | `IMPLEMENTED` |
| **Surface 6: Activity & Completion APIs** | `POST /api/courses/:courseId/lessons/:itemId/activity`, `POST /api/courses/:courseId/lessons/:itemId/complete`, [`learningHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/learningHandlers.ts) | Mutation permitted and applied to the exact attempt. | Throws/returns HTTP `403 COURSE_ACCESS_REVIEW_ONLY`; zero state mutation. | Throws/returns HTTP `403 COURSE_ACCESS_EXPIRED`; zero state mutation. | `IMPLEMENTED` |
| **Surface 7: Certificate Issuance** | [`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) (`issueCourseVersionCertificate`) | Issues version-scoped certificate upon verified 100% completion of the exact attempt. | Rejects issuance (`returns null`); no new certificate generated. | Rejects issuance (`returns null`); no certificate generated. | `IMPLEMENTED` |

---

## 3. Attempt-Scoped Authorization & State Mutation Safety Invariants

- [x] **Invariant 1 (Attempt Scoping):** Course-level access from an active enrollment (e.g. catalog `S1`) NEVER elevates an unrelated attempt (e.g. expired group `G1`).
- [x] **Invariant 2 (Pre-Mutation Barrier):** Authorization check (`assertLearnerAttemptEntitlement` and `getAttemptAccessMode`) occurs strictly BEFORE `startAttempt()`, before lesson progress mutations, before item completion additions, and before timestamp updates.
- [x] **Invariant 3 (Zero State Leakage on Rejection):** Rejected mutation calls on `none` or `review_only` attempts do not alter `lessonProgress`, `completedItemIds`, `lastWatchedItemId`, `status`, `updatedAt`, or certificate records.
- [x] **Invariant 4 (Historical Certificate Preservation):** Certificates issued under `D-13` prior to group deadline expiration remain preserved in `userCertificates` and are never revoked or modified by deadline passage.

---

## 4. Multi-Attempt Cross-Mutation Regression Coverage Inventory

Dedicated regression test file: [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) (23 test specifications).

| Scenario / Section | Specification Count | Test Focus | Status |
| :--- | :---: | :--- | :---: |
| **Surface 1: My Courses** | `3` | `S1-1`: Excludes `none` courses from trainee list<br>`S1-2`: Marks `review_only` courses with disclaimer<br>`S1-3`: Retains `full` access when active standalone coexists with expired group | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 2: Dashboard** | `2` | `S2-1`: Omits `none` courses from counts & continueLearning<br>`S2-2`: Retains `review_only` courses in counts & continueLearning | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 3: Group Details** | `2` | `S3-1`: Marks expired `hide` course with `isExpired` and `hide` policy<br>`S3-2`: Preserves `keep_no_cert` review-only distinction | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 4: Learning Player** | `2` | `S4-1`: Throws `403 COURSE_ACCESS_EXPIRED` for `hide` attempt<br>`S4-2`: Scopes attempt progress under `review_only` | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 5: Progress Read API** | `3` | `S5-1`: Returns `200` with `full`<br>`S5-2`: Returns `200` with `review_only`<br>`S5-3`: Throws `403 COURSE_ACCESS_EXPIRED` for `none` | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 6: Mutation APIs** | `4` | `S6-1`: Permits activity & completion for `full`<br>`S6-2`: Rejects activity with `403 COURSE_ACCESS_REVIEW_ONLY`<br>`S6-3`: Rejects completion with `403 COURSE_ACCESS_REVIEW_ONLY`<br>`S6-4`: Rejects completion with `403 COURSE_ACCESS_EXPIRED` | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 7: Certificate Issuance** | `3` | `S7-1`: Issues cert for `full` attempt at 100%<br>`S7-2`: Rejects cert for `review_only` attempt<br>`S7-3`: Rejects cert for `none` attempt | `WRITTEN — DEFERRED TO GATE B` |
| **Scenario A: Standalone + Expired Hide** | `1` | Mutating S1 succeeds; mutating G1 rejects with `403 COURSE_ACCESS_EXPIRED`; G1 unchanged; G1 cert rejected; S1 cert succeeds at 100%; zero progress merging | `WRITTEN — DEFERRED TO GATE B` |
| **Scenario B: Standalone + Expired Keep No Cert** | `1` | Mutating S1 succeeds; mutating G1 rejects with `403 COURSE_ACCESS_REVIEW_ONLY`; G1 readable; G1 cert rejected; zero progress merging | `WRITTEN — DEFERRED TO GATE B` |
| **Scenario C: Independent Group Attempts** | `2` | Active G2 full coexists with expired G1 hide none; active G2 full coexists with expired G1 keep_no_cert review_only; zero cross-group leakage | `WRITTEN — DEFERRED TO GATE B` |
| **Total Test Specifications** | **`23`** | **Comprehensive Seven-Surface & Multi-Attempt Suite** | **`WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`** |

---

## 5. Explicitly Deferred T-2.4.3 Testing Scope

The following test suites remain assigned exclusively to **`T-2.4.3`** and are **NOT** absorbed into `T-2.4.2`:

1. **Mounted React DOM Component Tests (`@testing-library/react`):**
   - Mounted [`LearningPlayerPage`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/LearningPlayerPage.tsx) under `none` (verifying full-page lock screen, Arabic text, return button) and `review_only` (verifying warning banner, read-only viewer badges).
   - Mounted [`GroupDetailPage`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/groups/GroupDetailPage.tsx) verifying locked action button (`data-testid="course-expired-btn-..."`) and review action button (`data-testid="course-review-btn-..."`).
2. **End-to-End MSW HTTP Route Tests:**
   - Real HTTP `fetch` integration through MSW v2 asserting HTTP status codes `200` vs. `403` and structured error JSON payloads (`COURSE_ACCESS_EXPIRED`, `COURSE_ACCESS_REVIEW_ONLY`).
3. **Comprehensive Phase 2 Regression Suite Integration:**
   - Full consolidation of test suites across `WP-2.1` through `WP-2.4` in preparation for Phase 2 closure checkpoint `CP-008`.

---

## 6. Verification Status & Governance

- **Implementation Status:** `OWNER ACCEPTED (IMPLEMENTED — VERIFICATION PENDING / GATE B)`
- **Test Execution Status:** `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (Two-Gate Verification Governance strictly enforced; 0 test commands executed).
- **Working-Tree Integrity:** All 18 uncommitted Phase 5 files in `frontend/src/` remain preserved intact.
- **Milestone Checkpoint:** Checkpoint `CP-008` remains strictly **RESERVED, NOT CREATED** (reserved for full `WP-2.4` and `Phase 2` closure).

---

## 7. Formal Owner Acceptance Reference

- **Owner Acceptance:** `APPROVED` (`2026-11-11`).
- **Independent Consistency Review Verdict:** `CONSISTENT WITH MINOR NOTES — READY FOR OWNER ACCEPTANCE` (Final Read-Only Consistency Review for `T-2.4.2`).
- **Recorded Task Status:** `OWNER ACCEPTED (IMPLEMENTED — VERIFICATION PENDING / GATE B)`.
- **Acceptance Scope:**
  - Full seven-surface post-deadline access enforcement across:
    1. *My Courses* (`getMyEnrolledCourses`, `MyCoursesPage.tsx`) — completely omitting `accessMode: none` courses and enriching `review_only` courses with disclaimer badges.
    2. *Student Dashboard* (`getDashboardData`, `DashboardPage.tsx`) — omitting `none` courses from metrics and `continueLearning` cards while retaining `review_only` courses.
    3. *Group Details* (`GroupDetailPage.tsx`) — disabling action buttons with lock icons for expired `hide` courses and exposing `review_only` outline buttons.
    4. *Learning Player* (`LearningPlayerPage.tsx`) — full-screen expired lock screen for `none`, review-only warning banner, viewer read-only props, and immediate client-side `handleComplete` termination.
    5. *Progress Read API* (`GET /api/courses/:courseId/progress`) — returning `accessMode: full` or `review_only` (HTTP 200) and throwing `403 COURSE_ACCESS_EXPIRED` for `none`.
    6. *Activity & Completion Mutation APIs* (`recordLessonActivity`, `markLessonComplete`) — rejecting mutations with `403 COURSE_ACCESS_EXPIRED` (`'none'`) or `403 COURSE_ACCESS_REVIEW_ONLY` (`'review_only'`) before any attempt progress state mutation.
    7. *Version-Scoped Certificate Issuance* (`issueCourseVersionCertificate`) — gating issuance strictly on `getAttemptAccessMode === 'full'` while preserving historical certificates intact.
  - Multi-attempt cross-mutation isolation across Scenarios A, B, and C in `frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`.
- **Preserved Review Notes & Clarifications:**
  1. *Video Activity Heartbeat Optimization in `review_only`:* Assigned to `T-2.4.3`. The periodic 5s activity POST request in `useVideoProgressSync` will be suppressed in `review_only` mode while preserving smooth video playback.
  2. *Compiler-Level TypeScript Verification:* Confirmed as deferred to Phase 4 / Gate B (`WP-4.4` / `T-4.4.2`). Static type safety was verified via source inspection, interface reconciliation, and AST review; no claim of compiler CLI execution or unconditional "100% type-safe" status.
- **Verification Status Distinction:** Task implementation is accepted and static consistency verified. All 23 authored regression test specifications in [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) remain `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (scheduled for consolidated runtime execution in `Phase 4 / Gate B / T-4.4.1`).
- **Work Package & Checkpoint Status:** `WP-2.4` remains `IN PROGRESS`. Next task: `T-2.4.3` (`READY TO START`). Checkpoint `CP-008` remains strictly reserved for full `WP-2.4` and `Phase 2` closure.


