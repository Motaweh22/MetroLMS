import { http, HttpResponse } from 'msw';
import { inMemoryStore, MockStoreError } from '../store/inMemoryStore';
import { resolveAuthenticatedUser } from './resolveUser';
import type {
  AdminStagedEditPayload,
  ReviewDecisionRequestDTO,
  ReviewerWorkingNotes,
  ApproveCourseRequestDTO,
  ReturnCourseWithEditsRequestDTO,
  RejectCourseRequestDTO,
} from '@/core/courses/types';

// Helper error handler
function handleStoreError(err: unknown) {
  if (err instanceof MockStoreError) {
    return HttpResponse.json(
      { message: err.message, code: err.code },
      { status: err.status }
    );
  }
  return HttpResponse.json({ message: 'خطأ غير متوقع في الخادم' }, { status: 500 });
}

type HandlerParams = Record<string, string | readonly string[] | undefined>;

// ── Handler Implementations ──────────────────────────────────────────────

// 1. Submit course for review
const handleSubmitCourse = async ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لتقديم المقرر للمراجعة' },
      { status: 401 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const result = inMemoryStore.submitCourseForReview(courseId, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 2. Administrator deterministic FIFO review queue
const handleGetReviewQueue = ({ request }: { request: Request }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لعرض قائمة المراجعة والاعتماد' },
      { status: 401 }
    );
  }
  const isAdministrativeReader =
    user.role === 'developer' ||
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.role === 'assistant_admin';
  if (!isAdministrativeReader) {
    return HttpResponse.json(
      { message: 'غير مصرح لك بعرض قائمة المراجعة' },
      { status: 403 }
    );
  }

  try {
    const queue = inMemoryStore.getReviewQueue(user);
    return HttpResponse.json(queue, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 3. Lecturer submissions overview
const handleGetLecturerSubmissions = ({ request }: { request: Request }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لعرض المقررات المقدمة للمراجعة' },
      { status: 401 }
    );
  }

  try {
    const submissions = inMemoryStore.getLecturerSubmissions(user);
    return HttpResponse.json(submissions, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 4. Course review data
const handleGetReviewData = ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لعرض بيانات مراجعة المقرر' },
      { status: 401 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const data = inMemoryStore.getCourseReviewData(courseId, user);
    return HttpResponse.json(data, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

const handleGetAdminReviewData = ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لعرض بيانات مراجعة المقرر' },
      { status: 401 }
    );
  }
  const isAdministrativeReader =
    user.role === 'developer' ||
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.role === 'assistant_admin';
  if (!isAdministrativeReader) {
    return HttpResponse.json(
      { message: 'غير مصرح لك باستعراض بيانات مراجعة المقرر كمسؤول' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const data = inMemoryStore.getCourseReviewData(courseId, user);
    return HttpResponse.json(data, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 5. Fetch latest accepted staged edits & revision token
const handleGetStagedEdits = ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لعرض التعديلات المؤقتة' },
      { status: 401 }
    );
  }
  const isAdministrativeReader =
    user.role === 'developer' ||
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.role === 'assistant_admin';
  if (!isAdministrativeReader) {
    return HttpResponse.json(
      { message: 'غير مصرح لك بعرض التعديلات المؤقتة' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const record = inMemoryStore.getStagedAdminEdits(courseId, user);
    return HttpResponse.json({ record }, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 6. Autosave staged edits with 409 conflict detection
const handleSaveStagedEdits = async ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لحفظ التعديلات المؤقتة' },
      { status: 401 }
    );
  }
  const isOperationalAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isOperationalAdmin) {
    return HttpResponse.json(
      { message: 'غير مصرح لك بتعديل محتوى المقرر كمسؤول' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const payload = (await request.json()) as AdminStagedEditPayload;
    const result = inMemoryStore.saveStagedAdminEdits(courseId, payload, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 7. Explicitly discard staged edits
const handleDeleteStagedEdits = ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لحذف التعديلات المؤقتة' },
      { status: 401 }
    );
  }
  const isOperationalAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isOperationalAdmin) {
    return HttpResponse.json(
      { message: 'غير مصرح لك بحذف التعديلات المؤقتة كمسؤول' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const result = inMemoryStore.discardStagedAdminEdits(courseId, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 8. Fetch private reviewer working notes
const handleGetWorkingNotes = ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لعرض الملاحظات الخاصة بالمراجع' },
      { status: 401 }
    );
  }
  const isAdministrativeReader =
    user.role === 'developer' ||
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.role === 'assistant_admin';
  if (!isAdministrativeReader) {
    return HttpResponse.json(
      { message: 'غير مصرح لك بعرض الملاحظات الخاصة بالمراجعين' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const notes = inMemoryStore.getReviewerWorkingNotes(courseId, user);
    return HttpResponse.json(notes, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 9. Save private reviewer working notes
const handleSaveWorkingNotes = async ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لحفظ الملاحظات الخاصة بالمراجع' },
      { status: 401 }
    );
  }
  const isOperationalAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isOperationalAdmin) {
    return HttpResponse.json(
      { message: 'غير مصرح لك بحفظ الملاحظات الخاصة بالمراجعين' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const body = (await request.json()) as Partial<ReviewerWorkingNotes>;
    const result = inMemoryStore.saveReviewerWorkingNotes(courseId, body, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 10. Delete scoped reviewer working note
const handleDeleteWorkingNote = ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لحذف الملاحظات الخاصة بالمراجع' },
      { status: 401 }
    );
  }
  const isOperationalAdmin =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isOperationalAdmin) {
    return HttpResponse.json(
      { message: 'غير مصرح لك بحذف الملاحظات الخاصة بالمراجعين' },
      { status: 403 }
    );
  }

  const { courseId, targetType, targetId } = params as {
    courseId: string;
    targetType: string;
    targetId: string;
  };
  try {
    const result = inMemoryStore.deleteReviewerWorkingNote(courseId, targetType, targetId, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 11. Unified review decision
const handleExecuteDecision = async ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لاتخاذ قرار المراجعة' },
      { status: 401 }
    );
  }
  const isDecisionMaker =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isDecisionMaker) {
    return HttpResponse.json(
      { message: 'غير مصرح لك باتخاذ قرار المراجعة' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    const body = (await request.json()) as ReviewDecisionRequestDTO;
    const result = inMemoryStore.executeReviewDecision(courseId, body, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 12. Dedicated Approve endpoint
const handleApprove = async ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لاتخاذ قرار المراجعة' },
      { status: 401 }
    );
  }
  const isDecisionMaker =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isDecisionMaker) {
    return HttpResponse.json(
      { message: 'غير مصرح لك باتخاذ قرار المراجعة' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    let body: ApproveCourseRequestDTO = {};
    try {
      body = (await request.json()) as ApproveCourseRequestDTO;
    } catch {
      // Body may be empty
    }
    const decision: ReviewDecisionRequestDTO = {
      outcome: 'approved',
      publishOption:
        body?.publishOption === 'with_staged_edits' ? 'with_staged_edits' : 'submitted_baseline',
      approvalNote: body?.approvalNote,
    };
    const result = inMemoryStore.executeReviewDecision(courseId, decision, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 13. Dedicated Return With Edits endpoint
const handleReturnWithEdits = async ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لاتخاذ قرار المراجعة' },
      { status: 401 }
    );
  }
  const isDecisionMaker =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isDecisionMaker) {
    return HttpResponse.json(
      { message: 'غير مصرح لك باتخاذ قرار المراجعة' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    let body: ReturnCourseWithEditsRequestDTO = {};
    try {
      body = (await request.json()) as ReturnCourseWithEditsRequestDTO;
    } catch {
      // Body may be empty
    }
    const summaryMessage = body?.summaryMessage || body?.feedback || '';
    const decision: ReviewDecisionRequestDTO = {
      outcome: 'returned_with_admin_edits',
      summaryMessage,
      items: body?.items || [],
    };
    const result = inMemoryStore.executeReviewDecision(courseId, decision, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

// 14. Dedicated Reject endpoint
const handleReject = async ({ request, params }: { request: Request; params: HandlerParams }) => {
  const user = resolveAuthenticatedUser(request);
  if (!user) {
    return HttpResponse.json(
      { message: 'يجب تسجيل الدخول لاتخاذ قرار المراجعة' },
      { status: 401 }
    );
  }
  const isDecisionMaker =
    user.role === 'admin' || user.role === 'super_admin' || user.role === 'developer';
  if (!isDecisionMaker) {
    return HttpResponse.json(
      { message: 'غير مصرح لك باتخاذ قرار المراجعة' },
      { status: 403 }
    );
  }

  const { courseId } = params as { courseId: string };
  try {
    let body: RejectCourseRequestDTO = {};
    try {
      body = (await request.json()) as RejectCourseRequestDTO;
    } catch {
      // Body may be empty
    }
    const summaryMessage = body?.summaryMessage || body?.feedback || '';
    const decision: ReviewDecisionRequestDTO = {
      outcome: 'rejected',
      summaryMessage,
      items: body?.items || [],
    };
    const result = inMemoryStore.executeReviewDecision(courseId, decision, user);
    return HttpResponse.json(result, { status: 200 });
  } catch (err) {
    return handleStoreError(err);
  }
};

/**
 * MSW v2 REST Interceptors for Increment 9: Review & Quality Audit Workflow
 *
 * Exposes canonical routes, agreed route aliases, dedicated decision endpoints,
 * and scoped deletion endpoints while delegating to the unified store.
 */
export const reviewHandlers = [
  // ── 1. Submission Endpoints ──
  http.post('/api/courses/:courseId/submit', handleSubmitCourse),
  http.post('/api/courses/:courseId/submit-review', handleSubmitCourse),

  // ── 2. Admin Review Queue ──
  http.get('/api/approvals/queue', handleGetReviewQueue),
  http.get('/api/admin/approvals', handleGetReviewQueue),

  // ── 3. Lecturer Submissions Overview ──
  http.get('/api/approvals/my-submissions', handleGetLecturerSubmissions),
  http.get('/api/lecturer/approvals', handleGetLecturerSubmissions),

  // ── 4. Authoritative Course Review Data ──
  http.get('/api/courses/:courseId/review-data', handleGetReviewData),
  http.get('/api/admin/courses/:courseId/review', handleGetAdminReviewData),
  http.get('/api/admin/review/:courseId', handleGetAdminReviewData),

  // ── 5. Staged Admin Edits (Fetch, Save, Discard) ──
  http.get('/api/admin/review/:courseId/staged-edits', handleGetStagedEdits),
  http.get('/api/admin/courses/:courseId/staged-edits', handleGetStagedEdits),

  http.put('/api/admin/review/:courseId/staged-edits', handleSaveStagedEdits),
  http.put('/api/admin/courses/:courseId/staged-edits', handleSaveStagedEdits),

  http.delete('/api/admin/review/:courseId/staged-edits', handleDeleteStagedEdits),
  http.delete('/api/admin/courses/:courseId/staged-edits', handleDeleteStagedEdits),

  // ── 6. Scoped Private Reviewer Working Notes ──
  http.get('/api/admin/review/:courseId/working-notes', handleGetWorkingNotes),
  http.get('/api/admin/courses/:courseId/working-notes', handleGetWorkingNotes),

  http.put('/api/admin/review/:courseId/working-notes', handleSaveWorkingNotes),
  http.put('/api/admin/courses/:courseId/working-notes', handleSaveWorkingNotes),

  http.delete('/api/admin/review/:courseId/working-notes/:targetType/:targetId', handleDeleteWorkingNote),
  http.delete('/api/admin/courses/:courseId/working-notes/:targetType/:targetId', handleDeleteWorkingNote),

  // ── 7. Review Decisions (Unified & Dedicated) ──
  http.post('/api/admin/review/:courseId/decision', handleExecuteDecision),
  http.post('/api/admin/courses/:courseId/decision', handleExecuteDecision),

  http.post('/api/admin/review/:courseId/approve', handleApprove),
  http.post('/api/admin/courses/:courseId/approve', handleApprove),

  http.post('/api/admin/review/:courseId/return-with-edits', handleReturnWithEdits),
  http.post('/api/admin/courses/:courseId/return-with-edits', handleReturnWithEdits),

  http.post('/api/admin/review/:courseId/reject', handleReject),
  http.post('/api/admin/courses/:courseId/reject', handleReject),
];
