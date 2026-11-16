# MetroLMS — Physical Numeric, Boolean, Temporal & Binary Data Types Review (`WP-5.6` Preparation)

> **Document Status:** `SUPERSEDED IN PART BY WP55-PT-01..06 & OR-DB-01 (OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16)`  
> **Source Baseline:** [`data-dictionary.md`](data-dictionary.md) (`54` active entities / `305` active physical columns under `DepartmentTrack` Option A [`306` logical mappings prior to Option A collapse]; `InPersonAttendanceRecord` `DEFERRED` excluded; `UNFROZEN`)  
> **Authoritative Reconciliation Note (`2026-11-16`):** Earlier `INT` proposals for `MetroLine`, `MaritalStatusCatalog`, and `MilitaryServiceStatusCatalog` (`§3.2` below) were superseded by `WP55-PT-02` (`BIGINT` across all `50` surrogate PKs and `84` FKs). All `6` `OR-DB-01` physical design groups (`48` remaining `BIGINT IDENTITY(1,1)` PKs, `15` defaults, `23` nullable columns in `12` groups + `NOT NULL` columns, `52` individual `CHECK`s, `9` `ISJSON()`s, and `24` remaining physical types [`MediaAsset.size_bytes` `BIGINT`, `11` `INT`, `12` `BIT`]) are now **`OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`** in [`decision-register.md`](../../architecture/decision-register.md) `§9.1` and [`data-dictionary.md`](data-dictionary.md) `§11.5`.

---

## 1. Executive Summary

This review audits all **non-string physical data types** (`199` non-string fields across all `54` active entities, plus the `2` binary hash candidates `GroupQrCode.token_hash` and `MediaAsset.sha256_checksum` = **`201` field evaluations**) for Microsoft SQL Server (`D-DB-01`) and Django 5+ (`mssql-django`):

- **Integers (`INT` vs. `BIGINT` — `142` fields):** Preserves `User.id` as `OWNER-APPROVED` `BIGINT IDENTITY(1,1)` (`BigAutoField`). Recommends `BIGINT` (`BigAutoField`) for `47` operational PKs and `INT` (`AutoField`) for the `3` small lookup catalogs (`MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`) **only if** all `4` referencing FKs (`User.metro_line_id`, `User.marital_status_id`, `User.military_service_status_id`, `CourseAudienceMetroLine.metro_line_id` — currently written `BIGINT` in `data-dictionary.md`) strictly match `INT` (`models.ForeignKey` handles this automatically). Also notes `PendingApprovalRequest.id` is `UNIQUEIDENTIFIER` (`models.UUIDField(primary_key=True)`).
- **Decimal & Numeric Precision (`9` non-PK/FK value fields):** `LessonProgress.progress_percent` (`DECIMAL(5,2)` `PROPOSED`), `MediaAsset.size_bytes` (`BIGINT`), `ScheduledJobRun.retry_count` (`INT`, `0–2`), `TrainingGroup.interval_days` (`INT`, `1–730`), `PublishedCourseVersion.version_number` / `Module.sort_order` / `LessonItem.sort_order` / `GroupRenewalCycle.cycle_number` (`INT`). **`QuizDefinition.passing_score`** is flagged **`NEEDS-BUSINESS-CLARIFICATION`** because neither `domain-06` nor `domain-14` confirms whether it is an integer percentage (`0–100`), fractional percentage (`DECIMAL(5,2)`), or raw point score.
- **Booleans (`BIT` — `12` fields):** All `12` Boolean flags map cleanly to SQL Server `BIT NOT NULL` (`models.BooleanField` with explicit defaults), zero nullable three-valued `BIT` fields, and zero enums collapsed into `BIT`.
- **Temporal (`4` `DATE` + `38` Timestamp fields):** Discovers an active conflict between `data-dictionary.md` (`DATETIME2(7)` UTC) and `django-sqlserver-integration-contract.md` §4 (`DATETIMEOFFSET(7)` with `USE_TZ=True`). Because `microsoft/mssql-django` maps `DateTimeField` to **`DATETIMEOFFSET`** when `USE_TZ=True` (and `DATETIME2` only when `USE_TZ=False`), recommends standardizing all `38` timestamps on **`DATETIMEOFFSET(7)`** with `USE_TZ=True` + UTC storage (`+00:00`) and `Africa/Cairo` display (`TR-C3-04`), while keeping the `4` calendar dates as **`DATE`**.
- **Binary (`3` hash fields):** Preserves `CertificateRecord.verification_token_hash` as `OWNER-APPROVED` `BINARY(32)`. Recommends `BINARY(32)` (via shared `FixedBinaryField(32)`) or `VARBINARY(32)` (native `BinaryField(max_length=32)`) for `MediaAsset.sha256_checksum` and `GroupQrCode.token_hash` (the latter contingent on confirming `SHA-256` since `domain-09` does not lock a hash algorithm).

