# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 08 — Training Groups Management

> **Document Title:** Domain 08 — Training Groups Management Business Rules  
> **Document Identifier:** `METROLMS-DOM-GRP-008`  
> **Document Status:** `APPROVED — PHASE 2B BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-GRP-01`](../../architecture/decision-register.md#d-grp-01), [`D-GRP-03`](../../architecture/decision-register.md#d-grp-03), [`D-GRP-05`](../../architecture/decision-register.md#d-grp-05), [`D-GRP-06`](../../architecture/decision-register.md#d-grp-06), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07), [`D-GRP-08`](../../architecture/decision-register.md#d-grp-08), `API-REC-02a`/`02b`/`02c` (`OWNER APPROVED — RETAIN`, `2026-11-13`)  
> **Last Updated:** 2026-11-13 (Owner Decision Recording: Option A — Auto-Renewal Deactivation on End-Date Removal)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern the lifecycle, identity, administrative archiving, operational status derivation, course assignment roles (`core` vs. `reminder`), and trainee dashboard presentation of `TrainingGroup` entities in MetroLMS.
- **Domain Boundaries:**
  - *In Scope:* `TrainingGroup` creation and immutable identity (`id`, `enrollmentCode`, `name`), course assignment and `courseRole` classification (`core` | `reminder`), `adminStatus` (`active` vs. `archived`), orthogonal `operationalStatus` (`active` | `scheduled` | `expired`), structured `GroupTimeInfo` calculation, and trainee Groups page presentation (`GET /api/groups/my`, persistent carousel, summary cards, detailed table).
  - *Out of Scope:* Trainee roster membership changes and `D-07` continuation grants (Domain 09), automated/manual in-place renewal cycle execution (Domain 10 / `LLD-003`), and post-deadline `'hide'` vs. `'keep_no_cert'` course access enforcement (Phase 3).
- **Actors & Responsibilities:**
  - *Admin (`admin`) / Superior (`superior`):* Creates, configures, edits, and administratively archives/restores training groups; assigns courses with `courseRole` (`core` | `reminder`).
  - *Assistant Admin (`assistant_admin`):* Views groups under `Rule A` read visibility; sensitive group mutations follow `INV-R9` / `INV-R10` approval workflow when applicable.
  - *Lecturer (`lecturer`) / Supervisor (`supervisor`):* Assigned to group staff fields (`primaryInstructorId`, `assistantLecturerIds`, `supervisorIds`) for instructional and oversight duties.
  - *Trainee (`user`):* Discovers non-archived enrolled groups via `/my-groups` and `/my-groups/:id`.
- **Core Entities:** `TrainingGroup`, `GroupCourseAssignment`, `GroupTimeInfo`, `TraineeGroupItemDTO`.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM08-01`** | **Immutable Group Identity (`D-GRP-01`)** | `TrainingGroup.id`, `enrollmentCode`, and `name` remain stable across the group's lifetime and across all renewal cycles. Successor group cloning is prohibited. | Group Service & Persistence Layer |
| **`INV-DOM08-02`** | **Immediate Mixed-Course Classification (`D-GRP-03`)** | A group is classified as `groupType: 'reminder'` immediately upon assignment of $\ge 1$ course with `courseRole === 'reminder'`; groups with only `'core'` courses are `'regular'`. | `resolveGroupType(group, cycle)` |
| **`INV-DOM08-03`** | **Monotonic Persistent Reminder Marker (`D-GRP-06`)** | `hasHistoricalReminderCourses` is write-once (`false -> true`). Removing the last currently assigned `'reminder'` course never downgrades `groupType` back to `'regular'`. | Group Course Mutation & `resolveGroupType` |
| **`INV-DOM08-04`** | **Archived Group Exclusion (`D-GRP-07`)** | Groups with `adminStatus === 'archived'` are excluded from `GET /api/groups/my`, persistent carousel, detailed table, and summary counts; `/my-groups/:id` fails closed (`404 Not Found` / `Access Denied`). | Trainee Groups API & Route Guard |
| **`INV-DOM08-05`** | **Orthogonal Operational Status** | `operationalStatus` (`'active' | 'scheduled' | 'expired'`) is derived strictly from the active cycle's `startDateTime` and `deadlineDateTime` relative to `now`; a future `nextScheduledRenewalDate` never keeps an expired cycle `'active'`. | `resolveGroupOperationalStatus` |
| **`INV-DOM08-06`** | **Dual Badge & Compact Carousel Contract (`D-GRP-05`, `D-GRP-08`)** | Reminder groups display `برنامج تذكيري`; courses display `مقرر تذكيري` or `دورة أساسية` in tables/details and compact codes/pills in the carousel without emojis. | Trainee Groups UI |
| **`INV-DOM08-07`** | **Ongoing Non-Expiring Group Without End Date (`2026-11-13`)** | A group may be configured without a defined end date (`deadlineDateTime = null` / absent) and continue operating as `'active'` (when `now >= startDateTime` or dates absent); absence of an end date MUST NOT cause it to be treated as `'expired'` or `'completed'`, nor may an artificial end date be fabricated. | `resolveGroupOperationalStatus` & Group Service |

---

## 3. State Transition Rules

### 3.1 Administrative Lifecycle (`adminStatus`)
- **`active` -> `archived`:** Administrative archiving hides the group from all trainee group discovery surfaces (`/my-groups`, carousel, table, summary counts) while preserving all historical cycles, attempts, attendance, and certificates (accessible via `/my-certificates`).
- **`archived` -> `active`:** Administrative restoration re-exposes the group on trainee discovery surfaces according to its current `operationalStatus` and `traineeIds` membership.

### 3.2 Operational Status Derivation (`resolveGroupOperationalStatus`)
1. Retrieve active cycle via `group.currentCycleId` (fallback to group baseline dates if none exists).
2. If $\text{now} < \text{startDateTime}$ -> `'scheduled'`.
3. If $\text{now} > \text{deadlineDateTime}$ -> `'expired'`.
4. If $\text{startDateTime} \le \text{now} \le \text{deadlineDateTime}$ -> `'active'`.

---

## 4. Boundary Conditions & Edge Cases

- **Archived vs. Expired Distinction (`D-GRP-07`):** An expired group (`operationalStatus === 'expired'`) with `adminStatus === 'active'` remains visible in the trainee Groups table and Tier 3 of the carousel. Only `adminStatus === 'archived'` is excluded.
- **Nullable TimeInfo Dates:** When `startDateTime` or `deadlineDateTime` is absent, `GroupTimeInfo.primaryTargetDate` or `secondaryDate` resolves to `null` rather than fabricating default dates; relative numeric fields (`daysRemaining`, `hoursRemaining`, `daysPassed`) resolve to `null`.
- **Ongoing Non-Expiring Group vs. Recurring Group (`2026-11-13`):** An ongoing non-expiring group without a defined end date operates normally (`'active'`) and is **not** eligible for automatic recurring renewal (which requires a valid, explicitly defined end date per Domain 10 `INV-DOM10-07`). Per **Option A (`OWNER APPROVED`, `2026-11-13`)**, if an administrator attempts to remove `deadlineDateTime` from a group where `groupType === 'reminder'` and `autoRenewalEnabled === true`, the UI MUST display a confirmation warning first (*Cancel* leaves both unchanged; *Confirm and Disable Automatic Renewal* removes `deadlineDateTime`, automatically sets `autoRenewalEnabled = false`, and **preserves `groupType === 'reminder'`** — never converting to `'regular'`) so the group continues operating as a non-expiring group (`INV-DOM10-09`). *(Prototype Discrepancy Note: `frontend/src/pages/GroupEditorPage.tsx` currently requires `deadlineDateTime` on form submit, does not yet implement the confirmation dialog, and `TrainingGroup.deadlineDateTime` is typed as `string` in `types.ts`; this is a prototype UI/type gap relative to the approved target business rule.)*
- **Group-Scoped Assistant Lecturer Management (`API-REC-02a`–`02c` — `OWNER APPROVED — RETAIN`, `2026-11-13`):**
  - `API-REC-02a` (`GET /api/groups/:groupId/assistants`): Read the assistant lecturers assigned to a specific group.
  - `API-REC-02b` (`POST /api/groups/:groupId/assistants`): Add one assistant lecturer to a specific group without replacing the existing assistant roster (individual addition, not bulk replacement).
  - `API-REC-02c` (`DELETE /api/groups/:groupId/assistants/:lecturerId`): Remove one assistant lecturer's assignment from the specific group only; MUST NOT delete the lecturer's system account or affect assignments in other groups.
  - **Identity vs. Assignment Distinction:** Preserves the distinction between a lecturer's system-wide account (`role === 'lecturer'`) and their group-scoped assignment as an assistant to a particular group; neither all group members nor all lecturers are automatically assistants. Existing authorization semantics remain unchanged (`developer`, `super_admin`, `admin`, or group primary instructor for `POST`/`DELETE`; plus `assistant_admin`, assigned group supervisors/instructors, and enrolled group trainees for `GET`).
- **Carousel Filter & Summary Independence:** Table search queries (group name or `enrollmentCode`), `groupType` filters (`all` | `regular` | `reminder`), and `operationalStatus` filters (`all` | `active` | `scheduled` | `expired`) never alter the persistent carousel source list or the 3 summary card counts.

---

## 5. Traceability Matrix

| Business Rule / Invariant | Governing Decision / Requirement | Technical Domain Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM08-01` | [`D-GRP-01`](../../architecture/decision-register.md#d-grp-01) | [`METROLMS-TECH-DOM-008`](../../03-technical-documentation/domains/groups/domain-08-training-groups-management.md) | Phase 4 Gate B |
| `INV-DOM08-02`, `INV-DOM08-03` | [`D-GRP-03`](../../architecture/decision-register.md#d-grp-03), [`D-GRP-06`](../../architecture/decision-register.md#d-grp-06) | [`METROLMS-TECH-DOM-008`](../../03-technical-documentation/domains/groups/domain-08-training-groups-management.md) | Phase 4 Gate B |
| `INV-DOM08-04`, `INV-DOM08-05`, `INV-DOM08-06` | [`D-GRP-05`](../../architecture/decision-register.md#d-grp-05), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07), [`D-GRP-08`](../../architecture/decision-register.md#d-grp-08) | [`METROLMS-TECH-DOM-008`](../../03-technical-documentation/domains/groups/domain-08-training-groups-management.md) | Phase 4 Gate B |

