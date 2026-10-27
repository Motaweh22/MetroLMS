import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore, MockStoreError } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { departmentTracksApi } from '@/features/permissions/services/departmentTracksApi';
import { AppRouter } from '@/app/router';
import { INITIAL_DEPARTMENT_TRACKS } from '@/mocks/fixtures/departmentTracksFixtures';

describe('Increment 11 — Phase 4E: Department Course-Track Configuration', () => {
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

  // ── 1. Canonical Fixtures & Deterministic Store Reset ────────────────
  describe('1. Canonical Fixtures & Deterministic Store Reset', () => {
    it('initializes canonical departments (10) and technical tracks (7) correctly', () => {
      const depts = inMemoryStore.getCanonicalDepartments();
      const tracks = inMemoryStore.getCanonicalTracks();

      expect(depts).toHaveLength(10);
      expect(tracks).toHaveLength(7);

      expect(depts.map((d) => d.id)).toContain('DEPT-OPERATIONS');
      expect(depts.map((d) => d.id)).toContain('DEPT-MAINTENANCE');
      expect(depts.map((d) => d.id)).toContain('DEPT-SIGNALS');
      expect(depts.map((d) => d.id)).toContain('DEPT-TRAINING');

      expect(tracks.map((t) => t.id)).toContain('TRK-001');
      expect(tracks.map((t) => t.id)).toContain('TRK-002');
      expect(tracks.map((t) => t.id)).toContain('TRK-005');
    });

    it('returns deep cloned records to avoid mutating internal store state', () => {
      const depts = inMemoryStore.getAllDepartmentTracks();
      const first = depts[0];
      first.allowedTracks.push('MALICIOUS_TRACK');

      const fresh = inMemoryStore.getAllDepartmentTracks();
      expect(fresh[0].allowedTracks).not.toContain('MALICIOUS_TRACK');
    });

    it('resets department tracks deterministically on inMemoryStore.reset()', () => {
      // Modify a department
      inMemoryStore.updateDepartmentTracks('DEPT-SECURITY', ['TRK-001', 'TRK-002', 'TRK-003']);
      const updated = inMemoryStore.getDepartmentTracksById('DEPT-SECURITY');
      expect(updated?.allowedTracks).toEqual(['TRK-001', 'TRK-002', 'TRK-003']);

      // Reset
      inMemoryStore.reset();
      const resetDept = inMemoryStore.getDepartmentTracksById('DEPT-SECURITY');
      expect(resetDept?.allowedTracks).toEqual(INITIAL_DEPARTMENT_TRACKS['DEPT-SECURITY'].allowedTracks);
    });
  });

  // ── 2. Data Validation & Atomic Update Safeguards ─────────────────────
  describe('2. Data Validation & Atomic Update Safeguards', () => {
    it('atomically updates allowed tracks for a valid department', () => {
      const result = inMemoryStore.updateDepartmentTracks(
        'DEPT-SIGNALS',
        ['TRK-001', 'TRK-005', 'TRK-007'],
        { id: 'usr_admin_001', role: 'admin' }
      );

      expect(result.departmentId).toBe('DEPT-SIGNALS');
      expect(result.allowedTracks).toEqual(['TRK-001', 'TRK-005', 'TRK-007']);

      const readBack = inMemoryStore.getDepartmentTracksById('DEPT-SIGNALS');
      expect(readBack?.allowedTracks).toEqual(['TRK-001', 'TRK-005', 'TRK-007']);
    });

    it('rejects unknown department identifiers with MockStoreError 404', () => {
      expect(() => {
        inMemoryStore.updateDepartmentTracks(
          'DEPT-NON-EXISTENT',
          ['TRK-001'],
          { id: 'usr_admin_001', role: 'admin' }
        );
      }).toThrow(MockStoreError);
    });

    it('rejects unknown track identifiers with MockStoreError 400', () => {
      const previous = inMemoryStore.getDepartmentTracksById('DEPT-OPERATIONS');

      expect(() => {
        inMemoryStore.updateDepartmentTracks(
          'DEPT-OPERATIONS',
          ['TRK-001', 'TRK-FABRICATED-INVALID'],
          { id: 'usr_admin_001', role: 'admin' }
        );
      }).toThrow(MockStoreError);

      // Verify atomic rollback / unmutated state
      const after = inMemoryStore.getDepartmentTracksById('DEPT-OPERATIONS');
      expect(after?.allowedTracks).toEqual(previous?.allowedTracks);
    });

    it('rejects non-array or malformed track payload with MockStoreError 400', () => {
      expect(() => {
        inMemoryStore.updateDepartmentTracks(
          'DEPT-OPERATIONS',
          // @ts-expect-error Testing runtime invalid argument
          'NOT_AN_ARRAY',
          { id: 'usr_admin_001', role: 'admin' }
        );
      }).toThrow(MockStoreError);
    });

    it('deduplicates duplicate track entries cleanly', () => {
      const result = inMemoryStore.updateDepartmentTracks(
        'DEPT-SECURITY',
        ['TRK-001', 'TRK-001', 'TRK-001'],
        { id: 'usr_admin_001', role: 'admin' }
      );

      expect(result.allowedTracks).toEqual(['TRK-001']);
    });
  });

  // ── 3. Security Audit Trail Instrumentation ──────────────────────────
  describe('3. Security Audit Trail Instrumentation', () => {
    it('records an audit log entry when department tracks are updated', () => {
      inMemoryStore.updateDepartmentTracks(
        'DEPT-IT',
        ['TRK-001', 'TRK-007', 'TRK-005'],
        { id: 'usr_admin_001', role: 'admin' }
      );

      const auditRes = inMemoryStore.getSystemAuditLogs();
      const log = auditRes.entries.find(
        (e) => e.action === 'permissions.configure_departments' && e.targetResourceId === 'DEPT-IT'
      );

      expect(log).toBeDefined();
      expect(log?.outcome).toBe('success');
      expect(log?.resourceType).toBe('department');
      expect(log?.targetResourceName).toBe('إدارة تكنولوجيا المعلومات');
      expect(log?.metadata?.allowedTracks).toEqual(['TRK-001', 'TRK-007', 'TRK-005']);
    });
  });

  // ── 4. API Endpoints & Role Authorization ────────────────────────────
  describe('4. API Endpoints & Role Authorization', () => {
    it('allows system administrator to fetch all department tracks via GET /api/admin/department-tracks', async () => {
      setTestSession('admin');

      const data = await departmentTracksApi.getDepartmentTracksConfig();
      expect(data.departments).toHaveLength(10);
      expect(data.canonicalDepartments).toHaveLength(10);
      expect(data.tracks).toHaveLength(7);
    });

    it('allows system administrator to directly update department tracks via PUT /api/admin/department-tracks/:id', async () => {
      setTestSession('admin');

      const response = await departmentTracksApi.updateDepartmentTracks('DEPT-OPERATIONS', [
        'TRK-001',
        'TRK-002',
        'TRK-004',
      ]);

      expect(response.success).toBe(true);
      expect(response.requiresApproval).toBeFalsy();
      expect(response.department.allowedTracks).toEqual(['TRK-001', 'TRK-002', 'TRK-004']);

      // Verified in store
      const stored = inMemoryStore.getDepartmentTracksById('DEPT-OPERATIONS');
      expect(stored?.allowedTracks).toEqual(['TRK-001', 'TRK-002', 'TRK-004']);
    });

    it('intercepts assistant administrator update without delegation, creating pending approval request (202)', async () => {
      setTestSession('assistant_admin');

      const originalConfig = inMemoryStore.getDepartmentTracksById('DEPT-CUSTOMER');

      const response = await departmentTracksApi.updateDepartmentTracks(
        'DEPT-CUSTOMER',
        ['TRK-001', 'TRK-006', 'TRK-007'],
        'تعديل لإضافة مسار تكنولوجيا المعلومات لخدمة العملاء'
      );

      expect(response.success).toBe(true);
      expect(response.requiresApproval).toBe(true);
      expect(response.approvalRequestId).toBeDefined();

      // CRUCIAL: The underlying department configuration must remain UNCHANGED at this stage!
      const storedAfter = inMemoryStore.getDepartmentTracksById('DEPT-CUSTOMER');
      expect(storedAfter?.allowedTracks).toEqual(originalConfig?.allowedTracks);

      // Verify approval request was created in ledger
      const pendingReqs = inMemoryStore.getApprovalRequests().filter((r) => r.status === 'pending');
      const req = pendingReqs.find((r) => r.id === response.approvalRequestId);
      expect(req).toBeDefined();
      expect(req?.actionType).toBe('permissions.configure_departments');
      expect(req?.targetResourceId).toBe('DEPT-CUSTOMER');
    });

    it('allows assistant administrator with operational delegation to execute update directly (200)', async () => {
      // Activate delegation
      inMemoryStore.setDelegatedAuthority('USR016', true);

      setTestSession('assistant_admin');

      const response = await departmentTracksApi.updateDepartmentTracks('DEPT-CUSTOMER', [
        'TRK-001',
        'TRK-006',
        'TRK-007',
      ]);

      expect(response.success).toBe(true);
      expect(response.requiresApproval).toBeFalsy();
      expect(response.department.allowedTracks).toEqual(['TRK-001', 'TRK-006', 'TRK-007']);

      // Directly updated in store
      const stored = inMemoryStore.getDepartmentTracksById('DEPT-CUSTOMER');
      expect(stored?.allowedTracks).toEqual(['TRK-001', 'TRK-006', 'TRK-007']);
    });

    it('denies lecturer and trainee access to PUT /api/admin/department-tracks/:id with HTTP 403', async () => {
      setTestSession('lecturer');
      await expect(
        departmentTracksApi.updateDepartmentTracks('DEPT-OPERATIONS', ['TRK-001'])
      ).rejects.toThrow();

      setTestSession('trainee');
      await expect(
        departmentTracksApi.updateDepartmentTracks('DEPT-OPERATIONS', ['TRK-001'])
      ).rejects.toThrow();
    });

    it('denies lecturer and trainee access to GET /api/admin/department-tracks with HTTP 403', async () => {
      setTestSession('lecturer');
      await expect(departmentTracksApi.getDepartmentTracksConfig()).rejects.toThrow();

      setTestSession('trainee');
      await expect(departmentTracksApi.getDepartmentTracksConfig()).rejects.toThrow();
    });
  });

  // ── 5. Approval Workflow Execution & Rejection Semantics ─────────────
  describe('5. Approval Workflow Execution & Rejection Semantics', () => {
    it('executes department track update when approved by system administrator', () => {
      // 1. Assistant admin creates approval request
      const req = inMemoryStore.createApprovalRequest({
        actionType: 'permissions.configure_departments',
        titleAr: 'طلب إضافة مسار صيانة المحطات لإدارة الصيانة الميكانيكية',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        requesterName: 'أمير عادل إبراهيم',
        targetResourceId: 'DEPT-MECH-MAINT',
        targetResourceName: 'قطاع الصيانة الميكانيكية',
        justification: 'تحديث لاحتياجات صيانة المصاعد والمضخات',
        payload: {
          departmentId: 'DEPT-MECH-MAINT',
          allowedTracks: ['TRK-001', 'TRK-003', 'TRK-004'],
        },
      });

      // Prior to approval: config is original
      expect(inMemoryStore.getDepartmentTracksById('DEPT-MECH-MAINT')?.allowedTracks).toEqual([
        'TRK-001',
        'TRK-003',
      ]);

      // 2. System admin approves request
      inMemoryStore.approveApprovalRequest(req.id, 'usr_admin_001', 'معتمد وفقاً للائحة الفنية');

      // After approval: config is updated
      expect(inMemoryStore.getDepartmentTracksById('DEPT-MECH-MAINT')?.allowedTracks).toEqual([
        'TRK-001',
        'TRK-003',
        'TRK-004',
      ]);
    });

    it('preserves previous tracks unchanged when approval request is rejected', () => {
      const originalTracks = inMemoryStore.getDepartmentTracksById('DEPT-SECURITY')?.allowedTracks;

      const req = inMemoryStore.createApprovalRequest({
        actionType: 'permissions.configure_departments',
        titleAr: 'طلب إضافة مسار قيادة القطارات للأمن',
        requestedBy: 'USR016',
        requesterId: 'USR016',
        targetResourceId: 'DEPT-SECURITY',
        payload: {
          departmentId: 'DEPT-SECURITY',
          allowedTracks: ['TRK-001', 'TRK-002'],
        },
      });

      inMemoryStore.rejectApprovalRequest(req.id, 'usr_admin_001', 'مرفوض لعدم الاختصاص');

      // Unchanged
      expect(inMemoryStore.getDepartmentTracksById('DEPT-SECURITY')?.allowedTracks).toEqual(
        originalTracks
      );
    });
  });

  // ── 6. Preservation of Architectural Boundary ────────────────────────
  describe('6. Preservation of Architectural Boundary', () => {
    it('verifies that modifying department tracks does NOT filter or hide courses from the catalog', async () => {
      // 1. Check all courses initially
      const initialCourses = inMemoryStore.getCourses();
      expect(initialCourses.length).toBeGreaterThan(0);

      // 2. Restrict department tracks to empty or single track
      inMemoryStore.updateDepartmentTracks('DEPT-OPERATIONS', ['TRK-001']);
      inMemoryStore.updateDepartmentTracks('DEPT-MAINTENANCE', []);

      // 3. Catalog courses remain 100% accessible and unchanged
      const catalogCourses = inMemoryStore.getCourses();
      expect(catalogCourses.length).toBe(initialCourses.length);
      expect(catalogCourses.map((c) => c.id)).toEqual(initialCourses.map((c) => c.id));
    });

    it('verifies existing user enrollments and course attempts are unaffected by department track changes', () => {
      const initialAttempts = inMemoryStore.getCourseAttempts();

      inMemoryStore.updateDepartmentTracks('DEPT-OPERATIONS', []);

      const postAttempts = inMemoryStore.getCourseAttempts();
      expect(postAttempts.length).toBe(initialAttempts.length);
    });
  });

  // ── 7. User Interface: DepartmentTracksPage (/admin/department-tracks) ─
  describe('7. User Interface: DepartmentTracksPage (/admin/department-tracks)', () => {
    it('renders the department tracks configuration interface for authorized administrator', async () => {
      setTestSession('admin');

      render(<AppRouter initialEntries={['/admin/department-tracks']} />);

      await waitFor(() => {
        expect(screen.getByTestId('department-tracks-page')).toBeInTheDocument();
      });

      // Page Title & Context
      expect(screen.getByText('تخصيص مسارات التدريب للإدارات')).toBeInTheDocument();
      expect(
        screen.getByText(/تخصيص وحوكمة مسارات البرامج التدريبية المعتمدة لكل قطاع وإدارة تشغيلية/)
      ).toBeInTheDocument();

      // Architecture Boundary Alert
      expect(screen.getByText('محددات الحوكمة المؤسسية وتوثيق المسارات')).toBeInTheDocument();

      // Department List & Tracks Checklist
      expect(screen.getByTestId('department-list')).toBeInTheDocument();
      expect(screen.getByTestId('tracks-checklist')).toBeInTheDocument();
      expect(screen.getByTestId('save-dept-tracks-btn')).toBeInTheDocument();
    });

    it('allows selecting a department from the list and displays its configured tracks', async () => {
      setTestSession('admin');

      render(<AppRouter initialEntries={['/admin/department-tracks']} />);

      await waitFor(() => {
        expect(screen.getByTestId('department-tracks-page')).toBeInTheDocument();
      });

      // Click on DEPT-SIGNALS
      const signalsBtn = screen.getByTestId('dept-item-DEPT-SIGNALS');
      fireEvent.click(signalsBtn);

      // Verify DEPT-SIGNALS is active
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'قطاع الإشارات والاتصالات' })).toBeInTheDocument();
      });
    });

    it('allows toggling track checkboxes, displays unsaved badge, and saves changes', async () => {
      setTestSession('admin');

      render(<AppRouter initialEntries={['/admin/department-tracks']} />);

      await waitFor(() => {
        expect(screen.getByTestId('department-tracks-page')).toBeInTheDocument();
      });

      // Click on track checkbox
      const trackRow = screen.getByTestId('track-row-TRK-003');
      fireEvent.click(trackRow);

      // Unsaved changes badge appears
      await waitFor(() => {
        expect(screen.getByTestId('unsaved-changes-badge')).toBeInTheDocument();
      });

      // Click Save Button
      const saveBtn = screen.getByTestId('save-dept-tracks-btn');
      expect(saveBtn).not.toBeDisabled();
      fireEvent.click(saveBtn);

      // Successfully saved
      await waitFor(() => {
        expect(screen.queryByTestId('unsaved-changes-badge')).not.toBeInTheDocument();
      });
    });

    it('denies trainee navigation to /admin/department-tracks via ProtectedRoute', async () => {
      setTestSession('trainee');

      render(<AppRouter initialEntries={['/admin/department-tracks']} />);

      // Trainee redirected to /403
      await waitFor(() => {
        expect(screen.queryByTestId('department-tracks-page')).not.toBeInTheDocument();
      });
    });
  });
});
