# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-006` — Day-Based Calendar Recurrence Measurement

> **Document Title:** Day-Based Calendar Recurrence Calculation Standard  
> **Document Identifier:** `METROLMS-ADR-CORE-006`  
> **Document Status:** `ACCEPTED`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-GRP-02`](../../architecture/decision-register.md#d-grp-02)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Context & Problem Statement
Recurring training intervals must be calculated deterministically. Calendar months vary in length (28–31 days), and leap years introduce variability. Using variable month increments can cause shifting renewal deadlines across operational shifts.

## 2. Decision Drivers
- **Mathematical Determinism:** Consistent, predictable deadline arithmetic across frontend and backend.
- **Leap Year Stability:** Absence of date shifting bugs on February 29th.
- **Audit Simplicity:** Deadlines expressible in exact day intervals.

## 3. Considered Options
- **Option 1: Variable Calendar Month Arithmetic:** Adding nominal months (`+1 month`, `+12 months`).
- **Option 2: Exact Day-Based Recurrence Measurement (Chosen):** Computing intervals strictly in integer days (`30 days`, `365 days`).

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (Exact Day-Based Recurrence Measurement)**.
- **Governing Authority:** Level 1 Owner Decision [`D-GRP-02`](../../architecture/decision-register.md#d-grp-02).

## 5. Implementation Notes & Consequences
- All renewal recurrence schedules are parameterized and calculated in integer calendar days.
- Eliminates ambiguous end-of-month date overflows (e.g., August 31 + 1 month).
