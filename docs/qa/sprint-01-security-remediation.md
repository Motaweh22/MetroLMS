# MetroLMS — Sprint 1: Critical Security Remediation Report (`sprint-01-security-remediation.md`)

> **Branch:** `security/sprint-01-remediation` (uncommitted working tree, awaiting authorization before any commit).
> **Release Readiness:** **NOT READY FOR PRODUCTION** — Track 2 (broken frontend ↔ backend contracts), Track 3 (remaining server/bundle hardening), Track 4/5/6 (concurrency, hook bugs, TS/ESLint/Vitest repair, Playwright/Chrome live E2E) remain mandatory before production release.

---

## Executive Remediation Summary

| ID | Vulnerability | Status | Summary of Verification |
|---|---|---|---|
| **BUG-001** | Login & Logout CSRF | **FIXED** | `Client(enforce_csrf_checks=True)` verified `403` on missing/invalid CSRF and `200` on valid token + full CSRF login/logout flow against SQL Server `test_MetroLMS` |
| **BUG-002** | Test Cards Preservation, Environment Isolation & Mock Separation | **PARTIALLY FIXED** | Genuine production `vite build` excludes `MetroTest@2026`, `ROLE_TEST_ACCOUNTS`, and `inMemoryStore` (`0` matches); `--mode staging` retains Test Cards authenticating via real Django/SQL Server; `seed_demo_roles` refuses `config.settings.production`. Pre-existing `USR_DEV_001` strings (`AuthContext.tsx`, `authStorage.ts`) & `start-production.bat` `config.settings.development` remain for Track 3 |
| **BUG-003** | Targeted/Hidden Course Self-Enrollment Bypass | **FIXED** | Excluded/hidden self-enrollment & spoofed `sourceType="group"` return `403` with `0` SQL Server `Enrollment` rows created |
| **BUG-004** | Cross-Lecturer Media IDOR & MIME Repair | **FIXED** | Cross-lecturer `mediaAssetId` attachments blocked (`403`) across references, course drafts, and group materials; MIME fallback removed from `_repair_material_file_record` |
| **BUG-005** | Unpublished `CourseDraft` Leakage | **FIXED** | Trainees strictly receive `PublishedCourseVersion` snapshots across course detail, catalog, and `/enrollments/my`; authors & admins retain draft access |
| **BUG-006** | Iframe XSS & Unsafe URL Handling | **FIXED** | Replaced `.includes()` iframe checks with strict `URL()` allowlists, blocked `//` & control chars in `sanitizeSafeUrl`, added `sandbox` + `credentials: 'same-origin'` (`39/39` Vitest pass, `0` TS errors in edited files) |
| **BUG-016** | Spoofable IP Rate Limiting | **FIXED** | Direct requests ignore `X-Forwarded-For`; trusted proxy CIDRs (`METROLMS_TRUSTED_PROXY_IPS`) parsed right-to-left (`64/64` SQL Server pass) |
| **BUG-025** | Live Chrome Browser E2E Verification | **BLOCKED** | Chrome DevTools (`DevToolsActivePort` ENOENT) & Playwright remain unavailable in environment |

---

## Detailed Issue Records

### 1. BUG-001 — Login CSRF & Logout CSRF
- **Original Finding:** `POST /api/auth/login` accepted credentials (`200 OK`) with no CSRF token because `LoginView` and `LogoutView` used `permission_classes = [AllowAny]` without `@method_decorator(csrf_protect)`.
- **Root Cause:** DRF `APIView.as_view()` exempts dispatch from `CsrfViewMiddleware`, and `SessionAuthentication` only executes `enforce_csrf` when a request already carries an authenticated session user.
- **Changed Files:** `backend/apps/identity/api/views/auth.py`
- **Applied Correction:** Applied `@method_decorator(csrf_protect)` to `LoginView.post` and `LogoutView.post`. Legitimate `authApi.ensureCsrf()` + `apiClient` `X-CSRFToken` flows remain intact.
- **Regression Tests:** `Sprint01SecurityRemediationTests.test_bug001_login_and_logout_enforce_csrf_tokens` (`backend/apps/identity/tests/test_sprint01_security_remediation.py`).
- **Verification Evidence:** Passed on SQL Server `test_MetroLMS` using `Client(enforce_csrf_checks=True)` (`403` missing CSRF, `403` invalid CSRF, `200` valid CSRF bootstrap -> login -> `/me` -> `403` CSRF-less logout -> `200` rotated-CSRF logout -> `401` post-logout `/me`).
- **Remaining Risks:** Live Chrome browser execution remains unverified (`BUG-025`).
- **Status:** **FIXED**

---

