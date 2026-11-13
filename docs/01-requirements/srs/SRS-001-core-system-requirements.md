# MetroLMS — Software Requirements Specification (SRS)
## Subsystem / Scope: Core Functional Requirements

> **Document Title:** Software Requirements Specification — Core System Functional Scope  
> **Document Identifier:** `METROLMS-SRS-CORE-001`  
> **Document Status:** `ACTIVE — AUTHORITATIVE BASELINE`  
> **Canonical Authority Level:** Level 4 Requirements Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Software Engineers, Test Automation Engineers, System Architects  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Introduction

### 1.1 Purpose
This specification documents the complete functional requirements for the MetroLMS core platform in accordance with IEEE 830 principles. It establishes the functional baseline for frontend integration, API contract design, service layer implementation, and verification testing.

### 1.2 Intended Audience
- Frontend Engineers (React 19, TypeScript)
- Backend Engineers (Django 5, Django REST Framework)
- Database Administrators (Microsoft SQL Server)
- QA and Test Automation Engineers (Vitest, RTL, Playwright)

---

## 2. Overall System Description

### 2.1 System Context
MetroLMS operates as an enterprise Web application deployed within Cairo Metro corporate infrastructure. It integrates three primary tiers:
1. **Frontend Presentation Tier:** React 19 Single-Page Application (SPA) providing responsive RTL interfaces in Arabic and English.
2. **Application Tier:** Python 3.12+ / Django 5 REST Framework service layer managing authentication, permissions, business domain transactions, and audit logging.
3. **Database Tier:** Microsoft SQL Server (`D-DB-01`) providing relational persistence, foreign key referential integrity, and transaction atomicity.
4. **Media Storage Tier:** Decoupled storage repository/CDN serving static video binaries directly to clients (`D-MEDIA-01`).

---

## 3. Core Functional Requirements Decomposition

### 3.1 Subsystem 01: Authentication, Sessions & Identity Management
- `REQ-AUTH-01`: The system shall authenticate users via username/employee ID and password, issuing a cryptographically secure, HttpOnly, SameSite session cookie (`D-AUTH-01`).
- `REQ-AUTH-02`: The system shall prohibit storing access tokens, bearer tokens, or JWTs in browser `localStorage`, `sessionStorage`, or in-memory window variables (`D-AUTH-01`).
- `REQ-AUTH-03`: The system shall validate CSRF tokens (`X-CSRFToken`) on all state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- `REQ-AUTH-04`: The system shall enforce server-side session termination upon user logout, actively revoking the session identifier in database persistence.
- `REQ-AUTH-05`: The system shall provide an isolated Role Switcher / Preview Bar strictly in development and staging environments, permanently guarded against production exposure (`INV-R1`–`INV-R10`).

### 3.2 Subsystem 02: Curriculum Builder & Course Versioning
- `REQ-CRS-01`: The system shall allow authorized instructors and administrators to create, edit, and organize courses into modules and lessons.
- `REQ-CRS-02`: The system shall support publishing course versions under **Rule B**: publishing creates an immutable major or minor version snapshot while preserving existing trainee enrollment progress.
- `REQ-CRS-03`: The system shall compute visual structural diffs between drafted revisions and published baseline versions.
- `REQ-CRS-04`: The system shall prevent modification or deletion of published lessons currently associated with active trainee attempts.

### 3.3 Subsystem 03: Training Groups, Reminders & In-Place Renewals
- `REQ-GRP-01`: The system shall support creating departmental training groups bound to specific courses, deadlines, and trainee cohorts.
- `REQ-GRP-02`: The system shall execute training renewals **in-place** within the existing group record (`D-GRP-01`), incrementing the cycle count and sealing historical completion records.
- `REQ-GRP-03`: The system shall calculate reminder intervals using calendar day arithmetic (`D-GRP-02`).
- `REQ-GRP-04`: The system shall record reminder dispatch history using a monotonic `reminder_type` marker (`D-GRP-06`).
- `REQ-GRP-05`: The system shall exclude archived training groups from active trainee learning dashboards (`D-GRP-07`).

### 3.4 Subsystem 04: Learning Player, Assessments & Progress
- `REQ-LRN-01`: The system shall stream video lessons directly from enterprise storage via HTML5 player controls (`D-MEDIA-01`).
- `REQ-LRN-02`: The system shall enforce sequential lesson passing gates: trainees cannot access subsequent lessons until prerequisite modules and quizzes are passed.
- `REQ-LRN-03`: The system shall calculate progress deterministically using the formula:
  $$\text{Progress} = \text{Math.round}\left(\frac{\text{Completed Mandatory Lessons}}{\text{Total Mandatory Lessons}} \times 100\right)$$
- `REQ-LRN-04`: The system shall isolate individual course attempts, preserving prior scores upon re-enrollment or cycle renewal.

### 3.5 Subsystem 05: Certificates & Regulatory Verification
- `REQ-CRT-01`: The system shall automatically generate a completion certificate upon a trainee satisfying all mandatory passing gates for a published course version.
- `REQ-CRT-02`: Certificates shall be version-scoped, embedding the specific course version title and completion date.
- `REQ-CRT-03`: Certificates shall include a tamper-evident QR code linking to an unauthenticated public verification endpoint (`/verify-cert/<uuid>`).

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- All UI surfaces shall support Right-to-Left (RTL) Arabic layout tokens natively.
- Components shall conform to the Metro Design System tokens (`docs/frontend/design-system.md`).

### 4.2 Software Interfaces
- **Target Backend API:** RESTful JSON endpoints exposed by Django REST Framework over HTTPS.
- **Target Database:** Microsoft SQL Server accessed via `pyodbc` connector (`D-DB-01`).

---

## 5. Traceability Matrix

| Functional Requirement | Source BRD Requirement | Target Architecture Component | Verification Suite |
| :--- | :--- | :--- | :--- |
| `REQ-AUTH-01..05` | `BRD-001#2.1` | `HLD-001`, `ADR-001`, `ADR-003` | `isolated-role-session.test.tsx` |
| `REQ-CRS-01..04` | `BRD-001#2.1` | `HLD-002`, `LLD-002` | `course-builder-additions.test.tsx` |
| `REQ-GRP-01..05` | `BRD-001#2.1` | `ADR-005`, `ADR-006`, `ADR-007` | `approval-lifecycle-execution.test.ts` |
| `REQ-LRN-01..04` | `BRD-001#2.1` | `HLD-001`, `ADR-004` | `CourseCard.test.tsx`, `LessonContent.test.tsx` |
| `REQ-CRT-01..03` | `BRD-001#2.1` | `HLD-001` | Certificate verification suite |
