# Phase 5 Planning Report: Developer Role Preview & Isolated Role Testing

**Document Version:** 1.1 (Final Architecture Reconciliation)  
**Phase:** Phase 5 Planning — Documentation-First Planning Phase  
**Authoritative Reference:** `docs/backend/pre-backend-migration-remediation-roadmap.md`, Revision 5  
**Governing Findings:** `MFR-25` (`F-25`), `MFR-40`  
**Owner Decisions:** `D-10`  
**Date:** November 2, 2026  
**Status:** **AWAITING OWNER APPROVAL PRIOR TO IMPLEMENTATION**

---

## 1. Executive Summary

This report establishes the reconciled, authoritative implementation plan for **Phase 5 — Developer Role Preview (`معاينة الدور`) & Isolated Role Testing (`اختبار الصلاحيات`, `D-10`)**.

Following the successful completion, formal approval, and freezing of Phases 1, 2, 3, and 4, Phase 5 establishes the boundary between client-side visual inspection and genuine role authorization testing for the `developer` role, while eliminating developer-only chrome and prototype badges from production and non-developer views.

Based on final architectural review and reconciliation against Roadmap Revision 5, three critical refinements have been incorporated into this plan:
1. **`assistant_lecturer` Visual Preview:** Supported via a **scoped assignment preview** (`scopedAssignmentPreview`) within `RolePreviewContext` without altering the canonical `UserRole` enum, `ROLE_DEFAULT_CAPABILITIES`, or `ROLE_CAPABILITY_CEILINGS`.
2. **Complete Isolated Session Round-Trip in Increment 5.3:** Increment 5.3 delivers the full minimum viable session lifecycle (launch, origin preservation, test persona authentication, warning banner, return button, origin restoration, and cleanup). Increment 5.4 is reserved for lifecycle hardening, refresh, multi-tab isolation, explicit logout purge semantics, and deferred regression test matrix authoring.
3. **Strict Synthetic Persona Registry / Allowlist:** Session switching is governed by an explicit registry (`SYNTHETIC_TEST_PERSONA_REGISTRY`) validating exact canonical ID, expected role, dev-only availability, and synthetic fixture provenance. Real user accounts can never be targeted, and prefix-only matching is strictly rejected.

A rigorous, read-only static audit of the codebase was conducted. No source code was modified, no test suites were executed, and all implementation work remains strictly `[Not Started]`.

---

## 2. Roadmap Revision 5 Reconciliation & Architecture Refinements

The authoritative baseline is `docs/backend/pre-backend-migration-remediation-roadmap.md`, Revision 5. The scope, assigned findings, and invariants for Phase 5 are reconciled as follows:

| Roadmap Item | Classification | Assigned Phase | Governing Scope & Contract |
|---|---|:---:|---|
| **`MFR-25` (`F-25`)** | Confirmed Defect | Phase 5 | Developer-only surfaces and prototype chrome visibility. Direct navigation to `/design-system` must render standard `NotFoundPage` (`404`), not `ForbiddenPage` (`403`). All `/design-system` links and prototype milestone badges must be removed from non-developer layouts. |
| **`MFR-40`** | Confirmed Defect | Phase 5 | Separation of visual Role Preview from isolated role-testing sessions. Legacy `switchDemoUser` mutates live authenticated identity across roles without session boundaries or restore paths. |
| **`D-10`** | Owner Decision | Phase 5 | Two distinct tools: (1) visual Role Preview (`معاينة الدور`) preserving real Developer identity, and (2) Isolated Role Test Sessions (`اختبار الصلاحيات`) using dedicated synthetic accounts. Real-user impersonation is strictly forbidden. |
| **`INV-R1`** | Mandatory Invariant | Phase 5 | No in-app Developer creation or role elevation. |
| **`INV-R8`** | Mandatory Invariant | Phase 5 | Uniform 404 Non-Disclosure: non-developer requests targeting Developer assets return identical `404 Not Found`. |
| **`INV-D10-1`** | Mandatory Invariant | Phase 5 | Strict synthetic persona allowlist: test sessions authenticate only as explicitly registered synthetic personas. |

