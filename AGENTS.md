# MetroLMS — Developer & AI Agent Workflow Guide (`AGENTS.md`)

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Role:** Mandatory operating instructions for human developers and AI coding agents working in `d:\LMS MEtro Project`. Enforces the three-tier Project State & Checkpoint Architecture, the Continuous Update Protocol, documentation authority hierarchy, and scope boundaries.
> **Last Updated:** 2026-11-07 (`CP-001` — Final Consistency & Checkpoint Governance Alignment)

---

## 1. Three-Tier Project State & Planning Responsibilities

Every developer and AI agent must preserve the strict separation of responsibilities among these three project-state documents:

1. **Living Master Plan — [`docs/project-state/active-roadmap.md`](docs/project-state/active-roadmap.md):**
   - The **only** authoritative active execution plan and primary planning reference.
   - Explains the entire remaining development journey (`Phase 1` through `Phase 4`), including work packages, individual tasks (`T-<Phase>.<WP>.<Task>`), dependencies, required documentation, relevant source modules, acceptance criteria, verification evidence, exit conditions, current position, and completion definition.
2. **Current Project State Dashboard — [`docs/project-state/CURRENT.md`](docs/project-state/CURRENT.md):**
   - The **only** authoritative quick current-state dashboard.
   - Always points to the latest accepted checkpoint (`CP-NNN`), the next sequential checkpoint ID, and the exact current position (`Phase`, `Work Package`, and `Exact Next Task`) in `active-roadmap.md`.
   - Must **never** duplicate the full roadmap.
3. **Immutable Checkpoint History — [`docs/project-state/checkpoints/`](docs/project-state/checkpoints/README.md):**
   - Append-only ledger of historical snapshots of accepted milestones (`CP-001`, `CP-002`, `CP-003`, etc.).
   - Previous checkpoints must **never** be rewritten or edited to reflect newer progress. Each new accepted Work Package, separately accepted Increment, or Phase generates a new sequential checkpoint file.

---

## 2. Mandatory Continuous Update Protocol (Every Session)

### A. At the Beginning of Every Development or Audit Task
1. **Read [`docs/project-state/CURRENT.md`](docs/project-state/CURRENT.md)** to identify the latest accepted checkpoint, current phase, active work package, uncommitted working-tree state, and exact next task.
2. **Read the Latest Accepted Checkpoint** referenced in `CURRENT.md` (currently [`CP-001-2026-11-07-phase-a-closure.md`](docs/project-state/checkpoints/CP-001-2026-11-07-phase-a-closure.md)).
3. **Read the Relevant Section of [`docs/project-state/active-roadmap.md`](docs/project-state/active-roadmap.md)** (Sections 3, 4, 5, 6, and 7).
4. **Confirm Task Scope, Dependencies & Acceptance Criteria:** Verify against [`docs/architecture/decision-register.md`](docs/architecture/decision-register.md) and the canonical domain specification linked in [`docs/README.md`](docs/README.md). Do not start a task whose upstream dependency is incomplete unless explicitly authorized by the Owner.
5. **Identify the Exact Active Work Package & Task ID** (e.g., `WP-1.1` / `T-1.1.1`) before making any changes.

### B. During Task Execution (Status Transitions)
Maintain accurate work-package and task statuses in [`docs/project-state/active-roadmap.md`](docs/project-state/active-roadmap.md) (Section 5.2 & Section 6) using **only** the 9 canonical statuses:
- `NOT STARTED`
- `READY TO START`
- `IN PROGRESS`
- `BLOCKED`
- `IMPLEMENTED — VERIFICATION PENDING`
- `VERIFICATION IN PROGRESS`
- `COMPLETED AND ACCEPTED`
- `DEFERRED`
- `CANCELLED BY OWNER`

> **Strict Completion Rule:** Never mark a task or work package `COMPLETED AND ACCEPTED` merely because coding stopped. If code and tests are written while runtime test execution is deferred to Phase 4 (`Gate B`), use `IMPLEMENTED — VERIFICATION PENDING`. If a task is incomplete at the end of a turn, update its status (`IN PROGRESS` or `BLOCKED`) and record what remains without creating a completion checkpoint.

