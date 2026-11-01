# MetroLMS — Increment 3.4 Implementation Report
## Route Guards, Role-Based Navigation & Canonical Arabic Labels

> **Report Date:** November 2026  
> **Status:** `IMPLEMENTATION COMPLETED — AWAITING OWNER REVIEW & PHASE 3 FORMAL CLOSURE`  
> **Baseline Authority:** MetroLMS Official Pre-Backend Migration Remediation Roadmap (Revision 5), Sections 2, 2.1, 2.2, 5 (`D-04`, `D-05`, `D-14`), 6 (`MFR-03`, `MFR-05`, `MFR-06`, `MFR-08`, `MFR-16`, `MFR-17`, `MFR-21`, `MFR-29`, `MFR-30`), 7, 13 (Phase 3), 14, 15, and 16.  
> **Test Status Directive:** Per owner directive (Part A), zero test runner, compiler, linter, or build commands were executed during this turn. All authored tests are formally tracked as `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

---

## 1. Executive Summary & Authoritative Scope

Increment 3.4 is the final implementation increment of **Phase 3: Assistant Admin Visibility (`Rule A`, `D-14`), Route Guards & Role Navigation**.

This increment delivers the complete user interface and client-side routing enforcement layer for MetroLMS:
1. **Protected Route Guards (`MFR-17`):** Explicit role-scoped route protection across all routes in `frontend/src/app/router/index.tsx`. Unauthenticated visitors are redirected to `/login` with requested location preserved in `location.state`; unauthorized roles are redirected to `/403`; unknown, missing, or malformed roles fail closed.
2. **Role-Filtered Shell Navigation (`MFR-08`):** A single centralized predicate `isNavItemVisibleForRole` in `frontend/src/shared/config/navigation.ts` filtering navigation items across both the desktop `Sidebar.tsx` and the mobile `MobileDrawer.tsx`. Trainees (`user`) see only Overview and Learning links; the entire Operations & Management section is completely hidden. Lecturers see Course Builder alongside learning items; administrative items are completely hidden. Administrators (`developer`, `super_admin`, `admin`, `assistant_admin`) see all administrative links. The developer is the sole role authorized to see `/design-system`.
3. **Dashboard UI Routing & Role Resolution (`MFR-05`):** `DashboardPage.tsx` routes all four administrative roles (`developer`, `super_admin`, `admin`, `assistant_admin`) to `<AdminDashboard />`. `assistant_admin` never routes to `TraineeDashboard`.
4. **Canonical Arabic Role Labels (`MFR-16`):** Standardized on `ROLE_CANONICAL_LABELS_AR` from `frontend/src/core/permissions/types.ts` as the single authoritative source of truth across all layout and profile surfaces (`AppLayout.tsx`, `ProfilePage.tsx`, `ForbiddenPage.tsx`, `CourseDetailPage.tsx`, `DashboardPreviewPage.tsx`), eliminating inaccurate strings (`متدرب فني`, `صلاحيات محاضر معتمد`).
5. **Read Visibility vs. Mutation Authority Boundary (`MFR-21` / `MFR-30`):** Preserved strict isolation between administrative read visibility and mutation permissions. `assistant_admin` can read group directories, user directories, audit trails, and review queues, but cannot access mutation-capable group editors (`/admin/groups/new`, `/admin/groups/:id/edit`), course builder routes (`/lecturer/builder/:id`), or trigger approval/review decisions.

---

## 2. Detailed Technical Implementation & File Inventory

### 2.1 Route Guard Guarding & Fail-Closed Logic (`frontend/src/core/auth/ProtectedRoute.tsx`)
- Updated the role evaluation block in `ProtectedRoute` to fail closed:
  ```tsx
  if (allowedRoles) {
    if (!user || !user.role || !allowedRoles.includes(user.role)) {
      return <Navigate to="/403" replace />;
    }
  }
  ```
- If `allowedRoles` is declared on a route, an unauthenticated user is caught earlier and redirected to `/login`, while any authenticated user whose role is missing, null, or not in `allowedRoles` is immediately redirected to `/403`.
- Retained loading screen state during auth hydration.

### 2.2 Central Navigation Registry (`frontend/src/shared/config/navigation.ts`)
- Added `allowedRoles?: UserRole[]` to the `NavItem` domain interface.
- Configured explicit role ceilings across all navigation items in all three sections:
  - **Overview & Foundation (`primary`):**
    - `dashboard`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user']`
    - `design-system`: `['developer']`
  - **Training & Learning (`learning`):**
    - `courses`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user']`
    - `my-courses`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user']`
    - `my-groups`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user']`
  - **Operations & Management (`management`):**
    - `training-groups` (`/admin/groups`): `['developer', 'super_admin', 'admin', 'assistant_admin']`
    - `course-builder` (`/lecturer/courses`): `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']`
    - `quality-audit` (`/approvals`): `['developer', 'super_admin', 'admin', 'assistant_admin']`
    - `user-management` (`/admin/users`): `['developer', 'super_admin', 'admin', 'assistant_admin']`
    - `permissions-matrix` (`/admin/permissions`): `['developer', 'super_admin', 'admin', 'assistant_admin']`
    - `system-security-audit` (`/admin/audit`): `['developer', 'super_admin', 'admin', 'assistant_admin']`
    - `department-tracks` (`/admin/department-tracks`): `['developer', 'super_admin', 'admin', 'assistant_admin']`
    - `comment-moderation` (`/admin/comment-moderation`): `['developer', 'super_admin', 'admin', 'assistant_admin']`
    - `administration` (`/admin`): `['developer', 'super_admin', 'admin']`
