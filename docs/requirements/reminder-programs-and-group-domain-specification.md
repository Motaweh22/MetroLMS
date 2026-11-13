# MetroLMS — Reminder Programs & Group Domain Canonical Specification

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Scope:** Business rules, data-model contracts, renewal lifecycle state machines, date and remaining-time semantics, group classification resolvers, and target API response contracts for Training Groups and Reminder Programs (`المجموعات التدريبية والبرامج التذكيرية`).
> **Authority Level:** Level 4 (Domain-Specific Specification) governed by approved Owner Decisions `D-GRP-01`–`D-GRP-08` in [`docs/architecture/decision-register.md`](../architecture/decision-register.md).
> **Approved Date:** 2026-11-11 (Phase B Milestone Closure & Contract Freeze)

---

## 1. Approved Owner Decisions (Level 1 Authority)

| Decision ID | Domain Area | Binding Behavioral Invariant |
| :--- | :--- | :--- |
| **`D-GRP-01`** | **In-Place Renewal Identity** | A recurring reminder program retains its immutable `TrainingGroup.id`, name, and enrollment code across renewals. Both manual (`createRenewalCycle`) and automated renewal create a new `GroupRenewalCycle` in-place, closing and sealing the prior cycle. Automated cloning of successor groups (`successorGroup`) is permanently abolished. |
| **`D-GRP-02`** | **Day-Based Recurrence Measurement** | Recurrence intervals are strictly day-based (`intervalDays` / `renewalIntervalDays` e.g., 30, 60, 90, 180, 365 days). Calendar month/year conversions are prohibited. Day-based anchor (`cycle.deadlineDateTime` + `intervalDays`) and safe calculation methods are preserved. |
| **`D-GRP-03`** | **Immediate Mixed-Course Group Classification** | A group containing $\ge 1$ assigned course with `courseRole === 'reminder'` is immediately classified as a reminder group (`groupType: 'reminder'`). Groups containing only `courseRole === 'core'` are classified as regular (`groupType: 'regular'`). Classification is derived centrally via `resolveGroupType` upon course selection without waiting for renewal execution. |
| **`D-GRP-04`** | **Authoritative GroupRenewalCycle In-Place Progression** | Every renewal appends a new `GroupRenewalCycle` (`CYC-<groupId>-<NN>`) linked to the same `TrainingGroup`. Historical cycles transition to `status: 'completed'`; historical attempts, certificates, attendance logs, and progress records remain sealed and immutable. |
| **`D-GRP-05`** | **Dual Badge Presentation Contract** | Trainee-facing presentation displays a prominent group-level badge `برنامج تذكيري` on reminder groups, alongside a dedicated course-level badge `مقرر تذكيري` beside reminder-designated courses. Core courses in mixed groups remain clearly identified as core courses (`دورة أساسية`). |
| **`D-GRP-06`** | **Persistent Reminder Classification** | A group remains classified as `reminder` after the removal of its last currently assigned reminder-designated course, provided its group history contains a reminder-designated course assignment. Once established, reminder classification is monotonic and irrevocable across the group lifecycle. Historical renewal cycles retain immutable course roles, and `resolveGroupType` enforces historical continuity via a monotonic marker (`hasHistoricalReminderCourses: true`). |
| **`D-GRP-07`** | **Archived Groups Hidden from Trainee Groups Page** | Administratively archived groups (`adminStatus === 'archived'`) are completely excluded from the trainee Groups API response (`GET /api/groups/my`), the persistent carousel, the detailed groups table, and all summary counts (`إجمالي المجموعات`, `المجموعات النشطة`, `البرامج المجدولة`). No archived filter or tab is provided on this page. All historical attempts, records, and certificates remain preserved and accessible through `/my-certificates`. Direct URL navigation to `/my-groups/:id` for archived groups fails closed. |
| **`D-GRP-08`** | **Compact Course Presentation in Carousel** | The persistent carousel uses compact course representations (short codes/compact pills with visual role distinction between core and reminder) to maintain concise card heights. Full course titles and explicit dual badges (`دورة أساسية` / `مقرر تذكيري`) are preserved in the detailed groups table and group details page. Design follows official Metro Courses design tokens without emojis. |

