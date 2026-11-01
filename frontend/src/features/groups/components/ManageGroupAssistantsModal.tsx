import React, { useState, useEffect, useMemo } from 'react';
import { groupsApi } from '../services/groupsApi';
import type { TrainingGroup } from '@/core/groups/types';
import type { CandidateLecturerDTO } from '@/core/groups/dtos';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';

export interface ManageGroupAssistantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Pick<
    TrainingGroup,
    'id' | 'name' | 'primaryInstructorId' | 'assistantLecturerIds' | 'supervisorIds' | 'instructors'
  >;
  onAssistantsUpdated: (updatedGroup: TrainingGroup) => void;
}

export const ManageGroupAssistantsModal: React.FC<ManageGroupAssistantsModalProps> = ({
  isOpen,
  onClose,
  group,
  onAssistantsUpdated,
}) => {
  const toast = useToast();
  const [candidateLecturers, setCandidateLecturers] = useState<CandidateLecturerDTO[]>([]);
  const [loadingLecturers, setLoadingLecturers] = useState<boolean>(false);
  const [assistantIds, setAssistantIds] = useState<string[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const effectivePrimaryId = useMemo(() => {
    if (group.primaryInstructorId !== undefined) {
      return group.primaryInstructorId || '';
    }
    const primaryFromResolved = group.instructors?.find((i) => i.instructorRole === 'primary')?.userId;
    if (primaryFromResolved) return primaryFromResolved;
    return group.supervisorIds?.[0] || '';
  }, [group]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSelectedToAdd('');
    setSearchQuery('');

    const initialAssistants =
      group.assistantLecturerIds !== undefined
        ? [...group.assistantLecturerIds]
        : group.instructors
            ?.filter((i) => i.instructorRole === 'assistant')
            .map((i) => i.userId) || [];
    setAssistantIds(initialAssistants);

    let isMounted = true;
    setLoadingLecturers(true);
    groupsApi
      .getCandidateLecturers()
      .then((list) => {
        if (isMounted) {
          setCandidateLecturers(list || []);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة المحاضرين المتاحين');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingLecturers(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, group]);

  const primaryLecturerInfo = useMemo(() => {
    if (!effectivePrimaryId) return null;
    const fromCandidates = candidateLecturers.find(
      (l) => l.id.toLowerCase() === effectivePrimaryId.toLowerCase()
    );
    if (fromCandidates) return fromCandidates;
    const fromResolved = group.instructors?.find(
      (i) => i.userId.toLowerCase() === effectivePrimaryId.toLowerCase()
    );
    if (fromResolved) {
      return {
        id: fromResolved.userId,
        name: fromResolved.name,
        username: fromResolved.userId,
        email: fromResolved.email,
        jobTitle: fromResolved.jobTitle || 'محاضر أساسي',
        department: fromResolved.department || '',
        status: 'active' as const,
      };
    }
    return null;
  }, [effectivePrimaryId, candidateLecturers, group.instructors]);

  const assignedAssistantsInfo = useMemo(
    () =>
      assistantIds.map((aid) => {
        const fromCandidates = candidateLecturers.find(
          (l) => l.id.toLowerCase() === aid.toLowerCase()
        );
        if (fromCandidates) return fromCandidates;
        const fromResolved = group.instructors?.find(
          (i) => i.userId.toLowerCase() === aid.toLowerCase()
        );
        return {
          id: aid,
          name: fromResolved?.name || aid,
          username: aid,
          email: fromResolved?.email || '',
          jobTitle: fromResolved?.jobTitle || 'محاضر مساعد',
          department: fromResolved?.department || '',
          status: 'active' as const,
        };
      }),
    [assistantIds, candidateLecturers, group.instructors]
  );

  const availableCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return candidateLecturers.filter((l) => {
      if (effectivePrimaryId && l.id.toLowerCase() === effectivePrimaryId.toLowerCase()) {
        return false;
      }
      if (assistantIds.some((aid) => aid.toLowerCase() === l.id.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.department.toLowerCase().includes(q) ||
        l.jobTitle.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
      );
    });
  }, [candidateLecturers, effectivePrimaryId, assistantIds, searchQuery]);

  if (!isOpen) return null;

  const handleAddAssistant = () => {
    const trimmed = selectedToAdd.trim();
    if (!trimmed) return;
    if (effectivePrimaryId && trimmed.toLowerCase() === effectivePrimaryId.toLowerCase()) {
      setError('لا يمكن تعيين المحاضر الأساسي كمحاضر مساعد في نفس المجموعة');
      return;
    }
    if (assistantIds.some((id) => id.toLowerCase() === trimmed.toLowerCase())) {
      setError('هذا المحاضر مضاف بالفعل ضمن المحاضرين المساعدين للمجموعة');
      return;
    }
    setError(null);
    setAssistantIds((prev) => [...prev, trimmed]);
    setSelectedToAdd('');
  };

  const handleRemoveAssistant = (idToRemove: string) => {
    setError(null);
    setAssistantIds((prev) =>
      prev.filter((id) => id.toLowerCase() !== idToRemove.toLowerCase())
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await groupsApi.updateGroupAssistants(group.id, assistantIds);
      toast.success('تم تحديث المحاضرين المساعدين للمجموعة بنجاح');
      onAssistantsUpdated(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ قائمة المحاضرين المساعدين');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-group-assistants-title"
      data-testid="manage-group-assistants-modal"
      dir="rtl"
    >
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border bg-neutral-light/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon name="user" size="md" />
            </div>
            <div className="min-w-0">
              <h2
                id="manage-group-assistants-title"
                className="text-base font-bold text-text-heading truncate"
              >
                إدارة المحاضرين المساعدين
              </h2>
              <p className="text-xs text-text-muted truncate mt-0.5">{group.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-neutral-light transition-colors cursor-pointer"
            aria-label="إغلاق"
            data-testid="close-manage-assistants-modal-btn"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <Alert variant="danger" title="تنبيه">
              <p className="text-xs">{error}</p>
            </Alert>
          )}

          {/* Primary Instructor Summary (Read-Only) */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-text-muted">المحاضر الأساسي للمجموعة</span>
            {primaryLecturerInfo ? (
              <div
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5"
                data-testid="modal-primary-instructor-info"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
                    {primaryLecturerInfo.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text-heading truncate">
                        {primaryLecturerInfo.name}
                      </span>
                      <Badge variant="primary" size="sm">
                        المحاضر الأساسي
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {primaryLecturerInfo.jobTitle}
                      {primaryLecturerInfo.department ? ` • ${primaryLecturerInfo.department}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted bg-neutral-light/40 border border-border/60 rounded-xl px-3.5 py-2.5">
                لم يتم تعيين محاضر أساسي لهذه المجموعة.
              </p>
            )}
          </div>

          {/* Add Assistant Lecturer */}
          <div className="space-y-2.5 pt-3 border-t border-border/60">
            <label
              htmlFor="modal-assistant-lecturer-select"
              className="block text-xs font-bold text-text"
            >
              إضافة محاضر مساعد للمجموعة
            </label>
            {candidateLecturers.length > 3 && (
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن محاضر بالاسم أو الإدارة..."
                className="w-full px-3.5 py-2 text-xs bg-bg border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="modal-assistant-search-input"
              />
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <select
                id="modal-assistant-lecturer-select"
                value={selectedToAdd}
                onChange={(e) => setSelectedToAdd(e.target.value)}
                disabled={loadingLecturers}
                className="flex-1 px-3.5 py-2.5 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="modal-assistant-lecturer-select"
              >
                <option value="">
                  {loadingLecturers
                    ? 'جارٍ تحميل قائمة المحاضرين...'
                    : availableCandidates.length > 0
                    ? '— اختر محاضراً مساعداً لإضافته —'
                    : '— لا يوجد محاضرون إضافيون متاحون للاختيار —'}
                </option>
                {availableCandidates.map((lec) => (
                  <option key={lec.id} value={lec.id}>
                    {lec.name} — {lec.jobTitle} ({lec.department})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon="plus"
                disabled={!selectedToAdd || loadingLecturers}
                onClick={handleAddAssistant}
                data-testid="modal-add-assistant-btn"
                className="font-bold text-xs shrink-0"
              >
                إضافة
              </Button>
            </div>
          </div>

          {/* Assigned Assistant Lecturers List */}
          <div className="space-y-2.5 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text">
                المحاضرون المساعدون الحاليون ({assignedAssistantsInfo.length})
              </span>
            </div>

            {assignedAssistantsInfo.length > 0 ? (
              <div className="space-y-2" data-testid="modal-assigned-assistants-list">
                {assignedAssistantsInfo.map((assistant) => (
                  <div
                    key={assistant.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-bg"
                    data-testid={`modal-assigned-assistant-${assistant.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-info/15 text-info flex items-center justify-center shrink-0 font-bold text-xs">
                        {assistant.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-text-heading truncate">
                            {assistant.name}
                          </span>
                          <Badge variant="info" size="sm">
                            المحاضر المساعد
                          </Badge>
                        </div>
                        <p className="text-xs text-text-muted truncate mt-0.5">
                          {assistant.jobTitle}
                          {assistant.department ? ` • ${assistant.department}` : ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAssistant(assistant.id)}
                      data-testid={`modal-remove-assistant-${assistant.id}`}
                      className="text-xs text-danger hover:text-danger shrink-0"
                    >
                      إزالة
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className="text-xs text-text-muted bg-neutral-light/40 border border-border/60 rounded-xl px-3.5 py-3 text-center"
                data-testid="modal-no-assistants-empty"
              >
                لا يوجد محاضرون مساعدون مسندون لهذه المجموعة حالياً.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-neutral-light/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            data-testid="cancel-manage-assistants-btn"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            disabled={isSaving}
            onClick={handleSave}
            data-testid="save-group-assistants-btn"
          >
            حفظ المحاضرين المساعدين
          </Button>
        </div>
      </div>
    </div>
  );
};

