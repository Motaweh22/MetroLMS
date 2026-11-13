# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 04 — Course Catalog & Discovery

> **Document Title:** Technical Domain Specification — Course Catalog & Discovery  
> **Document Identifier:** `METROLMS-TECH-DOM-004`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-SEC-01`](../../../architecture/decision-register.md#d-sec-01), [`D-11`](../../../architecture/decision-register.md), [`D-14`](../../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:** Catalog listing pages, search/filter controls, and course summary cards rendering RTL Arabic metadata and instructor attribution (`غير معين` when `lecturerId === null`).
- **Target Backend Components (Django 5 + DRF):** Read-only catalog query selectors filtering by `actor.role`, `course.status`, and search/category parameters, with DRF pagination (`count`, `next`, `previous`, `results`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Role-Filtered Catalog Query:**
   - `user` (Trainee): `WHERE status = 'Published'`.
   - `lecturer`: `WHERE status = 'Published' OR lecturer_id = actor.id OR actor.id IN co_lecturers`.
   - `admin`, `assistant_admin` (`Rule A`), `superior` (`INV-R6`), `developer`: Full catalog across `Draft`, `PendingReview`, `Published`, and `Archived`.
2. **Attribution Projection:**
   - If `lecturerId === null`: serialize display label as `غير معين` (`D-11`).
   - If `createdBy` / `lecturerId` is a `developer` and viewer is non-Developer: project neutral `SYSTEM` / `النظام` attribution (`D-14`, `INV-R8`).

---

## 3. Validation, Authorization & Failure Scenarios

- **XSS Defense (`D-SEC-01`):** Plain text JSX escaping for titles/summaries; DOMPurify allowlist for any rich HTML course descriptions.
- **Failure Scenarios:** Direct catalog detail request by a Trainee for a `Draft` or `Archived` course returns `403 Forbidden` or `404 Not Found`.
- **Integration Boundaries & Constraints:** Enrollment grant resolution and post-deadline `'hide'` filtering are governed by Phase 3 (Domains 11–14), not Domain 04.

---

## 4. Traceability

- Business Rules: [`domain-04-course-catalog-and-discovery.md`](../../../01-requirements/domains/domain-04-course-catalog-and-discovery.md)
- Integration Contract: [`django-sqlserver-integration-contract.md`](../../../backend/django-sqlserver-integration-contract.md) (§2.2 Pagination)

