# Phase 5 Planning Checklist: Developer Role Preview & Isolated Role Testing

**Document Version:** 1.1 (Final Architecture Reconciliation)  
**Status:** Planning Complete — Reconciled & Ready for Owner Acceptance (`[Not Started]` across all implementation items)  
**Authoritative Reference:** `docs/backend/pre-backend-migration-remediation-roadmap.md`, Revision 5  
**Governing Phase:** Phase 5 — Developer Role Preview (`معاينة الدور`) & Isolated Role Testing (`اختبار الصلاحيات`, `D-10`)  
**Assigned Findings:** `MFR-25` (`F-25`), `MFR-40`  
**Owner Decisions:** `D-10`  
**Date:** November 2, 2026  

---

## 1. Phase Objective & Reconciled Governance

### 1.1 Objective
Establish two strictly separated Developer tools in compliance with Revision 5, Section 4 and Decision **`D-10`**:
1. **Role Preview (`معاينة الدور`)**: A purely visual UI simulation tool driven by `RolePreviewContext` that renders role-specific navigation, layouts, and component states **without** modifying `AuthContext.user`, the authenticated token, or network authorization headers.
2. **Isolated Role Test Sessions (`اختبار الصلاحيات`)**: A genuine authentication-switching tool that logs the Developer into strictly allowlisted synthetic test personas (`test_super_admin`, `test_admin`, `test_assistant_admin`, `test_lecturer`, `test_trainee`) with complete API authorization enforcement, preserving the original Developer session in a dedicated `developerOriginSession` slot and providing a single-click return flow.

Concurrently resolve **`MFR-25`**: completely hide `/design-system` links and prototype milestone badges from all non-Developer users, ensuring direct URL access to Developer-only routes returns standard `NotFoundPage` (`404`), not `ForbiddenPage` (`403`).

### 1.2 Master Register Findings (MFR) Addressed
- **`MFR-25` (`F-25`):** Developer-only surfaces and prototype chrome visibility. `/design-system` and prototype milestone badges must be restricted exclusively to authenticated `developer` role. Non-Developers navigating to `/design-system` must receive `404 Not Found` (`INV-R8`).
- **`MFR-40`:** Separation of visual Role Preview from isolated role-testing sessions. The existing defective `switchDemoUser` in `AuthContext` mutates live authenticated identity across roles without session isolation or restoration boundaries.

### 1.3 Architectural Reconciliation Summary
In accordance with final architectural review:
1. **`assistant_lecturer` Visual Preview Reconciliation:**
   - `assistant_lecturer` is **not** added to the global `UserRole` enum.
   - It is **not** added to `ROLE_DEFAULT_CAPABILITIES` or `ROLE_CAPABILITY_CEILINGS`.
   - Its visual representation is supported through a **scoped assignment preview** (`scopedAssignmentPreview: { type: 'assistant_lecturer', groupId?: string } | null`).
   - It represents how an instructor assigned specifically to a training group views group materials, meetings, and attendance tabs.
   - Authenticated identity remains `developer`, API headers remain Developer bearer token, and mutations remain strictly blocked.
2. **Increment 5.3 Complete Round-Trip Sequencing:**
   - Increment 5.3 is redefined as a **complete minimum viable session round-trip**: launch $\rightarrow$ preserve origin $\rightarrow$ authenticate test persona $\rightarrow$ show banner $\rightarrow$ execute one-click return $\rightarrow$ restore origin $\rightarrow$ cleanup temporary session.
   - Increment 5.4 is dedicated to hardening, edge cases (refresh, multi-tab, malformed origin, explicit logout purge), and regression test authoring.
3. **Strict Synthetic Test-Persona Allowlisting:**
   - Replaced prefix-only checks with an explicit registry (`SYNTHETIC_TEST_PERSONA_REGISTRY`).
   - Validates canonical ID, expected role, dev-only availability, and synthetic fixture provenance.
   - Real accounts can never be targeted, even if IDs resemble the test prefix.
