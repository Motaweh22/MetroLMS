# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 20 — Scheduling, Deadlines & Background Jobs

> **Document Title:** Domain 20 — Scheduling, Deadlines & Background Jobs Business Rules  
> **Document Identifier:** `METROLMS-DOM-OPS-020`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-GRP-01`](../../architecture/decision-register.md#d-grp-01), [`D-GRP-02`](../../architecture/decision-register.md#d-grp-02), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07), `API-REC-01` (`OWNER APPROVED — 2026-11-13`), `Domain 20 / D4` (`OWNER APPROVED — 2026-11-13`), `API-REC-08A` & `API-REC-08B` (`OWNER APPROVED — 2026-11-13`), `INV-DOM20-06` (`Option B — OWNER APPROVED`, `2026-11-13`)  
> **Last Updated:** 2026-11-13 (Owner Decision Recording: Overdue Multi-Cycle Recovery — Option B)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern time-based group operational status transitions (`scheduled`, `active`, `expired`), day-based recurrence scheduling (`D-GRP-02`), post-deadline access evaluation (`WP-2.4`), and the server-side autonomous job execution boundary (`API-REC-01` — `OWNER APPROVED`, `2026-11-13`).
- **Domain Boundaries:**
  - *In Scope:* Cycle deadline evaluation, day-based recurrence calculation (`intervalDays` $\in [1, 730]$), idempotent due-renewal sweeping (`lastAutoRenewedCycleId`), server-side autonomous renewal execution via Windows Task Scheduler invoking a planned Django management command (`Domain 20 / D4`), and manual renewal retention (`POST /api/admin/groups/:groupId/renew`).
  - *Out of Scope:* Internal 8-step in-place renewal transaction (`LLD-003`, Domain 10), unapproved 7-day `deadline_reminder` notification policy, and distributed task-queue infrastructure (Celery, Celery Beat, Redis, RabbitMQ, SQL Server Agent — explicitly not required in the initial approved architecture).
- **Core Entities:** `GroupRenewalCycle`, `RenewalSchedule` *(all persistence fields remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM20-01`** | **Day-Based Schedule Math (`D-GRP-02`)** | All recurrence intervals use exact integer days (`intervalDays` $\in [1, 730]$); `nextScheduledRenewalDate = deadlineDateTime + intervalDays`. | `calculateNextRenewalDate` (`core/domain/groups.ts`) / Target Django Renewal Services |
| **`INV-DOM20-02`** | **Operational Status Resolution** | `now < startDateTime` -> `'scheduled'`; `now > deadlineDateTime` (when defined) -> `'expired'`; otherwise (including when `deadlineDateTime` is absent/`null`) -> `'active'`. | `resolveGroupOperationalStatus` (`core/groups/resolvers.ts`) / Target Django Services |
| **`INV-DOM20-03`** | **Archived Exclusion from Auto-Renewal (`D-GRP-07`)** | Groups with `adminStatus === 'archived'` are strictly excluded from automated renewal sweeps. | Target Django Renewal Services |
| **`INV-DOM20-04`** | **At-Most-Once Due Cycle Execution** | Overlapping scheduler runs or concurrent manual `/renew` calls MUST NOT renew the same `currentCycleId` twice (`lastAutoRenewedCycleId` + transactional row lock). | Target Django Renewal Services |
| **`INV-DOM20-05`** | **Valid End Date Required for Auto-Renewal (`2026-11-13`)** | Ongoing non-expiring groups without a defined end date (`deadlineDateTime` absent/`null`) are NOT eligible for automatic renewal, must NOT be assigned an artificial end date, and enabling `autoRenewalEnabled` without a valid end date MUST be rejected. Removing `deadlineDateTime` from a Reminder Group with `autoRenewalEnabled === true` requires confirmation (*Cancel* keeps both unchanged; *Confirm* removes `deadlineDateTime`, sets `autoRenewalEnabled = false`, **preserves `groupType === 'reminder'`**, and marks any already-created future cycle with `startDateTime > now` as target status `Cancelled` without touching active/completed cycles or learner records per `INV-DOM10-09` & `INV-DOM10-10`), causing the scheduler to skip the group while it continues operating as non-expiring. | Group Validation, UI Confirmation & Target Django Renewal Services |
| **`INV-DOM20-06`** | **Overdue Multi-Cycle Recovery — Option B (`OWNER APPROVED`, `2026-11-13`)** | When `process_due_group_renewals` runs after an extended outage or missed window and multiple renewal intervals have elapsed, the system MUST revalidate eligibility, skip all missed intermediate cycles (never retroactively creating artificial historical cycles), and create **at most ONE** recovery `GroupRenewalCycle` per eligible group, continuing subsequent recurrence from that recovery cycle (`D-GRP-02`) while preserving all historical cycles, progress, completed courses, and certificates (`D-06`, `D-GRP-04`, `D-13`). Does not authorize early manual renewal (`INV-DOM10-11`). | `process_due_group_renewals` & Target Django Renewal Services |

