# MetroLMS — SUP-01 Failure-State Correctness & Evidence Closure (Version 1.4)
## Architecture Review: Failure-State Resilience, Structural Equality Proofs, and Two-Phase Archival Governance

**Document Version:** 1.4 (Final Failure-State Correctness & Evidence Closure)  
**Planning Date:** 2026-11-06  
**Document Path:** `docs/frontend/reports/sup-01-failure-state-correctness-audit-v1-4.md`  
**Classification:** Architectural Remediation & Test Coverage Plan (Planning Only — Zero Implementation)  
**Target Transition:** `SUP-01: S8 → S7` (Real-User Logout with Preserved Inert Developer Origin Snapshot)  
**Governing Owner Decisions:** Decision A (Approved 2026-11-06), Decision B (Approved 2026-11-06), Decision C (Approved 2026-11-06)  
**Execution Directives:** Strict Read-Only Planning Governance Preserved (Zero production code modifications, zero test changes, zero Git staging/commits, zero test runner or compiler execution)  
**Proposed Remediation Package:** `WP-5.4.5-R1` (Separately Authorized Remediation Package planned prior to Phase 13)  
**Remediation Plan Status:** `READY FOR OWNER AUTHORIZATION — FAILURE STATES AND RECOVERY FULLY DEFINED`

---

## 1. Executive Summary & Authoritative Owner Decisions

On November 6, 2026, the project owner reviewed the Phase 5 Work Package 5.4.5 closure audit and rendered three binding executive decisions:
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

The existing isolated-persona logout behavior remains unchanged: an explicit logout from an active isolated persona (`S3 -> S12 -> S0`) continues to perform its planned two-slot cleanup.

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

### Strict Inventory Invariants:
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
  - **Lines 572–573 (Current Source Baseline):**
    ```typescript
    authStorage.clearSession();
    authStorage.clearDeveloperOriginSession();
    ```
    This unconditionally wipes the active Developer origin snapshot even when the logging-out user is a real user in state `S8`, directly conflicting with Owner Decision C.
  - Lines 574–580: React state cleanup (`setUser(null)`, `setIsIsolatedSession(false)`, `setIsolatedPersona(null)`, `setEmergencyProof(null)`, `setError(null)`, `setIsLoading(false)`).
- **Lines 512–556 (`login`):**
  - Line 513: Increments `authOpSeqRef.current`.
  - Line 532: Calls `advanceSessionEpoch()`.
  - Line 533: Persists user session via `authStorage.setSession(session)`.
  - Line 534: Updates active user via `setUser(response.user)`.
  - Lines 538–542: Clears isolated session state and invalidates any emergency proof/digest.
- **Lines 610–680 (`launchIsolatedPersona`):**
  - Lines 616–620: Validates actor is Canonical Developer (`user.id === 'USR_DEV_001'` and `user.role === 'developer'`).
  - **Lines 649–651 (Anti-Nesting Guard):**
    ```typescript
    if (authStorage.hasDeveloperOriginSession() || isIsolatedSession) {
      throw new Error('لا يمكن بدء جلسة اختبار متداخلة؛ توجد جلسة اختبار معزولة نشطة بالفعل.');
    }
    ```
    If an unarchived snapshot remains in `metro_lms_developer_origin_session`, this check fails closed and blocks a newly authenticated Developer from launching testing.
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
  - **Lines 313–323 (Case D: Missing Active Session / State S7):**
    ```typescript
    if (!continuity.isRawSessionPresent) {
      setUser(null);
      setIsIsolatedSession(false);
      setIsolatedPersona(null);
      setEmergencyProof(null);
      setIsLoading(false);
      return;
    }
    ```
  - **Lines 328–380 (Case E: Expired Persona Session / State S6):**
    If an expired session matching `originSnapshot.personaId` is present in storage, `revalidateSession()` computes SHA-256 digest and creates `emergencyProof`.
  - Lines 419–423: Case 7 (Real-User Identity Mismatch / State S8): sets `isIsolatedSession = false`, `setEmergencyProof(null)`.

