# Post-WP-2.2 Remediation Proposal: `D-07` Retained-Course Continuation & Revoked-Attempt Authorization

> **Document Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`
> **Implementation State:** Approved by the Owner and implemented on `2026-11-09` (reconciled `2026-11-10`) in [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) (`Lines 1198–1693` and `Lines 2545–2602`) with regression tests `RT-D07-01` through `RT-D07-09` (`WRITTEN — NOT EXECUTED`) in [`frontend/src/test/group-member-removal-domain.test.ts`](../../../frontend/src/test/group-member-removal-domain.test.ts) (`Lines 453–1133`). Companion execution log: [`docs/project-state/remediation-proposals/wp-2.2-d07-retained-course-access-remediation-execution-log.md`](wp-2.2-d07-retained-course-access-remediation-execution-log.md).
> **Scope:** Focused remediation for the `D-07` retained-course continuation flow and revoked-attempt learner authorization boundary in [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts).
> **Governance Boundary:** Subject to `Gate B` verification deferral ([`docs/project-state/verification-and-test-strategy.md`](../verification-and-test-strategy.md)). Does not alter `WP-2.2` or `CP-006` status, does not modify [`docs/project-state/CURRENT.md`](../CURRENT.md) or [`docs/project-state/active-roadmap.md`](../active-roadmap.md), and does not introduce new task IDs.

---

## 1. Document Status

- **Current Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`
- **Owner Approval & Implementation Date:** `2026-11-09` (Test Inventory Reconciled `2026-11-10`)
- **Companion Execution Log:** [`docs/project-state/remediation-proposals/wp-2.2-d07-retained-course-access-remediation-execution-log.md`](wp-2.2-d07-retained-course-access-remediation-execution-log.md)
- **Modified Production File:** [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) (`canUseLegacyStandaloneFallback()`, `assertLearnerAttemptEntitlement()`, `getEligibleAttemptsForCourse()`, `resolveActiveAttemptForLearning()`, and `getGroupMetrics()`).
- **Modified Test File (`WRITTEN — NOT EXECUTED`):** [`frontend/src/test/group-member-removal-domain.test.ts`](../../../frontend/src/test/group-member-removal-domain.test.ts) (`Suite 6`, `RT-D07-01` through `RT-D07-09`, `Lines 453–1133`).
- **Verification State:** Subject to `Gate B` verification deferral (`WRITTEN — NOT EXECUTED`). Runtime test execution (`vitest`) and TypeScript compilation (`tsc --noEmit`) remain deferred to `Phase 4` (`Gate B` / `T-4.4.1`).
- **Design Rationale Preservation:** Sections 2 through 10 preserve the complete approved remediation design rationale.

---

## 2. Context & Background

### 2.1 The `D-07` Business Rule (`MFR-24`)
Under Owner Decision `D-07` ([`docs/architecture/decision-register.md`](../../architecture/decision-register.md) and [`docs/requirements/domain-business-rules.md`](../../requirements/domain-business-rules.md)), when an administrator removes a trainee from a training group via [`removeGroupMember(groupId, traineeId, removeCourseIds)`](../../../frontend/src/mocks/store/inMemoryStore.ts#L5887-L6198), the administrator chooses per assigned group course whether to remove or retain the trainee's enrollment in that course:

1. **Unchecked Course — Retained as Self-Paced Continuation (Default `D-07` Behavior, `removeCourseIds` excludes `courseId`):**
   - The trainee is removed from the group's membership (`group.traineeIds` and `this.groupMembers[group.id]`).
   - The original group enrollment grant (`kind: 'group'`, `sourceId: 'group:${group.id}:${cycleId}'`) is preserved for audit provenance and transitioned to `status: 'revoked_by_group_removal'` (`revokedAt: nowIso`).
   - A standalone continuation grant (`kind: 'self'`, `sourceId: 'self:continued:${group.id}:${boundAttemptId}'`, `convertedFromGroupId: group.id`, `status: 'active'`) is created or reactivated on `enrollment.sources` and bound to the **exact same `CourseAttempt` (`boundAttemptId`)**.
   - The trainee retains full learner access (`accessMode: 'full'`) to continue from their existing lesson progress on `boundAttemptId`, free from the former group's deadline or post-deadline restrictions (`keep_no_cert` or `hide`).
2. **Checked Course — Revoked Group Course Access (`removeCourseIds` includes `courseId`):**
   - The group enrollment grant (`kind: 'group'`) is transitioned to `status: 'revoked_by_group_removal'` (`revokedAt: nowIso`).
   - If the trainee holds no other active grant (`status: 'active'`) in `enrollment.sources` for that course, `enrollment.status` is transitioned to `'revoked_by_group_removal'` and the trainee loses learner access to that course attempt.
   - If the trainee holds another independent active grant for the same course (for example, an independent catalog self-enrollment `self:catalog:...` or an active grant from another training group), `enrollment.status` remains `'active'` and the trainee continues to access the course through that separate active grant's attempt.
   - In all cases, the historical `CourseAttempt` in `this.courseAttempts`, its `AttemptProgress` in `this.attemptProgress[attemptId]`, and the revoked `EnrollmentSourceGrant` in `enrollment.sources` are preserved for administrative history, transcripts, and cohort auditing.

### 2.2 Summary of Post-`WP-2.2` Consistency Audits
During the post-`WP-2.2` read-only consistency, reconciliation, and interaction audits of [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts), static inspection traced the interaction between [`removeGroupMember()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L5887-L6198), [`getEligibleAttemptsForCourse()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1203-L1388), [`getAttemptAccessMode()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1393-L1436), [`resolveActiveAttemptForLearning()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1449-L1557), [`getCourseProgress()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1589-L1704), [`recordLessonActivity()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1852-L2007), and [`markLessonComplete()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L2015-L2230).

Those audits confirmed that:
1. Retaining a course under `D-07` (`removeCourseIds: []`) leaves both the revoked `kind: 'group'` grant (`enrollment.sources[0]`) and the active `kind: 'self'` continuation grant (`enrollment.sources[1]`) bound to the same `boundAttemptId`, triggering a multi-step failure in `getEligibleAttemptsForCourse()` and `getAttemptAccessMode()`.
2. Removing a course (`removeCourseIds: [courseId]`) leaves authorization gaps in `getEligibleAttemptsForCourse()` and `resolveActiveAttemptForLearning()` that allow a revoked attempt to be resurrected via fallback logic or accessed directly when an explicit `attemptId` or `groupId` is supplied.

---

## 3. Confirmed Root Causes

Static analysis of [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) and [`frontend/src/core/groups/types.ts`](../../../frontend/src/core/groups/types.ts) established six interacting root causes:

### 3.1 RC-01 — Revoked Grant Processing When an Active Alternate Grant Shares `attemptId`
- **Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1222–1230`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1222-L1230)
- **Mechanism:**
  ```ts
  if (grant.status === 'revoked_by_group_removal') {
    const hasActiveAlternate = enrollment.sources.some(
      (other) => other.attemptId === grant.attemptId && other.status === 'active'
    );
    if (!hasActiveAlternate) {
      continue;
    }
  }
  ```
  When `removeGroupMember()` retains a course (`removeCourseIds: []`), `enrollment.sources[0]` is the original `kind: 'group'` grant with `status: 'revoked_by_group_removal'` and `attemptId: boundAttemptId`, while `enrollment.sources[1]` is the newly created `kind: 'self'` continuation grant with `status: 'active'` and the **same** `attemptId: boundAttemptId`. On Iteration 0 (`grant = enrollment.sources[0]`), `hasActiveAlternate` matches `enrollment.sources[1]` and evaluates to `true`. As a result, `getEligibleAttemptsForCourse()` **does not skip** the revoked group grant on Iteration 0, even though the active continuation grant is already present as its own element in `enrollment.sources` at index `1`.

### 3.2 RC-02 — Invalid `g.members.some(...)` Property Access on `TrainingGroup`
- **Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1273–1277`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1273-L1277) and [`frontend/src/core/groups/types.ts` (`Lines 197–231`)](../../../frontend/src/core/groups/types.ts#L197-L231)
- **Mechanism:**
  ```ts
  const isContinuation =
    grant.sourceId.startsWith('self:continued:') ||
    grant.sourceId.startsWith('continuation:') ||
    Boolean(grant.convertedFromGroupId) ||
    Boolean(grant.groupId && this.groups.find((g) => g.id === grant.groupId && !g.members.some((m) => m.userId.toLowerCase().trim() === canonicalUserId || m.userId.toLowerCase().trim() === rawUserId)));
  ```
  While processing the unskipped revoked `kind: 'group'` grant on Iteration 0 (`sourceId: 'group:...'`, `convertedFromGroupId: undefined`, `groupId: group.id`), the first three clauses of `isContinuation` evaluate to `false`, and execution reaches `!g.members.some(...)` at `Line 1277` (for any group that is not expired under `effectivePostDeadlinePolicy === 'hide'`).
  In [`frontend/src/core/groups/types.ts`](../../../frontend/src/core/groups/types.ts#L197-L231), `TrainingGroup` declares `traineeIds: string[]` (`Line 203`) and has no `members` property; group member objects are stored separately in `this.groupMembers[group.id]` ([`inMemoryStore.ts` `Line 335`](../../../frontend/src/mocks/store/inMemoryStore.ts#L335)). Evaluating `!g.members.some(...)` when `g.members` is `undefined` throws a synchronous `TypeError: Cannot read properties of undefined (reading 'some')` before Iteration 1 (the active continuation grant) is ever reached.

### 3.3 RC-03 — Flawed `optionsMap` Deduplication Precedence
- **Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1315–1322`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1315-L1322)
- **Mechanism:**
  ```ts
  if (optionsMap.has(attempt.id)) {
    const existing = optionsMap.get(attempt.id)!;
    if (existing.accessMode === 'review_only' && accessMode === 'full') {
      optionsMap.set(attempt.id, option);
    }
  } else {
    optionsMap.set(attempt.id, option);
  }
  ```
  Even if `Line 1277` did not throw (or when two active grants—a `kind: 'group'` grant and a `kind: 'self'` continuation grant—reference the same `attempt.id`), Iteration 0 inserts the `kind: 'group'` option into `optionsMap` with `accessMode: 'full'` whenever the group is not expired. When Iteration 1 processes the active `kind: 'self'` continuation grant for the same `attempt.id`, `existing.accessMode === 'review_only' && accessMode === 'full'` evaluates to `false`, so the active continuation option fails to replace the group option in `optionsMap`.

