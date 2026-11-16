# MetroLMS — Final Physical Types Correction Audit (`WP-5.5`)

> **Document Status:** `TECHNICAL-AUDIT — FINAL CORRECTION AUDIT (REPORT-ONLY)`  
> **Scope:** Focused final correction audit of [`physical-types-reconciliation-supplement.md`](physical-types-reconciliation-supplement.md) and cross-report consistency check across all `WP-5.5` physical-type preparation artifacts.  
> **Governance Notice:** **Zero existing project files were modified.** `physical-types-reconciliation-supplement.md`, `data-dictionary.md` (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`), `CP-010`–`CP-012`, `CURRENT.md`, and `active-roadmap.md` remain completely untouched. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

This final correction audit refines [`physical-types-reconciliation-supplement.md`](physical-types-reconciliation-supplement.md), corrects presentation/classification ambiguities, evaluates specific `mssql-django` candidate releases, and verifies cross-report consistency across all `WP-5.5` preparation documents:

1. **Supersedes / Clarifies Previous Supplement Presentation:**
   - **Clarifies `PendingApprovalRequest.id`:** [`data-dictionary.md`](data-dictionary.md) (`§2.8` `L156`) lists two **alternative** `PROPOSED` physical types (`UNIQUEIDENTIFIER / NVARCHAR(64)`), not one combined type. Neither is `OWNER-APPROVED`. Retained strictly as **`PROPOSED` / Unresolved** pending confirmation of `approvalRequestId` format (UUID vs. opaque prefixed string such as `apr-...`).
   - **Clarifies `54`-Entity PK Inventory:** Mutually exclusive categories: **`47` `BIGINT`** (`1` `OWNER-APPROVED` `User.id` + `46` `TECHNICAL-RECOMMENDATION`/`PROPOSED` operational PKs) + **`3` `INT`** (`TECHNICAL-RECOMMENDATION` catalog PKs) + **`3` String-Based `NVARCHAR`** (`TECHNICAL-RECOMMENDATION` PKs) + **`1` Unresolved PK** (`PendingApprovalRequest.id`) = **`54` active entities** (`InPersonAttendanceRecord` `DEFERRED` excluded).
   - **Evaluates Both Catalog FK Alternatives Neutrality:** Preserves `80/84` matching vs. `4/84` `BIGINT`-to-`INT` mismatches in current state, and evaluates **Alternative 1** (align `4` FKs to `INT`) vs. **Alternative 2** (promote `3` catalog PKs to `BIGINT`) without selecting or approving either on the Owner's behalf. Preserves `ON DELETE NO ACTION` on all `84` FKs.
2. **Specific `mssql-django` Candidate Evaluated (`TECHNICAL-RECOMMENDATION`):** Evaluates **`mssql-django 2.0.1`** (2.0.x line, released Sept 2026) with **Python `3.12+` + Django `5.2` LTS** (and contrasts **`mssql-django 1.8.0`** if Django `5.0`/`5.1` were chosen), documenting `pyodbc` (default runtime driver) and `mssql-python >= 1.15.0` (mandatory install dependency in `2.0.x`).
3. **Temporal Policy Assessment (`TECHNICAL-RECOMMENDATION`):** Verifies `USE_TZ=True` -> `DATETIMEOFFSET(7)` vs. `USE_TZ=False` -> `DATETIME2(7)`, numeric UTC offset (`+00:00`) vs. IANA `Africa/Cairo` display, SQL `DATE` for `4` calendar dates, and migration impact, without silently overriding [`data-dictionary.md`](data-dictionary.md).
4. **Unresolved Decisions Preserved:** `PendingApprovalRequest.id`, `QuizDefinition.passing_score`, and `GroupQrCode.token_hash` algorithm remain unresolved; `CertificateRecord.verification_token_hash` (`BINARY(32)` `OWNER-APPROVED`) remains preserved.

---

## 2. Sources Inspected & Authority Classification

| Document / Source | Path / Reference | Authority / Classification |
| :--- | :--- | :--- |
| Canonical Data Dictionary | [`data-dictionary.md`](data-dictionary.md) | `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN` (per-field `OWNER-APPROVED`, `PROPOSED`, `TECHNICAL-RECOMMENDATION`, `DEFERRED` tags) |
| Checkpoints `CP-010`, `CP-011`, `CP-012` | [`CP-010`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md), [`CP-011`](../../project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md), [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md) | Immutable accepted milestone checkpoints |
| Django + SQL Server Contract | [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) | Authoritative target backend contract (`D-DB-01`, `D-AUTH-01`) |
| Project State Dashboard | [`CURRENT.md`](../../project-state/CURRENT.md) | Authoritative state dashboard (`WP-5.6` `BLOCKED — NOT AUTHORIZED`) |
| String Length Recommendations | [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) | `TECHNICAL-RECOMMENDATION` (`WP-5.6` prep input) |
| Physical Storage Review | [`physical-storage-recommendations-review.md`](physical-storage-recommendations-review.md) | `TECHNICAL-RECOMMENDATION` (`WP-5.6` prep input) |
| Django Type Mapping Verification | [`django-sqlserver-physical-type-mapping-review.md`](django-sqlserver-physical-type-mapping-review.md) | `TECHNICAL-VERIFICATION` (`WP-5.6` prep input) |
| Numeric & Temporal Review | [`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) | `TECHNICAL-REVIEW` (`WP-5.6` prep input) |
| Reconciliation Supplement | [`physical-types-reconciliation-supplement.md`](physical-types-reconciliation-supplement.md) | `TECHNICAL-AUDIT` (clarified/superseded where noted herein) |
| Official `microsoft/mssql-django` Docs & Releases | `github.com/microsoft/mssql-django` & PyPI `mssql-django` (`2.0.0`/`2.0.1`, `1.8.0`) | External official vendor specification |

