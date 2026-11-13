# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-007` — Persistent Monotonic Reminder Classification (`hasHistoricalReminderCourses`)

> **Document Title:** Persistent Monotonic Reminder Classification Marker  
> **Document Identifier:** `METROLMS-ADR-CORE-007`  
> **Document Status:** `ACCEPTED (RECONCILED TO D-GRP-06)`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-GRP-06`](../../architecture/decision-register.md#d-grp-06)  
> **Last Updated:** 2026-11-13 (Governance Reconciliation `METROLMS-API-DOC-REMEDIATION-01`)

---

## 1. Context & Problem Statement
In MetroLMS reminder programs (`D-GRP-03`), assigning at least one course with `courseRole === 'reminder'` classifies a `TrainingGroup` as `groupType: 'reminder'`. If an administrator later removes the last currently assigned reminder course from the active cycle, computing `groupType` purely from current assignments would silently downgrade the group back to `'regular'` and erase its historical reminder program identity.

## 2. Decision Drivers
- **Classification Monotonicity:** Once a group has hosted a reminder-designated course, its reminder classification must persist permanently.
- **Audit & Cycle Traceability:** Historical cycle assignments must remain distinguishable without corrupting group-level classification.

## 3. Considered Options
- **Option 1: Stateless Current-Course Classification:** Derive `groupType` solely from currently assigned courses.
- **Option 2: Persistent Monotonic `hasHistoricalReminderCourses` Marker (Chosen):** Persist a write-once boolean marker (`hasHistoricalReminderCourses = true` / SQL `has_historical_reminder_courses BIT NOT NULL DEFAULT 0`).

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (Persistent Monotonic `hasHistoricalReminderCourses` Marker)**.
- **Governing Authority:** Level 1 Owner Decision [`D-GRP-06`](../../architecture/decision-register.md#d-grp-06).

## 5. Implementation Notes & Consequences
- `resolveGroupType(group, cycle)` checks `group.hasHistoricalReminderCourses === true` first; removing the last reminder course does not revert `groupType` to `'regular'`.
- **Governance Reconciliation Note:** An earlier Phase 1 draft of this ADR erroneously associated `D-GRP-06` with a `reminder_type` notification progression (`initial -> halfway -> urgent`). That notification tiering is **not** part of `D-GRP-06` and remains unapproved/unimplemented; the current MSW prototype instead implements a 7-day `deadline_reminder` notification with `dedupeKey` in `inMemoryStore.checkAndProcessAllDueRenewals` (pending Owner decision if desired for production).