### 3.4 RC-04 — Unguarded Standalone Fallback Resurrecting Revoked or Inactive Attempts
- **Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1326–1385`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1326-L1385)
- **Mechanism:**
  When a trainee is removed from a group with a course checked for removal (`removeCourseIds: [courseId]`) and has no other active grant on that course, [`removeGroupMember()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L6040-L6066) sets the grant's status to `'revoked_by_group_removal'`, sets `enrollment.status = 'revoked_by_group_removal'`, and preserves the historical `CourseAttempt` in `this.courseAttempts` (`Line 6046`).
  In `getEligibleAttemptsForCourse()`, skipping the revoked grant in `enrollment.sources` leaves `optionsMap.size === 0`. Because `Line 1327` checks only `if (optionsMap.size === 0)`—without checking whether `enrollment.sources` was non-empty or whether `enrollment.status` is `'revoked_by_group_removal'` or `'inactive'`—the fallback scans `this.courseAttempts` and resurrects the preserved historical attempt as an eligible learner option.

### 3.5 RC-05 — Missing Active-Entitlement Validation & Replacement-Attempt Provisioning in `resolveActiveAttemptForLearning()`
- **Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1449–1557`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1449-L1557)
- **Mechanism:**
  [`resolveActiveAttemptForLearning()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1449-L1557) is the central attempt resolver called by [`getCourseProgress()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1625), [`recordLessonActivity()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1909), and [`markLessonComplete()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L2081). When called **without** an explicit `attemptId` or `groupId` for a course whose grant was revoked (`eligibleAttempts.length === 0`), execution falls through to Branch 4 (`Lines 1552–1556`):
  ```ts
  // 4. Fallback: resolve or create standalone attempt
  return this.getOrCreateCurrentAttempt({
    userId: params.userId,
    courseId: params.courseId,
  });
  ```
  This unconditionally provisions or returns a standalone `CourseAttempt` (`ATT-${canonicalUserId}-${canonicalCourse}-standalone`), creating a brand-new replacement attempt for a learner whose course access was revoked (or whose enrollment is `inactive`).

### 3.6 RC-06 — Explicit `attemptId` and `groupId` Authorization Bypasses & Early Failure in `getAttemptAccessMode()`
- **Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1393–1436` and `1461–1485`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1393-L1485)
- **Mechanism:**
  1. **Explicit `attemptId` Bypass (`Lines 1461–1475`):** When `params.attemptId` is supplied, `resolveActiveAttemptForLearning()` checks only that the `CourseAttempt` exists (`404`), belongs to `userId` (`403`), and matches `courseId` (`400`). It never verifies that the attempt is backed by an active learner entitlement. Consequently, passing a revoked `attemptId` to `getCourseProgress(userId, courseId, { attemptId })` resolves the revoked attempt and returns learner progress.
  2. **Explicit `groupId` Bypass (`Lines 1477–1485`):** When `params.groupId` is supplied, `resolveActiveAttemptForLearning()` immediately calls `this.getOrCreateCurrentAttempt(...)` (`Lines 7087–7096`), which finds and returns the preserved group `CourseAttempt` from `this.courseAttempts` without checking whether the learner's group grant was revoked.
  3. **Premature Failure in `getAttemptAccessMode()` (`Line 1394`):** `getAttemptAccessMode()` calls `this.getEligibleAttemptsForCourse(userId, courseId)` on `Line 1394` before reaching its direct `isContinuationActive` fallback (`Lines 1412–1416`). Because `getCourseProgress()` (`Line 1689`), `recordLessonActivity()` (`Line 1917`), and `markLessonComplete()` (`Line 2089`) all invoke `getAttemptAccessMode()`, any failure in `getEligibleAttemptsForCourse()` also breaks callers that supplied an explicit `attemptId`.

---

## 4. Authorization Model

To resolve all six root causes without introducing a new `CourseAccessMode` union member, the remediation establishes a strict four-state separation of responsibilities:

### 4.1 The Four Authorization States

| Authorization State | Entitlement Condition | `getEligibleAttemptsForCourse()` | `resolveActiveAttemptForLearning()` | `getCourseProgress()` | `recordLessonActivity()` & `markLessonComplete()` | Administrative & Cohort History APIs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Active Learner Entitlement (`accessMode: 'full'`)** | Active grant (`status: 'active'`) bound to the attempt (`group` within deadline/active cycle, `self:catalog`, or `D-07` `self:continued`), or allowed legacy standalone fallback. | Included with `accessMode: 'full'`. | Resolves `CourseAttempt`. | Returns `CourseProgress` (`accessMode: 'full'`). | Permitted; mutates attempt progress. | Full read access. |
| **2. Valid Read-Only Learner Access (`accessMode: 'review_only'`)** | Active (`status: 'active'`, non-revoked) `kind: 'group'` grant where the group/cycle deadline expired with `effectivePostDeadlinePolicy === 'keep_no_cert'`, or where the cycle status is `'completed' \| 'archived'`. | Included with `accessMode: 'review_only'`. | Resolves `CourseAttempt`. | Returns `CourseProgress` (`accessMode: 'review_only'`). | Rejected with `403 COURSE_ACCESS_REVIEW_ONLY` (`Lines 1918–1924`, `2090–2096`). | Full read access. |
| **3. Revoked / Inactive Learner Access (`403 COURSE_ACCESS_REVOKED`)** | Attempt's grant(s) in `enrollment.sources` are `'revoked_by_group_removal'` (or `'expired'`) with **no** active alternate grant on the same `attemptId`; or `enrollment.status` is `'revoked_by_group_removal'` / `'inactive'` with no active grants. | Excluded (`[]` if no other active attempt exists on another `attemptId`). | **Rejected with `403 COURSE_ACCESS_REVOKED`** across all branches (implicit, explicit `attemptId`, explicit `groupId`). Never creates a replacement attempt. | **Rejected with `403 COURSE_ACCESS_REVOKED`**. | **Rejected with `403 COURSE_ACCESS_REVOKED`**. | **Full read access preserved** (bypasses `resolveActiveAttemptForLearning()`). |
| **4. Administrative Access to Historical Records** | Historical `CourseAttempt`, `AttemptProgress`, and `EnrollmentSourceGrant` preserved in store ledgers (`Line 6046`). | Not applicable (learner-only API). | Not applicable (administrative APIs read store ledgers directly). | Not applicable. | Not applicable. | **Full read access** via `getTraineeAttempts()`, `getCourseAttemptStatsForTrainee()`, `getCycleAttempts()`, `getGroupAttempts()`, `getAttemptProgress()`, `getGroupMetrics()`, and `getUserEnrollments()`. |