---

## 2. Business Rules Specification

### 2.1 Group Classification (`resolveGroupType`) & Persistent Continuity (`D-GRP-06`)

#### A. Centralized Resolver Contract
Group classification is a **deterministic derived property**, never an unvalidated or manually desynchronized persisted string. Under Decision `D-GRP-06`, group classification enforces historical continuity:

```typescript
export type GroupType = 'regular' | 'reminder';

export function resolveGroupType(
  group: TrainingGroup,
  cycle?: GroupRenewalCycle | null
): GroupType {
  // 1. Monotonic historical marker (Decision D-GRP-06):
  // Once established, reminder classification is permanent across the group lifecycle
  if (group.hasHistoricalReminderCourses === true) {
    return 'reminder';
  }

  // 2. Inspect active/current cycle courses if available
  if (cycle && Array.isArray(cycle.courses) && cycle.courses.length > 0) {
    if (cycle.courses.some((c) => c.courseRole === 'reminder')) {
      return 'reminder';
    }
  }

  // 3. Inspect group-level current course assignments (reconciled baseline)
  if (Array.isArray(group.courses) && group.courses.length > 0) {
    if (group.courses.some((c) => (c as { courseRole?: CourseRole }).courseRole === 'reminder')) {
      return 'reminder';
    }
  }

  // 4. Inspect historical cycle course records
  if (Array.isArray(group.renewalCycles) && group.renewalCycles.length > 0) {
    for (const historicalCycle of group.renewalCycles) {
      if (Array.isArray(historicalCycle.courses) && historicalCycle.courses.some((c) => c.courseRole === 'reminder')) {
        return 'reminder';
      }
    }
  }

  // 5. Fallback: all courses are core or default and group has no reminder history
  return 'regular';
}
```

#### B. CourseRole Preservation on Creation and Assignment
- `GroupCourseAssignment` on `TrainingGroup.courses` is updated to include `courseRole?: CourseRole` (defaulting to `'core'`).
- During administrative group creation (`createGroup`) and course assignment (`assignCoursesToCycle`), `courseRole` is preserved at both the cycle level and group baseline level.
- **Immediate Effect (`D-GRP-03`):** Selecting a course with `courseRole: 'reminder'` immediately updates the derived `groupType` to `'reminder'` and latches `group.hasHistoricalReminderCourses = true`.

#### C. Removal of Reminder Courses & Persistent Reminder Classification (`D-GRP-06`)
- **Irrevocable Classification:** If an administrator removes the last reminder-designated course from an active group, the group's classification **does NOT revert to `'regular'`**. It remains `'reminder'` because its history contains a reminder assignment.
- **Monotonic Historical Marker:** Relying solely on sealed historical cycles is insufficient if a reminder course was assigned and then removed *before* a historical cycle snapshot was sealed (e.g. within Cycle 1). Therefore, `TrainingGroup` maintains a monotonic boolean marker `hasHistoricalReminderCourses?: boolean`. Once set to `true`, this marker is write-once and irrevocable.
- **Cycle Independence:** A reminder group may contain only core courses in its current cycle while still remaining a reminder program because of its history.
- **Historical Cycle Integrity:** Historical cycles sealed prior to any course changes preserve their original `GroupCycleCourseAssignment` records with immutable `courseRole` snapshots.
- **Backward Compatibility:** Existing legacy groups without `courseRole` or the historical marker default to `'regular'`. The classification is never inferred from `refresherConfig.enabled` alone without an actual reminder course assignment.

---

### 2.2 In-Place Renewal Lifecycle (`D-GRP-01`, `D-GRP-04`)

#### A. Unified State Machine (Manual & Automatic)
Manual administrative renewal and automated scheduler renewal follow the identical in-place execution contract:

