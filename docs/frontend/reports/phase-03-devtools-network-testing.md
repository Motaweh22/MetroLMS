# MetroLMS — Phase 3: DevTools Network Stress & Recovery Testing Report

> **Overall Execution Status:** `EXECUTED — 12 OF 12 SCENARIOS COMPLETED IN CHROME 158 (8 VIA CHROME_DEVTOOLS MCP + 4 VIA ISOLATED NODE 24 CDP)`
> **Date:** 2026-11-27
> **Policy Compliance:** Strictly read-only on application source code, backend, authentication, CSRF, media, and deployment configuration. Zero source files modified; all prior uncommitted work preserved. Zero session cookies, CSRF tokens, stream tickets (`?st=`), authorization headers, WebSocket debugger URLs, or passwords are exposed in this report.

---

## 1. Browser and Environment Details

| Component | Status | Verified Details |
|---|---|---|
| Browser / UA | Live | Chrome `158.0.0.0` (`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36`) |
| Frontend Server | Running | Vite production preview (`0.0.0.0:4173`, `node` PID `5892`), serving `frontend/dist/index.html` built at `2026-11-27 17:50:53` (post-Phase 2.1.1) and proxying `/api` to `http://127.0.0.1:8000` |
| Backend Server | Running | Django + Waitress (`127.0.0.1:8000`, `server: waitress`) |
| Test Isolation | Clean | Scenarios 1–3, 5–8, 10 ran via `chrome_devtools` MCP in an isolated context (`isolatedContext=phase3-test`); scenarios 4 & 9 (`T3-CUSTOM`, `T3-BLK-*`) ran via Node `v24.18.0` CDP (`Network.emulateNetworkConditions`, `Network.setBlockedURLs`, `Fetch.enable`) in dedicated isolated temp-profile Chrome instances cleaned up on exit. Personal tabs & profile were left untouched. |
| Disposable Test Accounts Used | Verified | Seeded trainee account `01000000006` (enrolled mode) and seeded developer account `01000000001` (Preview Mode `وضع المعاينة`, unrestricted seeking & unlocked lessons) |
| Target Course & Media | Verified | Learning Player `/courses/10015/learn` & `/courses/10015/learn/46` (Course `10015`): Video A `/api/media/references/53/stream` (and trainee ref `/api/media/references/60/stream`, `video/mp4`, `41,803,581` bytes / ~39.87 MiB, `441.46s`); Video B `/api/media/references/54/stream` (`video/mp4`, `12,286,536` bytes, `99.27s`) |

---

## 2. Tests Actually Executed & Summary by Classification

| Classification | Count | Test IDs |
|---|---:|---|
| **Verified PASS** | `10` | `T3-FAST3G`, `T3-SLOW3G`, `T3-OFF-PLAY`, `T3-OFF-INIT`, `T3-OFF-SEEK`, `T3-OFF-REC` *(with minor phase-label defect noted)*, `T3-BLK-STREAM`, `T3-BLK-TICKET`, `T3-BLK-HEAD`, `T3-RACE` |
| **Verified FAIL / Mixed Defect** | `2` | `T3-NORM` *(Preview Mode **PASS**, **Trainee Mode FAIL** due to `activity` post triggering repeated `stream-ticket` re-fetch & playback reset)*; `T3-CUSTOM` *(bounded watchdogs functioned without hang/crash, **FAIL** on initial metadata completion under 100 kbps + 2000ms latency due to 20s watchdog restarting active `Range: bytes=0-` fetch)* |
| **INCONCLUSIVE** | `0` | *None* |
| **NOT TESTED** | `0` | *None — all 12 planned scenarios executed* |

---

## 3. Network Profiles Used

1. **Normal Network (No Throttling):** Unthrottled loopback connection (`localhost:4173` → `127.0.0.1:8000`).
2. **Fast 3G:** `chrome_devtools` MCP preset `emulate` `networkConditions: "Fast 3G"`.
3. **Slow 3G:** `chrome_devtools` MCP preset `emulate` `networkConditions: "Slow 3G"`, toggled dynamically back to Online/unthrottled mid-buffering/recovery.
4. **Custom High-Latency / Low-Bandwidth (CDP):** Node `v24.18.0` CDP `Network.emulateNetworkConditions({ offline: false, latency: 2000, downloadThroughput: 12500, uploadThroughput: 10000 })` (~100 kbps down / ~80 kbps up / 2000ms latency).
5. **Offline:** `chrome_devtools` MCP preset `emulate` `networkConditions: "Offline"`, toggled before open, during playback, during seek, and mid-recovery.
6. **Request Blocking (CDP):** Node `v24.18.0` CDP `Network.setBlockedURLs` (`BLOCKED:inspector` / `net::ERR_BLOCKED_BY_CLIENT` equivalent) and method-selective `Fetch.enable` (`Fetch.failRequest`).

---

## 4. Scenario Results Matrix