---

## 2. Scope & Evidence Baseline
- **Active Scope:** `54` active entities (`19` Cluster 1 + `17` Cluster 2 + `18` Cluster 3) from [`data-dictionary.md`](data-dictionary.md). `InPersonAttendanceRecord` (`Domain 16`, `DEFERRED`) is excluded.
- **Evidence Classification:**
  - *Documented MetroLMS Facts:* `data-dictionary.md`, `django-sqlserver-integration-contract.md`, `CP-009`–`CP-012`, `domain-01`–`domain-21`.
  - *Officially Documented `mssql-django` / SQL Server Behavior:* `microsoft/mssql-django` `base.py` `data_types` (`AutoField`->`int IDENTITY(1,1)`, `BigAutoField`->`bigint IDENTITY(1,1)`, `BooleanField`->`bit`, `DateField`->`date`, `DateTimeField`->`datetimeoffset` when `USE_TZ=True` / `datetime2` when `USE_TZ=False`, `DecimalField`->`numeric(p,s)`, `BinaryField(max_length=N)`->`varbinary(N)`).
  - *Limitation:* Exact minor `mssql-django` version is not pinned yet, and Django/`mssql-django`/SQL Server are not installed locally (`ModuleNotFoundError: No module named 'django'`). All ORM DDL generation must be verified in `WP-5.6` with `makemigrations` / `sqlmigrate`.

---

## 3. Integer Type Review (`INT` vs. `BIGINT`)

### 3.1 Capacity, Django Mapping & Mixed-Key Analysis
- **SQL Server Capacity:** `INT` (`4` bytes, signed max `2,147,483,647`); `BIGINT` (`8` bytes, signed max `9,223,372,036,854,775,807`).
- **Django Mapping:** `models.AutoField` -> `INT IDENTITY(1,1)`; `models.BigAutoField` (`DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'` in Django 5+) -> `BIGINT IDENTITY(1,1)`.
- **Mixed-Key Evaluation:** Using `INT` on the 3 tiny admin catalogs (`MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`, typically `< 50` rows) saves 4 bytes per row on `User` FKs and `CourseAudienceMetroLine` with zero ORM friction because Django `ForeignKey` automatically inherits the target PK's physical type (`INT`). All operational/transactional/high-growth entities (`User`, `AuditLogEntry`, `LessonProgress`, `NotificationItem`, `ScheduledJobRun`, etc.) use `BIGINT` consistently.
- **PK/FK Type Consistency Rule:** Every FK **must** match its referenced PK type (`BIGINT` -> `BIGINT`; `INT` -> `INT`).

### 3.2 Complete `54`-Entity Primary Key & Strategy Matrix

