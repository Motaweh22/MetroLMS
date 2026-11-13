# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 11 — Enrollment Provenance & Grants

> **Document Title:** Domain 11 — Enrollment Provenance & Grants Business Rules  
> **Document Identifier:** `METROLMS-DOM-LRN-011`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../architecture/decision-register.md#d-01), [`D-06`](../../architecture/decision-register.md#d-06), [`D-07`](../../architecture/decision-register.md#d-07), [`D-13`](../../architecture/decision-register.md#d-13), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern how a trainee's course access (`EnrollmentRecord`) is granted, tracked across multiple independent provenance sources (`EnrollmentSourceGrant[]`), preserved or converted upon group removal (`D-07`), and revoked without cross-source contamination (`D-06`).
- **Domain Boundaries:**
  - *In Scope:* `EnrollmentRecord` lifecycle (`active`, `inactive`, `revoked_by_group_removal`), multi-source provenance grants (`self` vs. `group`), deterministic `sourceId` formats (`self:catalog:<attemptId>`, `self:continued:<groupId>:<attemptId>`, `group:<groupId>:<cycleId>`), duplicate self-enrollment rejection (`409 Conflict`), and `D-07` group-removal continuation grant conversion.
  - *Out of Scope:* Group roster administration UI (Domain 09), in-place renewal cycle scheduling (Domain 10), and per-lesson progress calculation internals (`LLD-004`, Domains 13–14).
- **Core Entities:** `EnrollmentRecord` (`CourseEnrollment`), `EnrollmentSourceGrant`, `CourseAttempt` *(all persistence-oriented fields remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM11-01`** | **Multi-Source Provenance Isolation (`D-06`)** | A single `(userId, courseId)` `EnrollmentRecord` may hold multiple concurrent `EnrollmentSourceGrant` entries (`self` and/or `group`), each bound to a distinct `attemptId`. Granting or revoking one source never overwrites or mutates another source's grant or `attemptId`. | Enrollment Service / Store |
| **`INV-DOM11-02`** | **Deterministic Grant Identifiers** | Catalog self-enrollment grants use `sourceId = self:catalog:${attemptId}`; group grants use `sourceId = group:${groupId}:${cycleId}`; `D-07` continuation grants use `sourceId = self:continued:${groupId}:${attemptId}` with `convertedFromGroupId = groupId`. | Grant Provisioner |
| **`INV-DOM11-03`** | **Duplicate Self-Enrollment Guard** | Direct catalog self-enrollment (`POST /api/courses/:courseId/enrollments`) rejects when an active `'self'` catalog grant already exists (`409 Conflict`) without creating duplicate grants or inflating enrollment counts. | Enrollment Endpoint |
| **`INV-DOM11-04`** | **Group Removal Per-Course Retention (`D-07`)** | On group member removal (`DELETE /api/admin/groups/:groupId/members/:userId`), unchecked/kept courses convert their active `group` grant into an idempotent standalone `kind: 'self'` continuation grant bound to the **same active `attemptId`**, lifting the group deadline while never merging with any pre-existing independent self-enrollment (`S1`). Checked/removed courses revoke only the group grant. | Group Removal Service |
| **`INV-DOM11-05`** | **Aggregate Status Derivation** | `EnrollmentRecord.status` transitions to `'revoked_by_group_removal'` if and only if zero `'active'` grants remain and at least one group grant was revoked by removal. | Enrollment Aggregator |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `D-06` and `D-07` mandate multi-source provenance, per-attempt isolation, unchecked-by-default group removal checkboxes, and idempotent continuation grants preserving active progress.
- **Current Prototype Behavior:** Implemented in `frontend/src/mocks/store/inMemoryStore.ts` (`EnrollmentRecord`, `EnrollmentSourceGrant` in `core/courses/types.ts`) and `enrollmentHandlers.ts`. `groupsApi.removeGroupMember` accepts optional `removeCourseIds?: string[]` with keep-all default when omitted (technical compatibility contract `API-REC-04`).
- **Implementation Gap:** Prototype operates in-memory without SQL Server unique constraints on `(user_id, course_id, source_id)` or transactional locking.
- **Target Backend Behavior:** Django 5 + SQL Server (`transaction.atomic()`) enforces unique `(user, course, source_id)` grants and atomic `D-07` grant conversion.
- **Deferred / Provisional Notice:** Exact table/column mappings for `EnrollmentRecord` and `EnrollmentSourceGrant` remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5 Stage 2/3.

---

## 4. Boundary Conditions & Edge Cases

- **Independent Self-Enrollment + Group Enrollment Coexistence:** If a trainee self-enrolls (`S1`) and is later added to a group containing the same course, both grants coexist on `EnrollmentRecord.sources[]` with separate `attemptId`s. Removing the trainee from the group never alters `S1`.
- **Archived Group Exclusion (`D-GRP-07`):** Group grants belonging to `adminStatus === 'archived'` groups do not expose active group dashboard access, while standalone `self:continued:*` grants and sealed certificates remain accessible.

---

## 5. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec / LLD | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM11-01`–`INV-DOM11-03` | [`D-06`](../../architecture/decision-register.md#d-06) | [`METROLMS-TECH-DOM-011`](../../03-technical-documentation/domains/progress/domain-11-enrollment-provenance-and-grants.md) | `frontend/src/test/enrollment-provenance.test.ts` (64 specs), `enrollment.test.tsx` |
| `INV-DOM11-04`, `INV-DOM11-05` | [`D-07`](../../architecture/decision-register.md#d-07) | [`METROLMS-TECH-DOM-011`](../../03-technical-documentation/domains/progress/domain-11-enrollment-provenance-and-grants.md) | `frontend/src/test/group-member-removal-domain.test.ts` |