```
[ Active Cycle N ] ──( Renewal Due: now >= nextScheduledRenewalDate )──►
                     │
                     ├─► 1. Seal Cycle N: status = 'completed', completedAt = now
                     ├─► 2. Seal Trainee Attempts in Cycle N: isSealed = true
                     ├─► 3. Create Cycle N+1: id = CYC-<groupId>-<N+1>, status = 'active'
                     ├─► 4. Carry Forward Courses & Roles (core / reminder preserved)
                     ├─► 5. Provision Fresh Unstarted Attempts for group.traineeIds (0%)
                     ├─► 6. Synchronize Enrollment Grants: sourceId = group:<groupId>:<cycleId>
                     ├─► 7. Advance nextScheduledRenewalDate = newCycle.deadline + intervalDays
                     └─► 8. Update group.currentCycleId = newCycle.id
```

#### B. Identity Invariants
- `group.id` remains identical (e.g. `GRP-101`).
- `group.enrollmentCode` remains identical.
- `group.name` and `group.description` are preserved.
- The trainee accesses the same persistent URL `/my-groups/GRP-101`.

#### C. Idempotency & Concurrency Safeguards
1. **`lastAutoRenewedCycleId` Guard:** The scheduler records `group.renewalSchedule.lastAutoRenewedCycleId = activeCycle.id` before committing a renewal. If the scheduler runs again, it verifies that `lastAutoRenewedCycleId !== currentCycleId`.
2. **Anchor Advance:** `nextScheduledRenewalDate` is calculated strictly from the **deadline date** of the new cycle:
   $$\text{nextScheduledRenewalDate} = \text{newCycle.deadlineDateTime} + (\text{intervalDays} \times 86,400,000\text{ ms})$$
3. **Overdue Safeguard:** If an overdue renewal executes significantly late, the new cycle's start date is set to `now.toISOString()` to ensure the new cycle's deadline is in the future and trainees receive their full intended training duration.

---

### 2.3 Future Scheduling vs. Operational Cycles

| Entity / Concept | State Representation | Purpose |
| :--- | :--- | :--- |
| **Future Renewal Date** | `group.renewalSchedule.nextScheduledRenewalDate` (scalar ISO date) | Signals when the next recurring cycle is scheduled to start. Does **not** instantiate a cycle entity in advance. |
| **Renewal Due** | `now >= new Date(nextScheduledRenewalDate)` | Trigger condition for the renewal execution engine. |
| **Active Cycle** | `GroupRenewalCycle { status: 'active', cycleNumber: N }` | The single currently live training cycle where trainees log progress. |
| **Completed Cycle** | `GroupRenewalCycle { status: 'completed', completedAt: ISO }` | Historical record of past training cycles with sealed attempts. |
| **Archived Cycle** | `GroupRenewalCycle { status: 'archived' }` | Administratively deprecated cycle. |

> **Architectural Guardrail:** Fake or "phantom" cycles with unstarted future dates must never be created in `renewalCycles[]`. The database remains clean; cycles are instantiated only when they become operational.

---

### 2.4 Orthogonal Dimensions: Group Type vs. Operational Status

The system strictly decouples **what the group is** (`groupType`) from **where it is in time** (`operationalStatus`):

```typescript
export type GroupType = 'regular' | 'reminder';
export type GroupStatus = 'active' | 'scheduled' | 'expired';
```

