# MetroLMS — Operational Runbook
## Subsystem / Incident: [Subsystem Name / Incident Scenario]

> **Document Title:** [Runbook Title]  
> **Document Identifier:** `METROLMS-RUN-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 5 Operations & Maintenance Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** SREs, On-Call Engineers, Operations Support  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Runbook Mission & Triggers
- **Incident / Scenario:** [e.g., SQL Server connection pool exhaustion, session storm].
- **Trigger Alerts:** Prometheus alert `DBConnectionExhaustion` or PagerDuty page.
- **Severity Level:** `P1 (Critical) / P2 (Major)`

## 2. Immediate Diagnostic Steps
1. Inspect running backend workers: `systemctl status metrolms-backend`.
2. Check database active sessions:
   ```sql
   SELECT session_id, status, blocking_session_id, wait_type 
   FROM sys.dm_exec_requests 
   WHERE session_id > 50;
   ```
3. Check error log telemetry for exception spikes.

## 3. Mitigation & Remediation Procedures
- **Procedure A (Worker Recycle):** `sudo systemctl reload metrolms-backend`
- **Procedure B (Connection Kill):** Terminate orphaned blocking session in SQL Server.
- **Procedure C (Failover):** Initiate secondary database cluster failover.

## 4. Post-Incident Review & Prevention
- Capture logs and metrics for post-mortem analysis.
- Log issue in Master Risk Register (`RiskRegister-template.md`).
