# MetroLMS — Notification Center Navigation & Missing Notification Delivery Implementation Report

**Document ID:** `REPORT-NOTIF-03`  
**Status:** IMPLEMENTED & AUDITED — READY FOR REVIEW  
**Test Status:** `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`  
**Phase Context:** Pre-Phase 5 Targeted UX & Delivery Remediation  

---

## Executive Summary

This report documents the targeted enhancements to the **Role-Aware Notification Center** in MetroLMS:
1. **Arrow Navigation & Scrollbar Elimination:** Replaced the horizontal native scrollbar with compact, accessible left/right navigation arrows that automatically detect overflow, handle RTL direction smoothly, disable at boundaries, and auto-scroll active category tabs.
2. **Comment-Report Notification Delivery Fix:** Resolved the missing comment-report delivery path by introducing the explicit `comment_reported` notification type, linking authoritative metadata (`commentId`, `courseId`), routing to authorized moderators (`admin`, `assistant_admin`, assigned course instructors), placing items into the `content_review` category, and establishing authoritative unresolved action lifecycle.
3. **Group-Related Event Notification Matrix:** Remediated missing and incomplete group notifications (membership removals, meeting cancellations/updates, cycle course assignments) with strict recipient scoping to prevent broadcast spam.
4. **Dedicated System Audit & Security Category (`الرقابة والأمان`):** Introduced a sovereign notification category for authorized administrative oversight roles (`admin`, `assistant_admin`, `super_admin`, `developer`), filtering for high-impact security and governance events with strict `INV-R8` Developer identity confidentiality and deduplication.
5. **No Test Runners Executed:** In strict compliance with operational directives, zero test runners (`vitest`, `npm test`, `tsc`, `eslint`, `vite build`) were run. All 30 authored tests are deferred to Phase 13.
6. **Phase 5 Not Started:** Phase 5 Planning and implementation have not commenced.

---

## 1. Arrow Navigation Implementation & Responsive RTL Behavior

### Viewport & DOM Architecture
In [`frontend/src/pages/NotificationsPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/NotificationsPage.tsx#L188-L255), the visible category tab list has been refactored from a raw scroll container into a controlled navigation viewport:
- **Hidden Native Scrollbar:** Styled with `[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden` to remove scrollbars cleanly across Firefox, Safari, Chrome, and Edge.
- **Dynamic Overflow Detection:** Uses `updateScrollButtons` observing `container.scrollWidth` and `container.clientWidth`. When categories fit without overflow (e.g. Trainee view with 3 tabs), both arrows are hidden from the DOM.
- **RTL Navigation Semantics:** In the RTL layout (`dir="rtl"`), the visual right button (`chevronRight`) scrolls toward the start/previous categories (positive scroll delta), while the visual left button (`chevronLeft`) scrolls toward the overflowing next categories (negative scroll delta).
- **Boundary Latching:** When at the right edge, `canScrollRight` is false $\rightarrow$ right button is disabled with `opacity-30 cursor-not-allowed` and `aria-disabled="true"`. When at the leftmost boundary, `canScrollLeft` is false $\rightarrow$ left button is disabled.
- **Active Tab Auto-Scroll:** When `effectiveCategory` changes, the active tab element is queried and scrolled smoothly into view via `activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })`.
- **Keyboard & Accessibility:** Arrow buttons are semantic `<button type="button">` elements with Arabic accessible labels: `aria-label="التمرير إلى اليمين"` and `aria-label="التمرير إلى اليسار"`.

---

## 2. Existing Comment-Report Event Source & Notification Delivery Fix

### Defect Root Cause Analysis
Prior to remediation, `inMemoryStore.reportComment` logged an audit event and generated a notification using `type: 'general_alert'` with no `commentId` metadata:
1. `getNotificationCategory` did not map `general_alert` to Content Review (it fell into `system`).
2. `computeNotificationActionRequired` had no handling for comment reports, causing `actionRequired` to evaluate to `false`.
3. When reports were dismissed (`ignoreCommentReport`) or deleted (`deleteComment`), `emitNotificationsChanged` was not called, causing stale notification counts.

### Remediated Flow
1. **Explicit Notification Type:** Introduced `type: 'comment_reported'` in [`frontend/src/core/notifications/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/notifications/types.ts#L12) and [`NotificationItem`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/notifications/types.ts#L36).
2. **Authoritative Delivery in Store:**
   ```typescript
   // inMemoryStore.ts reportComment
   for (const adminId of this.getActiveAdminRecipientIds({ excludeUserId: actor.id })) {
     this.createNotification({
       userId: adminId,
       type: 'comment_reported',
       title: 'بلاغ جديد عن تعليق للمراجعة',
       message: `تم الإبلاغ عن تعليق في المقرر "${course.title}" بسبب (${comment.reportReasonLabelAr}) بواسطة ${reporterName}.`,
       courseId: course.id,
       commentId: comment.id,
       targetUrl: '/admin/comment-moderation',
       dedupeKey: `comment_report:${comment.id}:${adminId}`,
       createdAt: comment.reportedAt,
     });
   }
   for (const recipientId of this.getCourseInstructorRecipientIds(course, { excludeUserId: actor.id })) {
     this.createNotification({
       userId: recipientId,
       type: 'comment_reported',
       title: 'تم الإبلاغ عن تعليق في مقررك التدريبي',
       message: `تم الإبلاغ عن تعليق في المقرر "${course.title}" بسبب (${comment.reportReasonLabelAr}).`,
       courseId: course.id,
       commentId: comment.id,
       targetUrl: `/courses/${course.id}`,
       dedupeKey: `comment_report:${comment.id}:${resolveCanonicalUserId(recipientId)}`,
       createdAt: comment.reportedAt,
     });
   }
   ```
