import type { SemanticIconName } from '@/shared/ui/Icon';
import type { BadgeVariant } from '@/shared/ui/Badge';
import type { UserRole } from '@/core/auth/types';

export type NavItemStatus = 'implemented' | 'planned' | 'demo';

export interface NavItem {
  id: string;
  titleAr: string;
  titleEn: string;
  path: string;
  icon: SemanticIconName;
  status: NavItemStatus;
  badge?: string;
  badgeVariant?: BadgeVariant;
  plannedIncrement?: string;
  descriptionAr?: string;
  /** Explicit list of roles authorized to view this navigation link */
  allowedRoles?: UserRole[];
}

export interface NavSection {
  id: string;
  titleAr: string;
  titleEn: string;
  collapsible?: boolean;
  items: NavItem[];
}

export interface NavVisibilityContext {
  role?: UserRole | string | null;
  actualUserRole?: UserRole | string | null;
  isPreviewing?: boolean;
  previewRole?: string | null;
}

/**
 * Centrally Managed Navigation Registry
 * 
 * Strict Architectural Rule:
 * Navigation definitions are never scattered across components.
 * All shell components (Navbar, Desktop Sidebar, Mobile Drawer) consume
 * this authoritative configuration.
 * 
 * Unimplemented routes are explicitly tagged with `status: 'planned'`
 * and must not appear functional to avoid misleading users.
 */
