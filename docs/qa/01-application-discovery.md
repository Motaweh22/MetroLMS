# MetroLMS — Phase 1: Complete Application Discovery (`01-application-discovery.md`)

> **Audit Mode:** Independent Read-Only Inspection  
> **Scope:** `frontend/`, `backend/`, `Demo/`, `scripts/`, `Dockerfile.windows`, `docker-compose.windows.yml`, `start-production.bat`, `docs/project-state/`  
> **Environment Verified:** Local Microsoft SQL Server (`MSSQLSERVER` service `Running`), Python `3.12.10` (`backend/.venv`), Node/Vite (`frontend/`). Docker CLI not installed on audit host; no listener on `:8000` or `:5173` at discovery start.

---

## 1. Repository & Governance State Drift

- **Governance Documents Lag Behind Codebase:** [`docs/project-state/CURRENT.md`](../project-state/CURRENT.md) and [`docs/project-state/active-roadmap.md`](../project-state/active-roadmap.md) describe MetroLMS as `"IN PRE-BACKEND REMEDIATION"` with Django + SQL Server deferred to Phase 12. In reality, all **8 Django feature apps (`57` models, `38` migrations)**, Waitress + WhiteNoise production serving (`Dockerfile.windows`, `start-production.bat`), and live API integrations across the React SPA are already implemented in the repository.
- **Frozen Data Dictionary Drift:** [`docs/02-architecture-and-design/data-models/data-dictionary.md`](../02-architecture-and-design/data-models/data-dictionary.md) is frozen at `54` entities (`305` columns), while the live SQL Server schema contains **57 active `dbo.*` feature tables** and **18 post-freeze columns**.

---

## 2. Frontend Architecture Discovery (`frontend/`)

### 2.1 Entry Points & Dependencies
- **Tech Stack (`frontend/package.json`):** React `19.0.0`, React DOM `19.0.0`, React Router DOM `7.18.4`, TypeScript `~5.7.3`, Vite (`@vitejs/plugin-react` `4.3.4`), Tailwind CSS v4 (`@tailwindcss/vite` `4.0.6`), `lucide-react` `1.57.0`, Vitest `3.0.5`, Testing Library `16.2.0`, ESLint `9.20.0`, MSW `2.15.0` (`devDependencies`).
- **Bootstrap (`frontend/src/main.tsx:6-42`):** Dynamically starts MSW (`@/mocks/browser`) *only* when `!PROD && MODE !== 'production' && DEV && (MODE === 'demo' || VITE_DEMO_MODE === 'true')`; otherwise renders `<App />` (`frontend/src/App.tsx:1-5`) directly against real `/api/*` endpoints.
- **Router & Provider Tree (`frontend/src/app/router/index.tsx:468-505`):**
  - Provider stack: `ErrorBoundary` → `AuthProvider` → `ToastProvider` → `RolePreviewProvider` → `RouterProvider`.
  - Uses `createBrowserRouter` in normal browser runs and `createMemoryRouter` in test/SSR runs (`getAppRouter`).
  - Route-level code splitting via `React.lazy` + `<LazyPage>` (`<React.Suspense fallback={<PageLoading />}>`) for 30 feature/admin pages.

### 2.2 Layouts, Routes & Navigation Structure
- **Layouts:**
  - [`AuthLayout`](../../frontend/src/app/layouts/AuthLayout.tsx): Bare `<Outlet />` for `/login`.
  - [`AppLayout`](../../frontend/src/app/layouts/AppLayout.tsx): Wraps authenticated routes in `EnrollmentProvider` → `NotificationProvider`, executes `useAutoRenewalScheduler` for `admin`/`super_admin`/`developer`, renders `Navbar`, `Sidebar`, `MobileDrawer`, `Footer`, `IsolatedSessionBanner`, `RolePreviewBanner`, `RolePreviewModal`, `IsolatedSessionModal`, and switches to immersive dark mode (`bg-[#070B14]`) on `/courses/:courseId/learn(/*)`. Keyed `<Outlet key={`${user ? user.id : 'anonymous'}_epoch_${sessionEpoch}`} />` forces clean subtree remounts on user/session transitions.
- **Route Guards:**
  - [`ProtectedRoute`](../../frontend/src/core/auth/ProtectedRoute.tsx): Redirects unauthenticated visitors to `/login`; enforces `allowedRoles` against real `user.role` (never `effectiveUiRole`), redirecting unauthorized users to `/403`.
  - [`DeveloperRouteGuard`](../../frontend/src/app/router/index.tsx:169-197): Enforces `user?.role === 'developer'`; returns 404 (`NotFoundPage`) to non-developers (`INV-R8` non-disclosure).
  - [`RouteErrorBoundary`](../../frontend/src/app/router/RouteErrorBoundary.tsx): Maps 404 → `NotFoundPage`, 403 → `ForbiddenPage`, and unexpected errors → `UnexpectedErrorPage`.
