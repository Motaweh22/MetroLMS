# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 09 — Group Membership & Trainee Rosters

> **Document Title:** Domain 09 — Group Membership & Trainee Rosters Business Rules  
> **Document Identifier:** `METROLMS-DOM-GRP-009`  
> **Document Status:** `APPROVED — PHASE 2B BASELINE`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-07`](../../architecture/decision-register.md#d-07), [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-12 (Phase 2B Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern trainee enrollment rosters (`group.traineeIds`), strict separation of instructional/oversight staff from trainee counts, multi-source enrollment provenance, and per-course continuation grant resolution (`D-07`) upon trainee removal from a group.
- **Domain Boundaries:**
  - *In Scope:* Adding/removing trainees in `group.traineeIds` and `groupMembers[group.id]`, authoritative `traineeCount` calculation (`group.traineeIds.length`), staff role field separation (`primaryInstructorId`, `assistantLecturerIds`, `supervisorIds`), and `D-07` group member removal per-course resolution (`revoke` vs. `continue_self`).
  - *Out of Scope:* Group creation/archiving and operational status (Domain 08), in-place renewal cycle execution (Domain 10 / `LLD-003`), and course-level progress/certificate computation rules (`D-12`, `D-13`, Phase 3).
- **Actors & Responsibilities:**
  - *Admin (`admin`) / Superior (`superior`):* Enrolls trainees into groups and executes trainee removal (`removeGroupMember`) with explicit per-course continuation or revocation decisions.
  - *Assistant Admin (`assistant_admin`):* Views rosters under `Rule A`; roster mutations requiring approval follow `INV-R9` / `INV-R10`.
  - *Trainee (`user`):* Appears in `group.traineeIds` while enrolled; retains access to kept courses via `/my-courses` if granted a `D-07` continuation grant after removal.
- **Core Entities:** `TrainingGroup.traineeIds`, `GroupMemberRecord`, `EnrollmentGrant` (`direct` | `group` | `self`), `CourseAttempt`.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM09-01`** | **Authoritative Trainee Count** | `traineeCount === group.traineeIds.length`. Lecturers (`primaryInstructorId`), assistant lecturers (`assistantLecturerIds`), and supervisors (`supervisorIds`) are stored in separate staff fields and never counted as trainees. | Roster Serializer & Group DTO |
| **`INV-DOM09-02`** | **Immediate Removal Exclusion** | Removing a trainee via `removeGroupMember` immediately deletes their ID from `group.traineeIds` and `groupMembers[group.id]`, decrementing `traineeCount` immediately—even if `D-07` continuation grants are issued. | `removeGroupMember` Mutation |
| **`INV-DOM09-03`** | **Per-Course Continuation Grant Isolation (`D-07`)** | For each course selected to keep during group removal, the system converts the group grant to a standalone grant with `kind: 'self'` and `sourceId: 'self:continued:${groupId}:${attemptId}'` on the **same `attemptId`**, lifting the group deadline. | Group Removal Handler |
| **`INV-DOM09-04`** | **Revocation Without History Deletion (`D-07`)** | For courses not kept (and lacking `direct` or other active `sourceGroupIds`), access is deactivated (`Inactive` / `RevokedByGroupRemoval`); historical `LessonProgress`, `QuizAttempt`, and `Certificate` records are never hard-deleted. | Enrollment Provenance Resolver |
| **`INV-DOM09-05`** | **Cycle Snapshot Roster Preservation (`D-GRP-04`)** | Historical `GroupRenewalCycle.traineeIds` snapshots preserve attendance at the time of cycle sealing and are not mutated retroactively by subsequent roster removals. | Cycle Sealing & Audit Query |

---

## 3. State Transition Rules

### 3.1 Group Member Removal Per-Course Decision (`D-07`)
1. Admin selects a trainee to remove from Group $G$.
2. Admin makes an explicit per-course choice for each course $C \in G.\text{courses}$:
   - **Keep (`continue_self`):** Convert group grant to standalone `kind: 'self'` with `sourceId: 'self:continued:${groupId}:${attemptId}'` on the trainee's existing `attemptId`, preserving all progress and lifting Group $G$'s deadline.
   - **Revoke (`revoke`):** Remove Group $G$ from `sourceGroupIds`. If `direct === false` and `sourceGroupIds.length === 0`, deactivate course access while preserving historical progress/attempts/certificates.
3. Remove trainee from `group.traineeIds` and `groupMembers[group.id]`.
4. Trainee no longer appears in Group $G$'s active roster or `traineeCount`, and no longer accesses Group $G$ on `/my-groups`; kept courses remain accessible via `/my-courses`.

---

## 4. Boundary Conditions & Edge Cases

- **Multi-Group Overlap:** If a trainee belongs to both Group $G_1$ and Group $G_2$ assigned to Course $C$, removing the trainee from $G_1$ with `revoke` removes $G_1$ from `sourceGroupIds` while retaining active enrollment via $G_2$.
- **Isolation from `S1` (Self-Enrollment Lock):** `D-07` continuation grants (`self:continued:${groupId}:${attemptId}`) are explicitly isolated from `S1` (disabled self-enrollment restrictions) so removed trainees can finish kept courses even when public self-enrollment is disabled.
- **Staff User Deletion Cascade (`D-01`–`D-03`, `D-11`):** Removing a user account cleans up `group.traineeIds` or staff fields (`primaryInstructorId = null`, etc.) according to deletion cascade rules without altering historical cycle snapshots.

---

## 5. Traceability Matrix

| Business Rule / Invariant | Governing Decision / Requirement | Technical Domain Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM09-01`, `INV-DOM09-02` | [`domain-business-rules.md §10`](../../requirements/domain-business-rules.md) | [`METROLMS-TECH-DOM-009`](../../03-technical-documentation/domains/groups/domain-09-group-membership-and-rosters.md) | Phase 4 Gate B |
| `INV-DOM09-03`, `INV-DOM09-04` | [`D-07`](../../architecture/decision-register.md#d-07) | [`METROLMS-TECH-DOM-009`](../../03-technical-documentation/domains/groups/domain-09-group-membership-and-rosters.md) | Phase 4 Gate B |
| `INV-DOM09-05` | [`D-GRP-04`](../../architecture/decision-register.md#d-grp-04) | [`METROLMS-TECH-DOM-009`](../../03-technical-documentation/domains/groups/domain-09-group-membership-and-rosters.md) | Phase 4 Gate B |

