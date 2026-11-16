# MetroLMS — Deferred Decisions Resolution Assessment (`WP-5.5` Post-Closure)

> **Document Status:** `TECHNICAL-ASSESSMENT — DEFERRED DECISIONS RESOLUTION (REPORT-ONLY)`  
> **Trigger:** Formal closure of `WP-5.5` Physical Types Technical Review (`CLOSED — COMPLETE WITH DEFERRED ITEMS`, [`wp-5-5-physical-types-review-closure.md`](wp-5-5-physical-types-review-closure.md))  
> **Architecture Baseline:** React 19 + TypeScript (Frontend) | Python `3.12–3.13` + Django `5.2` LTS + DRF + `mssql-django==2.0.0` (Backend) | **Microsoft SQL Server** (`D-DB-01`, PostgreSQL prohibited)  
> **Governance Notice:** **Zero existing project files were modified.** `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`. `CP-010`–`CP-012`, `decision-register.md`, `CURRENT.md`, `active-roadmap.md`, and all prior reports remain untouched. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

Following the Owner-approved closure of the `WP-5.5` Physical Types Technical Review (`COMPLETE WITH DEFERRED ITEMS`), **six (`6`) deferred decisions** (`D-01` through `D-06`) block `data-dictionary.md` freezing and `WP-5.6` entry. This report analyzes all six items with evidence-based technical alternatives, trade-offs, and explicit Owner decision prompts:

- **D-01 (`PendingApprovalRequest.id`):** `TECHNICAL-RECOMMENDATION` favors `UNIQUEIDENTIFIER` (`UUIDField`), unless API consumers require an `apr-...` prefixed string (`NVARCHAR(64)`).
- **D-02 (Catalog FK Alignment):** `TECHNICAL-RECOMMENDATION` slightly favors promoting the `3` small catalog PKs to `BIGINT` for uniform `BigAutoField` consistency (vs. converting the `4` FKs to `INT`); both resolve all `84/84` integer FKs cleanly.
- **D-03 (`QuizDefinition.passing_score`):** `BUSINESS-CLARIFICATION-REQUIRED` first (percentage vs. raw points, integer vs. fractional, rounding); `TECHNICAL-RECOMMENDATION` is `INT` (`0–100`) or `DECIMAL(5,2)` (`0.00–100.00`), never `FLOAT`.
- **D-04 (`GroupQrCode.token_hash`):** `OWNER-DECISION-REQUIRED` / `BUSINESS-CLARIFICATION-REQUIRED` on algorithm; `TECHNICAL-RECOMMENDATION` is `SHA-256` (or `HMAC-SHA256`) stored as `VARBINARY(32)` (`BinaryField(max_length=32)`) or `BINARY(32)`.
- **D-05 (Timestamp Storage):** `TECHNICAL-RECOMMENDATION` resolves the `data-dictionary.md` (`DATETIME2(7)`) vs. `django-sqlserver-integration-contract.md` (`DATETIMEOFFSET(7)`) conflict in favor of **`DATETIMEOFFSET(7)`** with `USE_TZ=True`, UTC `+00:00` storage, and `Africa/Cairo` display.
- **D-06 (Production Deployment Platform):** `INFRASTRUCTURE-DECISION-REQUIRED` (`UNRESOLVED`); Owner must confirm OS, OS version, CPU architecture (`x64`/`ARM64`), and SQL Server / ODBC Driver `17`/`18` target.

---

## 2. Current Status of All Six Deferred Decisions