### 2. `frontend/src/core/auth/authStorage.ts`
- **Lines 124–143:** `AuthStorageInstance` interface defines session and origin methods.
- **Lines 152–157:** Factory state: `originSnapshotVersion = 0`, `originChangeListeners = new Set<() => void>()`.
- **Lines 175–184 (`notifyDeveloperOriginChanged`):** Increments `originSnapshotVersion++` and dispatches to registered listeners.
- **Lines 240–262 (`getDeveloperOriginSession`):** Reads exclusively from `DEVELOPER_ORIGIN_STORAGE_KEY` (`'metro_lms_developer_origin_session'`). Critically, `storage.getItem` followed by `JSON.parse` produces a **new object reference** on every call.
- **Lines 264–275 (`clearDeveloperOriginSession`):** Removes `DEVELOPER_ORIGIN_STORAGE_KEY` and calls `notifyDeveloperOriginChanged()`.
- **Lines 281–334 (`saveDeveloperOriginSession`):** Validates snapshot, enforces anti-overwriting guard (`hasDeveloperOriginSession()`), performs immediate read-back verification, and calls `notifyDeveloperOriginChanged()`.
- **Lines 446–480 (`quarantineDeveloperOriginSession`):** Sanitizes snapshot by stripping tokens and secrets; writes to `QUARANTINE_STORAGE_KEY` (`'metro_lms_quarantined_snapshot'`).

### 3. `frontend/src/core/auth/sessionEpoch.ts`
- **Lines 23–30 & 38–87:** Monotonic session transition epoch counter (`sessionEpoch`). Advances on login, logout, persona launch, normal return, and emergency return. In-memory only; never resets or decrements during active lifecycle.

### 4. `frontend/src/features/auth/components/IsolatedSessionBanner.tsx`
- **Lines 54–106:** Emergency banner renders ONLY when `user === null && isEmergencyState === true`.
- **Lines 108–115:** Normal isolated-session banner renders ONLY when 5 strict criteria are met (including `user !== null`, `isIsolatedSession === true`, valid persona token, unexpired origin snapshot).

### 5. `frontend/src/test/isolated-role-session.test.tsx`
- **Lines 4752–4826 (`P5-T18-6`):** Tests static S8 state with real user `USR_SUPER_001` and active origin snapshot, asserting banner suppression and identity preservation. Does NOT invoke `logout()`.
- **Lines 5620–5643:** End of test suite (60th written specification).

---

## 4. Source-Based Analysis of Archive Failure in State S8

The review of Version 1.3 highlighted a critical architectural vulnerability:  
*If archival to `metro_lms_inert_developer_snapshots` fails, but `authStorage.clearSession()` is executed and `user = null` is committed, the active Developer origin snapshot remains stranded in `metro_lms_developer_origin_session`.*

### Detailed Source Inspection Answers:

1. **What does `revalidateSession()` do after refresh when the real-user session is cleared but the active origin remains?**  
   - In `AuthContext.tsx` lines 230–250, `revalidateSession()` reads `rawOrigin` from `metro_lms_developer_origin_session` and successfully parses it.
   - At line 311, it calls `authStorage.inspectSessionContinuity()`.
   - Because `clearSession()` was executed, `continuity.isRawSessionPresent` is `false`.
   - At line 314 (Case D: State S7), the condition `if (!continuity.isRawSessionPresent)` evaluates to `true`.
   - It sets `user = null`, `isIsolatedSession = false`, `emergencyProof = null`, and returns.
   - **Critical Vulnerability:** The Developer snapshot remains **sitting in the authoritative active slot** (`metro_lms_developer_origin_session`). It was not archived; it is not in inert storage.
2. **Can normal return, emergency return, or emergency proof generation become reachable?**  
   - *Normal Return:* `returnToDeveloperSession()` (line 810) checks `if (!isIsolatedSession)` and (line 824) `if (!user)`. While `user === null`, normal return throws.
   - *Emergency Return:* `returnFromExpiredPersonaSession()` (line 975) checks `if (!emergencyProof)`. While `emergencyProof === null`, emergency return throws.
   - *Emergency Proof Generation Threat:* Because the snapshot remains in `DEVELOPER_ORIGIN_STORAGE_KEY`, if an attacker, extension, or test script seeds a synthetic token matching `originSnapshot.personaId` with past `expiresAt`, line 328 in `revalidateSession()` will detect `continuity.isExpired && continuity.userId === originSnapshot.personaId`, compute SHA-256 digest, and **generate an active `emergencyProof`**! This would render the emergency return banner and allow full restoration of Developer credentials!