| Test ID | Network profile | Scenario | Expected behavior | Actual behavior | Recovery result | Network evidence (sanitized) | Console evidence | Result |
|---|---|---|---|---|---|---|---|---|
| `T3-NORM` | Normal | Play continuously, forward/backward seeks, pause/resume | Progressive `206` chunk streaming without full-file download; smooth seek, pause, resume; zero errors | **Preview Mode (`01000000001`):** Continuous play (`t=5.09s`, `readyState=4`), seeks `150s`→`320s`→`30s`, pause/resume succeeded.<br>**Trainee Mode (`01000000006`):** Anti-skip clamped `150s` seek to `~44s`, and periodic `POST /api/courses/10015/items/52/activity [200]` triggered repeated `POST /api/media/stream-ticket` calls, rotating `?st=`, resetting buffer (`buffered=[[0,4.84]]`), and pausing playback (`paused=true`). | Not applicable | Preview Mode: `POST /api/media/stream-ticket` (`200`); `GET /api/media/references/53/stream?st=[REDACTED]` with `Range: bytes=0-`, `1048576-`, `12189696-`, `33423360-`, `2359296-` all returned `206`, `Accept-Ranges: bytes`, `Content-Length: 4194304` (4 MiB bounded chunks of `41803581`), `Cache-Control: no-store`. Superseded chunk reads aborted (`net::ERR_ABORTED`) on seek.<br>Trainee Mode: `POST /api/courses/10015/items/52/activity [200]` followed by 11 `POST /api/media/stream-ticket` calls (8 `net::ERR_ABORTED`, 3 `200`). | Preview Mode: zero console messages.<br>Initial `/login` unauthenticated `401` on `/api/auth/me` only. | **FAIL (Trainee Mode) / PASS (Preview Mode)** |
| `T3-FAST3G` | Fast 3G | Reload `/courses/10015/learn`, play, seek forward `120s` & backward `20s` | Metadata loads; buffering phase displays during unbuffered seek and returns to `playing` | Metadata ready (`duration=441.46s`, `readyState=4`); played (`t=4.95s`); seek `120s` entered `phase="buffering"` (`readyState=1`) then returned to `phase="playing"` within 6s (`t=125.32s`, `readyState=4`); backward seek `20s` played smoothly (`t=22.86s`). | Not applicable | `POST /api/media/stream-ticket` (`200`); `GET /api/media/references/53/stream?st=[REDACTED]` `206` (`bytes 0-4194303/41803581`, `bytes 8749056-12943359/41803581`, `bytes 1507328-5701631/41803581`, `4194304` bytes each). | `<no console messages found>` | **PASS** |
| `T3-SLOW3G` | Slow 3G → Normal | Open/play under Slow 3G, seek `200s`, switch to No throttling mid-buffering/recovery | Handles slow buffering; triggers stall recovery if needed; resumes playback cleanly when throttling clears | Metadata ready at `11,769ms` (`readyState=3`); played to `2.11s`; sought `200s` (`200.03s`→`202.57s`), stalled in `phase="buffering"` (`t=204.24s`). After switching to Normal, watchdog ran `HEAD` + `stream-ticket`, rotated ticket, and recovered within 4s (`phase="playing"`, `t=208.11s`, `readyState=4`). | **Recovered** | `POST /api/media/stream-ticket` (`200`); `GET` `206` x2; recovery `HEAD /api/media/references/53/stream?st=[REDACTED]` (`200`, `Content-Length: 41803581`); `POST /api/media/stream-ticket` (`200`); old stream `net::ERR_ABORTED`; new `GET` `206` + seek `206`. | `<no console messages found>` | **PASS** |
| `T3-CUSTOM` | Custom CDP (`2000ms` latency, `12.5 KB/s` down / `10 KB/s` up) | Initial load, metadata loading, playback/autoplay check, and seek (`180s`) during slow loading | Metadata loads or bounded watchdog handles high-latency/low-throughput loading predictably | SPA loaded `/courses/10015` in `2617.9ms` (`ttfb 2019.5ms`); `stream-ticket` resolved in `2042.6ms`; `<video>` mounted at `18,452ms` (`src` active at `21,476ms`, `phase="loading_metadata"`). Initial `Range: bytes=0-` received `206` (`ttfb 2036.6ms`), **but** at ~20s (`durationMs: 24,487ms`), `INITIAL_METADATA_TIMEOUT_MS` fired (`HEAD` `200`, `stream-ticket` `200`), aborted the active `bytes=0-` transfer (`net::ERR_ABORTED`), and restarted from `bytes=0-` (`retrying_stream`). Over another 24s after seeking to `180s`, `readyState` stayed `0` (`metadataAtMs: null`, `playableAtMs: null`); programmatic `play()` rejected with Chrome autoplay `NotAllowedError` prior to user interaction. | Partial (`retrying_stream` restarted `bytes=0-` cleanly without error crash, but prevented metadata completion at 100 kbps) | `GET /api/courses/10015` (`200`, `2617.9ms`), `POST /api/media/stream-ticket` (`200`, `2042.6ms`), `GET /api/media/references/53/stream?st=[REDACTED]` (`Range: bytes=0-`, `206`, `ttfb 2036.6ms`, aborted at `24,487ms` via `net::ERR_ABORTED`), recovery `HEAD` (`200`, `2181.4ms`, `Content-Length: 41803581`), `POST /api/media/stream-ticket` (`200`, `2279.4ms`), restarted `GET /stream` (`Range: bytes=0-`, `206`, `pending: true`). | Zero console errors or uncaught JS exceptions. | **FAIL (Initial 100 kbps metadata aborted/restarted at 20s)** |
| `T3-OFF-PLAY` | Normal → Offline → Normal | Play near buffer edge (`38s`), switch Offline, wait for buffer exhaustion + stall watchdog, restore Online + Retry | Stall watchdog triggers probes and exits cleanly to `network` error state; Online + Retry resumes playback | Buffer exhausted at `t=72.78s` (`phase="buffering"`); after ~8s transitioned to `phase="error"`, `data-error-category="network"`, alert `"تعذر الاتصال بالخادم"` with `"إعادة المحاولة"`. Restoring Online kept error card until Retry; clicking Retry resumed playback (`readyState=4`, `t=1.45s`, Preview Mode reset to `0`). | **Recovered** *(via Retry button)* | Offline: stream `GET` requests, recovery `HEAD`, and `POST /api/media/stream-ticket` failed with `net::ERR_INTERNET_DISCONNECTED`. Online Retry: `POST /api/media/stream-ticket` (`200`), `GET` (`206` x2). | Expected `Failed to load resource: net::ERR_INTERNET_DISCONNECTED`; no uncaught exceptions. | **PASS** |
| `T3-OFF-INIT` | Offline → Normal | Set Offline before clicking Lesson 2 (`/courses/10015/learn/46`), test offline Retry, then Online + Retry | No hanging spinner; exits to `network` error cleanly; Retry succeeds once Online | Immediately (`ms=0`) rendered `phase="error"`, `data-error-category="network"`, `"تعذر الاتصال بالخادم"`, `hasVideo=false`. Offline Retry returned to error within 1.5s. Online + Retry loaded Lesson 2 (`duration=99.27s`, `readyState=4`, `phase="playing"`). | **Recovered** | Offline open + offline Retry: `POST /api/media/stream-ticket` → `net::ERR_INTERNET_DISCONNECTED`. Online Retry: `POST /api/media/stream-ticket` (`200`), `GET /api/media/references/54/stream?st=[REDACTED]` (`206` x2). | Expected `net::ERR_INTERNET_DISCONNECTED`; no uncaught exceptions. | **PASS** |
| `T3-OFF-SEEK` | Online → Offline → Online | Play online (`t=1.45s`), switch Offline, seek to unbuffered `t=350s`, wait for watchdog, restore Online + Retry | Seeking unbuffered range offline triggers stall watchdog (~12s) and exits to `network` error; Online + Retry recovers | `0ms`: `t=350s`, `readyState=1`; `2006ms..10022ms`: `phase="buffering"`, `networkState=2`; `12024ms`: `phase="error"`, `data-error-category="network"`, `"تعذر الاتصال بالخادم"`. Online + Retry restored playback (`readyState=4`, `phase="playing"`). | **Recovered** | Offline seek/watchdog: 17 `GET` stream attempts, `HEAD`, and `stream-ticket` failed with `net::ERR_INTERNET_DISCONNECTED`. Online Retry: `stream-ticket` (`200`), `GET` (`206`). | Expected `net::ERR_INTERNET_DISCONNECTED`; no uncaught exceptions. | **PASS** |
| `T3-OFF-REC` | Slow 3G → Offline mid-recovery → Online | Catch `phase="renewing_ticket"` (`t=311.61s`), toggle Offline mid-recovery, observe transition, restore Online + Retry | Clean failure to `network` error without hanging or looping; Online + Retry recovers | In-flight `stream-ticket` (`200`) briefly returned player to `buffering` (`t=309.06s`), then subsequent offline failures rendered error card (`data-error-category="network"`, `hasVideo=false`). **Anomaly:** `[data-recovery-phase]` reported `"paused"` while error alert was displayed. Online + Retry restored `playing`. | **Recovered** *(via Retry)* | `HEAD` (`200`) → `stream-ticket` (`200`) before Offline took effect; then 17 `GET /stream?st=[REDACTED]`, `HEAD`, and 1 Blob attempt `GET /api/media/references/53/stream` (with header `x-metrolms-stream: 1`, no `?st=`) all failed `net::ERR_INTERNET_DISCONNECTED`. Online Retry recovered `200` + `206`. | Expected `net::ERR_INTERNET_DISCONNECTED`; no uncaught exceptions. | **PASS** *(minor `data-recovery-phase="paused"` mismatch noted)* |
| `T3-BLK-STREAM` | CDP Request Blocking (Stream) | (3A) `Network.setBlockedURLs` on `*/api/media/references/*/stream*` (blocks both `GET` & `HEAD`); (3B) `Fetch.enable` blocking `GET` only (`HEAD` returns `200`). Unblock + click Retry. | Honest `network` failure classification without false auth error; no hang; recovers after unblock | **(3A):** Ticket (`200`), `<video>` `GET` blocked (`BLOCKED:inspector`), `HEAD` blocked (`BLOCKED:inspector`), ticket renewed (`200`), second `GET`/`HEAD` blocked, Blob `GET` (`X-MetroLMS-Stream: 1`) blocked → exited cleanly at `1000ms` to `phase="error"`, `data-error-category="network"`, `"تعذر الاتصال بالخادم"`. Unblock + Retry recovered `readyState=4`, `duration=441.46s`, `buffered=[[0,4.84]]`.<br>**(3B):** `GET` failed (`net::ERR_FAILED`), `HEAD` returned `200` (`41803581`), ticket renewed (`200`), second `GET` failed, second `HEAD` `200`, Blob `GET` triggered & failed (`net::ERR_FAILED`, `3.2ms`) → exited at `1000ms` to `network` error. Unblock + Retry recovered `readyState=4`, `buffered=[[0,13.19]]`. | **Recovered** *(via Retry)* | (3A): `stream-ticket` `200` (x2), `GET /stream` (`BLOCKED:inspector`), `HEAD /stream` (`BLOCKED:inspector`), Blob `GET /stream` (`hasStreamHeader=true`, `BLOCKED:inspector`). Retry: `stream-ticket` `200`, `GET` `206`.<br>(3B): `HEAD` `200` (x2, `41803581`), `stream-ticket` `200` (x2), `Media GET` `net::ERR_FAILED` (x2), Blob `GET` `net::ERR_FAILED`. | (3A): Zero console errors.<br>(3B): Expected `Failed to load resource: net::ERR_FAILED` x3. | **PASS** |
| `T3-BLK-TICKET` | CDP Request Blocking (Ticket) | `Network.setBlockedURLs` on `*/api/media/stream-ticket*` on `/courses/10015/learn/46`, then unblock + click Retry | Honest `network` error (not false `auth` expiry); no uncontrolled Blob fallback; Retry recovers | Immediately transitioned to `phase="error"`, `data-error-category="network"`, `hasVideo=false`, `"تعذر الاتصال بالخادم"`, `hasRetryBtn=true`. Zero auth errors and zero Blob fallback calls. Unblock + Retry loaded Lesson 2 (`references/54/stream?st=[REDACTED]`, `206`, `readyState=4`, `duration=99.27s`, `buffered=[[0,6.35]]`). | **Recovered** *(via Retry)* | Blocked: `POST /api/media/stream-ticket` → `BLOCKED:inspector` (`0.1ms`).<br>Retry: `POST /api/media/stream-ticket` → `200` (`43.3ms`), `GET /api/media/references/54/stream?st=[REDACTED]` → `206` (`bytes 0-4194303/12286536`). | Zero console errors. | **PASS** |
| `T3-BLK-HEAD` | CDP Request Blocking (`HEAD`) | (4A) Seek to `260s`, fail 1 `Media GET` (`ConnectionReset`) while `HEAD` is blocked.<br>(4B) Fail initial ticket's `Media GET` while `HEAD` is blocked (`Fetch.failRequest`), letting renewed ticket pass. | Chrome/player handles transient error cleanly; blocked `HEAD` in recovery classifies safely & allows `renewing_ticket` recovery without mutex corruption or false `auth` | **(4A):** Chrome `<video>` natively retried `Range: bytes=24477696-` (`206`) automatically after `ConnectionReset`, so `triggerRecovery` / `HEAD` was not needed.<br>**(4B):** Initial `Media GET` failed (`net::ERR_FAILED`) → `triggerRecovery` fired `HEAD`, which failed (`net::ERR_FAILED`, `headBlockedCount=1`) → classified as `network` (`canRenewTicket=true`), transitioned to `phase="renewing_ticket"` (`1200ms`, `POST /stream-ticket` `200`) → renewed `Media GET` returned `206`, reaching `readyState=1` (`1500ms`) → `readyState=4` (`2100ms`, `errorCategory=null`). | **Recovered** | (4A): `GET` `net::ERR_CONNECTION_RESET` (`2.4ms`) → auto-retried `GET` `206` (`bytes 24477696-28671999/41803581`).<br>(4B): `stream-ticket` (`200`) → `Media GET` (`net::ERR_FAILED`) → `HEAD` (`net::ERR_FAILED`) → `stream-ticket` (`200`) → `Media GET` (`206`). | Expected `net::ERR_CONNECTION_RESET` (4A) / `net::ERR_FAILED` (4B) only; zero uncaught JS exceptions. | **PASS** |
| `T3-RACE` | Slow 3G → Normal | (1) Trigger recovery on Video A (`renewing_ticket`), switch to Video B before Video A settles.<br>(2) Seek `100s` + `pause()` on Video A during `renewing_ticket`, then restore Normal network. | Stale Video A result ignored; Video B keeps `references/54`; pause respected; no duplicate loops; clean state | **(1) A→B switch:** Brief `srcRedacted=null` (`500..2000ms`) while Video B ticket loaded, then locked onto `references/54/stream?st=[REDACTED]` (`2500..8000ms`, `isBlob=false`). Stale Video A ticket (`200`, `reqid=542`) did NOT overwrite Video B or spawn `references/53` requests.<br>**(2) Seek+Pause mid-recovery:** Settled as `paused=true`, `phase="paused"`, `readyState=4`, `errCat=null`; `currentTime` settled at pre-stall `200s` (overriding mid-recovery `100s` seek). | **Recovered** | (1) `HEAD` ref 53 (`200`) → `stream-ticket` ref 53 (`200`, discarded) → `stream-ticket` ref 54 (`200`) → `GET` ref 54 (`206`).<br>(2) `HEAD` ref 53 (`200`) → `stream-ticket` (`200`) → old stream `net::ERR_ABORTED` → new `GET` ref 53 (`206` x2). | Expected `net::ERR_INTERNET_DISCONNECTED` during initial offline setup only; zero JS exceptions or React warnings. | **PASS** |

