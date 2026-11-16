# MetroLMS — WP-5.5 Final Owner Sign-Off & Data Dictionary Readiness Review

> **Document Type:** `READ-ONLY READINESS ASSESSMENT (REPORT ONLY)`  
> **Document Status:** `ASSESSMENT COMPLETE — NOT AN OWNER APPROVAL OR FREEZE RECORD`  
> **Review Date:** `2026-11-15`  
> **Scope:** Comprehensive pre-freeze readiness audit of [`data-dictionary.md`](data-dictionary.md) and its governing `WP-5.5` architecture, physical-type, integration, and project-state artifacts.  
> **Governance Boundaries:**  
> - [`data-dictionary.md`](data-dictionary.md) remains **`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`**.  
> - **`WP-5.6` remains `BLOCKED — NOT AUTHORIZED`**.  
> - `CP-010`, `CP-011`, and `CP-012` were **not modified**; `CP-013` was **not created**.  
> - Zero SQL DDL, Django models, migrations, database connections, dependency changes, or application code/test edits were performed.

---

## 1. Executive Summary

This read-only readiness audit independently verifies the canonical MetroLMS Data Dictionary ([`data-dictionary.md`](data-dictionary.md)) against the Conceptual & Logical Data Model ([`logical-data-model.md`](logical-data-model.md)), Crow's Foot ERD ([`erd-crow-foot.md`](erd-crow-foot.md)), [`decision-register.md`](../../architecture/decision-register.md), [`wp-5-5-deferred-decisions-record.md`](wp-5-5-deferred-decisions-record.md), [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md), domain specifications (`domain-20`, `domain-21`, `reminder-programs-and-group-domain-specification.md`), and project-state records ([`CURRENT.md`](../../project-state/CURRENT.md), [`active-roadmap.md`](../../project-state/active-roadmap.md)).

- **Verified Baseline Counts:** `54` active entities (`19` Cluster 1 + `17` Cluster 2 + `18` Cluster 3) + `1` explicitly `DEFERRED` entity (`InPersonAttendanceRecord`, `Domain 16`); `302` active mapped fields (`108` + `96` + `98`); `84/84` integer foreign keys aligned to `BIGINT` PKs with `ON DELETE NO ACTION`; `38` active timestamp fields on `DATETIMEOFFSET(7)` (`0` remaining `DATETIME2` in active entity tables); `4` date-only `DATE` fields; `102` string fields (`15` `OWNER-APPROVED` lengths + `87` settled `TECHNICAL-RECOMMENDATION` lengths); `1` `UNIQUEIDENTIFIER` (`PendingApprovalRequest.id`); `2` binary fields (`BINARY(32)` + `VARBINARY(32)`); `2` `DECIMAL(5,2)` fields; `12` `BIT` fields; and `0` PostgreSQL-only constructs.
- **Overall Readiness Classification:** **`READY FOR FINAL OWNER SIGN-OFF WITH CONDITIONS`**
- **Separate Freeze Recommendation:** **`RECOMMEND FREEZE AFTER CONDITIONS`**

---

## 2. Files Inspected

### Core Data Architecture
- [`docs/02-architecture-and-design/data-models/data-dictionary.md`](data-dictionary.md)
- [`docs/02-architecture-and-design/data-models/logical-data-model.md`](logical-data-model.md)
- [`docs/02-architecture-and-design/data-models/erd-crow-foot.md`](erd-crow-foot.md)
- [`docs/architecture/decision-register.md`](../../architecture/decision-register.md)

### Governance & Project State
- [`docs/project-state/CURRENT.md`](../../project-state/CURRENT.md)
- [`docs/project-state/active-roadmap.md`](../../project-state/active-roadmap.md)
- [`docs/project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md)
- [`docs/project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md`](../../project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md)
- [`docs/project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md)
- [`docs/02-architecture-and-design/data-models/wp-5-5-deferred-decisions-record.md`](wp-5-5-deferred-decisions-record.md)
- [`docs/02-architecture-and-design/data-models/wp-5-5-physical-types-review-closure.md`](wp-5-5-physical-types-review-closure.md)

