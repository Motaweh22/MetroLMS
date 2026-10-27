import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { server } from '@/mocks/server';
import { groupsApi } from '@/features/groups/services/groupsApi';
import { authStorage } from '@/core/auth/authStorage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedReviewDemo: false });
});
afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

describe('Increment 10 — Training Groups Demo Data Seeding & Cross-Feature Verification', () => {
  it('seeds rich Increment 10 demo fixtures including multi-cycle cohort, attempts, requests, materials, and scheduled group', async () => {
    // Explicitly seed the rich demo fixtures
    inMemoryStore.seedIncrement10DemoFixtures();

    // 1. Verify multi-cycle group GRP-201
    const group201 = inMemoryStore.getGroupById('GRP-201');
    expect(group201).toBeDefined();
    expect(group201?.name).toContain('دفعة التميز 2026');
    expect(group201?.currentCycleId).toBe('CYC-GRP-201-02');

    const cycles = inMemoryStore.getGroupCycles('GRP-201');
    expect(cycles.length).toBe(2);

    const cycle1 = cycles.find((c) => c.id === 'CYC-GRP-201-01');
    expect(cycle1?.status).toBe('completed');
    expect(cycle1?.cycleNumber).toBe(1);

    const cycle2 = cycles.find((c) => c.id === 'CYC-GRP-201-02');
    expect(cycle2?.status).toBe('active');
    expect(cycle2?.cycleNumber).toBe(2);
    expect(cycle2?.courses.find((c) => c.courseId === 'CRS001')?.courseRole).toBe('reminder');
    expect(cycle2?.courses.find((c) => c.courseId === 'CRS002')?.courseRole).toBe('core');

    // 2. Verify Trainee repeating course CRS001 across renewal cycles
    const traineeStats = inMemoryStore.getCourseAttemptStatsForTrainee(
      'usr_trainee_003',
      'CRS001',
      'CYC-GRP-201-02'
    );
    expect(traineeStats).toBeDefined();
    expect(traineeStats?.currentAttemptNumber).toBe(2);
    expect(traineeStats?.previousCompletionsCount).toBe(1);
    expect(traineeStats?.previousStartedAttemptsCount).toBe(1);
    expect(traineeStats?.historicalAttempts.length).toBeGreaterThanOrEqual(1);
    const completedHistorical = traineeStats?.historicalAttempts.find((a) => a.cycleId === 'CYC-GRP-201-01');
    expect(completedHistorical?.status).toBe('completed');
    expect(completedHistorical?.progressPercent).toBe(100);

    // 3. Verify Group with pending join requests
    const pendingRequests = inMemoryStore.getGroupJoinRequests('GRP-201', 'pending');
    expect(pendingRequests.length).toBeGreaterThanOrEqual(1);
    expect(pendingRequests[0].id).toBe('REQ-DEMO-201-01');
    expect(pendingRequests[0].userName).toBe('ياسر إبراهيم عبدالعزيز');
    expect(pendingRequests[0].status).toBe('pending');

    // 4. Verify Group with uploaded materials in multiple folders
    const materials = inMemoryStore.getGroupMaterials('GRP-201', 'admin');
    expect(materials.folders.length).toBe(2);
    const allFiles = materials.folders.flatMap((f) => f.files);
    expect(allFiles.length).toBe(3);

    const pdfFile = allFiles.find((f) => f.fileType === 'pdf');
    expect(pdfFile).toBeDefined();
    expect(pdfFile?.title).toContain('دليل الإشارات');

    const imageFile = allFiles.find((f) => f.fileType === 'image');
    expect(imageFile).toBeDefined();

    // 5. Verify Scheduled group accepting pre-training enrollments
    const group202 = inMemoryStore.getGroupById('GRP-202');
    expect(group202).toBeDefined();
    expect(group202?.adminStatus).toBe('active');
    expect(group202?.isEnrollmentOpen).toBe(true);
    expect(group202?.enrollmentPolicy).toBe('open');
    expect(group202?.enrollmentCode).toBe('GRP-202-PRE-ENROLL');

    // Token validation succeeds for scheduled pre-enrollment
    const validation = inMemoryStore.validateGroupEnrollmentToken('GRP-202-PRE-ENROLL');
    expect(validation.isValid).toBe(true);
    expect(validation.group?.id).toBe('GRP-202');
  });

  it('serves seeded demo fixtures through API endpoints for authenticated administrator', async () => {
    inMemoryStore.seedIncrement10DemoFixtures();

    authStorage.setSession({
      token: 'mock_jwt_admin_test',
      user: adminUser,
      expiresAt: Date.now() + 3600000,
    });

    // 1. GET /api/admin/groups includes GRP-201 and GRP-202
    const allGroups = await groupsApi.getAdminGroups();
    expect(allGroups.some((g) => g.id === 'GRP-201')).toBe(true);
    expect(allGroups.some((g) => g.id === 'GRP-202')).toBe(true);

    // 2. GET /api/admin/groups/GRP-201/monitoring returns accurate metrics
    const metrics = await groupsApi.getGroupMonitoringData('GRP-201');
    expect(metrics).toBeDefined();
    expect(metrics.group.id).toBe('GRP-201');
    expect(metrics.selectedCycle?.id).toBe('CYC-GRP-201-02');

    // 3. GET /api/admin/groups/GRP-201/join-requests returns pending request
    const requests = await groupsApi.getJoinRequests('GRP-201', 'pending');
    expect(requests.length).toBe(1);
    expect(requests[0].userName).toBe('ياسر إبراهيم عبدالعزيز');

    // 4. GET /api/admin/groups/GRP-201/materials returns folder structure
    const apiMaterials = await groupsApi.getGroupMaterials('GRP-201');
    expect(apiMaterials.folders.length).toBe(2);
    const apiFiles = apiMaterials.folders.flatMap((f) => f.files);
    expect(apiFiles.length).toBe(3);
  });
});
