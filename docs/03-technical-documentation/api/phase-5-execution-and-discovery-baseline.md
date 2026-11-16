# MetroLMS — REV6 Phase 5 Execution Breakdown & Discovery Baseline

> **Document Title:** REV6 Phase 5 Execution Breakdown, Endpoint/DTO Inventory & Logical Data Discovery Baseline  
> **Document Identifier:** `METROLMS-API-PLAN-001`  
> **Document Status:** `DRAFT — DISCOVERY BASELINE`  
> **Canonical Authority Level:** Level 5 Implementation & API Integration Baseline (Subject to Level 1–4 Authorities)  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Project Owner, Backend DRF Engineers, Database Architects & Frontend Integrators  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01), `REV6` (`DOC-PROG-2026-11-12-REV6`)  
> **Last Updated:** 2026-11-14 (Phase 5 Kickoff — Authorized by Project Owner)

---

## 1. Governance & Scope Boundaries

- **Owner Authorization (`2026-11-14`):** Documentation Phase 4 (`Domains 16–21`) is `COMPLETED AND ACCEPTED`. **REV6 Phase 5 (Master API Contracts & Logical/Physical SQL Server Database Models)** is `AUTHORIZED` for documentation and design only. **Phase 6 (Testing Documentation)** remains deferred until Phase 5 completes.
- **Explicit Prohibitions:** No Django/DRF backend implementation code, no SQL Server database provisioning or table creation, no production migrations or handwritten DDL, no PostgreSQL assumptions, no unapproved global collation (`Arabic_CI_AS`) or global cascade defaults, no `A-03c` runtime remediation, and **no schema freeze prior to the Mandatory Owner Input & Schema Review Gate (§7)**.
- **Six-Stage Database Lifecycle (`REV6` §12.K):** Phase 5 covers **Stage 2 (Logical Database Design & ERD)**, **Stage 3 (Physical SQL Server Schema Design Guidelines)**, and **Stage 5 documentation only (`django-models-and-migrations-guide.md`)**. Stages 4, 5 execution, and 6 remain out of scope.

---

## 2. Phase 5 Work Package Breakdown (`WP-5.1`–`WP-5.8`)

| WP ID | Work Package Title | Core Deliverables | Upstream Dependencies | Acceptance Criteria | Owner Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`WP-5.1`** | **Phase 5 Kickoff, Endpoint/DTO Inventory & Discovery** | `docs/03-technical-documentation/api/phase-5-execution-and-discovery-baseline.md` (this document) | Phase 4 Accepted (`2026-11-14`) | 100% of MSW handlers, frontend API services, DTO files, 21-domain mappings, and open decisions inventoried without inventing rules | Kickoff Authorized |
| **`WP-5.2`** | **OpenAPI 3.1 Foundational Contracts** | `docs/03-technical-documentation/api/openapi-foundations.md` (auth/CSRF `D-AUTH-01`, `PageNumberPagination`, `202 Accepted` approval envelope, `ERROR` envelope, `MediaAssetReference`, versioning, idempotency) | `WP-5.1` | 100% alignment with `django-sqlserver-integration-contract.md` §2–§3, `D-AUTH-01`, `D-SEC-01`, `D-MEDIA-01`; open error-code/pagination items explicitly flagged | Owner Review on OpenAPI Foundation |
| **`WP-5.3`** | **Domain API Contract Specifications (`Domains 01–21`) & Master `openapi-specification.yaml`** | Domain API contract specs in `docs/03-technical-documentation/api/` + master `openapi-specification.yaml` (using `APISpec-template.md`) | `WP-5.2`; `A-03c-1..3` / `A-03a-1` for blocked media/move/draft endpoints only | Canonical routes reconciled (`API-REC-02` excludes 16 legacy review aliases); capability/scope guards (`INV-R1`–`INV-R10`) documented per endpoint; proposed vs. implemented clearly separated | Owner Sign-off on Unresolved API Contracts |
| **`WP-5.4`** | **Logical Data Model & Conceptual ERD (`Stage 2`)** | `docs/02-architecture-and-design/data-models/logical-data-model.md`, `data-dictionary.md`, `erd-crow-foot.md` (using `DatabaseSpec-template.md` Part 1) | `WP-5.1`, Domains 01–21 | Engine-agnostic entities, value objects, cardinalities, natural/composite keys, and lifecycle state invariants across all 21 domains | **Mandatory Owner Input & Schema Review Gate (§7)** |
| **`WP-5.5`** | **Owner-Reviewed Field Mapping & Sensitivity Register** | Proposed DB-bound field mapping package submitted for Owner review (purpose, source req, domain owner, relationships, sensitive/historical retention) | `WP-5.4` | Every proposed DB-bound field has source traceability and Owner approval before any physical design freeze | **Mandatory Owner Approval Gate (No Silent Freeze)** |
| **`WP-5.6`** | **Physical SQL Server Design Guidelines (`Stage 3`)** | `docs/03-technical-documentation/database/schema-design-guidelines.md` (using `DatabaseSpec-template.md` Part 2) | `WP-5.5` Owner Approval | T-SQL types (`UNIQUEIDENTIFIER`, `DATETIMEOFFSET(7)`, `NVARCHAR`), per-column collation analysis (no unapproved global `Arabic_CI_AS`), per-FK delete rules (no global cascade), filtered indexes, `INV-DOM10-12` concurrency/locking notes, zero handwritten DDL | Owner Review |
| **`WP-5.7`** | **Django & DRF Implementation Guidance (`Stage 5 Docs`)** | `docs/03-technical-documentation/backend/django-models-and-migrations-guide.md` & DRF serializer/permission mapping guide | `WP-5.3`, `WP-5.6` | Maps approved logical/physical SQL Server design to Django 5+ / `mssql-django` / DRF patterns without implementing backend code or migrations | Owner Review |
| **`WP-5.8`** | **API-to-Domain-to-Database Traceability & Phase 5 Closure** | Cross-layer traceability matrix (`Domain 01–21` $\leftrightarrow$ `OpenAPI` $\leftrightarrow$ `Logical/Physical Entity`) + consistency audit + `CP-DOC-05` | `WP-5.3`, `WP-5.6`, `WP-5.7` | Zero PostgreSQL remnants, zero contradictions across Levels 1–5, all open decisions resolved or formally deferred, ready for Phase 6 | **Owner Phase 5 Acceptance** |

