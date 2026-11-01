# MetroLMS — Increment 3.3 Implementation Report
## Course & Review Read Visibility & Admin Preview Progress Isolation

> **Document Status:** `INCREMENT 3.3 COMPLETED — AWAITING OWNER APPROVAL`  
> **Authoritative Baseline:** MetroLMS Official Pre-Backend Migration Remediation Roadmap (Revision 5), `MFR-30`, `MFR-21`, `Rule A`, and `D-14`.  
> **Testing Directive:** Owner Directive Part A (Consolidated Phase 13 Testing Workflow). Zero test runners, compilers, linters, or builders executed. All tests marked `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

---

## 1. Executive Summary & Authoritative Principles

Increment 3.3 implements two critical Phase 3 requirements under the canonical Revision 5 Roadmap:
1. **`MFR-30` — Course & Review Read Visibility:** Extends administrative read access under `Rule A` to `assistant_admin`, `super_admin`, and `developer` across the review queue, course review data, staged admin edits, and reviewer working notes without broadening review decision or course editing mutation permissions.
2. **`MFR-21` — Admin-Class Preview Progress Isolation:** Guarantees that course preview activity by administrative or teaching accounts (`developer`, `super_admin`, `admin`, `assistant_admin`, and `lecturer`) never creates, updates, or contaminates trainee `userProgress` records or `lastWatched` indicators.

### Strict Read vs. Mutation Authorization Boundary
In strict adherence to the project guidelines:
- **Administrative read visibility does not implicitly grant mutation permissions.**
- A dedicated read helper, `canUserReadCourseReview`, was introduced to evaluate read visibility without broadening `isAuthorizedLecturer`.
- `assistant_admin` is granted read visibility to review queues, review data, and course structures for inspection purposes, but remains strictly blocked (`403 Forbidden`) from executing review decisions (approve, reject, return-with-edits), saving/discarding staged edits, modifying working notes, saving course drafts, resetting content labs, or submitting courses for review.

---

## 2. Files Changed & Purpose

| File Path | Nature of Change | Purpose |
|---|---|---|
| [`frontend/src/core/domain/progress.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/domain/progress.ts) | Implementation | Updated `isLessonLocked` to bypass sequential lesson locking during course preview for all admin roles (`developer`, `super_admin`, `admin`, `assistant_admin`) and `lecturer`, while preserving sequential locking for trainees (`user`). |
| [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) | Implementation | 1. Implemented `canUserReadCourseReview` read helper.<br>2. Preserved `isAuthorizedLecturer` strictly for operational admins and assigned course instructors.<br>3. Updated `recordLessonActivity` and `markLessonComplete` to isolate trainee progress mutations from all 5 preview roles.<br>4. Granted administrative read access in `getReviewQueue`, `getCourseReviewData`, `getStagedAdminEdits`, `getReviewerWorkingNotes`, `getLecturerCourses`, `getLecturerSubmissions`, and `getCourseForEditing`.<br>5. Restricted review decisions, staged edit mutations, and working note mutations to operational decision-makers (`admin`, `super_admin`, `developer`). |
| [`frontend/src/mocks/handlers/reviewHandlers.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/handlers/reviewHandlers.ts) | Implementation | 1. Updated read interceptors (`handleGetReviewQueue`, `handleGetAdminReviewData`, `handleGetStagedEdits`, `handleGetWorkingNotes`) to admit `assistant_admin`, `super_admin`, `developer`, and `admin`.<br>2. Enforced strict 403 Forbidden checks on review decision handlers (`handleExecuteDecision`, `handleApprove`, `handleReturnWithEdits`, `handleReject`), staged edits mutations (`handleSaveStagedEdits`, `handleDeleteStagedEdits`), and working notes mutations for `assistant_admin`. |
| [`frontend/src/test/course-review-visibility-and-preview.test.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/course-review-visibility-and-preview.test.ts) | Test Suite | Authored 20 focused integration and store tests covering review read visibility, mutation separation, course editing data access, and preview progress isolation. Marked `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`. |
| [`docs/frontend/checklists/phase-03-assistant-admin-visibility-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-03-assistant-admin-visibility-checklist.md) | Checklist | Marked Increment 3.3 deliverables completed; updated document status banner. |

---

## 3. MFR-30: Course & Review Read Visibility Implementation

### A. Dedicated Read Helper (`canUserReadCourseReview`)
To prevent the accidental expansion of course mutation privileges, `isAuthorizedLecturer` was kept strictly unbroadened. A dedicated read-visibility helper was added to `inMemoryStore`:

```ts
public canUserReadCourseReview(course: Course, user: User): boolean {
  if (!user) return false;
  const isAdministrativeReader =
    user.role === 'developer' ||
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.role === 'assistant_admin';
  if (isAdministrativeReader) return true;
  if (user.role === 'lecturer') {
    return isUserAuthorizedCourseInstructor(course, user.id);
  }
  return false;
}
```

### B. Call-Site Separation: Read vs. Mutation
- **Read Call Sites (Refactored to use `canUserReadCourseReview` or administrative reader check):**
  - `getCourseReviewData`: Uses `canUserReadCourseReview(targetCourse, user)`.
  - `getCourseForEditing`: Uses `canUserReadCourseReview(course, user)` to allow course inspection without write authority.
  - `getReviewQueue`: Permits `developer`, `super_admin`, `admin`, and `assistant_admin`.
  - `getLecturerCourses`: Returns all courses for administrative oversight to the 4 administrative roles; filters by instructor assignment for `lecturer`.
  - `getLecturerSubmissions`: Returns all submitted courses for the 4 administrative roles; filters by instructor assignment for `lecturer`.
  - `getStagedAdminEdits` & `getReviewerWorkingNotes`: Readable by the 4 administrative roles.
- **Mutation Call Sites (Strictly preserved with `isAuthorizedLecturer` or operational admin checks):**
  - `saveCourseDraft` / `updateCourseDraft`: Governed by `isAuthorizedLecturer(targetCourse, user)`. Since `assistant_admin` is not in `isAuthorizedLecturer`, mutations fail with `403 Forbidden`.
  - `resetContentLabCourse`: Governed by `isAuthorizedLecturer(targetCourse, user)`. Fails with `403 Forbidden` for `assistant_admin`.
  - `submitCourseForReview`: Governed by `isAuthorizedLecturer(targetCourse, user)`. Fails with `403 Forbidden` for `assistant_admin`.
  - `executeReviewDecision` (and dedicated approve, reject, return-with-edits endpoints): Governed by `isDecisionMaker` (`admin`, `super_admin`, `developer`). Fails with `403 Forbidden` for `assistant_admin`.
  - `saveStagedAdminEdits` & `discardStagedAdminEdits`: Governed by `isOperationalAdmin`. Fails with `403 Forbidden` for `assistant_admin`.
  - `saveReviewerWorkingNotes` & `deleteReviewerWorkingNote`: Governed by `isOperationalAdmin`. Fails with `403 Forbidden` for `assistant_admin`.

---

## 4. MFR-21: Admin-Class Preview Progress Isolation & Security Reconciliation

### A. Progress Identity & Role Source Audit Across Call Chains
A thorough static audit of progress activity and completion call chains across the entire `frontend/src` codebase revealed the following structure:
1. **Frontend UI Components (`GoogleDrivePlayer.tsx`, `CurriculumSidebar.tsx`, etc.):**
   - UI components interact with progress tracking exclusively via `learningApi.ts` HTTP service methods (`getCourseProgress`, `recordActivity`, `completeLesson`).
   - Components **never** supply `userId` or `userRole` in request bodies, query parameters, or route paths.
2. **HTTP API Client Service (`frontend/src/features/learning-player/services/learningApi.ts`):**
   - Issues `POST /api/courses/:courseId/items/:itemId/activity` (body: `RecordActivityPayload` containing only `itemId`, playback positions, and duration).
   - Issues `POST /api/courses/:courseId/items/:itemId/complete` (empty body).
   - Identity is transmitted solely via the ambient `Authorization: Bearer <token>` HTTP header injected by `apiClient`.
3. **MSW Request Handlers (`frontend/src/mocks/handlers/learningHandlers.ts`):**
   - Intercepts requests and resolves the user identity via `resolveAuthenticatedUser(request)`.
   - Verifies session tokens against `authStorage.getSession()`, checks tombstone registries, and validates against the central directory `inMemoryStore.getManagedUserById`.
   - Passes `user.id` and `user.role` to `inMemoryStore.recordLessonActivity` and `inMemoryStore.markLessonComplete`.
4. **Initial Vulnerability in Store Methods:**
   - Previous logic evaluated the effective role as:
     `const resolvedRole = userRole || this.getManagedUserById(userId)?.role;`
   - **Identified Defect 1 (Role Spoofing):** Because `userRole` was evaluated before the directory lookup, an untrusted caller could pass `userId: 'USR001'` (admin) with `userRole: 'user'`, causing `resolvedRole` to evaluate to `'user'`, completely bypassing preview isolation and contaminating the admin account with trainee records.
   - **Identified Defect 2 (Fail-Open on Unknown Users):** If a caller supplied an unresolvable ID (`'unresolvable_ghost'`) with `userRole: undefined` (or `'user'`), `getManagedUserById` returned `undefined`. `isPreviewRole` evaluated to `false`, allowing unauthenticated / arbitrary strings to write records into `this.userProgress`.

### B. Authoritative Role Resolution Mechanism (`resolveAuthoritativeProgressRole`)
To eliminate both vulnerabilities and strictly adhere to the authoritative identity model, `inMemoryStore` now implements a dedicated resolver method:

```ts
public resolveAuthoritativeProgressRole(
  userId: string,
  candidateRole?: UserRole
): {
  canonicalUserId: string;
  role: UserRole;
  isPreview: boolean;
  isAuthoritativeTrainee: boolean;
} | null
```

#### Resolution Algorithm & Enforcement:
1. **Input Validation & Normalization:** Checks that `userId` is a non-empty string; canonicalizes using `resolveCanonicalUserId(userId).toLowerCase().trim()`.
2. **Tombstone & Suspension Checks (Fail Closed):** Checks `this.isUserTombstoned` and `this.deletedUserTombstones`. If tombstoned or suspended (`status === 'suspended'`), returns `null` immediately.
3. **Authoritative Identity Discovery:**
   - Queries `this.getManagedUserById(canonicalUserId, 'developer')` (unmasked for developer persona).
   - Checks `SYNTHETIC_DEMO_ACCOUNTS` for standard demo users.
   - Checks `CONTROLLED_TEST_FIXTURE_USERS` for integration test personas.
   - Checks `authStorage.getSession()` for verified active sessions.
4. **Fail-Closed Gate:** If the user identity cannot be reliably verified against any authoritative store/directory source, it returns `null`. Both `recordLessonActivity` and `markLessonComplete` catch `null` and throw `new MockStoreError('تعذر التحقق من هوية المستخدم بشكل موثوق للوصول إلى سجلات التقدم', 401)`, preventing any progress from being created.
5. **Role Spoofing Neutralization:** Authoritative stored role **always** supersedes `candidateRole`. A caller-supplied role can never override the directory record.
6. **Preview Classification:** If the authoritative role is `developer`, `super_admin`, `admin`, `assistant_admin`, or `lecturer`, `isPreview` is set to `true`. Only canonical role `user` is classified as `isAuthoritativeTrainee`.

### C. Pre-Existing Progress & LastWatched Preservation
When an admin or lecturer account exercises `recordLessonActivity` or `markLessonComplete`:
- **No Creation:** No progress records are created in `this.userProgress` or `this.lastWatched`.
- **No Overwrite or Mutation:** If the preview actor already possessed existing progress entries (e.g., from prior testing or historical data), those entries are preserved completely unmodified. Playback positions, completion flags, and `lastWatched` pointers remain strictly identical to their initial values.
- **Simulated Safe Response:** Returns simulated progress objects so preview components render smoothly without persisting state changes.

### D. Preserved Trainee Integrity
- Trainees (`role === 'user'`) bypass the preview condition.
- Trainee activity persists playback seconds, furthest watched seconds, and eligible viewing time into `this.userProgress[canonicalUserId][normalizedCourseId][itemId]`.
- Trainee completion updates `completedItemIds`, calculates progress percent, sets `this.lastWatched[canonicalUserId][normalizedCourseId]`, and triggers completion notifications.
- Sequential lesson locking (`isLessonLocked`) remains strictly enforced for trainees, preventing skipping ahead out of order.

---

## 5. Comprehensive 6-Tier Role Authorization Matrix (Increment 3.3)

| Operation / Endpoint | `developer` | `super_admin` | `admin` | `assistant_admin` | `lecturer` | `user` (Trainee) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `GET /api/approvals/queue` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | Denied (403) | Denied (403) |
| `GET /api/courses/:id/review-data` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Assigned (200)** / Unassigned (403) | Denied (403) |
| `GET /api/admin/review/:id` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | Denied (403) | Denied (403) |
| `GET /api/admin/review/:id/staged-edits` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | Denied (403) | Denied (403) |
| `GET /api/admin/review/:id/working-notes` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | Denied (403) | Denied (403) |
| `POST /api/admin/review/:id/decision` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | Denied (403) | Denied (403) |
| `POST /api/admin/review/:id/approve` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | Denied (403) | Denied (403) |
| `POST /api/admin/review/:id/reject` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | Denied (403) | Denied (403) |
| `POST /api/admin/review/:id/return-with-edits` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | Denied (403) | Denied (403) |
| `PUT /api/admin/review/:id/staged-edits` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | Denied (403) | Denied (403) |
| `DELETE /api/admin/review/:id/staged-edits`| **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | Denied (403) | Denied (403) |
| `PUT /api/admin/review/:id/working-notes` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | Denied (403) | Denied (403) |
| `GET /api/lecturer/courses/:id` (Editor Read) | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Assigned (200)** / Unassigned (403) | Denied (403) |
| `PUT /api/lecturer/courses/:id/draft` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | **Assigned (200)** / Unassigned (403) | Denied (403) |
| `POST /api/courses/:id/submit` | **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | **Assigned (200)** / Unassigned (403) | Denied (403) |
| `POST /api/lecturer/courses/:id/reset-lab`| **Allowed (200)** | **Allowed (200)** | **Allowed (200)** | **Denied (403)** | **Assigned (200)** / Unassigned (403) | Denied (403) |
| `recordLessonActivity` (Store write) | **No Mutation** | **No Mutation** | **No Mutation** | **No Mutation** | **No Mutation** | **Writes `userProgress`** |
| `markLessonComplete` (Store write) | **No Mutation** | **No Mutation** | **No Mutation** | **No Mutation** | **No Mutation** | **Writes `userProgress`** |

---

## 6. Tests Authored — Deferred to Phase 13

A dedicated test suite has been authored at:  
[`frontend/src/test/course-review-visibility-and-preview.test.ts`](file:///d:/LMS%20MEtro Project/frontend/src/test/course-review-visibility-and-preview.test.ts)

All tests are marked: `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

### Test Inventory (30 Subcases):
1. **Test 1:** `assistant_admin`, `super_admin`, `developer`, and `admin` read review queue via `GET /api/approvals/queue`.
2. **Test 2:** All four administrative roles read authoritative course review data via canonical and admin review endpoints.
3. **Test 3:** `assistant_admin` reads staged admin edits and reviewer working notes without receiving 403.
4. **Test 4:** `assistant_admin` attempting review decisions (unified decision, approve, return-with-edits, reject) strictly fails with HTTP 403.
5. **Test 5:** `assistant_admin` attempting to save or discard staged edits or working notes strictly fails with HTTP 403.
6. **Test 6:** Operational administrators (`admin`, `super_admin`, `developer`) retain authoritative review decision execution.
7. **Test 7:** Lecturer review access scoping: course owner reads review data; unrelated lecturer receives 403.
8. **Test 8:** Trainees attempting to read review queue or review data receive 403.
9. **Test 9:** `assistant_admin` retrieves course data for preview/editing inspection via `GET /api/lecturer/courses/:id`.
10. **Test 10:** `super_admin` and `developer` retrieve course data for preview/editing inspection.
11. **Test 11:** `assistant_admin` attempting to save course drafts strictly receives 403.
12. **Test 12:** `assistant_admin` attempting to reset lab courses strictly receives 403.
13. **Test 13:** `assistant_admin` attempting to submit courses for review strictly receives 403.
14. **Test 14:** Assigned course lecturer preserves draft saving and editing capabilities.
15. **Test 15:** Unassigned lecturer attempting to access another lecturer's course for editing receives 403.
16. **Test 16:** `assistant_admin` lists all courses via `GET /api/lecturer/courses` without 403.
17. **Test 17:** Preview roles (`developer`, `super_admin`, `admin`, `assistant_admin`, `lecturer`) playback activity does NOT mutate trainee `userProgress` or `lastWatched`.
18. **Test 18:** Preview roles lesson completion does NOT persist completed lessons to trainee progress or advance percentage.
19. **Test 19:** Genuine trainee (`role: 'user'`) updates `userProgress`, sets `lastWatched`, and completes lessons normally.
20. **Test 20:** Trainee sequential lesson locking is strictly enforced, while preview roles bypass locking freely.
21. **Test 21 (Security Reconciliation):** Prevents caller role spoofing: candidate role "user" cannot bypass preview isolation for admin or lecturer accounts; authoritative directory role prevails and store writes zero progress.
22. **Test 22 (Security Reconciliation):** Fails closed on unresolvable user IDs: unknown identity creates NO progress or `lastWatched` records and fails closed with status 401.
23. **Test 23 (Security Reconciliation):** Fails closed on tombstoned users: deleted accounts cannot record activity or complete lessons; store fails closed with status 401.
24. **Test 24 (Security Reconciliation):** Strictly preserves pre-existing progress and `lastWatched` records for preview personas: existing progress data is never mutated, overwritten, reset, or deleted by preview calls.
25. **Test 25 (Security Reconciliation):** Authentic trainee progression: end-to-end verification of sequential unlocking and persistent progress writes for authentic trainees.
26. **Test 26 (Production Fixture Isolation):** Every entry in `CONTROLLED_TEST_FIXTURE_USERS` is rejected as an identity/role fallback when simulated in production mode (`envMode: 'production'`).
27. **Test 27 (Production Canonical Directory):** Approved canonical production directory users (`BASE_MANAGED_USERS`: `USR001`, `USR002`, `USR003`, `USR016`, `USR017`) resolve authoritatively in simulated production mode.
28. **Test 28 (Production Privilege Isolation):** Synthetic Developer (`USR_DEV_001`) and Super Admin (`USR_SUPER_001`) demo identities and aliases strictly do NOT resolve in production mode.
29. **Test 29 (Session Cross-User Isolation):** Valid cached session for User A cannot resolve an unrelated or unknown User B; fails closed with `null`.
30. **Test 30 (Session Invalidation Semantics):** Expired sessions, cleared sessions (client-side logout), and tombstoned user accounts strictly fail closed.

---

## 7. Scope & Invariant Confirmation

1. **Frozen Scopes Intact:** Phase 1 (Canonical Identity & Tombstones), Phase 2 (Increments 2.1–2.4, Invariants `INV-R1`–`INV-R8`, Developer Confidentiality across 11 surfaces), Increment 3.1, and Increment 3.2 are completely preserved and unmodified.
2. **Authoritative Baseline Preserved:** `docs/backend/pre-backend-migration-remediation-roadmap.md` (Revision 5) remains completely unchanged.
3. **Phase 4 & Phase 5 Deferred:** Zero approval delegation workflows (`202 Accepted`), preview sidecars, or auto-renewal execution logic implemented.
4. **Increment 3.4 Boundary:** Route guards, role-filtered navigation sidebar/drawer, and Arabic role label unification have not been started.
5. **Zero Execution Directive:** Zero vitest, test runner, compiler (`tsc`), linter (`eslint`), or build commands executed during this turn.

