# MetroLMS — Owner Decisions Integration & Pre-Freeze Documentation Consolidation

## 1. Task Objective

Execute a **documentation-only integration task** for all Owner decisions `OD-PF-01` through `OD-PF-08`, including `OD-PF-03-B`.

The Project Owner has reviewed and approved these decisions through the conversation dated **2026-11-15**. They are now authorized for documentation integration.

Your task is to:
1. Integrate all approved decisions into the appropriate canonical documentation.
2. Update the decision register and the relevant pre-freeze review records.
3. Reconcile the Data Dictionary with the newly approved business rules without freezing it.
4. Verify consistency across affected documents.
5. Produce one consolidated integration and verification report.

**Do not ask the Project Owner to re-approve these decisions. Do not reopen them. Do not introduce unnecessary additional Owner decision rounds.**

---

## 2. Authoritative Owner Decisions

Integrate the following decisions exactly.

### OD-PF-01 — User.email Optionality, Uniqueness & Deletion Behavior

**Owner-approved decision:**

- `User.email` is optional and nullable.
- Email uniqueness applies only to non-NULL values.
- Multiple NULL email values must be allowed.
- Empty or whitespace-only email inputs must be normalized to NULL before persistence.
- Implement uniqueness using a SQL Server filtered unique index/constraint for non-NULL values.
- Under the approved D-01 User deletion policy:
  - Do not retain the deleted user's email in `DeletedUserTombstone`.
  - Do not create a permanent collision-masking placeholder.
  - Deleting the User frees the email for reuse.

**Technical implementation note:**

`mssql-django==2.0.0` has limitations around database-level conditional uniqueness. Document the explicit SQL Server filtered-index migration strategy for the future physical implementation.

Do not assume Django ORM automatically creates the required filtered unique index.

### OD-PF-02 — LessonProgress.progress_percent

**Owner-approved decision:**

- Do not persist `LessonProgress.progress_percent`.
- Retain the underlying playback/progress measurements needed to calculate progress.
- Retain `is_completed` as an independent persisted business state.
- Calculate the percentage when required for UI/API presentation.
- Do not treat a calculated percentage as equivalent to lesson completion.

**Preserve existing completion rules:**

- Video lessons are completed after 90% eligible playback or the video `ended` event.
- PDF lessons require an explicit user completion action.
- The legacy five-second PDF timer alone is insufficient for completion.

Do not introduce new completion thresholds or modify existing business rules.

### OD-PF-03 — CourseCommentReport.status

**Owner-approved status values:**

- `Pending`
- `Resolved`
- `Dismissed`

Definitions:

- `Pending`: awaiting review.
- `Resolved`: reviewed and action taken.
- `Dismissed`: reviewed and no action required.

Additional approved behavior:

- Preserve the report if its reporter User is deleted.
- Set `reporter_user_id = NULL` under the existing D-01 deletion policy.

The proposed physical representation `NVARCHAR(32) NOT NULL DEFAULT 'Pending'` with an allowed-values CHECK constraint remains a technical recommendation unless already independently approved in the canonical physical-design records.

### OD-PF-03-B — CourseReviewSubmission.review_status

**Owner-approved status values:**

- `Pending`
- `Approved`
- `ReturnedForRevision`

Definitions:

- `Pending`: waiting for administrator review.
- `Approved`: accepted by the administrator.
- `ReturnedForRevision`: returned to the lecturer for changes.

Important invariant:

`CourseReviewSubmission.review_status` is separate from `Course.lifecycle_status`.

A published Course must remain `Published` while an update submission is pending review. A pending update must not accidentally unpublish or replace the currently published version.

Preserve the existing `PROVISIONAL` classification of the `CourseReviewSubmission` entity in the logical data model unless its overall entity approval has been separately established. Approval of its status vocabulary does not automatically approve every aspect of its entity mapping.

### OD-PF-04 — GroupJoinRequest Resubmission

**Owner-approved behavior:**

- A trainee may submit a new request after a previous request has been `Rejected`.
- The new request must create a **new database record**.
- Retain the previous rejected request for historical purposes.
- Allow at most one `Pending` request per `(training_group_id, user_id)` pair.
- Do not allow a new request while the user has active membership in that same group.

Approved status vocabulary:

- `Pending`
- `Approved`
- `Rejected`

**Technical implementation note:**

A filtered unique index on `(training_group_id, user_id)` for rows where `request_status = 'Pending'` is a suitable technical recommendation.

Do not assume Django ORM automatically creates this filtered index. Preserve the distinction between the approved business invariant and its future SQL Server enforcement strategy.

### OD-PF-05 — Catalog English Names & Military Service Status Values

**Owner-approved business rules:**

The following English-name fields are optional:

- `OrganizationalDepartment.name_en`
- `JobTitle.name_en`
- `MetroLine.name_en`
- `MaritalStatusCatalog.name_en`
- `MilitaryServiceStatusCatalog.name_en`

Arabic names remain the required primary labels. Missing English names must not prevent record creation or use; the UI should fall back to the Arabic label.

**MilitaryServiceStatusCatalog initial values — exactly these three:**

1. `معفي`
2. `أنهى الخدمة`
3. `مؤجل`

Do not invent additional initial military-service statuses.

Keep the catalog Admin-managed as previously established. The approved Arabic labels are business decisions; technical codes may be proposed consistently without inventing additional business states.

Preserve the existing marital-status catalog and its previously approved ordinary categories:

- Single
- Married
- Divorced
- Widowed

Preserve the existing decision that Educational Qualification is required free text on the User profile. Do not recreate `EducationalQualificationCatalog` or add an FK to it.

### OD-PF-06 — HistoricalServiceTrainingRecord.completion_date

**Owner-approved decision:**

`HistoricalServiceTrainingRecord.completion_date` is optional and nullable.

Reason:

Historical training records may have incomplete or unavailable date information. The absence of an exact completion date must not prevent recording an otherwise valid historical training record.

Preserve its date-only semantic and SQL Server `DATE` mapping. Do not convert it to a timestamp or add timezone behavior.

### OD-PF-07 — Course.description Optionality

**Owner-approved decision:**

- `Course.description` may be empty or NULL while a Course is in `Draft`.
- Draft creation and ordinary Draft saving must not require a description.
- A non-empty description is required before submitting a Course for administrator review.
- Revalidate this requirement server-side at submission time.
- Apply the same content-eligibility rule to submitted updates of already published courses.

Do not weaken the existing content eligibility validation at submission.
Do not force a description during every intermediate Draft save.

### OD-PF-08 — Reason Field Length

**Owner-approved decision:**

Apply a maximum length of **500 characters** to the reason field references explicitly included in the OD-PF-08 entry of the Consolidated Pre-Freeze Owner Review Register.

Important safeguards:

- Inspect the original OD-PF-08 row to identify its exact affected Entity.Field references.
- Do not expand this decision to every field named `reason` across the system.
- Preserve already Owner-approved field lengths.
- In particular, preserve `DeletedUserTombstone.reason = NVARCHAR(1000)`.
- Preserve the already approved `CourseCommentReport.reason = NVARCHAR(500)`.
- Do not silently change unrelated reason fields or their nullability.
- Where the OD-PF-08 scope overlaps an existing approved field length, record the overlap and retain the existing approved definition.

---

## 3. Canonical Documentation Integration

First inspect the current repository structure and locate the canonical versions of the following documents:

- `data-dictionary.md`
- `decision-register.md`
- `wp-5-5-deferred-decisions-record.md`
- `wp-5-5-consolidated-pre-freeze-owner-review-register.md`
- `CURRENT.md`
- Relevant logical data model and domain specifications.
- Any existing OD-PF decision integration or closure records.

Do not create duplicate canonical documents if they already exist.

### Integration requirements

**A. Decision Register**

Record each approved decision with:
- Exact decision ID.
- Owner-approved classification.
- Approval date: `2026-11-15`.
- Concise decision statement.
- Affected entities and fields.
- Relevant technical enforcement notes.
- References to the documents where the decision is integrated.

Keep `OD-PF-03` and `OD-PF-03-B` as distinct decision entries.

**B. Deferred Decisions Record**

Update the corresponding decision entries to reflect their actual approval status and preserve all technical notes and implementation dependencies.

**C. Consolidated Pre-Freeze Owner Review Register**

