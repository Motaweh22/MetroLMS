import React, { useState, useMemo, useEffect } from 'react';
import { apiClient } from '@/core/api/apiClient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { canActorManageTargetAccount } from '@/core/permissions/policy';
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

interface CatalogItem {
  id: number | string;
  name?: string;
  nameAr?: string;
  label?: string;
  code?: string;
}

interface FormState {
  name: string;
  username: string;
  email: string;
  phone: string;
  nationalId: string;
  dateOfBirth: string;
  address: string;
  educationalQualification: string;
  maritalStatusId: string;
  militaryServiceStatusId: string;
  appointmentDate: string;
  serviceEndDate: string;
  metroLineId: string;
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
  nationalId?: string;
  dateOfBirth?: string;
  address?: string;
  educationalQualification?: string;
  maritalStatusId?: string;
  militaryServiceStatusId?: string;
  appointmentDate?: string;
  metroLineId?: string;
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
  nationalId: '',
  dateOfBirth: '',
  address: '',
  educationalQualification: '',
  maritalStatusId: '',
  militaryServiceStatusId: '',
  appointmentDate: '',
  serviceEndDate: '',
  metroLineId: '',
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
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);

  const availableRoleOptions = useMemo<UserRole[]>(() => {
    const candidateRoles: UserRole[] = ['super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];
    const actorRole = currentUser?.role || 'admin';
    return candidateRoles.filter((role) =>
      canActorManageTargetAccount(actorRole, role, 'create').allowed
    );
  }, [currentUser]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [militaryStatuses, setMilitaryStatuses] = useState<CatalogItem[]>([]);
  const [metroLines, setMetroLines] = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    Promise.allSettled([
      apiClient<{ maritalStatuses?: CatalogItem[] }>('/api/admin/organization/marital-statuses'),
      apiClient<{ militaryStatuses?: CatalogItem[] }>('/api/admin/organization/military-statuses'),
      apiClient<{ metroLines?: CatalogItem[] }>('/api/admin/organization/metro-lines'),
    ]).then(([maritalRes, militaryRes, lineRes]) => {
      if (!active) return;
      const mList = maritalRes.status === 'fulfilled' ? maritalRes.value.maritalStatuses || [] : [];
      const milList = militaryRes.status === 'fulfilled' ? militaryRes.value.militaryStatuses || [] : [];
      const lList = lineRes.status === 'fulfilled' ? lineRes.value.metroLines || [] : [];
      setMaritalStatuses(mList);
      setMilitaryStatuses(milList);
      setMetroLines(lList);
      setFormData((prev) => ({
        ...prev,
        maritalStatusId: prev.maritalStatusId || (mList[0] ? String(mList[0].id) : ''),
        militaryServiceStatusId: prev.militaryServiceStatusId || (milList[0] ? String(milList[0].id) : ''),
        metroLineId: prev.metroLineId || (lList[0] ? String(lList[0].id) : ''),
      }));
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

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

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }

    if (!formData.phone.trim()) {
      errs.phone = 'يرجى إدخال رقم الهاتف (مثال: 010XXXXXXXX أو +2010XXXXXXXX)';
    } else if (!/^(01[0125][0-9]{8}|\+201[0125][0-9]{8})$/.test(formData.phone.trim())) {
      errs.phone = 'رقم الهاتف يجب أن يكون رقم محمول مصري صحيح (010/011/012/015)';
    }

    if (!/^[0-9]{14}$/.test(formData.nationalId.trim())) {
      errs.nationalId = 'الرقم القومي يجب أن يتكون من 14 رقماً';
    }

    if (!formData.dateOfBirth) {
      errs.dateOfBirth = 'يرجى تحديد تاريخ الميلاد';
    }

    if (!formData.address.trim()) {
      errs.address = 'يرجى إدخال العنوان';
    }

    if (!formData.educationalQualification.trim()) {
      errs.educationalQualification = 'يرجى إدخال المؤهل الدراسي';
    }

    if (!formData.appointmentDate) {
      errs.appointmentDate = 'يرجى تحديد تاريخ التعيين';
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
        email: formData.email.trim() ? formData.email.trim().toLowerCase() : undefined,
        phone: formData.phone.trim(),
        nationalId: formData.nationalId.trim(),
        dateOfBirth: formData.dateOfBirth,
        address: formData.address.trim(),
        educationalQualification: formData.educationalQualification.trim(),
        maritalStatusId: formData.maritalStatusId || undefined,
        militaryServiceStatusId: formData.militaryServiceStatusId || undefined,
        appointmentDate: formData.appointmentDate,
        serviceEndDate: formData.serviceEndDate || null,
        metroLineId: formData.metroLineId || undefined,
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
              البريد الإلكتروني الوظيفي <span className="text-text-muted text-[11px]">(اختياري)</span>
            </label>
            <input
              id="add-user-email"
              data-testid="add-user-email-input"
              type="email"
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
              رقم الهاتف <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-phone"
              data-testid="add-user-phone-input"
              type="tel"
              required
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

        {/* National ID & Date of Birth */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-national-id" className="text-xs font-semibold text-text">
              الرقم القومي (14 رقماً) <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-national-id"
              data-testid="add-user-national-id-input"
              type="text"
              inputMode="numeric"
              maxLength={14}
              required
              disabled={isSubmitting}
              dir="ltr"
              placeholder="29501010100001"
              value={formData.nationalId}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, nationalId: e.target.value }));
                if (errors.nationalId) setErrors((prev) => ({ ...prev, nationalId: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none text-left ${
                errors.nationalId
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.nationalId && <span className="text-[11px] text-danger">{errors.nationalId}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-dob" className="text-xs font-semibold text-text">
              تاريخ الميلاد <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-dob"
              data-testid="add-user-dob-input"
              type="date"
              required
              disabled={isSubmitting}
              value={formData.dateOfBirth}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }));
                if (errors.dateOfBirth) setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none ${
                errors.dateOfBirth
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.dateOfBirth && <span className="text-[11px] text-danger">{errors.dateOfBirth}</span>}
          </div>
        </div>

        {/* Address & Educational Qualification */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-address" className="text-xs font-semibold text-text">
              العنوان <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-address"
              data-testid="add-user-address-input"
              type="text"
              required
              disabled={isSubmitting}
              placeholder="مثال: القاهرة - مدينة نصر"
              value={formData.address}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, address: e.target.value }));
                if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none ${
                errors.address
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.address && <span className="text-[11px] text-danger">{errors.address}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-qualification" className="text-xs font-semibold text-text">
              المؤهل الدراسي <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-qualification"
              data-testid="add-user-qualification-input"
              type="text"
              required
              disabled={isSubmitting}
              placeholder="مثال: بكالوريوس هندسة"
              value={formData.educationalQualification}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, educationalQualification: e.target.value }));
                if (errors.educationalQualification) {
                  setErrors((prev) => ({ ...prev, educationalQualification: undefined }));
                }
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none ${
                errors.educationalQualification
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.educationalQualification && (
              <span className="text-[11px] text-danger">{errors.educationalQualification}</span>
            )}
          </div>
        </div>

        {/* Marital Status & Military Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-marital" className="text-xs font-semibold text-text">
              الحالة الاجتماعية <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <select
              id="add-user-marital"
              data-testid="add-user-marital-input"
              disabled={isSubmitting}
              value={formData.maritalStatusId}
              onChange={(e) => setFormData((prev) => ({ ...prev, maritalStatusId: e.target.value }))}
              className="w-full bg-bg text-text text-sm rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary"
            >
              {maritalStatuses.length === 0 ? (
                <option value="">الافتراضي</option>
              ) : (
                maritalStatuses.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {item.nameAr || item.name || item.label || item.code || String(item.id)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-military" className="text-xs font-semibold text-text">
              الموقف من التجنيد <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <select
              id="add-user-military"
              data-testid="add-user-military-input"
              disabled={isSubmitting}
              value={formData.militaryServiceStatusId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, militaryServiceStatusId: e.target.value }))
              }
              className="w-full bg-bg text-text text-sm rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary"
            >
              {militaryStatuses.length === 0 ? (
                <option value="">الافتراضي</option>
              ) : (
                militaryStatuses.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {item.nameAr || item.name || item.label || item.code || String(item.id)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Appointment Date, Service End Date & Metro Line */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-appointment" className="text-xs font-semibold text-text">
              تاريخ التعيين <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-appointment"
              data-testid="add-user-appointment-input"
              type="date"
              required
              disabled={isSubmitting}
              value={formData.appointmentDate}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, appointmentDate: e.target.value }));
                if (errors.appointmentDate) setErrors((prev) => ({ ...prev, appointmentDate: undefined }));
              }}
              className={`w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none ${
                errors.appointmentDate
                  ? 'border-danger focus:border-danger ring-1 ring-danger'
                  : 'border-border focus:border-primary'
              }`}
            />
            {errors.appointmentDate && (
              <span className="text-[11px] text-danger">{errors.appointmentDate}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-service-end" className="text-xs font-semibold text-text">
              تاريخ انتهاء الخدمة <span className="text-text-muted text-[11px]">(اختياري)</span>
            </label>
            <input
              id="add-user-service-end"
              data-testid="add-user-service-end-input"
              type="date"
              disabled={isSubmitting}
              value={formData.serviceEndDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, serviceEndDate: e.target.value }))}
              className="w-full bg-bg text-text text-sm rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-metro-line" className="text-xs font-semibold text-text">
              خط المترو <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <select
              id="add-user-metro-line"
              data-testid="add-user-metro-line-input"
              disabled={isSubmitting}
              value={formData.metroLineId}
              onChange={(e) => setFormData((prev) => ({ ...prev, metroLineId: e.target.value }))}
              className="w-full bg-bg text-text text-sm rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary"
            >
              {metroLines.length === 0 ? (
                <option value="">الافتراضي</option>
              ) : (
                metroLines.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {item.nameAr || item.name || item.label || item.code || String(item.id)}
                  </option>
                ))
              )}
            </select>
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
              {availableRoleOptions.map((role) => (
                <option key={role} value={role}>
                  {USER_ROLE_LABELS_AR[role]} ({role === 'user' ? 'متدرب' : role === 'lecturer' ? 'محاضر' : role === 'assistant_admin' ? 'مساعد مدير' : role === 'admin' ? 'مدير النظام' : 'المسؤول الأعلى'})
                </option>
              ))}
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
