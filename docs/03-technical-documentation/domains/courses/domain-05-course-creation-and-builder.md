# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 05 — Course Creation & Builder

> **Document Title:** Technical Domain Specification — Course Creation & Builder  
> **Document Identifier:** `METROLMS-TECH-DOM-005`  
> **Document Status:** `APPROVED — PHASE 2A BASELINE`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`Rule B`](../../../requirements/domain-business-rules.md), [`D-03`](../../../architecture/decision-register.md), [`D-11`](../../../architecture/decision-register.md), [`D-SEC-01`](../../../architecture/decision-register.md#d-sec-01), `API-REC-02` (`OWNER APPROVED — 2026-11-13`)  
> **Last Updated:** 2026-11-13 (Owner Decision Recording: `API-REC-02` & `API-REC-02a`–`02c` Final Approval)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend Components:**
  - `CourseBuilderPage.tsx` & `CourseReviewPage.tsx`: Curriculum authoring, chapter/item ordering, and staged admin edit review.
  - `courseBuilderDraftStorage.ts` & `stagedEditsStorage.ts` (`useStagedEditsAutosave.ts`): Local draft and staged edit persistence scoped strictly by `(userId, sessionEpoch)` (`S7`).
- **Target Backend Components (Django 5 + DRF):**
  - Course drafting service (`createCourse`, `saveCourseDraft`, `submitCourseForReview`, `saveStagedAdminEdits`).
  - Publication review service (`executeReviewDecision`, `approveApprovalRequest`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Draft Persistence & Anti-Spoofing:**
   - `saveCourseDraft` persists curriculum drafts without touching `PublishedCourseVersion` or active `CourseAttempt` records.
   - Server/store strips client-supplied `publishedBy`, `publishedAt`, `versionNumber`, `currentVersionNumber`, and item `contentVersion`/`contentFingerprint`.
2. **Epoch-Scoped Local Autosave (`S7`):**
   - Keys include `userId` and `sessionEpoch`; switching accounts or logging out invalidates prior drafts so stale edits never bleed across sessions.
3. **Approval & Publication Handshake:**
   - `submitCourseForReview` transitions `Draft -> PendingReview`.
   - `admin` approval (`executeReviewDecision` or `approveApprovalRequest`) delegates atomically to Domain 07 (`LLD-002`) to compute `Rule B` diffs and commit `PublishedCourseVersion`.

---

## 3. Validation, Authorization & Failure Scenarios

- **Authorization:** `lecturer` requires `courses.create` / ownership; `reviews.decide_course` is sovereign to `admin`; `assistant_admin` `courses.publish` / `course_unpublish` defaults to `202 PendingApproval` (`INV-R9`).
- **Failure Scenarios:** Stale autosave flush after session switch is rejected by `StaleEpochError` and storage epoch mismatch.
- **Integration Boundaries & Constraints:**
  - **`API-REC-02` (`OWNER APPROVED — 2026-11-13`):** Target Django backend adopts `/api/admin/courses/:courseId/*` as the canonical Course Review route family, excluding the 16 equivalent legacy/alternative aliases and 1 unused handler while preserving approved canonical route behavior and authorization semantics (`INV-R9`). Does NOT authorize deleting or modifying prototype source code or MSW handlers.
  - **Subordinate Assistant API Decisions (`OWNER APPROVED — RETAIN`, `2026-11-13`):** `API-REC-02a` (`GET /api/groups/:groupId/assistants`), `API-REC-02b` (`POST /api/groups/:groupId/assistants` — individual addition, not bulk replacement), and `API-REC-02c` (`DELETE /api/groups/:groupId/assistants/:lecturerId` — group-specific assignment removal only) are all retained in the target backend API contract (see [`METROLMS-TECH-DOM-008`](../groups/domain-08-training-groups-management.md)).
  - Master OpenAPI payloads for course builder endpoints are deferred to Phase 5.

---

## 4. Traceability

- Business Rules: [`domain-05-course-creation-and-builder.md`](../../../01-requirements/domains/domain-05-course-creation-and-builder.md)
- Low-Level Design: [`LLD-002-course-versioning-diff-engine.md`](../../../02-architecture-and-design/lld/LLD-002-course-versioning-diff-engine.md)

