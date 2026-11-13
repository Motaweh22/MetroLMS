# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 02 — Users & Profiles

> **Document Title:** Domain 02 — Users, Profiles & Account Lifecycle Business Rules  
> **Document Identifier:** `METROLMS-DOM-USER-002`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../architecture/decision-register.md), [`D-02`](../../architecture/decision-register.md), [`D-03`](../../architecture/decision-register.md), [`D-09`](../../architecture/decision-register.md), [`D-11`](../../architecture/decision-register.md), [`D-14`](../../architecture/decision-register.md), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern canonical user identity, departmental profile attributes, email uniqueness, account lifecycle states (`active`, `suspended`, `deleted`), and referential integrity cascades upon permanent user or lecturer deletion.
- **Domain Boundaries:**
  - *In Scope:* Canonical user ID normalization (`MFR-13`), user profile fields (`name`, `email`, `department`, `jobTitle`, `initials`, `role`, `status`), permanent deletion cascades (`D-01`), comment anonymization (`D-02`), lecturer supervision deletion guard (`D-03`), nullable primary ownership (`D-11`), email collision masking (`D-09`), and deleted user tombstones (`MFR-20`, `MFR-34`).
  - *Out of Scope:* Authentication cookie transport (Domain 01), role capability ceilings and approval queue execution (Domain 03), and physical SQL Server table DDL (Phase 5).
- **Actors & Responsibilities:**
  - *System Administrator (`admin`):* Creates, edits, suspends, activates, and permanently deletes eligible non-protected accounts.
  - *Assistant Administrator (`assistant_admin`):* Views global non-Developer user directory (`Rule A`); sensitive user deletions require Admin approval by default (`INV-R9`).
  - *Platform User (All Roles):* Views own profile and canonical identity metadata.
- **Core Entities:** `User`, `UserProfile`, `DeletedUserTombstone` (`deletedUserTombstones`), `ActivityLogEntry`.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM02-01`** | **Canonical User ID Normalization (`MFR-13`)** | Every domain collection (`enrollments`, `courseAttempts`, `groupMembers`, `notifications`, `courseComments`, `approvalRequests`) must key user references by canonical ID via `resolveCanonicalUserId`. | Service Layer & `canonicalIdentity.ts` |
| **`INV-DOM02-02`** | **Permanent Deletion Cascade (`D-01`)** | `DELETE /api/admin/users/:id` permanently removes user account, credentials, enrollments, attempts, progress, certificates, group memberships, permissions, WhatsApp assignments, and personal notifications; auto-cancels pending requests; records ID/aliases in `deletedUserTombstones`; retains immutable audit logs. | User Deletion Service |
| **`INV-DOM02-03`** | **Deleted User Comment Anonymization (`D-02`)** | Course discussion comments/replies authored by a deleted user are retained for thread continuity with `userId = null`, `userEmail = null`, and `userName = 'مستخدم محذوف'`. | Comment Serialization & Deletion Service |
| **`INV-DOM02-04`** | **Lecturer Pre-Deletion Supervision Guard (`D-03`, `D-11`)** | Deleting a lecturer never deletes courses or groups. If active in any course (`lecturerId`, `coLecturers`) or group (`primaryInstructorId`, `assistantLecturerIds`, `supervisorIds`), deletion blocks with `409 Conflict` and Arabic warning; reassignment/unassignment uses `null` (`غير معين`), never `'unassigned'`. | User Deletion Service |
| **`INV-DOM02-05`** | **Developer Email Collision Masking (`D-09`)** | Email uniqueness is enforced across all accounts including `developer`; colliding with a `developer` email returns the generic duplicate-email error (`البريد الإلكتروني مسجل مسبقاً لمستخدم آخر`) without disclosing the Developer account. | User Creation/Update Service |
| **`INV-DOM02-06`** | **Deleted Account Tombstone Non-Resurrection (`MFR-20`)** | User IDs and aliases in `deletedUserTombstones` are never resurrected on lookup and fail `GET /api/auth/me` revalidation with `401`. | Identity Resolver & Auth Service |

---

## 3. State Transition Rules

- **Allowed Transitions:**
  - `Provisioned / Active` (`status = 'active'`) $\leftrightarrow$ `Suspended` (`status = 'suspended'`) by authorized Admin (subject to `INV-R1`–`INV-R5`).
  - `Active` / `Suspended` $\rightarrow$ `Permanently Deleted` (`deletedUserTombstones`) when deletion guards (`D-03`, `INV-R3`, `INV-R4`) pass.
- **Forbidden Transitions:**
  - `Permanently Deleted` $\rightarrow$ `Active` (irreversible tombstone).
  - Any UI/API deletion or suspension of `developer` (`INV-R3`) or `isProtectedAdmin === true` (`INV-R4`).

---

## 4. Dependencies, Unresolved Questions & Traceability

- **Cross-Domain Dependencies:**
  - *Domain 01 (Authentication & Sessions):* Checks `status === 'active'` and `deletedUserTombstones` during `GET /api/auth/me`.
  - *Domain 03 (Roles, Permissions & Switching):* Enforces `INV-R1`–`INV-R8` on user mutations and Developer non-disclosure across all 11 surfaces.
  - *Domain 05 & 06 (Courses):* Supplies lecturer course ownership (`lecturerId`, `coLecturers`) checked by `D-03`.
- **Confirmed Decisions vs. Unresolved Owner Questions:**
  - *Confirmed:* `D-01`, `D-02`, `D-03`, `D-09`, `D-11`, `D-14`, `MFR-13`, `MFR-20`.
  - *Unresolved / Deferred:* Departmental hierarchy data model and HR directory sync (if any) deferred to Phase 5 logical modeling; no external HR sync is currently mandated.
- **Traceability:** [`BRD-001`](../brd/BRD-001-cairo-metro-lms-platform.md), [`SRS-001`](../srs/SRS-001-core-system-requirements.md), [`domain-business-rules.md`](../../requirements/domain-business-rules.md) (§1, §8), [`decision-register.md`](../../architecture/decision-register.md).

