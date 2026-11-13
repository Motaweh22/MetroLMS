# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-002` — Microsoft SQL Server Target Database Engine

> **Document Title:** Microsoft SQL Server as the Sole Target Relational Database Engine  
> **Document Identifier:** `METROLMS-ADR-CORE-002`  
> **Document Status:** `ACCEPTED`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-DB-01`](../../architecture/decision-register.md#d-db-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Context & Problem Statement
Prior historical codebase documentation contained conflicting database references, including an unapproved 1,612-line PostgreSQL draft (`docs/backend/database-schema.md`). The operational IT environment of the Egyptian Company for Metro Management and Operation standardizes enterprise infrastructure on Microsoft Windows Server and Microsoft SQL Server. A single, authoritative relational database standard was required.

## 2. Decision Drivers
- **Enterprise Standards:** Strict compliance with Cairo Metro corporate database infrastructure.
- **Operational Support:** Existing institutional DBA expertise, automated enterprise backup systems, and licensing.
- **Architecture Simplicity:** Elimination of conflicting multi-engine assumptions.

## 3. Considered Options
- **Option 1: PostgreSQL:** Historical open-source proposal.
- **Option 2: Microsoft SQL Server (Chosen):** Enterprise Microsoft SQL Server Standard / Enterprise 2022+.
- **Option 3: Multi-Database Support (PostgreSQL + SQL Server):** Dual-dialect compatibility.

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (Microsoft SQL Server Sole Relational Engine)**.
- **Governing Authority:** Level 1 Owner Decision [`D-DB-01`](../../architecture/decision-register.md#d-db-01).

## 5. Pros and Cons of the Options
### Option 2 (Microsoft SQL Server — Chosen)
- **Positive:** 100% compliant with Cairo Metro IT enterprise standards and infrastructure policies.
- **Positive:** Supported via Django ORM using `mssql-django` connector and `pyodbc`.
- **Positive:** Enterprise high-availability, Read Committed Snapshot Isolation (RCSI), and TDE encryption.
- **Negative:** Requires Windows Server host or supported enterprise Linux container with SQL Server ODBC Driver 18+.

### Option 1 (PostgreSQL — Rejected)
- **Negative:** Non-standard in Cairo Metro data center; unapproved by IT leadership.
- **Negative:** All historical PostgreSQL artifacts (`pg_hba.conf`, PgBouncer bypass, `SECURITY DEFINER`) discarded.

## 6. Implementation Notes & Consequences
- Target connector: `pyodbc` with `mssql-django` engine.
- Production schema evolution: Generated exclusively via Django Models and Migrations. Handwritten production DDL is strictly prohibited.
- Legacy draft [`docs/backend/database-schema.md`](../../backend/database-schema.md) is classified as `TIER-5-UNAPPROVED-DRAFT` with zero active normative authority.
