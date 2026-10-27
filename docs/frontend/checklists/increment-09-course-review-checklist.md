# Increment 9 — Review & Quality Audit Workflow
## Implementation & Verification Checklist

**Target Milestone:** Milestone 3 (Dashboards, Authoring & Quality Assurance)  
**Modern Routes Implemented:**  
- `/approvals` (Role-Adaptive Approvals Dashboard: Lecturer Tracking & Admin Approval Queue)  
- `/admin/review/:courseId` (Administrative Course Review Studio & Quality Audit Suite)  
- Canonical Redirect Aliases:  
  - `/audit` → `/approvals`  
  - `/admin/approvals` → `/approvals`  
  - `/admin/approvals/:courseId` → `/admin/review/:courseId`  
**Status:** **IMPLEMENTED & VERIFIED (All 8 Phases, External Resources Diff & Admin Editing Workflow Complete)**  

---

## 1. Scope, Boundaries & Strict Exclusions

- [ ] **Implementation Boundaries & Charter:**
  - [ ] Implement administrative course review, granular audit feedback, staged content editing, and approval workflow.
  - [ ] Implement lecturer approvals dashboard, active review feedback consumption, contextual chapter/item feedback, and before/after comparison viewer.
  - [ ] Maintain 100% Arabic-first RTL layout, local Cairo typography, centralized design tokens, and typed icon registry.
  - [ ] Zero changes to legacy prototype source files (`js/review.js`, `js/builder.js`, `server.py`).
  - [ ] Zero browser automation by Antigravity (no browser subagents or automated screenshots; all visual verifications reserved exclusively for the user).
- [ ] **Explicitly Deferred Issues & Out-of-Scope Items:**
  - [ ] **Known Limitation:** Do *not* expand the scope to fix the separately known hard-refresh limitation of `eligibleViewingSeconds` (documented in Increment 6).
  - [ ] **Training Groups:** Group scheduling, trainee assignments, and deadline attention monitors remain strictly deferred to Increment 10.
  - [ ] **Certificates:** Automated certificate generation, verification, and PDF issuance remain strictly deferred to Increment 11.
  - [ ] **Real-Time Collaboration:** Multi-reviewer simultaneous live presence or WebSocket collaborative cursors are excluded; concurrency is handled via optimistic revision tokens and 3-way rebasing.

---

## 2. Canonical Routes, Navigation, Role Guarding & Authorization Architecture

- [ ] **Canonical Route Registration & Redirect Aliases (`src/app/router/index.tsx`):**
  - [ ] `/approvals`: Accessible to authenticated `admin` and `lecturer` roles within `AppLayout`. Strictly blocks `user` (trainee) role with Arabic 403 Forbidden screen.
  - [ ] `/admin/review/:courseId`: Accessible exclusively to authenticated `admin` role within `AppLayout`. Strictly blocks `lecturer` and `user` roles with Arabic 403 Forbidden screen.
  - [ ] **Exact Canonical Redirect Aliases:**
    - [ ] `/audit` → `/approvals`
    - [ ] `/admin/approvals` → `/approvals`
    - [ ] `/admin/approvals/:courseId` → `/admin/review/:courseId`
- [ ] **Navigation & Shell Configuration (`src/shared/config/navigation.ts`):**
  - [ ] Update `approvals` navigation item: mark `status: 'implemented'` with `path: '/approvals'`.
  - [ ] Role-adaptive visibility: Visible in sidebar/navbar for `admin` and `lecturer`; hidden from trainees.
  - [ ] Dynamic pending badge: Show pending review counter badge for admins when pending queue $> 0$.
- [ ] **Layered Defense-in-Depth Authorization:**
  - [ ] **Route Guard Layer:** `ProtectedRoute` validates role credentials prior to mounting page components.
  - [ ] **UI Component Layer:** Review action buttons, staged edit controls, and decision modal triggers render exclusively when current user has `role === 'admin'`.
  - [ ] **MSW Request Handler Layer:** Mock API endpoints inspect `user.role` from request session; reject unauthorized requests with HTTP 403 Forbidden.
  - [ ] **Mock Store Layer:** `inMemoryStore` methods assert `user.role === 'admin'` on administrative operations and ownership on lecturer operations; throw typed `MockStoreError(403)` on violation.

---

## 3. Domain Data Contracts, DTOs & Privacy Boundaries

- [ ] **Three-Way Data Separation:**
  - [ ] **1. Private Reviewer Working Notes (`ReviewerWorkingNotes`):**
    - [ ] Scoped by reviewer (`reviewerId`), course (`courseId`), and granular hierarchy (`generalNote`, `chapterNotes`, `itemNotes`).
    - [ ] Dedicated persistence across browser sessions: stored per reviewer in `localStorage` (`metro_reviewer_notes_${reviewerId}_${courseId}`) and mirrored in mock store.
    - [ ] Strictly invisible to lecturers at all times; endpoint/store checks block non-admin access with 403 Forbidden.
    - [ ] Creating, updating, or deleting private notes must *never* generate audit log events or mutate course records.
    - [ ] Can be converted into official lecturer-facing feedback *only* via an explicit, confirmed user action.
  - [ ] **2. Official Lecturer-Facing Feedback (`CourseActiveReviewFeedback`):**
    - [ ] Formal structured feedback delivered to the lecturer upon course return or rejection.
    - [ ] Consists of overall decision message, return timestamp, reviewer identity, and optional itemized chapter/lesson notes (`ReviewFeedbackItem[]`).
    - [ ] Can be drafted manually or imported from private notes *only* via an explicit user confirmation step ("تحويل الملاحظات الخاصة إلى تغذية راجعة رسمية").
    - [ ] Never automatically sent without explicit reviewer confirmation.
  - [ ] **3. Staged Administrator Content Edits (`StagedAdminEditsRecord`):**
    - [ ] Actual content modifications applied by administrators to course metadata or curriculum.
    - [ ] Maintained separately from reviewer feedback and private working notes.
    - [ ] Persisted across browser reloads via `localStorage` (`metro_admin_staged_edits_${courseId}`) and `inMemoryStore`.
    - [ ] **Post-Rejection Disposition:** Never silently committed upon course rejection (Outcome C); retained as stale staged edits (`isStale: true`) or discarded only via explicit administrator discard action.
