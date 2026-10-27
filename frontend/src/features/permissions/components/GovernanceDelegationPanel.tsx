import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import type { ManagedUserDTO } from '@/core/user-management/types';
import { ROLE_DISPLAY_LABELS } from '@/core/permissions/types';
import { permissionsApi } from '../services/permissionsApi';

export interface GovernanceDelegationPanelProps {
  assistants: ManagedUserDTO[];
  delegations: Record<string, boolean>;
  onReload: () => Promise<void>;
  readOnly?: boolean;
}

export const GovernanceDelegationPanel: React.FC<GovernanceDelegationPanelProps> = ({
  assistants,
  delegations,
  onReload,
  readOnly = false,
}) => {
  const toast = useToast();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const handleToggleDelegation = async (userId: string, currentVal: boolean) => {
    if (readOnly) return;
    setLoadingUserId(userId);
    try {
      const newVal = !currentVal;
      await permissionsApi.setDelegatedAuthority(userId, newVal);
      toast.success(
        newVal
          ? 'تم تفعيل التفويض التشغيلي للمساعد بنجاح.'
          : 'تم إلغاء التفويض التشغيلي؛ أصبحت عملياته تتطلب اعتماداً مسبقاً.'
      );
      await onReload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحديث حالة التفويض';
      toast.error(msg);
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="governance-delegation-panel">
      {/* Governance Explanatory Card */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm text-right">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
            <Icon name="shield" size="md" />
          </span>
          <div>
            <h3 className="text-base font-bold text-text-heading">
              حوكمة الرقابة الثنائية والتفويض التشغيلي (Dual-Control & Delegation)
            </h3>
            <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
              تضمن الرقابة الثنائية ألا تتمكن الحسابات المساعدة (مدير النظام المساعد) من تنفيذ
              عمليات سيادية عالية الخطورة بشكل منفرد. عند <strong>إلغاء التفويض</strong>، يتم تحويل
              العمليات التشغيلية المؤهلة (مثل نشر المقررات أو تعديل الحسابات) كطلبات اعتماد معلقة إلى مديري
              النظام. بينما يمنح <strong>تفعيل التفويض</strong> صلاحية التنفيذ المباشر لتلك المهام، مع بقاء الحماية المطلقة لحسابات مديري النظام.
            </p>
          </div>
        </div>
      </div>

      {/* Assistants List */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden text-right">
        <div className="p-4 border-b border-border bg-bg-alt/70 flex items-center justify-between">
          <h4 className="font-bold text-sm text-text-heading">
            قائمة الحسابات المساعدة المتاحة للتفويض
          </h4>
          <Badge variant="primary" size="sm">
            مدير النظام المساعد فقط ({assistants.length})
          </Badge>
        </div>

        {assistants.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-xs">
            لا توجد حالياً أي حسابات مدير نظام مساعد في دليل المستخدمين.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {assistants.map((user) => {
              const isDelegated = !!delegations[user.id.toLowerCase()];
              const isBusy = loadingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-bg/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary-dark font-bold text-sm flex items-center justify-center border border-primary/20 shrink-0">
                      {user.name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-text text-sm">
                        {user.name}{' '}
                        <span className="font-mono text-xs text-text-muted">({user.id})</span>
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {user.email} • {ROLE_DISPLAY_LABELS[user.role]} • {user.department}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-left sm:text-right">
                      <Badge
                        variant={isDelegated ? 'success' : 'warning'}
                        size="md"
                        icon={isDelegated ? 'check' : 'pending'}
                      >
                        {isDelegated ? 'مفوّض تشغيلياً' : 'يتطلب اعتماد إداري'}
                      </Badge>
                    </div>

                    {!readOnly && (
                      <Button
                        type="button"
                        variant={isDelegated ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => handleToggleDelegation(user.id, isDelegated)}
                        isLoading={isBusy}
                        data-testid={`toggle-delegation-btn-${user.id}`}
                      >
                        {isDelegated ? 'إلغاء التفويض' : 'منح التفويض التشغيلي'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
