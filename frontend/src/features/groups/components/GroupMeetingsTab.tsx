import React, { useState } from 'react';
import type { TrainingGroup, GroupResource } from '@/core/groups/types';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';
import { FormInput } from '@/shared/ui/FormInput';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { groupsApi } from '../services/groupsApi';
import {
  type MeetingPlatform,
  MEETING_PLATFORMS,
  detectMeetingPlatform,
  isMeetingResource,
} from '../utils/meetingUtils';

export interface GroupMeetingsTabProps {
  groupId: string;
  group: TrainingGroup;
  onUpdateGroup?: (updated: TrainingGroup) => void;
  readOnly?: boolean;
}

export const GroupMeetingsTab: React.FC<GroupMeetingsTabProps> = ({
  groupId,
  group,
  onUpdateGroup,
  readOnly = false,
}) => {
  const toast = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<GroupResource | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState<MeetingPlatform>('teams');
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const meetings = (group.resources || []).filter(isMeetingResource);

  const handleOpenAdd = () => {
    setTitle('');
    setUrl('');
    setPlatform('teams');
    setIsAutoDetected(false);
    setDescription('');
    setError(null);
    setIsAddModalOpen(true);
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (error) setError(null);

    const clean = newUrl.trim().toLowerCase();
    if (clean.includes('zoom.us') || clean.includes('zoomgov.com')) {
      setPlatform('zoom');
      setIsAutoDetected(true);
    } else if (clean.includes('meet.google.com') || clean.includes('google.com/meet')) {
      setPlatform('meet');
      setIsAutoDetected(true);
    } else if (
      clean.includes('teams.microsoft.com') ||
      clean.includes('teams.live.com') ||
      clean.includes('microsoft.com/teams')
    ) {
      setPlatform('teams');
      setIsAutoDetected(true);
    }
  };

  const handleSelectPlatform = (selected: MeetingPlatform) => {
    setPlatform(selected);
    setIsAutoDetected(false);
  };

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('عنوان اللقاء التفاعلي مطلوب');
      return;
    }
    if (!url.trim()) {
      setError(`رابط اجتماع ${MEETING_PLATFORMS[platform].label} مطلوب`);
      return;
    }

    setIsSubmitting(true);
    try {
      const detected = detectMeetingPlatform(url, platform);
      const newResource: GroupResource = {
        id: `meeting-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: title.trim(),
        type: detected === 'other' ? 'link' : detected,
        url: url.trim(),
        description: description.trim(),
        order: (group.resources?.length || 0) + 1,
        createdAt: new Date().toISOString(),
      };

      const existingResources = group.resources || [];
      const updatedResources = [...existingResources, newResource];

      const updated = await groupsApi.updateGroup(groupId, {
        resources: updatedResources,
      });

      if (onUpdateGroup) {
        onUpdateGroup(updated);
      }
      toast.success(`تمت جدولة لقاء ${MEETING_PLATFORMS[detected].label} بنجاح`);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to save meeting:', err);
      toast.error('حدث خطأ أثناء حفظ اللقاء التفاعلي');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    setIsSubmitting(true);
    try {
      const existingResources = group.resources || [];
      const updatedResources = existingResources.filter((r) => r.id !== meetingToDelete.id);

      const updated = await groupsApi.updateGroup(groupId, {
        resources: updatedResources,
      });

      if (onUpdateGroup) {
        onUpdateGroup(updated);
      }
      toast.success('تم حذف اللقاء التفاعلي بنجاح');
      setMeetingToDelete(null);
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      toast.error('حدث خطأ أثناء حذف اللقاء التفاعلي');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = (meeting: GroupResource) => {
    const meetingPlatform = detectMeetingPlatform(meeting.url, meeting.type);
    const meta = MEETING_PLATFORMS[meetingPlatform];
    if (meeting.url) {
      window.open(meeting.url, '_blank', 'noopener,noreferrer');
      toast.info(`جارٍ الانتقال إلى لقاء ${meta.label}: ${meeting.title}`);
    } else {
      toast.info(`جارٍ الانضمام إلى: ${meeting.title}`);
    }
  };

  return (
    <div className="space-y-6" data-testid="group-meetings-tab" dir="rtl">
      {/* Header Bar */}
      <Card variant="elevated" className="border-border">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1 font-semibold">
              <Icon name="video" size="sm" className="text-primary" />
              <span>اللقاءات التفاعلية (Microsoft Teams)</span>
              <span className="text-[11px] text-text-muted/80">• دعم Zoom و Google Meet</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-text-heading">
              اللقاءات التفاعلية وجلسات البث المباشر
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5 leading-relaxed">
              جلسات البث المباشر واللقاءات التدريبية المباشرة المجدولة لأعضاء هذه المجموعة عبر منصات اللقاءات المعتمدة (Microsoft Teams / Zoom / Google Meet).
            </p>
          </div>

          {!readOnly && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="plus"
              onClick={handleOpenAdd}
              data-testid="open-add-meeting-btn"
            >
              جدولة لقاء تفاعلي جديد
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {meetings.length === 0 ? (
        <Card
          variant="default"
          className="text-center py-12 px-6 border-dashed border-2"
          data-testid="meetings-empty-state"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Icon name="video" size="lg" />
          </div>
          <h3 className="text-base font-bold text-text-heading mb-1">
            لا توجد لقاءات تفاعلية مجدولة لهذه المجموعة حالياً
          </h3>
          <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed mb-4">
            {readOnly
              ? 'لم يقم المشرف بجدولة لقاءات تفاعلية أو جلسات مباشرة لهذه المجموعة التدريبية حتى الآن.'
              : 'يمكنك جدولة لقاءات تدريبية تفاعلية وجلسات مباشرة عبر Microsoft Teams أو Zoom أو Google Meet لأعضاء المجموعة.'}
          </p>
          {!readOnly && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="plus"
              onClick={handleOpenAdd}
              data-testid="empty-add-meeting-btn"
            >
              جدولة لقاء تفاعلي جديد
            </Button>
          )}
        </Card>
      ) : (
        /* Meetings List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="meetings-list">
          {meetings.map((meeting) => {
            const meetingPlatform = detectMeetingPlatform(meeting.url, meeting.type);
            const meta = MEETING_PLATFORMS[meetingPlatform];

            return (
              <Card
                key={meeting.id}
                variant="default"
                className="p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-primary/40 transition-all bg-surface"
                data-testid={`meeting-card-${meeting.id}`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center shrink-0">
                        <Icon name="video" size="sm" />
                      </div>
                      <div>
                        <h4
                          className="font-bold text-text-heading line-clamp-1"
                          data-testid={`meeting-title-${meeting.id}`}
                        >
                          {meeting.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={meta.badgeVariant} className="text-xs px-2 py-0.5">
                            {meta.label}
                          </Badge>
                          {meeting.createdAt && (
                            <span className="text-[11px] text-text-muted">
                              {new Date(meeting.createdAt).toLocaleDateString('ar-EG')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon="trash"
                        onClick={() => setMeetingToDelete(meeting)}
                        title="حذف اللقاء"
                        className="text-danger-dark hover:bg-danger-light/40 text-xs"
                        data-testid={`delete-meeting-btn-${meeting.id}`}
                      >
                        حذف
                      </Button>
                    )}
                  </div>

                  {meeting.description && (
                    <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {meeting.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border/70 flex items-center justify-between gap-2 text-xs">
                  <div className="text-xs text-text-muted truncate max-w-[200px]" dir="ltr">
                    {meeting.url}
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleJoin(meeting)}
                    leftIcon="video"
                    className="text-xs font-bold gap-1.5"
                    data-testid={`join-meeting-btn-${meeting.id}`}
                  >
                    الانضمام للقاء التجريبي
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Meeting Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="جدولة لقاء تفاعلي جديد للمجموعة"
        size="md"
      >
        <form onSubmit={handleSaveMeeting} className="space-y-4" dir="rtl">
          {error && <Alert variant="danger">{error}</Alert>}

          <FormInput
            label="عنوان اللقاء التفاعلي *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: ورشة تدريبية تفاعلية — أنظمة الإشارات والتحكم"
            required
            data-testid="meeting-title-input"
          />

          {/* Platform Selector with Auto-detection Indicator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-text-heading">
                المنصة المستضيفة للقاء
              </label>
              {isAutoDetected && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success-light px-2 py-0.5 rounded-full"
                  data-testid="platform-autodetect-badge"
                >
                  <Icon name="check" size="sm" />
                  كشف تلقائي: {MEETING_PLATFORMS[platform].label}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="منصة اللقاء">
              {(['teams', 'zoom', 'meet', 'other'] as MeetingPlatform[]).map((p) => {
                const meta = MEETING_PLATFORMS[p];
                const isSelected = platform === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPlatform(p)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface text-text hover:bg-neutral-light border-border'
                    }`}
                    data-testid={`meeting-platform-${p}`}
                  >
                    <Icon name="video" size="sm" className={isSelected ? 'text-white' : 'text-text-muted'} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meeting URL */}
          <div className="space-y-1">
            <FormInput
              label={`رابط الاجتماع (${MEETING_PLATFORMS[platform].label}) *`}
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={MEETING_PLATFORMS[platform].placeholder}
              dir="ltr"
              required
              data-testid="meeting-url-input"
            />
            <p className="text-[11px] text-text-muted">
              {MEETING_PLATFORMS[platform].guideText} (يتم التعرف التلقائي على Zoom أو Google Meet أو Teams عند لصق الرابط).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-heading mb-1.5">
              تفاصيل ومحاور اللقاء (اختياري)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="ملاحظات حول موعد اللقاء، الأجندة، أو المتطلبات السابقة..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="meeting-description-input"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
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
              data-testid="confirm-save-meeting-btn"
            >
              حفظ اللقاء
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Meeting Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(meetingToDelete)}
        title="تأكيد حذف اللقاء التفاعلي"
        message={`هل أنت متأكد من حذف اللقاء "${meetingToDelete?.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        onConfirm={handleDeleteMeeting}
        onCancel={() => setMeetingToDelete(null)}
        onClose={() => setMeetingToDelete(null)}
      />
    </div>
  );
};

export default GroupMeetingsTab;
