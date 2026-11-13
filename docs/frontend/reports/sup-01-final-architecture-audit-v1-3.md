# MetroLMS — SUP-01 Final Architecture Audit (Version 1.3)
## Final Correctness & Security Closure: Snapshot Identity, Atomic Archiving, and Concurrency Governance

**Document Version:** 1.3 (Final Architecture Audit & Correctness Closure)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-final-architecture-audit-v1-3.md`  
**Classification:** Architectural Remediation & Test Coverage Plan (Planning Only — Zero Implementation)  
**Target Transition:** `SUP-01: S8 → S7` (Real-User Logout with Preserved Inert Developer Origin Snapshot)  
**Governing Owner Decisions:** Decision A (Approved 2026-11-06), Decision B (Approved 2026-11-06), Decision C (Approved 2026-11-06)  
**Execution Directives:** Strict Read-Only Planning Governance Preserved (Zero production code modifications, zero test changes, zero Git staging/commits, zero test runner or compiler execution)  
**Proposed Remediation Package:** `WP-5.4.5-R1` (Separately Authorized Remediation Package executed prior to Phase 13)  
**Remediation Plan Status:** `READY FOR OWNER AUTHORIZATION — ALL DESIGN-LEVEL CORRECTNESS AND SECURITY BLOCKERS RESOLVED`

---

## 1. Executive Summary & Authoritative Owner Decisions

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 final closure audit and rendered three binding executive decisions:
- **Decision A (S0):** Only `S0 → S1` is permitted; `S0 → S3`, `S0 → S14`, `S0 → S15` are strictly forbidden. Guest/unauthenticated sessions cannot initiate isolated testing or execute Developer return.
- **Decision B (S8):** `S8 → S14` and `S8 → S15` are strictly forbidden; a real platform user must never consume, activate, or elevate permissions using an old Developer origin snapshot.
- **Decision C (Real-User Logout — SUP-01):** When a real user is authenticated in state `S8` and explicitly logs out:
  1. Clear the real user's active session (`user = null`, active storage session = `null`).
  2. Preserve the existing Developer origin snapshot in the current tab's `sessionStorage`, unchanged and inert, until tab termination.
  3. The preserved snapshot must not authorize, restore, or elevate any session.
  4. Do not recreate an emergency continuity proof (`emergencyProof = null`).
  5. Do not expose normal or emergency Developer return controls (banners remain hidden).
  6. Require fresh Developer authentication (`USR_DEV_001`).
  7. A subsequent Developer login must not silently reactivate or consume the preserved old snapshot.

The existing isolated-persona logout behavior remains unchanged: an explicit logout from an active isolated persona (`S3 -> S12 -> S0`) continues to perform its approved two-slot cleanup.

---

## 2. Mandatory Seven-Account Inventory

All persona allowances, identity boundaries, and tests operate strictly across the mandatory seven-account inventory:

| Account Name | Canonical ID | Canonical Username | System Role | Category | Selectable in Switcher? |
|---|---|---|---|---|:---:|
| **Developer** | `USR_DEV_001` | `developer_internal` | `developer` | Privileged System Actor | No (Launch Origin Only) |
| **Super Admin** | `USR_SUPER_001` | `super_admin_demo` | `super_admin` | Privileged Real Platform Account | **No (Protected Real Account)** |
| **Test Super Admin** | `USR_TEST_SUPER_001` | `test_super_admin` | `super_admin` | Synthetic Test Persona | **Yes (Allowlisted)** |
| **Test Admin** | `USR_TEST_ADMIN_001` | `test_admin` | `admin` | Synthetic Test Persona | **Yes (Allowlisted)** |
| **Test Assistant Admin** | `USR_TEST_AST_001` | `test_assistant_admin` | `assistant_admin` | Synthetic Test Persona | **Yes (Allowlisted)** |
| **Test Lecturer** | `USR_TEST_LEC_001` | `test_lecturer` | `lecturer` | Synthetic Test Persona | **Yes (Allowlisted)** |
| **Test Trainee** | `USR_TEST_TRN_001` | `test_trainee` | `user` | Synthetic Test Persona | **Yes (Allowlisted)** |

### Strict Inventory Rules:
1. **Exactly five synthetic test personas exist** (`USR_TEST_SUPER_001`, `USR_TEST_ADMIN_001`, `USR_TEST_AST_001`, `USR_TEST_LEC_001`, `USR_TEST_TRN_001`).
2. **Developer (`USR_DEV_001`) and Super Admin (`USR_SUPER_001`) are privileged fixtures**, not synthetic test personas. They are never selectable in the isolated persona switcher.
3. **`assistant_lecturer` is strictly a group-scoped teaching assignment preview layout mode** in `RolePreviewContext`. It is **never** a global system role or synthetic test persona.
4. **Zero secrets policy:** Under no circumstances are passwords, hashes, tokens, or credentials displayed in documentation or inventories.
5. **Developer production provisioning:** Real-world provisioning of `developer` credentials remains a future server-only bootstrap responsibility governed by strict deployment authorization.

---

## 3. Exact Source Evidence and Line References

Targeted read-only source inspection confirms the exact current implementations, line ranges, and behavioral boundaries:

### 1. `frontend/src/core/auth/AuthContext.tsx`
- **Lines 558–582 (`logout`):**
  - Line 559: `const opId = ++authOpSeqRef.current;` establishes the unique operation sequence ID.
  - Line 562: `advanceSessionEpoch();` increments monotonic `sessionEpoch` immediately upon initiating logout, invalidating all pending in-flight requests before awaiting the network call.
  - Lines 564–566: `await authApi.logout().catch(() => {});` dispatches server logout.
  - Line 569: Operation guard `if (opId === authOpSeqRef.current)` discards state updates if superseded by newer authentication operations.
  - **Lines 572–573 (Current Defect):**
    ```typescript
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    ```
    This unconditionally wipes the active Developer origin snapshot even when the logging-out user is a real user in state `S8`, directly violating Owner Decision C.
  - Lines 574–580: React state cleanup (`setUser(null)`, `setIsIsolatedSession(false)`, `setIsolatedPersona(null)`, `setEmergencyProof(null)`, `setError(null)`, `setIsLoading(false)`).
- **Lines 512–556 (`login`):**
  - Line 513: Increments `authOpSeqRef.current`.
  - Line 532: Calls `advanceSessionEpoch()`.
  - Line 533: Persists user session via `authStorage.setSession(session)`.
  - Line 534: Updates active user via `setUser(response.user)`.
  - Lines 538–542: Clears isolated session state and invalidates any emergency proof/digest:
    ```typescript
    setIsIsolatedSession(false);
    setIsolatedPersona(null);
    setEmergencyProof(null);
    setVerifiedSnapshotDigest(null);
    setVerifiedSnapshotRevision(null);
    ```
- **Lines 610–680 (`launchIsolatedPersona`):**
  - Lines 616–620: Validates actor is Canonical Developer (`user.id === 'USR_DEV_001'` and `user.role === 'developer'`).
  - Lines 649–651: Anti-nesting guard prevents launching if an active Developer origin snapshot already exists:
    ```typescript
    if (authStorage.hasDeveloperOriginSession() || isIsolatedSession) {
      throw new Error('لا يمكن بدء جلسة اختبار متداخلة؛ توجد جلسة اختبار معزولة نشطة بالفعل.');
    }
    ```
  - Lines 654–661: Prepares `DeveloperOriginSession` snapshot.
  - Line 663: Calls `authStorage.saveDeveloperOriginSession(originSnapshot)`.
  - Lines 669–680: Read-back verification; if verification fails, calls `clearDeveloperOriginSession()`.
- **Lines 783–835 (`returnToDeveloperSession`):**
  - Lines 786–789: Reads `authStorage.getDeveloperOriginSession()`. Fails closed if `null`.
  - Lines 810–820: Validates `isIsolatedSession === true` and `isolatedPersona.id === origin.personaId`.
  - Lines 824–830: Validates active authenticated user matches target persona (`user.id === origin.personaId`). Real users in S8 cannot satisfy this check.
- **Lines 970–1150 (`returnFromExpiredPersonaSession`):**
  - Lines 975–977: Requires non-null memory-only `emergencyProof`.
  - Lines 981–986: Requires `user === null` (no active authenticated identity).
  - Lines 1050–1065: Reads active `authStorage.getDeveloperOriginSession()`.
  - Lines 1103–1109: Computes SHA-256 digest of active snapshot and matches against `emergencyProof.originSnapshotFingerprint`.
  - Lines 1119–1132: Validates `liveStorageRevision === initialStorageRevision` and `opId === authOpSeqRef.current`.
- **Lines 221–435 (`revalidateSession`):**
  - Lines 230–250: Reads active snapshot from `metro_lms_developer_origin_session`.
  - Lines 313–323: Case D (Missing Active Session / State S7): sets `user = null`, `isIsolatedSession = false`, `setEmergencyProof(null)`.
  - Lines 419–423: Case 7 (Real-User Identity Mismatch / State S8): sets `isIsolatedSession = false`, `setEmergencyProof(null)`.

### 2. `frontend/src/core/auth/authStorage.ts`
- **Lines 124–143:** `AuthStorageInstance` interface defines session and origin methods.
- **Lines 152–157:** Factory state: `originSnapshotVersion = 0`, `originChangeListeners = new Set<() => void>()`.
- **Lines 175–184 (`notifyDeveloperOriginChanged`):** Increments `originSnapshotVersion++` and dispatches to registered listeners.
- **Lines 240–262 (`getDeveloperOriginSession`):** Reads exclusively from `DEVELOPER_ORIGIN_STORAGE_KEY` (`'metro_lms_developer_origin_session'`). Critically, `storage.getItem` followed by `JSON.parse` produces a **new object reference** on every call.
- **Lines 264–275 (`clearDeveloperOriginSession`):** Removes `DEVELOPER_ORIGIN_STORAGE_KEY` and calls `notifyDeveloperOriginChanged()`.
- **Lines 281–334 (`saveDeveloperOriginSession`):** Validates snapshot, enforces anti-overwriting guard (`hasDeveloperOriginSession()`), performs immediate read-back verification, and calls `notifyDeveloperOriginChanged()`.

### 3. `frontend/src/core/auth/sessionEpoch.ts`
- **Lines 23–30 & 38–87:** Monotonic session transition epoch counter (`sessionEpoch`). Advances on login, logout, persona launch, normal return, and emergency return. In-memory only; never resets or decrements during active lifecycle.

### 4. `frontend/src/features/auth/components/IsolatedSessionBanner.tsx`
- **Lines 54–106:** Emergency banner renders ONLY when `user === null && isEmergencyState === true`.
- **Lines 108–115:** Normal isolated-session banner renders ONLY when 5 strict criteria are met (including `user !== null`, `isIsolatedSession === true`, valid persona token, unexpired origin snapshot).

### 5. `frontend/src/test/isolated-role-session.test.tsx`
- **Lines 4752–4826 (`P5-T18-6`):** Tests static S8 state with real user `USR_SUPER_001` and active origin snapshot, asserting banner suppression and identity preservation. Does NOT invoke `logout()`.
- **Lines 5620–5643:** End of test suite (60th written specification).

---

## 4. Resolution of the Snapshot Identity Comparison Defect

### The Defect in Version 1.2
Version 1.2 proposed validating that the active origin snapshot had not changed before clearing it via:
```typescript
authStorage.getDeveloperOriginSession() === origin
```
**Why this is fatally defective:**
In `authStorage.ts` (lines 248–258):
```typescript
const raw = storage.getItem(DEVELOPER_ORIGIN_STORAGE_KEY);
if (!raw) return null;
const origin = JSON.parse(raw);
return origin;
```
When backed by `sessionStorage`, `getDeveloperOriginSession()` parses the raw JSON string and creates a **brand-new JavaScript object reference** on each invocation.
Therefore, `authStorage.getDeveloperOriginSession() === origin` tests **referential equality** (`Object.is`), which will **always evaluate to `false`**, even when the stored data is 100% identical!
If deployed, this check would cause the transaction to believe the snapshot was mutated on every attempt, aborting the active-slot deletion 100% of the time.

### The Correct Structural Identity Design
To guarantee that the active snapshot being cleared is exactly the snapshot that was archived, the verification must rely on **deep structural equality** and a **canonical fingerprint algorithm**.

#### 1. Structural Equality Predicate
```typescript
export function areDeveloperOriginSessionsEqual(
  a: DeveloperOriginSession | null | undefined,
  b: DeveloperOriginSession | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.schemaVersion === b.schemaVersion &&
    a.savedAt === b.savedAt &&
    a.personaId === b.personaId &&
    a.developerToken === b.developerToken &&
    a.developerExpiresAt === b.developerExpiresAt &&
    a.developerUser?.id === b.developerUser?.id &&
    a.developerUser?.role === b.developerUser?.role
  );
}
```

#### 2. Canonical Snapshot Fingerprint Algorithm
To provide a fast, deterministic identifier for archiving, indexing, and logging without relying on object identity, a canonical serialization format is specified:
```typescript
export function computeCanonicalSnapshotFingerprint(origin: DeveloperOriginSession): string {
  // Deterministic, order-independent property serialization
  return [
    origin.schemaVersion,
    origin.savedAt,
    origin.developerUser.id,
    origin.developerUser.role,
    origin.personaId,
    origin.developerExpiresAt,
    origin.developerToken,
  ].join('|');
}
```

#### 3. Verification Across Archive Write, Read-Back, and Deletion
The transaction enforces a three-stage structural check:
1. **Pre-Write Capture:** Capture `initialFingerprint = computeCanonicalSnapshotFingerprint(activeOrigin)`.
2. **Post-Write Read-Back:** Read back `archive[archiveId].snapshot`. Confirm:
   `areDeveloperOriginSessionsEqual(readBackSnapshot, activeOrigin) === true` AND  
   `computeCanonicalSnapshotFingerprint(readBackSnapshot) === initialFingerprint`.
3. **Pre-Clear Active Slot Re-check:** Read active slot immediately before clearing: `currentActive = authStorage.getDeveloperOriginSession()`. Confirm:
   `areDeveloperOriginSessionsEqual(currentActive, activeOrigin) === true` AND  
   `computeCanonicalSnapshotFingerprint(currentActive) === initialFingerprint`.
4. **Failure Behavior:** If `currentActive` does not match `activeOrigin` structurally, the active slot has been mutated or replaced by another operation. The transaction **ABORTS DELETION IMMEDIATELY**. The active slot is **LEFT COMPLETELY INTACT**.

---

## 5. Atomic Transaction and Concurrency Sequence

### Architectural Separation: Synchronous Storage vs Asynchronous Context

```mermaid
sequenceDiagram
    autonumber
    participant UI as User / UI Component
    participant Ctx as AuthContext (Asynchronous)
    participant Api as authApi.logout() (Network)
    participant Store as authStorage (Synchronous)
    participant Sess as sessionStorage

    UI->>Ctx: logout() initiated from State S8
    Note over Ctx: opId = ++authOpSeqRef.current<br/>advanceSessionEpoch() [E -> E+1]
    Ctx->>Api: await authApi.logout()
    Api-->>Ctx: network response (or timeout/catch)
    Note over Ctx: Fence Check: opId === authOpSeqRef.current?
    alt Superseded by newer login (opId mismatch)
        Ctx-->>UI: Discard logout; commit ZERO changes
    else Operation is current
        Ctx->>Store: archiveDeveloperOriginSession(activeOrigin)
        activate Store
        Note over Store: Synchronous Execution (Single JS Tick)
        Store->>Sess: 1. Read active slot & structural check
        Store->>Sess: 2. Read archive map & check idempotency
        Store->>Sess: 3. Write updated archive map
        Store->>Sess: 4. Read-back verify archive entry
        Store->>Sess: 5. Re-check active slot structural equality
        Store->>Sess: 6. removeItem('metro_lms_developer_origin_session')
        Store->>Store: 7. originSnapshotVersion++ & notify listeners
        Store-->>Ctx: return true (success)
        deactivate Store
        Ctx->>Store: clearSession()
        Note over Ctx: Reset React state:<br/>user=null, emergencyProof=null, digest=null
        Ctx-->>UI: State S7 established cleanly
    end
