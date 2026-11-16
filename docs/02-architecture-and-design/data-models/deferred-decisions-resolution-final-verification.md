# MetroLMS — Deferred Decisions Final Technical Verification (`WP-5.5`)

> **Document Status:** `TECHNICAL-VERIFICATION — FINAL PRE-DECISION AUDIT (REPORT-ONLY)`  
> **Audit Date:** `2026-11-15`  
> **Scope:** Narrowly scoped final verification of `D-05` (Django `5.2` timezone behavior on Windows) and `D-06` (current GA `mssql-python` `1.17.0`, companion packages, and deployment matrix) across [`deferred-decisions-resolution-assessment.md`](deferred-decisions-resolution-assessment.md) and [`deferred-decisions-resolution-corrections.md`](deferred-decisions-resolution-corrections.md).  
> **Governance Notice:** **Zero existing project files were modified.** All `6` deferred decisions remain `OPEN`. `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

1. **D-05 (`USE_TZ=True` + `TIME_ZONE='Africa/Cairo'` on Windows) — Safe with Explicit App-Layer Discipline (`VERIFIED-FACT` / `TECHNICAL-RECOMMENDATION`):** Even though Windows lacks `time.tzset()`, Django `5.2` with `USE_TZ=True` + `zoneinfo` + `tzdata` stores UTC (`+00:00`) in `DATETIMEOFFSET(7)` and converts to `Africa/Cairo` independently of the Windows OS clock — provided all code uses `django.utils.timezone.now()` (never naive `datetime.now()`) and explicit `ZoneInfo('Africa/Cairo')` / `timezone.localtime()` for API projections and scheduled jobs (`TR-C3-04`).
2. **D-06 (`mssql-python` Current GA & Lockfile Distinction) — `1.17.0` Verified (`VERIFIED-FACT` / `TECHNICAL-RECOMMENDATION`):**
   - `mssql-django==2.0.0` (`2026-09-18`) declares minimum dependency `mssql-python>=1.15.0` (floor only, **not** a production pin).
   - Current GA `mssql-python` on PyPI is **`1.17.0`** (`2026-11-02`), requiring exact companion packages **`mssql-python-odbc==18.6.2.2`**, **`mssql-python-rs==0.4.0`**, and `azure-identity>=1.12.0`.
   - **`pyodbc` (`ODBC Driver 18/17 for SQL Server`)** remains the default runtime path; **`mssql-python`** (`OPTIONS['python_driver'] = 'mssql_python'`) is the opt-in runtime path.
3. **Cross-Decision Dependency:** Selecting Windows Server vs. Linux directly affects `time.tzset()`, `Windows Task Scheduler` local-time triggers (`TR-C3-04`), and `mssql-python` wheel availability (`win_amd64` / `win_arm64` vs. `manylinux_2_28` / `musllinux_1_2`).

---

## 2. D-05 Verification Findings (Django `5.2` Timezone Behavior on Windows)

Inspected [`deferred-decisions-resolution-assessment.md`](deferred-decisions-resolution-assessment.md), [`deferred-decisions-resolution-corrections.md`](deferred-decisions-resolution-corrections.md), [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) (`§4`), [`CP-012`](../../project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md) (`TR-C3-04`), and official Django `5.2` timezone documentation (`docs.djangoproject.com/en/5.2/topics/i18n/timezones/`):

| Finding | Classification | Verified Detail |
| :--- | :---: | :--- |
| **Windows `time.tzset()` Limitation** | `VERIFIED-FACT` | Windows does **not** implement `time.tzset()`, so Django cannot change `os.environ['TZ']` at runtime. Under `USE_TZ=False`, Django requires `TIME_ZONE` to match the Windows OS timezone; under **`USE_TZ=True`**, Django operates on aware UTC datetimes internally. |
| **`TIME_ZONE='Africa/Cairo'` Safety on Windows** | `VERIFIED-FACT` | **`TIME_ZONE='Africa/Cairo'` with `USE_TZ=True` is safe on Windows Server** for aware Django operations, without requiring the Windows OS timezone to be set to `Africa/Cairo` (setting Windows Server OS clock to UTC is standard and avoids DST ambiguity for OS logs/schedulers). |
| **Automatic Django Behaviors (`USE_TZ=True`)** | `VERIFIED-FACT` | `django.utils.timezone.now()` returns aware UTC (`datetime` with `UTC` tzinfo); `mssql-django 2.0.0` writes/reads aware datetimes to/from `DATETIMEOFFSET(7)` (`+00:00`); Django templates/admin convert automatically to `TIME_ZONE`. |
| **Explicit Application Implementation Required** | `TECHNICAL-RECOMMENDATION` | **DRF API projections, deadline checks, and `TR-C3-04` scheduled jobs** (`process_due_group_renewals`) **must** explicitly call `timezone.now()` for UTC instants and `timezone.localtime(dt, ZoneInfo('Africa/Cairo'))` (or `ZoneInfo('Africa/Cairo')` via `tzdata`) for Cairo business-day boundaries — never naive `datetime.now()`. |
| **Preserved Owner Decisions** | `OWNER-DECISION-REQUIRED` *(for `D-05` DDL)* | Approved UTC storage + `Africa/Cairo` business timezone (`TR-C3-04`) are preserved; updating `data-dictionary.md` `DATETIME2(7)` -> `DATETIMEOFFSET(7)` remains `OWNER-DECISION-REQUIRED`. |

---

## 3. D-06 Updated Compatibility Findings (`mssql-python` & Deployment Matrix)

Verified against live PyPI JSON metadata (`pypi.org/pypi/mssql-python/json`, `pypi.org/pypi/mssql-django/json`) and official Microsoft `microsoft/mssql-django` (`2026-09-18`) & `microsoft/mssql-python` (`2026-11-02`) documentation:

### 3.1 Package Lifecycle & Pinning Distinction

| Category | Exact Versions | Classification | Notes |
| :--- | :--- | :---: | :--- |
| **Minimum Package Dependency (`mssql-django==2.0.0`)** | `mssql-python>=1.15.0`, `pyodbc>=3.0`, `django>=5.2,<6.2`, `tzdata` | `VERIFIED-FACT` | Floor declared in `mssql-django 2.0.0` `requires_dist`; **not** a production pin. |
| **Current GA `mssql-python` Release** | **`mssql-python==1.17.0`** (`2026-11-02T18:36:17Z`) | `VERIFIED-FACT` | Exact companion deps: **`mssql-python-odbc==18.6.2.2`**, **`mssql-python-rs==0.4.0`**, `azure-identity>=1.12.0`. |
| **Officially Tested CI Combination (`mssql-django 2.0.0`)** | `Python 3.10/3.13` + `Django 5.2` + `pyodbc` (`ODBC Driver 18`) & `mssql-python==1.15.0` | `VERIFIED-FACT` | Verified in `microsoft/mssql-django` `.github/workflows/test.yml` (tag `2.0.0`). |
| **Recommended Production Lockfile Combination** | `Python 3.12–3.13` + `Django 5.2.x` (LTS) + `mssql-django==2.0.0` + `mssql-python==1.17.0` *(or verified lock)* + `pyodbc` (default) | `TECHNICAL-RECOMMENDATION` | Exact lockfile pins (`pip-compile` / `uv.lock`) must be verified with `sqlmigrate` & integration tests at `WP-5.6` kickoff. |

### 3.2 Platform, OS, Architecture & Driver Matrix (`VERIFIED-FACT`)

- **Windows (`mssql-python 1.17.0` wheels):** `win_amd64` (`x64`, Python `3.10+`) and `win_arm64` (`ARM64`, Python `3.11+`). *(Windows Server version must support modern CPython `3.12–3.13` and MSVC runtime / ODBC Driver `17`/`18` if using `pyodbc`.)*
- **Linux (`mssql-python 1.17.0` wheels):** `manylinux_2_28_x86_64`, `manylinux_2_28_aarch64` (`glibc >= 2.28`, e.g., Ubuntu 20.04+, Debian 10+, RHEL 8+), and `musllinux_1_2_x86_64`, `musllinux_1_2_aarch64` (Alpine `musl >= 1.2`). **SUSE Linux ARM64 is unsupported.**
- **macOS (`mssql-python 1.17.0` wheels):** `macosx_15_0_universal2` (`macOS 15+` Intel / Apple silicon — dev/local only).
- **SQL Server Compatibility (`mssql-django 2.0.0`):** SQL Server **`2017`, `2019`, `2022`, `2025`**, plus Azure SQL / Microsoft Fabric.
- **Runtime Paths & Driver Limitations:**
  - **Path A (`pyodbc` — Default):** Requires system-installed `Microsoft ODBC Driver 18` or `17 for SQL Server`; supports `dsn`.
  - **Path B (`mssql-python` — Opt-In via `OPTIONS['python_driver'] = 'mssql_python'`):** Uses bundled `mssql-python-odbc==18.6.2.2` (no separate ODBC Driver Manager install); **does not support `dsn`** (`pyodbc`-only), requires `sqltype` in `setdecoding`, and bulk-copy rejects 4-part server-qualified destinations.

---

## 4. Cross-Decision Impact (`D-06` OS Choice -> `D-05` Timezone Implementation)

- **If Windows Server is selected (`INFRASTRUCTURE-DECISION-REQUIRED` — not yet approved):**
  1. Django cannot call `time.tzset()`; therefore **`USE_TZ=True` + `tzdata` + explicit `ZoneInfo('Africa/Cairo')`** is mandatory so application logic never inherits Windows local-clock state.
  2. `Windows Task Scheduler` (`TR-C3-04` illustrative scheduler) must trigger management commands in UTC or account for `Africa/Cairo` DST transitions explicitly inside Django (`timezone.now()` / `ZoneInfo('Africa/Cairo')`).
- **If Linux (`glibc >= 2.28` / `musl >= 1.2`) is selected:** `time.tzset()` works natively, and `tzdata` still guarantees deterministic `Africa/Cairo` DST rules in slim/distroless containers.

---

## 5. Required Owner & Infrastructure Clarifications

- **`D-01` (`OWNER-DECISION-REQUIRED`):** Confirm `PendingApprovalRequest.id` (`UNIQUEIDENTIFIER` vs. `NVARCHAR(64)` vs. authorized dual-field).
- **`D-02` (`OWNER-DECISION-REQUIRED`):** Choose Catalog FK alignment (`4` FKs -> `INT` vs. `3` catalog PKs -> `BIGINT`).
- **`D-03` (`UNRESOLVED` / `OWNER-DECISION-REQUIRED`):** Clarify `QuizDefinition.passing_score` unit, fractionality, range, and rounding.
- **`D-04` (`OWNER-DECISION-REQUIRED`):** Confirm `GroupQrCode.token_hash` algorithm (`SHA-256` vs. `HMAC-SHA256`) and storage (`VARBINARY(32)` vs. `BINARY(32)`).
- **`D-05` (`OWNER-DECISION-REQUIRED`):** Approve updating `data-dictionary.md` `DATETIME2(7)` -> `DATETIMEOFFSET(7)` (`USE_TZ=True`, UTC `+00:00`, `Africa/Cairo` display).
- **`D-06` (`INFRASTRUCTURE-DECISION-REQUIRED`):** Confirm production OS & version, CPU architecture (`x64` vs. `ARM64`), SQL Server version (`2017–2025`), and runtime driver (`pyodbc` + ODBC Driver `17`/`18` vs. `mssql-python`).

---

## 6. Updated Technical Recommendations

- **`D-05` (`TECHNICAL-RECOMMENDATION`):** Adopt `DATETIMEOFFSET(7)` + `USE_TZ=True` + `TIME_ZONE='Africa/Cairo'` + `tzdata`, enforcing `timezone.now()` and explicit `ZoneInfo('Africa/Cairo')` / `timezone.localtime()` across DRF serializers and `TR-C3-04` jobs regardless of host OS.
- **`D-06` (`TECHNICAL-RECOMMENDATION`):** Pin exact lockfile versions at `WP-5.6` kickoff (`Python 3.12–3.13`, `Django 5.2.x` LTS, `mssql-django==2.0.0`, `mssql-python==1.17.0` with `mssql-python-odbc==18.6.2.2` & `mssql-python-rs==0.4.0`, `pyodbc` default runtime driver with `ODBC Driver 18/17`), subject to Owner confirmation of target OS/architecture.

---

## 7. Final Owner Decision Readiness Assessment & Governance Status

- **Readiness Assessment:** Technical verification of all six deferred decisions (`D-01`–`D-06`), including Windows `USE_TZ=True` behavior and live `mssql-python 1.17.0` / `mssql-django 2.0.0` metadata, is **complete** (`TECHNICAL-VERIFICATION`). All six decisions remain `OPEN` for Owner/infrastructure sign-off.
- **Files Created:** [`deferred-decisions-resolution-final-verification.md`](deferred-decisions-resolution-final-verification.md) (this file only).
- **Existing Files Modified:** **None (`0` modified).**
- **Data Dictionary:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- **WP-5.6:** `BLOCKED — NOT AUTHORIZED`.

**`DEFERRED DECISIONS FINAL TECHNICAL VERIFICATION COMPLETED — OWNER DECISIONS REQUIRED — WP-5.6 NOT AUTHORIZED.`**

