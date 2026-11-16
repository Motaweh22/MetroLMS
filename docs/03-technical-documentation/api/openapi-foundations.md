# MetroLMS — OpenAPI 3.1 Foundational Contracts

> **Document Title:** OpenAPI 3.1 Foundational API Contracts, Security Schemes & Reusable Components  
> **Document Identifier:** `METROLMS-API-FOUND-001`  
> **Document Status:** `DRAFT — WORK IN PROGRESS (WP-5.2)`  
> **Canonical Authority Level:** Level 5 API Integration Specification (Governed by Levels 1–4)  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend DRF Engineers, Frontend React Integrators, Database Architects & QA Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01), `INV-R1`–`INV-R10`, `API-REC-02`, `API-REC-06` (`DEFERRED`)  
> **Last Updated:** 2026-11-14 (`WP-5.2` Execution)

---

## 1. Purpose & Scope

This specification defines the reusable **OpenAPI 3.1.0** foundational components (`securitySchemes`, `schemas`, `parameters`, `responses`, and HTTP transport conventions) shared across all 21 MetroLMS domain API contracts authored in `WP-5.3`.

- **Build Basis:** Reuses [`phase-5-execution-and-discovery-baseline.md`](phase-5-execution-and-discovery-baseline.md) (`WP-5.1`) and [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) without repeating the full endpoint inventory.
- **Governance Classification:** Every component in this document is explicitly labeled using one of four statuses:
  - **`OWNER APPROVED`** — Explicitly approved by the Project Owner in `decision-register.md`, `CURRENT.md` §7, or Phase 5 kickoff.
  - **`CANONICAL EXISTING REQUIREMENT`** — Established in Level 1–4 canonical documentation or verified frontend/MSW contracts.
  - **`PROPOSED TECHNICAL DESIGN`** — Engineering OpenAPI 3.1 representation derived from approved contracts; not yet frozen.
  - **`PENDING OWNER DECISION`** — Conflicting or incomplete specification requiring explicit Owner resolution before `WP-5.3` / `WP-5.5` freeze.
- **Database Boundary:** This document does **not** freeze any OpenAPI contract or database schema. Any field implying persisted storage is flagged in Section 12 for the **Mandatory Owner Input & Schema Review Gate** prior to `WP-5.5` / `WP-5.6`.

---

## 2. OpenAPI 3.1 Conventions

| Convention | Specification | Classification | Source |
| :--- | :--- | :---: | :--- |
| **Specification Version** | OpenAPI `3.1.0` (JSON Schema Draft 2020-12 compatible) | `PROPOSED TECHNICAL DESIGN` | `REV6` Phase 5 |
| **Base Path Convention** | `/api/...` (preserving verified frontend client paths in `frontend/src/core/api/apiClient.ts` and MSW handlers; no `/api/v1` prefix unless Owner approves versioning change) | `CANONICAL EXISTING REQUIREMENT` | `frontend/src/mocks/handlers/*.ts`, `API-REC-02` |
| **Course Review Canonical Prefix** | `/api/admin/courses/{courseId}/*` (excludes 16 equivalent legacy/alternative aliases & 1 unused handler) | `OWNER APPROVED` | `API-REC-02` (`CURRENT.md` §7) |
| **Group Assistants Prefix** | `/api/groups/{groupId}/assistants` (`GET`, `POST`, `DELETE .../{lecturerId}`) | `OWNER APPROVED` | `API-REC-02a`–`02c` (`CURRENT.md` §7) |
| **Date-Time Format** | ISO-8601 UTC (`date-time`, e.g., `2026-11-14T07:30:00Z`) matching SQL Server `DATETIMEOFFSET(7)` / Django `USE_TZ=True` | `CANONICAL EXISTING REQUIREMENT` | `django-sqlserver-integration-contract.md` §2.3, §4 |
| **API Versioning Strategy** | Implicit unversioned `/api/` in Phase 1; explicit URL/header versioning strategy deferred | `PENDING OWNER DECISION` | See §12 (`OD-API-01`) |

---

## 3. Security Schemes (`D-AUTH-01`, `D-SEC-01`, `INV-R1`–`INV-R10`)

