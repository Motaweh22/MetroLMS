# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 06 — Course Content & Lessons

> **Document Title:** Technical Domain Specification — Course Content & Lessons  
> **Document Identifier:** `METROLMS-TECH-DOM-006`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-MEDIA-01`](../../../architecture/decision-register.md#d-media-01), [`D-SEC-01`](../../../architecture/decision-register.md#d-sec-01), [`Rule B`](../../../requirements/domain-business-rules.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:**
  - Curriculum item editors and lesson content renderers consuming `Chapter`, `ChapterItem`, and `MediaAssetReference`.
  - Centralized HTML sanitizer (`sanitizeHtml.ts` using DOMPurify) for rich text lesson notes.
- **Target Backend Components (Django 5 + DRF):**
  - Curriculum structure serializers (`Chapter` -> `ChapterItem[]`), MIME/size metadata validators, and HTML sanitization before persistence.
  - Decoupled media metadata handler (`MediaAssetReference` per `D-MEDIA-01`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Item Classification & `Rule B` Field Partitioning:**
   - Every `ChapterItem` explicitly partitions **substantive fields** (`type`, `videoUrl`, `pdfUrl`, `mediaId`, `content`, `durationSeconds`) from **metadata fields** (`title`, `description`, `order`, `duration`) for Domain 07 fingerprinting.
2. **Decoupled Media Reference (`D-MEDIA-01`):**
   - Video and PDF lessons reference `MediaAssetReference` (`assetId`, `url`, `mimeType`, `fileName`, `sizeBytes?`, `disposition?`). Per `INV-DOM21-07` (`OWNER APPROVED`, `2026-11-13`), media assets associated with a `PublishedCourseVersion` are binary- and identity-immutable (historical published versions retain their original asset). Per `INV-DOM21-10` (`OWNER APPROVED`, `2026-11-13`), authorized course administrators may replace media referenced by a Draft Course Version before publication via the authorized draft editing workflow, strictly following `INV-DOM21-09` (`OWNER APPROVED`, `2026-11-13`: **every** binary replacement across all lifecycle states, including draft-exclusive assets, must create a new media asset with a new stable `assetId` and never overwrite binaries in place or reuse `assetId`s; published versions, sealed group cycles, unrelated references, and the old binary remain untouched, and the old asset is not deleted). Per `INV-DOM21-11` (`OWNER APPROVED`, `2026-11-13`), draft media replacement is permitted **only** if the user is authorized to edit **that specific target Draft Course Version** (inherited from `domain-05` Draft Course Version editing scope under `D-SEC-01`, `INV-R6`, and `INV-R9`; general upload permission alone never authorizes draft replacement or repointing). Per `INV-DOM21-12` (`OWNER APPROVED`, `2026-11-13`), replacement uses the **Two-Step Upload & Reference Repoint workflow**: Step 1 uploads via Django `multipart/form-data` and creates the new `assetId` without modifying any draft reference; Step 2 separately repoints only that Draft Course Version reference after independently revalidating authorization, target lifecycle state, eligibility, and `assetId` validity (replacement completes only after Step 2 succeeds; not one atomic transaction—Scenarios A–D apply, leaving the old reference intact and not auto-deleting the new asset if Step 2 fails). Per `INV-DOM21-13` (`OWNER APPROVED`, `2026-11-13`), `title` and `isVisible` belong to the specific course/lesson usage reference (independent across shared assets; targeted by `API-REC-07` `PATCH` on the reference), while `fileName`, `mimeType`, and `sizeBytes` remain Asset-level technical metadata. Per `INV-DOM21-14` (`OWNER APPROVED`, `2026-11-13`), reference-level `title` and `isVisible` mutability follows the target reference's lifecycle state (**mutable** in Draft Course Versions & Active/Unsealed Group Renewal Cycles with authorization; **historically immutable** in Published Course Versions & Sealed/Closed Group Renewal Cycles where in-place `PATCH` is prohibited; does not extend to Asset-level technical metadata). Per `INV-DOM21-15` (`OWNER APPROVED`, `2026-11-13`), immediate `isVisible: true -> false` enforcement applies specifically to Active / Unsealed `GroupRenewalCycle` references and never hides or alters course/lesson references sharing the same Media Asset. Per `INV-DOM21-16` (`OWNER APPROVED`, `2026-11-13`), Asset-level technical metadata (`fileName`, `mimeType`, `sizeBytes`) becomes **immutable immediately after asset creation** across all lifecycle states and reference counts, established from the uploaded binary and its server-side validated properties (client-declared MIME/size never authoritative without server-side validation; binary replacement creates a new `assetId` with its own technical metadata per `INV-DOM21-09` and `INV-DOM21-12`; narrowly reconciles `API-REC-07` only regarding post-creation mutation of those three fields, with exact revised `PUT` semantics unresolved). Exact revised `API-REC-07` `PUT` semantics, endpoint paths, HTTP methods, DTOs, multipart field names, resource-targeting semantics, status/error codes, asset lifecycle status values, idempotency/retry protocol, transaction boundaries, exact unestablished role-to-permission mappings, historical snapshot implementation details & metadata copying across versions/cycles, `isVisible` propagation timing to enrolled learners, active-cycle audit history, and deletion/retention remain unresolved (`PROPOSED`).
   - Application server handles metadata, authorization, and (in **Phase 1**, `OWNER APPROVED`, `2026-11-13`) Django-mediated session-authenticated streaming via the Storage Abstraction (with `Range`/`206`/`416` requirements and known concurrent-playback worker/bandwidth risk); future direct-client streaming via `CL-03` short-lived signed URLs (`ADR-004`) is deferred to a future phase.
3. **Rich-Text Sanitization (`D-SEC-01`):**
   - Rich HTML lesson content passes through the DOMPurify allowlist (`p`, `br`, `b`, `i`, `em`, `strong`, `ul`, `ol`, `li`, `code`, `pre`, `table`, etc.) stripping `<script>`, `<iframe>`, `on*` attributes, and `javascript:` URIs.

---

## 3. Validation, Authorization & Failure Scenarios

- **Failure Scenarios:** Unsupported MIME type or oversized upload descriptor rejected with `400`/`422`; unsafe URL schemes (`javascript:`, `data:`, `file:`) rejected on link/media validation.
- **Integration Boundaries & Constraints (`CL-02`, `CL-03`, Google Drive):**
  - **`CL-02` (`OWNER APPROVED`, `2026-11-13`):** Authorized platform and media delivery must support both Cairo Metro's internal network and external internet (home/mobile) access securely over HTTPS with Django auth/RBAC, without exposing Windows shares/SMB/physical paths or approving a CDN/public MetroLMS binary URLs.
  - **Google Drive Video Sources (`OWNER APPROVED FOR GOOGLE DRIVE VIDEO SOURCES`, `2026-11-13`):** Uses `Anyone with the link` viewer sharing; MetroLMS stores the external provider reference/file ID (never copying the binary) and renders the iframe embed (`videoEmbedPolicy.ts`), while backend controls lesson visibility to authorized learners. Does not require Google Drive OAuth, signed/temporary URLs, or server-side proxying; anyone with the link can view outside MetroLMS until Google Drive permissions are changed. Applies only to Google Drive-hosted resources, never to MetroLMS-owned media.
  - **Phase 1 Delivery vs. Future `CL-03` Signed URLs (`OWNER APPROVED`, `2026-11-13`):** Phase 1 uses Django-mediated, session-authenticated media delivery via the Storage Abstraction (supporting HTTP `Range`, `206`, `416`, and native seeking, with no separate Media Delivery Service in Phase 1 and known concurrent-playback worker/bandwidth risk requiring workload validation). `CL-03` (short-lived signed URLs for direct browser-to-media delivery) remains historically `OWNER APPROVED` (`2026-11-13`) as a **future** media authorization direction whose implementation is **deferred**. Exact TTL, signing algorithm/keys, delivery server, physical storage provider, malware scanning, and production size limits remain **`DEFERRED`** under `API-REC-06`. No CDN or DRM is assumed.
  - Learning Player playback, sequential lesson gates, and quiz grading belong to Phase 3 (Domains 13–14).

---

## 4. Traceability

- Business Rules: [`domain-06-course-content-and-lessons.md`](../../../01-requirements/domains/domain-06-course-content-and-lessons.md)
- Media ADR: [`ADR-004-decoupled-media-storage.md`](../../../02-architecture-and-design/adr/ADR-004-decoupled-media-storage.md)
- Security Baseline: [`security-and-xss-baseline.md`](../../../architecture/security-and-xss-baseline.md) (§2–§3)

