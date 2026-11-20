import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { coursesApi } from '@/features/courses/services/coursesApi';
import type { CourseQrMode, CourseVisibilityMode } from '@/core/courses/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';

export const CourseQrJoinPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<{
    course: {
      id: string;
      title: string;
      description?: string;
      lecturerName: string;
      lifecycleStatus: string;
      accessMode: CourseVisibilityMode;
    };
    qrSettings: {
      isEnabled: boolean;
      qrMode: CourseQrMode;
      expiresAt: string | null;
      isExpired: boolean;
    };
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMsg('رمز QR غير صالح.');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    coursesApi
      .getCourseQrJoinInfo(token)
      .then((res) => {
        if (!cancelled) {
          setInfo(res);
          setErrorMsg(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg('رمز QR غير صالح أو تم استبداله.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleProceed = async () => {
    if (!token || !info) return;
    setIsJoining(true);
    try {
      const res = await coursesApi.joinCourseByQr(token);
      if (res.enrolled) {
        toast.success('تم تسجيلك في المقرر بنجاح عبر رمز QR.');
      }
      navigate(`/courses/${encodeURIComponent(res.courseId)}`, { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.message || 'تعذر الدخول إلى المقرر عبر رمز QR.');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-3" data-testid="course-qr-join-loading">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-text-muted">جاري التحقق من رمز QR للمقرر...</p>
      </div>
    );
  }

  if (errorMsg || !info) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-4" data-testid="course-qr-join-error">
        <Alert variant="danger" title="تعذر استخدام رمز QR">
          {errorMsg || 'رمز QR غير صالح.'}
        </Alert>
        <Button type="button" variant="outline" onClick={() => navigate('/courses')}>
          العودة إلى كتالوج المقررات
        </Button>
      </div>
    );
  }

  const isBlocked = !info.qrSettings.isEnabled || info.qrSettings.isExpired;

  return (
    <div className="max-w-xl mx-auto py-10 px-4" data-testid="course-qr-join-page">
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="courses" size="md" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-text-heading">{info.course.title}</h1>
              <p className="text-xs text-text-muted">المحاضر: {info.course.lecturerName}</p>
            </div>
          </div>
          <Badge variant={info.qrSettings.qrMode === 'auto_enroll' ? 'success' : 'primary'}>
            {info.qrSettings.qrMode === 'auto_enroll' ? 'تسجيل مباشر' : 'معاينة المقرر'}
          </Badge>
        </div>

        {info.course.description && (
          <p className="text-xs text-text-muted leading-relaxed">{info.course.description}</p>
        )}

        {!info.qrSettings.isEnabled && (
          <Alert variant="warning" title="رمز QR معطّل">
            تم إيقاف الدخول عبر رمز QR لهذا المقرر من قبل الإدارة أو المحاضر.
          </Alert>
        )}

        {info.qrSettings.isExpired && (
          <Alert variant="warning" title="انتهت صلاحية الرمز">
            انتهت صلاحية رمز QR لهذا المقرر ولا يمكن استخدامه للانضمام.
          </Alert>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={() => navigate('/courses')}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isBlocked || isJoining}
            onClick={handleProceed}
            data-testid="course-qr-proceed-btn"
          >
            {isJoining
              ? 'جاري التنفيذ...'
              : info.qrSettings.qrMode === 'auto_enroll'
              ? 'تسجيل والدخول للمقرر'
              : 'الانتقال لصفحة المقرر'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CourseQrJoinPage;
