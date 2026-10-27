# Increment 8 — Course Builder & Lecturer Workspace
## Implementation & Verification Checklist

**Target Milestone:** Milestone 3 (Dashboards, Authoring & Quality Assurance)  
**Modern Routes Implemented:**  
- `/lecturer/courses` (Lecturer Workspace & Assigned Courses Hub)  
- `/lecturer/builder/:courseId` (Course Builder & Curriculum Authoring Suite)  
- `/lecturer/builder/new` (New Course Initialization)  
- `/builder` and `/builder/:courseId` (Redirect Aliases)  
**Status:** **COMPLETED & VERIFIED (100% Tests Passing, Zero Lint Errors, Clean Build)**  

---

## 1. Confirmed Requirements & Baseline Verification

- [x] **Increment 7 Approved Baseline Review:**
  - [x] Confirm role-adaptive dashboards (`/dashboard`) for Trainee, Lecturer, and Admin remain fully operational.
  - [x] Confirm Trainee Courses (`/my-courses`) with sorting, progress, and expired-course policies remain intact.
  - [x] Confirm Trainee Groups (`/my-groups`, `/my-groups/:groupId`) and 403 Forbidden access guards remain intact.
  - [x] Confirm Notification Center (`/notifications`) with zero polling and unread badge sync remains intact.
  - [x] Confirm Training Groups Carousel on dashboard with arrow browsing and card links remains functional.
  - [x] Confirm all automated tests across all test suites pass with zero regressions.
- [x] **Legacy Prototype Behavior Analysis (`js/builder.js`, `js/lecturer.js`, `js/course.js`):**
  - [x] Modernized course authoring into modular React 19 architecture without legacy prototype dependencies.
  - [x] Replaced legacy 3-step wizard with modern lightweight creation modal and direct builder access.
  - [x] Implemented chapter and lesson hierarchy manipulation, reordering, and modal confirmations.
  - [x] Implemented multi-format content support (`video`, `pdf`, `image`, `powerpoint`, `docx`, `zip`, `audio`, `other`).
  - [x] Implemented client-side file size validation, 0-byte rejection, and metadata handling.
  - [x] Replaced legacy course listing with accessible, responsive Lecturer Workspace (`/lecturer/courses`).
- [x] **Architecture Transition Principles:**
  - [x] Modernized legacy DOM string interpolation into modular, typed React 19 components.
  - [x] Replaced raw JSON mutations with MSW v2 mock endpoints and typed services (`builderApi`).
  - [x] Abstracted storage and download policies cleanly in client-side models and utilities.
  - [x] Maintained 100% Arabic-first RTL alignment, local Cairo typography, centralized design tokens, and semantic icon registry.

---

## 2. Lecturer Workspace & Course Access (`/lecturer/courses`)

- [x] **Route Registration & Guarding:**
  - [x] Registered `/lecturer/courses` in `src/app/router/index.tsx` within protected `AppLayout`.
  - [x] Added route aliases `/builder` and `/builder/:courseId` redirecting to the lecturer suite.
  - [x] Enforced role guarding: Allowed `lecturer` and `admin` roles; strictly blocked `user` (trainee) role with Arabic 403 Forbidden alert and action button.
  - [x] Updated `src/shared/config/navigation.ts` marking `course-builder` as `status: 'implemented'` with `path: '/lecturer/courses'`.
- [x] **Assigned Courses Query & Filtering:**
  - [x] Queries courses where `lecturerId === user.id`, `lecturerName === user.name`, or `coLecturers.includes(user.name)`.
  - [x] Allows administrators to view and manage all system courses.
  - [x] Supports filter tabs:
    - [x] **الكل** (All assigned courses)
    - [x] **منشورة ومفعلة** (Published / Live courses)
    - [x] **مسودات قيد الإعداد** (Draft courses)
    - [x] **قيد المراجعة** (Pending Review courses)
  - [x] Supports live text search across course title and ID.
- [x] **Course Management Cards:**
  - [x] Renders course thumbnail with Cairo brand fallback gradient.
  - [x] Displays course title, ID badge, and status pill (`مسودة`, `ينتظر المراجعة`, `منشور`).
  - [x] Shows `مسودة غير منشورة` badge when a published course has separate unpublished draft edits.
  - [x] Displays curriculum statistics: chapter count, total lesson count, enrolled trainees count.
  - [x] Primary action button: **تعديل في المنشئ** (Edit in Builder) navigating to `/lecturer/builder/:courseId`.
  - [x] Secondary action button: **معاينة** (Preview) navigating to `/courses/:courseId?preview=true`.
- [x] **Workspace Header & Initialization Action:**
  - [x] Header banner with title: "مساحة عمل المحاضر والمدرب المعتمد".
  - [x] Primary action button: **+ إنشاء مقرر جديد** (Create New Course) opening creation modal.