| Cluster | Entity | PK Column(s) | Recommended Physical PK | Django PK Field | Dependent FK Type Rule | Classification |
| :-: | :--- | :--- | :---: | :---: | :--- | :---: |
| C1 | `User` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `OWNER-APPROVED` (`CP1 #1`) |
| C1 | `ServerSession` | `session_key` | `NVARCHAR(40)` | `CharField(max_length=40, primary_key=True)` | No child FKs (`user_id` FK = `BIGINT`) | `TECHNICAL-RECOMMENDATION` |
| C1 | `DeletedUserTombstone` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All Tombstone FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `DeletedUserAlias` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `tombstone_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `RolePolicy` | `role_key` | `NVARCHAR(32)` | `CharField(max_length=32, primary_key=True)` | `User.role` = `NVARCHAR(32)` | `TECHNICAL-RECOMMENDATION` |
| C1 | `UserPermissionOverride` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `DelegatedAuthority` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `User`/`Tombstone` FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `OrganizationalDepartment` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `UserOrganizationalDepartment`, `DepartmentJobTitle`, `CourseAudienceDepartment` FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `JobTitle` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `DepartmentJobTitle`, `UserJobTitle`, `CourseAudienceJobTitle` FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `MetroLine` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `User.metro_line_id`, `CourseAudienceMetroLine.metro_line_id` = `BIGINT` (`WP55-PT-02`) | `OWNER-APPROVED` (`WP55-PT-02`) |
| C1 | `MaritalStatusCatalog` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `User.marital_status_id` = `BIGINT` (`WP55-PT-02`) | `OWNER-APPROVED` (`D-02`, `OR-DB-01` `2026-11-16`) |
| C1 | `MilitaryServiceStatusCatalog` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `User.military_service_status_id` = `BIGINT` (`WP55-PT-02`) | `OWNER-APPROVED` (`D-02`, `OR-DB-01` `2026-11-16`) |
| C1 | `HistoricalServiceTrainingRecord` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `user_id`/`tombstone_id` = `BIGINT` | `OWNER-APPROVED` (`OR-DB-01` `2026-11-16`) |
| C1 | `DepartmentTrack` | `department_code` | `NVARCHAR(64)` | `CharField(max_length=64, primary_key=True)` | No child FKs (`DepartmentTrack` Option A) | `OWNER-SELECTED` (Option A) / `OWNER-APPROVED` (`OR-DB-02`) |
| C1 | `PendingApprovalRequest` | `id` | `UNIQUEIDENTIFIER` | `UUIDField(primary_key=True)` | Polymorphic target ID = `NVARCHAR(64)` | `OWNER-APPROVED` (`WP55-PT-01`) |
| C1 | `AuditLogEntry` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | High-volume append-only log | `TECHNICAL-RECOMMENDATION` |
| C1 | `UserOrganizationalDepartment` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `user_id`, `department_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `DepartmentJobTitle` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `department_id`, `job_title_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C1 | `UserJobTitle` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `user_id`, `department_id`, `job_title_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `Course` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseAssistantLecturer` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `course_id`, `user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseAudienceDepartment` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `course_id`, `department_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseAudienceJobTitle` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `course_id`, `job_title_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseAudienceMetroLine` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `course_id` = `BIGINT`; `metro_line_id` = `INT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseDraft` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `PublishedCourseVersion` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `Module` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `LessonItem` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `QuizDefinition` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `lesson_item_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseReviewSubmission` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `StagedAdminEdit` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `submission_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `WorkingNote` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `submission_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseComment` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `CourseCommentReport` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `comment_id`, `reporter_user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `MediaAsset` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `MediaContentReference.media_asset_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C2 | `MediaContentReference` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `TrainingGroup` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `GroupAssistantAssignment` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `training_group_id`, `user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `GroupRenewalCycle` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `GroupCourseAssignment` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `group_renewal_cycle_id`, `course_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `GroupMembership` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `training_group_id`, `user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `GroupQrCode` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `training_group_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `GroupJoinRequest` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `training_group_id`, `user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `GroupResource` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `training_group_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `Enrollment` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `EnrollmentSourceGrant` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `enrollment_id`, `training_group_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `CourseAttempt` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | All referencing FKs = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `LessonProgress` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `course_attempt_id`, `lesson_item_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `CertificateRecord` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `course_attempt_id`, `published_version_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `NotificationItem` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `WhatsAppContact` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `course_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `UserWhatsAppVisibility` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `user_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `ScheduledJob` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `ScheduledJobRun.job_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |
| C3 | `ScheduledJobRun` | `id` | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `job_id` = `BIGINT` | `TECHNICAL-RECOMMENDATION` |

---

