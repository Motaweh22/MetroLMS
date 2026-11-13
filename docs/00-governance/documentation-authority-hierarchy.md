# MetroLMS — Documentation Authority Hierarchy Standard (`docs/00-governance/documentation-authority-hierarchy.md`)

> **Document Title:** Documentation Authority Hierarchy & Conflict Resolution Standard  
> **Document Identifier:** `METROLMS-GOV-AUTH-003`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 2 Architecture & Governance Standard (Governed by [`docs/architecture/decision-register.md`](../architecture/decision-register.md))  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Project Owner, AI Coding Agents & System Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), Documentation Program Decisions D1–D6  
> **Last Updated:** 2026-11-12 (Phase 0 Scaffolding)

---

## 1. Overview and Mandatory Principle

When two or more documents across the MetroLMS repository present divergent specifications, requirements, architecture patterns, or dates, the conflict must be resolved strictly in accordance with the **7-Level Documentation Authority Order** established in the Level 1 Master Decision Register ([`docs/architecture/decision-register.md`](../architecture/decision-register.md)).

Under no circumstances may a lower-tier document override, dilute, or contradict a higher-tier document.

---

## 2. The 7-Level Authority Hierarchy

```text
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                        MetroLMS Documentation Authority Hierarchy                                 |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| LEVEL 1 (HIGHEST): Explicit & Accepted Owner Decisions                                            |
|   • Master Decision Register: docs/architecture/decision-register.md                              |
|   • Core Decisions: D-AUTH-01, D-DB-01, D-SEC-01, D-MEDIA-01, D-01..D-14, OD-01..02,             |
|     D-GRP-01..D-GRP-08, Phase 5 Decisions A, B, C, E, F.                                         |
|                                                                                                   |
| LEVEL 2: Current Authoritative Architecture & Decision Records                                    |
|   • Master System Architecture: docs/architecture/system-architecture.md                          |
|   • Live Status Dashboard: docs/project-state/CURRENT.md                                          |
|   • Scoped Governance Specifications: docs/00-governance/*.md                                     |
|   • Target Architecture Documents: docs/02-architecture-and-design/*.md                           |
|                                                                                                   |
| LEVEL 3: Approved Active Master Roadmap                                                           |
|   • Living Master Plan: docs/project-state/active-roadmap.md                                      |
|   • Target Process Roadmaps: docs/07-project-and-process/roadmaps/*.md                            |
|                                                                                                   |
| LEVEL 4: Current Domain-Specific Specifications & Business Rules                                  |
|   • Canonical Business Rules: docs/requirements/domain-business-rules.md                          |
|   • Target Domain Rules: docs/01-requirements/domains/*.md                                        |
|   • Technical Specs: docs/03-technical-documentation/domains/*.md                                 |
|                                                                                                   |
| LEVEL 5: Current Implementation Documentation & API Integration Contracts                         |
|   • Backend Contract: docs/backend/django-sqlserver-integration-contract.md                       |
|   • API Contracts: docs/03-technical-documentation/api/*.md                                       |
|                                                                                                   |
| LEVEL 6: Verification Reports, Checklists & Checkpoint Records (Status Evidence Only)             |
|   • Product Checkpoints: docs/project-state/checkpoints/*.md                                      |
|   • Historical Reports & Checklists: docs/frontend/reports/*.md, docs/frontend/checklists/*.md    |
|   • Documentation Checkpoints: docs/07-project-and-process/checkpoints/documentation-program/*.md |
|                                                                                                   |
| LEVEL 7 (LOWEST): Historical, Superseded & Archived Documents                                     |
|   • Frozen Roadmaps: docs/backend/pre-backend-migration-remediation-roadmap.md                    |
|   • Legacy PostgreSQL Draft: docs/backend/database-schema.md                                      |
|   • Session Transcripts: docs/archive/transcripts/*.md                                            |
|   • Historical SUP-01 series (v1.3–v3.26)                                                         |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. Operational Conflict Resolution Rules

1. **Reports Are Status Evidence, Not Specification:** An implementation report or audit report in Level 6 records what was observed or tested at a specific point in time. It does **not** create or modify architectural rules. Only Level 1 and Level 2 documents possess normative specification authority.
2. **Roadmaps Schedule, They Do Not Redefine:** Roadmaps in Level 3 sequence tasks and track progress. If a roadmap description conflicts with an architectural invariant in Level 1 or Level 2, the higher level prevails.
3. **Draft and Archived Documents Have Zero Normative Power:** Documents classified under Level 7 (such as the legacy PostgreSQL draft or archived chat transcripts) have zero normative authority. They are preserved purely for historical traceability.
4. **Mandatory Escalation on Irreconcilable Contradiction:** If an AI agent or human engineer discovers a contradiction between two Level 1 or Level 2 documents, work on that topic must pause, and the contradiction must be escalated using the formal 11-field Owner Escalation Form in [`docs/architecture/decision-register.md`](../architecture/decision-register.md).
