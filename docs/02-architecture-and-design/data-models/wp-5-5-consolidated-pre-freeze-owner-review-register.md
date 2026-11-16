# MetroLMS — WP-5.5 Consolidated Pre-Freeze Owner Review Register

> **Document Type:** `CONSOLIDATED REVIEW REGISTER`  
> **Document Status:** `OWNER DECISIONS INTEGRATED (OD-PF-01 TO OD-PF-08, INCL. OD-PF-03-B; OR-DB-02, OR-DB-01 & OR-DB-04 2026-11-16)`  
> **Review & Integration Date:** `2026-11-15` (Updated `2026-11-16` for `OR-DB-02`, `OR-DB-01` & `OR-DB-04` Approvals)  
> **Source Baseline:** [`data-dictionary.md`](data-dictionary.md) (`54` active entities / `305` active physical columns under `DepartmentTrack` Option A [`306` logical mappings prior to Option A collapse]; `UNFROZEN`), [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md), and [`wp-5-5-final-owner-signoff-data-dictionary-readiness-review.md`](wp-5-5-final-owner-signoff-data-dictionary-readiness-review.md)  
> **Governance Boundaries:**  
> - [`data-dictionary.md`](data-dictionary.md) remains **`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`**.  
> - **`WP-5.6` remains `BLOCKED — NOT AUTHORIZED`**.  
> - `CP-010`, `CP-011`, and `CP-012` remain untouched; `CP-013` was **not** created.  
> - Zero modifications were made to canonical documents, code, tests, dependencies, or SQL/Django artifacts.

---

## 1. Executive Summary

This consolidated register extracts, reconciles, deduplicates, and prioritizes every outstanding field-level item before the Project Owner's final Data Dictionary freeze decision:

- **Source Inventories Recalculated Directly from Repository:**
  - **`44` `PROPOSED` mapping rows** in [`data-dictionary.md`](data-dictionary.md) (`PROP-01`–`PROP-44`), expanding to **`125`** individual `Entity.Field` references.
  - **`88` string-length entries** in [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) (`STR-01`–`STR-88`), expanding to **`89`** individual `Entity.Field` references (`STR-33` covers `DepartmentTrack.id / department_code`). Two entries (`STR-36` `PendingApprovalRequest.id` and `STR-72` `GroupQrCode.token_hash`) were superseded by `WP55-PT-01` and `WP55-PT-04`, leaving **`86` active string-length recommendation entries** (`87` active string fields).
  - **`15` `OWNER-APPROVED` string lengths** verified immutable and excluded from pending recommendations.
- **Deduplication & Cross-Reference:** **`57`** `Entity.Field` references overlap between `PROP-01`–`PROP-44` and `STR-01`–`STR-88`, yielding **`157` unique `Entity.Field` combinations** (`125 + 89 - 57 = 157`).
- **Owner Attention Distilled (Post-Integration `2026-11-15` & `OR-DB-02` `2026-11-16`):**
  - All **`9` pre-freeze Owner decision items (`OD-PF-01`–`OD-PF-08`, including `OD-PF-03-B`)** are **`OWNER-APPROVED — DOCUMENTATION INTEGRATED (2026-11-15)`**.
  - **`OR-DB-02` (`84` Remaining String-Field Lengths):** **`OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`** (`88` original `STR` entries minus `2` superseded `STR-36`/`STR-72` = `86` active `STR` entries; minus `2` `OD-PF-08` `STR-45`/`STR-52` = **`84` newly approved lengths**; plus `15` earlier `CP-010`–`CP-012` approvals = **`101` total active physical string fields** under `DepartmentTrack` Option A; **`0` remaining `OR-DB-02` string lengths pending**). Approval applies **only** to string maximum length / `NVARCHAR(n)` or `NVARCHAR(MAX)` selection.
  - **`OR-DB-01` (`6` Physical Database Design Groups):** **`OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`** (`48` remaining `BIGINT IDENTITY(1,1)` PKs, `15` remaining `default`+`db_default` defaults, `23` nullable columns across `12` groups + remaining `NOT NULL` columns, `52` individual `CHECK`s + Django validators, `9` `ISJSON()`s, and `24` remaining physical types [`MediaAsset.size_bytes` `BIGINT`, `11` `INT`, `12` `BIT`]).
  - **`OR-DB-04` (Field-Scoped Normalization Scope):** **`OWNER-APPROVED — EXPLICIT OWNER DECISION — 2026-11-16`** (`58` No Normalization / `7` Field-Specific / `36` `NFC` [`27` short display `strip()` + `NFC`, `9` free-form/audit `NFC`-only] = `101` active physical string fields; Condition A `trim_whitespace=False` free-form preservation; Condition B centralized normalization across all write paths incl. bulk ops; Phase 12 SQL Server 2022 verification pending). `data-dictionary.md` remains `UNFROZEN`.

---

## 2. Scope and Governance Restrictions

- **Tech Stack Baseline:** React 19 + TypeScript + Vite + Tailwind CSS v4 (Frontend); Python `3.12` + Django `5.2` LTS + DRF on **Windows Server 2022** (`x64` baseline pending infra inventory); **Microsoft SQL Server 2022** (`mssql-django==2.0.0`, `pyodbc` active/default runtime driver + Microsoft ODBC Driver 18; `mssql-python>=1.15.0` mandatory package dependency only). Zero PostgreSQL assumptions.
- **Preserved Governance State:** `WP-5.5 Physical Types Review: CLOSED — COMPLETE WITH DEFERRED ITEMS`; `WP55-PT-01`–`WP55-PT-06` `OWNER-APPROVED` & integrated; Post-Integration Correction Audit `OWNER-ACCEPTED`; `CP-012` latest accepted; `CP-013` next; `Data Dictionary: UNFROZEN`; `WP-5.6: BLOCKED — NOT AUTHORIZED`.
- **Prohibited Actions (Enforced):** No edits to `data-dictionary.md`, `decision-register.md`, `CURRENT.md`, `active-roadmap.md`, `CP-010`–`CP-012`, or frontend/backend code/tests; no SQL DDL, Django models, migrations, or dependency changes.

---

## 3. Source Documents Inspected

