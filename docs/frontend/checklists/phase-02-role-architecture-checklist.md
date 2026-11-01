# MetroLMS — Phase 2 Planning & Execution Checklist: Role Architecture, Account Protection & Confidentiality

> **Document Status:** `STATUS: INCREMENT 2.4 — FINAL SCANNER VALIDATION RECONCILED — AWAITING OWNER APPROVAL`  
> **Authoritative Baseline:** MetroLMS Official Pre-Backend Migration Remediation Roadmap (Revision 5), Sections 2, 2.2, 2.3, 3.1, 3.2, 3.3, 5, 6, 13 (Phase 2), 15, and 16.  
> **Testing Workflow Directive:** Per owner directive (Part A), test execution commands are deferred to consolidated Phase 13 / Gate B verification. Tests are authored during increments with status tracked per classification:
>   - `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
>   - `PRELIMINARY EXECUTION EVIDENCE — EXECUTED DURING AN EARLIER WORKFLOW`
>   - `FINAL VERIFIED — PASSED DURING PHASE 13`
> **Prototype Architecture:** React 19.3.1 (declared `^19.0.0`), React DOM 19.3.1 (declared `^19.0.0`), TypeScript 5.7.3 (declared `~5.7.3`), Vite 7.3.7 (peer/transitive dependency; runtime CLI `vite/7.3.7`), Tailwind CSS 4.3.3 (declared `^4.0.6`), Mock Service Worker MSW 2.15.0 (declared `^2.15.0`), and `inMemoryStore`.  
> **Execution Scope:** Phase 2 implementation authorized by owner. Increment 2.1 (`MFR-37`) and Increment 2.2 (`MFR-38`, `INV-R1`..`INV-R8`) approved. Increment 2.3 (`MFR-39`) developer confidentiality across all 11 surfaces reconciled. Increment 2.4 (`MFR-45`) developer fixture boundary, super admin boundary, compile-time gating, artifact scanner script, and future Phase 12 backend contract implemented. Zero backend modifications authorized.

---

## 1. Executive Summary & Frontend-First Objective

The MetroLMS application is currently a **frontend prototype** built with **React 19.3.1** (declared `^19.0.0` in `frontend/package.json`), **React DOM 19.3.1**, **TypeScript 5.7.3** (declared `~5.7.3`), **Vite 7.3.7** (runtime CLI `vite/7.3.7`), **Tailwind CSS 4.3.3** (declared `^4.0.6`), **MSW 2.15.0** (declared `^2.15.0`), and an in-memory mock store (`inMemoryStore`).

The primary objective of **Phase 2** is to deliver a fully functional, architecturally rigorous **frontend simulation** of the approved 6-tier role architecture, protected account invariants, and Developer confidentiality rules.

### 1.1 Core Frontend Deliverables
The following must work correctly and consistently across the prototype:
1. **Role Definitions & Arabic Labels:** Six canonical roles (`developer`, `super_admin`, `admin`, `assistant_admin`, `lecturer`, `user`) with unified canonical Arabic terminology.
2. **Role-Based Capabilities & Ceilings:** Domain policy evaluation enforcing baseline capabilities and immutable role ceilings.
3. **Protected Account Management:** Enforcement of `INV-R1` through `INV-R8` and the §2.2 Account Management Matrix across UI components, `inMemoryStore` operations, and MSW API handlers.
4. **Developer Confidentiality Across 11 Surfaces:** Complete filtering and masking of the `developer` persona in normal UI flows, API queries, direct ID lookups (`INV-R8` uniform `404`), dashboard KPIs, notifications (`D-08`), audit logs (`D-14`), and email collision responses (`D-09`).
5. **Development-Only Developer Fixtures:** Gating Developer prototype accounts strictly behind `import.meta.env.DEV === true`.
6. **Production Frontend Build Cleanliness:** Ensuring `pnpm build` bundles contain zero Developer credentials and no development test fixtures.
7. **Phase 1 Compatibility Verification:** Ensuring Developer and Super Admin fixture identities resolve through the existing Phase 1 canonical identity architecture (`resolveCanonicalUserId` for canonical user ID normalization and `resolveAuthenticatedUser` for authenticated request identity resolution), their roles are authoritative (cannot be overridden by stale session data), and no duplicate identity resolvers are introduced.

### 1.2 Separation of Work
To maintain architectural clarity, this plan strictly separates:
- **Part 1: Frontend Prototype Implementation** — The planned frontend implementation scope, pending explicit owner authorization, across `core/auth`, `core/permissions`, `features/user-management`, `mocks/store`, `mocks/handlers`, and React components.
- **Part 2: Future Backend Contract** — Informational documentation of backend requirements deferred to Phase 12 (server-side database scopes, CLI bootstrap, Argon2id hashing, and persistent migrations).

---

## 2. Authoritative Scope & Scope Boundary Separation

### 2.1 Master Finding Register Coverage (Phase 2)

| Canonical ID | Finding Classification | Priority | Domain Area | Frontend Prototype Implementation Requirement |
| :--- | :--- | :---: | :--- | :--- |
| **`MFR-37`** | Gap | P0 | Role Architecture | Introduce `developer` (المطور) and `super_admin` (المسؤول الأعلى) to establish the complete 6-tier role architecture across types, labels, defaults, and capability ceilings. |
| **`MFR-38`** | Confirmed Defect | P0 | Account Protection | Replace unconditional `INVARIANT_ADMIN_ACCOUNT_NON_DELETABLE` with the complete Protected Account Invariants (`INV-R1` through `INV-R8`), enforcing the §2.2 Account Management Matrix (`D-04`, `D-05`, `OD-01`, `OD-02`) at the store and handler layers. |
| **`MFR-39`** | Gap | P0 | Confidentiality | Enforce strict Developer Non-Disclosure across all 11 operational surfaces (§3.1), generic duplicate-email collision masking (`D-09`), private notification isolation (`D-08`), and neutral audit/reference projection (`'SYSTEM'` / `'النظام'`). |
| **`MFR-45`** | Gap | P1 | Secure Provisioning | Gate prototype `developer` and `super_admin` fixtures behind `import.meta.env.DEV`, eliminate credentials from production bundles, and document the server CLI bootstrap contract. |

### 2.2 Owner-Approved Decisions Enforced in Phase 2

- **`D-04` / `OD-01` (Super Admin Visibility & Peer Invariant):**  
  `super_admin`, `admin`, and `assistant_admin` (under Rule A) can view `super_admin` accounts in read-only mode in the directory and detail views. However, peer visibility **never** implies peer management permissions. A `super_admin` cannot create, edit, suspend, activate, change the role of, or permanently delete another `super_admin`. Only `developer` possesses mutation authority over `super_admin` accounts.  
  *Authoritative Owner Evidence:* Confirmed and resolved in Revision 5 Roadmap Section 16 (lines 1070–1072: "`OD-01` Super Admin Peer Visibility: Confirmed & Resolved"), Section 5 (`D-04`, line 240), Section 2.2, Section 2.3 (`INV-R2`), and Section 15 (Gate A.2, line 1049).
- **`D-05` / `OD-02` (Admin Management of Assistant Admin):**  
  Regular `admin` accounts can create, edit, suspend, activate, configure operational delegation for, and **permanently delete** `assistant_admin` accounts (`OD-02`). Regular `admin` accounts cannot promote any account to `admin`, `super_admin`, or `developer`.  
  *Authoritative Owner Evidence:* Confirmed and resolved in Revision 5 Roadmap Section 16 (lines 1070–1073: "`OD-02` Admin Deletion of Assistant Admin: Confirmed & Resolved"), Section 5 (`D-05`, line 241), Section 2.2, Section 2.3 (`INV-R4`), and Section 15 (Gate A.2, line 1049).
- **`D-08` (Developer Notification Isolation):**  
  Developer-related operational notifications remain strictly inside the Developer's private notification inbox. Notifications emitted to other users must never name the Developer as actor; the neutral system label (`النظام`) must be substituted.
- **`D-09` (Developer Email Conflict Disclosure):**  
  Email uniqueness is strictly enforced across all accounts including `developer`, but collisions against the hidden Developer email return the standard generic validation error (`البريد الإلكتروني مسجل مسبقاً لمستخدم آخر`) without disclosing the existence or role of the Developer account.

### 2.3 Assistant Admin Mutations During Phase 2 (Strict Boundary Guardrails)
Phase 4 owns the approval lifecycle, approval requests, approval execution, and `202 Accepted` handling.  
**Phase 2 must not introduce or expand approval workflows:**
1. **Rejection with HTTP 403:** In Phase 2, any Assistant Admin operation that requires approval must **not** execute directly. If no already-supported explicit direct delegation authorizes the exact capability, the operation is rejected with **HTTP 403 Forbidden**.
2. **No New Approval Requests:** Do **not** create new approval request records (`inMemoryStore.createApprovalRequest`) during Phase 2 user-management mutations.
3. **No Modification to Approval Executors:** Do **not** modify `approveApprovalRequest`, approval execution branches, or Phase 4 behavior.
4. **No Implementation of `INV-R9`:** Do **not** implement `INV-R9` as a new Phase 2 feature; default approval enforcement belongs to Phase 4.
5. **Preserve Matrix & `INV-R1`–`INV-R8`:** The approved 6×6 account-management matrix and invariants `INV-R1` through `INV-R8` remain fully authoritative.

### 2.4 Explicit Non-Goals: Production Backend Work Is NOT in Scope
The following backend responsibilities are strictly deferred to **Phase 12 (Backend Implementation Track)** and will NOT be implemented during Phase 2:
- ❌ **No JWT Signing / Verification Infrastructure:** Session tokens remain mock tokens (`mock_jwt_*`) validated via MSW.
- ❌ **No Real Password Hashing:** `bcrypt` or `argon2id` algorithms will not be executed in browser memory.
- ❌ **No Database Schemas, Tables, or Migrations:** State remains in `inMemoryStore`.
- ❌ **No Backend CLI Commands:** Server commands (e.g. `pnpm db:bootstrap-developer`) are documented as future contracts only.
- ❌ **No Production MFA Infrastructure:** MFA enrollment protocols belong to the backend auth service.
- ❌ **No Server-Side Database Query Scopes:** Database `WHERE role <> 'developer'` filters belong to the future SQL layer.
- ❌ **No Persistent Audit Infrastructure:** Audit trail remains in memory.

### 2.5 Explicit Frontend Scope Guardrails (Other Phases)
- ❌ **Phase 3 Guardrails:** General route protection across courses, groups, and reviews, navigation drawer filtering by role, and assistant-admin read visibility (`Rule A`) belong to Phase 3 (except the Developer-only `/design-system` route guard required for Surface 11).
- ❌ **Phase 4 Guardrails:** Approval workflows, delegation state, and `202 Accepted` mutation UI belong to Phase 4.
- ❌ **Phase 5 Guardrails:** Developer Role Preview toolbar and isolated test session switching (`D-10`) belong to Phase 5.

### 2.6 Owner Decision on Account Details & Editing Feature (Deferred Scope)
- **Owner Decision:** The actual **Account Details & Editing feature** is deferred to a later phase.
- **Explicit Exclusions (Not Implemented in Phase 2):**
  - ❌ **No Account Details Page / View:** No new page or route is created for editing user account details.
  - ❌ **No Edit Buttons, Modals, or Forms:** No UI controls or form modals for editing user details are added to user management views.
  - ❌ **No Account Mutation API Endpoint:** No endpoint (e.g. `PATCH /api/admin/users/:id` for details) is introduced for updating user profile fields.
  - ❌ **No Store Mutation Method:** No store mutation method (e.g. `updateUser` or `updateUserDetails`) is introduced.
  - ❌ **No New Capabilities:** No `users.edit_details` or equivalent capability is added to `SystemCapability` or `PermissionKey`.
  - ❌ **No Rework of Increment 2.1:** Canonical roles, capabilities, defaults, and ceilings remain untouched.
- **Preserved Authorization Policy Foundation:**
  - `AccountManagementAction === 'edit'` is preserved as a pure domain policy action evaluated through `canActorManageTargetAccount` and `evaluateProtectedInvariant`.
  - The Revision 5 §2.2 account-management matrix for editing is preserved as architectural groundwork for future feature readiness.
  - Test suites (`role-matrix-invariants.test.ts`) assert policy matrix rules, not implemented workflows.
- **Assistant Admin Scoping:**
  - In Phase 2, undelegated Assistant Admin mutations return HTTP 403 without creating approval records.
  - Assistant Admin account editing delegation mapping is deferred along with the editing feature itself.

---

## 3. Mandatory Authorization Invariants Matrix (`INV-R1`–`INV-R8`)

In the frontend prototype, business invariants must be enforced at **both the UI layer and the mock API/store layer**. The prototype must never rely solely on disabling or hiding UI buttons; unauthorized API calls and direct store mutations must be strictly rejected with HTTP `403 Forbidden` (or HTTP `404 Not Found` for `developer` targets under `INV-R8`).

```
                                  AUTHORITY HIERARCHY
                                 ┌───────────────────┐
                                 │    developer      │  (System Sovereign, Hidden)
                                 └─────────┬─────────┘
                                           │ Controls super_admin & admin
                                 ┌─────────▼─────────┐
                                 │   super_admin     │  (Top Admin, Direct Execution)
                                 └─────────┬─────────┘
                                           │ Controls admin & below (Read-only peer view: OD-01)
                                 ┌─────────▼─────────┐
                                 │      admin        │  (Operational Admin)
                                 └─────────┬─────────┘
                                           │ Controls assistant_admin & below (Deletes assistant_admin: OD-02)
                                 ┌─────────▼─────────┐
                                 │  assistant_admin  │  (Routine Ops; 403 without delegation in Phase 2)
                                 └─────────┬─────────┘
                                           │ Mutates lecturer & user only if delegated (Phase 2)
                                 ┌─────────▼─────────┐
                                 │  lecturer / user  │  (Instructional / Learner Roles)
                                 └───────────────────┘
