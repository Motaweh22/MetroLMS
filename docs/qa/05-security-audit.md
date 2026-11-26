# MetroLMS — Phase 5: Comprehensive Application Security Audit (`05-security-audit.md`)

> **Audit Basis:** Verified against real Django views, middleware, permissions, services, SQL Server models, React frontend components, built production bundle (`frontend/dist/`), and live HTTP responses from Django + `test_MetroLMS`. All security findings are strictly classified as `Confirmed Defect`, `Architecture Risk`, or `Working and Verified` with zero speculation.

---

## 1. Authentication, Session Handling, CSRF & Brute-Force Protection

| Control | Actual Implementation & Observed Evidence | Verdict |
|---|---|---|
| **Login CSRF (`POST /api/auth/login`)** | `LoginView` (`backend/apps/identity/api/views/auth.py:51-56`) sets `permission_classes = [AllowAny]` without `@method_decorator(csrf_protect)`. Unauthenticated DRF `SessionAuthentication` returns `None` without calling `enforce_csrf`, allowing cross-site forged logins. Verified in live HTTP test: `POST /api/auth/login` with **no** `X-CSRFToken` returned **`200 OK`** and issued a session. (`LogoutView`, `auth.py:93-106`, also relies on `AllowAny` without explicit `csrf_protect` decorator.) | **Confirmed Defect (Critical)** |
| **Session Storage & `HttpOnly` / CSRF Cookie** | `auth_service.py:16-22` uses Django `login()`, `rotate_token(request)`, and binds `ServerSession.user`. `GET /api/auth/csrf` returned `Set-Cookie: csrftoken=...; Max-Age=31449600; Path=/; SameSite=Lax`. In `backend/config/settings/production.py:6-7`, `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` default `"True"` cleanly, **except** `start-production.bat` deploys `config.settings.development` (`DEBUG=True`, `SESSION_COOKIE_SECURE=False`). (Direct browser `document.cookie` check on live Chrome remains unverified due to `DevToolsActivePort` blocker.) | **Architecture Risk / High** |
| **Production Credential & Test-Card Exposure** | `Dockerfile.windows:29-31` and `start-production.bat:106` set `VITE_SHOW_TEST_CARDS=true` during production build; `LoginForm.tsx:40-41` renders clickable role quick-login cards (`DemoAccountPicker.tsx`) when `VITE_SHOW_TEST_CARDS === 'true'`; built bundle `frontend/dist/assets/index-CxIEj1u-.js` embeds literal `'MetroTest@2026'` and static mock store (`Demo/mocks/store/inMemoryStore.ts`). | **Confirmed Defect (Critical)** |
| **Brute-Force / Rate-Limit Bypass (`X-Forwarded-For`)** | Per-phone lockout triggered `HTTP 429` as designed in live HTTP test (`J8`). However, `get_client_ip` (`backend/apps/identity/services/login_rate_limit.py:36-43`) blindly trusts the leftmost `HTTP_X_FORWARDED_FOR` entry. Rotating spoofed `X-Forwarded-For` headers in live testing bypassed IP throttling completely. | **Confirmed Defect (High)** |

---

## 2. Authorization, RBAC, Governance & IDOR Vulnerabilities

