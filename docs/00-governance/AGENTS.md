# MetroLMS — Scoped Documentation Authoring Guidelines (docs/00-governance/AGENTS.md)

> **Document Title:** Scoped Documentation Authoring Guidelines for Developers and AI Agents  
> **Document Identifier:** METROLMS-GOV-AGENTS-001  
> **Document Status:** ACTIVE — AUTHORITATIVE  
> **Canonical Authority Level:** Level 2 Governance Specification (Governed by [docs/architecture/decision-register.md](../architecture/decision-register.md))  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Human Developers, Technical Writers & AI Coding Agents  
> **Governing Decisions:** [D-AUTH-01](../architecture/decision-register.md#d-auth-01), [D-DB-01](../architecture/decision-register.md#d-db-01), [D-SEC-01](../architecture/decision-register.md#d-sec-01), Documentation Program Decisions D1–D6  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Scope and Relationship to Repository AGENTS.md

This document provides **specialized authoring instructions** for creating, editing, and verifying technical documentation within the docs/ tree.

- **Master Codebase Operating Guide:** [AGENTS.md](../../AGENTS.md) at the repository root remains the master operating standard for all software development, test execution, checkpoint creation, and three-tier project state governance.
- **Scope Boundary:** This file governs documentation-specific behaviors, template selection, header conventions, link formatting, and markdown semantics. It must **never** conflict with or duplicate root AGENTS.md.

---

## 2. Standard 8-Field Metadata Header Requirement

Every Markdown document authored within docs/ (excluding template files themselves) must commence with the standardized 8-field metadata block:

`markdown
# [Document Title]

> **Document Title:** [Full Descriptive Title]  
> **Document Identifier:** [METROLMS-CAT-CODE-NNN]  
> **Document Status:** [DRAFT / REVIEW / APPROVED / HISTORICAL]  
> **Canonical Authority Level:** Level [1–7] ([Authority Name])  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** [Target Audience / Stakeholders]  
> **Governing Decisions:** [D-XXX-NN](../architecture/decision-register.md#d-xxx-nn)  
> **Last Updated:** YYYY-MM-DD ([Context / Milestone])
`

---

## 3. Template Usage and Authoring Rules

1. **Mandatory Template Inheritance:** Every new document must be instantiated from the corresponding template in [docs/_templates/](../_templates/README.md).
2. **Database Specifications (DatabaseSpec-template.md):** Must maintain strict separation between:
   - **Part 1: Logical Database Design** (engine-agnostic entity relationships, conceptual data dictionary).
   - **Part 2: Physical Microsoft SQL Server Schema Guidelines** (D-DB-01 compliant, pyodbc/mssql-django, indexing, collation).
3. **User Manuals (UserManual-template.md):** Must be authored per distinct role (Trainee, Instructor, Supervisor/Assistant Admin, Administrator).
4. **Operations & SOPs:** Operational runbooks and SOPs must include prerequisites, command sequences, rollback instructions, and verification evidence requirements.

---

## 4. Two-Gate Quality & Verification Lifecycle

All newly created or substantially revised documentation must pass the **Two-Gate Quality Lifecycle**:

- **Gate A — Structural, Template & Static Link Verification:**
  - Standard 8-field metadata block present and complete.
  - Template sections and required structural elements populated.
  - Zero broken links (all referenced relative paths and anchors resolve).
  - Clean markdown syntax and valid KaTeX formulas.
- **Gate B — Technical Review, Traceability & Owner Acceptance:**
  - Technical accuracy verified against confirmed application architecture (D-DB-01, D-AUTH-01, D-SEC-01).
  - Bidirectional traceability mapped to requirements, architecture, and source code.
  - Formal Owner acceptance or milestone checkpoint signoff.

---

## 5. Markdown Formatting and Link Standards

1. **Clickable Links:** All references to files in the repository must use GitHub-style Markdown links formatted with the ile:/// scheme and forward slashes (e.g., [system-architecture.md](../architecture/system-architecture.md)).
2. **KaTeX Math Formatting:**
   - Inline math: $formula$ or \(formula\).
   - Display math: $ on its own line.
   - Escape literal dollar signs in prose as \$ (e.g., \).
3. **No Phantom Links:** Never link to a planned document that does not yet exist. Link to the relevant category navigation README.md until the target document is formally authored and accepted.

---

## 6. Protection of Historical Baselines and Working-Tree State

1. **Zero Relocation of Historical Documents:** Do not move, rename, or delete historical reports (docs/frontend/reports/), historical checklists (docs/frontend/checklists/), or transcripts (docs/archive/transcripts/).
2. **Working-Tree Isolation:** Never alter, reset, or discard uncommitted changes in rontend/src/ during documentation workflows.
