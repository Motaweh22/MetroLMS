# MetroLMS — Canonical Domain & Business Rules Specification

> **Document Status:** `ACTIVE — AUTHORITATIVE`
> **Canonical Scope:** Domain entities, 6-tier role hierarchy, 3-layer permissions model, Assistant Admin `Rule A` and approval workflow, Course versioning (`Rule B`), multi-source enrollment provenance (`D-07`), per-attempt progress and versioned certificates (`D-12`, `D-13`), post-deadline policies, user/lecturer deletion cascades (`D-01`–`D-03`, `D-11`), notifications/discussions, and Training Groups & Reminder Programs (`D-GRP-01`–`D-GRP-08`).
> **Last Updated:** 2026-11-11
> **Consolidates & Supersedes:** Domain rule descriptions previously scattered across `docs/frontend/authorization-and-permissions-design.md`, `docs/frontend/implementation-roadmap-increment-11.md`, `docs/frontend/implementation-roadmap-increment-12.md`, and `docs/backend/pre-backend-migration-remediation-roadmap.md`.

---

## 1. Six-Tier Role Hierarchy & Account Protection (`MFR-37`, `MFR-38`)

MetroLMS enforces a strict 6-tier role hierarchy:

| Tier | Role Identifier | Arabic UI Label (`MFR-17`) | Operational Scope |
| :---: | :--- | :--- | :--- |
| **0** | `developer` | `مطور النظام` (`المطور`) | Hidden system maintainer (`INV-R8`). Full unrestricted diagnostic and administrative access; executes directly without approval; sole role permitted to manage `super_admin` accounts (`INV-R2`) and use Dev Role Switcher, Visual Role Preview, and Isolated Role Test Sessions in `import.meta.env.DEV` (`D-10`). |
| **1** | `super_admin` *(also referred to as `Superior`)* | `المسؤول الأعلى` | **Highest normal administrative role (Owner Clarification `2026-11-13`, `D-04/OD-01`, `D-05/OD-02`).** Inherits **all** `admin` capabilities, executes directly without approval, and is the **only non-Developer role** that can appoint/assign/create/edit/suspend/activate/permanently delete `admin` accounts (`INV-R3`). Can view peer `super_admin` accounts in read-only mode (`OD-01`), but cannot mutate peer `super_admin` (`INV-R2`) or discover/manage `developer`. *(Reconciled `2026-11-13`: supersedes earlier erroneous `"superior = read-only observer"` text that misgeneralized `OD-01` peer read-only visibility.)* |
| **2** | `admin` | `مدير النظام` | Operational System Administrator. Full organizational authority over courses, groups, enrollments, certificates, approvals, `assistant_admin` accounts (`D-05/OD-02`), `lecturer` / `trainee` accounts, and individual user permission overrides (`UserPermissionOverride` within `ROLE_CAPABILITY_CEILINGS`); executes directly without approval. **Cannot** appoint, create, edit, suspend, activate, or delete `admin`, `super_admin`, or `developer` accounts (`INV-R1`–`INV-R5`). |
| **3** | `assistant_admin` | `مساعد مدير` (`مدير النظام المساعد`) | **Global read visibility (`Rule A` + `D-14`)** across non-Developer users, groups, courses, enrollments, and Security Audit logs. **Group-scoped write authority (`INV-R7`)** restricted to assigned groups (`GroupAssistantAssignment`), with state-changing mutations gated by `INV-R9` (`202 Accepted`) unless an active `DelegatedAuthority` bypass covers the exact capability. |
| **4** | `lecturer` | `محاضر` | Creates and manages own courses (`authorId === actor.id`) with authoring override, oversees assigned groups (`primaryInstructorId`, `assistantLecturerIds` via `GroupAssistantAssignment`, `supervisorIds` — contextual assignments, not separate roles), grades submissions, moderates course discussions, and views analytics for assigned/authored courses. |
| **5** | `trainee` *(stored value: `user`)* | `متدرب` | Consumes enrolled courses, submits quizzes and assignments, participates in discussions, and downloads earned certificates. |

### Protected Admin Flag (`isProtectedAdmin`)
- Any `admin` account with `isProtectedAdmin: true` (the primary Founding Admin) cannot be deleted, deactivated, or demoted by any actor, including `developer` or peer `admin` accounts (`INV-R4`).

---

## 2. Three-Layer Capability & Permission Resolution (`authorization-and-permissions-design.md` + `MFR-05`/`MFR-06`)

Authorization for every capability (`PermissionKey`) is resolved deterministically through three layers:

1. **Layer 1 — Role Capability Ceiling (`ROLE_CAPABILITY_CEILINGS`):** Hard upper bound of capabilities permitted for a role. No override can grant a capability outside the role's ceiling.
2. **Layer 2 — Role Default Permissions (`ROLE_DEFAULT_PERMISSIONS`):** Baseline capabilities active for the role when no custom override exists.
3. **Layer 3 — Per-User Permission Overrides (`UserPermissionOverride`) & Group Scope (`GroupAssistantAssignment`):**
   - Explicit `allow` / `deny` overrides configured by an `Admin` (bounded by Layer 1).
   - For `assistant_admin`, write capabilities additionally require that the target entity belongs to a group in the assistant's active `GroupAssistantAssignment` set (`allowedGroupIds`).

### Assistant Admin Global Read Visibility (`Rule A` & `D-14`)
- **Read Scope (`Rule A`):** `assistant_admin` has read visibility into all non-Developer users, groups, courses, enrollments, and **Audit / Activity Logs (`D-14`)** so they can diagnose cross-group dependencies and enrollment provenance.
- **Write Scope (`INV-R7`):** `assistant_admin` can only mutate memberships, enrollments, or progress for trainees/groups within their assigned `GroupAssistantAssignment` scope.

---

## 3. Sensitive Action Approval Workflow (`MFR-35`, `MFR-36`, `MFR-44`)

### 3.1 Default Approval Requirement (`INV-R9`)
When an `assistant_admin` initiates a high-impact action (`user_delete`, `group_delete`, `enrollment_remove`, `grade_override`, `certificate_revoke`, `course_unpublish`), the system checks whether an explicit bypass flag is active for that assistant/group:
- **Default (`requiresApproval = true`):** The mutation is **not** executed immediately. Instead, a `PendingApprovalRequest` is created with status `'PendingApproval'`, and the API/store returns a `202 Accepted` envelope containing `{ status: 'PendingApproval', approvalRequestId, message }`.
- **Bypass Enabled (`requiresApproval = false`):** The mutation executes immediately (`200 OK`) and logs an audit entry recording the active bypass configuration.

### 3.2 Approval Lifecycle & Re-Validation (`INV-R10`)
- **State Machine:** `PendingApproval` $\rightarrow$ `Approved` $\rightarrow$ `Executed` (or `ExecutionFailed`), `PendingApproval` $\rightarrow$ `Rejected`, `PendingApproval` $\rightarrow$ `Cancelled` (by requester), or `PendingApproval` $\rightarrow$ `Expired`.
- **Execution-Time Re-Validation (`INV-R10`):** When an `Admin` approves a request, the execution engine re-verifies that the target entity still exists, the requester's scope was valid, and no role invariants (`INV-R1`–`INV-R8`) are violated.
- **Dual Audit Attribution (`MFR-09`):** Executed actions record both `requestedByUserId` (the `assistant_admin`) and `approvedByUserId` / `executedByUserId` (the `admin`).

---

## 4. Courses, Drafts & Curriculum Versioning (`Rule B`, `MFR-02`, `MFR-32`, `MFR-41`)

### 4.1 Course Lifecycle States
- Courses transition through `Draft` $\rightarrow$ `Published` $\rightarrow$ `Archived`.
- Only `Published` courses are visible to enrolled trainees.

### 4.2 Curriculum Versioning (`Rule B`)
When a lecturer or admin edits a `Published` course:
1. **Metadata-Only / Minor Edits:** Updating title, description, thumbnail, or fixing typos in existing lesson text preserves the current `curriculumVersion` and does not reset trainee progress.
2. **Structural / Major Curriculum Edits (`Rule B`):** Adding/removing/reordering graded lessons, changing quiz pass thresholds, or publishing a new curriculum revision increments `curriculumVersion` (`v1` $\rightarrow$ `v2`):
   - **Already-Completed Trainees:** Retain their `Completed` status and earned certificate pinned to the `curriculumVersion` (`v1`) under which they completed the course (`D-13`).
   - **In-Progress Trainees:** Can continue or reconcile against the updated structure according to the version migration rules in Phase 6 (`MFR-32`).
   - **Re-Enrollment / New Attempt:** Creates a new `CourseAttempt` pinned to the latest `curriculumVersion` (`v2`) without overwriting historical attempts.

---

## 5. Multi-Source Enrollment Provenance & Group Removal (`D-07`, `MFR-33`)

A trainee's enrollment in a course tracks **all grant sources** via `EnrollmentSource`:
- `'direct'` — Individually assigned by an Admin, Assistant Admin, or self-enrolled.
- `'group'` — Granted automatically because the trainee is a member of one or more groups (`sourceGroupIds: string[]`) assigned to that course.

