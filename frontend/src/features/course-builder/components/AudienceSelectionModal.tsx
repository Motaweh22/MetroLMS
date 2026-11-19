import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface AudienceOptionItem {
  id: number;
  label: string;
  subtitle?: string;
}

export interface AudienceSelectionModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  items: AudienceOptionItem[];
  selectedIds: number[];
  onSave: (nextIds: number[]) => void;
  onClose: () => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  dataTestId?: string;
}

export const AudienceSelectionModal: React.FC<AudienceSelectionModalProps> = ({
  isOpen,
  title,
  description,
  items,
  selectedIds,
  onSave,
  onClose,
  searchPlaceholder = 'بحث في القائمة...',
  emptyMessage = 'لا توجد عناصر مطابقة للبحث.',
  dataTestId = 'audience-selection-modal',
}) => {
  const [draftIds, setDraftIds] = useState<number[]>(selectedIds);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDraftIds(selectedIds);
      setSearchQuery('');
    }
  }, [isOpen, selectedIds]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const toggleItem = (id: number) => {
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredItems.map((i) => i.id);
    setDraftIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleClearAll = () => {
    setDraftIds([]);
  };

  const handleConfirm = () => {
    onSave(draftIds);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" dataTestId={dataTestId}>
      <div className="space-y-4 text-right" dir="rtl">
        {description && <p className="text-xs text-text-muted">{description}</p>}

        {items.length > 5 && (
          <div className="relative">
            <label htmlFor={`${dataTestId}-search`} className="sr-only">
              {searchPlaceholder}
            </label>
            <Icon
              name="search"
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              id={`${dataTestId}-search`}
              data-testid={`${dataTestId}-search`}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-bg text-text text-sm rounded-lg border border-border focus:border-primary py-2 pr-9 pl-3 outline-none transition-colors"
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-text-muted pb-1 border-b border-border/60">
          <span className="font-semibold text-text">
            المحدد: <span className="text-primary">{draftIds.length}</span> من {items.length}
          </span>
          <div className="flex items-center gap-3">
            {filteredItems.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-primary hover:underline font-medium"
              >
                تحديد الكل
              </button>
            )}
            {draftIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-danger hover:underline font-medium"
              >
                مسح التحديد
              </button>
            )}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">{emptyMessage}</div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = draftIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  data-testid={`${dataTestId}-option-${item.id}`}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full text-right px-3 py-2.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'bg-surface border-border text-text hover:bg-bg'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      aria-hidden="true"
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-primary border-primary text-white'
                          : 'bg-bg border-border'
                      }`}
                    >
                      {isSelected && <Icon name="check" size={12} />}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.subtitle && (
                    <span className="text-[11px] text-text-muted shrink-0">{item.subtitle}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            data-testid={`${dataTestId}-cancel-btn`}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            data-testid={`${dataTestId}-save-btn`}
          >
            <Icon name="check" size="sm" className="ml-1.5" />
            حفظ الاختيارات
          </Button>
        </div>
      </div>
    </Modal>
  );
};