### Physical Type, Integration & Domain Documentation
- [`docs/02-architecture-and-design/data-models/physical-string-length-recommendations.md`](physical-string-length-recommendations.md)
- [`docs/02-architecture-and-design/data-models/physical-storage-recommendations-review.md`](physical-storage-recommendations-review.md)
- [`docs/02-architecture-and-design/data-models/django-sqlserver-physical-type-mapping-review.md`](django-sqlserver-physical-type-mapping-review.md)
- [`docs/02-architecture-and-design/data-models/physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md)
- [`docs/02-architecture-and-design/data-models/physical-types-reconciliation-supplement.md`](physical-types-reconciliation-supplement.md)
- [`docs/02-architecture-and-design/data-models/physical-types-final-correction-audit.md`](physical-types-final-correction-audit.md)
- [`docs/02-architecture-and-design/data-models/mssql-django-version-verification-correction.md`](mssql-django-version-verification-correction.md)
- [`docs/02-architecture-and-design/data-models/python-django-compatibility-clarification.md`](python-django-compatibility-clarification.md)
- [`docs/02-architecture-and-design/data-models/deferred-decisions-resolution-assessment.md`](deferred-decisions-resolution-assessment.md)
- [`docs/02-architecture-and-design/data-models/deferred-decisions-resolution-corrections.md`](deferred-decisions-resolution-corrections.md)
- [`docs/02-architecture-and-design/data-models/deferred-decisions-resolution-final-verification.md`](deferred-decisions-resolution-final-verification.md)
- [`docs/backend/django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md)
- [`docs/01-requirements/domains/domain-20-scheduling-deadlines-and-background-jobs.md`](../../01-requirements/domains/domain-20-scheduling-deadlines-and-background-jobs.md)
- [`docs/03-technical-documentation/domains/operations/domain-20-scheduling-deadlines-and-background-jobs.md`](../../03-technical-documentation/domains/operations/domain-20-scheduling-deadlines-and-background-jobs.md)
- [`docs/requirements/reminder-programs-and-group-domain-specification.md`](../../requirements/reminder-programs-and-group-domain-specification.md)

*(Note: The Post-Integration Correction Audit edits were applied directly to `wp-5-5-deferred-decisions-record.md`, `decision-register.md`, and `django-sqlserver-integration-contract.md`; no separate standalone Post-Integration Correction Audit report file exists in `docs/02-architecture-and-design/data-models/`.)*

---

## 3. Entity and Relationship Verification (Workstream A — `PASS`)

Independently recalculated from [`data-dictionary.md`](data-dictionary.md) (`## 2.`, `## 5.`, `## 8.`) and cross-checked against [`logical-data-model.md`](logical-data-model.md) and [`erd-crow-foot.md`](erd-crow-foot.md):

- **Cluster 1:** `19` active entities.
- **Cluster 2:** `17` active entities.
- **Cluster 3:** `18` active entities.
- **Total Active Entities:** **`54`** (every active entity represented once; zero invented entities).
- **Deferred Entity:** `InPersonAttendanceRecord` (`Domain 16`) remains explicitly classified as `DEFERRED` (`data-dictionary.md` `L18`, `L464`, `L530`, `L700`).
- **Key Structural Invariants Verified:**
  - `TrainingGroup`, `GroupMembership`, `Enrollment`, `CourseAttempt`, `LessonProgress`, and `CertificateRecord` separation remains intact (`§8.3`–`§8.4`).
  - `EnrollmentSourceGrant` preserves `direct`, `group`, and `self:continued` provenance (`L494`).
  - Reminder Course terminal-child and cycle-prevention rules (`D-OWNER-REV-19/20`) remain intact (`§5`).
  - `MediaContentReference` 3-way XOR (`CourseDraft` / `PublishedCourseVersion` / `GroupRenewalCycle`) with `ON DELETE NO ACTION` remains intact (`TR-C3-05`, `L657`, `L671–673`).
  - Polymorphic reference on `PendingApprovalRequest` (`target_entity_type` / `target_entity_id`) and `DeletedUserTombstone` / `DeletedUserAlias` separation remain intact (`§2.3`, `§2.8`).

---

