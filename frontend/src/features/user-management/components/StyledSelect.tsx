import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';

export interface SelectOption {
  value: string;
  label: string;
}

export interface StyledSelectProps {
  id: string;
  dataTestId?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  hasError?: boolean;
}

export const StyledSelect: React.FC<StyledSelectProps> = ({
  id,
  dataTestId,
  value,
  onChange,
  options,
  placeholder = 'اختر...',
  emptyMessage = 'لا توجد خيارات متاحة',
  disabled = false,
  hasError = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        data-testid={dataTestId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
        className={`w-full bg-bg text-sm rounded-lg border py-2 px-3 transition-colors outline-none flex items-center justify-between gap-2 text-right ${
          hasError
            ? 'border-danger focus:border-danger ring-1 ring-danger'
            : isOpen
            ? 'border-primary ring-1 ring-primary/20'
            : 'border-border focus:border-primary'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={`truncate ${selectedOption ? 'text-text' : 'text-text-muted'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icon
          name="chevronDown"
          size="sm"
          className={`text-text-muted shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg py-1 text-sm"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-text-muted text-center">{emptyMessage}</li>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-right px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-text hover:bg-bg'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Icon name="check" size="sm" className="text-primary shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};
