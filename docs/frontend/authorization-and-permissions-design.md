# Cairo Metro LMS — Authorization Model & Permissions Governance Design

## 1. Executive Summary & Architectural Scope

This document provides the authoritative architecture and implementation specification for the **Four Canonical Roles Authorization Model**, **Centralized Role Capability Ceilings**, **Individual-User Permission Management Workflow**, **Group-Scoped Assistant Lecturer Assignment Engine**, **Assistant Administrator Approval & Delegation Workflow**, and **Protected Administrator Invariants** for the Metro Courses LMS platform.

This specification supersedes all prior references to a fifth canonical role (`assistant_lecturer`), establishing the corrected three-layer authorization architecture:
- Exactly four canonical system roles: `admin`, `assistant_admin`, `lecturer`, and `user`.
- **Layer 1: Immutable Role Capability Ceilings (`ROLE_CAPABILITY_CEILINGS`):** Code-defined boundary that strictly limits what each canonical role can ever receive. Non-editable from UI or store mutations.
- **Layer 2: Administrator-Configurable Shared Role Defaults:** The System Administrator (`admin`) can configure baseline default capabilities for each role within its immutable ceiling. Affects all users of that role without explicit individual overrides.
- **Layer 3: Individual-User Permission Overrides:** User-specific grants and denials managed under `/admin/users` that take precedence over role defaults while strictly respecting role ceilings.
- Assistant lecturer is a group-scoped operational assignment granted to an ordinary lecturer within a specific training group.
- Immutable security invariants protect system administrator accounts: existing admin accounts cannot be deleted, assistant administrators cannot create admin accounts, and self-demotion/self-suspension is blocked.

---

## 2. Canonical System Roles: Four Only

### 2.1 Canonical Role Identifiers & Arabic Display Labels

The system defines exactly four canonical system roles:

| Canonical Role Identifier (`UserRole`) | Arabic Display Label | Description & Primary Responsibilities |
| :--- | :--- | :--- |
| `admin` | مدير النظام | **System Administrator:** Authoritative governance and administrative control over platform accounts, training groups, courses, individual permission overrides, and security governance. |
| `assistant_admin` | مدير النظام المساعد | **Assistant System Administrator:** Operational administrative capabilities. Proposes sensitive administrative mutations subject to System Administrator approval by default, or executes directly when explicitly delegated. |
| `lecturer` | المحاضر | **Lecturer / Instructor:** Conducts training, manages assigned groups, oversees trainees, handles join requests, and uploads supplementary group materials. May be assigned as an Assistant Lecturer for another lecturer's group. Eligible for individual course-authoring overrides within ceiling. |
| `user` | المتدرب | **Trainee:** Learner role with access strictly limited to enrolled courses, assigned training groups, learning player, and personal learning transcripts. |

> [!IMPORTANT]
> **No Fifth Canonical Role:** There is no canonical system role named `assistant_lecturer`. The term "assistant lecturer" describes a group-scoped assignment granted to an ordinary lecturer within a specific training group (`GroupAssistantAssignment`). The user remains an ordinary `lecturer` across the platform.

### 2.2 Wire Tokens & Compatibility Aliases
- Canonical role identifiers are strictly lowercased ASCII tokens: `'admin' | 'assistant_admin' | 'lecturer' | 'user'`.
- The TypeScript type alias `TraineeRole = 'user'` is preserved for legacy contract compatibility, mapping strictly to `'user'`.
- Legacy candidate trainee queries (`inMemoryStore.getCandidateTrainees()`) strictly filter `u.role === 'user' && u.status === 'active'`.

### 2.3 Persona Migration & Identity Preservation
- **`USR017` (`assistant_lecturer_demo`):** Canonical identity, email (`assistant.lecturer@metro.gov.eg`), development credentials (`metroAssistantTrainer2026!`), and login behavior are preserved, but its canonical role is migrated to `'lecturer'`.
- **`USR016` (`assistant_admin_demo`):** Preserved as `assistant_admin` with email `assistant.admin@metro.gov.eg` and credentials `metroAssistantAdmin2026!`.
- **Seed Users (`USR001`–`USR015`):** Retain their canonical roles and historical records intact without alteration.

