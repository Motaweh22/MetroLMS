# MetroLMS — Phase 3.2D.0: Progress-Aware Metadata Watchdog Investigation

> **Document Type:** Strictly Read-Only Root-Cause Investigation & Design Specification  
> **Date:** 2026-11-27  
> **Primary Inspected Module:** `frontend/src/features/learning-player/components/VideoPlayer.tsx` (`1792` lines) & `frontend/src/test/video-player-recovery.test.tsx` (`1970` lines)  
> **Evidence Baseline:** Phase 3 (`T3-CUSTOM`), Phase 3.1, Phase 3.2A, Phase 3.2B, and Phase 3.2C  
> **Confidence Labels Used:** `CONFIRMED` · `STRONGLY SUPPORTED` · `HYPOTHESIS` · `PRODUCT DECISION REQUIRED`

---

## 1. Confirmed Initial Metadata Timeout Root Cause (`CONFIRMED`)

During Phase 3 `T3-CUSTOM` (`2000 ms` latency, `~100 kbps` / `12.5 KB/s` download throughput, Course `10015` Video A `/api/media/references/53/stream`, `41,803,581` bytes):

1. `POST /api/media/stream-ticket` resolved in `2042.6 ms` (`200 OK`).
2. `<video>` mounted with `preload="metadata"` and issued `GET /api/media/references/53/stream?st=[REDACTED]` with `Range: bytes=0-`.
3. Backend Waitress returned HTTP `206 Partial Content` (`ttfbMs: 2036.6 ms`, bounded `4 MiB` chunk `4,194,304` bytes) and continued actively transferring data.
4. At the same time, `armWatchdog('initial', false)` armed a **single fixed, absolute `20,000 ms` (`INITIAL_METADATA_TIMEOUT_MS`) timer**.
5. Because `<video>.onProgress` is currently a no-op (`L1445-L1447`) and `armWatchdog` inspects neither `networkState` nor `buffered` / transfer activity, the `20,000 ms` timer expired unconditionally (~`18 s` after TTFB ≈ `225 KB` transferred at `12.5 KB/s`).
6. `triggerRecovery('stall', gen)` fired `HEAD` (`200 OK`, `2181.4 ms`) → `POST /api/media/stream-ticket` (`200 OK`, `2279.4 ms`) → `applyVideoReloadWithResume(...)`, rotating `?st=`, aborting the healthy in-progress `bytes=0-` fetch around `24.5 s` (`net::ERR_ABORTED`), and restarting from `Range: bytes=0-` in `retrying_stream`.
7. Repeating this bounded sequence (`MAX_AUTO_RECOVERY_ATTEMPTS = 2`) discards all previously downloaded initial header/metadata bytes on every attempt, preventing `readyState >= 1` (`loadedmetadata`) from completing under continuous `~100 kbps` bandwidth.

---

## 2. Exact Source Locations and Watchdog Dependency Chain (`CONFIRMED`)

### 2.1 Initial Metadata (`kind = 'initial'`) Watchdog Lifecycle in `VideoPlayer.tsx`

