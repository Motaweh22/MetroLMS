# MetroLMS — Master Documentation Navigation Hub (`docs/README.md`)

> **Document Status:** `ACTIVE — AUTHORITATIVE (MASTER DOCUMENTATION ENTRY POINT)`
> **Canonical Role:** Single entry point for the entire MetroLMS knowledge base (`116` repository Markdown files; `22` active files — `16` `ACTIVE — AUTHORITATIVE` + `6` `ACTIVE — SUPPORTING` — and `94` frozen/historical/archived files). Directs engineers and AI agents to the **single authoritative source of truth** for every domain and enforces the 7-level Documentation Authority Hierarchy.
> **Last Updated:** 2026-11-07 (`CP-001` — Final Documentation Cleanup & `WP-1.1` Readiness Alignment)

---

## 1. Where to Start (Mandatory Reading Order for Any New Session)

To resume work without re-auditing the repository or reconstructing history, read these files in exact order:

1. **[`docs/project-state/CURRENT.md`](project-state/CURRENT.md)** — Live project status dashboard, latest checkpoint pointer, active working-tree notice, and exact next task.
2. **[`docs/project-state/checkpoints/CP-001-2026-11-07-phase-a-closure.md`](project-state/checkpoints/CP-001-2026-11-07-phase-a-closure.md)** — Latest immutable checkpoint (`CP-001`).
3. **[`docs/project-state/active-roadmap.md`](project-state/active-roadmap.md)** — Living Master Plan (`Phase 1` through `Phase 4`, work packages `WP-1.1`–`WP-4.4`, tasks, dependencies, and exit conditions).
4. **[`docs/architecture/decision-register.md`](architecture/decision-register.md)** — Binding Owner Decisions (`D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-MEDIA-01`, `D-01`–`D-14`, `OD-01`–`OD-02`, Phase 5 Decisions `A, B, C, E, F`).
5. **[`AGENTS.md`](../AGENTS.md)** — Mandatory Continuous Update Protocol and Sequential Checkpoint Governance.

---

## 2. Canonical Source-of-Truth Register (One Owner Per Domain)

Every active information domain in MetroLMS has **exactly one** canonical authoritative file. Supporting files must link to the canonical owner rather than duplicating its rules:

| Domain | Canonical File (`ACTIVE — AUTHORITATIVE`) | Supporting Files (`ACTIVE — SUPPORTING` / `FROZEN`) |
| :--- | :--- | :--- |
| **1. Project Purpose, Scope, Tech Stack & Out-of-Scope Fence** | [`docs/architecture/system-architecture.md`](architecture/system-architecture.md) | [`README.md`](../README.md) |
| **2. Confirmed Owner Decisions (`D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-MEDIA-01`, `D-01`–`D-14`, `Decision C`, `D-GRP-01`–`D-GRP-08`)** | [`docs/architecture/decision-register.md`](architecture/decision-register.md) | [`docs/archive/README.md`](archive/README.md) |
| **3. Authentication, Sessions, CSRF, Logout (`LOGOUT_UNCONFIRMED`), Snapshot Security & Role Preview/Testing (`D-AUTH-01`, `D-10`, `S7`)** | [`docs/architecture/authentication-and-session-contract.md`](architecture/authentication-and-session-contract.md) | [`docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md`](frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md) |
| **4. Frontend Security, 11-Surface XSS Matrix & Role Invariants (`D-SEC-01`, `INV-R1`–`INV-R10`)** | [`docs/architecture/security-and-xss-baseline.md`](architecture/security-and-xss-baseline.md) | [`docs/frontend/authorization-and-permissions-design.md`](frontend/authorization-and-permissions-design.md) *(§§3–10)* |
| **5. Domain & Business Rules (6 Roles, `Rule A`, `Rule B`, Approvals, Progress, Deletions, Groups & Reminder Programs)** | [`docs/requirements/domain-business-rules.md`](requirements/domain-business-rules.md) & [`docs/requirements/reminder-programs-and-group-domain-specification.md`](requirements/reminder-programs-and-group-domain-specification.md) | [`docs/backend/pre-backend-migration-remediation-roadmap.md`](backend/pre-backend-migration-remediation-roadmap.md) *(Frozen MFR-01..46 baseline)* |
| **6. Frontend Component, State & Routing Architecture** | [`docs/frontend/architecture.md`](frontend/architecture.md) | [`docs/frontend/README.md`](frontend/README.md) |
| **7. Design System, Arabic RTL Typography & UI Tokens** | [`docs/frontend/design-system.md`](frontend/design-system.md) | [`docs/frontend/README.md`](frontend/README.md) |
| **8. Async Loading, Error & Empty State UX Patterns** | [`docs/frontend/loading-and-error-handling.md`](frontend/loading-and-error-handling.md) | [`docs/frontend/README.md`](frontend/README.md) |
| **9. Django + Microsoft SQL Server Integration & Media Contract (`D-DB-01`, `D-MEDIA-01`)** | [`docs/backend/django-sqlserver-integration-contract.md`](backend/django-sqlserver-integration-contract.md) | [`docs/backend/database-schema.md`](backend/database-schema.md), [`docs/backend/erd.md`](backend/erd.md), [`docs/backend/erd-chen.md`](backend/erd-chen.md), [`docs/backend/contracts/developer-bootstrap-contract.md`](backend/contracts/developer-bootstrap-contract.md) *(Frozen logical baselines)* |
| **10. Living Master Plan & Remaining Execution Roadmap (`Phases 1–4`)** | [`docs/project-state/active-roadmap.md`](project-state/active-roadmap.md) | [`docs/frontend/checklists/README.md`](frontend/checklists/README.md), [`docs/frontend/reports/README.md`](frontend/reports/README.md) |
| **11. Current Project State Dashboard** | [`docs/project-state/CURRENT.md`](project-state/CURRENT.md) | — |
| **12. Immutable Checkpoint Governance & Ledger** | [`docs/project-state/checkpoints/README.md`](project-state/checkpoints/README.md) | [`docs/project-state/checkpoints/CP-001-2026-11-07-phase-a-closure.md`](project-state/checkpoints/CP-001-2026-11-07-phase-a-closure.md) *(Frozen `CP-001`)* |
| **13. Verification, Test Inventory & Gate B Strategy** | [`docs/project-state/verification-and-test-strategy.md`](project-state/verification-and-test-strategy.md) | — |
| **14. Developer & AI Agent Workflow Governance** | [`AGENTS.md`](../AGENTS.md) | [`README.md`](../README.md), [`docs/README.md`](README.md) |

---

## 3. Complete Repository Markdown Directory Structure & Classification (`116` Files)

| Classification | Count | Summary |
| :--- | :---: | :--- |
| **`ACTIVE — AUTHORITATIVE`** | **`16`** | Canonical domain specifications, Living Master Plan, Current State Dashboard, Checkpoint Index, Verification Strategy, and Root/Master Entry Points (`README.md`, `AGENTS.md`, `docs/README.md`). |
| **`ACTIVE — SUPPORTING`** | **`6`** | Directory indexes (`docs/frontend/README.md`, `checklists/README.md`, `reports/README.md`, `archive/README.md`), active Phase 5 checklist (`phase-05-developer-preview-and-isolated-testing-checklist.md`), and 3-layer permission capability reference (`authorization-and-permissions-design.md`). |
| **`FROZEN — DO NOT MODIFY`** | **`12`** | Immutable checkpoint (`CP-001`), frozen 13-phase remediation baseline (`pre-backend-migration-remediation-roadmap.md`), frozen 42-table schema & ERDs (`database-schema.md`, `erd.md`, `erd-chen.md`), CLI bootstrap baseline (`developer-bootstrap-contract.md`), frozen Increment 0–12 roadmaps (`3` files), and completed Remediation Phase 2–4 checklists (`3` files). |
| **`HISTORICAL — PRESERVE`** | **`36`** | Phase A audit report (`1`), Notification Center & Remediation Phase 3–5 implementation/audit reports (`20`), completed Increment 5–11 feature checklists (`11`), legacy parity/inventory audits (`2`), and protected `legacy-reference/` Markdown files (`2`). |
| **`SUPERSEDED — ARCHIVE`** | **`46`** | Retired `SUP-01` audit series `v1.3`–`v3.26` (`44` files in `docs/frontend/reports/`) and archived raw chat transcripts (`2` files in `docs/archive/transcripts/`). |
| **`DUPLICATE — CONSOLIDATE`** | **`0`** | Active documentation duplication resolved in place (all secondary summaries link to canonical owners). |
| **`PROVISIONAL — OWNER REVIEW`** | **`0`** | Zero unresolved provisional documents. |
| **`ORPHANED — CLASSIFICATION REQUIRED`** | **`0`** | Zero orphaned files (all `116` repository Markdown files are indexed below). |
| **Total Repository Markdown Files** | **`116`** | *(Plus `82` external Brain session artifact mirrors outside the repository)* |