| ID | Topic | Current Classification | Current State |
| :---: | :--- | :---: | :--- |
| **D-01** | `PendingApprovalRequest.id` (`UNIQUEIDENTIFIER` vs. `NVARCHAR(64)`) | `OWNER-DECISION-REQUIRED` / `UNRESOLVED` | Dual `PROPOSED` entry in `data-dictionary.md` §2.8 `L156` |
| **D-02** | `4` Catalog FKs (`User.*_id`, `CourseAudienceMetroLine.metro_line_id`) | `OWNER-DECISION-REQUIRED` / `UNRESOLVED` | `4/84` `BIGINT`-to-`INT` mismatches in `data-dictionary.md` |
| **D-03** | `QuizDefinition.passing_score` | `BUSINESS-CLARIFICATION-REQUIRED` / `UNRESOLVED` | `PROPOSED` `INT CHECK (0..100)` in `data-dictionary.md` §5.5 `L358`; `domain-06`/`14` silent on unit/decimals |
| **D-04** | `GroupQrCode.token_hash` Algorithm & Storage | `OWNER-DECISION-REQUIRED` / `BUSINESS-CLARIFICATION-REQUIRED` | `PROPOSED` `NVARCHAR(128)` in `data-dictionary.md` §8.3 `L486`; `domain-09` algorithm unspecified |
| **D-05** | Timestamp Storage (`DATETIME2(7)` vs. `DATETIMEOFFSET(7)`) | `OWNER-DECISION-REQUIRED` / `UNRESOLVED` | `data-dictionary.md` uses `DATETIME2(7)`; `django-sqlserver-integration-contract.md` §4 requires `DATETIMEOFFSET(7)` |
| **D-06** | Production Deployment OS, Version & CPU Architecture | `INFRASTRUCTURE-DECISION-REQUIRED` / `UNRESOLVED` | Illustrative `Windows Server` (`INV-DOM21-06`) & `Windows Task Scheduler` (`TR-C3-04`), but no formal OS/arch lock |

---

## 3. Source References & Evidence Inspected

- [`data-dictionary.md`](data-dictionary.md) (`§2.1`, `§2.5`, `§2.8` `L156`, `§5.2`, `§5.5` `L358`, `§8.3` `L486`)
- [`decision-register.md`](../../architecture/decision-register.md) (`D-DB-01`, `D-AUTH-01`, `D-SEC-01`, `D-MEDIA-01`)
- [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) (`§1`, `§3` `INV-DOM21-06`, `§4`)
- [`CP-010`](../../project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md), [`CP-011`](../../project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md), [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md) (`TR-C3-01`, `TR-C3-03`, `TR-C3-04`)
- [`wp-5-5-physical-types-review-closure.md`](wp-5-5-physical-types-review-closure.md), [`physical-types-review-closure-assessment.md`](physical-types-review-closure-assessment.md), [`physical-types-review-closure-corrections.md`](physical-types-review-closure-corrections.md)
- [`django-sqlserver-physical-type-mapping-review.md`](django-sqlserver-physical-type-mapping-review.md), [`mssql-django-version-verification-correction.md`](mssql-django-version-verification-correction.md), [`python-django-compatibility-clarification.md`](python-django-compatibility-clarification.md)
- Frontend/backend API contract references: `frontend/src/api/types.ts` (`L382`: `approvalRequestId?: string`), [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) (`L50` illustrative envelope `"approvalRequestId": "apr-2026-0042"`)

---

## 4–6. Detailed Analysis, Trade-Offs & Technical Recommendations

### D-01 — `PendingApprovalRequest.id` (`OWNER-DECISION-REQUIRED`)
- **Alternatives:**
  - **Option A (`UNIQUEIDENTIFIER`):** `models.UUIDField(primary_key=True, default=uuid.uuid4)`.
    - *Pros:* Fixed `16` bytes (`4–8x` smaller PK/index than `NVARCHAR(64)`), native SQL Server UUID validation, zero collation overhead, standard Django `UUIDField`.
    - *Cons:* Cannot store non-UUID prefixes like `apr-...` (API returns canonical UUID strings).
  - **Option B (`NVARCHAR(64)`):** `models.CharField(max_length=64, primary_key=True)`.
    - *Pros:* Accepts `apr-...` prefixed strings (matching the illustrative `"apr-2026-0042"` example in `django-sqlserver-integration-contract.md` `L50`) or UUID strings (`types.ts:382` is `string`).
    - *Cons:* Up to `128` UTF-16 bytes per PK/index entry, requires custom app-layer ID generator and format `CHECK`/validator.
