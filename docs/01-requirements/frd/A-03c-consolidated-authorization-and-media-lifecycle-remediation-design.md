# MetroLMS — Consolidated Authorization & Media Lifecycle Remediation Design

> **Document Title:** Consolidated Authorization & Media Lifecycle Remediation Design (`A-03c`)  
> **Document Identifier:** `METROLMS-DES-A03C-001`  
> **Document Status:** `CONSOLIDATED REMEDIATION DESIGN — PENDING OWNER REVIEW (IMPLEMENTATION NOT AUTHORIZED)`  
> **Date:** 2026-11-14  
> **Consolidates:** [`A-03c-authorization-and-api-lifecycle-investigation-report.md`](A-03c-authorization-and-api-lifecycle-investigation-report.md), [`groups-manage-members-authorization-investigation-report.md`](groups-manage-members-authorization-investigation-report.md), [`FRD-MEDIA-001`](FRD-MEDIA-001-phase-1-media-architecture-requirements-baseline.md), [`authorization-and-permissions-design.md`](../../frontend/authorization-and-permissions-design.md), and [`CURRENT.md`](../../project-state/CURRENT.md)  
> **Governance Locks:** `A-03c` remains **OPEN** | `API-REC-06` remains **DEFERRED** | `materials.manage_references` runtime implementation remains **OUTSTANDING** | Phase 5 **NOT AUTHORIZED** | Database schema freeze **NOT AUTHORIZED**

---

## 1. Executive Summary

This document consolidates all verified findings from the `A-03c` and `groups.manage_members` investigations into one coherent, evidence-based remediation design. Across [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts), [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts), [`policy.ts`](../../../frontend/src/core/permissions/policy.ts), and [`types.ts`](../../../frontend/src/core/permissions/types.ts), the core defects stem from:
1. **Handler Bypass of Canonical Capability & Approval Guard (`Confirmed defect`):** `POST`/`DELETE /api/admin/groups/:groupId/members` (lines 655, 740), `PUT`/`DELETE` `/materials/folders/:folderId` (lines 1076, 1112), and `PUT`/`DELETE`/`PUT .../move`/`PATCH` `/materials/files/:fileId` (lines 1213, 1256, 1291, 1334) call `isAssignedSupervisor(user, group)` alone instead of `requireCapabilityOrApproval(...)`.
2. **`supervisorIds` Write Leak (`Confirmed defect`):** `isUserAssignedGroupSupervisor` (`inMemoryStore.ts` lines 9205–9212) and `hasPermission` (`inMemoryStore.ts` line 11287 -> `policy.ts` line 1427) grant write access to `supervisorIds`-only users, violating `INV-DOM17-01`.
3. **Cross-Group `fileId` IDOR (`Confirmed defect`):** `replaceMaterialFile`, `deleteMaterialFile`, `moveMaterialFile`, and `updateMaterialFile` (`inMemoryStore.ts` lines 9853–9990) look up `fileId` globally without verifying `file.groupId === groupId`.
4. **Media Lifecycle & Cycle-State Mismatches (`Confirmed defect`):** `PUT` mutates `originalFileName`, `fileSizeBytes`, and `mimeType` in place (`INV-DOM21-09`, `12`, `16`); `DELETE` physically removes `GroupMaterialFile` from memory (`INV-DOM21-17`, `18`); no handler enforces Active / Unsealed vs. Sealed / Closed `GroupRenewalCycle` state (`INV-DOM21-07`, `08`, `14`) or emits audit logs.

No runtime implementation, schema change, or API freeze is authorized by this document.

---

## 2. Scope and Evidence Sources

