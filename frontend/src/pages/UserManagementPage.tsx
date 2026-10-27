import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ManagedUserDTO, UserRole, UserStatus } from '@/core/user-management/types';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { resolveCanonicalUserId } from '@/mocks/fixtures/userDirectoryFixtures';
import { UserFilterBar } from '@/features/user-management/components/UserFilterBar';
import { UserTable } from '@/features/user-management/components/UserTable';
import { AddUserModal } from '@/features/user-management/components/AddUserModal';
import { SuspendUserModal } from '@/features/user-management/components/SuspendUserModal';
import { UserPermissionsModal } from '@/features/permissions/components/UserPermissionsModal';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';

/**
 * Centrally Managed Administrator User Directory Page (/admin/users)
 *
 * Implemented in Phase 1 & 2:
 * - Read-only view & live search of centralized user directory.
 * - Multi-criteria filters: role, status, department.
 * - AddUserModal for administrative user creation.
 * - In-place role mutation with authoritative API integration.
 * - SuspendUserModal for account suspension and reactivation.
 * - Dynamic synchronization with candidate trainee eligibility.
 * - RBAC protection for administrators only.
 */
export const UserManagementPage: React.FC = () => {
  const toast = useToast();
  const [users, setUsers] = useState<ManagedUserDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<UserStatus | 'all'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string | 'all'>('all');

  // Modal & Mutation states
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [statusModalUser, setStatusModalUser] = useState<ManagedUserDTO | null>(null);
  const [statusModalTarget, setStatusModalTarget] = useState<UserStatus>('suspended');
  const [permissionsModalUser, setPermissionsModalUser] = useState<ManagedUserDTO | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Load directory users from central API
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userManagementApi.getManagedUsers();
      setUsers(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'تعذر تحميل دليل المستخدمين من الخادم';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Extract distinct departments for filter dropdown
  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    for (const u of users) {
      if (u.department && u.department.trim()) {
        depts.add(u.department.trim());
      }
    }
    return Array.from(depts).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [users]);

  // Live client-side filtering combined across search query and selectors
  const filteredUsers = useMemo(() => {
    let result = users;

    // Role filter
    if (selectedRole !== 'all') {
      result = result.filter((u) => u.role === selectedRole);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      result = result.filter((u) => u.status === selectedStatus);
    }

    // Department filter
    if (selectedDepartment !== 'all') {
      result = result.filter((u) => u.department === selectedDepartment);
    }

    // Free-text search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const canonicalQueryId = resolveCanonicalUserId(q).toLowerCase();

      result = result.filter((u) => {
        const matchesDirect =
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q)) ||
          u.jobTitle.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q) ||
          (u.legacyAliases && u.legacyAliases.some((a) => a.toLowerCase().includes(q)));

        const matchesCanonical = u.id.toLowerCase() === canonicalQueryId;

        return matchesDirect || matchesCanonical;
      });
    }

    return result;
  }, [users, selectedRole, selectedStatus, selectedDepartment, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedRole !== 'all' ||
    selectedStatus !== 'all' ||
    selectedDepartment !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRole('all');
    setSelectedStatus('all');
    setSelectedDepartment('all');
  };

  const handleUserCreated = (newUser: ManagedUserDTO) => {
    setUsers((prev) => [newUser, ...prev]);
  };

  const handleRoleChange = async (user: ManagedUserDTO, newRole: UserRole) => {
    if (user.role === newRole) return;

    setUpdatingUserId(user.id);
    const previousRole = user.role;

    // Optimistically update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
    );

    try {
      const updated = await userManagementApi.updateUserRole(user.id, newRole);
      if ((updated as unknown as { approvalRequired?: boolean; message?: string }).approvalRequired) {
        // Revert optimistic role change since mutation requires approval
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: previousRole } : u))
        );
        toast.info(
          (updated as unknown as { message?: string }).message ||
            `تم تقديم طلب تعديل دور "${user.name}" للاعتماد؛ بانتظار موافقة مدير النظام.`
        );
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? updated : u))
        );
        toast.success(`تم تغيير دور "${user.name}" بنجاح.`);
      }
    } catch (err: unknown) {
      // Revert to authoritative on error
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: previousRole } : u))
      );
      const msg = err instanceof Error ? err.message : 'تعذر تغيير الدور الوظيفي للمستخدم.';
      toast.error(msg);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleOpenStatusModal = (user: ManagedUserDTO, targetStatus: UserStatus) => {
    setStatusModalUser(user);
    setStatusModalTarget(targetStatus);
  };

  const handleStatusSuccess = (updatedUser: ManagedUserDTO) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
  };

  return (
    <div
      role="main"
      data-testid="user-management-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-text-heading flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="users" size="lg" />
              </span>
              دليل المستخدمين الموحد
            </h1>
            <Badge variant="primary" size="sm" data-testid="user-count-badge">
              {isLoading ? '...' : `${users.length} مستخدم`}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            إدارة واستعراض كافة الحسابات والتحقق من الهويات وتعديل الأدوار وحالات التنشيط عبر المنصة
          </p>
        </div>

        {/* Action Button: Add User */}
        <div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsAddUserModalOpen(true)}
            data-testid="open-add-user-modal-btn"
            className="w-full sm:w-auto"
          >
            <Icon name="plus" size="sm" className="ml-1.5" />
            إضافة مستخدم جديد
          </Button>
        </div>
      </div>

      {/* Error Alert with Safe Retry */}
      {error && (
        <Alert
          variant="danger"
          title="خطأ في تحميل البيانات"
          data-testid="user-directory-error"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              data-testid="retry-fetch-btn"
              className="text-xs self-start sm:self-auto"
            >
              <Icon name="refresh" size="sm" className="ml-1.5" />
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* Search and Filter Controls */}
      <UserFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedDepartment={selectedDepartment}
        onDepartmentChange={setSelectedDepartment}
        availableDepartments={availableDepartments}
        onReset={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Users Directory Table */}
      <UserTable
        users={filteredUsers}
        isLoading={isLoading}
        emptyStateMessage="لا توجد نتائج مطابقة لبحثك"
        onResetFilters={handleResetFilters}
        onRoleChange={handleRoleChange}
        onOpenStatusModal={handleOpenStatusModal}
        onManagePermissions={(u) => setPermissionsModalUser(u)}
        updatingUserId={updatingUserId}
      />

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onUserCreated={handleUserCreated}
      />

      {/* Suspend / Reactivate Status Modal */}
      <SuspendUserModal
        isOpen={Boolean(statusModalUser)}
        user={statusModalUser}
        targetStatus={statusModalTarget}
        onClose={() => setStatusModalUser(null)}
        onSuccess={handleStatusSuccess}
      />

      {/* Individual User Permissions Modal */}
      <UserPermissionsModal
        isOpen={Boolean(permissionsModalUser)}
        user={permissionsModalUser}
        onClose={() => setPermissionsModalUser(null)}
        onSuccess={() => {
          setPermissionsModalUser(null);
          fetchUsers();
        }}
      />
    </div>
  );
};

export default UserManagementPage;
