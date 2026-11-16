# MetroLMS — Backend Implementation Master Roadmap (`METROLMS-BACK-ROADMAP-001`)

> **Document Title:** Backend Implementation Master Roadmap & Permanent Execution Checklist  
> **Document Identifier:** `METROLMS-BACK-ROADMAP-001`  
> **Document Status:** `DRAFT — OWNER REVIEW REQUIRED`  
> **Canonical Authority Level:** Level 3 Execution Roadmap (Governed by [`AGENTS.md`](../../AGENTS.md), [`decision-register.md`](../architecture/decision-register.md), [`data-dictionary.md`](../02-architecture-and-design/data-models/data-dictionary.md), and [`backend-foundation-architecture.md`](backend-foundation-architecture.md))  
> **Last Updated:** 2026-11-16 (`Backend Foundation Scaffold` verified at syntax/import level; `BP-00`–`BP-13` initialized; Data Dictionary remains `UNFROZEN`)

---

## 1. Executive Summary

This document is the **single authoritative execution checklist** for implementing the MetroLMS Django 5.2 LTS + Django REST Framework + Microsoft SQL Server 2022 backend (`backend/`). It governs the complete journey from Backend Foundation Verification (`BP-00`) through SQL Server ORM & Migrations (`BP-01`), Authentication & RBAC (`BP-02`–`BP-03`), all 8 business Features (`BP-04`–`BP-11`), Cross-Feature Integration (`BP-12`), and Production Readiness (`BP-13`).

**Governance Notice:** Creating this roadmap does **not** authorize execution of database-bound models, migrations, SQL DDL, or Feature implementations. All `BP-01`+ implementation packages remain `BLOCKED` until Gate `G-01` (Data Dictionary Freeze & Phase 5 Closure) is formally approved by the Owner.

---

## 2. Progress Dashboard

| Metric | Count / Value | Notes |
|---|---:|---|
| **Total Work Packages (`BP-00`–`BP-13`)** | **14** | Ordered strictly by dependency & governance gates |
| **Completed (`DONE — VERIFIED`)** | **13** | `BP-00`–`BP-11`, `BP-12 — Cross-Feature Integration & Hardening` (`2026-11-16`) |
| **In Progress (`IN PROGRESS`)** | **0** | `BP-12` completed; only `BP-13` remains |
| **Ready (`READY`)** | **0** | `BP-13` awaits `G-04` Production Infrastructure Readiness (`Windows Server 2022` / `SQL Server 2022`) |
| **Blocked (`BLOCKED`)** | **1** | `BP-13` (blocked on `G-04` Production Infrastructure Readiness) |
| **Owner Decisions Pending (`NEEDS OWNER DECISION`)** | **0** | All `G-01`, `G-02`, `G-03` (`OD-API-01`, `OD-API-02`) are `OWNER-APPROVED — CLOSED` |
| **Deferred (`DEFERRED`)** | **0** (WPs) | `InPersonAttendanceRecord` (`Domain 16`) & `API-REC-06` (`CL-03`) remain deferred |
| **Verified Completion %** | **93%** | `13/14` Work Packages `DONE — VERIFIED` (`BP-00`–`BP-12`) |

- **Current Next Eligible Task:** `BP-13-OPS-01` (`BP-13 — Deployment & Production Readiness` — requires `G-04` Windows Server 2022 + SQL Server 2022 infra inventory)
- **Current Active Work Package:** `BP-13 — Deployment & Production Readiness` (`BLOCKED` on `G-04`)
- **Last Verified Update:** `2026-11-16`
- **Last Verification Evidence:** `BP-07` **`DONE — VERIFIED`**: `LocalMediaStorage` (magic-bytes, SHA-256, chunked upload, path traversal block), `MediaAsset`/`MediaContentReference` (`INV-DOM21-07/12/13/15/17/18`, `TR-C2-06/07` Detach/Restore/Move, `409 ASSET_IN_USE`), Django `206 Partial Content` / `416` Range streaming; `manage.py test apps.identity apps.organization apps.governance apps.courses apps.media` → `22/22` tests `OK` (`5.431s` on `test_MetroLMS`) + `manage.py check` (`dev/prod`) → `0` issues.

### Status Legend (Mandatory)
- `NOT STARTED` | `READY` | `IN PROGRESS` | `BLOCKED` | `DONE — VERIFIED` | `NEEDS OWNER DECISION` | `DEFERRED`

---

## 3. Current Project Baseline

