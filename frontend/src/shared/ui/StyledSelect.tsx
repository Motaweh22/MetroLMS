import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/shared/ui/Icon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface StyledSelectProps {
  id?: string;
  dataTestId?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  hasError?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  buttonClassName?: string;
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'text-xs py-1.5 px-2.5 rounded-lg',
  sm: 'text-xs py-2 px-3 rounded-xl',
  md: 'text-sm py-2 px-3 rounded-lg',
};

export const StyledSelect: React.FC<StyledSelectProps> = ({
  id,
  dataTestId,
  ariaLabel,
  value,
  onChange,
  options,
  placeholder = 'اختر...',
  emptyMessage = 'لا توجد خيارات متاحة',
  disabled = false,
  hasError = false,
  size = 'md',
  className = '',
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const updateCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const menuWidth = Math.max(rect.width, 160);
    const clampedLeft = Math.max(8, Math.min(rect.left, viewportW - menuWidth - 8));

    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      setCoords({
        bottom: viewportH - rect.top + 4,
        left: clampedLeft,
        width: menuWidth,
        maxHeight: Math.min(240, Math.max(120, spaceAbove)),
      });
    } else {
      setCoords({
        top: rect.bottom + 4,
        left: clampedLeft,
        width: menuWidth,
        maxHeight: Math.min(240, Math.max(120, spaceBelow)),
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (event: Event) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) {
        return;
      }
      updateCoords();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  const selectedOption = options.find((opt) => opt.value === value);

  const menu =
    isOpen && coords && typeof document !== 'undefined'
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            dir="rtl"
            style={{
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              zIndex: 9999,
            }}
            className="overflow-y-auto rounded-xl border border-border bg-surface shadow-xl py-1 text-sm"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-muted text-center">{emptyMessage}</li>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={`${opt.value}__${opt.label}`} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-right px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors ${
                        opt.disabled
                          ? 'text-text-muted/50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-primary/10 text-primary font-semibold cursor-pointer'
                          : 'text-text hover:bg-bg cursor-pointer'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Icon name="check" size="sm" className="text-primary shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        id={id}
        data-testid={dataTestId}
        aria-label={ariaLabel}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
        className={`w-full bg-bg border transition-colors outline-none flex items-center justify-between gap-2 text-right ${
          SIZE_CLASSES[size]
        } ${
          hasError
            ? 'border-danger focus:border-danger ring-1 ring-danger'
            : isOpen
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border focus:border-primary hover:border-primary/50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${buttonClassName}`}
      >
        <span className={`truncate ${selectedOption ? 'text-text' : 'text-text-muted'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <Icon
          name="chevronDown"
          size="sm"
          className={`text-text-muted shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>
      {menu}
    </div>
  );
};

export default StyledSelect;
