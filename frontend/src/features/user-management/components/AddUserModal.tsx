import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';
import {
  METRO_DEPARTMENTS,
  METRO_JOB_TITLES,
  USER_ROLE_LABELS_AR,
  USER_STATUS_LABELS_AR,
  type CreateUserRequestDTO,
  type ManagedUserDTO,
  type UserRole,
  type UserStatus,
} from '@/core/user-management/types';
import { userManagementApi } from '../services/userManagementApi';

export interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (newUser: ManagedUserDTO) => void;
}

interface FormState {
  name: string;
  username: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  password: string;
}

interface FormErrors {
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  role?: string;
  status?: string;
}

const INITIAL_FORM_STATE: FormState = {
  name: '',
  username: '',
  email: '',
  phone: '',
  jobTitle: METRO_JOB_TITLES[4] || 'مهندس تشغيل',
  department: METRO_DEPARTMENTS[4] || 'قطاع التشغيل',
  role: 'user',
  status: 'active',
  password: '',
};

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
}) => {
  const toast = useToast();
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setErrors({});
    setGeneralError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!formData.name.trim()) {
      errs.name = 'يرجى إدخال الاسم الكامل للمستخدم';
    }

    if (!formData.username.trim()) {
      errs.username = 'يرجى إدخال اسم المستخدم';
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username.trim())) {
      errs.username = 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام وشرطة سفلية فقط';
    }

    if (!formData.email.trim()) {
      errs.email = 'يرجى إدخال البريد الإلكتروني الوظيفي';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }

    if (formData.phone.trim() && !/^[0-9+\s-]{8,15}$/.test(formData.phone.trim())) {
      errs.phone = 'رقم الهاتف يجب أن يحتوي على أرقام صحيحة';
    }

    if (!formData.jobTitle.trim()) {
      errs.jobTitle = 'يرجى تحديد أو إدخال المسمى الوظيفي';
    }

    if (!formData.department.trim()) {
      errs.department = 'يرجى اختيار القطاع أو الإدارة';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload: CreateUserRequestDTO = {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        jobTitle: formData.jobTitle.trim(),
        department: formData.department.trim(),
        role: formData.role,
        status: formData.status,
        password: formData.password.trim() || undefined,
      };

      const newUser = await userManagementApi.createUser(payload);
      if ((newUser as unknown as { approvalRequired?: boolean; message?: string }).approvalRequired) {
        toast.info(
          (newUser as unknown as { message?: string }).message ||
            `تم إرسال طلب إنشاء المستخدم "${payload.name}" للاعتماد؛ بانتظار موافقة مدير النظام.`
        );
        handleClose();
      } else {
        toast.success(`تمت إضافة المستخدم "${newUser.name}" بنجاح إلى دليل النظام.`);
        onUserCreated(newUser);
        handleClose();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'تعذر إضافة المستخدم. يرجى المحاولة مرة أخرى.';
      setGeneralError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="إضافة مستخدم جديد إلى دليل النظام"
      size="lg"
      dataTestId="add-user-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right" noValidate>
        {generalError && (
          <Alert
            variant="danger"
            title="تعذر إضافة المستخدم"
            data-testid="add-user-form-error"
          >
            {generalError}
          </Alert>
        )}

        {/* Name & Username */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-name" className="text-xs font-semibold text-text">
              الاسم الكامل <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-name"
              data-testid="add-user-name-input"
              type="text"
              required
              disabled={isSubmitting}
              placeholder="مثال: م. طارق محمد عبد الرحمن"
              value={formData.name}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none ${
                errors.name
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.name && <span className="text-[11px] text-danger">{errors.name}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-username" className="text-xs font-semibold text-text">
              اسم المستخدم <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-username"
              data-testid="add-user-username-input"
              type="text"
              required
              disabled={isSubmitting}
              dir="ltr"
              placeholder="e.g. tarek_abdelrahman"
              value={formData.username}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, username: e.target.value }));
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none text-left ${
                errors.username
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.username && <span className="text-[11px] text-danger">{errors.username}</span>}
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-email" className="text-xs font-semibold text-text">
              البريد الإلكتروني الوظيفي <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-email"
              data-testid="add-user-email-input"
              type="email"
              required
              disabled={isSubmitting}
              dir="ltr"
              placeholder="e.g. tarek@cairo-metro.com"
              value={formData.email}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, email: e.target.value }));
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none text-left ${
                errors.email
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.email && <span className="text-[11px] text-danger">{errors.email}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-phone" className="text-xs font-semibold text-text">
              رقم الهاتف <span className="text-text-muted text-[11px]">(اختياري)</span>
            </label>
            <input
              id="add-user-phone"
              data-testid="add-user-phone-input"
              type="tel"
              disabled={isSubmitting}
              dir="ltr"
              placeholder="010XXXXXXXX"
              value={formData.phone}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, phone: e.target.value }));
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none text-left ${
                errors.phone
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.phone && <span className="text-[11px] text-danger">{errors.phone}</span>}
          </div>
        </div>

        {/* Job Title & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-job" className="text-xs font-semibold text-text">
              المسمى الوظيفي <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-job"
              data-testid="add-user-job-input"
              type="text"
              list="metro-job-titles-list"
              required
              disabled={isSubmitting}
              placeholder="اختر أو اكتب المسمى الوظيفي"
              value={formData.jobTitle}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, jobTitle: e.target.value }));
                if (errors.jobTitle) setErrors((prev) => ({ ...prev, jobTitle: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none ${
                errors.jobTitle
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            <datalist id="metro-job-titles-list">
              {METRO_JOB_TITLES.map((title) => (
                <option key={title} value={title} />
              ))}
            </datalist>
            {errors.jobTitle && <span className="text-[11px] text-danger">{errors.jobTitle}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-dept" className="text-xs font-semibold text-text">
              القطاع / الإدارة <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <select
              id="add-user-dept"
              data-testid="add-user-dept-input"
              required
              disabled={isSubmitting}
              value={formData.department}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, department: e.target.value }));
                if (errors.department) setErrors((prev) => ({ ...prev, department: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none ${
                errors.department
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            >
              {METRO_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            {errors.department && (
              <span className="text-[11px] text-danger">{errors.department}</span>
            )}
          </div>
        </div>

        {/* Role & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-role" className="text-xs font-semibold text-text">
              الدور الوظيفي <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <select
              id="add-user-role"
              data-testid="add-user-role-input"
              required
              disabled={isSubmitting}
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value as UserRole }))
              }
              className="w-full bg-bg text-text text-sm rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary"
            >
              <option value="user">{USER_ROLE_LABELS_AR.user} (متدرب)</option>
              <option value="lecturer">{USER_ROLE_LABELS_AR.lecturer} (محاضر)</option>
              <option value="assistant_admin">{USER_ROLE_LABELS_AR.assistant_admin} (مساعد مدير)</option>
              <option value="admin">{USER_ROLE_LABELS_AR.admin} (مدير النظام)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-status" className="text-xs font-semibold text-text">
              حالة الحساب الأولية
            </label>
            <select
              id="add-user-status"
              data-testid="add-user-status-input"
              disabled={isSubmitting}
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value as UserStatus }))
              }
              className="w-full bg-bg text-text text-sm rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary"
            >
              <option value="active">{USER_STATUS_LABELS_AR.active} (متاح للدخول والترشيح)</option>
              <option value="suspended">{USER_STATUS_LABELS_AR.suspended} (معطل)</option>
            </select>
          </div>
        </div>

        {/* Optional Mock Password for Development / Demo testing */}
        <div className="flex flex-col gap-1.5 pt-1">
          <label htmlFor="add-user-password" className="text-xs font-semibold text-text">
            كلمة المرور التجريبية <span className="text-text-muted text-[11px]">(اختياري — للاختبار والتطوير)</span>
          </label>
          <input
            id="add-user-password"
            data-testid="add-user-password-input"
            type="password"
            disabled={isSubmitting}
            dir="ltr"
            placeholder="كلمة مرور الدخول التجريبي (يتم حفظها في مستودع الاعتماد المنفصل)"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            className="w-full bg-bg text-text text-sm rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary text-left"
          />
          <p className="text-[11px] text-text-muted">
            ملاحظة معمارية: وفقاً لقواعد أمن البيانات، لا تُخزن كلمات المرور أبداً داخل سجل دليل المستخدمين DTO.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
            data-testid="add-user-cancel-btn"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            data-testid="add-user-submit-btn"
          >
            إضافة المستخدم
          </Button>
        </div>
      </form>
    </Modal>
  );
};