### Architectural Reconciliation Points
1. **Reconciliation of `assistant_lecturer` Role Preview:**
   - Section 4 of Revision 5 explicitly lists `assistant_lecturer` among the visual role layouts Developer Role Preview must support.
   - However, `assistant_lecturer` is a group-scoped assignment, not a global `UserRole`.
   - *Resolution:* Supported via `scopedAssignmentPreview` in `RolePreviewContext`. It provides visual preview of group-assigned materials, meetings, and attendance tabs without altering global role enums or permission ceilings. API identity remains `developer`, and mutations are blocked.
2. **Safe Increment Sequencing:**
   - Increment 5.3 is structured as a **complete session round-trip**, preventing an incomplete intermediate state where a developer could launch an isolated test session without a working return flow.
   - Increment 5.4 addresses edge cases: page refresh, tab isolation, malformed origin data, explicit logout purge semantics, and security regressions.
3. **Strict Synthetic Persona Registry:**
   - Replaced basic prefix checking with `SYNTHETIC_TEST_PERSONA_REGISTRY` covering exactly 5 planned personas.
   - Prevents unauthorized session switching, privilege leaks, or real account targeting.

All preceding phases (Phase 1, Phase 2, Phase 3, and Phase 4) remain 100% frozen.

---

## 3. Current Implementation Inventory

A comprehensive, read-only source code audit was conducted across the frontend application:

### 3.1 Authentication & Session Architecture
- **`frontend/src/core/auth/AuthContext.tsx`:**
  - Manages `user: AuthUser | null`, `login()`, `logout()`, `updateCurrentUser()`.
  - Lines 77–88 implement `switchDemoUser(role: UserRole)`:
    ```ts
    const switchDemoUser = async (role: UserRole) => {
      const demoAccount = DEMO_ACCOUNTS.find(account => account.user.role === role);
      if (demoAccount) {
        await login(demoAccount.credentials);
      }
    };
    ```
    *Defect Analysis:* Replaces `user` directly without session isolation, without origin preservation, and without a return mechanism. In Phase 5, this method will be retired and replaced by `launchIsolatedTestSession`.
- **`frontend/src/core/auth/authStorage.ts`:**
  - Manages session persistence via `window.sessionStorage` under `metro_lms_auth_session`.
  - Currently lacks a secondary storage slot for saving or restoring a Developer origin session.
- **`frontend/src/core/auth/demoAccounts.ts`:**
  - Contains demo accounts for `admin`, `assistant_admin`, `lecturer`, `assistant_lecturer`, `trainee`.
  - Does not contain dedicated `test_*` persona definitions distinct from public demo accounts.
- **`frontend/src/mocks/fixtures/userDirectoryFixtures.ts`:**
  - Defines `SYNTHETIC_DEVELOPER_USER` (`USR_DEV_001`, `developer_internal`) and `SYNTHETIC_SUPER_ADMIN_USER` (`USR_SUPER_001`, `super_admin_demo`), both correctly gated behind `import.meta.env.DEV`.

### 3.2 Layout, Navigation & Prototype Chrome
- **`frontend/src/app/router/index.tsx`:**
  - Contains `DeveloperRouteGuard` guarding `/design-system`:
    ```tsx
    const DeveloperRouteGuard = ({ children }: { children: React.ReactNode }) => {
      const { user, isAuthenticated } = useAuth();
      if (!isAuthenticated || user?.role !== 'developer') {
        return <NotFoundPage />;
      }
      return <>{children}</>;
    };
    ```
    *Finding:* The guard correctly returns `NotFoundPage` (404) for `user?.role !== 'developer'`. When Role Preview is introduced, the guard must continue evaluating authentic `user.role`, never `previewRole`.
- **`frontend/src/shared/ui/Navbar/Navbar.tsx`:**
  - Lines 104–108 guard the `/design-system` navigation link behind `{user?.role === 'developer' && ...}`.
