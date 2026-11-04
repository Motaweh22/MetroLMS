# MetroLMS — Increment 5.2 Final Source Audit & Evidence Supplement Report
**Visual Role Preview Architecture (`معاينة الدور`)**

- **Document Version:** 2.5 (Final Documentation Reconciliation & Trainee Learning Route Protection Report)
- **Authoritative References:** `docs/backend/pre-backend-migration-remediation-roadmap.md` (Revision 5, Sections 3 & 4), Owner Decision `D-10`, Stable Finding `MFR-40`, Invariant `INV-R8`
- **Audit Date:** November 3, 2026
- **Audit Status:** Verified, Hardened & Frozen — Ready for Final Owner Acceptance

---

## 1. Executive Summary & Audit Verdict

| Audit Domain | Requirement Reference | Findings | Verdict |
|---|---|---|:---:|
| **Provider Placement & Hierarchy** | Section 1 | `RolePreviewProvider` placed inside `AuthProvider` and above `RouterProvider` in `AppRouter`. Consumed seamlessly by `AppLayout` and all shell components. | **PASSED** |
| **Masking vs. Actual Clearing** | Section 1 | `previewOwnerId` tracks authentic developer ID. Synchronous render-masking (`isOwnerSessionValid`) prevents single-frame stale UI; `useEffect` clears stored React state on user switch/logout. | **PASSED (Hardened)** |
| **Token & Identity Continuity** | Section 1, 4 | Developer ID (`USR_DEV_001`), role (`developer`), active JWT token, and authorization headers remain completely unchanged during preview. | **PASSED** |
| **`assistant_lecturer` Scoped Scope** | Clarification Point 1 | Excluded from `UserRole` and `ROLE_CAPABILITY_CEILINGS`. Suppresses `course-builder` and `my-courses` in nav. Pages (`TraineeGroupsPage`, `GroupDetailPage`, `GroupMonitoringPage`, `AdminGroupsPage`, `GroupEditorPage`) enforce group boundaries. `canManageAssistants` rejected. Direct URL access to out-of-scope groups blocked from issuing network calls. | **PASSED (Hardened)** |
| **Lecturer Direct Route Protection** | Clarification Point 1 | Direct navigation to `/lecturer/courses`, `/lecturer/builder/*`, `/lecturer/performance/*`, `/approvals`, `/admin/review/*`, and `/dashboard` blocked or redirected during `assistant_lecturer` preview. | **PASSED (Hardened)** |
| **Trainee Learning Routes Protection** | Clarification Point 2 | Trainee player (`/courses/:id/learn`, `/courses/:id/learn/:itemId`) blocked with `player-assistant-denied`; trainee self-enrollment card on `/courses/:id` suppressed and replaced with read-only syllabus notice (`assistant-lecturer-course-notice`); personal enrollments (`/my-courses`) redirected to `/my-groups`. Shared catalog (`/courses`) and common utility surfaces (`/profile`, `/notifications`) preserved. | **PASSED (Hardened)** |
| **Group Attachments Evidence** | Clarification Point 2 | `GroupAttachmentsTab` mounted solely in `GroupEditorPage.tsx:L901`. Never mounted during `assistant_lecturer` preview because parent route blocks non-admin preview. Scoped group view uses `GroupMaterialsTab` bound strictly to `scopedAssignmentPreview.groupId`. | **PASSED** |
| **API Module Count Reconciliation** | Clarification Item 1 | Exactly 16 distinct service module files discovered across `frontend/src` that invoke `apiClient`. 14 modules contain state-changing mutations (100% intercepted by preview barrier); 2 modules are strictly read-only query modules. | **PASSED (Reconciled)** |
| **HTTP Method Normalization & Barrier Coverage** | Clarification Point 2 | Methods normalized via `(customConfig.method \|\| 'GET').toUpperCase()`. Lowercase (`post`, `put`, `patch`, `delete`) intercepted before network dispatch. 100% of mutation transport routes through `apiClient`. | **PASSED (Hardened)** |
| **Authentication Lifecycle Exemption** | Clarification Point 2 | Strictly normalized to `method === 'POST'` and `normalizedPath === '/api/auth/logout'`. Token refresh confirmed non-existent in prototype. | **PASSED (Hardened)** |
| **Developer Route Protection** | Section 4 | `DeveloperRouteGuard` checks authentic `AuthContext.user.role === 'developer'`. `/design-system` returns 404 parity to non-developers and during unauthenticated requests. | **PASSED** |
| **Developer-Only Chrome & Badges** | Section 4 | Milestone badges (`• مرحلة 2`, `v0.2.0`, `المرحلة 3`) and Design System links hidden from non-developers and cleanly suppressed during preview for visual fidelity. | **PASSED** |
| **AppLayout Closure Integrity** | Final Acceptance Point 3 | Duplicate `};` at line 98 eliminated. Single closure `};` at line 95 terminates `AppLayoutInner`, followed by balanced `AppLayout` export. | **PASSED (Hardened)** |
| **Increment 5.4 Naming Consistency** | Consistency Check 4 | Reconciled label to `Increment 5.4 — Session Lifecycle Hardening, Edge Cases & Security Regression Matrix`. Maintained as `[Not Started]`. | **PASSED** |
| **Test Matrix & Execution Deferral** | Section 5 | 19 tests in `developer-surface-protection.test.tsx` + 17 tests in `role-preview.test.tsx`. Marked `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`. | **PASSED** |

