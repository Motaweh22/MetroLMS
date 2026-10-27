import { useMemo } from 'react';
import { useAuth } from '@/features/auth';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { resolveCanonicalUserId } from '@/mocks/fixtures/userDirectoryFixtures';
import { CONFIGURED_ADMIN_SUPPORT_CONTACTS } from '../config/supportContacts';
import {
  cleanPhoneNumber,
  buildContextMessage,
  buildWhatsAppUrl,
} from '../utils/whatsappUtils';
import type { WhatsAppContact, WhatsAppContextConfig } from '../types';

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

  const { contacts, contextTitle, unavailableReasonAr } = useMemo(() => {
    switch (config.context) {
      // ── 1. Login Screen Support Context ───────────────────────────────────
      case 'login': {
        const validContacts = CONFIGURED_ADMIN_SUPPORT_CONTACTS.filter((c) =>
          Boolean(cleanPhoneNumber(c.number))
        );
        return {
          contacts: validContacts,
          contextTitle: 'الدعم الفني والتدريب عبر واتساب',
          unavailableReasonAr: 'لا تتوفر أرقام دعم فني نشطة حالياً. يرجى مراجعة إدارة التدريب.',
        };
      }

      // ── 2. General Platform Support Context ───────────────────────────────
      case 'general': {
        const validContacts = CONFIGURED_ADMIN_SUPPORT_CONTACTS.filter((c) =>
          Boolean(cleanPhoneNumber(c.number))
        );
        return {
          contacts: validContacts,
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

        // Priority B: If no configured contacts, resolve assigned course lecturer(s)
        if (resolved.length === 0 && course.lecturerId) {
          const lecturerIds = [course.lecturerId, ...(course.coLecturers || [])];
          for (const lid of lecturerIds) {
            const lectUser = inMemoryStore.getManagedUserById(lid);
            if (lectUser && lectUser.phone) {
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

        // Resolve assigned supervisors from saved group assignments
        const supervisorIds = group.supervisorIds || [];
        for (const sid of supervisorIds) {
          const supUser = inMemoryStore.getManagedUserById(sid);
          if (supUser && supUser.phone) {
            const clean = cleanPhoneNumber(supUser.phone);
            if (clean && !resolved.some((r) => r.id === supUser.id)) {
              resolved.push({
                id: supUser.id,
                name: supUser.name,
                role: supUser.jobTitle || 'مشرف المجموعة',
                number: clean,
                displayNumber: supUser.phone,
                avatarInitial: supUser.name ? supUser.name.trim()[0] : 'م',
                isAvailable: true,
              });
            }
          }
        }

        // Include assigned group assistants where available
        const assistantIds = group.assistantIds || [];
        for (const aid of assistantIds) {
          const astUser = inMemoryStore.getManagedUserById(aid);
          if (astUser && astUser.phone) {
            const clean = cleanPhoneNumber(astUser.phone);
            if (clean && !resolved.some((r) => r.id === astUser.id)) {
              resolved.push({
                id: astUser.id,
                name: astUser.name,
                role: astUser.jobTitle || 'مساعد إشراف التدريب',
                number: clean,
                displayNumber: astUser.phone,
                avatarInitial: astUser.name ? astUser.name.trim()[0] : 'م',
                isAvailable: true,
              });
            }
          }
        }

        return {
          contacts: resolved,
          contextTitle: 'مشرفو مجموعة التدريب',
          unavailableReasonAr: 'لم يتم تكوين أرقام تواصل معتمدة لمشرفي هذه المجموعة التدريبية بعد.',
        };
      }
    }
  }, [config, user]);

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