```

### Detailed Concurrency Scenarios

1. **Real-User Logout Awaiting `authApi.logout()`:**
   - Monotonic `sessionEpoch` is incremented synchronously at line 562 **before** the network call begins.
   - Any in-flight protected requests dispatched under the real-user session become stale immediately (`isStaleEpoch` returns `true`).
2. **Newer Login Beginning While Old Logout is Awaiting API:**
   - A subsequent `login()` increments `authOpSeqRef.current` (`opId_login > opId_logout`).
   - When the old `logout()` finishes its network await, the fence `if (opId !== authOpSeqRef.current)` evaluates to `false`.
   - **Guaranteed Invariant:** The older logout immediately aborts and commits **ZERO** changes to storage or React state. It does not archive, does not clear active origin, and does not wipe the newer session.
3. **Active Snapshot Mutation Between Initial Read and Final Deletion:**
   - Inside the synchronous `archiveDeveloperOriginSession` method, `currentActive` is re-read from storage right before `removeItem`.
   - If any external event or tab modified the active slot, `areDeveloperOriginSessionsEqual(currentActive, expectedOrigin)` evaluates to `false`.
   - Deletion is aborted; the newer snapshot is preserved.
4. **Retry After Partial Transaction Completion (Idempotency):**
   - Suppose an earlier attempt successfully wrote Snapshot A to the archive, but the browser tab crashed or power was cut before the active slot was cleared.
   - On retry:
     1. Active slot still holds Snapshot A.
     2. Step 2 reads the archive map and finds `archive[arch_A]` already present.
     3. Idempotency check confirms `areDeveloperOriginSessionsEqual(archive[arch_A].snapshot, Snapshot A) === true`.
     4. The transaction recognizes the archive entry is already complete and verified!
     5. It safely proceeds to clear the active slot, increment revision, and notify listeners.
     6. **Result:** Self-healing idempotency with zero duplicate entries and zero data loss.

---

## 6. Failure-Mode Matrix

The matrix below specifies the exact detection mechanism, behavior, and storage state for every potential transaction failure:

| Failure Mode | Detection Mechanism | Action Taken | Active Snapshot Intact? | Active User Session State | Concurrency / Data Integrity Guarantee |
|---|---|---|:---:|:---:|---|
| **Real-user logout awaiting `authApi.logout()`** | Synchronous `advanceSessionEpoch()` before API dispatch. | Invalidate in-flight requests immediately. | **YES** | Awaiting network response. | All background requests under old identity rejected via `isStaleEpoch`. |
| **Newer login supersedes awaiting logout** | `opId !== authOpSeqRef.current` in `logout()` post-await fence. | Discard logout transaction; commit zero changes. | **YES** | Newer authenticated user preserved. | Older logout cannot overwrite or clear newer user session or newer snapshot. |
| **Archive write fails (`QuotaExceededError`)** | `sessionStorage.setItem` throws `DOMException`. | Catch block logs error; abort archive transaction; skip clearing active slot. | **YES** | Cleared (`authStorage.clearSession()`). | Active Developer snapshot is NEVER destroyed when archive storage is full. |
| **Read-back verification fails** | Read-back JSON is null, unparsable, or snapshot fields mismatch. | Throw `Error('Archive verification failed')`; catch block skips active-slot clear. | **YES** | Cleared. | Active snapshot is preserved in place until archive integrity can be guaranteed. |
| **Corrupted archive JSON in storage** | `JSON.parse(storage.getItem('metro_lms_inert_developer_snapshots'))` throws SyntaxError. | Isolate unparsable raw string to recovery key; abort active clear without destroying existing data. | **YES** | Cleared. | Zero silent destruction of unparsable historical storage; active snapshot safe. |
| **Active snapshot structural mismatch before deletion** | `areDeveloperOriginSessionsEqual(currentActive, expectedOrigin) === false`. | Abort deletion of active slot immediately; log warning. | **YES** (Newer snapshot) | Cleared. | A newer or modified Developer origin snapshot is never accidentally deleted. |
| **Duplicate archive ID (Same persona, timestamp, & token)** | `archive[archiveId]` exists and snapshot structurally equals active snapshot. | Idempotency branch: verify existing archive entry; proceed safely to clear active slot. | Cleared (safely archived) | Cleared. | Idempotent self-healing; no duplicate entries created. |
| **Archive collision (Same ID, differing snapshot)** | `archive[archiveId]` exists but structural equality returns `false`. | Append monotonic discriminator `_seqN` or `_${performance.now()}`; write unique key. | Cleared (safely archived) | Cleared. | Both distinct snapshots preserved in archive without overwriting. |
| **Retry after partial transaction completion** | Active slot present, matching archive entry already present. | Recognize verified archive; complete active slot clear and revision bump. | Cleared (safely archived) | Cleared. | Self-healing recovery from crash/interruption. |

> [!CRITICAL]
> **Core Safety Invariant:** Under NO failure condition is the active Developer origin snapshot deleted from storage unless an exact structural copy has been successfully written to and verified from the inert archive.

---

## 7. Historical Credential and Archive API Security Analysis

### Retention of `developerToken` Under Owner Decision C
Owner Decision C explicitly requires:
*"Preserve the existing Developer origin snapshot in the current tab's sessionStorage, unchanged and inert, until tab termination."*

- **Why `developerToken` is retained:**
  The canonical snapshot contract is `DeveloperOriginSession`. Redacting, stripping, or nullifying `developerToken` would produce a mutated, incomplete object that is no longer "unchanged." Preserving the complete snapshot ensures forensic traceability and diagnostic integrity throughout the lifecycle of that browser tab.
- **Why retaining `developerToken` presents ZERO authorization or elevation risk:**
  1. **Strictly Excluded from Active Session:** `authStorage.getSession()` reads exclusively from `SESSION_STORAGE_KEY` (`'metro_lms_auth_session'`). It never touches the archive key.
  2. **Strictly Excluded from Rehydration:** `AuthContext.revalidateSession()` checks only active storage session and active Developer origin (`DEVELOPER_ORIGIN_STORAGE_KEY`). The archive key is ignored during application mount and `/api/auth/me` revalidation.
  3. **Strictly Excluded from HTTP Headers:** `apiClient.ts` acquires authentication tokens exclusively via `authStorage.getSession()?.token`. Archived tokens are never attached to HTTP requests.
  4. **Strictly Excluded from Normal Return:** `returnToDeveloperSession()` queries `authStorage.getDeveloperOriginSession()`. In State S7, active origin is `null`. The return handler fails closed with `'لم يتم العثور على لقطة جلسة المطور الأصلية للرجوع إليها.'`.
  5. **Strictly Excluded from Emergency Return:** `returnFromExpiredPersonaSession()` requires both an unconsumed `emergencyProof` in React memory and a valid snapshot in `authStorage.getDeveloperOriginSession()`. Both are `null` in State S7.
  6. **Strictly Excluded from Digest & Proof Generation:** Digest calculation occurs only within `revalidateSession` when an active persona session has expired. An inert archive entry cannot trigger digest calculation or proof generation.

### Minimal Public API Surface & Rejection of `clearInertDeveloperSnapshots()`
In Version 1.2, a method named `clearInertDeveloperSnapshots()` was proposed.  
**Security Evaluation:**
- Exposing a public `clearInertDeveloperSnapshots()` method creates an architectural hazard: any component or utility could invoke it and prematurely purge archived snapshots, violating the mandate that snapshots remain preserved until tab termination.
- **Resolution:**
  - `clearInertDeveloperSnapshots()` is **STRICTLY REJECTED** and removed from the public `AuthStorageInstance` interface.
  - Deletion of the archive is delegated **exclusively to native browser tab termination**.
  - (A harness-only method `__resetInertDeveloperSnapshotsForTesting()` may exist in test utilities, but is never exposed to production code).
  - The ONLY new public methods on `AuthStorageInstance` are:
    1. `archiveDeveloperOriginSession(expectedOrigin: DeveloperOriginSession): boolean` (Internal to AuthContext logout).
    2. `getInertDeveloperSnapshots(): InertDeveloperSnapshotArchive` (Read-only accessor for diagnostic/audit inspection).

---

## 8. Clarification of Browser Lifecycle, Tab Termination, and Session Restoration

To prevent architectural assumptions that exceed browser platform capabilities, the browser lifecycle events are explicitly categorized:

1. **Ordinary Tab Closure:**
   When the user closes the browser tab or window, the browser engine terminates the browsing context and permanently destroys its `sessionStorage`. This provides the natural and complete cleanup required by Decision C.
2. **Page Refresh / Reload (F5 / Ctrl+R):**
   The browsing context is preserved, and `sessionStorage` survives. On reload, `revalidateSession()` reads active storage keys:
   - `metro_lms_auth_session` is `null`.
   - `metro_lms_developer_origin_session` is `null`.
   - `metro_lms_inert_developer_snapshots` contains the preserved historical snapshots.
   Because active keys are `null`, AuthContext establishes `user = null` (State S7 / S0). The inert archive remains completely unread and non-authorizing.
3. **Duplicated Tab (Duplicate Tab / Right-Click 'Duplicate'):**
   Modern browsers clone the originating tab's `sessionStorage` into the new tab at the moment of duplication. The new tab inherits the archive, but active session and active origin remain `null`. The duplicated tab cannot restore or authorize from the archive.
4. **Browser Crash / Session Restoration ("Reopen Closed Tab" / Ctrl+Shift+T):**
   Some browsers restore `sessionStorage` across crashes or tab restoration.
   - **Application-Level Defense-in-Depth:** MetroLMS **never** relies on browser storage eviction for authorization boundaries. Even if a browser session restoration preserves `metro_lms_inert_developer_snapshots`, the application code strictly treats the session as unauthenticated (`user = null`). No return control or session elevation can occur without fresh authentication.

---

## 9. Two-Cycle and Retry Lifecycle State Table

The table below traces two complete SUP-01 cycles, an interleaved partial-transaction retry, and final tab termination in a single tab:

| # | Action / Transition | State | Active Session (`user` / storage) | Active Origin Slot (`metro_lms_developer_origin_session`) | Preserved Inert Archive (`metro_lms_inert_developer_snapshots`) | Snapshot Archive IDs | Epoch | OpId | Storage Rev | Emergency Proof | Visible Banners | Return Eligibility |
|---|---|---|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | Fresh Developer Login | **S1** | `USR_DEV_001` (auth) | `null` | `{}` (empty) | None | 2 | 1 | 0 | `null` | None | None |
| **2** | Launch Persona A (`USR_TEST_AST_001`) | **S3** | `USR_TEST_AST_001` (isolated) | **Snapshot A** (`personaId: USR_TEST_AST_001`) | `{}` (empty) | None | 3 | 2 | 1 | `null` | Normal Isolated Banner | Normal Return to Developer |
| **3** | Real User Login (`USR_SUPER_001`) | **S8** | `USR_SUPER_001` (real user) | **Snapshot A** (inert in active slot) | `{}` (empty) | None | 4 | 3 | 1 | `null` | None (Hidden) | **Forbidden (Dec B)** |
| **4** | **SUP-01 Logout (Cycle 1)** | **S7** | `null` (unauthenticated) | `null` (cleared post-archive) | `{ arch_A: Snapshot A }` | `arch_AST_001_t1` | 5 | 4 | 2 | `null` | None (Hidden) | **Ineligible (Dec C)** |
| **5** | Fresh Developer Login | **S1** | `USR_DEV_001` (auth) | `null` | `{ arch_A: Snapshot A }` (preserved) | `arch_AST_001_t1` | 6 | 5 | 2 | `null` | None | Eligible for New Launch |
| **6** | Launch Persona B (`USR_TEST_LEC_001`) | **S3** | `USR_TEST_LEC_001` (isolated) | **Snapshot B** (`personaId: USR_TEST_LEC_001`) | `{ arch_A: Snapshot A }` (preserved) | `arch_AST_001_t1` | 7 | 6 | 3 | `null` | Normal Isolated Banner | Normal Return to Developer |
| **7** | Real User Login (`USR_SUPER_001`) | **S8** | `USR_SUPER_001` (real user) | **Snapshot B** (inert in active slot) | `{ arch_A: Snapshot A }` (preserved) | `arch_AST_001_t1` | 8 | 7 | 3 | `null` | None (Hidden) | **Forbidden (Dec B)** |
| **8a** | Interrupted Logout (Write succeeds, clear fails) | **S8/S7** | `null` | **Snapshot B** (intact) | `{ arch_A, arch_B }` | `arch_AST_001_t1`, `arch_LEC_001_t2` | 9 | 8 | 3 | `null` | None | Interrupted |
| **8b** | **Retry of Logout (Idempotent Recovery)** | **S7** | `null` | `null` (cleared post-verify) | `{ arch_A, arch_B }` | `arch_AST_001_t1`, `arch_LEC_001_t2` | 10 | 9 | 4 | `null` | None (Hidden) | **Ineligible (Dec C)** |
| **9** | Third Fresh Developer Login | **S1** | `USR_DEV_001` (auth) | `null` | `{ arch_A, arch_B }` (both preserved) | `arch_AST_001_t1`, `arch_LEC_001_t2` | 11 | 10 | 4 | `null` | None | Eligible for Launch C |
| **10** | Tab Termination | **N/A** | Cleared | Cleared | Cleared natively by browser engine | None | N/A | N/A | N/A | N/A | N/A | N/A |

---

## 10. Strengthened SUP-01-T01 Coverage Matrix (60 + 1 = 61 Specifications)

The 60 accepted Phase 5 specifications (lines 146–5643 of `frontend/src/test/isolated-role-session.test.tsx`) remain completely frozen and unmodified.  
Under `WP-5.4.5-R1`, exactly one supplemental test specification will be authored after line 5643:

**Specification Identifier:** `SUP-01-T01`  
**Test Title:**  
`SUP-01-T01: Multi-Cycle Real-User Logout (S8 -> S7) preserves immutable historical snapshot archive across repeated cycles, write failures, and retries without reactivation (WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13)`

### Scenario Coverage Matrix for `SUP-01-T01`:

| Sub-Scenario Test Case | Trigger / Condition | Expected Assertion / Behavior | Invariant Enforced |
|---|---|---|---|
| **1. Cycle 1 Archive** | `USR_SUPER_001` logs out in S8 with Snapshot A present. | Active session `null`, active slot `null`, archive contains `arch_A`. | Decision C / `SUP-01` |
| **2. Fresh Developer Login** | `login(DEV_CREDENTIALS)` from S7. | AuthContext user `USR_DEV_001`, active origin `null`, archive retains `arch_A`. | Clean Origin / Unblocked Launch |
| **3. Cycle 2 Archive** | Launch Persona B (`USR_TEST_LEC_001`), enter S8, log out. | Active slot `null`, archive contains BOTH `arch_A` and `arch_B`. | Multi-Snapshot Retention |
| **4. Preservation of Snapshot A** | Inspect `arch_A` after Cycle 2. | `arch_A` data identical to Cycle 1; zero mutation or overwrite. | Immutability / Decision C |
| **5. Duplicate ID Idempotency** | Archive invoked when identical entry already present in archive. | Recognized as idempotent; active slot cleared without error or duplicate keys. | Idempotency / Crash Recovery |
| **6. Archive Write Failure** | Mock `setItem` throwing `QuotaExceededError`. | Active Developer origin snapshot remains intact in active slot; not cleared. | Non-Destructive Failure Safety |
| **7. Read-Back Verification Failure** | Mock corrupted or missing read-back. | Active origin snapshot remains intact in active slot; not cleared. | Verification Gate Safety |
| **8. Corrupted Archive Map** | Seed invalid JSON syntax in archive key. | Unparsable archive quarantined; active snapshot preserved in active slot. | Corruption Isolation |
| **9. Active Snapshot Mismatch** | Mutate active snapshot before clear step. | Deletion aborted; active slot remains intact with newer snapshot. | Anti-Accidental Deletion |
| **10. Superseded Logout** | Newer `login()` completes while `logout()` awaits API. | Older logout commits zero changes to storage or context state. | Concurrency / Epoch Fence |
| **11. Retry After Interruption** | Re-run archive when snapshot already in archive but active slot still present. | Idempotent completion: active slot safely cleared, revision incremented. | Self-Healing Interruption Recovery |
| **12. Return Controls Rejection** | Attempt `returnToDeveloperSession` & `returnFromExpiredPersonaSession` in S7. | Both reject with explicit error; return banners remain hidden. | Return Ineligibility / Decision C |
| **13. Isolated Persona Logout** | Explicit logout from active isolated persona (`S3 -> S12 -> S0`). | Two-slot cleanup executed (`clearSession` + `clearDeveloperOriginSession`); no archive entry. | Invariant `INV-P5-7` Preserved |

**Total Phase 5 Test Accounting:**  
`60 Frozen Core Specifications + 1 Supplemental SUP-01-T01 Specification = 61 Total Specifications`  
All 61 annotated: `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

