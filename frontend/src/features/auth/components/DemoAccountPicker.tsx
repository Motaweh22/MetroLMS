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
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-text-heading">
          <Icon name="sparkles" size="sm" className="text-primary" />
          <span>حسابات العرض التجريبي السريع (Demo Accounts)</span>
        </div>
        <span className="text-[10px] text-text-muted">انقر للاختبار الفوري</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {DEMO_ACCOUNTS_LIST.map((account) => {
          const roleKey = account.user.role;
          return (
            <div
              key={account.user.id}
              className="p-2.5 rounded-lg border border-border bg-neutral-light/50 hover:bg-neutral-light hover:border-primary/40 transition-all flex flex-col justify-between text-start gap-2 group"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <Badge
                    variant={roleBadgeVariant[roleKey] || 'neutral'}
                    className="text-[10px] px-1.5 py-0 font-bold"
                  >
                    {roleLabelAr[roleKey] || roleKey}
                  </Badge>
                  <span className="text-[10px] font-mono text-text-muted">{account.user.initials}</span>
                </div>
                <div className="text-xs font-bold text-text-heading truncate">
                  {account.user.name}
                </div>
                <div className="text-[10px] text-text-muted truncate">
                  {account.user.jobTitle}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="w-full text-[11px] py-1 h-7 border-border group-hover:border-primary group-hover:text-primary transition-colors"
                onClick={() => onSelectAccount(account)}
                leftIcon="check"
              >
                استخدام الحساب
              </Button>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-text-muted/80 text-center leading-relaxed bg-surface/60 p-2 rounded border border-border/50">
        ملاحظة حوكمة: هذه الحسابات تركيبية مصممة خصيصاً للتطوير والاختبار، ولا ترتبط بأي سجلات حقيقية أو بيانات سابقة.
      </div>
    </div>
  );
};

export default DemoAccountPicker;
