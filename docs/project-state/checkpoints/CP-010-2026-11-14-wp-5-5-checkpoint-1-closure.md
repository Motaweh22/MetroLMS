# MetroLMS — Checkpoint CP-010: REV6 Phase 5 — WP-5.5 Checkpoint 1 Closure (Cluster 1: Identity & Organization)

1. **Checkpoint ID:** `CP-010`
2. **Date / Timestamp:** `2026-11-14T14:10:00+02:00`
3. **Previous Checkpoint Reference:** [`CP-009-2026-11-14-rev6-wp-5-4-closure.md`](CP-009-2026-11-14-rev6-wp-5-4-closure.md) (`CP-009` — REV6 Phase 5, WP-5.4 Closure, with [`cp-009-baseline-erratum-metroline-and-egyptian-phone.md`](../../02-architecture-and-design/data-models/cp-009-baseline-erratum-metroline-and-egyptian-phone.md))
4. **Phase / Work Package / Increment Completed:** `REV6 Phase 5 — WP-5.5 Stage 0 (Preparation & Inventory) & Stage 1 (Cluster 1: Identity & Organization) — Checkpoint 1`
5. **Status:** `COMPLETED AND ACCEPTED` *(Immutable — Cluster 1 Checkpoint 1 formally closed; Cluster 2 authorized; Data Dictionary remains unfrozen overall)*
6. **Summary of What Was Completed:**
   - Completed Stage 0 preparation and full Cluster 1 (`Identity & Organization`) entity/relationship inventory (15 entities, 3 organizational association tables, and normalized `DeletedUserAlias`).
   - Completed Stage 1 logical field mappings for all Cluster 1 entities in [`data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md) targeting Django + DRF + Microsoft SQL Server (`D-DB-01`).
   - Integrated and verified all 11 Owner-approved Checkpoint 1 technical decisions (`CP1 #1`–`#11`) and the Owner-approved `INV-R4` consolidation into `INV-R1`–`INV-R3` (removing `User.is_protected_admin`).
   - Formally closed WP-5.5 Checkpoint 1 and authorized transition to WP-5.5 Stage 2 (`Cluster 2: Courses & Learning`).
7. **Files Created, Updated, Moved, or Archived:**
   - **Created:** `docs/project-state/checkpoints/CP-010-2026-11-14-wp-5-5-checkpoint-1-closure.md` (this immutable checkpoint).
   - **Updated:** `docs/02-architecture-and-design/data-models/data-dictionary.md` (Cluster 1 baseline finalized; remains **unfrozen** overall for Stage 2 / Cluster 2 and Stage 3 / Cluster 3).
   - **Updated:** `docs/project-state/CURRENT.md` and `docs/project-state/checkpoints/README.md`.
8. **Confirmed Owner Decisions Applied (`CP1 #1`–`#11` & `INV-R4`):**
   - **CP1 #1:** `User.id` is `BIGINT IDENTITY(1,1)` (`BigAutoField`).
   - **CP1 #2:** `User.national_id` has a database-level `UNIQUE` constraint.
   - **CP1 #3:** `DeletedUserAlias` uses Option B (separate normalized child entity instead of `alias_ids_json`).
   - **CP1 #4:** `PendingApprovalRequest` uses Option A (polymorphic `target_entity_type`, `target_entity_id` with `payload_snapshot_json`).
   - **CP1 #5:** Phone storage uses canonical `phone_e164` only (derive Egyptian 11-digit local display when needed).
   - **CP1 #6:** `ON DELETE NO ACTION` is the general FK deletion baseline across Cluster 1 relationships (no DB-level cascade; explicit `D-01` service handling).
   - **CP1 #7:** `HistoricalServiceTrainingRecord` uses Option A (`user_id` / `tombstone_id` XOR ownership transfer during `D-01`).
   - **CP1 #8:** `HistoricalServiceTrainingRecord` is retained **indefinitely** post-`D-01` (no automatic expiration, purging, or anonymization; access subject to authorization and audit policies).
   - **CP1 #9 & #11:** `DelegatedAuthority` uses two-party historical retention and Tombstone attribution (`user_id`/`grantee_tombstone_id` and `granted_by_user_id`/`granted_by_tombstone_id`) with independent Grantor/Grantee XOR `CHECK` constraints; `D-01` transfers the deleted party's reference to Tombstone, sets `is_active = 0`, preserves the historical record, and preserves the other party's identity.
   - **CP1 #10:** Approved `NVARCHAR` logical lengths: `User.full_name` (`NVARCHAR(200)`), `User.educational_qualification` (`NVARCHAR(500)`), `User.address` (`NVARCHAR(500)`), `DeletedUserTombstone.reason` (`NVARCHAR(1000)`).
   - **`INV-R4` Consolidation:** Owner confirmed the protected account is the existing `Developer` account; `INV-R4` is consolidated into `INV-R1`–`INV-R3` (`role != 'developer'`), and `User.is_protected_admin` (plus any singleton/extra role `CHECK` constraint) was removed from `User`.
9. **Architecture / Contract Changes:**
   - Logical field mappings and deletion lifecycle rules for Cluster 1 (`Identity & Organization`) established in [`data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md) without generating SQL DDL, Django models, or migrations (`WP-5.6` remains unauthorized).
10. **Requirements or Business Rules Clarified:**
    - Resolved all 11 Cluster 1 Checkpoint 1 technical/business questions (`CP1 #1`–`#11`) and `INV-R4` redundancy.
11. **Tests Executed and Exact Results:**
    - **Documentation Verification Assertions (UTF-8 PowerShell):** `11/11 PASS` (`exit code 0`) verifying `CP1 #1`–`#11`, exact `NVARCHAR` lengths, `DelegatedAuthority` two-party refs and independent XOR constraints, `D-01` deactivation/preservation, `INV-R4` consolidation without `is_protected_admin`, no silent promotion of unrelated `PROPOSED` fields, unfrozen `data-dictionary.md`, `CURRENT.md` accuracy, and Cluster 2/3 non-execution prior to Part B.
    - **Runtime / Vitest / Django Tests:** `NOT EXECUTED` (documentation-only milestone).
12. **Known Issues / Remaining Risks (Remaining `PROPOSED` & `TECHNICAL-RECOMMENDATION` Items — Not Owner-Approved):**
    - Physical SQL Server type/precision choices (e.g., `BIGINT` vs. `INT` on catalog PKs, `DATETIME2(7)` precision, index definitions) remain `TECHNICAL-RECOMMENDATION`.
    - Non-promoted `PROPOSED` fields (e.g., `User.email`, `DeletedUserTombstone.canonical_user_id`, `AuditLogEntry` and `PendingApprovalRequest` metadata/snapshot columns, catalog `name_ar`/`name_en` lengths) remain `PROPOSED` and are **not** Owner-approved.
13. **Explicitly Deferred Items:**
    - `WP-5.5` Stage 2 (`Cluster 2: Courses & Learning`) — **now authorized to begin immediately following this closure**.
    - `WP-5.5` Stage 3 (`Cluster 3: Groups & Training Operations`) — **unauthorized / not started**.
    - `WP-5.6` (Physical SQL DDL, Django `models.py`, migrations) — **unauthorized / not started**.
14. **Out-of-Scope Items Confirmed:**
    - Zero Django models, migrations, SQL DDL, UML diagrams, runtime code, MSW handlers, or test files modified.
15. **Completed Phases / Work Packages / Increments:**
    - `Phase A`, `Phase 1` (`WP-1.1`–`WP-1.3`), `Phase 2` (`WP-2.1`–`WP-2.4`), `REV6 Phase 5 WP-5.1`–`WP-5.4` (`CP-009` + Erratum), `REV6 Phase 5 WP-5.5 Stage 0 & Stage 1 (Cluster 1 Checkpoint 1)`.
16. **Remaining Phases / Work Packages / Tasks:**
    - `WP-5.5 Stage 2 (Cluster 2)` (`IN PROGRESS` upon this closure), `WP-5.5 Stage 3 (Cluster 3)` (`BLOCKED`), `WP-5.6` (`BLOCKED`), `Phase 3` (`WP-3.1` `READY TO START`), `Phase 4`, `Phase 6`.
17. **Exact Next Task:** `REV6 Phase 5 — WP-5.5 Stage 2: Cluster 2 (Courses & Learning) Logical Field Mapping` (stopping at Checkpoint 2).
18. **Entry Criteria for Next Task:** Formal closure of `WP-5.5` Checkpoint 1 (`CP-010`) and explicit Owner authorization for Stage 2 / Cluster 2 (both satisfied).
19. **Exit Criteria for Next Task:** Complete Cluster 2 entity inventory, draft logical field mappings, Cluster 2 relationships, and Technical-Resolution Log populated in `data-dictionary.md`, stopping at `WP-5.5 — STAGE 2 / CLUSTER 2: COMPLETED — CHECKPOINT 2 UNDER OWNER REVIEW`.
20. **Authoritative Documents to Read Before Starting Next Task:**
    - [`docs/02-architecture-and-design/data-models/logical-data-model.md`](../../02-architecture-and-design/data-models/logical-data-model.md)
    - [`docs/02-architecture-and-design/data-models/data-dictionary.md`](../../02-architecture-and-design/data-models/data-dictionary.md)
    - [`docs/project-state/CURRENT.md`](../CURRENT.md)

