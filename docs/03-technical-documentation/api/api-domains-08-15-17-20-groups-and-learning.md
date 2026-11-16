# MetroLMS — REST API Contract Specification
## Cluster 2: Training Groups, Renewals, Learning Engine, Notifications & Gated Domains (Domains 08–15, 17, 19–20 + Gated 16, 21)

> **Document Title:** Domain API Contracts — Groups, Renewals, Learning Progress, Notifications & Media  
> **Document Identifier:** `METROLMS-API-DOM-002`  
> **Document Status:** `DRAFT — WORK IN PROGRESS (WP-5.3)`  
> **Canonical Authority Level:** Level 5 API Integration Contract  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend DRF Developers, Frontend React Integrators, Database Architects & QA Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01), `D-06`–`D-09`, `D-12`, `D-13`, `D-GRP-01`–`08`, `API-REC-01`, `API-REC-02a`–`02c`, `API-REC-06` (`DEFERRED`), `API-REC-08A`/`08B`, `A-03c-1`–`3` (`OPEN`)  
> **Foundational Components:** [`openapi-foundations.md`](openapi-foundations.md) (`METROLMS-API-FOUND-001`)  
> **Last Updated:** 2026-11-14 (`WP-5.3` Execution)

---

## 1. Scope & Governance Classification

- **Unblocked Domains Covered:** **Domains 08–10** (Training Groups, Membership/Rosters, Reminder Programs & In-Place Renewal), **Domains 11–15** (Enrollment Provenance, Course Attempts, Progress Calculation, Lesson Progress Engine, Certificates), **Domain 17** (Group Monitoring), **Domain 19** (Notifications & WhatsApp), **Domain 20** (Scheduling & Background Jobs).
- **Conditionally Gated Domains Covered:** **Domain 16** (In-Person Attendance — unimplemented in frontend/MSW) and **Domain 21** (Decoupled Media — `A-03c-1`–`A-03c-3` & `API-REC-06` deferred items).

---