Verified directly against the repository on `2026-11-16`:
- **Foundation Scaffold (`backend/`):** Created (`manage.py`, `requirements.txt`, `.env.example` with placeholders only, `.gitignore`, `README.md`, `config/settings/{base,development,testing,production}.py`, `config/{urls,asgi,wsgi}.py`, `apps/{identity,organization,governance,courses,media,groups,learning,communications}/`, `shared/`, `infrastructure/`, `tests/`, `scripts/`).
- **Pre-Runtime Checks:** Python syntax compilation (`compileall`) and module importability (`4` settings + `8` URL modules) passed without a live SQL Server connection. **Classified as partially validated** until `python manage.py check` executes under Python 3.12 with `backend/requirements.txt` installed.
- **Database & Code State:** Zero database-bound Django Model fields, zero migrations (`0001_initial.py`), zero SQL DDL, zero business endpoints/services, and zero database connections created.
- **Canonical Spec State:** [`data-dictionary.md`](../02-architecture-and-design/data-models/data-dictionary.md) (`54` active entities, `305` physical columns, `84` FK constraints, `45` `OR-DB-03` indexes, `101` `OR-DB-04` string fields) remains **`UNFROZEN`**; latest checkpoint is [`CP-012`](../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md); `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 4. Architecture Baseline

Preserved from [`backend-foundation-architecture.md`](backend-foundation-architecture.md) and [`django-sqlserver-integration-contract.md`](django-sqlserver-integration-contract.md):
- **Organization:** **Modular Monolith** (`OWNER-APPROVED — 2026-11-16`), **Feature-Based Django Apps + Layered Architecture inside each Feature** (`OWNER-APPROVED — 2026-11-16`), **one shared SQL Server 2022 database** (`OWNER-APPROVED — 2026-11-16`), and **SQL Server `dbo` schema** for all MetroLMS tables (`OWNER-APPROVED — 2026-11-16`). Feature ownership and application/code boundaries remain strictly enforced; a shared database does not authorize unrestricted cross-Feature access or per-Feature SQL schemas/Microservices.
- **Stack:** Python `3.12`, Django `5.2 LTS`, DRF, Microsoft SQL Server `2022` (`mssql-django==2.0.0`, `pyodbc`, ODBC Driver `18`, `mssql-python>=1.15.0`), Windows Server `2022` (`x64` pending infra inventory).
- **Auth (`D-AUTH-01`):** Server-side DB sessions (`HttpOnly`, `Secure` in prod, `SameSite=Lax` `sessionid` cookie) + `X-CSRFToken`; zero JWT/Bearer or SSO.
- **Temporal (`D-05`):** `USE_TZ=True`, `TIME_ZONE='UTC'`, `DATETIMEOFFSET(7)` UTC storage, explicit `ZoneInfo("Africa/Cairo")` via `tzdata`.
- **Media (`D-MEDIA-01`):** Local Windows volume `D:\MetroLMSMedia\` via `infrastructure.storage` abstraction (Django-mediated `Range` streaming in Phase 1).
- **Scheduling:** Windows Task Scheduler (every `6` hours) → Django management command (`process_due_group_renewals`); no Celery/Redis/RabbitMQ.

---

## 5. Governance & Authorization Gates (`G-01`–`G-04`)

| Gate ID | Gate Name | Required Conditions | Current Status | Blocks |
|---|---|---|---|---|
| **`G-01`** | **Phase 5 Closure & Data Dictionary Freeze** | `data-dictionary.md` reviewed & frozen (`FROZEN — OWNER-APPROVED (2026-11-16)`); `WP-5.6` guides accepted; `REV6 Phase 5` closed (`CP-013`) | **`OWNER-APPROVED — CLOSED`** | Unblocks `BP-01`–`BP-13` |
| **`G-02`** | **SQL Server Architecture Decisions** | **All `2026-11-16` Decisions Approved:** Modular Monolith (`OWNER-APPROVED`), Feature-Based + Layered Architecture (`OWNER-APPROVED`), one shared SQL Server 2022 database (`OWNER-APPROVED`), and `dbo` schema for all MetroLMS tables (`OWNER-APPROVED`). Zero pending sub-decisions remain. | **`OWNER-APPROVED — CLOSED`** | None (`BP-01` remains blocked by `G-01`, `BP-00`, `G-04`) |
| **`G-03`** | **API Contract Decisions** | **`OWNER-APPROVED (2026-11-16)`:** `OD-API-01` = unversioned `/api/...`; `OD-API-02` = unified `{ "status": "OK", "data": { ... } }` envelope for non-paginated `200`/`201` responses | **`OWNER-APPROVED — CLOSED`** | Unblocks `BP-02`–`BP-11` |
| **`G-04`** | **Runtime & Production Infrastructure** | **Local (`CLOSED — VERIFIED`):** Python `3.12.10` + `ODBC Driver 18` + local `SQL Server 2025 Developer` (`MSSQLSERVER`, `COMPATIBILITY_LEVEL = 160` for `SQL Server 2022` parity). **Prod (`OPEN — PRE-DEPLOYMENT VERIFICATION`, `WP55-PT-06`):** Windows Server `x64` host, `SQL Server 2022` edition/topology, IIS/Waitress vs. Nginx, `D:\MetroLMSMedia\` volume | **`LOCAL CLOSED — VERIFIED` / `PROD OPEN — PRE-DEPLOYMENT VERIFICATION`** | Local: `BP-00`, `BP-01` (unblocked); Prod: `BP-13` |

---

## 6. Implementation Phases & Work Package Sequence

```mermaid
flowchart LR
    BP00["BP-00 Foundation Verify"] --> BP01["BP-01 SQL Server & ORM"]
    BP01 --> BP02["BP-02 Auth & Sessions"]
    BP02 --> BP03["BP-03 6-Tier RBAC"]
    BP03 --> BP04["BP-04 Organization & HR"]
    BP03 --> BP05["BP-05 Governance & Audit"]
    BP04 --> BP06["BP-06 Courses & Curriculum"]
    BP05 --> BP06
    BP06 --> BP07["BP-07 Media Management"]
    BP04 --> BP08["BP-08 Groups & Onboarding"]
    BP06 --> BP08
    BP07 --> BP08
    BP08 --> BP09["BP-09 Enrollment & Progress"]
    BP09 --> BP10["BP-10 Quizzes & Certificates"]
    BP06 --> BP11["BP-11 Comms & Scheduler"]
    BP08 --> BP11
    BP10 --> BP12["BP-12 Integration & Hardening"]
    BP11 --> BP12
    BP12 --> BP13["BP-13 Production Readiness"]
