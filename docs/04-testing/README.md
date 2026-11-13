# MetroLMS — Testing & Quality Assurance Hub (`docs/04-testing`)

> **Document Title:** Testing & Quality Assurance Hub Navigation Portal  
> **Document Identifier:** `METROLMS-TEST-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 6 Verification & Quality Assurance Hub  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** QA Engineers, Test Automation Developers & Quality Auditing Leads  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Purpose & Scope

The `docs/04-testing/` directory organizes the entire testing, verification, and quality assurance framework for MetroLMS. It encompasses master test plans, formal test cases, physical regression test suite inventories, execution reports, and historical checklist archives.

---

## 2. Directory Structure & Subsystems

```text
docs/04-testing/
├── README.md                      # This Navigation Hub
├── test-plans/                    # Domain & Phase Test Plans (Scope, objectives, pass criteria)
├── test-cases/                    # Formal Test Case Catalog (Step-by-step test specifications)
├── test-suites/                   # Physical Regression Test Suite Inventory (Vitest, Pytest, E2E)
├── execution-reports/             # Formal Verification Evidence (Gate A / Gate B execution logs)
└── historical-checklists/         # Prospective Archive for Historical Checklists (Phase 0: .gitkeep)
```

> [!NOTE]
> During Phase 0 scaffolding (Option A), empty leaf directories are tracked and preserved in Git via `.gitkeep` placeholders. Formal specification documents will be authored in subsequent execution phases.
> Existing historical checklists (21 files) remain preserved in place at [`docs/frontend/checklists/`](../frontend/checklists/README.md).

---

## 3. Subsystem Breakdown and Templates

All quality assurance documents authored within this category must strictly conform to the approved templates in [`docs/_templates/`](../_templates/README.md):

| Subdirectory | Target Deliverable Type | Mandatory Template |
| :--- | :--- | :--- |
| `test-plans/` | Master & Subsystem Test Plans | [`MasterTestPlan-template.md`](../_templates/MasterTestPlan-template.md) |
| `test-cases/` | Formal Scenario Test Cases | [`TestCase-template.md`](../_templates/TestCase-template.md) |
| `test-suites/` | Automated Test Suite Catalogs | [`MasterTestPlan-template.md`](../_templates/MasterTestPlan-template.md) |
| `execution-reports/` | Test Execution & Verification Evidence | [`TestExecutionReport-template.md`](../_templates/TestExecutionReport-template.md), [`BugReport-template.md`](../_templates/BugReport-template.md) |

---

## 4. Verification Framework

The platform testing lifecycle enforces a **Two-Gate Verification Strategy**:
- **Gate A (Static & Mocked In-Memory Verification):** Component rendering, route guards, permission resolvers, and mocked API responses via MSW v2 and Vitest.
- **Gate B (Real-Time Backend & Database Verification):** Full integration verification against running Django REST Framework and Microsoft SQL Server instances.