- [ ] **Authoritative Domain Model Definitions (`src/core/courses/types.ts`):**
  - [ ] `ReviewOutcome`:
    ```typescript
    export type ReviewOutcome = 'approved' | 'returned_with_admin_edits' | 'rejected';
    ```
  - [ ] `CourseAuditAction`:
    ```typescript
    export type CourseAuditAction =
      | 'submitted'
      | 'approved'
      | 'rejected'
      | 'resubmitted'
      | 'returned_with_admin_edits';
    ```
  - [ ] `ReviewFeedbackItem`:
    ```typescript
    export interface ReviewFeedbackItem {
      targetType: 'course' | 'chapter' | 'item';
      targetId: string; // Course ID, Chapter ID, or Lesson Item ID
      title?: string;
      comment: string;
      severity: 'required' | 'suggestion' | 'note';
    }
    ```
  - [ ] `CourseActiveReviewFeedback`:
    ```typescript
    export interface CourseActiveReviewFeedback {
      outcome: ReviewOutcome;
      reviewerId: string;
      reviewerName: string;
      reviewedAt: string; // ISO 8601
      summaryMessage: string;
      items: ReviewFeedbackItem[];
      stagedEditsApplied?: boolean;
    }
    ```
  - [ ] `CourseBaselineSnapshot`:
    ```typescript
    export interface CourseBaselineSnapshot {
      id: string;
      title: string;
      description: string;
      level: CourseLevel;
      estimatedHours: number;
      coverType?: 'image' | 'color' | 'default';
      coverColor?: string;
      thumbnail?: string;
      targetJobTitles?: string[];
      prerequisiteCourseId?: string | null;
      courseZipPolicy?: CourseZipPolicy;
      chapters: CourseChapter[];
      capturedAt: string; // ISO 8601
      submittedAt?: string;
    }
    ```
  - [ ] `CourseAuditLogEntry`:
    ```typescript
    export interface CourseAuditLogEntry {
      id: string;
      courseId: string;
      action: CourseAuditAction;
      actorId: string;
      actorName: string;
      actorRole: 'admin' | 'lecturer';
      timestamp: string; // ISO 8601
      summary: string;
      approvalNote?: string; // Optional official note recorded on approval
      feedback?: CourseActiveReviewFeedback;
      baselineSnapshot?: CourseBaselineSnapshot;     // Submitted state (captured on Return with Admin Edits)
      adminEditedSnapshot?: CourseBaselineSnapshot;  // Admin-edited state (captured on Return with Admin Edits)
    }
    ```
  - [ ] `ReviewerWorkingNotes`:
    ```typescript
    export interface ReviewerWorkingNotes {
      courseId: string;
      reviewerId: string;
      generalNote: string;
      chapterNotes: Record<string, string>; // chapterId -> note
      itemNotes: Record<string, string>;    // itemId -> note
      lastSavedAt: string;
    }
    ```
  - [ ] `AdminStagedEditPayload`:
    ```typescript
    export interface AdminStagedEditPayload {
      baselineId: string;
      baselineSubmittedAt: string;
      clientRevision: number;
      patch: Partial<Course>;
    }
    ```
  - [ ] `StagedAdminEditsRecord` (and alias `StagedEditsRecord`):
    ```typescript
    export interface StagedAdminEditsRecord {
      courseId: string;
      baselineId: string;
      baselineSubmittedAt: string;
      clientRevision: number; // Incrementing integer token
      patchedContent: Partial<Course>;
      lastSavedAt: string;
      savedByAdminId: string;
      isStale?: boolean; // Set true after rejection or resubmission until explicitly resumed/discarded
    }
    export type StagedEditsRecord = StagedAdminEditsRecord;
    ```
  - [ ] Extend `Course` entity with:
    - [ ] `submittedAt?: string;`
    - [ ] `activeReviewFeedback?: CourseActiveReviewFeedback | null;`
    - [ ] `auditLog?: CourseAuditLogEntry[];`
    - [ ] `isUpdatePendingApproval?: boolean;`
    - [ ] `lastEditedByAdminId?: string;`
    - [ ] `lastEditedByAdminName?: string;`
    - [ ] `adminEditedAt?: string;`
- [ ] **Authoritative Review DTOs:**
  - [ ] `SubmitCourseRequestDTO`, `SubmitCourseResponseDTO`
  - [ ] `ReviewQueueItemDTO`, `ReviewQueueResponseDTO`
  - [ ] `StagedEditsSaveRequestDTO`, `StagedEditsSaveResponseDTO`
  - [ ] `ReviewDecisionRequestDTO`, `ReviewDecisionResponseDTO`
  - [ ] `ConflictRebaseResultDTO`

---

## 4. Dual-Case Lifecycle State Machine

- [ ] **Case A — New or Returned Unpublished Course:**
  - [ ] **Preconditions for Submission:**
    - [ ] Course must exist in `inMemoryStore.courses`.
    - [ ] Authoritative status must be `status === 'draft'`.
    - [ ] May have previously been returned/rejected (with `activeReviewFeedback`), or undergoing first-time submission.
    - [ ] Current user must be authorized lecturer or admin.
  - [ ] **State Transition on Submission / Resubmission:**
    - [ ] Authoritative status transitions: `draft` $\rightarrow$ `pending_admin`.
    - [ ] `submittedAt` timestamp recorded (or refreshed).
    - [ ] **Submission vs Resubmission Audit Distinction:**
      - [ ] Initial course submission records `action: 'submitted'` in `course.auditLog`.
      - [ ] Resubmission of a previously returned or rejected course records `action: 'resubmitted'` in `course.auditLog`.
    - [ ] Course appears immediately in Admin Review Queue.
    - [ ] Course Builder transitions to read-only pending review banner.
- [ ] **Case B — Published-Course Update:**
  - [ ] **Preconditions for Submission:**
    - [ ] Base course must have `status === 'published'` (or `'live'`).
    - [ ] Authoritative draft record *must* exist in `courseDrafts[courseId]`.
    - [ ] **Draft Integrity Guard:** If draft is missing or invalid, reject submission with **HTTP 409 Conflict and error code `DRAFT_INTEGRITY_ERROR`**; **NEVER** silently substitute the published base course.
    - [ ] Draft content must satisfy content eligibility rules.
  - [ ] **State Transition on Submission:**
    - [ ] Base course `status` **remains `published`** uninterrupted in catalog and learner views.
    - [ ] Trainees actively enrolled continue accessing live published version without interruption.
    - [ ] Flag `isUpdatePendingApproval = true` set on base course record.
    - [ ] Base course `submittedAt` timestamp recorded (establishes submission revision identity).
    - [ ] Audit log entry recorded on base course: `action: 'submitted'` for initial update submission, or `action: 'resubmitted'` if resubmitting following a previous rejection or return.
    - [ ] Course appears in Admin Review Queue with `تحديث مقرر منشور` badge.
