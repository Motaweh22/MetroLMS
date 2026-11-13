# MetroLMS — Technical Domain Specification
## Subsystem / Domain: Domain 19 — Notifications & WhatsApp (`D-08` / `D-09`)

> **Document Title:** Technical Domain Specification — Notifications & WhatsApp  
> **Document Identifier:** `METROLMS-TECH-DOM-019`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 5 Technical Implementation Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Backend Engineers, Frontend Engineers, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../../architecture/decision-register.md#d-01), [`D-08`](../../../architecture/decision-register.md#d-08), [`D-09`](../../../architecture/decision-register.md#d-09), [`D-14`](../../../architecture/decision-register.md#d-14)  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Responsibilities & Component Boundaries

- **Frontend / Prototype Components:** `notificationsApi.ts` (`GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`), `notificationHandlers.ts`, `whatsappApi.ts` (`GET/PUT /api/admin/users/:userId/whatsapp-visibility`, `GET /api/public/support-contacts`), `WhatsAppFloatingFab.tsx`.
- **Target Backend Components (Django 5 + DRF — Proposed):** User-scoped notification service + WhatsApp scenario visibility service.

---

## 2. Domain Interactions & Lifecycle Behavior

1. **Notification Ownership & `D-08` Masking:**
   - Queries and mark-read mutations filter strictly by authenticated `request.user.id`.
   - Developer actors are masked as `'النظام'` for non-Developer recipients (`D-08`); Developer-targeted notifications stay isolated in the Developer inbox.
2. **Route Canonicalization (`API-REC-02`):**
   - Canonical single-read route is `PATCH /api/notifications/:id/read` (MSW legacy `POST /api/notifications/:id/read` and unused `GET /api/courses/:courseId/whatsapp-contacts` are proposed for exclusion from Django).
3. **Pagination (`API-REC-05A` Technical Proposal):** `GET /api/notifications` is classified `PAGINATION REQUIRED`.

---

## 3. Validation, Authorization & Failure Scenarios

- **Test Coverage Gaps:** `PATCH /api/notifications/:id/read` (tests currently hit legacy `POST` alias) and `GET /api/public/support-contacts` currently have `NO TEST`.
- **Provisional Persistence Notice:** Notification and WhatsApp visibility columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`** until Phase 5.

---

## 4. Verification Hooks & Traceability

- **Business Rules:** [`METROLMS-DOM-OPS-019`](../../../01-requirements/domains/domain-19-notifications-and-whatsapp.md)
- **Verification Evidence:** `unread-notification-badge.test.tsx` (22 specs), `notification-categories-and-action-center.test.tsx` (20 specs), `notification-navigation-and-delivery.test.tsx` (38 specs), `whatsapp-contacts.test.tsx` (39 specs) (deferred to Gate B).