```text
.
├── README.md                                          # [ACTIVE — AUTHORITATIVE] Repository Entry Point & Quick Start
├── AGENTS.md                                          # [ACTIVE — AUTHORITATIVE] Developer & AI Agent Workflow Guide
├── legacy-reference/                                  # [HISTORICAL — PRESERVE] Read-only legacy Vanilla JS reference (2 .md files)
│   ├── README.md
│   └── CHAT_TRANSCRIPT.md
└── docs/
    ├── README.md                                      # [ACTIVE — AUTHORITATIVE] Master Documentation Navigation Hub (this file)
    ├── architecture/                                  # [ACTIVE — AUTHORITATIVE] Canonical System, Auth, Security & Decision Specs (4 files)
    │   ├── system-architecture.md                     # Stack, boundaries, media contract & out-of-scope fence
    │   ├── decision-register.md                       # Master Owner Decision Register (Level 1 Authority)
    │   ├── authentication-and-session-contract.md     # D-AUTH-01, CSRF, /api/auth/me, logout, LOGOUT_UNCONFIRMED, snapshot security & WP-1.1..1.3 matrix
    │   └── security-and-xss-baseline.md               # D-SEC-01 11-surface XSS matrix, DOMPurify, CSP, INV-R1..R10
    ├── requirements/                                  # [ACTIVE — AUTHORITATIVE] Canonical Domain & Business Rules (2 files)
    │   ├── domain-business-rules.md                   # Consolidated LMS domain rules across all 10 functional areas
    │   └── reminder-programs-and-group-domain-specification.md # In-place renewals, D-GRP-01..08, and trainee group contract
    ├── project-state/                                 # Project State, Living Master Plan & Checkpoints (5 files)
    │   ├── CURRENT.md                                 # [ACTIVE — AUTHORITATIVE] Concise current-state dashboard
    │   ├── active-roadmap.md                          # [ACTIVE — AUTHORITATIVE] Living Master Plan (Phases 1–4)
    │   ├── verification-and-test-strategy.md          # [ACTIVE — AUTHORITATIVE] Test baseline (1,174), authored suites & Gate B
    │   └── checkpoints/                               # Append-only immutable project checkpoints
    │       ├── README.md                              # [ACTIVE — AUTHORITATIVE] Checkpoint governance & 20-field template
    │       └── CP-001-2026-11-07-phase-a-closure.md   # [FROZEN — DO NOT MODIFY] Immutable Checkpoint CP-001
    ├── frontend/                                      # Frontend Specs, Roadmaps, Checklists & Reports (92 files)
    │   ├── README.md                                  # [ACTIVE — SUPPORTING] Frontend documentation index
    │   ├── architecture.md                            # [ACTIVE — AUTHORITATIVE] Component, context & routing architecture
    │   ├── design-system.md                           # [ACTIVE — AUTHORITATIVE] Arabic RTL design tokens & UI primitives
    │   ├── loading-and-error-handling.md              # [ACTIVE — AUTHORITATIVE] Async UI states & error boundaries
    │   ├── authorization-and-permissions-design.md    # [ACTIVE — SUPPORTING] 3-layer permission capability matrices (§§3–10)
    │   ├── implementation-roadmap*.md                 # [FROZEN — DO NOT MODIFY] Historical Increment 0–12 feature roadmaps (3 files)
    │   ├── legacy-feature-parity-audit.md             # [HISTORICAL — PRESERVE] Legacy-to-React feature parity audit (LEG-001..045)
    │   ├── legacy-inventory.md                        # [HISTORICAL — PRESERVE] Legacy route & view migration inventory
    │   ├── checklists/                                # Frontend Checklists (16 files: 1 index + 1 active + 3 frozen + 11 historical)
    │   │   └── README.md                              # [ACTIVE — SUPPORTING] Checklists index & phase-5 vs phase-05 disambiguation
    │   └── reports/                                   # Frontend Reports (66 files: 1 index + 21 historical evidence + 44 superseded SUP-01)
    │       └── README.md                              # [ACTIVE — SUPPORTING] Reports index & authority classification
    ├── backend/                                       # Backend Contracts & Frozen Logical Schema Baselines (6 files)
    │   ├── django-sqlserver-integration-contract.md   # [ACTIVE — AUTHORITATIVE] Canonical Django + SQL Server + Media contract (D-DB-01, D-MEDIA-01)
    │   ├── pre-backend-migration-remediation-roadmap.md # [FROZEN — DO NOT MODIFY] Baseline 46-MFR definition (Rev 5)
    │   ├── database-schema.md                         # [FROZEN — DO NOT MODIFY] 42-table 3NF logical schema (SQL Server mapping in integration contract)
    │   ├── erd.md                                     # [FROZEN — DO NOT MODIFY] Crow's Foot 42-table ERD companion to database-schema.md
    │   ├── erd-chen.md                                # [FROZEN — DO NOT MODIFY] Classic Chen 42-table ERD companion to database-schema.md
    │   └── contracts/
    │       └── developer-bootstrap-contract.md        # [FROZEN — DO NOT MODIFY] CLI bootstrap rules (Django mapping in integration contract)
    └── archive/                                       # Historical Archive & Superseded Transcripts (3 files)
        ├── README.md                                  # [ACTIVE — SUPPORTING] Archive governance & complete classification register
        └── transcripts/                               # [SUPERSEDED — ARCHIVE] Relocated multi-megabyte raw chat transcripts (2 files)
            ├── CHAT_TRANSCRIPT.md
            └── CHAT_TRANSCRIPT_INCREMENTS_9_10.md
```