- [ ] **Submission Pre-Mutation Guarantee:**
  - [ ] All validations (role, status, draft existence, content eligibility) execute before state modification.
  - [ ] If any check fails, throw `MockStoreError` atomically with zero partial state mutation.

---

## 5. Authoritative Content Eligibility & Pre-Mutation Validation

- [ ] **Eligibility Business Rules (Enforced in UI, API Handler & Store):**
  - [ ] **Course Title:** Non-empty string after whitespace trimming (`title.trim().length > 0`).
  - [ ] **Course Description:** Non-empty string after whitespace trimming (`description.trim().length > 0`).
  - [ ] **Curriculum Hierarchy:** Submitted course must contain at least one chapter (`chapters.length >= 1`).
  - [ ] **Lesson Content:** Submitted course must contain at least one content lesson across its chapters (`totalLessons >= 1`).
- [ ] **Validation Points:**
  - [ ] **Course Builder UI:** Submit button disabled or presents validation errors summary modal listing missing requirements.
  - [ ] **MSW Request Handler (`POST /api/courses/:courseId/submit`):** Validates request payload/draft; returns HTTP 422 Unprocessable Entity with descriptive Arabic error if invalid; returns HTTP 409 Conflict with error code `DRAFT_INTEGRITY_ERROR` if required published-course draft is missing.
  - [ ] **Store Layer (`inMemoryStore.submitCourseForReview`):** Validates authoritative draft before applying status mutation.

---

## 6. Submission Queue Architecture & Deterministic FIFO Ordering

- [ ] **Deterministic FIFO Sort Algorithm (`GET /api/approvals/queue`):**
  - [ ] Queue items must be ordered deterministically using the following strict fallback and tie-breaking hierarchy:
    1. **Primary Sort:** Valid `submittedAt` timestamp, ascending (earliest submission first).
    2. **Fallback 1:** If `submittedAt` is missing/invalid, sort by valid `draftUpdatedAt` timestamp, ascending.
    3. **Fallback 2:** If `draftUpdatedAt` is missing/invalid, sort by valid `createdAt` timestamp, ascending.
    4. **Fallback 3:** If no valid timestamp exists across all three fields, use `0` (Unix epoch start).
    5. **Deterministic Tie-Breaker:** Break any remaining ties lexicographically by `courseId` ascending (`a.id.localeCompare(b.id)`).
- [ ] **Neutral Fallback Display for Missing Dates:**
  - [ ] If a course in the queue lacks a valid `submittedAt` timestamp, the UI date column must render the neutral Arabic label **`غير متوفر`**.
  - [ ] Under no circumstances should timestamps be fabricated or guessed in the UI.
- [ ] **Queue Query Payload & Metadata:**
  - [ ] Returns all courses requiring review: Case A (`status === 'pending_admin'`) and Case B (`isUpdatePendingApproval === true`).
  - [ ] Course ID, title, cover thumbnail/color.
  - [ ] Lecturer name and ID.
  - [ ] Submission timestamp (`submittedAt` or `null`).
  - [ ] Submission type: `جديد` (New) vs `تحديث لمقرر منشور` (Published Update).
  - [ ] Curriculum statistics: chapter count, lesson count, total duration.
- [ ] **Lecturer Submissions Query (`GET /api/approvals/my-submissions`):**
  - [ ] Filters courses owned/co-lectured by current user.
  - [ ] Categorizes items by tab:
    - [ ] **قيد المراجعة** (Pending Review: Case A pending + Case B pending update).
    - [ ] **تتطلب تعديلات** (Requires Revisions: `activeReviewFeedback` present with `returned_with_admin_edits` or `rejected`).
    - [ ] **معتمدة ومنشورة** (Approved & Published).

---

## 7. Staged Administrator Content Editing, Patch Allowlist & Session Durability

- [ ] **Staged Editing Permissions & Scope:**
  - [ ] Admin reviewer can edit course metadata and curriculum structure directly within the Review Studio without immediately publishing.
  - [ ] Edits remain *staged* (isolated) until an official decision is executed.
- [ ] **Field Allowlist (Strictly Enforced):**
  - [ ] **Permitted Fields:** `title`, `description`, `level`, `estimatedHours`, `coverType`, `coverColor`, `thumbnail`, `targetJobTitles`, `prerequisiteCourseId`, `courseZipPolicy`, `chapters` (including chapter order, title, items list, lesson title, type, duration, download policies, completion policies, external resources, mediaId).
  - [ ] **Protected / Prohibited Fields:** `id`, `lecturerId`, `lecturerName`, `coLecturers`, `rating`, `ratingCount`, `enrollmentCount`, `completionCount`, `createdAt`.
  - [ ] Handler and store reject or strip any attempt to overwrite protected fields.
- [ ] **Cumulative Patch Merging Contract:**
  - [ ] Client may send partial patch payloads or complete normalized snapshots.
  - [ ] Server/store merges each incoming patch cumulatively into existing staged edits for that course session.
  - [ ] Unrelated fields from prior saves are strictly preserved.
- [ ] **Effective Content Eligibility Validation:**
  - [ ] Every staged save validates the *effective merged course* (Baseline + Staged Edits).
  - [ ] Effective course must satisfy content eligibility rules ($\ge 1$ chapter, $\ge 1$ item, non-empty title/description).
- [ ] **Storage Tiers & Rehydration:**
  - [ ] **Memory Tier:** `inMemoryStore.stagedAdminEdits[courseId]`.
  - [ ] **Local Persistence Tier:** `localStorage.getItem('metro_admin_staged_edits_' + courseId)`.
  - [ ] **Session Restoration:** Upon mounting Review Studio, rehydrate staged edits from storage; restore latest accepted `clientRevision`. If no prior staged edits exist, initialize staging revision at 1.

---

## 8. Autosave Concurrency, Revision Tokens, HTTP 409 Conflict & 3-Way Rebase Algorithm

- [ ] **Optimistic Concurrency Control:**
  - [ ] Autosave requests transmit `AdminStagedEditPayload` (`{ baselineSubmittedAt, clientRevision, patch }`).
  - [ ] If incoming `clientRevision <= serverAcceptedRevision`, server rejects with HTTP 409 Conflict.
