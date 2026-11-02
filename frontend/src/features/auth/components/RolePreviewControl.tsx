/**
 * MetroLMS — Developer Role Preview Control Trigger
 *
 * Gated exclusively for actual authenticated Developer accounts.
 * Provides a button to open RolePreviewModal.
 */

import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useRolePreview } from '@/core/auth/useRolePreview';
import { RolePreviewModal } from './RolePreviewModal';

export const RolePreviewControl: React.FC = () => {
  const { user } = useAuth();
  const { isPreviewing, previewLabelAr } = useRolePreview();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Available exclusively to the actual authenticated Developer
  if (user?.role !== 'developer') {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={isPreviewing ? 'secondary' : 'outline'}
        size="sm"
        leftIcon="eye"
        onClick={() => setIsModalOpen(true)}
        className="text-xs sm:text-sm font-semibold"
        data-testid="navbar-role-preview-btn"
        aria-label="معاينة أدوار المنظومة بصرياً"
      >
        <span className="hidden xs:inline">
          {isPreviewing ? `معاينة: ${previewLabelAr}` : 'معاينة الأدوار'}
        </span>
        <span className="xs:hidden">المعاينة</span>
      </Button>

      <RolePreviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default RolePreviewControl;

