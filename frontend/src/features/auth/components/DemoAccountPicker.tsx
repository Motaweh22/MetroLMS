import React from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { DEMO_ACCOUNTS_LIST, type SyntheticMockAccount } from '@/core/auth/demoAccounts';

export interface DemoAccountPickerProps {
  onSelectAccount: (account: SyntheticMockAccount) => void;
  isLoading?: boolean;
}

const roleBadgeVariant: Record<string, 'primary' | 'warning' | 'info'> = {
  admin: 'primary',
  lecturer: 'warning',
  user: 'info',
};

const roleLabelAr: Record<string, string> = {
  admin: 'مسؤول النظام',
  lecturer: 'محاضر معتمد',
  user: 'متدرب فني',
};

export const DemoAccountPicker: React.FC<DemoAccountPickerProps> = ({
  onSelectAccount,
  isLoading = false,
}) => {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
        <div className="flex items-center gap-2 text-xs font-bold text-primary-dark">
          <Icon name="sparkles" size="sm" className="text-primary" />
          <span>حسابات العرض التجريبي السريع (Demo Accounts)</span>
        </div>
        <span className="text-[11px] text-text-muted">انقر للاختبار الفوري وتعبئة الحساب تلقائياً</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {DEMO_ACCOUNTS_LIST.map((account) => {
          const roleKey = account.user.role;
          return (
            <div
              key={account.user.id}
              className="p-3.5 rounded-xl border border-border bg-surface/60 hover:bg-white hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between text-start gap-2.5 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <Badge
                    variant={roleBadgeVariant[roleKey] || 'neutral'}
                    className="text-[10px] px-2 py-0.5 font-bold"
                  >
                    {roleLabelAr[roleKey] || roleKey}
                  </Badge>
                  <span className="text-[10px] font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border/50">
                    {account.user.initials}
                  </span>
                </div>
                <div className="text-xs font-bold text-text-heading group-hover:text-primary-dark transition-colors truncate">
                  {account.user.name}
                </div>
                <div className="text-[11px] text-text-muted truncate">
                  {account.user.jobTitle}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="w-full text-xs py-1.5 h-8 border-border group-hover:border-primary group-hover:bg-primary-light/30 group-hover:text-primary-dark transition-all"
                onClick={() => onSelectAccount(account)}
                leftIcon="check"
              >
                استخدام الحساب
              </Button>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-text-muted/80 text-center leading-relaxed bg-surface/80 p-2.5 rounded-lg border border-border/50">
        ملاحظة حوكمة: هذه الحسابات تركيبية مصممة خصيصاً للتطوير والاختبار، ولا ترتبط بأي سجلات حقيقية أو بيانات سابقة.
      </div>
    </div>
  );
};

export default DemoAccountPicker;