- **`frontend/src/shared/ui/Sidebar/Sidebar.tsx` & `MobileDrawer.tsx`:**
  - Uses `isNavItemVisibleForRole(item, role)` from `navigation.ts`.
- **`frontend/src/shared/config/navigation.ts`:**
  - Configures `design-system` nav item with `allowedRoles: ['developer']`.
- **`frontend/src/shared/ui/Footer/Footer.tsx`:**
  - Lines 53–57 guard the `/design-system` link behind `user?.role === 'developer'`.
  - *Defect Identified (`MFR-25`):* Line 25 unconditionally renders a public prototype milestone badge:
    ```tsx
    <Badge variant="primary">المرحلة 2: هيكل التطبيق (v0.2.0)</Badge>
    ```
- **`frontend/src/shared/ui/MobileDrawer/MobileDrawer.tsx`:**
  - *Defect Identified (`MFR-25`):* Line 154 unconditionally renders a public milestone label:
    ```tsx
    المنظومة التدريبية الذكية لمترو القاهرة (المرحلة 3)
    ```

---

## 4. Architectural Design: Two Strictly Separated Developer Tools

Per Revision 5, Section 4 and Decision **`D-10`**, Phase 5 implements two distinct tools:

```
+---------------------------------------------------------------------------------------------------+
|                                     DEVELOPER TOOLING (D-10)                                      |
+-------------------------------------------------+-------------------------------------------------+
|          A. Role Preview (معاينة الدور)         |     B. Isolated Role Test Session (اختبار)      |
+-------------------------------------------------+-------------------------------------------------+
| - Driven by RolePreviewContext                  | - Driven by AuthContext session switch          |
| - AuthContext.user remains 'developer'          | - AuthContext.user becomes synthetic persona    |
| - API token remains Developer token             | - API token becomes test persona token          |
| - effectiveUiRole = previewRole ?? role         | - Genuine role authorization in handlers        |
| - Global roles + Scoped assistant_lecturer      | - Real 403 / 202 / 200 API responses            |
| - UI menus, layouts & badges preview only       | - Mutations permitted within role ceiling       |
| - Mutations BLOCKED (Mutation Barrier)          | - Mutations subject to approval lifecycle       |
| - Origin session: untouched                     | - Origin session: preserved in storage slot     |
| - Exit: One-click "إنهاء المعاينة"               | - Exit: One-click "العودة إلى جلسة المطور"      |
+-------------------------------------------------+-------------------------------------------------+
```

### 4.1 Tool A: Role Preview (`معاينة الدور`) & Scoped `assistant_lecturer` Preview
- **Purpose:** Allow the Developer to visually inspect how the application renders for different roles and group assignments without altering security credentials or permissions.
- **Architecture:**
  - `RolePreviewContext.tsx` provides:
    - `previewRole: UserRole | null` (canonical global roles: `super_admin`, `admin`, `assistant_admin`, `lecturer`, `user`)
    - `scopedAssignmentPreview: { type: 'assistant_lecturer', groupId?: string } | null`
    - `effectiveUiRole: UserRole` (`previewRole ?? authUser?.role ?? 'user'`)
    - `isRolePreviewActive: boolean`
    - `setPreviewRole(role: UserRole | null): void`
    - `setScopedAssignmentPreview(preview: { type: 'assistant_lecturer', groupId?: string } | null): void`
    - `exitRolePreview(): void`
  - Accessible **only** when authenticated `AuthContext.user?.role === 'developer'`.
  - **Scoped `assistant_lecturer` Visual Preview:**
    - Does **not** modify `UserRole` enum.
    - Does **not** modify `ROLE_DEFAULT_CAPABILITIES` or `ROLE_CAPABILITY_CEILINGS`.
    - Simulates the group-assigned instructor interface (e.g. view group materials, meetings, attendance tabs in `GroupMonitoringPage`).
    - API authorization identity remains `developer` (`USR_DEV_001`).
  - **Mutation Barrier:** Any write operation attempted while preview is active is intercepted. A warning toast informs the Developer:
    > `وضع معاينة الواجهة مخصص للاطلاع البصري فقط. لا يمكن تنفيذ عمليات التعديل في هذا الوضع. لتجربة الصلاحيات وتعديل البيانات، يرجى بدء "جلسة اختبار صلاحيات معزولة".`
  - **Persistent Preview Banner:**
    - For global roles: `وضع معاينة الواجهة فقط: [اسم الدور] — الصلاحيات البرمجية الحالية: المطور`
    - For scoped roles: `وضع معاينة الواجهة فقط: مدرس مساعد (تكليف بمجموعة) — الصلاحيات البرمجية الحالية: المطور`
    - Action: `إنهاء المعاينة`

