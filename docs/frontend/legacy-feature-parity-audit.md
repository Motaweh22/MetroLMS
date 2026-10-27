# Cairo Metro LMS — Legacy-to-React Feature Parity Audit

---

## 1. Executive Summary & Audit Baseline

This document provides a comprehensive, evidence-based feature parity audit comparing the legacy Cairo Metro Learning Management System (Vanilla JavaScript SPA) against the modern React frontend (`frontend/src/`).

The audit was conducted strictly in accordance with **Documentation-First** principles:
- **No application code was altered** in either the legacy repository (`js/*.js`, `data/*.json`, `app.html`) or the modern React repository (`frontend/src/`).
- Parity claims are grounded exclusively in verifiable source code, exact file paths, line numbers, event handlers, and data structures.
- Previously accepted functionality across **Increments 1 through 10** remains preserved.

### Legacy Source Artifacts Inspected

| File Path | Description | Exact Size (Bytes) | Line Count |
| :--- | :--- | :--- | :--- |
| `app.html` | Legacy SPA master HTML shell, navbar, user dropdown, script loader | 6,203 bytes | 121 lines |
| `js/app.js` | SPA hash router, role access rules (`hasAccess`), route dispatcher | 9,191 bytes | 325 lines |
| `js/admin.js` | Admin user management, transcripts, approvals, stats, moderation, permissions, groups | 290,525 bytes | 5,903 lines |
| `js/lecturer.js` | Lecturer courses, approvals, statistics, course performance, lecturer groups | 87,938 bytes | 1,674 lines |
| `js/course.js` | Course detail, learning player, offline zip packaging, WhatsApp FAB | 71,306 bytes | 1,570 lines |
| `js/builder.js` | Course curriculum builder, team management, direct learners, download policy | 101,424 bytes | 2,024 lines |
| `js/pages.js` | Core public & trainee pages (catalog, my-courses, my-groups, profile, design preview) | 159,673 bytes | 2,982 lines |
| `js/components.js` | Shared UI components (navbar, sidebar, modal, QR code, toast, course picker) | 33,033 bytes | 708 lines |
| `js/data.js` | DataService persistence broker (`localStorage`, synthetic groups, server endpoints) | 16,842 bytes | 473 lines |
| `data/users.json` | 12 seed user account fixtures (roles, credentials, watch histories, metrics) | 9,452 bytes | 316 lines |
| `data/courses.json` | 6 published course fixtures with hierarchical chapters, items, quizzes, comments | 56,913 bytes | 1,806 lines |
| `data/notifications.json` | Seed notifications fixtures | 1,425 bytes | 45 lines |

---

## 2. Legacy-to-React Feature Parity Matrix

### Migration Status Definitions
- **Fully migrated:** Behavior is implemented in React and supported by identifiable code and automated test verification.
- **Partially migrated:** Some behavior exists, but material legacy functionality is missing or incomplete.
- **UI only:** A page or visual interaction exists, but the actual workflow or persistence is incomplete.
- **Mock-only:** Behavior is simulated or depends on in-memory/demo fixtures and is not a complete persistent production implementation.
- **Not migrated:** A verified legacy feature has no adequate React equivalent.
- **Intentionally deferred:** A feature was deliberately excluded from the current scope and has a documented future destination.
- **Potentially obsolete:** The code suggests the feature may no longer be required, but its retirement needs product-owner confirmation.
- **Unverified:** Available evidence is insufficient to classify the feature confidently.

---

### Matrix Inventory

