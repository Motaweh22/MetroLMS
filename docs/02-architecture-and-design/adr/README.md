# MetroLMS — Architecture Decision Records Catalog (`docs/02-architecture-and-design/adr`)

> **Document Title:** Master Architecture Decision Records (ADR) Catalog  
> **Document Identifier:** `METROLMS-ADR-INDEX-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 2 Architecture Specification Index  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Engineering Leadership  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01), [`D-GRP-01`–`08`](../../architecture/decision-register.md#d-grp-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Overview & ADR Governance

This catalog centralizes all formal Architecture Decision Records (ADRs) governing the technical foundation of MetroLMS. 

Each ADR captures an important architectural decision, its context, considered options, decision drivers, chosen outcome, and technical consequences. In accordance with the [Documentation Authority Hierarchy](../../00-governance/documentation-authority-hierarchy.md), all ADRs formalize and link directly to the Level 1 Master Decision Register ([`docs/architecture/decision-register.md`](../../architecture/decision-register.md)).

---

## 2. Master ADR Inventory

| ADR ID | Decision Title | Status | Governing Level 1 Decision | Summary of Architectural Determination |
| :---: | :--- | :---: | :--- | :--- |
| [`ADR-001`](./ADR-001-django-server-sessions.md) | Django Server-Side Sessions & Cookie Security | `ACCEPTED` | [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01) | HttpOnly/Secure cookies; server-side Django session persistence; zero browser JWTs. |
| [`ADR-002`](./ADR-002-microsoft-sql-server-engine.md) | Microsoft SQL Server Target Database Engine | `ACCEPTED` | [`D-DB-01`](../../architecture/decision-register.md#d-db-01) | Microsoft SQL Server 2022+ sole engine via `pyodbc`/`mssql-django`; Django migrations evolution. |
| [`ADR-003`](./ADR-003-frontend-security-and-xss.md) | Frontend Security, DOMPurify & XSS Hardening | `ACCEPTED` | [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01) | DOMPurify sanitization; CSP Report-Only; 3-layer permissions; role invariants `INV-R1`..`R10`. |
| [`ADR-004`](./ADR-004-decoupled-media-storage.md) | Decoupled Enterprise Media Storage Contract | `ACCEPTED` | [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01) | Direct client media streaming from storage/CDN; application server isolated from media streams. |
| [`ADR-005`](./ADR-005-in-place-group-renewal.md) | In-Place Training Group Renewal Architecture | `ACCEPTED` | [`D-GRP-01`](../../architecture/decision-register.md#d-grp-01), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04) | In-place cycle progression; attempt sealing upon deadline expiry or cycle renewal; no clone groups. |
| [`ADR-006`](./ADR-006-day-based-recurrence.md) | Day-Based Calendar Recurrence Measurement | `ACCEPTED` | [`D-GRP-02`](../../architecture/decision-register.md#d-grp-02) | Exact calendar day arithmetic for renewal frequencies; leap year invariance. |
| [`ADR-007`](./ADR-007-persistent-reminder-type.md) | Monotonic Reminder Type Progression Marker | `ACCEPTED` | [`D-GRP-06`](../../architecture/decision-register.md#d-grp-06) | Persistent `reminder_type` tracking monotonic progression (`initial` -> `halfway` -> `urgent`). |
| [`ADR-008`](./ADR-008-archive-exclusion-contract.md) | Trainee Active View Archive Exclusion Contract | `ACCEPTED` | [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07) | Archived training groups strictly excluded from active trainee dashboards and carousels. |