- [x] **State Handling:**
  - [x] Loading skeleton cards during data fetching.
  - [x] Empty state with call-to-action button when lecturer has zero courses in selected filter.
  - [x] Error alert with retry action on failure.

---

## 3. Course Builder Route & Layout Architecture (`/lecturer/builder/:courseId`)

- [x] **Route Definition & Authorization Enforcement:**
  - [x] Registered `/lecturer/builder/:courseId` and `/lecturer/builder/new` in `src/app/router/index.tsx`.
  - [x] Strict ownership authorization:
    - [x] Administrators have full editing authority across all courses.
    - [x] Lecturers can only edit courses they own or co-lecture.
    - [x] Non-owner lecturers receive accessible Arabic 403 screen ("غير مصرح لك بتعديل هذا المقرر").
    - [x] Trainees are blocked with clear security banner.
- [x] **Top Authoring Bar & Sticky Header:**
  - [x] Back button to `/lecturer/courses` with confirmation prompt if form has unsaved changes.
  - [x] Course title heading and course ID badge.
  - [x] Status badge (`مسودة` [Draft], `ينتظر الاعتماد` [Pending Review], `منشور` [Published]).
  - [x] Unsaved changes badge (`تعديلات غير محفوظة`) when form is dirty.
  - [x] Action buttons:
    - [x] **معاينة الدورة** (Preview Course) — Opens course in preview mode.
    - [x] **حفظ كمسودة** (Save as Draft) — Commits changes to mock store.
- [x] **Progressive Disclosure Tabbed Layout:**
  - [x] **البيانات الأساسية** (Tab 1: Basic Information & Course Metadata)
  - [x] **هيكل المنهج والمحتوى** (Tab 2: Curriculum Structure & Lesson Items)
  - [x] **سياسات التنزيل والملفات** (Tab 3: Download Policies & Archive Rules)
- [x] **Confirmation Modals & Dialogs:**
  - [x] Modal dialog confirming chapter deletion ("هل أنت متأكد من حذف هذا الفصل بجميع دروسه نهائياً؟").
  - [x] Modal dialog confirming lesson deletion ("هل أنت متأكد من حذف هذا الدرس؟").
  - [x] Navigation protection on dirty form with `beforeunload` warning.
  - [x] Local backup recovery banner when recovering unsaved drafts from `localStorage`.

---

## 4. Course Metadata Editing

- [x] **Editable Fields Implementation:**
  - [x] **عنوان المقرر (Course Title):** Text input, required, minimum 5 characters with live length validation.
  - [x] **وصف المقرر (Description):** Textarea for curriculum overview and training objectives.
  - [x] **المستوى التدريبي (Course Level):** Interactive level selector pills (`مبتدئ`, `متوسط`, `متقدم`).
  - [x] **المدة التقديرية (Estimated Duration):** Numeric input in hours.
  - [x] **صورة الغلاف (Thumbnail / Cover):** Image upload input with local preview and fallback brand gradient.
  - [x] **الوظائف المستهدفة (Target Job Titles):** Dynamic tag/chip manager (add and delete job titles).
  - [x] **المقرر السابق المطلوب (Prerequisite Course):** Dropdown selector choosing from published catalog courses.
- [x] **Immutable & System-Managed Fields (Read-Only):**
  - [x] Course ID (`id` e.g. `CRS001`): Strictly immutable in UI and mock store.
  - [x] Created date, rating, enrollment count displayed in read-only system identity bar.
- [x] **Published Snapshot Preservation:**
  - [x] Modifying an already published course preserves the live snapshot in `this.courses` for catalog and trainees.
  - [x] Modified draft is saved separately in `this.courseDrafts`, with `hasDraftChanges: true` flagged on the published record.

---

## 5. Chapter and Lesson Management

- [x] **Chapter-Level Authoring Operations:**
  - [x] **إضافة فصل جديد (Add Chapter):** Inline creation form generating unique chapter ID.
  - [x] **تعديل عنوان الفصل (Edit Chapter Title):** In-place title editing.
  - [x] **حذف الفصل (Delete Chapter):** Action triggering destructive confirmation modal.
  - [x] **إعادة ترتيب الفصول (Reorder Chapters):** Up/Down arrow buttons adjusting `order` sequentially.
