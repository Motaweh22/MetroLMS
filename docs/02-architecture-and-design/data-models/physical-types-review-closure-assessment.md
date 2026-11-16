# MetroLMS — Final Physical Types Review Closure Assessment (`WP-5.5`)

> **Document Status:** `TECHNICAL-ASSESSMENT — CLOSURE-READINESS REPORT (REPORT-ONLY)`  
> **Scope:** Final closure-readiness assessment of the `WP-5.5` Physical Types technical review workstream across all `8` completed reports and authoritative project governance documents.  
> **Governance Notice:** **Zero existing project files were modified.** `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`. `decision-register.md`, `CP-010`–`CP-012`, `CURRENT.md`, `active-roadmap.md`, and all `8` prior reports remain completely untouched. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

This assessment evaluates whether the `WP-5.5` Physical Types technical review workstream (spanning `8` completed reports) is complete and ready for technical review closure, while separating technical review completeness from Data Dictionary freezing and `WP-5.6` implementation authorization:

1. **Physical Types Technical Review Workstream:** **`COMPLETE WITH DEFERRED ITEMS`**. All `302` mapped fields across all `54` active entities (`InPersonAttendanceRecord` `DEFERRED` excluded), plus `mssql-django 2.0.0` / Django `5.2` LTS / Python `3.12–3.13` / SQL Server compatibility, have been audited, reconciled, and verified against official sources.
2. **Data Dictionary Freeze:** **NOT AUTHORIZED (`UNFROZEN`)**. [`data-dictionary.md`](data-dictionary.md) remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN` until the `6` preserved unresolved items (including `DATETIME2(7)` vs. `DATETIMEOFFSET(7)` reconciliation and `4` catalog FKs) are formally decided.
3. **`WP-5.6` Authorization:** **`BLOCKED — NOT AUTHORIZED`**. No Django models, migrations, SQL DDL, dependency pins, or database connections are authorized.
4. **Unresolved Decisions Preserved:** All `6` unresolved items (`PendingApprovalRequest.id`, `4` catalog FK alignment alternatives, `QuizDefinition.passing_score`, `GroupQrCode.token_hash` algorithm, `DATETIME2` vs. `DATETIMEOFFSET` conflict, and undocumented deployment OS/architecture) are preserved without silent resolution.

---

## 2. Sources Inspected

| Source | Path / Reference | Authority / Classification |
| :--- | :--- | :--- |
| 1. String Length Recommendations | [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) | `TECHNICAL-RECOMMENDATION` (`WP-5.6` prep) |
| 2. Physical Storage Review | [`physical-storage-recommendations-review.md`](physical-storage-recommendations-review.md) | `TECHNICAL-RECOMMENDATION` (`WP-5.6` prep) |
| 3. Django Type Mapping Verification | [`django-sqlserver-physical-type-mapping-review.md`](django-sqlserver-physical-type-mapping-review.md) | `TECHNICAL-VERIFICATION` (`WP-5.6` prep) |
| 4. Numeric & Temporal Review | [`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md) | `TECHNICAL-REVIEW` (`WP-5.6` prep) |
| 5. Reconciliation Supplement | [`physical-types-reconciliation-supplement.md`](physical-types-reconciliation-supplement.md) | `TECHNICAL-AUDIT` (`WP-5.6` prep) |
| 6. Final Correction Audit | [`physical-types-final-correction-audit.md`](physical-types-final-correction-audit.md) | `TECHNICAL-AUDIT` (`WP-5.6` prep) |
| 7. `mssql-django` Version Verification | [`mssql-django-version-verification-correction.md`](mssql-django-version-verification-correction.md) | `TECHNICAL-AUDIT` (`WP-5.6` prep) |
| 8. Python / Django Compatibility Clarification | [`python-django-compatibility-clarification.md`](python-django-compatibility-clarification.md) | `TECHNICAL-AUDIT` (`WP-5.6` prep) |
| Canonical Data Dictionary | [`data-dictionary.md`](data-dictionary.md) | `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN` |
| Django + SQL Server Contract | [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) | Authoritative target stack contract (`D-DB-01`, `D-AUTH-01`) |
| Owner Decision Register | [`decision-register.md`](../../architecture/decision-register.md) | Authoritative Owner decisions (`D-DB-01`, `D-AUTH-01`, `D-SEC-01`, `D-MEDIA-01`) |
| Checkpoints & Project State | [`CP-010`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md), [`CP-011`](../../project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md), [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md), [`CURRENT.md`](../../project-state/CURRENT.md), [`active-roadmap.md`](../../project-state/active-roadmap.md) | Immutable checkpoints & authoritative state dashboard / living master plan |