| Source | Verified Scope | Exact References |
| :--- | :--- | :--- |
| MSW Handlers | Group membership, folders, and material-file routes | [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts) L62–68, L637–760, L991–1348 |
| Route Guard & Auth | `requireCapabilityOrApproval`, `resolveAuthenticatedUser` | [`routeGuards.ts`](../../../frontend/src/mocks/handlers/utils/routeGuards.ts) L40–105; [`resolveUser.ts`](../../../frontend/src/mocks/handlers/resolveUser.ts) L310–406 |
| Store & Domain Logic | `add/removeGroupMember`, `isUserAssignedGroupSupervisor`, `add/replace/delete/move/updateMaterialFile`, `hasPermission`, `hasDelegatedCapability`, `approveApprovalRequest` | [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) L7043–7275, L9175–9216, L9780–9990, L11250–11301, L11822–11830, L12066–12130, L13175–13203 |
| Policy Engine & Types | `SystemCapability`, `ROLE_DEFAULT_CAPABILITIES`, `ROLE_CAPABILITY_CEILINGS`, `GROUP_SCOPED_CAPABILITIES`, `evaluatePermission` | [`types.ts`](../../../frontend/src/core/permissions/types.ts) L8–191; [`policy.ts`](../../../frontend/src/core/permissions/policy.ts) L17–755, L1298–1485 |
| Test Suites | API, store, approval, and notification tests | [`training-groups-api.test.tsx`](../../../frontend/src/test/training-groups-api.test.tsx) L357–415, L620–696; [`assistant-admin-default-approval.test.ts`](../../../frontend/src/test/assistant-admin-default-approval.test.ts) L238–263, L316–322; [`approval-lifecycle-execution.test.ts`](../../../frontend/src/test/approval-lifecycle-execution.test.ts) L549–555, L1322–1328 |

---

## 3. Owner-Approved Decisions (Preserved Baseline)

All of the following are **`Owner-approved requirement`** and must not be reopened or weakened:
1. **Separation of Group Administration and Content Authorization (`2026-11-14`):** Group assignment grants only the group-administration authority explicitly associated with that assignment; content operations additionally require the specific content capability plus applicable group/resource scope, approval/delegation, and lifecycle checks.
2. **Preserve Existing Group-Material Permission Grant Model (`2026-11-14`):** `materials.manage_references` preserves the exact existing grant, ceiling, `GROUP_SCOPED_CAPABILITIES`, `UserPermissionOverride`, `INV-R7`, `INV-R9`/`DelegatedAuthority`, and `INV-DOM17-01` model (`materials.upload_files`, `materials.delete_files`, `materials.manage_folders`).
3. **`INV-DOM21-21` (`2026-11-13`):** `materials.manage_references` covers (1) add group media Content Reference, (2) `INV-DOM21-18` Logical Detachment, (3) `INV-DOM21-12` Step 2 repointing, (4) reference-level `title`/`isVisible` updates — strictly within Active / Unsealed Group Renewal Cycles, separate from `materials.upload_files`, `materials.delete_files`, `materials.manage_folders`, and Draft-only `courses.edit_curriculum` (`INV-DOM21-20`).
4. **Media Lifecycle (`INV-DOM21-07`–`INV-DOM21-19`):** Published/Sealed immutability (`INV-DOM21-07`), Active/Unsealed mutability (`INV-DOM21-08`, `14`), new `assetId` for every binary replacement (`INV-DOM21-09`), Two-Step Upload & Repoint (`INV-DOM21-12`), immediate active-cycle `isVisible: true -> false` (`INV-DOM21-15`), immutable Asset `fileName`/`mimeType`/`sizeBytes` (`INV-DOM21-16`), operation separation & dependency protection (`INV-DOM21-17`), Logical Detachment (`INV-DOM21-18`), context-specific authorization (`INV-DOM21-19`).
5. **Security Invariants:** `INV-R7` (`assistant_admin` assigned-group writes), `INV-R9`/`INV-R10` (default-to-approval + execution-time re-validation), `INV-DOM03-02` (Developer Visual Role Preview barrier), `INV-DOM17-01` (`supervisorIds` monitoring-only).

---

## 4. Consolidated Current-State Findings