### 4.2 Tool B: Isolated Role Test Sessions (`اختبار الصلاحيات`, `D-10`)
- **Purpose:** Allow the Developer to execute genuine API authorization checks, approval lifecycles, and role-based workflows using authentic persona credentials.
- **Strict Synthetic Persona Registry / Allowlist:**
  ```ts
  export interface SyntheticTestPersona {
    id: string;
    username: string;
    role: UserRole;
    displayName: string;
    description: string;
  }

  export const SYNTHETIC_TEST_PERSONA_REGISTRY: Record<string, SyntheticTestPersona> = {
    'USR_TEST_SUPER_001': {
      id: 'USR_TEST_SUPER_001',
      username: 'test_super_admin',
      role: 'super_admin',
      displayName: 'حساب اختبار: مدير عام',
      description: 'اختبار صلاحيات الإدارة العليا والاطلاع الشامل'
    },
    'USR_TEST_ADMIN_001': {
      id: 'USR_TEST_ADMIN_001',
      username: 'test_admin',
      role: 'admin',
      displayName: 'حساب اختبار: مدير نظام',
      description: 'اختبار قرارات الاعتماد وإدارة المجموعات'
    },
    'USR_TEST_AST_001': {
      id: 'USR_TEST_AST_001',
      username: 'test_assistant_admin',
      role: 'assistant_admin',
      displayName: 'حساب اختبار: مساعد مدير',
      description: 'اختبار دورة الاعتماد التلقائي (INV-R9, 202 Accepted)'
    },
    'USR_TEST_LEC_001': {
      id: 'USR_TEST_LEC_001',
      username: 'test_lecturer',
      role: 'lecturer',
      displayName: 'حساب اختبار: محاضر',
      description: 'اختبار بناء المقررات وإدارة التعليقات'
    },
    'USR_TEST_TRN_001': {
      id: 'USR_TEST_TRN_001',
      username: 'test_trainee',
      role: 'user',
      displayName: 'حساب اختبار: متدرب',
      description: 'اختبار التسجيل ومتابعة التقدم'
    }
  };
  ```
- **Session Lifecycle & Preservation Protocol:**
  1. **Validation:** `launchIsolatedTestSession(personaId)` verifies `personaId` is an explicit key in `SYNTHETIC_TEST_PERSONA_REGISTRY`. Prefix-only checks and real accounts are strictly rejected.
  2. **Nested Session Prevention:** If an isolated test session is already active, launching another is rejected (`409 Conflict`).
  3. **Preservation:** The active Developer session is serialized to `metro_lms_developer_origin_session` containing:
     ```ts
     interface DeveloperOriginSession {
       user: AuthUser; // USR_DEV_001, role: 'developer'
       token: string;  // Developer bearer token
       savedAt: string; // ISO timestamp
       version: number; // Schema version (1)
     }
     ```
  4. **Authentication Switch:** `AuthContext` logs in as the synthetic test persona, updating `metro_lms_auth_session` and API authorization headers.
  5. **Rollback Guarantee:** If login fails, `metro_lms_developer_origin_session` is purged and the Developer session remains active.
  6. **Warning Banner:** Persistent top banner displayed:
     > `جلسة اختبار صلاحيات معزولة (حساب اختباري: [اسم الحساب / الدور])`  
     > Action button: `العودة إلى جلسة المطور`
  7. **One-Click Return:** Clicking `العودة إلى جلسة المطور` retrieves the origin session from `metro_lms_developer_origin_session`, restores `AuthContext.user` to `USR_DEV_001`, purges `metro_lms_developer_origin_session`, and updates `metro_lms_auth_session`.

