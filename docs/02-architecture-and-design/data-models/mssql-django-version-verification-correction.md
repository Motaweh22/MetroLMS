# MetroLMS — `mssql-django` Version Verification Correction (`WP-5.5`)

> **Document Status:** `TECHNICAL-AUDIT — VERSION VERIFICATION CORRECTION (REPORT-ONLY)`  
> **Scope:** Narrowly scoped verification and correction of the `mssql-django` version and compatibility claims in [`physical-types-final-correction-audit.md`](physical-types-final-correction-audit.md).  
> **Governance Notice:** **Zero existing project files were modified.** `physical-types-final-correction-audit.md`, `data-dictionary.md` (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`), `django-sqlserver-integration-contract.md`, `CURRENT.md`, `active-roadmap.md`, and `CP-010`–`CP-012` remain completely untouched. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

Direct verification against the official Microsoft `microsoft/mssql-django` GitHub Releases API and the official PyPI `mssql-django` JSON metadata confirms:

1. **`mssql-django 2.0.1` Does Not Exist:** The latest officially published release is **`mssql-django 2.0.0`** (published **September 18, 2026**). The previous reference to `mssql-django 2.0.1` in [`physical-types-final-correction-audit.md`](physical-types-final-correction-audit.md) (§6.1, §10) was unsupported and is corrected here to **`mssql-django==2.0.0`** (`TECHNICAL-RECOMMENDATION`).
2. **Explicitly Bounded Python Range (`3.12–3.14`):** Both `mssql-django 2.0.0` (`CPython 3.10–3.14`) and Django `5.2` LTS (`Python 3.10–3.14`, with `3.14` added in Django `5.2.8`) establish an upper bound of Python `3.14`. Combined with MetroLMS's `3.12+` floor, the verified bounded Python range is **Python `3.12–3.14`**.
3. **Driver & Dependency Clarification:** **`pyodbc` (`>= 3.0`) remains the default runtime driver** (defaulting to `ODBC Driver 18 for SQL Server` with fallback to `ODBC Driver 17`), while **`mssql-python` (`>= 1.15.0`) is a mandatory package dependency** that can also be opted into per alias via `OPTIONS: {'python_driver': 'mssql_python'}`.
4. **Temporal Mapping Reconfirmed:** `USE_TZ=True` maps `DateTimeField` to `DATETIMEOFFSET(7)` and `USE_TZ=False` maps to `DATETIME2(7)` (`pytz` replaced by stdlib `zoneinfo` + `tzdata` in `2.0.0`). Existing `data-dictionary.md` vs. `django-sqlserver-integration-contract.md` discrepancy is preserved untouched.

---

## 2. Official Sources Inspected

| Source | URL / Endpoint | Verification Purpose |
| :--- | :--- | :--- |
| Official GitHub Repository | https://github.com/microsoft/mssql-django | Official Microsoft backend repository & `base.py` mapping behavior |
| Official GitHub Releases | https://github.com/microsoft/mssql-django/releases (queried via `api.github.com/repos/microsoft/mssql-django/releases`) | Exact published tags, release titles, and UTC publication timestamps |
| Official PyPI Project & Metadata | https://pypi.org/project/mssql-django/ (queried via `pypi.org/pypi/mssql-django/json`) | Authoritative `info.version`, `releases`, `requires_python`, `requires_dist`, and README support matrix |
| Django 5.2 Installation FAQ | https://docs.djangoproject.com/en/5.2/faq/install/ | Official Python version support matrix for Django `5.2` LTS |

---

## 3. Exact Release Verification

Live inspection of PyPI (`pypi.org/pypi/mssql-django/json`) and GitHub Releases (`github.com/microsoft/mssql-django/releases`) establishes:

1. **Latest Officially Published Release:** **`mssql-django 2.0.0`** (GitHub tag `2.0.0`, release title `2.0`).
2. **Version `2.0.1` Status:** **`2.0.1` does NOT exist** as an official published release on either PyPI or GitHub Releases. The published release sequence is `1.7.2` → `1.7.3` → `1.7.4` → `1.8.0` → **`2.0.0`**.
3. **Exact Release Date (`2.0.0`):**
   - **PyPI Upload Timestamp:** `2026-09-18T11:43:44.127695Z` (**September 18, 2026**).
   - **GitHub Release Published Timestamp:** `2026-09-18T12:27:17Z` (**September 18, 2026**; release URL: https://github.com/microsoft/mssql-django/releases/tag/2.0.0).
4. **Prior Claim Assessment:** [`physical-types-final-correction-audit.md`](physical-types-final-correction-audit.md) (§6.1, §10) erroneously referenced `mssql-django 2.0.1` based on an unverified secondary summary; that `2.0.1` claim is unsupported and superseded by **`2.0.0`**.

---

## 4. Python, Django & SQL Server Compatibility (`mssql-django 2.0.0`)

From the official PyPI `2.0.0` package metadata and `README`:

| Component | Verified Official Support (`mssql-django 2.0.0`) | MetroLMS Stack Fit |
| :--- | :--- | :--- |
| **Python** | **CPython `3.10 – 3.14`** (`requires_python: >=3.10`; Django `5.2` officially supports Python `3.10`, `3.11`, `3.12`, `3.13`, and `3.14` as of `5.2.8`) | **Python `3.12 – 3.14`** *(bounded upper limit `3.14`; replaces open-ended `3.12+`)* |
| **Django** | **Django `5.2`, `6.0`, `6.1`** (`requires_dist: django<6.2,>=5.2`; drops Django `3.2–5.1`) | **Django `5.2` LTS** *(supported; Django `5.0`/`5.1` would require `mssql-django==1.8.0`)* |
| **SQL Server** | **SQL Server `2017`, `2019`, `2022`, `2025`** (plus Azure SQL Database, Azure SQL Managed Instance, SQL Database in Microsoft Fabric) | Compatible with supported Microsoft SQL Server targets (`D-DB-01`) |
| **Operating Systems / Platforms** | Windows `x64`; Windows `ARM64` (`Python 3.11+`); macOS `15+` (Intel / Apple silicon); Linux `x64`/`ARM64` (`glibc 2.28+` or `musl 1.2+`). *(SUSE Linux ARM64 unsupported; unsupported platforms must stay on `1.8.0`.)* | Compatible with Windows Server / standard Linux deployment targets |

---

## 5. Driver and Dependency Verification

From PyPI `mssql-django 2.0.0` `requires_dist` and official `README`:

1. **Required Python Package Dependencies (`requires_dist`):**
   - `django<6.2,>=5.2`
   - `mssql-python>=1.15.0`
   - `pyodbc>=3.0`
   - `tzdata`
2. **Runtime Driver Behavior (`pyodbc` vs. `mssql-python`):**
   - **`pyodbc` remains the default runtime driver:** When `OPTIONS['python_driver']` is omitted or set to `'pyodbc'`, `mssql-django 2.0.0` uses `pyodbc`.
   - **Required ODBC Driver for `pyodbc` path:** Requires **`Microsoft ODBC Driver 18 for SQL Server`** (attempted first by default) with automatic fallback to **`ODBC Driver 17 for SQL Server`** when `OPTIONS['driver']` is omitted; an explicit `'driver'` value disables fallback.
   - **`mssql-python` is a mandatory package dependency (`>= 1.15.0`), NOT the default runtime driver:** It is installed automatically on `pip install mssql-django` (restricting installation to platforms with `mssql-python` binary wheels), and can be selected per database alias as an alternative runtime driver via `OPTIONS: {'python_driver': 'mssql_python'}` (which uses Microsoft ODBC Driver 18 supplied by `mssql-python-odbc`).

---

## 6. Recommended MetroLMS Candidate Configuration (`TECHNICAL-RECOMMENDATION`)

*(Classification: **`TECHNICAL-RECOMMENDATION`** — not `OWNER-APPROVED`; no dependency files modified.)*

- **Python:** **`3.12 – 3.14`** (explicitly bounded range; `3.12` or `3.13` LTS/stable recommended in `WP-5.6`)
- **Framework:** **Django `5.2` LTS**
- **SQL Server Backend Pin:** **`mssql-django==2.0.0`**
- **Runtime Driver:** **`pyodbc`** (default, with `Microsoft ODBC Driver 18 for SQL Server` or `17`), with optional evaluation of `'python_driver': 'mssql_python'` in `WP-5.6`

---

## 7. Temporal Mapping Confirmation

Reconfirmed for `mssql-django 2.0.0` against [`github.com/microsoft/mssql-django`](https://github.com/microsoft/mssql-django) and release `2.0.0` notes:
- **`USE_TZ = True` → `DATETIMEOFFSET(7)`** (`DateTimeField` stores timezone-aware offsets; `Now()` compiles to `SYSDATETIMEOFFSET()`; `2.0.0` replaced `pytz` with Python stdlib `zoneinfo` + `tzdata`).
- **`USE_TZ = False` → `DATETIME2(7)`** (`DateTimeField` maps to naive `DATETIME2`).
- **Governance Boundary:** The existing discrepancy between [`data-dictionary.md`](data-dictionary.md) (`DATETIME2(7)`) and [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) §4 (`DATETIMEOFFSET(7)` + `USE_TZ=True`) is **not** modified or resolved by this report.

---

## 8. Corrections to Previous Claims

| Claim in [`physical-types-final-correction-audit.md`](physical-types-final-correction-audit.md) | Verification Result | Corrected Claim |
| :--- | :---: | :--- |
| Candidate evaluated as **`mssql-django 2.0.1`** (§6.1, §10) | **Unsupported** (`2.0.1` does not exist on PyPI or GitHub Releases) | Candidate corrected to **`mssql-django==2.0.0`** (released `2026-09-18`) |
| Python compatibility stated as open-ended **`Python 3.12+`** (§1, §6.1) | **Unbounded** (`Django 5.2` & `mssql-django 2.0.0` cap at `3.14`) | Explicitly bounded to **Python `3.12 – 3.14`** |

---

## 9. Final Technical Recommendation & Governance Status

- **Technical Recommendation (`TECHNICAL-RECOMMENDATION`):** Evaluate **`mssql-django==2.0.0`** with **Python `3.12–3.14` + Django `5.2` LTS** and `pyodbc` (`ODBC Driver 18/17 for SQL Server`) upon formal `WP-5.6` authorization.
- **Verification Summary:**
  - Exactly one new report created: [`mssql-django-version-verification-correction.md`](mssql-django-version-verification-correction.md).
  - Zero existing files modified; `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
  - `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.
  - Zero packages installed, zero dependency files modified, and zero database implementation work performed.

**`MSSQL-DJANGO VERSION VERIFICATION COMPLETED — WP-5.6 NOT AUTHORIZED.`**

