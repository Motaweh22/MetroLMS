# MetroLMS — Checkpoint CP-012: REV6 Phase 5 — WP-5.5 Checkpoint 3 Closure (Stage 3 / Cluster 3: Groups & Training Operations)

1. **Checkpoint ID:** `CP-012`
2. **Date / Timestamp:** `2026-11-15T12:25:00+02:00`
3. **Previous Checkpoint Reference:** [`CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md`](CP-011-2026-11-14-wp-5-5-checkpoint-2-closure.md) (`CP-011` — WP-5.5 Checkpoint 2 Closure: Cluster 2 Courses & Learning)
4. **Phase / Work Package / Increment Completed:** `REV6 Phase 5 — WP-5.5 Stage 3 (Cluster 3: Groups & Training Operations) — Checkpoint 3`
5. **Status:** `COMPLETED AND ACCEPTED` *(Immutable — Cluster 3 Checkpoint 3 formally closed; Stage 4 Final Data Dictionary Review authorized; Data Dictionary remains UNFROZEN; WP-5.6 remains BLOCKED — NOT AUTHORIZED)*
6. **Summary of What Was Completed:**
   - Completed Stage 3 logical field mappings for all **18 active Cluster 3 (`Groups & Training Operations`) entities (98 mapped fields)** plus **1 explicitly `DEFERRED` entity (`InPersonAttendanceRecord`, `Domain 16`)** in [`data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md) targeting Python 3.12+ / Django 5+ / DRF / Microsoft SQL Server (`D-DB-01`).
   - Integrated all Owner-approved Cluster 3 decisions (`TR-C3-01` through `TR-C3-05`, role-aware `D-01` deletion/retention policy, `CertificateRecord` internal recipient attribution & PII-free public verification boundary, `GroupRenewalCycle` direct `Scheduled → Expired` overdue recovery, 4 `User`/`DeletedUserTombstone` attribution XOR pairs, and 5 Cluster 3 + 6 Cluster 2 `NVARCHAR` logical lengths).
   - Completed the `§10.2` `NVARCHAR` governance consistency correction clarifying that approved logical `NVARCHAR` field lengths are not pending decisions (physical DDL belongs to `WP-5.6`) and zero blocking business decisions remain for Cluster 3.
   - Formally closed WP-5.5 Checkpoint 3 and authorized commencement of WP-5.5 Stage 4 (`Final Data Dictionary Review`).
7. **Files Created, Updated, Moved, or Archived:**
   - **Created:** `docs/project-state/checkpoints/CP-012-2026-11-15-wp-5-5-checkpoint-3-closure.md` (this immutable checkpoint).
   - **Updated:** `docs/02-architecture-and-design/data-models/data-dictionary.md` (Cluster 3 baseline & `NVARCHAR` governance clarification finalized; remains **unfrozen** overall for Stage 4).
   - **Updated:** `docs/project-state/checkpoints/README.md`, `docs/project-state/CURRENT.md`, and `docs/project-state/active-roadmap.md` (checkpoint & WP-5.5 Stage 3/4 status synchronized).
8. **Confirmed Owner & Technical Decisions Applied:**
   - **Cluster 3 Inventory (`18` Active Entities / `98` Mapped Fields + `1` `DEFERRED`):** `TrainingGroup` (8), `GroupAssistantAssignment` (4), `GroupRenewalCycle` (7), `GroupCourseAssignment` (3), `GroupMembership` (4), `GroupQrCode` (5), `GroupJoinRequest` (6), `GroupResource` (5), `Enrollment` (4), `EnrollmentSourceGrant` (4), `CourseAttempt` (5), `LessonProgress` (6), `CertificateRecord` (9), `NotificationItem` (6), `WhatsAppContact` (4), `UserWhatsAppVisibility` (4), `ScheduledJob` (5), `ScheduledJobRun` (9); `InPersonAttendanceRecord` (`DEFERRED` per `Domain 16`).
   - **`D-01` Role-Aware & Record-Aware Deletion/Retention Policy (`OWNER-APPROVED`):** Evaluates role, relationship, ownership, and operational continuity; preserves `ON DELETE NO ACTION` across SQL Server + Django `transaction.atomic()`; blocks (`409`) `lecturer` deletion until `Course.primary_lecturer_id` reassignment and staff deletion if personal `WhatsAppContact` requires replacement; preserves `CP-010` (`HistoricalServiceTrainingRecord` Option A, `DelegatedAuthority`, `DeletedUserTombstone`/`DeletedUserAlias`, `PendingApprovalRequest`, `AuditLogEntry`, `INV-R4`) and `CP-011` (`CourseReviewSubmission`, `CourseComment` anonymization, `MediaContentReference`, `MediaAsset` No Auto Purge).
   - **`CertificateRecord` Internal Recipient Attribution & Public Verification Boundary (`TR-C3-03` — `OWNER-APPROVED`):** Issued certificates survive `D-01` (nullable/decoupled `course_attempt_id`, no auto-revocation, `BINARY(32)` `SHA-256` `verification_token_hash`, `revoked_at DATETIME2 NULL`); unissued rows deleted. Retains internal `recipient_name_snapshot`, `course_title_snapshot`, `certificate_serial`, `published_version_id`, `issued_at`; **`recipient_name_snapshot` is internal-only by default** and excluded (with all PII) from public verification (`Valid`/`Revoked`, `certificate_serial`, `course_title`, `version_number`, `issued_at`, `revoked_at`).
   - **`GroupRenewalCycle` 5-State Lifecycle & Direct `Scheduled → Expired` Recovery (`TR-C3-02` — `OWNER-APPROVED`):** `Scheduled`, `Active`, `Completed`, `Expired`, `Cancelled`; allows idempotent direct `Scheduled → Expired` system recovery when both `start_datetime` and `deadline_datetime` have passed before job execution, logged in `ScheduledJobRun` & `AuditLogEntry` without fabricating `Active`; `Expired` distinct from `Cancelled`.
   - **Dual `User` / `DeletedUserTombstone` Attribution XOR Pairs (`OWNER-APPROVED`):** `Course` (`created_by_user_id`/`created_by_tombstone_id`, separate from `primary_lecturer_id`), `CourseDraft` (`updated_by_user_id`/`updated_by_tombstone_id`), `PublishedCourseVersion` (`published_by_user_id`/`published_by_tombstone_id`), and `MediaAsset` (`uploaded_by_user_id`/`uploaded_by_tombstone_id`) with `ON DELETE NO ACTION` and XOR `CHECK (= 1)`.
   - **`TR-C3-01` (`GroupQrCode` — `OWNER-APPROVED` Option B):** Single mutable record per `TrainingGroup` (`UNIQUE(training_group_id)`), updated in place on regeneration; audit via `AuditLogEntry`.
   - **`TR-C3-04` (`ScheduledJob` & `ScheduledJobRun` — `OWNER-APPROVED` Architecture):** Two-entity split (`1 : 0..N`, `ON DELETE NO ACTION`), 5 statuses (`Pending`, `Running`, `Succeeded`, `Failed`, `Skipped`), idempotency + locking, max 3 attempts (`retry_count CHECK (0..2)`), UTC storage / `Africa/Cairo` display, 12-month initial retention, `Windows Task Scheduler` 6h for `process_due_group_renewals`.
   - **`TR-C3-05` (`MediaContentReference` — `OWNER-APPROVED`):** 3-way XOR `CHECK (= 1)` across `course_draft_id`, `published_version_id`, `group_renewal_cycle_id` (`ON DELETE NO ACTION`); preserves `CP-011` Detach/Restore/Move.
   - **Approved Logical `NVARCHAR` Lengths (`OWNER-APPROVED` — Not Pending Decisions):**
     - *Cluster 3 (5):* `TrainingGroup.name` (`255`), `GroupResource.title` (`255`), `GroupResource.meeting_url` (`2048`), `NotificationItem.title` (`255`), `WhatsAppContact.label` (`150`).
     - *Cluster 2 (6, preserved from `CP-011`):* `Course.title` (`255`), `Module.title` (`255`), `LessonItem.title` (`255`), `LessonItem.external_video_url` (`2048`), `CourseCommentReport.reason` (`500`), `MediaContentReference.title` (`255`).
9. **Architecture / Contract Changes:**
   - Complete Cluster 3 logical schema, role-aware `D-01` deletion/retention rules, `ScheduledJob`/`ScheduledJobRun` operational split, and `MediaContentReference` 3-way XOR recorded in [`data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md) without generating SQL DDL, Django models, or migrations (`WP-5.6` remains unauthorized).
