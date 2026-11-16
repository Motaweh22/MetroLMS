# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 03 — Roles, Permissions & Switching

> **Document Title:** Technical Domain Specification — Roles, Permissions & Role Switching  
> **Document Identifier:** `METROLMS-TECH-DOM-003`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Security Architects  
> **Governing Decisions:** [`D-SEC-01`](../../../architecture/decision-register.md#d-sec-01), [`D-10`](../../../architecture/decision-register.md), [`D-14`](../../../architecture/decision-register.md), [`INV-R1`–`INV-R10`](../../../architecture/security-and-xss-baseline.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:**
  - `policy.ts`: Implements `evaluatePermission()` and `validatePermissionOverride(role, capability)` across the 3-layer capability model (`ROLE_CAPABILITY_CEILINGS`, `ROLE_DEFAULT_PERMISSIONS`, `UserPermissionOverride`) + `GroupAssistantAssignment` scope.
  - `ProtectedRoute.tsx`: Client-side UX route guard (never treated as the authoritative security boundary).
  - `RolePreviewContext.tsx` & `previewMutationBarrier.ts`: DEV-only Visual Role Preview (`معاينة الدور`), intercepting all unsafe HTTP mutations (`POST`/`PUT`/`PATCH`/`DELETE`) before network dispatch.
- **Target Backend Components (Django 5 + DRF):**
  - Authoritative DRF Permission Classes and Service-Layer RBAC guards enforcing `INV-R1`–`INV-R10`.
  - Serializer/Selector projection filters enforcing 11-surface Developer confidentiality (`INV-R8`, `D-14`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **6-Step Permission Evaluation:**
   - (1) Immutable Protected Invariants (`INV-R1`–`INV-R5`) $\rightarrow$ (2) `ROLE_CAPABILITY_CEILINGS` check $\rightarrow$ (3) Individual `UserPermissionOverride` (`allow`/`deny`) $\rightarrow$ (4) `ROLE_DEFAULT_PERMISSIONS` $\rightarrow$ (5) `GroupAssistantAssignment` scope (`INV-R7`) $\rightarrow$ (6) Approval Gate check (`INV-R9`, returning `202 PendingApproval` if required).
2. **11-Surface Developer Confidentiality (`INV-R8` & `D-14`):**
   - For all non-Developer actors, backend selectors strip `developer` rows from directories, KPIs, pickers, search, reports, and notifications; direct ID lookups return `404 Not Found` (never `403`); audit logs and entity attributions (`createdBy`, `reviewedBy`) project `actorId: 'SYSTEM'`, `actorRole: 'system'`, `actorName: 'النظام'`.
3. **Visual Role Preview vs. Isolated Sessions (`D-10`):**
   - Visual Role Preview alters UI presentation only (`AuthContext.user` remains `USR_DEV_001`) and blocks all mutations via `previewMutationBarrier.ts`.
   - Isolated Role Test Sessions switch active auth to `USR_TEST_*` per `LLD-001`.

---

## 3. Validation, Authorization & Failure Scenarios

- **Failure Scenarios & Edge Cases:**
  - Override exceeding role ceiling: Rejected with Arabic error (`"الصلاحية [X] تقع خارج السقف الأقصى المسموح به لدور [Y]..."`).
  - Ordinary `admin` attempting to appoint/create/mutate `admin`, `super_admin`, or `developer` (`INV-R2`, `INV-R3`, Owner Clarification `2026-11-13`): Immediate `403 Forbidden` (`INVARIANT_ADMIN_PROTECTED` / `INVARIANT_SUPER_ADMIN_EXCLUSIVITY`); `super_admin` (`Superior`) mutating peer `super_admin` (`OD-01`): Immediate `403 Forbidden`.
  - `/design-system` accessed in production or by non-Developer: `404 Not Found` (`MFR-25`).
- **Integration Boundaries & Constraints:** Detailed approval queue execution (`PendingApprovalRequest` state transitions) is specified in Phase 4 (Domain 18).

---

## 4. Traceability

- Business Rules: [`domain-03-roles-permissions-and-switching.md`](../../../01-requirements/domains/domain-03-roles-permissions-and-switching.md)
- Security Baseline: [`security-and-xss-baseline.md`](../../../architecture/security-and-xss-baseline.md)
- Permissions Design: [`authorization-and-permissions-design.md`](../../../frontend/authorization-and-permissions-design.md)