### 2. BUG-002 — Test Cards Preservation, Environment Isolation & Credential Security
- **Original Finding & Credential Investigation:**
  - `MetroTest@2026` is confirmed to be an **intentionally published test-account password** for 6 isolated disposable accounts (`+201000000001`..`006` seeded by `seed_demo_roles`), **not** a signing secret or production credential. However, `Dockerfile.windows` and `start-production.bat` unconditionally built production bundles with `VITE_SHOW_TEST_CARDS=true`, `LoginForm.tsx` statically bundled `DemoAccountPicker.tsx` (`MetroTest@2026`) even when hidden, `useWhatsAppContacts.ts` statically imported MSW `inMemoryStore`, and `seed_demo_roles` lacked a production guard.
- **Root Cause:** No Vite environment separation (`.env.development` / `.env.staging` / `.env.production`), unconditional `VITE_SHOW_TEST_CARDS=true` defaults in container/batch scripts, and static ES import of `@/mocks/store/inMemoryStore` in `useWhatsAppContacts.ts`.
- **Changed Files:**
  - `frontend/.env.development`, `frontend/.env.staging`, `frontend/.env.production`
  - `frontend/vite.config.ts`, `frontend/package.json`, `frontend/src/features/auth/index.ts`
  - `frontend/src/features/whatsapp/hooks/useWhatsAppContacts.ts`, `frontend/src/test/whatsapp-contacts.test.tsx`
  - `backend/apps/courses/api/serializers/courses.py` (`lecturerPhone`), `backend/apps/groups/api/serializers/groups.py` (`instructors[].phone`)
  - `backend/apps/identity/management/commands/seed_demo_roles.py`
  - `Dockerfile.windows`, `docker-compose.windows.yml`, `start-production.bat`, `scripts/verify-production-cleanliness.mjs`
- **Applied Correction:**
  1. Preserved all Test Cards (`DemoAccountPicker.tsx`) enabled in `.env.development` and `.env.staging` (`vite build --mode staging`, `start-production.bat /STAGING`, or `--build-arg VITE_SHOW_TEST_CARDS=true`), authenticating directly against real Django + SQL Server (`test_bug002_*` verified all role logins).
  2. Added Vite build plugin `excludeTestCardsInProductionPlugin` to strip `DemoAccountPicker` / `MetroTest@2026` completely when `isProduction && VITE_SHOW_TEST_CARDS !== 'true'`, and changed `Dockerfile.windows`, `docker-compose.windows.yml`, and `start-production.bat` defaults to `VITE_SHOW_TEST_CARDS=false`.
  3. Removed `@/mocks/store/inMemoryStore` static import from `useWhatsAppContacts.ts` (replaced with real `lecturerPhone` / `instructors[].phone` API properties + Vitest-only lookup hook).
  4. Guarded `seed_demo_roles.py` against executing under `DJANGO_SETTINGS_MODULE=config.settings.production` (`CommandError`).
- **Regression Tests:** `Sprint01SecurityRemediationTests.test_bug002_seed_demo_roles_authenticates_against_django_and_blocks_production`; dual Vite bundle scan checks (`dist-staging` vs `dist-prod`).
- **Verification Evidence:**
  - Staging build (`npx vite build --mode staging --outDir dist-staging`): `hasCards=True`, `hasMock=False`.
  - Genuine Production build (`npx vite build --outDir dist-prod`): `0` occurrences of `MetroTest@2026`, `ROLE_TEST_ACCOUNTS`, or `inMemoryStore`.
  - `node scripts/verify-production-cleanliness.mjs frontend/dist-prod` exited `1` strictly due to **pre-existing** Track 3 items (`USR_DEV_001` strings in `AuthContext.tsx` / `authStorage.ts` and Arabic role label `"مطور النظام"` in `OrganizationCatalogPage`).
- **Remaining Risks:** Track 3 must still decouple legacy `USR_DEV_001` literals from `AuthContext.tsx` / `authStorage.ts`, switch `start-production.bat` to `config.settings.production` (`BUG-017`), and reconcile `verify-production-cleanliness.mjs`.
- **Status:** **PARTIALLY FIXED**

---