### Group Removal Resolution (`D-07`)
When a trainee is removed from Group $G$ (or Group $G$ is unassigned from Course $C$):
1. Remove $G$ from the enrollment's `sourceGroupIds`.
2. **Retain Enrollment:** If the enrollment still has `direct === true` OR at least one remaining group in `sourceGroupIds`, the trainee's active enrollment and progress remain intact.
3. **Deactivate Access Only (Never Hard-Delete Progress):** If no grant sources remain (`direct === false` and `sourceGroupIds.length === 0`), the enrollment status transitions to `'Inactive'` / `'RevokedByGroupRemoval'`. All historical `LessonProgress`, `QuizAttempt`, and `Certificate` records are preserved so that re-enrolling restores prior progress.

---

## 6. Per-Attempt Progress, Rounding & Versioned Certificates (`D-12`, `D-13`, `MFR-10`, `MFR-46`)

1. **Per-Attempt Progress Isolation (`MFR-46`):** `LessonProgress` and `QuizAttempt` records are scoped to `(userId, courseId, attemptNumber)` so multiple attempts never collide.
2. **Completion Percentage Rounding (`D-12`):**
   - Progress percentages are rounded to the nearest integer (`Math.round((completedLessons / totalLessons) * 100)`).
   - **Strict 100% Gate:** A course is never marked `100%` / `Completed` unless `completedLessons === totalLessons` and all mandatory quizzes/assignments meet passing criteria (e.g., `99.6%` displays as `99%`, never `100%`).
3. **Versioned Certificates (`D-13`):**
   - Earned certificates store `courseVersion`, `attemptNumber`, `issuedAt`, `verificationCode`, and snapshot metadata (`courseTitleSnapshot`, `traineeNameSnapshot`).
   - Subsequent course edits or re-enrollments never mutate or invalidate a previously issued certificate (unless explicitly revoked by an Admin with an audit reason).

---

## 7. Deadlines, Post-Deadline Policy & Attention Heuristic (`D-04`, `D-05`, `D-06`, `MFR-24`)

### 7.1 Post-Deadline Policy (`postDeadlinePolicy`)
Each course/enrollment supports two configurable post-deadline behaviors once `dueDate < now` and the trainee has not completed the course:
- **`'hide'`:** The course is locked/hidden from the trainee's active learning view after the deadline passes unless an Admin/Assistant Admin grants a deadline extension.
- **`'keep_no_cert'`:** The trainee retains read and completion access to the course lessons after the deadline, **but completing the course after `dueDate` does NOT auto-issue a certificate** (`certificateEligible = false`).

### 7.2 Trainee Attention Heuristic (`checkTraineeAttention`)
A trainee enrollment is flagged as **Needs Attention** (`needsAttention: true`) when any of the following hold:
- **Overdue (`D-04`):** `now > dueDate` and status is not `Completed`.
- **Approaching Deadline with Low Progress (`D-05`):** Fewer than `7` days remain before `dueDate` and `progressPercent < 50%`.
- **Stalled Inactivity (`D-06`):** Enrolled for more than `14` days with `progressPercent < 25%` and no lesson activity in the last `7` days.

---

## 8. User & Lecturer Deletion Cascade Rules (`D-01`, `D-02`, `D-03`, `D-11`, `MFR-23`, `MFR-42`)

1. **Trainee / User Deletion Cascade (`D-01`, `D-02`):**
   - Deleting a user removes their active group memberships, active session state, pending notifications, and mutable draft states.
   - **Audit & Historical Integrity (`D-02`):** Audit log entries (`ActivityLogEntry`) and issued certificate verification records preserve anonymized/snapshot actor attribution (`actorNameSnapshot`, `deletedUserId`) rather than breaking foreign keys or erasing compliance history.
2. **Lecturer Deletion Reassignment (`D-03`, `D-11`):**
   - Deleting a `lecturer` account **never cascades to delete their authored courses**.
   - Instead, the deletion workflow requires either:
     - Reassigning authored courses to another active `lecturer` or `admin` (`newAuthorId`), OR
     - Preserving the courses under system/admin ownership while retaining `originalAuthorNameSnapshot` (`D-11`).

---

## 9. Discussions, Comment Moderation & Notifications (`D-08`, `D-09`, `MFR-18`, `MFR-34`, `MFR-43`)

1. **Comment & Discussion Moderation (`MFR-18`):**
   - Course lecturers (for their own courses) and Admins (globally) can hide, unhide, or delete inappropriate discussion posts and comments, recording a moderation audit log entry.