## 4. Decimal & Numeric Precision Review
- **`QuizDefinition.passing_score`:** `data-dictionary.md` (`§5.5` `L358`) currently proposes `INT NOT NULL CHECK (passing_score BETWEEN 0 AND 100)` (`PROPOSED`). However, neither `domain-06` nor `domain-14` explicitly establishes whether `passing_score` is an integer percentage (`0–100`), a fractional percentage (`DECIMAL(5,2)`), or an absolute point count. **Classification: `NEEDS-BUSINESS-CLARIFICATION`** (do not use `FLOAT`).
- **`LessonProgress.progress_percent`:** `DECIMAL(5,2) NOT NULL` (`PROPOSED` in `§8.4` `L496`; `models.DecimalField(max_digits=5, decimal_places=2)` -> SQL Server `NUMERIC(5,2)`/`DECIMAL(5,2)` — exact `0.00` to `100.00` without `FLOAT` rounding errors).
- **Integer Counters, Sizes & Sequence Numbers (`8` fields):**
  - `ScheduledJobRun.retry_count`: `INT NOT NULL CHECK (retry_count BETWEEN 0 AND 2)` (`OWNER-APPROVED` max 3 attempts via `TR-C3-04`; `INT` `PROPOSED`).
  - `TrainingGroup.interval_days`: `INT NOT NULL CHECK (interval_days BETWEEN 1 AND 730)` (`OWNER-APPROVED` `1–730` range; `INT` `TECHNICAL-RECOMMENDATION`).
  - `PublishedCourseVersion.version_number`: `INT NOT NULL CHECK (version_number >= 1)` (`PROPOSED`).
  - `Module.sort_order` & `LessonItem.sort_order`: `INT NOT NULL CHECK (sort_order >= 0)` (`PROPOSED`).
  - `GroupRenewalCycle.cycle_number`: `INT NOT NULL` (`TECHNICAL-RECOMMENDATION`).
  - `MediaAsset.size_bytes`: `BIGINT NOT NULL CHECK (size_bytes >= 0)` (`TECHNICAL-RECOMMENDATION` — supports >2 GB media files safely).

---

## 5. Boolean / `BIT` Review (`12` Fields — All `NOT NULL`)

| Entity | Field | Logical Meaning | Nullability & Default | Django Field | Classification |
| :--- | :--- | :--- | :---: | :--- | :---: |
| `DelegatedAuthority` | `is_active` | Active delegation flag (`0` on `D-01`/revoke) | `NOT NULL DEFAULT 1` | `BooleanField(default=True)` | `OWNER-APPROVED` *(behavior; `BIT` `TECH-REC`)* |
| `AuditLogEntry` | `is_developer_masked` | `INV-R8`/`D-14` neutral projection flag | `NOT NULL DEFAULT 0` | `BooleanField(default=False)` | `PROPOSED` |
| `CourseComment` | `is_author_deleted` | `D-02` `'مستخدم محذوف'` marker | `NOT NULL DEFAULT 0` | `BooleanField(default=False)` | `OWNER-APPROVED` *(rule; `BIT` `TECH-REC`)* |
| `MediaContentReference` | `is_visible` | `INV-DOM21-13..15` reference visibility | `NOT NULL DEFAULT 1` | `BooleanField(default=True)` | `OWNER-APPROVED` *(rule; `BIT` `PROPOSED`)* |
| `TrainingGroup` | `is_archived` | `D-GRP-07` group archive state | `NOT NULL DEFAULT 0` | `BooleanField(default=False)` | `OWNER-APPROVED` *(rule; `BIT` `TECH-REC`)* |
| `TrainingGroup` | `auto_renewal_enabled` | Automatic renewal toggle | `NOT NULL DEFAULT 0` | `BooleanField(default=False)` | `TECHNICAL-RECOMMENDATION` |
| `GroupQrCode` | `is_enabled` | Active QR join toggle | `NOT NULL DEFAULT 1` | `BooleanField(default=True)` | `PROPOSED` |
| `CourseAttempt` | `is_sealed` | Sealed on cycle renewal (`INV-DOM10-03`) | `NOT NULL DEFAULT 0` | `BooleanField(default=False)` | `OWNER-APPROVED` *(sealing; `BIT` `TECH-REC`)* |
| `LessonProgress` | `is_completed` | Lesson completion flag | `NOT NULL DEFAULT 0` | `BooleanField(default=False)` | `PROPOSED` |
| `NotificationItem` | `is_read` | Inbox read state (`D-08`) | `NOT NULL DEFAULT 0` | `BooleanField(default=False)` | `PROPOSED` |
| `UserWhatsAppVisibility` | `is_visible` | Scenario visibility flag (`D-09`) | `NOT NULL DEFAULT 1` | `BooleanField(default=True)` | `PROPOSED` |
| `ScheduledJob` | `is_enabled` | Scheduler job enabled flag (`TR-C3-04`) | `NOT NULL DEFAULT 1` | `BooleanField(default=True)` | `PROPOSED` |