---

## 3. Physical Types Review Coverage Matrix

| Workstream Area | Scope Covered | Workstream Status | Rationale |
| :--- | :--- | :---: | :--- |
| **A. String Types** | All `103` `NVARCHAR` fields (`15` `OWNER-APPROVED` + `88` `TECHNICAL-RECOMMENDATION`, including `NVARCHAR(MAX)` JSON/body fields) | **`COMPLETE`** | All `15` Owner-approved lengths preserved immutable; `88` remaining lengths recommended (`NVARCHAR(MAX)` for unbounded JSON/text); `PendingApprovalRequest.id` conflict isolated to `§6` |
| **B. Binary Types & Hash Storage** | `CertificateRecord.verification_token_hash`, `MediaAsset.sha256_checksum`, `GroupQrCode.token_hash`, `BinaryField` vs. `FixedBinaryField(32)` | **`COMPLETE WITH DEFERRED ITEMS`** | `BINARY(32)` vs. `VARBINARY(32)` `mssql-django` behavior verified (`BinaryField(max_length=32)` emits `VARBINARY(32)`; `FixedBinaryField(32)` needed for `BINARY(32)`); `GroupQrCode.token_hash` algorithm deferred to Owner/security confirmation |
| **C. Numeric, Integer & Boolean Types** | `54`-entity PK inventory (`47+3+3+1`), `84` integer FKs (`ON DELETE NO ACTION`), `DECIMAL(5,2)`, integer counters, `12` `BIT NOT NULL` flags | **`COMPLETE WITH DEFERRED ITEMS`** | All `54` active entities (`InPersonAttendanceRecord` `DEFERRED` excluded) and `84` FKs (`80/84` match, `4/84` catalog mismatches) accounted for; `QuizDefinition.passing_score` and `4` catalog FKs preserved for decision |
| **D. Temporal Types** | `4` `DATE` fields, `38` `DATETIME2(7)` vs. `DATETIMEOFFSET(7)` timestamps, `USE_TZ=True`, UTC (`+00:00`), `Africa/Cairo` display | **`COMPLETE WITH DEFERRED ITEMS`** | `mssql-django` `USE_TZ=True` -> `DATETIMEOFFSET(7)` / `USE_TZ=False` -> `DATETIME2(7)` verified; Data Dictionary reconciliation deferred until Owner approval |
| **E. Django & SQL Server Compatibility** | `Python 3.12–3.13`, `Django 5.2 LTS`, `mssql-django==2.0.0`, SQL Server `2017–2025`, `pyodbc` (default) + `mssql-python` (mandatory dep) | **`COMPLETE`** | Verified directly against PyPI JSON API, GitHub Releases (`2.0.0`, `2026-09-18`), `.github/workflows/test.yml`, and Django `5.2` docs |
| **F. Deployment Platform Dependency** | OS & CPU architecture compatibility for `mssql-django 2.0.0` (`mssql-python` wheel requirement) | **`BLOCKED`** *(Compatibility `UNRESOLVED`)* | Production deployment OS version & CPU architecture (`x64` vs. `ARM64`, Windows vs. Linux) are not formally locked in authoritative docs |

---

## 4. Confirmed `OWNER-APPROVED` Decisions (Preserved Immutable)

