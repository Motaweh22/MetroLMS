/**
 * MetroLMS — Visual Role Preview Mutation Barrier
 *
 * Authoritative Governance Reference:
 * - MetroLMS Pre-Backend Migration Remediation Roadmap — Revision 5:
 *   - Section 4: Developer Preview and Isolated Role Testing (D-10)
 *   - Stable Finding MFR-40: Separation of Visual Preview from Isolated Role Testing
 * - Increment 5.2 Specification: Mutation Safety During Visual Preview
 *
 * Invariant Guarantee:
 * While Visual Role Preview is active, all state-changing API operations (POST, PUT, PATCH, DELETE)
 * are intercepted and blocked at the HTTP client boundary.
 *
 * Real mutations carrying the Developer's authority must NEVER be executed under the guise
 * of a visual preview of another role (Admin, Lecturer, Trainee).
 * Real permission and mutation testing requires an Isolated Role Test Session (Increment 5.3).
 */

export const ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE =
  'وضع معاينة الواجهة مخصص للاطلاع البصري فقط. لا يمكن تنفيذ عمليات التعديل في هذا الوضع. لتجربة الصلاحيات وتعديل البيانات، يرجى بدء "جلسة اختبار صلاحيات معزولة".';

export type MutationBlockedCallback = (message: string) => void;

let isBarrierActive = false;
let blockedNotificationCallback: MutationBlockedCallback | null = null;

/**
 * Configure the active state of the visual role preview mutation barrier.
 * Invoked by RolePreviewContext upon entering or exiting visual preview mode.
 */
export function setRolePreviewMutationBarrier(
  active: boolean,
  onBlocked?: MutationBlockedCallback
): void {
  isBarrierActive = active;
  blockedNotificationCallback = active && onBlocked ? onBlocked : null;
}

/**
 * Returns true if visual role preview is currently active and mutations must be blocked.
 */
export function isRolePreviewMutationBlocked(): boolean {
  return isBarrierActive;
}

/**
 * Triggers the registered user notification (e.g. warning toast) when a mutation is intercepted.
 */
export function triggerRolePreviewBlockedNotification(): void {
  if (blockedNotificationCallback) {
    try {
      blockedNotificationCallback(ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE);
    } catch {
      // Safe no-op if notification subscriber encounters an error
    }
  }
}

