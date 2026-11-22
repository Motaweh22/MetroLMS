import React, { useState, useMemo, useEffect, useRef } from 'react';
import { apiClient } from '@/core/api/apiClient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { canActorManageTargetAccount } from '@/core/permissions/policy';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';
import {
  USER_ROLE_LABELS_AR,
  USER_STATUS_LABELS_AR,
  formatMaritalStatusByGender,
  detectGenderFromNationalId,
  type CreateUserRequestDTO,
  type ManagedUserDTO,
  type UserGender,
  type UserRole,
  type UserStatus,
} from '@/core/user-management/types';
import { userManagementApi } from '../services/userManagementApi';
import { StyledSelect } from './StyledSelect';

interface CatalogItem {
  id: number | string;
  name?: string;
  nameAr?: string;
  label?: string;
  code?: string;
  departmentId?: number | null;
}

interface FormState {
  name: string;
  username: string;
  email: string;
  phone: string;
  gender: UserGender;
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
  leadershipTitle: string;
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
  appointmentDate?: string;
  jobTitle?: string;
  department?: string;
}

const INITIAL_FORM_STATE: FormState = {
  name: '',
  username: '',
  email: '',
  phone: '',
  gender: 'male',
  nationalId: '',
  dateOfBirth: '',
  address: '',
  educationalQualification: '',
  maritalStatusId: '',
  militaryServiceStatusId: '',
  appointmentDate: '',
  serviceEndDate: '',
  metroLineId: '',
  jobTitle: '',
  leadershipTitle: '',
  department: '',
  role: 'user',
  status: 'active',
  password: '',
};

const INPUT_BASE =
  'w-full bg-bg text-text text-sm rounded-lg border py-2 px-3 transition-colors outline-none';

function inputClass(hasError?: string, extra = ''): string {
  return `${INPUT_BASE} ${
    hasError ? 'border-danger focus:border-danger ring-1 ring-danger' : 'border-border focus:border-primary'
  } ${extra}`.trim();
}

interface SectionWrapperProps {
  variant: 'page' | 'modal';
  title: string;
  description: string;
  iconName: string;
  children: React.ReactNode;
}