10. **Requirements or Business Rules Clarified:**
    - Resolved all Cluster 3 technical-resolution items (`TR-C3-01`–`TR-C3-05`), role-aware `D-01` gaps, `CertificateRecord` public/internal boundary, and `NVARCHAR` governance classification; preserved `CP-010` and `CP-011` unchanged.
11. **Tests Executed and Exact Results:**
    - **Cluster 3 Closure Package Verification (UTF-8 PowerShell):** `16/16 PASS` (`exit code 0`).
    - **NVARCHAR Governance Correction Verification (UTF-8 PowerShell):** `8/8 PASS` (`exit code 0`).
    - **Runtime / Vitest / Django Tests:** `NOT EXECUTED` (documentation-only milestone).
12. **Known Issues / Remaining Risks (Non-Blocking Technical Items for Stage 4 / `WP-5.6`):**
    - `PROPOSED` / `TECHNICAL-RECOMMENDATION` physical/operational details (e.g., general scheduler tech beyond `Domain 20 / D4`, post-12-month `ScheduledJobRun` archive/delete mechanics, single-row retry `details_json` format, unapproved `NVARCHAR` lengths, and physical `BIGINT`/`DATETIME2(7)`/index choices) remain non-blocking and are not promoted to `OWNER-APPROVED`.