- [x] **Lesson / Item-Level Authoring Operations:**
  - [x] **إضافة درس جديد (Add Lesson):** Button opening `ItemEditorModal`.
  - [x] **معرّف الدرس الفريد (Stable Unique Item ID):** Auto-generated unique item ID.
  - [x] **تعديل عنوان الدرس (Edit Lesson Title):** Text input with validation.
  - [x] **تحديد نوع المحتوى (Select Content Type):** Visual selector pills with badges indicating in-app learning vs. downloadable file.
  - [x] **حذف الدرس (Delete Lesson):** Action triggering destructive confirmation modal.
  - [x] **إعادة ترتيب الدروس (Reorder Lessons):** Up/Down buttons adjusting sequence within the parent chapter.
- [x] **Curriculum Hierarchy State Integrity:**
  - [x] Empty course state with guidance banner.
  - [x] Empty chapter state with guidance prompt.
  - [x] Chapter and lesson sequence indices recalculated cleanly upon deletion or reordering.

---

## 6. Training Content Types & Learning Viewer Rules

- [x] **Supported In-App Learning Types:**
  - [x] **Video:** Plays in `VideoPlayer` with duration, playback sync, and 90% completion threshold.
  - [x] **PDF:** Opens in `DocumentViewer` with reading timer. No manual page-count field, no page-count badge.
  - [x] **Image:** Opens in new `ImageViewer` component with zoom/scale and explicit user confirmation completion button.
- [x] **Downloadable Resources (Non-Viewer Types):**
  - [x] PowerPoint (`powerpoint`), Word (`docx`), ZIP (`zip`), Audio (`audio`), and Other (`other`) are treated as downloadable resources rather than rendering in-app viewers.
- [x] **PDF Page Count Elimination:**
  - [x] No manual page-count field in builder form.
  - [x] Removed page-count badge from `DocumentViewer`, `CurriculumSidebar`, and course content lists.

---

## 7. File Validation and Metadata Extraction

- [x] **Client-Side File Validation:**
  - [x] Validates MIME type and extension per selected content type.
  - [x] Rejects 0-byte (empty) files immediately with Arabic alert ("عذراً، الملف المحدد فارغ (0 بايت)").
  - [x] Enforces size limits per type (Video: 100MB, PDF/PowerPoint/Audio: 25MB, Images: 5MB, Attachments: 20MB).
  - [x] Displays clear Arabic error alert with exact limit exceeded.
- [x] **Metadata Extraction:**
  - [x] Extracts `originalFileName`, `fileSizeBytes`, and `mimeType`.
  - [x] Automatically extracts video duration in `MM:SS` format via temporary `<video>` element.

---

## 8. Download Policies & ZIP Generation

- [x] **Whole-Course ZIP Policy:**
  - [x] `disabled`: Downloading entire course archive is disallowed.
  - [x] `immediate`: Available immediately for enrolled trainees.
  - [x] `after_course_completion`: Available only after course is completed 100%.
- [x] **Individual Content Download Policy:**
  - [x] `never`: Disallowed from download (instructors can protect video lectures).
  - [x] `immediate`: Available immediately for enrolled trainees.
  - [x] `after_item_completion`: Available after the lesson item is completed.
  - [x] `after_course_completion`: Available after the entire course is completed.
- [x] **Archive & Item Policy Separation:**
  - [x] Items with policy `never` are strictly excluded from the whole-course ZIP archive.
  - [x] Archive generation checks both archive policy and individual item policies.
- [x] **Functional In-Memory ZIP Generator Prototype:**
  - [x] Pure TypeScript in-memory uncompressed ZIP generator (`createZipBlob` in `src/core/utils/zipGenerator.ts`).
  - [x] Generates 100% valid `.zip` binary archive compatible with all standard unzip tools.
  - [x] Explicit handling of available vs. unavailable files with user guidance.

---

## 9. Draft State, Preview, and Save Behavior

- [x] **Course Lifecycle States:**
  - [x] `draft`: Active authoring mode, hidden from catalog.
  - [x] `pending_admin`: Awaiting administrative review.
  - [x] `published`: Live in catalog.
- [x] **Save Operations:**
  - [x] Explicit "حفظ كمسودة" (Save as Draft) commits to `inMemoryStore`.
  - [x] Preserves published snapshots when editing live courses.
  - [x] Automatic local backup in `localStorage` (`metro_builder_draft_:courseId`) with recovery notification banner.
- [x] **Unsaved Changes Tracking:**
  - [x] Detects dirtiness between active state and initial snapshot.
  - [x] Shows `تعديلات غير محفوظة` badge in sticky header.
  - [x] Alerts user before navigating away via `beforeunload` and back button prompt.

---

## 10. Mock API and Domain Model

- [x] **Type Definitions (`src/core/courses/types.ts`):**
  - [x] Expanded `ContentItemType` to include `'video' | 'pdf' | 'image' | 'powerpoint' | 'docx' | 'zip' | 'audio' | 'other'`.
  - [x] Added `ItemDownloadPolicy` and `CourseZipPolicy` types.
  - [x] Added `originalFileName`, `fileSizeBytes`, `mimeType`, `uploadedAt` to `ChapterItem`.
  - [x] Added `courseZipPolicy`, `hasDraftChanges`, `draftUpdatedAt` to `Course`.
