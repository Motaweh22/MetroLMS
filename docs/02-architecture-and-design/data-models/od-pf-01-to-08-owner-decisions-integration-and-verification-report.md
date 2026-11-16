# MetroLMS — OD-PF-01 to OD-PF-08 Owner Decisions Integration & Pre-Freeze Verification Report

> **Document Status:** `COMPLETED — DOCUMENTATION INTEGRATION REPORT`  
> **Integration Date:** `2026-11-15`  
> **Authoritative Baseline:** [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md) + `WP55-PT-01`–`WP55-PT-06` + `OD-PF-01`–`OD-PF-08` (including `OD-PF-03-B`)  
> **Data Dictionary Status:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`  
> **`WP-5.6` Gate Status:** `BLOCKED — NOT AUTHORIZED`

---

## 1. Executive Summary

All nine Owner-approved pre-freeze decisions from the `2026-11-15` review round (`OD-PF-01`, `OD-PF-02`, `OD-PF-03`, `OD-PF-03-B`, `OD-PF-04`, `OD-PF-05`, `OD-PF-06`, `OD-PF-07`, and `OD-PF-08`) have been integrated into the canonical MetroLMS documentation and verified for cross-document consistency.

This was a **documentation-only integration task**:
- **All 9 Owner Decisions:** `OWNER-APPROVED — DOCUMENTATION INTEGRATED`
- **`data-dictionary.md`:** Remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`
- **Immutable Checkpoints (`CP-010`, `CP-011`, `CP-012`):** Untouched (`CP-012` remains the latest accepted checkpoint; `CP-013` was **not** created)
- **`WP-5.6` (SQL DDL, Django Models, Migrations, DB Provisioning):** Remains `BLOCKED — NOT AUTHORIZED`
- **Application Code & Tests:** Zero files modified

---

## 2. Scope and Authoritative Input Baseline

The integration updated five canonical project documents to reconcile business rules, field optionality, nullability, lengths, workflow state vocabularies, and non-persisted derived metrics without introducing PostgreSQL assumptions or reopening settled decisions:

1. [`docs/architecture/decision-register.md`](../../architecture/decision-register.md)
2. [`docs/02-architecture-and-design/data-models/wp-5-5-deferred-decisions-record.md`](wp-5-5-deferred-decisions-record.md)
3. [`docs/02-architecture-and-design/data-models/data-dictionary.md`](data-dictionary.md)
4. [`docs/02-architecture-and-design/data-models/wp-5-5-consolidated-pre-freeze-owner-review-register.md`](wp-5-5-consolidated-pre-freeze-owner-review-register.md)
5. [`docs/project-state/CURRENT.md`](../../project-state/CURRENT.md)

---

## 3. Summary of Integrated Owner Decisions (`OD-PF-01` through `OD-PF-08`, including `OD-PF-03-B`)