| Finding | Classification | Exact Evidence |
| :--- | :--- | :--- |
| `POST /api/admin/groups/:groupId/members` and `DELETE /api/admin/groups/:groupId/members/:userId` (note: param is `:userId`, not `:memberId`) call `isAssignedSupervisor` only, bypassing `requireCapabilityOrApproval('groups.manage_members')` | **`Confirmed defect`** | [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts#L655), [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts#L740) |
| `PUT`, `DELETE`, `PUT .../move`, `PATCH` on `/materials/files/:fileId` (and `PUT`/`DELETE` `/materials/folders/:folderId`) call `isAssignedSupervisor` only, bypassing `requireCapabilityOrApproval` | **`Confirmed defect`** | [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts#L1076-L1339) |
| `isUserAssignedGroupSupervisor` & `hasPermission` treat `supervisorIds` as sufficient for group write checks | **`Confirmed defect`** | [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L9205-L9212), [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L11287), [`policy.ts`](../../../frontend/src/core/permissions/policy.ts#L1427) |
| `replaceMaterialFile`, `deleteMaterialFile`, `moveMaterialFile`, `updateMaterialFile` look up `fileId` globally without checking `file.groupId === groupId` (`moveMaterialFile` only checks `targetFolder.groupId === file.groupId`) | **`Confirmed defect`** | [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L9853-L9990) |
| `evaluatePermission` step 5 enforces `GROUP_SCOPED_CAPABILITIES` only for `actor.role === 'lecturer'`, not `assistant_admin` `INV-R7` | **`Confirmed defect`** | [`policy.ts`](../../../frontend/src/core/permissions/policy.ts#L1425) |
| `PUT` overwrites `originalFileName`/`fileSizeBytes`/`mimeType` in place; `DELETE` removes `GroupMaterialFile` from array; no cycle-state check; no audit logs | **`Confirmed defect`** | [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L9853-L9990) |
| `materials.manage_references` not yet in runtime `types.ts`/`policy.ts`/`groupHandlers.ts` | **`Deferred backend work` / Outstanding** | [`types.ts`](../../../frontend/src/core/permissions/types.ts#L31-L34), [`policy.ts`](../../../frontend/src/core/permissions/policy.ts#L37-L40) |
| `POST /members` labels `super_admin`/`developer` as `'supervisor_assigned'` and does not validate trainee role of `tid` | **`Confirmed defect`** | [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts#L674), [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts#L7043-L7130) |

---

## 5. Group Membership Authorization Design (`Proposed technical remediation`)

For `POST /api/admin/groups/:groupId/members` and `DELETE /api/admin/groups/:groupId/members/:userId`:
1. **Authentication:** `resolveAuthenticatedUser(request)` (`D-AUTH-01`; `INV-DOM03-02` Developer Visual Role Preview barrier preserved).
2. **Target Group Context:** Verify `groupId` exists (`404` if missing).
3. **Group-Management Scope + `groups.manage_members` Capability + Ceiling + Overrides + Approval:**
   - Call `requireCapabilityOrApproval(user, 'groups.manage_members', { context: { targetGroupId: groupId }, ... })`.
   - Enforce `UserPermissionOverride` revocations/grants within `ROLE_CAPABILITY_CEILINGS`.
   - Enforce `INV-R7` (`GroupAssistantAssignment` for `assistant_admin`) and `GROUP_SCOPED_CAPABILITIES` (`primaryInstructorId` or active `GroupAssistantAssignment` for `lecturer`), **excluding** `supervisorIds`-only users (`INV-DOM17-01`).
   - Enforce `INV-R9` (`202 Accepted` for `assistant_admin` unless valid exact-capability + `groupId`-scoped `DelegatedAuthority` applies) and `INV-R10` execution-time re-validation.
4. **Target-Member & Business Validation:** Validate added `traineeIds` are eligible active `'user'` accounts (`POST`) and removed `userId` belongs to `groupId` (`DELETE`, `D-07` enrollment preservation); enforce `maxTrainees` (`409`).
5. **Audit Logging:** Emit audit entries for member add/remove with actor, `groupId`, target `userId`, and `INV-R9` dual attribution when applicable.

---

## 6. Content Authorization Design (`Proposed technical remediation`)

For all group material/content operations (`/materials/files*`, `/materials/folders*`):
1. **Authentication:** `D-AUTH-01` + `INV-DOM03-02` preview barrier.
2. **Applicable Group/Resource Scope:** Org-wide for `developer`/`super_admin`/`admin`; `INV-R7` (`GroupAssistantAssignment`) for `assistant_admin`; `primaryInstructorId` or active `GroupAssistantAssignment` for `lecturer`; **never** `supervisorIds`-only (`INV-DOM17-01`).
3. **Resource-to-Group Ownership:** Validate `file.groupId === groupId` (and `folder.groupId === groupId`) **before** any mutation; fail closed (`404`/`403`) on mismatch.
4. **Operation-Specific Capability + Ceiling + Overrides + Approval:**
   - `POST .../materials/files` -> `materials.upload_files` (Step 1 upload / Asset creation).
   - `POST` (attach ref) / `PUT` (Step 2 repoint) / `DELETE` (Logical Detachment) / `PATCH` (`title`/`isVisible`) -> `materials.manage_references` (`INV-DOM21-21`).
   - `POST`/`PUT`/`DELETE .../materials/folders*` -> `materials.manage_folders`.
   - `PUT .../materials/files/:fileId/move` -> moving a reference between folders within the same group maps to `materials.manage_references` (or `materials.manage_folders` — see §16 Open Owner Decision if folder-organization vs. reference-management boundary needs confirmation).
   - Physical Media Asset deletion (independent operation, not `DELETE` reference detachment) -> `materials.delete_files` (or dedicated asset-deletion contract under `A-03c`, blocked by `INV-DOM21-17` while any reference exists).
5. **Lifecycle, Cycle-State, & Audit:** Enforce Active / Unsealed `GroupRenewalCycle` state (`INV-DOM21-07`, `08`, `14`), `INV-DOM21-16` technical metadata immutability, `INV-DOM21-18` Logical Detachment, and emit audit logs.

---

## 7. Role, Assignment, and Capability Matrix (`Owner-approved requirement` Model)

| Role / Assignment | Group Membership (`groups.manage_members`) | Content Ops (`materials.*` incl. `materials.manage_references`) |
| :--- | :--- | :--- |
| **`developer`** | Allowed directly (`INV-DOM03-02` preview barrier applies) | Allowed directly in Active / Unsealed cycles (`INV-DOM03-02` applies) |
| **`super_admin` / `Superior`** | Allowed directly (org-wide; `UserPermissionOverride.revoked` denies) | Allowed directly in Active / Unsealed cycles (`UserPermissionOverride.revoked` denies) |
| **`admin`** | Allowed directly (org-wide; `UserPermissionOverride.revoked` denies) | Allowed directly in Active / Unsealed cycles (`UserPermissionOverride.revoked` denies) |
| **`assistant_admin`** | `INV-R7` assigned groups only + `INV-R9` `202` (unless exact-capability + `groupId` `DelegatedAuthority`) | `INV-R7` assigned groups only + `INV-R9` `202` (unless exact-capability + `groupId` `DelegatedAuthority`) |
| **`lecturer` (`primaryInstructorId`)** | Assigned group only (`GROUP_SCOPED_CAPABILITIES`; `revoked` denies) | Assigned Active / Unsealed cycle (`GROUP_SCOPED_CAPABILITIES`; `revoked` denies) |
| **`lecturer` (`GroupAssistantAssignment`)** | Active assigned group (`GROUP_SCOPED_CAPABILITIES`; `revoked` denies) | Active assigned group + Active / Unsealed cycle (`revoked` denies) |
| **`supervisorIds`-only** | **Denied (`INV-DOM17-01`)** — monitoring-only | **Denied (`INV-DOM17-01`)** — monitoring-only |
| **`user` / `trainee`** | **Denied (`403`)** — outside `ROLE_CAPABILITY_CEILINGS.user` | **Denied (`403`)** — outside `ROLE_CAPABILITY_CEILINGS.user` |

---

## 8. Assistant Admin Approval and Delegation (`INV-R7`, `INV-R9`, `INV-R10`)

Every membership and content mutation (`groups.manage_members`, `materials.upload_files`, `materials.delete_files`, `materials.manage_folders`, `materials.manage_references`) is **state-changing**:
- **Default (`INV-R9`):** Returns `202 Accepted` (`PendingApprovalRequest`) for `assistant_admin` (`policy.ts` lines 1461–1473).
- **Delegation Bypass (`DelegatedAuthority`):** Direct execution (`200`/`201`) is permitted **only** when `hasDelegatedCapability` (`inMemoryStore.ts` lines 12066–12130) verifies: `grant.userId` matches actor, `grant.active === true`, `now < expiresAt`, `grant.capabilities.includes(exactCapability)`, and `grant.resourceScope.groupId === targetGroupId`. Invalid, expired, inactive, or mismatched delegation **fails closed** to `202` (or `403` if outside `INV-R7`).
- **Group Assignment Is Scope Only:** `GroupAssistantAssignment` / `INV-R7` never creates a direct-execution exemption.
- **Self-Approval / Self-Dealing & `INV-R10`:** Approvers (`admin`/`super_admin`) cannot self-approve; `INV-R10` re-validates target existence, scope, cycle state, and invariants at execution time.

---

## 9. Resource Ownership and Cross-Group Isolation

- **Affected Store Functions:** `replaceMaterialFile` (`inMemoryStore.ts` L9853), `deleteMaterialFile` (L9899), `moveMaterialFile` (L9936), `updateMaterialFile` (L9970) — all look up `this.materialFiles.find(f => f.id === fileId)` without verifying `file.groupId.toLowerCase() === groupId.toLowerCase()`.
- **Required Ownership Rule:** Every handler/store operation must pass `groupId` and fail closed (`404` / `403`) before any state change if `file.groupId !== groupId` (and `folder.groupId !== groupId`).
- **Membership Ownership:** `removeGroupMember` (L7206) already checks membership in `groupId`; `addGroupMember` (L7043) must validate target `traineeId` eligibility/existence.

---

## 10. Media Lifecycle, Consolidated Matrix & Renewal Cycle Design

| Operation | Group/Resource Scope | Required Capability | Approval/Delegation | Lifecycle & Cycle Validation | Current Evidence & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Add group member** (`POST .../members`) | `INV-R7` / `GROUP_SCOPED_CAPABILITIES` (`supervisorIds` excluded) | `groups.manage_members` (`Owner-approved`) | `INV-R9` / `DelegatedAuthority` | Active trainee + `maxTrainees` (`409`) | `groupHandlers.ts` L655 bypasses guard (**`Confirmed defect`**) |
| **Remove group member** (`DELETE .../members/:userId`) | `INV-R7` / `GROUP_SCOPED_CAPABILITIES` (`supervisorIds` excluded) | `groups.manage_members` (`Owner-approved`) | `INV-R9` / `DelegatedAuthority` | Member in `groupId` + `D-07` provenance | `groupHandlers.ts` L740 bypasses guard (**`Confirmed defect`**) |
| **Upload content** (`POST .../materials/files`) | `INV-R7` / `GROUP_SCOPED_CAPABILITIES` (`supervisorIds` excluded) | `materials.upload_files` (`Owner-approved`) | `INV-R9` / `DelegatedAuthority` | Step 1 upload/Asset creation (`INV-DOM21-12`), MIME/size (`B-01`/`B-02`) | `groupHandlers.ts` L1162 uses guard, but `supervisorIds` leaks via L11287 (**`Confirmed defect`**) |
| **Move content** (`PUT .../files/:fileId/move`) | Same-group scope + `file.groupId === groupId` + `targetFolder.groupId === groupId` | **Unresolved** (`materials.manage_folders` vs. `materials.manage_references`) | `INV-R9` / `DelegatedAuthority` | Active / Unsealed cycle; logical folder link only | `groupHandlers.ts` L1291 bypasses guard; no `file.groupId` check (**`Confirmed defect`**) |
| **Update reference metadata** (`PATCH .../files/:fileId`) | `INV-R7` / `GROUP_SCOPED_CAPABILITIES` + `file.groupId === groupId` | `materials.manage_references` (`Owner-approved`, `INV-DOM21-21`) | `INV-R9` / `DelegatedAuthority` | Active / Unsealed only (`INV-DOM21-14`); immediate `isVisible` (`INV-DOM21-15`) | `groupHandlers.ts` L1334 bypasses guard; no cycle check (**`Confirmed defect`**) |
| **Add Content Reference** | `INV-R7` / `GROUP_SCOPED_CAPABILITIES` | `materials.manage_references` (`Owner-approved`, `INV-DOM21-21`) | `INV-R9` / `DelegatedAuthority` | Active / Unsealed only (`INV-DOM21-08`) | Bundled into `POST` in prototype (**`Deferred backend work`**) |
| **Repoint Content Reference** (`PUT` Step 2) | `INV-R7` / `GROUP_SCOPED_CAPABILITIES` + `file.groupId === groupId` | `materials.manage_references` (`Owner-approved`, `INV-DOM21-21`) | `INV-R9` / `DelegatedAuthority` | Active / Unsealed only; new `assetId` (`INV-DOM21-09`/`12`); immutable technical metadata (`INV-DOM21-16`) | `groupHandlers.ts` L1213 mutates metadata in place (**`Confirmed defect`**) |
| **Detach Content Reference** (`DELETE`) | `INV-R7` / `GROUP_SCOPED_CAPABILITIES` + `file.groupId === groupId` | `materials.manage_references` (`Owner-approved`, `INV-DOM21-21`) | `INV-R9` / `DelegatedAuthority` | Active / Unsealed only; Logical Detachment (`INV-DOM21-18`); restoration/state **`Open Owner decision`** | `groupHandlers.ts` L1256 removes record from array (**`Confirmed defect`**) |
| **Delete Media Asset** | Independently established asset-admin scope | `materials.delete_files` or dedicated asset-deletion contract (**Unresolved `A-03c`**) | `INV-R9` / `DelegatedAuthority` | Prohibited if **any** reference exists (`INV-DOM21-17`, `409`); zero-reference retention **`Open Owner decision`** | No physical asset deletion in prototype (**`Deferred backend work`**) |

**Renewal Cycle Enforcement (`INV-DOM21-07`, `08`, `14`):** All group reference mutations (`add`, `repoint`, `detach`, `PATCH` `title`/`isVisible`, `move`) are **permitted only** in Active / Unsealed `GroupRenewalCycle`s, **prohibited** in Sealed / Closed cycles (and Published Course Versions), validated **before** mutation, and fail closed if cycle state cannot be determined.

---

## 11. Audit Logging Requirements

- **Existing Coverage:** `PendingApprovalRequest` creates dual-attributed audit records when `approveApprovalRequest` executes (`MFR-09`, `INV-DOM18-05`, `authorization-and-permissions-design.md` §11), but **direct** executions of `POST`/`DELETE /members` and `POST`/`PUT`/`DELETE`/`PATCH` `/materials/files*` in `groupHandlers.ts` emit **zero** `recordAuditLog` entries.
- **Required Audit Events (`Proposed technical remediation`):** Emit audit entries for member add/remove, file upload, reference add/detach/repoint/metadata update, folder CRUD, and physical asset deletion — capturing actor (`actorId`, `actorRole`), `groupId`, target (`userId` / `fileId` / `assetId`), operation, outcome (`success`/`denied`/`pending_approval`), approval/delegation context, and timestamp (without freezing an audit DB schema).

---

## 12. Consolidated Remediation Workstreams

1. **Workstream 1 — Membership Authorization:** Route `POST`/`DELETE /members` through `requireCapabilityOrApproval('groups.manage_members')`, enforce `INV-R7`/`GROUP_SCOPED_CAPABILITIES`, exclude `supervisorIds`-only (`INV-DOM17-01`), validate trainee role on `POST`, fix `joinSource` for `super_admin`/`developer`.
2. **Workstream 2 — Content Authorization:** Route `PUT`/`DELETE`/`PUT .../move`/`PATCH` `/materials/files/:fileId` and `PUT`/`DELETE /folders/:folderId` through `requireCapabilityOrApproval` with exact capabilities (`materials.manage_references` once implemented, `materials.manage_folders`), enforce `INV-R7` in `evaluatePermission`, exclude `supervisorIds`-only.
3. **Workstream 3 — Resource Ownership & Isolation:** Require `file.groupId === groupId` (and `folder.groupId === groupId`) in all store/handler lookups before mutation.
4. **Workstream 4 — Media Lifecycle & Renewal Cycles:** Decouple Step 1 upload from Step 2 repoint (`INV-DOM21-12`), enforce `INV-DOM21-16` immutability, replace in-memory `DELETE` filtering with `INV-DOM21-18` Logical Detachment, enforce Active / Unsealed cycle checks pre-mutation.
5. **Workstream 5 — Audit Logging:** Add `recordAuditLog` coverage across all direct and approved membership and content mutations.
6. **Workstream 6 — Test & Verification Strategy:** Add handler-level integration tests covering all negative, override, delegation, cross-group, and cycle-state scenarios.

---

## 13. Test and Verification Strategy (`Not Executed — Design Only`)

- **Test Layers:** (1) Unit tests (`policy.ts` `evaluatePermission`, `INV-R7`, `INV-DOM17-01`), (2) Handler-level MSW tests (`groupHandlers.ts` HTTP status `200`/`201`/`202`/`403`/`404`/`409`), (3) Integration tests (`PendingApprovalRequest` -> `approveApprovalRequest` -> `INV-R10`), (4) Django/DRF backend contract tests (Gate B).
- **Required Membership Scenarios (13):** (1) `admin` valid, (2) `super_admin` valid, (3) assigned `lecturer` with capability, (4) assigned `lecturer` without capability, (5) assigned `lecturer` with `revoked` override (`403`), (6) `GroupAssistantAssignment` with capability, (7) `GroupAssistantAssignment` without capability, (8) `supervisorIds`-only (`403`), (9) `assistant_admin` without delegation (`202` if assigned, `403` if unassigned), (10) `assistant_admin` with valid exact-capability + `groupId` delegation (`200`), (11) `assistant_admin` with expired/mismatched delegation (`202`), (12) user assigned to another group (`403`), (13) `developer` Visual Role Preview mutation attempt (`403`/`INV-DOM03-02`).
- **Required Content Scenarios (15):** (1) valid group scope + capability, (2) group scope without capability (`403`), (3) explicit `revoked` override (`403`), (4) capability without group scope (`403`), (5) `supervisorIds`-only (`403`), (6) `assistant_admin` requiring `INV-R9` (`202`), (7) `assistant_admin` valid exact-capability + `groupId` delegation (`200`), (8) invalid/expired/mismatched delegation (`202`), (9) cross-group `fileId` access (`404`/`403`), (10) Sealed/Closed Renewal Cycle (`409`/`403`), (11) unauthorized repointing, (12) unauthorized logical detachment, (13) unauthorized physical deletion (`409` while referenced), (14) repeated requests/idempotency, (15) concurrent reference updates.

---

## 14. Django Backend Enforcement Implications (`Deferred backend work` — SQL Server + DRF)

- **Established Requirements:** Enforce `D-AUTH-01` session/CSRF, `INV-DOM03-02` preview barrier, `groups.manage_members` / `materials.*` DRF permission classes, `INV-R7` `GroupAssistantAssignment`, `INV-R9`/`INV-R10` `PendingApprovalRequest` + exact-capability `DelegatedAuthority`, `INV-DOM17-01` `supervisorIds` exclusion, `reference.group_id == group_id`, Active/Unsealed cycle checks, `INV-DOM21-09`/`12`/`16`/`17`/`18`, and SQL Server transactional locking on reference detachment vs. asset deletion.
- **Technical Recommendations:** Shared DRF permission + object-level ownership mixin; atomic `transaction.atomic()` with SQL Server row locks (`select_for_update`) on reference-count checks.
- **Unresolved API / Persistence:** Exact routes/DTOs/status codes (`A-03a`–`A-03c`), logical detachment columns, zero-reference retention, and schema freeze remain **NOT AUTHORIZED**.

---

## 15. API Contract Dependencies

- `API-REC-06` remains **`DEFERRED`**.
- `A-01`, `A-02`, `A-03a`, `A-03b`, and `A-03c` remain **OPEN** in [`FRD-MEDIA-001`](FRD-MEDIA-001-phase-1-media-architecture-requirements-baseline.md) §7.

---

## 16. Unresolved Owner Decision Register (Genuinely Unresolved Only)

| ID | Precise Question | Why Existing Decisions Do Not Resolve It | Alternatives & Consequences | Blocks Implementation? |
| :--- | :--- | :--- | :--- | :--- |
| **`A-03c-1`** | Exact logical detachment state representation, removal audit fields, and whether detached references can be restored/reattached (and identity reuse) | `INV-DOM21-18` explicitly left state fields, audit fields, and restoration unresolved | **A:** Boolean/timestamp + non-restorable (new ref on re-attach). **B:** Soft state + restorable same ID. *(Affects DB & API DTOs)* | **Yes** (blocks Phase 5 schema & final `DELETE`/restore API) |
| **`A-03c-2`** | Physical Media Asset deletion eligibility, soft-delete vs. archival vs. permanent purge after zero references, and concurrency conflict status (`409`) | `INV-DOM21-17` blocks deletion while referenced, but leaves zero-reference lifecycle & `B-07` retention open | **A:** Retain indefinitely / admin-scheduled purge. **B:** Explicit zero-reference delete endpoint with grace period. | **Yes** (for asset deletion endpoint) |
| **`A-03c-3`** | `PUT .../materials/files/:fileId/move` capability mapping (`materials.manage_folders` vs. `materials.manage_references`) | `INV-DOM21-21` covers add, detach, repoint, `title`/`isVisible`; folder move sits on the boundary | **A:** `materials.manage_references` (reference placement). **B:** `materials.manage_folders` (folder organization). | **No** (for `POST`/`PUT`/`DELETE`/`PATCH`; **Yes** for `/move` remediation) |
| **`A-03a-1`** | `assistant_admin` Draft Course Version scope (`domain-05` / `policy.ts` vs. `INV-R7`) for `courses.edit_curriculum` | `INV-DOM21-20` preserved `INV-R7` Draft scope as unresolved | **A:** Restrict `assistant_admin` draft writes to group-linked courses. **B:** Allow `INV-R9`-gated draft edits. | **No** (for group materials; **Yes** for Draft Course `assistant_admin` API) |

---

## 17. Recommended Implementation Sequence (`NOT AUTHORIZED`)

1. **Owner Resolution of `A-03c-1`–`A-03c-3` & `A-03a-1`** (prerequisite for schema/API freeze).
2. **Authorization Foundation:** Add `materials.manage_references` to `types.ts`/`policy.ts` (preserving `2026-11-14` model), remove `supervisorIds` from write checks (`INV-DOM17-01`), add `INV-R7` enforcement in `evaluatePermission`.
3. **Membership Handlers:** Update `POST`/`DELETE /members` in `groupHandlers.ts` to use `requireCapabilityOrApproval('groups.manage_members')`.
4. **Content Handlers & Ownership:** Update `/materials/files*` & `/folders*` handlers to use `requireCapabilityOrApproval` + `file.groupId === groupId` + cycle-state checks.
5. **Media Lifecycle Semantics & Audit:** Implement Two-Step repoint, `INV-DOM21-16`, `INV-DOM21-18` Logical Detachment, and `recordAuditLog`.
6. **Tests & Django Backend (Phase 5+ once authorized):** Implement full 13+15 test matrix, then Django/DRF + SQL Server enforcement.

---

## 18. Traceability Matrix

| Owner Decision / Invariant | Current Evidence | Confirmed Finding | Required Behavior | Workstream | Verification Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `2026-11-14` Separation Principle + `groups.manage_members` | `groupHandlers.ts` L655, L740 | `isAssignedSupervisor` bypasses `groups.manage_members` | Enforce group scope + `groups.manage_members` | WS-1 | Membership #1–#13 |
| `INV-DOM21-21` + `2026-11-14` Preserved Grant Model | `groupHandlers.ts` L1213, L1256, L1334 | `PUT`/`DELETE`/`PATCH` bypass `requireCapabilityOrApproval` | Enforce scope + `materials.manage_references` | WS-2 | Content #1–#4, #11–#12 |
| `INV-DOM17-01` (`supervisorIds` monitoring-only) | `inMemoryStore.ts` L9205, L11287; `policy.ts` L1427 | `supervisorIds` grants write access | Exclude `supervisorIds`-only from writes | WS-1, WS-2 | Membership #8, Content #5 |
| `INV-R7`, `INV-R9`, `INV-R10` | `groupHandlers.ts` L655, L740, L1213–1334 | `assistant_admin` gets `403` instead of `202` / delegation | `INV-R7` scope + `INV-R9` `202` / exact `DelegatedAuthority` | WS-1, WS-2 | Membership #9–#11, Content #6–#8 |
| Resource-to-Group Ownership | `inMemoryStore.ts` L9853–9990 | Global `fileId` lookup without `file.groupId === groupId` | Validate `file.groupId === groupId` pre-mutation | WS-3 | Content #9 |
| `INV-DOM21-07`–`18` Lifecycle & Cycle States | `inMemoryStore.ts` L9853–9990 | In-place `PUT`, array-filter `DELETE`, no cycle check | Two-Step repoint, Logical Detachment, Active/Unsealed only | WS-4 | Content #10–#15 |
| `MFR-09` / `INV-DOM18-05` Audit | `groupHandlers.ts` L637–760, L1128–1348 | Zero `recordAuditLog` calls on direct mutations | Audit actor, group, target, operation, approval context | WS-5 | WS-6 audit assertions |

---

## 19. Governance and Readiness Assessment

- `A-03c`: **OPEN** | `API-REC-06`: **DEFERRED** | `materials.manage_references` runtime implementation: **OUTSTANDING** | Phase 5: **NOT AUTHORIZED** | Database schema freeze: **NOT AUTHORIZED**.
- Current repository is **not** ready for Phase 5 or backend implementation until Owner decisions in §16 are resolved and Workstreams 1–6 are explicitly authorized.

---

## 20. Verification Results

- **Read-Only Inspection:** Verified against current `groupHandlers.ts`, `routeGuards.ts`, `resolveUser.ts`, `inMemoryStore.ts`, `policy.ts`, `types.ts`, and test files; zero runtime, test, mock, backend, or schema files modified.
- **Commands Not Run:** Runtime Vitest suites (`npm test` / `vitest`) were not executed because this was a documentation-and-design-only task with no code or test changes.