### C. After an Accepted Work Package, Increment, or Phase (Sequential Checkpoint Rule)
1. **Record the Actual Result:** Document the implementation or verification evidence in the canonical checklist/report.
2. **Update Status in [`docs/project-state/active-roadmap.md`](docs/project-state/active-roadmap.md):** Update Section 3 (Dashboard), Section 4 (Phase Status), Section 5.2 (Work Package & Task Table), and Section 6 (Current Position).
3. **Record Any Changed Dependencies or Deferred Items:** If any task is moved, deferred, or cancelled by the Owner, record the reason in Section 7 / Section 8 of `active-roadmap.md`. Never silently delete work.
4. **Update the Remaining Task Sequence** if justified by actual findings.
5. **Synchronize [`docs/project-state/CURRENT.md`](docs/project-state/CURRENT.md):** Update the live dashboard so it agrees 100% with Section 6 of `active-roadmap.md`.
6. **Create a New Sequential Immutable Checkpoint (at Every Accepted Work Package, Increment, or Phase):** Every successfully completed and accepted Work Package, separately accepted Increment, or Phase receives the next available sequential checkpoint ID (`CP-002`, `CP-003`, ...). Create `docs/project-state/checkpoints/CP-NNN-YYYY-MM-DD-<slug>.md` using the 20-field template in [`docs/project-state/checkpoints/README.md`](docs/project-state/checkpoints/README.md) and add it to the checkpoint index. When the final Work Package of a Phase (`WP-1.3`, `WP-2.4`, `WP-3.4`, `WP-4.4`) also closes its parent Phase, a single checkpoint records both the Work Package acceptance and the Phase closure. Never modify `CP-001` or any prior checkpoint.
7. **Identify the Exact Next Task:** Leave an unambiguous continuation point in both `active-roadmap.md` (Section 6) and `CURRENT.md` (Section 5) so the next session resumes immediately without re-auditing history.

---

## 3. Single Source of Truth & Architectural Guardrails

1. **One Canonical Location Per Domain (Link, Do Not Duplicate):**
   - Active Execution Plan: [`docs/project-state/active-roadmap.md`](docs/project-state/active-roadmap.md)
   - Quick Status Dashboard: [`docs/project-state/CURRENT.md`](docs/project-state/CURRENT.md)
   - Immutable Checkpoints: [`docs/project-state/checkpoints/`](docs/project-state/checkpoints/README.md)
   - Owner Decisions: [`docs/architecture/decision-register.md`](docs/architecture/decision-register.md)
   - System Architecture & Media Boundary (`D-MEDIA-01`): [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md)
   - Auth, Sessions, CSRF, Logout & Role Testing (`D-AUTH-01`, `S7`): [`docs/architecture/authentication-and-session-contract.md`](docs/architecture/authentication-and-session-contract.md)
   - Security, XSS & Role Invariants (`D-SEC-01`, `INV-R1`–`INV-R10`): [`docs/architecture/security-and-xss-baseline.md`](docs/architecture/security-and-xss-baseline.md)
   - Domain & Business Rules: [`docs/requirements/domain-business-rules.md`](docs/requirements/domain-business-rules.md)
   - Django + SQL Server Contract (`D-DB-01`): [`docs/backend/django-sqlserver-integration-contract.md`](docs/backend/django-sqlserver-integration-contract.md)
   - Verification & Test Strategy (`Gate B`): [`docs/project-state/verification-and-test-strategy.md`](docs/project-state/verification-and-test-strategy.md)
2. **Confirmed Tech Stack Only:**
   - **Frontend:** React 19, TypeScript 5.7, Vite, Tailwind CSS v4, Vitest, React Testing Library, MSW v2.
   - **Target Backend:** Python 3.12+, Django 5+, Django REST Framework, **Microsoft SQL Server** (`D-DB-01`).
   - **Prohibited:** PostgreSQL, GraphQL, browser JWT/Bearer tokens (`D-AUTH-01`), WebCrypto session encryption (`S8`), KMS/HSM/PKCS#11/JWKS anti-rollback infrastructure.
3. **Protected Historical & Working-Tree Files:**
   - Never modify or delete `legacy-reference/**`.
   - Never delete or rewrite historical reports (`docs/frontend/reports/*.md`), frozen baseline roadmaps (`docs/backend/pre-backend-migration-remediation-roadmap.md`, `docs/frontend/implementation-roadmap*.md`), or published checkpoints (`CP-001`, etc.).
   - Always preserve uncommitted working-tree changes (such as the 18 `frontend/src/` files from Phase 5 Increment 5.4).
