# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 10 — Reminder Programs & In-Place Renewal

> **Document Title:** Technical Domain Specification — Reminder Programs & In-Place Renewal  
> **Document Identifier:** `METROLMS-TECH-DOM-010`  
> **Document Status:** `APPROVED — PHASE 2B BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-GRP-01`](../../../architecture/decision-register.md#d-grp-01), [`D-GRP-02`](../../../architecture/decision-register.md#d-grp-02), [`D-GRP-04`](../../../architecture/decision-register.md#d-grp-04), [`D-GRP-06`](../../../architecture/decision-register.md#d-grp-06), [`D-GRP-07`](../../../architecture/decision-register.md#d-grp-07), [`D-13`](../../../architecture/decision-register.md#d-13), `API-REC-01` / `API-REC-08A` / `API-REC-08B` (`OWNER APPROVED — 2026-11-13`)  
> **Last Updated:** 2026-11-13 (Owner Decision Recording: Concurrent Manual vs. Automatic Renewal — `INV-DOM10-12`)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** Admin renewal schedule configuration (`intervalDays`, `autoRenewalEnabled`), manual renewal trigger (`createRenewalCycle`), cycle history viewer, and `useAutoRenewalScheduler` calling `checkAndProcessAllDueRenewals` / `checkAndProcessAutoRenewal` (`inMemoryStore.ts`).
- **Target Backend Components (Django 5 + DRF — `API-REC-01` & `Domain 20 / D4` `OWNER APPROVED` `2026-11-13`):** `GroupRenewalCycle` model/service, proposed unified `renew_group_in_place` service, Windows Task Scheduler executing every 6 hours to invoke planned Django management command `process_due_group_renewals` (not yet implemented; Celery/Celery Beat/Redis/RabbitMQ/SQL Server Agent not required initially), and atomic attempt sealing/provisioning (`LLD-003`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Manual vs. Automated Renewal Execution:**
   - **Current Prototype:** Manual renewal (`POST /api/admin/groups/:groupId/renew` -> `inMemoryStore.createRenewalCycle`) and automated renewal (`POST /api/admin/groups/check-all-due-renewals` -> `checkAndProcessAllDueRenewals` / `checkAndProcessAutoRenewal`) are separate methods using `isExecutingRef` + synchronous `inMemoryStore` updates.
   - **Target Backend (Proposed):** Both triggers invoke one unified `renew_group_in_place` pipeline inside `transaction.atomic()` with `TrainingGroup.objects.select_for_update()`.
   - **Prototype-Only Deadline Reminders:** `checkAndProcessAllDueRenewals` also dispatches deduplicated 7-day `deadline_reminder` notifications (`dedupeKey: deadline_reminder:${group.id}:${cycleKey}:${canonicalUserId}`); pending formal Owner approval as a backend requirement.
2. **Day-Based Recurrence Math (`D-GRP-02`):**
   - `intervalDays` is stored as an integer in `[1, 730]`.
   - `nextScheduledRenewalDate = newCycle.deadlineDateTime + timedelta(days=intervalDays)`.
3. **Sealing & Fresh Attempt Provisioning (`D-GRP-04`, `D-13`):**
   - Prior cycle attempts receive `isSealed = true`; new `CourseAttempt` rows are created for `group.traineeIds` bound to `CYC-<groupId>-<NN>` and the current `PublishedCourseVersion.id`.

---

## 3. Validation, Authorization & Failure Scenarios

- **Idempotency & Concurrency (`INV-DOM10-12` — First Successful Transaction Wins, `OWNER APPROVED`, `2026-11-13`):**
  - Both manual (`POST /api/admin/groups/:groupId/renew`) and automatic (`process_due_group_renewals`) renewal invoke the unified `renew_group_in_place` service inside an atomic transaction with DB-supported row-level locking (or equivalent concurrency-control mechanism), post-lock eligibility revalidation, cycle-level idempotency, a committed-successor guard, and safe rollback. *(Technical Validation Note: exact `mssql-django` / SQL Server locking primitives such as `select_for_update()` / `UPDLOCK`/`ROWLOCK` behavior must be verified against the deployed SQL Server backend in Phase 12 rather than assumed.)*
  - **Scenario A (Auto Commits First):** Concurrent manual request detects the cycle was already renewed and returns HTTP `409 Conflict` using the canonical error envelope ([`django-sqlserver-integration-contract.md` §2.4](../../../backend/django-sqlserver-integration-contract.md#24-standard-error-envelope-400-401-403-404-409-422); exact conflict `code`/message flagged for the authorized API error-contract decision), creating no second cycle.
  - **Scenario B (Manual Commits First):** Concurrent scheduler run detects the cycle was already renewed, safely skips the duplicate, logs the outcome in structured scheduler logs, and continues processing other eligible groups without treating expected concurrency loss as an unrecoverable failure.
  - **Scenario C (Rollback):** If the first transaction fails and rolls back before committing, it is not treated as a successful renewal and a competing eligible transaction may proceed after lock release. *(Prototype note: `inMemoryStore.ts` runs single-threaded and only checks `lastAutoRenewedCycleId` in `checkAndProcessAutoRenewal`, not in `createRenewalCycle`.)*
- **Validation & Combined Manual Renewal Eligibility (`API-REC-08A`, `API-REC-08B` — `OWNER APPROVED`, `2026-11-13`):**
  - `intervalDays < 1` or `intervalDays > 730` fails with `400 Bad Request`; enabling `autoRenewalEnabled = true` without a valid defined end date (`deadlineDateTime`) fails with `400 Bad Request`.
  - Manual renewal (`POST /api/admin/groups/:groupId/renew`, preserving existing endpoint and `isGroupAdmin` authorization semantics) is eligible ONLY when: (1) the group is a Reminder Group (`groupType === 'reminder'`, prohibited for Regular Groups per `API-REC-08B`), (2) `adminStatus !== 'archived'` (`D-GRP-07` & `API-REC-08A`; must NOT implicitly unarchive or reactivate an archived group, and archived groups receive neither manual nor automatic renewal), (3) a valid end date (`deadlineDateTime`) is explicitly defined for the relevant group/cycle (applies even when `autoRenewalEnabled === false`; Frontend disables Manual Renew and displays `"يرجى تحديد موعد انتهاء أولًا"`, and Backend independently validates and rejects missing/invalid end dates using existing API validation error conventions), (4) the current active cycle has reached its defined `deadlineDateTime` (`now >= currentCycle.deadlineDateTime` per `INV-DOM10-11` — `OWNER APPROVED`, `2026-11-13`; reject early requests without shortening, replacing, or prematurely terminating the current cycle; automatic renewal preserves the same no-overlap rule), (5) actor authorization passes, and (6) all other approved renewal eligibility rules (`D-GRP-02`, `D-06`, `LLD-003`) are satisfied. *(Does not authorize modifying prototype `inMemoryStore.createRenewalCycle` or UI, which currently lack the archived/regular/end-date/early-renewal guards and disabled guidance.)*
- **No-End-Date Eligibility, End-Date Removal & Prototype Discrepancy (`INV-DOM10-07`, `INV-DOM10-08`, `INV-DOM10-09`):**
  - Per **Option A & `INV-DOM10-10` (`OWNER APPROVED`, `2026-11-13`)**, when an administrator attempts to remove `deadlineDateTime` from a group with `groupType === 'reminder'` and `autoRenewalEnabled === true`, the UI MUST display a confirmation warning (suggested Arabic: `"هذه المجموعة تعمل حاليًا في وضع التذكير والتجديد المتكرر. إزالة موعد الانتهاء ستؤدي إلى إلغاء التجديد التلقائي، مع استمرار المجموعة دون تاريخ انتهاء. هل تريد المتابعة؟"`) with *Cancel* (keeps `deadlineDateTime` and `autoRenewalEnabled === true` unchanged) and *Confirm and Disable Automatic Renewal* (removes `deadlineDateTime`, automatically sets `autoRenewalEnabled = false`, **preserves `groupType === 'reminder'`** — never converting to `'regular'`, marks any already-created future `GroupRenewalCycle` with `startDateTime > now` as target status **`Cancelled`** while retaining its record and cancellation history, and leaves active/already-started/completed cycles, learner progress, completed courses, and issued certificates untouched); the group continues operating as a non-expiring (`'active'`) group, `process_due_group_renewals` skips it, and manual `/renew` remains unavailable without a valid end date (even though `groupType === 'reminder'` is preserved). *(Prototype Discrepancy & Provisional Schema Note: confirmation dialog not yet implemented in `GroupEditorPage.tsx`, and `Cancelled` does not yet exist in `GroupRenewalCycle.status` in `types.ts`; persistence-bound enum/DTO representation remains `PROVISIONAL` pending Phase 5 Owner Input & Schema Review.)*
  - Target Django renewal sweep (`process_due_group_renewals`) and manual `/renew` MUST reject/skip any group lacking a valid defined `deadlineDateTime` (never falling back to `startDateTime` as prototype `inMemoryStore.ts` `updateGroup` / `checkAndProcessAutoRenewal` currently do).
- **Integration Boundaries & Constraints:** SQL Server DDL and OpenAPI schema generation for `group_renewal_cycle` are deferred to Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-GRP-010`](../../../01-requirements/domains/domain-10-reminder-programs-and-in-place-renewal.md)
- **Low-Level Design:** [`LLD-003`](../../../02-architecture-and-design/lld/LLD-003-group-renewal-cycle-manager.md)
- **Verification Gate:** Phase 4 (`Gate B`) runtime & contract suite.

