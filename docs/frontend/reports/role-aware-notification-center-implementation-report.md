# MetroLMS — Role-Aware Notification Center & Category Tabs Implementation Report

**Document ID:** `REPORT-NOTIF-02`  
**Status:** IMPLEMENTED & AUDITED — READY FOR REVIEW  
**Test Status:** `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`  
**Phase Context:** Pre-Phase 5 Targeted UX Enhancement  

---

## Executive Summary

This report documents the implementation of the **Role-Aware Notification Center & Category Tabs** in MetroLMS. The enhancement transforms the single chronological notification list into a high-capacity, role-aware notification center tailored for administrators, assistant administrators, lecturers, and trainees.

Key architectural achievements:
1. **Authoritative Action Status:** Actionable status (`actionRequired`) is grounded in linked business entity states (`approvalRequests`, `groupJoinRequests`, `courses`), completely decoupled from read/unread status (`read`).
2. **Role-Aware Visibility:** Administrative hubs (Approvals Hub, User Management) remain strictly invisible to non-administrative roles, preserving role capability ceilings and system boundaries.
3. **Composable Filtering & Responsive RTL:** Two-dimensional filtering (Category $\times$ Read State) with responsive horizontal tab navigation and customized Arabic empty states.
4. **Single Source of Truth for Counts:** The global Navbar unread badge continues to reflect total unread notifications, while the "Requires Action" tab displays total unresolved actionable items (both read and unread).
5. **No Test Runners Executed:** In strict accordance with the testing directive, zero test runners (`vitest`, `npm test`, `tsc`, `eslint`) were executed. All 20 authored test cases are deferred to Phase 13.
6. **Phase 5 Not Started:** Phase 5 Planning and execution have not commenced.

---

## 1. Inventory of Actual Existing Notification Types

