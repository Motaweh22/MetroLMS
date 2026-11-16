import type { TrainingGroup } from '@/core/groups/types';

/**
 * Deterministic Mock Training Groups
 *
 * Derived from verified legacy group schema in js/data.js.
 * Timestamps calibrated relative to October 2026 for reproducible automated testing.
 */
export const INITIAL_MOCK_GROUPS: TrainingGroup[] = [
  {
    id: 'GRP-101',
    name: 'برنامج تشغيل وتأمين الخط الثاني والتحكم الميداني — الدفعة 42',
    description:
      'برنامج تدريبي متكامل لمشغلي المحطات وفرق السلامة يجمع بين تأمين الحركة والمحطات ومنظومات الإشارات بالخط الثاني.',
    courses: [
      {
        courseId: 'CRS001',
        order: 1,
        customStartDateTime: null,
        customDeadlineDateTime: null,
        customPostDeadlinePolicy: null,
      },
      {
        courseId: 'CRS002',
        order: 2,
        customStartDateTime: null,
        customDeadlineDateTime: '2026-11-05T18:00:00',
        customPostDeadlinePolicy: 'keep_no_cert',
      },
    ],
    courseId: 'CRS001',
    traineeIds: ['usr_trainee_003', 'USR004'],
    primaryInstructorId: 'usr_lect_002',
    assistantLecturerIds: [],
    supervisorIds: ['usr_lect_002'],
    startDateTime: '2026-10-10T08:00:00',
    deadlineDateTime: '2026-11-08T18:00:00',
    postDeadlinePolicy: 'keep_no_cert',
    resources: [
      {
        id: 'RES-101-1',
        title: 'رابط المحاضرة التفاعلية المباشرة (Microsoft Teams)',
        url: 'https://teams.microsoft.com/meet/metro-ops-batch42',
        description:
          'رابط الانضمام للقاء التفاعلي الأسبوعي مع المحاضر لمناقشة بروتوكولات تأمين المحطات وإشارات الخط الثاني.',
        order: 1,
        type: 'teams',
        createdAt: '2026-10-10T08:00:00',
      },
      {
        id: 'RES-101-2',
        title: 'دليل إجراءات الطوارئ والسلامة المعتمد (PDF)',
        url: '/dev-media/test-document.pdf',
        description:
          'نسخة رقمية حديثة من لائحة التشغيل وتأمين الحركة بالشركة المصرية لإدارة وتشغيل المترو.',
        order: 2,
        type: 'pdf',
        createdAt: '2026-10-11T09:00:00',
      },
    ],
    createdAt: '2026-10-10T08:00:00',
    updatedAt: '2026-10-10T08:00:00',
  },
  {
    id: 'GRP-102',
    name: 'مجموعة هندسة الإشارات والتحكم المركزي (ATS/SCADA)',
    description:
      'تأهيل متقدم لمهندسي وفنيي منظومات التحكم الآلي والإشارات بالخط الأول والربط مع غرفة التحكم المركزي.',
    courses: [
      {
        courseId: 'CRS002',
        order: 1,
        customStartDateTime: null,
        customDeadlineDateTime: null,
        customPostDeadlinePolicy: null,
      },
    ],
    courseId: 'CRS002',
    traineeIds: ['USR004', 'USR005'],
    primaryInstructorId: 'usr_lect_002',
    assistantLecturerIds: [],
    supervisorIds: ['usr_lect_002'],
    startDateTime: '2026-10-20T08:00:00',
    deadlineDateTime: '2026-11-10T18:00:00',
    postDeadlinePolicy: 'hide',
    resources: [
      {
        id: 'RES-102-1',
        title: 'منظومة تسجيل وتتبع الأعطال الفنية (SCADA Portal)',
        url: 'https://scada-monitoring.metro.internal/login',
        description:
          'البوابة المركزية لتسجيل قراءات منظومة الإشارات والتحكم لمهندسي وفنيي الخط الأول.',
        order: 1,
        type: 'link',
        createdAt: '2026-10-12T10:00:00',
      },
    ],
    createdAt: '2026-10-12T10:00:00',
    updatedAt: '2026-10-12T10:00:00',
  },
  {
    id: 'GRP-103',
    name: 'برنامج السلامة الصناعية والمحاكاة الميدانية',
    description:
      'التدريب السنوي الإلزامي للسلامة ومكافحة الحرائق داخل ورش طرة البلد وشبرا الخيمة.',
    courses: [
      {
        courseId: 'CRS001',
        order: 1,
        customStartDateTime: null,
        customDeadlineDateTime: null,
        customPostDeadlinePolicy: null,
      },
    ],
    courseId: 'CRS001',
    traineeIds: ['usr_trainee_003', 'USR005'],
    primaryInstructorId: null,
    assistantLecturerIds: [],
    supervisorIds: ['usr_admin_001'],
    startDateTime: '2026-09-15T08:00:00',
    deadlineDateTime: '2026-10-14T18:00:00',
    postDeadlinePolicy: 'keep_no_cert',
    resources: [
      {
        id: 'RES-103-1',
        title: 'استمارة تقييم التدريب الميداني والورش',
        url: 'https://forms.office.com/r/metro-safety-eval-2025',
        description:
          'استبيان قياس الأثر التدريبي وتقييم الورش العملية للسلامة الصناعية.',
        order: 1,
        type: 'link',
        createdAt: '2026-09-15T08:00:00',
      },
    ],
    createdAt: '2026-09-15T08:00:00',
    updatedAt: '2026-09-15T08:00:00',
  },
];
