import type {
  CanonicalDepartmentDTO,
  CanonicalTrackDTO,
  DepartmentPermissionDTO,
} from '@/core/permissions/types';

/**
 * 10 Canonical Organizational Departments of Cairo Metro LMS
 * Grounded in the central employee directory and operational sector structure.
 */
export const CANONICAL_DEPARTMENTS: CanonicalDepartmentDTO[] = [
  {
    id: 'DEPT-OPERATIONS',
    nameAr: 'قطاع التشغيل',
    nameEn: 'Operations Sector',
    descriptionAr: 'يشمل سائقي القطارات، ناظري المحطات، ومراقبي الحركة المركزية بالخطوط الثلاثة.',
  },
  {
    id: 'DEPT-MAINTENANCE',
    nameAr: 'قطاع الصيانة',
    nameEn: 'Maintenance Sector',
    descriptionAr: 'الصيانة الشاملة للبنية الأساسية، ورش الوحدات المتحركة، والمنشآت الميدانية.',
  },
  {
    id: 'DEPT-ELEC-MAINT',
    nameAr: 'قطاع الصيانة الكهربائية',
    nameEn: 'Electrical Maintenance Sector',
    descriptionAr: 'تغذية القضيب الثالث، محطات المحولات الكهربائية، والشبكات الهوائية.',
  },
  {
    id: 'DEPT-MECH-MAINT',
    nameAr: 'قطاع الصيانة الميكانيكية',
    nameEn: 'Mechanical Maintenance Sector',
    descriptionAr: 'البواجي، أنظمة المكابح الهوائية، الأبواب الأوتوماتيكية، وأنظمة التكييف.',
  },
  {
    id: 'DEPT-SIGNALS',
    nameAr: 'قطاع الإشارات والاتصالات',
    nameEn: 'Signaling & Telecom Sector',
    descriptionAr: 'أنظمة التحكم الآلي ATC، الدوائر الكهربائية للسكة، والاتصالات اللاسلكية.',
  },
  {
    id: 'DEPT-TRAINING',
    nameAr: 'إدارة التدريب',
    nameEn: 'Training Department',
    descriptionAr: 'إعداد الحقائب التدريبية التخصصية، تأهيل المدربين، وإدارة مختبرات المحاكاة.',
  },
  {
    id: 'DEPT-IT',
    nameAr: 'إدارة تكنولوجيا المعلومات',
    nameEn: 'Information Technology Department',
    descriptionAr: 'نظم إصدار التذاكر والبوابات الإلكترونية، قواعد البيانات، والشبكات المركزية.',
  },
  {
    id: 'DEPT-CUSTOMER',
    nameAr: 'قطاع خدمة العملاء',
    nameEn: 'Customer Service Sector',
    descriptionAr: 'خدمة الركاب في شبابيك التذاكر، مكاتب الاشتراكات، والتعامل مع شكاوى الجمهور.',
  },
  {
    id: 'DEPT-SECURITY',
    nameAr: 'قطاع الأمن',
    nameEn: 'Security Sector',
    descriptionAr: 'تأمين أرصفة المحطات، مداخل البوابات، ومرافقة مسير القطارات.',
  },
  {
    id: 'DEPT-GEN-ADMIN',
    nameAr: 'الإدارة العامة',
    nameEn: 'General Administration',
    descriptionAr: 'الشؤون الإدارية، الموارد البشرية، الشؤون القانونية، والمالية المركزية.',
  },
];

/**
 * 7 Canonical Training Tracks of Cairo Metro Technical Academy
 * Directly aligned with operational curricula and legacy admin configurations.
 */
