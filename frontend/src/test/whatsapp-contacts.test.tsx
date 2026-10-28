import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/mocks/server';
import { AuthProvider } from '@/core/auth/AuthContext';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { coursesApi } from '@/features/courses/services/coursesApi';
import {
  cleanPhoneNumber,
  buildWhatsAppUrl,
  buildContextMessage,
  buildLecturerReminderMessage,
  WhatsAppFloatingFab,
} from '@/features/whatsapp';
import type { WhatsAppContextConfig } from '@/features/whatsapp';
import { LoginPage } from '@/pages/LoginPage';
import { MetadataEditor } from '@/features/course-builder/components/MetadataEditor';
import type { Course } from '@/core/courses/types';
import type { User } from '@/core/auth/types';

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

describe('Increment 11 — Phase 5D: Context-Aware WhatsApp Contact System & Legacy-Parity Audit', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  beforeEach(() => {
    vi.clearAllMocks();
    authStorage.clearSession();
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });

  afterAll(() => server.close());

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    );
  };

  // ── 1. Phone Normalization & Message Encoding ────────────────────────────
  describe('1. Phone Normalization & Message Encoding', () => {
    it('normalizes local Egyptian mobile numbers (010, 011, 012, 015) to international 20 prefix', () => {
      expect(cleanPhoneNumber('01010000001')).toBe('201010000001');
      expect(cleanPhoneNumber('01123456789')).toBe('201123456789');
      expect(cleanPhoneNumber('01234567890')).toBe('201234567890');
      expect(cleanPhoneNumber('01598765432')).toBe('201598765432');
    });

    it('strips non-digits, whitespace, and dashes cleanly', () => {
      expect(cleanPhoneNumber('+20 (101) 000-0001')).toBe('201010000001');
      expect(cleanPhoneNumber('  010-9988-7766  ')).toBe('201099887766');
    });

    it('rejects empty, whitespace-only, and invalid short phone numbers with null', () => {
      expect(cleanPhoneNumber('')).toBeNull();
      expect(cleanPhoneNumber('   ')).toBeNull();
      expect(cleanPhoneNumber('12345')).toBeNull();
      expect(cleanPhoneNumber(null)).toBeNull();
      expect(cleanPhoneNumber(undefined)).toBeNull();
    });

    it('constructs valid wa.me URLs with proper URL encoding of Arabic characters', () => {
      const url = buildWhatsAppUrl('01010000001', 'مرحباً، أود الاستفسار عن الدورة');
      expect(url).toContain('https://wa.me/201010000001?text=');
      expect(url).toContain('%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B');
    });

    it('returns empty string when attempting to build a URL with an invalid phone number', () => {
      expect(buildWhatsAppUrl('', 'رسالة')).toBe('');
      expect(buildWhatsAppUrl('invalid', 'رسالة')).toBe('');
    });
  });

  // ── 2. Trainee Identity in Prefilled Messages ─────────────────────────────
  describe('2. Trainee Identity in Prefilled Messages (Requirement 1 Audit)', () => {
    it('course context message begins with exact name and canonical employee ID in correct order', () => {
      const msg = buildContextMessage('course', {
        user: { id: 'USR004', name: 'سارة عبد الله', jobTitle: 'فني إشارات' },
        courseTitle: 'سلامة السكك الحديدية',
      });

      // Strict legacy-verified template: `السلام عليكم، أنا ${name}، رقم الموظف ${id}، وظيفتي ${jobTitle}. لدي استفسار بخصوص كورس: ${title}`
      const expectedPrefix = 'السلام عليكم، أنا سارة عبد الله، رقم الموظف USR004، وظيفتي فني إشارات.';
      expect(msg.startsWith(expectedPrefix)).toBe(true);
      expect(msg).toBe(
        'السلام عليكم، أنا سارة عبد الله، رقم الموظف USR004، وظيفتي فني إشارات. لدي استفسار بخصوص كورس: سلامة السكك الحديدية'
      );
      expect(msg).not.toContain('@');
    });

    it('group context message begins with exact name and canonical employee ID in correct order', () => {
      const msg = buildContextMessage('group', {
        user: { id: 'USR004', name: 'سارة عبد الله', jobTitle: 'فني إشارات' },
        groupName: 'دفعة صيانة الإشارات 2026',
      });

      const expectedPrefix = 'السلام عليكم، أنا سارة عبد الله، رقم الموظف USR004، وظيفتي فني إشارات.';
      expect(msg.startsWith(expectedPrefix)).toBe(true);
      expect(msg).toBe(
        'السلام عليكم، أنا سارة عبد الله، رقم الموظف USR004، وظيفتي فني إشارات. لدي استفسار بخصوص مجموعة التدريب: دفعة صيانة الإشارات 2026'
      );
      expect(msg).not.toContain('@');
    });

    it('general context message begins with exact name and canonical employee ID in correct order', () => {
      const msg = buildContextMessage('general', {
        user: { id: 'usr_trainee_003', name: 'أحمد ممدوح سالم', jobTitle: 'فني قطارات' },
      });

      const expectedPrefix = 'السلام عليكم، أنا أحمد ممدوح سالم، رقم الموظف usr_trainee_003، وظيفتي فني قطارات.';
      expect(msg.startsWith(expectedPrefix)).toBe(true);
      expect(msg).toBe(
        'السلام عليكم، أنا أحمد ممدوح سالم، رقم الموظف usr_trainee_003، وظيفتي فني قطارات. أحتاج إلى مساعدة بالمنصة.'
      );
      expect(msg).not.toContain('@');
    });

    it('unauthenticated login flow uses safe generic message without fabricating name or ID', () => {
      const msg = buildContextMessage('login', {
        user: null,
      });

      expect(msg).toBe(
        'السلام عليكم، أواجه مشكلة في تسجيل الدخول إلى منصة تدريب مترو الأنفاق وأحتاج إلى مساعدة.'
      );
      expect(msg).not.toContain('undefined');
      expect(msg).not.toContain('null');
      expect(msg).not.toContain('رقم الموظف');
      expect(msg).not.toContain('أنا');
    });

    it('lecturer reminder message matches exact legacy copy and includes course title', () => {
      const msg = buildLecturerReminderMessage('محمد حسن', 'إشارات ومسير القطارات');
      expect(msg).toBe(
        'مرحباً محمد حسن،\nنود تذكيرك بضرورة استكمال كورس "إشارات ومسير القطارات". لقد لاحظنا توقفك عن المشاهدة مؤخراً. إذا كان لديك أي استفسار أو مشكلة تواجهك، لا تتردد في التواصل معي.'
      );
    });
  });

  // ── 3. Per-Course WhatsApp Number Override & Inheritance ─────────────────
  describe('3. Per-Course WhatsApp Number Override (Requirement 2 Audit)', () => {
    it('inherits assigned primary lecturer registered account phone number by default', () => {
      // CRS001 has lecturerId: 'USR002' with registered phone '01098765432'
      const course = inMemoryStore.getCourseById('CRS001');
      expect(course).toBeDefined();
      expect(course?.whatsappContacts).toBeUndefined();

      const contacts = inMemoryStore.resolveCourseWhatsAppContacts('CRS001');
      expect(contacts.length).toBe(1);
      expect(contacts[0].id).toBe('USR002');
      expect(contacts[0].name).toBe('م. خالد إبراهيم');
      expect(contacts[0].number).toBe('01098765432');
      expect(contacts[0].isOverride).toBe(false);
    });

    it('inherits assigned co-lecturers registered phone numbers alongside primary lecturer', () => {
      // Add co-lecturer usr_lect_002 to CRS001
      const course = inMemoryStore.getCoursesStore().find((c) => c.id === 'CRS001');
      if (course) {
        course.coLecturers = ['usr_lect_002'];
      }

      const contacts = inMemoryStore.resolveCourseWhatsAppContacts('CRS001');
      expect(contacts.length).toBe(2);
      expect(contacts.some((c) => c.id === 'USR002' && !c.isOverride)).toBe(true);
      expect(contacts.some((c) => c.id === 'usr_lect_002' && !c.isOverride)).toBe(true);
    });

    it('saves a course-specific WhatsApp override via inMemoryStore', () => {
      const overrideContacts = [
        { name: 'خط دعم الطوارئ للمقرر', number: '01055555555', role: 'دعم فني خاص' },
      ];

      const updated = inMemoryStore.updateCourseWhatsAppContacts('CRS001', overrideContacts, {
        id: 'usr_admin_001',
        role: 'admin',
      });

      expect(updated.whatsappContacts).toHaveLength(1);
      expect(updated.whatsappContacts?.[0].number).toBe('01055555555');

      // Resolved contacts now reflect override
      const contacts = inMemoryStore.resolveCourseWhatsAppContacts('CRS001');
      expect(contacts.length).toBe(1);
      expect(contacts[0].name).toBe('خط دعم الطوارئ للمقرر');
      expect(contacts[0].number).toBe('01055555555');
      expect(contacts[0].isOverride).toBe(true);
    });

    it('strictly prevents course-specific override from mutating the lecturer user account phone', () => {
      const lecturerBefore = inMemoryStore.getManagedUserById('USR002');
      expect(lecturerBefore?.phone).toBe('01098765432');

      // Save an override on course CRS001
      inMemoryStore.updateCourseWhatsAppContacts(
        'CRS001',
        [{ name: 'رقم بديل للمقرر', number: '01299998888', role: 'دعم' }],
        { id: 'usr_admin_001', role: 'admin' }
      );

      // Verify the lecturer's central account phone was NOT mutated
      const lecturerAfter = inMemoryStore.getManagedUserById('USR002');
      expect(lecturerAfter?.phone).toBe('01098765432');
    });

    it('clearing the override immediately restores inheritance from lecturer registered account phone', () => {
      // 1. Set override
      inMemoryStore.updateCourseWhatsAppContacts(
        'CRS001',
        [{ name: 'رقم مؤقت', number: '01511112222', role: 'مؤقت' }],
        { id: 'usr_admin_001', role: 'admin' }
      );
      expect(inMemoryStore.resolveCourseWhatsAppContacts('CRS001')[0].number).toBe('01511112222');

      // 2. Clear override (passing empty array)
      inMemoryStore.updateCourseWhatsAppContacts('CRS001', [], {
        id: 'usr_admin_001',
        role: 'admin',
      });

      // 3. Immediately restores inheritance from USR002 account
      const restored = inMemoryStore.resolveCourseWhatsAppContacts('CRS001');
      expect(restored.length).toBe(1);
      expect(restored[0].id).toBe('USR002');
      expect(restored[0].number).toBe('01098765432');
      expect(restored[0].isOverride).toBe(false);
    });

    it('enforces RBAC: strictly restricts course WhatsApp contact overrides to admin (lecturers & trainees receive 403)', () => {
      // Trainee receives 403
      expect(() =>
        inMemoryStore.updateCourseWhatsAppContacts('CRS001', [], {
          id: 'usr_trainee_003',
          role: 'user',
        })
      ).toThrowError(/مقتصرة على مدير النظام/);

      // Assigned lecturer also receives 403 (restricted to administrator)
      expect(() =>
        inMemoryStore.updateCourseWhatsAppContacts('CRS001', [], {
          id: 'USR002',
          role: 'lecturer',
        })
      ).toThrowError(/مقتصرة على مدير النظام/);

      // Unassigned lecturer receives 403
      expect(() =>
        inMemoryStore.updateCourseWhatsAppContacts('CRS001', [], {
          id: 'USR017',
          role: 'lecturer',
        })
      ).toThrowError(/مقتصرة على مدير النظام/);
    });

    it('returns HTTP 403 when an assigned lecturer attempts direct API override call', async () => {
      authStorage.setSession({
        token: 'lecturer-token',
        user: {
          id: 'USR002',
          name: 'م. خالد إبراهيم',
          role: 'lecturer',
          email: 'khaled@metro.gov.eg',
          department: 'إدارة التدريب',
          jobTitle: 'مهندس تدريب أول',
          initials: 'خ.إ',
        },
        expiresAt: Date.now() + 86400000,
      });

      await expect(
        coursesApi.updateCourseWhatsAppContacts('CRS001', [
          { name: 'محاولة تعديل غير مصرح', number: '01000000000', role: 'دعم' },
        ])
      ).rejects.toThrow();
    });

    it('allows administrator to assign primary lecturer and co-lecturers without mutating lecturer user accounts', async () => {
      // USR002 is initial lecturer with phone '01098765432'
      const originalLec2 = inMemoryStore.getManagedUserById('USR002');
      expect(originalLec2?.phone).toBe('01098765432');

      // Admin assigns usr_lect_002 as primary lecturer and USR002 as co-lecturer
      const updated = inMemoryStore.assignCourseInstructors(
        'CRS001',
        {
          lecturerId: 'usr_lect_002',
          coLecturers: ['USR002'],
        },
        { id: 'usr_admin_001', role: 'admin' }
      );

      expect(updated.lecturerId).toBe('usr_lect_002');
      expect(updated.lecturerName).toBe('د. طارق الجوهري');
      expect(updated.coLecturers).toEqual(['USR002']);

      // Account phone numbers remain completely immutable
      const checkLec2After = inMemoryStore.getManagedUserById('USR002');
      expect(checkLec2After?.phone).toBe('01098765432');

      // Default phone inheritance now reflects newly assigned primary lecturer usr_lect_002 followed by co-lecturer USR002
      const contacts = inMemoryStore.resolveCourseWhatsAppContacts('CRS001');
      expect(contacts).toHaveLength(2);
      expect(contacts[0].id).toBe('usr_lect_002');
      expect(contacts[0].role).toBe('محاضر المقرر');
      expect(contacts[1].id).toBe('USR002');
      expect(contacts[1].role).toBe('محاضر مشارك');
    });

    it('forbids lecturers from assigning or changing course instructors (403 on store and API)', async () => {
      // 1. Direct store call by lecturer receives 403
      expect(() =>
        inMemoryStore.assignCourseInstructors(
          'CRS001',
          { lecturerId: 'USR002' },
          { id: 'USR002', role: 'lecturer' }
        )
      ).toThrowError(/مقتصر على مدير النظام/);

      // 2. Direct API call by lecturer receives 403
      authStorage.setSession({
        token: 'lecturer-token',
        user: {
          id: 'USR002',
          name: 'م. خالد إبراهيم',
          role: 'lecturer',
          email: 'khaled@metro.gov.eg',
          department: 'إدارة التدريب',
          jobTitle: 'مهندس تدريب أول',
          initials: 'خ.إ',
        },
        expiresAt: Date.now() + 86400000,
      });

      await expect(
        coursesApi.assignCourseInstructors('CRS001', {
          lecturerId: 'USR002',
          coLecturers: [],
        })
      ).rejects.toThrow();
    });

    it('protects assignment fields in saveCourseDraft against non-admin tampering', () => {
      const lecturerUser: User = {
        id: 'USR002',
        name: 'م. خالد إبراهيم',
        role: 'lecturer',
        email: 'khaled@metro.gov.eg',
        department: 'إدارة التدريب',
        jobTitle: 'مهندس تدريب أول',
        initials: 'خ.إ',
      };

      // Lecturer attempts to overwrite lecturerId, coLecturers, and whatsappContacts via saveCourseDraft
      const draftResult = inMemoryStore.saveCourseDraft(
        'CRS001',
        {
          title: 'عنوان معدل من المحاضر',
          lecturerId: 'hacked_id',
          coLecturers: ['hacked_co'],
          whatsappContacts: [{ name: 'مخترق', number: '01099999999' }],
        } as unknown as Partial<Course>,
        lecturerUser
      );

      // Title updated, but protected governance fields are preserved from base course
      expect(draftResult.course.title).toBe('عنوان معدل من المحاضر');
      expect(draftResult.course.lecturerId).toBe('USR002');
      expect(draftResult.course.coLecturers).not.toContain('hacked_co');
      expect(draftResult.course.whatsappContacts).toBeUndefined();
    });

    it('supports course WhatsApp override updates through coursesApi client service for administrator', async () => {
      authStorage.setSession({
        token: 'admin-token',
        user: {
          id: 'usr_admin_001',
          name: 'أحمد محمود سالم',
          role: 'admin',
          email: 'admin@metro.gov.eg',
          department: 'الإدارة العامة',
          jobTitle: 'مدير التدريب',
          initials: 'أ.م',
        },
        expiresAt: Date.now() + 86400000,
      });

      const updated = await coursesApi.updateCourseWhatsAppContacts('CRS001', [
        { name: 'دعم المنصة المباشر', number: '01033334444', role: 'دعم' },
      ]);

      expect(updated.whatsappContacts).toHaveLength(1);
      expect(updated.whatsappContacts?.[0].number).toBe('01033334444');
    });

    it('supports course instructor assignment through coursesApi client service for administrator', async () => {
      authStorage.setSession({
        token: 'admin-token',
        user: {
          id: 'usr_admin_001',
          name: 'أحمد محمود سالم',
          role: 'admin',
          email: 'admin@metro.gov.eg',
          department: 'الإدارة العامة',
          jobTitle: 'مدير التدريب',
          initials: 'أ.م',
        },
        expiresAt: Date.now() + 86400000,
      });

      const updated = await coursesApi.assignCourseInstructors('CRS001', {
        lecturerId: 'USR002',
        coLecturers: ['USR017'],
      });

      expect(updated.lecturerId).toBe('USR002');
      expect(updated.coLecturers).toEqual(['USR017']);
    });
  });

  // ── 4. Group Context Recipient Resolution & Isolation ────────────────────
  describe('4. Group Context WhatsApp Contacts & Isolation', () => {
    it('resolves explicitly assigned group supervisors with registered phone numbers', async () => {
      authStorage.setSession({
        token: 'trainee-token',
        user: {
          id: 'USR004',
          name: 'سارة عبد الله',
          role: 'user',
          email: 'sara@metro.gov.eg',
          department: 'التشغيل والصيانة',
          jobTitle: 'فني إشارات',
          initials: 'س.ع',
        },
        expiresAt: Date.now() + 86400000,
      });

      const config: WhatsAppContextConfig = {
        context: 'group',
        group: {
          id: 'GRP-201',
          name: 'برنامج دبلوم هندسة القطارات السريعة',
          supervisorIds: ['USR002'],
          traineeIds: ['USR004', 'usr_trainee_003'],
        },
      };

      renderWithProviders(<WhatsAppFloatingFab config={config} />);
      fireEvent.click(screen.getByTestId('wa-fab-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('wa-contact-item-USR002')).toBeInTheDocument();
      });

      expect(screen.getByTestId('wa-contact-item-USR002')).toHaveTextContent('م. خالد إبراهيم');

      // Click generates prefilled group inquiry with trainee identity
      fireEvent.click(screen.getByTestId('wa-contact-item-USR002'));
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const url = mockWindowOpen.mock.calls[0][0];
      expect(url).toContain('https://wa.me/201098765432');
      expect(url).toContain(encodeURIComponent('سارة عبد الله'));
      expect(url).toContain(encodeURIComponent('USR004'));
      expect(url).toContain(encodeURIComponent('برنامج دبلوم هندسة القطارات السريعة'));
    });

    it('includes assigned group assistants when configured in group assignment model', async () => {
      authStorage.setSession({
        token: 'trainee-token',
        user: {
          id: 'usr_trainee_003',
          name: 'أحمد ممدوح سالم',
          role: 'user',
          email: 'ahmed@metro.gov.eg',
          department: 'التشغيل والصيانة',
          jobTitle: 'فني قطارات',
          initials: 'أ.م',
        },
        expiresAt: Date.now() + 86400000,
      });

      const config: WhatsAppContextConfig = {
        context: 'group',
        group: {
          id: 'GRP-201',
          name: 'برنامج دبلوم هندسة القطارات السريعة',
          supervisorIds: ['USR002'],
          assistantIds: ['usr_admin_001'],
          traineeIds: ['usr_trainee_003'],
        },
      };

      renderWithProviders(<WhatsAppFloatingFab config={config} />);
      fireEvent.click(screen.getByTestId('wa-fab-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('wa-contact-item-USR002')).toBeInTheDocument();
        expect(screen.getByTestId('wa-contact-item-usr_admin_001')).toBeInTheDocument();
      });

      expect(screen.getByTestId('wa-contact-item-usr_admin_001')).toHaveTextContent('محمود عبد السلام');
    });

    it('enforces group authorization: hides contact details from trainees not enrolled in the group', async () => {
      authStorage.setSession({
        token: 'unauthorized-trainee-token',
        user: {
          id: 'USR099_STRANGER',
          name: 'متدرب خارجي',
          role: 'user',
          email: 'stranger@metro.gov.eg',
          department: 'التشغيل والصيانة',
          jobTitle: 'متدرب',
          initials: 'م.خ',
        },
        expiresAt: Date.now() + 86400000,
      });

      const config: WhatsAppContextConfig = {
        context: 'group',
        group: {
          id: 'GRP-201',
          name: 'برنامج دبلوم هندسة القطارات السريعة',
          supervisorIds: ['USR002'],
          traineeIds: ['USR004', 'usr_trainee_003'], // USR099_STRANGER is NOT a member
        },
      };

      renderWithProviders(<WhatsAppFloatingFab config={config} />);
      fireEvent.click(screen.getByTestId('wa-fab-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('wa-unavailable-message')).toBeInTheDocument();
      });

      expect(screen.getByTestId('wa-unavailable-message')).toHaveTextContent('غير مصرح');
      expect(screen.queryByTestId('wa-contact-item-USR002')).not.toBeInTheDocument();
    });

    it('does NOT let group assignments expose unrelated course contacts or all platform lecturers', async () => {
      authStorage.setSession({
        token: 'trainee-token',
        user: {
          id: 'usr_trainee_003',
          name: 'أحمد ممدوح',
          role: 'user',
          email: 'ahmed@metro.gov.eg',
          department: 'التشغيل والصيانة',
          jobTitle: 'فني قطارات',
          initials: 'أ.م',
        },
        expiresAt: Date.now() + 86400000,
      });

      const config: WhatsAppContextConfig = {
        context: 'group',
        group: {
          id: 'GRP-201',
          name: 'برنامج دبلوم هندسة القطارات السريعة',
          supervisorIds: ['USR002'],
          traineeIds: ['usr_trainee_003'],
        },
      };

      renderWithProviders(<WhatsAppFloatingFab config={config} />);
      fireEvent.click(screen.getByTestId('wa-fab-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('wa-contact-item-USR002')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('wa-contact-item-legacy_metro_support')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wa-contact-item-USR003')).not.toBeInTheDocument();
    });
  });

  // ── 5. Administrative Support Contact Sources & Login-Screen (Req 3 Audit)
  describe('5. Administrative Support Contact Sources & Missing Config Handling', () => {
    it('operates completely without an active authenticated session on login screen', async () => {
      authStorage.clearSession();

      const config: WhatsAppContextConfig = {
        context: 'login',
      };

      renderWithProviders(<WhatsAppFloatingFab config={config} />);

      const fabBtn = screen.getByTestId('wa-fab-btn');
      expect(fabBtn).toBeInTheDocument();

      fireEvent.click(fabBtn);

      await waitFor(() => {
        expect(screen.getByTestId('wa-fab-menu')).toHaveClass('show');
      });

      // Renders dynamic technical support contact (usr_admin_001 -> 201010000001)
      expect(screen.getByTestId('wa-contact-item-usr_admin_001')).toBeInTheDocument();
      expect(screen.getByTestId('wa-contact-item-usr_admin_001')).toHaveTextContent(
        'م. محمود عبد السلام'
      );

      // Click sends unauthenticated message without fabricated identity
      fireEvent.click(screen.getByTestId('wa-contact-item-usr_admin_001'));
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const url = mockWindowOpen.mock.calls[0][0];
      expect(url).toContain('https://wa.me/201010000001');
      expect(url).toContain(
        encodeURIComponent('السلام عليكم، أواجه مشكلة في تسجيل الدخول إلى منصة تدريب مترو الأنفاق وأحتاج إلى مساعدة.')
      );
      expect(url).not.toContain('رقم الموظف');
    });

    it('provides contextual WhatsApp contact actions in login account-creation and password-recovery dialogs', async () => {
      renderWithProviders(<LoginPage />);

      // The obsolete standalone login WhatsApp support button has been removed from the login form footer
      expect(screen.queryByTestId('login-whatsapp-support-btn')).not.toBeInTheDocument();

      // 1. Account Creation Dialog WhatsApp Action
      const signupLink = screen.getByRole('button', { name: /إنشاء حساب جديد/i });
      expect(signupLink).toBeInTheDocument();
      fireEvent.click(signupLink);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'إنشاء حساب جديد' })).toBeInTheDocument();
      });

      const signupWhatsAppBtn = await screen.findByRole('link', { name: /تواصل مع الدعم/i });
      expect(signupWhatsAppBtn).toBeInTheDocument();
      expect(signupWhatsAppBtn).toHaveAttribute('id', 'signup-whatsapp-btn');
      expect(signupWhatsAppBtn).toHaveAttribute('target', '_blank');
      expect(signupWhatsAppBtn).toHaveAttribute('rel', 'noopener noreferrer');

      const expectedSignupUrl = buildWhatsAppUrl(
        '201010000001',
        'مرحبًا، أرغب في إنشاء حساب جديد على منصة التدريب الإلكتروني. يرجى إرشادي إلى خطوات التسجيل.'
      );
      expect(signupWhatsAppBtn).toHaveAttribute('href', expectedSignupUrl);

      // Close the signup modal
      fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }));

      // 2. Password Recovery Dialog WhatsApp Action
      const forgotLink = screen.getByRole('button', { name: /نسيت كلمة المرور؟/i });
      expect(forgotLink).toBeInTheDocument();
      fireEvent.click(forgotLink);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'استعادة كلمة المرور' })).toBeInTheDocument();
      });

      const forgotWhatsAppBtn = await screen.findByRole('link', { name: /تواصل مع الدعم/i });
      expect(forgotWhatsAppBtn).toBeInTheDocument();
      expect(forgotWhatsAppBtn).toHaveAttribute('id', 'forgot-password-whatsapp-btn');
      expect(forgotWhatsAppBtn).toHaveAttribute('target', '_blank');
      expect(forgotWhatsAppBtn).toHaveAttribute('rel', 'noopener noreferrer');

      const expectedForgotUrl = buildWhatsAppUrl(
        '201010000001',
        'مرحبًا، أحتاج إلى المساعدة في استعادة كلمة المرور لحسابي على منصة التدريب الإلكتروني.'
      );
      expect(forgotWhatsAppBtn).toHaveAttribute('href', expectedForgotUrl);
    });

    it('renders safe unavailable notice when configured support contacts are missing or unavailable', async () => {
      // Render general context with custom empty contacts
      const config: WhatsAppContextConfig = {
        context: 'login',
      };

      // Deactivate technical_support assignment in inMemoryStore
      inMemoryStore.setUserWhatsAppVisibility('usr_admin_001', [{ scenario: 'technical_support', isActive: false }]);

      try {
        renderWithProviders(<WhatsAppFloatingFab config={config} />);
        fireEvent.click(screen.getByTestId('wa-fab-btn'));

        await waitFor(() => {
          expect(screen.getByTestId('wa-unavailable-message')).toBeInTheDocument();
        });

        expect(screen.getByTestId('wa-unavailable-message')).toHaveTextContent('لا تتوفر أرقام دعم فني نشطة حالياً');
        expect(screen.queryByTestId('wa-contact-item-usr_admin_001')).not.toBeInTheDocument();
      } finally {
        // Restore
        inMemoryStore.setUserWhatsAppVisibility('usr_admin_001', [{ scenario: 'technical_support', isActive: true }]);
      }
    });
  });

  // ── 6. General Platform Context ──────────────────────────────────────────
  describe('6. General Platform WhatsApp Contacts', () => {
    it('presents administrative support contacts with authenticated trainee details', async () => {
      authStorage.setSession({
        token: 'trainee-token',
        user: {
          id: 'USR004',
          name: 'سارة عبد الله',
          role: 'user',
          jobTitle: 'فني إشارات',
          department: 'التشغيل والصيانة',
          email: 'sara@metro.gov.eg',
          initials: 'س.ع',
        },
        expiresAt: Date.now() + 86400000,
      });

      const config: WhatsAppContextConfig = {
        context: 'general',
      };

      renderWithProviders(<WhatsAppFloatingFab config={config} />);
      fireEvent.click(screen.getByTestId('wa-fab-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('wa-contact-item-usr_admin_001')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('wa-contact-item-usr_admin_001'));
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const url = mockWindowOpen.mock.calls[0][0];
      expect(url).toContain('https://wa.me/201010000001');
      expect(url).toContain(encodeURIComponent('سارة عبد الله'));
      expect(url).toContain(encodeURIComponent('USR004'));
      expect(url).toContain(encodeURIComponent('أحتاج إلى مساعدة بالمنصة'));
    });
  });

  // ── 7. MetadataEditor UI Integration ─────────────────────────────────────
  describe('7. CourseBuilder MetadataEditor Section F UI Integration', () => {
    it('renders automatic inheritance notice when course has no custom WhatsApp override for admin', () => {
      const mockCourse: Course = {
        id: 'CRS001',
        title: 'سلامة العمل',
        description: 'وصف المقرر',
        level: 'مبتدئ',
        estimatedHours: 8,
        rating: 4.5,
        ratingCount: 10,
        enrollmentCount: 50,
        status: 'published',
        lecturerId: 'USR002',
        lecturerName: 'م. خالد إبراهيم',
        chapters: [],
      };

      const handleChange = vi.fn();

      renderWithProviders(
        <MetadataEditor course={mockCourse} onChange={handleChange} isAdmin={true} />
      );

      expect(screen.getByTestId('course-whatsapp-contacts-section')).toBeInTheDocument();
      expect(screen.getByTestId('wa-inherited-info')).toBeInTheDocument();
      expect(screen.getByTestId('wa-inherited-info')).toHaveTextContent('تلقائياً استخدام رقم الهاتف المسجل');
      expect(screen.getByTestId('wa-inherited-info')).toHaveTextContent('م. خالد إبراهيم');

      // Click to enable override
      const enableBtn = screen.getByTestId('btn-enable-wa-override');
      fireEvent.click(enableBtn);
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsappContacts: [
            expect.objectContaining({
              name: 'م. خالد إبراهيم',
              role: 'محاضر المقرر',
            }),
          ],
        })
      );
    });

    it('renders override controls when course has custom WhatsApp contacts and allows clearing override for admin', () => {
      const mockCourseWithOverride: Course = {
        id: 'CRS001',
        title: 'سلامة العمل',
        description: 'وصف المقرر',
        level: 'مبتدئ',
        estimatedHours: 8,
        rating: 4.5,
        ratingCount: 10,
        enrollmentCount: 50,
        status: 'published',
        lecturerId: 'USR002',
        lecturerName: 'م. خالد إبراهيم',
        whatsappContacts: [
          { name: 'دعم خاص', number: '01055555555', role: 'دعم المقرر' },
        ],
        chapters: [],
      };

      const handleChange = vi.fn();

      renderWithProviders(
        <MetadataEditor course={mockCourseWithOverride} onChange={handleChange} isAdmin={true} />
      );

      expect(screen.getByTestId('wa-override-controls')).toBeInTheDocument();
      expect(screen.getByTestId('wa-contact-name-input-0')).toHaveValue('دعم خاص');
      expect(screen.getByTestId('wa-contact-number-input-0')).toHaveValue('01055555555');

      // Click clear override
      const clearBtn = screen.getByTestId('btn-clear-wa-override');
      fireEvent.click(clearBtn);
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsappContacts: [],
        })
      );
    });

    it('allows administrator to assign primary lecturer and manage co-lecturers in MetadataEditor', () => {
      const mockCourse: Course = {
        id: 'CRS001',
        title: 'سلامة العمل',
        description: 'وصف المقرر',
        level: 'مبتدئ',
        estimatedHours: 8,
        rating: 4.5,
        ratingCount: 10,
        enrollmentCount: 50,
        status: 'published',
        lecturerId: 'USR002',
        lecturerName: 'م. خالد إبراهيم',
        coLecturers: ['USR017'],
        chapters: [],
      };

      const handleChange = vi.fn();

      renderWithProviders(
        <MetadataEditor
          course={mockCourse}
          onChange={handleChange}
          isAdmin={true}
          availableLecturers={[
            { id: 'USR002', name: 'م. خالد إبراهيم', phone: '01098765432' },
            { id: 'USR017', name: 'د. سارة عادل خليل', phone: '01011112222' },
            { id: 'usr_lect_002', name: 'د. طارق محمود', phone: '01010000002' },
          ]}
        />
      );

      expect(screen.getByTestId('section-instructor-assignment')).toBeInTheDocument();
      expect(screen.getByTestId('badge-admin-assigned')).toBeInTheDocument();

      // 1. Change primary lecturer to USR017
      const primarySelect = screen.getByTestId('select-primary-lecturer');
      fireEvent.change(primarySelect, { target: { value: 'USR017' } });
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          lecturerId: 'USR017',
          lecturerName: 'د. سارة عادل خليل',
        })
      );

      // 2. Remove co-lecturer
      const removeBtn = screen.getByTestId('btn-remove-co-lecturer-0');
      fireEvent.click(removeBtn);
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          coLecturers: [],
        })
      );

      // 3. Add co-lecturer
      const addSelect = screen.getByTestId('select-add-co-lecturer');
      fireEvent.change(addSelect, { target: { value: 'usr_lect_002' } });
      const addBtn = screen.getByTestId('btn-add-co-lecturer');
      fireEvent.click(addBtn);
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          coLecturers: ['USR017', 'usr_lect_002'],
        })
      );
    });

    it('renders read-only views for non-admin (lecturer) with explicit administration boundary notices', () => {
      const mockCourse: Course = {
        id: 'CRS001',
        title: 'سلامة العمل',
        description: 'وصف المقرر',
        level: 'مبتدئ',
        estimatedHours: 8,
        rating: 4.5,
        ratingCount: 10,
        enrollmentCount: 50,
        status: 'published',
        lecturerId: 'USR002',
        lecturerName: 'م. خالد إبراهيم',
        coLecturers: ['USR017'],
        chapters: [],
      };

      const handleChange = vi.fn();

      renderWithProviders(
        <MetadataEditor course={mockCourse} onChange={handleChange} isAdmin={false} />
      );

      // Instructor assignment is read-only
      expect(screen.getByTestId('lecturer-readonly-assignment')).toBeInTheDocument();
      expect(screen.getByTestId('lecturers-readonly-notice')).toHaveTextContent(
        'مقتصرة على مدير النظام فقط'
      );
      expect(screen.queryByTestId('select-primary-lecturer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-add-co-lecturer')).not.toBeInTheDocument();

      // WhatsApp override section is read-only
      expect(screen.queryByTestId('btn-enable-wa-override')).not.toBeInTheDocument();
      expect(screen.getByTestId('wa-lecturer-readonly-notice')).toHaveTextContent(
        'مقتصر على مدير النظام فقط'
      );
    });

    it('renders read-only WhatsApp override list for non-admin when custom override is active', () => {
      const mockCourseWithOverride: Course = {
        id: 'CRS001',
        title: 'سلامة العمل',
        description: 'وصف المقرر',
        level: 'مبتدئ',
        estimatedHours: 8,
        rating: 4.5,
        ratingCount: 10,
        enrollmentCount: 50,
        status: 'published',
        lecturerId: 'USR002',
        lecturerName: 'م. خالد إبراهيم',
        whatsappContacts: [
          { name: 'دعم الإدارة', number: '01099998888', role: 'دعم فني' },
        ],
        chapters: [],
      };

      const handleChange = vi.fn();

      renderWithProviders(
        <MetadataEditor course={mockCourseWithOverride} onChange={handleChange} isAdmin={false} />
      );

      expect(screen.getByTestId('wa-override-readonly-list')).toBeInTheDocument();
      expect(screen.getByTestId('wa-contact-name-0')).toHaveTextContent('دعم الإدارة');
      expect(screen.getByTestId('wa-contact-number-0')).toHaveTextContent('01099998888');
      expect(screen.queryByTestId('btn-clear-wa-override')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-add-wa-contact')).not.toBeInTheDocument();
      expect(screen.getByTestId('wa-lecturer-readonly-notice')).toBeInTheDocument();
    });
  });

  // ── 8. UI Interactivity & Accessibility ───────────────────────────────────
  describe('8. UI Interactivity & Keyboard Dismissal', () => {
    it('closes menu when clicking outside the FAB container', async () => {
      renderWithProviders(
        <div>
          <button data-testid="outside-element">عنصر خارجي</button>
          <WhatsAppFloatingFab config={{ context: 'login' }} />
        </div>
      );

      fireEvent.click(screen.getByTestId('wa-fab-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('wa-fab-menu')).toHaveClass('show');
      });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside-element'));
      await waitFor(() => {
        expect(screen.getByTestId('wa-fab-menu')).not.toHaveClass('show');
      });
    });

    it('closes menu when pressing Escape key', async () => {
      renderWithProviders(<WhatsAppFloatingFab config={{ context: 'login' }} />);

      fireEvent.click(screen.getByTestId('wa-fab-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('wa-fab-menu')).toHaveClass('show');
      });

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.getByTestId('wa-fab-menu')).not.toHaveClass('show');
      });
    });
  });
});
