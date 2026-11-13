# MetroLMS — Standardized Engineering Authoring Templates (`docs/_templates`)

> **Document Title:** Engineering Documentation Template Library & Usage Guide  
> **Document Identifier:** `METROLMS-TPL-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 2 Documentation Standard  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Technical Writers, System Architects, Developers & QA Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), Decision D3 (Seven-Category Taxonomy)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Overview and Authoring Policy

The `docs/_templates/` directory provides the **20 Standardized Reusable Engineering Authoring Templates** required by the approved Master Documentation Program Plan (`DOC-PROG-2026-11-12-REV6`, Section 12.H).

Every document authored in subsequent documentation phases must be instantiated from one of these 20 templates. Authors must populate all required sections, maintain the standard 8-field metadata header block, and uphold the Two-Gate Quality Lifecycle (Gate A: Static Verification, Gate B: Technical & Integration Acceptance).

---

## 2. Complete Inventory of 20 Engineering Templates

| # | Template File | Domain Scope | Primary Category |
| :-: | :--- | :--- | :--- |
| 1 | [`BRD-template.md`](BRD-template.md) | Business Requirements Document | `01-requirements` |
| 2 | [`SRS-template.md`](SRS-template.md) | Software Requirements Specification | `01-requirements` |
| 3 | [`FRD-template.md`](FRD-template.md) | Functional Requirements Document | `01-requirements` |
| 4 | [`NFR-template.md`](NFR-template.md) | Non-Functional Requirements Specification | `01-requirements` |
| 5 | [`UseCase-template.md`](UseCase-template.md) | Use Case Specification across Roles | `01-requirements` |
| 6 | [`HLD-template.md`](HLD-template.md) | High-Level Architecture Design | `02-architecture-and-design` |
| 7 | [`LLD-template.md`](LLD-template.md) | Low-Level Component Design | `02-architecture-and-design` |
| 8 | [`ADR-template.md`](ADR-template.md) | Architecture Decision Record | `02-architecture-and-design` |
| 9 | [`DomainLogic-template.md`](DomainLogic-template.md) | Domain Business Rules Specification | `01-requirements`, `03-technical` |
| 10 | [`APISpec-template.md`](APISpec-template.md) | REST API Contract Specification | `03-technical-documentation` |
| 11 | [`DatabaseSpec-template.md`](DatabaseSpec-template.md) | Logical & SQL Server Physical Relational Design | `03-technical-documentation` |
| 12 | [`MasterTestPlan-template.md`](MasterTestPlan-template.md) | Master Verification & Test Plan | `04-testing` |
| 13 | [`TestCase-template.md`](TestCase-template.md) | Test Scenario & Verification Case | `04-testing` |
| 14 | [`TestExecutionReport-template.md`](TestExecutionReport-template.md) | Test Execution Evidence Report | `04-testing` |
| 15 | [`BugReport-template.md`](BugReport-template.md) | Defect & Invariant Violation Report | `04-testing` |
| 16 | [`UserManual-template.md`](UserManual-template.md) | Role-Based User Manual & Operating Guide | `05-user-documentation` |
| 17 | [`SOP-template.md`](SOP-template.md) | Standard Operating Procedure | `06-operations-and-maintenance` |
| 18 | [`DeploymentGuide-template.md`](DeploymentGuide-template.md) | Production Deployment Runbook | `06-operations-and-maintenance` |
| 19 | [`OperationalRunbook-template.md`](OperationalRunbook-template.md) | Operational Subsystem Runbook | `06-operations-and-maintenance` |
| 20 | [`RiskRegister-template.md`](RiskRegister-template.md) | Master Risk & Assumption Register (RAID) | `07-project-and-process` |

---

## 3. Special Structural Rules for `DatabaseSpec-template.md`

Per Owner directive, `DatabaseSpec-template.md` strictly enforces separation between engine-agnostic logical modeling and Microsoft SQL Server physical implementation guidelines:
- **Part 1 (Logical Design):** Engine-agnostic domain entities, value objects, Crow's foot entity-relationship models, cardinalities, data dictionary, business constraints, natural and conceptual candidate keys.
- **Part 2 (Physical SQL Server Design):** Microsoft SQL Server (`D-DB-01`) target connectors (`pyodbc`, `mssql-django`), T-SQL data types (`NVARCHAR(MAX)` vs `NVARCHAR(255)`, `DATETIMEOFFSET`, `DECIMAL(5,2)`), domain collation analysis (evaluating Arabic collations such as `Arabic_CI_AS` as illustrative options without assuming global defaults), explicit foreign key delete rules per relationship without global cascade defaults, clustered/non-clustered index strategy, optimistic locking concurrency, and Django Model migration guidelines.
