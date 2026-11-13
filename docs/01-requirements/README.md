# MetroLMS — Requirements Documentation Hub (`docs/01-requirements`)

> **Document Title:** Requirements Documentation Hub Navigation Portal  
> **Document Identifier:** `METROLMS-REQ-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 4 Requirements Specification Hub  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Requirements Engineers, System Architects, Developers & Product Owners  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), [`D-01`–`D-14`](../architecture/decision-register.md#d-01)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Purpose & Scope

The `docs/01-requirements/` directory houses the complete requirements specifications for the MetroLMS enterprise training system. It captures business goals, user personas, functional workflows, non-functional constraints, and invariant domain rules governing Egyptian Company for Metro Management and Operation training operations.

---

## 2. Directory Structure & Subsystems

```text
docs/01-requirements/
├── README.md                      # This Navigation Hub
├── brd/                           # Business Requirements Documents (Organizational goals & scope)
├── srs/                           # Software Requirements Specifications (IEEE 830 functional & NFR)
├── frd/                           # Functional Requirements Documents (Decomposed by subsystem)
├── use-cases/                     # Use Case Catalog across 6 MetroLMS user roles
└── domains/                       # Domain Business Rules Specifications (Invariants INV-R1..R10, etc.)
```

> [!NOTE]
> During Phase 0 scaffolding (Option A), empty leaf directories are tracked and preserved in Git via `.gitkeep` placeholders. Formal specification documents will be authored in subsequent execution phases.
> Existing canonical business rules remain accessible at [`docs/requirements/domain-business-rules.md`](../requirements/domain-business-rules.md).

---

## 3. Subsystem Breakdown and Templates

All requirements authored within this category must strictly conform to the approved authoring templates in [`docs/_templates/`](../_templates/README.md):

| Subdirectory | Target Deliverable Type | Mandatory Template |
| :--- | :--- | :--- |
| `brd/` | Business Requirements Documents | [`BRD-template.md`](../_templates/BRD-template.md) |
| `srs/` | System Requirements Specifications | [`SRS-template.md`](../_templates/SRS-template.md), [`NFR-template.md`](../_templates/NFR-template.md) |
| `frd/` | Subsystem Functional Specifications | [`FRD-template.md`](../_templates/FRD-template.md) |
| `use-cases/` | Role-Based Use Cases | [`UseCase-template.md`](../_templates/UseCase-template.md) |
| `domains/` | Domain Invariant Rules | [`DomainLogic-template.md`](../_templates/DomainLogic-template.md) |

---

## 4. Authority and Traceability

Requirements in this directory represent **Level 4 Specifications**. They are subordinate to:
1. Level 1 Master Owner Decisions: [`docs/architecture/decision-register.md`](../architecture/decision-register.md)
2. Level 2 Canonical System Architecture: [`docs/architecture/system-architecture.md`](../architecture/system-architecture.md)
