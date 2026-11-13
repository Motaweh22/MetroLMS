# Implementation Report: Post-Deadline Access Enforcement (`hide` vs. `keep_no_cert`, `T-2.4.1`)

> **Phase:** `Phase 2 — Core Domain Logic Reconciliation`  
> **Work Package:** `WP-2.4 — Post-Deadline Policy (hide vs. keep_no_cert) & Phase 2 Tests`  
> **Task ID:** `T-2.4.1`  
> **Requirements:** `MFR-23`, `MFR-42`  
> **Owner Decisions:** `D-06` (Per-Attempt Progress Isolation), `D-07` (Continuation Grant Eligibility), `D-12` (Authoritative Progress Rounding), `D-13` (Version-Scoped Certificate Issuance)  
> **Upstream Dependency:** [`WP-2.3 Closure (CP-007)`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) (`COMPLETED AND ACCEPTED`)  
> **Target Work Package Checkpoint:** `CP-008` *(reserved for full WP-2.4 & Phase 2 closure — not created in this task)*  
> **Implementation Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`  
> **Test Suite Status:** `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (queued for `Phase 4 / Gate B / T-4.4.1`)  

---

## 1. Task Overview & Executive Summary

This report documents the implementation of **Task `T-2.4.1` (Post-Deadline Access Enforcement: `hide` vs. `keep_no_cert`)** under **Work Package `WP-2.4`** of the Living Master Plan ([`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md)).

Task `T-2.4.1` resolves two central domain discrepancies identified in the Master Finding Register:
1. **`MFR-42` (Completed-Trainee Exemption Removal under `'hide'`):**
   - Eliminates the legacy condition (`&& !progress.isCompleted`) in course listing, player access, and progress evaluation.
   - Enforces the absolute rule that when a group assignment expires under `postDeadlinePolicy: 'hide'`, course access through that group source is strictly revoked (`none` / `403 COURSE_ACCESS_EXPIRED`) for **all** trainees in that group, including trainees who achieved 100% completion before the deadline.
   - Preserves already-earned historical certificates in `this.certificates` permanently per `D-13`, ensuring past credentials remain verifiable without permitting continued course access.
2. **`MFR-23` (Multi-Source Access Precedence & Mode Enforcement):**
   - Implements the centralized domain resolver `inMemoryStore.resolveCourseAccess(userId, courseId, now): CourseAccessMode` enforcing the multi-source precedence hierarchy:
     $$\text{Effective Access} = \max(\text{grants}) \quad \text{where} \quad \text{'full'} > \text{'review\_only'} > \text{'none'}$$
   - Enforces `'review_only'` under `keep_no_cert`: trainees retain read-only access to course contents and existing progress, while all mutating operations (`recordLessonActivity`, `markLessonComplete`) are strictly rejected with `403 COURSE_ACCESS_REVIEW_ONLY`, leaving progress records byte-for-byte unchanged, and certificate issuance returns `null`.
   - Enforces `'none'` under `'hide'`: course is omitted from discovery (`getMyEnrolledCourses`, `DashboardPage`), direct player access renders an explicit access-expired card (`data-testid="player-access-expired"`), and API routes return `403 COURSE_ACCESS_EXPIRED`.
   - Protects independent active enrollment sources: an expired `'hide'` group never revokes or degrades an independent active catalog self-enrollment (`self:catalog:...`), an active continuation grant (`self:continued:...` per `D-07`), or another active group assignment.

---

## 2. Relevant Requirements, Defect Analysis & Root Cause

| Requirement / Decision | Domain Area | Description | Root Cause / Defect Prior to T-2.4.1 |
| :---: | :--- | :--- | :--- |
| **`MFR-42`** | Post-Deadline Policy | Courses expired under `'hide'` must be hidden from all group trainees regardless of completion status. | `getMyEnrolledCourses()` contained `if (effectiveSettings.postDeadlinePolicy === 'hide' && !progress.isCompleted) return false;`. Trainees with `progress.isCompleted === true` retained course visibility and player access past the deadline indefinitely. |
| **`MFR-23`** | Access Enforcement | Centralized resolution across multiple enrollment sources with distinct deadlines and policies. | No centralized `resolveCourseAccess` existed. Individual endpoints and UI components evaluated ad-hoc conditions, leading to inconsistent behavior where a user could be hidden in My Courses but still load progress via API. |
| **`D-06`** | Attempt Isolation | Progress and attempts are strictly isolated per source grant and renewal cycle. | Expired group attempts lacked explicit per-attempt access mode labeling, allowing cross-attempt bleed in legacy helpers. |
| **`D-07`** | Continuation Grants | Trainees removed from a group with courses kept retain independent `self:continued:...` access. | Needed explicit verification that retained continuation attempts preserve `'full'` access mode even when the parent group's deadline expires or group is archived. |
| **`D-12`** | Progress Rounding | Authoritative progress calculation clamped to `[0, 100]`. | Mutation endpoints in `review_only` could potentially increment progress or trigger completion recalculations if not blocked prior to calculation. |
| **`D-13`** | Versioned Certificates | Certificates are immutable snapshots bound to course versions. | Must guarantee that hiding a course under `'hide'` does not delete or invalidate existing certificates in `this.certificates`. |

---

## 3. Domain Model & Type Enhancements

### 3.1 `frontend/src/core/courses/types.ts`
Updated the canonical domain type `CourseAccessMode`:
```ts
export type CourseAccessMode = 'full' | 'review_only' | 'none';
```
This type is now consumed across:
- `CourseProgress.accessMode`
- `inMemoryStore.resolveCourseAccess`
- `inMemoryStore.getAttemptAccessMode`
- `inMemoryStore.getEligibleAttemptsForCourse`
- `LearningPlayerPage` and `AttemptContextSelectorModal`

---

## 4. Authoritative Domain Resolver Implementation (`resolveCourseAccess`)

Implemented `public resolveCourseAccess(userId: string, courseId: string, now?: Date | string): CourseAccessMode` in [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts#L2292-L2375) and exported as a standalone helper.

### 4.1 Resolution Algorithm & Source-Level Truth Table
1. Resolves canonical user and course existence. If user or course does not exist, returns `'none'`.
2. Resolves `EnrollmentRecord` for `(userId, courseId)`. If no enrollment record exists, returns `'none'`.
3. Evaluates all grants in `enrollment.sources`:

| Source Kind | Grant Status | Group / Cycle Status | Deadline Condition | Post-Deadline Policy | Resolved Mode |
| :---: | :---: | :---: | :---: | :---: | :---: |
| `self` (Catalog) | `active` | N/A | N/A (Indefinite) | N/A | `'full'` |
| `self` (D-07 Continued) | `active` | N/A | N/A (Indefinite) | N/A | `'full'` |
| `group` | `active` | Group & cycle active | `deadline == null` (No deadline) | Any | `'full'` |
| `group` | `active` | Group & cycle active | `now <= deadline` (Active) | Any | `'full'` |
| `group` | `active` | Group or cycle archived | Any | `'hide'` | `'none'` |
| `group` | `active` | Group or cycle archived | Any | `'keep_no_cert'` | `'review_only'` |
| `group` | `active` | Group & cycle active | `now > deadline` (Expired) | `'hide'` | `'none'` |
| `group` | `active` | Group & cycle active | `now > deadline` (Expired) | `'keep_no_cert'` | `'review_only'` |
| Any | `revoked_by_group_removal` | Any | Any | Any | `'none'` (No access granted) |

4. **Multi-Source Aggregation Precedence:**
   - If any grant produces `'full'`, effective access is `'full'`.
   - Else if any grant produces `'review_only'`, effective access is `'review_only'`.
   - Otherwise, effective access is `'none'`.

### 4.2 Override Hierarchy & Exact Boundary Behavior
- Uses `getEffectiveCourseSettings(group, courseId, now, cycle)` to resolve deadlines and policies:
  $$\text{Course Override} > \text{Cycle Default} > \text{Group Default}$$
- **Exact Deadline Boundary:** `now.getTime() === deadline.getTime()` remains active (`'full'`). Transition to expired occurs strictly when `now.getTime() > deadline.getTime()`.

---

## 5. MFR-42 — Removal of Completed-Trainee Exemption

### 5.1 Source Code Remediation
In `inMemoryStore.getMyEnrolledCourses(userId)`:
- **Defective code prior to T-2.4.1:**
  ```ts
  if (effectiveSettings.postDeadlinePolicy === 'hide' && !progress.isCompleted) {
    return false;
  }
  ```
- **Remediated code:**
  Replaced with authoritative `resolveCourseAccess(userId, course.id, now)`:
  ```ts
  const accessMode = this.resolveCourseAccess(userId, course.id, now);
  if (accessMode === 'none') {
    return false; // Strictly hidden from trainee discovery
  }
  ```

### 5.2 Elimination of Completion-Based Bypass
- Even if a trainee achieved `progress.progressPercent === 100` and `progress.isCompleted === true`, if their course access originates solely from an expired `'hide'` group, `resolveCourseAccess` yields `'none'`.
- The course is completely omitted from the trainee's `MyCoursesPage` and `DashboardPage`.
- Direct route navigation and API queries are rejected with `403 COURSE_ACCESS_EXPIRED`.

### 5.3 Historical Certificate Preservation (`D-13`)
- Certificates previously issued and recorded in `this.certificates` remain permanently intact, verifiable, and untouched.
- Revoking course access does not purge certificate records; transcripts and certificates retain proof of historical achievement.

---

## 6. `review_only` Access Mode Implementation (`keep_no_cert`)

### 6.1 Permitted Read Operations
- Trainees can view course metadata, chapters, and lesson descriptions.
- `GET /api/courses/:courseId/progress` returns `HTTP 200 OK` with `accessMode: 'review_only'` and `isExpired: true`.
- `LearningPlayerPage` renders the prominent yellow warning banner:
  `data-testid="review-only-access-banner"`:
  `"انتهى الموعد النهائي للمقرر. يمكنك مراجعة المحتوى والدروس دون تسجيل تقدم جديد أو استخراج شهادة."`
- `getEligibleAttemptsForCourse` includes eligible expired `'keep_no_cert'` attempts marked with `accessMode: 'review_only'`.

### 6.2 Mutation Barrier
Store mutation methods in `inMemoryStore.ts` enforce immediate rejection:
1. **`recordLessonActivity(params)`:**
   ```ts
   if (attemptAccessMode === 'review_only') {
     throw new MockStoreError('انتهت صلاحية الوصول لهذا المقرر (للمراجعة فقط). لا يمكن تسجيل نشاط جديد.', 403, 'COURSE_ACCESS_REVIEW_ONLY');
   }
   ```
2. **`markLessonComplete(params)`:**
   ```ts
   if (attemptAccessMode === 'review_only') {
     throw new MockStoreError('انتهت صلاحية الوصول للمقرر (للمراجعة فقط). لا يمكن استكمال دروس جديدة أو تحديث التقدم.', 403, 'COURSE_ACCESS_REVIEW_ONLY');
   }
   ```
- Both methods perform this check **before** mutating any attempt state, lesson progress records, last-watched timestamps, or progress percentages. Attempt data remains byte-for-byte unmodified.

### 6.3 Certificate Issuance Barrier
In `inMemoryStore.issueCourseVersionCertificate`:
```ts
if (accessMode !== 'full') {
  return null;
}
```
No certificate can ever be issued for an attempt in `review_only` mode, even if the trainee previously reached or is evaluated against 100% completion.

---

## 7. `none` Access Mode Implementation (`hide`)

### 7.1 Course Discovery Omission
- Excluded from `getMyEnrolledCourses(userId)` and `getEnrolledCoursesForUser(userId)`.
- Excluded from `getDashboardData(userId)`: does not appear in `enrolledCoursesCount`, `completedCoursesCount`, or `continueLearningCourse`.

### 7.2 Route & API Denial
- Direct navigation to `/courses/:courseId/learn` triggers an access check. When `COURSE_ACCESS_EXPIRED` is returned, `LearningPlayerPage` renders a dedicated lock card (`data-testid="player-access-expired"`):
  `"انتهت صلاحية الوصول لهذا المقرر"`
  `"تم إخفاء هذا المقرر لانتهاء الموعد النهائي للمجموعة التدريبية وفقاً للسياسة المعتمدة."`
- `GET /api/courses/:courseId/progress` returns `HTTP 403 Forbidden` (`COURSE_ACCESS_EXPIRED`).
- Mutation endpoints (`recordLessonActivity`, `markLessonComplete`) return `HTTP 403 Forbidden` (`COURSE_ACCESS_EXPIRED`).
- `assertLearnerAttemptEntitlement` rejects expired attempts with `HTTP 403 Forbidden` (`COURSE_ACCESS_EXPIRED`).

### 7.3 Group Details Page Locked State
In `GroupDetailPage.tsx`:
- Assigned courses expired under `'hide'` display a disabled action button with `data-testid="course-expired-btn-${ac.courseId}"`:
  `"منتهي الصلاحية (مخفي)"`

---

## 8. Cross-Surface Enforcement Matrix (The 7 Contractual Surfaces)

| # | Contractual Surface | Enforcement Mechanism | Behavior Under `review_only` | Behavior Under `none` |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **My Courses Page** (`MyCoursesPage.tsx`) | `getMyEnrolledCourses` | Rendered with `isExpired: true`, `canCertify: false`, `policyLabel: 'منتهية الصلاحية — للمطالعة بدون شهادة'` | Omitted completely from trainee's course catalog |
| **2** | **Student Dashboard** (`DashboardPage.tsx`) | `getDashboardData` | Counted in enrolled courses; available in course cards | Excluded from enrolled count, completed count, and continue-learning card |
| **3** | **Group Details Page** (`GroupDetailPage.tsx`) | Assigned course table & actions | Course viewable; review mode indicated | Action button disabled/locked (`course-expired-btn-${courseId}`) |
| **4** | **Learning Player Route** (`LearningPlayerPage.tsx`) | Route guard & player load | Displays warning banner (`review-only-access-banner`); content playable | Displays locked error card (`player-access-expired`); player blocked |
| **5** | **Progress Read API** (`GET .../progress`) | `learningHandlers.ts` + `getCourseProgress` | Returns `200 OK` with `accessMode: 'review_only'` | Returns `403 Forbidden` (`COURSE_ACCESS_EXPIRED`) |
| **6** | **Activity & Completion APIs** (`POST .../activity`, `POST .../complete`) | `learningHandlers.ts` + store mutators | Returns `403 Forbidden` (`COURSE_ACCESS_REVIEW_ONLY`); 0 mutations | Returns `403 Forbidden` (`COURSE_ACCESS_EXPIRED`); 0 mutations |
| **7** | **Certificate Issuance** (`issueCourseVersionCertificate`) | Store certification gate | Returns `null`; zero certificate issued | Returns `null`; zero certificate issued |

---

## 9. Trainee Removal & Continuation Alignment (`D-07`)

When a trainee is removed from a training group with courses retained (`D-07`), `T-2.2.2` converts the group grant into an independent continuation grant (`self:continued:${groupId}:${attemptId}`).

In `T-2.4.1`:
- `resolveCourseAccess` identifies `self:continued:...` as a standalone grant (`kind === 'self'`, `status === 'active'`).
- The continuation grant is not bound to the group deadline or post-deadline policy; it resolves to `'full'` access.
- Even if the training group subsequently expires or is archived under `'hide'`, the trainee's continuation grant ensures continued `'full'` access and certificate eligibility.

---

## 10. Regression Test Suite Inventory

Authored in [`frontend/src/test/post-deadline-access-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/post-deadline-access-enforcement.test.ts) (**33 Test Specifications** — `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`):

### Suite A: Authoritative Course Access Resolver Truth Table (15 Specs)
- `RT-2.4.1-01`: Active standalone enrollment (`kind: self`, `status: active`) resolves to `"full"`.
- `RT-2.4.1-02`: Active group enrollment before deadline resolves to `"full"`.
- `RT-2.4.1-03`: Active group enrollment with no deadline (`null`/absent) resolves to `"full"`.
- `RT-2.4.1-04`: Expired group enrollment with postDeadlinePolicy `"hide"` resolves to `"none"`.
- `RT-2.4.1-05`: Expired group enrollment with postDeadlinePolicy `"keep_no_cert"` resolves to `"review_only"`.
- `RT-2.4.1-06`: Archived group (`adminStatus: archived`) with postDeadlinePolicy `"hide"` resolves to `"none"`.
- `RT-2.4.1-07`: Archived group (`adminStatus: archived`) with postDeadlinePolicy `"keep_no_cert"` resolves to `"review_only"`.
- `RT-2.4.1-08`: Archived cycle (`status: archived/completed`) resolves according to policy (`hide` $\rightarrow$ `none`, `keep_no_cert` $\rightarrow$ `review_only`).
- `RT-2.4.1-09`: Revoked source grant (`revoked_by_group_removal`) does not grant access (`none`).
- `RT-2.4.1-10`: Multi-group precedence: expired `keep_no_cert` group + expired `hide` group resolves to `"review_only"`.
- `RT-2.4.1-11`: Independent standalone source overrides expired `hide` group, resolving to `"full"`.
- `RT-2.4.1-12`: Another active group source overrides expired `hide` group, resolving to `"full"`.
- `RT-2.4.1-13`: D-07 continuation grant (`self:continued:...`) preserves independent `"full"` access regardless of group schedule.
- `RT-2.4.1-14`: Course-level custom deadline and custom postDeadlinePolicy overrides take precedence over group defaults.
- `RT-2.4.1-15`: Exact deadline boundary: `now === deadline` remains active `"full"`; transitions to expired only when `now > deadline`.

### Suite B: MFR-42 Completed-Trainee Exemption Removal under `"hide"` (5 Specs)
- `RT-2.4.1-16`: 100% completed trainee in an expired `"hide"` group loses course access through that group source (`none`).
- `RT-2.4.1-17`: Incomplete trainee in the same expired `"hide"` group also receives `"none"` access (equal treatment).
- `RT-2.4.1-18`: 100% completed trainee with an independent active standalone source retains `"full"` access.
- `RT-2.4.1-19`: 100% completed trainee with another active group source retains `"full"` access.
- `RT-2.4.1-20`: Historical certificate earned before deadline remains preserved and verifiable even when course is hidden.

### Suite C: `keep_no_cert` — Genuine Read-Only Access Enforcement (6 Specs)
- `RT-2.4.1-21`: Trainee can view course lessons and read existing progress with accessMode `"review_only"`.
- `RT-2.4.1-22`: `recordLessonActivity` on `review_only` attempt is rejected with `403 COURSE_ACCESS_REVIEW_ONLY`.
- `RT-2.4.1-23`: `markLessonComplete` on `review_only` attempt is rejected with `403 COURSE_ACCESS_REVIEW_ONLY`.
- `RT-2.4.1-24`: Progress and attempt records remain byte-for-byte / field-for-field unmodified after rejected mutations.
- `RT-2.4.1-25`: `issueCourseVersionCertificate` returns `null` for `review_only` attempts (zero certificate issued).
- `RT-2.4.1-26`: Expired/archived `keep_no_cert` review attempts remain visible and selectable in `getEligibleAttemptsForCourse`.

### Suite D: `none` — Hidden / Denied Access Enforcement (5 Specs)
- `RT-2.4.1-27`: Course is completely omitted from `getMyEnrolledCourses` and `getEnrolledCoursesForUser`.
- `RT-2.4.1-28`: Student dashboard (`getDashboardData`) excludes hidden course from enrolled counts, completed counts, and continue-learning.
- `RT-2.4.1-29`: `recordLessonActivity` on an attempt expired under `"hide"` is rejected with `403 COURSE_ACCESS_EXPIRED`.
- `RT-2.4.1-30`: `markLessonComplete` on an attempt expired under `"hide"` is rejected with `403 COURSE_ACCESS_EXPIRED`.
- `RT-2.4.1-31`: Zero store mutations occur when mutation requests on hidden/expired attempts are rejected.

### Suite E: Seven-Surface Cross-Surface Consistency (2 Specs)
- `RT-2.4.1-32`: Seven surfaces agree on `"none"` access mode (omission, denial, zero mutations, zero certs).
- `RT-2.4.1-33`: Seven surfaces agree on `"review_only"` access mode (read permitted, mutation blocked, zero new certs).

---

## 11. Files Created & Modified

| File Path | Action | Description |
| :--- | :---: | :--- |
| [`frontend/src/core/courses/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/courses/types.ts) | `MODIFIED` | Updated `CourseAccessMode = 'full' \| 'review_only' \| 'none'`. |
| [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) | `MODIFIED` | Implemented `resolveCourseAccess`; updated `getMyEnrolledCourses` to eliminate `&& !progress.isCompleted`; updated `getAttemptAccessMode` and `getEligibleAttemptsForCourse`; added mutation guardrails to `recordLessonActivity`, `markLessonComplete`, and `issueCourseVersionCertificate`. |
| [`frontend/src/mocks/handlers/learningHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/learningHandlers.ts) | `MODIFIED` | Enforced `resolveCourseAccess` checks returning `403 COURSE_ACCESS_EXPIRED` on `GET .../progress`, and added `/items/:itemId/...` and `/lessons/:itemId/...` route aliases for activity and completion. |
| [`frontend/src/pages/LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx) | `MODIFIED` | Added dedicated locked card (`data-testid="player-access-expired"`) for expired access denial. |
| [`frontend/src/pages/GroupDetailPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx) | `MODIFIED` | Rendered locked/disabled button (`data-testid="course-expired-btn-${ac.courseId}"`) for courses expired under `'hide'`. |
| [`frontend/src/test/post-deadline-access-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/post-deadline-access-enforcement.test.ts) | `CREATED` | 33 comprehensive regression test specifications across Suites A through E. |
| [`docs/frontend/checklists/t-2-4-1-post-deadline-access-enforcement-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/t-2-4-1-post-deadline-access-enforcement-checklist.md) | `CREATED` | Completed task checklist for `T-2.4.1`. |
| [`docs/frontend/checklists/README.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/README.md) | `MODIFIED` | Registered `T-2.4.1` checklist in index. |
| [`docs/frontend/reports/t-2-4-1-post-deadline-access-enforcement-report.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/t-2-4-1-post-deadline-access-enforcement-report.md) | `CREATED` | Canonical implementation report for `T-2.4.1`. |
| [`docs/frontend/reports/README.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/README.md) | `MODIFIED` | Registered `T-2.4.1` report in index. |

---

## 12. Two-Gate Verification Governance Status

- **Governance Compliance:** In strict adherence to the Two-Gate Verification Governance model ([`docs/project-state/verification-and-test-strategy.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/verification-and-test-strategy.md)), no automated test runners, Vitest commands, Vite builds, TypeScript compilers (`tsc`), or shell test scripts were executed during this implementation turn.
- **Verification Designations:**
  - Implementation: **`IMPLEMENTED — VERIFICATION PENDING (GATE B)`**
  - Regression Test Suite: **`WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`**
