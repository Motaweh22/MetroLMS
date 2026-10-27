import type { User } from './types';

export interface SyntheticMockAccount {
  credentials: {
    email: string;
    password: string;
  };
  user: User;
  descriptionAr: string;
}

/**
 * Synthetic Demo Accounts for Frontend Development and Testing
 *
 * GOVERNANCE NOTICE:
 * These accounts are 100% synthetic fixtures created exclusively for the modern React frontend.
 * They contain NO real credentials and NO records imported from legacy data/users.json.
 */
export const SYNTHETIC_DEMO_ACCOUNTS: Record<string, SyntheticMockAccount> = {
  admin: {
    credentials: {
      email: 'admin@cairo-metro.com',
      password: 'metroAdmin2026!',
    },
    user: {
      id: 'usr_admin_001',
      email: 'admin@cairo-metro.com',
      name: 'م. محمود عبد السلام',
      role: 'admin',
      department: 'الإدارة العامة للتشغيل والتحكم المركزي',
      jobTitle: 'مدير عام أنظمة التشغيل',
      initials: 'م.ع',
    },
    descriptionAr: 'مسؤول النظام — الصلاحيات الإدارية الكاملة واعتماد البرامج',
  },
  assistant_admin: {
    credentials: {
      email: 'assistant.admin@metro.gov.eg',
      password: 'metroAssistantAdmin2026!',
    },
    user: {
      id: 'USR016',
      email: 'assistant.admin@metro.gov.eg',
      name: 'أحمد شريف (مساعد مدير)',
      role: 'assistant_admin',
      department: 'الإدارة العامة لتكنولوجيا المعلومات',
      jobTitle: 'مساعد مدير نظام',
      initials: 'أ.ش',
    },
    descriptionAr: 'مدير نظام مساعد — صلاحيات تشغيلية وإدارية تخضع للاعتماد',
  },
  lecturer: {
    credentials: {
      email: 'lecturer@cairo-metro.com',
      password: 'metroTrainer2026!',
    },
    user: {
      id: 'usr_lect_002',
      email: 'lecturer@cairo-metro.com',
      name: 'د. طارق الجوهري',
      role: 'lecturer',
      department: 'مركز تدريب وإعداد القادة بمترو القاهرة',
      jobTitle: 'كبير مدربي الإشارات والتحكم الآلي',
      initials: 'د.ط',
    },
    descriptionAr: 'محاضر معتمد — إعداد الحقائب التدريبية ومتابعة المتدربين',
  },
  assistant_lecturer: {
    credentials: {
      email: 'assistant.lecturer@metro.gov.eg',
      password: 'metroAssistantTrainer2026!',
    },
    user: {
      id: 'USR017',
      email: 'assistant.lecturer@metro.gov.eg',
      name: 'د. سارة خليل (محاضر مساعد)',
      role: 'lecturer',
      department: 'مركز التدريب التخصصي',
      jobTitle: 'محاضر مساعد معتمد',
      initials: 'س.خ',
    },
    descriptionAr: 'محاضر مساعد — محاضر معتمد مؤهل لمهام المساعد في المجموعات التدريبية',
  },
  trainee: {
    credentials: {
      email: 'trainee@cairo-metro.com',
      password: 'metroLearner2026!',
    },
    user: {
      id: 'usr_trainee_003',
      email: 'trainee@cairo-metro.com',
      name: 'أحمد ممدوح سالم',
      role: 'user',
      department: 'قطاع صيانة الوحدات المتحركة — الخط الأول',
      jobTitle: 'فني صيانة قطارات أول',
      initials: 'أ.م',
    },
    descriptionAr: 'متدرب فني — مسار الصيانة الوقائية والسلامة المهنية',
  },
};

export const DEMO_ACCOUNTS_LIST = Object.values(SYNTHETIC_DEMO_ACCOUNTS);
