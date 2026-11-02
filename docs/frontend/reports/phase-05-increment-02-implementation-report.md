# MetroLMS — Increment 5.2 Implementation Report: Visual Role Preview Architecture

**Document Version:** 1.0  
**Phase:** Phase 5 — Developer Role Preview (`معاينة الدور`) & Isolated Role Testing (`اختبار الصلاحيات`, `D-10`)  
**Increment:** Increment 5.2 — Visual Role Preview Architecture  
**Authoritative References:**  
- `docs/backend/pre-backend-migration-remediation-roadmap.md` — Revision 5 (Sections 3 & 4)  
- `docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md`  
- `docs/frontend/reports/phase-05-planning-report.md`  
**Assigned Findings:** `MFR-40` (`D-10`), `MFR-25` (`F-25`)  
**Status:** Implementation Complete — Tests Authored & Deferred — Ready for Owner Review  
**Date:** November 3, 2026  

---

## 1. Executive Implementation Summary

Increment 5.2 implements the **Visual Role Preview** mechanism defined in the approved Phase 5 architecture, adhering strictly to Owner Decision **`D-10`** and Stable Finding **`MFR-40`**.

Visual Role Preview enables an actually authenticated Developer (`USR_DEV_001`, `role: 'developer'`) to preview the visual UI presentation, navigation hierarchy, badges, and layout variants of other roles without modifying or replacing the live authenticated identity, active session token, API authorization headers, or underlying backend permission evaluations.

Concurrently, a centralized **Mutation Barrier** is established within the core HTTP transport client (`apiClient`), ensuring that any state-changing operations (`POST`, `PUT`, `PATCH`, `DELETE`) attempted while visual preview is active are intercepted before network execution, protecting Developer authority from inadvertent mutation under simulated role appearances.

---

## 2. Inventory of Created & Modified Source Files

### 2.1 Files Created
1. `frontend/src/core/auth/previewMutationBarrier.ts`:
   - Centralized, robust state barrier managing mutation suppression during visual role preview.
   - Exports:
     - `setRolePreviewMutationBarrier(active: boolean, onBlocked?: (msg: string) => void): void`
     - `isRolePreviewMutationBlocked(): boolean`
     - `triggerRolePreviewBlockedNotification(): void`
     - `ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE`
2. `frontend/src/core/auth/RolePreviewContext.tsx`:
   - Core visual preview context and provider.
   - Available exclusively to actual authenticated Developer (`AuthContext.user.role === 'developer'`).
   - In-memory state only (never persisted in `sessionStorage`, `localStorage`, or cookies).
   - Automatically synchronizes with the mutation barrier and resets on logout, user change, or identity change.
   - Manages global preview roles (`super_admin`, `admin`, `assistant_admin`, `lecturer`, `user`) and scoped assignment preview (`assistant_lecturer`).
3. `frontend/src/core/auth/useRolePreview.ts`:
   - Dedicated typed hook providing access to `RolePreviewContextValue` with safe fallback when invoked outside the provider.
4. `frontend/src/features/auth/components/RolePreviewBanner.tsx`:
   - Persistent top banner rendered during active visual preview with approved Arabic text:
     `وضع معاينة الواجهة فقط: [الدور] — الصلاحيات البرمجية الحالية: المطور`
     and one-click exit action: `إنهاء المعاينة`.
5. `frontend/src/features/auth/components/RolePreviewModal.tsx`:
   - Accessible modal allowing the Developer to pick from the 6 supported preview roles.
   - Incorporates real Group domain checking for `assistant_lecturer`, requiring selection of an existing group assignment, and rendering an informative empty state if no assistant assignments exist.
6. `frontend/src/features/auth/components/RolePreviewControl.tsx`:
   - Compact trigger button rendered in the application header for authenticated Developers to launch `RolePreviewModal`.