| Mechanism | Exact Location | Behavior |
|---|---|---|
| Timeout constant | `L19` | `export const INITIAL_METADATA_TIMEOUT_MS = 20_000;` |
| Watchdog refs | `L181-L183`, `L309` | `watchdogTimerRef`, `watchdogKindRef` (`'initial' \| 'playback' \| null`), `suspendedWatchdogKindRef`, `armWatchdogRef` |
| Arm logic | `L550-L581` | Guards `!src \|\| hasErrorRef.current \|\| isRecoveringRef.current \|\| isUserPausedRef.current`; defers to `suspendedWatchdogKindRef` if `document.visibilityState === 'hidden'`; if `preserveExisting && watchdogTimerRef.current !== null && watchdogKindRef.current === kind`, returns early; otherwise `clearWatchdog()` and schedules `setTimeout(() => void triggerRecovery('stall', gen), 20_000)` |
| Arm sites (`'initial'`) | `L695` | Protected ticket `requestProtectedStreamTicket().then(...)` calls `armWatchdogRef.current('initial', false)` |
| | `L1402` | `<video onLoadStart>` resets `hasLoadedMetadataRef.current = false` and calls `armWatchdog('initial', false)` (restarting the 20s clock once React binds `src`) |
| | `L1433` | `<video onWaiting>` before `loadedmetadata`: `armWatchdog('initial', true)` (`preserveExisting = true`) |
| | `L1438` | `<video onStalled>` before `loadedmetadata`: `armWatchdog('initial', true)` (`preserveExisting = true`) |
| | `L612` | `visibilitychange` → `'visible'`: `armWatchdog('initial', false)` if `pendingKind === 'initial' && !hasLoadedMetadataRef.current` |
| | `L369`, `L450`, `L504` | All 3 `triggerRecovery` reload paths call `armWatchdog('initial', false)` / `armWatchdogRef.current('initial', false)` |
| Clear sites (`clearWatchdog` `L248-L255`) | `L891-L892` | `handleLoadedMetadata` (`watchdogKindRef.current === 'initial'`) |
| | `L1473`, `L1511`, `L1045`, `L1500` | `onPlaying`, `onError`, `handleEnded`, `onPause` |
| | `L317`, `L637`, `L713`, `L757`, `L1149`, `L1364` | `triggerRecovery` entry, ticket effect start/cleanup, unmount cleanup, user pause in `togglePlay`, Retry button `onClick` |
| Suspend on tab hide | `L589-L602` | Clears `watchdogTimerRef` and stores `activeKind` into `suspendedWatchdogKindRef` |
| No-op `onProgress` | `L1445-L1447` | `onProgress={() => { // Explicitly NOT proof that playback has resumed; do not reset playback stall watchdog here. }}` |

### 2.2 Dependency Chain Analysis (`CONFIRMED`)

- `armWatchdog` depends on `[src, clearWatchdog, triggerRecovery]` (`L580`).
- `armWatchdogRef.current` syncs in `[armWatchdog]` effect (`L583-L585`), keeping Fix 1's stream-ticket initialization `useEffect` (`L631-L729`) free of `armWatchdog`, `triggerRecovery`, and `initialPosition` dependencies.
- Calling a new `recordInitialLoadActivity()` helper from `onProgress` / state refs **does not need to enter** `triggerRecovery` or the stream-ticket `useEffect` dependency array if progress tracking is ref-based cleanly.

---

## 3. Reliable vs. Unreliable Progress Signals Before Metadata (`CONFIRMED` / `STRONGLY SUPPORTED`)

| Browser Signal | Available when `readyState === 0`? | Reliability Before `loadedmetadata` | Exact Assessment |
|---|---|---|---|
| `loadedmetadata` (`readyState >= 1`) | Clears `readyState === 0` | **Deterministic completion** (`CONFIRMED`) | Exact exit condition for the initial watchdog; cancels all pre-metadata timers immediately. |
| `video.buffered` time-range advancement | Often empty (`length === 0`) | **Insufficient alone before metadata** (`CONFIRMED`) | By WHATWG HTML media spec, browsers typically cannot populate `TimeRanges` (`start(i)`/`end(i)` in seconds) until container `moov`/track headers are parsed (`loadedmetadata`). When non-empty (`bufferedEnd > lastBufferedEnd`), it IS strong progress; when empty (`0`), it cannot distinguish an active HTTP 206 header download from a dead connection. |
| `video.networkState` | Yes (`0..3`) | **Contextual qualifier only** (`CONFIRMED`) | `NETWORK_LOADING (2)` indicates the browser's fetch algorithm is currently trying to fetch media data, whereas `NETWORK_IDLE (1)` / `NETWORK_NO_SOURCE (3)` indicate no active fetch. Alone it cannot detect a silently hung TCP socket (`NETWORK_LOADING` stays `2` until socket failure/stall). |
| `<video>` `progress` event | Yes | **Activity signal when bounded; UNSAFE if unbounded** (`CONFIRMED`) | WHATWG specifies `progress` fires roughly every ~`350 ms` while network bytes continue arriving (switching to `stalled` after ~`3 s` without new data). However: (1) bare `progress` does **not** expose `bytesReceived` or guarantee metadata completion; (2) a `1 B/s` trickle or synthetic `progress` event would keep an unbounded idle timer alive forever; (3) post-metadata, existing test `video-player-recovery.test.tsx:214` explicitly requires bare `progress` NOT to defeat the `12 s` playback stall detector. |
| `stalled` / `waiting` events | Yes | **Stall indicator (`initial` -> arm if un-armed)** (`CONFIRMED`) | Indicates browser stopped receiving bytes for ~3 s (`stalled`) or cannot advance frame (`waiting`). Must **never** reset/extend idle deadlines; if `preserveExisting = true`, leaves existing countdown running. |
| `video.currentTime` | Remains initial / `0` | **Not usable** (`CONFIRMED`) | Does not advance while waiting for `loadedmetadata`. |
| Network / CDP byte counters | Investigation telemetry only | **Unavailable to in-page `<video>` JS** (`CONFIRMED`) | `<video>` elements do not fire XHR `onprogress(loaded/total)` events or expose `ResourceTiming` `transferSize` before request completion without moving `<video>` off progressive streaming (`Blob`/MSE — prohibited). |

