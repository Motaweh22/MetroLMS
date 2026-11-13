# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 16 — In-Person Attendance

> **Document Title:** Domain 16 — In-Person Attendance Business Rules  
> **Document Identifier:** `METROLMS-DOM-OPS-016`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../architecture/decision-register.md#d-01), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern cycle-scoped attendance log preservation across training group renewals (`D-GRP-04`), user deletion cascades (`D-01`), and future in-person / blended session attendance tracking for Cairo Metro cohorts.
- **Domain Boundaries:**
  - *In Scope:* Cycle-scoped historical attendance immutability (`D-GRP-04`), user deletion cascade cleanup (`D-01`), group meeting resource separation (`GroupMeetingsTab` vs. group config under `assistant-admin-default-approval.test.ts` Test 28), and identification of unimplemented physical attendance gaps.
  - *Out of Scope:* Online course lesson playback telemetry (Domain 14) and progress percentage rounding (Domain 13).
- **Core Entities:** `TrainingGroup`, `GroupRenewalCycle`, `GroupResource` (online meetings); *proposed future entity:* `InPersonAttendanceRecord` *(all persistence fields remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM16-01`** | **Cycle-Sealed Attendance Continuity (`D-GRP-04`)** | Any attendance records associated with a closed `GroupRenewalCycle` remain sealed and immutable when in-place renewal advances `group.currentCycleId`. | Renewal Pipeline (`LLD-003`) |
| **`INV-DOM16-02`** | **User Deletion Cascade (`D-01`)** | Permanently deleting a trainee (`DELETE /api/admin/users/:id`) removes personal attendance/enrollment records while preserving immutable security audit logs. | User Deletion Service |
| **`INV-DOM16-03`** | **Group Config vs. Meeting Resource Separation** | Mutating group configuration (`groups.edit_config`) strips `resources` and rejects mixed config + meeting resource payloads (`400 Bad Request`); meeting resources (`GroupMeetingsTab`) are governed as separate resources. | Group Update Guard (`MFR-44`) |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `D-GRP-04` requires attendance logs to remain sealed per `GroupRenewalCycle`; `D-01` requires permanent user deletion cleanup; `D-GRP-07` preserves historical records on group archival.
- **Current Prototype Behavior:** `frontend/src/` implements `GroupMeetingsTab.tsx` and `meetingUtils.ts` (`teams`, `zoom`, `meet`, `other` link detection on `TrainingGroup.resources`), tested in `group-meetings-platform-autodetect.test.tsx`. **No physical in-person attendance roster, check-in, present/absent/excused state machine, or attendance API endpoint exists in `frontend/src/` or `mocks/`.**
- **Implementation Gap:** Physical in-person attendance capture (session scheduling, check-in statuses, instructor/supervisor marking) is **not implemented** in the frontend prototype.
- **Target Backend Behavior:** Preserve cycle-scoped historical immutability (`D-GRP-04`) and `D-01` deletion cascade; any physical attendance capture model/API awaits explicit Phase 5/12 Owner specification.
- **Deferred / Provisional Notice:** All future attendance record fields remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM16-01`, `INV-DOM16-02` | [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04), [`D-01`](../../architecture/decision-register.md#d-01) | [`METROLMS-TECH-DOM-016`](../../03-technical-documentation/domains/operations/domain-16-in-person-attendance.md) | `group-meetings-platform-autodetect.test.tsx` (online links); physical attendance `NO IMPLEMENTATION` |
| `INV-DOM16-03` | `MFR-44` | [`METROLMS-TECH-DOM-016`](../../03-technical-documentation/domains/operations/domain-16-in-person-attendance.md) | `assistant-admin-default-approval.test.ts` (Test 28) |

