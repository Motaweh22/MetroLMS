# MetroLMS — Phase 4: Real Frontend/Backend Integration & Mock Footprint Audit (`04-real-integration-audit.md`)

> **Audit Principle:** Verified exclusively against real React API callers (`frontend/src/`), real Django URLs/views/serializers (`backend/apps/`), and Microsoft SQL Server schemas (`dbo.*`). MSW (`Demo/`) is **excluded** as integration evidence and separately audited for production interference.

---

## 1. Transport, Cookies, CSRF & Envelope Normalization

| Mechanism | Frontend Implementation | Backend Implementation | Alignment Status |
|---|---|---|---|
| **Base URL & Proxy** | Same-origin `/api/*` (`vite.config.ts:223` dev proxy → `:8000`; Waitress + WhiteNoise single-port `:8000` in Docker; `vite preview` proxy `:4173` → `:8000` in `start-production.bat`) | Mounted under `/api/` in `backend/config/urls.py:6-15` | **ALIGNED** |
| **Cookie Transport** | `apiClient.ts:254` sends `credentials: 'same-origin'`. **Direct `fetch` callers:** `useAuthenticatedMediaPreview.ts` & `VideoPlayer.tsx` send `'include'`; `DocumentViewer.tsx:80,104` **omits `credentials`** | `SessionAuthentication` + `SESSION_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SAMESITE = 'Lax'` | **PARTIAL (`DocumentViewer` omits `credentials`)** |
| **CSRF Handling** | `authApi.ensureCsrf()` (`GET /api/auth/csrf`); `apiClient.ts:267-272` reads `csrftoken` cookie and sets `X-CSRFToken` on `POST/PUT/PATCH/DELETE` | `CsrfViewMiddleware` + `rotate_token(request)` on login (`auth_service.py:20`) | **ALIGNED (except non-`apiClient` mutators skip preview barrier & epoch check)** |
| **Response Envelope** | `apiClient.ts:426-441` unwraps `{ status: 'OK', data }` and converts numeric `id`, `*Id`, `*Ids` recursively to `string` via `normalizeApiPayloadIds()` | `shared/api/responses.py:10-12` wraps responses in `{"status": "OK", "data": ...}`; errors in `{"status": "ERROR", "code", "message"}` | **ALIGNED** |
| **Pagination** | `auditApi.ts` passes `page`, `pageSize`; all other list consumers expect full unpaginated arrays | Only `AuditLogListView` paginates (`pageSize`, max 200). 14+ list views override DRF `PAGE_SIZE=20` with unpaginated lists | **PERFORMANCE / SCALE RISK** |
| **Race & Epoch Guards** | `apiClient.ts` discards stale async responses via `sessionEpoch` (`StaleEpochError`); however, `useCourses`, `CommentModerationPage`, `SecurityAuditPage`, `OrganizationCatalogPage`, `useCourseDetail`, `useCourseProgress` lack debounce / `AbortController` | Stateless per-request; `StagedAdminEdit` enforces optimistic `clientRevision` (`409`); critical mutations (`decide_course_review`, `save_course_draft`, `run_scheduled_job_with_idempotency`) lack `select_for_update()` | **PARTIAL** |

---

## 2. Confirmed Frontend ↔ Backend Contract Breakages & Mismatches

Every mismatch below breaks real workflows when MSW is absent:

| # | Area | Frontend Expectation (`file:line`) | Backend Reality (`file:line`) | Impact on Real Site |
|---|---|---|---|---|
| **INT-01** | **Group Join via QR** | `groupsApi.joinGroupByQR` (`groupsApi.ts:87-91`) sends `{ enrollmentCode, note? }` to `POST /api/groups/join` | `GroupQrJoinView.post` (`groups.py:413-416`) reads `request.data.get("token", "")` and returns `400 VALIDATION_ERROR` ("رمز الانضمام مطلوب.") | **Trainee Group QR Join fails 100% (`400`)** |
| **INT-02** | **Delegated Authority Toggle** | `permissionsApi.setDelegatedAuthority` (`permissionsApi.ts:141-148`) sends `{ enabled: boolean }` to `POST /api/admin/permissions/governance/delegation/:userId` | `DelegatedAuthorityView.post` (`permissions.py:237-240`) validates `DelegatedAuthoritySerializer` expecting `capabilityKey` (per-capability) and has no `enabled` field or revoke-on-POST logic | **Toggling delegated authority fails 100% (`400`)** |
| **INT-03** | **Reset Lab Action** | `builderApi.resetContentLab` (`builderApi.ts:65-70`) calls `POST /api/lecturer/courses/:courseId/reset-lab` | Route does not exist in `backend/apps/courses/api/urls.py` | **Returns `404 RESOURCE_NOT_FOUND`** |
| **INT-04** | **Group Meetings Save** | `GroupMeetingsTab.tsx:111-113` sends `{ resources }` via `PUT /api/admin/groups/:groupId` | `AdminGroupDetailView.put` (`groups.py:216-247`) ignores `resources`; backend expects `POST /api/admin/groups/:groupId/resources` per resource | **Meeting changes silently dropped (`200 OK` without DB save)** |
| **INT-05** | **Quiz Submission & Grading** | `LearningPlayerPage.tsx:370-470` has no Quiz renderer; `quiz` lessons fall through to `DocumentViewer` and call `POST /api/courses/:id/items/:id/complete` | `QuizSubmitView` (`/api/courses/:id/lessons/:id/quiz/submit`) is never called; `mark_lesson_complete` (`learning_service.py:450-475`) never checks for `QuizDefinition` | **Quiz grading & passing thresholds bypassed in production** |
| **INT-06** | **Course Comments Toggle** | `commentsApi.toggleCourseComments` (`commentsApi.ts:163`) sends `PATCH /api/admin/courses/:id/comments-toggle` | `AdminCourseCommentsToggleView` (`courses.py:937-959`) is a no-op that echoes `{courseId, commentsEnabled}` without DB persistence | **Toggle appears to succeed (`200`) but resets on reload; comments remain enabled** |
| **INT-07** | **Manual Auto-Renewal Check** | `groupsApi.checkAutoRenewal` (`groupsApi.ts:203`) calls `POST /api/admin/groups/:id/check-auto-renewal` | `AdminGroupCheckAutoRenewalView` (`groups.py:1608-1619`) is a stub always returning `{renewed: false, group}` | **Single-group auto-renewal trigger does nothing** |
| **INT-08** | **Approval Decision Execution** | `permissionsApi.approveApprovalRequest` (`permissionsApi.ts:192`) calls `POST /api/admin/permissions/governance/approvals/:id/decide` | `ApprovalDecisionView.post` (`governance.py:110`) calls `decide_pending_approval(..., executor_fn=None)`, setting `execution_status="Executed"` without performing any DB mutation | **Approved governance requests report `"Executed"` while target user/group/enrollment/certificate remains unchanged in SQL Server** |
| **INT-09** | **Group Member Selective Course Removal (`D-07`)** | `groupsApi.removeGroupMember` (`groupsApi.ts:371`) sends `{ removeCourseIds }` in `DELETE` body | `AdminGroupMemberDeleteView.delete` (`groups.py:1000-1016`) deletes `GroupMembership` only and ignores `removeCourseIds` without calling `revoke_group_enrollment_grant` | **Removed group members keep unauthorized course access indefinitely** |
| **INT-10** | **Certificates Backend Without UI** | No UI invokes `/attempts/:id/certificate/issue`, `/admin/certificates/:id/revoke`, or `/certificates/verify/:code` | Full backend certificate issuance, revocation & verification exists (`assessments.py:46-116`) | **Trainees cannot issue/view verification codes or verify certificates via UI** |
| **INT-11** | **Unpublished Draft Leak to Trainees** | `CourseDetailPage` / `CoursesCatalogPage` render returned `modules`/`lessons` trusting server visibility | `CourseListSerializer._prefetch_courses` (`serializers/courses.py:154-160`) & `CourseSerializer.get_modules` (`L459-467`) prefer `CourseDraft` over `PublishedCourseVersion` whenever `CourseDraft` exists | **Editing a published course's draft exposes unpublished edits directly to trainees** |
| **INT-12** | **Marital/Military POST Key Typo** | — | `_BaseCatalogListView.post` (`org.py:197`) strips last char (`self.key_name[:-1]`), returning `maritalStatuse` / `militaryStatuse` | **Malformed JSON key on `POST` if consumed** |
| **INT-13** | **Co-Lecturers Assignment** | `coursesApi.assignCourseInstructors` (`coursesApi.ts:109`) sends `{ lecturerId, coLecturers? }` | `CourseInstructorsView` (`courses.py:962-1005`) updates `primary_lecturer` only (`CourseAssistantLecturer` not updated) | **Co-lecturers silently ignored on instructor assignment** |
| **INT-14** | **Error Detection Bugs** | `LecturerCoursesPage.tsx:165` reads `'code' in err` (`ApiError` puts payload in `err.data`); `GroupDetailPage.tsx:81-86` checks localized message text for `'403'` instead of `err.status === 403` | Standard `ApiError` has `.status` and `.data.code` | **403 / domain error states fail to render properly** |

---

## 3. Data Integrity & Synchronization Gaps Across Full Stack

