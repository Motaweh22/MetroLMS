# MetroLMS — Phase 3: End-to-End User Journey & Functional Verification (`03-user-journey-audit.md`)

> **Verification Scope & Honesty Statement:**
> - **Executed Real Stack (Verified):** Live Django WSGI server (`LiveServerTestCase` / `ThreadedWSGIServer`) connected directly to Microsoft SQL Server (`MSSQLSERVER` → isolated `test_MetroLMS` database) using real TCP HTTP sessions (`requests.Session`), real bcrypt/PBKDF2 password hashes, real SQL Server ORM/constraints, real file storage & `MediaStreamView` HTTP `206`, and real built production frontend bundle inspection (`frontend/dist/`). MSW was **not** used.
> - **Browser UI Runtime via Chrome DevTools MCP (`Environment Blocker / Unverified UI Click-Through`):** Attempting to attach the live `browser` subagent to `http://127.0.0.1:4173/` (`vite preview` serving `frontend/dist/` proxied to live Django `:8099` + `test_MetroLMS`) failed with:
>   `Could not find DevToolsActivePort for chrome at C:\Users\Administrator\AppData\Local\Google\Chrome\User Data\DevToolsActivePort (ENOENT)`.
>   Playwright is also not installed in `frontend/`. Therefore, client-side SPA browser rendering/navigation flows were verified only up to built-SPA HTTP delivery (`GET /login` → `200 text/html`), static/TS/Vitest code inspection, and exact API payload alignment against real Django + SQL Server endpoints; interactive Chrome DOM state transitions are explicitly marked **Unverified Functionality (Environment Blocker)** rather than claimed as passed.

---

## Summary Matrix Across All 6 Roles & 8 Core Journeys

| Journey ID | Workflow | Personas | Execution Mode | Final Status | Critical Finding |
|---|---|---|---|---|---|
| **J1** | Entry, Production Bundle Check, Login CSRF, Session Lifecycle, Logout | Anonymous → All Roles | Real Built Bundle + Real Django/SQL Server HTTP | **FAIL (Confirmed Defects)** | Built JS leaks `MetroTest@2026` + renders `DemoAccountPicker`; `POST /api/auth/login` accepts requests **without** `X-CSRFToken` (`200 OK`) |
| **J2** | RBAC Enforcement, Role Preview (`INV-R8`), Delegated Authority, `PendingApprovalRequest` (`INV-R9`) | Trainee, Developer, Admin, Super Admin | Real Django/SQL Server HTTP | **FAIL (Confirmed Defects)** | `INV-R8` & `AdminUsersView` `403` pass; Delegated Authority frontend payload `{enabled}` fails (`400`); `PendingApproval` approve marks `"Executed"` with **zero DB mutation** (`User.status` stays `Active`) |
| **J3** | Lecturer Course Authoring, Cross-Lecturer Media IDOR, Submission, Review, Reset Lab | Lecturer, Admin | Real Django/SQL Server HTTP | **FAIL (Confirmed Defects)** | Draft + review + publish works (`version=1`), **but** cross-lecturer arbitrary `mediaAssetId` attachment succeeds (`201`), `POST .../reset-lab` returns `404` |
| **J4** | Trainee Visibility, Targeted Course Self-Enrollment Bypass, Draft Leak, Video Stream, Quiz Bypass | Trainee | Real Django/SQL Server HTTP | **FAIL (Confirmed Defects)** | Targeted hidden course `visible_in_cat=False`, **but** trainee self-enrollment succeeds (`201`); unpublished `CourseDraft` leaked in `GET /api/courses/:id`; `/items/:id/complete` sets `progressPercent=100` bypassing quiz grading; HTTP `206` stream PASS |
| **J5** | Groups: QR Join, Materials (`isVisible`), `D-07` Removal, Archived Visibility, Meetings, Auto-Renewal | Admin, Trainee | Real Django/SQL Server HTTP | **FAIL (Confirmed Defects)** | QR Join `{enrollmentCode}` → `400` (`token` expected); hidden (`isVisible: false`) material leaked in JSON; `D-07` delete leaves `EnrollmentSourceGrant.is_active=True`; archived group remains in `/api/groups/my`; `PUT` `{resources}` ignored; `/check-auto-renewal` stubbed `False` |
| **J6** | Comments Moderation Toggle, Certificates Lifecycle, Archive ZIP Export | Admin, Trainee | Real Django/SQL Server HTTP | **PARTIAL / FAIL** | Certificates (`issue`, `verify`, `revoke`) **PASS**; `PATCH .../comments-toggle` (`false`) returns `200` yet trainee `POST .../comments` still returns `201` (`courses_coursecomment count=1`); revoked enrollment reached `archive-zip` (`404` only due to missing attached media on published snapshot) |
| **J7** | User Lifecycle Deletion (`D-01`, `D-03`) & Cascade Cleanup | Admin | Real Django/SQL Server HTTP | **PARTIAL / FAIL** | `D-03` blocks deleting primary lecturer (`409` **PASS**); `D-01` user delete (`200`) leaves open `PendingApprovalRequest` rows `"Pending"` |
| **J8** | Rate Limiting & Header / Brute-Force Protection | Unauthenticated Attacker | Real Django/SQL Server HTTP | **PARTIAL / FAIL** | Per-phone `429` lockout triggered reliably; IP rate limit easily bypassed by rotating `X-Forwarded-For` headers |