- Mark OD-PF-01 through OD-PF-08 as Owner-approved.
- Preserve the original decision IDs and traceability.
- Do not remove historical alternatives or decision context if needed for auditability.
- Ensure the register no longer describes these approved items as awaiting Owner input.
- Preserve unrelated unresolved, gated, and deferred items.

**D. Data Dictionary**

Integrate the accepted business rules into the relevant field definitions and constraints.

Examples:

- `User.email`: nullable, filtered uniqueness, empty-to-NULL normalization.
- `LessonProgress.progress_percent`: derived; excluded from persisted fields.
- `CourseCommentReport.status`: approved vocabulary.
- `CourseReviewSubmission.review_status`: approved vocabulary.
- `GroupJoinRequest.request_status`: approved vocabulary and resubmission invariant.
- Optional catalog `name_en` fields.
- `MilitaryServiceStatusCatalog` seed values.
- Nullable `HistoricalServiceTrainingRecord.completion_date`.
- `Course.description` Draft optionality and submission requirement.
- OD-PF-08 affected reason fields and their approved maximum length.

Do not turn a technical recommendation into an Owner-approved physical decision unless the Owner explicitly approved it.

### Classification discipline

Preserve the distinction between:

- `OWNER-APPROVED`
- `TECHNICAL-RECOMMENDATION`
- `PROPOSED`
- `UNRESOLVED-BUSINESS-RULE`
- `DEFERRED`

Business behavior may be Owner-approved while a particular SQL Server enforcement mechanism remains a technical recommendation.

---

## 4. Strict Project Architecture & Governance Constraints

These constraints are mandatory.

### Backend architecture

- Python 3.12.
- Django 5.2 LTS.
- Django REST Framework.
- Microsoft SQL Server.
- `mssql-django==2.0.0`.
- `pyodbc` with Microsoft ODBC Driver 18 as the active runtime path.
- Windows Server 2022.

**PostgreSQL is not part of the approved architecture.** Do not introduce PostgreSQL-specific SQL, configuration, migrations, or operational assumptions.

### Data Dictionary and physical design

- `data-dictionary.md` must remain **UNFROZEN**.
- Do not change its status to frozen, final, or fully approved.
- Integrate only the authorized Owner decisions and necessary traceability corrections.
- Preserve all existing Owner-approved field lengths.
- Do not finalize additional database-bound inputs without an explicit Owner review.
- No Django models, migrations, SQL DDL, database schema, or backend implementation.

### Checkpoints

The following accepted checkpoints are immutable:

- `CP-010`
- `CP-011`
- `CP-012`

Do not edit, rewrite, rename, delete, move, regenerate, or replace them.

Do not create `CP-013`.

`CP-012` remains the latest accepted checkpoint.

### Work authorization

`WP-5.6` remains:

`BLOCKED — NOT AUTHORIZED`

The approval of these Owner decisions does not authorize starting WP-5.6.

Do not start backend implementation, physical schema finalization, SQL migrations, or ORM mapping.

Keep `active-roadmap.md` separate from the WP-5.5 / REV6 roadmap.

---

## 5. Execution Scope

This task authorizes:

- Reading and inspecting relevant documentation.
- Documentation updates required to integrate the eight approved decisions.
- Decision-register updates.
- Pre-freeze review register updates.
- Data Dictionary corrections within the exact approved scope.
- Cross-document consistency checks.
- Read-only Git status and diff inspection.
- Creation of one final integration report.

This task does **not** authorize:

- Frontend changes.
- Backend changes.
- Django model or migration changes.
- SQL scripts or database changes.
- MSW handler changes.
- Test modifications or test/build execution.
- Checkpoint modifications or creation.
- Roadmap phase advancement.
- WP-5.6 execution.
- Automatic resolution of unrelated deferred business rules.

Preserve all existing uncommitted work. Do not stage, commit, stash, reset, or discard Git changes.

---

## 6. Verification Requirements

After documentation integration, perform a read-only verification.

Verify the following:

1. All eight decision IDs are present and consistently classified as Owner-approved.
2. `OD-PF-03-B` has not been merged into or confused with `OD-PF-03`.
3. `MilitaryServiceStatusCatalog` contains exactly the three approved initial Arabic labels.
4. `EducationalQualificationCatalog` has not been reintroduced.
5. Every applicable `name_en` field is optional.
6. `HistoricalServiceTrainingRecord.completion_date` remains nullable and date-only.
7. `Course.description` is optional in Draft but mandatory at submission.
8. The exact OD-PF-08 field scope is respected.
9. `DeletedUserTombstone.reason` remains `1000` characters.
10. Already Owner-approved string lengths remain unchanged.
11. `LessonProgress.progress_percent` is not represented as a persisted database field.
12. The approved status vocabularies and their meanings match everywhere.
13. GroupJoinRequest resubmission does not overwrite rejected historical requests.
14. Filtered uniqueness requirements are documented without falsely claiming automatic Django ORM support.
15. No PostgreSQL assumptions have been introduced.
16. The Data Dictionary remains unfrozen.
17. `WP-5.6` remains unauthorized.
18. `CP-010`, `CP-011`, and `CP-012` remain untouched.
19. `CP-013` has not been created.
20. Unrelated deferred and unresolved items retain their previous classifications.

Use targeted searches and document comparisons. Do not claim test or runtime verification because no tests or builds are authorized.

---

## 7. Final Deliverable

Create one self-contained report:

**`MetroLMS — OD-PF-01 to OD-PF-08 Owner Decisions Integration & Pre-Freeze Verification Report`**

Include:

1. Executive Summary.
2. All eight approved Owner decisions, with their exact meanings.
3. Exact files modified.
4. Decision Register integration evidence.
5. Data Dictionary integration evidence.
6. Consolidated Owner Review Register integration evidence.
7. Technical recommendations that remain unfinalized.
8. Cross-document consistency verification matrix.
9. Existing approved decisions and field lengths preserved.
10. Deferred and unresolved decisions preserved.
11. Git status and change-scope summary.
12. Checkpoint immutability verification.
13. Final governance status.

The final status must explicitly confirm:

- OD-PF-01 through OD-PF-08: `OWNER-APPROVED — DOCUMENTATION INTEGRATED` (only after successful integration).
- `data-dictionary.md`: `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- `CP-012`: latest accepted checkpoint, untouched.
- `CP-013`: not created.
- `WP-5.6`: `BLOCKED — NOT AUTHORIZED`.

If any integration or verification item cannot be completed, report it explicitly. Never claim a file was modified or a condition verified without actual evidence.

**Final instruction:** Complete the authorized documentation integration and produce the report. Stop afterward. Do not start WP-5.6 or request another round of approval for decisions already accepted by the Project Owner.# MetroLMS — Deferred Decisions Resolution Corrections (`WP-5.5`)

> **Document Status:** `TECHNICAL-AUDIT — DEFERRED DECISIONS CORRECTIONS (REPORT-ONLY)`  
> **Scope:** Narrowly scoped correction and technical deepening of [`deferred-decisions-resolution-assessment.md`](deferred-decisions-resolution-assessment.md) across findings `D-01`, `D-03`, `D-04`, `D-05`, and `D-06`.  
> **Governance Notice:** **Zero existing project files were modified.** `deferred-decisions-resolution-assessment.md`, `data-dictionary.md` (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`), `decision-register.md`, `CP-010`–`CP-012`, `CURRENT.md`, and `active-roadmap.md` remain completely untouched. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

This report refines five technical analyses from [`deferred-decisions-resolution-assessment.md`](deferred-decisions-resolution-assessment.md) while preserving all six deferred decisions as unresolved and requiring Owner/infrastructure sign-off:

1. **D-01 (`PendingApprovalRequest.id`):** Distinguishes the internal database PK (`UNIQUEIDENTIFIER`) from any public/API reference (`apr-...`), confirming that adding a separate public-reference column is **not** authorized without requirements evidence.
2. **D-03 (`QuizDefinition.passing_score`):** Expands the unresolved business rules required if raw points are used (maximum score, fractional points, valid range, and rounding/comparison rules).
3. **D-04 (`GroupQrCode.token_hash`):** Details the QR threat model, CSPRNG token entropy, `SHA-256` vs. `HMAC-SHA256` (including HMAC key isolation and rotation invalidation), in-place revocation (`TR-C3-01`), and `VARBINARY(32)` vs. `BINARY(32)` storage.
4. **D-05 (Temporal Storage):** Explicitly separates `DATETIMEOFFSET(7)` numeric UTC offset storage (`+00:00`) from application-layer IANA `Africa/Cairo` (`zoneinfo` + `tzdata`) handling.
5. **D-06 (Deployment Platform):** Separates the **`pyodbc` + system ODBC Driver `17`/`18`** runtime path from the **`mssql-python` (`mssql-python-odbc`)** runtime path and lists the exact production decisions required.

