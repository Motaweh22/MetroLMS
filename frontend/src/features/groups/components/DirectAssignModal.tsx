import React, { useState, useEffect, useMemo } from 'react';
import type { TrainingGroup } from '@/core/groups/types';
import type { CandidateTraineeDTO } from '@/core/groups/dtos';
import { groupsApi } from '../services/groupsApi';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';

export interface DirectAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: TrainingGroup;
  currentMemberIds: string[];
  onMembersAdded: () => void;
}

export const DirectAssignModal: React.FC<DirectAssignModalProps> = ({
  isOpen,
  onClose,
  group,
  currentMemberIds,
  onMembersAdded,
}) => {
  const toast = useToast();

  const [candidates, setCandidates] = useState<CandidateTraineeDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Normalize existing member IDs for comparison
  const normalizedCurrentIds = useMemo(() => {
    return new Set(currentMemberIds.map((id) => id.toLowerCase().trim()));
  }, [currentMemberIds]);

  // Load candidate trainees on open
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set());
      setSearchQuery('');
      setSubmitError(null);
      return;
    }

    const fetchCandidates = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await groupsApi.getCandidateTrainees();
        setCandidates(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'تعذر تحميل قائمة المتدربين المرشحين';
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [isOpen]);

  // Filter out trainees who are already members
  const eligibleCandidates = useMemo(() => {
    return candidates.filter(
      (c) => !normalizedCurrentIds.has(c.id.toLowerCase().trim())
    );
  }, [candidates, normalizedCurrentIds]);

  // Apply search query
  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleCandidates;
    return eligibleCandidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.department && c.department.toLowerCase().includes(q)) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q)
    );
  }, [eligibleCandidates, searchQuery]);

  // Capacity calculation
  const maxCapacity = group.maxTrainees;
  const currentCount = currentMemberIds.length;
  const availableSlots = maxCapacity ? Math.max(0, maxCapacity - currentCount) : Infinity;
  const isOverCapacity = maxCapacity !== null && maxCapacity !== undefined && selectedIds.size > availableSlots;

  // Toggle selection for a single candidate
  const handleToggleSelect = (candidateId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
    setSubmitError(null);
  };

  // Toggle select all filtered candidates
  const handleSelectAll = () => {
    if (selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredCandidates.map((c) => c.id));
      setSelectedIds(allIds);
    }
    setSubmitError(null);
  };

  // Submit direct assignment
  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    if (isOverCapacity) {
      setSubmitError(
        `عدد المتدربين المحددين (${selectedIds.size}) يتجاوز المقاعد المتبقية في المجموعة (${availableSlots} مقعد).`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const traineeIds = Array.from(selectedIds);
      const res = await groupsApi.addGroupMembers(group.id, traineeIds);
      toast.success(
        `تمت إضافة ${res.addedCount} متدرب بنجاح إلى المجموعة التدريبية`
      );
      onMembersAdded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إضافة المتدربين';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إضافة متدربين مباشرة إلى المجموعة"
      size="lg"
      dataTestId="direct-assign-modal"
    >
      <div className="space-y-5" dir="rtl">
        {/* Header Summary */}
        <div className="bg-bg rounded-xl p-4 border border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-text-muted">المجموعة المستهدفة:</span>
            <h4 className="text-sm font-bold text-text mt-0.5">{group.name}</h4>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" size="sm">
              الأعضاء الحاليون: {currentCount}
            </Badge>
            {maxCapacity && (
              <Badge variant={availableSlots <= 0 ? 'danger' : 'primary'} size="sm">
                المقاعد المتاحة: {availableSlots}
              </Badge>
            )}
          </div>
        </div>

        {/* Load / Submit Error Alerts */}
        {loadError && (
          <div data-testid="direct-assign-load-error">
            <Alert variant="danger" title="خطأ في تحميل المتدربين">
              {loadError}
            </Alert>
          </div>
        )}

        {submitError && (
          <div data-testid="direct-assign-submit-error">
            <Alert variant="danger" title="تعذر إضافة المتدربين">
              {submitError}
            </Alert>
          </div>
        )}

        {isOverCapacity && (
          <div data-testid="direct-assign-capacity-warning">
            <Alert variant="warning" title="تجاوز السعة القصوى">
              لقد قمت بتحديد {selectedIds.size} متدرب بينما المقاعد المتاحة هي {availableSlots} فقط. يرجى إلغاء تحديد بعض المتدربين لإتمام الإضافة.
            </Alert>
          </div>
        )}

        {/* Search Bar & Select All Control */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث بالاسم، الرقم الوظيفي، أو القسم..."
              className="w-full text-xs pr-8 pl-3 py-2 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              data-testid="trainee-search-input"
            />
            <Icon
              name="search"
              size="sm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={filteredCandidates.length === 0}
              data-testid="select-all-candidates-btn"
            >
              {selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0
                ? 'إلغاء تحديد الكل'
                : 'تحديد الكل'}
            </Button>
            <span className="text-xs font-semibold text-text-muted">
              تم تحديد <span className="text-primary font-bold">{selectedIds.size}</span> متدرب
            </span>
          </div>
        </div>

        {/* Candidate Trainees List */}
        <div className="border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-2">
              <Icon name="clock" size="md" className="animate-spin text-primary" />
              <p className="text-xs text-text-muted">جارٍ تحميل قائمة المتدربين...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-8 text-center space-y-2" data-testid="no-candidates-state">
              <Icon name="user" size="lg" className="mx-auto text-text-muted/40" />
              <p className="text-xs font-medium text-text-muted">
                {searchQuery
                  ? 'لا توجد نتائج تطابق كلمة البحث'
                  : 'كافة المتدربين المرشحين مضافون بالفعل إلى هذه المجموعة'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredCandidates.map((trainee) => {
                const isSelected = selectedIds.has(trainee.id);
                return (
                  <label
                    key={trainee.id}
                    className={`flex items-center justify-between p-3.5 hover:bg-neutral-light/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    data-testid={`candidate-row-${trainee.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(trainee.id)}
                        className="w-4 h-4 text-primary rounded border-border focus:ring-primary/30 cursor-pointer"
                        data-testid={`candidate-checkbox-${trainee.id}`}
                      />
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {trainee.name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text flex items-center gap-2">
                          <span>{trainee.name}</span>
                          <span className="text-[11px] font-mono text-primary font-normal">
                            {trainee.id}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                          <span>{trainee.email}</span>
                          {trainee.jobTitle && (
                            <>
                              <span>•</span>
                              <span>{trainee.jobTitle}</span>
                            </>
                          )}
                          {trainee.department && (
                            <>
                              <span>•</span>
                              <span>{trainee.department}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Badge variant={isSelected ? 'primary' : 'neutral'} size="sm">
                        {isSelected ? 'محدد للإضافة' : 'جاهز'}
                      </Badge>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
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
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={selectedIds.size === 0 || isOverCapacity || isSubmitting}
            data-testid="confirm-direct-assign-btn"
          >
            إضافة المتدربين المحددين ({selectedIds.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
};
