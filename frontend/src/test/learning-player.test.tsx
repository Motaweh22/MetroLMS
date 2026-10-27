import { describe, it, expect, beforeEach, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/mocks/server';
import { AuthProvider } from '@/core/auth/AuthContext';
import { authStorage } from '@/core/auth/authStorage';
import { EnrollmentProvider } from '@/features/courses';
import { VideoPlayer } from '@/features/learning-player/components/VideoPlayer';
import { DocumentViewer } from '@/features/learning-player/components/DocumentViewer';
import { CurriculumSidebar } from '@/features/learning-player/components/CurriculumSidebar';
import { CompletionCelebrationModal } from '@/features/learning-player/components/CompletionCelebrationModal';
import { LearningPlayerPage } from '@/pages/LearningPlayerPage';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/mocks/fixtures/mockUsers';
import type { EnrichedChapterItem } from '@/features/learning-player/types';
import type { CourseChapter } from '@/core/courses/types';

describe('Increment 6: Learning Player & Progress Tracking Verification', () => {
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
  });

  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('Custom VideoPlayer Component', () => {
    it('renders custom player controls without native browser controls attribute', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video?.getAttribute('controls')).toBeNull(); // controls={false}
      expect(screen.getByTitle('تشغيل (Space)')).toBeInTheDocument();
      expect(screen.getByLabelText(/كتم الصوت/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/مستوى الصوت/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/سرعة التشغيل/i)).toBeInTheDocument();
      expect(screen.getByLabelText('ملء الشاشة')).toBeInTheDocument();
    });

    it('toggles play and pause state on button click', async () => {
      const onComplete = vi.fn();
      let isPaused = true;
      Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', {
        get() {
          return isPaused;
        },
        configurable: true,
      });

      const playMock = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(async function () {
        isPaused = false;
        return undefined;
      });
      const pauseMock = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
        isPaused = true;
      });

      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          onComplete={onComplete}
        />
      );

      const playBtn = screen.getByTitle('تشغيل (Space)');
      fireEvent.click(playBtn);
      expect(playMock).toHaveBeenCalled();

      // Trigger playing event on video
      const video = document.querySelector('video')!;
      fireEvent.playing(video);

      await waitFor(() => {
        expect(screen.getByTitle('إيقاف مؤقت (Space)')).toBeInTheDocument();
      });

      const pauseBtn = screen.getByTitle('إيقاف مؤقت (Space)');
      fireEvent.click(pauseBtn);
      expect(pauseMock).toHaveBeenCalled();
    });

    it('toggles volume mute and changes volume slider', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          onComplete={onComplete}
        />
      );

      const muteBtn = screen.getByLabelText(/كتم الصوت/i);
      fireEvent.click(muteBtn);

      expect(screen.getByLabelText(/إلغاء كتم الصوت/i)).toBeInTheDocument();

      const slider = screen.getByLabelText(/مستوى الصوت/i);
      fireEvent.change(slider, { target: { value: '0.6' } });
      expect((slider as HTMLInputElement).value).toBe('0.6');
    });

    it('supports playback speed selection (1x, 1.25x, 1.5x, 2x)', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          onComplete={onComplete}
        />
      );

      const speedBtn = screen.getByLabelText(/سرعة التشغيل/i);
      expect(speedBtn).toHaveTextContent('1x');

      fireEvent.click(speedBtn);
      const speed15 = screen.getByRole('menuitem', { name: '1.5x' });
      fireEvent.click(speed15);

      expect(screen.getByLabelText(/سرعة التشغيل/i)).toHaveTextContent('1.5x');
      const video = document.querySelector('video');
      expect(video?.playbackRate).toBe(1.5);
    });

    it('handles Fullscreen mode entry, exit, Escape synchronization, and dynamic labels', async () => {
      const onComplete = vi.fn();

      // Mock Fullscreen API
      const requestFsMock = vi.fn().mockResolvedValue(undefined);
      const exitFsMock = vi.fn().mockResolvedValue(undefined);
      window.HTMLElement.prototype.requestFullscreen = requestFsMock;
      document.exitFullscreen = exitFsMock;

      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          onComplete={onComplete}
        />
      );

      // 1. Initial State: Normal Mode
      const fsBtn = screen.getByLabelText('ملء الشاشة');
      expect(fsBtn).toBeInTheDocument();

      // 2. Click to enter Fullscreen
      fireEvent.click(fsBtn);
      expect(requestFsMock).toHaveBeenCalled();

      // Simulate browser fullscreen change
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.body,
        configurable: true,
        writable: true,
      });
      fireEvent(document, new Event('fullscreenchange'));

      await waitFor(() => {
        expect(screen.getByLabelText('الخروج من ملء الشاشة')).toBeInTheDocument();
      });

      // 3. Click to exit Fullscreen
      const exitBtn = screen.getByLabelText('الخروج من ملء الشاشة');
      fireEvent.click(exitBtn);
      expect(exitFsMock).toHaveBeenCalled();

      // 4. Simulate browser Escape key exiting fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
        writable: true,
      });
      fireEvent(document, new Event('fullscreenchange'));

      await waitFor(() => {
        expect(screen.getByLabelText('ملء الشاشة')).toBeInTheDocument();
      });
    });

    it('gracefully handles rejected Fullscreen API requests without throwing', () => {
      const onComplete = vi.fn();
      window.HTMLElement.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('Permission denied'));

      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          onComplete={onComplete}
        />
      );

      const fsBtn = screen.getByLabelText('ملء الشاشة');
      expect(() => fireEvent.click(fsBtn)).not.toThrow();
    });

    it('enforces forward-seeking restriction: clamps seeks ahead of furthestWatched for incomplete videos', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          initialPosition={20}
          furthestWatched={30}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Attempt to forward seek to 60s (ahead of furthestWatched 30s)
      video.currentTime = 60;
      fireEvent.seeking(video);

      // Clamped back to 30s
      expect(video.currentTime).toBe(30);
      expect(screen.getByText(/لا يمكن التقديم للأمام/i)).toBeInTheDocument();
    });

    it('allows backward seeking to previously watched positions for incomplete videos', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          initialPosition={25}
          furthestWatched={40}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Seek backward to 10s (allowed)
      video.currentTime = 10;
      fireEvent.seeking(video);

      expect(video.currentTime).toBe(10);
      expect(screen.queryByText(/لا يمكن التقديم للأمام/i)).not.toBeInTheDocument();
    });

    it('allows unrestricted forward and backward seeking when video is completed', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          initialPosition={0}
          furthestWatched={50}
          isCompleted={true}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Forward seek to 85s (allowed for completed)
      video.currentTime = 85;
      fireEvent.seeking(video);

      expect(video.currentTime).toBe(85);
      expect(screen.queryByText(/لا يمكن التقديم للأمام/i)).not.toBeInTheDocument();
    });

    it('triggers onComplete when continuous playback exceeds 90% threshold', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          itemId="item_vid_1"
          title="محاضرة السلامة"
          src="/mock-video.mp4"
          initialPosition={85}
          furthestWatched={85}
          isCompleted={false}
          onComplete={onComplete}
        />
      );

      const video = document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 100, configurable: true });
      fireEvent.loadedMetadata(video);

      // Advance to 88s (88% -> <= 90%, no complete)
      video.currentTime = 88;
      fireEvent.timeUpdate(video);
      expect(onComplete).not.toHaveBeenCalled();

      // Advance to 92s (92% -> > 90%, complete!)
      video.currentTime = 92;
      fireEvent.timeUpdate(video);
      expect(onComplete).toHaveBeenCalledWith('item_vid_1');

      // Subsequent timeupdate past 90% does not fire duplicate completion
      video.currentTime = 94;
      fireEvent.timeUpdate(video);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('displays friendly Arabic fallback state when media asset is missing or invalid', () => {
      const onComplete = vi.fn();
      render(
        <VideoPlayer
          title="محاضرة السلامة"
          src="" // empty src
          onComplete={onComplete}
        />
      );

      expect(screen.getByText(/تعذر تحميل ملف الفيديو/i)).toBeInTheDocument();
    });
  });

  describe('DocumentViewer (PDF) Component', () => {
    const mockPdfItem: EnrichedChapterItem = {
      id: 'item_pdf_1',
      chapterId: 'ch_1',
      chapterTitle: 'الفصل الأول',
      globalIndex: 0,
      type: 'pdf',
      title: 'دليل تشغيل الإشارات',
      pages: 14,
      canDownload: true,
      url: '/sample.pdf',
      isCompleted: false,
      isLocked: false,
      isActive: true,
    };

    it('renders PDF title and download button when canDownload is true, without page count badge', () => {
      const onComplete = vi.fn();
      render(<DocumentViewer item={mockPdfItem} onComplete={onComplete} />);

      expect(screen.getByText('دليل تشغيل الإشارات')).toBeInTheDocument();
      // Verified per Increment 8: page count badge is omitted from viewer UI
      expect(screen.queryByText(/صفحة/i)).not.toBeInTheDocument();
      expect(screen.getByTitle(/تحميل المستند/i)).toBeInTheDocument();
    });

    it('hides download button when canDownload is false', () => {
      const onComplete = vi.fn();
      const noDownloadItem = { ...mockPdfItem, canDownload: false };
      render(<DocumentViewer item={noDownloadItem} onComplete={onComplete} />);

      expect(screen.queryByTitle(/تحميل المستند/i)).not.toBeInTheDocument();
    });

    it('enforces 5-second reading timer: button is disabled during first 5 seconds', () => {
      vi.useFakeTimers();
      const onComplete = vi.fn();
      render(<DocumentViewer item={mockPdfItem} onComplete={onComplete} />);

      const completeBtn = screen.getByRole('button', { name: /تحديد كمكتمل/i });
      expect(completeBtn).toBeDisabled();
      expect(screen.getByText(/5 ثوانٍ لتفعيل زر الإكمال/i)).toBeInTheDocument();

      // Advance by 3 seconds -> still disabled
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(completeBtn).toBeDisabled();
      expect(screen.getByText(/2 ثوانٍ لتفعيل زر الإكمال/i)).toBeInTheDocument();

      // Advance by remaining 2 seconds -> becomes enabled
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(completeBtn).toBeEnabled();

      // Timer expiration alone does NOT call onComplete
      expect(onComplete).not.toHaveBeenCalled();

      // Trainee explicitly clicks enabled button
      fireEvent.click(completeBtn);
      expect(onComplete).toHaveBeenCalledWith('item_pdf_1');

      vi.useRealTimers();
    });

    it('displays friendly Arabic error state when document URL is missing or empty', () => {
      const onComplete = vi.fn();
      const emptyUrlItem = { ...mockPdfItem, url: '' };
      render(<DocumentViewer item={emptyUrlItem} onComplete={onComplete} />);

      expect(screen.getByText('المستند غير متوفر حالياً')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /إعادة المحاولة/i })).toBeInTheDocument();
      expect(screen.queryByTitle('دليل تشغيل الإشارات')).not.toBeInTheDocument();
    });

    it('provides retry button that re-triggers document loading attempt', () => {
      const onComplete = vi.fn();
      const emptyUrlItem = { ...mockPdfItem, url: '' };
      render(<DocumentViewer item={emptyUrlItem} onComplete={onComplete} />);

      const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/i });
      expect(retryBtn).toBeInTheDocument();
      expect(() => fireEvent.click(retryBtn)).not.toThrow();
    });
  });

  describe('CurriculumSidebar Component', () => {
    const mockChapters: CourseChapter[] = [
      {
        id: 'ch_01',
        title: 'مقدمة منظومة المترو',
        order: 1,
        items: [
          { id: 'item_01', type: 'video', title: 'نظرة عامة', duration: '10:00' },
          { id: 'item_02', type: 'pdf', title: 'كتيب التعليمات', pages: 8 },
        ],
      },
    ];

    const mockFlatItems: EnrichedChapterItem[] = [
      {
        id: 'item_01',
        chapterId: 'ch_01',
        chapterTitle: 'مقدمة منظومة المترو',
        globalIndex: 0,
        type: 'video',
        title: 'نظرة عامة',
        isCompleted: true,
        isLocked: false,
        isActive: false,
      },
      {
        id: 'item_02',
        chapterId: 'ch_01',
        chapterTitle: 'مقدمة منظومة المترو',
        globalIndex: 1,
        type: 'pdf',
        title: 'كتيب التعليمات',
        isCompleted: false,
        isLocked: false,
        isActive: true,
      },
    ];

    it('renders chapter hierarchy, ratio badge, and lesson items with correct icons', () => {
      const onSelect = vi.fn();
      render(
        <CurriculumSidebar
          chapters={mockChapters}
          flatItems={mockFlatItems}
          currentItemId="item_02"
          onSelectItem={onSelect}
        />
      );

      expect(screen.getByText('مقدمة منظومة المترو')).toBeInTheDocument();
      expect(screen.getByText('1/2 مكتمل')).toBeInTheDocument();
      expect(screen.getByText('نظرة عامة')).toBeInTheDocument();
      expect(screen.getByText('كتيب التعليمات')).toBeInTheDocument();

      fireEvent.click(screen.getByText('نظرة عامة'));
      expect(onSelect).toHaveBeenCalledWith('item_01');
    });
  });

  describe('CompletionCelebrationModal Component', () => {
    it('renders celebration modal with course title and informational certificate notice', () => {
      const onClose = vi.fn();
      render(
        <MemoryRouter>
          <CompletionCelebrationModal
            isOpen={true}
            courseTitle="هندسة التحكم في مسارات المترو"
            onClose={onClose}
          />
        </MemoryRouter>
      );

      expect(screen.getByText(/تهانينا! لقد أتممت الدورة التدريبية بنجاح/i)).toBeInTheDocument();
      expect(screen.getByText('هندسة التحكم في مسارات المترو')).toBeInTheDocument();
      expect(screen.getByText(/إشعار الشهادة:/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /العودة إلى قائمة الدورات/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /مراجعة محتوى الدورة/i })).toBeInTheDocument();
    });
  });

  describe('LearningPlayerPage Integration & Route Guarding', () => {
    it('redirects unauthenticated users to /login', async () => {
      render(
        <MemoryRouter initialEntries={['/courses/CRS001/learn']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>صفحة تسجيل الدخول</div>} />
              <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('صفحة تسجيل الدخول')).toBeInTheDocument();
      });
    });

    it('redirects unenrolled trainees to /courses/:courseId with an informative warning', async () => {
      // Set authenticated trainee session via authStorage
      const traineeSession = {
        user: {
          id: 'usr_trainee_003',
          email: 'trainee@metro.gov.eg',
          name: 'أحمد محمود',
          role: 'user' as const,
          department: 'الصيانة',
          jobTitle: 'فني',
          initials: 'أم',
        },
        token: 'valid-test-token',
        expiresAt: Date.now() + 86400000,
      };
      authStorage.setSession(traineeSession);

      // CRS001 is NOT in trainee's initial enrollments (only CRS002 is)
      render(
        <MemoryRouter initialEntries={['/courses/CRS001/learn']}>
          <AuthProvider>
            <EnrollmentProvider>
              <Routes>
                <Route path="/login" element={<div>صفحة تسجيل الدخول</div>} />
                <Route path="/courses/:courseId" element={<div>صفحة تفاصيل الدورة CRS001</div>} />
                <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
              </Routes>
            </EnrollmentProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('صفحة تفاصيل الدورة CRS001')).toBeInTheDocument();
      });
    });

    it('allows enrolled trainee to access the learning player and loads curriculum', async () => {
      // CRS002 is in trainee's initial enrollments
      const traineeSession = {
        user: {
          id: 'usr_trainee_003',
          email: 'trainee@metro.gov.eg',
          name: 'أحمد محمود',
          role: 'user' as const,
          department: 'الصيانة',
          jobTitle: 'فني',
          initials: 'أم',
        },
        token: 'valid-test-token',
        expiresAt: Date.now() + 86400000,
      };
      authStorage.setSession(traineeSession);

      render(
        <MemoryRouter initialEntries={['/courses/CRS002/learn']}>
          <AuthProvider>
            <EnrollmentProvider>
              <Routes>
                <Route path="/login" element={<div>صفحة تسجيل الدخول</div>} />
                <Route path="/courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
              </Routes>
            </EnrollmentProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
        expect(screen.getByText(/محتوى الدورة/i)).toBeInTheDocument();
      });
    });

    it('allows lecturer to preview course without enrollment and shows preview badge', async () => {
      const lecturerSession = {
        user: {
          id: 'usr_lect_002',
          email: 'lecturer@metro.gov.eg',
          name: 'د. سامي العزازي',
          role: 'lecturer' as const,
          department: 'التدريب',
          jobTitle: 'كبير مهندسين',
          initials: 'سع',
        },
        token: 'mock_jwt_usr_lect_002',
        expiresAt: Date.now() + 86400000,
      };
      authStorage.setSession(lecturerSession);

      render(
        <MemoryRouter initialEntries={['/courses/CRS001/learn']}>
          <AuthProvider>
            <EnrollmentProvider>
              <Routes>
                <Route path="/login" element={<div>صفحة تسجيل الدخول</div>} />
                <Route path="/courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
              </Routes>
            </EnrollmentProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
        expect(screen.getByText('وضع المعاينة')).toBeInTheDocument();
      });
    });

    it('progresses an enrolled trainee through a complete 7-lesson course to 100% idempotently', async () => {
      const traineeSession = {
        user: {
          id: 'usr_trainee_003',
          email: 'trainee@metro.gov.eg',
          name: 'أحمد محمود',
          role: 'user' as const,
          department: 'الصيانة',
          jobTitle: 'فني',
          initials: 'أم',
        },
        token: 'valid-test-token',
        expiresAt: Date.now() + 86400000,
      };
      authStorage.setSession(traineeSession);

      render(
        <MemoryRouter initialEntries={['/courses/CRS002/learn']}>
          <AuthProvider>
            <EnrollmentProvider>
              <Routes>
                <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
                <Route path="/courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
              </Routes>
            </EnrollmentProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
      });

      // Initial progress: 0%
      expect(screen.getByText('0% مكتمل')).toBeInTheDocument();

      // Complete lessons sequentially through store and observe progress updates:
      // Lesson 1: ITEM201 (video)
      act(() => {
        inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM201', userRole: 'user' });
      });
      expect(inMemoryStore.getCourseProgress('usr_trainee_003', 'CRS002').progressPercent).toBe(14);

      // Lesson 2: ITEM202 (pdf)
      act(() => {
        inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM202', userRole: 'user' });
      });
      expect(inMemoryStore.getCourseProgress('usr_trainee_003', 'CRS002').progressPercent).toBe(29);

      // Lesson 3: ITEM203 (video)
      act(() => {
        inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM203', userRole: 'user' });
      });
      expect(inMemoryStore.getCourseProgress('usr_trainee_003', 'CRS002').progressPercent).toBe(43);

      // Lesson 4: ITEM204 (video)
      act(() => {
        inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM204', userRole: 'user' });
      });
      expect(inMemoryStore.getCourseProgress('usr_trainee_003', 'CRS002').progressPercent).toBe(57);

      // Lesson 5: ITEM205 (pdf)
      act(() => {
        inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM205', userRole: 'user' });
      });
      expect(inMemoryStore.getCourseProgress('usr_trainee_003', 'CRS002').progressPercent).toBe(71);

      // Lesson 6: ITEM206 (video)
      act(() => {
        inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM206', userRole: 'user' });
      });
      expect(inMemoryStore.getCourseProgress('usr_trainee_003', 'CRS002').progressPercent).toBe(86);

      // Lesson 7: ITEM207 (pdf) - Final Lesson
      act(() => {
        const res = inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM207', userRole: 'user' });
        expect(res.progress.progressPercent).toBe(100);
        expect(res.progress.isCompleted).toBe(true);
        expect(res.justCompletedCourse).toBe(true);
        expect(res.progress.completedItemIds).toHaveLength(7);
      });

      // Assert that completing an already completed lesson is idempotent
      act(() => {
        const duplicateRes = inMemoryStore.markLessonComplete({ userId: 'usr_trainee_003', courseId: 'CRS002', itemId: 'ITEM207', userRole: 'user' });
        expect(duplicateRes.progress.progressPercent).toBe(100);
        expect(duplicateRes.progress.completedItemIds).toHaveLength(7);
        expect(duplicateRes.justCompletedCourse).toBe(false);
      });
    });

    describe('Sequential Navigation & Completed Lesson Next Button Fix', () => {
      it('disables Next while current lesson is incomplete, and enables Next when completed', async () => {
        const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
        const traineeSession = {
          user: traineeUser,
          token: 'mock_jwt_usr_trainee_003',
          expiresAt: Date.now() + 86400000,
        };
        authStorage.setSession(traineeSession);
        inMemoryStore.enrollUser({ userId: traineeUser.id, courseId: 'CRS001', userRole: 'user' });

        render(
          <MemoryRouter initialEntries={['/courses/CRS001/learn']}>
            <AuthProvider>
              <EnrollmentProvider>
                <Routes>
                  <Route path="/courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                  <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
                  <Route path="/courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
                </Routes>
              </EnrollmentProvider>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
        });

        // 1. Initial State: First lesson (index 0)
        const prevBtn = screen.getByRole('button', { name: /الدرس السابق/i });
        const nextBtn = screen.getByRole('button', { name: /الدرس التالي/i });

        expect(prevBtn).toBeDisabled(); // First lesson has no previous
        expect(nextBtn).toBeDisabled(); // Lesson is incomplete; Next must be disabled
        expect(screen.queryByText('هذا الدرس مكتمل')).not.toBeInTheDocument();

        // 2. Trigger video completion via ended event
        const video = document.querySelector('video')!;
        expect(video).toBeInTheDocument();
        fireEvent.ended(video);

        // 3. Status updates: "هذا الدرس مكتمل" appears and Next button becomes ENABLED
        await waitFor(() => {
          expect(screen.getByText('هذا الدرس مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });

        // 4. Click Next button and verify navigation to lesson 2
        fireEvent.click(screen.getByRole('button', { name: /الدرس التالي/i }));

        await waitFor(() => {
          // On second lesson, Previous button must now be enabled
          expect(screen.getByRole('button', { name: /الدرس السابق/i })).not.toBeDisabled();
        });

        // 5. Click Previous button and verify navigation back to lesson 1
        fireEvent.click(screen.getByRole('button', { name: /الدرس السابق/i }));

        await waitFor(() => {
          // Returning to completed lesson 1: shows completed badge, previous disabled, next enabled
          expect(screen.getByText('هذا الدرس مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس السابق/i })).toBeDisabled();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });
      });

      it('does not unlock Next lesson if completion request fails', async () => {
        const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
        const traineeSession = {
          user: traineeUser,
          token: 'mock_jwt_usr_trainee_003',
          expiresAt: Date.now() + 86400000,
        };
        authStorage.setSession(traineeSession);
        inMemoryStore.enrollUser({ userId: traineeUser.id, courseId: 'CRS001', userRole: 'user' });

        // Mock completion failure
        const { http, HttpResponse } = await import('msw');
        server.use(
          http.post('/api/courses/:courseId/lessons/complete', () => {
            return HttpResponse.json(
              { message: 'فشل في الاتصال بالخادم لحفظ الإكمال' },
              { status: 500 }
            );
          })
        );

        render(
          <MemoryRouter initialEntries={['/courses/CRS001/learn']}>
            <AuthProvider>
              <EnrollmentProvider>
                <Routes>
                  <Route path="/courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                  <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
                  <Route path="/courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
                </Routes>
              </EnrollmentProvider>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
        });

        const nextBtn = screen.getByRole('button', { name: /الدرس التالي/i });
        expect(nextBtn).toBeDisabled();

        // Trigger video ended event
        const video = document.querySelector('video')!;
        fireEvent.ended(video);

        // Next button MUST remain disabled on failure
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).toBeDisabled();
          expect(screen.queryByText('هذا الدرس مكتمل')).not.toBeInTheDocument();
        });
      });

      it('prevents direct URL access to locked lessons and falls back to resume lesson', async () => {
        const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
        const traineeSession = {
          user: traineeUser,
          token: 'mock_jwt_usr_trainee_003',
          expiresAt: Date.now() + 86400000,
        };
        authStorage.setSession(traineeSession);
        inMemoryStore.enrollUser({ userId: traineeUser.id, courseId: 'CRS001', userRole: 'user' });

        // Trainee tries to navigate directly to ITEM004 (locked, since lessons 1-3 are incomplete)
        render(
          <MemoryRouter initialEntries={['/courses/CRS001/learn/ITEM004']}>
            <AuthProvider>
              <EnrollmentProvider>
                <Routes>
                  <Route path="/courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                  <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
                  <Route path="/courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
                </Routes>
              </EnrollmentProvider>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
        });

        // The player must reject ITEM004 and fall back to the first unlocked lesson (ITEM001)
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'مفاهيم السلامة الأساسية' })).toBeInTheDocument();
          expect(screen.getByText('عليك إكمال الدرس السابق أولاً لتتمكن من الوصول إلى هذا المحتوى')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس السابق/i })).toBeDisabled();
        });
      });

      it('Next button remains disabled on the final lesson of the course', async () => {
        const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
        const traineeSession = {
          user: traineeUser,
          token: 'mock_jwt_usr_trainee_003',
          expiresAt: Date.now() + 86400000,
        };
        authStorage.setSession(traineeSession);
        inMemoryStore.enrollUser({ userId: traineeUser.id, courseId: 'CRS001', userRole: 'user' });

        // Pre-complete all items of course CRS001 in inMemoryStore
        inMemoryStore.markLessonComplete({ userId: traineeUser.id, courseId: 'CRS001', itemId: 'ITEM001', userRole: 'user' });
        inMemoryStore.markLessonComplete({ userId: traineeUser.id, courseId: 'CRS001', itemId: 'ITEM002', userRole: 'user' });
        inMemoryStore.markLessonComplete({ userId: traineeUser.id, courseId: 'CRS001', itemId: 'ITEM003', userRole: 'user' });
        inMemoryStore.markLessonComplete({ userId: traineeUser.id, courseId: 'CRS001', itemId: 'ITEM004', userRole: 'user' });
        inMemoryStore.markLessonComplete({ userId: traineeUser.id, courseId: 'CRS001', itemId: 'ITEM005', userRole: 'user' });
        inMemoryStore.markLessonComplete({ userId: traineeUser.id, courseId: 'CRS001', itemId: 'ITEM006', userRole: 'user' });
        inMemoryStore.markLessonComplete({ userId: traineeUser.id, courseId: 'CRS001', itemId: 'ITEM007', userRole: 'user' });

        // Navigate to final lesson (ITEM007)
        render(
          <MemoryRouter initialEntries={['/courses/CRS001/learn/ITEM007']}>
            <AuthProvider>
              <EnrollmentProvider>
                <Routes>
                  <Route path="/courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                  <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
                  <Route path="/courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
                </Routes>
              </EnrollmentProvider>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
        });

        // On the final lesson: Previous is enabled, Next is DISABLED because no subsequent lesson exists
        expect(screen.getByRole('button', { name: /الدرس السابق/i })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: /الدرس التالي/i })).toBeDisabled();
      });

      it('completes an entire course from lesson 1 to final lesson via UI and triggers celebration modal at 100%', async () => {
        const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;
        const traineeSession = {
          user: traineeUser,
          token: 'mock_jwt_usr_trainee_003',
          expiresAt: Date.now() + 86400000,
        };
        authStorage.setSession(traineeSession);
        // Trainee is pre-enrolled in CRS002 (7 items total: 4 videos, 3 PDFs)

        render(
          <MemoryRouter initialEntries={['/courses/CRS002/learn']}>
            <AuthProvider>
              <EnrollmentProvider>
                <Routes>
                  <Route path="/courses/:courseId" element={<div>تفاصيل الدورة</div>} />
                  <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
                  <Route path="/courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
                </Routes>
              </EnrollmentProvider>
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
        });

        // 1. Initial State: Lesson 1 (ITEM201 - Video), 0% progress
        expect(screen.getByText('0% مكتمل')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'مبادئ التواصل الفعال مع الركاب' })).toBeInTheDocument();

        // Complete Lesson 1 (Video) via legitimate playback / ended
        const video1 = document.querySelector('video')!;
        expect(video1).toBeInTheDocument();
        fireEvent.ended(video1);

        // Progress updates to 14% (1/7), Next button enables
        await waitFor(() => {
          expect(screen.getByText('هذا الدرس مكتمل')).toBeInTheDocument();
          expect(screen.getByText('14% مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });

        // Navigate to Lesson 2 (ITEM202 - PDF)
        fireEvent.click(screen.getByRole('button', { name: /الدرس التالي/i }));
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'دليل التعامل مع أنواع الركاب' })).toBeInTheDocument();
        });

        // Advance reading timer on Lesson 2 and complete it
        await waitFor(() => {
          const completeBtn = screen.getByRole('button', { name: /تحديد كمكتمل/i });
          expect(completeBtn).not.toBeDisabled();
        }, { timeout: 7000 });
        fireEvent.click(screen.getByRole('button', { name: /تحديد كمكتمل/i }));

        // Progress updates to 29% (2/7), Next button enables
        await waitFor(() => {
          expect(screen.getByText('29% مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });

        // Lesson 3: ITEM203 (Video)
        fireEvent.click(screen.getByRole('button', { name: /الدرس التالي/i }));
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'فن إدارة الشكاوى' })).toBeInTheDocument();
        });
        fireEvent.ended(document.querySelector('video')!);
        await waitFor(() => {
          expect(screen.getByText('43% مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });

        // Lesson 4: ITEM204 (Video)
        fireEvent.click(screen.getByRole('button', { name: /الدرس التالي/i }));
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'سيناريوهات عملية في المحطات' })).toBeInTheDocument();
        });
        fireEvent.ended(document.querySelector('video')!);
        await waitFor(() => {
          expect(screen.getByText('57% مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });

        // Lesson 5: ITEM205 (PDF)
        fireEvent.click(screen.getByRole('button', { name: /الدرس التالي/i }));
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'نماذج تقارير الشكاوى' })).toBeInTheDocument();
        });
        await waitFor(() => {
          const completeBtn = screen.getByRole('button', { name: /تحديد كمكتمل/i });
          expect(completeBtn).not.toBeDisabled();
        }, { timeout: 7000 });
        fireEvent.click(screen.getByRole('button', { name: /تحديد كمكتمل/i }));
        await waitFor(() => {
          expect(screen.getByText('71% مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });

        // Lesson 6: ITEM206 (Video)
        fireEvent.click(screen.getByRole('button', { name: /الدرس التالي/i }));
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'التعامل مع ذوي الاحتياجات الخاصة' })).toBeInTheDocument();
        });
        fireEvent.ended(document.querySelector('video')!);
        await waitFor(() => {
          expect(screen.getByText('86% مكتمل')).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /الدرس التالي/i })).not.toBeDisabled();
        });

        // Lesson 7: ITEM207 (PDF - Final lesson)
        fireEvent.click(screen.getByRole('button', { name: /الدرس التالي/i }));
        await waitFor(() => {
          expect(screen.getByRole('heading', { level: 1, name: 'بروتوكول خدمة كبار السن والأطفال' })).toBeInTheDocument();
        });
        await waitFor(() => {
          const completeBtn = screen.getByRole('button', { name: /تحديد كمكتمل/i });
          expect(completeBtn).not.toBeDisabled();
        }, { timeout: 7000 });
        fireEvent.click(screen.getByRole('button', { name: /تحديد كمكتمل/i }));

        // Final lesson completion: overall progress reaches 100%!
        await waitFor(() => {
          expect(screen.getByText('100% مكتمل')).toBeInTheDocument();
        });

        // Celebration modal is displayed with course title and informational certificate notice!
        await waitFor(() => {
          expect(screen.getByText(/تهانينا! لقد أتممت الدورة التدريبية بنجاح/i)).toBeInTheDocument();
          const dialog = screen.getByRole('dialog', { name: /تهانينا/i });
          expect(within(dialog).getByText('خدمة العملاء في مترو الأنفاق')).toBeInTheDocument();
          expect(within(dialog).getByText(/إشعار الشهادة:/i)).toBeInTheDocument();
        });
      }, 35000);
    });
  });
});
