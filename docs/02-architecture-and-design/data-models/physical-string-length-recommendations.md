# MetroLMS — Physical String Length Recommendations & `OR-DB-02` Approval Register

> **Document Status:** `OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16` (`OR-DB-02` String Lengths Only; `data-dictionary.md` remains `UNFROZEN`)  
> **Source Baseline:** [`data-dictionary.md`](data-dictionary.md) (`54` active entities / `306` mapped fields; `DepartmentTrack` Option A)  
> **Target Engine:** Microsoft SQL Server 2022 (`D-DB-01`, `mssql-django==2.0.0`) + Python 3.12+ / Django 5.2 LTS  
> **Strict Approval Scope Boundary:** `OR-DB-02` approval recorded on `2026-11-16` applies **only** to string maximum length / `NVARCHAR(n)` or `NVARCHAR(MAX)` selection. It does **not** approve nullability, PK/FK definitions, `IDENTITY`, defaults, `CHECK` constraints, `ISJSON()` constraints, indexes, collation, normalization, or non-string SQL types. `data-dictionary.md` remains `UNFROZEN`, and `WP-5.6` / Phase 12 remain unstarted.

---

## 1. Summary Metrics
- **Original `STR` IDs:** `88` (`STR-01`–`STR-88`)
- **Superseded `STR` Entries Excluded from Active String Inventory:** `2` (`STR-36` `PendingApprovalRequest.id` → `UNIQUEIDENTIFIER`; `STR-72` `GroupQrCode.token_hash` → `VARBINARY(32)`)
- **Active `STR` Entries:** `86` (`51` Cluster 1 + `15` Cluster 2 + `20` Cluster 3)
- **Previously `OWNER-APPROVED` via `OD-PF-08` (Preserved, Not Reopened):** `2` (`STR-45` `PendingApprovalRequest.reason` = `500`, `STR-52` `AuditLogEntry.reason` = `500`)
- **Newly Approved `OR-DB-02` String Lengths (`OWNER-APPROVED — DELEGATED TECHNICAL RECOMMENDATION BATCH — 2026-11-16`):** `84` (`49` Cluster 1 + `15` Cluster 2 + `20` Cluster 3)
- **Previously `OWNER-APPROVED` Outside `STR` Register (`CP-010`, `CP-011`, `CP-012` — Immutable):** `15` (`4` Cluster 1 + `6` Cluster 2 + `5` Cluster 3)
- **Total Active Physical String Fields (`DepartmentTrack` Option A):** `101` (`86` active `STR` + `15` earlier `CP-010`–`CP-012`)
- **Remaining Pending `OR-DB-02` String Lengths:** `0`

---

## 2. Superseded `STR` Entries (`2` Excluded — Non-String Physical Types)

| STR ID | Cluster | Entity | Field | Superseded Physical Type | Reason |
| :---: | :---: | :--- | :--- | :---: | :--- |
| `STR-36` | C1 | `PendingApprovalRequest` | `id` | `UNIQUEIDENTIFIER` | Reclassified from `NVARCHAR(64)` to `UNIQUEIDENTIFIER` under `OR-DB-01`. |
| `STR-72` | C3 | `GroupQrCode` | `token_hash` | `VARBINARY(32)` | Reclassified from `NVARCHAR(128)` to fixed 32-byte SHA-256 digest `VARBINARY(32)` under `OR-DB-01`. |

---

## 3. Preserved `OWNER-APPROVED` String Lengths Outside `STR` (`15` Fields — Immutable)

