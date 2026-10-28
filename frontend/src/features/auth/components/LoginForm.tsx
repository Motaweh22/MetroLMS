import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DemoAccountPicker } from './DemoAccountPicker';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { brandConfig } from '@/shared/config/brand';
import { buildWhatsAppUrl, usePublicSupportContacts } from '@/features/whatsapp';
import type { SyntheticMockAccount } from '@/core/auth/demoAccounts';

const SIGNUP_DRAFT_MESSAGE =
  'مرحبًا، أرغب في إنشاء حساب جديد على منصة التدريب الإلكتروني. يرجى إرشادي إلى خطوات التسجيل.';

const FORGOT_PASSWORD_DRAFT_MESSAGE =
  'مرحبًا، أحتاج إلى المساعدة في استعادة كلمة المرور لحسابي على منصة التدريب الإلكتروني.';


const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.174L2.054 21.52a.75.75 0 00.926.926l4.346-1.384A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-4.708 6.07c.22-.494.46-.504.675-.513.176-.008.377-.008.577-.008.2 0 .526.075.802.377.276.3 1.053 1.028 1.053 2.51 0 1.482 1.078 2.91 1.229 3.111.15.2 2.08 3.324 5.127 4.512.723.282 1.288.45 1.728.59.726.23 1.386.198 1.908.12.58-.087 1.779-.727 2.03-1.428.25-.702.25-1.304.175-1.429-.075-.125-.276-.2-.577-.35-.3-.151-1.78-.878-2.055-.978-.276-.1-.476-.15-.677.15-.2.301-.776.978-.952 1.179-.175.2-.35.226-.651.075-.3-.15-1.267-.467-2.414-1.49-.893-.796-1.496-1.78-1.671-2.08-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.15-.175.2-.3.301-.501.1-.2.05-.376-.025-.526-.076-.151-.677-1.631-.928-2.233z"
      fill="#ffffff"
    />
  </svg>
);

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

  // Contextual WhatsApp support contacts dynamically resolved per scenario
  const {
    contacts: signupContacts,
    count: signupCount,
    isLoading: isSignupLoading,
    error: signupError,
    refetch: refetchSignup,
  } = usePublicSupportContacts('account_registration');

  const {
    contacts: forgotContacts,
    count: forgotCount,
    isLoading: isForgotLoading,
    error: forgotError,
    refetch: refetchForgot,
  } = usePublicSupportContacts('password_recovery');

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
    <div className="login-surface-wrapper">
      {/* ── Main Two-Column Horizontal Card on Desktop ── */}
      <div className="login-card">
        {/* Right Column: Branding & Welcome (In Arabic RTL, this sits on the right) */}
        <div className="login-brand-pane">
          {/* Top Logo Group: Training Administration and Cairo Metro side-by-side */}
          <div className="login-logos">
            <img
              src={brandConfig.logos.training}
              alt="إدارة التدريب"
              id="training-logo"
            />
            <div className="logos-divider" aria-hidden="true" />
            <img
              src={brandConfig.logos.primary}
              alt="مترو القاهرة"
              id="metro-logo"
            />
          </div>

          {/* Branding Content Section below Logos */}
          <div className="login-brand-content">
            {/* Official Portal Status Pill */}
            <div className="brand-status-pill">
              <span className="brand-pulse-dot" aria-hidden="true" />
              <span>البوابة الرقمية المعتمدة للتدريب والتأهيل</span>
            </div>

            {/* Title and Subtitle matching exact typographic hierarchy */}
            <h1 className="login-title">منصة التدريب الإلكتروني</h1>
            <p className="login-subtitle">الشركة المصرية لإدارة وتشغيل مترو القاهرة</p>

            {/* Welcoming Narrative */}
            <p className="login-description">
              بوابة التأهيل والتدريب الرقمي الموحدة. سجّل الدخول لمتابعة مساراتك التدريبية، المقررات التخصصية، وسجلات الاعتماد المهني.
            </p>
          </div>
        </div>

        {/* Left Column: Sign-in Form (In Arabic RTL, this sits on the left) */}
        <div className="login-form-pane">
          <div className="login-form-header">
            <h2 className="login-form-heading">تسجيل الدخول</h2>
            <p className="login-form-subheading">أدخل اسم المستخدم أو البريد الإلكتروني للمتابعة</p>
          </div>

          {/* Error Message Box matching legacy .login-error */}
          {error && (
            <div className="login-error visible" id="login-error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Main Login Form */}
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

          {/* Footer Links */}
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
              id="link-signup"
              className="link-signup"
              onClick={() => setShowSignupModal(true)}
            >
              إنشاء حساب جديد
            </button>
          </div>
        </div>
      </div>

      {/* ── Demo Accounts Section (Full-Width Responsive Surface beneath Main Card) ── */}
      <div className="login-demo-container">
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
        size={forgotCount > 1 ? 'md' : 'sm'}
      >
        <div className="space-y-4 text-sm leading-relaxed text-text">
          <p className="text-text-muted">
            لاستعادة كلمة المرور أو إعادة ضبط بيانات الدخول الخاصة بحسابك، يرجى التواصل المباشر مع فريق الدعم الفني لإدارة التدريب عبر واتساب:
          </p>

          {/* Loading State */}
          {isForgotLoading && (
            <div className="flex items-center justify-center py-6 text-text-muted gap-2 text-xs" data-testid="forgot-wa-loading">
              <span className="spinner" aria-hidden="true" />
              <span>جارٍ تحميل بيانات مسؤولي التواصل...</span>
            </div>
          )}

          {/* Error State */}
          {!isForgotLoading && forgotError && (
            <div
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs text-red-800 dark:text-red-200 flex items-center justify-between gap-2"
              role="alert"
              data-testid="forgot-wa-error"
            >
              <span>{forgotError}</span>
              <button
                type="button"
                onClick={() => refetchForgot()}
                className="text-xs text-primary font-bold hover:underline cursor-pointer shrink-0"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Zero Contacts: Unavailable State */}
          {!isForgotLoading && !forgotError && forgotCount === 0 && (
            <div
              className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed"
              data-testid="forgot-wa-unavailable"
            >
              <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                <span aria-hidden="true">ℹ️</span>
                <span>خدمة التواصل عبر واتساب غير متوفرة حالياً</span>
              </div>
              <p>
                لا تتوفر جهات اتصال نشطة حالياً لاستقبال طلبات استعادة كلمة المرور عبر واتساب. يرجى مراجعة إدارة التدريب أو التواصل عبر القنوات الداخلية المعتمدة.
              </p>
            </div>
          )}

          {/* Exactly One Contact: Prominent Direct Contact Action */}
          {!isForgotLoading && !forgotError && forgotCount === 1 && (
            <div className="space-y-3">
              {forgotContacts[0] && (
                <div className="text-xs text-text-muted flex items-center gap-1.5">
                  <span className="font-medium text-text">المسؤول:</span>
                  <span>{forgotContacts[0].name}</span>
                  {forgotContacts[0].department && <span>— {forgotContacts[0].department}</span>}
                </div>
              )}
              <a
                href={buildWhatsAppUrl(forgotContacts[0].number, FORGOT_PASSWORD_DRAFT_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-whatsapp-btn"
                id="forgot-password-whatsapp-btn"
                data-testid="forgot-password-whatsapp-btn"
              >
                <WhatsAppIcon className="modal-whatsapp-icon" />
                <span>تواصل مع الدعم</span>
              </a>
            </div>
          )}

          {/* Multiple Contacts: Coordinator Selection List */}
          {!isForgotLoading && !forgotError && forgotCount > 1 && (
            <div className="space-y-2.5" data-testid="forgot-wa-multiple-contacts">
              <div className="text-xs font-bold text-text">
                اختر منسق الدعم المناسب للتواصل:
              </div>
              <p className="text-[11px] text-text-muted">
                يتوفر أكثر من مسؤول لمساعدتك، يرجى اختيار المسؤول المختص بقطاعك:
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {forgotContacts.map((contact, idx) => (
                  <div
                    key={contact.id || idx}
                    className="p-2.5 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors"
                    data-testid={`wa-contact-option-${contact.id}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-300 dark:border-emerald-700">
                        {contact.avatarInitial || contact.name[0] || 'م'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text truncate">{contact.name}</div>
                        <div className="text-[10px] text-text-muted truncate">
                          {contact.jobTitle} {contact.department ? `• ${contact.department}` : ''}
                        </div>
                      </div>
                    </div>

                    <a
                      href={buildWhatsAppUrl(contact.number, FORGOT_PASSWORD_DRAFT_MESSAGE)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shrink-0 shadow-2xs"
                      data-testid={`wa-contact-btn-${contact.id}`}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>مراسلة</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
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
        title="إنشاء حساب جديد"
        size={signupCount > 1 ? 'md' : 'sm'}
      >
        <div className="space-y-4 text-sm leading-relaxed text-text">
          <p className="text-text-muted">
            يتم تسجيل وتفعيل حسابات المتدربين والمدربين بصورة مركزية من خلال إدارة التدريب. لبدء خطوات التسجيل أو الحصول على حساب جديد، يرجى التواصل مع الدعم الفني عبر واتساب:
          </p>

          {/* Loading State */}
          {isSignupLoading && (
            <div className="flex items-center justify-center py-6 text-text-muted gap-2 text-xs" data-testid="signup-wa-loading">
              <span className="spinner" aria-hidden="true" />
              <span>جارٍ تحميل بيانات مسؤولي التواصل...</span>
            </div>
          )}

          {/* Error State */}
          {!isSignupLoading && signupError && (
            <div
              className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-xs text-red-800 dark:text-red-200 flex items-center justify-between gap-2"
              role="alert"
              data-testid="signup-wa-error"
            >
              <span>{signupError}</span>
              <button
                type="button"
                onClick={() => refetchSignup()}
                className="text-xs text-primary font-bold hover:underline cursor-pointer shrink-0"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Zero Contacts: Unavailable State */}
          {!isSignupLoading && !signupError && signupCount === 0 && (
            <div
              className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed"
              data-testid="signup-wa-unavailable"
            >
              <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                <span aria-hidden="true">ℹ️</span>
                <span>خدمة التواصل عبر واتساب غير متوفرة حالياً</span>
              </div>
              <p>
                لا تتوفر جهات اتصال نشطة حالياً لاستقبال طلبات إنشاء الحسابات عبر واتساب. يرجى التوجه إلى منسق التدريب بالقطاع التابع لك أو مراجعة إدارة التدريب المركزية بالشركة.
              </p>
            </div>
          )}

          {/* Exactly One Contact: Prominent Direct Contact Action */}
          {!isSignupLoading && !signupError && signupCount === 1 && (
            <div className="space-y-3">
              {signupContacts[0] && (
                <div className="text-xs text-text-muted flex items-center gap-1.5">
                  <span className="font-medium text-text">المسؤول:</span>
                  <span>{signupContacts[0].name}</span>
                  {signupContacts[0].department && <span>— {signupContacts[0].department}</span>}
                </div>
              )}
              <a
                href={buildWhatsAppUrl(signupContacts[0].number, SIGNUP_DRAFT_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-whatsapp-btn"
                id="signup-whatsapp-btn"
                data-testid="signup-whatsapp-btn"
              >
                <WhatsAppIcon className="modal-whatsapp-icon" />
                <span>تواصل مع الدعم</span>
              </a>
            </div>
          )}

          {/* Multiple Contacts: Coordinator Selection List */}
          {!isSignupLoading && !signupError && signupCount > 1 && (
            <div className="space-y-2.5" data-testid="signup-wa-multiple-contacts">
              <div className="text-xs font-bold text-text">
                اختر منسق الدعم المناسب للتواصل:
              </div>
              <p className="text-[11px] text-text-muted">
                يتوفر أكثر من مسؤول لمساعدتك، يرجى اختيار المسؤول المختص بقطاعك:
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {signupContacts.map((contact, idx) => (
                  <div
                    key={contact.id || idx}
                    className="p-2.5 rounded-lg border border-border bg-surface flex items-center justify-between gap-3 hover:border-emerald-500/40 transition-colors"
                    data-testid={`wa-contact-option-${contact.id}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-300 dark:border-emerald-700">
                        {contact.avatarInitial || contact.name[0] || 'م'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text truncate">{contact.name}</div>
                        <div className="text-[10px] text-text-muted truncate">
                          {contact.jobTitle} {contact.department ? `• ${contact.department}` : ''}
                        </div>
                      </div>
                    </div>

                    <a
                      href={buildWhatsAppUrl(contact.number, SIGNUP_DRAFT_MESSAGE)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shrink-0 shadow-2xs"
                      data-testid={`wa-contact-btn-${contact.id}`}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>مراسلة</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSignupModal(false)}
            >
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LoginForm;
