# MetroLMS — `A-03c` Authorization & API Lifecycle Investigation Report

> **Document Title:** `A-03c` Authorization & API Lifecycle Investigation & Remediation Design (`groupHandlers.ts` `/materials/files/:fileId`)  
> **Document Identifier:** `METROLMS-INV-A03C-001`  
> **Document Status:** `INVESTIGATION & REMEDIATION DESIGN REPORT — OPEN FOR OWNER & ARCHITECTURE REVIEW`  
> **Investigation Date:** 2026-11-14  
> **Governing Decisions Preserved:** `INV-R7`, `INV-R9`, `INV-R10`, `INV-DOM03-02`, `INV-DOM17-01`, `INV-DOM21-07`–`INV-DOM21-21`, `2026-11-14` Owner Clarification (Preserve Existing Group-Material Permission Grant Model), **`2026-11-14` Owner Decision (Separation of Group Administration and Content Authorization — `OWNER APPROVED`)**, `API-REC-06` (`DEFERRED`), `API-REC-07` (narrowly reconciled with `INV-DOM21-16`)  
> **Governance Locks:** `A-03c` remains **OPEN** | `API-REC-06` remains **DEFERRED** | `materials.manage_references` runtime implementation remains **OUTSTANDING** | Phase 5 **NOT AUTHORIZED** | Database schema freeze **NOT AUTHORIZED**

---

## 1. Executive Summary

An evidence-based inspection of [`groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts), [`routeGuards.ts`](../../../frontend/src/mocks/handlers/utils/routeGuards.ts), [`inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts), [`policy.ts`](../../../frontend/src/core/permissions/policy.ts), and [`types.ts`](../../../frontend/src/core/permissions/types.ts) confirms a **structural authorization and lifecycle split** across the `/api/admin/groups/:groupId/materials/files/:fileId` endpoints:

1. **`isAssignedSupervisor` vs. `requireCapabilityOrApproval` Serve Different Responsibilities, Yet Replace Each Other Inconsistently (`Confirmed defect` — `High`):**
   - `POST /api/admin/groups/:groupId/materials/files` calls **both** `requireCapabilityOrApproval(user, 'materials.upload_files', ...)` (capability + `UserPermissionOverride` + `INV-R9` `202 Accepted` + `DelegatedAuthority`) **and** `if (user.role === 'lecturer' && !isAssignedSupervisor(user, group))` (`403`) (`groupHandlers.ts` lines 1162–1183).
   - In contrast, `PUT`, `DELETE`, `PUT .../move`, and `PATCH` on `/api/admin/groups/:groupId/materials/files/:fileId` call **only** `isAssignedSupervisor(user, group)` (`groupHandlers.ts` lines 1213, 1256, 1291, 1334) and **completely bypass** `requireCapabilityOrApproval` / `evaluatePermission`.
2. **Consequences of Bypassing `requireCapabilityOrApproval` (`Confirmed defect` — `High`):**
   - `UserPermissionOverride` revocations are ignored on `PUT`, `DELETE`, and `PATCH` for `admin`, `super_admin`, and `lecturer`.
   - `assistant_admin` is **unconditionally denied (`403`)** on `PUT`, `DELETE`, and `PATCH` (because `isOperationalGroupAdmin` excludes `assistant_admin` and `isAssignedSupervisor` only checks `lecturer` after that), breaking `INV-R9` (`202 Accepted` approval workflow) and ignoring valid `DelegatedAuthority` bypasses.
   - Standalone `supervisorIds` lecturers pass `isAssignedSupervisor` (`inMemoryStore.ts` lines 9205–9211) despite `INV-DOM17-01` restricting `supervisorIds` to monitoring-only.
   - `admin` / `super_admin` / `lecturer` can mutate/delete a `fileId` belonging to **another group** (`groupId` mismatch) because `replaceMaterialFile`, `deleteMaterialFile`, and `updateMaterialFile` look up `fileId` globally without checking `file.groupId === groupId`.
3. **Lifecycle & Semantic Gaps (`Confirmed defect` / `Deferred backend work` — `High`):**
   - `PUT` mutates `originalFileName`, `fileSizeBytes`, and `mimeType` in place on the same `file.id` (contradicting `INV-DOM21-09` new `assetId`, `INV-DOM21-12` Two-Step Upload & Reference Repoint, and `INV-DOM21-16` immutable Asset-level technical metadata).
   - `DELETE` physically filters `this.materialFiles` out of memory (contradicting `INV-DOM21-17` operation separation and `INV-DOM21-18` Logical Detachment).
   - Neither `PUT`, `DELETE`, nor `PATCH` enforces Active / Unsealed vs. Sealed / Closed `GroupRenewalCycle` state (`INV-DOM21-07`, `INV-DOM21-08`, `INV-DOM21-14`) or writes security audit logs.

---

## 2. Investigation Scope and Evidence Sources

