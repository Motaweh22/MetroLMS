import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { useStagedEditsAutosave } from '@/features/course-review/hooks/useStagedEditsAutosave';
import { ConflictResolutionModal } from '@/features/course-review/components/ConflictResolutionModal';
import { reviewApi } from '@/features/course-review/api/reviewApi';
import type { Course } from '@/core/courses/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
});
afterAll(() => server.close());

describe('Increment 9 — Autosave Concurrency Hook & Conflict Modal Integration Tests (Phase 3)', () => {
  const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;

  const loginAsAdmin = () => {
    authStorage.setSession({
      token: `mock_jwt_${adminUser.id}_token`,
      user: adminUser,
      expiresAt: Date.now() + 3600000,
    });
  };

  let testCourse: Course;

  beforeEach(() => {
    inMemoryStore.reset();
    localStorage.clear();
    authStorage.clearSession();
    loginAsAdmin();

    // Create a base pending course with eligible content
    testCourse = inMemoryStore.createCourse(
      {
        title: 'مقرر إشارات وتحكم المترو',
        description: 'مقرر مخصص لمراجعة الجودة والاعتماد',
        level: 'متوسط',
      },
      adminUser
    );
    testCourse.estimatedHours = 12;
    testCourse.chapters[0].items.push({
      id: 'item_c1_1',
      type: 'video',
      title: 'مقدمة في البنية التحتية',
      duration: '10:00',
    });
    inMemoryStore.saveCourseDraft(testCourse.id, testCourse, adminUser);
    inMemoryStore.submitCourseForReview(testCourse.id, adminUser);
  });

  // 1. Debounced autosave triggers and saves with revision 1
  it('triggers debounced autosave, sends clientRevision 1 for initial save, and transitions to saved', async () => {
    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        debounceMs: 50, // Short debounce for testing
      })
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.clientRevision).toBe(0);

    // Make local edit
    act(() => {
      result.current.updateLocalEdits({ title: 'عنوان جديد بعد التعديل الأولي' });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);

    // Wait for debounced save to complete
    await waitFor(() => {
      expect(result.current.status).toBe('saved');
    });

    expect(result.current.clientRevision).toBe(1);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.lastSavedAt).not.toBeNull();

    // Verify stored record on server
    const serverRecord = inMemoryStore.getStagedAdminEdits(testCourse.id, adminUser);
    expect(serverRecord?.clientRevision).toBe(1);
    expect(serverRecord?.patchedContent.title).toBe('عنوان جديد بعد التعديل الأولي');
  });

  // 2. Monotonic revision counter increments on sequential saves
  it('increments revision numbers monotonically across sequential saves without gaps', async () => {
    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        debounceMs: 20,
      })
    );

    // Save 1
    act(() => {
      result.current.updateLocalEdits({ title: 'التعديل الأول' });
    });
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(result.current.clientRevision).toBe(1);

    // Save 2
    act(() => {
      result.current.updateLocalEdits({ description: 'الوصف بعد التعديل الثاني' });
    });
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(result.current.clientRevision).toBe(2);

    // Save 3
    act(() => {
      result.current.updateLocalEdits({ estimatedHours: 18 });
    });
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(result.current.clientRevision).toBe(3);

    const record = inMemoryStore.getStagedAdminEdits(testCourse.id, adminUser);
    expect(record?.clientRevision).toBe(3);
    expect(record?.patchedContent.title).toBe('التعديل الأول');
    expect(record?.patchedContent.description).toBe('الوصف بعد التعديل الثاني');
    expect(record?.patchedContent.estimatedHours).toBe(18);
  });

  // 3. Rehydration restores latest accepted server revision and staged content
  it('restores the latest accepted server revision when staging session is resumed', async () => {
    // Simulate pre-existing staged edits saved by prior session
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 5,
      patch: { title: 'مقرر تم حفظه مسبقاً بمراجعة 5' },
    });

    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        debounceMs: 20,
      })
    );

    // Rehydrate
    await act(async () => {
      await result.current.rehydrate();
    });

    expect(result.current.clientRevision).toBe(5);
    expect(result.current.pendingPatch.title).toBe('مقرر تم حفظه مسبقاً بمراجعة 5');

    // Next save must use revision 6!
    act(() => {
      result.current.updateLocalEdits({ estimatedHours: 20 });
    });
    await waitFor(() => expect(result.current.status).toBe('saved'));

    expect(result.current.clientRevision).toBe(6);
    const updatedRecord = inMemoryStore.getStagedAdminEdits(testCourse.id, adminUser);
    expect(updatedRecord?.clientRevision).toBe(6);
  });

  // 4. Automatic 3-way rebase recovery from HTTP 409 conflict when edits are non-overlapping
  it('automatically recovers from HTTP 409 Conflict when concurrent edits are non-overlapping', async () => {
    // Initial save by session 1 (revision 1)
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 1,
      patch: { title: 'تعديل أولي' },
    });

    // Session 2 mounts with revision 1
    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        initialRevision: 1,
        debounceMs: 50,
      })
    );

    // Concurrently, another session saves revision 2 on server (editing description)
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 2,
      patch: { description: 'تعديل الوصف من جلسة متزامنة أخرى' },
    });

    // Now Session 2 tries to save with stale clientRevision (it thinks next is 2, but server accepted 2!)
    // Session 2 edits estimatedHours (non-overlapping with description)
    act(() => {
      result.current.updateLocalEdits({ estimatedHours: 25 });
    });

    // The hook will encounter 409 Conflict, fetch revision 2, rebase non-overlapping edits,
    // update clientRevision to 3 (acceptedRev + 1), and save successfully!
    await waitFor(() => {
      expect(result.current.status).toBe('saved');
    });

    expect(result.current.clientRevision).toBe(3);
    expect(result.current.isConflictModalOpen).toBe(false);

    // Verify server has merged both changes!
    const finalRecord = inMemoryStore.getStagedAdminEdits(testCourse.id, adminUser);
    expect(finalRecord?.clientRevision).toBe(3);
    expect(finalRecord?.patchedContent.description).toBe('تعديل الوصف من جلسة متزامنة أخرى');
    expect(finalRecord?.patchedContent.estimatedHours).toBe(25);
  });

  // 5. Stale full-curriculum payload during concurrent autosave does not overwrite server's accepted edits
  it('preserves newer server curriculum edits when conflicting payload contains a full stale chapters array', async () => {
    // Initial state has 1 lesson
    // Server session adds a new lesson to Chapter 1 with revision 2
    const updatedServerChapters = JSON.parse(JSON.stringify(testCourse.chapters));
    updatedServerChapters[0].items.push({
      id: 'item_new_server_lesson',
      type: 'pdf',
      title: 'درس جديد مضاف من الجلسة المتزامنة',
    });
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 2,
      patch: { chapters: updatedServerChapters },
    });

    // Local session (which started at revision 1) edits coverColor, but passes full stale chapters from base
    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        initialRevision: 1,
        debounceMs: 20,
      })
    );

    act(() => {
      result.current.updateLocalEdits({
        coverColor: '#059669',
        chapters: JSON.parse(JSON.stringify(testCourse.chapters)), // Full stale array identical to baseline!
      });
    });

    await waitFor(() => expect(result.current.status).toBe('saved'));

    const finalRecord = inMemoryStore.getStagedAdminEdits(testCourse.id, adminUser);
    expect(finalRecord?.clientRevision).toBe(3);
    expect(finalRecord?.patchedContent.coverColor).toBe('#059669');
    // Stale chapters did NOT overwrite the server's added lesson!
    expect(finalRecord?.patchedContent.chapters?.[0].items.some((i) => i.id === 'item_new_server_lesson')).toBe(true);
  });

  // 6. Overlapping conflict triggers ConflictResolutionModal
  it('opens ConflictResolutionModal when concurrent edits conflict on identical fields', async () => {
    // Server saves revision 2 editing title
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 2,
      patch: { title: 'عنوان معتمد على الخادم' },
    });

    // Local session with revision 1 also edits title to a different string
    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        initialRevision: 1,
        debounceMs: 20,
      })
    );

    act(() => {
      result.current.updateLocalEdits({ title: 'عنوان مختلف من المحرر المحلي' });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('conflict');
    });

    expect(result.current.isConflictModalOpen).toBe(true);
    expect(result.current.conflicts).toHaveLength(1);
    expect(result.current.conflicts[0].field).toBe('title');
    expect(result.current.conflicts[0].serverValue).toBe('عنوان معتمد على الخادم');
    expect(result.current.conflicts[0].localValue).toBe('عنوان مختلف من المحرر المحلي');
  });

  // 7. Resolving conflict with "Keep Local" overwrites server and increments revision
  it('resolves conflict with "Keep Local" overwriting server version with local edits at revision + 1', async () => {
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 2,
      patch: { title: 'عنوان الخادم' },
    });

    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        initialRevision: 1,
        debounceMs: 20,
      })
    );

    act(() => {
      result.current.updateLocalEdits({ title: 'عنواني المحلي المفضل' });
    });

    await waitFor(() => expect(result.current.status).toBe('conflict'));

    // User chooses "Keep Local"
    await act(async () => {
      await result.current.resolveConflict('keep_local');
    });

    await waitFor(() => expect(result.current.status).toBe('saved'));

    expect(result.current.clientRevision).toBe(3);
    const finalRecord = inMemoryStore.getStagedAdminEdits(testCourse.id, adminUser);
    expect(finalRecord?.clientRevision).toBe(3);
    expect(finalRecord?.patchedContent.title).toBe('عنواني المحلي المفضل');
  });

  // 8. Resolving conflict with "Accept Server" adopts server state and discards local edits
  it('resolves conflict with "Accept Server" adopting server state and clearing local conflicting edits', async () => {
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 2,
      patch: { title: 'عنوان الخادم المقبول' },
    });

    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        initialRevision: 1,
        debounceMs: 20,
      })
    );

    act(() => {
      result.current.updateLocalEdits({ title: 'عنوان محلي سيتم التراجع عنه' });
    });

    await waitFor(() => expect(result.current.status).toBe('conflict'));

    // User chooses "Accept Server"
    await act(async () => {
      await result.current.resolveConflict('accept_server');
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.clientRevision).toBe(2);
    expect(result.current.pendingPatch.title).toBe('عنوان الخادم المقبول');
    expect(result.current.isConflictModalOpen).toBe(false);
  });

  // 9. Resolving conflict with "Cancel" preserves server version and keeps local work in memory
  it('resolves conflict with "Cancel" preserving server state and retaining local edits in memory without committing', async () => {
    await reviewApi.saveStagedAdminEdits(testCourse.id, {
      baselineId: testCourse.id,
      baselineSubmittedAt: testCourse.submittedAt || '',
      clientRevision: 2,
      patch: { title: 'عنوان الخادم الثابت' },
    });

    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        initialRevision: 1,
        debounceMs: 20,
      })
    );

    act(() => {
      result.current.updateLocalEdits({ title: 'تعديل محلي قيد المراجعة اليدوية' });
    });

    await waitFor(() => expect(result.current.status).toBe('conflict'));

    // User chooses "Cancel for manual review"
    await act(async () => {
      await result.current.resolveConflict('cancel');
    });

    expect(result.current.isConflictModalOpen).toBe(false);
    expect(result.current.status).toBe('idle');
    // Local work is retained in memory in client editor!
    expect(result.current.pendingPatch.title).toBe('تعديل محلي قيد المراجعة اليدوية');

    // Server state remains strictly preserved at revision 2!
    const serverRecord = inMemoryStore.getStagedAdminEdits(testCourse.id, adminUser);
    expect(serverRecord?.clientRevision).toBe(2);
    expect(serverRecord?.patchedContent.title).toBe('عنوان الخادم الثابت');
  });

  // 10. Finite retry limit prevents infinite retry loops
  it('halts with error when retry limit is exceeded to prevent infinite retry loops', async () => {
    const { result } = renderHook(() =>
      useStagedEditsAutosave({
        courseId: testCourse.id,
        baselineCourse: testCourse,
        initialRevision: 1,
        debounceMs: 20,
        maxRetries: 2, // Set small retry limit
      })
    );

    // Mock saveStagedAdminEdits to always throw 409
    vi.spyOn(reviewApi, 'saveStagedAdminEdits').mockImplementation(async () => {
      throw new (await import('@/core/api/apiClient')).ApiError('Conflict', 409);
    });

    act(() => {
      result.current.updateLocalEdits({ title: 'تعديل يؤدي لتكرار التعارض' });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.error?.message).toContain('تعذر حل تعارض الحفظ تلقائياً');
    vi.restoreAllMocks();
  });

  // 11. ConflictResolutionModal component UI rendering and interaction tests
  it('renders ConflictResolutionModal with Arabic labels, values, and handles button clicks', () => {
    const onKeepLocal = vi.fn();
    const onAcceptServer = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConflictResolutionModal
        isOpen={true}
        serverRevision={4}
        conflicts={[
          {
            field: 'title',
            path: 'title',
            label: 'عنوان المقرر',
            baseValue: 'العنوان الأصلي',
            serverValue: 'عنوان الخادم المعتمد',
            localValue: 'تعديلاتي المحلية للعنوان',
          },
        ]}
        onKeepLocal={onKeepLocal}
        onAcceptServer={onAcceptServer}
        onCancel={onCancel}
      />
    );

    // Modal title & description
    expect(screen.getByTestId('conflict-modal-title')).toHaveTextContent('تعارض في التعديلات المتزامنة (409 Conflict)');
    expect(screen.getByText(/#4/)).toBeInTheDocument();

    // Field label and comparison values
    expect(screen.getByText('عنوان المقرر')).toBeInTheDocument();
    expect(screen.getByText('عنوان الخادم المعتمد')).toBeInTheDocument();
    expect(screen.getByText('تعديلاتي المحلية للعنوان')).toBeInTheDocument();

    // Click Choice 1: Keep local
    fireEvent.click(screen.getByTestId('conflict-keep-local-btn'));
    expect(onKeepLocal).toHaveBeenCalledTimes(1);

    // Click Choice 2: Accept server
    fireEvent.click(screen.getByTestId('conflict-accept-server-btn'));
    expect(onAcceptServer).toHaveBeenCalledTimes(1);

    // Click Choice 3: Cancel
    fireEvent.click(screen.getByTestId('conflict-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