- All 33 authored specifications in `frontend/src/test/post-deadline-access-enforcement.test.ts` are queued for consolidated runtime execution at **Phase 4 / Gate B (`WP-4.4` / `T-4.4.1`)**.
- **Working-Tree Preservation:** All 18 uncommitted Phase 5 working-tree files in `frontend/src/` remain fully preserved and unmodified.

---

## 13. Checkpoint & Next Steps

1. **`WP-2.4` Status:**
   - Task `T-2.4.1` is now fully implemented, accepted by the Owner, and documented with status `IMPLEMENTED — VERIFICATION PENDING (GATE B)`.
   - Work Package `WP-2.4` remains **`IN PROGRESS`**.
2. **Checkpoint `CP-008` Reservation:**
   - Checkpoint `CP-008` is strictly reserved for the full acceptance of `WP-2.4` and closure of `Phase 2`. It is **not** created in this task.
3. **Exact Next Task:**
   - Proceed to **`Phase 2 → WP-2.4 → T-2.4.2`**:
     *Task:* Enforce `'none'` (`403`) and `'review_only'` (`403` on writes, no new cert) across all 7 surfaces (`MFR-23`, `MFR-42`).
     *Status:* `READY TO START`.

---

## 14. Formal Owner Acceptance Reference

- **Owner Acceptance:** `APPROVED` (`2026-11-11`).
- **Independent Security Review Verdict:** `CONSISTENT WITH MINOR NOTES` (Targeted Read-Only Security Review for `T-2.4.1`).
- **Acceptance Scope:**
  - Authoritative domain resolver (`resolveCourseAccess`) enforcing multi-source precedence (`full > review_only > none`).
  - Strict separation between course-level access and attempt-scoped authorization (`getAttemptAccessMode`).
  - Pre-mutation barriers in `recordLessonActivity` and `markLessonComplete` rejecting unauthorized attempts with `403 COURSE_ACCESS_EXPIRED` (`'none'`) or `403 COURSE_ACCESS_REVIEW_ONLY` (`'review_only'`) prior to state modification.
  - Strict attempt-level certificate gating in `issueCourseVersionCertificate` blocking issuance on `'none'` or `'review_only'` attempts.
  - Complete elimination of completed-trainee exemption under `postDeadlinePolicy: 'hide'` (`MFR-42`).
  - D-07 continuation grant access and certificate eligibility preservation (`self:continued:...`).
