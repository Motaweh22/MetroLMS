# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 13 — Learning Progress Calculation (`D-12`)

> **Document Title:** Technical Domain Specification — Learning Progress Calculation  
> **Document Identifier:** `METROLMS-TECH-DOM-013`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../../architecture/decision-register.md#d-06), [`D-12`](../../../architecture/decision-register.md#d-12), [`D-13`](../../../architecture/decision-register.md#d-13)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `calculateTraineeProgress` (`core/domain/progress.ts`), `inMemoryStore.computeAttemptProgress`, `learningApi.getCourseProgress` (`GET /api/courses/:courseId/progress`).
- **Target Backend Components (Django 5 + DRF — Proposed):** Shared `ProgressCalculationPipeline` (`LLD-004`) invoked consistently across course player, enrollments, group monitoring, performance reports, and user transcripts.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Deterministic Formula (`D-12`):**
   - `0%` when `totalItems <= 0` or `completedCount <= 0`.
   - `100%` iff `completedCount === totalItems`.
   - `min(round((completedCount / totalItems) * 100), 99)` otherwise.
2. **Single-Source Consistency:**
   - All 7 progress readers (`getCourseProgress`, `getMyEnrollments`, `getAdminGroupById`, `getGroupMonitoringData`, `getCoursePerformanceReport`, `getUserTranscript`, `getDashboardData`) derive percentages from `computeAttemptProgress` without cross-attempt `Math.max`.
3. **Version-Aware Recalculation (`Rule B`):**
   - Unsealed attempts evaluate `totalRequiredItems` against the latest `PublishedCourseVersion`; sealed attempts preserve `sealedCourseVersion`.

---

## 3. Validation, Authorization & Failure Scenarios

- **Zero-Division Safety:** Empty courses (`totalItems === 0`) return `0%` and `isCompleted: false`.
- **Provisional Persistence Notice:** Progress aggregate fields remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-LRN-013`](../../../01-requirements/domains/domain-13-learning-progress-calculation.md)
- **Low-Level Design:** [`LLD-004`](../../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md)
- **Verification Evidence:** `progress.test.ts` (25 specs), `progress-rounding-and-versioned-certificates.test.ts` (19 specs) (deferred to Gate B).