---

## 2. Correction 1 — D-01: `PendingApprovalRequest.id` (DB PK vs. Public/API Identifier)

- **Verified Facts:**
  - [`data-dictionary.md`](data-dictionary.md) (`§2.8` `L156`) defines a **single** column `id` (`approvalRequestId`) as `` `UNIQUEIDENTIFIER` / `NVARCHAR(64)` `` (`PROPOSED`).
  - [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) (`L50`) shows an illustrative `202 Accepted` response `"approvalRequestId": "apr-2026-0042"`, and `frontend/src/api/types.ts` (`L382`) types `approvalRequestId?: string`.
  - Neither `data-dictionary.md` nor [`logical-data-model.md`](logical-data-model.md) (`L171`) defines a separate `public_reference` or `request_code` column.
- **Technical Evaluation:**
  - Separating an internal `UNIQUEIDENTIFIER` PK from a separate public `apr-...` reference column is technically clean (compact `16`-byte PK + indexed `NVARCHAR(64)` public code), **but cannot be assumed or added without explicit requirements/Owner authorization**.
  - If `PendingApprovalRequest` remains a single `id` column serving both DB PK and API `approvalRequestId`, then choosing `UNIQUEIDENTIFIER` requires API payloads to emit UUID strings, whereas choosing `NVARCHAR(64)` supports `apr-...` prefixed strings directly.
- **Technical Recommendation (`TECHNICAL-RECOMMENDATION`):** Keep single-column `UNIQUEIDENTIFIER` (`models.UUIDField(primary_key=True, default=uuid.uuid4)`) **if** UUID `approvalRequestId` strings are acceptable; otherwise use `NVARCHAR(64)` (`CharField`) or explicitly authorize a separate public-reference field.
- **Preserved Owner Decision (`OWNER-DECISION-REQUIRED`):** Confirm whether `approvalRequestId` is a UUID (`UNIQUEIDENTIFIER`), an `apr-...` string (`NVARCHAR(64)`), or a dual-field design (requiring explicit schema addition).

---

## 3. Correction 2 — D-03: `QuizDefinition.passing_score` Unresolved Business Rules

- **Verified Facts:**
  - [`data-dictionary.md`](data-dictionary.md) (`§5.5` `L358`) proposes `INT NOT NULL CHECK (passing_score BETWEEN 0 AND 100)` (`PROPOSED`).
  - `frontend/src/test/approval-lifecycle-execution.test.ts` (`L670`) uses an illustrative `passingScore: 70`.
  - Neither `domain-06` nor `domain-14` establishes whether `passing_score` is a percentage or raw points, whether fractional scores are allowed, or how rounding works.
- **Unresolved Business Rules (`BUSINESS-CLARIFICATION-REQUIRED`):**
  1. **Unit:** Percentage (`0–100`) vs. raw points.
  2. **If Percentage:** Integer-only (`INT`) vs. fractional (`DECIMAL(5,2)`), and whether learner scores are rounded before threshold comparison.
  3. **If Raw Points (All 4 Rules Unresolved):**
     - **Maximum Score:** Fixed ceiling vs. derived sum of question weights/points (requires defining where `max_score` lives).
     - **Fractional Values:** Whether partial/fractional points (e.g., `0.5` or `12.5`) are permitted (`DECIMAL` vs. `INT`).
     - **Valid Range:** Lower bound (`>= 0` or `> 0`) and upper bound (`passing_score <= max_score`).
     - **Rounding & Comparison Rule:** Exact comparison (`earned_points >= passing_score`) vs. rounded comparison (`D-12` rounding applies to course `progress_percent`, not necessarily quiz pass evaluation).
- **Technical Recommendation (`TECHNICAL-RECOMMENDATION`):** Never use `FLOAT`. Defer physical column selection (`INT` vs. `DECIMAL(5,2)` vs. raw-point `DECIMAL(p,s)`) until the above business rules are clarified.

