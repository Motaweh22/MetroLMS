# Future Backend Contract: Secure Developer Account Bootstrap & Provisioning (`MFR-45`)

> **Document Status:** `INFORMATIONAL ARCHITECTURAL CONTRACT — PHASE 12 SCOPE`  
> **Authoritative Baseline:** MetroLMS Pre-Backend Migration Remediation Roadmap (Revision 5), §3.2, §3.3; Finding `MFR-45`  
> **Phase Association:** Phase 12 (Backend Architecture & Database Migration Track)  
> **Execution Constraint:** This document establishes the authoritative contract for future server-side implementation. **Zero backend implementation, database migrations, or CLI tooling are authorized or executed during Phase 2.**

---

## 1. Executive Summary & Problem Context

In the legacy prototype and earlier system revisions, administrative credentials and developer accounts were seeded via static mock files (`data/users.json` and client fixture objects). Under Master Finding `MFR-45`, this model is completely replaced by a strict separation of concerns:

1. **Frontend Prototype (Phase 2):** Pure compile-time fixture isolation. Synthetic Developer and Super Admin personas exist strictly in local development (`import.meta.env.DEV === true`) and are eliminated from production bundles via dead-code elimination.
2. **Production Backend (Phase 12):** The singleton Developer account is provisioned exclusively through an out-of-band, idempotent server CLI command reading server-only environment variables. No client-facing registration or API endpoint can ever create or promote a user into the `developer` role.

---

## 2. Server-Side Bootstrap Command Specification

### 2.1 Command Signature
The bootstrap command will be executed in production and staging environments as part of initial server provisioning or deployment pipelines:

```bash
pnpm db:bootstrap-developer
```

### 2.2 Server-Side Environment Variables
The command reads strictly from protected server-side environment variables. These variables must never be prefixed with `VITE_` and must never be exposed to browser clients or included in client build artifacts:

| Variable Name | Required | Type / Format | Purpose |
| :--- | :---: | :--- | :--- |
| `DEVELOPER_BOOTSTRAP_EMAIL` | **Yes** | Valid RFC 5322 Email | Authoritative email address for the singleton developer account. |
| `DEVELOPER_BOOTSTRAP_PASSWORD_HASH` | **Yes** | Argon2id PHC string (`$argon2id$v=19$m=65536,t=3,p=4$...`) | Secure, precomputed password hash. **Never plaintext.** |
| `DEVELOPER_BOOTSTRAP_NAME` | No | String (Default: `'مطور النظام'`) | Display name for the developer persona in internal logs. |

### 2.3 Precomputed Hash Constraint
- The CLI command **never accepts plaintext passwords**.
- System operators generate the precomputed Argon2id hash out-of-band prior to injection into the server environment:
  ```bash
  # Operator pre-hash generation example (out-of-band):
  argon2-cli -id -t 3 -m 16 -p 4
  ```
- This guarantees that plaintext credentials never touch shell command histories, CI/CD runner logs, or server process tables.

---

## 3. Database Invariant: Singleton Developer Constraint

To guarantee that at most one Developer account can exist in the production database, Phase 12 migrations must enforce a **partial unique index** directly at the PostgreSQL schema layer:

```sql
-- Authoritative Phase 12 Schema Migration
-- Migration: 20261101_000001_create_singleton_developer_index.sql

CREATE UNIQUE INDEX idx_singleton_developer
ON users ((role))
WHERE role = 'developer';
```

### 3.1 Invariant Guarantees
- **Unconditional Exclusivity:** Even if application-level validation were bypassed or concurrent race conditions occurred, PostgreSQL rejects any second record where `role = 'developer'`.
- **Zero Performance Impact:** The index is partial, indexing only the single developer row rather than the entire `users` table.

---

## 4. First-Login Security Protocol

Upon initial authentication of the newly provisioned Developer account, the backend authentication service must enforce mandatory first-login hardening:

```
┌─────────────────────────┐
│ Bootstrap Developer     │
│ Account Created         │
│ (mustChangePassword: true│
│  mfaEnrolled: false)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Initial Login with      │
│ Bootstrap Password      │
└───────────┬─────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Temporary Restricted Session Issued                    │
│ Allowed Endpoints: /api/auth/rotate-password, /api/mfa │
│ Denied Endpoints: All business APIs, courses, users    │
└───────────┬────────────────────────────────────────────┘
            │
            ├──► 1. Mandatory Password Rotation (New Argon2id hash stored)
            │
            └──► 2. Mandatory MFA Enrollment (TOTP / Hardware WebAuthn key)
            │
            ▼
┌────────────────────────────────────────────────────────┐
│ Full Developer Sovereign Session Unlocked              │
└────────────────────────────────────────────────────────┘
```