```

| WP ID | Work Package | Owning Feature(s) | Dependencies | Initial Status |
|---|---|---|---|---|
| **`BP-00`** | Backend Foundation Verification | `config/`, all `apps/` | None | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-01`** | SQL Server Integration & Django ORM Foundation | All `8` Features (`54` models) | `BP-00`, `G-01`, `G-04` local (`SQL Server 2025 Developer` / `COMPATIBILITY_LEVEL = 160`) | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-02`** | Identity & Authentication / Login | `apps.identity` | `BP-01`, `G-03` (`OD-API-01`/`02` closed `2026-11-16`) | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-03`** | Authorization & 6-Tier RBAC | `apps.identity`, `shared.permissions` | `BP-02` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-04`** | Organization & HR | `apps.organization` | `BP-03` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-05`** | Governance, Approvals & Audit | `apps.governance` | `BP-03` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-06`** | Courses & Curriculum | `apps.courses` | `BP-04`, `BP-05` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-07`** | Media Management | `apps.media`, `infrastructure.storage` | `BP-06` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-08`** | Training Groups & Onboarding | `apps.groups` | `BP-04`, `BP-06`, `BP-07` | **`DONE — VERIFIED`** |
| **`BP-09`** | Enrollment & Learning Progress | `apps.learning` | `BP-08` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-10`** | Assessments, Attempts & Certificates | `apps.learning`, `apps.courses` (`QuizDefinition`) | `BP-09` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-11`** | Communications & Scheduled Operations | `apps.communications`, `infrastructure.scheduling` | `BP-06`, `BP-08` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-12`** | Cross-Feature Integration & Hardening | All `8` Features, `tests/` | `BP-10`, `BP-11` | **`DONE — VERIFIED`** (`2026-11-16`) |
| **`BP-13`** | Deployment & Production Readiness | `config/`, Windows Server 2022 | `BP-12`, `G-04` | **`BLOCKED`** (`G-04`) |

---

## 7. Feature Ownership & Cross-Feature Dependency Reference

Canonical 54-entity ownership matrix and cross-Feature dependency rules live in [`backend-foundation-architecture.md`](backend-foundation-architecture.md) **§5** and **§6** (`identity`: 7, `organization`: 10, `governance`: 2, `courses`: 15, `media`: 2, `groups`: 8, `learning`: 5, `communications`: 5; total = `54` active entities; `InPersonAttendanceRecord` = `DEFERRED`). All `85` OpenAPI `/api/...` paths are mapped in [`backend-foundation-architecture.md`](backend-foundation-architecture.md) **§11** and [`openapi-specification.yaml`](../03-technical-documentation/api/openapi-specification.yaml).

---

## 8. Detailed Work Package & Feature Checklists

### `BP-00` — Backend Foundation Verification (`DONE — VERIFIED` — `2026-11-16`)
- **Owner:** Platform / Backend Foundation | **Dependencies:** None | **Refs:** `backend/requirements.txt`, `config/settings/*.py`, `backend/scripts/metrolms-windows-environment-setup.bat`
- [x] `BP-00-ENV-01`: Installed `Python 3.12.10` (`64`-bit via `winget Python.Python.3.12`) and created `backend/.venv/` (`py -3.12 -m venv backend/.venv`).
- [x] `BP-00-ENV-02`: Upgraded `pip` (`26.3`), installed `backend/requirements.txt` (`Django 5.2.19`, `djangorestframework 3.18.3`, `mssql-django 2.0.0`, `pyodbc 5.5.0`, `mssql-python 1.17.0`, `tzdata 2026.6`), and ran `pip check` → `No broken requirements found.`.
- [x] `BP-00-CHK-01`: Verified `manage.py check --settings=config.settings.{development,testing,production}` → `System check identified no issues (0 silenced)` ×3, `config.wsgi`/`config.asgi` imports OK, `8` Feature apps registered, zero PostgreSQL config.
- [x] `BP-00-SEC-01`: Verified `.env` & `.venv/` exclusion in `backend/.gitignore`, placeholder-only `.env.example`, `DEV DEBUG=True` / `PROD DEBUG=False`, `PROD SECURE COOKIES=True`, `TIME_ZONE='UTC'`, `USE_TZ=True`, and portable setup utility `backend/scripts/metrolms-windows-environment-setup.bat`.
- **Acceptance:** `PASS` — `python manage.py check` passed across all 3 settings modules in Python `3.12.10` without production secrets.

