# MetroLMS — Documentation Program Decision Register (`docs/00-governance/decision-register.md`)

> **Document Title:** Documentation Program Decision Register  
> **Document Identifier:** `METROLMS-GOV-DEC-002`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 2 Operational Decision Register (Governed by [`docs/architecture/decision-register.md`](../architecture/decision-register.md))  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Project Owner, AI Coding Agents & System Engineers  
> **Governing Decisions:** Documentation Program Decisions D1–D6, Root Register Decisions `D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-MEDIA-01`  
> **Last Updated:** 2026-11-12 (Phase 0 Scaffolding)

---

## 1. Governance Relationship to Master Product Decision Register

This decision register records **operational and procedural decisions specific to the Documentation Program** (Decisions `D1` through `D6`).

> [!IMPORTANT]
> **Primacy of Master Decision Register:**  
> The sole Level 1 Master Decision Register for all architectural, database, security, and product requirements is [`docs/architecture/decision-register.md`](../architecture/decision-register.md).  
> This operational register must **never** duplicate, redefine, or override any Level 1 product decision (`D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-MEDIA-01`, `D-01` through `D-14`, `OD-01` through `OD-02`, or `D-GRP-01` through `D-GRP-08`).

---

## 2. Documentation Program Decisions (D1–D6)

### Decision D1: Domain-Decomposed Phase 2 Execution (Phase 2A & Phase 2B)
- **Context:** Phase 2 of the documentation roadmap originally encompassed all core curriculum, identity, and group domains in a single monolithic milestone, creating excessive delivery risk.
- **Approved Decision:** Decompose Phase 2 into two sequential, focused sub-phases:
  - **Phase 2A (Domains 01–07):** High-priority identity, session lifecycle, and course management domains.
  - **Phase 2B (Domains 08–10):** Training groups, reminder programs, and in-place renewal domains.
- **Authority:** Approved by Project Owner in Master Planning Document REV6 (`DOC-PROG-2026-11-12-REV6`).

---

### Decision D2: Parallel Execution Streams for Technical, Testing & Operational Documentation
- **Context:** Linear sequential execution of documentation streams (Phase 3 through Phase 8) would prolong the documentation timeline unnecessarily.
- **Approved Decision:** Authorize parallel execution streams for non-blocking documentation tracks:
  - Stream 1: Core Domain & System Architecture (Phases 1, 2A, 2B, 3).
  - Stream 2: Master API Contracts & Testing Specifications (Phases 5, 6).
  - Stream 3: Operations, Maintenance & User Guides (Phases 7, 8).
- **Authority:** Approved by Project Owner in REV6.

---

### Decision D3: Seven-Category Repository Taxonomy with Supporting Directories
- **Context:** Existing documentation was dispersed across unstandardized folders (`docs/frontend/`, `docs/backend/`, `docs/project-state/`), lacking functional alignment.
- **Approved Decision:** Establish a canonical seven-category taxonomy under `docs/` (`01-requirements`, `02-architecture-and-design`, `03-technical-documentation`, `04-testing`, `05-user-documentation`, `06-operations-and-maintenance`, `07-project-and-process`), supplemented by two dedicated supporting directories: `00-governance/` and `_templates/`.
- **Authority:** Approved by Project Owner in REV6.

---

### Decision D4: Manifest-Driven Passive Phase 0 Scaffolding
- **Context:** Previous cleanup proposals risked premature relocation or deletion of historical audit evidence and working-tree modifications.
- **Approved Decision:** Phase 0 must be purely additive, passive scaffolding. It establishes directory trees, navigation READMEs, templates, and a machine-readable migration manifest (`migration-manifest.json` with `relocationAuthorized: false`). Zero existing documentation files may be relocated, renamed, or deleted during Phase 0.
- **Authority:** Approved by Project Owner in REV6 and Phase 0 Authorization.

---

### Decision D5: Documentation Checkpoint Namespace Isolation
- **Context:** Product development checkpoints (`CP-001` through `CP-007` and reserved `CP-008` in `docs/project-state/checkpoints/`) track code and testing milestones. Mixing documentation program milestones into the product ledger would violate checkpoint immutability.
- **Approved Decision:** Establish an isolated, dedicated checkpoint namespace for documentation program milestones at `docs/07-project-and-process/checkpoints/documentation-program/` (`CP-DOC-00` through `CP-DOC-08`). Existing product checkpoints remain permanently untouched.
- **Authority:** Approved by Project Owner in REV6.

---

### Decision D6: Dedicated Role-Based Manuals Catalog
- **Context:** User documentation requires distinct, role-tailored operational instructions rather than a single generic manual.
- **Approved Decision:** Provide dedicated user guide directories under `docs/05-user-documentation/`:
  - `getting-started/` (cross-role onboarding)
  - `trainee-guide/` (end-user trainees)
  - `instructor-guide/` (lecturers and course instructors)
  - `supervisor-guide/` (assistant admins and supervisors)
  - `admin-guide/` (system administrators)
  - `faq-and-troubleshooting/` (incident triage and self-service help)
- **Authority:** Approved by Project Owner in REV6.