### 3.1 Authentication & CSRF Transport (`D-AUTH-01` — `OWNER APPROVED`)
Per `D-AUTH-01`, [`authentication-and-session-contract.md`](../../architecture/authentication-and-session-contract.md), and [`apiClient.ts`](../../../frontend/src/core/api/apiClient.ts#L226-L246):
- Production authentication uses **Django server-side database-backed sessions** via an `HttpOnly`, `Secure` (over HTTPS), `SameSite=Lax` (or `Strict` per deployment) `sessionid` cookie (`credentials: 'same-origin'`).
- **Prohibited:** Browser-stored JWTs, `Authorization: Bearer ...` headers in production (DEV-only MSW fallback in `apiClient.ts#L222-L224` is excluded from production OpenAPI contracts), and WebCrypto session encryption (`S8`).
- **CSRF Protection:** All state-mutating same-origin requests (`POST`, `PUT`, `PATCH`, `DELETE`, including `POST /api/auth/logout`) must include the `X-CSRFToken` header matching the `csrftoken` cookie (`apiClient.ts#L161-L246`).

```yaml
components:
  securitySchemes:
    djangoSessionCookie:
      type: apiKey
      in: cookie
      name: sessionid
      description: >
        OWNER APPROVED (D-AUTH-01): HttpOnly, Secure server-side Django session cookie.
        Sent automatically by the browser with credentials: 'same-origin'.
    djangoCsrfHeader:
      type: apiKey
      in: header
      name: X-CSRFToken
      description: >
        OWNER APPROVED (D-AUTH-01): Double-submit CSRF token extracted from the
        csrftoken cookie. Required on all POST, PUT, PATCH, and DELETE requests.
```

### 3.2 Authorization & Role Invariants Applied to Endpoints
Every protected operation in `WP-5.3` must declare its enforcement requirements under:
- **6-Tier Role Hierarchy & Capabilities (`INV-R1`–`INV-R7`, `OD-01`):** `developer` (Tier 0, `USR_DEV_001` singleton), `super_admin` (Tier 1, `Superior`), `admin` (Tier 2), `assistant_admin` (Tier 3), `lecturer` (Tier 4), `trainee` (Tier 5).
- **Group-Scoped & Monitoring Boundaries (`INV-R7`, `INV-DOM17-01`):** Group assignment (`primaryInstructorId` / `GroupAssistantAssignment`) grants scope only for group-scoped capabilities and never substitutes for missing capabilities (`A-03c` Owner Decision `2026-11-14`); `supervisorIds` is strictly read/monitoring-only.
- **Developer Confidentiality (`INV-R8` / `MFR-39`):** Non-Developer actors querying or mutating a `Developer` account ID receive `404 Not Found` (`RESOURCE_NOT_FOUND`), never `403 Forbidden`.
- **Default-to-Approval (`INV-R9` / `INV-R10`):** Sensitive `assistant_admin` mutations return `202 Accepted` (`PendingApprovalResponse`) unless `DelegatedAuthority` covers the exact capability.

---

## 4. Request & Response Conventions

- **Headers:** `Content-Type: application/json` and `Accept: application/json` for JSON endpoints (`apiClient.ts#L215-L218`); `multipart/form-data` for Step 1 binary media upload (`API-REC-06`, `OWNER APPROVED` `2026-11-13`); binary/range responses (`Accept-Ranges: bytes`, `Content-Range`) for Phase 1 Django-mediated media streaming (`API-REC-06`).
- **Success Envelope Classification (`PENDING OWNER DECISION` — `OD-API-02`):**
  - [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md#L26-L32) §2.1 defines `{ "status": "OK", "data": { ... } }` for `200`/`201` immediate responses, while §2.2 defines bare DRF `PageNumberPagination` (`{ "count", "next", "previous", "results" }`) without a `{ status, data }` wrapper.
  - Current MSW handlers and `apiClient.ts` frequently return direct resource objects or `{ items, totalCount, page, pageSize }`.
  - **Action:** `WP-5.2` provides `SuccessEnvelope` as `PROPOSED TECHNICAL DESIGN` matching §2.1, and flags **`OD-API-02`** in Section 12 for Owner confirmation on whether `200`/`201` non-paginated endpoints wrap payloads in `{ status: "OK", data }` or return bare DRF serializer JSON.

```yaml
components:
  schemas:
    SuccessEnvelopeBase:
      type: object
      required: [status, data]
      properties:
        status:
          type: string
          const: OK
        data:
          type: object
```

---

## 5. Pagination Components (`CANONICAL EXISTING REQUIREMENT` + `PENDING OWNER DECISION`)

Per [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md#L34-L43) §2.2, collection endpoints use DRF `PageNumberPagination`:
- **Response Schema (`CANONICAL EXISTING REQUIREMENT`):** `count` (total items, integer $\ge 0$), `next` (nullable URI string), `previous` (nullable URI string), `results` (array of items).
- **Query Parameter Naming Conflict (`PENDING OWNER DECISION` — `OD-API-03`):** `django-sqlserver-integration-contract.md` §2.2 example and `permissionsHandlers.ts#L783` use `pageSize` (with default `15` in `permissionsHandlers.ts`, max `100`), whereas [`APISpec-template.md`](../../_templates/APISpec-template.md#L27-L28) uses `page_size` (default `20`, max `100`). Both are documented; `pageSize` vs. `page_size` and default page size (`15` vs. `20`) are flagged in Section 12.

```yaml
components:
  parameters:
    PageQueryParam:
      name: page
      in: query
      required: false
      schema:
        type: integer
        minimum: 1
        default: 1
      description: 1-based page number.
    PageSizeQueryParam:
      name: pageSize
      in: query
      required: false
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
      description: >
        PROVISIONAL PARAMETER NAME (OD-API-03): pageSize (contract §2.2 & MSW) vs.
        page_size (APISpec-template). Max 100.
  schemas:
    PaginatedResponseBase:
      type: object
      required: [count, next, previous, results]
      properties:
        count:
          type: integer
          minimum: 0
        next:
          type: [string, "null"]
          format: uri-reference
        previous:
          type: [string, "null"]
          format: uri-reference
        results:
          type: array
          items: {}
```

---

## 6. HTTP `202 Accepted` Approval Components (`INV-R9`, `INV-R10` — `CANONICAL EXISTING REQUIREMENT`)

Per [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md#L45-L57) §2.3 and `INV-R9`/`INV-R10`:
- When an `assistant_admin` invokes a gated mutation (`user_delete`, `group_delete`, `enrollment_remove`, `grade_override`, `certificate_revoke`, `course_unpublish`, or any capability covered by `ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES`) without an exact-capability `DelegatedAuthority` bypass, the server **must not** execute the mutation immediately; it creates a `PendingApprovalRequest` and returns **`202 Accepted`**.
- Execution upon `Admin` approval re-validates target existence, scope, and `INV-R1`–`INV-R8` (`INV-R10`), failing with `ExecutionFailed` if stale or out-of-scope.

```yaml
components:
  schemas:
    PendingApprovalResponse:
      type: object
      required:
        - status
        - approvalRequestId
        - actionType
        - requestedByUserId
        - createdAt
        - message
      properties:
        status:
          type: string
          const: PendingApproval
        approvalRequestId:
          type: string
          description: Identifier of the created PendingApprovalRequest (DB-bound; see §12).
        actionType:
          type: string
          description: Canonical gated action/capability identifier.
        requestedByUserId:
          type: string
        createdAt:
          type: string
          format: date-time
        message:
          type: string
          description: Localized Arabic confirmation message for pending-review UI toast/badge.
  responses:
    AcceptedPendingApproval:
      description: >
        CANONICAL EXISTING REQUIREMENT (INV-R9 / MFR-35 / MFR-36): Mutation queued
        for Admin approval; target entity was NOT mutated.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/PendingApprovalResponse"
```

---

## 7. Standard Error Components (`INV-R8` & §2.4)

Per [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md#L59-L70) §2.4:
- **Structure (`CANONICAL EXISTING REQUIREMENT`):** `status: "ERROR"`, `code` (machine-readable string), `message` (localized Arabic user-facing message, sanitized per `apiClient.ts#L118-L120` with zero stack traces/HTML), and optional `fieldErrors` (map of field name to string array).
- **`INV-R8` Non-Disclosure (`OWNER APPROVED` / `CANONICAL EXISTING REQUIREMENT`):** Queries or mutations by any non-Developer actor targeting a `Developer` account ID **must** return `404 Not Found` (`code: "RESOURCE_NOT_FOUND"`), never `403 Forbidden`.
- **Error Code Taxonomy (`PENDING OWNER DECISION` — `OD-API-04`):** Only `PERMISSION_DENIED` and `RESOURCE_NOT_FOUND` are explicitly named in `django-sqlserver-integration-contract.md` §2.4, while `CURRENT.md` §7 (`INV-DOM10-12`) flags *"exact `code` flagged for API error-contract decision"*. Provisional standard codes (`VALIDATION_ERROR`, `AUTHENTICATION_REQUIRED`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`) are documented as `PROPOSED TECHNICAL DESIGN` pending Owner confirmation.

```yaml
components:
  schemas:
    StandardErrorResponse:
      type: object
      required: [status, code, message]
      properties:
        status:
          type: string
          const: ERROR
        code:
          type: string
          description: >
            Machine-readable error code. Confirmed examples: PERMISSION_DENIED,
            RESOURCE_NOT_FOUND. Full taxonomy pending OD-API-04.
        message:
          type: string
          description: Safe, localized Arabic error message (no stack traces or HTML).
        fieldErrors:
          type: object
          additionalProperties:
            type: array
            items:
              type: string
  responses:
    BadRequestError:
      description: 400 Bad Request — Malformed request or validation error.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/StandardErrorResponse"
    UnauthorizedError:
      description: 401 Unauthorized — Missing, expired, or invalidated Django session.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/StandardErrorResponse"
    ForbiddenError:
      description: 403 Forbidden — Authenticated actor lacks capability or group scope (never returned for Developer IDs per INV-R8).
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/StandardErrorResponse"
    NotFoundError:
      description: 404 Not Found — Resource does not exist or is masked under INV-R8 Developer confidentiality.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/StandardErrorResponse"
    ConflictError:
      description: 409 Conflict — State/concurrency conflict (e.g., INV-DOM10-12 losing renewal transaction).
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/StandardErrorResponse"
    UnprocessableEntityError:
      description: 422 Unprocessable Entity — Domain/business-rule invariant violation.
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/StandardErrorResponse"
```

---

## 8. `MediaAssetReference` Components (`D-MEDIA-01` & `API-REC-06`)

Per [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md#L74-L90) §3 and `CURRENT.md` §7 (`API-REC-06` remains `DEFERRED`):
- **`MediaAssetReference` (`CANONICAL EXISTING REQUIREMENT`):** `assetId` (required), `url` (required), `mimeType` (required), `fileName` (required), `sizeBytes` (optional integer), `disposition` (optional `'inline' | 'attachment'`). No additional fields or physical DB columns are invented here.
- **Asset vs. Content Reference Separation (`OWNER APPROVED` `2026-11-13`):**
  - **Media Asset (`INV-DOM21-09`, `INV-DOM21-16`):** Underlying binary + immutable technical metadata (`fileName`, `mimeType`, `sizeBytes`) established on Step 1 multipart upload (`INV-DOM21-12`), identified by a new `assetId` on every binary replacement.
  - **Content Reference (`INV-DOM21-13`, `INV-DOM21-14`, `INV-DOM21-17`, `INV-DOM21-18`):** Context-specific usage reference (Draft Course Version or Group Renewal Cycle material) owning `title` and `isVisible`. Removal uses **Logical Detachment** (`INV-DOM21-18`), never physical deletion of the underlying asset while any reference depends on it (`INV-DOM21-17`).
- **Pending `A-03c` / `API-REC-06` Boundaries:** Step 2 repoint/detachment DTOs, logical detachment state fields, restoration rules, asset deletion eligibility (`A-03c-1`, `A-03c-2`), `/move` capability (`A-03c-3`), `assistant_admin` Draft scope (`A-03a-1`), and `CL-03` signed URLs remain `PENDING OWNER DECISION` / `DEFERRED`.

```yaml
components:
  schemas:
    MediaAssetReference:
      type: object
      required: [assetId, url, mimeType, fileName]
      properties:
        assetId:
          type: string
          description: Stable logical Media Asset identifier (INV-DOM21-09).
        url:
          type: string
          format: uri-reference
          description: >
            Phase 1 Django-mediated session-authenticated stream URL (API-REC-06).
            Future CL-03 signed URLs remain DEFERRED.
        mimeType:
          type: string
          description: Server-validated MIME type; immutable after asset creation (INV-DOM21-16).
        fileName:
          type: string
          description: Original/validated file name; immutable after asset creation (INV-DOM21-16).
        sizeBytes:
          type: integer
          minimum: 0
          description: Server-validated binary size in bytes; immutable after asset creation (INV-DOM21-16).
        disposition:
          type: string
          enum: [inline, attachment]
```

---

## 9. Common Parameter Definitions

| Parameter Name | Location | Schema / Type | Classification | Notes |
| :--- | :---: | :--- | :---: | :--- |
| `courseId` | `path` | `string` (required) | `CANONICAL EXISTING REQUIREMENT` | Course identifier across catalog, builder, review, enrollment, learning |
| `groupId` | `path` | `string` (required) | `CANONICAL EXISTING REQUIREMENT` | Training group identifier |
| `cycleId` | `path` | `string` (required) | `CANONICAL EXISTING REQUIREMENT` | `GroupRenewalCycle` identifier (`D-GRP-01`/`04`) |
| `userId` / `id` | `path` | `string` (required) | `CANONICAL EXISTING REQUIREMENT` | Target user/resource identifier (`INV-R8` applies to user IDs) |
| `page` | `query` | `integer` ($\ge 1$, default `1`) | `CANONICAL EXISTING REQUIREMENT` | `PageNumberPagination` |
| `pageSize` / `page_size` | `query` | `integer` (`1..100`) | `PENDING OWNER DECISION` | See `OD-API-03` |
| `Idempotency-Key` | `header` | `string` (optional / proposed) | `PROPOSED TECHNICAL DESIGN` | Recommended for Step 2 repoint & standalone provisioning retries; exact header requirement pending |

---

## 10. HTTP Status Code Conventions

| Status | Meaning in MetroLMS | Classification | Key Governance Rule |
| :---: | :--- | :---: | :--- |
| `200 OK` | Query success or immediate mutation success | `CANONICAL EXISTING REQUIREMENT` | Wrap rule subject to `OD-API-02` |
| `201 Created` | New resource created | `CANONICAL EXISTING REQUIREMENT` | Used on resource creation endpoints |
| `202 Accepted` | Deferred `PendingApproval` (`assistant_admin`) | `OWNER APPROVED` | `INV-R9` / `MFR-36`; no local state mutation |
| `204 No Content` | Immediate deletion / empty success | `PROPOSED TECHNICAL DESIGN` | Confirm vs. `200 OK` in `WP-5.3` |
| `206 Partial Content` | Byte-range media streaming | `OWNER APPROVED` | `API-REC-06` Phase 1 Django-mediated `Range` streaming |
| `400 Bad Request` | Malformed syntax / validation error | `CANONICAL EXISTING REQUIREMENT` | `StandardErrorResponse` |
| `401 Unauthorized` | Unauthenticated / expired session | `CANONICAL EXISTING REQUIREMENT` | Triggers client epoch/auth reset |
| `403 Forbidden` | Missing capability / group scope / CSRF failure | `CANONICAL EXISTING REQUIREMENT` | Never returned for `Developer` IDs (`INV-R8`) |
| `404 Not Found` | Missing resource or `INV-R8` masked `Developer` | `OWNER APPROVED` | `INV-R8` confidentiality rule |
| `409 Conflict` | Concurrency / state conflict (`INV-DOM10-12`) | `OWNER APPROVED` | Losing manual renewal transaction returns `409` |
| `416 Range Not Satisfiable` | Invalid HTTP `Range` header on media stream | `OWNER APPROVED` | `API-REC-06` Phase 1 streaming |
| `422 Unprocessable Entity` | Business rule / invariant violation | `CANONICAL EXISTING REQUIREMENT` | `StandardErrorResponse` |
| `429 Too Many Requests` | Rate limiting / throttling | `CANONICAL EXISTING REQUIREMENT` | Mapped in `apiClient.ts#L89-L90` |
| `500`–`504` | Server / upstream failure | `CANONICAL EXISTING REQUIREMENT` | Sanitized error; logout enters `LOGOUT_UNCONFIRMED` |

---

## 11. Traceability to Existing Decisions

| Decision / Invariant | Section(s) Governed | Source Document |
| :--- | :--- | :--- |
| `D-AUTH-01` | §3.1 (`djangoSessionCookie`, `djangoCsrfHeader`), §10 (`401`) | [`decision-register.md`](../../architecture/decision-register.md), [`authentication-and-session-contract.md`](../../architecture/authentication-and-session-contract.md) |
| `D-SEC-01`, `INV-R1`–`INV-R10` | §3.2, §6 (`202 Accepted`), §7 (`INV-R8` `404`) | [`security-and-xss-baseline.md`](../../architecture/security-and-xss-baseline.md) |
| `D-MEDIA-01`, `API-REC-06`, `INV-DOM21-05..21` | §8 (`MediaAssetReference`, Asset vs. Reference), §10 (`206`, `416`) | [`CURRENT.md`](../../project-state/CURRENT.md) §7, [`FRD-MEDIA-001`](../../01-requirements/frd/FRD-MEDIA-001-phase-1-media-architecture-requirements-baseline.md) |
| `API-REC-02`, `API-REC-02a`–`02c` | §2 (canonical review & group-assistant prefixes) | [`CURRENT.md`](../../project-state/CURRENT.md) §7 |
| `INV-DOM10-12` | §7, §10 (`409 Conflict`) | [`CURRENT.md`](../../project-state/CURRENT.md) §7 |

---

## 12. Unresolved Owner Decisions & Database-Bound Field Flags

### A. Unresolved Foundational API Decisions
| ID | Precise Question | Options / Context | Impact on `WP-5.3` |
| :--- | :--- | :--- | :--- |
| **`OD-API-01`** | Explicit API URL/header versioning policy (`/api/...` vs. `/api/v1/...`) | Current MSW/client uses `/api/...`; `APISpec-template.md` illustrates `/api/v1/` | Affects server base path across all `WP-5.3` specs |
| **`OD-API-02`** | Non-paginated `200`/`201` envelope: mandatory `{ status: "OK", data }` (`§2.1`) vs. bare DRF resource JSON | `django-sqlserver-integration-contract.md` §2.1 vs. current MSW handlers | Affects response schemas of non-list endpoints |
| **`OD-API-03`** | Pagination query param (`pageSize` vs. `page_size`) and default page size (`15` vs. `20`) | Contract §2.2 & `permissionsHandlers.ts` (`pageSize`, `15`) vs. `APISpec-template.md` (`page_size`, `20`) | Affects all list endpoint query parameters |
| **`OD-API-04`** | Canonical `StandardErrorResponse.code` enum/registry (including `INV-DOM10-12` `409` code) | Only `PERMISSION_DENIED` & `RESOURCE_NOT_FOUND` are confirmed; `CURRENT.md` §7 flags `409` code | Affects error response examples/enums across `WP-5.3` |
| **`A-03c-1`..`3`, `A-03a-1`** | Logical detachment state/audit/restore, asset deletion/`409`, `/move` capability, `assistant_admin` draft scope | Carried from `A-03c` Consolidated Design §16 | Blocks specific media/move/draft endpoint contracts only |

### B. Database-Bound Inputs Flagged for Mandatory Owner Input & Schema Review Gate (`WP-5.5`)
No database column or schema is finalized here. Foundational envelopes imply the following persisted concepts for later `WP-5.4`/`WP-5.5` Owner review:
- **`PendingApprovalResponse` (`approvalRequestId`, `actionType`, `requestedByUserId`, `createdAt`):** Persisted in `PendingApprovalRequest` (`Domain 18`, `INV-R9`/`INV-R10`); requires retention/audit linkage review.
- **`MediaAssetReference` (`assetId`, `fileName`, `mimeType`, `sizeBytes`):** Asset-level immutable technical metadata (`Domain 21`, `INV-DOM21-16`), separate from reference-level `title`/`isVisible` (`INV-DOM21-13`) and logical detachment fields (`A-03c-1`).

---

## 13. Dependencies for `WP-5.3`

Before authoring the 21-domain OpenAPI specifications in `WP-5.3`:
1. **Unblocked to Start Immediately:** Domains 01–04, 08–15, 17–20 can be drafted using `djangoSessionCookie`, `djangoCsrfHeader`, `PaginatedResponseBase`, `AcceptedPendingApproval`, `StandardErrorResponse`, and `MediaAssetReference` (marking `OD-API-01`–`04` provisional).
2. **Conditionally Gated Endpoints in `WP-5.3`:** Media Logical Detachment/Asset Deletion/Move (`Domain 21`, `A-03c-1`–`A-03c-3`), `assistant_admin` Draft editing (`Domain 05`, `A-03a-1`), and Physical Attendance (`Domain 16`, unimplemented in frontend/MSW) require explicit Owner input or must be marked `PROPOSED — PENDING OWNER DECISION`.