## 2. Domains 08 & 17 — Training Groups, Assistants & Monitoring (`groupHandlers.ts`, `permissionsHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `GET /api/groups/my` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` (trainee) | None | `200 OK`: `TraineeGroupItemDTO[]` (archived excluded per `ADR-008`) | `TrainingGroup`, `GroupMembership`, `GroupRenewalCycle` |
| `GET /api/groups/{groupId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` (member/authorized) | None | `200 OK`: `EnrichedTrainingGroup`; post-deadline access rules enforced | `TrainingGroup`, `GroupRenewalCycle` |
| `GET /api/admin/groups` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, group read (`Rule A` / `INV-R7`) | None | `200 OK`: `GroupSummaryDTO[]` (`traineeCount = traineeIds.length`) | `TrainingGroup` |
| `POST /api/admin/groups` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `groups.create` | Group creation DTO (`groupType`, optional `deadlineDateTime`, `autoRenewalEnabled`, `intervalDays` in `[1, 730]`) | `201 Created`; `422` if `autoRenewalEnabled` without valid `deadlineDateTime` (`CURRENT.md` §7) | `TrainingGroup`, initial `GroupRenewalCycle` |
| `GET /api/admin/groups/{groupId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, group read / `INV-R7` | None | `200 OK`: `TrainingGroup` | `TrainingGroup` |
| `PUT /api/admin/groups/{groupId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `groups.edit` + `INV-R7` | Group update DTO | `200 OK`; Option A / `INV-DOM10-10`: removing `deadlineDateTime` on Reminder Group disables `autoRenewalEnabled`, preserves `groupType: 'reminder'`, marks future cycles `Cancelled` | `TrainingGroup`, `GroupRenewalCycle` |
| `DELETE /api/admin/groups/{groupId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `groups.delete` | None | `200 OK` (`Admin`) or **`202 Accepted`** (`PendingApprovalResponse` for `assistant_admin`, `INV-R9`) | `TrainingGroup`, `PendingApprovalRequest` |
| `GET /api/groups/{groupId}/assistants` | **`OWNER APPROVED`** (`API-REC-02a`) | `sessionid`, group admin read | None | `200 OK`: list of assigned group assistants | `GroupAssistantAssignment` |
| `POST /api/groups/{groupId}/assistants` | **`OWNER APPROVED`** (`API-REC-02b`) | `sessionid` + `X-CSRFToken`, `groups.manage_assistants` | Individual addition payload (`lecturerId`) | `201 Created` / `200 OK` (individual addition, never bulk replacement) | `GroupAssistantAssignment` |
| `DELETE /api/groups/{groupId}/assistants/{lecturerId}` | **`OWNER APPROVED`** (`API-REC-02c`) | `sessionid` + `X-CSRFToken`, `groups.manage_assistants` | None | `200 OK` (removes group-specific assignment only) | `GroupAssistantAssignment` |
| `PUT /api/admin/groups/{groupId}/assistants` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `groups.manage_assistants` | Bulk assistant list | Preserved for admin group form; subordinate `API-REC-02a`–`02c` retained | `GroupAssistantAssignment` |
| `GET /api/admin/lecturers` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, admin/group read | None | `200 OK`: `CandidateLecturerDTO[]` (`INV-R8` excludes `Developer`) | `User` (lecturer/assistant) |
| `GET /api/admin/groups/{groupId}/monitoring` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, monitoring read (`INV-DOM17-01` `supervisorIds` allowed) | Query: `cycleId` | `200 OK`: group monitoring dashboard metrics | Aggregated `CourseAttempt` / `LessonProgress` |

---

## 3. Domain 09 — Group Membership, QR & Join Requests (`groupHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `GET /api/admin/groups/{groupId}/members` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, group read | None | `200 OK`: `GroupMember[]` | `GroupMembership` |
| `POST /api/admin/groups/{groupId}/members` | **`OWNER APPROVED`** (`A-03c` 2026-11-14) | `sessionid` + `X-CSRFToken`, **`groups.manage_members`** + `INV-R7` | Member IDs payload | `200`/`201` or `202` (`INV-R9`). Group assignment never bypasses `groups.manage_members` | `GroupMembership`, `EnrollmentSourceGrant` |
| `DELETE /api/admin/groups/{groupId}/members/{userId}` | **`OWNER APPROVED`** (`A-03c` 2026-11-14, `D-07`) | `sessionid` + `X-CSRFToken`, **`groups.manage_members`** + `INV-R7` | `{ removeCourseIds?: string[] }` (`MFR-24`) | `200` or `202` (`INV-R9`). Revokes group grant (`revoked_by_group_removal`) or converts retained courses to `self:continued:{groupId}:{attemptId}`; preserves attempts/progress | `GroupMembership`, `EnrollmentSourceGrant` |
| `GET /api/admin/trainees` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, group member read | None | `200 OK`: `CandidateTraineeDTO[]` (`INV-R8` compliant) | `User` |
| `GET /api/groups/join/{code}/info` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | None | `200 OK`: `GroupPreviewInfoDTO` | `GroupQrCode`, `TrainingGroup` |
| `POST /api/groups/join` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | `{ code }` | `200 OK`: `JoinGroupQRResponseDTO` | `GroupJoinRequest` / `GroupMembership` |
| `POST /api/admin/groups/{groupId}/qr-code/rotate` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `groups.manage_members` | None | `200 OK`: rotated QR code | `GroupQrCode` |
| `POST /api/admin/groups/{groupId}/qr-code/toggle` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `groups.manage_members` | `{ enabled: boolean }` | `200 OK` | `GroupQrCode` |
| `GET /api/admin/groups/{groupId}/join-requests` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, group read | Query: `status` | `200 OK` | `GroupJoinRequest` |
| `POST /api/admin/groups/{groupId}/join-requests/{requestId}/review` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, `groups.manage_members` | `{ decision: 'approve' \| 'reject' }` | `200 OK` | `GroupJoinRequest`, `GroupMembership` |

---

## 4. Domains 10 & 20 — Reminder Programs, In-Place Renewal & Background Jobs (`groupHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Notes | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `POST /api/admin/groups/{groupId}/renew` | **`OWNER APPROVED`** (`API-REC-01`, `API-REC-08A`/`08B`, `INV-DOM10-11`/`12`) | `sessionid` + `X-CSRFToken`, renewal permission | Triggers manual in-place renewal | `200`/`201`: new `GroupRenewalCycle`; `422` if Regular Group (`API-REC-08B`), archived (`API-REC-08A`), missing `deadlineDateTime`, or `now < currentCycle.deadlineDateTime` (`INV-DOM10-11`); **`409 Conflict`** on losing concurrent transaction (`INV-DOM10-12`, error `code` pending `OD-API-04`) | `GroupRenewalCycle`, `TrainingGroup` |
| `GET /api/admin/groups/{groupId}/cycles` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, group read | None | `200 OK`: `GroupRenewalCycle[]` | `GroupRenewalCycle` |
| `GET /api/admin/groups/{groupId}/cycles/{cycleId}` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, group read | None | `200 OK`: `GroupRenewalCycle` | `GroupRenewalCycle` |
| `POST /api/admin/groups/{groupId}/courses` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken`, group course assignment | Assigns courses to active cycle | `200 OK` | `GroupCourseAssignment` |
| `POST /api/admin/groups/check-all-due-renewals` & `POST /api/admin/groups/{groupId}/check-auto-renewal` | **`RETIRED IN PRODUCTION`** (`API-REC-01`) | N/A in target Django | Browser-triggered automatic renewal **prohibited** in production | Replaced by **Domain 20 / D4** Windows Task Scheduler (every 6h) -> `python manage.py process_due_group_renewals` (`INV-DOM20-06`/`07`) | `ScheduledJobRun`, `GroupRenewalCycle` |

---

## 5. Domains 11–15 — Enrollment, Attempts, Progress & Certificates (`enrollmentHandlers.ts`, `learningHandlers.ts`, `performanceHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `POST /api/courses/{courseId}/enrollments` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` (trainee) | None | `200`/`201`: `EnrollmentResponse` (creates `direct` grant + standalone attempt; `/enroll` alias excluded in target API) | `Enrollment`, `EnrollmentSourceGrant`, `CourseAttempt` |
| `GET /api/courses/{courseId}/enrollment` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | None | `200 OK`: `EnrollmentStatusResponse` | `Enrollment` |
| `GET /api/enrollments/my` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | Query: `enriched` (`true`/`false`) | `200 OK`: `CourseEnrollment[]` / `EnrolledCourseDetail[]` | `Enrollment`, `EnrollmentSourceGrant` |
| `GET /api/users/{userId}/courses/{courseId}/attempts` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | Query: `cycleId` | `200 OK`: `CourseAttempt[]` (`D-06` per-attempt isolation; `INV-R8`) | `CourseAttempt` |
| `GET /api/courses/{courseId}/progress` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` | Query: `attemptId`, `groupId`, `cycleId` | `200 OK`: `CourseProgressResponse` (`D-12` integer rounding) | `CourseAttempt`, `LessonProgress` |
| `POST /api/courses/{courseId}/items/{itemId}/activity` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | `RecordActivityPayload` (scoped to `attemptId`) | `200 OK`: `{ item: LessonProgress }` (legacy `/lessons/...` and root `/activity` aliases excluded) | `LessonProgress` |
| `POST /api/courses/{courseId}/items/{itemId}/complete` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` | `CompleteLessonPayload` (scoped to `attemptId`) | `200 OK`: `CompleteLessonResponse` (may issue version-scoped `Certificate` per `D-13`; legacy `/lessons/...` & root `/complete` aliases excluded) | `LessonProgress`, `Certificate` |
| `GET /api/lecturer/courses/{courseId}/performance` | `CANONICAL EXISTING REQUIREMENT` | `sessionid`, assigned lecturer/admin | None | `200 OK`: `CoursePerformanceReportDTO` (`MFR-32` includes standalone attempts) | Aggregated `CourseAttempt`, `LessonProgress` |
| `GET /api/certificates/verify/{code}` | **`PROPOSED TARGET CONTRACT`** | Public / session | Certificate verification code | `200 OK`: version-scoped verification & revocation status (`D-13` / Domain 15; not yet in MSW) | `Certificate`, `CertificateRevocation` |

---

## 6. Domain 19 — Notifications & WhatsApp (`notificationHandlers.ts`, `performanceHandlers.ts`, `permissionsHandlers.ts`)

| Method & Path | Classification | Auth / Capabilities | Request / Query Params | Responses & Invariants | DB-Bound Flag (`WP-5.5`) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `GET /api/notifications` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` (self) | None | `200 OK`: `NotificationsResponse` (`D-08`, `INV-R8` sanitized) | `Notification` |
| `PATCH /api/notifications/{id}/read` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` (self) | None | `200 OK`: `{ notification, unreadCount }` (duplicate `POST` alias excluded) | `Notification.readAt` |
| `POST /api/notifications/mark-all-read` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` + `X-CSRFToken` (self) | None | `200 OK`: `{ success, unreadCount }` | `Notification` |
| `GET / PUT /api/courses/{courseId}/whatsapp-contacts` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` (+ `X-CSRFToken` on `PUT`, `Admin`) | `{ contacts \| null }` | `200 OK` (`D-09`) | `WhatsAppContact` |
| `GET / PUT /api/admin/users/{userId}/whatsapp-visibility` | `CANONICAL EXISTING REQUIREMENT` | `sessionid` (+ `X-CSRFToken` on `PUT`, `Admin`) | `SaveUserWhatsAppVisibilityPayload` | `200 OK` (`INV-R8` on `userId`) | `UserWhatsAppVisibility` |
| `GET /api/public/support-contacts` | `CANONICAL EXISTING REQUIREMENT` | Public / session | Query: `scenario` (`WhatsAppSupportScenario`) | `200 OK`: `PublicSupportContactsResponseDTO` | `WhatsAppContact`, `UserWhatsAppVisibility` |

---

## 7. Conditionally Gated Domains 16 & 21

### 7.1 Domain 16 — In-Person Attendance (`BLOCKED / UNIMPLEMENTED`)
- **Status:** **Zero** endpoints exist in MSW handlers or frontend services (confirmed in Phase 4 Gate B, `CURRENT.md` §7). No attendance API paths or DTOs are invented in `WP-5.3`; deferred pending Owner specification of attendance session/roster endpoints.

### 7.2 Domain 21 — Decoupled Media & Group Materials (`groupHandlers.ts` — `A-03c` & `API-REC-06` Gated)
| Method & Path | Classification | Gate / Invariant |
| :--- | :---: | :--- |
| `GET /api/admin/groups/{groupId}/materials` | `CANONICAL EXISTING REQUIREMENT` | Query: `cycleId`; returns active (non-detached) folders & `MediaAssetReference` items |
| `POST / PUT / DELETE /api/admin/groups/{groupId}/materials/folders*` | `CANONICAL EXISTING REQUIREMENT` | Requires `materials.manage_folders` + `INV-R7` + `file.groupId === groupId` (`A-03c`) |
| `POST /api/admin/groups/{groupId}/materials/files` | **`PROVISIONAL — PARTIAL`** | Step 1 multipart upload (`materials.upload_files`) + Step 2 reference attach (`materials.manage_references`, `INV-DOM21-12`/`21`) |
| `PUT /api/admin/groups/{groupId}/materials/files/{fileId}` | **`PROVISIONAL — AMENDED`** | `INV-DOM21-16` prohibits mutating immutable `fileName`/`mimeType`/`sizeBytes`; Step 2 repoint creates new `assetId` (`INV-DOM21-09`) |
| `PATCH /api/admin/groups/{groupId}/materials/files/{fileId}` | `OWNER APPROVED` (`INV-DOM21-13`–`15`) | Updates reference-level `title` / `isVisible` in Active/Unsealed cycles (`materials.manage_references`); `422` on Sealed/Published (`INV-DOM21-14`) |
| `DELETE /api/admin/groups/{groupId}/materials/files/{fileId}` | **`BLOCKED ON A-03c-1`** | Must perform `INV-DOM21-18` Logical Detachment (`materials.manage_references`); exact DTO/state/audit fields pending `A-03c-1` |
| `PUT /api/admin/groups/{groupId}/materials/files/{fileId}/move` | **`BLOCKED ON A-03c-3`** | Capability (`materials.manage_folders` vs. `materials.manage_references`) pending `A-03c-3` |
| `DELETE /api/media/assets/{assetId}` | **`BLOCKED ON A-03c-2`** | Zero-reference physical deletion & `409` concurrency semantics pending `A-03c-2` (`INV-DOM21-17`) |
| `GET /api/media/assets/{assetId}/stream` | **`PROPOSED TARGET CONTRACT`** | `OWNER APPROVED` Phase 1 Django-mediated `Range` (`206`/`416`) streaming (`API-REC-06`); `CL-03` signed URLs `DEFERRED` |

