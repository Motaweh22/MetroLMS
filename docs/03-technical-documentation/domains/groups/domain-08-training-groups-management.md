# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 08 — Training Groups Management

> **Document Title:** Technical Domain Specification — Training Groups Management  
> **Document Identifier:** `METROLMS-TECH-DOM-008`  
> **Document Status:** `APPROVED — PHASE 2B BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-GRP-01`](../../../architecture/decision-register.md#d-grp-01), [`D-GRP-03`](../../../architecture/decision-register.md#d-grp-03), [`D-GRP-05`](../../../architecture/decision-register.md#d-grp-05), [`D-GRP-06`](../../../architecture/decision-register.md#d-grp-06), [`D-GRP-07`](../../../architecture/decision-register.md#d-grp-07), [`D-GRP-08`](../../../architecture/decision-register.md#d-grp-08), `API-REC-02a`/`02b`/`02c` (`OWNER APPROVED — RETAIN`, `2026-11-13`)  
> **Last Updated:** 2026-11-13 (Owner Decision Recording: Option A — Auto-Renewal Deactivation on End-Date Removal)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:** Trainee Groups dashboard (`TrainingGroupsCarousel`, summary cards, detailed data table, and `/my-groups/:id` detail loader) plus Admin group management forms/tables.
- **Target Backend Components (Django 5 + DRF):** `TrainingGroup` service/selectors exposing `GET /api/groups/my` (`TraineeGroupItemDTO[]`), admin group CRUD/archive endpoints, and domain resolvers matching existing prototype functions (`resolveGroupType`, `resolveGroupOperationalStatus`, `calculateGroupTimeInfo`, `formatGroupTimeInfoAr` in `frontend/src/core/groups/resolvers.ts`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Trainee Groups Endpoint (`GET /api/groups/my`):**
   - Queries groups where `actor.id IN group.traineeIds` AND `adminStatus !== 'archived'` (`D-GRP-07`).
   - Projects `TraineeGroupItemDTO` (`id`, `enrollmentCode`, `name`, `description`, `groupType`, `operationalStatus`, `traineeCount`, `startDateTime`, `deadlineDateTime`, `postDeadlinePolicy`, `renewalSchedule`, `currentCycle`, `courses`, `timeInfo`, `navigationUrl`).
   - Deliberately omits unestablished derived fields (`myProgress`, `needsAttention`, `attentionReason`, `attentionLevel`).
2. **Group Type & Monotonic Flag (`D-GRP-03`, `D-GRP-06`):**
   - Assigning a course with `courseRole === 'reminder'` sets `hasHistoricalReminderCourses = true` (write-once).
   - `resolveGroupType` returns `'reminder'` if `hasHistoricalReminderCourses === true` or any current/cycle course has `courseRole === 'reminder'`.
3. **Deterministic Carousel Sorting & Presentation (`D-GRP-05`, `D-GRP-08`):**
   - Tier 1 (`active` by nearest `deadlineDateTime` asc) -> Tier 2 (`scheduled` by nearest `startDateTime` asc) -> Tier 3 (`expired` by `deadlineDateTime` desc) -> tie-breaker Arabic `name` asc, then `id` asc.
   - Carousel displays compact course codes/pills; detailed table and details page render full course titles with `مقرر تذكيري` / `دورة أساسية` badges alongside group-level `برنامج تذكيري`.
4. **Group Assistant Management Contract (`API-REC-02a`–`02c` — `OWNER APPROVED — RETAIN`, `2026-11-13`):**
   - **`GET /api/groups/:groupId/assistants` (`API-REC-02a`):** Read assistant roster for the group. Permitted (`200`) for administrative readers (`developer`, `super_admin`, `admin`, `assistant_admin`), assigned group supervisors/instructors, and enrolled group trainees; `401` unauthenticated; `403` unassigned users.
   - **`POST /api/groups/:groupId/assistants` (`API-REC-02b`):** Individual addition (`{ assistantLecturerId: string }`, candidate must have canonical role `'lecturer'`) without replacing existing assistants (`201 Created`). Permitted only for `developer`, `super_admin`, `admin`, or the group's primary instructor (`403` for `assistant_admin` without delegation, trainees, or unassigned lecturers).
   - **`DELETE /api/groups/:groupId/assistants/:lecturerId` (`API-REC-02c`):** Remove one assistant's group-specific assignment only (`200` / `404` if absent; never deletes the lecturer's system account or affects other groups). Same mutation authorization as `POST`.

---

## 3. Validation, Authorization & Failure Scenarios

- **Archived Group Route Guard (`D-GRP-07`):** Direct trainee navigation or API request to `/my-groups/:id` for an archived group fails closed (`404 Not Found` / `Access Denied`) without leaking archived group metadata.
- **No-End-Date Ongoing Group Support (`INV-DOM08-07`, `INV-DOM10-09`):** `resolveGroupOperationalStatus` (`frontend/src/core/groups/resolvers.ts`) returns `'active'` when `deadlineDateTime` is absent rather than treating the group as `'expired'` or `'completed'`. Target Django validation MUST allow groups without an end date to be created and operated as ongoing non-expiring groups (without fabricating an artificial end date), display a confirmation warning before removing `deadlineDateTime` when `groupType === 'reminder' && autoRenewalEnabled === true` (*Cancel* keeps both unchanged; *Confirm* removes `deadlineDateTime`, sets `autoRenewalEnabled = false`, and **preserves `groupType === 'reminder'`** per Option A — `OWNER APPROVED`, `2026-11-13`), and prohibit automatic or manual renewal unless a valid end date is defined (Domain 10 / Domain 20). *(Prototype Discrepancy: `GroupEditorPage.tsx` currently enforces a client-side required check on `deadlineDateTime` and does not yet implement the confirmation dialog.)*
- **Role Boundaries:** Only `super_admin` (`Superior`, inheriting all `admin` capabilities per `OD-01` and Owner Clarification `2026-11-13`) and `admin` (plus `assistant_admin` within `Rule A` / `INV-R9` approval boundaries) mutate group definitions or `adminStatus`. Active / Unsealed Group Renewal Cycle media Content Reference management uses the dedicated `materials.manage_references` permission (`INV-DOM21-21` — `OWNER APPROVED`, `2026-11-13`), separate from `materials.upload_files`, `materials.delete_files`, and `materials.manage_folders`, with default role grants, capability-ceiling placement, `assistant_admin` `INV-R9` applicability, and `supervisorIds` mutation boundaries remaining unresolved.
- **Integration Boundaries & Constraints:** Post-deadline course visibility (`hide` vs. `keep_no_cert`) is enforced in Phase 3 enrollment/course access domains; this domain provides `postDeadlinePolicy` and `operationalStatus`.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-GRP-008`](../../../01-requirements/domains/domain-08-training-groups-management.md)
- **Authoritative Spec:** [`reminder-programs-and-group-domain-specification.md`](../../../requirements/reminder-programs-and-group-domain-specification.md)
- **Verification Gate:** Phase 4 (`Gate B`) runtime & contract suite.