### 3. BUG-003 — Targeted Course Self-Enrollment Bypass
- **Original Finding:** Excluded trainees could self-enroll in `targeted` or `hidden` courses via `POST /api/courses/:id/enrollments` (`201 Created`) and forge `sourceType="group"`.
- **Root Cause:** `CourseEnrollmentsView.post` and `enroll_user_in_course` omitted course visibility/eligibility checks and unprivileged `sourceType` restrictions.
- **Changed Files:** `backend/apps/learning/api/views/learning.py`, `backend/apps/learning/services/learning_service.py`, `backend/apps/courses/api/views/courses.py`, `backend/apps/groups/api/views/groups.py`, `backend/apps/groups/services/group_service.py`, plus aligned test fixtures (`test_bp09_enrollment_and_progress.py`, `test_bp10_assessments_and_certificates.py`, `test_bp12_cross_feature_integration.py`).
- **Applied Correction:** Enforced `is_course_visible_to_trainee` and blocked `access_mode == "hidden"` and client-supplied `"group"`/`"qr_code"` sources for non-staff self-enrollment in `CourseEnrollmentsView.post`; added defense-in-depth `allow_privileged_source` enforcement inside `enroll_user_in_course`.
- **Regression Tests:** `Sprint01SecurityRemediationTests.test_bug003_targeted_and_hidden_course_enrollment_authorization`.
- **Verification Evidence:** Verified on SQL Server `test_MetroLMS`: excluded trainee (`403`, `0` rows), hidden self-enroll (`403`, `0` rows), spoofed group (`403`), eligible trainee (`201`, duplicate idempotent = `1` row), admin enrollment (`201`); full suite `64/64` passed.
- **Remaining Risks:** None in tested API paths.
- **Status:** **FIXED**

---

### 4. BUG-004 — Cross-Lecturer Media IDOR & MIME Repair
- **Original Finding:** Any lecturer could bind another lecturer's `MediaAsset` into courses or group materials via `mediaAssetId`, and `_repair_material_file_record` attached arbitrary `MediaAsset` rows by MIME type when `sizeBytes <= 0`.
- **Root Cause:** Missing asset ownership/context authorization in `attach_media_reference`, `repoint_media_reference`, `save_course_draft`, and `AdminGroupMaterialFilesView.post`; heuristic fallback query in `_repair_material_file_record`.
- **Changed Files:** `backend/apps/media/services/media_service.py`, `backend/apps/courses/services/course_service.py`, `backend/apps/groups/api/views/groups.py`.
- **Applied Correction:** Added shared `is_actor_authorized_for_media_asset()` and enforced it across `attach_media_reference`, `repoint_media_reference`, all 3 attachment points in `save_course_draft`, and `AdminGroupMaterialFilesView.post`; removed the MIME-only fallback branch from `_repair_material_file_record` and scoped `media_id` lookup to `groups/group_<id>/`.
- **Regression Tests:** `Sprint01SecurityRemediationTests.test_bug004_cross_lecturer_media_idor_and_repair_protection`.
- **Verification Evidence:** Passed on SQL Server `test_MetroLMS` (`403` & `0` `MediaContentReference` rows on cross-lecturer `/api/media/references`, draft save, and group material attach; orphan repair produces no `mediaAssetId`/`url`; admin workflow succeeds).
- **Remaining Risks:** None identified.
- **Status:** **FIXED**

---

### 5. BUG-005 — Unpublished `CourseDraft` Leakage
- **Original Finding:** Trainee reads (`GET /api/courses/:id`, `/api/courses`, `/api/enrollments/my`) exposed unpublished `CourseDraft` edits whenever a draft existed alongside `PublishedCourseVersion`.
- **Root Cause:** `CourseListSerializer` and `CourseSerializer` unconditionally preferred `CourseDraft` over `PublishedCourseVersion`.
- **Changed Files:** `backend/apps/courses/api/serializers/courses.py`, `backend/apps/courses/api/views/courses.py`, `backend/apps/learning/api/views/learning.py`.
- **Applied Correction:** Added `_can_serializer_use_draft(obj, context)` honoring `published_only=True` and user draft-editing role/assignment checks across list prefetch and instance methods (`_get_draft`), and passed `request` / `published_only` contexts from catalog, lecturer, and enrollment views.
- **Regression Tests:** `Sprint01SecurityRemediationTests.test_bug005_published_course_hides_unpublished_draft_edits_from_trainees`.
- **Verification Evidence:** Passed on SQL Server `test_MetroLMS` (trainee sees only `PublishedCourseVersion` v1 across detail, catalog, and `/enrollments/my` with `hasDraft=False`; draft-only returns `404` for trainee; owner lecturer & admin retain draft view).
- **Remaining Risks:** None identified.
- **Status:** **FIXED**

---