| Artifact | Purpose Inspected | Exact Location |
| :--- | :--- | :--- |
| MSW Group Handlers | Route registration, auth, `isAssignedSupervisor`, `requireCapabilityOrApproval` | [`frontend/src/mocks/handlers/groupHandlers.ts`](../../../frontend/src/mocks/handlers/groupHandlers.ts) (lines 1–85, 1128–1348) |
| Route Guard Utility | `requireCapabilityOrApproval`, `202` `PendingApprovalRequest` creation | [`frontend/src/mocks/handlers/utils/routeGuards.ts`](../../../frontend/src/mocks/handlers/utils/routeGuards.ts) (lines 40–105) |
| Auth User Resolver | Token/session resolution (`resolveAuthenticatedUser`) | [`frontend/src/mocks/handlers/resolveUser.ts`](../../../frontend/src/mocks/handlers/resolveUser.ts) (lines 310–406) |
| In-Memory Store | `isUserAssignedGroupSupervisor`, `hasPermission`, `hasDelegatedCapability`, `isGroupAssistant`, `add/replace/delete/updateMaterialFile`, `approveApprovalRequest` | [`frontend/src/mocks/store/inMemoryStore.ts`](../../../frontend/src/mocks/store/inMemoryStore.ts) (lines 9175–9216, 9780–9990, 11250–11301, 11822–11830, 12066–12130, 13175–13203) |
| Permission Policy Engine | `ROLE_DEFAULT_CAPABILITIES`, `ROLE_CAPABILITY_CEILINGS`, `GROUP_SCOPED_CAPABILITIES`, `ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES`, `evaluatePermission` | [`frontend/src/core/permissions/policy.ts`](../../../frontend/src/core/permissions/policy.ts) (lines 17–755, 1298–1485) |
| Permission Types | `SystemCapability`, `EvaluationContext`, `UserPermissionOverride`, `DelegationGrant` | [`frontend/src/core/permissions/types.ts`](../../../frontend/src/core/permissions/types.ts) (lines 8–191) |
| Test Suites | API, store, approval, and notification tests | [`training-groups-api.test.tsx`](../../../frontend/src/test/training-groups-api.test.tsx) (620–710), [`training-groups-state.test.ts`](../../../frontend/src/test/training-groups-state.test.ts) (644–754), [`assistant-admin-default-approval.test.ts`](../../../frontend/src/test/assistant-admin-default-approval.test.ts) (81, 188–194, 316–322), [`notification-navigation-and-delivery.test.tsx`](../../../frontend/src/test/notification-navigation-and-delivery.test.tsx) (499, 513) |
| Canonical Docs | FRD, Authorization Design, Domain 17, `CURRENT.md` | [`FRD-MEDIA-001`](FRD-MEDIA-001-phase-1-media-architecture-requirements-baseline.md), [`authorization-and-permissions-design.md`](../../frontend/authorization-and-permissions-design.md), [`domain-17`](../domains/domain-17-group-monitoring-and-supervisor-dashboards.md), [`CURRENT.md`](../../project-state/CURRENT.md) |

---

## 3. Current Authorization Call Chain

### 3.1 `PUT /api/admin/groups/:groupId/materials/files/:fileId`
- **Route & Handler:** `http.put('/api/admin/groups/:groupId/materials/files/:fileId', ...)` (`groupHandlers.ts` lines 1194–1234).
- **Authentication:** `resolveAuthenticatedUser(request)` (line 1195); returns `401` if `null`.
- **Group Lookup:** `inMemoryStore.getGroupById(groupId)` (line 1205); returns `404` if missing.
- **Authorization:** `if (!isAssignedSupervisor(user, group))` (line 1213) -> returns `403` if `false`. **Does NOT call `requireCapabilityOrApproval`, `evaluatePermission`, or `hasPermission`.**
- **Validation & Mutation:** Parses JSON `{ fileName, sizeBytes, mimeType }` (lines 1221–1227, `400` if missing) -> calls `inMemoryStore.replaceMaterialFile(fileId, body, user)` (line 1229; `inMemoryStore.ts` lines 9853–9894).
- **Resource Ownership:** `replaceMaterialFile` searches `this.materialFiles.find(f => f.id === fileId)` **without verifying `file.groupId === groupId`**.
- **Approval / Delegation / Audit:** **None.** No `202 Accepted` path, no `DelegatedAuthority` check, no `SystemAuditLogEntry` / `ActivityLogEntry`.
- **Response:** `200 OK` with mutated `GroupMaterialFile` (or `404`/`422` via `handleStoreError`).

### 3.2 `DELETE /api/admin/groups/:groupId/materials/files/:fileId`
- **Route & Handler:** `http.delete('/api/admin/groups/:groupId/materials/files/:fileId', ...)` (`groupHandlers.ts` lines 1237–1269).
- **Authentication & Group Lookup:** `resolveAuthenticatedUser(request)` (line 1238, `401`) -> `inMemoryStore.getGroupById(groupId)` (line 1248, `404`).
- **Authorization:** `if (!isAssignedSupervisor(user, group))` (line 1256) -> returns `403`. **Does NOT call `requireCapabilityOrApproval` or `evaluatePermission`.**
- **Mutation:** Calls `inMemoryStore.deleteMaterialFile(fileId)` (line 1264; `inMemoryStore.ts` lines 9899–9931), which **physically filters** `fileId` out of `this.materialFiles` (`this.materialFiles = this.materialFiles.filter(f => f.id !== fileId)`), decrements `folder.filesCount` and `group.filesCount`, and emits trainee notifications if `group.adminStatus === 'active' && file.isVisible`.
- **Resource Ownership / Approval / Delegation / Audit:** **None** (`file.groupId === groupId` is not checked; no `INV-R9` `202`; no `DelegatedAuthority`; no audit log).
- **Response:** `200 OK` `{ success: true, message }`.