const SectionWrapper: React.FC<SectionWrapperProps> = ({
  variant,
  title,
  description,
  iconName,
  children,
}) => {
  if (variant === 'modal') {
    return (
      <div className="space-y-3 pt-2 border-t border-border first:border-t-0 first:pt-0">
        <h3 className="text-sm font-bold text-text-heading">{title}</h3>
        {children}
      </div>
    );
  }
  return (
    <Card className="p-5 sm:p-6 space-y-5">
      <div className="flex items-start gap-3 pb-3 border-b border-border">
        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <Icon name={iconName} size="md" />
        </span>
        <div>
          <h2 className="text-base font-bold text-text-heading">{title}</h2>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
};

export interface AddUserFormProps {
  /** Active only when embedded inside a modal; true by default on standalone page */
  isActive?: boolean;
  /** Layout variant: 'page' uses sectioned cards + sticky bottom bar; 'modal' uses compact layout */
  variant?: 'page' | 'modal';
  onCancel: () => void;
  onUserCreated: (newUser: ManagedUserDTO) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export const AddUserForm: React.FC<AddUserFormProps> = ({
  isActive = true,
  variant = 'page',
  onCancel,
  onUserCreated,
  onDirtyChange,
  onSubmittingChange,
}) => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [militaryStatuses, setMilitaryStatuses] = useState<CatalogItem[]>([]);
  const [metroLines, setMetroLines] = useState<CatalogItem[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<CatalogItem[]>([]);
  const [jobTitleRecords, setJobTitleRecords] = useState<CatalogItem[]>([]);
  const [hasEdited, setHasEdited] = useState(false);
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setIsJobDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const departmentOptions = useMemo(() => {
    return departmentRecords.map((d) => d.nameAr || d.name || '').filter(Boolean);
  }, [departmentRecords]);

  const jobTitleOptionsForSelectedDept = useMemo(() => {
    if (jobTitleRecords.length === 0) return [];
    const matchedDept = departmentRecords.find(
      (d) => (d.nameAr || d.name || '') === formData.department
    );
    if (!matchedDept) {
      return jobTitleRecords.map((j) => j.nameAr || j.name || '').filter(Boolean);
    }
    return jobTitleRecords
      .filter((j) => j.departmentId == null || String(j.departmentId) === String(matchedDept.id))
      .map((j) => j.nameAr || j.name || '')
      .filter(Boolean);
  }, [jobTitleRecords, departmentRecords, formData.department]);

  const filteredJobTitles = useMemo(() => {
    const query = formData.jobTitle.trim();
    if (!query || jobTitleOptionsForSelectedDept.includes(query)) {
      return jobTitleOptionsForSelectedDept;
    }
    const matches = jobTitleOptionsForSelectedDept.filter((t) => t.includes(query));
    return matches.length > 0 ? matches : jobTitleOptionsForSelectedDept;
  }, [formData.jobTitle, jobTitleOptionsForSelectedDept]);

  const availableRoleOptions = useMemo<UserRole[]>(() => {
    const candidateRoles: UserRole[] = ['super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'];
    const actorRole = currentUser?.role || 'admin';
    return candidateRoles.filter((role) =>
      canActorManageTargetAccount(actorRole, role, 'create').allowed
    );
  }, [currentUser]);

  useEffect(() => {
    if (!isActive) return;
    let active = true;
    Promise.allSettled([
      apiClient<{ maritalStatuses?: CatalogItem[] }>('/api/admin/organization/marital-statuses'),
      apiClient<{ militaryStatuses?: CatalogItem[] }>('/api/admin/organization/military-statuses'),
      apiClient<{ metroLines?: CatalogItem[] }>('/api/admin/organization/metro-lines'),
      apiClient<{ departments?: CatalogItem[] }>('/api/admin/organization/departments'),
      apiClient<{ jobTitles?: CatalogItem[] }>('/api/admin/organization/job-titles'),
    ]).then(([maritalRes, militaryRes, lineRes, deptRes, jobRes]) => {
      if (!active) return;
      const mList = maritalRes.status === 'fulfilled' ? maritalRes.value.maritalStatuses || [] : [];
      const milList = militaryRes.status === 'fulfilled' ? militaryRes.value.militaryStatuses || [] : [];
      const lList = lineRes.status === 'fulfilled' ? lineRes.value.metroLines || [] : [];
      const dRecords = deptRes.status === 'fulfilled' ? deptRes.value.departments || [] : [];
      const jRecords = jobRes.status === 'fulfilled' ? jobRes.value.jobTitles || [] : [];
      const dList = dRecords.map((d) => d.nameAr || d.name || '').filter(Boolean);
      const jList = jRecords.map((j) => j.nameAr || j.name || '').filter(Boolean);
      setMaritalStatuses(mList);
      setMilitaryStatuses(milList);
      setMetroLines(lList);
      setDepartmentRecords(dRecords);
      setJobTitleRecords(jRecords);
      setFormData((prev) => {
        const nextDept =
          dList.length > 0 && !dList.includes(prev.department) ? dList[0] : prev.department;
        const matchedDept = dRecords.find((d) => (d.nameAr || d.name || '') === nextDept);
        const scopedJobs = matchedDept
          ? jRecords
              .filter(
                (j) => j.departmentId == null || String(j.departmentId) === String(matchedDept.id)
              )
              .map((j) => j.nameAr || j.name || '')
              .filter(Boolean)
          : jList;
        const validJobs = scopedJobs.length > 0 ? scopedJobs : jList;
        const nextJob =
          validJobs.length > 0 && !validJobs.includes(prev.jobTitle) ? validJobs[0] : prev.jobTitle;
        return {
          ...prev,
          maritalStatusId: prev.maritalStatusId || (mList[0] ? String(mList[0].id) : ''),
          militaryServiceStatusId:
            prev.militaryServiceStatusId || (milList[0] ? String(milList[0].id) : ''),
          metroLineId: prev.metroLineId || (lList[0] ? String(lList[0].id) : ''),
          department: nextDept,
          jobTitle: nextJob,
        };
      });
    });
    return () => {
      active = false;
    };
  }, [isActive]);

  useEffect(() => {
    onDirtyChange?.(hasEdited);
  }, [hasEdited, onDirtyChange]);

  useEffect(() => {
    onSubmittingChange?.(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setHasEdited(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleGenderChange = (nextGender: UserGender) => {
    setHasEdited(true);
    setFormData((prev) => {
      let nextMilitaryId = prev.militaryServiceStatusId;
      if (militaryStatuses.length > 0) {
        const naItem = militaryStatuses.find((m) => m.code === 'not_applicable');
        const firstMaleItem = militaryStatuses.find((m) => m.code !== 'not_applicable');
        if (nextGender === 'female' && naItem) {
          nextMilitaryId = String(naItem.id);
        } else if (nextGender === 'male' && naItem && String(naItem.id) === prev.militaryServiceStatusId && firstMaleItem) {
          nextMilitaryId = String(firstMaleItem.id);
        }
      }
      return { ...prev, gender: nextGender, militaryServiceStatusId: nextMilitaryId };
    });
  };

  const visibleMilitaryStatuses = useMemo(() => {
    if (formData.gender === 'female') {
      const na = militaryStatuses.filter((m) => m.code === 'not_applicable');
      return na.length > 0 ? na : militaryStatuses;
    }
    const maleOnly = militaryStatuses.filter((m) => m.code !== 'not_applicable');
    return maleOnly.length > 0 ? maleOnly : militaryStatuses;
  }, [militaryStatuses, formData.gender]);

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
    if (isSubmitting) return;
    setGeneralError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload: CreateUserRequestDTO = {
        name: formData.name.trim(),
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim() ? formData.email.trim().toLowerCase() : undefined,
        phone: formData.phone.trim(),
        gender: formData.gender,
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
        leadershipTitle: formData.leadershipTitle.trim() || undefined,
        department: formData.department.trim(),
        role: formData.role,
        status: formData.status,
        password: formData.password.trim() || undefined,
      };

      const newUser = await userManagementApi.createUser(payload);
      setHasEdited(false);

      if ((newUser as unknown as { approvalRequired?: boolean; message?: string }).approvalRequired) {
        toast.info(
          (newUser as unknown as { message?: string }).message ||
            `تم إرسال طلب إنشاء المستخدم "${payload.name}" للاعتماد؛ بانتظار موافقة مدير النظام.`
        );
      } else {
        toast.success(`تمت إضافة المستخدم "${newUser.name}" بنجاح إلى دليل النظام.`);
      }
      onUserCreated(newUser);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'تعذر إضافة المستخدم. يرجى المحاولة مرة أخرى.';
      setGeneralError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-right" noValidate>
      {generalError && (
        <Alert variant="danger" title="تعذر إضافة المستخدم" data-testid="add-user-form-error">
          {generalError}
        </Alert>
      )}

      {/* 1. Personal Information */}
      <SectionWrapper
        variant={variant}
        title="البيانات الشخصية"
        description="الهوية الأساسية وبيانات التواصل للموظف"
        iconName="user"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              onChange={(e) => updateField('name', e.target.value)}
              className={inputClass(errors.name)}
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
              onChange={(e) => updateField('username', e.target.value)}
              className={inputClass(errors.username, 'text-left')}
            />
            {errors.username && <span className="text-[11px] text-danger">{errors.username}</span>}
          </div>

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
                const val = e.target.value;
                updateField('nationalId', val);
                const detected = detectGenderFromNationalId(val);
                if (detected) {
                  handleGenderChange(detected);
                }
              }}
              className={inputClass(errors.nationalId, 'text-left')}
            />
            {errors.nationalId && (
              <span className="text-[11px] text-danger">{errors.nationalId}</span>
            )}
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
              onChange={(e) => updateField('phone', e.target.value)}
              className={inputClass(errors.phone, 'text-left')}
            />
            {errors.phone && <span className="text-[11px] text-danger">{errors.phone}</span>}
          </div>

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
              onChange={(e) => updateField('email', e.target.value)}
              className={inputClass(errors.email, 'text-left')}
            />
            {errors.email && <span className="text-[11px] text-danger">{errors.email}</span>}
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
              onChange={(e) => updateField('dateOfBirth', e.target.value)}
              className={inputClass(errors.dateOfBirth)}
            />
            {errors.dateOfBirth && (
              <span className="text-[11px] text-danger">{errors.dateOfBirth}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-gender" className="text-xs font-semibold text-text">
              النوع <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <StyledSelect
              id="add-user-gender"
              dataTestId="add-user-gender-input"
              disabled={isSubmitting}
              value={formData.gender}
              onChange={(val) => handleGenderChange(val as UserGender)}
              options={[
                { value: 'male', label: 'ذكر' },
                { value: 'female', label: 'أنثى' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-marital" className="text-xs font-semibold text-text">
              الحالة الاجتماعية <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <StyledSelect
              id="add-user-marital"
              dataTestId="add-user-marital-input"
              disabled={isSubmitting}
              value={formData.maritalStatusId}
              onChange={(val) => updateField('maritalStatusId', val)}
              placeholder="الافتراضي"
              emptyMessage="لا توجد حالات اجتماعية مسجلة"
              options={maritalStatuses.map((item) => ({
                value: String(item.id),
                label: formatMaritalStatusByGender(
                  item.code,
                  formData.gender,
                  item.nameAr || item.name || item.label || item.code || String(item.id)
                ),
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="add-user-address" className="text-xs font-semibold text-text">
              العنوان <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="add-user-address"
              data-testid="add-user-address-input"
              type="text"
              required
              disabled={isSubmitting}
              placeholder="مثال: القاهرة - مدينة نصر - شارع عباس العقاد"
              value={formData.address}
              onChange={(e) => updateField('address', e.target.value)}
              className={inputClass(errors.address)}
            />
            {errors.address && <span className="text-[11px] text-danger">{errors.address}</span>}
          </div>
        </div>
      </SectionWrapper>

      {/* 2. Employment Information */}
      <SectionWrapper
        variant={variant}
        title="البيانات الوظيفية"
        description="الموقع التنظيمي وخط المترو وتواريخ الخدمة"
        iconName="calendar"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-dept" className="text-xs font-semibold text-text">
              القطاع / الإدارة <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <StyledSelect
              id="add-user-dept"
              dataTestId="add-user-dept-input"
              disabled={isSubmitting}
              hasError={Boolean(errors.department)}
              value={formData.department}
              placeholder="اختر القطاع / الإدارة"
              emptyMessage="لا توجد إدارات مسجلة"
              onChange={(nextDept) => {
                updateField('department', nextDept);
                if (jobTitleRecords.length > 0) {
                  const matchedDept = departmentRecords.find(
                    (d) => (d.nameAr || d.name || '') === nextDept
                  );
                  if (matchedDept) {
                    const scopedJobs = jobTitleRecords
                      .filter(
                        (j) =>
                          j.departmentId == null || String(j.departmentId) === String(matchedDept.id)
                      )
                      .map((j) => j.nameAr || j.name || '')
                      .filter(Boolean);
                    if (scopedJobs.length > 0 && !scopedJobs.includes(formData.jobTitle)) {
                      updateField('jobTitle', scopedJobs[0]);
                    } else if (scopedJobs.length === 0) {
                      updateField('jobTitle', '');
                    }
                  }
                }
              }}
              options={departmentOptions.map((dept) => ({ value: dept, label: dept }))}
            />
            {errors.department && (
              <span className="text-[11px] text-danger">{errors.department}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5 relative" ref={jobDropdownRef}>
            <label htmlFor="add-user-job" className="text-xs font-semibold text-text">
              المسمى الوظيفي <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <input
                id="add-user-job"
                data-testid="add-user-job-input"
                type="text"
                role="combobox"
                aria-expanded={isJobDropdownOpen}
                aria-controls="metro-job-titles-listbox"
                autoComplete="off"
                required
                disabled={isSubmitting}
                placeholder="اختر المسمى الوظيفي"
                value={formData.jobTitle}
                onFocus={() => setIsJobDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsJobDropdownOpen(false);
                }}
                onChange={(e) => {
                  updateField('jobTitle', e.target.value);
                  setIsJobDropdownOpen(true);
                }}
                className={inputClass(errors.jobTitle, 'pl-9')}
              />
              <button
                type="button"
                tabIndex={-1}
                disabled={isSubmitting}
                onClick={() => setIsJobDropdownOpen((prev) => !prev)}
                aria-label="عرض قائمة المسميات الوظيفية"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors p-0.5"
              >
                <Icon
                  name="chevronDown"
                  size="sm"
                  className={`transition-transform duration-150 ${isJobDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            {isJobDropdownOpen && (
              <ul
                id="metro-job-titles-listbox"
                role="listbox"
                className="absolute top-full left-0 right-0 z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg py-1 text-sm"
              >
                {filteredJobTitles.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-text-muted text-center">
                    لا توجد مسميات وظيفية مسجلة لهذه الإدارة
                  </li>
                ) : (
                  filteredJobTitles.map((title) => {
                    const isSelected = formData.jobTitle === title;
                    return (
                      <li key={title} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => {
                            updateField('jobTitle', title);
                            setIsJobDropdownOpen(false);
                          }}
                          className={`w-full text-right px-3 py-2 flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-text hover:bg-bg'
                          }`}
                        >
                          <span>{title}</span>
                          {isSelected && <Icon name="check" size="sm" className="text-primary" />}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
            {errors.jobTitle && <span className="text-[11px] text-danger">{errors.jobTitle}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-leadership" className="text-xs font-semibold text-text">
              الصفة القيادية / الإشرافية <span className="text-[11px] text-text-muted font-normal">(اختياري)</span>
            </label>
            <StyledSelect
              id="add-user-leadership"
              dataTestId="add-user-leadership-input"
              disabled={isSubmitting}
              value={formData.leadershipTitle}
              onChange={(val) => updateField('leadershipTitle', val)}
              placeholder="— بدون (فارغ) —"
              emptyMessage="لا توجد مسميات قيادية"
              options={[
                { value: '', label: '— بدون (فارغ) —' },
                { value: 'رئيس قطاع / رئيس إدارة مركزية', label: 'رئيس قطاع / رئيس إدارة مركزية' },
                { value: 'مدير عام', label: 'مدير عام' },
                { value: 'مدير إدارة', label: 'مدير إدارة' },
                { value: 'رئيس قسم / رئيس وحدة', label: 'رئيس قسم / رئيس وحدة' },
                { value: 'مشرف / رئيس وردية', label: 'مشرف / رئيس وردية' },
                { value: 'قائد فريق / منسق', label: 'قائد فريق / منسق' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-metro-line" className="text-xs font-semibold text-text">
              خط المترو <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <StyledSelect
              id="add-user-metro-line"
              dataTestId="add-user-metro-line-input"
              disabled={isSubmitting}
              value={formData.metroLineId}
              onChange={(val) => updateField('metroLineId', val)}
              placeholder="الافتراضي"
              emptyMessage="لا توجد خطوط مترو مسجلة"
              options={metroLines.map((item) => ({
                value: String(item.id),
                label: item.nameAr || item.name || item.label || item.code || String(item.id),
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-military" className="text-xs font-semibold text-text">
              الموقف من التجنيد <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <StyledSelect
              id="add-user-military"
              dataTestId="add-user-military-input"
              disabled={isSubmitting || formData.gender === 'female'}
              value={formData.militaryServiceStatusId}
              onChange={(val) => updateField('militaryServiceStatusId', val)}
              placeholder="الافتراضي"
              emptyMessage="لا توجد حالات تجنيد مسجلة"
              options={visibleMilitaryStatuses.map((item) => ({
                value: String(item.id),
                label: item.nameAr || item.name || item.label || item.code || String(item.id),
              }))}
            />
          </div>

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
              onChange={(e) => updateField('appointmentDate', e.target.value)}
              className={inputClass(errors.appointmentDate)}
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
              onChange={(e) => updateField('serviceEndDate', e.target.value)}
              className={inputClass()}
            />
          </div>
        </div>
      </SectionWrapper>

      {/* 3. Education Information */}
      <SectionWrapper
        variant={variant}
        title="المؤهلات العلمية"
        description="المؤهل الدراسي المسجل بملف الموظف"
        iconName="award"
      >
        <div className="grid grid-cols-1 gap-4">
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
              placeholder="مثال: بكالوريوس هندسة القوى الكهربائية"
              value={formData.educationalQualification}
              onChange={(e) => updateField('educationalQualification', e.target.value)}
              className={inputClass(errors.educationalQualification)}
            />
            {errors.educationalQualification && (
              <span className="text-[11px] text-danger">{errors.educationalQualification}</span>
            )}
          </div>
        </div>
      </SectionWrapper>

      {/* 4. Account & Permissions */}
      <SectionWrapper
        variant={variant}
        title="الحساب والصلاحيات"
        description="الدور الوظيفي في المنصة وحالة التفعيل وبيانات الدخول"
        iconName="shield"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-role" className="text-xs font-semibold text-text">
              الدور الوظيفي <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <StyledSelect
              id="add-user-role"
              dataTestId="add-user-role-input"
              disabled={isSubmitting}
              value={formData.role}
              onChange={(val) => updateField('role', val as UserRole)}
              options={availableRoleOptions.map((role) => ({
                value: role,
                label: `${USER_ROLE_LABELS_AR[role]} (${
                  role === 'user'
                    ? 'متدرب'
                    : role === 'lecturer'
                    ? 'محاضر'
                    : role === 'assistant_admin'
                    ? 'مساعد مدير'
                    : role === 'admin'
                    ? 'مدير النظام'
                    : 'المسؤول الأعلى'
                })`,
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-user-status" className="text-xs font-semibold text-text">
              حالة الحساب الأولية
            </label>
            <StyledSelect
              id="add-user-status"
              dataTestId="add-user-status-input"
              disabled={isSubmitting}
              value={formData.status}
              onChange={(val) => updateField('status', val as UserStatus)}
              options={[
                { value: 'active', label: `${USER_STATUS_LABELS_AR.active} (متاح للدخول والترشيح)` },
                { value: 'suspended', label: `${USER_STATUS_LABELS_AR.suspended} (معطل)` },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="add-user-password" className="text-xs font-semibold text-text">
              كلمة المرور المبدئية{' '}
              <span className="text-text-muted text-[11px]">(اختياري — الافتراضي Metro@12345)</span>
            </label>
            <input
              id="add-user-password"
              data-testid="add-user-password-input"
              type="password"
              disabled={isSubmitting}
              dir="ltr"
              placeholder="كلمة مرور الدخول المبدئية"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              className={inputClass(undefined, 'text-left')}
            />
          </div>
        </div>
      </SectionWrapper>

      {/* Sticky Action Bar (Page) or Standard Footer (Modal) */}
      {variant === 'page' ? (
        <div
          data-testid="add-user-sticky-bar"
          className="sticky bottom-0 z-20 bg-surface/95 backdrop-blur-sm border border-border rounded-xl shadow-sm px-4 sm:px-6 py-3.5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <p className="text-xs text-text-muted">
            {hasEdited ? 'توجد تغييرات غير محفوظة' : 'الحقول المميزة بعلامة (*) إلزامية'}
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              data-testid="add-user-cancel-btn"
              className="flex-1 sm:flex-initial"
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
              className="flex-1 sm:flex-initial"
            >
              <Icon name="plus" size="sm" className="ml-1.5" />
              إنشاء المستخدم
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
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
      )}
    </form>
  );
};
