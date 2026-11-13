# MetroLMS — High-Level Architecture Design (HLD)
## Subsystem / Scope: Master System Topology & Network Tiers

> **Document Title:** Master System Topology, Network Tiers & Operational Boundaries  
> **Document Identifier:** `METROLMS-HLD-ARCH-001`  
> **Document Status:** `ACTIVE — AUTHORITATIVE BASELINE`  
> **Canonical Authority Level:** Level 2 Architecture Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architects, DevOps Leads, Security Officers  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Architectural Mission & Context

### 1.1 Purpose
This document specifies the multi-tier system topology, network boundaries, and component interactions governing the deployment of MetroLMS across Cairo Metro corporate infrastructure. It establishes strict separation between presentation, application logic, relational persistence, and media delivery.

### 1.2 Core Architectural Principles
1. **Engine Invariance (`D-DB-01`):** Microsoft SQL Server is the sole relational database engine.
2. **Session Security (`D-AUTH-01`):** Server-side sessions; HttpOnly/Secure cookies; zero browser JWTs.
3. **Media Decoupling (`D-MEDIA-01`):** Raw video binaries stream directly from enterprise storage; application server handles only metadata.
4. **Defense-in-Depth (`D-SEC-01`):** Strict DMZ boundary, reverse proxy SSL/TLS termination, and centralized DOMPurify HTML sanitization.

---

## 2. System Topology & Tier Decomposition

```mermaid
flowchart TD
    subgraph ClientTier["Client Presentation Tier (Browser Runtime)"]
        SPA["React 19 SPA (TypeScript, Vite, Tailwind CSS v4)"]
        Player["HTML5 Video Player (Byte-Range Streaming)"]
    end

    subgraph EdgeTier["DMZ & Gateway Tier"]
        Proxy["Reverse Proxy / SSL Termination Gateway (Nginx / IIS)"]
    end

    subgraph AppTier["Application Logic Tier"]
        WSGI["WSGI App Server (Gunicorn / Waitress)"]
        Django["Django 5 + Django REST Framework"]
        AuthModule["Session & Identity Manager (D-AUTH-01)"]
        PermEngine["3-Layer Permission Engine (INV-R1..R10)"]
        DomainServices["Domain Services (Curriculum, Groups, Certificates)"]
    end

    subgraph DatabaseTier["Enterprise Relational Persistence Tier"]
        SQLServer[("Microsoft SQL Server 2022+ Standard (D-DB-01)")]
        RCSI["Read Committed Snapshot Isolation (RCSI)"]
    end

    subgraph MediaTier["Decoupled Media Storage Tier (D-MEDIA-01)"]
        MediaStorage["Enterprise Media Storage / CDN Endpoint"]
    end

    %% Network Flows
    SPA -->|HTTPS / HttpOnly Cookie + CSRF| Proxy
    Proxy -->|Local Reverse Proxy Pass| WSGI
    WSGI --> Django
    Django --> AuthModule
    Django --> PermEngine
    Django --> DomainServices
    Django -->|pyodbc / mssql-django (ODBC Driver 18)| SQLServer
    SQLServer --- RCSI
    Player -.->|Direct Signed URL Streaming (HTTP 206)| MediaStorage
    Django -.->|Pre-Signed Streaming URL Generation| MediaStorage
```

---

## 3. Subsystem Components & Responsibilities

| Tier Name | Component Name | Technology Baseline | Core Responsibilities |
| :--- | :--- | :--- | :--- |
| **Client Tier** | Frontend SPA | React 19, TypeScript 5.7, Vite | Responsive UI rendering, RTL Arabic support, client route guards, design system tokens. |
| **Gateway Tier** | Reverse Proxy Gateway | Evaluated Option: Nginx / IIS | TLS 1.3 termination, HTTP compression, static frontend bundle delivery, request routing. |
| **App Tier** | Django REST Backend | Python 3.12+, Django 5, DRF | Session authentication, role resolution, transactional domain logic, audit attribution. |
| **Database Tier**| Relational Persistence | Microsoft SQL Server 2022+ | Relational data integrity, foreign key cascades, transaction atomicity, TDE encryption. |
| **Media Tier** | Enterprise Storage | Object Store / Dedicated NAS | Decoupled high-throughput streaming of video lessons directly to trainee clients (`D-MEDIA-01`). |

---

## 4. Cross-Cutting Architectural Boundaries

### 4.1 Authentication & Session Boundary (`D-AUTH-01`, `ADR-001`)
- Sessions are stateful on the server and identified by a cryptographically random `sessionid` cookie.
- Cookies are marked `HttpOnly`, `Secure`, `SameSite=Lax`.
- Mutation requests require an `X-CSRFToken` header matching the active CSRF session cookie.

### 4.2 Media Integration Boundary (`D-MEDIA-01`, `ADR-004`)
- Application servers **never** buffer or proxy video binary streams.
- The Django backend validates access permissions and issues signed or direct media streaming URLs.
- The browser client connects directly to the media endpoint for byte-range playback (`HTTP 206 Partial Content`).

### 4.3 Security & Role Ceiling Boundary (`D-SEC-01`, `ADR-003`)
- All user-generated rich text routes through DOMPurify sanitization before DOM mounting.
- 3-layer capability resolution engine enforces strict permission boundaries across all 6 roles.

---

## 5. Hosting Infrastructure & Deployment Evaluation (Deferred to Phase 7)

> [!NOTE]
> **Hosting Evaluation Status (`D4` / Decision 9):**  
> In accordance with REV6 Section 12.M (Decision 9), production operating system and web server hosting choices are **formally maintained as evaluated options deferred to Phase 7 (Operations & Deployment)**:
> - **Operating System Options:** Windows Server 2022 vs. Enterprise Linux (RHEL / Ubuntu LTS).
> - **Web Server / Reverse Proxy Options:** Microsoft IIS vs. Nginx.
> - **WSGI Server Options:** Waitress (Windows native) vs. Gunicorn (Linux native).
> 
> Both architectural variants are fully supported by Python 3.12, Django 5, and the Microsoft ODBC Driver 18 for SQL Server. Final selection will be determined during Phase 7 operational staging based on Cairo Metro IT infrastructure facilities.
>
> **Approved Background Renewal Execution (`API-REC-01` & `Domain 20 / D4` — `OWNER APPROVED`, `2026-11-13`):** Initial production automatic renewal execution uses **Windows Server -> Windows Task Scheduler -> planned Django Management Command (`process_due_group_renewals`, not yet implemented) -> Django Renewal Services -> Microsoft SQL Server**. Celery, Celery Beat, Redis, RabbitMQ, and SQL Server Agent are explicitly not required in the initial approved architecture.
