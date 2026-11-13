# MetroLMS — Frontend Checklists Index (`docs/frontend/checklists/`)

> **Document Status:** `ACTIVE — AUTHORITATIVE (CHECKLISTS DIRECTORY INDEX)`
> **Canonical Role:** Indexes all **20 checklist files** in `docs/frontend/checklists/`, separating **Pre-Backend Remediation Phase 2–5 & Living Master Plan Checklists** from **Historical Increment 5–11 Feature Checklists**, and explicitly disambiguating `phase-5-implementation-plan.md` vs. `phase-05-developer-preview-and-isolated-testing-checklist.md`.
> **Last Updated:** 2026-11-11 (`T-2.4.2` Owner Accepted; `T-2.4.3` Implemented)

---

## 1. Important Naming Disambiguation (`phase-5` vs. `phase-05`)

Two similarly named files in this directory belong to **different tracks**:

1. **[`phase-05-developer-preview-and-isolated-testing-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md)** (`ACTIVE — IN PROGRESS AT WP-5.4.5`):
   - **Track:** Pre-Backend Migration Remediation Roadmap — **Phase 5** (`MFR-25`, `MFR-40`, `D-10`: `/design-system` 404 guard, Visual Role Preview, Isolated Role Test Sessions, and `S7` `sessionEpoch` invalidation).
2. **[`phase-5-implementation-plan.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-5-implementation-plan.md)** (`FROZEN — HISTORICAL INCREMENT 11 SUBPHASE 5`):
   - **Track:** Frontend Core **Increment 11 — Subphase 5** (Comment Moderation & Course Performance Analytics, completed during Increment 11).

---

## 2. Pre-Backend Migration Remediation & Living Master Plan Checklists (9 Files)