- [ ] **Safe 3-Way Rebase Concurrency Recovery Algorithm:**
  - [ ] *Never blindly increment revision and retry stale payloads (which would overwrite newer curriculum edits).*
  - [ ] **Step 1 — Fetch Authoritative Staged State:**
    - [ ] On HTTP 409, fetch the latest accepted staged state from server (`GET /api/admin/review/:courseId/staged-edits`).
  - [ ] **Step 2 — Three-Way Rebase Comparison:**
    - [ ] *Base:* Common baseline snapshot at start of session.
    - [ ] *Server:* Latest accepted server staged content.
    - [ ] *Local:* Administrator's pending unsaved local modifications.
  - [ ] **Step 3 — Non-Overlapping Merge:**
    - [ ] If modified fields/chapters are disjoint, merge automatically.
    - [ ] Update local state with merged result, update revision to `acceptedRevision + 1`, and trigger autosave.
  - [ ] **Step 4 — Overlapping Conflict Modal (`ConflictResolutionModal.tsx`):**
    - [ ] If concurrent edits conflict on identical fields or chapters, prompt administrator with three explicit choices:
      - [ ] **خيار 1: الإبقاء على تعديلاتي المحلية (Preserve Local Edits):** Overwrites server version with local changes; increments revision and saves.
      - [ ] **خيار 2: اعتماد نسخة الخادم الأحدث (Accept Server Version):** Discards conflicting local edits, adopts server state.
      - [ ] **خيار 3: إلغاء والمراجعة يدوياً (Cancel for Manual Review):** Keeps unsaved changes in client editor without committing.

---

## 9. The Three Distinct Review Outcomes & Decision Modal Workflows

- [ ] **Outcome A: Approve & Publish (اعتماد ونشر المقرر):**
  - [ ] **Preconditions:** Course is in review queue (`pending_admin` or published update).
  - [ ] **Explicit Administrator Approval Choice:**
    - [ ] When staged administrative content edits exist, the administrator is presented with an explicit, active choice in the Decision Modal:
      - [ ] **الخيار 1: اعتماد ونشر النسخة المقدمة كما هي (Publish Submitted Version Unchanged):** Bypasses/discards staged administrative edits and publishes the lecturer's submitted baseline.
      - [ ] **الخيار 2: اعتماد ونشر المقرر مع تعديلات الإدارة المعتمدة (Publish with Staged Administrative Edits):** Merges the cumulative staged edits over the submitted baseline into the final published course.
    - [ ] *Staged edits are NEVER merged unconditionally or implicitly.*
  - [ ] **Optional Official Approval Note:**
    - [ ] Reviewer may provide an optional official approval note (`approvalNote?: string`) recorded in the audit log and dispatched to the lecturer.
  - [ ] **Content Merge & Eligibility:**
    - [ ] If publishing with staged edits, validate final effective merged content eligibility ($\ge 1$ chapter, $\ge 1$ item, non-empty title/description).
  - [ ] **State Transitions:**
    - [ ] **Case A:** `status` transitions to `published`. Course becomes live in trainee catalog.
    - [ ] **Case B:** Base course content replaced with approved version. `isUpdatePendingApproval` cleared. `status` remains `published`. Draft in `courseDrafts` cleared.
    - [ ] Clear `activeReviewFeedback` and staged edits store.
  - [ ] **Attribution & Audit (Approval & Publication):**
    - [ ] Record audit log entry (`action: 'approved'`) including `approvalNote` if provided. Approval transitions the course to published/live status.
    - [ ] If admin edits were merged, set `lastEditedByAdminId`, `lastEditedByAdminName`, `adminEditedAt`.
    - [ ] Maintain original `lecturerId` and `lecturerName` ownership.
  - [ ] **Notifications:** Dispatch success notification to lecturer via Notification Center.
- [ ] **Outcome B: Return with Admin Edits (إعادة للمحاضر مع تعديلات الإدارة):**
  - [ ] **Preconditions:** Staged admin edits exist; reviewer enters mandatory summary feedback message.
  - [ ] **Snapshot Capture (Survives Resubmissions):**
    - [ ] Capture immutable `baselineSnapshot: CourseBaselineSnapshot`: course curriculum as submitted by lecturer.
    - [ ] Capture immutable `adminEditedSnapshot: CourseBaselineSnapshot`: course curriculum incorporating admin edits.
  - [ ] **State Transitions:**
    - [ ] **Case A:** `status` transitions to `draft`. Base course content updated with admin edits.
    - [ ] **Case B:** Base course remains `published` uninterrupted. `courseDrafts[courseId]` updated with admin edits. `isUpdatePendingApproval = false`.
    - [ ] Populate `activeReviewFeedback` with `outcome: 'returned_with_admin_edits'`, reviewer notes, and summary message.
    - [ ] Clear temporary staged edits store.
  - [ ] **Attribution & Audit:**
    - [ ] Record audit log entry (`action: 'returned_with_admin_edits'`) containing `baselineSnapshot`, `adminEditedSnapshot`, and feedback.
    - [ ] Set `lastEditedByAdminId`, `lastEditedByAdminName`, `adminEditedAt`.
    - [ ] Maintain original lecturer ownership.
  - [ ] **Notifications:** Dispatch high-priority notification to lecturer detailing required review of admin modifications.
- [ ] **Outcome C: Reject without Admin Edits (إعادة للمحاضر مع طلب تعديلات):**
  - [ ] **Preconditions:** Reviewer enters mandatory rejection feedback message (cannot be empty).
  - [ ] **Staged Edits Non-Commitment & Disposition Rule:**
    - [ ] Staged administrative content edits must **NEVER** be committed to the course or draft upon rejection.
    - [ ] Staged edits are **retained as stale staged edits** (`isStale: true`) associated with the course staging session for potential later reference/resubmission, OR can be discarded **only through an explicit user-initiated discard action** ("إلغاء مسودة تعديلات الإدارة").
    - [ ] **NEVER** silently commit staged edits upon rejection.
    - [ ] **NEVER** silently wipe or delete staged edits upon rejection without explicit reviewer discard confirmation.
  - [ ] **State Transitions:**
    - [ ] **Case A:** `status` transitions to `draft`. Original submitted content preserved.
    - [ ] **Case B:** Base course remains `published`. `courseDrafts[courseId]` preserved without admin edits. `isUpdatePendingApproval = false`.
    - [ ] Populate `activeReviewFeedback` with `outcome: 'rejected'`, reviewer items, and summary message.
  - [ ] **Attribution & Audit:**
    - [ ] Record audit log entry (`action: 'rejected'`) with feedback.
  - [ ] **Notifications:** Dispatch notification to lecturer detailing rejection reasons.

