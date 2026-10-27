/**
 * Context-Aware WhatsApp Contact System Types & Models
 *
 * Supports Course, Group, Login, and General Platform contexts
 * with safe resolution, contact isolation, and prefilled Arabic messages.
 */

export type WhatsAppContactContextType = 'course' | 'group' | 'login' | 'general';

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