2. **Notification Deduplication & Action Routing (`D-08`, `MFR-34`):**
   - Automated and manual nudges deduplicate within a configurable cooldown window so trainees are not spammed by repeated clicks.
   - Every notification includes a validated internal route target (`actionUrl`) that navigates directly to the relevant course, approval item, or discussion thread.
3. **WhatsApp Nudge Formatting (`D-09`):**
   - Phone numbers are normalized to E.164 digits (`wa.me/<digits>?text=<encodedMessage>`) with Arabic message templates populated from trainee and course context.

---

## 10. Training Groups, Reminder Programs & In-Place Renewal (`D-GRP-01`–`D-GRP-08`)

1. **In-Place Group Identity Across Renewals (`D-GRP-01`, `D-GRP-04`):**
   - Recurring reminder programs retain their stable `TrainingGroup.id`, name, and enrollment code across renewals.
   - When renewal executes (manual or automated), the system appends a new `GroupRenewalCycle` (`CYC-<groupId>-<NN>`) to the group rather than cloning successor groups.
   - The prior cycle transitions to `status: 'completed'`; historical `CourseAttempt`s in the closing cycle are sealed (`isSealed: true`), preserving historical progress, attendance, and version-scoped certificates (`D-13`).
2. **Day-Based Recurrence Anchoring (`D-GRP-02`):**
   - Recurrence intervals are strictly day-based (`intervalDays` $\in [1, 730]$ days, e.g. 30, 60, 90, 180, 365).
   - The next renewal date is calculated from the active cycle's deadline date: $\text{NextDate} = \text{CycleDeadline} + N\text{ calendar days}$.
3. **Immediate Mixed-Course Group Classification (`D-GRP-03`, `D-GRP-05`):**
   - A training group is classified as a Reminder Program (`groupType: 'reminder'`) immediately upon the assignment of $\ge 1$ course with `courseRole === 'reminder'`, without waiting for renewal cycles to execute.
   - Groups with only `courseRole === 'core'` are classified as Regular (`groupType: 'regular'`).
   - The trainee UI presents a dual badge contract: a group-level badge `برنامج تذكيري` and a per-course badge `مقرر تذكيري`, while core courses remain clearly identified as `دورة أساسية`.
4. **Authoritative Trainee Count Semantics:**
   - Group-level enrolled trainee count is strictly derived from `group.traineeIds.length` (excluding lecturers, supervisors, and assistant administrators).
   - Removed members are immediately excluded from `group.traineeIds` and from active counts, even if they retain continuation grants (`D-07`).
5. **Persistent Reminder Classification (`D-GRP-06`):**
   - A training group remains classified as a Reminder Program (`groupType: 'reminder'`) after the removal of its last currently assigned reminder-designated course, provided its history contains a reminder-designated course assignment.
   - Assigning a course with `courseRole === 'reminder'` immediately establishes the group's reminder classification.
   - Removing the last reminder-designated course from current assignments does NOT automatically downgrade the group to `regular`.
   - Historical renewal-cycle assignments retain their original course roles.
   - The group's reminder classification remains recoverable even after the current reminder course assignment is removed via a monotonic historical marker (`hasHistoricalReminderCourses: true`).
   - Core and reminder course roles remain individually identifiable within current and historical cycles. A reminder group may contain only core courses in its current cycle while still remaining a reminder group because of its history.
6. **Exclusion of Administratively Archived Groups from Trainee Groups Page (`D-GRP-07`):**
   - Groups with `adminStatus === 'archived'` are completely excluded from the trainee Groups API response (`GET /api/groups/my`), the persistent carousel, the detailed groups table, and all summary counts (`إجمالي المجموعات والبرامج`, `المجموعات النشطة`, `البرامج المجدولة`).
   - No optional archived filter or tab is provided on the trainee groups page.
   - All historical cycles, attempts, progress records, and certificates remain preserved; historical certificates remain accessible through `/my-certificates`.
   - Administrative archiving is strictly distinct from deadline expiration: expired but non-archived groups remain visible according to standard post-deadline access policies. Direct navigation to `/my-groups/:id` for an archived group fails closed.
7. **Compact Course Presentation in the Persistent Carousel (`D-GRP-08`):**
   - The persistent carousel renders compact course representations (short codes / compact pill badges distinguishing reminder vs. core courses) alongside the prominent group name and group-level `برنامج تذكيري` badge.
   - Large stacked course names and verbose badges are avoided in the carousel cards to keep card height concise.
   - Full course titles and explicit dual badges (`دورة أساسية` / `مقرر تذكيري`) are preserved in the detailed groups table and the group details view.
   - Visual styling strictly adheres to Metro Courses design tokens without emojis.