| Cluster | Entity | Field | Physical Type | Length | Classification | Source |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| C1 | `User` | `full_name` | `NVARCHAR` | `200` | `OWNER-APPROVED` | `CP-010` (`CP1 #10`) |
| C1 | `User` | `educational_qualification` | `NVARCHAR` | `500` | `OWNER-APPROVED` | `CP-010` (`CP1 #10`) |
| C1 | `User` | `address` | `NVARCHAR` | `500` | `OWNER-APPROVED` | `CP-010` (`CP1 #10`) |
| C1 | `DeletedUserTombstone` | `reason` | `NVARCHAR` | `1000` | `OWNER-APPROVED` | `CP-010` (`CP1 #10`) |
| C2 | `Course` | `title` | `NVARCHAR` | `255` | `OWNER-APPROVED` | `CP-011` |
| C2 | `Module` | `title` | `NVARCHAR` | `255` | `OWNER-APPROVED` | `CP-011` |
| C2 | `LessonItem` | `title` | `NVARCHAR` | `255` | `OWNER-APPROVED` | `CP-011` |
| C2 | `LessonItem` | `external_video_url` | `NVARCHAR` | `2048` | `OWNER-APPROVED` | `CP-011` |
| C2 | `CourseCommentReport` | `reason` | `NVARCHAR` | `500` | `OWNER-APPROVED` | `CP-011` |
| C2 | `MediaContentReference` | `title` | `NVARCHAR` | `255` | `OWNER-APPROVED` | `CP-011` |
| C3 | `TrainingGroup` | `name` | `NVARCHAR` | `255` | `OWNER-APPROVED` | `CP-012` |
| C3 | `GroupResource` | `title` | `NVARCHAR` | `255` | `OWNER-APPROVED` | `CP-012` |
| C3 | `GroupResource` | `meeting_url` | `NVARCHAR` | `2048` | `OWNER-APPROVED` | `CP-012` |
| C3 | `NotificationItem` | `title` | `NVARCHAR` | `255` | `OWNER-APPROVED` | `CP-012` |
| C3 | `WhatsAppContact` | `label` | `NVARCHAR` | `150` | `OWNER-APPROVED` | `CP-012` |

---

## 4. Active `OR-DB-02` String-Length Matrix (`86` Active `STR` Fields: `2` `OD-PF-08` + `84` Delegated Batch `2026-11-16`)