- **Migration Impact:** Changing PK type post-`0001_initial` is destructive/table-rebuilding; must be locked before `WP-5.6`.
- **`TECHNICAL-RECOMMENDATION`:** **Option A (`UNIQUEIDENTIFIER` / `UUIDField`)** unless API consumers specifically depend on an `apr-...` string prefix.
- **Explicit Owner Decision Required:** Choose **Option A (`UNIQUEIDENTIFIER`)** or **Option B (`NVARCHAR(64)`)**.

### D-02 — Catalog FK Alignment (`OWNER-DECISION-REQUIRED`)
- **Affected Relationships (`4` FKs targeting `3` catalogs, all `ON DELETE NO ACTION`):**
  - `User.metro_line_id` → `MetroLine.id`
  - `User.marital_status_id` → `MaritalStatusCatalog.id`
  - `User.military_service_status_id` → `MilitaryServiceStatusCatalog.id`
  - `CourseAudienceMetroLine.metro_line_id` → `MetroLine.id`
- **Alternatives:**
  - **Option A (Convert `4` FKs to `INT`):** Keep `MetroLine`, `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog` PKs as `INT` (`AutoField`); `models.ForeignKey` generates `INT` on `User` (`3` FKs) and `CourseAudienceMetroLine` (`1` FK).
    - *Pros:* Saves `12` bytes/row on `User` and `4` bytes/row on `CourseAudienceMetroLine`; preserves `47 BIGINT + 3 INT + 3 String + 1 PendingApprovalRequest = 54` PK inventory.
    - *Cons:* Requires manual `id = models.AutoField(primary_key=True)` overrides on `3` models when `DEFAULT_AUTO_FIELD` is `BigAutoField`.
  - **Option B (Promote `3` Catalog PKs to `BIGINT`):** All `50` integer-PK models use `BigAutoField`; all `84` integer FKs are `BIGINT`.
    - *Pros:* 100% uniform `BIGINT` integer-key convention across Django (`DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'`); eliminates mixed `INT`/`BIGINT` catalog surprises.
    - *Cons:* `+12` bytes/row on `User` (negligible at enterprise transit scale).
- **`TECHNICAL-RECOMMENDATION`:** **Option B (Promote `3` catalog PKs to `BIGINT`)** for uniform `BigAutoField` simplicity (with Option A equally valid if `4`-byte FK savings are preferred).
- **Explicit Owner Decision Required:** Approve **Option A (`INT` FKs)** or **Option B (`BIGINT` catalog PKs)**.

### D-03 — `QuizDefinition.passing_score` (`BUSINESS-CLARIFICATION-REQUIRED`)
- **Alternatives:**
  - **Option A (`INT`, `CHECK (0..100)`):** `models.IntegerField` — integer percentage (`0%–100%`).
  - **Option B (`DECIMAL(5,2)`, `CHECK (0.00..100.00)`):** `models.DecimalField(max_digits=5, decimal_places=2)` — fractional percentage matching `LessonProgress.progress_percent`.
  - **Option C (`DECIMAL(7,2)` or `INT >= 0`):** Raw point threshold (not bounded to `100`).
- **Business Rules Requiring Clarification:** (1) Is `passing_score` a **percentage** (`0–100`) or **raw points**? (2) Are **fractional values** (e.g., `75.50%`) permitted? (3) What **rounding/comparison rule** applies (e.g., `score >= passing_score` exact, or rounded per `D-12`)?
- **`TECHNICAL-RECOMMENDATION`:** Never use `FLOAT`. Use **Option A (`INT`)** if integer percentage, or **Option B (`DECIMAL(5,2)`)** if fractional percentage.
- **Explicit Owner Clarification Required:** Confirm unit, fractionality, range, and rounding rule.

