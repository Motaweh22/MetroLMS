import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type { CourseComment } from '@/core/comments/types';
import { COMMENT_REPORT_REASONS_AR } from '@/core/comments/types';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';
import type { Course } from '@/core/courses/types';

export interface AllCommentsTableProps {
  comments: CourseComment[];
  courses: Course[];
  isLoading: boolean;
  onDelete: (comment: CourseComment) => void;
  onToggleCourseComments: (courseId: string, currentEnabled: boolean) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCourseFilter: string;
  onCourseFilterChange: (cid: string) => void;
  isActionInProgress?: boolean;
}

export const AllCommentsTable: React.FC<AllCommentsTableProps> = ({
  comments,
  courses,
  isLoading,
  onDelete,
  onToggleCourseComments,
  searchQuery,
  onSearchChange,
  selectedCourseFilter,
  onCourseFilterChange,
  isActionInProgress = false,
}) => {
  // Map of courses for quick discussion policy lookup
  const courseDiscussionMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    courses.forEach((c) => {
      map.set(c.id.toLowerCase(), c.commentsEnabled !== false);
    });
    return map;
  }, [courses]);

  return (
    <div className="space-y-4 text-right" data-testid="all-comments-directory">
      {/* Search and Filters Bar */}
      <div className="bg-surface border border-border rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-text-muted">
            <Icon name="search" size="sm" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث باسم المعلق، الكورس، أو نص التعليق..."
            className="w-full pr-10 pl-4 py-2 border border-border rounded-xl text-xs sm:text-sm bg-bg-alt/50 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            data-testid="comments-search-input"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedCourseFilter}
            onChange={(e) => onCourseFilterChange(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-xs sm:text-sm bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            data-testid="course-filter-select"
          >
            <option value="all">كافة المقررات التدريبية</option>
            {courses.map((crs) => (
              <option key={crs.id} value={crs.id}>
                {crs.title} ({crs.id})
              </option>
            ))}
          </select>

          {(searchQuery || selectedCourseFilter !== 'all') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onSearchChange('');
                onCourseFilterChange('all');
              }}
              data-testid="reset-filters-btn"
            >
              <Icon name="rotateCcw" size="sm" className="ml-1" />
              إعادة الضبط
            </Button>
          )}
        </div>
      </div>

      {/* Comments Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm" data-testid="all-comments-table">
            <thead>
              <tr className="bg-bg-alt/70 border-b border-border text-xs font-semibold text-text-muted select-none">
                <th scope="col" className="py-3.5 px-4 font-bold">المقرر التدريبي وحالة النقاش</th>
                <th scope="col" className="py-3.5 px-4 font-bold">المعلق</th>
                <th scope="col" className="py-3.5 px-4 font-bold">نص التعليق</th>
                <th scope="col" className="py-3.5 px-4 font-bold">التاريخ</th>
                <th scope="col" className="py-3.5 px-4 font-bold text-center">حالة البلاغ</th>
                <th scope="col" className="py-3.5 px-4 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="refresh" size="lg" className="animate-spin text-primary" />
                      <span>جاري تحميل دليل التعليقات...</span>
                    </div>
                  </td>
                </tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted text-xs" data-testid="all-comments-empty">
                    <Icon name="messageSquare" size="lg" className="mx-auto text-text-muted mb-2 opacity-40" />
                    <span>لا توجد تعليقات مطابقة لمعايير البحث والتصفية</span>
                  </td>
                </tr>
              ) : (
                comments.map((comment) => {
                  const roleLabel =
                    ROLE_CANONICAL_LABELS_AR[comment.userRole as keyof typeof ROLE_CANONICAL_LABELS_AR] ||
                    comment.userRole ||
                    'متدرب';

                  const isCommentsEnabled =
                    courseDiscussionMap.get(comment.courseId.toLowerCase()) ??
                    comment.commentsEnabled ??
                    true;

                  const reportReasonLabel =
                    COMMENT_REPORT_REASONS_AR[comment.reportReason as keyof typeof COMMENT_REPORT_REASONS_AR] ||
                    comment.reportReasonLabelAr ||
                    comment.reportReason;

                  const formattedDate = comment.createdAt
                    ? new Date(comment.createdAt).toLocaleDateString('ar-EG')
                    : comment.time || '-';

                  return (
                    <tr
                      key={comment.id}
                      className="hover:bg-bg/60 transition-colors"
                      data-testid={`comment-row-${comment.id}`}
                    >
                      {/* Course Title and Discussion Policy Toggle */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-semibold text-text">{comment.courseTitle}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => onToggleCourseComments(comment.courseId, isCommentsEnabled)}
                            disabled={isActionInProgress}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all ${
                              isCommentsEnabled
                                ? 'bg-success-light/40 text-success border-success/30 hover:bg-success-light'
                                : 'bg-danger-light/40 text-danger border-danger/30 hover:bg-danger-light'
                            }`}
                            title={`انقر لتعديل سياسة نقاش المقرر (${isCommentsEnabled ? 'إغلاق النقاش' : 'تفعيل النقاش'})`}
                            data-testid={`toggle-comments-btn-${comment.courseId}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isCommentsEnabled ? 'bg-success' : 'bg-danger'
                              }`}
                            />
                            {isCommentsEnabled ? 'التعليقات مفعّلة' : 'التعليقات مغلقة'}
                          </button>
                        </div>
                      </td>

                      {/* Comment Author */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-text">{comment.userName}</div>
                        <Badge variant="neutral" size="sm" className="mt-0.5">
                          {roleLabel}
                        </Badge>
                      </td>

                      {/* Comment Snippet */}
                      <td className="py-3.5 px-4 text-xs text-text max-w-xs sm:max-w-md">
                        <div
                          className="truncate leading-relaxed select-text"
                          title={comment.text}
                          data-testid={`comment-snippet-${comment.id}`}
                        >
                          {comment.text}
                        </div>
                      </td>

                      {/* Creation Date */}
                      <td className="py-3.5 px-4 font-mono text-xs text-text-muted whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Report Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {comment.reported ? (
                          <Badge
                            variant="danger"
                            size="sm"
                            icon="alertCircle"
                            title={reportReasonLabel || undefined}
                            data-testid={`reported-status-${comment.id}`}
                          >
                            مُبلَّغ عنه {reportReasonLabel ? `(${reportReasonLabel})` : ''}
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm" icon="check" data-testid={`active-status-${comment.id}`}>
                            نشط
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => onDelete(comment)}
                          disabled={isActionInProgress}
                          data-testid={`delete-comment-table-btn-${comment.id}`}
                        >
                          <Icon name="trash" size="sm" className="ml-1" />
                          حذف التعليق
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