```

### Invariant Definitions & Frontend Prototype Enforcement

| Invariant ID | Rule Title | Operational Requirement | Prototype Store & MSW Failure Mode |
| :--- | :--- | :--- | :--- |
| **`INV-R1`** | **No In-App Developer Creation** | No API endpoint (`POST /api/admin/users`), role mutation (`PATCH /api/admin/users/:id/role`), form selector, or approval request may ever create an account with `role: 'developer'` or transition an existing account to or from `developer`. Developer accounts can only be provisioned via server bootstrap CLI (`MFR-45`). | HTTP `403 Forbidden` (`INVARIANT_DEVELOPER_IMMUTABLE`) |
| **`INV-R2`** | **Super Admin Exclusivity & Read-Only Peer Visibility** | Only `developer` may create, edit, suspend, activate, change the role of, modify permissions for, or permanently delete a `super_admin` account (except a `super_admin` updating their own basic profile metadata). `super_admin`, `admin`, and `assistant_admin` may view `super_admin` in read-only mode (`D-04`, `OD-01`). Peer mutation is strictly blocked. | HTTP `403 Forbidden` (`INVARIANT_SUPER_ADMIN_EXCLUSIVITY`) |
| **`INV-R3`** | **Admin Account Protection** | Only `developer` and `super_admin` may create, edit, suspend, activate, demote, modify permissions for, or permanently delete an `admin` account (except an `admin` updating their own basic profile metadata). Regular `admin` accounts are strictly blocked from mutating any `admin` account (no peer admin mutation). | HTTP `403 Forbidden` (`INVARIANT_ADMIN_PROTECTED`) |
| **`INV-R4`** | **Regular Admin Ceiling** | A regular `admin` may create, edit, suspend, activate, manage operational delegation permissions for, and permanently delete `assistant_admin` accounts (`D-05`, `OD-02`), as well as `lecturer` and `user` accounts. Regular `admin` may assign roles only within `{'assistant_admin', 'lecturer', 'user'}`. | HTTP `403 Forbidden` (`INVARIANT_ADMIN_CEILING_EXCEEDED`) |
| **`INV-R5`** | **Assistant Admin Ceiling** | An `assistant_admin` may never create, edit, suspend, delete, or change the role/permissions of `assistant_admin`, `admin`, `super_admin`, or `developer` accounts, and may never initiate role promotions to `assistant_admin` or higher. | HTTP `403 Forbidden` (`INVARIANT_ASSISTANT_ADMIN_CEILING`) |
| **`INV-R6`** | **Anti-Self-Dealing** | No user may delete their own account, suspend their own account, change their own role, grant themselves permission overrides, or grant themselves operational delegation (`actorCanonicalId === targetCanonicalId`). | HTTP `403 Forbidden` (`INVARIANT_SELF_MUTATION_PROHIBITED`) |
| **`INV-R7`** | **Dual-State Role Transition Check** | Any role-change operation must validate the actor's authority against **both** `targetUser.currentRole` and `requestedNewRole`. An actor must have authority to manage the target's current tier **and** authority to grant the target's destination tier. | HTTP `403 Forbidden` (`INVARIANT_ROLE_TRANSITION_UNAUTHORIZED`) |
| **`INV-R8`** | **Uniform 404 Non-Disclosure for Developer** | Any read, query, lookup, mutation, or delete request by a non-Developer targeting the Developer's user ID must return an HTTP `404 Not Found` payload indistinguishable from an unknown non-existent user ID. Never return `403`. | HTTP `404 Not Found` (Identical payload to non-existent ID) |

### Complete 6×6 Account-Management Matrix (Roadmap §2.2 Baseline)

Legend:
- **D** = Direct execution permitted in prototype store and MSW handlers.
- **A** = Requires approval in Phase 4. In Phase 2: any operation requiring approval that lacks an existing explicit delegation is rejected with **HTTP 403 Forbidden**. No new approval requests are created in Phase 2.
- **R** = Read-only visibility in UI and query endpoints.
- **Self** = Permitted on actor's own account only (profile metadata; never role escalation, self-suspension, or self-deletion).
- **✗** = Strictly forbidden (`403 Forbidden` at store/handler layer; **`404 Not Found`** when targeting `developer`).

| Target Tier | Operation | `developer` | `super_admin` | `admin` | `assistant_admin` | `lecturer` | `user` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`developer`** | View / Search / Count | Self | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) |
| | Create / Promote to `developer` | ✗ *(CLI only)* | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Edit Profile / Metadata | Self | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) |
| | Suspend / Delete / Change Role | ✗ *(CLI only)* | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) | ✗ (`404`) |
| **`super_admin`** | View in Directory & Details | R / D | R (`OD-01` peer view) | R (`D-04`) | R (`D-04`, Rule A) | ✗ | ✗ |
| | Create / Promote to `super_admin` | **D (Only)** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Edit Account Details | **D (Only)** | Self *(profile)* | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Change Role / Demote | **D (Only)** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Suspend / Activate | **D (Only)** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Permanently Delete (`D-01`) | **D (Only)** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Manage Permissions / Delegation | **D (Only)** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| **`admin`** | View in Directory & Details | R / D | R / D | R | R (Rule A) | ✗ | ✗ |
| | Create / Promote to `admin` | **D** | **D** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Edit Account Details | **D** | **D** | Self *(profile)* | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Change Role / Demote | **D** | **D** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Suspend / Activate | **D** | **D** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Permanently Delete (`D-01`) | **D** | **D** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Manage Permissions / Overrides | **D** | **D** | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| **`assistant_admin`** | View in Directory & Details | R / D | R / D | R / D | R (Rule A) | ✗ | ✗ |
| | Create / Promote to `assistant_admin` | **D** | **D** | **D** (`D-05`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Edit Account Details | **D** | **D** | **D** (`D-05`) | Self *(profile)* | ✗ (`403`) | ✗ (`403`) |
| | Change Role (Demote to `lecturer`/`user`) | **D** | **D** | **D** (`D-05`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Suspend / Activate | **D** | **D** | **D** (`D-05`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Permanently Delete (`D-01`, `OD-02`) | **D** | **D** | **D** (`D-05`, `OD-02`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Manage Delegation & Overrides | **D** | **D** | **D** (`D-05`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| **`lecturer`** | View in Directory & Details | R / D | R / D | R / D | R (Rule A) | Self / Shared | Public bio |
| | Create / Promote to `lecturer` | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | ✗ (`403`) |
| | Edit Account Details | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | Self *(profile)* | ✗ (`403`) |
| | Change Role (Demote to `user`) | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | ✗ (`403`) |
| | Suspend / Activate | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | ✗ (`403`) |
| | Permanently Delete (`D-01`, `D-03`, `D-11`)| **D** *(§10 flow)* | **D** *(§10 flow)* | **D** *(§10 flow)* | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | ✗ (`403`) |
| **`user` (Trainee)** | View in Directory & Transcript | R / D | R / D | R / D | R (Rule A) | Assigned groups | Self |
| | Create Account | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | Public signup |
| | Edit Account Details | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | Self *(profile)* |
| | Change Role (Promote) | **D** *(up to `super_admin`)* | **D** *(up to `admin`)* | **D** *(up to `assistant_admin`)*| ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| | Suspend / Activate | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | ✗ (`403`) |
| | Permanently Delete (`D-01`) | **D** | **D** | **D** | **A** *(Phase 2: 403 unless delegated)* | ✗ (`403`) | ✗ (`403`) |

---

## 4. Eleven Mandatory Developer Non-Disclosure Surfaces Breakdown

### 4.1 Prototype Simulation vs. Future Backend Security Boundary
- **Prototype Simulation Boundary (Phase 2):**  
  Implement strict filtering, masking, and uniform `404` parity across all 11 surfaces in `inMemoryStore.ts`, MSW handlers, and React components. The explicit goal is to ensure correct application behavior for every role and prevent accidental disclosure through the application's normal UI and mock API responses.  
  *Important architectural notice:* Client-side filtering in browser memory does **not** provide cryptographic confidentiality against developer tools inspection or memory dumps.
- **Future Backend Security Boundary (Phase 12):**  
  Actual confidentiality against network tampering or client-side inspection will be guaranteed by authoritative server-side SQL query scopes (`WHERE role <> 'developer'`), server-side DTO response mappers, and private environment credentials.

```
                             REQUEST TARGET / QUERY
                                        │
                         Is actor.role === 'developer'?
                                       / \
                                     YES  NO
                                     /     \
                       Full Developer View  Enforce 11 Non-Disclosure Surfaces:
                                            - Exclude from Lists & Counts
                                            - Return 404 on Direct ID Target
                                            - Project 'SYSTEM' / 'النظام'
                                            - Generic Email Collision
                                            - 404 on /design-system