### 3.3 `PATCH /api/admin/groups/:groupId/materials/files/:fileId`
- **Route & Handler:** `http.patch('/api/admin/groups/:groupId/materials/files/:fileId', ...)` (`groupHandlers.ts` lines 1315–1348).
- **Authentication & Group Lookup:** `resolveAuthenticatedUser(request)` (line 1316, `401`) -> `inMemoryStore.getGroupById(groupId)` (line 1326, `404`).
- **Authorization:** `if (!isAssignedSupervisor(user, group))` (line 1334) -> returns `403`. **Does NOT call `requireCapabilityOrApproval` or `evaluatePermission`.**
- **Mutation:** Parses `{ title?, isVisible? }` (line 1342) -> calls `inMemoryStore.updateMaterialFile(fileId, body)` (line 1343; `inMemoryStore.ts` lines 9970–9990), mutating `file.title` (rejecting empty trim with `422`) and `file.isVisible`.
- **Resource Ownership / Approval / Delegation / Audit:** **None** (`file.groupId === groupId` not checked; no `INV-R9`; no `DelegatedAuthority`; no audit log).
- **Response:** `200 OK` with updated `GroupMaterialFile`.

*(Contrast: `POST /api/admin/groups/:groupId/materials/files` at lines 1128–1191 calls `requireCapabilityOrApproval(user, 'materials.upload_files', ...)` at line 1162 AND `if (user.role === 'lecturer' && !isAssignedSupervisor(user, group))` at line 1178.)*

---

## 4. `isAssignedSupervisor` vs. `requireCapabilityOrApproval` Comparison

| Criterion | `isAssignedSupervisor(user, group)` (`groupHandlers.ts` lines 62–68; `inMemoryStore.ts` lines 9175–9216) | `requireCapabilityOrApproval(user, capability, options)` (`routeGuards.ts` lines 40–105; `inMemoryStore.ts` lines 11250–11301; `policy.ts` lines 1298–1485) |
| :--- | :--- | :--- |
| **1. Exact Validation** | Role shortcut (`developer`/`super_admin`/`admin` -> `true`) or `lecturer` membership in `primaryInstructorId`, `assistantLecturerIds`, `supervisorIds`, or `GroupAssistantAssignment`. | Calls `inMemoryStore.hasPermission` -> `evaluatePermission` (6-step pipeline: invariants, ceiling, `UserPermissionOverride`, role defaults, `GROUP_SCOPED_CAPABILITIES`, `INV-R9` approval/delegation). |
| **2. Identity / Role / Assignment / Capability** | Role + Group Assignment only. **Never checks any `SystemCapability`.** | Identity + Role + Capability + `UserPermissionOverride` + Delegation + Group Assignment (for `lecturer` when `GROUP_SCOPED_CAPABILITIES.has(cap)` and `targetGroupId` is supplied). |
| **3. `primaryInstructorId`** | **Yes** (`inMemoryStore.ts` lines 9189–9193). | **Indirect/Fragile:** `hasPermission` (lines 11283–11293) populates `isGroupSupervisor` from `group.supervisorIds` and `isGroupAssistant` from `GroupAssistantAssignment`—it does **not** directly check `group.primaryInstructorId` unless synced into `supervisorIds`! |
| **4. `GroupAssistantAssignment`** | **Yes** (`assistantLecturerIds` lines 9195–9203 and `isGroupAssistant` line 9215). | **Yes** for `lecturer` when `targetGroupId` is passed (`inMemoryStore.ts` line 11290). **Not checked for `assistant_admin`** inside `hasPermission` / `evaluatePermission`! |
| **5. `supervisorIds`** | **Yes — Defect (`Confirmed defect`):** `inMemoryStore.ts` lines 9205–9212 returns `true` for `supervisorIds`, contradicting `INV-DOM17-01` (monitoring-only). | **Yes — Defect (`Confirmed defect`):** `inMemoryStore.ts` line 11287 sets `isGroupSupervisor = (group.supervisorIds || []).includes(actorObj.id)` and `policy.ts` line 1427 allows `isSupervisor` for `GROUP_SCOPED_CAPABILITIES`. |
| **6. Enforces `INV-R7`** | **No** (returns `false` for all `assistant_admin`s — over-restricts assigned `assistant_admin`s to `403`). | **Not inside `evaluatePermission` itself:** `GROUP_SCOPED_CAPABILITIES` check at `policy.ts` line 1425 only runs `if (... && actor.role === 'lecturer')`. Handlers must enforce `INV-R7` separately. |
| **7. Enforces `INV-R9`** | **No** (no `202` `PendingApprovalRequest` path). | **Yes** (`policy.ts` lines 1461–1473, `routeGuards.ts` lines 63–101) — returns `202 Accepted` for `assistant_admin` unless `hasDelegationBypass` is `true`. |
| **8. Evaluates `DelegatedAuthority`** | **No.** | **Yes** (`inMemoryStore.ts` lines 11275, 12066–12130) — checks `active`, `expiresAt`, exact `capabilities.includes(targetCapability)`, and `resourceScope.groupId`. |
| **9. Target Resource Group Scope** | Checks `groupId` from URL only; **never checks `file.groupId === groupId`**. | Checks `context.targetGroupId` from URL only; **never checks `file.groupId === groupId`**. |
| **10. Fail-Closed on Missing Context** | Returns `false` if `userId`/`group` missing, **except** returns `true` unconditionally for `developer`/`super_admin`/`admin`. | `policy.ts` lines 1426–1451 only checks `GROUP_SCOPED_CAPABILITIES` if `context?.targetGroupId` is truthy; if `targetGroupId` is omitted, `lecturer` group scope is skipped (`Potential risk requiring verification`). |

