# MetroLMS — Focused Authorization Investigation: `groups.manage_members`

> **Document Title:** Focused Authorization Investigation: `groups.manage_members` (`POST` & `DELETE /api/admin/groups/:groupId/members`)  
> **Document Identifier:** `METROLMS-INV-GRP-MEM-001`  
> **Document Status:** `INVESTIGATION & REMEDIATION DESIGN REPORT — OPEN FOR OWNER & ARCHITECTURE REVIEW`  
> **Investigation Date:** 2026-11-14  
> **Governing Decisions Preserved:** **Separation of Group Administration and Content Authorization (`OWNER APPROVED — 2026-11-14`)**, **Preserve Existing Group-Material Permission Grant Model (`OWNER APPROVED — 2026-11-14`)**, `INV-R7`, `INV-R9`, `INV-R10`, `INV-DOM03-02`, `INV-DOM17-01`, `INV-DOM21-21`, `API-REC-06` (`DEFERRED`)  
> **Governance Locks:** `A-03c` remains **OPEN** | `API-REC-06` remains **DEFERRED** | `materials.manage_references` runtime implementation remains **OUTSTANDING** | Phase 5 **NOT AUTHORIZED** | Database schema freeze **NOT AUTHORIZED**

---

## 1. Executive Summary

An evidence-based investigation of `POST /api/admin/groups/:groupId/members` and `DELETE /api/admin/groups/:groupId/members/:userId` in [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts), [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts), [`policy.ts`](../../../frontend/src/core/permissions/policy.ts), [`types.ts`](../../../frontend/src/core/permissions/types.ts), and [`authorization-and-permissions-design.md`](../../frontend/authorization-and-permissions-design.md) establishes that:

1. **Canonical Source of Authority (`Matches approved decision`):** `groups.manage_members` is a **distinct canonical capability** in [`types.ts`](../../../frontend/src/core/permissions/types.ts#L24) and [`policy.ts`](../../../frontend/src/core/permissions/policy.ts) (`ROLE_DEFAULT_CAPABILITIES`, `ROLE_CAPABILITY_CEILINGS`, `GROUP_SCOPED_CAPABILITIES`, and `ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES`). It is **not** an implicit assignment-only bypass without a capability check.
2. **Handler Bypass Defect (`Confirmed implementation defect` — `High`):** Both `POST /api/admin/groups/:groupId/members` (`groupHandlers.ts` line 655) and `DELETE /api/admin/groups/:groupId/members/:userId` (`groupHandlers.ts` line 740) call **only** `isAssignedSupervisor(user, group)` and **completely bypass** `requireCapabilityOrApproval(user, 'groups.manage_members', ...)` and `evaluatePermission`.
3. **Three Direct Consequences:**
   - `UserPermissionOverride` revocations of `groups.manage_members` are **ignored** on `POST` and `DELETE`.
   - `assistant_admin` is **unconditionally denied (`403`)** on `POST` and `DELETE`, breaking `INV-R9` (`202 Accepted` approval workflow) and ignoring valid `DelegatedAuthority` grants — even though `inMemoryStore.hasPermission`, `approveApprovalRequest`, and `assistant-admin-default-approval.test.ts` / `approval-lifecycle-execution.test.ts` already implement and test `groups.manage_members` delegation and approval execution.
   - `supervisorIds`-only users **pass** `isAssignedSupervisor` (`inMemoryStore.ts` lines 9205–9212), violating `INV-DOM17-01` (monitoring-only).
4. **Test Blind Spot (`Confirmed documentation gap` / `Confirmed implementation defect`):** API tests ([`training-groups-api.test.tsx`](../../../frontend/src/test/training-groups-api.test.tsx#L357-L415)) only exercise `POST` and `DELETE` as `adminUser`, while approval/delegation tests test `inMemoryStore.hasPermission` / `approveApprovalRequest` directly rather than calling the MSW `/members` handlers.

---

## 2. Owner Decision Context

This investigation preserves the **2026-11-14 Owner Decision (Separation of Group Administration and Content Authorization — `OWNER APPROVED`)**:
1. Group assignment may provide specific group-administration authority according to the existing authorization model.
2. Adding or removing group members is group administration (`groups.manage_members`), **separate** from content-management permissions (`materials.upload_files`, `materials.delete_files`, `materials.manage_folders`, `materials.manage_references`).
3. Group assignment does **not** automatically grant content-management permissions, and `supervisorIds` remains monitoring-only under `INV-DOM17-01`.
4. Existing role privileges must not be expanded or reduced without Owner approval; `INV-R7`, `INV-R9`, `INV-R10`, `INV-DOM03-02`, `INV-DOM17-01`, and `INV-DOM21-21` remain binding.

---

## 3. Current `POST` Authorization Call Chain

**Endpoint:** `POST /api/admin/groups/:groupId/members` ([`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts#L637-L697))
1. **Route Registration & Handler Entry:** Line 637 (`http.post('/api/admin/groups/:groupId/members', ...)`).
2. **Authentication:** `resolveAuthenticatedUser(request)` (line 638; [`resolveUser.ts`](../../../frontend/src/mocks/handlers/resolveUser.ts#L310-L406)); returns `401` if `null` (lines 639–643).
3. **Group Ownership Lookup:** `inMemoryStore.getGroupById(groupId)` (line 647); returns `404` if missing (lines 648–652).
4. **Authorization Check:** `if (!isAssignedSupervisor(user, group))` (line 655) -> returns `403` (lines 656–659).
   - **No call** to `requireCapabilityOrApproval(user, 'groups.manage_members', ...)`.
   - **No call** to `evaluatePermission` or `inMemoryStore.hasPermission`.
   - **No approval (`INV-R9`) or `DelegatedAuthority` check.**
5. **Input Validation:** Parses `AddGroupMembersRequestDTO & { traineeId?: string }` (lines 663–669); returns `400` if `traineeIds.length === 0`.
6. **Direct Role Check in Mutation Metadata:** Line 674 sets `joinSource = user.role === 'admin' ? 'admin_assigned' : 'supervisor_assigned'` (note: `super_admin` and `developer` are labeled `'supervisor_assigned'`).
7. **Mutation Execution:** Loops over `traineeIds`, calling `inMemoryStore.addGroupMember(groupId, tid, joinSource)` (line 677; [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L7043-L7130)). Enforces `maxTrainees` capacity (`409` at `inMemoryStore.ts` lines 7056–7062), handles idempotent already-member (`alreadyMember: true` at lines 7069–7080), and provisions `CourseAttempt`s (`D-06`), **without** validating whether `tid` is an active trainee (`user`) account.
8. **Audit Logging:** **None** in `groupHandlers.ts` or `addGroupMember`.
9. **Response:** `200 OK` `{ addedCount, alreadyMemberCount, members }` (lines 686–693), or `handleStoreError(err)` (`404`/`409`).

---

## 4. Current `DELETE` Authorization Call Chain

**Endpoint:** `DELETE /api/admin/groups/:groupId/members/:userId` ([`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts#L721-L760))
1. **Route Registration & Handler Entry:** Line 721 (`http.delete('/api/admin/groups/:groupId/members/:userId', ...)`).
2. **Authentication:** `resolveAuthenticatedUser(request)` (line 722); returns `401` if `null` (lines 723–727).
3. **Group Ownership Lookup:** `inMemoryStore.getGroupById(groupId)` (line 732); returns `404` if missing (lines 733–737).
4. **Authorization Check:** `if (!isAssignedSupervisor(user, group))` (line 740) -> returns `403` (lines 741–744).
   - **No call** to `requireCapabilityOrApproval(user, 'groups.manage_members', ...)`.
   - **No call** to `evaluatePermission`, `INV-R9`, or `DelegatedAuthority`.
5. **Target-Member & Group Validation:** `inMemoryStore.removeGroupMember(groupId, targetUserId, removeCourseIds)` (line 757; [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L7206-L7275)) checks `group` (`404`), validates membership in `group.traineeIds` / `groupMembers[group.id]` or prior group provenance (`404` if neither at lines 7243–7245), handles idempotent retry (lines 7247–7253), and preserves historical enrollments/attempts (`D-07`).
6. **Audit Logging:** **None** in `groupHandlers.ts` or `removeGroupMember`.
7. **Response:** `200 OK` `{ success: true, message }` (line 758), or `handleStoreError(err)` (`404`).

---

## 5. Canonical `groups.manage_members` Definition and Grant Source

| Canonical Layer | Evidence & Line Reference | Status |
| :--- | :--- | :--- |
| **`SystemCapability` Type** | [`types.ts`](../../../frontend/src/core/permissions/types.ts#L24): `'groups.manage_members'` | **Canonical** |
| **`ROLE_DEFAULT_CAPABILITIES`** | [`policy.ts`](../../../frontend/src/core/permissions/policy.ts): `developer` (`true`, L32), `super_admin` (`true`, L87), `admin` (`true`, L142), `assistant_admin` (`true`, L197), `lecturer` (`true` `// Assigned groups only`, L252), `user` (`false`, L307) | **Canonical** |
| **`ROLE_CAPABILITY_CEILINGS`** | [`policy.ts`](../../../frontend/src/core/permissions/policy.ts): included in `lecturer` (L369), `assistant_admin` (L404), `admin` (L445), `super_admin` (L488), `developer` (L531); excluded from `user` | **Canonical** |
| **`GROUP_SCOPED_CAPABILITIES`** | [`policy.ts`](../../../frontend/src/core/permissions/policy.ts#L689): `'groups.manage_members'` (enforces assignment check for `lecturer` at L1425–1452) | **Canonical** |
| **`ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES`** | [`policy.ts`](../../../frontend/src/core/permissions/policy.ts#L597): `'groups.manage_members'` (defaults `assistant_admin` to `202 Accepted` at L1461–1473 unless exact-capability + group-scoped `DelegatedAuthority` applies) | **Canonical** |
| **`UserPermissionOverride`** | [`policy.ts`](../../../frontend/src/core/permissions/policy.ts#L1379-L1396): `revoked` overrides defaults; `granted` bounded by `ROLE_CAPABILITY_CEILINGS` | **Canonical** |
| **`GroupAssistantAssignment` & `primaryInstructorId`** | `primaryInstructorId` & `GroupAssistantAssignment` establish **which group** a `lecturer` may manage (`GROUP_SCOPED_CAPABILITIES`); `lecturer` also holds `groups.manage_members: true` by default (unless revoked). *(Note: [`authorization-and-permissions-design.md`](../../frontend/authorization-and-permissions-design.md#L101) lists `groups.manage_members` under `lecturer` ceiling, while §7.2 L217–222 omits it from the bullet list — `Confirmed documentation gap`.)* | **Canonical + Doc Gap** |
| **`isAssignedSupervisor` in `groupHandlers.ts`** | [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts#L62-L68) + [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L9175-L9216): legacy/shortcut contextual check used *instead of* `requireCapabilityOrApproval` on `/members` | **Confirmed defect** |

**Classification:** `groups.manage_members` is **Case A + D**: a distinct canonical capability required through `evaluatePermission`, whose effective scope differs by role/assignment (org-wide for `developer`/`super_admin`/`admin`, `INV-R7` + `INV-R9` for `assistant_admin`, and `GROUP_SCOPED_CAPABILITIES` for assigned `lecturer`). Group assignment establishes **group scope**, not an exemption from `groups.manage_members` or `INV-R9`.

---

## 6. `isAssignedSupervisor` vs. `requireCapabilityOrApproval` Comparison & Explicit Answers

1. **Does `isAssignedSupervisor` authorize adding or removing group members independently?** **Yes, in the current handler code** (`groupHandlers.ts` lines 655, 740) — it returns `true` for `developer`/`super_admin`/`admin` and assigned `lecturer`s without checking `groups.manage_members` or `UserPermissionOverride`.
2. **Is that behavior intentional and supported by an approved decision?** **No (`Confirmed implementation defect`).** Canonical `policy.ts` defines `groups.manage_members` in `ROLE_DEFAULT_CAPABILITIES`, `ROLE_CAPABILITY_CEILINGS`, `GROUP_SCOPED_CAPABILITIES`, and `ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES`, and `inMemoryStore.approveApprovalRequest` executes `groups.manage_members` approvals (`approval-lifecycle-execution.test.ts` line 549).
3. **Does `requireCapabilityOrApproval('groups.manage_members')` enforce an independent permission requirement?** **Yes** (`routeGuards.ts` lines 40–104 -> `inMemoryStore.hasPermission` -> `evaluatePermission`): it checks invariants, capability ceilings, `UserPermissionOverride` revocations/grants, role defaults, `GROUP_SCOPED_CAPABILITIES` (for `lecturer` when `targetGroupId` is supplied), and `INV-R9` / `DelegatedAuthority` (for `assistant_admin`).
4. **If both mechanisms are required, what distinct responsibility does each provide?** `requireCapabilityOrApproval('groups.manage_members', ...)` enforces capability, override, ceiling, and `INV-R9`/`DelegatedAuthority` policy; contextual assignment checks (`primaryInstructorId` + `GroupAssistantAssignment` for `lecturer`, `INV-R7` `GroupAssistantAssignment` for `assistant_admin`, **excluding** `supervisorIds`-only) enforce group scope.
5. **If assignment itself is the canonical source, how is it represented?** Assignment is **not** the sole source — it satisfies the **group-scope dimension** (`GROUP_SCOPED_CAPABILITIES` / `INV-R7`) alongside the `groups.manage_members` capability.
6. **Can a `supervisorIds`-only user currently add or remove members?** **Yes (`Confirmed implementation defect`)** via `inMemoryStore.ts` lines 9205–9212 (`isUserAssignedGroupSupervisor`) and `inMemoryStore.ts` line 11287 (`hasPermission`), violating `INV-DOM17-01`.
7. **Can a user with an explicit permission revocation still add or remove members?** **Yes (`Confirmed implementation defect`)** because `groupHandlers.ts` lines 655 and 740 never call `evaluatePermission` / `requireCapabilityOrApproval`, completely ignoring `UserPermissionOverride.revoked`.
8. **Are Assistant Admin approval and delegation rules relevant?** **Yes.** `groups.manage_members` is in `ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES` (`policy.ts` line 597). Under `INV-R7` + `INV-R9`, an assigned `assistant_admin` must receive `202 Accepted` (`PendingApprovalRequest`) unless an active, non-expired, exact-capability (`groups.manage_members`) and `groupId`-scoped `DelegatedAuthority` applies.

---

## 7. Effective Authorization Matrix (`POST` & `DELETE /api/admin/groups/:groupId/members`)

*(Both `POST` and `DELETE` share the exact same authorization gate in `groupHandlers.ts` lines 655 and 740; their only behavioral difference is mutation/validation in `inMemoryStore.ts`.)*

| Role / Assignment | Actual Current Runtime (`POST` & `DELETE`) | Canonical Target Policy (`policy.ts` + `INV-R7`/`R9`/`DOM17-01`) |
| :--- | :--- | :--- |
| **`developer`** | **Allowed directly** (`isOperationalGroupAdmin` -> `true`). | **Allowed directly** (`INV-DOM03-02` Visual Role Preview barrier applies). |
| **`super_admin` / `Superior`** | **Allowed directly** (ignores `UserPermissionOverride.revoked`). | **Allowed directly** unless **Denied by individual revocation** (`UserPermissionOverride`). |
| **`admin`** | **Allowed directly** (ignores `UserPermissionOverride.revoked`). | **Allowed directly** unless **Denied by individual revocation** (`UserPermissionOverride`). |
| **`assistant_admin`** | **Denied (`403`)** (`isAssignedSupervisor` returns `false` — ignores `INV-R7`, `INV-R9`, and valid `DelegatedAuthority`). | **Denied because group assignment is missing** if unassigned (`INV-R7`); if assigned (`INV-R7`), **Allowed after approval (`INV-R9` `202`)** or **Allowed under valid `DelegatedAuthority`** (`groups.manage_members` + matching `groupId`); **Denied by individual revocation** if revoked. |
| **`lecturer` (`primaryInstructorId`)** | **Allowed directly** (ignores `UserPermissionOverride.revoked`). | **Allowed directly** for assigned group unless **Denied by individual revocation**; **Denied because group assignment is missing** on other groups. |
| **`lecturer` (`GroupAssistantAssignment`)** | **Allowed directly** (ignores `UserPermissionOverride.revoked`). | **Allowed directly** for active `GroupAssistantAssignment` unless **Denied by individual revocation**. |
| **Users only in `supervisorIds`** | **Allowed directly (`Confirmed defect`)** via `inMemoryStore.ts` L9205–9212. | **Denied by explicit invariant (`INV-DOM17-01`)** — monitoring-only unless holding separate `primaryInstructorId` or `GroupAssistantAssignment`. |
| **`user` / `trainee`** | **Denied (`403`)**. | **Denied by role/capability ceiling** (`policy.ts` lines 307, 356–360). |

---

## 8. Role and Assignment Analysis

- **Org-Wide Admins (`developer`, `super_admin`, `admin`):** Retain org-wide group membership authority via `groups.manage_members: true` (`policy.ts` lines 32, 87, 142), subject to `UserPermissionOverride.revoked` (for `admin`/`super_admin`) and `INV-DOM03-02` (for `developer` Visual Role Preview).
- **Assistant Admin (`assistant_admin`):** `INV-R7` restricts writes to assigned groups (`GroupAssistantAssignment`), and `INV-R9` (`policy.ts` lines 597, 1461–1473) requires `202 Accepted` approval unless exact-capability + `groupId`-scoped `DelegatedAuthority` is active. Currently blocked with `403` in `groupHandlers.ts`.
- **Lecturers (`primaryInstructorId` & `GroupAssistantAssignment`):** Hold `groups.manage_members: true` by default scoped by `GROUP_SCOPED_CAPABILITIES` (line 689). Must be denied on unassigned groups and denied if individually revoked.
- **Supervisors (`supervisorIds`-only):** Monitoring-only under `INV-DOM17-01`; must never grant `POST`/`DELETE /members` mutation access.

---

## 9. Test and MSW Coverage

- **Verified Coverage:**
  - [`training-groups-api.test.tsx`](../../../frontend/src/test/training-groups-api.test.tsx#L357-L415): Tests `addGroupMembers` (`200`, idempotency, `409` `maxTrainees`) and `removeGroupMember` (`200`, `D-07` enrollment preservation) **as `adminUser` only**.
  - [`assistant-admin-default-approval.test.ts`](../../../frontend/src/test/assistant-admin-default-approval.test.ts#L238-L263): Tests `inMemoryStore.hasPermission(assistantUser, 'groups.manage_members', ...)` directly (delegation matching/mismatched/missing `groupId`), **not** via MSW HTTP `/members` handlers.
  - [`approval-lifecycle-execution.test.ts`](../../../frontend/src/test/approval-lifecycle-execution.test.ts#L549-L555): Tests `approveApprovalRequest` for `actionType: 'groups.manage_members'` directly, **not** via `groupHandlers.ts`.
- **All 11 Missing Handler-Level Scenarios:**
  1. Assigned `lecturer` without explicit override (default `groups.manage_members: true` through HTTP handler).
  2. Assigned `lecturer` with explicit `UserPermissionOverride.revoked` (`403` expected; currently succeeds `200`).
  3. `supervisorIds`-only `lecturer` (`403` expected per `INV-DOM17-01`; currently succeeds `200`).
  4. `GroupAssistantAssignment` `lecturer` through HTTP `POST`/`DELETE`.
  5. `assistant_admin` assigned to target group (`202` expected; currently `403`).
  6. `assistant_admin` with valid exact-capability + `groupId`-scoped `DelegatedAuthority` (`200` expected; currently `403`).
  7. `assistant_admin` without valid delegation / wrong `groupId` (`202` if assigned, `403` if unassigned).
  8. `lecturer` / `assistant_admin` assigned to a different group (`403`).
  9. Cross-group / invalid target-member identifier attempts (`POST` currently does not validate trainee role/existence).
  10. `admin` and `super_admin` with `UserPermissionOverride.revoked` (`403` expected; currently `200`).
  11. `developer` Visual Role Preview mutation barrier (`INV-DOM03-02`) on `/members` endpoints.

---

## 10. Documentation vs. Runtime Reconciliation

| Item | Classification | Evidence |
| :--- | :--- | :--- |
| `groups.manage_members` defined in `types.ts` & `policy.ts` | **Matches approved decision** | `types.ts` L24; `policy.ts` L32, 87, 142, 197, 252, 307, 597, 689 |
| `POST`/`DELETE /members` calling `isAssignedSupervisor` only | **Confirmed implementation defect** | `groupHandlers.ts` lines 655, 740 |
| `supervisorIds` granting access in `isUserAssignedGroupSupervisor` & `hasPermission` | **Confirmed implementation defect** | `inMemoryStore.ts` lines 9205–9212, 11287; `policy.ts` line 1427 |
| `authorization-and-permissions-design.md` §7.2 omitting `groups.manage_members` from `GroupAssistantAssignment` bullets | **Confirmed documentation gap** | `authorization-and-permissions-design.md` §4.2 L101 vs. §7.2 L217–222 |
| `POST /members` `joinSource` & missing trainee-role validation + missing audit logs | **Potential risk requiring verification** | `groupHandlers.ts` line 674; `inMemoryStore.ts` lines 7043–7130 |

---

## 11. Confirmed Defects and Potential Risks

1. **`Confirmed implementation defect` (`High`):** `groupHandlers.ts` lines 655 & 740 bypass `requireCapabilityOrApproval('groups.manage_members', ...)` — breaks `INV-R9`, ignores `DelegatedAuthority`, and ignores `UserPermissionOverride.revoked`.
2. **`Confirmed implementation defect` (`High`):** `inMemoryStore.ts` lines 9205–9212 & 11287 and `policy.ts` line 1427 allow `supervisorIds`-only users to pass group write checks, violating `INV-DOM17-01`.
3. **`Confirmed implementation defect` (`Medium`):** `inMemoryStore.hasPermission` / `evaluatePermission` does not enforce `INV-R7` (`GroupAssistantAssignment`) for `assistant_admin` inside `policy.ts` step 5 (line 1425 checks `actor.role === 'lecturer'` only).
4. **`Potential risk requiring verification` (`Medium`):** `groupHandlers.ts` `POST /members` does not validate that `traineeIds` are active `'user'` accounts, labels `super_admin`/`developer` as `'supervisor_assigned'` (line 674), and emits no audit log.
5. **`Deferred backend work`:** Django / DRF + SQL Server enforcement of `groups.manage_members` + `INV-R7` + `INV-R9` + `INV-DOM17-01` + audit logging.

---

## 12. Unresolved Owner Decisions

No new Owner decision is required for `groups.manage_members` default role grants (`policy.ts` already defines them and `2026-11-14` Separation Principle preserves them). Only **minor documentation/implementation clarifications** remain if needed during remediation:
- Confirm whether [`authorization-and-permissions-design.md`](../../frontend/authorization-and-permissions-design.md#L217-L222) §7.2 should explicitly list `groups.manage_members` alongside `materials.*` for `GroupAssistantAssignment` (matching §4.2 line 101 and `policy.ts` line 252/689).

---

## 13. Recommended Remediation Design (`NOT AUTHORIZED FOR IMPLEMENTATION`)

1. **Authority Source:** Enforce `requireCapabilityOrApproval(user, 'groups.manage_members', { context: { targetGroupId: groupId }, ... })` on both `POST /api/admin/groups/:groupId/members` and `DELETE /api/admin/groups/:groupId/members/:userId`.
2. **Group-Scope Separation (`INV-DOM17-01` + `INV-R7`):**
   - For `developer`/`super_admin`/`admin`: org-wide scope (`INV-DOM03-02` preview barrier preserved).
   - For `assistant_admin`: enforce `INV-R7` (`GroupAssistantAssignment` for `groupId`) **and** `INV-R9` (`202 Accepted` unless valid exact-capability `groups.manage_members` + `groupId`-scoped `DelegatedAuthority` is active).
   - For `lecturer`: enforce `primaryInstructorId === user.id` or active `GroupAssistantAssignment` (`GROUP_SCOPED_CAPABILITIES`), **excluding** `supervisorIds`-only users (`INV-DOM17-01`).
3. **Individual Overrides:** `evaluatePermission` step 3 honors `UserPermissionOverride.revoked` / `granted` within `ROLE_CAPABILITY_CEILINGS`.
4. **Target-Member & Group Ownership:** Verify `groupId` exists (`404`), validate added `traineeIds` are eligible active trainee accounts, verify removed `userId` belongs to `groupId` (`removeGroupMember`), and record audit log entries.

---

## 14. Verification Results

- **Inspection Method:** Read-only inspection of `groupHandlers.ts`, `routeGuards.ts`, `resolveUser.ts`, `inMemoryStore.ts`, `policy.ts`, `types.ts`, `authorization-and-permissions-design.md`, and 4 test files; zero runtime, test, mock, backend, or schema files modified.
- **Governance Statuses Preserved:** `A-03c` (`OPEN`), `API-REC-06` (`DEFERRED`), `materials.manage_references` runtime implementation (`OUTSTANDING`), Phase 5 (`NOT AUTHORIZED`), Database schema freeze (`NOT AUTHORIZED`).