---

## 10. Admin Review Studio (`/admin/review/:courseId`) — 3-Part RTL Workspace & Side-Effect-Free Preview

- [ ] **Studio Layout Architecture (RTL Three-Pane Split):**
  - [ ] **Right Column (Column 1 — RTL First): Curriculum Navigator (`CurriculumNavigator.tsx`):**
    - [ ] Hierarchical accordion list of chapters and lesson items.
    - [ ] Lesson type icons (`video`, `pdf`, `image`, etc.) and duration badges.
    - [ ] Review progress indicators (e.g., inspected badge, attached note badge).
    - [ ] Quick selection updating active item in center preview.
  - [ ] **Center Column (Column 2): Content Preview & Workspace (`ReviewContentPreview.tsx`):**
    - [ ] Header banner with course title, ID, submission timestamp, and lecturer identity.
    - [ ] Embedded, full-fidelity lesson preview:
      - [ ] Video playback preview for MP4, YouTube, Google Drive.
      - [ ] PDF document viewer preview.
      - [ ] Image and downloadable file resource inspection.
      - [ ] Course metadata overview inspector when course root is selected.
    - [ ] In-place metadata editing toggle when administrator switches to edit mode.
  - [ ] **Left Column (Column 3): Review Inspector & Notes Box (`ReviewInspector.tsx`):**
    - [ ] Contextual inspector displaying metadata of selected chapter or lesson.
    - [ ] Private Working Notes textarea scoped to selected chapter/item or general course notes with debounced persistence.
    - [ ] Structured Feedback Composer for attaching itemized review feedback.
    - [ ] "Convert Private Notes to Official Feedback" button with confirmation modal.
    - [ ] Quick diff toggle (if staged edits exist).
    - [ ] Sticky Action Footer:
      - [ ] **اعتماد ونشر** (Approve & Publish) $\rightarrow$ Opens Decision Modal with explicit choice between submitted baseline vs staged edits, plus optional approval note.
      - [ ] **إعادة بتعديلات** (Return with Admin Edits) $\rightarrow$ Enabled if staged edits exist (Outcome B).
      - [ ] **إعادة للمحاضر** (Reject / Return for Revision) $\rightarrow$ Opens Decision Modal (Outcome C).
- [ ] **Strict Side-Effect-Free Preview Guarantees:**
  - [ ] Previewing lessons in the Review Studio must **NEVER**:
    - [ ] Write to `userProgress` store.
    - [ ] Trigger `markLessonComplete` API.
    - [ ] Increment `eligibleViewingSeconds` or update playback timestamps for any user.
    - [ ] Mutate `views`, `opensCount`, or `enrollmentCount` statistics.
  - [ ] Previews operate in sandboxed read-only inspection mode.

---

## 11. Lecturer Approvals Dashboard (`/approvals`), Builder Handoff & Dual-Snapshot Diff Viewer

- [ ] **Lecturer Approvals Experience (`/approvals`):**
  - [ ] Role-adaptive dashboard greeting lecturer with overview of submitted courses.
  - [ ] Metric cards: "قيد المراجعة" (Under Review), "تتطلب تعديلات" (Needs Revision), "معتمدة ومنشورة" (Approved).
  - [ ] Submission tracking table with status pills, submission dates (or `غير متوفر`), and direct links.
- [x] **Course Builder Feedback Integration (`/lecturer/builder/:courseId`):**
  - [x] When course has `activeReviewFeedback`, render prominent feedback banner above authoring tabs:
    - [x] Reviewer name, review date, and outcome badge.
    - [x] Reviewer summary message in Arabic.
    - [x] Action button: **عرض مقارنة تعديلات الإدارة** (View Admin Changes Diff) when `outcome === 'returned_with_admin_edits'`.
  - [x] Contextual note icons in curriculum tree indicating chapters or lessons with specific reviewer comments.
  - [x] Clicking a note opens inspector modal showing reviewer feedback for that exact item.
- [x] **Dual-Snapshot Structured Diff Viewer (`CourseDiffViewerModal.tsx`):**
  - [x] Side-by-side or unified comparison between:
    - [x] **النسخة المقدمة من المحاضر (Lecturer Baseline Snapshot: `CourseBaselineSnapshot`)**
    - [x] **تعديلات إدارة الجودة (Admin-Edited Snapshot: `CourseBaselineSnapshot`)**
  - [x] Highlights field differences:
    - [x] Course metadata changes (title, description, level, hours, cover).
    - [x] Chapter-level changes (renamed, added, reordered).
    - [x] Lesson-level changes (added lessons, modified durations, policy updates, reordered items).
  - [x] **Durable Comparison Guarantee:**
    - [x] Because snapshots are saved in `course.auditLog`, the diff remains permanently viewable even after lecturer edits and resubmits the course.

---

## 12. Audit History, Baseline Snapshots & Media Retention (IndexedDB)

- [ ] **Immutable Audit History Trail:**
  - [ ] `course.auditLog` maintains append-only chronological history of all lifecycle events.
  - [ ] Authoritative canonical events: `submitted`, `approved`, `rejected`, `resubmitted`, `returned_with_admin_edits`.
  - [ ] **Audit Boundary Guard:** Staged administrative autosaves and private reviewer working-note changes must **NEVER** generate audit events in `course.auditLog`.
  - [ ] Audit log entries survive course updates, resubmissions, and approvals.
  - [ ] Accessible in Review Studio via "سجل التدقيق والتاريخ" (Audit History) drawer.
- [ ] **Persistent Media Storage Integration (`mediaStorageService.ts`):**
  - [ ] Binary assets (`video`, `pdf`, `image`) use existing IndexedDB storage (`metro_lms_media_db`, store `media_assets`).
  - [ ] Media referenced by `mediaId` in course snapshots.
  - [ ] **Media Retention Rule:** Media referenced in any `baselineSnapshot` or `adminEditedSnapshot` within `auditLog` must **NEVER** be deleted or pruned while those snapshots exist.
  - [ ] Staged admin edits can associate newly uploaded media or retain existing media safely.

---

## 13. UI/UX Standards, Arabic RTL & Shared Component Reuse

