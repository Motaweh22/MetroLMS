import React, { useState } from 'react';
import { useIsolatedSession } from '@/core/auth/useIsolatedSession';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { authStorage, isValidDeveloperOriginSession } from '@/core/auth/authStorage';
import { getSyntheticTestPersona, getPersonaRoleLabelAr } from '@/core/auth/testPersonas';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';

/**
 * Isolated Role Test Session Persistent Banner
 *
 * Governance:
 * - Decision D-10: Persistent, distinguishable warning banner for isolated test sessions.
 * - WP-5.4.1 Acceptance Audit: Distinct UI separation between:
 *   1. Normal isolated-session banner (active authenticated persona + strict token format + valid origin)
 *   2. Emergency state banner (user === null + unexpired Developer origin + memory-only proof in current lifecycle)
 *   3. Transient network failure (user === null + no emergency proof -> neither banner renders)
 */
export const IsolatedSessionBanner: React.FC = () => {
  const {
    isIsolatedSession,
    isolatedPersona,
    personaRoleLabelAr,
    returnToDeveloperSession,
    isTransitioning,
    error,
    clearError,
    isEmergencyState,
  } = useIsolatedSession();
  const { user } = useAuth();

  const [isReturning, setIsReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // 1. Emergency State Banner (Acceptance Point 1 & 2):
  // Rendered ONLY when:
  // - AuthContext.user === null
  // - isEmergencyState === true (which strictly requires memory-only proof in current lifecycle,
  //   valid Developer origin snapshot, Date.now() < origin.developerExpiresAt, matching personaId,
  //   and exact originSnapshotFingerprint binding).
  if (user === null && isEmergencyState) {
    const origin = authStorage.getDeveloperOriginSession();
    const persona = origin ? getSyntheticTestPersona(origin.personaId) : null;
    const personaLabel = persona ? (personaRoleLabelAr || persona.role) : 'حساب اختباري';
    const personaDisplay = persona ? `${persona.name} (${personaLabel})` : 'حساب اختباري';

    return (
      <aside
        aria-label="شريط تنبيه طوارئ انتهاء جلسة الاختبار"
        data-testid="emergency-session-banner"
        className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-700 via-orange-800 to-amber-900 text-white shadow-md border-b-2 border-amber-500"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold min-w-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-950/80 text-amber-300 border border-amber-400/50 shrink-0">
                <Icon name="shield" size="sm" />
              </span>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span>
                  انتهت صلاحية جلسة الحساب الاختباري (<span className="underline decoration-amber-300 font-extrabold">{personaDisplay}</span>). الرجوع إلى جلسة المطور متاح لحالات الطوارئ.
                </span>
                {persona && (
                  <Badge variant="warning" className="text-[11px] font-bold bg-amber-950 text-amber-200 border border-amber-400/60">
                    {persona.id}
                  </Badge>
                )}
              </div>
            </div>
            {/* Note: returnFromExpiredPersonaSession action button is intentionally omitted in WP-5.4.1 (reserved for WP-5.4.4) */}
          </div>
        </div>
      </aside>
    );
  }

  // 2. Normal Isolated-Session Banner Condition (Acceptance Point 1):
  // Must satisfy ALL five strict criteria:
  // 1. Authenticated synthetic persona is currently active (user !== null)
  // 2. AuthContext.user matches canonical persona ID and role
  // 3. Active stored session matches identity
  // 4. Active token passes strict persona-token validation (^mock_jwt_${personaId}_(\d{13})$)
  // 5. Corresponding Developer origin snapshot is valid and unexpired (Date.now() < developerExpiresAt)
  // Note: isIsolatedSession === true by itself is insufficient.
  const storedSession = authStorage.getSession();
  const originSnapshot = authStorage.getDeveloperOriginSession();

  const isStoredSessionMatching = Boolean(
    storedSession &&
    user &&
    storedSession.user.id === user.id &&
    storedSession.user.role === user.role &&
    typeof storedSession.token === 'string'
  );

  const isTokenStrictlyValid = Boolean(
    user &&
    storedSession?.token &&
    new RegExp(`^mock_jwt_${user.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d{13})$`).test(storedSession.token)
  );

  const isOriginMatchingAndUnexpired = Boolean(
    user &&
    originSnapshot &&
    isValidDeveloperOriginSession(originSnapshot) &&
    Date.now() < originSnapshot.developerExpiresAt &&
    originSnapshot.personaId === user.id
  );

  const canRenderNormalBanner = Boolean(
    isIsolatedSession &&
    isolatedPersona &&
    user &&
    user.id === isolatedPersona.id &&
    user.role === isolatedPersona.role &&
    isStoredSessionMatching &&
    isTokenStrictlyValid &&
    isOriginMatchingAndUnexpired
  );

  if (!canRenderNormalBanner) {
    return null;
  }

  const handleReturn = async () => {
    setIsReturning(true);
    setReturnError(null);
    clearError();
    try {
      await returnToDeveloperSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل الرجوع إلى جلسة المطور.';
      setReturnError(msg);
    } finally {
      setIsReturning(false);
    }
  };

  const personaLabel = personaRoleLabelAr || isolatedPersona.role;
  const personaDisplay = `${isolatedPersona.name} (${personaLabel})`;

  return (
    <aside
      aria-label="شريط تنبيه جلسة اختبار الصلاحيات المعزولة"
      data-testid="isolated-session-banner"
      className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white shadow-md border-b-2 border-amber-400"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Banner message & Identity */}
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-900/60 text-amber-200 border border-amber-300/40 shrink-0">
              <Icon name="shield" size="sm" />
            </span>

            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span>
                جلسة اختبار صلاحيات معزولة (حساب اختباري: <span className="underline decoration-amber-300 font-extrabold">{personaDisplay}</span>)
              </span>

              <Badge variant="warning" className="text-[11px] font-bold bg-amber-900/80 text-amber-100 border border-amber-300/50">
                {isolatedPersona.id}
              </Badge>
            </div>
          </div>

          {/* Action button & Feedback */}
          <div className="flex items-center gap-2 shrink-0">
            {(returnError || error) && (
              <span className="text-xs bg-danger/80 text-white px-2 py-0.5 rounded font-medium">
                {returnError || error}
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              leftIcon="arrowRight"
              isLoading={isReturning || isTransitioning}
              disabled={isReturning || isTransitioning}
              onClick={handleReturn}
              data-testid="return-to-developer-btn"
              className="bg-white text-neutral-dark hover:bg-neutral-light border-white font-extrabold text-xs shadow-sm"
            >
              {isReturning ? 'جاري استعادة جلسة المطور...' : 'العودة إلى جلسة المطور'}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default IsolatedSessionBanner;

