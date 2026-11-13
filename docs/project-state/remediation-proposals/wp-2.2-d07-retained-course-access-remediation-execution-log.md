# Post-WP-2.2 Remediation Execution Log: `D-07` Retained-Course Continuation & Revoked-Attempt Authorization

> **Document Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`
> **Approved Proposal:** [`docs/project-state/remediation-proposals/wp-2.2-d07-retained-course-access-remediation.md`](wp-2.2-d07-retained-course-access-remediation.md)
> **Owner Approval Date:** `2026-11-09`
> **Implementation Start Date:** `2026-11-09`
> **Implementation Completion & Test Reconciliation Date:** `2026-11-10`
> **Test Execution Status:** `WRITTEN — NOT EXECUTED` (Deferred to `Phase 4` / `Gate B` / `T-4.4.1`)
> **Governance Boundary:** Subject to `Gate B` verification deferral ([`docs/project-state/verification-and-test-strategy.md`](../verification-and-test-strategy.md)). Does not modify [`docs/project-state/CURRENT.md`](../CURRENT.md), [`docs/project-state/active-roadmap.md`](../active-roadmap.md), or immutable checkpoints (`CP-001` through `CP-006`).

---

## 1. Owner Approval & Start Date

- **Owner Approval Status:** Explicitly approved by the Owner on `2026-11-09`.
- **Implementation Start Date:** `2026-11-09`.
- **Test Inventory Reconciliation Date:** `2026-11-10`.
- **Pre-Implementation Verification:**
  - Reviewed [`AGENTS.md`](../../../AGENTS.md), [`docs/project-state/CURRENT.md`](../CURRENT.md), [`docs/architecture/decision-register.md`](../../architecture/decision-register.md) (`D-06`, `D-07`, `D-08`, `D-09`), and [`docs/project-state/verification-and-test-strategy.md`](../verification-and-test-strategy.md).
  - Inspected [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) (`Lines 1203–1704`, `Lines 1852–2230`, `Lines 2409–2450`, `Lines 5887–6198`, and `Lines 7074–7118`) and [`frontend/src/test/group-member-removal-domain.test.ts`](../../../frontend/src/test/group-member-removal-domain.test.ts) (`Lines 1–453`).

---

## 2. Approved Scope & Authority

### 2.1 Authorized Target Files
1. [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) — Production mock store remediation (`canUseLegacyStandaloneFallback()`, `assertLearnerAttemptEntitlement()`, `getEligibleAttemptsForCourse()`, `resolveActiveAttemptForLearning()`, and `getGroupMetrics()`).
2. [`frontend/src/test/group-member-removal-domain.test.ts`](../../../frontend/src/test/group-member-removal-domain.test.ts) — Focused `D-07` regression test suite (`RT-D07-01` through `RT-D07-09`).
3. [`docs/project-state/remediation-proposals/wp-2.2-d07-retained-course-access-remediation.md`](wp-2.2-d07-retained-course-access-remediation.md) — Approved remediation design proposal (status and regression test inventory reconciled).
4. [`docs/project-state/remediation-proposals/wp-2.2-d07-retained-course-access-remediation-execution-log.md`](wp-2.2-d07-retained-course-access-remediation-execution-log.md) — Companion execution log (this file).

### 2.2 Out-of-Scope Boundaries Enforced
- Zero changes to [`docs/project-state/CURRENT.md`](../CURRENT.md), [`docs/project-state/active-roadmap.md`](../active-roadmap.md), or any checkpoint file (`CP-001` through `CP-006`).
- Zero new task IDs created; `WP-2.2` and `CP-006` statuses left untouched.
- Zero changes to [`removeGroupMember()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L6041-L6352), [`getAttemptAccessMode()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1478-L1521), [`getCourseProgress()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1725-L1840), [`recordLessonActivity()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1988-L2143), [`markLessonComplete()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L2151-L2366), or `TrainingGroup` data structures.
- All 18 uncommitted working-tree files from `Phase 5` Increment `5.4` preserved intact.

---

## 3. Implementation Sequence & Completed Steps