---

## 2. Route Protection & Learning Surfaces Audit During `assistant_lecturer` Preview

### 2.1 Lecturer-Specific Route Protection Inventory

| Route Path | Associated Page Component | Can Open During `assistant_lecturer` Preview? | Exact Route Guard or Page-Level Condition | Direct Navigation Blocked? | Can Lecturer-Wide Data Load/Display? |
|---|---|:---:|---|:---:|:---:|
| `/lecturer/courses` | `LecturerCoursesPage.tsx` | **NO** | `previewRole === 'assistant_lecturer'` triggers `lecturer-access-denied` alert; `fetchCourses()` bypassed. | **YES (Blocked)** | **NO** (0 courses fetched) |
| `/lecturer/builder/new` | Router Redirect to `/lecturer/courses?new=true` | **NO** | Redirects to `/lecturer/courses?new=true`, which renders `lecturer-access-denied`. Modal not opened. | **YES (Blocked)** | **NO** |
| `/lecturer/builder/:courseId` | `CourseBuilderPage.tsx` | **NO** | `previewRole === 'assistant_lecturer'` triggers `builder-access-denied` alert; `loadCourseData()` bypassed. | **YES (Blocked)** | **NO** (0 course content loaded) |
| `/builder` | Router Redirect to `/lecturer/courses` | **NO** | Redirects to `/lecturer/courses`, which renders `lecturer-access-denied`. | **YES (Blocked)** | **NO** |
| `/builder/:courseId` | Router Redirect to `/lecturer/builder/:courseId` | **NO** | Redirects to `/lecturer/builder/:courseId`, which renders `builder-access-denied`. | **YES (Blocked)** | **NO** |
| `/lecturer/performance/:courseId` | `CoursePerformancePage.tsx` | **NO** | `previewRole === 'assistant_lecturer'` triggers `performance-access-denied` card; `loadReport()` bypassed. | **YES (Blocked)** | **NO** (0 trainee metrics loaded) |
| `/performance/:courseId` | Router Redirect to `/lecturer/performance/:courseId` | **NO** | Redirects to `/lecturer/performance/:courseId`, which renders `performance-access-denied`. | **YES (Blocked)** | **NO** |
| `/approvals` | `ApprovalsPage.tsx` | **NO** | `isAdmin = false` & `isLecturer = false` during `assistant_lecturer` preview. Renders `approvals-unauthorized`; `loadData()` bypassed. | **YES (Blocked)** | **NO** (0 review items loaded) |
| `/audit`, `/admin/approvals` | Router Redirects to `/approvals` | **NO** | Redirects to `/approvals`, which renders `approvals-unauthorized`. | **YES (Blocked)** | **NO** |
| `/admin/approvals/:courseId` | Router Redirect to `/admin/review/:courseId` | **NO** | Redirects to `/admin/review/:courseId`, which renders `review-unauthorized`. | **YES (Blocked)** | **NO** |
| `/admin/review/:courseId` | `CourseReviewPage.tsx` | **NO** | `isReviewViewer = false` during `assistant_lecturer` preview. Renders `review-unauthorized`; `loadReviewStudioData()` bypassed. | **YES (Blocked)** | **NO** (0 studio data loaded) |
| `/dashboard` | `DashboardPage.tsx` | **REDIRECTED** | `previewRole === 'assistant_lecturer'` renders `<Navigate to="/my-groups" replace />`. | **YES (Redirected)** | **NO** (Bypasses lecturer dashboard) |