### `BP-01` — SQL Server Integration & Django ORM Foundation (`DONE — VERIFIED` — `2026-11-16`)
- **Owner:** Persistence / All `8` Features | **Refs:** `data-dictionary.md` (`54` entities, `305` cols, `54` PKs, `84` FKs, `85` FK cols, `45` indexes), `schema-design-guidelines.md`, `django-models-and-migrations-guide.md`, `django-sqlserver-integration-contract.md` §4
- [x] `BP-01-DB-01`: Created local `MetroLMS` database on `MSSQLSERVER` (`SQL Server 2025 Developer`, `COMPATIBILITY_LEVEL = 160`, `Arabic_100_CI_AS`, `READ_COMMITTED_SNAPSHOT ON`, `dbo` schema, `USE_TZ=True`/`TIME_ZONE='UTC'`), plus `metrolms_app_user` login (`LoginMode=2` written; awaits one-time `MSSQLSERVER` service restart for SQL Auth, `Trusted_Connection=yes` active locally).
- [x] `BP-01-USR-01`: Defined `identity.User` (`phone_e164` login, `BIGINT IDENTITY(1,1)` PK), `identity.ServerSession` + `apps.identity.sessions.SessionStore`, and enabled `AUTH_USER_MODEL = "identity.User"` in `config/settings/base.py` prior to `0001_initial.py`.
- [x] `BP-01-MOD-01`: Mapped all `54` active entities (`identity`: 7, `organization`: 10, `governance`: 2, `courses`: 15, `media`: 2, `groups`: 8, `learning`: 5, `communications`: 5), `84` FKs (`ON DELETE NO ACTION`), `16` defaults (`default`+`db_default`), `CHECK`/`ISJSON()` constraints, `4` filtered `UNIQUE` indexes, `UserJobTitle` composite FKs, and `shared/validators/normalization.py` (`OR-DB-04`), excluding `InPersonAttendanceRecord`.
- [x] `BP-01-MIG-01`: Generated migrations across all `8` Feature apps, inspected `sqlmigrate` DDL, applied `migrate` to `MetroLMS` (`0` errors), and verified `6/6` integration & normalization tests (`test_MetroLMS`, `0.272s`) + `manage.py check` (`dev/test/prod`).
- **Acceptance:** `PASS` — Live SQL Server `MetroLMS` (`COMPATIBILITY_LEVEL = 160`) physical schema matches `data-dictionary.md` 100%.

### `BP-02` — Identity & Authentication / Login (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.identity` | **API Refs:** `/api/auth/csrf`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | **Contracts:** `authentication-and-session-contract.md` (`D-AUTH-01`, `OD-API-01`, `OD-API-02`)
- [x] `BP-02-AUTH-01` — Implemented & Verified Login, Logout & Session Lifecycle:
  - [x] Custom `PhoneE164Backend` (`phone_e164` normalization, password verification, `Active`/`Suspended` status check) + `ServerSession` `user_id` binding & `invalidate_user_sessions()`.
  - [x] `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` with `shared/api/` (`{ "status": "OK", "data": ... }` & `StandardErrorResponse`), `HttpOnly`/`SameSite=Lax` cookies, CSRF rotation/enforcement.
  - [x] Tests (`test_bp02_auth_and_sessions.py`): valid login + `ServerSession` binding, invalid credentials / suspended rejection, unauthenticated `401`, CSRF enforcement on logout + session deletion, post-login suspension `401` (`11/11` `apps.identity` tests `OK`).
- **Acceptance:** `PASS` — Session auth & logout match `D-AUTH-01`, `OD-API-01`, and `OD-API-02` (zero JWT/SSO).

### `BP-03` — Authorization & 6-Tier RBAC (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.identity` + `shared.permissions` | **API Refs:** `/api/admin/permissions/roles*`, `/api/admin/permissions/users/{userId}`, `/api/admin/permissions/effective/{userId}`, `/api/admin/permissions/governance/delegation/{userId}` | **Contracts:** `security-and-xss-baseline.md` (`INV-R1`–`INV-R10`)
- [x] `BP-03-RBAC-01`: Implemented `shared/permissions/` (`constants.py`, `engine.py`, `drf_permissions.py`) covering `RolePolicy`, 6-step `evaluate_permission()`, `UserPermissionOverride`, `DelegatedAuthority`, centralized `OR-DB-04` normalization (`shared/validators/`), `INV-R8` `404` Developer non-disclosure, `INV-R9` `requires_approval` (`202` gating), and RBAC admin endpoints.
- [x] `BP-03-RBAC-02`: Positive/negative permission & service-boundary tests (`test_bp03_rbac_and_invariants.py`) covering `INV-R1`–`INV-R9`, ceilings, overrides, and `404` parity (`15/15` `apps.identity` tests `OK`).

