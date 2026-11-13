# MetroLMS — Historical & Superseded Documentation Archive (`docs/archive/README.md`)

> **Document Status:** `ACTIVE — SUPPORTING (ARCHIVE GOVERNANCE & CLASSIFICATION LEDGER)`
> **Canonical Role:** Indexes all relocated and in-place archived/frozen/historical documentation across the MetroLMS repository (`94` non-active repository Markdown files out of `116` total) and explains their relationship to the `22` active documentation files and the `82` external Brain session artifact mirrors.
> **Last Updated:** 2026-11-07 (`CP-001` — Final Documentation Cleanup & `WP-1.1` Readiness Alignment)

---

## 1. Archive Governance Rules

1. **Zero Active Normative Authority for `SUPERSEDED — ARCHIVE` Files:** Files classified as `SUPERSEDED — ARCHIVE` (`46` files) are preserved strictly for historical audit traceability. They must **never** be used as active implementation requirements.
2. **Read-Only Immutability for `FROZEN — DO NOT MODIFY` & `HISTORICAL — PRESERVE` Files:** Frozen baselines (`12` files, including `CP-001`, `pre-backend-migration-remediation-roadmap.md`, `database-schema.md`, `erd.md`, `erd-chen.md`, `developer-bootstrap-contract.md`, `implementation-roadmap*.md`, and `phase-02`–`04` checklists) and historical implementation reports/checklists (`36` files) are never rewritten or deleted. Where Owner Decisions (`D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-MEDIA-01`, `Decision C`) supersede a frozen baseline detail, the active canonical specification in `docs/architecture/` or `docs/backend/django-sqlserver-integration-contract.md` governs.

---

## 2. Relocated Raw Chat Transcripts (`docs/archive/transcripts/` — `2` Files, `SUPERSEDED — ARCHIVE`)

| Archived File | Size | Original Location | Reason for Archival |
| :--- | :---: | :--- | :--- |
| [`transcripts/CHAT_TRANSCRIPT.md`](file:///d:/LMS%20MEtro%20Project/docs/archive/transcripts/CHAT_TRANSCRIPT.md) | `3,166,915` bytes | Root `CHAT_TRANSCRIPT.md` | Raw historical session log; identical in content (SHA-256 `1E516E763038`) to the protected legacy copy at `legacy-reference/CHAT_TRANSCRIPT.md`. Relocated out of repository root to prevent workspace clutter. |
| [`transcripts/CHAT_TRANSCRIPT_INCREMENTS_9_10.md`](file:///d:/LMS%20MEtro%20Project/docs/archive/transcripts/CHAT_TRANSCRIPT_INCREMENTS_9_10.md) | `1,800,712` bytes | Root `CHAT_TRANSCRIPT_INCREMENTS_9_10.md` | Raw historical session log from Frontend Increments 9–10; relocated out of repository root. |

---

## 3. Complete Non-Active Repository Markdown Classification Ledger (`94` of `116` Files)

| Category & Location | File Count | Classification | Governing Active Replacement |
| :--- | :---: | :---: | :--- |
| **Immutable Checkpoint `CP-001`** (`docs/project-state/checkpoints/CP-001-2026-11-07-phase-a-closure.md`) | `1` | `FROZEN — DO NOT MODIFY` | [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md) & [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md) |
| **Frozen Backend Remediation Roadmap, 42-Table Schema, ERDs & CLI Bootstrap** (`docs/backend/pre-backend-migration-remediation-roadmap.md`, `database-schema.md`, `erd.md`, `erd-chen.md`, `contracts/developer-bootstrap-contract.md`) | `5` | `FROZEN — DO NOT MODIFY` | [`docs/backend/django-sqlserver-integration-contract.md`](file:///d:/LMS%20MEtro%20Project/docs/backend/django-sqlserver-integration-contract.md) (`D-DB-01` SQL Server supersedes PostgreSQL syntax) & [`docs/requirements/domain-business-rules.md`](file:///d:/LMS%20MEtro%20Project/docs/requirements/domain-business-rules.md) |
| **Frozen Frontend Increment 0–12 Roadmaps** (`docs/frontend/implementation-roadmap*.md`) | `3` | `FROZEN — DO NOT MODIFY` | [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md) |
| **Frozen Completed Remediation Phase 2–4 Checklists** (`docs/frontend/checklists/phase-02*.md`, `phase-03*.md`, `phase-04*.md`) | `3` | `FROZEN — DO NOT MODIFY` | [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md) (`HIST-03`–`HIST-05`) |
| **Historical Legacy-to-React Migration Audits** (`docs/frontend/legacy-feature-parity-audit.md`, `legacy-inventory.md`) | `2` | `HISTORICAL — PRESERVE` | [`docs/frontend/architecture.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/architecture.md) |
| **Historical Increment 5–11 Feature Checklists** (`docs/frontend/checklists/increment-*.md`, `messaging-*.md`, `phase-5-implementation-plan.md`, `shared-ui-*.md`, `whatsapp-*.md`) | `11` | `HISTORICAL — PRESERVE` | [`docs/frontend/checklists/README.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/README.md) (`HIST-01`) |
| **Phase A Baseline & Remediation Phase 3–5 / Notification Audit Reports** (`docs/frontend/reports/phase-a-*.md`, `increment-03-*.md`, `notification-*.md`, `role-aware-*.md`, `phase-04-*.md`, `phase-05-*.md`) | `21` | `HISTORICAL — PRESERVE` | [`docs/frontend/reports/README.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/README.md) |
| **Protected Legacy Vanilla JS Reference Docs** (`legacy-reference/README.md`, `legacy-reference/CHAT_TRANSCRIPT.md`) | `2` | `HISTORICAL — PRESERVE` | Protected read-only directory (`legacy-reference/**`) |
| **Superseded SUP-01 Audit Series (`v1.3`–`v3.26`)** (`docs/frontend/reports/sup-01-*.md`) | `44` | `SUPERSEDED — ARCHIVE` | Permanently retired by `Decision C (S8 -> S7)` and `D-AUTH-01`/`D-DB-01`/`D-SEC-01` in [`authentication-and-session-contract.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/authentication-and-session-contract.md) & [`decision-register.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/decision-register.md) |
| **Relocated Raw Chat Transcripts** (`docs/archive/transcripts/*.md`) | `2` | `SUPERSEDED — ARCHIVE` | Indexed in Section 2 above |
| **Total Non-Active Repository Markdown Files** | **`94`** | — | *(Plus `22` Active Repository Markdown files = `116` total Repository `.md` files)* |

---

## 4. External Brain / Session Artifact Mirrors (`82` Files Outside Repository)

The IDE conversation artifact directory (`C:\Users\Administrator\.gemini\antigravity\brain\60a56b3d-7eee-41aa-b677-179a79273724\`) contains **`82` Markdown files** (`46` SUP-01 drafts/mirrors, `23` historical phase/notification report mirrors, and `13` temporary `scratch/*.md` fragments).
- **Disposition:** These `82` files reside **outside** `d:\LMS MEtro Project` in the external IDE session storage directory and are **non-authoritative**. Only the `22` active Markdown files inside `d:\LMS MEtro Project` carry active project authority.