| Decision ID | Target Entity / Field | Approved Decision Summary | Status |
| :--- | :--- | :--- | :---: |
| **`OD-PF-01`** | `User.email` | Optional/nullable (`NULL` allowed). Empty/whitespace normalized to `NULL` before persistence. Uniqueness enforced only for non-null values via SQL Server filtered unique index (`WHERE email IS NOT NULL`, created via explicit SQL Server migration). Deleted users (`D-01`) free their email for reuse. | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-02`** | `LessonProgress.progress_percent` | **Derived on demand — NOT persisted** in the database. Underlying playback/progress measurements are retained (`last_position_seconds`, `furthest_watched_seconds`, `eligible_viewing_seconds`, `watch_count` on `LessonProgress`; `duration_seconds` on `LessonItem` per `Rule B` `INV-DOM06-02`), giving `LessonProgress` `9` persisted fields. `is_completed` (`BIT NOT NULL`) remains independently persisted (video `>= 90%` / `ended`; PDF explicit completion; 5-second timer insufficient). | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-03`** | `CourseCommentReport.report_status` & `reporter_user_id` | Report states: `Pending`, `Resolved`, `Dismissed`. On reporter deletion (`D-01`), `reporter_user_id` becomes `NULL` and the report is retained (`reporter_user_id` nullable FK `ON DELETE NO ACTION`). `NVARCHAR(32) DEFAULT 'Pending'` + `CHECK` constraint remains `TECHNICAL-RECOMMENDATION`. | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-03-B`** | `CourseReviewSubmission.review_status` | Course review workflow states: `Pending`, `Approved`, `ReturnedForRevision`. Kept strictly separate from `Course.lifecycle_status` (`Draft`, `PendingReview`, `Published`, `Disabled`). `CourseReviewSubmission` entity remains `PROVISIONAL` in `logical-data-model.md`. | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-04`** | `GroupJoinRequest` | Request states: `Pending`, `Approved`, `Rejected`. Resubmission after rejection creates a **new row** while retaining `Rejected` history. At most one `Pending` request per `(training_group_id, user_id)`. Users with active `GroupMembership` cannot submit a join request. Filtered unique index DDL remains `TECHNICAL-RECOMMENDATION`. | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-05`** | Bilingual Catalog `name_en` & Military/Education Catalogs | `name_en` is optional (`NULL` allowed) for all five catalogs: `OrganizationalDepartment`, `JobTitle`, `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`. `MilitaryServiceStatusCatalog` initial Arabic values are exactly: `معفي`, `أنهى الخدمة`, `مؤجل`. `MaritalStatusCatalog` retains ordinary categories without military values. No `EducationalQualificationCatalog` is introduced (`User.educational_qualification` stays free-text `NVARCHAR(255)`). | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-06`** | `HistoricalServiceTrainingRecord.completion_date` | Optional / nullable (`DATE NULL`). | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-07`** | `Course.description` | Optional / nullable (`NVARCHAR(MAX) NULL`) in `Draft`; required non-empty via server-side validation at course submission for review and at published-course update submission. | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |
| **`OD-PF-08`** | `PendingApprovalRequest.reason` & `AuditLogEntry.reason` | Maximum length **`500`** characters (`NVARCHAR(500)`) approved (`OWNER-APPROVED`); pre-existing `Optional`/`NULL` nullability (`D-OWNER-REV-25` & `TECHNICAL-RECOMMENDATION`) is preserved unchanged. `DeletedUserTombstone.reason` remains `NVARCHAR(1000)` (`CP-010`) and `CourseCommentReport.reason` remains `NVARCHAR(500)` (`CP-011`). | `OWNER-APPROVED — DOCUMENTATION INTEGRATED` |

---

## 4. Canonical Documentation Updates Completed

| File | Sections / Lines Updated | Summary of Changes |
| :--- | :--- | :--- |
| [`docs/architecture/decision-register.md`](../../architecture/decision-register.md) | `§8` (added) & `§9` (renumbered) | Added canonical `§8. WP-5.5 Pre-Freeze Owner Decisions Integration (OD-PF-01–OD-PF-08, including OD-PF-03-B)` with full decision table and governance notes; renumbered Pending Owner Decisions to `§9`. |
| [`docs/02-architecture-and-design/data-models/wp-5-5-deferred-decisions-record.md`](wp-5-5-deferred-decisions-record.md) | `§3` (added) | Added `§3. Pre-Freeze Owner Decisions Addendum (OD-PF-01–OD-PF-08, including OD-PF-03-B, 2026-11-15)` recording all 9 decisions alongside `WP55-PT-01`–`WP55-PT-06`. |
| [`docs/02-architecture-and-design/data-models/data-dictionary.md`](data-dictionary.md) | `L8`, `L77`, `L125–131`, `L143`, `L162`, `L172`, `L311`, `L369`, `L382`, `L487`, `L496`, `L679`, `L688`, `L693` | Updated `User.email`, 5 catalog `name_en` fields & `MilitaryServiceStatusCatalog` initial values, `HistoricalServiceTrainingRecord.completion_date`, `PendingApprovalRequest.reason`, `AuditLogEntry.reason`, `Course.description`, `CourseReviewSubmission.review_status`, `CourseCommentReport`, `GroupJoinRequest`, removed `LessonProgress.progress_percent` from persisted columns, and updated persisted counts (`301` total / `97` Cluster 3). |
| [`docs/02-architecture-and-design/data-models/wp-5-5-consolidated-pre-freeze-owner-review-register.md`](wp-5-5-consolidated-pre-freeze-owner-review-register.md) | Header, Executive Summary, `§10` | Marked `OD-PF-01`–`OD-PF-08` (including `OD-PF-03-B`) as `OWNER-APPROVED (2026-11-15)` and integrated (no longer awaiting Owner input), preserving historical context and unrelated deferred/technical items. |
| [`docs/project-state/CURRENT.md`](../../project-state/CURRENT.md) | `L8` (`Last Updated`) | Updated live status line to reflect integration of `OD-PF-01`–`OD-PF-08` (incl. `OD-PF-03-B`) while keeping `data-dictionary.md` `UNFROZEN` and `WP-5.6` `BLOCKED — NOT AUTHORIZED`. |

---

## 5. Data Dictionary Reconciliation Summary

- **Persisted Field Count Adjustment (`OD-PF-02` & Post-Integration Correction Audit):**
  - Stage 4 baseline prior to `OD-PF-02`: `54` active entities / `302` persisted mapped fields (`Cluster 1: 108`, `Cluster 2: 96`, `Cluster 3: 98`) + `1` `DEFERRED` entity (`InPersonAttendanceRecord`).
  - Post-`OD-PF-02` & `Rule B` telemetry reconciliation: `LessonProgress.progress_percent` is derived on demand and excluded from persistence (`-1`), while the `4` required playback/progress telemetry fields (`last_position_seconds`, `furthest_watched_seconds`, `eligible_viewing_seconds`, `watch_count`) are retained on `LessonProgress` (`+4`, bringing `LessonProgress` to `9` persisted fields and Cluster 3 to `101`), and `duration_seconds` is persisted on `LessonItem` (`+1`, bringing Cluster 2 to `97`). Total active persisted mapped fields in `data-dictionary.md`: **`306`** across `54` active entities.
- **Nullability & Uniqueness Alignment:**
  - `User.email`: `Optional` / `NULL`, filtered `UNIQUE(email) WHERE email IS NOT NULL` via explicit SQL Server migration (`OD-PF-01`).
  - `GroupJoinRequest`: filtered `UNIQUE(training_group_id, user_id) WHERE request_status = 'Pending'` (`OD-PF-04`), retaining `Rejected` history rows.
  - `CourseCommentReport.reporter_user_id`: `NULL` on `D-01` deletion (`OD-PF-03`).

---

## 6. `OD-PF-03` vs `OD-PF-03-B` Separation Confirmation

- **`OD-PF-03` (`CourseCommentReport`):** Governs moderation reports on course comments (`Pending`, `Resolved`, `Dismissed`) and reporter deletion anonymization (`reporter_user_id = NULL` on `D-01`).
- **`OD-PF-03-B` (`CourseReviewSubmission`):** Governs lecturer course-review submissions (`Pending`, `Approved`, `ReturnedForRevision`) and remains strictly separate from both `CourseCommentReport` and `Course.lifecycle_status` (`Draft`, `PendingReview`, `Published`, `Disabled`). `CourseReviewSubmission` retains its `PROVISIONAL` entity classification in `logical-data-model.md`.

---

## 7. `OD-PF-05` Arabic Localization & Catalog Scope Confirmation

- All five catalog `name_en` columns (`OrganizationalDepartment`, `JobTitle`, `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`) are documented as `Optional` / `NULL`.
- `MilitaryServiceStatusCatalog` specifies the exact three initial Arabic values: `معفي`, `أنهى الخدمة`, `مؤجل`.
- `MaritalStatusCatalog` retains ordinary marital categories only (no military service values).
- `EducationalQualificationCatalog` is **not** introduced anywhere in `data-dictionary.md`; `User.educational_qualification` remains free-text `NVARCHAR(255)`.

---

## 8. `OD-PF-04` Resubmission & Active Membership Boundary Confirmation

- `GroupJoinRequest.request_status` uses `Pending`, `Approved`, `Rejected`.
- Resubmission after rejection creates a new `GroupJoinRequest` row while preserving historical `Rejected` rows.
- At most one `Pending` request is allowed per `(training_group_id, user_id)` (filtered unique index `WHERE request_status = 'Pending'` remains `TECHNICAL-RECOMMENDATION` for `WP-5.6` DDL).
- Users with an active `GroupMembership` in the target group are blocked from submitting a new `GroupJoinRequest`.

---

## 9. `OD-PF-07` & `OD-PF-08` Validation & Length Rules Confirmation

- **`OD-PF-07` (`Course.description`):** `NVARCHAR(MAX) NULL` in `Draft`; non-empty value required via server-side validation at initial course submission for review and at published-course update submission.
- **`OD-PF-08` (`reason` Lengths):**
  - `PendingApprovalRequest.reason`: `NVARCHAR(500) NULL` (`OWNER-APPROVED`).
  - `AuditLogEntry.reason`: `NVARCHAR(500) NULL` (`OWNER-APPROVED`).
  - `DeletedUserTombstone.reason`: Preserved unchanged at `NVARCHAR(1000)` (`CP-010`).
  - `CourseCommentReport.reason`: Preserved unchanged at `NVARCHAR(500)` (`CP-011`).

---

## 10. Cross-Document Consistency Verification Results

Automated and line-level read-only checks executed after all edits confirmed:

1. **All 9 decision IDs (`OD-PF-01`–`OD-PF-08`, incl. `OD-PF-03-B`) present in `decision-register.md`, `wp-5-5-deferred-decisions-record.md`, and `wp-5-5-consolidated-pre-freeze-owner-review-register.md`:** `PASS` (`True` for all 9 across all 3 files).
2. **`OD-PF-03` and `OD-PF-03-B` tracked as distinct decisions in `decision-register.md`:** `PASS` (`True`).
3. **`MilitaryServiceStatusCatalog` exact 3 Arabic values (`معفي`, `أنهى الخدمة`, `مؤجل`) in `data-dictionary.md`:** `PASS` (`True`).
4. **`EducationalQualificationCatalog` absent from `data-dictionary.md`:** `PASS` (`True`).
5. **All 5 catalog `name_en` columns optional in `data-dictionary.md`:** `PASS` (`True`).
6. **`HistoricalServiceTrainingRecord.completion_date` documented as `DATE` / `NULL` in `data-dictionary.md`:** `PASS` (`True`).
7. **`Course.description` optional in `Draft` and mandatory at submission in `data-dictionary.md`:** `PASS` (`True`).
8. **`DeletedUserTombstone.reason` preserved at `1000` in `data-dictionary.md`:** `PASS` (`True`).
9. **`LessonProgress.progress_percent` removed from persisted columns (`L496` & `L693`):** `PASS` — verified directly on `data-dictionary.md:496`: `Field Name` column contains `` `id` / `course_attempt_id` / `lesson_item_id` / `is_completed` / `updated_at` `` (`5` fields; `progress_percent` appears only in the `Business Meaning` prose stating it is derived on demand and **not** persisted per `OD-PF-02`).
10. **No PostgreSQL constructs (`BIGSERIAL`, `TIMESTAMPTZ`, `JSONB`, `BOOLEAN`) introduced into MetroLMS target definitions:** `PASS` — zero matches in `data-dictionary.md` and `wp-5-5-deferred-decisions-record.md`; the single match in `decision-register.md:73` is the existing historical-deviation classification note prohibiting PostgreSQL `JSONB` operators in frozen legacy documents.
11. **`data-dictionary.md` remains `UNFROZEN`:** `PASS` (`True`).
12. **`WP-5.6` remains `BLOCKED — NOT AUTHORIZED`:** `PASS` (`True`).
13. **Immutable checkpoints `CP-010`, `CP-011`, `CP-012` untouched; `CP-013` not created; `frontend/src` untouched:** `PASS` (`True`).

---

## 11. Remaining Pre-Freeze Items / Technical Recommendations

- **No further Owner business-decision rounds are required** for `OD-PF-01`–`OD-PF-08`.
- **Technical Recommendations (`TECHNICAL-RECOMMENDATION`)** retained for `WP-5.6` physical design/DDL implementation (no Owner re-approval required):
  - `CourseCommentReport.report_status` physical storage (`NVARCHAR(32) DEFAULT 'Pending'` + `CHECK`).
  - `GroupJoinRequest` filtered unique index DDL (`UNIQUE(training_group_id, user_id) WHERE request_status = 'Pending'`).
  - `User.email` filtered unique index DDL (`UNIQUE(email) WHERE email IS NOT NULL`) via explicit SQL Server migration.
  - Remaining column-level SQL Server types/lengths already classified as `TECHNICAL-RECOMMENDATION` or `PROPOSED` in `data-dictionary.md`.
- **Deferred Entity:** `InPersonAttendanceRecord` (`Domain 16`) remains `DEFERRED`.
- **Provisional Entity Classification:** `CourseReviewSubmission` remains `PROVISIONAL` in `logical-data-model.md`.

---

## 12. Governance Boundary Confirmation

- **`OD-PF-01` through `OD-PF-08` (including `OD-PF-03-B`):** `OWNER-APPROVED — DOCUMENTATION INTEGRATED`
- **`data-dictionary.md`:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`
- **Latest Accepted Checkpoint:** `CP-012` (untouched; `CP-010` and `CP-011` also untouched)
- **`CP-013`:** Not created
- **`WP-5.6`:** `BLOCKED — NOT AUTHORIZED` (no SQL DDL, Django models, migrations, or DB provisioning authorized)