4. **Explicit Session Storage Lifecycle:**
   - Dedicated slot `metro_lms_developer_origin_session` stores origin session fields (`user`, `token`, `savedAt`, `version`).
   - Restored upon `exitIsolatedTestSession()` or completely purged upon explicit `logout()`.

---

## 2. Dependencies & Frozen Scope

- **Upstream Dependencies (All Frozen & Fully Verified):**
  - **Phase 1:** Canonical User IDs (`USR_...`), tombstone ledger, and session consistency (`MFR-01`, `MFR-07`, `MFR-13`, `MFR-20`).
  - **Phase 2:** Six-tier role hierarchy, protected-account invariants (`INV-R1`–`INV-R8`), Developer confidentiality across 11 surfaces (`MFR-37`, `MFR-38`, `MFR-39`, `MFR-45`).
  - **Phase 3:** Administrative read visibility (`Rule A`, `D-14`), route guards, role navigation, and preview progress isolation (`MFR-03`, `MFR-05`, `MFR-06`, `MFR-08`, `MFR-16`, `MFR-17`, `MFR-21`, `MFR-29`, `MFR-30`).
  - **Phase 4:** Approval lifecycle, default-approval policy (`INV-R9`), approval-time revalidation (`INV-R10`), and audit attribution (`MFR-09`, `MFR-31`, `MFR-35`, `MFR-36`, `MFR-44`).
- **Downstream Phases Dependent on Phase 5:**
  - Phase 6: Unified Enrollment Provenance & Per-Attempt Progress Architecture (`D-06`).
  - Phase 7: Published Curriculum Versioning (`Rule B`, `D-12`, `D-13`).
  - Phase 8: Group Member Removal & Continuation Grants (`D-07`).
  - Phase 10: Permanent User Deletion (`D-01`, `D-03`, `D-11`).
  - Phase 12: Production Backend Migration & Environment Bootstrap.
  - Phase 13: Final Whole-System Integration, E2E Verification & Gate B Acceptance.
- **Out of Scope for Phase 5:**
  - Production backend CLI/database migrations (Phase 12).
  - Modifying the Revision 5 roadmap (`docs/backend/pre-backend-migration-remediation-roadmap.md`).
  - Legacy Vanilla JavaScript application changes.
  - Modifying accepted Phase 1–4 code or documentation.

---

## 3. Current-State Inventory

### 3.1 Authentication & Session
- [x] `AuthContext.tsx`: Manages `user`, `login`, `logout`. Contains legacy `switchDemoUser(role: UserRole)` which replaces `user` directly via `login(demoAccount.credentials)`, violating `MFR-40`. Must be retired/restricted.
- [x] `authStorage.ts`: Persists session under `sessionStorage.getItem('metro_lms_auth_session')`. Needs dedicated methods for `metro_lms_developer_origin_session`.
- [x] `demoAccounts.ts`: Exports `DEMO_ACCOUNTS` for `admin`, `assistant_admin`, `lecturer`, `assistant_lecturer`, `trainee`.
- [x] `userDirectoryFixtures.ts`: Defines `SYNTHETIC_DEVELOPER_USER` (`USR_DEV_001`) and `SYNTHETIC_SUPER_ADMIN_USER` (`USR_SUPER_001`), both DEV-gated.

### 3.2 Layout & Developer-Only Chrome
- [x] `router/index.tsx`: Contains `DeveloperRouteGuard` guarding `/design-system`. Correctly renders `NotFoundPage` (404) for `user?.role !== 'developer'`.
- [x] `Navbar.tsx`: `/design-system` link guarded by `{user?.role === 'developer' && ...}`.
- [x] `Sidebar.tsx` & `MobileDrawer.tsx`: Uses `isNavItemVisibleForRole` from `navigation.ts`.
- [x] `Footer.tsx`: Contains developer-guarded `/design-system` link (lines 53–57), but line 25 renders public prototype badge: `<Badge variant="primary">المرحلة 2: هيكل التطبيق (v0.2.0)</Badge>`.
- [x] `MobileDrawer.tsx`: Line 154 renders public milestone label: `المنظومة التدريبية الذكية لمترو القاهرة (المرحلة 3)`.
- [x] `LoginPage.tsx`: Clean of `/design-system` links.