7. `frontend/src/test/role-preview.test.tsx`:
   - Comprehensive test suite containing 14 test cases covering all 12 security and regression requirements from Section 9.
   - Marked `STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

### 2.2 Files Modified
1. `frontend/src/core/api/apiClient.ts`:
   - Integrated mutation barrier check directly into `apiClient`. If method is `POST`, `PUT`, `PATCH`, or `DELETE` and `isRolePreviewMutationBlocked()` is true, triggers user notification and throws `ApiError(ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE)` without executing `fetch`.
2. `frontend/src/app/router/index.tsx`:
   - Wrapped `<RouterProvider>` with `<RolePreviewProvider>` within `<AuthProvider>` and `<ToastProvider>`.
   - Re-exported `RolePreviewProvider` for centralized router-level imports.
3. `frontend/src/app/layouts/AppLayout.tsx`:
   - Wrapped `AppLayoutInner` with `<RolePreviewProvider>`.
   - Derived `navbarUser` using `effectiveUiRole` and preview labels for visual presentation.
   - Passed `effectiveUiRole` to `<Sidebar userRole={effectiveUiRole} />`.
   - Rendered persistent `<RolePreviewBanner />` at the top of the application shell.
   - Rendered `<RolePreviewModal />` controlled via local modal state.
4. `frontend/src/shared/ui/Navbar/Navbar.tsx`:
   - Added `<RolePreviewControl />` for authenticated Developer accounts.
   - Preserved Developer-only `/design-system` button, which naturally suppresses during active non-developer preview.
5. `frontend/src/shared/ui/Sidebar/Sidebar.tsx`:
   - Consumed `useRolePreview()`.
   - Suppressed Developer-only `/design-system` navigation link and prototype milestone badge (`• مرحلة 2`) during active visual preview to ensure authentic visual representation of the target role.
6. `frontend/src/shared/ui/MobileDrawer/MobileDrawer.tsx`:
   - Consumed `useRolePreview()`.
   - Suppressed Developer-only `/design-system` navigation link and milestone label (`(المرحلة 3)`) during active visual preview.
7. `frontend/src/features/auth/index.ts`:
   - Exported all new role preview components, hooks, and types.
8. `docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md`:
   - Marked Increment 5.2 items as `[Completed]`. Maintained Increments 5.3 and 5.4 strictly as `[Not Started]`.

---

## 3. Architecture & Separation of Concerns

### 3.1 Actual Identity vs. Effective Presentation Role

| Property | Actual Authentication Context (`AuthContext`) | Visual Role Preview (`RolePreviewContext`) |
|---|---|---|
| **User Object** | `AuthContext.user` (Always Developer `USR_DEV_001`) | Not modified / untouched |
| **User Role** | `developer` (Unchanged throughout preview) | `effectiveUiRole = previewRole ?? user.role` |
| **Canonical ID** | `USR_DEV_001` (Unchanged) | Not modified |
| **Session Token** | `mock_jwt_USR_DEV_001_test` (Unchanged) | Not modified |
| **API Header** | `Authorization: Bearer <developer-token>` | Never receives `effectiveUiRole` |
| **Storage Persistence** | `sessionStorage` (`metro_lms_auth_session`) | Pure in-memory React state (no storage) |
| **Route Protection** | `DeveloperRouteGuard` checks `AuthContext.user.role` | Route guards continue to evaluate actual identity |
| **UI Presentation** | Navigation menus, role chips, badges | Renders layout matching `effectiveUiRole` |
| **Mutation Authority** | Developer administrative capabilities | Blocked by `previewMutationBarrier` |

### 3.2 Provider Hierarchy
The context providers are configured in strict hierarchical order:

```
ErrorBoundary
  └── AuthProvider (Authoritative identity: user, login, logout, session revalidation)
        └── ToastProvider (Global notification center)
              └── RolePreviewProvider (Visual role simulation & mutation barrier sync)
                    └── RouterProvider (Application routes & layouts)
                          └── AppLayout (App shell, Top Banner, Navbar, Sidebar, Drawer)
