# MetroLMS — Continuous Update Protocol (`docs/00-governance/continuous-update-protocol.md`)

> **Document Title:** Continuous Documentation Update & Traceability Protocol  
> **Document Identifier:** `METROLMS-GOV-SYNC-004`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 2 Operational Governance Protocol (Governed by [`docs/architecture/decision-register.md`](../architecture/decision-register.md))  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Project Owner, AI Coding Agents & System Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), Documentation Program Decisions D1–D6  
> **Last Updated:** 2026-11-12 (Phase 0 Scaffolding)

---

## 1. Objective and Mandate

The **Continuous Update Protocol** defines the mandatory procedures for keeping technical documentation, requirements, architecture models, and verification evidence synchronized with codebase implementations across every engineering lifecycle stage.

Documentation in MetroLMS is an active engineering deliverable, not an afterthought. Whenever code is modified, documentation must be reviewed and updated concurrently before task acceptance.

---

## 2. Lifecycle Trigger Events

Documentation updates are mandatory whenever any of the following events occur:

| Trigger Event | Affected Documentation Scope | Verification Responsibility |
| :--- | :--- | :--- |
| **New API Endpoint or Contract Change** | `docs/03-technical-documentation/api/` | Verify schema against serializers/handlers; update request/response examples. |
| **Database Schema or Model Change** | `docs/03-technical-documentation/database/` | Update logical entity model and physical SQL Server guidelines (`D-DB-01`). |
| **Domain Logic or Rule Change** | `docs/01-requirements/domains/`, `docs/03-technical-documentation/domains/` | Reconcile with Level 1 Decision Register and invariant tests. |
| **New Test Suite or Quality Evidence** | `docs/04-testing/` | Record test suite inventory, execution logs, and coverage reports. |
| **Operational or Deployment Update** | `docs/06-operations-and-maintenance/` | Update runbooks, environment flags, and SOP step sequences. |
| **Milestone or Work Package Acceptance** | `docs/project-state/` or `docs/07-project-and-process/` | Update active roadmap, live dashboard, and create sequential checkpoint. |

---

## 3. Four-Step Synchronization Procedure

### Step 1: Pre-Implementation Scope Confirmation
- Review existing documentation related to the target component.
- Confirm authority level and governing decisions.
- Identify all documents that will be impacted by the planned code changes.

### Step 2: Concurrent Documentation Authoring
- Author or update technical specifications alongside code commits.
- Ensure all new documents conform to the 20 standardized templates in [`docs/_templates/`](../_templates/README.md).
- Populate the standard 8-field metadata block.

### Step 3: Gate A Static Verification
- Execute a static link verification script across the documentation repository.
- Ensure zero broken links or missing anchors are introduced.
- Validate markdown syntax and KaTeX formula delimiters.

### Step 4: Gate B Acceptance and Checkpoint Ledger Recording
- Confirm code and documentation alignment during formal verification.
- Update [`docs/project-state/active-roadmap.md`](../project-state/active-roadmap.md) and [`docs/project-state/CURRENT.md`](../project-state/CURRENT.md) (or the documentation checkpoint namespace for documentation milestones).
- Create the next sequential immutable checkpoint file.

---

## 4. Anti-Drift Invariants

1. **No Orphan Code:** Every newly authored business domain service or API endpoint must trace to a specification in `docs/03-technical-documentation/`.
2. **No Phantom Specs:** Specifications describing implemented features must reflect actual running code, verified by Gate B tests.
3. **Immutable History:** Never edit past checkpoints or historical audit reports to reflect current state. Always record changes in a new sequential checkpoint.
