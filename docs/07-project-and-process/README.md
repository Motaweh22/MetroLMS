# MetroLMS — Project & Process Hub (`docs/07-project-and-process`)

> **Document Title:** Project & Process Hub Navigation Portal  
> **Document Identifier:** `METROLMS-PROC-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 3 Project Process & Governance Hub  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Project Owners, Program Managers, Scrum Masters & Lead Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), Decision D5 (Documentation Checkpoint Namespace Isolation)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Purpose & Scope

The `docs/07-project-and-process/` directory centralizes project management artifacts, living execution plans, documentation program checkpoint ledgers, historical baseline archives, and risk registers (RAID log).

---

## 2. Directory Structure & Subsystems

```text
docs/07-project-and-process/
├── README.md                      # This Navigation Hub
├── roadmaps/                      # Living roadmaps and frozen historical planning baselines
│   └── historical-roadmaps/
│       └── frontend-implementation-roadmaps/  # Prospective archive for frozen roadmaps (Phase 0: .gitkeep)
├── checkpoints/                   # Checkpoint Ledgers
│   └── documentation-program/     # DEDICATED NAMESPACE: Documentation Milestones CP-DOC-00..08 (D5)
├── historical-reports/            # Prospective archive for historical audit reports (Phase 0: .gitkeep)
│   ├── sup-01-audit-series/
│   ├── supervisor-and-admin-audits/
│   └── phase-implementation-reports/
├── archive/                       # Prospective archive for session transcripts (Phase 0: .gitkeep)
└── risk-management/               # RAID Log & Master Risk Register (Phase 0: .gitkeep)
```

> [!IMPORTANT]
> **Product Checkpoint Ledger Separation (`D5`):**  
> Product development checkpoints (`CP-001` through `CP-007` and reserved `CP-008`) remain permanently at [`docs/project-state/checkpoints/`](../project-state/checkpoints/README.md).  
> The subdirectory `docs/07-project-and-process/checkpoints/documentation-program/` is dedicated exclusively to documentation program milestones (`CP-DOC-00` through `CP-DOC-08`).
> Existing historical reports (76 files) remain preserved in place at [`docs/frontend/reports/`](../frontend/reports/README.md).
> Existing session transcripts remain preserved in place at `docs/archive/transcripts/`.

---

## 3. Subsystem Breakdown and Templates

All process documents authored within this category must strictly conform to the approved templates in [`docs/_templates/`](../_templates/README.md):

| Subdirectory | Target Deliverable Type | Mandatory Template |
| :--- | :--- | :--- |
| `roadmaps/` | Implementation Roadmaps | Specialized Roadmap Format (per `active-roadmap.md`) |
| `checkpoints/documentation-program/` | Documentation Milestones | Checkpoint Template (20-field standard block) |
| `risk-management/` | Master Risk Register (RAID Log) | [`RiskRegister-template.md`](../_templates/RiskRegister-template.md) |