### `BP-04` — Organization & HR (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.organization` (`10` entities) | **API Refs:** `/api/admin/department-tracks*`, HR catalog/assignment/transcript endpoints (`/api/admin/users/*`)
- [x] `BP-04-ORG-01`: Implemented catalog services/views (`OrganizationalDepartment`, `JobTitle`, `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`, `DepartmentTrack` Option A), `D-OWNER-REV-10` `409` delete guard, `UserOrganizationalDepartment`/`DepartmentJobTitle`/`UserJobTitle` (`D-OWNER-REV-17` composite constraints), `HistoricalServiceTrainingRecord`, `OR-DB-04` normalization, and SQL Server tests (`test_bp04_organization_and_hr.py`).

### `BP-05` — Governance, Approvals & Audit (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.governance` (`2` entities) | **API Refs:** `/api/admin/permissions/governance/approvals*`, `/api/admin/audit*`
- [x] `BP-05-GOV-01`: Implemented `PendingApprovalRequest` (`UUID` PK, `202 Accepted`, `409 ALREADY_DECIDED`, `select_for_update()`, `INV-R10` execution-time revalidation/`ExecutionFailed`), immutable `AuditLogEntry` (`D-14` / `INV-R8` developer masking), and SQL Server tests (`test_bp05_governance_and_audit.py`).

### `BP-06` — Courses & Curriculum (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.courses` (`15` entities) | **API Refs:** `/api/courses*`, `/api/lecturer/courses*`, `/api/admin/courses/*` (`API-REC-02`), `/api/comments/*`, `/api/admin/comments*`
- [x] `BP-06-CRS-01`: Implemented `Course` lifecycle (`TR-C2-01` reminder terminal-child guard), `OR` audience targeting (`CourseAudience*`), `CourseDraft` (`TR-C2-02`), `Module`/`LessonItem`/`QuizDefinition`, `Rule B` `PublishedCourseVersion` snapshotting, `CourseReviewSubmission`/`StagedAdminEdit`/`WorkingNote` (`OR-DB-08a/b/c`, `OD-PF-07`, `OD-PF-03-B`), `CourseComment`/`CourseCommentReport` (`D-02` anonymization), and SQL Server tests (`test_bp06_courses_and_curriculum.py`).

### `BP-07` — Media Management (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.media` (`2` entities) + `infrastructure.storage` | **API Refs:** `/api/media/assets/*`, `/api/media/references/*`, `/api/media/references/{id}/stream` (`D-MEDIA-01`, `INV-DOM21-05`–`21`)
- [x] `BP-07-MED-01`: Implemented `LocalMediaStorage` (magic-bytes validation, SHA-256 checksum, atomic staging, path traversal protection, `METROLMS_MEDIA_ROOT` abstraction), `MediaContentReference` attach/repoint/metadata/Detach/Restore/Move (`INV-DOM21-07/12/13/15/17/18`, `TR-C2-06/07`), Django `206 Partial Content` / `416` Range streaming, and SQL Server tests (`test_bp07_media_management.py`).

### `BP-08` — Training Groups & Onboarding (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.groups` (`8` entities) | **API Refs:** `/api/groups/*`, `/api/admin/groups/*`, `/api/admin/lecturers`, `/api/admin/trainees`
- [x] `BP-08-GRP-01`: Implemented `TrainingGroup` (`regular`/`reminder`), `GroupAssistantAssignment` (`API-REC-02a`–`02c`), `GroupMembership`, `GroupJoinRequest`, `GroupQrCode` (`VARBINARY(32)` SHA-256 hash, `TR-C3-01` Option B), `GroupResource` (`INV-DOM16-03` HTTPS), `GroupRenewalCycle` (`TR-C3-02`, `INV-DOM10-10/11/12` `select_for_update()` locking), and `GroupCourseAssignment` across `backend/apps/groups/services/group_service.py`, `backend/apps/groups/api/serializers/groups.py`, `backend/apps/groups/api/views/groups.py`, `backend/apps/groups/api/urls.py`, and `backend/apps/groups/tests/test_bp08_groups_and_renewals.py`. Verified on `test_MetroLMS` SQL Server (`26/26` tests `OK` in `7.944s`; `manage.py check --settings=config.settings.{development,production}` passed with 0 issues).