---

## 5. Relevant Request/Response Observations

1. **Progressive Streaming Confirmed (No Full-File Pre-Download):**
   - Protected media streams always issued `POST /api/media/stream-ticket` → `200`, followed by `<video>` `GET /api/media/references/<id>/stream?st=[REDACTED]` with browser `Range: bytes=<offset>-`.
   - Waitress returned `206 Partial Content` with `Accept-Ranges: bytes`, `Cache-Control: no-store`, `Content-Range: bytes <start>-<end>/41803581`, and bounded **4 MiB** chunks (`Content-Length: 4194304`).
   - Seeking cancelled superseded chunks with browser `net::ERR_ABORTED` and opened new `Range` `206` requests cleanly.
2. **Blob Fallback Activation:**
   - Across normal, throttled, and offline tests, `<video>.src` never switched to a `blob:` URL (because direct `HEAD`/ticket paths either succeeded with `206` progressive streaming or failed `Offline`).
   - In `T3-OFF-REC` (`Offline`) and `T3-BLK-STREAM` (Subcases 3A & 3B), after renewed stream `GET` attempts failed, the player triggered the last-resort Blob fallback (`GET /api/media/references/53/stream` with header `X-MetroLMS-Stream: 1`, without `?st=`), which failed cleanly with `net::ERR_INTERNET_DISCONNECTED` / `BLOCKED:inspector` / `net::ERR_FAILED` rather than creating a broken URL.