### D-04 — `GroupQrCode.token_hash` (`OWNER-DECISION-REQUIRED` + `BUSINESS-CLARIFICATION-REQUIRED`)
- **Context:** `TR-C3-01` (`CP-012`) defines a single mutable `GroupQrCode` row per `TrainingGroup` (`UNIQUE(training_group_id)`), updated in place on regeneration; `token_hash` is `UNIQUE`-indexed for O(1) join-token lookup. `CertificateRecord.verification_token_hash` is `OWNER-APPROVED` `BINARY(32)` (`SHA-256`, `TR-C3-03`).
- **Alternatives:**
  - **Option A (`SHA-256` -> `VARBINARY(32)` / `BINARY(32)`):** `32`-byte digest (`hashlib.sha256` on high-entropy random token). Native `BinaryField(max_length=32)` emits `VARBINARY(32)` (index/`UNIQUE`-safe); `FixedBinaryField(32)` emits `BINARY(32)`.
  - **Option B (`HMAC-SHA256` -> `VARBINARY(32)` / `BINARY(32)`):** Same `32`-byte storage, keyed with server secret (`SECRET_KEY` or dedicated QR HMAC key) so offline brute-force is infeasible even if DB is leaked (note: key rotation invalidates active QR tokens unless versioned).
  - **Option C (`SHA-512` -> `VARBINARY(64)` / `BINARY(64)`):** `64`-byte digest (`2x` index key size, unnecessary for high-entropy CSPRNG tokens).
  - **Option D (`NVARCHAR(64)` / `NVARCHAR(128)` hex):** `128–256` UTF-16 bytes + collation overhead.
- **`TECHNICAL-RECOMMENDATION`:** **Option A (`SHA-256` stored as `VARBINARY(32)` via `models.BinaryField(max_length=32)`)** — or **Option B (`HMAC-SHA256`)** if server-keyed hashing is preferred — aligning 32-byte digest architecture with `CertificateRecord` while supporting instant `UNIQUE` lookup and in-place regeneration/revocation (`is_enabled = 0`).
- **Explicit Owner Decision Required:** Confirm hash algorithm (`SHA-256` vs. `HMAC-SHA256` vs. `SHA-512`) and storage (`VARBINARY(32)` vs. `BINARY(32)`).

### D-05 — Timestamp Storage `DATETIME2(7)` vs. `DATETIMEOFFSET(7)` (`OWNER-DECISION-REQUIRED`)
- **Conflict:** `data-dictionary.md` lists `DATETIME2(7)` (`38` fields); `django-sqlserver-integration-contract.md` §4 specifies `DATETIMEOFFSET(7)` + `USE_TZ=True`.
- **Alternatives:**
  - **Option A (`DATETIMEOFFSET(7)` + `USE_TZ=True`):** `10` bytes/value. Native `mssql-django 2.0.0` mapping for `DateTimeField` under `USE_TZ=True` (`Now()` -> `SYSDATETIMEOFFSET()`). Stores numeric `+00:00` UTC offset; Django `zoneinfo` (`TIME_ZONE = 'Africa/Cairo'`) projects local `Africa/Cairo` time. `4` calendar-date fields remain `DATE`.
  - **Option B (`DATETIME2(7)` + `USE_TZ=False`):** `8` bytes/value (`-2` bytes), naive datetimes, disables Django timezone-aware ORM guards and conflicts with `django-sqlserver-integration-contract.md` §4. Switching to `USE_TZ=True` later does **not** auto-migrate `DATETIME2` columns.
- **`TECHNICAL-RECOMMENDATION`:** **Option A (`DATETIMEOFFSET(7)` + `USE_TZ=True`, UTC `+00:00` storage, `Africa/Cairo` display)**, updating `data-dictionary.md` notation before `WP-5.6`.
- **Explicit Owner Decision Required:** Approve updating the `38` timestamp fields in `data-dictionary.md` from `DATETIME2(7)` to `DATETIMEOFFSET(7)` (preserving `DATE` for the `4` calendar-date fields).

### D-06 — Production Deployment Platform (`INFRASTRUCTURE-DECISION-REQUIRED`)
- **Verified Compatibility (`mssql-django==2.0.0` + `Django 5.2 LTS` + `Python 3.12–3.13`):**
  - `mssql-django 2.0.0` requires `mssql-python>=1.15.0` at install time, restricting installation to: **Windows `x64`**, **Windows `ARM64` (`Python 3.11+`)**, **macOS `15+`**, and **Linux `x64`/`ARM64` (`glibc 2.28+` or `musl 1.2+`)** (SUSE Linux ARM64 unsupported; other platforms must pin `mssql-django==1.8.0`).
  - Default runtime driver **`pyodbc`** requires **`Microsoft ODBC Driver 18`** or **`17 for SQL Server`**; target database must be **SQL Server `2017`, `2019`, `2022`, or `2025`**.
