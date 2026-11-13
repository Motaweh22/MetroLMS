# MetroLMS — High-Level Architecture Design (HLD)
## Subsystem / Scope: Technology Stack & Component Architecture

> **Document Title:** Technology Stack, Component Architecture & Integration Contracts  
> **Document Identifier:** `METROLMS-HLD-ARCH-002`  
> **Document Status:** `ACTIVE — AUTHORITATIVE BASELINE`  
> **Canonical Authority Level:** Level 2 Architecture Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architects, Technical Leads, Development Teams  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Architectural Mission & Overview

This specification establishes the confirmed technology stack, language runtimes, core frameworks, integration connectors, and development toolchains for MetroLMS. It codifies approved technical components while explicitly fencing off unapproved technologies.

---

## 2. Confirmed Core Technology Stack

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                        MetroLMS Confirmed Production Technology Stack                             |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| FRONTEND PRESENTATION TIER                                                                        |
|   • Framework: React 19 (Strict Mode, Concurrent Rendering)                                       |
|   • Language: TypeScript 5.7+ (Strict Type-Checking, No Implicit Any)                             |
|   • Build Tool & Dev Server: Vite 6.0+ (ESBuild Bundling, Fast HMR)                               |
|   • Styling & Design System: Tailwind CSS v4 + Metro Design Tokens (RTL Native)                   |
|   • Testing Framework: Vitest + React Testing Library (RTL) + MSW v2 (Mock Service Worker)        |
|                                                                                                   |
| BACKEND APPLICATION TIER                                                                          |
|   • Language Runtime: Python 3.12+ 64-bit                                                         |
|   • Framework: Django 5.x LTS + Django REST Framework (DRF) 3.15+                                 |
|   • Architectural Pattern: Service Layer Encapsulation (Views -> Services -> Selectors/Models)   |
|   • WSGI Server: Waitress (Windows Server) / Gunicorn (Linux) — Deferred to Phase 7              |
|                                                                                                   |
| DATABASE PERSISTENCE TIER (D-DB-01)                                                               |
|   • Relational Engine: Microsoft SQL Server Standard / Enterprise 2022+                           |
|   • Python Driver: pyodbc (C-extension driver) via Microsoft ODBC Driver 18 for SQL Server        |
|   • Django Backend: mssql-django (Official Microsoft Django Connector)                            |
|   • Concurrency Control: Read Committed Snapshot Isolation (RCSI) + Optimistic Row Versioning    |
|   • Schema Evolution: Exclusively via Django Models & Migrations (No handwritten production DDL)  |
|                                                                                                   |
| ENTERPRISE MEDIA STREAMING TIER (D-MEDIA-01)                                                      |
|   • Architecture: Decoupled Enterprise Storage / Content Distribution Network                     |
|   • Transport: Direct Client HTTP 206 Partial Content Byte-Range Video Streaming                  |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. Prohibited Technologies & Architecture Deviations

To prevent technical drift and preserve architectural integrity, the following technologies are **formally prohibited**:

1. **PostgreSQL:** Discarded entirely. All historical PostgreSQL artifacts (`pg_hba.conf`, `SECURITY DEFINER`, PgBouncer bypass, `database-schema.md`) have zero normative authority (`D-DB-01`).
2. **GraphQL:** Prohibited. MetroLMS standardizes exclusively on RESTful JSON APIs over HTTPS.
3. **Browser-Stored JWTs / Bearer Tokens:** Prohibited. Authentication relies strictly on server-side sessions with HttpOnly cookies (`D-AUTH-01`).
4. **Client-Side Session Encryption (WebCrypto):** Prohibited. Session security is managed at the server tier (`D-AUTH-01`, Decision C).
5. **Hardware Security Modules (HSM) / Cloud KMS Gateways:** Out of scope. Standard TLS 1.3 certificates and SQL Server Transparent Data Encryption (TDE) provide required cryptographic protection.

---

## 4. Frontend Component & State Architecture

### 4.1 Component Layering
- **Pages (`frontend/src/pages/`):** Route-bound view containers coordinating layout and domain features.
- **Features (`frontend/src/features/`):** Domain-decomposed feature modules (e.g., `course-builder`, `course-review`, `learning`, `approvals`, `groups`).
- **Core (`frontend/src/core/`):** Shared foundational infrastructure (auth, permissions, design tokens, API client).
- **Mocks (`frontend/src/mocks/`):** Mock Service Worker (MSW v2) fixtures supporting Gate A testing without a live backend.

### 4.2 State Management Pattern
- Server-cache state managed via standardized data-fetching hooks with loading boundaries.
- Local UI state managed via React hooks (`useState`, `useReducer`, `useContext`).
- Cross-tab session epoch synchronization (`sessionEpoch.ts`) detecting concurrent logouts.

---

## 5. Backend Service Layer & Transactional Architecture

1. **Service Layer Pattern:** Business logic is encapsulated in pure Python service functions located in `services/`, keeping DRF views thin and focused on HTTP serialization.
2. **Atomic Transactions:** Multi-entity state mutations (e.g., group renewal, attempt sealing) execute within `transaction.atomic()` blocks in SQL Server.
3. **Structured Audit Logging:** Every mutation operation records structured audit entries attributing the actor, role, timestamp, and entity diff.