**Architectural Conclusion:** `isAssignedSupervisor` is a contextual group-assignment helper, while `requireCapabilityOrApproval` is the capability/override/approval policy guard. Per the **2026-11-14 Owner Decision (Separation of Group Administration and Content Authorization)**, `isAssignedSupervisor` must **not** be treated as a universal authorization grant for content mutation, and content mutation handlers must **not** bypass `requireCapabilityOrApproval` / canonical capability & approval enforcement. Each HTTP method requires the specific capability matching its operation semantics: `POST /materials/files` -> `materials.upload_files` (Step 1 upload/Asset creation), `PUT`/`DELETE`/`PATCH /materials/files/:fileId` -> `materials.manage_references` (`INV-DOM21-21`, once implemented; distinct from `materials.delete_files` supplementary file deletion and `materials.manage_folders` folder CRUD).

---

## 4A. Owner Decision — Separation of Group Administration and Content Authorization (2026-11-14)

> **Status:** `OWNER APPROVED`  
> **Approval Date:** `2026-11-14`  
> **Core Principle:** Group-level administrative authority and content-level authorization are separate authorization dimensions and must both be enforced according to the type of operation being performed. Group assignment grants only the group-administration authority explicitly associated with that assignment; it does not substitute for a content capability check, and possessing a content capability does not bypass group/resource scope.

### 4A.1 Mandatory Combined Authorization Conditions for Content Operations
For any content-related operation (`materials.upload_files`, `materials.delete_files`, `materials.manage_folders`, `materials.manage_references`), server-side authorization must establish all applicable conditions without expanding or reducing existing role privileges (`developer`, `super_admin`/`Superior`, `admin`, `assistant_admin`, `lecturer` via `primaryInstructorId` / `GroupAssistantAssignment`, `supervisorIds` monitoring-only per `INV-DOM17-01`, `user`/`trainee`):
1. The user is authenticated (`D-AUTH-01`; `INV-DOM03-02` Developer Visual Role Preview mutation barrier preserved).
2. The user has valid access to the target group/resource under the existing role and assignment model (`admin`/`super_admin` org-wide scope preserved; `assistant_admin` `INV-R7` assigned groups; `lecturer` `primaryInstructorId` or active `GroupAssistantAssignment`; `supervisorIds` alone denied per `INV-DOM17-01`).
3. The user holds the specific capability required for the requested operation (`UserPermissionOverride` revocations honored).
4. The role capability ceiling (`ROLE_CAPABILITY_CEILINGS`) permits the operation.
5. Existing `INV-R9` / `INV-R10` approval or valid exact-capability + group-scoped `DelegatedAuthority` requirements are satisfied (group assignment establishes scope, never a direct-execution exemption).
6. The target resource belongs to the requested group (`file.groupId === groupId`).
7. Applicable business and lifecycle invariants are satisfied (`INV-DOM21-07`–`INV-DOM21-21`, Active / Unsealed Group Renewal Cycle restrictions).

### 4A.2 Combined Authorization Matrix (Group Administration vs. Content Operations)

| Operation Category | Group / Assignment Authority | Specific Capability | Approval | Current Implementation & Status |
| :--- | :--- | :--- | :--- | :--- |
| **Add group members** (`POST /api/admin/groups/:groupId/members`) | Existing authorized group-management scope (`admin`/`super_admin` org-wide; `assistant_admin` `INV-R7`; `lecturer` assigned; `supervisorIds` monitoring-only) | `groups.manage_members` (existing `policy.ts` / `types.ts`) | Existing `INV-R9` policy (`ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES` line 597) | **Confirmed defect:** `groupHandlers.ts` line 655 checks `isAssignedSupervisor` only, bypassing `requireCapabilityOrApproval('groups.manage_members')`. |
| **Remove group members** (`DELETE /api/admin/groups/:groupId/members/:userId`) | Existing authorized group-management scope | `groups.manage_members` (existing `policy.ts` / `types.ts`) | Existing `INV-R9` policy (`policy.ts` line 597) | **Confirmed defect:** `groupHandlers.ts` line 740 checks `isAssignedSupervisor` only, bypassing `requireCapabilityOrApproval('groups.manage_members')`. |
| **Upload group content** (`POST .../materials/files`) | Applicable group/resource scope (`INV-R7` / `GROUP_SCOPED_CAPABILITIES`; `supervisorIds` excluded) | `materials.upload_files` (Step 1 upload / Asset creation) | Existing `INV-R9` / `DelegatedAuthority` policy | **Partially implemented:** `groupHandlers.ts` line 1162 calls `requireCapabilityOrApproval('materials.upload_files')` + line 1178 `isAssignedSupervisor` for `lecturer`, but `supervisorIds` leak remains in `isUserAssignedGroupSupervisor` & `hasPermission` line 11287. |
| **Delete supplementary content** | Applicable group/resource scope | `materials.delete_files` (subject to `INV-DOM21-17` dependency block) | Existing `INV-R9` / `DelegatedAuthority` policy | **Outstanding / Mismatched:** `DELETE .../files/:fileId` currently bypasses `requireCapabilityOrApproval` (`groupHandlers.ts` line 1256) and conflates deletion with reference removal. |
| **Manage folders** (`POST`/`PUT`/`DELETE .../materials/folders`) | Applicable group/resource scope | `materials.manage_folders` | Existing `INV-R9` / `DelegatedAuthority` policy | **Split:** `POST /folders` (line 1025) uses `requireCapabilityOrApproval`; `PUT`/`DELETE /folders/:folderId` (lines 1076, 1112) bypass it with `isAssignedSupervisor` only. |
| **Manage Content References** (add ref, `INV-DOM21-18` detach, `INV-DOM21-12` Step 2 repoint, `title`/`isVisible`) | Applicable Active / Unsealed Group Cycle scope (`INV-R7` / `GROUP_SCOPED_CAPABILITIES`; `supervisorIds` excluded) | `materials.manage_references` (`INV-DOM21-21` + `2026-11-14` preserved grant model) | Existing `INV-R9` / exact-capability + group-scoped `DelegatedAuthority` policy | **Outstanding implementation:** `materials.manage_references` is Owner-approved (`INV-DOM21-21`, `2026-11-14`) but not yet added to `types.ts`, `policy.ts`, `groupHandlers.ts`, or Django. |

