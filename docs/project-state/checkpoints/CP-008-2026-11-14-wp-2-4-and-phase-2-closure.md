# Checkpoint `CP-008` — WP-2.4 & Phase 2 Closure (Post-Deadline Access Policy `hide` vs. `keep_no_cert`, Video Player Regressions & Phase 2 Regression Suites `MFR-23`, `MFR-42`)

> **Document Status:** `FROZEN — IMMUTABLE CHECKPOINT`  
> **Checkpoint ID:** `CP-008`  
> **Previous Checkpoint Reference:** [`CP-007-2026-11-10-wp-2-3-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) (`CP-007`)  
> **Milestone Completed:** Formal Owner Acceptance & Closure of **`WP-2.4 — Post-Deadline Policy (hide vs. keep_no_cert) & Phase 2 Tests`** and **`Phase 2 — Core Domain Logic Reconciliation`**

---

## 1. Checkpoint ID
`CP-008`

## 2. Date / Timestamp
`2026-11-14`

## 3. Previous Checkpoint Reference
[`CP-007-2026-11-10-wp-2-3-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-007-2026-11-10-wp-2-3-closure.md) (`CP-007` — WP-2.3 Closure: Curriculum Versioning `Rule B`, Authoritative Progress Rounding `D-12` & Version-Scoped Certificates `D-13`, `MFR-10, 09, 46`)