3. **Category Placement:** Mapped to `content_review` ("مراجعة المحتوى") alongside course review items.
4. **Authoritative Action Status:** In `computeNotificationActionRequired`, `comment_reported` evaluates to `true` while the linked comment exists in store and has `comment.reported === true`, and the viewer is an authorized reviewer.
5. **Decoupled Resolution:** Marking the notification as read leaves `comment.reported === true` $\rightarrow$ remains in "تتطلب إجراء". Resolving via `ignoreCommentReport` or `deleteComment` sets `comment.reported = false` $\rightarrow$ immediately removes it from "تتطلب إجراء" and emits `emitNotificationsChanged()`.
6. **Deduplication:** Bound by `dedupeKey: comment_report:${comment.id}:${recipientId}`.

---

## 3. Group Event Inventory & Recipient-Routing Matrix

| Group Operation | Triggering Handler / Method | Notification Type | Recipients Selected | Target Destination URL |
| :--- | :--- | :--- | :--- | :--- |
| **New Group Creation** | `createGroup` | `instructor_assigned` | Primary instructor & assistant lecturers | `/admin/groups/:groupId/monitoring` |
| **Direct Trainee Addition** | `addGroupMember` (`admin_assigned`) | `forced_enrollment` | Affected trainee | `/my-groups/:groupId` |
| **Trainee Removal** | `removeGroupMember` | `group_updated` | Removed trainee + Group staff | `/my-groups` (trainee) / `/admin/groups/:groupId/monitoring` (staff) |
| **New Join Request** | `createGroupJoinRequest` / `joinGroup` | `enrollment_request` | Primary instructor, assistants, and admins | `/admin/groups/:groupId/monitoring?tab=requests` |
| **Join Request Approved** | `reviewGroupJoinRequest` | `enrollment_approved` | Trainee applicant + Group staff | `/my-groups/:groupId` (trainee) |
| **Join Request Rejected** | `reviewGroupJoinRequest` | `enrollment_rejected` | Trainee applicant | `/my-groups` (trainee) |
| **Cycle Courses Assigned** | `assignCoursesToCycle` | `forced_enrollment` / `group_updated` | All cycle trainees + Group staff | `/my-groups/:groupId` (trainee) / `/admin/groups/:groupId/monitoring` (staff) |
| **Material File Uploaded** | `uploadMaterialFile` | `group_updated` | Enrolled trainees (if visible) | `/my-groups/:groupId` |
| **Meeting Added / Updated** | `updateGroup` (`resources`) | `group_updated` | Enrolled trainees + Group staff | `/my-groups/:groupId` |
| **Meeting Cancelled** | `updateGroup` (`resources`) | `group_updated` | Enrolled trainees + Group staff | `/my-groups/:groupId` |
| **Group Archival** | `archiveGroup` | `group_archived` | Enrolled trainees + Group staff | `/my-groups/:groupId` |

---

## 4. Audit & Security Event Inventory & Notification Policy

### Policy Distinctions
An audit ledger record is an authoritative log; it is **not** an indiscriminate broadcast. Only focused, high-impact security and governance actions trigger real-time notifications:

```typescript
public isHighImpactSecurityEvent(entry: SystemAuditLogEntryDTO): boolean {
  if (entry.severity === 'critical') return true;
  if (entry.outcome === 'denied' && (entry.severity === 'warning' || entry.action.includes('violation'))) return true;
  if (entry.action === 'users.change_role' || entry.action === 'users.change_status' || entry.action === 'users.delete') return true;
  if (entry.action === 'permissions.update_role_matrix' || entry.action === 'permissions.override_user' || entry.action === 'permissions.configure_departments') return true;
  if (entry.action === 'delegations.create' || entry.action === 'delegations.revoke') return true;
  if (entry.action.includes('invariant') || entry.action.includes('tampering') || entry.action.includes('concurrency')) return true;
  return false;
}
```

