# MetroLMS — Documentation Governance Hub (docs/00-governance)

> **Document Title:** Documentation Governance Hub Navigation Index  
> **Document Identifier:** METROLMS-GOV-HUB-000  
> **Document Status:** ACTIVE — AUTHORITATIVE  
> **Canonical Authority Level:** Level 2 Architecture & Governance Hub Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Project Owner, AI Coding Agents & System Engineers  
> **Governing Decisions:** [D-AUTH-01](../architecture/decision-register.md#d-auth-01), [D-DB-01](../architecture/decision-register.md#d-db-01), [D-SEC-01](../architecture/decision-register.md#d-sec-01), Documentation Program Decisions D1–D6  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Mission and Purpose

The docs/00-governance/ directory serves as the dedicated operational governance portal for the MetroLMS documentation ecosystem. It defines the formal rules, decision boundaries, authority hierarchy, and update protocols that govern how documentation is created, modified, verified, and linked throughout the system lifecycle.

This directory operates in strict subordination to the repository-level master governance documents:
- **Root Operating Instructions:** [AGENTS.md](../../AGENTS.md) (Level 1 Developer & Agent Operating Instructions)
- **Master Decision Register:** [docs/architecture/decision-register.md](../architecture/decision-register.md) (Level 1 Master Owner Decision Register)
- **Active Living Roadmap:** [docs/project-state/active-roadmap.md](../project-state/active-roadmap.md) (Level 3 Active Execution Plan)
- **Live Status Dashboard:** [docs/project-state/CURRENT.md](../project-state/CURRENT.md) (Level 2 Current State Dashboard)

---

## 2. Directory Contents

| Document | Identifier | Authority Level | Canonical Role |
| :--- | :--- | :--- | :--- |
| [AGENTS.md](AGENTS.md) | METROLMS-GOV-AGENTS-001 | Level 2 | Scoped Documentation Authoring & Maintenance Instructions for Human & AI Agents |
| [decision-register.md](decision-register.md) | METROLMS-GOV-DEC-002 | Level 2 | Documentation Program Decision Register (Decisions D1–D6) |
| [documentation-authority-hierarchy.md](documentation-authority-hierarchy.md) | METROLMS-GOV-AUTH-003 | Level 2 | Comprehensive 7-Level Documentation Authority Order & Conflict Resolution Standard |
| [continuous-update-protocol.md](continuous-update-protocol.md) | METROLMS-GOV-SYNC-004 | Level 2 | Continuous Update & Traceability Synchronization Protocol across Engineering Lifecycles |

---

## 3. Seven-Category Documentation Taxonomy

The canonical docs/ repository root organizes knowledge into seven primary categories plus supporting directories:

`	ext
docs/
├── 00-governance/                   # SUPPORTING: Scoped Documentation Governance & Authority
├── 01-requirements/                 # PRIMARY 01: Business, System, Functional Requirements & Use Cases
├── 02-architecture-and-design/      # PRIMARY 02: High-Level & Low-Level Architecture, ADRs, Security Baselines
├── 03-technical-documentation/      # PRIMARY 03: Engineering Specifications, Domain Specs, API & Database Contracts
├── 04-testing/                      # PRIMARY 04: Master Test Plans, Test Cases, Suites & Execution Evidence
├── 05-user-documentation/           # PRIMARY 05: Role-Based User Manuals & Operational Incident Triage
├── 06-operations-and-maintenance/   # PRIMARY 06: Environment Setup, Deployment Runbooks, Monitoring & SOPs
├── 07-project-and-process/          # PRIMARY 07: Living Roadmaps, Documentation Checkpoints & RAID Log
└── _templates/                      # SUPPORTING: 20 Standardized Reusable Engineering Authoring Templates
`

---

## 4. Fundamental Operating Invariants

1. **Passive Scaffolding Invariant:** Phase 0 initializes directory structures, navigation portals, and templates without moving or modifying any historical documentation or codebase files.
2. **Authority Primacy:** Level 1 Owner Decisions recorded in [docs/architecture/decision-register.md](../architecture/decision-register.md) override all lower-level documentation.
3. **Template Conformance:** All new engineering documentation authored in subsequent phases must use the corresponding template from [docs/_templates/](../_templates/README.md).
4. **Working-Tree Protection:** Application source code, tests, schemas, migrations, and active uncommitted files under rontend/src/ are permanently protected from documentation workflow mutations.