- **Database Engine (`D-DB-01`):** Microsoft SQL Server with Django + DRF (PostgreSQL prohibited).
- **Session Architecture (`D-AUTH-01`):** Django server-side sessions (`ServerSession` / `django_session` `NVARCHAR(MAX)`).
- **`User.id` (`CP-010` `CP1 #1`):** `BIGINT IDENTITY(1,1)` / `BigAutoField`.
- **`15` Approved String Lengths (`CP-010`–`CP-012`):** `User.full_name` (`200`), `User.educational_qualification` (`500`), `User.address` (`500`), `DeletedUserTombstone.reason` (`1000`); `Course.title` (`255`), `Module.title` (`255`), `LessonItem.title` (`255`), `LessonItem.external_video_url` (`2048`), `CourseCommentReport.reason` (`500`), `MediaContentReference.title` (`255`); `TrainingGroup.name` (`255`), `GroupResource.title` (`255`), `GroupResource.meeting_url` (`2048`), `NotificationItem.title` (`255`), `WhatsAppContact.label` (`150`).
- **`CertificateRecord.verification_token_hash` (`CP-012` `TR-C3-03`):** `BINARY(32)` `UNIQUE` (`SHA-256`).
- **Temporal & Retry Rules (`CP-012` `TR-C3-04`):** `Africa/Cairo` business timezone; `ScheduledJobRun.retry_count` max `2` (`3` total attempts).
- **Referential Integrity:** `ON DELETE NO ACTION` across all `84` integer FKs.

---

## 5. Validated `TECHNICAL-RECOMMENDATION`s (Not Owner-Approved)

1. **Candidate Backend Stack:** **Python `3.12–3.13` + Django `5.2` LTS + `mssql-django==2.0.0` + `pyodbc`** (default runtime driver, `ODBC Driver 18/17 for SQL Server`), with `mssql-python>=1.15.0` installed as a mandatory dependency and optional per-alias opt-in.
2. **String Fields:** `88` recommended `NVARCHAR` / `NVARCHAR(MAX)` lengths (preserving `ServerSession.session_data NVARCHAR(MAX)` and `User.password_hash NVARCHAR(255)`).
3. **Binary Fields:** `FixedBinaryField(32)` (`db_type()` override) for `BINARY(32)` (`CertificateRecord.verification_token_hash` and `MediaAsset.sha256_checksum`), or standard `BinaryField(max_length=32)` (`VARBINARY(32)`). Never omit `max_length` on indexed `BinaryField`s.
4. **Numeric, Boolean & Temporal:** `46` operational `BIGINT` PKs (with `User.id` = `47`), `LessonProgress.progress_percent` `DECIMAL(5,2)`, `MediaAsset.size_bytes` `BIGINT`, `12` `BIT NOT NULL` flags, `4` `DATE` fields, and `DATETIMEOFFSET(7)` (`USE_TZ=True`, UTC `+00:00` storage, `Africa/Cairo` display) for the `38` timestamps.

---

## 6. Remaining Unresolved Decisions (Explicitly Preserved)

| # | Unresolved Item | Current Status / Classification | Open Question / Required Decision |
| :---: | :--- | :---: | :--- |
| **1** | `PendingApprovalRequest.id` | `PROPOSED` (Unresolved) | Confirm `approvalRequestId` format: UUID (`UNIQUEIDENTIFIER`) vs. opaque prefixed string `apr-...` (`NVARCHAR(64)`). |
| **2** | `4` Catalog FK Mismatches (`User.metro_line_id`, `User.marital_status_id`, `User.military_service_status_id`, `CourseAudienceMetroLine.metro_line_id`) | `PROPOSED` / `TECHNICAL-RECOMMENDATION` | Choose Alternative 1 (change `4` FKs to `INT`) or Alternative 2 (promote `3` catalog PKs to `BIGINT`). |
| **3** | `QuizDefinition.passing_score` | `UNRESOLVED-BUSINESS-RULE` | Confirm business unit/scale: integer percentage (`0–100`), fractional percentage (`DECIMAL(5,2)`), or raw point score. |
| **4** | `GroupQrCode.token_hash` Algorithm | `NEEDS-BUSINESS-CLARIFICATION` | Confirm cryptographic hash algorithm (`SHA-256` vs. `SHA-512` vs. alternative); `BINARY(32)`/`VARBINARY(32)` is conditional on `SHA-256`. |
| **5** | `DATETIME2(7)` vs. `DATETIMEOFFSET(7)` | `TECHNICAL-RECOMMENDATION` vs. `data-dictionary.md` | Reconcile `data-dictionary.md` `DATETIME2(7)` notation with `django-sqlserver-integration-contract.md` §4 (`DATETIMEOFFSET(7)` + `USE_TZ=True`). |
| **6** | Production Deployment OS & Architecture | **`UNRESOLVED`** | Confirm target production OS, version, and CPU architecture (`x64` vs. `ARM64`, glibc/musl if Linux). |