---

## 3. Separation of Authorization Mechanisms

To prevent privilege escalation and maintain architectural clarity, the system strictly separates four distinct mechanisms:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Four Independent Mechanisms                           │
├──────────────────────────┬──────────────────────────────────────────────────┤
│ 1. Individual Override   │ User-specific grant/denial within Role Ceiling   │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 2. Group Assignment      │ Operational duty within ONE training group       │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 3. Role Promotion        │ Explicit canonical role change (Account Mgt)    │
├──────────────────────────┼──────────────────────────────────────────────────┤
│ 4. Admin Delegation      │ Direct execution authority for Assistant Admin   │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

1. **Individual Permission Override:** A user-specific grant or denial within the user's role ceiling (e.g., granting one lecturer `courses.create` without granting it to all lecturers).
2. **Group-Scoped Assignment:** Additional operational duties (e.g., managing supplementary group materials) within one authorized training group. Does NOT grant permissions outside that group.
3. **Role Promotion:** An explicit change to the user's canonical system role through the authorized account-lifecycle workflow (`users.change_role`). Never occurs automatically by selecting permissions.
4. **Assistant-Administrator Delegation:** Explicit authority for an assistant administrator to execute eligible administrative operations without routine approval. Does NOT bypass protected administrator invariants.

---

## 4. Controlled Role Capability Ceilings

A role defines the maximum ordinary capabilities a user may receive. Individual permission customization is allowed only inside that boundary.

```
┌────────────────────────────────────────────────────────┐
│               Admin Role Ceiling (All)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Assistant Admin Ceiling (Admin Subset)     │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │         Lecturer Ceiling (Teaching)        │  │  │
│  │  │  ┌──────────────────────────────────────┐  │  │  │
│  │  │  │      Trainee Ceiling (Learning)      │  │  │  │
│  │  │  └──────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 4.1 Trainee Ceiling (`user`)
- **Permitted Capabilities:** Personal learning (`learning.access_assigned`, `learning.self_enroll`), profile viewing, and enrolled group interaction.
- **Strictly Prohibited:** Trainees can never receive administrative governance, user account management, group creation/archival, course authoring, review decisions, or permission configuration.

### 4.2 Lecturer Ceiling (`lecturer`)
- **Permitted Capabilities:** Assigned group management (`groups.manage_members`, `groups.generate_qr`, `groups.review_join_requests`), group materials (`materials.manage_folders`, `materials.upload_files`, `materials.delete_files`, `materials.manage_meetings`), course authoring via individual override (`courses.create`, `courses.edit_metadata`, `courses.edit_curriculum`, `courses.upload_lectures`, `courses.delete_lectures`), course submission (`reviews.submit_course`).
- **Strictly Prohibited:** Global user directory administration, account lifecycle (`users.create`, `users.change_role`, `users.change_status`, `users.delete`), group creation/archiving (`groups.create`, `groups.archive`), system permission configuration, administrative delegation, approval queue governance, and security audit log access.

### 4.3 Assistant Administrator Ceiling (`assistant_admin`)
- **Permitted Capabilities:** Operational administrative capabilities (`users.view_directory`, `users.create`, `users.change_role`, `users.change_status`, `users.delete`, `groups.create`, `groups.edit_config`, `groups.archive`, `courses.create`, `courses.publish`, etc.).
- **Execution Mode & Protected Invariants:**
  - Non-administrator account lifecycle operations (such as `users.delete`, `users.change_status`, `users.change_role`) and course publication (`courses.publish`) are subject to System Administrator approval by default (`executionMode: 'requires_approval'`), and execute directly when operational delegation is active (`executionMode: 'direct'`).
  - Mutating or deleting a protected System Administrator account (`targetUser.role === 'admin'`) is permanently and immutably blocked by Invariant 1 (`INVARIANT_ASSISTANT_CANNOT_MUTATE_ADMIN`), even when delegation is active.
- **Strictly Prohibited to Assistant Administrator (Sovereign Governance Functions):**
  - Course review & publication decisions (`reviews.decide_course` — approving or rejecting courses for the public catalog).
  - Permission policy customization (`permissions.configure_roles`, `permissions.configure_users`).
  - Administrative delegation management (`permissions.manage_delegation`).
  - Security audit log inspection (`audit.view_system_logs`).
  - Administrative approval queue decisions (`approvals.decide_request`).

### 4.4 System Administrator Ceiling (`admin`)
- Full administrative capabilities, subject to Immutable Protected Invariants.

### 4.5 Centralized Ceiling Validation
The function [`validatePermissionOverride(role, capability)`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/core/permissions/policy.ts) enforces ceiling boundaries. If an override attempt exceeds the target user's role ceiling:
- The attempt is rejected with an Arabic explanatory error:
  `"الصلاحية [X] تقع خارج السقف الأقصى المسموح به لدور [Y]. لتمكين هذه الصلاحية، يجب ترقية دور المستخدم أولاً عبر إدارة الحسابات."`
- The store remains unchanged.
- The UI displays above-ceiling capabilities as disabled with a `"خارج سقف الدور"` badge.

---

## 5. Permission Resolution Model

The centralized evaluator [`evaluatePermission`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/core/permissions/policy.ts) implements the following strict 6-step conceptual precedence:

```
┌────────────────────────────────────────────────────────┐
│ 1. Immutable Protected Invariants (Hard Security Stop) │
└──────────────────────────┬─────────────────────────────┘
                           │ Passed
