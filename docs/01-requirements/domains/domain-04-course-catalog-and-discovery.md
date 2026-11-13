# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 04 — Course Catalog & Discovery

> **Document Title:** Domain 04 — Course Catalog & Discovery Business Rules  
> **Document Identifier:** `METROLMS-DOM-CAT-004`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-11`](../../architecture/decision-register.md), [`D-14`](../../architecture/decision-register.md)  
> **Last Updated:** 2026-11-12 (Phase 2A Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern how courses are organized, filtered, searched, and discovered in the MetroLMS catalog while enforcing publication-state visibility (`Published` vs. `Draft` / `Archived`), role-based visibility boundaries, and safe XSS-free metadata rendering.
- **Domain Boundaries:**
  - *In Scope:* Catalog listing, category/track filtering, search queries, course visibility by lifecycle status (`Draft`, `PendingReview`, `Published`, `Archived`), instructor attribution rules (`D-11`, `D-14`), and catalog card metadata presentation.
  - *Out of Scope:* Course authoring/drafting (Domain 05), internal chapter/lesson structure (Domain 06), version diffing (`Rule B`, Domain 07), group-assigned course visibility (`D-GRP-07`, Phase 2B), and enrollment/post-deadline access (`hide` vs. `keep_no_cert`, Phase 3).
- **Actors & Responsibilities:**
  - *Trainee (`user`):* Discovers only `Published` courses eligible for catalog browsing; cannot view `Draft` or `Archived` courses.
  - *Lecturer (`lecturer`):* Views `Published` courses plus own authored `Draft`/`PendingReview` courses.
  - *Admin / Assistant Admin / Superior:* Views full catalog across lifecycle states (`Rule A` read visibility for `assistant_admin` and `superior`).
- **Core Entities:** `CourseCatalogEntry`, `CourseCategory` / `Track`, `InstructorAttribution`.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM04-01`** | **Trainee Published-Only Visibility** | Trainees (`user`) may only query and discover courses where `course.status === 'Published'`. `Draft`, `PendingReview`, and `Archived` courses are excluded from trainee catalog endpoints. | Catalog Query Selector & API |
| **`INV-DOM04-02`** | **Nullable Primary Instructor Display (`D-11`)** | When `Course.lecturerId === null`, catalog views must render the Arabic label `غير معين`, never a magic string such as `'unassigned'`. | Catalog Serializer & UI |
| **`INV-DOM04-03`** | **Developer Attribution Masking (`INV-R8`, `D-14`)** | If a `Developer` created or edited a catalog course, non-Developer viewers see neutral system/admin attribution (`actorId: 'SYSTEM'`, `actorName: 'النظام'`), never the Developer's identity. | Catalog Serializer |
| **`INV-DOM04-04`** | **Safe Catalog Metadata Rendering (`D-SEC-01`)** | Course titles and plain descriptions render via React JSX escaping; rich descriptions (if enabled) pass through the centralized DOMPurify allowlist. | Catalog UI Components |

---

## 3. State Transition Rules

- **Visibility State Mapping:**
  - `Draft` / `PendingReview`: Visible only to course author (`lecturerId` / `coLecturers`), `admin`, `assistant_admin` (`Rule A`), `superior` (read-only), and `developer`.
  - `Published`: Visible in active trainee catalog (`GET /api/courses`).
  - `Archived`: Excluded from active trainee catalog; retained for historical records and administrative audit.
- **Forbidden Transitions:**
  - Exposing `Draft` or `Archived` courses in unprivileged trainee catalog search results.

---

## 4. Dependencies, Unresolved Questions & Traceability

- **Cross-Domain Dependencies:**
  - *Domain 02 & 03:* Provides instructor identity (`D-11`), `Developer` masking (`INV-R8`/`D-14`), and role visibility rules.
  - *Domain 05 & 07:* Controls transitions into `Published` and `Archived` states.
- **Confirmed Decisions vs. Unresolved Owner Questions:**
  - *Confirmed:* `D-11`, `D-14`, `D-SEC-01`, `INV-R8`, `Rule A`.
  - *Unresolved:* Whether external/unauthenticated catalog browsing is ever required (currently authenticated roles only per `SRS-001`).
- **Traceability:** [`BRD-001`](../brd/BRD-001-cairo-metro-lms-platform.md), [`SRS-001`](../srs/SRS-001-core-system-requirements.md) (`REQ-CRS-01`), [`domain-business-rules.md`](../../requirements/domain-business-rules.md) (§4.1), [`security-and-xss-baseline.md`](../../architecture/security-and-xss-baseline.md) (§2, §7).

