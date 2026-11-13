# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 06 — Course Content & Lessons

> **Document Title:** Domain 06 — Course Content Structure, Lessons & Media References Business Rules  
> **Document Identifier:** `METROLMS-DOM-CNT-006`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`Rule B`](../../requirements/domain-business-rules.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Define the hierarchical structure of MetroLMS course content (Chapters/Modules and Lesson Items), lesson item types, decoupled media reference contracts (`D-MEDIA-01`), XSS-safe rich text rules (`D-SEC-01`), and the distinction between substantive content fields and metadata-only fields.
- **Domain Boundaries:**
  - *In Scope:* `Chapter` and `ChapterItem` hierarchy, supported item types (`video`, `pdf`, `quiz`, `text`, `assignment`), `MediaAssetReference` consumption (`D-MEDIA-01`), substantive vs. metadata field classification (`Rule B`), and DOMPurify sanitization boundaries (`D-SEC-01`).
  - *Out of Scope:* Video player progress tracking, sequential lesson locking, and quiz attempt grading (Phase 3 Domains 12–14), physical media storage/streaming server selection (`D-MEDIA-01` deferred to Phase 4/7/12), and CDN/DRM (none planned per `CL-02`/`CL-03`).
- **Actors & Responsibilities:**
  - *Course Author (`lecturer` / `admin`):* Organizes chapters, orders lesson items, uploads media via decoupled `MediaAssetReference`, and authors text/quiz items.
  - *Trainee (`user`):* Consumes published lesson items according to enrollment and sequential gates (Phase 3).
- **Core Entities:** `Chapter` (`Module`), `ChapterItem` (`LessonItem`), `MediaAssetReference`, `QuizDefinition`.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM06-01`** | **Decoupled Media Descriptor (`D-MEDIA-01`)** | Lesson media references must use `MediaAssetReference` (`assetId`, `url`, `mimeType`, `fileName`, `sizeBytes?`, `disposition?`). Components never hardcode storage paths, UNC shares, or vendor SDKs. | Media Service & `ChapterItem` |
| **`INV-DOM06-02`** | **Substantive vs. Metadata Field Split (`Rule B`)** | Substantive fields are strictly `{ type, videoUrl, pdfUrl, mediaId, content, durationSeconds }`. Metadata-only fields are `{ title, description, order, duration }`. | `computeItemSubstantiveFingerprint` |
| **`INV-DOM06-03`** | **Rich-Text XSS Sanitization (`D-SEC-01`)** | All rich HTML lesson notes must pass through the centralized DOMPurify allowlist (`sanitizeHtml.ts`); `<script>`, `<iframe>`, `on*` handlers, and `javascript:` URIs are stripped. | Frontend Sanitizer & Django Backend |
| **`INV-DOM06-04`** | **Active Attempt Deletion Guard (`REQ-CRS-04`)** | Published lessons associated with active trainee attempts cannot be silently deleted in-place without going through `Rule B` draft/review versioning. | Course Service |

---

## 3. State Transition Rules

- **Lesson Item Lifecycle:**
  - Authored/reordered in `Draft` $\rightarrow$ Snapshotted with `contentVersion` and `contentFingerprint` upon approved publication $\rightarrow$ Immutable inside historical `PublishedCourseVersion` snapshots.
- **Forbidden Transitions:**
  - Mutating `contentVersion` or `contentFingerprint` of a published item directly from client draft payloads.

---

## 4. Dependencies, Unresolved Questions & Traceability

- **Cross-Domain Dependencies:**
  - *Domain 05:* Manages draft editing of chapters and items.
  - *Domain 07:* Hashes substantive lesson fields to detect `Rule B` changes.
- **Confirmed Decisions vs. Unresolved Owner Questions:**
  - *Confirmed:* `D-MEDIA-01` (decoupled contract), `D-SEC-01` (DOMPurify allowlist), `Rule B` field split.
  - *Unresolved / Deferred (`CL-02`, `CL-03`):* Final media server network exposure model (intranet vs. external trainee access) and media authorization mechanism (pre-signed URLs vs. proxy subrequest) remain unresolved/deferred to Phase 4 (Domain 21) / Phase 7 / Backend Phase 12. No CDN is planned.
- **Traceability:** [`SRS-001`](../srs/SRS-001-core-system-requirements.md) (`REQ-CRS-01`, `REQ-CRS-04`), [`django-sqlserver-integration-contract.md`](../../backend/django-sqlserver-integration-contract.md) (§3), [`security-and-xss-baseline.md`](../../architecture/security-and-xss-baseline.md) (§2–§3).

