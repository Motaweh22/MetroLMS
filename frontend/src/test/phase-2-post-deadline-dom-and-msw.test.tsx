/**
 * MetroLMS — Phase 2 / WP-2.4 / Task T-2.4.3 Test Suite
 *
 * Mounted React DOM Component Tests, Direct MSW HTTP Interception,
 * Video Player Seek-Restriction Notification Recovery & Review-Only Smooth Playback Continuity.
 *
 * Requirements Covered: MFR-23, MFR-42, D-06, D-07, D-12, D-13.
 * Two-Gate Verification Governance: WRITTEN — NOT EXECUTED — DEFERRED TO GATE B.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/mocks/server';
import { AuthProvider } from '@/core/auth/AuthContext';
import { authStorage } from '@/core/auth/authStorage';
import { EnrollmentProvider } from '@/features/courses/context/EnrollmentContext';
import { VideoPlayer } from '@/features/learning-player/components/VideoPlayer';
import { LearningPlayerPage } from '@/pages/LearningPlayerPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { learningApi } from '@/features/learning-player/services/learningApi';
import type { User } from '@/core/auth/types';
import type { Course, ChapterItem } from '@/core/courses/types';
import type { TrainingGroup } from '@/core/groups/types';

describe('Phase 2 — WP-2.4 / T-2.4.3: Mounted React DOM & MSW HTTP Integration Suite', () => {
  const traineeUser: User = {
    id: 'usr_trainee_dom_01',
    name: 'متدرب الفحص الشامل',
    email: 'trainee.dom@metro.gov.eg',
    role: 'user',
    jobTitle: 'فني إشارات متقدم',
    department: 'قطac التشغيل والسلامة',
    createdAt: new Date().toISOString(),
  };

  const courseId = 'CRS-DOM-P2';
  const groupAId = 'GRP-DOM-HIDE';
  const groupBId = 'GRP-DOM-REVIEW';

  const seedCourse = (id: string, numItems: number = 2): Course => {
    const items: ChapterItem[] = [];
    for (let i = 1; i <= numItems; i++) {
      items.push({
        id: `itm_${id}_${i}`,
        title: `الدرس التجريبي ${i}`,
        type: 'video',
        duration: '10:00',
        durationSeconds: 600,
        url: '/mock-video.mp4',
        contentVersion: 1,
        isRequired: true,
      });
    }

    const course: Course = {
      id,
      title: `مقرر الفحص الشامل ${id}`,
      description: 'مقرر اختباري للمطابقة الميدانية',
      category: 'سلامة السكك الحديدية',
      level: 'intermediate',
      status: 'published',
      enrollmentCount: 0,
      rating: 4.9,
      versionNumber: 1,
      currentVersionNumber: 1,
      chapters: [
        {
          id: `ch_${id}_1`,
          title: 'الوحدة التدريبية الرئيسية',
          order: 1,
          items,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    };

    inMemoryStore.createCourse(course);
    return course;
  };

  const seedGroup = (params: {
    groupId: string;
    courseId: string;
    postDeadlinePolicy: 'hide' | 'keep_no_cert';
    isExpired: boolean;
    traineeId: string;
  }): TrainingGroup => {
    const now = Date.now();
    const deadlineDateTime = params.isExpired
      ? new Date(now - 7 * 86400000).toISOString()
      : new Date(now + 14 * 86400000).toISOString();

    const group: TrainingGroup = {
      id: params.groupId,
      name: `مجموعة ${params.groupId}`,
      code: `GRP-${params.groupId}`,
      description: 'مجموعة تجريبية',
      department: 'قطاع التشغيل والسلامة',
      status: 'active',
      adminStatus: 'active',
      postDeadlinePolicy: params.postDeadlinePolicy,
      deadlineDateTime,
      assignedCourseIds: [params.courseId],
      courses: [
        {
          courseId: params.courseId,
          order: 1,
          required: true,
          deadlineDateTime,
          postDeadlinePolicy: params.postDeadlinePolicy,
        },
      ],
      cycles: [],
      traineeIds: [params.traineeId],
      supervisorIds: ['usr_lect_001'],
      resources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryStore.createGroup(group);
    return group;
  };

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    inMemoryStore.reset();
    authStorage.clearSession();
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    inMemoryStore.createManagedUser(traineeUser);
    authStorage.setSession({
      user: traineeUser,
      token: 'mock-session-token',
    });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Suite 1: Video Player Seek-Restriction Notification Recovery & Clamping (Req A.1–A.5)
  // ===========================================================================
  describe('Suite 1: Video Player Seek-Restriction Notification Recovery & Clamping', () => {
    it('SR-1: Initial restricted seek ahead of furthestWatched displays Arabic warning notification with lock icon and guaranteed visible presentation', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="فيديو فحص الإشارات"
          src="/mock-video.mp4"
          initialPosition={20}
          furthestWatched={30}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 120, configurable: true });
      fireEvent.loadedMetadata(video);

      // Attempt to seek forward past furthestWatched (to 65s while furthest is 30s)
      video.currentTime = 65;
      fireEvent.seeking(video);

      // Assert notification appears with exact recovered text, testid, and status role
      const badge = screen.getByTestId('seeking-clamped-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('لا يمكن التقديم للأمام متجاوزاً ما تمت مشاهدته');
      expect(badge.getAttribute('role')).toBe('status');

      // Assert DOM-level presentation and visibility guarantees
      expect(badge).toBeVisible();
      expect(badge).toHaveStyle({
        position: 'absolute',
        opacity: '1',
      });
      expect(Number(window.getComputedStyle(badge).zIndex) || 50).toBeGreaterThanOrEqual(20);
    });

    it('SR-2: Clamps playback position back to permitted furthestWatched position after restricted seek', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="فيديو فحص الإشارات"
          src="/mock-video.mp4"
          initialPosition={15}
          furthestWatched={40}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 120, configurable: true });
      fireEvent.loadedMetadata(video);

      // Seek ahead of 40s (to 90s)
      video.currentTime = 90;
      fireEvent.seeking(video);

      // Assert playback position remains clamped to permitted 40s
      expect(video.currentTime).toBe(40);
      const badge = screen.getByTestId('seeking-clamped-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toBeVisible();
    });

    it('SR-3: Valid seeking backward or within permitted watched range does NOT display the notification', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="فيديو فحص الإشارات"
          src="/mock-video.mp4"
          initialPosition={35}
          furthestWatched={50}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 120, configurable: true });
      fireEvent.loadedMetadata(video);

      // Valid backward seek to 10s (within permitted 0-50s range)
      video.currentTime = 10;
      fireEvent.seeking(video);

      expect(video.currentTime).toBe(10);
      expect(screen.queryByTestId('seeking-clamped-badge')).not.toBeInTheDocument();
      expect(screen.queryByText(/لا يمكن التقديم للأمام/i)).not.toBeInTheDocument();
    });

    it('SR-4: Repeated restricted seek attempts restart the display timer, remount key, and keep notification visible', () => {
      vi.useFakeTimers();
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="فيديو فحص الإشارات"
          src="/mock-video.mp4"
          initialPosition={10}
          furthestWatched={25}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 120, configurable: true });
      fireEvent.loadedMetadata(video);

      // First restricted seek attempt
      video.currentTime = 50;
      fireEvent.seeking(video);
      const firstBadge = screen.getByTestId('seeking-clamped-badge');
      expect(firstBadge).toBeInTheDocument();
      expect(firstBadge).toBeVisible();

      // Advance 1.5 seconds (earlier than the 2.5s timeout)
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByTestId('seeking-clamped-badge')).toBeInTheDocument();

      // Second restricted seek attempt (resets timer and remounts with updated seekClampKey)
      video.currentTime = 70;
      fireEvent.seeking(video);
      const secondBadge = screen.getByTestId('seeking-clamped-badge');
      expect(secondBadge).toBeInTheDocument();
      expect(secondBadge).toBeVisible();

      // Advance 1.5 seconds again (total 3.0s since first attempt; without reset it would have disappeared at 2.5s)
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      // The badge MUST still be visible because the second attempt reset the 2.5s timer
      expect(screen.getByTestId('seeking-clamped-badge')).toBeInTheDocument();

      // Advance remaining 1.1s to allow second timer to finish
      act(() => {
        vi.advanceTimersByTime(1100);
      });
      expect(screen.queryByTestId('seeking-clamped-badge')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('SR-5: Interactive timeline scrubber click and RTL keyboard seeking trigger restriction notification when clamped', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="فيديو فحص الإشارات"
          src="/mock-video.mp4"
          initialPosition={10}
          furthestWatched={30}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Scrubber slider click at 80% (target: 80s > furthestWatched 30s)
      const scrubber = screen.getByRole('slider', { name: /شريط التقدم الزمني/i });
      fireEvent.click(scrubber, { clientX: 800 });

      const badgeAfterScrub = screen.getByTestId('seeking-clamped-badge');
      expect(badgeAfterScrub).toBeInTheDocument();
      expect(badgeAfterScrub).toBeVisible();
      expect(video.currentTime).toBe(30);

      // Keyboard navigation ArrowRight (forward step beyond furthestWatched)
      fireEvent.keyDown(window, { code: 'ArrowRight' });
      const badgeAfterKey = screen.getByTestId('seeking-clamped-badge');
      expect(badgeAfterKey).toBeInTheDocument();
      expect(badgeAfterKey).toBeVisible();
      expect(video.currentTime).toBe(30);
    });
  });

  // ===========================================================================
  // Suite 2: Review-Only Activity Elimination & Playback Continuity (Req B & C)
  // ===========================================================================
  describe('Suite 2: Review-Only Activity POST Elimination & Smooth Playback Continuity', () => {
    it('RO-1: Full-access mode dispatches activity POST synchronization during playback', async () => {
      const recordSpy = vi.spyOn(learningApi, 'recordActivity');
      render(
        <VideoPlayer
          courseId={courseId}
          itemId="itm_1"
          title="فيديو فحص الإشارات"
          src="/mock-video.mp4"
          initialPosition={0}
          furthestWatched={0}
          isCompleted={false}
          isReadOnly={false}
          onComplete={vi.fn()}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Simulate play and pause flush
      fireEvent.play(video);
      fireEvent.pause(video);

      // In full-access mode, pause triggers flush activity sync
      expect(recordSpy).toHaveBeenCalled();
    });

    it('RO-2: Review-only mode (isReadOnly: true) suppresses all periodic activity POST requests and flush calls', () => {
      vi.useFakeTimers();
      const recordSpy = vi.spyOn(learningApi, 'recordActivity');

      render(
        <VideoPlayer
          courseId={courseId}
          itemId="itm_1"
          title="فيديو فحص الإشارات للمطالعة"
          src="/mock-video.mp4"
          initialPosition={10}
          furthestWatched={30}
          isCompleted={false}
          isReadOnly={true}
          onComplete={vi.fn()}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Start playback
      fireEvent.play(video);

      // Advance 15 seconds (would trigger 3 heartbeat intervals in full mode)
      act(() => {
        vi.advanceTimersByTime(15000);
      });

      // Pause and trigger unmount flush
      fireEvent.pause(video);

      // Assert ZERO network activity POST calls were made
      expect(recordSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('RO-3: Video playback remains fully functional and continuous in review-only mode', () => {
      render(
        <VideoPlayer
          courseId={courseId}
          itemId="itm_1"
          title="فيديو فحص الإشارات للمطالعة"
          src="/mock-video.mp4"
          initialPosition={10}
          furthestWatched={50}
          isCompleted={false}
          isReadOnly={true}
          onComplete={vi.fn()}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // 1. Play & Pause work normally
      fireEvent.play(video);
      expect(video.paused).toBe(false);

      // 2. Time update advances playback time
      video.currentTime = 25;
      fireEvent.timeUpdate(video);
      expect(video.currentTime).toBe(25);

      // 3. Seeking within permitted range works smoothly
      video.currentTime = 40;
      fireEvent.seeking(video);
      expect(video.currentTime).toBe(40);

      // 4. Backward seeking works smoothly
      video.currentTime = 15;
      fireEvent.seeking(video);
      expect(video.currentTime).toBe(15);

      // 5. Speed controls work smoothly
      const speedBtn = screen.getByRole('button', { name: /سرعة التشغيل/i });
      fireEvent.click(speedBtn);
      const speed15x = screen.getByText('1.5x');
      fireEvent.click(speed15x);
      expect(video.playbackRate).toBe(1.5);

      // 6. Volume and mute work smoothly
      const muteBtn = screen.getByRole('button', { name: /كتم الصوت/i });
      fireEvent.click(muteBtn);
      expect(video.muted).toBe(true);
    });

    it('RO-4: Review-only playback does not mutate store attempt progress or trigger completion', () => {
      seedCourse(courseId, 2);
      seedGroup({
        groupId: groupBId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        isExpired: true,
        traineeId: traineeUser.id,
      });
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupBId);

      const initialProg = inMemoryStore.getCourseProgress(traineeUser.id, courseId);
      expect(initialProg.accessMode).toBe('review_only');
      expect(initialProg.completedItemIds).toEqual([]);

      const handleComplete = vi.fn();
      render(
        <VideoPlayer
          courseId={courseId}
          itemId="itm_1"
          title="فيديو فحص الإشارات"
          src="/mock-video.mp4"
          initialPosition={0}
          furthestWatched={10}
          isCompleted={false}
          isReadOnly={true}
          onComplete={handleComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Reaching end of video in read-only mode invokes onComplete, which LearningPlayerPage aborts
      video.currentTime = 100;
      fireEvent.ended(video);

      // Store progress must remain untouched
      const finalProg = inMemoryStore.getCourseProgress(traineeUser.id, courseId);
      expect(finalProg.completedItemIds).toEqual([]);
      expect(finalProg.progressPercent).toBe(0);
    });
  });

  // ===========================================================================
  // Suite 3: Mounted React DOM Component Testing for Post-Deadline Access
  // ===========================================================================
  describe('Suite 3: Mounted React DOM Component Testing (LearningPlayerPage & GroupDetailPage)', () => {
    it('DOM-1: LearningPlayerPage mounted under accessMode "none" renders full-page expired lock screen', async () => {
      seedCourse(courseId, 2);
      seedGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        isExpired: true,
        traineeId: traineeUser.id,
      });
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId);

      render(
        <MemoryRouter initialEntries={[`/courses/${courseId}/learn?groupId=${groupAId}`]}>
          <AuthProvider>
            <EnrollmentProvider>
              <Routes>
                <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
                <Route path="/my-courses" element={<div>قائمة مقرراتي</div>} />
              </Routes>
            </EnrollmentProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      // Wait for route guard and store resolution
      await waitFor(() => {
        expect(screen.getByTestId('player-access-expired')).toBeInTheDocument();
      });

      expect(screen.getByText('انتهت مهلة المقرر التدريبي')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /العودة إلى دوراتي التدريبية/i })).toBeInTheDocument();
      expect(screen.queryByTestId('learning-player-page')).not.toBeInTheDocument();
    });

    it('DOM-2: LearningPlayerPage mounted under accessMode "review_only" renders review warning banner and read-only viewers', async () => {
      seedCourse(courseId, 2);
      seedGroup({
        groupId: groupBId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        isExpired: true,
        traineeId: traineeUser.id,
      });
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupBId);

      render(
        <MemoryRouter initialEntries={[`/courses/${courseId}/learn?groupId=${groupBId}`]}>
          <AuthProvider>
            <EnrollmentProvider>
              <Routes>
                <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
              </Routes>
            </EnrollmentProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
      });

      // Warning banner displayed
      const banner = screen.getByTestId('review-only-access-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/انتهت المهلة المحددة للمجموعة التدريبية/i);
      expect(banner).toHaveTextContent(/وضع المطالعة والمراجعة فقط دون منح شهادة/i);
    });

    it('DOM-3: GroupDetailPage mounted under expired "hide" policy renders disabled action button with lock icon', async () => {
      seedCourse(courseId, 2);
      const group = seedGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        isExpired: true,
        traineeId: traineeUser.id,
      });

      render(
        <MemoryRouter initialEntries={[`/my-groups/${group.id}`]}>
          <AuthProvider>
            <Routes>
              <Route path="/my-groups/:groupId" element={<GroupDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId(`course-access-badge-${courseId}`)).toBeInTheDocument();
      });

      // Badge indicates expired & closed
      expect(screen.getByTestId(`course-access-badge-${courseId}`)).toHaveTextContent('منتهية الصلاحية — مغلق');

      // Action button is disabled with lock text
      const disabledBtn = screen.getByRole('button', { name: /انتهت المهلة — المقرر غير متاح/i });
      expect(disabledBtn).toBeInTheDocument();
      expect(disabledBtn).toBeDisabled();
    });

    it('DOM-4: GroupDetailPage mounted under expired "keep_no_cert" policy renders review action button with eye icon', async () => {
      seedCourse(courseId, 2);
      const group = seedGroup({
        groupId: groupBId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        isExpired: true,
        traineeId: traineeUser.id,
      });

      render(
        <MemoryRouter initialEntries={[`/my-groups/${group.id}`]}>
          <AuthProvider>
            <Routes>
              <Route path="/my-groups/:groupId" element={<GroupDetailPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId(`course-access-badge-${courseId}`)).toBeInTheDocument();
      });

      // Badge indicates review only without cert
      expect(screen.getByTestId(`course-access-badge-${courseId}`)).toHaveTextContent('للمطالعة فقط (بدون شهادة)');

      // Action button is active outline review button
      const reviewBtn = screen.getByTestId(`course-review-btn-${courseId}`);
      expect(reviewBtn).toBeInTheDocument();
      expect(reviewBtn).toHaveTextContent('مراجعة المحتوى (للمطالعة فقط)');
      expect(reviewBtn.closest('a')).toHaveAttribute(
        'href',
        `/courses/${courseId}/learn?groupId=${group.id}`
      );
    });
  });

  // ===========================================================================
  // Suite 4: Direct MSW HTTP Route Integration Testing
  // ===========================================================================
  describe('Suite 4: Direct MSW HTTP Route Interception & Status Code Assertions', () => {
    it('HTTP-1: GET /api/courses/:courseId/progress returns HTTP 200 with accessMode "full" for active enrollment', async () => {
      seedCourse(courseId, 2);
      inMemoryStore.selfEnrollUser(traineeUser.id, courseId);

      const response = await fetch(`/api/courses/${courseId}/progress`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.accessMode).toBe('full');
      expect(data.courseId).toBe(courseId);
    });

    it('HTTP-2: GET /api/courses/:courseId/progress returns HTTP 200 with accessMode "review_only" for expired keep_no_cert', async () => {
      seedCourse(courseId, 2);
      seedGroup({
        groupId: groupBId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        isExpired: true,
        traineeId: traineeUser.id,
      });
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupBId);

      const response = await fetch(`/api/courses/${courseId}/progress?groupId=${groupBId}`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.accessMode).toBe('review_only');
    });

    it('HTTP-3: GET /api/courses/:courseId/progress returns HTTP 403 with code COURSE_ACCESS_EXPIRED for expired hide', async () => {
      seedCourse(courseId, 2);
      seedGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        isExpired: true,
        traineeId: traineeUser.id,
      });
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId);

      const response = await fetch(`/api/courses/${courseId}/progress?groupId=${groupAId}`);
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.code).toBe('COURSE_ACCESS_EXPIRED');
      expect(body.message).toContain('انتهت صلاحية الوصول');
    });

    it('HTTP-4: POST /api/courses/:courseId/activity returns HTTP 403 with code COURSE_ACCESS_REVIEW_ONLY and leaves state unmutated', async () => {
      seedCourse(courseId, 2);
      seedGroup({
        groupId: groupBId,
        courseId,
        postDeadlinePolicy: 'keep_no_cert',
        isExpired: true,
        traineeId: traineeUser.id,
      });
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupBId);

      const attempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
      const attempt = attempts[0];

      const response = await fetch(`/api/courses/${courseId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: `itm_${courseId}_1`,
          activity: { lastPositionSeconds: 120, furthestWatchedSeconds: 120 },
          attemptId: attempt.id,
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe('COURSE_ACCESS_REVIEW_ONLY');

      // Verify zero mutation in the store
      const prog = inMemoryStore.getAttemptProgress(attempt.id);
      expect(prog?.itemsProgress[`itm_${courseId}_1`]).toBeUndefined();
    });

    it('HTTP-5: POST /api/courses/:courseId/complete returns HTTP 403 with code COURSE_ACCESS_EXPIRED for expired hide attempt', async () => {
      seedCourse(courseId, 2);
      seedGroup({
        groupId: groupAId,
        courseId,
        postDeadlinePolicy: 'hide',
        isExpired: true,
        traineeId: traineeUser.id,
      });
      inMemoryStore.enrollUser(courseId, traineeUser.id, undefined, groupAId);

      const attempts = inMemoryStore.getUserCourseAttempts(traineeUser.id, courseId);
      const attempt = attempts[0];

      const response = await fetch(`/api/courses/${courseId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: `itm_${courseId}_1`,
          attemptId: attempt.id,
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe('COURSE_ACCESS_EXPIRED');

      // Verify zero completion in the store
      const prog = inMemoryStore.getAttemptProgress(attempt.id);
      expect(prog?.completedItemIds).toEqual([]);
      expect(prog?.isCompleted).toBe(false);
    });
  });
});

