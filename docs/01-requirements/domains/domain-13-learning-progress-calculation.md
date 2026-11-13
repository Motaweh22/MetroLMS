# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 13 — Learning Progress Calculation (`D-12`)

> **Document Title:** Domain 13 — Learning Progress Calculation Business Rules  
> **Document Identifier:** `METROLMS-DOM-LRN-013`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../architecture/decision-register.md#d-06), [`D-12`](../../architecture/decision-register.md#d-12), [`D-13`](../../architecture/decision-register.md#d-13)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Establish one authoritative, deterministic mathematical formula for course completion percentages across every UI surface and backend calculation (`D-12`), eliminating `100%` false-completion rounding bugs and cross-attempt `Math.max` leakage.
- **Domain Boundaries:**
  - *In Scope:* `calculateTraineeProgress(totalItems, completedCount)` formula, `99%` incomplete cap, zero-item safety, `isCompleted` gating, and unified computation across all 7 progress readers.
  - *Out of Scope:* Per-lesson playback thresholds (Domain 14) and certificate artifact generation (Domain 15).
- **Core Entities:** `ComputedAttemptProgress`, `CourseAttempt` *(persistence fields `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM13-01`** | **Authoritative Rounding Formula (`D-12`)** | If `totalItems <= 0` or `completedCount <= 0` -> `0`. If `completedCount === totalItems` -> `100`. Otherwise `Math.min(Math.round((completedCount / totalItems) * 100), 99)`. | `calculateTraineeProgress` (`core/domain/progress.ts`) & `LLD-004` |
| **`INV-DOM13-02`** | **99% Incomplete Cap (`D-12`)** | Whenever `completedRequiredItems < totalRequiredItems`, displayed `progressPercent` MUST NEVER exceed `99%`. | `calculateTraineeProgress` |
| **`INV-DOM13-03`** | **Strict Completion Gate** | `isCompleted === true` if and only if `totalRequiredItems > 0 && completedRequiredItems === totalRequiredItems`. | `computeAttemptProgress` (`inMemoryStore.ts`) |
| **`INV-DOM13-04`** | **No Cross-Attempt `Math.max` (`MFR-33`)** | Progress readers MUST compute from the specific `attemptId` without applying `Math.max` across prior attempts or sticky completion latches. | All 7 Progress Readers |
| **`INV-DOM13-05`** | **Active Version Recalculation (`D-13`, `Rule B`)** | For unsealed attempts, `totalRequiredItems` and valid `completedItemIds` are evaluated against the latest `PublishedCourseVersion` (recalculating active progress if a substantive `Rule B` edit adds items). Sealed attempts retain `sealedCourseVersion`. | `computeAttemptProgress` |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `D-12` defines the exact rounding formula and `99%` cap; `D-13` defines version-aware recalculation for unsealed attempts.
- **Current Prototype Behavior:** `calculateTraineeProgress` (`frontend/src/core/domain/progress.ts` L13–33) and `inMemoryStore.computeAttemptProgress` (L1537–1578) implement all 5 invariants.
- **Implementation Gap:** Computation currently runs in client-side MSW `inMemoryStore.ts`.
- **Target Backend Behavior:** Django progress service (`LLD-004`) computes and persists authoritative `progress_percent` inside `transaction.atomic()` using identical integer rounding (`round()` + `min(..., 99)`).
- **Deferred / Provisional Notice:** Stored `progressPercent` caching vs. on-read calculation columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec / LLD | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM13-01`–`INV-DOM13-03` | [`D-12`](../../architecture/decision-register.md#d-12) | [`LLD-004`](../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md), [`METROLMS-TECH-DOM-013`](../../03-technical-documentation/domains/progress/domain-13-learning-progress-calculation.md) | `progress.test.ts` (25 specs), `progress-rounding-and-versioned-certificates.test.ts` (19 specs) |
| `INV-DOM13-04`, `INV-DOM13-05` | [`D-06`](../../architecture/decision-register.md#d-06), [`D-13`](../../architecture/decision-register.md#d-13) | [`LLD-002`](../../02-architecture-and-design/lld/LLD-002-course-versioning-diff-engine.md), [`LLD-004`](../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md) | `enrollment-provenance.test.ts` (64 specs) |