### 4A.3 Remediation Design Matrix (`PROPOSED REMEDIATION DESIGN — IMPLEMENTATION NOT AUTHORIZED`)

| Area | Current Finding | Required Authorization Principle | Outstanding Work & Invariants |
| :--- | :--- | :--- | :--- |
| **Group membership operations** (`POST`/`DELETE .../members`) | `groupHandlers.ts` lines 655 & 740 use `isAssignedSupervisor` only; bypasses `groups.manage_members` & `INV-R9` (`Confirmed defect`). | Enforce group-level administrative authority + `groups.manage_members` + `INV-R9` / `DelegatedAuthority` without `supervisorIds` write bypass. | **Design correction:** Route through `requireCapabilityOrApproval('groups.manage_members', ...)` + `INV-R7` / `GROUP_SCOPED_CAPABILITIES` (`INV-DOM17-01`). |
| **Content `PUT`** (`PUT .../materials/files/:fileId`) | Bypasses `requireCapabilityOrApproval` (`groupHandlers.ts` line 1213); mutates `originalFileName`/`fileSizeBytes`/`mimeType` in place (`Confirmed defect`). | Enforce group/resource scope + `materials.manage_references` (Step 2 repoint) + `INV-R9`/`DelegatedAuthority` + `INV-DOM21-09`/`12`/`16`. | **Design correction:** Separate Step 1 upload (`materials.upload_files`) from Step 2 repoint (`materials.manage_references`), enforce `INV-R7`/`INV-R9`/`INV-DOM17-01` & Active/Unsealed cycle checks. |
| **Content `DELETE`** (`DELETE .../materials/files/:fileId`) | Bypasses `requireCapabilityOrApproval` (`groupHandlers.ts` line 1256); physically filters `GroupMaterialFile` out of memory (`Confirmed defect`). | Enforce group/resource scope + `materials.manage_references` (Logical Detachment) + `INV-R9`/`DelegatedAuthority` + `INV-DOM21-17`/`18`. | **Design correction:** Implement `INV-DOM21-18` Logical Detachment under `materials.manage_references` (distinct from `materials.delete_files` & physical asset deletion). |
| **Content `PATCH`** (`PATCH .../materials/files/:fileId`) | Bypasses `requireCapabilityOrApproval` (`groupHandlers.ts` line 1334); no cycle-state check (`Confirmed defect`). | Enforce group/resource scope + `materials.manage_references` (`title`/`isVisible`) + `INV-R9`/`DelegatedAuthority` + `INV-DOM21-13`–`15`. | **Design correction:** Enforce `requireCapabilityOrApproval('materials.manage_references')`, `INV-R7`, `INV-DOM17-01`, and `INV-DOM21-14`/`15` lifecycle rules. |
| **Cross-group file access** (`PUT`/`DELETE`/`PATCH`) | `replaceMaterialFile`, `deleteMaterialFile`, `updateMaterialFile` (`inMemoryStore.ts` lines 9853–9990) look up `fileId` globally without checking `file.groupId === groupId` (`Confirmed defect`). | Enforce strict resource-to-group ownership (`file.groupId === groupId`) before mutation. | **Design correction:** Validate `file.groupId === groupId` (`404`/`403` mismatch rejection) in both MSW store and Django queryset/service layer. |
| **Content Reference lifecycle** | Prototype overwrites technical metadata (`INV-DOM21-16`), physically removes `GroupMaterialFile` (`INV-DOM21-18`), and ignores Sealed/Closed cycles (`INV-DOM21-07`) (`Confirmed defect`). | Preserve `INV-DOM21-07`–`INV-DOM21-21` (Active/Unsealed mutability, immutable published/sealed references, new `assetId`, reference-dependency protection). | **Contract reconciliation (`A-03c` OPEN):** Finalize logical detachment state, restoration, `API-REC-07` `PUT` amendment, and asset-deletion lifecycle in `FRD-MEDIA-001`. |
| **Audit logging** | `PUT`/`DELETE`/`PATCH` `/materials/files/:fileId` emit zero `recordAuditLog` entries (`Confirmed defect`). | Follow established `MFR-09` / `INV-DOM18-05` / `authorization-and-permissions-design.md` §11 audit requirements (including dual attribution on `INV-R9` execution). | **Identify requirements:** Define audit action names, outcome logging (`success`/`denied`/`pending_approval`), and target resource attribution for reference operations. |

---

## 5. HTTP Method Authorization Matrix (`PUT`, `DELETE`, `PATCH /materials/files/:fileId`)