### Conclusion on Signals (`STRONGLY SUPPORTED`)

Before `loadedmetadata`, **no single DOM event exposes exact raw TCP byte count** on a progressive `<video src>` element. Therefore, the safest browser-observable progress signal for **`kind === 'initial'` ONLY** is:

- **Qualified Initial Progress:** either:
  1. Measurable `video.buffered` advancement (`maxBufferedEnd > lastObservedBufferedEnd + 0.01`) or `video.readyState > lastObservedReadyState`, **OR**
  2. `<video>` `progress` event **specifically while** `!hasLoadedMetadataRef.current`, `watchdogKindRef.current === 'initial'`, and `(media.networkState === HTMLMediaElement.NETWORK_LOADING || bufferedAdvanced || readyStateAdvanced)` — **strictly capped by a non-resettable absolute ceiling timer** so unbounded extension is impossible!

*(Note: In JSDOM unit tests, `HTMLMediaElement.prototype.networkState` defaults to `0` (`NETWORK_EMPTY`) unless explicitly defined, so unit specs must either set `networkState: 2` or advance `buffered` — and production browsers set `networkState === 2` whenever `progress` fires during active HTTP 206 streaming.)*

---

## 4. Separate Post-Metadata Seek Watchdog Analysis (`HYPOTHESIS`)

### Inspected Behavior (`VideoPlayer.tsx` `L20`, `L554-L578`, `L984-L988`, `L1097`, `L1414-L1466`)

- `PLAYBACK_STALL_TIMEOUT_MS = 12_000` (`L20`).
- Armed (`preserveExisting = true`) in `handleSeeking` (`L1097`, when not paused/ended), `onWaiting` (`L1433`, post-metadata), `onStalled` (`L1442`), and `visibilitychange` (`L619`).
- Cleared in `onSeeked` (`L1418-L1420`), `onPlaying` (`L1473`), `handleTimeUpdate` (`L986`: ONLY when `Math.abs(curr - lastMediaProgressTimeRef.current) > 0.01`), and `onCanPlay` / `onCanPlayThrough` (`L1450`, `L1463`) **ONLY when `!isSeekingRef.current`**.

### Risk Assessment (`HYPOTHESIS`)

1. **Non-seeking stall (`waiting` at current playhead):** Current behavior MUST be preserved — `video-player-recovery.test.tsx:214-240` validates that bare `onProgress` events during `waiting` do NOT defeat `PLAYBACK_STALL_TIMEOUT_MS`.
2. **Unbuffered seek (`isSeekingRef.current === true`) on very slow connections:** Because `onCanPlay` does not clear `playback` while `isSeekingRef.current === true`, if a user seeks to an unbuffered timestamp (e.g., `200 s`) under `~100 kbps` (`12.5 KB/s`), Chrome may take `> 12 s` to download enough of that byte window (typically keyframe cluster / chunk alignment) before emitting `seeked`. `PLAYBACK_STALL_TIMEOUT_MS` (`12 s`) will then trigger `triggerRecovery` and rotate the stream ticket mid-seek.
3. **Why it must stay separate from Fix 2 (`initial`):** Post-metadata seeking happens when `readyState >= 1`, so `video.buffered` **does** have valid `TimeRanges` in seconds; any future enhancement for slow unbuffered seeks can inspect real `buffered` range expansion near target time (rather than `onProgress` alone), without touching `waiting` stall recovery or coupling Fix 2 (`initial` metadata) to `PLAYBACK_STALL_TIMEOUT_MS`. *(Observed indirectly in Phase 3 `T3-SLOW3G` at `200 s`, but not yet isolated as a confirmed `100 kbps` seek defect; remains `HYPOTHESIS`.)*

