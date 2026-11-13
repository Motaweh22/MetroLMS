# MetroLMS — Production Deployment Guide
## Release / Component: [Release Version or Component Name]

> **Document Title:** [Deployment Guide Title]  
> **Document Identifier:** `METROLMS-DEP-[RELEASE]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 5 Operations & Deployment Guide  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** DevOps Engineers, Release Managers, SREs  
> **Governing Decisions:** [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Release Overview & Artifacts
- **Target Release Version:** `vX.Y.Z`
- **Git Commit SHA:** `[Commit Hash]`
- **Target Infrastructure:** Cairo Metro Production Data Center.

## 2. Pre-Deployment Checklist
- [ ] Database backup executed and verified.
- [ ] Staging verification passed with 100% green tests.
- [ ] Static assets built and optimized (`npm run build`).
- [ ] Environment secrets and SQL Server connection strings verified.

## 3. Deployment Steps
### 3.1 Database Migration
```bash
python manage.py migrate --database=default
```

### 3.2 Backend Service Deployment
```bash
# Restart application WSGI workers (Gunicorn / Waitress)
sudo systemctl restart metrolms-backend
```

### 3.3 Frontend Static Assets Deployment
- Sync `frontend/dist/` to web server root `/var/www/metrolms/`.

## 4. Post-Deployment Verification (Smoke Tests)
- [ ] Health check endpoint returns `200 OK` (`/api/health/`).
- [ ] Static login page loads without console errors.
- [ ] Database connection probe succeeds.

## 5. Rollback Procedure
- Step-by-step instructions to revert binary artifacts and roll back migrations.
