# MetroLMS — High-Level Architecture Design (HLD)
## System / Subsystem: [Subsystem Name]

> **Document Title:** [HLD Title]  
> **Document Identifier:** `METROLMS-HLD-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 2 Architecture Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architects, Technical Leads, Security Officers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../architecture/decision-register.md#d-media-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Architectural Mission & Context
- **Purpose:** [Broad structural design of the subsystem within MetroLMS].
- **Architectural Drivers:** [Performance, security, maintainability, SQL Server compatibility].

## 2. System Topology & Tier Decomposition
```mermaid
flowchart TD
    Client["React 19 Client (Vite, TS)"] -->|HTTPS / Secure Cookies| Gateway["Reverse Proxy / Web Server"]
    Gateway -->|WSGI| AppServer["Django 5 REST Backend"]
    AppServer -->|pyodbc / mssql-django| Database[("Microsoft SQL Server (D-DB-01)")]
    Client -->|Direct Stream (D-MEDIA-01)| MediaStorage["Enterprise Media Storage / CDN"]
```

## 3. Subsystem Components & Responsibilities
| Component Name | Tier | Primary Responsibilities | Dependencies |
| :--- | :--- | :--- | :--- |
| **Frontend Presentation** | Client Tier | React views, state, routing, design tokens | REST Backend |
| **API Service Layer** | App Tier | Business validation, transaction orchestration | Database Tier |
| **Persistence Layer** | DB Tier | SQL Server tables, constraints, indexes | pyodbc |

## 4. Cross-Cutting Concerns
- **Authentication & Sessions (`D-AUTH-01`):** Server-side sessions, secure cookie transport.
- **Security & Authorization (`D-SEC-01`):** 3-layer permission resolution engine.
- **Media Ingestion & Streaming (`D-MEDIA-01`):** App server isolation from media payloads.

## 5. Technology Stack & Deployment Topology
- **Operating System:** Windows Server / Linux enterprise distribution.
- **Runtime Environment:** Python 3.12+, Node.js 20+ (build only).
- **Database Engine:** Microsoft SQL Server Standard / Enterprise (`D-DB-01`).
