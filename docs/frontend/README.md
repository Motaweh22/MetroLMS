# MetroLMS — Frontend Documentation Index (`docs/frontend/README.md`)

> **Document Status:** `ACTIVE — SUPPORTING (FRONTEND DOCUMENTATION INDEX)`
> **Canonical Role:** Indexes all **10 top-level files** in `docs/frontend/` plus its two subdirectories ([`checklists/`](checklists/README.md) with `16` files and [`reports/`](reports/README.md) with `66` files = `92` total Markdown files in `docs/frontend/`). Links directly to canonical owners without duplicating their rules.
> **Last Updated:** 2026-11-07 (`CP-001` — Final Documentation Cleanup & `WP-1.1` Readiness Alignment)

---

## 1. Active Authoritative & Supporting Frontend Specifications (`5` Files in `docs/frontend/`)

| Document | Classification | Canonical Scope | Cross-Reference for Superseded / Related Domains |
| :--- | :---: | :--- | :--- |
| **[`README.md`](README.md)** *(this file)* | `ACTIVE — SUPPORTING` | Directory index for `docs/frontend/`. | Master Hub: [`docs/README.md`](../README.md) |
| **[`architecture.md`](architecture.md)** | `ACTIVE — AUTHORITATIVE` | React 19 component hierarchy, feature-sliced folder structure (`src/app`, `src/core`, `src/features`, `src/pages`, `src/shared`), state management, and routing topology. | Auth/Session rules: [`authentication-and-session-contract.md`](../architecture/authentication-and-session-contract.md) |
| **[`design-system.md`](design-system.md)** | `ACTIVE — AUTHORITATIVE` | Cairo Metro brand palette, Arabic-first RTL layout rules, Cairo/Tajawal typography scale, spacing tokens, and shared UI primitives (`Button`, `Badge`, `Modal`, `Tabs`, `Toast`). | `/design-system` production `404` route guard (`MFR-25`): [`security-and-xss-baseline.md`](../architecture/security-and-xss-baseline.md) |
| **[`loading-and-error-handling.md`](loading-and-error-handling.md)** | `ACTIVE — AUTHORITATIVE` | Skeleton loading patterns, empty states, inline validation errors, and global error boundary UX. | DRF HTTP error envelopes: [`django-sqlserver-integration-contract.md`](../backend/django-sqlserver-integration-contract.md) |
| **[`authorization-and-permissions-design.md`](authorization-and-permissions-design.md)** | `ACTIVE — SUPPORTING` | **Sections 3–10** (Three-Layer Permission Engine: `roleDefaults`, `roleCeilings`, `userOverrides`, and capability keys). | **Sections 1–2** (older 4-role narrative) are superseded by the 6-tier role hierarchy (`INV-R1`–`INV-R10`) in [`domain-business-rules.md`](../requirements/domain-business-rules.md) & [`security-and-xss-baseline.md`](../architecture/security-and-xss-baseline.md). |

---

## 2. Frozen Feature Increment Roadmaps (`3` Files — `FROZEN — DO NOT MODIFY`)

The three `implementation-roadmap*.md` files record the original **Frontend Feature Construction Track (Increments 0–12)**. For the **active execution plan (`Phases 1–4`)**, always use **[`docs/project-state/active-roadmap.md`](../project-state/active-roadmap.md)**:

| Document | Classification | Scope |
| :--- | :---: | :--- |
| **[`implementation-roadmap.md`](implementation-roadmap.md)** | `FROZEN — DO NOT MODIFY` | Original feature construction plan for **Increments 0 through 10** (completed). |
| **[`implementation-roadmap-increment-11.md`](implementation-roadmap-increment-11.md)** | `FROZEN — DO NOT MODIFY` | Specification for **Increment 11** (`Subphases 5A–5E`, completed at `1,174` passing baseline tests across `66` files). |
| **[`implementation-roadmap-increment-12.md`](implementation-roadmap-increment-12.md)** | `FROZEN — DO NOT MODIFY` | Specification for **Increment 12** (Platform Statistics & Analytics `/stats`). |

---

## 3. Historical Legacy Migration Audits (`2` Files — `HISTORICAL — PRESERVE`)

Completed during Increment 10–11 planning against [`legacy-reference/`](../../legacy-reference/README.md); preserved as historical migration evidence:

| Document | Classification | Scope |
| :--- | :---: | :--- |
| **[`legacy-feature-parity-audit.md`](legacy-feature-parity-audit.md)** | `HISTORICAL — PRESERVE` | Evidence-based parity matrix (`LEG-001`–`LEG-045`) comparing the legacy Vanilla JS SPA against the React frontend prior to Increment 11. |
| **[`legacy-inventory.md`](legacy-inventory.md)** | `HISTORICAL — PRESERVE` | Inventory of all 25 legacy views, controllers, storage keys, and their React route mappings. |

---

## 4. Subdirectories (`checklists/` & `reports/`)

- **[`docs/frontend/checklists/README.md`](checklists/README.md)** (`16` files total): Indexes the `1` active Phase 5 checklist (`phase-05-developer-preview-and-isolated-testing-checklist.md`), the `3` frozen completed Phase 2–4 checklists, and the `11` historical Increment 5–11 feature checklists.
- **[`docs/frontend/reports/README.md`](reports/README.md)** (`66` files total): Indexes the `1` Phase A baseline report, the `20` historical Notification & Phase 3–5 implementation/audit evidence reports, and the `44` superseded `SUP-01` (`v1.3`–`v3.26`) reports.
