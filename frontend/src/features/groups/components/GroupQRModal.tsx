import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { TrainingGroup } from '@/core/groups/types';
import { generateQrSvg, downloadQrCodeImage } from '@/core/utils/qrGenerator';
import { groupsApi } from '../services/groupsApi';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { formatArabicDateTime } from '../utils/dateUtils';

export interface GroupQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: TrainingGroup;
  onGroupUpdated?: (updated: TrainingGroup) => void;
}

export const GroupQRModal: React.FC<GroupQRModalProps> = ({
  isOpen,
  onClose,
  group,
  onGroupUpdated,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  const [isRotating, setIsRotating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const enrollmentCode = group.enrollmentCode || group.id;
  const isEnrollmentOpen = group.isEnrollmentOpen !== false;
  const isExpired = Boolean(
    group.enrollmentExpiresAt && new Date(group.enrollmentExpiresAt).getTime() < Date.now()
  );

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

  // Copy link to clipboard
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(joinUrl);
      } else {
        // Fallback for non-secure / test environments
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
      const nextState = !isEnrollmentOpen;
      const res = await groupsApi.toggleQRCode(group.id, nextState);
      const updatedGroup: TrainingGroup = {
        ...group,
        isEnrollmentOpen: res.isEnrollmentOpen,
      };
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

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="رمز الاستجابة السريعة (QR) ورابط الانضمام"
        size="md"
        dataTestId="group-qr-modal"
      >
        <div className="space-y-6" dir="rtl">
          {/* Header Card */}
          <div className="bg-bg rounded-xl p-4 border border-border flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-text-muted">المجموعة التدريبية:</span>
              <h4 className="text-sm font-bold text-text mt-0.5">{group.name}</h4>
              <span className="text-xs text-primary font-mono">{group.id}</span>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge
                variant={
                  group.enrollmentPolicy === 'open'
                    ? 'success'
                    : group.enrollmentPolicy === 'approval_required'
                    ? 'warning'
                    : 'danger'
                }
                size="sm"
              >
                {group.enrollmentPolicy === 'open'
                  ? 'انضمام فوري (Open)'
                  : group.enrollmentPolicy === 'approval_required'
                  ? 'موافقة مطلوبة'
                  : 'الانضمام مغلق'}
              </Badge>
              <span className="text-[11px] text-text-muted">
                {isEnrollmentOpen ? 'الانضمام مفعل' : 'الانضمام معطل'}
              </span>
            </div>
          </div>

          {/* Action Error Banner */}
          {actionError && (
            <div data-testid="qr-action-error">
              <Alert variant="danger" title="خطأ في العملية">
                {actionError}
              </Alert>
            </div>
          )}

          {/* Warning Banner if Inactive or Expired */}
          {!isEnrollmentOpen && (
            <div data-testid="qr-disabled-alert">
              <Alert variant="warning" title="الانضمام معطل حالياً">
                رمز الاستجابة السريعة ورابط الانضمام معطلان حالياً. لن يتمكن أي متدرب من الانضمام حتى تقوم بتفعيل الانضمام مجدداً.
              </Alert>
            </div>
          )}

          {isExpired && (
            <div data-testid="qr-expired-alert">
              <Alert variant="danger" title="انتهت صلاحية الرمز">
                انتهت صلاحية رمز الانضمام المحدد بتاريخ ({formatArabicDateTime(group.enrollmentExpiresAt)}). يرجى إعادة توليد الرمز أو تمديد صلاحيته.
              </Alert>
            </div>
          )}

          {/* QR Code Presentation Box */}
          <div className="flex flex-col items-center justify-center p-6 bg-surface rounded-2xl border border-border shadow-xs space-y-4">
            <div
              className={`p-3 bg-white rounded-xl shadow-xs border transition-opacity duration-200 ${
                !isEnrollmentOpen || isExpired ? 'opacity-40 grayscale' : 'opacity-100'
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
                {group.traineeIds?.length || 0} / {group.maxTrainees ? `${group.maxTrainees} متدرب` : 'غير محددة'}
              </span>
            </div>
            {group.enrollmentExpiresAt && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-text">تاريخ انتهاء صلاحية الرمز:</span>
                <span>{formatArabicDateTime(group.enrollmentExpiresAt)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium text-text">آلية التسجيل بالمقررات:</span>
              <span className="text-primary font-bold">
                {group.enrollmentPolicy === 'open'
                  ? 'تسجيل فوري لكافة مقررات الدورة'
                  : 'تتطلب موافقة الإدارة أو المشرف'}
              </span>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Download PNG Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadPng}
                disabled={!isEnrollmentOpen || isExpired}
                className="flex items-center gap-1.5"
                data-testid="download-qr-btn"
              >
                <Icon name="download" size="sm" />
                <span>تنزيل PNG</span>
              </Button>

              {/* Toggle Open/Closed Master Switch */}
              <Button
                type="button"
                variant={isEnrollmentOpen ? 'outline' : 'primary'}
                size="sm"
                onClick={handleToggleEnrollment}
                isLoading={isToggling}
                className="flex items-center gap-1.5"
                data-testid="toggle-enrollment-btn"
              >
                <Icon name={isEnrollmentOpen ? 'lock' : 'checkCircle'} size="sm" />
                <span>{isEnrollmentOpen ? 'تعطيل الانضمام' : 'تفعيل الانضمام'}</span>
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

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
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