| Checklist File | Remediation Phase | MFRs Covered | Status |
| :--- | :--- | :--- | :---: |
| [`phase-02-role-architecture-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-02-role-architecture-checklist.md) | **Remediation Phase 2** (Increments 2.1–2.4) | `MFR-37, 38, 39, 45` (6-tier roles, `INV-R1`–`INV-R8`, 11 confidentiality surfaces, `import.meta.env.DEV`) | `COMPLETED & FROZEN` |
| [`phase-03-assistant-admin-visibility-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-03-assistant-admin-visibility-checklist.md) | **Remediation Phase 3** (Increments 3.1–3.4) | `MFR-03, 05, 06, 08, 16, 17, 21, 29, 30` (`Rule A` read visibility, `D-14` audit read, group-scoped writes, route guards) | `COMPLETED & FROZEN` |
| [`phase-04-approval-lifecycle-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-04-approval-lifecycle-checklist.md) | **Remediation Phase 4** (Increments 4.1–4.3) | `MFR-09, 31, 35, 36, 44` (`PendingApprovalRequest`, `INV-R9`, `INV-R10`, `202 Accepted` UI, dual audit attribution) | `COMPLETED & FROZEN` |
| [`phase-05-developer-preview-and-isolated-testing-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md) | **Remediation Phase 5** (Increments 5.1–5.4) | `MFR-25, 40`, `D-10`, `Decision C (S8 -> S7)` | `COMPLETED & ACCEPTED (CP-002)` |
| [`t-2-3-1-published-course-versions-and-diffing-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/t-2-3-1-published-course-versions-and-diffing-checklist.md) | **Living Master Plan Phase 2 / WP-2.3 / T-2.3.1** | `MFR-10`, `Rule B` (`PublishedCourseVersion` snapshots, substantive vs. metadata `ChapterItem` diffing, unsealed vs. sealed attempt reconciliation) | `IMPLEMENTED — VERIFICATION PENDING (GATE B)` |
| [`t-2-3-2-authoritative-progress-rounding-and-version-scoped-certificates-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/t-2-3-2-authoritative-progress-rounding-and-version-scoped-certificates-checklist.md) | **Living Master Plan Phase 2 / WP-2.3 / T-2.3.2** | `MFR-09`, `MFR-46`, `D-12`, `D-13` (Authoritative `Math.round` clamping `[0, 100]` with `99%` cap, `computeAttemptProgress`, and version-scoped `CertificateRecord` issuance) | `COMPLETED & ACCEPTED (CP-007)` |
| [`t-2-4-1-post-deadline-access-enforcement-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/t-2-4-1-post-deadline-access-enforcement-checklist.md) | **Living Master Plan Phase 2 / WP-2.4 / T-2.4.1** | `MFR-23`, `MFR-42` (`resolveCourseAccess` domain resolver, `full > review_only > none` precedence, zero completed-trainee exemption under `'hide'`, `403 COURSE_ACCESS_EXPIRED`, and `403 COURSE_ACCESS_REVIEW_ONLY`) | `OWNER ACCEPTED (IMPLEMENTED — VERIFICATION PENDING / GATE B)` |
| [`t-2-4-2-seven-surface-enforcement-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/t-2-4-2-seven-surface-enforcement-checklist.md) | **Living Master Plan Phase 2 / WP-2.4 / T-2.4.2** | `MFR-23`, `MFR-42` (Seven-surface post-deadline enforcement across My Courses, Dashboard, Group Details, Player, Read API, Mutation APIs, and Certificate Issuance; Scenarios A, B, C cross-mutation isolation) | `OWNER ACCEPTED (IMPLEMENTED — VERIFICATION PENDING / GATE B)` |
| [`t-2-4-3-phase-2-test-suites-and-player-regressions-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/t-2-4-3-phase-2-test-suites-and-player-regressions-checklist.md) | **Living Master Plan Phase 2 / WP-2.4 / T-2.4.3** | `MFR-23`, `MFR-42`, `D-06`, `D-07`, `D-12`, `D-13` (Phase 2 mounted DOM tests, MSW HTTP routes, video seek-restriction feedback recovery, review-only activity sync elimination, and Phase 2 Gate B consolidation) | `IMPLEMENTED — VERIFICATION PENDING (GATE B)` |

---

## 3. Historical Feature Increment 5–11 Checklists (11 Files — `FROZEN — HISTORICAL`)

All 11 checklists below were completed during **Frontend Feature Increments 5 through 11** (`1,174` passing baseline tests) and are preserved as frozen historical records:

1. [`increment-05-enrollment-verification.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/increment-05-enrollment-verification.md) — Increment 5 Enrollment verification
2. [`increment-06-learning-player-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/increment-06-learning-player-checklist.md) — Increment 6 Learning Player verification
3. [`increment-07-dashboard-groups-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/increment-07-dashboard-groups-checklist.md) — Increment 7 Dashboard & Groups verification
4. [`increment-08-course-builder-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/increment-08-course-builder-checklist.md) — Increment 8 Course Builder verification
5. [`increment-09-course-review-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/increment-09-course-review-checklist.md) — Increment 9 Course Review verification
6. [`increment-10-manual-acceptance-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/increment-10-manual-acceptance-checklist.md) — Increment 10 Manual Acceptance verification
7. [`increment-10-training-groups-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/increment-10-training-groups-checklist.md) — Increment 10 Training Groups verification
8. [`messaging-and-transient-feedback-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/messaging-and-transient-feedback-checklist.md) — Messaging & Toast Feedback verification
9. [`shared-ui-icon-text-alignment-checklist.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/shared-ui-icon-text-alignment-checklist.md) — Shared UI Icon & RTL Text Alignment verification
10. [`whatsapp-contact-visibility-plan.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/whatsapp-contact-visibility-plan.md) — WhatsApp Contact Visibility & Nudge verification
11. [`phase-5-implementation-plan.md`](file:///d:/LMS%20MEtro%20Project/docs/frontend/checklists/phase-5-implementation-plan.md) — Increment 11 Subphase 5 (Comment Moderation & Course Performance)
