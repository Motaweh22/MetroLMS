# MetroLMS — Architecture Decision Record (ADR)
## ADR Identifier: `ADR-003` — Frontend Security, DOMPurify & XSS Hardening

> **Document Title:** Frontend Security Architecture, DOMPurify Sanitization & Role Hardening  
> **Document Identifier:** `METROLMS-ADR-CORE-003`  
> **Document Status:** `ACCEPTED`  
> **Canonical Authority Level:** Level 2 Architecture Decision Record  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Enterprise Architecture Review Board & Project Owner  
> **Governing Decisions:** [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** 2026-11-12 (Phase 1 Baseline Authoring)

---

## 1. Context & Problem Statement
MetroLMS renders rich multimedia curriculum content, instructor feedback, discussion notes, and administrative announcements. Unsanitized rendering of rich HTML or markdown content creates significant Cross-Site Scripting (XSS) risks. Additionally, role boundaries must remain impermeable across all 6 platform roles.

## 2. Decision Drivers
- **XSS Prevention:** Complete neutralization of malicious script injections in rendered markup.
- **Role Invariance:** Guaranteed enforcement of authorization ceilings (`INV-R1` through `INV-R10`).
- **Auditability:** Systematic logging of administrative mutations and permission resolutions.

## 3. Considered Options
- **Option 1: Unsanitized React `dangerouslySetInnerHTML`:** Native React HTML injection.
- **Option 2: Mandatory DOMPurify Sanitization Wrapper + Strict CSP (Chosen):** Centralized sanitization.
- **Option 3: Markdown-Only Text without Rich Formatting:** Plain text restriction.

## 4. Decision Outcome
- **Chosen Option:** **Option 2 (DOMPurify Sanitization Wrapper + Strict CSP)**.
- **Governing Authority:** Level 1 Owner Decision [`D-SEC-01`](../../architecture/decision-register.md#d-sec-01).

## 5. Pros and Cons of the Options
### Option 2 (DOMPurify + CSP — Chosen)
- **Positive:** Strips dangerous tags (`<script>`, `<iframe>`, `javascript:`, inline event handlers).
- **Positive:** Permits legitimate pedagogical formatting (tables, bold, lists, math expressions KaTeX).
- **Positive:** CSP `Report-Only` provides defense-in-depth telemetry without breaking UI execution.

## 6. Implementation Notes & Consequences
- All rendered HTML markup must route through a centralized DOMPurify sanitization utility.
- Content Security Policy (CSP) headers deployed with strict origin restrictions; `unsafe-eval` prohibited.
- 3-layer permission engine enforces role invariants `INV-R1` through `INV-R10`.
