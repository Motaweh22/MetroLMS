# MetroLMS — Cairo Metro Learning Management System

> **Document Status:** `ACTIVE — AUTHORITATIVE (REPOSITORY ENTRY POINT)`
> **Current Project State:** [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md) (`CP-001` — Ready for Phase 1 `WP-1.1`)
> **Living Master Plan:** [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md)
> **Master Documentation Hub:** [`docs/README.md`](file:///d:/LMS%20MEtro%20Project/docs/README.md)
> **Agent & Developer Workflow Rules:** [`AGENTS.md`](file:///d:/LMS%20MEtro%20Project/AGENTS.md)

---

## 1. Project Overview & Canonical Owners

**MetroLMS** is an Arabic-first (RTL) enterprise Learning Management System for Cairo Metro training operations.

- **Current Objective:** **Frontend Integration Readiness** — ensuring all React 19 features, role workflows, domain rules, state transitions, and API contracts are internally consistent, verified, and ready for future **Python + Django + Microsoft SQL Server** backend integration.
- **No Duplication Rule:** Rather than repeating stack tables, decision matrices, or phase roadmaps in this root README, consult the single canonical owner for each domain:
  1. **Current Position & Next Task:** [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md)
  2. **Complete Remaining Roadmap (`Phases 1–4`):** [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md)
  3. **Confirmed Tech Stack & Out-of-Scope Fence (`D-MEDIA-01`):** [`docs/architecture/system-architecture.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/system-architecture.md)
  4. **Binding Owner Decisions (`D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-01`–`D-14`, `Decision C`):** [`docs/architecture/decision-register.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/decision-register.md)
  5. **Auth, Sessions, CSRF, Logout (`LOGOUT_UNCONFIRMED`) & Role Isolation:** [`docs/architecture/authentication-and-session-contract.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/authentication-and-session-contract.md)
  6. **Domain & Business Rules (6 Roles, `Rule A`, `Rule B`, Approvals, Progress, Deletions):** [`docs/requirements/domain-business-rules.md`](file:///d:/LMS%20MEtro%20Project/docs/requirements/domain-business-rules.md)
  7. **Django + Microsoft SQL Server Integration Contract (`D-DB-01`):** [`docs/backend/django-sqlserver-integration-contract.md`](file:///d:/LMS%20MEtro%20Project/docs/backend/django-sqlserver-integration-contract.md)

---

## 2. Repository Structure

```text
.
├── README.md                  # Repository overview & quick-start guide (this file)
├── AGENTS.md                  # Mandatory workflow & checkpoint rules for developers and AI agents
├── frontend/                  # Active React 19 + TypeScript + Vite + Tailwind v4 SPA
│   ├── src/
│   │   ├── app/               # Application shell, layouts & React Router v7 configuration
│   │   ├── core/              # AuthContext, RolePreviewContext, permissions, apiClient, domain engines
│   │   ├── features/          # Feature modules (courses, builder, review, player, groups, users, etc.)
│   │   ├── mocks/             # MSW v2 handlers & in-memory relational simulation store
│   │   ├── pages/             # Route-level page components
│   │   ├── shared/            # Design-system UI primitives & layout components
│   │   └── test/              # Cross-cutting security, role & isolated-session test suites
│   └── package.json           # Frontend dependencies & scripts
├── docs/                      # Consolidated Knowledge Base & Project State System
│   ├── README.md              # Master Documentation Navigation Hub & Canonical Source-of-Truth Register
│   ├── architecture/          # System, Auth/Session, Security/XSS & Decision Register specs
│   ├── requirements/          # Consolidated Domain & Business Rules
│   ├── project-state/         # CURRENT.md, active-roadmap.md, verification strategy & checkpoints/
│   ├── frontend/              # Frontend architecture, design system, checklists & reports
│   ├── backend/               # Django + SQL Server contract & frozen 42-table schema baseline
│   └── archive/               # Archived chat transcripts & historical disposition index
└── legacy-reference/          # Read-only legacy vanilla JS prototype (DO NOT MODIFY)
```

---

## 3. Frontend Quick Start (`frontend/`)

```bash
cd frontend
npm install

# Start Vite development server with MSW v2 mock API
npm run dev

# Type-check, lint, test, and build (executed at Gate B — see verification-and-test-strategy.md)
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```
