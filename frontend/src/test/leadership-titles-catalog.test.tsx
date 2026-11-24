import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganizationCatalogPage } from '@/pages/OrganizationCatalogPage';
import { ToastProvider } from '@/shared/ui/Toast';
import { apiClient } from '@/core/api/apiClient';

vi.mock('@/core/api/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/apiClient')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

describe('OrganizationCatalogPage — Leadership Titles Management', () => {
  const mockedApi = vi.mocked(apiClient);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/admin/organization/departments') {
        return { departments: [{ id: 1, nameAr: 'قطاع التشغيل', nameEn: 'Operations' }] };
      }
      if (endpoint === '/api/admin/organization/leadership-titles') {
        return {
          leadershipTitles: [
            { id: 1, nameAr: 'مدير عام', nameEn: 'General Manager' },
            { id: 2, nameAr: 'مشرف / رئيس وردية', nameEn: 'Supervisor' },
          ],
        };
      }
      return {};
    });
  });

  it('allows switching to leadership titles tab and adding/editing/deleting leadership titles', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <OrganizationCatalogPage />
        </ToastProvider>
      </MemoryRouter>
    );

    const tabBtn = await screen.findByTestId('org-tab-leadership-titles');
    fireEvent.click(tabBtn);

    await waitFor(() => {
      expect(screen.getByText('مدير عام')).toBeInTheDocument();
      expect(screen.getByText('مشرف / رئيس وردية')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('org-new-name-ar-input'), {
      target: { value: 'نائب رئيس قطاع' },
    });
    fireEvent.change(screen.getByTestId('org-new-name-en-input'), {
      target: { value: 'Deputy Sector Head' },
    });
    fireEvent.click(screen.getByTestId('org-add-submit-btn'));

    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        '/api/admin/organization/leadership-titles',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            nameAr: 'نائب رئيس قطاع',
            nameEn: 'Deputy Sector Head',
          }),
        })
      );
    });
  });
});