#### A. Administrative Archive Precedence & Exclusion (`D-GRP-07`)
1. **Complete Trainee View Exclusion:** Groups with `adminStatus === 'archived'` are strictly excluded from the trainee Groups API response (`GET /api/groups/my`), the persistent carousel, the detailed groups table, and all summary counts (`إجمالي المجموعات والبرامج`, `المجموعات النشطة`, `البرامج المجدولة`).
2. **No Archived Tab/Filter on Trainee Page:** Trainees are not provided with an optional archived-groups toggle or filter on this page.
3. **Preservation of History & Certificates:** Archiving a group does not delete or alter its historical cycles, attempts, progress records, or certificates. Historical certificates earned in archived groups remain fully accessible through the certificates experience (`/my-certificates`).
4. **Distinct from Deadline Expiration:** Administrative archiving is a deliberate administrative action. Expired but non-archived groups remain visible and accessible in accordance with existing post-deadline policies (`hide` or `keep_no_cert`).
5. **Direct Route Fail-Closed:** Direct navigation to `/my-groups/:id` for an archived group fails closed with an access-denied or not-found status, preventing unauthorized access paths.

#### B. Precedence & Resolution Rules (`resolveGroupOperationalStatus`)
For non-archived groups, operational status is resolved deterministically against the active cycle:
1. **Cycle Resolution:** Retrieve the active cycle (`group.currentCycleId`). If none exists, fall back to group baseline dates.
2. **Time Comparison:**
   - If $\text{now} < \text{startDateTime}$: status is `'scheduled'`.
   - If $\text{now} > \text{deadlineDateTime}$: status is `'expired'`.
   - If $\text{startDateTime} \le \text{now} \le \text{deadlineDateTime}$: status is `'active'`.
3. **Reminder Group Invariant:** A reminder group whose active cycle has passed its deadline is `'expired'`, **even if** `nextScheduledRenewalDate` is configured in the future. The future renewal date does not retroactively keep an expired cycle active.

---

### 2.5 Structured Remaining-Time Contract (`GroupTimeInfo`)

Rather than generating localized text inside UI components, the domain calculates a structured semantic payload with explicit nullable dates:

```typescript
export interface GroupTimeInfo {
  situation:
    | 'active_regular'
    | 'scheduled_regular'
    | 'active_reminder'
    | 'scheduled_reminder'
    | 'expired_reminder_with_next'
    | 'expired_reminder_without_next'
    | 'expired_regular';
  primaryTargetDate: string | null;     // ISO string (deadline for active; start for scheduled; null if unavailable)
  secondaryDate: string | null;          // ISO string (next renewal date for reminder programs; null if unavailable)
  daysRemaining: number | null;
  hoursRemaining: number | null;
  daysPassed: number | null;
  isOverdue: boolean;
  timeRemainingText: string;             // Official Arabic presentation string
  secondaryText?: string | null;         // Explanatory secondary text (e.g. next cycle date; null if none)
}
```

#### Nullable Date Semantics
- If a target date is not configured or unavailable, `primaryTargetDate` or `secondaryDate` is set to `null` rather than fabricating or assuming a default date.
- Relative calculations (`daysRemaining`, `hoursRemaining`, `daysPassed`) are computed only when the corresponding date is present; otherwise they resolve to `null`.

#### Semantics Across the 5 Display Situations

| Situation | Source Date | Output Semantics | Example Arabic Output |
| :--- | :--- | :--- | :--- |
| **1. Active Regular** | `cycle.deadlineDateTime` | Countdown to deadline | `متبقي 12 يوم و 6 س` |
| **2. Scheduled Regular** | `cycle.startDateTime` | Countdown to start | `يبدأ بعد 5 أيام` |
| **3. Active Reminder** | `cycle.deadlineDateTime` (primary) + `nextScheduledRenewalDate` (secondary) | Current cycle deadline + next renewal date note | `متبقي 8 أيام (التجديد القادم: 2026-12-01)` |
| **4. Scheduled Reminder** | `cycle.startDateTime` | Countdown to next reminder cycle start | `تبدأ الدورة التذكيرية بعد 14 يوماً` |
| **5. Expired Reminder (with next)** | `cycle.deadlineDateTime` (passed) + `nextScheduledRenewalDate` | Days since expiration + next scheduled date | `انتهى منذ 3 أيام — الدورة القادمة: 2026-11-20` |
| **5b. Expired Reminder (no next)** | `cycle.deadlineDateTime` (passed) | Days since expiration + unscheduled notice | `انتهى منذ 3 أيام — موعد التجديد غير محدد` |

