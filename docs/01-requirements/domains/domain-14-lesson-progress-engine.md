# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 14 — Lesson Progress Engine

> **Document Title:** Domain 14 — Lesson Progress Engine Business Rules  
> **Document Identifier:** `METROLMS-DOM-LRN-014`  
> **Document Status:** `DRAFT — PHASE 3 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-06`](../../architecture/decision-register.md#d-06), [`D-12`](../../architecture/decision-register.md#d-12), `MFR-21` (Preview Isolation)  
> **Last Updated:** 2026-11-13 (Phase 3 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern per-lesson playback telemetry (`lastPositionSeconds`, `furthestWatchedSeconds`, `eligibleViewingSeconds`), sequential lesson locking (`isLessonLocked`), deterministic resume lesson resolution (`resolveResumeLesson`), lesson completion, and strict preview isolation (`MFR-21`).
- **Domain Boundaries:**
  - *In Scope:* Lesson sequencing lock rules, resume priority hierarchy, anti-seek-forward enforcement (`furthestWatchedSeconds`), foreground viewing telemetry (`eligibleViewingSeconds`), `recordActivity` & `completeLesson` mutations, and preview-mode non-persistence.
  - *Out of Scope:* Course-level percentage aggregation (Domain 13), binary video hosting/streaming transport (`D-MEDIA-01`, deferred under `API-REC-06`).
- **Core Entities:** `LessonProgress`, `ChapterItem` *(persistence fields `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM14-01`** | **Sequential Lesson Locking** | Index `0` is always unlocked for trainees. Lesson `N > 0` is unlocked for `'user'` iff `flatItems[N-1].id` is in `completedItemIds`. Staff roles (`admin`, `super_admin`, `developer`, `assistant_admin`, `lecturer`) bypass locking. | `isLessonLocked` (`core/domain/progress.ts`) & Backend Completion Guard |
| **`INV-DOM14-02`** | **Resume Lesson Hierarchy** | `resolveResumeLesson` selects: (1) `lastWatchedItemId` if valid & unlocked, else (2) first incomplete unlocked item, else (3) first item. Trainees never resume into a locked lesson. | `resolveResumeLesson` (`core/domain/progress.ts`) |
| **`INV-DOM14-03`** | **Monotonic Furthest-Watched & Foreground Telemetry** | `furthestWatchedSeconds` and `eligibleViewingSeconds` advance monotonically (`Math.max(existing, incoming)`) to support anti-seek-ahead clamping and minimum viewing-time gates. | `inMemoryStore.recordLessonActivity` |
| **`INV-DOM14-04`** | **Preview Non-Persistence (`MFR-21`)** | When `authResolution.isPreview === true` (non-trainee previewing course), `recordActivity` and `completeLesson` return simulated responses without mutating trainee `CourseAttempt` or `LessonProgress` records. | `learningHandlers.ts` / `inMemoryStore.ts` |
| **`INV-DOM14-05`** | **Sealed & Post-Deadline Mutation Block** | `recordActivity` and `completeLesson` reject mutations (`403`) on `isSealed` attempts or when `accessMode` is `'review_only'` / `'none'`. | Learning Service |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** Sequential locking (`isLessonLocked`), resume hierarchy (`resolveResumeLesson`), preview isolation (`MFR-21`), and post-deadline/sealed-attempt protection.
- **Current Prototype Behavior:** `core/domain/progress.ts`, `useVideoProgressSync.ts`, `learningApi.ts`, `learningHandlers.ts`, and `inMemoryStore.ts` (L3098, L3271). Note: `learningApi.recordActivity` and `completeLesson` currently lack direct HTTP payload assertions in Vitest (exercised via UI integration tests).
- **Implementation Gap:** Server-side duration/viewing-time validation against trusted media metadata is prototype-only; `learningHandlers.ts` also hosts 4 legacy/alternative routes (`/lessons/...` and body-based `itemId`) slated for exclusion under `API-REC-02`.
- **Target Backend Behavior:** Django exposes canonical `/api/courses/:courseId/items/:itemId/{activity,complete}` endpoints, enforcing sequential lock, `isSealed`, `accessMode`, and monotonic telemetry inside `transaction.atomic()`.
- **Deferred / Provisional Notice:** `LessonProgress` telemetry columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec / LLD | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM14-01`, `INV-DOM14-02` | Legacy Resume & Lock Contract | [`LLD-004`](../../02-architecture-and-design/lld/LLD-004-progress-calculation-pipeline.md), [`METROLMS-TECH-DOM-014`](../../03-technical-documentation/domains/progress/domain-14-lesson-progress-engine.md) | `progress.test.ts` (25 specs), `learning-player.test.tsx` (28 specs) |
| `INV-DOM14-03`–`INV-DOM14-05` | [`D-06`](../../architecture/decision-register.md#d-06), `MFR-21` | [`METROLMS-TECH-DOM-014`](../../03-technical-documentation/domains/progress/domain-14-lesson-progress-engine.md) | `phase-2-post-deadline-dom-and-msw.test.tsx` (18 specs), `course-review-visibility-and-preview.test.ts` |

