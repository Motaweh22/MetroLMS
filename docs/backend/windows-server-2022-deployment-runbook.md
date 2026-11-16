# MetroLMS — Windows Server 2022 Production Deployment Runbook (`BP-13` / `G-04`)

> **Status:** `READY FOR SERVER EXECUTION` (`BP-13` remains `BLOCKED` until verified on target production Windows Server 2022 + SQL Server 2022 under `G-04`).

---

## 1. Target Production Stack (`WP55-PT-06`, `D-DB-01`, `D-AUTH-01`)
- **OS:** Windows Server 2022 (`x64`), system timezone set to **`UTC`** (`WP55-PT-05`).
- **Database:** Microsoft SQL Server 2022 (`COMPATIBILITY_LEVEL = 160`, `Arabic_100_CI_AS`, `READ_COMMITTED_SNAPSHOT ON`).
- **Runtime:** Python `3.12.x` (`64`-bit) + `backend/.venv/` + `backend/requirements-prod.txt` (`Waitress` WSGI).
- **Reverse Proxy:** IIS (`URL Rewrite` + `Application Request Routing / ARR`) terminating HTTPS/TLS and proxying `/api/*` to `127.0.0.1:8000` (and serving the built React `frontend/dist/`).

---

## 2. Step-by-Step Server Setup

1. **Environment & Dependencies:**
   - Run `backend\scripts\metrolms-windows-environment-setup.bat`.
   - Install production WSGI server:
     ```bat
     backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-prod.txt
     ```
2. **Production `.env` Configuration (`backend/.env`):**
   - Set `DJANGO_SETTINGS_MODULE=config.settings.production`, a strong `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, and `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` matching the HTTPS domain.
   - Configure SQL Server 2022 connection (`DB_HOST`, `DB_NAME=MetroLMS`, `DB_USER` / `Trusted_Connection`).
   - Configure `MEDIA_ROOT` (local `D:\MetroLMSMedia\` or dedicated LAN UNC share `\\FILESERVER\MetroLMSMedia` with `Modify` NTFS permission **only** for the service account, and **Read/Execute scripts disabled**).
3. **Database Initialization & Migrations:**
   - Run `backend\scripts\metrolms-database-init-and-migrate.bat`.
4. **Pre-Flight Check & WSGI Startup:**
   - Verify with `backend\scripts\metrolms-start-production-server.bat /CHECKONLY`.
   - Start Waitress (recommended via NSSM or Windows Service wrapper) using `backend\scripts\metrolms-start-production-server.bat`.
5. **6-Hour Group Renewal Task (`TR-C3-04`):**
   - Preview with `backend\scripts\metrolms-register-renewal-task.bat /DRYRUN`.
   - Register as Administrator: `backend\scripts\metrolms-register-renewal-task.bat`.
6. **Production Verification & `G-04` Sign-off Checklist:**
   - [ ] HTTPS TLS active; `SESSION_COOKIE_SECURE=True` & `CSRF_COOKIE_SECURE=True` verified in browser DevTools.
   - [ ] `GET /api/auth/csrf` and `POST /api/auth/login` succeed over HTTPS.
   - [ ] Media upload + `Range 206` streaming verified on `MEDIA_ROOT` without execute permissions.
   - [ ] `MetroLMS_DueGroupRenewals_6H` scheduled task executes cleanly and logs `Succeeded` in `communications_scheduledjobrun`.
   - [ ] SQL Server 2022 full backup & restore drill verified.

