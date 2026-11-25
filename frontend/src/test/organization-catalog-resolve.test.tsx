import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganizationCatalogPage } from '@/pages/OrganizationCatalogPage';
import { AddUserForm } from '@/features/user-management/components/AddUserForm';
import { EditUserModal } from '@/features/user-management/components/EditUserModal';
import { UserManagementPage } from '@/pages/UserManagementPage';
import { ToastProvider } from '@/shared/ui/Toast';
import { apiClient } from '@/core/api/apiClient';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import type { ManagedUserDTO } from '@/core/user-management/types';

vi.mock('@/core/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/apiClient')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'مدير النظام', role: 'super_admin' },
  }),
}));

vi.mock('@/features/user-management/services/userManagementApi', () => ({
  userManagementApi: {
    getManagedUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
  },
}));

describe('Organization Catalog Filters, Unassigned Department, and Dependency Resolution', () => {
  const mockedApi = vi.mocked(apiClient);
  const mockedUserApi = vi.mocked(userManagementApi);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters catalog items and resolves department blockers via floating modal', async () => {
    let departments = [
      {
        id: 1,
        nameAr: 'قطاع التشغيل',
        nameEn: 'Operations',
        usageSummary: { usersCount: 1, jobTitlesCount: 1, coursesCount: 0, totalBlockers: 2 },
      },
      {
        id: 2,
        nameAr: 'قطاع الصيانة',
        nameEn: 'Maintenance',
        usageSummary: { usersCount: 0, jobTitlesCount: 0, coursesCount: 0, totalBlockers: 0 },
      },
    ];

    mockedApi.mockImplementation(async (endpoint: string, options?: RequestInit) => {
      if (endpoint === '/api/admin/organization/departments') {
        return { departments };
      }
      if (endpoint === '/api/admin/organization/job-titles') {
        return {
          jobTitles: [
            { id: 10, nameAr: 'مهندس تشغيل', departmentId: 1, departmentNameAr: 'قطاع التشغيل' },
          ],
        };
      }
      if (endpoint === '/api/admin/organization/departments/1/dependencies') {
        return {
          catalog: 'departments',
          item: { id: 1, nameAr: 'قطاع التشغيل' },
          supportsUnassign: true,
          users: [
            {
              id: '55',
              name: 'أحمد سامي',
              employeeNumber: 'EMP-55',
              role: 'user',
              department: 'قطاع التشغيل',
              jobTitle: 'مهندس تشغيل',
              metroLine: 'الخط الأول',
              leadershipTitle: '',
              canModify: true,
            },
          ],
          jobTitles: [
            {
              id: 10,
              nameAr: 'مهندس تشغيل',
              isPrimaryScoped: true,
              hasDepartmentLink: true,
              linkedUsersCount: 1,
            },
          ],
          courses: [],
          hasProtectedUsers: false,
          canDeleteDirectly: false,
        };
      }
      if (
        endpoint === '/api/admin/organization/departments/1/resolve-dependencies' &&
        options?.method === 'POST'
      ) {
        departments = departments.filter((d) => d.id !== 1);
        return {
          updatedUsersCount: 1,
          updatedJobTitlesCount: 1,
          updatedCoursesCount: 0,
          deleted: true,
          deleteBlockedReason: null,
          dependencies: null,
        };
      }
      return {};
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <OrganizationCatalogPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('org-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('org-item-2')).toBeInTheDocument();
    });

    // Live search filters rows
    fireEvent.change(screen.getByTestId('org-search-input'), {
      target: { value: 'التشغيل' },
    });
    expect(screen.getByTestId('org-item-1')).toBeInTheDocument();
    expect(screen.queryByTestId('org-item-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('org-reset-filters-btn'));
    expect(screen.getByTestId('org-item-2')).toBeInTheDocument();

    // Clicking delete on linked department opens floating resolve-delete modal
    fireEvent.click(screen.getByTestId('org-delete-btn-1'));
    await waitFor(() => {
      expect(screen.getByTestId('catalog-resolve-delete-modal')).toBeInTheDocument();
      expect(screen.getByText('أحمد سامي')).toBeInTheDocument();
    });

    // Switch action to unassign ("بدون قطاع")
    fireEvent.click(screen.getByTestId('resolve-user-action-select'));
    fireEvent.click(screen.getByText('تحويل المحددين إلى «بدون قطاع»'));

    fireEvent.click(screen.getByTestId('resolve-and-delete-btn'));

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        '/api/admin/organization/departments/1/resolve-dependencies',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"userAction":"unassign"'),
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('org-item-1')).not.toBeInTheDocument();
    });
  });

  it('supports creating and editing users with unassigned department and filtering them in directory', async () => {
    mockedApi.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/admin/organization/marital-statuses') {
        return { maritalStatuses: [{ id: 1, code: 'single', nameAr: 'أعزب' }] };
      }
      if (endpoint === '/api/admin/organization/military-statuses') {
        return { militaryStatuses: [{ id: 1, code: 'completed', nameAr: 'أنهى الخدمة' }] };
      }
      if (endpoint === '/api/admin/organization/metro-lines') {
        return { metroLines: [{ id: 1, nameAr: 'الخط الأول' }] };
      }
      if (endpoint === '/api/admin/organization/departments') {
        return { departments: [{ id: 1, nameAr: 'قطاع التشغيل' }] };
      }
      if (endpoint === '/api/admin/organization/job-titles') {
        return { jobTitles: [{ id: 10, nameAr: 'مهندس تشغيل', departmentId: 1 }] };
      }
      if (endpoint === '/api/admin/organization/leadership-titles') {
        return { leadershipTitles: [] };
      }
      return {};
    });

    mockedUserApi.createUser.mockResolvedValue({
      id: '99',
      name: 'سعيد محمود',
      username: '+201011112222',
      role: 'user',
      status: 'active',
      department: '',
      jobTitle: '',
    });

    const onCreated = vi.fn();
    render(
      <MemoryRouter>
        <ToastProvider>
          <AddUserForm onUserCreated={onCreated} />
        </ToastProvider>
      </MemoryRouter>
    );

    // Wait for catalogs to load
    await waitFor(() => {
      expect(screen.getByTestId('add-user-dept-input')).toHaveTextContent('قطاع التشغيل');
    });

    // Switch department to "بدون قطاع (غير محدد)"
    fireEvent.click(screen.getByTestId('add-user-dept-input'));
    fireEvent.click(screen.getByText('— بدون قطاع (غير محدد) —'));

    const jobInput = screen.getByTestId('add-user-job-input') as HTMLInputElement;
    expect(jobInput.disabled).toBe(true);
    expect(jobInput.value).toBe('');

    fireEvent.change(screen.getByTestId('add-user-name-input'), {
      target: { value: 'سعيد محمود' },
    });
    fireEvent.change(screen.getByTestId('add-user-phone-input'), {
      target: { value: '01011112222' },
    });
    fireEvent.change(screen.getByTestId('add-user-national-id-input'), {
      target: { value: '29501010105566' },
    });
    fireEvent.change(screen.getByTestId('add-user-dob-input'), {
      target: { value: '1995-01-01' },
    });
    fireEvent.change(screen.getByTestId('add-user-address-input'), {
      target: { value: 'القاهرة' },
    });
    fireEvent.change(screen.getByTestId('add-user-qualification-input'), {
      target: { value: 'بكالوريوس' },
    });
    fireEvent.change(screen.getByTestId('add-user-appointment-input'), {
      target: { value: '2022-01-01' },
    });
    fireEvent.click(screen.getByTestId('add-user-generate-password-btn'));

    fireEvent.click(screen.getByTestId('add-user-submit-btn'));

    await waitFor(() => {
      expect(mockedUserApi.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          department: '',
          jobTitle: '',
        })
      );
    });
  });

  it('allows unassigning department in EditUserModal and filtering unassigned users in UserManagementPage', async () => {
    mockedApi.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/admin/organization/marital-statuses') {
        return { maritalStatuses: [{ id: 1, code: 'single', nameAr: 'أعزب' }] };
      }
      if (endpoint === '/api/admin/organization/military-statuses') {
        return { militaryStatuses: [{ id: 1, code: 'completed', nameAr: 'أنهى الخدمة' }] };
      }
      if (endpoint === '/api/admin/organization/metro-lines') {
        return { metroLines: [{ id: 1, nameAr: 'الخط الأول' }] };
      }
      if (endpoint === '/api/admin/organization/departments') {
        return { departments: [{ id: 1, nameAr: 'قطاع التشغيل' }] };
      }
      if (endpoint === '/api/admin/organization/job-titles') {
        return { jobTitles: [{ id: 10, nameAr: 'مهندس تشغيل', departmentId: 1 }] };
      }
      if (endpoint === '/api/admin/organization/leadership-titles') {
        return { leadershipTitles: [] };
      }
      return {};
    });

    const assignedUser: ManagedUserDTO = {
      id: '55',
      name: 'أحمد سامي',
      username: '+201022223333',
      phone: '+201022223333',
      role: 'user',
      status: 'active',
      department: 'قطاع التشغيل',
      jobTitle: 'مهندس تشغيل',
      nationalId: '29501010101234',
      dateOfBirth: '1995-01-01',
      appointmentDate: '2021-01-01',
      address: 'القاهرة',
      educationalQualification: 'بكالوريوس',
    };
    mockedUserApi.updateUser.mockResolvedValue({ ...assignedUser, department: '', jobTitle: '' });

    const { unmount } = render(
      <MemoryRouter>
        <ToastProvider>
          <EditUserModal isOpen user={assignedUser} onClose={vi.fn()} onSuccess={vi.fn()} />
        </ToastProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('edit-user-dept-select'));
    fireEvent.click(screen.getByText('— بدون قطاع (غير محدد) —'));
    fireEvent.click(screen.getByTestId('edit-user-submit-btn'));

    await waitFor(() => {
      expect(mockedUserApi.updateUser).toHaveBeenCalledWith(
        '55',
        expect.objectContaining({
          department: '',
          jobTitle: '',
        })
      );
    });
    unmount();

    // UserManagementPage directory filters unassigned users cleanly
    mockedUserApi.getManagedUsers.mockResolvedValue([
      assignedUser,
      {
        id: '99',
        name: 'سعيد محمود',
        username: '+201011112222',
        role: 'user',
        status: 'active',
        department: '',
        jobTitle: '',
      },
    ]);

    render(
      <MemoryRouter>
        <ToastProvider>
          <UserManagementPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('سعيد محمود')).toBeInTheDocument();
      expect(screen.getByText('أحمد سامي')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('dept-filter-select'));
    fireEvent.click(screen.getByText('بدون قطاع (غير محدد)'));

    await waitFor(() => {
      expect(screen.getByText('سعيد محمود')).toBeInTheDocument();
      expect(screen.queryByText('أحمد سامي')).not.toBeInTheDocument();
    });
  });
});
