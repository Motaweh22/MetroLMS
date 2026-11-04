/**
 * MetroLMS — Hook for Isolated Role Testing (`اختبار الصلاحيات`)
 *
 * Governance:
 * - Decision D-10: Complete round-trip launch and return flow.
 * - Stable Finding MFR-40: Strict separation from visual Role Preview.
 * - Invariant INV-D10-1: Strict Synthetic Persona Allowlist.
 * - Invariant INV-P5-4: Developer Origin Session Lifecycle.
 */

import { useCallback } from 'react';
import { useAuthContext } from './useAuthContext';
import { useRolePreview } from './useRolePreview';
import type { EmergencyContinuityProof } from './types';
import {
  getSyntheticTestPersonas,
  getPersonaRoleLabelAr,
  CANONICAL_DEVELOPER_ID,
  type SyntheticTestPersona,
} from './testPersonas';

export interface UseIsolatedSessionResult {
  /** Whether an isolated test session is currently active */
  isIsolatedSession: boolean;
  /** Active synthetic test persona (or null if in Developer session) */
  isolatedPersona: SyntheticTestPersona | null;
  /** Arabic role label of the active persona */
  personaRoleLabelAr: string | null;
  /** All registered synthetic personas available for testing in DEV mode */
  availablePersonas: SyntheticTestPersona[];
  /** Launch controlled isolated test session for an allowlisted synthetic persona */
  launchIsolatedTestSession: (personaId: string) => Promise<boolean>;
  /** Return to the exact preserved Developer session in a single transaction */
  returnToDeveloperSession: () => Promise<boolean>;
  /** Whether a launch or return transaction is in flight */
  isTransitioning: boolean;
  /** Any error encountered during session switching */
  error: string | null;
  /** Clear error message */
  clearError: () => void;
  /** Whether the launch action is permitted (only Developer can launch) */
  canLaunch: boolean;
  /** Whether the system is in an unauthenticated emergency state with valid memory-only continuity proof */
  isEmergencyState: boolean;
  /** Memory-only emergency continuity proof for the current AuthProvider lifecycle */
  emergencyProof: EmergencyContinuityProof | null;
}

export function useIsolatedSession(): UseIsolatedSessionResult {
  const {
    user,
    isIsolatedSession,
    isolatedPersona,
    launchIsolatedTestSession: authLaunch,
    returnToDeveloperSession: authReturn,
    isLoading,
    error,
    clearError,
    isEmergencyState,
    emergencyProof,
  } = useAuthContext();
  const { isPreviewing, stopPreview } = useRolePreview();

  const canLaunch = Boolean(
    user && user.role === 'developer' && user.id === CANONICAL_DEVELOPER_ID && !isIsolatedSession
  );

  const launchIsolatedTestSession = useCallback(
    async (personaId: string): Promise<boolean> => {
      // Step 3 constraint: Ensure current actor is not in Visual Role Preview
      if (isPreviewing) {
        stopPreview();
      }
      return authLaunch(personaId);
    },
    [authLaunch, isPreviewing, stopPreview]
  );

  const returnToDeveloperSession = useCallback(async (): Promise<boolean> => {
    return authReturn();
  }, [authReturn]);

  const personaRoleLabelAr = isolatedPersona ? getPersonaRoleLabelAr(isolatedPersona) : null;
  const availablePersonas = getSyntheticTestPersonas();

  return {
    isIsolatedSession,
    isolatedPersona,
    personaRoleLabelAr,
    availablePersonas,
    launchIsolatedTestSession,
    returnToDeveloperSession,
    isTransitioning: isLoading,
    error,
    clearError,
    canLaunch,
    isEmergencyState: Boolean(isEmergencyState),
    emergencyProof: emergencyProof ?? null,
  };
}

export default useIsolatedSession;