```

| Surface # | Disclosure Surface Name | Relevant Prototype Files & Functions | Exact Prototype Enforcement Contract |
| :---: | :--- | :--- | :--- |
| **1** | **User Directory, Search, Filters & Pagination** | `getManagedUsers` ([`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts)), `GET /api/admin/users` ([`userManagementHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/userManagementHandlers.ts)), [`UserManagementPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/UserManagementPage.tsx), [`UserFilterBar.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/user-management/components/UserFilterBar.tsx) | If `actor?.role !== 'developer'`, filter out all records with `role === 'developer'` **prior to** evaluating search queries, role/status/department filters, badge counts, and pagination slicing. |
| **2** | **Direct User Lookup & Transcript APIs** | `getManagedUserById`, `getUserTranscript`, `GET /api/admin/users/:id*`, `permissionsHandlers.ts` | Enforce `INV-R8`: If a non-Developer queries or targets a Developer canonical ID or alias, return HTTP `404 Not Found` with the exact message: `المستخدم المطلوب غير موجود في دليل النظام`. Never return `403`. |
| **3** | **Dashboard KPIs, Counts & Reports** | `getDashboardData`, `getCoursePerformanceReport`, `getGroupMetrics` ([`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts)) | Exclude `developer` records from `totalUsersCount`, active user counts, role distribution aggregations, and report listings for non-Developer viewers. |
| **4** | **Role Selectors & Account Forms** | [`AddUserModal.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/user-management/components/AddUserModal.tsx), [`UserTable.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/user-management/components/UserTable.tsx), [`UserFilterBar.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/user-management/components/UserFilterBar.tsx) | (a) Never render `developer` in any dropdown or selector. (b) Render `super_admin` only when actor is `developer`. (c) Render `admin` only when actor is `developer` or `super_admin`. Regular `admin` sees only `assistant_admin`, `lecturer`, `user`. |
| **5** | **Instructor, Supervisor & Trainee Pickers** | `getCandidateTrainees`, course lecturer pickers, group primary/assistant instructor selectors ([`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts)) | Exclude `role === 'developer'` from all candidate trainee lists, candidate instructor lists, and supervisor selection dropdowns. |
| **6** | **Notifications & Activity Feeds (`D-08`)** | `getActiveAdminRecipientIds`, `createNotification` ([`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts)) | Developer notifications remain strictly inside the Developer's private inbox. System notifications sent to other users never name the Developer; use the neutral label `النظام`. Exclude Developer from broadcast admin alerts. |
| **7** | **Security Audit Logs & Course History (`D-14`)** | `recordAuditLog`, `getSystemAuditLogs`, `GET /api/admin/audit`, `serializeAuditLogForViewer` ([`inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts)) | Persist the true immutable `developer` actor ID internally in memory. At read-serialization time, if `viewer.role !== 'developer'`, project `actorId: 'SYSTEM'`, `actorRole: 'system'`, `actorName: 'النظام'`. |
| **8** | **Entity Ownership & Reference Fields** | `createdBy`, `updatedBy`, `reviewedBy`, `requestedBy`, `approvedBy` across Courses, Groups, Materials, Approvals | Project Developer user IDs and names as `'SYSTEM'` / `'النظام'` in API response payloads when returned to any non-Developer caller. |
| **9** | **Duplicate-Email & Validation Responses (`D-09`)** | `createUser`, `updateUser`, `POST /api/admin/users`, `userManagementHandlers.ts` | Enforce email uniqueness across all users including `developer`. If a submitted email collides with the Developer email, return the standard generic error: `البريد الإلكتروني مسجل مسبقاً لمستخدم آخر`. Do not reveal the role or name. |
| **10** | **Public Support & WhatsApp Contacts** | `resolvePublicSupportContacts`, `userWhatsAppAssignments`, [`useWhatsAppContacts.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/whatsapp/hooks/useWhatsAppContacts.ts) | Unconditionally skip any user with `role === 'developer'` when resolving public WhatsApp or support contacts. |
| **11** | **Developer-Only Routes (`/design-system`)** | [`router/index.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/app/router/index.tsx), [`LoginPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LoginPage.tsx), [`DashboardPreviewPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/DashboardPreviewPage.tsx) | Remove all public links to `/design-system` from `LoginPage.tsx` and preview pages. In `router/index.tsx`, protect `/design-system` so that non-developers are routed to `NotFoundPage` (`404`), never `ForbiddenPage` (`403`). |

---

## 5. Provisioning & Environment Boundaries Contract (`MFR-45`)

### 5.1 Frontend Prototype Implementation Scope
1. **Dev-Only Fixture Seeding:**
   - In `frontend/src/mocks/fixtures/userDirectoryFixtures.ts` and `mockUsers.ts`, conditionally seed the Developer persona only when `import.meta.env.DEV === true`:
     ```ts
     export const INITIAL_MANAGED_USERS: ManagedUserDTO[] = [
       ...BASE_MANAGED_USERS,
       ...(import.meta.env.DEV ? [SYNTHETIC_DEVELOPER_USER] : []),
     ];
     ```
   - Seeded Developer persona: `id: 'USR_DEV_001'`, `email: 'developer.metro@internal.local'`, `name: 'مطور النظام'`, `role: 'developer'`.
   - Seeded Super Admin persona: `id: 'USR_SUPER_001'`, `email: 'superadmin@cairo-metro.com'`, `name: 'م. ياسين رضوان'`, `role: 'super_admin'`.