---

### 2.6 Membership & Trainee Count Semantics

1. **Authoritative Count Source:**
   $$\text{traineeCount} = \text{group.traineeIds.length}$$
2. **Strict Staff Exclusion:**
   - Lecturers (`primaryInstructorId`), Assistant Lecturers (`assistantLecturerIds`), and Supervisors (`supervisorIds`) are stored in distinct staff fields and **never** included in `group.traineeIds`.
3. **Removed Members & Continuation Grants (`D-07`):**
   - When a trainee is removed from a group (`removeGroupMember`), their ID is immediately pruned from `group.traineeIds` and `groupMembers[group.id]`.
   - `traineeCount` decrements immediately.
   - Even if the trainee retains continuation grants (`self:continued:${groupId}:${attemptId}`), they access those courses via `/my-courses`, **never** inflating the group's active membership count.
4. **Group vs. Cycle Counts:**
   - Group-level count represents current active enrolled trainees.
   - Historical cycle `traineeIds` preserve snapshot attendance for auditing.

---

## 3. Target Trainee Groups API Response Contract (`GET /api/groups/my`)

The API contract is semantic and structured, excluding administratively archived groups (`D-GRP-07`), supporting compact carousel presentation (`D-GRP-08`), and strictly omitting unestablished derived progress/attention fields to remain within the Owner's requested scope:

```typescript
export interface TraineeCourseSummaryDTO {
  courseId: string;
  courseTitle: string;
  courseCode?: string;          // Compact code (e.g. "CRS-101") for concise carousel pills (D-GRP-08)
  courseRole: CourseRole;       // 'core' | 'reminder' (D-GRP-03, D-GRP-05, D-GRP-08)
  order: number;
}

export interface TraineeGroupCurrentCycleDTO {
  id: string;
  cycleNumber: number;
  title: string;
  status: 'active' | 'completed' | 'archived';
  startDateTime: string | null;
  deadlineDateTime: string | null;
  postDeadlinePolicy: PostDeadlinePolicy;
}

export interface TraineeGroupItemDTO {
  id: string;
  enrollmentCode?: string;
  name: string;
  description: string;
  groupType: GroupType;             // 'regular' | 'reminder' (D-GRP-03, D-GRP-06)
  operationalStatus: GroupStatus;   // 'active' | 'scheduled' | 'expired'
  traineeCount: number;             // Authoritative enrolled trainee count (group.traineeIds.length)
  startDateTime: string | null;
  deadlineDateTime: string | null;
  postDeadlinePolicy: PostDeadlinePolicy;
  renewalSchedule?: {
    autoRenewalEnabled: boolean;
    intervalDays: number | null;
    nextScheduledRenewalDate: string | null;
  };
  currentCycle: TraineeGroupCurrentCycleDTO | null;
  courses: TraineeCourseSummaryDTO[];
  timeInfo: GroupTimeInfo;
  navigationUrl: string;            // e.g. "/my-groups/GRP-101"
}

export type GetMyGroupsResponseDTO = TraineeGroupItemDTO[];
```

> **Scope Note:** In accordance with Owner guidance, candidate fields such as `myProgress`, `needsAttention`, `attentionReason`, and `attentionLevel` are deliberately omitted from this initial DTO baseline until their business rules and requirements are separately established.

---

## 4. Target Trainee Dashboard Presentation Contract

### 4.1 Persistent Carousel (`TrainingGroupsCarousel`)
1. **Content & Archive Exclusion (`D-GRP-07`):** Renders all non-archived groups where the trainee is currently enrolled (`visibleGroups`).
2. **Filter Independence:** Remains visible at all times; table search queries and column filters **never** filter, mutate, or alter the carousel's source collection.
3. **Deterministic Sorting Precedence:**
   - **Tier 1:** Active groups (`operationalStatus === 'active'`), sorted by nearest `deadlineDateTime` ascending ($\text{earliest deadline first}$).
   - **Tier 2:** Scheduled groups (`operationalStatus === 'scheduled'`), sorted by nearest `startDateTime` ascending ($\text{earliest start date first}$).
   - **Tier 3:** Expired groups (`operationalStatus === 'expired'`), sorted by `deadlineDateTime` descending ($\text{most recently expired first}$).
   - **Tie-Breaker:** Alphabetical by `group.name` in Arabic, then `group.id` ascending.