- [x] **MSW v2 API Handlers (`src/mocks/handlers/builderHandlers.ts`):**
  - [x] `GET /api/lecturer/courses`
  - [x] `GET /api/lecturer/courses/:courseId`
  - [x] `POST /api/lecturer/courses`
  - [x] `PUT /api/lecturer/courses/:courseId/draft`
  - [x] Registered in `server.ts` and `browser.ts`.
- [x] **`inMemoryStore` Methods (`src/mocks/store/inMemoryStore.ts`):**
  - [x] `getLecturerCourses(user)`
  - [x] `getCourseForEditing(courseId, user)`
  - [x] `createCourse(data, user)`
  - [x] `saveCourseDraft(courseId, draftData, user)`
  - [x] `isAuthorizedLecturer(course, user)`

---

## 11. UI, Accessibility, and Design System Compliance

- [x] **Design Tokens & Typography:**
  - [x] 100% Arabic-first RTL alignment with Cairo font typography.
  - [x] Used design-system color tokens (`primary`, `surface`, `border`, `text-heading`, `text-muted`).
  - [x] Semantic icons from `ICON_REGISTRY` exclusively; zero raw emojis.
- [x] **Accessibility (WCAG 2.1 AA):**
  - [x] Accessible form labels with explicit `htmlFor`.
  - [x] Keyboard focus visible rings on all interactive elements.
  - [x] Accessible dialogs with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- [x] **Responsive Layout:**
  - [x] Responsive layout across Desktop and Mobile viewports.

---

## 12. Quality Gates & Verification Protocol

- [x] **Automated Tests:**
  - [x] 197 out of 197 tests passing across all 18 test suites (`npm run test`).
  - [x] Dedicated test suite for Lecturer Workspace (`src/test/lecturer-workspace.test.tsx` — 6 tests passed).
  - [x] Dedicated test suite for Course Builder (`src/test/course-builder.test.tsx` — 14 tests passed).
  - [x] Dedicated test suite for Course Builder Additions (`src/test/course-builder-additions.test.tsx` — 13 tests passed).
  - [x] Dedicated test suite for YouTube Player Stability & Controls (`src/test/youtube-player.test.tsx` — 8 tests passed).
- [x] **Static Analysis:**
  - [x] ESLint passed with 0 errors and 0 warnings (`npm run lint`).
- [x] **Production Bundle Build:**
  - [x] TypeScript compilation and Vite build succeeded with 0 errors (`npm run build`).
- [x] **Browser Subagent Visual Verification:**
  - [x] Verified login as Lecturer.
  - [x] Verified Lecturer Workspace listing, search, and status tabs.
  - [x] Verified Course Creation Modal and new course creation.
  - [x] Verified Course Builder 3 tabs (Metadata, Curriculum, Download Policies).
  - [x] Verified adding chapters, lessons, and draft saving toast.
  - [x] Verified strict access denial when logged in as Trainee (403 Forbidden).
- [x] **Legacy Files Integrity:**
  - [x] Verified zero modifications to legacy prototype files (`app.html`, `js/*.js`, `data/*.json`).

---

## 13. Additional Requirements (Increment 8 Additions)

- [x] **1. Multiple Course Prerequisites:**
  - [x] Implemented independent **Knowledge Prerequisites** (`knowledgePrerequisites?: string[]`):
    - [x] Lecturers enter free-text requirements (e.g. "أساسيات لغة جافا", "مفاهيم قواعد البيانات SQL").
    - [x] Rendered as interactive, removable tag chips with inline editing and deletion.
    - [x] Distinct in data model from course prerequisites; non-blocking advisory tags for trainees.
  - [x] Implemented independent **Prerequisite Courses** (`prerequisiteCourseIds?: string[]`):
    - [x] Multi-course selection from available catalog courses without arbitrary 1-course restriction.
    - [x] Individual removal chips with course badge and title.
    - [x] Synchronized with legacy single `prerequisiteCourseId` field for backward compatibility.
  - [x] Displayed both categories distinctly in `CourseDetailPage` with navigation links.

- [x] **2. Optional Course Cover Image and Color:**
  - [x] Supported 3 distinct cover presentation modes (`image`, `color`, `default`).
  - [x] Image upload, preview, replacement, and explicit removal action.
  - [x] Removing custom image cleanly falls back to brand color or default gradient without leaving broken images or empty containers.
  - [x] Curated 8-color palette using centralized Cairo Metro brand design tokens (`#003366`, `#1E3A8A`, `#1E293B`, `#065F46`, `#0F766E`, `#831843`, `#78350F`, `#581C87`).
  - [x] Applied dynamic cover styling to `CourseHero` banner in course details.
  - [x] Clearly communicated browser local storage limitations to the lecturer.

