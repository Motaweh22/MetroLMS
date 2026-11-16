# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 18 — Administrative Workflows & Sensitive Approvals (`INV-R9` / `INV-R10`)

> **Document Title:** Domain 18 — Administrative Workflows & Sensitive Approvals Business Rules  
> **Document Identifier:** `METROLMS-DOM-OPS-018`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-04`](../../architecture/decision-register.md#d-04), [`D-05`](../../architecture/decision-register.md#d-05), [`D-14`](../../architecture/decision-register.md#d-14), [`INV-R1`–`INV-R10`](../../architecture/security-and-xss-baseline.md)  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Enforce two-tier administrative governance (`Rule A`) for sensitive operations initiated by `assistant_admin` without active delegation (`HTTP 202 Accepted` -> `PendingApproval`), authentic actor attribution, and fail-closed re-validation upon approval execution (`INV-R9`, `INV-R10`).
- **Domain Boundaries:**
  - *In Scope:* `ApprovalRequest` lifecycle (`pending`, `approved`, `rejected`, `failed_execution`), `HTTP 202 Accepted` interception, explicit per-capability `DelegatedAuthority` bypass, authentic requester vs. approver attribution (`D-14` neutral projection for `developer`), `409 ALREADY_DECIDED` idempotency, and `INV-R10` execution-time target/scope re-validation.
  - *Out of Scope:* Course curriculum review workflow (`/api/approvals/queue`, Domains 05/07) and group QR join requests (Domain 09).
- **Core Entities:** `ApprovalRequest`, `DelegatedAuthority`, `SystemAuditLogEntryDTO` *(all persistence fields remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM18-01`** | **Default `202 Accepted` Interception (`INV-R9`)** | Sensitive mutations by `assistant_admin` without an active matching `DelegatedAuthority` capability key do **not** execute immediately; they create a `pending` `ApprovalRequest` and return `HTTP 202 Accepted` (`{ approvalRequired: true, requestId }`). | API Handler / Governance Middleware |
| **`INV-DOM18-02`** | **Explicit Delegation Bypass** | When an active `DelegatedAuthority` covers the exact capability key, `assistant_admin` executes directly (`200`/`201`) while still subject to role ceilings (`INV-R1`–`INV-R8`). | Governance Evaluator |
| **`INV-DOM18-03`** | **Execution-Time Re-Validation (`INV-R10`)** | Approving an `ApprovalRequest` re-validates target existence (`404` if deleted), approver role ceilings (`INV-R1`–`INV-R8`), and payload integrity inside an atomic boundary. Failures transition the request to `failed_execution` without partial mutation. | Approval Executor |
| **`INV-DOM18-04`** | **Idempotent Decision Guard** | Attempting to approve or reject an already decided (`approved`, `rejected`, `failed_execution`) request returns `409 ALREADY_DECIDED`. | Approval Decision Endpoint |
| **`INV-DOM18-05`** | **Authentic Actor Attribution & `D-14` Masking** | `requestedBy` and `reviewedBy` record the authentic session user (never hardcoded fallback `'admin'`). When `developer` acts, non-developer viewers see `SYSTEM` / `'النظام'` (`D-14`). | Governance & Audit Logger |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `INV-R9` (`202 Accepted` default), `INV-R10` (re-validation on execution), `D-04`/`D-05` role ceilings, `D-14` neutral projection, and `OBS-01` **reconciled by Owner Clarification (`2026-11-13`)**: `Superior` and `Super Admin` (`super_admin`) are the same Tier 1 administrative role (inheriting all `admin` capabilities plus exclusive non-Developer `admin` appointment).
- **Current Prototype Behavior:** `permissionsApi.ts` (`/api/admin/permissions/governance/approvals*`, `/delegation/:userId`), `permissionsHandlers.ts`, `inMemoryStore.ts`.
- **Implementation Gap:** Prototype executes approval mutations synchronously in-memory without SQL Server row locking (`SELECT FOR UPDATE`) on the `ApprovalRequest` row.
- **Target Backend Behavior:** Django executes approval decisions inside `transaction.atomic()` with `select_for_update()` on `ApprovalRequest`, preserving `409 ALREADY_DECIDED`, `failed_execution`, and `INV-R10` re-validation.
- **Deferred / Provisional Notice:** `ApprovalRequest` and `DelegatedAuthority` schema columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM18-01`–`INV-DOM18-04` | `INV-R9`, `INV-R10`, `MFR-35`, `MFR-44` | [`METROLMS-TECH-DOM-018`](../../03-technical-documentation/domains/operations/domain-18-administrative-workflows-and-sensitive-approvals.md) | `approval-lifecycle-execution.test.ts` (74 specs), `assistant-admin-default-approval.test.ts` (29 specs) |
| `INV-DOM18-05` | [`D-14`](../../architecture/decision-register.md#d-14) | [`METROLMS-TECH-DOM-018`](../../03-technical-documentation/domains/operations/domain-18-administrative-workflows-and-sensitive-approvals.md) | `approval-ui-integration-and-attribution.test.ts` (26 specs), `permissions-governance.test.tsx` |

