# MetroLMS — Implementation Report: Seven-Surface Post-Deadline Access Enforcement & Cross-Mutation Isolation (`T-2.4.2`)

> **Document Status:** `ACTIVE — AUTHORITATIVE IMPLEMENTATION REPORT`  
> **Phase:** `Phase 2 — Core Domain Logic Reconciliation`  
> **Work Package:** `WP-2.4 — Post-Deadline Policy (hide vs. keep_no_cert) & Phase 2 Tests` (`IN PROGRESS`)  
> **Task ID & Name:** `T-2.4.2: Enforce 'none' (403) and 'review_only' (403 on writes, no new cert) across all 7 surfaces (MFR-23, 42)`  
> **Requirements Covered:** `MFR-23`, `MFR-42`  
> **Owner Decisions Reconciled:** `D-06`, `D-07`, `D-12`, `D-13`  
> **Target Checkpoint:** `CP-008` *(reserved for full `WP-2.4` acceptance and `Phase 2` closure; unpublished)*  
> **Authoring Date:** 2026-11-11

---

## 1. Executive Summary

Task `T-2.4.2` completes the end-to-end enforcement of post-deadline access policies across all **seven contractual surfaces** in MetroLMS. Building on the accepted `T-2.4.1` domain foundation (`resolveCourseAccess` and `getAttemptAccessMode`), this implementation guarantees:

1. **Seven-Surface Parity:** Trainee courses, dashboards, group views, player stages, read APIs, mutation handlers, and certificate issuance strictly respect `full`, `review_only`, and `none` access modes.
2. **Strict Attempt-Scoped Authorization:** An active enrollment source (such as catalog self-enrollment `S1`) providing course-level `full` access NEVER elevates, mutates, or authorizes certificate issuance for an unrelated expired attempt (`G1`).
3. **Fail-Closed Mutation Gates:** Store mutators (`recordLessonActivity`, `markLessonComplete`) reject non-entitled requests (`403 COURSE_ACCESS_EXPIRED` on `none`, `403 COURSE_ACCESS_REVIEW_ONLY` on `review_only`) *before* any state, attempt, timestamp, or progress mutation occurs.
4. **Multi-Attempt Cross-Mutation Test Coverage:** Authoring of **23 focused test specifications** in [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) covering Scenarios A, B, and C as required by the `T-2.4.1` Security Review.

---

## 2. Canonical Scope & Defect Identification

During the implementation audit of `T-2.4.2`, three subtle architectural edge cases were identified and resolved:

1. **Attempt Entitlement Error Code Inconsistency:**
   - *Defect:* `assertLearnerAttemptEntitlement` previously unconditionally threw `COURSE_ACCESS_REVOKED` when an attempt was omitted from `eligibleAttempts`. However, an attempt expired under `postDeadlinePolicy: 'hide'` was omitted because its deadline passed, not because the trainee was removed from the group.
   - *Resolution:* Added an explicit check for `getAttemptAccessMode(...) === 'none'` in `assertLearnerAttemptEntitlement` and in `resolveActiveAttemptForLearning` (both step 2 explicit group context and step 4 fallback), ensuring expired `hide` attempts throw `403 COURSE_ACCESS_EXPIRED`.
2. **Progress Read API Fall-Through Guard:**
   - *Defect:* `getCourseProgress` resolved an attempt without an explicit check that the attempt itself was expired under `none`. While `resolveCourseAccess` protected the course level, an explicit `?attemptId=G1` query from a multi-enrolled trainee could read progress on the expired attempt.
   - *Resolution:* Added `if (accessMode === 'none') throw new MockStoreError(..., 403, 'COURSE_ACCESS_EXPIRED')` directly in `getCourseProgress`, ensuring attempt-level read denial matches course-level denial.
