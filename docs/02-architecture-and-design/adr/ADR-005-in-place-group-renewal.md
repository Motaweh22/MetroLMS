# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-005` — In-Place Training Group Renewal Architecture

> **Document Title:** In-Place Training Group Renewal and Historical Attempt Sealing  
> **Document Identifier:** `METROLMS-ADR-CORE-005`  
> **Document Status:** `ACCEPTED`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-GRP-01`](../../architecture/decision-register.md#d-grp-01), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Context & Problem Statement
Mandatory compliance and safety training in Cairo Metro recurs periodically (e.g., annually). An architectural choice was required for handling training group records upon cycle expiration: clone new group entities or execute renewals in-place within the existing group record.

## 2. Decision Drivers
- **Entity Identity Stability:** Stable entity IDs for departmental groups across multiple operational years.
- **Data Model Cleanliness:** Preventing exponential proliferation of cloned group records.
- **Historical Integrity:** Permanent preservation and sealing of prior cycle completion records.

## 3. Considered Options
- **Option 1: Group Cloning:** Creating a new `TrainingGroup` record for every recurring cycle.
- **Option 2: In-Place Renewal with Cycle Progression (Chosen):** Increment cycle counter, seal historical attempts, and advance deadlines in the same group entity.

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (In-Place Renewal with Cycle Progression)**.
- **Governing Authority:** Level 1 Owner Decisions [`D-GRP-01`](../../architecture/decision-register.md#d-grp-01) and [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04).

## 5. Pros and Cons of the Options
### Option 2 (In-Place Renewal — Chosen)
- **Positive:** Training group identity remains permanent; supervisor dashboards maintain stable URLs.
- **Positive:** Prior cycle attempts are sealed with `cycle_number` snapshot, preventing historical data corruption.
- **Negative:** Requires transactional orchestration when advancing cycle counter and resetting active attempt states.

## 6. Implementation Notes & Consequences
- Group record tracks `cycle_number` (integer incrementing monotonically).
- Upon renewal trigger, active attempts for prior cycle are marked `sealed: true`.
- Trainee enrollments are refreshed for the new cycle without mutating historical audit records.
