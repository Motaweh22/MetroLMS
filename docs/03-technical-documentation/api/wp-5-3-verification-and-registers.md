# MetroLMS — WP-5.3 Verification, Registers & Completion Report

> **Document Title:** WP-5.3 Traceability, Provisional/Blocked Registers & Verification Report  
> **Document Identifier:** `METROLMS-API-VER-001`  
> **Document Status:** `DRAFT — UNBLOCKED SCOPE COMPLETE (WP-5.3)`  
> **Canonical Authority Level:** Level 5 API Verification & Traceability Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Last Updated:** 2026-11-14 (`WP-5.3` Execution)

---

## 1. Deliverable Inventory (`WP-5.3`)

1. [`api-domains-01-04-identity-and-catalog.md`](api-domains-01-04-identity-and-catalog.md) (`METROLMS-API-DOM-001`) — Unblocked Domains 01–04, 18 + conditionally gated Domains 05–07.
2. [`api-domains-08-15-17-20-groups-and-learning.md`](api-domains-08-15-17-20-groups-and-learning.md) (`METROLMS-API-DOM-002`) — Unblocked Domains 08–15, 17, 19–20 + conditionally gated Domains 16 & 21.
3. [`openapi-specification.yaml`](openapi-specification.yaml) — Draft OpenAPI `3.1.0` master specification referencing `WP-5.2` foundations.
4. `wp-5-3-verification-and-registers.md` (this file).

---

## 2. Endpoint-to-Requirement Traceability Summary

| Domain(s) | Canonical Paths in `openapi-specification.yaml` | Primary Governing Decisions / Invariants |
| :---: | :--- | :--- |
| **01** | `/api/auth/{login,logout,me}` | `D-AUTH-01`, `S0`–`S15`, `Decision C` (`S8 -> S7`) |
| **02** | `/api/admin/users*`, `/api/profile` | `D-01`, `INV-R1`–`R3`, `INV-R8` (`404`), `INV-R9` (`202`), `MFR-33` |
| **03** | `/api/admin/permissions/*`, `/api/admin/department-tracks*` | 6-tier hierarchy, `INV-R1`–`R9`, `UserPermissionOverride`, `DelegatedAuthority` |
| **04** | `/api/courses`, `/api/courses/{courseId}` | `ADR-008` archive exclusion |
| **05–06** | `/api/lecturer/courses*`, `/api/courses/{courseId}/comments*`, `/api/admin/comments*`, `/instructors` | `Rule B`, `D-SEC-01`, `INV-R9`, `A-03a-1` (`OPEN`) |
| **07** | `/api/courses/{courseId}/{submit,review-data}`, `/api/admin/courses/{courseId}/*` | `API-REC-02` (`OWNER APPROVED`), `Rule B` |
| **08, 17** | `/api/groups/*`, `/api/admin/groups*`, `/api/groups/{groupId}/assistants*`, `/monitoring` | `API-REC-02a`–`02c`, `INV-R7`, `INV-DOM17-01`, `INV-DOM10-10` |
| **09** | `/api/admin/groups/{groupId}/{members,qr-code,join-requests}*`, `/api/groups/join*` | `groups.manage_members` (`A-03c`), `D-07`, `INV-R9` |
| **10, 20** | `/api/admin/groups/{groupId}/{renew,cycles,courses}` | `API-REC-01`, `Domain 20 / D4`, `API-REC-08A`/`08B`, `INV-DOM10-11`/`12` (`409`) |
| **11–15** | `/api/courses/{courseId}/{enrollments,enrollment,progress,items/*}`, `/enrollments/my`, `/attempts`, `/performance`, `/certificates/verify/{code}` | `D-06`, `D-12`, `D-13`, `MFR-32`, `MFR-33` |
| **18** | `/api/admin/permissions/governance/approvals*`, `/api/admin/audit*` | `INV-R9` (`202`), `INV-R10`, `D-14`, `INV-R8` |
| **19** | `/api/notifications*`, `/whatsapp-contacts`, `/whatsapp-visibility`, `/api/public/support-contacts` | `D-08`, `D-09`, `INV-R8` |
| **21** | `/api/admin/groups/{groupId}/materials*`, `/api/media/assets/*` | `D-MEDIA-01`, `API-REC-06` (`DEFERRED`), `INV-DOM21-05`–`21`, `A-03c-1`–`3` |