---

## 3. Approved Decisions, Current Prototype vs. Target Behavior & Open Cases

### 3.1 Owner-Approved Decisions (`2026-11-13`)

1. **`API-REC-01` — Renewal Execution Architecture (`OWNER APPROVED`):**
   - The system MUST support both **Automatic Renewal** and **Manual Renewal** initiated by an authorized administrator (`POST /api/admin/groups/:groupId/renew` remains available).
   - Automatic renewal MUST execute independently on the server and MUST NOT depend on a browser session, an open page, or user activity.
   - **Django owns all renewal business logic.** The scheduler triggers Django execution rather than implementing renewal business rules itself.
   - The browser-triggered automatic renewal mechanism (`useAutoRenewalScheduler.ts`, `POST /api/admin/groups/check-all-due-renewals`, `POST /api/admin/groups/:groupId/check-auto-renewal`) MUST NOT remain the production execution mechanism.
2. **`Domain 20 / D4` — Initial Scheduler Technology (`OWNER APPROVED`):**
   - **Approved Initial Production Flow:** `Windows Server` -> `Windows Task Scheduler` -> `Django Management Command` (planned target command name: `process_due_group_renewals` — **not yet implemented**) -> `Django Renewal Services` -> `Microsoft SQL Server`.
   - **Deferred / Not Required Initially:** **Celery**, **Celery Beat**, **Redis**, **RabbitMQ**, and **SQL Server Agent** are explicitly **not required in the initial approved architecture**. They may be reconsidered only if future scale, workload complexity, or operational requirements justify a distributed task queue.
3. **`API-REC-08A` & `API-REC-08B` — Manual Renewal Eligibility (`OWNER APPROVED`):**
   - **`API-REC-08A`:** Manual renewal is prohibited for archived groups (`adminStatus === 'archived'`), preserving `D-GRP-07`; archived groups receive neither manual nor automatic renewal, and `/renew` MUST NOT implicitly unarchive or reactivate a group.
   - **`API-REC-08B`:** Manual renewal is permitted only for eligible, non-archived Reminder Groups (`groupType === 'reminder'`) and is prohibited for Regular Groups.
   - **Combined Rule (`INV-DOM10-08`, `INV-DOM10-11`):** Manual renewal (`POST /api/admin/groups/:groupId/renew`) is eligible ONLY when: (1) the group is a Reminder Group, (2) the group is not archived, (3) a valid end date (`deadlineDateTime`) is explicitly defined for the relevant group/cycle (applies even when `autoRenewalEnabled === false`; Frontend disables Manual Renew with `"يرجى تحديد موعد انتهاء أولًا"`, and Backend independently validates and rejects missing/invalid end dates), (4) the current active cycle has reached its defined `deadlineDateTime` (`now >= currentCycle.deadlineDateTime` per `INV-DOM10-11` — `OWNER APPROVED`, `2026-11-13`; early manual renewal is prohibited without shortening, replacing, or prematurely terminating the current cycle, and automatic renewal preserves the same no-overlap rule), (5) the requesting actor satisfies existing authorization requirements, and (6) all other approved renewal eligibility rules (`D-GRP-02`, `D-06`, `LLD-003`) are satisfied.

