# MetroLMS Backend (`backend/`)

> **Status:** `FOUNDATION SCAFFOLD — PRE-MODEL / PRE-MIGRATION`  
> **Architecture:** Feature-Based Django Apps + Layered Architecture inside each Feature  
> **Architecture Blueprint:** [`docs/backend/backend-foundation-architecture.md`](../docs/backend/backend-foundation-architecture.md)

## Technology Stack

- **Python:** 3.12+
- **Framework:** Django 5.2 LTS + Django REST Framework
- **Database:** Microsoft SQL Server 2022 (`mssql-django==2.0.0`, `pyodbc`, Microsoft ODBC Driver 18, `mssql-python>=1.15.0`)
- **Auth:** Django server-side sessions (`HttpOnly` cookie) + CSRF (`X-CSRFToken`)
- **Timezone:** `USE_TZ = True`, `TIME_ZONE = "UTC"` (Cairo operational rules via `ZoneInfo("Africa/Cairo")`)
- **Media Storage:** Local Windows storage (`D:\MetroLMSMedia\`) via `infrastructure.storage`

## Project Structure

```text
backend/
├── config/                  # Django project settings (base, development, testing, production), urls, wsgi, asgi
├── apps/                    # 8 Feature-Based Django apps (identity, organization, governance, courses, media, groups, learning, communications)
├── shared/                  # Cross-cutting API envelopes, exceptions, permissions, OR-DB-04 validators, pagination, middleware
├── infrastructure/          # SQL Server helpers, local storage abstraction, scheduling, integrations, messaging
├── tests/                   # Cross-cutting integration, contract, and architecture boundary tests
├── scripts/                 # Developer/ops helper scripts
├── manage.py
├── requirements.txt
├── .env.example
└── .gitignore
```

Each Feature under `apps/<feature>/` follows a consistent layered structure:
`models/`, `api/{serializers,views,permissions,urls.py}`, `services/`, `selectors/`, `policies/`, `tasks/`, `tests/`.

## Deliberately Not Implemented Yet (Phase 5 Governance Gate)

Until the Data Dictionary (`METROLMS-DATA-DICT-001`) is formally frozen and Phase 12 database implementation is authorized:
- No database-bound Django `Model` fields or `0001_initial.py` migrations exist.
- `AUTH_USER_MODEL = "identity.User"` is documented in `config/settings/base.py` and must be enabled before the first `makemigrations`.
- No business services, DRF endpoints, upload handlers, or scheduled job runners are implemented yet.

## Local Setup & Validation

1. Create a Python 3.12 virtual environment and install dependencies:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and fill in local values (never commit `.env`).
3. Verify Django configuration & importability (once dependencies are installed):
   ```powershell
   python manage.py check
   ```