- **HTTP GET Writing State:** `MyGroupsView.get` (`groups.py:553-574`) and `NotificationsListView.get` (`communications.py:30-39`) insert `NotificationItem` rows into SQL Server inside read (`GET`) handlers.
- **UI Optimistic / Silent Fallbacks Masking Backend Failures:**
  - `MetadataEditor.tsx:405` and `GroupUploadFilesModal.tsx:128` catch upload errors (`POST /api/media/assets/upload`) and fall back to temporary local `blob:` URLs or metadata-only calls (`addMaterialFile` with `sizeBytes: 0`), which triggers `_repair_material_file_record` (`groups.py:1104-1112`) to bind an unrelated latest `MediaAsset` of matching MIME type from SQL Server!
  - `AddUserForm.tsx`, `EditUserModal.tsx`, `MetadataEditor.tsx` swallow catalog load errors via `Promise.allSettled`.
  - `useAutoRenewalScheduler` (`AppLayout.tsx:129-134`) fires `POST /api/admin/groups/check-all-due-renewals` on browser mount/focus, conflicting with `API-REC-01` (server-only scheduler) and triggering `403` preview-barrier toasts during Developer Role Preview.
- **Hidden Group Materials Exposed in API JSON:** `AdminGroupMaterialsView.get` (`groups.py:1158-1164`) returns `isVisible: false` folders and files in JSON; `GroupMaterialsTab.tsx:227, 241` hides them solely in the browser DOM.

---

## 4. Remaining Mock & Demo Infrastructure Inventory

| Location | Contents / Purpose | Production Build Impact (`npm run build` / `Dockerfile.windows`) | Severity |
|---|---|---|---|
| `frontend/src/features/whatsapp/hooks/useWhatsAppContacts.ts:3, 101, 174, 193, 213, 233` | Static `import { inMemoryStore } from '@/mocks/store/inMemoryStore'` used for fallback lecturer/supervisor WhatsApp lookup | **CRITICAL INTERFERENCE:** Rollup statically bundles `Demo/mocks/store/inMemoryStore.ts` + mock fixtures into `frontend/dist/`, forces `Dockerfile.windows:28` to copy `Demo\mocks`, and serves fake mock contacts instead of SQL Server users | **High / Critical** |
| `Dockerfile.windows:29-31` & `start-production.bat:106` + `LoginForm.tsx:3, 40-41, 484-491` + `DemoAccountPicker.tsx` | Sets `VITE_SHOW_TEST_CARDS=true` during production builds; `DemoAccountPicker` hardcodes 6 test accounts (`01000000001`–`006`, `MetroTest@2026`) | **CRITICAL:** Renders clickable quick-login cards (including `super_admin` and `admin`) on `/login` in default Docker & `start-production.bat` builds; embeds credentials in JS bundle even when flag is `false` | **Critical** |
| `frontend/src/core/auth/testPersonas.ts`, `demoAccounts.ts`, `canonicalIdentity.ts` | Hardcoded synthetic personas (`BASE_TEST_PERSONAS` with passwords), `SYNTHETIC_DEMO_ACCOUNTS`, `USER_ALIAS_MAP` | Imported by `AuthContext.tsx`, `authStorage.ts`, `core/auth/index.ts`; runtime gated by `!PROD && DEV`, but literal mock strings/credentials remain bundled in `frontend/dist` | **Medium** |
| `frontend/src/features/course-builder/components/ItemEditorModal.tsx:543` | Fallback video URL `'/dev-media/test-video.mp4'` | Points to Vite dev-only middleware (`devTestMediaPlugin`, `apply: 'serve'`); returns `404` in production | **Medium** |
| `frontend/src/features/groups/utils/materialUtils.ts:153-161` | Generates synthetic Arabic text Blob when `!targetUrl \|\| targetUrl.startsWith('/dev-media/materials/')` | Can mask broken/missing file URLs in production by fabricating a fake `.txt` download | **Medium** |
| `frontend/src/core/storage/mediaStorageService.ts` | Browser IndexedDB `metro_lms_media_db` cache/store (`ItemEditorModal.tsx`, `LearningPlayerPage.tsx`) | Local browser storage fallback decoupled from SQL Server `MediaAsset` (`resolvedMediaUrl` takes precedence over server `currentItem.url`) | **Low / Medium** |
| `frontend/src/pages/DashboardPreviewPage.tsx` | Unrouted Increment 3 mock preview page | Dead file in `frontend/src/pages/`; not mounted in `router/index.tsx` | **Low** |
| `Demo/` (`mocks/`, `public/mockServiceWorker.js`) + `package.json` `"msw": "^2.15.0"` | MSW v2 worker (`main.tsx:6-31` gated by `DEV && (MODE === 'demo' \|\| VITE_DEMO_MODE === 'true')`), `excludeMswWorkerInBuildPlugin` removes `dist/mockServiceWorker.js` | Worker execution properly excluded from `PROD`, **except** `inMemoryStore` is still imported statically via `useWhatsAppContacts.ts` | **High** |
| `scripts/verify-production-cleanliness.mjs:33-50` | Production bundle scanner | Checks legacy fingerprints (`USR_DEV_001`) only; misses `ROLE_TEST_ACCOUNTS`, `MetroTest@2026`, and `inMemoryStore` leakage | **Medium** |
