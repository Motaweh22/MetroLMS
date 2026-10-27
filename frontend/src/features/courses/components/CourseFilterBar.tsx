import React, { useState, useRef, useEffect } from 'react';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import type { CourseLevel } from '@/core/courses/types';

export interface CourseFilterBarProps {
  search?: string;
  onSearchChange: (query: string) => void;
  selectedLevel: CourseLevel | 'all';
  onLevelChange: (level: CourseLevel | 'all') => void;
  sortBy: 'rating' | 'enrollment' | 'newest';
  onSortChange: (sort: 'rating' | 'enrollment' | 'newest') => void;
  totalCount: number;
  filteredCount?: number;
  onResetFilters?: () => void;
}

const LEVEL_OPTIONS: Array<{ id: CourseLevel | 'all'; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'مبتدئ', label: 'مبتدئ' },
  { id: 'متوسط', label: 'متوسط' },
  { id: 'متقدم', label: 'متقدم' },
];

interface SortOptionItem {
  value: 'newest' | 'rating' | 'enrollment';
  label: string;
  icon: SemanticIconName;
}

const SORT_OPTIONS: SortOptionItem[] = [
  { value: 'newest', label: 'الأحدث', icon: 'clock' },
  { value: 'rating', label: 'الأعلى تقييمًا', icon: 'star' },
  { value: 'enrollment', label: 'الأكثر تسجيلاً', icon: 'users' },
];

export const CourseFilterBar: React.FC<CourseFilterBarProps> = ({
  search = '',
  onSearchChange,
  selectedLevel,
  onLevelChange,
  sortBy,
  onSortChange,
  totalCount,
  filteredCount = totalCount,
  onResetFilters,
}) => {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const sortContainerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isFiltered = (search || '').trim().length > 0 || selectedLevel !== 'all';
  const currentSortOption = SORT_OPTIONS.find((opt) => opt.value === sortBy) || SORT_OPTIONS[0];

  useEffect(() => {
    if (isSortOpen) {
      const idx = SORT_OPTIONS.findIndex((opt) => opt.value === sortBy);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isSortOpen, sortBy]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (sortContainerRef.current && !sortContainerRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isSortOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSortOpen]);

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSortOpen) {
        setIsSortOpen(true);
      } else {
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setHighlightedIndex((prev) => (prev + delta + SORT_OPTIONS.length) % SORT_OPTIONS.length);
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (isSortOpen && highlightedIndex >= 0 && highlightedIndex < SORT_OPTIONS.length) {
        e.preventDefault();
        onSortChange(SORT_OPTIONS[highlightedIndex].value);
        setIsSortOpen(false);
      }
    }
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input Box */}
        <div className="relative flex-1 max-w-md">
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث عن كورس أو محاضر..."
            aria-label="البحث في الدورات التدريبية"
            className="w-full pl-9 pr-10 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
            <Icon name="search" size="sm" />
          </div>
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="مسح نص البحث"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1"
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>

        {/* Level Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" role="tablist" aria-label="تصفية حسب المستوى">
          {LEVEL_OPTIONS.map((opt) => {
            const isActive = selectedLevel === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onLevelChange(opt.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-primary-dark text-white shadow-xs'
                    : 'bg-surface hover:bg-neutral-light text-text-muted border border-border'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar: Counter & Sorting */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/60 text-xs">
        <div className="text-text-muted font-medium">
          <span>عرض </span>
          <strong className="text-primary-dark font-bold">{filteredCount}</strong>
          <span> كورس من أصل </span>
          <strong className="text-text font-bold">{totalCount}</strong>
          {isFiltered && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="mr-3 text-primary hover:text-primary-dark underline cursor-pointer"
            >
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>

        {/* Sort Dropdown with Centralized Design-System Icons */}
        <div className="flex items-center gap-2" ref={sortContainerRef}>
          <span id="course-sort-label" className="text-text-muted shrink-0 font-medium">
            ترتيب حسب:
          </span>

          <div className="relative">
            <button
              ref={buttonRef}
              id="course-sort-button"
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={isSortOpen}
              aria-labelledby="course-sort-label course-sort-button"
              aria-controls="course-sort-listbox"
              aria-activedescendant={
                isSortOpen && highlightedIndex >= 0
                  ? `course-sort-option-${SORT_OPTIONS[highlightedIndex].value}`
                  : undefined
              }
              onKeyDown={handleButtonKeyDown}
              onClick={() => setIsSortOpen((prev) => !prev)}
              className="inline-flex items-center justify-between gap-2.5 bg-surface border border-border hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md px-3 py-1.5 text-xs text-text font-semibold cursor-pointer transition-colors min-w-[155px]"
            >
              <div className="flex items-center gap-2">
                <Icon
                  name={currentSortOption.icon}
                  size="sm"
                  className={currentSortOption.value === 'rating' ? 'text-amber-500 fill-amber-500 shrink-0' : 'text-primary-dark shrink-0'}
                />
                <span>{currentSortOption.label}</span>
              </div>
              <Icon
                name="chevronDown"
                size="sm"
                className={`text-text-muted shrink-0 transition-transform duration-200 ${isSortOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu List */}
            {isSortOpen && (
              <ul
                id="course-sort-listbox"
                role="listbox"
                aria-labelledby="course-sort-label"
                className="absolute left-0 top-full mt-1.5 w-full min-w-[165px] bg-surface border border-border rounded-lg shadow-lg py-1 z-30 overflow-hidden"
              >
                {SORT_OPTIONS.map((opt, idx) => {
                  const isSelected = opt.value === sortBy;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <li
                      key={opt.value}
                      id={`course-sort-option-${opt.value}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSortChange(opt.value);
                        setIsSortOpen(false);
                        buttonRef.current?.focus();
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors cursor-pointer text-start ${
                        isSelected
                          ? 'bg-primary-light text-primary-dark'
                          : isHighlighted
                          ? 'bg-neutral-light text-text'
                          : 'text-text hover:bg-neutral-light'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          name={opt.icon}
                          size="sm"
                          className={
                            opt.value === 'rating'
                              ? 'text-amber-500 fill-amber-500 shrink-0'
                              : isSelected
                              ? 'text-primary-dark shrink-0'
                              : 'text-text-muted shrink-0'
                          }
                        />
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && (
                        <Icon name="check" size="sm" className="text-primary-dark shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseFilterBar;
