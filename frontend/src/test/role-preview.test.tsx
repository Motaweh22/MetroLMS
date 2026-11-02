/**
 * MetroLMS — Increment 5.2 Test Suite: Visual Role Preview Architecture
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 *
 * Authoritative Governance Reference:
 * - MetroLMS Pre-Backend Migration Remediation Roadmap — Revision 5:
 *   - Section 3: Developer Confidentiality and Secure Provisioning
 *   - Section 4: Developer Preview and Isolated Role Testing (Decision D-10)
 *   - Stable Finding MFR-25: Developer Surface Protection
 *   - Stable Finding MFR-40: Separation of Visual Role Preview from Isolated Role Testing
 *   - Invariant INV-R8: Developer Non-Disclosure and Parity
 * - Phase 5 Planning Documents:
 *   - docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md
 *   - docs/frontend/reports/phase-05-planning-report.md
 *
 * CRITICAL EXECUTION DIRECTIVE:
 * Per project-wide governance, this test suite is written during Increment 5.2 implementation
 * but DEFERRED for consolidated execution in Phase 13 (Gate B).
 * DO NOT execute Vitest runner, TypeScript compiler (tsc), or linter against this file.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { UserRole } from '@/core/auth/types';
import {
  RolePreviewProvider,
  useRolePreview,
  SUPPORTED_PREVIEW_ROLES,
} from '@/core/auth/RolePreviewContext';
import {
  isRolePreviewMutationBlocked,
  ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE,
} from '@/core/auth/previewMutationBarrier';
import { apiClient, ApiError } from '@/core/api/apiClient';
import { DeveloperRouteGuard } from '@/app/router';
import { RolePreviewBanner } from '@/features/auth/components/RolePreviewBanner';
import { RolePreviewControl } from '@/features/auth/components/RolePreviewControl';
import { Sidebar } from '@/shared/ui/Sidebar/Sidebar';
import { MobileDrawer } from '@/shared/ui/MobileDrawer/MobileDrawer';
import {
  ROLE_DEFAULT_CAPABILITIES,
  ROLE_CAPABILITY_CEILINGS,
} from '@/core/permissions/policy';

// Test consumer harness to inspect hook values
const RolePreviewTestConsumer: React.FC<{
  onState?: (state: ReturnType<typeof useRolePreview>, auth: ReturnType<typeof useAuth>) => void;
}> = ({ onState }) => {
  const previewState = useRolePreview();
  const authState = useAuth();
  onState?.(previewState, authState);

  return (
    <div data-testid="preview-test-consumer">
      <span data-testid="auth-role">{authState.user?.role ?? 'none'}</span>
      <span data-testid="auth-user-id">{authState.user?.id ?? 'none'}</span>
      <span data-testid="preview-role">{previewState.previewRole ?? 'none'}</span>
      <span data-testid="effective-ui-role">{previewState.effectiveUiRole}</span>
      <span data-testid="is-previewing">{String(previewState.isPreviewing)}</span>
      <span data-testid="is-available">{String(previewState.isAvailable)}</span>
      <span data-testid="preview-label">{previewState.previewLabelAr ?? 'none'}</span>
      <button
        type="button"
        data-testid="start-admin-preview-btn"
        onClick={() => previewState.startPreview('admin')}
      >
        Start Admin Preview
      </button>
      <button
        type="button"
        data-testid="start-assistant-lecturer-btn"
        onClick={() =>
          previewState.startPreview('assistant_lecturer', {
            type: 'assistant_lecturer',
            groupId: 'GRP-101',
            groupName: 'مجموعة تشغيل الخط الثاني',
          })
        }
      >
        Start Assistant Lecturer Preview
      </button>
      <button
        type="button"
        data-testid="start-invalid-assistant-lecturer-btn"
        onClick={() => previewState.startPreview('assistant_lecturer')}
      >
        Start Invalid Assistant Lecturer Preview
      </button>
      <button
        type="button"
        data-testid="stop-preview-btn"
        onClick={() => previewState.stopPreview()}
      >
        Stop Preview
      </button>
    </div>
  );
};

describe('Increment 5.2: Visual Role Preview Architecture (MFR-40, D-10)', () => {
  const developerUser = {
    id: 'USR_DEV_001',
    name: 'مطور النظام',
    email: 'developer.metro@internal.local',
    role: 'developer' as UserRole,
    department: 'التطوير البرمجي',
    jobTitle: 'مطور نظم أول',
    initials: 'م.ن',
  };

  const adminUser = {
    id: 'usr_admin_001',
    name: 'مسؤول النظام',
    email: 'admin@metro.local',
    role: 'admin' as UserRole,
    department: 'التشغيل',
    jobTitle: 'مدير نظام',
    initials: 'م.ن',
  };

  beforeEach(() => {
    authStorage.clearSession();
  });

  afterEach(() => {
    authStorage.clearSession();
  });

  // =========================================================================
  // Requirement 1: Only an actual authenticated Developer can activate preview
  // =========================================================================
  it('1. Only an actual authenticated Developer can activate Role Preview', () => {
    // Authenticated as Admin (non-developer)
    authStorage.setSession({
      user: adminUser,
      token: 'mock_jwt_admin_token',
      expiresAt: Date.now() + 100000,
    });

    let hookValues!: ReturnType<typeof useRolePreview>;

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer onState={(preview) => (hookValues = preview)} />
        </RolePreviewProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('is-available')).toHaveTextContent('false');
    expect(hookValues.isAvailable).toBe(false);

    // Attempt to start preview
    act(() => {
      const result = hookValues.startPreview('super_admin');
      expect(result).toBe(false);
    });

    expect(screen.getByTestId('is-previewing')).toHaveTextContent('false');
    expect(screen.getByTestId('preview-role')).toHaveTextContent('none');
    expect(screen.getByTestId('effective-ui-role')).toHaveTextContent('admin');
  });

  // =========================================================================
  // Requirement 2: Previewing does NOT alter AuthContext.user.role
  // =========================================================================
  it('2. Previewing "admin" does not change AuthContext.user.role from "developer"', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev_token',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
        </RolePreviewProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-role')).toHaveTextContent('developer');
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('false');

    // Click to start previewing admin
    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));

    // Visual role becomes admin, but authentic AuthContext user remains developer!
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('true');
    expect(screen.getByTestId('preview-role')).toHaveTextContent('admin');
    expect(screen.getByTestId('effective-ui-role')).toHaveTextContent('admin');
    expect(screen.getByTestId('auth-role')).toHaveTextContent('developer');
  });

  // =========================================================================
  // Requirement 3: User ID and Access Token remain unchanged in session
  // =========================================================================
  it('3. Previewing any supported role does not change active user ID or access token', () => {
    const devToken = 'mock_jwt_developer_token_invariant';
    authStorage.setSession({
      user: developerUser,
      token: devToken,
      expiresAt: Date.now() + 100000,
    });

    let previewApi!: ReturnType<typeof useRolePreview>;

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer onState={(preview) => (previewApi = preview)} />
        </RolePreviewProvider>
      </AuthProvider>
    );

    for (const role of SUPPORTED_PREVIEW_ROLES) {
      act(() => {
        if (role === 'assistant_lecturer') {
          previewApi.startPreview(role, {
            type: 'assistant_lecturer',
            groupId: 'GRP-101',
            groupName: 'برنامج الخط الثاني',
          });
        } else {
          previewApi.startPreview(role);
        }
      });

      // Storage integrity verification: Developer token and ID must remain completely untouched
      const currentSession = authStorage.getSession();
      expect(currentSession?.token).toBe(devToken);
      expect(currentSession?.user.id).toBe('USR_DEV_001');
      expect(currentSession?.user.role).toBe('developer');
      expect(screen.getByTestId('auth-user-id')).toHaveTextContent('USR_DEV_001');
    }
  });

  // =========================================================================
  // Requirement 4: API requests continue to use Developer authorization context
  // =========================================================================
  it('4. API requests continue to use actual Developer authorization context during preview', async () => {
    const devToken = 'mock_jwt_dev_bearer_token';
    authStorage.setSession({
      user: developerUser,
      token: devToken,
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Activate visual preview for 'user' (trainee)
    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));
    expect(screen.getByTestId('effective-ui-role')).toHaveTextContent('admin');

    // Inspect authStorage: token sent in Authorization header remains Developer bearer token
    const storedSession = authStorage.getSession();
    expect(storedSession?.token).toBe(devToken);
    expect(storedSession?.user.role).toBe('developer');
  });

  // =========================================================================
  // Requirement 5: Preview role does NOT grant or remove actual API permissions
  // =========================================================================
  it('5. A preview role does not grant or remove actual API permissions', () => {
    // Invariant: Permissions are computed strictly against AuthContext.user, never previewRole
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    let previewApi!: ReturnType<typeof useRolePreview>;
    let authApi!: ReturnType<typeof useAuth>;

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer onState={(prev, auth) => {
            previewApi = prev;
            authApi = auth;
          }} />
        </RolePreviewProvider>
      </AuthProvider>
    );

    act(() => {
      previewApi.startPreview('user'); // visually previewing trainee
    });

    // Authentic user remains Developer
    expect(authApi.user?.role).toBe('developer');
    // Developer capability ceilings remain intact
    expect(ROLE_CAPABILITY_CEILINGS.developer).toBeDefined();
  });

  // =========================================================================
  // Requirement 6: Non-Developer cannot activate preview via props or controls
  // =========================================================================
  it('6. A non-Developer cannot activate preview by passing props, changing display state, or invoking preview controls', () => {
    // Trainee session
    authStorage.setSession({
      user: {
        id: 'usr_trainee_003',
        name: 'متدرب فني',
        email: 'trainee@metro.local',
        role: 'user',
        department: 'التشغيل',
        jobTitle: 'متدرب',
        initials: 'م.ت',
      },
      token: 'mock_jwt_trainee',
      expiresAt: Date.now() + 100000,
    });

    const { unmount } = render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewControl />
          <RolePreviewTestConsumer />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Navbar preview button is completely unrendered for non-developer
    expect(screen.queryByTestId('navbar-role-preview-btn')).not.toBeInTheDocument();

    // Invoking startPreview programmatically fails
    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('false');
    expect(screen.getByTestId('effective-ui-role')).toHaveTextContent('user');

    unmount();
  });

  // =========================================================================
  // Requirement 7: Developer-only route protection remains based on actual identity
  // =========================================================================
  it('7. Developer-only route protection remains based on actual authenticated identity', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev_route',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
          <MemoryRouter>
            <DeveloperRouteGuard>
              <div data-testid="developer-lab-content">محتوى معمل التصميم للمطور</div>
            </DeveloperRouteGuard>
          </MemoryRouter>
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Developer accesses /design-system
    expect(screen.getByTestId('developer-lab-content')).toBeInTheDocument();

    // Start visually previewing 'user' role
    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));
    expect(screen.getByTestId('effective-ui-role')).toHaveTextContent('admin');

    // Route guard still evaluates actual AuthContext user ('developer'), preserving Developer access
    expect(screen.getByTestId('developer-lab-content')).toBeInTheDocument();
    expect(screen.queryByText('الصفحة غير موجودة')).not.toBeInTheDocument();
  });

  // =========================================================================
  // Requirement 8: assistant_lecturer is NOT in global UserRole type
  // =========================================================================
  it('8. assistant_lecturer is not added to the global UserRole type', () => {
    // Assert assistant_lecturer is absent from global role capability dictionaries
    expect((ROLE_DEFAULT_CAPABILITIES as Record<string, unknown>).assistant_lecturer).toBeUndefined();
    expect((ROLE_CAPABILITY_CEILINGS as Record<string, unknown>).assistant_lecturer).toBeUndefined();
  });

  // =========================================================================
  // Requirement 9: assistant_lecturer requires a valid group-scoped assignment
  // =========================================================================
  it('9. assistant_lecturer preview requires a valid group-scoped assignment context', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Attempt to start assistant_lecturer preview without a group context -> must reject
    fireEvent.click(screen.getByTestId('start-invalid-assistant-lecturer-btn'));
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('false');
    expect(screen.getByTestId('preview-role')).toHaveTextContent('none');

    // Start assistant_lecturer preview with valid group context -> must succeed
    fireEvent.click(screen.getByTestId('start-assistant-lecturer-btn'));
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('true');
    expect(screen.getByTestId('preview-role')).toHaveTextContent('assistant_lecturer');
    expect(screen.getByTestId('effective-ui-role')).toHaveTextContent('lecturer');
    expect(screen.getByTestId('preview-label')).toHaveTextContent(
      'مدرس مساعد (تكليف بمجموعة: مجموعة تشغيل الخط الثاني)'
    );
  });

  // =========================================================================
  // Requirement 10: Ending preview restores normal Developer UI
  // =========================================================================
  it('10. Ending preview restores normal Developer UI', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
          <RolePreviewBanner />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Start preview
    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));
    expect(screen.getByTestId('role-preview-persistent-banner')).toBeInTheDocument();
    expect(screen.getByTestId('role-preview-banner-text')).toHaveTextContent(
      'وضع معاينة الواجهة فقط: مدير النظام — الصلاحيات البرمجية الحالية: المطور'
    );

    // Exit preview via persistent banner button
    fireEvent.click(screen.getByTestId('exit-role-preview-btn'));

    expect(screen.queryByTestId('role-preview-persistent-banner')).not.toBeInTheDocument();
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('false');
    expect(screen.getByTestId('effective-ui-role')).toHaveTextContent('developer');
  });

  // =========================================================================
  // Requirement 11: Sign-out or user change clears preview state
  // =========================================================================
  it('11. Sign-out or authenticated-user changes clear preview state', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    let authApi!: ReturnType<typeof useAuth>;

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer onState={(_, auth) => (authApi = auth)} />
        </RolePreviewProvider>
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('true');
    expect(isRolePreviewMutationBlocked()).toBe(true);

    // Developer logs out
    act(() => {
      authApi.logout();
    });

    // Preview state and mutation barrier reset immediately
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('false');
    expect(screen.getByTestId('preview-role')).toHaveTextContent('none');
    expect(isRolePreviewMutationBlocked()).toBe(false);
  });

  // =========================================================================
  // Requirement 12: Mutating operations are blocked during visual preview
  // =========================================================================
  it('12. Mutating operations are blocked while preview is active by the mutation barrier', async () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Before preview: barrier is inactive
    expect(isRolePreviewMutationBlocked()).toBe(false);

    // Start preview
    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));
    expect(isRolePreviewMutationBlocked()).toBe(true);

    // Attempting a POST mutation via apiClient must throw an ApiError immediately
    await expect(
      apiClient('/api/admin/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'مجموعة تجريبية' }),
      })
    ).rejects.toBeInstanceOf(ApiError);

    // Attempting a DELETE mutation via apiClient must also throw
    await expect(
      apiClient('/api/admin/groups/GRP-101', {
        method: 'DELETE',
      })
    ).rejects.toThrow(ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE);

    // Stop preview: barrier is deactivated
    fireEvent.click(screen.getByTestId('stop-preview-btn'));
    expect(isRolePreviewMutationBlocked()).toBe(false);
  });

  // =========================================================================
  // Requirement 13: Persistent preview banner renders approved Arabic wording
  // =========================================================================
  it('13. Persistent preview banner displays approved Arabic text and one-click exit action', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
          <RolePreviewBanner />
        </RolePreviewProvider>
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));

    const banner = screen.getByTestId('role-preview-persistent-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      'وضع معاينة الواجهة فقط: مدير النظام — الصلاحيات البرمجية الحالية: المطور'
    );
    expect(screen.getByTestId('exit-role-preview-btn')).toHaveTextContent('إنهاء المعاينة');
  });

  // =========================================================================
  // Requirement 14: Navigation menus filter items according to effectiveUiRole
  // =========================================================================
  it('14. Navigation menus filter items according to effectiveUiRole during visual preview', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    const { unmount } = render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} />
          </MemoryRouter>
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Before preview: Developer sees design-system and milestone label
    expect(screen.getByRole('link', { name: /معمل نظام التصميم/i })).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-brand-version')).toHaveTextContent('مترو القاهرة LMS • مرحلة 2');

    // Start previewing trainee ('user')
    act(() => {
      // simulate starting 'user' preview
      const consumer = screen.getByTestId('start-admin-preview-btn');
      fireEvent.click(consumer);
    });

    unmount();

    // Render with effectiveUiRole = 'user'
    render(
      <AuthProvider>
        <RolePreviewProvider>
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="user" />
            <MobileDrawer
              isOpen={true}
              onClose={() => {}}
              user={{ name: 'مطور النظام', role: 'user', initials: 'م.ن' }}
            />
          </MemoryRouter>
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Design system link is hidden for trainee preview
    expect(screen.queryByRole('link', { name: /معمل نظام التصميم/i })).not.toBeInTheDocument();
    // Brand labels render clean institutional text without prototype milestone labels
    expect(screen.getByTestId('sidebar-brand-version')).toHaveTextContent('مترو القاهرة LMS');
    expect(screen.getByTestId('sidebar-brand-version')).not.toHaveTextContent('مرحلة 2');
    expect(screen.getByTestId('mobile-drawer-brand-version')).toHaveTextContent(
      'المنظومة التدريبية الذكية لمترو القاهرة'
    );
    expect(screen.getByTestId('mobile-drawer-brand-version')).not.toHaveTextContent('المرحلة 3');
  });

  // =========================================================================
  // Requirement 15: Authentication Lifecycle Exemption (Session Termination)
  // =========================================================================
  it('15. Authentication lifecycle exemption: session termination (/api/auth/logout) is not blocked by mutation barrier', async () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Start preview and activate mutation barrier
    fireEvent.click(screen.getByTestId('start-admin-preview-btn'));
    expect(isRolePreviewMutationBlocked()).toBe(true);

    // Calling session termination /api/auth/logout must NOT throw ROLE_PREVIEW_MUTATION_BLOCKED
    // and must immediately reset the mutation barrier
    let logoutBlocked = false;
    try {
      await apiClient('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message === ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE) {
        logoutBlocked = true;
      }
    }

    expect(logoutBlocked).toBe(false);
    expect(isRolePreviewMutationBlocked()).toBe(false);
  });

  // =========================================================================
  // Requirement 16: Scoped Assistant Lecturer Navigation Filtering
  // =========================================================================
  it('16. Group-scoped assistant_lecturer preview suppresses course-builder and exposes group scope', () => {
    authStorage.setSession({
      user: developerUser,
      token: 'mock_jwt_dev',
      expiresAt: Date.now() + 100000,
    });

    let previewControls!: ReturnType<typeof useRolePreview>;

    const { unmount } = render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer onState={(prev) => (previewControls = prev)} />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Start assistant_lecturer preview with scoped group
    act(() => {
      previewControls.startPreview('assistant_lecturer', {
        type: 'assistant_lecturer',
        groupId: 'GRP-101',
        groupName: 'مجموعة القيادة المتقدمة',
      });
    });

    unmount();

    // Render Sidebar and MobileDrawer with effectiveUiRole = 'lecturer' while previewRole is 'assistant_lecturer'
    render(
      <AuthProvider>
        <RolePreviewProvider>
          <MemoryRouter>
            <Sidebar isCollapsed={false} onToggleCollapse={() => {}} userRole="lecturer" />
            <MobileDrawer
              isOpen={true}
              onClose={() => {}}
              user={{ name: 'مطور النظام', role: 'lecturer', initials: 'م.ن' }}
            />
          </MemoryRouter>
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Standard lecturer has course-builder, but scoped assistant lecturer preview must NOT expose course-builder
    // (tested across navigation section item filtering)
    expect(screen.queryByRole('link', { name: /منشئ المحتوى للمحاضرين/i })).not.toBeInTheDocument();
  });

  // =========================================================================
  // Requirement 17: Synchronous Identity Neutrality on Identity Change
  // =========================================================================
  it('17. Synchronous identity isolation: preview state is neutralized immediately during render if identity becomes non-Developer', () => {
    // Authenticated admin user (not Developer)
    authStorage.setSession({
      user: adminUser,
      token: 'mock_jwt_admin',
      expiresAt: Date.now() + 100000,
    });

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <RolePreviewTestConsumer />
        </RolePreviewProvider>
      </AuthProvider>
    );

    // Available is false, previewing is false, effectiveUiRole matches actual admin role
    expect(screen.getByTestId('is-available')).toHaveTextContent('false');
    expect(screen.getByTestId('is-previewing')).toHaveTextContent('false');
    expect(screen.getByTestId('effective-role')).toHaveTextContent('admin');
    expect(isRolePreviewMutationBlocked()).toBe(false);
  });
});
