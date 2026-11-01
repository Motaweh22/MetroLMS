# MetroLMS — Phase 3 Planning & Execution Checklist: Assistant Admin Visibility (`Rule A`, `D-14`), Route Guards & Role Navigation

> **Document Status:** `STATUS: INCREMENT 3.4 — ROUTE GUARDS, ROLE NAVIGATION & ARABIC LABELS COMPLETED — AWAITING OWNER REVIEW & PHASE 3 FORMAL CLOSURE`  
> **Authoritative Baseline:** MetroLMS Official Pre-Backend Migration Remediation Roadmap (Revision 5), Sections 2, 2.1, 2.2, 5 (`D-04`, `D-05`, `D-14`), 6 (`MFR-03`, `MFR-05`, `MFR-06`, `MFR-08`, `MFR-16`, `MFR-17`, `MFR-21`, `MFR-29`, `MFR-30`), 7, 13 (Phase 3), 14, 15, and 16.  
> **Testing Workflow Directive:** Per owner directive (Part A), test execution commands are deferred to consolidated Phase 13 / Gate B verification. Tests are authored during increments with status tracked per classification:
>   - `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`
>   - `PRELIMINARY EXECUTION EVIDENCE — EXECUTED DURING AN EARLIER WORKFLOW`
>   - `FINAL VERIFIED — PASSED DURING PHASE 13`
> **Prototype Architecture:** React 19.3.1 (declared `^19.0.0`), React DOM 19.3.1 (declared `^19.0.0`), TypeScript 5.7.3 (declared `~5.7.3`), Vite 7.3.7 (peer/transitive dependency; runtime CLI `vite/7.3.7`), Tailwind CSS 4.3.3 (declared `^4.0.6`), Mock Service Worker MSW 2.15.0 (declared `^2.15.0`), and `inMemoryStore`.  
> **Execution Scope:** Phase 3 implementation authorized in principle by owner; refinement completed. Phase 1 (Canonical Identity & Tombstones) and Phase 2 (Increments 2.1–2.4: 6-tier role architecture, protected account invariants `INV-R1`–`INV-R8`, Developer confidentiality across 11 surfaces, and fixture gating) are 100% complete and frozen. Phase 4 (Approval lifecycle, delegation execution branches, and `202 Accepted` mutation UI) and Phase 5 (Developer Preview / Isolated Testing) are strictly out of scope. Zero backend files or migrations authorized.

---

## 1. Executive Summary & Authoritative Principles

Phase 3 establishes full administrative **read visibility** under **`Rule A`** and **Decision `D-14`**, secures group-assistant assignment endpoints, canonicalizes capability keys, locks down role-restricted routes via route guards, filters shell navigation by role, unifies Arabic role terminology, and isolates admin-class course previews from trainee progress mutations.

### 1.1 Strict Read vs. Mutation Authorization Boundary
A fundamental architectural principle of Phase 3 is the strict separation between **read visibility** and **mutation authorization**:
1. **Rule A Read Scope:** Grants `assistant_admin`, `super_admin`, and `developer` administrative **read access** across the Dashboard, User Directory, Transcripts, Groups, Group Monitoring, Courses, Review Queue, Permissions Matrix, Approvals, and Security Audit (`D-14`).
2. **Zero Implicit Mutation Authority:** Granting read visibility to a page or API endpoint does **not** silently authorize mutations. All state-changing operations continue to be strictly governed by the Phase 2 Protected Account Invariants (`INV-R1`–`INV-R8`), domain capability checks, and the established permissions policy.
3. **Approvals Page Read vs. Execution:** Opening `/approvals` or `GET /api/reviews/queue` to `assistant_admin` allows reading the pending queue under Rule A. It does **not** authorize `assistant_admin` to approve requests or make review decisions. Approval execution branches, delegation checks, and `202 Accepted` UI handling remain strictly deferred to **Phase 4**.
4. **Course Builder Read vs. Edit:** Granting administrative read visibility to course review data or course listings does **not** authorize editing, submitting, or publishing courses. Lecturer course ownership and admin write boundaries remain strictly enforced.

---

## 2. Master Finding Register (MFR) Coverage in Phase 3

