import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '@/core/api/apiClient';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';
import { type ManagedUserDTO } from '@/core/user-management/types';
import { userManagementApi } from '../services/userManagementApi';

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
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [educationalQualification, setEducationalQualification] = useState('');
  const [maritalStatusId, setMaritalStatusId] = useState('');
  const [militaryServiceStatusId, setMilitaryServiceStatusId] = useState('');
  const [metroLineId, setMetroLineId] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [serviceEndDate, setServiceEndDate] = useState('');

  const [maritalStatuses, setMaritalStatuses] = useState<CatalogItem[]>([]);
  const [militaryStatuses, setMilitaryStatuses] = useState<CatalogItem[]>([]);
  const [metroLines, setMetroLines] = useState<CatalogItem[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<CatalogItem[]>([]);
  const [jobTitleRecords, setJobTitleRecords] = useState<CatalogItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setName(user.name || '');
    setPhone(user.phone || '');
    setEmail(user.email && user.email !== user.phone ? user.email : '');
    setNationalId(user.nationalId || '');
    setDateOfBirth(user.dateOfBirth || '');
    setAddress(user.address || '');
    setEducationalQualification(user.educationalQualification || '');
    setDepartment(user.department || '');
    setJobTitle(user.jobTitle || '');
    setAppointmentDate(user.appointmentDate || '');
    setServiceEndDate(user.serviceEndDate || '');

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
      const dList = deptRes.status === 'fulfilled' ? deptRes.value.departments || [] : [];
      const jList = jobRes.status === 'fulfilled' ? jobRes.value.jobTitles || [] : [];

      setMaritalStatuses(mList);
      setMilitaryStatuses(milList);
      setMetroLines(lList);
      setDepartmentRecords(dList);
      setJobTitleRecords(jList);

      const matchedMarital = mList.find((m) => (m.nameAr || m.name) === user.maritalStatus);
      const matchedMilitary = milList.find((m) => (m.nameAr || m.name) === user.militaryServiceStatus);
      const matchedLine = lList.find((l) => (l.nameAr || l.name) === user.metroLine);

      setMaritalStatusId(matchedMarital ? String(matchedMarital.id) : mList[0] ? String(mList[0].id) : '');
      setMilitaryServiceStatusId(
        matchedMilitary ? String(matchedMilitary.id) : milList[0] ? String(milList[0].id) : ''
      );
      setMetroLineId(matchedLine ? String(matchedLine.id) : lList[0] ? String(lList[0].id) : '');
      if (!user.department && dList[0]) {
        setDepartment(dList[0].nameAr || dList[0].name || '');
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setError(null);

    if (!name.trim() || !phone.trim()) {
      setError('الاسم الكامل ورقم الهاتف مطلوبان.');
      return;
    }

    setIsSubmitting(true);
    try {
      await userManagementApi.updateUser(user.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || '',
        nationalId: nationalId.trim(),
        dateOfBirth,
        address: address.trim(),
        educationalQualification: educationalQualification.trim(),
        maritalStatusId: maritalStatusId || undefined,
        militaryServiceStatusId: militaryServiceStatusId || undefined,
        metroLineId: metroLineId || undefined,
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        appointmentDate,
        serviceEndDate: serviceEndDate || null,
      });
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
      size="lg"
      dataTestId="edit-user-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right" noValidate>
        {error && (
          <Alert variant="danger" title="تعذر حفظ التعديلات">
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label htmlFor="edit-user-phone" className="text-xs font-semibold text-text">
              رقم الهاتف <span className="text-danger">*</span>
            </label>
            <input
              id="edit-user-phone"
              type="tel"
              required
              dir="ltr"
              disabled={isSubmitting}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${INPUT_CLASS} text-left`}
            />
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
              maxLength={14}
              dir="ltr"
              disabled={isSubmitting}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
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
            <label htmlFor="edit-user-marital" className="text-xs font-semibold text-text">
              الحالة الاجتماعية
            </label>
            <select
              id="edit-user-marital"
              disabled={isSubmitting}
              value={maritalStatusId}
              onChange={(e) => setMaritalStatusId(e.target.value)}
              className={INPUT_CLASS}
            >
              {maritalStatuses.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {m.nameAr || m.name || m.code}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-dept" className="text-xs font-semibold text-text">
              القطاع / الإدارة
            </label>
            <select
              id="edit-user-dept"
              disabled={isSubmitting}
              value={department}
              onChange={(e) => {
                const nextDept = e.target.value;
                setDepartment(nextDept);
                const matched = departmentRecords.find((d) => (d.nameAr || d.name || '') === nextDept);
                if (matched && jobTitleRecords.length > 0) {
                  const scoped = jobTitleRecords
                    .filter((j) => j.departmentId == null || String(j.departmentId) === String(matched.id))
                    .map((j) => j.nameAr || j.name || '')
                    .filter(Boolean);
                  if (scoped.length > 0 && !scoped.includes(jobTitle)) {
                    setJobTitle(scoped[0]);
                  }
                }
              }}
              className={INPUT_CLASS}
            >
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 relative" ref={jobDropdownRef}>
            <label htmlFor="edit-user-job" className="text-xs font-semibold text-text">
              المسمى الوظيفي
            </label>
            <div className="relative">
              <input
                id="edit-user-job"
                type="text"
                autoComplete="off"
                disabled={isSubmitting}
                placeholder="اختر أو اكتب المسمى الوظيفي"
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
                disabled={isSubmitting}
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
            <label htmlFor="edit-user-line" className="text-xs font-semibold text-text">
              خط المترو
            </label>
            <select
              id="edit-user-line"
              disabled={isSubmitting}
              value={metroLineId}
              onChange={(e) => setMetroLineId(e.target.value)}
              className={INPUT_CLASS}
            >
              {metroLines.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {l.nameAr || l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-military" className="text-xs font-semibold text-text">
              الموقف من التجنيد
            </label>
            <select
              id="edit-user-military"
              disabled={isSubmitting}
              value={militaryServiceStatusId}
              onChange={(e) => setMilitaryServiceStatusId(e.target.value)}
              className={INPUT_CLASS}
            >
              {militaryStatuses.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {m.nameAr || m.name || m.code}
                </option>
              ))}
            </select>
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

          <div className="flex flex-col gap-1.5 sm:col-span-2">
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
