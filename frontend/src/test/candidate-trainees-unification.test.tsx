import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { groupsApi } from '@/features/groups/services/groupsApi';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedGroupDemo: true });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

function renderGroupEditor(groupId: string = 'GRP-101') {
  authStorage.setSession({
    token: `mock_jwt_${adminUser.id}_test`,
    user: adminUser,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[`/admin/groups/${groupId}/edit?tab=members`]} />);
}

describe('Increment 11 — Phase 1: Candidate Trainees Central Directory Unification', () => {
  describe('1. Central User Directory Querying for Candidates', () => {
    it('returns candidate trainees dynamically queried from central users store', () => {
      const candidates = inMemoryStore.getCandidateTrainees();

      // Exactly 10 active trainees among 15 directory users
      expect(candidates).toHaveLength(10);

      // Verify known active trainees are present
      const candidateIds = candidates.map((c) => c.id);
      expect(candidateIds).toContain('usr_trainee_003');
      expect(candidateIds).toContain('USR003');
      expect(candidateIds).toContain('USR004');
      expect(candidateIds).toContain('USR005');
      expect(candidateIds).toContain('USR006');
      expect(candidateIds).toContain('USR007');
      expect(candidateIds).toContain('USR008');
      expect(candidateIds).toContain('USR009');
      expect(candidateIds).toContain('USR010');
      expect(candidateIds).toContain('USR012'); // newly active trainee from data/users.json
    });

    it('strictly excludes suspended trainees (USR011) from candidate list', () => {
      const candidates = inMemoryStore.getCandidateTrainees();
      const suspendedUser = inMemoryStore.getManagedUserById('USR011');

      expect(suspendedUser).toBeDefined();
      expect(suspendedUser?.status).toBe('suspended');

      const candidateIds = candidates.map((c) => c.id);
      expect(candidateIds).not.toContain('USR011');
      expect(candidateIds).not.toContain('usr011');
    });

    it('strictly excludes administrators and lecturers from candidate list', () => {
      const candidates = inMemoryStore.getCandidateTrainees();
      const candidateIds = candidates.map((c) => c.id);

      // Admins
      expect(candidateIds).not.toContain('usr_admin_001');
      expect(candidateIds).not.toContain('USR001');

      // Lecturers
      expect(candidateIds).not.toContain('usr_lect_002');
      expect(candidateIds).not.toContain('USR002');
    });

    it('preserves the CandidateTraineeDTO shape with accurate metadata from central store', () => {
      const candidates = inMemoryStore.getCandidateTrainees();

      for (const candidate of candidates) {
        expect(candidate).toHaveProperty('id');
        expect(candidate).toHaveProperty('name');
        expect(candidate).toHaveProperty('email');
        expect(candidate).toHaveProperty('department');
        expect(candidate).toHaveProperty('jobTitle');
        expect(typeof candidate.name).toBe('string');
        expect(candidate.name.length).toBeGreaterThan(0);
      }

      // Check USR012 metadata
      const fatma = candidates.find((c) => c.id === 'USR012');
      expect(fatma).toBeDefined();
      expect(fatma?.name).toBe('فاطمة حسين أحمد');
      expect(fatma?.department).toBe('الإدارة العامة');
      expect(fatma?.jobTitle).toBe('موظف إداري');
    });
  });

  describe('2. Integration with DirectAssignModal & Group Enrollment Workflows', () => {
    it('fetches candidate trainees via groupsApi.getCandidateTrainees()', async () => {
      authStorage.setSession({
        token: `mock_jwt_${adminUser.id}_test`,
        user: adminUser,
        expiresAt: Date.now() + 3600000,
      });

      const candidates = await groupsApi.getCandidateTrainees();
      expect(candidates).toHaveLength(10);
      expect(candidates.some((c) => c.id === 'USR012')).toBe(true);
      expect(candidates.some((c) => c.id === 'USR011')).toBe(false);
    });

    it('displays unified candidates in DirectAssignModal, excluding existing group members', async () => {
      renderGroupEditor('GRP-101');

      // Wait for GroupEditorPage to load on members tab
      await waitFor(() => {
        expect(screen.getByTestId('group-members-tab')).toBeInTheDocument();
      });

      // Wait for members table (GRP-101 has usr_trainee_003 and usr004)
      await waitFor(() => {
        expect(screen.getByTestId('member-row-usr_trainee_003')).toBeInTheDocument();
      });

      // Open Direct Assignment Modal
      const directAssignBtn = screen.getByTestId('open-direct-assign-btn');
      fireEvent.click(directAssignBtn);

      await waitFor(() => {
        expect(screen.getByTestId('direct-assign-modal')).toBeInTheDocument();
      });

      // Existing members (usr_trainee_003, USR004) are NOT in candidate picker
      expect(screen.queryByTestId('candidate-row-usr_trainee_003')).not.toBeInTheDocument();
      expect(screen.queryByTestId('candidate-row-usr004')).not.toBeInTheDocument();

      // Available active trainees (USR005, USR006, USR012) are present
      expect(screen.getByTestId('candidate-row-USR005')).toBeInTheDocument();
      expect(screen.getByTestId('candidate-row-USR006')).toBeInTheDocument();
      expect(screen.getByTestId('candidate-row-USR012')).toBeInTheDocument();

      // Suspended trainee USR011 is NOT in the modal
      expect(screen.queryByTestId('candidate-row-USR011')).not.toBeInTheDocument();

      // Select newly unified trainee USR012 and submit
      const checkbox12 = screen.getByTestId('candidate-checkbox-USR012');
      fireEvent.click(checkbox12);

      const confirmBtn = screen.getByTestId('confirm-direct-assign-btn');
      fireEvent.click(confirmBtn);

      // Verify modal closes and USR012 appears in group members table
      await waitFor(() => {
        expect(screen.queryByTestId('direct-assign-modal')).not.toBeInTheDocument();
        expect(screen.getByTestId('member-row-usr012')).toBeInTheDocument();
      });

      // Verify course enrollment was triggered for USR012 in the mock store
      const enrollments = inMemoryStore.getTraineeEnrollments('USR012');
      expect(enrollments.length).toBeGreaterThan(0);
    });
  });
});
