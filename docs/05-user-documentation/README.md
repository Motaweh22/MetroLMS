# MetroLMS — User Documentation Hub (`docs/05-user-documentation`)

> **Document Title:** User Documentation Hub Navigation Portal  
> **Document Identifier:** `METROLMS-USER-HUB-000`  
> **Document Status:** `ACTIVE — AUTHORITATIVE`  
> **Canonical Authority Level:** Level 5 User Documentation Hub  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Trainees, Instructors, Supervisors, System Administrators & Support Teams  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), Decision D6 (Role-Based Manuals Catalog)  
> **Last Updated:** 2026-11-12 (Phase 0 Documentation Hub Scaffolding)

---

## 1. Purpose & Scope

The `docs/05-user-documentation/` directory hosts all end-user manuals, role-based workflows, onboarding guides, and self-service incident triage documentation for the MetroLMS platform.

---

## 2. Directory Structure & Subsystems

```text
docs/05-user-documentation/
├── README.md                      # This Navigation Hub
├── getting-started/               # Cross-role platform onboarding, login, navigation basics
├── trainee-guide/                 # Trainee Manual (Courses, player, groups, certificates)
├── instructor-guide/              # Lecturer & Instructor Manual (Course creation, review, grading)
├── supervisor-guide/              # Assistant Admin & Supervisor Manual (Group monitoring, renewals)
├── admin-guide/                   # System Administrator Manual (User management, system settings)
└── faq-and-troubleshooting/       # Self-Service Help & Operational Incident Triage
```

> [!NOTE]
> During Phase 0 scaffolding (Option A), empty leaf directories are tracked and preserved in Git via `.gitkeep` placeholders. Formal user manuals will be authored in Phase 8 under the approved weekly effort allocation.

---

## 3. Subsystem Breakdown and Templates

All user guides authored within this category must strictly conform to the approved templates in [`docs/_templates/`](../_templates/README.md):

| Subdirectory | Target Deliverable Type | Mandatory Template |
| :--- | :--- | :--- |
| `getting-started/` | Platform Onboarding Guide | [`UserManual-template.md`](../_templates/UserManual-template.md) |
| `trainee-guide/` | Trainee User Manual | [`UserManual-template.md`](../_templates/UserManual-template.md) |
| `instructor-guide/` | Instructor User Manual | [`UserManual-template.md`](../_templates/UserManual-template.md) |
| `supervisor-guide/` | Supervisor User Manual | [`UserManual-template.md`](../_templates/UserManual-template.md) |
| `admin-guide/` | Administrator User Manual | [`UserManual-template.md`](../_templates/UserManual-template.md) |
| `faq-and-troubleshooting/`| Self-Service Incident Triage | [`UserManual-template.md`](../_templates/UserManual-template.md), [`SOP-template.md`](../_templates/SOP-template.md) |
