# MetroLMS — Operations & Maintenance Hub (`docs/06-operations-and-maintenance`)

> **Document Title:** Operations & Maintenance Hub Navigation Portal  
> **Document Identifier:** `METROLMS-OPS-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 5 Operations & Maintenance Specification Hub  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** DevOps Engineers, System Administrators, Site Reliability Engineers & Infrastructure Teams  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01), [`D-MEDIA-01`](../architecture/decision-register.md#d-media-01)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Purpose & Scope

The `docs/06-operations-and-maintenance/` directory contains all operational runbooks, environment bootstrap guides, production deployment procedures, telemetry standards, and standard operating procedures (SOPs) for the MetroLMS platform.

---

## 2. Directory Structure & Subsystems

```text
docs/06-operations-and-maintenance/
├── README.md                      # This Navigation Hub
├── environment-setup/             # Developer, staging, and container environment setup
├── deployment/                    # Production deployment procedures (WSGI, systemd, web servers)
├── runbooks/                      # Operational runbooks for incident response and maintenance
├── monitoring-and-alerting/       # Telemetry, logging, metrics, health checks, alerts
└── sop/                           # Standard Operating Procedures (User offboarding, secrets rotation)
```

> [!NOTE]
> During Phase 0 scaffolding (Option A), empty leaf directories are tracked and preserved in Git via `.gitkeep` placeholders. Formal operational runbooks will be authored in Phase 7 under the approved execution roadmap.

---

## 3. Subsystem Breakdown and Templates

All operational documents authored within this category must strictly conform to the approved templates in [`docs/_templates/`](../_templates/README.md):

| Subdirectory | Target Deliverable Type | Mandatory Template |
| :--- | :--- | :--- |
| `environment-setup/` | Environment Setup Guides | [`DeploymentGuide-template.md`](../_templates/DeploymentGuide-template.md) |
| `deployment/` | Production Deployment Guides | [`DeploymentGuide-template.md`](../_templates/DeploymentGuide-template.md) |
| `runbooks/` | Operational Runbooks | [`OperationalRunbook-template.md`](../_templates/OperationalRunbook-template.md) |
| `monitoring-and-alerting/`| Telemetry & Monitoring Standards| [`OperationalRunbook-template.md`](../_templates/OperationalRunbook-template.md) |
| `sop/` | Standard Operating Procedures | [`SOP-template.md`](../_templates/SOP-template.md) |