export const CANONICAL_TRACKS: CanonicalTrackDTO[] = [
  {
    id: 'TRK-001',
    code: 'TRK-SAFETY-SECURITY',
    nameAr: 'السلامة والصحة المهنية وتأمين المسارات',
    nameEn: 'Occupational Health, Safety & Track Security',
    descriptionAr: 'بروتوكولات الوقاية من مخاطر الجهد العالي، خطط الإخلاء في الأنفاق، وإجراءات الطوارئ.',
  },
  {
    id: 'TRK-002',
    code: 'TRK-TRAIN-OPS',
    nameAr: 'تعليمات تشغيل وقيادة القطارات',
    nameEn: 'Train Operation & Driving Regulations',
    descriptionAr: 'قواعد المسير، التعامل مع إشارات السيمافور، ومناورات الأحواش في الورش الميدانية.',
  },
  {
    id: 'TRK-003',
    code: 'TRK-ROLLING-STOCK',
    nameAr: 'صيانة الوحدات المتحركة والقطارات',
    nameEn: 'Rolling Stock & Train Fleet Maintenance',
    descriptionAr: 'الفحص الدوري للعربات، أنظمة الجر الكهربائي، الدروع، وفحص العجلات والمحاور.',
  },
  {
    id: 'TRK-004',
    code: 'TRK-STATION-MAINT',
    nameAr: 'صيانة المحطات والمرافق الفنية',
    nameEn: 'Station Facilities & Technical Maintenance',
    descriptionAr: 'مراوح التهوية العملاقة، طلمبات نزح المياه الجوفية، السلالم الكهربائية، والمصاعد.',
  },
  {
    id: 'TRK-005',
    code: 'TRK-SIGNALS-TELECOM',
    nameAr: 'أنظمة الإشارات والاتصالات والتحكم المركزي',
    nameEn: 'Signaling, Telecom & Centralized Traffic Control',
    descriptionAr: 'صيانة مفاتيح التحويل، مسارات كابلات الألياف الضوئية، ونظام التحكم الآلي بالقطار.',
  },
  {
    id: 'TRK-006',
    code: 'TRK-CUSTOMER-SERVICE',
    nameAr: 'خدمة العملاء والتعامل مع جمهور الركاب',
    nameEn: 'Customer Service & Passenger Relations',
    descriptionAr: 'إدارة تدفق الركاب بأوقات الذروة، اشتراكات الطلاب، ومساعدة كبار السن وذوي الهمم.',
  },
  {
    id: 'TRK-007',
    code: 'TRK-IT-SYSTEMS',
    nameAr: 'تكنولوجيا المعلومات ونظم التذاكر والبوابات',
    nameEn: 'IT Systems, Smart Ticketing & Turnstiles',
    descriptionAr: 'صيانة بوابات العبور الذكية، أجهزة شحن الكروت الذكية TVM، وخوادم الاتصال المركزي.',
  },
];

/**
 * Baseline Department-to-Track Mapping Fixtures
 * Initialized deterministically on store creation and reset.
 */
export const INITIAL_DEPARTMENT_TRACKS: Record<string, DepartmentPermissionDTO> = {
  'DEPT-OPERATIONS': {
    departmentId: 'DEPT-OPERATIONS',
    departmentName: 'قطاع التشغيل',
    allowedTracks: ['TRK-001', 'TRK-002'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-MAINTENANCE': {
    departmentId: 'DEPT-MAINTENANCE',
    departmentName: 'قطاع الصيانة',
    allowedTracks: ['TRK-001', 'TRK-003', 'TRK-004'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-ELEC-MAINT': {
    departmentId: 'DEPT-ELEC-MAINT',
    departmentName: 'قطاع الصيانة الكهربائية',
    allowedTracks: ['TRK-001', 'TRK-003', 'TRK-004'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-MECH-MAINT': {
    departmentId: 'DEPT-MECH-MAINT',
    departmentName: 'قطاع الصيانة الميكانيكية',
    allowedTracks: ['TRK-001', 'TRK-003'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-SIGNALS': {
    departmentId: 'DEPT-SIGNALS',
    departmentName: 'قطاع الإشارات والاتصالات',
    allowedTracks: ['TRK-001', 'TRK-005'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-TRAINING': {
    departmentId: 'DEPT-TRAINING',
    departmentName: 'إدارة التدريب',
    allowedTracks: ['TRK-001', 'TRK-002', 'TRK-003', 'TRK-004', 'TRK-005', 'TRK-006', 'TRK-007'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-IT': {
    departmentId: 'DEPT-IT',
    departmentName: 'إدارة تكنولوجيا المعلومات',
    allowedTracks: ['TRK-001', 'TRK-007'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-CUSTOMER': {
    departmentId: 'DEPT-CUSTOMER',
    departmentName: 'قطاع خدمة العملاء',
    allowedTracks: ['TRK-001', 'TRK-006'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-SECURITY': {
    departmentId: 'DEPT-SECURITY',
    departmentName: 'قطاع الأمن',
    allowedTracks: ['TRK-001'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
  'DEPT-GEN-ADMIN': {
    departmentId: 'DEPT-GEN-ADMIN',
    departmentName: 'الإدارة العامة',
    allowedTracks: ['TRK-001'],
    updatedAt: '2026-01-15T08:00:00Z',
    updatedBy: 'usr_admin_001',
  },
};

/**
 * Resolves any valid department ID or exact Arabic name to its canonical department record.
 */
export function resolveCanonicalDepartment(idOrName: string): CanonicalDepartmentDTO | undefined {
  if (!idOrName) return undefined;
  const q = idOrName.trim().toLowerCase();
  return CANONICAL_DEPARTMENTS.find(
    (d) =>
      d.id.toLowerCase() === q ||
      d.nameAr.toLowerCase() === q ||
      d.nameEn.toLowerCase() === q ||
      d.id.toLowerCase().replace('dept-', '') === q.replace('dept-', '')
  );
}

/**
 * Resolves any track ID or track code to its canonical track record.
 */
export function resolveCanonicalTrack(idOrCode: string): CanonicalTrackDTO | undefined {
  if (!idOrCode) return undefined;
  const q = idOrCode.trim().toLowerCase();
  return CANONICAL_TRACKS.find(
    (t) =>
      t.id.toLowerCase() === q ||
      t.code.toLowerCase() === q ||
      t.nameAr.toLowerCase() === q
  );
}