---

## 11. Exact Expected Future Implementation Files

In the separately authorized remediation package (`WP-5.4.5-R1`):

1. [`frontend/src/core/auth/authStorage.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authStorage.ts):
   - Add storage key constant: `INERT_DEVELOPER_SNAPSHOTS_STORAGE_KEY = 'metro_lms_inert_developer_snapshots'`.
   - Export interfaces: `InertDeveloperSnapshotArchiveEntry` and `InertDeveloperSnapshotArchive`.
   - Export predicates: `areDeveloperOriginSessionsEqual()` and `computeCanonicalSnapshotFingerprint()`.
   - Add to `AuthStorageInstance`:
     - `archiveDeveloperOriginSession(expectedOrigin: DeveloperOriginSession): boolean`
     - `getInertDeveloperSnapshots(): InertDeveloperSnapshotArchive`
   - Implement synchronous, failure-safe atomic archiving transaction with deep structural checks and idempotency.
2. [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx):
   - In `logout()` (lines 558–582):
     Distinguish between active isolated persona logout (`isIsolatedSession === true`) and real-user logout with Developer origin present.
     If real user in S8: call `authStorage.archiveDeveloperOriginSession(origin)` to atomically preserve snapshot before clearing active session.
3. [`frontend/src/test/isolated-role-session.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/isolated-role-session.test.tsx):
   - Author supplemental specification `SUP-01-T01` (lines 5644+), annotated `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.
4. [`docs/frontend/reports/phase-05-increment-04-wp-5.4.5-implementation-report.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/reports/phase-05-increment-04-wp-5.4.5-implementation-report.md):
   - Increment to Version 4.0; document 61 total specifications; reclassify `SUP-01` to `Covered (Deferred to Phase 13)`.
5. [`docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md):
   - Update checklist status to `[Completed — Ready for Owner Acceptance]`.

---

## 12. Governance & Non-Execution Attestation

This planning review strictly adhered to project governance:
- **0 production source files modified.**
- **0 test files modified.**
- **0 test specifications created, deleted, or renumbered.**
- **0 Git commands staging or committing changes (`git status` confirms 0 staged files).**
- **0 automated test runners, linters, compilers, or builds executed.**
- **Version 1.2 report (`sup-01-final-architecture-audit-v1-2.md`) and Version 1.1 report (`sup-01-remediation-planning-report.md`) preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 13. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — ALL DESIGN-LEVEL CORRECTNESS AND SECURITY BLOCKERS RESOLVED**

*(All snapshot identity comparison defects, atomic transaction ordering rules, failure modes, credential retention justifications, browser lifecycle boundaries, 2-cycle lifecycle states, and the comprehensive 60+1 test matrix have been fully resolved at the design level. The remediation package WP-5.4.5-R1 is complete and ready for explicit owner authorization).*