---

## 4. Correction 3 — D-04: `GroupQrCode.token_hash` Security & Storage Analysis

- **Verified Facts:**
  - [`data-dictionary.md`](data-dictionary.md) (`§8.3` `L486`) lists `token_hash` as `NVARCHAR(128)` (`PROPOSED`) with `is_enabled BIT NOT NULL DEFAULT 1`.
  - [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md) (`TR-C3-01` Option B, `OWNER-APPROVED`) defines one mutable `GroupQrCode` row per `TrainingGroup` (`UNIQUE(training_group_id)`), updated in place on regeneration.
  - `domain-09` does not specify the QR hashing algorithm. (`CertificateRecord.verification_token_hash` is `OWNER-APPROVED` `BINARY(32)` `SHA-256` per `TR-C3-03`.)
- **Security & Storage Evaluation:**
  1. **Threat Model & QR Token Entropy:** `GroupQrCode` requires `O(1)` `UNIQUE`-indexed lookup by `token_hash`. Slow password KDFs (Argon2/bcrypt) are unsuitable for deterministic indexed lookups. Instead, security relies on generating high-entropy CSPRNG raw tokens (`>= 128–256` bits, e.g., `secrets.token_urlsafe(32)`), making offline dictionary/brute-force attacks against a leaked DB computationally infeasible.
  2. **`SHA-256` vs. `HMAC-SHA256`:**
     - **`SHA-256`:** Keyless, `32`-byte digest, zero secret-rotation invalidation risk, directly matches `CertificateRecord.verification_token_hash` (`TR-C3-03`).
     - **`HMAC-SHA256`:** `32`-byte digest keyed by a server secret (`QR_TOKEN_HMAC_KEY` or `SECRET_KEY`), preventing offline verification even if the DB is compromised *while the key remains secret*. **Trade-off:** Requires secret-manager/env key storage separate from SQL Server, and **key rotation immediately invalidates all active QR codes** unless dual-key verification or a key-version column is added.
  3. **Revocation & Rotation:** Under `TR-C3-01` Option B, rotating a group QR overwrites `token_hash` in place (instantly revoking the previous QR), and disabling sets `is_enabled = 0`.
  4. **Storage (`VARBINARY(32)` vs. `BINARY(32)`):** Both occupy `32` bytes for a 256-bit digest and support SQL Server `UNIQUE` indexes (`32 <= 900/1700` bytes). In `mssql-django 2.0.0`, native `models.BinaryField(max_length=32)` emits **`VARBINARY(32)`**, whereas exact **`BINARY(32)`** requires a custom `FixedBinaryField(32)` (`db_type()` override).
- **Technical Recommendation (`TECHNICAL-RECOMMENDATION`):** **`SHA-256`** (or `HMAC-SHA256` if keyed defense-in-depth with key-rotation policy is accepted) stored as **`VARBINARY(32)`** via native `models.BinaryField(max_length=32)` (or `BINARY(32)` via `FixedBinaryField(32)`).
- **Preserved Owner Decision (`OWNER-DECISION-REQUIRED` / `BUSINESS-CLARIFICATION-REQUIRED`):** Confirm algorithm (`SHA-256` vs. `HMAC-SHA256` vs. other) and physical storage (`VARBINARY(32)` vs. `BINARY(32)`).

---

## 5. Correction 4 — D-05: UTC Offset Storage vs. IANA `Africa/Cairo` Handling

- **Verified Facts:**
  - [`data-dictionary.md`](data-dictionary.md) writes `DATETIME2(7)` (`38` timestamp fields); [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) §4 specifies `DATETIMEOFFSET(7)` + `USE_TZ=True`; [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md) (`TR-C3-04`) approves UTC storage with `Africa/Cairo` business timezone.
