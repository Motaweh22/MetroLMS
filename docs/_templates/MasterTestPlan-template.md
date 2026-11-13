# MetroLMS — Master Verification & Test Plan (MTP)
## Subsystem / Phase: [Subsystem / Phase Name]

> **Document Title:** [Master Test Plan Title]  
> **Document Identifier:** `METROLMS-MTP-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 6 Verification Plan  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** QA Automation Engineers, Lead Developers, SREs  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Test Strategy & Objectives
- **Verification Objective:** [What this test plan validates within MetroLMS].
- **Two-Gate Verification Strategy:**
  - **Gate A (In-Memory & Static):** Vitest + MSW v2 mocked tests, route guards, UI rendering.
  - **Gate B (Real-Time Backend & DB):** Pytest + DRF + Microsoft SQL Server live integration.

## 2. Test Scope & Boundaries
- **Features Under Test:** [Numbered list of modules and endpoints].
- **Features Not Tested:** [Explicit out-of-scope capabilities].

## 3. Test Levels & Environment Requirements
| Test Level | Framework / Harness | Test Target | Environment Requirements |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | Vitest / Pytest | Pure utility functions, state reducers | Node.js / Python local |
| **Component Integration** | RTL + MSW v2 | React page surfaces, modals | Node.js DOM mock |
| **API Integration** | Pytest-django | DRF viewsets, permissions, serializers | Docker SQL Server (`D-DB-01`) |
| **E2E System Tests** | Playwright | Full user journeys across 6 roles | Staging Web + App + DB |

## 4. Pass / Fail Criteria & Exit Gates
- **Unit & Component Tests:** 100% pass rate, zero regressions across existing test files.
- **Coverage Target:** >= 85% line coverage on domain business logic and permissions resolvers.
- **Security Invariants:** Zero role ceiling breaches (`INV-R1`..`INV-R10`).

## 5. Test Deliverables & Execution Schedule
- Test cases cataloged in `docs/04-testing/test-cases/`.
- Execution reports logged in `docs/04-testing/execution-reports/`.
