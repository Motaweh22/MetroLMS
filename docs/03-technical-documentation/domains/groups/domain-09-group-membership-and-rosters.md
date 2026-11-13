# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 09 — Group Membership & Trainee Rosters

> **Document Title:** Technical Domain Specification — Group Membership & Trainee Rosters  
> **Document Identifier:** `METROLMS-TECH-DOM-009`  
> **Document Status:** `APPROVED — PHASE 2B BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-07`](../../../architecture/decision-register.md#d-07), [`D-GRP-04`](../../../architecture/decision-register.md#d-grp-04), [`D-GRP-07`](../../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-12 (Phase 2B Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:** Admin group roster manager, trainee assignment modal, and `D-07` trainee removal modal (per-course Keep vs. Revoke selection).
- **Target Backend Components (Django 5 + DRF):** Roster membership endpoints (`addGroupMembers`, `removeGroupMember`), `traineeCount` projection, and multi-source enrollment grant converter (`D-07`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Authoritative Roster Count Projection:**
   - `traineeCount` is computed exclusively as `group.traineeIds.length`.
   - `primaryInstructorId`, `assistantLecturerIds`, and `supervisorIds` are persisted in dedicated staff relations and excluded from `traineeIds`.
2. **Group Member Removal (`removeGroupMember` + `D-07`):**
   - **Current Frontend Prototype Contract (`DELETE /api/admin/groups/:groupId/members/:userId`):** `groupsApi.removeGroupMember(groupId, userId, removeCourseIds?)` and `inMemoryStore.removeGroupMember(groupId, traineeId, removeCourseIds?)` accept an optional `removeCourseIds?: string[]` array of courses to revoke.
   - **Backward-Compatible Default (Prototype & Tested Behavior):** When `removeCourseIds` is omitted (`undefined`), all group courses are retained as standalone continuation grants (`group-member-removal-domain.test.ts` Test 19).
   - **Approved Business Behavior (`D-07`):** In the admin UI (`GroupMembersTab.tsx`), the administrator makes an explicit per-course keep vs. revoke choice.
   - For kept courses (not in `removeCourseIds`): converts the group grant into a standalone grant with `kind: 'self'` and `sourceId: 'self:continued:${groupId}:${attemptId}'` on the existing `attemptId`, lifting the group deadline and isolating the grant from `S1`.
   - For revoked courses (in `removeCourseIds`): removes `groupId` from `sourceGroupIds`; if `direct === false` and `sourceGroupIds.length === 0`, transitions enrollment status to `'Inactive'` / `'RevokedByGroupRemoval'` while preserving historical `LessonProgress`, `QuizAttempt`, and `Certificate` rows.
   - Immediately removes `traineeId` from `group.traineeIds` and `groupMembers[group.id]`, decrementing `traineeCount` immediately.

---

## 3. Validation, Authorization & Failure Scenarios

- **Cycle Snapshot Integrity:** Historical `GroupRenewalCycle.traineeIds` arrays remain immutable after cycle completion (`D-GRP-04`), unaffected by later `removeGroupMember` calls.
- **Role Boundaries:** Trainees cannot add/remove group members (`403 Forbidden`); `assistant_admin` mutations requiring approval follow `INV-R9` / `INV-R10`.
- **Failure Scenarios:** Passing invalid or non-group course IDs in `removeCourseIds` fails atomically with `422` / `400` without partial mutation. *(Note: Requiring an explicit `courseDecisions` map instead of optional `removeCourseIds` is a proposed Target Backend improvement pending Owner approval, not current behavior.)*

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-GRP-009`](../../../01-requirements/domains/domain-09-group-membership-and-rosters.md)
- **Authoritative Spec:** [`domain-business-rules.md §5 & §10`](../../../requirements/domain-business-rules.md)
- **Verification Gate:** Phase 4 (`Gate B`) runtime & contract suite.

