import React, { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { CourseChapter } from '@/core/courses/types';

export interface CourseCurriculumProps {
  chapters: CourseChapter[];
}

export const CourseCurriculum: React.FC<CourseCurriculumProps> = ({ chapters }) => {
  // First chapter open by default
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({
    [chapters[0]?.id || '']: true,
  });

  const toggleChapter = (chapterId: string) => {
    setOpenChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const totalLessons = chapters.reduce((sum, ch) => sum + (ch.items?.length || 0), 0);

  return (
    <section className="space-y-4" aria-label="منهج الكورس">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="courses" size="md" className="text-primary-dark" />
          <h2 className="text-lg font-bold text-primary-dark">
            المنهج الدراسي ومحتويات الدورة
          </h2>
        </div>
        <span className="text-xs text-text-muted font-medium">
          {chapters.length} وحدات • {totalLessons} درساً
        </span>
      </div>

      <div className="cd-accordion space-y-3">
        {chapters.map((chapter) => {
          const isOpen = Boolean(openChapters[chapter.id]);
          return (
            <div
              key={chapter.id}
              className={`cd-chapter border border-border rounded-lg overflow-hidden bg-bg transition-all ${
                isOpen ? 'shadow-xs' : ''
              }`}
            >
              {/* Chapter Header */}
              <button
                type="button"
                className="cd-chapter-header w-full text-start flex items-center justify-between p-4 bg-surface hover:bg-neutral-light transition-colors cursor-pointer"
                onClick={() => toggleChapter(chapter.id)}
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/20 text-primary-dark text-xs font-bold flex items-center justify-center shrink-0">
                    {chapter.order}
                  </span>
                  <span className="cd-chapter-title font-bold text-sm text-text">
                    {chapter.title}
                  </span>
                </div>

                <div className="cd-chapter-meta flex items-center gap-3 text-xs text-text-muted">
                  <span>{chapter.items?.length || 0} عناصر</span>
                  <Icon
                    name={isOpen ? 'chevronUp' : 'chevronDown'}
                    size="sm"
                    className="shrink-0 transition-transform duration-200"
                  />
                </div>
              </button>

              {/* Chapter Items / Lessons */}
              {isOpen && (
                <div className="cd-chapter-items divide-y divide-border border-t border-border bg-bg">
                  {chapter.items?.map((item) => {
                    const isVideo = item.type === 'video';
                    return (
                      <div
                        key={item.id}
                        className="cd-item flex items-center justify-between p-3.5 px-5 text-sm hover:bg-neutral-light/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-1.5 rounded text-xs ${
                              isVideo
                                ? 'bg-primary-light text-primary-dark'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            <Icon name={isVideo ? 'video' : 'fileText'} size="sm" />
                          </div>
                          <span className="cd-item-title truncate font-medium text-text">
                            {item.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs text-text-muted">
                          <span>
                            {item.type === 'video'
                              ? item.duration || 'فيديو تعليمي'
                              : item.type === 'image'
                              ? 'مخطط توضيحي'
                              : 'مستند رقمي'}
                          </span>
                          <span title="يتطلب التسجيل للوصول" className="text-text-muted/60">
                            <Icon name="lock" size="sm" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default CourseCurriculum;