---

## 4. Mandatory Security Invariants

- **`INV-R1` (No In-App Developer Creation):** No UI or endpoint may create or transition any user to `role: 'developer'`.
- **`INV-R2` (Super Admin Exclusivity):** Only `developer` may mutate `super_admin` accounts.
- **`INV-R8` (Uniform 404 Non-Disclosure for Developer):** Any unauthorized query or route access targeting Developer assets returns standard `404 Not Found`.
- **`INV-D10-1` (Strict Synthetic Persona Allowlist):** Isolated role-testing sessions must strictly authenticate as synthetic test personas explicitly registered in `SYNTHETIC_TEST_PERSONA_REGISTRY`. Real employee or trainee accounts must never be impersonated. Prefix-only matching is prohibited.
- **`INV-P5-1` (Role Preview Isolation):** Role Preview (`معاينة الدور`) must never modify `AuthContext.user`, authentication headers, session storage, or API identity.
- **`INV-P5-2` (Preview Mutation Barrier):** Any state-mutating action attempted during visual Role Preview must be blocked or intercepted with an informative prompt directing the Developer to launch an Isolated Role Test Session.
- **`INV-P5-3` (Test Persona Least Privilege):** An isolated test persona must exercise only its own legitimate role capabilities and must never inherit Developer privileges.
- **`INV-P5-4` (Developer Origin Session Lifecycle):** The Developer's original session must be safely preserved in `metro_lms_developer_origin_session`, immune to test-session mutation, and cleanly restored on exit or completely purged on explicit logout.
- **`INV-P5-5` (Developer Route Immunity):** Direct navigation to `/design-system` must verify actual authenticated `AuthContext.user.role === 'developer'`. A non-developer or an active `previewRole` must never grant access.
- **`INV-P5-6` (Scoped Assignment Preview Non-Elevation):** Previewing `assistant_lecturer` is strictly a visual assignment preview within `RolePreviewContext`. It never elevates API permissions or alters `user.role`.
- **`INV-P5-7` (Explicit Logout Purge Semantics):** Explicitly clicking `logout` during an active isolated test session purges BOTH the active test session and the saved Developer origin session, preventing orphaned Developer credentials.

---

## 5. Reconciled Increment Breakdown

### Increment 5.1 — Developer-Only Surface Protection & Prototype Chrome Isolation (`MFR-25`)
- [x] `[Completed]` Gate un-guarded prototype milestone badge in `Footer.tsx` (line 25) behind `user?.role === 'developer'`.
- [x] `[Completed]` Gate milestone label in `MobileDrawer.tsx` (line 154) behind authenticated `user?.role === 'developer'`.
- [x] `[Completed]` Gate development label `• مرحلة 2` in `Sidebar.tsx` (line 84) behind `effectiveRole === 'developer'`.
- [x] `[Completed]` Verify and enhance `DeveloperRouteGuard` in `router/index.tsx` to evaluate authentic `AuthContext.user.role === 'developer'`, render `LoadingScreen` when loading, return `NotFoundPage` (404) for all other roles, and support `redirectUnauthenticated`.
- [x] `[Completed]` Confirm all navigation configs (`navigation.ts`) hide `/design-system` from non-developers.
- [x] `[Completed]` Author deferred regression suite `developer-surface-protection.test.tsx` (19 test cases, deferred to Phase 13).