---

## 5. Developer Session Storage Lifecycle & Protection Details

| Lifecycle Event | Action on `metro_lms_auth_session` | Action on `metro_lms_developer_origin_session` | Security & Invariant Guarantee |
|---|---|---|---|
| **Normal Developer Session** | Holds Developer session | Empty / null | Normal Developer operations |
| **Launch Test Session** | Replaced with test persona session | Written with Developer session fields | Developer origin session safely preserved |
| **Active Test Session** | Holds test persona session | Intact (read-only) | API requests use test persona token only; Developer token is never transmitted |
| **Page Refresh in Test Session** | Re-hydrates test persona session | Persists in `sessionStorage` | Warning banner and return button persist across page reloads |
| **Click "العودة إلى جلسة المطور"** | Restored to Developer session | Completely cleared / removed | Temporary test identity purged; Developer restored cleanly |
| **Explicit Logout in Test Session** | Cleared / removed | Completely cleared / removed | `INV-P5-7`: Developer origin token is never orphaned in storage |
| **Corrupted/Expired Origin Data** | Cleared | Cleared | Safe fallback to clean logout redirecting to `/login` |

### Prototype Security Notice vs. Production Architecture
In the client-side prototype, `sessionStorage` provides tab-scoped persistence. It simulates session isolation but does not represent a hardware vault. In the production backend (Phase 12), session state and origin switching are managed server-side via HTTP-only, secure, partitioned session cookies and server-side session stores, preventing token inspection in client-side storage.

---

## 6. Developer-Only Surface Protection (`MFR-25`)

To satisfy `MFR-25` and `INV-R8`:

1. **Route Guard Enforcement:**
   - `DeveloperRouteGuard` in `router/index.tsx` checks authentic `AuthContext.user.role === 'developer'`.
   - It ignores `previewRole` and `scopedAssignmentPreview`.
   - Direct URL access to `/design-system` by any non-developer returns `NotFoundPage` (`404`), not `ForbiddenPage` (`403`).
2. **Navigation Protection:**
   - `/design-system` navigation items are rendered only when `user?.role === 'developer'`.
   - In Role Preview mode (`effectiveUiRole !== 'developer'`), navigation menus reflect the previewed role (so `/design-system` is hidden from the sidebar/navbar). The top preview banner remains visible to allow exiting preview.
3. **Prototype Milestone Badges:**
   - `Footer.tsx` line 25: `<Badge variant="primary">المرحلة 2: هيكل التطبيق (v0.2.0)</Badge>` must be gated behind `user?.role === 'developer'`.
   - `MobileDrawer.tsx` line 154: `المنظومة التدريبية الذكية لمترو القاهرة (المرحلة 3)` must be gated behind `user?.role === 'developer'`.
   - All public views will render clean, professional production chrome.

---

## 7. Security and State-Isolation Threat Analysis (14 Failure Modes & Mitigations)

