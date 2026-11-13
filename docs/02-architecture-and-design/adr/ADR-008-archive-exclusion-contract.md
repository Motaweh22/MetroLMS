# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-008` — Trainee Active View Archive Exclusion Contract

> **Document Title:** Trainee Active View Archive Exclusion Contract  
> **Document Identifier:** `METROLMS-ADR-CORE-008`  
> **Document Status:** `ACCEPTED`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Context & Problem Statement
When a training group reaches its operational conclusion, supervisors archive the group. If archived groups continue to render on trainee dashboards, trainees see outdated or closed deadlines, causing confusion.

## 2. Decision Drivers
- **UI Clarity:** Trainee learning surfaces must display only actionable, open cohorts.
- **Contract Strictness:** Explicit API and client-side filtering rules.

## 3. Considered Options
- **Option 1: Client-Side Trainee Filtering Only:** Backend returns all groups; UI filters them.
- **Option 2: Server-Side and Client-Side Archive Exclusion Contract (Chosen):** Dual-layer exclusion contract.

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (Server-Side and Client-Side Archive Exclusion Contract)**.
- **Governing Authority:** Level 1 Owner Decision [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07).

## 5. Implementation Notes & Consequences
- Trainee-facing group queries (`GET /api/groups/my`) enforce `WHERE is_archived = 0`.
- Trainee dashboard carousels and `/my-groups` surfaces strictly exclude archived group records.
