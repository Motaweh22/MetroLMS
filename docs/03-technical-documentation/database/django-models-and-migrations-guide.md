# MetroLMS — Django Models and Migrations Guide (`WP-5.6`)

> **Document Title:** Django Models and Migrations Design Guide  
> **Document Identifier:** `METROLMS-DB-DJANGO-GUIDE-001`  
> **Document Status:** `APPROVED — FROZEN DESIGN BASELINE (2026-11-16)`  
> **Canonical Authority Level:** Level 3 Backend ORM & Migration Specification (`D-DB-01`)  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Django Engineers & QA Engineers  
> **Governing Decisions:** [`D-DB-01`](../../architecture/decision-register.md), [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md), [`schema-design-guidelines.md`](schema-design-guidelines.md)  
> **Last Updated:** 2026-11-16 (`WP-5.6` Documentation Deliverable 2 of 2; design guide only — zero models/migrations created here)

---

## 1. Approved Runtime & Package Baseline

- **Python:** `3.12` (64-bit; `backend/.venv/` verified on `3.12.10`)
- **Framework:** `Django 5.2 LTS` + `Django REST Framework`
- **SQL Server Backend:** `mssql-django==2.0.0` with `pyodbc` (active/default runtime driver), **Microsoft ODBC Driver 18 for SQL Server**, and mandatory `mssql-python>=1.15.0` package dependency.
- **Database Compatibility:** Local SQL Server `2025` Developer **must** run with database compatibility level **`160`** (SQL Server 2022); final schema and migrations must be validated against SQL Server `2022` before production deployment.

---

## 2. Custom User Model & Feature Ownership (`AUTH_USER_MODEL`)

- **Mandatory Pre-Migration Setting:** `AUTH_USER_MODEL = "identity.User"` **must** be enabled in `backend/config/settings/base.py` **before** generating the first project migration (`0001_initial.py`).
- `identity.User` uses `phone_e164` (`NVARCHAR(16) NOT NULL UNIQUE`) as `USERNAME_FIELD`, `BIGINT IDENTITY(1,1)` (`models.BigAutoField(primary_key=True)`), nullable `email` with filtered `UNIQUE`, and `role` (`NVARCHAR(32)`) FK → `RolePolicy.role_key`.
- All `54` active entities map 1:1 to their owning Feature under `backend/apps/<feature>/models/` (`identity`: 7, `organization`: 10, `governance`: 2, `courses`: 15, `media`: 2, `groups`: 8, `learning`: 5, `communications`: 5) using default `dbo` schema tables (`G-02`).
- **`InPersonAttendanceRecord` (`Domain 16`) is explicitly excluded** (`DEFERRED`).

---

## 3. SQL Server Physical-to-Django Field Mapping

| SQL Server Physical Type | Django Field | Notes |
|---|---|---|
| `BIGINT IDENTITY(1,1)` PK | `models.BigAutoField(primary_key=True)` | `50` surrogate PKs |
| `BIGINT` (non-PK / FK) | `models.BigIntegerField()` / `models.ForeignKey(..., on_delete=models.DO_NOTHING)` | Always `on_delete=models.DO_NOTHING` (`ON DELETE NO ACTION`) |
| `UNIQUEIDENTIFIER` PK | `models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)` | `PendingApprovalRequest.id` |
| `NVARCHAR(n)` / `NVARCHAR(MAX)` | `models.CharField(max_length=n)` / `models.TextField()` | `101` active string fields |
| `NVARCHAR(MAX)` JSON | `models.JSONField()` + SQL `ISJSON()` `CheckConstraint` | `9` JSON fields (`5` `ARRAY`, `3` `OBJECT`, `1` untyped) |
| `DATETIMEOFFSET(7)` | `models.DateTimeField()` (`USE_TZ=True`, `TIME_ZONE='UTC'`) | `38` fields; Cairo display via `ZoneInfo("Africa/Cairo")` (`tzdata`) |
| `DATE` | `models.DateField()` | `4` date-only fields |
| `BIT` | `models.BooleanField()` | `12` flags |
| `INT` | `models.IntegerField()` | `11` integer fields |
| `DECIMAL(5,2)` | `models.DecimalField(max_digits=5, decimal_places=2)` | `QuizDefinition.passing_score` |
| `BINARY(32)` / `VARBINARY(32)` | `models.BinaryField(max_length=32)` | Token hashes |

- **Defaults (`16` fields):** Use **both** `default=...` (ORM/Python) **and** `db_default=...` (Django 5.2 SQL Server `DEFAULT` constraint).

---

## 4. Filtered Unique Indexes, `CHECK` Constraints & `RunSQL` Patterns

- **Primary ORM Path (`mssql-django==2.0.0`):** `models.UniqueConstraint(fields=[...], condition=Q(...), name=...)` for the `4` filtered `UNIQUE` indexes (`User(role) WHERE role = 'developer'`, `User(email) WHERE email IS NOT NULL`, `GroupJoinRequest(training_group_id, user_id) WHERE request_status = 'Pending'`, `CertificateRecord(course_attempt_id) WHERE course_attempt_id IS NOT NULL`).
- **Explicit `migrations.RunSQL` Pattern (`OWNER-AUTHORIZED`, `2026-11-16`):** Where `mssql-django==2.0.0` DDL generation or `sqlmigrate` inspection requires explicit T-SQL (e.g., filtered unique indexes with specific SQL Server clauses, `COLLATE Arabic_100_BIN2` on `User.phone_e164`, typed `ISJSON(..., ARRAY/OBJECT)` constraints, or `CHECK` constraints), use reversible `migrations.RunSQL(sql=..., reverse_sql=...)`.

---

## 5. Field-Scoped Normalization Pipeline (`OR-DB-04`)

- Implement a centralized pre-validation normalization module in `backend/shared/validators/` invoked across **all** write paths (DRF serializers, application services, management commands, data imports, and bulk create/update operations — never relying solely on `Model.clean()` or `Model.save()`).
- Enforce the exact `58` No-Normalization / `7` Field-Specific / `36` `NFC` (`27` `strip()+NFC`, `9` `NFC`-only with `trim_whitespace=False` in DRF serializers) split from `data-dictionary.md` §11.4.

---

## 6. Migration Authoring, `sqlmigrate` & Bootstrap Seeds

1. **Dependency Order:** `identity` (`RolePolicy`, `User`) and `organization` catalogs migrate first, followed by `governance`, `courses`, `groups`, `media`, `learning`, and `communications`.
2. **Mandatory `sqlmigrate` Inspection:** Every generated migration must be inspected via `python manage.py sqlmigrate <app> <migration>` to verify `dbo` tables, `ON DELETE NO ACTION`, `DATETIMEOFFSET(7)`, `DEFAULT` constraints, `CHECK`/`ISJSON()`, and filtered `UNIQUE` indexes before `migrate`.
3. **Catalog & Bootstrap Seeds:** Seed `RolePolicy` (6 canonical roles), `MaritalStatusCatalog`, `MilitaryServiceStatusCatalog`, `MetroLine`, `OrganizationalDepartment`, `JobTitle`, `DepartmentTrack`, and `ScheduledJob` (`process_due_group_renewals`), plus `python manage.py bootstrap_developer` (`INV-R1`, `transaction.atomic()` + `select_for_update()`).

