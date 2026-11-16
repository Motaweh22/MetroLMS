import React from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface RoleTestCardAccount {
  id: string;
  role: 'developer' | 'super_admin' | 'admin' | 'assistant_admin' | 'lecturer' | 'trainee';
  roleLabelAr: string;
  name: string;
  jobTitle: string;
  initials: string;
  phone: string;
  password: string;
}

export const ROLE_TEST_ACCOUNTS: RoleTestCardAccount[] = [
  {
    id: 'test-dev',
    role: 'developer',
    roleLabelAr: 'مطور النظام',
    name: 'مطور النظام (تجريبي)',
    jobTitle: 'Developer — صلاحيات كاملة',
    initials: 'مط',
    phone: '01000000001',
    password: 'MetroTest@2026',
  },
  {
    id: 'test-super-admin',
    role: 'super_admin',
    roleLabelAr: 'سوبر أدمن',
    name: 'السوبر أدمن (تجريبي)',
    jobTitle: 'Super Admin — إدارة عليا',
    initials: 'سأ',
    phone: '01000000002',
    password: 'MetroTest@2026',
  },
  {
    id: 'test-admin',
    role: 'admin',
    roleLabelAr: 'مدير التدريب',
    name: 'مدير التدريب (تجريبي)',
    jobTitle: 'Admin — إدارة المنصة',
    initials: 'مت',
    phone: '01000000003',
    password: 'MetroTest@2026',
  },
  {
    id: 'test-assistant-admin',
    role: 'assistant_admin',
    roleLabelAr: 'مساعد إداري',
    name: 'مساعد إداري (تجريبي)',
    jobTitle: 'Assistant Admin — نطاق معين',
    initials: 'مإ',
    phone: '01000000004',
    password: 'MetroTest@2026',
  },
  {
    id: 'test-lecturer',
    role: 'lecturer',
    roleLabelAr: 'محاضر معتمد',
    name: 'محاضر معتمد (تجريبي)',
    jobTitle: 'Lecturer — إدارة الدورات',
    initials: 'مح',
    phone: '01000000005',
    password: 'MetroTest@2026',
  },
  {
    id: 'test-trainee',
    role: 'trainee',
    roleLabelAr: 'متدرب فني',
    name: 'متدرب فني (تجريبي)',
    jobTitle: 'Trainee — التعلم والاختبارات',
    initials: 'متد',
    phone: '01000000006',
    password: 'MetroTest@2026',
  },
];

export interface DemoAccountPickerProps {
  onSelectAccount: (account: RoleTestCardAccount) => void;
  isLoading?: boolean;
}

const roleBadgeVariant: Record<string, 'primary' | 'warning' | 'info' | 'danger' | 'success' | 'neutral'> = {
  developer: 'danger',
  super_admin: 'primary',
  admin: 'primary',
  assistant_admin: 'success',
  lecturer: 'warning',
  trainee: 'info',
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
          <span>حسابات الاختبار المؤقتة حسب الدور (SQL Server)</span>
        </div>
        <span className="text-[11px] text-text-muted">انقر لتعبئة رقم الموبايل وكلمة المرور تلقائياً</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {ROLE_TEST_ACCOUNTS.map((account) => (
          <div
            key={account.id}
            className="p-3.5 rounded-xl border border-border bg-surface/60 hover:bg-white hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between text-start gap-2.5 group"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <Badge
                  variant={roleBadgeVariant[account.role] || 'neutral'}
                  className="text-[10px] px-2 py-0.5 font-bold"
                >
                  {account.roleLabelAr}
                </Badge>
                <span className="text-[10px] font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border/50" dir="ltr">
                  {account.phone}
                </span>
              </div>
              <div className="text-xs font-bold text-text-heading group-hover:text-primary-dark transition-colors truncate">
                {account.name}
              </div>
              <div className="text-[11px] text-text-muted truncate">
                {account.jobTitle}
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
        ))}
      </div>
    </div>
  );
};