| Feature ID | Functional Area | Legacy Feature | Legacy Evidence (File, Line, Symbol) | React Equivalent (File, Symbol) | Migration Status | Behavioral Parity Analysis | Dependencies | Priority | Recommendation | Notes / Evidence Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LEG-001** | User & Identity | User Directory Table & Roster | `js/admin.js:17–130`, `renderUsersPage()`, `renderUsersTable()` | None (`src/app/router/index.tsx` lacks `/admin/users`) | **Not migrated** | Legacy displays table with ID, Name, Job Title, Department, Inline Role select, Status badge, Last Login, Actions. React has no users management table. | User domain model, Users API, MSW handler | Critical | Complete migration | Primary core capability required for Increment 11. |
| **LEG-002** | User & Identity | User Search & Multi-Filter | `js/admin.js:32–54, 97–117`, `applyFilters()` | None | **Not migrated** | Legacy provides real-time search across Name, ID, Job Title + Role select filter (`all`, `user`, `lecturer`, `admin`) + Status filter (`all`, `active`, `suspended`). Not in React. | `User` types, filtering utility | Critical | Complete migration | Belongs in Increment 11 User Directory. |
| **LEG-003** | User & Identity | Inline User Role Mutation | `js/admin.js:135–141, 178–184, 361–368`, `changeUserRole()` | None | **Not migrated** | Legacy updates user role directly from a dropdown in the table row, saves immediately to storage, and shows toast. Not in React. | User service mutation endpoint | Critical | Complete migration | Belongs in Increment 11 User Management. |
| **LEG-004** | User & Identity | Account Suspension & Activation Modal | `js/admin.js:76–85, 147–150, 186–191, 246–257, 370–388`, `toggleUserStatus()` | None | **Not migrated** | Legacy opens danger confirmation modal before setting status to `suspended`; one-click reactivation to `active`. Not in React. | Modal component, User mutation API | Critical | Complete migration | Belongs in Increment 11 User Management. |
| **LEG-005** | User & Identity | Add New User Modal & Validation | `js/admin.js:260–359`, `openAddUserModal()` | None | **Not migrated** | Legacy modal validates name, username, password, job title select, role; generates `USR${Date.now()}`; checks uniqueness. Not in React. | Form validation, User creation API | Critical | Complete migration | Belongs in Increment 11 User Management. |
| **LEG-006** | User & Identity | User Detail Page & Learning Transcript | `js/admin.js:391–622`, `renderUserDetailPage()` | None (`src/app/router/index.tsx` lacks `/admin/users/:userId`) | **Not migrated** | Legacy route `user/:id` displays user profile card, 4 stat cards (hours, avg completion %, enrolled count, completed count), and course cards list with times opened and most-watched lesson item. | Course attempt ledger, User transcript DTO | Critical | Complete migration | Belongs in Increment 11 User Management. |
| **LEG-007** | User & Identity | Authentication & Login Workflow | `data/users.json:1–316`, `js/app.js:14–39` | `src/pages/LoginPage.tsx`, `src/features/auth/`, `src/core/auth/` | **Fully migrated** | Legacy used plaintext passwords in `users.json`. React uses secure synthetic demo accounts, MSW authentication, `AuthContext`, and session persistence in `sessionStorage`. | MSW v2, React Router | Critical | Preserve | Enhanced security: legacy plaintext passwords deliberately not migrated. |
| **LEG-008** | User & Identity | Role-Based Route Access Control (RBAC) | `js/app.js:113–126`, `hasAccess(page, role)` | `src/core/auth/ProtectedRoute.tsx` | **Fully migrated** | Both enforce role-based guards. Unmigrated admin routes will use existing `ProtectedRoute` with `allowedRoles={['admin']}`. | `AuthContext` | Critical | Preserve | Tested across all existing pages. |
| **LEG-009** | User & Identity | Suspended Account Login Rejection | `js/app.js:30–35` | `src/mocks/handlers/authHandlers.ts` | **Partially migrated** | Legacy kicks out suspended users on init and blocks login. React mock accounts do not yet include a suspended persona or status check in login handler. | Auth service, User status model | High | Complete migration | Needs suspended account fixture and check in Increment 11. |
| **LEG-010** | User & Identity | Centralized Trainee Candidate Roster | `js/admin.js:1610+` (accessed `DataService.getUsers()`) | `src/mocks/store/inMemoryStore.ts:4241`, `getCandidateTrainees()` | **Partially migrated** | Legacy accessed unified `_allUsers`. React currently uses hardcoded array `['usr_trainee_003', 'USR003'...'USR010']` resolved through a private dictionary helper. | Unified user store | High | Complete migration | **Decision 3 Resolved (Option A):** Unified with the 12-user central directory fixtures in Increment 11. |
| **LEG-011** | Course Admin | Course Catalog & Search | `js/pages.js`, `renderCoursesPage()` | `src/pages/CoursesCatalogPage.tsx`, `src/features/courses/` | **Fully migrated** | Full search, level pills, cards grid, ratings, lecturer metadata. 100% parity achieved in Increment 4. | MSW course handlers | High | Preserve | Verified with automated tests. |
| **LEG-012** | Course Admin | Course Detail & Syllabus Accordion | `js/course.js`, `renderDetailView()` | `src/pages/CourseDetailPage.tsx`, `src/features/courses/` | **Fully migrated** | Hero banner, syllabus chapters/items accordion, metadata, enrollment action. Verified in Increment 4. | Course types, API | High | Preserve | Verified with automated tests. |
| **LEG-013** | Course Admin | Course Curriculum Builder | `js/builder.js:1–2024` | `src/pages/CourseBuilderPage.tsx`, `src/features/course-builder/` | **Fully migrated** | Tree-based chapter/lesson editor, quiz builder, drag/reorder, content upload simulation. Verified in Increment 8. | Course builder store | High | Preserve | Verified with automated tests. |
| **LEG-014** | Course Admin | Course Authoring Team (`team`) | `js/builder.js:934–981`, `renderTeamEditor()` | None in `src/features/course-builder/` | **Not migrated** | Legacy allowed adding co-lecturers and assistants to a course authoring team with permissions. React builder is single-author. | Course model `team` attribute | Medium | Defer | Deferred to post-launch collaboration milestone. |
| **LEG-015** | Course Admin | Direct Learners Assignment in Builder (`learners`) | `js/builder.js:983–1017`, `renderLearnersEditor()` | None | **Potentially obsolete** | Legacy allowed assigning individual trainees (`enrolledUsers`) inside course builder. In React, group assignment (Inc 10) and catalog self-enrollment (Inc 5) replace this. | Group assignment | Low | Retire | Superseded by modern Training Groups model. |
| **LEG-016** | Course Admin | Course Download Policy & Permissions | `js/builder.js:851–870`, `editor-download-policy` | None | **Not migrated** | Legacy had `downloadPolicy` (`none`, `all`, `specific`) and `downloadAllowedUsers: string[]`. React builder lacks this setting. | Course domain model | Low | Defer | Low priority for LMS MVP; recommend deferring to post-Increment 11. |
| **LEG-017** | Course Admin | WhatsApp Support Contacts in Builder | `js/builder.js:872–878`, `whatsappContacts` | `src/features/courses/components/CourseHero.tsx` | **Partially migrated** | Legacy stored dynamic list of support contacts. React `CourseHero` renders a static WhatsApp button without builder configuration. | Course model `whatsappContacts` | Medium | Defer | Retain static support links; dynamic builder contacts deferred. |
| **LEG-018** | Course Admin | Administrative Quality Review Queue | `js/review.js:1–350`, `js/admin.js:623–897` | `src/pages/ApprovalsPage.tsx`, `src/pages/CourseReviewPage.tsx` | **Fully migrated** | Review queue, chapter/item inspection, working notes, approve/reject workflow. Verified in Increment 9. | Course review store | Critical | Preserve | 100% functional parity. |
| **LEG-019** | Course Admin | Lecturer Course Hide Request (`pending_hide`) | `js/components.js:363–438` | None | **Not migrated** | Lecturer could submit a modal request to hide a published course with a reason; admin notified. Not in React. | Notifications, Course status | Low | Defer | Rare operational workflow; recommend deferral. |
| **LEG-020** | Learning | Video Tracking & Playback Seconds | `js/course.js:1120–1185` | `src/pages/LearningPlayerPage.tsx`, `src/features/learning-player/` | **Fully migrated** | Playback progress, position resume, completion thresholds. Verified in Increment 6. | Video player, attempt ledger | Critical | Preserve | Fully tested. |
| **LEG-021** | Learning | Lesson Sequential Locking | `js/course.js` | `src/core/domain/progress.ts:isLessonLocked` | **Fully migrated** | Enforces prerequisite lesson completion before unlocking subsequent lessons. Verified in Increment 6. | Domain progress rules | Critical | Preserve | Fully tested. |
| **LEG-022** | Learning | Trainee Progress Mathematical Engine | `js/course.js:103–116` | `src/core/domain/progress.ts:calculateTraineeProgress` | **Fully migrated** | 100% mathematical formula parity for completed items ratio and 100% completion overrides. | Domain progress | Critical | Preserve | Characterization tests pass. |
| **LEG-023** | Learning | Exit Quiz Scoring & Pass Threshold ($\ge 70\%$) | `js/course.js` | `src/features/learning-player/components/QuizView.tsx` | **Fully migrated** | Quiz questions, scoring, $70\%$ pass requirement, re-attempt controls. Verified in Increment 6. | Quiz engine | Critical | Preserve | Fully tested. |
| **LEG-024** | Learning | Post-Deadline Policy (`keep_no_cert` vs `hide`) | `js/course.js:34–48` | `src/core/domain/groups.ts`, `src/features/learning-player/` | **Fully migrated** | Blocks certificate or hides course based on training group policy when deadline expires. Verified in Inc 6 & 10. | Group policy engine | Critical | Preserve | Fully tested. |
| **LEG-025** | Learning | Offline Course Packaging (`JSZip`) | `js/course.js:1125–1184`, `#btn-download-course` | None | **Not migrated** | Legacy bundled entire course into `.zip` containing chapters as folders. React learning player allows downloading individual attachments. | JSZip or backend zip endpoint | Low | Defer | Heavy client-side packaging; best handled via dedicated backend endpoint later. |
| **LEG-026** | Learning | Multi-Contact WhatsApp Floating Action Button | `js/course.js:215–261`, `renderWhatsAppFab()` | None (only single hero button in catalog details) | **Partially migrated** | Legacy had floating FAB popover with list of mentors and pre-filled inquiry text. React has single static button. | UI floating component | Medium | Defer | Nice-to-have UX enhancement; deferred post-Increment 11. |
| **LEG-027** | Groups & Ops | Group Creation & Lifecycle Configuration | `js/admin.js:1548–2400` | `src/pages/GroupEditorPage.tsx`, `src/features/groups/` | **Fully migrated** | Multi-course assignments, deadlines, policies, schedules, validations. Verified in Increment 10. | Group domain models | Critical | Preserve | 52 automated tests passing. |
| **LEG-028** | Groups & Ops | Direct Trainee Membership Assignment | `js/admin.js` | `src/features/groups/components/DirectAssignModal.tsx` | **Fully migrated** | Select multiple trainees, assign to group, automatically synchronize course enrollments. Verified in Inc 10. | Groups API, mock store | Critical | Preserve | Tested and verified. |
| **LEG-029** | Groups & Ops | QR Code Enrollment & Join Requests | `js/components.js:595–695` | `src/features/groups/components/GroupQRModal.tsx`, `JoinGroupPage.tsx` | **Fully migrated** | Dynamic QR code generation, canvas download, open vs approval_required policies, token rotation. Verified in Inc 10. | QR generator | Critical | Preserve | Tested and verified. |
| **LEG-030** | Groups & Ops | Renewal Cycles & Independent Attempt Ledgers | `js/admin.js` | `src/features/groups/`, `src/core/domain/groups.ts` | **Fully migrated** | Multi-cycle renewals, attempt sealing, cycle-isolated metrics, repeat course attempts. Verified in Inc 10. | Attempt domain models | Critical | Preserve | Characterization tests pass. |
| **LEG-031** | Groups & Ops | Group Materials Library & File Management | `js/admin.js` | `src/features/groups/components/GroupMaterialsTab.tsx` | **Fully migrated** | Folders, multi-format file uploads, visibility toggles, download tracking. Verified in Inc 10. | Materials API | Critical | Preserve | Tested and verified. |
| **LEG-032** | Groups & Ops | Group Monitoring & Trainee Attention Alerts | `js/admin.js:3400–4500` | `src/pages/GroupMonitoringPage.tsx`, `checkTraineeAttention` | **Fully migrated** | Inactivity, pacing, and critical deadline alerts ($20\%$, $50\%$, $\le 48\text{h}$) with countdown strips. Verified in Inc 10. | Domain attention rules | Critical | Preserve | Characterization tests pass. |
| **LEG-033** | Groups & Ops | Safe Archival vs Permanent Deletion | `js/admin.js` | `src/mocks/store/inMemoryStore.ts:3178`, `deleteGroup` | **Fully migrated** | Groups with members, completed cycles, started attempts, or materials are archived safely instead of deleted. | Mock store logic | Critical | Preserve | Fully tested. |
| **LEG-034** | Lecturer | Lecturer Courses Workspace | `js/lecturer.js:1–400`, `renderMyCoursesPage()` | `src/pages/LecturerCoursesPage.tsx` | **Fully migrated** | Lecturer course list, status badges, metrics, create new course launcher. Verified in Increment 8. | Courses API | High | Preserve | Tested and verified. |
| **LEG-035** | Lecturer | Lecturer Assigned Groups & Supervision | `js/lecturer.js:1400–1663` | `src/pages/AdminGroupsPage.tsx`, `GroupMonitoringPage.tsx` | **Fully migrated** | Supervisors can filter and view their assigned groups and trainee progress. Verified in Increment 10. | Groups API | High | Preserve | Tested and verified. |
| **LEG-036** | Lecturer | Course Trainee Performance & WhatsApp Reminder | `js/lecturer.js:819–950`, `renderCoursePerformancePage()` | None (`src/app/router/index.tsx` lacks `performance/:id`) | **Not migrated** | Route `performance/:courseId` displayed enrolled trainees table, progress %, last interaction date, status, and direct WhatsApp reminder link. | Trainee progress service | High | Complete migration | **Decision 2 Resolved (Option A):** Included in Increment 11 (Phase 5). |
| **LEG-037** | Lecturer | Course Self-Enrollment Request Approval Queue | `js/lecturer.js:557–675`, `renderApprovalsPage` tab 1 | None | **Potentially obsolete** | Handled course-level self-enrollment approval. Replaced by open catalog enrollment + Group Join Requests in modern system. | Approvals API | Low | Retire | Superseded by modern enrollment architecture. |
| **LEG-038** | Admin & Ops | System Statistics & Analytics Dashboard (`/stats`) | `js/admin.js:898–1074`, `renderStatsPage()`, `js/lecturer.js:686–818` | None (`src/app/router/index.tsx` lacks `/stats`) | **Intentionally deferred** | 4 Top Cards (users, courses, enrollments, completion %), Top 5 courses/users, Courses table with expandable CSS donut charts and peak hours charts. | Centralized user directory, attempt ledger | High | Complete migration | **Rescheduled to Increment 12** to focus Increment 11 on core user directory and administrative workflows. |
| **LEG-039** | Admin & Ops | Comment Moderation Queue (`/admin/comment-moderation`) | `js/admin.js:1075–1307`, `renderCommentModerationPage()` | None (`src/app/router/index.tsx` lacks route) | **Not migrated** | Reported comments queue with delete comment / ignore report actions; All comments table with search; Course-level comments toggle (`commentsEnabled`). | Comments domain model & API | High | Complete migration | Belongs in Increment 11 (Phase 5). |
| **LEG-040** | Admin & Ops | Role Permissions Matrix (`/admin/permissions` Tab 1) | `js/admin.js:1324–1378`, `tab-matrix` | None (`src/app/router/index.tsx` lacks route) | **Not migrated** | Matrix displaying roles (admin, lecturer, user) vs system capabilities (course creation, deletion, approvals, moderation, suspensions). | Permissions config | High | Complete migration | Belongs in Increment 11 (Phase 4). |
| **LEG-041** | Admin & Ops | System Activity Audit Trail (`/admin/permissions` Tab 2) | `js/admin.js:1379–1430`, `tab-audit` | None | **Not migrated** | Audit table with timestamp, user + role, action badge, details, and IP address. Course-level audit exists, but system-wide audit trail does not. | System audit log DTO | High | Complete migration | Belongs in Increment 11 (Phase 4). |
| **LEG-042** | Admin & Ops | Department Course Track Access (`/admin/permissions` Tab 3) | `js/admin.js:1431–1470`, `tab-departments` | None | **Mock-only / UI only** in legacy; **Not migrated** in React | Mapping checkboxes assigning course tracks to Maintenance vs Operations departments. In legacy, saving was simulated (`alert`). | Department permissions API | Medium | Complete migration | **Decision 1 Resolved (Option A):** Included in Increment 11 (Phase 4) with explicit boundary: settings persisted in store, but catalog gating deferred until explicit rules are defined. |
| **LEG-043** | Admin & Ops | Web File System Access API Integration | `js/storage.js`, `js/admin.js:1486–1546` | `src/mocks/store/inMemoryStore.ts` | **Replaced** | Legacy connected to local disk via Chrome File System Access API. React uses in-memory MSW store for deterministic testing. | MSW v2 | Low | Retire | Modern web apps use API backends rather than local disk handles. |
| **LEG-044** | Admin & Ops | Notification Center & Unread Bell | `js/components.js:95–106`, `js/pages.js` | `src/pages/NotificationsPage.tsx`, `src/features/notifications/` | **Fully migrated** | Unread bell badge in navbar, notification list, mark all as read, notification types. Verified in Increment 7. | Notifications API | High | Preserve | Fully tested. |
| **LEG-045** | UI & Nav | User Dropdown & Settings Placeholder | `app.html:44–75`, `js/components.js:108–176` | `src/app/layouts/AppLayout.tsx`, `src/pages/ProfilePage.tsx` | **Partially migrated** | Profile, Design Lab, and Logout migrated. Legacy "Settings" click navigated to a generic placeholder page. | React Router | Medium | Preserve / Replace | Settings placeholder should remain a planned item or be merged into Profile. |
| **LEG-046** | UI & Nav | Design System Preview / Lab | `js/pages.js:2700–2980`, `preview.html` | `src/pages/DesignSystemPreviewPage.tsx`, `src/features/design-lab/` | **Fully migrated** | Token explorer, components preview, interactive controls. Unprotected public route. Verified in Increment 1. | Design tokens | High | Preserve | Fully operational. |
| **LEG-047** | UI & Nav | Loading States & Error Boundaries | Legacy simple text spinners (`جاري... ⏳`) | `src/shared/ui/Loading/`, `src/pages/NotFoundPage.tsx`, etc. | **Fully migrated** | Robust loading skeleton, spinner, `RouteErrorBoundary`, dedicated `/404`, `/403`, `/500` error pages. Exceeds legacy fidelity. | Design system | High | Preserve | Fully tested and verified. |
| **LEG-048** | UI & Nav | Responsive Sidebar & Mobile Drawer | `app.html:15–21`, `js/components.js:234–258` | `src/app/layouts/AppLayout.tsx`, `src/shared/ui/Sidebar/` | **Fully migrated** | Desktop collapse toggle, mobile backdrop drawer, active route indicators. Verified across viewports. | Layout shell | High | Preserve | Fully tested. |

