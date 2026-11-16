# MetroLMS — Django ORM to SQL Server Physical Type Mapping Verification (`WP-5.6` Preparation)

> **Document Status:** `TECHNICAL-VERIFICATION — WP-5.6 PREPARATION INPUT ONLY (NON-AUTHORITATIVE)`  
> **Target Stack (`D-DB-01`, `D-AUTH-01`):** Python 3.12+ / Django 5.x (`Django 5+`) / DRF / Microsoft SQL Server (`mssql-django` + `pyodbc`)  
> **Governance Notice:** **No existing project file was modified.** `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`; `CP-009`–`CP-012`, `CURRENT.md`, and `active-roadmap.md` remain unchanged; `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Version & Verification Baseline (Explicit Limitation)
- **Target Specification:** `AGENTS.md` and [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) specify **Python 3.12+**, **Django 5.x**, and **`mssql-django` / `pyodbc`**, without pinning an exact minor `mssql-django` version yet.
- **Local Runtime Check:** `python -c "import django, mssql"` returned `ModuleNotFoundError: No module named 'django'` (no local Python backend virtualenv is provisioned yet).
- **Evidence Basis:** Verification is based on the official Microsoft `microsoft/mssql-django` backend `base.py` `data_types` mapping documentation/source behavior, combined with SQL Server 2019/2022 index key limits (`900` bytes clustered / `1,700` bytes non-clustered). Exact `makemigrations` / `sqlmigrate` output must be re-verified once the pinned `Django 5.x` + `mssql-django` environment is provisioned in `WP-5.6`.

---

## 2. Field-by-Field Verification Results

### 1) `GroupQrCode.token_hash` → Proposed `BINARY(32)`
- **Standard Django ORM Mapping (`models.BinaryField(max_length=32)`):**
  - In `mssql-django`, `BinaryField` maps to **`varbinary(max)`** when `max_length` is omitted, and **`varbinary(32)`** (`VARBINARY(32)`) when `max_length=32` is specified.
  - Standard `models.BinaryField(max_length=32)` does **NOT** automatically emit fixed-width `BINARY(32)` — it emits **`VARBINARY(32)`**.
- **Custom ORM Mapping Required for Exact `BINARY(32)`:**
  - To emit exact SQL Server `BINARY(32)` (matching `OWNER-APPROVED` `CertificateRecord.verification_token_hash BINARY(32)`), a custom `models.BinaryField` subclass overriding `db_type(self, connection)` (returning `'binary(%(max_length)s)'` for `mssql` / `microsoft` vendor) is required.
- **Indexing & `UNIQUE` Constraint Support:**
  - `VARBINARY(max)` (unconstrained `BinaryField()`) **cannot** be indexed or `UNIQUE`-constrained in SQL Server.
  - Both **`BINARY(32)`** (via custom `db_type()`) and **`VARBINARY(32)`** (via `BinaryField(max_length=32)`) are `32` bytes (`<= 1,700` bytes non-clustered / `<= 900` bytes clustered) and **fully support `UNIQUE` constraints and B-tree indexes** in SQL Server.
- **ORM Serialization & Retrieval Implications:**
  - `pyodbc` / `mssql-django` returns binary columns as `bytes` (or `memoryview` depending on driver/Django wrapper; normalize with `bytes(value)`). Service layer must hash raw QR tokens with `hashlib.sha256(...).digest()` (`32` bytes) before ORM filter/save. Note that `BINARY(32)` right-pads values shorter than `32` bytes with `0x00`, whereas `VARBINARY(32)` stores exact length (`32` bytes for SHA-256).
- **Classification:** **`CUSTOM-ORM-REQUIRED-FOR-EXACT-BINARY`** *(or `VARBINARY(32)` via standard `BinaryField(max_length=32)` as a zero-custom-field `WP-5.6` alternative; contingent on confirming `SHA-256` algorithm in `WP-5.6`).*

### 2) `MediaAsset.sha256_checksum` → Proposed `BINARY(32)`
- **Standard Django ORM Mapping (`models.BinaryField(max_length=32)`):**
  - Generates **`VARBINARY(32)`** in `mssql-django`, **not** `BINARY(32)`.
- **Custom ORM Mapping Required for Exact `BINARY(32)`:**
  - Same as above: a shared custom `FixedBinaryField(max_length=32)` overriding `db_type()` is required if exact `BINARY(32)` DDL is desired; otherwise `models.BinaryField(max_length=32)` emits `VARBINARY(32)`.
- **Indexing & `UNIQUE` Constraint Support:**
  - Both `BINARY(32)` and `VARBINARY(32)` are `32` bytes and **fully indexable** in SQL Server (unlike `VARBINARY(max)`).
- **ORM Serialization & Retrieval Implications:**
  - Storage Abstraction writes `hashlib.sha256(stream).digest()` (`32` raw bytes) and formats `.hex()` when exposing hex strings in API/diagnostic DTOs.
- **Classification:** **`CUSTOM-ORM-REQUIRED-FOR-EXACT-BINARY`** *(with `VARBINARY(32)` via `BinaryField(max_length=32)` as valid standard alternative).*

### 3) `ServerSession.session_data` → `NVARCHAR(MAX)`
- **Standard Django ORM Mapping (`models.TextField()`):**
  - In `mssql-django` (`base.py` `data_types`), Django's `TextField` maps directly to **`nvarchar(max)`** (`NVARCHAR(MAX)`).
- **Unicode & Session Serialization Compatibility:**
  - Fully supports Unicode (UTF-16) and Django's built-in `django.contrib.sessions.models.Session` (`AbstractBaseSession.session_data = models.TextField()`), including `sessionEpoch` (`S7`) and Arabic/Unicode session values without arbitrary truncation.
  - Because `session_key` (`NVARCHAR(40)`) is the `PK` and `session_data` is never indexed, `NVARCHAR(MAX)` avoids index-key limits cleanly.
- **Custom ORM Mapping Required:** **None.** Standard `django.contrib.sessions` works out-of-the-box on `mssql-django`.
- **Classification:** **`CONFIRMED-NATIVE-MAPPING`**.

---

## 3. Expected vs. Actual SQL Server Type Matrix

| Entity | Field | Target SQL Server Type | Django Standard Field | Actual `mssql-django` SQL Type | Custom ORM Needed for Exact Target? | Index / `UNIQUE` Safe? | Classification |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| `GroupQrCode` | `token_hash` | `BINARY(32)` | `BinaryField(max_length=32)` | `VARBINARY(32)` *(or `VARBINARY(MAX)` if no `max_length`)* | **Yes** (`db_type()` -> `binary(32)`) | **Yes** (`32` bytes) | `CUSTOM-ORM-REQUIRED-FOR-EXACT-BINARY` |
| `MediaAsset` | `sha256_checksum` | `BINARY(32)` | `BinaryField(max_length=32)` | `VARBINARY(32)` *(or `VARBINARY(MAX)` if no `max_length`)* | **Yes** (`db_type()` -> `binary(32)`) | **Yes** (`32` bytes) | `CUSTOM-ORM-REQUIRED-FOR-EXACT-BINARY` |
| `ServerSession` | `session_data` | `NVARCHAR(MAX)` | `TextField()` | `NVARCHAR(MAX)` | **No** (native `django_session`) | N/A (not indexed) | `CONFIRMED-NATIVE-MAPPING` |

---

## 4. Final Recommendation
1. **Keep `ServerSession.session_data` as `NVARCHAR(MAX)`** using standard Django `django.contrib.sessions` (`TextField()`).
2. **In `WP-5.6`, standardize `CertificateRecord.verification_token_hash`, `GroupQrCode.token_hash`, and `MediaAsset.sha256_checksum`** using either:
   - **Option 1 (Exact `BINARY(32)`):** One shared `FixedBinaryField(max_length=32)` subclass overriding `db_type()` -> `'binary(32)'` (zero `0x00`-padding risk for fixed 32-byte `SHA-256` digests), **or**
   - **Option 2 (Zero-Custom-Field `mssql-django`):** Standard `models.BinaryField(max_length=32)` -> `VARBINARY(32)` for `GroupQrCode.token_hash` and `MediaAsset.sha256_checksum` (while preserving `CertificateRecord.verification_token_hash BINARY(32)` via `FixedBinaryField(32)`).
3. **Never omit `max_length=32` on indexed `BinaryField`s**, because `BinaryField()` without `max_length` emits `VARBINARY(MAX)`, which SQL Server rejects in `UNIQUE` constraints and indexes.