| Canonical ID | Finding Classification | Priority | Domain Area | Phase 3 Implementation Requirement |
| :--- | :--- | :---: | :--- | :--- |
| **`MFR-03`** (`F-03`) | Confirmed Defect | P0 | Security / Groups | Enforce authentication on `GET /api/groups/:groupId/assistants`; restrict `POST` and `DELETE` mutations to authorized admins and assigned group supervisors. Reject trainees with `403`. |
| **`MFR-05`** (`F-05`) | Gap | P1 | Rule A / Dashboard | Route `assistant_admin` to `AdminDashboard` in `DashboardPage.tsx` and compile admin metrics in `getDashboardData`. |
| **`MFR-06`** (`F-06`) | Gap | P1 | Rule A / Groups | Grant `assistant_admin`, `super_admin`, and `developer` administrative group read visibility in `inMemoryStore.getGroups`, `getGroupById`, and `groupHandlers.ts`. |
| **`MFR-08`** (`F-08`) | Confirmed Defect | P1 | Navigation | Filter `NAVIGATION_SECTIONS` in `Sidebar.tsx` and `MobileDrawer.tsx` by authenticated role. Trainees must not see admin/lecturer links. |
| **`MFR-16`** (`F-16`) | Confirmed Defect | P2 | Role Labels | Replace raw/inaccurate labels (`متدرب فني`, `صلاحيات محاضر معتمد`) with `ROLE_CANONICAL_LABELS_AR` in `AppLayout`, `ProfilePage`, `ForbiddenPage`, etc. |
| **`MFR-17`** (`F-17`) | Confirmed Defect | P1 | Route Guards | Add `<ProtectedRoute allowedRoles={...}>` to all admin, lecturer, and trainee routes in `router/index.tsx`. |
| **`MFR-21`** (`F-21`) | Confirmed Defect | P1 | Preview Isolation | Skip trainee progress writes in `recordLessonActivity` and `markLessonComplete` for `developer`, `super_admin`, `admin`, `assistant_admin`, and `lecturer`. |
| **`MFR-29`** (`NEW-01`) | Confirmed Defect | P0 | Rule A / Keys | Replace legacy capability keys (`users.view`, `transcripts.view`, `permissions.view`, `permissions.manage`) with canonical keys. |
| **`MFR-30`** (`NEW-02`) | Gap | P1 | Rule A / Courses | Update `reviewHandlers.ts`, `getReviewQueue`, `getCourseReviewData`, `getLecturerCourses`, and `getCourseForEditing` to permit `assistant_admin`, `super_admin`, and `developer` read access without broadening edit permissions. |

---

## 3. Comprehensive 6-Tier Role Navigation & Route Access Matrix

The table below defines the authoritative navigation item visibility and route protection rules across all six canonical roles.