---

## 3. Provisional Contract Register (Not Frozen)

| Item / Area | Reason Provisional | Owner Decision Needed |
| :--- | :--- | :--- |
| Base path & versioning (`/api/...` vs `/api/v1/...`) | Frontend uses `/api/...`; `APISpec-template.md` illustrates `/api/v1/` | `OD-API-01` |
| Non-paginated `200`/`201` envelope (`{ status: "OK", data }` vs bare JSON) | Contract §2.1 vs MSW bare objects | `OD-API-02` |
| Pagination query param (`pageSize` vs `page_size`) & default (`15` vs `20`) | Contract §2.2/`permissionsHandlers.ts` vs `APISpec-template.md` | `OD-API-03` |
| Error `code` enum registry (incl. `INV-DOM10-12` `409` code) | Only `PERMISSION_DENIED` & `RESOURCE_NOT_FOUND` confirmed | `OD-API-04` |
| All DB-bound DTO fields flagged in Cluster 1 & 2 | Requires `WP-5.4` + `WP-5.5` Owner Input & Schema Review Gate | `WP-5.5` Gate |
| `PUT /api/lecturer/courses/{courseId}/draft` (`assistant_admin` scope) | `assistant_admin` `INV-R7` vs `INV-R9` draft scope unresolved | `A-03a-1` |
| `GET /api/certificates/verify/{code}` | Target Domain 15 requirement; not yet in MSW | `WP-5.3` / Backend review |

---

## 4. Blocked Endpoint & Excluded Alias Register

### A. Blocked / Unimplemented Target Endpoints
- **Domain 16 (In-Person Attendance):** Zero MSW/frontend endpoints exist; blocked pending Owner specification.
- **`DELETE /api/admin/groups/{groupId}/materials/files/{fileId}`:** Blocked on **`A-03c-1`** (exact Logical Detachment state, audit fields, and restoration rules).
- **`PUT /api/admin/groups/{groupId}/materials/files/{fileId}/move`:** Blocked on **`A-03c-3`** (`materials.manage_folders` vs. `materials.manage_references`).
- **`DELETE /api/media/assets/{assetId}`:** Blocked on **`A-03c-2`** (zero-reference eligibility, retention, `409` conflict semantics).
- **`CL-03` Signed URLs & Future Media Delivery:** `DEFERRED` under **`API-REC-06`**.

### B. Excluded Legacy / Duplicate Aliases (Not Promoted to Canonical)
- **`API-REC-02` (16 excluded Course Review aliases + 1 unused handler):** `/api/courses/{courseId}/submit-review`, `/api/admin/review/{courseId}*` (9 routes), `/api/approvals/queue`, `/api/admin/approvals`, `/api/approvals/my-submissions`, `/api/lecturer/approvals` (note: queue listing consolidation under `/api/admin/courses/review-queue` vs existing queue path to be finalized before backend coding).
- **`API-REC-01` (Retired browser auto-renewal mocks):** `/api/admin/groups/check-all-due-renewals` and `/api/admin/groups/{groupId}/check-auto-renewal` (replaced by Windows Task Scheduler -> `process_due_group_renewals`).
- **Route Aliases Normalized:** `/api/courses/{courseId}/enroll` (use `/enrollments`), `/api/courses/{courseId}/lessons/{itemId}/*` and `/api/courses/{courseId}/{activity,complete}` (use `/items/{itemId}/*`), `POST /api/notifications/{id}/read` (use `PATCH`).

---

## 5. Verification Results & Next Step

- **Verification:** Cross-checked all `140` MSW handler registrations and `16` feature API services (`frontend/src/features/**/api|services/*.ts`) against `WP-5.1`, `WP-5.2`, `CURRENT.md` §7, and `django-sqlserver-integration-contract.md`. Zero runtime code, MSW handlers, tests, Django models, or SQL DDL were modified or created.
- **Next Recommended Work Package:** **`WP-5.4` — Logical Data Model & Conceptual ERD (`Stage 2`, `docs/02-architecture-and-design/data-models/`)** using `DatabaseSpec-template.md` Part 1 (engine-agnostic, pre-freeze discovery for the `WP-5.5` Mandatory Owner Input & Schema Review Gate).

