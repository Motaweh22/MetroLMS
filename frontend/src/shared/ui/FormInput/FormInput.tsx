import React from 'react';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  startIcon?: SemanticIconName;
  endIcon?: SemanticIconName;
  onEndIconClick?: () => void;
  endIconAriaLabel?: string;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      helperText,
      error,
      startIcon,
      endIcon,
      onEndIconClick,
      endIconAriaLabel,
      disabled,
      required,
      id,
      className = '',
      ...rest
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5 w-full text-right">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-text select-none">
            {label}
            {required && <span className="text-danger-dark ms-1" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute start-3 flex items-center pointer-events-none text-text-muted">
              <Icon name={startIcon} size="md" />
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            className={`w-full bg-bg text-text text-sm rounded-md border py-2 transition-all duration-150 outline-none ${
              startIcon ? 'ps-9' : 'ps-3'
            } ${endIcon ? 'pe-9' : 'pe-3'} ${
              hasError
                ? 'border-danger-dark focus:border-danger-dark focus:ring-1 focus:ring-danger-dark'
                : 'border-border focus:border-primary-dark focus:ring-1 focus:ring-primary-dark'
            } ${disabled ? 'bg-bg-alt opacity-60 cursor-not-allowed' : ''} ${className}`}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={
              hasError && inputId
                ? `${inputId}-error`
                : helperText && inputId
                ? `${inputId}-helper`
                : undefined
            }
            {...rest}
          />

          {endIcon &&
            (onEndIconClick ? (
              <button
                type="button"
                onClick={onEndIconClick}
                aria-label={endIconAriaLabel || 'إجراء الحقل'}
                className="absolute end-2.5 p-1 rounded hover:bg-neutral-light text-text-muted hover:text-text transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <Icon name={endIcon} size="md" />
              </button>
            ) : (
              <div className="absolute end-3 flex items-center pointer-events-none text-text-muted">
                <Icon name={endIcon} size="md" />
              </div>
            ))}
        </div>

        {hasError ? (
          <span
            id={inputId ? `${inputId}-error` : undefined}
            className="text-xs font-medium text-danger-dark flex items-center gap-1"
          >
            <Icon name="alert" size="sm" />
            {error}
          </span>
        ) : helperText ? (
          <span
            id={inputId ? `${inputId}-helper` : undefined}
            className="text-xs text-text-muted"
          >
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