3. **Critical Request Defect (`T3-NORM` Trainee Mode):**
   - In Trainee Enrolled Mode (`01000000006`), `POST /api/courses/10015/items/52/activity [200]` coincided with/triggered **11** `POST /api/media/stream-ticket` requests (`8` `net::ERR_ABORTED`, `3` `200`), causing `?st=[REDACTED]` URL rotation, buffer eviction (`buffered=[[0,4.84]]`), and unintended `paused=true`.
4. **Slow High-Latency Initial Metadata Reset (`T3-CUSTOM`):**
   - At `2000ms` latency + `12.5 KB/s` (`~100 kbps`), `Range: bytes=0-` received `206` (`ttfbMs: 2036.6ms`), but `INITIAL_METADATA_TIMEOUT_MS` (`20s`) aborted the in-progress initial download (`durationMs: 24,487ms`, `net::ERR_ABORTED`) and restarted from `bytes=0-`, preventing initial metadata (`readyState >= 1`) from completing within the observation window (`33s` initial + `24s` after seek).

---

## 6. Console Errors and Player Errors

- **JavaScript Exceptions / React Warnings:** Zero uncaught JS exceptions or React warnings observed across all **12** executed tests.
- **Expected Chromium Network Logs:**
  - `Failed to load resource: net::ERR_INTERNET_DISCONNECTED` appeared strictly during `Offline` tests (`T3-OFF-PLAY`, `T3-OFF-INIT`, `T3-OFF-SEEK`, `T3-OFF-REC`, `T3-RACE` setup).
  - `net::ERR_FAILED` / `net::ERR_CONNECTION_RESET` appeared only during intentional CDP `Fetch.failRequest` blocks (`T3-BLK-STREAM` 3B, `T3-BLK-HEAD`).
  - `NotAllowedError: play() failed because the user didn't interact with the document first` occurred during automated CDP `v.play()` in `T3-CUSTOM` (Chrome autoplay policy without gesture when `readyState === 0`).