---

## 5. Proposed Watchdog State Machine (`initial` Dual-Timer Design)

### State Model

Introduce explicit separation for pre-metadata initial loading while keeping `'playback'` (`12_000 ms`) intact:

```text
  [idle / src set]
        │  (ticket resolved OR <video onLoadStart>)
        ▼
  INITIAL_ARMED
    ├── Timer 1: initialIdleTimer    (e.g. INITIAL_METADATA_IDLE_TIMEOUT_MS = 20_000 ms) ── resets on qualified progress
    └── Timer 2: initialCeilingTimer (e.g. INITIAL_METADATA_MAX_TIMEOUT_MS  = PRODUCT DECISION) ── monotonic; NEVER reset by progress
        │
        ├──► [loadedmetadata fires] ──────────────────────► CLEARED (both idle + ceiling timers cleared)
        │
        ├──► [qualified progress while NETWORK_LOADING / buffered growth]
        │         └── resets initialIdleTimer ONLY (capped <= remaining ceiling)
        │
        ├──► [tab hidden (visibilityState === 'hidden')]
        │         └── pause both timers, record remainingCeilingMs (accumulated elapsed)
        │             on return to 'visible' (still !hasLoadedMetadata):
        │               re-arm initialIdleTimer AND ceilingTimer with remainingCeilingMs
        │
        ├──► [initialIdleTimer expires OR initialCeilingTimer expires]
        │         └── clearWatchdog() ──► triggerRecovery('stall', gen)
        │
        └──► [src change / Retry / error / unmount / pause]
                  └── CLEARED (all timers + ceiling timestamps reset)
```

### Key Architectural Properties

1. **Idle Timeout (`INITIAL_METADATA_IDLE_TIMEOUT_MS`):**
   - Preserves current `INITIAL_METADATA_TIMEOUT_MS = 20_000` alias (or equals `20_000 ms`) so zero-progress failures (`T3-BLK-*`, hung TCP, silent server freeze) still trigger recovery at `20 s`.
   - Resets **only** while `kind === 'initial'`, `!hasLoadedMetadataRef.current`, `!isRecoveringRef.current`, `!hasErrorRef.current`, and a **qualified progress signal** occurs (`buffered` max-end increased OR `readyState` increased OR `onProgress` fired while `media.networkState === 2`).
   - Optionally enforce a minimum throttle (`>= 250 ms`) or immediate `resetInitialIdleWatchdog()` check inside `onProgress` so rapid bursts remain cheap.
2. **Absolute Ceiling Timer (`INITIAL_METADATA_MAX_TIMEOUT_MS`):**
   - Armed once at the start of an initial-load lifecycle (either when `armWatchdog('initial', false)` starts fresh for a ticket/reload generation, preserving across `onLoadStart` vs starting on `onLoadStart`? **Design detail:** Do NOT reset `initialLoadStartedAtRef` when `<video onLoadStart>` fires right after ticket issuance `L695` → `L1402`, OR start ceiling on ticket resolution `L695` / non-protected `useEffect` / `applyVideoReloadWithResume` and reset ONLY on new `sourceGenerationRef`, `Retry`, `triggerRecovery` completion!). Wait — tracking `initialCeilingDeadlineRef` / `initialElapsedVisibleMsRef` ensures switching from `L695` (`armWatchdogRef.current('initial', false)`) to `L1402` (`onLoadStart`) does **not** grant an extra ceiling window!
   - Never extended by `onProgress`, `onWaiting`, or `onStalled`.
3. **No Change to `'playback'` Watchdog (`12_000 ms`):**
   - When `watchdogKindRef.current === 'playback'`, `onProgress` continues to do nothing (`video-player-recovery.test.tsx:214` untouched).

---

## 6. Proposed Idle Timeout & Absolute Ceiling Rationale

### Quantitative Evidence From `T3-CUSTOM` (`CONFIRMED`) & Sizing Calculation (`STRONGLY SUPPORTED`)

