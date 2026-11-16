# MetroLMS — Repository Context Recovery & Work Resumption

You are working on the MetroLMS project.

Your context may be incomplete or you may have lost track of previous project decisions.

Before executing any task, reconstruct the actual current project state from the repository.

This is a context-recovery task, not authorization to expand the current scope.

## 1. Inspect the Authoritative Project Documents

Inspect the latest versions of:

- `comprehensive-documentation-program-plan-REV6.md`
- `docs/project-state/CURRENT.md`
- The checkpoint registry and latest checkpoint.
- The latest WP-5.4 closure record.
- The CP-009 closure checkpoint.
- The CP-009 MetroLine/Egyptian-phone erratum.
- `logical-data-model.md`
- `erd-crow-foot.md`
- `data-dictionary.md`
- The revised WP-5.5 execution plan.
- Relevant domain documentation.
- Owner decision records.

Use the actual repository paths. If a filename differs, locate the authoritative equivalent.

Do not assume an older conversation report is newer than the repository.

## 2. Reconstruct Project History

Establish:

1. What the project is.
2. The approved target backend architecture.
3. The documentation roadmap and current phase.
4. What WP-5.4 delivered.
5. Why WP-5.4 was closed.
6. What CP-009 represents.
7. What the post-closure erratum corrected.
8. Which Owner decisions are approved.
9. Which work packages are authorized.
10. Which activities remain prohibited.

Preserve the target stack:

- Django
- Django REST Framework
- Microsoft SQL Server

No PostgreSQL assumptions.

## 3. Reconstruct the Current WP-5.5 Execution Status

The Project Owner explicitly authorized WP-5.5 to begin under the revised plan.

The first authorized scope is:

- Stage 0 — Preparation & Entity Inventory.
- Stage 1 — Cluster 1: Identity & Organization.

The mandatory stopping point is:

**Owner Field-Review Checkpoint 1.**

The expected Cluster 1 inventory contains 15 entities:

- User
- ServerSession
- DeletedUserTombstone
- RolePolicy
- UserPermissionOverride
- DelegatedAuthority
- OrganizationalDepartment
- JobTitle
- MetroLine
- MaritalStatusCatalog
- MilitaryServiceStatusCatalog
- HistoricalServiceTrainingRecord
- DepartmentTrack
- PendingApprovalRequest
- AuditLogEntry

Verify which activities have actually been completed from repository evidence.

Do not assume the execution was completed merely because it was authorized.

## 4. Owner Decision Baseline

Preserve all approved Owner decisions `D-OWNER-REV-01` through `D-OWNER-REV-33`.

Important business rules include:

- Developer, Super Admin, and Admin have unrestricted access to system data and operations.
- Developer can create Super Admin and Admin.
- Super Admin can create Admin.
- Admin creates ordinary accounts.
- Account recovery is administratively managed.
- Egyptian mobile numbers only.
- Frontend input exactly 11 digits, approved prefixes `010`, `011`, `012`, `015`.
- Backend normalization to canonical E.164 with `+20`.
- Database uniqueness on normalized canonical phone identity.
- One Primary Lecturer per Course.
- Zero or more Assistant Lecturers per Course.
- Every Reminder Course must have exactly one Main Course.
- Reminder Courses cannot be nested or chained.
- Review and staged records are retained indefinitely by default.
- Explicit deletion is restricted to Developer, Super Admin, and Admin.
- Educational Qualification is free text.
- Marital and Military Service Status remain separate managed catalogs.
- Historical Service Training is a distinct `0..N` child-record relationship.
- MetroLine is a managed catalog required on User profile and used for Course Audience targeting.
- Empty Course Audience is fail-closed.
- Approved deferred enhancements must not block current core work.

## 5. Data Dictionary Governance

During WP-5.5, `data-dictionary.md` is permitted to receive draft logical field mappings.

Every field must carry one governance state:

- `OWNER-APPROVED`
- `PROPOSED`
- `TECHNICAL-RECOMMENDATION`
- `UNRESOLVED-BUSINESS-RULE`
- `DEFERRED`

No field may be considered Owner-approved without explicit Owner acceptance.

The Owner must receive complete Cluster 1 field inventory and technical recommendations at Checkpoint 1.

Do not proceed to Cluster 2 until the Owner explicitly approves Checkpoint 1.

## 6. Efficiency Instructions

- Avoid rewriting plans that have already been approved.
- Do not generate fragmented reports for individual entities.
- Prepare Cluster 1 as one consolidated batch.
- Use existing Owner decisions instead of asking repeated questions.
- Investigate technical questions using the repository and existing domain documentation.
- Escalate genuine unresolved business rules only.
- Present recommendations with evidence and consequences.

## 7. Prohibited Actions

Until separately authorized, do not:

- Start Cluster 2 or Cluster 3.
- Start WP-5.6.
- Create Django models.
- Create Django migrations.
- Write SQL DDL.
- Provision the database.
- Modify frontend/backend runtime.
- Modify MSW handlers or tests.
- Generate UML diagrams.
- Freeze the Data Dictionary.

## 8. Required Response

Return a single consolidated **MetroLMS Project Context Recovery Report** containing:

1. Project Overview.
2. Authoritative Documents Inspected.
3. Approved Architecture.
4. Completed Work Packages and Checkpoints.
5. Owner Decision Baseline.
6. Current WP-5.5 Execution Status.
7. Verified Completed Tasks.
8. Remaining Stage 0 / Stage 1 Work.
9. Current Owner Review Checkpoint.
10. Deferred and Blocked Work.
11. Immediate Next Authorized Action.

For every status, distinguish:

- `COMPLETED`
- `AUTHORIZED — NOT YET EXECUTED`
- `IN PROGRESS`
- `AWAITING OWNER REVIEW`
- `DEFERRED`
- `BLOCKED`

Do not modify files during context recovery.

Do not execute new work until the context report is presented and the current authorization boundary is confirmed.

**Expected baseline:**

- WP-5.4: CLOSED — CP-009 ACCEPTED WITH DOCUMENTED ERRATUM.
- WP-5.5: AUTHORIZED — Stage 0 and Stage 1 only, stopping at Owner Checkpoint 1.
- WP-5.6: BLOCKED — NOT AUTHORIZED.