MetroLMS features 17 distinct notification types defined in [`frontend/src/core/notifications/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/notifications/types.ts#L8-L25). These originate from four core subsystems:

| Notification Type | Domain Subsystem | Business Trigger / Purpose |
| :--- | :--- | :--- |
| `enrollment_approved` | Group Training | Trainee's enrollment request accepted by instructor/admin |
| `enrollment_rejected` | Group Training | Trainee's enrollment request rejected |
| `new_course_suggested` | Group Training / Content | New course suggestion linked to training group |
| `new_comment` | Collaboration | New discussion comment on course/module |
| `forced_enrollment` | Group Training | Administrative direct enrollment of trainee into group |
| `content_pending_review` | Course Review Workflow | Lecturer submitted course for review (MFR-08) |
| `content_approved` | Course Review Workflow | Reviewer approved course for publishing |
| `content_rejected` | Course Review Workflow | Reviewer requested revisions / rejected course |
| `new_registration_request` | User Governance | New user registered awaiting administrative activation |
| `enrollment_request` | Group Training | Trainee requested to join a training group |
| `deadline_reminder` | Group Training / Calendar | Course or assignment deadline approaching |
| `general_alert` | System / Approvals | System broadcast or governance approval notification |
| `group_renewed` | Group Lifecycle | Training group cycle renewed |
| `group_archived` | Group Lifecycle | Training group archived |
| `instructor_assigned` | Group Staffing | Lecturer assigned as primary or assistant instructor |
| `group_updated` | Group Lifecycle | Group details, schedule, or capacity modified |
| `course_completed` | Learner Progress | Trainee completed all modules in a course |

---

## 2. Final Type-to-Category Mapping

The Notification Center introduces 8 conceptual categories. Notifications are classified using the pure, deterministic mapping function [`getNotificationCategory(notif)`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/NotificationsPage.tsx#L86-L134). Heuristic string matching on Arabic titles or messages is strictly avoided.

| Category ID | Arabic Label | Semantic Icon | Mapped Notification Types & Metadata Rules |
| :--- | :--- | :--- | :--- |
| `all` | الكل | `notifications` | Virtual category displaying all notifications scoped to current user |
| `requires_action` | تتطلب إجراء | `alertCircle` | Virtual category displaying notifications with `actionRequired === true` |
| `approvals` | طلبات الاعتماد | `checkCircle` | Explicit approval requests (`requestId` with `targetUrl: '/approvals'` or `type: 'general_alert'` with `requestId`), and `new_registration_request` with `requestId` |
| `join_requests` | طلبات الانضمام | `trainingGroups` | `enrollment_request` |
| `content_review` | مراجعة المحتوى | `courses` | `content_pending_review`, `content_approved`, `content_rejected` |
| `user_management` | إدارة المستخدمين | `user` | `new_registration_request` |
| `groups` | المجموعات والتدريب | `trainingGroups` | `enrollment_approved`, `enrollment_rejected`, `forced_enrollment`, `group_renewed`, `group_archived`, `group_updated`, `instructor_assigned`, `deadline_reminder`, `course_completed`, `new_course_suggested` |
| `system` | إشعارات النظام | `info` | `new_comment`, non-approval `general_alert`, and any unclassified fallback types |

### Deterministic Mapping Implementation:
```typescript
export function getNotificationCategory(
  notif: NotificationItem
): Exclude<NotificationCategory, 'all' | 'requires_action'> {
  if (
    notif.requestId &&
    (notif.targetUrl?.startsWith('/approvals') || notif.type === 'general_alert')
  ) {
    return 'approvals';
  }
  if (notif.type === 'new_registration_request') return 'user_management';
  if (notif.type === 'enrollment_request') return 'join_requests';
  if (
    notif.type === 'content_pending_review' ||
    notif.type === 'content_approved' ||
    notif.type === 'content_rejected'
  ) {
    return 'content_review';
  }
  if (
    notif.type === 'enrollment_approved' ||
    notif.type === 'enrollment_rejected' ||
    notif.type === 'forced_enrollment' ||
    notif.type === 'group_renewed' ||
    notif.type === 'group_archived' ||
    notif.type === 'group_updated' ||
    notif.type === 'instructor_assigned' ||
    notif.type === 'deadline_reminder' ||
    notif.type === 'course_completed' ||
    notif.type === 'new_course_suggested'
  ) {
    return 'groups';
  }
  return 'system';
}
```

---

## 3. Role-Aware Category Visibility Rules

Category tabs are filtered at render time according to the authenticated user's authoritative role:

```typescript
const visibleCategories = NOTIFICATION_CATEGORIES.filter((cat) =>
  cat.roles.includes(currentRole)
);
```

| Role | Visible Categories | Hidden / Gated Categories | Rationale |
| :--- | :--- | :--- | :--- |
| **`admin`** | All 8 categories | None | Full administrative operational and governance triage |
| **`assistant_admin`** | All 8 categories | None | Operational governance triage (subject to capability ceilings) |
| **`super_admin`** | All 8 categories | None | Complete system-wide oversight |
| **`developer`** | All 8 categories | None | Internal inspection & maintenance |
| **`lecturer`** | `all`, `requires_action`, `join_requests`, `content_review`, `groups`, `system` | `approvals`, `user_management` | Lecturers review group join requests and course feedback; administrative approval hubs and user account governance are hidden |
| **`user`** (Trainee) | `all`, `groups`, `system` | `requires_action`, `approvals`, `join_requests`, `content_review`, `user_management` | Trainees only receive personal group updates, course reminders, and system alerts |

### Safe Fallback on Role Switch:
If the currently selected category is not permitted for the active role (e.g., after switching from Admin to Trainee while on the Approvals tab), the system falls back safely to `'all'`:
```typescript
const effectiveCategory = visibleCategories.some((c) => c.id === selectedCategory)
  ? selectedCategory
  : 'all';
```

---

## 4. Requires Action Classification and Resolution Logic

The authoritative `actionRequired` flag is computed by the store method [`computeNotificationActionRequired`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts#L2096-L2165) and serialized into the API payload. It is never synthesized from volatile client state.

### Evaluation Rules:
1. **Approval Requests (`n.requestId`):**
   - Actionable if underlying request in `this.approvalRequests` has `status === 'pending'`.
   - Viewer must have an administrative approver role (`admin`, `assistant_admin`, `super_admin`, `developer`).
   - Self-Approval Check (INV-R6): If `req.requestedBy === canonicalUserId`, `actionRequired` resolves to `false`.
2. **Group Join Requests (`n.type === 'enrollment_request'`):**
   - Actionable if corresponding record in `this.groupJoinRequests` has `status === 'pending'`.
   - Viewer must be an administrator or the assigned primary/assistant instructor of the target group.
3. **Course Review (`n.type === 'content_pending_review'`):**
   - Actionable if the linked course in `this.courses` has `status === 'pending_review'` or `isUpdatePendingApproval === true`.
   - Viewer must be an administrative reviewer.
4. **User Registration Requests (`n.type === 'new_registration_request'`):**
   - Actionable for administrative roles awaiting account activation/approval.

### Resolution Transitions:
- When an approval request is approved or rejected $\rightarrow$ `req.status` becomes `'approved'` or `'rejected'` $\rightarrow$ `actionRequired` immediately becomes `false`.
- When a group join request is accepted or rejected $\rightarrow$ `joinReq.status` becomes `'approved'` or `'rejected'` $\rightarrow$ `actionRequired` becomes `false`.
- When a course review is finalized $\rightarrow$ `course.status` becomes `'published'` or `'draft'` $\rightarrow$ `actionRequired` becomes `false`.

---

## 5. Exact Distinction Between Unread Count and Actionable-Item Count

A critical architectural principle established in this increment:
$$\text{Read Status} \neq \text{Action Resolution Status}$$

| Metric | Source of Truth | Affected by Mark as Read? | Display Location |
| :--- | :--- | :--- | :--- |
| **Global Unread Count** | Total notifications where `read === false` across all types | **Yes** — decrements when marked as read | Navbar Bell Badge & "الكل" Tab Badge |
| **Category Unread Count** | Notifications where `read === false` and `getNotificationCategory(n) === catId` | **Yes** — decrements when category items are marked as read | Respective Category Tab Badges |
| **Actionable Count** | Notifications where `actionRequired === true` (regardless of `read`) | **No** — remains unchanged until underlying business request is resolved | "تتطلب إجراء" Tab Badge |

### Concrete Scenario:
1. Admin receives an approval notification for user role change:
   - `read: false`, `actionRequired: true`.
   - Global unread badge: `+1`.
   - Requires Action badge: `+1`.
2. Admin opens the notification center and clicks the notification:
   - `read: true`, `actionRequired: true`.
   - Global unread badge: decrements by 1 (`0`).
   - Requires Action badge: remains `1`!
   - Item continues to appear in the "تتطلب إجراء" tab with the visual badge `تتطلب إجراء`.
3. Admin approves the request in the Approvals Hub:
   - Underlying request transitions to `status: 'approved'`.
   - `actionRequired` becomes `false`.
   - Requires Action badge: drops to `0`. Item disappears from the "تتطلب إجراء" tab.

---

## 6. Category Filtering and Responsive RTL Behavior

### Composable Filtering Matrix:
The Notifications Page combines the active category and the read filter:
$$\text{Displayed Notifications} = \text{Category Filter}(\text{Role Scoped Notifications}) \cap \text{Read State Filter}$$

```typescript
const filteredNotifications = notifications
  .filter((item) => {
    // 1. Category Filter
    if (effectiveCategory === 'requires_action') {
      if (!item.actionRequired) return false;
    } else if (effectiveCategory !== 'all') {
      const itemCat = getNotificationCategory(item);
      if (itemCat !== effectiveCategory) {
        if (effectiveCategory === 'approvals' && item.type === 'new_registration_request' && item.requestId) {
          // Cross-surface under Approvals
        } else {
          return false;
        }
      }
    }

    // 2. Read State Filter
    if (filter === 'unread') {
      if (item.read) return false;
    }

    return true;
  })
  .sort((a, b) => {
    if (effectiveCategory === 'requires_action') {
      if (Boolean(a.actionRequired) !== Boolean(b.actionRequired)) {
        return a.actionRequired ? -1 : 1;
      }
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
```

### Responsive RTL Design:
- **Horizontal Scrollbar:** `overflow-x-auto scrollbar-thin` ensures clean touch scrolling on mobile and tablet displays.
- **Directional Preservation:** RTL flow (`dir="rtl"`) with proper Arabic typography, semantic badges, and indicator dots.
- **Tailored Empty States:** Every category presents a contextual Arabic illustration and title:
  - *Requires Action:* «لا توجد مهام أو إجراءات معلقة بانتظار قرارك — رائع! لا توجد طلبات اعتماد أو مراجعات تتطلب تدخلك الإداري في الوقت الحالي.»
  - *Approvals:* «لا توجد طلبات اعتماد — لا توجد طلبات اعتماد حوكمة أو عمليات تتطلب موافقة في هذا القسم.»
  - *Join Requests:* «لا توجد طلبات انضمام للمجموعات — لا توجد طلبات انضمام مقدمة من المتدربين بانتظار المراجعة.»
  - *Content Review:* «لا توجد إشعارات مراجعة محتوى — لا توجد مقررات تدريبية بانتظار المراجعة أو الاعتماد في الوقت الراهن.»
  - *Unread Filter Active:* «لا توجد إشعارات غير مقروءة في هذا القسم — لقد اطلعت على جميع الإشعارات المندرجة تحت هذا التصنيف.»

---

## 7. Confirmation of Navbar Global Unread Count Synchronization

The Top Navbar bell icon consumes `unreadCount` directly from `useNotifications()`:

```tsx
// Navbar.tsx
const { unreadCount } = useNotifications();

<Link to="/notifications" data-testid="navbar-notifications-link">
  <Icon name="bell" size="lg" />
  {unreadCount > 0 && (
    <span data-testid="navbar-unread-badge" className="...">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

- Filtering categories in `NotificationsPage` is purely a local view transformation; it does not dispatch any mutation or alter the `NotificationContext` store.
- Clicking category tabs does not mark items as read.
- The Navbar badge and the `all` tab unread count remain in 100% synchronization.

---

## 8. Files Changed and Their Purposes

| File Path | Nature of Change | Purpose |
| :--- | :--- | :--- |
| [`frontend/src/core/notifications/types.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/core/notifications/types.ts#L40) | Domain Model Extension | Added optional `actionRequired?: boolean` to `NotificationItem` interface. |
| [`frontend/src/mocks/store/inMemoryStore.ts`](file:///d:/LMS%20MEtro%20Project/frontend/src/mocks/store/inMemoryStore.ts#L2096) | Authoritative Action Evaluation | Implemented `computeNotificationActionRequired` evaluating live entity state for approval requests, group join requests, course reviews, and user registrations; attached to `getNotificationsForUser` and `markNotificationRead`. |
| [`frontend/src/pages/NotificationsPage.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/pages/NotificationsPage.tsx) | Complete UI & Filtering Refactor | Introduced `NOTIFICATION_CATEGORIES`, deterministic `getNotificationCategory`, composable Category $\times$ Read State filtering, role gating, actionable sorting, distinct count badges, and tailored Arabic empty states. |
| [`frontend/src/test/notification-categories-and-action-center.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/notification-categories-and-action-center.test.tsx) | Test Suite Authoring | Authored 20 comprehensive end-to-end integration tests covering all required scenarios, marked `STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`. |

---

## 9. Tests Authored Inventory

**File:** [`frontend/src/test/notification-categories-and-action-center.test.tsx`](file:///d:/LMS%20MEtro%20Project/frontend/src/test/notification-categories-and-action-center.test.tsx)  
**Total Tests:** 20  
**Status:** `WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`  

### Suite 1: Category Classification
1. `it('1. every existing notification type maps deterministically to the intended category')`
2. `it('2. no notification is silently lost from All Notifications tab')`
3. `it('3. unknown or unclassified notification types remain visible under All or a safe fallback category')`
4. `it('4. categories displayed are appropriate for the current authenticated role')`

### Suite 2: Requires Action Semantics & Lifecycle
5. `it('5. pending approval requests appear in Requires Action for eligible reviewers')`
6. `it('6. resolved approval requests disappear from Requires Action')`
7. `it('7. pending group join requests appear for authorized reviewers')`
8. `it('8. resolved join requests disappear from Requires Action')`
9. `it('9. reading an actionable notification does not remove its unresolved action')`
10. `it('10. unauthorized users do not receive actionable tabs or actions they cannot perform')`

### Suite 3: Filtering & Counts Composability
11. `it('11. category and Unread Only filters compose correctly')`
12. `it('12. category unread counts are accurate')`
13. `it('13. Requires Action counts include actionable read and unread notifications')`
14. `it('14. the global Navbar unread count remains unchanged by category filtering')`
15. `it('15. opening a category tab does not mark any notification as read')`

### Suite 4: Existing Behavior & Role Boundaries Preservation
16. `it('16. existing individual mark-as-read behavior remains correct')`
17. `it('17. Mark All as Read clears all unread notifications within store and UI')`
18. `it('18. direct account switching and stale response protection remain intact')`
19. `it('19. notification deep links continue working accurately')`
20. `it('20. lecturer view displays course review, join requests, groups, and discussions without administrative hubs')`

---

## 10. Developer and Super Admin Identity Inventory (No Secrets)

In compliance with INV-R8 (Developer Confidentiality) and INV-R2/INV-R3 (Protected Privileged Accounts), identities are referenced strictly by identifier and role without sensitive tokens or passwords:

| User Identifier | Canonical Role | Name Reference | Authorization Level |
| :--- | :--- | :--- | :--- |
| `USR_DEV_001` | `developer` | Developer Principal | Maximum operational & maintenance authority; sanitized to «النظام» for non-developer viewers |
| `USR_SUPER_001` | `super_admin` | م. ياسين رضوان | Super Administrator; authoritative system governance; immutable ceiling |
| `usr_admin_001` | `admin` | م. أحمد محمود | Standard Administrator |
| `USR016` | `assistant_admin` | أحمد شريف (مساعد مدير) | Assistant Administrator; operational governance subject to Phase 4 approval lifecycle |
| `usr_lect_001` | `lecturer` | د. سارة المهدي | Lecturer; content authoring and group staff |
| `usr_trainee_001` | `user` | عمر خالد | Trainee; learner profile |

---

## 11. Explicit Confirmation of No Automated Checks

> [!IMPORTANT]
> **Testing Directive Confirmation:**
> In accordance with the mandatory operational constraints for this enhancement, **ZERO automated test runner commands** (`vitest`, `npm test`, `tsc`, `eslint`, `vite build`, or background scanners) were invoked during this session.
>
> All 20 tests in `notification-categories-and-action-center.test.tsx` and all 22 tests in `unread-notification-badge.test.tsx` carry the explicit directive:
> `STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13`.

---

## 12. Explicit Confirmation: Phase 5 Has Not Started

> [!NOTE]
> **Phase Boundary Confirmation:**
> This work represents a targeted pre-Phase 5 UX refinement of the Notifications system.
> **Phase 5 Planning, Requirements Analysis, and Implementation HAVE NOT STARTED.**
> The workspace is in a clean, consistent state awaiting formal authorization for Phase 5.

