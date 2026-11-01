/**
 * Increment 3.3 — Course & Review Read Visibility & Admin Preview Progress Isolation
 *
 * MFR-30 (Course & Review Read Visibility for assistant_admin, super_admin, developer without mutation rights)
 * MFR-21 (Admin-class Preview Progress Isolation for developer, super_admin, admin, assistant_admin, lecturer)
 *
 * GOVERNANCE & EXECUTION DIRECTIVE:
 * Per Owner Directive Part A (Consolidated Phase 13 Testing Workflow), this test suite
 * is authored during Increment 3.3 implementation and marked:
 *
 * STATUS: WRITTEN — NOT YET EXECUTED — DEFERRED TO PHASE 13
 * Zero test runner commands (vitest, pnpm test) were executed during this turn.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { reviewApi } from '@/features/course-review/api/reviewApi';
import { builderApi } from '@/features/course-builder/services/builderApi';
import { apiClient, ApiError } from '@/core/api/apiClient';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import {
  BASE_MANAGED_USERS,
  SYNTHETIC_DEVELOPER_USER,
  SYNTHETIC_SUPER_ADMIN_USER,
} from '@/mocks/fixtures/userDirectoryFixtures';
import { getControlledTestFixtures } from '@/mocks/handlers/resolveUser';
import type { UserRole, AuthenticatedUser } from '@/core/auth/types';
import type {
  ReviewQueueResponseDTO,
  CourseReviewDataResponseDTO,
  StagedAdminEditsRecord,
  ReviewerWorkingNotes,
  ReviewDecisionResponseDTO,
} from '@/core/courses/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

function setSessionForUser(user: AuthenticatedUser) {
  authStorage.setSession({
    token: `token-${user.id}`,
    user,
    expiresAt: Date.now() + 86400000,
  });
}

function setSessionForRole(role: UserRole) {
  if (role === 'developer') {
    setSessionForUser(SYNTHETIC_DEVELOPER_USER);
    return;
  }
  if (role === 'super_admin') {
    setSessionForUser(SYNTHETIC_SUPER_ADMIN_USER);
    return;
  }
  const account = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find((a) => a.user.role === role);
  if (!account) {
    throw new Error(`No synthetic demo account found for role: ${role}`);
  }
  setSessionForUser(account.user);
}

describe('Increment 3.3 — Course & Review Read Visibility & Admin Preview Progress Isolation', () => {
  const pendingReviewCourseId = 'CRS-REV-NEW-01'; // New course awaiting review in review queue
  const updatedCourseWithStagedId = 'CRS-REV-UPD-02'; // Course with staged admin edits
  const standardCourseId = 'CRS001'; // Standard published course (lecturer: USR002)
  const item1Id = 'ITEM001';
  const item2Id = 'ITEM002';

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PART A: COURSE & REVIEW READ VISIBILITY & MUTATION SEPARATION (MFR-30)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Part A: Review Read Visibility & Decision Mutation Separation (MFR-30)', () => {
    it('1. allows assistant_admin, super_admin, developer, and admin to read review queue via GET /api/approvals/queue', async () => {
      const adminRoles: UserRole[] = ['assistant_admin', 'super_admin', 'developer', 'admin'];

      for (const role of adminRoles) {
        setSessionForRole(role);

        const queue: ReviewQueueResponseDTO = await reviewApi.getReviewQueue();
        expect(queue).toBeDefined();
        expect(Array.isArray(queue.items)).toBe(true);
        expect(typeof queue.totalCount).toBe('number');
        expect(queue.totalCount).toBeGreaterThanOrEqual(1);

        const foundPending = queue.items.some((item) => item.id === pendingReviewCourseId);
        expect(foundPending).toBe(true);
      }
    });

    it('2. allows assistant_admin, super_admin, developer, and admin to read authoritative course review data', async () => {
      const adminRoles: UserRole[] = ['assistant_admin', 'super_admin', 'developer', 'admin'];

      for (const role of adminRoles) {
        setSessionForRole(role);

        // 2a. Canonical route GET /api/courses/:courseId/review-data
        const reviewData: CourseReviewDataResponseDTO = await reviewApi.getCourseReviewData(pendingReviewCourseId);
        expect(reviewData).toBeDefined();
        expect(reviewData.course).toBeDefined();
        expect(reviewData.course.id).toBe(pendingReviewCourseId);
        expect(reviewData.effectiveContent).toBeDefined();

        // 2b. Admin alias route GET /api/admin/review/:courseId
        const adminReviewData = await apiClient<CourseReviewDataResponseDTO>(
          `/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}`,
          { method: 'GET' }
        );
        expect(adminReviewData.course.id).toBe(pendingReviewCourseId);
      }
    });

    it('3. allows assistant_admin to read staged admin edits and reviewer working notes without 403', async () => {
      setSessionForRole('assistant_admin');

      // Staged edits read
      const stagedRes = await reviewApi.getStagedAdminEdits(updatedCourseWithStagedId);
      expect(stagedRes).toBeDefined();

      // Working notes read
      const notes = await apiClient<ReviewerWorkingNotes>(
        `/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}/working-notes`,
        { method: 'GET' }
      );
      expect(notes).toBeDefined();
      expect(notes.courseId).toBe(pendingReviewCourseId);
    });

    it('4. strictly rejects assistant_admin from executing review decisions (approve, reject, return-with-edits) with HTTP 403', async () => {
      setSessionForRole('assistant_admin');

      // 4a. Unified decision endpoint POST /api/admin/review/:courseId/decision
      try {
        await apiClient(`/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}/decision`, {
          method: 'POST',
          body: JSON.stringify({ outcome: 'approved', publishOption: 'submitted_baseline' }),
        });
        expect.unreachable('Assistant Admin must NOT be authorized to execute review decisions');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 4b. Dedicated Approve endpoint POST /api/admin/review/:courseId/approve
      try {
        await apiClient(`/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}/approve`, {
          method: 'POST',
          body: JSON.stringify({ publishOption: 'submitted_baseline' }),
        });
        expect.unreachable('Assistant Admin must NOT be authorized to approve courses');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 4c. Dedicated Return With Edits endpoint POST /api/admin/review/:courseId/return-with-edits
      try {
        await apiClient(`/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}/return-with-edits`, {
          method: 'POST',
          body: JSON.stringify({ summaryMessage: 'يرجى مراجعة الصياغة' }),
        });
        expect.unreachable('Assistant Admin must NOT be authorized to return courses with edits');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 4d. Dedicated Reject endpoint POST /api/admin/review/:courseId/reject
      try {
        await apiClient(`/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}/reject`, {
          method: 'POST',
          body: JSON.stringify({ summaryMessage: 'المحتوى لا يطابق المعايير' }),
        });
        expect.unreachable('Assistant Admin must NOT be authorized to reject courses');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('5. strictly rejects assistant_admin from saving or discarding staged edits and working notes with HTTP 403', async () => {
      setSessionForRole('assistant_admin');

      // 5a. Save staged edits PUT
      try {
        await reviewApi.saveStagedAdminEdits(pendingReviewCourseId, {
          clientRevision: 1,
          patch: { title: 'عنوان معدل من مساعد المسؤول' },
        });
        expect.unreachable('Assistant Admin must NOT be authorized to save staged edits');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 5b. Discard staged edits DELETE
      try {
        await reviewApi.discardStagedAdminEdits(updatedCourseWithStagedId);
        expect.unreachable('Assistant Admin must NOT be authorized to discard staged edits');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 5c. Save working notes PUT
      try {
        await apiClient(`/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}/working-notes`, {
          method: 'PUT',
          body: JSON.stringify({ generalNote: 'ملاحظة خاصة' }),
        });
        expect.unreachable('Assistant Admin must NOT be authorized to save reviewer working notes');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // 5d. Delete working notes DELETE
      try {
        await apiClient(
          `/api/admin/review/${encodeURIComponent(pendingReviewCourseId)}/working-notes/general/default`,
          { method: 'DELETE' }
        );
        expect.unreachable('Assistant Admin must NOT be authorized to delete reviewer working notes');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('6. preserves review decision authority for operational administrators (admin, super_admin, developer)', async () => {
      // Setup a fresh pending course for approval
      const freshCourse = inMemoryStore.courses.find((c) => c.id === pendingReviewCourseId);
      if (freshCourse) freshCourse.status = 'pending_admin';

      setSessionForRole('admin');
      const decisionRes = await reviewApi.executeReviewDecision(pendingReviewCourseId, {
        outcome: 'approved',
        publishOption: 'submitted_baseline',
        approvalNote: 'تم الاعتماد بنجاح بواسطة مدير النظام',
      });
      expect(decisionRes).toBeDefined();
      expect(decisionRes.outcome).toBe('approved');
    });

    it('7. preserves lecturer access behavior: owner can read review data, unrelated lecturer receives 403', async () => {
      // 7a. Lecturer owner (usr_lect_002 owns CRS-REV-NEW-01)
      const ownerAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturer;
      setSessionForUser(ownerAccount.user);

      const ownerData = await reviewApi.getCourseReviewData(pendingReviewCourseId);
      expect(ownerData).toBeDefined();
      expect(ownerData.course.id).toBe(pendingReviewCourseId);

      // 7b. Unrelated lecturer (USR017 does not own CRS-REV-NEW-01)
      const otherLecturerAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
      setSessionForUser(otherLecturerAccount.user);

      try {
        await reviewApi.getCourseReviewData(pendingReviewCourseId);
        expect.unreachable('Unrelated lecturer must NOT be authorized to read another lecturer review data');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('8. strictly denies trainee from reading review queue or review data (403)', async () => {
      setSessionForRole('user');

      // Review queue
      try {
        await reviewApi.getReviewQueue();
        expect.unreachable('Trainee must NOT access review queue');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // Course review data
      try {
        await reviewApi.getCourseReviewData(pendingReviewCourseId);
        expect.unreachable('Trainee must NOT access course review data');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PART B: COURSE ACCESS SEPARATION & MUTATION RESTRICTIONS (MFR-30)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Part B: Course Access Separation & Mutation Restrictions (MFR-30)', () => {
    it('9. allows assistant_admin to retrieve course data for preview/editing inspection via GET /api/lecturer/courses/:id', async () => {
      setSessionForRole('assistant_admin');

      const course = await builderApi.getCourseForEditing(standardCourseId);
      expect(course).toBeDefined();
      expect(course.id).toBe(standardCourseId);
      expect(course.title).toBeDefined();
      expect(Array.isArray(course.chapters)).toBe(true);
    });

    it('10. allows super_admin and developer to retrieve course data for preview/editing inspection', async () => {
      for (const role of ['super_admin', 'developer'] as UserRole[]) {
        setSessionForRole(role);

        const course = await builderApi.getCourseForEditing(standardCourseId);
        expect(course).toBeDefined();
        expect(course.id).toBe(standardCourseId);
      }
    });

    it('11. strictly rejects assistant_admin from updating course drafts (403)', async () => {
      setSessionForRole('assistant_admin');

      try {
        await builderApi.saveCourseDraft(standardCourseId, {
          title: 'محاولة تعديل مسودة من مساعد المسؤول',
        });
        expect.unreachable('Assistant Admin must NOT be authorized to save course drafts');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('12. strictly rejects assistant_admin from resetting lab courses (403)', async () => {
      setSessionForRole('assistant_admin');

      try {
        await builderApi.resetContentLab(standardCourseId);
        expect.unreachable('Assistant Admin must NOT be authorized to reset lab courses');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('13. strictly rejects assistant_admin from submitting courses for review (403)', async () => {
      setSessionForRole('assistant_admin');

      try {
        await reviewApi.submitCourse(standardCourseId);
        expect.unreachable('Assistant Admin must NOT be authorized to submit courses for review');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('14. preserves course authoring mutations for assigned course lecturer', async () => {
      const ownerAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturer;
      setSessionForUser(ownerAccount.user);

      // Assigned lecturer can read course for editing
      const course = await builderApi.getCourseForEditing(standardCourseId);
      expect(course.id).toBe(standardCourseId);

      // Assigned lecturer can save draft
      const saveRes = await builderApi.saveCourseDraft(standardCourseId, {
        description: 'تحديث وصف الدورة بواسطة المحاضر المعتمد',
      });
      expect(saveRes).toBeDefined();
      expect(saveRes.course.id).toBe(standardCourseId);
    });

    it('15. strictly rejects unassigned lecturer from accessing course for editing (403)', async () => {
      // USR017 is not an instructor for CRS001
      const otherLecturerAccount = SYNTHETIC_DEMO_ACCOUNTS.lecturerAssistant;
      setSessionForUser(otherLecturerAccount.user);

      try {
        await builderApi.getCourseForEditing(standardCourseId);
        expect.unreachable('Unassigned lecturer must NOT access another lecturer course for editing');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }
    });

    it('16. allows assistant_admin to list all courses via GET /api/lecturer/courses without 403', async () => {
      setSessionForRole('assistant_admin');

      const courses = await builderApi.getLecturerCourses();
      expect(courses).toBeDefined();
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PART C: ADMIN-CLASS PREVIEW PROGRESS ISOLATION (MFR-21)
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Part C: Admin-Class Preview Progress Isolation (MFR-21)', () => {
    const previewRoles: UserRole[] = [
      'developer',
      'super_admin',
      'admin',
      'assistant_admin',
      'lecturer',
    ];

    it('17. isolates lesson playback activity: preview roles do NOT mutate trainee userProgress records', async () => {
      for (const role of previewRoles) {
        setSessionForRole(role);

        // Fetch authenticated user ID
        const currentUser = authStorage.getUser();
        expect(currentUser).toBeDefined();
        const userId = currentUser!.id;

        // Perform lesson activity call (preview playback)
        const activityRes = await apiClient<{ item: { completed: boolean; lastPositionSeconds: number } }>(
          `/api/courses/${standardCourseId}/items/${item1Id}/activity`,
          {
            method: 'POST',
            body: JSON.stringify({
              lastPositionSeconds: 120,
              furthestWatchedSeconds: 120,
              durationSeconds: 300,
            }),
          }
        );

        // Response reflects simulated activity
        expect(activityRes.item).toBeDefined();
        expect(activityRes.item.lastPositionSeconds).toBe(120);

        // STORE INVARIANT: inMemoryStore.userProgress must NOT have any entry for this preview user
        const rawStore = inMemoryStore as unknown as {
          userProgress: Record<string, Record<string, Record<string, unknown>>>;
          lastWatched: Record<string, Record<string, string>>;
        };

        const canonicalId = userId.toLowerCase();
        const progressForUser = rawStore.userProgress[canonicalId];
        expect(progressForUser).toBeUndefined();

        const lastWatchedForUser = rawStore.lastWatched[canonicalId];
        expect(lastWatchedForUser).toBeUndefined();

        // getCourseProgress returns clean unstarted progress
        const computedProgress = inMemoryStore.getCourseProgress(userId, standardCourseId);
        expect(computedProgress.progressPercent).toBe(0);
        expect(computedProgress.completedItemIds).toHaveLength(0);
        expect(computedProgress.lastWatchedItemId).toBeNull();
        expect(computedProgress.isCompleted).toBe(false);
      }
    });

    it('18. isolates lesson completion: preview roles do NOT persist completed lessons to trainee progress', async () => {
      for (const role of previewRoles) {
        setSessionForRole(role);

        const currentUser = authStorage.getUser();
        expect(currentUser).toBeDefined();
        const userId = currentUser!.id;

        // Perform lesson completion call in preview mode
        const completeRes = await apiClient<{
          completedItem: { completed: boolean };
          message: string;
          justCompletedCourse: boolean;
        }>(`/api/courses/${standardCourseId}/items/${item1Id}/complete`, {
          method: 'POST',
        });

        // Response acknowledges preview mode without persisting
        expect(completeRes.completedItem.completed).toBe(true);
        expect(completeRes.message).toContain('معاينة');
        expect(completeRes.justCompletedCourse).toBe(false);

        // STORE INVARIANT: inMemoryStore.userProgress must NOT persist this completion
        const rawStore = inMemoryStore as unknown as {
          userProgress: Record<string, Record<string, Record<string, unknown>>>;
          lastWatched: Record<string, Record<string, string>>;
        };

        const canonicalId = userId.toLowerCase();
        expect(rawStore.userProgress[canonicalId]).toBeUndefined();
        expect(rawStore.lastWatched[canonicalId]).toBeUndefined();

        // Computed progress remains strictly 0%
        const computedProgress = inMemoryStore.getCourseProgress(userId, standardCourseId);
        expect(computedProgress.progressPercent).toBe(0);
        expect(computedProgress.completedItemIds).toHaveLength(0);
        expect(computedProgress.isCompleted).toBe(false);
      }
    });

    it('19. preserves genuine trainee progress tracking: role user successfully updates progress and lastWatched', async () => {
      setSessionForRole('user');

      const traineeUser = authStorage.getUser();
      expect(traineeUser).toBeDefined();
      const traineeId = traineeUser!.id;

      // 1. Trainee records lesson activity
      const activityRes = await apiClient<{ item: { completed: boolean; lastPositionSeconds: number } }>(
        `/api/courses/${standardCourseId}/items/${item1Id}/activity`,
        {
          method: 'POST',
          body: JSON.stringify({
            lastPositionSeconds: 65,
            furthestWatchedSeconds: 65,
            durationSeconds: 300,
          }),
        }
      );
      expect(activityRes.item.lastPositionSeconds).toBe(65);

      // Trainee progress IS written to store
      const rawStore = inMemoryStore as unknown as {
        userProgress: Record<string, Record<string, Record<string, { lastPositionSeconds: number }>>>;
        lastWatched: Record<string, Record<string, string>>;
      };
      const canonicalTrainee = traineeId.toLowerCase();
      expect(rawStore.userProgress[canonicalTrainee]).toBeDefined();
      expect(rawStore.lastWatched[canonicalTrainee]).toBeDefined();
      expect(rawStore.lastWatched[canonicalTrainee][standardCourseId.toLowerCase()]).toBe(item1Id);

      // 2. Trainee completes lesson 1
      const completeRes = await apiClient<{
        completedItem: { completed: boolean };
        progress: { completedItemIds: string[]; progressPercent: number };
      }>(`/api/courses/${standardCourseId}/items/${item1Id}/complete`, {
        method: 'POST',
      });
      expect(completeRes.completedItem.completed).toBe(true);
      expect(completeRes.progress.completedItemIds).toContain(item1Id);
      expect(completeRes.progress.progressPercent).toBeGreaterThan(0);

      // Computed progress reflects trainee achievement
      const traineeProgress = inMemoryStore.getCourseProgress(traineeId, standardCourseId);
      expect(traineeProgress.completedItemIds).toContain(item1Id);
      expect(traineeProgress.progressPercent).toBeGreaterThan(0);
      expect(traineeProgress.lastWatchedItemId).toBe(item1Id);
    });

    it('20. enforces sequential lesson locking for trainees while preview roles can access all lessons freely', async () => {
      setSessionForRole('user');
      const traineeUser = authStorage.getUser()!;

      // Trainee attempting to complete item 2 before completing item 1 receives 403 Forbidden
      try {
        await apiClient(`/api/courses/${standardCourseId}/items/${item2Id}/complete`, {
          method: 'POST',
        });
        expect.unreachable('Trainee must NOT complete locked lesson out of sequence');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(403);
      }

      // Conversely, preview role (assistant_admin) can preview item 2 without locking errors
      setSessionForRole('assistant_admin');
      const previewCompleteRes = await apiClient<{ completedItem: { completed: boolean } }>(
        `/api/courses/${standardCourseId}/items/${item2Id}/complete`,
        { method: 'POST' }
      );
      expect(previewCompleteRes.completedItem.completed).toBe(true);
    });

    it('21. prevents caller role spoofing: candidate role "user" CANNOT bypass preview isolation for admin or lecturer accounts', () => {
      // Direct store call with candidate userRole: 'user' for an admin account (USR001)
      const adminUserId = 'USR001';
      const lecturerUserId = 'USR002';
      const rawStore = inMemoryStore as unknown as {
        userProgress: Record<string, Record<string, Record<string, unknown>>>;
        lastWatched: Record<string, Record<string, string>>;
      };

      // 1. Admin recordLessonActivity with spoofed userRole: 'user'
      const adminActivity = inMemoryStore.recordLessonActivity({
        userId: adminUserId,
        courseId: standardCourseId,
        itemId: item1Id,
        activity: { lastPositionSeconds: 150, furthestWatchedSeconds: 150 },
        userRole: 'user', // Spoof attempt: caller claims to be a trainee
      });

      // Returns simulated preview activity
      expect(adminActivity).toBeDefined();
      expect(adminActivity.lastPositionSeconds).toBe(150);

      // STORE INVARIANT: Authoritative resolution overrides candidate role; NO progress written
      expect(rawStore.userProgress[adminUserId.toLowerCase()]).toBeUndefined();
      expect(rawStore.lastWatched[adminUserId.toLowerCase()]).toBeUndefined();

      // 2. Lecturer markLessonComplete with spoofed userRole: 'user'
      const lecturerComplete = inMemoryStore.markLessonComplete({
        userId: lecturerUserId,
        courseId: standardCourseId,
        itemId: item1Id,
        userRole: 'user', // Spoof attempt
      });

      expect(lecturerComplete.completedItem.completed).toBe(true);
      expect(lecturerComplete.message).toContain('معاينة');

      // STORE INVARIANT: NO progress written for lecturer
      expect(rawStore.userProgress[lecturerUserId.toLowerCase()]).toBeUndefined();
      expect(rawStore.lastWatched[lecturerUserId.toLowerCase()]).toBeUndefined();
    });

    it('22. fails closed on unresolvable user IDs: unknown identity creates NO progress or lastWatched records', () => {
      const unknownUserId = 'unresolvable_ghost_actor_999';
      const rawStore = inMemoryStore as unknown as {
        userProgress: Record<string, Record<string, Record<string, unknown>>>;
        lastWatched: Record<string, Record<string, string>>;
      };

      // 1. recordLessonActivity fails closed
      try {
        inMemoryStore.recordLessonActivity({
          userId: unknownUserId,
          courseId: standardCourseId,
          itemId: item1Id,
          activity: { lastPositionSeconds: 45 },
          userRole: 'user',
        });
        expect.unreachable('Unresolvable identity must fail closed on recordLessonActivity');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as { status?: number }).status).toBe(401);
      }

      expect(rawStore.userProgress[unknownUserId.toLowerCase()]).toBeUndefined();
      expect(rawStore.lastWatched[unknownUserId.toLowerCase()]).toBeUndefined();

      // 2. markLessonComplete fails closed
      try {
        inMemoryStore.markLessonComplete({
          userId: unknownUserId,
          courseId: standardCourseId,
          itemId: item1Id,
          userRole: 'user',
        });
        expect.unreachable('Unresolvable identity must fail closed on markLessonComplete');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as { status?: number }).status).toBe(401);
      }

      expect(rawStore.userProgress[unknownUserId.toLowerCase()]).toBeUndefined();
      expect(rawStore.lastWatched[unknownUserId.toLowerCase()]).toBeUndefined();
    });

    it('23. fails closed on tombstoned users: deleted accounts CANNOT record activity or complete lessons', () => {
      const tombstonedUserId = 'USR011';
      // Mark user as deleted / tombstoned
      inMemoryStore.deleteManagedUser(tombstonedUserId, 'USR_DEV_001', 'developer');

      const rawStore = inMemoryStore as unknown as {
        userProgress: Record<string, Record<string, Record<string, unknown>>>;
        lastWatched: Record<string, Record<string, string>>;
      };

      // 1. recordLessonActivity fails closed
      try {
        inMemoryStore.recordLessonActivity({
          userId: tombstonedUserId,
          courseId: standardCourseId,
          itemId: item1Id,
          activity: { lastPositionSeconds: 60 },
        });
        expect.unreachable('Tombstoned user must fail closed on recordLessonActivity');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as { status?: number }).status).toBe(401);
      }

      // 2. markLessonComplete fails closed
      try {
        inMemoryStore.markLessonComplete({
          userId: tombstonedUserId,
          courseId: standardCourseId,
          itemId: item1Id,
        });
        expect.unreachable('Tombstoned user must fail closed on markLessonComplete');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as { status?: number }).status).toBe(401);
      }

      expect(rawStore.userProgress[tombstonedUserId.toLowerCase()]).toBeUndefined();
    });

    it('24. strictly preserves pre-existing progress and lastWatched records for preview personas', () => {
      const lecturerId = 'USR002';
      const canonicalId = lecturerId.toLowerCase();
      const rawStore = inMemoryStore as unknown as {
        userProgress: Record<string, Record<string, Record<string, unknown>>>;
        lastWatched: Record<string, Record<string, string>>;
      };

      // Seed initial historical progress for the lecturer
      const initialProgress = {
        itemId: item1Id,
        completed: true,
        completedAt: '2026-01-15T10:00:00.000Z',
        lastPositionSeconds: 400,
        furthestWatchedSeconds: 500,
        eligibleViewingSeconds: 400,
        durationSeconds: 600,
        updatedAt: '2026-01-15T10:00:00.000Z',
      };

      rawStore.userProgress[canonicalId] = {
        [standardCourseId.toLowerCase()]: {
          [item1Id]: { ...initialProgress },
        },
      };
      rawStore.lastWatched[canonicalId] = {
        [standardCourseId.toLowerCase()]: item1Id,
      };

      // 1. Preview actor records new activity with different playback numbers
      const activityRes = inMemoryStore.recordLessonActivity({
        userId: lecturerId,
        courseId: standardCourseId,
        itemId: item1Id,
        activity: {
          lastPositionSeconds: 50,
          furthestWatchedSeconds: 50,
          eligibleViewingSeconds: 50,
        },
      });

      expect(activityRes).toBeDefined();

      // INVARIANT: Pre-existing progress record is completely untouched
      const storedProgressAfterActivity =
        rawStore.userProgress[canonicalId][standardCourseId.toLowerCase()][item1Id];
      expect(storedProgressAfterActivity).toEqual(initialProgress);
      expect(rawStore.lastWatched[canonicalId][standardCourseId.toLowerCase()]).toBe(item1Id);

      // 2. Preview actor calls markLessonComplete on a different item (item2Id)
      const completeRes = inMemoryStore.markLessonComplete({
        userId: lecturerId,
        courseId: standardCourseId,
        itemId: item2Id,
      });

      expect(completeRes.completedItem.completed).toBe(true);

      // INVARIANT: item2Id was NOT added to userProgress, and item1Id remains untouched
      expect(
        rawStore.userProgress[canonicalId][standardCourseId.toLowerCase()][item2Id]
      ).toBeUndefined();
      expect(
        rawStore.userProgress[canonicalId][standardCourseId.toLowerCase()][item1Id]
      ).toEqual(initialProgress);

      // lastWatched still points to initial item1Id, NOT item2Id
      expect(rawStore.lastWatched[canonicalId][standardCourseId.toLowerCase()]).toBe(item1Id);
    });

    it('25. authentic trainee progression: verifies end-to-end sequential unlocking and progress persistence', () => {
      const traineeId = 'USR003';
      const canonicalId = traineeId.toLowerCase();
      const rawStore = inMemoryStore as unknown as {
        userProgress: Record<string, Record<string, Record<string, unknown>>>;
        lastWatched: Record<string, Record<string, string>>;
      };

      // 1. Trainee cannot complete item 2 before completing item 1 (sequential lock)
      try {
        inMemoryStore.markLessonComplete({
          userId: traineeId,
          courseId: standardCourseId,
          itemId: item2Id,
          userRole: 'user',
        });
        expect.unreachable('Trainee must NOT complete locked lesson 2 out of order');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as { status?: number }).status).toBe(403);
      }

      // 2. Trainee completes item 1 successfully
      const complete1 = inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: standardCourseId,
        itemId: item1Id,
        userRole: 'user',
      });
      expect(complete1.completedItem.completed).toBe(true);
      expect(complete1.justCompletedCourse).toBe(false);

      // Progress is persisted
      expect(rawStore.userProgress[canonicalId][standardCourseId.toLowerCase()][item1Id]).toBeDefined();
      expect(rawStore.lastWatched[canonicalId][standardCourseId.toLowerCase()]).toBe(item1Id);

      // 3. Now item 2 is unlocked and trainee completes item 2
      const complete2 = inMemoryStore.markLessonComplete({
        userId: traineeId,
        courseId: standardCourseId,
        itemId: item2Id,
        userRole: 'user',
      });
      expect(complete2.completedItem.completed).toBe(true);
      expect(rawStore.userProgress[canonicalId][standardCourseId.toLowerCase()][item2Id]).toBeDefined();
      expect(rawStore.lastWatched[canonicalId][standardCourseId.toLowerCase()]).toBe(item2Id);
    });

    // ══════════════════════════════════════════════════════════════════════════════
    // PART D: PRODUCTION FIXTURE ISOLATION & SESSION REVOCATION RECONCILIATION
    // ══════════════════════════════════════════════════════════════════════════════

    it('26. production fixture isolation: every entry in CONTROLLED_TEST_FIXTURE_USERS is rejected when production mode is simulated', () => {
      const devFixtures = getControlledTestFixtures('development');
      expect(Object.keys(devFixtures).length).toBeGreaterThanOrEqual(6);

      // Verify each controlled test fixture identity fails closed in simulated production mode
      for (const fixtureId of Object.keys(devFixtures)) {
        const resolved = inMemoryStore.resolveAuthoritativeProgressRole(
          fixtureId,
          undefined,
          'production' // Simulating production environment
        );
        expect(resolved).toBeNull();
      }
    });

    it('27. approved canonical production directory users resolve normally in simulated production mode', () => {
      // Test canonical directory users from BASE_MANAGED_USERS
      const canonicalTrainee = inMemoryStore.resolveAuthoritativeProgressRole(
        'USR003',
        undefined,
        'production'
      );
      expect(canonicalTrainee).not.toBeNull();
      expect(canonicalTrainee?.role).toBe('user');
      expect(canonicalTrainee?.isAuthoritativeTrainee).toBe(true);
      expect(canonicalTrainee?.isPreview).toBe(false);

      const canonicalAdmin = inMemoryStore.resolveAuthoritativeProgressRole(
        'USR001',
        undefined,
        'production'
      );
      expect(canonicalAdmin).not.toBeNull();
      expect(canonicalAdmin?.role).toBe('admin');
      expect(canonicalAdmin?.isPreview).toBe(true);

      const canonicalLecturer = inMemoryStore.resolveAuthoritativeProgressRole(
        'USR002',
        undefined,
        'production'
      );
      expect(canonicalLecturer).not.toBeNull();
      expect(canonicalLecturer?.role).toBe('lecturer');
      expect(canonicalLecturer?.isPreview).toBe(true);

      const canonicalAssistantAdmin = inMemoryStore.resolveAuthoritativeProgressRole(
        'USR016',
        undefined,
        'production'
      );
      expect(canonicalAssistantAdmin).not.toBeNull();
      expect(canonicalAssistantAdmin?.role).toBe('assistant_admin');
      expect(canonicalAssistantAdmin?.isPreview).toBe(true);

      const canonicalAssistantLecturer = inMemoryStore.resolveAuthoritativeProgressRole(
        'USR017',
        undefined,
        'production'
      );
      expect(canonicalAssistantLecturer).not.toBeNull();
      expect(canonicalAssistantLecturer?.role).toBe('lecturer');
      expect(canonicalAssistantLecturer?.isPreview).toBe(true);
    });

    it('28. synthetic Developer and Super Admin identities strictly do NOT resolve in production mode', () => {
      // Developer persona
      const devResolved = inMemoryStore.resolveAuthoritativeProgressRole(
        'USR_DEV_001',
        undefined,
        'production'
      );
      expect(devResolved).toBeNull();

      // Super Admin persona
      const superAdminResolved = inMemoryStore.resolveAuthoritativeProgressRole(
        'USR_SUPER_001',
        undefined,
        'production'
      );
      expect(superAdminResolved).toBeNull();

      // Legacy aliases
      expect(
        inMemoryStore.resolveAuthoritativeProgressRole('usr_dev_001', undefined, 'production')
      ).toBeNull();
      expect(
        inMemoryStore.resolveAuthoritativeProgressRole('usr_super_001', undefined, 'production')
      ).toBeNull();
    });

    it('29. active session cache isolation: a valid session for User A cannot resolve an unrelated User B', () => {
      // Set active session for User A (USR001)
      authStorage.setSession({
        token: 'token-usr-001',
        user: {
          id: 'USR001',
          name: 'م. أحمد ممدوح',
          email: 'ahmed@metro.local',
          role: 'admin',
          department: 'التشغيل',
          jobTitle: 'مدير عام',
          initials: 'أم',
        },
        expiresAt: Date.now() + 3600000,
      });

      // Target is an unknown ghost user (User B)
      const ghostId = 'unresolvable_user_b_999';
      const resolvedGhost = inMemoryStore.resolveAuthoritativeProgressRole(ghostId);
      expect(resolvedGhost).toBeNull();

      // Target is another user (e.g. USR003) but caller tries to resolve via User A's session
      // When queried for a non-existent actor, User A's session is never used
      expect(inMemoryStore.resolveAuthoritativeProgressRole('non_existent_actor')).toBeNull();
    });

    it('30. expired, cleared, and tombstoned sessions strictly fail closed', () => {
      // 1. Expired session
      authStorage.setSession({
        token: 'token-expired',
        user: {
          id: 'temp_user_test',
          name: 'مستخدم تجريبي',
          email: 'temp@test.local',
          role: 'user',
          department: 'التشغيل',
          jobTitle: 'متدرب',
          initials: 'م.ت',
        },
        expiresAt: Date.now() - 1000, // Expired 1 second ago
      });

      // Expired session fails closed
      const expiredResolution = inMemoryStore.resolveAuthoritativeProgressRole('temp_user_test');
      expect(expiredResolution).toBeNull();

      // 2. Cleared session (logout invalidation)
      authStorage.clearSession();
      const clearedResolution = inMemoryStore.resolveAuthoritativeProgressRole('temp_user_test');
      expect(clearedResolution).toBeNull();

      // 3. Tombstoned user session
      const tombstonedUserId = 'USR011';
      inMemoryStore.deleteManagedUser(tombstonedUserId, 'USR_DEV_001', 'developer');

      authStorage.setSession({
        token: 'token-tombstoned',
        user: {
          id: tombstonedUserId,
          name: 'عمرو عبد السلام',
          email: 'amr@metro.local',
          role: 'user',
          department: 'التشغيل',
          jobTitle: 'متدرب',
          initials: 'ع.ع',
        },
        expiresAt: Date.now() + 3600000,
      });

      // Tombstoned user fails closed regardless of active session
      const tombstonedResolution = inMemoryStore.resolveAuthoritativeProgressRole(tombstonedUserId);
      expect(tombstonedResolution).toBeNull();
    });
  });
});

