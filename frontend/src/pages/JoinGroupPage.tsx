import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import type { GroupPreviewInfoDTO, JoinGroupQRResponseDTO } from '@/core/groups/dtos';
import { groupsApi } from '@/features/groups/services/groupsApi';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { brandConfig } from '@/shared/config/brand';

export const JoinGroupPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const codeParam = searchParams.get('code') || '';
  const [manualCode, setManualCode] = useState(codeParam);

  const [loading, setLoading] = useState(Boolean(codeParam));
  const [groupInfo, setGroupInfo] = useState<GroupPreviewInfoDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  // Form input for approval_required note
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [joinResult, setJoinResult] = useState<JoinGroupQRResponseDTO | null>(null);

  // Fetch Group Preview Details
  const fetchPreview = useCallback(async (codeToFetch: string) => {
    if (!codeToFetch.trim()) {
      setGroupInfo(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setErrorCode(null);
    setSubmitError(null);
    setJoinResult(null);

    try {
      const data = await groupsApi.getJoinInfo(codeToFetch.trim());
      setGroupInfo(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'رمز الانضمام غير صالح أو منتهي الصلاحية';
      setLoadError(msg);
      // Extract status code if available
      if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: number }).status === 'number') {
        setErrorCode((err as { status: number }).status);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (codeParam) {
      fetchPreview(codeParam);
    }
  }, [codeParam, fetchPreview]);

  const handleManualCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setSearchParams({ code: manualCode.trim() });
  };

  // Trainee Join Submission Handler
  const handleJoin = async () => {
    const activeCode = codeParam || manualCode;
    if (!activeCode.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await groupsApi.joinGroupByQR({
        enrollmentCode: activeCode.trim(),
        note: note.trim() || undefined,
      });
      setJoinResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام الانضمام للمجموعة';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-bg text-text py-10 px-4 sm:px-6 flex flex-col items-center justify-center antialiased selection:bg-primary/20"
      dir="rtl"
      data-testid="join-group-page"
    >
      <div className="w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center mb-1">
            <img
              src={brandConfig.logos.emblem}
              alt={brandConfig.emblemAltText}
              className="h-12 w-auto object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-text-heading">
            بوابة الانضمام للمجموعات التدريبية
          </h1>
          <p className="text-xs text-text-muted">
            المنصة المركزية للتعليم والتدريب المهني — مترو القاهرة
          </p>
        </div>

        {/* ── Case 1: Join Result Success State ───────────────────────── */}
        {joinResult && (
          <Card
            className="p-6 bg-surface border border-border shadow-md rounded-2xl space-y-5 text-center"
            data-testid="join-success-card"
          >
            <div className="w-14 h-14 mx-auto rounded-full bg-success/10 text-success flex items-center justify-center">
              <Icon name="checkCircle" size="lg" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-text">
                {joinResult.isPendingApproval
                  ? 'تم إرسال طلب الانضمام بنجاح'
                  : joinResult.message.includes('بالفعل')
                  ? 'أنت عضو بالفعل في هذه المجموعة'
                  : 'مرحباً بك في المجموعة التدريبية!'}
              </h2>
              <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                {joinResult.message}
              </p>
            </div>

            {/* Enrolled Courses Metric pill */}
            {!joinResult.isPendingApproval && joinResult.enrolledCoursesCount > 0 && (
              <div className="bg-bg rounded-xl p-3 border border-border text-xs inline-flex items-center gap-2 text-text font-medium">
                <Icon name="courses" size="sm" className="text-primary" />
                <span>تم تسجيلك في <strong className="text-primary font-bold">{joinResult.enrolledCoursesCount}</strong> مقررات تدريبية جديدة</span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => navigate('/my-groups')}
                data-testid="go-my-groups-btn"
              >
                الانتقال إلى مجموعاتي التدريبية
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => navigate('/my-courses')}
                data-testid="go-my-courses-btn"
              >
                عرض مقرراتي التدريبية
              </Button>
            </div>
          </Card>
        )}

        {/* ── Case 2: No Code Specified Form ──────────────────────────── */}
        {!codeParam && !joinResult && (
          <Card className="p-6 bg-surface border border-border shadow-md rounded-2xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <Icon name="qrCode" size="md" className="text-primary" />
              <h2 className="text-sm font-bold text-text">إدخال رمز الانضمام</h2>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              إذا قمت بمسح رمز الاستجابة السريعة ستصلك هذه البيانات تلقائياً، أو يمكنك إدخال رمز الانضمام يدوياً هنا:
            </p>

            <form onSubmit={handleManualCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text mb-1.5">
                  رمز الانضمام للمجموعة (Enrollment Code):
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="مثال: GRP-101-SEC-ABC123"
                  className="w-full text-xs font-mono p-3 rounded-xl bg-bg border border-border text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="manual-code-input"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!manualCode.trim()}
                className="w-full"
                data-testid="submit-manual-code-btn"
              >
                معاينة المجموعة والانضمام
              </Button>
            </form>
          </Card>
        )}

        {/* ── Case 3: Loading Preview Details ─────────────────────────── */}
        {loading && (
          <Card className="p-10 bg-surface border border-border shadow-md rounded-2xl flex flex-col items-center justify-center space-y-3">
            <Icon name="clock" size="lg" className="animate-spin text-primary" />
            <p className="text-xs text-text-muted font-medium">
              جارٍ التحقق من صلاحية رمز الانضمام وبيانات المجموعة...
            </p>
          </Card>
        )}

        {/* ── Case 4: Load Error State ────────────────────────────────── */}
        {!loading && loadError && !joinResult && (
          <Card
            className="p-6 bg-surface border border-border shadow-md rounded-2xl space-y-4 text-center"
            data-testid="join-error-card"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-danger/10 text-danger flex items-center justify-center">
              <Icon name="xCircle" size="lg" />
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-bold text-text">تعذر الانضمام إلى المجموعة</h2>
              <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                {loadError}
              </p>
            </div>

            {errorCode === 410 && (
              <p className="text-[11px] text-danger font-medium">
                يرجى التواصل مع مسؤول التدريب للحصول على رمز انضمام جديد مجدد الصلاحية.
              </p>
            )}

            <div className="pt-2 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchParams({});
                  setManualCode('');
                  setLoadError(null);
                }}
              >
                إدخال رمز آخر
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                العودة للرئيسية
              </Button>
            </div>
          </Card>
        )}

        {/* ── Case 5: Valid Group Preview Card & Join Action ──────────── */}
        {!loading && groupInfo && !joinResult && (
          <Card
            className="p-6 bg-surface border border-border shadow-md rounded-2xl space-y-5"
            data-testid="group-preview-card"
          >
            {/* Header info */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/60">
              <div>
                <span className="text-[11px] font-bold text-text-muted block">
                  المجموعة التدريبية المستهدفة:
                </span>
                <h2 className="text-base font-bold text-text mt-0.5" data-testid="preview-group-name">
                  {groupInfo.name}
                </h2>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  {groupInfo.description || 'برنامج تدريبي مهني معتمد لموظفي وفنيي مترو القاهرة.'}
                </p>
              </div>

              <Badge
                variant={
                  groupInfo.enrollmentPolicy === 'open'
                    ? 'success'
                    : groupInfo.enrollmentPolicy === 'approval_required'
                    ? 'warning'
                    : 'neutral'
                }
                size="sm"
                data-testid="preview-policy-badge"
              >
                {groupInfo.enrollmentPolicy === 'open'
                  ? 'انضمام فوري'
                  : groupInfo.enrollmentPolicy === 'approval_required'
                  ? 'موافقة المشرف مطلوبة'
                  : 'الانضمام مغلق'}
              </Badge>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-bg rounded-xl p-3 border border-border flex items-center gap-2.5">
                <Icon name="courses" size="sm" className="text-primary shrink-0" />
                <div>
                  <span className="text-text-muted block text-[10px]">المقررات التدريبية</span>
                  <span className="font-bold text-text">{groupInfo.totalCoursesCount} مقررات</span>
                </div>
              </div>

              <div className="bg-bg rounded-xl p-3 border border-border flex items-center gap-2.5">
                <Icon name="user" size="sm" className="text-primary shrink-0" />
                <div>
                  <span className="text-text-muted block text-[10px]">المتدربون المسجلون</span>
                  <span className="font-bold text-text">
                    {groupInfo.currentTraineesCount}{' '}
                    {groupInfo.maxTrainees ? (
                      <span className="text-text-muted font-normal text-[10px]">/ {groupInfo.maxTrainees}</span>
                    ) : null}
                  </span>
                </div>
              </div>
            </div>

            {/* Policy Explanation Banner */}
            {groupInfo.enrollmentPolicy === 'open' ? (
              <div className="bg-success-light/40 border border-success/25 rounded-xl p-3.5 text-xs text-success-dark space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Icon name="checkCircle" size="sm" />
                  <span>انضمام فوري ومباشر</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  بالضغط على الزر أدناه، سيتم تسجيلك فوراً كعضو في هذه المجموعة وإتاحة كافة المقررات والأنشطة المعتمدة في خطتك التدريبية.
                </p>
              </div>
            ) : (
              <div className="bg-warning-light/40 border border-warning-dark/25 rounded-xl p-3.5 text-xs text-warning-dark space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Icon name="alert" size="sm" />
                  <span>الانضمام يتطلب موافقة المشرف</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  سيتم إرسال طلب انضمامك إلى مشرف المجموعة للمراجعة والاعتماد. ستصلك إشعارات فورية حال اعتماد الطلب لتتمكن من بدء المقررات.
                </p>
              </div>
            )}

            {/* Submit Error Banner */}
            {submitError && (
              <div data-testid="join-submit-error">
                <Alert variant="danger" title="تعذر إتمام الانضمام">
                  {submitError}
                </Alert>
              </div>
            )}

            {/* Optional Note for approval_required */}
            {groupInfo.enrollmentPolicy === 'approval_required' && (
              <div>
                <label className="block text-xs font-bold text-text mb-1.5">
                  ملاحظة إضافية للمشرف (اختياري):
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="يمكنك كتابة رقم ورديتك، قسمك، أو سبب رغبتك في الانضمام لهذه الدورة..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl bg-bg border border-border text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="join-note-input"
                />
              </div>
            )}

            {/* Submit Join Button */}
            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleJoin}
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="w-full"
                data-testid={
                  groupInfo.enrollmentPolicy === 'open'
                    ? 'join-group-submit-btn'
                    : 'submit-join-request-btn'
                }
              >
                {groupInfo.enrollmentPolicy === 'open'
                  ? 'الانضمام الآن إلى المجموعة التدريبية'
                  : 'إرسال طلب الانضمام للمشرف'}
              </Button>
            </div>
          </Card>
        )}

        {/* Back Link */}
        <div className="text-center">
          <Link
            to="/dashboard"
            className="text-xs text-text-muted hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <span>العودة إلى لوحة المتابعة الرئيسية</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default JoinGroupPage;
