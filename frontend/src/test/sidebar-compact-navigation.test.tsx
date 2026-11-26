import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/shared/ui/Sidebar';
import { MobileDrawer } from '@/shared/ui/MobileDrawer';
import { getAllNavItems } from '@/shared/config/navigation';

let mockUserRole = 'super_admin';
let mockPreviewRole: string | null = null;

vi.mock('@/core/auth/useAuthContext', () => ({
  useAuthContext: () => ({
    user: {
      id: '2',
      name: 'المسؤول الأعلى',
      role: mockUserRole,
      status: 'active',
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/core/auth/useRolePreview', () => ({
  useRolePreview: () => ({
    isPreviewing: Boolean(mockPreviewRole),
    previewRole: mockPreviewRole,
  }),
}));

describe('Compact & Clean Sidebar Navigation', () => {
  it('uses short, concise Arabic titles without redundant active badges', () => {
    const allItems = getAllNavItems();
    for (const item of allItems) {
      expect(item.titleAr.length).toBeLessThanOrEqual(20);
      if (item.status === 'implemented') {
        expect(item.badge).toBeUndefined();
      }
    }

    mockUserRole = 'super_admin';
    mockPreviewRole = null;

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
      </MemoryRouter>
    );

    expect(screen.queryByText('مفعل')).toBeNull();
    expect(screen.getByText('لوحة المتابعة')).toBeTruthy();
    expect(screen.getByText('دليل الدورات')).toBeTruthy();
    expect(screen.getByText('دوراتي')).toBeTruthy();
    expect(screen.getByText('مجموعاتي')).toBeTruthy();
    expect(screen.getByText('إدارة المجموعات')).toBeTruthy();
    expect(screen.getByText('منشئ المحتوى')).toBeTruthy();
    expect(screen.getByText('الاعتمادات والجودة')).toBeTruthy();
    expect(screen.getByText('مسارات الإدارات')).toBeTruthy();
    expect(screen.getByText('إدارة المستخدمين')).toBeTruthy();
    expect(screen.getByText('الصلاحيات')).toBeTruthy();
    expect(screen.getByText('سجل الرقابة')).toBeTruthy();
    expect(screen.getByText('إدارة التعليقات')).toBeTruthy();

    // Non-developers do not see developer-only or planned placeholder items
    expect(screen.queryByText('نظام التصميم')).toBeNull();
    expect(screen.queryByText('إعدادات النظام')).toBeNull();
  });

  it('supports collapsing and expanding navigation sections in Sidebar', () => {
    mockUserRole = 'super_admin';
    mockPreviewRole = null;

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
      </MemoryRouter>
    );

    const governanceToggle = screen.getByTestId('sidebar-section-toggle-governance');
    expect(screen.getByText('سجل الرقابة')).toBeTruthy();

    fireEvent.click(governanceToggle);
    expect(screen.queryByText('سجل الرقابة')).toBeNull();

    fireEvent.click(governanceToggle);
    expect(screen.getByText('سجل الرقابة')).toBeTruthy();
  });

  it('keeps MobileDrawer synchronized with role visibility and concise labels', () => {
    mockUserRole = 'user';
    mockPreviewRole = null;

    render(
      <MemoryRouter>
        <MobileDrawer
          isOpen={true}
          onClose={() => {}}
          user={{ name: 'متدرب', role: 'user', initials: 'م', roleLabelAr: 'المتدرب' }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('لوحة المتابعة')).toBeTruthy();
    expect(screen.getByText('دليل الدورات')).toBeTruthy();
    expect(screen.queryByText('إدارة المجموعات')).toBeNull();
    expect(screen.queryByText('سجل الرقابة')).toBeNull();
    expect(screen.queryByText('مفعل')).toBeNull();
  });
});
