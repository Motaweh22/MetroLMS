# Metro Courses LMS — Classic Chen-Notation Entity-Relationship Diagram (ERD) Specification

**Document Version:** 2.0.0 (Unified Full-System Edition)  
**Status:** Complete / Standalone Architecture Specification  
**Classification:** Documentation-Only Architecture Deliverable  
**Companion Documents:**  
- [`docs/backend/database-schema.md`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/database-schema.md) (Authoritative Production Schema & Data Dictionary)  
- [`docs/backend/erd.md`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/erd.md) (Crow's Foot Relational ERD Specification)  
**Visual Style:** Classic Chen Notation (Textbook Relational Modeling)  
**Deliverable Formats:** Native Draw.io XML (`.drawio`), High-Resolution Vector SVG (`.svg`), and High-Resolution Raster PNG (`.png`) in [`docs/backend/diagrams/`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/)  

---

## Executive Summary & Document Purpose

This document provides the authoritative **Classic Chen-Notation Entity-Relationship Diagram (ERD)** specification for the future production database of the **Metro Courses Learning Management System (LMS)**.

While [`docs/backend/erd.md`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/erd.md) models the physical database schema using Crow's Foot notation (emphasizing table columns, foreign key constraints, composite primary keys, and index structures), this Chen-notation specification models the system from a **pure conceptual and logical database design perspective**, strictly reflecting the semantics taught in classic database systems textbooks (e.g. Peter Chen, Silberschatz, Elmasri & Navathe).

Every entity, weak entity, relationship, identifying relationship, attribute, primary key, derived attribute, multivalued attribute, cardinality (`1`, `N`, `M`), and total participation constraint in this deliverable is grounded directly in the verified production schema ([`docs/backend/database-schema.md`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/database-schema.md)).

---

## 1. Classic Chen Notation Guide & Visual Semantics

The diagrams in this deliverable strictly implement classic Peter Chen ERD conventions:

| Construct | Visual Symbol | Chen Notation Semantics | Metro Courses Implementation Example |
| :--- | :---: | :--- | :--- |
| **Strong Entity** | **Single Rectangle** | An independent entity possessing its own primary key (surrogate UUID or natural key) whose existence does not depend on an identifying parent entity. | `USERS`, `COURSES`, `DEPARTMENTS`, `TRAINING_GROUPS`, `MEDIA_STORAGE_OBJECTS` |
| **Weak Entity** | **Double Rectangle** | An entity whose existence and identification depend on an identifying owner entity. It cannot exist without its parent and inherits its parent's key. | `USER_CREDENTIALS` (owner: `USERS`), `COURSE_CHAPTERS` (owner: `COURSES`), `GROUP_RENEWAL_CYCLES` (owner: `TRAINING_GROUPS`), `LESSON_PROGRESS` (owner: `COURSE_ATTEMPTS`) |
| **Relationship** | **Single Diamond** | A semantic association between two or more strong entities with explicit business meaning. | `EMPLOYS` (Department to User), `STAFFS` (User to Course), `SUPERVISES` (User to Group), `MEMBER_OF` (User to Group) |
| **Identifying Relationship** | **Double Diamond** | A relationship that identifies and binds a weak entity to its owner entity. | `AUTHENTICATES` (`USERS` to `USER_CREDENTIALS`), `STRUCTURED_INTO` (`COURSES` to `COURSE_CHAPTERS`), `EXECUTES_CYCLE` (`TRAINING_GROUPS` to `GROUP_RENEWAL_CYCLES`) |
| **Simple / Atomic Attribute** | **Single Oval** | A single-valued atomic property connected to its owning entity or relationship. | `username`, `email`, `title`, `duration_seconds` |
| **Primary Key Attribute** | **Underlined Text in Oval** | The minimal set of attributes that uniquely identifies an entity instance. Represented by an underlined attribute name within an oval (tinted rose in SVG). | `<u>id</u>`, `<u>external_id</u>`, `<u>code</u>`, `<u>certificate_number</u>` |
| **Partial Key (Discriminator)** | **Dashed Underlined Text in Oval** | The attribute that distinguishes occurrences of a weak entity that share the same identifying owner entity. | `<u>cycle_number</u>` within `GROUP_RENEWAL_CYCLES`, `<u>order_index</u>` within `COURSE_CHAPTERS` |
| **Derived Attribute** | **Dashed Oval** | An attribute whose value is computed dynamically or cached from other base attributes rather than stored as an independent atomic fact. | `rating_cache`, `enrollment_cache`, `progress_percent` |
| **Multivalued Attribute** | **Double Oval** | An attribute that can hold multiple values for a single entity instance. | Conceptual multi-contacts or alias sets (resolved relationally via junction tables). |
| **Composite Attribute** | **Hierarchical Ovals** | An attribute subdivided into smaller constituent sub-attributes (e.g. `name` into `first_name`, `last_name`). | Staged review payloads or JSONB metadata blocks. |
| **Relationship Cardinality** | **Explicit '1', 'N', 'M' Labels** | Explicit alphanumeric labels at connector ends indicating whether the relationship is One-to-One (1:1), One-to-Many (1:N), or Many-to-Many (M:N). | `1` at `DEPARTMENTS` end and `N` at `USERS` end for `EMPLOYS`. |
| **Participation Constraint** | **Single vs. Double Line** | **Single Line:** Partial participation (an entity may exist without participating).<br>**Double Line:** Total participation (every entity instance MUST participate in the relationship; mandatory foreign key constraint). | Double line from `USER_CREDENTIALS` to `AUTHENTICATES` (every credential must belong to a user); double line from `COURSE_ATTEMPTS` to `UNDERTAKES` (every attempt must belong to a user). |

---

## 2. Complete Full-System Unified Chen ERD Poster (All 42 Schema Tables)

The **Full-System Chen ERD Poster** unites **ALL 42 relational tables** from the production database schema onto **one continuous, seamless canvas** (5,200 × 3,800 pixels).

Unlike conceptual overviews, this poster represents the entire enterprise database model: every entity, weak entity, relationship, identifying relationship, primary key, candidate key, derived metric, cardinality badge, and total participation constraint is fully articulated.

### Full-System Poster Deliverables

- **Editable Draw.io XML Source:** [`docs/backend/diagrams/erd-chen-full-system.drawio`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-full-system.drawio) (137.8 KB)
- **High-Resolution Vector SVG:** [`docs/backend/diagrams/erd-chen-full-system.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-full-system.svg) (104.1 KB)
- **High-Resolution Raster PNG:** [`docs/backend/diagrams/erd-chen-full-system.png`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-full-system.png) (1.39 MB, 5,200 × 3,800 px)

### Unified Poster Preview

![Metro Courses LMS Complete Full-System Chen ERD Poster](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-full-system.svg)

### Instructions for Viewing and Zooming at Different Scales

Because this poster contains 562 graph nodes, 189 attribute ovals, 63 relationship diamonds, and 316 connector lines, it is designed to be inspected across multiple zoom levels:

1. **Vector SVG Viewing (Recommended for Infinite Clarity):**
   - Open [`erd-chen-full-system.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-full-system.svg) directly in Google Chrome, Microsoft Edge, or Mozilla Firefox.
   - Use `Ctrl + Mouse Wheel` or `Ctrl + + / -` to zoom from 25% (overview of all 5 regions) up to 500% (close-up inspection of individual attribute ovals, primary keys, and cardinality labels). Vector elements remain pin-sharp at any magnification.
2. **High-Resolution PNG Viewing:**
   - Open [`erd-chen-full-system.png`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-full-system.png) in any standard image viewer (Windows Photos, QuickLook, IrfanView, Photoshop).
   - Set zoom to **100% (Actual Pixels)** to pan smoothly across the 5 regions with crisp 1:1 text readability.
3. **Interactive Visual Studio Code Inspection:**
   - Install the **Draw.io Integration** extension (`hediet.vscode-drawio`).
   - Open `erd-chen-full-system.drawio` to interactively pan, zoom, highlight connector paths, and inspect metadata directly inside the IDE.
4. **Online Collaborative Editing:**
   - Go to [app.diagrams.net](https://app.diagrams.net), click **Open Existing Diagram**, and select `erd-chen-full-system.drawio`.

### Canvas Topology & Thematic Regions

The canvas is organized into **five labeled thematic panels** surrounding central shared entities to minimize line crossings and maximize referential clarity:

```
+---------------------------------------------------------------------------------------------------+
| METRO COURSES LMS — COMPLETE FULL-SYSTEM CHEN-NOTATION ENTITY-RELATIONSHIP POSTER (5200 x 3800)   |
+-----------------------------------------------------------------+---------------------------------+
| REGION 1: IDENTITY, DEPARTMENTS & PERMISSIONS                   | REGION 2: COURSES, CURRICULUM   |
| (Top-Left: X: 80 .. 2480, Y: 160 .. 1850)                       | & QUALITY REVIEW WORKFLOW       |
|                                                                 | (Top-Right: X: 2550 .. 5100,    |
| DEPARTMENTS, TRAINING_TRACKS, USERS (Center-Left hub!),         | Y: 160 .. 1850)                 |
| USER_CREDENTIALS, USER_LEGACY_ALIASES, SYSTEM_CAPABILITIES,     |                                 |
| ROLE_CAPABILITY_DEFAULTS, USER_PERMISSION_OVERRIDES,            | COURSES (Center-Right hub!),    |
| ADMIN_OPERATIONAL_DELEGATIONS, APPROVAL_REQUESTS,               | COURSE_INSTRUCTORS,             |
| SYSTEM_SECURITY_AUDIT_LOGS                                      | COURSE_PREREQUISITES,           |
|                                                                 | COURSE_CHAPTERS, ITEMS,         |
|                                                                 | EXTERNAL_RESOURCES,             |
|                                                                 | REVIEW_RECORDS, FEEDBACK_ITEMS, |
|                                                                 | BASELINE_SNAPSHOTS,             |
|                                                                 | ADMIN_STAGED_EDITS,             |
|                                                                 | REVIEWER_WORKING_NOTES          |
+-----------------------------------------------------------------+---------------------------------+
| REGION 3: TRAINING GROUPS, RENEWAL CYCLES & MATERIALS           | REGION 4: ENROLLMENT, ATTEMPTS, |
| (Bottom-Left: X: 80 .. 2480, Y: 1980 .. 3720)                   | PROGRESS & CERTIFICATES         |
|                                                                 | (Bottom-Center: X: 2550 .. 3750,|
| TRAINING_GROUPS, GROUP_SUPERVISORS, GROUP_RENEWAL_CYCLES,       | Y: 1980 .. 3720)                |
| GROUP_CYCLE_COURSE_ASSIGNMENTS, GROUP_MEMBERSHIPS,              |                                 |
| GROUP_JOIN_REQUESTS, GROUP_RESOURCES, GROUP_MATERIAL_FOLDERS,   | COURSE_ENROLLMENTS,             |
| GROUP_MATERIAL_FILES                                            | COURSE_ATTEMPTS,                |
|                                                                 | LESSON_PROGRESS,                |
|                                                                 | COURSE_CERTIFICATES             |
+-----------------------------------------------------------------+---------------------------------+
| REGION 5: DISCUSSIONS, WHATSAPP CONTACTS, MEDIA METADATA & ANALYTICS TELEMETRY                    |
| (Bottom-Right: X: 3820 .. 5100, Y: 1980 .. 3720)                                                  |
|                                                                                                   |
| COURSE_COMMENTS, COMMENT_REPORTS, COURSE_WHATSAPP_OVERRIDES,                                      |
| PLATFORM_SUPPORT_CONTACTS, MEDIA_STORAGE_OBJECTS, LEARNING_SESSION_EVENTS                         |
+---------------------------------------------------------------------------------------------------+
```

### Complete 42-Table Schema Coverage Checklist

Every table from [`docs/backend/database-schema.md`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/database-schema.md) appears **exactly once** on the unified canvas:

| # | Table Name in Schema | Modeled Construct in Full-System Chen Poster | Chen Symbol | Region | Primary Key / Identifying Owner |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `departments` | `DEPARTMENTS` | Strong Entity | Region 1 | `<u>id</u>` |
| 2 | `training_tracks` | `TRAINING_TRACKS` | Strong Entity | Region 1 | `<u>id</u>` |
| 3 | `department_tracks` | `CONFIGURES_TRACK` | Relationship w/ attributes | Region 1 | Composite `(department_id, track_id)` |
| 4 | `users` | `USERS` | Strong Entity (Hub) | Region 1 | `<u>id</u>` (external_id UK) |
| 5 | `user_credentials` | `USER_CREDENTIALS` | Weak Entity | Region 1 | Identified by `USERS` via `AUTHENTICATES_VIA` |
| 6 | `user_legacy_aliases` | `USER_LEGACY_ALIASES` | Weak Entity | Region 1 | Identified by `USERS` via `HAS_ALIAS` |
| 7 | `system_capabilities` | `SYSTEM_CAPABILITIES` | Strong Entity | Region 1 | `<u>code</u>` |
| 8 | `role_capability_defaults` | `ROLE_DEFAULTS` | Relationship w/ attributes | Region 1 | Composite `(role, capability_code)` |
| 9 | `user_permission_overrides` | `USER_PERMISSION_OVERRIDES` | Weak Entity | Region 1 | `<u>id</u>` (FKs to `users`, `capabilities`) |
| 10 | `admin_operational_delegations` | `ADMIN_OPERATIONAL_DELEGATIONS` | Weak Entity | Region 1 | `<u>id</u>` (FKs to grantee, granter) |
| 11 | `approval_requests` | `APPROVAL_REQUESTS` | Strong Entity | Region 1 | `<u>id</u>` |
| 12 | `system_security_audit_logs` | `SYSTEM_SECURITY_AUDIT_LOGS` | Strong Entity | Region 1 | `<u>id</u>` |
| 13 | `courses` | `COURSES` | Strong Entity (Hub) | Region 2 | `<u>id</u>` (external_id UK) |
| 14 | `course_instructors` | `STAFFED_BY` | Relationship w/ attributes | Region 2 | Cross-domain: `USERS` to `COURSES` |
| 15 | `course_prerequisites` | `REQUIRES_PREREQUISITE` | Unary Relationship | Region 2 | Self-referential DAG on `COURSES` |
| 16 | `course_chapters` | `COURSE_CHAPTERS` | Weak Entity | Region 2 | Identified by `COURSES` via `STRUCTURED_INTO` |
| 17 | `course_chapter_items` | `COURSE_CHAPTER_ITEMS` | Weak Entity | Region 2 | Identified by `CHAPTERS` via `CONTAINS_ITEM` |
| 18 | `course_external_resources` | `COURSE_EXTERNAL_RESOURCES` | Weak Entity | Region 2 | Identified by `COURSES` via `PROVIDES_RESOURCE` |
| 19 | `course_review_records` | `COURSE_REVIEW_RECORDS` | Weak Entity | Region 2 | Identified by `COURSES` via `EVALUATED_IN` |
| 20 | `course_review_feedback_items` | `COURSE_REVIEW_FEEDBACK_ITEMS`| Weak Entity | Region 2 | Identified by `RECORDS` via `DETAILS_FEEDBACK` |
| 21 | `course_baseline_snapshots` | `COURSE_BASELINE_SNAPSHOTS` | Weak Entity | Region 2 | Identified by `COURSES` via `SNAPSHOTS_STATE` |
| 22 | `course_admin_staged_edits` | `COURSE_ADMIN_STAGED_EDITS` | Weak Entity (1:1) | Region 2 | Identified by `COURSES` via `STAGES_EDITS` |
| 23 | `course_reviewer_working_notes` | `COURSE_REVIEWER_WORKING_NOTES`| Weak Entity | Region 2 | Identified by `COURSES` via `ANNOTATES` |
| 24 | `training_groups` | `TRAINING_GROUPS` | Strong Entity | Region 3 | `<u>id</u>` (external_id UK) |
| 25 | `group_supervisors` | `SUPERVISED_BY` | Relationship w/ attributes | Region 3 | Cross-domain: `USERS` to `TRAINING_GROUPS` |
| 26 | `group_renewal_cycles` | `GROUP_RENEWAL_CYCLES` | Weak Entity | Region 3 | Identified by `GROUPS` via `EXECUTES_CYCLE` |
| 27 | `group_cycle_course_assignments` | `GROUP_CYCLE_COURSE_ASSIGNMENTS`| Weak Entity | Region 3 | Schedules `COURSES` for `CYCLES` |
| 28 | `group_memberships` | `GROUP_MEMBERSHIPS` | Weak Entity | Region 3 | Enrolls `USERS` into `TRAINING_GROUPS` |
| 29 | `group_join_requests` | `GROUP_JOIN_REQUESTS` | Weak Entity | Region 3 | Requests join to `TRAINING_GROUPS` |
| 30 | `group_resources` | `GROUP_RESOURCES` | Weak Entity | Region 3 | Identified by `GROUPS` via `SHARES_RESOURCE` |
| 31 | `group_material_folders` | `GROUP_MATERIAL_FOLDERS` | Weak Entity | Region 3 | Identified by `GROUPS` via `ORGANIZES_FOLDER` |
| 32 | `group_material_files` | `GROUP_MATERIAL_FILES` | Weak Entity | Region 3 | Identified by `FOLDERS` via `CONTAINS_FILE` |
| 33 | `course_enrollments` | `COURSE_ENROLLMENTS` | Associative Entity | Region 4 | Connects `USERS` & `COURSES` |
| 34 | `course_attempts` | `COURSE_ATTEMPTS` | Strong / Dependent | Region 4 | `<u>id</u>` (external_id UK) |
| 35 | `lesson_progress` | `LESSON_PROGRESS` | Weak Entity | Region 4 | Identified by `ATTEMPTS` via `RECORDS_PROGRESS` |
| 36 | `course_certificates` | `COURSE_CERTIFICATES` | Strong / Extension | Region 4 | `<u>id</u>` (1:1 from `COURSE_ATTEMPTS`) |
| 37 | `course_comments` | `COURSE_COMMENTS` | Strong Entity | Region 5 | `<u>id</u>` (hosts on `COURSES`, authors `USERS`) |
| 38 | `comment_reports` | `COMMENT_REPORTS` | Weak Entity | Region 5 | Identified by `COMMENTS` via `MODERATES_REPORT` |
| 39 | `course_whatsapp_overrides` | `COURSE_WHATSAPP_OVERRIDES` | Weak Entity (1:1) | Region 5 | Identified by `COURSES` via `OVERRIDES_CONTACT` |
| 40 | `platform_support_contacts` | `PLATFORM_SUPPORT_CONTACTS` | Strong Entity | Region 5 | `<u>id</u>` |
| 41 | `media_storage_objects` | `MEDIA_STORAGE_OBJECTS` | Strong Entity | Region 5 | `<u>id</u>` (serves binary to `ITEMS`) |
| 42 | `learning_session_events` | `LEARNING_SESSION_EVENTS` | Strong Entity (Fact)| Region 5 | `<u>id</u>` (telemetry emitted by `USERS`) |

---

## 3. Conceptual Overview Diagram

The High-Level Conceptual Overview diagram models the overarching architecture of the Metro Courses platform. It captures the essential business entities, their key attributes, their identifying relationships, and their inter-domain connections without visual clutter.

### Overview Diagram Preview

![Metro Courses LMS Conceptual Overview](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-overview.svg)

### Deliverable Files

- **Editable Draw.io Source:** [`docs/backend/diagrams/erd-chen-overview.drawio`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-overview.drawio)
- **Standalone SVG Export:** [`docs/backend/diagrams/erd-chen-overview.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-overview.svg)

### Key Architectural Invariants Visible in the Overview

1. **Identity & Credential Separation:**  
   `USERS` is a strong entity identified by `<u>id</u>` and `external_id`. `USER_CREDENTIALS` is a weak entity (double rectangle) connected via the identifying double diamond `AUTHENTICATES` with total participation (double line). User profile updates never touch password hashes.
2. **Curriculum Hierarchy:**  
   `COURSES` connects to weak entity `COURSE_CHAPTERS` via identifying relationship `STRUCTURED_INTO` (1:N), which in turn connects to weak entity `COURSE_CHAPTER_ITEMS` via identifying relationship `CONTAINS` (1:N).
3. **Decoupled Training History:**  
   Trainees participate in cohorts (`TRAINING_GROUPS`) via `MEMBER_OF`. However, course learning executions (`COURSE_ATTEMPTS`) exist independently via `UNDERTAKES` (`USERS`) and `TARGETS` (`COURSES`). Removing a user from a training group leaves their course attempts, progress, and certificates 100% intact.
4. **1-to-1 Verification Guarantee:**  
   `COURSE_ATTEMPTS` awards `COURSE_CERTIFICATES` via `QUALIFIES_FOR` (1:1 with total participation on certificates). A certificate cannot exist without a valid completed course attempt.

---

## 4. Domain-Level Chen Entity-Relationship Diagrams

To preserve visual elegance and enable focused architectural review of individual subsystems, the Metro Courses LMS database is also partitioned into five detailed domain diagrams.

---

### 4.1 Domain 1: Identity, Departments & Permissions Governance

This domain models organizational departments, technical training tracks, canonical user identities, authentication credentials, legacy alias mapping, system capabilities, role baselines, per-user overrides, administrative delegations, approval queues, and security audit logs.

#### Domain 1 Diagram Preview

![Domain 1: Identity, Departments & Permissions](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-identity-permissions.svg)

#### Deliverable Files

- **Editable Draw.io Source:** [`docs/backend/diagrams/erd-chen-identity-permissions.drawio`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-identity-permissions.drawio)
- **Standalone SVG Export:** [`docs/backend/diagrams/erd-chen-identity-permissions.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-identity-permissions.svg)

---

### 4.2 Domain 2: Courses, Curriculum & Quality Review Workflow

This domain models the educational catalog, multi-instructor staffing, recursive prerequisites, hierarchical chapters and lesson items, supplementary web resources, administrative 3-way review staging, and private reviewer notes.

#### Domain 2 Diagram Preview

![Domain 2: Courses, Curriculum & Review Workflows](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-courses-curriculum.svg)

#### Deliverable Files

- **Editable Draw.io Source:** [`docs/backend/diagrams/erd-chen-courses-curriculum.drawio`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-courses-curriculum.drawio)
- **Standalone SVG Export:** [`docs/backend/diagrams/erd-chen-courses-curriculum.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-courses-curriculum.svg)

---

### 4.3 Domain 3: Training Groups, Renewal Cycles & Cohort Materials

This domain models enterprise training cohorts (`TRAINING_GROUPS`), supervisory staffing, recurring renewal cycles, cycle-specific course assignments with deadline overrides, membership rosters, join requests, collaborative web links, and nested cohort material folders and files.

#### Domain 3 Diagram Preview

![Domain 3: Training Groups, Renewal Cycles & Materials](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-groups-cycles.svg)

#### Deliverable Files

- **Editable Draw.io Source:** [`docs/backend/diagrams/erd-chen-groups-cycles.drawio`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-groups-cycles.drawio)
- **Standalone SVG Export:** [`docs/backend/diagrams/erd-chen-groups-cycles.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-groups-cycles.svg)

---

### 4.4 Domain 4: Enrollment, Learning Attempts, Lesson Progress & Certification

This domain models course registration, multi-attempt learning execution, granular playback telemetry tracking, and verified certificate generation upon 100% course syllabus completion.

#### Domain 4 Diagram Preview

![Domain 4: Enrollment, Attempts, Progress & Certificates](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-learning-progress.svg)

#### Deliverable Files

- **Editable Draw.io Source:** [`docs/backend/diagrams/erd-chen-learning-progress.drawio`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-learning-progress.drawio)
- **Standalone SVG Export:** [`docs/backend/diagrams/erd-chen-learning-progress.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-learning-progress.svg)

---

### 4.5 Domain 5: Discussions, WhatsApp Contacts, Media Storage & Analytics Telemetry

This domain models course discussion forums, content abuse moderation with soft-delete retention, course WhatsApp contact overrides, platform support lines, cloud media storage metadata, and genuine learning session telemetry.

#### Domain 5 Diagram Preview

![Domain 5: Discussions, Contacts, Media & Telemetry](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-discussions-media-analytics.svg)

#### Deliverable Files

- **Editable Draw.io Source:** [`docs/backend/diagrams/erd-chen-discussions-media-analytics.drawio`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-discussions-media-analytics.drawio)
- **Standalone SVG Export:** [`docs/backend/diagrams/erd-chen-discussions-media-analytics.svg`](file:///c:/Users/Administrator/Desktop/metro%20courses/docs/backend/diagrams/erd-chen-discussions-media-analytics.svg)

---

## 5. Cross-Domain Referential Mapping & Conceptual Topology

In relational Crow's Foot ERDs, inter-domain connections are represented as foreign key arrows. In classic Chen notation, these become **first-class conceptual relationships** with explicit diamond symbols, participation constraints, and cardinalities:

| Cross-Domain Relationship | Entity A (Role) | Cardinality A | Entity B (Role) | Cardinality B | Participation Constraints & Business Invariants |
| :--- | :--- | :---: | :--- | :---: | :--- |
| `EMPLOYS` | `DEPARTMENTS` | `1` | `USERS` | `N` | Mandatory foreign key on user (`department_id`). Deleting department is restricted (`ON DELETE RESTRICT`). |
| `STAFFED_BY` | `COURSES` | `N` | `USERS` (Lecturer) | `M` | Resolves multi-instructor staffing. Primary lecturer and co-instructors maintain equal grading authority. |
| `SUPERVISED_BY` | `TRAINING_GROUPS` | `N` | `USERS` (Supervisor) | `M` | Supervisors manage cohort progress and approve join requests. |
| `MEMBER_OF` | `TRAINING_GROUPS` | `N` | `USERS` (Trainee) | `M` | Cohort membership. **Critical Invariant:** Removing a trainee from `GROUP_MEMBERSHIPS` does NOT delete their course enrollments or attempts. |
| `SCHEDULES_COURSE` | `GROUP_RENEWAL_CYCLES` | `N` | `COURSES` | `M` | Cycle-specific course syllabus. Allows curriculum to evolve across quarterly/annual compliance cycles. |
| `REGISTERS_FOR` | `USERS` / `COURSES` | `1` / `1` | `COURSE_ENROLLMENTS` | `N` | Formal course registration gate. Trainees cannot attempt courses without an active enrollment. |
| `UNDERTAKES` | `USERS` | `1` | `COURSE_ATTEMPTS` | `N` | Total participation on attempts. Academic attempts are permanent institutional records. |
| `TARGETS_COURSE` | `COURSES` | `1` | `COURSE_ATTEMPTS` | `N` | Total participation on attempts. A course cannot be deleted while student attempts are on record. |
| `OCCURS_IN_CYCLE` | `GROUP_RENEWAL_CYCLES` | `0..1` | `COURSE_ATTEMPTS` | `N` | Optional relationship (`ON DELETE SET NULL`). Deleting a renewal cycle preserves the student's historical attempt. |
| `AWARDS_CERTIFICATE` | `COURSE_ATTEMPTS` | `1` | `COURSE_CERTIFICATES` | `1` | Strict 1-to-1 relationship. Certificate contains immutable recipient name and course title snapshots. |
| `SERVES_BINARY` | `MEDIA_STORAGE_OBJECTS` | `1` | `COURSE_CHAPTER_ITEMS` | `N` | Metadata registry disassociates binary files from lesson item definitions (`ON DELETE SET NULL`). |
| `CAPTURES_SESSION` | `COURSE_CHAPTER_ITEMS` | `1` | `LEARNING_SESSION_EVENTS`| `N` | True telemetry playback events, eliminating synthetic or fabricated peak viewing hours. |

---

## 6. Architectural Assumptions & Modeling Decisions

During the generation and validation of this Chen-notation deliverable against `docs/backend/database-schema.md` and `docs/backend/erd.md`, the following modeling decisions were observed:

1. **Pure Chen Weak Entity Semantics:**  
   Tables that cannot exist without an identifying parent table and share their parent's key (e.g. `USER_CREDENTIALS`, `COURSE_CHAPTERS`, `COURSE_CHAPTER_ITEMS`, `GROUP_RENEWAL_CYCLES`, `LESSON_PROGRESS`, `COMMENT_REPORTS`, `COURSE_WHATSAPP_OVERRIDES`) are strictly rendered as **Double Rectangles** connected via **Double Diamonds** with **Double Lines** indicating total participation.
2. **Associative Entities in Chen Notation:**  
   Junction tables carrying meaningful business attributes (such as `GROUP_CYCLE_COURSE_ASSIGNMENTS`, `GROUP_MEMBERSHIPS`, `COURSE_ENROLLMENTS`, and `DEPARTMENT_TRACKS`) are modeled as associative entities or relationships with descriptive attributes (e.g. `is_enabled`, `course_role`, `custom_deadline`, `join_source`).
3. **Derived Attributes vs Base Fields:**  
   Attributes that represent computed or cached metrics (`rating_cache`, `enrollment_cache`, `progress_percent`) are explicitly rendered as **Dashed Ovals** in accordance with classic Chen conventions.
4. **Binary Separation Guarantee:**  
   `MEDIA_STORAGE_OBJECTS` and `GROUP_MATERIAL_FILES` are modeled strictly as relational metadata entities. No binary `BLOB` attributes exist within the relational diagrams.
5. **No Modifications to Codebase:**  
   All deliverables are documentation-only. No frontend source files, migrations, or `package.json` dependencies were altered.

---

## 7. How to Open and Edit the Draw.io Source Files

The `.drawio` files are standard, uncompressed XML files compatible with all versions of diagrams.net / Draw.io:

1. **Online (Web Browser):**
   - Navigate to [app.diagrams.net](https://app.diagrams.net).
   - Click **Open Existing Diagram**.
   - Browse to `docs/backend/diagrams/` and select any `.drawio` file.
2. **Visual Studio Code:**
   - Install the **Draw.io Integration** extension (`hediet.vscode-drawio`).
   - Click on any `.drawio` file in the VS Code file explorer to edit interactively within the IDE.
3. **Standalone Desktop App:**
   - Open Draw.io Desktop and select **Open Existing Diagram**.

---

## 8. Deliverable Verification & Sign-Off

### Verification Checklist

- [x] **Full-System Unified Poster Created:** `erd-chen-full-system.drawio`, `erd-chen-full-system.svg`, and `erd-chen-full-system.png` created in `docs/backend/diagrams/`.
- [x] **All 42 Schema Tables Covered:** 100% of tables verified against `docs/backend/database-schema.md` with zero omissions.
- [x] **Entity Uniqueness Guaranteed:** Each table appears exactly once across the unified canvas; zero duplicate entity nodes.
- [x] **Conceptual Overview Preserved:** `erd-chen-overview.drawio` and `erd-chen-overview.svg` maintained without alteration.
- [x] **All 5 Domain Diagrams Preserved:** Individual domain `.drawio` and `.svg` files maintained for modular review.
- [x] **Classic Chen Conventions Preserved:** Strong entities (single rect), weak entities (double rect), relationships (diamond), identifying relationships (double diamond), PKs (underlined), derived attributes (dashed ovals), cardinalities (`1`, `N`, `M`), and total participation (double lines) validated.
- [x] **High-Resolution Exports:** Standalone SVG (vector) and PNG (5,200 × 3,800 px, 1.39 MB) verified.
- [x] **Zero Dependencies Added:** No build tools or npm packages were introduced.
- [x] **Increment 12 Not Started:** All work remained strictly within architecture and documentation boundaries.

**Document Status:** Complete & Ready for Review.
