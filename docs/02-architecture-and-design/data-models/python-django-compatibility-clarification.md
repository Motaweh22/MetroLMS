# MetroLMS — Python / Django Compatibility Clarification (`WP-5.5`)

> **Document Status:** `TECHNICAL-AUDIT — COMPATIBILITY CLARIFICATION (REPORT-ONLY)`  
> **Scope:** Narrowly scoped clarification of the Python/Django/`mssql-django 2.0.0` compatibility matrix recommended in [`mssql-django-version-verification-correction.md`](mssql-django-version-verification-correction.md), distinguishing declared package metadata from the officially tested `(Python, Django)` CI combinations.  
> **Governance Notice:** **Zero existing project files were modified.** `mssql-django-version-verification-correction.md`, `data-dictionary.md` (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`), `django-sqlserver-integration-contract.md`, `CURRENT.md`, `active-roadmap.md`, and `CP-010`–`CP-012` remain completely untouched. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

1. **Tested vs. Declared Distinction Resolved:** While Django `5.2` added Python `3.14` support in `5.2.8` and `mssql-django 2.0.0` declares overall support for `Python 3.10–3.14` across `Django 5.2–6.1`, `mssql-django 2.0.0`'s official CI test workflow (`.github/workflows/test.yml`) tests **Django `5.2`** with a **`Python 3.10`–`3.13`** floor/ceiling, and tests **Python `3.14`** only with **Django `6.0` and `6.1`**.
2. **Recommended MetroLMS Baseline (`TECHNICAL-RECOMMENDATION`):** **Python `3.12–3.13` + Django `5.2` LTS + `mssql-django==2.0.0` + Microsoft SQL Server (`2017–2025`) + `pyodbc` (default runtime driver, `ODBC Driver 18/17`)**. This is the most conservative, officially supported, and CI-bounded combination matching MetroLMS's `Python 3.12+` / `Django 5+` target stack.
3. **Python `3.14` Treated as Separate Alternative Only:** Using Python `3.14` under `mssql-django 2.0.0`'s tested matrix corresponds to **Django `6.0` or `6.1`** (non-LTS / departure from `Django 5+`). MetroLMS is **not** upgraded from Django `5.2` LTS; any Django `6.x` stack remains a separate `TECHNICAL-RECOMMENDATION` alternative with explicit trade-offs.

---

## 2. Official Sources Inspected

| Source | URL / Reference | Verification Scope |
| :--- | :--- | :--- |
| Django 5.2 Release Notes | https://docs.djangoproject.com/en/5.2/releases/5.2/ | Official Python compatibility for Django `5.2` |
| Django 5.2.8 Release Notes | https://docs.djangoproject.com/en/5.2/releases/5.2.8/ | Addition of Python `3.14` support in Django `5.2.8` (Nov 5, 2025) |
| Django 5.2 Installation FAQ | https://docs.djangoproject.com/en/5.2/faq/install/ | Supported Python series (`3.10–3.14`) |
| `microsoft/mssql-django` Repository | https://github.com/microsoft/mssql-django | Backend source & compatibility declarations |
| `mssql-django 2.0.0` Release Notes | https://github.com/microsoft/mssql-django/releases/tag/2.0.0 | Declared `2.0.0` compatibility table (`2026-09-18`) |
| `mssql-django 2.0.0` CI Workflow | `github.com/microsoft/mssql-django` `.github/workflows/test.yml` (tag `2.0.0`) | Exact tested `(Python, Django)` floor/ceiling pairs |
| PyPI `mssql-django 2.0.0` Metadata | https://pypi.org/project/mssql-django/ (`pypi.org/pypi/mssql-django/json`) | `requires_python: >=3.10`, `requires_dist: django<6.2,>=5.2` |

---

## 3. Django `5.2` LTS Python Compatibility

Per the official Django `5.2` documentation (`releases/5.2/`, `releases/5.2.8/`, and `faq/install/`):
- **Django `5.2.0`–`5.2.7`:** Officially supported **Python `3.10`, `3.11`, `3.12`, and `3.13`**.
- **Django `5.2.8+` (released Nov 5, 2025):** Added official support for **Python `3.14`** (expanding Django `5.2`'s Python range to `3.10–3.14`).

---

## 4. `mssql-django 2.0.0` Compatibility

Per the official `mssql-django 2.0.0` release notes and PyPI metadata (`2026-09-18`):
- **Declared Python Support (General Package Metadata):** CPython **`3.10–3.14`** (`requires_python >= 3.10`; release table notes *"Django 6.0 and 6.1 require Python 3.12+"*).
- **Declared Django Support:** **`5.2`, `6.0`, `6.1`** (`django<6.2,>=5.2`; drops `3.2–5.1`).
- **Declared SQL Server Support:** **SQL Server `2017`, `2019`, `2022`, `2025`**, plus Azure SQL Database, Azure SQL Managed Instance, and SQL Database in Microsoft Fabric.
- **Drivers:** `pyodbc` (`>=3.0`, default runtime driver; `ODBC Driver 18` with fallback to `17`) and `mssql-python` (`>=1.15.0`, mandatory install dependency, opt-in per alias via `OPTIONS['python_driver'] = 'mssql_python'`).

---

## 5. Tested vs. Declared Compatibility

Inspecting `.github/workflows/test.yml` at tag `2.0.0` reveals the exact floor/ceiling pairs exercised by `mssql-django` CI (with the workflow comment noting: *"Every currently-supported Django minor is covered, each on its lowest supported Python and on the newest Python it runs on, so the Python floor/ceiling of each Django is exercised"*):

| Django Version | Declared in `mssql-django 2.0.0` | Tested in `mssql-django 2.0.0` CI (`test.yml`) | Python `3.14` Status |
| :--- | :---: | :---: | :--- |
| **Django `5.2` LTS** | `3.10–3.14` *(via general range)* | **`3.10` (floor) and `3.13` (ceiling)** | **NOT in `test.yml` for Django `5.2`** *(though `5.2.8+` added `3.14` upstream)* |
| **Django `6.0`** | `3.12–3.14` | **`3.12` (floor) and `3.14` (ceiling)** | **Tested** (`pyodbc` & `mssql_python`) |
| **Django `6.1`** | `3.12–3.14` | **`3.12` (floor) and `3.14` (ceiling)** | **Tested** (`pyodbc` & `mssql_python`) |

**Key Finding:**
- **Python `3.12–3.13`** lies squarely inside the **`3.10–3.13`** floor/ceiling tested by `mssql-django 2.0.0` for **Django `5.2` LTS** (with `test.yml` also noting a full Azure DevOps `tox` matrix alongside the GitHub Actions floor/ceiling matrix).
- **Python `3.14`** is **not** tested with Django `5.2` in `mssql-django 2.0.0`'s `test.yml`; in `mssql-django 2.0.0`, Python `3.14` is tested only with **Django `6.0` and `6.1`**.

---

## 6. Recommended MetroLMS Version Matrix (`TECHNICAL-RECOMMENDATION`)

*(Classification: **`TECHNICAL-RECOMMENDATION`** — not `OWNER-APPROVED`; preserves `django-sqlserver-integration-contract.md` `Python 3.12+` / `Django 5+` baseline.)*

| Layer | Recommended Baseline | Classification | Rationale |
| :--- | :--- | :---: | :--- |
| **Python** | **`3.12 – 3.13`** *(e.g., latest `3.12.x` or `3.13.x`)* | `TECHNICAL-RECOMMENDATION` | Meets MetroLMS `3.12+` floor and stays within `mssql-django 2.0.0`'s `3.10–3.13` tested ceiling for Django `5.2` |
| **Web Framework** | **Django `5.2` LTS** (`>=5.2,<5.3`) | `TECHNICAL-RECOMMENDATION` | Aligns with `Django 5.x` contract and provides LTS security maintenance |
| **SQL Server Backend** | **`mssql-django==2.0.0`** | `TECHNICAL-RECOMMENDATION` | Latest verified Microsoft release (`2026-09-18`) supporting Django `5.2` |
| **Runtime Driver** | **`pyodbc`** (`>=3.0`, default) + `ODBC Driver 18/17` | `TECHNICAL-RECOMMENDATION` | Default runtime driver in `2.0.0`; `mssql-python>=1.15.0` installed as mandatory dependency |
| **Database** | **Microsoft SQL Server** (`2017–2025`, e.g., `2019`/`2022`) | `OWNER-APPROVED` (`D-DB-01` target) | Approved relational database platform |

---

## 7. Python `3.14` Alternative (`TECHNICAL-RECOMMENDATION` — Separate Candidate Stack)

If Python `3.14` were required under an officially CI-tested `mssql-django 2.0.0` combination:
- **Alternative Stack (`TECHNICAL-RECOMMENDATION`):** **Python `3.14` + Django `6.0` or `6.1` + `mssql-django==2.0.0`**.
- **Trade-Offs vs. Django `5.2` LTS:**
  1. **Loss of LTS Baseline:** Django `6.0` and `6.1` are standard feature releases with shorter mainstream support windows than Django `5.2` LTS.
  2. **Contract Departure:** [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) currently specifies `Django 5.x`; moving to `Django 6.x` would require explicit Owner/architectural review.
  3. **Recommendation:** Do **not** upgrade MetroLMS from Django `5.2` LTS; retain Django `5.2` LTS with Python `3.12–3.13`.

---

## 8. Corrections to Previous Compatibility Claims

| Claim in [`mssql-django-version-verification-correction.md`](mssql-django-version-verification-correction.md) | Clarification / Evidence | Corrected Claim |
| :--- | :--- | :--- |
| Recommended **`Python 3.12 – 3.14`** alongside **Django `5.2` LTS** and **`mssql-django==2.0.0`** (§1, §4, §6, §8) | `3.14` is supported by Django `5.2.8+` and declared generally by `mssql-django 2.0.0`, but `mssql-django 2.0.0` `test.yml` tests Django `5.2` on **`3.10–3.13`** and tests **`3.14`** only on **Django `6.0`/`6.1`** | Narrow recommended Python range for **Django `5.2` LTS + `mssql-django==2.0.0`** to **`Python 3.12 – 3.13`** (`TECHNICAL-RECOMMENDATION`) |

---

## 9. Final Technical Recommendation & Governance Status

- **Final Technical Recommendation (`TECHNICAL-RECOMMENDATION`):** Adopt **Python `3.12–3.13` + Django `5.2` LTS + `mssql-django==2.0.0` + `pyodbc` (`ODBC Driver 18/17 for SQL Server`)** as the candidate `WP-5.6` backend stack, subject to Owner/kickoff approval and local `makemigrations` / `sqlmigrate` verification in `WP-5.6`.
- **Governance Verification:**
  - Exactly one new report created: [`python-django-compatibility-clarification.md`](python-django-compatibility-clarification.md).
  - Zero existing files modified; `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
  - `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.
  - Zero packages installed, zero dependency files modified, and zero database implementation work performed.

**`PYTHON-DJANGO COMPATIBILITY CLARIFICATION COMPLETED — WP-5.6 NOT AUTHORIZED.`**

