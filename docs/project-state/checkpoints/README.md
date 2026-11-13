# MetroLMS — Project Checkpoints Directory (`docs/project-state/checkpoints/`)

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Role:** Permanent, append-only ledger of immutable project checkpoints. Each checkpoint records a self-contained historical snapshot of project state at the acceptance of every completed Work Package, separately accepted Increment, or Phase closure.
> **Last Updated:** 2026-11-10 (`CP-007` — WP-2.3 Closure: Rule B Curriculum Versioning, D-12 Progress Rounding & D-13 Version-Scoped Certificates `MFR-10, 09, 46`)

---

## 1. Separation of Responsibilities in `docs/project-state/`

MetroLMS enforces a strict three-part project state architecture:

1. **Living Master Plan ([`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md)):**
   - The comprehensive, continuously updated execution plan for `Phase 1` through `Phase 4` (work packages, tasks, dependencies, acceptance criteria, and current position).
2. **Current Project State Dashboard ([`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md)):**
   - The concise live status dashboard pointing to the latest accepted checkpoint and the exact current position and next task in `active-roadmap.md`.
3. **Immutable Checkpoint History (`docs/project-state/checkpoints/` — this directory):**
   - Historical snapshots of accepted milestones. Previous checkpoints (`CP-001`, etc.) are **never rewritten or modified** to reflect newer progress; each new accepted milestone generates a new sequential checkpoint file.

---

## 2. Checkpoint Governance & Frequency Rules

1. **Sequential Per-Milestone Checkpoint Rule:**
   - **Every successfully completed and accepted Work Package, separately accepted Increment, or Phase** receives the next available sequential checkpoint ID (`CP-002`, `CP-003`, `CP-004`, ...).
   - **Combined Work Package & Phase Closure:** When the final Work Package of a Phase (`WP-1.3`, `WP-2.4`, `WP-3.4`, `WP-4.4`) also closes its parent Phase, a single checkpoint file records both the Work Package acceptance and the Phase closure.
   - **Incomplete or Blocked Work:** If a task or Work Package is incomplete or blocked at the end of a turn, update [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md) and [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md) (`IN PROGRESS` or `BLOCKED`) **without** creating a completion checkpoint.
2. **Strict Immutability:** Once a checkpoint file (`CP-NNN-YYYY-MM-DD-<slug>.md`) is published and referenced by [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md), it is **never modified or deleted**.
3. **Naming Convention:**
   ```text
   CP-<3-digit-number>-<YYYY-MM-DD>-<kebab-case-milestone-slug>.md
   ```
   Example: `CP-001-2026-11-07-phase-a-closure.md`, `CP-002-YYYY-MM-DD-wp-1-1-closure.md`.
4. **Synchronization with `active-roadmap.md` and `CURRENT.md`:** Whenever a Work Package, Increment, or Phase is accepted and a new checkpoint is created, update [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md), [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md), and the Checkpoint Index below in the same turn.
5. **No Full-Repository Re-Audits:** Any engineer or AI agent starting a new session must read `CURRENT.md`, the latest checkpoint file, and `active-roadmap.md` first, trusting the verified baseline rather than re-auditing closed historical reports.

---

## 3. Mandatory 20-Field Checkpoint Template

Every checkpoint file created in this directory (`CP-002` onward; `CP-001` remains untouched as published) must include all 20 fields below:

1. **Checkpoint ID** (`CP-NNN`)
2. **Date / Timestamp** (ISO-8601 date)
3. **Previous Checkpoint Reference** (Link to `CP-(NNN-1)`)
4. **Phase / Work Package / Increment Completed** (e.g., `Phase 1 — WP-1.1`)
5. **Status** (`IMPLEMENTED — VERIFICATION PENDING`, `COMPLETED AND ACCEPTED`, `HANDOFF_READY`, etc.)
6. **Summary of What Was Completed**
7. **Files Created, Updated, Moved, or Archived**
8. **Confirmed Owner Decisions Applied**
9. **Architecture / Contract Changes**
10. **Requirements or Business Rules Clarified**
11. **Tests Executed and Exact Results, or `NOT EXECUTED` (`Deferred to Gate B`)**
12. **Known Issues / Remaining Risks**
13. **Explicitly Deferred Items**
14. **Out-of-Scope Items Confirmed**
15. **Completed Phases / Work Packages / Increments**
16. **Remaining Phases / Work Packages / Tasks**
17. **Exact Next Task (`Phase` / `Work Package` / `Task ID`)**
18. **Entry Criteria for Next Task**
19. **Exit Criteria for Next Task**
20. **Authoritative Documents to Read Before Starting Next Task**

---

## 4. Checkpoint Index & Sequential Milestone Schedule

### 4.1 Accepted & Immutable Checkpoints

