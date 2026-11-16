# MetroLMS — Django & Microsoft SQL Server Backend Integration Contract

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Scope:** Target backend architecture (Python + Django 5+ + Django REST Framework + Microsoft SQL Server), REST API transport conventions, pagination/error/approval envelopes, media integration boundary (`D-MEDIA-01`), and authoritative SQL Server reconciliation for the frozen database schema (`D-DB-01`).
> **Last Updated:** 2026-11-15 (`CP-001`, updated for `WP55-PT-01`–`WP55-PT-06`)
> **Supersedes:** PostgreSQL-specific DDL/CLI syntax in [`docs/backend/database-schema.md`](database-schema.md) (§A.2) and [`docs/backend/contracts/developer-bootstrap-contract.md`](contracts/developer-bootstrap-contract.md) (§3).

---

## 1. Confirmed Target Backend Stack (`D-DB-01`, `D-AUTH-01`, `WP55-PT-06`)

| Layer | Technology | Role in MetroLMS |
| :--- | :--- | :--- |
| **Application OS** | **Windows Server 2022** (`OWNER-CONFIRMED`, `x64` baseline pending infra inventory) | Host operating system for Django backend (`WP55-PT-06` / `D-06`) |
| **Language & Runtime** | **Python 3.12** | Backend application runtime (`WP55-PT-06` / `D-06`) |
| **Web Framework** | **Django 5.2 LTS** + Django REST Framework (DRF) | ORM, session authentication, CSRF middleware, REST API views/serializers, management commands |
| **Relational Database** | **Microsoft SQL Server 2022** (`mssql-django==2.0.0`, **`pyodbc`** active/default runtime driver, **Microsoft ODBC Driver 18**) | Primary relational data store (`D-DB-01`, `WP55-PT-06`). **PostgreSQL is NOT part of the approved architecture.** Note: `mssql-django==2.0.0` requires `mssql-python>=1.15.0` (verified GA `1.17.0`) as a mandatory package dependency even while `pyodbc` remains the active/default runtime driver. Separate vs. co-hosted SQL Server topology is not assumed. |
| **Authentication & Sessions** | `django.contrib.auth` + `django.contrib.sessions` | Server-side database-backed sessions (`HttpOnly` `sessionid` cookie) + `csrftoken` (`D-AUTH-01`) |
| **Frontend API Boundary** | `frontend/src/api/` + MSW v2 (`frontend/src/mocks/`) | Contract-faithful HTTP client (`credentials: 'include'`) and mock parity layer during Frontend Readiness Phases 1–4 |

---

## 2. REST API Envelopes & Status Code Conventions

All frontend API clients (`frontend/src/api/`) and MSW v2 mock handlers (`frontend/src/mocks/`) must implement these exact response shapes so that switching from MSW to Django requires zero UI refactoring:

### 2.1 Immediate Mutation / Query Success (`200 OK` / `201 Created`)
```json
{
  "status": "OK",
  "data": { ... }
}
```

### 2.2 Paginated Collection Envelope (`200 OK`)
Aligned with Django REST Framework `PageNumberPagination`:
```json
{
  "count": 142,
  "next": "/api/users?page=3&pageSize=20",
  "previous": "/api/users?page=1&pageSize=20",
  "results": [ ... ]
}
```

### 2.3 Deferred Approval Mutation Envelope (`202 Accepted` — `MFR-35`, `MFR-36`)
Returned when an `assistant_admin` executes a gated mutation (`INV-R9`) that requires `Admin` approval:
```json
{
  "status": "PendingApproval",
  "approvalRequestId": "550e8400-e29b-41d4-a716-446655440000",
  "actionType": "enrollment_remove",
  "requestedByUserId": "usr-assistant-01",
  "createdAt": "2026-11-07T10:30:00Z",
  "message": "تم إرسال الطلب للمراجعة والموافقة من قبل مدير النظام"
}
```
> **Identifier Format (`WP55-PT-01` / `D-01`):** `PendingApprovalRequest.id` is SQL Server `UNIQUEIDENTIFIER` (`models.UUIDField`) and is serialized as a UUID string in `approvalRequestId` (superseding prior illustrative `"apr-2026-0042"` examples).  
> **Frontend Contract Rule (`MFR-36`):** When the frontend receives `HTTP 202` with `status: "PendingApproval"`, it must **not** mutate the target entity in local state as if the action completed. Instead, it appends the request to `pendingApprovalRequests` and displays a pending-review toast/badge.

