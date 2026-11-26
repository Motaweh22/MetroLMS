# MetroLMS — Phase 6: Test Coverage & Verification Assessment (`06-test-coverage-assessment.md`)

> **Verification Basis:** Every test count, exit status, and duration below was observed directly by running commands in this session against `d:\LMS MEtro Project`. No test outcomes were fabricated, extrapolated, or relaxed.

---

## 1. Execution Summary Across All Testing Layers

| Verification Layer | Command / Mechanism | Environment / Target | Observed Result | Trustworthiness & Blind Spots |
|---|---|---|---|---|
| **Static Check: Django** | `.\.venv\Scripts\python.exe manage.py check` | Real Django config | **PASS** — Exit `0` (`System check identified no issues (0 silenced).`) | Verifies app wiring only; does not catch view/serializer runtime or contract bugs |
| **Static Check: Frontend ESLint** | `npm run lint` (`frontend/`) | Frontend source & tests | **FAIL** — `229 problems (209 errors, 20 warnings)` (`AuthContext.tsx`, `authStorage.ts`, `core/courses/types.ts`, `policy.ts`, `CommentModerationPage.tsx`, `DecisionModal.tsx`, `test/*`, etc.) | Exposes real lint regressions, React hooks/type issues masked by `\|\| true` scripts or unblocked CI |
| **Static Check: TypeScript** | `npx tsc -b --noEmit` (`frontend/`) | Frontend TS + `Demo/mocks` | **FAIL** — Exit `2`, **`511` total TS errors**: `6` in `frontend/src/` (`ReviewInspector.tsx:427` x2, `ApprovalsPage.tsx:405,704` x2, `CourseBuilderPage.tsx:854` x2), `16` in `Demo/mocks/`, `489` in `src/test/*.ts(x)` | Production `src/` fails strict compilation; `vite build` skips `tsc` typechecking (`npx tsc` is broken) |
| **Unit & Component Tests (Frontend)** | `npm test` (`vitest run`) | jsdom + **MSW / Mocks** | **FAIL** — Exit `1`: **`Test Files: 58 failed \| 42 passed (100)`**; **`Tests: 390 failed \| 1768 passed (2158)`** | **Zero real backend proof:** runs against MSW/in-memory stores and suffers widespread stale test breakage |
| **Backend Automated Suite** | `.\.venv\Scripts\python.exe manage.py test --verbosity=1` | Real Django + **SQL Server (`test_MetroLMS`)** | **PASS** — **`Ran 58 tests in 341.732s — OK`** (`0` failures, `0` errors across `15` test modules) | Genuine SQL Server coverage, **but misses** cross-stack contract breaks (`INT-01`..`INT-14`), Login CSRF, Media IDOR, Self-enrollment bypass, Quiz bypass, and `ApprovalDecisionView` no-op execution |
| **Real HTTP + SQL Server E2E (QA Script)** | Live `LiveServerTestCase` TCP HTTP + SQL Server `test_MetroLMS` | Real Django WSGI + SQL Server | **Executed (`47.396s`)** — Exposed 15+ real behavioral & security defects alongside verified working flows (`INV-R8`, `D-03`, Certificates, Media `206`, per-phone `429`) | **Highest-signal test run**; proved working backend tests missed frontend payload mismatches and authorization bypasses |
| **Real Production Bundle Build** | `vite preview` + static `frontend/dist/` scan | `frontend/dist/` (`56` JS files) | **Executed** — `GET /login` → `200 text/html`; chunk `index-CxIEj1u-.js` confirmed leaking `MetroTest@2026` + `DemoAccountPicker` | Proved production leakage missed by `verify-production-cleanliness.mjs` |
| **Live Browser E2E (Chrome)** | Chrome DevTools MCP + `vite preview` (`:4173`) → Django (`:8099`) | Chrome + SPA + SQL Server | **Environment Blocker** (`DevToolsActivePort (ENOENT)`); Playwright not installed | Interactive DOM rendering, `<video>` media decoding, cookie visibility in browser JS, and client redirects remain **Unverified in live Chrome** |

---

## 2. Backend SQL Server Test Inventory (`15` Active Test Modules, `58` Tests)

Observed under `backend/apps/`:
- `identity`: `test_bp01_schema_and_normalization.py`, `test_bp02_auth_and_sessions.py`, `test_bp03_rbac_and_invariants.py`, `test_bp12_cross_feature_integration.py`, `test_user_public_overview.py`
- `organization`: `test_bp04_organization_and_hr.py`
- `governance`: `test_bp05_governance_and_audit.py`
- `courses`: `test_bp06_courses_and_curriculum.py`, `test_course_access_and_qr.py`
- `media`: `test_bp07_media_management.py`
- `groups`: `test_bp08_groups_and_renewals.py`, `test_group_no_deadline.py`
- `learning`: `test_bp09_enrollment_and_progress.py`, `test_bp10_assessments_and_certificates.py`
- `communications`: `test_bp11_communications_and_scheduling.py`

### Why `58/58` Backend Tests Passed While Critical Production Flows Still Fail
1. **Test Payload Mismatch vs. Real Frontend:** Backend tests send backend-expected keys (`token` for QR join, `capabilityKey` for delegation, `POST .../resources` for group meetings, `/quiz/submit` for quizzes) and therefore never detected that `frontend/src/` sends `enrollmentCode`, `{enabled}`, `PUT .../groups/:id` `{resources}`, or `/items/:id/complete`.
2. **Untested Authorization Negative Paths:** Existing suites did not test:
   - Unauthenticated `POST /api/auth/login` **without** `X-CSRFToken`.
   - Trainee self-enrollment into a targeted/restricted course (`access_mode != all_trainees`) or forged `sourceType="group"`.
   - Cross-lecturer `mediaAssetId` attachment (`MediaAsset` ownership check).
   - Trainee `GET /api/courses/:id` when an edited `CourseDraft` coexists with `PublishedCourseVersion`.
   - Approval execution (`PendingApprovalRequest` DB side-effect verification after `ApprovalDecisionView`).
   - Group member deletion verifying `EnrollmentSourceGrant.is_active=False` (`D-07`), `comments-toggle` blocking subsequent comments, and hidden (`isVisible=false`) material omission.

---

## 3. Critical Coverage Gaps Requiring Real Integration & E2E Tests

1. **Type-Safety & CI Gates:** Zero clean CI gate exists today because `tsc -b` fails (`511` errors), ESLint fails (`229` problems), and Vitest fails (`58/100` files).
2. **Real Cross-Stack Contract Tests (No MSW):** No automated suite validates serialized frontend API calls (`frontend/src/features/*/services/*.ts`) against live Django serializers/URLs (`openapi-specification.yaml` / Django DRF test views).
3. **Browser E2E Automation:** Neither Playwright nor Cypress is installed in `frontend/`, leaving real Chrome DOM rendering, cookie/CSRF roundtrips, RTL layout, video `206` range playback in `<video>`, PDF iframe/blob previewing, and route guards unautomated against real Django + SQL Server.
4. **Concurrency & Scale Testing:** No multi-threaded / SQL Server lock contention test exists for `decide_course_review`, `save_course_draft`, enrollment grants, or SQL Server 2100-parameter `IN` list limits (`>2100` rows).