3. **Group Details UI Access Mode Distinction:**
   - *Defect:* In [`GroupDetailPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx), courses expired under `keep_no_cert` showed normal action buttons ("بدء المقرر الآن" or "متابعة الدورة التدريبية") and lacked a review badge, which accidentally implied full learning permissions.
   - *Resolution:* Added explicit `للمطالعة فقط (بدون شهادة)` / `منتهية الصلاحية — مغلق` badges, updated button text to "مراجعة المحتوى (للمطالعة فقط)" (`variant="outline"`, eye icon), and bound the link directly to `?groupId=${group.id}`.

---

## 3. Source Files Inspected & Modified

| Source Module | Type | Changes Applied |
| :--- | :---: | :--- |
| [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) | Core Domain Store | Updated `assertLearnerAttemptEntitlement` to fail-closed with `COURSE_ACCESS_EXPIRED` when `accessMode === 'none'`.<br>Updated `resolveActiveAttemptForLearning` (step 2 & step 4) to throw `COURSE_ACCESS_EXPIRED` for expired group/course contexts.<br>Added `accessMode === 'none'` guard to `getCourseProgress`. |
| [`frontend/src/pages/GroupDetailPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx) | Group Details UI | Added expired badges (`منتهية الصلاحية — مغلق` for `hide`, `للمطالعة فقط (بدون شهادة)` for `keep_no_cert`).<br>Updated trainee action button for `review_only` to "مراجعة المحتوى (للمطالعة فقط)" and bound link to `?groupId=${group.id}`. |
| [`frontend/src/pages/LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx) | Learning Player Page | Guarded `handleComplete` to immediately return `false` when `progress.accessMode === 'review_only'`, preventing redundant failing mutations.<br>Passed `isReadOnly={progress?.accessMode === 'review_only'}` to `ImageViewer` and `DocumentViewer`. |
| [`frontend/src/features/learning-player/components/ImageViewer.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/ImageViewer.tsx) | Learning Component | Added `isReadOnly?: boolean` prop; displays "وضع المراجعة والاطلاع فقط" badge instead of completion button when `isReadOnly` is true. |
| [`frontend/src/features/learning-player/components/DocumentViewer.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/DocumentViewer.tsx) | Learning Component | Added `isReadOnly?: boolean` prop; displays "وضع المراجعة والاطلاع فقط" text instead of completion button when `isReadOnly` is true. |
| [`frontend/src/mocks/handlers/learningHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/learningHandlers.ts) | MSW API Handlers | Verified contract alignment: `GET /progress` returns `200` (`full`/`review_only`) or `403 COURSE_ACCESS_EXPIRED`; `POST /activity` and `POST /complete` return `403 COURSE_ACCESS_REVIEW_ONLY` or `403 COURSE_ACCESS_EXPIRED`. |
| [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) | Regression Tests | Authored 23 test specifications covering all 7 surfaces and Scenarios A, B, and C. |

---

## 4. Seven-Surface Implementation & Parity Matrix

```
       [ Trainee Course Context ]
                   |
     +-------------+-------------+
     |                           |
[ Full Access ]           [ Expired Deadline ]
     |                           |
  Active                  +------+------+
     |                    |             |
[ Surface 1-7 ]        [ hide ]    [ keep_no_cert ]
  Normal Ops              |             |
                       'none'     'review_only'
                          |             |
                     403 EXPIRED   403 REVIEW_ONLY (writes)
                     Hidden UI     Read-Only UI (no certs)
```

| Surface | UI / API Route | Behavior under `full` | Behavior under `review_only` | Behavior under `none` |
| :--- | :--- | :--- | :--- | :--- |
| **Surface 1: My Courses** | `GET /api/courses/my-courses` / [`MyCoursesPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/MyCoursesPage.tsx) | Listed with normal progress bar and "متابعة التعلم" button. | Listed with red "منتهية الصلاحية" badge, disclaimer label, and review button. | Excluded from response and card list. |
| **Surface 2: Dashboard** | `GET /api/dashboard` / [`DashboardPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/DashboardPage.tsx) | Counted in `enrolledCount`, `completedCount`, and shown in `continueLearning`. | Counted in `enrolledCount`, shown in `continueLearning` in review mode. | Excluded from all counts and `continueLearning`. |
| **Surface 3: Group Details** | `/groups/:id` / [`GroupDetailPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx) | Action button shows "بدء المقرر الآن" / "متابعة الدورة التدريبية". | Action button shows "مراجعة المحتوى (للمطالعة فقط)"; review badge displayed. | Action button disabled with lock icon: "انتهت المهلة — المقرر غير متاح"; closed badge displayed. |
| **Surface 4: Learning Player** | `/courses/:id/learn` / [`LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx) | Full interactive learning, lesson completion enabled, celebration on 100%. | Renders alert banner; viewers show read-only badges; completion disabled. | Renders full-screen lock screen (`data-testid="player-access-expired"`); playback blocked. |
| **Surface 5: Progress Read API** | `GET /api/courses/:id/progress` | Returns HTTP `200` with `progress.accessMode = 'full'`. | Returns HTTP `200` with `progress.accessMode = 'review_only'`. | Returns HTTP `403` with structured code `COURSE_ACCESS_EXPIRED`. |
| **Surface 6: Mutation APIs** | `POST /lessons/:id/activity`<br>`POST /lessons/:id/complete` | Applies playback position and marks lesson complete. | Returns HTTP `403 COURSE_ACCESS_REVIEW_ONLY`; 0 state mutations. | Returns HTTP `403 COURSE_ACCESS_EXPIRED`; 0 state mutations. |
| **Surface 7: Certificate Issuance** | `POST /certificates` / `issueCourseVersionCertificate` | Generates version-scoped `CertificateRecord` upon 100% completion. | Returns `null`; no certificate created. | Returns `null`; no certificate created. |