### 2.4 Standard Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`)
```json
{
  "status": "ERROR",
  "code": "PERMISSION_DENIED",
  "message": "ليس لديك صلاحية لتنفيذ هذا الإجراء خارج نطاق المجموعات المعينة لك.",
  "fieldErrors": {
    "groupId": ["المجموعة المحددة خارج نطاق صلاحياتك."]
  }
}
```
- **Confidentiality Rule (`MFR-39` / `INV-R8`):** Any query or mutation by a non-Developer targeting a `Developer` account ID must return `404 Not Found` (`code: "RESOURCE_NOT_FOUND"`), never `403 Forbidden`, to prevent account enumeration.

---

## 3. Media & File Delivery Boundary (`D-MEDIA-01`)

Per Owner Decision **`D-MEDIA-01`**, the frontend interacts with course videos, PDFs, thumbnails, assignments, and certificates strictly through logical metadata and URL descriptors:

```ts
export interface MediaAssetReference {
  assetId: string;
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes?: number;
  disposition?: 'inline' | 'attachment';
}
```

1. **Frontend Decoupling:** Frontend components (`<LessonViewer />`, `<CertificateModal />`, upload dropzones) consume `MediaAssetReference` and never hardcode storage bucket URLs, filesystem paths, or cloud SDKs.
2. **Initial Upload, Two-Step Replacement Workflow, Phase 1 Django-Mediated Delivery, Future `CL-03` & Deferred `API-REC-06` Decisions:** Initial binary **upload** is `OWNER APPROVED` (`2026-11-13`) as `Browser -> Django Backend -> Media Storage` via `multipart/form-data` through a mandatory **Storage Abstraction** (`INV-DOM21-06` — `OWNER APPROVED — INITIAL STORAGE DEPLOYMENT DIRECTION`, `2026-11-13`: dedicated media storage on the existing Windows Server separated from application source/deployment, logs/temp, and SQL Server data/transaction-log directories, e.g., illustrative `D:\MetroLMSMedia\`, with transfer integrity/checksum support and migration path to a future separate Media Server without altering business logic, logical asset IDs, or API contracts; entity-based logical organization `INV-DOM21-05` without freezing physical directory tree or DB schema). For permitted media replacement (`INV-DOM21-10` Draft Course Versions with `INV-DOM21-11` target-draft authorization; `INV-DOM21-08` Active / Unsealed `GroupRenewalCycle`s), **`INV-DOM21-12` (`OWNER APPROVED`, `2026-11-13`)** establishes the **Two-Step Upload & Reference Repoint workflow** (`INV-DOM21-09` new `assetId` on Step 1 upload without modifying references; separate Step 2 reference repoint with independent server-side revalidation; `INV-DOM21-07` historical references untouched; `API-REC-07` `PUT`/`PATCH` metadata meanings preserved; exact endpoints, DTOs, idempotency, and transaction boundaries remain `PROPOSED`), **`INV-DOM21-13` (`OWNER APPROVED`, `2026-11-13`)** scopes `title` and `isVisible` to the specific content/material reference (`API-REC-07` `PATCH` operates on the reference, never globally across shared usages) while keeping `fileName`, `mimeType`, and `sizeBytes` as Asset-level technical metadata, **`INV-DOM21-14` (`OWNER APPROVED`, `2026-11-13`)** governs reference-level `title`/`isVisible` mutability by target reference lifecycle state (mutable in Draft Course Versions & Active/Unsealed cycles; historically immutable in Published versions & Sealed/Closed cycles; `API-REC-07` `PATCH` constrained accordingly; technical metadata mutability/versioning remains unresolved), **`INV-DOM21-15` (`OWNER APPROVED`, `2026-11-13`)** establishes immediate `isVisible: true -> false` enforcement for all trainees in an affected Active / Unsealed `GroupRenewalCycle` after successful persistence (denying new access initiation while retaining the asset/reference, preserving all learner educational records, and isolating unrelated references; `false -> true` restoration and already-open playback sessions / in-flight `Range` requests remain unresolved), **`INV-DOM21-16` (`OWNER APPROVED`, `2026-11-13`)** establishes that Asset-level technical metadata (`fileName`, `mimeType`, `sizeBytes`) becomes **immutable immediately after asset creation** across all lifecycle states and reference counts (established from server-validated uploaded binary properties; client-declared MIME/size never authoritative without server validation; binary replacement creates a new `assetId` with its own technical metadata per `INV-DOM21-09` and `INV-DOM21-12`; narrowly supersedes `API-REC-07` only regarding post-creation mutation of `fileName`, `mimeType`, and `sizeBytes`, with exact revised `PUT` semantics unresolved), and **`INV-DOM21-17` (`OWNER APPROVED`, `2026-11-13`)** establishes that **Content Reference Removal** and **Media Asset Deletion** are separate domain operations (removing a reference affects only that target reference, enforces target authorization and lifecycle restrictions, never auto-deletes the asset or alters other references/technical metadata, and an underlying Media Asset must **not** be physically deleted while **any** reference depends on it across all lifecycle states including Draft, Published, Active / Unsealed, and Sealed / Closed; `API-REC-07` `PUT`/`PATCH` do not perform deletion), and **`INV-DOM21-18` (`OWNER APPROVED`, `2026-11-13`)** establishes that Content Reference Removal uses **Logical Detachment** rather than physical deletion of the reference record (detaches the target reference from active presentation, stops presenting it as an active material, prevents new trainee access through it, preserves the historical reference record, removal history, learner educational records, the underlying Media Asset/binary, technical metadata, and unrelated references, without bypassing `INV-DOM21-07` historical immutability or server-side authorization and without treating `API-REC-07` `PUT`/`PATCH` as reference-removal endpoints), and **`INV-DOM21-19` (`OWNER APPROVED`, `2026-11-13`)** establishes **Context-Specific Content Reference Removal Authorization** (Logical Detachment is permitted **only** when authorized to manage content within the specific target context, reusing existing permissions without inventing new roles or unnecessary independent permissions: Draft Course Version editing permission for Drafts per `INV-DOM21-11`/`domain-05`; target group/cycle material-management permission for Active / Unsealed cycles per `D-SEC-01`/`INV-R6`/`INV-R7`/`INV-R9`/`authorization-and-permissions-design.md`; prohibited on Published & Sealed / Closed historical references per `INV-DOM21-07`; general file-upload permission alone is insufficient; Django independently verifies user authorization, target reference, owning context, lifecycle state, and detachment eligibility on the server; exact unestablished role-to-permission mappings & authorization gaps, exact logical state representation, removal audit fields, restoration/reattachment, removal/deletion API contracts, already-open playback sessions / in-flight `Range` requests, soft/archival/zero-reference retention, orphan cleanup, dependency counting, and concurrency boundaries remain unresolved), and **`INV-DOM21-20` (`OWNER APPROVED`, `2026-11-13`)** establishes that existing **`courses.edit_curriculum`** authorizes Draft Course Version media Content Reference management (adding references, `INV-DOM21-18` Logical Detachment, `INV-DOM21-12` Step 2 repointing, and `INV-DOM21-13`/`14` reference-level `title`/`isVisible` updates) without inventing new `PermissionKey`s (`courses.upload_lectures` remains Step 1 binary upload/Asset creation only and alone never authorizes reference modification; `courses.delete_lectures` remains whole lecture/quiz deletion; `courses.edit_metadata` remains course-level metadata; `lecturer` requires effective grant + `authorId === actor.id` ownership; `assistant_admin` Draft scope under `INV-R7` remains unresolved; applies only to Draft Course Versions), and **`INV-DOM21-21` (`OWNER APPROVED`, `2026-11-13`)** introduces the dedicated permission key **`materials.manage_references`** for managing media Content References within an eligible, specifically assigned **Active / Unsealed Group Renewal Cycle** (adding references, `INV-DOM21-18` Logical Detachment, `INV-DOM21-12` Step 2 repointing, and `INV-DOM21-13`–`15` reference-level `title`/`isVisible` updates), strictly separate from `materials.upload_files` (Step 1 upload/Asset creation only), `materials.delete_files` (existing supplementary file deletion; never reinterpreted as Logical Detachment or physical Asset deletion), `materials.manage_folders` (folder structure only), and `courses.edit_curriculum` (Draft Course Versions only), while leaving default role grants, capability-ceiling/individual-grantability placement, `assistant_admin` `INV-R9`/`DelegatedAuthority` behavior, `supervisorIds` mutation authority, and exact API contracts unresolved. Per `CL-02` (`OWNER APPROVED`, `2026-11-13`), authorized access must support both internal corporate network and external internet (home/mobile) trainees securely over HTTPS with `D-AUTH-01` / `D-SEC-01` enforcement (never exposing SMB/Windows shares or physical paths). **Phase 1 Media Delivery (`OWNER APPROVED`, `2026-11-13`):** initial production uses **Django-mediated, session-authenticated streaming** through the Storage Abstraction (preserving HTTP `Range`, `206 Partial Content`, `416`, repeated Range requests, and native seeking with authorization on Range requests; no separate Media Delivery Service, Starlette, Uvicorn, ASP.NET Core, S3, MinIO, CDN, Redis, Celery, or silent ASGI change in Phase 1; known worker-occupancy/bandwidth/concurrency risk requires representative workload validation before claiming capacity). **`CL-03` (`OWNER APPROVED`, `2026-11-13` — Future Architectural Direction; Implementation Deferred):** Short-Lived Signed URLs and `ADR-004` direct client streaming remain preserved as the **future** media authorization and delivery direction once traffic/performance justifies a separate delivery layer (distinct from Google Drive `Anyone with the link` external references). Signed URL implementation & `CL-03` technical details (exact TTL, signing algorithm/key management/rotation, URL scope, Range reuse, replay mitigation, delivery validation, post-change invalidation), separate delivery server, exact volume/capacity, backup/retention, DR design, CDN, malware scanning, exact production size limits, chunked/resumable upload, and replacement/deletion lifecycle remain `DEFERRED` under `API-REC-06` *(A-03c unresolved media lifecycle/API items remain `DEFERRED` under `API-REC-06`; physical column types/lengths/constraints are `OWNER-APPROVED` under `OR-DB-01`/`OR-DB-02`)*.

---

## 4. Authoritative Microsoft SQL Server Reconciliation (`D-DB-01`)

Two frozen reference documents in `docs/backend/` contain provisional PostgreSQL syntax written prior to Owner Decision `D-DB-01`. Because frozen historical/baseline documents are not edited in place, the table below establishes the **authoritative Microsoft SQL Server & Django ORM equivalents**:

| Frozen Document & Section | Provisional PostgreSQL Construct in Frozen Doc | Authoritative Microsoft SQL Server + Django Equivalent (`D-DB-01`) |
| :--- | :--- | :--- |
| [`docs/backend/database-schema.md`](database-schema.md) (42-table 3NF domain model) | `UUID` primary/foreign keys, `TIMESTAMPTZ`, `JSONB` columns, PostgreSQL partial indexes | **Domain model (all 42 tables, foreign keys, and 3NF relationships) remains 100% valid.** In SQL Server / Django ORM: use `UNIQUEIDENTIFIER` (`models.UUIDField`), `DATETIMEOFFSET(7)` (`models.DateTimeField` with `USE_TZ=True`), `NVARCHAR(MAX)` with `ISJSON()` constraint (`models.JSONField`), and SQL Server **filtered indexes** (`WHERE ... IS NOT NULL`). |
| [`docs/backend/database-schema.md`](database-schema.md) (§A.2 `protected_admin` constraint) | `CREATE UNIQUE INDEX idx_users_single_protected_admin ON users (is_protected_admin) WHERE is_protected_admin = TRUE;` | SQL Server Filtered Unique Index:<br>`CREATE UNIQUE NONCLUSTERED INDEX idx_users_single_protected_admin ON users (is_protected_admin) WHERE is_protected_admin = 1 AND deleted_at IS NULL;` |
| [`docs/backend/contracts/developer-bootstrap-contract.md`](contracts/developer-bootstrap-contract.md) (§3 CLI & DB rules) | `pnpm db:bootstrap-developer` CLI and PostgreSQL upsert syntax | Django custom management command:<br>`python manage.py bootstrap_developer --email <email> --name <name>`<br>Executed inside `django.db.transaction.atomic()` against Microsoft SQL Server using `User.objects.select_for_update()`. |
| Historical SUP-01 Reports (`docs/frontend/reports/sup-01-*.md`) | PostgreSQL `SERIALIZABLE` KMS quota admission tables, `SECURITY DEFINER` archival daemons, HSM fencing | **Permanently superseded (`ARCHIVED — HISTORICAL`).** Not part of MetroLMS frontend or Django + SQL Server backend architecture. |

### 4.1 Reconciled Temporal Policy (`WP55-PT-05` / `D-05`)
- **Timestamp Storage & Backend Mapping (`38` fields):** SQL Server **`DATETIMEOFFSET(7)`** with Django **`USE_TZ = True`**, storing UTC (`+00:00` numeric offset). Under `mssql-django==2.0.0`, timezone-aware Django `DateTimeField`s map to SQL Server `datetimeoffset` (`DATETIMEOFFSET(7)`) when `USE_TZ = True`. Date-only business fields (`4` fields) remain SQL Server **`DATE`**.
- **Windows Server & Django Timezone Alignment:** Windows Server 2022 system timezone must be **`UTC`**, and Django's global **`TIME_ZONE`** must be **`UTC`** to match the Windows system timezone because Django 5.2 documents limitations with alternate timezones on Windows. Do **not** set Django's global `TIME_ZONE` to `Africa/Cairo` while the Windows system timezone is `UTC`.
- **Application & Scheduler Rules (`Africa/Cairo`):**
  - Use `zoneinfo.ZoneInfo` with `tzdata` for Windows IANA timezone support and `django.utils.timezone.now()` for aware current timestamps (never naive `datetime.now()`).
  - Use explicit `ZoneInfo("Africa/Cairo")` conversions for business rules, local display, scheduling, and interpretation of local user input; do **not** rely on `timezone.localtime()` without an explicit timezone argument when Cairo time is required and the active Django timezone is `UTC`.
  - Use `timezone.override(ZoneInfo("Africa/Cairo"))` where a scoped Django operation needs Cairo-local form or template behavior.
  - Database persistence remains in UTC (`+00:00`). For `TR-C3-04` and `process_due_group_renewals`, comparisons use timezone-aware datetimes, UTC instants are converted to Cairo-local time only where the business rule requires Cairo calendar/clock semantics, DST transitions must not cause naive datetime comparisons or duplicated/missed intended occurrences, and existing idempotency and concurrency rules remain unchanged.

### 4.2 Conditional Index & Filtered-Unique Implementation (`mssql-django==2.0.0`)
*(Clarification `2026-11-15`: Reconciles earlier blanket `OD-PF-01` / `OD-PF-04` migration notes against `mssql-django==2.0.0` capabilities while preserving the Owner-approved business rules.)*

1. **Backend Feature Flags:** `mssql-django==2.0.0` (`features.py`) declares `supports_partial_indexes = True` and `supports_functions_in_partial_indexes = True`.
2. **Primary ORM Path:** Django `models.UniqueConstraint(fields=[...], condition=Q(...), name=...)` and `models.Index(fields=[...], condition=Q(...), name=...)` are the **primary proposed ORM implementation path** for MetroLMS's 4 filtered unique invariants (`User(role) WHERE role = 'developer'`, `User(email) WHERE email IS NOT NULL`, `GroupJoinRequest(training_group_id, user_id) WHERE request_status = 'Pending'`, and `CertificateRecord(course_attempt_id) WHERE course_attempt_id IS NOT NULL`).
3. **Layered Distinctions (Do Not Claim Universal Support):**
   - **Backend Feature Flags vs. ORM SQL Generation:** `_create_unique_sql()` emits `CREATE UNIQUE INDEX ... WHERE ...` for standard `AND`-based predicates.
   - **SQL Server Filtered-Index DDL Restrictions:** SQL Server T-SQL itself rejects `OR` predicates, subqueries, non-deterministic functions, and `MAX`-length (`NVARCHAR(MAX)` / `VARBINARY(MAX)`) columns in filtered index `WHERE` clauses at DDL execution time.
   - **Migration Lifecycle & Introspection Limitations:** `inspectdb`, `AlterField`, index rename/drop ordering, and custom index options (`INCLUDE` columns) remain subject to `mssql-django==2.0.0` edge cases.
4. **Mandatory Phase 12 Verification & `RunSQL` Fallback:** `python manage.py sqlmigrate` inspection and actual migration execution against SQL Server 2022 are **mandatory Phase 12 activities**. `migrations.RunSQL` is retained as an **optional technical fallback** only when generated DDL or migration lifecycle behavior requires it—not as a blanket requirement.
5. **Nullable `UNIQUE` Semantics:** In SQL Server, a single-column nullable `UNIQUE` key permits at most one `NULL`, whereas a composite `UNIQUE` key enforces uniqueness of the **complete key tuple** (different tuples sharing `NULL` in one component, such as `(NULL, 'VIEW')` and `(NULL, 'EDIT')`, may coexist; identical complete tuples containing `NULL` are rejected).

### 4.3 `OR-DB-04` Collation (`OWNER-SELECTED — TECHNICAL VERIFICATION PENDING`) & Field-Scoped Normalization (`OWNER-APPROVED — EXPLICIT OWNER DECISION — 2026-11-16`)
- **Collation Status:** **`Arabic_100_CI_AS`** on SQL Server 2022 is **`OWNER-SELECTED — TECHNICAL VERIFICATION PENDING`** (Arabic/English comparison, NFC/NFD equality, `UNIQUE` index behavior, and SQL Server 2022 instance availability must be verified during Phase 12).
- **Approved Normalization Scope (`58` / `7` / `36` = `101` Active Physical String Fields):** Blanket normalization, `NFKC`/`NFKD`, transliteration, Arabic character substitution, digit conversion, and blanket case folding are **prohibited**. Field-by-field rules follow `data-dictionary.md` §11.4:
  - **Group A — No Normalization (`58` fields):** Passwords/hashes, sessions, checksums, idempotency keys, serials, internal/external/legacy IDs, actor/target snapshots, storage keys, system enums/catalog & cycle codes (`MaritalStatusCatalog.code`, `MilitaryServiceStatusCatalog.code`, `GroupRenewalCycle.cycle_code` — strict validation, reject noncanonical input), IANA timezones, schedule configs, system error traces, and raw JSON payloads.
  - **Group B — Field-Specific (`7` fields):** `User.phone_e164` & `WhatsAppContact.phone_e164` (`strip()` + `+201[0125]` + 8 ASCII digits only; no silent local `01xxxxxxxxx` conversion); `User.email` (`strip()`, whitespace-only → `NULL` per `OD-PF-01`, lowercase domain portion only preserving local-part casing in storage; lookup/uniqueness case-insensitive under `Arabic_100_CI_AS`); `User.national_id` (`strip()` only); `LessonItem.external_video_url` & `GroupResource.meeting_url` (`strip()` only; nullable empty → `NULL`); `MediaAsset.mime_type` (`strip()` + ASCII lowercase `type/subtype` only).
  - **Group C — Unicode `NFC` / Text Normalization (`36` fields):** `27` short display fields (`strip()` + `NFC`, including `MediaAsset.file_name` as display metadata separate from `storage_key` path safety) + `9` multiline/free-form/audit-facing fields (`NFC` only).
- **Condition A — Free-Form Text Preservation (`9` `NFC`-Only Fields):** `Course.description`, `CourseComment.body`, `WorkingNote.note_body`, `HistoricalServiceTrainingRecord.certificate_info_or_notes`, `DeletedUserTombstone.reason`, `PendingApprovalRequest.reason`, `AuditLogEntry.reason`, `CourseCommentReport.reason`, and `NotificationItem.body` must configure DRF serializer fields with `trim_whitespace=False`, apply `NFC` without trimming stored whitespace, use `strip()` solely for whitespace-only validation, and convert empty/whitespace-only input to `NULL` only on defined nullable fields.
- **Condition B — Centralized Normalization Across All Write Paths:** Define a centralized application-layer normalization pipeline invoked before validation and persistence by **every** write path — DRF serializers/APIs, application services/admin workflows, scheduled jobs/background tasks, data imports/integrations, and bulk create/update/write operations. Never rely exclusively on `Model.clean()`, `Model.save()`, or DRF defaults.
- **Phase 12 Verification Requirements (Design Only — Not Executed):**
  1. Verify `NFC`/`NFD` direct equality (`=`) and `UNIQUE` index behavior on SQL Server 2022 under `Arabic_100_CI_AS` (including pairs `10a`–`10d` below).
  2. Test normalization execution prior to validation and uniqueness checks.
  3. Test free-form text preservation (leading/trailing whitespace and multiline formatting with `trim_whitespace=False`).
  4. Verify every write path — including bulk create/update operations — invokes the centralized normalization contract.
  5. Test `User.email` domain lowercasing, local-part case preservation, and case-insensitive lookup/uniqueness.
  6. Test canonical Egyptian phone acceptance and backend rejection of local-format (`01xxxxxxxxx`) input.
  7. Test that protected identifiers, hashes, sessions, storage keys, and raw JSON payloads are never silently normalized.
- **Phase 12 Comparison Test Matrix (Design Only — Not Executed):** Compare `Arabic_100_CI_AS`, `Arabic_CI_AS`, and `SQL_Latin1_General_CP1_CI_AS` on `NVARCHAR` columns using `=`, `ORDER BY`, and `UNIQUE` insertion:

| # | Category | Valid T-SQL Test Pair (`A` vs `B`) | Purpose |
|---|---|---|---|
| 1 | Arabic diacritics / tashkeel | `N'محمد'` vs `N'مُحَمَّد'` | Tashkeel equality & `UNIQUE(name_ar)` collision |
| 2 | Alef & hamza variants | `N'ادارة'` vs `N'إدارة'` vs `N'أدارة'` vs `N'آدارة'` | Variant collision & search behavior |
| 3 | Yeh & Alef Maqsura | `N'علي'` vs `N'على'` | Equality & `UNIQUE` collision |
| 4 | Teh Marbuta | `N'إدارة'` vs `N'إداره'` | Equality & `UNIQUE` collision |
| 5 | Tatweel (kashida) | `N'القاهرة'` vs `N'الـقـاهـرة'` | Ignorable/non-ignorable weight in `=` and `UNIQUE` |
| 6 | English case sensitivity | `N'Admin@Metro.eg'` vs `N'admin@metro.eg'` | `User.email` `CI` uniqueness & search |
| 7 | Latin accented characters | `N'Cafe'` vs `N'Café'` | `_AS` behavior on Latin diacritics |
| 8 | Mixed Arabic/English sort | `N'Line 1'`, `N'الخط الأول'`, `N'Metro'` | Catalog `ORDER BY name_ar` / `full_name` |
| 9 | Trailing-space equality | `N'OPS'` vs `N'OPS '` / `N'قسم'` vs `N'قسم '` | ANSI padding & `=` / `UNIQUE` trailing-space behavior |
| 10a | Latin NFC vs NFD | `N'Café'` vs `N'Cafe' + NCHAR(769)` | Precomposed vs decomposed Latin (`U+0301`) |
| 10b | Isolated Dammatan | `N'ا'` vs `N'ا' + NCHAR(1612)` | Isolate combining Dammatan (`U+064C`) sensitivity |
| 10c | Isolated Alef / Hamza | `N'ا'` vs `N'أ'` | Isolate base-letter / Hamza distinction (`U+0627` vs `U+0623`) |
| 10d | Precomposed vs decomposed Hamza | `N'أ'` vs `NCHAR(1575) + NCHAR(1620)` | Compare `U+0623` vs `U+0627 + U+0654` |

### 4.4 `OR-DB-01` Physical DDL & Validation Contract (`OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`)
- **Identity Generation (`D-02` + `OR-DB-01`):** `50` `BIGINT IDENTITY(1,1)` surrogate PKs (`models.BigAutoField(primary_key=True)` — `2` previously approved + `48` newly approved under `OR-DB-01`). Zero `IDENTITY` on `84` `BIGINT` FKs, `3` String PKs (`ServerSession.session_key`, `RolePolicy.role_key`, `DepartmentTrack.department_code`), `1` `UNIQUEIDENTIFIER` PK (`PendingApprovalRequest.id`), or non-PK identifiers.
- **Defaults (Django `5.2` `default` vs. `db_default`):** Preserves `ScheduledJob.is_enabled DEFAULT 1` (`OWNER-SELECTED`); approves `15` remaining defaults (`14` unconditional + `CourseReviewSubmission.review_status = 'Pending'` under `OR-DB-08a`) at both layers using `Field.default=...` (ORM/Python) and `Field.db_default=...` (SQL Server `DEFAULT` constraint). Django `default=` alone does **not** create a SQL Server `DEFAULT` constraint. Phase 12 `sqlmigrate` verification is mandatory.
- **Nullability:** Approves `23` remaining nullable columns across `12` groups (including SQL `NULL` for `PendingApprovalRequest.reason` and `AuditLogEntry.reason` while preserving `OD-PF-08` `500`-char lengths) and all remaining `NOT NULL` columns.
- **SQL Server `CHECK` Constraints (`52` Individual DDL Constraints) & Implementation Qualifications:**
  - `38` domain/enum/range/XOR/date checks + `4` `LessonProgress` telemetry checks + `10` non-empty text checks (`52` total physical `CHECK`s).
  - **`User.phone_e164`:** Avoid collation-sensitive `[0-9]` range matching and `LEN()`-only trailing-space gaps; use explicit `BIN2` collation, explicit ASCII digit class `[0123456789]`, and exact 26-byte UTF-16 `NVARCHAR` length (`CHECK (phone_e164 COLLATE Arabic_100_BIN2 LIKE N'+201[0125][0123456789][0123456789][0123456789][0123456789][0123456789][0123456789][0123456789][0123456789]' AND DATALENGTH(phone_e164) = 26 AND LEN(phone_e164) = 13)`) + Django regex (`\A\+201[0125][0-9]{8}\Z` with `re.ASCII`), preserving the `+2010`/`+2011`/`+2012`/`+2015` Egyptian mobile-prefix contract.
  - **`User.date_of_birth` (`DATE`):** Authoritative validation is **Django using `ZoneInfo("Africa/Cairo")`** (`< datetime.now(ZoneInfo("Africa/Cairo")).date()`). Optional SQL Server `CHECK` uses Cairo calendar-date semantics via `SYSDATETIMEOFFSET() AT TIME ZONE 'Egypt Standard Time'` (`CHECK (date_of_birth < CAST((SYSDATETIMEOFFSET() AT TIME ZONE 'Egypt Standard Time') AS DATE))`), documented as **non-deterministic** (Phase 12 DDL verification required; `D-05` UTC timestamp storage preserved everywhere else).
  - **Non-Empty Text (`10` fields):** Django `strip()` + `MinLengthValidator(1)` is primary for Unicode whitespace; SQL Server `CHECK (LTRIM(RTRIM(col)) <> N'')` trims **only ASCII space (`U+0020`)** by default and is not equivalent to Python `strip()`.
  - **URLs (`LessonItem.external_video_url`, `GroupResource.meeting_url`):** HTTPS URL and Google Drive sharing checks remain Django serializer/service validators only (not SQL `CHECK` constraints).
- **`ISJSON()` Constraints (`9` JSON Fields):** SQL Server 2022 typed `ISJSON(..., ARRAY)` for `RolePolicy.default_capabilities_json`, `UserPermissionOverride.granted_capabilities_json`, `UserPermissionOverride.denied_capabilities_json`, `DepartmentTrack.allowed_tracks_json`, and `QuizDefinition.questions_json`; typed `ISJSON(..., OBJECT)` for `PendingApprovalRequest.payload_snapshot_json`, `AuditLogEntry.details_snapshot_json` (nullable), and `StagedAdminEdit.edit_payload_json`; untyped `ISJSON(...)` for `ScheduledJobRun.details_json` (nullable, root format unresolved); plus Django JSON schema validation on all `9`.
- **Remaining Physical Types (`24` Fields):** `MediaAsset.size_bytes` = `BIGINT NOT NULL` (`CHECK (size_bytes >= 0)`), `11` `INT` fields, and `12` `BIT` fields. (`OR-DB-04` normalization scope is governed by `§4.3` above.)

