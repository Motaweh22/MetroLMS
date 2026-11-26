# MetroLMS — Phase 8: Prioritized Stabilization Roadmap (`08-stabilization-roadmap.md`)

> **Strategy:** Stabilize MetroLMS from the inside out across 8 dependency-ordered tracks. Every track preserves Django + Microsoft SQL Server (`D-DB-01`), Modular Monolith feature boundaries, and session/CSRF auth (`D-AUTH-01`), eliminating all critical security vulnerabilities and broken contracts before production release.

---

## Track 1 — Critical Security & Data-Exposure Fixes (**COMPLETED IN SPRINT 1 — Backend/Unit Verified; Browser E2E Pending Track 6**)

- **Items Addressed:** `BUG-001` (Login/Logout CSRF — **FIXED**), `BUG-002` (Test-Card Env Isolation & MSW `inMemoryStore` removal — **PARTIALLY FIXED**, `USR_DEV_001` / Track 3 server settings remain), `BUG-003` (Self-Enrollment Bypass — **FIXED**), `BUG-004` (Media IDOR & repair binding — **FIXED**), `BUG-005` (Draft Leakage — **FIXED**), `BUG-006` (Iframe XSS & `safeUrl` `//` bypass — **FIXED**), `BUG-016` (`X-Forwarded-For` rate-limit spoofing — **FIXED**).
- **Root Causes:** Missing `@method_decorator(csrf_protect)` on `AllowAny` auth views; missing eligibility/ownership checks in enrollment & media services; serializers preferring `CourseDraft` over `PublishedCourseVersion`; substring `.includes()` checks inside privileged `allow-scripts allow-same-origin` iframes and naive `/` handling in `safeUrl.ts`; leftmost `X-Forwarded-For` trust.
- **Affected Modules:** Remediated across `auth.py`, `login_rate_limit.py`, `learning.py`, `learning_service.py`, `media_service.py`, `course_service.py`, `groups.py`, `serializers/courses.py`, `views/courses.py`, `seed_demo_roles.py`, `safeUrl.ts`, `ReviewContentPreview.tsx`, `DocumentViewer.tsx`, `GroupMaterialViewerModal.tsx`, `ItemEditorModal.tsx`, `useWhatsAppContacts.ts`, `vite.config.ts`, `Dockerfile.windows`, `start-production.bat`. See [`docs/qa/sprint-01-security-remediation.md`](sprint-01-security-remediation.md).
- **Acceptance Criteria Status:** `64/64` Django + SQL Server tests (`test_MetroLMS`) pass; `39/39` targeted Vitest security/embed tests pass; genuine `vite build` contains `0` `MetroTest@2026`/`ROLE_TEST_ACCOUNTS`/`inMemoryStore` strings while `--mode staging` retains Test Cards. Interactive live Chrome E2E (`BUG-025`) remains deferred to Track 6.

---

## Track 2 — Broken Frontend ↔ Backend Contract Reconciliation (**P0 — Core Functionality**)

- **Items Addressed:** `BUG-007` (`ApprovalDecisionView` execution & `INV-R9`), `BUG-008` (Group QR join), `BUG-009` (Delegated Authority), `BUG-010` (Quiz UI & grading enforcement), `BUG-011` (`reset-lab`), `BUG-012` (Group Meetings), `BUG-013` (`comments-toggle`), `BUG-014` (`D-07` removal), `BUG-015` (Hidden Group Materials), `BUG-019` (Archived groups & Auto-renewal), `BUG-024` (Co-lecturers, `org.py` key typo, error parsing).
- **Root Causes:** Independent Phase 12 backend evolution without contract integration testing against `frontend/src/features/*/services/*.ts`, leaving stubbed endpoints (`comments-toggle`, `check-auto-renewal`, `ApprovalDecisionView` `executor_fn=None`) and schema key mismatches (`enrollmentCode` vs `token`, `enabled` vs `capabilityKey`, `PUT` `{resources}`).
- **Affected Modules:** `backend/apps/governance/`, `backend/apps/identity/api/views/permissions.py`, `backend/shared/permissions/drf_permissions.py`, `backend/apps/groups/`, `backend/apps/courses/`, `backend/apps/learning/`, `backend/apps/organization/api/views/`, and corresponding `frontend/src/features/*`.
- **Proposed Fixes:**
  1. Register real action dispatcher (`executor_fn`) per `PendingApprovalRequest.action_type` and allow `requires_approval` routes to return `202 Accepted` (`INV-R9`).
  2. Standardize `GroupQrJoinView` & `groupsApi.joinGroupByQR` on `token` (supporting/deprecating alias if needed); align Delegated Authority grant/revoke API (`capabilityKey` + toggle/revoke endpoint).
  3. Build dedicated Quiz player UI in `LearningPlayerPage` submitting to `POST .../quiz/submit` and forbid `/items/:id/complete` from marking `QuizDefinition` items done without passing attempt.
  4. Persist `commentsEnabled` on `Course` model and block `POST .../comments` when disabled (`403`/`409`).
  5. Wire `AdminGroupMemberDeleteView.delete` (`D-07`) to execute `revoke_group_enrollment_grant` for `removeCourseIds`; filter `isVisible=False` server-side for trainees; hide archived groups from `/api/groups/my`; implement real `renew_training_group` & `check-auto-renewal`; route `GroupMeetingsTab` saves to resource endpoints; implement or remove `reset-lab`.