- Under `T3-CUSTOM` (`100 kbps` = `12.5 KB/s` = `12,500 B/s`, `2,000 ms` latency):
  - `POST /api/media/stream-ticket`: `~2.04 s`
  - `GET /stream` initial `206` TTFB: `~2.04 s`
  - **Usable download in `20 s` current window:** `(20 - 2.04) * 12,500 ≈ 224 KB` — too small if initial header/`moov` + first keyframe read exceeds ~`224 KB` or if MP4 `moov` requires a second tail `Range` round-trip (`+2 s` RTT + extra bytes).
  - **Comparison across candidate absolute ceilings (after ~`2–4 s` TTFB / RTT):**
    - At **`45,000 ms` (`45 s`):** `~530 KB` transferable (`2x+` current budget), recovers faster on ultra-trickle (`1 KB/s`), tight if MP4 `moov` sits >`500 KB` or at EOF.
    - At **`60,000 ms` (`60 s`):** `~725 KB` transferable (`~3.2x` current budget), handles standard `faststart` MP4 headers + audio/video initial packets under `100 kbps` (`3G` rural/congested mobile), while bounding slow loads within 1 minute before recovery/Blob fallback.
    - At **`90,000 ms` (`90 s`):** `~1.1 MB` transferable — accommodates larger multi-minute HD MP4 headers or EOF `moov` atoms on `100 kbps`, at the cost of waiting up to `90 s` if an endpoint genuinely trickles `10 B/s`.
- **Recommendation for Review:**
  - `INITIAL_METADATA_IDLE_TIMEOUT_MS`: **`20_000 ms`** (`CONFIRMED` parity with existing `INITIAL_METADATA_TIMEOUT_MS` for zero-progress stall detection; **candidate alternative `15_000 ms`** if faster dead-socket detection is desired).
  - `INITIAL_METADATA_MAX_TIMEOUT_MS`: **`PRODUCT DECISION REQUIRED`** — do not hardcode blindly (`45_000 ms` vs `60_000 ms` vs `90_000 ms` depends on accepted rural-mobile wait tolerance and MetroLMS course video encoding/`faststart` profile). Note: export both constants cleanly from `VideoPlayer.tsx` (`INITIAL_METADATA_TIMEOUT_MS = 20_000` kept exported for backward test compatibility!).

---

## 7. Regression Test Specifications (7 Required Tests)

All 7 tests target `frontend/src/test/video-player-recovery.test.tsx`:

1. **Test A — Slow but Progressing Initial Load:**
   - Mount protected `VideoPlayer` (`setupProtectedStreamFetch`), trigger `loadStart`, set `video.networkState = 2` (`NETWORK_LOADING`).
   - Advance timers in `5_000 ms` steps (`t = 5s, 10s, 15s, 20s, 25s, 30s`), firing `fireEvent.progress(video)` at each step before `20_000 ms` elapses.
   - Then fire `fireEvent.loadedMetadata(video)` at `t = 32s` (`< MAX_TIMEOUT`).
   - **Expected:** Zero premature `HEAD` calls (`headCalls === 0`), only initial `stream-ticket` (`ticketCalls === 1`), no `Range: bytes=0-` restart, player transitions cleanly out of `'loading_metadata'`.
2. **Test B — True Initial Stall:**
   - Mount protected `VideoPlayer`, trigger `loadStart` (and `networkState = 2`), fire **zero** `progress` / `buffered` changes for `INITIAL_METADATA_IDLE_TIMEOUT_MS` (`20_000 ms`).
   - **Expected:** At `19_000 ms`, `headCalls === 0`; at `20_000 ms`, bounded recovery runs (`headCalls === 1`, `ticketCalls === 2`). *(Preserves existing `detects initial loading timeout before loadedmetadata` contract!)*
3. **Test C — Absolute Load Ceiling:**
   - Mount protected `VideoPlayer`, trigger `loadStart`, set `networkState = 2`.
   - Fire `fireEvent.progress(video)` every `10_000 ms` continuously beyond `INITIAL_METADATA_IDLE_TIMEOUT_MS` until `INITIAL_METADATA_MAX_TIMEOUT_MS` elapses without `loadedmetadata`.
   - **Expected:** Bounded recovery fires at `INITIAL_METADATA_MAX_TIMEOUT_MS` (and if recovery attempts exhaust or ticket fails, reaches bounded terminal error without hanging indefinitely).
4. **Test D — Progress Stops After Initial Activity:**
   - Mount `VideoPlayer`, fire `loadStart` (`networkState = 2`).
   - Advance `8_000 ms`, fire `progress` (idle resets -> deadline shifts to `t = 28s`); advance `8_000 ms` (`t = 16s`), fire `progress` (idle resets -> deadline shifts to `t = 36s`), then **stop** all `progress` events.
   - **Expected:** No recovery at `t = 20s` or `t = 35s`; recovery triggers strictly at `t = 36s` (`20s` after the last qualified `progress`!).
