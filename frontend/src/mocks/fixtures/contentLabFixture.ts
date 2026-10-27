import type { Course } from '@/core/courses/types';

/**
 * Dedicated Content Testing Lab Course Fixture
 * "معمل تجربة المحتوى — للاختبار فقط"
 * 
 * Specifically isolated for lecturer authoring, media testing, and storage verification.
 * Excluded from standard trainee enrollment and public catalog statistics.
 */
export const CONTENT_TEST_LAB_COURSE_ID = 'CRS_TEST_LAB';

export const createInitialContentLabFixture = (): Course => ({
  id: CONTENT_TEST_LAB_COURSE_ID,
  title: 'معمل تجربة المحتوى — للاختبار فقط',
  description:
    'مقرر اختباري مخصص للمحاضرين للتحقق المتكرر من إنشاء المحتوى، رفع وحفظ الوسائط، معاينة الفيديو المحلي والمستضاف (YouTube و Google Drive)، مستندات PDF الرقمية، والصور والمرفقات دون التأثير على الدورات الإنتاجية للمتدربين.',
  thumbnail: '',
  coverType: 'color',
  coverColor: '#0284c7', // Cairo Metro Cyan/Blue Theme
  lecturerId: 'usr_lect_002',
  lecturerName: 'د. طارق الجوهري',
  coLecturers: ['USR002', 'usr_admin_001'],
  assistants: [],
  targetJobTitles: ['محاضر معتمد', 'مسؤول جودة التدريب', 'مطور محتوى رقمي'],
  level: 'متوسط',
  estimatedHours: 4,
  rating: 5.0,
  ratingCount: 0,
  enrollmentCount: 0,
  completionCount: 0,
  dropoutCount: 0,
  returnRate: 0,
  requiresApproval: false,
  status: 'published',
  isTestLab: true,
  prerequisiteCourseId: null,
  prerequisiteCourseIds: [],
  knowledgePrerequisites: ['معرفة أساسية بواجهة منشئ المحتوى', 'فهم سياسات النشر والوسائط المحلية'],
  externalResources: [
    {
      id: 'LAB_RES_01',
      title: 'بوابة مترو القاهرة الرقمية للتدريب',
      url: 'https://cairometro.gov.eg',
      description: 'المرجع الرسمي لإجراءات التشغيل والسلامة المهنية',
      order: 1,
    },
    {
      id: 'LAB_RES_02',
      title: 'دليل معايير وضوابط المحتوى الرقمي',
      url: 'https://metro.gov.eg/docs/training-guidelines.pdf',
      description: 'دليل تنسيق الملفات وسياسات التنزيل المعتمدة',
      order: 2,
    },
  ],
  chapters: [
    {
      id: 'CH_LAB_01',
      title: 'الفصل الأول: سيناريوهات واختبارات مشغل الفيديو',
      order: 1,
      items: [
        {
          id: 'ITEM_LAB_VIDEO_LOCAL',
          type: 'video',
          videoSourceType: 'upload',
          title: '1. فيديو محلي مرفوع — فحص ثبات التخزين الدائم (IndexedDB)',
          url: '/dev-media/test-video.mp4',
          duration: '01:39',
          originalFileName: 'Inside Zoho Desk ﹕ Product Overview.mp4',
          fileSizeBytes: 12286536,
          mimeType: 'video/mp4',
          canDownload: true,
          downloadPolicy: 'immediate',
          requiresPrevious: false,
          externalResources: [
            {
              id: 'ITEM_RES_01',
              title: 'مواصفات ضغط وترميز الفيديو المحلي',
              url: 'https://metro.gov.eg/specs/video-encoding.pdf',
              order: 1,
            },
          ],
        },
        {
          id: 'ITEM_LAB_VIDEO_YOUTUBE',
          type: 'video',
          videoSourceType: 'youtube',
          title: '2. فيديو YouTube خارجي — المنصة التدريبية لمترو الأنفاق',
          youtubeVideoId: 'M7lc1UVf-VE',
          externalUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
          url: 'https://www.youtube.com/embed/M7lc1UVf-VE',
          duration: '10:00',
          canDownload: false,
          downloadPolicy: 'never',
          requiresPrevious: false,
          externalResources: [
            {
              id: 'ITEM_RES_02',
              title: 'دليل مطوري Google YouTube IFrame API',
              url: 'https://developers.google.com/youtube/iframe_api_reference',
              order: 1,
            },
          ],
        },
        {
          id: 'ITEM_LAB_VIDEO_GDRIVE',
          type: 'video',
          videoSourceType: 'drive',
          title: '3. فيديو Google Drive — صلاحيات المشاركة وتضمين المشغل',
          driveFileId: '1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx',
          externalUrl:
            'https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/view?usp=drive_link',
          url: 'https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/preview',
          duration: '05:00',
          canDownload: false,
          downloadPolicy: 'never',
          requiresPrevious: false,
          externalResources: [
            {
              id: 'ITEM_RES_03',
              title: 'إرشادات ضبط أذونات المشاركة العامة في Google Drive',
              url: 'https://support.google.com/drive/answer/2494822',
              order: 1,
            },
          ],
        },
      ],
    },
    {
      id: 'CH_LAB_02',
      title: 'الفصل الثاني: سيناريوهات المستندات والصور والموارد القابلة للتنزيل',
      order: 2,
      items: [
        {
          id: 'ITEM_LAB_PDF_DOC',
          type: 'pdf',
          title: '4. مستند إرشادي رقمي PDF — العرض المدمج داخل التطبيق',
          url: '/dev-media/test-document.pdf',
          originalFileName: 'sample-technical-guide.pdf',
          fileSizeBytes: 468395,
          pages: 6,
          canDownload: true,
          downloadPolicy: 'immediate',
          requiresPrevious: false,
        },
        {
          id: 'ITEM_LAB_IMG_DIAGRAM',
          type: 'image',
          title: '5. مخطط هندسي توضيحي — معاينة الصور والرسوم البيانية',
          url: '/favicon.png',
          originalFileName: 'metro-network-schema.png',
          fileSizeBytes: 4844,
          mimeType: 'image/png',
          canDownload: true,
          downloadPolicy: 'immediate',
          requiresPrevious: false,
        },
        {
          id: 'ITEM_LAB_DOWNLOAD_ZIP',
          type: 'zip',
          title: '6. حزمة أدوات تشغيلية ZIP — ملف مخصص للتنزيل المباشر',
          url: '/dev-media/test-document.pdf',
          originalFileName: 'metro-operational-tools.zip',
          fileSizeBytes: 1048576,
          mimeType: 'application/zip',
          canDownload: true,
          downloadPolicy: 'immediate',
          requiresPrevious: false,
        },
      ],
    },
  ],
  createdAt: '2026-10-18',
  commentsEnabled: true,
  courseZipPolicy: 'immediate',
});