### 4.2 Why `review_only` Must Not Be Used as a Substitute for Access Denial
In the existing learner architecture, `CourseAccessMode` (`'full' | 'review_only'`) governs what a learner can do **after** they are authorized to open a course attempt:
- When `accessMode === 'review_only'`, [`getCourseProgress()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1689-L1703) still succeeds and returns the full `CourseProgress` object to the learner UI so the trainee can review completed lessons after a group deadline under `keep_no_cert`.
- Conversely, under `D-07`, when an administrator checks a course for removal (`removeCourseIds: [courseId]`) and the trainee has no other active grant, the trainee's learner access to that course attempt is **revoked**, not converted to read-only review.
- Therefore, revoked learner access must be rejected at attempt resolution (`resolveActiveAttemptForLearning()`) with `MockStoreError(..., 403, 'COURSE_ACCESS_REVOKED')` before `getCourseProgress()`, `recordLessonActivity()`, or `markLessonComplete()` can expose or mutate the attempt.

---

## 5. Proposed Remediation Steps (By Exact Function)

All proposed code changes are localized to [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts).

---

### 5.1 Helper 1 — `canUseLegacyStandaloneFallback()` (New Private Helper)

- **Target Location:** [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) (immediately above `getEligibleAttemptsForCourse()` at `Line 1203`)
- **Current Problem:** Both `getEligibleAttemptsForCourse()` (`Line 1327`) and `resolveActiveAttemptForLearning()` (`Line 1552`) fall back to standalone attempts whenever `optionsMap.size === 0` / `eligibleAttempts.length === 0`, without checking whether `enrollment` has explicit grant sources (`enrollment.sources.length > 0`) or whether `enrollment.status` is `'revoked_by_group_removal'` or `'inactive'`.
- **Proposed Correction:**
  ```ts
  /**
   * Determines whether legacy standalone fallback (when enrollment.sources is empty) is allowed.
   * Permits fallback ONLY when no enrollment record exists (preview / unseeded legacy tests)
   * OR when enrollment.status === 'active' with an empty sources array.
   * Strictly blocks fallback when enrollment.status is 'revoked_by_group_removal' or 'inactive',
   * or when explicit grant sources exist on the enrollment.
   */
  private canUseLegacyStandaloneFallback(enrollment: CourseEnrollment | undefined): boolean {
    if (!enrollment) {
      return true;
    }
    const hasExplicitSources = Array.isArray(enrollment.sources) && enrollment.sources.length > 0;
    if (hasExplicitSources) {
      return false;
    }
    return enrollment.status === 'active';
  }
  ```
- **Expected Behavior After Correction:** Returns `true` only for unseeded preview/test calls (`!enrollment`) or legacy active enrollments with no grant entries (`enrollment.status === 'active'` and `sources: []`). Returns `false` whenever `enrollment.sources.length > 0` or `enrollment.status !== 'active'`.
- **Dependencies:** Used by `getEligibleAttemptsForCourse()`, `assertLearnerAttemptEntitlement()`, and `resolveActiveAttemptForLearning()`.

---

### 5.2 Helper 2 — `assertLearnerAttemptEntitlement()` (New Private Helper)

- **Target Location:** [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) (immediately above `getEligibleAttemptsForCourse()` at `Line 1203`)
- **Current Problem:** `resolveActiveAttemptForLearning()` accepts any existing `attemptId` (`Lines 1462–1475`) or `groupId` (`Lines 1478–1485`) that matches `userId` and `courseId`, without verifying that the attempt is backed by an active learner entitlement.
- **Proposed Correction:**
  ```ts
  /**
   * Validates that a resolved CourseAttempt is backed by an active learner entitlement
   * (either an eligible active grant or a permitted legacy standalone fallback).
   * Rejects revoked, inactive, or hidden-expired attempts with 403 COURSE_ACCESS_REVOKED.
   */
  private assertLearnerAttemptEntitlement(
    userId: string,
    courseId: string,
    attempt: CourseAttempt
  ): void {
    const canonicalUserId = resolveCanonicalUserId(userId).toLowerCase().trim();
    const rawUserId = userId.toLowerCase().trim();
    const normalizedCourseId = courseId.toLowerCase().trim();

    const enrollment = this.enrollments.find(
      (e) =>
        e.courseId.toLowerCase().trim() === normalizedCourseId &&
        (resolveCanonicalUserId(e.userId).toLowerCase().trim() === canonicalUserId ||
          e.userId.toLowerCase().trim() === rawUserId)
    );

    const eligible = this.getEligibleAttemptsForCourse(userId, courseId);
    if (eligible.some((opt) => opt.attemptId === attempt.id)) {
      return;
    }

    if (this.canUseLegacyStandaloneFallback(enrollment)) {
      if (attempt.groupId) {
        const group = this.groups.find(
          (g) => g.id.toLowerCase().trim() === attempt.groupId!.toLowerCase().trim()
        );
        const isGroupMember = Boolean(
          group &&
            (group.traineeIds || []).some(
              (tid) =>
                tid.toLowerCase().trim() === rawUserId ||
                resolveCanonicalUserId(tid).toLowerCase().trim() === canonicalUserId
            )
        );
        if (!isGroupMember) {
          throw new MockStoreError(
            'تم إلغاء صلاحية الوصول التدريبي إلى هذا المقرر بعد إخراج المتدرب من المجموعة',
            403,
            'COURSE_ACCESS_REVOKED'
          );
        }
      }
      return;
    }

    throw new MockStoreError(
      'تم إلغاء صلاحية الوصول التدريبي إلى هذا المقرر أو انتهاء صلاحية القيد التدريبي',
      403,
      'COURSE_ACCESS_REVOKED'
    );
  }
  ```
- **Expected Behavior After Correction:** Ensures that any attempt resolved via explicit `attemptId` or `groupId` is either present in `getEligibleAttemptsForCourse(userId, courseId)` (which includes active `'full'` attempts, `D-07` continuation attempts, and valid `'review_only'` attempts) or qualifies for legacy standalone fallback. Otherwise, throws `MockStoreError` (`403`, `'COURSE_ACCESS_REVOKED'`).
- **Dependencies:** Depends on `getEligibleAttemptsForCourse()` and `canUseLegacyStandaloneFallback()`.

---

### 5.3 Function 1 — [`getEligibleAttemptsForCourse()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1203-L1388) (`Lines 1203–1388`)

- **Target Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1220–1360`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1220-L1360)
- **Current Problems:**
  1. `Lines 1222–1230`: Fails to skip `revoked_by_group_removal` grants when `hasActiveAlternate` is `true`.
  2. `Line 1277`: Evaluates `!g.members.some(...)` on `TrainingGroup`, throwing `TypeError`.
  3. `Line 1302`: Sets `cycleId: grant.cycleId || null` on the `EligibleAttemptOption`. When [`removeGroupMember()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L6128-L6138) (`Lines 6128–6138`) creates or reactivates a `D-07` continuation grant, `grant.cycleId` is `undefined`, whereas its bound `CourseAttempt` retains the original `attempt.cycleId`. Setting `cycleId: grant.cycleId || null` drops the attempt's cycle context (`null`), preventing explicit `groupId + cycleId` resolution in `resolveActiveAttemptForLearning()` from matching the retained continuation option.
  4. `Lines 1315–1320`: Does not replace an existing `kind: 'group'` option (`accessMode: 'full'`) with an active `kind: 'self'` continuation option sharing the same `attempt.id`.
  5. `Lines 1327–1360`: Runs the standalone fallback whenever `optionsMap.size === 0`, even when `enrollment.sources` is non-empty or `enrollment.status` is `'revoked_by_group_removal'` / `'inactive'`, or when a group attempt belongs to a group from which the user was removed.