- **Explicit Architectural Distinction:**
  1. **Database Layer (`DATETIMEOFFSET(7)`):** Stores a **fixed numeric UTC offset** (`+00:00` when Django normalizes aware datetimes to UTC under `USE_TZ=True`). SQL Server `DATETIMEOFFSET(7)` does **not** store IANA timezone names (such as `Africa/Cairo`) and does **not** evaluate DST rules.
  2. **Application Layer (`Africa/Cairo` via `zoneinfo` + `tzdata`):** Django (`TIME_ZONE = 'Africa/Cairo'`, `USE_TZ = True`) and `mssql-django 2.0.0` (which uses stdlib `zoneinfo` + `tzdata`) handle all IANA `Africa/Cairo` DST conversions and UI/API/job-schedule projections in Python.
  3. **Date-Only Fields:** The `4` calendar-date fields (`User.appointment_date`, `User.date_of_birth`, `User.service_end_date`, `HistoricalServiceTrainingRecord.completion_date`) remain SQL **`DATE`**.
- **Technical Recommendation (`TECHNICAL-RECOMMENDATION`):** Standardize the `38` timestamp fields in `data-dictionary.md` on **`DATETIMEOFFSET(7)`** with `USE_TZ=True` (`+00:00` UTC storage) and `Africa/Cairo` application-layer display.
- **Preserved Owner Decision (`OWNER-DECISION-REQUIRED`):** Approve updating `data-dictionary.md` `DATETIME2(7)` notation to `DATETIMEOFFSET(7)`.

---

## 6. Correction 5 — D-06: Separate `pyodbc` vs. `mssql-python` Deployment Paths

- **Verified Official Package & Platform Matrix (`mssql-django==2.0.0`, PyPI & GitHub `2026-09-18`):**
  - **Shared Package Dependencies (`requires_dist`):** `django>=5.2,<6.2`, `python>=3.10` (`3.12–3.13` recommended for MetroLMS + Django `5.2` LTS), `pyodbc>=3.0`, **`mssql-python>=1.15.0` (mandatory install dependency regardless of runtime driver)**, and `tzdata`.
  - **Supported OS/CPU Platforms (governed by `mssql-python` wheels):** Windows `x64`, Windows `ARM64` (`Python 3.11+`), macOS `15+` (Intel/Apple silicon), Linux `x64`/`ARM64` with `glibc 2.28+` or `musl 1.2+` (SUSE Linux ARM64 unsupported; unsupported environments must pin `mssql-django==1.8.0`).
  - **Supported SQL Server Targets:** SQL Server `2017`, `2019`, `2022`, `2025` (plus Azure SQL / Microsoft Fabric).

| Dimension | Path A: `pyodbc` Runtime Path (Default) | Path B: `mssql-python` Runtime Path (Opt-In) |
| :--- | :--- | :--- |
| **Django Configuration** | Default (`OPTIONS['python_driver']` unset or `'pyodbc'`) | Per-alias opt-in: `OPTIONS: {'python_driver': 'mssql_python'}` |
| **Native Connectivity** | Requires **system-installed Microsoft ODBC Driver** (`ODBC Driver 18 for SQL Server` attempted first, fallback to `ODBC Driver 17` if `'driver'` omitted) | Uses bundled **`mssql-python-odbc` (ODBC Driver 18)**; no separate manual system ODBC Driver install required |
| **`mssql-python` Package** | Still installed as a mandatory pip dependency of `mssql-django 2.0.0` | Installed as mandatory dependency and used as active runtime driver |
| **Maturity in `mssql-django`** | Default, long-standing production path | Newly introduced in `mssql-django 2.0.0` (`2026-09-18`) |

- **Production Decisions Required (`INFRASTRUCTURE-DECISION-REQUIRED`):**
  1. Target **Operating System & Version** (e.g., Windows Server version or Linux distro/libc).
  2. Target **CPU Architecture** (`x64` vs. `ARM64`).
  3. Target **Microsoft SQL Server Version** (`2017–2025`).
  4. Selected **Runtime Driver Path** (`pyodbc` + system ODBC Driver `17`/`18` vs. `mssql-python`).

---

## 7. Governance & Final Verification Status

- **New Report Created:** [`deferred-decisions-resolution-corrections.md`](deferred-decisions-resolution-corrections.md) (this file only).
- **Existing Files Modified:** **None (`0` modified).**
- **Data Dictionary:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- **WP-5.6:** `BLOCKED — NOT AUTHORIZED`.
- **Implementation Work:** None performed.

**`DEFERRED DECISIONS CORRECTIONS COMPLETED — OWNER DECISIONS REQUIRED — WP-5.6 NOT AUTHORIZED.`**