- [ ] **Strict RTL Layout & Typography:**
  - [ ] 100% Arabic interface with RTL logical CSS properties (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`).
  - [ ] Local Cairo font typography hierarchy (`font-bold`, `text-lg`, `text-sm`, etc.).
  - [ ] Centralized color palette from `tokens.css` (primary `#1A3F6F`, accent `#5BBFDE`, verified AA contrast surfaces).
- [ ] **Icon Registry & Strict Emoji Prohibition:**
  - [ ] All icons sourced strictly from typed registry (`<Icon name="..." />`).
  - [ ] **STRICT BAN ON EMOJIS:** Zero emoji characters in code, UI strings, alerts, badges, or tests.
- [ ] **Shared Component Reuse:**
  - [ ] Reuse existing `@shared/ui` primitives: `Button`, `Card`, `Badge`, `Modal`, `FormInput`, `Alert`, `ProgressBar`.
  - [ ] No ad-hoc duplicate modals or buttons.

---

## 14. Implementation Sequence & Phased Task Checklist

### Phase 1: Core Domain Types, State Contracts & Mock Store Enhancements
- [x] Extend course domain types in `src/core/courses/types.ts`:
  - [x] `ReviewOutcome`, `CourseAuditAction`, `ReviewFeedbackItem`, `CourseActiveReviewFeedback`, `CourseBaselineSnapshot`, `CourseAuditLogEntry`.
  - [x] `ReviewerWorkingNotes`, `AdminStagedEditPayload`, `StagedAdminEditsRecord`.
  - [x] Review DTOs: `SubmitCourseRequestDTO`, `SubmitCourseResponseDTO`, `ReviewQueueItemDTO`, `ReviewQueueResponseDTO`, `StagedEditsSaveRequestDTO`, `StagedEditsSaveResponseDTO`, `ReviewDecisionRequestDTO`, `ReviewDecisionResponseDTO`, `ConflictRebaseResultDTO`.
- [x] Update `inMemoryStore.ts` with course review state structures:
  - [x] Add `this.stagedAdminEdits: Record<string, StagedAdminEditsRecord> = {}`.
  - [x] Add `this.reviewerWorkingNotes: Record<string, ReviewerWorkingNotes> = {}`.
  - [x] Implement `submitCourseForReview(courseId, user)`:
    - [x] Case A: Transitions `draft` to `pending_admin`.
    - [x] Case B: Checks `courseDrafts[courseId]`; if missing/invalid, throws `MockStoreError('DRAFT_INTEGRITY_ERROR', 409)`.
    - [x] Enforces pre-mutation content eligibility.
  - [x] Implement `getReviewQueue(user)` with deterministic 5-step FIFO ordering (`submittedAt` $\rightarrow$ `draftUpdatedAt` $\rightarrow$ `createdAt` $\rightarrow$ `0` $\rightarrow$ lexicographical `courseId`).
  - [x] Implement `saveStagedAdminEdits(courseId, payload: AdminStagedEditPayload, user)` with cumulative patch merging and `clientRevision` concurrency checks (rejects stale revisions with 409).
  - [x] Implement `getStagedAdminEdits(courseId, user)`.
  - [x] Implement `getReviewerWorkingNotes(courseId, user)` and `saveReviewerWorkingNotes(courseId, notes, user)` scoped by reviewer.
  - [x] Implement `executeReviewDecision(courseId, decisionPayload, user)`:
    - [x] Outcome A: Explicit choice between submitted baseline vs staged edits; captures optional `approvalNote`; records audit entry (`action: 'approved'`).
    - [x] Outcome B: Captures dual snapshots (`baselineSnapshot`, `adminEditedSnapshot`); updates course/draft; records audit entry (`action: 'returned_with_admin_edits'`).
    - [x] Outcome C: Retains staged edits as stale (`isStale: true`); requires feedback; records audit entry (`action: 'rejected'`) without applying staged content edits.
  - [x] Update `inMemoryStore.reset()` to clean `stagedAdminEdits`, `reviewerWorkingNotes`, and related `localStorage` keys safely.
- [x] **Acceptance Gate 1:** Vitest unit tests pass for store review state machine, validation, FIFO queue, staged edits cumulative save, and decision transitions.

### Phase 2: MSW v2 Mock API Handlers & Client Service Layer
- [x] Create `src/mocks/handlers/reviewHandlers.ts` implementing canonical endpoints, agreed route aliases, scoped deletion endpoints, and dedicated decision routes:
  - [x] `POST /api/courses/:courseId/submit` & `POST /api/courses/:courseId/submit-review` (Submission with pre-mutation validation; returns 409 `DRAFT_INTEGRITY_ERROR` on missing draft).
  - [x] `GET /api/approvals/queue` & `GET /api/admin/approvals` (Deterministic FIFO admin approval queue).
  - [x] `GET /api/approvals/my-submissions` & `GET /api/lecturer/approvals` (Lecturer submitted courses).
  - [x] `GET /api/courses/:courseId/review-data` & `GET /api/admin/courses/:courseId/review` (Authoritative review baseline, feedback, and audit history).
  - [x] `GET /api/admin/review/:courseId/staged-edits` & `GET /api/admin/courses/:courseId/staged-edits` (Fetch latest accepted staged edits and revision token).
  - [x] `PUT /api/admin/review/:courseId/staged-edits` & `PUT /api/admin/courses/:courseId/staged-edits` (Autosave staged edits with 409 conflict detection).
  - [x] `DELETE /api/admin/courses/:courseId/staged-edits` & `DELETE /api/admin/review/:courseId/staged-edits` (Explicitly discard staged edits and clear persistence without modifying course content or audit history).
  - [x] `GET /api/admin/review/:courseId/working-notes` & `GET /api/admin/courses/:courseId/working-notes` (Fetch reviewer private notes).
  - [x] `PUT /api/admin/review/:courseId/working-notes` & `PUT /api/admin/courses/:courseId/working-notes` (Save reviewer private notes).
  - [x] `DELETE /api/admin/courses/:courseId/working-notes/:targetType/:targetId` & `DELETE /api/admin/review/:courseId/working-notes/:targetType/:targetId` (Scoped working note deletion restricting targetType to general/chapter/item, general targetId to main, preserving unrelated notes, and generating zero audit events).
  - [x] `POST /api/admin/review/:courseId/decision` & `POST /api/admin/courses/:courseId/decision` (Unified review decision executing Outcomes A, B, or C).
  - [x] `POST /api/admin/courses/:courseId/approve` & `POST /api/admin/review/:courseId/approve` (Dedicated approval endpoint delegating to Outcome A).
  - [x] `POST /api/admin/courses/:courseId/return-with-edits` & `POST /api/admin/review/:courseId/return-with-edits` (Dedicated return endpoint delegating to Outcome B).
  - [x] `POST /api/admin/courses/:courseId/reject` & `POST /api/admin/review/:courseId/reject` (Dedicated rejection endpoint delegating to Outcome C).
- [x] Register `reviewHandlers` in `src/mocks/handlers/index.ts`.
- [x] Implement client service `src/features/course-review/api/reviewApi.ts` wrapping all canonical endpoints, deletion operations, and dedicated decision helpers with TypeScript DTOs.
- [x] **Acceptance Gate 2:** API integration tests verify all 11 endpoints, aliases, deletion semantics, status codes (200, 400, 403, 404, 409, 422), authorization barriers, and response schemas.

### Phase 3: Autosave Concurrency Hook & 3-Way Rebase Service
- [x] Create `src/features/course-review/hooks/useStagedEditsAutosave.ts`:
  - [x] Debounced autosave mechanism (e.g., 2000ms delay).
  - [x] Rehydrates initial revision from server or localStorage.
  - [x] Detects HTTP 409 Conflict.
- [x] Create `src/features/course-review/services/threeWayRebase.ts`:
  - [x] Performs structural 3-way merge across base, server, and local edits.
  - [x] Merges non-overlapping edits automatically and retries save with `acceptedRevision + 1`.
  - [x] Flags overlapping conflicts cleanly.
- [x] Implement `ConflictResolutionModal.tsx` for manual conflict resolution when overlapping edits occur.
- [x] **Acceptance Gate 3:** Unit tests verify 3-way rebase algorithm across non-overlapping, overlapping, and fallback scenarios.

### Phase 4: Approvals Dashboard (`/approvals`)
- [x] Implement `src/pages/ApprovalsPage.tsx` with role adaptation:
  - [x] **Lecturer View:** Submissions overview, metric cards, status tabs, and direct links to Course Builder.
  - [x] **Admin View:** Priority FIFO queue table, submission type badges, stats summary, missing date fallback (`غير متوفر`), and direct links to Review Studio.
- [x] Register route `/approvals` and exact redirect aliases in `src/app/router/index.tsx`:
  - [x] `/audit` → `/approvals`
  - [x] `/admin/approvals` → `/approvals`
  - [x] `/admin/approvals/:courseId` → `/admin/review/:courseId`
- [x] Update `src/shared/config/navigation.ts` with route status and pending review badge.
- [x] **Acceptance Gate 4:** Component tests verify role-based rendering, empty states, and queue navigation.

### Phase 5: Admin Review Studio (`/admin/review/:courseId`)
- [x] Implement `src/pages/CourseReviewPage.tsx` with 3-pane RTL workspace:
  - [x] Right Pane: `CurriculumNavigator.tsx` (Chapter/lesson hierarchy and review status).
  - [x] Center Pane: `ReviewContentPreview.tsx` (Side-effect-free video, doc, and image preview).
  - [x] Left Pane: `ReviewInspector.tsx` (Metadata inspection, private notes, feedback composer).
- [x] Implement staged editing toggle enabling admin content edits with autosave indicators.
- [x] Implement side-effect-free preview protections: verify zero mutation of learner progress or viewing time.
- [x] **Acceptance Gate 5:** Integration tests verify preview rendering, navigation, private notes isolation, and side-effect-free playback.

### Phase 6: Decision Modal & The Three Review Outcomes
- [x] Implement `src/features/course-review/components/DecisionModal.tsx`:
  - [x] Mode A: **اعتماد ونشر (Approve & Publish)**:
    - [x] When staged edits exist, presents explicit two-way choice: publish submitted baseline vs publish with staged edits.
    - [x] Optional official approval note textarea.
  - [x] Mode B: **إعادة بتعديلات الإدارة (Return with Admin Edits)**:
    - [x] Requires summary feedback; displays summary of staged edits; captures dual snapshots.
  - [x] Mode C: **إعادة للمحاضر لطلب تعديلات (Reject without Admin Edits)**:
    - [x] Requires feedback message; warns that staged content edits will not be applied and will be retained as stale staged edits.
  - [x] Private notes import prompt with explicit confirmation dialog.
  - [x] Form validation preventing submission without mandatory feedback.
  - [x] Execution and redirect back to `/approvals` with success toast.
- [x] **Acceptance Gate 6:** Tests verify all 3 outcomes, snapshot creation, audit log updates, and validation guards.

### Phase 7: Lecturer Course Builder Feedback & Dual-Snapshot Diff Viewer
- [x] Update `src/pages/CourseBuilderPage.tsx`:
  - [x] Render `ActiveReviewFeedbackBanner.tsx` when course has `activeReviewFeedback`.
  - [x] Display contextual reviewer note icons in chapter and lesson tree.
  - [x] Disable editing or warn when course is currently in `pending_admin` status.
- [x] Implement `src/features/course-review/components/CourseDiffViewerModal.tsx`:
  - [x] Renders field-level and curriculum diffs between `baselineSnapshot: CourseBaselineSnapshot` and `adminEditedSnapshot: CourseBaselineSnapshot`.
  - [x] Accessible from Course Builder banner and Review Studio audit drawer.
  - [x] External resources diff comparison at both course level and lesson level with stable identity matching and legacy snapshot fallback.
- [x] **Acceptance Gate 7:** Tests verify feedback banner, contextual note rendering, diff computation, and resubmission lifecycle.

### Phase 8: Quality Gates, Regressions & Build Verification
- [x] Run full automated test suite: verify zero regressions across existing test files (`npm test -- --run` — 36 test files, 539 tests passing).
- [x] Run ESLint: verify 0 errors and 0 warnings (`npm run lint`).
- [x] Run TypeScript compile and production build: verify clean bundle creation (`npm run build`).
- [x] Verify zero emoji characters across all project files.
- [x] Seed coherent Increment 9 review demo courses (`CRS-REV-NEW-01`, `CRS-REV-UPD-02`, `CRS-REV-RET-03`, `CRS-REV-REJ-04`, `CRS-REV-APP-05`).
- [x] **Acceptance Gate 8:** All automated quality gates pass cleanly.

---

## 15. Comprehensive Automated Testing Plan & Acceptance Gates

- [x] **Unit & State Machine Tests (`src/test/course-review-state.test.ts`):**
  - [x] Test Case A: Initial submission of draft course transitions `status` to `pending_admin`.
  - [x] Test Case B: Submission of published course keeps `status === 'published'` and sets `isUpdatePendingApproval = true`.
  - [x] Test missing-draft protection: Submitting published-course update without draft fails with HTTP 409 and error code `DRAFT_INTEGRITY_ERROR`. Published base course is never silently substituted.
  - [x] Test pre-mutation content validation: empty title, empty description, 0 chapters, or 0 lessons rejected.
  - [x] Test deterministic FIFO queue ordering:
    - [x] Sort by `submittedAt` ascending.
    - [x] Fallback to `draftUpdatedAt` when `submittedAt` is missing.
    - [x] Fallback to `createdAt` when both are missing.
    - [x] Fallback to `0` when no valid date exists.
    - [x] Tie-breaking lexicographically by `courseId`.
  - [x] Test staged edits allowlist: permitted fields saved; protected fields (`id`, `lecturerId`, etc.) rejected/stripped.
  - [x] Test cumulative staged-edit patch merge: successive saves preserve earlier staged modifications.
  - [x] Test autosave 409 conflict detection when `clientRevision <= serverAcceptedRevision`.
  - [x] Test 3-way rebase: disjoint non-overlapping changes merge cleanly; overlapping changes flag conflict.
  - [x] Test Outcome A (Approve): explicit choice between submitted baseline vs staged edits; preserves optional approval note; publishes course; clears feedback; logs audit entry (`action: 'approved'`).
  - [x] Test Outcome B (Return with Edits): saves dual snapshots (`baselineSnapshot: CourseBaselineSnapshot`, `adminEditedSnapshot: CourseBaselineSnapshot`), populates feedback, preserves ownership; logs audit entry (`action: 'returned_with_admin_edits'`).
  - [x] Test Outcome C (Reject): rejects without applying staged content edits; retains staged edits as stale; requires feedback message; logs audit entry (`action: 'rejected'`).
  - [x] Test submission audit action distinction: initial submission logs `action: 'submitted'`; resubmission after return/rejection logs `action: 'resubmitted'`.
  - [x] Test audit exclusion: private working-note edits/deletions and staged autosaves never create audit log entries.
- [x] **API Handler Tests (`src/test/course-review-api.test.tsx`):**
  - [x] Test role authorization on all review endpoints (403 for unauthorized roles).
  - [x] Test endpoint responses, status codes (200, 400, 403, 404, 409, 422), and error payloads.
  - [x] Test working notes endpoints: accessible by reviewer; 403 for lecturer.
- [x] **Component & Integration Tests (`src/test/course-review-ui.test.tsx`):**
  - [x] Test `/approvals` renders queue for admin and submissions for lecturer.
  - [x] Test missing date displays neutral label `غير متوفر`.
  - [x] Test exact canonical redirect aliases: `/audit` → `/approvals`, `/admin/approvals` → `/approvals`, `/admin/approvals/:courseId` → `/admin/review/:courseId`.
  - [x] Test `/admin/review/:courseId` renders 3-pane layout, curriculum tree, and preview.
  - [x] Test side-effect-free preview: playing video or viewing doc in review does not write to learner progress.
  - [x] Test private working notes isolation and persistence: notes persist across sessions per reviewer; do not leak to lecturer or audit log.
  - [x] Test Decision Modal validation: rejecting without feedback blocked; explicit choice between submitted vs staged edits on approval.
  - [x] Test Course Builder displays active feedback banner and contextual item notes.
  - [x] Test Diff Viewer renders structured comparisons between baseline and admin-edited snapshots.
- [x] **Regression & System Integrity Gates:**
  - [x] All automated tests pass with 100% success (actual: 542 tests across 36 test suites).
  - [x] Zero ESLint errors and warnings.
  - [x] Clean Vite production build.

---

## 16. Manual Browser Verification Protocol (Reserved Exclusively for User)

> [!IMPORTANT]
> **Strict Policy:** Antigravity must never run automated browser subagents, take screenshots, or execute automated browser clicking for this increment. The following manual verification protocol is provided for the user to perform in their own browser.

1. **Approvals Dashboard Verification (`/approvals`):**
   - Log in as Administrator (`admin@metro.gov.eg`).
   - Navigate to `/approvals`. Verify the pending queue displays courses in deterministic FIFO order with proper type badges (`جديد` vs `تحديث لمقرر منشور`).
   - Verify that courses with missing submission dates display `غير متوفر` in the date column.
   - Click "مراجعة المقرر" to enter the Review Studio.
2. **Redirect Aliases Verification:**
   - Navigate to `/audit` and `/admin/approvals` → verify automatic redirection to `/approvals`.
   - Navigate to `/admin/approvals/:courseId` → verify automatic redirection to `/admin/review/:courseId`.
3. **Review Studio 3-Pane RTL Layout (`/admin/review/:courseId`):**
   - Verify 3-pane layout: Curriculum Navigator on the right, Content Preview in the center, Review Inspector on the left.
   - Verify Arabic RTL alignment, local Cairo font, and absence of emojis.
   - Select different lessons; verify media previews load without altering learner progress or viewing counts.
4. **Private Working Notes Scoping & Persistence:**
   - Type private working notes for a specific chapter/item in the Inspector; refresh page; verify notes persist for that reviewer.
   - Test "تحويل الملاحظات الخاصة إلى تغذية راجعة رسمية" button; verify explicit confirmation modal is required.
5. **Staged Content Editing & Autosave:**
   - Enable content editing mode in Review Studio.
   - Edit course title and reorder lessons; verify autosave indicator shows saving and saved status.
   - Refresh page; verify staged edits are restored without having modified the live published course.
6. **Decision Modal & All Three Outcomes:**
   - Test Outcome C: Verify rejection requires a feedback message, does not commit staged edits, and retains staged edits as stale without silently wiping them.
   - Test Outcome B: Verify returning with admin edits creates dual snapshots and notifies lecturer.
   - Test Outcome A: Verify approval presents explicit choice between publishing submitted baseline vs publishing with staged edits, and records optional approval note.
7. **Lecturer Handoff & Diff Viewer:**
   - Log in as Lecturer (`lecturer@metro.gov.eg`).
   - Open Course Builder for the returned course.
   - Verify prominent feedback banner and contextual note icons on chapters/lessons.
   - Open Diff Viewer; verify side-by-side comparison between lecturer baseline and admin edits.
