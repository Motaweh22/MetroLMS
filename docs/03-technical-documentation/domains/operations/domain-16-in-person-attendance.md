# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 16 — In-Person Attendance

> **Document Title:** Technical Domain Specification — In-Person Attendance  
> **Document Identifier:** `METROLMS-TECH-DOM-016`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../../architecture/decision-register.md#d-01), [`D-GRP-04`](../../../architecture/decision-register.md#d-grp-04), `MFR-44`  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `GroupMeetingsTab.tsx`, `meetingUtils.ts` (`detectMeetingPlatform` for `teams`, `zoom`, `meet`, `other`), `TrainingGroup.resources` (`GroupResource`).
- **Implementation Status Gap:** Physical in-person attendance (session check-in, present/absent/excused statuses, attendance API endpoints) is **not implemented** in `frontend/src/` or `mocks/`.
- **Target Backend Components (Django 5 + DRF — Proposed):** Separate meeting-resource endpoints vs. group config endpoints; future physical attendance module contingent on Phase 5/12 Owner specification.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Meeting Resource vs. Group Config Boundary (`MFR-44`):**
   - `PUT /api/admin/groups/:groupId` strips `resources` under `groups.edit_config` and rejects mixed config + resources payloads with `400 Bad Request` (`assistant-admin-default-approval.test.ts` Test 28).
2. **Cycle-Scoped Historical Continuity (`D-GRP-04`):**
   - When renewal closes a `GroupRenewalCycle`, historical attendance/session records bound to that cycle become immutable.
3. **User Deletion Cascade (`D-01`):**
   - Deleting a user permanently removes personal attendance records while preserving security audit logs.

---

## 3. Validation, Authorization & Failure Scenarios

- **Provisional Persistence Notice:** Any future physical attendance tables/fields remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-OPS-016`](../../../01-requirements/domains/domain-16-in-person-attendance.md)
- **Verification Evidence:** `group-meetings-platform-autodetect.test.tsx`, `assistant-admin-default-approval.test.ts` (Test 28); physical attendance `NO IMPLEMENTATION`.

