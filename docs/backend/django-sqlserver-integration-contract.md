# MetroLMS — Django & Microsoft SQL Server Backend Integration Contract

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Scope:** Target backend architecture (Python + Django 5+ + Django REST Framework + Microsoft SQL Server), REST API transport conventions, pagination/error/approval envelopes, media integration boundary (`D-MEDIA-01`), and authoritative SQL Server reconciliation for the frozen database schema (`D-DB-01`).
> **Last Updated:** 2026-11-07 (`CP-001`)
> **Supersedes:** PostgreSQL-specific DDL/CLI syntax in [`docs/backend/database-schema.md`](database-schema.md) (§A.2) and [`docs/backend/contracts/developer-bootstrap-contract.md`](contracts/developer-bootstrap-contract.md) (§3).

---

## 1. Confirmed Target Backend Stack (`D-DB-01`, `D-AUTH-01`)

| Layer | Technology | Role in MetroLMS |
| :--- | :--- | :--- |
| **Language & Runtime** | Python 3.12+ | Backend application runtime |
| **Web Framework** | Django 5.x + Django REST Framework (DRF) | ORM, session authentication, CSRF middleware, REST API views/serializers, management commands |
| **Relational Database** | **Microsoft SQL Server** (`mssql-django` / `pyodbc`) | Primary relational data store (`D-DB-01`). **PostgreSQL is NOT part of the approved architecture.** |
| **Authentication & Sessions** | `django.contrib.auth` + `django.contrib.sessions` | Server-side database-backed sessions (`HttpOnly` `sessionid` cookie) + `csrftoken` (`D-AUTH-01`) |
| **Frontend API Boundary** | `frontend/src/api/` + MSW v2 (`frontend/src/mocks/`) | Contract-faithful HTTP client (`credentials: 'include'`) and mock parity layer during Frontend Readiness Phases 1–4 |

---

## 2. REST API Envelopes & Status Code Conventions

All frontend API clients (`frontend/src/api/`) and MSW v2 mock handlers (`frontend/src/mocks/`) must implement these exact response shapes so that switching from MSW to Django requires zero UI refactoring:

### 2.1 Immediate Mutation / Query Success (`200 OK` / `201 Created`)
```json
{
  "status": "OK",
  "data": { ... }
}
```

### 2.2 Paginated Collection Envelope (`200 OK`)
Aligned with Django REST Framework `PageNumberPagination`:
```json
{
  "count": 142,
  "next": "/api/users?page=3&pageSize=20",
  "previous": "/api/users?page=1&pageSize=20",
  "results": [ ... ]
}
```

### 2.3 Deferred Approval Mutation Envelope (`202 Accepted` — `MFR-35`, `MFR-36`)
Returned when an `assistant_admin` executes a gated mutation (`INV-R9`) that requires `Admin` approval:
```json
{
  "status": "PendingApproval",
  "approvalRequestId": "apr-2026-0042",
  "actionType": "enrollment_remove",
  "requestedByUserId": "usr-assistant-01",
  "createdAt": "2026-11-07T10:30:00Z",
  "message": "تم إرسال الطلب للمراجعة والموافقة من قبل مدير النظام"
}
```
> **Frontend Contract Rule (`MFR-36`):** When the frontend receives `HTTP 202` with `status: "PendingApproval"`, it must **not** mutate the target entity in local state as if the action completed. Instead, it appends the request to `pendingApprovalRequests` and displays a pending-review toast/badge.

### 2.4 Standard Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`)
```json
{
  "status": "ERROR",
  "code": "PERMISSION_DENIED",
  "message": "ليس لديك صلاحية لتنفيذ هذا الإجراء خارج نطاق المجموعات المعينة لك.",
  "fieldErrors": {
    "groupId": ["المجموعة المحددة خارج نطاق صلاحياتك."]
  }
}
```
- **Confidentiality Rule (`MFR-39` / `INV-R8`):** Any query or mutation by a non-Developer targeting a `Developer` account ID must return `404 Not Found` (`code: "RESOURCE_NOT_FOUND"`), never `403 Forbidden`, to prevent account enumeration.