*(Derived from actual current code in `groupHandlers.ts` lines 62–68, 1213, 1256, 1291, 1334 — **not** the intended `INV-DOM21-21` + `2026-11-14` policy.)*

| Role / Assignment | Actual Current Handler Outcome (`PUT`, `DELETE`, `PATCH`) | Intended Policy (`INV-DOM21-21` + `2026-11-14` Clarification) |
| :--- | :--- | :--- |
| **`developer`** | **Allowed directly** (`isOperationalGroupAdmin` -> `true`). *(Visual Role Preview blocked at auth/session layer if resolved as previewed role.)* | Allowed directly in Active / Unsealed cycles (`INV-DOM03-02` preview barrier preserved). |
| **`super_admin` / `Superior`** | **Allowed directly** (even if capability revoked via `UserPermissionOverride`!). | Allowed directly unless revoked via `UserPermissionOverride`. |
| **`admin`** | **Allowed directly** (even if capability revoked via `UserPermissionOverride`!). | Allowed directly unless revoked via `UserPermissionOverride`. |
| **`assistant_admin`** | **Denied (`403`)** — `isOperationalGroupAdmin` is `false`, `user.role !== 'lecturer'`, so `isAssignedSupervisor` returns `false`. Ignores `INV-R7` assignment, `INV-R9` `202`, and valid `DelegatedAuthority`! | Permitted for `INV-R7` assigned groups; defaults to `INV-R9` `202 Accepted` unless valid exact-capability + group-scoped `DelegatedAuthority` covers `materials.manage_references`. |
| **`lecturer` (`primaryInstructorId`)** | **Allowed directly** (even if capability revoked via `UserPermissionOverride`!). | Allowed directly for assigned Active / Unsealed cycle unless revoked via `UserPermissionOverride`. |
| **`lecturer` (`GroupAssistantAssignment`)** | **Allowed directly** (even if capability revoked via `UserPermissionOverride`!). | Allowed directly for active `GroupAssistantAssignment` in Active / Unsealed cycle unless revoked via `UserPermissionOverride`. |
| **Users appearing only in `supervisorIds`** | **Allowed directly (`Confirmed defect`)** via `inMemoryStore.ts` lines 9205–9212. | **Denied (`INV-DOM17-01`)** — monitoring-only unless holding separate `primaryInstructorId` or `GroupAssistantAssignment`. |
| **`user` / `trainee`** | **Denied (`403`)** (`isAssignedSupervisor` returns `false`). | **Denied (`403`)** (excluded from `ROLE_CAPABILITY_CEILINGS.user`). |

---

## 6. API and Media Lifecycle Findings

| Aspect | `PUT /materials/files/:fileId` | `DELETE /materials/files/:fileId` | `PATCH /materials/files/:fileId` |
| :--- | :--- | :--- | :--- |
| **Target Entity** | Mutates `GroupMaterialFile` in place (conflates reference + asset metadata). | Removes `GroupMaterialFile` from `this.materialFiles` array. | Mutates `GroupMaterialFile.title` / `isVisible` in place. |
| **Changes Reference Metadata?** | Overwrites `originalFileName`, `fileSizeBytes`, `mimeType`, `fileType`, `url`, `uploadedBy*`, `uploadedAt` (`inMemoryStore.ts` lines 9868–9875). | Removes record completely. | Updates `title` and/or `isVisible` (`inMemoryStore.ts` lines 9979–9987). |
| **Changes Reference-to-Asset Link?** | No `assetId` exists; overwrites `url` in place (violates `INV-DOM21-09` & `INV-DOM21-12`). | N/A (no decoupled `assetId`). | No. |
| **Logical Detachment vs. Physical Deletion?** | N/A. | **Neither true logical detachment nor physical disk deletion:** physically deletes the in-memory `GroupMaterialFile` record (violating `INV-DOM21-18` retention of historical record & removal history); no physical binary exists in prototype. | N/A. |
| **Reversible / Restoration?** | **No** (overwrites previous metadata). | **No** (record filtered out of array). | **Yes** (`isVisible` can be toggled back; `title` can be re-edited). |
| **Renewal-Cycle State Enforced?** | **No** (no check for Sealed / Closed `GroupRenewalCycle` vs. Active / Unsealed). | **No** (no check for Sealed / Closed `GroupRenewalCycle`). | **No** (no check for Sealed / Closed `GroupRenewalCycle`). |
| **Duplicate / Concurrent Requests?** | No idempotency key, no ETag/version check; last write wins. | Second `DELETE` returns `404`; no concurrency lock. | Last write wins; no concurrency lock. |
| **Audited?** | **No** (no `recordAuditLog` call). | **No** (no `recordAuditLog` call). | **No** (no `recordAuditLog` call). |

---

## 7. Test and Mock Coverage Assessment

- [`training-groups-api.test.tsx`](../../../frontend/src/test/training-groups-api.test.tsx) (lines 620–696): Tests `addMaterialFile` validation (`422`) and `add` -> `replaceMaterialFile` (`PUT`) -> `deleteMaterialFile` (`DELETE`) **happy path only** as `supervisorUser`. Does **not** test `PATCH` (`updateMaterialFile`), `assistant_admin` (`202` vs. `403`), `supervisorIds`-only denial, `UserPermissionOverride` revocation, cross-group `fileId` ownership, or Sealed/Closed cycle rejection.
- [`training-groups-state.test.ts`](../../../frontend/src/test/training-groups-state.test.ts) (lines 644–754): Tests `inMemoryStore` methods directly without HTTP handlers or authorization.
- [`assistant-admin-default-approval.test.ts`](../../../frontend/src/test/assistant-admin-default-approval.test.ts) (lines 81, 188–194, 316–322): Tests `materials.upload_files` (`POST`) via `requireCapabilityOrApproval` directly; **zero coverage** for `PUT`/`DELETE`/`PATCH` `/materials/files/:fileId` or `materials.manage_references`.
- [`notification-navigation-and-delivery.test.tsx`](../../../frontend/src/test/notification-navigation-and-delivery.test.tsx) (lines 499, 513): Tests notification side effects of `addMaterialFile` and `deleteMaterialFile` only.