### Increment 5.2 — Visual Role Preview Architecture (`MFR-40`, `D-10`)
- [x] `[Completed]` Create `RolePreviewContext.tsx` with provider `RolePreviewProvider`.
- [x] `[Completed]` Enforce that `RolePreviewProvider` can only activate when authenticated `AuthContext.user?.role === 'developer'`.
- [x] `[Completed]` Implement canonical global preview roles: `super_admin`, `admin`, `assistant_admin`, `lecturer`, `user`.
- [x] `[Completed]` Implement scoped assignment preview for `assistant_lecturer` (`scopedAssignmentPreview: { type: 'assistant_lecturer', groupId: string, groupName: string }`).
- [x] `[Completed]` Expose `effectiveUiRole = previewRole ?? user?.role` for layout consumption without mutating `AuthContext.user`.
- [x] `[Completed]` Connect `Navbar`, `Sidebar`, `MobileDrawer`, and `AppLayout` to consume `effectiveUiRole` for visual menu rendering.
- [x] `[Completed]` Build persistent preview indicator banner:
  - Global role: `وضع معاينة الواجهة فقط: [الدور] — الصلاحيات البرمجية الحالية: المطور`
  - Scoped role: `وضع معاينة الواجهة فقط: مدرس مساعد (تكليف بمجموعة: [اسم المجموعة]) — الصلاحيات البرمجية الحالية: المطور`
  - Action: `إنهاء المعاينة`.
- [x] `[Completed]` Implement mutation barrier interceptor in preview mode (blocks POST, PUT, PATCH, DELETE and throws error with toast prompt directing Developer to Isolated Role Test Session).
- [x] `[Completed]` Author deferred unit and integration test specifications for Role Preview isolation (`role-preview.test.tsx`, 17 tests, deferred to Phase 13).

### Increment 5.3 — Synthetic Personas & Complete Isolated Session Round-Trip (`D-10`, `MFR-40`)
- [x] `[Completed]` Define strict `SYNTHETIC_TEST_PERSONA_REGISTRY` in `testPersonas.ts`:
  - `USR_TEST_SUPER_001` — `test_super_admin` (`super_admin`)
  - `USR_TEST_ADMIN_001` — `test_admin` (`admin`)
  - `USR_TEST_AST_001` — `test_assistant_admin` (`assistant_admin`)
  - `USR_TEST_LEC_001` — `test_lecturer` (`lecturer`)
  - `USR_TEST_TRN_001` — `test_trainee` (`user`)
- [x] `[Completed]` Enforce DEV-only gating (`import.meta.env.DEV === true`) and explicit registry membership validation (reject prefix-only or real accounts).
- [x] `[Completed]` Implement `authStorage.ts` origin session methods:
  - `saveDeveloperOriginSession(session: DeveloperOriginSession): boolean`
  - `getDeveloperOriginSession(): DeveloperOriginSession | null`
  - `clearDeveloperOriginSession(): void`
  - `hasDeveloperOriginSession(): boolean`
- [x] `[Completed]` Implement `launchIsolatedTestSession(personaId)`:
  - Validates `personaId` against strict allowlist.
  - Prevents nested test sessions (blocks if already in test session).
  - Serializes current Developer session to `metro_lms_developer_origin_session`.
  - Authenticates `AuthContext` as the selected synthetic test persona.
  - Updates active session storage and API client headers.
  - Guarantees rollback to Developer session if test login fails.
- [x] `[Completed]` Build persistent isolated test session banner:
  - Text: `جلسة اختبار صلاحيات معزولة (حساب اختباري: [الاسم / الدور])`
  - Prominent action button: `العودة إلى جلسة المطور`.
- [x] `[Completed]` Implement `returnToDeveloperSession()`:
  - Retrieves Developer origin session from storage.
  - Restores Developer session in `AuthContext` and `metro_lms_auth_session`.
  - Clears `metro_lms_developer_origin_session`.
  - Resets temporary test-session state.
- [x] `[Completed]` Retire/deprecate legacy unsafe `switchDemoUser(role)`.
- [x] `[Completed]` Author deferred test specifications for the complete session round-trip (`isolated-role-session.test.tsx`, 46 tests, deferred to Phase 13).

