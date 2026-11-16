# MetroLMS — REST API Contract Specification
## Cluster 1: Identity, Users, Governance, Courses & Review (Domains 01–04, 18 + Conditionally Gated 05–07)

> **Document Title:** Domain API Contracts — Identity, Governance, Catalog & Course Lifecycle  
> **Document Identifier:** `METROLMS-API-DOM-001`  
> **Document Status:** `DRAFT — WORK IN PROGRESS (WP-5.3)`  
> **Canonical Authority Level:** Level 5 API Integration Contract  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend DRF Developers, Frontend React Integrators, Database Architects & QA Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), `INV-R1`–`INV-R10`, `API-REC-02`, `A-03a-1` (`OPEN`)  
> **Foundational Components:** [`openapi-foundations.md`](openapi-foundations.md) (`METROLMS-API-FOUND-001`)  
> **Last Updated:** 2026-11-14 (`WP-5.3` Execution)

---

## 1. Scope & Governance Classification

- **Unblocked Domains Covered:** **Domain 01** (Authentication & Sessions), **Domain 02** (Users & Profiles), **Domain 03** (Roles, Permissions & Switching), **Domain 04** (Course Catalog & Discovery), **Domain 18** (Administrative Workflows & Sensitive Approvals).
- **Conditionally Gated Domains Covered (Partial / Flagged):** **Domain 05** (Course Creation & Builder — `assistant_admin` draft scope gated on `A-03a-1`), **Domain 06** (Course Content, Comments & Instructors), **Domain 07** (Published Versions & Course Review — canonical `/api/admin/courses/{courseId}/*` per `API-REC-02`).
- **Provisional Foundation Dependencies:** All non-paginated `200`/`201` envelopes (`OD-API-02`), versioning prefix (`OD-API-01`), pagination query params (`OD-API-03`), and exact error `code` strings (`OD-API-04`) remain **`PROVISIONAL — PENDING OWNER DECISION`**.

---

## 2. Domain 01 — Authentication & Sessions (`authHandlers.ts` / `authApi.ts`)

| Method & Path | Classification | Auth / CSRF | Request Body / Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | `CANONICAL EXISTING REQUIREMENT` (`D-OWNER-REV-13` phone identifier) | Public; sets `sessionid` + `csrftoken` (`D-AUTH-01`) | `{ phone, password }` *(replaces email per `D-OWNER-REV-13`; password auth preserved; prototype MSW still uses `email`/`username`)* | `200 OK`: `{ user }` (no client token in prod); `401`: invalid credentials; `403`: suspended/inactive user | `User` lookup by phone (normalization/uniqueness open), Django `django_session` |
| `POST /api/auth/logout` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | None | `200 OK`: `{ status: "LOGOUT_CONFIRMED" }` (`T-1.3.2` — network/`5xx` triggers client `LOGOUT_UNCONFIRMED`) | Destroys server `django_session` |
| `GET /api/auth/me` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | None | `200 OK`: authenticated `User` + effective capability summary; `401`: unauthenticated | Reads `User` & session |

---

## 3. Domain 02 — Users & Profiles (`userManagementHandlers.ts`, `dashboardHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `GET /api/admin/users` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, admin/directory read | Query: `query`, `role`, `status`, `department`, `page`, `pageSize` (`OD-API-03`) | `200 OK`: `ManagedUserDTO[]` / paginated (`OD-API-02`/`03`). **`INV-R8`:** excludes `developer` accounts for non-Developers | `User` directory fields (`PII` review) |
| `POST /api/admin/users` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `users.create` | `CreateUserRequestDTO` (`username`, `name`, `email`, `role`, `department`, `password`) | `201 Created` (`ManagedUserDTO`); `400`/`422`: validation / role ceiling (`INV-R1`–`R3`) | `User` creation (`password` hash, unique `username`/`email`) |
| `PATCH /api/admin/users/{id}/role` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `users.edit_role` | `{ role: UserRole }` | `200 OK`; `404` if target is `developer` (`INV-R8`); `403` if violating `INV-R2`/`INV-R3` (`super_admin` appointment rule) | `User.role` + `AuditLogEntry` |
| `PATCH /api/admin/users/{id}/status` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `users.suspend` | `{ status: 'active' \| 'suspended', reason? }` | `200 OK`; `404` for `developer` (`INV-R8`); `403` for `protected_admin` | `User.status` + `AuditLogEntry` |
| `DELETE /api/admin/users/{id}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `users.delete` | None | `200 OK` (`Admin`/`Super Admin` — `D-01` soft-delete/anonymize); **`202 Accepted`** (`PendingApprovalResponse` for `assistant_admin` per `INV-R9`); `404` (`INV-R8`) | `User` soft-delete (`D-01`), `PendingApprovalRequest` |
| `GET /api/admin/users/{userId}/transcript` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, transcript read | None | `200 OK`: `UserTranscriptDTO` (`MFR-33` unified progress, no latch/`Math.max`); `404` (`INV-R8`) | Joins `Enrollment`, `CourseAttempt`, `Certificate` |
| `GET /api/profile` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` (self) | None | `200 OK`: `{ user, stats: { totalLearningHours, enrolledCoursesCount, completedCoursesCount } }` | Read-only aggregation |