- **Pages (`frontend/src/pages/`):** **34** page files (`33` mounted in `router/index.tsx`, plus 1 unmounted increment demo page [`DashboardPreviewPage.tsx`](../../frontend/src/pages/DashboardPreviewPage.tsx)).
- **Navigation (`frontend/src/shared/config/navigation.ts:40-255`):** 3 sections (`primary`, `learning`, `management`) with 14 items (1 item `/admin` marked `planned` without a route; `quality-audit` `/approvals` omits `lecturer` in nav config even though `/approvals` route permits `lecturer`).

### 2.3 Auth, State, Validation & API Client Architecture
- **Auth & Session State (`frontend/src/core/auth/`):**
  - `AuthContext.tsx` manages cookie-backed session hydration via `GET /api/auth/me`, CSRF bootstrap via `GET /api/auth/csrf`, login via `POST /api/auth/login`, and `LOGOUT_CONFIRMED` / `LOGOUT_UNCONFIRMED` state transitions via `POST /api/auth/logout`.
  - `sessionEpoch.ts` tracks monotonic session transitions; `authStorage.ts` stores non-credential `OriginSnapshot` (`sessionStorage`) for Developer isolated-session tooling; `RolePreviewContext.tsx` + `previewMutationBarrier.ts` provide UI-only role preview while blocking client mutations (`ROLE_PREVIEW_MUTATION_BLOCKED`).
  - **Defect Found:** `AuthContext.tsx:270-281` sets a `3000ms` safety timer forcing `isLoading = false` before `GET /api/auth/me` (`10000ms` timeout at `L386`) completes, risking premature `/login` redirect on slow networks.
- **API Client (`frontend/src/core/api/apiClient.ts`):**
  - Sends `credentials: 'same-origin'`, `Accept: 'application/json'`, attaches `X-CSRFToken` from `csrftoken` cookie on `POST/PUT/PATCH/DELETE`, rejects stale responses via `StaleEpochError`, unwraps `{ status: 'OK', data }` envelopes, and stringifies `id`/`*Id`/`*Ids` fields via `normalizeApiPayloadIds()`.
  - **Bypass Paths:** Several media/file callers (`ItemEditorModal.tsx`, `MetadataEditor.tsx`, `GroupUploadFilesModal.tsx`, `VideoPlayer.tsx`, `useAuthenticatedMediaPreview.ts`, `DocumentViewer.tsx`, `LearningPlayerPage.tsx`) call native `fetch()` or `XMLHttpRequest` directly instead of `apiClient`.
- **State Management:** React Contexts (`AuthContext`, `RolePreviewContext`, `EnrollmentContext`, `NotificationContext`, `ToastProvider`) + component-local hooks (`useState`, `useCallback`, `useMemo`); no Redux/Zustand.
- **Forms, Validation & States:** Client-side validators (`numericInput.ts` 11-digit Egyptian mobile & 14-digit National ID, `passwordPolicy.ts`, `safeUrl.ts`, `useUnsavedChangesGuard.ts`). Loading/empty/error states exist across pages, though catalog dropdown loaders (`AddUserForm.tsx`, `EditUserModal.tsx`, `MetadataEditor.tsx`) use `Promise.allSettled` and silently ignore failures, and search inputs on `CoursesCatalogPage`, `CommentModerationPage`, `SecurityAuditPage` lack debounce and `AbortController`.
- **File Upload / Download:** Multipart `FormData` upload to `/api/media/assets/upload` (XHR progress in `ItemEditorModal.tsx`, `fetch` in `MetadataEditor.tsx` & `GroupUploadFilesModal.tsx`); protected video playback via `POST /api/media/stream-ticket` → HTTP `206` Range `<video src>`; PDF/image preview via `useAuthenticatedMediaPreview` (`?format=json` base64 or Blob); course ZIP download via `GET /api/courses/:id/archive-zip` (`X-MetroLMS-Blob: 1`).
- **Existing Frontend Tests (`frontend/src/test/`):** `100` `.test.ts` / `.test.tsx` files + `setup.ts` + 2 media fixtures (`test.mp4`, `cairo-metro-network-map.pdf`), almost all driven by `Demo/mocks/server.ts` (MSW) and `inMemoryStore.ts`.

---

## 3. Backend Architecture Discovery (`backend/`)

