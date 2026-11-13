# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 20 — Scheduling, Deadlines & Background Jobs

> **Document Title:** Technical Domain Specification — Scheduling, Deadlines & Background Jobs  
> **Document Identifier:** `METROLMS-TECH-DOM-020`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-GRP-02`](../../../architecture/decision-register.md#d-grp-02), [`D-GRP-07`](../../../architecture/decision-register.md#d-grp-07), `API-REC-01` (`OWNER APPROVED — 2026-11-13`), `Domain 20 / D4` (`OWNER APPROVED — 2026-11-13`), `API-REC-08A` & `API-REC-08B` (`OWNER APPROVED — 2026-11-13`), `INV-DOM20-06` (`Option B — OWNER APPROVED`, `2026-11-13`)  
> **Last Updated:** 2026-11-13 (Owner Decision Recording: Overdue Multi-Cycle Recovery — Option B)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components (Non-Production Scheduler):** `useAutoRenewalScheduler.ts` (5-min timer + `visibilitychange` calling `groupsApi.checkAllDueRenewals`), `groupsApi.checkAutoRenewal` (no UI caller), `resolveGroupOperationalStatus` (`core/groups/resolvers.ts`), `calculateNextRenewalDate` (`core/domain/groups.ts`). Per `API-REC-01` (`OWNER APPROVED`), the browser-triggered automatic renewal mechanism MUST NOT remain the production execution mechanism.
- **Target Backend Execution Architecture (`API-REC-01` & `Domain 20 / D4` — `OWNER APPROVED`, `2026-11-13`):**
  - **Execution Chain:** `Windows Server` -> `Windows Task Scheduler` -> `Django Management Command` (planned target command name: `process_due_group_renewals` — **not yet implemented**) -> `Django Renewal Services` -> `Microsoft SQL Server`.
  - **Logic Ownership:** Django owns all renewal business logic. Windows Task Scheduler triggers `python manage.py process_due_group_renewals` without implementing business rules itself.
  - **Manual Endpoint Retained:** `POST /api/admin/groups/:groupId/renew` remains available for authorized administrators.
  - **Excluded Prototype Endpoints:** `POST /api/admin/groups/check-all-due-renewals` and `POST /api/admin/groups/:groupId/check-auto-renewal` are excluded from the production Django HTTP API.
  - **Not Required in Initial Architecture:** **Celery**, **Celery Beat**, **Redis**, **RabbitMQ**, and **SQL Server Agent** are explicitly not required in the initial approved architecture.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Dual Renewal Modes (`API-REC-01`):**
   - **Automatic Renewal:** Triggered on the server by Windows Task Scheduler invoking planned `process_due_group_renewals`, independent of any browser session, open page, or user activity.
   - **Manual Renewal (`API-REC-08A`, `API-REC-08B`, End-Date & Completion Requirements — `OWNER APPROVED`):** Triggered on demand by an authorized administrator via `POST /api/admin/groups/:groupId/renew` (preserving existing endpoint and `isGroupAdmin` authorization semantics), eligible ONLY for non-archived Reminder Groups (`groupType === 'reminder' && adminStatus !== 'archived'`, never implicitly unarchiving) with a **valid explicitly defined end date (`deadlineDateTime`)** where the current active cycle has reached its `deadlineDateTime` (`now >= currentCycle.deadlineDateTime` per `INV-DOM10-11`; even when `autoRenewalEnabled === false`; Frontend disables Manual Renew with `"يرجى تحديد موعد انتهاء أولًا"` and Backend independently validates and rejects missing/invalid end dates or early requests without prematurely terminating the current cycle; automatic renewal preserves the same no-overlap rule) when all other approved renewal eligibility rules are satisfied (`D-GRP-02`, `D-06`, `LLD-003`).
2. **Idempotent Execution & Preserved Eligibility Rules:**
   - Due-renewal sweep filters `adminStatus !== 'archived'` (`D-GRP-07`), `autoRenewalEnabled === true`, **valid defined end date (`deadlineDateTime !== null`)** (`INV-DOM20-05`), `now >= nextScheduledRenewalDate` (`D-GRP-02` day-based math), and `lastAutoRenewedCycleId !== currentCycleId`.
   - Enabling `autoRenewalEnabled = true` without a valid defined end date MUST be rejected by validation (`400 Bad Request`). Removing `deadlineDateTime` from a Reminder Group with `autoRenewalEnabled === true` requires UI confirmation (*Cancel* keeps both unchanged; *Confirm* removes `deadlineDateTime`, automatically sets `autoRenewalEnabled = false`, **preserves `groupType === 'reminder'`**, and marks any already-created future cycle with `startDateTime > now` as target status `Cancelled` while retaining its record and preserving active/historical cycles and learner records per `INV-DOM10-09` & `INV-DOM10-10`), so `process_due_group_renewals` skips the group while it continues operating as an ongoing non-expiring (`'active'`) group. *(Prototype Discrepancy & Provisional Schema Note: `GroupEditorPage.tsx` does not yet implement the confirmation dialog, `Cancelled` does not yet exist in `GroupRenewalCycle.status` in `types.ts`, and `inMemoryStore.ts` `updateGroup` / `checkAndProcessAutoRenewal` currently do not auto-deactivate `autoRenewalEnabled` and fall back to `startDateTime` when `deadlineDateTime` is absent; target Django implementation must NOT include that fallback.)*
3. **Overdue Multi-Cycle Recovery (`INV-DOM20-06`, Option B — `OWNER APPROVED`, `2026-11-13`):**
   - When `process_due_group_renewals` runs after an extended outage or missed window and multiple intervals have elapsed: (1) identify overdue groups with `autoRenewalEnabled === true`, (2) revalidate all eligibility rules (`D-GRP-02`, `D-GRP-07`, `INV-DOM10-07`, `INV-DOM10-11`), (3) detect missed intervals, (4) skip intermediate missed cycles without materializing artificial historical cycles, (5) create **at most one** recovery cycle (idempotent via `lastAutoRenewedCycleId` and concurrency-safe via row locking), (6) preserve all historical cycles, learner progress, completed courses, and issued certificates (`D-06`, `D-GRP-04`, `D-13`), and (7) schedule subsequent renewals from the recovery cycle (`D-GRP-02`). Date anchoring preserves `INV-DOM10-06` / `LLD-003` Step 5 without inventing a new formula.

---

## 3. Required Execution Safeguards, Validation & Open Items

- **Required Execution Safeguards (Design Constraints for Future Implementation — Not Yet Implemented):**
  1. **Idempotency:** Prevent duplicate renewal of the same cycle (`lastAutoRenewedCycleId` / cycle-level guard).
  2. **Concurrency Protection:** Row-level transactional locking (`SELECT FOR UPDATE` / SQL Server lock) across overlapping scheduler runs and simultaneous manual `/renew` calls.
  3. **Missed Execution Recovery:** Evaluate all overdue eligible groups (`now >= nextScheduledRenewalDate`) on the next run so missed scheduler windows self-heal.
  4. **Recurring-State Validation:** Re-verify `adminStatus !== 'archived'`, `autoRenewalEnabled === true`, and `lastAutoRenewedCycleId !== currentCycleId` inside the transaction.
  5. **Auditability:** Emit structured logs and outcome records (timestamps, evaluated/renewed/skipped/failed counts, trigger source).
  6. **Timezone Consistency:** Enforce a single canonical timezone / UTC basis for deadline and renewal comparisons.
- **Unresolved Items (Not Decided Here):** Exact Windows Task Scheduler execution frequency; recovery-cycle date-anchor boundary when `now > nextScheduledRenewalDate` falls within the first missed nominal cycle (`INV-DOM10-06` `startDate = now` vs. prototype `inMemoryStore.ts` `scheduledStart + durationMs <= now`); exact simultaneous manual-vs-auto conflict response.
- **Test Coverage Gap:** Both prototype `checkAutoRenewal` and `checkAllDueRenewals` HTTP endpoints currently have `NO TEST`.
- **Provisional Persistence Notice:** Schedule/pointer columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-OPS-020`](../../../01-requirements/domains/domain-20-scheduling-deadlines-and-background-jobs.md)
- **Low-Level Design:** [`LLD-003`](../../../02-architecture-and-design/lld/LLD-003-group-renewal-cycle-manager.md)
- **Verification Evidence:** `group-domain-reconciliation.test.ts`, `post-deadline-access-enforcement.test.ts` (33 specs) (deferred to Gate B).

