# MetroLMS — Physical Storage Recommendations Technical Review (`WP-5.6` Preparation)

> **Document Status:** `TECHNICAL-REVIEW — WP-5.6 PREPARATION INPUT ONLY (NON-AUTHORITATIVE)`  
> **Reviewed Baseline:** [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) & [`data-dictionary.md`](data-dictionary.md) (`OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`)  
> **Target Stack:** Python 3.12+ / Django 5+ / DRF / Microsoft SQL Server (`mssql-django` / `pyodbc` per `D-DB-01`)  
> **Governance Notice:** **No approved project file was modified.** `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`; `CP-009`–`CP-012`, `CURRENT.md`, and `active-roadmap.md` remain unchanged; `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

---

## 1. Executive Summary

This technical review evaluates four physical storage recommendations from [`physical-string-length-recommendations.md`](physical-string-length-recommendations.md) for Microsoft SQL Server (`D-DB-01`) and Django 5+:

- **`GroupQrCode.token_hash`:** **`RECOMMENDATION-REVISED`** — Recommend **`BINARY(32)`** (assuming `SHA-256` digest, aligning with `OWNER-APPROVED` `CertificateRecord.verification_token_hash BINARY(32)`) instead of `NVARCHAR(128)`, contingent on confirming `SHA-256` in `WP-5.6` security implementation (`domain-09` does not lock a hash algorithm).
- **`MediaAsset.sha256_checksum`:** **`RECOMMENDATION-REVISED`** — Recommend **`BINARY(32)`** instead of `NVARCHAR(64)`, reducing row and index-key storage by `75%` (`32` bytes vs. `128` UTF-16 bytes) and eliminating hex case/collation variance.
- **`ServerSession.session_data`:** **`CONFIRMED`** — **`NVARCHAR(MAX)`** matches Django's `django_session` `TextField` mapping under `mssql-django` (`D-AUTH-01`, `D-DB-01`).
- **`User.password_hash`:** **`CONFIRMED`** — **`NVARCHAR(255)`** provides >`2x` headroom for Django `PBKDF2`, `Argon2id`, and `BCrypt` hash formats (`~77–115` chars).

---

## 2. Individual Field Reviews

### A. `GroupQrCode.token_hash`
1. **Existing Recommendation & Classification:** `NVARCHAR(128)` (`TECHNICAL-RECOMMENDATION` in `physical-string-length-recommendations.md`; `PROPOSED` in `data-dictionary.md` `§8.3` `L486`).
2. **Technical Considerations:** `GroupQrCode.token_hash` is `UNIQUE`-indexed for QR join token lookup (`domain-09`, `TR-C3-01` Option B). Storing a fixed-width cryptographic digest as UTF-16 `NVARCHAR(128)` consumes up to `256` bytes (`128` bytes for 64-char hex `SHA-256`) and subjects `UNIQUE` comparisons to SQL Server string collation rules. Binary storage (`BINARY(32)` for `SHA-256`, or `BINARY(64)` if `SHA-512`) stores raw digest bytes (`32` bytes for `SHA-256`), avoids collation/case issues, and keeps the `UNIQUE` non-clustered index compact.
3. **Relevant MetroLMS Decisions & Contracts:** `TR-C3-01` (`CP-012` — single mutable record per `TrainingGroup`); `TR-C3-03` (`CP-012` — `OWNER-APPROVED` `CertificateRecord.verification_token_hash` uses `SHA-256` stored as `BINARY(32)` `UNIQUE`). `domain-09` does not specify the QR token hash algorithm.
4. **Compatibility & Migration Implications:** Django maps `BINARY(32)` via `models.BinaryField(max_length=32)` (or custom fixed-binary field) on `mssql-django`; application code hashes the raw QR token with `hashlib.sha256(...).digest()` before DB lookup/persistence.
5. **Recommended Physical Type & Length:** **`BINARY(32)`** (assuming `SHA-256` alignment with `CertificateRecord`; `BINARY(64)` only if `SHA-512` is explicitly chosen in `WP-5.6`).
6. **Classification:** **`RECOMMENDATION-REVISED`** *(remains `TECHNICAL-RECOMMENDATION` — does not alter `TR-C3-01` or `domain-09` security requirements without explicit authorization).*

### B. `MediaAsset.sha256_checksum`
1. **Existing Recommendation & Classification:** `NVARCHAR(64)` (`TECHNICAL-RECOMMENDATION` in `data-dictionary.md` `§5.8` `L390` and `physical-string-length-recommendations.md`).
2. **Technical Considerations:** Unlike `GroupQrCode.token_hash`, `MediaAsset.sha256_checksum` explicitly fixes the algorithm to `SHA-256` (`256` bits = `32` bytes).
   - `NVARCHAR(64)` uses `128` bytes of UTF-16 storage (+ `2`-byte prefix) per row and per index entry, and allows uppercase/lowercase hex ambiguity (`a-f` vs `A-F`) depending on collation.
   - `BINARY(32)` uses a fixed **`32` bytes** (`75%` smaller row footprint and `4x` smaller non-clustered index key), enforces exact 32-byte digest length at the column level, and eliminates hex casing normalization.
3. **Relevant MetroLMS Decisions & Contracts:** `INV-DOM21-05`, `INV-DOM21-06` (Storage Abstraction integrity/checksums & shared-binary deduplication); `INV-DOM21-16` (immutable asset-level technical metadata).
4. **Compatibility & Migration Implications:** Django `models.BinaryField(max_length=32)` stores `hashlib.sha256(...).digest()` (`bytes`); API/diagnostic serializers format `.hex()` when returning hex strings. If JSON/REST payloads expect hex strings, conversion occurs cleanly in the serializer/storage-abstraction layer.
5. **Recommended Physical Type & Length:** **`BINARY(32)`**.
6. **Classification:** **`RECOMMENDATION-REVISED`** *(remains `TECHNICAL-RECOMMENDATION`).*

### C. `ServerSession.session_data`
1. **Existing Recommendation & Classification:** `NVARCHAR(MAX)` (`TECHNICAL-RECOMMENDATION` in `data-dictionary.md` `§2.2` `L84` and `physical-string-length-recommendations.md`).
2. **Technical Considerations:** Django's `django.contrib.sessions.models.Session` defines `session_data = models.TextField()`. Under `mssql-django` / `pyodbc`, Django `TextField` maps natively to SQL Server `NVARCHAR(MAX)` (Unicode UTF-16, supporting large serialized session payloads and Arabic/Unicode values without arbitrary truncation). Out-of-row LOB storage in SQL Server avoids bloating the clustered index on `session_key` (`NVARCHAR(40)`) for payloads exceeding `8,000` bytes.
3. **Relevant MetroLMS Decisions & Contracts:** `D-AUTH-01` (`authentication-and-session-contract.md` `L89`), `D-DB-01` (`django-sqlserver-integration-contract.md` `§1` `L17`), and `S7` (`sessionEpoch` stored in server-side session).
4. **Compatibility & Migration Implications:** Zero custom migration overrides needed; matches Django's built-in `django_session` table schema on SQL Server.
5. **Recommended Physical Type & Length:** **`NVARCHAR(MAX)`**.
6. **Classification:** **`CONFIRMED`** *(remains `TECHNICAL-RECOMMENDATION`).*

### D. `User.password_hash`
1. **Existing Recommendation & Classification:** `NVARCHAR(255)` (`TECHNICAL-RECOMMENDATION` in `data-dictionary.md` `§2.1` `L62` and `physical-string-length-recommendations.md`).
2. **Technical Considerations:**
   - Django `PBKDF2PasswordHasher` (`pbkdf2_sha256$...`): `~88–100` ASCII characters.
   - Django `Argon2PasswordHasher` (`argon2$argon2id$v=19$m=102400,t=2,p=8$...`): `~95–115` ASCII characters.
   - Django `BCryptSHA256PasswordHasher`: `~77` ASCII characters.
   - `NVARCHAR(255)` provides >`2x` headroom over all intended hashers (even with future increased Argon2 parameters/salt lengths), avoids `NVARCHAR(MAX)` LOB overhead, and exceeds Django's default `AbstractBaseUser.password` (`max_length=128`) safely.
3. **Relevant MetroLMS Decisions & Contracts:** `D-AUTH-01`, `authentication-and-session-contract.md` (`L52`: `Argon2id/PBKDF2`), `system-architecture.md` (`L90`), and `active-roadmap.md` (`MFR-12` `L475`: `argon2id/bcrypt`).
4. **Compatibility & Migration Implications:** Custom `User` model (`AbstractBaseUser`) should explicitly set `password = models.CharField(max_length=255)` (mapping to `NVARCHAR(255)` in `mssql-django`) so `Argon2id`/`PBKDF2`/`BCrypt` hashes never hit length limits.
5. **Recommended Physical Type & Length:** **`NVARCHAR(255)`**.
6. **Classification:** **`CONFIRMED`** *(remains `TECHNICAL-RECOMMENDATION`).*

---

## 3. Before / After Recommendation Matrix

| Entity | Field | Current Recommendation | Reviewed Recommendation | Classification | Rationale |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `GroupQrCode` | `token_hash` | `NVARCHAR(128)` | `BINARY(32)` *(assuming `SHA-256`)* | `RECOMMENDATION-REVISED` | Matches `CertificateRecord.verification_token_hash BINARY(32)`; avoids UTF-16 bloat and collation issues on `UNIQUE` lookup; contingent on confirming `SHA-256` in `WP-5.6`. |
| `MediaAsset` | `sha256_checksum` | `NVARCHAR(64)` | `BINARY(32)` | `RECOMMENDATION-REVISED` | Fixed 256-bit digest (`32` bytes vs. `128` UTF-16 bytes); `75%` smaller storage/index key; eliminates hex case/collation variance. |
| `ServerSession` | `session_data` | `NVARCHAR(MAX)` | `NVARCHAR(MAX)` | `CONFIRMED` | Native `mssql-django` `TextField` mapping for Django `django_session` (`D-AUTH-01`, `D-DB-01`). |
| `User` | `password_hash` | `NVARCHAR(255)` | `NVARCHAR(255)` | `CONFIRMED` | >`2x` headroom for `Argon2id`, `PBKDF2`, and `BCrypt` (`~77–115` chars) without `NVARCHAR(MAX)` overhead. |

---

## 4. Evidence & Compatibility Findings
- **SQL Server Compatibility (`D-DB-01`):** All four reviewed types (`BINARY(32)`, `NVARCHAR(MAX)`, `NVARCHAR(255)`) are native Microsoft SQL Server types supported by `mssql-django` / `pyodbc` with zero PostgreSQL assumptions.
- **Django Binary vs. Hex Handling:** `GroupQrCode.token_hash` and `MediaAsset.sha256_checksum` as `BINARY(32)` require `bytes` <-> `hex` conversion only at the service/serializer boundary, matching `CertificateRecord.verification_token_hash`.

---

## 5. Potential Impact on Existing Decisions
- **Zero Impact on Approved Decisions:** `CertificateRecord.verification_token_hash BINARY(32)` (`TR-C3-03`), `TR-C3-01` (Option B), `INV-DOM21-05`/`06`/`16`, `D-AUTH-01`, `D-DB-01`, and all **15 previously `OWNER-APPROVED` string lengths** remain untouched.

---

## 6. Unresolved Questions
- **`GroupQrCode.token_hash` Algorithm Confirmation:** `domain-09` does not explicitly specify `SHA-256` vs. `SHA-512` for QR token hashing. Confirming `SHA-256` (consistent with `CertificateRecord`) in `WP-5.6` security specifications validates `BINARY(32)`.

---

## 7. Explicit Governance Statement
- **No approved project file was modified.** `data-dictionary.md`, `CP-009`, `CP-010`, `CP-011`, `CP-012`, `CURRENT.md`, `active-roadmap.md`, and `physical-string-length-recommendations.md` were not altered.
- `data-dictionary.md` remains `OWNER-APPROVED — CONTENT ACCEPTED — UNFROZEN`.
- `WP-5.6` remains `BLOCKED — NOT AUTHORIZED`.

