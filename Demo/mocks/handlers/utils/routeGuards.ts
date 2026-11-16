import { HttpResponse } from 'msw';
import type { User, UserRole } from '@/core/auth/types';
import type { SystemCapability, PermissionCheckResult } from '@/core/permissions/types';
import type { EvaluationContext } from '@/core/permissions/policy';
import { inMemoryStore } from '../../store/inMemoryStore';

export interface GuardOptions {
  context?: EvaluationContext;
  titleAr?: string;
  targetId?: string;
  targetResourceId?: string;
  targetResourceName?: string;
  resourceScope?: {
    groupId?: string;
    courseId?: string;
    departmentId?: string;
  };
  justification?: string;
  payload?: Record<string, unknown>;
  custom202Message?: string;
  customDeniedMessage?: string;
}

export interface RouteGuardResult {
  proceed: boolean;
  response?: Response;
  check: PermissionCheckResult;
}

/**
 * Route guard utility enforcing capability authorization and default approval lifecycle (INV-R9).
 *
 * Grounded in docs/backend/pre-backend-migration-remediation-roadmap.md:
 * - Denied: Returns HTTP 403 Forbidden without executing mutation.
 * - Requires Approval: Automatically registers a pending ApprovalRequest in the store
 *   and returns HTTP 202 Accepted with { approvalRequired: true, requestId, message, request }
 *   without executing the business mutation.
 * - Direct: Returns { proceed: true } allowing the handler to proceed with the mutation.
 */
export function requireCapabilityOrApproval(
  user: User | { id: string; role: UserRole },
  capability: SystemCapability,
  options: GuardOptions = {}
): RouteGuardResult {
  const check = inMemoryStore.hasPermission(user, capability, options.context);

  if (!check.granted || check.executionMode === 'denied') {
    return {
      proceed: false,
      response: HttpResponse.json(
        {
          message:
            options.customDeniedMessage ||
            check.reasonAr ||
            'غير مصرح: لا تملك الصلاحية الكافية لتنفيذ هذا الإجراء',
        },
        { status: 403 }
      ),
      check,
    };
  }

  if (check.executionMode === 'requires_approval') {
    const requesterName = 'name' in user ? user.name : user.id;
    const derivedScope = options.resourceScope || {
      groupId: options.context?.targetGroupId,
      courseId: options.context?.targetCourseId,
    };
    const approvalReq = inMemoryStore.createApprovalRequest({
      actionType: capability,
      capability,
      titleAr: options.titleAr || `طلب اعتماد إجراء: ${capability}`,
      targetId: options.targetId,
      targetResourceId: options.targetResourceId || options.targetId,
      targetResourceName: options.targetResourceName,
      resourceScope: derivedScope,
      requestedBy: user.id,
      requesterId: user.id,
      requesterName,
      requesterRole: user.role,
      justification:
        options.justification || `طلب اعتماد عملية ${capability} لعدم وجود تفويض تشغيلي مباشر`,
      payload: options.payload || {},
    });

    return {
      proceed: false,
      response: HttpResponse.json(
        {
          approvalRequired: true,
          requestId: approvalReq.id,
          message:
            options.custom202Message ||
            'العملية مصرح بتقديمها ولكن تتطلب اعتماد مدير النظام قبل التنفيذ.',
          request: approvalReq,
        },
        { status: 202 }
      ),
      check,
    };
  }

  return { proceed: true, check };
}

