# MetroLMS — Phase C Implementation Report
## Group Domain Reconciliation & Contract Normalization

> **Document Status:** `ACTIVE — SUPPORTING (IMPLEMENTATION REPORT)`  
> **Milestone:** Phase C — Domain Reconciliation & Contract Normalization  
> **Authority:** Governed by Level 1 Owner Decisions `D-GRP-01` through `D-GRP-08` in [`docs/architecture/decision-register.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/decision-register.md) and [`docs/requirements/reminder-programs-and-group-domain-specification.md`](file:///d:/LMS%20MEtro%20Project/docs/requirements/reminder-programs-and-group-domain-specification.md).  
> **Date:** 2026-11-11  
> **Verification Status:** `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`

---

### 1. Executive Summary

Phase C implements the complete backend/domain contract normalization for **Training Groups & Reminder Programs (`المجموعات التدريبية والبرامج التذكيرية`)** under approved Owner Decisions `D-GRP-01` through `D-GRP-08`.

All implementations are completed with strict adherence to repository governance:
- Zero modifications to Phase D UI presentation components (Trainee Groups Dashboard UI remains reserved for Phase D).
- Backward compatibility preserved for legacy Increment 7 views.
- Zero Vitest or project execution scripts run.
- All 18 uncommitted Phase 5 working-tree files preserved intact.
- Checkpoint `CP-008` remains strictly reserved/frozen.

---

### 2. Source Files Modified & Created

| File Path | Action | Description & Purpose |
| :--- | :--- | :--- |
| [`frontend/src/core/groups/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/groups/types.ts) | `MODIFIED` | Added `GroupType = 'regular' \| 'reminder'`, extended `GroupCourseAssignment` with `courseRole?: CourseRole`, and added monotonic historical marker `hasHistoricalReminderCourses?: boolean` to `TrainingGroup`. |
| [`frontend/src/core/groups/dtos.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/groups/dtos.ts) | `MODIFIED` | Added `courseRole` to `AssignCoursesRequestDTO`, normalized `GroupTimeInfo` (semantic data, zero UI strings, nullable dates), and introduced normalized `TraineeGroupItemDTO` (with `traineeCount`, compact course summaries; strictly excludes any `metrics` or other-trainee data). |
| [`frontend/src/core/groups/resolvers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/groups/resolvers.ts) | `CREATED` | Authored centralized pure domain resolvers: `resolveGroupType`, `resolveGroupOperationalStatus`, and `calculateGroupTimeInfo`. |
| [`frontend/src/core/groups/index.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/groups/index.ts) | `CREATED` | Centralized barrel re-exporting `types`, `dtos`, and `resolvers`. |
| [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) | `MODIFIED` | Overhauled renewal lifecycle: unified automatic and manual renewal to in-place cycles (`D-GRP-01`/`D-GRP-04`), abolished `successorGroup` cloning, preserved `courseRole` across creation/assignment/renewal, latched monotonic `hasHistoricalReminderCourses` (`D-GRP-06`), and excluded `adminStatus === 'archived'` from trainee `getGroups` and `getGroupById` (`D-GRP-07`). |
| [`frontend/src/features/groups/services/groupsApi.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/groups/services/groupsApi.ts) | `MODIFIED` | Updated `getMyGroups` signature to return `Promise<TraineeGroupItemDTO[]>`. |
| [`frontend/src/mocks/handlers/groupHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/groupHandlers.ts) | `MODIFIED` | Updated `GET /api/groups/my` to map and return normalized `TraineeGroupItemDTO[]` using centralized resolvers; strictly omits `metrics` and `traineeMetricsList` to enforce data minimization. |
| [`frontend/src/pages/TraineeGroupsPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/TraineeGroupsPage.tsx) | `MODIFIED` | Transitioned legacy page to consume normalized `TraineeGroupItemDTO`, deriving status from `operationalStatus` and deadlines from `timeInfo`; excised dependency on `traineeMetricsList` to protect trainee data privacy. |
| [`frontend/src/test/group-domain-reconciliation.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/group-domain-reconciliation.test.ts) | `CREATED` | Authored 35 regression specifications across Suites A, B, C, D, and E (deferred to Gate B). |

---

### 3. Core Domain Invariants Implemented

#### 3.1 Course Role Preservation Across All Paths
* **Type Level:** `GroupCourseAssignment` now carries `courseRole?: CourseRole` (`'core' | 'reminder'`), defaulting to `'core'` for legacy records.
* **Mutation Paths:**
  1. `createGroup`: Maps `courseRole: ca.courseRole || 'core'` directly into `group.courses` and `cycle1.courses`.
  2. `assignCoursesToCycle`: Updates `group.courses` preserving `courseRole: c.courseRole`.
  3. `createRenewalCycle`: Updates `group.courses` carrying forward `courseRole: c.courseRole`.
  4. `checkAndProcessAutoRenewal`: Carries forward `courseRole` across all renewed cycles.
  No code path drops or discards `courseRole`.

#### 3.2 Persistent Reminder Classification (`D-GRP-06`)
* **Monotonic Historical Marker:** `TrainingGroup.hasHistoricalReminderCourses` is set to `true` whenever any reminder course is assigned.
* **Irrevocability:** Once set to `true`, the marker is never reset to `false` when courses are removed or replaced.
* **`resolveGroupType` Contract:**
  1. If `group.hasHistoricalReminderCourses === true` -> `'reminder'`.
  2. If active/selected cycle has $\ge 1$ reminder course -> `'reminder'`.
  3. If group baseline courses have $\ge 1$ reminder course -> `'reminder'`.
  4. If any cycle in `group.cycles` has $\ge 1$ reminder course -> `'reminder'`.
  5. Otherwise -> `'regular'`.
* **Cycle Independence:** A reminder group whose current cycle contains only core courses remains classified as a reminder group because of its history.

#### 3.3 Unification of Manual and Automatic Renewal (`D-GRP-01`, `D-GRP-04`)
* **Abolition of Successor Group Cloning:** `checkAndProcessAutoRenewal` no longer creates a separate successor group, renames the current group to an archived name, or pushes duplicate groups into the store.
* **In-Place Lifecycle Semantics:**
  1. Identifies the due cycle.
  2. Seals the active cycle (`status = 'completed'`, `completedAt = nowIso`, sets `isSealed = true` on prior attempts).
  3. Creates a new sequential cycle on the **same group**: `CYC-${group.id}-${padStart(nextNum, 2)}`.
  4. Carries forward courses and course roles.
  5. Updates `group.currentCycleId = newCycle.id`.
  6. Provisions fresh unstarted attempts (`progressPercent = 0`, `isSealed = false`) and group grants for all active `group.traineeIds`.
  7. Advances `nextScheduledRenewalDate = calculateNextRenewalDate(newCycle.deadlineDateTime, intervalDays)`.
  8. Enforces idempotency via `group.renewalSchedule.lastAutoRenewedCycleId`.

#### 3.4 Operational Status & Structured Time Information
* **Operational Status Resolver (`resolveGroupOperationalStatus`):**
  - Evaluates active cycle dates first (`cycle.startDateTime`, `cycle.deadlineDateTime`), falling back to group dates.
  - Distinguishes `'scheduled'`, `'active'`, and `'expired'`.
  - An expired reminder group whose cycle deadline has passed is `'expired'`, even if a future renewal date is configured.
* **Structured Time Info (`calculateGroupTimeInfo`):**
  - Semantic situations: `'active_regular'`, `'scheduled_regular'`, `'active_reminder'`, `'scheduled_reminder'`, `'expired_reminder_with_next'`, `'expired_reminder_without_next'`, `'expired_regular'`.
  - Explicit nullable dates: unavailable dates resolve to `null`, never fabricated.
  - Zero localized text strings in API response DTO.

#### 3.5 Administrative Archive Exclusion (`D-GRP-07`)
* **Listing Boundary:** `inMemoryStore.getGroups(userId, 'user')` filters out `g.adminStatus === 'archived'`. Archived groups never appear in trainee listings or summary counts.
* **Direct Route Boundary:** `inMemoryStore.getGroupById(groupId, userId, 'user')` throws `MockStoreError('المجموعة التدريبية المطلوبة غير موجودة', 404)` for archived groups, failing closed without disclosing metadata.
* **Historical Access:** Historical certificates earned in archived groups remain accessible through `/my-certificates`.

#### 3.6 Trainee Count Semantics
* Authoritative source: $\text{traineeCount} = \text{group.traineeIds.length}$.
* Instructors, assistant lecturers, and supervisors are excluded from `group.traineeIds`.
* Trainees removed via `removeGroupMember` are pruned immediately from `group.traineeIds`.
* Trainees holding independent `D-07` continuation grants access via `/my-courses` and do not inflate group counts.

#### 3.7 Trainee Data Minimization & Privacy Boundary
* **Exclusion of Cohort Monitoring Data:** The trainee-facing `GET /api/groups/my` response strictly omits `metrics` and `traineeMetricsList`. Trainees are never exposed to other trainees' identities, employee numbers, progress percentages, or completion records.
* **Excised Compatibility Bridge:** The untyped `metrics?: any` property has been permanently removed from `TraineeGroupItemDTO`.
* **Safe Transition Bridge for Legacy Views:** `TraineeGroupsPage.tsx` consumes clean semantic domain fields: `operationalStatus` for group status, `timeInfo` for deadline calculations, and `courses` for assigned courses. Legacy UI sections that previously reached into `grp.metrics?.traineeMetricsList` have been safely replaced with group-type metadata, preserving privacy without breaking compilation.
* **Preservation of Administrative Group Monitoring:** Administrative and supervisor endpoints (`/api/admin/groups`, `/api/groups/:groupId/monitoring`, `getGroupMetrics()`) continue to provide complete aggregate cohort metrics and trainee progress lists with existing role-based access controls intact.

---

### 4. Authoritative Reconciled Regression Test Specifications Inventory

Authored in [`frontend/src/test/group-domain-reconciliation.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/group-domain-reconciliation.test.ts) (**35 physical `it()` test specifications across 5 suites**, all marked `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`):

