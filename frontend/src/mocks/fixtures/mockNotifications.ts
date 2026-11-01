import type { NotificationItem } from '@/core/notifications/types';

/**
 * Sanitized Synthetic Notifications
 *
 * Derived from verified legacy fixtures in data/notifications.json.
 * Mapped strictly to synthetic demo personas (usr_trainee_003, usr_lect_002, usr_admin_001)
 * without credentials, secrets, or sensitive telemetry.
 */
export const INITIAL_MOCK_NOTIFICATIONS: NotificationItem[] = [
  // Trainee Notifications (usr_trainee_003)
  {
    id: 'NOT001',
    userId: 'usr_trainee_003',
    type: 'enrollment_approved',
    message: 'تمت الموافقة على تسجيلك في دورة سلامة العمل والسلوك المهني',
    courseId: 'CRS001',
    read: true,
    createdAt: '2026-10-10T08:00:00Z',
  },
  {
    id: 'NOT002',
    userId: 'usr_trainee_003',
    type: 'new_course_suggested',
    message: 'تم اقتراح كورس جديد لك: الإسعافات الأولية الطارئة',
    courseId: 'CRS004',
    read: false,
    createdAt: '2026-10-14T10:30:00Z',
  },
  {
    id: 'NOT003',
    userId: 'usr_trainee_003',
    type: 'enrollment_approved',
    message: 'تمت الموافقة على تسجيلك في دورة تشغيل وصيانة القطارات',
    courseId: 'CRS003',
    read: false,
    createdAt: '2026-10-15T14:00:00Z',
  },
  {
    id: 'NOT004',
    userId: 'usr_trainee_003',
    type: 'forced_enrollment',
    message: 'تم تسجيلك تلقائياً في دورة خدمة العملاء بناءً على برنامج الدفعة 42',
    courseId: 'CRS002',
    read: false,
    createdAt: '2026-10-16T09:00:00Z',
  },
  {
    id: 'NOT005',
    userId: 'usr_trainee_003',
    type: 'new_comment',
    message: 'علّق المحاضر د. طارق الجوهري على أدائك في اختبار السلامة',
    courseId: 'CRS001',
    read: false,
    createdAt: '2026-10-16T11:30:00Z',
  },
  {
    id: 'NOT006',
    userId: 'usr_trainee_003',
    type: 'deadline_reminder',
    message: 'تذكير: يتبقى 10 أيام على الموعد النهائي لبرنامج تشغيل الخط الثاني (GRP-101)',
    courseId: null,
    groupId: 'GRP-101',
    targetUrl: '/my-groups/GRP-101',
    read: false,
    createdAt: '2026-10-17T08:00:00Z',
  },

  // Lecturer Notifications (usr_lect_002)
  {
    id: 'NOT101',
    userId: 'usr_lect_002',
    type: 'enrollment_request',
    message: 'طلب تسجيل جديد من أحمد ممدوح سالم في دورة خدمة العملاء',
    courseId: 'CRS002',
    read: false,
    createdAt: '2026-10-15T08:30:00Z',
  },
  {
    id: 'NOT102',
    userId: 'usr_lect_002',
    type: 'content_approved',
    message: 'تمت الموافقة على المحتوى التدريبي الجديد في كورس تشغيل وصيانة القطارات',
    courseId: 'CRS003',
    read: true,
    createdAt: '2026-10-14T14:00:00Z',
  },
  {
    id: 'NOT103',
    userId: 'usr_lect_002',
    type: 'new_comment',
    message: 'استفسار جديد من أحد المتدربين على محاضرة بروتوكولات الإشارات',
    courseId: 'CRS003',
    read: false,
    createdAt: '2026-10-16T10:00:00Z',
  },

  // Admin Notifications (usr_admin_001)
  {
    id: 'NOT201',
    userId: 'usr_admin_001',
    type: 'new_registration_request',
    message: 'طلب اعتماد تسجيل مستخدم جديد في قطاع الصيانة بانتظار الموافقة',
    courseId: null,
    read: false,
    createdAt: '2026-10-16T07:30:00Z',
  },
  {
    id: 'NOT202',
    userId: 'usr_admin_001',
    type: 'content_pending_review',
    message: 'محتوى تدريبي جديد بانتظار الاعتماد في كورس الإسعافات الأولية',
    courseId: 'CRS004',
    targetUrl: '/admin/review/CRS004',
    read: false,
    createdAt: '2026-10-16T10:00:00Z',
  },
  {
    id: 'NOT203',
    userId: 'usr_admin_001',
    type: 'enrollment_request',
    message: 'طلب تسجيل استثنائي في برنامج السلامة الصناعية (GRP-103)',
    courseId: 'CRS001',
    groupId: 'GRP-103',
    targetUrl: '/admin/groups/GRP-103/monitoring?tab=requests',
    read: false,
    createdAt: '2026-10-17T07:00:00Z',
  },
];