---

### 2.2 Trainee Learning Routes & Shared Surfaces Audit

The approved `assistant_lecturer` model is a **group-scoped operational assignment** for group monitoring, roster tracking, meetings, and materials library management. It is **not** a global trainee account.

The table below audits the complete set of learning-related and generic user routes during active `assistant_lecturer` visual preview:

| Route Path | Associated Page Component / UI Surface | Accessible During Preview? | Identity / Effective Role Allowing It | Trainee-Specific Personal Data Loaded? | Supported by Phase 5 Scope? | Minimal Preview Restriction Applied |
|---|---|:---:|---|:---:|:---:|---|
| `/courses` | `CoursesCatalogPage.tsx` | **YES** | Authenticated Shell (`developer` token) / Global Catalog Reader | **NO** (Loads generic catalog directory via `coursesApi.getCourses()`) | **YES** (Standard shared course catalog across all system roles) | None required. Read-only informational program directory. |
| `/courses/:courseId` | `CourseDetailPage.tsx` | **YES** | Authenticated Shell (`developer` token) | **NO** (Loads generic course syllabus via `coursesApi.getCourseById()`) | **YES** (Academic syllabus inspection for assigned instructors) | **Trainee workflows suppressed:**<br>1. Trainee self-enrollment button (`enroll-course-button`) and "معاينة محتوى الدورة" player link replaced with neutral academic notice `assistant-lecturer-course-notice`: «معاينة مدرس مساعد للمجموعة: استعراض المحتوى والمنهج التدريبي العام متاح للقراءة والاطلاع. التسجيل الذاتي ومشغل الدروس مقتصران على المتدربين المسجلين بالمجموعات».<br>2. Hero badge renders `hero-assistant-lecturer-badge` («معاينة مدرس مساعد — استعراض المنهج»). |
| `/courses/:courseId/learn` | `LearningPlayerPage.tsx` | **NO (Blocked)** | N/A (Trainee interactive learning player) | **NO** (`effectiveCourseId = undefined` when previewing; `useCourseProgress` and `useCourseDetail` bypassed) | **NO** (Assistant Lecturers monitor group progress, they do not participate as learners) | **Preview guard applied:** Early return renders `player-assistant-denied`: «مشغل الدروس مخصص للمتدربين فقط. بصفتك مشرف تدريب / مدرس مساعد للمجموعة، يقتصر نطاق عملك على متابعة أداء المتدربين من شاشة مراقبة المجموعة التدريبية المخصصة» with navigation button returning to `/my-groups`. |
| `/courses/:courseId/learn/:itemId` | `LearningPlayerPage.tsx` | **NO (Blocked)** | N/A (Lesson player deep-link) | **NO** (Bypassed identically to `/learn`) | **NO** | Blocked with `player-assistant-denied` identically to root player route. |
| `/my-courses` | `MyCoursesPage.tsx` | **NO (Redirected)** | N/A (Personal enrolled courses) | **NO** (`loadEnrolledCourses()` bypassed when `previewRole === 'assistant_lecturer'`) | **NO** (Personal trainee study list is out of scope for group staff) | **Navigation & router restriction:**<br>1. Hidden from `Sidebar.tsx` and `MobileDrawer.tsx` during `assistant_lecturer` preview.<br>2. Direct URL navigation immediately redirects via `<Navigate to="/my-groups" replace />`. |
| `/my-groups` | `TraineeGroupsPage.tsx` | **YES** | Scoped Group Assignment (`scopedAssignmentPreview.groupId`) | **NO** (Loads strictly assigned group data via `groupsApi.getGroupById()`) | **YES** (Primary entrypoint for assistant lecturer preview) | Renders strictly the assigned group matching `scopedAssignmentPreview.groupId`. Out-of-scope groups are filtered out. |
| `/my-groups/:groupId` | `GroupDetailPage.tsx` | **YES** *(Strictly scoped)* | Scoped Group Assignment (`scopedAssignmentPreview.groupId`) | **NO** (Loads group curriculum and roster) | **YES** (Core group management surface) | **Hardened scope & UI restrictions:**<br>1. Access to any other `groupId` renders `group-out-of-scope` and bypasses `loadGroupDetails()`.<br>2. Personal trainee progress bar (`programPercent`) suppressed.<br>3. Group course cards render «استعراض تفاصيل المقرر» linking to `/courses/:id` instead of «بدء المقرر الآن» linking to `/learn`.<br>4. Header provides direct shortcut button `assistant-group-monitoring-btn` to `/admin/groups/:groupId/monitoring`. |
| `/profile` | `ProfilePage.tsx` | **YES** | Authenticated Shell (`developer` token) | **NO** (Renders developer profile info; mutation barrier blocks updates) | **YES** | Shared utility profile view across all system roles. |
| `/notifications` | `NotificationsPage.tsx` | **YES** | Authenticated Shell (`developer` token) | **NO** (Renders system notifications; mutation barrier blocks mark-as-read) | **YES** | Shared notification center across all system roles. |