| # | Threat / Failure Mode | Risk Level | Architectural Mitigation |
|:---:|---|:---:|---|
| **1** | **Role Preview alters API authorization headers** | Critical | `RolePreviewContext` is completely decoupled from `AuthContext.user` and the API client. Network request headers continue to send authentic `AuthContext.user.token`. |
| **2** | **Test persona accidentally inherits Developer privileges** | Critical | `launchIsolatedTestSession` fully logs out the Developer and authenticates as the synthetic persona. Handlers evaluate `req.headers.authorization` which resolves strictly to the test persona. |
| **3** | **Loss of Developer origin session during test session** | High | The Developer session token and user object are written to persistent `sessionStorage` (`metro_lms_developer_origin_session`) before test-session login. |
| **4** | **Corrupted restoration after exiting test session** | High | `exitIsolatedTestSession` validates schema, timestamp, and user ID before restoration. If corrupted, it defaults to a clean redirect to `/login`. |
| **5** | **Browser page reload during isolated test session** | Medium | The test persona session resides in `metro_lms_auth_session` and reloads normally. The origin session remains intact in `metro_lms_developer_origin_session`, so the warning banner and return button persist across reloads. |
| **6** | **Browser back/forward navigation across session boundaries** | Medium | Session state is stored in memory and session storage. History navigation between pages does not alter active authentication context. |
| **7** | **Explicit logout clicked during an active test session** | Medium | `INV-P5-7`: Clicking `logout` purges both the active test session (`metro_lms_auth_session`) AND the origin session (`metro_lms_developer_origin_session`), returning cleanly to `/login`. |
| **8** | **Direct route access to Developer-only `/design-system`** | High | `DeveloperRouteGuard` checks authentic `AuthContext.user.role === 'developer'`. It ignores `previewRole` and blocks test personas with standard `NotFoundPage` (404). |
| **9** | **Role Preview mistaken for genuine permission testing** | Medium | Persistent top banner explicitly displays: `وضع معاينة الواجهة فقط — الصلاحيات البرمجية الحالية: المطور`. Mutation attempts trigger informative toasts redirecting to Isolated Role Test Sessions. |
| **10** | **Stale user-specific cache/store leaking across sessions** | Medium | `launchIsolatedTestSession` and `exitIsolatedTestSession` invalidate client-side query caches and reset user-specific ephemeral store state. |
| **11** | **Test persona credentials leaked into production builds** | High | `SYNTHETIC_TEST_PERSONA_REGISTRY` and test launchers are wrapped in `if (import.meta.env.DEV)` and tree-shaken from production bundles. |
| **12** | **Multiple browser tabs causing session divergence** | Low | Sessions use `sessionStorage` (tab-scoped) rather than `localStorage` (cross-tab), ensuring each browser tab maintains an independent, isolated session lifecycle. |
| **13** | **Nested isolated test sessions** | Medium | `launchIsolatedTestSession` verifies no origin session is currently saved. Attempting to launch a test session while already in one is blocked (`409 Conflict`). |
| **14** | **Failed test login damages Developer session** | High | If persona authentication throws an error during launch, the launcher catches the error, purges the pending origin slot, and preserves the active Developer session untouched. |

---

## 8. Revised Increment Breakdown

### Increment 5.1 — Developer-Only Surface Protection & Prototype Chrome Isolation (`MFR-25`)
- **Objective:** Eliminate prototype badges and enforce uniform 404 non-disclosure on `/design-system` for non-developers.
- **Files Modified:**
  - `frontend/src/shared/ui/Footer/Footer.tsx` (gate line 25 milestone badge behind `user?.role === 'developer'`).
  - `frontend/src/shared/ui/MobileDrawer/MobileDrawer.tsx` (gate line 154 milestone label behind `user?.role === 'developer'`).
  - `frontend/src/app/router/index.tsx` (verify `DeveloperRouteGuard` strictly relies on authentic `user.role`).
  - `frontend/src/shared/config/navigation.ts` (reconfirm `/design-system` allowed roles).
- **Security Invariants:** `INV-R8`, `INV-P5-5`.
- **Acceptance Criteria:** Non-developers navigating to `/design-system` receive `404 Not Found`. Footer and MobileDrawer prototype badges are completely invisible to non-developers.
- **Rollback Consideration:** Trivial component-level rollback with zero state impact.

### Increment 5.2 — Visual Role Preview Architecture (`MFR-40`, `D-10`)
- **Objective:** Implement visual role preview (global roles + scoped `assistant_lecturer`) without altering authenticated session or network credentials.
- **Files Created/Modified:**
  - `frontend/src/core/auth/RolePreviewContext.tsx` *(new)*
  - `frontend/src/app/layouts/AppLayout.tsx` (render preview indicator banner and provide context).
  - `frontend/src/shared/ui/Navbar/Navbar.tsx` (consume `effectiveUiRole` for preview layout).
  - `frontend/src/shared/ui/Sidebar/Sidebar.tsx` (consume `effectiveUiRole` for preview menu).
  - `frontend/src/features/developer/components/RolePreviewBanner.tsx` *(new)*
