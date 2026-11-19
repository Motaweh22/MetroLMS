import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import type { ManagedUserDTO } from '@/core/user-management/types';
import { AddUserForm } from './AddUserForm';

export interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (newUser: ManagedUserDTO) => void;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="إضافة مستخدم جديد إلى دليل النظام"
      size="lg"
      dataTestId="add-user-modal"
    >
      <AddUserForm
        isActive={isOpen}
        variant="modal"
        onCancel={handleClose}
        onSubmittingChange={setIsSubmitting}
        onUserCreated={(newUser) => {
          onUserCreated(newUser);
          onClose();
        }}
      />
    </Modal>
  );
};