### 3.2 Preserved Renewal Business Rules & Current Prototype Gap

- **Preserved Business Behavior:** `D-GRP-02` day-based math (`intervalDays` $\in [1, 730]$), `D-GRP-07` archived exclusion (`adminStatus !== 'archived'`), `autoRenewalEnabled === true` eligibility, manual `/renew` availability, `WP-2.4` post-deadline access enforcement, and in-place cycle renewal / historical retention (`LLD-003`).
- **Current Prototype Behavior (Non-Production):** `frontend/src/features/groups/hooks/useAutoRenewalScheduler.ts` polls `POST /api/admin/groups/check-all-due-renewals` on mount, every 5 minutes, and on `visibilitychange`. `groupsApi.checkAutoRenewal` (`POST /api/admin/groups/:groupId/check-auto-renewal`) has no active UI caller or test.
- **Implementation Gap:** Browser-driven scheduler simulation does not run when no authenticated browser tab is open, lacks distributed row locking, and `process_due_group_renewals` does not yet exist in the repository.

### 3.3 Required Execution Safeguards (Design Constraints for Future Implementation)

The following safeguards are mandatory design constraints for future Django implementation (not yet implemented):
- **Idempotency:** Repeated or overlapping executions of `process_due_group_renewals` MUST NOT double-renew the same cycle (`lastAutoRenewedCycleId` / cycle-level idempotency guard).
- **Concurrency Protection:** Transactional row-level locking MUST protect against overlapping scheduler invocations and simultaneous manual `/renew` vs. automatic renewal calls.
- **Missed Execution Recovery:** If Windows Server or Windows Task Scheduler misses one or more scheduled windows, subsequent runs MUST evaluate all overdue eligible groups (`now >= nextScheduledRenewalDate`) rather than relying on exact-minute matching.
- **Recurring-State Validation:** Inside the transaction, Django Renewal Services MUST re-validate `adminStatus !== 'archived'`, `autoRenewalEnabled === true`, and `lastAutoRenewedCycleId !== currentCycleId`.
- **Auditability:** Record structured execution and outcome logs (run start/end timestamps, evaluated/renewed/skipped/failed counts, cycle transitions, and trigger source: system scheduler vs. admin manual).
- **Timezone Consistency:** Use a single canonical timezone / UTC comparison basis for `now`, `nextScheduledRenewalDate`, and `deadlineDateTime`.

### 3.4 Unresolved / Open Items (Not Decided Here)

- **Exact Execution Frequency:** No fixed Windows Task Scheduler polling cadence (e.g., hourly, daily, or specific minute interval) has been specified or approved yet.
- **Edge-Case Renewal Rules:** Exact recovery-cycle date-anchor boundary when `now > nextScheduledRenewalDate` falls within the first missed nominal cycle (`INV-DOM10-06` `startDate = now` vs. prototype `inMemoryStore.ts` `scheduledStart + durationMs <= now` check), and exact simultaneous manual-vs-auto conflict response behavior remain unresolved and require separate specification/Owner input before implementation.
- **Deferred / Provisional Notice:** Schedule pointer columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM20-01`–`INV-DOM20-04` | [`D-GRP-02`](../../architecture/decision-register.md#d-grp-02), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07) | [`METROLMS-TECH-DOM-020`](../../03-technical-documentation/domains/operations/domain-20-scheduling-deadlines-and-background-jobs.md), [`LLD-003`](../../02-architecture-and-design/lld/LLD-003-group-renewal-cycle-manager.md) | `group-domain-reconciliation.test.ts`, `post-deadline-access-enforcement.test.ts` (33 specs); `check-all-due-renewals` & `check-auto-renewal` `NO TEST` |