4. **Compact Course Presentation (`D-GRP-08`):**
   - Displays the group name prominently alongside its enrollment code.
   - Displays the group-level `برنامج تذكيري` badge when `groupType === 'reminder'`.
   - Renders assigned courses as compact labels or short codes (e.g. `CRS-101`) with clear visual distinction between core and reminder courses (e.g. dedicated reminder color accent or icon marker).
   - Avoids large stacked course names or verbose text that makes carousel cards excessively tall.
5. **Visual Badges (Decision `D-GRP-05`):**
   - Reminder Group Badge: `برنامج تذكيري` (variant: `warning` / amber).
   - Operational Status Badge: `نشطة — قيد التدريب` (primary) | `مجدولة` (neutral) | `منتهية الصلاحية` (danger).

### 4.2 Summary Cards
Positioned directly beneath the carousel:
1. **إجمالي المجموعات والبرامج:** Count of all enrolled non-archived groups.
2. **المجموعات النشطة:** Count of non-archived groups with `operationalStatus === 'active'`.
3. **البرامج المجدولة:** Count of non-archived groups with `operationalStatus === 'scheduled'`.
- **Integrity Rule:** Calculated from the complete non-archived group collection, independent of active table filters.

### 4.3 Detailed Data Table
- **Visual Hierarchy:** Prominent group name and code on row primary line.
- **Columns:**
  1. اسم المجموعة والبرنامج التدريبي (Group Name & Code).
  2. نوع البرنامج (Regular vs. Reminder Badge).
  3. الحالة التشغيلية (Active / Scheduled / Expired Badge).
  4. المهلة الزمنية والتجديد (Remaining time text & secondary renewal date).
  5. عدد المتدربين (Enrolled Trainee Count).
  6. المقررات المخصصة (Full course titles with explicit dual badges: `مقرر تذكيري` / `دورة أساسية`).
  7. إجراءات المتابعة (Button: `عرض تفاصيل المجموعة`).
- **Filtering Dimensions:**
  - Search input: matches group name or enrollment code.
  - Type filter: `all` | `regular` | `reminder`.
  - Status filter: `all` | `active` | `scheduled` | `expired`.

---

## 5. Production Backend Architecture & Scheduler Responsibility

| Feature | Prototype Simulation (MSW) | Target Production Backend (Django + SQL Server) |
| :--- | :--- | :--- |
| **Scheduler Trigger** | `useAutoRenewalScheduler` (browser timer & visibility change) | Windows Task Scheduler -> planned Django management command `process_due_group_renewals` (`API-REC-01` & `Domain 20 / D4` `OWNER APPROVED` `2026-11-13`; exact frequency open) |
| **Concurrency & Locking** | Single-threaded in-memory lock `isExecutingRef` | Database row-level lock: `TrainingGroup.objects.select_for_update().filter(...)` |
| **Transaction Boundary** | Synchronous array updates in `inMemoryStore` | ACID `transaction.atomic()` ensuring cycle creation, attempt provisioning, and schedule advancement commit together |
| **Client Requirement** | Requires an open browser session | 100% autonomous server-side execution; client browser presence is zero-dependency |
| **Identity Persistence** | `group.currentCycleId = newCycleId` | Foreign key update `current_cycle_id` pointing to `group_renewal_cycle` row |

---

## 6. Technical Implementation Details & Post-Decision Status

