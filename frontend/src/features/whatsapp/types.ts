/**
 * Context-Aware WhatsApp Contact System Types & Models
 *
 * Supports Course, Group, Login, and General Platform contexts
 * with safe resolution, contact isolation, and prefilled Arabic messages.
 */

export type WhatsAppContactContextType = 'course' | 'group' | 'login' | 'general' | 'technical_support';

export interface WhatsAppContact {
  id: string;
  name: string;
  role: string;
  number: string; // Sanitized digits for wa.me URL
  displayNumber?: string;
  avatarInitial?: string;
  isAvailable?: boolean;
}

export interface WhatsAppContextCourseConfig {
  id: string;
  title: string;
  lecturerId?: string;
  lecturerName?: string;
  coLecturers?: string[];
  whatsappContacts?: Array<{
    name: string;
    number: string;
    role?: string;
  }>;
}

export interface WhatsAppContextGroupConfig {
  id: string;
  name: string;
  primaryInstructorId?: string | null;
  assistantLecturerIds?: string[];
  supervisorIds?: string[];
  assistantIds?: string[];
  traineeIds?: string[];
  whatsappContacts?: Array<{
    name: string;
    number: string;
    role?: string;
  }>;
}

export interface WhatsAppContextConfig {
  context: WhatsAppContactContextType;
  titleAr?: string;
  course?: WhatsAppContextCourseConfig;
  group?: WhatsAppContextGroupConfig;
  customMessage?: string;
}

// ── Phase 2: Platform Support Assignment Models & Resolution DTOs ─────────

export type WhatsAppSupportScenario =
  | 'account_registration'
  | 'password_recovery'
  | 'technical_support';

export interface UserWhatsAppSupportAssignment {
  id: string;
  user_id: string;
  scenario: WhatsAppSupportScenario;
  is_active: boolean;
  order_index: number;
  assigned_by: string;
  created_at: string;
  updated_at: string;
}

export interface UserWhatsAppAssignmentItemDTO {
  scenario: WhatsAppSupportScenario;
  isActive: boolean;
  orderIndex?: number;
  assignedAt?: string;
  assignedBy?: string;
  updatedAt?: string;
}

export interface UserWhatsAppVisibilityConfigDTO {
  userId: string;
  userName: string;
  userPhone?: string;          // Direct read from users.phone (single source of truth)
  cleanPhone: string | null;   // Canonical 12-digit digits-only string for wa.me URLs
  displayPhone?: string;       // International notation for UI display (+20 101 234 5678)
  isPhoneValid: boolean;       // Boolean(cleanPhone)
  isAccountActive: boolean;    // user.status !== 'suspended'
  assignments: UserWhatsAppAssignmentItemDTO[];
}

export interface SaveUserWhatsAppVisibilityPayload {
  userId?: string;
  assignments: Array<{
    scenario: WhatsAppSupportScenario;
    isActive: boolean;
    orderIndex?: number;
  }>;
}

export interface ResolvedSupportContactDTO {
  id: string;
  userId: string;
  name: string;
  jobTitle?: string;
  department?: string;
  number: string;              // Strictly 12 digits-only for wa.me URL (e.g. '201010000001')
  displayNumber?: string;      // International notation for UI display (e.g. '+20 101 000 0001')
  avatarInitial?: string;
  scenario: WhatsAppSupportScenario;
}

export interface PublicSupportContactsResponseDTO {
  scenario: WhatsAppSupportScenario;
  count: number;
  contacts: ResolvedSupportContactDTO[];
}
