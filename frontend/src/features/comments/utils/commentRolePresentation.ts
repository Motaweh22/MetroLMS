import type { CourseComment } from '@/core/comments/types';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';
import type { BadgeVariant } from '@/shared/ui/Badge';

export interface CommentRoleMeta {
  isOwnComment: boolean;
  roleBadgeLabel: string | null;
  roleBadgeVariant: BadgeVariant;
  moderationLabel: string;
}

export interface CommentCardAppearance extends CommentRoleMeta {
  cardClass: string;
  avatarClass: string;
}

export function resolveCommentRoleMeta(
  comment: CourseComment,
  currentUserId?: string,
  courseCoLecturers?: string[]
): CommentRoleMeta {
  const isOwnComment = Boolean(
    currentUserId &&
      comment.userId &&
      String(currentUserId).toLowerCase() === String(comment.userId).toLowerCase()
  );

  const rawRole = String(comment.userRole || 'user');
  const isCoLecturer = Boolean(
    comment.isCourseAssistant ||
      rawRole === 'assistant_lecturer' ||
      (comment.userId &&
        courseCoLecturers?.some(
          (id) => String(id).toLowerCase() === String(comment.userId).toLowerCase()
        ))
  );
  const isAdminStaff = rawRole === 'admin' || rawRole === 'super_admin' || rawRole === 'developer';
  const isAssistantAdmin = rawRole === 'assistant_admin';
  const isLecturerAuthor = !isCoLecturer && Boolean(comment.isLecturer || rawRole === 'lecturer');

  if (isAdminStaff) {
    const label = rawRole === 'super_admin' ? 'مدير النظام الأعلى' : 'مدير النظام';
    return {
      isOwnComment,
      roleBadgeLabel: label,
      roleBadgeVariant: 'danger',
      moderationLabel: label,
    };
  }

  if (isAssistantAdmin) {
    return {
      isOwnComment,
      roleBadgeLabel: 'مدير مساعد',
      roleBadgeVariant: 'warning',
      moderationLabel: 'مدير مساعد',
    };
  }

  if (isCoLecturer) {
    return {
      isOwnComment,
      roleBadgeLabel: 'محاضر مساعد',
      roleBadgeVariant: 'info',
      moderationLabel: 'محاضر مساعد',
    };
  }

  if (isLecturerAuthor) {
    return {
      isOwnComment,
      roleBadgeLabel: 'محاضر',
      roleBadgeVariant: 'primary',
      moderationLabel: 'محاضر',
    };
  }

  return {
    isOwnComment,
    roleBadgeLabel: null,
    roleBadgeVariant: 'neutral',
    moderationLabel:
      ROLE_CANONICAL_LABELS_AR[rawRole as keyof typeof ROLE_CANONICAL_LABELS_AR] || 'متدرب',
  };
}

export function getCommentCardAppearance(
  comment: CourseComment,
  currentUserId: string | undefined,
  courseCoLecturers: string[] | undefined,
  isDark: boolean
): CommentCardAppearance {
  const meta = resolveCommentRoleMeta(comment, currentUserId, courseCoLecturers);
  const ownRing = meta.isOwnComment
    ? isDark
      ? 'ring-2 ring-emerald-400/45'
      : 'ring-2 ring-emerald-500/35'
    : '';

  if (meta.roleBadgeVariant === 'danger') {
    return {
      ...meta,
      cardClass: `${
        isDark
          ? 'border-rose-400/40 bg-rose-500/[0.08]'
          : 'border-danger/45 bg-danger/[0.04]'
      } ${ownRing}`.trim(),
      avatarClass: 'bg-danger text-white',
    };
  }

  if (meta.roleBadgeVariant === 'warning') {
    return {
      ...meta,
      cardClass: `${
        isDark
          ? 'border-amber-400/40 bg-amber-500/[0.08]'
          : 'border-warning-dark/45 bg-warning/[0.06]'
      } ${ownRing}`.trim(),
      avatarClass: 'bg-warning-dark text-white',
    };
  }

  if (meta.roleBadgeVariant === 'info') {
    return {
      ...meta,
      cardClass: `${
        isDark
          ? 'border-violet-400/45 bg-violet-500/[0.10]'
          : 'border-violet-500/45 bg-violet-500/[0.05]'
      } ${ownRing}`.trim(),
      avatarClass: 'bg-violet-600 text-white',
    };
  }

  if (meta.roleBadgeVariant === 'primary') {
    return {
      ...meta,
      cardClass: `${
        isDark
          ? 'border-sky-400/40 bg-sky-500/[0.08]'
          : 'border-primary/45 bg-primary/[0.04]'
      } ${ownRing}`.trim(),
      avatarClass: 'bg-primary text-white',
    };
  }

  if (meta.isOwnComment) {
    return {
      ...meta,
      cardClass: isDark
        ? 'border-emerald-400/50 bg-emerald-500/[0.10] ring-1 ring-emerald-400/30'
        : 'border-emerald-500/55 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20',
      avatarClass: 'bg-emerald-600 text-white',
    };
  }

  return {
    ...meta,
    cardClass: isDark
      ? 'bg-white/[0.03] border-white/10 hover:border-white/20'
      : 'bg-surface border-border hover:border-border/80',
    avatarClass: isDark
      ? 'bg-white/10 text-slate-100 border border-white/15'
      : 'bg-neutral-light text-text-heading border border-border',
  };
}