5. **Test E — Source Change During Watchdog:**
   - Start initial load on Lesson A (`/references/77/stream`), advance `10s` with `progress` active (`idle` + `ceiling` armed on generation `N`), then `rerender` to Lesson B (`/references/88/stream`) with zero timers resolved on A.
   - Advance past Lesson A's remaining `idle` and `ceiling` timestamps while Lesson B plays or loads cleanly.
   - **Expected:** Old timers from Lesson A are cleared/generation-rejected and never call `HEAD` or renew ticket for `/references/77/` or mutate Lesson B.
6. **Test F — Retry and Unmount Cleanup:**
   - **Subcase 1 (Unmount):** Arm initial idle + ceiling timers with active `progress`, then `unmount()` component and advance timers past `INITIAL_METADATA_MAX_TIMEOUT_MS` -> `0` `HEAD`/`ticket` calls or state updates.
   - **Subcase 2 (Retry):** Exhaust to terminal error, restore network, click Retry (`إعادة المحاولة`), confirm ceiling & idle start fresh for the new `retryNonce` generation and stale ceiling timestamps from pre-error load do not cause instant expiry on Retry.
7. **Test G — Slow Unbuffered Seek After Metadata (Separate `12s` Watchdog Verification):**
   - Document current behavior (`PLAYBACK_STALL_TIMEOUT_MS = 12_000`) separately from Fix 2:
     - Loaded `VideoPlayer` (`duration = 300`, `loadedMetadata` + `playing`).
     - Simulate slow unbuffered seek (`currentTime = 200`, `seeking`, `networkState = 2`, bare `progress` vs `buffered` growth without `seeked`).
     - Verify whether `12_000 ms` triggers recovery (documenting both the untouched `waiting` regression `L214` and the separate seek hypothesis cleanly without conflating with Fix 2).

---

## 8. Race-Condition and Lifecycle Analysis (`CONFIRMED`)

1. **`visibilitychange` Tab Backgrounding (`L589-L622`):**
   - Currently hiding the tab clears the `20s` timer and re-arms a fresh `20s` on return (`L612`).
   - With dual idle + ceiling timers, hiding the tab must **freeze/deduct elapsed ceiling time** (`initialCeilingRemainingMsRef`) and re-arm **both** `initialIdleTimer` and `initialCeilingTimer` with `remainingCeilingMs` on return to `'visible'`. Otherwise, hiding & foregrounding a tab once would reset the absolute ceiling back to zero!
2. **`onLoadStart` Following Ticket Issuance (`L695` → `L1402`):**
   - Both `L695` (`requestProtectedStreamTicket().then(...)`) and `L1402` (`<video onLoadStart>`) call `armWatchdog('initial', false)`.
   - Keeping `initialCeilingDeadlineRef` anchored to the active source/recovery reload lifecycle (initialized if `null` when `armWatchdog('initial', ...)` starts, cleared on `loadedmetadata`, `src`/`retry` change, recovery restart, or error) ensures `onLoadStart` cannot reset the absolute ceiling deadline.
3. **`preserveExisting = true` on `waiting`/`stalled` (`L1433`, `L1438`):**
   - Must **never** reset `initialIdleTimer` or `initialCeilingTimer`! If a stream fires `progress` at `t=5s` and then stalls at `t=8s` (`onStalled` calls `armWatchdog('initial', true)`), `preserveExisting = true` leaves the idle deadline at `t=25s` and ceiling intact.
4. **Concurrent Watchdog Expiry vs `onError` / `onLoadedMetadata`:**
   - Always pass captured `const gen = sourceGenerationRef.current` into both `idle` and `ceiling` timer callbacks, call `clearWatchdog()` immediately on firing, and rely on `triggerRecovery`'s existing guards (`expectedGeneration !== sourceGenerationRef.current`, `isRecoveringRef.current`, `hasErrorRef.current`) to ensure at most one active recovery.
