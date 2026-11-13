# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: Domain 19 — Notifications & WhatsApp (`D-08` / `D-09`)

> **Document Title:** Domain 19 — Notifications & WhatsApp Business Rules  
> **Document Identifier:** `METROLMS-DOM-OPS-019`  
> **Document Status:** `DRAFT — PHASE 4 EXECUTION (PENDING OWNER ACCEPTANCE)`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-01`](../../architecture/decision-register.md#d-01), [`D-08`](../../architecture/decision-register.md#d-08), [`D-09`](../../architecture/decision-register.md#d-09), [`D-14`](../../architecture/decision-register.md#d-14), [`D-GRP-07`](../../architecture/decision-register.md#d-grp-07)  
> **Last Updated:** 2026-11-13 (Phase 4 Execution)

---

## 1. Domain Overview & Mission

- **Domain Mission:** Govern user-scoped platform notifications (`NotificationItem`), recipient-only read/mark-all-read ownership, Developer notification isolation (`D-08`), and scenario-based WhatsApp support contact visibility (`whatsappApi`).
- **Domain Boundaries:**
  - *In Scope:* Notification categories & navigation targets, recipient-only `markRead` / `markAllRead`, `D-08` Developer inbox isolation & neutral `'النظام'` actor masking, `D-01` notification deletion on user deletion, and WhatsApp per-user/per-course/public support contact resolution.
  - *Out of Scope:* 7-day approaching-deadline reminder dispatch policy (prototype-only in `LLD-003` §3.3 Step 9, pending formal Owner approval) and unused MSW `GET /api/courses/:courseId/whatsapp-contacts` (`API-REC-02`).
- **Core Entities:** `NotificationItem`, `UserWhatsAppVisibilityConfigDTO`, `PublicSupportContactsResponseDTO` *(all persistence fields remain `PROVISIONAL — OWNER REVIEW REQUIRED`)*.

---

## 2. Formal Invariants & Business Constraints

| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`INV-DOM19-01`** | **Recipient-Exclusive Notification Access** | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, and `POST /api/notifications/mark-all-read` operate strictly on the authenticated session `user.id`, ignoring any spoofed body/query user IDs. | `notificationHandlers.ts` / Django View |
| **`INV-DOM19-02`** | **Developer Notification Isolation (`D-08`)** | Developer-targeted notifications never leave the Developer inbox; notifications sent to non-Developer recipients never name the Developer as actor, substituting `'النظام'`. | Notification Dispatcher |
| **`INV-DOM19-03`** | **WhatsApp Confidentiality & Role Guards (`MFR-39`)** | `GET/PUT /api/admin/users/:userId/whatsapp-visibility` returns uniform `404` when non-developers query/mutate a Developer target, and `403` when `assistant_admin` attempts mutation. | `permissionsHandlers.ts` / `whatsappApi.ts` |
| **`INV-DOM19-04`** | **User Deletion Cleanup (`D-01`)** | Permanently deleting a user permanently removes their personal notifications and WhatsApp visibility assignments. | User Deletion Cascade |

---

## 3. Approved vs. Current Prototype vs. Target Behavior

- **Approved Business Behavior:** `D-08` Developer notification isolation, `D-01` deletion cleanup, `D-09` email collision masking, and recipient-only notification ownership.
- **Current Prototype Behavior:** `notificationsApi.ts`, `notificationHandlers.ts`, `whatsappApi.ts`, `WhatsAppFloatingFab.tsx`, and `permissionsHandlers.ts`. Note: `unread-notification-badge.test.tsx` tests legacy `POST /api/notifications/:id/read` while `notificationsApi.markRead` calls `PATCH`; `GET /api/public/support-contacts` currently has `NO TEST`.
- **Implementation Gap:** Prototype stores notifications and WhatsApp configs in-memory; `PATCH /api/notifications/:id/read` and `GET /api/public/support-contacts` lack direct Vitest tests.
- **Target Backend Behavior:** Django persists notifications per `user_id` with `PATCH /api/notifications/:id/read` canonicalized (excluding legacy `POST` alias per `API-REC-02`) and enforces `D-08` / `MFR-39`.
- **Deferred / Provisional Notice:** Notification and WhatsApp table columns remain **`PROVISIONAL — OWNER REVIEW REQUIRED`**.

---

## 4. Traceability Matrix

| Business Rule / Invariant | Governing Decision | Technical Spec | Verification Evidence (Deferred to Gate B) |
| :--- | :--- | :--- | :--- |
| `INV-DOM19-01`, `INV-DOM19-02` | [`D-08`](../../architecture/decision-register.md#d-08), [`D-14`](../../architecture/decision-register.md#d-14) | [`METROLMS-TECH-DOM-019`](../../03-technical-documentation/domains/operations/domain-19-notifications-and-whatsapp.md) | `unread-notification-badge.test.tsx` (22 specs), `notification-categories-and-action-center.test.tsx` (20 specs), `notification-navigation-and-delivery.test.tsx` (38 specs), `profile-notifications.test.tsx` (13 specs) |
| `INV-DOM19-03` | `MFR-39` | [`METROLMS-TECH-DOM-019`](../../03-technical-documentation/domains/operations/domain-19-notifications-and-whatsapp.md) | `whatsapp-contacts.test.tsx` (39 specs), `assistant-admin-capabilities-audit.test.ts`, `developer-confidentiality.test.tsx` |