---

## 3. Corrected `54`-Entity Primary-Key Inventory

*(Supersedes the `PendingApprovalRequest` label in [`physical-types-reconciliation-supplement.md`](physical-types-reconciliation-supplement.md) §4 by classifying `PendingApprovalRequest` strictly as `Unresolved PK Type`, never counting it as both UUID and NVARCHAR. `InPersonAttendanceRecord` (`DEFERRED`) is excluded.)*

### 3.1 Mutually Exclusive PK Breakdown (`54` Active Entities)

| PK Category | Count | Breakdown by Cluster | Mutually Exclusive Entity List (Each Appears Exactly Once) | Governance Classification |
| :--- | :---: | :--- | :--- | :--- |
| **`BIGINT`** | **`47`** | **C1: `12` \| C2: `17` \| C3: `18`** | **C1 (`12`):** **`User`** (`OWNER-APPROVED` `BIGINT IDENTITY(1,1)` per `CP-010` `CP1 #1`); plus `11` `TECHNICAL-RECOMMENDATION`/`PROPOSED` PKs: `DeletedUserTombstone`, `DeletedUserAlias`, `UserPermissionOverride`, `DelegatedAuthority`, `OrganizationalDepartment`, `JobTitle`, `HistoricalServiceTrainingRecord`, `AuditLogEntry`, `UserOrganizationalDepartment`, `DepartmentJobTitle`, `UserJobTitle`.<br>**C2 (`17`):** `Course`, `CourseAssistantLecturer`, `CourseAudienceDepartment`, `CourseAudienceJobTitle`, `CourseAudienceMetroLine`, `CourseDraft`, `PublishedCourseVersion`, `Module`, `LessonItem`, `QuizDefinition`, `CourseReviewSubmission`, `StagedAdminEdit`, `WorkingNote`, `CourseComment`, `CourseCommentReport`, `MediaAsset`, `MediaContentReference`.<br>**C3 (`18`):** `TrainingGroup`, `GroupAssistantAssignment`, `GroupRenewalCycle`, `GroupCourseAssignment`, `GroupMembership`, `GroupQrCode`, `GroupJoinRequest`, `GroupResource`, `Enrollment`, `EnrollmentSourceGrant`, `CourseAttempt`, `LessonProgress`, `CertificateRecord`, `NotificationItem`, `WhatsAppContact`, `UserWhatsAppVisibility`, `ScheduledJob`, `ScheduledJobRun`. | `User.id`: **`OWNER-APPROVED`** (`1`); remaining **`46`**: `TECHNICAL-RECOMMENDATION` / `PROPOSED` |
| **`INT`** | **`3`** | **C1: `3` \| C2: `0` \| C3: `0`** | **C1 (`3`):** `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog` | `TECHNICAL-RECOMMENDATION` / `PROPOSED` |
| **String-Based (`NVARCHAR`)** | **`3`** | **C1: `3` \| C2: `0` \| C3: `0`** | **C1 (`3`):** `ServerSession` (`session_key` `NVARCHAR(40)`), `RolePolicy` (`role_key` `NVARCHAR(32)`), `DepartmentTrack` (`id` `NVARCHAR(64)`) | `TECHNICAL-RECOMMENDATION` |
| **Unresolved PK Type** | **`1`** | **C1: `1` \| C2: `0` \| C3: `0`** | **C1 (`1`):** `PendingApprovalRequest` (`id` listed as dual alternative `UNIQUEIDENTIFIER` / `NVARCHAR(64)` in `data-dictionary.md` §2.8 `L156`) | **`PROPOSED`** *(unresolved)* |
| **Total Active Entities** | **`54`** | **C1: `19` \| C2: `17` \| C3: `18`** | `12 + 3 + 3 + 1 = 19` (C1) + `17` (C2) + `18` (C3) = **`54`** | `InPersonAttendanceRecord` **`DEFERRED`** (excluded) |

