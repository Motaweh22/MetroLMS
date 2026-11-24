import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getEgyptMobileLiveError, sanitizeEgyptMobile11 } from '@/core/utils/numericInput';
import { AddUserForm } from '@/features/user-management/components/AddUserForm';
import { ToastProvider } from '@/shared/ui/Toast';
import { AuthProvider } from '@/core/auth/AuthContext';

vi.mock('@/core/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/apiClient')>();
  return {
    ...actual,
    apiClient: vi.fn().mockResolvedValue({}),
  };
});

describe('Egyptian 11-digit mobile validation & live error messages', () => {
  it('sanitizes input strictly to 11 local digits and converts pasted +20 numbers', () => {
    expect(sanitizeEgyptMobile11('0101234567899')).toBe('01012345678');
    expect(sanitizeEgyptMobile11('+201012345678')).toBe('01012345678');
    expect(sanitizeEgyptMobile11('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678');
    expect(sanitizeEgyptMobile11('abc010-1234')).toBe('0101234');
  });

  it('returns immediate Arabic error messages for invalid prefix and incomplete length', () => {
    expect(getEgyptMobileLiveError('5', false)).toContain('010');
    expect(getEgyptMobileLiveError('02', false)).toContain('010');
    expect(getEgyptMobileLiveError('019', false)).toContain('كود الشبكة غير صحيح');
    expect(getEgyptMobileLiveError('010123', false)).toBeUndefined();
    expect(getEgyptMobileLiveError('010123', true)).toContain('رقم الهاتف غير مكتمل (6 من 11 رقماً)');
    expect(getEgyptMobileLiveError('01012345678', true)).toBeUndefined();
    expect(getEgyptMobileLiveError('01598765432', true)).toBeUndefined();
  });

  it('displays live Arabic error under AddUserForm phone field on invalid prefix and blur', () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <AddUserForm isActive={false} onCancel={vi.fn()} onUserCreated={vi.fn()} />
        </AuthProvider>
      </ToastProvider>
    );

    const phoneInput = screen.getByTestId('add-user-phone-input') as HTMLInputElement;

    fireEvent.change(phoneInput, { target: { value: '019' } });
    expect(screen.getByTestId('add-user-phone-error')).toHaveTextContent(
      'كود الشبكة غير صحيح؛ يجب أن يبدأ الرقم بـ 010 أو 011 أو 012 أو 015'
    );

    fireEvent.change(phoneInput, { target: { value: '010123' } });
    fireEvent.blur(phoneInput);
    expect(screen.getByTestId('add-user-phone-error')).toHaveTextContent(
      'رقم الهاتف غير مكتمل (6 من 11 رقماً)'
    );

    fireEvent.change(phoneInput, { target: { value: '01012345678' } });
    expect(screen.queryByTestId('add-user-phone-error')).not.toBeInTheDocument();
  });
});
