# MetroLMS — Physical Types Review Closure Corrections (`WP-5.5`)

> **Document Status:** `TECHNICAL-AUDIT — CLOSURE CORRECTIONS (REPORT-ONLY)`  
> **Scope:** Narrowly scoped correction audit of [`physical-types-review-closure-assessment.md`](physical-types-review-closure-assessment.md), clarifying four presentation, classification, and counting issues before submitting `WP-5.5` Physical Types Review Closure for Owner review.  
> **Governance Notice:** **Zero existing project files were modified.** `physical-types-review-closure-assessment.md`, `data-dictionary.md` (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`), `decision-register.md`, `CP-010`–`CP-012`, `CURRENT.md`, `active-roadmap.md`, and all prior audit reports remain completely untouched. `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

This correction audit resolves four presentation and classification issues in [`physical-types-review-closure-assessment.md`](physical-types-review-closure-assessment.md) while reaffirming its overall technical closure recommendation:

1. **Cross-Report Consistency Wording (Correction 1):** Replaces *"zero unaddressed contradictions remaining"* (§8) with the accurate boundary: **"No accidental cross-report inconsistencies remain beyond the explicitly documented unresolved decisions."**
2. **String Inventory `103`-Field Reconciliation (Correction 2):** Confirms `PendingApprovalRequest.id` (`NVARCHAR(64)` vs. `UNIQUEIDENTIFIER`) **is included** in the `88` `TECHNICAL-RECOMMENDATION` rows of [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) (`L81`). Transparently reclassifies the `103` string-inventory rows as **`15` `OWNER-APPROVED` + `87` settled `TECHNICAL-RECOMMENDATION` string lengths + `1` conditional/unresolved candidate (`PendingApprovalRequest.id`)**.
3. **Binary Storage Classification Correction (Correction 3):** Separates `CertificateRecord.verification_token_hash` (`BINARY(32)`, `OWNER-APPROVED`, requires custom `FixedBinaryField` if fixed `BINARY(32)` is retained) from `MediaAsset.sha256_checksum` (`VARBINARY(32)`, `TECHNICAL-RECOMMENDATION`, native `BinaryField(max_length=32)`), and preserves `GroupQrCode.token_hash` algorithm as `NEEDS-BUSINESS-CLARIFICATION` (any 32-byte storage strictly conditional on `SHA-256`).
4. **`302`-Field Count Verification (Correction 4):** Reconciles the exact unique field count in [`data-dictionary.md`](data-dictionary.md) (`302` unique fields) against the `103` string-inventory rows (`104` tokens when `DepartmentTrack.id / department_code` `L78` is split) and `201` numeric/temporal/binary evaluations, accounting for the **`3` overlapping fields** (`PendingApprovalRequest.id`, `MediaAsset.sha256_checksum`, `GroupQrCode.token_hash`): `104 + 201 − 3 = 302`.

The final recommendation remains **`PHYSICAL TYPES TECHNICAL REVIEW — COMPLETE WITH DEFERRED ITEMS`**, with Data Dictionary freeze and `WP-5.6` authorization kept strictly separate and unauthorized.

---

## 2. Original Findings Being Corrected

| Correction | Location in [`physical-types-review-closure-assessment.md`](physical-types-review-closure-assessment.md) | Issue Identified |
| :---: | :--- | :--- |
| **1** | §8 (*Cross-Report Consistency Assessment*) | Stated *"zero unaddressed contradictions remaining"*, which is overly broad given the `6` preserved unresolved items in §6. |
| **2** | §3 (Row `A. String Types`), §5 | Reported `103` `NVARCHAR` (`15` `OWNER-APPROVED` + `88` `TECHNICAL-RECOMMENDATION`) without distinguishing `PendingApprovalRequest.id` (`L81`) as an unresolved/conditional candidate. |
| **3** | §5 (Item `3. Binary Fields`) | Grouped `CertificateRecord.verification_token_hash` and `MediaAsset.sha256_checksum` under a shared `FixedBinaryField(32)` recommendation, blurring their distinct approval statuses and practical Django mappings. |
| **4** | §1 (Item `1`) | Cited `302` mapped fields without documenting the overlap between the `103`-row string inventory and `201`-evaluation numeric/temporal/binary review. |

---

## 3. Cross-Report Consistency Clarification (Correction 1)

- **Distinction:**
  - *Accidental inconsistencies introduced by earlier reports* (`PendingApprovalRequest.id` silent selection, `54`-entity PK counting ambiguity, `4` catalog FK mismatch visibility, `mssql-django 2.0.1` vs. `2.0.0`, and `Python 3.14` tested-vs-declared scope) **have been reconciled**.
  - *Explicitly documented unresolved technical or Owner decisions* (`6` items in Section 8) **remain open by design**.
- **Corrected Conclusion:** **"No accidental cross-report inconsistencies remain beyond the explicitly documented unresolved decisions."**

---

## 4. String Inventory Count Reconciliation (Correction 2)

Direct inspection of [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) (`§1–§3`) and [`data-dictionary.md`](data-dictionary.md) (`§2.8` `L156`) establishes:
1. **`PendingApprovalRequest.id` IS included in the `88` rows:** Line `81` of `physical-string-length-recommendations.md` lists `PendingApprovalRequest.id` as `NVARCHAR(64)` (`TECHNICAL-RECOMMENDATION`).
2. **Authoritative Data Dictionary Status:** `data-dictionary.md` (`§2.8` `L156`) defines `PendingApprovalRequest.id` as `` `UNIQUEIDENTIFIER` / `NVARCHAR(64)` `` with status **`PROPOSED`** (unresolved between UUID and opaque string).
3. **Reconciled String-Inventory Breakdown (`103` rows, no double-counting):**
   - **`15` `OWNER-APPROVED`** immutable string lengths (`§2` `L23–37`).
   - **`87` `TECHNICAL-RECOMMENDATION`** settled string-length candidates (`§3` excluding `L81`).
   - **`1` Conditional / Unresolved Candidate (`PROPOSED`):** `PendingApprovalRequest.id` (`L81`, `NVARCHAR(64)` applicable only if opaque string format is selected over `UNIQUEIDENTIFIER`).
   - **Total:** `15 + 87 + 1 = 103` rows.

---

## 5. Binary Storage Classification Correction (Correction 3)

| Field | SQL Server Type | Governance Classification | Practical Django ORM Mapping | Notes |
| :--- | :---: | :---: | :--- | :--- |
| **`CertificateRecord.verification_token_hash`** | **`BINARY(32)`** | **`OWNER-APPROVED`** (`CP-012` `TR-C3-03`) | Custom `models.BinaryField` subclass overriding `db_type()` → `'binary(32)'` | Preserved immutable; custom field needed if exact fixed-length `BINARY(32)` DDL is retained (`django-sqlserver-physical-type-mapping-review.md` §2.1). |
| **`MediaAsset.sha256_checksum`** | **`VARBINARY(32)`** | **`TECHNICAL-RECOMMENDATION`** | Native `models.BinaryField(max_length=32)` | Practical native `mssql-django` mapping (`32` bytes, index/`UNIQUE`-safe); do **not** require custom `FixedBinaryField` unless a documented technical requirement justifies it. |
| **`GroupQrCode.token_hash`** | **Conditional (`32`-byte if `SHA-256`)** | **`NEEDS-BUSINESS-CLARIFICATION`** (`PROPOSED` `NVARCHAR(128)` in `data-dictionary.md`) | Conditional on algorithm (`BinaryField(max_length=32)` if `SHA-256`) | Algorithm (`SHA-256` vs. `SHA-512` vs. alternative) remains unresolved in `domain-09`; do **not** assume `SHA-256`. |

---

## 6. `302`-Field Count Verification (Correction 4)

Direct verification against [`data-dictionary.md`](data-dictionary.md) (`54` active entities; `InPersonAttendanceRecord` `DEFERRED` excluded) confirms **`302` represents unique physical fields**, reconciled across the two review inventories as follows:

1. **String-Length Inventory ([`physical-string-length-recommendations.md`](physical-string-length-recommendations.md)):** `103` rows (`104` logical field tokens in `data-dictionary.md` because `DepartmentTrack.id / department_code` is 1 combined row at `L78`).
2. **Numeric / Temporal / Binary Inventory ([`physical-numeric-temporal-types-review.md`](physical-numeric-temporal-types-review.md)):** **`201` field evaluations** (`199` non-string/dual fields from `data-dictionary.md` + `2` `NVARCHAR` hash candidates).
3. **Overlapping Fields Evaluated in Both Inventories (`3` fields):**
   - `PendingApprovalRequest.id` (evaluated as `NVARCHAR(64)` in string report `L81` and `UNIQUEIDENTIFIER` in numeric/temporal report `L57`).
   - `MediaAsset.sha256_checksum` (evaluated as `NVARCHAR(64)` in string report `L116` and `32`-byte binary hash in numeric/temporal report `§7`).
   - `GroupQrCode.token_hash` (evaluated as `NVARCHAR(128)` in string report `L125` and conditional binary hash in numeric/temporal report `§7`).
4. **Exact Unique Field Reconciliation:**
   - `104` (string tokens) + `201` (numeric/temporal/binary evaluations) − `3` (overlapping fields) = **`302` unique mapped fields** (`100%` match with `data-dictionary.md`).

---

## 7. Deployment Platform Status

- **Status:** **`BLOCKED — UNRESOLVED`**.
- **Facts:** Production OS, OS version, and CPU architecture (`x64` vs. `ARM64`, Windows vs. Linux, glibc/musl) are not formally documented (`INV-DOM21-06` mentions an illustrative `Windows Server` path only).
- **Closure Impact:** This remains a deferred deployment-platform confirmation item for `WP-5.6` / infrastructure sign-off and **does not** represent a defect in the completed data-type review.

---

## 8. Preserved Six-Item Unresolved Register

| # | Item | Classification | Preserved Open Decision |
| :---: | :--- | :---: | :--- |
| **1** | `PendingApprovalRequest.id` | `PROPOSED` (Unresolved) | UUID (`UNIQUEIDENTIFIER`) vs. opaque prefixed string `apr-...` (`NVARCHAR(64)`). |
| **2** | `4` Catalog FK Mismatches (`User.metro_line_id`, `User.marital_status_id`, `User.military_service_status_id`, `CourseAudienceMetroLine.metro_line_id`) | `PROPOSED` / `TECHNICAL-RECOMMENDATION` | Alternative 1 (change `4` FKs to `INT`) vs. Alternative 2 (promote `3` catalog PKs to `BIGINT`). |
| **3** | `QuizDefinition.passing_score` | `UNRESOLVED-BUSINESS-RULE` | Integer percentage (`0–100`), fractional percentage (`DECIMAL(5,2)`), or raw point score. |
| **4** | `GroupQrCode.token_hash` Algorithm | `NEEDS-BUSINESS-CLARIFICATION` | Hash algorithm (`SHA-256` vs. `SHA-512` vs. alternative); `32`-byte storage conditional on `SHA-256`. |
| **5** | `DATETIME2(7)` vs. `DATETIMEOFFSET(7)` | `TECHNICAL-RECOMMENDATION` vs. `data-dictionary.md` | Reconcile `data-dictionary.md` `DATETIME2(7)` notation with `django-sqlserver-integration-contract.md` §4 (`DATETIMEOFFSET(7)` + `USE_TZ=True`). |
| **6** | Production Deployment OS, Version & CPU Architecture | `BLOCKED — UNRESOLVED` | Confirm target OS, version, and CPU architecture (`x64`/`ARM64`) for `mssql-django 2.0.0` (`mssql-python`) wheel compatibility. |

---

## 9. Final Physical Types Review Closure Recommendation

With Corrections 1–4 applied, the original recommendation remains valid:
- **Physical Types Technical Review Workstream:** **`COMPLETE WITH DEFERRED ITEMS`** (ready for technical review closure with the `6`-item unresolved register in Section 8).
- **Separate Decisions Kept Distinct:**
  - **Technical Review Closure:** Ready (`COMPLETE WITH DEFERRED ITEMS`).
  - **Data Dictionary Freeze:** **NOT AUTHORIZED (`UNFROZEN`)**.
  - **Owner Approval of Outstanding Decisions:** Pending (`6` items in Section 8).
  - **`WP-5.6` Authorization:** **`BLOCKED — NOT AUTHORIZED`**.

---

## 10. Governance and Authorization Status

- **New Report Created:** [`physical-types-review-closure-corrections.md`](physical-types-review-closure-corrections.md) (this file only).
- **Existing Files Modified:** **None (`0` modified).**
- **Data Dictionary:** `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- **WP-5.6:** `BLOCKED — NOT AUTHORIZED`.
- **Implementation Work:** None performed.

**`PHYSICAL TYPES REVIEW CLOSURE CORRECTIONS COMPLETED — WP-5.6 NOT AUTHORIZED.`**