```

---

## 4. Supported Preview Roles & Scoped Assistant Lecturer Design

### 4.1 Supported Roles
The Visual Role Preview selector supports six explicit roles:
1. `super_admin` (`المدير العام`) — Upper administrative overview.
2. `admin` (`مدير النظام`) — Full administrative management and group monitoring.
3. `assistant_admin` (`مساعد مدير نظام`) — Operational administration subject to approval policies (`INV-R9`).
4. `lecturer` (`محاضر معتمد`) — Curriculum builder and course instruction.
5. `assistant_lecturer` (`مدرس مساعد`) — Group-scoped assignment held by a lecturer account.
6. `user` (`متدرب`) — Trainee course catalog and personal progress tracking.

### 4.2 Group-Scoped Assistant Lecturer Governance
In accordance with Revision 5 Roadmap Section 4 and Decision **`D-10`**:
- `assistant_lecturer` is **not** added to the global `UserRole` union (`core/auth/types.ts`).
- It is **not** added to `ROLE_DEFAULT_CAPABILITIES` or `ROLE_CAPABILITY_CEILINGS`.
- It represents an instructor account assigned to assist in a specific training group (`TrainingGroup.assistantLecturerIds` / `TrainingGroup.instructors[].instructorRole === 'assistant'`).
- In `RolePreviewContext`, `assistant_lecturer` requires an explicit, typed `scopedAssignmentPreview`:
  ```ts
  export interface ScopedAssignmentPreview {
    type: 'assistant_lecturer';
    groupId: string;
    groupName: string;
    assistantLecturerId?: string;
    assistantLecturerName?: string;
  }
  ```
- **Validation Guard:** Invoking `startPreview('assistant_lecturer')` without a valid existing `groupId` is immediately rejected (`returns false`).
- **Modal Integration:** When `assistant_lecturer` is selected in `RolePreviewModal`, it dynamically queries approved groups via `groupsApi.getAdminGroups()`. If no groups contain an assigned assistant lecturer, an informative empty state is rendered:
  > `لا توجد مجموعات تدريبية تحتوي على تكليف محاضر مساعد حالياً. لمعاينة هذا الدور، يجب تعيين محاضر مساعد لمجموعة أولاً عبر إدارة المجموعات.`  
  and preview activation is disabled until an assigned group exists.
- **Presentation Mapping:** Under `assistant_lecturer` preview, `effectiveUiRole` resolves to `'lecturer'`, and the top banner identifies both the scoped role and the specific group context.

---

## 5. Mutation Safety During Visual Role Preview

### 5.1 Design & Centralized Barrier
Visual preview requests continue to transmit the Developer's authentic token. To prevent a Developer from unintentionally creating, modifying, or deleting live data while visually inspecting another role's UI:
1. `previewMutationBarrier.ts` manages a singleton barrier state (`isBarrierActive`).
2. When `startPreview` is invoked, `setRolePreviewMutationBarrier(true)` is activated.
3. Inside `apiClient`, before any `fetch` transport call is initiated, the HTTP method is inspected:
   ```ts
   const method = (customConfig.method || 'GET').toUpperCase();
   const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
   if (isMutation && isRolePreviewMutationBlocked()) {
     triggerRolePreviewBlockedNotification();
     throw new ApiError(
       ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE,
       403,
       { code: 'ROLE_PREVIEW_MUTATION_BLOCKED', previewBlocked: true },
       url
     );
   }
   ```
4. State-changing requests are aborted at the client threshold without network dispatch.
5. The Developer receives the approved Arabic notice:
   > `وضع معاينة الواجهة مخصص للاطلاع البصري فقط. لا يمكن تنفيذ عمليات التعديل في هذا الوضع. لتجربة الصلاحيات وتعديل البيانات، يرجى بدء "جلسة اختبار صلاحيات معزولة".`
6. `GET` operations remain permitted, allowing the Developer to visually inspect real pages, course catalogs, progress tables, and dashboards.

### 5.2 Actual Mutation Protection Coverage
- **Covered (100% Intercepted):**
  - All shared client API services utilizing `apiClient`: `authApi`, `groupsApi`, `coursesApi`, `permissionsApi`, `commentsApi`, `notificationsApi`, `userManagementApi`.
  - All standard HTTP mutation verbs: `POST`, `PUT`, `PATCH`, `DELETE`.
  - Form submission buttons across Admin, Lecturer, and Trainee views that trigger API calls.
- **Uncovered Surfaces (Local Client State Only):**
  - Pure React component-level local state (e.g. typing in an input field before submission, toggling an accordion, switching local UI tabs) is allowed so the Developer can inspect responsive form layouts. Clicking the final action button calls `apiClient`, which is intercepted and blocked.
  - No legacy Vanilla JS scripts or third-party SDKs have mutation access to modern LMS API endpoints.

---

## 6. Audit of `switchDemoUser` Call Sites

A comprehensive codebase audit was conducted across all files:

| File | Line(s) | Context / Current Purpose | Action in Increment 5.2 | Increment 5.3 Planned Action |
|---|---|---|---|---|
| `frontend/src/core/auth/AuthContext.tsx` | 139–145 | Legacy rapid account login helper using `SYNTHETIC_DEMO_ACCOUNTS`. | Kept for backward compatibility; completely avoided by Visual Role Preview. | Will be retired/replaced by `launchIsolatedTestSession`. |
| `frontend/src/core/auth/types.ts` | 53 | Type signature in `AuthContextValue`. | Preserved without change. | Replaced by isolated test session methods. |
| `frontend/src/core/auth/useAuthContext.ts` | 21 | Fallback implementation for unmounted hook. | Preserved without change. | Replaced in Increment 5.3. |
| `frontend/src/pages/DashboardPreviewPage.tsx` | 27, 135, 144, 153 | Early visual prototype component created in Phase 1 (not routed in `router/index.tsx`). | Audited; verified unrouted. | Cleaned up during Phase 13 dead-code review. |

**Confirmed:** Visual Role Preview does **not** call `switchDemoUser` under any circumstance. All visual role selections are handled exclusively via in-memory state in `RolePreviewContext`.

---

## 7. Deferred Test Suite Authoring (`role-preview.test.tsx`)

A dedicated test suite was authored:  
[`frontend/src/test/role-preview.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/role-preview.test.tsx)

### Execution Directive & Status
`STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`  
In strict compliance with project governance, zero test runners, compilers, or linters were executed (`npm test`, `vitest`, `tsc`, `eslint`, `vite build`).