### 6.1 Formally Resolved Decisions (Closed)
The following former questions from Phase B are formally closed by Level 1 Owner Decisions:
- **Archive View Access for Trainees:** Closed by `D-GRP-07`. Administratively archived groups are 100% excluded from the trainee Groups page, carousel, table, and summary cards.
- **Carousel Course Presentation:** Closed by `D-GRP-08`. Carousel uses compact representations (short codes / compact pill badges) avoiding tall multi-line cards; full course names and explicit dual badges are reserved for the detailed table and details views.

### 6.2 Remaining Technical Questions (Implementation Architecture)
The following are technical implementation alternatives that do not alter business rules:

1. **Storage Mechanism for `hasHistoricalReminderCourses` in SQL Server:**
   - *Alternative A (Recommended):* Add a dedicated column `has_historical_reminder_courses BIT NOT NULL DEFAULT 0` on the `training_group` table. Set to `1` when a reminder course is first assigned; never set back to `0`. Provides immediate $O(1)$ query evaluation and straightforward indexing.
   - *Alternative B:* Compute dynamically via a SQL `EXISTS` subquery across historical `group_renewal_cycle_course` tables combined with audit logs. More complex, risks losing records if course removals precede cycle sealing.
   - *Recommendation:* Alternative A provides guaranteed monotonic persistence and matches Decision `D-GRP-06` exactly.

2. **Direct Route Trainee Authorization for Archived Groups (`/my-groups/:id`):**
   - *Alternative A (Recommended):* The trainee group loader treats `adminStatus === 'archived'` identically to a non-existent group for trainees, returning `404 Not Found` or standard `Access Denied` without disclosing archived metadata.
   - *Alternative B:* Render an informative archived state banner (`هذه المجموعة تم أرشفتها من قبل الإدارة`).
   - *Recommendation:* Alternative A maintains strict privacy and prevents information disclosure about archived groups.

3. **Carousel Responsiveness & Large Group Counts:**
   - For trainees enrolled in a large number of groups ($> 10$), native CSS flex scroll-snapping with previous/next navigation buttons provides optimal performance and accessibility without requiring complex virtualized windowing.

---

## 7. Phased Implementation Milestones & Operational Status

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase C: Domain Reconciliation & Contract Normalization                │
│ Status: OWNER ACCEPTED (IMPLEMENTED — VERIFICATION PENDING / GATE B)    │
│  1. Preserved courseRole in GroupCourseAssignment (types.ts)          │
│  2. Persistent monotonic reminder classification (D-GRP-06)            │
│  3. Reconciled current & historical course-role representations        │
│  4. Unified manual & automatic in-place renewal (D-GRP-01)             │
│  5. Idempotent cycle creation & attempt isolation (D-GRP-04)           │
│  6. Centralized resolveGroupType & resolveGroupOperationalStatus       │
│  7. Structured calculateGroupTimeInfo with explicit nullable dates     │
│  8. Administrative archive exclusion & fail-closed direct route        │
│  9. Normalized TraineeGroupItemDTO on GET /api/groups/my               │
│ 10. Trainee API data minimization & zero other-trainee metrics         │
│ 11. Authored 35 Phase C regression specifications (Gate B deferred)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase D: Trainee Groups Dashboard UI Implementation                    │
│ Status: IMPLEMENTED — VERIFICATION PENDING (GATE B)                   │
│  • TraineeGroupsCarousel: deterministic sorting & compact pills        │
│  • TraineeGroupsSummaryCards: 3 unfiltered archive-excluded counts     │
│  • TraineeGroupsDetailedTable: dominant name, dual badges & filters    │
│  • Assembled TraineeGroupsPage: title "المجموعات والبرامج التذكيرية"   │
│  • Authored 25 Phase D UI regression specifications (Gate B deferred)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase E: Verification & Test Suite Consolidation (Gate B Deferred)     │
│ Status: READY TO START (UPON OWNER INSTRUCTION)                        │
│  • Verification test suite consolidation                               │
│  • Gate B readiness sign-off                                           │
└────────────────────────────────────────────────────────────────────────┘
```

