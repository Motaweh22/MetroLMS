import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import type { ManagedUserDTO } from '@/core/user-management/types';
import type {
  RolePermissionsConfig,
  ApprovalRequest,
} from '@/core/permissions/types';
import { PERMISSION_DEFINITIONS } from '@/core/permissions/types';
import { permissionsApi } from '@/features/permissions/services/permissionsApi';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { RolePermissionsMatrix } from '@/features/permissions/components/RolePermissionsMatrix';
import { GovernanceDelegationPanel } from '@/features/permissions/components/GovernanceDelegationPanel';
import { ApprovalRequestsTable } from '@/features/permissions/components/ApprovalRequestsTable';

type ActiveTab = 'matrix' | 'governance';

export const PermissionsMatrixPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>('matrix');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [configs, setConfigs] = useState<RolePermissionsConfig[]>([]);
  const [users, setUsers] = useState<ManagedUserDTO[]>([]);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [delegations, setDelegations] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [roleConfigs, userList, approvalList] = await Promise.all([
        permissionsApi.getRolePermissions(),
        userManagementApi.getManagedUsers(),
        permissionsApi.getApprovalRequests(),
      ]);

      setConfigs(roleConfigs);
      setUsers(userList);
      setRequests(approvalList);

      // Fetch delegations for assistants
      const assistants = userList.filter((u) => u.role === 'assistant_admin');
      const delMap: Record<string, boolean> = {};
      await Promise.all(
        assistants.map(async (ast) => {
          try {
            const res = await permissionsApi.getDelegatedAuthority(ast.id);
            delMap[ast.id.toLowerCase()] = res.enabled;
          } catch {
            delMap[ast.id.toLowerCase()] = false;
          }
        })
      );
      setDelegations(delMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحميل بيانات الصلاحيات والحوكمة';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Authorization check
  const isAuthorized = user && (user.role === 'admin' || user.role === 'assistant_admin');
  if (!user || !isAuthorized) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-right" data-testid="unauthorized-permissions-view">
        <Alert
          type="error"
          title="غير مصرح بالوصول"
          message="هذه الصفحة مخصصة لمديري النظام والمساعدين الإداريين المصرح لهم فقط."
        />
      </div>
    );
  }

  const isReadOnly = user.role !== 'admin';

  // Quick stats
  const pendingApprovalsCount = requests.filter((r) => r.status === 'pending').length;
  const assistantUsers = users.filter((u) => u.role === 'assistant_admin');

  return (
    <div
      role="main"
      data-testid="permissions-matrix-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6 text-right"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                <Icon name="shield" size="lg" />
              </span>
              مرجع سياسة الصلاحيات والحوكمة المؤسسية
            </h1>
            <Badge variant="primary" size="sm">
              4 أدوار قياسية
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            تهيئة الصلاحيات الافتراضية وسقوف الأدوار القياسية الأربعة، وإدارة التفويض والرقابة الثنائية لمساعد مدير النظام
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            data-testid="refresh-permissions-btn"
            className="w-full sm:w-auto"
          >
            <Icon name="rotateCcw" size="sm" className="ml-1.5" />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">إجمالي الصلاحيات المعرفة</div>
          <div className="text-2xl font-bold text-text-heading">
            {PERMISSION_DEFINITIONS.length} صلاحية
          </div>
          <div className="text-[11px] text-text-muted">مقسمة على 5 قطاعات وظيفية</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">الأدوار القياسية المعتمدة</div>
          <div className="text-2xl font-bold text-primary-dark">
            4 أدوار
          </div>
          <div className="text-[11px] text-text-muted">مدير، مدير مساعد، محاضر، متدرب</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">طلبات الاعتماد المعلقة</div>
          <div className="text-2xl font-bold text-warning-dark">
            {pendingApprovalsCount}
          </div>
          <div className="text-[11px] text-text-muted">تتطلب مراجعة واعتماد مدير النظام</div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-text-muted">الحسابات المساعدة المؤهلة</div>
          <div className="text-2xl font-bold text-success">
            {assistantUsers.length}
          </div>
          <div className="text-[11px] text-text-muted">حسابات مساعد مدير النظام للتفويض</div>
        </div>
      </div>

      {/* Notice & Direct Link to User Management */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
            <Icon name="users" size="md" />
          </span>
          <div>
            <div className="text-sm font-bold text-text">
              تخصيص الصلاحيات الفردية للمستخدمين
            </div>
            <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
              يتم منح أو سحب الصلاحيات الاستثنائية لكل مستخدم على حدة حصراً عبر شاشة إدارة المستخدمين وفق سقوف الأدوار المحددة.
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/users')}
          data-testid="navigate-to-users-btn"
          className="shrink-0 w-full sm:w-auto"
        >
          <Icon name="arrowLeft" size="sm" className="ml-1.5" />
          الانتقال إلى إدارة المستخدمين
        </Button>
      </div>

      {error && (
        <Alert
          variant="danger"
          title="خطأ أثناء جلب البيانات"
          data-testid="permissions-load-error"
        >
          {error}
        </Alert>
      )}

      {/* Tabs Navigation: Exactly 2 tabs */}
      <div
        className="flex items-center gap-2 border-b border-border text-sm"
        data-testid="permissions-page-tabs"
      >
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'matrix'
              ? 'border-primary-dark text-primary-dark'
              : 'border-transparent text-text-muted hover:text-text hover:border-border'
          }`}
          data-testid="tab-matrix-btn"
        >
          <Icon name="grid" size="sm" />
          الأدوار وسقوف الصلاحيات
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('governance')}
          className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'governance'
              ? 'border-primary-dark text-primary-dark'
              : 'border-transparent text-text-muted hover:text-text hover:border-border'
          }`}
          data-testid="tab-governance-btn"
        >
          <Icon name="checkSquare" size="sm" />
          التفويض والرقابة الثنائية
          {pendingApprovalsCount > 0 && (
            <Badge variant="warning" size="sm" className="mr-1">
              {pendingApprovalsCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-text-muted text-sm shadow-sm">
          جاري تحميل بيانات الصلاحيات والحوكمة...
        </div>
      ) : (
        <>
          {activeTab === 'matrix' && (
            <RolePermissionsMatrix
              configs={configs}
              onReload={loadData}
              readOnly={isReadOnly}
            />
          )}

          {activeTab === 'governance' && (
            <div className="space-y-6" data-testid="governance-tab-content">
              {/* Delegated Operational Authority */}
              <GovernanceDelegationPanel
                assistants={assistantUsers}
                delegations={delegations}
                onReload={loadData}
                readOnly={isReadOnly}
              />

              {/* Approval Requests Ledger */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
                    <Icon name="checkSquare" size="sm" />
                  </span>
                  <h3 className="text-base font-bold text-text">
                    سجل طلبات الاعتماد (Dual-Control Workflow Ledger)
                  </h3>
                </div>
                <ApprovalRequestsTable
                  requests={requests}
                  onReload={loadData}
                  readOnly={isReadOnly}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PermissionsMatrixPage;