┌──────────────────────────▼─────────────────────────────┐
│ 2. Canonical Role Capability Ceiling (Ceiling Check)   │
└──────────────────────────┬─────────────────────────────┘
                           │ Within Ceiling
┌──────────────────────────▼─────────────────────────────┐
│ 3. Individual-User Permission Overrides                │
│    (Explicit Revoke -> Deny / Explicit Grant -> Allow) │
└──────────────────────────┬─────────────────────────────┘
                           │ Absent Override
┌──────────────────────────▼─────────────────────────────┐
│ 4. Fixed Baseline Permissions (ROLE_DEFAULT_CAPS)      │
└──────────────────────────┬─────────────────────────────┘
                           │ Allowed
┌──────────────────────────▼─────────────────────────────┐
│ 5. Resource & Group Scope Validation                   │
│    (Group Supervisor / Assistant Lecturer / Assigned)  │
└──────────────────────────┬─────────────────────────────┘
                           │ Valid Scope
┌──────────────────────────▼─────────────────────────────┐
│ 6. Execution Mode Resolution (Direct vs Approval Req)  │
└────────────────────────────────────────────────────────┘
```

### Precedence Details:
1. **Immutable Invariants:** Evaluates actor, target, and system safety (assistant cannot mutate admin; assistant cannot create admin accounts; existing admin accounts cannot be deleted; self-demotion/self-suspension blocked; last-admin protection).
2. **Role Ceiling:** If the capability is not in `ROLE_CAPABILITY_CEILINGS[actor.role]`, immediately return `{ granted: false, executionMode: 'denied', reason: 'CAPABILITY_EXCEEDS_ROLE_CEILING' }`.
3. **Individual Overrides:** Inspects `userPermissionOverrides[actor.id]`:
   - If present in `revoked`: returns `{ granted: false, executionMode: 'denied', source: 'user_override' }`.
   - If present in `granted`: marks `granted = true` with `source: 'user_override'`, proceeding to scope and execution mode evaluation.
4. **Administrator-Configured Shared Role Defaults:** If no individual override exists, inspects the configured role default (`roleDefaults?.[actor.role]?.[capability]` in the store, falling back to `ROLE_DEFAULT_CAPABILITIES[actor.role]`).
5. **Resource & Group Scope:** For group-scoped capabilities (`GROUP_SCOPED_CAPABILITIES`), verifies whether the user is the assigned supervisor or active assistant lecturer (`isGroupSupervisor || isGroupAssistant || isAssigned`).
6. **Execution Mode Resolution:**
   - Denied: `{ granted: false, executionMode: 'denied' }`.
   - Direct: `{ granted: true, executionMode: 'direct' }`.
   - Requires Approval: `{ granted: true, executionMode: 'requires_approval' }`.

---

## 6. Individual-User Permission Management Workflow

### 6.1 User Interface Integration (`/admin/users`)
- Individual permission customization is accessed directly from **إدارة المستخدمين** (`/admin/users`).
- Each user row in `UserTable` displays the action button **تحديد الصلاحيات** (`data-testid="manage-permissions-btn-${user.id}"`).
- Clicking the button opens [`UserPermissionsModal`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/features/permissions/components/UserPermissionsModal.tsx).

### 6.2 `UserPermissionsModal` Specifications
- **Header:** Displays target user's full name, canonical ID, job title, department, and canonical role badge.
- **Ceiling Policy Notice:** Displays a prominent callout explaining the role ceiling policy:
  `"تخضع الصلاحيات لسياسة السقف الأقصى للأدوار (Role Capability Ceiling). الصلاحيات المتاحة للتخصيص محددة بحدود الدور الحالي للمستخدم. للترقية الإدارية الشاملة، يرجى تعديل الدور من جدول المستخدمين مباشرة."`
- **Grouped Capabilities:** 34 platform capabilities grouped into 6 understandable operational categories:
  1. إدارة دليل المستخدمين والحسابات
  2. إدارة المجموعات التدريبية والدفعات
  3. مواد المجموعات والاجتماعات التفاعلية (Group-Scoped)
  4. تأليف الكورسات والمناهج الرسمية
  5. الاعتماد، الرقابة الثنائية وسجلات التدقيق
  6. تجربة التعلم والمشاركة
- **Status Indicators:**
  - **أساسية (افتراضية):** Capability enabled by fixed baseline policy.
  - **ممنوحة فردياً:** Explicit individual grant.
  - **ملغاة فردياً:** Explicit individual denial/revocation.
  - **خارج سقف الدور:** Capability exceeds role ceiling; toggle switch is disabled with explanatory badge.
  - **نطاق المجموعة فقط:** Indicates capability applies within authorized assigned groups.
- **Audit Justification:** Requires an administrative justification reason before saving.
- **Persistence:** Saved via `permissionsApi.setUserPermissionOverride(userId, { granted, revoked, reason })`.

---

## 7. Group-Scoped Assistant Lecturer Assignment Engine

### 7.1 Domain Model: `GroupAssistantAssignment`
```typescript
export interface GroupAssistantAssignment {
  groupId: string;
  assistantLecturerId: string;
  assignedByLecturerId: string;
  assignedAt: string;
  status: 'active' | 'revoked';
}
```

### 7.2 Operational Rules
1. **Assignment Criteria:** A lecturer or administrator can assign another existing user with role `'lecturer'` as an assistant for a specific training group. Non-lecturers (trainees) cannot be assigned as assistant lecturers.
2. **Permitted Duties within Assigned Group:**
   - Upload supplementary group files (`materials.upload_files`).
   - Delete supplementary group files (`materials.delete_files`).
   - Manage group interactive meetings (`materials.manage_meetings`).
   - Manage group folder structure (`materials.manage_folders`).
   - Monitor group training progress and trainees.
3. **Prohibited Actions (Outside/Above Scope):**
   - Cannot manage unrelated groups.
   - Cannot author or modify course curriculum (`courses.edit_curriculum`, `courses.upload_lectures`, `courses.delete_lectures`).
   - Cannot administer user accounts or configure permissions.
   - Cannot approve administrator requests.
4. **Assignment Revocation:** Revoking the assignment immediately removes group-derived capabilities without modifying the user's canonical account or historical learning records.

---

## 8. Immutable Administrator Protection Invariants

The following safeguards are strictly enforced in [`policy.ts`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/core/permissions/policy.ts) and [`inMemoryStore.ts`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/mocks/store/inMemoryStore.ts):

1. **System Administrator Account Creation:** An authorized System Administrator (`admin`) may create another account with the canonical `admin` role through the authorized user-creation workflow.
2. **Assistant Administrator Cannot Create Admin Accounts:** An assistant administrator (`assistant_admin`) must never create an account with the canonical `admin` role, with or without operational delegation. This restriction is enforced across direct API calls (`POST /api/admin/users`), approval-request creation (`POST /api/admin/permissions/approvals`), and approval-request execution.
3. **Protected Administrator Deletion Invariant:** Existing system-administrator accounts can never be deleted by anyone (`INVARIANT_ADMIN_ACCOUNT_NON_DELETABLE`). Ordinary account-management deletion calls (`DELETE /api/admin/users/:id`) targeting an `admin` account are rejected with `403 Forbidden`.
4. **Assistant Administrator Invariant:** An assistant administrator cannot suspend, demote, or delete a system administrator, nor approve requests targeting a system administrator.
5. **Self-Mutation Invariant:** A system administrator cannot suspend or demote their own account through ordinary self-service operations.
6. **Peer Verification Invariant:** Administrative account mutations targeting a system administrator require a different authorized system administrator.
7. **Last Active Administrator Invariant:** The system must always maintain at least one active, non-suspended system administrator. Any operation that would leave zero active administrators is rejected.
8. **Administrative Lockout Prevention:** Essential system administrator capabilities (`permissions.configure_roles`, `permissions.configure_users`, `users.view_directory`, `users.change_role`) cannot be removed from the `admin` role default configuration.
9. **Fail-Safe Missing Context:** Sensitive operations fail safely if essential actor, target, or context is missing.

---

## 9. Permissions Policy & Governance Interface (`/admin/permissions`)

The page at `/admin/permissions` provides a controlled, design-system-compliant configuration interface for role defaults and operational governance.

### 9.1 Two-Tab Architecture
The page is organized into exactly two dedicated tabs:
1. **الأدوار وسقوف الصلاحيات (`tab-matrix-btn`):**
   - Renders baseline capability defaults, capability ceilings, group scope requirements, and approval requirements across the four canonical roles (`admin`, `assistant_admin`, `lecturer`, `user`).
   - For authorized System Administrators (`admin`), eligible capabilities within the role ceiling are editable via interactive checkboxes.
   - For Assistant Administrators or read-only viewers, the matrix remains view-only with non-interactive status badges.
   - Capabilities outside the role ceiling are non-selectable and marked with `"✕ محظورة نهائياً"`.
   - Modifying a role default affects all users of that role who do not have an explicit individual override.
   - Includes unsaved changes tracking, a sticky save bar, and an accessible Arabic `ConfirmDialog` warning of the shared role impact before persisting changes to the central mock store.
2. **التفويض والرقابة الثنائية (`tab-governance-btn`):** Assistant-administrator delegation toggles and dual-control approval ledger for high-risk operations.

### 9.2 Distinct Semantic Matrix States
Rather than ambiguous or unstyled toggles, the matrix clearly communicates state using accessible text badges and semantic icons without relying on color alone:
- **`✓ مباشرة` / Interactive Checkbox (Default Baseline):** Granted to the role by configured default policy.
- **`➕ قابلة للمنح الفردي` (Override Eligible):** Permitted within the role ceiling; may be enabled in role defaults by `admin` or granted to individual users under `/admin/users`.
- **`👥 نطاق مجموعة` (Group Scope):** Assigned dynamically within a specific training group (e.g. Assistant Lecturer).
- **`⏳ اعتماد / تفويض` (Delegation/Approval Controlled):** Requires System Administrator approval by default; directly executable when operational delegation is active.
- **`✕ محظورة نهائياً` (Ceiling / Invariant Forbidden):** Outside role ceiling or permanently blocked by protected system invariants.

### 9.3 Single Ownership of Individual Overrides
- Individual permission customization is exclusively owned by `/admin/users` via the **تحديد الصلاحيات** action and `UserPermissionsModal`.
- Shared role defaults are configured under `/admin/permissions` and never overwrite or silently erase individual overrides.
- A cross-link action button directs administrators from `/admin/permissions` directly to `/admin/users`.

### 9.4 Design-System Compliance
The interface strictly adheres to `docs/frontend/design-system.md`:
- Reuses design system semantic CSS variables and Tailwind tokens (`bg-bg`, `text-text`, `border-border`, etc.) instead of hardcoded hex colors.
- Reuses registered semantic icon components (`shield`, `users`, `grid`, `arrowLeft`, `rotateCcw`, `checkSquare`).
- Uses standard design system buttons (`Button`), badges (`Badge`), confirmation dialogs (`ConfirmDialog`), and toast notifications (`useToast`).
- Full RTL layout support, accessible focus rings, and proper contrast across light and dark modes.

---

---

## 11. System Security Audit Trail Architecture (Increment 11 — Phase 4D)

### 11.1 Purpose & Architectural Scope
The System Security Audit Trail provides an authoritative, immutable, and read-only record of security-relevant administrative actions and governance events across the Metro Courses LMS platform. It guarantees:
1. **Sovereign Audit-Read Authorization:** Access to the audit trail via `GET /api/admin/audit` and the UI at `/admin/audit` is strictly restricted to authenticated System Administrators (`role === 'admin'`) holding the `audit.view_system_logs` capability. Assistant administrators, lecturers, and trainees are denied with HTTP 403 (and redirected to `/403`), even when operational delegation is active.
2. **Authoritative Actor Attribution:** The audit trail resolves the actor identity and role from the authenticated session context rather than trusting client-supplied values.
3. **Sensitive Data Sanitization:** Passwords, tokens, API keys, credentials, and authorization headers are recursively and irreversibly stripped from audit payloads before storage. Fabricated IP addresses, geolocation, or user-agent telemetry are strictly omitted.
4. **Distinction Between Proposals & Mutations:** Submitting an approval request logs an event with outcome `pending_approval`. The underlying domain mutation is NOT applied until explicit approval and successful execution occur. Denied or failed actions record their outcome without executing the prohibited mutation.

### 11.2 Audit Data Contracts
Located in `src/core/permissions/types.ts`:
- **`AuditEventOutcome`:** `'success' | 'denied' | 'pending_approval' | 'rejected' | 'failed'`.
- **`AuditLogSeverity`:** `'info' | 'warning' | 'critical'`.
- **`SystemAuditLogEntryDTO`:**
  - `id`: Stable sequential identifier (e.g. `AUD-1001`).
  - `timestamp`: ISO 8601 UTC timestamp.
  - `actorId`, `actorName`, `actorRole`: Authoritative identity of the performing administrator.
  - `action`: Domain action identifier (e.g. `users.create`, `permissions.configure_roles`, `approvals.decide_request`).
  - `actionLabelAr`: Clear Arabic label for the administrative action.
  - `severity`: Visual classification for auditing risk.
  - `outcome`: Execution result.
  - `resourceType`, `targetResourceId`, `targetResourceName`: Safe target resource metadata when applicable.
  - `details`: Human-readable Arabic explanation of the event.
  - `requestId`: Approval correlation identifier when linked to governance flows.
  - `metadata`: Safe domain-specific metadata (with passwords and credentials strictly redacted).
- **`AuditFilterParams` & `AuditLogResponseDTO`:** Standardized query and paginated response contracts supporting search, category, severity, outcome, actor ID, and date ranges.

### 11.3 Domain Operation Instrumentation Coverage
Audit logging is instrumented at the central store and API boundary across four key domains:
1. **Account Lifecycle:**
   - `users.create`: Logs user creation (passwords stripped, outcome `success`).
   - `users.change_role`: Logs role promotion/demotion with `previousRole` and `newRole` metadata.
   - `users.change_status`: Logs suspension/reactivation with administrative justification.
   - `users.delete`: Logs account deletion with critical severity.
2. **Permissions & Invariants Management:**
   - `permissions.configure_roles`: Logs shared role default modifications.
   - `permissions.configure_users`: Logs individual user permission grants, revocations, and resets.
   - `INVARIANT_CEILING_VIOLATION`: Logs denied attempts when trying to assign capabilities beyond a role's capability ceiling (`outcome: 'denied'`).
   - `INVARIANT_ADMIN_LOCKOUT_PREVENTION`: Logs denied attempts when trying to strip essential capabilities from the administrative default policy or the sole active administrator.
3. **Assistant Administrator Governance & Approvals:**
   - `governance.delegation`: Logs activation or revocation of operational delegation.
   - `approvals.submit_request`: Logs submission of an approval request with outcome `pending_approval`.
   - `approvals.decide_request`: Logs administrative decision (`outcome: 'success'`, `rejected`, or `failed`), preventing repeated or unauthorized attempts.
   - Dual-control violation logging: Logs denied attempts when a requester tries to approve their own request.
4. **Group Lifecycle & Course Publication:**
   - `groups.create`, `groups.edit_config`, `groups.archive`, `groups.delete`: Logs training cohort mutations.
   - `courses.publish`: Logs course approval and publication via review decisions.

### 11.4 In-Memory Persistence Limitation & Scope Gaps
- **In-Memory Demonstration Data:** Audit records reside purely in the in-memory mock store (`inMemoryStore.systemAuditLogs`) initialized with deterministic fixtures (`INITIAL_SECURITY_AUDIT_LOGS`). Audit records do not survive a full application restart or page reload, and resetting the store returns the ledger to its baseline state.
- **Scope Gaps:** Routine learning interactions (video player playback, lesson completion ticks, quiz attempts, forum replies) are intentionally excluded from the security audit ledger to maintain focused administrative and governance compliance.

---

## 12. Department Course-Track Configuration Architecture (Increment 11 — Phase 4E)

### 12.1 Objective & Architectural Scope
Phase 4E introduces administrator-managed configuration mapping organizational departments to their allowed training tracks. It establishes:
1. **Dedicated Administrative Route (`/admin/department-tracks`):** A dedicated administrative page for managing department-to-track mappings, leaving the approved two-tab structure of `/admin/permissions` intact.
2. **Canonical Catalogs Single Source of Truth:**
   - 10 Canonical Departments (`DEPT-OPERATIONS`, `DEPT-MAINTENANCE`, `DEPT-ELEC-MAINT`, `DEPT-MECH-MAINT`, `DEPT-SIGNALS`, `DEPT-TRAINING`, `DEPT-IT`, `DEPT-CUSTOMER`, `DEPT-SECURITY`, `DEPT-GEN-ADMIN`).
   - 7 Canonical Technical Tracks (`TRK-001` through `TRK-007`).
   - Canonical department and track definitions are loaded from `src/mocks/fixtures/departmentTracksFixtures.ts`.
3. **Dual-Control Governance & Operational Delegation:**
   - **System Administrator (`admin`):** Directly reads and updates department-track mappings (`PUT /api/admin/department-tracks/:departmentId`), recording informational audit logs (`permissions.configure_departments`).
   - **Assistant System Administrator (`assistant_admin`):**
     - *Without Delegation:* Mutations are intercepted and converted into pending approval requests (`approvals.submit_request` with outcome `pending_approval` / HTTP 202). The target department's stored configuration remains strictly unmodified.
     - *With Valid Delegation:* Executes directly (`executionMode: 'direct'` / HTTP 200).
   - **Lecturer and Trainee:** Denied access to endpoints (`GET` and `PUT`) with HTTP 403, and redirected to `/403` via route guard.
4. **Validation & Atomic-Update Safeguards:**
   - Unknown department identifiers are rejected with HTTP 404 / `MockStoreError(404)`.
   - Unknown track identifiers, malformed payloads, or non-array values are rejected with HTTP 400 / `MockStoreError(400)`.
   - Updates are applied atomically: an invalid request cannot partially modify or corrupt the department configuration.
   - Duplicate track IDs are cleanly deduplicated before saving.
5. **Approval Revalidation at Execution Time:**
   - When an administrator approves a pending `permissions.configure_departments` request, the store revalidates the target department ID and all proposed track IDs against canonical catalogs before executing the mutation, preventing repeated execution and stale mutations.

### 12.2 Department-Track Data Contracts
Located in `src/core/permissions/types.ts`:
```typescript
export interface CanonicalTrackDTO {
  id: string;
  code: string;
  nameAr: string;
  category: 'technical' | 'safety' | 'operations' | 'administrative';
  descriptionAr: string;
}