---

## 8. Documentation vs. Implementation Reconciliation

| Area | Classification | Evidence |
| :--- | :--- | :--- |
| **`assistant_admin` `INV-R9` & `DelegatedAuthority` on `PUT`/`DELETE`/`PATCH`** | **Implementation contradicts approved decision** | `groupHandlers.ts` lines 1213, 1256, 1334 return `403` via `isAssignedSupervisor` instead of `requireCapabilityOrApproval` (`INV-R9` `202` / `DelegatedAuthority`). |
| **`supervisorIds` granting material write access** | **Implementation contradicts approved decision** | `inMemoryStore.ts` lines 9205–9212 & 11287 and `policy.ts` line 1427 grant write access via `supervisorIds`, contradicting `INV-DOM17-01`. |
| **`UserPermissionOverride` revocation on `PUT`/`DELETE`/`PATCH`** | **Implementation contradicts approved decision** | `isAssignedSupervisor` ignores `UserPermissionOverride.revoked` (`policy.ts` step 3). |
| **`materials.manage_references` key in runtime** | **Implementation is missing** | Not yet in `types.ts`, `policy.ts`, or `groupHandlers.ts` (expected; runtime implementation is outstanding). |
| **`PUT` in-place technical metadata overwrite & `DELETE` record removal** | **Implementation contradicts approved decision** | `replaceMaterialFile` mutates `originalFileName`/`fileSizeBytes`/`mimeType` (`INV-DOM21-09`/`12`/`16`); `deleteMaterialFile` physically removes record (`INV-DOM21-17`/`18`). |
| **Sealed/Closed cycle immutability on `PUT`/`DELETE`/`PATCH`** | **Implementation is missing** | Store methods do not check `GroupRenewalCycle` state (`INV-DOM21-07`/`08`/`14`). |
| **Cross-group `fileId` ownership (`file.groupId === groupId`)** | **Implementation is missing** | `replaceMaterialFile`, `deleteMaterialFile`, `updateMaterialFile` do not validate `file.groupId === groupId`. |
| **Logical detachment state, restoration, `assetId` lifecycle, `PUT` amendment** | **Documentation is incomplete or ambiguous** (`A-03c` / `A-03b` open) | Tracked in `FRD-MEDIA-001` §7 item 1 (`A-03c` remains OPEN). |

---

## 9. Security Risks, Bypass Paths & Direct Answers to Investigation Questions

### Answers to the 10 Required Investigation Questions
1. **Does `isAssignedSupervisor` grant mutation access independently of a capability check?** **Yes.** On `PUT`, `DELETE`, `PUT .../move`, and `PATCH` (`groupHandlers.ts` lines 1213, 1256, 1291, 1334), `isAssignedSupervisor` grants access without checking any `SystemCapability` or `UserPermissionOverride`.
2. **Can `supervisorIds` accidentally or intentionally authorize a state-changing operation?** **Yes.** Both `isAssignedSupervisor` (`inMemoryStore.ts` lines 9205–9212) and `hasPermission` (`inMemoryStore.ts` line 11287 -> `policy.ts` line 1427) treat `supervisorIds` as sufficient for group material mutations, violating `INV-DOM17-01`.
3. **Can an Assistant Admin execute a write directly through a path that bypasses `requireCapabilityOrApproval`?** **No on `PUT`/`DELETE`/`PATCH` (it fails closed to `403`, not direct execution)**, because `isAssignedSupervisor` rejects `assistant_admin` outright. However, this also blocks legitimate `INV-R7` + `INV-R9` / `DelegatedAuthority` workflows.
4. **Are approval requirements consistently enforced across `PUT`, `DELETE`, and `PATCH`?** **No.** `POST` calls `requireCapabilityOrApproval` (`INV-R9` `202`), whereas `PUT`, `DELETE`, and `PATCH` bypass it completely (`403` for `assistant_admin`).
5. **Can a valid delegated authority be applied to one HTTP method but bypassed or ignored by another?** **Yes.** A valid `DelegatedAuthority` for `materials.*` works on `POST /materials/files` (and `POST /folders`) via `requireCapabilityOrApproval`, but is completely ignored (`403`) on `PUT`, `DELETE`, and `PATCH`.
6. **Are the target resource's group ownership and assignment scope checked consistently?** **No (`Confirmed defect` — `High`).** `groupHandlers.ts` checks `groupId` from the URL, but `replaceMaterialFile`, `deleteMaterialFile`, and `updateMaterialFile` never verify `file.groupId === groupId`, enabling cross-group IDOR mutation/deletion across groups.
7. **Does `DELETE` perform logical Content Reference detachment or physical Media Asset deletion?** **Neither cleanly:** it physically deletes the in-memory `GroupMaterialFile` reference record (`this.materialFiles.filter(...)`) without preserving removal history (`INV-DOM21-18`) and without a separate Media Asset binary store.
8. **Could any endpoint modify reference metadata without the intended `materials.manage_references` authorization?** **Yes.** `PUT`, `DELETE`, and `PATCH` currently authorize via `isAssignedSupervisor` without any capability check (`materials.manage_references` is not yet implemented in `types.ts`/`policy.ts`/`groupHandlers.ts`).
9. **Are renewal-cycle state restrictions enforced consistently?** **No.** Neither `groupHandlers.ts` nor `inMemoryStore.ts` checks whether the target `GroupRenewalCycle` is Active / Unsealed vs. Sealed / Closed (`INV-DOM21-07`, `INV-DOM21-08`, `INV-DOM21-14`).
10. **What exact API contract and backend enforcement requirements remain unresolved?** Remaining `A-03c` items in `FRD-MEDIA-001` §7 item 1: logical reference state representation & audit fields, restoration/reattachment & identity reuse, exact Step 2 repoint / logical-detachment / asset-deletion routes/DTOs/status codes (`409`), asset soft-deletion/archival/permanent-deletion & zero-reference retention, and concurrency boundaries, plus `A-03b` (`PUT` amendment, `isVisible: false -> true`, in-flight `Range`).

