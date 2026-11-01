import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { TrainingGroup, GroupMember, GroupJoinRequest, GroupEnrollmentPolicy } from '@/core/groups/types';
import { groupsApi } from '../services/groupsApi';
import { GroupQRModal } from './GroupQRModal';
import { DirectAssignModal } from './DirectAssignModal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Modal } from '@/shared/ui/Modal';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { formatArabicDateTime } from '../utils/dateUtils';

export interface GroupMembersTabProps {
  group: TrainingGroup;
  onGroupUpdated: (group: TrainingGroup) => void;
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

export const GroupMembersTab: React.FC<GroupMembersTabProps> = ({
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
  const toast = useToast();

  // Active sub-tab: 'members' | 'requests'
  const [activeSubtab, setActiveSubtab] = useState<'members' | 'requests'>('members');

  // Members state
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  // Join Requests state
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Modals state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isDirectAssignOpen, setIsDirectAssignOpen] = useState(false);

  // Member safe removal state
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Review Reject note modal state
  const [rejectingRequest, setRejectingRequest] = useState<GroupJoinRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // ── Load Members ────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await groupsApi.getGroupMembers(group.id);
      setMembers(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل قائمة المتدربين';
      setMembersError(msg);
    } finally {
      setMembersLoading(false);
    }
  }, [group.id]);

  // ── Load Join Requests ──────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const data = await groupsApi.getJoinRequests(group.id);
      setRequests(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل طلبات الانضمام';
      setRequestsError(msg);
    } finally {
      setRequestsLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    fetchMembers();
    fetchRequests();
  }, [fetchMembers, fetchRequests]);

  // Derived counts
  const pendingRequestsCount = useMemo(() => {
    return requests.filter((r) => r.status === 'pending').length;
  }, [requests]);

  const currentMemberIds = useMemo(() => {
    return members.map((m) => m.userId);
  }, [members]);

  // Filtered members by search keyword
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.department && m.department.toLowerCase().includes(q)) ||
        (m.jobTitle && m.jobTitle.toLowerCase().includes(q)) ||
        m.userId.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  // Filtered requests by status
  const filteredRequests = useMemo(() => {
    if (requestFilter === 'all') return requests;
    return requests.filter((r) => r.status === requestFilter);
  }, [requests, requestFilter]);

  // ── Member Removal Handler ──────────────────────────────────────────────
  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;

    setIsRemovingMember(true);
    try {
      await groupsApi.removeGroupMember(group.id, memberToRemove.userId);
      toast.success(`تمت إزالة المتدرب (${memberToRemove.name}) من المجموعة بنجاح`);

      // Update local state and parent group
      setMembers((prev) => prev.filter((m) => m.userId !== memberToRemove.userId));
      onGroupUpdated({
        ...group,
        traineeIds: (group.traineeIds || []).filter(
          (id) => id.toLowerCase() !== memberToRemove.userId.toLowerCase()
        ),
      });
      setMemberToRemove(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إزالة المتدرب من المجموعة';
      toast.error(msg);
    } finally {
      setIsRemovingMember(false);
    }
  };

  // ── Join Request Review Handlers ────────────────────────────────────────
  const handleApproveRequest = async (request: GroupJoinRequest) => {
    setIsReviewing(true);
    try {
      const res = await groupsApi.reviewJoinRequest(group.id, request.id, 'approved');
      toast.success(
        `تم قبول طلب (${request.userName}) بنجاح وتم تسجيله في مقررات المجموعة`
      );

      // Re-fetch members and requests to reflect server state
      await fetchMembers();
      await fetchRequests();

      onGroupUpdated(res.group);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر اعتماد طلب الانضمام';
      toast.error(msg);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleOpenRejectModal = (request: GroupJoinRequest) => {
    setRejectingRequest(request);
    setRejectNote('');
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest) return;

    setIsReviewing(true);
    try {
      await groupsApi.reviewJoinRequest(
        group.id,
        rejectingRequest.id,
        'rejected',
        rejectNote.trim() || undefined
      );
      toast.info(`تم رفض طلب الانضمام المقدم من (${rejectingRequest.userName})`);
      setRejectingRequest(null);
      await fetchRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر رفض طلب الانضمام';
      toast.error(msg);
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="group-members-tab" dir="rtl">
      {/* ── Top Summary & Management Strip ───────────────────────────── */}
      <div className="bg-surface rounded-2xl p-5 border border-border shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-text">إدارة متدربي المجموعة ورمز الانضمام</h3>
              <Badge
                variant={
                  (group.enrollmentPolicy || enrollmentPolicy) === 'open'
                    ? 'success'
                    : (group.enrollmentPolicy || enrollmentPolicy) === 'approval_required'
                    ? 'warning'
                    : 'neutral'
                }
                size="sm"
              >
                {(group.enrollmentPolicy || enrollmentPolicy) === 'open'
                  ? 'انضمام تلقائي'
                  : (group.enrollmentPolicy || enrollmentPolicy) === 'approval_required'
                  ? 'موافقة مطلوبة'
                  : 'الانضمام مغلق'}
              </Badge>
            </div>
            <p className="text-xs text-text-muted mt-1">
              إدارة المتدربين المسجلين بالمجموعة، استعراض واعتماد طلبات الانضمام، وإدارة رمز QR ورابط التسجيل الذاتي.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Open QR Modal Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center gap-1.5"
              data-testid="open-qr-modal-btn"
            >
              <Icon name="qrCode" size="sm" className="text-primary" />
              <span>إدارة رمز QR والروابط</span>
            </Button>

            {/* Direct Member Addition Button */}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsDirectAssignOpen(true)}
              className="flex items-center gap-1.5"
              data-testid="open-direct-assign-btn"
            >
              <Icon name="plus" size="sm" />
              <span>إضافة متدربين مباشرة</span>
            </Button>
          </div>
        </div>

        {/* Capacity & Stats Quick Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60 text-xs">
          <div className="bg-bg rounded-xl p-3 border border-border/80 flex items-center justify-between">
            <span className="text-text-muted font-medium">إجمالي المتدربين:</span>
            <span className="font-bold text-text text-sm">
              {members.length}{' '}
              {group.maxTrainees ? (
                <span className="text-xs font-normal text-text-muted">/ {group.maxTrainees}</span>
              ) : null}
            </span>
          </div>

          <div className="bg-bg rounded-xl p-3 border border-border/80 flex items-center justify-between">
            <span className="text-text-muted font-medium">طلبات الانضمام المعلقة:</span>
            <span className="font-bold text-warning-dark text-sm">
              {pendingRequestsCount} طلب
            </span>
          </div>

          <div className="bg-bg rounded-xl p-3 border border-border/80 flex items-center justify-between">
            <span className="text-text-muted font-medium">حالة الانضمام بالرمز:</span>
            <span
              className={`font-bold ${
                group.isEnrollmentOpen !== false ? 'text-success' : 'text-danger'
              }`}
            >
              {group.isEnrollmentOpen !== false ? 'مفعل ومتاح' : 'معطل مؤقتاً'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Sub-navigation Pills ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveSubtab('members')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeSubtab === 'members'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface text-text-muted hover:text-text border border-border'
          }`}
          data-testid="members-subtab"
        >
          <Icon name="user" size="sm" />
          <span>قائمة المتدربين ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubtab('requests')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer relative ${
            activeSubtab === 'requests'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface text-text-muted hover:text-text border border-border'
          }`}
          data-testid="join-requests-subtab"
        >
          <Icon name="clock" size="sm" />
          <span>طلبات الانضمام ({requests.length})</span>
          {pendingRequestsCount > 0 && (
            <span className="bg-warning text-text-heading px-1.5 py-0.2 rounded-full text-[10px] font-bold">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Sub-tab 1: Group Members View ─────────────────────────────── */}
      {activeSubtab === 'members' && (
        <div className="space-y-4" data-testid="members-view">
          {/* Members Search & Filter Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="البحث بالاسم، البريد، أو الوظيفة..."
                className="w-full text-xs pr-8 pl-3 py-2 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="members-search-input"
              />
              <Icon
                name="search"
                size="sm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchMembers}
              disabled={membersLoading}
              className="flex items-center gap-1.5 shrink-0"
              data-testid="refresh-members-btn"
            >
              <Icon name="refresh" size="sm" className={membersLoading ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </Button>
          </div>

          {/* Members Load Error Alert */}
          {membersError && (
            <div data-testid="members-load-error">
              <Alert variant="danger" title="خطأ في تحميل المتدربين">
                {membersError}
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={fetchMembers}>
                    إعادة المحاولة
                  </Button>
                </div>
              </Alert>
            </div>
          )}

          {/* Members Table */}
          {membersLoading ? (
            <div className="bg-surface rounded-2xl p-12 border border-border flex flex-col items-center justify-center space-y-3">
              <Icon name="clock" size="lg" className="animate-spin text-primary" />
              <p className="text-xs text-text-muted">جارٍ تحميل بيانات المتدربين...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div
              className="bg-surface rounded-2xl p-12 border border-border text-center space-y-3"
              data-testid="no-members-state"
            >
              <Icon name="user" size="lg" className="mx-auto text-text-muted/40" />
              <h4 className="text-sm font-bold text-text">
                {memberSearch ? 'لا توجد نتائج مطابقة لبحثك' : 'لا يوجد متدربون مسجلون في هذه المجموعة بعد'}
              </h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                {memberSearch
                  ? 'جرب البحث باسم أو بريد إلكتروني آخر.'
                  : 'يمكنك إضافة متدربين مباشرة أو مشاركة رمز الاستجابة السريعة للانضمام الذاتي.'}
              </p>
              {!memberSearch && (
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setIsDirectAssignOpen(true)}
                  >
                    إضافة متدربين الآن
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsQRModalOpen(true)}
                  >
                    عرض رمز QR
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs" data-testid="group-members-table">
                  <thead className="bg-bg border-b border-border text-text-muted font-bold">
                    <tr>
                      <th className="px-4 py-3">المتدرب</th>
                      <th className="px-4 py-3">الوظيفة والقسم</th>
                      <th className="px-4 py-3">تاريخ الانضمام</th>
                      <th className="px-4 py-3">طريقة الانضمام</th>
                      <th className="px-4 py-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredMembers.map((member) => (
                      <tr
                        key={member.userId}
                        className="hover:bg-neutral-light/40 transition-colors"
                        data-testid={`member-row-${member.userId.toLowerCase()}`}
                      >
                        {/* Member Identity */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {member.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-bold text-text flex items-center gap-1.5">
                                <span>{member.name}</span>
                              </div>
                              <div className="text-[11px] text-text-muted font-mono mt-0.5">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Job & Department */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-text">
                            {member.jobTitle || 'فني تشغيل ميداني'}
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            {member.department || 'قطاع التشغيل والصيانة'}
                          </div>
                        </td>

                        {/* Join Date */}
                        <td className="px-4 py-3 text-text-muted">
                          {formatArabicDateTime(member.joinedAt)}
                        </td>

                        {/* Join Source */}
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              member.joinSource === 'qr_code'
                                ? 'primary'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {member.joinSource === 'qr_code'
                              ? 'رمز QR ذاتي'
                              : member.joinSource === 'admin_assigned'
                              ? 'إضافة إدارية'
                              : 'إضافة من المشرف'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setMemberToRemove(member)}
                            className="text-danger hover:bg-danger/10 border-danger/30 text-[11px] px-2.5 py-1"
                            data-testid={`remove-member-btn-${member.userId.toLowerCase()}`}
                          >
                            <Icon name="trash" size="sm" />
                            <span>إزالة</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sub-tab 2: Join Requests View ─────────────────────────────── */}
      {activeSubtab === 'requests' && (
        <div className="space-y-4" data-testid="join-requests-view">
          {/* Requests Status Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-border">
              {(
                [
                  { key: 'all', label: `الكل (${requests.length})` },
                  { key: 'pending', label: `بانتظار المراجعة (${pendingRequestsCount})` },
                  {
                    key: 'approved',
                    label: `المقبولة (${requests.filter((r) => r.status === 'approved').length})`,
                  },
                  {
                    key: 'rejected',
                    label: `المرفوضة (${requests.filter((r) => r.status === 'rejected').length})`,
                  },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRequestFilter(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    requestFilter === key
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-muted hover:text-text'
                  }`}
                  data-testid={`request-filter-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchRequests}
              disabled={requestsLoading}
              className="flex items-center gap-1.5 shrink-0"
              data-testid="refresh-requests-btn"
            >
              <Icon name="refresh" size="sm" className={requestsLoading ? 'animate-spin' : ''} />
              <span>تحديث الطلبات</span>
            </Button>
          </div>

          {/* Requests Error Banner */}
          {requestsError && (
            <div data-testid="requests-load-error">
              <Alert variant="danger" title="خطأ في تحميل طلبات الانضمام">
                {requestsError}
              </Alert>
            </div>
          )}

          {/* Requests List */}
          {requestsLoading ? (
            <div className="bg-surface rounded-2xl p-12 border border-border flex flex-col items-center justify-center space-y-3">
              <Icon name="clock" size="lg" className="animate-spin text-primary" />
              <p className="text-xs text-text-muted">جارٍ تحميل طلبات الانضمام...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div
              className="bg-surface rounded-2xl p-12 border border-border text-center space-y-3"
              data-testid="no-requests-state"
            >
              <Icon name="checkCircle" size="lg" className="mx-auto text-success/60" />
              <h4 className="text-sm font-bold text-text">
                {requestFilter === 'pending'
                  ? 'لا توجد طلبات انضمام معلقة حالياً'
                  : 'لا توجد طلبات انضمام مطابقة للفلتر المحدد'}
              </h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                عند قيام المتدربين بمسح رمز الاستجابة السريعة لمجموعة تتطلب الموافقة، ستظهر طلباتهم هنا للمراجعة والاعتماد.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-surface rounded-xl p-4 border border-border shadow-xs hover:border-primary/40 transition-colors space-y-3"
                  data-testid={`request-card-${req.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {req.userName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-text">{req.userName}</h4>
                          <span className="text-[11px] font-mono text-primary font-normal">
                            {req.userId}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                          <span>{req.userEmail}</span>
                          {req.jobTitle && (
                            <>
                              <span>•</span>
                              <span>{req.jobTitle}</span>
                            </>
                          )}
                          {req.department && (
                            <>
                              <span>•</span>
                              <span>{req.department}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <Badge
                        variant={
                          req.status === 'pending'
                            ? 'warning'
                            : req.status === 'approved'
                            ? 'success'
                            : 'neutral'
                        }
                        size="sm"
                        data-testid={`request-status-badge-${req.id}`}
                      >
                        {req.status === 'pending'
                          ? 'بانتظار المراجعة'
                          : req.status === 'approved'
                          ? 'تم القبول'
                          : 'مرفوض'}
                      </Badge>
                      <span className="text-[11px] text-text-muted">
                        {formatArabicDateTime(req.requestedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Applicant Note if available */}
                  {req.reviewNote || (req as unknown as { note?: string }).note ? (
                    <div className="bg-bg rounded-lg p-2.5 border border-border/60 text-xs text-text-muted flex items-start gap-2">
                      <Icon name="info" size="sm" className="text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-text">ملاحظة مقدم الطلب: </span>
                        <span>{(req as unknown as { note?: string }).note || req.reviewNote}</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Review Audit Details if already processed */}
                  {req.status !== 'pending' && req.reviewedAt && (
                    <div className="text-[11px] text-text-muted bg-neutral-light/50 px-3 py-1.5 rounded-lg border border-border/40 flex items-center justify-between">
                      <span>
                        تمت المراجعة بواسطة: <strong className="text-text">{req.reviewedByName || 'مشرف النظام'}</strong>
                      </span>
                      <span>تاريخ المراجعة: {formatArabicDateTime(req.reviewedAt)}</span>
                    </div>
                  )}

                  {/* Action Buttons for Pending Requests */}
                  {req.status === 'pending' && (
                    <div className="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRejectModal(req)}
                        disabled={isReviewing}
                        className="text-danger hover:bg-danger/10 border-danger/30 text-xs"
                        data-testid={`reject-request-btn-${req.id}`}
                      >
                        <Icon name="xCircle" size="sm" />
                        <span>رفض الطلب</span>
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleApproveRequest(req)}
                        disabled={isReviewing}
                        className="text-xs"
                        data-testid={`approve-request-btn-${req.id}`}
                      >
                        <Icon name="checkCircle" size="sm" />
                        <span>قبول الطلب والتسجيل بالمقررات</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── QR Enrollment Modal ───────────────────────────────────────── */}
      {isQRModalOpen && (
        <GroupQRModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          group={group}
          onGroupUpdated={(updated) => {
            onGroupUpdated(updated);
          }}
          enrollmentPolicy={enrollmentPolicy}
          onEnrollmentPolicyChange={onEnrollmentPolicyChange}
          maxTrainees={maxTrainees}
          onMaxTraineesChange={onMaxTraineesChange}
          enrollmentExpiresAt={enrollmentExpiresAt}
          onEnrollmentExpiresAtChange={onEnrollmentExpiresAtChange}
          isEnrollmentOpen={isEnrollmentOpen}
          onIsEnrollmentOpenChange={onIsEnrollmentOpenChange}
          policyErrors={policyErrors}
        />
      )}

      {/* ── Direct Trainee Assignment Modal ──────────────────────────── */}
      {isDirectAssignOpen && (
        <DirectAssignModal
          isOpen={isDirectAssignOpen}
          onClose={() => setIsDirectAssignOpen(false)}
          group={group}
          currentMemberIds={currentMemberIds}
          onMembersAdded={async () => {
            await fetchMembers();
            try {
              const freshGroup = await groupsApi.getAdminGroupById(group.id);
              onGroupUpdated(freshGroup);
            } catch {
              const updatedMembers = await groupsApi.getGroupMembers(group.id).catch(() => members);
              onGroupUpdated({
                ...group,
                traineeIds: updatedMembers.map((m) => m.userId),
              });
            }
          }}
        />
      )}

      {/* ── Safe Member Removal Confirmation Dialog ───────────────────── */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title="تأكيد إزالة المتدرب من المجموعة"
        message={
          <div className="space-y-2 text-sm text-text" dir="rtl">
            <p>
              هل أنت متأكد من رغبتك في إزالة المتدرب{' '}
              <strong className="text-text-heading">{memberToRemove?.name}</strong> من هذه المجموعة التدريبية؟
            </p>
            <p className="text-xs text-text-muted bg-surface p-2.5 rounded-lg border border-border">
              ملاحظة أمان البيانات: لن يؤدي حذف العضوية إلى مسح تسجيلات المتدرب السابقة أو تقدمه التعليمي في المقررات، وستظل سجلات محاولاته وإنجازاته محفوظة بالكامل في سجل المحاولات التاريخي.
            </p>
          </div>
        }
        confirmLabel="نعم، قم بإزالة العضو"
        cancelLabel="إلغاء التراجع"
        variant="danger"
        isConfirming={isRemovingMember}
        onConfirm={handleConfirmRemoveMember}
        onCancel={() => setMemberToRemove(null)}
        testId="remove-member-confirm-dialog"
        confirmTestId="confirm-remove-member-btn"
        cancelTestId="cancel-remove-member-btn"
      />

      {/* ── Join Request Rejection Modal with Note ─────────────────────── */}
      <Modal
        isOpen={Boolean(rejectingRequest)}
        onClose={() => setRejectingRequest(null)}
        title="رفض طلب الانضمام"
        size="md"
        dataTestId="reject-request-modal"
      >
        <div className="space-y-4" dir="rtl">
          <p className="text-xs text-text-muted">
            هل أنت متأكد من رفض طلب الانضمام المقدم من{' '}
            <strong className="text-text">{rejectingRequest?.userName}</strong>؟ يمكنك إرفاق سبب أو ملاحظة توضيحية.
          </p>

          <div>
            <label className="block text-xs font-bold text-text mb-1">
              سبب الرفض أو ملاحظة المشرف (اختياري):
            </label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="مثال: المجموعة مخصصة لقطاع الصيانة فقط، أو اكتمل العدد في هذا المسار..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl bg-surface border border-border text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              data-testid="reject-note-input"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectingRequest(null)}
              disabled={isReviewing}
            >
              إلغاء
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmReject}
              isLoading={isReviewing}
              className="bg-danger hover:bg-danger-dark border-danger text-white"
              data-testid="confirm-reject-request-btn"
            >
              تأكيد رفض الطلب
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
