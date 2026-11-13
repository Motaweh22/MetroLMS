# MetroLMS — Test Case Specification
## Test Case Identifier: `TC-[DOMAIN]-[NNN]` — [Test Case Name]

> **Document Title:** [Test Case Title]  
> **Document Identifier:** `METROLMS-TC-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 6 Test Case Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** QA Automation Engineers, Frontend/Backend Developers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Test Summary
- **Target Component:** [Module, API endpoint, or UI surface].
- **Target Invariant / Requirement:** [Cross-reference to `REQ-ID` or `INV-ID`].
- **Test Type:** `[Unit | Integration | Regression | Security | End-to-End]`
- **Gate Classification:** `[Gate A (Mocked) | Gate B (Live Backend/DB)]`

## 2. Preconditions & Test Setup
1. Active session exists for user identity: `[e.g., usr_trainee_001]`.
2. Database state seeded with: `[Fixture or factory setup]`.
3. System time set to: `[Standard or fixed timestamp for deadline tests]`.

## 3. Test Steps & Expected Results
| Step # | Action Description | Test Data / Payload | Expected System Response | Status |
| :-: | :--- | :--- | :--- | :-: |
| 1 | Navigate to target surface | `/courses/c_001/learn` | Course player renders with active lesson | `PASS` |
| 2 | Complete video playback | `100% elapsed` | Progress bar updates, next lesson unblocks | `PASS` |
| 3 | Submit assessment answers | `Score: 85%` | Passing gate achieved, attempt sealed | `PASS` |

## 4. Post-Execution Cleanup
- State teardown steps or database rollback commands.