- **Proposed Correction:**
  ```ts
    if (enrollment && Array.isArray(enrollment.sources) && enrollment.sources.length > 0) {
      for (const grant of enrollment.sources) {
        // 1. Unconditionally skip non-active grants ('revoked_by_group_removal' / 'expired').
        if (grant.status !== 'active') {
          continue;
        }
        ...
        // 2. Rely strictly on explicit continuation provenance (remove invalid g.members access).
        const isContinuation =
          grant.sourceId.startsWith('self:continued:') ||
          grant.sourceId.startsWith('continuation:') ||
          Boolean(grant.convertedFromGroupId);
        ...
        // 3. Preserve attempt.cycleId when grant.cycleId is undefined (e.g., D-07 continuation grants)
        //    so explicit groupId + cycleId resolution retains cycle provenance.
        const option: EligibleAttemptOption = {
          attemptId: attempt.id,
          sourceId: grant.sourceId,
          kind: grant.kind,
          groupId: grant.groupId || null,
          groupName: groupName || null,
          cycleId: grant.cycleId || attempt.cycleId || null,
          cycleTitle: cycleTitle || null,
          convertedFromGroupId: originGId,
          convertedFromGroupName: originGroup?.name || null,
          contextLabel,
          accessMode,
          progressPercent,
          completedLessons,
          totalLessons,
          lastActivityAt,
          status: attempt.status,
        };

        // 4. Upgrade 'review_only' -> 'full', and prefer an active 'self'/continuation grant
        //    over a 'group' grant when both reference the same attempt.id with 'full' access.
        if (optionsMap.has(attempt.id)) {
          const existing = optionsMap.get(attempt.id)!;
          const upgradesAccess = existing.accessMode === 'review_only' && accessMode === 'full';
          const prefersSelfContinuation =
            existing.kind === 'group' && option.kind === 'self' && accessMode === 'full';
          if (upgradesAccess || prefersSelfContinuation) {
            optionsMap.set(attempt.id, option);
          }
        } else {
          optionsMap.set(attempt.id, option);
        }
      }
    }

    // 5. Guarded standalone fallback: only when allowed by canUseLegacyStandaloneFallback(enrollment)
    if (optionsMap.size === 0 && this.canUseLegacyStandaloneFallback(enrollment)) {
      const existingAttempts = this.courseAttempts.filter(
        (a) =>
          a.courseId.toLowerCase().trim() === normalizedCourseId &&
          (a.userId.toLowerCase().trim() === canonicalUserId ||
            a.userId.toLowerCase().trim() === rawUserId)
      );

      for (const attempt of existingAttempts) {
        let accessMode: CourseAccessMode = 'full';
        let groupName: string | undefined;
        let cycleTitle: string | undefined;

        if (attempt.groupId) {
          const group = this.groups.find(
            (g) => g.id.toLowerCase().trim() === attempt.groupId!.toLowerCase().trim()
          );
          const isGroupMember = Boolean(
            group &&
              (group.traineeIds || []).some(
                (tid) =>
                  tid.toLowerCase().trim() === rawUserId ||
                  resolveCanonicalUserId(tid).toLowerCase().trim() === canonicalUserId
              )
          );
          if (!isGroupMember) {
            continue;
          }
  ```
- **Expected Behavior After Correction:**
  - Skips all non-active grants (`revoked_by_group_removal` and `expired`) immediately.
  - Processes the active `D-07` continuation grant (`self:continued:...`) without touching `g.members`, returning the retained attempt with `kind: 'self'`, `convertedFromGroupId: group.id`, `cycleId: grant.cycleId || attempt.cycleId || null`, and `accessMode: 'full'`.
  - Returns `[]` when all grants in `enrollment.sources` are revoked or when `enrollment.status` is `'revoked_by_group_removal'` or `'inactive'`.
- **Dependencies:** Depends on `canUseLegacyStandaloneFallback()`.

---

### 5.4 Function 2 — [`resolveActiveAttemptForLearning()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1449-L1557) (`Lines 1449–1557`)

- **Target Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1461–1486` and `1551–1557`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1461-L1557)
- **Current Problems:**
  1. Branch 1 (`params.attemptId`, `Lines 1462–1475`) returns `explicitAttempt` without verifying active learner entitlement.
  2. Branch 2 (`params.groupId`, `Lines 1478–1485`) calls `getOrCreateCurrentAttempt()` and returns the group attempt even if the group grant was revoked.
  3. Branch 4 (`Lines 1552–1556`) calls `getOrCreateCurrentAttempt()` when `eligibleAttempts.length === 0`, creating a replacement standalone attempt when course access was revoked or inactivated.
- **Proposed Correction:**
  ```ts
    // 1. Explicit attemptId
    if (params.attemptId) {
      const explicitAttempt = this.courseAttempts.find((a) => a.id === params.attemptId);
      if (!explicitAttempt) {
        throw new MockStoreError('سجل محاولة التدريب المحددة غير موجود', 404);
      }
      const attemptUser = explicitAttempt.userId.toLowerCase().trim();
      if (attemptUser !== canonicalUserId && attemptUser !== rawUserId) {
        throw new MockStoreError('محاولة التدريب المحددة لا تنتمي إلى هذا المستخدم', 403);
      }
      if (explicitAttempt.courseId.toLowerCase().trim() !== normalizedCourseId) {
        throw new MockStoreError('محاولة التدريب المحددة لا تنتمي إلى هذا المقرر', 400);
      }
      this.assertLearnerAttemptEntitlement(params.userId, params.courseId, explicitAttempt);
      return explicitAttempt;
    }

    // 2. Explicit groupId context
    if (params.groupId) {
      const enrollment = this.enrollments.find(
        (e) =>
          e.courseId.toLowerCase().trim() === normalizedCourseId &&
          (resolveCanonicalUserId(e.userId).toLowerCase().trim() === canonicalUserId ||
            e.userId.toLowerCase().trim() === rawUserId)
      );
      if (!this.canUseLegacyStandaloneFallback(enrollment)) {
        const eligible = this.getEligibleAttemptsForCourse(params.userId, params.courseId);
        const reqGroupLower = params.groupId.toLowerCase().trim();
        const reqCycleLower = params.cycleId?.toLowerCase().trim();
        const matchingEligible = eligible.find(
          (opt) =>
            (opt.groupId?.toLowerCase().trim() === reqGroupLower ||
              opt.convertedFromGroupId?.toLowerCase().trim() === reqGroupLower) &&
            (!reqCycleLower || opt.cycleId?.toLowerCase().trim() === reqCycleLower)
        );
        if (!matchingEligible) {
          throw new MockStoreError(
            'تم إلغاء صلاحية الوصول التدريبي إلى هذا المقرر في المجموعة المحددة',
            403,
            'COURSE_ACCESS_REVOKED'
          );
        }
        const boundAttempt = this.courseAttempts.find((a) => a.id === matchingEligible.attemptId);
        if (boundAttempt) {
          return boundAttempt;
        }
      }
      const groupAttempt = this.getOrCreateCurrentAttempt({
        userId: params.userId,
        courseId: params.courseId,
        groupId: params.groupId,
        cycleId: params.cycleId,
      });
      this.assertLearnerAttemptEntitlement(params.userId, params.courseId, groupAttempt);
      return groupAttempt;
    }
    ...
    // 4. Fallback: resolve or create standalone attempt ONLY when legacy standalone fallback is permitted
    const enrollment = this.enrollments.find(
      (e) =>
        e.courseId.toLowerCase().trim() === normalizedCourseId &&
        (resolveCanonicalUserId(e.userId).toLowerCase().trim() === canonicalUserId ||
          e.userId.toLowerCase().trim() === rawUserId)
    );
    if (!this.canUseLegacyStandaloneFallback(enrollment)) {
      throw new MockStoreError(
        'تم إلغاء صلاحية الوصول التدريبي إلى هذا المقرر أو لا يوجد قيد تدريبي نشط',
        403,
        'COURSE_ACCESS_REVOKED'
      );
    }

    return this.getOrCreateCurrentAttempt({
      userId: params.userId,
      courseId: params.courseId,
    });
  ```
- **Expected Behavior After Correction:**
  - Implicit resolution (no `attemptId`/`groupId`) resolves the single eligible attempt when one exists, throws `AttemptAmbiguityError` when multiple exist, and throws `403 COURSE_ACCESS_REVOKED` (without creating a replacement attempt) when `eligibleAttempts` is empty on a revoked, inactive, or source-tracked enrollment.
  - Explicit `attemptId` and explicit `groupId` (including `groupId + cycleId` after `D-07` retention, because `opt.cycleId` preserves `attempt.cycleId` from Section 5.3) resolve entitled attempts and throw `403 COURSE_ACCESS_REVOKED` for revoked attempts.
- **Dependencies:** Depends on `getEligibleAttemptsForCourse()` (including `cycleId: grant.cycleId || attempt.cycleId || null`), `canUseLegacyStandaloneFallback()`, and `assertLearnerAttemptEntitlement()`.

---

### 5.5 Function 3 — [`getCourseProgress()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1589-L1704) (`Lines 1589–1704`)

