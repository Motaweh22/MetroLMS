import type {
  Course,
  CourseBaselineSnapshot,
  StagedAdminEditsRecord,
} from '@/core/courses/types';

/**
 * Increment 9: Review Workflow Deterministic Demo Courses
 *
 * Provides internally consistent, deterministic demo course fixtures for:
 * 1. Admin Awaiting Review (New course awaiting first review)
 * 2. Admin Awaiting Review (Published course update with separate draft and staged admin edits)
 * 3. Lecturer Reviewed (Returned with admin edits, official feedback, and dual snapshots for diff inspection)
 * 4. Lecturer Reviewed (Rejected with official reason)
 * 5. Lecturer Reviewed (Approved & published course with audit trail)
 *
 * Ownership: Dr. Tarek El-Gohary (`usr_lect_002` / `USR002`)
 * Admin Reviewer: Eng. Mahmoud Abdel-Salam (`usr_admin_001`)
 *
 * Guarantees:
 * - 100% Arabic RTL content with Cairo Metro technical terminology
 * - Zero emojis
 * - Zero pricing fields or functionality
 * - No private reviewer working notes exposed to lecturers
 * - Preserves isolation between published base course and pending update draft
 */

export interface ReviewDemoFixtures {
  courses: Course[];
  drafts: Record<string, Course>;
  stagedEdits: Record<string, StagedAdminEditsRecord>;
}

