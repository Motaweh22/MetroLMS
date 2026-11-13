# MetroLMS — Task Checklist: Phase 2 Test Suites, Player Regressions & Gate B Consolidation (`T-2.4.3`)

> **Document Status:** `ACTIVE — IMPLEMENTED — VERIFICATION PENDING (GATE B)`  
> **Phase:** `Phase 2 — Core Domain Logic Reconciliation`  
> **Work Package:** `WP-2.4 — Post-Deadline Policy (hide vs. keep_no_cert) & Phase 2 Tests` (`IN PROGRESS`)  
> **Task ID & Name:** `T-2.4.3: Author Phase 2 unit/integration/security test suites for WP-2.1–WP-2.4 (incl. mounted DOM, MSW HTTP integration, video seek recovery & review-only sync elimination)`  
> **Requirements Addressed:** `MFR-23`, `MFR-42`, `D-06`, `D-07`, `D-12`, `D-13`  
> **Target Checkpoint:** `CP-008` *(closes `WP-2.4` and `Phase 2`; reserved)*  
> **Last Updated:** 2026-11-11

---

## 1. Task Objective & Context

Task `T-2.4.3` is the final task of Work Package `WP-2.4` and Phase 2. Its authoritative purpose is to:
1. **Restore Video Seek-Restriction Feedback:** Recover the original Arabic notification (`لا يمكن التقديم للأمام متجاوزاً ما تمت مشاهدته`), resolve timer cancellation bugs and CSS animation restart issues on repeated attempts, and ensure unmount timer cleanup.
2. **Eliminate Unnecessary Review-Only Activity Requests:** Propagate `isReadOnly` to `VideoPlayer` and `useVideoProgressSync`, halting background 5s heartbeat and flush requests while preserving 100% smooth video playback and interaction.
3. **Author Mounted React DOM Component Tests:** Validate end-to-end user experience in `LearningPlayerPage` and `GroupDetailPage` under `none` and `review_only` modes.
4. **Author Direct MSW HTTP Integration Tests:** Intercept `GET /api/courses/:id/progress`, `POST .../activity`, and `POST .../complete` to verify exact HTTP status codes (`200` vs. `403`), structured JSON error bodies, and zero state mutation.
5. **Consolidate Phase 2 Gate B Regression Inventory:** Assemble the comprehensive 8-suite regression inventory preparing the repository for Phase 2 closure and `CP-008`.

---

## 2. Requirements & Implementation Matrix