### 6. BUG-006 — Iframe XSS & Unsafe URL Handling
- **Original Finding:** `ReviewContentPreview.tsx` routed `allow-scripts allow-same-origin` iframes using `.includes()` substring checks; `DocumentViewer.tsx`, `GroupMaterialViewerModal.tsx`, and `ItemEditorModal.tsx` lacked iframe `sandbox` restrictions; `sanitizeSafeUrl` permitted `//` protocol-relative URLs; `DocumentViewer.tsx` omitted `credentials` on fetch.
- **Root Cause:** Absence of strict `URL()` hostname/protocol validation, unsandboxed frames, and external fallback on fetch failure.
- **Changed Files:** `frontend/src/core/utils/safeUrl.ts`, `frontend/src/features/course-review/components/ReviewContentPreview.tsx`, `frontend/src/features/learning-player/components/DocumentViewer.tsx`, `frontend/src/features/groups/components/GroupMaterialViewerModal.tsx`, `frontend/src/features/course-builder/components/ItemEditorModal.tsx`, `frontend/src/test/sprint01-security-remediation.test.tsx`.
- **Applied Correction:** Blocked `//`, `\/`, and ASCII control characters in `sanitizeSafeUrl`; implemented `getSafeYouTubeEmbedUrl`, `getSafeGoogleDrivePreviewUrl`, `getSafeOfficeEmbedUrl`, and `isSafePreviewFrameUrl`; enforced them across all iframe embeds; changed local PDF frames to `sandbox="allow-same-origin"` (omitting `allow-scripts`); removed `allow-same-origin` on third-party Office embeds; added `credentials: 'same-origin'` and HTML/SVG MIME rejection to `DocumentViewer.tsx`.
- **Regression Tests:** `frontend/src/test/sprint01-security-remediation.test.tsx` (`6/6`) and `frontend/src/test/video-embed-policy.test.tsx` (`33/33`).
- **Verification Evidence:** `npx vitest run` passed `39/39` tests; `tsc -b --noEmit` reported `0` errors across all edited TS/TSX files.
- **Remaining Risks:** Live Chrome PDF/video visual rendering blocked by `BUG-025` (`DevToolsActivePort` ENOENT).
- **Status:** **FIXED**

---

### 7. BUG-016 — Spoofable IP Rate Limiting (`X-Forwarded-For`)
- **Original Finding:** `get_client_ip` blindly trusted the leftmost `HTTP_X_FORWARDED_FOR` entry, allowing trivial IP lockout evasion.
- **Root Cause:** Missing trusted reverse-proxy allowlist and right-to-left header walking.
- **Changed Files:** `backend/apps/identity/services/login_rate_limit.py`, `backend/config/settings/base.py`, `backend/.env.example`.
- **Applied Correction:** Configured `METROLMS_TRUSTED_PROXY_IPS` (default `[]`, fail-closed); updated `get_client_ip` to ignore `X-Forwarded-For` unless `REMOTE_ADDR` matches a configured trusted proxy IP/CIDR, walking right-to-left across trusted proxy hops to extract the rightmost untrusted valid client IP.
- **Regression Tests:** `Sprint01SecurityRemediationTests.test_bug016_ip_derivation_ignores_spoofed_xff_and_honors_trusted_proxies`.
- **Verification Evidence:** Passed on SQL Server `test_MetroLMS`: direct requests ignore forged `X-Forwarded-For` and trigger `429` despite rotating headers; trusted proxies parse right-to-left accurately; distinct client IPs remain isolated.
- **Remaining Risks:** Operators deploying behind IIS ARR must explicitly populate `METROLMS_TRUSTED_PROXY_IPS=127.0.0.1` in `.env` during Track 3/deployment.
- **Status:** **FIXED**

---

## Aggregate Test Execution Record (Post-Final-Edit)

1. **Django Check & Full Backend Suite (Real Microsoft SQL Server `test_MetroLMS`):**
   - Command: `.\.venv\Scripts\python.exe manage.py check` → Exit `0` (`0` issues).
   - Command: `.\.venv\Scripts\python.exe manage.py test --verbosity=1` → **`Ran 64 tests in 403.968s — OK`** (`64` passed, `0` failed across all `16` test modules).
2. **Frontend Security & Embed Vitest Suites (`jsdom`):**
   - Command: `npx vitest run src/test/sprint01-security-remediation.test.tsx src/test/video-embed-policy.test.tsx` → **`Test Files 2 passed (2) | Tests 39 passed (39)`**.
3. **Frontend TypeScript Check on Edited Files:**
   - Command: `npx tsc -b --noEmit` → **`0` errors across all edited Sprint 1 files** (`EDITED_TS_ERROR_COUNT=0`; pre-existing repository TS errors remain in untouched files per Sprint 1 scope rules).
4. **Dual Bundle Build Verification:**
   - `npx vite build --mode staging --outDir dist-staging` → Succeeded (`hasCards=True`, `hasMock=False`).
   - `npx vite build --outDir dist-prod` → Succeeded (`0` `MetroTest@2026`, `ROLE_TEST_ACCOUNTS`, or `inMemoryStore` matches).
   - Note: An older external lock prevented overwriting `frontend/dist/assets` (`EPERM`); temp `dist-staging`/`dist-prod` directories were verified and cleaned up.
5. **Browser Live E2E (`chrome_devtools` MCP / Playwright):** **BLOCKED** (`DevToolsActivePort` ENOENT; Playwright not installed).