export function createReviewDemoFixtures(): ReviewDemoFixtures {
  const LECTURER_ID = 'usr_lect_002';
  const LECTURER_NAME = 'د. طارق الجوهري';
  const ADMIN_ID = 'usr_admin_001';
  const ADMIN_NAME = 'م. محمود عبد السلام';

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Course 1: New course waiting for first review (Case A)
  // ───────────────────────────────────────────────────────────────────────────
  const courseNewPending: Course = {
    id: 'CRS-REV-NEW-01',
    title: 'إجراءات الطوارئ ومكافحة الحرائق في محطات وأنفاق المترو',
    description:
      'دليل تدريبي وتطبيقي شامل لفرق التدخل السريع وموظفي المحطات للتعامل مع حوادث الحريق والإخلاء الآمن وتفعيل أنظمة سحب الدخان.',
    thumbnail: '',
    coverType: 'color',
    coverColor: '#b91c1c',
    lecturerId: LECTURER_ID,
    lecturerName: LECTURER_NAME,
    coLecturers: [],
    assistants: [],
    targetJobTitles: ['مشرف محطة', 'مسؤول سلامة وأمان', 'سائق قطار'],
    level: 'متوسط',
    estimatedHours: 6,
    rating: 0,
    ratingCount: 0,
    enrollmentCount: 0,
    status: 'pending_admin',
    submittedAt: '2026-10-18T09:30:00.000Z',
    commentsEnabled: true,
    chapters: [
      {
        id: 'CH_NEW_01',
        title: 'بروتوكولات الإنذار المبكر ومكافحة الحريق',
        order: 1,
        items: [
          {
            id: 'ITM_NEW_101',
            type: 'video',
            title: 'خطة الإخلاء في المحطات النفقية وتوجيه الركاب',
            duration: '14:20',
            views: 0,
            canDownload: false,
            downloadPolicy: 'never',
          },
          {
            id: 'ITM_NEW_102',
            type: 'pdf',
            title: 'دليل تشغيل لوحات الإنذار وأنظمة سحب الدخان',
            canDownload: true,
            downloadPolicy: 'immediate',
          },
        ],
      },
      {
        id: 'CH_NEW_02',
        title: 'إجراءات التنسيق مع غرف التحكم والحماية المدنية',
        order: 2,
        items: [
          {
            id: 'ITM_NEW_201',
            type: 'video',
            title: 'مسارات الهروب ونقاط التجمع الآمنة خارج المحطة',
            duration: '18:45',
            views: 0,
            canDownload: false,
            downloadPolicy: 'never',
          },
        ],
      },
    ],
    externalResources: [
      {
        id: 'RES_NEW_01',
        title: 'دليل اشتراطات الحماية المدنية المصرية لمترو الأنفاق',
        url: 'https://cairo-metro.gov.eg/docs/fire-safety-code.pdf',
        order: 1,
      },
    ],
    auditLog: [
      {
        id: 'AUD_REV_NEW_01',
        courseId: 'CRS-REV-NEW-01',
        action: 'submitted',
        actorId: LECTURER_ID,
        actorName: LECTURER_NAME,
        actorRole: 'lecturer',
        timestamp: '2026-10-18T09:30:00.000Z',
        summary: `تم تقديم المقرر للمراجعة والاعتماد الأولي بواسطة المحاضر ${LECTURER_NAME}`,
      },
    ],
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Course 2: Published course with update pending review & staged admin edits (Case B)
  // ───────────────────────────────────────────────────────────────────────────
  const coursePublishedUpdateBase: Course = {
    id: 'CRS-REV-UPD-02',
    title: 'صيانة أنظمة التحكم والفرامل الهوائية للقطارات',
    description:
      'البرنامج المعتمد للتدريب على منظومة الهواء المضغوط وصمامات الفرملة الرئيسية في قطارات الخطين الأول والثاني.',
    thumbnail: '',
    coverType: 'color',
    coverColor: '#1e3a8a',
    lecturerId: LECTURER_ID,
    lecturerName: LECTURER_NAME,
    coLecturers: [],
    assistants: [],
    targetJobTitles: ['مهندس تشغيل وصيانة', 'فني صيانة وحدات متحركة'],
    level: 'متقدم',
    estimatedHours: 10,
    rating: 4.8,
    ratingCount: 86,
    enrollmentCount: 142,
    completionCount: 110,
    status: 'published',
    isUpdatePendingApproval: true,
    hasDraftChanges: true,
    submittedAt: '2026-10-19T08:15:00.000Z',
    commentsEnabled: true,
    chapters: [
      {
        id: 'CH_UPD_01',
        title: 'مكونات دائرة الهواء وصمام الفرملة الرئيسي',
        order: 1,
        items: [
          {
            id: 'ITM_UPD_101',
            type: 'video',
            title: 'فحص ضواغط الهواء الرئيسية واختبار التسريب',
            duration: '16:00',
            views: 180,
            canDownload: false,
            downloadPolicy: 'never',
          },
          {
            id: 'ITM_UPD_102',
            type: 'pdf',
            title: 'دليل الصيانة الدورية لصمامات العادم والطوارئ',
            canDownload: true,
            downloadPolicy: 'immediate',
          },
        ],
      },
      {
        id: 'CH_UPD_02',
        title: 'اختبارات كفاءة الكبح والتوقف التلقائي للقطار',
        order: 2,
        items: [
          {
            id: 'ITM_UPD_201',
            type: 'video',
            title: 'معايرة مسافة التوقف في حالات الطوارئ القصوى',
            duration: '12:30',
            views: 140,
            canDownload: false,
            downloadPolicy: 'never',
          },
        ],
      },
    ],
    auditLog: [
      {
        id: 'AUD_REV_UPD_01',
        courseId: 'CRS-REV-UPD-02',
        action: 'approved',
        actorId: ADMIN_ID,
        actorName: ADMIN_NAME,
        actorRole: 'admin',
        timestamp: '2026-09-01T10:00:00.000Z',
        summary: `تم اعتماد ونشر النسخة الأولى للمقرر بواسطة ${ADMIN_NAME}`,
      },
      {
        id: 'AUD_REV_UPD_02',
        courseId: 'CRS-REV-UPD-02',
        action: 'submitted',
        actorId: LECTURER_ID,
        actorName: LECTURER_NAME,
        actorRole: 'lecturer',
        timestamp: '2026-10-19T08:15:00.000Z',
        summary: `تم تقديم تحديثات جديدة على المقرر للمراجعة والاعتماد بواسطة ${LECTURER_NAME}`,
      },
    ],
  };

  // Draft for Course 2 (submitted update)
  const coursePublishedUpdateDraft: Course = {
    ...JSON.parse(JSON.stringify(coursePublishedUpdateBase)),
    title: 'صيانة أنظمة التحكم والفرامل الهوائية للقطارات (تحديث 2026)',
    description:
      'البرنامج المحدث للتدريب على منظومة الهواء المضغوط وصمامات الفرملة الكهرورئوية المتقدمة لقطارات الكورية واليابانية الحديثة.',
    estimatedHours: 14,
    draftUpdatedAt: '2026-10-19T08:15:00.000Z',
    hasDraftChanges: true,
    chapters: [
      ...coursePublishedUpdateBase.chapters,
      {
        id: 'CH_UPD_03_NEW',
        title: 'منظومة الفرملة الكهرورئوية الحديثة للقطارات المكيفة',
        order: 3,
        items: [
          {
            id: 'ITM_UPD_301',
            type: 'video',
            title: 'تشخيص أعطال صمام التوزيع الإلكتروني في قطارات الخط الثالث',
            duration: '20:10',
            canDownload: false,
            downloadPolicy: 'never',
          },
          {
            id: 'ITM_UPD_302',
            type: 'pdf',
            title: 'مخطط دوائر الفرملة الكهرورئوية المعتمد',
            canDownload: true,
            downloadPolicy: 'immediate',
          },
        ],
      },
    ],
    externalResources: [
      {
        id: 'RES_UPD_01',
        title: 'دليل الشركة المصنعة لفرامل القطارات الحديثة',
        url: 'https://cairo-metro.gov.eg/docs/rotem-brake-manual.pdf',
        order: 1,
      },
    ],
  };

  // Staged Admin Edits for Course 2
  const stagedAdminEditsForCourse2: StagedAdminEditsRecord = {
    courseId: 'CRS-REV-UPD-02',
    baselineId: 'CRS-REV-UPD-02',
    baselineSubmittedAt: '2026-10-19T08:15:00.000Z',
    clientRevision: 1,
    patchedContent: {
      title: 'صيانة أنظمة التحكم والفرامل الهوائية المتطورة للوحدات المتحركة',
      estimatedHours: 15,
      targetJobTitles: ['مهندس تشغيل وصيانة', 'فني صيانة وحدات متحركة', 'فني فرامل قطارات أول'],
    },
    lastSavedAt: '2026-10-19T10:45:00.000Z',
    savedByAdminId: ADMIN_ID,
    isStale: false,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Course 3: Returned with admin edits (Outcome B) with dual snapshots & feedback
  // ───────────────────────────────────────────────────────────────────────────
  const baselineSnapshotForCourse3: CourseBaselineSnapshot = {
    id: 'CRS-REV-RET-03',
    title: 'بروتوكولات الاتصال اللاسلكي وتتبع القطارات',
    description:
      'منهج تدريبي لفنيي ومهندسي التحكم والإشارات للتعامل مع شبكات Tetra وكبائن الاتصال اللاسلكي.',
    level: 'متوسط',
    estimatedHours: 10,
    coverType: 'color',
    coverColor: '#047857',
    targetJobTitles: ['مهندس إشارات وتحكم', 'فني اتصالات لاسلكية'],
    courseZipPolicy: 'disabled',
    capturedAt: '2026-10-18T11:00:00.000Z',
    submittedAt: '2026-10-18T11:00:00.000Z',
    chapters: [
      {
        id: 'CH_RET_01',
        title: 'أساسيات الاتصال اللاسلكي بالمحطات',
        order: 1,
        items: [
          {
            id: 'ITM_RET_101',
            type: 'video',
            title: 'بروتوكول التواصل بين السائق والمراقبة المركزية',
            duration: '15:30',
            downloadPolicy: 'never',
          },
          {
            id: 'ITM_RET_102',
            type: 'pdf',
            title: 'لائحة مصطلحات الاتصال اللاسلكي',
            downloadPolicy: 'immediate',
          },
        ],
      },
      {
        id: 'CH_RET_02',
        title: 'إجراءات التعامل مع انقطاع الإشارة اللاسلكية',
        order: 2,
        items: [
          {
            id: 'ITM_RET_201',
            type: 'video',
            title: 'التشغيل الاحتياطي اليدوي في حالات فقدان التردد',
            duration: '11:00',
            downloadPolicy: 'never',
          },
        ],
      },
    ],
    externalResources: [],
  };

  const adminEditedSnapshotForCourse3: CourseBaselineSnapshot = {
    id: 'CRS-REV-RET-03',
    title: 'بروتوكولات الاتصال اللاسلكي ونظم تتبع حركة مسار القطارات',
    description:
      'منهج تدريبي متقدم لفنيي ومهندسي التحكم والإشارات للتعامل مع شبكات TETRA الرقمية وكبائن الاتصال اللاسلكي بالمحطات والأنفاق.',
    level: 'متقدم',
    estimatedHours: 12,
    coverType: 'color',
    coverColor: '#047857',
    targetJobTitles: ['مهندس إشارات وتحكم', 'فني اتصالات لاسلكية', 'مراقب حركة مركزي'],
    courseZipPolicy: 'after_course_completion',
    capturedAt: '2026-10-19T13:45:00.000Z',
    submittedAt: '2026-10-18T11:00:00.000Z',
    chapters: [
      {
        id: 'CH_RET_01',
        title: 'معايير الاتصال اللاسلكي الرقمي المحدثة (TETRA)',
        order: 1,
        items: [
          {
            id: 'ITM_RET_101',
            type: 'video',
            title: 'بروتوكول التواصل الرقمي المشفر بين السائق والمراقبة المركزية',
            duration: '18:00',
            downloadPolicy: 'never',
            externalResources: [
              {
                id: 'RES_RET_TETRA',
                title: 'المعيار الدولي لشبكات TETRA في سكك حديد المدن',
                url: 'https://cairo-metro.gov.eg/docs/tetra-standards.pdf',
                order: 1,
              },
            ],
          },
          {
            id: 'ITM_RET_102',
            type: 'pdf',
            title: 'لائحة مصطلحات الاتصال اللاسلكي الرسمية المعتمدة',
            downloadPolicy: 'immediate',
          },
        ],
      },
      {
        id: 'CH_RET_02',
        title: 'إجراءات التعامل مع انقطاع الإشارة اللاسلكية',
        order: 2,
        items: [
          {
            id: 'ITM_RET_201',
            type: 'video',
            title: 'التشغيل الاحتياطي اليدوي في حالات فقدان التردد',
            duration: '11:00',
            downloadPolicy: 'never',
          },
        ],
      },
    ],
    externalResources: [
      {
        id: 'RES_RET_REG',
        title: 'دليل تنظيم الترددات اللاسلكية بهيئة مترو القاهرة',
        url: 'https://cairo-metro.gov.eg/docs/freq-regulation.pdf',
        order: 1,
      },
    ],
  };

  const courseReturnedWithEdits: Course = {
    id: 'CRS-REV-RET-03',
    title: adminEditedSnapshotForCourse3.title,
    description: adminEditedSnapshotForCourse3.description,
    thumbnail: '',
    coverType: 'color',
    coverColor: '#047857',
    lecturerId: LECTURER_ID,
    lecturerName: LECTURER_NAME,
    coLecturers: [],
    assistants: [],
    targetJobTitles: adminEditedSnapshotForCourse3.targetJobTitles,
    level: adminEditedSnapshotForCourse3.level,
    estimatedHours: adminEditedSnapshotForCourse3.estimatedHours,
    rating: 0,
    ratingCount: 0,
    enrollmentCount: 0,
    status: 'draft',
    submittedAt: '2026-10-18T11:00:00.000Z',
    commentsEnabled: true,
    courseZipPolicy: adminEditedSnapshotForCourse3.courseZipPolicy,
    chapters: JSON.parse(JSON.stringify(adminEditedSnapshotForCourse3.chapters)),
    externalResources: JSON.parse(JSON.stringify(adminEditedSnapshotForCourse3.externalResources || [])),
    activeReviewFeedback: {
      outcome: 'returned_with_admin_edits',
      reviewerId: ADMIN_ID,
      reviewerName: ADMIN_NAME,
      reviewedAt: '2026-10-19T13:45:00.000Z',
      summaryMessage:
        'تمت مراجعة الحقيبة التدريبية؛ قامت إدارة الجودة بتعديل مسميات الفصول وإرفاق المرجع الدولي المعتمد لشبكات TETRA في الدرس الأول. يرجى مراجعة الفروق والاعتماد لإعادة التقديم.',
      items: [
        {
          targetType: 'chapter',
          targetId: 'CH_RET_01',
          title: 'ملاحظة على عنوان الفصل الأول',
          comment: 'تم تحديث العنوان ليتوافق مع المعايير الفنية لشبكة الخط الثالث.',
          severity: 'required',
        },
        {
          targetType: 'item',
          targetId: 'ITM_RET_101',
          title: 'ملاحظة على الدرس الأول',
          comment: 'تم إرفاق وثيقة المعايير الفنية كمصدر خارجي رسمي ملحق بالدرس.',
          severity: 'suggestion',
        },
      ],
      stagedEditsApplied: true,
    },
    auditLog: [
      {
        id: 'AUD_REV_RET_01',
        courseId: 'CRS-REV-RET-03',
        action: 'submitted',
        actorId: LECTURER_ID,
        actorName: LECTURER_NAME,
        actorRole: 'lecturer',
        timestamp: '2026-10-18T11:00:00.000Z',
        summary: `تم تقديم المقرر للمراجعة بواسطة المحاضر ${LECTURER_NAME}`,
      },
      {
        id: 'AUD_REV_RET_02',
        courseId: 'CRS-REV-RET-03',
        action: 'returned_with_admin_edits',
        actorId: ADMIN_ID,
        actorName: ADMIN_NAME,
        actorRole: 'admin',
        timestamp: '2026-10-19T13:45:00.000Z',
        summary: `تمت إعادة المقرر للمحاضر مع تعديلات إدارة الجودة بواسطة ${ADMIN_NAME}`,
        baselineSnapshot: baselineSnapshotForCourse3,
        adminEditedSnapshot: adminEditedSnapshotForCourse3,
        feedback: {
          outcome: 'returned_with_admin_edits',
          reviewerId: ADMIN_ID,
          reviewerName: ADMIN_NAME,
          reviewedAt: '2026-10-19T13:45:00.000Z',
          summaryMessage:
            'تمت مراجعة الحقيبة التدريبية؛ قامت إدارة الجودة بتعديل مسميات الفصول وإرفاق المرجع الدولي المعتمد لشبكات TETRA في الدرس الأول.',
          items: [],
          stagedEditsApplied: true,
        },
      },
    ],
    lastEditedByAdminId: ADMIN_ID,
    lastEditedByAdminName: ADMIN_NAME,
    adminEditedAt: '2026-10-19T13:45:00.000Z',
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Course 4: Rejected course with official rejection reason (Outcome C)
  // ───────────────────────────────────────────────────────────────────────────
  const courseRejected: Course = {
    id: 'CRS-REV-REJ-04',
    title: 'دليل استخدام وتطبيقات أجهزة القياس الميدانية المحمولة',
    description:
      'شرح استخدام أجهزة قياس فرق الجهد والمقاومة الحرارية لمكونات السكة والمحطات الكهربائية الفرعية.',
    thumbnail: '',
    coverType: 'color',
    coverColor: '#4b5563',
    lecturerId: LECTURER_ID,
    lecturerName: LECTURER_NAME,
    coLecturers: [],
    assistants: [],
    targetJobTitles: ['فني قياسات واختبارات', 'فني صيانة كهربائية'],
    level: 'مبتدئ',
    estimatedHours: 4,
    rating: 0,
    ratingCount: 0,
    enrollmentCount: 0,
    status: 'draft',
    submittedAt: '2026-10-18T13:00:00.000Z',
    commentsEnabled: true,
    chapters: [
      {
        id: 'CH_REJ_01',
        title: 'التعريف بأجهزة القياس الرقمية المتعددة (Multimeter)',
        order: 1,
        items: [
          {
            id: 'ITM_REJ_101',
            type: 'video',
            title: 'معايرة الجهاز واختيار المدى المناسب للقياس',
            duration: '08:00',
            views: 0,
            canDownload: false,
            downloadPolicy: 'never',
          },
        ],
      },
    ],
    activeReviewFeedback: {
      outcome: 'rejected',
      reviewerId: ADMIN_ID,
      reviewerName: ADMIN_NAME,
      reviewedAt: '2026-10-19T15:20:00.000Z',
      summaryMessage:
        'يتطلب المقرر مراجعة جذرية؛ حيث يفتقر إلى إجراءات السلامة المعتمدة عند قياس الجهد العالي (750V DC) ولا يحتوي على نماذج الفحص المعتمدة أو وثائق المعايرة الإلزامية.',
      items: [
        {
          targetType: 'course',
          targetId: 'CRS-REV-REJ-04',
          title: 'نقص في معايير السلامة الإلزامية',
          comment:
            'يرجى إضافة فصل كامل مخصص لاحتياطات السلامة ومهمات الوقاية قبل القياس على القضيب الثالث.',
          severity: 'required',
        },
      ],
      stagedEditsApplied: false,
    },
    auditLog: [
      {
        id: 'AUD_REV_REJ_01',
        courseId: 'CRS-REV-REJ-04',
        action: 'submitted',
        actorId: LECTURER_ID,
        actorName: LECTURER_NAME,
        actorRole: 'lecturer',
        timestamp: '2026-10-18T13:00:00.000Z',
        summary: `تم تقديم المقرر للمراجعة بواسطة المحاضر ${LECTURER_NAME}`,
      },
      {
        id: 'AUD_REV_REJ_02',
        courseId: 'CRS-REV-REJ-04',
        action: 'rejected',
        actorId: ADMIN_ID,
        actorName: ADMIN_NAME,
        actorRole: 'admin',
        timestamp: '2026-10-19T15:20:00.000Z',
        summary: `تم رفض المقرر وإعادته للمحاضر لطلب تعديلات جوهرية بواسطة ${ADMIN_NAME}`,
      },
    ],
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Course 5: Approved course that has been published (Outcome A)
  // ───────────────────────────────────────────────────────────────────────────
  const courseApprovedPublished: Course = {
    id: 'CRS-REV-APP-05',
    title: 'قواعد الأمان والسلامة في ورش الصيانة المركزية (طرة البلد)',
    description:
      'الدورة المعتمدة رسمياً للعاملين والفنيين بورش صيانة طرة البلد لتأمين بيئة العمل والالتزام بمعايير ISO 45001.',
    thumbnail: '',
    coverType: 'color',
    coverColor: '#0369a1',
    lecturerId: LECTURER_ID,
    lecturerName: LECTURER_NAME,
    coLecturers: [],
    assistants: [],
    targetJobTitles: ['فني صيانة ورش', 'مهندس سلامة وصحة مهنية'],
    level: 'متوسط',
    estimatedHours: 8,
    rating: 4.9,
    ratingCount: 52,
    enrollmentCount: 96,
    completionCount: 78,
    status: 'published',
    submittedAt: '2026-10-15T10:00:00.000Z',
    commentsEnabled: true,
    chapters: [
      {
        id: 'CH_APP_01',
        title: 'مخاطر بيئة العمل في ورش الصيانة الثقيلة والسكك',
        order: 1,
        items: [
          {
            id: 'ITM_APP_101',
            type: 'video',
            title: 'مناطق حركة الرافعات والمعدات الثقيلة داخل الورشة',
            duration: '14:00',
            views: 120,
            canDownload: false,
            downloadPolicy: 'never',
          },
          {
            id: 'ITM_APP_102',
            type: 'pdf',
            title: 'دليل السلامة الميداني وإشارات التنبيه بورشة طرة البلد',
            canDownload: true,
            downloadPolicy: 'immediate',
          },
        ],
      },
    ],
    auditLog: [
      {
        id: 'AUD_REV_APP_01',
        courseId: 'CRS-REV-APP-05',
        action: 'submitted',
        actorId: LECTURER_ID,
        actorName: LECTURER_NAME,
        actorRole: 'lecturer',
        timestamp: '2026-10-15T10:00:00.000Z',
        summary: `تم تقديم المقرر للمراجعة والاعتماد بواسطة ${LECTURER_NAME}`,
      },
      {
        id: 'AUD_REV_APP_02',
        courseId: 'CRS-REV-APP-05',
        action: 'approved',
        actorId: ADMIN_ID,
        actorName: ADMIN_NAME,
        actorRole: 'admin',
        timestamp: '2026-10-16T12:00:00.000Z',
        summary: `تم اعتماد ونشر المقرر بواسطة مدير النظام ${ADMIN_NAME}`,
        approvalNote: 'تم تدقيق المقرر بالكامل والتأكد من مطابقة شروط السلامة ونشره في الدليل العام.',
      },
    ],
  };

  return {
    courses: [
      courseNewPending,
      coursePublishedUpdateBase,
      courseReturnedWithEdits,
      courseRejected,
      courseApprovedPublished,
    ],
    drafts: {
      'CRS-REV-UPD-02': coursePublishedUpdateDraft,
    },
    stagedEdits: {
      'CRS-REV-UPD-02': stagedAdminEditsForCourse2,
    },
  };
}