---

## 4. Domain 03 — Roles, Permissions & Department Tracks (`permissionsHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `GET /api/admin/permissions/roles` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, permissions read | None | `200 OK`: `RolePermissionsConfig[]` (6-tier baseline + ceilings) | `RolePolicy` |
| `PUT /api/admin/permissions/roles/{role}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `Admin`/`Super Admin` | `{ permissions: PermissionKey[] }` | `200 OK`; `422` if exceeding `ROLE_CAPABILITY_CEILINGS` | `RolePolicy` |
| `GET /api/admin/permissions/users/{userId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, permissions read | None | `200 OK`: `{ override: UserPermissionOverride \| null }`; `404` (`INV-R8`) | `UserPermissionOverride` |
| `PUT /api/admin/permissions/users/{userId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `Admin` | `UserPermissionOverride` (without `updatedAt`) | `200 OK`; enforces capability ceiling without changing role | `UserPermissionOverride` |
| `DELETE /api/admin/permissions/users/{userId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `Admin` | None | `200 OK`: `{ success, message }` (resets to role baseline) | Deletes `UserPermissionOverride` |
| `GET /api/admin/permissions/effective/{userId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, permissions read | None | `200 OK`: `EffectiveUserPermissions` (6-step `evaluatePermission` precedence); `404` (`INV-R8`) | Computed from `RolePolicy` + `UserPermissionOverride` |
| `GET /api/admin/permissions/governance/delegation/{userId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, `Admin` | None | `200 OK`: `{ userId, enabled }` / capability-scoped `DelegatedAuthority` | `DelegatedAuthority` |
| `POST /api/admin/permissions/governance/delegation/{userId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `Admin` | Delegation config payload | `200 OK`; `INV-R9` exact-capability delegation | `DelegatedAuthority` + `AuditLogEntry` |
| `GET /api/admin/department-tracks` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | None | `200 OK`: `{ departments, canonicalDepartments, tracks }` | `DepartmentTrack` |
| `GET /api/admin/department-tracks/{departmentId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | None | `200 OK`: `{ department, tracks }` | `DepartmentTrack` |
| `PUT /api/admin/department-tracks/{departmentId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | `{ allowedTracks: string[], justification? }` | `200 OK` (`Admin`) or **`202 Accepted`** (`PendingApprovalResponse` for `assistant_admin` without delegation) | `DepartmentTrack` / `PendingApprovalRequest` |

---

## 5. Domain 18 — Sensitive Approvals & Security Audit Trail (`permissionsHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `GET /api/admin/permissions/governance/approvals` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, approval queue read | Optional status/requester filters | `200 OK`: `ApprovalRequest[]` (`PendingApprovalRequest`) | `PendingApprovalRequest` |
| `POST /api/admin/permissions/governance/approvals` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | Approval submission payload | `201 Created` / `202 Accepted` | `PendingApprovalRequest` |
| `POST /api/admin/permissions/governance/approvals/{id}/approve` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `Admin` | Optional review note | `200 OK` or `409`/`422` (`ExecutionFailed`) per **`INV-R10`** execution-time revalidation | `PendingApprovalRequest` + target entity + `AuditLogEntry` |
| `POST /api/admin/permissions/governance/approvals/{id}/reject` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `Admin` | `{ reason? }` | `200 OK` | `PendingApprovalRequest` + `AuditLogEntry` |
| `GET /api/admin/audit` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, `D-14` audit read | Query: `search`, `action`, `outcome`, `severity`, `actorId`, `startDate`, `endDate`, `page`, `pageSize` | `200 OK`: `AuditLogResponseDTO` (paginated; `INV-R8` hides `Developer` actors from non-Developers) | Append-only `AuditLogEntry` |
| `GET /api/admin/audit/{id}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, `D-14` audit read | None | `200 OK`: `SystemAuditLogEntryDTO`; `404` (`INV-R8`) | `AuditLogEntry` |

---

## 6. Domain 04 — Course Catalog & Discovery (`courseHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `GET /api/courses` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | Query: `search`, `level`, `sortBy` | `200 OK`: `Course[]` (published courses only; excludes archived per `ADR-008`) | `Course` + `PublishedCourseVersion` |
| `GET /api/courses/{courseId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | None | `200 OK`: `Course`; `404` if missing or unpublished for trainee | `Course` + `PublishedCourseVersion` |

---

## 7. Conditionally Gated Domains 05–07 (Builder, Content/Comments & Course Review)

### 7.1 Domain 05 — Course Creation & Builder (`builderHandlers.ts` — `A-03a-1` Conditional Gate)
| Method & Path | Classification | Auth & Scope | Notes / Blocking Scope |
| :--- | :---: | :--- | :--- |
| `GET /api/lecturer/courses` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, lecturer/admin | Lists courses owned by actor (`authorId === actor.id`) or all for Admin |
| `GET /api/lecturer/courses/{courseId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, `courses.edit_curriculum` + ownership | Fetches editable draft structure |
| `POST /api/lecturer/courses` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, course creation | Body: `{ title, level, description }` -> `201 Created` |
| `PUT /api/lecturer/courses/{courseId}/draft` | **`PROVISIONAL — GATED ON A-03a-1`** | `courses.edit_curriculum` (`INV-DOM21-20`) | Preserves active `PublishedCourseVersion` (`Rule B`). **`A-03a-1`:** `assistant_admin` draft scope (`INV-R7` vs `INV-R9`) unresolved |
| `POST /api/lecturer/courses/{courseId}/reset-lab` | `CANONICAL EXISTING REQUIREMENT` (DEV/Lab) | `sessionid` + `X-CSRFToken` | Prototype Content Testing Lab reset; exclude or gate in production |

### 7.2 Domain 06 — Course Content, Comments & Instructors (`commentsHandlers.ts`, `performanceHandlers.ts`)
| Method & Path | Classification | Auth / Capabilities | Notes |
| :--- | :---: | :--- | :--- |
| `GET /api/courses/{courseId}/comments` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | Lists active course discussion comments |
| `POST /api/courses/{courseId}/comments` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | Body: `{ text }` (sanitized per `D-SEC-01`) |
| `POST /api/comments/{commentId}/report` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | Body: `{ reason, notes? }` |
| `DELETE /api/courses/{courseId}/comments/{commentId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, course instructor/admin | Course-scoped comment deletion |
| `GET /api/admin/comments`, `/reported`, `/summary` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, moderation read | Admin/Assistant Admin comment moderation queues |
| `DELETE /api/admin/comments/{commentId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, moderation delete | Direct (`Admin`) or `202 Accepted` (`assistant_admin`, `INV-R9`) |
| `PATCH /api/admin/comments/{commentId}/ignore-report` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, moderation | Non-destructive triage clearing report flag |
| `PATCH /api/admin/courses/{courseId}/comments-toggle` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, moderation | Body: `{ commentsEnabled? }`; `Admin` or `202 Accepted` (`INV-R9`) |
| `PUT /api/courses/{courseId}/instructors` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `Admin` | Body: `{ lecturerId, coLecturers? }` |

### 7.3 Domain 07 — Published Versions & Course Review (`reviewHandlers.ts` — `API-REC-02` Canonical Family)
Per **`API-REC-02` (`OWNER APPROVED`)**, the target Django backend adopts **`/api/admin/courses/{courseId}/*`** as the canonical admin Course Review route family and **permanently excludes** the 16 equivalent `/api/admin/review/{courseId}/*` and `/api/approvals/*` / `/api/lecturer/approvals` / `/submit-review` aliases:

| Canonical Target Endpoint (`API-REC-02`) | Classification | Excluded Legacy Alias(es) | Purpose |
| :--- | :---: | :--- | :--- |
| `POST /api/courses/{courseId}/submit` | `OWNER APPROVED` | `/api/courses/{courseId}/submit-review` | Lecturer submits draft for review |
| `GET /api/courses/{courseId}/review-data` | `OWNER APPROVED` | — | Course review data for authorized reviewer/author |
| `GET /api/admin/courses/{courseId}/review` | `OWNER APPROVED` | `/api/admin/review/{courseId}`, `/api/approvals/queue`, `/api/admin/approvals`, `/api/approvals/my-submissions`, `/api/lecturer/approvals` | Canonical admin review data (queue endpoint normalization noted for `WP-5.3` closure) |
| `GET / PUT / DELETE /api/admin/courses/{courseId}/staged-edits` | `OWNER APPROVED` | `/api/admin/review/{courseId}/staged-edits` | Admin staged edits prior to decision |
| `GET / PUT /api/admin/courses/{courseId}/working-notes` | `OWNER APPROVED` | `/api/admin/review/{courseId}/working-notes` | Reviewer working notes |
| `DELETE /api/admin/courses/{courseId}/working-notes/{targetType}/{targetId}` | `OWNER APPROVED` | `/api/admin/review/{courseId}/working-notes/{targetType}/{targetId}` | Delete specific working note |
| `POST /api/admin/courses/{courseId}/decision` | `OWNER APPROVED` | `/api/admin/review/{courseId}/decision` | Execute canonical review decision |
| `POST /api/admin/courses/{courseId}/approve` | `OWNER APPROVED` | `/api/admin/review/{courseId}/approve` | Approve & create immutable `PublishedCourseVersion` (`Rule B`) |
| `POST /api/admin/courses/{courseId}/return-with-edits` | `OWNER APPROVED` | `/api/admin/review/{courseId}/return-with-edits` | Return draft to lecturer with staged edits |
| `POST /api/admin/courses/{courseId}/reject` | `OWNER APPROVED` | `/api/admin/review/{courseId}/reject` | Reject submission |