- **Target Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1589–1704`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1589-L1704)
- **Current Problem:** When `options.attemptId` or `options.groupId` was supplied (or when `eligible.length === 0` fell through to Branch 4 in `resolveActiveAttemptForLearning()`), `getCourseProgress()` returned learner progress for a revoked attempt or a newly created replacement attempt.
- **Proposed Correction:** No structural signature change or administrative bypass is added to `getCourseProgress()`. It remains strictly a learner-authorization-enforcing reader that delegates attempt resolution to `this.resolveActiveAttemptForLearning({ userId, courseId: course.id, attemptId: options?.attemptId, groupId: options?.groupId, cycleId: options?.cycleId })` at `Lines 1625–1631` whenever `eligible.length <= 1` or when `options.attemptId` / `options.groupId` is supplied.
- **Expected Behavior After Correction:**
  - For a `D-07` retained course (`removeCourseIds: []`), `getCourseProgress()` resolves `boundAttemptId` (implicitly, with `{ attemptId: boundAttemptId }`, or with `{ groupId, cycleId }`) and returns its `CourseProgress` with `accessMode: 'full'`.
  - For a revoked course (`removeCourseIds: [courseId]`) or a group course hidden after deadline under `postDeadlinePolicy: 'hide'` with no active alternate grant, `getCourseProgress()` is rejected at `Line 1625` with `403 COURSE_ACCESS_REVOKED`.
- **Dependencies:** Depends on the corrected `resolveActiveAttemptForLearning()` and `getEligibleAttemptsForCourse()`.

---

### 5.6 Function 4 — [`getAttemptAccessMode()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L1393-L1436) (`Lines 1393–1436`)

- **Target Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 1393–1436`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L1393-L1436)
- **Current Problem:** `getAttemptAccessMode()` calls `this.getEligibleAttemptsForCourse(userId, courseId)` on `Line 1394`. Before the `getEligibleAttemptsForCourse()` fix, `Line 1394` threw `TypeError` at `Line 1277` on `D-07` retained courses before reaching `Lines 1412–1416`.
- **Proposed Correction:** With `getEligibleAttemptsForCourse()` corrected in Section 5.3 and `resolveActiveAttemptForLearning()` rejecting revoked attempts with `403 COURSE_ACCESS_REVOKED` in Section 5.4 before `getAttemptAccessMode()` is called by `getCourseProgress()` (`Line 1689`), `recordLessonActivity()` (`Line 1917`), or `markLessonComplete()` (`Line 2089`), `getAttemptAccessMode()` will cleanly match the active continuation option at `Lines 1394–1397` and return `'full'`. No new `CourseAccessMode` value is added.
- **Expected Behavior After Correction:** Returns `'full'` for `D-07` retained continuation attempts (regardless of the former group's deadline or post-deadline policy) and `'review_only'` for non-revoked group attempts that are in valid read-only review mode (`keep_no_cert` after deadline or completed/archived cycle).
- **Dependencies:** Depends on `getEligibleAttemptsForCourse()` and `resolveActiveAttemptForLearning()`.

---

### 5.7 Function 5 — [`getGroupMetrics()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L2409-L2450) (`Lines 2409–2450`) — Keeping Administrative Metrics Independent of Learner Authorization