- [`docs/02-architecture-and-design/data-models/data-dictionary.md`](data-dictionary.md)
- [`docs/02-architecture-and-design/data-models/physical-string-length-recommendations.md`](physical-string-length-recommendations.md)
- [`docs/02-architecture-and-design/data-models/wp-5-5-final-owner-signoff-data-dictionary-readiness-review.md`](wp-5-5-final-owner-signoff-data-dictionary-readiness-review.md)
- [`docs/02-architecture-and-design/data-models/wp-5-5-deferred-decisions-record.md`](wp-5-5-deferred-decisions-record.md)
- [`docs/02-architecture-and-design/data-models/wp-5-5-physical-types-review-closure.md`](wp-5-5-physical-types-review-closure.md)
- [`docs/02-architecture-and-design/data-models/logical-data-model.md`](logical-data-model.md)
- [`docs/02-architecture-and-design/data-models/erd-crow-foot.md`](erd-crow-foot.md)
- [`docs/architecture/decision-register.md`](../../architecture/decision-register.md)
- [`docs/backend/django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md)

---

## 4. Extraction Method and Count Reconciliation

1. **Mapping Rows (`PROP-01`–`PROP-44`):** Parsed all entity-mapping tables in `data-dictionary.md` (`## 2.` Cluster 1, `## 5.` Cluster 2, `## 8.` Cluster 3) where `Governance Status` contains `PROPOSED`. Extracted **`44`** rows (`21` Cluster 1 + `12` Cluster 2 + `11` Cluster 3), expanding to **`125`** individual `Entity.Field` references (`0` duplicate references within `PROP-01`–`PROP-44`).
2. **String-Length Entries (`STR-01`–`STR-88`):** Parsed `physical-string-length-recommendations.md` `§3` (`52` Cluster 1 + `15` Cluster 2 + `21` Cluster 3 = **`88`** source entries), expanding to **`89`** individual `Entity.Field` references (`0` duplicate references within `STR-01`–`STR-88`; `STR-33` covers `2` fields: `DepartmentTrack.id` and `DepartmentTrack.department_code`).
3. **Eight-Concept String-Length Inventory Reconciliation:**
   - **Original source-entry count (`PSLR` `§3`):** **`88`** entries (`STR-01`–`STR-88`).
   - **Individual field references in those entries:** **`89`** (`STR-33` represents `2` fields).
   - **Superseded entries:** **`2`** (`STR-36` `PendingApprovalRequest.id` -> `UNIQUEIDENTIFIER` under `WP55-PT-01`; `STR-72` `GroupQrCode.token_hash` -> `VARBINARY(32)` under `WP55-PT-04`).
   - **Active source entries:** **`86`** (`88 - 2`).
   - **Active individual string fields (excluding the 15 `OWNER-APPROVED`):** **`87`** (`89 - 2`, because `STR-33` covers `2` fields; `87 + 15 = 102` total active string fields in `data-dictionary.md`).
   - **Entries already settled:** **`2`** (`STR-36`, `STR-72`).
   - **Entries needing `TECHNICAL-RECOMMENDATION` batch approval:** **`86`** (`0` insufficient-evidence items).
   - **`15` previously `OWNER-APPROVED` lengths:** Preserved immutable and **excluded** from the `88` (`86` active) pending inventory.
   - `wp-5-5-physical-types-review-closure.md` (`L24`) summarized `87` settled + `1` conditional (`PendingApprovalRequest.id`) = `88`.
   - After integrating `WP55-PT-01` (`PendingApprovalRequest.id` -> `UNIQUEIDENTIFIER`) and `WP55-PT-04` (`GroupQrCode.token_hash` -> `VARBINARY(32)`), **`86`** entries remain active string-length recommendations (`87` active string fields in `data-dictionary.md` because `STR-33` `DepartmentTrack.id / department_code` counts as `2` fields), plus `15` `OWNER-APPROVED` = **`102`** active string fields in `data-dictionary.md`.
4. **Preserved `15` `OWNER-APPROVED` String Lengths (Immutable — Excluded from Pending Queue):**
   - **C1 (`4`):** `User.full_name` (`200`), `User.educational_qualification` (`500`), `User.address` (`500`), `DeletedUserTombstone.reason` (`1000`).
   - **C2 (`6`):** `Course.title` (`255`), `Module.title` (`255`), `LessonItem.title` (`255`), `LessonItem.external_video_url` (`2048`), `CourseCommentReport.reason` (`500`), `MediaContentReference.title` (`255`).
   - **C3 (`5`):** `TrainingGroup.name` (`255`), `GroupResource.title` (`255`), `GroupResource.meeting_url` (`2048`), `NotificationItem.title` (`255`), `WhatsAppContact.label` (`150`).

---

## 5. All `44` `PROPOSED` Mapping Rows (`PROP-01`–`PROP-44`)

*Categories: **A** = Business Decision Required; **B** = Owner Field Confirmation; **C** = Technical Recommendation; **D** = Already Settled (core rule/type settled; remaining column types technical); **E** = Deferred / Blocked.*

| Review ID | Entity | Field / Column | Current Mapping | Class | Business Meaning | Source Req | Technical & API Implications | Owner Review | Reason / Freeze Impact | Technical Recommendation & Rationale | Source Ref |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `PROP-01` | `User` | `email` | `NVARCHAR(254) NULL`, filtered `UNIQUE` | **A** | Profile/contact email (not login ID) | `D-OWNER-REV-13,18`, `INV-DOM02-05` | Filtered `UNIQUE` index; `/api/users` validation | **Yes** | Confirm uniqueness & masking when non-null; **Blocks freeze if unconfirmed** | Keep `NVARCHAR(254) NULL` + filtered `UNIQUE` (`RFC 5321`) | `data-dictionary.md` `L77` |
| `PROP-02` | `DeletedUserTombstone` | `canonical_user_id` | `NVARCHAR(64) NOT NULL UNIQUE` | **C** | Deleted user canonical ID (no FK) | `MFR-20`, `D-OWNER-REV-07` | Non-FK stringified ID; `/me` check | No | Pure technical storage format; non-blocking | Keep `NVARCHAR(64) UNIQUE` (`BIGINT` or `usr-...` safe) | `data-dictionary.md` `L94` |
| `PROP-03` | `DeletedUserAlias` | `alias_id` | `NVARCHAR(64) NOT NULL UNIQUE` | **C** | Legacy alias ID mapped to deleted user | `MFR-20`, `§5-01` | `UNIQUE` index for O(1) `/me` lookup | No | Entity pattern approved; length is technical | Keep `NVARCHAR(64) UNIQUE` | `data-dictionary.md` `L100` |
| `PROP-04` | `OrganizationalDepartment` | `name_ar` / `name_en` | `NVARCHAR(150)` (`NOT NULL` / `NULL`) | **B** | Bilingual department names | `D-OWNER-REV-02,08` | `UNIQUE(name_ar)`; admin CRUD DTO | **Yes** | Confirm `name_en` optionality (`NULL`); **Confirm pre-freeze** | Keep `name_ar NOT NULL UNIQUE`, `name_en NULL` (`150`) | `data-dictionary.md` `L125` |
| `PROP-05` | `JobTitle` | `name_ar` / `name_en` | `NVARCHAR(150)` (`NOT NULL` / `NULL`) | **B** | Bilingual job title names | `D-OWNER-REV-02,09` | `UNIQUE(name_ar)`; admin CRUD DTO | **Yes** | Confirm `name_en` optionality (`NULL`); **Confirm pre-freeze** | Keep `name_ar NOT NULL UNIQUE`, `name_en NULL` (`150`) | `data-dictionary.md` `L127` |
| `PROP-06` | `MetroLine` | `name_ar` / `name_en` | `NVARCHAR(100)` (`NOT NULL` / `NULL`) | **C** | Metro line names (`5` initial values) | `CP-009` Erratum | `UNIQUE(name_ar)`; admin CRUD DTO | No | Values & CRUD approved; length is technical | Keep `NVARCHAR(100)` (`name_ar` required, `name_en` optional) | `data-dictionary.md` `L129` |
| `PROP-07` | `MaritalStatusCatalog` | `id` / `code` / `name_ar` / `name_en` | `BIGINT` / `NVARCHAR(32)` / `NVARCHAR(100)` | **B** | Marital status catalog & labels | `D-OWNER-REV-15,32`, `WP55-PT-02` | `BIGINT` PK settled; `UNIQUE(code, name_ar)` | **Yes** | Confirm `name_en` optionality & pre-launch seed list | Keep `BIGINT`, `code NVARCHAR(32)`, `name_ar/en NVARCHAR(100)` | `data-dictionary.md` `L130` |
| `PROP-08` | `MilitaryServiceStatusCatalog` | `id` / `code` / `name_ar` / `name_en` | `BIGINT` / `NVARCHAR(32)` / `NVARCHAR(100)` | **B** | Military-service status catalog | `D-OWNER-REV-15,26,32`, `WP55-PT-02` | `BIGINT` PK settled; `UNIQUE(code, name_ar)` | **Yes** | Confirm `name_en` optionality & supply seed values pre-launch | Keep `BIGINT`, `code NVARCHAR(32)`, `name_ar/en NVARCHAR(100)` | `data-dictionary.md` `L131` |
| `PROP-09` | `HistoricalServiceTrainingRecord` | `course_name` | `NVARCHAR(255) NOT NULL` | **C** | Historical course title | `D-OWNER-REV-16` | Non-empty check; user profile DTO | No | Requirement approved; length matches `Course.title` | Keep `NVARCHAR(255) NOT NULL` | `data-dictionary.md` `L141` |
| `PROP-10` | `HistoricalServiceTrainingRecord` | `providing_organization` | `NVARCHAR(255) NOT NULL` | **C** | External training provider name | `D-OWNER-REV-16` | Non-empty check; user profile DTO | No | Requirement approved; length is technical | Keep `NVARCHAR(255) NOT NULL` | `data-dictionary.md` `L142` |
| `PROP-11` | `HistoricalServiceTrainingRecord` | `completion_date` | `DATE NOT NULL` | **B** | Historical completion date | `D-OWNER-REV-16` | `NOT NULL` date validation in profile form | **Yes** | Confirm `completion_date` is strictly required (`NOT NULL`) | Keep `DATE NOT NULL` (or allow `NULL` if partial records exist) | `data-dictionary.md` `L143` |
| `PROP-12` | `HistoricalServiceTrainingRecord` | `certificate_info_or_notes` | `NVARCHAR(1000) NULL` | **C** | Optional cert ref / notes | `D-OWNER-REV-16` | Nullable text; user profile DTO | No | Optionality approved ("when applicable"); length technical | Keep `NVARCHAR(1000) NULL` | `data-dictionary.md` `L144` |
| `PROP-13` | `DepartmentTrack` | `id` / `department_code` | `NVARCHAR(64) PK` | **C** | Curriculum governance dept key | `domain-03`, `LDM` §7.2 | Natural string PK (`DEPT-...`); separate from HR dept | No | Case B separation approved; PK length is technical | Keep `NVARCHAR(64) PK` | `data-dictionary.md` `L149` |
| `PROP-14` | `DepartmentTrack` | `allowed_tracks_json` | `NVARCHAR(MAX) NOT NULL` | **C** | Permitted curriculum track IDs | `departmentTracksApi.ts` | `ISJSON() = 1` check; array DTO | No | Pure technical JSON storage | Keep `NVARCHAR(MAX) NOT NULL` + `ISJSON()` | `data-dictionary.md` `L150` |
| `PROP-15` | `PendingApprovalRequest` | `action_type` | `NVARCHAR(64) NOT NULL` | **C** | Deferred mutation discriminator | `domain-18`, `§5-03` | Enum/string validation in `202` DTO | No | Pure technical discriminator sizing | Keep `NVARCHAR(64) NOT NULL` | `data-dictionary.md` `L157` |
| `PROP-16` | `PendingApprovalRequest` | `requested_by_id` / `reviewed_by_id` / `executed_by_id` | `NVARCHAR(64)` (`NOT NULL` / `NULL`) | **C** | Requester/Reviewer/Executor IDs | `D-OWNER-REV-07`, `D-01`, `D-14` | Non-cascade snapshot surviving `D-01`; `D-14` masking | No | 3-role separation approved; non-FK string ID technical | Keep `NVARCHAR(64)` non-cascade snapshots | `data-dictionary.md` `L159` |
| `PROP-17` | `PendingApprovalRequest` | `reason` | `NVARCHAR(500) NULL` | **B** | Optional approval/rejection reason | `D-OWNER-REV-25`, `§5-02` | Nullable string in review DTO | **Yes** | Confirm `500`-char cap matches UI/operational expectation | Keep `NVARCHAR(500) NULL` | `data-dictionary.md` `L162` |
| `PROP-18` | `AuditLogEntry` | `actor_user_id` / `actor_role_snapshot` | `NVARCHAR(64) NULL` / `NVARCHAR(32) NOT NULL` | **C** | Actor identity & role snapshot | `D-01`, `D-14`, `D-OWNER-REV-24` | Non-cascade snapshot; audit log DTO | No | Self-contained snapshot rule approved; types technical | Keep `NVARCHAR(64) NULL` / `NVARCHAR(32) NOT NULL` | `data-dictionary.md` `L169` |
| `PROP-19` | `AuditLogEntry` | `is_developer_masked` | `BIT NOT NULL DEFAULT 0` | **C** | Flags `developer` entries for masking | `INV-R8`, `D-14` | `BIT` flag for `SYSTEM`/`النظام` projection | No | `INV-R8` masking approved; `BIT` column technical | Keep `BIT NOT NULL DEFAULT 0` | `data-dictionary.md` `L170` |
| `PROP-20` | `AuditLogEntry` | `action` / `target_entity_type` / `target_entity_id` | `NVARCHAR(64)` (`NOT NULL` / `NULL`) | **C** | Audited operation & target snapshot | `domain-18`, `D-OWNER-REV-24` | Non-FK target snapshot | No | Pure technical audit column sizing | Keep `NVARCHAR(64)` | `data-dictionary.md` `L171` |
| `PROP-21` | `AuditLogEntry` | `details_snapshot_json` / `reason` | `NVARCHAR(MAX)` / `NVARCHAR(500) NULL` | **B** | Audit diff JSON & optional reason | `D-OWNER-REV-24,25` | `ISJSON()` on details; nullable `reason` | **Yes** | Confirm `500`-char `reason` cap consistency with `PROP-17` | Keep `NVARCHAR(MAX) NULL` + `NVARCHAR(500) NULL` | `data-dictionary.md` `L172` |
| `PROP-22` | `Course` | `description` | `NVARCHAR(MAX) NULL` | **B** | Course overview / syllabus | `domain-04`, `D-SEC-01` | Sanitized HTML/text; course DTO | **Yes** | Confirm optionality (`NULL`) on `Draft` vs. publish | Keep `NVARCHAR(MAX) NULL` (enforce publish check in app if needed) | `data-dictionary.md` `L311` |
| `PROP-23` | `Course` | `lifecycle_status` | `NVARCHAR(20) NOT NULL CHECK` | **C** | `Draft`, `InReview`, `Published`, `Archived` | `domain-04,05,07` | `CHECK` constraint; catalog filter | No | Lifecycle states approved; `NVARCHAR(20)` technical | Keep `NVARCHAR(20) NOT NULL CHECK` | `data-dictionary.md` `L315` |
| `PROP-24` | `CourseDraft` | `title_snapshot` / `updated_at` / `updated_by_user_id` / `updated_by_tombstone_id` | `NVARCHAR(255)` / `DATETIMEOFFSET(7)` / `BIGINT` / `BIGINT` | **D** | Draft title & dual-ref XOR attribution | `domain-05`, `TR-C2-02`, `WP55-PT-05` | Dual-ref XOR + `DATETIMEOFFSET(7)` settled; `BIGINT`/`255` technical | No | Core rule & `WP55-PT-05` settled | Keep as mapped (`255` matches `Course.title`) | `data-dictionary.md` `L338` |
| `PROP-25` | `Module` | `sort_order` | `INT NOT NULL CHECK (>= 0)` | **C** | Module display sequence | `domain-06` | `INT >= 0` ordering | No | Pure technical ordering column | Keep `INT NOT NULL CHECK (sort_order >= 0)` | `data-dictionary.md` `L350` |
| `PROP-26` | `LessonItem` | `lesson_type` / `sort_order` | `NVARCHAR(32)` / `INT >= 0` | **C** | Lesson type enum & order | `domain-06,21` | Bounded type discriminator + `INT` | No | Types (`video`, `pdf`, `quiz`, `external_link`) technical | Keep `NVARCHAR(32)` / `INT` | `data-dictionary.md` `L354` |
| `PROP-27` | `QuizDefinition` | `questions_json` / `passing_score` | `NVARCHAR(MAX)` / `DECIMAL(5,2)` | **D** | Quiz payload & `%` pass threshold | `domain-06,14`, `WP55-PT-03` | `passing_score` settled (`WP55-PT-03`); `questions_json` `ISJSON()` | No | `passing_score` settled; JSON storage technical | Keep `NVARCHAR(MAX) + ISJSON()` & `DECIMAL(5,2)` | `data-dictionary.md` `L358` |
| `PROP-28` | `CourseReviewSubmission` | `review_status` / `submitted_at` / `decided_at` | `NVARCHAR(32)` / `DATETIMEOFFSET(7)` | **C** | Review state & timestamps | `domain-05,07`, `API-REC-02` | `CHECK` on status; `WP55-PT-05` timestamps | No | Workflow approved; column types technical | Keep `NVARCHAR(32)` + `DATETIMEOFFSET(7)` | `data-dictionary.md` `L369` |
| `PROP-29` | `StagedAdminEdit` | `id` / `submission_id` / `edit_payload_json` / `created_at` | `BIGINT` / `BIGINT` / `NVARCHAR(MAX)` / `DATETIMEOFFSET(7)` | **C** | Staged reviewer edits | `domain-05,07`, `D-OWNER-REV-31` | Retention & `NO ACTION` approved; `WP55-PT-05` timestamp | No | Indefinite retention approved; column types technical | Keep `BIGINT` + `NVARCHAR(MAX)` + `DATETIMEOFFSET(7)` | `data-dictionary.md` `L370` |
| `PROP-30` | `WorkingNote` | `id` / `submission_id` / `note_body` / `created_at` | `BIGINT` / `BIGINT` / `NVARCHAR(MAX)` / `DATETIMEOFFSET(7)` | **C** | Internal review working notes | `domain-05,07`, `D-OWNER-REV-31` | Retention & `NO ACTION` approved; `WP55-PT-05` timestamp | No | Indefinite retention approved; column types technical | Keep `BIGINT` + `NVARCHAR(MAX)` + `DATETIMEOFFSET(7)` | `data-dictionary.md` `L371` |
| `PROP-31` | `CourseComment` | `body` / `created_at` | `NVARCHAR(MAX)` / `DATETIMEOFFSET(7)` | **C** | Sanitized comment text & timestamp | `domain-06`, `D-SEC-01` | `D-SEC-01` sanitization; `WP55-PT-05` timestamp | No | Pure technical storage | Keep `NVARCHAR(MAX)` + `DATETIMEOFFSET(7)` | `data-dictionary.md` `L380` |
| `PROP-32` | `CourseCommentReport` | `id` / `comment_id` / `reporter_user_id` / `status` / `created_at` | `BIGINT` / `BIGINT` / `BIGINT` (`NULL` on `D-01`) / `NVARCHAR(32)` / `DATETIMEOFFSET(7)` | **A** | Comment moderation report | `domain-06,18`, `DD` `L581` | `ON DELETE NO ACTION`; `reporter_user_id = NULL` on `D-01` **`SETTLED — PREVIOUSLY OWNER-APPROVED UNDER D-01`** (`DD` `L581`) | **Yes** *(status only)* | Confirm moderation `status` enum (`Pending`, `Resolved`, `Dismissed` — not in `domain-06`/`OpenAPI`) | Keep `Pending`/`Resolved`/`Dismissed` (`NVARCHAR(32) CHECK`) + settled `reporter_user_id = NULL` on `D-01` | `data-dictionary.md` `L382`, `L581`; `PSLR` `L112` |
| `PROP-33` | `MediaContentReference` | `is_visible` | `BIT NOT NULL` | **E** | Immediate visibility toggle | `INV-DOM21-13..15`, `A-03c` | `BIT` column; `A-03c-1`–`3` state/restore unresolved | **Conditional** | Core rule approved, but `A-03c-1`–`3` deferred | Keep `BIT NOT NULL`; resolve `A-03c-1`–`3` separately | `data-dictionary.md` `L396` |
| `PROP-34` | `TrainingGroup` | `auto_renewal_enabled` / `interval_days` / `deadline_datetime` / `next_scheduled_renewal_date` | `BIT` / `INT` / `DATETIMEOFFSET(7)` | **D** | Renewal schedule configuration | `D-GRP-02`, `INV-DOM10-10`, `CURRENT.md` `L97` | `CHECK (1..730)`; `WP55-PT-05` timestamps | No | All business rules & `WP55-PT-05` settled | Keep as mapped | `data-dictionary.md` `L475` |
| `PROP-35` | `GroupAssistantAssignment` | `id` / `training_group_id` / `user_id` / `assignment_role` | `BIGINT`x3 / `NVARCHAR(32)` | **C** | Group-scoped assistant assignment | `domain-03,08`, `A-03c` | `UNIQUE(group, user, role)`; `NO ACTION` | No | Separation rule approved; column types technical | Keep `BIGINT` + `NVARCHAR(32)` | `data-dictionary.md` `L476` |
| `PROP-36` | `GroupQrCode` | `id` / `training_group_id` / `token_hash` / `is_enabled` / `updated_at` | `BIGINT`x2 / `VARBINARY(32)` / `BIT` / `DATETIMEOFFSET(7)` | **D** | Single mutable QR join token | `TR-C3-01`, `WP55-PT-04`, `WP55-PT-05` | Option B, `VARBINARY(32)`, `DATETIMEOFFSET(7)` settled | No | Core design settled by `TR-C3-01` & `WP55-PT-04/05` | Keep as mapped (`BIGINT`/`BIT` technical) | `data-dictionary.md` `L486` |
| `PROP-37` | `GroupJoinRequest` | `id` / `training_group_id` / `user_id` / `request_status` / `requested_at` / `decided_at` | `BIGINT`x3 / `NVARCHAR(20)` / `DATETIMEOFFSET(7)`x2 | **A** | Pending QR/join approval request | `domain-09`, `groupHandlers.ts`, `D-01` | `CHECK` on `Pending`/`Approved`/`Rejected`; `D-01` cleanup | **Yes** | Confirm whether rejected users can re-request join | Keep `Pending`/`Approved`/`Rejected` + `D-01` cleanup | `data-dictionary.md` `L487` |
| `PROP-38` | `GroupResource` | `id` / `training_group_id` / `provider` / `title` / `meeting_url` | `BIGINT`x2 / `NVARCHAR(20)` / `255` / `2048` | **C** | Online meeting link | `domain-16`, `INV-DOM16-03` | `title`/`meeting_url` lengths approved; `provider` `CHECK` | No | `provider` enum & `BIGINT` are technical | Keep `NVARCHAR(20) CHECK` + `BIGINT` | `data-dictionary.md` `L488` |
| `PROP-39` | `EnrollmentSourceGrant` | `id` / `enrollment_id` / `source_type` / `training_group_id` | `BIGINT`x2 / `NVARCHAR(20)` / `BIGINT NULL` | **C** | Enrollment provenance grant | `domain-11`, `D-07`, `MFR-41` | `CHECK` on `direct`/`group`/`self:continued` | No | Provenance rule approved; column types technical | Keep `BIGINT` + `NVARCHAR(20)` | `data-dictionary.md` `L494` |
| `PROP-40` | `LessonProgress` | `id` / `course_attempt_id` / `lesson_item_id` / `is_completed` / `progress_percent` / `updated_at` | `BIGINT`x3 / `BIT` / `DECIMAL(5,2)` / `DATETIMEOFFSET(7)` | **A** | Per-lesson completion & playback | `domain-14`, `LLD-004`, `D-12` | `UNIQUE(attempt, lesson)`; `DECIMAL(5,2)` | **Yes** | Confirm persisting `progress_percent` vs. `is_completed` only | Keep `DECIMAL(5,2)` (`0.00–100.00`) + `BIT` | `data-dictionary.md` `L496` |
| `PROP-41` | `NotificationItem` | `id` / `user_id` / `title` / `body` / `is_read` / `created_at` | `BIGINT`x2 / `255` / `MAX` / `BIT` / `DATETIMEOFFSET(7)` | **C** | User-targeted notification | `domain-19`, `D-08`, `D-01` | `title` & `D-01` approved; `WP55-PT-05` timestamp | No | Remaining column types (`BIT`/`MAX`/`BIGINT`) technical | Keep as mapped | `data-dictionary.md` `L502` |
| `PROP-42` | `UserWhatsAppVisibility` | `id` / `user_id` / `scenario_key` / `is_visible` | `BIGINT`x2 / `NVARCHAR(64)` / `BIT` | **C** | Per-user support scenario visibility | `domain-19`, `D-09`, `D-01` | `UNIQUE(user_id, scenario_key)`; `D-01` cleanup | No | `D-01` rule approved; column types technical | Keep `BIGINT` + `NVARCHAR(64)` + `BIT` | `data-dictionary.md` `L504` |
| `PROP-43` | `ScheduledJob` | `id` / `job_key` / `schedule_config` / `timezone` / `is_enabled` | `BIGINT` / `100` / `255` / `64` / `BIT` | **E** | Background job definition | `domain-20`, `TR-C3-04` | `UNIQUE(job_key)`; `Domain 20 / D4` 6h Task Scheduler | **Conditional** | General scheduler tech remains `OPEN` (`TR-C3-04`) | Keep schema for `Domain 20 / D4`; keep general tech `OPEN` | `data-dictionary.md` `L505` |
| `PROP-44` | `ScheduledJobRun` | `id` / `job_id` / `idempotency_key` / `status` / `retry_count` / `started_at` / `completed_at` / `error_message` / `details_json` | `BIGINT`x2 / `128` / `20` / `INT` / `DATETIMEOFFSET(7)`x2 / `MAX`x2 | **E** | Job execution log (12m retention) | `domain-20`, `TR-C3-04` | `UNIQUE(idempotency_key)`; `retry_count 0..2`; `WP55-PT-05` | **Conditional** | Post-12m archive/delete mechanics remain `OPEN` (`TR-C3-04`) | Keep schema; keep post-12m archive mechanics `OPEN` | `data-dictionary.md` `L506` |

---

## 6. All `88` String-Length Entries (`STR-01`–`STR-88` — `OR-DB-02` `OWNER-APPROVED` `2026-11-16`)

*Note: `STR-36` (`PendingApprovalRequest.id`) and `STR-72` (`GroupQrCode.token_hash`) are **Class D (Superseded by `WP55-PT-01` / `WP55-PT-04`)**. `STR-45` (`PendingApprovalRequest.reason` = `500`) and `STR-52` (`AuditLogEntry.reason` = `500`) were previously `OWNER-APPROVED` via `OD-PF-08` (preserved, not reopened). All remaining **`84` active `STR` string lengths** are **`OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`** (scoped strictly to string length / `NVARCHAR(n)` or `NVARCHAR(MAX)` selection only; `0` remaining `OR-DB-02` items pending).*

| Review ID | Entity | Field | Current DD Type | Rec Length | Django Mapping | Data Characteristics & Usage | Risk of Wrong Sizing | Class | Source Ref |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| `STR-01` | `User` | `phone_e164` | `NVARCHAR(16)` | `16` | `CharField(max_length=16)` | Egyptian E.164 (`+201...`, 13 chars; ITU max 15 digits + `+`) | Truncation if `<15`; index bloat if oversized | **C** | `DD` `L63`, `PSLR` `L46` |
| `STR-02` | `User` | `password_hash` | `NVARCHAR(255)` | `255` | `CharField(max_length=255)` | Django 5.2 default is `128`; `255` provides headroom for anticipated hashers without guaranteeing every future algorithm | Auth failure if `<128` | **C** | `DD` `L64`, `PSLR` `L47` |
| `STR-03` | `User` | `role` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | 6-tier enum (`assistant_admin` 15 chars); filtered `UNIQUE` | Truncation on future role slug if `<20` | **C** | `DD` `L65`, `PSLR` `L48` |
| `STR-04` | `User` | `status` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | `Active`, `Suspended` (`CHECK`-constrained) | Low; bounded enum | **C** | `DD` `L66`, `PSLR` `L49` |
| `STR-05` | `User` | `national_id` | `NVARCHAR(14)` | `14` | `CharField(max_length=14)` | `UNIQUE` 14-digit Egyptian National ID (Egypt-only rule; preserves leading `0`) | Truncation if `<14` | **C** | `DD` `L68`, `PSLR` `L50` |
| `STR-06` | `User` | `email` | `NVARCHAR(254)` | `254` | `EmailField(max_length=254)` | RFC 5321 max email; filtered `UNIQUE` | Rejects valid RFC emails if `<254` | **C** | `DD` `L77`, `PSLR` `L51` |
| `STR-07` | `ServerSession` | `session_key` | `NVARCHAR(40)` | `40` | `CharField(max_length=40)` | `PK`; Django `django_session.session_key` (`40` chars) | Breaks Django session store if `<40` | **C** | `DD` `L85`, `PSLR` `L52` |
| `STR-08` | `ServerSession` | `session_data` | `NVARCHAR(MAX)` | `MAX` | `TextField()` | Serialized Django session payload; unbounded | Session corruption if bounded | **C** | `DD` `L86`, `PSLR` `L53` |
| `STR-09` | `DeletedUserTombstone` | `canonical_user_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | `UNIQUE` stringified canonical/legacy user ID | Collision/truncation if `<36` | **C** | `DD` `L94`, `PSLR` `L54` |
| `STR-10` | `DeletedUserTombstone` | `deleted_by_actor_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Non-FK actor ID snapshot matching `canonical_user_id` | Truncation if `<64` | **C** | `DD` `L96`, `PSLR` `L55` |
| `STR-11` | `DeletedUserAlias` | `alias_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | `UNIQUE` legacy alias ID; O(1) lookup | Truncation of legacy IDs if `<64` | **C** | `DD` `L100`, `PSLR` `L56` |
| `STR-12` | `RolePolicy` | `role_key` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | `PK`; matches `User.role` | Mismatch with `User.role` if different | **C** | `DD` `L105`, `PSLR` `L57` |
| `STR-13` | `RolePolicy` | `default_capabilities_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | JSON array of capability keys (`ISJSON()=1`) | Truncates capability JSON if bounded | **C** | `DD` `L106`, `PSLR` `L58` |
| `STR-14` | `RolePolicy` | `updated_by` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Non-FK actor ID snapshot | Truncation if `<64` | **C** | `DD` `L107`, `PSLR` `L59` |
| `STR-15` | `UserPermissionOverride` | `granted_capabilities_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | JSON capability array (`ISJSON()=1`) | JSON truncation if bounded | **C** | `DD` `L112`, `PSLR` `L60` |
| `STR-16` | `UserPermissionOverride` | `denied_capabilities_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | JSON capability array (`ISJSON()=1`) | JSON truncation if bounded | **C** | `DD` `L113`, `PSLR` `L61` |
| `STR-17` | `DelegatedAuthority` | `capability_key` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | Indexed dot-notation capability key (`materials.manage_references`) | Truncation of long keys if `<64` | **C** | `DD` `L116`, `PSLR` `L62` |
| `STR-18` | `OrganizationalDepartment` | `name_ar` | `NVARCHAR(150)` | `150` | `CharField(max_length=150)` | `UNIQUE` Arabic department name | Arabic title truncation if `<100` | **C** | `DD` `L125`, `PSLR` `L63` |
| `STR-19` | `OrganizationalDepartment` | `name_en` | `NVARCHAR(150)` | `150` | `CharField(max_length=150)` | Optional English department name | English title truncation if `<100` | **C** | `DD` `L125`, `PSLR` `L64` |
| `STR-20` | `JobTitle` | `name_ar` | `NVARCHAR(150)` | `150` | `CharField(max_length=150)` | `UNIQUE` Arabic job title | Arabic title truncation if `<100` | **C** | `DD` `L127`, `PSLR` `L65` |
| `STR-21` | `JobTitle` | `name_en` | `NVARCHAR(150)` | `150` | `CharField(max_length=150)` | Optional English job title | English title truncation if `<100` | **C** | `DD` `L127`, `PSLR` `L66` |
| `STR-22` | `MetroLine` | `name_ar` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | `UNIQUE` Arabic metro line name | Low; short transit names | **C** | `DD` `L129`, `PSLR` `L67` |
| `STR-23` | `MetroLine` | `name_en` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | Optional English metro line name | Low | **C** | `DD` `L129`, `PSLR` `L68` |
| `STR-24` | `MaritalStatusCatalog` | `code` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | `UNIQUE` catalog slug (`single`, `married`) | Low | **C** | `DD` `L130`, `PSLR` `L69` |
| `STR-25` | `MaritalStatusCatalog` | `name_ar` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | `UNIQUE` Arabic label | Low | **C** | `DD` `L130`, `PSLR` `L70` |
| `STR-26` | `MaritalStatusCatalog` | `name_en` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | Optional English label | Low | **C** | `DD` `L130`, `PSLR` `L71` |
| `STR-27` | `MilitaryServiceStatusCatalog` | `code` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | `UNIQUE` catalog slug | Low | **C** | `DD` `L131`, `PSLR` `L72` |
| `STR-28` | `MilitaryServiceStatusCatalog` | `name_ar` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | `UNIQUE` Arabic label | Low | **C** | `DD` `L131`, `PSLR` `L73` |
| `STR-29` | `MilitaryServiceStatusCatalog` | `name_en` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | Optional English label | Low | **C** | `DD` `L131`, `PSLR` `L74` |
| `STR-30` | `HistoricalServiceTrainingRecord` | `course_name` | `NVARCHAR(255)` | `255` | `CharField(max_length=255)` | Matches `Course.title` (`255`) | Truncation vs. `Course.title` if `<255` | **C** | `DD` `L141`, `PSLR` `L75` |
| `STR-31` | `HistoricalServiceTrainingRecord` | `providing_organization` | `NVARCHAR(255)` | `255` | `CharField(max_length=255)` | Arabic/English external training provider | Truncation of long org names if `<150` | **C** | `DD` `L142`, `PSLR` `L76` |
| `STR-32` | `HistoricalServiceTrainingRecord` | `certificate_info_or_notes` | `NVARCHAR(1000)` | `1000` | `CharField(max_length=1000)` | Optional notes/cert ref; matches `DeletedUserTombstone.reason` | Truncation if `<500` | **C** | `DD` `L144`, `PSLR` `L77` |
| `STR-33` | `DepartmentTrack` | `department_code` | `NVARCHAR(64)` | `64` | `CharField(max_length=64, primary_key=True)` | `PK` (`DepartmentTrack` Option A); short dept governance code (`DEPT-...`) | Truncation if `<32` | **C** | `DD` `L149`, `PSLR` `L78` |
| `STR-34` | `DepartmentTrack` | `allowed_tracks_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | JSON array of track IDs (`ISJSON()=1`) | JSON truncation if bounded | **C** | `DD` `L150`, `PSLR` `L79` |
| `STR-35` | `DepartmentTrack` | `updated_by` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Non-FK actor ID snapshot | Truncation if `<64` | **C** | `DD` `L151`, `PSLR` `L80` |
| `STR-36` | `PendingApprovalRequest` | `id` | `UNIQUEIDENTIFIER` | `—` | `UUIDField(primary_key=True)` | **Superseded by `WP55-PT-01`** (was `NVARCHAR(64)`) | N/A (`WP55-PT-01` settled) | **D** | `DD` `L156`, `PSLR` `L81` |
| `STR-37` | `PendingApprovalRequest` | `action_type` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Bounded action discriminator (`enrollment_remove`) | Truncation if `<32` | **C** | `DD` `L157`, `PSLR` `L82` |
| `STR-38` | `PendingApprovalRequest` | `execution_status` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | Bounded 6-state enum (`ExecutionFailed` = 15 chars) | Low | **C** | `DD` `L158`, `PSLR` `L83` |
| `STR-39` | `PendingApprovalRequest` | `requested_by_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Non-FK actor snapshot surviving `D-01` | Truncation if `<64` | **C** | `DD` `L159`, `PSLR` `L84` |
| `STR-40` | `PendingApprovalRequest` | `reviewed_by_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Non-FK actor snapshot surviving `D-01` | Truncation if `<64` | **C** | `DD` `L159`, `PSLR` `L85` |
| `STR-41` | `PendingApprovalRequest` | `executed_by_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Non-FK actor snapshot surviving `D-01` | Truncation if `<64` | **C** | `DD` `L159`, `PSLR` `L86` |
| `STR-42` | `PendingApprovalRequest` | `target_entity_type` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Composite indexed entity discriminator | Truncation of entity names if `<40` | **C** | `DD` `L160`, `PSLR` `L87` |
| `STR-43` | `PendingApprovalRequest` | `target_entity_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Composite indexed polymorphic entity ID | Truncation if `<36` | **C** | `DD` `L160`, `PSLR` `L88` |
| `STR-44` | `PendingApprovalRequest` | `payload_snapshot_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | Immutable request payload JSON (`ISJSON()=1`) | JSON truncation if bounded | **C** | `DD` `L161`, `PSLR` `L89` |
| `STR-45` | `PendingApprovalRequest` | `reason` | `NVARCHAR(500)` | `500` | `CharField(max_length=500)` | Matches `CourseCommentReport.reason` (`500`) | Truncation of Arabic justification if `<255` | **C** | `DD` `L162`, `PSLR` `L90` |
| `STR-46` | `AuditLogEntry` | `actor_user_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Non-FK actor snapshot surviving `D-01` | Truncation if `<64` | **C** | `DD` `L169`, `PSLR` `L91` |
| `STR-47` | `AuditLogEntry` | `actor_role_snapshot` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | Matches `User.role` (`32`) | Mismatch with `User.role` | **C** | `DD` `L169`, `PSLR` `L92` |
| `STR-48` | `AuditLogEntry` | `action` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Bounded audit event key | Truncation if `<32` | **C** | `DD` `L171`, `PSLR` `L93` |
| `STR-49` | `AuditLogEntry` | `target_entity_type` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Bounded target entity name | Truncation if `<40` | **C** | `DD` `L171`, `PSLR` `L94` |
| `STR-50` | `AuditLogEntry` | `target_entity_id` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Bounded target entity ID snapshot | Truncation if `<36` | **C** | `DD` `L171`, `PSLR` `L95` |
| `STR-51` | `AuditLogEntry` | `details_snapshot_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | Self-contained audit diff JSON (`ISJSON()=1`) | JSON truncation if bounded | **C** | `DD` `L172`, `PSLR` `L96` |
| `STR-52` | `AuditLogEntry` | `reason` | `NVARCHAR(500)` | `500` | `CharField(max_length=500)` | Matches `PendingApprovalRequest.reason` (`500`) | Truncation if `<255` | **C** | `DD` `L172`, `PSLR` `L97` |
| `STR-53` | `Course` | `description` | `NVARCHAR(MAX)` | `MAX` | `TextField()` | Rich Arabic/English syllabus; unbounded | Truncates course overview if bounded | **C** | `DD` `L311`, `PSLR` `L102` |
| `STR-54` | `Course` | `course_type` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | Bounded enum (`main`, `reminder`) | Low | **C** | `DD` `L313`, `PSLR` `L103` |
| `STR-55` | `Course` | `lifecycle_status` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | `Draft`, `InReview`, `Published`, `Archived` | Low | **C** | `DD` `L315`, `PSLR` `L104` |
| `STR-56` | `CourseDraft` | `title_snapshot` | `NVARCHAR(255)` | `255` | `CharField(max_length=255)` | Matches `Course.title` (`255` `OWNER-APPROVED`) | Truncation vs. `Course.title` if `<255` | **C** | `DD` `L338`, `PSLR` `L105` |
| `STR-57` | `LessonItem` | `lesson_type` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | Bounded enum (`video`, `pdf`, `quiz`, `external_link`) | Low | **C** | `DD` `L354`, `PSLR` `L106` |
| `STR-58` | `QuizDefinition` | `questions_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | Multi-question Arabic/English quiz JSON (`ISJSON()=1`) | Truncates multi-question quizzes if bounded | **C** | `DD` `L358`, `PSLR` `L107` |
| `STR-59` | `CourseReviewSubmission` | `review_status` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | Bounded review enum (`Pending`, `Approved`, `Returned`, `Rejected`) | Low | **C** | `DD` `L369`, `PSLR` `L108` |
| `STR-60` | `StagedAdminEdit` | `edit_payload_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | Staged diff JSON (`ISJSON()=1`) | JSON truncation if bounded | **C** | `DD` `L370`, `PSLR` `L109` |
| `STR-61` | `WorkingNote` | `note_body` | `NVARCHAR(MAX)` | `MAX` | `TextField()` | Free-form reviewer notes; unbounded | Truncation if bounded | **C** | `DD` `L371`, `PSLR` `L110` |
| `STR-62` | `CourseComment` | `body` | `NVARCHAR(MAX)` | `MAX` | `TextField()` | Sanitized discussion comment; unbounded | Truncation if bounded | **C** | `DD` `L380`, `PSLR` `L111` |
| `STR-63` | `CourseCommentReport` | `status` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | Bounded moderation status (`Pending`, `Resolved`, `Dismissed`) | Low | **C** | `DD` `L382`, `PSLR` `L112` |
| `STR-64` | `MediaAsset` | `storage_key` | `NVARCHAR(512)` | `512` | `CharField(max_length=512)` | `UNIQUE` storage key (`1024` bytes <= `1700`-byte SQL index limit) | Index limit exceeded if `>850`; truncation if `<256` | **C** | `DD` `L388`, `PSLR` `L113` |
| `STR-65` | `MediaAsset` | `file_name` | `NVARCHAR(255)` | `255` | `CharField(max_length=255)` | Standard OS/HTTP filename limit | Truncation of Arabic filenames if `<255` | **C** | `DD` `L389`, `PSLR` `L114` |
| `STR-66` | `MediaAsset` | `mime_type` | `NVARCHAR(127)` | `127` | `CharField(max_length=127)` | Validated `type/subtype` only (excl. HTTP params); project allowlist limit (incl. OpenXML presentation type), not RFC 6838 max | Rejects long allowlisted MIME types if `<127` | **C** | `DD` `L390`, `PSLR` `L115` |
| `STR-67` | `MediaAsset` | `sha256_checksum` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Indexed exact `64`-char hex `SHA-256` digest | Breaks checksum if `<64` | **C** | `DD` `L390`, `PSLR` `L116` |
| `STR-68` | `TrainingGroup` | `group_type` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | Bounded enum (`regular`, `reminder`) | Low | **C** | `DD` `L474`, `PSLR` `L121` |
| `STR-69` | `GroupAssistantAssignment` | `assignment_role` | `NVARCHAR(32)` | `32` | `CharField(max_length=32)` | Part of `UNIQUE(group, user, role)` | Low | **C** | `DD` `L476`, `PSLR` `L122` |
| `STR-70` | `GroupRenewalCycle` | `cycle_code` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Generated `CYC-<groupId>-<NN>` | Low | **C** | `DD` `L478`, `PSLR` `L123` |
| `STR-71` | `GroupRenewalCycle` | `cycle_status` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | 5-state enum (`Scheduled`, `Active`, `Completed`, `Expired`, `Cancelled`) | Low | **C** | `DD` `L479`, `PSLR` `L124` |
| `STR-72` | `GroupQrCode` | `token_hash` | `VARBINARY(32)` | `—` | `BinaryField(max_length=32)` | **Superseded by `WP55-PT-04`** (was `NVARCHAR(128)`) | N/A (`WP55-PT-04` settled) | **D** | `DD` `L486`, `PSLR` `L125` |
| `STR-73` | `GroupJoinRequest` | `request_status` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | `Pending`, `Approved`, `Rejected` | Low | **C** | `DD` `L487`, `PSLR` `L126` |
| `STR-74` | `GroupResource` | `provider` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | `teams`, `zoom`, `meet`, `other` | Low | **C** | `DD` `L488`, `PSLR` `L127` |
| `STR-75` | `EnrollmentSourceGrant` | `source_type` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | `direct`, `group`, `self:continued` | Low | **C** | `DD` `L494`, `PSLR` `L128` |
| `STR-76` | `CertificateRecord` | `certificate_serial` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | `UNIQUE` certificate serial | Truncation if `<32` | **C** | `DD` `L497`, `PSLR` `L129` |
| `STR-77` | `CertificateRecord` | `recipient_name_snapshot` | `NVARCHAR(200)` | `200` | `CharField(max_length=200)` | Matches `User.full_name` (`200` `OWNER-APPROVED`) | Snapshot truncation if `<200` | **C** | `DD` `L497`, `PSLR` `L130` |
| `STR-78` | `CertificateRecord` | `course_title_snapshot` | `NVARCHAR(255)` | `255` | `CharField(max_length=255)` | Matches `Course.title` (`255` `OWNER-APPROVED`) | Snapshot truncation if `<255` | **C** | `DD` `L497`, `PSLR` `L131` |
| `STR-79` | `NotificationItem` | `body` | `NVARCHAR(MAX)` | `MAX` | `TextField()` | Variable-length Arabic/English notification body | Truncates long notifications if bounded | **C** | `DD` `L502`, `PSLR` `L132` |
| `STR-80` | `WhatsAppContact` | `phone_e164` | `NVARCHAR(16)` | `16` | `CharField(max_length=16)` | Matches `User.phone_e164` (`16`) | Truncation if `<15` | **C** | `DD` `L503`, `PSLR` `L133` |
| `STR-81` | `UserWhatsAppVisibility` | `scenario_key` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | Part of `UNIQUE(user_id, scenario_key)` | Truncation if `<32` | **C** | `DD` `L504`, `PSLR` `L134` |
| `STR-82` | `ScheduledJob` | `job_key` | `NVARCHAR(100)` | `100` | `CharField(max_length=100)` | `UNIQUE` job key (`process_due_group_renewals` = 26 chars) | Low | **C** | `DD` `L505`, `PSLR` `L135` |
| `STR-83` | `ScheduledJob` | `schedule_config` | `NVARCHAR(255)` | `255` | `CharField(max_length=255)` | Cron/interval expression | Low | **C** | `DD` `L505`, `PSLR` `L136` |
| `STR-84` | `ScheduledJob` | `timezone` | `NVARCHAR(64)` | `64` | `CharField(max_length=64)` | IANA timezone (`Africa/Cairo` = 12 chars) | Low | **C** | `DD` `L505`, `PSLR` `L137` |
| `STR-85` | `ScheduledJobRun` | `idempotency_key` | `NVARCHAR(128)` | `128` | `CharField(max_length=128)` | `UNIQUE` occurrence key (`job_key:window_iso`) | Truncation of composite key if `<64` | **C** | `DD` `L506`, `PSLR` `L138` |
| `STR-86` | `ScheduledJobRun` | `status` | `NVARCHAR(20)` | `20` | `CharField(max_length=20)` | `Pending`, `Running`, `Succeeded`, `Failed`, `Skipped` | Low | **C** | `DD` `L506`, `PSLR` `L139` |
| `STR-87` | `ScheduledJobRun` | `error_message` | `NVARCHAR(MAX)` | `MAX` | `TextField()` | Stack trace / failure diagnostic | Truncates diagnostics if bounded | **C** | `DD` `L506`, `PSLR` `L140` |
| `STR-88` | `ScheduledJobRun` | `details_json` | `NVARCHAR(MAX)` | `MAX` | `JSONField()` | Structured retry attempt history JSON (`ISJSON()=1`) | Truncates retry history if bounded | **C** | `DD` `L506`, `PSLR` `L141` |

---

## 7. Consolidated Unique Entity / Field Register & Cross-Reference (`157` Unique Fields)

Because `57` individual `Entity.Field` items appear in **both** `PROP-01`–`PROP-44` and `STR-01`–`STR-88`, deduplicating them prevents asking the Owner duplicate questions. Each overlapping field preserves both its **Mapping Approval** (`PROP-xx`) and **String-Length Recommendation** (`STR-xx`) dimensions:

- **Overlapping Fields (`57` `Entity.Field` items):**
  - `AuditLogEntry` (`7`): `action` (`PROP-20`/`STR-48`), `actor_role_snapshot` (`PROP-18`/`STR-47`), `actor_user_id` (`PROP-18`/`STR-46`), `details_snapshot_json` (`PROP-21`/`STR-51`), `reason` (`PROP-21`/`STR-52`), `target_entity_id` (`PROP-20`/`STR-50`), `target_entity_type` (`PROP-20`/`STR-49`).
  - `Course` (`2`): `description` (`PROP-22`/`STR-53`), `lifecycle_status` (`PROP-23`/`STR-55`).
  - `CourseComment` (`1`): `body` (`PROP-31`/`STR-62`); `CourseCommentReport` (`1`): `status` (`PROP-32`/`STR-63`).
  - `CourseDraft` (`1`): `title_snapshot` (`PROP-24`/`STR-56`); `CourseReviewSubmission` (`1`): `review_status` (`PROP-28`/`STR-59`).
  - `DeletedUserAlias` (`1`): `alias_id` (`PROP-03`/`STR-11`); `DeletedUserTombstone` (`1`): `canonical_user_id` (`PROP-02`/`STR-09`).
  - `DepartmentTrack` (`3`): `id`, `department_code` (`PROP-13`/`STR-33`), `allowed_tracks_json` (`PROP-14`/`STR-34`).
  - `EnrollmentSourceGrant` (`1`): `source_type` (`PROP-39`/`STR-75`); `GroupAssistantAssignment` (`1`): `assignment_role` (`PROP-35`/`STR-69`); `GroupJoinRequest` (`1`): `request_status` (`PROP-37`/`STR-73`); `GroupQrCode` (`1`): `token_hash` (`PROP-36`/`STR-72`, superseded by `WP55-PT-04`); `GroupResource` (`1`): `provider` (`PROP-38`/`STR-74`).
  - `HistoricalServiceTrainingRecord` (`3`): `course_name` (`PROP-09`/`STR-30`), `providing_organization` (`PROP-10`/`STR-31`), `certificate_info_or_notes` (`PROP-12`/`STR-32`).
  - `JobTitle` (`2`): `name_ar` (`PROP-05`/`STR-20`), `name_en` (`PROP-05`/`STR-21`); `OrganizationalDepartment` (`2`): `name_ar` (`PROP-04`/`STR-18`), `name_en` (`PROP-04`/`STR-19`).
  - `MaritalStatusCatalog` (`3`): `code`, `name_ar`, `name_en` (`PROP-07`/`STR-24..26`); `MetroLine` (`2`): `name_ar`, `name_en` (`PROP-06`/`STR-22..23`); `MilitaryServiceStatusCatalog` (`3`): `code`, `name_ar`, `name_en` (`PROP-08`/`STR-27..29`).
  - `LessonItem` (`1`): `lesson_type` (`PROP-26`/`STR-57`); `NotificationItem` (`1`): `body` (`PROP-41`/`STR-79`); `QuizDefinition` (`1`): `questions_json` (`PROP-27`/`STR-58`); `StagedAdminEdit` (`1`): `edit_payload_json` (`PROP-29`/`STR-60`); `WorkingNote` (`1`): `note_body` (`PROP-30`/`STR-61`).
  - `PendingApprovalRequest` (`5`): `action_type` (`PROP-15`/`STR-37`), `requested_by_id`, `reviewed_by_id`, `executed_by_id` (`PROP-16`/`STR-39..41`), `reason` (`PROP-17`/`STR-45`).
  - `ScheduledJob` (`3`): `job_key`, `schedule_config`, `timezone` (`PROP-43`/`STR-82..84`); `ScheduledJobRun` (`4`): `idempotency_key`, `status`, `error_message`, `details_json` (`PROP-44`/`STR-85..88`).
  - `User` (`1`): `email` (`PROP-01`/`STR-06`); `UserWhatsAppVisibility` (`1`): `scenario_key` (`PROP-42`/`STR-81`).
- **`PROP`-Only Fields (`68` fields):** Non-string / timestamp / `BIT` / `BIGINT` / `DECIMAL` / `DATE` / `INT` fields in `PROP-01`–`PROP-44` (e.g., `sort_order`, `is_developer_masked`, `is_visible`, `completion_date`, `progress_percent`, `id`s, `created_at`/`updated_at`).
- **`STR`-Only Fields (`32` fields):** `STR` entries whose mapping rows are already `TECHNICAL-RECOMMENDATION` or `OWNER-APPROVED` without `PROPOSED` tags (e.g., `User.phone_e164`, `User.national_id`, `ServerSession.*`, `MediaAsset.*`, `CertificateRecord.*`, `PendingApprovalRequest.id` [superseded]).

---

## 8. Deduplication and Cross-Reference Results

| Metric | Count | Verification Basis |
| :--- | :---: | :--- |
| **Original `PROPOSED` mapping rows (`PROP-01`–`PROP-44`)** | **`44`** | `data-dictionary.md` `## 2.`, `## 5.`, `## 8.` (`125` expanded `Entity.Field` items) |
| **Original string-length entries (`STR-01`–`STR-88`)** | **`88`** | `physical-string-length-recommendations.md` `§3` (`89` expanded `Entity.Field` items; `86` active after `WP55-PT-01`/`04`) |
| **Overlapping `Entity.Field` references** | **`57`** | Present in both `PROP-01`–`PROP-44` and `STR-01`–`STR-88` |
| **Unique `Entity.Field` combinations** | **`157`** | `125 + 89 - 57 = 157` |
| **Duplicate references within either source** | **`0` / `0`** | `0` duplicates inside `PROP-01`–`PROP-44` (`125` expanded); `0` duplicates inside `STR-01`–`STR-88` (`89` expanded) |
| **Unmatched / superseded string entries** | **`2`** | `STR-36` (`PendingApprovalRequest.id` -> `WP55-PT-01`) & `STR-72` (`GroupQrCode.token_hash` -> `WP55-PT-04`) |
| **Rows requiring direct Owner input (`Category A + B`)** | **`12` rows** | `4` Business Decisions (`A`, with `OD-PF-03` narrowed to `status` only) + `8` Owner Field Confirmations (`B`) |
| **Items suitable for Technical Recommendation (`Category C`)** | **`25` `PROP` rows + `86` active `STR` entries** | Grounded technical types/lengths (`0` insufficient-evidence items) |
| **Items Already Settled (`Category D`)** | **`4` `PROP` rows + `2` `STR` entries** | Core rules/types settled (`WP55-PT-01/03/04/05`, `TR-C2-02`, `TR-C3-01`) |
| **Items Deferred / Blocked (`Category E`)** | **`3` `PROP` rows** (+ `InPersonAttendanceRecord`) | `A-03c-1`–`3` (`MediaContentReference`), `TR-C3-04` open tech/archive (`ScheduledJob`/`ScheduledJobRun`), `Domain 16` |

---

## 9. Owner Review Classification Matrix

| Category | Meaning | `PROP` Rows | `STR` Entries | Action Required Before Freeze |
| :--- | :--- | :---: | :---: | :--- |
| **A. Business Decision Required** | Affects workflow, moderation, uniqueness, or persisted metric semantics | `4` | `0` | **Owner decision/confirmation required** |
| **B. Owner Field Confirmation** | Structure established; Owner confirms optionality, seed values, or input cap | `8` | `0` | **Owner confirmation required** |
| **C. Technical Recommendation** | Pure SQL Server type, length, JSON/enum storage, or FK/PK column mechanics | `25` | `86` *(active)* | **Batch acceptance recommended** |
| **D. Already Settled** | Governed by `WP55-PT-01..06` or accepted `TR-*` / `D-OWNER-REV-*` | `4` | `2` *(superseded)* | **Do not reopen** |
| **E. Deferred / Blocked** | Depends on `A-03c-1`–`3`, `TR-C3-04` open tech/archive, or `Domain 16` | `3` | `0` | **Preserve as `DEFERRED` / `OPEN` outside freeze** |

---

## 10. Owner Decision Queue (`OD-PF-01`–`OD-PF-08`, incl. `OD-PF-03-B` — `OWNER-APPROVED & INTEGRATED 2026-11-15`)

All `9` pre-freeze Owner decisions (`OD-PF-01` through `OD-PF-08`, including `OD-PF-03-B`) were **approved by the Project Owner on `2026-11-15`** and integrated into [`decision-register.md`](../../architecture/decision-register.md) `§8`, [`wp-5-5-deferred-decisions-record.md`](wp-5-5-deferred-decisions-record.md) `§3`, and [`data-dictionary.md`](data-dictionary.md). Historical uncertainty/context is preserved below for auditability; **none of these items remain awaiting Owner input**:

1. **`OD-PF-01` (`PROP-01` — `User.email`) — `OWNER-APPROVED (2026-11-15)`:** Optional/nullable; uniqueness applies only to non-`NULL` values; multiple `NULL`s allowed; empty/whitespace inputs normalized to `NULL`; `D-01` deletion does not retain email in `DeletedUserTombstone` or create collision-masking placeholders (frees email for reuse). *Technical note:* `mssql-django==2.0.0` requires an explicit SQL Server filtered unique index migration (`WHERE email IS NOT NULL`). *(Prior uncertainty: non-null uniqueness vs. `D-01` masking.)*
2. **`OD-PF-02` (`PROP-40` — `LessonProgress.progress_percent`) — `OWNER-APPROVED (2026-11-15)`:** Do **not** persist `LessonProgress.progress_percent` in DB; retain underlying playback/progress measurements (`last_position_seconds`, `furthest_watched_seconds`, `eligible_viewing_seconds`, `watch_count` on `LessonProgress`; `duration_seconds` on `LessonItem` per `Rule B` `INV-DOM06-02`) and independent `is_completed` state; calculate `%` on demand for UI/API; preserves video (`>= 90%` / `ended`) and PDF (explicit completion; 5s timer insufficient) rules. *(Prior uncertainty: persisted `DECIMAL(5,2)` vs. derived `%`.)*
3. **`OD-PF-03` (`PROP-32` — `CourseCommentReport.status`) — `OWNER-APPROVED (2026-11-15)`:** Approved status values: `Pending` (awaiting review), `Resolved` (reviewed and action taken), `Dismissed` (reviewed and no action required). `reporter_user_id = NULL` on `D-01` deletion with report preserved (`SETTLED — PREVIOUSLY OWNER-APPROVED UNDER D-01`, `DD` `L581`). Physical `NVARCHAR(32) NOT NULL DEFAULT 'Pending'` + `CHECK` remains `TECHNICAL-RECOMMENDATION`.
4. **`OD-PF-03-B` (`PROP-28` — `CourseReviewSubmission.review_status`) — `OWNER-APPROVED (2026-11-15)`:** Approved status values: `Pending` (waiting for admin review), `Approved` (accepted by admin), `ReturnedForRevision` (returned to lecturer for changes); strictly separate from `Course.lifecycle_status` (`Published` courses remain `Published` during pending update review). `CourseReviewSubmission` entity remains `PROVISIONAL` in `logical-data-model.md`.
5. **`OD-PF-04` (`PROP-37` — `GroupJoinRequest`) — `OWNER-APPROVED (2026-11-15)`:** Resubmission after `Rejected` creates a **new DB record** while retaining `Rejected` history; at most one `Pending` request per `(training_group_id, user_id)`; blocked while user has active `GroupMembership`; approved `request_status` vocabulary: `Pending`, `Approved`, `Rejected`. *Technical note:* Filtered unique index `WHERE request_status = 'Pending'` requires explicit SQL Server migration (`TECHNICAL-RECOMMENDATION`).
6. **`OD-PF-05` (`PROP-04`, `PROP-05`, `PROP-07`, `PROP-08` — Catalog `name_en` & Military Service Seeds) — `OWNER-APPROVED (2026-11-15)`:** `name_en` is optional (`NULL`, Arabic fallback in UI) for `OrganizationalDepartment`, `JobTitle`, `MetroLine`, `MaritalStatusCatalog`, and `MilitaryServiceStatusCatalog`; `MilitaryServiceStatusCatalog` initial values are **exactly** `معفي`, `أنهى الخدمة`, `مؤجل` (Admin-managed); preserves `MaritalStatusCatalog` ordinary categories (`Single`, `Married`, `Divorced`, `Widowed`) and required free-text `User.educational_qualification` (no `EducationalQualificationCatalog`).
7. **`OD-PF-06` (`PROP-11` — `HistoricalServiceTrainingRecord.completion_date`) — `OWNER-APPROVED (2026-11-15)`:** Optional and nullable (`DATE NULL`, preserving date-only semantics without timestamp/timezone conversion).
8. **`OD-PF-07` (`PROP-22` — `Course.description`) — `OWNER-APPROVED (2026-11-15)`:** Optional/`NULL` in `Draft` (ordinary Draft creation/saving does not require it); non-empty `description` required server-side at submission for admin review (including submitted updates of already-published courses).
9. **`OD-PF-08` (`PROP-17`, `PROP-21` — `PendingApprovalRequest.reason` & `AuditLogEntry.reason`) — `OWNER-APPROVED (2026-11-15)`:** Maximum length **`500`** characters (`NVARCHAR(500)`) approved specifically for `PendingApprovalRequest.reason` and `AuditLogEntry.reason`; pre-existing `Optional`/`NULL` nullability (`D-OWNER-REV-25` & `TECHNICAL-RECOMMENDATION`) is preserved unchanged; preserves `DeletedUserTombstone.reason = NVARCHAR(1000)` and `CourseCommentReport.reason = NVARCHAR(500)`.

---

## 11. Technical Recommendations (`Category C` — `OR-DB-01` & `OR-DB-02` `OWNER-APPROVED` `2026-11-16`)

All `25` technical `PROP` rows (`OR-DB-01` non-string types, nullability, `IDENTITY(1,1)`, `15` remaining defaults, `52` `CHECK`s, `9` `ISJSON()`s) and all `84` remaining active `STR` string lengths (`OR-DB-02`) are now **`OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`** (see [`decision-register.md`](../../architecture/decision-register.md) `§9.1` and [`data-dictionary.md`](data-dictionary.md) `§11.2`, `§11.5`). Only `OR-DB-04` field-level normalization scope (`strip()`/`NFC`) remains pending Owner review before freeze.

---

## 12. Deferred / Blocked Items (`Category E`)

- **`PROP-33` (`MediaContentReference.is_visible`) & `A-03c-1`–`3`:** Logical detachment state representation, restoration (`false -> true`), and asset purge lifecycle remain `DEFERRED` / `GATED` (`CURRENT.md` `L101`).
- **`PROP-43` (`ScheduledJob`) & `PROP-44` (`ScheduledJobRun`):** General scheduler technology (beyond `Domain 20 / D4` 6h Task Scheduler) and post-12-month archive/delete mechanics remain explicitly `OPEN` (`data-dictionary.md` `L656`, `L670`).
- **`InPersonAttendanceRecord` (`Domain 16`) & `API-REC-06` (`CL-03` Signed URLs):** Excluded from active freeze scope (`data-dictionary.md` `L464`, `L700`).
- **`WP55-PT-06` Infrastructure Inventory:** `x64` architecture, `SQL Server 2022` target, and co-hosted vs. separate DB topology remain pending infrastructure verification before `WP-5.6`.

---

## 13. Pre-Freeze Gate Analysis

| Gate Disposition | Items Covered | Boundary Compliance |
| :--- | :--- | :--- |
| **1. Must Resolve Before Freeze** | `12` items in Owner Decision Queue (`OD-PF-01`–`OD-PF-08`), plus `2` minor prose alignments (`data-dictionary.md` `L665`, `L670`) | Ensures no field with unconfirmed business meaning, requiredness, or lifecycle is frozen |
| **2. `OR-DB-04` Normalization Scope** | Field-scoped normalization (`58` / `7` / `36` [`27` + `9`] = `101`; Conditions A & B) | **`OWNER-APPROVED — EXPLICIT OWNER DECISION — 2026-11-16`**; Phase 12 SQL Server 2022 & write-path verification pending |
| **3. Defer Without Undermining Model** | `InPersonAttendanceRecord` (`Domain 16`), `A-03c-1`–`3`, `TR-C3-04` open general scheduler/post-12m archive, `API-REC-06` | Explicitly fenced outside active `54`-entity freeze |
| **4. Already Settled (Do Not Reopen)** | `4` `PROP` rows + `2` superseded `STR` entries + `15` `CP-010`–`CP-012` string lengths + `2` `OD-PF-08` string lengths + `84` `OR-DB-02` (`2026-11-16`) string lengths + `OR-DB-01` (`2026-11-16`) 6 physical design groups + `OR-DB-04` (`2026-11-16`) normalization scope + `WP55-PT-01`–`06` | Preserves `CP-010`–`CP-012`, Stage 4, and `2026-11-16` `OR-DB-02` / `OR-DB-01` / `OR-DB-04` decisions |

---

## 14. Recommended Review Sequence

1. **Step 1 — Owner Decisions (`OD-PF-01`–`OD-PF-08`):** Completed (`OWNER-APPROVED` `2026-11-15`).
2. **Step 2 — `OR-DB-02`, `OR-DB-01` & `OR-DB-04` Physical Design & Normalization:** Completed (`OWNER-APPROVED` `2026-11-16`); `0` remaining `OR-DB-*` Owner review items (Phase 12 SQL Server 2022 technical verification remains pending).
3. **Step 3 — Minor Prose Sync:** Authorize aligning `data-dictionary.md` `L665` (`DATETIME2` -> `DATETIMEOFFSET(7)`) and `L670` (`WP55-PT-05` cross-reference).
4. **Step 4 — Formal Freeze Authorization:** Owner issues explicit Freeze Authorization for `data-dictionary.md` (separately from `WP-5.6` kickoff and infra inventory verification).

---

## 15. Data Dictionary Prose Findings for Later Cleanup (Explanatory Prose Only)

*(Both findings affect **explanatory prose only** in [`data-dictionary.md`](data-dictionary.md); neither affects the active `54`-entity / `302`-field mapping tables, which are already reconciled under `WP55-PT-05`.)*

| Finding ID | Location | Exact Current Wording | Why Inconsistent / Ambiguous | Intended Interpretation (`WP55-PT-05`) | Recommended Future Correction | Affects Mapping? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **`DD-PROSE-01`** | `data-dictionary.md` `L665` (`TR-C3-03`) | `revoked_at DATETIME2 NULL` | Active Cluster 3 table (`L497`) was updated to `DATETIMEOFFSET(7)` under `WP55-PT-05`, leaving stale `DATETIME2` in historical `TR-C3-03` prose | `CertificateRecord.revoked_at` is `DATETIMEOFFSET(7) NULL` (`USE_TZ=True`, `+00:00` UTC) | Replace `revoked_at DATETIME2 NULL` with `revoked_at DATETIMEOFFSET(7) NULL` at freeze cleanup | **No** *(prose only)* |
| **`DD-PROSE-02`** | `data-dictionary.md` `L670` (`TR-C3-04`) | `Canonical timestamps stored in UTC; operational display in Africa/Cairo` | Omits the Windows Server OS `UTC` + Django `TIME_ZONE='UTC'` requirement from the accepted `WP55-PT-05` Windows timezone policy | Windows Server OS timezone = `UTC`, Django global `TIME_ZONE='UTC'`, `USE_TZ=True`, `DATETIMEOFFSET(7)`, explicit `ZoneInfo("Africa/Cairo")` + `tzdata` | Add cross-reference to `WP55-PT-05` (`Windows OS UTC` + `Django TIME_ZONE='UTC'` + explicit `ZoneInfo("Africa/Cairo")`) at freeze cleanup | **No** *(prose only)* |

---

## 16. Final Governance Confirmation

- [`data-dictionary.md`](data-dictionary.md) remains **`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`**.
- **No canonical Data Dictionary, decision register, roadmap, or checkpoint (`CP-010`, `CP-011`, `CP-012`) was modified**, and `CP-013` was not created.
- **`WP-5.6` remains `BLOCKED — NOT AUTHORIZED`**.
- Zero SQL DDL, Django models, migrations, dependency changes, or application code/test modifications were performed.