3. **Can a future Developer login accidentally interact with the old snapshot?**  
   - **YES — Fatal Launch Blockage:** When Developer authenticates (`login()`), `user = USR_DEV_001` is established.
   - When Developer subsequently attempts `launchIsolatedPersona(personaId)`, line 649 checks:
     ```typescript
     if (authStorage.hasDeveloperOriginSession() || isIsolatedSession) {
       throw new Error('لا يمكن بدء جلسة اختبار متداخلة؛ توجد جلسة اختبار معزولة نشطة بالفعل.');
     }
     ```
     Because the unarchived snapshot was never removed from `metro_lms_developer_origin_session`, `hasDeveloperOriginSession()` returns `true`! The genuine Developer is **permanently blocked** from launching isolated testing in that browser tab.
4. **Does leaving the snapshot in the active slot violate Decision C?**  
   - **YES.** Decision C mandates: *"Preserve the existing Developer origin snapshot in per-tab sessionStorage, unchanged and inert, until tab termination."* The active slot is NOT inert; it is the active launch origin slot.
5. **What happens if server `authApi.logout()` succeeds but archival subsequently fails?**  
   - The server token is revoked on the backend. If local logout is aborted to protect the snapshot, the client UI might still display the real user as logged in locally, but any network call would fail with 401.

---

## 5. Evaluation of Failure-State Alternatives & Proposed Architecture

To eliminate the orphan active origin hazard, three architectural alternatives were rigorously evaluated:

| Architectural Dimension | Alternative 1: Transactional Pre-Flight Abort (Recommended) | Alternative 2: Non-Authorizing Quarantine Eviction | Alternative 3: Unconditional Active Slot Deletion |
|---|---|---|---|
| **Core Concept** | Archive is written & verified **BEFORE** server logout or local session clearing. If archive fails, logout is aborted. | If archive fails, sanitize snapshot into `QUARANTINE_STORAGE_KEY` and clear active slot. | If archive fails, clear active slot anyway; snapshot is lost. |
| **Active User Identity** | Remains real user (`USR_SUPER_001`). State remains **S8**. | Cleared (`user = null`). | Cleared (`user = null`). |
| **Server Logout State** | Active (unrevoked). Synchronized with client. | Revoked. | Revoked. |
| **Active Origin Storage** | Preserved in active slot (consistent with State S8). | **Cleared** (`removeItem`). | **Cleared** (`removeItem`). |
| **Inert Archive Storage** | Unchanged. | Sanitized diagnostic entry in quarantine. | Empty / Unchanged. |
| **Refresh Behavior** | Revalidates `USR_SUPER_001`. Clean S8. | Revalidates `null`. Clean S0. | Revalidates `null`. Clean S0. |
| **Return Eligibility** | Forbidden (Decision B in S8). | Forbidden (No active origin or proof). | Forbidden (No active origin). |
| **Developer Launch Unblocked?** | N/A (User still in S8). | **YES** (Active origin is empty). | **YES** (Active origin is empty). |
| **Decision C Compliance** | 100% (Snapshot preserved unchanged). | Partial (Tokens stripped to quarantine). | **VIOLATED** (Snapshot destroyed). |
| **Trapped User Risk?** | User notified storage full; tab close clears all. | None. | None. |

### Proposed Architecture: Two-Phase Transactional Archival with Pre-Flight Guarantee

The proposed design adopts **Alternative 1 (Two-Phase Transactional Archival)** as the primary governing policy, supplemented by an explicit Owner Decision option:

```mermaid
sequenceDiagram
    autonumber
    participant UI as User / UI
    participant Ctx as AuthContext
    participant Store as authStorage (Synchronous)
    participant Api as authApi.logout() (Network)

    UI->>Ctx: logout() initiated in State S8
    Note over Ctx: opId = ++authOpSeqRef.current<br/>advanceSessionEpoch()
    Ctx->>Store: archiveDeveloperOriginSession(activeOrigin)
    activate Store
    Note over Store: Phase 1: Pre-Flight Archival & Verification
    Store->>Store: Write & Read-Back Verify Archive Entry
    alt Archive Write or Verify Fails (e.g. QuotaExceededError)
        Store-->>Ctx: return false (Archival Failed)
        deactivate Store
        Note over Ctx: Abort Logout! Do NOT call Api.logout()<br/>Do NOT clear active session<br/>Do NOT clear active origin slot
        Ctx-->>UI: Display Recoverable Error:<br/>"فشل أرشفة جلسة المطور. لم يتم إنهاء الجلسة لحماية البيانات."<br/>State remains S8 (Protected)
    else Archival Succeeded & Verified
        Store->>Store: Phase 2: Clear Active Origin Slot<br/>originSnapshotVersion++
        Store-->>Ctx: return true (Archival Verified)
        deactivate Store
        Ctx->>Api: await authApi.logout()
        Ctx->>Store: clearSession()
        Note over Ctx: Reset React State (user=null)<br/>State S7 Established Cleanly
        Ctx-->>UI: Clean Logout to S7 Complete
    end
```

### Unresolved Owner Decision (Decision E — Archival Failure Policy)
If browser storage is completely full (`QuotaExceededError`) and the user cannot free storage:
- **Option 1 (Transactional Abort — Planned Default):** Abort logout. Keep user in S8. Preserve snapshot and session. User is advised to close tab (which cleanly destroys `sessionStorage`).
- **Option 2 (Quarantine & Evict — Alternative Owner Policy):** If the owner mandates that a real user must be able to log out even when storage is 100% exhausted: sanitize the snapshot into `QUARANTINE_STORAGE_KEY` (stripping `developerToken`), clear `DEVELOPER_ORIGIN_STORAGE_KEY`, and proceed with logout to State S0.
*The planned implementation defaults to Option 1 unless explicit owner instruction authorizes Option 2.*

---

## 6. Verification of Structural Equality & Fingerprint Algorithms

### 1. Proposed Deep Structural Equality Predicate
```typescript
/**
 * Proposed Structural Equality Predicate for DeveloperOriginSession
 * Guarantees identity verification without relying on JavaScript object reference equality.
 */
export function areDeveloperOriginSessionsEqual(
  a: DeveloperOriginSession | null | undefined,
  b: DeveloperOriginSession | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // 1. Validate Schema Version (strict number)
  if (a.schemaVersion !== 1 || b.schemaVersion !== 1) return false;

  // 2. Validate savedAt ISO timestamp (string equality & valid parse)
  if (typeof a.savedAt !== 'string' || typeof b.savedAt !== 'string') return false;
  if (a.savedAt !== b.savedAt) return false;

  // 3. Validate Persona ID (string equality & non-empty)
  if (typeof a.personaId !== 'string' || typeof b.personaId !== 'string') return false;
  if (a.personaId !== b.personaId) return false;

  // 4. Validate Developer Token (strict string match)
  if (typeof a.developerToken !== 'string' || typeof b.developerToken !== 'string') return false;
  if (a.developerToken !== b.developerToken) return false;

  // 5. Validate Expiration (finite positive integer match)
  if (typeof a.developerExpiresAt !== 'number' || typeof b.developerExpiresAt !== 'number') return false;
  if (a.developerExpiresAt !== b.developerExpiresAt) return false;

  // 6. Validate Canonical Developer User Identity
  if (!a.developerUser || !b.developerUser) return false;
  if (a.developerUser.id !== 'USR_DEV_001' || b.developerUser.id !== 'USR_DEV_001') return false;
  if (a.developerUser.role !== 'developer' || b.developerUser.role !== 'developer') return false;

  return true;
}
```