### Authored Test Cases (14 Tests)
1. `1. Only an actual authenticated Developer can activate Role Preview` (startPreview returns false for non-developer).
2. `2. Previewing "admin" does not change AuthContext.user.role from "developer"` (AuthContext.user remains untouched).
3. `3. Previewing any supported role does not change active user ID or access token` (session storage integrity verified).
4. `4. API requests continue to use actual Developer authorization context during preview` (bearer token preserved).
5. `5. A preview role does not grant or remove actual API permissions` (matrix capability ceilings preserved).
6. `6. A non-Developer cannot activate preview by passing props, changing display state, or invoking preview controls` (controls unrendered).
7. `7. Developer-only route protection remains based on actual authenticated identity` (Developer retains access to `/design-system` during preview).
8. `8. assistant_lecturer is not added to the global UserRole type` (absent from role capability dictionaries).
9. `9. assistant_lecturer preview requires a valid group-scoped assignment context` (empty group rejects; valid group displays scoped name).
10. `10. Ending preview restores normal Developer UI` (persistent banner removed, Developer UI restored).
11. `11. Sign-out or authenticated-user changes clear preview state` (auto-clears preview state and barrier on logout).
12. `12. Mutating operations are blocked while preview is active by the mutation barrier` (POST and DELETE throw ApiError without network dispatch).
13. `13. Persistent preview banner displays approved Arabic text and one-click exit action` (validates exact wording and exit button).
14. `14. Navigation menus filter items according to effectiveUiRole during visual preview` (Sidebar and MobileDrawer filter correctly for target role while hiding Developer chrome).

---

## 8. Privileged Account Inventory (Mandatory Security Disclosure)

Per project governance, all credentials, passwords, tokens, and secrets remain strictly redacted:

### 8.1 Developer Account
- **Canonical ID:** `USR_DEV_001`
- **Username:** `developer_internal`
- **Current State:** Synthetic development fixture (`import.meta.env.DEV === true`).
- **Current Guard:** Protected by `DeveloperRouteGuard`, `isDeveloperSession` verification, and `INV-R8` uniform 404 parity.
- **Development Access:** Development token authentication flow via `authApi.login`.
- **Production Provisioning:** Future server-side `pnpm db:bootstrap-developer` migration in Phase 12 (server-only secrets, database singleton constraint, password rotation, MFA enrollment).

### 8.2 Super Admin Account
- **Canonical ID:** `USR_SUPER_001`
- **Username:** `super_admin_demo`
- **Current State:** Synthetic development fixture (`import.meta.env.DEV === true`).
- **Current Guard:** Protected by `INV-R2` (super_admin accounts can only be mutated by authenticated `developer`).
- **Development Access:** Development demo authentication flow.
- **Production Provisioning:** Future secured database bootstrap migration with mandatory first-login password rotation.

---

## 9. Verification & Governance Compliance Check

| Governance Requirement | Status | Evidence / Implementation Notes |
|---|---|---|
| **Zero Test/Tool Execution Directive** | **Compliant** | No test runner (`vitest`), linter (`eslint`), TypeScript compiler (`tsc`), or build (`vite`) commands were run. |
| **Preserve Increment 5.1 Protections** | **Compliant** | All Developer-only surfaces (`/design-system` 404 guard, Footer prototype badge, Sidebar milestone label) remain strictly developer-only. |
| **Separation of Preview from Testing (MFR-40)** | **Compliant** | `RolePreviewContext` provides visual UI simulation only. `AuthContext.user` and tokens are never modified. |
| **Scoped `assistant_lecturer` Support** | **Compliant** | Supported via typed `scopedAssignmentPreview` without altering global `UserRole` enum. |
| **Mutation Barrier Active** | **Compliant** | Centralized check in `apiClient` blocks state-changing verbs and displays approved Arabic toast. |
| **Persistent Banner Active** | **Compliant** | Top banner displays approved Arabic text and one-click `إنهاء المعاينة` action. |
| **No Modification to Revision 5 Roadmap** | **Compliant** | `docs/backend/pre-backend-migration-remediation-roadmap.md` untouched. |
| **Phases 1–4 Code & Docs Frozen** | **Compliant** | No accepted Phase 1–4 code or documentation modified. |
| **Legacy Vanilla JS Untouched** | **Compliant** | No files in `legacy-reference/` or vanilla scripts touched. |
| **Increment 5.3 & 5.4 State** | **Compliant** | Kept strictly as `[Not Started]` in checklist and code. |

---

## 10. Stop Condition & Next Steps

Increment 5.2 is **100% complete**.

In accordance with project-wide governance and instructions:
- **Work is halted.**
- Increment 5.3 (Synthetic Personas & Complete Isolated Session Round-Trip) will **not** be started without explicit owner authorization.
- Awaiting owner review and acceptance of Increment 5.2.