### Increment 5.4 — Session Lifecycle Hardening, Edge Cases & Security Regression Matrix
- **Planning Reference:** `docs/frontend/reports/phase-05-increment-04-planning-report.md` (Version 3.0 Authoritative Final Planning Reconciliation Baseline — Ready for Owner Authorization)
- **Increment Status:** `[In Progress — WP-5.4.1 Completed]`
- **Approved Owner Policies:**
  - **Decision A (Option A):** Emergency return prompt in isolated-session banner on synthetic persona expiration, permitted strictly if verifiable continuity with `origin.personaId` is proven via non-authorizing `authStorage.inspectSessionContinuity()` and Developer snapshot is unexpired and authentic (`USR_DEV_001`). Completely missing active session fails closed and requires fresh login.
  - **Decision B (Option A):** Autonomous per-tab isolation in `sessionStorage` with independent, idempotent returns and zero `localStorage` exposure.
  - **Decision C (Option A):** Sanitized diagnostic quarantine (`metro_lms_quarantined_snapshot`) containing strictly metadata and zero credentials or secrets for conclusively expired Developer snapshots.
  - **Decision D (Option 1):** Non-destructive inert preservation of Developer origin snapshot on real-user account switch until tab termination (blocks Developer restoration, hides banner, preserves snapshot inert).
  - **Token Tampering Policy:** Rejection of untrusted persona session with non-destructive preservation of Developer origin snapshot in an inert state.
- **Proposed Work Packages:**
  - [x] `[Completed]` **WP-5.4.1:** Session Rehydration & Mount Hardening (reconciles active session, origin snapshot, and server revalidation on cold refresh; implements non-authorizing `inspectSessionContinuity()` strictly excluding `rawToken`; authors deferred specs `P5-T16-1`, `P5-T16-2`, `P5-T16-3`).
  - [ ] `[Not Started]` **WP-5.4.2:** Asynchronous Race & Epoch Protection (implements `sessionEpoch`, `<Outlet key="..." />` subtree reset, and selective context cache flushes across session transitions; planned specs: `P5-T13-17`, `P5-T13-18`, `P5-T13-19`).
  - [ ] `[Not Started]` **WP-5.4.3:** Multi-Tab Safety & Storage Isolation (enforces per-tab `sessionStorage` boundary and idempotent tab duplication handling; planned spec: `P5-T23-1`).
  - [ ] `[Not Started]` **WP-5.4.4:** Corrupted, Stale & Expired Recovery Flows (implements sanitized diagnostic quarantine, dedicated emergency return with continuity, proof protection, inert snapshot preservation on real-user mismatch, and non-destructive token tampering handling; planned specs: `P5-T18-6`, `P5-T18-7`, `P5-T18-8`, `P5-T18-9`, `P5-T24-1`, `P5-T24-2`, `P5-T24-3`).
  - [ ] `[Not Started]` **WP-5.4.5:** Phase 5 Comprehensive Security Regression Matrix (authors the remaining 11 planned specifications in `isolated-role-session.test.tsx`, finalizing the total deferred test suite at 60 specifications across all lifecycle scenarios; status: `PLANNED — NOT YET WRITTEN — NOT EXECUTED`).

---

## 6. Acceptance Criteria

