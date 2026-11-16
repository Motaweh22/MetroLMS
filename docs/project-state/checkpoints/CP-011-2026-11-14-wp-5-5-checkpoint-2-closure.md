# MetroLMS — Checkpoint CP-011: REV6 Phase 5 — WP-5.5 Checkpoint 2 Closure (Stage 2 / Cluster 2: Courses & Learning)

1. **Checkpoint ID:** `CP-011`
2. **Date / Timestamp:** `2026-11-14T14:20:00+02:00`
3. **Previous Checkpoint Reference:** [`CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md`](CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md) (`CP-010` — WP-5.5 Checkpoint 1 Closure: Cluster 1 Identity & Organization)
4. **Phase / Work Package / Increment Completed:** `REV6 Phase 5 — WP-5.5 Stage 2 (Cluster 2: Courses & Learning) — Checkpoint 2`
5. **Status:** `COMPLETED AND ACCEPTED` *(Immutable — Cluster 2 Checkpoint 2 formally closed; Stage 3 / Cluster 3 authorized; Data Dictionary remains unfrozen overall)*
6. **Summary of What Was Completed:**
   - Completed Stage 2 logical field mappings for all 17 Cluster 2 (`Courses & Learning`) entities and associations in [`data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md) targeting Django + DRF + Microsoft SQL Server (`D-DB-01`).
   - Integrated and verified `TR-C2-01` through `TR-C2-07` and the 6 Owner-approved `NVARCHAR` logical lengths.
   - Formally closed WP-5.5 Checkpoint 2 and authorized transition to WP-5.5 Stage 3 (`Cluster 3: Groups & Training Operations`).
7. **Files Created, Updated, Moved, or Archived:**
   - **Created:** `docs/project-state/checkpoints/CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md` (this immutable checkpoint).
   - **Updated:** `docs/02-architecture-and-design/data-models/data-dictionary.md` (Cluster 2 baseline finalized; remains **unfrozen** overall for Stage 3 / Cluster 3).
   - **Updated:** `docs/project-state/CURRENT.md` and `docs/project-state/checkpoints/README.md`.
8. **Confirmed Owner & Technical Decisions Applied (`TR-C2-01`–`TR-C2-07` & 6 `NVARCHAR` Lengths):**
   - **`TR-C2-01` (`TECHNICAL-RECOMMENDATION — ACCEPTED`):** Every Reminder Course references exactly one Main Course (`ON DELETE NO ACTION`, `CHECK (main_course_id <> id)`, no new entity); cross-row terminal-child and cycle validation enforced through a transactional backend domain service.
   - **`TR-C2-02` (`OWNER-APPROVED`):** `assistant_admin` role alone grants NO implicit `courses.edit_curriculum`, `CourseDraft` edit, `PublishedCourseVersion` edit, or publish/unpublish; distinct from `CourseAssistantLecturer`; no new permission table/entity.
   - **`TR-C2-03` (`TECHNICAL-RECOMMENDATION — ACCEPTED`):** `Module` dual nullable FKs (`course_draft_id`, `published_version_id`, `ON DELETE NO ACTION`) + independent XOR `CHECK` (neither both NULL nor both populated).
   - **`TR-C2-04` (`OWNER-APPROVED`):** `CourseReviewSubmission` Submitter (`submitted_by_user_id`/`submitted_by_tombstone_id`, 1 required) & Reviewer (`reviewed_by_user_id`/`reviewed_by_tombstone_id`, optional pre-review, 1 once assigned), `D-01` Tombstone transfer, and `D-OWNER-REV-31` indefinite retention.
   - **`TR-C2-05` (`OWNER-APPROVED`):** `CourseComment` anonymization on `D-01` (`author_user_id = NULL`, `is_author_deleted = 1`, `'مستخدم محذوف'`, no Tombstone FK, text/timestamp preserved, deletion logged in `AuditLog`).
   - **`TR-C2-06` (`OWNER-APPROVED`):** `MediaContentReference` Detach (`detached_at` set), Restore (`detached_at` cleared on same row), and Move (reassign target FK preserving `MediaAsset`), all logged in `AuditLog` using existing ownership fields.
   - **`TR-C2-07` (`OWNER-APPROVED`):** `MediaAsset` **No Automatic Purge** on zero references (retained indefinitely; no expiration/retention field; physical deletion only via explicit authorized zero-ref cleanup logged in `AuditLog`).
   - **Six `OWNER-APPROVED` `NVARCHAR` Logical Lengths:** `Course.title` (`255`), `Module.title` (`255`), `LessonItem.title` (`255`), `LessonItem.external_video_url` (`2048`), `CourseCommentReport.reason` (`500`), `MediaContentReference.title` (`255`).
9. **Architecture / Contract Changes:**
   - Logical field mappings, Course Audience `OR` associations, Reminder terminal-child service rule, `Rule B` draft/published isolation, `D-02` anonymization, and `domain-21` media asset/reference lifecycles established in [`data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md) without generating SQL DDL, Django models, or migrations (`WP-5.6` remains unauthorized).
