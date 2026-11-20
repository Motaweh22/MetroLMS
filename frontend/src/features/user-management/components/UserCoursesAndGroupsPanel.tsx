import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserOverviewData } from '@/features/profile/services/profileApi';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';

export interface UserCoursesAndGroupsPanelProps {
  overview: UserOverviewData;
  memberName?: string;
}

type ModalTab = 'enrolled' | 'assigned' | 'groups';

const SOURCE_LABELS: Record<string, string> = {
  direct: 'إضافة مباشرة',
  group: 'مجموعة تدريبية',
  qr_code: 'رمز QR',
  'self:continued': 'استمرار ذاتي',
};

const COURSE_ROLE_LABELS: Record<string, string> = {
  created: 'منشئ المقرر',
  primary_lecturer: 'محاضر رئيسي',
  assistant_lecturer: 'محاضر مساعد',
};

const LIFECYCLE_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  Published: { label: 'منشور', variant: 'success' },
  InReview: { label: 'قيد المراجعة', variant: 'warning' },
  Draft: { label: 'مسودة', variant: 'neutral' },
  Archived: { label: 'مؤرشف', variant: 'neutral' },
};

const PAGE_SIZE = 10;

export const UserCoursesAndGroupsPanel: React.FC<UserCoursesAndGroupsPanelProps> = ({
  overview,
  memberName,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('enrolled');
  const [searchQuery, setSearchQuery] = useState('');
  const [enrolledFilter, setEnrolledFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [page, setPage] = useState(1);

  const completedCount = useMemo(
    () => overview.enrolledCourses.filter((c) => c.isCompleted).length,
    [overview.enrolledCourses]
  );
  const totalSupervisions = useMemo(
    () => overview.supervisedGroups.reduce((acc, g) => acc + (g.supervisionCount || 0), 0),
    [overview.supervisedGroups]
  );

  const openModal = (tab: ModalTab) => {
    setModalTab(tab);
    setSearchQuery('');
    setEnrolledFilter('all');
    setPage(1);
    setIsModalOpen(true);
  };

  const handleTabChange = (tab: ModalTab) => {
    setModalTab(tab);
    setSearchQuery('');
    setPage(1);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEnrolled = useMemo(() => {
    return overview.enrolledCourses.filter((c) => {
      if (enrolledFilter === 'completed' && !c.isCompleted) return false;
      if (enrolledFilter === 'in_progress' && c.isCompleted) return false;
      if (normalizedQuery && !c.title.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [overview.enrolledCourses, enrolledFilter, normalizedQuery]);

  const filteredAssigned = useMemo(() => {
    return overview.assignedOrCreatedCourses.filter((c) => {
      if (normalizedQuery && !c.title.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [overview.assignedOrCreatedCourses, normalizedQuery]);

  const filteredSupervisedGroups = useMemo(() => {
    return overview.supervisedGroups.filter((g) => {
      if (normalizedQuery && !g.name.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [overview.supervisedGroups, normalizedQuery]);

  const filteredMemberGroups = useMemo(() => {
    return overview.memberGroups.filter((g) => {
      if (normalizedQuery && !g.name.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [overview.memberGroups, normalizedQuery]);

  const activeListLength =
    modalTab === 'enrolled'
      ? filteredEnrolled.length
      : modalTab === 'assigned'
      ? filteredAssigned.length
      : filteredSupervisedGroups.length + filteredMemberGroups.length;

  const totalPages = Math.max(1, Math.ceil(activeListLength / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;

  return (
    <div className="space-y-3" data-testid="user-courses-groups-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-text-heading flex items-center gap-2">
          <Icon name="courses" size="sm" className="text-primary" />
          <span>سجل المقررات والمجموعات التدريبية</span>
        </h3>
      </div>

      {/* 3 Compact Summary Cards (Zero Clutter) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Enrolled Courses */}
        <Card variant="default" className="p-4 bg-surface flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-text-muted">الكورسات المسجل فيها</span>
              <Badge variant="primary" size="sm">
                {overview.enrolledCourses.length}
              </Badge>
            </div>
            <p className="text-xs text-text-muted">
              مكتمل: <strong className="text-success">{completedCount}</strong> • قيد الدراسة:{' '}
              <strong className="text-text-heading">
                {overview.enrolledCourses.length - completedCount}
              </strong>
            </p>
            {overview.enrolledCourses.slice(0, 2).map((c) => (
              <div key={c.id} className="text-xs font-medium text-text-heading truncate">
                • {c.title}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openModal('enrolled')}
            data-testid="open-enrolled-courses-modal-btn"
            className="w-full text-xs font-bold"
          >
            عرض القائمة كاملة والبحث
          </Button>
        </Card>

        {/* Card 2: Assigned / Created Courses */}
        <Card variant="default" className="p-4 bg-surface flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-text-muted">الكورسات المسندة والمنشأة</span>
              <Badge variant="warning" size="sm">
                {overview.assignedOrCreatedCourses.length}
              </Badge>
            </div>
            <p className="text-xs text-text-muted">
              مسندة للتدريس أو منشأة بواسطة العضو
            </p>
            {overview.assignedOrCreatedCourses.slice(0, 2).map((c) => (
              <div key={c.id} className="text-xs font-medium text-text-heading truncate">
                • {c.title}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openModal('assigned')}
            data-testid="open-assigned-courses-modal-btn"
            className="w-full text-xs font-bold"
          >
            عرض القائمة كاملة والبحث
          </Button>
        </Card>

        {/* Card 3: Supervised Groups & Supervision Count */}
        <Card variant="default" className="p-4 bg-surface flex flex-col justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-text-muted">المجموعات والإشراف</span>
              <Badge variant="success" size="sm">
                {overview.supervisedGroups.length} إشراف
              </Badge>
            </div>
            <p className="text-xs text-text-muted">
              إجمالي مرات الإشراف (الدورات):{' '}
              <strong className="text-primary">{totalSupervisions}</strong> • عضو في:{' '}
              <strong className="text-text-heading">{overview.memberGroups.length}</strong>
            </p>
            {overview.supervisedGroups.slice(0, 2).map((g) => (
              <div key={g.id} className="text-xs font-medium text-text-heading truncate">
                • {g.name} ({g.supervisionCount} مرة)
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openModal('groups')}
            data-testid="open-groups-modal-btn"
            className="w-full text-xs font-bold"
          >
            عرض المجموعات والتفاصيل
          </Button>
        </Card>
      </div>

      {/* Searchable & Paginated Popup Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          data-testid="user-overview-modal"
        >
          <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-text-heading">
                  {memberName ? `سجل ${memberName}` : 'سجل المقررات والمجموعات'}
                </h3>
                <p className="text-xs text-text-muted">
                  استعراض وبحث سريع في المقررات المسجلة والمسندة والمجموعات التدريبية
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-neutral-light text-sm font-bold"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-5 pt-2 border-b border-border flex items-center gap-2 overflow-x-auto bg-surface/50">
              <button
                type="button"
                onClick={() => handleTabChange('enrolled')}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap ${
                  modalTab === 'enrolled'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                المسجل فيها ({overview.enrolledCourses.length})
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('assigned')}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap ${
                  modalTab === 'assigned'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                المسندة والمنشأة ({overview.assignedOrCreatedCourses.length})
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('groups')}
                className={`px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap ${
                  modalTab === 'groups'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                المجموعات والإشراف ({overview.supervisedGroups.length + overview.memberGroups.length})
              </button>
            </div>

            {/* Search & Filters */}
            <div className="px-5 py-3 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="ابحث باسم المقرر أو المجموعة..."
                className="w-full sm:max-w-xs rounded-xl border border-border px-3 py-1.5 text-xs"
                data-testid="overview-modal-search"
              />
              {modalTab === 'enrolled' && (
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'الكل' },
                      { id: 'in_progress', label: 'قيد الدراسة' },
                      { id: 'completed', label: 'مكتمل' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setEnrolledFilter(f.id);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        enrolledFilter === f.id
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface text-text-muted border-border'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {modalTab === 'enrolled' && (
                <>
                  {filteredEnrolled.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">
                      لا توجد مقررات مطابقة.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/70 border border-border rounded-xl">
                      {filteredEnrolled.slice(startIdx, startIdx + PAGE_SIZE).map((c) => (
                        <div
                          key={c.id}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1">
                            <Link
                              to={`/courses/${encodeURIComponent(c.id)}`}
                              className="font-bold text-text-heading hover:text-primary"
                            >
                              {c.title}
                            </Link>
                            <div className="flex flex-wrap gap-1">
                              {c.sources.map((src) => (
                                <Badge key={src} variant="neutral" size="sm">
                                  {SOURCE_LABELS[src] || src}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={c.isCompleted ? 'success' : 'primary'} size="sm">
                              {c.isCompleted ? 'مكتمل 100%' : `${c.progressPercentage}%`}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {modalTab === 'assigned' && (
                <>
                  {filteredAssigned.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">
                      لا توجد مقررات مسندة أو منشأة مطابقة.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/70 border border-border rounded-xl">
                      {filteredAssigned.slice(startIdx, startIdx + PAGE_SIZE).map((c) => {
                        const statusMeta = LIFECYCLE_LABELS[c.lifecycleStatus] || {
                          label: c.lifecycleStatus,
                          variant: 'neutral' as const,
                        };
                        return (
                          <div
                            key={c.id}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-1">
                              <Link
                                to={`/courses/${encodeURIComponent(c.id)}`}
                                className="font-bold text-text-heading hover:text-primary"
                              >
                                {c.title}
                              </Link>
                              <div className="flex flex-wrap gap-1">
                                {c.roles.map((r) => (
                                  <Badge key={r} variant="primary" size="sm">
                                    {COURSE_ROLE_LABELS[r] || r}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Badge variant={statusMeta.variant} size="sm">
                              {statusMeta.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {modalTab === 'groups' && (
                <div className="space-y-4">
                  {/* Supervised Groups */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-text-heading">
                      مجموعات يشرف عليها ({filteredSupervisedGroups.length})
                    </h4>
                    {filteredSupervisedGroups.length === 0 ? (
                      <p className="text-xs text-text-muted p-3 border border-dashed border-border rounded-xl">
                        لا يشرف على أي مجموعات حالياً.
                      </p>
                    ) : (
                      <div className="divide-y divide-border/70 border border-border rounded-xl">
                        {filteredSupervisedGroups.map((g) => (
                          <div key={g.id} className="p-3 space-y-1.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-text-heading">{g.name}</span>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="primary" size="sm">
                                  أشرف عليها {g.supervisionCount} مرة
                                </Badge>
                                {g.isArchived && (
                                  <Badge variant="neutral" size="sm">
                                    مؤرشفة
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {g.cycles.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {g.cycles.map((cyc) => (
                                  <Badge key={cyc.cycleCode} variant="neutral" size="sm">
                                    دورة {cyc.cycleNumber} ({cyc.cycleStatus})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Member Groups */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-text-heading">
                      مجموعات عضو بها ({filteredMemberGroups.length})
                    </h4>
                    {filteredMemberGroups.length === 0 ? (
                      <p className="text-xs text-text-muted p-3 border border-dashed border-border rounded-xl">
                        ليس عضواً في أي مجموعة تدريبية.
                      </p>
                    ) : (
                      <div className="divide-y divide-border/70 border border-border rounded-xl">
                        {filteredMemberGroups.map((g) => (
                          <div
                            key={g.id}
                            className="p-3 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-bold text-text-heading">{g.name}</span>
                            <Badge variant={g.isArchived ? 'neutral' : 'success'} size="sm">
                              {g.isArchived ? 'مؤرشفة' : 'نشطة'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            <div className="px-5 py-3 border-t border-border bg-surface/50 flex items-center justify-between text-xs">
              {modalTab !== 'groups' && totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    السابق
                  </Button>
                  <span className="text-text-muted">
                    صفحة {safePage} من {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    التالي
                  </Button>
                </div>
              ) : (
                <span />
              )}
              <Button type="button" variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCoursesAndGroupsPanel;
