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
1. **Media Decoupling (`D-MEDIA-01`):** Logical media references and Storage Abstraction decouple business logic/APIs from physical storage; Phase 1 uses Django-mediated session-authenticated streaming, while direct client streaming (`ADR-004`) via `CL-03` signed URLs is preserved as the future delivery direction.
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
        MediaStorage["Decoupled Media Storage & Delivery Tier<br/>(Provider / Delivery Mechanism DEFERRED under API-REC-06)"]
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
    Player -.->|Phase 1: Django-Mediated Auth Stream / Future: Direct Signed URL (CL-03 Deferred)| MediaStorage
    Django -.->|Phase 1: Storage Abstraction Stream / Future: Signed URL Issuance (CL-03)| MediaStorage
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

### 4.2 Media Integration Boundary (`D-MEDIA-01`, `ADR-004`, `CL-02`, `CL-03` & `API-REC-06`)
- **Phase 1 Media Delivery (`OWNER APPROVED`, `2026-11-13`):** Initial production uses **Django-mediated, session-authenticated media delivery**: trainee requests media -> Django authenticates (`D-AUTH-01`) -> Django independently validates `D-SEC-01` authorization (enrollment, group membership, visibility, cycle access) -> Django retrieves via the Storage Abstraction (private storage, stable asset IDs; public physical paths, SMB shares, and unauthenticated URLs prohibited) -> Django streams the response, preserving HTTP `Range`, `206 Partial Content`, `416`, repeated Range requests, and native seeking (with authorization on Range requests; not yet implemented/verified). No separate Media Delivery Service is required in Phase 1 (and no Starlette, Uvicorn, ASP.NET Core, S3, MinIO, CDN, Redis, Celery, or silent ASGI change is introduced). **Known Risk:** Media transfer passes through Django app infrastructure, increasing worker occupancy, bandwidth consumption, and resource pressure under concurrent video playback; throughput/capacity assumptions must not be invented and require representative concurrent workload validation.
- **Initial Storage Deployment Direction (`INV-DOM21-06` — `OWNER APPROVED — INITIAL STORAGE DEPLOYMENT DIRECTION`, `2026-11-13`):** Initial production deployment uses a dedicated media storage location on the existing Windows Server hosting Django and SQL Server, logically and operationally separated from application source/deployment, logs/temp runtime, and SQL Server data/transaction-log directories (illustrative example only: `D:\MetroLMSMedia\`; actual drive/path confirmed during deployment planning). Access MUST go through the Storage Abstraction (`INV-DOM21-05`, `INV-DOM21-06`) so future migration to a separate Media Server requires zero changes to business logic, logical asset IDs, or core API contracts. Exact disk allocation, capacity, backup/retention, DR design, AV scanning, and the future server's exact role remain unapproved/unverified.
- **Network Exposure (`CL-02` — `OWNER APPROVED`, `2026-11-13`):** Authorized platform and media access must support both Cairo Metro's internal corporate network and external internet access (home/mobile devices) securely over HTTPS with Django session/authorization enforcement—never exposing Windows file shares, SMB paths, or physical storage locations, and without approving public buckets, public binary URLs, or a CDN.
- **Future `CL-03` Signed-URL Direction (`OWNER APPROVED`, `2026-11-13` — Implementation Deferred):** Short-Lived Signed URLs and `ADR-004` direct client streaming (bypassing Django WSGI) remain preserved as the **future** media authorization and delivery direction when measured traffic/performance justifies a separate media delivery layer (bearer-expiry limits apply; distinct from Google Drive `Anyone with the link` external references).
- **Deferred Delivery & Technical Details (`API-REC-06` remains `DEFERRED`):** Signed URL implementation & `CL-03` technical details (exact TTL, signature algorithm/key management/rotation, URL scope, Range reuse, replay mitigation, delivery validation, post-change invalidation, external streaming ops), separate delivery server (IIS, Nginx, S3, MinIO), CDN, malware scanning, production size limits, chunked upload, and backup/retention remain **`DEFERRED`** under `API-REC-06`.

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
> **Approved Background Renewal Execution (`API-REC-01` & `Domain 20 / D4` — `OWNER APPROVED`, `2026-11-13`):** Initial production automatic renewal execution uses **Windows Server -> Windows Task Scheduler (every 6 hours) -> planned Django Management Command (`process_due_group_renewals`, not yet implemented) -> Django Renewal Services -> Microsoft SQL Server**. Celery, Celery Beat, Redis, RabbitMQ, and SQL Server Agent are explicitly not required in the initial approved architecture.