- **Player Error States Observed:** Bounded watchdog, offline, and blocked-request cases consistently rendered `data-error-category="network"` with `"تعذر الاتصال بالخادم"` and working `"إعادة المحاولة"` recovery button. Zero false `"auth"`/`401`/`403` error classifications occurred.
- **Minor UI Attribute Defect Observed:** In `T3-OFF-REC`, after transitioning to the terminal error card (`data-error-category="network"`, `hasVideo=false`), `data-recovery-phase` read `"paused"` instead of `"error"`.

---

## 7. Recovery Behavior

- **Stall Watchdog (~12s) & Offline Detection:** Triggered reliably during offline buffering/seeking (`T3-OFF-SEEK`: error UI at `12,024ms`; `T3-OFF-PLAY`: ~8s after buffer exhaustion; `T3-OFF-INIT`: immediate `0ms`). No infinite loading/spinner state occurred.
- **Request Blocking Recovery (`T3-BLK-*`):**
  - Blocking `/api/media/stream-ticket` exited immediately to `network` error without Blob fallback and recovered cleanly on Retry (`200` + `206`).
  - Blocking `/stream` (`3A` URL-level and `3B` `GET`-only) boundedly ran `HEAD` → single ticket renewal → single Blob attempt → `network` error within `~1000ms` and recovered on Retry.
  - Blocking `HEAD` (`T3-BLK-HEAD` 4B) safely classified diagnosis as `'network'` (`canRenewTicket=true`) and recovered playback via `renewing_ticket` (`readyState=4`).
- **Slow 3G Auto-Recovery:** Under `Slow 3G`→`Normal` (`T3-SLOW3G`), `HEAD` diagnosis + `POST /api/media/stream-ticket` renewal automatically recovered playback within ~4s (`phase="playing"`).
- **Concurrency & Race Safety (`T3-RACE`):** Switching Lesson 1 → Lesson 2 mid-recovery discarded the stale in-flight `stream-ticket` response without overwriting `references/54` or creating duplicate recovery loops. Pausing during `renewing_ticket` preserved user pause intent (`paused=true`).

---

## 8. Failed and Inconclusive Tests

- **Verified FAIL (2):**
  1. `T3-NORM` under **Trainee Enrolled Mode (`01000000006`)** — periodic `POST /api/courses/10015/items/52/activity [200]` triggered repeated `POST /api/media/stream-ticket` re-fetches (`8` `net::ERR_ABORTED`, `3` `200`), resetting `<video>` buffering and pausing playback. *(Preview Mode streaming mechanics passed.)*
  2. `T3-CUSTOM` (`2000ms` latency, `~100 kbps` throughput) — `INITIAL_METADATA_TIMEOUT_MS` (`20s`) aborted an actively downloading initial `Range: bytes=0-` `206` chunk (`24,487ms`) before `readyState >= 1` and restarted from `bytes=0-`, preventing metadata load completion within `57s` under continuous ~100 kbps throttling.
