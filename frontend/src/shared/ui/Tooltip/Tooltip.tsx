import React, { useState, useId, useRef, useEffect } from 'react';

export interface TooltipProps {
  content?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'center' | 'start' | 'end';
  wrapperClassName?: string;
  className?: string;
  testId?: string;
  isTriggerDisabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  disabled = false,
  position = 'top',
  align = 'center',
  wrapperClassName = '',
  className = '',
  testId = 'tooltip',
  isTriggerDisabled = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const shouldRender = Boolean(content && !disabled);

  const handleMouseEnter = () => {
    if (shouldRender) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (shouldRender) setIsOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Dismiss on Escape anywhere when tooltip is open (WCAG 2.1 SC 1.4.13)
  useEffect(() => {
    if (!isOpen) return;

    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', onGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', onGlobalKeyDown);
    };
  }, [isOpen]);

  // Position offset classes (places tooltip outside the trigger button without overlapping)
  const positionClasses = {
    top: 'bottom-full mb-2.5',
    bottom: 'top-full mt-2.5',
    left: 'right-full mr-2.5',
    right: 'left-full ml-2.5',
  }[position];

  // Alignment classes (start/end respect RTL direction)
  const alignClasses = {
    center:
      position === 'top' || position === 'bottom'
        ? 'left-1/2 -translate-x-1/2'
        : 'top-1/2 -translate-y-1/2',
    start: 'start-0',
    end: 'end-0',
  }[align];

  // Arrow position classes pointing towards the trigger
  const arrowPositionClasses = {
    center: 'left-1/2 -translate-x-1/2',
    start: 'start-6',
    end: 'end-6',
  }[align];

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-flex ${wrapperClassName}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      tabIndex={isTriggerDisabled && shouldRender ? 0 : undefined}
      aria-describedby={isOpen && shouldRender ? tooltipId : undefined}
      role={isTriggerDisabled && shouldRender ? 'region' : undefined}
      aria-label={isTriggerDisabled && typeof content === 'string' ? content : undefined}
    >
      {children}
      {isOpen && shouldRender && (
        <div
          role="tooltip"
          id={tooltipId}
          data-testid={testId}
          dir="rtl"
          className={`absolute z-50 pointer-events-none transition-opacity duration-150 ease-out ${positionClasses} ${alignClasses} ${className}`}
        >
          <div
            className="relative w-max bg-neutral-900/95 text-white text-xs leading-relaxed font-medium p-3 rounded-lg shadow-xl border border-neutral-700/80 text-right backdrop-blur-xs select-none break-words whitespace-normal"
            style={{
              maxWidth: 'min(320px, calc(100vw - 2rem))',
              minWidth: 'min(260px, calc(100vw - 2rem))',
            }}
          >
            {content}
            {position === 'top' && (
              <span
                className={`absolute top-full -mt-px w-0 h-0 border-x-4 border-t-4 border-b-0 border-solid border-x-transparent border-t-neutral-900/95 pointer-events-none ${arrowPositionClasses}`}
                aria-hidden="true"
              />
            )}
            {position === 'bottom' && (
              <span
                className={`absolute bottom-full -mb-px w-0 h-0 border-x-4 border-b-4 border-t-0 border-solid border-x-transparent border-b-neutral-900/95 pointer-events-none ${arrowPositionClasses}`}
                aria-hidden="true"
              />
            )}
            {position === 'left' && (
              <span
                className="absolute left-full -ml-px top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-l-4 border-r-0 border-solid border-y-transparent border-l-neutral-900/95 pointer-events-none"
                aria-hidden="true"
              />
            )}
            {position === 'right' && (
              <span
                className="absolute right-full -mr-px top-1/2 -translate-y-1/2 w-0 h-0 border-y-4 border-r-4 border-l-0 border-solid border-y-transparent border-r-neutral-900/95 pointer-events-none"
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