## 4. Field-Level Inventory and Classification (Workstream B — `PASS WITH CONDITIONS`)

Independently recalculated across all mapping tables in [`data-dictionary.md`](data-dictionary.md) (`## 2.`, `## 5.`, `## 8.`):

- **Cluster 1:** `108` mapped fields
- **Cluster 2:** `96` mapped fields
- **Cluster 3:** `98` mapped fields
- **Total Active Mapped Fields:** **`302`**

### Row-Level Governance Classification Distribution (`169` mapping table rows)
| Classification Pattern in `Governance Status` Column | Row Count | Notes |
| :--- | :---: | :--- |
| **`OWNER-APPROVED`** *(unqualified)* | `22` | Fully Owner-approved at field/type level |
| **`TECHNICAL-RECOMMENDATION`** *(pure or mixed with approved rule)* | `103` | Includes technical-recommendation types/lengths (`87` string lengths, FKs, timestamps) |
| **`PROPOSED`** *(pure `PROPOSED` or `OWNER-APPROVED` rule with `PROPOSED` column/length/type/nullability)* | `44` | Contains field-level details not yet explicitly finalized by Owner |
| **`DEFERRED`** *(in active mapping tables)* | `0` | `InPersonAttendanceRecord` is excluded from active mapping tables |
| **Total Mapping Rows** | **`169`** | Covers all `302` active fields |