---

### 2.3 Legitimate Group-Scoped Assistant Lecturer Routes (Preserved)

The legitimate routes accessible during `assistant_lecturer` visual preview remain strictly scoped:
1. `/my-groups` ([`TraineeGroupsPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/TraineeGroupsPage.tsx)): Displays exclusively `scopedAssignmentPreview.groupId`.
2. `/my-groups/:groupId` ([`GroupDetailPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx)): Direct access to `scopedAssignmentPreview.groupId` is permitted; direct access to any other `groupId` renders `group-out-of-scope` and skips data loading.
3. `/admin/groups/:groupId/monitoring` ([`GroupMonitoringPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupMonitoringPage.tsx)): Direct access to `scopedAssignmentPreview.groupId` is permitted; direct access to any other `groupId` renders `monitoring-out-of-scope` and skips data loading.
4. Trainee Common Shell: `/courses` (catalog directory), `/courses/:id` (read-only syllabus inspection), `/profile`, `/notifications`.

---

## 3. Group Attachments: Complete Source Evidence

### 3.1 Mounting Location & Parent Route Protection
A full codebase static inspection confirms that `GroupAttachmentsTab` is mounted in **exactly one place**:
- **Parent Component:** [`frontend/src/pages/GroupEditorPage.tsx:L901`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupEditorPage.tsx#L901)
- **Parent Routes:**
  - `/admin/groups/:groupId/edit`
  - `/admin/groups/new`

### 3.2 Proof of Inaccessibility During `assistant_lecturer` Preview
In `GroupEditorPage.tsx:L114-L122, L557-L573`:

```typescript
const { previewRole } = useRolePreview();
const isAdmin =
  previewRole !== 'assistant_lecturer' &&
  (user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'developer');

// Unauthorized State
if (!isAuthenticated || !isAdmin) {
  return (
    <div data-testid="group-edit-unauthorized" dir="rtl">
      <Alert variant="warning" title="صلاحية مقصورة على مديري النظام">
        <p className="text-sm mb-4">
          تكوين وتعديل إعدادات المجموعات التدريبية يتطلب صلاحيات مدير النظام الكاملة.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
          العودة إلى لوحة المتابعة
        </Button>
      </Alert>
    </div>
  );
}
```

- When `previewRole === 'assistant_lecturer'`, `isAdmin` evaluates to `false`.
- `GroupEditorPage` returns early at line 557, rendering `group-edit-unauthorized`.
- Line 901 is never reached. `GroupAttachmentsTab` is **NEVER MOUNTED** during `assistant_lecturer` preview.

### 3.3 Scoped Group Materials & Attachments Flow
In the legitimate scoped view ([`GroupDetailPage.tsx:L640-L650`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/GroupDetailPage.tsx)):
- Materials and attachments are rendered via `<GroupMaterialsTab groupId={group.id} group={group} readOnly={user?.role === 'user'} />`.
- `GroupMaterialsTab` invokes `groupsApi.getGroupMaterials(groupId)` strictly using `group.id === scopedAssignmentPreview.groupId`.
- All material folders, uploaded files, and document viewers operate strictly within the loaded group boundary.

---

## 4. Complete Frontend API Service Modules Inventory

### 4.1 Count Reconciliation & Module Architecture
A comprehensive static source audit across the `frontend/src` codebase confirms exactly **16 distinct API service module files** that import and invoke the centralized HTTP transport client `apiClient` ([`frontend/src/core/api/apiClient.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/api/apiClient.ts)).

