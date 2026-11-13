# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 21 — File Storage & Decoupled Media (`D-MEDIA-01`)

> **Document Title:** Domain 21 — File Storage & Decoupled Media Business Rules  
> **Document Identifier:** `METROLMS-DOM-OPS-021`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01), [`ADR-004`](../../02-architecture-and-design/adr/ADR-004-decoupled-media-storage.md), `API-REC-06` (Deferred), `API-REC-07`  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Maintain a strict decoupling boundary (`D-MEDIA-01`) between frontend/application metadata (`MediaAssetReference`, `GroupMaterialFolder`, `GroupMaterialFile`) and physical media binary storage/delivery, while preserving `API-REC-06` deferrals and `API-REC-07` `PUT` vs. `PATCH` resource semantics.
- **Domain Boundaries:**
  - *In Scope:* `D-MEDIA-01` decoupled media contract, group material folder/file metadata lifecycle (`createMaterialFolder`, `updateMaterialFolder`, `deleteMaterialFolder`, `addMaterialFile`, `replaceMaterialFile`, `updateMaterialFile`, `moveMaterialFile`, `deleteMaterialFile`), local IndexedDB prototype isolation (`mediaStorageService.ts`), and explicit documentation of deferred media architecture decisions (`API-REC-06`).
  - *Out of Scope:* Selecting a storage provider, CDN, network exposure model (intranet vs. external trainee access), upload transport (`multipart/form-data` vs. pre-signed URLs), or production media delivery authorization — **all strictly deferred under `API-REC-06` / `CL-02` / `CL-03`**.
- **Core Entities:** `MediaAssetReference`, `GroupMaterialFolder`, `GroupMaterialFile` *(all persistence fields remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM21-01`** | **Application-to-Media Decoupling (`D-MEDIA-01`)** | Frontend and core Django REST endpoints consume decoupled `MediaAssetReference` / file metadata contracts (`mediaId`, `fileName`, `sizeBytes`, `mimeType`, `url`) without coupling to a specific physical storage engine. | `system-architecture.md`, `ADR-004` |
| **`INV-DOM21-02`** | **Distinct `PUT` vs. `PATCH` Resource Semantics (`API-REC-07`)** | `PUT /api/admin/groups/:groupId/materials/files/:fileId` replaces the file-reference/asset metadata record (`{ fileName, sizeBytes, mimeType }`); `PATCH` on the same URL updates display metadata/visibility (`{ title?, isVisible? }`). Neither HTTP method implies binary upload transport approval. | `groupsApi.ts`, `groupHandlers.ts` |
| **`INV-DOM21-03`** | **Trainee Hidden-Material Filtering** | Folders and files with `isVisible === false` are filtered out from trainee-facing material responses. | `inMemoryStore.getGroupMaterials` |
| **`INV-DOM21-04`** | **Media Architecture Deferral (`API-REC-06`)** | Binary upload transport, storage backend, CDN, network topology, and delivery authorization remain **undecided and deferred** until Owner decisions on external trainee access (`CL-02`, `CL-03`). | `API-REC-06` Governance Hold |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `D-MEDIA-01` mandates a decoupled media contract; `ADR-004` keeps media payloads out of core transactional DB rows.
- **Current Prototype Behavior:**
  - Course media blobs (video/PDF/image) are stored locally in browser IndexedDB (`frontend/src/core/storage/mediaStorageService.ts`, `metro_lms_media_db`), strictly isolated to the local browser origin.
  - Group material endpoints (`groupHandlers.ts`, `inMemoryStore.ts`) transport JSON metadata only (`{ fileName, sizeBytes, mimeType }` -> `/dev-media/materials/...`), with no binary stream or `FormData`.
- **Implementation Gap:** No cross-device server binary upload, streaming, or delivery authorization exists in the prototype; `deleteMaterialFolder`, `moveMaterialFile`, and `updateMaterialFile` (`PATCH`) currently have `NO TEST`.
- **Target Backend Behavior (Constrained):** Core Django models store decoupled references; **physical upload transport (`multipart` vs. pre-signed), storage engine (`MEDIA_ROOT` vs. object storage), CDN, and delivery auth are NOT decided here and remain deferred under `API-REC-06`**.
- **Deferred / Provisional Notice:** All media reference columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM21-01`, `INV-DOM21-04` | [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01), [`ADR-004`](../../02-architecture-and-design/adr/ADR-004-decoupled-media-storage.md), `API-REC-06` | [`METROLMS-TECH-DOM-021`](../../03-technical-documentation/domains/operations/domain-21-file-storage-and-decoupled-media.md) | `persistent-media-storage.test.tsx` (15 specs) |
| `INV-DOM21-02`, `INV-DOM21-03` | `API-REC-07` | [`METROLMS-TECH-DOM-021`](../../03-technical-documentation/domains/operations/domain-21-file-storage-and-decoupled-media.md) | `training-groups-api.test.tsx`, `training-groups-materials.test.tsx` (`PATCH`/`move`/`deleteFolder` `NO TEST`) |

