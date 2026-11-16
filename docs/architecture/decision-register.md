# MetroLMS — Master Owner Decision Register & Documentation Authority Rules

> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Scope:** Single authoritative registry of all approved Owner decisions (`D-AUTH-01`, `D-DB-01`, `D-SEC-01`, `D-MEDIA-01`, `D-01`–`D-14`, `OD-01`–`OD-02`, Phase 5 Decisions `A, B, C, E, F`, historical Increment 11 decisions, and Phase B Group Domain Decisions `D-GRP-01`–`D-GRP-08`) and the binding Documentation Authority Hierarchy.  
> **Governance Rule:** Approved decisions are recorded once in this register. Other documents must link to these decision IDs rather than rewriting or altering their definitions. Never reopen an approved decision unless a newly discovered contradiction with the project objective is escalated for explicit Owner review.  
> **Last Updated:** 2026-11-11

---

## 1. Documentation Authority Hierarchy & Conflict Resolution Rules

When two or more documents in the repository contain differing requirements, dates, architectural assumptions, or implementation states, conflicts must be resolved strictly according to this **7-level authority order**:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                        MetroLMS Documentation Authority Hierarchy                                 |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
| LEVEL 1 (HIGHEST): Explicit & Accepted Owner Decisions                                            |
|   • Recorded in this register (D-AUTH-01, D-DB-01, D-SEC-01, D-MEDIA-01, D-01..D-14, OD-01..02,   |
|     and Phase 5 Decisions A, B, C, E, F).                                                         |
|                                                                                                   |
| LEVEL 2: Current Authoritative Architecture & Decision Records                                    |
|   • docs/architecture/*.md and docs/project-state/CURRENT.md.                                     |
|                                                                                                   |
| LEVEL 3: Approved Active Master Roadmap                                                           |
|   • docs/project-state/active-roadmap.md (reconciling the frozen Revision 5 baseline in           |
|     docs/backend/pre-backend-migration-remediation-roadmap.md with Phase A scope alignment).      |
|                                                                                                   |
| LEVEL 4: Current Domain-Specific Specifications & Business Rules                                  |
|   • docs/requirements/domain-business-rules.md, docs/frontend/architecture.md,                    |
|     docs/frontend/design-system.md, docs/frontend/loading-and-error-handling.md.                  |
|                                                                                                   |
| LEVEL 5: Current Implementation Documentation & API Integration Contracts                         |
|   • docs/backend/django-sqlserver-integration-contract.md.                                        |
|                                                                                                   |
| LEVEL 6: Verification Reports, Checklists & Checkpoint Records (Status Evidence Only)             |
|   • docs/project-state/checkpoints/*.md, docs/frontend/reports/*.md, docs/frontend/checklists/*.  |
|                                                                                                   |
| LEVEL 7 (LOWEST): Historical, Superseded & Archived Documents                                     |
|   • Archived SUP-01 cryptographic reports (v1.3–v3.26), legacy parity inventories, transcripts.   |
+───────────────────────────────────────────────────────────────────────────────────────────────────+
```

### Mandatory Operational Distinctions
1. **Implementation Reports Are Evidence, Not Authorization:** An implementation or audit report describes what was inspected or built; it does **not** authorize new product requirements or infrastructure scope.
2. **Checklists Are Acceptance Criteria, Not Primary Specifications:** A checklist verifies compliance with a specification; it does not replace the canonical business rule.
3. **Historical Reports Never Override Owner Decisions:** Newer approved Owner decisions (`D-DB-01` confirming Microsoft SQL Server, `D-AUTH-01` confirming Django server sessions) unconditionally supersede provisional assumptions in older documents (such as PostgreSQL 16 in `database-schema.md` or KMS/HSM fencing in SUP-01 reports).
4. **Frozen Roadmaps Remain Unmodified:** Frozen baselines (`pre-backend-migration-remediation-roadmap.md`, `implementation-roadmap.md`, `implementation-roadmap-increment-11.md`) are preserved intact as historical baselines; live execution status is tracked in [`docs/project-state/CURRENT.md`](../project-state/CURRENT.md) and [`docs/project-state/active-roadmap.md`](../project-state/active-roadmap.md).
5. **Source Code Is Evidence of State, Not Rule Authority:** Existing TypeScript code or mock handlers prove what is currently implemented, but any divergence from an approved Owner decision is a defect/gap to be remediated, not a change in business rules.

---

## 2. Phase A Architecture & Technology Stack Decisions (Approved 2026-11-07)

### `D-AUTH-01` — Authentication Architecture
- **Status:** `APPROVED & BINDING` (2026-11-07)
- **Decision:**
  1. Target production authentication uses **Django Authentication** with **Django Server-Side Sessions** backed by database session storage in Microsoft SQL Server.
  2. Session identifiers are transmitted exclusively via **`HttpOnly`**, **`Secure`** (over HTTPS in production) cookies.
  3. The browser JavaScript runtime must **never** read, access, or store session identifiers or authentication credentials in `localStorage` or `sessionStorage`.
  4. State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) are protected by **Django CSRF Protection** (`csrftoken` cookie and `X-CSRFToken` header).
  5. **No SSO** implementation is required at this stage (may be considered as a future extension if an enterprise IdP is introduced).
  6. **No JWT or Bearer Token** requirement exists for the current browser application.
  7. React communicates through the centralized API client ([`frontend/src/core/api/apiClient.ts`](../../frontend/src/core/api/apiClient.ts)) and retrieves the authenticated user profile via **`GET /api/auth/me`**.
  8. Compatibility of the Django session backend with the selected Microsoft SQL Server connector is recorded as a Phase 12 backend verification requirement.
- **Canonical Specification:** [`docs/architecture/authentication-and-session-contract.md`](./authentication-and-session-contract.md)

### `D-DB-01` — Authoritative Database Engine
- **Status:** `APPROVED & BINDING` (2026-11-07)
- **Decision:**
  1. **Microsoft SQL Server** is the sole approved target production database engine for MetroLMS (paired with Python, Django, and Django REST Framework).
  2. **PostgreSQL is NOT an approved target database engine.**
  3. Historical PostgreSQL-specific assumptions (`pg_hba.conf`, `pg_ident.conf`, PgBouncer, `SECURITY DEFINER`, `search_path`, `JSONB` operators, and PostgreSQL Primary Writer replication slots) in [`docs/backend/database-schema.md`](../backend/database-schema.md), [`docs/backend/contracts/developer-bootstrap-contract.md`](../backend/contracts/developer-bootstrap-contract.md), and SUP-01 reports are classified as **architecture deviations / provisional artifacts** while preserving those historical documents unchanged.
  4. Core relational principles — ACID transactions, concurrency control, atomicity, idempotency, and referential integrity — remain 100% binding for the SQL Server implementation.
- **Canonical Specification:** [`docs/backend/django-sqlserver-integration-contract.md`](../backend/django-sqlserver-integration-contract.md)

### `D-SEC-01` — Frontend Security and XSS Defense-in-Depth
- **Status:** `APPROVED & BINDING` (2026-11-07)
- **Decision:**
  1. **Safe React Rendering:** Preserve React's automatic escaping; prohibit `dangerouslySetInnerHTML` for untrusted content without an approved sanitization mechanism; audit direct DOM manipulations and unsafe HTML sinks.
  2. **Rich-Text Sanitization:** Use **DOMPurify** (or equivalent maintained sanitizer) with an explicit element and attribute allowlist whenever HTML rendering is genuinely required; never unnecessarily sanitize plain text rendered through standard React interpolation.
  3. **Content Security Policy (CSP):** Assess a strict CSP compatible with React/Vite deployment, starting with `Content-Security-Policy-Report-Only`, resolving violations before enforcement, and avoiding unnecessary `unsafe-inline` or `unsafe-eval`.
  4. **Trusted Types:** Assess browser Trusted Types compatibility as an additional defense-in-depth hardening measure where supported.
  5. **Session Protection:** Enforce `HttpOnly`, `Secure`, appropriate `SameSite` cookies, CSRF protection on mutations, and zero credentials in `localStorage`/`sessionStorage`.
  6. **Backend Security Boundary:** Django must independently enforce authentication, authorization, object-level permissions, input validation, file-access permissions, sensitive operation restrictions, and audit logging. Frontend controls are never considered the authoritative security boundary.
- **Canonical Specification:** [`docs/architecture/security-and-xss-baseline.md`](./security-and-xss-baseline.md)

### `D-MEDIA-01` — Decoupled Media Storage Contract
- **Status:** `APPROVED & BINDING` (2026-11-07)
- **Decision:**
  1. Do not force a physical media hosting infrastructure decision during Frontend Readiness.
  2. The frontend must consume a stable, decoupled media integration contract supporting video uploads, PDF uploads, media identifiers (`mediaId`), upload status, media URLs, file metadata, and download/streaming references.
  3. The physical backend storage strategy (local `MEDIA_ROOT`, dedicated intranet streaming server, or object storage) remains a future Phase 12 backend decision.
- **Canonical Specification:** [`docs/backend/django-sqlserver-integration-contract.md`](../backend/django-sqlserver-integration-contract.md)

---

## 3. Whole-System Domain & Governance Decisions (`D-01`–`D-14`, `OD-01`, `OD-02`)

Originally ratified in [`docs/backend/pre-backend-migration-remediation-roadmap.md`](../backend/pre-backend-migration-remediation-roadmap.md) (Revision 5, §5 & §16). All 16 decisions remain 100% binding:

| Decision ID | Domain Area | Binding Rule Summary |
| :--- | :--- | :--- |
| **`D-01`** | **Permanent User Deletion Cascade** | Permanent deletion (`DELETE /api/admin/users/:id`) permanently removes the user account, credentials, enrollments, course attempts, lesson progress, last-watched state, transcript history, certificates, group memberships, permissions/delegations, WhatsApp assignments, and personal notifications; auto-cancels pending approval/join requests; records the user ID and aliases in `deletedUserTombstones`; and strictly retains immutable security audit logs. |
| **`D-02`** | **Deleted User Comment Anonymization** | Course discussion comments and replies authored by a permanently deleted user are **retained** to preserve thread continuity, but stripped of identity links (`userId: null`, `userEmail: null`) and displayed with `userName: 'مستخدم محذوف'`. |
| **`D-03`** | **Lecturer Pre-Deletion Supervision Guard** | Courses and groups are never deleted when a lecturer is deleted. If a lecturer participates in any course (`lecturerId`, `coLecturers`) or active group (`primaryInstructorId`, `assistantLecturerIds`, `supervisorIds`), deletion is blocked (`409 Conflict`) with the exact warning: `لا يمكن حذف هذا المحاضر لمشاركته في الإشراف على كورسات أو مجموعات. إن كنت تريد الحذف، يرجى إزالته من الإشراف أولاً.` Clicking `مواصلة الحذف` reveals clickable links to each supervised course and group. |
| **`D-04` / `OD-01`** | **Super Admin Visibility & Peer Protection** | `super_admin`, `admin`, and `assistant_admin` (under Rule A) can **view** `super_admin` accounts in read-only mode in the directory and detail views (`OD-01`). However, peer visibility never implies peer management authority: only `developer` may create, edit, suspend, activate, change the role of, or permanently delete a `super_admin` account (`INV-R2`). |
| **`D-05` / `OD-02`** | **Regular Admin Ceiling & Assistant Admin Management** | A regular `admin` cannot create, edit, suspend, activate, or delete any `admin`, `super_admin`, or `developer` account (`INV-R3`). A regular `admin` **can** create, edit, suspend, activate, manage operational delegation permissions for, and **permanently delete** (`OD-02`) `assistant_admin` accounts, as well as manage `lecturer` and `user` accounts (`INV-R4`). |
| **`D-06`** | **Per-Attempt Progress Isolation** | Lesson progress is isolated per `attemptId` (`CourseAttempt`), never keyed solely by shared `(userId, courseId)`. Completing Course A in Group 1 never completes Course A in Group 2 or in an independent standalone enrollment. Group renewal cycles seal the prior cycle's attempt and start a fresh attempt at `0%`. |
| **`D-07`** | **Group Member Removal Per-Course Choice** | Removing a trainee from a group prompts the Admin per enrolled group course (`هل تريد أيضًا إزالة تسجيل المتدرب من أي من المقررات التدريبية التابعة لهذه المجموعة؟ يمكنك تحديد المقررات التي تريد إزالة تسجيله منها.`, unchecked by default). Kept courses convert to an idempotent standalone continuation grant (`kind: 'self'`, `sourceId: 'self:continued:${groupId}:${attemptId}'`) bound to the **same active `attemptId`** (preserving progress and lifting the group deadline without merging with any pre-existing independent self-enrollment `S1`). Removed courses revoke only that group's source while sealing the historical attempt. |
| **`D-08`** | **Developer Notification Isolation** | Developer-targeted notifications remain strictly inside the Developer's private inbox. Notifications sent to any non-Developer user never name the Developer as actor, substituting the neutral label `'النظام'`. |
| **`D-09`** | **Developer Email Collision Masking** | Email uniqueness is enforced across all accounts including `developer`, but any collision with the Developer's email returns the standard generic duplicate-email validation error (`البريد الإلكتروني مسجل مسبقاً لمستخدم آخر`) without disclosing the Developer account. |
| **`D-10`** | **Role Preview vs. Isolated Test Sessions** | Strictly separates visual **Role Preview** (`معاينة الدور` via `RolePreviewContext`, which changes UI layout only while keeping `AuthContext.user` as `developer` and blocking mutations) from **Isolated Role Test Sessions** (`اختبار الصلاحيات`, which switches authentication to allowlisted dev-only synthetic personas `USR_TEST_*` while preserving the Developer origin snapshot for one-click return). |
| **`D-11`** | **Nullable Primary Ownership (`غير معين`)** | Both courses (`Course.lecturerId: string | null`) and groups (`TrainingGroup.primaryInstructorId: string | null`) support unassigning the primary instructor to `null` (rendered in Arabic as `غير معين`), never using magic strings such as `'unassigned'`. |
| **`D-12`** | **Progress Rounding Formula** | Displayed integer progress percentages use `Math.round((completedRequiredItems / totalRequiredItems) * 100)` clamped to `[0, 100]`, capped at `99%` whenever `completedRequiredItems < totalRequiredItems`. |
| **`D-13`** | **Version-Scoped Certificates** | Certificates (`CertificateRecord`) are bound to `courseVersionNumber` (`شهادة إتمام — الإصدار k`). Publishing `Course Version 2` preserves a trainee's existing `Version 1` certificate while recalculating active progress against `Version 2` until the new lessons are completed to earn `Certificate — Course Version 2`. |
| **`D-14`** | **Assistant Admin Security Audit Read Access & Neutral Projection** | Under `Rule A`, `assistant_admin` is granted read-only access to the Security Audit trail (`GET /api/admin/audit`, `/admin/audit`). Across all audit logs and entity reference fields (`createdBy`, `reviewedBy`, etc.), Developer actions are projected as `actorId: 'SYSTEM'`, `actorRole: 'system'`, `actorName: 'النظام'` for all non-Developer viewers. |

---

## 4. Phase 5 Session Lifecycle & Isolation Decisions (Approved 2026-11-06)

Ratified during Phase 5 Increment 5.4 (`WP-5.4.5`) in [`docs/frontend/reports/phase-05-increment-04-wp-5.4.5-implementation-report.md`](../frontend/reports/phase-05-increment-04-wp-5.4.5-implementation-report.md) and [`docs/frontend/reports/sup-01-server-outcome-semantics-audit-v1-7.md`](../frontend/reports/sup-01-server-outcome-semantics-audit-v1-7.md):

| Decision ID | Lifecycle State / Transition | Binding Behavioral Invariant |
| :--- | :--- | :--- |
| **`Decision A`** | **Unauthenticated State (`S0`)** | Only `S0 → S1` (Developer Login with valid credentials) is permitted. `S0 → S3` (Isolated Launch), `S0 → S14` (Normal Return), and `S0 → S15` (Emergency Return) are strictly forbidden for guest/unauthenticated sessions. |
| **`Decision B`** | **Real-User Identity Mismatch (`S8`)** | When a non-Developer real platform user (e.g., `USR_SUPER_001` or a trainee) is authenticated in a tab that still holds an inert Developer origin snapshot (`S8`), `S8 → S14` and `S8 → S15` are strictly forbidden. A real user must never consume, activate, or elevate privileges using a saved Developer origin snapshot. |
| **`Decision C`** | **Real-User Logout with Preserved Snapshot (`SUP-01: S8 → S7`)** | When a real user explicitly logs out from state `S8`: (1) clear the real user's active session (`user = null`), (2) preserve the existing Developer origin snapshot in per-tab `sessionStorage`, unchanged and inert, until tab close, (3) never recreate `emergencyProof`, (4) keep normal and emergency return banners hidden, and (5) require fresh Developer authentication (`USR_DEV_001`) which must not silently reactivate the old snapshot. *(Note: Explicit logout from an active isolated test persona `S3 → S12 → S0` continues to purge both slots).* |
| **`Decision E`** | **Archival Storage Failure Policy (Option 1 — Transactional Abort)** | If Developer-origin archival or read-back verification in `sessionStorage` fails (e.g., `QuotaExceededError`): abort the transition, do not clear active authentication, remain in state `S8`, and display the recoverable Arabic error (`"فشل حفظ لقطة المطور في الأرشيف بسبب قيود التخزين. لم يتم إنهاء الجلسة لحماية بيانات الاستمرارية."`). Option 2 (Quarantine & Evict) is formally rejected. |
| **`Decision F`** | **Snapshot Disposal on Real-User Suspension (Option 1)** | Preserve the inert Developer origin snapshot in per-tab `sessionStorage` until tab termination (Option 1 baseline). |

---

## 5. Historical Increment 11 Decisions & Supersession Mapping

During Increment 11 planning ([`docs/frontend/legacy-feature-parity-audit.md`](../frontend/legacy-feature-parity-audit.md) §9), four operational decisions were recorded. Their current disposition is:

| Historical ID | Original Increment 11 Decision | Current Disposition Under Level 1 Authority |
| :--- | :--- | :--- |
| **Inc 11 Decision 1** | **Permissions Architecture:** Keep 4 canonical roles (`admin`, `assistant_admin`, `lecturer`, `user`) with 3-layer capability ceilings/defaults/overrides; `assistant_lecturer` is a group-scoped assignment. | **PARTIALLY SUPERSEDED BY `MFR-37` & `D-04`/`D-05`:** The 3-layer capability model and group-scoped `assistant_lecturer` assignment remain **ACTIVE**, but the role hierarchy is expanded to **6 canonical roles** by adding `developer` and `super_admin`. |
| **Inc 11 Decision 2** | **Course Performance Inactivity:** Mark learners inactive for $> 5\text{ days}$ (`متأخر ⚠️`) based only on verified `lastActivityAt` timestamps; never fabricate peak viewing hours. | **ACTIVE & PRESERVED.** |
| **Inc 11 Decision 3** | **Centralized Trainee Resolution:** Resolve group candidate trainees from the central user directory (`role === 'user' && status === 'active'`), replacing hardcoded fixture lists. | **ACTIVE & PRESERVED** (with `developer` unconditionally excluded across all pickers per `MFR-39`). |
| **Inc 11 Decision 4** | **Retired Legacy Artifacts:** Permanently exclude the legacy File System Access API banner (`showFsBanner`) and obsolete lecturer self-enrollment approval queue. | **ACTIVE & PRESERVED.** |

---

## 6. Phase B Group Domain & Reminder Program Decisions (Approved 2026-11-11)

Ratified in Phase B (`# MetroLMS — Phase B: Reminder Programs Business Rules & Contract Design` and `# MetroLMS — Phase B Finalization: Owner Decision Ratification & Business Rules Contract Freeze`) following the Phase A Group Domain Read-Only Audit. All eight decisions (`D-GRP-01` through `D-GRP-08`) are fully approved, binding, and frozen:

| Decision ID | Domain Area | Binding Behavioral Invariant |
| :--- | :--- | :--- |
| **`D-GRP-01`** | **In-Place Renewal Identity** | A recurring reminder program retains its immutable `TrainingGroup.id`, name, and enrollment code across renewals. Both manual (`createRenewalCycle`) and automated renewal create a new `GroupRenewalCycle` in-place, closing and sealing the prior cycle. Automated cloning of successor groups (`successorGroup`) is permanently abolished. |
| **`D-GRP-02`** | **Day-Based Recurrence Measurement** | Recurrence intervals are strictly day-based (`intervalDays` / `renewalIntervalDays` e.g., 30, 60, 90, 180, 365 days). Calendar month/year conversions are prohibited. Day-based anchor (`cycle.deadlineDateTime` + `intervalDays`) and safe calculation methods are preserved. |
| **`D-GRP-03`** | **Immediate Mixed-Course Group Classification** | A group containing $\ge 1$ assigned course with `courseRole === 'reminder'` is immediately classified as a reminder group (`groupType: 'reminder'`). Groups containing only `courseRole === 'core'` are classified as regular (`groupType: 'regular'`). Classification is derived centrally via `resolveGroupType` upon course selection without waiting for renewal execution. |
| **`D-GRP-04`** | **Authoritative GroupRenewalCycle In-Place Progression** | Every renewal appends a new `GroupRenewalCycle` (`CYC-<groupId>-<NN>`) linked to the same `TrainingGroup`. Historical cycles transition to `status: 'completed'`; historical attempts, certificates, attendance logs, and progress records remain sealed and immutable. |
| **`D-GRP-05`** | **Dual Badge Presentation Contract** | Trainee-facing presentation displays a prominent group-level badge `برنامج تذكيري` on reminder groups, alongside a dedicated course-level badge `مقرر تذكيري` beside reminder-designated courses. Core courses in mixed groups remain clearly identified as core courses (`دورة أساسية`). |
| **`D-GRP-06`** | **Persistent Reminder Classification** | A group remains classified as `reminder` after the removal of its last currently assigned reminder-designated course, provided its group history contains a reminder-designated course assignment. Once established, reminder classification is monotonic and irrevocable across the group lifecycle. Historical renewal cycles retain immutable course roles, and `resolveGroupType` enforces historical continuity via a monotonic marker (`hasHistoricalReminderCourses: true`). |
| **`D-GRP-07`** | **Archived Groups Hidden from Trainee Groups Page** | Administratively archived groups (`adminStatus === 'archived'`) are completely excluded from the trainee Groups API response (`GET /api/groups/my`), the persistent carousel, the detailed groups table, and all summary counts (`إجمالي المجموعات`, `المجموعات النشطة`, `البرامج المجدولة`). No archived filter or tab is provided on this page. All historical attempts, records, and certificates remain preserved and accessible through `/my-certificates`. Direct URL navigation to `/my-groups/:id` for archived groups fails closed. |
| **`D-GRP-08`** | **Compact Course Presentation in Carousel** | The persistent carousel uses compact course representations (short codes/compact pills with visual role distinction between core and reminder) to maintain concise card heights. Full course titles and explicit dual badges (`دورة أساسية` / `مقرر تذكيري`) are preserved in the detailed groups table and group details page. Design follows official Metro Courses design tokens without emojis. |

---

## 7. `WP-5.5` Physical Types Deferred Decisions Integration (`WP55-PT-01`–`WP55-PT-06`)

Recorded `2026-11-15` under Owner-delegated technical selection and explicit documentation-integration authorization. Full specifications, rationale, and constraints are recorded in [`wp-5-5-deferred-decisions-record.md`](../02-architecture-and-design/data-models/wp-5-5-deferred-decisions-record.md). *(Note: `WP55-PT-01`–`WP55-PT-06` correspond to the six `WP-5.5` deferred items `D-01`–`D-06` without colliding with Domain Rules `D-01`–`D-14` in Section 3.)*

| ID | Deferred Ref | Status | Selected Option & Scope | Consequences |
| :--- | :---: | :---: | :--- | :--- |
| **`WP55-PT-01`** | `D-01` | `OWNER-APPROVED` *(delegated)* | **`PendingApprovalRequest.id` = `UNIQUEIDENTIFIER`** (`models.UUIDField(primary_key=True)`). UUID serves as internal DB PK and API `approvalRequestId` string; no separate `public_reference` column added. | Reconciles `data-dictionary.md` §2.8 `L156`; supersedes illustrative `"apr-2026-0042"` example in `django-sqlserver-integration-contract.md` §2.3. |
| **`WP55-PT-02`** | `D-02` | `OWNER-APPROVED` *(delegated)* | **Catalog PKs promoted to `BIGINT`** (`MetroLine.id`, `MaritalStatusCatalog.id`, `MilitaryServiceStatusCatalog.id` → `BIGINT` / `BigAutoField`), matching `User.*_id` and `CourseAudienceMetroLine.metro_line_id` (`BIGINT`). | Achieves `84/84` exact `BIGINT`-to-`BIGINT` FK consistency across all `50` integer-PK entities while preserving `ON DELETE NO ACTION`. |
| **`WP55-PT-03`** | `D-03` | `OWNER-APPROVED` *(delegated)* | **`QuizDefinition.passing_score` = `DECIMAL(5,2)`** (`DecimalField(max_digits=5, decimal_places=2)`), range `0.00–100.00`, percentage-based (fractional thresholds supported; learner passes when calculated `% >= passing_score` without pre-rounding). | Prohibits `FLOAT`; establishes authoritative percentage interpretation in `data-dictionary.md` §5.5. |
| **`WP55-PT-04`** | `D-04` | `OWNER-APPROVED` *(delegated)* | **`GroupQrCode.token_hash` = `SHA-256` / `VARBINARY(32)`** (`BinaryField(max_length=32)`), `>= 256-bit` CSPRNG raw token never persisted/logged, single mutable row per `TrainingGroup` (`TR-C3-01` Option B). | No HMAC, KMS, or QR history table introduced; preserves `UNIQUE(training_group_id)` and `UNIQUE(token_hash)`. |
| **`WP55-PT-05`** | `D-05` | `OWNER-APPROVED` *(delegated)* | **Timestamps = `DATETIMEOFFSET(7)`** (`USE_TZ=True`, Windows Server system timezone & Django `TIME_ZONE='UTC'`, UTC `+00:00` DB persistence, explicit `ZoneInfo("Africa/Cairo")` via `zoneinfo.ZoneInfo`/`tzdata` + `timezone.now()`; `4` date-only fields remain `DATE`). | Reconciles all `38` timestamp fields in `data-dictionary.md` with `django-sqlserver-integration-contract.md` §4 (`mssql-django==2.0.0` maps aware `DateTimeField`s to `datetimeoffset`); avoids Django 5.2 Windows alternate-timezone limitations by keeping `TIME_ZONE='UTC'` matching Windows OS `UTC` and using explicit `ZoneInfo("Africa/Cairo")` / `timezone.override(...)`. |
| **`WP55-PT-06`** | `D-06` | `OWNER-CONFIRMED` OS / `TECHNICAL-RECOMMENDATION` baseline | **Windows Server 2022** (`OWNER-CONFIRMED` OS); `x64`, Python `3.12`, Django `5.2` LTS, Microsoft SQL Server `2022`, `mssql-django==2.0.0`, **`pyodbc`** active/default driver + **ODBC Driver 18** (`mssql-python>=1.15.0` / `1.17.0` mandatory install dependency only). | App server and SQL Server co-location not assumed; `x64` & SQL Server `2022` remain pending infrastructure inventory verification. |

---

## 8. `WP-5.5` Pre-Freeze Owner Decisions Integration (`OD-PF-01`–`OD-PF-08`, including `OD-PF-03-B`)

Recorded `2026-11-15` following Project Owner approval of `OD-PF-01` through `OD-PF-08` (including `OD-PF-03-B`). Integrated into [`data-dictionary.md`](../02-architecture-and-design/data-models/data-dictionary.md), [`wp-5-5-deferred-decisions-record.md`](../02-architecture-and-design/data-models/wp-5-5-deferred-decisions-record.md), and [`wp-5-5-consolidated-pre-freeze-owner-review-register.md`](../02-architecture-and-design/data-models/wp-5-5-consolidated-pre-freeze-owner-review-register.md).

| Decision ID | Status & Date | Affected Entities & Fields | Owner-Approved Decision | Technical Enforcement Notes |
| :--- | :---: | :--- | :--- | :--- |
| **`OD-PF-01`** | `OWNER-APPROVED` (`2026-11-15`) | `User.email` (`DeletedUserTombstone`) | `User.email` is optional/nullable; uniqueness applies only to non-`NULL` values; multiple `NULL`s allowed; empty/whitespace-only inputs normalized to `NULL` before persistence. Under `D-01`, deleted user's email is **not** retained in `DeletedUserTombstone` and no collision-masking placeholder is created (deleting `User` frees email for reuse). | `mssql-django==2.0.0` has limitations around DB-level conditional uniqueness; physical implementation must use an explicit SQL Server filtered unique index migration (`WHERE email IS NOT NULL`) rather than assuming automatic Django ORM creation. `NVARCHAR(254)` remains `TECHNICAL-RECOMMENDATION`. *(Clarification `2026-11-15`: `mssql-django==2.0.0` `features.py` declares `supports_partial_indexes = True` and `supports_functions_in_partial_indexes = True`, so Django `UniqueConstraint(condition=Q(email__isnull=False))` is the primary ORM path, with `migrations.RunSQL` retained as an optional fallback pending Phase 12 `sqlmigrate` and migration verification; see `django-sqlserver-integration-contract.md` §4.2.)* |
| **`OD-PF-02`** | `OWNER-APPROVED` (`2026-11-15`) | `LessonProgress` (`progress_percent` excluded; telemetry & `is_completed` retained; `LessonItem.duration_seconds`) | Do **not** persist `LessonProgress.progress_percent` in the database. Retain underlying playback/progress measurements (`last_position_seconds`, `furthest_watched_seconds`, `eligible_viewing_seconds`, `watch_count` on `LessonProgress`; `duration_seconds` on `LessonItem` per `Rule B` `INV-DOM06-02`), retain `is_completed` as an independent persisted business state, calculate percentage on demand for UI/API presentation, and do not equate calculated `%` with completion. Preserves video completion (`>= 90%` eligible playback or `ended` event) and PDF explicit completion (5-second timer alone insufficient). | `progress_percent` excluded from persisted columns in `data-dictionary.md` `§8.4`; `LessonProgress` retains `9` persisted fields (`4` telemetry `INT NOT NULL DEFAULT 0 CHECK (>= 0)` columns) and `LessonItem` persists `duration_seconds` (`INT NULL DEFAULT 0`). |
| **`OD-PF-03`** | `OWNER-APPROVED` (`2026-11-15`) | `CourseCommentReport.status`, `CourseCommentReport.reporter_user_id` | Approved status values: **`Pending`** (awaiting review), **`Resolved`** (reviewed and action taken), **`Dismissed`** (reviewed and no action required). Preserve report if reporter `User` is deleted; set `reporter_user_id = NULL` (`D-01`). | Physical `NVARCHAR(32) NOT NULL DEFAULT 'Pending'` + `CHECK (status IN ('Pending','Resolved','Dismissed'))` remains `TECHNICAL-RECOMMENDATION`. |
| **`OD-PF-03-B`** | `OWNER-APPROVED` (`2026-11-15`) | `CourseReviewSubmission.review_status` | Approved status values: **`Pending`** (waiting for admin review), **`Approved`** (accepted by admin), **`ReturnedForRevision`** (returned to lecturer for changes). `CourseReviewSubmission.review_status` is strictly separate from `Course.lifecycle_status`; a `Published` Course remains `Published` while an update submission is pending review (never unpublishes or replaces live version). | Preserves `PROVISIONAL` entity classification of `CourseReviewSubmission` in `logical-data-model.md`; `NVARCHAR(32)` + `CHECK` remains `TECHNICAL-RECOMMENDATION`. |
| **`OD-PF-04`** | `OWNER-APPROVED` (`2026-11-15`) | `GroupJoinRequest.request_status` | A trainee may submit a new request after a previous request was `Rejected`; the new request creates a **new database record** while retaining the previous `Rejected` record for history. At most one `Pending` request per `(training_group_id, user_id)` pair; no new request allowed while user has active `GroupMembership` in that group. Approved status vocabulary: **`Pending`**, **`Approved`**, **`Rejected`**. | Filtered unique index on `(training_group_id, user_id) WHERE request_status = 'Pending'` is a `TECHNICAL-RECOMMENDATION` requiring explicit SQL Server migration (do not assume automatic Django ORM creation). |
| **`OD-PF-05`** | `OWNER-APPROVED` (`2026-11-15`) | `OrganizationalDepartment.name_en`, `JobTitle.name_en`, `MetroLine.name_en`, `MaritalStatusCatalog.name_en`, `MilitaryServiceStatusCatalog.name_en`, `MilitaryServiceStatusCatalog` seeds | All 5 `name_en` fields are optional (`NULL`); `name_ar` remains required primary label; UI falls back to Arabic when `name_en` is absent. `MilitaryServiceStatusCatalog` initial values are **exactly**: `معفي`, `أنهى الخدمة`, `مؤجل` (Admin-managed; no extra statuses invented). Preserves `MaritalStatusCatalog` ordinary categories (`Single`, `Married`, `Divorced`, `Widowed`) and required free-text `User.educational_qualification` (no `EducationalQualificationCatalog`). | Technical `code` slugs and `NVARCHAR` lengths remain `TECHNICAL-RECOMMENDATION` where not previously `OWNER-APPROVED`. |
| **`OD-PF-06`** | `OWNER-APPROVED` (`2026-11-15`) | `HistoricalServiceTrainingRecord.completion_date` | `completion_date` is optional and nullable (`NULL` allowed when exact historical date is unavailable). | Preserves date-only semantic and SQL Server `DATE` mapping (no timestamp/timezone conversion). |
| **`OD-PF-07`** | `OWNER-APPROVED` (`2026-11-15`) | `Course.description` | `Course.description` may be empty/`NULL` while in `Draft` (ordinary Draft creation/saving must not require it); non-empty `description` is **required before submitting** a Course for admin review (and for submitted updates of already-published courses), revalidated server-side at submission time. | Preserves `NVARCHAR(MAX) NULL` in DB; submission gate enforced server-side in Django submission service. |
| **`OD-PF-08`** | `OWNER-APPROVED` (`2026-11-15`) | `PendingApprovalRequest.reason`, `AuditLogEntry.reason` | Maximum length **`500`** characters (`NVARCHAR(500)`) approved specifically for `PendingApprovalRequest.reason` and `AuditLogEntry.reason`; pre-existing `Optional`/`NULL` nullability (`D-OWNER-REV-25` & `TECHNICAL-RECOMMENDATION`) is preserved unchanged. | Strict scope safeguard: `DeletedUserTombstone.reason` remains `NVARCHAR(1000)` (`OWNER-APPROVED`) and `CourseCommentReport.reason` remains `NVARCHAR(500)` (`OWNER-APPROVED` via `CP-011`); unrelated `reason` fields untouched. |

---

## 9. Pending & Recently Selected Owner Decisions

All architectural, stack, security, media, role-hierarchy, group-domain, `WP-5.5` physical-type deferred decisions (`WP55-PT-01`–`WP55-PT-06`), and `OD-PF-01`–`OD-PF-08` (including `OD-PF-03-B`) are recorded. Unrelated deferred/gated items (`Domain 16` / `InPersonAttendanceRecord`, `A-03a-1`, `A-03c-1`–`3`, `OD-API-01`–`04`, `API-REC-06`, `TR-C3-04` general scheduler tech & post-12m archive mechanics) remain open.

### 9.1 Consolidated Owner Selections & Approvals (`2026-11-15` – `2026-11-16`)
- **`OR-DB-08a / 08b / 08c` (`OWNER-SELECTED` — `2026-11-15`):** Permanent persistence approved for `CourseReviewSubmission`, `StagedAdminEdit`, and `WorkingNote` (`54` active entities / `306` active fields; `InPersonAttendanceRecord` remains `DEFERRED`; review/staged-edit/working-note workflows remain in scope; indefinite retention per `D-OWNER-REV-31`).
- **`DepartmentTrack` Physical Identity (Option A, `OWNER-SELECTED` — `2026-11-15`):** Single physical column `department_code` (`NVARCHAR(64) NOT NULL PK(department_code)`), documented string-PK exception under `D-02` (`50 BIGINT PKs`, `3` string PKs, `1` `UUID` PK), no separate `id` column, no secondary `UNIQUE` index.
- **`OR-DB-01` (`ScheduledJob.is_enabled`, `OWNER-SELECTED` — `2026-11-15`):** `DEFAULT 1` selected (`1` of `16` total proposed defaults).
- **`OR-DB-03` (`DelegatedAuthority`, `OWNER-SELECTED` — `2026-11-15`):** Non-unique `INDEX(user_id, capability_key)` selected (`45`-entry index baseline: `4` filtered `UNIQUE` + `36` ordinary `UNIQUE` + `5` non-unique/composite; no unapproved uniqueness invariant; no `grantee_tombstone_id` index).
- **`OR-DB-04` (Database Collation, `OWNER-SELECTED` — `2026-11-15`):** `Arabic_100_CI_AS` selected (`OWNER-SELECTED — TECHNICAL VERIFICATION PENDING` on SQL Server 2022 during Phase 12).
- **`OR-DB-02` (Physical String Lengths, `OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`):** Approved all `84` remaining `STR` string lengths (`STR-01`–`STR-35`, `STR-37`–`STR-44`, `STR-46`–`STR-51`, `STR-53`–`STR-71`, `STR-73`–`STR-88`, including `STR-59` = `NVARCHAR(32)`, `STR-60` = `NVARCHAR(MAX)`, `STR-61` = `NVARCHAR(MAX)` under `OR-DB-08`), preserving `2` `OD-PF-08` approvals (`STR-45`, `STR-52` = `500`), `2` superseded non-string entries (`STR-36` → `UNIQUEIDENTIFIER`, `STR-72` → `VARBINARY(32)`), and `15` earlier `CP-010`–`CP-012` approvals (`101` total active physical string fields under `DepartmentTrack` Option A; `0` remaining `OR-DB-02` lengths). Key special values/rationales: `STR-05` (`User.national_id`) = `NVARCHAR(14) NOT NULL` (Egypt-only 14-digit rule); `STR-02` (`User.password_hash`) = `NVARCHAR(255) NOT NULL` (Django 5.2 default `128`, `255` headroom for anticipated hashers); `STR-66` (`MediaAsset.mime_type`) = `NVARCHAR(127) NOT NULL` (validated `type/subtype` only excluding HTTP `Content-Type` parameters; project allowlist limit, not claiming `127` is RFC 6838 theoretical max). **Strict Scope:** Approval applies **only** to string maximum length / `NVARCHAR(n)` or `NVARCHAR(MAX)` selection — not nullability, PK/FK, `IDENTITY`, defaults, `CHECK`, `ISJSON()`, indexes, collation, normalization, or non-string types.
- **`OR-DB-01` (Physical Database Design Batch, `OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`):** Approved all `6` `OR-DB-01` technical recommendation groups (`54` active entities / `305` active physical columns under `DepartmentTrack` Option A [`306` logical mappings prior to Option A collapse]; `InPersonAttendanceRecord` remains `DEFERRED`), preserving all inherited `D-01`–`D-06`, `OD-PF-01`–`OD-PF-08`, `WP55-PT-01`–`05`, `OR-DB-08a/b/c`, `OR-DB-02`, `OR-DB-03`, and `OR-DB-04` (`Arabic_100_CI_AS`) decisions without reopening:
  1. **Identity Generation (`48` remaining `BIGINT IDENTITY(1,1)` PKs):** `IDENTITY(1,1)` (`models.BigAutoField(primary_key=True)`) approved for the remaining `48` `BIGINT` surrogate PKs (`15` C1 + `17` C2 + `18` C3 = `50` `BIGINT` PKs minus `2` previously approved `User.id`, `MetroLine.id`). Zero `IDENTITY` on `84` FKs, `3` String PKs, `PendingApprovalRequest.id` (`UNIQUEIDENTIFIER`), or non-PK identifiers.
  2. **Defaults (`15` remaining):** Preserves `ScheduledJob.is_enabled DEFAULT 1`; approves the `15` remaining defaults (`14` unconditional + `CourseReviewSubmission.review_status = 'Pending'` under `OR-DB-08a`) at both Django (`default=...`) and SQL Server (`db_default=...`) layers, with Phase 12 DDL verification.
  3. **Nullability (`23` nullable columns across `12` groups + remaining `NOT NULL` columns):** Approves all `23` remaining nullable columns (including `PendingApprovalRequest.reason` & `AuditLogEntry.reason` SQL `NULL` while preserving `OD-PF-08` `500`-char lengths) and all remaining `NOT NULL` columns.
  4. **`CHECK` Constraints (`52` individual SQL Server `CHECK` constraints + Django validators):** `38` domain/enum/range/XOR/date checks + `4` `LessonProgress` telemetry checks + `10` non-empty text checks (`User.phone_e164` uses `COLLATE Arabic_100_BIN2` + explicit ASCII digits `[0123456789]` + `DATALENGTH(phone_e164) = 26` + `LEN(phone_e164) = 13` + Django `\A\+201[0125][0-9]{8}\Z` (`re.ASCII`); `User.date_of_birth` uses authoritative Django `ZoneInfo("Africa/Cairo")` validation + optional non-deterministic `AT TIME ZONE 'Egypt Standard Time'` SQL `CHECK`; non-empty text uses primary Django `strip()` + `LTRIM(RTRIM(col)) <> N''` for ASCII `U+0020` only; HTTPS URL checks remain Django-only).
  5. **`ISJSON()` Constraints (`9` JSON fields):** Typed SQL Server 2022 `ISJSON(..., ARRAY)` (`5` fields) and `ISJSON(..., OBJECT)` (`3` fields, incl. nullable `AuditLogEntry.details_snapshot_json`), untyped `ISJSON(...)` for `ScheduledJobRun.details_json` (nullable, root format unresolved), plus Django schema validation.
  6. **Remaining Physical Types (`24` fields):** `MediaAsset.size_bytes` (`BIGINT NOT NULL CHECK (size_bytes >= 0)`), `11` `INT` fields, and `12` `BIT` fields.
- **`OR-DB-04` (Field-Scoped Normalization Scope, `OWNER-APPROVED — EXPLICIT OWNER DECISION — 2026-11-16`):** Rejects blanket normalization (`NFKC`/`NFKD`, transliteration, Arabic character substitution, digit conversion, and blanket case folding prohibited) while preserving `Arabic_100_CI_AS`. Governs all **`101`** active physical string fields (**`58`** Group A No Normalization / **`7`** Group B Field-Specific / **`36`** Group C Unicode `NFC` [`27` short display `strip()` + `NFC`, `9` multiline/free-form/audit `NFC` only]):
  - **Condition A (Free-Form Text Preservation):** The `9` `NFC`-only fields (`Course.description`, `CourseComment.body`, `WorkingNote.note_body`, `HistoricalServiceTrainingRecord.certificate_info_or_notes`, `DeletedUserTombstone.reason`, `PendingApprovalRequest.reason`, `AuditLogEntry.reason`, `CourseCommentReport.reason`, `NotificationItem.body`) configure DRF `trim_whitespace=False`, apply `NFC` without trimming stored whitespace, use `strip()` only for whitespace-only validation, and apply empty-to-`NULL` only on defined nullable fields.
  - **Condition B (Centralized Normalization Across All Write Paths):** Centralized application-layer normalization must be invoked before validation across DRF serializers/APIs, services/admin workflows, scheduled jobs, imports/integrations, and bulk create/update/write operations (never relying solely on `Model.clean()`, `Model.save()`, or DRF defaults).
  - **Preserved Field Rules:** `User.email` (`strip()`, whitespace-only → `NULL`, domain-only lowercase preserving local-part casing; lookup/uniqueness case-insensitive under `Arabic_100_CI_AS`); `User.phone_e164` & `WhatsAppContact.phone_e164` (`strip()` + `+201[0125]` + 8 ASCII digits only, no silent local conversion); `User.national_id` (`strip()` only); URLs (`strip()` only); `MediaAsset.mime_type` (`strip()` + ASCII lowercase `type/subtype` only); `MediaAsset.file_name` (`strip()` + `NFC` display metadata separate from `storage_key`); catalog codes & `GroupRenewalCycle.cycle_code` (no normalization, strict validation). Phase 12 SQL Server 2022 NFC/NFD & write-path verification required (`django-sqlserver-integration-contract.md` §4.3).

### 9.2 Remaining Items Pending Owner Review
- **None** for `OR-DB-01`, `OR-DB-02`, `OR-DB-03`, `OR-DB-04`, or `OR-DB-08`. Only Phase 12 technical verification of `Arabic_100_CI_AS` / NFC-NFD / DDL items and explicit Owner Freeze Authorization (`WP-5.6`) remain.

`data-dictionary.md` remains `UNFROZEN` and `WP-5.6` remains pending formal execution, freeze authorization, and Owner acceptance. Implementation sequence remains Phase 12 Backend Implementation (with backend tests created and executed alongside implementation WPs) before REV6 Phase 6 Testing Documentation.