- [x] **3. External Video Sources (YouTube & Google Drive):**
  - [x] Extended `ChapterItem` with `videoSourceType: 'upload' | 'youtube' | 'drive'`.
  - [x] **YouTube:**
    - [x] Supported all standard URL formats (`watch?v=`, `youtu.be/`, `embed/`, `shorts/`).
    - [x] Extracted YouTube video ID and validated URLs in real-time.
    - [x] Embedded via `YouTubePlayer` using the official YouTube IFrame Player API.
    - [x] **Playback Lifecycle & Stability (Bug Fix Verified):**
      - [x] Implemented singleton API loader (`youtubeApiLoader.ts`) preventing duplicate script tags and safely chaining ready callbacks.
      - [x] Resolved React VDOM reconciliation collisions by isolating YouTube DOM mount points inside an unmanaged container node.
      - [x] Stabilized callback references (`onComplete`, `onLocalProgressUpdate`) and initial position via refs, eliminating unnecessary player re-instantiations and periodic pauses during progress updates.
      - [x] Preserved single player instance during sustained playback and ordinary React state updates.
    - [x] **Native Player Controls Restoration:**
      - [x] Passed standard options (`controls: 1`, `enablejsapi: 1`, `fs: 1`, `playsinline: 1`, `disablekb: 0`, `rel: 0`, `iv_load_policy: 3`).
      - [x] Applied responsive CSS rules (`width: 100% !important; height: 100% !important; border: 0`) preventing clipping of bottom control bar.
      - [x] Verified full visibility and operation of Play/Pause, Seek bar, Volume/Mute, Fullscreen, Settings/Quality, and Captions.
      - [x] Confirmed external notice badge is non-blocking (`pointer-events-none`) in top-right corner without obscuring controls.
    - [x] Synced playback state changes with progress tracking and 90% completion rule.
    - [x] Graceful fallback error state with direct YouTube link when embedding is restricted (error codes 101, 150, 100, 2).
    - [x] Created dedicated automated test suite (`src/test/youtube-player.test.tsx` — 8 tests passed).
  - [x] **Google Drive:**
    - [x] Extracted Drive file ID from sharing links and converted to `/preview` iframe URL.
    - [x] Did not assume cross-origin playback tracking for sandboxed Drive iframes.
    - [x] Implemented explicit user confirmation action button ("تأكيد المشاهدة والإكمال") to document completion.
    - [x] Clear warning in builder regarding Drive sharing permissions ("Anyone with the link").
  - [x] **Source-Aware Download Behavior:**
    - [x] Locked download policy to "never" for external videos in `ItemEditorModal`.
    - [x] Prevented external video links from appearing as downloadable LMS files.
    - [x] Strictly excluded external video streams from in-memory ZIP archive generation.
    - [x] Displayed explicit non-downloadable notice in Download Policies matrix.

- [x] **4. QR Code for Every Course:**
  - [x] Implemented pure TypeScript zero-dependency QR code generator (`qrGenerator.ts`, ISO/IEC 18004 Model 2).
  - [x] Generates clean SVG preview and high-resolution 1024px PNG downloadable image.
  - [x] Encodes canonical direct course URL (`${window.location.origin}/courses/${courseId}`).
  - [x] Never hardcodes localhost or development port.
  - [x] Reusable `QRCodeModal` accessible from:
    - [x] Lecturer Workspace course cards (`LecturerCoursesPage`).
    - [x] Course Builder sticky authoring header (`CourseBuilderPage`).
    - [x] Course Hero header in Course Details (`CourseDetailPage`).
  - [x] Preserves authentication and publication access rules upon scanning.
  - [x] Provides single-click "Copy Course Link" with clipboard feedback.

- [x] **5. External Learning Resources (Course & Lesson Level):**
  - [x] Two completely independent collections:
    - [x] Course-level resources (`Course.externalResources`).
    - [x] Lesson-level resources (`ChapterItem.externalResources`).
  - [x] Support required title, validated HTTP/HTTPS URL (rejects unsafe schemes), optional description, semantic icon selection, and stable IDs.
  - [x] Edit, delete, and reorder (`▲` / `▼`) controls in `ExternalResourcesEditor`.
  - [x] Independent QR code generation for each individual resource encoding its external URL.
  - [x] Trainee-facing presentation (`ExternalResourcesList`):
    - [x] Clean resource cards with semantic icons, titles, domains, and descriptions.
    - [x] "فتح المورد" direct action button with `target="_blank" rel="noopener noreferrer"`.
    - [x] Dedicated course-level presentation in `CourseDetailPage`.
    - [x] Dedicated lesson-level presentation in `LearningPlayerPage`.