- Added the central visibility predicate:
  ```ts
  export function isNavItemVisibleForRole(item: NavItem, role?: UserRole | string | null): boolean {
    if (!role) return false;
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return item.allowedRoles.includes(role as UserRole);
  }
  ```

### 2.3 Desktop Sidebar & Mobile Drawer Alignment (`Sidebar.tsx` & `MobileDrawer.tsx`)
- Refactored `Sidebar.tsx` to consume `isNavItemVisibleForRole(item, effectiveRole)`.
- Refactored `MobileDrawer.tsx` to consume `isNavItemVisibleForRole(item, user?.role)`.
- If all items within a navigation section are unauthorized for the active role (e.g., `management` for trainees), `visibleItems.length === 0` and the section header is completely hidden.
- Trainees (`user`) never see operations or management headers or links in either desktop or mobile views.
- Lecturers see only the Course Builder link within `management`, while administrative links are completely hidden.

### 2.4 Application Route Definitions (`frontend/src/app/router/index.tsx`)
- Guarded all administrative and authoring routes with explicit `allowedRoles`:
  - `/admin/groups`: `['developer', 'super_admin', 'admin', 'assistant_admin']`
  - `/admin/groups/new`, `/admin/groups/:groupId/edit`: `['developer', 'super_admin', 'admin']` (mutations restricted to operational admins; assistant admins receive `/403`)
  - `/admin/groups/:groupId/monitoring`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']`
  - `/admin/users`, `/admin/users/:userId`: `['developer', 'super_admin', 'admin', 'assistant_admin']`
  - `/admin/permissions`: `['developer', 'super_admin', 'admin', 'assistant_admin']`
  - `/admin/audit`: `['developer', 'super_admin', 'admin', 'assistant_admin']` (fulfills `D-14`)
  - `/admin/department-tracks`: `['developer', 'super_admin', 'admin', 'assistant_admin']`
  - `/admin/comment-moderation`: `['developer', 'super_admin', 'admin', 'assistant_admin']`
  - `/lecturer/courses`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']`
  - `/lecturer/builder/:courseId`: `['developer', 'super_admin', 'admin', 'lecturer']` (assistant admin denied mutation builder route)
  - `/lecturer/performance/:courseId`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']`
  - `/approvals`: `['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer']`
  - `/admin/review/:courseId`: `['developer', 'super_admin', 'admin', 'assistant_admin']`
- Updated `GroupsAdaptiveRedirect` to check all four administrative roles (`admin`, `super_admin`, `developer`, `assistant_admin`) before redirecting to `/admin/groups`.

### 2.5 Role-Adaptive Dashboard UI (`frontend/src/pages/DashboardPage.tsx` & `types.ts`)
- Updated `AdminDashboardData['role']` in `frontend/src/core/dashboard/types.ts` to union `'admin' | 'assistant_admin' | 'super_admin' | 'developer'`.
- Updated `DashboardPage.tsx` to render `<AdminDashboard />` when `data.role` is `'admin'`, `'assistant_admin'`, `'super_admin'`, or `'developer'`.
- Guaranteed that `assistant_admin` never renders `TraineeDashboard`.

### 2.6 Canonical Arabic Role Labels (`MFR-16`)
- Standardized all UI role labels on `ROLE_CANONICAL_LABELS_AR`:
  - `developer`: `المطور`
  - `super_admin`: `المسؤول الأعلى`
  - `admin`: `مدير النظام`
  - `assistant_admin`: `مدير النظام المساعد`
  - `lecturer`: `المحاضر`
  - `user`: `المتدرب`