5. **Fix 1, Fix 3, and Fix 4 Preservation:**
   - **Fix 1:** `armWatchdogRef.current` stays synced via `useEffect([armWatchdog])`; stream-ticket `useEffect` dependencies (`[src, retryNonce, isProtectedSource, cancelInFlightRecovery, clearWatchdog, updateRecoveryPhase, failPlayerWithCategory]`) remain completely untouched; `initialPositionRef` untouched.
   - **Fix 3:** `pendingUserSeekDuringRecoveryRef`, `programmaticSeekRef`, `requestSeek`, `handleSeeking`, and `resolveRecoveryResumeTime` remain completely untouched; `initial` watchdog timers terminate before `loadedmetadata` (`hasLoadedMetadataRef === false`), except during recovery reload (`retrying_stream`), where `pendingRecoveryResumeRef` stays completely independent of `clearWatchdog()` / `armWatchdog()`.
   - **Fix 4:** `onPause` terminal guard (`hasErrorRef`, `'error'`, `'ended'`, `video.ended`) remains untouched and continues calling `clearWatchdog()` on genuine pauses.

---

## 9. Potential Regressions and Mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing `video-player-recovery.test.tsx:214` (`waiting` + `progress` must STILL recover in 12s) breaks | High if `onProgress` resets `'playback'` timer | Restrict `onProgress` handling strictly to `watchdogKindRef.current === 'initial' && !hasLoadedMetadataRef.current && media.networkState === HTMLMediaElement.NETWORK_LOADING` (or observed `buffered`/`readyState` increase). Never reset `'playback'` from bare `onProgress`. |
| Infinite hang from `1 B/s` trickle or browser spurious `progress` events | Medium without ceiling | Enforce non-resettable `INITIAL_METADATA_MAX_TIMEOUT_MS` ceiling timer alongside the idle timer. |
| Ceiling resets repeatedly on `onLoadStart` / `visibilitychange` | Medium if `clearWatchdog()` erases ceiling timestamp prematurely | Distinguish `clearWatchdogTimers()` (for tab suspend/timer swap) from `resetInitialCeiling()` (cleared only on `loadedmetadata`, new source/retry, terminal error, unmount, or entering new recovery reload). |
| JSDOM tests where `video.networkState === 0` by default | Certain in unit tests | Gate `onProgress` reset on `media.networkState === 2` (or `buffered` growth / `readyState` growth) and set `networkState: 2` in Phase 3.2D unit tests simulating real Chromium `NETWORK_LOADING` transfers. |
| Changing exported `INITIAL_METADATA_TIMEOUT_MS` breaks imports | Certain if renamed/removed | Keep `export const INITIAL_METADATA_TIMEOUT_MS = 20_000;` (and export `INITIAL_METADATA_MAX_TIMEOUT_MS` cleanly). |

---

## 10. Recommended Minimal Implementation Sequence (Awaiting Approval)

1. **Product Owner Decision:** Confirm `INITIAL_METADATA_MAX_TIMEOUT_MS` (recommended candidate: **`60_000 ms`**, acceptable range `45_000`–`90_000 ms`) and confirm keeping `INITIAL_METADATA_IDLE_TIMEOUT_MS` = `20_000 ms` (`INITIAL_METADATA_TIMEOUT_MS`).
2. **Scoped Edit (`VideoPlayer.tsx` only):**
   - Add `INITIAL_METADATA_MAX_TIMEOUT_MS` constant and refs: `initialCeilingTimerRef`, `initialCeilingStartedAtRef` / `initialCeilingRemainingMsRef`.
   - Update `clearWatchdog`, `armWatchdog`, and `visibilitychange` to manage both initial idle + bounded ceiling timers cleanly.
   - Implement qualified pre-metadata activity handler inside `onProgress` (`L1445`) gated strictly to `watchdogKindRef.current === 'initial' && !hasLoadedMetadataRef.current` with `networkState === 2` or `buffered`/`readyState` progress.
3. **Scoped Tests (`video-player-recovery.test.tsx` only):** Add Tests A–F (and keep Test G documented/verified against `PLAYBACK_STALL_TIMEOUT_MS` behavior) alongside full Phase 3.2A/B/C/D Vitest, ESLint, and `tsc` verification.
4. **Live Chromium Verification (`T3-CUSTOM` re-test at `2000 ms` latency / `~100 kbps`):** Verify `Range: bytes=0-` downloads without premature `20 s` aborts and reaches `readyState >= 1`, plus regression smoke checks for Fix 1, Fix 3, and Fix 4.