- **Security Invariants:** `INV-P5-1`, `INV-P5-2`, `INV-P5-6`.
- **Acceptance Criteria:** Setting `previewRole` updates UI layouts and navigation; setting scoped `assistant_lecturer` simulates group instructor views; `AuthContext.user` remains `developer`; API client continues using Developer token; mutation attempts are intercepted with warning toast.
- **Rollback Consideration:** Preview context wraps presentation layer only; disabling it falls back to standard `user.role`.

### Increment 5.3 — Synthetic Personas & Complete Isolated Session Round-Trip (`D-10`, `MFR-40`)
- **Objective:** Implement genuine test persona authentication, strict registry validation, and complete one-click return flow.
- **Files Created/Modified:**
  - `frontend/src/core/auth/testPersonas.ts` *(new - contains `SYNTHETIC_TEST_PERSONA_REGISTRY`)*
  - `frontend/src/core/auth/authStorage.ts` (add `saveDeveloperOriginSession`, `getDeveloperOriginSession`, `clearDeveloperOriginSession`).
  - `frontend/src/core/auth/AuthContext.tsx` (add `launchIsolatedTestSession(personaId)`, `exitIsolatedTestSession()`, deprecate unsafe `switchDemoUser`).
  - `frontend/src/features/developer/components/IsolatedTestSessionBanner.tsx` *(new - renders banner and "العودة إلى جلسة المطور" button)*.
  - `frontend/src/mocks/fixtures/userDirectoryFixtures.ts` (register synthetic test users).
- **Security Invariants:** `INV-D10-1`, `INV-P5-3`, `INV-P5-4`.
- **Acceptance Criteria:** Minimum viable lifecycle is complete: launch $\rightarrow$ preserve origin $\rightarrow$ authenticate persona $\rightarrow$ show banner $\rightarrow$ click return $\rightarrow$ restore origin $\rightarrow$ purge temporary session. Nested sessions blocked. Real accounts rejected.
- **Rollback Consideration:** If test session launch fails, Developer session remains active in storage.

### Increment 5.4 — Session Lifecycle Hardening, Edge Cases & Security Regression Matrix
- **Objective:** Address page refresh, multi-tab isolation, explicit logout purge semantics, malformed origin recovery, and author regression test suite.
- **Files Created/Modified:**
  - `frontend/src/core/auth/AuthContext.tsx` (integrate origin purge on explicit `logout()`).
  - `frontend/src/core/auth/authStorage.ts` (add origin schema validation and expiry checks).
  - `frontend/src/test/developer-preview-and-isolated-testing.test.tsx` *(new test suite)*
- **Security Invariants:** `INV-R8`, `INV-D10-1`, `INV-P5-4`, `INV-P5-7`.
- **Acceptance Criteria:** Page refresh retains test persona and return button; explicit logout purges both sessions; malformed origin data safely redirects to `/login`; all 22 test cases cataloged under deferred rule.
- **Rollback Consideration:** Clean restoration default redirects to `/login` if origin token is missing.

---

## 9. Testing Strategy — Planning Only

All test scenarios designed for Phase 5 remain strictly subject to the project-wide governance rule:
$$\text{WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13}$$

A dedicated test suite `frontend/src/test/developer-preview-and-isolated-testing.test.tsx` will be authored across four test domains:
1. **Role Preview State & UI Isolation:**
   - Verify `previewRole` updates `effectiveUiRole` without modifying `AuthContext.user`.
   - Verify non-developer user cannot activate preview.
   - Verify preview role changes update navigation menus and badges.
   - Verify scoped `assistant_lecturer` preview sets group instructor views without altering `UserRole`.
   - Verify network requests continue carrying Developer bearer token.
   - Verify write operations in preview mode trigger mutation barrier warnings.