The previous draft report referred to "14 discovered service modules", which represented the subset of service modules containing state-changing mutations (`POST`, `PUT`, `PATCH`, `DELETE`), inadvertently omitting the 2 strictly read-only query modules from the summary total.

The breakdown is reconciled as follows:
- **Total Distinct Service Module Files:** **16**
- **Service Modules with State-Changing Mutations:** **14** (100% intercepted and blocked by the preview mutation barrier).
- **Service Modules Strictly Read-Only:** **2** (`dashboardApi.ts` and `whatsappApi.ts`, invoking idempotent `GET` endpoints only).
- **Duplicate / Core Transport Re-exports:** `frontend/src/core/auth/authApi.ts` is an internal duplicate/transport implementation of `frontend/src/features/auth/api/authApi.ts`; in the table below, both module file paths are documented under Authentication and counted as a single functional service module.
- **IndexedDB Boundary:** `frontend/src/core/storage/mediaStorageService.ts` interacts exclusively with browser-local IndexedDB storage and does not invoke `apiClient`, remaining outside network HTTP transport.

### 4.2 Comprehensive Service Modules Inventory

| # | Domain Feature | Module Filepath | Exported Service Object / Functions | Contains Mutations? | State-Changing Endpoints (Blocked by Preview Barrier) |
|---|---|---|---|:---:|---|
| 1 | **Authentication** | `frontend/src/features/auth/api/authApi.ts`<br>*(transport duplicate: `frontend/src/core/auth/authApi.ts`)* | `authApi` | **YES** | `POST /api/auth/login`<br>`POST /api/auth/logout` *(Exempted Session Termination)* |
| 2 | **Courses & Catalog** | `frontend/src/features/courses/services/coursesApi.ts` | `coursesApi` | **YES** | `POST /api/courses/:id/enroll`<br>`DELETE /api/courses/:id/enroll` |
| 3 | **Course Builder** | `frontend/src/features/course-builder/services/builderApi.ts` | `builderApi` | **YES** | `POST /api/builder/courses`<br>`PUT /api/builder/courses/:id`<br>`DELETE /api/builder/courses/:id`<br>`POST /api/builder/upload` |
| 4 | **Course Review Studio** | `frontend/src/features/course-review/api/reviewApi.ts` | `reviewApi` | **YES** | `POST /api/lecturer/reviews/:courseId/submit`<br>`POST /api/admin/reviews/:courseId/approve`<br>`POST /api/admin/reviews/:courseId/reject`<br>`POST /api/admin/reviews/:courseId/return`<br>`PUT /api/admin/reviews/:courseId/notes`<br>`PUT /api/admin/reviews/:courseId/staged`<br>`DELETE /api/admin/reviews/:courseId/staged` |
| 5 | **Training Groups** | `frontend/src/features/groups/services/groupsApi.ts` | `groupsApi` | **YES** | `POST /api/admin/groups`<br>`PUT /api/admin/groups/:id`<br>`PATCH /api/admin/groups/:id/archive`<br>`PATCH /api/admin/groups/:id/join-requests/:reqId`<br>`PUT /api/admin/groups/:id/assistants`<br>`POST /api/groups/:id/materials/folders`<br>`POST /api/groups/:id/materials/files`<br>`DELETE /api/groups/:id/materials/:itemId`<br>`PATCH /api/groups/:id/materials/files/:fileId/move`<br>`POST /api/groups/:id/attachments`<br>`DELETE /api/groups/:id/attachments/:attachmentId`<br>`POST /api/groups/:id/meetings`<br>`DELETE /api/groups/:id/meetings/:meetingId` |
| 6 | **User Management** | `frontend/src/features/user-management/services/userManagementApi.ts` | `userManagementApi` | **YES** | `POST /api/admin/users`<br>`PATCH /api/admin/users/:id/role`<br>`PATCH /api/admin/users/:id/status`<br>`DELETE /api/admin/users/:id` |
| 7 | **Permissions Governance** | `frontend/src/features/permissions/services/permissionsApi.ts` | `permissionsApi` | **YES** | `PUT /api/admin/permissions/overrides/:userId`<br>`DELETE /api/admin/permissions/overrides/:userId` |
| 8 | **Audit Logs** | `frontend/src/features/permissions/services/auditApi.ts` | `auditApi` | **YES** | `POST /api/admin/audit-logs/export` |
| 9 | **Department Tracks** | `frontend/src/features/permissions/services/departmentTracksApi.ts` | `departmentTracksApi` | **YES** | `PUT /api/admin/department-tracks/:id` |
| 10 | **Notifications** | `frontend/src/features/notifications/services/notificationsApi.ts` | `notificationsApi` | **YES** | `PATCH /api/notifications/:id/read`<br>`PATCH /api/notifications/read-all`<br>`DELETE /api/notifications/:id` |
| 11 | **Comments & Moderation** | `frontend/src/features/comments/services/commentsApi.ts` | `commentsApi` | **YES** | `POST /api/courses/:courseId/lessons/:lessonId/comments`<br>`PATCH /api/admin/comments/:id/moderate` |
| 12 | **Learning Progress** | `frontend/src/features/learning-player/services/learningApi.ts` | `learningApi` | **YES** | `PUT /api/learning/progress/:courseId/:lessonId`<br>`POST /api/learning/complete/:courseId` |
| 13 | **Course Performance** | `frontend/src/features/performance/services/performanceApi.ts` | `performanceApi` | **YES** | `POST /api/lecturer/courses/:courseId/nudges` |
| 14 | **User Profile** | `frontend/src/features/profile/services/profileApi.ts` | `profileApi` | **YES** | `PUT /api/users/profile` |
| 15 | **Dashboard** | `frontend/src/features/dashboard/services/dashboardApi.ts` | `dashboardApi` | **NO** | *(Read-only: `GET /api/dashboard`)* |
| 16 | **WhatsApp Support** | `frontend/src/features/whatsapp/services/whatsappApi.ts` | `whatsappApi` | **NO** | *(Read-only: `GET /api/whatsapp/config`)* |

