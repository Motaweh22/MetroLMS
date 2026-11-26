import { useMemo } from 'react';
import { useAuth } from '@/features/auth';
import { resolveCanonicalUserId } from '@/core/auth/canonicalIdentity';
import { usePublicSupportContacts } from './usePublicSupportContacts';
import {
  cleanPhoneNumber,
  buildContextMessage,
  buildWhatsAppUrl,
} from '../utils/whatsappUtils';
import type { WhatsAppContact, WhatsAppContextConfig } from '../types';

interface TestContactLookupUser {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  jobTitle?: string;
}

type TestUserLookupFn = (id: string) => TestContactLookupUser | undefined;

function getTestUserLookup(): TestUserLookupFn | undefined {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    return undefined;
  }
  return (globalThis as Record<string, unknown>).__METROLMS_TEST_USER_LOOKUP__ as
    | TestUserLookupFn
    | undefined;
}

export interface UseWhatsAppContactsResult {
  contacts: WhatsAppContact[];
  hasContacts: boolean;
  message: string;
  contextTitle: string;
  unavailableReasonAr: string;
  getContactUrl: (contact: WhatsAppContact) => string;
}

export function useWhatsAppContacts(config: WhatsAppContextConfig): UseWhatsAppContactsResult {
  const { user } = useAuth();
  const { contacts: publicSupportContacts } = usePublicSupportContacts('technical_support');

  const { contacts, contextTitle, unavailableReasonAr } = useMemo(() => {
    switch (config.context) {
      // ── 1. Login Screen Support Context ───────────────────────────────────
      case 'login': {
        const resolvedContacts: WhatsAppContact[] = publicSupportContacts.map((c) => ({
          id: c.userId,
          name: c.name,
          role: c.jobTitle || 'الدعم الفني والتدريب عبر واتساب',
          number: c.number,
          displayNumber: c.displayNumber,
          avatarInitial: c.avatarInitial,
          isAvailable: true,
        }));
        return {
          contacts: resolvedContacts,
          contextTitle: 'الدعم الفني والتدريب عبر واتساب',
          unavailableReasonAr: 'لا تتوفر أرقام دعم فني نشطة حالياً. يرجى مراجعة إدارة التدريب.',
        };
      }

      // ── 2. General Platform Support Context ───────────────────────────────
      case 'general':
      case 'technical_support': {
        const resolvedContacts: WhatsAppContact[] = publicSupportContacts.map((c) => ({
          id: c.userId,
          name: c.name,
          role: c.jobTitle || 'الدعم الإداري والتقني',
          number: c.number,
          displayNumber: c.displayNumber,
          avatarInitial: c.avatarInitial,
          isAvailable: true,
        }));
        return {
          contacts: resolvedContacts,
          contextTitle: 'الدعم الإداري والتقني',
          unavailableReasonAr: 'لا تتوفر أرقام دعم فني نشطة حالياً.',
        };
      }


      // ── 3. Course Discussion & Content Inquiries ─────────────────────────
      case 'course': {
        const course = config.course;
        if (!course) {
          return {
            contacts: [],
            contextTitle: 'تواصل مع محاضري المقرر',
            unavailableReasonAr: 'بيانات المقرر غير متوفرة.',
          };
        }

        const resolved: WhatsAppContact[] = [];

        // Priority A: Configured course-level WhatsApp contacts (legacy builder parity)
        if (course.whatsappContacts && course.whatsappContacts.length > 0) {
          course.whatsappContacts.forEach((c, idx) => {
            const clean = cleanPhoneNumber(c.number);
            if (clean) {
              resolved.push({
                id: `course_wa_${idx}`,
                name: c.name,
                role: c.role || 'محاضر المقرر',
                number: clean,
                displayNumber: c.number,
                avatarInitial: c.name ? c.name.trim()[0] : 'م',
                isAvailable: true,
              });
            }
          });
        }

        // Priority B: If no configured contacts, resolve from real course lecturerPhone (or Vitest lookup)
        if (resolved.length === 0 && course.lecturerId) {
          const directLecturerPhone = (course as { lecturerPhone?: string | null }).lecturerPhone;
          if (directLecturerPhone) {
            const clean = cleanPhoneNumber(directLecturerPhone);
            if (clean) {
              resolved.push({
                id: course.lecturerId,
                name: course.lecturerName || 'محاضر المقرر',
                role: 'محاضر المقرر',
                number: clean,
                displayNumber: directLecturerPhone,
                avatarInitial: (course.lecturerName || 'م').trim()[0] || 'م',
                isAvailable: true,
              });
            }
          }
          const testLookup = getTestUserLookup();
          if (resolved.length === 0 && testLookup) {
            const lecturerIds = [course.lecturerId, ...(course.coLecturers || [])];
            for (const lid of lecturerIds) {
              const lectUser = testLookup(lid);
              if (lectUser && lectUser.phone && lectUser.role !== 'developer') {
                const clean = cleanPhoneNumber(lectUser.phone);
                if (clean) {
                  resolved.push({
                    id: lectUser.id,
                    name: lectUser.name,
                    role: lectUser.jobTitle || 'محاضر المقرر',
                    number: clean,
                    displayNumber: lectUser.phone,
                    avatarInitial: lectUser.name ? lectUser.name.trim()[0] : 'م',
                    isAvailable: true,
                  });
                }
              }
            }
          }
        }

        return {
          contacts: resolved,
          contextTitle: 'تواصل مع محاضر المقرر',
          unavailableReasonAr: 'لم يتم تكوين أرقام تواصل معتمدة لمحاضري هذا المقرر حتى الآن.',
        };
      }

      // ── 4. Training Group Supervisors & Assistants ────────────────────────
      case 'group': {
        const group = config.group;
        if (!group) {
          return {
            contacts: [],
            contextTitle: 'مشرفو مجموعة التدريب',
            unavailableReasonAr: 'بيانات مجموعة التدريب غير متوفرة.',
          };
        }

        // Authorization check: If logged in as ordinary trainee, verify membership
        if (user && user.role === 'user') {
          const isMember =
            (group.traineeIds || []).includes(user.id) ||
            (group.supervisorIds || []).includes(user.id);
          if (!isMember) {
            return {
              contacts: [],
              contextTitle: 'مشرفو مجموعة التدريب',
              unavailableReasonAr: 'غير مصرح: يجب أن تكون عضواً مسجلاً في المجموعة لاستعراض بيانات المشرفين.',
            };
          }
        }

        const resolved: WhatsAppContact[] = [];

        // Check group-specific override contacts if present
        if (group.whatsappContacts && group.whatsappContacts.length > 0) {
          group.whatsappContacts.forEach((c, idx) => {
            const clean = cleanPhoneNumber(c.number);
            if (clean) {
              resolved.push({
                id: `group_wa_${idx}`,
                name: c.name,
                role: c.role || 'مشرف المجموعة',
                number: clean,
                displayNumber: c.number,
                avatarInitial: c.name ? c.name.trim()[0] : 'م',
                isAvailable: true,
              });
            }
          });
        }

        // Priority B: Resolve assigned instructors from real group.instructors API payload
        const groupInstructors = (group as {
          instructors?: Array<{ userId: string; name: string; phone?: string | null; instructorRole?: string }>;
        }).instructors;
        if (Array.isArray(groupInstructors)) {
          for (const inst of groupInstructors) {
            if (inst?.phone) {
              const clean = cleanPhoneNumber(inst.phone);
              if (clean && !resolved.some((r) => r.id === inst.userId)) {
                resolved.push({
                  id: inst.userId,
                  name: inst.name,
                  role: inst.instructorRole === 'primary' ? 'المحاضر الأساسي' : 'المحاضر المساعد',
                  number: clean,
                  displayNumber: inst.phone,
                  avatarInitial: inst.name ? inst.name.trim()[0] : 'م',
                  isAvailable: true,
                });
              }
            }
          }
        }

        // Test-only lookup fallback when group DTO uses mock user IDs in Vitest
        const testLookup = getTestUserLookup();
        if (resolved.length === 0 && testLookup) {
          const resolveTestRoleGroup = (ids: string[], roleLabel: string) => {
            for (const uid of ids) {
              const u = testLookup(uid);
              if (u && u.phone && u.role !== 'developer') {
                const clean = cleanPhoneNumber(u.phone);
                if (clean && !resolved.some((r) => r.id === u.id)) {
                  resolved.push({
                    id: u.id,
                    name: u.name,
                    role: u.jobTitle || roleLabel,
                    number: clean,
                    displayNumber: u.phone,
                    avatarInitial: u.name ? u.name.trim()[0] : 'م',
                    isAvailable: true,
                  });
                }
              }
            }
          };
          if (group.primaryInstructorId) resolveTestRoleGroup([group.primaryInstructorId], 'المحاضر الأساسي');
          resolveTestRoleGroup(group.assistantLecturerIds || [], 'المحاضر المساعد');
          resolveTestRoleGroup(group.supervisorIds || [], 'مشرف المجموعة');
          resolveTestRoleGroup(group.assistantIds || [], 'مساعد إشراف التدريب');
        }

        return {
          contacts: resolved,
          contextTitle: 'مشرفو مجموعة التدريب',
          unavailableReasonAr: 'لم يتم تكوين أرقام تواصل معتمدة لمشرفي هذه المجموعة التدريبية بعد.',
        };
      }
    }
  }, [config, user, publicSupportContacts]);

  const message = useMemo(() => {
    if (config.customMessage) return config.customMessage;
    const canonicalId = user?.id ? resolveCanonicalUserId(user.id) : undefined;
    return buildContextMessage(config.context, {
      user: user
        ? {
            id: canonicalId || user.id,
            name: user.name,
            jobTitle: user.jobTitle,
          }
        : null,
      courseTitle: config.course?.title,
      groupName: config.group?.name,
    });
  }, [config.context, config.customMessage, config.course?.title, config.group?.name, user]);

  const getContactUrl = (contact: WhatsAppContact): string => {
    return buildWhatsAppUrl(contact.number, message);
  };

  return {
    contacts,
    hasContacts: contacts.length > 0,
    message,
    contextTitle,
    unavailableReasonAr,
    getContactUrl,
  };
}