1. **Mandatory Password Rotation:** The bootstrap password is valid only for initial setup. The session remains in a restricted onboarding state until a new password is set.
2. **Mandatory MFA Enrollment:** TOTP (RFC 6238) or FIDO2/WebAuthn enrollment is mandatory. Unauthenticated or non-MFA sessions cannot access administrative or developer-scoped routes.

---

## 5. Idempotency & State Reconciliation Matrix

Repeated execution of `pnpm db:bootstrap-developer` must be fully idempotent and fail-safe. The CLI command must evaluate the database state against the following matrix:

| Database State | CLI Evaluation | Action Taken | Exit Code | Audit Log Emitted |
| :--- | :--- | :--- | :---: | :--- |
| **Clean Slate** (Zero developer accounts exist) | Normal Provisioning | Creates Developer user record with `role = 'developer'`. Flags `mustChangePassword = true`. | `0` | `SECURITY_AUDIT: DEVELOPER_BOOTSTRAPPED` |
| **Matching Provisioned State** (Exactly one developer exists with matching email) | Already Provisioned | **No-op.** Outputs notice that Developer account already exists. Does **not** reset password, rotate hash, or modify metadata. | `0` | `SECURITY_AUDIT: DEVELOPER_BOOTSTRAP_IDEMPOTENT_NOOP` |
| **Conflicting Account** (Existing user has bootstrap email with non-developer role, OR existing developer has different email) | Configuration Conflict | **Aborts transaction.** Refuses to overwrite or reassign existing accounts. Outputs structured error report to stderr. | `1` | `SECURITY_AUDIT: DEVELOPER_BOOTSTRAP_CONFLICT_ABORT` |
| **Missing Environment** (`DEVELOPER_BOOTSTRAP_EMAIL` or `PASSWORD_HASH` missing/empty) | Validation Failure | **Aborts.** Outputs parameter requirement instructions to stderr. | `1` | None |
| **Corrupted State** (Multiple developer records exist due to legacy data corruption) | Critical Integrity Breach | **Aborts immediately.** Refuses to proceed. Emits critical alert requiring manual DBA remediation. | `2` | `SECURITY_AUDIT: DATABASE_CORRUPT_MULTIPLE_DEVELOPERS` |

### 5.1 Credential & Log Sanitization Rule
- The CLI command must **never** write `DEVELOPER_BOOTSTRAP_PASSWORD_HASH` or raw token values to stdout, stderr, or system logs.
- Audit logs record only the actor type (`CLI_SYSTEM`), timestamp, target email, and outcome status.

---

## 6. Scope Boundary Separation (Phase 2 vs. Phase 12)

| Subsystem / Capability | Phase 2 (Frontend Prototype — Current) | Phase 12 (Backend Implementation Track — Future) |
| :--- | :--- | :--- |
| **Developer Identity** | Synthetic fixture persona (`USR_DEV_001`). Gated behind `import.meta.env.DEV === true`. | Persistent PostgreSQL record in `users` table. |
| **Production Bundle Cleanliness** | Rollup dead-code elimination purges Developer strings from `frontend/dist`. Verified via `scripts/verify-production-cleanliness.mjs`. | N/A (Server distribution). |
| **Provisioning Channel** | Simulated in memory during development server initialization. | Server CLI command `pnpm db:bootstrap-developer`. |
| **Database Schema** | In-memory store (`inMemoryStore.ts`). | PostgreSQL tables, DDL migrations, and partial unique index `idx_singleton_developer`. |
| **Password Hashing** | Simulated mock credentials (`mockUserCredentials`). | Server-side Argon2id algorithm. |
| **MFA Protocol** | Simulated session state. | RFC 6238 TOTP / WebAuthn server verification. |
| **Registration Restriction** | MSW handler `POST /api/admin/users` rejects `role: 'developer'` with HTTP 403. UI role pickers exclude developer. | Server API router rejects developer role assignment; database schema enforces singleton index. |

---

## 7. Approval & Sign-Off

- **Contract Status:** Approved for Phase 12 reference.
- **Phase 2 Implementation Guardrail:** No code from this contract is implemented in Phase 2.