### 4.1 Cluster 1 — Identity & Organization (`51` Active `STR` Fields: `2` `OD-PF-08` + `49` Newly Approved)
| STR ID | Cluster | Entity | Field | Physical Type | Approved Length | Classification & Decision Authority | Rationale |
| :---: | :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| `STR-01` | C1 | `User` | `phone_e164` | `NVARCHAR` | `16` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` + `CHECK` Egyptian E.164 (`+201...` is 13 chars; ITU E.164 max 15 digits + `+`). |
| `STR-02` | C1 | `User` | `password_hash` | `NVARCHAR` | `255` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Django 5.2 default is `128` chars; `255` provides headroom for anticipated hashers without guaranteeing every future algorithm. |
| `STR-03` | C1 | `User` | `role` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded 6-tier enum (`assistant_admin` max 15 chars); FK to `RolePolicy.role_key` + filtered `UNIQUE` where `'developer'`. |
| `STR-04` | C1 | `User` | `status` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded enum (`Active`, `Suspended`); `CHECK`-constrained. |
| `STR-05` | C1 | `User` | `national_id` | `NVARCHAR` | `14` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` 14-digit Egyptian National ID (Egypt-only rule); `NVARCHAR(14)` preserves leading zeros with validation enforcing 14 digits. |
| `STR-06` | C1 | `User` | `email` | `NVARCHAR` | `254` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | RFC 5321 maximum email length; filtered `UNIQUE` when non-null. |
| `STR-07` | C1 | `ServerSession` | `session_key` | `NVARCHAR` | `40` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `PK`; matches Django `django_session.session_key` (`40` chars). |
| `STR-08` | C1 | `ServerSession` | `session_data` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Serialized Django session payload (`sessionEpoch` + session state); unbounded. |
| `STR-09` | C1 | `DeletedUserTombstone` | `canonical_user_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` stringified canonical/legacy user ID (`BIGINT` or `usr-...` alias); index-safe. |
| `STR-10` | C1 | `DeletedUserTombstone` | `deleted_by_actor_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Non-FK actor ID snapshot matching `canonical_user_id` format. |
| `STR-11` | C1 | `DeletedUserAlias` | `alias_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` historical/legacy alias ID; O(1) indexed lookup. |
| `STR-12` | C1 | `RolePolicy` | `role_key` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `PK`; matches `User.role` 6-tier enum key. |
| `STR-13` | C1 | `RolePolicy` | `default_capabilities_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | JSON array of capability keys (`ISJSON() = 1`); grows with capability registry. |
| `STR-14` | C1 | `RolePolicy` | `updated_by` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Non-FK actor ID snapshot. |
| `STR-15` | C1 | `UserPermissionOverride` | `granted_capabilities_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | JSON capability list (`ISJSON() = 1`). |
| `STR-16` | C1 | `UserPermissionOverride` | `denied_capabilities_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | JSON capability list (`ISJSON() = 1`). |
| `STR-17` | C1 | `DelegatedAuthority` | `capability_key` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Indexed (`user_id, capability_key`); bounded dot-notation capability key (e.g., `materials.manage_references`). |
| `STR-18` | C1 | `OrganizationalDepartment` | `name_ar` | `NVARCHAR` | `150` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE`; generous Arabic department name headroom without exceeding index limits. |
| `STR-19` | C1 | `OrganizationalDepartment` | `name_en` | `NVARCHAR` | `150` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Optional English department name matching `name_ar`. |
| `STR-20` | C1 | `JobTitle` | `name_ar` | `NVARCHAR` | `150` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE`; generous Arabic job title headroom. |
| `STR-21` | C1 | `JobTitle` | `name_en` | `NVARCHAR` | `150` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Optional English job title matching `name_ar`. |
| `STR-22` | C1 | `MetroLine` | `name_ar` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE`; short transit line names (`الخط الأول`–`المونوريل`). |
| `STR-23` | C1 | `MetroLine` | `name_en` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Optional English metro line name. |
| `STR-24` | C1 | `MaritalStatusCatalog` | `code` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` short catalog slug (`single`, `married`, etc.). |
| `STR-25` | C1 | `MaritalStatusCatalog` | `name_ar` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` Arabic lookup label. |
| `STR-26` | C1 | `MaritalStatusCatalog` | `name_en` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Optional English lookup label. |
| `STR-27` | C1 | `MilitaryServiceStatusCatalog` | `code` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` short catalog slug. |
| `STR-28` | C1 | `MilitaryServiceStatusCatalog` | `name_ar` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` Arabic lookup label. |
| `STR-29` | C1 | `MilitaryServiceStatusCatalog` | `name_en` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Optional English lookup label. |
| `STR-30` | C1 | `HistoricalServiceTrainingRecord` | `course_name` | `NVARCHAR` | `255` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Consistent with `Course.title` (`255`) for Arabic/English course titles. |
| `STR-31` | C1 | `HistoricalServiceTrainingRecord` | `providing_organization` | `NVARCHAR` | `255` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Generous Arabic/English external training provider name. |
| `STR-32` | C1 | `HistoricalServiceTrainingRecord` | `certificate_info_or_notes` | `NVARCHAR` | `1000` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded notes + certificate reference; matches `DeletedUserTombstone.reason` (`1000`). |
| `STR-33` | C1 | `DepartmentTrack` | `department_code` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `PK` (`DepartmentTrack` Option A); short department governance code (`DEPT-...`). |
| `STR-34` | C1 | `DepartmentTrack` | `allowed_tracks_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | JSON array of track IDs (`ISJSON() = 1`). |
| `STR-35` | C1 | `DepartmentTrack` | `updated_by` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Non-FK actor ID snapshot. |
| `STR-37` | C1 | `PendingApprovalRequest` | `action_type` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded action discriminator (`enrollment_remove`, etc.). |
| `STR-38` | C1 | `PendingApprovalRequest` | `execution_status` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded 6-state enum (`ExecutionFailed` max 15 chars); `CHECK`-constrained. |
| `STR-39` | C1 | `PendingApprovalRequest` | `requested_by_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Non-FK actor ID snapshot surviving `D-01`. |
| `STR-40` | C1 | `PendingApprovalRequest` | `reviewed_by_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Non-FK actor ID snapshot surviving `D-01`. |
| `STR-41` | C1 | `PendingApprovalRequest` | `executed_by_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Non-FK actor ID snapshot surviving `D-01`. |
| `STR-42` | C1 | `PendingApprovalRequest` | `target_entity_type` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Composite indexed entity type discriminator. |
| `STR-43` | C1 | `PendingApprovalRequest` | `target_entity_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Composite indexed polymorphic entity ID. |
| `STR-44` | C1 | `PendingApprovalRequest` | `payload_snapshot_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Immutable self-contained request payload JSON (`ISJSON() = 1`). |
| `STR-45` | C1 | `PendingApprovalRequest` | `reason` | `NVARCHAR` | `500` | `OWNER-APPROVED` (`OD-PF-08`, Preserved) | Consistent with `CourseCommentReport.reason` (`500`); previously approved under `OD-PF-08`. |
| `STR-46` | C1 | `AuditLogEntry` | `actor_user_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Non-FK actor ID snapshot surviving `D-01`. |
| `STR-47` | C1 | `AuditLogEntry` | `actor_role_snapshot` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Matches `User.role` (`32`). |
| `STR-48` | C1 | `AuditLogEntry` | `action` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded audit event key. |
| `STR-49` | C1 | `AuditLogEntry` | `target_entity_type` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded target entity name. |
| `STR-50` | C1 | `AuditLogEntry` | `target_entity_id` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded target entity ID snapshot. |
| `STR-51` | C1 | `AuditLogEntry` | `details_snapshot_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Self-contained audit diff/context JSON (`ISJSON() = 1`). |
| `STR-52` | C1 | `AuditLogEntry` | `reason` | `NVARCHAR` | `500` | `OWNER-APPROVED` (`OD-PF-08`, Preserved) | Consistent with `PendingApprovalRequest.reason` (`500`); previously approved under `OD-PF-08`. |

### 4.2 Cluster 2 — Courses & Learning (`15` Active `STR` Fields: `15` Newly Approved)
| STR ID | Cluster | Entity | Field | Physical Type | Approved Length | Classification & Decision Authority | Rationale |
| :---: | :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| `STR-53` | C2 | `Course` | `description` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Rich Arabic/English course syllabus/overview; unbounded. |
| `STR-54` | C2 | `Course` | `course_type` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded enum (`main`, `reminder`); `CHECK`-constrained. |
| `STR-55` | C2 | `Course` | `lifecycle_status` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded enum (`Draft`, `InReview`, `Published`, `Archived`). |
| `STR-56` | C2 | `CourseDraft` | `title_snapshot` | `NVARCHAR` | `255` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Matches `Course.title` (`255` `OWNER-APPROVED`). |
| `STR-57` | C2 | `LessonItem` | `lesson_type` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded lesson type enum (`video`, `pdf`, `quiz`, etc.). |
| `STR-58` | C2 | `QuizDefinition` | `questions_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Multi-question Arabic/English quiz JSON (`ISJSON() = 1`); unbounded. |
| `STR-59` | C2 | `CourseReviewSubmission` | `review_status` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded review workflow enum; `CHECK`-constrained (`OR-DB-08a` permanent persistence). |
| `STR-60` | C2 | `StagedAdminEdit` | `edit_payload_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Staged curriculum/metadata diff JSON (`ISJSON() = 1`; `OR-DB-08b` permanent persistence). |
| `STR-61` | C2 | `WorkingNote` | `note_body` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Free-form Arabic/English reviewer notes; unbounded (`OR-DB-08c` permanent persistence). |
| `STR-62` | C2 | `CourseComment` | `body` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Free-form Arabic/English discussion comment; sanitized HTML/text. |
| `STR-63` | C2 | `CourseCommentReport` | `status` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded moderation status enum (`Pending`, `Resolved`, `Dismissed`). |
| `STR-64` | C2 | `MediaAsset` | `storage_key` | `NVARCHAR` | `512` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` relative storage path/key (`INV-DOM21-05`); well within SQL Server 900/1700-byte index key limit (`512` chars = `1024` bytes <= `1700` bytes non-clustered). |
| `STR-65` | C2 | `MediaAsset` | `file_name` | `NVARCHAR` | `255` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Standard OS/HTTP filename limit (Arabic/English). |
| `STR-66` | C2 | `MediaAsset` | `mime_type` | `NVARCHAR` | `127` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Validated `type/subtype` only (excluding HTTP `Content-Type` parameters); project allowlist limit accommodating documented MetroLMS MIME types (including OpenXML presentation type), not claiming `127` is the RFC 6838 theoretical max. |
| `STR-67` | C2 | `MediaAsset` | `sha256_checksum` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Indexed exact `64`-char hex `SHA-256` digest. |

