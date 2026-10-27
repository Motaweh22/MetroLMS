import React from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button, type ButtonVariant } from '@/shared/ui/Button';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'destructive';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  isConfirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
  testId?: string;
  'data-testid'?: string;
  confirmTestId?: string;
  cancelTestId?: string;
}

interface VariantConfig {
  textColor: string;
  iconBg: string;
  iconName: SemanticIconName;
  buttonVariant: ButtonVariant;
}

const variantStyles: Record<'danger' | 'warning' | 'info', VariantConfig> = {
  danger: {
    textColor: 'text-danger',
    iconBg: 'bg-danger/10',
    iconName: 'alertCircle',
    buttonVariant: 'destructive',
  },
  warning: {
    textColor: 'text-warning-dark',
    iconBg: 'bg-warning/10',
    iconName: 'alertCircle',
    buttonVariant: 'primary',
  },
  info: {
    textColor: 'text-info-dark',
    iconBg: 'bg-info/10',
    iconName: 'info',
    buttonVariant: 'primary',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger',
  isConfirming = false,
  onConfirm,
  onCancel,
  onClose,
  testId = 'confirm-dialog',
  'data-testid': testIdProp,
  confirmTestId = 'confirm-delete-btn',
  cancelTestId = 'confirm-cancel-btn',
}) => {
  const normalizedVariant: 'danger' | 'warning' | 'info' =
    variant === 'destructive' ? 'danger' : variant;
  const config = variantStyles[normalizedVariant] || variantStyles.danger;
  const handleCancelAction = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };
  const effectiveTestId = testIdProp || testId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isConfirming) {
          handleCancelAction();
        }
      }}
      size="md"
      hideHeader
      ariaLabelledBy="confirm-dialog-title"
      ariaDescribedBy="confirm-dialog-message"
      dataTestId={effectiveTestId}
    >
      <div className="space-y-4">
        <div className={`flex items-center gap-3 ${config.textColor}`}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${config.iconBg}`}
          >
            <Icon name={config.iconName} size="md" />
          </div>
          <h3
            id="confirm-dialog-title"
            data-testid="confirm-dialog-title"
            className="text-base font-bold text-text-heading"
          >
            {title}
          </h3>
        </div>

        <div
          id="confirm-dialog-message"
          data-testid="confirm-dialog-message"
          className="text-xs text-text-muted leading-relaxed"
        >
          {message}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isConfirming}
            data-testid={cancelTestId}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={config.buttonVariant}
            size="sm"
            onClick={onConfirm}
            isLoading={isConfirming}
            disabled={isConfirming}
            data-testid={confirmTestId}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
