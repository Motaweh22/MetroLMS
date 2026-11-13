# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 21 — File Storage & Decoupled Media (`D-MEDIA-01`)

> **Document Title:** Technical Domain Specification — File Storage & Decoupled Media  
> **Document Identifier:** `METROLMS-TECH-DOM-021`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-MEDIA-01`](../../../architecture/decision-register.md#d-media-01), [`ADR-004`](../../../02-architecture-and-design/adr/ADR-004-decoupled-media-storage.md), `API-REC-06` (Deferred), `API-REC-07`  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `mediaStorageService.ts` (`metro_lms_media_db` IndexedDB local blob store for course media), `groupsApi.ts` & `groupHandlers.ts` (JSON metadata endpoints for `GroupMaterialFolder` and `GroupMaterialFile`), `inMemoryStore.ts`.
- **Deferred Architecture Boundary (`API-REC-06`):** Storage provider, CDN, network topology, binary upload transport (`multipart/form-data` vs. pre-signed upload), and production media delivery authorization remain **strictly deferred** under `D-MEDIA-01`, `CL-02`, and `CL-03`.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Material Resource `PUT` vs. `PATCH` Semantics (`API-REC-07`):**
   - `PUT /api/admin/groups/:groupId/materials/files/:fileId` (`replaceMaterialFile`) accepts JSON `{ fileName, sizeBytes, mimeType }` (no binary stream in prototype) and replaces the file-reference metadata record.
   - `PATCH /api/admin/groups/:groupId/materials/files/:fileId` (`updateMaterialFile`) accepts `{ title?, isVisible? }` and updates display metadata/visibility.
   - Both HTTP methods are semantically distinct and retained on the same resource URL without implying binary upload transport approval.
2. **Material Folder & File Management:**
   - Supports folder create/rename/visibility/delete, file add/replace/update/move/delete, and trainee-side hidden-item filtering (`isVisible === false`).

---

## 3. Validation, Authorization & Failure Scenarios

- **Test Coverage Gaps:** `deleteMaterialFolder`, `moveMaterialFile`, and `updateMaterialFile` (`PATCH`) currently have `NO TEST`.
- **Provisional Persistence Notice:** `MediaAssetReference`, `GroupMaterialFolder`, and `GroupMaterialFile` columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-OPS-021`](../../../01-requirements/domains/domain-21-file-storage-and-decoupled-media.md)
- **Verification Evidence:** `persistent-media-storage.test.tsx` (15 specs), `training-groups-api.test.tsx`, `training-groups-materials.test.tsx` (deferred to Gate B).