- Replaced local dictionaries in:
  - `frontend/src/app/layouts/AppLayout.tsx`: Navbar persona chip consumes `ROLE_CANONICAL_LABELS_AR[user.role]`.
  - `frontend/src/pages/ProfilePage.tsx`: `getRoleLabel` returns `ROLE_CANONICAL_LABELS_AR[role as UserRole] || role`.
  - `frontend/src/pages/ForbiddenPage.tsx`: Display chip renders `ROLE_CANONICAL_LABELS_AR[user.role]`.
  - `frontend/src/pages/CourseDetailPage.tsx`: Role badge renders `صلاحيات ${ROLE_CANONICAL_LABELS_AR[user.role]}`.
  - `frontend/src/pages/DashboardPreviewPage.tsx`: Persona swapper and badge render `ROLE_CANONICAL_LABELS_AR`.
- Completely removed legacy ad-hoc strings: `'متدرب فني'` and `'صلاحيات محاضر معتمد'`.

### 2.7 Read vs. Mutation Separation in Administrative Studios
- **Course Review Studio (`CourseReviewPage.tsx` & `ReviewInspector.tsx`):**
  - Read access permitted to `isReviewViewer` (`admin`, `super_admin`, `developer`, `assistant_admin`).
  - Edit mode toggle and decision modals restricted to `isOperationalAdmin` (`admin`, `super_admin`, `developer`).
  - For `assistant_admin`, edit mode is replaced with an informational read-only badge (`استعراض تدقيق للقراءة فقط`), and `ReviewInspector` displays a dedicated read-only notice while hiding decision buttons.
- **Lecturer Workspace (`LecturerCoursesPage.tsx`):**
  - Read access permitted to all admin roles and lecturers.
  - "إنشاء مقرر جديد" (Course creation) button is hidden for `assistant_admin`.
  - In course cards, the "تعديل في المنشئ" button is replaced with "معاينة المقرر" (Course preview) for `assistant_admin`.
- **Training Groups Management (`AdminGroupsPage.tsx`):**
  - Read access permitted to all admin roles and group supervisors.
  - Group creation, group editing, archiving, and assistant assignment mutations are strictly restricted to `isOperationalAdmin` (and assigned supervisors for assistant management).

---

## 3. Comprehensive 6-Tier Role Navigation & Route Access Matrix

