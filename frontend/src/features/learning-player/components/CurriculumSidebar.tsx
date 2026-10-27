import React, { useState } from 'react';
import { Icon } from '@/shared/ui/Icon/Icon';
import type { CourseChapter } from '@/core/courses/types';
import type { EnrichedChapterItem } from '../types';

export interface CurriculumSidebarProps {
  chapters: CourseChapter[];
  flatItems: EnrichedChapterItem[];
  currentItemId: string | null;
  onSelectItem: (itemId: string) => void;
}

export const CurriculumSidebar: React.FC<CurriculumSidebarProps> = ({
  chapters,
  flatItems,
  currentItemId,
  onSelectItem,
}) => {
  // Store expanded chapter IDs; default all expanded
  const [expandedChapterIds, setExpandedChapterIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    chapters.forEach((ch) => {
      initial[ch.id] = true;
    });
    return initial;
  });

  const toggleChapter = (chapterId: string) => {
    setExpandedChapterIds((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  return (
    <aside className="curriculum-sidebar-container" aria-label="فهرس محتويات الدورة">
      <div className="curriculum-sidebar-header">
        <h2>محتوى الدورة</h2>
        <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
          {flatItems.filter((it) => it.isCompleted).length} من {flatItems.length} درس مكتمل
        </span>
      </div>

      <div className="curriculum-chapters-list">
        {chapters.map((chapter) => {
          const chapterItems = flatItems.filter((it) => it.chapterId === chapter.id);
          const completedCount = chapterItems.filter((it) => it.isCompleted).length;
          const isExpanded = expandedChapterIds[chapter.id] !== false;

          return (
            <div key={chapter.id} className="curriculum-chapter-item">
              <button
                type="button"
                className="chapter-accordion-header"
                onClick={() => toggleChapter(chapter.id)}
                aria-expanded={isExpanded}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon
                    name={isExpanded ? 'chevronDown' : 'chevronLeft'}
                    size="sm"
                    className="text-muted"
                  />
                  <span>{chapter.title}</span>
                </div>

                <span className="chapter-ratio-badge">
                  {completedCount}/{chapterItems.length} مكتمل
                </span>
              </button>

              {isExpanded && (
                <div className="chapter-lessons-list" role="list">
                  {chapterItems.map((item) => {
                    const isActive = item.id === currentItemId;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="listitem"
                        className={`lesson-list-item-btn ${isActive ? 'active' : ''} ${
                          item.isLocked ? 'locked' : ''
                        }`}
                        onClick={() => onSelectItem(item.id)}
                        disabled={item.isLocked}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <div className="lesson-title-wrap">
                          {item.isCompleted ? (
                            <Icon name="checkCircle" size="sm" className="text-success-light" />
                          ) : item.type === 'video' ? (
                            <Icon name="video" size="sm" className="text-primary-light" />
                          ) : item.type === 'image' ? (
                            <Icon name="info" size="sm" className="text-success-light" />
                          ) : item.type === 'zip' ? (
                            <Icon name="download" size="sm" className="text-warning-light" />
                          ) : (
                            <Icon name="fileText" size="sm" className="text-warning-light" />
                          )}

                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </span>
                        </div>

                        <div
                          className="lesson-meta-wrap"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            color: '#94A3B8',
                            flexShrink: 0,
                          }}
                          data-testid="lesson-meta-area"
                        >
                          {item.isLocked && (
                            <span
                              className="inline-flex items-center text-muted"
                              title="محتوى مقفل — يتطلب إكمال الدرس السابق"
                              aria-label="محتوى مقفل"
                              data-testid="lesson-lock-indicator"
                            >
                              <Icon name="lock" size="sm" />
                            </span>
                          )}
                          {item.duration && <span>{item.duration}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