| Suite | Scope & Title | Physical `it()` Count | Covered Invariants & Scenario Descriptions |
| :--- | :--- | :---: | :--- |
| **Suite A** | **Course Role & Persistent Reminder Classification** | **8** | **A.1:** Classifies group with only core courses as `regular`.<br>**A.2:** Classifies group with all reminder courses as `reminder`.<br>**A.3:** Mixed-course group is immediately `reminder` (`D-GRP-03`).<br>**A.4:** Immediate classification upon group creation.<br>**A.5:** Persistent reminder classification survives removing last reminder course (`D-GRP-06`).<br>**A.6:** Historical cycles retain original `courseRole` immutably.<br>**A.7:** Legacy groups without `courseRole` default to `core` / `regular`.<br>**A.8:** Monotonic marker cannot be reset to `false` via update or renewal paths. |
| **Suite B** | **In-Place Renewal Identity & Lifecycle** | **6** | **B.1:** Manual renewal creates cycle in-place preserving ID, name, code (`D-GRP-01`).<br>**B.2:** Automatic renewal executes in-place on same group without `successorGroup` cloning (`D-GRP-01`, `D-GRP-04`).<br>**B.3:** Sealing prior cycle sets `isSealed=true` and protects historical attempts.<br>**B.4:** Fresh attempts start at 0% with unique cycle-scoped IDs.<br>**B.5:** Repeated scheduler executions are idempotent (no duplicate cycles).<br>**B.6:** Preserves `D-07` continuation grants and independent attempts. |
| **Suite C** | **Operational Status & Structured Time Information** | **8** | **C.1:** Resolves active regular group status and situation `active_regular`.<br>**C.2:** Resolves scheduled regular group status and situation `scheduled_regular`.<br>**C.3:** Resolves expired regular group status and situation `expired_regular`.<br>**C.4:** Resolves active reminder group situation `active_reminder`.<br>**C.5:** Resolves scheduled reminder group situation `scheduled_reminder`.<br>**C.6:** Resolves expired reminder group with future renewal as `expired_reminder_with_next`.<br>**C.7:** Resolves expired reminder group without renewal as `expired_reminder_without_next`.<br>**C.8:** Missing dates resolve to `null` without fabricating fake dates. |
| **Suite D** | **Administrative Archive Exclusion & Trainee Counts** | **6** | **D.1:** Administratively archived groups hidden from trainee `getGroups()` (`D-GRP-07`).<br>**D.2:** Direct trainee access to archived group fails closed with 404 (`D-GRP-07`).<br>**D.3:** Expired non-archived groups remain visible in trainee `getGroups()`.<br>**D.4:** Trainee count strictly derived from `group.traineeIds.length` (excludes removed members).<br>**D.5:** Staff users (instructors, assistants, supervisors) excluded from `traineeIds`.<br>**D.6:** `D-07` continuation grants do not inflate `group.traineeIds` count. |
| **Suite E** | **GET /api/groups/my Contract & Trainee Data Minimization** | **7** | **E.1:** Maps `TraineeGroupItemDTO` with correct `groupType`, `operationalStatus`, and `traineeCount`.<br>**E.2:** Compact course summary preserves `courseCode` and `courseRole` for carousel pills (`D-GRP-08`).<br>**E.3:** Semantic `GroupTimeInfo` contains zero localized text strings.<br>**E.4:** Trainee `GET /api/groups/my` response strictly contains no `traineeMetricsList` or other trainees' identifiers/progress.<br>**E.5:** Trainee payload excludes cohort monitoring metrics (`averageProgressPercent`, etc.) while preserving necessary group metadata.<br>**E.6:** Admin-authorized group monitoring endpoint retains full aggregate metrics and `traineeMetricsList`.<br>**E.7:** `TraineeGroupItemDTO` strictly omits any untyped `metrics` bridge property. |
| **Total** | **Authoritative Test Inventory** | **35** | **100% of physical specifications marked `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`** |

---

### 5. Future Backend Integration Responsibilities (Django + SQL Server)

- **Dedicated Schema Column:** In Microsoft SQL Server, `training_group` will maintain a column `has_historical_reminder_courses BIT NOT NULL DEFAULT 0` with an index for high-performance classification queries.
- **Transactional Row Locking:** In production, `check_due_group_renewals` will execute in Celery Beat using Django `select_for_update()` transaction locking inside `transaction.atomic()`, decoupled from browser runtimes.
- **Direct Route Permissions:** Django DRF view for `GET /api/groups/<id>/` will enforce object-level permissions returning HTTP 404 for trainees accessing archived groups.