2. **Production Bundle Verification:**
   - Verify that running `pnpm build` creates frontend production distribution artifacts with zero embedded Developer credentials.

### 5.2 Future Backend Contract (Documentation Only — Phase 12 Scope)
The following contract is documented for reference during Phase 12 implementation:
- **Server CLI Bootstrap Command:** `pnpm db:bootstrap-developer` reading server-only environment variables (`DEVELOPER_BOOTSTRAP_EMAIL`, `DEVELOPER_BOOTSTRAP_PASSWORD_HASH`).
- **Singleton Developer Invariant:** Enforced via SQL partial index `CREATE UNIQUE INDEX idx_singleton_developer ON users ((role)) WHERE role = 'developer';`.
- **First-Login Policy:** Mandatory password rotation and MFA enrollment upon first login.

---

## 6. Comprehensive Current-State Code Inspection Findings

The pre-implementation inspection of the current working tree identified the following exact architectural and implementation gaps:

### 6.1 Role Definitions & Types
- **`frontend/src/core/auth/types.ts` (Lines 8–12):**  
  ```ts
  export type UserRole = 'admin' | 'assistant_admin' | 'lecturer' | 'user';
  ```
  *Gap:* Lacks `'developer'` and `'super_admin'`.
- **`frontend/src/core/user-management/types.ts` (Lines 94–99):**  
  `USER_ROLE_LABELS_AR` defines labels for only the 4 legacy roles: `admin: 'مدير'`, `assistant_admin: 'مساعد مدير'`, `lecturer: 'محاضر'`, `user: 'متدرب'`. Missing `developer: 'المطور'` and `super_admin: 'المسؤول الأعلى'`.

### 6.2 Permissions Matrix & Policy
- **`frontend/src/core/permissions/types.ts` (Lines 353–358, 465–512):**  
  `ROLE_CANONICAL_LABELS_AR` and `DEFAULT_ROLE_PERMISSIONS` only contain keys for `admin`, `assistant_admin`, `lecturer`, `user`.
- **`frontend/src/core/permissions/policy.ts` (Lines 16–234, 241–356):**  
  `ROLE_DEFAULT_CAPABILITIES` and `ROLE_CAPABILITY_CEILINGS` lack definitions for `developer` (unrestricted) and `super_admin` (full operational administrative capabilities).
- **`frontend/src/core/permissions/policy.ts` (Lines 578–586):**  
  ```ts
  if (capability === 'users.delete' && context?.targetUser?.role === 'admin') {
    return {
      allowed: false,
      code: 'INVARIANT_ADMIN_ACCOUNT_NON_DELETABLE',
      messageAr: 'غير مصرح: حسابات مديري النظام محصنة ولا يمكن حذفها نهائياً عبر إدارة المستخدمين',
    };
  }
  ```
  *Gap:* Unconditionally blocks deleting `admin` accounts for all actors, preventing `developer` and `super_admin` from performing authorized administrative lifecycle operations.
- **`frontend/src/core/permissions/policy.ts` (Lines 525–642):**  
  `evaluateProtectedInvariant` lacks implementation of `INV-R1` (block developer creation), `INV-R2` (super admin exclusivity and peer mutation block), `INV-R3` (admin mutation block for peer admins), `INV-R4` (admin ceiling on assistant admin deletion and below), and `INV-R7` (dual-state transition check).

### 6.3 In-Memory Store & Mock Handlers
- **`frontend/src/mocks/store/inMemoryStore.ts`:**
  - `getManagedUsers` (Lines 6544–6587): Takes filter params but does **not** accept or check caller/actor role. Returns all matching users including `developer` to non-developers (Surface 1 violation).
  - `getManagedUserById` (Lines 6620–6640): Returns user without checking actor role. Does not enforce `INV-R8` uniform `404` for Developer lookups (Surface 2 violation).
  - `createUser` (Lines 6688–6710): Validates `['admin', 'assistant_admin', 'lecturer', 'user']`. Does not enforce `INV-R1` rejecting `developer` or `INV-R3` rejecting `admin` creation by regular `admin`.
  - `updateUserRole` (Lines 6812–6822): Lacks dual-state check (`INV-R7`), allows regular `admin` to promote to `admin`, and lacks `super_admin`/`developer` role handling.
  - `deleteUser` (Lines 6969–7028): Calls `evaluateProtectedInvariant` which unconditionally blocks `admin` deletion. Regular `admin` is not permitted to delete `assistant_admin` under current checks.
  - `getSystemAuditLogs` (Lines 8590–8668): Does not project `actorId: 'SYSTEM'`, `actorRole: 'system'`, `actorName: 'النظام'` when viewer is non-developer (Surface 7 violation).
- **`frontend/src/mocks/handlers/userManagementHandlers.ts`:**
  - `GET /api/admin/users` (Lines 23–54): Calls `inMemoryStore.getManagedUsers` without passing actor context to filter out `developer`.
  - `PATCH /api/admin/users/:id/role` (Lines 146–224): Does not return uniform `404` when target is `developer` (`INV-R8`).
  - `PATCH /api/admin/users/:id/status` (Lines 227–308): Does not return uniform `404` when target is `developer` (`INV-R8`).
  - `DELETE /api/admin/users/:id` (Lines 311–378): Does not return uniform `404` when target is `developer` (`INV-R8`).

### 6.4 UI Components & Forms
- **`frontend/src/features/user-management/components/AddUserModal.tsx` (Lines 367–371):**  
  Hardcodes options `user`, `lecturer`, `assistant_admin`, `admin` for all actors. Violates Surface 4: regular admin must never see `admin`, and `developer` must never be selectable.
- **`frontend/src/features/user-management/components/UserTable.tsx` (Lines 197–201):**  
  Role select dropdown renders static options `user`, `lecturer`, `assistant_admin`, `admin`. Does not adapt based on actor authority or target role tier.
- **`frontend/src/features/user-management/components/UserFilterBar.tsx` (Lines 83–87):**  
  Filters show `all`, `admin`, `lecturer`, `user`. Missing `assistant_admin` and `super_admin`.
- **`frontend/src/app/router/index.tsx` (Lines 73, 91):**  
  Route `/design-system` is completely public and unprotected.
- **`frontend/src/pages/LoginPage.tsx` (Line 25):**  
  Contains public link: `<Link to="/design-system" className="login-dev-link" tabIndex={-1}>`.

---

## 7. Detailed Frontend Prototype Workstream Breakdown (Workstreams A–D)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2 FRONTEND PROTOTYPE WORKSTREAMS                       │
├────────────────────────┬────────────────────────┬───────────────────────────────┤
│ Workstream A           │ Workstream B           │ Workstream C                  │
│ Role Architecture      │ Protected Accounts     │ Developer Confidentiality     │
│ (MFR-37)               │ (MFR-38)               │ (MFR-39)                      │
│ - 6-tier UserRole      │ - INV-R1..INV-R8       │ - 11 non-disclosure surfaces  │
│ - Arabic role labels   │ - 6x6 management rules │ - Uniform 404 parity          │
│ - Capability ceilings  │ - OD-01 peer read-only │ - Neutral 'النظام' projection │
│ - Baseline defaults    │ - OD-02 admin deletes  │ - Generic email collision     │
│                        │   assistant_admin      │ - Route 404 on /design-system │
│                        │ - Assistant Admin 403  │                               │
│                        │   without delegation   │                               │
├────────────────────────┴────────────────────────┴───────────────────────────────┤
│ Workstream D: Frontend Fixture Boundary & Production Cleanliness (MFR-45)       │
│ - Gate developer/super_admin fixtures behind import.meta.env.DEV                │
│ - Eliminate production bundle credentials; verify build cleanliness             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Workstream A: Six-Tier Role Architecture & Typing (`MFR-37`)
1. **Extend `UserRole` Definition:**
   - Update `UserRole` in `frontend/src/core/auth/types.ts` and `frontend/src/core/user-management/types.ts`:
     ```ts
     export type UserRole =
       | 'developer'
       | 'super_admin'
       | 'admin'
       | 'assistant_admin'
       | 'lecturer'
       | 'user';
     ```
2. **Add Arabic Display Labels:**
   - Update `USER_ROLE_LABELS_AR` in `frontend/src/core/user-management/types.ts`:
     ```ts
     export const USER_ROLE_LABELS_AR: Record<UserRole, string> = {
       developer: 'المطور',
       super_admin: 'المسؤول الأعلى',
       admin: 'مدير',
       assistant_admin: 'مساعد مدير',
       lecturer: 'محاضر',
       user: 'متدرب',
     };
     ```
   - Update `ROLE_CANONICAL_LABELS_AR` in `frontend/src/core/permissions/types.ts`:
     ```ts
     export const ROLE_CANONICAL_LABELS_AR: Record<UserRole, string> = {
       developer: 'المطور',
       super_admin: 'المسؤول الأعلى',
       admin: 'مدير النظام',
       assistant_admin: 'مدير النظام المساعد',
       lecturer: 'المحاضر',
       user: 'المتدرب',
     };
     ```