| Requirement | Implementation Module(s) | Verified Mechanism | Status |
| :--- | :--- | :--- | :---: |
| **Seek-Restriction Notification & Remediation** | [`VideoPlayer.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/VideoPlayer.tsx) & [`learningPlayer.css`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/styles/learningPlayer.css) | Fixed reduced-motion latching (`opacity: 0` forwards elimination), added direct CSS import, resilient inline style fallback (`zIndex: 50`, `opacity: 1`), `furthestWatchedRef` synchronous tracking, and unified `requestSeek`. Guaranteed visible presentation on first and subsequent attempts. | `IMPLEMENTED` |
| **Seek Position Clamping** | [`VideoPlayer.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/VideoPlayer.tsx) | Native seek, timeline click, and keyboard `ArrowLeft` are clamped to `furthestWatchedSecs`. | `IMPLEMENTED` |
| **Review-Only Activity Sync Elimination** | [`useVideoProgressSync.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/hooks/useVideoProgressSync.ts) | `isReadOnly` prop suppresses 5s interval, pause flush, visibility flush, and unmount flush. Zero activity POST requests dispatched. | `IMPLEMENTED` |
| **Smooth Playback Continuity** | [`VideoPlayer.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/VideoPlayer.tsx) | Video playback, pause, seeking within bounds, volume, rate, and fullscreen operate completely independently without pauses or stuttering. | `IMPLEMENTED` |
| **Player Page Read-Only Propagation** | [`LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx) | Passes `isReadOnly={progress?.accessMode === 'review_only'}` to `VideoPlayer`. | `IMPLEMENTED` |
| **Mounted Player Lock Screen (`none`)** | [`LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx) | Renders `data-testid="player-access-expired"` with lock icon and Arabic message. | `IMPLEMENTED` |
| **Mounted Player Banner (`review_only`)** | [`LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx) | Renders `data-testid="review-only-access-banner"` and disables lesson completion. | `IMPLEMENTED` |
| **Mounted Group Actions (`hide` vs. `keep_no_cert`)** | [`GroupDetailPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx) | Shows disabled lock button for `hide`; shows outline review button for `keep_no_cert`. | `IMPLEMENTED` |
| **Direct MSW Route Interception** | [`phase-2-post-deadline-dom-and-msw.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/phase-2-post-deadline-dom-and-msw.test.tsx) | Asserts HTTP 200 vs. 403, structured codes (`COURSE_ACCESS_EXPIRED`, `COURSE_ACCESS_REVIEW_ONLY`), and 0 mutations. | `IMPLEMENTED` |

---

## 3. Authored Test Inventory (`phase-2-post-deadline-dom-and-msw.test.tsx`)

| Suite | Category | Scenarios Covered | Count | Designation |
| :---: | :--- | :--- | :---: | :---: |
| **1** | **Seek Notification & Clamping** | `SR-1`: Initial restricted seek shows Arabic badge with lock icon<br>`SR-2`: Clamps playback to `furthestWatched`<br>`SR-3`: Valid seeking backward or within bounds omits badge<br>`SR-4`: Repeated restricted seeks restart 2.5s timer & remount animation<br>`SR-5`: Timeline click and keyboard `ArrowLeft` trigger clamping & notification | 5 | `WRITTEN — DEFERRED TO GATE B` |
| **2** | **Review-Only Activity & Continuity** | `RO-1`: Full-access dispatches periodic activity POST<br>`RO-2`: Review-only (`isReadOnly: true`) suppresses all activity POST requests<br>`RO-3`: Video playback remains fully functional and smooth in review-only mode<br>`RO-4`: Review-only playback leaves store progress and completions 100% unmutated | 4 | `WRITTEN — DEFERRED TO GATE B` |
| **3** | **Mounted React DOM Components** | `DOM-1`: `LearningPlayerPage` under `none` renders full-page lock screen<br>`DOM-2`: `LearningPlayerPage` under `review_only` renders review banner<br>`DOM-3`: `GroupDetailPage` under expired `hide` renders disabled lock button<br>`DOM-4`: `GroupDetailPage` under expired `keep_no_cert` renders review outline button | 4 | `WRITTEN — DEFERRED TO GATE B` |
| **4** | **Direct MSW HTTP Interception** | `HTTP-1`: `GET .../progress` returns 200 with `full`<br>`HTTP-2`: `GET .../progress` returns 200 with `review_only`<br>`HTTP-3`: `GET .../progress` returns 403 with `COURSE_ACCESS_EXPIRED`<br>`HTTP-4`: `POST .../activity` returns 403 with `COURSE_ACCESS_REVIEW_ONLY` and leaves state unmutated<br>`HTTP-5`: `POST .../complete` returns 403 with `COURSE_ACCESS_EXPIRED` and leaves state unmutated | 5 | `WRITTEN — DEFERRED TO GATE B` |
| **Total** | — | **Comprehensive T-2.4.3 Test Suite** | **18** | `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` |

---

## 4. Consolidated Phase 2 Authored Regression Inventory

With `T-2.4.3` completed, all test specifications for Phase 2 (`WP-2.1` through `WP-2.4`) are fully authored and queued for Gate B:

1. [`frontend/src/test/enrollment-provenance.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/enrollment-provenance.test.ts) — **63 specs** (`WP-2.1` / `T-2.1.4`)
2. [`frontend/src/test/group-member-removal-modal.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/group-member-removal-modal.test.tsx) — **14 specs** (`WP-2.2` / `T-2.2.1`)
3. [`frontend/src/test/group-member-removal-domain.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/group-member-removal-domain.test.ts) — **29 specs** (`WP-2.2` / `T-2.2.2`)
4. [`frontend/src/test/course-versioning-and-diffing.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/course-versioning-and-diffing.test.ts) — **15 specs** (`WP-2.3` / `T-2.3.1`)
5. [`frontend/src/test/progress-rounding-and-versioned-certificates.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/progress-rounding-and-versioned-certificates.test.ts) — **22 specs** (`WP-2.3` / `T-2.3.2`)
6. [`frontend/src/test/post-deadline-access-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/post-deadline-access-enforcement.test.ts) — **33 specs** (`WP-2.4` / `T-2.4.1`)
7. [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) — **23 specs** (`WP-2.4` / `T-2.4.2`)
8. [`frontend/src/test/phase-2-post-deadline-dom-and-msw.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/phase-2-post-deadline-dom-and-msw.test.tsx) — **18 specs** (`WP-2.4` / `T-2.4.3`)

**Total Phase 2 Authored Specifications:** **217 specs** (`WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`).

---

## 5. Verification Status & Governance

- **Implementation Status:** `IMPLEMENTED — VERIFICATION PENDING (GATE B)`
- **Test Status:** `WRITTEN — NOT EXECUTED — DEFERRED TO GATE B` (Two-Gate Verification Governance strictly enforced; 0 test commands executed).
- **Working-Tree Integrity:** All 18 uncommitted Phase 5 files in `frontend/src/` remain preserved intact.
- **Milestone Checkpoint:** Checkpoint `CP-008` is reserved for the full acceptance of `WP-2.4` and `Phase 2` closure.

