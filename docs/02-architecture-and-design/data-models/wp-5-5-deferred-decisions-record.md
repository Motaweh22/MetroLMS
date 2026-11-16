# MetroLMS — WP-5.5 Deferred Decisions Owner Decision Record (`WP55-PT-01`–`WP55-PT-06`)

> **Document Status:** `OWNER-AUTHORIZED — INTEGRATED`  
> **Decision Date:** `2026-11-15`  
> **Authority Basis:** Project Owner delegated technical selection of the six `WP-5.5` Physical Types deferred items (`D-01` through `D-06`) and explicitly authorized their integration into canonical project documentation (`2026-11-15`).  
> **Governance Boundaries:**  
> - `data-dictionary.md` remains **`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`**.  
> - `WP-5.6` remains **`BLOCKED — NOT AUTHORIZED`**.  
> - `CP-010`, `CP-011`, and `CP-012` remain immutable and unchanged.  
> - Zero Django models, migrations, SQL DDL, dependency changes, or database connections are authorized by this record.

---

## 1. Decision Identifier Mapping (No Collision with Domain Rules `D-01`–`D-14`)

To avoid colliding with existing domain/governance rules `D-01`–`D-14` in [`decision-register.md`](../../architecture/decision-register.md), the six `WP-5.5` physical-type decisions are assigned unique `WP-5.5`-qualified identifiers while preserving traceability to the deferred item labels (`D-01`–`D-06`):

| Canonical ID | Deferred Item Ref | Topic | Selected Decision | Classification |
| :--- | :---: | :--- | :--- | :---: |
| **`WP55-PT-01`** | `D-01` | `PendingApprovalRequest.id` | **`UNIQUEIDENTIFIER`** (`UUIDField`) | `OWNER-APPROVED` *(delegated)* |
| **`WP55-PT-02`** | `D-02` | Catalog PK / FK Alignment (`MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`) | **`BIGINT`** (`BigAutoField`) for all `3` catalog PKs & `4` FKs | `OWNER-APPROVED` *(delegated)* |
| **`WP55-PT-03`** | `D-03` | `QuizDefinition.passing_score` | **`DECIMAL(5,2)`**, percentage-based (`0.00–100.00`) | `OWNER-APPROVED` *(delegated)* |
| **`WP55-PT-04`** | `D-04` | `GroupQrCode.token_hash` | **`SHA-256`** with **`VARBINARY(32)`** (`BinaryField(max_length=32)`) | `OWNER-APPROVED` *(delegated)* |
| **`WP55-PT-05`** | `D-05` | Timestamp Storage & Timezone Policy | **`DATETIMEOFFSET(7)`** (`USE_TZ=True`, Windows OS & Django `TIME_ZONE='UTC'`, `+00:00` DB persistence, explicit `ZoneInfo("Africa/Cairo")` display/scheduling) | `OWNER-APPROVED` *(delegated)* |
| **`WP55-PT-06`** | `D-06` | Production Deployment Baseline | **Windows Server 2022** (`OWNER-CONFIRMED` OS); `x64` / SQL Server `2022` / Python `3.12` / Django `5.2` LTS / `mssql-django==2.0.0` / `pyodbc` + ODBC `18` (`TECHNICAL-RECOMMENDATION` baseline pending infra inventory) | `OWNER-CONFIRMED` OS / `TECHNICAL-RECOMMENDATION` baseline |

---

## 2. Detailed Decision Specifications

### `WP55-PT-01` (`D-01`) — `PendingApprovalRequest.id`
- **Selected Decision:** SQL Server **`UNIQUEIDENTIFIER`** / Django **`UUIDField`** (`primary_key=True`).
- **Scope & Rules:** UUID values serve as both internal database PK and API `approvalRequestId` (serialized as UUID strings in JSON). Prior `"apr-2026-0042"` examples in integration documentation were illustrative only and are superseded by UUID format. No separate `public_reference` or `request_code` column is added.
- **Rationale:** Fixed `16`-byte PK/index footprint, native SQL Server UUID validation, zero string collation overhead, and single-column consistency with `data-dictionary.md` `§2.8`.

