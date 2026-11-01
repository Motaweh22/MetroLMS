/**
 * Increment 10: Rich Training Groups Demo Fixtures
 *
 * Provides realistic enterprise demo cohorts calibrated for manual UI review and audit:
 * 1. Multi-cycle training group with sealed Cycle 1 and active Cycle 2 (Core + Reminder courses).
 * 2. Trainee repeating a course across renewal cycles with Attempt #2 badge and preserved Cycle 1 history.
 * 3. Group with pending applicant join request for review.
 * 4. Group with organized material library folders and multi-format files.
 * 5. Scheduled training group accepting pre-training enrollments via open QR policy.
 */

import type {
  TrainingGroup,
  GroupRenewalCycle,
  CourseAttempt,
  GroupMember,
  GroupJoinRequest,
  GroupMaterialFolder,
  GroupMaterialFile,
} from '@/core/groups/types';

export interface TrainingGroupsDemoFixtures {
  groups: TrainingGroup[];
  renewalCycles: GroupRenewalCycle[];
  courseAttempts: CourseAttempt[];
  groupMembers: Record<string, GroupMember[]>;
  joinRequests: GroupJoinRequest[];
  materialFolders: GroupMaterialFolder[];
  materialFiles: GroupMaterialFile[];
}

export function createTrainingGroupsDemoFixtures(): TrainingGroupsDemoFixtures {
  // ── 1. Group 201: Multi-Cycle Program with Repeated Course Attempt ──────────
  const group201: TrainingGroup = {
    id: 'GRP-201',
    name: 'برنامج دبلوم هندسة القطارات السريعة وتأمين المسير — دفعة التميز 2026',
    description:
      'برنامج تأهيلي دوري متقدم يجمع بين التدريب الأساسي في الدورة الأولى والتدريب التنشيطي في دورات التجديد اللاحقة مع توثيق سجلات المحاولات المستقلة.',
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
        customDeadlineDateTime: null,
        customPostDeadlinePolicy: null,
      },
    ],
    courseId: 'CRS001',
    traineeIds: ['usr_trainee_003', 'USR004'],
    primaryInstructorId: 'usr_lect_002',
    assistantLecturerIds: [],
    supervisorIds: ['usr_lect_002'],
    resources: [],
    startDateTime: '2026-10-01T08:00:00Z',
    deadlineDateTime: '2026-11-30T18:00:00Z',
    postDeadlinePolicy: 'keep_no_cert',
    adminStatus: 'active',
    enrollmentPolicy: 'approval_required',
    enrollmentCode: 'GRP-201-DEMO-TOKEN',
    isEnrollmentOpen: true,
    maxTrainees: 35,
    renewalSchedule: {
      recurrenceType: 'bimonthly',
      intervalDays: 60,
      autoRenewalEnabled: true,
    },
    currentCycleId: 'CYC-GRP-201-02',
    foldersCount: 2,
    filesCount: 3,
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };

  // Cycle 1: Completed / Archived
  const cycle201_1: GroupRenewalCycle = {
    id: 'CYC-GRP-201-01',
    groupId: 'GRP-201',
    cycleNumber: 1,
    title: 'دورة التأهيل الأساسي (الربع الأول 2026)',
    status: 'completed',
    startDateTime: '2026-01-01T08:00:00Z',
    deadlineDateTime: '2026-03-31T18:00:00Z',
    postDeadlinePolicy: 'keep_no_cert',
    courses: [
      { courseId: 'CRS001', courseRole: 'core', order: 1 },
      { courseId: 'CRS002', courseRole: 'core', order: 2 },
    ],
    traineeIds: ['usr_trainee_003', 'USR004'],
    completedAt: '2026-03-31T18:00:00Z',
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-03-31T18:00:00Z',
  };

  // Cycle 2: Active / Current
  const cycle201_2: GroupRenewalCycle = {
    id: 'CYC-GRP-201-02',
    groupId: 'GRP-201',
    cycleNumber: 2,
    title: 'دورة التجديد والتطوير الميداني (الربع الرابع 2026)',
    status: 'active',
    startDateTime: '2026-10-01T08:00:00Z',
    deadlineDateTime: '2026-11-30T18:00:00Z',
    postDeadlinePolicy: 'keep_no_cert',
    courses: [
      { courseId: 'CRS001', courseRole: 'reminder', order: 1 },
      { courseId: 'CRS002', courseRole: 'core', order: 2 },
    ],
    traineeIds: ['usr_trainee_003', 'USR004'],
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };

  // Attempt Records: Trainee usr_trainee_003 repeated CRS001
  const attempt201_cycle1: CourseAttempt = {
    id: 'ATT-usr_trainee_003-CRS001-CYC-GRP-201-01',
    userId: 'usr_trainee_003',
    courseId: 'CRS001',
    groupId: 'GRP-201',
    cycleId: 'CYC-GRP-201-01',
    attemptNumber: 1,
    courseRole: 'core',
    status: 'completed',
    startedAt: '2026-01-05T09:00:00Z',
    completedAt: '2026-03-20T14:30:00Z',
    lastActivityAt: '2026-03-20T14:30:00Z',
    progressPercent: 100,
    completedItemIds: ['item_1', 'item_2', 'item_3'],
    lessonProgress: {},
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-03-20T14:30:00Z',
  };

  const attempt201_cycle2: CourseAttempt = {
    id: 'ATT-usr_trainee_003-CRS001-CYC-GRP-201-02',
    userId: 'usr_trainee_003',
    courseId: 'CRS001',
    groupId: 'GRP-201',
    cycleId: 'CYC-GRP-201-02',
    attemptNumber: 2,
    courseRole: 'reminder',
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    lastActivityAt: null,
    progressPercent: 0,
    completedItemIds: [],
    lessonProgress: {},
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };

  // Group Members for GRP-201
  const members201: GroupMember[] = [
    {
      userId: 'usr_trainee_003',
      name: 'م. سارة المهدي',
      email: 'trainee@cairo-metro.com',
      department: 'قطاع التشغيل',
      jobTitle: 'مهندسة تشغيل محطات',
      joinedAt: '2026-01-01T08:00:00Z',
      joinSource: 'admin_assigned',
    },
    {
      userId: 'USR004',
      name: 'عبدالرحمن حسن محمود',
      email: 'abdulrahman@cairo-metro.com',
      department: 'قطاع الصيانة',
      jobTitle: 'فني صيانة',
      joinedAt: '2026-01-01T08:00:00Z',
      joinSource: 'admin_assigned',
    },
  ];

  // Pending Join Request for GRP-201
  const request201: GroupJoinRequest = {
    id: 'REQ-DEMO-201-01',
    groupId: 'GRP-201',
    groupName: group201.name,
    userId: 'USR006',
    userName: 'ياسر إبراهيم عبدالعزيز',
    userEmail: 'yasser@cairo-metro.com',
    department: 'قطاع التشغيل',
    jobTitle: 'مشرف محطة',
    status: 'pending',
    reviewNote:
      'أرغب بالانضمام للبرنامج التنشيطي لتعزيز إجراءات السلامة وتأمين مسير قطارات الخط الثاني والتحكم الميداني.',
    requestedAt: '2026-10-18T10:15:00Z',
  };

  // Materials Library for GRP-201
  const folder201_1: GroupMaterialFolder = {
    id: 'FLD-GRP-201-01',
    groupId: 'GRP-201',
    cycleId: 'CYC-GRP-201-02',
    name: 'لوائح التشغيل وكتيبات السلامة المعتمدة',
    order: 1,
    isVisibleToTrainees: true,
    filesCount: 2,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };

  const folder201_2: GroupMaterialFolder = {
    id: 'FLD-GRP-201-02',
    groupId: 'GRP-201',
    cycleId: 'CYC-GRP-201-02',
    name: 'نماذج الفحص الدوري الميداني',
    order: 2,
    isVisibleToTrainees: true,
    filesCount: 1,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-01T08:00:00Z',
  };

  const file201_1: GroupMaterialFile = {
    id: 'FIL-GRP-201-001',
    folderId: 'FLD-GRP-201-01',
    groupId: 'GRP-201',
    cycleId: 'CYC-GRP-201-02',
    title: 'دليل الإشارات وتأمين المسير المعتمد',
    originalFileName: 'safety-regulations-2026.pdf',
    fileSizeBytes: 2048576,
    mimeType: 'application/pdf',
    fileType: 'pdf',
    url: '/dev-media/test-document.pdf',
    order: 1,
    uploadedBy: 'usr_lect_002',
    uploadedByName: 'د. طارق الجوهري',
    uploadedAt: '2026-10-02T09:00:00Z',
    isVisible: true,
    downloadCount: 5,
  };

  const file201_2: GroupMaterialFile = {
    id: 'FIL-GRP-201-002',
    folderId: 'FLD-GRP-201-01',
    groupId: 'GRP-201',
    cycleId: 'CYC-GRP-201-02',
    title: 'مخطط مسارات وتفريعات الخط الثالث',
    originalFileName: 'line3-track-layout.png',
    fileSizeBytes: 524288,
    mimeType: 'image/png',
    fileType: 'image',
    url: '/src/assets/brand/Geometric%20Metro%20Star%20Emblem%20logo.png',
    order: 2,
    uploadedBy: 'usr_lect_002',
    uploadedByName: 'د. طارق الجوهري',
    uploadedAt: '2026-10-02T10:00:00Z',
    isVisible: true,
    downloadCount: 3,
  };

  const file201_3: GroupMaterialFile = {
    id: 'FIL-GRP-201-003',
    folderId: 'FLD-GRP-201-02',
    groupId: 'GRP-201',
    cycleId: 'CYC-GRP-201-02',
    title: 'استمارة الفحص الفني اليومي للكبائن',
    originalFileName: 'daily-cabin-checklist.docx',
    fileSizeBytes: 1048576,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileType: 'word',
    url: '/dev-media/materials/daily-train-inspection.docx',
    order: 1,
    uploadedBy: 'usr_admin_001',
    uploadedByName: 'م. أحمد الشناوي',
    uploadedAt: '2026-10-03T11:00:00Z',
    isVisible: true,
    downloadCount: 2,
  };

  // ── 2. Group 202: Scheduled Group Accepting Pre-Training Enrollments ───────
  const group202: TrainingGroup = {
    id: 'GRP-202',
    name: 'برنامج محاكاة طوارئ محطات الخط الرابع (مجدول للدورة القادمة)',
    description:
      'برنامج تدريبي مجدول يبدأ في منتصف نوفمبر 2026، وباب التسجيل المسبق مفتوح حالياً للمتدربين عبر رمز الاستجابة السريعة.',
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
    traineeIds: [],
    primaryInstructorId: null,
    assistantLecturerIds: [],
    supervisorIds: ['usr_admin_001'],
    resources: [],
    startDateTime: '2026-11-15T08:00:00Z',
    deadlineDateTime: '2026-12-31T18:00:00Z',
    postDeadlinePolicy: 'keep_no_cert',
    adminStatus: 'active',
    enrollmentPolicy: 'open',
    enrollmentCode: 'GRP-202-PRE-ENROLL',
    isEnrollmentOpen: true,
    maxTrainees: 30,
    renewalSchedule: {
      recurrenceType: 'none',
      autoRenewalEnabled: false,
    },
    currentCycleId: 'CYC-GRP-202-01',
    foldersCount: 0,
    filesCount: 0,
    createdAt: '2026-10-15T08:00:00Z',
    updatedAt: '2026-10-15T08:00:00Z',
  };

  const cycle202_1: GroupRenewalCycle = {
    id: 'CYC-GRP-202-01',
    groupId: 'GRP-202',
    cycleNumber: 1,
    title: 'دورة التدريب الافتتاحية المجدولة',
    status: 'active',
    startDateTime: '2026-11-15T08:00:00Z',
    deadlineDateTime: '2026-12-31T18:00:00Z',
    postDeadlinePolicy: 'keep_no_cert',
    courses: [{ courseId: 'CRS001', courseRole: 'core', order: 1 }],
    traineeIds: [],
    createdAt: '2026-10-15T08:00:00Z',
    updatedAt: '2026-10-15T08:00:00Z',
  };

  return {
    groups: [group201, group202],
    renewalCycles: [cycle201_1, cycle201_2, cycle202_1],
    courseAttempts: [attempt201_cycle1, attempt201_cycle2],
    groupMembers: {
      'GRP-201': members201,
      'GRP-202': [],
    },
    joinRequests: [request201],
    materialFolders: [folder201_1, folder201_2],
    materialFiles: [file201_1, file201_2, file201_3],
  };
}
