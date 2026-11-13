# MetroLMS — Technical Specifications Hub (`docs/03-technical-documentation`)

> **Document Title:** Technical Specifications Hub Navigation Portal  
> **Document Identifier:** `METROLMS-TECH-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 3 Technical Specification Hub  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Database Administrators & Integrators  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Purpose & Scope

The `docs/03-technical-documentation/` directory contains detailed engineering specifications, component architecture documents, domain-by-domain tripartite implementation specs, canonical REST API contracts, and database schema implementation runbooks for MetroLMS.

---

## 2. Directory Structure & Subsystems

```text
docs/03-technical-documentation/
├── README.md                      # This Navigation Hub
├── frontend/                      # Frontend Engineering Specs (State, Design System, Errors)
├── backend/                       # Target Backend Specifications (Django/DRF contracts & patterns)
├── domains/                       # Tripartite Domain Technical Specifications
│   ├── auth/                      # Authentication & Session Engine
│   ├── courses/                   # Curriculum Builder & Versioning Engine
│   ├── groups/                    # Groups, Renewals & In-Place Progression
│   ├── progress/                  # Progress Calculator & Attempt Isolation
│   └── certificates/              # Certificate Generator & QR Verification
├── api/                           # Canonical REST API Contracts & Endpoint Schemas
├── database/                      # Relational Database Design & Provisioning Runbooks
│   └── legacy-postgres-reference/ # Prospective Archive for Legacy Postgres Schema (Phase 0: .gitkeep)
└── integrations/                  # External Services & Infrastructure Contracts
```

> [!NOTE]
> During Phase 0 scaffolding (Option A), empty leaf directories are tracked and preserved in Git via `.gitkeep` placeholders. Formal specification documents will be authored in subsequent execution phases.
> Existing technical baselines remain active at:
> - [`docs/frontend/architecture.md`](../frontend/architecture.md)
> - [`docs/frontend/design-system.md`](../frontend/design-system.md)
> - [`docs/backend/django-sqlserver-integration-contract.md`](../backend/django-sqlserver-integration-contract.md)
> - Legacy PostgreSQL Draft remains preserved in place at [`docs/backend/database-schema.md`](../backend/database-schema.md).

---

## 3. Subsystem Breakdown and Templates

All engineering documents authored within this category must strictly conform to the approved templates in [`docs/_templates/`](../_templates/README.md):

| Subdirectory | Target Deliverable Type | Mandatory Template |
| :--- | :--- | :--- |
| `frontend/`, `backend/` | Technical System Specifications | [`HLD-template.md`](../_templates/HLD-template.md), [`LLD-template.md`](../_templates/LLD-template.md) |
| `domains/*/` | Domain Technical Specifications | [`DomainLogic-template.md`](../_templates/DomainLogic-template.md), [`LLD-template.md`](../_templates/LLD-template.md) |
| `api/` | Canonical API Contracts | [`APISpec-template.md`](../_templates/APISpec-template.md) |
| `database/` | Logical & SQL Server Database Specs | [`DatabaseSpec-template.md`](../_templates/DatabaseSpec-template.md) (Part 1 & Part 2) |
| `integrations/` | External System Interfaces | [`APISpec-template.md`](../_templates/APISpec-template.md), [`HLD-template.md`](../_templates/HLD-template.md) |
