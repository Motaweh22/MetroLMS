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
   - Video and PDF lessons reference `MediaAssetReference` (`assetId`, `url`, `mimeType`, `fileName`, `sizeBytes?`, `disposition?`).
   - Application server handles metadata and access validation only; raw video bytes never traverse Django WSGI (`ADR-004`).
3. **Rich-Text Sanitization (`D-SEC-01`):**
   - Rich HTML lesson content passes through the DOMPurify allowlist (`p`, `br`, `b`, `i`, `em`, `strong`, `ul`, `ol`, `li`, `code`, `pre`, `table`, etc.) stripping `<script>`, `<iframe>`, `on*` attributes, and `javascript:` URIs.

---

## 3. Validation, Authorization & Failure Scenarios

- **Failure Scenarios:** Unsupported MIME type or oversized upload descriptor rejected with `400`/`422`; unsafe URL schemes (`javascript:`, `data:`, `file:`) rejected on link/media validation.
- **Integration Boundaries & Constraints (`CL-02`, `CL-03`):**
  - Physical media storage vendor, media server network exposure (intranet vs. external), and HTTP authorization mechanism (e.g., pre-signed URLs vs. proxy subrequest) remain deferred/unresolved per `D-MEDIA-01`, `CL-02`, and `CL-03`. No CDN or DRM is assumed.
  - Learning Player playback, sequential lesson gates, and quiz grading belong to Phase 3 (Domains 13–14).

---

## 4. Traceability

- Business Rules: [`domain-06-course-content-and-lessons.md`](../../../01-requirements/domains/domain-06-course-content-and-lessons.md)
- Media ADR: [`ADR-004-decoupled-media-storage.md`](../../../02-architecture-and-design/adr/ADR-004-decoupled-media-storage.md)
- Security Baseline: [`security-and-xss-baseline.md`](../../../architecture/security-and-xss-baseline.md) (§2–§3)