2. **Synthetic Persona Allowlisting & Authentication:**
   - Verify `launchIsolatedTestSession` succeeds for registered test personas.
   - Verify `launchIsolatedTestSession` strictly rejects non-registered IDs, arbitrary prefixes, and real accounts.
   - Verify Developer origin session is preserved in `metro_lms_developer_origin_session`.
   - Verify API requests carry test persona token and receive authentic `403`/`202` responses.
   - Verify test persona never inherits Developer capabilities or access to `/design-system`.
3. **Session Round-Trip, Lifecycle & Hardening:**
   - Verify single-click `العودة إلى جلسة المطور` restores exact Developer session.
   - Verify nested test session attempts are rejected.
   - Verify page refresh retains test session and origin restoration capability.
   - Verify explicit logout purges both test session and origin session (`INV-P5-7`).
   - Verify malformed origin session safely falls back to `/login`.
4. **Developer Surface Protection (`MFR-25`):**
   - Verify `/design-system` returns `404 Not Found` for all non-developers.
   - Verify `/design-system` navigation links are hidden from non-developers.
   - Verify prototype milestone badges are invisible to non-developers.

---

## 10. Developer and Super Admin Inventory (Mandatory)

In compliance with project confidentiality requirements, the status of privileged accounts is confirmed:

### Developer Account
- **Canonical ID:** `USR_DEV_001`
- **Username:** `developer_internal`
- **Current Source Status:** Defined as a synthetic fixture in `userDirectoryFixtures.ts` (lines 40–54).
- **Environment Restriction:** Strictly gated behind `import.meta.env.DEV === true`.
- **Intended Authentication:** Synthetic token-based login in dev/prototype mode.
- **Production Credential/Provisioning Strategy (Phase 12):** Provisioned exclusively via server-side CLI migration (`pnpm db:bootstrap-developer`) using server-only environment variables (`DEVELOPER_BOOTSTRAP_EMAIL`, `DEVELOPER_BOOTSTRAP_PASSWORD_HASH`). Enforces database partial unique index (`CREATE UNIQUE INDEX idx_singleton_developer ON users ((role)) WHERE role = 'developer'`). Passwords and tokens are completely excluded from source code.

### Super Admin Account
- **Canonical ID:** `USR_SUPER_001`
- **Username:** `super_admin_demo`
- **Current Source Status:** Defined as a synthetic fixture in `userDirectoryFixtures.ts` (lines 56–72).
- **Environment Restriction:** Strictly gated behind `import.meta.env.DEV === true`.
- **Intended Authentication:** Synthetic demo authentication for development and staging preview.
- **Production Credential/Provisioning Strategy (Phase 12):** Created through authorized Developer provisioning flow or initial seed migration with mandatory password reset on first login.

### Planned Synthetic Test Personas (`SYNTHETIC_TEST_PERSONA_REGISTRY`)
- `USR_TEST_SUPER_001` — `test_super_admin` (`super_admin`)
- `USR_TEST_ADMIN_001` — `test_admin` (`admin`)
- `USR_TEST_AST_001` — `test_assistant_admin` (`assistant_admin`)
- `USR_TEST_LEC_001` — `test_lecturer` (`lecturer`)
- `USR_TEST_TRN_001` — `test_trainee` (`user`)

*(All passwords, tokens, and secrets remain redacted and excluded from source code and documentation).*

---

## 11. Strict Planning Boundaries Statement

- **No source code was modified during this task.**
- **No tests, type checkers (`tsc`), linters (ESLint), build scripts, or scanners were executed.**
- **No synthetic accounts or fixtures were created or altered.**
- **The Revision 5 roadmap remains authoritative, unmodified, and frozen.**
- **Approved code and documentation for Phases 1, 2, 3, and 4 remain frozen.**
- **Phase 5 implementation has NOT started and will not commence without explicit owner approval.**