---

## Detailed Journey Traces

### J1 — Landing, Production Bundle Cleanliness, Auth, CSRF, Cookies & Logout
- **Prerequisites:** Clean `test_MetroLMS` SQL Server schema; production frontend built via `npm run build` (`frontend/dist/`).
- **Steps Executed:**
  1. Scanned `frontend/dist/assets/*.js` (`56` JS chunks) and requested `GET http://127.0.0.1:4173/login` (`HTTP 200 text/html`).
  2. Sent `GET /api/auth/me` unauthenticated → **`401 UNAUTHENTICATED` PASS**.
  3. Sent `POST /api/auth/login` **without** `csrftoken` cookie or `X-CSRFToken` header → **`200 OK` FAIL** (Login CSRF possible because `LoginView` sets `permission_classes = [AllowAny]` without `@method_decorator(csrf_protect)`).
  4. Sent invalid password → **`401 INVALID_CREDENTIALS`** returning `{"remainingAttempts": 4}` **PASS**.
  5. Obtained CSRF via `GET /api/auth/csrf` (`Set-Cookie: csrftoken=...; Path=/; SameSite=Lax`, plus headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`), authenticated via `POST /api/auth/login` (`phoneNumber` + password), verified `GET /api/auth/me` returned active user DTO (`200`), then called `POST /api/auth/logout` (`200`) and verified subsequent `GET /api/auth/me` returned `401`.
- **Actual Defects Observed:**
  - Built JS chunk `index-CxIEj1u-.js` embeds literal `'MetroTest@2026'` and default `DemoAccountPicker` renders unless `VITE_SHOW_TEST_CARDS=false` is explicitly set (`Dockerfile.windows:29-31` & `start-production.bat:106` set `true`).
  - Browser DOM login/reload persistence via Chrome DevTools could not be executed due to `DevToolsActivePort (ENOENT)`.

---

### J2 — RBAC, Developer Role Preview (`INV-R8`), Delegated Authority & `PendingApprovalRequest` (`INV-R9`)
- **Prerequisites:** Seeded `developer`, `super_admin`, `admin`, `assistant_admin`, `lecturer`, and `trainee` users in `test_MetroLMS`.
- **Steps Executed:**
  1. Verified `developer` user exclusion from `/api/admin/users` (`dev_in_list=False`) and blocked access to `/api/admin/audit-logs` / private endpoints unless authorized (**PASS** for `INV-R8` separation; transcript check `HTTP 404` **PASS**).
  2. Authenticated as `trainee` and requested `GET /api/admin/users` → **`403` PASS**.
  3. Authenticated as `super_admin` and called `POST /api/admin/permissions/governance/delegation/:userId` using frontend payload `{"enabled": true}` (`permissionsApi.ts:141-148`) → **`400 VALIDATION_ERROR`** (`{"fieldErrors": {"capabilityKey": ["هذا الحقل مطلوب."]}}`) **FAIL**.
  4. Created a `PendingApprovalRequest` targeting deactivation/change on a user and approved it via `POST /api/admin/permissions/governance/approvals/:id/decide` → API returned **`200 OK`**, `governance_pendingapprovalrequest.execution_status` transitioned to `"Executed"`, **but `identity_user.status` remained `"Active"`** because `ApprovalDecisionView.post` (`governance.py:110`) calls `decide_pending_approval(..., executor_fn=None)` **FAIL**.

---

### J3 — Course Authoring, Media IDOR, Submission, Approval & Builder Actions
- **Prerequisites:** Two distinct `lecturer` accounts (`lecturer_a`, `lecturer_b`), uploaded `MediaAsset` belonging to `lecturer_b`, `admin` reviewer.
- **Steps Executed & Evidence:**
  1. `lecturer_a` saved draft & attached `lecturer_b`'s arbitrary `mediaAssetId` via `MediaContentReference` / draft payload → **`201 Created` (`MediaContentReference created=True`) FAIL (Media IDOR)**.
  2. `lecturer_a` created course draft, submitted for review, and `admin` called review approval (`decide_course_review`) → **`200 OK`, `published_version_number=1` PASS**.
  3. Sent `POST /api/lecturer/courses/:courseId/reset-lab` (called by `builderApi.resetContentLab`, `builderApi.ts:65-70`) → **`404 RESOURCE_NOT_FOUND` FAIL**.

---

### J4 — Trainee Discovery, Enrollment Bypass, Draft Leak, Video Stream & Quiz Completion
- **Prerequisites:** Targeted/hidden published course (`access_mode` restricted so not in trainee catalog), draft update saved after publishing containing unpublished module title `'وحدة مسودة سرية'`, published MP4 video asset + `quiz` lesson item.
- **Steps Executed & Evidence:**
  1. Verified `GET /api/courses` omitted targeted course (`visible_in_cat=False`).
  2. Sent `POST /api/courses/:targetedCourseId/enrollments` as excluded trainee with `{}` → **`201 Created`, `Enrollment created=True` in SQL Server FAIL**.
  3. Trainee called `GET /api/courses/:publishedWithDraftId` → response payload contained `'وحدة مسودة سرية'` from unpublished `CourseDraft` instead of immutable `PublishedCourseVersion` **FAIL**.
  4. On legitimately enrolled course (`Enrollment count=1`):
     - Requested stream ticket (`GET /api/courses/:id/lessons/:lid/stream-ticket` → `200`) and fetched `/api/media/stream/<ticket>` with `Range: bytes=0-15` → **`206 Partial Content` PASS** (Note: `<video>` visual decoding in Chrome DOM remains **Unverified** due to `DevToolsActivePort (ENOENT)`).
     - Completed `quiz` lesson via `POST /api/courses/:id/items/:quizItemId/complete` without calling `.../quiz/submit` → **`200 OK`, `progressPercent=100` PASSES BYPASS / FAIL (Business Logic Defect)**.

---

### J5 — Training Groups, QR Join, Materials, Removal (`D-07`), Archives & Auto-Renewal
- **Steps Executed & Evidence:**
  1. Submitted `POST /api/groups/join` with frontend key `{"enrollmentCode": "<valid_token>"}` (`groupsApi.ts:87-91`) → **`400 VALIDATION_ERROR` (`"رمز الانضمام مطلوب."`) FAIL**.
  2. Inspected trainee `GET /api/groups/:id/materials` when group contains an `isVisible=false` item → hidden record returned in API JSON (`hidden_leaked_in_json=True`) **FAIL**.
  3. Removed group member via `DELETE /api/admin/groups/:id/members/:userId` with `removeCourseIds` (`D-07`) → **`200 OK`**, yet SQL Server `learning_enrollmentsourcegrant.is_active` remained **`True` FAIL**.
  4. Archived group (`D-GRP-07`) and called trainee `GET /api/groups/my` → archived group still returned (`archived_seen=True`) **FAIL**.
  5. Called `PUT /api/admin/groups/:id` with `{resources: [...]}` (`GroupMeetingsTab.tsx:111-113`) → **`200 OK`**, DB `GroupResource.exists=False` **FAIL**.
  6. Called `POST /api/admin/groups/:id/check-auto-renewal` → **`200 OK` stub `{renewed: false}` FAIL**.

---

### J6 — Comments Moderation, Certificates & Archive ZIP
- **Steps Executed & Evidence:**
  1. Admin sent `PATCH /api/admin/courses/:id/comments-toggle` with `{"commentsEnabled": false}` → returned **`200 OK`**, yet trainee immediately sent `POST /api/courses/:id/comments` → **`201 Created`** (`courses_coursecomment count=1`) **FAIL**.
  2. Trainee completed course, issued certificate (`201`), verified public certificate code (`verify before=True`), admin revoked certificate (`200`, `revoked_at` persisted in SQL Server), re-verified code (`verify after revoke=False`) → **PASS**.
  3. Revoked trainee requested `GET /api/courses/:id/archive-zip` → reached file assembly step (`404` only because published snapshot lacked an attached `MediaContentReference`, confirming `courses.py:1558` fails to reject revoked enrollment status).

---

### J7 & J8 — User Deletion (`D-01`, `D-03`) & Rate-Limit Resilience
- **Steps Executed & Evidence:**
  1. Attempted `DELETE /api/admin/users/:primaryLecturerId` (`D-03`) → **`409 Conflict` PASS**.
  2. Executed `DELETE /api/admin/users/:userWithOpenApproval` (`D-01`) → **`200 OK`, `User exists=False`**, yet linked `governance_pendingapprovalrequest` remained `"Pending"` **FAIL**.
  3. Sent repeated failed logins for one phone while rotating `X-Forwarded-For` headers → per-phone `429` triggered on attempt threshold (**PASS**), confirming IP bucket was evaded via spoofable `X-Forwarded-For` header (**FAIL**).
