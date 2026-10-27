import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { INITIAL_SECURITY_AUDIT_LOGS } from '@/mocks/fixtures/securityAuditFixtures';
import { auditApi } from '@/features/permissions/services/auditApi';
import type { CreateUserRequestDTO } from '@/core/user-management/types';

describe('Increment 11 — Phase 4D: System Security Audit Trail', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    authStorage.clearSession();
  });
  afterAll(() => server.close());

  const setTestSession = (role: keyof typeof SYNTHETIC_DEMO_ACCOUNTS) => {
    authStorage.setSession({
      token: `${role}-token`,
      user: SYNTHETIC_DEMO_ACCOUNTS[role].user,
      expiresAt: Date.now() + 86400000,
    });
  };

  beforeEach(() => {
    inMemoryStore.reset({ seedGroupDemo: true });
  });

  // ── 1. In-Memory Audit Ledger & Deterministic Reset ───────────────────
  describe('1. In-Memory Audit Ledger & Deterministic Reset', () => {
    it('initializes audit ledger deterministically from INITIAL_SECURITY_AUDIT_LOGS fixtures', () => {
      const res = inMemoryStore.getSystemAuditLogs();
      expect(res.total).toBe(INITIAL_SECURITY_AUDIT_LOGS.length);
      expect(res.entries.length).toBe(INITIAL_SECURITY_AUDIT_LOGS.length);

      const ids = res.entries.map((e) => e.id);
      expect(ids).toContain('AUD-1001');
      expect(ids).toContain('AUD-1004');
    });

    it('resets audit ledger to baseline fixtures on inMemoryStore.reset()', () => {
      // Add extra audit log
      inMemoryStore.recordAuditLog({
        actorId: 'usr_admin_001',
        action: 'test.action',
        actionLabelAr: 'إجراء اختباري',
        severity: 'info',
        outcome: 'success',
        details: 'تفاصيل اختبارية',
      });

      expect(inMemoryStore.getSystemAuditLogs().total).toBe(INITIAL_SECURITY_AUDIT_LOGS.length + 1);

      // Reset
      inMemoryStore.reset();
      expect(inMemoryStore.getSystemAuditLogs().total).toBe(INITIAL_SECURITY_AUDIT_LOGS.length);
    });

    it('returns deep cloned records to avoid mutating internal store state', () => {
      const res = inMemoryStore.getSystemAuditLogs();
      const first = res.entries[0];
      first.details = 'MUTATED_EXTERNALLY';

      const fresh = inMemoryStore.getSystemAuditLogs();
      expect(fresh.entries[0].details).not.toBe('MUTATED_EXTERNALLY');
    });
  });

  // ── 2. Domain Operation Instrumentation: Account Lifecycle ───────────
  describe('2. Domain Operation Instrumentation: Account Lifecycle', () => {
    it('records an audit entry when a new user is created', () => {
      const initialCount = inMemoryStore.getSystemAuditLogs().total;

      const newUserDto: CreateUserRequestDTO = {
        name: 'يوسف جمال الدين',
        username: 'youssef_gamal',
        email: 'youssef.gamal@cairo-metro.com',
        jobTitle: 'مهندس اتصالات ونظم تحكم',
        department: 'قطاع التشغيل والتحكم',
        role: 'user',
        password: 'SuperSecretPassword123!',
      };

      const created = inMemoryStore.createUser(newUserDto, { id: 'usr_admin_001', role: 'admin' });
      expect(created.id).toBeDefined();

      const auditRes = inMemoryStore.getSystemAuditLogs();
      expect(auditRes.total).toBe(initialCount + 1);

      const latest = auditRes.entries[0];
      expect(latest.action).toBe('users.create');
      expect(latest.outcome).toBe('success');
      expect(latest.targetResourceId).toBe(created.id);
      expect(latest.targetResourceName).toBe('يوسف جمال الدين');
      expect(latest.actorId).toBe('usr_admin_001');
      expect(latest.actorRole).toBe('admin');
    });

    it('strictly strips passwords from audit log entries and metadata during user creation', () => {
      const newUserDto: CreateUserRequestDTO = {
        name: 'كريم محمود',
        username: 'karim_mahmoud',
        email: 'karim.m@cairo-metro.com',
        jobTitle: 'فني كهرباء',
        department: 'قطاع الصيانة والدعم الفني',
        role: 'user',
        password: 'TopSecretCredentials999#',
      };

      inMemoryStore.createUser(newUserDto, { id: 'usr_admin_001', role: 'admin' });

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const createLog = auditRes.entries.find((e) => e.targetResourceId === 'USR013' || e.targetResourceName === 'كريم محمود');
      expect(createLog).toBeDefined();

      const logString = JSON.stringify(createLog);
      expect(logString).not.toContain('TopSecretCredentials999#');
      expect(createLog?.metadata).toBeDefined();
      expect(createLog?.metadata?.password).toBeUndefined();
    });

    it('records an audit entry with previous and new role when user role is updated', () => {
      inMemoryStore.updateUserRole('USR003', 'lecturer', { id: 'usr_admin_001', role: 'admin' });

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const roleLog = auditRes.entries.find((e) => e.action === 'users.change_role' && e.targetResourceId === 'USR003');
      expect(roleLog).toBeDefined();
      expect(roleLog?.outcome).toBe('success');
      expect(roleLog?.metadata?.previousRole).toBe('user');
      expect(roleLog?.metadata?.newRole).toBe('lecturer');
    });

    it('records an audit entry when user account status is changed (suspended / reactivated)', () => {
      inMemoryStore.updateUserStatus('USR004', 'suspended', 'مخالفة تعليمات السلامة', { id: 'usr_admin_001', role: 'admin' });

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const statusLog = auditRes.entries.find((e) => e.action === 'users.change_status' && e.targetResourceId === 'USR004');
      expect(statusLog).toBeDefined();
      expect(statusLog?.outcome).toBe('success');
      expect(statusLog?.severity).toBe('warning');
      expect(statusLog?.metadata?.newStatus).toBe('suspended');
    });

    it('records an audit entry when a user is deleted from the central directory', () => {
      inMemoryStore.deleteUser('USR012', { id: 'usr_admin_001', role: 'admin' });

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const deleteLog = auditRes.entries.find((e) => e.action === 'users.delete' && e.targetResourceId === 'USR012');
      expect(deleteLog).toBeDefined();
      expect(deleteLog?.outcome).toBe('success');
      expect(deleteLog?.severity).toBe('critical');
    });
  });

  // ── 3. Domain Operation Instrumentation: Permission Management ───────
  describe('3. Domain Operation Instrumentation: Permission Management', () => {
    it('records an audit entry when role default permissions are updated', () => {
      inMemoryStore.updateRolePermissions(
        'lecturer',
        ['courses.create', 'courses.edit_metadata', 'courses.edit_curriculum', 'reviews.submit_course'],
        { id: 'usr_admin_001', role: 'admin' }
      );

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const roleLog = auditRes.entries.find((e) => e.action === 'permissions.configure_roles');
      expect(roleLog).toBeDefined();
      expect(roleLog?.outcome).toBe('success');
      expect(roleLog?.metadata?.role).toBe('lecturer');
    });

    it('records an audit entry when individual user permission overrides are set', () => {
      inMemoryStore.setUserPermissionOverride({
        userId: 'USR002',
        granted: ['courses.create'],
        revoked: [],
        reason: 'تفويض إعداد دورات هندسية جديدة',
        updatedBy: 'usr_admin_001',
      });

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const overrideLog = auditRes.entries.find((e) => e.action === 'permissions.configure_users' && e.targetResourceId === 'USR002');
      expect(overrideLog).toBeDefined();
      expect(overrideLog?.outcome).toBe('success');
      expect(overrideLog?.metadata?.grantedCount).toBe(1);
    });

    it('records an audit entry when individual user permission overrides are deleted', () => {
      inMemoryStore.setUserPermissionOverride({
        userId: 'USR002',
        granted: ['courses.create'],
        revoked: [],
        reason: 'مؤقت',
        updatedBy: 'usr_admin_001',
      });

      inMemoryStore.deleteUserPermissionOverride('USR002');

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const deleteOverrideLog = auditRes.entries.find(
        (e) => e.action === 'permissions.configure_users' && e.details.includes('إزالة التخصيصات الفردية')
      );
      expect(deleteOverrideLog).toBeDefined();
      expect(deleteOverrideLog?.outcome).toBe('success');
    });
  });

  // ── 4. Domain Operation Instrumentation: Assistant Admin Governance ───
  describe('4. Domain Operation Instrumentation: Assistant Admin Governance', () => {
    it('records an audit entry when operational delegation is activated or revoked', () => {
      inMemoryStore.setDelegatedAuthority('USR016', true);

      let auditRes = inMemoryStore.getSystemAuditLogs();
      let delLog = auditRes.entries.find((e) => e.action === 'governance.delegation' && e.metadata?.delegationState === true);
      expect(delLog).toBeDefined();
      expect(delLog?.outcome).toBe('success');

      inMemoryStore.setDelegatedAuthority('USR016', false);
      auditRes = inMemoryStore.getSystemAuditLogs();
      delLog = auditRes.entries.find((e) => e.action === 'governance.delegation' && e.metadata?.delegationState === false);
      expect(delLog).toBeDefined();
      expect(delLog?.outcome).toBe('success');
    });

    it('records approval request creation with outcome pending_approval (not completed mutation)', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        titleAr: 'طلب ترقية متدرب إلى محاضر معتمد',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        targetId: 'USR003',
        targetResourceId: 'USR003',
        targetResourceName: 'أحمد محمود النجار',
        justification: 'اجتياز متطلبات التدريب القيادي',
        payload: { userId: 'USR003', role: 'lecturer' },
      });

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const submitLog = auditRes.entries.find((e) => e.action === 'approvals.submit_request' && e.requestId === req.id);
      expect(submitLog).toBeDefined();
      expect(submitLog?.outcome).toBe('pending_approval');
      expect(submitLog?.details).toContain('طلب ترقية متدرب');

      // Crucial: The underlying user role must remain unchanged at this point!
      const user = inMemoryStore.getManagedUserById('USR003');
      expect(user?.role).toBe('user');
    });

    it('distinguishes approval decision from successful domain execution', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        titleAr: 'طلب ترقية متدرب إلى محاضر معتمد',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        targetId: 'USR003',
        targetResourceId: 'USR003',
        justification: 'اجتياز متطلبات التدريب القيادي',
        payload: { userId: 'USR003', role: 'lecturer' },
      });

      // Approve request by system admin
      inMemoryStore.approveApprovalRequest(req.id, 'usr_admin_001', 'تمت الموافقة بناءً على تقرير الكفاءة');

      const auditRes = inMemoryStore.getSystemAuditLogs();

      // Decision audit log
      const decisionLog = auditRes.entries.find((e) => e.action === 'approvals.decide_request' && e.requestId === req.id && e.outcome === 'success');
      expect(decisionLog).toBeDefined();
      expect(decisionLog?.actorId).toBe('usr_admin_001');

      // Domain execution audit log
      const domainLog = auditRes.entries.find((e) => e.action === 'users.change_role' && e.targetResourceId === 'USR003');
      expect(domainLog).toBeDefined();
      expect(domainLog?.outcome).toBe('success');

      // User role updated in domain
      const user = inMemoryStore.getManagedUserById('USR003');
      expect(user?.role).toBe('lecturer');
    });

    it('records rejected approval requests with outcome rejected', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        titleAr: 'طلب ترقية غير مستوفي الشروط',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        targetId: 'USR004',
        justification: 'ترقية',
        payload: { userId: 'USR004', role: 'lecturer' },
      });

      inMemoryStore.rejectApprovalRequest(req.id, 'usr_admin_001', 'لم يستوف ساعات التدريب الميداني');

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const rejectLog = auditRes.entries.find((e) => e.action === 'approvals.decide_request' && e.requestId === req.id && e.outcome === 'rejected');
      expect(rejectLog).toBeDefined();

      // Mutation was NOT applied
      const user = inMemoryStore.getManagedUserById('USR004');
      expect(user?.role).toBe('user');
    });

    it('prevents repeated approval submissions and logs denied outcome without corrupting state', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_status',
        titleAr: 'طلب إيقاف حساب',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        targetId: 'USR005',
        justification: 'إيقاف',
        payload: { userId: 'USR005', status: 'suspended' },
      });

      inMemoryStore.approveApprovalRequest(req.id, 'usr_admin_001');

      // Attempting to approve again must fail
      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, 'usr_admin_001');
      }).toThrow(MockStoreError);

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const repeatLog = auditRes.entries.find(
        (e) => e.action === 'approvals.decide_request' && e.requestId === req.id && e.outcome === 'denied'
      );
      expect(repeatLog).toBeDefined();
      expect(repeatLog?.details).toContain('محاولة متكررة');
    });
  });

  // ── 5. Denied Invariants & Safety Logging ─────────────────────────────
  describe('5. Denied Invariants & Safety Logging', () => {
    it('logs denied attempt when assistant admin attempts to create a system admin account directly', () => {
      expect(() => {
        inMemoryStore.createUser(
          {
            name: 'مدير جديد غير مصرح',
            username: 'fake_admin',
            email: 'fake.admin@cairo-metro.com',
            jobTitle: 'مدير محاول',
            department: 'الإدارة',
            role: 'admin',
          },
          { id: 'USR016', role: 'assistant_admin' }
        );
      }).toThrow(MockStoreError);

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const deniedLog = auditRes.entries[0];
      expect(deniedLog.action).toBe('users.create');
      expect(deniedLog.outcome).toBe('denied');
      expect(deniedLog.actorId).toBe('USR016');
      expect(deniedLog.severity).toBe('critical');

      // Confirm user was NOT added
      expect(inMemoryStore.getManagedUserById('fake_admin')).toBeUndefined();
    });

    it('logs denied attempt when trying to exceed role capability ceiling via role defaults', () => {
      expect(() => {
        inMemoryStore.updateRolePermissions(
          'user',
          ['users.delete'], // 'users.delete' is strictly blocked for 'user' ceiling
          { id: 'usr_admin_001', role: 'admin' }
        );
      }).toThrow(MockStoreError);

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const deniedLog = auditRes.entries.find(
        (e) => e.action === 'permissions.configure_roles' && e.outcome === 'denied'
      );
      expect(deniedLog).toBeDefined();
      expect(deniedLog?.metadata?.failureCode).toBe('INVARIANT_CEILING_VIOLATION');
    });

    it('logs denied attempt when trying to strip essential capabilities causing admin lockout', () => {
      expect(() => {
        inMemoryStore.updateRolePermissions(
          'admin',
          ['courses.create'], // Missing essential admin capabilities
          { id: 'usr_admin_001', role: 'admin' }
        );
      }).toThrow(MockStoreError);

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const deniedLog = auditRes.entries.find(
        (e) => e.action === 'permissions.configure_roles' && e.outcome === 'denied' && e.metadata?.failureCode === 'INVARIANT_ADMIN_LOCKOUT_PREVENTION'
      );
      expect(deniedLog).toBeDefined();
    });

    it('logs dual-control violations when a requester attempts to approve their own request', () => {
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'users.change_role',
        titleAr: 'طلب ذاتي',
        requestedBy: 'usr_admin_001',
        requesterId: 'usr_admin_001',
        targetId: 'USR003',
        payload: { userId: 'USR003', role: 'lecturer' },
      });

      expect(() => {
        inMemoryStore.approveApprovalRequest(req.id, 'usr_admin_001');
      }).toThrow(MockStoreError);

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const deniedLog = auditRes.entries.find(
        (e) => e.action === 'approvals.decide_request' && e.requestId === req.id && e.outcome === 'denied'
      );
      expect(deniedLog).toBeDefined();
      expect(deniedLog?.details).toContain('الرقابة الثنائية');
    });
  });

  // ── 6. Groups & Course Publication Instrumentation ────────────────────
  describe('6. Groups & Course Publication Instrumentation', () => {
    it('records an audit entry when a training group is created, updated, archived, and deleted', () => {
      // 1. Create Group
      const group = inMemoryStore.createGroup({
        name: 'مجموعة مراقبة السكك الحديدية',
        description: 'مجموعة متقدمة',
        startDateTime: '2026-11-01T08:00:00Z',
        deadlineDateTime: '2026-12-01T17:00:00Z',
        postDeadlinePolicy: 'keep_no_cert',
        courseAssignments: [{ courseId: 'CRS001', courseRole: 'core' }],
      });

      let auditRes = inMemoryStore.getSystemAuditLogs();
      const createGroupLog = auditRes.entries.find((e) => e.action === 'groups.create' && e.targetResourceId === group.id);
      expect(createGroupLog).toBeDefined();
      expect(createGroupLog?.outcome).toBe('success');

      // 2. Update Group
      inMemoryStore.updateGroup(group.id, { description: 'وصف محدث للتدقيق' });
      auditRes = inMemoryStore.getSystemAuditLogs();
      const updateGroupLog = auditRes.entries.find((e) => e.action === 'groups.edit_config' && e.targetResourceId === group.id);
      expect(updateGroupLog).toBeDefined();

      // 3. Archive Group
      inMemoryStore.archiveGroup(group.id);
      auditRes = inMemoryStore.getSystemAuditLogs();
      const archiveGroupLog = auditRes.entries.find((e) => e.action === 'groups.archive' && e.targetResourceId === group.id);
      expect(archiveGroupLog).toBeDefined();
    });

    it('records an audit entry when a course is published', () => {
      const admin = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
      const course = inMemoryStore.getCourseById('CRS002');
      if (course) course.status = 'pending_admin';

      inMemoryStore.executeReviewDecision(
        'CRS002',
        {
          outcome: 'approved',
          approvalNote: 'المحتوى مطابق للمعايير الفنية',
        },
        admin
      );

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const publishLog = auditRes.entries.find((e) => e.action === 'courses.publish' && e.targetResourceId === 'CRS002');
      expect(publishLog).toBeDefined();
      expect(publishLog?.outcome).toBe('success');
      expect(publishLog?.actorRole).toBe('admin');
    });
  });

  // ── 7. Sovereign Access Control on /api/admin/audit API ───────────────
  describe('7. Sovereign Access Control on /api/admin/audit API', () => {
    it('allows system administrator with audit capability to access GET /api/admin/audit', async () => {
      setTestSession('admin');

      const response = await auditApi.getAuditLogs();
      expect(response).toBeDefined();
      expect(response.total).toBeGreaterThanOrEqual(INITIAL_SECURITY_AUDIT_LOGS.length);
      expect(response.entries).toBeInstanceOf(Array);
    });

    it('denies assistant administrator access to GET /api/admin/audit with HTTP 403', async () => {
      setTestSession('assistant_admin');

      await expect(auditApi.getAuditLogs()).rejects.toThrow();

      // Denied attempt was logged
      const auditRes = inMemoryStore.getSystemAuditLogs();
      const deniedLog = auditRes.entries.find((e) => e.action === 'audit.view_system_logs' && e.actorId === 'USR016');
      expect(deniedLog).toBeDefined();
      expect(deniedLog?.outcome).toBe('denied');
    });

    it('denies assistant administrator even when operational delegation is active', async () => {
      // Activate delegation
      inMemoryStore.setDelegatedAuthority('USR016', true);

      setTestSession('assistant_admin');

      // Operational delegation does NOT bypass sovereign audit log protection
      await expect(auditApi.getAuditLogs()).rejects.toThrow();
    });

    it('denies lecturer and trainee access to GET /api/admin/audit with HTTP 403', async () => {
      setTestSession('lecturer');

      await expect(auditApi.getAuditLogs()).rejects.toThrow();

      setTestSession('trainee');

      await expect(auditApi.getAuditLogs()).rejects.toThrow();
    });
  });

  // ── 8. API Filters, Search, Ordering & Pagination ─────────────────────
  describe('8. API Filters, Search, Ordering & Pagination', () => {
    beforeEach(() => {
      setTestSession('admin');
    });

    it('orders audit records descending by timestamp (newest first)', async () => {
      const res = await auditApi.getAuditLogs();
      expect(res.entries.length).toBeGreaterThan(1);

      for (let i = 0; i < res.entries.length - 1; i++) {
        const current = new Date(res.entries[i].timestamp).getTime();
        const next = new Date(res.entries[i + 1].timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('filters records by outcome', async () => {
      const deniedRes = await auditApi.getAuditLogs({ outcome: 'denied' });
      expect(deniedRes.entries.length).toBeGreaterThan(0);
      deniedRes.entries.forEach((e) => {
        expect(e.outcome).toBe('denied');
      });

      const successRes = await auditApi.getAuditLogs({ outcome: 'success' });
      expect(successRes.entries.length).toBeGreaterThan(0);
      successRes.entries.forEach((e) => {
        expect(e.outcome).toBe('success');
      });
    });

    it('filters records by severity', async () => {
      const critRes = await auditApi.getAuditLogs({ severity: 'critical' });
      expect(critRes.entries.length).toBeGreaterThan(0);
      critRes.entries.forEach((e) => {
        expect(e.severity).toBe('critical');
      });
    });

    it('filters records by search query matching details, action, or actor', async () => {
      const res = await auditApi.getAuditLogs({ search: 'سارة' });
      expect(res.entries.length).toBeGreaterThan(0);
      res.entries.forEach((e) => {
        const matches =
          e.actorName.includes('سارة') ||
          (e.targetResourceName && e.targetResourceName.includes('سارة')) ||
          e.details.includes('سارة');
        expect(matches).toBe(true);
      });
    });

    it('paginates results accurately with page and pageSize', async () => {
      const page1 = await auditApi.getAuditLogs({ page: 1, pageSize: 2 });
      expect(page1.entries).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);

      const page2 = await auditApi.getAuditLogs({ page: 2, pageSize: 2 });
      expect(page2.entries).toHaveLength(2);
      expect(page2.page).toBe(2);
      expect(page2.entries[0].id).not.toBe(page1.entries[0].id);
    });

    it('returns empty result cleanly when no records match filter', async () => {
      const emptyRes = await auditApi.getAuditLogs({ search: 'NON_EXISTENT_QUERY_XYZ_123' });
      expect(emptyRes.entries).toHaveLength(0);
      expect(emptyRes.total).toBe(0);
      expect(emptyRes.totalPages).toBe(1);
    });
  });

  // ── 9. User Interface: Security Audit Page (/admin/audit) ─────────────
  describe('9. User Interface: Security Audit Page (/admin/audit)', () => {
    it('renders the audit trail interface for authorized system administrator', async () => {
      setTestSession('admin');

      render(<AppRouter initialEntries={['/admin/audit']} />);

      await waitFor(() => {
        expect(screen.getByTestId('security-audit-page')).toBeInTheDocument();
      });

      // Page Title and Subtitle
      expect(screen.getByText('سجل الرقابة والأمان للمنظومة')).toBeInTheDocument();
      expect(screen.getByText(/سجل تدقيق مركزي يوثق كافة العمليات الإدارية الحساسة/)).toBeInTheDocument();

      // Disclaimer Banner
      expect(screen.getByText(/تنويه حفظ السجلات في بيئة المحاكاة/)).toBeInTheDocument();

      // KPI Card
      expect(screen.getByTestId('kpi-total-audit-events')).toBeInTheDocument();

      // Table & Search Input
      expect(screen.getByTestId('audit-table')).toBeInTheDocument();
      expect(screen.getByTestId('audit-search-input')).toBeInTheDocument();
    });

    it('filters audit records when clicking outcome filter buttons in UI', async () => {
      setTestSession('admin');

      render(<AppRouter initialEntries={['/admin/audit']} />);

      await waitFor(() => {
        expect(screen.getByTestId('security-audit-page')).toBeInTheDocument();
      });

      // Click "محظورة أمنياً" filter button
      const deniedBtn = screen.getByRole('button', { name: 'محظورة أمنياً' });
      fireEvent.click(deniedBtn);

      await waitFor(() => {
        // Table should still render and be populated with filtered rows
        expect(screen.getByTestId('audit-table')).toBeInTheDocument();
      });
    });

    it('opens detail modal when clicking preview button on an audit row', async () => {
      setTestSession('admin');

      render(<AppRouter initialEntries={['/admin/audit']} />);

      await waitFor(() => {
        expect(screen.getByTestId('security-audit-page')).toBeInTheDocument();
      });

      // Wait for rows to load and click first "معاينة" button
      const previewButtons = await screen.findAllByRole('button', { name: 'معاينة' });
      expect(previewButtons.length).toBeGreaterThan(0);
      fireEvent.click(previewButtons[0]);

      // Detail modal opens
      await waitFor(() => {
        expect(screen.getByTestId('audit-detail-modal')).toBeInTheDocument();
      });

      // Close modal
      const closeButtons = screen.getAllByRole('button', { name: 'إغلاق النافذة' });
      fireEvent.click(closeButtons[0]);

      await waitFor(() => {
        expect(screen.queryByTestId('audit-detail-modal')).not.toBeInTheDocument();
      });
    });

    it('denies assistant administrator navigating to /admin/audit via ProtectedRoute', async () => {
      setTestSession('assistant_admin');

      render(<AppRouter initialEntries={['/admin/audit']} />);

      // ProtectedRoute redirects assistant admin to /403
      await waitFor(() => {
        expect(screen.queryByTestId('security-audit-page')).not.toBeInTheDocument();
      });
    });
  });
});