1. **Visual Isolation (`MFR-40`):** In Role Preview, `AuthContext.user` remains `developer` with canonical ID `USR_DEV_001`. The API client transmits the Developer token. UI navigation and badges render according to `previewRole` or scoped assignment preview.
2. **Scoped Assignment Preview:** Selecting `assistant_lecturer` renders group-scoped instructor navigation and views without modifying global role definitions or permissions.
3. **Mutation Barrier:** Any write attempt while in Role Preview is prevented and prompts the Developer to launch an Isolated Role Test Session.
4. **Complete Session Round-Trip (`D-10`):** Increment 5.3 delivers a fully operable launch-and-return cycle. The Developer launches a test session, conducts tests, and returns to the Developer session in a single click without page reloads or credential re-entry.
5. **Strict Persona Allowlist:** Launching a test session succeeds only for accounts explicitly present in `SYNTHETIC_TEST_PERSONA_REGISTRY`. Real accounts and arbitrary prefix matches are rejected.
6. **Explicit Logout Cleanup:** Logging out during an isolated test session purges both `metro_lms_auth_session` and `metro_lms_developer_origin_session`.
7. **Developer Chrome Protection (`MFR-25`):** Navigating to `/design-system` as any non-developer returns `404 Not Found`. Footer and MobileDrawer milestone badges are invisible to non-developers.
8. **Test Deferral Rule:** All test cases are authored and cataloged as:  
   `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

---

## 7. Deferred Test Scenarios Matrix (For Phase 13 / Gate B)

| Test ID | Category | Target Component / Workflow | Verification Objective | Status |
|---|---|---|---|:---:|
| `P5-T01` | Unit | `RolePreviewContext` | Setting `previewRole` updates `effectiveUiRole` without mutating `AuthContext.user` | Deferred |
| `P5-T02` | Unit | `RolePreviewContext` | Non-developer user cannot activate `previewRole` | Deferred |
| `P5-T03` | Unit | `RolePreviewContext` | Exiting preview cleanly resets `previewRole` to `null` | Deferred |
| `P5-T04` | Unit | Scoped Assignment Preview | `assistant_lecturer` preview sets scoped context without altering `UserRole` enum | Deferred |
| `P5-T05` | Integration | Navigation & Layout | Navbar and Sidebar render role-specific items matching `previewRole` | Deferred |
| `P5-T06` | Security | API Client / Preview | API requests during Role Preview carry authentic Developer authorization headers | Deferred |
| `P5-T07` | Security | Mutation Barrier | Attempting data mutation in Role Preview displays warning banner/toast | Deferred |
| `P5-T08` | Security | Persona Allowlist | `launchIsolatedTestSession` rejects non-allowlisted IDs, real accounts, and arbitrary prefix matches | Deferred |
| `P5-T09` | Integration | Session Launch | Successfully switches active `AuthContext.user` to `test_assistant_admin` | Deferred |
| `P5-T10` | Security | Origin Preservation | Developer session token safely preserved in `metro_lms_developer_origin_session` | Deferred |
| `P5-T11` | Integration | Genuine API Authorization | Requests in test session hit genuine role permissions (e.g. `202` on write) | Deferred |
| `P5-T12` | Security | Least Privilege | Test persona never inherits Developer capabilities or access to `/design-system` | Deferred |
| `P5-T13` | Integration | Complete Round-Trip | One-click return cleanly restores `USR_DEV_001` session and purges origin slot | Deferred |
| `P5-T14` | Security | Nested Session Prevention | Attempting to launch a test session while already in a test session is blocked | Deferred |
| `P5-T15` | Integration | Launch Failure Rollback | If test login fails, Developer session remains active and undamaged | Deferred |
| `P5-T16` | Integration | Session Refresh | Page refresh while in test session maintains test session and origin restore path | Deferred |
| `P5-T17` | Security | Explicit Logout Purge | Logging out in test session purges both active session and Developer origin session | Deferred |
| `P5-T18` | Security | Corrupted Origin Recovery | Malformed or expired origin session safely redirects to `/login` | Deferred |
| `P5-T19` | Security | Direct Route Guard | Non-developer accessing `/design-system` receives `404 Not Found` (never `403`) | Deferred |
| `P5-T20` | Security | Preview Bypass Prevention | Active Role Preview to `developer` from another account cannot bypass route guards | Deferred |
| `P5-T21` | UI Inspection | Chrome Visibility | Footer and MobileDrawer prototype badges are completely hidden from non-developers | Deferred |
| `P5-T22` | End-to-End | Full Developer Lifecycle | Developer enters preview $\rightarrow$ switches to isolated test $\rightarrow$ returns to Developer | Deferred |

### Increment 5.4 Test Specifications Status

| Test ID | Category | Target Component / Workflow | Verification Objective | Status |
|---|---|---|---|:---:|
| `P5-T16-1` | Integration | Session Rehydration | Cold rehydration restores active persona & snapshot; transient network timeout preserves snapshot with retry action | Deferred (Phase 13) |
| `P5-T16-2` | Integration | Session Rehydration | Normal one-click return (`returnToDeveloperSession`) cleanly restores Developer session following cold page reload | Deferred (Phase 13) |
| `P5-T16-3` | Integration | Session Rehydration | Dual-session expiration on cold reload fails closed to `/login` and creates sanitized quarantine | Deferred (Phase 13) |
| `P5-T13-17` | Unit / Security | Session Epoch | Monotonic `sessionEpoch` increments on launch, normal return, emergency return, and logout transitions | Planned |
| `P5-T13-18` | Security | Race Condition Barrier | Stale asynchronous responses and post-logout network races are strictly discarded and cannot repopulate user state | Planned |
| `P5-T13-19` | Integration | Subtree & Cache Reset | Application route outlet subtree remounts (`<Outlet key="..." />`) and context caches flush across session transitions | Planned |
| `P5-T18-6` | Security | Recovery Flows | Real-user active identity mismatch preserves origin snapshot in an inert state, hides return banner, and blocks Developer elevation | Planned |
| `P5-T18-7` | Security | Recovery Flows | Conclusively expired Developer snapshot creates sanitized quarantine in `metro_lms_quarantined_snapshot` with strictly zero secrets | Planned |
| `P5-T18-8` | Security | Recovery Flows | Persona token tampering clears active session, hides return controls, and preserves valid Developer snapshot inert | Planned |
| `P5-T18-9` | Security | Secret Non-Disclosure | Raw token is strictly excluded from public `SessionContinuityDescriptor` and sanitized diagnostic quarantine payload | Planned |
| `P5-T23-1` | Security | Multi-Tab Safety | Duplicated tab operates independently with autonomous return and zero `localStorage` exposure | Planned |
| `P5-T24-1` | Integration | Emergency Return | Dedicated `returnFromExpiredPersonaSession()` restores Developer with exact original expiration and purges origin snapshot | Planned |
| `P5-T24-2` | Security | Emergency Return | Emergency return is strictly rejected when persona continuity cannot be verified (missing session, invalid token format, or expired snapshot) | Planned |
| `P5-T24-3` | Security | Proof Invalidation & Replay | Forged, stale, or reused continuity proofs are strictly rejected; failed emergency return preserves Developer origin snapshot | Planned |

### Test Count Arithmetic Reconciliation
- **Increment 5.3 Existing Specifications:** 46 tests in `isolated-role-session.test.tsx` (`WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`)
- **Increment 5.4 WP-5.4.1 Authored Specifications:** 3 newly authored tests (`P5-T16-1`, `P5-T16-2`, `P5-T16-3`) (`WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`)
- **Increment 5.4 Remaining Planned Specifications:** 11 tests across WP-5.4.2 to WP-5.4.5 (`PLANNED — NOT YET WRITTEN — NOT EXECUTED`)
- **Phase 5 Combined Total Target:** **49 (Written/Deferred) + 11 (Planned/Unwritten) = 60 Total Specifications**

---

## 8. Sign-off & Verification Status

- **Planning Document Status:** Reconciled (Version 3.0 Authoritative Final Planning Reconciliation Baseline)
- **Increment 5.4 Implementation Status:**
  - **WP-5.4.1 (Session Rehydration & Mount Hardening):** `[Completed]`
  - **WP-5.4.2 (Asynchronous Race & Epoch Protection):** `[Not Started]`
  - **WP-5.4.3 (Multi-Tab Safety & Storage Isolation):** `[Not Started]`
  - **WP-5.4.4 (Corrupted, Stale & Expired Recovery Flows):** `[Not Started]`
  - **WP-5.4.5 (Security Regression Matrix):** `[Not Started]`
- **Executable Tests:** None (Zero automated test execution per strict governance)
- **Phase Implementation Status:** `[In Progress — Increment 5.4 / WP-5.4.1 Complete]`
