# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 07 — Published Versions & Diffs (`Rule B`)

> **Document Title:** Domain 07 — Published Course Versions & Substantive Diffing (`Rule B`) Business Rules  
> **Document Identifier:** `METROLMS-DOM-VER-007`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`Rule B`](../../requirements/domain-business-rules.md), [`D-06`](../../architecture/decision-register.md), [`D-12`](../../architecture/decision-register.md), [`D-13`](../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Enforce `Rule B` course versioning so that every approved publication produces an immutable `PublishedCourseVersion` snapshot, differentiates substantive curriculum changes from metadata-only edits, selectively invalidates only substantively changed items on active unsealed attempts, and preserves sealed historical attempts and earned certificates.
- **Domain Boundaries:**
  - *In Scope:* `PublishedCourseVersion` immutable snapshot ledger, `versionNumber` progression (`v1 -> v2 -> ...`), deterministic 6-field substantive fingerprinting, `item.contentVersion` increments, selective reset of active unsealed attempts, and preservation of sealed historical attempts.
  - *Out of Scope:* Progress percentage rounding formula (`D-12`, Phase 3 Domain 13) and certificate PDF/QR generation (`D-13`, Phase 3 Domain 15).
- **Actors & Responsibilities:**
  - *System Administrator (`admin`):* Triggers publication via `executeReviewDecision` (`approved`) or `approveApprovalRequest` (`courses.publish`).
  - *Versioning Engine:* Computes item fingerprints, creates immutable `PublishedCourseVersion`, and reconciles active unsealed attempts.
- **Core Entities:** `PublishedCourseVersion`, `PublishedCourseVersionItem`, `SubstantiveFingerprint`, `CourseAttempt` (sealed vs. unsealed).

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM07-01`** | **Immutable Snapshot Ledger (`Rule B`)** | Approved publication creates a new `PublishedCourseVersion` (`versionNumber = N + 1`); prior snapshots `1..N` are strictly immutable. | Publication Service & `LLD-002` |
| **`INV-DOM07-02`** | **Deterministic 6-Field Fingerprint** | `computeItemSubstantiveFingerprint` hashes only `{ type, videoUrl, pdfUrl, mediaId, content, durationSeconds }` in canonical order; `undefined`/`null`/`""` normalize to `null` (`type` defaults to `'video'`). | `LLD-002` Diff Engine |
| **`INV-DOM07-03`** | **Metadata-Only Edit Preservation (`Rule B`)** | Changes restricted to `{ title, description, order, duration }` preserve `item.contentVersion`, `item.contentFingerprint`, and all existing trainee lesson completions. | `LLD-002` Diff Engine |
| **`INV-DOM07-04`** | **Substantive Edit Selective Reset (`Rule B`)** | When an item's substantive fingerprint changes, `item.contentVersion` increments (`N -> N + 1`), and completion is reset **only** for that item in **active, unsealed** attempts (`isSealed !== true`); unchanged items remain completed. | Attempt Reconciliation Service |
| **`INV-DOM07-05`** | **Sealed Attempt & Certificate Immunity (`D-06`, `D-13`)** | Sealed historical attempts (`isSealed === true`, completed renewal cycles, revoked-only grants) and prior-version certificates are never modified by new course publications. | Attempt Reconciliation Service |
| **`INV-DOM07-06`** | **Version-Matched Completion Validity** | In active unsealed attempts, a `LessonProgress` record satisfies completion only when `LessonProgress.contentVersion === ChapterItem.contentVersion`. | `isLessonCompletedForCurrentItemVersion` |
| **`INV-DOM07-07`** | **Idempotent Publication Guard** | Re-approving an already-published course with no pending review/draft changes must not create duplicate `PublishedCourseVersion` records. | `executeReviewDecision` & `approveApprovalRequest` |

---

## 3. State Transition Rules

- **Version Progression:**
  - Newly created `Draft` course: `0` published versions.
  - First approved publication: creates `PublishedCourseVersion` `versionNumber = 1`, all items at `contentVersion = 1`.
  - Subsequent approved publication: creates `versionNumber = N + 1`; items with changed fingerprints increment `contentVersion`, unchanged items retain `contentVersion`.
- **Forbidden Transitions:**
  - Mutating any historical `PublishedCourseVersion` record.
  - Resetting completions on `isSealed === true` attempts.

---

## 4. Dependencies, Unresolved Questions & Traceability

- **Cross-Domain Dependencies:**
  - *Domain 05 & 06:* Supplies draft curriculum items and publication triggers.
  - *Phase 3 (Domains 12–15):* Consumes `contentVersion` and `PublishedCourseVersion` for progress rounding (`D-12`) and versioned certificates (`D-13`).
- **Confirmed Decisions vs. Unresolved Owner Questions:**
  - *Confirmed:* `Rule B`, `MFR-10`, `D-06`, `D-13`.
  - *Unresolved:* None.
- **Traceability:** [`SRS-001`](../srs/SRS-001-core-system-requirements.md) (`REQ-CRS-02`, `REQ-CRS-03`), [`domain-business-rules.md`](../../requirements/domain-business-rules.md) (§4.2), [`LLD-002`](../../02-architecture-and-design/lld/LLD-002-course-versioning-diff-engine.md), [`t-2-3-1-published-course-versions-and-diffing-report.md`](../../frontend/reports/t-2-3-1-published-course-versions-and-diffing-report.md).