- **Dependencies:** Track 1 (authorization rules).
- **Required Tests:** End-to-end HTTP integration tests executing real frontend payloads directly against SQL Server (`test_MetroLMS`) verifying DB state transitions (never mocking DB side effects).
- **Regression Risks:** Existing backend tests using legacy payload keys (`token`, `PUT`) must stay aligned with updated API contract and OpenAPI spec.
- **Acceptance Criteria:** Zero `400`/`404`/no-op responses across all active frontend service callers; all DB mutations verified in SQL Server.

---

## Track 3 — Production Build Hygiene, Mock Removal & Server Hardening (**P0 — Release Gate**)

- **Items Addressed:** `BUG-002` (`MetroTest@2026`, `DemoAccountPicker`, `inMemoryStore` leak), `BUG-017` (`start-production.bat`, `production.py`, `SECRET_KEY`, `whitenoise`, headers, `LOGGING`).
- **Root Causes:** Production WhatsApp hook imports MSW `inMemoryStore.ts`; deployment scripts enable `VITE_SHOW_TEST_CARDS=true` and point production startup to `config.settings.development`.
- **Affected Modules:** `frontend/src/features/whatsapp/hooks/useWhatsAppContacts.ts`, `frontend/src/features/auth/components/LoginForm.tsx`, `Dockerfile.windows`, `start-production.bat`, `scripts/verify-production-cleanliness.mjs`, `backend/config/settings/{base,production}.py`, `backend/requirements.txt`.
- **Proposed Fixes:**
  1. Remove static `@/mocks/store/inMemoryStore` import from `useWhatsAppContacts.ts` and replace fallback lookups with real `/api/users` / public support endpoints.
  2. Remove `DemoAccountPicker` & hardcoded test passwords (`MetroTest@2026`, `testPersonas`) from production chunks (dynamic `import.meta.env.DEV` lazy-import only or delete completely); enforce `VITE_SHOW_TEST_CARDS=false` in `Dockerfile.windows` and `start-production.bat`.
  3. Switch `start-production.bat` to `DJANGO_SETTINGS_MODULE=config.settings.production`.
  4. Add fail-fast `ImproperlyConfigured` check in `production.py` if `SECRET_KEY == "dev-insecure-placeholder-key"` or `DEBUG=True`; add `SECURE_HSTS_SECONDS`, CSP policy, structured `LOGGING`, and add `whitenoise` to `backend/requirements.txt`.
  5. Upgrade `scripts/verify-production-cleanliness.mjs` to fail build if `MetroTest@2026`, `DemoAccountPicker`, or `inMemoryStore` appear anywhere in `frontend/dist/`.
- **Dependencies:** None (can run in parallel with Track 2).
- **Required Tests:** Fresh `npm run build` scanned by upgraded `verify-production-cleanliness.mjs`; Django startup check under `config.settings.production` confirming failure without explicit secret key and response headers verification.
- **Regression Risks:** Local Windows developer convenience scripts relying on demo cards must explicitly activate `.env.development` / `MODE=demo`.
- **Acceptance Criteria:** `frontend/dist/` contains zero demo/MSW artifacts or credentials; `start-production.bat` refuses insecure config and emits HSTS/CSP headers.

---

## Track 4 — Backend Concurrency, Database & Performance Stabilization (**P1 — High**)

- **Items Addressed:** `BUG-021` (`D-01` cleanup), `BUG-022` (`archive-zip` revoked guard), `BUG-023` (`GET` DB writes, unpaginated lists, `select_for_update()`, `transaction.atomic()`, SQL Server 2100-param `__in`, N+1 queries).
- **Root Causes:** Missing DB locking on state machines, side-effect writes triggered on read views, and unbounded ORM lookups against SQL Server ODBC limits.
- **Affected Modules:** `backend/apps/identity/`, `backend/apps/courses/`, `backend/apps/groups/`, `backend/apps/learning/`, `backend/apps/communications/`, `backend/apps/media/`.
- **Proposed Fixes:** Move notifications generation out of `GET /api/groups/my` & `GET /api/notifications` into domain events/cron; add `@transaction.atomic` + `select_for_update()` on `decide_course_review`, `save_course_draft`, and scheduler jobs; defer physical file deletion to `transaction.on_commit()`; enforce pagination across list views; chunk large `__in` filters (`<= 1000` IDs); cascade cancel `PendingApprovalRequest` & deactivate `DelegatedAuthority` on `D-01` user deletion; enforce active enrollment check in `archive-zip`.
- **Dependencies:** Track 1 & Track 2.
- **Required Tests:** Multi-threaded concurrency test for review approval / draft save, SQL Server query-count assertions (`assertNumQueries`), and >2100-item chunked query tests.
- **Acceptance Criteria:** Zero writes during HTTP `GET`; paginated envelopes on all collection endpoints; zero unhandled `IntegrityError` on deletions.