Because `44` mapping rows retain `PROPOSED` field/column elements and `87` string lengths remain `TECHNICAL-RECOMMENDATION`, overall Stage 4 acceptance (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`) does **not** automatically convert every `PROPOSED` column detail into an Owner-approved persistence specification. See **Section 11** for the Pre-Freeze Owner Field Review Package.

---

## 5. Physical Type Verification (Workstream C — `PASS WITH CONDITIONS`)

### Independent Type Distribution Across All `302` Active Fields
| SQL Server Type Family | Recalculated Field Count | Verification Notes |
| :--- | :---: | :--- |
| **String (`NVARCHAR` / `VARCHAR` / `CHAR`)** | **`102`** | Reconciled from prior `103` after `PendingApprovalRequest.id` migrated to `UNIQUEIDENTIFIER` (`WP55-PT-01`); preserves `15` `OWNER-APPROVED` + `87` settled `TECHNICAL-RECOMMENDATION` lengths |
| **Integer (`BIGINT` / `INT`)** | **`141`** | Includes `50` `BIGINT` PKs and `84/84` `BIGINT` FKs with `ON DELETE NO ACTION` (`WP55-PT-02` catalog PK/FK alignment verified) |
| **Timestamp (`DATETIMEOFFSET(7)` / `DATETIMEOFFSET`)** | **`38`** | `WP55-PT-05`; `0` remaining `DATETIME2` in active entity tables |
| **Boolean (`BIT`)** | **`12`** | Standard SQL Server boolean representation |
| **Date-only (`DATE`)** | **`4`** | `User.appointment_date`, `User.date_of_birth`, `User.service_end_date`, `HistoricalServiceTrainingRecord.completion_date` |
| **Binary (`BINARY(32)` / `VARBINARY(32)`)** | **`2`** | `CertificateRecord.verification_token_hash` (`BINARY(32)`), `GroupQrCode.token_hash` (`VARBINARY(32)`, `WP55-PT-04`) |
| **Decimal (`DECIMAL(5,2)`)** | **`2`** | `QuizDefinition.passing_score` (`WP55-PT-03`, `0.00–100.00` %), `LessonProgress.progress_percent` |
| **UUID (`UNIQUEIDENTIFIER`)** | **`1`** | `PendingApprovalRequest.id` (`WP55-PT-01`, Django `UUIDField`) |
| **Total Active Fields** | **`302`** | **`100%` accounted for (`0` untyped/other)** |

### Integrated Decision Verification (`WP55-PT-01` through `WP55-PT-06`)
- **`WP55-PT-01` (`PendingApprovalRequest.id`):** `UNIQUEIDENTIFIER` / `UUIDField`; UUID API `approvalRequestId` (`django-sqlserver-integration-contract.md` `L51`, `L58`); no unauthorized `public_reference` column. **Verified.**
- **`WP55-PT-02` (Catalog PK/FK alignment):** `MetroLine.id`, `MaritalStatusCatalog.id`, `MilitaryServiceStatusCatalog.id` = `BIGINT`; `84/84` integer FKs match `BIGINT` PKs with `ON DELETE NO ACTION`. **Verified.**
- **`WP55-PT-03` (`QuizDefinition.passing_score`):** `DECIMAL(5,2)` / `DecimalField(max_digits=5, decimal_places=2)`, `0.00–100.00` percentage-based, `>=` comparison without pre-rounding, no `FLOAT`. **Verified.**
- **`WP55-PT-04` (`GroupQrCode.token_hash`):** `>= 256-bit` CSPRNG raw token (never persisted/logged), `SHA-256`, `VARBINARY(32)`, single mutable row per `TrainingGroup` (`TR-C3-01` Option B). **Verified.**
- **`WP55-PT-05` (Temporal & Windows Timezone Policy):** `38` `DATETIMEOFFSET(7)` + `4` `DATE`, `USE_TZ=True`, Windows Server system timezone `UTC`, Django `TIME_ZONE='UTC'`, `+00:00` DB persistence, explicit `ZoneInfo("Africa/Cairo")` + `tzdata`, `timezone.now()`, `timezone.override(ZoneInfo("Africa/Cairo"))`, no unargumented `timezone.localtime()`. Zero contradictory old Windows timezone wording in `wp-5-5-deferred-decisions-record.md`, `decision-register.md`, or `django-sqlserver-integration-contract.md`. **Verified.**
- **`WP55-PT-06` (Deployment & Driver Baseline):** Windows Server 2022 (`OWNER-CONFIRMED` OS), `x64` baseline (pending infra inventory), Python `3.12`, Django `5.2` LTS, SQL Server `2022` baseline (topology unassumed), `mssql-django==2.0.0`, `pyodbc` active/default runtime driver + Microsoft ODBC Driver 18, `mssql-python>=1.15.0` documented as mandatory package dependency only. **Verified.**
- **PostgreSQL Check:** `0` occurrences of `BIGSERIAL`, `TIMESTAMPTZ`, `JSONB`, or `\bBOOLEAN\b` in `data-dictionary.md` or `wp-5-5-deferred-decisions-record.md`.

---

## 6. Business Rules and Lifecycle Verification (Workstream D — `PASS`)

Cross-checked against [`decision-register.md`](../../architecture/decision-register.md) and [`data-dictionary.md`](data-dictionary.md):
- 6-tier role hierarchy (`INV-R1`–`R8`, `developer` singleton filtered unique index `L65`), `D-01` role-aware deletion (`L560–596`), `DeletedUserTombstone` + `DeletedUserAlias` (`L94–100`), `PendingApprovalRequest` Requester/Reviewer/Executor separation (`L156–163`).
- Course primary/assistant lecturer rules (`D-OWNER-REV-30`), empty-audience fail-closed (`D-OWNER-REV-23`), Reminder Course terminal-child rule (`D-OWNER-REV-19/20`), `CourseReviewSubmission` / `StagedAdminEdit` / `WorkingNote` indefinite retention (`D-OWNER-REV-31`), `CourseComment` anonymization (`INV-DOM02-03`).
- `MediaAsset` / `MediaContentReference` immutability, Logical Detachment (`INV-DOM21-18`), and 3-way XOR (`TR-C3-05`); `GroupRenewalCycle` 5-state lifecycle (`TR-C3-02`); QR Option B regeneration (`TR-C3-01`); `EnrollmentSourceGrant` provenance (`L494`); `CertificateRecord` internal-only `recipient_name_snapshot` (`TR-C3-03`); `ScheduledJobRun` max 3 attempts (`retry_count BETWEEN 0 AND 2`) & 12-month retention (`TR-C3-04`); `WhatsAppContact` (`D-09`); and `ON DELETE NO ACTION` across all `84` integer FKs.

---

## 7. Windows Timezone and Scheduler Review (Workstream F — `PASS`)

Inspected `domain-20-scheduling-deadlines-and-background-jobs.md` (requirements & technical), `CURRENT.md` (`L95`, `L98`), `reminder-programs-and-group-domain-specification.md` (`L317`), `wp-5-5-deferred-decisions-record.md` (`L48–55`), `decision-register.md` (`L175`), and `django-sqlserver-integration-contract.md` (`§4.1`):
- `process_due_group_renewals` (Windows Task Scheduler every 6 hours, `Domain 20 / D4`) uses canonical UTC-based aware `datetime` comparisons (`<= now`, `> now`) without inventing clock anchors or altering `D-GRP-02`, `INV-DOM20-06`/`07`, `INV-DOM10-12`, `lastAutoRenewedCycleId`, or row locking (`select_for_update()`).
- `WP55-PT-05` aligns Windows Server OS timezone (`UTC`) and Django `TIME_ZONE='UTC'`, avoiding Django 5.2 Windows alternate-timezone limitations while using explicit `ZoneInfo("Africa/Cairo")` + `tzdata` for Cairo calendar/clock semantics and DST-safe transitions.

---

## 8. Decision Traceability Review (Workstream E — `PASS`)

- `WP55-PT-01`–`WP55-PT-06` cleanly avoid collision with Domain Rules `D-01`–`D-14`.
- Consistent across `wp-5-5-deferred-decisions-record.md`, `decision-register.md` (`§7`), `django-sqlserver-integration-contract.md` (`§1`, `§2.3`, `§4.1`), `CURRENT.md`, and `active-roadmap.md`.
- Historical closure/audit reports (`physical-types-review-closure-assessment.md`, `wp-5-5-physical-types-review-closure.md`, etc.) remain unrewritten.

---

## 9. Checkpoint and Project-State Review (Workstream G — `PASS WITH CONDITIONS`)

- `CP-012` remains latest accepted checkpoint; `CP-013` remains next sequential checkpoint.
- [`data-dictionary.md`](data-dictionary.md) remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.
- `active-roadmap.md` (`L8`) remains synchronized without merging REV6; frontend track (`Phase 3 / WP-3.1 / T-3.1.1`) unaltered; `git status --short frontend/src` shows `0` modified files.
- **Exact Checkpoint Git Status:**
  - `?? docs/project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md`
  - `?? docs/project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md`
  - `?? docs/project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md`
  - **Evidentiary Scope:** `??` indicates all three files are **untracked** in Git. None were edited, staged, committed, renamed, or deleted during this review; however, because no committed Git baseline or prior hash exists for these untracked files, **Git cannot independently establish historical content equality against an earlier snapshot**.

---

## 10. Audit Findings

| Severity | ID | Finding | Location |
| :--- | :---: | :--- | :--- |
| **Minor** | `F-01` | Historical prose under `TR-C3-03` still reads `revoked_at DATETIME2 NULL` even though the active Cluster 3 table (`L497`) was updated to `DATETIMEOFFSET(7)` under `WP55-PT-05`. | `data-dictionary.md` `L665` |
| **Minor** | `F-02` | `TR-C3-04` prose (`L670`) summarizes "UTC / `Africa/Cairo` display" without cross-referencing `WP55-PT-05` (`Windows OS UTC` + `Django TIME_ZONE='UTC'`). | `data-dictionary.md` `L670` |
| **Informational** | `F-03` | `44` mapping rows in `data-dictionary.md` retain `PROPOSED` field/column/length/nullability elements and `87` string lengths remain `TECHNICAL-RECOMMENDATION`, requiring explicit Owner confirmation or adjustment prior to freeze. | `data-dictionary.md` `## 2.`, `## 5.`, `## 8.` |
| **Informational** | `F-04` | `CP-010`, `CP-011`, `CP-012` are untracked (`??`) in Git; historical content equality cannot be proven via Git alone. | `docs/project-state/checkpoints/` |
| **Informational** | `F-05` | Infrastructure inventory (`x64` architecture, `SQL Server 2022` target, co-hosted vs. separate DB topology) remains pending operational verification. | `wp-5-5-deferred-decisions-record.md` `§2` (`WP55-PT-06`) |

---

## 11. Pre-Freeze Owner Field Review Package

The following database-bound items remain `PROPOSED`, `TECHNICAL-RECOMMENDATION`, `OPEN`, or `DEFERRED` and should be explicitly confirmed or adjusted by the Project Owner before freezing `data-dictionary.md`:

| Reference | Current Classification | Current Definition | Why Owner Review Is Needed | Technical Recommendation | Schema / API Impact | Source |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **`User.email`** | `PROPOSED` | `NVARCHAR(254) NULL`, filtered `UNIQUE` when non-null | Optional profile/notification email; uniqueness & masking rules when non-null not separately Owner-signed | Retain `NVARCHAR(254) NULL` + filtered `UNIQUE` index | Affects `User` DDL & `/api/users` validation | `data-dictionary.md` `L77` |
| **`DeletedUserTombstone.canonical_user_id` & `DeletedUserAlias.alias_id`** | `PROPOSED` | `BIGINT` / `NVARCHAR(64) UNIQUE` | Tombstone retention & alias string length `64` proposed | Confirm `BIGINT` + `NVARCHAR(64)` | Affects tombstone schema & `/me` collision lookup | `data-dictionary.md` `L94`, `L100` |
| **Catalog `name_ar` / `name_en` / `code` lengths** (`OrganizationalDepartment`, `JobTitle`, `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`, `DepartmentTrack`) | `PROPOSED` / `TECHNICAL-RECOMMENDATION` | `NVARCHAR(64)` (`code`) / `NVARCHAR(150)` (`name_ar`/`name_en`); `DepartmentTrack.allowed_tracks_json` `NVARCHAR(MAX)` | Bilingual catalog lengths & `DepartmentTrack` JSON column proposed | Confirm `64`/`150` lengths and `NVARCHAR(MAX)` with `ISJSON()` | Affects catalog DDL & admin CRUD validation | `data-dictionary.md` `L125–150` |
| **`PendingApprovalRequest` (`action_type`, `*_by_id`, `reason`)** | `PROPOSED` *(reason length)* / `TECHNICAL-RECOMMENDATION` | `action_type NVARCHAR(64)`, `*_by_id NVARCHAR(64)`, `reason NVARCHAR(500) NULL` | `*_by_id` stored as `NVARCHAR(64)` (non-cascade) vs. `BIGINT`; `reason` max `500` proposed | Confirm `NVARCHAR(64)` attribution & `NVARCHAR(500)` reason | Affects approval audit persistence & `202` DTOs | `data-dictionary.md` `L157`, `L159`, `L162` |
| **`AuditLogEntry` columns** (`actor_user_id`, `actor_role_snapshot`, `is_developer_masked`, `action`, `target_entity_*`, `details_snapshot_json`, `reason`) | `PROPOSED` | `NVARCHAR(64)` / `NVARCHAR(32)` / `BIT` / `NVARCHAR(MAX)` | Column types & `NVARCHAR(MAX)` snapshot payload proposed | Confirm current types with `ISJSON()` on `details_snapshot_json` | Affects audit log DDL & log query serializers | `data-dictionary.md` `L169–172` |
| **`Course.description`, `Course.lifecycle_status`, `Module.sort_order`, `LessonItem.lesson_type`/`sort_order`, `QuizDefinition.questions_json`** | `PROPOSED` | `NVARCHAR(MAX)` (`description`, `questions_json`), `NVARCHAR(32)` (`lifecycle_status`, `lesson_type`), `INT` (`sort_order`) | Quiz JSON schema & curriculum column sizes/enums proposed | Confirm current types; validate `questions_json` at app/DRF layer | Affects curriculum DDL & course builder APIs | `data-dictionary.md` `L311`, `L315`, `L350`, `L354`, `L358` |
| **`CourseReviewSubmission`, `StagedAdminEdit`, `WorkingNote`, `CourseComment`, `CourseCommentReport`** | `PROPOSED` | `review_status NVARCHAR(32)`, `edit_payload_json`/`note_body`/`body NVARCHAR(MAX)`, `CourseCommentReport.status NVARCHAR(32)` | Review/moderation state enums & unbounded `NVARCHAR(MAX)` text lengths proposed | Confirm current types & moderation status enum | Affects review/moderation DDL & API payloads | `data-dictionary.md` `L369–371`, `L380`, `L382` |
| **`MediaContentReference` (`is_visible`, `detached_at`, state/audit/restore `A-03c-1`–`3`)** | `PROPOSED` / `GATED` | `is_visible BIT`, `detached_at DATETIMEOFFSET(7) NULL` | Exact logical detachment state representation, restoration, & asset purge lifecycle (`A-03c-1`–`3`) remain unresolved | Retain `BIT` + `detached_at` for freeze or resolve `A-03c-1`–`3` separately | Could add audit/state columns before `WP-5.6` | `data-dictionary.md` `L396–397`, `CURRENT.md` `L101` |
| **`TrainingGroup` renewal fields, `GroupAssistantAssignment`, `GroupJoinRequest`, `GroupResource.provider`** | `PROPOSED` | `BIT` / `INT` / `DATETIMEOFFSET(7)`, `assignment_role`/`request_status`/`provider` `NVARCHAR(20)` | Column types & enum strings (`Pending`/`Approved`/`Rejected`, `teams`/`zoom`/`meet`/`other`) proposed | Confirm current types & `CHECK` constraints | Affects group & renewal DDL & APIs | `data-dictionary.md` `L475–476`, `L487–488` |
| **`EnrollmentSourceGrant`, `LessonProgress.progress_percent` & columns** | `PROPOSED` | `source_type NVARCHAR(20)`, `progress_percent DECIMAL(5,2)` | `LessonProgress` persistence columns & `DECIMAL(5,2)` scale proposed | Confirm `DECIMAL(5,2)` (`0.00–100.00`) & `UNIQUE(course_attempt_id, lesson_item_id)` | Affects progress DDL & learner API | `data-dictionary.md` `L494`, `L496` |
| **`NotificationItem`, `UserWhatsAppVisibility`, `ScheduledJob`, `ScheduledJobRun`** | `PROPOSED` / `OPEN` | `ScheduledJob`/`ScheduledJobRun` column types; general scheduler tech & post-12m archive/delete mechanics `OPEN` | Column types proposed; post-12m archival & general scheduler tech remain `OPEN` | Confirm column types now; keep general scheduler tech & post-12m archive `OPEN` | Affects notification & background-job DDL | `data-dictionary.md` `L502`, `L504–506`, `L656` |
| **`87` Settled Technical-Recommendation String Lengths** | `TECHNICAL-RECOMMENDATION` | `NVARCHAR(16..2048)` across non-Owner-length-approved fields | Distinct from the `15` `OWNER-APPROVED` string lengths | Accept `87` settled technical recommendations as baseline | Affects SQL Server column max lengths | `physical-string-length-recommendations.md`, `wp-5-5-physical-types-review-closure.md` |
| **`InPersonAttendanceRecord` (`Domain 16`) & `API-REC-06` (`CL-03` Signed URLs)** | `DEFERRED` | Excluded from active `54` entities (`L464`, `L530`, `L700`) | Incomplete requirements (`Domain 16`) & deferred media delivery (`API-REC-06`) | Keep explicitly `DEFERRED` outside Data Dictionary freeze | Future schema additions in later phase | `data-dictionary.md` `L464`, `L700`, `CURRENT.md` `L102` |

---

## 12. Workstream Status Matrix

| Audit Workstream | Status | Summary Basis |
| :--- | :---: | :--- |
| **A — Entity & Relationship Completeness** | **`PASS`** | `54` active entities (`19+17+18`) + `1` `DEFERRED` (`InPersonAttendanceRecord`), XOR/M:N/hierarchy verified |
| **B — Field-Level Completeness** | **`PASS WITH CONDITIONS`** | `302` active fields verified; `44` `PROPOSED` rows & `87` `TECHNICAL-RECOMMENDATION` string lengths require Owner pre-freeze confirmation |
| **C — Physical Types & SQL Server Compatibility** | **`PASS WITH CONDITIONS`** | `WP55-PT-01`–`06` verified; `84/84` FKs, `38` `DATETIMEOFFSET(7)`, `4` `DATE`, `0` PG constructs; minor prose sync (`F-01`, `F-02`) + infra inventory (`F-05`) pending |
| **D — Business Rules & Lifecycle Invariants** | **`PASS`** | All `D-01`–`D-14`, `INV-R1`–`R10`, `D-GRP`, `INV-DOM21`, `TR-C3-01..05` invariants preserved |
| **E — Governance & Decision Traceability** | **`PASS`** | Zero ID collisions (`WP55-PT-01..06` vs `D-01..14`); historical reports untouched |
| **F — Windows Timezone & Scheduler Readiness** | **`PASS`** | Windows `UTC` + Django `TIME_ZONE='UTC'` + `ZoneInfo("Africa/Cairo")` + `process_due_group_renewals` verified |
| **G — Checkpoints & Project State** | **`PASS WITH CONDITIONS`** | `CP-012` latest, `CP-013` next, `UNFROZEN`, `WP-5.6 BLOCKED`; `CP-010..012` untracked (`??`) in Git so prior equality is unprovable via Git |

---

## 13. Overall Readiness Classification

**`READY FOR FINAL OWNER SIGN-OFF WITH CONDITIONS`**

All structural, relational, physical-type, SQL Server compatibility, and Windows timezone reconciliations are complete and consistent across `54` active entities and `302` fields. Final sign-off is conditional on Owner review of the Pre-Freeze Owner Field Review Package (**Section 11**).

---

## 14. Separate Freeze Recommendation

**`RECOMMEND FREEZE AFTER CONDITIONS`**

`data-dictionary.md` should **not** be frozen in the same step as this assessment. Freeze is recommended **after** the Project Owner:
1. Confirms (or selectively adjusts) the `44` `PROPOSED` field/column rows and `87` `TECHNICAL-RECOMMENDATION` string lengths in **Section 11**.
2. Authorizes cleanup of the two minor prose remnants in `data-dictionary.md` (`L665` `revoked_at DATETIME2 NULL` under `TR-C3-03`, and `L670` `TR-C3-04` Windows `TIME_ZONE='UTC'` cross-reference).
3. Explicitly issues a separate Owner Freeze Authorization (while continuing to keep `InPersonAttendanceRecord` / `Domain 16`, `A-03a-1`, `A-03c-1`–`3`, `OD-API-01`–`04`, `API-REC-06`, and `TR-C3-04` general scheduler tech / post-12m archive mechanics `DEFERRED`/`OPEN`, and verifying `x64` / `SQL Server 2022` infrastructure inventory prior to `WP-5.6`).

---

## 15. Exact Unresolved Items and Required Actions

1. **Owner Pre-Freeze Field Confirmation:** Review Section 11 (`44` `PROPOSED` rows + `87` `TECHNICAL-RECOMMENDATION` string lengths).
2. **Minor Prose Alignment (`F-01`, `F-02`):** Update `data-dictionary.md` `L665` (`DATETIME2` -> `DATETIMEOFFSET(7)`) and `L670` (`WP55-PT-05` cross-reference) upon Owner freeze authorization.
3. **Infrastructure Inventory (`F-05`):** Confirm `x64` CPU architecture, `SQL Server 2022` target, and co-hosted vs. separate DB topology before `WP-5.6` / deployment.
4. **Deferred Scope Preserved Outside Freeze:** `Domain 16` (`InPersonAttendanceRecord`), `A-03a-1`, `A-03c-1`–`3`, `OD-API-01`–`04`, `API-REC-06` (`CL-03` signed URLs), and `TR-C3-04` general scheduler tech & post-12m archive/delete mechanics.

---

## 16. Governance Confirmation

- [`data-dictionary.md`](data-dictionary.md) remains **`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`**.
- No final Owner sign-off was recorded automatically.
- No freeze operation was performed.
- **`WP-5.6` remains `BLOCKED — NOT AUTHORIZED`**.
- No SQL DDL, Django models, migrations, database provisioning, or dependency changes were performed.
- No application source code or tests were modified (`git status --short frontend/src` = `0` modified files).
- No immutable checkpoint (`CP-010`, `CP-011`, `CP-012`) was modified, and `CP-013` was not created.
- This document is a read-only readiness assessment, **not** an Owner approval.