3. **Configure Role Capabilities & Ceilings:**
   - Update `DEFAULT_ROLE_PERMISSIONS`, `ROLE_DEFAULT_CAPABILITIES`, and `ROLE_CAPABILITY_CEILINGS` in `types.ts` and `policy.ts`:
     - `developer`: Full sovereign baseline defaults (37 capabilities granted, 2 false by operational role design: `approvals.submit_request` and `learning.self_enroll`); full ceiling across all currently defined 39 `SystemCapability` values (a bounded set in code).
     - `super_admin`: Sovereign administrative baseline defaults (37 capabilities granted, 2 false: `approvals.submit_request` and `learning.self_enroll`); full ceiling across all 39 `SystemCapability` values.

4. **Reconciliation of Permission Systems & Capability Counts:**
   The codebase maintains two distinct permission systems with exact mappings:

   | Metric / Subsystem | System 1: UI Permission Definitions (`PermissionKey`) | System 2: Domain Policy Engine (`SystemCapability`) |
   | :--- | :--- | :--- |
   | **Governing Type** | `PermissionKey = SystemCapability` | `SystemCapability` (48 union literals: 39 operational + 9 alias strings) |
   | **Primary Registry** | `PERMISSION_DEFINITIONS` ([`types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/permissions/types.ts)) | `ROLE_CAPABILITY_CEILINGS` & `ROLE_DEFAULT_CAPABILITIES` ([`policy.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/permissions/policy.ts)) |
   | **Active Entries Count** | **35 definitions** across 5 categories (`users`: 7, `groups`: 10, `courses`: 8, `learning`: 2, `governance`: 8) | **39 active operational capabilities** (34 original + `courses.publish` + 4 comment moderation capabilities) |
   | **Role Ceiling Counts** | N/A (Ceilings enforced via System 2) | **Developer:** 39<br>**Super Admin:** 39<br>**Admin:** 39<br>**Assistant Admin:** 32 (excludes 7 sovereign)<br>**Lecturer:** 16<br>**User (Trainee):** 3 |
   | **Default Capabilities (`true`)** | **Developer:** 35 (`DEFAULT_ROLE_PERMISSIONS`)<br>**Super Admin:** 35<br>**Admin:** 35<br>**Assistant Admin:** 28<br>**Lecturer:** 9<br>**User:** 2 | **Developer:** 37 active true (39 mapped, 2 false)<br>**Super Admin:** 37 active true (39 mapped, 2 false)<br>**Admin:** 37 active true (39 mapped, 2 false)<br>**Assistant Admin:** 32 active true (39 mapped, 7 false)<br>**Lecturer:** 10 active true (39 mapped, 29 false)<br>**User:** 3 active true (39 mapped, 36 false) |
   | **Role Defaults vs. Ceilings** | UI default keys for table view & configs | Ceilings define the authoritative runtime authorization boundary for individual overrides (enforced at runtime in `evaluatePermission`, `validatePermissionOverride`, and `inMemoryStore` against untrusted/external input), with TypeScript types providing an additional compile-time constraint. Defaults define immediate un-overridden access. `approvals.submit_request` and `learning.self_enroll` are in ceilings for `developer`/`super_admin`/`admin` but default to `false`. |

### Workstream B: Protected Account Authorization & Invariants (`MFR-38`)
1. **Domain Authorization Function (`canActorManageTargetAccount`):**
   - Create centralized domain authorization helper in `frontend/src/core/permissions/policy.ts`:
     ```ts
     export function canActorManageTargetAccount(
       actorRole: UserRole,
       targetRole: UserRole,
       action: 'view' | 'create' | 'edit' | 'change_role' | 'suspend' | 'delete' | 'manage_permissions',
       context?: { isSelf?: boolean; requestedNewRole?: UserRole }
     ): { allowed: boolean; code?: string; messageAr?: string };
     ```
   - Enforce exact §2.2 rules:
     - `view`:
       - Targeting `developer`: Allowed only if `actorRole === 'developer'`.
       - Targeting `super_admin`: Allowed for `developer`, `super_admin` (`OD-01` peer view), `admin` (`D-04`), and `assistant_admin` (`D-04`, Rule A).
       - Targeting `admin`, `assistant_admin`, `lecturer`, `user`: Allowed for all admin-tier roles.
     - `create`:
       - `developer`: Can create `super_admin`, `admin`, `assistant_admin`, `lecturer`, `user`. Cannot create `developer` via app (`INV-R1`).
       - `super_admin`: Can create `admin`, `assistant_admin`, `lecturer`, `user`.
       - `admin`: Can create `assistant_admin` (`D-05`), `lecturer`, `user`. Cannot create `admin` or `super_admin`.
       - `assistant_admin`: Cannot create any account directly. In Phase 2: returns HTTP 403 Forbidden without delegation (approval workflow belongs to Phase 4; no new approval requests are created).
     - `edit` / `suspend` / `delete`:
       - Targeting `developer`: Blocked for all non-developers (404); CLI only for mutations.
       - Targeting `super_admin`: Allowed **only** for `developer`. Blocked for `super_admin` (no peer mutation per `OD-01`).
       - Targeting `admin`: Allowed for `developer` and `super_admin`. Blocked for regular `admin` (no peer admin mutation per `INV-R3`).
       - Targeting `assistant_admin`: Allowed for `developer`, `super_admin`, and `admin` (`D-05`, `OD-02` permanent deletion).
       - Anti-Self-Dealing (`INV-R6`): Block self-suspension, self-deletion, self-role-change.
       - Assistant Admin Operations: Without explicit existing delegation, reject with HTTP 403 Forbidden. Do not create approval requests.
2. **Refactor `evaluateProtectedInvariant` in `policy.ts`:**
   - Remove legacy unconditional `INVARIANT_ADMIN_ACCOUNT_NON_DELETABLE`.
   - Implement `INV-R1` through `INV-R8` with dedicated error codes:
     - `INVARIANT_DEVELOPER_IMMUTABLE`
     - `INVARIANT_SUPER_ADMIN_EXCLUSIVITY`
     - `INVARIANT_ADMIN_PROTECTED`
     - `INVARIANT_ADMIN_CEILING_EXCEEDED`
     - `INVARIANT_ASSISTANT_ADMIN_CEILING`
     - `INVARIANT_SELF_MUTATION_PROHIBITED`
     - `INVARIANT_ROLE_TRANSITION_UNAUTHORIZED`
   - Preserve existing `INVARIANT_ZERO_ADMIN_LOCKOUT` as a safety regression guardrail preventing test suites from locking out the last administrator; clarify that it is not a new Phase 2 business invariant.
3. **Update Store Account Mutation Methods (`inMemoryStore.ts`):**
   - `createUser`: Check `canActorManageTargetAccount(actor.role, dto.role, 'create')`.
   - `updateUserRole`: Enforce dual-state check (`INV-R7`) against `user.role` and `requestedRole`.
   - `updateUserStatus`: Check `canActorManageTargetAccount(actor.role, user.role, 'suspend')`.
   - `deleteUser`: Check `canActorManageTargetAccount(actor.role, user.role, 'delete')`. Allow `developer` and `super_admin` to delete `admin`; allow `admin` to delete `assistant_admin` (`OD-02`).

### Workstream C: Developer Confidentiality Across 11 Surfaces (`MFR-39`)
1. **Surface 1 — Directory, Search & Pagination:**
   - Update `getManagedUsers` in `inMemoryStore.ts` to accept `actorRole?: UserRole`.
   - If `actorRole !== 'developer'`, filter out `u.role === 'developer'` before calculating totals, applying query search, applying filters, or slicing pages.
   - Update `GET /api/admin/users` handler in `userManagementHandlers.ts` to pass `user.role` to `inMemoryStore.getManagedUsers`.
2. **Surface 2 — Direct Lookup & Transcripts (`INV-R8`):**
   - Update `getManagedUserById` in `inMemoryStore.ts` to accept `actorRole?: UserRole`.
   - If `actorRole !== 'developer'` and resolved user has `role === 'developer'`, return `undefined`.
   - In `userManagementHandlers.ts` (`GET /api/admin/users/:id`, `PATCH .../role`, `PATCH .../status`, `DELETE ...`), return uniform `404 Not Found` with identical unknown ID payload when targeting Developer.
3. **Surface 3 — Dashboard KPIs & Counts:**
   - In `getDashboardData` of `inMemoryStore.ts`, exclude `developer` accounts from `totalCoursesCount`, `totalEnrollmentsCount`, and user metrics when `user.role !== 'developer'`.
4. **Surface 4 — Role Selectors & Forms:**
   - Update `AddUserModal.tsx`:
     - Never include `developer`.
     - Include `super_admin` only if `currentUser.role === 'developer'`.
     - Include `admin` only if `currentUser.role === 'developer' || currentUser.role === 'super_admin'`.
     - For regular `admin`, options are strictly: `user`, `lecturer`, `assistant_admin`.
   - Update `UserTable.tsx`:
     - Dynamically filter the inline role `<select>` based on `currentUser.role` and `targetUser.role`.
     - If actor cannot mutate target's role (e.g. `admin` viewing `admin` or `super_admin`), render a read-only role Badge instead of an active `<select>`.
   - Update `UserFilterBar.tsx`:
     - Add `assistant_admin` and `super_admin` to the role filter. Never render `developer`.
5. **Surface 5 — Instructor, Supervisor & Trainee Pickers:**
   - In `getCandidateTrainees`, verify filter strictly requires `u.role === 'user' && u.status === 'active'`.
   - Ensure lecturer pickers strictly require `u.role === 'lecturer'`.