---

## 10. Django Backend Contract Implications (`Deferred backend work` — Not Authorized for Implementation)

When implemented in Django / DRF + Microsoft SQL Server (without designing/freezing DB schemas here):
- **Required Capability:** Enforce `materials.manage_references` (`INV-DOM21-21`, `2026-11-14` preserved grant model) for Active / Unsealed Group Cycle reference add, `INV-DOM21-18` Logical Detachment, `INV-DOM21-12` Step 2 repointing, and `title`/`isVisible` updates — never `isAssignedSupervisor` alone, and never `materials.upload_files`/`delete_files`/`manage_folders`.
- **Group & Resource Ownership Scope:** Verify **both** actor authorization on `groupId` (`INV-R7` `GroupAssistantAssignment` for `assistant_admin`; `primaryInstructorId` or active `GroupAssistantAssignment` for `lecturer`; **never** `supervisorIds` alone per `INV-DOM17-01`; `INV-DOM03-02` preview barrier) **and** strict `reference.group_id == groupId` ownership before any mutation.
- **Lifecycle & Concurrency Safeguards:** Verify target cycle is Active / Unsealed (`409` / rejection on Sealed / Closed per `INV-DOM21-07`, `INV-DOM21-14`); enforce `INV-DOM21-16` immutability on `fileName`/`mimeType`/`sizeBytes`; enforce `INV-DOM21-17` dependency protection (`409 Conflict` if any reference depends on an asset); use SQL Server transactional locking on reference detachment vs. asset deletion.
- **Approval & Delegation (`INV-R9` / `INV-R10`):** For `assistant_admin`, default all four `materials.manage_references` operations to `202 Accepted` (`PendingApprovalRequest`) unless an active, non-expired, exact-capability (`materials.manage_references`) and `groupId`-scoped `DelegatedAuthority` exists; re-validate at `INV-R10` execution time and write dual-attribution audit logs.

---

## 11. Unresolved Questions and Owner Decisions

Already-approved principles are **not** reopened (separation of group administration and content authorization `2026-11-14`, preserved group-material grant model `2026-11-14`, `INV-R7`/`INV-R9`/`INV-R10` safeguards, and `INV-DOM17-01` `supervisorIds` monitoring-only). Remaining **`Owner decision required`** items under `A-03c` (tracked in [`FRD-MEDIA-001`](FRD-MEDIA-001-phase-1-media-architecture-requirements-baseline.md) §7 item 1):
1. Logical detachment state representation, removal audit fields, and whether detached references can be restored/reattached (and identity reuse).
2. Exact API paths/methods/DTOs/status codes for Step 2 repointing, Logical Detachment, narrowly amended `API-REC-07` `PUT`, and Media Asset Deletion.
3. Asset soft-deletion vs. archival vs. later permanent deletion, zero-reference retention/eligibility, concurrency boundaries, and `assistant_admin` Draft Course scope (`INV-R7` for `courses.edit_curriculum`).

---

## 12. Recommended Next Steps

1. Review `A-03c` unresolved API/lifecycle items in [`FRD-MEDIA-001`](FRD-MEDIA-001-phase-1-media-architecture-requirements-baseline.md) §7 item 1 with the Project Owner.
2. Only after explicit Owner authorization for runtime/backend work: implement `materials.manage_references` in `types.ts`/`policy.ts`, replace `isAssignedSupervisor`-only checks on `PUT`/`DELETE`/`PATCH` in `groupHandlers.ts` with `requireCapabilityOrApproval` + strict `file.groupId === groupId` + cycle-state checks + `INV-DOM17-01` `supervisorIds` exclusion, and add full authorization/lifecycle tests.

---

## 13. Verification Results

- **Inspection Method:** Direct read-only source inspection of `groupHandlers.ts`, `routeGuards.ts`, `resolveUser.ts`, `inMemoryStore.ts`, `policy.ts`, `types.ts`, and 4 test files; zero runtime, test, mock, backend, or schema files modified.
- **Governance Statuses Preserved:** `A-03c` (`OPEN`), `API-REC-06` (`DEFERRED`), `materials.manage_references` runtime implementation (`OUTSTANDING`), Phase 5 (`NOT AUTHORIZED`), Database schema freeze (`NOT AUTHORIZED`).

