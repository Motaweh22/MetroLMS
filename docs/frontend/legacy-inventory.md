# Cairo Metro LMS — Legacy System Inventory & Migration Mapping

---

## 1. Executive Summary & Purpose

This inventory document provides a complete, verified baseline of the existing **Cairo Metro Learning Management System (LMS)** prototype (`app.html`, `preview.html`, `js/*.js`, and `data/*.json`). 

Its primary purpose is to serve as the authoritative migration checklist throughout the modern React frontend implementation. Every route, data source, client storage key, and operational workflow documented here has been reconciled against the actual legacy source code and cross-referenced with the comprehensive **[Legacy-to-React Feature Parity Audit](legacy-feature-parity-audit.md)**.

---

## 2. Legacy Application Architecture & Verified File Topology

The legacy application is built as a client-side Single Page Application (SPA) driven by vanilla JavaScript ES6 modules and objects, supported by an optional lightweight Python utility server.

```
metro courses/
├── app.html                          # Primary legacy SPA entry point (6,203 bytes, 121 lines)
├── preview.html                      # Isolated visual preview & icon explorer (7,522 bytes, 142 lines)
├── metro-lms-demo.html               # Monolithic standalone legacy bundle (242,109 bytes, 4,812 lines)
├── server.py                         # Insecure Python HTTP server with direct disk write endpoint (1,498 bytes)
├── css/
│   └── style.css                     # Monolithic stylesheet with external Google Fonts dependency (32,410 bytes)
├── data/
│   ├── courses.json                  # Course catalog fixtures with hierarchical chapters & items (56,913 bytes, 1,806 lines)
│   ├── users.json                    # User account fixtures with plaintext demo passwords (9,452 bytes, 316 lines)
│   └── notifications.json            # Seed notifications fixtures (1,425 bytes, 45 lines)
├── js/
│   ├── app.js                        # Master router, navigation dispatcher, and initialization (9,191 bytes, 325 lines)
│   ├── data.js                       # DataService broker (localStorage / disk / server mode) (16,842 bytes, 473 lines)
│   ├── pages.js                      # Core public & trainee page renderers (159,673 bytes, 2,982 lines)
│   ├── course.js                     # Course detail & learning player modal renderers (71,306 bytes, 1,570 lines)
│   ├── builder.js                    # Lecturer course builder & curriculum editor (101,424 bytes, 2,024 lines)
│   ├── lecturer.js                   # Lecturer workspace & approval tracking renderers (87,938 bytes, 1,674 lines)
│   ├── admin.js                      # Administrative dashboards, user management, and groups (290,525 bytes, 5,903 lines)
│   ├── review.js                     # Administrative quality review & course approval workflow (16,211 bytes, 350 lines)
│   ├── components.js                 # Shared UI widget renderers (headers, footers, stat cards) (33,033 bytes, 708 lines)
│   ├── storage.js                    # File System Access API integration (6,120 bytes, 145 lines)
│   └── icons.js                      # Legacy SVG icon lookup dictionary (14,800 bytes, 310 lines)
└── course-library/                   # File-based course index and multi-file course packages
    ├── courses-index.json
    └── courses/course_*/course.json
```

---

## 3. Verified Route & View Inventory

The legacy router in [`js/app.js`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/app.js) executes route matching inside `navigate(page)` and `renderPage(page)`. The table below inventories all 25 verified legacy views, their exact controller implementations and line numbers, role restrictions, mapped modern routes, and delivery status:

| Legacy View Key | Legacy Controller Function (Exact File & Line) | Access Role | Modern Route (`frontend/`) | Implementation Status | Notes / Parity Cross-Reference |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `home` | `Pages.renderHomePage(currentUser)` (`js/pages.js`) | All Roles | `/dashboard` | **Fully Migrated** (Increment 7) | Role-adaptive dashboard operational |
| `courses` | `Pages.renderCoursesPage(currentUser)` (`js/pages.js`) | All Roles | `/courses` | **Fully Migrated** (Increment 4) | Search, level pills, cards grid |
| `course/:id` | `CoursePage.render(courseId, currentUser)` (`js/course.js:15`) | All Roles | `/courses/:courseId` | **Fully Migrated** (Increment 4) | Hero banner, curriculum accordion |
| `course/:id/learn` (modal) | `CoursePage.renderLearningView(...)` (`js/course.js:62`) | Trainee, Admin | `/courses/:courseId/learn` | **Fully Migrated** (Increment 6) | Video player, tracking, quiz pass $\ge 70\%$ |
| `my-courses` | `Pages.renderMyCoursesPage(currentUser)` (`js/pages.js:1430`) | Trainee, Admin | `/my-courses` | **Fully Migrated** (Increment 7) | Enrolled courses and progress bars |
| `my-groups` | `Pages.renderTraineeGroupsPage(currentUser)` (`js/pages.js`) | Trainee, Admin | `/my-groups` | **Fully Migrated** (Increment 7 & 10) | Trainee cohorts, renewal cycles |
| `group/:id` / `my-group/:id` | `Pages.renderGroupDetailPage(groupId, ...)` (`js/pages.js`) | Trainee, Admin | `/my-groups/:groupId` | **Fully Migrated** (Increment 7 & 10) | Group curriculum, materials tab |
| `profile` | `Pages.renderProfilePage(currentUser)` (`js/pages.js`) | All Roles | `/profile` | **Fully Migrated** (Increment 7) | User profile, department metadata |
| `notifications` | `Pages.renderNotificationsPage(currentUser)` (`js/pages.js`) | All Roles | `/notifications` | **Fully Migrated** (Increment 7) | Notification center, unread badges |
| `created-courses` | `LecturerPages.renderMyCoursesPage(currentUser)` (`js/lecturer.js:1`) | Lecturer, Admin | `/lecturer/courses` | **Fully Migrated** (Increment 8) | Lecturer catalog, status filters |
| `builder/:id` | `CourseBuilder.render(courseId, ...)` (`js/builder.js:27`) | Lecturer, Admin | `/lecturer/builder/:courseId` | **Fully Migrated** (Increment 8) | Tree editor, lessons, quiz authoring |
| `performance/:id` | `LecturerPages.renderCoursePerformancePage(...)` (`js/lecturer.js:819`) | Lecturer, Admin | `/lecturer/performance/:courseId`| **Planned Target** (Increment 11, Phase 5) | **Decision 2 Resolved (Option A):** Learner roster, progress %, inactivity flags, WhatsApp links |
| `approvals` / `approval-requests`| `AdminPages.renderApprovalsPage` / `LecturerPages...` (`js/admin.js:623`, `js/lecturer.js:557`) | Lecturer, Admin | `/approvals` | **Fully Migrated** (Increment 9) | Administrative review queue |
| `review/:id` | `AdminReviewPage.render(courseId, ...)` (`js/review.js:1`) | Admin | `/admin/review/:courseId` | **Fully Migrated** (Increment 9) | Chapter/item audit notes, decisions |
| `group-monitoring` | `AdminPages.renderGroupMonitoringListPage(...)` (`js/admin.js:3400`) | Admin | `/admin/groups` | **Fully Migrated** (Increment 10) | Centralized group oversight |
| `group-monitoring/:id` | `AdminPages.renderGroupMonitoringDetailPage(...)` (`js/admin.js:3450`)| Admin | `/admin/groups/:groupId/monitoring` | **Fully Migrated** (Increment 10) | Trainee attention alerts, countdowns |
| `create-group` | `AdminPages.renderCreateGroupPage(currentUser, ...)` (`js/admin.js:1548`)| Admin | `/admin/groups/new`, `/admin/groups/:groupId/edit` | **Fully Migrated** (Increment 10) | Multi-course assignments, cycles |
| `lecturer-groups` | `LecturerPages.renderLecturerGroupsPage(...)` (`js/lecturer.js:1400`) | Lecturer, Admin | `/admin/groups` (Adaptive supervisor filter) | **Fully Migrated** (Increment 10) | Supervisor-filtered cohorts |
| `lecturer-group/:id` | `LecturerPages.renderLecturerGroupDetailPage(...)` (`js/lecturer.js:1450`)| Lecturer, Admin | `/admin/groups/:groupId/monitoring` | **Fully Migrated** (Increment 10) | Supervisor monitoring view |
| `users` / `manage-users` | `AdminPages.renderUsersPage(currentUser)` (`js/admin.js:17`) | Admin | `/admin/users` | **Fully Migrated** (Increment 11, Phases 1 & 2) | User directory, multi-filters, add user modal, role mutation, account suspension |
| `user/:id` | `AdminPages.renderUserDetailPage(userId, ...)` (`js/admin.js:391`) | Admin | `/admin/users/:userId` | **Fully Migrated** (Increment 11, Phase 3) | Trainee transcript, metrics, historical attempt ledgers, telemetry honesty |
| `permissions` | `AdminPages.renderPermissionsPage(currentUser)` (`js/admin.js:1308`) | Admin | `/admin/permissions` & `/admin/department-tracks` | **Fully Migrated** (Increment 11, Phases 4A–4E) | 4 canonical roles, ceilings, overrides, role defaults, audit trail, department tracks |
| `comment-moderation` | `AdminPages.renderCommentModerationPage(...)` (`js/admin.js:1075`) | Admin | `/admin/comment-moderation` | **Planned Target** (Increment 11, Phase 5) | Reported comments queue, discussion toggle, comment lifecycle |
| `stats` / `statistics` | `AdminPages.renderStatsPage` / `LecturerPages...` (`js/admin.js:898`, `js/lecturer.js:686`) | Lecturer, Admin | `/stats` | **Planned Target** (Increment 12) | Platform analytics, CSS donuts, peak hours (rescheduled to Inc 12) |
| `design-preview` | `Pages.renderDesignPreview(currentUser)` (`js/pages.js:2700`) | Public / Dev | `/design-system` | **Fully Migrated** (Increment 1) | Design system component lab |

