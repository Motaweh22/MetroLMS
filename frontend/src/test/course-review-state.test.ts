import { describe, it, expect, beforeEach } from 'vitest';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';
import type { Course, CourseChapter, AdminStagedEditPayload } from '@/core/courses/types';

describe('Increment 9 — Review State Machine & Mock Store (Phase 1)', () => {
  const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
  const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
  const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

  const otherLecturer: User = {
    id: 'usr_lect_999',
    name: 'د. طارق مصطفى',
    email: 'tarek@metro.gov.eg',
    role: 'lecturer',
    jobTitle: 'خبير إشارات',
    department: 'هندسة السكة',
    initials: 'د.ط',
  };

  beforeEach(() => {
    inMemoryStore.reset();
    localStorage.clear();
  });

  describe('1. Content Eligibility Validation (Pre-Mutation)', () => {
    it('rejects course submission with empty title after trim', () => {
      const course = inMemoryStore.getCourseById('CRS001')!;
      expect(() => {
        inMemoryStore.validateCourseContentEligibility({
          ...course,
          title: '   ',
        });
      }).toThrowError('عنوان المقرر مطلوب ولا يمكن أن يكون فارغاً');
    });

    it('rejects course submission with empty description after trim', () => {
      const course = inMemoryStore.getCourseById('CRS001')!;
      expect(() => {
        inMemoryStore.validateCourseContentEligibility({
          ...course,
          description: '',
        });
      }).toThrowError('وصف المقرر مطلوب ولا يمكن أن يكون فارغاً');
    });

    it('rejects course submission with zero chapters', () => {
      const course = inMemoryStore.getCourseById('CRS001')!;
      expect(() => {
        inMemoryStore.validateCourseContentEligibility({
          ...course,
          chapters: [],
        });
      }).toThrowError('يجب أن يحتوي المقرر على فصل واحد على الأقل');
    });

    it('rejects course submission when all chapters contain zero lessons', () => {
      const emptyChapters: CourseChapter[] = [
        { id: 'ch1', title: 'الفصل 1', order: 1, items: [] },
        { id: 'ch2', title: 'الفصل 2', order: 2, items: [] },
      ];
      const course = inMemoryStore.getCourseById('CRS001')!;
      expect(() => {
        inMemoryStore.validateCourseContentEligibility({
          ...course,
          chapters: emptyChapters,
        });
      }).toThrowError('يجب أن يحتوي المقرر على درس أو مادة تدريبية واحدة على الأقل');
    });

    it('fails atomically without modifying store state when validation fails', () => {
      // Create a draft course with 0 lessons
      const created = inMemoryStore.createCourse(
        { title: 'كورس غير مكتمل', description: 'وصف تمهيدي', level: 'مبتدئ' },
        lecturerUser
      );
      // Chapters in new course have 0 items by default
      expect(() => {
        inMemoryStore.submitCourseForReview(created.id, lecturerUser);
      }).toThrowError(MockStoreError);

      const check = inMemoryStore.getCourseById(created.id)!;
      expect(check.status).toBe('draft');
      expect(check.submittedAt).toBeUndefined();
      expect(check.auditLog).toBeUndefined();
    });
  });

  describe('2. Case A: New & Returned Course Submissions', () => {
    it('submits a valid draft course and transitions status to pending_admin with submitted audit event', () => {
      const newCourse = inMemoryStore.createCourse(
        {
          title: 'دورة هندسة الإشارات المتقدمة',
          description: 'وصف شامل لنظم الإشارات الحديثة بالخط الثالث',
          level: 'متوسط',
        },
        lecturerUser
      );
      // Add a lesson to satisfy content eligibility
      newCourse.chapters[0].items.push({
        id: 'item_1',
        type: 'video',
        title: 'مقدمة في نظام الإشارات',
        duration: '10:00',
      });
      inMemoryStore.saveCourseDraft(newCourse.id, newCourse, lecturerUser);

      const result = inMemoryStore.submitCourseForReview(newCourse.id, lecturerUser);

      expect(result.course.status).toBe('pending_admin');
      expect(result.isPublishedUpdate).toBe(false);
      expect(result.action).toBe('submitted');

      const savedCourse = inMemoryStore.getCourseById(newCourse.id)!;
      expect(savedCourse.status).toBe('pending_admin');
      expect(savedCourse.submittedAt).toBeDefined();
      expect(savedCourse.auditLog).toHaveLength(1);
      expect(savedCourse.auditLog![0].action).toBe('submitted');
      expect(savedCourse.auditLog![0].actorId).toBe(lecturerUser.id);
    });

    it('records action as resubmitted when submitting a draft that was previously returned or rejected', () => {
      const newCourse = inMemoryStore.createCourse(
        {
          title: 'دورة السكك الحديدية',
          description: 'توصيف مسارات وأنظمة السكك الحديدية',
          level: 'مبتدئ',
        },
        lecturerUser
      );
      newCourse.chapters[0].items.push({
        id: 'item_1',
        type: 'video',
        title: 'الدرس الأول',
      });
      inMemoryStore.saveCourseDraft(newCourse.id, newCourse, lecturerUser);

      // Simulate a previous rejection in auditLog
      newCourse.auditLog = [
        {
          id: 'AUD_PREV',
          courseId: newCourse.id,
          action: 'rejected',
          actorId: adminUser.id,
          actorName: adminUser.name,
          actorRole: 'admin',
          timestamp: new Date().toISOString(),
          summary: 'رفض سابق',
        },
      ];
      inMemoryStore.saveCourseDraft(newCourse.id, newCourse, lecturerUser);

      const result = inMemoryStore.submitCourseForReview(newCourse.id, lecturerUser);
      expect(result.action).toBe('resubmitted');
      expect(result.course.auditLog).toHaveLength(2);
      expect(result.course.auditLog![1].action).toBe('resubmitted');
    });

    it('correctly tracks full review-cycle sequence: submitted -> rejected -> resubmitted -> approved -> submitted', () => {
      // 1. Initial creation
      const course = inMemoryStore.createCourse(
        {
          title: 'دورة هندسة القطارات المتكاملة',
          description: 'توصيف شامل ومحدث لمسارات وأنظمة القطارات',
          level: 'متقدم',
        },
        lecturerUser
      );
      course.chapters[0].items.push({
        id: 'item_train_01',
        type: 'video',
        title: 'مقدمة منظومة الجر الكهربائي',
        duration: '15:00',
      });
      inMemoryStore.saveCourseDraft(course.id, course, lecturerUser);

      // Event 1: First Submission (Case A) -> 'submitted'
      const sub1 = inMemoryStore.submitCourseForReview(course.id, lecturerUser);
      expect(sub1.action).toBe('submitted');
      expect(sub1.course.status).toBe('pending_admin');

      // Event 2: Admin Rejection -> 'rejected'
      const dec1 = inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'rejected',
          summaryMessage: 'يرجى مراجعة المعايير الفنية وتحديث المنهج',
        },
        adminUser
      );
      expect(dec1.outcome).toBe('rejected');
      expect(dec1.course.status).toBe('draft');

      // Event 3: Lecturer Resubmission -> 'resubmitted'
      const sub2 = inMemoryStore.submitCourseForReview(course.id, lecturerUser);
      expect(sub2.action).toBe('resubmitted');
      expect(sub2.course.status).toBe('pending_admin');

      // Event 4: Admin Approval -> 'approved'
      const dec2 = inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'approved',
          approvalNote: 'تمت المراجعة والاعتماد بنجاح',
        },
        adminUser
      );
      expect(dec2.outcome).toBe('approved');
      expect(dec2.course.status).toBe('published');

      // Event 5: Independent New Cycle (Case B: Published Course Update) -> 'submitted'
      // Lecturer creates new draft modifications for the now-published course
      const publishedCourse = inMemoryStore.getCourseById(course.id)!;
      const draftUpdate: Course = {
        ...publishedCourse,
        title: 'دورة هندسة القطارات المتكاملة - تحديث 2026',
      };
      inMemoryStore.saveCourseDraft(course.id, draftUpdate, lecturerUser);

      const sub3 = inMemoryStore.submitCourseForReview(course.id, lecturerUser);
      expect(sub3.action).toBe('submitted');
      expect(sub3.isPublishedUpdate).toBe(true);
      expect(sub3.course.status).toBe('published');
      expect(sub3.course.isUpdatePendingApproval).toBe(true);

      // Verify the entire historical audit log preserves all 5 actions in exact order
      const fullAudit = inMemoryStore.getCourseById(course.id)!.auditLog!;
      expect(fullAudit).toHaveLength(5);
      const actionsSequence = fullAudit.map((entry) => entry.action);
      expect(actionsSequence).toEqual([
        'submitted',
        'rejected',
        'resubmitted',
        'approved',
        'submitted',
      ]);
    });

    it('rejects submission attempt by trainee (403 Forbidden)', () => {
      expect(() => {
        inMemoryStore.submitCourseForReview('CRS001', traineeUser);
      }).toThrowError('غير مصرح لك بتقديم هذا المقرر للمراجعة');
    });

    it('rejects submission attempt by unauthorized lecturer (403 Forbidden)', () => {
      const newCourse = inMemoryStore.createCourse(
        { title: 'كورس مخصص لخالد', description: 'وصف تمهيدي', level: 'مبتدئ' },
        lecturerUser
      );
      expect(() => {
        inMemoryStore.submitCourseForReview(newCourse.id, otherLecturer);
      }).toThrowError('غير مصرح لك بتقديم هذا المقرر للمراجعة');
    });
  });

  describe('3. Case B: Published-Course Update & Draft Integrity', () => {
    it('throws 409 DRAFT_INTEGRITY_ERROR when submitting a published course without draft in courseDrafts', () => {
      // CRS001 is published and has no draft in courseDrafts initially
      expect(() => {
        inMemoryStore.submitCourseForReview('CRS001', adminUser);
      }).toThrowError('تعذر العثور على مسودة التعديلات للمقرر المنشور');

      try {
        inMemoryStore.submitCourseForReview('CRS001', adminUser);
      } catch (err) {
        expect(err).toBeInstanceOf(MockStoreError);
        const storeErr = err as MockStoreError;
        expect(storeErr.status).toBe(409);
        expect(storeErr.code).toBe('DRAFT_INTEGRITY_ERROR');
      }

      // Base course must NOT have been mutated
      const base = inMemoryStore.getCourseById('CRS001')!;
      expect(base.status).toBe('published');
      expect(base.isUpdatePendingApproval).toBeFalsy();
    });

    it('submits published-course update successfully while base course remains live', () => {
      const base = inMemoryStore.getCourseById('CRS001')!;
      expect(base.status).toBe('published');
      const originalTitle = base.title;
      const originalChaptersCount = base.chapters.length;

      // Save a valid draft for CRS001 with updated title and an extra chapter
      const updatedTitle = 'دورة تشغيل وصيانة القطارات الحديثة (محدثة)';
      inMemoryStore.saveCourseDraft(
        'CRS001',
        {
          title: updatedTitle,
          chapters: [
            ...base.chapters,
            {
              id: 'ch_new_draft',
              title: 'فصل التحديث الجديد',
              order: base.chapters.length + 1,
              items: [{ id: 'item_new', type: 'video', title: 'درس إضافي' }],
            },
          ],
        },
        lecturerUser
      );

      const result = inMemoryStore.submitCourseForReview('CRS001', lecturerUser);

      expect(result.isPublishedUpdate).toBe(true);
      expect(result.course.status).toBe('published'); // Remains live!
      expect(result.course.isUpdatePendingApproval).toBe(true);
      expect(result.action).toBe('submitted');

      // Query catalog - live published course remains unchanged
      const catalog = inMemoryStore.getCourses();
      const catalogCourse = catalog.find((c) => c.id === 'CRS001')!;
      expect(catalogCourse).toBeDefined();
      expect(catalogCourse.status).toBe('published');
      expect(catalogCourse.isUpdatePendingApproval).toBe(true);
      expect(catalogCourse.title).toBe(originalTitle);
      expect(catalogCourse.title).not.toBe(updatedTitle);
      expect(catalogCourse.chapters).toHaveLength(originalChaptersCount);

      // Verify draft contains updated content
      const draft = inMemoryStore.getCourseForEditing('CRS001', lecturerUser);
      expect(draft.title).toBe(updatedTitle);
      expect(draft.chapters).toHaveLength(originalChaptersCount + 1);
    });

    it('records action as resubmitted when submitting a published-course update following prior return or rejection', () => {
      const base = inMemoryStore.getCourseById('CRS001')!;
      expect(base.status).toBe('published');

      // Setup draft and previous return event in base course auditLog
      base.auditLog = [
        {
          id: 'AUD_PREV_RETURN',
          courseId: 'CRS001',
          action: 'returned_with_admin_edits',
          actorId: adminUser.id,
          actorName: adminUser.name,
          actorRole: 'admin',
          timestamp: '2026-10-18T10:00:00.000Z',
          summary: 'إعادة سابقة للمقرر بتعديلات الإدارة',
        },
      ];

      inMemoryStore.saveCourseDraft(
        'CRS001',
        {
          title: 'تحديث معدل بعد الإعادة',
        },
        lecturerUser
      );

      const result = inMemoryStore.submitCourseForReview('CRS001', lecturerUser);
      expect(result.isPublishedUpdate).toBe(true);
      expect(result.action).toBe('resubmitted');
      expect(result.course.auditLog).toHaveLength(2);
      expect(result.course.auditLog![1].action).toBe('resubmitted');
      expect(result.course.status).toBe('published');
      expect(result.course.isUpdatePendingApproval).toBe(true);
    });

    it('records action as submitted for an independent update after an earlier rejected update was subsequently approved', () => {
      const base = inMemoryStore.getCourseById('CRS001')!;
      expect(base.status).toBe('published');

      // Prior history: course update was rejected, then resubmitted, then approved
      base.auditLog = [
        {
          id: 'AUD_01',
          courseId: 'CRS001',
          action: 'submitted',
          actorId: lecturerUser.id,
          actorName: lecturerUser.name,
          actorRole: 'lecturer',
          timestamp: '2026-10-10T10:00:00.000Z',
          summary: 'تقديم أولي سابق',
        },
        {
          id: 'AUD_02',
          courseId: 'CRS001',
          action: 'rejected',
          actorId: adminUser.id,
          actorName: adminUser.name,
          actorRole: 'admin',
          timestamp: '2026-10-11T12:00:00.000Z',
          summary: 'رفض التقديم السابق',
        },
        {
          id: 'AUD_03',
          courseId: 'CRS001',
          action: 'resubmitted',
          actorId: lecturerUser.id,
          actorName: lecturerUser.name,
          actorRole: 'lecturer',
          timestamp: '2026-10-12T09:00:00.000Z',
          summary: 'إعادة تقديم بعد الرفض',
        },
        {
          id: 'AUD_04',
          courseId: 'CRS001',
          action: 'approved',
          actorId: adminUser.id,
          actorName: adminUser.name,
          actorRole: 'admin',
          timestamp: '2026-10-13T14:00:00.000Z',
          summary: 'اعتماد ونشر المقرر بعد استيفاء الملاحظات',
        },
      ];

      // Lecturer now creates a new independent draft update for the live published course
      inMemoryStore.saveCourseDraft(
        'CRS001',
        {
          title: 'دورة تشغيل وصيانة القطارات - تحديث دوري سنوي',
        },
        lecturerUser
      );

      const result = inMemoryStore.submitCourseForReview('CRS001', lecturerUser);
      expect(result.isPublishedUpdate).toBe(true);
      // MUST be 'submitted', NOT 'resubmitted' because the last lifecycle milestone was 'approved'
      expect(result.action).toBe('submitted');
      expect(result.course.auditLog).toHaveLength(5);
      expect(result.course.auditLog![4].action).toBe('submitted');
    });
  });

  describe('4. Deterministic FIFO Review Queue Ordering', () => {
    it('returns courses in review queue ordered by submittedAt ascending with 5-tier fallback', () => {
      // Set up Course 1: submittedAt 10:00
      const c1 = inMemoryStore.createCourse(
        { title: 'كورس 1', description: 'وصف 1', level: 'مبتدئ' },
        adminUser
      );
      c1.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس 1' });
      inMemoryStore.saveCourseDraft(c1.id, c1, adminUser);
      inMemoryStore.submitCourseForReview(c1.id, adminUser);
      const c1Stored = inMemoryStore.getCourseById(c1.id)!;
      c1Stored.submittedAt = '2026-10-19T10:00:00.000Z';

      // Set up Course 2: submittedAt 09:00 (earlier)
      const c2 = inMemoryStore.createCourse(
        { title: 'كورس 2', description: 'وصف 2', level: 'متوسط' },
        adminUser
      );
      c2.chapters[0].items.push({ id: 'i2', type: 'video', title: 'درس 2' });
      inMemoryStore.saveCourseDraft(c2.id, c2, adminUser);
      inMemoryStore.submitCourseForReview(c2.id, adminUser);
      const c2Stored = inMemoryStore.getCourseById(c2.id)!;
      c2Stored.submittedAt = '2026-10-19T09:00:00.000Z';

      // Set up Course 3: missing submittedAt, has draftUpdatedAt 08:00
      const c3 = inMemoryStore.createCourse(
        { title: 'كورس 3', description: 'وصف 3', level: 'متقدم' },
        adminUser
      );
      c3.chapters[0].items.push({ id: 'i3', type: 'video', title: 'درس 3' });
      inMemoryStore.saveCourseDraft(c3.id, c3, adminUser);
      inMemoryStore.submitCourseForReview(c3.id, adminUser);
      const c3Stored = inMemoryStore.getCourseById(c3.id)!;
      delete c3Stored.submittedAt;
      c3Stored.draftUpdatedAt = '2026-10-19T08:00:00.000Z';
      const storeInternals = inMemoryStore as unknown as {
        courseDrafts: Record<string, Course>;
      };
      if (storeInternals.courseDrafts[c3.id]) {
        delete storeInternals.courseDrafts[c3.id].submittedAt;
        storeInternals.courseDrafts[c3.id].draftUpdatedAt = '2026-10-19T08:00:00.000Z';
      }

      const queue = inMemoryStore.getReviewQueue(adminUser);
      expect(queue.totalCount).toBeGreaterThanOrEqual(3);

      const relevant = queue.items.filter((item) => [c1.id, c2.id, c3.id].includes(item.id));
      expect(relevant).toHaveLength(3);
      // Order: c3 (08:00 draftUpdatedAt) -> c2 (09:00 submittedAt) -> c1 (10:00 submittedAt)
      expect(relevant[0].id).toBe(c3.id);
      expect(relevant[1].id).toBe(c2.id);
      expect(relevant[2].id).toBe(c1.id);
    });

    it('breaks ties lexicographically by courseId', () => {
      const cA = inMemoryStore.createCourse(
        { title: 'كورس A', description: 'وصف A', level: 'مبتدئ' },
        adminUser
      );
      cA.chapters[0].items.push({ id: 'iA', type: 'video', title: 'درس A' });
      inMemoryStore.saveCourseDraft(cA.id, cA, adminUser);
      inMemoryStore.submitCourseForReview(cA.id, adminUser);

      const cB = inMemoryStore.createCourse(
        { title: 'كورس B', description: 'وصف B', level: 'مبتدئ' },
        adminUser
      );
      cB.chapters[0].items.push({ id: 'iB', type: 'video', title: 'درس B' });
      inMemoryStore.saveCourseDraft(cB.id, cB, adminUser);
      inMemoryStore.submitCourseForReview(cB.id, adminUser);

      const sameTime = '2026-10-19T12:00:00.000Z';
      const cAStored = inMemoryStore.getCourseById(cA.id)!;
      const cBStored = inMemoryStore.getCourseById(cB.id)!;
      cAStored.submittedAt = sameTime;
      cBStored.submittedAt = sameTime;

      const queue = inMemoryStore.getReviewQueue(adminUser);
      const relevant = queue.items.filter((item) => [cA.id, cB.id].includes(item.id));
      expect(relevant).toHaveLength(2);
      if (cA.id < cB.id) {
        expect(relevant[0].id).toBe(cA.id);
        expect(relevant[1].id).toBe(cB.id);
      } else {
        expect(relevant[0].id).toBe(cB.id);
        expect(relevant[1].id).toBe(cA.id);
      }
    });

    it('rejects review queue access by non-admin roles (403)', () => {
      expect(() => {
        inMemoryStore.getReviewQueue(lecturerUser);
      }).toThrowError('غير مصرح لك بعرض قائمة المراجعة');
    });
  });

  describe('5. Staged Administrator Edits & Concurrency', () => {
    it('saves staged edits, preserves cumulative patch, and strips protected fields', () => {
      // Save initial staged patch revision 1
      const payload1: AdminStagedEditPayload = {
        baselineId: 'CRS001',
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 1,
        patch: {
          title: 'عنوان معدل من الإدارة',
          lecturerId: 'hacked_lecturer', // Protected field
          rating: 5, // Protected field
        } as unknown as Partial<Course>,
      };

      const res1 = inMemoryStore.saveStagedAdminEdits('CRS001', payload1, adminUser);
      expect(res1.record.patchedContent.title).toBe('عنوان معدل من الإدارة');
      expect((res1.record.patchedContent as Record<string, unknown>).lecturerId).toBeUndefined();
      expect((res1.record.patchedContent as Record<string, unknown>).rating).toBeUndefined();

      // Save secondary cumulative patch revision 2
      const payload2: AdminStagedEditPayload = {
        baselineId: 'CRS001',
        baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
        clientRevision: 2,
        patch: {
          description: 'وصف إضافي من الإدارة',
        },
      };

      const res2 = inMemoryStore.saveStagedAdminEdits('CRS001', payload2, adminUser);
      expect(res2.record.clientRevision).toBe(2);
      // Both title and description are preserved cumulatively!
      expect(res2.record.patchedContent.title).toBe('عنوان معدل من الإدارة');
      expect(res2.record.patchedContent.description).toBe('وصف إضافي من الإدارة');
    });

    it('rejects stale revision with 409 Conflict', () => {
      inMemoryStore.saveStagedAdminEdits(
        'CRS001',
        {
          baselineId: 'CRS001',
          baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
          clientRevision: 5,
          patch: { title: 'تعديل 5' },
        },
        adminUser
      );

      // Attempt save with revision 5 (stale)
      expect(() => {
        inMemoryStore.saveStagedAdminEdits(
          'CRS001',
          {
            baselineId: 'CRS001',
            baselineSubmittedAt: '2026-10-19T10:00:00.000Z',
            clientRevision: 5,
            patch: { title: 'تعديل متأخر' },
          },
          adminUser
        );
      }).toThrowError('تعارض في التعديلات المتزامنة (409 Conflict)');
    });

    it('rejects staged edits save by non-admin roles', () => {
      expect(() => {
        inMemoryStore.saveStagedAdminEdits(
          'CRS001',
          {
            baselineId: 'CRS001',
            baselineSubmittedAt: '',
            clientRevision: 1,
            patch: { title: 'غير مسموح' },
          },
          lecturerUser
        );
      }).toThrowError('غير مصرح لك بتعديل محتوى المقرر كمسؤول');
    });
  });

  describe('6. Private Reviewer Working Notes', () => {
    it('saves and retrieves private working notes scoped by reviewer and course', () => {
      inMemoryStore.saveReviewerWorkingNotes(
        'CRS001',
        {
          generalNote: 'ملاحظة عامة للمراجع',
          chapterNotes: { ch1: 'تأكد من وضوح صوت المحاضر' },
          itemNotes: { it1: 'جودة الفيديو 720p' },
        },
        adminUser
      );

      const notes = inMemoryStore.getReviewerWorkingNotes('CRS001', adminUser);
      expect(notes.generalNote).toBe('ملاحظة عامة للمراجع');
      expect(notes.chapterNotes.ch1).toBe('تأكد من وضوح صوت المحاضر');
      expect(notes.itemNotes.it1).toBe('جودة الفيديو 720p');

      // Verify that course audit log is strictly untouched!
      const course = inMemoryStore.getCourseById('CRS001')!;
      expect(course.auditLog).toBeUndefined();
    });

    it('blocks lecturers from accessing reviewer working notes (403)', () => {
      expect(() => {
        inMemoryStore.getReviewerWorkingNotes('CRS001', lecturerUser);
      }).toThrowError('غير مصرح لك بعرض الملاحظات الخاصة بالمراجعين');
    });
  });

  describe('7. Review Decisions: Outcome A (Approve & Publish)', () => {
    it('approves course with submitted baseline unchanged when publishOption is submitted_baseline', () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للاعتماد', description: 'توصيف دقيق للمقرر', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس 1' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      // Staged edits exist in reviewer session
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt!,
          clientRevision: 1,
          patch: { title: 'عنوان الإدارة المهمل' },
        },
        adminUser
      );

      const decisionRes = inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'approved',
          publishOption: 'submitted_baseline',
          approvalNote: 'تم الاعتماد دون تعديلات',
        },
        adminUser
      );

      expect(decisionRes.outcome).toBe('approved');
      expect(decisionRes.course.status).toBe('published');
      expect(decisionRes.course.title).toBe('كورس للاعتماد'); // Baseline preserved!
      expect(decisionRes.auditEntry.action).toBe('approved');
      expect(decisionRes.auditEntry.approvalNote).toBe('تم الاعتماد دون تعديلات');
    });

    it('approves course with staged edits merged when publishOption is with_staged_edits', () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للاعتماد 2', description: 'توصيف معتمد', level: 'متوسط' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس 1' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt!,
          clientRevision: 1,
          patch: { title: 'عنوان معتمد بعد تعديل الإدارة' },
        },
        adminUser
      );

      const decisionRes = inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'approved',
          publishOption: 'with_staged_edits',
          approvalNote: 'تم دمج تعديلات الإدارة ونشر المقرر',
        },
        adminUser
      );

      expect(decisionRes.course.title).toBe('عنوان معتمد بعد تعديل الإدارة');
      expect(decisionRes.course.lastEditedByAdminId).toBe(adminUser.id);
      expect(decisionRes.course.status).toBe('published');

      // Staged edits store is cleaned up
      expect(inMemoryStore.getStagedAdminEdits(course.id, adminUser)).toBeNull();
    });
  });

  describe('8. Review Decisions: Outcome B (Return with Admin Edits)', () => {
    it('captures dual snapshots (baseline and adminEdited) and updates course draft', () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للإعادة بالتعديل', description: 'توصيف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس 1' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt!,
          clientRevision: 1,
          patch: { title: 'كورس معدل بواسطة الإدارة' },
        },
        adminUser
      );

      const decisionRes = inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'returned_with_admin_edits',
          summaryMessage: 'يرجى مراجعة التعديلات المرفقة واستكمال النواقص',
          items: [{ targetType: 'course', targetId: course.id, comment: 'عدلنا العنوان', severity: 'required' }],
        },
        adminUser
      );

      expect(decisionRes.outcome).toBe('returned_with_admin_edits');
      expect(decisionRes.course.status).toBe('draft');
      expect(decisionRes.course.title).toBe('كورس معدل بواسطة الإدارة');
      expect(decisionRes.course.lastEditedByAdminId).toBe(adminUser.id);

      // Verify audit entry has dual snapshots
      const audit = decisionRes.auditEntry;
      expect(audit.action).toBe('returned_with_admin_edits');
      expect(audit.baselineSnapshot).toBeDefined();
      expect(audit.baselineSnapshot!.title).toBe('كورس للإعادة بالتعديل');
      expect(audit.adminEditedSnapshot).toBeDefined();
      expect(audit.adminEditedSnapshot!.title).toBe('كورس معدل بواسطة الإدارة');

      // Active review feedback is populated
      expect(decisionRes.course.activeReviewFeedback).toBeDefined();
      expect(decisionRes.course.activeReviewFeedback!.stagedEditsApplied).toBe(true);
      expect(decisionRes.course.activeReviewFeedback!.summaryMessage).toBe('يرجى مراجعة التعديلات المرفقة واستكمال النواقص');
    });

    it('fails with 400 when returning with admin edits without any staged edits', () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس بدون تعديلات', description: 'وصف كامل', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس 1' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      expect(() => {
        inMemoryStore.executeReviewDecision(
          course.id,
          {
            outcome: 'returned_with_admin_edits',
            summaryMessage: 'رسالة بدون تعديلات',
          },
          adminUser
        );
      }).toThrowError('لا توجد تعديلات إدارة مؤقتة لإعادة المقرر بها');
    });
  });

  describe('9. Review Decisions: Outcome C (Reject without Admin Edits)', () => {
    it('rejects course, populates feedback, and retains staged edits as stale without committing them', () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للرفض', description: 'وصف دقيق للمقرر', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس 1' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      // Staged edits in progress
      inMemoryStore.saveStagedAdminEdits(
        course.id,
        {
          baselineId: course.id,
          baselineSubmittedAt: course.submittedAt!,
          clientRevision: 1,
          patch: { title: 'تعديل لا يجب اعتماده' },
        },
        adminUser
      );

      const decisionRes = inMemoryStore.executeReviewDecision(
        course.id,
        {
          outcome: 'rejected',
          summaryMessage: 'تم الرفض لعدم مطابقة المعايير الفنية',
        },
        adminUser
      );

      expect(decisionRes.outcome).toBe('rejected');
      expect(decisionRes.course.status).toBe('draft');
      // Original title is preserved, staged edits are NOT committed!
      expect(decisionRes.course.title).toBe('كورس للرفض');

      // Staged edits record is retained as stale
      const staged = inMemoryStore.getStagedAdminEdits(course.id, adminUser)!;
      expect(staged).toBeDefined();
      expect(staged.isStale).toBe(true);

      // Audit log has action rejected
      expect(decisionRes.auditEntry.action).toBe('rejected');
      expect(decisionRes.course.activeReviewFeedback!.stagedEditsApplied).toBe(false);
    });

    it('fails with 422 when rejecting without summary feedback message', () => {
      const course = inMemoryStore.createCourse(
        { title: 'كورس للرفض بدون سبب', description: 'وصف', level: 'مبتدئ' },
        adminUser
      );
      course.chapters[0].items.push({ id: 'i1', type: 'video', title: 'درس 1' });
      inMemoryStore.saveCourseDraft(course.id, course, adminUser);
      inMemoryStore.submitCourseForReview(course.id, adminUser);

      expect(() => {
        inMemoryStore.executeReviewDecision(
          course.id,
          {
            outcome: 'rejected',
            summaryMessage: '   ',
          },
          adminUser
        );
      }).toThrowError('سبب الرفض والتغذية الراجعة مطلوبة عند إعادة المقرر');
    });
  });

  describe('10. Store Reset & LocalStorage Cleanup', () => {
    it('resets in-memory state and cleans staged edits and reviewer notes keys from localStorage', () => {
      inMemoryStore.saveStagedAdminEdits(
        'CRS001',
        {
          baselineId: 'CRS001',
          baselineSubmittedAt: '',
          clientRevision: 1,
          patch: { title: 'تعديل' },
        },
        adminUser
      );
      inMemoryStore.saveReviewerWorkingNotes(
        'CRS001',
        { generalNote: 'ملاحظة' },
        adminUser
      );

      // Verify keys set in localStorage
      expect(localStorage.getItem('metro_admin_staged_edits_CRS001')).toBeDefined();
      expect(localStorage.getItem(`metro_reviewer_notes_${adminUser.id}_CRS001`)).toBeDefined();

      // Reset
      inMemoryStore.reset();

      // Staged edits and notes in memory and localStorage are cleared
      expect(inMemoryStore.getStagedAdminEdits('CRS001', adminUser)).toBeNull();
      expect(localStorage.getItem('metro_admin_staged_edits_CRS001')).toBeNull();
      expect(localStorage.getItem(`metro_reviewer_notes_${adminUser.id}_CRS001`)).toBeNull();
    });
  });
});
