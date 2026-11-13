# MetroLMS — Master Risk & Assumption Register (RAID)
## Project / Domain: [Project / Domain Name]

> **Document Title:** [Risk Register Title]  
> **Document Identifier:** `METROLMS-RSK-[DOMAIN]-[NNN]`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 3 Project Governance  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Project Owner, Program Managers, Architecture Review Board  
> **Governing Decisions:** Master Owner Decision Register Decisions  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Overview & Risk Management Methodology
This register tracks Risks, Assumptions, Issues, and Dependencies (RAID) impacting MetroLMS architecture, development milestones, security compliance, and production readiness.

## 2. Risk Matrix
| Risk ID | Category | Description | Probability | Impact | Score | Mitigation Strategy | Owner | Status |
| :--- | :--- | :--- | :-: | :-: | :-: | :--- | :--- | :--- |
| `RSK-01` | Technical | SQL Server pyodbc driver compatibility with Linux | Low | High | Medium | Containerized validation in Phase 7 | DevOps | Open |
| `RSK-02` | Operational| Peak network bandwidth constraints at training centers | Medium| High | High | Offline caching & adaptive bitrate | SRE | Open |

## 3. Assumptions Log
| Assumption ID | Statement of Assumption | Validation Milestone | Current Validity |
| :--- | :--- | :--- | :--- |
| `ASM-01` | Microsoft SQL Server Standard 2022 available in production | Phase 7 Deployment | Confirmed (`D-DB-01`) |
| `ASM-02` | Cairo Metro enterprise storage supports direct media streaming | Phase 1 Architecture | Confirmed (`D-MEDIA-01`)|

## 4. Dependencies Log
| Dependency ID | External Dependency | Responsible Entity | Critical Path Impact |
| :--- | :--- | :--- | :--- |
| `DEP-01` | Production SSL/TLS Certificates | Cairo Metro IT Admin | Blocks Production Launch |