- [x] **6. Data Model, Draft Compatibility & Quality Verification:**
  - [x] Preserved backward compatibility with legacy single `prerequisiteCourseId` and existing course fixtures.
  - [x] Seamless integration with `localStorage` backup (`metro_builder_draft_:courseId`) and MSW `inMemoryStore`.
  - [x] Preserved published snapshot protection (saving draft does not overwrite live version).
  - [x] Created comprehensive automated test suite `src/test/course-builder-additions.test.tsx` (13 tests passing).
  - [x] Full test run passes (all 33 course builder tests passing).
  - [x] `npm run lint` passes with 0 errors and 0 warnings.
  - [x] `npm run build` succeeds cleanly.

---

## 14. Content Editor Live Preview (Additive UX Improvement)

- [x] **1. Live File Previews Before Confirmation:**
  - [x] **Video:** Embedded HTML5 `<video>` preview with native playback controls and duration indicator.
  - [x] **PDF:** Embedded PDF document viewer `<iframe>` rendering the actual document via object URL.
  - [x] **Image:** Embedded `<img>` element with smooth container sizing and aspect ratio preservation.
  - [x] **Downloadable Resources (Non-Viewer Types):**
    - [x] Displayed clean `downloadable-summary-card` for PowerPoint (`.pptx`), Word (`.docx`), ZIP (`.zip`), Audio (`.mp3`), and Other (`.other`).
    - [x] Displays filename, human-readable format badge, file size in MB, and semantic file icon.
    - [x] Explicitly communicates that this file type is for direct trainee download and browser preview is intentionally unavailable without inventing fake viewers.
  - [x] **Cover Image Preview:** Course cover image and lesson attachment preview behavior remain fully intact.

- [x] **2. External Video Previews (YouTube & Google Drive):**
  - [x] **YouTube:**
    - [x] Reuses `YouTubePlayer` component in dedicated `previewMode`.
    - [x] Renders lecturer authoring badge ("معاينة المحاضر (وضع التحرير)").
    - [x] Renders native YouTube player controls with zero playback interruptions.
    - [x] Validates YouTube URLs in real-time before attempting preview.
  - [x] **Google Drive:**
    - [x] Reuses `GoogleDrivePlayer` component with `previewMode` support.
    - [x] Shows invalid link alert when an unsupported URL is entered.
    - [x] Renders live `/preview` iframe with authoring preview status bar (`drive-preview-info-bar`).
    - [x] Clearly handles embedding restrictions and permissions notice.

- [x] **3. Separation of Preview from Confirmation:**
  - [x] **Done/Save:** Validates item title and inputs, then commits pending item to the course draft.
  - [x] **Cancel / Close:** Discards all pending selections and object URLs, preserving existing lesson item unchanged.
  - [x] **Change File/URL:** Replaces active preview immediately and revokes obsolete object URLs.
  - [x] **Edit Existing Item:** Leaves original draft untouched until explicit save is confirmed.

- [x] **4. Zero Progress Side Effects (Trainee Progress Decoupled):**
  - [x] `previewMode?: boolean` prop added to `YouTubePlayer` and `GoogleDrivePlayer`.
  - [x] Progress interval polling and time updates strictly bypassed in preview mode.
  - [x] Trainee completion action button ("تأكيد المشاهدة والإكمال") replaced with authoring preview bar.
  - [x] Editor previews never mark lessons complete, update trainee progress, or trigger celebration modals.

- [x] **5. Resource & Memory Safety:**
  - [x] Local file previews use temporary browser `URL.createObjectURL(file)`.
  - [x] Tracked via `createdObjectUrlRef` and strictly revoked via `URL.revokeObjectURL(url)`.
  - [x] Revocation triggered on:
    - [x] Selection replacement (new file chosen).
    - [x] Explicit file removal (clicking delete file button).
    - [x] Modal cancellation or close (`handleCancel`).
    - [x] Modal unmount (`useEffect` cleanup return).
  - [x] Explicit messaging that previewing a file does not mean it has been permanently uploaded to a server.