| Finding | File & Line Evidence | Verified Behavior / Attack Impact | Severity |
|---|---|---|---|
| **Targeted Course Self-Enrollment Bypass** | `Learning` enrollment view & `enroll_user_in_course` (`backend/apps/learning/services/learning_service.py:123-195`) | A trainee excluded from a targeted course (`visible_in_cat=False`) sent `POST /api/courses/:id/enrollments` `{}` and received **`201 Created`** (`Enrollment created=True` in SQL Server). Clients can also supply `sourceType="group"` with an arbitrary `trainingGroupId`. | **Critical** |
| **Cross-Course / Cross-Lecturer Media IDOR** | `attach_media_reference` (`backend/apps/media/services/media_service.py:207-245`) & course/group attachment flows | `lecturer_a` attached a `MediaAsset` owned by `lecturer_b` without ownership verification → **`201 Created`** (`MediaContentReference created=True`). Additionally, `_repair_material_file_record` (`groups.py:1104-1112`) can bind an unrelated latest `MediaAsset` of matching MIME when `sizeBytes <= 0`. | **Critical** |
| **Unpublished `CourseDraft` Leakage** | `CourseListSerializer._prefetch_courses` / `CourseSerializer.get_modules` (`serializers/courses.py:154-160, 459-467`) | Whenever a `CourseDraft` row exists on a published course, trainee `GET /api/courses/:id` returns unpublished draft module titles (`'وحدة مسودة سرية'`) instead of `PublishedCourseVersion`. | **Critical** |
| **Un-executed Governance Approvals (`INV-R9`) & Capability Bypass** | `ApprovalDecisionView.post` (`governance.py:110`); `has_capability` (`backend/shared/permissions/drf_permissions.py:12-27`) | Approving a `PendingApprovalRequest` passes `executor_fn=None`, marking `execution_status="Executed"` (`200 OK`) with **zero** state change on the target entity in SQL Server. Separately, `has_capability` (`drf_permissions.py:24`) returns `decision.granted and decision.execution_mode == "direct"`, breaking `202 Accepted` staging (`INV-R9`). | **High** |
| **Hidden Group Materials Exposed in JSON** | `AdminGroupMaterialsView.get` (`groups.py:1158-1164`), `GroupMaterialsTab.tsx:227, 241` | Hidden (`isVisible=false`) group folders and materials are returned in plaintext JSON to trainees and filtered solely in the browser DOM (`hidden_leaked_in_json=True`). | **High** |
| **Removed Group Members Retain Access (`D-07`)** | `AdminGroupMemberDeleteView.delete` (`groups.py:1000-1016`) | Removing a member ignores `removeCourseIds` and leaves `learning_enrollmentsourcegrant.is_active=True`, allowing unauthorized continued access. | **High** |
| **Archived Groups Still Accessible to Trainees** | `MyGroupsView` (`D-GRP-07`) | Live HTTP check confirmed archived groups remain visible (`archived_seen=True`) in trainee `GET /api/groups/my`. | **Medium** |
| **Security Audit Page Role Exclusion** | `frontend/src/pages/SecurityAuditPage.tsx:157` | Frontend checks `!user \|\| user.role !== 'admin'`, blocking `super_admin` and `developer` in the UI even after firing the audit request. | **Medium** |
| **Revoked Enrollment Reached `archive-zip`** | `courses.py:1558` | Revoked enrollment check was not rejected early on `GET /api/courses/:id/archive-zip` (`404` returned only due to missing attached media on snapshot). | **Medium** |
| **`INV-R8` Developer Concealment** | `drf_permissions.py:30-35`, `get_visible_user_or_none` | Verified working: developer excluded from `/api/admin/users` (`dev_in_list=False`) and non-developer lookups return `404`. | **Working and Verified** |

---

## 3. XSS, Client URL Validation, Iframe Isolation & Media Security

1. **Unvalidated URLs in Privileged Sandboxed `<iframe>` (`ReviewContentPreview.tsx:798-812, 947-984`):**
   - Renders `activeItem.url || activeItem.externalUrl` inside `<iframe sandbox="allow-scripts allow-same-origin" ...>` using naive substring checks (`.includes('drive.google.com')`, `.includes('officeapps.live.com')`, `.includes('onedrive')`, `.includes('sharepoint')`).
   - Attacker-controlled URLs containing `'sharepoint'` or `'drive.google.com'` in a query/path bypass domain validation and execute scripts in an `allow-scripts allow-same-origin` frame.
2. **Unsandboxed PDF/Document `<iframe>` (`DocumentViewer.tsx:228-233`, `GroupMaterialViewerModal.tsx:88-93`):**
   - Renders `<iframe>` without any `sandbox` attribute; `DocumentViewer.tsx` falls back directly to `item.url` if `documentBlobUrl` is falsy.
   - `DocumentViewer.tsx:80, 104` also uses bare `fetch(...)` without `credentials` (`'same-origin'`/`'include'`).
3. **Protocol-Relative Bypass in `sanitizeSafeUrl` (`frontend/src/core/utils/safeUrl.ts:13-15`):**
   - `if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;` allows `//attacker.example/...` as an unblocked external scheme-relative redirect/resource URL.

---

## 4. Infrastructure, Secrets, Security Headers & Logging

1. **Insecure Default `SECRET_KEY` Without Production Fail-Fast (`backend/config/settings/base.py:25`, `production.py:1-14`):**
   - `base.py:25` falls back to `"dev-insecure-placeholder-key"` if `DJANGO_SECRET_KEY` is unset. `production.py` does not raise `ImproperlyConfigured` when the placeholder is still active, and `start-production.bat` uses `config.settings.development` (`DEBUG=True`).
2. **Missing HSTS, CSP & `LOGGING` Configuration:**
   - Live HTTP response headers from Django (`GET /api/auth/csrf`, `POST /api/auth/login`) confirmed `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, **and confirmed absence of `Strict-Transport-Security` and `Content-Security-Policy`**.
   - Settings lack a structured Django `LOGGING` dictionary for persistent security/error audit logs on Windows Server.
3. **Production Runtime Dependency Drift (`requirements.txt`):**
   - `base.py:72` inserts `whitenoise.middleware.WhiteNoiseMiddleware` when `METROLMS_SERVE_FRONTEND=True`, yet `whitenoise` is absent from `backend/requirements.txt` (verified earlier runtime hazard if unified single-port mode is enabled under `.venv`).
