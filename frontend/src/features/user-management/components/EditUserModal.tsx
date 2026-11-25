import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '@/core/api/apiClient';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';
import {
  DEFAULT_LEADERSHIP_TITLES,
  formatMaritalStatusByGender,
  detectGenderFromNationalId,
  type ManagedUserDTO,
  type UserGender,
} from '@/core/user-management/types';
import { userManagementApi } from '../services/userManagementApi';
import { StyledSelect } from './StyledSelect';
import { PasswordStrengthPanel } from './PasswordStrengthPanel';
import {
  getEgyptMobileLiveError,
  sanitizeDigitsOnly,
  sanitizeEgyptMobile11,
} from '@/core/utils/numericInput';
import {
  copyTextToClipboard,
  evaluatePasswordStrength,
  generateStrongPassword,
} from '@/core/utils/passwordPolicy';

interface CatalogItem {
  id: number | string;
  name?: string;
  nameAr?: string;
  label?: string;
  code?: string;
  departmentId?: number | null;
}

export interface EditUserModalProps {
  isOpen: boolean;
  user: ManagedUserDTO | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INPUT_CLASS =
  'w-full bg-bg text-text text-sm rounded-lg border border-border focus:border-primary py-2 px-3 transition-colors outline-none';

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [nationalId, setNationalId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [educationalQualification, setEducationalQualification] = useState('');
  const [maritalStatusId, setMaritalStatusId] = useState('');
  const [militaryServiceStatusId, setMilitaryServiceStatusId] = useState('');
  const [metroLineId, setMetroLineId] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [leadershipTitle, setLeadershipTitle] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [serviceEndDate, setServiceEndDate] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [militaryStatuses, setMilitaryStatuses] = useState<CatalogItem[]>([]);
  const [metroLines, setMetroLines] = useState<CatalogItem[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<CatalogItem[]>([]);
  const [jobTitleRecords, setJobTitleRecords] = useState<CatalogItem[]>([]);
  const [leadershipTitleOptions, setLeadershipTitleOptions] = useState<string[]>([...DEFAULT_LEADERSHIP_TITLES]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [phoneTouched, setPhoneTouched] = useState(false);
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

  useEffect(() => {
    if (!isOpen || !user) return;
    setError(null);
    setPhoneError(undefined);
    setPhoneTouched(false);
    setName(user.name || '');
    setNameEn(user.nameEn || '');
    setPhone(sanitizeEgyptMobile11(user.phone || ''));
    setEmail(user.email && user.email !== user.phone ? user.email : '');
    const initialGender: UserGender =
      user.gender === 'female' || user.gender === 'male'
        ? user.gender
        : detectGenderFromNationalId(user.nationalId || '') || 'male';
    setGender(initialGender);
    setNationalId(user.nationalId || '');
    setDateOfBirth(user.dateOfBirth || '');
    setAddress(user.address || '');
    setEducationalQualification(user.educationalQualification || '');
    setEmployeeNumber(user.employeeNumber || '');
    setDepartment(user.department || '');
    setJobTitle(user.jobTitle || '');
    setLeadershipTitle(user.leadershipTitle || '');
    setAppointmentDate(user.appointmentDate || '');
    setServiceEndDate(user.serviceEndDate || '');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);

    let active = true;
    Promise.allSettled([
      apiClient<{ maritalStatuses?: CatalogItem[] }>('/api/admin/organization/marital-statuses'),
      apiClient<{ militaryStatuses?: CatalogItem[] }>('/api/admin/organization/military-statuses'),
      apiClient<{ metroLines?: CatalogItem[] }>('/api/admin/organization/metro-lines'),
      apiClient<{ departments?: CatalogItem[] }>('/api/admin/organization/departments'),
      apiClient<{ jobTitles?: CatalogItem[] }>('/api/admin/organization/job-titles'),
      apiClient<{ leadershipTitles?: CatalogItem[] }>('/api/admin/organization/leadership-titles'),
    ]).then(([maritalRes, militaryRes, lineRes, deptRes, jobRes, leadershipRes]) => {
      if (!active) return;
      const mList = maritalRes.status === 'fulfilled' ? maritalRes.value.maritalStatuses || [] : [];
      const milList = militaryRes.status === 'fulfilled' ? militaryRes.value.militaryStatuses || [] : [];
      const lList = lineRes.status === 'fulfilled' ? lineRes.value.metroLines || [] : [];
      const dList = deptRes.status === 'fulfilled' ? deptRes.value.departments || [] : [];
      const jList = jobRes.status === 'fulfilled' ? jobRes.value.jobTitles || [] : [];
      const ltRecords =
        leadershipRes.status === 'fulfilled' ? leadershipRes.value.leadershipTitles || [] : [];
      const ltNames = ltRecords.map((lt) => lt.nameAr || lt.name || '').filter(Boolean);
      if (ltNames.length > 0) {
        setLeadershipTitleOptions(ltNames);
      }

      setMaritalStatuses(mList);
      setMilitaryStatuses(milList);
      setMetroLines(lList);
      setDepartmentRecords(dList);
      setJobTitleRecords(jList);

      const matchedMarital =
        (user.maritalStatusId != null
          ? mList.find((m) => String(m.id) === String(user.maritalStatusId))
          : undefined) ||
        mList.find(
          (m) =>
            (m.nameAr || m.name) === user.maritalStatus ||
            formatMaritalStatusByGender(m.code, initialGender, m.nameAr || '') === user.maritalStatus
        );
      const matchedMilitary =
        (user.militaryServiceStatusId != null
          ? milList.find((m) => String(m.id) === String(user.militaryServiceStatusId))
          : undefined) ||
        milList.find((m) => (m.nameAr || m.name) === user.militaryServiceStatus);
      const matchedLine = lList.find((l) => (l.nameAr || l.name) === user.metroLine);

      setMaritalStatusId(matchedMarital ? String(matchedMarital.id) : mList[0] ? String(mList[0].id) : '');
      const naMil = milList.find((m) => m.code === 'not_applicable');
      setMilitaryServiceStatusId(
        matchedMilitary
          ? String(matchedMilitary.id)
          : initialGender === 'female' && naMil
          ? String(naMil.id)
          : milList[0]
          ? String(milList[0].id)
          : ''
      );
      setMetroLineId(matchedLine ? String(matchedLine.id) : lList[0] ? String(lList[0].id) : '');
    });

    return () => {
      active = false;
    };
  }, [isOpen, user]);

  const departmentOptions = useMemo(() => {
    const apiDepts = departmentRecords.map((d) => d.nameAr || d.name || '').filter(Boolean);
    if (department && !apiDepts.includes(department)) return [department, ...apiDepts];
    return apiDepts;
  }, [departmentRecords, department]);

  const jobTitleOptionsForDept = useMemo(() => {
    if (jobTitleRecords.length === 0) return [];
    const matchedDept = departmentRecords.find((d) => (d.nameAr || d.name || '') === department);
    if (!matchedDept) return jobTitleRecords.map((j) => j.nameAr || j.name || '').filter(Boolean);
    return jobTitleRecords
      .filter((j) => j.departmentId == null || String(j.departmentId) === String(matchedDept.id))
      .map((j) => j.nameAr || j.name || '')
      .filter(Boolean);
  }, [jobTitleRecords, departmentRecords, department]);

  const filteredJobTitles = useMemo(() => {
    const query = jobTitle.trim();
    if (!query || jobTitleOptionsForDept.includes(query)) return jobTitleOptionsForDept;
    const matches = jobTitleOptionsForDept.filter((t) => t.includes(query));
    return matches.length > 0 ? matches : jobTitleOptionsForDept;
  }, [jobTitle, jobTitleOptionsForDept]);

  const handleGenderChange = (nextGender: UserGender) => {
    setGender(nextGender);
    if (militaryStatuses.length > 0) {
      const naItem = militaryStatuses.find((m) => m.code === 'not_applicable');
      const firstMale = militaryStatuses.find((m) => m.code !== 'not_applicable');
      if (nextGender === 'female' && naItem) {
        setMilitaryServiceStatusId(String(naItem.id));
      } else if (nextGender === 'male' && naItem && String(naItem.id) === militaryServiceStatusId && firstMale) {
        setMilitaryServiceStatusId(String(firstMale.id));
      }
    }
  };

  const visibleMilitaryStatuses = useMemo(() => {
    if (gender === 'female') {
      const na = militaryStatuses.filter((m) => m.code === 'not_applicable');
      return na.length > 0 ? na : militaryStatuses;
    }
    const maleOnly = militaryStatuses.filter((m) => m.code !== 'not_applicable');
    return maleOnly.length > 0 ? maleOnly : militaryStatuses;
  }, [militaryStatuses, gender]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setError(null);

    if (!name.trim()) {
      setError('الاسم الكامل مطلوب.');
      return;
    }

    const nextPhoneError = getEgyptMobileLiveError(phone, true);
    if (nextPhoneError) {
      setPhoneTouched(true);
      setPhoneError(nextPhoneError);
      setError(nextPhoneError);
      return;
    }

    if (newPassword) {
      const pwEval = evaluatePasswordStrength(newPassword, { phone, name });
      if (!pwEval.isValidForSave && pwEval.errorMessage) {
        setError(pwEval.errorMessage);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('كلمة المرور الجديدة وتأكيدها غير متطابقتين.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        nameEn: nameEn.trim(),
        phone: phone.trim(),
        email: email.trim() || '',
        gender,
        nationalId: nationalId.trim(),
        dateOfBirth,
        address: address.trim(),
        educationalQualification: educationalQualification.trim(),
        maritalStatusId: maritalStatusId || undefined,
        militaryServiceStatusId: militaryServiceStatusId || undefined,
        metroLineId: metroLineId || undefined,
        employeeNumber: employeeNumber.trim(),
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        leadershipTitle: leadershipTitle.trim(),
        appointmentDate,
        serviceEndDate: serviceEndDate || null,
      };
      if (newPassword) {
        payload.password = newPassword;
      }
      await userManagementApi.updateUser(user.id, payload as any);
      toast.success(`تم تحديث بيانات "${name.trim()}" بنجاح.`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث بيانات المستخدم.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="تعديل البيانات الشخصية والوظيفية"
      size="2xl"
      dataTestId="edit-user-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right" noValidate>
        {error && (
          <Alert variant="danger" title="تعذر حفظ التعديلات">
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-name" className="text-xs font-semibold text-text">
              الاسم الكامل <span className="text-danger">*</span>
            </label>
            <input
              id="edit-user-name"
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-name-en" className="text-xs font-semibold text-text">
              الاسم بالإنجليزية
            </label>
            <input
              id="edit-user-name-en"
              data-testid="edit-user-name-en-input"
              type="text"
              dir="ltr"
              maxLength={255}
              placeholder="e.g. Tarek Mohamed Abdelrahman"
              disabled={isSubmitting}
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className={`${INPUT_CLASS} text-left`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-phone" className="text-xs font-semibold text-text">
              رقم الهاتف (11 رقماً) <span className="text-danger">*</span>
            </label>
            <input
              id="edit-user-phone"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              required
              dir="ltr"
              placeholder="01012345678"
              disabled={isSubmitting}
              value={phone}
              onChange={(e) => {
                const nextPhone = sanitizeEgyptMobile11(e.target.value);
                setPhone(nextPhone);
                setPhoneError(getEgyptMobileLiveError(nextPhone, phoneTouched));
              }}
              onBlur={() => {
                setPhoneTouched(true);
                setPhoneError(getEgyptMobileLiveError(phone, true));
              }}
              className={`${INPUT_CLASS} text-left ${
                phoneError ? 'border-danger focus:border-danger ring-1 ring-danger' : ''
              }`.trim()}
            />
            {phoneError && (
              <span className="text-[11px] text-danger" data-testid="edit-user-phone-error">
                {phoneError}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-email" className="text-xs font-semibold text-text">
              البريد الإلكتروني
            </label>
            <input
              id="edit-user-email"
              type="email"
              dir="ltr"
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${INPUT_CLASS} text-left`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-nid" className="text-xs font-semibold text-text">
              الرقم القومي (14 رقماً)
            </label>
            <input
              id="edit-user-nid"
              type="text"
              inputMode="numeric"
              maxLength={14}
              dir="ltr"
              disabled={isSubmitting}
              value={nationalId}
              onChange={(e) => {
                const val = sanitizeDigitsOnly(e.target.value, 14);
                setNationalId(val);
                const detected = detectGenderFromNationalId(val);
                if (detected) {
                  handleGenderChange(detected);
                }
              }}
              className={`${INPUT_CLASS} text-left`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-dob" className="text-xs font-semibold text-text">
              تاريخ الميلاد
            </label>
            <input
              id="edit-user-dob"
              type="date"
              disabled={isSubmitting}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-gender" className="text-xs font-semibold text-text">
              النوع
            </label>
            <StyledSelect
              id="edit-user-gender"
              dataTestId="edit-user-gender-select"
              disabled={isSubmitting}
              value={gender}
              onChange={(val) => handleGenderChange(val as UserGender)}
              options={[
                { value: 'male', label: 'ذكر' },
                { value: 'female', label: 'أنثى' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-marital" className="text-xs font-semibold text-text">
              الحالة الاجتماعية
            </label>
            <StyledSelect
              id="edit-user-marital"
              dataTestId="edit-user-marital-select"
              disabled={isSubmitting}
              value={maritalStatusId}
              onChange={(val) => setMaritalStatusId(val)}
              placeholder="اختر الحالة الاجتماعية"
              emptyMessage="لا توجد حالات اجتماعية مسجلة"
              options={maritalStatuses.map((m) => ({
                value: String(m.id),
                label: formatMaritalStatusByGender(
                  m.code,
                  gender,
                  m.nameAr || m.name || m.code || String(m.id)
                ),
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-dept" className="text-xs font-semibold text-text">
              القطاع / الإدارة
            </label>
            <StyledSelect
              id="edit-user-dept"
              dataTestId="edit-user-dept-select"
              disabled={isSubmitting}
              value={department}
              onChange={(nextDept) => {
                setDepartment(nextDept);
                if (!nextDept) {
                  setJobTitle('');
                  setIsJobDropdownOpen(false);
                  return;
                }
                const matched = departmentRecords.find((d) => (d.nameAr || d.name || '') === nextDept);
                if (matched && jobTitleRecords.length > 0) {
                  const scoped = jobTitleRecords
                    .filter((j) => j.departmentId == null || String(j.departmentId) === String(matched.id))
                    .map((j) => j.nameAr || j.name || '')
                    .filter(Boolean);
                  if (scoped.length > 0 && !scoped.includes(jobTitle)) {
                    setJobTitle(scoped[0]);
                  } else if (scoped.length === 0) {
                    setJobTitle('');
                  }
                }
              }}
              placeholder="— بدون قطاع (غير محدد) —"
              emptyMessage="لا توجد إدارات مسجلة"
              options={[
                { value: '', label: '— بدون قطاع (غير محدد) —' },
                ...departmentOptions.map((d) => ({
                  value: d,
                  label: d,
                })),
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-employee-number" className="text-xs font-semibold text-text">
              الرقم الوظيفي
            </label>
            <input
              id="edit-user-employee-number"
              data-testid="edit-user-employee-number-input"
              type="text"
              dir="ltr"
              maxLength={50}
              disabled={isSubmitting}
              placeholder="مثال: EMP-1042"
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              className={`${INPUT_CLASS} text-left`}
            />
          </div>

          <div className="flex flex-col gap-1.5 relative" ref={jobDropdownRef}>
            <label htmlFor="edit-user-job" className="text-xs font-semibold text-text">
              المسمى الوظيفي{' '}
              {!department.trim() && (
                <span className="text-text-muted font-normal">(غير متاح بدون قطاع)</span>
              )}
            </label>
            <div className="relative">
              <input
                id="edit-user-job"
                type="text"
                autoComplete="off"
                disabled={isSubmitting || !department.trim()}
                placeholder={
                  department.trim()
                    ? 'اختر أو اكتب المسمى الوظيفي'
                    : 'اختر قطاعاً أولاً لتحديد المسمى الوظيفي'
                }
                value={jobTitle}
                onFocus={() => setIsJobDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsJobDropdownOpen(false);
                }}
                onChange={(e) => {
                  setJobTitle(e.target.value);
                  setIsJobDropdownOpen(true);
                }}
                className={`${INPUT_CLASS} pl-9`}
              />
              <button
                type="button"
                tabIndex={-1}
                disabled={isSubmitting || !department.trim()}
                onClick={() => setIsJobDropdownOpen((prev) => !prev)}
                aria-label="عرض المسميات الوظيفية"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5"
              >
                <Icon
                  name="chevronDown"
                  size="sm"
                  className={`transition-transform duration-150 ${isJobDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            {isJobDropdownOpen && (
              <ul className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg py-1 text-sm">
                {filteredJobTitles.map((title) => (
                  <li key={title}>
                    <button
                      type="button"
                      onClick={() => {
                        setJobTitle(title);
                        setIsJobDropdownOpen(false);
                      }}
                      className={`w-full text-right px-3 py-2 flex items-center justify-between transition-colors ${
                        jobTitle === title
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text hover:bg-bg'
                      }`}
                    >
                      <span>{title}</span>
                      {jobTitle === title && <Icon name="check" size="sm" className="text-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-leadership" className="text-xs font-semibold text-text">
              الصفة القيادية / الإشرافية (اختياري)
            </label>
            <StyledSelect
              id="edit-user-leadership"
              dataTestId="edit-user-leadership-select"
              disabled={isSubmitting}
              value={leadershipTitle}
              onChange={(val) => setLeadershipTitle(val)}
              placeholder="— بدون (فارغ) —"
              emptyMessage="لا توجد صفات قيادية"
              options={[
                { value: '', label: '— بدون (فارغ) —' },
                ...(leadershipTitle && !leadershipTitleOptions.includes(leadershipTitle)
                  ? [{ value: leadershipTitle, label: leadershipTitle }]
                  : []),
                ...leadershipTitleOptions.map((title) => ({ value: title, label: title })),
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-line" className="text-xs font-semibold text-text">
              خط المترو
            </label>
            <StyledSelect
              id="edit-user-line"
              dataTestId="edit-user-line-select"
              disabled={isSubmitting}
              value={metroLineId}
              onChange={(val) => setMetroLineId(val)}
              placeholder="اختر خط المترو"
              emptyMessage="لا توجد خطوط مترو مسجلة"
              options={metroLines.map((l) => ({
                value: String(l.id),
                label: l.nameAr || l.name || String(l.id),
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-military" className="text-xs font-semibold text-text">
              الموقف من التجنيد
            </label>
            <StyledSelect
              id="edit-user-military"
              dataTestId="edit-user-military-select"
              disabled={isSubmitting || gender === 'female'}
              value={militaryServiceStatusId}
              onChange={(val) => setMilitaryServiceStatusId(val)}
              placeholder="اختر الموقف من التجنيد"
              emptyMessage="لا توجد حالات تجنيد مسجلة"
              options={visibleMilitaryStatuses.map((m) => ({
                value: String(m.id),
                label: m.nameAr || m.name || m.code || String(m.id),
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-appointment" className="text-xs font-semibold text-text">
              تاريخ التعيين
            </label>
            <input
              id="edit-user-appointment"
              type="date"
              disabled={isSubmitting}
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-service-end" className="text-xs font-semibold text-text">
              تاريخ انتهاء الخدمة
            </label>
            <input
              id="edit-user-service-end"
              type="date"
              disabled={isSubmitting}
              value={serviceEndDate}
              onChange={(e) => setServiceEndDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="edit-user-qualification" className="text-xs font-semibold text-text">
              المؤهل الدراسي
            </label>
            <input
              id="edit-user-qualification"
              type="text"
              disabled={isSubmitting}
              value={educationalQualification}
              onChange={(e) => setEducationalQualification(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <label htmlFor="edit-user-address" className="text-xs font-semibold text-text">
              العنوان
            </label>
            <input
              id="edit-user-address"
              type="text"
              disabled={isSubmitting}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {/* Optional Password Update Section */}
          <div className="sm:col-span-2 lg:col-span-3 pt-3 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <div className="text-xs font-bold text-text-heading">تعديل كلمة المرور (اختياري)</div>
                <div className="text-[11px] text-text-muted">
                  اترك الحقلين فارغين إذا كنت لا تريد تغيير كلمة المرور الحالية للمستخدم. سيتم إنهاء الجلسات النشطة للمستخدم عند التعديل.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    const generated = generateStrongPassword(12);
                    setNewPassword(generated);
                    setConfirmPassword(generated);
                    setShowPassword(true);
                  }}
                  data-testid="edit-user-generate-password-btn"
                  className="text-xs px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Icon name="refresh" size="sm" />
                  <span>توليد كلمة مرور</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !newPassword}
                  onClick={async () => {
                    const ok = await copyTextToClipboard(newPassword);
                    if (ok) {
                      toast.success('تم نسخ كلمة المرور الجديدة بنجاح.');
                    } else {
                      toast.error('تعذر النسخ التلقائي؛ يمكنك نسخها يدوياً.');
                    }
                  }}
                  data-testid="edit-user-copy-password-btn"
                  className="text-xs px-2.5 py-1 rounded-lg border border-border bg-surface text-text hover:bg-bg transition-colors inline-flex items-center gap-1 cursor-pointer font-medium disabled:opacity-50"
                >
                  <Icon name="copy" size="sm" />
                  <span>نسخ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size="sm" />
                  <span>{showPassword ? 'إخفاء' : 'إظهار'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-user-password" className="text-xs font-semibold text-text">
                  كلمة المرور الجديدة
                </label>
                <input
                  id="edit-user-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  dir="ltr"
                  disabled={isSubmitting}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8 أحرف على الأقل (حرف كبير وصغير ورقم)..."
                  className={`${INPUT_CLASS} text-left font-mono`}
                  data-testid="edit-user-password-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-user-confirm-password" className="text-xs font-semibold text-text">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  id="edit-user-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  dir="ltr"
                  disabled={isSubmitting}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة..."
                  className={`${INPUT_CLASS} text-left font-mono ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-danger focus:border-danger ring-1 ring-danger'
                      : ''
                  }`.trim()}
                  data-testid="edit-user-confirm-password-input"
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <span className="text-[11px] text-danger" data-testid="edit-user-confirm-password-error">
                    كلمة المرور الجديدة وتأكيدها غير متطابقتين
                  </span>
                )}
              </div>
            </div>

            <PasswordStrengthPanel
              password={newPassword}
              phone={phone}
              name={name}
              testIdPrefix="edit-user-password-strength"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            data-testid="edit-user-submit-btn"
          >
            <Icon name="save" size="sm" className="ml-1.5" />
            حفظ التعديلات
          </Button>
        </div>
      </form>
    </Modal>
  );
};
