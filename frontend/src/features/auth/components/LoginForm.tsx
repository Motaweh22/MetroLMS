import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DemoAccountPicker } from './DemoAccountPicker';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import type { SyntheticMockAccount } from '@/core/auth/demoAccounts';

export interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'يرجى إدخال البريد الإلكتروني الوظيفي';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }

    if (!password) {
      errors.password = 'يرجى إدخال كلمة المرور';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validate()) return;

    try {
      await login({ email: email.trim(), password });
      onSuccess?.();
    } catch {
      // Error is captured in AuthContext and rendered in .login-error
    }
  };

  const handleSelectDemoAccount = (account: SyntheticMockAccount) => {
    setEmail(account.credentials.email);
    setPassword(account.credentials.password);
    setFieldErrors({});
    clearError();
  };

  return (
    <>
      {/* Error Message Box matching legacy .login-error */}
      {error && (
        <div className="login-error visible" id="login-error" role="alert">
          {error}
        </div>
      )}

      {/* Main Login Form matching legacy markup */}
      <form className="login-form" id="login-form" onSubmit={handleSubmit} noValidate>
        {/* Username / Email Input Group */}
        <div className="input-group">
          <label htmlFor="username">رقم المستخدم / البريد الإلكتروني الوظيفي</label>
          <div className="input-wrapper">
            <input
              type="text"
              id="username"
              name="username"
              placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
              required
              autoComplete="username"
              value={email}
              disabled={isLoading}
              className={fieldErrors.email ? 'input-has-error' : ''}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
                if (error) clearError();
              }}
            />
            <span className="input-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
          </div>
          {fieldErrors.email && (
            <div className="input-field-error">{fieldErrors.email}</div>
          )}
        </div>

        {/* Password Input Group with visibility toggle */}
        <div className="input-group">
          <label htmlFor="password">كلمة المرور</label>
          <div className="input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              placeholder="أدخل كلمة المرور"
              required
              autoComplete="current-password"
              value={password}
              disabled={isLoading}
              className={fieldErrors.password ? 'input-has-error' : ''}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
                if (error) clearError();
              }}
            />
            <span className="input-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <button
              type="button"
              className="password-toggle"
              id="password-toggle"
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  id="eye-icon"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  id="eye-icon"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <div className="input-field-error">{fieldErrors.password}</div>
          )}
        </div>

        {/* Submit button with loading state */}
        <button
          type="submit"
          className={`login-btn ${isLoading ? 'loading' : ''}`}
          id="login-btn"
          aria-label="تسجيل الدخول إلى المنظومة"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              جارِ تسجيل الدخول
              <span className="spinner" aria-hidden="true" />
            </>
          ) : (
            'تسجيل الدخول'
          )}
        </button>
      </form>

      {/* Footer Links matching legacy design */}
      <div className="login-footer-links">
        <button
          type="button"
          id="link-forgot-password"
          onClick={() => setShowForgotModal(true)}
        >
          نسيت كلمة المرور؟
        </button>
        <button
          type="button"
          id="link-whatsapp-support"
          data-testid="login-whatsapp-support-btn"
          className="link-whatsapp-support text-emerald-600 hover:text-emerald-700 font-semibold"
          onClick={() => {
            const fabBtn = document.getElementById('wa-fab-btn');
            if (fabBtn) fabBtn.click();
          }}
        >
          الدعم عبر واتساب 💬
        </button>
        <button
          type="button"
          id="link-signup"
          className="link-signup"
          onClick={() => setShowSignupModal(true)}
        >
          إنشاء حساب جديد
        </button>
      </div>

      {/* Decorative Metro Line matching legacy markup */}
      <div className="train-line-decoration" aria-hidden="true">
        <span className="train-dot" />
        <span className="train-line" />
        <span className="train-dot active" />
        <span className="train-line" />
        <span className="train-dot" />
        <span className="train-line" />
        <span className="train-dot" />
      </div>

      {/* Synthetic Demo Account Switcher */}
      <div className="mt-4 pt-4 border-t border-dashed border-border/80">
        <DemoAccountPicker
          onSelectAccount={handleSelectDemoAccount}
          isLoading={isLoading}
        />
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="استعادة كلمة المرور"
        size="sm"
      >
        <div className="space-y-4 text-sm leading-relaxed text-text">
          <p className="text-text-muted">
            يرجى إدخال اسم المستخدم أو الرقم الوظيفي لإرسال طلب استعادة كلمة المرور إلى إدارة التدريب بالشركة المصرية لإدارة وتشغيل المترو.
          </p>
          <div className="p-3 bg-surface rounded-lg border border-border text-xs text-text-muted">
            يمكنك أيضاً التواصل المباشر مع الدعم الفني للإدارة العامة للتدريب عبر قنوات الاتصال الداخلية.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForgotModal(false)}
            >
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sign Up Info Modal */}
      <Modal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        title="إنشاء حساب متدرب جديد"
        size="sm"
      >
        <div className="space-y-4 text-sm leading-relaxed text-text">
          <p className="text-text-muted">
            يتم تسجيل وتفعيل حسابات المتدربين والمدربين بصورة مركزية من خلال إدارة التدريب بناءً على بيانات السجل الوظيفي المعتمدة.
          </p>
          <div className="p-3 bg-primary-light/40 rounded-lg border border-primary/20 text-xs text-primary-dark font-medium">
            للحصول على حساب جديد، يرجى التوجه إلى منسق التدريب بالقطاع التابع لك لتسجيل بياناتك.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowSignupModal(false)}
            >
              حسناً، فهمت
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LoginForm;