---

## 4. Verified Data Sources Inventory

The legacy application loads data through four primary pathways managed by `DataService` in [`js/data.js`](file:///c:/Users/Administrator/Desktop/metro%20courses/js/data.js):

### A. Static Seed Files
* **`data/users.json`:**
  * Contains array of 12 user records with attributes: `id`, `name`, `username`, `password` (plaintext: `admin`, `lecturer`, `user`, `pass123`), `role`, `department`, `jobTitle`, `avatar`, `lastLogin`, `enrolledCourses`, `completedCourses`, `watchHistory`, `totalLearningHours`, `createdAt`.
  * *Modern Migration Guardrail:* Must be sanitized into synthetic mock data in `src/mocks/fixtures/mockUsers.ts`. Passwords must never be exposed.
* **`data/courses.json`:**
  * Hierarchical course objects with attributes: `id`, `title`, `description`, `category`, `level`, `duration`, `thumbnail`, `lecturerId`, `lecturerName`, `status` (`published`, `draft`, `pending_approval`), `chapters[].items[]`, `comments[]`, `commentsEnabled`.
* **`data/notifications.json`:**
  * Seed notifications with attributes: `id`, `userId`, `title`, `message`, `type`, `read`, `createdAt`.

### B. Dynamic Synthetic Data (No Backing JSON File)
* **Training Groups (`GRP-101`, `GRP-102`, `GRP-103`):**
  * Training groups were dynamically generated at runtime by `DataService.getGroups()` in `js/data.js` based on relative offsets from `Date.now()`.
  * *Modern Implementation:* Replaced in Increment 10 with rich, reproducible enterprise fixtures in `src/mocks/fixtures/trainingGroupsDemoFixtures.ts` and managed in memory by `src/mocks/store/inMemoryStore.ts`.

### C. File-Based Course Library (`course-library/`)
* Contains `courses-index.json` and directory per course (`course-library/courses/course_:id/course.json`).
* *Modern Implementation:* Replaced by MSW course fixtures and centralized mock store.

---

## 5. Client-Side Storage Mechanisms & Persistence

The legacy application relies on three distinct storage tiers:

1. **`localStorage` (Primary Web Demo Persistence):**
   * Key `demo_users`: Serialized array of users, including mutation updates when courses are enrolled or progress changes.
   * Key `demo_courses`: Serialized array of courses, updated when courses are created, edited, or approved.
   * Key `demo_notifications`: Serialized array of user notifications.
   * Key `lms_training_groups`: Serialized array of training groups, created or updated through `create-group`.
2. **In-Memory Session State (`sessionStorage` / Global Window):**
   * Legacy holds `currentUser` and `currentPage` in module-scoped variables inside `js/app.js`.
   * Modern frontend encapsulates this inside `AuthContext` backed by `sessionStorage` for session preservation across refreshes.
3. **Insecure Server Disk Mutation (`POST /api/save_json`):**
   * Legacy attempts to POST raw JSON directly to `server.py` at `/api/save_json`.
   * *Modern Architecture:* Completely decoupled. MSW v2 intercepts all mutations in memory without host filesystem mutation.

---

## 6. Core Operational Workflows

### Workflow 1: Course Enrollment & Mutation
1. Trainee clicks "Enroll Now" on `CourseCard` or `CourseDetailPage`.
2. `coursesApi.enroll(courseId)` issues `POST /api/courses/:id/enroll`.
3. Store appends `courseId` to trainee's `enrolledCourses` and provisions an unstarted `CourseAttempt`.
4. UI updates button to disabled green "Enrolled" state and shows toast notification.

### Workflow 2: Learning Progress & Certificate Eligibility
1. Trainee opens lesson item inside `LearningPlayerPage`.
2. Videos log playback time (`positionSeconds`); document/PDF lessons log completion.
3. Domain function `calculateTraineeProgress` recomputes completion percentage.
4. Exit quiz requires score $\ge 70\%$ to satisfy passing threshold.
5. Domain function `evaluateCertEligibility` checks $100\%$ progress + passing quiz + deadline compliance under group policy (`keep_no_cert` vs `hide`).

### Workflow 3: Course Authoring & Submission (Lecturer)
1. Lecturer creates course in `CourseBuilderPage`.
2. Chapters and items are added; content attachments and quiz questions configured.
3. Saved as `draft`.
4. When validated, lecturer clicks "Submit for Review", transitioning status to `pending_approval`.
5. Notification generated for administrators.

### Workflow 4: Administrative Quality Audit & Approval (Admin)
1. Administrator navigates to `/approvals` or opens `/admin/review/:courseId`.
2. Admin reviews each chapter/item and attaches audit feedback notes.
3. Decision:
   * **Approve:** Status changes to `published`; notification sent to lecturer; course appears in catalog.
   * **Reject:** Status remains `draft`; rejection reasons attached; course returned to lecturer's workspace.

### Workflow 5: Training Groups & Critical Deadline Monitoring
1. Administrator creates group at `/admin/groups/new`, assigns members, sets default and custom course deadlines, and selects policy (`keep_no_cert` or `hide`).
2. Supervisors monitor groups on `/admin/groups/:groupId/monitoring`.
3. `checkTraineeAttention` runs across all group members:
   * **Inactivity Warning:** $\ge 20\%$ time elapsed with $0\%$ progress.
   * **Pacing Warning:** $\ge 50\%$ time elapsed with $< 25\%$ progress.
   * **Critical Danger Alert:** $\le 48\text{h}$ remaining with $< 60\%$ progress.
4. Alerts render in warning amber and danger red with live countdown strips.

### Workflow 6: User Administration & Permissions (Increment 11 Target)
1. Admin views user roster at `/admin/users` with filters by role, department, and status.
2. Admin creates new user via modal, edits roles inline, or suspends accounts.
3. Admin inspects individual training transcript and progress record at `/admin/users/:userId`.
4. Admin manages role permission capabilities matrix and inspects system audit trail at `/admin/permissions`.
5. Admin moderates comments and toggles discussions at `/admin/comment-moderation`.
6. Lecturers inspect course performance and send WhatsApp reminders at `/lecturer/performance/:courseId` (Increment 11 Phase 5); platform-wide executive statistics at `/stats` are scheduled for Increment 12.

---

## 7. Migration Parity Verification Matrix

| Feature Domain | Verification Criteria | Modern Status | Audit Notes |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | Support admin, lecturer, and user roles with route guards | Implemented in **Increment 3** | Verified across all pages |
| **Course Catalog & Search** | Real-time title search, category filter, level filter | Implemented in **Increment 4** | 100% parity verified |
| **Enrollment Mutation** | Instant optimistic badge update, persisted in mock store | Implemented in **Increment 5** | 100% parity verified |
| **Learning Player** | Video tracking, handout viewer, quiz scoring, progress bar | Implemented in **Increment 6** | 100% parity verified |
| **Domain Progress Math** | 100% mathematical parity with `calculateTraineeProgress` | Verified in **Increment 6** | Characterization tests pass |
| **Adaptive Dashboards** | Role-tailored metric cards, personal courses & groups | Implemented in **Increment 7** | 100% parity verified |
| **Course Builder** | Curriculum tree reordering, lesson editor, quiz builder | Implemented in **Increment 8** | Single-author authoring verified |
| **Review & Audit** | Item-by-item notes, approve & reject decision modals | Implemented in **Increment 9** | 100% parity verified |
| **Group Monitoring** | Countdown timers, custom deadline overrides | Implemented in **Increment 10** | 100% parity verified |
| **Domain Attention Math** | 100% equivalence with `checkTraineeAttention` alerts | Verified in **Increment 10** | Characterization tests pass |
| **User Administration** | User table, detail transcript, permissions matrix | **Target in Increment 11** | Scope defined in Roadmap 11 |
| **Full Parity Sign-Off** | All verified active legacy views operational in React frontend | **Final Checkpoint in Increment 11** | Cross-referenced with Parity Audit |

---

## 8. Reconciled Source Gaps & Corrections Log

During the comprehensive source-code audit conducted prior to Increment 11, the following discrepancies in earlier documentation were identified and corrected:

1. **Lecturer Course Performance Route (`performance/:id`):**
   - Earlier documentation listed `performance/:id` as delivered in Increment 8. Inspection of `src/app/router/index.tsx` confirmed that this route was **never created** in the React application. It has now been correctly marked as missing and scheduled.
2. **Dynamic Group Candidates vs Unified User Directory:**
   - In earlier reports, training group member selection was assumed to use a shared user directory. Source inspection revealed that `inMemoryStore.ts` currently uses a hardcoded synthetic cohort (`getCandidateTrainees()`). Increment 11 will integrate this with the central User Store.
3. **Course Authoring Team and WhatsApp Contacts:**
   - Multi-author collaboration (`team` in `builder.js`) and dynamic WhatsApp support contacts configuration were discovered in legacy code but not present in the React Course Builder. These have been cataloged in the Parity Matrix for PO alignment.
4. **Offline Course ZIP Packaging:**
   - `JSZip` client-side course packaging in `course.js:1125` was identified as an unmigrated feature. Documented as a candidate for post-Increment 11 backend service integration.
5. **Exact Controller Line Numbers:**
   - Replaced generic controller references with exact file paths and line numbers grounded in actual workspace files (`admin.js:5903` lines, `lecturer.js:1674` lines, `course.js:1570` lines, `builder.js:2024` lines).