---

## 4. `PendingApprovalRequest.id` — Classification & Resolution Boundary

1. **Authoritative Source (`data-dictionary.md` §2.8 `L156`):** Lists `` `UNIQUEIDENTIFIER` / `NVARCHAR(64)` `` with status **`PROPOSED`**. These are **two mutually exclusive physical alternatives**, not one combined SQL type.
2. **Divergence Across Prep Reports:**
   - [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) (`L81`) selected `NVARCHAR(64)` (`TECHNICAL-RECOMMENDATION`, citing `apr-...` / UUID strings).
   - [`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) (`L57`) selected `UNIQUEIDENTIFIER` (`PROPOSED`, `UUIDField(primary_key=True)`).
   - Neither selection is `OWNER-APPROVED` (`CP-010` `CP1 #4` approved Option A for the polymorphic target reference pattern only and left `PendingApprovalRequest` metadata columns `PROPOSED`).
3. **Missing API/Business Decision:** Confirm whether `approvalRequestId` (`domain-18`, `202 Accepted` envelope) is strictly a **UUID** (`UNIQUEIDENTIFIER` / `models.UUIDField`) or an **opaque prefixed string** such as `apr-...` (`NVARCHAR(64)` / `models.CharField`).
4. **Classification:** Preserved as **`PROPOSED` (Unresolved)**. `data-dictionary.md` is not modified.

---

## 5. Four Catalog Foreign-Key Alternatives Comparison

### 5.1 Current-State vs. Proposed-State Validation (`84` Integer FKs)
- **Current State (`data-dictionary.md` today):** **`80 / 84` (`95.2%`)** integer FKs match their target `BIGINT` PKs; **`4 / 84` (`4.8%`)** have `BIGINT`-to-`INT` mismatches:
  - `User.metro_line_id` (`BIGINT`) → `MetroLine.id` (`INT`)
  - `User.marital_status_id` (`BIGINT`) → `MaritalStatusCatalog.id` (`INT`)
  - `User.military_service_status_id` (`BIGINT`) → `MilitaryServiceStatusCatalog.id` (`INT`)
  - `CourseAudienceMetroLine.metro_line_id` (`BIGINT`) → `MetroLine.id` (`INT`)
- **Proposed State (under either Alternative 1 or Alternative 2 below):** **`84 / 84` (`100%`)** exact PK/FK type match, preserving **`ON DELETE NO ACTION`** on all `84` integer FKs.

### 5.2 Neutral Comparison of Both Technical Alternatives (`TECHNICAL-RECOMMENDATION` — Owner Decision Required)

| Evaluation Dimension | Alternative 1: Change the `4` Catalog FK Columns to `INT` | Alternative 2: Promote the `3` Catalog PKs to `BIGINT` |
| :--- | :--- | :--- |
| **Type Compatibility** | `4` FKs (`INT`) match `3` catalog PKs (`INT`). SQL Server FK constraints succeed. | `4` FKs (`BIGINT`) match `3` catalog PKs (`BIGINT`). SQL Server FK constraints succeed. |
| **Consistency with `OWNER-APPROVED` Decisions** | **No conflict** — `MetroLine.id`, `MaritalStatusCatalog.id`, `MilitaryServiceStatusCatalog.id` `INT` and the `4` FKs are `PROPOSED`/`TECH-REC`, not `OWNER-APPROVED`. | **No conflict** — `User.id` (`BIGINT`) is `OWNER-APPROVED`; catalog PKs are `PROPOSED`/`TECH-REC` and can be `BIGINT` without breaking any Owner decision. |
| **Impact on `54`-Entity PK Inventory** | Preserves **`47` `BIGINT` + `3` `INT` + `3` String + `1` Unresolved = `54`**. | Shifts inventory to **`50` `BIGINT` + `0` `INT` + `3` String + `1` Unresolved = `54`**. |
| **Django ORM Implications** | `models.AutoField` on the `3` catalog models; `models.ForeignKey` automatically generates `INT` FK columns on `User` and `CourseAudienceMetroLine`. | Uniform `DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'` across **all `50`** integer-PK models (zero per-model `AutoField` overrides). |
| **SQL Server Considerations** | Saves `4` bytes per FK column (`12` bytes/row on `User`, `4` bytes/row on `CourseAudienceMetroLine`). | `BIGINT` uniform standard (`+12` bytes/row on `User`, negligible for `<10k` users); avoids future mixed `INT`/`BIGINT` catalog confusion. |

*(Neither alternative is selected or approved on the Owner's behalf here; both remain `TECHNICAL-RECOMMENDATION` options for `WP-5.6` / Owner sign-off.)*

---

## 6. Django & `mssql-django` Version Verification (`TECHNICAL-RECOMMENDATION`)

No dependency manifest (`requirements.txt`, `pyproject.toml`, etc.) exists in the repository; [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) specifies `Python 3.12+` and `Django 5.x` with `mssql-django` / `pyodbc`.

### 6.1 Specific Candidate Evaluated: `mssql-django 2.0.1` (`2.0.x` Line, `TECHNICAL-RECOMMENDATION`)
Verified against official Microsoft `microsoft/mssql-django` release notes (`v2.0.0` released Sept 18, 2026) and PyPI `mssql-django 2.0.1` package metadata:
- **Python Compatibility:** CPython **`3.10–3.14`** (`python_requires >= 3.10`). Fully compatible with **Python `3.12+`**.
- **Django Compatibility:** Django **`>= 5.2, < 6.2`** (`5.2` LTS through `6.1`). **Drops Django `5.0` and `5.1`** (if Django `5.0` or `5.1` were chosen, the project would be forced onto **`mssql-django 1.8.0`** security-only maintenance).
- **SQL Server Compatibility:** Validated against **SQL Server `2017`, `2019`, `2022`, and `2025`**, plus Azure SQL Database / Managed Instance.
- **Drivers (`pyodbc` vs. `mssql-python`):**
  - **`pyodbc` (`>= 3.0`):** Remains the **default runtime driver** out-of-the-box (requires system Microsoft ODBC Driver 17 or 18).
  - **`mssql-python` (`>= 1.15.0`):** Installed as a **mandatory package dependency** of `mssql-django 2.0.x` (alongside `tzdata`), even when `pyodbc` is used at runtime; optional per-alias runtime opt-in via `OPTIONS: {'python_driver': 'mssql_python'}`. *(Platform constraint: target host must support `mssql-python` binary wheels — Windows x64/ARM64, macOS 15+, Linux glibc `2.28+` / musl `1.2+`.)*
- **Suitability:** **`mssql-django 2.0.1`** paired with **Python `3.12+` + Django `5.2` LTS** is **suitable** for MetroLMS (`TECHNICAL-RECOMMENDATION`, not `OWNER-APPROVED`; exact runtime `sqlmigrate` verification remains pending `WP-5.6` environment provisioning).

---

## 7. `DATETIME2(7)` vs. `DATETIMEOFFSET(7)` Technical Assessment

1. **Current Discrepancy:** [`data-dictionary.md`](data-dictionary.md) specifies `DATETIME2(7)` (UTC) across `38` timestamp fields, whereas [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) §4 specifies `DATETIMEOFFSET(7)` with `USE_TZ=True`.
2. **`mssql-django` `DateTimeField` Mapping (Official `microsoft/mssql-django` Behavior):**
   - **`USE_TZ = True`:** `models.DateTimeField` maps to **`DATETIMEOFFSET(7)`** (`Now()` compiles to `SYSDATETIMEOFFSET()`). `mssql-django 2.0.x` uses Python stdlib `zoneinfo` + `tzdata` (replacing `pytz`).
   - **`USE_TZ = False`:** `models.DateTimeField` maps to **`DATETIME2(7)`** (naive datetimes without offset).
3. **UTC Storage & Numeric Offset vs. IANA Identifier:**
   - SQL Server `DATETIMEOFFSET(7)` stores a **numeric UTC offset** (`+00:00` under Django's UTC storage convention), **not** an IANA timezone name like `Africa/Cairo`.
   - **`Africa/Cairo`** (`TIME_ZONE = 'Africa/Cairo'`) is preserved as the **application-level display timezone** via `zoneinfo`.
   - **`4` Date-Only Fields** (`User.appointment_date`, `User.date_of_birth`, `User.service_end_date`, `HistoricalServiceTrainingRecord.completion_date`) remain SQL **`DATE`** (`models.DateField`).
4. **Migration Implications (`DATETIME2` -> `DATETIMEOFFSET`):**
   - Toggling `USE_TZ = True` later does **not** automatically alter existing `DATETIME2` columns to `DATETIMEOFFSET`; changing column types post-creation requires explicit `ALTER TABLE ... ALTER COLUMN ... DATETIMEOFFSET(7)` DDL and backfill/offset-attachment (`TODATETIMEOFFSET(..., '+00:00')`).
5. **Recommended Temporal Policy (`TECHNICAL-RECOMMENDATION`):** Standardize `38` timestamps on **`DATETIMEOFFSET(7)`** with `USE_TZ=True` (`+00:00` UTC storage, `Africa/Cairo` display) and `4` dates on **`DATE`**, requiring formal alignment of `data-dictionary.md` before `WP-5.6` physical implementation.

---

## 8. Preserved Unresolved Decisions

| Item | Current Classification | Preserved Open Question / Condition |
| :--- | :---: | :--- |
| **`PendingApprovalRequest.id`** | `PROPOSED` (Unresolved) | UUID (`UNIQUEIDENTIFIER`) vs. opaque prefixed string `apr-...` (`NVARCHAR(64)`). |
| **`QuizDefinition.passing_score`** | `UNRESOLVED-BUSINESS-RULE` | Integer percentage (`0–100`), fractional percentage (`DECIMAL(5,2)`), or raw point score. |
| **`GroupQrCode.token_hash` Algorithm** | `NEEDS-BUSINESS-CLARIFICATION` | Algorithm unspecified in `domain-09`; `BINARY(32)` / `VARBINARY(32)` remains strictly conditional on confirming `SHA-256`. *(Existing `OWNER-APPROVED` `CertificateRecord.verification_token_hash BINARY(32)` per `TR-C3-03` is preserved untouched.)* |

---

## 9. Cross-Report Consistency Findings

Cross-checking all 10 listed documents surfaced two material items (no new database design issues outside scope):
1. **Resolved in This Audit — `PendingApprovalRequest.id` & `54`-Entity PK Count:** [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) (`NVARCHAR(64)`) vs. [`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) (`UNIQUEIDENTIFIER`) vs. [`physical-types-reconciliation-supplement.md`](physical-types-reconciliation-supplement.md) (`1` dual-listed PK) are now cleanly reconciled as **`1` Unresolved PK** (`47 + 3 + 3 + 1 = 54`).
2. **`BINARY(32)` vs. `VARBINARY(32)` (`mssql-django` Custom Field Requirement):** [`physical-storage-recommendations-review.md`](physical-storage-recommendations-review.md) recommended `BINARY(32)` for `MediaAsset.sha256_checksum` and conditionally `GroupQrCode.token_hash`, while [`django-sqlserver-physical-type-mapping-review.md`](django-sqlserver-physical-type-mapping-review.md) proved that native `models.BinaryField(max_length=32)` emits **`VARBINARY(32)`** unless a shared custom `FixedBinaryField(32)` (`db_type()` override) is implemented (already required for `OWNER-APPROVED` `CertificateRecord.verification_token_hash BINARY(32)`). Both reports agree `VARBINARY(32)` or `FixedBinaryField(32)` are index/`UNIQUE`-safe; `WP-5.6` must implement `FixedBinaryField(32)` for exact `BINARY(32)`.

---

## 10. Required Future Owner / Pre-`WP-5.6` Decisions

1. **Confirm `PendingApprovalRequest.id` format** (`UNIQUEIDENTIFIER` UUID vs. `NVARCHAR(64)` opaque string).
2. **Select Catalog FK Alignment Alternative** (Alternative 1: `4` FKs -> `INT` vs. Alternative 2: `3` catalog PKs -> `BIGINT`).
3. **Confirm `QuizDefinition.passing_score` business unit/scale** (`INT` vs. `DECIMAL(5,2)` vs. raw points).
4. **Confirm `GroupQrCode.token_hash` cryptographic hash algorithm** (`SHA-256` vs. alternative).
5. **Approve Temporal Reconciliation** (`DATETIMEOFFSET(7)` + `USE_TZ=True` in `data-dictionary.md` aligned with `django-sqlserver-integration-contract.md` §4) and **approve `Django 5.2 LTS + mssql-django 2.0.1` stack baseline** at `WP-5.6` authorization.

---

## 11. Final Audit Status

- **New Report Created:** [`physical-types-final-correction-audit.md`](physical-types-final-correction-audit.md) (this file only).
- **Existing Files Modified:** **None (`0` modified).**
- **Data Dictionary Status:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- **Implementation Status:** Zero models, migrations, DDL, or DB connections created.
- **WP-5.6 Status:** `BLOCKED — NOT AUTHORIZED`.

**`FINAL PHYSICAL TYPES CORRECTION AUDIT COMPLETED — WP-5.6 NOT AUTHORIZED.`**

