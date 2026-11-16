import type { Course } from '@/core/courses/types';

/**
 * Authentic Synthetic Course Fixtures
 * Derived from Cairo Metro LMS legacy curriculum schema.
 * Contains sanitized operational courses without credentials or PII.
 */
export const MOCK_COURSES: Course[] = [
  {
    "id": "CRS001",
    "title": "سلامة العمل والسلوك المهني",
    "description": "كورس شامل لقواعد السلامة المهنية في بيئة عمل مترو الأنفاق وأهم الإجراءات الواجب اتباعها للحفاظ على سلامة العاملين والركاب",
    "thumbnail": "",
    "lecturerId": "USR002",
    "lecturerName": "م. خالد إبراهيم",
    "coLecturers": [],
    "assistants": [],
    "targetJobTitles": [
      "مهندس تشغيل",
      "فني صيانة",
      "سائق قطار",
      "مشرف محطة"
    ],
    "level": "مبتدئ",
    "estimatedHours": 8,
    "rating": 4.7,
    "ratingCount": 124,
    "enrollmentCount": 245,
    "completionCount": 198,
    "dropoutCount": 47,
    "returnRate": 3.2,
    "requiresApproval": false,
    "status": "published",
    "prerequisiteCourseId": null,
    "chapters": [
      {
        "id": "CH01",
        "title": "مقدمة في السلامة المهنية",
        "order": 1,
        "items": [
          {
            "id": "ITEM001",
            "type": "video",
            "title": "مفاهيم السلامة الأساسية",
            "duration": "18:30",
            "views": 312,
            "rewatchCount": 89,
            "canDownload": false,
            "requiresPrevious": false
          },
          {
            "id": "ITEM002",
            "type": "pdf",
            "title": "دليل السلامة المهنية",
            "pages": 24,
            "opensCount": 201,
            "canDownload": false
          }
        ]
      },
      {
        "id": "CH02",
        "title": "إجراءات السلامة في الأنفاق",
        "order": 2,
        "items": [
          {
            "id": "ITEM003",
            "type": "video",
            "title": "معدات الحماية الشخصية",
            "duration": "22:15",
            "views": 278,
            "rewatchCount": 65,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM004",
            "type": "pdf",
            "title": "قائمة فحص السلامة اليومية",
            "pages": 8,
            "opensCount": 189,
            "canDownload": true
          },
          {
            "id": "ITEM005",
            "type": "video",
            "title": "التعامل مع المواد الخطرة",
            "duration": "15:45",
            "views": 245,
            "rewatchCount": 42,
            "canDownload": false,
            "requiresPrevious": true
          }
        ]
      },
      {
        "id": "CH03",
        "title": "السلوك المهني والانضباط",
        "order": 3,
        "items": [
          {
            "id": "ITEM006",
            "type": "video",
            "title": "أخلاقيات العمل في المترو",
            "duration": "20:00",
            "views": 230,
            "rewatchCount": 35,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM007",
            "type": "pdf",
            "title": "ميثاق السلوك المهني",
            "pages": 16,
            "opensCount": 175,
            "canDownload": true
          }
        ]
      }
    ],
    "createdAt": "2025-03-10",
    "commentsEnabled": true
  },
  {
    "id": "CRS002",
    "title": "خدمة العملاء في مترو الأنفاق",
    "description": "تدريب شامل على مهارات التواصل مع الركاب والتعامل مع الشكاوى وتقديم أفضل تجربة خدمة عملاء في محطات المترو",
    "thumbnail": "",
    "lecturerId": "USR002",
    "lecturerName": "م. خالد إبراهيم",
    "coLecturers": [],
    "assistants": [],
    "targetJobTitles": [
      "موظف خدمة عملاء",
      "مشرف محطة",
      "موظف إداري"
    ],
    "level": "مبتدئ",
    "estimatedHours": 6,
    "rating": 4.5,
    "ratingCount": 98,
    "enrollmentCount": 189,
    "completionCount": 156,
    "dropoutCount": 33,
    "returnRate": 2.8,
    "requiresApproval": false,
    "status": "published",
    "prerequisiteCourseId": null,
    "chapters": [
      {
        "id": "CH01",
        "title": "أساسيات خدمة العملاء",
        "order": 1,
        "items": [
          {
            "id": "ITEM201",
            "type": "video",
            "title": "مبادئ التواصل الفعال مع الركاب",
            "duration": "25:00",
            "views": 267,
            "rewatchCount": 55,
            "canDownload": false,
            "requiresPrevious": false
          },
          {
            "id": "ITEM202",
            "type": "pdf",
            "title": "دليل التعامل مع أنواع الركاب",
            "pages": 18,
            "opensCount": 178,
            "canDownload": true
          }
        ]
      },
      {
        "id": "CH02",
        "title": "التعامل مع الشكاوى والمواقف الصعبة",
        "order": 2,
        "items": [
          {
            "id": "ITEM203",
            "type": "video",
            "title": "فن إدارة الشكاوى",
            "duration": "20:30",
            "views": 234,
            "rewatchCount": 78,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM204",
            "type": "video",
            "title": "سيناريوهات عملية في المحطات",
            "duration": "30:00",
            "views": 198,
            "rewatchCount": 92,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM205",
            "type": "pdf",
            "title": "نماذج تقارير الشكاوى",
            "pages": 12,
            "opensCount": 145,
            "canDownload": true
          }
        ]
      },
      {
        "id": "CH03",
        "title": "مهارات التواصل المتقدمة",
        "order": 3,
        "items": [
          {
            "id": "ITEM206",
            "type": "video",
            "title": "التعامل مع ذوي الاحتياجات الخاصة",
            "duration": "18:00",
            "views": 189,
            "rewatchCount": 41,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM207",
            "type": "pdf",
            "title": "بروتوكول خدمة كبار السن والأطفال",
            "pages": 10,
            "opensCount": 156,
            "canDownload": true
          }
        ]
      }
    ],
    "createdAt": "2025-04-01",
    "commentsEnabled": true
  },
  {
    "id": "CRS003",
    "title": "تشغيل وصيانة القطارات",
    "description": "كورس متقدم يغطي أنظمة تشغيل القطارات والصيانة الدورية والوقائية لضمان أعلى معايير الأداء والسلامة في مترو القاهرة",
    "thumbnail": "",
    "lecturerId": "USR002",
    "lecturerName": "م. خالد إبراهيم",
    "coLecturers": [],
    "assistants": [],
    "targetJobTitles": [
      "مهندس تشغيل",
      "فني صيانة",
      "مهندس كهرباء",
      "مهندس ميكانيكا"
    ],
    "level": "متقدم",
    "estimatedHours": 12,
    "rating": 4.8,
    "ratingCount": 87,
    "enrollmentCount": 156,
    "completionCount": 112,
    "dropoutCount": 44,
    "returnRate": 4.1,
    "requiresApproval": false,
    "status": "published",
    "prerequisiteCourseId": "CRS001",
    "chapters": [
      {
        "id": "CH01",
        "title": "أنظمة القطارات الكهربائية",
        "order": 1,
        "items": [
          {
            "id": "ITEM301",
            "type": "video",
            "title": "مكونات نظام الجر الكهربائي",
            "duration": "35:00",
            "views": 198,
            "rewatchCount": 112,
            "canDownload": false,
            "requiresPrevious": false
          },
          {
            "id": "ITEM302",
            "type": "pdf",
            "title": "المخططات الكهربائية للقطارات",
            "pages": 42,
            "opensCount": 167,
            "canDownload": false
          },
          {
            "id": "ITEM303",
            "type": "video",
            "title": "أنظمة التحكم والفرملة",
            "duration": "28:15",
            "views": 176,
            "rewatchCount": 89,
            "canDownload": false,
            "requiresPrevious": true
          }
        ]
      },
      {
        "id": "CH02",
        "title": "الصيانة الدورية والوقائية",
        "order": 2,
        "items": [
          {
            "id": "ITEM304",
            "type": "video",
            "title": "جداول الصيانة الدورية",
            "duration": "22:30",
            "views": 156,
            "rewatchCount": 67,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM305",
            "type": "pdf",
            "title": "قوائم فحص الصيانة الوقائية",
            "pages": 32,
            "opensCount": 134,
            "canDownload": true
          },
          {
            "id": "ITEM306",
            "type": "video",
            "title": "تشخيص الأعطال وإصلاحها",
            "duration": "40:00",
            "views": 189,
            "rewatchCount": 134,
            "canDownload": false,
            "requiresPrevious": true
          }
        ]
      },
      {
        "id": "CH03",
        "title": "أنظمة السلامة في القطارات",
        "order": 3,
        "items": [
          {
            "id": "ITEM307",
            "type": "video",
            "title": "أنظمة الإنذار والحماية",
            "duration": "25:00",
            "views": 145,
            "rewatchCount": 56,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM308",
            "type": "pdf",
            "title": "بروتوكولات السلامة التشغيلية",
            "pages": 28,
            "opensCount": 123,
            "canDownload": true
          }
        ]
      }
    ],
    "createdAt": "2025-05-01",
    "commentsEnabled": true
  },
  {
    "id": "CRS004",
    "title": "الإسعافات الأولية الطارئة",
    "description": "تدريب عملي على الإسعافات الأولية والتعامل مع الحالات الطارئة في محطات ومركبات المترو لضمان سلامة الركاب والعاملين",
    "thumbnail": "",
    "lecturerId": "USR002",
    "lecturerName": "م. خالد إبراهيم",
    "coLecturers": [],
    "assistants": [],
    "targetJobTitles": [
      "مشرف محطة",
      "مشرف أمن",
      "سائق قطار",
      "موظف خدمة عملاء"
    ],
    "level": "متوسط",
    "estimatedHours": 10,
    "rating": 4.9,
    "ratingCount": 156,
    "enrollmentCount": 312,
    "completionCount": 267,
    "dropoutCount": 45,
    "returnRate": 2.5,
    "requiresApproval": false,
    "status": "published",
    "prerequisiteCourseId": null,
    "chapters": [
      {
        "id": "CH01",
        "title": "أساسيات الإسعافات الأولية",
        "order": 1,
        "items": [
          {
            "id": "ITEM401",
            "type": "video",
            "title": "تقييم الحالة الطارئة",
            "duration": "20:00",
            "views": 345,
            "rewatchCount": 98,
            "canDownload": false,
            "requiresPrevious": false
          },
          {
            "id": "ITEM402",
            "type": "pdf",
            "title": "دليل الإسعافات الأولية المصور",
            "pages": 36,
            "opensCount": 289,
            "canDownload": true
          },
          {
            "id": "ITEM403",
            "type": "video",
            "title": "الإنعاش القلبي الرئوي (CPR)",
            "duration": "30:00",
            "views": 312,
            "rewatchCount": 156,
            "canDownload": false,
            "requiresPrevious": true
          }
        ]
      },
      {
        "id": "CH02",
        "title": "حالات الطوارئ في المترو",
        "order": 2,
        "items": [
          {
            "id": "ITEM404",
            "type": "video",
            "title": "التعامل مع حالات الإغماء والصرع",
            "duration": "25:00",
            "views": 278,
            "rewatchCount": 87,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM405",
            "type": "video",
            "title": "إسعاف الكسور والجروح",
            "duration": "22:30",
            "views": 256,
            "rewatchCount": 76,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM406",
            "type": "pdf",
            "title": "محتويات حقيبة الإسعافات الأولية",
            "pages": 8,
            "opensCount": 234,
            "canDownload": true
          }
        ]
      }
    ],
    "createdAt": "2025-04-15",
    "commentsEnabled": true
  },
  {
    "id": "CRS005",
    "title": "إدارة الأزمات والطوارئ",
    "description": "كورس متقدم في إدارة الأزمات والتعامل مع حالات الطوارئ الكبرى في منظومة مترو الأنفاق بما يشمل خطط الإخلاء والتنسيق مع الجهات المعنية",
    "thumbnail": "",
    "lecturerId": "USR002",
    "lecturerName": "م. خالد إبراهيم",
    "coLecturers": [],
    "assistants": [],
    "targetJobTitles": [
      "مشرف محطة",
      "مشرف أمن",
      "مهندس تشغيل"
    ],
    "level": "متقدم",
    "estimatedHours": 14,
    "rating": 4.6,
    "ratingCount": 67,
    "enrollmentCount": 98,
    "completionCount": 72,
    "dropoutCount": 26,
    "returnRate": 3.8,
    "requiresApproval": true,
    "status": "published",
    "prerequisiteCourseId": null,
    "chapters": [
      {
        "id": "CH01",
        "title": "مفاهيم إدارة الأزمات",
        "order": 1,
        "items": [
          {
            "id": "ITEM501",
            "type": "video",
            "title": "أنواع الأزمات في منظومة المترو",
            "duration": "28:00",
            "views": 134,
            "rewatchCount": 45,
            "canDownload": false,
            "requiresPrevious": false
          },
          {
            "id": "ITEM502",
            "type": "pdf",
            "title": "خطة إدارة الأزمات الشاملة",
            "pages": 48,
            "opensCount": 112,
            "canDownload": false
          }
        ]
      },
      {
        "id": "CH02",
        "title": "خطط الإخلاء والتعامل مع الحرائق",
        "order": 2,
        "items": [
          {
            "id": "ITEM503",
            "type": "video",
            "title": "إجراءات إخلاء المحطات والقطارات",
            "duration": "35:00",
            "views": 112,
            "rewatchCount": 67,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM504",
            "type": "video",
            "title": "استخدام معدات مكافحة الحرائق",
            "duration": "20:00",
            "views": 98,
            "rewatchCount": 34,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM505",
            "type": "pdf",
            "title": "خرائط مسارات الإخلاء",
            "pages": 20,
            "opensCount": 89,
            "canDownload": true
          }
        ]
      },
      {
        "id": "CH03",
        "title": "التنسيق مع جهات الطوارئ",
        "order": 3,
        "items": [
          {
            "id": "ITEM506",
            "type": "video",
            "title": "بروتوكول التواصل مع الدفاع المدني",
            "duration": "22:00",
            "views": 87,
            "rewatchCount": 28,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM507",
            "type": "pdf",
            "title": "أرقام الطوارئ وجهات الاتصال",
            "pages": 6,
            "opensCount": 78,
            "canDownload": true
          }
        ]
      }
    ],
    "createdAt": "2025-06-01",
    "commentsEnabled": true
  },
  {
    "id": "CRS006",
    "title": "اللوائح والأنظمة الداخلية",
    "description": "كورس تعريفي باللوائح والأنظمة الداخلية للشركة المصرية لإدارة وتشغيل المترو وحقوق وواجبات العاملين والإجراءات الإدارية",
    "thumbnail": "",
    "lecturerId": "USR002",
    "lecturerName": "م. خالد إبراهيم",
    "coLecturers": [],
    "assistants": [],
    "targetJobTitles": [
      "موظف إداري",
      "مشرف محطة",
      "موظف خدمة عملاء",
      "مشرف أمن"
    ],
    "level": "مبتدئ",
    "estimatedHours": 5,
    "rating": 4.3,
    "ratingCount": 178,
    "enrollmentCount": 356,
    "completionCount": 312,
    "dropoutCount": 44,
    "returnRate": 1.9,
    "requiresApproval": false,
    "status": "published",
    "prerequisiteCourseId": null,
    "chapters": [
      {
        "id": "CH01",
        "title": "الهيكل التنظيمي والإداري",
        "order": 1,
        "items": [
          {
            "id": "ITEM601",
            "type": "video",
            "title": "التعريف بالشركة والهيكل الإداري",
            "duration": "15:00",
            "views": 389,
            "rewatchCount": 45,
            "canDownload": false,
            "requiresPrevious": false
          },
          {
            "id": "ITEM602",
            "type": "pdf",
            "title": "دليل الموظف الجديد",
            "pages": 32,
            "opensCount": 345,
            "canDownload": true
          }
        ]
      },
      {
        "id": "CH02",
        "title": "حقوق وواجبات العاملين",
        "order": 2,
        "items": [
          {
            "id": "ITEM603",
            "type": "video",
            "title": "نظام الإجازات والحوافز",
            "duration": "18:00",
            "views": 356,
            "rewatchCount": 67,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM604",
            "type": "pdf",
            "title": "لائحة الجزاءات والمخالفات",
            "pages": 20,
            "opensCount": 312,
            "canDownload": true
          },
          {
            "id": "ITEM605",
            "type": "video",
            "title": "إجراءات التظلم والشكاوى الداخلية",
            "duration": "12:00",
            "views": 289,
            "rewatchCount": 34,
            "canDownload": false,
            "requiresPrevious": true
          },
          {
            "id": "ITEM606",
            "type": "video",
            "videoSourceType": "youtube",
            "youtubeVideoId": "M7lc1UVf-VE",
            "externalUrl": "https://www.youtube.com/watch?v=M7lc1UVf-VE",
            "title": "محاضرة تطبيقية عبر YouTube: المنصة الرقمية لمترو الأنفاق",
            "duration": "10:00",
            "views": 150,
            "rewatchCount": 18,
            "canDownload": false,
            "downloadPolicy": "never",
            "requiresPrevious": false
          }
        ]
      }
    ],
    "createdAt": "2025-03-20",
    "commentsEnabled": true
  }
];