### 3.1 Stack, Settings & Feature Modules
- **Tech Stack (`backend/requirements.txt`):** Python `3.12.10`, Django `5.2.19`, DRF `3.18.3`, `mssql-django==2.0.0`, `pyodbc==5.5.0`, `mssql-python==1.17.0`, `waitress==3.0.2`.
- **Settings (`backend/config/settings/`):**
  - `base.py`: `AUTH_USER_MODEL = "identity.User"`, `USE_TZ = True`, `TIME_ZONE = "UTC"`, `SESSION_ENGINE = "apps.identity.sessions"`, `SESSION_COOKIE_HTTPONLY = True`, `SESSION_COOKIE_SAMESITE = "Lax"`, `CSRF_COOKIE_SAMESITE = "Lax"`, `DEFAULT_AUTHENTICATION_CLASSES = ["rest_framework.authentication.SessionAuthentication"]`, `DEFAULT_PERMISSION_CLASSES = ["rest_framework.permissions.IsAuthenticated"]`, `EXCEPTION_HANDLER = "shared.api.exceptions.metrolms_exception_handler"`, `PAGE_SIZE = 20`.
  - `development.py`: `DEBUG = True` default, `SESSION_COOKIE_SECURE = False`, `CSRF_COOKIE_SECURE = False`.
  - `production.py`: `DEBUG = False`, `SESSION_COOKIE_SECURE = True`, `CSRF_COOKIE_SECURE = True`, `SECURE_CONTENT_TYPE_NOSNIFF = True`, `X_FRAME_OPTIONS = "DENY"`, `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`, `USE_X_FORWARDED_HOST = True`.
  - `testing.py`: `DEBUG = False`, `MD5PasswordHasher` for test speed.
- **8 Modular Monolith Apps (`backend/apps/`):**
  1. `identity`: Auth, CSRF, custom `ServerSession`, per-phone/per-IP `login_rate_limit`, 6-tier `RolePolicy`, `UserPermissionOverride`, `DelegatedAuthority`, user CRUD, `D-01` tombstone deletion, effective permissions.
  2. `organization`: Departments, Job Titles, Metro Lines, Leadership Titles, Marital/Military catalogs, `DepartmentTrack`, `HistoricalServiceTrainingRecord`, `UserOrganizationalDepartment`, `DepartmentJobTitle`, `UserJobTitle`, dependency inspection & resolution.
  3. `governance`: `PendingApprovalRequest` (`202 Accepted` creation + decision API), `AuditLogEntry` (`D-14` developer masking, paginated log retrieval).
  4. `courses`: `Course`, `CourseDraft`, `PublishedCourseVersion` (`Rule B`), `Module`, `LessonItem`, `QuizDefinition`, `CourseReviewSubmission`, `StagedAdminEdit`, `WorkingNote`, `CourseComment`, `CourseCommentReport`, `CourseQrCode`, audience tables, ZIP export, visibility configuration.
  5. `media`: `MediaAsset` (`LocalMediaStorage` on `D:\MetroLMSMedia` / `C:\MetroLMSMedia`), MIME + magic-byte validation, SHA-256 deduplication metadata, `MediaContentReference`, `TimestampSigner` stream tickets, HTTP `206` Range streaming.
  6. `groups`: `TrainingGroup`, `GroupRenewalCycle`, `GroupCourseAssignment`, `GroupMembership`, `GroupAssistantAssignment`, `GroupQrCode` (SHA-256), `GroupJoinRequest`, `GroupResource`, JSON file manifests on disk (`_materials_manifest_path`).
  7. `learning`: `Enrollment`, `EnrollmentSourceGrant`, `CourseAttempt`, `LessonProgress`, `CertificateRecord`, `/api/dashboard`, quiz grading, performance reports.
  8. `communications`: `NotificationItem`, `WhatsAppContact`, `UserWhatsAppVisibility`, `ScheduledJob`, `ScheduledJobRun`, management command `process_due_group_renewals`.
- **Architecture Pattern Note:** All apps contain `api/{urls,views,serializers,permissions}`, `models/`, `services/`, `tests/`, while `policies/`, `selectors/`, and `tasks/` directories are empty placeholders (`0` bytes).
- **Existing Backend Tests:** `15` test modules across all 8 apps (`backend/apps/*/tests/test_*.py`); `backend/tests/{architecture,contract,integration}/` are empty placeholders.

---

## 4. Database Architecture Discovery (Microsoft SQL Server)

