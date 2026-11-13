# Checkpoint `CP-004` — WP-1.3 Closure & Phase 1 Closure (Django Authentication Integration Contract & Auth Test Reconciliation)

> **Document Status:** `FROZEN — IMMUTABLE CHECKPOINT`  
> **Checkpoint ID:** `CP-004`  
> **Previous Checkpoint Reference:** [`CP-003-2026-11-07-wp-1-2-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-003-2026-11-07-wp-1-2-closure.md) (`CP-003`)  
> **Combined Scope:** Closure of **`WP-1.3 — Django Authentication Integration Contract`** and Closure of **`Phase 1 — Session & Role Finalization`**

---

## 1. Checkpoint ID
`CP-004`

## 2. Date / Timestamp
`2026-11-09`

## 3. Previous Checkpoint Reference
[`CP-003-2026-11-07-wp-1-2-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-003-2026-11-07-wp-1-2-closure.md) (`CP-003` — WP-1.2 Closure: Session Lifecycle & Developer Isolation)

## 4. Phase / Work Package / Increment Completed
**`Phase 1 — Session & Role Finalization` / `WP-1.3 — Django Authentication Integration Contract`** (Closes both `WP-1.3` and `Phase 1`).

## 5. Status
`COMPLETED AND ACCEPTED (IMPLEMENTED — RUNTIME VERIFICATION DEFERRED TO PHASE 4 / GATE B)`

## 6. Summary of What Was Completed
1. **Implemented Django Authentication Transport & Same-Origin Cookies (`T-1.3.1`):**
   - Hardened `frontend/src/core/api/apiClient.ts` to strictly enforce `credentials: 'same-origin'` across all requests, preventing caller override.
   - Preserved caller-provided custom headers and dynamic `X-CSRFToken` injection from `document.cookie` (`csrftoken`) on all same-origin mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Aligned `frontend/src/core/auth/AuthContext.tsx` with a production cookie-first authentication bootstrap: cold-start session rehydration executes `GET /api/auth/me` with `credentials: 'same-origin'` independently of Web Storage tokens.
   - Introduced `authenticatedSessionEpochRef` to preserve authenticated epoch evidence across transient S5 network/server transport failures.
   - Isolated `LoginForm.isSubmitting` locally from global `AuthContext.isLoading`, preventing premature or permanent loading spinners on the login page.
   - Enforced payload schema validation on `/api/auth/login` and `/api/auth/me` responses, throwing explicit errors on malformed payloads.
2. **Implemented Logout Confirmation, `LOGOUT_UNCONFIRMED` & Session Recovery (`T-1.3.2`):**
   - Added `LogoutStatus` type (`'LOGOUT_CONFIRMED' | 'LOGOUT_UNCONFIRMED' | null`) in `types.ts`, exposed via `useAuth()`.
   - Persisted per-tab logout status in `sessionStorage` (`metro_lms_logout_status`) via `authStorage.ts`.
   - Updated `executeLogout()` in `AuthContext.tsx`: local identity termination executes synchronously (`user = null`, `advanceSessionEpoch()`, `authenticatedSessionEpochRef = null`).
   - Defined strict return semantics: only genuine HTTP 200/204 responses establish `LOGOUT_CONFIRMED`; non-2xx failures (network errors, 500, 403 CSRF rejection, and 401 unauthenticated errors) enter `LOGOUT_UNCONFIRMED`.
   - Added fail-closed revalidation barrier: when `LOGOUT_UNCONFIRMED` is active, `GET /api/auth/me` returning 200 blocks user hydration (`user` remains `null`), preserves the warning banner, and triggers automatic background reconciliation logout.
   - Added retry recovery: `retryLogout()` action exposed to UI and embedded in `LoginForm.tsx` alert banner.
   - Intentional successful login explicitly clears `LOGOUT_UNCONFIRMED` locally.
   - Corrected two static defects: removed false-positive 401 confirmation in `executeLogout` catch block, and removed premature barrier clearance on `/api/auth/me` 401 in `revalidateSession()`.
   - Formally documented the distinction between Request-Level Confirmation and Global Quiescence.
