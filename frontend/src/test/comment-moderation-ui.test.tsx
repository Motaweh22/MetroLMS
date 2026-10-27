import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { ApprovalRequestsTable } from '@/features/permissions/components/ApprovalRequestsTable';

describe('Increment 11 — Phase 5B: Administrative Comment Moderation UI & Workflows', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  const setTestSession = (role: 'admin' | 'assistant_admin' | 'lecturer' | 'user', userId?: string) => {
    const id =
      userId ||
      (role === 'admin'
        ? 'usr_admin_001'
        : role === 'assistant_admin'
        ? 'USR016'
        : role === 'lecturer'
        ? 'usr_lect_002'
        : 'usr_trainee_003');

    authStorage.setSession({
      token: `token-${id}`,
      user: {
        id,
        name:
          role === 'admin'
            ? 'أحمد سامي النجار'
            : role === 'assistant_admin'
            ? 'أمير عادل إبراهيم'
            : role === 'lecturer'
            ? 'طارق فتحي عبد الرحمن'
            : 'سارة عبد الله',
        email: `${id.toLowerCase()}@metro.gov.eg`,
        role,
        department: 'مركز التدريب الإداري والتطوير المستمر',
        jobTitle: 'موظف',
        initials: 'م',
      },
      expiresAt: Date.now() + 86400000,
    });
  };

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ── 1. Page Access & Route Protection ────────────────────────────────
  describe('1. Page Access & Route Protection', () => {
    it('renders the comment moderation page for authorized System Administrator (admin)', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      expect(await screen.findByTestId('comment-moderation-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: /إدارة ومراقبة التعليقات/i })).toBeInTheDocument();
      expect(screen.getByTestId('kpi-total-comments')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-reported-comments')).toBeInTheDocument();
      expect(screen.getByTestId('tab-reported-comments')).toBeInTheDocument();
      expect(screen.getByTestId('tab-all-comments')).toBeInTheDocument();
    });

    it('renders the comment moderation page for authorized Assistant Administrator (assistant_admin)', async () => {
      setTestSession('assistant_admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      expect(await screen.findByTestId('comment-moderation-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: /إدارة ومراقبة التعليقات/i })).toBeInTheDocument();
    });

    it('denies access to Lecturer (lecturer) and redirects or shows 403', async () => {
      setTestSession('lecturer');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await waitFor(() => {
        expect(screen.queryByTestId('comment-moderation-page')).not.toBeInTheDocument();
      });
    });

    it('denies access to Trainee (user) and redirects or shows 403', async () => {
      setTestSession('user');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await waitFor(() => {
        expect(screen.queryByTestId('comment-moderation-page')).not.toBeInTheDocument();
      });
    });
  });

  // ── 2. KPI Summary Metrics Cards ─────────────────────────────────────
  describe('2. KPI Summary Metrics Cards', () => {
    it('displays verified KPI counters loaded from the mock store', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');

      const kpiTotal = await screen.findByTestId('kpi-total-comments');
      const kpiReported = await screen.findByTestId('kpi-reported-comments');
      const kpiActiveCourses = await screen.findByTestId('kpi-active-courses');
      const kpiDisabledCourses = await screen.findByTestId('kpi-disabled-courses');

      // Canonical initial fixtures: 6 total comments, 2 reported comments
      expect(kpiTotal).toHaveTextContent('6');
      expect(kpiReported).toHaveTextContent('2');
      expect(Number(kpiActiveCourses.textContent)).toBeGreaterThan(0);
      expect(kpiDisabledCourses).toHaveTextContent('0');
    });
  });

  // ── 3. Tab 1: Reported Comments Queue ────────────────────────────────
  describe('3. Tab 1: Reported Comments Queue', () => {
    it('displays initial reported comment cards with course title, author, reason badge, and reporter', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      const reportedQueue = await screen.findByTestId('reported-comments-queue');
      expect(reportedQueue).toBeInTheDocument();

      // Card for CMT001 (reported for inappropriate_content)
      const cmt1Card = screen.getByTestId('reported-comment-card-CMT001');
      expect(cmt1Card).toBeInTheDocument();
      expect(within(cmt1Card).getByText(/محتوى غير لائق/i)).toBeInTheDocument();
      expect(within(cmt1Card).getByTestId('comment-author-name')).toHaveTextContent('أحمد محمود');
      expect(within(cmt1Card).getByTestId('reporter-info')).toHaveTextContent('سارة علي');

      // Card for CMT004 (reported for misinformation)
      const cmt4Card = screen.getByTestId('reported-comment-card-CMT004');
      expect(cmt4Card).toBeInTheDocument();
      expect(within(cmt4Card).getByText(/معلومات خاطئة/i)).toBeInTheDocument();
    });

    it('allows System Administrator to ignore a report, clearing report metadata and removing it from queue', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('reported-comments-queue');
      expect(screen.getByTestId('reported-comment-card-CMT001')).toBeInTheDocument();

      // Click "تجاهل البلاغ" for CMT001
      const ignoreBtn = screen.getByTestId('ignore-report-btn-CMT001');
      fireEvent.click(ignoreBtn);

      // Card should be removed from the reported queue
      await waitFor(() => {
        expect(screen.queryByTestId('reported-comment-card-CMT001')).not.toBeInTheDocument();
      });

      // KPI reported count should decrement from 2 to 1
      await waitFor(() => {
        expect(screen.getByTestId('kpi-reported-comments')).toHaveTextContent('1');
      });

      // Verify the comment is preserved in store with reported === false
      const commentInStore = inMemoryStore.getCommentById('CMT001');
      expect(commentInStore).toBeDefined();
      expect(commentInStore?.reported).toBe(false);
      expect(commentInStore?.reportReason).toBeNull();
    });

    it('renders empty state when all reported comments are cleared', async () => {
      setTestSession('admin');
      // Clear reports on CMT001 and CMT004 in store before render
      inMemoryStore.ignoreCommentReport('CMT001', { id: 'usr_admin_001', role: 'admin' });
      inMemoryStore.ignoreCommentReport('CMT004', { id: 'usr_admin_001', role: 'admin' });

      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      expect(await screen.findByTestId('reported-queue-empty')).toBeInTheDocument();
      expect(screen.getByText(/لا توجد تعليقات مُبلَّغ عنها حالياً/i)).toBeInTheDocument();
    });

    it('opens confirmation dialog when clicking permanent deletion and deletes comment on confirm (admin)', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('reported-comments-queue');
      const deleteBtn = screen.getByTestId('delete-comment-btn-CMT001');
      fireEvent.click(deleteBtn);

      // Confirmation dialog opens
      expect(await screen.findByTestId('confirm-delete-comment-dialog')).toBeInTheDocument();
      expect(screen.getByText(/تأكيد حذف التعليق نهائياً/i)).toBeInTheDocument();

      // Click confirm delete
      const confirmActionBtn = screen.getByTestId('confirm-delete-action-btn');
      fireEvent.click(confirmActionBtn);

      // Modal closes and comment is removed from DOM and store
      await waitFor(() => {
        expect(screen.queryByTestId('confirm-delete-comment-dialog')).not.toBeInTheDocument();
        expect(screen.queryByTestId('reported-comment-card-CMT001')).not.toBeInTheDocument();
      });

      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();
      expect(screen.getByTestId('kpi-total-comments')).toHaveTextContent('5');
    });

    it('cancels deletion when clicking cancel in confirmation dialog', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('reported-comments-queue');
      fireEvent.click(screen.getByTestId('delete-comment-btn-CMT001'));

      expect(await screen.findByTestId('confirm-delete-comment-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cancel-delete-action-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-delete-comment-dialog')).not.toBeInTheDocument();
      });

      // Comment is still present
      expect(screen.getByTestId('reported-comment-card-CMT001')).toBeInTheDocument();
      expect(inMemoryStore.getCommentById('CMT001')).toBeDefined();
    });
  });

  // ── 4. Dual-Control Approval Governance & Assistant Administrator ────
  describe('4. Dual-Control Approval Governance & Assistant Administrator', () => {
    it('intercepts Assistant Administrator deletion without delegation: returns 202 and keeps comment visible', async () => {
      setTestSession('assistant_admin', 'USR016');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('reported-comments-queue');
      fireEvent.click(screen.getByTestId('delete-comment-btn-CMT001'));

      // Confirm dialog warns assistant admin
      expect(await screen.findByTestId('confirm-delete-comment-dialog')).toBeInTheDocument();
      expect(screen.getByText(/سيتطلب هذا الإجراء اعتماد مدير النظام الرئيسي/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('confirm-delete-action-btn'));

      // Pending approval banner appears
      expect(await screen.findByTestId('pending-approval-notice-banner')).toBeInTheDocument();
      expect(screen.getByText(/طلب اعتماد قيد المراجعة/i)).toBeInTheDocument();

      // Comment MUST still remain in the DOM (not deleted)
      expect(screen.getByTestId('reported-comment-card-CMT001')).toBeInTheDocument();
      expect(inMemoryStore.getCommentById('CMT001')).toBeDefined();

      // Approval request exists in store
      const pendingReqs = inMemoryStore.getApprovalRequests().filter((r) => r.actionType === 'comments.delete');
      expect(pendingReqs.length).toBeGreaterThan(0);
      expect(pendingReqs[0].status).toBe('pending');
      expect(pendingReqs[0].targetId).toBe('CMT001');
    });

    it('allows Assistant Administrator with active delegation to delete directly', async () => {
      setTestSession('assistant_admin', 'USR016');
      // Activate delegation
      inMemoryStore.setDelegatedAuthority('USR016', true);

      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('reported-comments-queue');
      fireEvent.click(screen.getByTestId('delete-comment-btn-CMT001'));

      expect(await screen.findByTestId('confirm-delete-comment-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('confirm-delete-action-btn'));

      // Deletes directly
      await waitFor(() => {
        expect(screen.queryByTestId('reported-comment-card-CMT001')).not.toBeInTheDocument();
      });

      expect(inMemoryStore.getCommentById('CMT001')).toBeUndefined();
    });

    it('allows Assistant Administrator to ignore reports directly without approval', async () => {
      setTestSession('assistant_admin', 'USR016');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('reported-comments-queue');
      fireEvent.click(screen.getByTestId('ignore-report-btn-CMT004'));

      // Clears report directly
      await waitFor(() => {
        expect(screen.queryByTestId('reported-comment-card-CMT004')).not.toBeInTheDocument();
      });

      expect(inMemoryStore.getCommentById('CMT004')?.reported).toBe(false);
    });
  });

  // ── 5. Tab 2: All Comments Directory & Search ────────────────────────
  describe('5. Tab 2: All Comments Directory & Search', () => {
    it('switches to All Comments tab and displays table of comments', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');
      const allTab = screen.getByTestId('tab-all-comments');
      fireEvent.click(allTab);

      expect(await screen.findByTestId('all-comments-directory')).toBeInTheDocument();
      expect(screen.getByTestId('all-comments-table')).toBeInTheDocument();

      // Check rows exist
      expect(screen.getByTestId('comment-row-CMT001')).toBeInTheDocument();
      expect(screen.getByTestId('comment-row-CMT002')).toBeInTheDocument();
      expect(screen.getByTestId('comment-row-CMT003')).toBeInTheDocument();
    });

    it('filters comments table via live search input', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');
      fireEvent.click(screen.getByTestId('tab-all-comments'));

      await screen.findByTestId('all-comments-directory');
      const searchInput = screen.getByTestId('comments-search-input');

      // Search for "تدابير الطوارئ" (unique to CMT002)
      fireEvent.change(searchInput, { target: { value: 'تدابير الطوارئ' } });

      await waitFor(() => {
        expect(screen.getByTestId('comment-row-CMT002')).toBeInTheDocument();
        expect(screen.queryByTestId('comment-row-CMT001')).not.toBeInTheDocument();
        expect(screen.queryByTestId('comment-row-CMT003')).not.toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      await waitFor(() => {
        expect(screen.getByTestId('comment-row-CMT001')).toBeInTheDocument();
        expect(screen.getByTestId('comment-row-CMT002')).toBeInTheDocument();
      });
    });

    it('filters comments table by course select dropdown', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');
      fireEvent.click(screen.getByTestId('tab-all-comments'));

      await screen.findByTestId('all-comments-directory');
      const courseSelect = screen.getByTestId('course-filter-select');

      // Filter by CRS002
      fireEvent.change(courseSelect, { target: { value: 'CRS002' } });

      await waitFor(() => {
        expect(screen.getByTestId('comment-row-CMT004')).toBeInTheDocument();
        expect(screen.getByTestId('comment-row-CMT005')).toBeInTheDocument();
        expect(screen.queryByTestId('comment-row-CMT001')).not.toBeInTheDocument();
      });
    });

    it('displays empty state when no comments match search query', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');
      fireEvent.click(screen.getByTestId('tab-all-comments'));

      await screen.findByTestId('all-comments-directory');
      const searchInput = screen.getByTestId('comments-search-input');
      fireEvent.change(searchInput, { target: { value: 'نص_غير_موجود_إطلاقاً_999' } });

      expect(await screen.findByTestId('all-comments-empty')).toBeInTheDocument();
    });

    it('allows deleting comments from All Comments table', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');
      fireEvent.click(screen.getByTestId('tab-all-comments'));

      await screen.findByTestId('all-comments-directory');
      fireEvent.click(screen.getByTestId('delete-comment-table-btn-CMT003'));

      expect(await screen.findByTestId('confirm-delete-comment-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('confirm-delete-action-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('comment-row-CMT003')).not.toBeInTheDocument();
      });

      expect(inMemoryStore.getCommentById('CMT003')).toBeUndefined();
    });
  });

  // ── 6. Course Discussion Policy Toggle ────────────────────────────────
  describe('6. Course Discussion Policy Toggle', () => {
    it('displays current commentsEnabled status on courses and allows admin to toggle discussion', async () => {
      setTestSession('admin');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');
      fireEvent.click(screen.getByTestId('tab-all-comments'));

      await screen.findByTestId('all-comments-directory');
      const toggleButtons = screen.getAllByTestId('toggle-comments-btn-CRS001');
      expect(toggleButtons[0]).toHaveTextContent('التعليقات مفعّلة');

      // Click to toggle
      fireEvent.click(toggleButtons[0]);

      // Confirm dialog appears
      expect(await screen.findByTestId('confirm-toggle-comments-dialog')).toBeInTheDocument();
      expect(screen.getByText(/تأكيد إغلاق النقاشات للمقرر/i)).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('confirm-toggle-action-btn'));

      // State is toggled
      await waitFor(() => {
        expect(screen.getAllByTestId('toggle-comments-btn-CRS001')[0]).toHaveTextContent('التعليقات مغلقة');
      });

      // Verify in store
      const course = inMemoryStore.getCourseById('CRS001');
      expect(course?.commentsEnabled).toBe(false);
      expect(screen.getByTestId('kpi-disabled-courses')).toHaveTextContent('1');
    });

    it('intercepts Assistant Administrator toggle without delegation: returns 202 and preserves setting', async () => {
      setTestSession('assistant_admin', 'USR016');
      render(<AppRouter initialEntries={['/admin/comment-moderation']} />);

      await screen.findByTestId('comment-moderation-page');
      fireEvent.click(screen.getByTestId('tab-all-comments'));

      await screen.findByTestId('all-comments-directory');
      const toggleButtons = screen.getAllByTestId('toggle-comments-btn-CRS001');
      fireEvent.click(toggleButtons[0]);

      expect(await screen.findByTestId('confirm-toggle-comments-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('confirm-toggle-action-btn'));

      // Pending approval banner appears
      expect(await screen.findByTestId('pending-approval-notice-banner')).toBeInTheDocument();

      // Setting MUST remain unchanged in store
      const course = inMemoryStore.getCourseById('CRS001');
      expect(course?.commentsEnabled).toBe(true);
    });
  });

  // ── 7. Approval Requests Table Integration ───────────────────────────
  describe('7. Approval Requests Table Integration', () => {
    it('displays comments.delete approval requests with Arabic action label and target resource info in ApprovalRequestsTable', async () => {
      setTestSession('admin');
      // Create a pending comment deletion request
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'comments.delete',
        titleAr: 'طلب حذف تعليق في مقرر إشارات السكة الحديد',
        targetId: 'CMT001',
        targetResourceId: 'CMT001',
        targetResourceName: 'محتوى تعليق غير لائق...',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        requesterName: 'أمير عادل إبراهيم',
        requesterRole: 'assistant_admin',
        justification: 'تعليق مخالف للائحة النقاشات',
        payload: { commentId: 'CMT001', courseId: 'CRS001' },
      });

      const onReload = async () => {};
      render(<ApprovalRequestsTable requests={[req]} onReload={onReload} />);

      expect(screen.getByTestId('approval-requests-table')).toBeInTheDocument();
      expect(screen.getByText('حذف تعليق نهائياً')).toBeInTheDocument();
      expect(screen.getByText('محتوى تعليق غير لائق...')).toBeInTheDocument();
      expect(screen.getByText('CMT001')).toBeInTheDocument();
      expect(screen.getByText('تعليق مخالف للائحة النقاشات')).toBeInTheDocument();
    });
  });
});