### `BP-09` — Enrollment & Learning Progress (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.learning` (`Enrollment`, `EnrollmentSourceGrant`, `CourseAttempt`, `LessonProgress`) | **API Refs:** `/api/courses/{id}/enrollments*`, `/api/enrollments/my`, `/api/users/.../attempts`, `/api/courses/{id}/progress`, `.../activity|complete`
- [x] `BP-09-LRN-01`: Implemented multi-source `Enrollment`/`EnrollmentSourceGrant` (`direct`, `group`, `self:continued`), `D-06` per-attempt isolation (`start_new_attempt` sealing prior attempts), `LessonProgress` playback telemetry (`activity`) & explicit `complete` without inventing video/document thresholds, `D-12` half-up integer rounding with strict 100% gate (`99.5%` → `99%`), and `D-07` group removal preservation across `backend/apps/learning/services/learning_service.py`, `backend/apps/learning/api/serializers/learning.py`, `backend/apps/learning/api/views/learning.py`, `backend/apps/learning/api/urls.py`, and `backend/apps/learning/tests/test_bp09_enrollment_and_progress.py`. Verified on `test_MetroLMS` SQL Server (`29/29` tests `OK` in `4.839s`; `manage.py check --settings=config.settings.{development,production}` passed with 0 issues).

### `BP-10` — Assessments, Attempts & Certificates (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.learning` (`CertificateRecord`) + `apps.courses` (`QuizDefinition`) | **API Refs:** `/api/lecturer/courses/{courseId}/performance`, `/api/certificates/verify/{code}`
- [x] `BP-10-CRT-01`: Implemented exact `Decimal` quiz scoring & `WP55-PT-03` passing-score boundary (no pre-rounding), version-scoped `CertificateRecord` (`D-13`, `TR-C3-03`, `BINARY(32)` SHA-256 token hash, internal `recipient_name_snapshot` vs. PII-free public verification), revocation, and lecturer course performance across `backend/apps/learning/services/assessment_service.py`, `backend/apps/learning/api/views/assessments.py`, `backend/apps/learning/api/urls.py`, and `backend/apps/learning/tests/test_bp10_assessments_and_certificates.py`. Verified on `test_MetroLMS` SQL Server (`30/30` tests `OK` in `11.357s`; `manage.py check --settings=config.settings.{development,production}` passed with 0 issues).

### `BP-11` — Communications & Scheduled Operations (`DONE — VERIFIED` — `2026-11-16`)
- **Owning Feature:** `apps.communications` (`5` entities) + `infrastructure.scheduling` | **API Refs:** `/api/notifications*`, `/api/courses/{id}/whatsapp-contacts`, `/api/admin/users/{id}/whatsapp-visibility`, `/api/public/support-contacts`
- [x] `BP-11-COM-01`: Implemented `NotificationItem` delivery/read state (`D-08`), `WhatsAppContact` & `UserWhatsAppVisibility` (`D-09`), `ScheduledJob`/`ScheduledJobRun` (`TR-C3-04` idempotency, retry `0..2`, `ZoneInfo("Africa/Cairo")` DST 6h bucket keys per `WP55-PT-05`), and `process_due_group_renewals` management command across `backend/infrastructure/scheduling/job_runner.py`, `backend/apps/communications/services/communications_service.py`, `backend/apps/communications/management/commands/process_due_group_renewals.py`, `backend/apps/communications/api/views/communications.py`, `backend/apps/communications/api/urls.py`, and `backend/apps/communications/tests/test_bp11_communications_and_scheduling.py`. Verified on `test_MetroLMS` SQL Server (`32/32` tests `OK` in `7.849s`; `manage.py check --settings=config.settings.{development,production}` passed with 0 issues).

### `BP-12` — Cross-Feature Integration & Hardening (`DONE — VERIFIED` — `2026-11-16`)
- [x] `BP-12-INT-01`: Implemented atomic `D-01` user deletion cascade across all 8 Features (`backend/apps/identity/services/user_deletion_service.py`, `backend/apps/identity/api/views/users.py`, `DELETE /api/admin/users/<id>`) preserving Tombstone XOR records, `D-02` anonymized comments, `CertificateRecord`s (still publicly verifiable), and freeing `phone_e164`/`email` (`OD-PF-01`), plus cross-Feature integration tests for group renewal → enrollment/attempt isolation and course publish `v1→v2` attempt isolation in `backend/apps/identity/tests/test_bp12_cross_feature_integration.py`. Verified on `test_MetroLMS` SQL Server (`34/34` tests `OK` in `6.240s`; `manage.py check --settings=config.settings.{development,production}` passed with 0 issues).