export interface CanonicalDepartmentDTO {
  id: string;
  nameAr: string;
  code: string;
  division: string;
}

export interface DepartmentPermissionDTO {
  departmentId: string;
  departmentName: string;
  allowedTracks: string[];
  updatedAt: string;
  updatedBy?: string;
}

export interface UpdateDepartmentTracksRequestDTO {
  allowedTracks: string[];
  justification?: string;
}

export interface UpdateDepartmentTracksResponseDTO {
  department: DepartmentPermissionDTO;
  requiresApproval?: boolean;
  approvalRequestId?: string;
  messageAr: string;
}
```

### 12.3 API & Central Store Operations
- **Endpoints:**
  - `GET /api/admin/department-tracks`: Returns all configured departments along with full canonical catalogs.
  - `GET /api/admin/department-tracks/:departmentId`: Returns track mapping for a single department.
  - `PUT /api/admin/department-tracks/:departmentId`: Updates allowed tracks with approval interception and delegation evaluation.
- **Store Methods in `inMemoryStore`:**
  - `getCanonicalDepartments()`: Returns deep copy of the 10 canonical departments.
  - `getCanonicalTracks()`: Returns deep copy of the 7 canonical technical tracks.
  - `getAllDepartmentTracks()`: Returns all department-track configurations.
  - `getDepartmentTracksById(departmentId)`: Returns configuration for a specific department.
  - `updateDepartmentTracks(departmentId, allowedTracks, actor)`: Validates and atomically updates the configuration, logging to `systemAuditLogs`.
  - `approveApprovalRequest(requestId, adminId, decisionNote)`: Revalidates and executes pending department configuration requests.

### 12.4 Critical Architectural Boundary: No Downstream Enforcement
> [!IMPORTANT]
> **Preservation of Architectural Boundary:**
> Phase 4E configures department-to-track policy only. It does **NOT** implement course-catalog visibility enforcement.
> Modifying or clearing a department's `allowedTracks` does not:
> - Filter or hide courses from the course catalog (`/courses`).
> - Change trainee enrollment eligibility.
> - Remove or cancel existing enrollments.
> - Modify course assignments or historical attempt ledgers.
> - Restrict course access through unrelated learning routes.
> Catalog-level gating is strictly decoupled and reserved for future organizational policy phases.

### 12.5 In-Memory Persistence Limitation
Department-to-track configurations reside purely in `inMemoryStore.departmentTracks` and reset deterministically to `INITIAL_DEPARTMENT_TRACKS` upon store reset (`inMemoryStore.reset()`). Changes do not persist across application reloads or restarts.

---

## 13. Verification & Test Coverage Summary

The system architecture, governance invariants, editable role defaults, security audit trail, and department-track configuration are verified by **139 comprehensive automated tests** across three dedicated suites:
1. [`src/test/permissions-governance.test.tsx`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/test/permissions-governance.test.tsx) (**80 tests** across 15 sections):
   - Four Canonical Roles, Ceilings, Overrides, Assistant Lecturer Assignment, Approval Interception, Invariants, and Admin Lockout Prevention.
2. [`src/test/security-audit-trail.test.tsx`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/test/security-audit-trail.test.tsx) (**36 tests** across 9 sections):
   - In-Memory Audit Ledger & Deterministic Reset, Account Lifecycle & Password Sanitization, Permission Instrumentation, Assistant Admin Governance, Denied Invariants, Group Lifecycle & Course Publication Instrumentation, Sovereign Access Control (`GET /api/admin/audit`), Filters & Pagination, and `/admin/audit` UI Workflows.
3. [`src/test/department-tracks.test.tsx`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/test/department-tracks.test.tsx) (**23 tests** across 7 sections):
   - Canonical Fixtures & Deterministic Store Reset (10 depts, 7 tracks, deep cloning).
   - Data Validation & Atomic Update Safeguards (reject unknown depts/tracks, deduplicate tracks, atomic updates).
   - Security Audit Trail Instrumentation (`permissions.configure_departments`).
   - API Endpoints & Role Authorization (Admin direct PUT, Assistant Admin approval interception / delegation bypass, Lecturer & Trainee 403).
   - Approval Workflow Execution & Rejection Semantics (system admin approval executes mutation; rejection preserves config).
   - Preservation of Architectural Boundary (verifies catalog courses and user attempts remain 100% untouched).
   - User Interface (`/admin/department-tracks` rendering, department selection, track checklist toggling, unsaved badge, save action, ProtectedRoute).

All test suites, ESLint (0 errors, 0 warnings), and TypeScript production build (`tsc -b && vite build`) pass cleanly.