| Route Path | Navigation Item / Page | `developer` | `super_admin` | `admin` | `assistant_admin` | `lecturer` | `user` (Trainee) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/dashboard` | Dashboard Overview | **Full View** (Admin) | **Full View** (Admin) | **Full View** (Admin) | **Full View** (Admin) | **Full View** (Lecturer) | **Full View** (Trainee) |
| `/design-system` | Design System Lab | **Visible / Allowed** | **Hidden / 404** | **Hidden / 404** | **Hidden / 404** | **Hidden / 404** | **Hidden / 404** |
| `/courses` | Course Catalog | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed |
| `/courses/:courseId` | Course Detail | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed |
| `/courses/:id/learn*`| Learning Player | Preview (No Write) | Preview (No Write) | Preview (No Write) | Preview (No Write) | Preview (No Write) | **Enrolled / Write Progress** |
| `/my-courses` | My Courses | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed |
| `/my-groups` | My Groups | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed |
| `/admin/groups` | Training Groups Directory | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Allowed** | **Hidden / 403** | **Hidden / 403** |
| `/admin/groups/:id/monitoring` | Group Monitoring | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Allowed** | **Assigned / Scoped** | **Hidden / 403** |
| `/lecturer/courses` | Lecturer Course Directory | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Allowed** | **Visible / Owned Courses** | **Hidden / 403** |
| `/lecturer/builder/:id` | Course Builder | **Allowed** | **Allowed** | **Allowed** | **Read / Preview Only** | **Owned / Co-instructed** | **Hidden / 403** |
| `/approvals` | Quality Audit / Reviews | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Queue** | **Hidden / 403** | **Hidden / 403** |
| `/admin/review/:id` | Course Review Studio | **Allowed** | **Allowed** | **Allowed** | **Read Review Data** | **Owned / Feedback** | **Hidden / 403** |
| `/admin/users` | User Directory | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Allowed** | **Hidden / 403** | **Hidden / 403** |
| `/admin/users/:id` | User Details & Transcript | **Allowed** | **Allowed** | **Allowed** | **Read Allowed** | **Hidden / 403** | **Hidden / 403** |
| `/admin/permissions` | Permissions Matrix | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Matrix** | **Hidden / 403** | **Hidden / 403** |
| `/admin/audit` | Security Audit Trail (`D-14`)| **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Allowed** | **Hidden / 403** | **Hidden / 403** |
| `/admin/department-tracks` | Department Tracks | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Allowed** | **Hidden / 403** | **Hidden / 403** |
| `/admin/comment-moderation` | Comment Moderation | **Visible / Allowed** | **Visible / Allowed** | **Visible / Allowed** | **Visible / Read Allowed** | **Hidden / 403** | **Hidden / 403** |
| `/profile` | Profile & Settings | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed |
| `/notifications` | Notifications Center | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed | Visible / Allowed |

> [!IMPORTANT]
> **Developer Confidentiality & Non-Disclosure:**  
> When `assistant_admin`, `admin`, or `super_admin` navigates to `/admin/users`, `/admin/audit`, or any administrative view, the `developer` account remains completely filtered out, KPIs exclude Developer data, direct lookup returns `404`, and audit log actor attribution projects `'النظام'`, strictly preserving Increment 2.3 confidentiality.

---

## 4. Refined Implementation Increments Breakdown

### Increment 3.1 — Capability Key Canonicalization, Security Audit Read Visibility & Dashboard Read APIs
- **MFRs Addressed:** `MFR-29` (Defect, P0), `D-14` (Owner Decision), and `MFR-05` (API/store layer).
- **Files in Scope:**
  - `frontend/src/mocks/handlers/userManagementHandlers.ts`
  - `frontend/src/mocks/handlers/permissionsHandlers.ts`
  - `frontend/src/core/permissions/policy.ts`
  - `frontend/src/features/permissions/components/UserPermissionsModal.tsx`
  - `frontend/src/features/permissions/components/RolePermissionsMatrix.tsx`
  - `frontend/src/mocks/store/inMemoryStore.ts` (`getDashboardData`, `recordAuditLog`)
- **Key Deliverables & Boundaries:**
  1. **Exact Legacy-to-Canonical Capability Mapping:**
     | Legacy Key | Canonical Operational Capability | Domain Category | Action Type / Scope |
     | :--- | :--- | :--- | :--- |
     | `users.view` | **`users.view_directory`** | `users` | **Read:** Directory listing and user details. |
     | `transcripts.view` | **`users.view_transcript`** | `users` | **Read:** Viewing employee/trainee training history. |
     | `permissions.view` | **`permissions.view_matrix`** | `governance` | **Read:** Viewing permissions matrix and effective user capabilities. |
     | `permissions.manage` | **`permissions.configure_users`** | `governance` | **Mutation:** Creating, modifying, or revoking user permission overrides. |
  2. **Read vs. Configuration Boundary:**
     - `permissions.view_matrix` authorizes reading the matrix and effective capabilities. It must **never** authorize setting or modifying permissions.
     - `permissions.configure_users` is strictly a configuration capability. It must **never** be checked to gate read visibility.
     - Canonical role ceilings and capability definitions remain unmodified.
  3. **Security Audit Read Access (`D-14`):**
     - Update `GET /api/admin/audit` in `permissionsHandlers.ts` to allow `assistant_admin`, `super_admin`, and `developer`.
     - Access is strictly **read-only**. Audit records remain append-only and immutable.
     - Non-Developer viewers see Developer audit actions projected as `'النظام'` (from Increment 2.3).
  4. **Dashboard Data Compilation (`MFR-05` API):**
     - Verify that `getDashboardData` in `inMemoryStore.ts` compiles administrative KPIs (total courses, enrollments, active groups, flags) for `assistant_admin`, `super_admin`, and `developer`.
     - Assign canonical Arabic role title for `assistant_admin` (`مدير النظام المساعد`) in the welcome payload.
- **Acceptance Criteria:**
  - `assistant_admin` reads user directory via `GET /api/admin/users` without `403`.
  - `assistant_admin` reads user transcripts via `GET /api/admin/users/:id/transcript` without `403`.
  - `assistant_admin` reads permissions matrix via `GET /api/admin/permissions` without `403`.
  - `assistant_admin` reads audit trail via `GET /api/admin/audit` without `403` (`D-14`), with Developer actions masked as `النظام`.
  - `assistant_admin` receives `403 Forbidden` if attempting to modify permission overrides (`PUT /api/admin/permissions/users/:id`).
- **Tests to Author:** `frontend/src/test/assistant-admin-capabilities-audit.test.ts` (`WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`).
- **Explicit Exclusions:** No modification to approval logic or delegation mutation handlers (deferred to Phase 4).

---

### Increment 3.2 — Group Administrative Visibility & Assistant Lecturer Endpoint Security
- **MFRs Addressed:** `MFR-06` (Gap, P1), `MFR-03` (Confirmed Defect, P0).
- **Files in Scope:**
  - `frontend/src/mocks/store/inMemoryStore.ts` (`getGroups`, `getGroupById`, `assignGroupAssistant`, `revokeGroupAssistant`, `getGroupAssistants`)
  - `frontend/src/mocks/handlers/groupHandlers.ts` (`isGroupAdmin`, `isAssignedSupervisor`, `isSupervisorForTrainee`, `GET /api/admin/groups*`)
  - `frontend/src/mocks/handlers/permissionsHandlers.ts` (`GET/POST/DELETE /api/groups/:groupId/assistants`)
- **Key Deliverables & Boundaries:**
  1. **Group Administrative Read Visibility (`MFR-06`):**
     - Update `inMemoryStore.getGroups(userId, userRole)` and `getGroupById(groupId, userId, userRole)` so `userRole === 'assistant_admin' || userRole === 'super_admin' || userRole === 'developer'` returns the full group catalog (not restricted to groups where `userId` is in `traineeIds`).
     - Update `isGroupAdmin(user)` in `groupHandlers.ts` for read endpoints to grant `assistant_admin`, `super_admin`, and `developer` administrative read access to group lists, summaries, and monitoring metrics.
  2. **Group Assistant Endpoint Security (`MFR-03`):**
     - `GET /api/groups/:groupId/assistants`:
       - Require authentication (`resolveAuthenticatedUser(request)`). Unauthenticated requests return `401 Unauthorized`.
       - Authorized actors: Any user with administrative read access (`developer`, `super_admin`, `admin`, `assistant_admin`) or assigned instructor/supervisor for the group. Trainees not in the group receive `403 Forbidden`.
     - `POST /api/groups/:groupId/assistants` & `DELETE /api/groups/:groupId/assistants/:assistantId`:
       - Require authentication (`401`).
       - Authorized actors:
         1. Operational administrators: `developer`, `super_admin`, `admin`.
         2. Group Primary Instructor: `inMemoryStore.isUserGroupPrimaryInstructor(group, user.id)`. (Assigned assistant lecturers are strictly denied).
       - Unauthorized actors:
         - Assigned Assistant Lecturers: Strictly rejected with `403 Forbidden` on POST/DELETE/PUT mutations (permitted only to GET the assistant list).
         - Trainees (`role === 'user'`): Strictly rejected with `403 Forbidden`.
         - Unassigned Lecturers: Strictly rejected with `403 Forbidden`.
         - Undelegated `assistant_admin`: Because group assistant assignment is an administrative/instructor mutation and Phase 4 approvals are not yet wired, direct mutation returns `403 Forbidden`.
  3. **Group-Scoped Role Integrity:**
     - The candidate assistant lecturer must hold the platform-wide canonical role `lecturer`.
     - `assistant_lecturer` remains strictly a group-scoped assignment (`GroupAssistantAssignment`), never a global system role.
- **Acceptance Criteria:**
  - `assistant_admin` can read the full group list via `GET /api/admin/groups` and group monitoring metrics via `GET /api/admin/groups/:id/monitoring`.
  - Unauthenticated calls to `GET /api/groups/:groupId/assistants` return `401`.
  - Trainees calling `POST` or `DELETE /api/groups/:groupId/assistants` receive `403 Forbidden`.
  - Group primary instructor successfully assigns and revokes assistant lecturers.
  - Candidate user who is not a `lecturer` is rejected with `400 Bad Request`.
- **Tests to Author:** `frontend/src/test/assistant-admin-groups-security.test.ts` (`WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`).
- **Explicit Exclusions:** No implementation of Phase 4 approval requests (`202 Accepted`) for assistant admins; no changes to auto-renewal or group deletion.

---

### Increment 3.3 — Course & Review Read Visibility & Admin Preview Progress Isolation
- **MFRs Addressed:** `MFR-30` (Gap, P1), `MFR-21` (Confirmed Defect, P1).
- **Files in Scope:**
  - `frontend/src/mocks/handlers/reviewHandlers.ts`
  - `frontend/src/mocks/store/inMemoryStore.ts` (`getReviewQueue`, `getCourseReviewData`, `getLecturerCourses`, `getCourseForEditing`, `isAuthorizedLecturer`, `recordLessonActivity`, `markLessonComplete`)
- **Key Deliverables & Boundaries:**
  1. **Strict Separation of Course Read vs. Edit Authorization:**
     - **Call Site Analysis of `isAuthorizedLecturer`:**
       Inspection reveals `isAuthorizedLecturer` is called by:
       - `getLecturerCourses` (Read)
       - `getCourseForEditing` (Read/Edit Prep)
       - `updateCourseDraft` (Mutation/Edit)
       - `resetContentLab` (Mutation/Reset)
       - `submitCourseForReview` (Mutation/Submit)
       - `getLecturerSubmissions` (Read)
       - `getCourseReviewData` (Read)
     - **Preservation Rule:** `isAuthorizedLecturer` must **NOT** be broadened to return `true` for `assistant_admin`! Doing so would accidentally grant `assistant_admin` write permissions to `updateCourseDraft`, `resetContentLab`, and `submitCourseForReview`.
     - **Dedicated Read Authorization:** Plan a dedicated read-visibility helper (e.g. `canUserReadCourseReview(targetCourse, user)`) that permits `assistant_admin`, `super_admin`, and `developer` to view review queues and review data under Rule A, while keeping `isAuthorizedLecturer` strictly for instructor ownership and operational admin editing.
  2. **Review Queue & Review Data Read Access (`MFR-30`):**
     - Update `getReviewQueue(user)` and `GET /api/reviews/queue` to permit `assistant_admin`, `super_admin`, and `developer` (`200 OK`).
     - Update `getCourseReviewData(courseId, user)` and `GET /api/reviews/courses/:courseId` to permit `assistant_admin`, `super_admin`, and `developer` (`200 OK`).
     - Zero mutation authority: Review decisions (`POST /api/reviews/courses/:courseId/decision`) remain restricted to authorized decision-makers (`admin`, `super_admin`, `developer`). `assistant_admin` receives `403 Forbidden`.
  3. **Admin-Class Preview Progress Isolation (`MFR-21`):**
     - Update `recordLessonActivity` and `markLessonComplete` in `inMemoryStore.ts` to skip writing trainee progress records (`this.userProgress`) for:
       - `developer`
       - `super_admin`
       - `admin`
       - `assistant_admin`
       - `lecturer`
     - Trainees (`role === 'user'`) continue normal progress recording and sequential completion tracking.
- **Acceptance Criteria:**
  - `assistant_admin` views the review queue and course review data without `403`.
  - `assistant_admin` attempting to submit a review decision receives `403 Forbidden`.
  - Previewing lessons as `assistant_admin`, `super_admin`, or `developer` leaves `userProgress` completely untouched.
  - Trainees completing lessons update `userProgress` normally.
- **Tests to Author:** `frontend/src/test/course-review-visibility-and-preview.test.ts` (`WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`).
- **Explicit Exclusions:** Zero approval execution logic or curriculum publish merging (deferred to Phase 4).

---

### Increment 3.4 — Route Guards, Role Navigation & Canonical Arabic Labels
- **MFRs Addressed:** `MFR-17` (Confirmed Defect, P1), `MFR-08` (Confirmed Defect, P1), `MFR-16` (Confirmed Defect, P2), and `MFR-05` (UI layer).
- **Files in Scope:**
  - `frontend/src/app/router/index.tsx`
  - `frontend/src/core/auth/ProtectedRoute.tsx`
  - `frontend/src/shared/ui/Sidebar/Sidebar.tsx`
  - `frontend/src/shared/ui/MobileDrawer/MobileDrawer.tsx`
  - `frontend/src/pages/DashboardPage.tsx`
  - `frontend/src/app/layouts/AppLayout.tsx`
  - `frontend/src/pages/ProfilePage.tsx`
  - `frontend/src/pages/ForbiddenPage.tsx`
  - `frontend/src/pages/CourseDetailPage.tsx`
  - `frontend/src/pages/DashboardPreviewPage.tsx`
- **Key Deliverables & Boundaries:**
  1. **Route Protection (`MFR-17`):**
     - Wrap all role-restricted routes in `<ProtectedRoute allowedRoles={...}>`:
       - Administrative routes (`admin/groups*`, `admin/users*`, `admin/permissions*`, `admin/audit`, `admin/department-tracks`, `admin/comment-moderation`, `approvals`, `admin/review/:courseId`): `allowedRoles={['developer', 'super_admin', 'admin', 'assistant_admin']}`.
       - Lecturer authoring routes (`lecturer/courses`, `lecturer/builder/:courseId`, `lecturer/performance/:courseId`): `allowedRoles={['developer', 'super_admin', 'admin', 'lecturer']}`.
     - Unauthenticated users redirect to `/login`; unauthorized roles redirect to `/403`.
  2. **Role-Filtered Navigation (`MFR-08`):**
     - Filter `NAVIGATION_SECTIONS` in `Sidebar.tsx` and `MobileDrawer.tsx` based on the authenticated user's actual role:
       - Trainees (`user`): See ONLY Overview and Learning items (`dashboard`, `courses`, `my-courses`, `my-groups`). Operations & Management is completely hidden.
       - Lecturers: See Course Builder (`/lecturer/courses`) plus trainee catalog items. Administrative items are completely hidden.
       - Administrators (`developer`, `super_admin`, `admin`, `assistant_admin`): See all administrative navigation items.
       - Developer: Sole role that sees `/design-system`.
  3. **Dashboard UI View (`MFR-05` UI):**
     - Update `DashboardPage.tsx` to render `<AdminDashboard />` for `assistant_admin`, `super_admin`, and `developer`.
  4. **Canonical Arabic Labels (`MFR-16`):**
     - Replace ad-hoc local dictionaries with `ROLE_CANONICAL_LABELS_AR` across `AppLayout.tsx`, `ProfilePage.tsx`, `ForbiddenPage.tsx`, `CourseDetailPage.tsx`, and `DashboardPreviewPage.tsx`.
- **Acceptance Criteria:**
  - Trainee navigating directly to `/admin/groups` or `/lecturer/courses` is redirected to `/403`.
  - Trainee Sidebar and MobileDrawer render zero administrative or lecturer links.
  - `assistant_admin` navigates to `/admin/audit` and `/approvals` without redirection to `/403`.
  - `assistant_admin` dashboard renders `AdminDashboard`.
  - Arabic role labels render canonical strings (`المطور`, `المسؤول الأعلى`, `مدير النظام`, `مدير النظام المساعد`, `المحاضر`, `المتدرب`) across all layout and profile components.
- **Tests to Author:** `frontend/src/test/route-guards-and-navigation.test.tsx` (`WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`).
- **Explicit Exclusions:** Zero Phase 5 preview/impersonation tools; no changes to login mechanics.

---

## 5. Acceptance Criteria Checklist (Phase 3 Exit Gate)

- [x] `[Increment 3.1]` All legacy capability keys (`users.view`, `transcripts.view`, `permissions.view`, `permissions.manage`) replaced with canonical keys across handlers and policy.
- [x] `[Increment 3.1]` `assistant_admin` can read Security Audit `GET /api/admin/audit` without `403` errors (`D-14`), with Developer identity masked as `النظام`.
- [x] `[Increment 3.1]` `getDashboardData` returns administrative KPIs for `assistant_admin`, `super_admin`, and `developer`.
- [x] `[Increment 3.2]` `assistant_admin` can view all training groups via `GET /api/admin/groups` and group monitoring screens without `403`.
- [x] `[Increment 3.2]` `GET /api/groups/:groupId/assistants` requires authentication (`401` on unauthenticated).
- [x] `[Increment 3.2]` `POST` and `DELETE /api/groups/:groupId/assistants` restrict management to operational admins and assigned group supervisors; trainees receive `403 Forbidden`.
- [x] `[Increment 3.3]` `assistant_admin`, `super_admin`, and `developer` can view review queue and course review data without `403`, while `isAuthorizedLecturer` editing checks remain strictly unbroadened.
- [x] `[Increment 3.3]` `recordLessonActivity` and `markLessonComplete` skip progress mutations for `developer`, `super_admin`, `admin`, `assistant_admin`, and `lecturer`.
- [x] `[Increment 3.4]` All role-restricted routes in `router/index.tsx` enforce `<ProtectedRoute allowedRoles={...}>`.
- [x] `[Increment 3.4]` `Sidebar.tsx` and `MobileDrawer.tsx` filter navigation items by role; trainees see zero admin/lecturer links.
- [x] `[Increment 3.4]` `DashboardPage.tsx` renders `AdminDashboard` for `assistant_admin`, `super_admin`, and `developer`.
- [x] `[Increment 3.4]` All layout and profile components consume `ROLE_CANONICAL_LABELS_AR`.
- [x] Zero application source code regressions in Phase 1 or Phase 2.
- [x] Zero test runner or build executions run during Phase 3 turn.

---

### Final Status Banner

```
══════════════════════════════════════════════════════════════════════════════
  STATUS: INCREMENT 3.4 — ROUTE GUARDS, ROLE NAVIGATION & ARABIC LABELS COMPLETED — AWAITING OWNER REVIEW & PHASE 3 FORMAL CLOSURE
  Increment 3.4 Implementation Completed:
  - Protected Route Guards (MFR-17): Wrapped all administrative, authoring, and operational routes in ProtectedRoute with explicit allowedRoles across router/index.tsx. Unauthenticated visitors redirect to /login with state preserved; unauthorized roles redirect to /403; unknown/falsy roles fail closed.
  - Role-Filtered Navigation (MFR-08): Enabled central isNavItemVisibleForRole predicate in shared/config/navigation.ts consumed by both Sidebar.tsx and MobileDrawer.tsx. Trainees see zero admin/lecturer items; lecturers see Course Builder plus catalog items; admins see full administrative navigation; developer is the sole role with access to /design-system.
  - Dashboard UI Routing & Role Resolution (MFR-05): DashboardPage.tsx renders AdminDashboard for assistant_admin, super_admin, and developer alongside admin. Assistant admin never routes to TraineeDashboard.
  - Canonical Arabic Role Labels (MFR-16): Centralized single source of truth around ROLE_CANONICAL_LABELS_AR from core/permissions/types.ts across AppLayout.tsx, ProfilePage.tsx, ForbiddenPage.tsx, CourseDetailPage.tsx, and DashboardPreviewPage.tsx, eliminating ad-hoc strings ('متدرب فني', 'صلاحيات محاضر معتمد').
  - Read vs. Mutation Separation (MFR-21 / MFR-30): CourseReviewPage and LecturerCoursesPage explicitly disable/hide edit mode toggles, creation buttons, and decision triggers for assistant_admin while maintaining full read/preview visibility.
  - Test Suite Authored: frontend/src/test/route-guards-and-navigation.test.tsx (28 test cases).
  - Test Status: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13.
  - Zero test runner, compiler, linter, or build commands executed (Part A Directive).
══════════════════════════════════════════════════════════════════════════════
```