---

## 5. Multi-Attempt Cross-Mutation Test Evidence

The 23 test specifications in [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) provide direct static verification for the following scenarios:

### Scenario A: Active Standalone (`S1` full) + Expired Group Hide (`G1` none)
- **Setup:** Trainee enrolled in Group A (course deadline expired 10 days ago, policy: `'hide'`), producing Attempt `G1`. Trainee also self-enrolls from the catalog, producing Attempt `S1`.
- **Assertions:**
  1. `getAttemptAccessMode(userId, courseId, S1.id)` evaluates to `'full'`.
  2. `getAttemptAccessMode(userId, courseId, G1.id)` evaluates to `'none'`.
  3. `resolveCourseAccess(userId, courseId)` evaluates to `'full'` (course-level access preserved via `S1`).
  4. Mutating `S1` (`recordLessonActivity` and `markLessonComplete`) succeeds.
  5. Mutating `G1` (`recordLessonActivity` and `markLessonComplete`) throws `MockStoreError` with status `403` and code `COURSE_ACCESS_EXPIRED`.
  6. Attempt `G1` state remains unchanged (0% progress, 0 completed items).
  7. Certificate issuance for `G1` returns `null`.
  8. Completing all items in `S1` issues a valid `CertificateRecord` for Version 1.
  9. Final progress: `S1` is 100% completed; `G1` remains 0% with empty completed items list. Zero progress merging.

### Scenario B: Active Standalone (`S1` full) + Expired Group Keep No Cert (`G1` review_only)
- **Setup:** Trainee enrolled in Group A (course deadline expired 4 days ago, policy: `'keep_no_cert'`), producing Attempt `G1`. Trainee also has catalog enrollment `S1`.
- **Assertions:**
  1. `getAttemptAccessMode(userId, courseId, S1.id)` evaluates to `'full'`.
  2. `getAttemptAccessMode(userId, courseId, G1.id)` evaluates to `'review_only'`.
  3. Mutating `S1` succeeds.
  4. Mutating `G1` throws `MockStoreError` with status `403` and code `COURSE_ACCESS_REVIEW_ONLY`.
  5. `G1` progress remains readable with `accessMode: 'review_only'`.
  6. `G1` state remains completely unmodified after rejected mutations.
  7. Certificate issuance for `G1` returns `null`.
  8. `S1` and `G1` progress records remain completely isolated.

### Scenario C: Independent Multi-Group Attempts
- **Setup:** Trainee enrolled in Group A (expired under `hide` or `keep_no_cert`) and Group B (active with future deadline).
- **Assertions:**
  1. Both attempts coexist independently in `courseAttempts`.
  2. Mutating the active Group B attempt succeeds and increments its progress.
  3. Mutating the expired Group A attempt rejects with `403 COURSE_ACCESS_EXPIRED` (for `hide`) or `403 COURSE_ACCESS_REVIEW_ONLY` (for `keep_no_cert`).
  4. Group B progress does not leak into Group A.

---

## 6. Authored Test Inventory