---

## 3. Verified OpenAPI Endpoint & DTO Inventory (Frontend & MSW Baseline)

Inspection of `frontend/src/mocks/handlers/*.ts` (`13` handler modules), `frontend/src/core/api/apiClient.ts`, `frontend/src/features/**/api|services/*.ts` (`16` service modules), and `frontend/src/core/*/types.ts` (`11` domain DTO/type files + `features/whatsapp/types.ts`) establishes **140 HTTP route registrations** currently mocked in MSW:

| Handler Module | Route Count | Resource / Path Families | Authoritative DTO / Type Modules | Notes & Canonical Reconciliation |
| :--- | :---: | :--- | :--- | :--- |
| `authHandlers.ts` | 3 | `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | `core/auth/types.ts`, `features/auth/api/authApi.ts` | `D-AUTH-01` cookie session + `X-CSRFToken`; logout returns `LOGOUT_CONFIRMED` |
| `userManagementHandlers.ts` | 6 | `/api/admin/users`, `/api/admin/users/:id/role`, `/status`, `/:id`, `/:userId/transcript` | `core/user-management/types.ts`, `features/user-management/services/userManagementApi.ts` | Includes `INV-R8` 404 Developer confidentiality & `D-01` deletion rules |
| `permissionsHandlers.ts` | 23 | `/api/admin/permissions/roles*`, `/users/:userId`, `/effective/:userId`, `/governance/delegation/:userId`, `/governance/approvals*`, `/api/groups/:groupId/assistants*`, `/api/admin/audit*`, `/api/admin/department-tracks*`, `/api/admin/users/:userId/whatsapp-visibility`, `/api/public/support-contacts` | `core/permissions/types.ts`, `features/permissions/services/{permissionsApi,auditApi,departmentTracksApi}.ts` | `API-REC-02a/02b/02c` (`OWNER APPROVED — RETAIN`) for `/api/groups/:groupId/assistants*`; `INV-R9`/`INV-R10` `202 Accepted` approvals |
| `courseHandlers.ts` | 2 | `/api/courses`, `/api/courses/:courseId` | `core/courses/types.ts`, `features/courses/services/coursesApi.ts` | Public/authenticated catalog discovery & published course view |
| `builderHandlers.ts` | 5 | `/api/lecturer/courses*`, `/:courseId/draft`, `/:courseId/reset-lab` | `core/courses/types.ts`, `features/course-builder/services/builderApi.ts` | Draft curriculum editing (`courses.edit_curriculum`) |
| `reviewHandlers.ts` | 29 | `/api/courses/:courseId/submit*`, `/api/admin/courses/:courseId/*`, `/api/admin/review/:courseId/*`, `/api/approvals/*`, `/api/lecturer/approvals` | `core/courses/types.ts`, `features/course-review/api/reviewApi.ts` | **`API-REC-02` (`OWNER APPROVED`):** Target Django backend adopts `/api/admin/courses/:courseId/*` as canonical and excludes 16 equivalent legacy/alternative aliases + 1 unused handler |
| `groupHandlers.ts` | 29 | `/api/groups/my`, `/api/groups/join*`, `/api/groups/:groupId`, `/api/admin/groups*` (CRUD, renew, cycles, courses, members, QR, join-requests, materials/folders/files, monitoring), `/api/admin/lecturers`, `/api/admin/trainees`, `/api/users/:userId/courses/:courseId/attempts` | `core/groups/types.ts`, `core/groups/dtos.ts`, `features/groups/services/groupsApi.ts` | `API-REC-01`, `API-REC-08A/08B`, `A-03c` (`groups.manage_members`, `materials.manage_references`, `INV-DOM21-07..21`) apply here |
| `enrollmentHandlers.ts` | 4 | `/api/courses/:courseId/enrollments`, `/enroll`, `/enrollment`, `/api/enrollments/my` | `core/courses/types.ts` | `enrollments` vs `enroll` alias normalization needed in `WP-5.3` |
| `learningHandlers.ts` | 7 | `/api/courses/:courseId/progress`, `.../items/:itemId/{activity,complete}`, `.../lessons/:itemId/{activity,complete}`, `.../{activity,complete}` | `features/learning-player/services/learningApi.ts` | Canonical vs. legacy `items`/`lessons`/root route aliases to normalize in `WP-5.3` |
| `commentsHandlers.ts` | 10 | `/api/admin/comments*`, `/api/courses/:courseId/comments*`, `/api/comments/:commentId/report`, `/api/admin/courses/:courseId/comments-toggle` | `core/comments/types.ts`, `features/comments/services/commentsApi.ts` | Comment moderation, reporting, and course comment toggle |
| `notificationHandlers.ts` | 4 | `/api/notifications`, `/api/notifications/:id/read` (`PATCH` & `POST`), `/api/notifications/mark-all-read` | `core/notifications/types.ts`, `features/notifications/services/notificationsApi.ts` | `PATCH` vs `POST` read normalization |
| `performanceHandlers.ts` | 4 | `/api/lecturer/courses/:courseId/performance`, `/api/courses/:courseId/whatsapp-contacts`, `/api/courses/:courseId/instructors` | `core/performance/types.ts`, `features/performance/services/performanceApi.ts`, `features/whatsapp/` | Course analytics, WhatsApp contact list, instructor assignment |
| `dashboardHandlers.ts` | 2 | `/api/dashboard`, `/api/profile` | `core/dashboard/types.ts`, `features/dashboard/services/dashboardApi.ts`, `features/profile/services/profileApi.ts` | Role-aware dashboard summary & user profile |
| **Missing / Proposed Target Backend Endpoints** | **TBD** | Media Step 1 multipart upload & Step 2 repoint (`INV-DOM21-12`), Logical Detachment (`INV-DOM21-18`), Django-mediated `Range` streaming (`API-REC-06`), Certificate verification endpoint (Domain 15), Physical attendance (Domain 16 — unimplemented) | `FRD-MEDIA-001`, `A-03c` Consolidated Design | **Proposed target contracts only** — dependent on `A-03c-1`–`A-03c-3` & Owner review |

---

## 4. Domain-to-API Mapping (All 21 Domains)

| Domain | Domain Title | Primary API Handler / Service Source | Key Invariants / Decisions |
| :--- | :--- | :--- | :--- |
| **01** | Authentication & Sessions | `authHandlers.ts` / `authApi.ts` | `D-AUTH-01` (cookie session + CSRF), `S0`–`S15`, `Decision C` (`S8 -> S7`) |
| **02** | Users & Profiles | `userManagementHandlers.ts`, `dashboardHandlers.ts` (`/api/profile`) | `D-01` deletion protection, `INV-R8` `404` Developer confidentiality |
| **03** | Roles, Permissions & Switching | `permissionsHandlers.ts` (`roles`, `users`, `effective`, `delegation`, `department-tracks`) | 6-tier hierarchy, `INV-R1`–`INV-R8`, `UserPermissionOverride`, `DelegatedAuthority` |
| **04** | Course Catalog & Discovery | `courseHandlers.ts` (`/api/courses*`) | Published visibility rules, archive exclusion (`ADR-008`) |
| **05** | Course Creation & Builder | `builderHandlers.ts` (`/api/lecturer/courses*`) | `courses.edit_curriculum`, `authorId === actor.id` ownership, `A-03a-1` (`assistant_admin` scope) |
| **06** | Course Content & Lessons | `builderHandlers.ts`, `performanceHandlers.ts` (`/instructors`), `commentsHandlers.ts` | `D-SEC-01` sanitization, `MediaAssetReference` (`D-MEDIA-01`), `INV-DOM21-20` |
| **07** | Published Versions & Diffs | `reviewHandlers.ts` (`/api/admin/courses/:courseId/*` canonical) | `Rule B` immutable `PublishedCourseVersion`, `API-REC-02` alias exclusion |
| **08** | Training Groups Management | `groupHandlers.ts` (`/api/admin/groups*`, `/api/groups/:groupId`), `permissionsHandlers.ts` (`/api/groups/:groupId/assistants*`) | `API-REC-02a/02b/02c`, `D-GRP-07` archive rules, `INV-DOM17-01` `supervisorIds` monitoring-only |
| **09** | Group Membership & Rosters | `groupHandlers.ts` (`/members*`, `/join*`, `/qr-code*`, `/join-requests*`) | `groups.manage_members`, separation of group admin vs. content auth (`A-03c`), `D-07` per-course removal |
| **10** | Reminder Programs & In-Place Renewal | `groupHandlers.ts` (`/:groupId/renew`, `/:groupId/cycles*`, `check-*`) | `API-REC-01` server-side renewal, `API-REC-08A/08B`, `D-GRP-02`, `INV-DOM10-10/11/12` |
| **11** | Enrollment Provenance & Grants | `enrollmentHandlers.ts`, `groupHandlers.ts` (`/:groupId/courses`) | Multi-source `EnrollmentSourceGrant` (`direct`, `group`, `self:continued:...`), `D-07` |
| **12** | Course Attempts & Isolation | `groupHandlers.ts` (`/users/:userId/courses/:courseId/attempts`), `learningHandlers.ts` | `D-06` per-attempt isolation, standalone vs. group attempt provenance |
| **13** | Learning Progress Calculation | `learningHandlers.ts` (`/progress`), `performanceHandlers.ts`, `userManagementHandlers.ts` (`/transcript`) | `D-12` integer rounding, unified progress reader (`MFR-32`, `MFR-33`) |
| **14** | Lesson Progress Engine | `learningHandlers.ts` (`/activity`, `/complete`) | Attempt-scoped lesson completion & activity tracking |
| **15** | Certificates & Verification | `userManagementHandlers.ts` (`/transcript`), `learningHandlers.ts` (certificate metadata) | `D-13` version-scoped certificates & revocation; public verification endpoint TBD in `WP-5.3` |
| **16** | In-Person Attendance | *Not yet implemented in MSW* | Flagged in Phase 4 Gate B as unimplemented target backend capability |
| **17** | Group Monitoring & Supervisor Dashboards | `groupHandlers.ts` (`/monitoring`), `dashboardHandlers.ts` (`/dashboard`) | `INV-DOM17-01` `supervisorIds` read/monitoring only |
| **18** | Administrative Workflows & Approvals | `permissionsHandlers.ts` (`/governance/approvals*`, `/audit*`) | `INV-R9` (`202 Accepted` default approval), `INV-R10` execution-time revalidation |
| **19** | Notifications & WhatsApp | `notificationHandlers.ts`, `performanceHandlers.ts` (`/whatsapp-contacts`), `permissionsHandlers.ts` (`/whatsapp-visibility`, `/support-contacts`) | `D-08`/`D-09`, Phase 4 Gate B note on `PATCH` notifications & `support-contacts` |
| **20** | Scheduling, Deadlines & Background Jobs | `groupHandlers.ts` (`check-all-due-renewals` legacy mock -> replaced by Django command) | `Domain 20 / D4`: Windows Task Scheduler every 6h -> `process_due_group_renewals`; `INV-DOM20-06/07` |
| **21** | File Storage & Decoupled Media | `groupHandlers.ts` (`/materials/*`), `builderHandlers.ts` | `D-MEDIA-01`, `API-REC-06` (Phase 1 Django-mediated `Range` streaming), `INV-DOM21-05`–`21` |

---

## 5. Logical Data Discovery Inventory (Pre-Approval — No Fields Frozen)

*Note: `docs/backend/database-schema.md` (42-table 3NF draft) is classified as `UNAPPROVED LEGACY DRAFT — NOT AUTHORITATIVE` due to unapproved PostgreSQL syntax, though its conceptual entity taxonomy serves as a discovery reference alongside `docs/01-requirements/domains/domain-01..21.md`.*

| Cluster | Discovered Logical Entities & Value Objects | Primary Lifecycle / Sensitivity / Historical Implications |
| :--- | :--- | :--- |
| **Identity, Roles & Governance (`01`–`03`, `18`)** | `User`, `UserSession` (Django server session), `RolePolicy`, `UserPermissionOverride`, `DelegatedAuthority`, `DepartmentTrack`, `PendingApprovalRequest`, `AuditLogEntry` | Single `protected_admin` constraint; `User` soft-delete/anonymization (`D-01`); `Developer` confidentiality (`INV-R8`); immutable append-only `AuditLogEntry` |
| **Courses & Versioning (`04`–`07`)** | `Course`, `CourseDraft`, `PublishedCourseVersion`, `Module`, `Lesson`, `Quiz`, `QuizQuestion`, `CourseComment`, `CourseCommentReport`, `CourseReviewSubmission`, `StagedEdit`, `WorkingNote` | `PublishedCourseVersion` is immutable (`Rule B`); historical enrollments/certificates bind to specific version snapshots |
| **Groups, Membership & Renewals (`08`–`10`, `17`)** | `TrainingGroup`, `GroupAssistantAssignment`, `GroupCourseAssignment`, `GroupMembership`, `GroupJoinRequest`, `GroupQrCode`, `GroupRenewalCycle` | `GroupRenewalCycle` states (`Active`/`Unsealed`, `Sealed`/`Closed`, `Expired`, `Cancelled` per `INV-DOM10-10`); `INV-DOM10-12` concurrent renewal locking; `supervisorIds` monitoring-only |
| **Enrollment, Progress & Certificates (`11`–`15`)** | `Enrollment`, `EnrollmentSourceGrant` (`direct`, `group`, `self:continued`), `CourseAttempt`, `LessonProgress`, `Certificate`, `CertificateRevocation` | Historical educational records (`CourseAttempt`, `LessonProgress`, `Certificate`) must **never** be cascade-deleted on group removal (`D-07`) or media detachment (`INV-DOM21-18`) |
| **Attendance, Notifications & Media (`16`, `19`–`21`)** | `AttendanceSession`, `AttendanceRecord`, `Notification`, `WhatsAppContact`, `ScheduledJobRun`, `MediaAsset`, `MediaContentReference` (course/lesson/group material), `MaterialFolder` | `MediaAsset` technical metadata immutable after creation (`INV-DOM21-16`); `MediaContentReference` uses Logical Detachment (`INV-DOM21-18`); zero physical deletion while any reference exists (`INV-DOM21-17`); all media columns `PROVISIONAL` |

---

## 6. Microsoft SQL Server Design Dependencies (`D-DB-01`)

1. **Connector & ORM:** `mssql-django` + `pyodbc` on Microsoft SQL Server (`Encrypt=yes; TrustServerCertificate=no`). Zero PostgreSQL constructs (`TIMESTAMPTZ`, `JSONB`, `SERIALIZABLE` KMS tables, `SECURITY DEFINER` daemons).
2. **T-SQL Type Strategy:** `UNIQUEIDENTIFIER` (`UUIDField`), `DATETIMEOFFSET(7)` (`DateTimeField` with `USE_TZ=True`), `NVARCHAR(n)` / `NVARCHAR(MAX)` with `ISJSON()` check constraints (`JSONField`), `DECIMAL(5,2)` / `TINYINT` / `INT` for bounded progress values.
3. **Collation Governance:** **No global `Arabic_CI_AS` assumption.** Evaluate database-level vs. column-level collation (e.g., UTF-8 / `Arabic_CI_AS` / `Latin1_General_100_CI_AS_SC_UTF8`) per column sensitivity and index sorting/uniqueness requirements in `WP-5.6` with Owner approval.
4. **Referential Integrity:** **No global `ON DELETE CASCADE`.** Every foreign key relationship must specify explicit delete behavior (`PROTECT`/`RESTRICT`, `SET_NULL`, or explicit domain-governed soft/logical detachment) so historical educational records, published course versions, sealed cycles, and referenced media assets are never accidentally purged.
5. **Concurrency & Locking (`INV-DOM10-12`):** Evaluate SQL Server row-level locking (`select_for_update()` -> `UPDLOCK`/`ROWLOCK` behavior in `mssql-django`), unique filtered indexes (`CREATE UNIQUE NONCLUSTERED INDEX ... WHERE ...`), and transaction isolation for manual vs. 6-hour scheduled renewal (`process_due_group_renewals`).

---

## 7. Outstanding Owner Decision Register & Mandatory Schema Review Gate

### A. Unresolved Decisions Inventory

| ID | Precise Question | Affected Contracts & DB Sections | Blocking Scope |
| :--- | :--- | :--- | :--- |
| **`A-03c-1`** | Exact Logical Detachment state representation, removal audit fields, and whether detached references can be restored/reattached (and identity reuse) | `DELETE`/restore material & lesson ref APIs; `MediaContentReference` entity | Blocks `WP-5.3` removal DTOs & `WP-5.4`/`5.5` reference schema |
| **`A-03c-2`** | Physical `MediaAsset` deletion eligibility, soft-delete vs. archival vs. permanent purge after zero references, and `409` concurrency conflict status | Asset deletion API; `MediaAsset` lifecycle columns & retention | Blocks asset deletion endpoint & `MediaAsset` purge fields |
| **`A-03c-3`** | `PUT .../materials/files/:fileId/move` capability mapping (`materials.manage_folders` vs. `materials.manage_references`) | Group materials `/move` endpoint auth | Blocks `/move` endpoint spec only |
| **`A-03a-1`** | `assistant_admin` Draft Course Version scope (`domain-05`/`policy.ts` vs. `INV-R7`) for `courses.edit_curriculum` | Builder & Draft media reference endpoints | Blocks `assistant_admin` Draft API auth matrix only |
| **`API-REC-06` & `FRD-MEDIA-001` §7** | Deferred `CL-03` signed URLs, malware scanning, size limits, chunked upload, `A-01`/`A-03a`/`A-03b` remaining media items | Future delivery APIs & `MediaAsset` optional operational fields | Deferred (`PROVISIONAL` boundary preserved) |
| **`D3` NFR Targets** | Formal validation/ratification of P95 < 250ms, 5,000 concurrent learners, 99.9% SLA, RTO < 2h, RPO < 15m | Rate-limiting / payload sizing / SQL Server HA & index targets | Non-blocking for logical design; labeled `PROVISIONAL` |

### B. Mandatory Owner Input & Schema Review Gate (Before `WP-5.5` / `WP-5.6` Freeze)
No database-bound field or table mapping may be finalized or frozen until presented to the Owner with:
1. Proposed fields and business purpose.
2. Source requirements (`domain-01..21`, `decision-register.md`) and domain ownership.
3. Entity relationships, cardinalities, and lifecycle implications.
4. Sensitive, PII, confidentiality (`INV-R8`), or historical/audit retention implications.
5. Explicit Owner approval recorded prior to `WP-5.6` physical SQL Server guidelines.

---

## 8. Recommended First Executable Work Package

**Next Immediate Step: `WP-5.2` — OpenAPI 3.1 Foundational Contracts (`docs/03-technical-documentation/api/openapi-foundations.md`).**  
*Rationale:* `WP-5.2` is 100% unblocked by `A-03c-1..3` and database field approvals, establishes the shared `D-AUTH-01` session/CSRF security schemes, `PageNumberPagination`, `202 Accepted` (`INV-R9`), `ERROR` envelope (`INV-R8`), and `MediaAssetReference` (`D-MEDIA-01`) components required before authoring the 21-domain OpenAPI specifications in `WP-5.3`.