### `WP55-PT-02` (`D-02`) — Catalog Primary Key & Foreign Key Alignment
- **Selected Decision:** Promote `MetroLine.id`, `MaritalStatusCatalog.id`, and `MilitaryServiceStatusCatalog.id` to **`BIGINT`** (`IDENTITY(1,1)` / Django **`BigAutoField`**), matching `User.metro_line_id`, `User.marital_status_id`, `User.military_service_status_id`, and `CourseAudienceMetroLine.metro_line_id` (`BIGINT`).
- **Scope & Rules:** Preserves all existing `BIGINT` PKs, cardinalities, nullability, and **`ON DELETE NO ACTION`** across all `84` integer FKs (`84/84` exact `BIGINT`-to-`BIGINT` match across `50` `BIGINT` PKs + `3` string PKs + `1` `UNIQUEIDENTIFIER` PK = `54` active entities).

### `WP55-PT-03` (`D-03`) — `QuizDefinition.passing_score`
- **Selected Decision:** SQL Server **`DECIMAL(5,2)`** / Django **`DecimalField(max_digits=5, decimal_places=2)`**, valid range **`0.00` through `100.00`**, representing a **percentage** (not raw points).
- **Business & Technical Rules:** Fractional passing thresholds are supported; a learner passes when their calculated percentage is **`>= passing_score`** without rounding the calculated percentage prior to comparison. `FLOAT` / approximate floating-point storage is prohibited.

### `WP55-PT-04` (`D-04`) — `GroupQrCode.token_hash`
- **Selected Decision:** **`SHA-256`** stored as SQL Server **`VARBINARY(32)`** / Django **`BinaryField(max_length=32)`**.
- **Security & Lifecycle Rules:** Raw QR tokens must be generated via CSPRNG with **`>= 256` bits** of entropy and are never persisted or logged. Preserves the `TR-C3-01` Option B single-mutable-record-per-`TrainingGroup` (`UNIQUE(training_group_id)`, `UNIQUE(token_hash)`) design: regeneration updates the existing row in place and invalidates the prior token. Does **not** introduce HMAC, key-management infrastructure, or a QR history table.

### `WP55-PT-05` (`D-05`) — Timestamp Storage & Timezone Policy
- **Selected Decision:** Standardize all `38` timestamp fields on SQL Server **`DATETIMEOFFSET(7)`** with Django **`USE_TZ = True`**, Windows Server system timezone **`UTC`**, Django global **`TIME_ZONE = 'UTC'`**, UTC database persistence (**`+00:00`** offset), and explicit **`ZoneInfo("Africa/Cairo")`** application-level local display, scheduling, and local-input interpretation (backed by `zoneinfo.ZoneInfo` and `tzdata` on Windows). Under `mssql-django==2.0.0`, timezone-aware Django `DateTimeField`s map to SQL Server `datetimeoffset` (`DATETIMEOFFSET(7)`) when `USE_TZ = True`.
- **Scope & Windows Server Rules:**
  - Preserve the `4` date-only fields (`User.appointment_date`, `User.date_of_birth`, `User.service_end_date`, `HistoricalServiceTrainingRecord.completion_date`) as SQL Server **`DATE`**.
  - Django's global `TIME_ZONE` must remain **`UTC`** to match the Windows Server system timezone (`UTC`) because Django 5.2 documents limitations with alternate timezones on Windows; do **not** set Django's global `TIME_ZONE` to `Africa/Cairo` while the Windows system timezone is `UTC`.
  - Application code must use `django.utils.timezone.now()` for aware current timestamps (never naive `datetime.now()`), explicit `ZoneInfo("Africa/Cairo")` conversions for business rules, local display, scheduling, and local user input, and `timezone.override(ZoneInfo("Africa/Cairo"))` where a scoped Django operation needs Cairo-local form/template behavior.
  - Do **not** rely on `timezone.localtime()` without an explicit timezone argument when Cairo time is required while the active Django timezone is `UTC`.
  - For `TR-C3-04` and `process_due_group_renewals`: comparisons use timezone-aware datetimes, UTC instants are converted to `ZoneInfo("Africa/Cairo")` only where a business rule requires Cairo calendar/clock semantics, DST transitions must not cause naive datetime comparisons or duplicated/missed intended occurrences, and existing idempotency and concurrency rules remain unchanged.

### `WP55-PT-06` (`D-06`) — Production Deployment Baseline
- **Owner-Confirmed Fact:** Application OS is **Windows Server 2022**.
- **Selected Technical Baseline (Pending Infrastructure Inventory & Deployment Verification):**
  - **OS / Architecture:** Windows Server 2022 (`OWNER-CONFIRMED`) / `x64` (`TECHNICAL-RECOMMENDATION` baseline pending infra inventory)
  - **Runtime & Framework:** Python `3.12`, Django `5.2` LTS, DRF
  - **Database:** Microsoft SQL Server `2022` (separate or co-hosted host not assumed)
  - **Backend & Driver:** `mssql-django==2.0.0`, **`pyodbc`** as active/default runtime driver with **Microsoft ODBC Driver 18**
  - **Mandatory Package Dependency Note:** `mssql-django==2.0.0` requires `mssql-python>=1.15.0` (verified GA `1.17.0` at review time) as an installation dependency even though **`pyodbc`** remains the selected active/default runtime connection driver.