### Sovereign Oversight Recipients
Security notifications are delivered solely to `getSecurityOversightRecipientIds`:
- `admin`
- `assistant_admin`
- `super_admin`
- `developer`

Non-administrative roles (`lecturer`, `user`) **never** receive security notifications and cannot access the `audit_security` category tab.

### Sensitive Data Stripping & INV-R8 Developer Protection
- **No Raw Secrets:** Passwords, tokens, API keys, and authorization headers are stripped via `sanitizeAuditData` before logging or notification.
- **INV-R8 Confidentiality:** If the recipient is non-developer, any Developer principal identity (`USR_DEV_001`, `Developer Principal`, `developer@metro.local`) is replaced with «النظام» / `SYSTEM` in notification titles and messages.
- **Destination:** Security notifications route directly to `/admin/audit`.

---

## 5. Role and Resource-Scope Isolation Findings

1. **Role Gating on Category Tabs:**
   - `admin`, `assistant_admin`, `super_admin`, `developer`: Have access to all 9 categories (including `audit_security`).
   - `lecturer`: Sees `all`, `requires_action`, `join_requests`, `content_review`, `groups`, `system`. Strictly denied `approvals`, `user_management`, and `audit_security`.
   - `user` (Trainee): Sees `all`, `groups`, `system`. Strictly denied administrative and security hubs.