---

## 13. Recommended Next Controlled Action

1. **Owner Freeze Decision:** The Project Owner may now issue a separate, explicit authorization to freeze `data-dictionary.md` (`OWNER-APPROVED — CONTENT ACCEPTED — FROZEN`) and record `CP-013`.
2. **`WP-5.6` Gate:** Only after (or alongside) explicit Owner authorization may `WP-5.6` (Physical ERD, SQL Server DDL, Django `models.py`, and migrations) begin.

---

## 14. Post-Integration Correction Audit Addendum (`OD-PF-02` & `OD-PF-08`)

A narrowly scoped post-integration audit was completed on `2026-11-15` to verify `OD-PF-02` playback-measurement retention and `OD-PF-08` nullability classification.

### 14.1 `OD-PF-02` — `LessonProgress` & `LessonItem` Telemetry Persistence Corrections
- **Audit Finding:** The initial integration removed `LessonProgress.progress_percent` (`6` → `5` fields) without restoring the underlying playback telemetry measurements required by `OD-PF-02`, `METROLMS-DOM-LRN-014` (`INV-DOM14-03`), `METROLMS-TECH-DOM-014` §2.1, `METROLMS-DOM-CNT-006` (`INV-DOM06-02`), and `database-schema.md` (`§4.5`, `§5.3`).
- **Verified Persisted Destinations & Corrections Applied:**
  1. `LessonProgress.last_position_seconds` (`INT NOT NULL DEFAULT 0`, `CHECK (last_position_seconds >= 0)`) — **Restored on `LessonProgress`** (`data-dictionary.md` `§8.4`).
  2. `LessonProgress.furthest_watched_seconds` (`INT NOT NULL DEFAULT 0`, `CHECK (furthest_watched_seconds >= 0)`) — **Restored on `LessonProgress`** (`INV-DOM14-03` monotonic anti-seek clamp).
  3. `LessonProgress.eligible_viewing_seconds` (`INT NOT NULL DEFAULT 0`, `CHECK (eligible_viewing_seconds >= 0)`) — **Restored on `LessonProgress`** (`INV-DOM14-03` monotonic foreground timer).
  4. `LessonProgress.watch_count` (`INT NOT NULL DEFAULT 0`, `CHECK (watch_count >= 0)`) — **Restored on `LessonProgress`** (`METROLMS-TECH-DOM-014` §2.1 & `inMemoryStore.ts:10927-10965` viewing-frequency telemetry).
  5. `LessonItem.duration_seconds` (`INT NULL DEFAULT 0`, `CHECK (duration_seconds >= 0)`) — **Mapped on `LessonItem`** (`data-dictionary.md` `§5.5`), as `durationSeconds` is a substantive item-level property under `Rule B` (`INV-DOM06-02`) and `database-schema.md` `§4.5`, not a per-learner `LessonProgress` metric.
  6. `LessonProgress.progress_percent` remains **excluded** from persisted columns, and `LessonProgress.is_completed` (`BIT NOT NULL`) remains independent of calculated `%`.