- **Gap:** `INV-DOM21-06` and `TR-C3-04` mention `Windows Server` / `Windows Task Scheduler` illustratively, but no authoritative specification locks the production OS version, CPU architecture, or SQL Server version.
- **Explicit Infrastructure Decision Required:** Confirm (1) Production OS & version, (2) CPU architecture (`x64` vs. `ARM64`), (3) SQL Server version (`2017–2025`), and (4) ODBC Driver `17`/`18` availability.

---

## 7–8. Impact on Data Dictionary, Django Mapping & Future Migrations

- **Before `WP-5.6` (`0001_initial.py`):** Resolving `D-01`, `D-02`, `D-03`, `D-04`, and `D-05` updates only `data-dictionary.md` (if authorized by Owner) **before** freezing and **before** any Django `0001_initial.py` migration is generated, avoiding costly post-creation `ALTER COLUMN` / PK-rebuild migrations.
- **After `WP-5.6`:** All `6` decisions are expensive to change once tables exist (`PendingApprovalRequest.id` PK type, `DATETIME2` -> `DATETIMEOFFSET` conversion, or catalog PK/FK `INT` -> `BIGINT` alters).

---

## 9. Consolidated Owner Decision Register

| ID | Decision Required | Recommended Option (`TECHNICAL-RECOMMENDATION`) | Owner Selection |
| :---: | :--- | :--- | :--- |
| **D-01** | `PendingApprovalRequest.id` type | `UNIQUEIDENTIFIER` (`UUIDField`) | `[ ] Option A (UUID)  [ ] Option B (NVARCHAR(64))` |
| **D-02** | `4` Catalog FKs alignment | Promote `3` catalog PKs to `BIGINT` (or `INT` FKs) | `[ ] Option A (INT FKs)  [ ] Option B (BIGINT PKs)` |
| **D-03** | `QuizDefinition.passing_score` unit & precision | `INT (0–100)` or `DECIMAL(5,2)` (pending business rule) | `[ ] INT %  [ ] DECIMAL(5,2) %  [ ] Raw Points` |
| **D-04** | `GroupQrCode.token_hash` algorithm & storage | `SHA-256` (or `HMAC-SHA256`) + `VARBINARY(32)` / `BINARY(32)` | `[ ] SHA-256  [ ] HMAC-SHA256  [ ] Other: ____` |
| **D-05** | Timestamp storage alignment | `DATETIMEOFFSET(7)` + `USE_TZ=True` (`Africa/Cairo` display) | `[ ] Approve DATETIMEOFFSET(7)  [ ] Retain DATETIME2(7)` |
| **D-06** | Production OS, CPU arch & SQL Server version | Windows `x64` / Linux `x64` (`glibc 2.28+`) + SQL Server `2019`/`2022` + ODBC `18` | `OS: ____  Arch: ____  SQL Server: ____` |

---

## 10. `WP-5.6` Entry Gate Readiness Assessment

- **Current Gate Status:** **`BLOCKED — NOT AUTHORIZED`**.
- **Entry Prerequisites for `WP-5.6`:**
  1. Owner resolves `D-01` through `D-06` in the Consolidated Owner Decision Register above.
  2. Authoritative `data-dictionary.md` is updated with those Owner decisions and formally **FROZEN** by the Owner.
  3. Owner explicitly authorizes `WP-5.6` kickoff.
- **Governance Confirmation:** Zero existing files modified; `data-dictionary.md` remains `UNFROZEN`; zero implementation work performed.

**`DEFERRED DECISIONS RESOLUTION ASSESSMENT COMPLETED — OWNER DECISIONS REQUIRED — WP-5.6 NOT AUTHORIZED.`**
