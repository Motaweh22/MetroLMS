# MetroLMS — `CP-009` Baseline Erratum & Addendum: `MetroLine` & Egyptian-Only Phone Policy

> **Document Type:** Post-Closure Baseline Erratum & Addendum (`CP-009` Preserved Immutable)  
> **Parent Closure / Checkpoint:** [`CP-009-2026-11-14-rev6-wp-5-4-closure.md`](file:///d:/LMS%20MEtro%20Project/docs/project-state/checkpoints/CP-009-2026-11-14-rev6-wp-5-4-closure.md) (`WP-5.4: CLOSED — CP-009 ACCEPTED WITH DOCUMENTED ERRATUM`)  
> **Date:** `2026-11-14`  
> **Authorization:** Explicit Project Owner Approval (`2026-11-14`)  
> **Scope Boundary:** Documentation-only reconciliation. Zero `data-dictionary.md` edits, zero field mapping (`WP-5.5` remains `NOT STARTED`), zero SQL DDL (`WP-5.6` remains `BLOCKED`), and zero runtime/MSW/test changes.

---

## 1. Purpose

This erratum performs two narrowly scoped, Owner-approved corrections to the closed `WP-5.4` conceptual baseline (`CP-009`) without rewriting or erasing the immutable `CP-009` checkpoint file:

1. **Reconcile `MetroLine`** as a distinct conceptual catalog entity in `logical-data-model.md` (`§2.1` & `§3`) and `erd-crow-foot.md` (Clusters 1 & 2).
2. **Confirm the Egyptian-Only Mobile Phone Policy** (`+20`, prefixes `010`, `011`, `012`, `015`) and document its complete normalization and validation contract.

---

## 2. `MetroLine` Conceptual Reconciliation (`LDM` ↔ `ERD`)

### 2.1 Existing Owner-Approved Baseline Preserved
- **User Profile Requirement (`D-OWNER-REV-14`, `LDM` §6.1 #14):** Metro Line is required at account creation across all 6 roles.
- **Admin-Managed Catalog (`D-OWNER-REV-02`, `10`, `24`, `LDM` §6.2):** Managed (`add`, `rename`, `delete` subject to entity-reference usage guard) exclusively by `developer`, `super_admin`, and `admin`.
- **Approved Initial Catalog Values (`LDM` §6.2):**
  1. `الخط الأول`
  2. `الخط الثاني`
  3. `الخط الثالث`
  4. `الخط الرابع`
  5. `المونوريل`
- **Course Audience Dimension (`D-OWNER-REV-04`, `11`, `23`, `LDM` §6.4):** One of the three Course Audience dimensions alongside `OrganizationalDepartment` and `JobTitle` (`OR` matching; fail-closed when no audience criteria are configured).

### 2.2 Reconciled Entity & Relationships
- **Entity Added (`LDM` §2.1 & `ERD` Cluster 1):** `MetroLine` (`METRO_LINE`).
- **`MetroLine ↔ User` (`1` per `User` : `0..N` per `MetroLine`):** `METRO_LINE ||--o{ USER : "classifies"` — every `User` has a required `MetroLine` assignment (`D-OWNER-REV-14`), while a `MetroLine` catalog entry may exist with zero or more `User`s.
- **`Course ↔ MetroLine` (`0..N` : `0..N`):** `COURSE }o--o{ METRO_LINE : "targets_audience"` — a `Course` may target zero or more `MetroLine`s (`0..N`, with `0` configured criteria fail-closed per `D-OWNER-REV-23`), and a `MetroLine` may be targeted by zero or more `Course`s.

---

## 3. Egyptian-Only Phone Policy & Normalization Contract (`D-OWNER-REV-13`, `18`, `29`)

The Project Owner explicitly confirms that **only Egyptian mobile numbers are permitted**. *(Supersedes the earlier "no Egyptian-only restriction" note in `D-OWNER-REV-18` without creating a new ordinary decision ID.)*

### 3.1 Approved Contract
1. **Frontend Input:** Exactly **11 numeric digits** (local Egyptian mobile format).
2. **Allowed Egyptian Mobile Prefixes:** `010`, `011`, `012`, `015` (followed by 8 digits = 11 digits total).
3. **Rejection of Foreign-Country Numbers:** Non-Egyptian country codes and non-Egyptian number formats are rejected; the country code (`+20`) is fixed, not configurable.
4. **Rejection of Malformed / Invalid Numbers:** Non-digit characters, lengths ≠ 11, or invalid prefixes are rejected by backend validation (`400 Bad Request` / field validation error) before normalization or DB persistence/lookup.
5. **Canonical Normalization:** Remove the domestic leading `0` and prepend Egypt country code `+20` to produce canonical E.164 (`+2010...`, `+2011...`, `+2012...`, `+2015...`).
6. **Illustrative Example:**
   - **Local 11-digit input:** `01012345678`
   - **Canonical E.164 output:** `+201012345678`
   - *(Identical rule applies to `011`, `012`, and `015`.)*
7. **Database Uniqueness & Empty Baseline:** Database enforces global uniqueness on the normalized canonical E.164 value. Current DB contains zero user accounts and zero phone records; no legacy phone migration or duplicate cleanup is required. No OTP/SMS requirements are authorized.
8. **Original Input Storage:** There is **no** assumption that the original 11-digit input must be stored separately from the normalized canonical E.164 identity (storage/field choices remain `PROPOSED` for `WP-5.5` Checkpoint 1).

### 3.2 Supporting Numbering-Plan Evidence
- **NTRA Numbering-Plan Notifications Published via ITU:**
  - **2014 Egypt Mobile-Range Announcement (NTRA via ITU Operational Bulletin / National Numbering Plan):** Documents Egypt country code `+20` and 11-digit national mobile numbering (`010`, `011`, `012` + 8 subscriber digits; 10-digit NSN after stripping domestic trunk prefix `0`).
  - **2017 Egypt `015` Mobile-Range Addition (NTRA via ITU):** Documents the addition of the fourth mobile network prefix `015` (11-digit domestic `015XXXXXXXX` → `+2015XXXXXXXX` E.164).

---

## 4. `WP-5.5` Plan Alignment (Planning Only — Not Started)

- `MetroLine` and its `User ↔ MetroLine` (`1 : 0..N`) and `Course ↔ MetroLine` (`0..N : 0..N`) relationships are included in the Cluster 1 / Stage 1–2 inventory.
- The Egyptian-only phone policy replaces the prior international-number ambiguity; phone normalization (`010`/`011`/`012`/`015` → `+20`) is a defined technical requirement rather than an open country-scope question.
- The 5-part phone technical review remains part of **Mandatory Owner Review Checkpoint 1** (without reopening the approved Egyptian-only policy), and all three Mandatory Owner Field-Review Checkpoints remain unchanged.

