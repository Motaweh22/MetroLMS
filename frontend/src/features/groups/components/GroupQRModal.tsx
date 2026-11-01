import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { TrainingGroup, GroupEnrollmentPolicy } from '@/core/groups/types';
import { generateQrSvg, downloadQrCodeImage } from '@/core/utils/qrGenerator';
import { groupsApi } from '../services/groupsApi';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { FormInput } from '@/shared/ui/FormInput';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { formatArabicDateTime, toDatetimeLocal, toIsoString } from '../utils/dateUtils';

export interface GroupQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: TrainingGroup;
  onGroupUpdated?: (updated: TrainingGroup) => void;
  enrollmentPolicy?: GroupEnrollmentPolicy;
  onEnrollmentPolicyChange?: (policy: GroupEnrollmentPolicy) => void;
  maxTrainees?: string;
  onMaxTraineesChange?: (capacity: string) => void;
  enrollmentExpiresAt?: string;
  onEnrollmentExpiresAtChange?: (expiry: string) => void;
  isEnrollmentOpen?: boolean;
  onIsEnrollmentOpenChange?: (open: boolean) => void;
  policyErrors?: Record<string, string>;
}

export const GroupQRModal: React.FC<GroupQRModalProps> = ({
  isOpen,
  onClose,
  group,
  onGroupUpdated,
  enrollmentPolicy,
  onEnrollmentPolicyChange,
  maxTrainees,
  onMaxTraineesChange,
  enrollmentExpiresAt,
  onEnrollmentExpiresAtChange,
  isEnrollmentOpen,
  onIsEnrollmentOpenChange,
  policyErrors,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  // Staged modal state initialized strictly from the last persisted group state
  const [localPolicy, setLocalPolicy] = useState<GroupEnrollmentPolicy>(
    group.enrollmentPolicy ?? enrollmentPolicy ?? 'open'
  );
  const [localMaxTrainees, setLocalMaxTrainees] = useState<string>(
    group.maxTrainees !== null && group.maxTrainees !== undefined
      ? String(group.maxTrainees)
      : maxTrainees ?? ''
  );
  const [localExpiresAt, setLocalExpiresAt] = useState<string>(
    group.enrollmentExpiresAt
      ? toDatetimeLocal(group.enrollmentExpiresAt)
      : enrollmentExpiresAt ?? ''
  );
  const [localIsOpen, setLocalIsOpen] = useState<boolean>(
    group.isEnrollmentOpen !== undefined
      ? group.isEnrollmentOpen !== false
      : isEnrollmentOpen ?? true
  );

  const [isRotating, setIsRotating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Ensure modal opens scrolled to the very top every time it is opened
  useEffect(() => {
    if (isOpen) {
      const resetScroll = () => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
          const scrollParent = contentRef.current.parentElement;
          if (scrollParent) {
            scrollParent.scrollTop = 0;
          }
        }
      };

      resetScroll();
      const frameId = requestAnimationFrame(resetScroll);
      const timeoutId = setTimeout(resetScroll, 0);

      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timeoutId);
      };
    }
  }, [isOpen]);

  // Reset staged modal fields from the authoritative saved group state
  const resetStagedSettingsFromGroup = useCallback(() => {
    setLocalPolicy(group.enrollmentPolicy ?? 'open');
    setLocalMaxTrainees(
      group.maxTrainees !== null && group.maxTrainees !== undefined
        ? String(group.maxTrainees)
        : ''
    );
    setLocalExpiresAt(
      group.enrollmentExpiresAt ? toDatetimeLocal(group.enrollmentExpiresAt) : ''
    );
    setLocalIsOpen(group.isEnrollmentOpen !== false);
    setActionError(null);
    setSettingsError(null);
  }, [
    group.enrollmentPolicy,
    group.maxTrainees,
    group.enrollmentExpiresAt,
    group.isEnrollmentOpen,
  ]);

  useEffect(() => {
    if (isOpen) {
      resetStagedSettingsFromGroup();
    }
  }, [isOpen, resetStagedSettingsFromGroup]);

  const handleCloseModal = () => {
    resetStagedSettingsFromGroup();
    onClose();
  };

  const enrollmentCode = group.enrollmentCode || group.id;
  const isExpired = Boolean(
    localExpiresAt
      ? new Date(localExpiresAt).getTime() < Date.now()
      : group.enrollmentExpiresAt && new Date(group.enrollmentExpiresAt).getTime() < Date.now()
  );

  // Map policy to human-readable Arabic title
  const getPolicyTitle = (policy: GroupEnrollmentPolicy): string => {
    switch (policy) {
      case 'open':
        return 'انضمام تلقائي مفتوح';
      case 'approval_required':
        return 'موافقة المشرف مطلوبة';
      case 'closed':
        return 'انضمام مغلق';
      default:
        return 'انضمام تلقائي مفتوح';
    }
  };

  // Derive dynamic enrollment status badge and secondary text
  const enrollmentStatus = useMemo(() => {
    const policyTitle = getPolicyTitle(localPolicy);

    // 1. When enrollment is disabled via toggle or checkbox
    if (!localIsOpen) {
      return {
        variant: 'neutral' as const,
        label: 'الانضمام معطل',
        secondaryText: `سياسة الانضمام المختارة: ${policyTitle} (معطلة حالياً)`,
      };
    }

    // 2. When enrollment code has expired
    if (isExpired) {
      return {
        variant: 'danger' as const,
        label: 'انتهت الصلاحية',
        secondaryText: `سياسة الانضمام المختارة: ${policyTitle} (منتهية الصلاحية)`,
      };
    }

    // 3. When enrollment is enabled and current policy allows it
    if (localPolicy === 'open') {
      return {
        variant: 'success' as const,
        label: 'انضمام فوري (Open)',
        secondaryText: `سياسة الانضمام المختارة: ${policyTitle}`,
      };
    }

    if (localPolicy === 'approval_required') {
      return {
        variant: 'warning' as const,
        label: 'موافقة مطلوبة',
        secondaryText: `سياسة الانضمام المختارة: ${policyTitle}`,
      };
    }

    // Closed policy
    return {
      variant: 'neutral' as const,
      label: 'الانضمام مغلق',
      secondaryText: `سياسة الانضمام المختارة: ${policyTitle}`,
    };
  }, [localIsOpen, isExpired, localPolicy]);

  // Build join URL
  const joinUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://metro-courses.internal';
    return `${origin}/groups/join?code=${encodeURIComponent(enrollmentCode)}`;
  }, [enrollmentCode]);

  // Generate SVG string
  const qrSvgString = useMemo(() => {
    try {
      return generateQrSvg(joinUrl, {
        size: 200,
        margin: 2,
        darkColor: '#0E2A47', // Brand Primary Dark
        lightColor: '#FFFFFF',
      });
    } catch {
      return '';
    }
  }, [joinUrl]);

  // Handlers for staged policy changes (remain pending until user clicks "حفظ الإعدادات")
  const handlePolicyChange = (newPolicy: GroupEnrollmentPolicy) => {
    setLocalPolicy(newPolicy);
    setSettingsError(null);
  };

  const handleMaxTraineesChange = (val: string) => {
    setLocalMaxTrainees(val);
    setSettingsError(null);
  };

  const handleExpiresAtChange = (val: string) => {
    setLocalExpiresAt(val);
    setSettingsError(null);
  };

  const handleIsOpenChange = (val: boolean) => {
    setLocalIsOpen(val);
    setSettingsError(null);
  };

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = joinUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        if (typeof window !== 'undefined') {
          setCopied(false);
        }
      }, 3000);
    } catch {
      toast.error('تعذر نسخ الرابط إلى الحافظة');
    }
  };

  // Download QR as PNG
  const handleDownloadPng = () => {
    try {
      downloadQrCodeImage(joinUrl, `qr-${group.name.replace(/\s+/g, '-')}.png`, 1024);
      toast.success('تم تنزيل رمز الاستجابة السريعة بدقة عالية (PNG)');
    } catch {
      toast.error('حدث خطأ أثناء تنزيل صورة الرمز');
    }
  };

  // Toggle QR Enrollment Active / Inactive
  const handleToggleEnrollment = async () => {
    setIsToggling(true);
    setActionError(null);
    try {
      const nextState = !localIsOpen;
      const res = await groupsApi.toggleQRCode(group.id, nextState);
      const updatedGroup: TrainingGroup = {
        ...group,
        isEnrollmentOpen: res.isEnrollmentOpen,
      };
      setLocalIsOpen(res.isEnrollmentOpen);
      onIsEnrollmentOpenChange?.(res.isEnrollmentOpen);
      if (onGroupUpdated) {
        onGroupUpdated(updatedGroup);
      }
      toast.success(
        res.isEnrollmentOpen
          ? 'تم تفعيل الانضمام عبر رمز الاستجابة السريعة بنجاح'
          : 'تم تعطيل الانضمام عبر رمز الاستجابة السريعة مؤقتاً'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تغيير حالة الانضمام';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsToggling(false);
    }
  };

  // Rotate QR Token
  const handleConfirmRotate = async () => {
    setIsRotating(true);
    setActionError(null);
    try {
      const res = await groupsApi.rotateQRCode(group.id);
      const updatedGroup: TrainingGroup = {
        ...group,
        enrollmentCode: res.newEnrollmentCode,
      };
      if (onGroupUpdated) {
        onGroupUpdated(updatedGroup);
      }
      setShowRotateConfirm(false);
      toast.success('تمت إعادة توليد الرمز وإلغاء صلاحية الرمز السابق بنجاح');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إعادة توليد الرمز';
      setActionError(msg);
      toast.error(msg);
    } finally {
      setIsRotating(false);
    }
  };

  // Save Settings directly via established groupsApi.updateGroup
  const handleSaveSettings = async () => {
    if (localMaxTrainees && (isNaN(Number(localMaxTrainees)) || Number(localMaxTrainees) <= 0)) {
      setSettingsError('سعة المتدربين يجب أن تكون رقماً موجباً');
      return;
    }

    setIsSavingSettings(true);
    setSettingsError(null);
    try {
      const dto = {
        enrollmentPolicy: localPolicy,
        maxTrainees: localMaxTrainees.trim() ? parseInt(localMaxTrainees.trim(), 10) : null,
        enrollmentExpiresAt: localExpiresAt ? toIsoString(localExpiresAt) : null,
        isEnrollmentOpen: localIsOpen,
      };

      const updated = await groupsApi.updateGroup(group.id, dto);
      onEnrollmentPolicyChange?.(updated.enrollmentPolicy ?? localPolicy);
      onMaxTraineesChange?.(
        updated.maxTrainees !== null && updated.maxTrainees !== undefined
          ? String(updated.maxTrainees)
          : ''
      );
      onEnrollmentExpiresAtChange?.(
        updated.enrollmentExpiresAt ? toDatetimeLocal(updated.enrollmentExpiresAt) : ''
      );
      onIsEnrollmentOpenChange?.(updated.isEnrollmentOpen !== false);
      if (onGroupUpdated) {
        onGroupUpdated(updated);
      }
      toast.success('تم حفظ سياسة الانضمام وسعة المجموعة بنجاح');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ إعدادات الانضمام';
      setSettingsError(msg);
      toast.error(msg);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleCloseModal}
        title="رمز الاستجابة السريعة (QR) ورابط الانضمام"
        size="xl"
        dataTestId="group-qr-modal"
      >
        <div ref={contentRef} className="space-y-6 px-1" dir="rtl">
          {/* 1. Group Information and Current Enrollment Status Card (First) */}
          <div className="bg-bg rounded-xl p-4 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-text-muted">المجموعة التدريبية:</span>
              <h4 className="text-sm font-bold text-text mt-0.5">{group.name}</h4>
              <span className="text-xs text-primary font-mono">{group.id}</span>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5">
              <Badge
                variant={enrollmentStatus.variant}
                size="sm"
                data-testid="enrollment-status-badge"
              >
                {enrollmentStatus.label}
              </Badge>
              <span className="text-[11px] text-text-muted" data-testid="enrollment-status-secondary">
                {enrollmentStatus.secondaryText}
              </span>
            </div>
          </div>

          {/* Action / Settings Error Banner */}
          {(actionError || settingsError) && (
            <div data-testid="qr-action-error">
              <Alert variant="danger" title="خطأ في العملية">
                {actionError || settingsError}
              </Alert>
            </div>
          )}

          {/* 2. Enrollment Policy and Capacity Settings (Second) */}
          <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border/70">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon name="settings" size="sm" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-heading">سياسة الانضمام وسعة المجموعة</h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  تحديد قواعد قبول المتدربين والحد الأقصى للسعة وصلاحية رمز الانضمام السريع
                </p>
              </div>
            </div>

            {/* Enrollment Policy Choices */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-text">
                سياسة قبول المتدربين في المجموعة
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'open',
                    title: 'انضمام تلقائي مفتوح',
                    desc: 'ينضم المتدرب فور مسح رمز الاستجابة السريعة QR',
                  },
                  {
                    id: 'approval_required',
                    title: 'موافقة المشرف مطلوبة',
                    desc: 'يُرسل المتدرب طلباً وينتظر اعتماد مشرف المجموعة',
                  },
                  {
                    id: 'closed',
                    title: 'انضمام مغلق / تعيين مباشر',
                    desc: 'لا يُسمح بالانضمام الذاتي وتقتصر الإضافة على الإدارة',
                  },
                ].map((pol) => (
                  <button
                    key={pol.id}
                    type="button"
                    onClick={() => handlePolicyChange(pol.id as GroupEnrollmentPolicy)}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      localPolicy === pol.id
                        ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                        : 'border-border bg-bg text-text-muted hover:bg-neutral-light hover:text-text'
                    }`}
                    data-testid={`enrollment-policy-${pol.id}`}
                  >
                    <div className="font-bold text-xs">{pol.title}</div>
                    <div className="text-[11px] text-text-muted mt-1 leading-relaxed">{pol.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Capacity and Expiration Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border/60">
              {/* Max Trainees Capacity */}
              <div>
                <FormInput
                  label="الحد الأقصى لعدد المتدربين (السعة القصوى)"
                  type="number"
                  min="1"
                  value={localMaxTrainees}
                  onChange={(e) => handleMaxTraineesChange(e.target.value)}
                  placeholder="اتركه فارغاً لسعة غير محدودة"
                  helperText="يمنع النظام التسجيل الإضافي تلقائياً عند بلوغ السعة"
                  error={policyErrors?.maxTrainees}
                  id="group-capacity-input"
                  data-testid="group-capacity-input"
                />
              </div>

              {/* Token Expiration */}
              <div className="space-y-1.5">
                <label htmlFor="group-token-expiry" className="block text-xs font-bold text-text">
                  تاريخ انتهاء صلاحية رمز الانضمام (اختياري)
                </label>
                <input
                  id="group-token-expiry"
                  type="datetime-local"
                  value={localExpiresAt}
                  onChange={(e) => handleExpiresAtChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  data-testid="group-token-expiry"
                />
                <span className="text-[11px] text-text-muted block">
                  يُلغى قبول الرمز تلقائياً بعد هذا التاريخ
                </span>
              </div>
            </div>

            {/* Master Open/Close Toggle */}
            <div className="flex items-center gap-3 pt-3 border-t border-border/60">
              <input
                type="checkbox"
                id="enrollment-open-toggle"
                checked={localIsOpen}
                onChange={(e) => handleIsOpenChange(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer accent-primary"
                data-testid="enrollment-open-toggle"
              />
              <label
                htmlFor="enrollment-open-toggle"
                className="text-xs font-medium text-text cursor-pointer select-none"
              >
                فتح استقبال طلبات الانضمام فوراً عبر رمز الاستجابة السريعة QR
              </label>
            </div>
          </div>

          {/* 3. QR Code Presentation and Direct Enrollment Link (Afterward) */}
          <div className="space-y-6 pt-2 border-t border-border/70">
            {/* Warning Banner if Inactive or Expired */}
            {!localIsOpen && (
              <div data-testid="qr-disabled-alert">
                <Alert variant="warning" title="الانضمام معطل حالياً">
                  رمز الاستجابة السريعة ورابط الانضمام معطلان حالياً. لن يتمكن أي متدرب من الانضمام حتى تقوم بتفعيل الانضمام مجدداً.
                </Alert>
              </div>
            )}

            {isExpired && (
              <div data-testid="qr-expired-alert">
                <Alert variant="danger" title="انتهت صلاحية الرمز">
                  انتهت صلاحية رمز الانضمام المحدد بتاريخ ({formatArabicDateTime(localExpiresAt || group.enrollmentExpiresAt)}). يرجى إعادة توليد الرمز أو تمديد صلاحيته.
                </Alert>
              </div>
            )}

            {/* QR Code Presentation Box */}
            <div className="flex flex-col items-center justify-center p-6 bg-surface rounded-2xl border border-border shadow-xs space-y-4">
              <div
                className={`p-3 bg-white rounded-xl shadow-xs border transition-opacity duration-200 ${
                  !localIsOpen || isExpired ? 'opacity-40 grayscale' : 'opacity-100'
                }`}
                data-testid="qr-svg-container"
                dangerouslySetInnerHTML={{ __html: qrSvgString }}
              />

              <div className="text-center space-y-1">
                <span className="text-xs font-mono font-bold tracking-wider px-3 py-1 bg-neutral-light rounded-md border border-border text-text">
                  {enrollmentCode}
                </span>
                <p className="text-[11px] text-text-muted pt-1">
                  امسح الرمز بواسطة كاميرا الهاتف للانتقال مباشرة إلى صفحة الانضمام للمجموعة
                </p>
              </div>
            </div>

            {/* Join URL Display & Copy */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text">رابط الانضمام المباشر:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={joinUrl}
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg bg-bg border border-border text-text-muted focus:outline-none select-all"
                  data-testid="join-url-input"
                />
                <Button
                  type="button"
                  variant={copied ? 'primary' : 'outline'}
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 flex items-center gap-1.5"
                  data-testid="copy-join-link-btn"
                >
                  <Icon name={copied ? 'checkCircle' : 'copy'} size="sm" />
                  <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
                </Button>
              </div>
            </div>

            {/* Enrollment Info & Metadata */}
            <div className="bg-surface rounded-xl p-3 border border-border/70 text-xs text-text-muted space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text">سعة المجموعة الحالية:</span>
                <span>
                  {group.traineeIds?.length || 0} / {localMaxTrainees ? `${localMaxTrainees} متدرب` : 'غير محددة'}
                </span>
              </div>
              {(localExpiresAt || group.enrollmentExpiresAt) && (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text">تاريخ انتهاء صلاحية الرمز:</span>
                  <span>{formatArabicDateTime(localExpiresAt || group.enrollmentExpiresAt)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-medium text-text">آلية التسجيل بالمقررات:</span>
                <span className="text-primary font-bold">
                  {localPolicy === 'open'
                    ? 'تسجيل فوري لكافة مقررات الدورة'
                    : 'تتطلب موافقة الإدارة أو المشرف'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Modal Action Buttons Row (Footer Actions Remain Fixed at Bottom) */}
          <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Download PNG Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadPng}
                disabled={!localIsOpen || isExpired}
                className="flex items-center gap-1.5"
                data-testid="download-qr-btn"
              >
                <Icon name="download" size="sm" />
                <span>تنزيل PNG</span>
              </Button>

              {/* Toggle Open/Closed Master Switch */}
              <Button
                type="button"
                variant={localIsOpen ? 'outline' : 'primary'}
                size="sm"
                onClick={handleToggleEnrollment}
                isLoading={isToggling}
                className="flex items-center gap-1.5"
                data-testid="toggle-enrollment-btn"
              >
                <Icon name={localIsOpen ? 'lock' : 'checkCircle'} size="sm" />
                <span>{localIsOpen ? 'تعطيل الانضمام' : 'تفعيل الانضمام'}</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Rotate QR Token (Admin Only) */}
              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRotateConfirm(true)}
                  disabled={isRotating}
                  className="flex items-center gap-1.5 text-danger hover:bg-danger/10 border-danger/30"
                  data-testid="rotate-qr-btn"
                >
                  <Icon name="refresh" size="sm" />
                  <span>إعادة توليد الرمز</span>
                </Button>
              )}

              {/* Save Settings Button */}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveSettings}
                isLoading={isSavingSettings}
                disabled={isSavingSettings}
                data-testid="save-qr-settings-btn"
                className="font-bold text-xs"
              >
                حفظ الإعدادات
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseModal}
                data-testid="close-qr-modal-btn"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog for QR Code Rotation */}
      <ConfirmDialog
        isOpen={showRotateConfirm}
        title="تأكيد إعادة توليد رمز الاستجابة السريعة"
        message={
          <div className="space-y-2 text-sm text-text">
            <p>
              هل أنت متأكد من رغبتك في إعادة توليد رمز الانضمام لهذه المجموعة؟
            </p>
            <p className="text-danger font-medium text-xs">
              تنبيه: سيؤدي هذا الإجراء إلى إبطال صلاحية الرمز السابق فوراً، ولن يتمكن أي متدرب يملك الرمز أو الرابط القديم من الانضمام.
            </p>
          </div>
        }
        confirmLabel="نعم، أعد التوليد وأبطل الرمز السابق"
        cancelLabel="إلغاء التراجع"
        variant="danger"
        isConfirming={isRotating}
        onConfirm={handleConfirmRotate}
        onCancel={() => setShowRotateConfirm(false)}
        testId="rotate-qr-confirm-dialog"
        confirmTestId="confirm-rotate-qr-btn"
        cancelTestId="cancel-rotate-qr-btn"
      />
    </>
  );
};
