/**
 * MetroLMS — Visual Role Preview Context
 *
 * Authoritative Governance Reference:
 * - MetroLMS Pre-Backend Migration Remediation Roadmap — Revision 5:
 *   - Section 3: Developer Confidentiality and Secure Provisioning
 *   - Section 4: Developer Preview and Isolated Role Testing (Decision D-10)
 *   - Stable Finding MFR-40: Separation of visual Role Preview from isolated role-testing sessions
 *   - Invariant INV-R8: Developer Protection and Non-Disclosure
 * - Phase 5 Planning Documents:
 *   - docs/frontend/checklists/phase-05-developer-preview-and-isolated-testing-checklist.md
 *   - docs/frontend/reports/phase-05-planning-report.md
 *
 * ARCHITECTURAL MANDATES:
 * 1. Available EXCLUSIVELY to an actually authenticated Developer (AuthContext.user.role === 'developer').
 * 2. Visual Role Preview NEVER modifies or replaces:
 *    - AuthContext.user
 *    - The authenticated user's canonical ID (USR_DEV_001)
 *    - The authenticated user's actual role ('developer')
 *    - The active session token or authorization headers
 *    - The backend authorization policy or permissions matrix
 * 3. In-memory state only. Never persisted in localStorage, sessionStorage, or auth session.
 * 4. Automatically clears when the Developer logs out or the authenticated identity changes.
 * 5. State-changing operations (mutations) are intercepted by the mutation barrier while preview is active.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { UserRole } from '@/core/auth/types';
import { useAuthContext } from './useAuthContext';
import { setRolePreviewMutationBarrier } from './previewMutationBarrier';

export type GlobalPreviewRole = 'super_admin' | 'admin' | 'assistant_admin' | 'lecturer' | 'user';

/**
 * Supported Visual Preview Roles:
 * Five canonical global roles plus group-scoped assistant_lecturer.
 * Note: assistant_lecturer is intentionally NOT part of the global UserRole union.
 */
export type PreviewRole = GlobalPreviewRole | 'assistant_lecturer';

export const SUPPORTED_PREVIEW_ROLES: PreviewRole[] = [
  'super_admin',
  'admin',
  'assistant_admin',
  'lecturer',
  'assistant_lecturer',
  'user',
];

export const PREVIEW_ROLE_LABELS_AR: Record<PreviewRole, string> = {
  super_admin: 'المدير العام',
  admin: 'مدير النظام',
  assistant_admin: 'مساعد مدير نظام',
  lecturer: 'محاضر معتمد',
  assistant_lecturer: 'مدرس مساعد (تكليف بمجموعة)',
  user: 'متدرب',
};

export interface ScopedAssignmentPreview {
  type: 'assistant_lecturer';
  groupId: string;
  groupName: string;
  assistantLecturerId?: string;
  assistantLecturerName?: string;
}

export interface RolePreviewContextValue {
  /** The preview role currently active, or null if in standard Developer view */
  previewRole: PreviewRole | null;
  /** Effective UI presentation role derived from previewRole ?? user.role */
  effectiveUiRole: UserRole;
  /** Whether visual role preview is currently active */
  isPreviewing: boolean;
  /** Scoped assignment context when previewRole === 'assistant_lecturer' */
  scopedAssignmentPreview: ScopedAssignmentPreview | null;
  /** Whether the preview feature is available (only for actual authenticated Developer) */
  isAvailable: boolean;
  /** Start visual preview for a global role or scoped assistant lecturer */
  startPreview: (role: PreviewRole, scopedAssignment?: ScopedAssignmentPreview | null) => boolean;
  /** Stop visual preview and restore standard Developer UI */
  stopPreview: () => void;
  /** Formatted Arabic label for the active preview */
  previewLabelAr: string | null;
}

const RolePreviewContext = createContext<RolePreviewContextValue | undefined>(undefined);