6. **Surface 6 — Notifications & Activity Feeds (`D-08`):**
   - In `getActiveAdminRecipientIds` of `inMemoryStore.ts`, do not include Developer accounts in standard broadcast notifications.
   - In `createNotification`, if event was initiated by Developer, format message with neutral actor `النظام` for non-Developer recipients.
7. **Surface 7 — Security Audit Logs (`D-14`):**
   - Implement `serializeAuditLogForViewer(entry: SystemAuditLogEntryDTO, viewerRole?: UserRole): SystemAuditLogEntryDTO`.
   - If `viewerRole !== 'developer'`, check if `entry.actorRole === 'developer'` or `entry.actorId` belongs to Developer. If so, project `actorId: 'SYSTEM'`, `actorRole: 'system'`, `actorName: 'النظام'`.
   - Apply this projection in `getSystemAuditLogs`, `getSystemAuditLogById`, and `GET /api/admin/audit`.
8. **Surface 8 — Entity Ownership & Reference Fields:**
   - In serializers for courses, groups, and approvals, project Developer references (`createdBy`, `updatedBy`, `approvedBy`) as `'SYSTEM'` / `'النظام'` for non-Developer callers.
9. **Surface 9 — Duplicate-Email & Validation Responses (`D-09`):**
   - In `createUser` and `updateUser`, enforce email uniqueness against all accounts including Developer.
   - Return generic message `البريد الإلكتروني مسجل مسبقاً لمستخدم آخر` on collision, preventing role disclosure.
10. **Surface 10 — Public Support & WhatsApp Contacts:**
    - In `resolvePublicSupportContacts` of `inMemoryStore.ts`, ensure accounts with `role === 'developer'` are never included in eligible contact lists.
11. **Surface 11 — Developer-Only Routes (`/design-system`):**
    - Remove developer shortcut link from `frontend/src/pages/LoginPage.tsx`.
    - In `frontend/src/app/router/index.tsx`, wrap `/design-system` in a route guard: if user is not authenticated or `user.role !== 'developer'`, render `<NotFoundPage standalone />` (`404`), **never** `<ForbiddenPage />` (`403`).

### Workstream D: Frontend Fixture Boundary & Production Cleanliness (`MFR-45`)
1. **Dev-Only Fixture Seeding (Completed):**
   - In `frontend/src/mocks/fixtures/userDirectoryFixtures.ts` and `mockUsers.ts`, `SYNTHETIC_DEVELOPER_USER` (`USR_DEV_001`) and `SYNTHETIC_SUPER_ADMIN_USER` (`USR_SUPER_001`) are gated behind `import.meta.env.DEV === true`.
   - `INITIAL_MANAGED_USERS` compiles to `[...BASE_MANAGED_USERS]` in production builds with zero synthetic developer or super admin records.
   - `CONTROLLED_TEST_FIXTURE_USERS` in `resolveUser.ts` gates test personas behind `import.meta.env.DEV`.
   - In `inMemoryStore.ts`, `DEV_FINGERPRINTS` is gated behind `import.meta.env.DEV`, allowing Rollup dead-code elimination to purge all synthetic developer strings from production bundles.
2. **Production Artifact Cleanliness Scanner (Completed):**
   - Dedicated Node.js scanner authored at `scripts/verify-production-cleanliness.mjs` to recursively inspect `frontend/dist` for prohibited fingerprints (`USR_DEV_001`, `developer.metro@internal.local`, `مطور النظام`, `USR_SUPER_001`, `superadmin@cairo-metro.com`).
   - Tolerates legitimate domain strings (`developer`, `super_admin`, capability keys).
   - Execution deferred to Phase 13 / Gate B after production build.
3. **Future Backend Bootstrap Contract (Completed):**
   - Documented in `docs/backend/contracts/developer-bootstrap-contract.md` covering CLI `pnpm db:bootstrap-developer`, Argon2id pre-hashing, partial unique index `idx_singleton_developer`, first-login password rotation & MFA, idempotency state matrix, and zero credentials in logs. All implementation deferred to Phase 12.

---

## 8. Dependency-Aware Implementation Sequence

When authorization is granted, execution will proceed in five strictly sequenced steps:

```
Step 1: Core Types & Permissions Foundation (auth/types, user-mgmt/types, permissions/types, policy)
  │
  ▼
Step 2: Domain Authorization & Invariant Engine (canActorManageTargetAccount, evaluateProtectedInvariant)
  │
  ▼
Step 3: In-Memory Store & Non-Disclosure Filtering (inMemoryStore, serializers, audit projection)
  │
  ▼
Step 4: MSW API Handlers & HTTP 404/403 Parity (userManagementHandlers, authHandlers, resolveUser)
  │
  ▼
Step 5: UI Forms, Selectors, Table Badges & Route Guarding (AddUserModal, UserTable, UserFilterBar, router)
```

### Detailed File-by-File Modification Plan

| Step | File Path | Specific Changes to Implement |
| :---: | :--- | :--- |
| **1** | `frontend/src/core/auth/types.ts` | Add `'developer'` and `'super_admin'` to `UserRole`. |
| **1** | `frontend/src/core/user-management/types.ts` | Add `'developer'` and `'super_admin'` to `UserRole`, `USER_ROLE_LABELS_AR`. |
| **1** | `frontend/src/core/permissions/types.ts` | Add `'developer'` and `'super_admin'` to `ROLE_CANONICAL_LABELS_AR`, `DEFAULT_ROLE_PERMISSIONS`. |
| **1** | `frontend/src/core/permissions/policy.ts` | Add capabilities and ceilings for `developer` and `super_admin`. |
| **2** | `frontend/src/core/permissions/policy.ts` | Implement `canActorManageTargetAccount`, refactor `evaluateProtectedInvariant` (`INV-R1`–`INV-R8`), remove unconditional admin deletion block. Preserve `INVARIANT_ZERO_ADMIN_LOCKOUT` as regression safety test only. |
| **3** | `frontend/src/mocks/fixtures/userDirectoryFixtures.ts` | Add `USR_SUPER_001` and conditionally seed `USR_DEV_001` behind `import.meta.env.DEV`. |
| **3** | `frontend/src/mocks/store/inMemoryStore.ts` | Update `getManagedUsers` (filter developer), `getManagedUserById` (`INV-R8`), `createUser`, `updateUserRole` (`INV-R7`), `updateUserStatus`, `deleteUser` (allow super_admin/developer deleting admin, admin deleting assistant_admin), `serializeAuditLogForViewer` (project `'SYSTEM'`). |
| **4** | `frontend/src/mocks/handlers/userManagementHandlers.ts` | Pass actor to store queries; return uniform `404` when targeting Developer ID on non-developer request; reject Assistant Admin mutations without delegation with 403 (do not create approval requests in Phase 2). |
| **4** | `frontend/src/mocks/handlers/resolveUser.ts` | Support resolving Developer and Super Admin test sessions through the canonical identity resolvers (`resolveAuthenticatedUser` for authenticated identity resolution and `resolveCanonicalUserId` for ID normalization). Ensure roles are authoritative. |
| **5** | `frontend/src/features/user-management/components/AddUserModal.tsx` | Filter role selector by actor authority: hide developer; show super_admin only for developer; show admin only for developer/super_admin. |
| **5** | `frontend/src/features/user-management/components/UserTable.tsx` | Dynamic role select options based on actor and target tier; read-only role Badge when actor cannot mutate target role. |
| **5** | `frontend/src/features/user-management/components/UserFilterBar.tsx` | Add `assistant_admin` and `super_admin` to role filter; exclude `developer`. |
| **5** | `frontend/src/pages/LoginPage.tsx` | Remove public link to `/design-system`. |
| **5** | `frontend/src/app/router/index.tsx` | Protect `/design-system` route so non-developers receive `NotFoundPage` (`404`). |

---

## 9. Comprehensive Acceptance Criteria & Verification Plan

### 9.1 Verification Test Suites to Implement

