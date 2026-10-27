# Cairo Metro LMS — Frontend Architecture & Design System Documentation

Welcome to the frontend architecture and engineering planning specification for the modernization of the **Cairo Metro Learning Management System (LMS)**.

This documentation suite establishes the authoritative architectural blueprint, visual design standards, component contracts, and incremental implementation roadmap prior to writing application code.

---

## 1. Project Goals & Architectural Charter

The primary engineering goal of this project is **maintainability and change velocity**:
* **Minimize Future Change Effort:** Modifying a shared brand asset, an icon, a color token, typography, a button style, or a shell navigation element must be executed in **exactly one location** and propagate automatically throughout all screens without manual find-and-replace.
* **Low Coupling, High Cohesion:** Feature domains (`courses`, `learning-player`, `training-groups`, `course-builder`, `course-review`, `user-management`) are completely encapsulated with strict boundaries. Features cannot import internal files from sibling features.
* **Domain-Agnostic UI Primitives:** Reusable components (`Button`, `Card`, `Badge`, `Modal`, `DataTable`, `FormInput`) are isolated in `@shared/ui` and have no knowledge of metro domain concepts.
* **Deterministic Business Logic:** Core algorithms for progress tracking, deadline attention warnings, and certificate eligibility are preserved with 100% mathematical and behavioral equivalence to the legacy prototype through characterization tests.
* **Intranet & Offline Resilience:** Fully operational in closed intranet environments without dependencies on external CDNs or Google Fonts.

---

## 2. Summary of Approved Technology Decisions

| Concern | Approved Selection | Architectural Rationale |
| :--- | :--- | :--- |
| **Framework & Language** | **React 19 + TypeScript 5** | Strict type safety, component composability, elimination of runtime errors. |
| **Build Tooling** | **Vite** | Ultra-fast development server (HMR), optimized Rollup production bundling. |
| **Styling Engine** | **Tailwind CSS v4** | CSS-first configuration via `@theme` in `tokens.css`; zero runtime overhead; native logical properties for RTL. |
| **Single Source of Truth** | **CSS Custom Properties** | One authoritative definition per token in `tokens.css`; no duplicated JS config values. |
| **Iconography** | **`lucide-react`** | Centrally managed typed registry (`<Icon name="..." />`); offline SVG bundle; zero CDN dependencies. |
| **Data Mocking** | **MSW v2 (Mock Service Worker)** | Network-level mock API with a stateful in-memory store supporting reads and mutations. |
| **Testing Foundation** | **Vitest + React Testing Library** | Native Vite integration, fast dual-run regression testing, behavioral component verification. |
| **Boundary Enforcement** | **`eslint-plugin-boundaries`** | Automated lint-time compile errors preventing illegal cross-feature imports. |
| **Delivery Model** | **Incremental Vertical Slices** | Staged implementation with explicit acceptance criteria and review checkpoints after each phase. |

---

## 3. Documentation Index

This planning suite consists of four specialized specifications:

1. **[Architecture Specification (`architecture.md`)](./architecture.md):**
   * Target folder structure inside `frontend/src/`.
   * Responsibility and ownership of every directory layer.
   * Inter-feature communication rules and `eslint-plugin-boundaries` configuration.
   * Comprehensive Mermaid diagrams (System Architecture, Layer Dependencies, Component Reuse, Data Mutation Flow, Change Propagation, First Vertical Slice).
   * Concrete walkthroughs demonstrating zero-side-effect changes.

2. **[Design System Specification (`design-system.md`)](./design-system.md):**
   * Cairo Metro branding, approved logos, and usage guidelines.
   * Typed Lucide icon registry, standard sizes, and fallback handling.
   * Authoritative color system tokens, surface hierarchy, and mathematically verified WCAG 2.1 AA contrast matrix.
   * Arabic typography with Cairo local font packaging rules and offline dependency status.
   * Reusable component specifications (Button, Card, Badge, Modal, Input, DataTable) and interaction states.
   * Token change management procedures.

3. **[Incremental Implementation Roadmap (`implementation-roadmap.md`)](./implementation-roadmap.md):**
   * Detailed breakdown of the 12 sequenced user-reviewable increments (**Increment 0 through Increment 11**), structured across 4 Strategic Feature Milestones.
   * Specific scope, deliverables, dependencies, risks, testing strategies, and acceptance criteria for each increment.
   * Deferred verification plan for legacy business logic (`calculateTraineeProgress`, `checkTraineeAttention`, `evaluateCertEligibility`, `calculateGroupMetrics`).
   * Legacy application preservation protocol.

4. **[Legacy System Inventory & Migration Mapping (`legacy-inventory.md`)](./legacy-inventory.md):**
   * Complete inventory of all 25 legacy views, render functions, and role restrictions.
   * Analysis of static JSON seed files vs dynamic in-memory generation reality (e.g., training groups).
   * Client-side storage tier breakdown (`localStorage`, `sessionStorage`, Python server `/api/save_json`).
   * Core operational workflows and full parity verification matrix.

---

## 4. Current Planning & Implementation Status
 
* **Legacy Prototype Status:** Intact, running on port 8000 via [`server.py`](file:///c:/Users/Administrator/Desktop/metro%20courses/server.py), zero source files modified.
* **React Codebase Status:** **In Active Incremental Development** inside `frontend/`.
* **Completed & Verified Increments:**
  * **Increment 0:** Project Foundation, Tailwind CSS v4 design tokens, and local Cairo typography.
  * **Increment 1:** Centralized branding, typed Lucide icon registry, and shared UI primitives laboratory (`/design-system`).
  * **Increment 2:** Shared application shell, responsive top navbar, desktop sidebar, and mobile drawer.
  * **Increment 3:** Dedicated Arabic RTL login page (`/login`), synthetic demo accounts, MSW v2 mock authentication endpoints, token/session abstraction (`sessionStorage`), and route protection guards (`ProtectedRoute`).
* **Roadmap Hierarchy & Next Stage:**
  * **Milestone 1: Architectural Foundation & Shared Primitives** (Increments 0, 1, 2) — **COMPLETED**
  * **Milestone 2: Authentication & Core Learner Experience** (Increments 3, 4, 5, 6) — *Increment 3 Completed; Increment 4 Awaiting Approval*
  * **Milestone 3: Dashboards, Authoring & Quality Assurance** (Increments 7, 8, 9)
  * **Milestone 4: Enterprise Operations & Full Parity** (Increments 10, 11)

---

## 5. Next Steps

* **Current Status:** Increment 3 verification complete with 38 passing Vitest tests, zero ESLint issues, clean production build, and browser verification recordings.
* **Awaiting Explicit Client Approval:** Increment 3 review checkpoint before starting **Increment 4: Course Catalog & Details (Read-Only)**.