---

## Track 5 — Frontend Hooks, Race Conditions, Auth Timing & UI UX Hardening (**P1 — High**)

- **Items Addressed:** `BUG-020` (`SecurityAuditPage` role guard, `MyCoursesPage` hook order), `BUG-022` (`DocumentViewer` `credentials`, silent blob/upload fallbacks, `/dev-media/`), `BUG-019` (`useAutoRenewalScheduler`), `BUG-024` (`LecturerCoursesPage` / `GroupDetailPage` error checks), `AuthContext` 3s safety timer vs 10s `/api/auth/me` timeout.
- **Proposed Fixes:** Move `useMemo` above early `return` in `MyCoursesPage.tsx`; authorize `super_admin` & `developer` on `/admin/audit` before triggering API load; add `credentials: 'same-origin'` and error retry states to `DocumentViewer.tsx`; stop faking uploaded blobs/`.txt` downloads in `MetadataEditor` / `GroupUploadFilesModal` / `materialUtils.ts`; disable browser-side `useAutoRenewalScheduler`; add `AbortController` / debounce on searchable admin tables; align auth boot timeout.
- **Dependencies:** Track 2 & Track 3.
- **Required Tests:** Frontend component tests + real browser verification confirming proper Arabic error states, PDF loading, and zero premature session fallback.
- **Acceptance Criteria:** Zero React hook violations, zero masked upload errors, and proper `403`/domain alerts.

---

## Track 6 — Static Type-Safety, Linting & Real Test Suite Expansion (**P1 — High**)

- **Items Addressed:** `BUG-018` (`tsc -b` 511 errors, `eslint` 229 problems, Vitest 58/100 failing files), `BUG-025` (Missing Playwright/Chrome E2E).
- **Proposed Fixes:**
  1. Fix all 6 production TS errors (`ReviewInspector.tsx`, `ApprovalsPage.tsx`, `CourseBuilderPage.tsx`), `Demo/mocks/` drift (or quarantine/remove unused MSW suites), and `src/test/*.ts(x)` types until `npx tsc -b --noEmit` exits `0`.
  2. Resolve all 209 ESLint errors until `npm run lint` exits `0`.
  3. Separate pure frontend unit tests (Vitest) from full-stack tests, repair failing assertions, and install **Playwright** configured against live Django (`test_MetroLMS`) + Vite preview (`vite build`) covering all 6 roles, real video playback, PDF viewing, file upload/download, QR join, and RBAC route guards.
- **Dependencies:** Tracks 1–5.
- **Required Tests:** Automated CI pipeline enforcing `tsc -b`, `eslint`, `vitest run`, `manage.py test`, and Playwright live E2E.
- **Acceptance Criteria:** `0` TS errors, `0` ESLint errors, `100%` passing Vitest unit suite, and green Playwright + SQL Server E2E suite in headless Chrome.

---

## Track 7 — Governance, Roadmap & Data Dictionary Alignment (**P2 — Medium**)

- **Items Addressed:** `BUG-024` (Stale `CURRENT.md`, `active-roadmap.md`, 57 tables vs 54 frozen Data Dictionary, `backend-implementation-roadmap.md`).
- **Proposed Fixes:** Update `CURRENT.md` and `active-roadmap.md` checkpoints (`CP-*`) and sync `data-dictionary.md` + `openapi-specification.yaml` with actual schema/endpoint updates implemented during Tracks 1–6.
- **Dependencies:** Tracks 1–6.
- **Acceptance Criteria:** Zero contradiction between repository code/migrations (`57` tables) and governance documentation.

---

## Track 8 — Pre-Production Exit Gate Verification (**Release Gate**)

Production sign-off requires **all** of the following verified post-fix on clean staging (`test_MetroLMS` / staging SQL Server + IIS/Waitress):
1. `npx tsc -b --noEmit` exits `0`, `npm run lint` exits `0`, `npm test` passes `100%`.
2. `verify-production-cleanliness.mjs` confirms zero test passwords, zero MSW stores, and zero test pickers in `frontend/dist/`.
3. `python manage.py test` and live HTTP security regression suite pass `100%` against SQL Server.
4. Real headless Chrome / Playwright suite passes all 6 role journeys end-to-end (including `<video>` `206` playback, PDF iframe/blob preview, Login CSRF `403`, Media IDOR `403`, Targeted enrollment `403`, Governance approval DB execution, Group QR join, and Quiz grading).
5. `production.py` settings, TLS/HSTS/CSP headers, and Windows Event/file logging verified live.