*(Count: exactly `12` `BIT` fields; all `NOT NULL` avoiding three-valued SQL logic; zero status enums converted to `BIT`.)*

---

## 6. Temporal Type & Timezone Review (`DATETIME2` vs. `DATETIMEOFFSET`)

### 6.1 Documented Mismatch & `mssql-django` Evidence
- **Conflict:** `data-dictionary.md` specifies `DATETIME2(7)` (UTC) across `38` timestamp fields, whereas [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) §4 specifies **`DATETIMEOFFSET(7)`** with `models.DateTimeField` and `USE_TZ=True`.
- **`mssql-django` Behavior (`microsoft/mssql-django`):**
  - With **`USE_TZ = True`** (Django's standard timezone-aware mode required for UTC storage + `Africa/Cairo` display per `TR-C3-04`): `mssql-django` generates **`DATETIMEOFFSET`** (`DATETIMEOFFSET(7)`) for `models.DateTimeField`, binds Python aware `datetime` objects with their offset on write (`adapt_datetimefield_value`), and returns aware Python `datetime` objects on read (`convert_datetimefield_value`).
  - With **`USE_TZ = False`**: `mssql-django` generates **`DATETIME2`**. Switching `USE_TZ` later does **not** auto-migrate existing `DATETIME2` columns to `DATETIMEOFFSET`.
- **Recommended Consistent Policy:**
  1. **Date-only business fields (`4` fields):** `User.appointment_date`, `User.date_of_birth`, `User.service_end_date`, `HistoricalServiceTrainingRecord.completion_date` → **`DATE`** (`models.DateField()`).
  2. **All `38` timestamp fields** (across `User`, `ServerSession`, `DeletedUserTombstone`, `RolePolicy`, `DelegatedAuthority`, `DepartmentTrack`, `PendingApprovalRequest`, `AuditLogEntry`, `Course`, `CourseDraft`, `PublishedCourseVersion`, `CourseReviewSubmission`, `StagedAdminEdit`, `WorkingNote`, `CourseComment`, `CourseCommentReport`, `MediaAsset`, `MediaContentReference`, `TrainingGroup`, `GroupRenewalCycle`, `GroupMembership`, `GroupQrCode`, `GroupJoinRequest`, `Enrollment`, `LessonProgress`, `CertificateRecord`, `NotificationItem`, `ScheduledJobRun`): → **`DATETIMEOFFSET(7)`** with Django **`USE_TZ = True`**, **`TIME_ZONE = 'Africa/Cairo'`**, storing UTC (`+00:00`) and projecting `Africa/Cairo` in API/UI. Never mix `DATETIME2` and `DATETIMEOFFSET` for timestamps.

---

## 7. Binary Type Review (`3` Hash Fields)
- **`CertificateRecord.verification_token_hash`:** **`BINARY(32)`** (`OWNER-APPROVED` `TR-C3-03`, `UNIQUE`, `SHA-256` raw 32-byte digest). Requires custom `FixedBinaryField(max_length=32)` overriding `db_type()` in `mssql-django` (since standard `BinaryField(max_length=32)` emits `VARBINARY(32)`).
- **`MediaAsset.sha256_checksum`:** **`BINARY(32)`** (via shared `FixedBinaryField(32)`) or **`VARBINARY(32)`** (via native `BinaryField(max_length=32)`); both are `32` bytes and indexable in SQL Server.
- **`GroupQrCode.token_hash`:** Currently `NVARCHAR(128)` (`PROPOSED`). `domain-09` does **not** specify the QR hashing algorithm (`SHA-256` vs. `SHA-512`). Recommending **`BINARY(32)`** (or `VARBINARY(32)`) **if `SHA-256` is confirmed** in `WP-5.6` security spec (`NEEDS-BUSINESS-CLARIFICATION` / security confirmation on algorithm).

---

## 8. Consolidated Physical Type Recommendation Matrix (`201` Evaluated Fields)
- **Total Reviewed:** **`201` field evaluations** across all `54` active entities (`199` non-string fields in `data-dictionary.md` + `2` `NVARCHAR` binary hash candidates):
  - **`142` Integer fields:** `50` integer PKs (`47` `BIGINT` + `3` `INT`), `84` integer FKs (`80` `BIGINT` + `4` catalog FKs `User.metro_line_id`, `User.marital_status_id`, `User.military_service_status_id`, `CourseAudienceMetroLine.metro_line_id` aligning to `INT` if catalog PKs remain `INT`), and `8` integer counters/sizes/orders (`1` `BIGINT` + `7` `INT`). *(The remaining `4` PKs are `3` string PKs covered in `physical-string-length-recommendations.md` and `1` `UNIQUEIDENTIFIER` PK `PendingApprovalRequest.id`.)*
  - **`1` `UNIQUEIDENTIFIER` field:** `PendingApprovalRequest.id` (`UUIDField(primary_key=True)`).
  - **`1` `DECIMAL(5,2)` field:** `LessonProgress.progress_percent` (plus `QuizDefinition.passing_score` `NEEDS-BUSINESS-CLARIFICATION`, counted inside the `7` `INT` value fields above).
  - **`12` Boolean (`BIT`) fields:** All `NOT NULL` (`BooleanField`).
  - **`4` `DATE` fields:** All `DateField()`.
  - **`38` Timestamp fields:** `DATETIME2(7)` in `data-dictionary.md` -> recommended **`DATETIMEOFFSET(7)`** with `USE_TZ=True` (`DateTimeField`).
  - **`3` Binary hash fields:** `CertificateRecord.verification_token_hash` (`BINARY(32)` `OWNER-APPROVED`), plus `MediaAsset.sha256_checksum` and `GroupQrCode.token_hash` (`BINARY(32)` / `VARBINARY(32)`, latter contingent on `SHA-256` confirmation).

| Entity | Field | Logical Meaning | Current Type / Proposal | Reviewed SQL Type | Django Field Mapping | Classification | Evidence / Rationale |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `User` | `id` | Surrogate PK (`47` operational PKs follow `BIGINT`) | `BIGINT` (`OWNER-APPROVED`) | `BIGINT IDENTITY(1,1)` | `BigAutoField` | `OWNER-APPROVED` (`CP1 #1`) | Immutable `OWNER-APPROVED` `BIGINT` identity PK |
| `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog` (`3` entities) | `id` | Small lookup catalog PKs | `INT` (`PROPOSED`) | `INT IDENTITY(1,1)` | `AutoField` | `TECHNICAL-RECOMMENDATION` | `<50` rows; `4` referencing FKs (`User.*_id`, `CourseAudienceMetroLine.metro_line_id`) must match `INT` |
| `PendingApprovalRequest` | `id` | Approval request PK | `UNIQUEIDENTIFIER` (`PROPOSED`) | `UNIQUEIDENTIFIER` | `UUIDField(primary_key=True)` | `PROPOSED` | Native SQL Server `UNIQUEIDENTIFIER` mapped cleanly by `UUIDField` |
| Operational FKs (`80` + `4` catalog FKs) | `*_id` | Referential integrity keys | `BIGINT` | `BIGINT` (or `INT` for `4` catalog FKs) | `ForeignKey` (`ON DELETE NO ACTION`) | `TECHNICAL-RECOMMENDATION` | Must match referenced PK type (`BIGINT` -> `BIGINT`; `INT` -> `INT`) |
| `MediaAsset` | `size_bytes` | Uploaded media byte size | `BIGINT` (`>= 0`) | `BIGINT` | `BigIntegerField` | `TECHNICAL-RECOMMENDATION` | Prevents `2 GB` `INT` overflow for video assets |
| `PublishedCourseVersion`, `Module`, `LessonItem`, `GroupRenewalCycle`, `TrainingGroup`, `ScheduledJobRun` (`7` fields) | `version_number`, `sort_order` (x2), `cycle_number`, `interval_days`, `retry_count` | Sequence, sort order, cycle, interval (`1–730`), retry (`0–2`) | `INT` | `INT` | `IntegerField` | `PROPOSED` / `TECH-REC` | Bounded integer values; `INT` `CHECK` constraints preserved |
| `QuizDefinition` | `passing_score` | Quiz pass threshold | `INT` (`0..100`) `PROPOSED` | `INT` or `DECIMAL(5,2)` | `IntegerField` or `DecimalField` | `NEEDS-BUSINESS-CLARIFICATION` | `domain-06`/`14` do not confirm integer % vs. fractional % vs. raw points |
| `LessonProgress` | `progress_percent` | Authoritative course/lesson progress | `DECIMAL(5,2)` `PROPOSED` | `DECIMAL(5,2)` / `NUMERIC(5,2)` | `DecimalField(max_digits=5, decimal_places=2)` | `PROPOSED` | Exact `0.00–100.00`; avoids `FLOAT` binary rounding drift |
| `12` Boolean entities (Section 5) | `is_*` / `auto_renewal_enabled` | Binary state flags | `BIT NOT NULL` | `BIT NOT NULL` | `BooleanField(default=...)` | `OWNER-APPROVED` / `PROPOSED` / `TECH-REC` | Zero nullable `BIT`s; zero enums collapsed into `BIT` |
| `User` (`3`), `HistoricalServiceTrainingRecord` (`1`) | `appointment_date`, `date_of_birth`, `service_end_date`, `completion_date` | Calendar dates without time/TZ | `DATE` | `DATE` | `DateField` | `PROPOSED` / `TECH-REC` | Pure calendar dates; no timezone shift risk |
| `28` Entities (`38` timestamp fields) | `*_at` / `expire_date` | Event, audit & expiry timestamps | `DATETIME2(7)` (UTC) | `DATETIMEOFFSET(7)` | `DateTimeField` (`USE_TZ=True`) | `TECHNICAL-RECOMMENDATION` | Resolves `data-dictionary.md` vs. `django-sqlserver-integration-contract.md` §4 (`mssql-django` emits `DATETIMEOFFSET` under `USE_TZ=True`) |
| `CertificateRecord` | `verification_token_hash` | SHA-256 certificate token digest | `BINARY(32)` (`OWNER-APPROVED`) | `BINARY(32)` | `FixedBinaryField(32)` *(custom)* | `OWNER-APPROVED` (`TR-C3-03`) | Fixed `32`-byte binary hash; requires custom `db_type()` in `mssql-django` |
| `MediaAsset`, `GroupQrCode` | `sha256_checksum`, `token_hash` | Media SHA-256 / QR token digest | `NVARCHAR(64)` / `NVARCHAR(128)` | `BINARY(32)` (or `VARBINARY(32)`) | `FixedBinaryField(32)` / `BinaryField(32)` | `TECH-REC` / `NEEDS-BUSINESS-CLARIFICATION` (`GroupQrCode` alg) | Saves `50%+` storage; `GroupQrCode.token_hash` depends on confirming `SHA-256` |

---

## 9. Compatibility Risks & Required Follow-Up
1. **Unpinned `mssql-django` Minor Version:** Pin exact `Django 5.x` + `mssql-django` + `pyodbc` versions at `WP-5.6` kickoff and verify `sqlmigrate` output.
2. **`DATETIME2(7)` vs. `DATETIMEOFFSET(7)` Alignment:** Reconcile `data-dictionary.md` `DATETIME2(7)` notation with `django-sqlserver-integration-contract.md` §4 (`DATETIMEOFFSET(7)` + `USE_TZ=True`) before generating `0001_initial.py`.
3. **Custom `FixedBinaryField(32)`:** Implement one shared `BinaryField` subclass overriding `db_type()` for `BINARY(32)` (`CertificateRecord.verification_token_hash` and, if adopted, `MediaAsset.sha256_checksum` / `GroupQrCode.token_hash`).

---

## 10. Unresolved Business Rules (`2` Items)
1. **`QuizDefinition.passing_score` (`NEEDS-BUSINESS-CLARIFICATION`):** Confirm whether `passing_score` is an integer percentage (`0–100`), fractional percentage (`DECIMAL(5,2)`), or raw point score.
2. **`GroupQrCode.token_hash` Algorithm (`NEEDS-BUSINESS-CLARIFICATION` / Security Confirmation):** Confirm `SHA-256` (aligning with `CertificateRecord.verification_token_hash`) vs. `SHA-512` (`domain-09` currently leaves the hash algorithm unspecified).

---

## 11. Final Verification & Governance Status
- **Files Created:** `docs/02-architecture-and-design/data-models/physical-numeric-temporal-types-review.md` (this report only).
- **Existing Files Modified:** **None (`0` modified).**
- **Data Dictionary:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- **WP-5.6:** `BLOCKED — NOT AUTHORIZED`.