- **INCONCLUSIVE:** None (`0`).
- **NOT TESTED:** None (`0` — all `12` Phase 3 scenarios executed).

---

## 9. Known Limitations

1. **Blob Size-Cap Overflow Not Exercised Live:** Because online progressive `206` streams succeeded and blocked `GET` fallback requests failed immediately before headers (`net::ERR_FAILED`/`BLOCKED:inspector`), live >250 MiB response-body cancellation in Chrome remains verified by Phase 2.1.1 Vitest unit tests rather than an artificial >250 MiB HTTP mock response in Chrome.
2. **What Single-Machine DevTools / CDP Testing Cannot Prove:**
   - Cross-device connectivity.
   - Wi-Fi to mobile-data handover.
   - Different router, NAT, firewall, or ISP behavior.
   - Actual mobile browser behavior (iOS Safari / Android Chrome media pipelines).
   - Waitress behavior under multiple real slow clients.
   - Server worker/thread starvation under concurrent real connections.
   - End-to-end network behavior outside the browser's local connection.

---

## 10. Recommended Next Investigation Steps

1. **Fix Trainee `activity` → `stream-ticket` Re-Fetch Bug (High Priority — Observed in `T3-NORM`):**
   - Inspect why `POST /api/courses/:id/items/:itemId/activity` completion in enrolled Trainee mode triggers `VideoPlayer` / `LearningPlayerPage` re-render or `src`/effect re-execution causing repeated `POST /api/media/stream-ticket` calls, `?st=` rotation, buffer loss, and pause.
2. **Review `INITIAL_METADATA_TIMEOUT_MS` (`20s`) Behavior on Very Slow (`~100 kbps`) Progressive Connections (`T3-CUSTOM`):**
   - Check why `triggerRecovery` restarts `Range: bytes=0-` at `20s` even while `<video>` `networkState === 2` (`NETWORK_LOADING`) is actively downloading initial bytes on a verified `200` `HEAD` stream.
3. **Inspect `data-recovery-phase="paused"` Mismatch on Error Card Teardown (`Minor` — `T3-OFF-REC`):**
   - Check why `<video>` `onPause` during error teardown updates `recoveryPhase` from `'error'` back to `'paused'` in `VideoPlayer.tsx` when `[role="alert"]` is displayed, and whether restoring `currentTime` after Retry from terminal error should preserve last position rather than resetting to `0` (`T3-OFF-PLAY`).
4. **Proceed to Real-Device & Multi-Client Waitress Testing:**
   - Test on separate mobile/desktop devices over real Wi-Fi/cellular networks against Waitress (`:8000`) to evaluate worker starvation, disconnects, and cross-device playback.

---

## 11. Final Decision Gate

- **A — Recovery behaves as expected under tested Chrome DevTools / CDP conditions?** **Partially:** Bounded failure detection, `Offline`, `Fast 3G`, `Slow 3G`, `A→B` race, pause preservation, and all 3 request-blocking profiles (`T3-BLK-STREAM`, `T3-BLK-TICKET`, `T3-BLK-HEAD`) recovered or failed cleanly (`10` PASS), **while `T3-CUSTOM` (`100 kbps + 2000ms` latency) aborted/restarted initial `bytes=0-` metadata download at `20s`**.
- **B — Additional frontend defects were observed?** **YES (2 Defects Observed):**
  1. Trainee Enrolled Mode (`T3-NORM`): `POST /api/courses/10015/items/52/activity [200]` triggered repeated `POST /api/media/stream-ticket` calls (`net::ERR_ABORTED` + `200`), rotating `?st=`, resetting `<video>` buffers, and pausing playback.
  2. Very low-bandwidth (`~100 kbps`) initial metadata load (`T3-CUSTOM`): `20s` metadata watchdog restarted active `bytes=0-` chunk before `readyState >= 1`. *(Plus minor `data-recovery-phase="paused"` label on error card teardown in `T3-OFF-REC`.)*
  *(No implementation fixes were made during Phase 3.)*
- **C — Remaining problem requires real-device/network testing?** **YES.**
- **D — Remaining problem may require backend/Waitress streaming investigation?** **YES** (multi-client slow Waitress concurrency & real network disconnects cannot be validated by single-machine DevTools/CDP).

> **Conclusion:** The original cross-device video streaming issue is **NOT** claimed resolved solely from Chrome DevTools/CDP testing. Both the observed frontend defects (`B`) and real-device/Waitress testing (`C`, `D`) require follow-up.

---

## 12. Phase 3.2B.1 — Live Chromium Verification of Terminal State Guard (Post-Phase 3.2A & 3.2B)

> **Execution Date:** 2026-11-27 (`20:54`–`20:58`)
> **Served Build Under Test:** `npx vite build --mode staging --emptyOutDir false` (`EXIT 0`, built `2026-11-27 20:54:22`) serving `/assets/ab2862f8.js` → `/assets/0cacfd5a.js` via `vite preview` (`http://localhost:4173`) against Waitress/Django (`127.0.0.1:8000`, `config.settings.development`).
> **Compiled Bundle Guard Confirmation:** Verified directly in `frontend/dist/assets/0cacfd5a.js` (`onPause:()=>{fe.current||J.current==="error"||J.current==="ended"||n.current?.ended||...`) and confirmed via Chrome `performance.getEntriesByType('resource')` that `/assets/0cacfd5a.js` was loaded live.

