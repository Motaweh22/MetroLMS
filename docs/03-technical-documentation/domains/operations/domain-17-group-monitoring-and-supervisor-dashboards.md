# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 17 — Group Monitoring & Supervisor Dashboards

> **Document Title:** Technical Domain Specification — Group Monitoring & Supervisor Dashboards  
> **Document Identifier:** `METROLMS-TECH-DOM-017`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../../architecture/decision-register.md#d-06), [`D-12`](../../../architecture/decision-register.md#d-12), [`D-14`](../../../architecture/decision-register.md#d-14), `INV-R8`, `MFR-39`, `Inc 11 Decision 2`  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `GroupMonitoringPage.tsx`, `groupsApi.getGroupMonitoringData` (`GET /api/admin/groups/:groupId/monitoring?cycleId=...`), `GroupMetrics` (`core/groups/types.ts`), `inMemoryStore.ts`.
- **Target Backend Components (Django 5 + DRF — Proposed):** Cycle-scoped monitoring query service computing `CohortSummaryMetrics`, `AssignedCourseProgressMetric[]`, and `TraineeGroupMetrics[]` from SQL Server tables.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Cycle-Scoped Querying:**
   - Accepts optional `cycleId` query parameter; defaults to `group.currentCycleId`.
   - Computes `programTotalRequiredLessons` and per-trainee `progressPercent` via `calculateTraineeProgress` (`D-12`).
2. **Inactivity Flagging (`Inc 11 Decision 2`):**
   - Flags trainees with verified `lastActivityAt` older than `> 5 days` (`متأخر ⚠️`); never fabricates timestamps.
3. **Confidentiality (`MFR-39`):**
   - Excludes `developer` accounts from all trainee metrics and cohort denominators for non-developer actors.

---

## 3. Validation, Authorization & Failure Scenarios

- **Authorization (`INV-R8`):** Operational admins and assigned group supervisors (`primaryInstructorId`, `assistantLecturerIds`, `supervisorIds`) are permitted; unassigned lecturers/trainees receive `403 Forbidden`.
- **Provisional Persistence Notice:** Any monitoring cache/projection fields remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-OPS-017`](../../../01-requirements/domains/domain-17-group-monitoring-and-supervisor-dashboards.md)
- **Verification Evidence:** `assistant-admin-groups-security.test.ts`, `developer-confidentiality.test.tsx`, `training-groups-api.test.tsx` (deferred to Gate B).