| Test Suite / Category | Test IDs | Count | Governance Status |
| :--- | :--- | :---: | :---: |
| **Surface 1: My Courses** | `S1-1`, `S1-2`, `S1-3` | 3 | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 2: Student Dashboard** | `S2-1`, `S2-2` | 2 | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 3: Group Details** | `S3-1`, `S3-2` | 2 | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 4: Learning Player** | `S4-1`, `S4-2` | 2 | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 5: Progress Read API** | `S5-1`, `S5-2`, `S5-3` | 3 | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 6: Mutation APIs** | `S6-1`, `S6-2`, `S6-3`, `S6-4` | 4 | `WRITTEN — DEFERRED TO GATE B` |
| **Surface 7: Certificate Issuance** | `S7-1`, `S7-2`, `S7-3` | 3 | `WRITTEN — DEFERRED TO GATE B` |
| **Scenario A: Standalone + Expired Hide** | Cross-mutation isolation (multi-step) | 1 | `WRITTEN — DEFERRED TO GATE B` |
| **Scenario B: Standalone + Expired Keep No Cert** | Review permissions & isolation (multi-step) | 1 | `WRITTEN — DEFERRED TO GATE B` |
| **Scenario C: Independent Group Attempts** | Multi-group attempt independence (2 tests) | 2 | `WRITTEN — DEFERRED TO GATE B` |
| **Total Authored Specifications** | — | **`23`** | **`WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`** |

---

## 7. Deferred T-2.4.3 Work & Boundary Confirmation

Task `T-2.4.3` is preserved with its dedicated integration and security testing scope:

1. **Mounted React DOM Component Testing (`@testing-library/react`):**
   - Full DOM mounting and assertion of warning banners, lock screens, speed controls, and disabled/enabled CTA buttons across [`LearningPlayerPage`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/LearningPlayerPage.tsx) and [`GroupDetailPage`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/groups/GroupDetailPage.tsx).
2. **Direct MSW HTTP Integration Testing:**
   - Real HTTP `fetch` verification across `learningHandlers.ts` testing network responses, HTTP status codes (`403` vs. `200`), and structured JSON error bodies.
3. **Phase 2 Regression Suite Consolidation:**
   - Unified integration of all Phase 2 test files (`enrollment-provenance.test.ts`, `group-member-removal-domain.test.ts`, `group-member-removal-modal.test.tsx`, `course-versioning-and-diffing.test.ts`, `progress-rounding-and-versioned-certificates.test.ts`, `post-deadline-access-enforcement.test.ts`, and `seven-surface-post-deadline-enforcement.test.ts`).

---

## 8. Static Consistency Review & Remaining Risks

1. **Static Analysis & Type Consistency:** All modified files (`inMemoryStore.ts`, `GroupDetailPage.tsx`, `LearningPlayerPage.tsx`, `ImageViewer.tsx`, `DocumentViewer.tsx`) maintain complete interface consistency, static type alignment, and contract fidelity based on static source inspection and AST review. Formal TypeScript compiler CLI execution (`npx tsc --noEmit`) remains strictly deferred to Phase 4 / Gate B (`WP-4.4` / `T-4.4.2`).
2. **No Regressions on D-07 / Continuation Grants:** Continuation grants (`self:continued:${groupId}:${attemptId}`) retain their active status and lift the group deadline, continuing to receive `full` access.
3. **No Regressions on D-13 / Historical Certificates:** Issued certificates are preserved permanently in `userCertificates`; `getAttemptAccessMode` only gates *new* certificate issuance.
4. **Preserved Working Tree:** All 18 uncommitted Phase 5 working-tree files remain unaltered.

---

## 9. Governance Confirmation

In strict compliance with the **Two-Gate Verification Governance model**:
- **0 test commands executed:** Neither `vitest`, `npm test`, `vite build`, `tsc`, `eslint`, formatters, Git commands, nor verification scripts were run.
- **Implementation Status:** `OWNER ACCEPTED (IMPLEMENTED — VERIFICATION PENDING / GATE B)`
- **Test Status:** `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`
- **Checkpoint CP-008:** Strictly **RESERVED, NOT CREATED** (reserved for full `WP-2.4` and `Phase 2` closure upon completion of `T-2.4.3`).

---

## 10. Formal Owner Acceptance Reference

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