3. **Reconciled Phase 5 Misaligned Specifications & Authored Authentication Test Suites (`T-1.3.3`):**
   - Audited and reconciled all nine misaligned test specifications from Phase 5 in [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx):
     * `P5-T10-1`: Updated to verify that `developerToken` is omitted from persisted storage and volatile token is held in closure memory.
     * `P5-T15-3`: Updated rollback verification to reflect credential-free snapshot persistence.
     * `P5-T23-1`: Updated Tab A and Tab B manual session restoration to obtain tokens via `getRuntimeDeveloperTokenForRestore()`.
     * `P5-T16-2` & `P5-T24-1`: Documented in-memory test harness closure retention vs. true browser reload fail-closed behavior.
     * `P5-T16-3` & `P5-T24-3`: Documented in-memory `runtimeTokenScope` mutation and `rawStorageTamperMarker` invalidation.
     * `P5-T13-19`: Fixed malformed fixture keys (`user` $\rightarrow$ `developerUser`, `token` $\rightarrow$ `developerToken`, `savedAt` $\rightarrow$ ISO-8601 string).
     * `P5-T18-6`: Added explicit verification of `Decision C: S8 -> S7` real-user logout (clearing real user, preserving inert credential-free Developer origin snapshot, hiding return controls).
   - Authored comprehensive API transport, CSRF, AbortSignal, and mutation barrier test suites in [`frontend/src/test/apiClient.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/apiClient.test.ts).
   - Authored comprehensive cookie-first bootstrap, S5 transient failure, login form state isolation, and `LOGOUT_UNCONFIRMED` state machine test suites in [`frontend/src/test/auth.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/auth.test.tsx).
   - Verified delimiter balance on all modified test files using a string-aware Python verification script.

## 7. Files Created, Updated, Moved, or Archived
- **Source Code Files Modified in WP-1.3:**
  - [`frontend/src/core/api/apiClient.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/api/apiClient.ts) (Credentials enforcement, CSRF extraction/injection, AbortSignal handling).
  - [`frontend/src/core/auth/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/types.ts) (Added `LogoutStatus`, `logoutStatus`, `retryLogout`).
  - [`frontend/src/core/auth/authStorage.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authStorage.ts) (Per-tab `LOGOUT_STATUS_STORAGE_KEY` persistence).
  - [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx) (Cookie-first bootstrap, `authenticatedSessionEpochRef`, `LOGOUT_UNCONFIRMED` state machine, silent restoration barrier, corrected 401 handling).
  - [`frontend/src/features/auth/components/LoginForm.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/features/auth/components/LoginForm.tsx) (Local `isSubmitting`, amber unconfirmed logout warning banner, retry button).
  - [`frontend/src/mocks/handlers/authHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/authHandlers.ts) (CSRF check simulation, cookie eviction headers).
- **Test Specifications Authored / Reconciled in WP-1.3 (`T-1.3.3`):**
  - [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx) (Reconciled 9 misaligned specs; added `Decision C: S8 -> S7` logout assertion).
  - [`frontend/src/test/apiClient.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/apiClient.test.ts) (Authored `D-AUTH-01 API Transport, CSRF & Lifecycle Guards` suite).
  - [`frontend/src/test/auth.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/auth.test.tsx) (Authored Cookie-First Bootstrap, Login Form Isolation, and `LOGOUT_UNCONFIRMED` suites).
- **Audit & Architecture Artifacts Published:**
  - `t-1-3-1-final-static-acceptance-audit-report.md`
  - `t-1-3-1-targeted-remediation-completion-report.md`
  - `t-1-3-1-final-s5-to-401-epoch-audit-report.md`
  - `t-1-3-1-lifecycle-correction-completion-report.md`
  - `login-button-loading-state-root-cause-and-fix-report.md`
  - `login-success-contract-and-abortsignal-audit-report.md`
  - `superseded-login-lifecycle-audit-report.md`
  - `stale-login-set-cookie-race-audit-report.md`
  - `t-1-3-2-logout-confirmation-and-recovery-report.md`
  - `t-1-3-2-final-race-consistency-audit-report.md`
- **Project-State Tracking Documents Synchronized:**
  - [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md) (§3, §4.2, §5.2, §6, §7.1)
  - [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md) (Header, §2, §3, §5, §6)
  - [`docs/project-state/checkpoints/README.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/README.md) (§4.1, §4.2)
  - [`docs/project-state/verification-and-test-strategy.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/verification-and-test-strategy.md) (§3, §5)
- **New Immutable Checkpoint Created:**
  - [`docs/project-state/checkpoints/CP-004-2026-11-09-wp-1-3-and-phase-1-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-004-2026-11-09-wp-1-3-and-phase-1-closure.md)
