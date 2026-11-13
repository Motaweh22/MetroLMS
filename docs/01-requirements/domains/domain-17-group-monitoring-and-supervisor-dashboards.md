# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 17 — Group Monitoring & Supervisor Dashboards

> **Document Title:** Domain 17 — Group Monitoring & Supervisor Dashboards Business Rules  
> **Document Identifier:** `METROLMS-DOM-OPS-017`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../architecture/decision-register.md#d-06), [`D-12`](../../architecture/decision-register.md#d-12), [`D-14`](../../architecture/decision-register.md#d-14), [`D-GRP-01`](../../architecture/decision-register.md#d-grp-01), [`D-GRP-06`](../../architecture/decision-register.md#d-grp-06), [`INV-R8`](../../architecture/security-and-xss-baseline.md), `Inc 11 Decision 2`  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Provide cycle-scoped group monitoring, cohort completion KPIs, inactivity flagging, and supervisor dashboards for administrators and assigned group instructors without leaking `developer` accounts or cross-group data.
- **Domain Boundaries:**
  - *In Scope:* `GET /api/admin/groups/:groupId/monitoring` (`GroupMetrics`), cycle selector (`?cycleId=...`), assigned supervisor vs. admin authorization, `developer` exclusion (`MFR-39`), `> 5 days` inactivity detection (`Inc 11 Decision 2`), and authoritative `D-12` progress aggregation.
  - *Out of Scope:* Course-level lecturer performance report (`GET /api/lecturer/courses/:courseId/performance`) and trainee-facing `/my-groups` dashboard (Domain 08).
- **Core Entities:** `GroupMetrics`, `CohortSummaryMetrics`, `AssignedCourseProgressMetric`, `TraineeGroupMetrics` *(all persistence fields remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM17-01`** | **Supervisor Scope Isolation (`INV-R8`)** | Operational admins (`developer`, `super_admin`, `admin`, `assistant_admin` under `Rule A`) and **assigned group supervisors** (`primaryInstructorId` or `assistantLecturerIds` or `supervisorIds`) may read `GroupMetrics`; unassigned lecturers/trainees fail closed (`403`). | `groupHandlers.ts` / Django Permission Class |
| **`INV-DOM17-02`** | **Developer Confidentiality Exclusion (`MFR-39`)** | `developer` accounts are unconditionally excluded from `traineeMetricsList`, `cohortSummary`, and all group monitoring denominators for all non-developer viewers. | Monitoring Aggregator (`inMemoryStore.ts`) |
| **`INV-DOM17-03`** | **Inactivity Flagging (`Inc 11 Decision 2`)** | Learners with verified `lastActivityAt` older than `> 5 days` are flagged inactive (`متأخر ⚠️`); peak viewing hours or activity timestamps are never fabricated. | Monitoring / Performance Aggregator |
| **`INV-DOM17-04`** | **Cycle-Scoped Monitoring & `D-12` Math** | Selecting `cycleId` computes `GroupMetrics` strictly from that cycle's `traineeIds` snapshot and cycle-bound `CourseAttempt`s using `calculateTraineeProgress` (`D-12`). | `computeAttemptProgress` (`LLD-004`) |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `INV-R8` supervisor isolation, `MFR-39` developer exclusion, `Inc 11 Decision 2` (`> 5 days` inactivity from verified `lastActivityAt`), `D-12` rounding, and `D-06` per-attempt isolation.
- **Current Prototype Behavior:** `frontend/src/pages/GroupMonitoringPage.tsx`, `groupsApi.getGroupMonitoringData`, and `inMemoryStore.ts` (`GroupMetrics` in `core/groups/types.ts`).
- **Implementation Gap:** In-memory aggregation computes KPIs synchronously over JS arrays without SQL Server indexed queries or pagination on large `traineeMetricsList` cohorts.
- **Target Backend Behavior:** Django aggregates `GroupMetrics` per `cycleId` via SQL Server queries excluding `developer` users and respecting `INV-R8` / `D-14`.
- **Deferred / Provisional Notice:** Any persisted monitoring snapshot/cache fields remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM17-01`, `INV-DOM17-02` | `INV-R8`, `MFR-39`, [`D-14`](../../architecture/decision-register.md#d-14) | [`METROLMS-TECH-DOM-017`](../../03-technical-documentation/domains/operations/domain-17-group-monitoring-and-supervisor-dashboards.md) | `assistant-admin-groups-security.test.ts`, `developer-confidentiality.test.tsx`, `training-groups-api.test.tsx` |
| `INV-DOM17-03`, `INV-DOM17-04` | `Inc 11 Decision 2`, [`D-12`](../../architecture/decision-register.md#d-12) | [`METROLMS-TECH-DOM-017`](../../03-technical-documentation/domains/operations/domain-17-group-monitoring-and-supervisor-dashboards.md) | `course-performance.test.tsx`, `training-groups-demo-seeding.test.tsx` |