### 12.1 Phase 3.2B.1 Verification Summary

| Scenario | Profile / Mode | Key Observations (Sanitized) | Result |
|---|---|---|---|
| **Source Integrity & Build Verification** | Staging build (`--emptyOutDir false`) | `BUILD_EXIT=0` (`30.23s`), `dist/index.html` points to `/assets/ab2862f8.js`, chunk `0cacfd5a.js` contains compiled `onPause` terminal-state guard; preview (`:4173`) serves live bundle. | **PASS** |
| **Fix 1 Regression Smoke Test** | Trainee Enrolled (`01000000006`, `/courses/10015/learn`, `13s` at `1x`) | `1` initial `POST /api/media/stream-ticket` (`200`, `481.4ms`); `2` `POST /api/courses/10015/items/52/activity` (`200`, `lastPositionSeconds` `3` and `8`); `0` extra tickets; `sameEl: true`, `sameExactSrc: true`, `paused: false`, `phase="playing"`, `currentTime` `0.03s → 11.45s`; `0` failures/console errors. | **PASS** |
| **Genuine User Pause Control** | Trainee Enrolled (`01000000006`, UI click `إيقاف مؤقت` + `14s` hold) | Immediately transitioned to `phase="paused"`, `paused: true`, `currentTime: 11.45`. Held `14s` (`> 12s` stall watchdog) with `0` recovery `HEAD`/`stream-ticket` probes and unchanged `currentTime: 11.45`. Clicking `تشغيل` resumed playback (`paused: false`, `phase="playing"`, `13.11s`). | **PASS** |
| **Terminal Error Teardown (Real Browser Teardown)** | Trainee Enrolled (`01000000006`, buffer drain while CDP `Offline`, then Online Retry) | `phaseTransitions`: `loading_metadata` (`0ms`) → `playing` (`22ms`) → `buffering` (`12,567ms`) → `diagnosing` (`24,570ms`) → `renewing_ticket` (`24,572ms`) → `error` (`24,574ms`, `<video>` removed at `24,574ms`). Real Chromium emitted native `pause` at `24,576ms` (`videoConnected: false`, `ended: false`, `phaseAtEvent: "error"`). `[data-recovery-phase]` remained `"error"` immediately and after `2s` settle with `data-error-category="network"` and Retry visible. Restoring Online and clicking `"إعادة المحاولة"` minted `1` ticket (`200`, `99.2ms`) and resumed playback (`readyState: 4`, `paused: false`, `phase="playing"`, `currentTime: 199s → 201.29s`). | **PASS** |
| **Ended State & Replay** | Preview Mode (`01000000001`, short Lesson 2 `/courses/10015/learn/46`, `99.27s`) | Played naturally from `97.27s` to `99.27s`. Chromium emitted native `pause` (`ended: true`, `2917ms`) and `ended` (`2917ms`); `phase` transitioned to `"ended"` (`2919ms`) and remained `"ended"` after `1.5s` settle. Clicking `"تشغيل الفيديو"` reset `currentTime` to `0`, cleared `ended`, and resumed `phase="playing"` (`2.46s`). | **PASS** |

> **Scope Note:** Ended-and-Replay verification used Preview Mode (`01000000001`) on Lesson 2 (`99.27s`) so seeking to `duration - 2s` before natural end was permitted without altering trainee progress or forward-seek locking rules. Prior Phase 3 `T3-CUSTOM` (`100 kbps + 2000ms` latency) remains out of scope for Phase 3.2B/3.2B.1 (Fix 2 not started).

---

## 13. Phase 3.2C.1 — Live Chromium Verification of Latest User Seek During Recovery

> **Execution Date:** 2026-11-27 (`21:17`–`21:38`)
> **Served Build Under Test:** `npx vite build --mode staging --emptyOutDir false` (`EXIT 0`, built `2026-11-27 21:17:10`) serving `/assets/4abe2c16.js` → `/assets/a875ae11.js` via `vite preview` (`http://localhost:4173`) against Waitress/Django (`127.0.0.1:8000`, `config.settings.development`).
> **Compiled Bundle Confirmation:** Verified in `frontend/dist/assets/a875ae11.js` (`1e3&&Math.abs(r-o.time)<.5`) and confirmed via Chrome `performance.getEntriesByType('resource')` that `/assets/4abe2c16.js` and `/assets/a875ae11.js` were loaded live.
> **Method Note:** Scrubber interactions used real CDP `Input.dispatchMouseEvent` hardware pointer clicks at `[role="slider"]` coordinates after hovering `.custom-video-container`; recovery `renewing_ticket` states were held open deterministically via CDP `Fetch.enable` on `*/api/media/stream-ticket*` (`failRequest` on superseded `GET /stream` chunk + held renewal ticket).

### 13.1 Phase 3.2C.1 Verification Summary

