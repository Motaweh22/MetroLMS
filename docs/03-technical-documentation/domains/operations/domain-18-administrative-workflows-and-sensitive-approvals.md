# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 18 — Administrative Workflows & Sensitive Approvals (`INV-R9` / `INV-R10`)

> **Document Title:** Technical Domain Specification — Administrative Workflows & Sensitive Approvals  
> **Document Identifier:** `METROLMS-TECH-DOM-018`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-04`](../../../architecture/decision-register.md#d-04), [`D-05`](../../../architecture/decision-register.md#d-05), [`D-14`](../../../architecture/decision-register.md#d-14), `INV-R1`–`INV-R10`  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `permissionsApi.ts` (`getDelegatedAuthority`, `setDelegatedAuthority`, `getApprovalRequests`, `createApprovalRequest`, `approveApprovalRequest`, `rejectApprovalRequest`), `permissionsHandlers.ts`, `inMemoryStore.ts`.
- **Target Backend Components (Django 5 + DRF — Proposed):** Governance decorator/middleware intercepting sensitive `assistant_admin` mutations (`202 Accepted`) + atomic approval executor (`select_for_update()`).

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Interception (`INV-R9`):**
   - `assistant_admin` without active `DelegatedAuthority` for the exact capability key receives `202 Accepted` (`{ approvalRequired: true, requestId }`) and creates a `pending` `ApprovalRequest`.
2. **Approval & Re-Validation (`INV-R10`):**
   - `POST /api/admin/permissions/governance/approvals/:id/approve` locks the request row, rejects already-decided requests (`409 ALREADY_DECIDED`), re-validates target existence (`404` -> `failed_execution`) and approver role ceilings (`INV-R1`–`INV-R8`), executes the mutation atomically, and logs authentic actor attribution (`D-14` `SYSTEM` projection for `developer`).
3. **Open Ambiguity (`OBS-01`):** `super_admin` vs. `superior` alias mapping remains unresolved pending Owner clarification prior to Phase 5.

---

## 3. Validation, Authorization & Failure Scenarios

- **Failure Atomicity:** If target mutation fails during approval execution, status transitions to `failed_execution` (never `approved`).
- **Provisional Persistence Notice:** `ApprovalRequest` and `DelegatedAuthority` fields remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-OPS-018`](../../../01-requirements/domains/domain-18-administrative-workflows-and-sensitive-approvals.md)
- **Verification Evidence:** `approval-lifecycle-execution.test.ts` (74 specs), `approval-ui-integration-and-attribution.test.ts` (26 specs), `assistant-admin-default-approval.test.ts` (29 specs) (deferred to Gate B).

