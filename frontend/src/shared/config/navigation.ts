import type { SemanticIconName } from '@/shared/ui/Icon';
import type { BadgeVariant } from '@/shared/ui/Badge';

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
}

export interface NavSection {
  id: string;
  titleAr: string;
  titleEn: string;
  items: NavItem[];
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
    titleAr: 'الرئيسية والاستكشاف',
    titleEn: 'Overview & Foundation',
    items: [
      {
        id: 'dashboard',
        titleAr: 'لوحة المتابعة الرئيسية',
        titleEn: 'Dashboard Overview',
        path: '/dashboard',
        icon: 'dashboard',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'الواجهة الرئيسية لهيكل التطبيق وحالة التطوير المستمرة',
      },
      {
        id: 'design-system',
        titleAr: 'معمل نظام التصميم',
        titleEn: 'Design System Lab',
        path: '/design-system',
        icon: 'palette',
        status: 'implemented',
        badge: 'معتمد',
        badgeVariant: 'info',
        descriptionAr: 'مكتبة ومختبر المكونات والرموز الدلالية الموحدة',
      },
    ],
  },
  {
    id: 'learning',
    titleAr: 'التدريب والمسارات',
    titleEn: 'Training & Learning',
    items: [
      {
        id: 'courses',
        titleAr: 'دليل الدورات التدريبية',
        titleEn: 'Course Catalog',
        path: '/courses',
        icon: 'courses',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'استعراض البرامج التدريبية المتاحة وتصفية المسارات',
      },
      {
        id: 'my-courses',
        titleAr: 'دوراتي ومسار التعلم',
        titleEn: 'My Courses',
        path: '/my-courses',
        icon: 'myCourses',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'متابعة المحتوى التدريبي الملتحق به ونسب التقدم',
      },
      {
        id: 'my-groups',
        titleAr: 'مجموعاتي التدريبية',
        titleEn: 'My Groups',
        path: '/my-groups',
        icon: 'trainingGroups',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'المجموعات والدفعات الميدانية المخصصة ومتابعة المهل',
      },
    ],
  },
  {
    id: 'management',
    titleAr: 'الإدارة والرقابة (قيد التطوير)',
    titleEn: 'Operations & Management (Planned)',
    items: [
      {
        id: 'training-groups',
        titleAr: 'المجموعات ومواعيد الاستحقاق',
        titleEn: 'Training Groups',
        path: '/admin/groups',
        icon: 'trainingGroups',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'متابعة الدفعات ومؤشرات الانتباه والمواعيد النهائية',
      },
      {
        id: 'course-builder',
        titleAr: 'منشئ المحتوى للمحاضرين',
        titleEn: 'Course Builder',
        path: '/lecturer/courses',
        icon: 'edit',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'إعداد الدروس والاختبارات وحقائب التدريب',
      },
      {
        id: 'quality-audit',
        titleAr: 'التدقيق واعتماد الجودة',
        titleEn: 'Quality Audit',
        path: '/approvals',
        icon: 'shield',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'مراجعة واعتماد المقررات ومتابعة جودة المحتوى',
      },
      {
        id: 'user-management',
        titleAr: 'إدارة المستخدمين',
        titleEn: 'User Management',
        path: '/admin/users',
        icon: 'users',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'دليل المستخدمين الموحد والتحقق من الهويات والصلاحيات',
      },
      {
        id: 'permissions-matrix',
        titleAr: 'مصفوفة الصلاحيات والحوكمة',
        titleEn: 'Permissions Matrix',
        path: '/admin/permissions',
        icon: 'shield',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'مرجع سياسات الأدوار، سقوف الصلاحيات، وحوكمة التفويض',
      },
      {
        id: 'system-security-audit',
        titleAr: 'سجل الرقابة والأمان',
        titleEn: 'Security Audit Trail',
        path: '/admin/audit',
        icon: 'lock',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'السجل المركزي لعمليات الرقابة الأمنية والقرارات الإدارية الحساسة',
      },
      {
        id: 'department-tracks',
        titleAr: 'مسارات الإدارات',
        titleEn: 'Department Tracks',
        path: '/admin/department-tracks',
        icon: 'grid',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'تخصيص مسارات التدريب المسموحة لكل إدارة تشغيلية',
      },
      {
        id: 'comment-moderation',
        titleAr: 'إدارة ومراقبة التعليقات',
        titleEn: 'Comment Moderation',
        path: '/admin/comment-moderation',
        icon: 'messageSquare',
        status: 'implemented',
        badge: 'مفعل',
        badgeVariant: 'primary',
        descriptionAr: 'متابعة طابور البلاغات ومراجعة نقاشات المقررات والتحكم بالسياسات',
      },
      {
        id: 'administration',
        titleAr: 'إدارة النظام والتكامل',
        titleEn: 'System Administration',
        path: '/admin',
        icon: 'settings',
        status: 'planned',
        plannedIncrement: 'Increment 12',
        badge: 'مجدول (12)',
        badgeVariant: 'neutral',
        descriptionAr: 'لوحات الإدارة الشاملة والتحليلات والإعدادات العامة',
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
 * Checks whether a given route path is currently implemented and functional
 */
export function isRouteImplemented(path: string): boolean {
  const item = getAllNavItems().find((nav) => nav.path === path);
  return item?.status === 'implemented';
}