## 4. Phase / Work Package / Increment Completed
**`Phase 2 — Core Domain Logic Reconciliation` / `WP-2.4 — Post-Deadline Policy (hide vs. keep_no_cert) & Phase 2 Tests`** (Formally closes both `WP-2.4` — comprising `T-2.4.1`, `T-2.4.2`, and `T-2.4.3` — and **`Phase 2`**, following the completed [`METROLMS-WP-2.4-LOGIC-AND-DOCUMENTATION-REVIEW.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/METROLMS-WP-2.4-LOGIC-AND-DOCUMENTATION-REVIEW.md) and explicit Owner acceptance of `T-2.4.3` on `2026-11-14`, preserving prior `2026-11-11` Owner acceptances of `T-2.4.1` and `T-2.4.2`).

## 5. Status
`COMPLETED AND ACCEPTED (IMPLEMENTED — RUNTIME VERIFICATION DEFERRED TO PHASE 4 / GATE B)`

## 6. Summary of What Was Completed

### A. `T-2.4.1` — Post-Deadline Access Enforcement (`hide` vs. `keep_no_cert`, `MFR-23`, `MFR-42`) *(Owner Accepted `2026-11-11`, Preserved)*
1. **Centralized Multi-Source Access Resolver:** Implemented `inMemoryStore.resolveCourseAccess(userId, courseId, now): CourseAccessMode` enforcing `full > review_only > none` across multi-source enrollments.
2. **Completed-Trainee Exemption Removal (`MFR-42`):** Eliminated `&& !progress.isCompleted` so expired `postDeadlinePolicy: 'hide'` group courses are hidden/denied for all group trainees (including 100%-completed trainees), unless another active grant (`self:catalog:...`, `self:continued:...` per `D-07`, or another active group) exists.
3. **Historical Certificate Preservation (`D-13`):** Preserved earned `CertificateRecord` entries permanently in `this.certificates` even when a group course expires under `'hide'`.
4. **Authored Regression Suite:** **33** specifications authored in [`frontend/src/test/post-deadline-access-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/post-deadline-access-enforcement.test.ts) (`WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`).

### B. `T-2.4.2` — Seven-Surface Enforcement & Multi-Attempt Cross-Mutation Isolation (`MFR-23`, `MFR-42`) *(Owner Accepted `2026-11-11`, Preserved)*
1. **Seven-Surface Parity:** Enforced `'none'` (`403 COURSE_ACCESS_EXPIRED`) and `'review_only'` (`403 COURSE_ACCESS_REVIEW_ONLY` on writes, zero progress mutation, no new certificates) across My Courses, Dashboard, Group Details, Learning Player, Progress Read API, Activity/Completion Mutation APIs, and Version-Scoped Certificate Issuance.
2. **Attempt-Scoped Authorization:** Updated `assertLearnerAttemptEntitlement`, `resolveActiveAttemptForLearning`, and `getCourseProgress` so expired `'hide'` attempts fail closed with `403 COURSE_ACCESS_EXPIRED` without cross-attempt elevation from unrelated active grants.
3. **UI Access-Mode Distinction:** Updated `GroupDetailPage.tsx`, `LearningPlayerPage.tsx`, `ImageViewer.tsx`, and `DocumentViewer.tsx` with explicit `review_only` / `none` states.
4. **Authored Regression Suite:** **23** specifications authored in [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) covering Scenarios A, B, and C (`WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`).

### C. `T-2.4.3` — Video Player Regressions, Mounted DOM/MSW Tests & Phase 2 Consolidation *(Owner Accepted `2026-11-14`)*
1. **Video Seek-Restriction Notification Recovery:** Restored visible Arabic clamping notification (`"لا يمكن التقديم للأمام متجاوزاً ما تمت مشاهدته"`) in `VideoPlayer.tsx` and `learningPlayer.css` (direct CSS import, `.seeking-clamped-badge` `opacity: 1 !important`, `z-index: 50 !important`, `seekBadgeFadeIn`, `@media (prefers-reduced-motion: reduce)` override, inline style fallback, synchronous `furthestWatchedRef`, and unified `requestSeek` / `handleSeeking` clamping).
2. **Review-Only Activity Sync Suppression & Playback Continuity:** Added `isReadOnly` propagation to `VideoPlayer` and `useVideoProgressSync` to suppress 5s heartbeat, pause, visibility, and unmount `POST /activity` sync requests while preserving smooth HTML5 video playback.
3. **Authored Mounted DOM & MSW HTTP Suite:** **18** specifications authored in [`frontend/src/test/phase-2-post-deadline-dom-and-msw.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/phase-2-post-deadline-dom-and-msw.test.tsx) (`SR-1..5`, `RO-1..4`, `DOM-1..4`, `HTTP-1..5`), completing **217** total Phase 2 specs across 8 test files (`WRITTEN — NOT EXECUTED — DEFERRED TO GATE B`).

---

## 7. Files Created, Updated, Moved, or Archived

- **WP-2.4 Source & UI Modules (from `T-2.4.1`–`T-2.4.3`):**
  - `frontend/src/core/courses/types.ts`, `frontend/src/mocks/store/inMemoryStore.ts`, `frontend/src/mocks/handlers/learningHandlers.ts`
  - `frontend/src/pages/MyCoursesPage.tsx`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/GroupDetailPage.tsx`, `frontend/src/pages/LearningPlayerPage.tsx`
  - `frontend/src/features/learning-player/components/VideoPlayer.tsx`, `ImageViewer.tsx`, `DocumentViewer.tsx`, `hooks/useVideoProgressSync.ts`, `styles/learningPlayer.css`
- **WP-2.4 Authored Test Suites (`74` specs in `WP-2.4`, `217` total in `Phase 2`):**
  - [`frontend/src/test/post-deadline-access-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/post-deadline-access-enforcement.test.ts) (`33` specs)
  - [`frontend/src/test/seven-surface-post-deadline-enforcement.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/seven-surface-post-deadline-enforcement.test.ts) (`23` specs)
  - [`frontend/src/test/phase-2-post-deadline-dom-and-msw.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/phase-2-post-deadline-dom-and-msw.test.tsx) (`18` specs)
- **Review, Checklist & Report Documents:**
  - [`docs/project-state/METROLMS-WP-2.4-LOGIC-AND-DOCUMENTATION-REVIEW.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/METROLMS-WP-2.4-LOGIC-AND-DOCUMENTATION-REVIEW.md)
  - `docs/frontend/reports/t-2-4-1-post-deadline-access-enforcement-report.md`, `t-2-4-2-seven-surface-enforcement-report.md`, `t-2-4-3-phase-2-test-suites-and-player-regressions-report.md`
  - `docs/frontend/checklists/t-2-4-1-post-deadline-access-enforcement-checklist.md`, `t-2-4-2-seven-surface-enforcement-checklist.md`, `t-2-4-3-phase-2-test-suites-and-player-regressions-checklist.md`

---

## 8. Confirmed Owner Decisions Applied

- **`MFR-23`, `MFR-42`:** Post-deadline access modes (`full > review_only > none`), completed-trainee exemption removal under `'hide'`, strict read-only enforcement under `'keep_no_cert'`.
- **`D-06`, `D-07`, `D-12`, `D-13`, `Rule B`:** Attempt-scoped access isolation, continuation grant preservation, authoritative progress rounding, and permanent historical certificate preservation.
- **`2026-11-14` Owner Acceptance:** Approved `T-2.4.3` and accepted the `GoogleDrivePlayer` `isReadOnly` telemetry parity gap as a documented, non-blocking follow-up item.

---

## 9. Architecture / Contract Changes

- Standardized `CourseAccessMode = 'full' | 'review_only' | 'none'` and structured HTTP `403` error codes `COURSE_ACCESS_EXPIRED` and `COURSE_ACCESS_REVIEW_ONLY`.
- No backend database schema freeze or Phase 5 OpenAPI freeze authorized.

---

## 10. Requirements or Business Rules Clarified

1. Under `postDeadlinePolicy: 'hide'`, expired group access resolves to `'none'` regardless of `isCompleted === true`, while earned `D-13` certificates remain preserved.
2. Under `postDeadlinePolicy: 'keep_no_cert'`, expired group access resolves to `'review_only'`, rejecting progress/completion mutations (`403 COURSE_ACCESS_REVIEW_ONLY`) and suppressing new certificate issuance.
3. Active independent grants (`self:catalog:...`, `self:continued:...`, or another active group) are never degraded by an expired `'hide'` group, and never elevate an unrelated expired attempt.

---

## 11. Tests Executed and Exact Results, or `NOT EXECUTED` (`Deferred to Gate B`)

- **Execution Status:** **`NOT EXECUTED`** (`Deferred to Gate B` / `WP-4.4` per Two-Gate Verification Governance).
- **Vitest / `tsc` / `eslint` / `vite build`:** Not executed.
- **Authored Phase 2 Test Inventory:** **217 specifications** across 8 test files (`WP-2.1`: 63; `WP-2.2`: 43; `WP-2.3`: 37; `WP-2.4`: 74).

---

## 12. Known Issues / Remaining Risks

- **Documented Non-Blocking Follow-Up (`GoogleDrivePlayer` `isReadOnly` Telemetry Parity):** [`LearningPlayerPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/LearningPlayerPage.tsx#L353-L367) does not pass `isReadOnly` to `GoogleDrivePlayer`, so [`GoogleDrivePlayer.tsx` L129](file:///d:/LMS%20MEtro%20Project/frontend/src/features/learning-player/components/GoogleDrivePlayer.tsx#L129) continues dispatching `POST /api/courses/:courseId/activity` in `review_only` mode (which fails closed with `403 COURSE_ACCESS_REVIEW_ONLY` at the MSW/store layer, preserving data integrity). Accepted by the Owner on `2026-11-14` as a non-blocking follow-up.
- **Open Governance Items Outside Phase 2:** `A-03c` remains `OPEN`; `API-REC-06` remains `DEFERRED`; `materials.manage_references` runtime remains `OUTSTANDING`.

---

## 13. Explicitly Deferred Items

- Runtime execution of all `217` Phase 2 test specifications (and full frontend suite) is deferred to `Phase 4 / Gate B` (`T-4.4.1`).
- Non-blocking `GoogleDrivePlayer` `isReadOnly` telemetry parity follow-up.
- Backend implementation track (`DEF-01` / Roadmap Phase 12 — Django + DRF + Microsoft SQL Server) remains deferred until Gate B.

---

## 14. Out-of-Scope Items Confirmed

- Permanent user and lecturer deletion cascades (`D-01`, `D-02`, `D-03`, `D-11`) belong to `Phase 3` (`WP-3.1` & `WP-3.2`).
- `A-03c` authorization/media-lifecycle remediation and `materials.manage_references` runtime implementation remain separate and unauthorized.
- `Phase 5` (OpenAPI / DB schema) and Database schema freeze remain `NOT AUTHORIZED`.

---

## 15. Completed Phases / Work Packages / Increments

- **Frontend Core Increments 0–11** (`1,174` baseline tests).
- **Remediation Phase 1** (`MFR-01, 07, 13, 20`).
- **Phase A — Scope Reset & Documentation Baseline** (`CP-001`).
- **Phase 1 — Session & Role Finalization** (`WP-1.1` `CP-002`, `WP-1.2` `CP-003`, `WP-1.3` `CP-004`).
- **Phase 2 — Core Domain Logic Reconciliation** (`WP-2.1` `CP-005`, `WP-2.2` `CP-006`, `WP-2.3` `CP-007`, `WP-2.4` `CP-008` — this checkpoint closes `Phase 2`).

---

## 16. Remaining Phases / Work Packages / Tasks

- **`Phase 3 — Administrative Workflows & Mutation Safety`:** `WP-3.1`–`WP-3.4` (`CP-009`–`CP-012` / Gate A).
- **`Phase 4 — API Contract Normalization & DRF Handoff`:** `WP-4.1`–`WP-4.4` (`CP-013`–`CP-016` / Gate B).

---

## 17. Exact Next Task (`Phase` / `Work Package` / `Task ID`)

**`Phase 3 — Administrative Workflows & Mutation Safety` → `WP-3.1 — Lecturer Deletion Workflow (D-03, D-11)` → `Task T-3.1.1`:** Support nullable primary ownership (`Course.lecturerId: string | null` and `TrainingGroup.primaryInstructorId: string | null`, displayed as `غير معين`) across store types, `CourseBuilderPage.tsx`, and `GroupEditorPage.tsx` without magic `'unassigned'` user IDs.  
**Status:** `READY TO START`.

---

## 18. Entry Criteria for Next Task

- Formal Owner acceptance and closure of `WP-2.4` and `Phase 2` (certified by this checkpoint `CP-008`).
- Finalized multi-source `EnrollmentRecord`, `CourseAttempt`, and `CertificateRecord` domain structures from Phase 2.

---

## 19. Exit Criteria for Next Task

- `Course.lecturerId` and `TrainingGroup.primaryInstructorId` support `null` (`غير معين`) cleanly without magic `'unassigned'` user IDs across store, builder, and group editor UI.
- Prepares `T-3.1.2` (`409 LECTURER_HAS_ACTIVE_ASSIGNMENTS` pre-check) and `T-3.1.3` (`DeleteUserModal.tsx` with `مواصلة الحذف`).

---

## 20. Authoritative Documents to Read Before Starting Next Task

- [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md) (§4.4, §5.2, §6)
- [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md)
- [`docs/requirements/domain-business-rules.md`](file:///d:/LMS%20MEtro%20Project/docs/requirements/domain-business-rules.md) (§8)
- [`docs/architecture/decision-register.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/decision-register.md) (`D-03`, `D-11`)