- **Reconciled Persisted Field Counts:** Cluster 1 (`108`) + Cluster 2 (`97` = `96` at `CP-011` + `LessonItem.duration_seconds`) + Cluster 3 (`101` = `98` at `CP-012` `-1` `progress_percent` `+4` `LessonProgress` telemetry fields) = **`306`** active persisted mapped fields across `54` active entities (`+1` `DEFERRED` `InPersonAttendanceRecord`).

### 14.2 `OD-PF-08` — Nullability Classification Audit
- **Evidence:** Pre-integration `wp-5-5-consolidated-pre-freeze-owner-review-register.md` (`L94` `PROP-17`, `L98` `PROP-21`), `wp-5-5-final-owner-signoff-data-dictionary-readiness-review.md` (`L189`), and `logical-data-model.md` (`D-OWNER-REV-25` `L283`) confirm that **both** `PendingApprovalRequest.reason` and `AuditLogEntry.reason` were **already `Optional` / `NULL`** (`NVARCHAR(500) NULL`) prior to `OD-PF-08` integration.
- **Correction Applied:** Updated `data-dictionary.md` (`L162`, `L172`), `decision-register.md` (`§8`), `wp-5-5-deferred-decisions-record.md` (`§3`), and `wp-5-5-consolidated-pre-freeze-owner-review-register.md` (`§10`) to explicitly distinguish:
  - `500`-character maximum length (`NVARCHAR(500)`): `OWNER-APPROVED` (`OD-PF-08`).
  - Optionality by default: `OWNER-APPROVED` (`D-OWNER-REV-25`).
  - SQL `NULL` nullability: Preserved pre-existing `TECHNICAL-RECOMMENDATION` / `D-OWNER-REV-25` classification (not newly changed by `OD-PF-08`).
  - `DeletedUserTombstone.reason`: Preserved unchanged at `NVARCHAR(1000)` (`CP-010`).
  - `CourseCommentReport.reason`: Preserved unchanged at `NVARCHAR(500)` (`CP-011`).

### 14.3 Post-Audit Final Status
- **`OD-PF-01`–`OD-PF-08` (incl. `OD-PF-03-B`):** `OWNER-APPROVED — DOCUMENTATION INTEGRATED`
- **`data-dictionary.md`:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`
- **Checkpoints:** `CP-010`, `CP-011`, `CP-012` untouched (`CP-012` latest); `CP-013` not created
- **`WP-5.6`:** `BLOCKED — NOT AUTHORIZED`