- **Engine & Connection (`base.py:89-102`):** `ENGINE = "mssql"`, `ODBC Driver 18 for SQL Server`, `COLLATE Arabic_100_CI_AS`, `COMPATIBILITY_LEVEL` capped at `160` (`metrolms-database-init-and-migrate.bat:202-206`), `READ_COMMITTED_SNAPSHOT ON`.
- **Tables & Constraints:** **57** active feature models across `dbo.*` (`38` migration files cleanly matching `models/entities.py`), plus Django built-ins (`contenttypes`, `sessions` unused due to `identity_serversession`).
  - Nearly all FKs use `on_delete=models.DO_NOTHING` (`ON DELETE NO ACTION` in SQL Server), except `organization.JobTitle.department` (`on_delete=models.SET_NULL`, `organization/0003`).
  - SQL Server `RunSQL` constraints enforce `Arabic_100_BIN2` phone format, non-empty trimmed text checks, `ISJSON(...)` checks, and two composite FKs (`fk_userjobtitle_user_dept`, `fk_userjobtitle_dept_job` in `organization/0002_sqlserver_constraints.py`).
  - **4** partial `UniqueConstraint`s (`uq_identity_user_single_developer`, `uq_identity_user_email_not_null`, `uq_identity_user_employee_number_not_null`, `uq_groupjoinreq_pending_group_user`, `uq_cert_attempt_not_null`).
- **Database Integrity & Performance Observations:**
  - **Transactions & Locking:** Several multi-step mutations (`_update_user`, `LecturerCourseDraftView.put`, `AdminGroupDetailView.put`, `CourseEnrollmentsBulkAddView`, `upload_media_asset`) lack enclosing `@transaction.atomic`. Critical concurrency paths (`run_scheduled_job_with_idempotency`, `decide_course_review`, `execute_review_decision`, `save_course_draft`, `delete_user_with_d01_cascade`) lack `select_for_update()`.
  - **N+1 & Pagination:** `14+` list endpoints return unbounded querysets despite `PAGE_SIZE=20` in `base.py:152`; N+1 queries occur in `AdminGroupListView`, `MyGroupsView` (also writes notifications inside HTTP `GET`), `MyEnrollmentsView`, `DashboardView`, `CourseCatalogListView`, `_notify_eligible_trainees_on_publish`, and `get_lecturer_course_performance`.
  - **SQL Server 2100-Parameter Limit:** Unchunked `__in=` and `bulk_create` calls appear in `AdminUserListView`, `AdminCandidateTraineesView`, `AdminCandidateLecturersView`, `_notify_eligible_trainees_on_publish`, `notify_users`, `DashboardView`, `TrainingGroupSerializer`, and `CourseListSerializer`.

---

## 5. Infrastructure & Deployment Discovery

- **Container Deployment (`Dockerfile.windows`, `docker-compose.windows.yml`):**
  - Multi-stage Windows Server Core `ltsc2022` build: Stage 1 builds `frontend/dist` with Node `24.11.0`; Stage 2 installs Python `3.12.10`, VC++ Redistributable, ODBC Driver 18, Waitress (`--threads=16`, `--max-request-body-size=2254857830`, `--channel-timeout=600`), and WhiteNoise (`METROLMS_SERVE_FRONTEND=True`), listening on `:8000`.
  - Auto-detects Docker host default gateway when `DB_HOST=AUTO` so container reaches host `MSSQLSERVER` on TCP `1433` (requires Mixed Mode auth + Windows Firewall rule for port `1433` on `Public` profile).
  - Media persisted on host volume (`D:\MetroLMSMedia` → `C:\MetroLMSMedia`).
  - **Critical Container Config Issues:** `Dockerfile.windows:29-31` defaults `ARG VITE_SHOW_TEST_CARDS=true` and copies `Demo\mocks` because `useWhatsAppContacts.ts` bundles `inMemoryStore.ts`. `docker-offline-deploy-steps.txt:63` sample `.env.docker` instructs deploying with `DJANGO_SETTINGS_MODULE=config.settings.development` and `DB_USER=sa`.
- **Bare-Metal Windows Deployment (`start-production.bat`, `scripts/metrolms-windows-server-deploy.bat`, `backend/scripts/*.bat`):**
  - `start-production.bat` binds Waitress (`:8000`) + `vite preview` (`:4173`) **using `config.settings.development` and `VITE_SHOW_TEST_CARDS=true`**.
  - `backend/scripts/metrolms-start-production-server.bat` properly uses `config.settings.production` (`127.0.0.1:8000` behind IIS).
  - `backend/scripts/metrolms-register-renewal-task.bat` registers 6-hour Windows Task Scheduler job `MetroLMS_DueGroupRenewals_6H` running `manage.py process_due_group_renewals`.
- **Logging Gap:** `backend/.env.example` declares `DJANGO_LOG_LEVEL=INFO`, yet **no `LOGGING` configuration exists** in `backend/config/settings/*`.
