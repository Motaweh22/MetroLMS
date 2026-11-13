# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 02 — Users & Profiles

> **Document Title:** Technical Domain Specification — Users & Profiles  
> **Document Identifier:** `METROLMS-TECH-DOM-002`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Database Architects  
> **Governing Decisions:** [`D-01`](../../../architecture/decision-register.md), [`D-02`](../../../architecture/decision-register.md), [`D-03`](../../../architecture/decision-register.md), [`D-09`](../../../architecture/decision-register.md), [`D-11`](../../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:**
  - `canonicalIdentity.ts` & `resolveUser.ts`: Centralize canonical user ID normalization (`resolveCanonicalUserId`) and single-point user lookup.
  - `UsersPage` & User Directory/Profile components: Render user profiles, enforce `غير معين` for `null` instructors (`D-11`), and display `409 Conflict` lecturer supervision warnings (`D-03`).
- **Target Backend Components (Django 5 + DRF):**
  - `User` and `DeletedUserTombstone` service layer executing inside `transaction.atomic()`.
  - Deletion cascade orchestrator and comment anonymization service.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Permanent Deletion Cascade (`D-01`):** Within an atomic SQL Server transaction, delete user credentials, active sessions, enrollments, attempts, progress, certificates, group memberships, permission overrides, WhatsApp assignments, and personal notifications; auto-cancel pending approval/join requests; insert canonical ID and aliases into `deletedUserTombstones`; retain immutable `ActivityLogEntry` records.
2. **Comment Anonymization (`D-02`):** Update authored comments/replies to `userId = None`, `userEmail = None`, `userName = 'مستخدم محذوف'`.
3. **Lecturer Pre-Deletion Guard (`D-03`):** Query authored/co-lectured courses and supervised/instructed groups before deletion. If non-empty, abort with `409 Conflict` and return clickable supervised entity links.
4. **Email Collision Masking (`D-09`):** Validate email uniqueness across all rows including `developer`; on collision, return standard duplicate-email validation error (`البريد الإلكتروني مسجل مسبقاً لمستخدم آخر`) without leaking `developer` existence.

---

## 3. Validation, Authorization & Failure Scenarios

- **Authorization:** Only `admin` (or delegated `assistant_admin` subject to `INV-R9`) may delete non-protected users; `developer` (`INV-R3`) and `isProtectedAdmin` (`INV-R4`) are permanently blocked.
- **Failure Scenarios:** Concurrent deletion of the same user returns `404 Not Found` idempotently; active sessions for deleted users fail `GET /api/auth/me` with `401`.
- **Integration Boundaries & Constraints:** Physical SQL Server schema and table definitions (`UNIQUEIDENTIFIER`, filtered indexes) are deferred to Phase 5.

---

## 4. Traceability

- Business Rules: [`domain-02-users-and-profiles.md`](../../../01-requirements/domains/domain-02-users-and-profiles.md)
- Master Contract: [`django-sqlserver-integration-contract.md`](../../../backend/django-sqlserver-integration-contract.md)