13. **Explicitly Deferred Items:**
    - `WP-5.5` Stage 4 (`Final Data Dictionary Review`) — **now authorized to begin immediately following this closure**.
    - `WP-5.6` (Physical SQL DDL, Django `models.py`, migrations) — **BLOCKED — NOT AUTHORIZED**.
    - `Domain 16` physical attendance (`InPersonAttendanceRecord`), `A-03a-1`, `A-03c-1`–`A-03c-3`, `OD-API-01`–`OD-API-04`, `API-REC-06` — **DEFERRED**.
14. **Out-of-Scope Items Confirmed:**
    - Zero Django models, migrations, SQL DDL, UML diagrams, Physical ERDs, runtime code, MSW handlers, or test files created or modified.
15. **Completed Phases / Work Packages / Increments:**
    - `Phase A`, `Phase 1` (`WP-1.1`–`WP-1.3`), `Phase 2` (`WP-2.1`–`WP-2.4`), `REV6 Phase 5 WP-5.1`–`WP-5.4` (`CP-009` + Erratum), `REV6 Phase 5 WP-5.5 Stage 0 & Stage 1 (CP-010)`, `REV6 Phase 5 WP-5.5 Stage 2 (CP-011)`, `REV6 Phase 5 WP-5.5 Stage 3 (Cluster 3 Checkpoint 3)`.
16. **Remaining Phases / Work Packages / Tasks:**
    - `WP-5.5 Stage 4 (Final Data Dictionary Review)` (`IN PROGRESS` upon this closure), `WP-5.6` (`BLOCKED — NOT AUTHORIZED`), `Phase 3` (`WP-3.1` `READY TO START`), `Phase 4`, `Phase 6`.
17. **Exact Next Task:** `REV6 Phase 5 — WP-5.5 Stage 4: Final Data Dictionary Review` (comprehensive audit across Clusters 1–3, stopping before Data Dictionary freeze for Owner sign-off).
18. **Entry Criteria for Next Task:** Formal closure of `WP-5.5` Checkpoint 3 (`CP-012`) and explicit Owner authorization for Stage 4 (both satisfied).
19. **Exit Criteria for Next Task:** Complete entity, relationship, field-level, Owner-decision, `D-01` cross-cluster, SQL Server/Unicode, and deferred-boundary audit findings with final sign-off recommendation; `data-dictionary.md` remains **unfrozen** awaiting explicit Owner freeze authorization.
20. **Authoritative Documents to Read Before Starting Next Task:**
    - [`docs/02-architecture-and-design/data-models/data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md)
    - [`docs/02-architecture-and-design/data-models/logical-data-model.md`](../../02-architecture-and-design/data-models/logical-data-model.md)
    - [`docs/02-architecture-and-design/data-models/erd-crow-foot.md`](../../02-architecture-and-design/data-models/erd-crow-foot.md)
    - [`docs/project-state/CURRENT.md`](../CURRENT.md)