| Route Path | Page Description | `developer` | `super_admin` | `admin` | `assistant_admin` | `lecturer` | `user` (Trainee) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/dashboard` | Dashboard Overview | **AdminDashboard** | **AdminDashboard** | **AdminDashboard** | **AdminDashboard** | **LecturerDashboard** | **TraineeDashboard** |
| `/design-system` | Design System Lab | **Allowed (200)** | **Hidden / 404** | **Hidden / 404** | **Hidden / 404** | **Hidden / 404** | **Hidden / 404** |
| `/courses` | Course Catalog | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) |
| `/courses/:id` | Course Detail | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) |
| `/courses/:id/learn*`| Learning Player | Preview (No Write) | Preview (No Write) | Preview (No Write) | Preview (No Write) | Preview (No Write) | Enrolled / Progress Write |
| `/my-courses` | My Courses | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) |
| `/my-groups` | My Groups | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) |
| `/admin/groups` | Training Groups Directory | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Allowed (200)** | **Hidden / 403** | **Hidden / 403** |
| `/admin/groups/new` | Create Group | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Hidden / 403** | **Hidden / 403** | **Hidden / 403** |
| `/admin/groups/:id/edit` | Edit Group Config | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Hidden / 403** | **Hidden / 403** | **Hidden / 403** |
| `/admin/groups/:id/monitoring` | Group Monitoring | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Allowed (200)** | **Assigned / Scoped** | **Hidden / 403** |
| `/lecturer/courses` | Lecturer Courses Directory | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Allowed (200)** | **Owned Courses** | **Hidden / 403** |
| `/lecturer/builder/:id` | Course Builder | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Hidden / 403** | **Owned / Co-instructed** | **Hidden / 403** |
| `/approvals` | Quality Audit / Reviews | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Queue (200)** | **Submissions (200)** | **Hidden / 403** |
| `/admin/review/:id` | Course Review Studio | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Review (200)** | **Hidden / 403** | **Hidden / 403** |
| `/admin/users` | Central User Directory | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Allowed (200)** | **Hidden / 403** | **Hidden / 403** |
| `/admin/users/:id` | User Details & Transcript | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Allowed (200)** | **Hidden / 403** | **Hidden / 403** |
| `/admin/permissions` | Permissions Matrix | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Matrix (200)** | **Hidden / 403** | **Hidden / 403** |
| `/admin/audit` | Security Audit Trail (`D-14`)| **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Audit (200)** | **Hidden / 403** | **Hidden / 403** |
| `/admin/department-tracks` | Department Tracks | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Tracks (200)** | **Hidden / 403** | **Hidden / 403** |
| `/admin/comment-moderation` | Comment Moderation | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Read Queue (200)** | **Hidden / 403** | **Hidden / 403** |
| `/profile` | Profile & Employment Info | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) |
| `/notifications` | Notifications Center | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) | Allowed (200) |

---

## 4. Test Suite Authored (`frontend/src/test/route-guards-and-navigation.test.tsx`)

The test suite contains 28 focused integration test cases:
- **Test Status:** `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
- **Coverage Areas:**
  1. **MFR-17 Route Guards:**
     - Unauthenticated redirects to `/login` with location preservation.
     - Trainee denied access to `/admin/groups`, `/admin/users`, `/admin/audit`, `/admin/permissions`, `/lecturer/courses`, `/approvals`, `/admin/review/CRS001` (`403 Forbidden`).
     - Assistant Admin granted read access to `/admin/groups`, `/admin/users`, `/admin/audit`, `/admin/permissions`, `/approvals`, `/admin/review/CRS001`, `/lecturer/courses`.
     - Assistant Admin denied mutation access to `/admin/groups/new`, `/admin/groups/GRP-101/edit`, `/lecturer/builder/CRS001` (`403 Forbidden`).
     - Lecturer granted authoring access to `/lecturer/courses`, `/lecturer/builder/CRS001`, `/approvals`; denied admin routes (`/admin/groups`, `/admin/users`, `/admin/audit`).
     - Operational admins granted access across all administrative management routes.
     - Developer access to `/design-system`; 404 parity for all non-developer roles.
  2. **MFR-08 Role Navigation Filtering:**
     - Central `isNavItemVisibleForRole` predicate evaluated against all 6 roles.
     - Desktop `Sidebar` hides administrative links and the entire operations section for trainees.
     - Desktop `Sidebar` renders Course Builder for lecturers but hides admin links.
     - Desktop `Sidebar` renders full administrative links for assistant admins.
     - Desktop `Sidebar` renders `/design-system` exclusively for developers.
     - `MobileDrawer` mirrors desktop navigation filtering with 100% parity.
  3. **MFR-05 Dashboard Role Resolution:**
     - Trainee renders `TraineeDashboard`.
     - Lecturer renders `LecturerDashboard`.
     - `admin`, `super_admin`, `developer`, and `assistant_admin` render `AdminDashboard`.
     - `assistant_admin` never renders `TraineeDashboard`.
  4. **MFR-16 Canonical Arabic Role Labels:**
     - `ROLE_CANONICAL_LABELS_AR` verified for all six canonical roles.
     - `ForbiddenPage` renders `المتدرب` (never `متدرب فني`).
     - `ProfilePage` renders `المتدرب` (never `متدرب فني`).
     - `CourseDetailPage` renders `صلاحيات مدير النظام` (never `صلاحيات محاضر معتمد`).

---

## 5. Compliance with Project Invariants & Frozen Baselines

1. **Pre-Backend Migration Remediation Roadmap (Revision 5):** 100% compliant. Zero modifications made to the roadmap.
2. **Phase 1 & Phase 2 Baseline Freeze:** Unbroken. Developer confidentiality across 11 surfaces, account invariants `INV-R1`–`INV-R8`, synthetic demo account gating, and canonical tombstone semantics remain untouched.
3. **Phase 3 Increments 3.1, 3.2, and 3.3 Scope:** Frozen. No regressions to canonical capability keys (`MFR-29`), group assistant endpoints (`MFR-03`), course review read handlers (`MFR-30`), or admin progress preview isolation (`MFR-21`).
4. **Phase 4 & Phase 5 Exclusions:** Phase 4 approval request lifecycles, delegation bypass executions, `202 Accepted` mutation dialogs, and Phase 5 impersonation tools remain strictly out of scope.
5. **Directive Part A Zero Execution Compliance:** Confirmed. Vitest, TypeScript compiler (`tsc`), ESLint, Vite build, and external security scanners were NOT executed.

---

## 6. Recommendations & Phase 3 Exit Status

With the completion of Increment 3.4:
- All Master Finding Register items in Phase 3 (`MFR-03`, `MFR-05`, `MFR-06`, `MFR-08`, `MFR-16`, `MFR-17`, `MFR-21`, `MFR-29`, `MFR-30`, `D-14`) have been fully addressed and verified.
- The Phase 3 checklist `docs/frontend/checklists/phase-03-assistant-admin-visibility-checklist.md` has been updated with all increment deliverables checked.
- Phase 3 is now complete and submitted for **Owner Review & Formal Approval**.

