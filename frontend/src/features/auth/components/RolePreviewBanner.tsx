/**
 * MetroLMS — Persistent Visual Role Preview Banner
 *
 * Authoritative Governance Reference:
 * - Roadmap Revision 5, Section 4: Developer Preview and Isolated Role Testing (D-10)
 * - Required Banner Arabic Text:
 *   "وضع معاينة الواجهة فقط: [الدور] — الصلاحيات البرمجية الحالية: المطور"
 * - Action: "إنهاء المعاينة"
 */

import React from 'react';
import { useRolePreview } from '@/core/auth/useRolePreview';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface RolePreviewBannerProps {
  onOpenSelector?: () => void;
}

export const RolePreviewBanner: React.FC<RolePreviewBannerProps> = ({ onOpenSelector }) => {
  const { isPreviewing, previewLabelAr, stopPreview } = useRolePreview();

  if (!isPreviewing) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="role-preview-persistent-banner"
      className="sticky top-0 z-40 w-full bg-amber-500 text-neutral-900 border-b border-amber-600 shadow-md px-3 sm:px-6 py-2 transition-all duration-200"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
        {/* Banner Message */}
        <div className="flex items-center gap-2 font-bold text-center sm:text-start">
          <Icon name="eye" size="sm" className="shrink-0 text-neutral-900" />
          <span data-testid="role-preview-banner-text">
            وضع معاينة الواجهة فقط: {previewLabelAr} — الصلاحيات البرمجية الحالية: المطور
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSelector && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon="refresh"
              onClick={onOpenSelector}
              className="text-xs bg-amber-600/30 text-neutral-900 border-neutral-900/40 hover:bg-amber-600/50 font-bold"
              data-testid="role-preview-change-btn"
            >
              تغيير الدور
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon="close"
            onClick={stopPreview}
            className="text-xs bg-neutral-900 text-white hover:bg-neutral-800 font-bold border-none shadow-xs"
            data-testid="exit-role-preview-btn"
          >
            إنهاء المعاينة
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default RolePreviewBanner;

