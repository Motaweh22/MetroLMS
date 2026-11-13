# MetroLMS — Architecture & Design Hub (`docs/02-architecture-and-design`)

> **Document Title:** Architecture & Design Hub Navigation Portal  
> **Document Identifier:** `METROLMS-ARCH-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 2 Architecture Specification Hub  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architects, Backend/Frontend Leads & Technical Reviewers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Purpose & Scope

The `docs/02-architecture-and-design/` directory contains all architectural and design specifications governing the MetroLMS platform. It covers high-level system topology, low-level component lifecycles, architecture decision records (ADRs), conceptual data models, and security baselines.

---

## 2. Directory Structure & Subsystems

```text
docs/02-architecture-and-design/
├── README.md                      # This Navigation Hub
├── hld/                           # High-Level Architecture Designs (Topology, Tech Stack, DMZ)
├── lld/                           # Low-Level Component & State Designs (Session machine, diffing)
├── adr/                           # Architecture Decision Records (Architectural choices & trade-offs)
├── data-models/                   # Conceptual & Logical Data Models (Entity relationships, ERDs)
└── security/                      # Security Architecture Baselines (XSS, Session, CSRF, RBAC)
```

> [!NOTE]
> During Phase 0 scaffolding (Option A), empty leaf directories are tracked and preserved in Git via `.gitkeep` placeholders. Formal specification documents will be authored in subsequent execution phases.
> Existing canonical architecture baselines remain active at:
> - [`docs/architecture/system-architecture.md`](../architecture/system-architecture.md)
> - [`docs/architecture/authentication-and-session-contract.md`](../architecture/authentication-and-session-contract.md)
> - [`docs/architecture/security-and-xss-baseline.md`](../architecture/security-and-xss-baseline.md)

---

## 3. Subsystem Breakdown and Templates

All design documents authored within this category must strictly conform to the approved templates in [`docs/_templates/`](../_templates/README.md):

| Subdirectory | Target Deliverable Type | Mandatory Template |
| :--- | :--- | :--- |
| `hld/` | High-Level Design Documents | [`HLD-template.md`](../_templates/HLD-template.md) |
| `lld/` | Low-Level Component Specifications | [`LLD-template.md`](../_templates/LLD-template.md) |
| `adr/` | Architecture Decision Records | [`ADR-template.md`](../_templates/ADR-template.md) |
| `data-models/` | Conceptual & Logical Data Models | [`DatabaseSpec-template.md`](../_templates/DatabaseSpec-template.md) (Part 1 Logical) |
| `security/` | Security Baselines & Protocols | [`HLD-template.md`](../_templates/HLD-template.md), [`SOP-template.md`](../_templates/SOP-template.md) |

---

## 4. Confirmed Architectural Boundaries

1. **Tech Stack Invariant:** Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4. Target Backend: Python 3.12+ + Django 5 + Django REST Framework + **Microsoft SQL Server** (`D-DB-01`).
2. **Session Security Invariant:** HTTP-only cookies (`D-AUTH-01`), server-side session management. No browser JWT storage or Bearer tokens.
3. **Media Integration Boundary:** Direct client streaming from enterprise storage (`D-MEDIA-01`). Media payloads never traverse the core application server.