- **Protected Historical Checkpoints Preserved Unchanged:**
  - `CP-001`, `CP-002`, and `CP-003` preserved untouched.
  - All 18 uncommitted working-tree files in `frontend/src/` preserved intact.

## 8. Confirmed Owner Decisions Applied
- **`D-AUTH-01`:** Django server-side sessions, HttpOnly/Secure cookies, same-origin credentials, CSRF protection, and zero persistent tokens in Web Storage.
- **`Owner Decision C (SUP-01: S8 -> S7)`:** Real-user logout clears user state while preserving inert Developer origin snapshot in `sessionStorage`.
- **`Decision D (WP-5.4.4)`:** Real-user login clears test session flags and preserves origin snapshot as inert.
- **`INV-P5-7`:** Isolated persona logout purges both session slots.
- **`Phase 5 Decisions A, B, D`:** Monotonic session epoch, presentation-only preview, role/session invariants `S0`–`S15`.

## 9. Architecture / Contract Changes
- Standardized production authentication on cookie-first rehydration (`GET /api/auth/me`).
- Established fail-closed `LOGOUT_UNCONFIRMED` state machine prohibiting silent session restoration.
- Formally separated Request-Level Confirmation from Global Authentication Quiescence.
- Defined proposed backend integration considerations (`PIC-AUTH-01`, `PIC-AUTH-02`, `PIC-AUTH-03`) pending Owner review.

## 10. Requirements or Business Rules Clarified
- HTTP 401 on `POST /api/auth/logout` is an authentication failure before view execution; it is strictly unconfirmed (`isServerConfirmed = false`).
- HTTP 401 on `GET /api/auth/me` does not prove server-side session eviction; it must not clear `LOGOUT_UNCONFIRMED`.
- DRF logout requires explicit CSRF validation even on anonymous/unauthenticated requests.
- Django's `login()` automatically rotates session keys (`cycle_key`); no manual cycle_key is required.
- Single-Active-Session and `X-Session-Epoch` proposals are **UNAPPROVED** and remain proposed considerations pending Owner decision.

## 11. Tests Executed and Exact Results, or `NOT EXECUTED` (`Deferred to Gate B`)
- **Tests Executed in This Turn:** `0` (Automated test runner execution is strictly deferred to Phase 4 / Gate B).
- **Test Specifications Authored in This Turn:**
  - 8 new test cases in `frontend/src/test/apiClient.test.ts`.
  - 17 new test cases in `frontend/src/test/auth.test.tsx`.
  - 9 reconciled specifications in `frontend/src/test/isolated-role-session.test.tsx`.
- **Historical Executed Baseline:** `66` test files / `1,174` passing tests / `0` failures (at Increment 11 Final Closure).

## 12. Known Issues / Remaining Risks
- Native browser `Set-Cookie` processing occurs at the network layer and cannot be cancelled or rolled back by frontend JavaScript. A delayed response from a previous tab can evict a newer session cookie in the shared browser cookie jar. This is an explicit backend integration contract dependency.

## 13. Explicitly Deferred Items
- Full test runner execution (`npx vitest run`) across all authored test suites deferred to Phase 4 (`WP-4.4` / Gate B).
- TypeScript compiler checks (`npx tsc --noEmit`), linter (`npx eslint .`), and production build (`npx vite build`) deferred to Phase 4 (`WP-4.4` / Gate B).