- **Target Location:** [`frontend/src/mocks/store/inMemoryStore.ts` (`Lines 2409–2450`)](../../../frontend/src/mocks/store/inMemoryStore.ts#L2409-L2450)
- **Current Problem:**
  In [`getGroupMetrics()`](../../../frontend/src/mocks/store/inMemoryStore.ts#L2411-L2449), the attempt lookup at `Lines 2411–2421` only searches `this.courseAttempts` when `targetCycle` is non-null (`const cycleAttempt = targetCycle ? this.courseAttempts.find(...) : null`). When `cycleAttempt` is `null` (such as a legacy cycleless group where `targetCycle === null`, or when a group member has not yet provisioned a cycle attempt), `Lines 2440–2443` fall back to learner-facing `this.getCourseProgress(traineeId, ac.courseId, { groupId: group.id, cycleId: targetCycle?.id })`.
  Under the stricter learner entitlement enforcement in `resolveActiveAttemptForLearning()`, if a legacy cycleless group is expired with `effectivePostDeadlinePolicy === 'hide'`, `getEligibleAttemptsForCourse()` skips the hidden group grant (`Line 1261`), causing learner-facing `getCourseProgress()` to throw `403 COURSE_ACCESS_REVOKED`. Administrative cohort metrics must never depend on learner-facing `getCourseProgress()` or fail when a group's post-deadline policy hides expired courses from learners.
- **Proposed Correction:**
  Replace the `else` fallback to `this.getCourseProgress(...)` in `getGroupMetrics()` (`Lines 2411–2449`) with a direct administrative lookup against `this.courseAttempts` and `this.getAttemptProgress()` (with read-only fallback to legacy `this.userProgress` if no attempt record exists), scoped to `traineeId`, `ac.courseId`, `group.id`, and optional `targetCycle?.id`:
  ```ts
        const canonicalTraineeId = resolveCanonicalUserId(traineeId).toLowerCase().trim();
        const rawTraineeId = traineeId.toLowerCase().trim();
        const normCourseId = ac.courseId.toLowerCase().trim();
        const normGroupId = group.id.toLowerCase().trim();

        // Direct administrative lookup in courseAttempts (supports both cycle-scoped and legacy cycleless groups)
        const groupAttempt = this.courseAttempts.find((a) => {
          const userMatches =
            a.userId.toLowerCase().trim() === rawTraineeId ||
            resolveCanonicalUserId(a.userId).toLowerCase().trim() === canonicalTraineeId;
          const courseMatches = a.courseId.toLowerCase().trim() === normCourseId;
          const groupMatches = a.groupId
            ? a.groupId.toLowerCase().trim() === normGroupId
            : isCycleOwnedByGroup(a.cycleId, group.id);
          const cycleMatches = targetCycle
            ? a.cycleId?.toLowerCase().trim() === targetCycle.id.toLowerCase().trim()
            : true;
          return userMatches && courseMatches && groupMatches && cycleMatches;
        });

        let progressPercent = 0;
        let completedItemIds: string[] = [];
        let isCompleted = false;
        let isStarted = false;
        let lastActivityAt: string | null = null;

        const flatItems = this.getCourseItems(ac.courseId);
        if (groupAttempt) {
          const attProg = this.getAttemptProgress(groupAttempt.id);
          const candidateCompleted = attProg?.completedItemIds ?? groupAttempt.completedItemIds ?? [];
          const validCompleted = candidateCompleted.filter((id) => flatItems.some((it) => it.id === id));
          isStarted =
            isAttemptStarted(groupAttempt) ||
            validCompleted.length > 0 ||
            (attProg ? attProg.progressPercent > 0 : false);
          progressPercent = calculateTraineeProgress(flatItems.length, validCompleted.length);
          completedItemIds = validCompleted;
          isCompleted = flatItems.length > 0 && validCompleted.length === flatItems.length;
          lastActivityAt =
            groupAttempt.lastActivityAt || attProg?.updatedAt || groupAttempt.updatedAt || null;
        } else {
          // Read-only legacy progress fallback for unmigrated cycleless fixtures without invoking learner getCourseProgress()
          const legacyProg =
            this.userProgress[canonicalTraineeId]?.[normCourseId] ||
            this.userProgress[rawTraineeId]?.[normCourseId];
          if (legacyProg && Object.keys(legacyProg).length > 0) {
            completedItemIds = flatItems
              .filter((it) => legacyProg[it.id]?.completed)
              .map((it) => it.id);
            progressPercent = calculateTraineeProgress(flatItems.length, completedItemIds.length);
            isCompleted = flatItems.length > 0 && completedItemIds.length === flatItems.length;
            isStarted = progressPercent > 0 || completedItemIds.length > 0;
          }
        }
  ```
- **Expected Behavior After Correction:**
  - `getGroupMetrics()` calculates cohort and trainee metrics directly from `this.courseAttempts` and `this.getAttemptProgress()` (or `this.userProgress` when unseeded) for both cycle-based and legacy cycleless groups, even when the group is expired under `postDeadlinePolicy: 'hide'`.
  - Learner authorization in `getCourseProgress()` and `resolveActiveAttemptForLearning()` remains strictly enforced without any administrative bypass flag.
- **Dependencies:** Independent of learner attempt resolution; ensures `getGroupMetrics()` is unaffected by stricter learner authorization in `resolveActiveAttemptForLearning()`.

---

## 6. Standalone Fallback Rules

The table below defines the exact decision matrix for `canUseLegacyStandaloneFallback(enrollment)` and the standalone attempt loop in `getEligibleAttemptsForCourse()` (`Lines 1327–1385`) and Branch 4 of `resolveActiveAttemptForLearning()` (`Lines 1552–1556`):

| Case | `EnrollmentRecord` State in `this.enrollments` | `canUseLegacyStandaloneFallback` | Behavior in `getEligibleAttemptsForCourse()` (`Line 1327`) | Behavior in `resolveActiveAttemptForLearning()` (`Line 1552`) | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Case 1: No Enrollment Record** | `enrollment === undefined` | **`true`** | Inspects `this.courseAttempts` for standalone attempts (or group attempts where the user is currently in `group.traineeIds`). Skips group attempts if the user is not a member of `attempt.groupId`. | Allows `getOrCreateCurrentAttempt({ userId, courseId })` for standalone preview / unseeded legacy unit tests; rejects via `assertLearnerAttemptEntitlement` if an explicit `attempt.groupId` belongs to a group the user is not a member of. | Preserves lecturer/admin course preview (`markLessonComplete` `Line 2061`) and unseeded progress unit tests without exposing group attempts to non-members. |
| **Case 2: Active Legacy Enrollment with Empty `sources`** | `enrollment.status === 'active'` and `enrollment.sources.length === 0` | **`true`** | Inspects `this.courseAttempts` for standalone attempts (and group attempts where the user is in `group.traineeIds`). | Allows `getOrCreateCurrentAttempt({ userId, courseId })` to resolve/provision the default standalone attempt. | Preserves backward compatibility with legacy fixtures that seeded `status: 'active'` and `sources: []`. |
| **Case 3: Inactive Enrollment with Empty `sources`** | `enrollment.status === 'inactive'` and `enrollment.sources.length === 0` | **`false`** | Skips fallback (`returns []`). | Throws `MockStoreError(..., 403, 'COURSE_ACCESS_REVOKED')`. Does **not** call `getOrCreateCurrentAttempt()`. | Prevents resurrecting a deactivated enrollment via the standalone fallback. |
| **Case 4: Enrollment with Explicit Grants (`sources.length > 0`) and Zero Eligible Active Grants** | `enrollment.sources.length > 0` (e.g., all grants are `'revoked_by_group_removal'` or `'expired'`, or expired under `'hide'`, with `enrollment.status` `'revoked_by_group_removal'`, `'inactive'`, or `'active'`) | **`false`** | Skips fallback (`returns []`). Never inspects `this.courseAttempts` to resurrect preserved attempts. | Throws `MockStoreError(..., 403, 'COURSE_ACCESS_REVOKED')`. Never creates or exposes a replacement standalone attempt. | Enforces `D-07`: revoked group courses lose learner access while preserving historical attempt records in `this.courseAttempts` for administrative use only. |

---

## 7. Scenario Matrix

| # | Scenario | Grant & Enrollment State | Expected Eligible Attempt(s) (`getEligibleAttemptsForCourse`) | Expected `accessMode` | Learner View (`getCourseProgress`) | Learner Continue (`recordLessonActivity` / `markLessonComplete`) | Administrative History Access (`getTraineeAttempts`, `getGroupAttempts`, `getAttemptProgress`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Group active + `D-07` removal with course retained (`removeCourseIds: []`)** | `[0]` `group` (`revoked_by_group_removal`, `attemptId: A1`)<br/>`[1]` `self:continued` (`active`, `attemptId: A1`)<br/>`enrollment.status: 'active'` | **1 option:** `attemptId: A1`, `kind: 'self'`, `sourceId: 'self:continued:${groupId}:${A1}'`, `convertedFromGroupId: groupId`, `contextLabel: 'تسجيل مستمر من مجموعة: ...'` | `'full'` | **Allowed** (both implicit and explicit `{ attemptId: A1 }` resolve `A1`). | **Allowed** (mutations update `A1` progress). | **Preserved** (`A1` and its progress remain in store ledgers). |
| **2** | **Group expired with `keep_no_cert` + course retained (`D-07`, `removeCourseIds: []`)** | `[0]` `group` (`revoked_by_group_removal`, `attemptId: A1`)<br/>`[1]` `self:continued` (`active`, `attemptId: A1`)<br/>`enrollment.status: 'active'` | **1 option:** `attemptId: A1`, `kind: 'self'`, `convertedFromGroupId: groupId`. `[0]` is skipped; `[1]` bypasses former group's `keep_no_cert` restriction (`D-07`). | `'full'` | **Allowed** (returns `CourseProgress` with `accessMode: 'full'`). | **Allowed** (`D-07` lifts former group deadline restrictions for retained self-continuation). | **Preserved**. |
| **3** | **Group expired with `hide` + course retained (`D-07`, `removeCourseIds: []`)** | `[0]` `group` (`revoked_by_group_removal`, `attemptId: A1`)<br/>`[1]` `self:continued` (`active`, `attemptId: A1`)<br/>`enrollment.status: 'active'` | **1 option:** `attemptId: A1`, `kind: 'self'`, `convertedFromGroupId: groupId`. `[0]` is skipped; `[1]` is not hidden by the former group's `hide` policy. | `'full'` | **Allowed** (returns `CourseProgress` with `accessMode: 'full'`). | **Allowed** (mutations update `A1` progress). | **Preserved**. |
| **4** | **Explicit `attemptId` (or `groupId + cycleId`) supplied to progress & learning mutations on retained course (`D-07`)** | `[0]` `group` (`revoked_by_group_removal`, `attemptId: A1`)<br/>`[1]` `self:continued` (`active`, `attemptId: A1`) | **1 option:** `attemptId: A1`, `kind: 'self'`, `cycleId: attempt.cycleId`, `accessMode: 'full'`. | `'full'` | **Allowed:** `resolveActiveAttemptForLearning` with `{ attemptId: A1 }` or `{ groupId, cycleId }` resolves `A1` (`opt.cycleId` preserves `attempt.cycleId`). | **Allowed:** `recordLessonActivity` and `markLessonComplete` succeed with explicit `attemptId: A1` or `{ groupId, cycleId }`. | **Preserved**. |
| **5** | **Revoked Group Grant with NO active alternate grant (`removeCourseIds: [courseId]`)** | `[0]` `group` (`revoked_by_group_removal`, `attemptId: A1`)<br/>`enrollment.status: 'revoked_by_group_removal'`<br/>(`A1` preserved in `this.courseAttempts`) | **0 options (`[]`):** `[0]` is skipped; `canUseLegacyStandaloneFallback` is `false`, so `A1` is not resurrected. | **None (Access Denied — `403 COURSE_ACCESS_REVOKED`)** | **Rejected (`403 COURSE_ACCESS_REVOKED`):**<br/>- Implicit call rejects without creating or exposing a replacement attempt.<br/>- Explicit `{ attemptId: A1 }` and `{ groupId }` calls reject via `assertLearnerAttemptEntitlement`. | **Rejected (`403 COURSE_ACCESS_REVOKED`):** Both implicit and explicit `{ attemptId: A1 }` calls reject before any state mutation. | **Preserved & Accessible:** `getTraineeAttempts()`, `getGroupAttempts()`, `getCycleAttempts()`, `getCourseAttemptStatsForTrainee()`, and `getAttemptProgress(A1)` return `A1` and its preserved progress. |
| **6** | **Independent self-enrollment (`A_self`) or another group's active grant (`A_groupB`) on the same course alongside a revoked Group A grant (`A_groupA`)** | `[0]` Group A (`revoked_by_group_removal`, `A_groupA`)<br/>`[1]` Self (`active`, `A_self`) or Group B (`active`, `A_groupB`)<br/>`enrollment.status: 'active'` | Returns only the active option(s) (`A_self` and/or `A_groupB`); `A_groupA` is excluded. | `'full'` for `A_self` (or per Group B's deadline settings for `A_groupB`); **`403 COURSE_ACCESS_REVOKED`** if `A_groupA` is requested explicitly. | **Allowed** for `A_self` / `A_groupB` (implicit resolution selects single active attempt, or returns `requiresAttemptSelection: true` if multiple active attempts exist); **Rejected (`403 COURSE_ACCESS_REVOKED`)** if called with `{ attemptId: A_groupA }`. | **Allowed** for `A_self` / `A_groupB`; **Rejected (`403 COURSE_ACCESS_REVOKED`)** if called with `{ attemptId: A_groupA }`. | Both `A_groupA` (historical) and `A_self` / `A_groupB` (active) remain accessible to administrative history queries. |
| **7** | **Multiple grants referencing the SAME `attemptId` (`A1`)** | **7A:** `[0]` `group` (`revoked_by_group_removal`, `A1`) + `[1]` `self:continued` (`active`, `A1`)<br/>**7B:** `[0]` `group` (`active`, `A1`) + `[1]` `self:continued` (`active`, `A1`) | **1 deduplicated option for `A1`:** `kind: 'self'`, `convertedFromGroupId: groupId`, `accessMode: 'full'`. In `7A`, `[0]` is skipped; in `7B`, `prefersSelfContinuation` replaces `[0]` with `[1]`. | `'full'` | **Allowed** (resolves `A1` with `accessMode: 'full'`). | **Allowed** (mutations update `A1` progress). | **Preserved**. |

---

## 8. Implementation Sequence

When authorized for implementation, the changes must be applied in [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) in the following dependency-ordered sequence:

1. **Step 1 — Add `canUseLegacyStandaloneFallback(enrollment)` helper:**
   - Define the private helper above `getEligibleAttemptsForCourse()` (`Line 1203`) so both eligibility calculation and attempt resolution share a single authoritative rule for when empty-source standalone fallback is permitted.
2. **Step 2 — Update `getEligibleAttemptsForCourse()` (`Lines 1220–1360`):**
   - Replace the `hasActiveAlternate` block (`Lines 1222–1230`) with `if (grant.status !== 'active') { continue; }`.
   - Remove the invalid `Boolean(grant.groupId && this.groups.find((g) => g.id === grant.groupId && !g.members.some(...)))` clause from `isContinuation` (`Line 1277`).
   - Preserve attempt cycle context on `EligibleAttemptOption` (`Line 1302`) via `cycleId: grant.cycleId || attempt.cycleId || null` so `D-07` continuation grants (which have `grant.cycleId === undefined`) retain their bound attempt's `cycleId`.
   - Update `optionsMap` deduplication (`Lines 1315–1322`) to include `prefersSelfContinuation` (`existing.kind === 'group' && option.kind === 'self' && accessMode === 'full'`).
   - Guard the standalone fallback at `Line 1327` with `this.canUseLegacyStandaloneFallback(enrollment)` and require current group membership (`group.traineeIds`) when a fallback attempt has `attempt.groupId`.
3. **Step 3 — Add `assertLearnerAttemptEntitlement(userId, courseId, attempt)` helper:**
   - Define the private entitlement validator above `getEligibleAttemptsForCourse()` using the updated `getEligibleAttemptsForCourse()` and `canUseLegacyStandaloneFallback()` methods.
4. **Step 4 — Update `resolveActiveAttemptForLearning()` (`Lines 1461–1557`):**
   - Call `this.assertLearnerAttemptEntitlement(params.userId, params.courseId, explicitAttempt)` in Branch 1 (`params.attemptId`).
   - Validate group/continuation eligibility (matching `opt.groupId` or `opt.convertedFromGroupId`, plus preserved `opt.cycleId`) and call `this.assertLearnerAttemptEntitlement(...)` in Branch 2 (`params.groupId`).
   - Guard Branch 4 (`Lines 1552–1556`) with `this.canUseLegacyStandaloneFallback(enrollment)` so that when `eligibleAttempts.length === 0` on a revoked, inactive, or source-tracked enrollment, it throws `MockStoreError(..., 403, 'COURSE_ACCESS_REVOKED')` instead of provisioning a replacement standalone attempt.
5. **Step 5 — Decouple `getGroupMetrics()` (`Lines 2409–2450`) from learner-facing `getCourseProgress()`:**
   - Update `getGroupMetrics()` so that both cycle-based and legacy cycleless groups (`targetCycle === null`) look up `groupAttempt` in `this.courseAttempts` and read `this.getAttemptProgress(groupAttempt.id)` directly (with read-only fallback to `this.userProgress` if unseeded), without invoking learner-facing `getCourseProgress()`.
6. **Step 6 — Author Regression Tests (Without Executing Under `Gate B` Unless Authorized):**
   - Add the regression test cases specified in Section 9 to the store test suite.

---

## 9. Regression-Test Plan & Authored Inventory (`WRITTEN — NOT EXECUTED`)

The following regression test cases have been authored in [`frontend/src/test/group-member-removal-domain.test.ts` (`Suite 6`, `Lines 453–1133`)](../../../frontend/src/test/group-member-removal-domain.test.ts#L453-L1133) under `Gate B` verification deferral (`WRITTEN — NOT EXECUTED`):

| Test ID | Target Scenario | Setup | Expected Assertions | Execution Status |
| :--- | :--- | :--- | :--- | :--- |
| **`RT-D07-01`** | **Scenario 1 & Scenario 4:** Active group + `D-07` retained course (`removeCourseIds: []`) with implicit, explicit `attemptId`, and explicit `groupId + cycleId` | Add trainee (`USR006`) to active Group A (`CRS002`, `originalCycleId`), record lesson completion on `boundAttemptId`, then call `removeGroupMember(groupAId, cleanTraineeId, [])`. | 1. `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` returns `[ { attemptId: boundAttemptId, kind: 'self', convertedFromGroupId: groupAId, cycleId: originalCycleId, accessMode: 'full' } ]`.<br/>2. `getAttemptAccessMode()` returns `'full'`, and `resolveActiveAttemptForLearning()` resolves `boundAttemptId` implicitly, with `{ groupId: groupAId }`, and with `{ groupId: groupAId, cycleId: originalCycleId }`.<br/>3. `getCourseProgress()`, `recordLessonActivity()`, and `markLessonComplete()` succeed on `boundAttemptId`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-02`** | **Scenario 2:** Expired group (`keep_no_cert`) + `D-07` retained course (`removeCourseIds: []`) | Retain course on `removeGroupMember(groupAId, cleanTraineeId, [])`, then expire Group A's deadline with `postDeadlinePolicy: 'keep_no_cert'`. | 1. `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` returns 1 option (`attemptId: boundAttemptId`, `kind: 'self'`, `accessMode: 'full'`).<br/>2. `getAttemptAccessMode(cleanTraineeId, courseAId, boundAttemptId)` returns `'full'` (not `'review_only'`).<br/>3. `recordLessonActivity()` and `markLessonComplete()` succeed on `boundAttemptId`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-03`** | **Scenario 3:** Expired group (`hide`) + `D-07` retained course (`removeCourseIds: []`) | Retain course on `removeGroupMember(groupAId, cleanTraineeId, [])`, then expire Group A's deadline with `postDeadlinePolicy: 'hide'`. | 1. `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` returns 1 option (`attemptId: boundAttemptId`, `accessMode: 'full'`).<br/>2. `getCourseProgress()` and `recordLessonActivity()` succeed on `boundAttemptId`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-04`** | **Scenario 5:** Revoked Group Grant with NO active alternate grant (`removeCourseIds: [courseAId]`) | Enroll trainee in Group A (`CRS002`), record partial progress on `boundAttemptId`, then call `removeGroupMember(groupAId, cleanTraineeId, [courseAId])`. | 1. `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` returns `[]`.<br/>2. `resolveActiveAttemptForLearning()` (implicit, `{ attemptId: boundAttemptId }`, and `{ groupId: groupAId }`) throws `403 COURSE_ACCESS_REVOKED` and creates no replacement standalone attempt.<br/>3. `getCourseProgress()`, `recordLessonActivity()`, and `markLessonComplete()` throw `403 COURSE_ACCESS_REVOKED`.<br/>4. `getTraineeAttempts()` and `getAttemptProgress(boundAttemptId)` preserve the historical attempt and progress. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-05`** | **Scenario 6A:** Revoked Group A course when independent catalog self-enrollment (`S1`) exists | Trainee self-enrolls (`selfAttemptId`), joins Group A (`groupAttemptId`), then is removed from Group A with `removeCourseIds: [courseAId]`. | 1. `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` returns only `[ { attemptId: selfAttemptId, ... } ]`.<br/>2. Implicit `resolveActiveAttemptForLearning()` resolves to `selfAttemptId`.<br/>3. Explicit `{ attemptId: groupAttemptId }` or `{ groupId: groupAId }` throws `403 COURSE_ACCESS_REVOKED`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-06`** | **Scenario 6B:** Revoked Group A course when Group B active grant exists | Trainee joins Group A (`attemptAId`) and Group B (`attemptBId`), then is removed from Group A with `removeCourseIds: [courseAId]`. | 1. `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` returns only `[ { attemptId: attemptBId, ... } ]`.<br/>2. Implicit `resolveActiveAttemptForLearning()` resolves to `attemptBId`.<br/>3. Explicit `{ attemptId: attemptAId }` or `{ groupId: groupAId }` throws `403 COURSE_ACCESS_REVOKED`. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-07`** | **Administrative Metrics Independence:** Legacy cycleless group expired under `postDeadlinePolicy: 'hide'` | Enroll trainee in Group A, complete 1 lesson on `groupAttemptId`, then expire Group A with `postDeadlinePolicy: 'hide'` and set `grp.currentCycleId = undefined` (`selectedCycle === null`). | 1. Learner calls to `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` return `[]`, and learner calls to `getCourseProgress(cleanTraineeId, courseAId)` (implicit, `{ attemptId: groupAttemptId }`, and `{ groupId: groupAId }`) throw `403 COURSE_ACCESS_REVOKED`.<br/>2. Administrative `getGroupMetrics(groupAId)` succeeds for the legacy cycleless group (`selectedCycle === null`) and reports `completedLessons === 1`, `started === true`, and `percent > 0` via direct historical-attempt lookup (plus cycle-scoped verification via `getGroupMetrics(groupAId, originalCycleId)`). | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-08`** | **Multi-Grant Coexistence & Explicit Attempt Selection:** Retained course (`removeCourseIds: []`) alongside independent catalog self-enrollment (`S1`) | Trainee holds catalog self-enrollment (`selfAttemptId`) and Group A enrollment (`attemptAId`), then is removed from Group A with `removeCourseIds: []` (retaining `attemptAId` as continuation). | 1. `getEligibleAttemptsForCourse(cleanTraineeId, courseAId)` returns both active options (`attemptAId` and `selfAttemptId`) without throwing `TypeError`.<br/>2. `getCourseProgress(cleanTraineeId, courseAId)` without explicit `attemptId` returns `requiresAttemptSelection: true` with both `eligibleAttempts`.<br/>3. Supplying explicit `attemptId` resolves and isolates progress per attempt. | `WRITTEN — NOT EXECUTED` |
| **`RT-D07-09`** | **Scenario 7B — Same-Attempt Deduplication:** Active Group Grant and active continuation grant referencing the same `attemptId` | Seed an enrollment where both an active `kind: 'group'` grant (`sources[0]`) and an active `kind: 'self'` continuation grant (`sources[1]`) reference `sharedAttemptId`, under both active and expired (`keep_no_cert`) group schedules. | 1. Both active grants are processed by `getEligibleAttemptsForCourse()`.<br/>2. `getEligibleAttemptsForCourse()` returns 1 deduplicated option for `sharedAttemptId`.<br/>3. The resulting option prefers the unrestricted `kind: 'self'` continuation (`sourceId: self:continued:...`, `convertedFromGroupId: groupAId`, `cycleId: originalCycleId`, `accessMode: 'full'`). | `WRITTEN — NOT EXECUTED` |

---

## 10. Acceptance Criteria

The remediation will be ready for acceptance only when all of the following observable criteria are satisfied:

1. **No `g.members` Access:** [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) contains zero references to `g.members`.
2. **Unconditional Skipping of Non-Active Grants:** `getEligibleAttemptsForCourse()` skips any grant in `enrollment.sources` whose `status !== 'active'`.
3. **Authoritative `D-07` Continuation Option & Cycle Context Preservation:** When a trainee is removed from a group with a course retained (`removeCourseIds: []`), `getEligibleAttemptsForCourse()` returns the retained `attemptId` with `kind: 'self'`, `convertedFromGroupId: group.id`, `cycleId: grant.cycleId || attempt.cycleId || null`, and `accessMode: 'full'` across active, expired-`keep_no_cert`, and expired-`hide` groups, and `resolveActiveAttemptForLearning()` resolves the retained attempt via implicit, explicit `attemptId`, and explicit `groupId + cycleId` parameters.
4. **Complete Revocation Denial Across Learner APIs:** When a trainee is removed from a group with a course checked (`removeCourseIds: [courseId]`) and holds no other active grant for that course:
   - `getEligibleAttemptsForCourse()` returns `[]`.
   - `resolveActiveAttemptForLearning()`, `getCourseProgress()`, `recordLessonActivity()`, and `markLessonComplete()` reject with `403 COURSE_ACCESS_REVOKED` whether called implicitly (without `attemptId`), with `{ attemptId: revokedAttemptId }`, or with `{ groupId }`.
   - No replacement standalone `CourseAttempt` is created in `this.courseAttempts`.
5. **Valid `review_only` Behavior Preserved:** Current group members whose group/cycle deadline has expired under `keep_no_cert` (or whose cycle is completed/archived) retain read-only learner access (`getCourseProgress()` returns `accessMode: 'review_only'`, while `recordLessonActivity()` and `markLessonComplete()` throw `403 COURSE_ACCESS_REVIEW_ONLY`).
6. **Administrative History & Metrics Independence Preserved:** `getTraineeAttempts()`, `getCourseAttemptStatsForTrainee()`, `getCycleAttempts()`, `getGroupAttempts()`, `getAttemptProgress()`, and `getGroupMetrics()` (including legacy cycleless groups expired under `postDeadlinePolicy: 'hide'`) calculate and return historical attempt data directly without relying on learner-facing `getCourseProgress()`.
7. **Inactive Enrollment Protection:** An `EnrollmentRecord` with `status: 'inactive'` and `sources: []` cannot be resurrected via the standalone fallback in `getEligibleAttemptsForCourse()` or `resolveActiveAttemptForLearning()`.

---

## 11. Verification & Governance

1. **`Gate B` Restrictions Preserved:**
   - Per [`docs/project-state/verification-and-test-strategy.md`](../verification-and-test-strategy.md), all runtime test execution (`vitest`), production builds (`vite build`), TypeScript compiler checks (`tsc --noEmit`), and linter runs (`eslint`) remain deferred until Phase 4 (`Gate B`) or explicit Owner authorization.
2. **Static Analysis vs. Executed Verification:**
   - All findings and proposed changes in this document represent **static source-code analysis**.
   - Even after the Owner authorizes code implementation, the resulting code and tests must be tracked as `IMPLEMENTED — VERIFICATION PENDING` until runtime verification is executed and accepted.
3. **Separate Acceptance Decision Required:**
   - This proposal does **not** alter the status of `WP-2.2`, `CP-006`, [`docs/project-state/CURRENT.md`](../CURRENT.md), or [`docs/project-state/active-roadmap.md`](../active-roadmap.md). A separate Owner decision is required to authorize implementation and any subsequent project-state or checkpoint updates.

---

## 12. Out of Scope / Remaining Risks

To keep this remediation minimal and strictly scoped to the `D-07` retained-course continuation and revoked-attempt authorization flow, the following unrelated audit observations are intentionally excluded from this proposal and recorded for separate consideration:

1. **Renewal-Cycle Lookup via `group.cycles` vs. `this.renewalCycles` (`Lines 1251`, `1345`, `1421`):**
   - In `getEligibleAttemptsForCourse()` (`Lines 1251` and `1345`) and `getAttemptAccessMode()` (`Line 1421`), cycle lookup uses optional chaining on `group?.cycles?.find(...)`, whereas renewal cycles in `inMemoryStore` are stored in `this.renewalCycles` (queried via `this.getGroupCycles(group.id)` / `this.getGroupCycleById(cycleId)`). Because `group?.cycles` uses optional chaining, it evaluates to `undefined` rather than throwing, and `getEffectiveCourseSettings()` falls back to group-level settings when `cycle` is `null`.
2. **Historical Cycle Grants Left with `status: 'active'` During `createRenewalCycle()` (`Lines 6250–6338`):**
   - When `createRenewalCycle()` seals a previous cycle (`activeCycle.status = 'completed'`) and marks unfinished attempts as `expired_incomplete` (`Lines 6257–6261`), the previous cycle's `EnrollmentSourceGrant` entries in `enrollment.sources` retain `status: 'active'` while new grants are added for the new cycle. Handling multi-cycle grant lifecycle transitions is outside the scope of this `D-07` group-member removal remediation.