export const RolePreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthContext();
  const [previewRole, setPreviewRole] = useState<PreviewRole | null>(null);
  const [scopedAssignment, setScopedAssignment] = useState<ScopedAssignmentPreview | null>(null);
  const [previewOwnerId, setPreviewOwnerId] = useState<string | null>(null);

  // Invariant 1: Only an actually authenticated Developer can access or activate Role Preview
  const isAvailable = Boolean(user && user.role === 'developer');

  // Verify that active preview strictly belongs to the current Developer's authenticated user ID
  const isOwnerSessionValid = Boolean(
    isAvailable && previewOwnerId && user?.id === previewOwnerId
  );

  // Synchronous identity isolation: If the user is not an authenticated Developer,
  // or if the identity has transitioned to a different user, preview is synchronously neutralized
  const activePreviewRole = isOwnerSessionValid ? previewRole : null;
  const activeScopedAssignment = isOwnerSessionValid ? scopedAssignment : null;
  const isPreviewing = activePreviewRole !== null;

  // Actual React state clearing: On logout, user change, or loss of Developer identity
  useEffect(() => {
    if (!isAvailable || (user?.id && previewOwnerId && user.id !== previewOwnerId)) {
      if (previewRole !== null) setPreviewRole(null);
      if (scopedAssignment !== null) setScopedAssignment(null);
      if (previewOwnerId !== null) setPreviewOwnerId(null);
      setRolePreviewMutationBarrier(false);
    }
  }, [isAvailable, user?.id, previewRole, scopedAssignment, previewOwnerId]);

  // Synchronize Mutation Barrier: blocks state-changing API operations while previewing
  useEffect(() => {
    if (activePreviewRole !== null) {
      setRolePreviewMutationBarrier(true);
    } else {
      setRolePreviewMutationBarrier(false);
    }

    return () => {
      setRolePreviewMutationBarrier(false);
    };
  }, [activePreviewRole]);

  const startPreview = useCallback(
    (role: PreviewRole, scoped?: ScopedAssignmentPreview | null): boolean => {
      // Invariant: Non-developer can never activate role preview
      if (!user || user.role !== 'developer') {
        return false;
      }

      // Group-Scoped Assistant Lecturer Validation
      if (role === 'assistant_lecturer') {
        if (!scoped || !scoped.groupId || !scoped.groupId.trim()) {
          // Cannot activate assistant_lecturer preview without a valid existing group context
          return false;
        }
        setScopedAssignment(scoped);
        setPreviewRole('assistant_lecturer');
        setPreviewOwnerId(user.id);
        return true;
      }

      // Global Role Preview
      setScopedAssignment(null);
      setPreviewRole(role);
      setPreviewOwnerId(user.id);
      return true;
    },
    [user]
  );

  const stopPreview = useCallback(() => {
    setPreviewRole(null);
    setScopedAssignment(null);
    setPreviewOwnerId(null);
    setRolePreviewMutationBarrier(false);
  }, []);

  // Derive presentation role for UI rendering
  const effectiveUiRole: UserRole = useMemo(() => {
    if (!activePreviewRole) {
      return user?.role ?? 'user';
    }
    if (activePreviewRole === 'assistant_lecturer') {
      // Scoped assistant lecturer uses lecturer UI base layout
      return 'lecturer';
    }
    return activePreviewRole;
  }, [activePreviewRole, user?.role]);

  // Formatted Arabic label for banner and UI chips
  const previewLabelAr = useMemo(() => {
    if (!activePreviewRole) return null;
    if (activePreviewRole === 'assistant_lecturer' && activeScopedAssignment) {
      return `مدرس مساعد (تكليف بمجموعة: ${activeScopedAssignment.groupName})`;
    }
    return PREVIEW_ROLE_LABELS_AR[activePreviewRole] || activePreviewRole;
  }, [activePreviewRole, activeScopedAssignment]);

  const value = useMemo<RolePreviewContextValue>(
    () => ({
      previewRole: activePreviewRole,
      effectiveUiRole,
      isPreviewing,
      scopedAssignmentPreview: activeScopedAssignment,
      isAvailable,
      startPreview,
      stopPreview,
      previewLabelAr,
    }),
    [
      activePreviewRole,
      effectiveUiRole,
      isPreviewing,
      activeScopedAssignment,
      isAvailable,
      startPreview,
      stopPreview,
      previewLabelAr,
    ]
  );

  return <RolePreviewContext.Provider value={value}>{children}</RolePreviewContext.Provider>;
};

/**
 * Hook to consume RolePreviewContext with safe fallback for components rendered outside the provider.
 */
export function useRolePreview(): RolePreviewContextValue {
  const context = useContext(RolePreviewContext);
  if (!context) {
    return {
      previewRole: null,
      effectiveUiRole: 'user',
      isPreviewing: false,
      scopedAssignmentPreview: null,
      isAvailable: false,
      startPreview: () => false,
      stopPreview: () => { },
      previewLabelAr: null,
    };
  }
  return context;
}

export default RolePreviewContext;

