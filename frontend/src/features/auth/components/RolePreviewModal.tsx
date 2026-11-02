/**
 * MetroLMS — Visual Role Preview Selector Modal
 *
 * Authoritative Governance Reference:
 * - Revision 5 Roadmap, Section 4: Developer Preview and Isolated Role Testing (D-10)
 * - Supported Roles:
 *   1. super_admin (المدير العام)
 *   2. admin (مدير النظام)
 *   3. assistant_admin (مساعد مدير نظام)
 *   4. lecturer (محاضر معتمد)
 *   5. assistant_lecturer (مدرس مساعد - تكليف بمجموعة)
 *   6. user (متدرب)
 *
 * Scoped Assistant Lecturer Governance:
 * - Requires selection of a valid group with an existing assistant lecturer assignment.
 * - If no groups contain an assigned assistant lecturer, displays an informative empty state
 *   and prevents activation of that scoped preview.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import {
  useRolePreview,
  type PreviewRole,
  type ScopedAssignmentPreview,
  SUPPORTED_PREVIEW_ROLES,
  PREVIEW_ROLE_LABELS_AR,
} from '@/core/auth/RolePreviewContext';
import { groupsApi } from '@/features/groups/services/groupsApi';
import type { GroupSummaryDTO } from '@/core/groups/dtos';

export interface RolePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RolePreviewModal: React.FC<RolePreviewModalProps> = ({ isOpen, onClose }) => {
  const { previewRole, isPreviewing, scopedAssignmentPreview, startPreview, stopPreview } =
    useRolePreview();

  const [selectedRole, setSelectedRole] = useState<PreviewRole>(previewRole ?? 'admin');
  const [groups, setGroups] = useState<GroupSummaryDTO[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    scopedAssignmentPreview?.groupId ?? ''
  );

  // Sync initial selection with active preview when modal opens
  useEffect(() => {
    if (isOpen) {
      if (previewRole) {
        setSelectedRole(previewRole);
      }
      if (scopedAssignmentPreview) {
        setSelectedGroupId(scopedAssignmentPreview.groupId);
      }
    }
  }, [isOpen, previewRole, scopedAssignmentPreview]);

  // Load groups when assistant_lecturer is selected to inspect existing assignments
  useEffect(() => {
    let isCancelled = false;

    async function loadGroupsForScopedPreview() {
      if (!isOpen || selectedRole !== 'assistant_lecturer') return;
      setIsLoadingGroups(true);
      try {
        const fetched = await groupsApi.getAdminGroups();
        if (!isCancelled) {
          setGroups(fetched);
          // Auto-select first group that has an assistant lecturer if none selected
          const candidateGroups = fetched.filter(
            (g) =>
              (g.assistantLecturerIds && g.assistantLecturerIds.length > 0) ||
              g.instructors?.some((i) => i.instructorRole === 'assistant')
          );
          if (candidateGroups.length > 0 && !selectedGroupId) {
            setSelectedGroupId(candidateGroups[0].id);
          }
        }
      } catch {
        if (!isCancelled) {
          setGroups([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingGroups(false);
        }
      }
    }

    loadGroupsForScopedPreview();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedRole, selectedGroupId]);

  // Filter groups that have an active assistant lecturer assignment
  const eligibleGroupsWithAssistants = groups.filter(
    (g) =>
      (g.assistantLecturerIds && g.assistantLecturerIds.length > 0) ||
      g.instructors?.some((i) => i.instructorRole === 'assistant')
  );

  const isAssistantRole = selectedRole === 'assistant_lecturer';
  const hasNoAssistantGroups = isAssistantRole && !isLoadingGroups && eligibleGroupsWithAssistants.length === 0;

  const canApplyPreview = Boolean(
    selectedRole &&
    (!isAssistantRole || (selectedGroupId && eligibleGroupsWithAssistants.some((g) => g.id === selectedGroupId)))
  );

  const handleApplyPreview = () => {
    if (isAssistantRole) {
      const targetGroup = eligibleGroupsWithAssistants.find((g) => g.id === selectedGroupId);
      if (!targetGroup) return;

      const assistantInstructor = targetGroup.instructors?.find((i) => i.instructorRole === 'assistant');
      const scopedAssignment: ScopedAssignmentPreview = {
        type: 'assistant_lecturer',
        groupId: targetGroup.id,
        groupName: targetGroup.name,
        assistantLecturerId: assistantInstructor?.userId ?? targetGroup.assistantLecturerIds?.[0],
        assistantLecturerName: assistantInstructor?.name,
      };

      const success = startPreview('assistant_lecturer', scopedAssignment);
      if (success) {
        onClose();
      }
      return;
    }

    const success = startPreview(selectedRole);
    if (success) {
      onClose();
    }
  };

  const handleExitPreview = () => {
    stopPreview();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="معاينة واجهات الأدوار (Visual Role Preview)"
      description="استعراض الواجهات والقوائم البصرية بمختلف أدوار المنظومة دون المساس بهوية المطور أو صلاحياته الحقيقية."
      size="lg"
      data-testid="role-preview-modal"
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-2">
          {isPreviewing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon="close"
              onClick={handleExitPreview}
              className="w-full sm:w-auto text-danger-dark border-danger/30 hover:bg-danger-light"
              data-testid="modal-exit-preview-btn"
            >
              إنهاء المعاينة الحالية
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-text-muted hover:text-text"
              data-testid="modal-cancel-preview-btn"
            >
              إلغاء
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="eye"
              disabled={!canApplyPreview}
              onClick={handleApplyPreview}
              data-testid="modal-apply-preview-btn"
            >
              تفعيل المعاينة
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {/* Notice Box */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-text space-y-1">
          <div className="flex items-center gap-2 font-bold text-primary-dark">
            <Icon name="shield" size="sm" />
            <span>ضوابط الحوكمة والأمان (D-10)</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            المعاينة بصرية فقط للواجهات وهيكل القوائم. يظل حسابك البرمجي محتفظاً بهوية المطور كاملة،
            وتظل العمليات التعديلية (Mutations) محجوبة حمايةً لبيانات المنظومة.
          </p>
        </div>

        {/* Roles Selection Grid */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-text-heading">
            اختر الدور المراد معاينة واجهته:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" data-testid="role-preview-options-grid">
            {SUPPORTED_PREVIEW_ROLES.map((role) => {
              const isSelected = selectedRole === role;
              const isCurrentPreview = previewRole === role;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  data-testid={`preview-role-option-${role}`}
                  className={`flex items-center justify-between p-3 rounded-lg border text-start transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                      : 'border-border bg-surface hover:bg-neutral-light/50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-text-heading flex items-center gap-1.5">
                      <span>{PREVIEW_ROLE_LABELS_AR[role]}</span>
                      {isCurrentPreview && (
                        <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                          نشط حالياً
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted font-mono">{role}</span>
                  </div>

                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-primary bg-primary text-white' : 'border-border'
                    }`}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Group Assignment Selector for assistant_lecturer */}
        {isAssistantRole && (
          <div
            className="p-3.5 rounded-lg border border-border bg-neutral-light/40 space-y-3"
            data-testid="assistant-lecturer-scoped-section"
          >
            <div className="flex items-center justify-between">
              <label
                htmlFor="scoped-group-select"
                className="block text-xs font-bold text-text-heading"
              >
                المجموعة التدريبية المرتبطة بتكليف المحاضر المساعد:
              </label>
              <Badge variant="warning" className="text-[10px]">
                تكليف محصور بالمجموعة
              </Badge>
            </div>

            {isLoadingGroups ? (
              <div className="py-3 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                <Icon name="spinner" size="sm" className="animate-spin text-primary" />
                <span>جارٍ فحص المجموعات التدريبية المعتمدة...</span>
              </div>
            ) : hasNoAssistantGroups ? (
              <div
                className="p-3 rounded-md bg-warning/10 border border-warning/30 text-warning-dark text-xs space-y-1"
                data-testid="assistant-lecturer-empty-state"
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Icon name="alertTriangle" size="sm" />
                  <span>لا توجد مجموعات بتكليف نشط</span>
                </div>
                <p className="leading-relaxed">
                  لا توجد مجموعات تدريبية تحتوي على تكليف محاضر مساعد حالياً. لمعاينة هذا الدور،
                  يجب تعيين محاضر مساعد لمجموعة أولاً عبر إدارة المجموعات.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <select
                  id="scoped-group-select"
                  data-testid="scoped-group-select"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border border-border bg-surface text-text focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="" disabled>
                    -- اختر مجموعة تدريبية لمعاينة تكليف المساعد --
                  </option>
                  {eligibleGroupsWithAssistants.map((group) => {
                    const assistantInstructor = group.instructors?.find(
                      (i) => i.instructorRole === 'assistant'
                    );
                    const assistantName =
                      assistantInstructor?.name ||
                      group.assistantLecturerIds?.[0] ||
                      'محاضر مساعد معتمد';

                    return (
                      <option key={group.id} value={group.id}>
                        {group.id}: {group.name} (المساعد: {assistantName})
                      </option>
                    );
                  })}
                </select>
                <span className="text-[11px] text-text-muted">
                  سيتم تطبيق الهيكل البصري الخاص بالمحاضر المساعد داخل سياق هذه المجموعة حصراً.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RolePreviewModal;