10. **Requirements or Business Rules Clarified:**
    - Resolved all 7 Cluster 2 Technical-Resolution Log items (`TR-C2-01`–`TR-C2-07`) and 6 `NVARCHAR` lengths; preserved all Cluster 1 `CP1 #1`–`#11` and `INV-R4` decisions unchanged.
11. **Tests Executed and Exact Results:**
    - **Documentation Verification Assertions (UTF-8 PowerShell):** `13/13 PASS` (`exit code 0`) verifying `TR-C2-01`–`07`, `assistant_admin` permission boundary, `Module` XOR, `CourseReviewSubmission` attribution, `CourseComment` anonymization, `MediaContentReference` Detach/Restore/Move, `MediaAsset` No Automatic Purge, 6 `NVARCHAR` lengths, Cluster 1 `CP1 #1`–`#11` preservation, no silent promotion, unfrozen `data-dictionary.md`, and `CURRENT.md` accuracy.
    - **Runtime / Vitest / Django Tests:** `NOT EXECUTED` (documentation-only milestone).
12. **Known Issues / Remaining Risks (Remaining `PROPOSED` & `TECHNICAL-RECOMMENDATION` Items — Not Owner-Approved):**
    - Non-promoted `PROPOSED` / `TECHNICAL-RECOMMENDATION` items in Cluster 2 (e.g., `Course.description`, `Course.lifecycle_status`, `Module.sort_order`, `LessonItem.lesson_type`/`sort_order`, `QuizDefinition.questions_json`/`passing_score`, `CourseReviewSubmission.review_status`, `CourseComment.body`, `CourseCommentReport` non-`reason` columns, and physical `BIGINT`/`DATETIME2` types) remain explicitly classified and are **not** Owner-approved.
    - Deferred cross-cluster dependency: `MediaContentReference.group_renewal_cycle_id` deferred to Stage 3 / Cluster 3 for analysis.
13. **Explicitly Deferred Items:**
    - `WP-5.5` Stage 3 (`Cluster 3: Groups & Training Operations`) — **now authorized to begin immediately following this closure**.
    - `WP-5.6` (Physical SQL DDL, Django `models.py`, migrations) — **unauthorized / not started**.
    - `Domain 16` physical attendance, `OD-API-01`–`OD-API-04`, `API-REC-06` — **deferred**.
14. **Out-of-Scope Items Confirmed:**
    - Zero Django models, migrations, SQL DDL, UML diagrams, runtime code, MSW handlers, or test files modified.
15. **Completed Phases / Work Packages / Increments:**
    - `Phase A`, `Phase 1` (`WP-1.1`–`WP-1.3`), `Phase 2` (`WP-2.1`–`WP-2.4`), `REV6 Phase 5 WP-5.1`–`WP-5.4` (`CP-009` + Erratum), `REV6 Phase 5 WP-5.5 Stage 0 & Stage 1 (CP-010)`, `REV6 Phase 5 WP-5.5 Stage 2 (Cluster 2 Checkpoint 2)`.
16. **Remaining Phases / Work Packages / Tasks:**
    - `WP-5.5 Stage 3 (Cluster 3)` (`IN PROGRESS` upon this closure), `WP-5.6` (`BLOCKED`), `Phase 3` (`WP-3.1` `READY TO START`), `Phase 4`, `Phase 6`.
17. **Exact Next Task:** `REV6 Phase 5 — WP-5.5 Stage 3: Cluster 3 (Groups & Training Operations) Logical Field Mapping` (stopping at Checkpoint 3).
18. **Entry Criteria for Next Task:** Formal closure of `WP-5.5` Checkpoint 2 (`CP-011`) and explicit Owner authorization for Stage 3 / Cluster 3 (both satisfied).
19. **Exit Criteria for Next Task:** Complete Cluster 3 entity inventory, draft logical field mappings, relationship/lifecycle register, `MediaContentReference.group_renewal_cycle_id` analysis, and Technical-Resolution Log populated in `data-dictionary.md`, stopping at `WP-5.5 — STAGE 3 / CLUSTER 3: COMPLETED — CHECKPOINT 3 UNDER OWNER REVIEW`.
20. **Authoritative Documents to Read Before Starting Next Task:**
    - [`docs/02-architecture-and-design/data-models/logical-data-model.md`](../../02-architecture-and-design/data-models/logical-data-model.md)
    - [`docs/02-architecture-and-design/data-models/data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md)
    - [`docs/project-state/CURRENT.md`](../CURRENT.md)

