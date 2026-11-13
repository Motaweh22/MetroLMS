# MetroLMS — Non-Functional Requirements Specification (NFR)
## System / Subsystem: [System / Subsystem Name]

> **Document Title:** [NFR Title]  
> **Document Identifier:** `METROLMS-NFR-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 4 System Engineering Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architects, DevOps, SRE & Security Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Performance & Latency Budgets
| Metric | Target SLA | 95th Percentile | Measurement Methodology |
| :--- | :--- | :--- | :--- |
| **API Response Time (Read)** | <= 150 ms | <= 300 ms | Server-side APM metrics |
| **API Response Time (Write)**| <= 250 ms | <= 500 ms | Server-side APM metrics |
| **Course Player Video Init** | <= 1.5 s | <= 3.0 s | Client Real User Monitoring (RUM) |
| **Client Bundle First Load** | <= 1.0 s | <= 2.0 s | Lighthouse on 4G network |

## 2. Concurrency & Scalability
- **Peak Concurrent Active Trainees:** [e.g., 5,000 simultaneous active users].
- **Concurrent Video Stream Sessions:** Direct client CDN/storage streaming (`D-MEDIA-01`).
- **Database Connection Pool Sizing:** [pyodbc / SQL Server connection pool parameters].

## 3. Security, Privacy & Compliance
- **Session Protection:** Secure, HttpOnly, SameSite cookies (`D-AUTH-01`).
- **CSRF Defense:** Strict double-submit or cookie-based CSRF protection on mutation routes.
- **Data Protection:** Encryption in transit (TLS 1.3), encryption at rest (SQL Server TDE).
- **Audit Compliance:** Immutable audit trail for all administrative and grading mutations.

## 4. Availability, Reliability & Disaster Recovery
- **Target Uptime:** 99.9% availability during operational training hours.
- **Recovery Point Objective (RPO):** <= 1 hour (Automated SQL Server log backups).
- **Recovery Time Objective (RTO):** <= 4 hours.

## 5. Browser Compatibility & Accessibility
- **Supported Browsers:** Modern evergreen browsers (Chrome 120+, Edge 120+, Firefox 120+, Safari 17+).
- **Accessibility Standard:** WCAG 2.1 Level AA conformance, screen reader support, keyboard navigability.