### `BP-13` — Deployment & Production Readiness (`BLOCKED` — `G-04`)
- [ ] `BP-13-OPS-01`: Confirm Windows Server 2022 (`x64`), SQL Server 2022 edition/topology, IIS/Waitress vs. Nginx, HTTPS/CSP headers, `D:\MetroLMSMedia\` permissions, Windows Task Scheduler (6h), backup/restore testing, and production readiness sign-off.

---

## 9. Testing, Evidence & Blocker Tracking

- **Mandatory Per-Package Testing:** Every `BP-*` package must author and execute unit, service, serializer, API contract, RBAC (`INV-R1`–`INV-R10`), concurrency, and SQL Server 2022 integration tests alongside implementation (never deferred to REV6 Phase 6).
- **Evidence Log (`2026-11-16`):**
  - **Local Host Setup & `BP-00` (`DONE — VERIFIED`):** Windows 10 Pro `10.0.19045` (64-bit); installed `Python 3.12.10` (`64`-bit); created `backend/.venv/`; installed `backend/requirements.txt` (`Django 5.2.19`, `DRF 3.18.3`, `mssql-django 2.0.0`, `pyodbc 5.5.0`, `mssql-python 1.17.0`, `tzdata 2026.6`); `pip check` → `No broken requirements found.`; `python manage.py check` (`development`, `testing`, `production`) → `0` issues; `ODBC Driver 18` (64-bit) & `pyodbc` connected to local `MSSQLSERVER` (`Microsoft SQL Server 2025 (RTM) - 17.0.1000.7 (X64) Standard Developer Edition`; production target remains SQL Server 2022 under `G-04`).
  - **Portable Setup Utility:** Created and verified `backend/scripts/metrolms-windows-environment-setup.bat` (`/HELP`, `/CHECKONLY` from `%TEMP%`, interactive local/remote SQL checks, zero temp leftovers, zero secrets in `%LOCALAPPDATA%\MetroLMS\logs\`).
- **Active Blockers:** `BLK-04` (`G-04` Production Infrastructure Readiness `OPEN — PRE-DEPLOYMENT VERIFICATION` for `BP-13`: Windows Server 2022 + SQL Server 2022 infra inventory; `G-04` Local Development Readiness is `CLOSED — VERIFIED` and does not block local `BP-01`–`BP-12`). *(`G-01`/`BLK-01`, `G-02`/`BLK-02`, and `G-03`/`BLK-03` closed `2026-11-16`.)*

---

## 10. Change History
- `2026-11-16`: Completed `BP-12` (`DONE — VERIFIED`, `93%` overall): implemented atomic `D-01` user deletion cascade across all 8 Features (`user_deletion_service.py`, `DELETE /api/admin/users/<id>`) and verified end-to-end cross-Feature transactions (Tombstone preservation, `CertificateRecord` preservation & public verify, `OD-PF-01` email/phone reuse, group renewal + `v1→v2` publish attempt isolation), passing `34/34` SQL Server tests (`6.240s`) and `manage.py check` (`dev`/`prod`); only `BP-13` remains (`BLOCKED` on `G-04` production infra).
- `2026-11-16`: Completed `BP-11` (`DONE — VERIFIED`, `86%` overall): implemented `apps.communications` (`NotificationItem` `D-08`, `WhatsAppContact` & `UserWhatsAppVisibility` `D-09`), `infrastructure/scheduling/job_runner.py` (`TR-C3-04` idempotency, retry `0..2`, `ZoneInfo("Africa/Cairo")` DST bucket keys), and `process_due_group_renewals` management command, passing `32/32` SQL Server tests (`7.849s`) and `manage.py check` (`dev`/`prod`); `BP-12` marked `READY`.
- `2026-11-16`: Completed `BP-10` (`DONE — VERIFIED`, `79%` overall): implemented `apps.learning` quiz scoring (`WP55-PT-03` exact `Decimal` comparison), version-scoped `CertificateRecord` (`D-13`, `TR-C3-03`, `BINARY(32)` SHA-256 hash, PII-free public verification, revocation), and `/api/lecturer/courses/<id>/performance`, passing `30/30` SQL Server tests (`11.357s`) and `manage.py check` (`dev`/`prod`).
- `2026-11-16`: Completed `BP-09` (`DONE — VERIFIED`, `71%` overall): implemented `apps.learning` (`Enrollment`, `EnrollmentSourceGrant`, `CourseAttempt` `D-06` isolation, `LessonProgress` telemetry & `D-12` rounding with strict 100% gate, `D-07` group removal preservation & `self:continued`), passing `29/29` SQL Server tests (`4.839s`) and `manage.py check` (`dev`/`prod`); `BP-10` & `BP-11` marked `READY`.
- `2026-11-16`: Completed `BP-08` (`DONE — VERIFIED`, `64%` overall): implemented `apps.groups` (`TrainingGroup`, `GroupAssistantAssignment` `API-REC-02a`–`02c`, `GroupRenewalCycle` `TR-C3-02`/`INV-DOM10-10/11/12` `select_for_update()` locking, `GroupQrCode` `TR-C3-01` Option B `VARBINARY(32)` SHA-256 hash, `GroupJoinRequest` `OD-PF-04`, `GroupMembership`, `GroupResource` `INV-DOM16-03` HTTPS, `GroupCourseAssignment`), passing `26/26` SQL Server tests (`7.944s`) and `manage.py check` (`dev`/`prod`); `BP-09` marked `READY`.
- `2026-11-16`: Completed `BP-00` (`DONE — VERIFIED`, `7%` overall) with `Python 3.12.10` x64, `backend/.venv/`, `manage.py check` across `dev/test/prod`, local SQL Server `pyodbc` verification, and portable `backend/scripts/metrolms-windows-environment-setup.bat`.
- `2026-11-16`: Closed `G-01` (`OWNER-APPROVED — CLOSED` via `CP-013`, `data-dictionary.md` `FROZEN — OWNER-APPROVED (2026-11-16)`, `WP-5.6` guides accepted, `REV6 Phase 5` closed), split `G-04` into `Local Development Readiness: CLOSED — VERIFIED` (`SQL Server 2025 Developer`, `COMPATIBILITY_LEVEL = 160` for `SQL Server 2022` parity) and `Production Infrastructure Readiness: OPEN — PRE-DEPLOYMENT VERIFICATION`, and marked `BP-01` `READY` (overall roadmap remains `DRAFT — OWNER REVIEW REQUIRED`).
- `2026-11-16`: Completed `BP-01` (`DONE — VERIFIED`, `14%` overall): created local `MetroLMS` database (`COMPATIBILITY_LEVEL = 160`, `Arabic_100_CI_AS`, `RCSI = ON`), implemented all `54` Django Feature models + `shared/validators/normalization.py` (`OR-DB-04`), generated & applied all `33` migrations (`54` `dbo` tables, `84/84` `ON DELETE NO ACTION` FKs, `4` filtered `UNIQUE` indexes, `67` `CHECK`s), and passed `6/6` SQL Server integration & normalization tests (`test_MetroLMS`, `0.272s`) + `manage.py check` (`dev/test/prod`).
- `2026-11-16`: Closed `G-03` (`OWNER-APPROVED — CLOSED`: `OD-API-01 = /api/...`, `OD-API-02 = { "status": "OK", "data": { ... } }`) and completed `BP-02` (`DONE — VERIFIED`, `21%` overall): implemented `shared/api/` envelopes & exception handler, `PhoneE164Backend`, `ServerSession.user_id` binding, `/api/auth/{csrf,login,logout,me}`, and passed `11/11` `apps.identity` SQL Server tests (`0.506s`); `BP-03` marked `READY`.
- `2026-11-16`: Completed `BP-03` (`DONE — VERIFIED`, `29%` overall): implemented `shared/permissions/` (`constants.py`, `engine.py`, `drf_permissions.py`), RBAC admin endpoints (`/api/admin/permissions/{roles,users,effective,governance/delegation}`), `INV-R1`–`INV-R9`, `INV-R8` `404` non-disclosure, and passed `15/15` `apps.identity` SQL Server tests (`1.179s`); `BP-04` & `BP-05` marked `READY`.
- `2026-11-16`: Completed `BP-04` & `BP-05` (`DONE — VERIFIED`, `43%` overall): implemented `apps.organization` catalogs/assignments/historical training (`D-OWNER-REV-10/17`, `DepartmentTrack` Option A) and `apps.governance` (`PendingApprovalRequest` `202`/`409`/`INV-R10`, `AuditLogEntry` `D-14` masking), passing `19/19` SQL Server tests (`1.817s`); `BP-06` marked `READY`.
- `2026-11-16`: Completed `BP-06` (`DONE — VERIFIED`, `50%` overall): implemented `apps.courses` (`Course`, `TR-C2-01/02`, `CourseDraft`, `Rule B` `PublishedCourseVersion` snapshotting, `API-REC-02` review/`OD-PF-07`/`OD-PF-03-B`, `OR` audience targeting, `CourseComment` `D-02`), passing `21/21` SQL Server tests (`2.525s`); `BP-07` marked `READY`.
- `2026-11-16`: Completed `BP-07` (`DONE — VERIFIED`, `57%` overall): implemented `infrastructure/storage/local_storage.py` (`LocalMediaStorage`, magic-bytes, SHA-256, path traversal guard), `apps.media` (`INV-DOM21-07/12/13/15/17/18`, `TR-C2-06/07` Detach/Restore/Move, `206`/`416` Range streaming), passing `22/22` SQL Server tests (`5.431s`); `BP-08` marked `READY`.
- `2026-11-16`: Executed Stage 1–5 local environment inventory and independent `BP-00` static/config checks; marked `BP-00` `BLOCKED` on missing host Python `3.12` (`BP-00-SEC-01` passed); recorded local SQL Server 2025 (`17.0.1000.7`) + ODBC Driver 18 availability.
- `2026-11-16`: Closed Gate `G-02` (`OWNER-APPROVED — CLOSED`) following Owner approval of Single Shared SQL Server 2022 Database (`2026-11-16`). Roadmap remains `DRAFT — OWNER REVIEW REQUIRED`.
- `2026-11-16`: Integrated Owner-approved backend architecture decisions (`Modular Monolith`, `SQL Server dbo schema`, `Feature-Based + Layered Architecture` preserved as `OWNER-APPROVED`); updated `G-02` to separate the still-unapproved single-shared-DB confirmation. Roadmap remains `DRAFT — OWNER REVIEW REQUIRED`.
- `2026-11-16`: Initial creation (`DRAFT — OWNER REVIEW REQUIRED`) following Backend Foundation scaffolding (`backend/`).