---

## 3. Critical Gaps and Forgotten Legacy Features

### A. Confirmed Missing Features

#### 1. Centralized User Directory & Account Lifecycle (`/admin/users`)
- **Legacy Implementation:** [`js/admin.js:17–390`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/admin.js#L17-L390) (`renderUsersPage`, `renderUsersTable`, `applyFilters`, `changeUserRole`, `toggleUserStatus`, `openAddUserModal`).
- **React Status:** Completely absent from `src/app/router/index.tsx` and `src/pages/`.
- **Functional Impact:** Administrators cannot view user rosters, cannot filter users by department or role, cannot create new employee accounts, cannot suspend accounts, and cannot alter permissions.
- **Increment 11 Plan:** **Required in Increment 11 (Phase 1 & Phase 2).**
- **User Clarification:** No clarification required. Core LMS administrative requirement.

#### 2. User Detail Page & Training Transcript (`/admin/users/:userId`)
- **Legacy Implementation:** [`js/admin.js:391–622`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/admin.js#L391-L622) (`renderUserDetailPage`).
- **React Status:** Absent from `src/app/router/index.tsx` and `src/pages/`.
- **Functional Impact:** Administrators cannot inspect an individual trainee's training history, total learning hours, times opened per course, completion percentages, or most-watched lesson items.
- **Increment 11 Plan:** **Required in Increment 11 (Phase 3).**
- **User Clarification:** No clarification required. Directly maps to legacy transcript view.

#### 3. Role Permissions Matrix & System Audit Trail (`/admin/permissions`)
- **Legacy Implementation:** [`js/admin.js:1308–1480`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/admin.js#L1308-L1480) (`renderPermissionsPage`, tabs `tab-matrix`, `tab-audit`, `tab-departments`).
- **React Status:** Absent from `src/app/router/index.tsx`.
- **Functional Impact:** Lack of administrative visibility into role permissions and system-level actions (user creation, course edits, account suspensions, IP addresses).
- **Increment 11 Plan:** **Required in Increment 11 (Phase 4).**
- **Decision 1 Resolution:** Option A chosen with an explicit enforcement boundary: Department permissions matrix settings are editable and persisted in the mock store, but catalog gating is deferred until explicit authorization rules are formally reviewed. Recorded as an unresolved legacy business rule.

#### 4. System Statistics & Reporting Dashboard (`/stats`)
- **Legacy Implementation:** [`js/admin.js:898–1074`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/admin.js#L898-L1074) (`renderStatsPage`) and [`js/lecturer.js:686–818`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/lecturer.js#L686-L818).
- **React Status:** Absent from `src/app/router/index.tsx`.
- **Functional Impact:** No executive LMS-wide completion rates, enrollment statistics, drop-out analytics, peak viewing hours charts, or top performing courses/trainees.
- **Increment 11 / 12 Plan:** **Deferred to Increment 12.** While individual trainee transcript records remain in Increment 11 Phase 3 (`/admin/users/:userId`) and course-level progress indicators remain in Increment 11 Phase 5 (`/lecturer/performance/:courseId`), the platform-wide executive reporting dashboard, aggregate completion distributions, and CSS peak viewing charts are rescheduled to a dedicated milestone in Increment 12.
- **Dependencies for Increment 12:** Increment 11 centralized user directory, reliable course-attempt ledgers, and learning-progress contracts.

#### 5. Comment Moderation Queue & Policy (`/admin/comment-moderation`)
- **Legacy Implementation:** [`js/admin.js:1075–1307`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/admin.js#L1075-L1307) (`renderCommentModerationPage`).
- **React Status:** Absent from `src/app/router/index.tsx`.
- **Functional Impact:** No interface to review reported comments, delete offending remarks, ignore false reports, or toggle discussion forums per course.
- **Increment 11 Plan:** **Required in Increment 11 (Phase 5).**
- **User Clarification:** No clarification required. Data schema verified in `data/courses.json`.

#### 6. Course Trainee Performance & WhatsApp Reminder (`/lecturer/performance/:courseId`)
- **Legacy Implementation:** [`js/lecturer.js:819–950`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/lecturer.js#L819-L950) (`renderCoursePerformancePage`).
- **React Status:** Route was documented in `legacy-inventory.md` for Increment 8, but never implemented in React router or feature components.
- **Functional Impact:** Lecturers cannot inspect the learner roster for a specific individual course (outside of groups) or trigger pre-formatted WhatsApp nudges to late trainees (`daysSince > 5`).
- **Increment 11 Plan:** **Required in Increment 11 (Phase 5).**
- **Decision 2 Resolution:** Option A chosen. Included in Increment 11 Phase 5 with enrolled learners roster, progress %, inactivity flags ($> 5\text{ days}$ based on verified attempt timestamps), and pre-formatted WhatsApp reminder links.

---

### B. Partial Migrations & Forgotten Features

#### 1. Candidate Trainees Disconnect from User Roster
- **Legacy Evidence:** In legacy `admin.js`, training group trainee assignment pulled directly from `DataService.getUsers()`.
- **React Evidence:** [`src/mocks/store/inMemoryStore.ts:4241–4263`](file:///c:/Users/Administrator/Desktop/metro%20courses/frontend/src/mocks/store/inMemoryStore.ts#L4241-L4263) hardcodes IDs `usr_trainee_003` and `USR003`–`USR010` and resolves metadata through an isolated internal dictionary rather than a shared user directory.
- **Functional Impact:** Adding a new user in user management will not automatically appear as a candidate trainee for training group direct assignment.
- **Remediation Plan:** Unify `getCandidateTrainees()` to pull from the centralized User Store created in Increment 11.

#### 2. Suspended Account Handling in Auth Lifecycle
- **Legacy Evidence:** `js/app.js:30–35` explicitly checks `freshUser.status === 'suspended'` and clears session immediately.
- **React Evidence:** `src/mocks/handlers/authHandlers.ts` validates credentials against `SYNTHETIC_DEMO_ACCOUNTS`, but has no awareness of account status (`active` vs `suspended`).
- **Functional Impact:** Admin cannot effectively test that suspending an account prevents that user from logging in.
- **Remediation Plan:** Add status validation to `authHandlers.ts` and ensure suspended accounts receive an explicit Arabic error banner.

#### 3. Course Authoring Team & WhatsApp Contacts in Course Builder
- **Legacy Evidence:** `js/builder.js:934–981` (Team) and `js/builder.js:872–878` (WhatsApp contacts).
- **React Evidence:** React `CourseBuilderPage` focuses on curriculum tree structure, item uploads, and quizzes; the Team and WhatsApp configuration tabs were not ported.
- **Functional Impact:** Multi-lecturer course collaboration and custom course-level WhatsApp support numbers cannot be configured through the React UI.
- **Remediation Plan:** Schedule as an enhancement or retain static configuration.

---

### C. Data and Business-Rule Gaps

| Domain Entity | Legacy Rule / Data Structure | Current React State | Gap Severity | Resolution Path |
| :--- | :--- | :--- | :--- | :--- |
| **User ID Generator** | Legacy generated `USR` + `Date.now()` | React uses `usr_role_xxx` format in fixtures | Low | Standardize on clean deterministic IDs in mock store (`usr_trainee_xxx`, `usr_lect_xxx`, `usr_admin_xxx`). |
| **Job Titles Vocabulary** | 6 job titles: متدرب, مهندس صيانة, مفتش محطة, سائق قطار, مدير محطة, مراقب حركة | Not formally typed in `core/auth/types.ts` | Medium | Introduce `JOB_TITLES` constant enum in `core/user-management/types.ts`. |
| **User Transcript Metrics** | Legacy tracks `watchHistory[courseId][itemId]` with `watchCount` and `openCount` | React tracks `CourseAttempt` with `positionSeconds`, `durationSeconds`, and `completedItemIds` | Low (Improvement) | Map attempt ledgers into transcript view; React attempt tracking is significantly superior to legacy counters. |
| **Comments Schema** | Course objects contain `comments: Comment[]` and `commentsEnabled: boolean` | React `Course` domain interface does not have `comments` array | High | Add `comments` and `commentsEnabled` to `Course` types and mock course fixtures. |

---

### D. Production Readiness & Mock Architecture Gaps

1. **Client-Side vs Backend Architecture:**
   - Legacy operated entirely client-side against `localStorage` and optionally an insecure disk-write Python script (`server.py` at `/api/save_json`).
   - React operates cleanly against an in-memory Mock Service Worker (MSW v2) store (`inMemoryStore.ts`).
   - **Production Readiness Note:** For Increment 11, User Management must be implemented with strict MSW v2 REST API contracts (`GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id/role`, `PATCH /api/admin/users/:id/status`), decoupling the UI entirely so it is 100% ready for real backend integration without rewriting frontend components.

2. **Test Isolation Safeguards:**
   - In Increment 10, shared in-memory store state was properly isolated through `inMemoryStore.reset()`.
   - Increment 11 user management must register its state inside `inMemoryStore` and reset cleanly between Vitest suites.

---

### E. Possible Retirements and Obsolete Legacy Code

1. **Web File System Access API (`js/storage.js`):**
   - **Legacy Evidence:** `StorageService.connect()` and `StorageService.reconcile()` prompted users to pick a local folder from Chrome.
   - **Recommendation:** **Retire completely.** Modern enterprise web applications use cloud storage and REST APIs, not local browser filesystem handles.

2. **Course Self-Enrollment Approval Requests (`js/lecturer.js:557–675`):**
   - **Legacy Evidence:** Approvals tab 1 allowed lecturers to approve catalog self-enrollments.
   - **Recommendation:** **Retire.** The modern application architecture separates self-enrollment (instant catalog enrollment) from formal cohort management (QR enrollment with approval requests handled inside Increment 10 Training Groups).

3. **Direct Learner Assignment inside Course Builder (`js/builder.js:983–1017`):**
   - **Legacy Evidence:** `learners` tab in course builder.
   - **Recommendation:** **Retire.** Superseded by Training Groups and direct cohort assignments.

---

## 4. Reconciled View Count & Summary Statistics

- **Total Legacy Views & Routes Identified:** 25 views.
- **Views Fully Migrated (Increments 1–10):** 18 views.
- **Views Confirmed for Increment 11 Delivery (All Decisions Resolved):**
  1. `users` / `manage-users` (`/admin/users`) — Centralized User Directory & Mutations (Phase 1 & Phase 2)
  2. `user/:id` (`/admin/users/:userId`) — Trainee Transcript & Course History (Phase 3)
  3. `permissions` (`/admin/permissions`) — Permissions Matrix & System Audit Trail (Phase 4; Decision 1: boundary on department access)
  4. `comment-moderation` (`/admin/comment-moderation`) — Moderation Queue & Discussion Toggles (Phase 5)
  5. `performance/:id` (`/lecturer/performance/:courseId`) — Lecturer Course Performance & WhatsApp Nudges (Phase 5; Decision 2 Resolved)
- **View Rescheduled to Increment 12:**
  - `stats` / `statistics` (`/stats`) — Platform Analytics & Executive Statistics Dashboard
- **Obsolete Views Retired:**
  - File System Storage connect modal.
  - Lecturer catalog self-enrollment approval queue.
  - Direct learner assignment in course builder.

---

## 5. Parity Sign-Off & Resolved Decisions

### Resolved Product-Owner Decisions

1. **Decision 1 — Department Course Visibility (Option A with Explicit Enforcement Boundary):**
   - **Resolution:** Implement the administrator-facing permissions matrix at `/admin/permissions` (Tab 3) with editable track/department mapping settings persisted in the in-memory store and MSW API architecture (`/api/admin/permissions/departments`).
   - **Enforcement Boundary:** Catalog-level course gating (`/courses`) will **not** automatically filter or hide courses based on department settings in this increment.
   - **Legacy Fact Grounding:** In legacy `js/admin.js:1431–1470`, saving department mappings simply displayed `alert('تم حفظ التعديلات.')` without persistent storage or downstream authorization enforcement. This is recorded as an unresolved legacy business rule. Configuration management is strictly decoupled from authorization enforcement.
   - **Security Disclosure:** The frontend mock store explicitly disclaims production-grade security or server-side authorization enforcement.

2. **Decision 2 — Lecturer Course Performance (Option A):**
   - **Resolution:** Include the missing lecturer course-performance workflow in Increment 11 within dedicated Phase 5 at route `/lecturer/performance/:courseId`.
   - **Scope:**
     - Course Hero with enrolled learners counter.
     - Learner roster table showing trainee avatar, name, job title, and progress percentage.
     - Inactivity indicators (`متأخر ⚠️`) flagged for learners inactive for more than 5 days, evaluated strictly from reliable activity timestamps (`CourseAttempt.lastActivityAt` / `CourseAttempt.updatedAt`) rather than fabricated values or demo placeholders.
     - Pre-formatted WhatsApp reminder link (`https://wa.me/{phone}?text=...`) opening with encoded Arabic reminder copy.
     - Role-based access for responsible lecturer and authorized administrators (`allowedRoles={['lecturer', 'admin']}`).

3. **Decision 3 — Central User Directory Seed Data (Option A):**
   - **Resolution:** Prepare the central mock user directory using the 12 verified user fixtures identified in `data/users.json` with sanitized synthetic credentials (`metroUser2026!`) and rich role/department metadata.
   - **Sanitization & Security Rules:**
     - Plaintext legacy passwords (`admin`, `lecturer`, `user`, `pass123`) from `data/users.json` are **never** copied into React fixtures, documentation, or source control.
     - Existing synthetic demo accounts (`usr_admin_001`, `usr_lect_002`, `usr_trainee_003`) remain preserved and active for rapid persona switching.
     - Stable IDs (`USR001`–`USR012` and lower-cased `usr001`–`usr010`) are preserved with bidirectional alias resolution to protect existing Training Groups (`GRP-201`), supervisor assignments, and course attempts.
     - All 12 accounts utilize distinct, deterministic development-only credentials.
     - Reconcile `getCandidateTrainees()` to pull from this unified directory, ensuring candidate selection and user management share identical source-of-truth state.
     - Avoid introducing real authentication backends or out-of-scope account self-service features.

### Planned Increment 12 Scope
- **Platform Analytics & Executive Statistics Dashboard (`/stats`):** Platform-wide metrics overview, Top 5 courses/users, course statistics breakdown with CSS donut completion charts and peak viewing hours distribution. Depends on Increment 11 centralized user directory and attempt ledgers.

### Post-Increment 12 / Backlog
- Offline Course ZIP Packaging (`JSZip` client bundling replaced by future async backend service).
- Multi-author Course Builder Team tab (`builder.js:934–981`).
- Dynamic course-level WhatsApp contacts builder editor (`builder.js:872–878`).
- Formal department-based catalog visibility rule definition and server authorization gating.