export const NAVIGATION_SECTIONS: NavSection[] = [
  {
    id: 'primary',
    titleAr: 'الرئيسية',
    titleEn: 'Overview',
    items: [
      {
        id: 'dashboard',
        titleAr: 'لوحة المتابعة',
        titleEn: 'Dashboard',
        path: '/dashboard',
        icon: 'dashboard',
        status: 'implemented',
        descriptionAr: 'الواجهة الرئيسية ومتابعة الإحصائيات',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'],
      },
      {
        id: 'design-system',
        titleAr: 'نظام التصميم',
        titleEn: 'Design System Lab',
        path: '/design-system',
        icon: 'palette',
        status: 'implemented',
        descriptionAr: 'مكتبة ومختبر المكونات والرموز الدلالية الموحدة',
        allowedRoles: ['developer'],
      },
    ],
  },
  {
    id: 'learning',
    titleAr: 'التعلم',
    titleEn: 'Training & Learning',
    collapsible: true,
    items: [
      {
        id: 'courses',
        titleAr: 'دليل الدورات',
        titleEn: 'Course Catalog',
        path: '/courses',
        icon: 'courses',
        status: 'implemented',
        descriptionAr: 'استعراض البرامج التدريبية المتاحة وتصفية المسارات',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'],
      },
      {
        id: 'my-courses',
        titleAr: 'دوراتي',
        titleEn: 'My Courses',
        path: '/my-courses',
        icon: 'myCourses',
        status: 'implemented',
        descriptionAr: 'متابعة المحتوى التدريبي الملتحق به ونسب التقدم',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'],
      },
      {
        id: 'my-groups',
        titleAr: 'مجموعاتي',
        titleEn: 'My Groups',
        path: '/my-groups',
        icon: 'trainingGroups',
        status: 'implemented',
        descriptionAr: 'المجموعات والدفعات الميدانية المخصصة ومتابعة المهل',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer', 'user'],
      },
    ],
  },
  {
    id: 'management',
    titleAr: 'المحتوى والتشغيل',
    titleEn: 'Content & Operations',
    collapsible: true,
    items: [
      {
        id: 'training-groups',
        titleAr: 'إدارة المجموعات',
        titleEn: 'Training Groups',
        path: '/admin/groups',
        icon: 'trainingGroups',
        status: 'implemented',
        descriptionAr: 'متابعة الدفعات ومؤشرات الانتباه والمواعيد النهائية',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin'],
      },
      {
        id: 'course-builder',
        titleAr: 'منشئ المحتوى',
        titleEn: 'Course Builder',
        path: '/lecturer/courses',
        icon: 'edit',
        status: 'implemented',
        descriptionAr: 'إعداد الدروس والاختبارات وحقائب التدريب',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin', 'lecturer'],
      },
      {
        id: 'quality-audit',
        titleAr: 'الاعتمادات والجودة',
        titleEn: 'Quality Audit',
        path: '/approvals',
        icon: 'shield',
        status: 'implemented',
        descriptionAr: 'مراجعة واعتماد المقررات ومتابعة جودة المحتوى',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin'],
      },
      {
        id: 'department-tracks',
        titleAr: 'مسارات الإدارات',
        titleEn: 'Department Tracks',
        path: '/admin/department-tracks',
        icon: 'grid',
        status: 'implemented',
        descriptionAr: 'تخصيص مسارات التدريب المسموحة لكل إدارة تشغيلية',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin'],
      },
    ],
  },
  {
    id: 'governance',
    titleAr: 'الإدارة والحوكمة',
    titleEn: 'Administration & Governance',
    collapsible: true,
    items: [
      {
        id: 'user-management',
        titleAr: 'إدارة المستخدمين',
        titleEn: 'User Management',
        path: '/admin/users',
        icon: 'users',
        status: 'implemented',
        descriptionAr: 'دليل المستخدمين الموحد والتحقق من الهويات والصلاحيات',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin'],
      },
      {
        id: 'permissions-matrix',
        titleAr: 'الصلاحيات',
        titleEn: 'Permissions Matrix',
        path: '/admin/permissions',
        icon: 'shield',
        status: 'implemented',
        descriptionAr: 'مرجع سياسات الأدوار، سقوف الصلاحيات، وحوكمة التفويض',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin'],
      },
      {
        id: 'system-security-audit',
        titleAr: 'سجل الرقابة',
        titleEn: 'Security Audit Trail',
        path: '/admin/audit',
        icon: 'lock',
        status: 'implemented',
        descriptionAr: 'السجل المركزي لعمليات الرقابة الأمنية والقرارات الإدارية الحساسة',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin'],
      },
      {
        id: 'comment-moderation',
        titleAr: 'إدارة التعليقات',
        titleEn: 'Comment Moderation',
        path: '/admin/comment-moderation',
        icon: 'messageSquare',
        status: 'implemented',
        descriptionAr: 'متابعة طابور البلاغات ومراجعة نقاشات المقررات والتحكم بالسياسات',
        allowedRoles: ['developer', 'super_admin', 'admin', 'assistant_admin'],
      },
      {
        id: 'administration',
        titleAr: 'إعدادات النظام',
        titleEn: 'System Administration',
        path: '/admin',
        icon: 'settings',
        status: 'planned',
        plannedIncrement: 'Increment 12',
        badge: 'قريباً',
        badgeVariant: 'neutral',
        descriptionAr: 'لوحات الإدارة الشاملة والتحليلات والإعدادات العامة',
        allowedRoles: ['developer'],
      },
    ],
  },
];

/**
 * Returns all navigation items flattened
 */
export function getAllNavItems(): NavItem[] {
  return NAVIGATION_SECTIONS.flatMap((section) => section.items);
}

/**
 * Checks whether a given navigation item is visible for a user's role
 */
export function isNavItemVisibleForRole(item: NavItem, role?: UserRole | string | null): boolean {
  if (!role) return false;
  if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
  return item.allowedRoles.includes(role as UserRole);
}

/**
 * Evaluates full navigation visibility including developer exclusivity and preview scopes
 */
export function resolveNavItemVisibility(item: NavItem, ctx: NavVisibilityContext): boolean {
  if (item.id === 'design-system') {
    return ctx.actualUserRole === 'developer' && !ctx.isPreviewing;
  }
  if (ctx.previewRole === 'assistant_lecturer' && (item.id === 'course-builder' || item.id === 'my-courses')) {
    return false;
  }
  return isNavItemVisibleForRole(item, ctx.role);
}

/**
 * Checks whether a given route path is currently implemented and functional
 */
export function isRouteImplemented(path: string): boolean {
  const item = getAllNavItems().find((nav) => nav.path === path);
  return item?.status === 'implemented';
}