- [x] **6. Automated Acceptance Testing & Quality Gates:**
  - [x] Created `src/test/content-editor-preview.test.tsx` covering all 11 acceptance criteria:
    - [x] Video preview with controls before save.
    - [x] PDF iframe preview.
    - [x] Image preview.
    - [x] Downloadable summary card for unsupported formats with clear limitation text.
    - [x] YouTube preview stage with authoring badge.
    - [x] Google Drive preview with invalid link handling.
    - [x] Selection replacement and object URL revocation.
    - [x] Save commits item to draft.
    - [x] Cancel discards pending changes and preserves original item.
    - [x] Zero trainee progress side effects.
    - [x] Modal unmount memory cleanup.
  - [x] All 11 tests pass (208 total tests passing across entire LMS test suite).
  - [x] `npm run lint` passes with 0 errors and 0 warnings.
  - [x] `npm run build` succeeds cleanly.
  - [x] Real browser verification completed using browser subagent with WebP recording saved.

---

## 15. Basic Information Tab UI/UX Refinement (Section Cards Layout)

- [x] **1. Polished Section Cards Architecture:**
  - [x] Replaced long continuous form with distinct white section cards (`bg-white rounded-2xl border border-border p-6 shadow-xs`).
  - [x] Established subtle contrast between pure white cards and the light neutral page background canvas (`bg-surface/35`).
  - [x] Maintained consistent rounded corners (`rounded-2xl`), low-contrast borders (`border-border`), and comfortable internal padding (`p-6`).
  - [x] Established clear vertical rhythm with `space-y-6` between adjacent cards.
  - [x] Standardized section headers with semantic Lucide icons in soft cyan badges (`bg-primary/10 text-primary`), bold titles, and explanatory subtitles.

- [x] **2. Logical Section Grouping (Sections A through E):**
  - [x] **Read-Only System Identity Bar:**
    - [x] Elevated identity card (`data-testid="system-identity-bar"`) displaying Course ID badge, lecturer name, enrollment count, and course rating.
  - [x] **Section A — Basic Course Information (`data-testid="section-basic-info"`):**
    - [x] Semantic icon: `fileText`.
    - [x] Course title input (`builder-title-input`) with required indicator and live length validation.
    - [x] Course description textarea (`builder-desc-input`) with readable multi-line sizing and placeholder.
  - [x] **Section B — Level, Duration, and Target Audience (`data-testid="section-audience-level"`):**
    - [x] Semantic icon: `users`.
    - [x] Interactive level selection pills (`builder-level-مبتدئ`, `builder-level-متوسط`, `builder-level-متقدم`) with accent selected state.
    - [x] Estimated duration numeric input (`builder-hours-input`, min 1, max 200).
    - [x] Target roles/jobs chip manager with clean wrapping and "+ إضافة فئة" action (`builder-job-title-input`, `builder-add-job-title-btn`).
  - [x] **Section C — Prerequisites (`data-testid="prerequisites-section"`):**
    - [x] Semantic icon: `bookOpen`.
    - [x] Single major section card containing two distinct, internally-separated subsections:
      - [x] **Knowledge and Skill Prerequisites:** Free-text tag chips (`knowledge-prereq-chips`), inline editing, removal, and add form (`knowledge-prereq-input`, `add-knowledge-prereq-btn`) with advisory non-blocking explanatory note.
      - [x] **Subtle Internal Divider:** Low-contrast separator (`border-t border-border/70`) creating clear visual structure.
      - [x] **Required Previous Courses:** Multi-select course selector (`builder-prereq-select`, `add-prereq-course-btn`), selected course chips with ID badges and removal, and direct-enrollment empty state.
  - [x] **Section D — Course Cover and Visual Identity (`data-testid="cover-settings-section"`):**
    - [x] Semantic icon: `palette`.
    - [x] Segmented mode switcher (`cover-mode-image-btn`, `cover-mode-color-btn`, `cover-mode-default-btn`) with active accent styling.
    - [x] Proportionate live cover preview box (`cover-preview-box`) with Cairo Metro Star emblem overlay branding.
    - [x] Contextual controls: Custom image upload and removal (`cover-image-controls`), curated 8-color brand palette (`cover-color-controls`), and default cover guidance notice (`cover-default-notice`).
  - [x] **Section E — Course-Level External Learning Resources (`data-testid="course-resources-section"`):**
    - [x] Semantic icon: `externalLink`.
    - [x] Embedded `ExternalResourcesEditor` with independent QR Code generation and direct linking.
    - [x] Clean presentation and empty state clearly distinguished from cover configuration.

- [x] **3. RTL Alignment & Responsive Layout Integrity:**
  - [x] Verified 100% Arabic-first RTL alignment: section headers, icon placements, chips, and inputs align right-to-left.
  - [x] Verified mobile viewport (390x844): cards adapt gracefully, multi-column grids collapse to 1 column without horizontal overflow.
  - [x] Verified desktop viewport (1280px+): comfortable 2-column and 3-column splits where appropriate.