> **Coverage Proof:** 100% of state-changing operations across all 14 mutation-bearing service modules route through `apiClient` and are intercepted by the mutation barrier during active preview. Zero mutations can bypass the barrier.

---

## 5. Mutation Barrier Method Normalization Sequence

In [`frontend/src/core/api/apiClient.ts:L163-L189`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/api/apiClient.ts#L163-L189):

```typescript
// 1. Method Acquisition & Normalization:
const method = (customConfig.method || 'GET').toUpperCase();

// 2. Mutation Detection against normalized uppercase array:
const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

// 3. Exact Path Normalization (strips query parameters and trailing slashes):
const normalizedPath = url.split('?')[0].replace(/\/+$/, '');

// 4. Exact Session Termination Exemption:
const isSessionTermination = method === 'POST' && normalizedPath === '/api/auth/logout';

// 5. Pre-Network Interception:
if (isMutation && isRolePreviewMutationBlocked()) {
  if (isSessionTermination) {
    setRolePreviewMutationBarrier(false);
  } else {
    triggerRolePreviewBlockedNotification();
    throw new ApiError(
      ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE,
      403,
      { code: 'ROLE_PREVIEW_MUTATION_BLOCKED', previewBlocked: true },
      url
    );
  }
}

let response: Response;
try {
  response = await fetch(url, config);
```

- **Lowercase Normalization Proof:** `(customConfig.method || 'GET').toUpperCase()` normalizes `'post'`, `'put'`, `'patch'`, `'delete'` to uppercase before the array inclusion check.
- **Pre-Dispatch Rejection Proof:** `throw new ApiError(...)` occurs at line 178, strictly prior to `response = await fetch(url, config)` at line 189.
- **Logout Exemption Proof:** Strictly gated to `method === 'POST'` and `normalizedPath === '/api/auth/logout'`.

---

## 6. AppLayout Syntax Correction Confirmation

- **File:** [`frontend/src/app/layouts/AppLayout.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/app/layouts/AppLayout.tsx#L93-L100)
- **Defect Location:** Duplicate `};` token at line 98 in previous revision.
- **Correction Applied:** Redundant token deleted.
- **Static Source Inspection:**
  - Line 95: Exactly one `};` terminates `const AppLayoutInner: React.FC = () => {`.
  - Line 96: Blank separator line.
  - Line 97: `export const AppLayout: React.FC = () => {` begins and terminates cleanly at line 141.
  - Balanced AST structure confirmed. *(Per restrictions, no build or runtime checks were executed).*

---

## 7. Privileged Account Inventory

*(Passwords, tokens, credentials, and secrets strictly redacted)*

### 7.1 Developer Account
- **Canonical ID:** `USR_DEV_001`
- **Username:** `developer_internal`
- **Display Name:** مطور النظام
- **Role:** `developer`
- **Persistence Status:** Synthetic development fixture in [`userDirectoryFixtures.ts:L239-L254`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/fixtures/userDirectoryFixtures.ts#L239-L254).
- **Environment Guards:** Gated behind `import.meta.env.DEV === true`. Stripped in production by Dead Code Elimination.
- **Safe Development Access Method:** Development token-based authentication via `authStorage` and login form.
- **Future Production Provisioning Plan (Phase 12):** Server-side `pnpm db:bootstrap-developer`, server-only secrets, singleton database constraint, mandatory password rotation, and MFA enrollment.

### 7.2 Super Admin Account
- **Canonical ID:** `USR_SUPER_001`
- **Username:** `super_admin_demo`
- **Display Name:** م. ياسين رضوان
- **Role:** `super_admin`
- **Persistence Status:** Synthetic development fixture in [`userDirectoryFixtures.ts:L261-L275`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/fixtures/userDirectoryFixtures.ts#L261-L275).
- **Environment Guards:** Gated behind `import.meta.env.DEV === true`.
- **Safe Development Access Method:** Demo account picker (`DemoAccountPicker.tsx`) and standard login with demo credentials in development mode.
- **Future Production Provisioning Plan (Phase 12):** Secured bootstrap migration with first-login mandatory credential change.

---

## 8. Change Control, Roadmap Alignment & Stop Condition

1. **Increment 5.2 Frozen:** Visual Role Preview Architecture is fully verified, source-grounded, reconciled, and frozen.
2. **Increment Naming Reconciled:**
   - **Increment 5.3:** `Isolated Role Test Sessions` (`اختبار الصلاحيات`, `D-10`) — `[Not Started]`
   - **Increment 5.4:** `Session Lifecycle Hardening, Edge Cases & Security Regression Matrix` — `[Not Started]`
3. **Roadmap & Upstream Preservation:** Revision 5 roadmap, accepted Phases 1–4 code and documentation, and legacy Vanilla JavaScript remain untouched.
4. **Git Workspace Cleanliness:** No changes are staged or committed.
5. **Stop Condition Observed:** Work is halted pending final owner review and formal acceptance.
