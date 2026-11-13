# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 03 — Roles, Permissions & Switching

> **Document Title:** Domain 03 — Roles, Permissions, Ceilings & Role Switching Business Rules  
> **Document Identifier:** `METROLMS-DOM-ROLE-003`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-04 / OD-01`](../../architecture/decision-register.md), [`D-05 / OD-02`](../../architecture/decision-register.md), [`D-10`](../../architecture/decision-register.md), [`D-14`](../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Enforce the 6-tier role hierarchy, 3-layer capability resolution engine, immutable account protection invariants (`INV-R1`–`INV-R10`), 11-surface Developer confidentiality (`MFR-39`), Assistant Admin `Rule A` / `D-14` visibility, and `D-10` separation between Visual Role Preview and Isolated Role Test Sessions.
- **Domain Boundaries:**
  - *In Scope:* 6 canonical roles (`developer`, `super_admin`/`superior`, `admin`, `assistant_admin`, `lecturer`, `user`/`trainee`), `ROLE_CAPABILITY_CEILINGS`, `ROLE_DEFAULT_PERMISSIONS`, `UserPermissionOverride`, `Rule A`, `D-14` neutral projection, `INV-R1`–`INV-R10`, and `D-10` Visual Role Preview (`RolePreviewContext` + `previewMutationBarrier`).
  - *Out of Scope:* Detailed approval queue UI/lifecycle (Domain 18 in Phase 4) and group roster membership rules (Domains 08–09 in Phase 2B).
- **Actors & Responsibilities:**
  - *Developer (`developer`):* Hidden system maintainer (`INV-R8`), sole actor for DEV-only Role Preview and Isolated Role Test Sessions (`D-10`).
  - *Super Admin / Superior (`super_admin` / `superior`):* Read-only global observer (`INV-R6`, `OD-01`), zero mutation capabilities.
  - *System Admin (`admin`):* Full organizational governance within `INV-R1`–`INV-R5`; configures role defaults, individual overrides, and Assistant Admin bypass flags.
  - *Assistant Admin (`assistant_admin`):* Global read visibility (`Rule A` + `D-14`), group-scoped write authority (`INV-R7`), sensitive mutations gated by `INV-R9`/`INV-R10`.
  - *Lecturer (`lecturer`) & Trainee (`user`):* Teaching/authoring within ceiling and personal learning respectively; `assistant_lecturer` is a group-scoped assignment on `lecturer`, not a 7th canonical role.
- **Core Entities:** `RoleCapabilityCeiling`, `RoleDefaultPermissions`, `UserPermissionOverride`, `GroupAssistantAssignment`, `RolePreviewState`.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-R1`–`INV-R3`** | **Developer Account Immutability** | `developer` accounts cannot be created, assigned, promoted, demoted, suspended, or deleted via any UI or public API (bootstrap CLI only). | Django RBAC & `policy.ts` |
| **`INV-R4`–`INV-R5`** | **Protected & Peer Admin Boundaries** | `isProtectedAdmin === true` cannot be deleted/demoted by anyone including `developer`; regular `admin` cannot mutate `developer` or `super_admin`/`Protected Admin` (`D-04`, `D-05`). | Django RBAC & `policy.ts` |
| **`INV-R6`** | **Read-Only Superior Ceiling** | `superior`/`super_admin` has zero write/mutation capabilities (`403 Forbidden` on all mutating endpoints). | Django RBAC & `policy.ts` |
| **`INV-R7` & `Rule A`** | **Assistant Admin Global Read / Scoped Write** | `assistant_admin` has global read visibility across non-Developer users, groups, courses, enrollments, and Security Audit logs (`D-14`), with writes strictly scoped to `GroupAssistantAssignment`. | Django RBAC & `policy.ts` |
| **`INV-R8` & `D-14`** | **11-Surface Developer Confidentiality** | For all non-Developer actors (or Developer in preview/isolated mode), `developer` accounts are stripped from all 11 surfaces, direct lookups return `404 Not Found` (never `403`), and audit logs project `actorId: 'SYSTEM'`, `actorRole: 'system'`, `actorName: 'النظام'`. | Django Serializers & Selectors |
| **`INV-R9` & `INV-R10`** | **Sensitive Mutation Approval Gate** | Sensitive `assistant_admin` mutations return `202 Accepted` (`PendingApproval`) unless bypass is enabled; execution re-validates existence, scope, and `INV-R1`–`INV-R8`. | Approval Service |
| **`INV-DOM03-01`** | **3-Layer Ceiling Enforcement** | Effective permission = `(Override ?? RoleDefault) ∩ RoleCeiling ∩ GroupScope`; overrides exceeding `ROLE_CAPABILITY_CEILINGS` are rejected. | `validatePermissionOverride` & Backend Policy |
| **`INV-DOM03-02`** | **Visual Role Preview Isolation (`D-10`)** | Visual Role Preview (`معاينة الدور`) alters UI layout only; `AuthContext.user` stays `USR_DEV_001`, and all mutations (`POST`/`PUT`/`PATCH`/`DELETE`) are blocked client-side before network dispatch. | `RolePreviewContext` & `previewMutationBarrier.ts` |

---

## 3. State Transition Rules

- **Allowed Transitions:**
  - `RoleDefault` / `UserPermissionOverride` updates by `admin` strictly within `ROLE_CAPABILITY_CEILINGS`.
  - `Developer` in `S1` toggling Visual Role Preview (`previewRole` $\in$ non-Developer roles or `null`) without changing `AuthContext.user`.
- **Forbidden Transitions:**
  - Granting any capability outside `ROLE_CAPABILITY_CEILINGS`.
  - Promoting/demoting any account to/from `developer` (`INV-R2`).
  - Mutating state while Visual Role Preview is active (`previewMutationBarrier`).

---

## 4. Dependencies, Unresolved Questions & Traceability

- **Cross-Domain Dependencies:**
  - *Domain 01:* Provides `AuthContext.user` and `S0`–`S15` isolated session states (`D-10`).
  - *Domain 02:* Provides `User` records and `isProtectedAdmin` flags.
- **Confirmed Decisions vs. Unresolved Owner Questions:**
  - *Confirmed:* `D-SEC-01`, `D-04/OD-01`, `D-05/OD-02`, `D-10`, `D-14`, `Rule A`, `INV-R1`–`INV-R10`.
  - *Unresolved:* None blocking Phase 2A. (Note: Role identifier normalization between `super_admin` and `superior` in legacy vs. Phase A docs is documented as an alias mapping to Tier 1/2 read-only/supervisory privilege).
- **Traceability:** [`SRS-001`](../srs/SRS-001-core-system-requirements.md) (`REQ-AUTH-05`), [`security-and-xss-baseline.md`](../../architecture/security-and-xss-baseline.md) (§6–§7), [`authorization-and-permissions-design.md`](../../frontend/authorization-and-permissions-design.md), [`domain-business-rules.md`](../../requirements/domain-business-rules.md) (§1–§3).

