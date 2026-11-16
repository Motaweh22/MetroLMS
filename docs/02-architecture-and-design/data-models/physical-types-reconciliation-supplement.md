# MetroLMS — Supplementary Physical Types Reconciliation Audit (`WP-5.5`)

> **Document Status:** `TECHNICAL-AUDIT — SUPPLEMENTARY RECONCILIATION REPORT (REPORT-ONLY)`  
> **Scope:** Supplementary verification and reconciliation of [`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) against [`data-dictionary.md`](data-dictionary.md) (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`), [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md), [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md), and [`CP-010`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md)–[`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md).  
> **Governance Notice:** **Zero existing files were modified.** `data-dictionary.md` remains `UNFROZEN`. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`. No models, migrations, DDL, or database connections were created.

---

## 1. Executive Summary

This supplementary audit resolves four inventory/classification inconsistencies and documents the `mssql-django` dependency and temporal findings without altering any existing project artifact:

1. **`PendingApprovalRequest.id` Conflict Retained as Unresolved:** [`data-dictionary.md`](data-dictionary.md) (`§2.8` `L156`) defines `PendingApprovalRequest.id` as `` `UNIQUEIDENTIFIER` / `NVARCHAR(64)` `` with status `PROPOSED`. Neither [`CP-010`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md) nor any other Owner decision locks it to UUID vs. opaque string (`apr-...`). Consequently, [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) (`NVARCHAR(64)`) and [`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) (`UNIQUEIDENTIFIER`) each selected one side of a dual `PROPOSED` entry. **Resolution:** Retain as **unresolved** (`PROPOSED` / `TECHNICAL-RECOMMENDATION` conflict) pending Owner/API-contract confirmation of `approvalRequestId` format.
2. **Exact `54`-Entity PK Inventory Reconciled:** The `47` operational `BIGINT` PKs **already include** `User.id` (`OWNER-APPROVED` `BIGINT IDENTITY(1,1)`). Mutually exclusive breakdown across all `54` active entities: **`47` `BIGINT` + `3` `INT` + `1` `UNIQUEIDENTIFIER` (`/` `NVARCHAR(64)` dual-proposed) + `3` `NVARCHAR` = `54`**. Deferred `InPersonAttendanceRecord` is excluded.
3. **Four Catalog FKs & `84` Integer FK Validation:** In [`data-dictionary.md`](data-dictionary.md) today, `80` of `84` integer FKs match their target `BIGINT` PKs (`95.2%` current-state consistency), while **`4` catalog FKs** (`User.metro_line_id`, `User.marital_status_id`, `User.military_service_status_id`, `CourseAudienceMetroLine.metro_line_id`) are currently typed `BIGINT` against `INT` catalog PKs. Aligning those `4` FKs to `INT` (or promoting the `3` catalog PKs to `BIGINT`) is **mandatory** for SQL Server FK constraint creation and achieves `84/84` (`100%`) proposed-state consistency while preserving `ON DELETE NO ACTION` on all `84` FKs.
4. **Django / `mssql-django` Version & Temporal Policy:** No `requirements.txt` or `pyproject.toml` exists in the repo. Recommended `TECHNICAL-RECOMMENDATION`: **Django 5.2 LTS + `mssql-django >= 2.0, < 3.0`** on Python 3.12+ (or `mssql-django == 1.8.0` only if Django 5.0/5.1 is chosen). Confirmed `USE_TZ=True` maps `DateTimeField` to `DATETIMEOFFSET(7)` storing numeric UTC offsets (`+00:00`), not IANA zone names (`Africa/Cairo`).
5. **Unresolved Decisions Preserved:** `QuizDefinition.passing_score` (`UNRESOLVED-BUSINESS-RULE` / `NEEDS-BUSINESS-CLARIFICATION`) and `GroupQrCode.token_hash` algorithm (`NEEDS-BUSINESS-CLARIFICATION`, `BINARY(32)`/`VARBINARY(32)` strictly conditional on `SHA-256`) remain explicitly unresolved.

---

## 2. Sources Inspected & Authority Classification

| Source | Path | Authority / Status |
| :--- | :--- | :--- |
| Canonical Data Dictionary | [`docs/02-architecture-and-design/data-models/data-dictionary.md`](data-dictionary.md) | `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN` (per-field classifications preserved: `OWNER-APPROVED`, `PROPOSED`, `TECHNICAL-RECOMMENDATION`, `DEFERRED`) |
| Checkpoint 1 Closure | [`docs/project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md) | Immutable accepted checkpoint (`CP1 #1` `User.id` `BIGINT`, `CP1 #4` `PendingApprovalRequest` Option A) |
| Checkpoint 2 & 3 Closures | [`CP-011`](../../project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md), [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md) | Immutable accepted checkpoints (`TR-C3-03` `CertificateRecord.verification_token_hash` `BINARY(32)`, `TR-C3-04` `Africa/Cairo` / retry cap `2`) |
| Physical String Review | [`docs/02-architecture-and-design/data-models/physical-string-length-recommendations.md`](physical-string-length-recommendations.md) | `TECHNICAL-RECOMMENDATION` (`WP-5.6` prep input) |
| Physical Numeric/Temporal Review | [`docs/02-architecture-and-design/data-models/physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) | `TECHNICAL-RECOMMENDATION` (`WP-5.6` prep input) |
| Django + SQL Server Contract | [`docs/backend/django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) | Authoritative target stack contract (`D-DB-01`, `D-AUTH-01`) |
| Project State Dashboard | [`docs/project-state/CURRENT.md`](../../project-state/CURRENT.md) | Authoritative current-state dashboard (`WP-5.6` `BLOCKED — NOT AUTHORIZED`) |

---

## 3. `PendingApprovalRequest.id` — Type Conflict Reconciliation

1. **Authoritative Definition (`data-dictionary.md` `§2.8` `L156`):**
   - Listed as: `` `id` | Request identifier (`approvalRequestId`) | `PendingApprovalRequest` | `UNIQUEIDENTIFIER` / `NVARCHAR(64)` | `64` | Required | `NOT NULL` | `PK` | — | `domain-18`, `§5-03` | Stable `202 Accepted` request ID | `PROPOSED` ``.
2. **Trace to Approved Decisions & Checkpoints:**
   - [`CP-010`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md) (`L21`) records **CP1 #4** as approving Option A for `PendingApprovalRequest`'s **polymorphic target pattern** (`target_entity_type`, `target_entity_id`, `payload_snapshot_json`), and `L38` explicitly states that non-promoted `PROPOSED` metadata/snapshot columns on `PendingApprovalRequest` remain **`PROPOSED`** and are **not** Owner-approved.
   - No Owner decision in `decision-register.md` or `CP-010`–`CP-012` locks `PendingApprovalRequest.id` to either `UNIQUEIDENTIFIER` or `NVARCHAR(64)`.
3. **Origin of the Conflict:**
   - [`data-dictionary.md`](data-dictionary.md) `§2.8` `L156` intentionally left both candidate types (`UNIQUEIDENTIFIER` / `NVARCHAR(64)`) in the same `PROPOSED` cell.
   - [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) (`L81`) extracted the `NVARCHAR(64)` option (`TECHNICAL-RECOMMENDATION`, noting support for `apr-...` / UUID strings).
   - [`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) (`L57`) extracted the `UNIQUEIDENTIFIER` option (`PROPOSED`, `UUIDField(primary_key=True)`).
4. **Recommended Resolution & Classification:**
   - **Status:** **Retained as UNRESOLVED** (`PROPOSED` / conflicting `TECHNICAL-RECOMMENDATION`s).
   - **Missing Decision:** Confirm in `WP-5.6` / API contract (`domain-18` `approvalRequestId` format) whether `PendingApprovalRequest.id` is strictly a generated UUID (`UNIQUEIDENTIFIER` / `UUIDField`) or an opaque prefixed string such as `apr-...` (`NVARCHAR(64)` / `CharField`).

---

## 4. Complete `54`-Entity Primary-Key Inventory & Count Verification

**Clarification:** Yes — the **`47` `BIGINT` PKs already include `User.id`** (`OWNER-APPROVED` `BIGINT IDENTITY(1,1)` per `CP-010` `CP1 #1` + `46` `TECHNICAL-RECOMMENDATION` / `PROPOSED` operational `BIGINT` PKs). Deferred `InPersonAttendanceRecord` (`Domain 16`, `DEFERRED`) is excluded.

| PK Category | Count | Mutually Exclusive Entities (Each Active Entity Appears Exactly Once) | Classification |
| :--- | :---: | :--- | :--- |
| **`BIGINT`** | **`47`** | **C1 (`12`):** `User` (`OWNER-APPROVED` `CP1 #1`), `DeletedUserTombstone`, `DeletedUserAlias`, `UserPermissionOverride`, `DelegatedAuthority`, `OrganizationalDepartment`, `JobTitle`, `HistoricalServiceTrainingRecord`, `AuditLogEntry`, `UserOrganizationalDepartment`, `DepartmentJobTitle`, `UserJobTitle`; **C2 (`17`):** `Course`, `CourseAssistantLecturer`, `CourseAudienceDepartment`, `CourseAudienceJobTitle`, `CourseAudienceMetroLine`, `CourseDraft`, `PublishedCourseVersion`, `Module`, `LessonItem`, `QuizDefinition`, `CourseReviewSubmission`, `StagedAdminEdit`, `WorkingNote`, `CourseComment`, `CourseCommentReport`, `MediaAsset`, `MediaContentReference`; **C3 (`18`):** `TrainingGroup`, `GroupAssistantAssignment`, `GroupRenewalCycle`, `GroupCourseAssignment`, `GroupMembership`, `GroupQrCode`, `GroupJoinRequest`, `GroupResource`, `Enrollment`, `EnrollmentSourceGrant`, `CourseAttempt`, `LessonProgress`, `CertificateRecord`, `NotificationItem`, `WhatsAppContact`, `UserWhatsAppVisibility`, `ScheduledJob`, `ScheduledJobRun` | `User.id`: `OWNER-APPROVED`; remaining `46`: `TECHNICAL-RECOMMENDATION` |
| **`INT`** | **`3`** | **C1 (`3`):** `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog` | `TECHNICAL-RECOMMENDATION` |
| **`UNIQUEIDENTIFIER` / `NVARCHAR(64)`** | **`1`** | **C1 (`1`):** `PendingApprovalRequest` (`id` dual-proposed in `data-dictionary.md` §2.8 `L156`) | `PROPOSED` *(unresolved between `UNIQUEIDENTIFIER` and `NVARCHAR(64)`)* |
| **String-Based (`NVARCHAR`)** | **`3`** | **C1 (`3`):** `ServerSession` (`session_key` `NVARCHAR(40)`), `RolePolicy` (`role_key` `NVARCHAR(32)`), `DepartmentTrack` (`id` `NVARCHAR(64)`) | `TECHNICAL-RECOMMENDATION` |
| **Total Active Entities** | **`54`** | **`12 + 17 + 18 = 47` `BIGINT`** + **`3` `INT`** + **`1` `UNIQUEIDENTIFIER`/`NVARCHAR(64)`** + **`3` `NVARCHAR`** = **`54`** | `InPersonAttendanceRecord` (`DEFERRED`) excluded |

*(Count Check: C1 = `12 + 3 + 1 + 3 = 19`; C2 = `17`; C3 = `18`; `19 + 17 + 18 = 54`.)*

---

## 5. Four Catalog Foreign Keys — Current vs. Proposed Alignment

| FK Field | Current Type in `data-dictionary.md` | Target PK & Type | Proposed FK Type | Alignment Necessary? | Conflict with Approved Decisions? | Classification |
| :--- | :---: | :--- | :---: | :---: | :--- | :---: |
| `User.metro_line_id` | `BIGINT` (`§2.1`) | `MetroLine.id` (`INT`) | `INT` *(or promote `MetroLine.id` to `BIGINT`)* | **Yes** — SQL Server rejects FK constraints between `BIGINT` and `INT` | **No** (`MetroLine.id` `INT` is `PROPOSED`/`TECH-REC`, not `OWNER-APPROVED`) | `TECHNICAL-RECOMMENDATION` |
| `User.marital_status_id` | `BIGINT` (`§2.1`) | `MaritalStatusCatalog.id` (`INT`) | `INT` *(or promote `MaritalStatusCatalog.id` to `BIGINT`)* | **Yes** — SQL Server requires exact PK/FK type match | **No** (`MaritalStatusCatalog.id` `INT` is `PROPOSED`/`TECH-REC`) | `TECHNICAL-RECOMMENDATION` |
| `User.military_service_status_id` | `BIGINT` (`§2.1`) | `MilitaryServiceStatusCatalog.id` (`INT`) | `INT` *(or promote `MilitaryServiceStatusCatalog.id` to `BIGINT`)* | **Yes** — SQL Server requires exact PK/FK type match | **No** (`MilitaryServiceStatusCatalog.id` `INT` is `PROPOSED`/`TECH-REC`) | `TECHNICAL-RECOMMENDATION` |
| `CourseAudienceMetroLine.metro_line_id` | `BIGINT` (`§5.2`) | `MetroLine.id` (`INT`) | `INT` *(or promote `MetroLine.id` to `BIGINT`)* | **Yes** — SQL Server requires exact PK/FK type match | **No** (`CourseAudienceMetroLine` FK is `TECHNICAL-RECOMMENDATION`) | `TECHNICAL-RECOMMENDATION` |

---

## 6. Validation of All `84` Integer FK Relationships

Direct audit of [`data-dictionary.md`](data-dictionary.md) across all `54` active entities confirms **`84` integer foreign-key columns** (`100%` specifying **`ON DELETE NO ACTION`** per SQL Server multiple-cascade-path prevention):

- **Current-State Consistency (`data-dictionary.md` as written today):**
  - **`80 / 84` (`95.2%`)** currently match their referenced `BIGINT` PKs (`BIGINT` → `BIGINT`).
  - **`4 / 84` (`4.8%`)** have an active type mismatch (`BIGINT` FK → `INT` catalog PK: the four catalog FKs in Section 5 above).
  - **Therefore, all `84` do NOT currently match** without resolving the `4` catalog FKs.
- **Proposed-State Consistency (after aligning the `4` catalog FKs to `INT`, or promoting the `3` catalog PKs to `BIGINT`):**
  - **`84 / 84` (`100%`)** match their target PK type (`80` `BIGINT`→`BIGINT` + `4` `INT`→`INT`, or `84` `BIGINT`→`BIGINT`).
  - **`84 / 84` (`100%`)** preserve `ON DELETE NO ACTION` (`OWNER-APPROVED` / `TECHNICAL-RECOMMENDATION` baseline).

---

## 7. Django & `mssql-django` Version Verification & Recommendation

- **Repository Dependency Check:** No `requirements.txt`, `pyproject.toml`, `Pipfile`, `poetry.lock`, or `backend/` directory exists yet. [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) specifies `Python 3.12+` and `Django 5.x` with `mssql-django` / `pyodbc`, without pinning an exact `mssql-django` version.
- **Official `microsoft/mssql-django` Release Compatibility (Verified via Microsoft / `github.com/microsoft/mssql-django`):**
  - **`mssql-django 2.0`** (released September 2026) supports **Python `3.10–3.14`** and **Django `5.2`**, and **dropped support for Django `5.0` and `5.1`**.
  - Projects on **Django `5.0` or `5.1`** must pin **`mssql-django == 1.8.0`** (`< 2.0`, security-only maintenance).
- **Recommended Baseline (`TECHNICAL-RECOMMENDATION`):**
  - Target **Python `3.12+` + Django `5.2` LTS + `mssql-django >= 2.0, < 3.0`** (with `pyodbc`) at `WP-5.6` kickoff, or pin `mssql-django == 1.8.0` only if Django `5.0`/`5.1` is explicitly chosen.

---

## 8. Temporal Mapping Policy Findings

Evaluation of the proposed policy (`USE_TZ=True`, `DATETIMEOFFSET(7)` UTC `+00:00` storage, `Africa/Cairo` display, `DATE` for date-only fields):

1. **`mssql-django` `DateTimeField` Mapping (Official `microsoft/mssql-django` Behavior):**
   - Under **`USE_TZ = True`**, `mssql-django` maps `models.DateTimeField` to **`DATETIMEOFFSET(7)`** and compiles `Now()` to `SYSDATETIMEOFFSET()`.
   - Under **`USE_TZ = False`**, `mssql-django` maps `models.DateTimeField` to **`DATETIME2(7)`**. Switching `USE_TZ` later does **not** auto-migrate existing `DATETIME2` columns to `DATETIMEOFFSET`.
2. **Offset vs. IANA Timezone Clarification:**
   - SQL Server `DATETIMEOFFSET(7)` stores a **numeric UTC offset** (`+00:00` when normalized to UTC by Django), **not** an IANA timezone identifier such as `Africa/Cairo`. Application-layer `zoneinfo` (`TIME_ZONE = 'Africa/Cairo'`) handles DST-aware local projection.
3. **Storage & Operational Trade-offs (`DATETIMEOFFSET(7)` vs. `DATETIME2(7)`):**
   - `DATETIMEOFFSET(7)` uses **`10` bytes** (`+2` bytes per value vs. `8` bytes for `DATETIME2(7)`), preserves explicit offset metadata on the wire (`+00:00`), and aligns natively with `USE_TZ=True` and [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) §4.
   - `4` calendar-date fields (`User.appointment_date`, `User.date_of_birth`, `User.service_end_date`, `HistoricalServiceTrainingRecord.completion_date`) remain **`DATE`** (`3` bytes, no timezone shift).
4. **Discrepancy Recorded:** [`data-dictionary.md`](data-dictionary.md) currently writes `DATETIME2(7)` (UTC) for the `38` timestamp fields, conflicting with `django-sqlserver-integration-contract.md` §4 (`DATETIMEOFFSET(7)` + `USE_TZ=True`). Reconcile before `WP-5.6` `0001_initial.py` generation (`TECHNICAL-RECOMMENDATION`).

---

## 9. Unresolved Decisions Preserved

1. **`PendingApprovalRequest.id` (`PROPOSED` / Conflicting `TECHNICAL-RECOMMENDATION`s):** Unresolved between `UNIQUEIDENTIFIER` (`UUIDField`) and `NVARCHAR(64)` (`CharField`) pending `approvalRequestId` format confirmation.
2. **`QuizDefinition.passing_score` (`UNRESOLVED-BUSINESS-RULE` / `NEEDS-BUSINESS-CLARIFICATION`):** Unresolved between integer percentage (`0–100`), fractional percentage (`DECIMAL(5,2)`), and raw point score. Physical type remains unresolved.
3. **`GroupQrCode.token_hash` (`NEEDS-BUSINESS-CLARIFICATION`):** Hash algorithm (`SHA-256` vs. `SHA-512` vs. alternatives) is unspecified in `domain-09`. Any `BINARY(32)` / `VARBINARY(32)` recommendation remains strictly conditional on confirming `SHA-256` (32-byte digest). `CertificateRecord.verification_token_hash` (`OWNER-APPROVED` `BINARY(32)` per `TR-C3-03`) is untouched.

---

## 10. Final Findings & Remaining Blockers

- **Remaining Blockers Before `WP-5.6`:**
  1. Confirm `PendingApprovalRequest.id` format (`UNIQUEIDENTIFIER` vs. `NVARCHAR(64)`).
  2. Resolve the `4` catalog FK type mismatches (`BIGINT` vs. `INT`) in DDL/model generation.
  3. Confirm `QuizDefinition.passing_score` scale/unit and `GroupQrCode.token_hash` hash algorithm.
  4. Align `data-dictionary.md` `DATETIME2(7)` notation with `DATETIMEOFFSET(7)` (`USE_TZ=True`) and pin `Django 5.2` + `mssql-django >= 2.0, < 3.0` in `WP-5.6`.
- **Verification Summary:** Exactly one new report created; zero existing files modified; `data-dictionary.md` remains `UNFROZEN`; `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

**Final Status: `SUPPLEMENTARY RECONCILIATION AUDIT COMPLETED — WP-5.6 NOT AUTHORIZED.`**