---

## 3. Media & File Delivery Boundary (`D-MEDIA-01`)

Per Owner Decision **`D-MEDIA-01`**, the frontend interacts with course videos, PDFs, thumbnails, assignments, and certificates strictly through logical metadata and URL descriptors:

```ts
export interface MediaAssetReference {
  assetId: string;
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes?: number;
  disposition?: 'inline' | 'attachment';
}
```

1. **Frontend Decoupling:** Frontend components (`<LessonViewer />`, `<CertificateModal />`, upload dropzones) consume `MediaAssetReference` and never hardcode storage bucket URLs, filesystem paths, or cloud SDKs.
2. **Initial Upload, Two-Step Replacement Workflow, Phase 1 Django-Mediated Delivery, Future `CL-03` & Deferred `API-REC-06` Decisions:** Initial binary **upload** is `OWNER APPROVED` (`2026-11-13`) as `Browser -> Django Backend -> Media Storage` via `multipart/form-data` through a mandatory **Storage Abstraction** (`INV-DOM21-06` — `OWNER APPROVED — INITIAL STORAGE DEPLOYMENT DIRECTION`, `2026-11-13`: dedicated media storage on the existing Windows Server separated from application source/deployment, logs/temp, and SQL Server data/transaction-log directories, e.g., illustrative `D:\MetroLMSMedia\`, with transfer integrity/checksum support and migration path to a future separate Media Server without altering business logic, logical asset IDs, or API contracts; entity-based logical organization `INV-DOM21-05` without freezing physical directory tree or DB schema). For permitted media replacement (`INV-DOM21-10` Draft Course Versions with `INV-DOM21-11` target-draft authorization; `INV-DOM21-08` Active / Unsealed `GroupRenewalCycle`s), **`INV-DOM21-12` (`OWNER APPROVED`, `2026-11-13`)** establishes the **Two-Step Upload & Reference Repoint workflow** (`INV-DOM21-09` new `assetId` on Step 1 upload without modifying references; separate Step 2 reference repoint with independent server-side revalidation; `INV-DOM21-07` historical references untouched; `API-REC-07` `PUT`/`PATCH` metadata meanings preserved; exact endpoints, DTOs, idempotency, and transaction boundaries remain `PROPOSED`), **`INV-DOM21-13` (`OWNER APPROVED`, `2026-11-13`)** scopes `title` and `isVisible` to the specific content/material reference (`API-REC-07` `PATCH` operates on the reference, never globally across shared usages) while keeping `fileName`, `mimeType`, and `sizeBytes` as Asset-level technical metadata, **`INV-DOM21-14` (`OWNER APPROVED`, `2026-11-13`)** governs reference-level `title`/`isVisible` mutability by target reference lifecycle state (mutable in Draft Course Versions & Active/Unsealed cycles; historically immutable in Published versions & Sealed/Closed cycles; `API-REC-07` `PATCH` constrained accordingly; technical metadata mutability/versioning remains unresolved), **`INV-DOM21-15` (`OWNER APPROVED`, `2026-11-13`)** establishes immediate `isVisible: true -> false` enforcement for all trainees in an affected Active / Unsealed `GroupRenewalCycle` after successful persistence (denying new access initiation while retaining the asset/reference, preserving all learner educational records, and isolating unrelated references; `false -> true` restoration and already-open playback sessions / in-flight `Range` requests remain unresolved), and **`INV-DOM21-16` (`OWNER APPROVED`, `2026-11-13`)** establishes that Asset-level technical metadata (`fileName`, `mimeType`, `sizeBytes`) becomes **immutable immediately after asset creation** across all lifecycle states and reference counts (established from server-validated uploaded binary properties; client-declared MIME/size never authoritative without server validation; binary replacement creates a new `assetId` with its own technical metadata per `INV-DOM21-09` and `INV-DOM21-12`; narrowly supersedes `API-REC-07` only regarding post-creation mutation of `fileName`, `mimeType`, and `sizeBytes`, with exact revised `PUT` semantics unresolved). Per `CL-02` (`OWNER APPROVED`, `2026-11-13`), authorized access must support both internal corporate network and external internet (home/mobile) trainees securely over HTTPS with `D-AUTH-01` / `D-SEC-01` enforcement (never exposing SMB/Windows shares or physical paths). **Phase 1 Media Delivery (`OWNER APPROVED`, `2026-11-13`):** initial production uses **Django-mediated, session-authenticated streaming** through the Storage Abstraction (preserving HTTP `Range`, `206 Partial Content`, `416`, repeated Range requests, and native seeking with authorization on Range requests; no separate Media Delivery Service, Starlette, Uvicorn, ASP.NET Core, S3, MinIO, CDN, Redis, Celery, or silent ASGI change in Phase 1; known worker-occupancy/bandwidth/concurrency risk requires representative workload validation before claiming capacity). **`CL-03` (`OWNER APPROVED`, `2026-11-13` — Future Architectural Direction; Implementation Deferred):** Short-Lived Signed URLs and `ADR-004` direct client streaming remain preserved as the **future** media authorization and delivery direction once traffic/performance justifies a separate delivery layer (distinct from Google Drive `Anyone with the link` external references). Signed URL implementation & `CL-03` technical details (exact TTL, signing algorithm/key management/rotation, URL scope, Range reuse, replay mitigation, delivery validation, post-change invalidation), separate delivery server, exact volume/capacity, backup/retention, DR design, CDN, malware scanning, exact production size limits, chunked/resumable upload, and replacement/deletion lifecycle remain `DEFERRED` under `API-REC-06` *(and all SQL Server media metadata columns remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 4. Authoritative Microsoft SQL Server Reconciliation (`D-DB-01`)

Two frozen reference documents in `docs/backend/` contain provisional PostgreSQL syntax written prior to Owner Decision `D-DB-01`. Because frozen historical/baseline documents are not edited in place, the table below establishes the **authoritative Microsoft SQL Server & Django ORM equivalents**:

| Frozen Document & Section | Provisional PostgreSQL Construct in Frozen Doc | Authoritative Microsoft SQL Server + Django Equivalent (`D-DB-01`) |
| :--- | :--- | :--- |
| [`docs/backend/database-schema.md`](database-schema.md) (42-table 3NF domain model) | `UUID` primary/foreign keys, `TIMESTAMPTZ`, `JSONB` columns, PostgreSQL partial indexes | **Domain model (all 42 tables, foreign keys, and 3NF relationships) remains 100% valid.** In SQL Server / Django ORM: use `UNIQUEIDENTIFIER` (`models.UUIDField`), `DATETIMEOFFSET(7)` (`models.DateTimeField` with `USE_TZ=True`), `NVARCHAR(MAX)` with `ISJSON()` constraint (`models.JSONField`), and SQL Server **filtered indexes** (`WHERE ... IS NOT NULL`). |
| [`docs/backend/database-schema.md`](database-schema.md) (§A.2 `protected_admin` constraint) | `CREATE UNIQUE INDEX idx_users_single_protected_admin ON users (is_protected_admin) WHERE is_protected_admin = TRUE;` | SQL Server Filtered Unique Index:<br>`CREATE UNIQUE NONCLUSTERED INDEX idx_users_single_protected_admin ON users (is_protected_admin) WHERE is_protected_admin = 1 AND deleted_at IS NULL;` |
| [`docs/backend/contracts/developer-bootstrap-contract.md`](contracts/developer-bootstrap-contract.md) (§3 CLI & DB rules) | `pnpm db:bootstrap-developer` CLI and PostgreSQL upsert syntax | Django custom management command:<br>`python manage.py bootstrap_developer --email <email> --name <name>`<br>Executed inside `django.db.transaction.atomic()` against Microsoft SQL Server using `User.objects.select_for_update()`. |
| Historical SUP-01 Reports (`docs/frontend/reports/sup-01-*.md`) | PostgreSQL `SERIALIZABLE` KMS quota admission tables, `SECURITY DEFINER` archival daemons, HSM fencing | **Permanently superseded (`ARCHIVED — HISTORICAL`).** Not part of MetroLMS frontend or Django + SQL Server backend architecture. |

