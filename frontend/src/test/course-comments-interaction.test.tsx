import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { EnrollmentProvider } from '@/features/courses/context/EnrollmentContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { CourseCommentsSection } from '@/features/comments/components/CourseCommentsSection';
import { ReportCommentModal } from '@/features/comments/components/ReportCommentModal';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { LearningPlayerPage } from '@/pages/LearningPlayerPage';
import { commentsApi } from '@/features/comments/services/commentsApi';
import type { CourseComment } from '@/core/comments/types';

describe('Increment 11 — Phase 5C: Course Discussion UI & Reporting Dialog', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  const setTestSession = (
    role: 'admin' | 'assistant_admin' | 'lecturer' | 'user',
    userId?: string
  ) => {
    const id =
      userId ||
      (role === 'admin'
        ? 'usr_admin_001'
        : role === 'assistant_admin'
        ? 'USR016'
        : role === 'lecturer'
        ? 'USR002' // Default instructor for CRS001 & CRS002
        : 'usr_trainee_003'); // Enrolled in CRS002 by default

    const name =
      role === 'admin'
        ? 'أحمد سامي النجار'
        : role === 'assistant_admin'
        ? 'أمير عادل إبراهيم'
        : role === 'lecturer'
        ? 'م. خالد إبراهيم'
        : 'سارة عبد الله';

    authStorage.setSession({
      token: `token-${id}`,
      user: {
        id,
        name,
        email: `${id.toLowerCase()}@metro.gov.eg`,
        role,
        department: 'مركز التدريب الإداري والتطوير المستمر',
        jobTitle: role === 'user' ? 'متدرب فني' : 'مسؤول',
        initials: name.charAt(0),
      },
      expiresAt: Date.now() + 86400000,
    });
  };

  const renderWithProviders = (ui: React.ReactElement, initialRoute: string = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <AuthProvider>
          <EnrollmentProvider>
            <ToastProvider>{ui}</ToastProvider>
          </EnrollmentProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ── 1. Discussion Rendering ──────────────────────────────────────────
  describe('1. Discussion Rendering', () => {
    it('loads and renders active comments for a course with author information and role badges', async () => {
      setTestSession('admin');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          courseTitle="سلامة العمل والسلوك المهني"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      // Verify comments container appears
      expect(screen.getByTestId('course-comments-section')).toBeInTheDocument();

      // Wait for comments to load
      await waitFor(() => {
        expect(screen.getByText('النقاشات والتعليقات')).toBeInTheDocument();
        expect(screen.getByTestId('comment-card-CMT001')).toBeInTheDocument();
      });

      // Verify comment authors and text
      expect(screen.getByText('أحمد محمود')).toBeInTheDocument();
      expect(screen.getByText('م. خالد إبراهيم')).toBeInTheDocument();
      expect(screen.getByText('سارة علي')).toBeInTheDocument();

      // Verify lecturer badge
      const lecturerCard = screen.getByTestId('comment-card-CMT002');
      expect(within(lecturerCard).getByTestId('comment-role-badge')).toHaveTextContent('محاضر');
    });

    it('renders loading skeleton while comments are being fetched', async () => {
      setTestSession('user');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          courseTitle="سلامة العمل والسلوك المهني"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      expect(screen.getByTestId('course-comments-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('course-comments-loading')).not.toBeInTheDocument();
      });
    });

    it('renders empty state when a course has no comments', async () => {
      setTestSession('user');

      // Create a course with 0 comments
      server.use(
        http.get('/api/courses/:courseId/comments', () => {
          return HttpResponse.json([], { status: 200 });
        })
      );

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS_EMPTY"
          courseTitle="كورس تجريبي بدون تعليقات"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('course-comments-empty')).toBeInTheDocument();
        expect(screen.getByText('لا توجد تعليقات حتى الآن')).toBeInTheDocument();
      });
    });

    it('renders error state with retry action on fetch failure', async () => {
      setTestSession('user');

      let attempt = 0;
      server.use(
        http.get('/api/courses/:courseId/comments', () => {
          attempt++;
          if (attempt === 1) {
            return HttpResponse.json({ message: 'فشل مؤقت في جلب التعليقات' }, { status: 500 });
          }
          return HttpResponse.json([], { status: 200 });
        })
      );

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('course-comments-error')).toBeInTheDocument();
        expect(screen.getByText(/فشل مؤقت في جلب التعليقات/)).toBeInTheDocument();
      });

      // Click retry button
      const retryBtn = screen.getByTestId('retry-comments-button');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('course-comments-error')).not.toBeInTheDocument();
        expect(screen.getByTestId('course-comments-empty')).toBeInTheDocument();
      });
    });

    it('safely renders user text without evaluating HTML markup', async () => {
      setTestSession('user');

      // Add a comment containing potential XSS HTML snippet
      server.use(
        http.get('/api/courses/:courseId/comments', () => {
          const maliciousComment: CourseComment = {
            id: 'CMT_XSS',
            courseId: 'CRS001',
            courseTitle: 'كورس الأمان',
            userId: 'USR_MAL',
            userName: 'مستخدم مشبوه',
            userRole: 'user',
            text: '<img src=x onerror="alert(1)" /> نص عادي مع كود مشبوه',
            createdAt: new Date().toISOString(),
            reported: false,
          };
          return HttpResponse.json([maliciousComment], { status: 200 });
        })
      );

      renderWithProviders(
        <CourseCommentsSection courseId="CRS001" commentsEnabled={true} isEnrolled={true} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT_XSS')).toBeInTheDocument();
      });

      // Assert that no <img> element was inserted into the DOM
      const card = screen.getByTestId('comment-card-CMT_XSS');
      expect(card.querySelector('img')).toBeNull();
      expect(card).toHaveTextContent('<img src=x onerror="alert(1)" /> نص عادي مع كود مشبوه');
    });

    it('integrates into CourseDetailPage without duplicate discussion sections', async () => {
      setTestSession('admin');

      renderWithProviders(
        <Routes>
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        </Routes>,
        '/courses/CRS001'
      );

      await waitFor(() => {
        expect(screen.getByTestId('course-detail-page')).toBeInTheDocument();
      });

      // Verify that exactly ONE course-comments-section is rendered on the page
      const discussionSections = screen.getAllByTestId('course-comments-section');
      expect(discussionSections).toHaveLength(1);
    });

    it('integrates into LearningPlayerPage without duplicate discussion sections', async () => {
      setTestSession('admin');

      renderWithProviders(
        <Routes>
          <Route path="/courses/:courseId/learn" element={<LearningPlayerPage />} />
        </Routes>,
        '/courses/CRS001/learn'
      );

      await waitFor(() => {
        expect(screen.getByTestId('learning-player-page')).toBeInTheDocument();
      });

      // Verify that exactly ONE course-comments-section is rendered in learning player
      const discussionSections = screen.getAllByTestId('course-comments-section');
      expect(discussionSections).toHaveLength(1);
    });
  });

  // ── 2. Comment Submission & Enrollment Rules ──────────────────────────
  describe('2. Comment Submission & Enrollment Rules', () => {
    it('allows an enrolled trainee to submit a valid comment and renders it immediately on success', async () => {
      // usr_trainee_003 is pre-enrolled in CRS002
      setTestSession('user', 'usr_trainee_003');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS002"
          courseTitle="خدمة العملاء في مترو الأنفاق"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-composer-form')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('comment-input');
      const submitBtn = screen.getByTestId('submit-comment-button');

      // Type a new comment
      fireEvent.change(textarea, { target: { value: 'استفسار مهم حول إجراءات التعامل مع شكاوى الركاب' } });
      expect(submitBtn).toBeEnabled();

      // Submit
      fireEvent.click(submitBtn);

      // Verify comment appears in the UI
      await waitFor(() => {
        expect(screen.getByText('استفسار مهم حول إجراءات التعامل مع شكاوى الركاب')).toBeInTheDocument();
      });

      // Verify textarea cleared
      expect(textarea).toHaveValue('');
    });

    it('rejects empty or whitespace-only submissions and shows validation message', async () => {
      setTestSession('user', 'usr_trainee_003');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS002"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-composer-form')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('comment-input');
      const submitBtn = screen.getByTestId('submit-comment-button');

      // Initial state: button disabled
      expect(submitBtn).toBeDisabled();

      // Type only spaces
      fireEvent.change(textarea, { target: { value: '    ' } });
      expect(submitBtn).toBeDisabled();
    });

    it('prevents duplicate submissions while request is in flight', async () => {
      setTestSession('user', 'usr_trainee_003');

      let callCount = 0;
      server.use(
        http.post('/api/courses/:courseId/comments', async () => {
          callCount++;
          // Delay response
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json(
            {
              id: 'CMT_DELAYED',
              courseId: 'CRS002',
              courseTitle: 'خدمة العملاء',
              userId: 'usr_trainee_003',
              userName: 'سارة عبد الله',
              userRole: 'user',
              text: 'رسالة مع تأخير في الرد',
              createdAt: new Date().toISOString(),
              reported: false,
            },
            { status: 201 }
          );
        })
      );

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS002"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-composer-form')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('comment-input');
      const submitBtn = screen.getByTestId('submit-comment-button');

      fireEvent.change(textarea, { target: { value: 'رسالة مع تأخير في الرد' } });
      fireEvent.click(submitBtn);

      // Button is loading and disabled while in-flight
      expect(submitBtn).toBeDisabled();
      expect(screen.getByText('جاري الإرسال...')).toBeInTheDocument();

      // Attempt second click while disabled
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(callCount).toBe(1);
        expect(screen.getByText('رسالة مع تأخير في الرد')).toBeInTheDocument();
      });
    });

    it('displays enrollment-required banner and hides composer for unenrolled trainees', async () => {
      // USR011 is NOT enrolled in CRS003
      setTestSession('user', 'USR011');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS003"
          courseTitle="تشغيل وصيانة القطارات"
          commentsEnabled={true}
          isEnrolled={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('enrollment-required-banner')).toBeInTheDocument();
        expect(screen.getByText('سجّل في الكورس للمشاركة في النقاشات')).toBeInTheDocument();
      });

      // Comment input should NOT be present
      expect(screen.queryByTestId('comment-composer-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('comment-input')).not.toBeInTheDocument();
    });

    it('enforces enrollment at the API layer when an unenrolled user posts directly', async () => {
      // USR011 is NOT enrolled in CRS003
      setTestSession('user', 'USR011');

      await expect(
        commentsApi.createComment('CRS003', 'محاولة إضافة تعليق بدون تسجيل في الكورس')
      ).rejects.toThrow('يجب أن تكون مسجلاً في المقرر للمشاركة في النقاشات');
    });

    it('displays closed discussion banner and disables commenting when commentsEnabled is false', async () => {
      setTestSession('admin');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          courseTitle="سلامة العمل والسلوك المهني"
          commentsEnabled={false}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comments-disabled-banner')).toBeInTheDocument();
        expect(screen.getByText('التعليقات مغلقة على هذا الكورس.')).toBeInTheDocument();
      });

      // Composer should NOT be displayed
      expect(screen.queryByTestId('comment-composer-form')).not.toBeInTheDocument();

      // Existing comments remain visible in read-only mode
      expect(screen.getByTestId('comment-card-CMT001')).toBeInTheDocument();
      expect(screen.getByTestId('comment-card-CMT002')).toBeInTheDocument();
    });

    it('displays meaningful Arabic error message when comment creation fails', async () => {
      setTestSession('user', 'usr_trainee_003');

      server.use(
        http.post('/api/courses/:courseId/comments', () => {
          return HttpResponse.json({ message: 'حدث خطأ في قاعدة البيانات أثناء حفظ التعليق' }, { status: 400 });
        })
      );

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS002"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-composer-form')).toBeInTheDocument();
      });

      const textarea = screen.getByTestId('comment-input');
      fireEvent.change(textarea, { target: { value: 'تعليق سيفشل' } });
      fireEvent.click(screen.getByTestId('submit-comment-button'));

      await waitFor(() => {
        expect(screen.getByTestId('comment-submit-error')).toBeInTheDocument();
        expect(screen.getByText('حدث خطأ في قاعدة البيانات أثناء حفظ التعليق')).toBeInTheDocument();
      });
    });
  });

  // ── 3. Comment Reporting Dialog & Workflow ────────────────────────────
  describe('3. Comment Reporting Dialog & Workflow', () => {
    it('opens reporting modal identifying the target comment with all canonical Arabic report reasons', async () => {
      setTestSession('user', 'usr_trainee_003');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS002"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      // Wait for comments on CRS002
      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT005')).toBeInTheDocument();
      });

      // Click report action on CMT005
      const reportBtn = screen.getByTestId('report-comment-btn-CMT005');
      fireEvent.click(reportBtn);

      // Verify modal is open
      expect(await screen.findByTestId('report-comment-modal')).toBeInTheDocument();
      expect(screen.getByText('الإبلاغ عن تعليق مخالف')).toBeInTheDocument();

      // Verify target comment is identified
      expect(screen.getByTestId('comment-preview')).toHaveTextContent('م. خالد إبراهيم');

      // Verify all 5 canonical Arabic reasons are displayed
      expect(screen.getByText('محتوى غير لائق')).toBeInTheDocument();
      expect(screen.getByText('معلومات خاطئة')).toBeInTheDocument();
      expect(screen.getByText('إزعاج أو تحرش')).toBeInTheDocument();
      expect(screen.getByText('رسائل مزعجة')).toBeInTheDocument();
      expect(screen.getByText('أخرى')).toBeInTheDocument();
    });

    it('requires explanatory notes when "أخرى" reason is selected', async () => {
      setTestSession('user', 'usr_trainee_003');

      const mockComment: CourseComment = {
        id: 'CMT_TEST_OTHER',
        courseId: 'CRS002',
        courseTitle: 'خدمة العملاء',
        userId: 'USR_XYZ',
        userName: 'مستخدم تجريبي',
        userRole: 'user',
        text: 'ملاحظة عامة للمراجعة',
        createdAt: new Date().toISOString(),
        reported: false,
      };

      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderWithProviders(
        <ReportCommentModal
          isOpen={true}
          comment={mockComment}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      );

      // Select 'أخرى'
      const otherRadio = screen.getByTestId('report-reason-radio-other');
      fireEvent.click(otherRadio);

      // Verify notes field is displayed
      expect(screen.getByTestId('report-notes-field')).toBeInTheDocument();

      // Attempt submit without typing notes
      const submitBtn = screen.getByTestId('submit-report-btn');
      fireEvent.click(submitBtn);

      // Validation error displayed
      expect(await screen.findByTestId('report-error-alert')).toHaveTextContent(
        'يرجى توضيح سبب الإبلاغ في حقل الملاحظات'
      );
      expect(handleSuccess).not.toHaveBeenCalled();
    });

    it('successfully submits a report, updates report state to "تم الإبلاغ ✓", and does NOT delete comment', async () => {
      setTestSession('user', 'usr_trainee_003');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS002"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT005')).toBeInTheDocument();
      });

      // Click report on CMT005
      fireEvent.click(screen.getByTestId('report-comment-btn-CMT005'));

      expect(await screen.findByTestId('report-comment-modal')).toBeInTheDocument();

      // Select "معلومات خاطئة"
      fireEvent.click(screen.getByTestId('report-reason-radio-misinformation'));

      // Submit report
      fireEvent.click(screen.getByTestId('submit-report-btn'));

      // Modal closes and button changes to disabled "تم الإبلاغ ✓"
      await waitFor(() => {
        expect(screen.queryByTestId('report-comment-modal')).not.toBeInTheDocument();
        expect(screen.getByTestId('comment-reported-CMT005')).toBeInTheDocument();
        expect(screen.getByTestId('comment-reported-CMT005')).toHaveTextContent('تم الإبلاغ ✓');
        expect(screen.getByTestId('comment-reported-CMT005')).toBeDisabled();
      });

      // Verify comment remains in the list and is NOT deleted or hidden
      expect(screen.getByTestId('comment-card-CMT005')).toBeInTheDocument();
      expect(screen.getByText('م. خالد إبراهيم')).toBeInTheDocument();

      // Verify report now appears in the authoritative in-memory store / admin queue
      const reportedQueue = inMemoryStore.getReportedComments({ id: 'usr_admin_001', role: 'admin' });
      expect(reportedQueue.some((c) => c.id === 'CMT005')).toBe(true);
    });

    it('does not display report action when discussion is closed', async () => {
      setTestSession('user', 'usr_trainee_003');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          commentsEnabled={false}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comments-disabled-banner')).toBeInTheDocument();
      });

      // Report button should not exist on comment cards in closed discussions
      expect(screen.queryByTestId('report-comment-btn-CMT001')).not.toBeInTheDocument();
      expect(screen.queryByTestId('report-comment-btn-CMT002')).not.toBeInTheDocument();
    });

    it('handles duplicate report attempts cleanly without corrupting state', async () => {
      setTestSession('user', 'usr_trainee_003');

      // CMT005 was already reported above in the store
      inMemoryStore.reportComment(
        'CMT002',
        { reason: 'harassment' },
        { id: 'usr_trainee_003', role: 'user', name: 'سارة عبد الله' }
      );

      // Attempting to report again via API returns 400
      await expect(
        commentsApi.reportComment('CMT002', 'harassment')
      ).rejects.toThrow('لقد قمت بالإبلاغ عن هذا التعليق مسبقاً');
    });
  });

  // ── 4. Role & Resource Authorization ──────────────────────────────────
  describe('4. Role & Resource Authorization', () => {
    it('trainee cannot delete comments or ignore reports', async () => {
      setTestSession('user', 'usr_trainee_003');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS002"
          commentsEnabled={true}
          isEnrolled={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT005')).toBeInTheDocument();
      });

      // No delete buttons visible to trainee
      expect(screen.queryByTestId('delete-comment-btn-CMT005')).not.toBeInTheDocument();

      // Direct API deletion must be rejected with 403
      await expect(
        commentsApi.deleteCourseComment('CRS002', 'CMT005')
      ).rejects.toThrow();
    });

    it('lecturer can delete a comment in a course they instruct (course-scoped)', async () => {
      // USR002 is the assigned lecturer for CRS001
      setTestSession('lecturer', 'USR002');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          commentsEnabled={true}
          isEnrolled={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT002')).toBeInTheDocument();
      });

      // Lecturer sees delete button
      const deleteBtn = screen.getByTestId('delete-comment-btn-CMT002');
      fireEvent.click(deleteBtn);

      // Confirm dialog appears
      expect(await screen.findByTestId('delete-comment-confirm-dialog')).toBeInTheDocument();

      // Confirm deletion
      fireEvent.click(screen.getByTestId('confirm-delete-comment-button'));

      // Comment is removed
      await waitFor(() => {
        expect(screen.queryByTestId('comment-card-CMT002')).not.toBeInTheDocument();
      });

      // Verify store updated
      expect(inMemoryStore.getCommentById('CMT002')).toBeUndefined();
    });

    it('lecturer cannot delete a comment belonging to an unrelated course', async () => {
      // Create a lecturer session who does NOT instruct CRS001
      setTestSession('lecturer', 'usr_unrelated_lecturer');

      // Attempting course-scoped deletion on CRS001 must return 403
      await expect(
        commentsApi.deleteCourseComment('CRS001', 'CMT001')
      ).rejects.toThrow(/غير مصرح/);
    });

    it('assistant administrator triggers dual-control approval request for comment deletion', async () => {
      setTestSession('assistant_admin', 'USR016');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          commentsEnabled={true}
          isEnrolled={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT002')).toBeInTheDocument();
      });

      // Assistant admin clicks delete
      fireEvent.click(screen.getByTestId('delete-comment-btn-CMT002'));
      fireEvent.click(await screen.findByTestId('confirm-delete-comment-button'));

      // Comment remains in the store and pending approval request is created
      await waitFor(() => {
        expect(inMemoryStore.getCommentById('CMT002')).toBeDefined();
      });

      const pendingRequests = inMemoryStore.getApprovalRequests().filter((r) => r.status === 'pending');
      expect(pendingRequests.some((r) => r.actionType === 'comments.delete' && r.targetResourceId === 'CMT002')).toBe(true);
    });

    it('system administrator can delete comment directly', async () => {
      setTestSession('admin', 'usr_admin_001');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          commentsEnabled={true}
          isEnrolled={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT001')).toBeInTheDocument();
      });

      // System Administrator uses direct moderation dashboard/delete tools, not ordinary reporting
      expect(screen.queryByTestId('report-comment-btn-CMT001')).not.toBeInTheDocument();
      await expect(commentsApi.reportComment('CMT002', 'spam')).rejects.toThrow(/غير مصرح/);

      fireEvent.click(screen.getByTestId('delete-comment-btn-CMT001'));
      fireEvent.click(await screen.findByTestId('confirm-delete-comment-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('comment-card-CMT001')).not.toBeInTheDocument();
      });

      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();
    });

    it('assistant administrator cannot post comments or report comments (UI hidden & direct API rejected with 403)', async () => {
      setTestSession('assistant_admin', 'USR016');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          courseTitle="سلامة العمل والسلوك المهني"
          commentsEnabled={true}
          isEnrolled={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT001')).toBeInTheDocument();
      });

      // Comment composer must not be rendered for assistant admin
      expect(screen.queryByTestId('comment-composer-form')).not.toBeInTheDocument();

      // Report action button must not be rendered for assistant admin
      expect(screen.queryByTestId('report-comment-btn-CMT001')).not.toBeInTheDocument();

      // Direct API attempts must be rejected with 403
      await expect(
        commentsApi.createComment('CRS001', 'محاولة نشر تعليق من مدير مساعد')
      ).rejects.toThrow(/غير مصرح/);

      await expect(
        commentsApi.reportComment('CMT002', 'spam')
      ).rejects.toThrow(/غير مصرح/);
    });

    it('lecturer can post comments and report comments in instructed courses, but is blocked in unrelated courses', async () => {
      // 1. Authorized instructor on CRS001
      setTestSession('lecturer', 'USR002');

      const { unmount } = renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          courseTitle="سلامة العمل والسلوك المهني"
          commentsEnabled={true}
          courseLecturerId="USR002"
          isInstructor={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-composer-form')).toBeInTheDocument();
        expect(screen.getByTestId('comment-card-CMT003')).toBeInTheDocument();
      });

      // Assigned instructor sees composer and can report comment in their course
      expect(screen.getByTestId('report-comment-btn-CMT003')).toBeInTheDocument();

      unmount();

      // 2. Unrelated lecturer on CRS001
      setTestSession('lecturer', 'usr_unrelated_lecturer');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS001"
          courseTitle="سلامة العمل والسلوك المهني"
          commentsEnabled={true}
          courseLecturerId="USR002"
          isInstructor={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT001')).toBeInTheDocument();
      });

      // Unrelated lecturer cannot see composer or report button
      expect(screen.queryByTestId('comment-composer-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('report-comment-btn-CMT001')).not.toBeInTheDocument();

      // Direct API attempts on unrelated courses must reject with 403
      await expect(
        commentsApi.createComment('CRS001', 'محاولة نشر تعليق في كورس غير مسند')
      ).rejects.toThrow(/غير مصرح/);

      await expect(
        commentsApi.reportComment('CMT003', 'misinformation')
      ).rejects.toThrow(/غير مصرح/);
    });

    it('unenrolled trainee cannot report comments via API or UI', async () => {
      // USR011 is a trainee who is NOT enrolled in CRS003
      setTestSession('user', 'USR011');

      renderWithProviders(
        <CourseCommentsSection
          courseId="CRS003"
          courseTitle="تشغيل وصيانة القطارات"
          commentsEnabled={true}
          isEnrolled={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('comment-card-CMT006')).toBeInTheDocument();
      });

      // Report button hidden for unenrolled user
      expect(screen.queryByTestId('report-comment-btn-CMT006')).not.toBeInTheDocument();

      // Direct API report call rejected with 403
      await expect(
        commentsApi.reportComment('CMT006', 'inappropriate_content')
      ).rejects.toThrow('يجب أن تكون مسجلاً في المقرر للإبلاغ عن التعليقات');
    });
  });
});