| Step | Target File & Location | Summary of Completed Changes | Status |
| :--- | :--- | :--- | :--- |
| **Step 1** | [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1198–1212`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1198-L1212) | Added private helper [`canUseLegacyStandaloneFallback(enrollment)`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1204-L1212). Permits legacy standalone fallback **only** when `!enrollment` (preview / unseeded legacy tests) or when `enrollment.status === 'active'` with an empty `sources` array (`sources.length === 0`). Denies fallback whenever `enrollment.sources.length > 0` or `enrollment.status !== 'active'`. | `COMPLETED` |
| **Step 2** | [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1277–1473`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1277-L1473) | Remediated [`getEligibleAttemptsForCourse(userId, courseId)`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1277-L1473):<br>1. Replaced `hasActiveAlternate` with `if (grant.status !== 'active') { continue; }` (`Lines 1296–1300`).<br>2. Removed the invalid `g.members.some(...)` clause from `isContinuation` (`Lines 1343–1346`).<br>3. Preserved bound attempt cycle context on `EligibleAttemptOption`: `cycleId: grant.cycleId || attempt.cycleId || null` (`Line 1371`).<br>4. Updated `optionsMap` deduplication (`Lines 1384–1394`) to prefer an active `kind: 'self'` continuation option with `accessMode: 'full'` over an existing `kind: 'group'` entry.<br>5. Guarded the `optionsMap.size === 0` standalone fallback (`Line 1399`) with `this.canUseLegacyStandaloneFallback(enrollment)` and active `group.traineeIds` membership check (`Lines 1412–1428`). | `COMPLETED` |
| **Step 3** | [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1214–1270`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1214-L1270) | Added private helper [`assertLearnerAttemptEntitlement(userId, courseId, attempt)`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1219-L1270). Verifies that `attempt.id` is present in `this.getEligibleAttemptsForCourse(userId, courseId)` or permitted by `this.canUseLegacyStandaloneFallback(enrollment)` (with active `group.traineeIds` membership when `attempt.groupId` is present); otherwise throws `new MockStoreError('...', 403, 'COURSE_ACCESS_REVOKED')`. | `COMPLETED` |
| **Step 4** | [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1534–1693`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1534-L1693) | Remediated [`resolveActiveAttemptForLearning(params)`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1534-L1693):<br>1. **Branch 1 (`params.attemptId`, `Lines 1547–1561`):** Calls `this.assertLearnerAttemptEntitlement(params.userId, params.courseId, explicitAttempt)` before returning `explicitAttempt`.<br>2. **Branch 2 (`params.groupId`, `Lines 1564–1607`):** When `!this.canUseLegacyStandaloneFallback(enrollment)`, resolves against `this.getEligibleAttemptsForCourse(params.userId, params.courseId)` matching `opt.groupId` or `opt.convertedFromGroupId` (and `opt.cycleId` when requested), throwing `403 COURSE_ACCESS_REVOKED` when no active grant matches; and validates `this.assertLearnerAttemptEntitlement(...)` on the fallback path.<br>3. **Branch 4 (`Lines 1674–1692`):** Checks `if (!this.canUseLegacyStandaloneFallback(enrollment))` and throws `403 COURSE_ACCESS_REVOKED` instead of provisioning a replacement standalone attempt. | `COMPLETED` |
| **Step 5** | [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 2545–2602`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L2545-L2602) | Remediated [`getGroupMetrics()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L2462-L2813) (`Lines 2545–2602`): Replaced the `targetCycle`-only lookup and learner-facing `this.getCourseProgress(...)` fallback with a direct administrative lookup of `groupAttempt` in `this.courseAttempts` scoped by trainee (`userMatches`), course (`courseMatches`), group (`groupMatches` via `a.groupId` or `isCycleOwnedByGroup(a.cycleId, group.id)`), and optional cycle (`cycleMatches: targetCycle ? a.cycleId === targetCycle.id : true`), plus `this.getAttemptProgress(groupAttempt.id)` and a read-only `this.userProgress` fallback. | `COMPLETED` |
| **Step 6** | [`frontend/src/test/group-member-removal-domain.test.ts` (`Lines 453–1133`)](../../../frontend/src/test/group-member-removal-domain.test.ts#L453-L1133) | Authored Suite 6 containing focused regression tests `RT-D07-01` through `RT-D07-09` while preserving all 20 existing tests (`Lines 58–451`) unmodified. | `COMPLETED` |

---

## 4. Important Implementation Decisions & Reasons

1. **Dedicated Clean Trainee Persona (`USR006`) for Suite 6 Regression Tests (`RT-D07-01` through `RT-D07-09`):**
   - *Context:* In [`frontend/src/mocks/fixtures/mockEnrollments.ts`](../../../frontend/src/mocks/fixtures/mockEnrollments.ts) and [`frontend/src/mocks/fixtures/mockGroups.ts`](../../../frontend/src/mocks/fixtures/mockGroups.ts), `usr_trainee_003` is pre-seeded in `INITIAL_MOCK_ENROLLMENTS` with an active catalog self-enrollment (`self:catalog:ATT-usr_trainee_003-CRS002-standalone`) for `CRS002` and is also pre-listed in `GRP-101.traineeIds`.
   - *Decision:* Suite 6 (`RT-D07-01` through `RT-D07-09`) uses canonical active trainee `USR006` ([`frontend/src/mocks/fixtures/userDirectoryFixtures.ts` (`Lines 131–144`)](../../../frontend/src/mocks/fixtures/userDirectoryFixtures.ts#L131-L144)), who starts with zero pre-seeded enrollments and zero pre-seeded group memberships after `inMemoryStore.reset({ seedReviewDemo: false, seedGroupDemo: false })`.
   - *Reason:* Using `USR006` ensures that `addGroupMember(groupAId, 'USR006')` executes full enrollment grant synchronization (`addOrUpdateEnrollmentGrant`) and allows testing pure single-group retention (`RT-D07-01`–`RT-D07-03`), pure single-group revocation (`RT-D07-04`), coexistence with `enrollUser()` (`S1`) or `GRP-102` (`RT-D07-05`, `RT-D07-06`, `RT-D07-08`), legacy cycleless `getGroupMetrics()` under `hide` policy (`RT-D07-07`), and same-attempt deduplication (`RT-D07-09`) without pre-seeded fixture interference. All 20 existing tests (`1`–`20`) continue to use `usr_trainee_003` untouched.
2. **Exact Scoping of Administrative Attempt Lookup in `getGroupMetrics()` (`Lines 2553–2565`):**
   - *Decision:* Aligned the `groupAttempt` predicate in `getGroupMetrics()` (`Lines 2553–2565`) verbatim with Section 5.7 of the approved proposal (`userMatches && courseMatches && groupMatches && cycleMatches`, where `cycleMatches` is `targetCycle ? a.cycleId?.toLowerCase().trim() === targetCycle.id.toLowerCase().trim() : true`).
   - *Reason:* Ensures that when a group is evaluated in a legacy cycleless state (`targetCycle === null`), historical group attempts belonging to that trainee, course, and group are matched regardless of whether `a.cycleId` was populated at creation time, while still strictly filtering by `targetCycle.id` whenever a cycle is active or explicitly requested.

---

## 5. Regression Tests Authored (`WRITTEN — NOT EXECUTED`)

All 9 regression tests in Suite 6 were authored in [`frontend/src/test/group-member-removal-domain.test.ts` (`Lines 453–1133`)](../../../frontend/src/test/group-member-removal-domain.test.ts#L453-L1133):

| Test ID | Test Name & Scenario | Key Assertions Covered | Execution Status |
| :--- | :--- | :--- | :--- |
| **`RT-D07-01`** | Retained course before former group deadline (`removeCourseIds: []`) | `getEligibleAttemptsForCourse()` returns `[option]` with `attemptId === boundAttemptId`, `kind === 'self'`, `accessMode === 'full'`, `convertedFromGroupId === groupAId`, and `cycleId === originalCycleId`; `getAttemptAccessMode() === 'full'`; implicit, `groupId`, and `groupId + cycleId` resolution all return `boundAttemptId`; `getCourseProgress()`, `recordLessonActivity()`, and `markLessonComplete()` succeed. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-02`** | Retained course after former group deadline expires (`keep_no_cert`) | After expiring Group A with `postDeadlinePolicy: 'keep_no_cert'`, `getEligibleAttemptsForCourse()` and `getAttemptAccessMode()` return `'full'` (not `'review_only'`), and `recordLessonActivity()` / `markLessonComplete()` succeed without throwing `COURSE_ACCESS_REVIEW_ONLY`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-03`** | Retained course after former group deadline expires (`hide`) | After expiring Group A with `postDeadlinePolicy: 'hide'`, `getEligibleAttemptsForCourse()` still returns the retained attempt (`accessMode: 'full'`), and `getCourseProgress()` / `recordLessonActivity()` succeed. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-04`** | Revoked course with no other active grant (`removeCourseIds: [courseAId]`) | `getEligibleAttemptsForCourse()` returns `[]`; implicit, explicit `attemptId`, and explicit `groupId` calls to `resolveActiveAttemptForLearning()` throw `403 COURSE_ACCESS_REVOKED`; `getCourseProgress()`, `recordLessonActivity()`, and `markLessonComplete()` throw `403 COURSE_ACCESS_REVOKED`; no replacement standalone attempt is created; `getTraineeAttempts()` and `getAttemptProgress()` remain preserved. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-05`** | Revoked group course when independent catalog self-enrollment (`S1`) exists | `getEligibleAttemptsForCourse()` returns only `[selfOption]`; implicit `resolveActiveAttemptForLearning()` resolves to `selfAttemptId`; explicit `attemptId: groupAttemptId` and `groupId: groupAId` throw `403 COURSE_ACCESS_REVOKED`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-06`** | Revoked Group A course when Group B active grant exists | `getEligibleAttemptsForCourse()` returns only `[groupBOption]`; implicit `resolveActiveAttemptForLearning()` resolves to `attemptBId`; explicit `attemptId: attemptAId` and `groupId: groupAId` throw `403 COURSE_ACCESS_REVOKED`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-07`** | Administrative `getGroupMetrics()` independence on legacy cycleless group expired under `hide` policy | Learner calls to `getEligibleAttemptsForCourse()` return `[]`, and learner calls to `getCourseProgress()` (implicit, `{ attemptId: groupAttemptId }`, and `{ groupId: groupAId }`) throw `403 COURSE_ACCESS_REVOKED`; administrative `getGroupMetrics(groupAId)` succeeds for the legacy cycleless group (`selectedCycle === null`) and reports `completedLessons === 1`, `started === true`, and `percent > 0` via direct historical-attempt lookup (plus cycle-scoped verification via `getGroupMetrics(groupAId, originalCycleId)`). | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-08`** | Retaining course (`removeCourseIds: []`) alongside independent catalog self-enrollment (`S1`) | `getEligibleAttemptsForCourse()` returns 2 active options (`attemptAId` continuation + `selfAttemptId` catalog) without throwing `TypeError`; `getCourseProgress()` without explicit `attemptId` returns `requiresAttemptSelection: true`; explicit `attemptId` selection succeeds and isolates progress. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-09`** | Same-attempt deduplication when an active Group Grant and active continuation grant reference the same `attemptId` | Both active grants (`kind: 'group'` at `sources[0]` and `kind: 'self'` continuation at `sources[1]`) sharing `sharedAttemptId` are processed; `getEligibleAttemptsForCourse()` returns 1 deduplicated option preferring the unrestricted `kind: 'self'` continuation (`sourceId: self:continued:...`, `convertedFromGroupId: groupAId`, `cycleId: originalCycleId`, `accessMode: 'full'`) under both active and expired (`keep_no_cert`) group schedules. | `WRITTEN — NOT EXECUTED` |

---

## 6. Static Source Review Findings

A line-by-line static source review of [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) and [`frontend/src/test/group-member-removal-domain.test.ts`](../../../frontend/src/test/group-member-removal-domain.test.ts) confirmed:
1. **Imports, Types, and Signatures:** All helper methods and modified methods conform to existing TypeScript types (`EnrollmentRecord`, `CourseAttempt`, `EligibleAttemptOption`, `CourseAccessMode`, `MockStoreError`, `AttemptAmbiguityError`, `LessonProgress`).
2. **Exact Alignment of `getGroupMetrics()` Lookup (`Lines 2546–2602`):** Verified that `groupAttempt` in `getGroupMetrics()` uses the exact 4-part predicate (`userMatches && courseMatches && groupMatches && cycleMatches`) from Section 5.7 of the approved proposal and indexes `this.userProgress` using its 3-level nested dictionary type `Record<userId, Record<courseId, Record<itemId, LessonProgress>>>`.
3. **Error Codes & Messages:** All revoked learner access paths consistently throw `new MockStoreError('لم يعد لديك صلاحية الوصول إلى هذا المقرر بعد إزالتك من المجموعة التدريبية', 403, 'COURSE_ACCESS_REVOKED')`.
4. **End-to-End Consistency:** `getEligibleAttemptsForCourse()`, `getAttemptAccessMode()`, `resolveActiveAttemptForLearning()`, `getCourseProgress()`, `recordLessonActivity()`, `markLessonComplete()`, and `getGroupMetrics()` are mutually consistent across retained continuation, revoked access, same-attempt deduplication, multi-grant coexistence, preview mode, and administrative reporting.

---

## 7. Deferred Verification (`Gate B`) & Acceptance Status

- **Implementation Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`
- **Test File Status:** `WRITTEN — NOT EXECUTED`
- **Deferred Verification Commands (Queued for `Phase 4` / `Gate B` / `T-4.4.1`):**
  1. `npx tsc --noEmit` (Frontend TypeScript type-checking)
  2. `npx vitest run src/test/group-member-removal-domain.test.ts` (Focused `D-07` & `MFR-24` domain regression suite, including `RT-D07-01` through `RT-D07-09`)
  3. Full frontend Vitest regression suite (`npx vitest run`) at `Gate B` (`T-4.4.1`)
- **Remaining Work Before Final Acceptance:** Runtime execution and pass verification of the above commands during `Phase 4` (`Gate B` / `T-4.4.1`).