### 4.3 Cluster 3 — Groups & Training Operations (`20` Active `STR` Fields: `20` Newly Approved)
| STR ID | Cluster | Entity | Field | Physical Type | Approved Length | Classification & Decision Authority | Rationale |
| :---: | :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| `STR-68` | C3 | `TrainingGroup` | `group_type` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded enum (`regular`, `reminder`); `CHECK`-constrained. |
| `STR-69` | C3 | `GroupAssistantAssignment` | `assignment_role` | `NVARCHAR` | `32` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Part of `UNIQUE(training_group_id, user_id, assignment_role)`; bounded role slug. |
| `STR-70` | C3 | `GroupRenewalCycle` | `cycle_code` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Generated code `CYC-<groupId>-<NN>` (`64` gives ample headroom). |
| `STR-71` | C3 | `GroupRenewalCycle` | `cycle_status` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded 5-state enum (`Scheduled`, `Active`, `Completed`, `Expired`, `Cancelled`). |
| `STR-73` | C3 | `GroupJoinRequest` | `request_status` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded enum (`Pending`, `Approved`, `Rejected`). |
| `STR-74` | C3 | `GroupResource` | `provider` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded enum (`teams`, `zoom`, `meet`, `other`). |
| `STR-75` | C3 | `EnrollmentSourceGrant` | `source_type` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded enum (`direct`, `group`, `self:continued`). |
| `STR-76` | C3 | `CertificateRecord` | `certificate_serial` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` human-readable serial/verification code (`64` chars). |
| `STR-77` | C3 | `CertificateRecord` | `recipient_name_snapshot` | `NVARCHAR` | `200` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Matches `User.full_name` (`200` `OWNER-APPROVED`) so snapshot never truncates. |
| `STR-78` | C3 | `CertificateRecord` | `course_title_snapshot` | `NVARCHAR` | `255` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Matches `Course.title` (`255` `OWNER-APPROVED`) so snapshot never truncates. |
| `STR-79` | C3 | `NotificationItem` | `body` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Arabic/English notification body; supports variable-length messages. |
| `STR-80` | C3 | `WhatsAppContact` | `phone_e164` | `NVARCHAR` | `16` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Matches `User.phone_e164` (`16`; ITU E.164 max 15 digits + `+`). |
| `STR-81` | C3 | `UserWhatsAppVisibility` | `scenario_key` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Part of `UNIQUE(user_id, scenario_key)`; bounded scenario identifier. |
| `STR-82` | C3 | `ScheduledJob` | `job_key` | `NVARCHAR` | `100` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` job key (`process_due_group_renewals` = 26 chars; `100` gives headroom). |
| `STR-83` | C3 | `ScheduledJob` | `schedule_config` | `NVARCHAR` | `255` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Cron/interval expression or schedule descriptor. |
| `STR-84` | C3 | `ScheduledJob` | `timezone` | `NVARCHAR` | `64` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | IANA timezone name (`Africa/Cairo` = 12 chars; IANA max < 40). |
| `STR-85` | C3 | `ScheduledJobRun` | `idempotency_key` | `NVARCHAR` | `128` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | `UNIQUE` composite occurrence key (`job_key:window_iso`). |
| `STR-86` | C3 | `ScheduledJobRun` | `status` | `NVARCHAR` | `20` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Bounded 5-state enum (`Pending`, `Running`, `Succeeded`, `Failed`, `Skipped`). |
| `STR-87` | C3 | `ScheduledJobRun` | `error_message` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Unbounded failure message / stack trace diagnostic. |
| `STR-88` | C3 | `ScheduledJobRun` | `details_json` | `NVARCHAR(MAX)` | `MAX` | `OWNER-APPROVED` (`OR-DB-02`, `2026-11-16`) | Structured retry attempt history JSON (`ISJSON() = 1`). |