- [x] **4. Quality Gates & Regression Verification:**
  - [x] All 208 automated tests passing across 19 test files (`npm test -- --run`).
  - [x] ESLint passed with 0 errors and 0 warnings (`npm run lint`).
  - [x] TypeScript compilation and production Vite build succeeded cleanly (`npm run build`).
  - [x] Real browser verification completed using browser subagent with WebP recording saved (`basic_info_section_cards_1792296749054.webp`).

---

## 16. Persistent Media Storage (IndexedDB) & Dedicated Content Testing Lab (`CRS_TEST_LAB`)

- [x] **1. Local Browser Media Persistence Architecture (IndexedDB):**
  - [x] Created `mediaStorageService.ts` backed by browser IndexedDB database (`metro_lms_media_db`, store `media_assets`).
  - [x] Stored raw `Blob` or `File` binary bytes alongside unique `mediaId`, MIME type, file size, and timestamps.
  - [x] Seamless in-memory fallback for environments where IndexedDB is disabled or in private browsing modes.
  - [x] Object URL lifecycle management (`createMediaObjectUrl` & `revokeMediaObjectUrl`) ensuring memory safety and preventing leaks.
  - [x] Handled storage quota errors (`QUOTA_EXCEEDED`) with clear Arabic guidance.
  - [x] Handled missing media records gracefully with Arabic fallback warning instead of silent crashes.
  - [x] Added prominent frontend storage boundary notice (`تنبيه تخزين الملفات محلياً`) in the Item Editor Modal clarifying that files are stored in the current browser only.

- [x] **2. Course Builder & Learning Player Integration:**
  - [x] `ItemEditorModal.tsx` synchronously generates stable `mediaId` and persists raw file bytes on local selection.
  - [x] Preserves `mediaId` and `originalFileName` in `ChapterItem` model upon saving drafts.
  - [x] Recreates valid Object URLs upon reopening modal or opening lessons in the Learning Player.
  - [x] Properly clears `mediaId` when a file is replaced or removed.
  - [x] `LearningPlayerPage.tsx` dynamically resolves `currentItem.mediaId` via `mediaStorageService` and passes active stream to `VideoPlayer`, `DocumentViewer`, and `ImageViewer`.
  - [x] Draft preservation across page reloads: saved drafts for testing lab preserved in `localStorage` (`metro_lms_lab_course_state`) and restored seamlessly.

- [x] **3. Dedicated Demo Course: Content Testing Lab (`CRS_TEST_LAB`):**
  - [x] Fixture created in `contentLabFixture.ts` titled **"معمل تجربة المحتوى — للاختبار فقط"** with `isTestLab: true`.
  - [x] All 6 representative testing scenarios configured under Chapter 1:
    - [x] **Scenario 1:** Local MP4 video with custom duration and initial playback state.
    - [x] **Scenario 2:** Verified YouTube video fixture (`M7lc1UVf-VE`) with embedded player and direct link fallback.
    - [x] **Scenario 3:** Exact Google Drive link (`https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/view?usp=drive_link`) with transparent access error handling and external preview button.
    - [x] **Scenario 4:** Local PDF document ("دليل تشغيل القطار").
    - [x] **Scenario 5:** Local illustrative image ("مخطط المسار والكبائن").
    - [x] **Scenario 6:** Downloadable ZIP package ("حزمة البرمجيات والملفات المساعدة") with download policy badge.
  - [x] Course-level and lesson-level external learning resources configured.

- [x] **4. Lab Isolation & Reset Safeguards:**
  - [x] Excluded from public trainee catalog (`getCourses()`).
  - [x] Blocked trainee direct enrollment (`enrollUser()` returns 403 Forbidden).
  - [x] Visible and accessible to authorized lecturer (`usr_lect_002`) and system administrators in `/lecturer/courses` under "الكل" and "منشورة ومفعلة" tabs with `معمل اختبار` badge.
  - [x] Course Builder header displays `معمل تجريبي` badge and explicit `إعادة ضبط المعمل` action button.
  - [x] Reset button confirms with dialog, resets in-memory mock store and localStorage draft to pristine fixture state, and invalidates cached media safely.
  - [x] Never resets automatically or silently on ordinary page reloads.

- [x] **5. Usability & Quality Assurance Gates:**
  - [x] Normal left-click interaction preserved across all views; zero global overlays or pointer interception.
  - [x] 15 comprehensive unit & integration tests added in `src/test/persistent-media-storage.test.tsx`.
  - [x] Vitest test suite passes with 100% success: **223 passed tests across 20 test files**.
  - [x] ESLint passes with 0 errors and 0 warnings (`npm run lint`).
  - [x] TypeScript compilation and production Vite build succeed cleanly (`npm run build`).
  - [x] Real browser verification completed using browser subagent with recordings saved (`test_lab_direct_verify_1792312159648.webp`).


