# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 05 — Course Creation & Builder

> **Document Title:** Domain 05 — Course Creation, Drafting & Builder Business Rules  
> **Document Identifier:** `METROLMS-DOM-BLD-005`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-03`](../../architecture/decision-register.md), [`D-11`](../../architecture/decision-register.md), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`Rule B`](../../requirements/domain-business-rules.md), `API-REC-02` (`OWNER APPROVED — 2026-11-13`)  
> **Last Updated:** 2026-11-13 (Owner Decision Recording: `API-REC-02` & `API-REC-02a`–`02c` Final Approval)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern the course authoring lifecycle from initial creation and user/epoch-scoped draft autosave through review submission, staged administrative edits, and approval/publication gating, while protecting active published courses from unreviewed draft mutations.
- **Domain Boundaries:**
  - *In Scope:* Course creation (`Draft`), curriculum builder operations, user/epoch-scoped draft autosave (`courseBuilderDraftStorage.ts`), staged admin edits (`stagedEditsStorage.ts`), review submission (`PendingReview`), draft metadata anti-spoofing, and publication approval triggers (`executeReviewDecision` / `approveApprovalRequest`).
  - *Out of Scope:* Granular lesson item schemas and media playback (Domain 06), version snapshot ledger and substantive diffing (Domain 07 / `LLD-002`), and physical media storage infrastructure (`D-MEDIA-01` deferred to Phase 12).
- **Actors & Responsibilities:**
  - *Lecturer (`lecturer` with `courses.create` / authoring override):* Creates and edits own course drafts; submits drafts for administrative review (`reviews.submit_course`).
  - *System Administrator (`admin`):* Creates, edits, approves/rejects course reviews (`reviews.decide_course`), and publishes or archives courses.
  - *Assistant Administrator (`assistant_admin`):* Can author/edit within ceiling, but `courses.publish` / `course_unpublish` are gated by `INV-R9` approval workflow unless delegated.
- **Core Entities:** `Course`, `CourseDraft`, `StagedAdminEdit`, `CourseReviewSubmission`.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM05-01`** | **Draft & Review Isolation (`Rule B`)** | Saving a draft (`saveCourseDraft`), submitting for review (`submitCourseForReview`), or saving staged admin edits (`saveStagedAdminEdits`) must **never** create a `PublishedCourseVersion` or mutate active learner progress. | Course Builder Service |
| **`INV-DOM05-02`** | **Draft Publication Metadata Anti-Spoofing** | Client-supplied publication metadata (`publishedBy`, `publishedAt`, `versionNumber`, `currentVersionNumber`, item `contentVersion`, `contentFingerprint`) is stripped on `saveCourseDraft`. | Course Builder Service |
| **`INV-DOM05-03`** | **User & Epoch-Scoped Draft Storage (`S7`)** | Local builder drafts and staged edits must be keyed by `(userId, sessionEpoch)` and purged deterministically on logout or session switch. | `courseBuilderDraftStorage.ts` & `stagedEditsStorage.ts` |
| **`INV-DOM05-04`** | **Sovereign Review Decision (`INV-R9`)** | Approving or rejecting a submitted course (`reviews.decide_course`) is restricted to `admin`; `assistant_admin` cannot unilaterally approve catalog publication. | RBAC & Review Service |
| **`INV-DOM05-05`** | **Nullable Primary Ownership (`D-11`)** | `Course.lecturerId` may be `null` (displayed as `غير معين`); deleting a lecturer never deletes their authored courses (`D-03`). | Course Ownership Service |

---

## 3. State Transition Rules

- **Allowed Transitions:**
  - `New` $\rightarrow$ `Draft` (create course)
  - `Draft` $\rightarrow$ `PendingReview` (submit for review)
  - `PendingReview` $\rightarrow$ `Published` (approved by `admin` via `executeReviewDecision` or `approveApprovalRequest`)
  - `PendingReview` $\rightarrow$ `Draft` (rejected / returned with feedback)
  - `Published` $\rightarrow$ `Archived` (admin archival; `assistant_admin` gated by `INV-R9`)
- **Forbidden Transitions:**
  - Direct `Draft` $\rightarrow$ `Published` by a `lecturer` bypassing review.
  - Modifying `PublishedCourseVersion` snapshots during draft editing.

---

## 4. Dependencies, Unresolved Questions & Traceability

- **Cross-Domain Dependencies:**
  - *Domain 01 & 03:* Provides `sessionEpoch` (`S7`) for draft isolation and `INV-R9` approval gating.
  - *Domain 06:* Provides chapter and lesson item structures authored in the builder.
  - *Domain 07:* Invoked upon approved publication to compute `Rule B` diffs and record `PublishedCourseVersion`.
- **Confirmed Decisions vs. Unresolved Questions (`2026-11-13`):**
  - *Confirmed (`API-REC-02` — `OWNER APPROVED`):* Adopt `/api/admin/courses/:courseId/*` as the canonical route family for applicable Course Review operations in the target Django backend; exclude the 16 equivalent legacy/alternative route aliases and 1 identified unused handler from the target backend API while preserving approved canonical route behavior and authorization semantics (`INV-R9`). This is a target backend API decision only and does NOT authorize modifying or deleting existing prototype source code or MSW handlers.
  - *Confirmed (`API-REC-02a`–`02c` — `OWNER APPROVED — RETAIN`, `2026-11-13`):*
    - `API-REC-02a` — `GET /api/groups/:groupId/assistants` (`OWNER APPROVED — RETAIN`, group assistant roster read).
    - `API-REC-02b` — `POST /api/groups/:groupId/assistants` (`OWNER APPROVED — RETAIN`, individual assistant addition, not bulk replacement).
    - `API-REC-02c` — `DELETE /api/groups/:groupId/assistants/:lecturerId` (`OWNER APPROVED — RETAIN`, group-specific assignment removal only; see [`METROLMS-DOM-GRP-008`](./domain-08-training-groups-management.md)).
  - *Confirmed:* `Rule B`, `D-03`, `D-11`, `D-SEC-01`, `INV-R9`.
  - *Unresolved:* None blocking Phase 2A or `API-REC-02` / `02a`–`02c`.
- **Traceability:** [`SRS-001`](../srs/SRS-001-core-system-requirements.md) (`REQ-CRS-01`..`04`), [`domain-business-rules.md`](../../requirements/domain-business-rules.md) (§4), [`t-2-3-1-published-course-versions-and-diffing-report.md`](../../frontend/reports/t-2-3-1-published-course-versions-and-diffing-report.md).

