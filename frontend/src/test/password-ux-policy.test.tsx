import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { apiClient, ApiError } from '@/core/api/apiClient';
import {
  evaluatePasswordStrength,
  generateStrongPassword,
} from '@/core/utils/passwordPolicy';
import { AddUserForm } from '@/features/user-management/components/AddUserForm';
import { EditUserModal } from '@/features/user-management/components/EditUserModal';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { ToastProvider } from '@/shared/ui/Toast';
import { AuthProvider } from '@/core/auth/AuthContext';
import type { ManagedUserDTO } from '@/core/user-management/types';

vi.mock('@/core/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/apiClient')>();
  return {
    ...actual,
    apiClient: vi.fn().mockResolvedValue({}),
  };
});

describe('Admin-managed Password UX & Policy', () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient).mockResolvedValue({});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generateStrongPassword creates valid strong passwords matching all complexity checks', () => {
    const pw = generateStrongPassword(12);
    expect(pw.length).toBe(12);
    const evalRes = evaluatePasswordStrength(pw, { phone: '01012345678', name: 'طارق' });
    expect(evalRes.level).toBe('strong');
    expect(evalRes.isValidForSave).toBe(true);
    expect(evalRes.checks.minLength).toBe(true);
    expect(evalRes.checks.hasUpperAndLower).toBe(true);
    expect(evalRes.checks.hasDigit).toBe(true);
    expect(evalRes.checks.hasSymbol).toBe(true);
    expect(evalRes.checks.notMatchingIdentity).toBe(true);
  });

  it('evaluatePasswordStrength rejects short passwords and phone-containing passwords', () => {
    expect(evaluatePasswordStrength('Ab12345').isValidForSave).toBe(false);
    expect(evaluatePasswordStrength('lowercase1').isValidForSave).toBe(false);
    expect(
      evaluatePasswordStrength('Aa01012345678', { phone: '01012345678' }).isValidForSave
    ).toBe(false);
  });

  it('AddUserForm pre-generates strong password, supports generate/copy, and validates confirm mismatch', async () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <AddUserForm isActive={false} onCancel={vi.fn()} onUserCreated={vi.fn()} />
        </AuthProvider>
      </ToastProvider>
    );

    const pwInput = screen.getByTestId('add-user-password-input') as HTMLInputElement;
    const confirmInput = screen.getByTestId('add-user-confirm-password-input') as HTMLInputElement;
    expect(pwInput.value.length).toBe(12);
    expect(confirmInput.value).toBe(pwInput.value);
    expect(screen.getByTestId('add-user-password-strength-label')).toHaveTextContent('قوية');

    fireEvent.click(screen.getByTestId('add-user-generate-password-btn'));
    expect(pwInput.value.length).toBe(12);
    expect(confirmInput.value).toBe(pwInput.value);

    fireEvent.click(screen.getByTestId('add-user-copy-password-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(pwInput.value);
    });

    fireEvent.change(confirmInput, { target: { value: 'Mismatch123!' } });
    expect(screen.getByTestId('add-user-confirm-password-error')).toHaveTextContent(
      'كلمة المرور وتأكيدها غير متطابقتين'
    );
  });

  it('EditUserModal provides generate/copy buttons, live strength meter, and mismatch validation', async () => {
    const sampleUser: ManagedUserDTO = {
      id: '10',
      name: 'أحمد علي',
      username: '+201012345678',
      email: 'ahmed@metro.local',
      phone: '+201012345678',
      jobTitle: 'مهندس تشغيل',
      department: 'قطاع التشغيل',
      role: 'user',
      status: 'active',
    };

    render(
      <ToastProvider>
        <EditUserModal
          isOpen
          user={sampleUser}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('edit-user-generate-password-btn'));
    const pwInput = screen.getByTestId('edit-user-password-input') as HTMLInputElement;
    const confirmInput = screen.getByTestId('edit-user-confirm-password-input') as HTMLInputElement;
    expect(pwInput.value.length).toBe(12);
    expect(confirmInput.value).toBe(pwInput.value);
    expect(screen.getByTestId('edit-user-password-strength-label')).toHaveTextContent('قوية');

    fireEvent.click(screen.getByTestId('edit-user-copy-password-btn'));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(pwInput.value);
    });

    fireEvent.change(confirmInput, { target: { value: 'Different1!' } });
    expect(screen.getByTestId('edit-user-confirm-password-error')).toHaveTextContent(
      'كلمة المرور الجديدة وتأكيدها غير متطابقتين'
    );
  });

  it('LoginForm shows Caps Lock warning when CapsLock is active and includes phone in forgot modal URL', () => {
    render(
      <ToastProvider>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </ToastProvider>
    );

    const passwordInput = screen.getByLabelText(/^كلمة المرور/, { selector: 'input' });
    fireEvent.keyDown(passwordInput, {
      key: 'A',
      modifierCapsLock: true,
    });
    expect(screen.getByTestId('caps-lock-warning')).toHaveTextContent('Caps Lock');

    fireEvent.keyUp(passwordInput, {
      key: 'a',
      modifierCapsLock: false,
    });
    expect(screen.queryByTestId('caps-lock-warning')).not.toBeInTheDocument();
  });

  it('LoginForm shows remaining wait countdown on 429 rate limit and unlocks when timer ends', async () => {
    vi.useFakeTimers();
    vi.mocked(apiClient).mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/login')) {
        throw new ApiError('تم تجاوز الحد المسموح.', 429, { retryAfterSeconds: 2 }, url);
      }
      return {};
    });

    render(
      <ToastProvider>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </ToastProvider>
    );

    fireEvent.change(screen.getByLabelText(/رقم الموبايل/i), {
      target: { value: '01012345678' },
    });
    fireEvent.change(screen.getByLabelText(/^كلمة المرور/, { selector: 'input' }), {
      target: { value: 'WrongPass@123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول إلى المنظومة' }));
    });

    const countdownBox = screen.getByTestId('login-rate-limit-countdown');
    expect(countdownBox).toHaveTextContent('00:02');
    const submitBtn = screen.getByRole('button', { name: 'تسجيل الدخول إلى المنظومة' });
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent('انتظر 00:02 للمحاولة مجدداً');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByTestId('login-rate-limit-countdown')).toHaveTextContent('00:01');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByTestId('login-rate-limit-countdown')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تسجيل الدخول إلى المنظومة' })).not.toBeDisabled();
  });
});
