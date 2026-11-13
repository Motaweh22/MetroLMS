# MetroLMS — Defect & Bug Report
## Bug Identifier: `BUG-[DOMAIN]-[NNN]` — [Defect Summary]

> **Document Title:** [Bug Report Title]  
> **Document Identifier:** `METROLMS-BUG-[DOMAIN]-[NNN]`  
> **Document Status:** `[OPEN | IN INVESTIGATION | RESOLVED | VERIFIED | CLOSED]`  
> **Canonical Authority Level:** Level 6 Quality Defect Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Assigned Engineers, Lead Architect, QA Team  
> **Governing Decisions:** Relevant Level 1 Decisions  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Defect Classification
- **Severity:** `[Critical (P0) | High (P1) | Medium (P2) | Low (P3)]`
- **Subsystem:** `[Frontend UI | API Service | Database | Security / Auth]`
- **Affected Environment:** `[Development | Staging | Production]`

## 2. Description & Impact
- **Observed Behavior:** [Precise explanation of the incorrect behavior or invariant breach].
- **Expected Behavior:** [What should occur per authoritative specification].
- **Business Impact:** [Effect on training operations, compliance, or user experience].

## 3. Steps to Reproduce
1. Log in as user `[Role / Username]`.
2. Navigate to surface `[URL / Route]`.
3. Trigger action `[Button click / API call]`.
4. Observe error `[Error banner / HTTP code]`.

## 4. Diagnostic Evidence & Stack Trace
```text
[Insert browser console error, server traceback, or network payload]
```

## 5. Root Cause Analysis (RCA) & Remediation Plan
- **Root Cause:** [Technical explanation of the defect mechanism].
- **Proposed Fix:** [Code changes, schema updates, or test additions required].
- **Regression Test Added:** [Link to newly authored test case].