---

## 7. Deployment Compatibility Assessment

- **Package Requirement:** `mssql-django 2.0.0` mandates `mssql-python >= 1.15.0` at install time, restricting installation to: Windows `x64`, Windows `ARM64` (`Python 3.11+`), macOS `15+` (Intel/Apple silicon), or Linux `x64`/`ARM64` with `glibc 2.28+` / `musl 1.2+` (SUSE Linux ARM64 unsupported; other environments must use `mssql-django==1.8.0`).
- **MetroLMS Documentation Check:** `INV-DOM21-06` (`django-sqlserver-integration-contract.md` `L90`) references an illustrative `Windows Server` (`D:\MetroLMSMedia\`), but **no authoritative document formally specifies the production OS version or CPU architecture** (`x64` vs. `ARM64`, or containerized Linux distro).
- **Assessment Status:** Deployment platform compatibility is **`UNRESOLVED`** (do not assume Windows/Linux or claim final deployment compatibility until the Owner confirms the target OS and architecture).

---

## 8. Cross-Report Consistency Assessment

Across all `8` reports, early inconsistencies (`PendingApprovalRequest.id` dual-type confusion, `54`-entity PK inventory counting, `4` catalog FK mismatches, `mssql-django 2.0.1` vs. `2.0.0`, and `Python 3.14` tested-vs-declared scope) have been **fully reconciled and superseded by the latest corrective audits** (`physical-types-final-correction-audit.md`, `mssql-django-version-verification-correction.md`, and `python-django-compatibility-clarification.md`), with zero unaddressed contradictions remaining.

---

## 9. Closure Readiness Decision

1. **Physical Types Technical Review Workstream:** **`COMPLETE WITH DEFERRED ITEMS`** — Ready for technical review closure with the `6`-item unresolved register in Section 6.
2. **Data Dictionary Freeze:** **NOT READY / NOT AUTHORIZED** (`data-dictionary.md` remains `UNFROZEN`).
3. **`WP-5.6` Authorization:** **`BLOCKED — NOT AUTHORIZED`**.
4. **Owner Decisions Required Before Physical Implementation:** Yes — all `6` items in Section 6 must be resolved before `WP-5.6` DDL/migration generation.

---

## 10. Required Future Owner Decisions

1. Lock `PendingApprovalRequest.id` (`UNIQUEIDENTIFIER` vs. `NVARCHAR(64)`).
2. Select Catalog FK alignment strategy (Alternative 1: `INT` FKs vs. Alternative 2: `BIGINT` catalog PKs).
3. Define `QuizDefinition.passing_score` unit and precision.
4. Confirm `GroupQrCode.token_hash` algorithm (`SHA-256` vs. alternative).
5. Approve `DATETIMEOFFSET(7)` + `USE_TZ=True` reconciliation in `data-dictionary.md`.
6. Confirm production deployment OS, version, and CPU architecture (`x64`/`ARM64`) and approve the `Python 3.12–3.13 + Django 5.2 LTS + mssql-django==2.0.0` baseline.

---

## 11. Governance & Authorization Status

- **New Report Created:** [`physical-types-review-closure-assessment.md`](physical-types-review-closure-assessment.md) (this file only).
- **Existing Files Modified:** **None (`0` modified).**
- **Data Dictionary:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- **WP-5.6:** `BLOCKED — NOT AUTHORIZED`.
- **Implementation Work:** None performed (zero models, migrations, DDL, dependency edits, or DB connections).

**`PHYSICAL TYPES REVIEW CLOSURE ASSESSMENT COMPLETED — WP-5.6 NOT AUTHORIZED.`**