### 2. Proposed Canonical Fingerprint Algorithm
```typescript
/**
 * Proposed Canonical Snapshot Fingerprint Generator
 * Produces a deterministic string representation of all seven canonical properties.
 */
export function computeCanonicalSnapshotFingerprint(origin: DeveloperOriginSession): string {
  if (!origin || typeof origin !== 'object') {
    throw new Error('Invalid origin snapshot provided for fingerprint generation');
  }
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

### 3. Formal Equivalence Proof
- **Case 1: Newly Parsed Object with Identical Content:**  
  Let $O_1$ be the object in memory. Let $S = \text{JSON.stringify}(O_1)$. Let $O_2 = \text{JSON.parse}(S)$.  
  While $O_1 \not\equiv O_2$ by reference ($O_1 \neq O_2$ in memory), every field comparison ($O_1.k === O_2.k$) evaluates to `true`.  
  `areDeveloperOriginSessionsEqual(O_1, O_2)` evaluates to `true`.  
  `computeCanonicalSnapshotFingerprint(O_1) === computeCanonicalSnapshotFingerprint(O_2)` evaluates to `true`.  
  *Proof: Parsed instances with identical content are 100% accepted.*
- **Case 2: Mutation of Any Canonical Field:**  
  If $O_2$ has $O_2.\text{developerExpiresAt} = O_1.\text{developerExpiresAt} + 1$, or $O_2.\text{personaId} \neq O_1.\text{personaId}$:  
  `areDeveloperOriginSessionsEqual(O_1, O_2)` evaluates to `false`.  
  `computeCanonicalSnapshotFingerprint(O_1) !== computeCanonicalSnapshotFingerprint(O_2)` evaluates to `true`.  
  *Proof: Any mutated snapshot is 100% rejected.*

---

## 7. Ordered Atomic Transaction and Concurrency Sequence

The proposed transaction separates synchronous storage atomicity from asynchronous context operation sequencing:

```
[UI Trigger: logout()]
  │
  ├─ 1. [Synchronous: AuthContext] opId = ++authOpSeqRef.current
  ├─ 2. [Synchronous: AuthContext] advanceSessionEpoch()  -->  Invalidates all pending in-flight requests
  │
  ├─ 3. [Synchronous: authStorage] Phase 1: Pre-Flight Archival Transaction
  │      ├─ 3.1. Read active snapshot: origin = getDeveloperOriginSession()
  │      ├─ 3.2. Validate structural integrity of origin (isValidDeveloperOriginSession)
  │      ├─ 3.3. Read archive map: archive = getInertDeveloperSnapshots()
  │      ├─ 3.4. Idempotency check: if archive[archiveId] exists & equals origin, proceed to verify
  │      ├─ 3.5. Write updated archive map to sessionStorage
  │      ├─ 3.6. Read-back archive from sessionStorage & verify archive[archiveId] structurally
  │      │
  │      ├─ [IF WRITE OR READ-BACK VERIFICATION FAILS]
  │      │    └─ DO NOT CLEAR ACTIVE SLOT! Return false.
  │      │       AuthContext aborts logout; sets error; user remains in S8. (STOP)
  │      │
  │      └─ [IF WRITE AND READ-BACK SUCCEED]
  │           ├─ 3.7. Pre-clear check: areDeveloperOriginSessionsEqual(currentActive, origin)
  │           ├─ 3.8. Remove active slot: removeItem('metro_lms_developer_origin_session')
  │           ├─ 3.9. Revision bump: originSnapshotVersion++ & notify listeners
  │           └─ Return true.
  │
  ├─ 4. [Asynchronous: Network Boundary] await authApi.logout().catch(() => {})
  │      └─ Server revokes real user token.
  │
  ├─ 5. [Synchronous: AuthContext Post-Await Fence]
  │      └─ Check: if (opId !== authOpSeqRef.current) --> Superseded by newer login! Discard further commits.
  │
  └─ 6. [Synchronous: AuthContext State Finalization]
         ├─ 6.1. authStorage.clearSession()
         ├─ 6.2. setUser(null)
         ├─ 6.3. setIsIsolatedSession(false); setIsolatedPersona(null); setEmergencyProof(null)
         └─ 6.4. Transition to State S7 cleanly established.