## 14. Out-of-Scope Items Confirmed
- No backend Python/Django code was created or modified.
- No Single-Active-Session database table or session-purging routine was implemented.
- No `X-Session-Epoch` HTTP header was implemented.
- No Git operations were performed.

## 15. Completed Phases / Work Packages / Increments
- **`HIST-01` — Frontend Core Increments 0–11** (`COMPLETED AND ACCEPTED`).
- **`HIST-02` — Remediation Phase 1** (`COMPLETED AND ACCEPTED`).
- **`Phase A` — Scope Reset & Documentation Architecture Consolidation** (`COMPLETED AND ACCEPTED` at `CP-001`).
- **`Phase 1 — Session & Role Finalization`** (`COMPLETED AND ACCEPTED`):
  * `WP-1.1 — WP-5.4.5 Closure & Phase 5 Acceptance` (`COMPLETED AND ACCEPTED` at `CP-002`).
  * `WP-1.2 — Session Lifecycle and Developer Isolation` (`COMPLETED AND ACCEPTED` at `CP-003`).
  * `WP-1.3 — Django Authentication Integration Contract` (`COMPLETED AND ACCEPTED` at `CP-004`).

## 16. Remaining Phases / Work Packages / Tasks
- **`Phase 2 — Core Domain Logic Reconciliation`** (`WP-2.1`–`WP-2.4`, Tasks `T-2.1.1`–`T-2.4.3` — `NOT STARTED`).
- **`Phase 3 — Administrative Workflows & Mutation Safety`** (`WP-3.1`–`WP-3.4`, Tasks `T-3.1.1`–`T-3.4.3` — `NOT STARTED`).
- **`Phase 4 — API Contract Normalization & DRF Handoff`** (`WP-4.1`–`WP-4.4` / Gate B, Tasks `T-4.1.1`–`T-4.4.3` — `NOT STARTED`).

## 17. Exact Next Task (`Phase` / `Work Package` / `Task ID`)
- **Phase:** `Phase 2 — Core Domain Logic Reconciliation`
- **Work Package:** `WP-2.1 — Enrollment Provenance & Per-Attempt Progress (D-06)`
- **Task ID:** **`T-2.1.1`** (`MFR-41`, `D-06`): Refactor `EnrollmentRecord` in `inMemoryStore.ts` to maintain `sources: EnrollmentSourceGrant[]` with unique deterministic `sourceId` attributes bound to individual attempts.

## 18. Entry Criteria for Next Task
- Phase 1 is formally closed with all three Work Packages (`WP-1.1`, `WP-1.2`, `WP-1.3`) accepted.
- Session lifecycle, monotonic session epoch, and Django authentication contracts are finalized and frozen.
- Checkpoint `CP-004` is published and immutable.

## 19. Exit Criteria for Next Task
- `EnrollmentRecord` supports multi-source provenance (`sources: EnrollmentSourceGrant[]`) in `inMemoryStore.ts`.
- Grant categories (`kind: 'self' | 'group'`) maintain deterministic IDs without data loss.
- Zero cross-attempt progress contamination.

## 20. Authoritative Documents to Read Before Starting Next Task
1. [`docs/project-state/CURRENT.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/CURRENT.md)
2. [`docs/project-state/checkpoints/CP-004-2026-11-09-wp-1-3-and-phase-1-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-004-2026-11-09-wp-1-3-and-phase-1-closure.md)
3. [`docs/project-state/active-roadmap.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/active-roadmap.md) (§4.3 & §5.2)
4. [`docs/requirements/domain-business-rules.md`](file:///d:/LMS%20MEtro%20Project/docs/requirements/domain-business-rules.md) (§5 — Multi-Source Enrollment Provenance & Standalone Attempts)
5. [`docs/architecture/decision-register.md`](file:///d:/LMS%20MEtro%20Project/docs/architecture/decision-register.md) (`D-06`)