| Checkpoint ID | Date | Milestone | Status | File Link |
| :---: | :---: | :--- | :---: | :--- |
| **`CP-001`** | `2026-11-07` | Phase A Closure, Owner Decision Reconciliation & Documentation Architecture Consolidation | `COMPLETED AND ACCEPTED` *(Immutable)* | [`CP-001-2026-11-07-phase-a-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-001-2026-11-07-phase-a-closure.md) |
| **`CP-002`** | `2026-11-07` | WP-1.1 Closure (WP-5.4.5 Closure & Phase 5 Acceptance) | `COMPLETED AND ACCEPTED` *(Immutable)* | [`CP-002-2026-11-07-wp-1-1-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-002-2026-11-07-wp-1-1-closure.md) |
| **`CP-003`** | `2026-11-07` | WP-1.2 Closure (Session Lifecycle and Developer Isolation) | `COMPLETED AND ACCEPTED` *(Immutable)* | [`CP-003-2026-11-07-wp-1-2-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-003-2026-11-07-wp-1-2-closure.md) |
| **`CP-004`** | `2026-11-09` | WP-1.3 Closure & Phase 1 Closure (Django Authentication Integration Contract & Auth Test Reconciliation) | `COMPLETED AND ACCEPTED` *(Immutable)* | [`CP-004-2026-11-09-wp-1-3-and-phase-1-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-004-2026-11-09-wp-1-3-and-phase-1-closure.md) |
| **`CP-005`** | `2026-11-09` | WP-2.1 Closure (Enrollment Provenance, Per-Attempt Progress & Progress Reader Unification `D-06, MFR-02, 32, 33, 41`) | `COMPLETED AND ACCEPTED` *(Immutable)* | [`CP-005-2026-11-09-wp-2-1-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-005-2026-11-09-wp-2-1-closure.md) |
| **`CP-006`** | `2026-11-09` | WP-2.2 Closure (Group Member Removal & Per-Course Continuation Grants `D-07`, `MFR-24`) | `COMPLETED AND ACCEPTED` *(Immutable)* | [`CP-006-2026-11-09-wp-2-2-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-006-2026-11-09-wp-2-2-closure.md) |
| **`CP-007`** | `2026-11-10` | WP-2.3 Closure (Curriculum Versioning `Rule B`, Progress Rounding `D-12` & Version-Scoped Certificates `D-13`, `MFR-10, 09, 46`) | `COMPLETED AND ACCEPTED` *(Immutable)* | [`CP-007-2026-11-10-wp-2-3-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) |

### 4.2 Planned Sequential Checkpoints Across Active Work Packages & Phases ([`active-roadmap.md` §5.2 & §7.1](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md#52-active-execution-phases-work-package--task-status-phases-14))

*(Note: Checkpoint IDs are allocated sequentially as each Work Package, separately accepted Increment, or Phase is accepted. If an Increment within a Work Package is separately accepted by the Owner, subsequent IDs shift sequentially by `+1`.)*

| Sequential ID | Target Work Package / Phase Milestone | Trigger Condition |
| :---: | :--- | :--- |
| **`CP-008`** *(Next)* | **`WP-2.4` Closure & `Phase 2 — Core Domain Logic Reconciliation` Closure** | Acceptance of `T-2.4.1`–`T-2.4.2` (`resolveCourseAccess` `hide` vs. `keep_no_cert`) and `T-2.4.3` (Phase 2 test suites authored). Closes both `WP-2.4` and `Phase 2`. |
| **`CP-009`** | **`WP-3.1` Closure (Lecturer Deletion Workflow `D-03`, `D-11`)** | Acceptance of `T-3.1.1`–`T-3.1.3` (nullable `غير معين` ownership, `409 LECTURER_HAS_ACTIVE_ASSIGNMENTS`, and `DeleteUserModal.tsx` with `مواصلة الحذف`). |
| **`CP-010`** | **`WP-3.2` Closure (User Deletion Cascade `D-01` & Comment Anonymization `D-02`)** | Acceptance of `T-3.2.1` (16-collection permanent deletion cascade, tombstones, and `مستخدم محذوف` comment anonymization). |
| **`CP-011`** | **`WP-3.3` Closure & `Gate A` Domain Contract Freeze** | Acceptance of `T-3.3.1` (`HTTP 202` approval execution branches for `D-07, D-01, D-03`) and `T-3.3.2` (6-tier role invariants `INV-R1`–`INV-R10`). Certifies **Gate A**. |
| **`CP-012`** | **`WP-3.4` Closure & `Phase 3 — Administrative Workflows & Mutation Safety` Closure** | Acceptance of `T-3.4.1` (`D-SEC-01` 11-surface XSS/DOMPurify/CSP hardening), `T-3.4.2` (`MFR-04, 15, 19` UX fixes), and `T-3.4.3` (Phase 3 test suites authored). Closes both `WP-3.4` and `Phase 3`. |
| **`CP-013`** | **`WP-4.1` Closure (DRF Query Parameter & Response/Error Envelope Normalization)** | Acceptance of `T-4.1.1` and `T-4.1.2`. |
| **`CP-014`** | **`WP-4.2` Closure (`D-MEDIA-01` Media Upload & Delivery Contract Normalization)** | Acceptance of `T-4.2.1` (`MediaAssetReference` normalization). |
| **`CP-015`** | **`WP-4.3` Closure (MSW v2 & Service Layer Contract Consistency)** | Acceptance of `T-4.3.1` (1:1 service-to-MSW contract parity). |
| **`CP-016`** | **`WP-4.4` Closure, `Phase 4` Closure & Final `Gate B` Frontend Readiness Sign-Off** | Acceptance of `T-4.4.1` (100% Vitest pass across `1,174` baseline + all Phase 1–5 suites), `T-4.4.2` (`tsc`, `eslint`, `vite build` 0 errors), and `T-4.4.3` (Final DRF Handoff Package). Closes `WP-4.4`, `Phase 4`, and **Gate B**. |