| Scenario | Profile / Account | Observed Timing, Requests & Final State | Result |
|---|---|---|---|
| **Source Review & Build Parity (Sections 1–2)** | Staging build (`--emptyOutDir false`) | `BUILD_EXIT=0` (`35.80s`), `dist/index.html` points to `/assets/4abe2c16.js`, Chrome loaded `/assets/a875ae11.js` containing compiled Phase 3.2C logic; zero source/test edits. | **PASS** |
| **Main 200s → 100s Scrubber Seek During Recovery (Section 3)** | Preview Mode (`01000000001`, `/courses/10015/learn`) | Playback at `200.55s` entered `phase="renewing_ticket"` (`243.8s`) with renewal ticket held. Real mouse click on scrubber at `100s` set UI to `01:39 / 07:21` (`99.98s`). Releasing renewal ticket (`1` `POST /stream-ticket` `200`, `706.9ms`) settled at **`99.99s`** (`readyState=4`, `phase="playing"`) and advanced to **`101.48s`** after `1.5s` (never reverted to `200s`/`243.8s`). | **PASS** |
| **Multiple Seeks: 100s then 150s (Section 4)** | Preview Mode (`01000000001`) | Entered `renewing_ticket` from `200.54s` (`243.78s`). Clicked scrubber at `100s` (`99.98s`), then `150s` (`149.70s`, `02:29 / 07:21`) before ticket resolution. Releasing ticket (`1` `POST /stream-ticket` `200`, `995.6ms`) settled at **`149.81s`** and played to **`151.32s`**. | **PASS** |
| **Trainee Clamp During Recovery (Section 5)** | Trainee Enrolled (`01000000006`) | Entered `renewing_ticket` at `54.19s` (`furthestWidthPct="12.2742%"`). Real click at `320s` triggered `hasClampBadge=true` and clamped to **`54.19s`**. After releasing ticket, player resumed at **`54.19s`** (`post1000ms: 54.57s`, never bypassed to `320s`). | **PASS** |
| **Preview Unrestricted Seek (Section 6)** | Preview Mode (`01000000001`) | Entered `renewing_ticket` from `100.56s` (`117.23s`). Real click at `330s` (beyond trainee boundary) showed `hasClampBadge=false` (`329.45s`). Released ticket (`1` request, `497.2ms`) → settled at **`329.55s`** (`post1200ms: 330.75s`). | **PASS** |
| **Programmatic Seek Filter & 1000ms Window (Section 7)** | Preview (`01000000001`) & Trainee (`01000000006`) | **Verified PASS:** (a) No-seek recovery after `220.21s` (`255.13s`) restored `255.23s`; (b) `ArrowLeft` followed `150ms` later (`< 1000ms`) by real scrubber click at `75s` during recovery settled at **`74.85s`** (`01:14 / 07:21`) without being swallowed; (c) Source switch (`Section 9`) and clamp correction (`Section 5`) created zero false overrides.<br>**INCONCLUSIVE Sub-Checks:** (i) Fresh Trainee load hydrated from `0s` (`hydratedInit < 10s`), so recovery immediately after non-zero (`>10s`) backend `initialPosition` hydration was not isolated live cleanly; (ii) Post-replay Lesson 2 (`blob:` fully buffered) had no unbuffered chunk fetch (`phaseReached: null`); (iii) Direct external DOM `video.currentTime` mutation (bypassing `requestSeek`) within both `1000ms` AND `0.5s` of an unconsumed programmatic target remains filtered by design in `handleSeeking`. | **PASS (Core) / INCONCLUSIVE (3 Edge Sub-Checks)** |
| **Pause During Recovery (Section 8)** | Preview Mode (`01000000001`) | During `renewing_ticket` (`241.22s`), clicked scrubber at `120s` (`119.65s`), then clicked real Pause button (`إيقاف مؤقت`). After releasing ticket (`200`, `904.7ms`) and waiting `2s`: `currentTime=119.65s`, `paused=true`, `phase="paused"`, `playCallsAfterPause=0`. | **PASS** |
| **Source Change During Recovery (Section 9)** | Preview Mode (`01000000001`, Video A → Video B) | During Video A (`refs/53`) `renewing_ticket` (`241.22s`), scrubbed to `140s` (`139.87s`), then clicked Lesson 2 (`بسبسبسب1:39`). Stale Video A ticket aborted (`Invalid InterceptionId`); Lesson 2 (`/courses/10015/learn/46`, `99.27s`) opened cleanly at **`0s`** (`00:00 / 01:39`) with zero Video A timestamp leak (`src` ended in `blob:` fallback after Video A stream error transition). | **PASS** |
| **Fix 1 Regression Smoke (Section 10A)** | Trainee Enrolled (`01000000006`, `12s` at `1x`) | `1` initial `POST /api/media/stream-ticket` (`200`, `95.4ms`), `2` `POST /api/courses/10015/items/52/activity` (`200`, `lastPositionSeconds` `4` and `9`), `0` extra tickets, `paused=false`, `phase="playing"`, `currentTime: 0 → 11.51s`, `0` failed requests/console errors. | **PASS** |
| **Fix 4 Error Teardown, Ended & Replay (Section 10B)** | Trainee (`01000000006`) & Preview (`01000000001`) | **Error teardown:** Offline recovery captured native `pause` (`videoConnected: false`, `phaseAtPause: "error"`); `phase` stayed `"error"` after `1.5s` with `errorCategory="network"`; Retry recovered `readyState=4`.<br>**Ended & Replay:** Lesson 2 ended naturally at `99.27s` (`phase="ended"` stayed after `1s` settle); Replay resumed cleanly from `0s` (`1.67s`, `phase="playing"`). | **PASS** |