- **Verification Status Distinction:** Task implementation is accepted and static consistency verified. All 33 authored regression test specifications in [`frontend/src/test/post-deadline-access-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/post-deadline-access-enforcement.test.ts) remain `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (scheduled for consolidated runtime execution in `Phase 4 / Gate B / T-4.4.1`). Task status remains `IMPLEMENTED — VERIFICATION PENDING (GATE B)`.
- **Assigned Follow-Up Test Requirements (Non-Blocking):**
  1. *Multi-Attempt Cross-Mutation Tests:* Explicit scenarios verifying simultaneous multi-attempt coexistence (Scenario A: S1 full + G1 hide; Scenario B: S1 full + G1 review_only) to prove S1 mutates while G1 is rejected with 403. Formally assigned to `T-2.4.2` / `T-2.4.3`.
  2. *Mounted React Component DOM & MSW Network Integration:* Explicit mounted rendering for `LearningPlayerPage` / `GroupDetailPage` and direct MSW handler HTTP interception. Formally assigned to `T-2.4.2` (Seven surfaces) and `T-2.4.3` (Phase 2 test suites).
- **Work Package & Checkpoint Status:** `WP-2.4` remains `IN PROGRESS`. Next task: `T-2.4.2` (`READY TO START`). Checkpoint `CP-008` remains strictly reserved for full `WP-2.4` and `Phase 2` closure.