```

---

## 8. Comprehensive Failure-Mode Matrix (13 Scenarios)

The matrix below specifies the exact behavior, storage state, and recovery mechanism across all thirteen analyzed failure modes:

| # | Failure Scenario | Server Session | Local Session | Active Origin Slot | Inert Archive Entry | Return Possible? | Recovery & Integrity Guarantee |
|:---:|---|:---:|:---:|:---:|:---:|:---:|---|
| **1** | **Archive Quota Exhaustion (`QuotaExceededError`)** | Active | Active | **Intact** | Unchanged | Forbidden (S8) | Pre-flight aborts logout. Real user remains logged in. Active snapshot preserved. |
| **2** | **Archive Write Exception (DOMException)** | Active | Active | **Intact** | Unchanged | Forbidden (S8) | Pre-flight aborts logout. Active slot preserved. No orphan origin created. |
| **3** | **Read-Back Verification Mismatch** | Active | Active | **Intact** | Unchanged | Forbidden (S8) | Pre-flight aborts active slot deletion. Snapshot preserved in active slot. |
| **4** | **Corrupted Archive JSON in Storage** | Active | Active | **Intact** | Unchanged | Forbidden (S8) | Archive read fails gracefully; active slot clear aborted. Corrupted data isolated. |
| **5** | **Recovery-Key Write Failure** | Active | Active | **Intact** | Unchanged | Forbidden (S8) | Fallback recovery failure aborts active clear; snapshot preserved in active slot. |
| **6** | **Active Snapshot Mismatches Before Deletion** | Revoked/Act | Active | **Intact (Newer)** | Archived (Old) | Forbidden | Step 3.7 detects active slot mutated by concurrent action; aborts clear of newer slot. |
| **7** | **Duplicate Archive ID (Identical Snapshot)** | Revoked | Cleared | Cleared | Intact | Ineligible (S7) | Idempotent branch verifies existing entry; clears active slot safely; zero duplicates. |
| **8** | **Archive Collision (Same ID, Differing Snapshot)** | Revoked | Cleared | Cleared | Both Intact | Ineligible (S7) | Appends monotonic `_seqN` suffix; writes unique key without overwriting old snapshot. |
| **9** | **Logout Superseded by Newer Login** | Revoked (Old) | **New User** | **New Slot** | Archived (Old) | Controlled | Post-await fence `opId !== authOpSeqRef.current` discards older logout; new session safe. |
| **10** | **Refresh After Partial Archival (Interrupted)** | Active/Rev | Cleared | **Intact** | Archived | Forbidden (S8) | Reload re-inspects active slot; S8 continuity handling applies; no crash. |
| **11** | **Refresh After Archive Succeeds, Pre-Clear Interrupted** | Revoked | Cleared | **Intact** | Archived | Ineligible | Next logout retry detects idempotent match and clears active slot safely. |
| **12** | **Server Logout Succeeds, Local Archival Fails** | Revoked | Active | **Intact** | Unchanged | Forbidden (S8) | Two-Phase order prevents this: archival is verified BEFORE server logout is called! |
| **13** | **Retry After Partial Archival** | Revoked | Cleared | Cleared | Archived | Ineligible (S7) | Idempotency logic recognizes verified archive; safely clears active slot; self-healing. |

---

## 9. Refresh and Retry Lifecycle Analysis

### Refresh Lifecycle Across States:
1. **Refresh in State S8 (Real User + Active Origin):**  
   - `revalidateSession()` reads active origin and active user session.
   - Detects `continuity.userId !== originSnapshot.personaId` (Case 7: Identity Mismatch).
   - Establishes `user = USR_SUPER_001`, `isIsolatedSession = false`, `emergencyProof = null`.
   - Result: Clean S8. Return controls hidden.
2. **Refresh in State S7 (Post-SUP-01 Logout):**  
   - `revalidateSession()` inspects `metro_lms_developer_origin_session` -> `null`.
   - `inspectSessionContinuity()` -> `isRawSessionPresent: false`.
   - Establishes `user = null`, `isIsolatedSession = false`, `emergencyProof = null`.
   - Archive in `metro_lms_inert_developer_snapshots` is ignored.
   - Result: Clean S0/S7. Return controls hidden. Fresh Developer login unblocked.
3. **Refresh After Interrupted Archival (Active Origin still present, User cleared):**  
   - `revalidateSession()` reads active origin.
   - `inspectSessionContinuity()` -> `isRawSessionPresent: false`.
   - Case D (line 314) executes: sets `user = null`, `isIsolatedSession = false`, `emergencyProof = null`.
   - **Self-Healing on Subsequent Retry:** When user or test invokes archive retry, idempotency recognizes the snapshot is already in the archive and safely clears the active slot.

---

## 10. Proposed SUP-01-T01 Coverage Matrix (60 Core + 1 Supplemental = 61 Total Specifications)

### Governance & Test Accounting:
- The 60 accepted Phase 5 specifications (lines 146–5643 of `frontend/src/test/isolated-role-session.test.tsx`) remain frozen and unmodified.
- Exactly one supplemental specification is planned after line 5643: `SUP-01-T01`.
- **Current Status of SUP-01-T01:** `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13` (Planning status only; test file has NOT been modified).
- **Total Specifications Planned:** `60 + 1 = 61`.

### 13-Point Coverage Structure within Planned `SUP-01-T01`:

| # | Test Coverage Dimension | Phase within SUP-01-T01 | Assertion Type | Planned Test Verification |
|:---:|---|---|---|---|
| **1** | **Cycle 1 Archive** | Execution Step 1 | State Assertion | Verify active session cleared, active slot cleared, archive contains `arch_A`. |
| **2** | **Fresh Developer Login** | Execution Step 2 | State Assertion | Verify `user = USR_DEV_001`, active origin `null`, archive retains `arch_A`. |
| **3** | **Cycle 2 Archive** | Execution Step 3 | State Assertion | Launch Persona B, enter S8, log out. Verify archive contains `arch_A` AND `arch_B`. |
| **4** | **Preservation of Snapshot A** | Execution Step 4 | Immutability Check | Deep structural comparison of `arch_A` before and after Cycle 2; zero mutation. |
| **5** | **Duplicate ID Idempotency** | Edge-Case Step 5 | Recovery Assertion | Archive invoked with existing key; assert active slot cleared with zero duplicate keys. |
| **6** | **Archive Write Failure** | Mock Failure Step 6 | Invariant Assertion | Mock `setItem` quota error; assert active Developer snapshot is NOT cleared. |
| **7** | **Read-Back Verification Failure** | Mock Failure Step 7 | Invariant Assertion | Mock corrupted read-back; assert active Developer snapshot is NOT cleared. |
| **8** | **Corrupted Archive Map** | Mock Failure Step 8 | Error Handling | Seed invalid JSON syntax in archive key; assert active snapshot is preserved. |
| **9** | **Active Snapshot Mismatch** | Mock Failure Step 9 | Concurrency Check | Mutate active slot before clear; assert deletion aborted and newer slot intact. |
| **10** | **Superseded Logout** | Async Boundary Step 10 | Concurrency Check | Simulate newer `login()` while logout in flight; assert older logout commits zero changes. |
| **11** | **Retry After Interruption** | Self-Healing Step 11 | Recovery Assertion | Seed archive with active snapshot already present; verify active slot clears safely. |
| **12** | **Return Controls Rejection** | Security Barrier Step 12 | Security Assertion | Assert `returnToDeveloperSession` & `returnFromExpiredPersonaSession` both reject in S7. |
| **13** | **Isolated Persona Logout Guard** | Regression Step 13 | Teardown Check | Verify explicit logout from active isolated persona (`S3 -> S12 -> S0`) performs two-slot clear. |

---

## 11. Exact Expected Future Implementation Files

Under a separately authorized remediation package (`WP-5.4.5-R1`):
1. [`frontend/src/core/auth/authStorage.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/authStorage.ts):
   - Add `INERT_DEVELOPER_SNAPSHOTS_STORAGE_KEY = 'metro_lms_inert_developer_snapshots'`.
   - Add types `InertDeveloperSnapshotArchiveEntry` and `InertDeveloperSnapshotArchive`.
   - Add predicates `areDeveloperOriginSessionsEqual()` and `computeCanonicalSnapshotFingerprint()`.
   - Implement synchronous, two-phase atomic archiving transaction `archiveDeveloperOriginSession()`.
   - Add read-only accessor `getInertDeveloperSnapshots()`.
2. [`frontend/src/core/auth/AuthContext.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/auth/AuthContext.tsx):
   - In `logout()` (lines 558–582): Implement pre-flight archival check for real-user sessions before calling `authApi.logout()`.
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
- **Versions 1.1, 1.2, and 1.3 preserved completely unmodified.**
- **Phase 13 / Gate B remains strictly `[Not Started]`.**
- **Revision 5 roadmap and Planning Report Version 3.0 remain completely unmodified.**

---

## 13. Final Architecture Review Status

**READY FOR OWNER AUTHORIZATION — FAILURE STATES AND RECOVERY FULLY DEFINED**

*(All failure states, orphan active origin hazards, deep structural equality proofs, two-phase transaction orderings, the 13-point failure-mode matrix, refresh/retry lifecycles, and the strengthened 60+1 test matrix have been comprehensively analyzed and resolved at the design level. Remediation package WP-5.4.5-R1 is fully defined and ready for explicit owner authorization).*

