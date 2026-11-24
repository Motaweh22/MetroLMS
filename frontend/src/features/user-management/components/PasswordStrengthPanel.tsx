import React from 'react';
import { Icon } from '@/shared/ui/Icon';
import { evaluatePasswordStrength } from '@/core/utils/passwordPolicy';

export interface PasswordStrengthPanelProps {
  password: string;
  phone?: string;
  name?: string;
  testIdPrefix?: string;
}

const LEVEL_STYLES = {
  weak: {
    barClass: 'bg-danger w-1/3',
    textClass: 'text-danger',
  },
  medium: {
    barClass: 'bg-warning w-2/3',
    textClass: 'text-warning-dark',
  },
  strong: {
    barClass: 'bg-success w-full',
    textClass: 'text-success-dark',
  },
} as const;

export const PasswordStrengthPanel: React.FC<PasswordStrengthPanelProps> = ({
  password,
  phone,
  name,
  testIdPrefix = 'password-strength',
}) => {
  if (!password) return null;

  const result = evaluatePasswordStrength(password, { phone, name });
  const style = LEVEL_STYLES[result.level];

  const items: Array<{ key: string; label: string; passed: boolean }> = [
    { key: 'len', label: '8 أحرف على الأقل', passed: result.checks.minLength },
    { key: 'case', label: 'حرف إنجليزي كبير وحرف صغير', passed: result.checks.hasUpperAndLower },
    { key: 'digit', label: 'رقم واحد على الأقل (0-9)', passed: result.checks.hasDigit },
    { key: 'symbol', label: 'رمز خاص مثل @ # $ % (يُقوّي الكلمة)', passed: result.checks.hasSymbol },
    { key: 'identity', label: 'لا تطابق رقم الهاتف أو الاسم', passed: result.checks.notMatchingIdentity },
  ];

  return (
    <div
      className="mt-2 p-3 rounded-lg border border-border bg-bg-alt/40 space-y-2"
      data-testid={testIdPrefix}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-muted font-medium">قوة كلمة المرور:</span>
        <span className={`font-bold ${style.textClass}`} data-testid={`${testIdPrefix}-label`}>
          {result.labelAr}
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
        <div className={`h-full transition-all duration-200 rounded-full ${style.barClass}`} />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center gap-1.5 text-[11px] ${
              item.passed ? 'text-success-dark font-medium' : 'text-text-muted'
            }`}
          >
            <Icon
              name={item.passed ? 'checkCircle' : 'xCircle'}
              size="sm"
              className={item.passed ? 'text-success shrink-0' : 'text-text-muted/60 shrink-0'}
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