---

## 4. Seven-Level Documentation Authority Hierarchy

If any two files in the repository appear to disagree, resolve the conflict deterministically using this precedence order (Level 1 is highest):

1. **Level 1 — [`docs/architecture/decision-register.md`](architecture/decision-register.md)** (Explicit Owner Decisions `D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-MEDIA-01`, `D-01`–`D-14`, `OD-01`–`OD-02`, Phase 5 Decisions `A, B, C, E, F`).
2. **Level 2 — [`docs/project-state/CURRENT.md`](project-state/CURRENT.md) & Latest Checkpoint in [`docs/project-state/checkpoints/`](project-state/checkpoints/README.md)** (Current implementation status and active phase boundaries).
3. **Level 3 — Active Canonical Specifications (`docs/architecture/*.md`, `docs/requirements/domain-business-rules.md`, `docs/backend/django-sqlserver-integration-contract.md`, `docs/project-state/active-roadmap.md`, `docs/project-state/verification-and-test-strategy.md`)**.
4. **Level 4 — Active Frontend Design & Supporting References (`docs/frontend/architecture.md`, `docs/frontend/design-system.md`, `docs/frontend/loading-and-error-handling.md`, `docs/frontend/authorization-and-permissions-design.md` §§3–10)** and **Active Remediation Checklist (`docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md`)**.
5. **Level 5 — Frozen Baseline Roadmaps, Schemas & Completed Remediation Checklists (`docs/backend/pre-backend-migration-remediation-roadmap.md`, `docs/backend/database-schema.md`, `docs/backend/erd.md`, `docs/backend/erd-chen.md`, `docs/backend/contracts/developer-bootstrap-contract.md`, `docs/frontend/implementation-roadmap*.md`, `docs/frontend/checklists/phase-02`–`phase-04`)** — Authoritative for historical MFR/table definitions, except where superseded by Levels 1–3 (e.g., SQL Server `D-DB-01` supersedes PostgreSQL syntax).
6. **Level 6 — Historical Implementation & Audit Evidence (`docs/frontend/reports/phase-a-*.md`, `docs/frontend/reports/phase-03/04/05-*.md`, `docs/frontend/checklists/increment-*.md`, `docs/frontend/legacy-*.md`)** — Point-in-time audit evidence.
7. **Level 7 — Superseded & Historical Archive (`docs/frontend/reports/sup-01-*.md`, `docs/archive/transcripts/*.md`, `legacy-reference/**`)** — Zero active normative authority.