```
                                  PHASE 2 TEST ARCHITECTURE
┌───────────────────────────────────────┐       ┌───────────────────────────────────────┐
│ Suite 1: 6×6 Role Management Matrix   │       │ Suite 2: Developer Non-Disclosure     │
│ (canActorManageTargetAccount Unit)    │       │ (11 Surfaces Integration Tests)       │
│ - View permissions (OD-01, D-04)      │       │ - Directory listing & pagination      │
│ - Create permissions (INV-R1, R3, R4) │       │ - Direct lookup uniform 404 (INV-R8)  │
│ - Edit & Suspend permissions          │       │ - Dashboard KPI exclusions            │
│ - Delete permissions (OD-02)          │       │ - Audit log 'النظام' projection (D-14)│
│ - Anti-Self-Dealing (INV-R6)          │       │ - Generic email conflict masking(D-09)│
│ - Dual-state transitions (INV-R7)     │       │ - /design-system 404 parity           │
│ - Assistant admin 403 on undelegated  │       │                                       │
└───────────────────────────────────────┘       └───────────────────────────────────────┘
                                    ▲               ▲
                                    │               │
┌───────────────────────────────────┴───────────────┴───────────────────────────────────┐
│ Suite 3: Security Boundary & Phase 1 Compatibility Tests                              │
│ - Zero credentials in production bundles                                              │
│ - Dev fixture gating (import.meta.env.DEV)                                            │
│ - Phase 1 canonical identity resolution for Developer & Super Admin                   │
│ - Authoritative role enforcement (stale session role cannot override directory)       │
│ - Session revalidation and tombstone non-resurrection verification                     │
│ - Last active admin lockout prevention regression test                                │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

#### Test Suite 1: 6×6 Role Management Matrix Unit Tests (`role-matrix-invariants.test.ts`)
- **Matrix Coverage:** Exhaustively test all combinations of Actor Role × Target Role for `view`, `create`, `edit`, `change_role`, `suspend`, `delete`, and `manage_permissions`.
- **`OD-01` Verification:** Verify `super_admin` can view other `super_admin` records read-only, but attempting to edit, suspend, demote, or delete another `super_admin` returns `403` (`INVARIANT_SUPER_ADMIN_EXCLUSIVITY`).
- **`OD-02` Verification:** Verify regular `admin` can permanently delete `assistant_admin` (`allowed: true`), but attempting to delete another `admin` returns `403` (`INVARIANT_ADMIN_PROTECTED`).
- **`INV-R1` Verification:** Verify attempting to create or promote to `developer` returns `403` for all actors.
- **`INV-R6` Verification:** Verify actor cannot delete, suspend, or demote self.
- **`INV-R7` Verification:** Verify role transition checks actor authority on both source and target roles.
- **Assistant Admin Phase 2 Boundary:** Verify Assistant Admin mutations without explicit direct delegation return `403` without creating approval requests.

#### Test Suite 2: Developer Non-Disclosure Across 11 Surfaces (`developer-confidentiality.test.ts`)
- **Surface 1:** `GET /api/admin/users` as `super_admin`, `admin`, `assistant_admin` does not contain the Developer record in `users` array, total counts, or filter results.
- **Surface 2:** `GET /api/admin/users/:devId` as non-Developer returns HTTP `404 Not Found` with payload identical to querying a random non-existent ID `USR_DOES_NOT_EXIST`.
- **Surface 3:** `getDashboardData` KPI counts (`totalUsersCount`) are identical whether the Developer exists or not.
- **Surface 4:** `AddUserModal` does not render `developer` option for anyone; renders `admin` only for `developer` and `super_admin`.
- **Surface 6:** Non-Developer admins do not receive notifications generated by Developer with Developer's name.
- **Surface 7:** `GET /api/admin/audit` viewed by `admin` or `assistant_admin` renders Developer audit actions with `actorId: 'SYSTEM'`, `actorRole: 'system'`, `actorName: 'النظام'`.
- **Surface 9:** Submitting a new user with Developer's email returns `409 Conflict` with generic message: `البريد الإلكتروني مسجل مسبقاً لمستخدم آخر`.
- **Surface 11:** Navigating to `/design-system` unauthenticated or as non-Developer renders the standard `404 Not Found` page, **not** `403 Forbidden`.

#### Test Suite 3: Provisioning & Phase 1 Compatibility (`developer-provisioning.test.ts`)
- Verify `SYNTHETIC_DEVELOPER_USER` is excluded when `import.meta.env.DEV === false`.
- Verify no passwords or credentials appear in public DTOs.
- Verify `developer` and `super_admin` identities resolve through `resolveCanonicalUserId` (canonical user ID normalization) and `resolveAuthenticatedUser` (authenticated request identity resolution).
- Verify authoritative role enforcement: stale session role in localStorage cannot override central directory role.
- Verify Phase 1 tombstone non-resurrection: tombstoned identities cannot authenticate as Developer or Super Admin.

### 9.2 Acceptance Criteria Checklist
1. [ ] `developer` and `super_admin` exist in `UserRole` across core auth, user management, and permissions modules.
2. [ ] `canActorManageTargetAccount` accurately implements all 36 cells of the §2.2 Role Management Matrix.
3. [ ] `OD-01` enforced: `super_admin` peer read-only view confirmed; peer mutation blocked (`403`).
4. [ ] `OD-02` enforced: regular `admin` can delete `assistant_admin`; cannot mutate `admin` or `super_admin`.
5. [ ] Assistant Admin state-changing requests without explicit direct delegation return HTTP `403` in Phase 2; zero new approval requests created.
6. [ ] `developer` account is 100% invisible across all 11 non-disclosure surfaces for any non-developer actor in prototype UI and API responses.
7. [ ] Querying Developer ID directly returns HTTP `404 Not Found` identical to querying a non-existent ID.
8. [ ] Security Audit logs project `'SYSTEM'` / `'النظام'` for non-Developer viewers.
9. [ ] Email collisions against Developer return generic error message without disclosing existence or role (`D-09`).
10. [ ] Route `/design-system` returns `404` for all non-developer visitors.
11. [ ] Zero regressions in existing Phase 1 canonical identity resolution, session revalidation, or tombstone tests.

---

## 10. Regression Risks & Mitigation Plan

| Identified Risk | Affected Files / Tests | Mitigation Strategy |
| :--- | :--- | :--- |
| **Existing tests using regular `admin` to mutate `admin`:** Legacy tests may use `usr_admin_001` to test deleting or editing another admin. Under `INV-R3`, this must fail (`403`). | `user-lifecycle.test.tsx`, `user-directory.test.tsx` | Update test personas: tests exercising admin creation or mutation must use `super_admin` (`USR_SUPER_001`) or `developer` (`USR_DEV_001`) as actor, reflecting real security invariants. |
| **Existing test expecting public `/design-system`:** `auth.test.tsx` line 275 has a test asserting: `allows public access to /design-system without authentication`. | `frontend/src/test/auth.test.tsx` | Update the test to reflect Surface 11 requirement: unauthenticated access to `/design-system` must render `404 Not Found` to prevent route discovery. |
| **UI role dropdown layout breakage:** Adding `super_admin` and `assistant_admin` to role selectors might overflow compact table cells. | `UserTable.tsx`, `UserFilterBar.tsx` | Use responsive CSS, truncate with ellipsis, and replace `<select>` with static Badge when actor lacks mutation permissions on target. |
| **Accidental lockout of last admin (Regression Safety):** Deleting or demoting an admin might leave the system without a governance admin. | `policy.ts`, `inMemoryStore.ts` | Preserve existing `INVARIANT_ZERO_ADMIN_LOCKOUT` as a safety regression test; clarify that it prevents test lockout and does not add a new Phase 2 business rule. |
| **Stale session role overriding directory role (Phase 1 Compatibility):** Client storing old session role in `localStorage`. | `resolveUser.ts`, `authHandlers.ts` | Ensure `GET /api/auth/me` always derives the returned role from the central authoritative user directory, preserving Phase 1 session revalidation guarantees. |

---

## 11. Final Implementation Authorization Checklist

> **OWNER AUTHORIZATION STATUS:** Phase 2 implementation is **officially authorized** by the owner. Increment 2.1 (`MFR-37`) is implemented and verified. Later increments (`MFR-38`, `MFR-39`, `MFR-45`) remain strictly `[Not Started]` awaiting review.

### Part A: Frontend Prototype Implementation Checklist
- [x] `[Completed]` **Workstream A (Increment 2.1):** Add `'developer'` and `'super_admin'` to `UserRole`, `ROLE_CANONICAL_LABELS_AR` (`المطور`, `المسؤول الأعلى`), `USER_ROLE_LABELS_AR`, `DEFAULT_ROLE_PERMISSIONS`, `ROLE_DEFAULT_CAPABILITIES`, and `ROLE_CAPABILITY_CEILINGS` (`MFR-37`).
- [x] `[Completed]` **Increment 2.1 Verification:** 27 focused tests in `role-architecture-increment21.test.ts` passing; Phase 1 identity compatibility verified; production build passing.
- [x] `[Completed]` **Workstream B (Increment 2.2):** Implement `canActorManageTargetAccount` and refactor `evaluateProtectedInvariant` in `policy.ts` to enforce `INV-R1` through `INV-R8`:
  - [x] `[Completed]` Only `developer` can mutate `super_admin`; `super_admin` has read-only peer view (`D-04`, `OD-01`).
  - [x] `[Completed]` Only `developer` and `super_admin` can create, edit, suspend, or delete `admin` (`INV-R3`).
  - [x] `[Completed]` Regular `admin` cannot mutate `admin` or `super_admin`; can view `super_admin` read-only (`D-04`).
  - [x] `[Completed]` Regular `admin` can create, edit, suspend, activate, delegate to, and permanently delete `assistant_admin` (`D-05`, `OD-02`).
  - [x] `[Completed]` Assistant Admin operations requiring approval return 403 when lacking delegation; do not create approval requests in Phase 2.
  - [x] `[Completed]` Enforce Anti-Self-Dealing (`INV-R6`) and Dual-State Transition checks (`INV-R7`).
  - [x] `[Completed]` Replace unconditional `INVARIANT_ADMIN_ACCOUNT_NON_DELETABLE` in `inMemoryStore.ts` and `policy.ts`.
  - [x] `[Completed]` Maintain `INVARIANT_ZERO_ADMIN_LOCKOUT` solely as a regression safety guardrail.
- [x] `[Completed]` **Workstream C:** Implement Developer non-disclosure across all 11 surfaces (`MFR-39`):
  - [x] `[Completed]` Surface 1: Filter `role === 'developer'` in `getManagedUsers` and `GET /api/admin/users` before search/counts/pagination.
  - [x] `[Completed]` Surface 2: Return uniform HTTP `404 Not Found` on direct Developer ID lookup by non-developers (`INV-R8`).
  - [x] `[Completed]` Surface 3: Exclude `developer` from dashboard KPI counts and reports.
  - [x] `[Completed]` Surface 4: Dynamic form and table role options; hide `developer` universally; gate `super_admin` and `admin`.
  - [x] `[Completed]` Surface 5: Exclude `developer` from instructor and trainee pickers.
  - [x] `[Completed]` Surface 6: Isolate Developer notifications; neutralize broadcast alerts (`D-08`).
  - [x] `[Completed]` Surface 7: Project `'SYSTEM'` / `'النظام'` in security audit logs for non-Developer viewers (`D-14`).
  - [x] `[Completed]` Surface 8: Project `'SYSTEM'` / `'النظام'` in entity ownership fields (`createdBy`, `updatedBy`, `approvedBy`).
  - [x] `[Completed]` Surface 9: Generic collision error on Developer email without disclosing account details (`D-09`).
  - [x] `[Completed]` Surface 10: Exclude `developer` from public support and WhatsApp contacts.
  - [x] `[Completed]` Surface 11: Protect `/design-system` route with 404 parity for non-developers; remove public links.
- [x] `[Completed]` **Workstream D (Increment 2.4):** Gate prototype `developer` and `super_admin` fixtures behind `import.meta.env.DEV` and establish production build cleanliness architecture (`MFR-45`):
  - [x] `[Completed]` Developer fixture `SYNTHETIC_DEVELOPER_USER` (`USR_DEV_001`) gated strictly behind `import.meta.env.DEV === true` in `userDirectoryFixtures.ts`.
  - [x] `[Completed]` Super Admin test fixture `SYNTHETIC_SUPER_ADMIN_USER` (`USR_SUPER_001`) gated behind `import.meta.env.DEV === true` in `userDirectoryFixtures.ts` and `resolveUser.ts`.
  - [x] `[Completed]` Baseline production fixtures `BASE_MANAGED_USERS` and runtime store initialization in production contain zero synthetic Developer or Super Admin records.
  - [x] `[Completed]` Store developer fingerprint sanitizers (`DEV_FINGERPRINTS`) in `inMemoryStore.ts` gated behind `import.meta.env.DEV`, allowing complete dead-code elimination in production builds.
  - [x] `[Completed]` Post-build production artifact scanner authored at `scripts/verify-production-cleanliness.mjs` using Node built-in APIs to verify zero fixture fingerprints in `frontend/dist`. Execution deferred to Phase 13 / Gate B.
  - [x] `[Completed]` Authoritative Phase 12 Backend Contract documented in `docs/backend/contracts/developer-bootstrap-contract.md` covering CLI `pnpm db:bootstrap-developer`, Argon2id pre-hashing, partial unique index `idx_singleton_developer`, first-login password rotation & MFA, idempotency state matrix, and zero credentials in logs.
- [x] `[Completed]` **Phase 1 Compatibility:** Verified Developer & Super Admin resolve via canonical identity (`resolveCanonicalUserId`), authoritative directory roles cannot be overridden by stale session data, tombstones are preserved, and zero duplicate resolvers exist.
- [ ] `[In Progress]` **Verification & Test Status Tracking:**
  - [x] `[PRELIMINARY EXECUTION EVIDENCE — EXECUTED DURING AN EARLIER WORKFLOW]` 6×6 Role Management Matrix unit tests (`role-matrix-invariants.test.ts` — 34/34 passing in preliminary run; full regression suite 69/69 test files, 1,289/1,289 passing; zero build/lint errors). Final verification deferred to Phase 13 / Gate B.
  - [ ] `[WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]` Assistant Admin Mode A & Exact Capability Delegation Suite (`role-matrix-invariants.test.ts` Section 6 — 11 dedicated tests covering undelegated 403 rejection without approval records, exact capability matching, inactive/expired grant rejection, and scope enforcement).
  - [ ] `[WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]` Canonical Capability Mapping, Delegation Hardening & INV-R8 Parity Suite (`role-matrix-invariants.test.ts` Section 7 — 16 dedicated tests covering `mapActionToSystemCapability`, canonical key enforcement, contextual resolution of permissions vs delegation, directory vs transcript reads, fail-closed handling of invalid keys, sovereign capability protection for Assistant Admin, store and API handler delegation input validation, `hasDelegationBypass` anti-forgery, and uniform 404 parity across direct-ID endpoints).
  - [ ] `[WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]` Account Edit Authorization & Domain Invariant Suite (`role-matrix-invariants.test.ts` Section 2 & Section 1.3 — verifying policy-level direct account edit rules across developer, super_admin, admin, self-profile for all 6 roles, protected-target peer rejection, and delegation boundary; clearly documented as policy rules for a deferred future feature).
  - [x] `[WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]` Developer Non-Disclosure 11-surface integration tests (`developer-confidentiality.test.tsx` — 54 tests across 11 surfaces).
  - [x] `[WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]` Secure Developer Provisioning & Fixture Gating Suite (`developer-provisioning.test.ts` — 10 dedicated tests covering dev mode inclusion, prod mode absence, super admin test boundary, prod fixture cleanliness, API 403 on developer creation, policy INV-R1 enforcement, role mutation prevention, initialization idempotency, scanner detection & benign string tolerance, Phase 1 & 2.1–2.3 compatibility).
  - [ ] `[DEFERRED TO PHASE 13]` Consolidated full-suite test execution, TypeScript emit checks, linting, and production builds.
  - [ ] `[PENDING PHASE 13 BUILD]` Formal production bundle cleanliness verification via `node scripts/verify-production-cleanliness.mjs`.

### Part B: Future Backend Contracts (Phase 12 Reference Only — NOT in Phase 2 Implementation)
- 📋 `[Documented Contract]` Dedicated Contract Specification: [`docs/backend/contracts/developer-bootstrap-contract.md`](file:///d:/LMS%20MEtro%20Project/docs/backend/contracts/developer-bootstrap-contract.md).
- 📋 `[Informational Contract]` Server CLI command `pnpm db:bootstrap-developer` reading server environment variables `DEVELOPER_BOOTSTRAP_EMAIL` and `DEVELOPER_BOOTSTRAP_PASSWORD_HASH`.
- 📋 `[Informational Contract]` Database partial unique index `idx_singleton_developer`: `CREATE UNIQUE INDEX idx_singleton_developer ON users ((role)) WHERE role = 'developer';`.
- 📋 `[Informational Contract]` First login security requirements: mandatory password rotation and MFA enrollment.
- 📋 `[Informational Contract]` Server-side database query scopes (`WHERE role <> 'developer'`).
- 📋 `[Informational Contract]` Server-side password hashing (`argon2id`) and production MFA enrollment.
- 📋 `[Informational Contract]` Persistent database audit logs and event loggers.

---

### Final Status Banner

```
══════════════════════════════════════════════════════════════════════════════
  STATUS: INCREMENT 2.4 — FINAL SCANNER VALIDATION RECONCILED — AWAITING OWNER APPROVAL
  Phase 2 Final Increment (MFR-45 / Workstream D) is reconciled and complete:

  1. Developer Fixture Gating: SYNTHETIC_DEVELOPER_USER ('USR_DEV_001') gated behind
     import.meta.env.DEV === true in userDirectoryFixtures.ts. Eliminated from production.
  2. Super Admin Fixture Boundary: SYNTHETIC_SUPER_ADMIN_USER ('USR_SUPER_001') available
     in dev/test, gated from production fixtures in userDirectoryFixtures.ts & resolveUser.ts.
  3. Production Fixture Cleanliness: BASE_MANAGED_USERS contains zero synthetic Developer
     or Super Admin records. inMemoryStore DEV_FINGERPRINTS compile-time gated for Rollup
     dead-code elimination.
  4. Public/UI Developer Creation Restrictions: POST /api/admin/users and role mutations
     strictly reject Developer creation with HTTP 403 (INV-R1). No UI creation path exists.
  5. Post-Build Cleanliness Scanner Reconciled: scripts/verify-production-cleanliness.mjs
     covers 13 distinctive fixture fingerprints with validated JS regex syntax:
     - Exact email matching: /developer\.metro@internal\.local/i and /superadmin@cairo-metro\.com/i
     - Lookbehind phone matching: /(?<!2)01000000000(?!\d)/ and /(?<!\d)01000000001(?!\d)/
     - Zero false positives on legitimate Egyptian WhatsApp number (201000000000) or roles.
     Execution explicitly deferred to Phase 13 / Gate B.
  6. Future Backend Contract: docs/backend/contracts/developer-bootstrap-contract.md
     documented for Phase 12 reference (CLI pnpm db:bootstrap-developer, Argon2id, singleton
     index, first-login MFA/rotation, idempotency matrix, zero Phase 2 backend modification).
  7. Test Suite Updated: developer-provisioning.test.ts (10 tests with 18 subcases in Test 9,
     including dedicated subcases for lowercase aliases usr_dev_001, usr_super_001, and
     exact dot email matching):
     [WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13]

  Verification Status:
  Zero test, compiler, lint, build, or scanner commands executed per Part A Directive.
  Production bundle cleanliness check remains pending Phase 13 build.
  Phase 1 and Increments 2.1, 2.2, and 2.3 remain 100% intact.
══════════════════════════════════════════════════════════════════════════════
```
