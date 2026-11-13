# MetroLMS — Standard Operating Procedure (SOP)
## SOP Identifier: `SOP-[DOMAIN]-[NNN]` — [Procedure Title]

> **Document Title:** [SOP Title]  
> **Document Identifier:** `METROLMS-SOP-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 5 Operations & Maintenance Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** System Administrators, Security Officers & Operational Staff  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Purpose & Administrative Scope
- **Objective:** [Formal procedure objective, e.g., User Offboarding D-01/D-02].
- **Scope:** [Applicable administrative roles and systems].
- **Regulatory Driver:** [NTRA compliance, corporate privacy policies].

## 2. Roles, Responsibilities & Approvals
| Action Step | Responsible Role | Required Approval Authority |
| :--- | :--- | :--- |
| Initiation | Department Supervisor | Written request to Training Admin |
| Execution | System Administrator | Dual-authorization signoff |
| Audit Verification | System Auditor | Post-execution log verification |

## 3. Prerequisites & Safety Precautions
- **Backup Verification:** Ensure recent SQL Server transaction log backup exists.
- **Maintenance Window:** Execute during scheduled non-peak hours if affecting sessions.

## 4. Step-by-Step Execution Sequence
1. **Step 1 (Authentication & Verification):** Log in as authorized Administrator.
2. **Step 2 (Execution):** Execute administrative command or UI action.
3. **Step 3 (Validation):** Verify state changes via administrative dashboard.
4. **Step 4 (Audit Logging):** Record execution ticket ID in audit log.

## 5. Rollback & Emergency Abort Procedure
- [Exact rollback commands or database state restoration procedure].
