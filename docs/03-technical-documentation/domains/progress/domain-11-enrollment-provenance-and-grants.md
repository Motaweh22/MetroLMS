# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 11 — Enrollment Provenance & Grants

> **Document Title:** Technical Domain Specification — Enrollment Provenance & Grants  
> **Document Identifier:** `METROLMS-TECH-DOM-011`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../../architecture/decision-register.md#d-06), [`D-07`](../../../architecture/decision-register.md#d-07), [`D-GRP-07`](../../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `coursesApi` (`enrollCourse`, `getCourseEnrollment`, `getMyEnrollments`, `getMyEnrolledCourses`), `groupsApi.removeGroupMember`, `enrollmentHandlers.ts`, `inMemoryStore.ts` (`EnrollmentRecord`, `EnrollmentSourceGrant` in `core/courses/types.ts`).
- **Target Backend Components (Django 5 + DRF — Proposed):** `EnrollmentService` managing `EnrollmentRecord` and `EnrollmentSourceGrant` rows inside `transaction.atomic()`.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Direct Self-Enrollment (`POST /api/courses/:courseId/enrollments`):**
   - Creates/updates `EnrollmentRecord` with `sourceId: self:catalog:${attemptId}`, `kind: 'self'`, and a fresh standalone `CourseAttempt` at `0%`.
   - Rejects duplicate active `'self'` catalog grants with `409 Conflict`.
2. **Group-Driven Enrollment & Renewal:**
   - Adding a trainee to a group or executing in-place renewal provisions `sourceId: group:${groupId}:${cycleId}`, `kind: 'group'` bound to the cycle's `attemptId`.
3. **Group Member Removal (`DELETE /api/admin/groups/:groupId/members/:userId`, `D-07`):**
   - **Compatibility Contract (`API-REC-04`):** Accepts optional `{ removeCourseIds?: string[] }`. When omitted or empty, defaults to keeping all courses.
   - Kept courses convert their `group` grant to `kind: 'self'`, `sourceId: self:continued:${groupId}:${attemptId}`, `convertedFromGroupId: groupId`, preserving the active `attemptId` without merging with any existing `self:catalog` grant.
   - Checked courses revoke the `group` grant (`status: 'revoked_by_group_removal'`) and seal the corresponding `CourseAttempt`.

---

## 3. Validation, Authorization & Failure Scenarios

- **Deduplication Note:** `GET /api/enrollments/my` serves both `getMyEnrollments` and `getMyEnrolledCourses` (`?enriched=true`).
- **Legacy Alias Exclusion (`API-REC-02`):** `POST /api/courses/:courseId/enroll` (MSW legacy alias) is excluded from target Django API in favor of `POST /api/courses/:courseId/enrollments`.
- **Provisional Persistence Notice:** All `EnrollmentRecord` and `EnrollmentSourceGrant` columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-LRN-011`](../../../01-requirements/domains/domain-11-enrollment-provenance-and-grants.md)
- **Verification Evidence:** `frontend/src/test/enrollment-provenance.test.ts` (64 specs), `enrollment.test.tsx`, `group-member-removal-domain.test.ts` (deferred to Gate B).