2. **Safe Fallback:** If a user account switches from admin to trainee while an administrative tab is active, the active tab falls back to `'all'` at render time.
3. **Destination Guarding:** Even if a notification item contains an administrative target URL, [`resolveNotificationDestination`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/NotificationsPage.tsx#L254-L272) redirects `user` to `/my-groups` or `/courses` to prevent unauthorized routing.

---

## 6. Notification Type-to-Category Mapping Updates

The Notification Center now defines 9 conceptual categories:

| Category ID | Arabic Label | Semantic Icon | Authorized Roles | Mapped Notification Types & Entity Predicates |
| :--- | :--- | :--- | :--- | :--- |
| `all` | الكل | `notifications` | All roles | All notifications scoped to active user |
| `requires_action` | تتطلب إجراء | `alertCircle` | All staff roles | Virtual tab for items with `actionRequired === true` |
| `approvals` | طلبات الاعتماد | `checkCircle` | Admins | Approval requests (`requestId` with `/approvals` or `general_alert`) |
| `join_requests` | طلبات الانضمام | `trainingGroups` | Staff & Admins | `enrollment_request` |
| `content_review` | مراجعة المحتوى | `courses` | Lecturers & Admins | `content_pending_review`, `content_approved`, `content_rejected`, **`comment_reported`** |
| `user_management` | إدارة المستخدمين | `user` | Admins | `new_registration_request` |
| `groups` | المجموعات والتدريب | `trainingGroups` | All roles | `enrollment_approved`, `enrollment_rejected`, `forced_enrollment`, `group_renewed`, `group_archived`, `group_updated`, `instructor_assigned`, `deadline_reminder`, `course_completed`, `new_course_suggested` |
| `audit_security` | الرقابة والأمان | `shield` | Admins | **`security_alert`**, `auditLogId`, targetUrl `/admin/audit` |
| `system` | إشعارات النظام | `info` | All roles | `new_comment`, non-approval `general_alert`, fallbacks |

---

## 7. Requires Action and Unread-Count Behavior for New Events

- **Unread Count ($N_{\text{unread}}$):** Counts notifications where `read === false`. Decrements immediately when an item is marked read.
- **Actionable Count ($N_{\text{action}}$):**
  - For `comment_reported`: Actionable while `comment.reported === true`. Marking read does **not** decrement $N_{\text{action}}$. Resolving the report drops $N_{\text{action}}$.
  - For `security_alert`: Evaluates to `actionRequired: false` (informational). Does not pollute $N_{\text{action}}$.
- **Navbar Synchronization:** The Navbar unread badge continues to consume `unreadCount` directly from `useNotifications()`, completely synchronized with `all` unread count.

---

## 8. All Files Changed and Their Purpose

| File Path | Nature of Change | Purpose |
| :--- | :--- | :--- |
| [`frontend/src/core/notifications/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/notifications/types.ts) | Domain Model Extension | Added `comment_reported` and `security_alert` to `NotificationType`; added `commentId` and `auditLogId` to `NotificationItem`. |
| [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts) | Core Event Remediation | Updated `createNotification`, `computeNotificationActionRequired`, `reportComment`, `ignoreCommentReport`, `deleteComment`, `removeGroupMember`, `assignCoursesToCycle`, `updateGroup`, and `recordAuditLog` to deliver comment-report, group, and security notifications. |
| [`frontend/src/pages/NotificationsPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/NotificationsPage.tsx) | UI Navigation & Categories | Added `audit_security` category, deterministic mapping, compact left/right arrow navigation, hidden scrollbars, auto-scrolling active tabs, and tailored Arabic empty states. |
| [`frontend/src/test/notification-navigation-and-delivery.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/notification-navigation-and-delivery.test.tsx) | Test Suite Authoring | Authored 30 comprehensive integration tests across 5 suites, marked `STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`. |

---

## 9. Exact Tests Authored Inventory

**File:** [`frontend/src/test/notification-navigation-and-delivery.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/notification-navigation-and-delivery.test.tsx)  
**Total Tests:** 30  
**Status:** `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`  

### Suite 1: Arrow Navigation (Tests 1–8)
1. `it('1. no arrows when categories fit')`
2. `it('2. arrows appear when category overflow exists')`
3. `it('3. next/previous arrow navigation works')`
4. `it('4. arrows disable or hide at the relevant boundaries')`
5. `it('5. selected category is scrolled into view')`
6. `it('6. RTL navigation direction is correct')`
7. `it('7. native horizontal scrollbar is hidden')`
8. `it('8. keyboard and accessible labels remain correct')`

### Suite 2: Comment Reports (Tests 9–14)
9. `it('9. a valid comment report generates a notification')`
10. `it('10. the intended authorized reviewers receive it')`
11. `it('11. unauthorized recipients do not receive it')`
12. `it('12. duplicate report dispatch does not create duplicate notifications')`
13. `it('13. reading the notification does not resolve the report')`
14. `it('14. resolving the report removes it from Requires Action')`

### Suite 3: Group Notifications (Tests 15–19)
15. `it('15. relevant group join request generates an appropriately scoped notification')`
16. `it('16. join decision notifies the affected requester where required')`
17. `it('17. relevant group membership/lifecycle changes notify the correct recipients')`
18. `it('18. material or meeting events use the intended group-scoped recipients')`
19. `it('19. unrelated groups and users do not receive the notification')`

### Suite 4: Audit & Security Notifications (Tests 20–25)
20. `it('20. relevant high-impact audit/security event produces a notification')`
21. `it('21. ordinary low-severity audit events are not indiscriminately broadcast')`
22. `it('22. only authorized oversight roles receive security notifications')`
23. `it('23. Developer identity is protected under INV-R8')`
24. `it('24. notification metadata does not expose sensitive audit payloads')`
25. `it('25. duplicate audit event dispatch does not generate duplicate notifications')`

### Suite 5: Regression (Tests 26–30)
26. `it('26. existing category classification remains correct')`
27. `it('27. All Notifications continues to include every notification')`
28. `it('28. unread count and Requires Action count remain distinct')`
29. `it('29. direct account switching and stale response isolation remain intact')`
30. `it('30. existing approval notification links and workflows remain intact')`

---

## 10. Developer and Super Admin Inventory (No Secrets)

| User Identifier | Canonical Role | Name Reference | Auth Mechanism | Environment Guard | Phase 12 Provisioning Plan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `USR_DEV_001` | `developer` | Developer Principal | Development/demo synthetic token | Protected under `INV-R8`; sanitized to «النظام» for non-developers | Dedicated internal maintenance principal; never deployed with hardcoded credentials |
| `USR_SUPER_001` | `super_admin` | م. ياسين رضوان | Synthetic demo JWT | Immutable capability ceiling (`INV-R1`, `INV-R2`) | Provisioned via sovereign root migration script in backend database |
| `usr_admin_001` | `admin` | م. أحمد محمود | Standard demo JWT | Default operational administrative role | Initial system administrator account |
| `USR016` | `assistant_admin` | أحمد شريف (مساعد مدير) | Standard demo JWT | Subject to dual-control approval lifecycle | Standard assistant administrator account |

---

## 11. Explicit Confirmation of No Automated Checks

> [!IMPORTANT]
> **Operational Testing Directive Confirmation:**
> In strict accordance with user directives, **ZERO automated test runner commands** (`vitest`, `npm test`, `tsc`, `eslint`, `vite build`, or background scanners) were executed during this session.
>
> All 30 tests in [`notification-navigation-and-delivery.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/notification-navigation-and-delivery.test.tsx) carry the explicit directive:
> `STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

---

## 12. Explicit Confirmation: Phase 5 Has Not Started

> [!NOTE]
> **Phase Boundary Confirmation:**
> This task represents a targeted pre-Phase 5 UX refinement and notification delivery remediation.
> **Phase 5 Planning, Requirements Analysis, and Implementation HAVE NOT STARTED.**
> The codebase remains in a clean, consistent state awaiting formal instructions for Phase 5.

