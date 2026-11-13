# MetroLMS — Non-Functional Requirements Specification (NFR)
## Subsystem / Scope: Performance, Concurrency, Availability & Security

> **Document Title:** Non-Functional Requirements Specification & Engineering Benchmarks  
> **Document Identifier:** `METROLMS-SRS-NFR-002`  
> **Document Status:** `ACTIVE — AUTHORITATIVE BASELINE (WITH QUALIFIED TARGETS)`  
> **Canonical Authority Level:** Level 4 Requirements Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architects, DevOps Engineers, SREs, Security Officers  
> **Governing Decisions:** [`D-AUTH-01`](../../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Important Governance Notice on Non-Functional Targets

> [!IMPORTANT]
> **PROPOSED PLANNING TARGETS — PENDING VALIDATION AND OWNER APPROVAL (`D3`):**  
> All performance latency figures, concurrency sizing estimates, availability SLAs, and recovery benchmarks detailed in this specification are **formal engineering planning targets**.  
> In accordance with REV6 Section 12.J and Section 12.M (Decision 8), these values serve as design sizing goals for architecture and load testing. They do **not** represent legally binding contractual commitments until empirically validated through runtime load testing and formally ratified by the Project Owner in Phase 7.

---

## 2. Performance & Latency Budgets (Proposed Planning Targets)

| Transaction Category | Target (90th Percentile) | Target (95th Percentile) | Measurement Point | Validation Status |
| :--- | :---: | :---: | :--- | :--- |
| **Read Operations (Uncached API)** | <= 150 ms | <= 250 ms | Server gateway edge | *Proposed Benchmark* |
| **Write Operations (Transactional)**| <= 250 ms | <= 400 ms | Server gateway edge | *Proposed Benchmark* |
| **Session Bootstrap (`GET /api/me`)**| <= 100 ms | <= 200 ms | Server gateway edge | *Proposed Benchmark* |
| **Video Playback Initial Buffering**| <= 1.5 s | <= 3.0 s | Client player runtime | *Proposed Benchmark (`D-MEDIA-01`)* |
| **Initial SPA Bundle Download** | <= 1.0 s | <= 2.0 s | Client over 10 Mbps intranet | *Proposed Benchmark* |

---

## 3. Concurrency & Capacity Sizing (Proposed Planning Targets)

1. **Active Concurrent Learners:** Architecture sized to support a proposed target of **5,000 active concurrent learners** during peak shift changeover hours.
2. **Concurrent Media Streams:** Video streaming throughput is decoupled from the Django application server tier (`D-MEDIA-01`). Enterprise media storage/CDN handles concurrent byte delivery directly.
3. **Database Connection Pool:** Sized to maintain steady-state connection pooling via `pyodbc` without connection exhaustion under peak read traffic.

---

## 4. Availability, Reliability & Disaster Recovery (Proposed Planning Targets)

| Dimension | Proposed Planning Target | Operational Assumptions |
| :--- | :--- | :--- |
| **Service Availability** | 99.9% uptime during training hours | Scheduled maintenance windows excluded; redundant web/app nodes. |
| **Recovery Point Objective (RPO)** | <= 15 minutes | Automated incremental SQL Server transaction log backups (`D-DB-01`). |
| **Recovery Time Objective (RTO)** | <= 2 hours | Documented secondary standby node bootstrap runbook. |

---

## 5. Security & Authorization Invariants (Approved Mandatory Baseline)

Unlike performance benchmarks, security invariants are **mandatory and fully approved**:

1. **Session Protection (`D-AUTH-01`):**
   - Session identifiers transmitted exclusively via `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
   - Zero storage of auth tokens in browser Web Storage or client-side JavaScript accessible memory.
2. **CSRF Mitigation:**
   - Double-submit or cookie-synchronized `X-CSRFToken` verification required on all state-mutating HTTP methods.
3. **Cross-Site Scripting (XSS) Prevention (`D-SEC-01`):**
   - Mandatory DOMPurify HTML sanitization wrapper applied to all rendered user-generated and rich-text markup.
   - Strict Content Security Policy (`CSP`) deployed in `Report-Only` mode during staging; zero `unsafe-eval`.
4. **Role Boundary Enforcement (`INV-R1` through `INV-R10`):**
   - Role ceiling enforcement across all 6 roles; zero unauthorized mutation capabilities.
   - Developer Role Switcher / Preview Bar strictly disabled and tree-shaken in production builds.

---

## 6. Browser Compatibility & Environmental Standards

- **Supported Web Browsers:** Evergreen modern browsers (Chrome 120+, Microsoft Edge 120+, Mozilla Firefox 120+, Safari 17+). *(Provisional baseline; final ratification deferred to Phase 7)*.
- **Display & Resolution:** Responsive layouts supporting desktop (1920x1080, 1366x768), tablet (1024x768), and mobile (375x812+).
- **Accessibility:** WCAG 2.1 Level AA target compliance, keyboard navigation for lesson player and quiz forms.