---

## 3. Pre-Freeze Owner Decisions Addendum (`OD-PF-01`–`OD-PF-08`, including `OD-PF-03-B`, `2026-11-15`)

Following Owner approval on `2026-11-15`, all pre-freeze Owner decisions in [`decision-register.md`](../../architecture/decision-register.md) `§8` are **`OWNER-APPROVED — DOCUMENTATION INTEGRATED`** (preserving `TECHNICAL-RECOMMENDATION` status for physical SQL Server enforcement mechanisms and `PROVISIONAL` entity status for `CourseReviewSubmission`):

- **`OD-PF-01` (`User.email`):** Optional/nullable; filtered `UNIQUE` for non-`NULL` values only (empty/whitespace normalized to `NULL`); `D-01` deletion does not retain email in `DeletedUserTombstone` or create collision-masking placeholders (frees email for reuse). *Implementation note:* `mssql-django==2.0.0` conditional-uniqueness limitations require an explicit SQL Server filtered unique index migration (`WHERE email IS NOT NULL`).
- **`OD-PF-02` (`LessonProgress`):** `progress_percent` is **not persisted** in DB (calculated on demand for UI/API from retained playback/progress measurements: `last_position_seconds`, `furthest_watched_seconds`, `eligible_viewing_seconds`, and `watch_count` on `LessonProgress`, plus `duration_seconds` on `LessonItem` per `Rule B` `INV-DOM06-02`); `is_completed` remains independent persisted state; existing video (`>= 90%` / `ended`) and PDF (explicit completion; 5s timer alone insufficient) rules preserved.
- **`OD-PF-03` (`CourseCommentReport`):** Approved `status` values: `Pending`, `Resolved`, `Dismissed`; `reporter_user_id = NULL` on `D-01` deletion with report preserved (`NVARCHAR(32) NOT NULL DEFAULT 'Pending'` + `CHECK` remains `TECHNICAL-RECOMMENDATION`).
- **`OD-PF-03-B` (`CourseReviewSubmission.review_status`):** Approved `review_status` values: `Pending`, `Approved`, `ReturnedForRevision`; strictly separate from `Course.lifecycle_status` (`Published` courses stay `Published` during pending update review). `CourseReviewSubmission` entity remains `PROVISIONAL` in `logical-data-model.md`.
- **`OD-PF-04` (`GroupJoinRequest`):** Resubmission after `Rejected` creates a **new DB record** while retaining `Rejected` history; max one `Pending` request per `(training_group_id, user_id)`; blocked while user has active `GroupMembership`; approved `request_status` vocabulary: `Pending`, `Approved`, `Rejected`. *Implementation note:* Filtered unique index `WHERE request_status = 'Pending'` requires explicit SQL Server migration (`TECHNICAL-RECOMMENDATION`).
- **`OD-PF-05` (Catalogs):** `name_en` is optional (`NULL`, Arabic fallback in UI) for `OrganizationalDepartment`, `JobTitle`, `MetroLine`, `MaritalStatusCatalog`, and `MilitaryServiceStatusCatalog`; `MilitaryServiceStatusCatalog` initial values are **exactly** `معفي`, `أنهى الخدمة`, `مؤجل`; preserves `MaritalStatusCatalog` ordinary categories (`Single`, `Married`, `Divorced`, `Widowed`) and required free-text `User.educational_qualification` (no `EducationalQualificationCatalog`).
- **`OD-PF-06` (`HistoricalServiceTrainingRecord.completion_date`):** Optional and nullable (`DATE NULL`, preserving date-only semantics).
- **`OD-PF-07` (`Course.description`):** Optional/`NULL` in `Draft`; non-empty `description` required server-side at submission for admin review (including submitted updates to published courses).
- **`OD-PF-08` (`reason` length):** `500`-character max (`NVARCHAR(500)`) approved specifically for `PendingApprovalRequest.reason` and `AuditLogEntry.reason`, preserving pre-existing `Optional`/`NULL` nullability (`D-OWNER-REV-25` & `TECHNICAL-RECOMMENDATION`), `DeletedUserTombstone.reason = NVARCHAR(1000)`, and `CourseCommentReport.reason = NVARCHAR(500)`.

