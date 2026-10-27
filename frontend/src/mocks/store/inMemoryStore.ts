import { MOCK_COURSES } from '../fixtures/mockCourses';
import { INITIAL_MOCK_ENROLLMENTS } from '../fixtures/mockEnrollments';
import { INITIAL_MOCK_GROUPS } from '../fixtures/mockGroups';
import { INITIAL_MOCK_NOTIFICATIONS } from '../fixtures/mockNotifications';
import {
  createInitialContentLabFixture,
  CONTENT_TEST_LAB_COURSE_ID,
} from '../fixtures/contentLabFixture';
import { createReviewDemoFixtures } from '../fixtures/reviewDemoCourses';
import { createTrainingGroupsDemoFixtures } from '../fixtures/trainingGroupsDemoFixtures';
import type {
  ChapterItem,
  Course,
  CourseEnrollment,
  CourseFilterParams,
  CourseStatus,
  CourseAuditAction,
  CourseAuditLogEntry,
  CourseActiveReviewFeedback,
  CourseBaselineSnapshot,
  ReviewerWorkingNotes,
  AdminStagedEditPayload,
  StagedAdminEditsRecord,
  SubmitCourseResponseDTO,
  ReviewQueueItemDTO,
  ReviewQueueResponseDTO,
  ReviewDecisionRequestDTO,
  ReviewDecisionResponseDTO,
  StagedEditsSaveResponseDTO,
  CourseReviewDataResponseDTO,
  LecturerSubmissionItemDTO,
  LecturerSubmissionsResponseDTO,
  DiscardStagedEditsResponseDTO,
  EnrollmentResponse,
} from '@/core/courses/types';
import type { LessonProgress, CourseProgress } from '@/features/learning-player/types';
import type { User, UserRole } from '@/core/auth/types';
import { calculateTraineeProgress, isLessonLocked } from '@/core/domain/progress';
import { isUserAuthorizedCourseInstructor } from '@/core/courses/courseAuthorization';
import {
  getEffectiveCourseSettings,
  checkTraineeAttention,
  formatRemainingTime,
  validateDateRange,
  validateCycleCourseAssignments,
  createCourseAttempt,
  isAttemptStarted,
  isAttemptCompleted,
  startCourseAttempt,
  calculateCourseAttemptStats,
  resolveMaterialFileType,
  validateMaterialUpload,
  calculateNextRenewalDate,
  migrateLegacyRecurrenceType,
} from '@/core/domain/groups';
import type {
  TrainingGroup,
  GroupMetrics,
  TraineeAttentionResult,
  CourseRole,
  GroupCycleCourseAssignment,
  GroupRenewalCycle,
  CourseAttempt,
  TraineeCourseAttemptStats,
  GroupMaterialFolder,
  GroupMaterialFile,
  GroupMember,
  GroupJoinRequest,
  TraineeCourseProgressInGroup,
  TraineeGroupMetrics,
  CohortSummaryMetrics,
  AssignedCourseProgressMetric,
} from '@/core/groups/types';
import type {
  CreateGroupRequestDTO,
  UpdateGroupRequestDTO,
  AssignCycleCoursesDTO,
  RenewGroupCycleRequestDTO,
  JoinGroupQRResponseDTO,
  RotateGroupQRCodeResponseDTO,
  GroupSummaryDTO,
  ReviewJoinRequestDTO,
  CreateMaterialFolderDTO,
  CandidateTraineeDTO,
} from '@/core/groups/dtos';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type {
  ManagedUserDTO,
  UserFilterParams,
  CreateUserRequestDTO,
  UserStatus,
  UserTranscriptDTO,
  UserTranscriptCourseItem,
} from '@/core/user-management/types';
import { INITIAL_MANAGED_USERS, resolveCanonicalUserId } from '../fixtures/userDirectoryFixtures';
import type { NotificationItem } from '@/core/notifications/types';
import type {
  DashboardData,
  TraineeContinueLearningCard,
  TraineeUpcomingSession,
} from '@/core/dashboard/types';
import type {
  RolePermissionsConfig,
  UserPermissionOverride,
  ApprovalRequest,
  PermissionKey,
  SystemCapability,
  PermissionCheckResult,
  EvaluationContext,
  GroupAssistantAssignment,
  SystemAuditLogEntryDTO,
  AuditFilterParams,
  AuditLogResponseDTO,
  CanonicalDepartmentDTO,
  CanonicalTrackDTO,
  DepartmentPermissionDTO,
} from '@/core/permissions/types';
import {
  CANONICAL_DEPARTMENTS,
  CANONICAL_TRACKS,
  INITIAL_DEPARTMENT_TRACKS,
  resolveCanonicalDepartment,
  resolveCanonicalTrack,
} from '../fixtures/departmentTracksFixtures';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';
import { INITIAL_SECURITY_AUDIT_LOGS } from '../fixtures/securityAuditFixtures';
import {
  evaluatePermission,
  evaluateProtectedInvariant,
  validatePermissionOverride,
  ROLE_DEFAULT_CAPABILITIES,
  ROLE_CAPABILITY_CEILINGS,
  validateAdminGovernanceIntegrity,
} from '@/core/permissions/policy';
import type {
  CourseComment,
  CommentModerationSummaryDTO,
  CreateCommentRequestDTO,
  ReportCommentRequestDTO,
  CommentFilterParams,
} from '@/core/comments/types';
import { COMMENT_REPORT_REASONS_AR } from '@/core/comments/types';
import { INITIAL_COURSE_COMMENTS } from '../fixtures/commentsFixtures';
import type {
  CoursePerformanceReportDTO,
  TraineePerformanceDTO,
} from '@/core/performance/types';
import {
  cleanPhoneNumber,
  buildWhatsAppUrl,
  buildLecturerReminderMessage,
} from '@/features/whatsapp/utils/whatsappUtils';

export class MockStoreError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'MockStoreError';
    this.status = status;
    this.code = code;
  }
}

export const DEV_TEST_MEDIA = {
  video: {
    url: '/dev-media/test-video.mp4',
    duration: '01:39',
    durationSeconds: 99,
  },
  pdf: {
    url: '/dev-media/test-document.pdf',
    pages: 6,
  },
} as const;

export const DEV_TEST_MEDIA_URLS = {
  video: DEV_TEST_MEDIA.video.url,
  pdf: DEV_TEST_MEDIA.pdf.url,
} as const;

/**
 * Stateful In-Memory Mock Store
 * 
 * Provides an isolated, mutable repository for mock data (courses, enrollments, progress,
 * groups, and notifications) supporting reads and mutations during user sessions and automated Vitest runs.
 */
class InMemoryStore {
  private courses: Course[] = [];
  private enrollments: CourseEnrollment[] = [];
  private userProgress: Record<string, Record<string, Record<string, LessonProgress>>> = {};
  private lastWatched: Record<string, Record<string, string>> = {};
  private groups: TrainingGroup[] = [];
  private notifications: NotificationItem[] = [];
  private courseDrafts: Record<string, Course> = {};
  private stagedAdminEdits: Record<string, StagedAdminEditsRecord> = {};
  private reviewerWorkingNotes: Record<string, ReviewerWorkingNotes> = {};
  // Increment 10 Training Groups State Collections
  private renewalCycles: GroupRenewalCycle[] = [];
  private courseAttempts: CourseAttempt[] = [];
  private groupMembers: Record<string, GroupMember[]> = {};
  private groupJoinRequests: GroupJoinRequest[] = [];
  private materialFolders: GroupMaterialFolder[] = [];
  private materialFiles: GroupMaterialFile[] = [];
  // Increment 11 Central Users Directory
  private users: ManagedUserDTO[] = [];
  // Increment 11 Credential separation: credentials are kept isolated from ManagedUserDTO
  private mockUserCredentials: Record<string, string> = {};
  // Increment 11 Phase 4: Permissions & Governance Ledgers
  private rolePermissionConfigs: Partial<Record<UserRole, RolePermissionsConfig>> = {};
  private userPermissionOverrides: Record<string, UserPermissionOverride> = {};
  private delegatedOperationalAuthority: Record<string, boolean> = {};
  private approvalRequests: ApprovalRequest[] = [];
  private groupAssistantAssignments: GroupAssistantAssignment[] = [];
  // Increment 11 Phase 4D: System Security Audit Trail Ledger
  private systemAuditLogs: SystemAuditLogEntryDTO[] = [];
  private auditIdCounter = 1000;
  // Increment 11 Phase 4E: Department Course-Track Mappings
  private departmentTracks: Record<string, DepartmentPermissionDTO> = {};
  // Increment 11 Phase 5A: Comments & Discussion Moderation
  private courseComments: CourseComment[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Helper to resolve synthetic user metadata for member/request records.
   */
  private resolveMockUserMeta(userId: string): {
    name: string;
    email: string;
    department?: string;
    jobTitle?: string;
  } {
    const user = this.getManagedUserById(userId);
    if (user) {
      return {
        name: user.name,
        email: user.email,
        department: user.department,
        jobTitle: user.jobTitle,
      };
    }

    const account = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
      (acc) => acc.user.id.toLowerCase() === userId.toLowerCase()
    );
    if (account) {
      return {
        name: account.user.name,
        email: account.user.email,
        department: account.user.department,
        jobTitle: account.user.jobTitle,
      };
    }

    return {
      name: userId,
      email: `${userId.toLowerCase()}@cairo-metro.com`,
      department: 'قطاع التشغيل والصيانة',
      jobTitle: 'فني تشغيل ميداني',
    };
  }

  /**
   * Reset the store to initial fixture state.
   * Useful for test isolation between test cases.
   */
  public reset(options?: { seedReviewDemo?: boolean; seedGroupDemo?: boolean }): void {
    const shouldSeedReviewDemo = options?.seedReviewDemo ?? true;
    const shouldSeedGroupDemo = options?.seedGroupDemo ?? false;
    this.courses = JSON.parse(JSON.stringify(MOCK_COURSES));

    this.enrollments = JSON.parse(JSON.stringify(INITIAL_MOCK_ENROLLMENTS));
    this.groups = JSON.parse(JSON.stringify(INITIAL_MOCK_GROUPS));
    this.notifications = JSON.parse(JSON.stringify(INITIAL_MOCK_NOTIFICATIONS));
    this.userProgress = {};
    this.lastWatched = {};
    this.courseDrafts = {};
    this.stagedAdminEdits = {};
    this.reviewerWorkingNotes = {};
    this.users = JSON.parse(JSON.stringify(INITIAL_MANAGED_USERS));
    this.mockUserCredentials = {};
    for (const acc of Object.values(SYNTHETIC_DEMO_ACCOUNTS)) {
      this.mockUserCredentials[acc.credentials.email.toLowerCase()] = acc.credentials.password;
      this.mockUserCredentials[acc.user.id.toLowerCase()] = acc.credentials.password;
      if (acc.user.id === 'usr_admin_001') this.mockUserCredentials['admin_demo'] = acc.credentials.password;
      if (acc.user.id === 'usr_lect_002') this.mockUserCredentials['lecturer_demo'] = acc.credentials.password;
      if (acc.user.id === 'usr_trainee_003') this.mockUserCredentials['trainee_demo'] = acc.credentials.password;
      if (acc.user.id === 'USR016') this.mockUserCredentials['assistant_admin_demo'] = acc.credentials.password;
      if (acc.user.id === 'USR017') this.mockUserCredentials['assistant_lecturer_demo'] = acc.credentials.password;
    }

    // Increment 11 Phase 4: Reset Permissions & Governance Ledgers
    this.rolePermissionConfigs = {};
    this.userPermissionOverrides = {};
    this.delegatedOperationalAuthority = {};
    this.approvalRequests = [];
    this.groupAssistantAssignments = [];
    // Increment 11 Phase 4D: Reset Security Audit Trail Ledger
    this.systemAuditLogs = JSON.parse(JSON.stringify(INITIAL_SECURITY_AUDIT_LOGS));
    this.auditIdCounter = 1000 + this.systemAuditLogs.length;
    // Increment 11 Phase 4E: Reset Department Course Tracks Configuration
    this.departmentTracks = JSON.parse(JSON.stringify(INITIAL_DEPARTMENT_TRACKS));
    // Increment 11 Phase 5A: Reset Course Comments Collection
    this.courseComments = JSON.parse(JSON.stringify(INITIAL_COURSE_COMMENTS));
    for (const course of this.courses) {
      if (course.commentsEnabled === undefined) {
        course.commentsEnabled = true;
      }
    }

    // Increment 10: Reset Training Groups, Cycles, Attempts, Members, Requests & Materials
    this.renewalCycles = [];
    this.courseAttempts = [];
    this.groupMembers = {};
    this.groupJoinRequests = [];
    this.materialFolders = [];
    this.materialFiles = [];

    // Initialize baseline groups with Increment 10 contracts and Cycle 1
    for (const group of this.groups) {
      if (!group.adminStatus) group.adminStatus = 'active';
      if (!group.enrollmentPolicy) group.enrollmentPolicy = 'open';
      if (!group.enrollmentCode) group.enrollmentCode = `${group.id}-SEC-DEMO`;
      if (group.isEnrollmentOpen === undefined) group.isEnrollmentOpen = true;
      if (!group.renewalSchedule) {
        group.renewalSchedule = {
          recurrenceType: 'bimonthly',
          intervalDays: 60,
          renewalIntervalDays: 60,
          autoRenewalEnabled: false,
          lastAutoRenewedCycleId: null,
        };
      } else {
        group.renewalSchedule = migrateLegacyRecurrenceType(group.renewalSchedule);
      }

      const cycle1Id = `CYC-${group.id}-01`;
      group.currentCycleId = cycle1Id;

      const cycleCourses: GroupCycleCourseAssignment[] = (group.courses || []).map((c, idx) => ({
        courseId: c.courseId,
        courseRole: idx === 0 ? 'core' : 'reminder',
        order: c.order || idx + 1,
        customStartDateTime: c.customStartDateTime,
        customDeadlineDateTime: c.customDeadlineDateTime,
        customPostDeadlinePolicy: c.customPostDeadlinePolicy,
      }));

      const cycle1: GroupRenewalCycle = {
        id: cycle1Id,
        groupId: group.id,
        cycleNumber: 1,
        title: `${group.name} — دورة التدريب الافتتاحية`,
        status: 'active',
        startDateTime: group.startDateTime,
        deadlineDateTime: group.deadlineDateTime,
        postDeadlinePolicy: group.postDeadlinePolicy,
        courses: cycleCourses,
        traineeIds: [...(group.traineeIds || [])],
        createdAt: group.createdAt || new Date().toISOString(),
        updatedAt: group.updatedAt || new Date().toISOString(),
      };
      this.renewalCycles.push(cycle1);

      // Seed group members
      this.groupMembers[group.id] = (group.traineeIds || []).map((tid) => {
        const meta = this.resolveMockUserMeta(tid);
        return {
          userId: tid,
          name: meta.name,
          email: meta.email,
          department: meta.department,
          jobTitle: meta.jobTitle,
          joinedAt: group.createdAt || new Date().toISOString(),
          joinSource: 'admin_assigned',
        };
      });

      // Provision baseline attempts for group members
      for (const tid of group.traineeIds || []) {
        for (const c of cycleCourses) {
          const attemptId = `ATT-${tid}-${c.courseId}-${cycle1.id}`;
          const attempt = createCourseAttempt({
            id: attemptId,
            userId: tid,
            courseId: c.courseId,
            cycleId: cycle1.id,
            groupId: group.id,
            courseRole: c.courseRole,
            createdAt: group.createdAt || new Date().toISOString(),
          });
          this.courseAttempts.push(attempt);
        }
      }

      // Seed baseline materials folders and files for GRP-101
      if (group.id === 'GRP-101') {
        const fld1Id = `FLD-${group.id}-01`;
        const fld2Id = `FLD-${group.id}-02`;

        this.materialFolders.push({
          id: fld1Id,
          groupId: group.id,
          cycleId: cycle1.id,
          name: 'دليل التدريب واللوائح المعتمدة',
          order: 1,
          isVisibleToTrainees: true,
          filesCount: 2,
          createdAt: group.createdAt || new Date().toISOString(),
          updatedAt: group.updatedAt || new Date().toISOString(),
        });

        this.materialFolders.push({
          id: fld2Id,
          groupId: group.id,
          cycleId: cycle1.id,
          name: 'نماذج الفحص الدوري والميداني',
          order: 2,
          isVisibleToTrainees: true,
          filesCount: 1,
          createdAt: group.createdAt || new Date().toISOString(),
          updatedAt: group.updatedAt || new Date().toISOString(),
        });

        this.materialFiles.push({
          id: `FIL-${group.id}-001`,
          folderId: fld1Id,
          groupId: group.id,
          cycleId: cycle1.id,
          title: 'دليل إجراءات الطوارئ والسلامة المعتمد',
          originalFileName: 'test-document.pdf',
          fileSizeBytes: 2048576,
          mimeType: 'application/pdf',
          fileType: 'pdf',
          url: '/dev-media/test-document.pdf',
          order: 1,
          uploadedBy: 'usr_lect_002',
          uploadedByName: 'د. طارق الجوهري',
          uploadedAt: group.createdAt || new Date().toISOString(),
          isVisible: true,
          downloadCount: 4,
        });

        this.materialFiles.push({
          id: `FIL-${group.id}-002`,
          folderId: fld1Id,
          groupId: group.id,
          cycleId: cycle1.id,
          title: 'شعار وهيكل منظومة تشغيل المترو',
          originalFileName: 'metro-emblem.png',
          fileSizeBytes: 524288,
          mimeType: 'image/png',
          fileType: 'image',
          url: '/src/assets/brand/Geometric%20Metro%20Star%20Emblem%20logo.png',
          order: 2,
          uploadedBy: 'usr_lect_002',
          uploadedByName: 'د. طارق الجوهري',
          uploadedAt: group.createdAt || new Date().toISOString(),
          isVisible: true,
          downloadCount: 2,
        });

        this.materialFiles.push({
          id: `FIL-${group.id}-003`,
          folderId: fld2Id,
          groupId: group.id,
          cycleId: cycle1.id,
          title: 'نموذج استلام القطار اليومي',
          originalFileName: 'daily-train-inspection.docx',
          fileSizeBytes: 1048576,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileType: 'word',
          url: '/dev-media/materials/daily-train-inspection.docx',
          order: 1,
          uploadedBy: 'usr_admin_001',
          uploadedByName: 'م. أحمد محمود',
          uploadedAt: group.createdAt || new Date().toISOString(),
          isVisible: true,
          downloadCount: 1,
        });

        group.foldersCount = 2;
        group.filesCount = 3;
      }
    }

    // Register or restore Content Testing Lab Course fixture
    const labCourse = createInitialContentLabFixture();
    this.courses.push(labCourse);

    // Seed Increment 9 Review Workflow Demo Courses (Deterministic & Idempotent)
    if (shouldSeedReviewDemo) {
      const reviewDemoData = createReviewDemoFixtures();
      for (const c of reviewDemoData.courses) {
        this.courses.push(c);
      }
      for (const [id, draft] of Object.entries(reviewDemoData.drafts)) {
        this.courseDrafts[id] = draft;
      }
      for (const [id, staged] of Object.entries(reviewDemoData.stagedEdits)) {
        this.stagedAdminEdits[id] = staged;
      }
    }

    // Seed Increment 10 Training Groups Demo Cohorts
    if (shouldSeedGroupDemo) {
      this.seedIncrement10DemoFixtures();
    }

    // In development mode, map local test media files and accurate metadata to existing items across all courses
    if (import.meta.env.DEV) {
      for (const course of this.courses) {
        for (const chapter of course.chapters) {
          for (const item of chapter.items) {
            if (item.type === 'video' && item.videoSourceType !== 'youtube' && item.videoSourceType !== 'drive') {
              item.url = DEV_TEST_MEDIA.video.url;
              item.duration = DEV_TEST_MEDIA.video.duration;
            } else if (item.type === 'pdf') {
              item.url = DEV_TEST_MEDIA.pdf.url;
              item.pages = DEV_TEST_MEDIA.pdf.pages;
            }
          }
        }
      }
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('metro_admin_staged_edits_') || key.startsWith('metro_reviewer_notes_'))
          ) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }
      } catch {
        // ignore storage errors
      }

      const persistedLab = localStorage.getItem('metro_lms_lab_course_state');
      if (persistedLab) {
        try {
          const parsed = JSON.parse(persistedLab);
          if (parsed && parsed.id === CONTENT_TEST_LAB_COURSE_ID) {
            this.courseDrafts[CONTENT_TEST_LAB_COURSE_ID] = parsed;
            labCourse.hasDraftChanges = true;
          }
        } catch {
          // ignore error
        }
      }
    }
  }

  /**
   * Seed rich Increment 10 demo fixtures for manual UI review and audit:
   * 1. Multi-cycle training group (GRP-201) with sealed Cycle 1 and active Cycle 2 (Core + Reminder courses).
   * 2. Trainee repeating a course across renewal cycles with Attempt #2 badge and preserved Cycle 1 history.
   * 3. Group with pending applicant join request for review.
   * 4. Group with organized material library folders and multi-format files.
   * 5. Scheduled training group (GRP-202) accepting pre-training enrollments via open QR policy.
   */
  public seedIncrement10DemoFixtures(): void {
    const demo = createTrainingGroupsDemoFixtures();

    // Idempotently add or update demo groups
    for (const group of demo.groups) {
      const idx = this.groups.findIndex((g) => g.id === group.id);
      if (idx >= 0) {
        this.groups[idx] = group;
      } else {
        this.groups.push(group);
      }
    }

    // Add renewal cycles
    for (const cycle of demo.renewalCycles) {
      const idx = this.renewalCycles.findIndex((c) => c.id === cycle.id);
      if (idx >= 0) {
        this.renewalCycles[idx] = cycle;
      } else {
        this.renewalCycles.push(cycle);
      }
    }

    // Add course attempts
    for (const att of demo.courseAttempts) {
      const idx = this.courseAttempts.findIndex((a) => a.id === att.id);
      if (idx >= 0) {
        this.courseAttempts[idx] = att;
      } else {
        this.courseAttempts.push(att);
      }
    }

    // Add group members
    for (const [gid, members] of Object.entries(demo.groupMembers)) {
      this.groupMembers[gid] = [...members];
    }

    // Add join requests
    for (const req of demo.joinRequests) {
      const idx = this.groupJoinRequests.findIndex((r) => r.id === req.id);
      if (idx >= 0) {
        this.groupJoinRequests[idx] = req;
      } else {
        this.groupJoinRequests.push(req);
      }
    }

    // Add material folders
    for (const folder of demo.materialFolders) {
      const idx = this.materialFolders.findIndex((f) => f.id === folder.id);
      if (idx >= 0) {
        this.materialFolders[idx] = folder;
      } else {
        this.materialFolders.push(folder);
      }
    }

    // Add material files
    for (const file of demo.materialFiles) {
      const idx = this.materialFiles.findIndex((f) => f.id === file.id);
      if (idx >= 0) {
        this.materialFiles[idx] = file;
      } else {
        this.materialFiles.push(file);
      }
    }
  }

  /**
   * Query published courses with optional filtering and sorting
   * Excludes test lab demo course from the public catalog.
   */
  public getCourses(params?: CourseFilterParams): Course[] {
    let results: Course[] = this.courses.filter(
      (c) => (c.status === 'published' || c.status === 'live') && !c.isTestLab
    );

    if (params?.level && params.level !== 'all') {
      results = results.filter((c) => c.level === params.level);
    }

    if (params?.search) {
      const q = params.search.trim().toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.lecturerName.toLowerCase().includes(q)
      );
    }

    if (params?.sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else if (params?.sortBy === 'enrollment') {
      results.sort((a, b) => b.enrollmentCount - a.enrollmentCount);
    } else if (params?.sortBy === 'newest') {
      results.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }

    return results;
  }

  /**
   * Get single course by ID
   */
  public getCourseById(courseId: string): Course | undefined {
    return this.courses.find(
      (c) => c.id.toLowerCase() === courseId.trim().toLowerCase()
    );
  }

  /**
   * Returns a flattened list of all lesson items across all chapters of a course.
   */
  public getCourseItems(courseId: string): ChapterItem[] {
    const course = this.getCourseById(courseId);
    if (!course) return [];
    const items: ChapterItem[] = [];
    for (const ch of course.chapters) {
      for (const item of ch.items) {
        items.push(item);
      }
    }
    return items;
  }

  /**
   * Get all enrollments for a specific user
   */
  public getUserEnrollments(userId: string): CourseEnrollment[] {
    return this.enrollments.filter(
      (e) => e.userId.toLowerCase() === userId.trim().toLowerCase()
    );
  }

  /**
   * Alias for getUserEnrollments
   */
  public getTraineeEnrollments(userId: string): CourseEnrollment[] {
    return this.getUserEnrollments(userId);
  }

  /**
   * Get user's enrollment for a specific course
   */
  public getCourseEnrollment(courseId: string, userId: string): CourseEnrollment | undefined {
    return this.enrollments.find(
      (e) =>
        e.courseId.toLowerCase() === courseId.trim().toLowerCase() &&
        e.userId.toLowerCase() === userId.trim().toLowerCase()
    );
  }

  /**
   * Execute course enrollment mutation
   */
  public enrollUser({
    courseId,
    userId,
    userRole,
  }: {
    courseId: string;
    userId: string;
    userRole?: string;
  }): EnrollmentResponse {
    const course = this.getCourseById(courseId);
    if (!course) {
      throw new MockStoreError('الدورة التدريبية غير موجودة', 404);
    }

    if (course.isTestLab) {
      throw new MockStoreError(
        'عذراً، هذا المقرر مخصص كمعمل تجريبي للمحاضرين فقط ولا يقبل تسجيل المتدربين.',
        403
      );
    }

    if (userRole && userRole !== 'user') {
      throw new MockStoreError(
        'عذراً، التسجيل في الدورات متاح فقط لحسابات المتدربين. حسابات الإدارة والمحاضرين للمعاينة فقط.',
        403
      );
    }

    // Check duplicate enrollment
    const existing = this.getCourseEnrollment(course.id, userId);
    if (existing) {
      throw new MockStoreError('أنت مسجل بالفعل في هذه الدورة التدريبية', 409);
    }

    // Create unique enrollment record
    const enrollment: CourseEnrollment = {
      id: `ENR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      courseId: course.id,
      userId,
      enrolledAt: new Date().toISOString(),
      status: 'active',
    };

    this.enrollments.push(enrollment);

    // Atomically increment aggregate enrollmentCount on the course
    course.enrollmentCount = (course.enrollmentCount || 0) + 1;

    return {
      enrollment,
      course,
      message: 'تم التسجيل في الدورة التدريبية بنجاح!',
    };
  }

  /**
   * Retrieves overall progress for a user in a specific course.
   */
  public getCourseProgress(userId: string, courseId: string): CourseProgress {
    const course = this.getCourseById(courseId);
    if (!course) {
      throw new MockStoreError('الدورة التدريبية غير موجودة', 404);
    }

    const flatItems = this.getCourseItems(courseId);
    const normalizedUserId = userId.toLowerCase().trim();
    const normalizedCourseId = course.id.toLowerCase().trim();

    const userCourseProgress = this.userProgress[normalizedUserId]?.[normalizedCourseId] || {};
    const completedItemIds = flatItems
      .filter((it) => userCourseProgress[it.id]?.completed)
      .map((it) => it.id);

    const progressPercent = calculateTraineeProgress(flatItems.length, completedItemIds.length);
    const isCompleted = flatItems.length > 0 && completedItemIds.length === flatItems.length;
    const lastWatchedItemId = this.lastWatched[normalizedUserId]?.[normalizedCourseId] || null;

    return {
      courseId: course.id,
      userId,
      progressPercent,
      completedItemIds,
      lastWatchedItemId,
      isCompleted,
      updatedAt: new Date().toISOString(),
      itemsProgress: userCourseProgress,
    };
  }

  /**
   * Records playback time, furthest watched range, or document open activity.
   * If the user is an admin or lecturer (preview mode), this is a no-op that preserves trainee state.
   */
  public recordLessonActivity({
    userId,
    courseId,
    itemId,
    activity,
    userRole,
  }: {
    userId: string;
    courseId: string;
    itemId: string;
    activity: Partial<LessonProgress>;
    userRole?: UserRole;
  }): LessonProgress {
    const course = this.getCourseById(courseId);
    if (!course) {
      throw new MockStoreError('الدورة التدريبية غير موجودة', 404);
    }

    const flatItems = this.getCourseItems(courseId);
    const item = flatItems.find((it) => it.id === itemId);
    if (!item) {
      throw new MockStoreError('الدرس غير موجود في هذه الدورة التدريبية', 404);
    }

    // Preview isolation: Lecturers and admins preview without mutating trainee records
    if (userRole === 'admin' || userRole === 'lecturer') {
      return {
        itemId,
        completed: false,
        lastPositionSeconds: activity.lastPositionSeconds ?? 0,
        furthestWatchedSeconds: activity.furthestWatchedSeconds ?? 0,
        eligibleViewingSeconds: activity.eligibleViewingSeconds ?? 0,
        durationSeconds: activity.durationSeconds,
        updatedAt: new Date().toISOString(),
      };
    }

    const normalizedUserId = userId.toLowerCase().trim();
    const normalizedCourseId = course.id.toLowerCase().trim();

    if (!this.userProgress[normalizedUserId]) {
      this.userProgress[normalizedUserId] = {};
    }
    if (!this.userProgress[normalizedUserId][normalizedCourseId]) {
      this.userProgress[normalizedUserId][normalizedCourseId] = {};
    }

    const existing = this.userProgress[normalizedUserId][normalizedCourseId][itemId] || {
      itemId,
      completed: false,
      lastPositionSeconds: 0,
      furthestWatchedSeconds: 0,
      eligibleViewingSeconds: 0,
      updatedAt: new Date().toISOString(),
    };

    const updated: LessonProgress = {
      ...existing,
      lastPositionSeconds:
        activity.lastPositionSeconds !== undefined
          ? activity.lastPositionSeconds
          : existing.lastPositionSeconds,
      furthestWatchedSeconds:
        activity.furthestWatchedSeconds !== undefined
          ? Math.max(existing.furthestWatchedSeconds, activity.furthestWatchedSeconds)
          : existing.furthestWatchedSeconds,
      eligibleViewingSeconds:
        activity.eligibleViewingSeconds !== undefined
          ? Math.max(existing.eligibleViewingSeconds ?? 0, activity.eligibleViewingSeconds)
          : existing.eligibleViewingSeconds ?? 0,
      durationSeconds:
        activity.durationSeconds !== undefined
          ? activity.durationSeconds
          : existing.durationSeconds,
      updatedAt: new Date().toISOString(),
    };

    this.userProgress[normalizedUserId][normalizedCourseId][itemId] = updated;

    if (!this.lastWatched[normalizedUserId]) {
      this.lastWatched[normalizedUserId] = {};
    }
    this.lastWatched[normalizedUserId][normalizedCourseId] = itemId;

    return updated;
  }

  /**
   * Marks a lesson item as completed and recalculates overall course progress.
   * Strictly enforces sequential lesson locking for trainees.
   * Preview activity by lecturers and admins does not mutate progress.
   */
  public markLessonComplete({
    userId,
    courseId,
    itemId,
    userRole,
  }: {
    userId: string;
    courseId: string;
    itemId: string;
    userRole?: UserRole;
  }): {
    progress: CourseProgress;
    completedItem: LessonProgress;
    message: string;
    justCompletedCourse: boolean;
  } {
    const course = this.getCourseById(courseId);
    if (!course) {
      throw new MockStoreError('الدورة التدريبية غير موجودة', 404);
    }

    const flatItems = this.getCourseItems(courseId);
    const itemIndex = flatItems.findIndex((it) => it.id === itemId);
    if (itemIndex === -1) {
      throw new MockStoreError('الدرس غير موجود في هذه الدورة التدريبية', 404);
    }

    // Preview mode: return simulated completion without persisting
    if (userRole === 'admin' || userRole === 'lecturer') {
      const previewProgress = this.getCourseProgress(userId, courseId);
      return {
        progress: previewProgress,
        completedItem: {
          itemId,
          completed: true,
          completedAt: new Date().toISOString(),
          lastPositionSeconds: 0,
          furthestWatchedSeconds: 0,
          eligibleViewingSeconds: 0,
          updatedAt: new Date().toISOString(),
        },
        message: 'معاينة: تم استكمال الدرس دون تعديل سجلات المتدرب',
        justCompletedCourse: false,
      };
    }

    const normalizedUserId = userId.toLowerCase().trim();
    const normalizedCourseId = course.id.toLowerCase().trim();

    const currentProgress = this.getCourseProgress(userId, courseId);
    const isLocked = isLessonLocked(
      itemIndex,
      flatItems,
      currentProgress.completedItemIds,
      userRole
    );
    if (isLocked) {
      throw new MockStoreError(
        'عليك إكمال الدرس السابق أولاً لتتمكن من الوصول إلى هذا المحتوى وإكماله',
        403
      );
    }

    if (!this.userProgress[normalizedUserId]) {
      this.userProgress[normalizedUserId] = {};
    }
    if (!this.userProgress[normalizedUserId][normalizedCourseId]) {
      this.userProgress[normalizedUserId][normalizedCourseId] = {};
    }

    const existing = this.userProgress[normalizedUserId][normalizedCourseId][itemId] || {
      itemId,
      completed: false,
      lastPositionSeconds: 0,
      furthestWatchedSeconds: 0,
      eligibleViewingSeconds: 0,
      updatedAt: new Date().toISOString(),
    };

    const wasAlreadyCompleted = existing.completed;
    const wasCourseCompleted = currentProgress.isCompleted;

    const completedItem: LessonProgress = {
      ...existing,
      completed: true,
      completedAt: existing.completedAt || new Date().toISOString(),
      furthestWatchedSeconds: existing.durationSeconds
        ? Math.max(existing.furthestWatchedSeconds, existing.durationSeconds)
        : existing.furthestWatchedSeconds,
      updatedAt: new Date().toISOString(),
    };

    this.userProgress[normalizedUserId][normalizedCourseId][itemId] = completedItem;

    if (!this.lastWatched[normalizedUserId]) {
      this.lastWatched[normalizedUserId] = {};
    }
    this.lastWatched[normalizedUserId][normalizedCourseId] = itemId;

    const updatedCourseProgress = this.getCourseProgress(userId, courseId);
    const justCompletedCourse = !wasCourseCompleted && updatedCourseProgress.isCompleted;

    return {
      progress: updatedCourseProgress,
      completedItem,
      message: wasAlreadyCompleted ? 'الدرس مكتمل بالفعل' : 'تم إكمال الدرس بنجاح!',
      justCompletedCourse,
    };
  }

  // ── Training Groups Methods ──────────────────────────────────────────

  /**
   * Get training groups scoped by authenticated user role and membership.
   */
  public getGroups(userId?: string, userRole?: UserRole): TrainingGroup[] {
    for (const g of this.groups) {
      if (g.renewalSchedule?.autoRenewalEnabled) {
        this.checkAndProcessAutoRenewal(g.id);
      }
    }

    if (!userId || userRole === 'admin') {
      return [...this.groups];
    }

    const normalizedUserId = userId.trim();

    if (userRole === 'lecturer') {
      return this.groups.filter((g) =>
        (g.supervisorIds || []).some(
          (sid) => sid.toLowerCase() === normalizedUserId.toLowerCase()
        )
      );
    }

    // Trainee view: only return groups where trainee is explicitly enrolled
    return this.groups.filter((g) =>
      (g.traineeIds || []).some(
        (tid) => tid.toLowerCase() === normalizedUserId.toLowerCase()
      )
    );
  }

  /**
   * Get a single training group by ID with strict authorization verification.
   */
  public getGroupById(
    groupId: string,
    userId?: string,
    userRole?: UserRole
  ): TrainingGroup | null {
    this.checkAndProcessAutoRenewal(groupId);

    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) return null;

    if (!userId || userRole === 'admin') {
      return group;
    }

    const normalizedUserId = userId.trim().toLowerCase();

    if (userRole === 'lecturer') {
      const isSupervisor = (group.supervisorIds || []).some(
        (sid) => sid.toLowerCase() === normalizedUserId
      );
      if (!isSupervisor) {
        throw new MockStoreError('غير مصرح لك باستعراض بيانات هذه المجموعة التدريبية', 403);
      }
      return group;
    }

    // Trainee check
    const isMember = (group.traineeIds || []).some(
      (tid) => tid.toLowerCase() === normalizedUserId
    );
    if (!isMember) {
      throw new MockStoreError('أنت لست عضواً في هذه المجموعة التدريبية', 403);
    }

    return group;
  }

  /**
   * Calculate aggregated metrics for a specific group, optionally scoped to a renewal cycle.
   */
  public getGroupMetrics(groupId: string, cycleId?: string): GroupMetrics | null {
    if (!cycleId) {
      this.checkAndProcessAutoRenewal(groupId);
    }

    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) return null;

    const targetCycle = cycleId
      ? this.renewalCycles.find(
          (c) => c.id.toLowerCase() === cycleId.toLowerCase() && c.groupId.toLowerCase() === group.id.toLowerCase()
        )
      : (group.currentCycleId
          ? this.renewalCycles.find((c) => c.id.toLowerCase() === group.currentCycleId?.toLowerCase())
          : null);

    const now = new Date();
    const groupStart = new Date(targetCycle ? targetCycle.startDateTime : group.startDateTime);
    const groupDeadline = new Date(targetCycle ? targetCycle.deadlineDateTime : group.deadlineDateTime);

    let status: 'active' | 'scheduled' | 'expired' = 'active';
    if (now.getTime() < groupStart.getTime()) status = 'scheduled';
    else if (now.getTime() > groupDeadline.getTime()) status = 'expired';

    const statusLabels = { active: 'نشطة', scheduled: 'مجدولة', expired: 'منتهية' };

    const coursesToEvaluate = targetCycle ? targetCycle.courses : (group.courses || []);

    const rawAssignedCourses = coursesToEvaluate.map((assignment) => {
      const course = this.getCourseById(assignment.courseId);
      const effective = getEffectiveCourseSettings(group, assignment, now, targetCycle);
      const totalLessons = course ? this.getCourseItems(course.id).length : 0;
      const timeRemaining = formatRemainingTime(
        effective.deadlineDateTime,
        effective.startDateTime,
        effective.status,
        now
      );

      return {
        assignment,
        courseId: assignment.courseId,
        courseTitle: course ? course.title : assignment.courseId,
        courseRole: (assignment as { courseRole?: CourseRole }).courseRole || 'core',
        order: assignment.order || 1,
        effective,
        totalRequiredLessons: totalLessons,
        timeRemainingText: timeRemaining,
        status: effective.status,
      };
    });

    const programTotalRequiredLessons = rawAssignedCourses.reduce(
      (sum, c) => sum + c.totalRequiredLessons,
      0
    );

    // Compute trainee metrics for members
    const groupMemberMap = new Map<string, GroupMember>();
    for (const m of this.groupMembers[group.id] || []) {
      groupMemberMap.set(m.userId.toLowerCase(), m);
    }

    const traineeMetricsList: TraineeGroupMetrics[] = (group.traineeIds || []).map((traineeId) => {
      let totalCompletedLessons = 0;
      let completedCoursesCount = 0;
      let worstAttention: TraineeAttentionResult = {
        needsAttention: false,
        reason: '',
        badge: '',
        level: '',
      };
      const courseProgressMap: Record<string, TraineeCourseProgressInGroup> = {};
      let mostRecentActivity: string | null = null;

      rawAssignedCourses.forEach((ac) => {
        // Look up cycle attempt for progress isolation
        const cycleAttempt = targetCycle
          ? this.courseAttempts.find(
              (a) =>
                a.userId.toLowerCase() === traineeId.toLowerCase() &&
                a.courseId.toLowerCase() === ac.courseId.toLowerCase() &&
                a.cycleId?.toLowerCase() === targetCycle.id.toLowerCase()
            )
          : null;

        let progressPercent = 0;
        let completedItemIds: string[] = [];
        let isCompleted = false;
        let isStarted = false;
        let lastActivityAt: string | null = null;

        if (cycleAttempt) {
          isStarted = isAttemptStarted(cycleAttempt);
          progressPercent = cycleAttempt.progressPercent;
          completedItemIds = cycleAttempt.completedItemIds;
          isCompleted = cycleAttempt.status === 'completed' || isAttemptCompleted(cycleAttempt);
          lastActivityAt = cycleAttempt.lastActivityAt || cycleAttempt.updatedAt || null;
        } else {
          const prog = this.getCourseProgress(traineeId, ac.courseId);
          progressPercent = prog.progressPercent;
          completedItemIds = prog.completedItemIds;
          isCompleted = prog.isCompleted;
          isStarted = prog.progressPercent > 0 || completedItemIds.length > 0;
          lastActivityAt = (prog as { lastActivityAt?: string | null }).lastActivityAt || null;
        }

        if (lastActivityAt && (!mostRecentActivity || new Date(lastActivityAt) > new Date(mostRecentActivity))) {
          mostRecentActivity = lastActivityAt;
        }

        totalCompletedLessons += completedItemIds.length;
        if (isCompleted) completedCoursesCount++;

        const attention = checkTraineeAttention({
          progressPercent,
          isCompleted,
          notStarted: !isStarted,
          status: ac.effective.status,
          startDateTime: ac.effective.startDateTime,
          deadlineDateTime: ac.effective.deadlineDateTime,
          now,
        });

        if (attention.needsAttention) {
          if (worstAttention.level !== 'danger') {
            worstAttention = { ...attention, groupId: group.id, courseId: ac.courseId };
          }
        }

        courseProgressMap[ac.courseId] = {
          courseId: ac.courseId,
          courseTitle: ac.courseTitle,
          courseRole: ac.courseRole,
          percent: progressPercent,
          completedLessons: completedItemIds.length,
          totalLessons: ac.totalRequiredLessons,
          isCompleted,
          started: isStarted,
          lastActivityAt,
          status: ac.effective.status,
          effectiveDeadline: ac.effective.deadlineDateTime,
          effectivePolicy: ac.effective.postDeadlinePolicy,
          needsAttention: attention.needsAttention,
          attentionReason: attention.reason,
        };
      });

      const member = groupMemberMap.get(traineeId.toLowerCase());
      const meta = this.resolveMockUserMeta(traineeId);
      const userName = member?.name || meta.name || traineeId;
      const email = member?.email || meta.email || '';
      const department = member?.department || meta.department || '';
      const jobTitle = member?.jobTitle || meta.jobTitle || '';

      const coreCourses = rawAssignedCourses.filter((ac) => ac.courseRole === 'core');
      const totalCoreCoursesCount = coreCourses.length;
      const completedCoreCoursesCount = coreCourses.filter(
        (ac) => courseProgressMap[ac.courseId]?.isCompleted
      ).length;

      const isAllCoreCompleted =
        totalCoreCoursesCount > 0
          ? completedCoreCoursesCount === totalCoreCoursesCount
          : completedCoursesCount === rawAssignedCourses.length && rawAssignedCourses.length > 0;

      const startedCoursesCount = rawAssignedCourses.filter(
        (ac) => courseProgressMap[ac.courseId]?.started
      ).length;

      // If not flagged with danger/warning, assign pleasant status
      if (!worstAttention.needsAttention) {
        if (isAllCoreCompleted) {
          worstAttention = {
            needsAttention: false,
            reason: 'تم إكمال جميع المتطلبات التدريبية بنجاح',
            badge: 'مكتمل بنجاح',
            level: 'info',
          };
        } else {
          worstAttention = {
            needsAttention: false,
            reason: 'التقدم منتظم وضمن الجدول الزمني المقرر',
            badge: 'منتظم',
            level: '',
          };
        }
      }

      const programPercent =
        programTotalRequiredLessons > 0
          ? Math.round((totalCompletedLessons / programTotalRequiredLessons) * 100)
          : rawAssignedCourses.length > 0
            ? Math.round(
                rawAssignedCourses.reduce((sum, ac) => sum + (courseProgressMap[ac.courseId]?.percent || 0), 0) /
                  rawAssignedCourses.length
              )
            : 0;

      return {
        userId: traineeId,
        userName,
        email,
        department,
        jobTitle,
        joinedAt: member?.joinedAt,
        programPercent,
        completedLessonsTotal: totalCompletedLessons,
        totalRequiredLessons: programTotalRequiredLessons,
        completedCoursesCount,
        totalAssignedCourses: rawAssignedCourses.length,
        startedCoursesCount,
        completedCoreCoursesCount,
        totalCoreCoursesCount,
        isAllCoreCompleted,
        isProgramCompleted: isAllCoreCompleted,
        lastActivityAt: mostRecentActivity,
        courseProgressMap,
        worstAttention,
      };
    });

    // Enriched assigned courses metrics
    const totalMembers = (group.traineeIds || []).length;
    const assignedCoursesMetrics: AssignedCourseProgressMetric[] = rawAssignedCourses.map((ac) => {
      const courseTrainees = traineeMetricsList.map((t) => t.courseProgressMap[ac.courseId]).filter(Boolean);

      const enrolledCount = totalMembers;
      const startedCount = courseTrainees.filter((cp) => cp.started).length;
      const completedCount = courseTrainees.filter((cp) => cp.isCompleted).length;
      const inProgressCount = courseTrainees.filter((cp) => cp.percent > 0 && !cp.isCompleted).length;
      const notStartedCount = courseTrainees.filter((cp) => !cp.started).length;
      const overdueCount = courseTrainees.filter(
        (cp) => ac.effective.status === 'expired' && !cp.isCompleted
      ).length;
      const averageProgressPercent =
        enrolledCount > 0
          ? Math.round(
              courseTrainees.reduce((sum, cp) => sum + (cp.percent || 0), 0) / enrolledCount
            )
          : 0;

      return {
        ...ac,
        enrolledCount,
        startedCount,
        inProgressCount,
        completedCount,
        notStartedCount,
        overdueCount,
        averageProgressPercent,
      };
    });

    // Cohort summary calculations
    const totalCourses = rawAssignedCourses.length;
    const coreCoursesCount = rawAssignedCourses.filter((ac) => ac.courseRole === 'core').length;
    const reminderCoursesCount = rawAssignedCourses.filter((ac) => ac.courseRole === 'reminder').length;
    const traineesStarted = traineeMetricsList.filter((t) => (t.startedCoursesCount ?? 0) > 0).length;
    const traineesCompletedAllCore = traineeMetricsList.filter((t) => t.isAllCoreCompleted).length;

    const cycleAttempts = targetCycle ? this.getCycleAttempts(targetCycle.id) : [];
    const inProgressAttempts = cycleAttempts.filter(
      (a) => a.status === 'in_progress' || (isAttemptStarted(a) && a.status !== 'completed')
    ).length;
    const completedAttempts = cycleAttempts.filter((a) => a.status === 'completed' || isAttemptCompleted(a)).length;
    const notStartedAttempts = cycleAttempts.filter((a) => !isAttemptStarted(a)).length;

    const averageProgressPercent =
      totalMembers > 0
        ? Math.round(
            traineeMetricsList.reduce((sum, t) => sum + t.programPercent, 0) / totalMembers
          )
        : 0;

    const warningAlertsCount = traineeMetricsList.filter(
      (t) => t.worstAttention.level === 'warning'
    ).length;
    const dangerAlertsCount = traineeMetricsList.filter(
      (t) => t.worstAttention.level === 'danger'
    ).length;
    const totalAttentionCount = warningAlertsCount + dangerAlertsCount;

    const cohortSummary: CohortSummaryMetrics = {
      totalMembers,
      totalCourses,
      coreCoursesCount,
      reminderCoursesCount,
      traineesStarted,
      traineesCompletedAllCore,
      inProgressAttempts,
      completedAttempts,
      notStartedAttempts,
      averageProgressPercent,
      warningAlertsCount,
      dangerAlertsCount,
      totalAttentionCount,
    };

    return {
      group,
      status,
      statusLabelAr: statusLabels[status] || status,
      timeRemainingText: formatRemainingTime(
        targetCycle ? targetCycle.deadlineDateTime : group.deadlineDateTime,
        targetCycle ? targetCycle.startDateTime : group.startDateTime,
        status,
        now
      ),
      selectedCycle: targetCycle || null,
      cycles: this.getGroupCycles(group.id),
      cohortSummary,
      assignedCoursesMetrics,
      programTotalRequiredLessons,
      traineeMetricsList,
    };
  }

  // ── Enrolled Courses with Policy Filtering & Approved Sorting ─────────

  /**
   * Returns current user's enrolled courses enriched with progress,
   * respecting post-deadline policy (hide vs keep_no_cert), and sorted
   * according to approved priority:
   * 1. In-progress courses with active learning activity (most recently active first)
   * 2. Other in-progress courses
   * 3. Not started courses (progress === 0)
   * 4. Completed courses (progress === 100)
   */
  public getMyEnrolledCourses(userId: string): Array<
    Course & {
      progress: CourseProgress;
      isExpired: boolean;
      canCertify: boolean;
      policyLabel?: string;
      lastActivityDate?: string;
      lastWatchedItemId?: string;
    }
  > {
    const normalizedUserId = userId.trim().toLowerCase();
    const userEnrollments = this.enrollments.filter(
      (e) => e.userId.toLowerCase() === normalizedUserId
    );

    const traineeGroups = this.groups.filter((g) =>
      (g.traineeIds || []).some((tid) => tid.toLowerCase() === normalizedUserId)
    );

    const now = new Date();
    const result: Array<
      Course & {
        progress: CourseProgress;
        isExpired: boolean;
        canCertify: boolean;
        policyLabel?: string;
        lastActivityDate?: string;
        lastWatchedItemId?: string;
      }
    > = [];

    for (const enrollment of userEnrollments) {
      const course = this.getCourseById(enrollment.courseId);
      if (!course) continue;

      const progress = this.getCourseProgress(userId, course.id);

      // Check group-level and course-level deadline policy
      let isExpired = false;
      let effectivePolicy: 'keep_no_cert' | 'hide' = 'keep_no_cert';

      for (const grp of traineeGroups) {
        const assignment = (grp.courses || []).find(
          (c) => c.courseId.toLowerCase() === course.id.toLowerCase()
        );
        if (assignment) {
          const eff = getEffectiveCourseSettings(grp, assignment, now);
          if (eff.isExpired) {
            isExpired = true;
            effectivePolicy = eff.postDeadlinePolicy;
          }
        }
      }

      // Approved Rule 1: hide policy omits expired course completely
      if (isExpired && effectivePolicy === 'hide' && !progress.isCompleted) {
        continue;
      }

      // Check user learning activity in this course
      let latestActivityTime = 0;
      let lastActivityDate: string | undefined;

      const courseUserProgress =
        this.userProgress[normalizedUserId]?.[course.id.toLowerCase()] || {};
      for (const itemProgress of Object.values(courseUserProgress)) {
        if (itemProgress.updatedAt) {
          const t = new Date(itemProgress.updatedAt).getTime();
          if (t > latestActivityTime) {
            latestActivityTime = t;
            lastActivityDate = itemProgress.updatedAt;
          }
        }
      }

      const lastWatchedItemId =
        this.lastWatched[normalizedUserId]?.[course.id.toLowerCase()];

      result.push({
        ...course,
        progress,
        isExpired,
        canCertify: !isExpired || progress.isCompleted,
        policyLabel: isExpired ? 'منتهية الصلاحية — للمطالعة بدون شهادة' : undefined,
        lastActivityDate,
        lastWatchedItemId,
      });
    }

    // Approved Sorting Rule:
    // 1. Started in-progress courses (most recently active first)
    // 2. Other in-progress courses
    // 3. Not started courses
    // 4. Completed courses
    result.sort((a, b) => {
      const aPercent = a.progress.progressPercent;
      const bPercent = b.progress.progressPercent;

      const aIsCompleted = a.progress.isCompleted;
      const bIsCompleted = b.progress.isCompleted;

      const aIsStarted = aPercent > 0 && !aIsCompleted;
      const bIsStarted = bPercent > 0 && !bIsCompleted;

      // Group 1 & 2 vs 3 vs 4
      if (aIsStarted && !bIsStarted) return -1;
      if (!aIsStarted && bIsStarted) return 1;

      // Both are started in-progress: sort by latest activity date
      if (aIsStarted && bIsStarted) {
        const aTime = a.lastActivityDate ? new Date(a.lastActivityDate).getTime() : 0;
        const bTime = b.lastActivityDate ? new Date(b.lastActivityDate).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
      }

      // Not started (0%) vs Completed (100%)
      if (!aIsCompleted && bIsCompleted) return -1;
      if (aIsCompleted && !bIsCompleted) return 1;

      // Fallback: title alphabetical
      return a.title.localeCompare(b.title, 'ar');
    });

    return result;
  }

  // ── Notification Center Methods ───────────────────────────────────────

  /**
   * Get notifications scoped to user ID sorted newest first.
   */
  public getNotificationsForUser(userId: string): NotificationItem[] {
    const normalizedUserId = userId.trim().toLowerCase();
    return this.notifications
      .filter((n) => n.userId.toLowerCase() === normalizedUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get count of unread notifications for a user.
   */
  public getUnreadNotificationsCount(userId: string): number {
    const normalizedUserId = userId.trim().toLowerCase();
    return this.notifications.filter(
      (n) => n.userId.toLowerCase() === normalizedUserId && !n.read
    ).length;
  }

  /**
   * Marks a single notification as read.
   */
  public markNotificationRead(notificationId: string, userId: string): NotificationItem {
    const normalizedUserId = userId.trim().toLowerCase();
    const notif = this.notifications.find(
      (n) =>
        n.id.toLowerCase() === notificationId.toLowerCase() &&
        n.userId.toLowerCase() === normalizedUserId
    );

    if (!notif) {
      throw new MockStoreError('الإشعار غير موجود أو غير مصرح به', 404);
    }

    notif.read = true;
    return notif;
  }

  /**
   * Marks all notifications for a user as read.
   */
  public markAllNotificationsRead(userId: string): void {
    const normalizedUserId = userId.trim().toLowerCase();
    for (const notif of this.notifications) {
      if (notif.userId.toLowerCase() === normalizedUserId) {
        notif.read = true;
      }
    }
  }

  // ── Role-Adaptive Dashboard Aggregations ──────────────────────────────

  /**
   * Compiles authoritative dashboard data derived directly from store entities.
   */
  public getDashboardData(user: User): DashboardData {
    const now = new Date();
    const dateAr = now.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (user.role === 'lecturer') {
      const lecturerCourses = this.courses.filter(
        (c) =>
          c.lecturerId === user.id ||
          (c.lecturerName && c.lecturerName.includes('الجوهري'))
      );

      const totalTrainees = lecturerCourses.reduce(
        (sum, c) => sum + (c.enrollmentCount || 0),
        0
      );

      const totalRating = lecturerCourses.reduce((sum, c) => sum + (c.rating || 0), 0);
      const avgRating =
        lecturerCourses.length > 0
          ? (totalRating / lecturerCourses.length).toFixed(1)
          : '4.8';

      const supervisedGroups = this.groups
        .filter((g) =>
          (g.supervisorIds || []).some(
            (sid) => sid.toLowerCase() === user.id.toLowerCase()
          )
        )
        .map((g) => {
          const metrics = this.getGroupMetrics(g.id);
          const finishedCount = (metrics?.traineeMetricsList || []).filter(
            (tm) => tm.isProgramCompleted
          ).length;
          const totalTraineesCount = g.traineeIds.length;
          const rate =
            totalTraineesCount > 0
              ? Math.round((finishedCount / totalTraineesCount) * 100)
              : 0;

          return {
            id: g.id,
            name: g.name,
            traineeCount: totalTraineesCount,
            deadlineText: metrics ? metrics.timeRemainingText : '—',
            completionRate: rate,
            status: metrics ? metrics.statusLabelAr : 'نشطة',
          };
        });

      return {
        role: 'lecturer',
        welcome: {
          name: user.name,
          roleTitle: user.jobTitle || 'محاضر معتمد',
          department: user.department || 'مركز تدريب وإعداد القادة',
        },
        stats: {
          assignedCoursesCount: lecturerCourses.length,
          totalTraineesCount: totalTrainees,
          averageRating: avgRating,
          supervisedGroupsCount: supervisedGroups.length,
        },
        assignedCourses: lecturerCourses.map((c) => ({
          id: c.id,
          title: c.title,
          level: c.level,
          duration: `${c.estimatedHours || 12} ساعة`,
          enrolledCount: c.enrollmentCount || 0,
          rating: c.rating,
          status: c.status,
        })),
        supervisedGroups,
      };
    }

    if (user.role === 'admin') {
      const totalCourses = this.courses.length;
      const totalEnrollments = this.courses.reduce(
        (sum, c) => sum + (c.enrollmentCount || 0),
        0
      );
      const activeGroups = this.groups.filter((g) => {
        const m = this.getGroupMetrics(g.id);
        return m?.status === 'active';
      });

      // Total attention alerts across all groups
      let totalFlags = 0;
      this.groups.forEach((g) => {
        const m = this.getGroupMetrics(g.id);
        if (m) {
          m.traineeMetricsList.forEach((tm) => {
            if (tm.worstAttention.needsAttention) totalFlags++;
          });
        }
      });

      const topCourses = [...this.courses]
        .sort((a, b) => (b.enrollmentCount || 0) - (a.enrollmentCount || 0))
        .slice(0, 5)
        .map((c) => {
          const compRate =
            c.enrollmentCount > 0
              ? Math.round(((c.completionCount || 0) / c.enrollmentCount) * 100)
              : 85;
          return {
            id: c.id,
            title: c.title,
            lecturerName: c.lecturerName,
            enrollmentCount: c.enrollmentCount || 0,
            completionRate: compRate,
            rating: c.rating,
          };
        });

      const activeGroupsOverview = this.groups.map((g) => {
        const m = this.getGroupMetrics(g.id);
        const finishedCount = (m?.traineeMetricsList || []).filter(
          (tm) => tm.isProgramCompleted
        ).length;
        const total = g.traineeIds.length;
        const progress = total > 0 ? Math.round((finishedCount / total) * 100) : 0;

        return {
          id: g.id,
          name: g.name,
          status: m ? m.statusLabelAr : 'نشطة',
          traineeCount: total,
          deadlineText: m ? m.timeRemainingText : '—',
          overallProgress: progress,
        };
      });

      return {
        role: 'admin',
        welcome: {
          name: user.name,
          roleTitle: user.jobTitle || 'مدير عام أنظمة التشغيل',
        },
        stats: {
          totalCoursesCount: totalCourses,
          totalEnrollmentsCount: totalEnrollments,
          activeGroupsCount: activeGroups.length,
          totalAttentionFlagsCount: totalFlags,
        },
        topCourses,
        activeGroupsOverview,
      };
    }

    // Trainee Dashboard View (user role)
    const enrolledCourses = this.getMyEnrolledCourses(user.id);
    const completedCourses = enrolledCourses.filter((c) => c.progress.isCompleted);

    // Continue Learning: latest active course or first in-progress course
    let continueLearning: TraineeContinueLearningCard | null = null;
    if (enrolledCourses.length > 0) {
      const activeCourse =
        enrolledCourses.find((c) => !c.progress.isCompleted) || enrolledCourses[0];

      const flatItems = this.getCourseItems(activeCourse.id);
      const resumeItem =
        flatItems.find((it) => it.id === activeCourse.lastWatchedItemId) ||
        flatItems.find((it) => !activeCourse.progress.completedItemIds.includes(it.id)) ||
        flatItems[0];

      continueLearning = {
        courseId: activeCourse.id,
        courseTitle: activeCourse.title,
        lecturerName: activeCourse.lecturerName,
        thumbnail: activeCourse.thumbnail,
        progressPercent: activeCourse.progress.progressPercent,
        resumeItemId: resumeItem ? resumeItem.id : '',
        resumeLessonTitle: resumeItem ? resumeItem.title : '',
      };
    }

    // Trainee Groups & Attention Checks
    const traineeGroups = this.getGroups(user.id, 'user');
    const attentionItems: TraineeAttentionResult[] = [];
    const upcomingSessions: TraineeUpcomingSession[] = [];

    traineeGroups.forEach((grp) => {
      const metrics = this.getGroupMetrics(grp.id);
      if (metrics) {
        const myMetrics = metrics.traineeMetricsList.find(
          (tm) => tm.userId.toLowerCase() === user.id.toLowerCase()
        );
        if (myMetrics && myMetrics.worstAttention.needsAttention) {
          attentionItems.push(myMetrics.worstAttention);
        }
      }

      // Live interactive sessions (Teams, Zoom, Google Meet)
      grp.resources
        .filter(
          (r) =>
            r.type === 'teams' ||
            r.type === 'zoom' ||
            r.type === 'meet' ||
            r.url.includes('teams.microsoft.com') ||
            r.url.includes('zoom.us') ||
            r.url.includes('meet.google.com')
        )
        .forEach((r) => {
          upcomingSessions.push({
            id: r.id,
            groupId: grp.id,
            groupName: grp.name,
            title: r.title,
            url: r.url,
            description: r.description,
            dateText: 'اللقاء الأسبوعي المباشر',
          });
        });
    });

    const allClear = attentionItems.length === 0;

    return {
      role: 'user',
      welcome: {
        name: user.name,
        dateAr,
        jobTitle: user.jobTitle || 'فني صيانة قطارات أول',
        department: user.department || 'قطاع صيانة الوحدات المتحركة',
      },
      continueLearning,
      stats: {
        enrolledCount: enrolledCourses.length,
        completedCount: completedCourses.length,
        totalLearningHours: 24, // Authentic baseline from users.json
        activeGroupsCount: traineeGroups.length,
      },
      attention: {
        hasEvaluated: true,
        items: attentionItems,
        allClear,
        allClearMessage: allClear
          ? 'جميع مساراتك التدريبية تسير وفق الجدول الزمني المحدد'
          : undefined,
      },
      upcomingSessions,
    };
  }

  /**
   * Increment 8: Lecturer Workspace & Course Builder Methods
   */

  /**
   * Helper to evaluate course editing/viewing authorization for lecturers and admins.
   * Strictly evaluates user IDs through canonical course instructor resolution; never uses display names.
   */
  public isAuthorizedLecturer(course: Course, user: User): boolean {
    if (user.role === 'admin') return true;
    if (user.role !== 'lecturer') return false;
    return isUserAuthorizedCourseInstructor(course, user.id);
  }

  /**
   * Retrieve courses assigned to a lecturer (or all courses for admins).
   * Trainees are strictly blocked (403 Forbidden).
   */
  public getLecturerCourses(user: User): (Course & { hasDraft?: boolean })[] {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك بالوصول إلى لوحة تحكم المحاضرين', 403);
    }

    let assigned: Course[];
    if (user.role === 'admin') {
      assigned = this.courses;
    } else {
      assigned = this.courses.filter((c) => this.isAuthorizedLecturer(c, user));
    }

    return assigned.map((c) => ({
      ...JSON.parse(JSON.stringify(c)),
      hasDraft: Boolean(this.courseDrafts[c.id]),
    }));
  }

  /**
   * Retrieve a course for editing in the course builder.
   * Returns draft version if exists, otherwise the base course.
   * Enforces strict lecturer ownership and admin authority.
   */
  public getCourseForEditing(courseId: string, user: User): Course {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك بالوصول لمنشئ المحتوى', 403);
    }

    const course = this.courses.find((c) => c.id === courseId);
    if (!course) {
      throw new MockStoreError(`تعذر العثور على الدورة التدريبية بالرمز ${courseId}`, 404);
    }

    if (!this.isAuthorizedLecturer(course, user)) {
      throw new MockStoreError('غير مصرح لك بتعديل هذا المقرر التدريبي', 403);
    }

    if (this.courseDrafts[courseId]) {
      const draftObj = JSON.parse(JSON.stringify(this.courseDrafts[courseId]));
      if (!draftObj.auditLog && course.auditLog) {
        draftObj.auditLog = JSON.parse(JSON.stringify(course.auditLog));
      }
      if (!draftObj.activeReviewFeedback && course.activeReviewFeedback) {
        draftObj.activeReviewFeedback = JSON.parse(JSON.stringify(course.activeReviewFeedback));
      }
      return draftObj;
    }

    return JSON.parse(JSON.stringify(course));
  }

  /**
   * Create a new course in draft status.
   */
  public createCourse(
    data: { title: string; level: Course['level']; description?: string },
    user: User
  ): Course {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك بإنشاء دورات تدريبية', 403);
    }

    const newId = `CRS${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newCourse: Course = {
      id: newId,
      title: data.title.trim(),
      description: (data.description || '').trim(),
      level: data.level,
      status: 'draft',
      lecturerId: user.id,
      lecturerName: user.name,
      coLecturers: [],
      assistants: [],
      targetJobTitles: [],
      estimatedHours: 4,
      rating: 0,
      ratingCount: 0,
      enrollmentCount: 0,
      completionCount: 0,
      dropoutCount: 0,
      returnRate: 0,
      requiresApproval: false,
      prerequisiteCourseId: null,
      courseZipPolicy: 'disabled',
      chapters: [
        {
          id: `CH01_${Date.now()}`,
          title: 'الفصل الأول: مقدمة البرنامج',
          order: 1,
          items: [],
        },
      ],
      createdAt: new Date().toISOString(),
    };

    this.courses.unshift(newCourse);
    this.courseDrafts[newId] = JSON.parse(JSON.stringify(newCourse));

    return JSON.parse(JSON.stringify(newCourse));
  }

  /**
   * Save draft changes for a course.
   * If course is published, the published version remains intact in this.courses,
   * while draft changes are saved separately in this.courseDrafts.
   */
  public saveCourseDraft(
    courseId: string,
    draftData: Partial<Course>,
    user: User
  ): { course: Course; isPublishedPreserved: boolean } {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك بتعديل هذا المقرر', 403);
    }

    const targetCourse = this.courses.find((c) => c.id === courseId);
    if (!targetCourse) {
      throw new MockStoreError(`تعذر العثور على الدورة التدريبية ${courseId}`, 404);
    }

    if (!this.isAuthorizedLecturer(targetCourse, user)) {
      throw new MockStoreError('غير مصرح لك بتعديل هذا المقرر', 403);
    }

    const currentDraft = this.courseDrafts[courseId] || targetCourse;

    // Administration boundary: Non-admin lecturers cannot mutate lecturer assignments or WhatsApp contact overrides
    const safeDraftData = { ...draftData };
    if (user.role !== 'admin') {
      delete safeDraftData.lecturerId;
      delete safeDraftData.lecturerName;
      delete safeDraftData.coLecturers;
      delete safeDraftData.whatsappContacts;
    }

    const mergedCourse: Course = {
      ...currentDraft,
      ...safeDraftData,
      id: courseId, // ID remains immutable
      draftUpdatedAt: new Date().toISOString(),
    };

    const isPublished = targetCourse.status === 'published' || targetCourse.status === 'live';

    if (isPublished) {
      // Preserve published version in catalog; mark draft changes
      targetCourse.hasDraftChanges = true;
      targetCourse.draftUpdatedAt = mergedCourse.draftUpdatedAt;
      this.courseDrafts[courseId] = JSON.parse(JSON.stringify(mergedCourse));

      if (courseId === CONTENT_TEST_LAB_COURSE_ID || targetCourse.isTestLab) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('metro_lms_lab_course_state', JSON.stringify(mergedCourse));
        }
      }

      return {
        course: JSON.parse(JSON.stringify(mergedCourse)),
        isPublishedPreserved: true,
      };
    } else {
      // In draft status, update both base and draft
      const idx = this.courses.findIndex((c) => c.id === courseId);
      if (idx !== -1) {
        this.courses[idx] = JSON.parse(JSON.stringify(mergedCourse));
      }
      this.courseDrafts[courseId] = JSON.parse(JSON.stringify(mergedCourse));

      // If this is the Content Testing Lab, persist in localStorage so page reloads preserve the draft
      if (courseId === CONTENT_TEST_LAB_COURSE_ID || targetCourse.isTestLab) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('metro_lms_lab_course_state', JSON.stringify(mergedCourse));
        }
      }

      return {
        course: JSON.parse(JSON.stringify(mergedCourse)),
        isPublishedPreserved: false,
      };
    }
  }

  /**
   * Explicitly reset the Content Testing Lab to its original fixture state
   */
  public resetContentLabCourse(courseId: string, user: User): Course {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك بإعادة ضبط معمل الاختبار', 403);
    }

    const targetCourse = this.courses.find((c) => c.id === courseId);
    if (!targetCourse || (!targetCourse.isTestLab && courseId !== CONTENT_TEST_LAB_COURSE_ID)) {
      throw new MockStoreError('هذا المقرر ليس معمل اختبار معتمد', 400);
    }

    if (!this.isAuthorizedLecturer(targetCourse, user)) {
      throw new MockStoreError('غير مصرح لك بإعادة ضبط هذا المعمل', 403);
    }

    const freshLab = createInitialContentLabFixture();

    // Clear persistent local state
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('metro_lms_lab_course_state');
      localStorage.removeItem(`metro_builder_draft_${CONTENT_TEST_LAB_COURSE_ID}`);
      localStorage.removeItem(`metro_builder_draft_${courseId}`);
    }

    // Clear draft in memory
    delete this.courseDrafts[courseId];
    delete this.courseDrafts[CONTENT_TEST_LAB_COURSE_ID];

    // Replace in courses array
    const idx = this.courses.findIndex((c) => c.id === courseId);
    if (idx !== -1) {
      this.courses[idx] = JSON.parse(JSON.stringify(freshLab));
    } else {
      this.courses.push(JSON.parse(JSON.stringify(freshLab)));
    }

    return JSON.parse(JSON.stringify(freshLab));
  }

  /**
   * Helper to validate course content eligibility before submission or staging.
   * Enforces: non-empty title, non-empty description, at least one chapter,
   * and at least one lesson item across all chapters.
   */
  public validateCourseContentEligibility(course: Partial<Course>): void {
    if (!course.title || course.title.trim().length === 0) {
      throw new MockStoreError('عنوان المقرر مطلوب ولا يمكن أن يكون فارغاً', 422);
    }
    if (!course.description || course.description.trim().length === 0) {
      throw new MockStoreError('وصف المقرر مطلوب ولا يمكن أن يكون فارغاً', 422);
    }
    if (!course.chapters || course.chapters.length === 0) {
      throw new MockStoreError('يجب أن يحتوي المقرر على فصل واحد على الأقل', 422);
    }
    const totalItems = course.chapters.reduce(
      (sum, ch) => sum + (ch.items ? ch.items.length : 0),
      0
    );
    if (totalItems === 0) {
      throw new MockStoreError('يجب أن يحتوي المقرر على درس أو مادة تدريبية واحدة على الأقل', 422);
    }
  }

  /**
   * Helper to determine whether a submission starts a new review cycle ('submitted')
   * or resubmits following a rejection or return in the active cycle ('resubmitted').
   * Evaluates auditLog in reverse chronological order:
   * - If the most recent milestone action is 'approved', returns false (starts new cycle).
   * - If the most recent milestone action is 'returned_with_admin_edits' or 'rejected', returns true.
   * - Otherwise returns false.
   */
  private isResubmissionCycle(auditLog?: CourseAuditLogEntry[]): boolean {
    if (!auditLog || auditLog.length === 0) return false;
    for (let i = auditLog.length - 1; i >= 0; i--) {
      const act = auditLog[i].action;
      if (act === 'approved') return false;
      if (act === 'returned_with_admin_edits' || act === 'rejected') return true;
    }
    return false;
  }

  /**
   * Increment 9: Submit course for administrative review.
   * Case A: Unpublished draft course transitions from draft to pending_admin.
   * Case B: Published course update submits draft while published base remains live.
   * Throws 409 DRAFT_INTEGRITY_ERROR if published-course draft is missing.
   * Enforces content eligibility before any state mutation.
   */
  public submitCourseForReview(courseId: string, user: User): SubmitCourseResponseDTO {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك بتقديم هذا المقرر للمراجعة', 403);
    }

    const targetCourse = this.courses.find(
      (c) => c.id.toLowerCase() === courseId.trim().toLowerCase()
    );
    if (!targetCourse) {
      throw new MockStoreError(`تعذر العثور على الدورة التدريبية ${courseId}`, 404);
    }

    if (!this.isAuthorizedLecturer(targetCourse, user)) {
      throw new MockStoreError('غير مصرح لك بتقديم هذا المقرر للمراجعة', 403);
    }

    const isPublished = targetCourse.status === 'published' || targetCourse.status === 'live';

    if (isPublished) {
      // Case B: Published course update
      const draft = this.courseDrafts[targetCourse.id];
      if (!draft) {
        throw new MockStoreError(
          'تعذر العثور على مسودة التعديلات للمقرر المنشور',
          409,
          'DRAFT_INTEGRITY_ERROR'
        );
      }

      // Pre-mutation content eligibility check on draft content
      this.validateCourseContentEligibility(draft);

      const submissionTimestamp = new Date().toISOString();
      targetCourse.isUpdatePendingApproval = true;
      targetCourse.hasDraftChanges = true;
      targetCourse.submittedAt = submissionTimestamp;
      draft.submittedAt = submissionTimestamp;

      const isResubmission = this.isResubmissionCycle(targetCourse.auditLog);
      const action: CourseAuditAction = isResubmission ? 'resubmitted' : 'submitted';

      if (!targetCourse.auditLog) targetCourse.auditLog = [];
      targetCourse.auditLog.push({
        id: `AUD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        courseId: targetCourse.id,
        action,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role === 'admin' ? 'admin' : 'lecturer',
        timestamp: submissionTimestamp,
        summary: action === 'resubmitted'
          ? `تمت إعادة تقديم تحديثات المقرر المنشور بواسطة ${user.name}`
          : `تم تقديم تحديثات المقرر المنشور للمراجعة بواسطة ${user.name}`,
      });

      if (this.courseDrafts[targetCourse.id]) {
        this.courseDrafts[targetCourse.id].auditLog = targetCourse.auditLog;
      }

      return {
        course: JSON.parse(JSON.stringify(targetCourse)),
        message: action === 'resubmitted'
          ? 'تمت إعادة تقديم تحديثات المقرر للمراجعة بنجاح'
          : 'تم تقديم تحديثات المقرر للمراجعة بنجاح',
        isPublishedUpdate: true,
        action,
      };
    } else {
      // Case A: Unpublished course
      if (targetCourse.status !== 'draft') {
        throw new MockStoreError('لا يمكن تقديم مقرر غير موجود في حالة المسودة', 400);
      }

      const contentToValidate = this.courseDrafts[targetCourse.id] || targetCourse;
      this.validateCourseContentEligibility(contentToValidate);

      const submissionTimestamp = new Date().toISOString();
      Object.assign(targetCourse, contentToValidate, {
        status: 'pending_admin' as CourseStatus,
        submittedAt: submissionTimestamp,
      });

      if (this.courseDrafts[targetCourse.id]) {
        this.courseDrafts[targetCourse.id].status = 'pending_admin';
        this.courseDrafts[targetCourse.id].submittedAt = submissionTimestamp;
      }

      const isResubmission = this.isResubmissionCycle(targetCourse.auditLog);
      const action: CourseAuditAction = isResubmission ? 'resubmitted' : 'submitted';

      if (!targetCourse.auditLog) targetCourse.auditLog = [];
      targetCourse.auditLog.push({
        id: `AUD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        courseId: targetCourse.id,
        action,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role === 'admin' ? 'admin' : 'lecturer',
        timestamp: submissionTimestamp,
        summary: action === 'resubmitted'
          ? `تمت إعادة تقديم المقرر بعد المراجعة بواسطة ${user.name}`
          : `تم تقديم المقرر للمراجعة والاعتماد بواسطة ${user.name}`,
      });

      if (this.courseDrafts[targetCourse.id]) {
        this.courseDrafts[targetCourse.id].auditLog = targetCourse.auditLog;
      }

      return {
        course: JSON.parse(JSON.stringify(targetCourse)),
        message: action === 'resubmitted'
          ? 'تمت إعادة تقديم المقرر للمراجعة بنجاح'
          : 'تم تقديم المقرر للمراجعة بنجاح',
        isPublishedUpdate: false,
        action,
      };
    }
  }

  /**
   * Increment 9: Retrieve pending approval review queue for administrators.
   * Deterministic 5-step FIFO ordering:
   * 1. submittedAt ascending
   * 2. draftUpdatedAt ascending
   * 3. createdAt ascending
   * 4. 0 (epoch start)
   * 5. courseId lexicographical
   */
  public getReviewQueue(user: User): ReviewQueueResponseDTO {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك بعرض قائمة المراجعة', 403);
    }

    const candidates: {
      baseCourse: Course;
      content: Course;
      submissionType: 'new' | 'update';
    }[] = [];

    for (const c of this.courses) {
      if (c.status === 'pending_admin') {
        candidates.push({
          baseCourse: c,
          content: this.courseDrafts[c.id] || c,
          submissionType: 'new',
        });
      } else if ((c.status === 'published' || c.status === 'live') && c.isUpdatePendingApproval === true) {
        candidates.push({
          baseCourse: c,
          content: this.courseDrafts[c.id] || c,
          submissionType: 'update',
        });
      }
    }

    candidates.sort((a, b) => {
      const getSortTime = (base: Course, content?: Course) => {
        const submitted = base.submittedAt || content?.submittedAt;
        if (submitted) {
          const t = new Date(submitted).getTime();
          if (!isNaN(t)) return t;
        }
        const draftUpdated = base.draftUpdatedAt || content?.draftUpdatedAt;
        if (draftUpdated) {
          const t = new Date(draftUpdated).getTime();
          if (!isNaN(t)) return t;
        }
        const created = base.createdAt || content?.createdAt;
        if (created) {
          const t = new Date(created).getTime();
          if (!isNaN(t)) return t;
        }
        return 0;
      };

      const timeA = getSortTime(a.baseCourse, a.content);
      const timeB = getSortTime(b.baseCourse, b.content);

      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return a.baseCourse.id.localeCompare(b.baseCourse.id);
    });

    const items: ReviewQueueItemDTO[] = candidates.map(({ baseCourse, content, submissionType }) => {
      const chapters = content.chapters || [];
      const lessonCount = chapters.reduce((sum, ch) => sum + (ch.items?.length || 0), 0);
      return {
        id: baseCourse.id,
        title: content.title || baseCourse.title,
        thumbnail: content.thumbnail || baseCourse.thumbnail,
        coverType: content.coverType || baseCourse.coverType,
        coverColor: content.coverColor || baseCourse.coverColor,
        lecturerId: baseCourse.lecturerId,
        lecturerName: baseCourse.lecturerName,
        submittedAt: baseCourse.submittedAt || null,
        submissionType,
        status: baseCourse.status,
        chapterCount: chapters.length,
        lessonCount,
        estimatedHours: content.estimatedHours || baseCourse.estimatedHours || 0,
        hasStagedEdits: Boolean(this.stagedAdminEdits[baseCourse.id]),
      };
    });

    return {
      items,
      totalCount: items.length,
    };
  }

  /**
   * Increment 9: Staged Administrator Content Editing with optimistic revision check.
   * Strips protected fields and merges cumulative patch.
   */
  public saveStagedAdminEdits(
    courseId: string,
    payload: AdminStagedEditPayload,
    user: User
  ): StagedEditsSaveResponseDTO {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك بتعديل محتوى المقرر كمسؤول', 403);
    }
    const targetCourse = this.courses.find(
      (c) => c.id.toLowerCase() === courseId.trim().toLowerCase()
    );
    if (!targetCourse) {
      throw new MockStoreError(`تعذر العثور على الدورة التدريبية ${courseId}`, 404);
    }

    const baselineContent = this.courseDrafts[targetCourse.id] || targetCourse;

    const existing = this.stagedAdminEdits[targetCourse.id];
    if (existing && payload.clientRevision <= existing.clientRevision) {
      throw new MockStoreError('تعارض في التعديلات المتزامنة (409 Conflict)', 409);
    }

    const ALLOWED_STAGED_FIELDS: (keyof Course)[] = [
      'title',
      'description',
      'level',
      'estimatedHours',
      'coverType',
      'coverColor',
      'thumbnail',
      'targetJobTitles',
      'prerequisiteCourseId',
      'prerequisiteCourseIds',
      'knowledgePrerequisites',
      'externalResources',
      'courseZipPolicy',
      'chapters',
      'commentsEnabled',
      'refresherConfig',
    ];

    const cleanPatch: Partial<Course> = {};
    if (payload.patch && typeof payload.patch === 'object') {
      for (const key of ALLOWED_STAGED_FIELDS) {
        if (key in payload.patch) {
          Reflect.set(cleanPatch, key, payload.patch[key]);
        }
      }
    }

    const mergedContent: Partial<Course> = {
      ...(existing?.patchedContent || {}),
      ...cleanPatch,
    };

    const effectiveCourse: Course = {
      ...baselineContent,
      ...mergedContent,
      id: targetCourse.id,
    };
    this.validateCourseContentEligibility(effectiveCourse);

    const record: StagedAdminEditsRecord = {
      courseId: targetCourse.id,
      baselineId: payload.baselineId || targetCourse.id,
      baselineSubmittedAt: payload.baselineSubmittedAt || targetCourse.submittedAt || '',
      clientRevision: payload.clientRevision,
      patchedContent: mergedContent,
      lastSavedAt: new Date().toISOString(),
      savedByAdminId: user.id,
      isStale: false,
    };

    this.stagedAdminEdits[targetCourse.id] = record;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`metro_admin_staged_edits_${targetCourse.id}`, JSON.stringify(record));
      } catch {
        // ignore storage errors
      }
    }

    return {
      record: JSON.parse(JSON.stringify(record)),
      message: 'تم حفظ تعديلات الإدارة المؤقتة بنجاح',
    };
  }

  public getStagedAdminEdits(courseId: string, user: User): StagedAdminEditsRecord | null {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك بعرض التعديلات المؤقتة', 403);
    }
    const normId = courseId.trim().toLowerCase();
    const targetCourse = this.courses.find((c) => c.id.toLowerCase() === normId);
    const actualId = targetCourse ? targetCourse.id : courseId;

    if (!this.stagedAdminEdits[actualId] && typeof localStorage !== 'undefined') {
      const persisted = localStorage.getItem(`metro_admin_staged_edits_${actualId}`);
      if (persisted) {
        try {
          this.stagedAdminEdits[actualId] = JSON.parse(persisted);
        } catch {
          // ignore error
        }
      }
    }

    return this.stagedAdminEdits[actualId]
      ? JSON.parse(JSON.stringify(this.stagedAdminEdits[actualId]))
      : null;
  }

  /**
   * Increment 9: Explicitly discard staged administrator content edits.
   * Cleans in-memory record and localStorage persistence without touching course content,
   * published data, audit trail, or unrelated courses.
   */
  public discardStagedAdminEdits(
    courseId: string,
    user: User
  ): DiscardStagedEditsResponseDTO {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك بحذف التعديلات المؤقتة كمسؤول', 403);
    }
    const normId = courseId.trim().toLowerCase();
    const targetCourse = this.courses.find((c) => c.id.toLowerCase() === normId);
    if (!targetCourse) {
      throw new MockStoreError(`تعذر العثور على الدورة التدريبية ${courseId}`, 404);
    }
    const actualId = targetCourse.id;

    delete this.stagedAdminEdits[actualId];
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`metro_admin_staged_edits_${actualId}`);
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      message: 'تم حذف التعديلات المؤقتة بنجاح',
    };
  }

  /**
   * Increment 9: Scoped private reviewer working notes.
   */
  public getReviewerWorkingNotes(courseId: string, user: User): ReviewerWorkingNotes {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك بعرض الملاحظات الخاصة بالمراجعين', 403);
    }
    const normId = courseId.trim().toLowerCase();
    const targetCourse = this.courses.find((c) => c.id.toLowerCase() === normId);
    const actualId = targetCourse ? targetCourse.id : courseId;
    const key = `${user.id}_${actualId}`;
    if (!this.reviewerWorkingNotes[key] && typeof localStorage !== 'undefined') {
      const persisted = localStorage.getItem(`metro_reviewer_notes_${key}`);
      if (persisted) {
        try {
          this.reviewerWorkingNotes[key] = JSON.parse(persisted);
        } catch {
          // ignore
        }
      }
    }
    const defaultNotes: ReviewerWorkingNotes = {
      courseId: actualId,
      reviewerId: user.id,
      generalNote: '',
      chapterNotes: {},
      itemNotes: {},
      lastSavedAt: new Date().toISOString(),
    };
    return this.reviewerWorkingNotes[key]
      ? JSON.parse(JSON.stringify(this.reviewerWorkingNotes[key]))
      : defaultNotes;
  }

  public saveReviewerWorkingNotes(
    courseId: string,
    notes: Partial<ReviewerWorkingNotes>,
    user: User
  ): ReviewerWorkingNotes {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك بحفظ الملاحظات الخاصة بالمراجعين', 403);
    }
    const normId = courseId.trim().toLowerCase();
    const targetCourse = this.courses.find((c) => c.id.toLowerCase() === normId);
    const actualId = targetCourse ? targetCourse.id : courseId;
    const key = `${user.id}_${actualId}`;
    const current = this.reviewerWorkingNotes[key] || {
      courseId: actualId,
      reviewerId: user.id,
      generalNote: '',
      chapterNotes: {},
      itemNotes: {},
      lastSavedAt: new Date().toISOString(),
    };
    const updated: ReviewerWorkingNotes = {
      ...current,
      ...notes,
      courseId: actualId,
      reviewerId: user.id,
      lastSavedAt: new Date().toISOString(),
    };
    this.reviewerWorkingNotes[key] = updated;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`metro_reviewer_notes_${key}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
    return JSON.parse(JSON.stringify(updated));
  }

  /**
   * Increment 9: Scoped private reviewer working note deletion.
   * Deletes only the targeted note (general, chapter, or item) while preserving
   * all other notes, avoiding audit logging, and enforcing admin authorization.
   */
  public deleteReviewerWorkingNote(
    courseId: string,
    targetType: string,
    targetId: string,
    user: User
  ): ReviewerWorkingNotes {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك بحذف الملاحظات الخاصة بالمراجعين', 403);
    }
    const normId = courseId.trim().toLowerCase();
    const targetCourse = this.courses.find((c) => c.id.toLowerCase() === normId);
    if (!targetCourse) {
      throw new MockStoreError(`تعذر العثور على الدورة التدريبية ${courseId}`, 404);
    }
    const actualId = targetCourse.id;

    const normalizedTargetType = targetType.trim().toLowerCase();
    if (!['general', 'chapter', 'item'].includes(normalizedTargetType)) {
      throw new MockStoreError('نوع الملاحظة المستهدفة غير صالح', 400);
    }

    const trimmedTargetId = targetId.trim();
    if (!trimmedTargetId) {
      throw new MockStoreError('معرّف الملاحظة المستهدفة مطلوب', 400);
    }

    if (normalizedTargetType === 'general') {
      if (trimmedTargetId !== 'main') {
        throw new MockStoreError('معرّف الملاحظة العامة غير صالح، يجب استخدام main', 400);
      }
    }

    const key = `${user.id}_${actualId}`;
    const current = this.getReviewerWorkingNotes(actualId, user);
    const chapterNotes = { ...(current.chapterNotes || {}) };
    const itemNotes = { ...(current.itemNotes || {}) };
    let generalNote = current.generalNote || '';

    if (normalizedTargetType === 'general') {
      generalNote = '';
    } else if (normalizedTargetType === 'chapter') {
      delete chapterNotes[trimmedTargetId];
    } else if (normalizedTargetType === 'item') {
      delete itemNotes[trimmedTargetId];
    }

    const updated: ReviewerWorkingNotes = {
      courseId: actualId,
      reviewerId: user.id,
      generalNote,
      chapterNotes,
      itemNotes,
      lastSavedAt: new Date().toISOString(),
    };

    this.reviewerWorkingNotes[key] = updated;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`metro_reviewer_notes_${key}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    return JSON.parse(JSON.stringify(updated));
  }

  /**
   * Increment 9: Retrieve submitted courses overview for lecturer approvals dashboard.
   */
  public getLecturerSubmissions(user: User): LecturerSubmissionsResponseDTO {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك باستعراض التقديمات', 403);
    }

    let relevantCourses: Course[];
    if (user.role === 'admin') {
      relevantCourses = this.courses;
    } else {
      relevantCourses = this.courses.filter((c) => this.isAuthorizedLecturer(c, user));
    }

    const items: LecturerSubmissionItemDTO[] = relevantCourses.map((c) => {
      const draft = this.courseDrafts[c.id];
      const effective = draft || c;
      const chapters = effective.chapters || [];
      const lessonCount = chapters.reduce((sum, ch) => sum + (ch.items?.length || 0), 0);

      let reviewState: 'pending' | 'needs_revision' | 'approved' | 'draft' = 'draft';
      if (c.status === 'pending_admin' || c.isUpdatePendingApproval === true) {
        reviewState = 'pending';
      } else if (
        c.activeReviewFeedback &&
        (c.activeReviewFeedback.outcome === 'rejected' ||
          c.activeReviewFeedback.outcome === 'returned_with_admin_edits')
      ) {
        reviewState = 'needs_revision';
      } else if (c.status === 'published' || c.status === 'live') {
        reviewState = 'approved';
      }

      return {
        id: c.id,
        title: effective.title || c.title,
        thumbnail: effective.thumbnail || c.thumbnail,
        coverType: effective.coverType || c.coverType,
        coverColor: effective.coverColor || c.coverColor,
        status: c.status,
        isUpdatePendingApproval: Boolean(c.isUpdatePendingApproval),
        hasDraft: Boolean(draft),
        submittedAt: c.submittedAt || null,
        draftUpdatedAt: draft?.draftUpdatedAt || null,
        chapterCount: chapters.length,
        lessonCount,
        activeReviewFeedback: c.activeReviewFeedback || null,
        reviewState,
      };
    });

    const counts = {
      pending: items.filter((i) => i.reviewState === 'pending').length,
      needsRevision: items.filter((i) => i.reviewState === 'needs_revision').length,
      approved: items.filter((i) => i.reviewState === 'approved').length,
      draft: items.filter((i) => i.reviewState === 'draft').length,
    };

    return {
      items,
      totalCount: items.length,
      counts,
    };
  }

  /**
   * Increment 9: Retrieve authoritative review data (baseline, draft, staged edits, feedback, audit trail).
   */
  public getCourseReviewData(courseId: string, user: User): CourseReviewDataResponseDTO {
    if (user.role === 'user') {
      throw new MockStoreError('غير مصرح لك باستعراض بيانات مراجعة المقرر', 403);
    }

    const targetCourse = this.courses.find(
      (c) => c.id.toLowerCase() === courseId.trim().toLowerCase()
    );
    if (!targetCourse) {
      throw new MockStoreError(`تعذر العثور على المقرر ${courseId}`, 404);
    }

    if (user.role !== 'admin' && !this.isAuthorizedLecturer(targetCourse, user)) {
      throw new MockStoreError('غير مصرح لك باستعراض بيانات هذا المقرر', 403);
    }

    const draft = this.courseDrafts[targetCourse.id] || null;
    const isPublished = targetCourse.status === 'published' || targetCourse.status === 'live';
    const isPublishedUpdate = Boolean(isPublished && targetCourse.isUpdatePendingApproval);
    const submissionType: 'new' | 'update' = isPublishedUpdate ? 'update' : 'new';

    // Staged edits: only admins have access to staged admin edits in-flight
    let stagedRecord: StagedAdminEditsRecord | null = null;
    if (user.role === 'admin') {
      stagedRecord = this.stagedAdminEdits[targetCourse.id] || null;
      if (!stagedRecord && typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(`metro_admin_staged_edits_${targetCourse.id}`);
          if (raw) stagedRecord = JSON.parse(raw);
        } catch {
          // ignore
        }
      }
    }

    const contentBaseline = draft || targetCourse;
    const effectiveContent: Course =
      stagedRecord && stagedRecord.patchedContent
        ? {
            ...contentBaseline,
            ...stagedRecord.patchedContent,
            id: targetCourse.id,
          }
        : JSON.parse(JSON.stringify(contentBaseline));

    return {
      course: JSON.parse(JSON.stringify(targetCourse)),
      draft: draft ? JSON.parse(JSON.stringify(draft)) : null,
      effectiveContent,
      stagedEdits: stagedRecord ? JSON.parse(JSON.stringify(stagedRecord)) : null,
      activeReviewFeedback: targetCourse.activeReviewFeedback
        ? JSON.parse(JSON.stringify(targetCourse.activeReviewFeedback))
        : null,
      auditLog: targetCourse.auditLog ? JSON.parse(JSON.stringify(targetCourse.auditLog)) : [],
      submissionType,
      isPublishedUpdate,
    };
  }

  /**
   * Increment 9: Execute Review Decision (Outcome A, B, or C).
   * Outcome A: approve (with optional staged edits choice & approval note).
   * Outcome B: return with admin edits (captures baselineSnapshot & adminEditedSnapshot).
   * Outcome C: reject without committing staged edits (retains staged edits as stale).
   */
  public executeReviewDecision(
    courseId: string,
    decisionPayload: ReviewDecisionRequestDTO,
    user: User
  ): ReviewDecisionResponseDTO {
    if (user.role !== 'admin') {
      throw new MockStoreError('غير مصرح لك باتخاذ قرار المراجعة', 403);
    }
    const targetCourse = this.courses.find(
      (c) => c.id.toLowerCase() === courseId.trim().toLowerCase()
    );
    if (!targetCourse) {
      throw new MockStoreError(`تعذر العثور على الدورة التدريبية ${courseId}`, 404);
    }

    const isPublished = targetCourse.status === 'published' || targetCourse.status === 'live';
    const isPendingReview =
      targetCourse.status === 'pending_admin' ||
      (isPublished && targetCourse.isUpdatePendingApproval === true);

    if (!isPendingReview) {
      throw new MockStoreError('المقرر غير موجود في قائمة انتظار الاعتماد', 400);
    }

    const submittedBaseline: Course = isPublished
      ? (() => {
          const draft = this.courseDrafts[targetCourse.id];
          if (!draft) {
            throw new MockStoreError(
              'تعذر العثور على مسودة التعديلات للمقرر المنشور',
              409,
              'DRAFT_INTEGRITY_ERROR'
            );
          }
          return draft;
        })()
      : (this.courseDrafts[targetCourse.id] || targetCourse);

    const createSnapshot = (content: Course): CourseBaselineSnapshot => ({
      id: content.id,
      title: content.title,
      description: content.description,
      level: content.level,
      estimatedHours: content.estimatedHours,
      coverType: content.coverType,
      coverColor: content.coverColor,
      thumbnail: content.thumbnail,
      targetJobTitles: content.targetJobTitles ? [...content.targetJobTitles] : [],
      prerequisiteCourseId: content.prerequisiteCourseId,
      courseZipPolicy: content.courseZipPolicy,
      externalResources: content.externalResources
        ? JSON.parse(JSON.stringify(content.externalResources))
        : [],
      chapters: JSON.parse(JSON.stringify(content.chapters || [])),
      capturedAt: new Date().toISOString(),
      submittedAt: targetCourse.submittedAt,
    });

    const decisionTimestamp = new Date().toISOString();

    if (decisionPayload.outcome === 'approved') {
      const staged = this.stagedAdminEdits[targetCourse.id];
      const shouldUseStaged =
        decisionPayload.publishOption === 'with_staged_edits' &&
        staged &&
        staged.patchedContent &&
        Object.keys(staged.patchedContent).length > 0;

      const finalApprovedContent: Course = shouldUseStaged
        ? {
            ...submittedBaseline,
            ...staged.patchedContent,
            id: targetCourse.id,
          }
        : { ...submittedBaseline, id: targetCourse.id };

      this.validateCourseContentEligibility(finalApprovedContent);

      if (isPublished) {
        Object.assign(targetCourse, finalApprovedContent, {
          status: 'published' as CourseStatus,
          isUpdatePendingApproval: false,
          hasDraftChanges: false,
        });
        delete this.courseDrafts[targetCourse.id];
      } else {
        Object.assign(targetCourse, finalApprovedContent, {
          status: 'published' as CourseStatus,
        });
        if (this.courseDrafts[targetCourse.id]) {
          delete this.courseDrafts[targetCourse.id];
        }
      }

      if (shouldUseStaged) {
        targetCourse.lastEditedByAdminId = user.id;
        targetCourse.lastEditedByAdminName = user.name;
        targetCourse.adminEditedAt = decisionTimestamp;
      }

      targetCourse.activeReviewFeedback = null;
      delete this.stagedAdminEdits[targetCourse.id];
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`metro_admin_staged_edits_${targetCourse.id}`);
      }

      const auditEntry: CourseAuditLogEntry = {
        id: `AUD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        courseId: targetCourse.id,
        action: 'approved',
        actorId: user.id,
        actorName: user.name,
        actorRole: 'admin',
        timestamp: decisionTimestamp,
        summary: shouldUseStaged
          ? `تم اعتماد ونشر المقرر مع تعديلات إدارة الجودة بواسطة ${user.name}`
          : `تم اعتماد ونشر المقرر بواسطة مدير النظام ${user.name}`,
        approvalNote: decisionPayload.approvalNote?.trim() || undefined,
        baselineSnapshot: shouldUseStaged ? createSnapshot(submittedBaseline) : undefined,
        adminEditedSnapshot: shouldUseStaged ? createSnapshot(finalApprovedContent) : undefined,
      };

      if (!targetCourse.auditLog) targetCourse.auditLog = [];
      targetCourse.auditLog.push(auditEntry);

      if (this.courseDrafts[targetCourse.id]) {
        this.courseDrafts[targetCourse.id].auditLog = targetCourse.auditLog;
      }

      this.notifications.unshift({
        id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: targetCourse.lecturerId,
        type: 'content_approved',
        title: 'تم اعتماد ونشر المقرر',
        message: `تم اعتماد ونشر المقرر "${targetCourse.title}" بنجاح.`,
        courseId: targetCourse.id,
        read: false,
        createdAt: decisionTimestamp,
      });

      this.recordAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorRole: 'admin',
        action: 'courses.publish',
        actionLabelAr: 'اعتماد ونشر مقرر',
        severity: 'info',
        outcome: 'success',
        resourceType: 'course',
        targetResourceId: targetCourse.id,
        targetResourceName: targetCourse.title,
        details: `تم اعتماد ونشر المقرر التدريبي في المنصة: ${targetCourse.title}`,
      });

      return {
        course: JSON.parse(JSON.stringify(targetCourse)),
        message: 'تم اعتماد ونشر المقرر بنجاح',
        outcome: 'approved',
        auditEntry,
      };
    }

    if (decisionPayload.outcome === 'returned_with_admin_edits') {
      const staged = this.stagedAdminEdits[targetCourse.id];
      if (!staged || !staged.patchedContent || Object.keys(staged.patchedContent).length === 0) {
        throw new MockStoreError('لا توجد تعديلات إدارة مؤقتة لإعادة المقرر بها', 400);
      }
      if (!decisionPayload.summaryMessage || decisionPayload.summaryMessage.trim().length === 0) {
        throw new MockStoreError('رسالة التغذية الراجعة مطلوبة عند إعادة المقرر للمحاضر', 422);
      }

      const baselineSnapshot = createSnapshot(submittedBaseline);
      const adminEditedCourse: Course = {
        ...submittedBaseline,
        ...staged.patchedContent,
        id: targetCourse.id,
      };
      this.validateCourseContentEligibility(adminEditedCourse);
      const adminEditedSnapshot = createSnapshot(adminEditedCourse);

      const feedback: CourseActiveReviewFeedback = {
        outcome: 'returned_with_admin_edits',
        reviewerId: user.id,
        reviewerName: user.name,
        reviewedAt: decisionTimestamp,
        summaryMessage: decisionPayload.summaryMessage.trim(),
        items: decisionPayload.items || [],
        stagedEditsApplied: true,
      };

      if (isPublished) {
        targetCourse.isUpdatePendingApproval = false;
        targetCourse.hasDraftChanges = true;
        targetCourse.activeReviewFeedback = feedback;
        this.courseDrafts[targetCourse.id] = JSON.parse(JSON.stringify(adminEditedCourse));
        this.courseDrafts[targetCourse.id].activeReviewFeedback = feedback;
      } else {
        Object.assign(targetCourse, adminEditedCourse, {
          status: 'draft' as CourseStatus,
        });
        targetCourse.activeReviewFeedback = feedback;
        if (this.courseDrafts[targetCourse.id]) {
          this.courseDrafts[targetCourse.id] = JSON.parse(JSON.stringify(adminEditedCourse));
          this.courseDrafts[targetCourse.id].status = 'draft';
          this.courseDrafts[targetCourse.id].activeReviewFeedback = feedback;
        }
      }

      targetCourse.lastEditedByAdminId = user.id;
      targetCourse.lastEditedByAdminName = user.name;
      targetCourse.adminEditedAt = decisionTimestamp;

      delete this.stagedAdminEdits[targetCourse.id];
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`metro_admin_staged_edits_${targetCourse.id}`);
      }

      const auditEntry: CourseAuditLogEntry = {
        id: `AUD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        courseId: targetCourse.id,
        action: 'returned_with_admin_edits',
        actorId: user.id,
        actorName: user.name,
        actorRole: 'admin',
        timestamp: decisionTimestamp,
        summary: `تمت إعادة المقرر للمحاضر مع تعديلات إدارة الجودة بواسطة ${user.name}`,
        feedback,
        baselineSnapshot,
        adminEditedSnapshot,
      };

      if (!targetCourse.auditLog) targetCourse.auditLog = [];
      targetCourse.auditLog.push(auditEntry);

      if (this.courseDrafts[targetCourse.id]) {
        this.courseDrafts[targetCourse.id].auditLog = targetCourse.auditLog;
      }

      this.notifications.unshift({
        id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: targetCourse.lecturerId,
        type: 'content_rejected',
        title: 'تمت إعادة المقرر مع تعديلات الإدارة',
        message: `قام مدير النظام ${user.name} بإجراء تعديلات على المقرر "${targetCourse.title}" وإعادته لمراجعتك.`,
        courseId: targetCourse.id,
        read: false,
        createdAt: decisionTimestamp,
      });

      return {
        course: JSON.parse(JSON.stringify(targetCourse)),
        message: 'تمت إعادة المقرر للمحاضر مع تعديلات الإدارة بنجاح',
        outcome: 'returned_with_admin_edits',
        auditEntry,
      };
    }

    if (decisionPayload.outcome === 'rejected') {
      if (!decisionPayload.summaryMessage || decisionPayload.summaryMessage.trim().length === 0) {
        throw new MockStoreError('سبب الرفض والتغذية الراجعة مطلوبة عند إعادة المقرر', 422);
      }

      // Staged edits are NOT committed! Retained as stale.
      if (this.stagedAdminEdits[targetCourse.id]) {
        this.stagedAdminEdits[targetCourse.id].isStale = true;
      }

      const feedback: CourseActiveReviewFeedback = {
        outcome: 'rejected',
        reviewerId: user.id,
        reviewerName: user.name,
        reviewedAt: decisionTimestamp,
        summaryMessage: decisionPayload.summaryMessage.trim(),
        items: decisionPayload.items || [],
        stagedEditsApplied: false,
      };

      if (isPublished) {
        targetCourse.isUpdatePendingApproval = false;
        targetCourse.activeReviewFeedback = feedback;
        if (this.courseDrafts[targetCourse.id]) {
          this.courseDrafts[targetCourse.id].activeReviewFeedback = feedback;
        }
      } else {
        targetCourse.status = 'draft';
        targetCourse.activeReviewFeedback = feedback;
        if (this.courseDrafts[targetCourse.id]) {
          this.courseDrafts[targetCourse.id].status = 'draft';
          this.courseDrafts[targetCourse.id].activeReviewFeedback = feedback;
        }
      }

      const auditEntry: CourseAuditLogEntry = {
        id: `AUD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        courseId: targetCourse.id,
        action: 'rejected',
        actorId: user.id,
        actorName: user.name,
        actorRole: 'admin',
        timestamp: decisionTimestamp,
        summary: `تم رفض المقرر وإعادته للمحاضر بواسطة ${user.name}`,
        feedback,
      };

      if (!targetCourse.auditLog) targetCourse.auditLog = [];
      targetCourse.auditLog.push(auditEntry);

      if (this.courseDrafts[targetCourse.id]) {
        this.courseDrafts[targetCourse.id].auditLog = targetCourse.auditLog;
      }

      this.notifications.unshift({
        id: `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: targetCourse.lecturerId,
        type: 'content_rejected',
        title: 'تمت إعادة المقرر لطلب تعديلات',
        message: `تمت إعادة المقرر "${targetCourse.title}" لإجراء التعديلات المطلوبة.`,
        courseId: targetCourse.id,
        read: false,
        createdAt: decisionTimestamp,
      });

      return {
        course: JSON.parse(JSON.stringify(targetCourse)),
        message: 'تمت إعادة المقرر للمحاضر لإجراء التعديلات',
        outcome: 'rejected',
        auditEntry,
      };
    }

    throw new MockStoreError('قرار المراجعة غير معروف', 400);
  }

  // ── Increment 10: Training Groups Lifecycle & Membership ────────────

  /**
   * Create a new training group with an initial baseline renewal cycle (Cycle 1).
   */
  public createGroup(dto: CreateGroupRequestDTO): TrainingGroup {
    const dateVal = validateDateRange(dto.startDateTime, dto.deadlineDateTime);
    if (!dateVal.isValid) {
      throw new MockStoreError(dateVal.error || 'نطاق التاريخ غير صالح', 422);
    }

    const groupId = `GRP-${100 + this.groups.length + 1}`;
    const code = `${dto.name.slice(0, 3).toUpperCase()}-SEC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const group: TrainingGroup = {
      id: groupId,
      name: dto.name.trim(),
      description: dto.description.trim(),
      adminStatus: dto.adminStatus || 'active',
      enrollmentPolicy: dto.enrollmentPolicy || 'open',
      isEnrollmentOpen: dto.isEnrollmentOpen ?? true,
      enrollmentCode: code,
      enrollmentExpiresAt: dto.enrollmentExpiresAt ?? null,
      maxTrainees: dto.maxTrainees ?? null,
      startDateTime: dto.startDateTime,
      deadlineDateTime: dto.deadlineDateTime,
      postDeadlinePolicy: dto.postDeadlinePolicy,
      courses: (dto.courseAssignments || []).map((ca, idx) => ({
        courseId: ca.courseId,
        order: ca.order || idx + 1,
        customStartDateTime: ca.customStartDateTime,
        customDeadlineDateTime: ca.customDeadlineDateTime,
        customPostDeadlinePolicy: ca.customPostDeadlinePolicy,
      })),
      courseId: dto.courseAssignments?.[0]?.courseId || 'CRS001',
      traineeIds: [],
      supervisorIds: dto.supervisorIds || [],
      resources: dto.resources || [],
      renewalSchedule: migrateLegacyRecurrenceType(dto.renewalSchedule),
      foldersCount: 0,
      filesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.groups.push(group);
    this.groupMembers[group.id] = [];

    // Create baseline Cycle 1
    const cycle1: GroupRenewalCycle = {
      id: `CYC-${group.id}-01`,
      groupId: group.id,
      cycleNumber: 1,
      title: `${group.name} — دورة التدريب الافتتاحية`,
      status: 'active',
      startDateTime: group.startDateTime,
      deadlineDateTime: group.deadlineDateTime,
      postDeadlinePolicy: group.postDeadlinePolicy,
      courses: (dto.courseAssignments || []).map((ca, idx) => ({
        courseId: ca.courseId,
        courseRole: ca.courseRole || 'core',
        order: ca.order || idx + 1,
        customStartDateTime: ca.customStartDateTime,
        customDeadlineDateTime: ca.customDeadlineDateTime,
        customPostDeadlinePolicy: ca.customPostDeadlinePolicy,
      })),
      traineeIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.renewalCycles.push(cycle1);
    group.currentCycleId = cycle1.id;

    // Enroll initial trainees if provided
    if (dto.initialTraineeIds && dto.initialTraineeIds.length > 0) {
      for (const tid of dto.initialTraineeIds) {
        this.addGroupMember(group.id, tid, 'admin_assigned');
      }
    }

    this.recordAuditLog({
      actorId: 'usr_admin_001',
      action: 'groups.create',
      actionLabelAr: 'إنشاء مجموعة تدريبية',
      severity: 'info',
      outcome: 'success',
      resourceType: 'group',
      targetResourceId: group.id,
      targetResourceName: group.name,
      details: `تم إنشاء المجموعة التدريبية (${group.name}) وتدشين دورة التجديد الأولى`,
    });

    return group;
  }

  /**
   * Update training group metadata, dates, policies, and schedules.
   */
  public updateGroup(groupId: string, dto: UpdateGroupRequestDTO): TrainingGroup {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    if (dto.startDateTime || dto.deadlineDateTime) {
      const newStart = dto.startDateTime || group.startDateTime;
      const newDeadline = dto.deadlineDateTime || group.deadlineDateTime;
      const dateVal = validateDateRange(newStart, newDeadline);
      if (!dateVal.isValid) {
        throw new MockStoreError(dateVal.error || 'نطاق التاريخ غير صالح', 422);
      }
      group.startDateTime = newStart;
      group.deadlineDateTime = newDeadline;
    }

    if (dto.name !== undefined) group.name = dto.name.trim();
    if (dto.description !== undefined) group.description = dto.description.trim();
    if (dto.adminStatus !== undefined) group.adminStatus = dto.adminStatus;
    if (dto.enrollmentPolicy !== undefined) group.enrollmentPolicy = dto.enrollmentPolicy;
    if (dto.postDeadlinePolicy !== undefined) group.postDeadlinePolicy = dto.postDeadlinePolicy;
    if (dto.supervisorIds !== undefined) group.supervisorIds = dto.supervisorIds;
    if (dto.isEnrollmentOpen !== undefined) group.isEnrollmentOpen = dto.isEnrollmentOpen;
    if (dto.enrollmentExpiresAt !== undefined) group.enrollmentExpiresAt = dto.enrollmentExpiresAt;
    if (dto.maxTrainees !== undefined) group.maxTrainees = dto.maxTrainees;
    if (dto.renewalSchedule !== undefined) {
      group.renewalSchedule = migrateLegacyRecurrenceType(dto.renewalSchedule);
    }
    if (dto.resources !== undefined) group.resources = dto.resources;
    group.updatedAt = new Date().toISOString();

    this.recordAuditLog({
      actorId: 'usr_admin_001',
      action: 'groups.edit_config',
      actionLabelAr: 'تعديل إعدادات المجموعة التدريبية',
      severity: 'info',
      outcome: 'success',
      resourceType: 'group',
      targetResourceId: group.id,
      targetResourceName: group.name,
      details: `تم تعديل بيانات وإعدادات المجموعة التدريبية (${group.name})`,
    });

    return group;
  }

  /**
   * Archive a training group, locking it from new enrollments.
   */
  public archiveGroup(groupId: string): TrainingGroup {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    group.adminStatus = 'archived';
    group.isEnrollmentOpen = false;
    group.updatedAt = new Date().toISOString();

    this.recordAuditLog({
      actorId: 'usr_admin_001',
      action: 'groups.archive',
      actionLabelAr: 'أرشفة مجموعة تدريبية',
      severity: 'warning',
      outcome: 'success',
      resourceType: 'group',
      targetResourceId: group.id,
      targetResourceName: group.name,
      details: `تمت أرشفة المجموعة التدريبية (${group.name}) وإغلاق التسجيل بها`,
    });

    return group;
  }

  /**
   * Safe deletion or safe archival of a training group.
   * If dependent data exists (members, completed cycles, started attempts, or materials),
   * the group is safely archived instead of permanently deleted.
   */
  public deleteGroup(groupId: string): { success: boolean; message: string; archivedInstead?: boolean } {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const hasMembers = (group.traineeIds && group.traineeIds.length > 0) ||
      (this.groupMembers[group.id] && this.groupMembers[group.id].length > 0);
    const hasCompletedCycles = this.renewalCycles.some(
      (c) => c.groupId.toLowerCase() === groupId.toLowerCase() && c.status === 'completed'
    );
    const hasStartedAttempts = this.courseAttempts.some(
      (a) => a.groupId?.toLowerCase() === groupId.toLowerCase() && isAttemptStarted(a)
    );
    const hasMaterialFiles = this.materialFiles.some(
      (f) => f.groupId.toLowerCase() === groupId.toLowerCase()
    );

    if (hasMembers || hasCompletedCycles || hasStartedAttempts || hasMaterialFiles) {
      group.adminStatus = 'archived';
      group.isEnrollmentOpen = false;
      group.updatedAt = new Date().toISOString();

      this.recordAuditLog({
        actorId: 'usr_admin_001',
        action: 'groups.delete',
        actionLabelAr: 'حذف مجموعة تدريبية',
        severity: 'critical',
        outcome: 'success',
        resourceType: 'group',
        targetResourceId: group.id,
        targetResourceName: group.name,
        details: `تم تحويل حذف المجموعة (${group.name}) إلى أرشفة آمنة لوجود سجلات تاريخية وبيانات متدربين`,
        metadata: { archivedInstead: true },
      });

      return {
        success: true,
        archivedInstead: true,
        message: 'تمت أرشفة المجموعة التدريبية بأمان بدلاً من الحذف لاحتوائها على سجلات تاريخية وبيانات متدربين.',
      };
    }

    // Completely empty draft or inactive group
    this.groups = this.groups.filter((g) => g.id.toLowerCase() !== groupId.toLowerCase());
    this.renewalCycles = this.renewalCycles.filter((c) => c.groupId.toLowerCase() !== groupId.toLowerCase());
    this.materialFolders = this.materialFolders.filter((f) => f.groupId.toLowerCase() !== groupId.toLowerCase());
    this.materialFiles = this.materialFiles.filter((f) => f.groupId.toLowerCase() !== groupId.toLowerCase());
    delete this.groupMembers[group.id];

    this.recordAuditLog({
      actorId: 'usr_admin_001',
      action: 'groups.delete',
      actionLabelAr: 'حذف مجموعة تدريبية',
      severity: 'critical',
      outcome: 'success',
      resourceType: 'group',
      targetResourceId: group.id,
      targetResourceName: group.name,
      details: `تم حذف المجموعة التدريبية (${group.name}) نهائياً من المنظومة`,
      metadata: { archivedInstead: false },
    });

    return {
      success: true,
      archivedInstead: false,
      message: 'تم حذف المجموعة بنجاح.',
    };
  }

  /**
   * Add a trainee to a training group with idempotent course enrollment synchronization.
   */
  public addGroupMember(
    groupId: string,
    traineeId: string,
    joinSource: GroupMember['joinSource'] = 'admin_assigned'
  ): { group: TrainingGroup; member: GroupMember; alreadyMember: boolean; newlyEnrolledCoursesCount: number } {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const normalizedTraineeId = traineeId.trim();

    // Capacity check
    if (
      group.maxTrainees &&
      (group.traineeIds || []).length >= group.maxTrainees &&
      !(group.traineeIds || []).some((tid) => tid.toLowerCase() === normalizedTraineeId.toLowerCase())
    ) {
      throw new MockStoreError('عذراً، اكتمل العدد الأقصى للمتدربين في هذه المجموعة', 409);
    }

    // Check if already a member
    const isAlready = (group.traineeIds || []).some(
      (tid) => tid.toLowerCase() === normalizedTraineeId.toLowerCase()
    );

    if (isAlready) {
      const existingMember = (this.groupMembers[group.id] || []).find(
        (m) => m.userId.toLowerCase() === normalizedTraineeId.toLowerCase()
      ) || {
        userId: normalizedTraineeId,
        name: this.resolveMockUserMeta(normalizedTraineeId).name,
        email: this.resolveMockUserMeta(normalizedTraineeId).email,
        joinedAt: new Date().toISOString(),
        joinSource,
      };
      return { group, member: existingMember, alreadyMember: true, newlyEnrolledCoursesCount: 0 };
    }

    // Add trainee ID to group
    if (!group.traineeIds) group.traineeIds = [];
    group.traineeIds.push(normalizedTraineeId);

    // Add to current renewal cycle if present
    const currentCycle = this.getCurrentGroupCycle(group.id);
    if (currentCycle && !currentCycle.traineeIds.some((tid) => tid.toLowerCase() === normalizedTraineeId.toLowerCase())) {
      currentCycle.traineeIds.push(normalizedTraineeId);
    }

    // Create member entity
    const meta = this.resolveMockUserMeta(normalizedTraineeId);
    const member: GroupMember = {
      userId: normalizedTraineeId,
      name: meta.name,
      email: meta.email,
      department: meta.department,
      jobTitle: meta.jobTitle,
      joinedAt: new Date().toISOString(),
      joinSource,
    };
    if (!this.groupMembers[group.id]) this.groupMembers[group.id] = [];
    this.groupMembers[group.id].push(member);

    // Idempotent Course Enrollment Synchronization
    let newlyEnrolled = 0;
    const targetCourses = currentCycle ? currentCycle.courses : (group.courses || []);

    for (const assignment of targetCourses) {
      const existingEnrollment = this.enrollments.find(
        (e) =>
          e.userId.toLowerCase() === normalizedTraineeId.toLowerCase() &&
          e.courseId.toLowerCase() === assignment.courseId.toLowerCase()
      );

      if (!existingEnrollment) {
        const newEnrollment: CourseEnrollment = {
          id: `ENR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          courseId: assignment.courseId,
          userId: normalizedTraineeId,
          enrolledAt: new Date().toISOString(),
          status: 'active',
        };
        this.enrollments.push(newEnrollment);
        const course = this.getCourseById(assignment.courseId);
        if (course) course.enrollmentCount = (course.enrollmentCount || 0) + 1;
        newlyEnrolled++;
      }

      // Provision unstarted CourseAttempt if not already present
      const cycleId = currentCycle?.id || null;
      const existingAttempt = this.courseAttempts.find(
        (a) =>
          a.userId.toLowerCase() === normalizedTraineeId.toLowerCase() &&
          a.courseId.toLowerCase() === assignment.courseId.toLowerCase() &&
          a.cycleId === cycleId
      );

      if (!existingAttempt) {
        const attempt = createCourseAttempt({
          id: `ATT-${normalizedTraineeId}-${assignment.courseId}-${cycleId || 'standalone'}`,
          userId: normalizedTraineeId,
          courseId: assignment.courseId,
          cycleId,
          groupId: group.id,
          courseRole: 'courseRole' in assignment ? (assignment as { courseRole?: CourseRole }).courseRole : 'core',
        });
        this.courseAttempts.push(attempt);
      }
    }

    return { group, member, alreadyMember: false, newlyEnrolledCoursesCount: newlyEnrolled };
  }

  /**
   * Remove a trainee from a training group.
   * Strictly preserves existing individual CourseEnrollment records, certificates, and attempts.
   */
  public removeGroupMember(groupId: string, traineeId: string): { success: boolean; message: string } {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const normalizedTraineeId = traineeId.trim().toLowerCase();

    group.traineeIds = (group.traineeIds || []).filter(
      (tid) => tid.toLowerCase() !== normalizedTraineeId
    );

    const currentCycle = this.getCurrentGroupCycle(group.id);
    if (currentCycle) {
      currentCycle.traineeIds = (currentCycle.traineeIds || []).filter(
        (tid) => tid.toLowerCase() !== normalizedTraineeId
      );
    }

    if (this.groupMembers[group.id]) {
      this.groupMembers[group.id] = this.groupMembers[group.id].filter(
        (m) => m.userId.toLowerCase() !== normalizedTraineeId
      );
    }

    return {
      success: true,
      message: 'تم إخراج المتدرب من المجموعة التدريبية بنجاح مع الحفاظ الكامل على سجلاته التدريبية ومقرراته المسجلة.',
    };
  }

  /**
   * Get all members for a specific group.
   */
  public getGroupMembers(groupId: string): GroupMember[] {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }
    return this.groupMembers[group.id] || [];
  }

  // ── Increment 10: Renewal Cycles & Cycle Course Assignments ─────────

  /**
   * Create a new renewal cycle, sealing the previous cycle and provisioning fresh attempts.
   */
  public createRenewalCycle(
    groupId: string,
    dto: RenewGroupCycleRequestDTO
  ): { previousCycle: GroupRenewalCycle | null; newCycle: GroupRenewalCycle; group: TrainingGroup } {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const dateVal = validateDateRange(dto.startDateTime, dto.deadlineDateTime);
    if (!dateVal.isValid) {
      throw new MockStoreError(dateVal.error || 'نطاق تاريخ دورة التجديد غير صالح', 422);
    }

    const normalizedCourses: GroupCycleCourseAssignment[] = dto.courses.map((c, idx) => ({
      courseId: c.courseId,
      courseRole: c.courseRole,
      order: c.order || idx + 1,
      customStartDateTime: c.customStartDateTime,
      customDeadlineDateTime: c.customDeadlineDateTime,
      customPostDeadlinePolicy: c.customPostDeadlinePolicy,
    }));

    const courseVal = validateCycleCourseAssignments(normalizedCourses);
    if (!courseVal.isValid) {
      throw new MockStoreError(courseVal.error || 'مقررات دورة التجديد غير صالحة', 422);
    }

    // Seal previous active cycle
    let previousCycle: GroupRenewalCycle | null = null;
    const activeCycle = this.renewalCycles.find(
      (c) => c.groupId.toLowerCase() === group.id.toLowerCase() && c.status === 'active'
    );

    if (activeCycle) {
      activeCycle.status = 'completed';
      activeCycle.completedAt = new Date().toISOString();
      activeCycle.updatedAt = new Date().toISOString();
      previousCycle = activeCycle;

      // Finalize uncompleted attempts in closing cycle
      for (const att of this.courseAttempts) {
        if (att.cycleId === activeCycle.id && att.status !== 'completed') {
          att.status = 'expired_incomplete';
          att.updatedAt = new Date().toISOString();
        }
      }
    }

    // Determine next cycle number
    const groupCycles = this.renewalCycles.filter(
      (c) => c.groupId.toLowerCase() === group.id.toLowerCase()
    );
    const nextCycleNumber =
      groupCycles.length > 0 ? Math.max(...groupCycles.map((c) => c.cycleNumber)) + 1 : 1;
    const newCycleId = `CYC-${group.id}-${String(nextCycleNumber).padStart(2, '0')}`;

    const newCycle: GroupRenewalCycle = {
      id: newCycleId,
      groupId: group.id,
      cycleNumber: nextCycleNumber,
      title: dto.title.trim(),
      status: 'active',
      startDateTime: dto.startDateTime,
      deadlineDateTime: dto.deadlineDateTime,
      postDeadlinePolicy: dto.postDeadlinePolicy || group.postDeadlinePolicy,
      courses: normalizedCourses,
      traineeIds: [...(group.traineeIds || [])],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.renewalCycles.push(newCycle);
    group.currentCycleId = newCycle.id;

    // Update group courses to match current cycle courses
    group.courses = newCycle.courses.map((c) => ({
      courseId: c.courseId,
      order: c.order,
      customStartDateTime: c.customStartDateTime,
      customDeadlineDateTime: c.customDeadlineDateTime,
      customPostDeadlinePolicy: c.customPostDeadlinePolicy,
    }));
    group.updatedAt = new Date().toISOString();

    // Provision fresh unstarted CourseAttempts for active members
    for (const tid of group.traineeIds || []) {
      for (const c of newCycle.courses) {
        // Synchronize course enrollment if not enrolled
        const existingEnr = this.enrollments.find(
          (e) =>
            e.userId.toLowerCase() === tid.toLowerCase() &&
            e.courseId.toLowerCase() === c.courseId.toLowerCase()
        );
        if (!existingEnr) {
          this.enrollments.push({
            id: `ENR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            courseId: c.courseId,
            userId: tid,
            enrolledAt: new Date().toISOString(),
            status: 'active',
          });
          const targetCourse = this.getCourseById(c.courseId);
          if (targetCourse) targetCourse.enrollmentCount = (targetCourse.enrollmentCount || 0) + 1;
        }

        // Fresh unstarted attempt
        const attempt = createCourseAttempt({
          id: `ATT-${tid}-${c.courseId}-${newCycle.id}`,
          userId: tid,
          courseId: c.courseId,
          cycleId: newCycle.id,
          groupId: group.id,
          courseRole: c.courseRole,
        });
        this.courseAttempts.push(attempt);
      }
    }

    return { previousCycle, newCycle, group };
  }

  /**
   * Check if a scheduled renewal cycle is due for the given group, and if so,
   * automatically seals the current cycle, creates the new cycle starting at the scheduled date,
   * preserves historical attempts, synchronizes enrollments, and resets new attempts at 0% unstarted.
   *
   * Idempotency guarantee:
   * Uses group.renewalSchedule.lastAutoRenewedCycleId to ensure that the current cycle is auto-renewed
   * at most once for its scheduled date.
   */
  public checkAndProcessAutoRenewal(
    groupId: string,
    now: Date = new Date()
  ): { renewed: boolean; cycle?: GroupRenewalCycle } {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) return { renewed: false };

    // Group must have auto renewal enabled and an active status
    if (!group.renewalSchedule || !group.renewalSchedule.autoRenewalEnabled) {
      return { renewed: false };
    }
    if (group.adminStatus === 'archived') {
      return { renewed: false };
    }

    const intervalDays =
      group.renewalSchedule.renewalIntervalDays ?? group.renewalSchedule.intervalDays;
    if (!intervalDays || intervalDays <= 0) {
      return { renewed: false };
    }

    // Find active cycle for this group
    const activeCycle = this.renewalCycles.find(
      (c) => c.groupId.toLowerCase() === group.id.toLowerCase() && c.status === 'active'
    );

    // Anchor is active cycle start date, or group start date if no cycle yet
    const anchorDate = activeCycle?.startDateTime || group.startDateTime;
    if (!anchorDate) {
      return { renewed: false };
    }

    // Calculate scheduled start date for the next cycle: Anchor + N calendar days
    let scheduledStartIso: string;
    try {
      scheduledStartIso = calculateNextRenewalDate(anchorDate, intervalDays);
    } catch {
      return { renewed: false };
    }

    // If nextScheduledRenewalDate was previously advanced beyond anchor + interval, use that date
    if (
      group.renewalSchedule.nextScheduledRenewalDate &&
      new Date(group.renewalSchedule.nextScheduledRenewalDate).getTime() > new Date(scheduledStartIso).getTime()
    ) {
      scheduledStartIso = group.renewalSchedule.nextScheduledRenewalDate;
    } else {
      group.renewalSchedule.nextScheduledRenewalDate = scheduledStartIso;
    }

    // Check if scheduled date is reached
    const scheduledStartTime = new Date(scheduledStartIso).getTime();
    if (scheduledStartTime > now.getTime()) {
      return { renewed: false };
    }

    // Idempotency: Has this active cycle already been auto-renewed?
    if (activeCycle && group.renewalSchedule.lastAutoRenewedCycleId === activeCycle.id) {
      return { renewed: false };
    }

    // Due date reached! Execute automatic renewal:
    // Scheduled deadline = scheduled start + N days
    const scheduledDeadlineIso = calculateNextRenewalDate(scheduledStartIso, intervalDays);

    // Course assignments carried forward
    const coursesToCarryForward: GroupCycleCourseAssignment[] = (
      activeCycle?.courses ||
      group.courses ||
      []
    ).map((c, idx) => ({
      courseId: c.courseId,
      courseRole: (c as GroupCycleCourseAssignment).courseRole || (idx === 0 ? 'core' : 'reminder'),
      order: c.order || idx + 1,
      customStartDateTime: c.customStartDateTime || null,
      customDeadlineDateTime: c.customDeadlineDateTime || null,
      customPostDeadlinePolicy: c.customPostDeadlinePolicy || null,
    }));

    // If courses list is empty, fallback to baseline courses
    if (coursesToCarryForward.length === 0 && group.courses?.length) {
      group.courses.forEach((c, idx) => {
        coursesToCarryForward.push({
          courseId: c.courseId,
          courseRole: idx === 0 ? 'core' : 'reminder',
          order: c.order || idx + 1,
          customStartDateTime: c.customStartDateTime || null,
          customDeadlineDateTime: c.customDeadlineDateTime || null,
          customPostDeadlinePolicy: c.customPostDeadlinePolicy || null,
        });
      });
    }

    // Determine cycle title and number
    const groupCycles = this.renewalCycles.filter(
      (c) => c.groupId.toLowerCase() === group.id.toLowerCase()
    );
    const nextCycleNumber =
      groupCycles.length > 0 ? Math.max(...groupCycles.map((c) => c.cycleNumber)) + 1 : 1;
    const title = `${group.name} — دورة التجديد ${nextCycleNumber}`;

    // Invoke createRenewalCycle to seal previous cycle, provision attempts, etc.
    const result = this.createRenewalCycle(group.id, {
      title,
      startDateTime: scheduledStartIso,
      deadlineDateTime: scheduledDeadlineIso,
      postDeadlinePolicy: group.postDeadlinePolicy,
      courses: coursesToCarryForward,
      renewalNote: 'دورة تم تجديدها آلياً وفقاً للجدول الزمني المعتمد بالأيام',
    });

    // Record idempotency safeguard on schedule
    group.renewalSchedule.lastAutoRenewedCycleId = activeCycle ? activeCycle.id : 'initial';
    let nextScheduled = calculateNextRenewalDate(scheduledStartIso, intervalDays);

    // Overdue handling policy: If now is still beyond the next occurrence (multiple intervals overdue),
    // align nextScheduledRenewalDate to the upcoming occurrence to prevent a cascading burst of cycles
    // in a single evaluation or repeated requests on the same day.
    while (new Date(nextScheduled).getTime() <= now.getTime()) {
      nextScheduled = calculateNextRenewalDate(nextScheduled, intervalDays);
    }
    group.renewalSchedule.nextScheduledRenewalDate = nextScheduled;
    group.updatedAt = new Date().toISOString();

    return { renewed: true, cycle: result.newCycle };
  }

  /**
   * Get all renewal cycles for a specific group, ordered newest to oldest.
   */
  public getGroupCycles(groupId: string): GroupRenewalCycle[] {
    this.checkAndProcessAutoRenewal(groupId);

    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }
    return this.renewalCycles
      .filter((c) => c.groupId.toLowerCase() === groupId.toLowerCase())
      .sort((a, b) => b.cycleNumber - a.cycleNumber);
  }

  /**
   * Get a single renewal cycle by ID.
   */
  public getGroupCycleById(cycleId: string): GroupRenewalCycle | undefined {
    return this.renewalCycles.find((c) => c.id.toLowerCase() === cycleId.toLowerCase());
  }

  /**
   * Get the current active renewal cycle for a group.
   */
  public getCurrentGroupCycle(groupId: string): GroupRenewalCycle | null {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) return null;

    if (group.currentCycleId) {
      const found = this.getGroupCycleById(group.currentCycleId);
      if (found) return found;
    }

    return (
      this.renewalCycles.find(
        (c) => c.groupId.toLowerCase() === groupId.toLowerCase() && c.status === 'active'
      ) || null
    );
  }

  /**
   * Assign or update courses in a cycle.
   */
  public assignCoursesToCycle(
    groupId: string,
    cycleId: string,
    dto: AssignCycleCoursesDTO
  ): GroupRenewalCycle {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const cycle = this.getGroupCycleById(cycleId);
    if (!cycle || cycle.groupId.toLowerCase() !== group.id.toLowerCase()) {
      throw new MockStoreError('دورة التجديد غير موجودة في هذه المجموعة', 404);
    }

    if (cycle.status !== 'active') {
      throw new MockStoreError('لا يمكن تعديل مقررات دورة تجديد مكتملة أو مؤرشفة', 400);
    }

    const normalizedCourses: GroupCycleCourseAssignment[] = dto.courses.map((c, idx) => ({
      courseId: c.courseId,
      courseRole: c.courseRole,
      order: c.order || idx + 1,
      customStartDateTime: c.customStartDateTime,
      customDeadlineDateTime: c.customDeadlineDateTime,
      customPostDeadlinePolicy: c.customPostDeadlinePolicy,
    }));

    const val = validateCycleCourseAssignments(normalizedCourses);
    if (!val.isValid) {
      throw new MockStoreError(val.error || 'مقررات دورة التجديد غير صالحة', 422);
    }

    cycle.courses = normalizedCourses;
    cycle.updatedAt = new Date().toISOString();

    if (group.currentCycleId?.toLowerCase() === cycle.id.toLowerCase()) {
      group.courses = cycle.courses.map((c) => ({
        courseId: c.courseId,
        order: c.order,
        customStartDateTime: c.customStartDateTime,
        customDeadlineDateTime: c.customDeadlineDateTime,
        customPostDeadlinePolicy: c.customPostDeadlinePolicy,
      }));
      group.updatedAt = new Date().toISOString();
    }

    // Synchronize enrollments and provision unstarted attempts
    for (const tid of cycle.traineeIds) {
      for (const c of cycle.courses) {
        const existingEnr = this.enrollments.find(
          (e) =>
            e.userId.toLowerCase() === tid.toLowerCase() &&
            e.courseId.toLowerCase() === c.courseId.toLowerCase()
        );
        if (!existingEnr) {
          this.enrollments.push({
            id: `ENR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            courseId: c.courseId,
            userId: tid,
            enrolledAt: new Date().toISOString(),
            status: 'active',
          });
          const targetCourse = this.getCourseById(c.courseId);
          if (targetCourse) targetCourse.enrollmentCount = (targetCourse.enrollmentCount || 0) + 1;
        }

        const existingAttempt = this.courseAttempts.find(
          (a) =>
            a.userId.toLowerCase() === tid.toLowerCase() &&
            a.courseId.toLowerCase() === c.courseId.toLowerCase() &&
            a.cycleId === cycle.id
        );
        if (!existingAttempt) {
          const attempt = createCourseAttempt({
            id: `ATT-${tid}-${c.courseId}-${cycle.id}`,
            userId: tid,
            courseId: c.courseId,
            cycleId: cycle.id,
            groupId: group.id,
            courseRole: c.courseRole,
          });
          this.courseAttempts.push(attempt);
        }
      }
    }

    return cycle;
  }

  // ── Increment 10: Course Attempt Ledger ──────────────────────────────

  /**
   * Retrieve or provision an unstarted CourseAttempt.
   */
  public getOrCreateCurrentAttempt(params: {
    userId: string;
    courseId: string;
    cycleId?: string | null;
    groupId?: string | null;
    courseRole?: CourseRole;
  }): CourseAttempt {
    const normalizedUserId = params.userId.trim().toLowerCase();
    const normalizedCourseId = params.courseId.trim().toLowerCase();
    const cycleKey = params.cycleId || null;

    const existing = this.courseAttempts.find(
      (a) =>
        a.userId.toLowerCase() === normalizedUserId &&
        a.courseId.toLowerCase() === normalizedCourseId &&
        a.cycleId === cycleKey
    );

    if (existing) return existing;

    const attempt = createCourseAttempt({
      id: `ATT-${params.userId}-${params.courseId}-${cycleKey || 'standalone'}-${Date.now().toString(36)}`,
      userId: params.userId,
      courseId: params.courseId,
      cycleId: cycleKey,
      groupId: params.groupId || null,
      courseRole: params.courseRole,
    });
    this.courseAttempts.push(attempt);
    return attempt;
  }

  /**
   * Start a course attempt when the trainee begins active learning.
   * Assigns the next sequential attempt number dynamically and idempotently.
   */
  public startAttempt(attemptId: string, startedAt = new Date().toISOString()): CourseAttempt {
    const attempt = this.courseAttempts.find((a) => a.id === attemptId);
    if (!attempt) {
      throw new MockStoreError('سجل المحاولة غير موجود', 404);
    }

    if (isAttemptStarted(attempt) && attempt.attemptNumber !== null) {
      return attempt;
    }

    const allUserAttempts = this.courseAttempts.filter(
      (a) =>
        a.userId.toLowerCase() === attempt.userId.toLowerCase() &&
        a.courseId.toLowerCase() === attempt.courseId.toLowerCase()
    );

    const started = startCourseAttempt(attempt, allUserAttempts, startedAt);
    const idx = this.courseAttempts.findIndex((a) => a.id === attempt.id);
    if (idx >= 0) {
      this.courseAttempts[idx] = started;
    }
    return started;
  }

  /**
   * Record lesson activity (playback position) on a specific attempt.
   */
  public recordAttemptLessonActivity(params: {
    attemptId: string;
    itemId: string;
    positionSeconds: number;
    durationSeconds?: number;
  }): CourseAttempt {
    let attempt = this.courseAttempts.find((a) => a.id === params.attemptId);
    if (!attempt) {
      throw new MockStoreError('سجل المحاولة غير موجود', 404);
    }

    if (!isAttemptStarted(attempt) || attempt.attemptNumber === null) {
      attempt = this.startAttempt(attempt.id);
    }

    const now = new Date().toISOString();
    const existingProgress = attempt.lessonProgress[params.itemId] || {
      itemId: params.itemId,
      completed: false,
      lastPositionSeconds: 0,
      furthestWatchedSeconds: 0,
      eligibleViewingSeconds: 0,
      durationSeconds: params.durationSeconds,
      updatedAt: now,
    };

    attempt.lessonProgress[params.itemId] = {
      ...existingProgress,
      lastPositionSeconds: params.positionSeconds,
      furthestWatchedSeconds: Math.max(
        existingProgress.furthestWatchedSeconds || 0,
        params.positionSeconds
      ),
      durationSeconds: params.durationSeconds || existingProgress.durationSeconds,
      updatedAt: now,
    };

    attempt.lastWatchedItemId = params.itemId;
    attempt.lastActivityAt = now;
    attempt.updatedAt = now;

    return attempt;
  }

  /**
   * Mark a lesson item complete within a specific attempt ledger.
   */
  public completeAttemptLessonItem(params: {
    attemptId: string;
    itemId: string;
  }): { attempt: CourseAttempt; justCompletedAttempt: boolean } {
    let attempt = this.courseAttempts.find((a) => a.id === params.attemptId);
    if (!attempt) {
      throw new MockStoreError('سجل المحاولة غير موجود', 404);
    }

    if (!isAttemptStarted(attempt) || attempt.attemptNumber === null) {
      attempt = this.startAttempt(attempt.id);
    }

    const now = new Date().toISOString();
    if (!attempt.completedItemIds.includes(params.itemId)) {
      attempt.completedItemIds.push(params.itemId);
    }

    const existingProgress = attempt.lessonProgress[params.itemId] || {
      itemId: params.itemId,
      completed: false,
      lastPositionSeconds: 0,
      furthestWatchedSeconds: 0,
      eligibleViewingSeconds: 0,
      updatedAt: now,
    };

    attempt.lessonProgress[params.itemId] = {
      ...existingProgress,
      completed: true,
      completedAt: existingProgress.completedAt || now,
      updatedAt: now,
    };

    const courseItems = this.getCourseItems(attempt.courseId);
    const percent =
      courseItems.length > 0
        ? Math.round((attempt.completedItemIds.length / courseItems.length) * 100)
        : 100;
    attempt.progressPercent = Math.min(100, percent);

    const wasCompleted = attempt.status === 'completed';
    if (courseItems.length > 0 && attempt.completedItemIds.length >= courseItems.length) {
      attempt.status = 'completed';
      attempt.completedAt = attempt.completedAt || now;
    }
    const justCompletedAttempt = !wasCompleted && attempt.status === 'completed';
    attempt.lastActivityAt = now;
    attempt.updatedAt = now;

    return { attempt, justCompletedAttempt };
  }

  /**
   * Retrieve all attempts for a trainee, optionally filtered by course.
   */
  public getTraineeAttempts(userId: string, courseId?: string): CourseAttempt[] {
    const normalizedUserId = userId.trim().toLowerCase();
    return this.courseAttempts.filter(
      (a) =>
        a.userId.toLowerCase() === normalizedUserId &&
        (!courseId || a.courseId.toLowerCase() === courseId.trim().toLowerCase())
    );
  }

  /**
   * Calculate attempt statistics for a trainee and course.
   */
  public getCourseAttemptStatsForTrainee(
    userId: string,
    courseId: string,
    currentCycleId?: string | null
  ): TraineeCourseAttemptStats {
    return calculateCourseAttemptStats({
      attempts: this.courseAttempts,
      userId,
      courseId,
      currentCycleId,
    });
  }

  /**
   * Get all attempts associated with a specific renewal cycle.
   */
  public getCycleAttempts(cycleId: string): CourseAttempt[] {
    return this.courseAttempts.filter(
      (a) => a.cycleId?.toLowerCase() === cycleId.toLowerCase()
    );
  }

  // ── Increment 10: QR Enrollment, Tokens & Join Requests ─────────────

  /**
   * Validate a QR enrollment token and enforce master toggle, expiry, capacity, and status.
   */
  public validateGroupEnrollmentToken(code: string): {
    isValid: boolean;
    group?: TrainingGroup;
    error?: string;
    status: number;
  } {
    const trimmed = code.trim().toLowerCase();
    const group = this.groups.find(
      (g) => g.enrollmentCode && g.enrollmentCode.toLowerCase() === trimmed
    );

    if (!group) {
      return { isValid: false, error: 'رمز الانضمام غير صالح أو غير موجود', status: 404 };
    }

    if (group.adminStatus === 'draft') {
      return { isValid: false, error: 'المجموعة التدريبية ما زالت في مرحلة الإعداد', status: 403 };
    }

    if (group.adminStatus === 'archived') {
      return { isValid: false, error: 'المجموعة مؤرشفة وغير متاحة للانضمام', status: 403 };
    }

    if (group.isEnrollmentOpen === false) {
      return { isValid: false, error: 'الانضمام مغلق حالياً لهذه المجموعة', status: 403 };
    }

    if (group.enrollmentExpiresAt && new Date(group.enrollmentExpiresAt).getTime() < Date.now()) {
      return { isValid: false, error: 'انتهت صلاحية رمز الانضمام', status: 410 };
    }

    if (group.maxTrainees && (group.traineeIds || []).length >= group.maxTrainees) {
      return { isValid: false, error: 'عذراً، اكتمل العدد الأقصى للمتدربين في هذه المجموعة', status: 409 };
    }

    return { isValid: true, group, status: 200 };
  }

  /**
   * Process a QR code scan joining attempt.
   */
  public joinGroupByQRCode(params: {
    code: string;
    userId: string;
    userRole?: string;
    note?: string;
  }): JoinGroupQRResponseDTO {
    if (params.userRole && params.userRole !== 'user') {
      throw new MockStoreError(
        'الانضمام عبر رمز الاستجابة السريعة متاح فقط لحسابات المتدربين. حسابات الإدارة والمحاضرين للمعاينة فقط.',
        403
      );
    }

    const val = this.validateGroupEnrollmentToken(params.code);
    if (!val.isValid || !val.group) {
      throw new MockStoreError(val.error || 'رمز الانضمام غير صالح', val.status);
    }

    const group = val.group;
    const normalizedUserId = params.userId.trim().toLowerCase();

    // Already a member?
    if ((group.traineeIds || []).some((tid) => tid.toLowerCase() === normalizedUserId)) {
      return {
        group,
        enrolledCoursesCount: 0,
        alreadyEnrolledCoursesCount: (group.courses || []).length,
        message: 'أنت عضو بالفعل في هذه المجموعة التدريبية',
      };
    }

    if (group.enrollmentPolicy === 'closed') {
      throw new MockStoreError('الانضمام الذاتي غير متاح لهذه المجموعة التدريبية', 403);
    }

    if (group.enrollmentPolicy === 'approval_required') {
      const existingPending = this.groupJoinRequests.find(
        (r) =>
          r.groupId.toLowerCase() === group.id.toLowerCase() &&
          r.userId.toLowerCase() === normalizedUserId &&
          r.status === 'pending'
      );

      if (existingPending) {
        return {
          group,
          enrolledCoursesCount: 0,
          alreadyEnrolledCoursesCount: 0,
          isPendingApproval: true,
          message: 'طلب انضمامك قيد المراجعة حالياً من قبل مشرف المجموعة',
        };
      }

      this.submitGroupJoinRequest({
        groupId: group.id,
        userId: params.userId,
        note: params.note,
      });

      return {
        group,
        enrolledCoursesCount: 0,
        alreadyEnrolledCoursesCount: 0,
        isPendingApproval: true,
        message: 'تم إرسال طلب الانضمام بنجاح وهو بانتظار موافقة مشرف المجموعة',
      };
    }

    // Policy: 'open'
    const addResult = this.addGroupMember(group.id, params.userId, 'qr_code');
    return {
      group,
      enrolledCoursesCount: addResult.newlyEnrolledCoursesCount,
      alreadyEnrolledCoursesCount: (group.courses || []).length - addResult.newlyEnrolledCoursesCount,
      message: 'تم انضمامك للمجموعة التدريبية وتسجيلك في المقررات بنجاح!',
    };
  }

  /**
   * Submit a join request for an approval_required group.
   */
  public submitGroupJoinRequest(params: {
    groupId: string;
    userId: string;
    note?: string;
  }): GroupJoinRequest {
    const group = this.groups.find((g) => g.id.toLowerCase() === params.groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const normalizedUserId = params.userId.trim().toLowerCase();
    if ((group.traineeIds || []).some((tid) => tid.toLowerCase() === normalizedUserId)) {
      throw new MockStoreError('أنت عضو بالفعل في هذه المجموعة التدريبية', 409);
    }

    const existingPending = this.groupJoinRequests.find(
      (r) =>
        r.groupId.toLowerCase() === group.id.toLowerCase() &&
        r.userId.toLowerCase() === normalizedUserId &&
        r.status === 'pending'
    );
    if (existingPending) {
      return existingPending;
    }

    const meta = this.resolveMockUserMeta(params.userId);
    const req: GroupJoinRequest = {
      id: `REQ-${group.id}-${params.userId}-${Date.now().toString(36)}`,
      groupId: group.id,
      groupName: group.name,
      userId: params.userId,
      userName: meta.name,
      userEmail: meta.email,
      department: meta.department,
      jobTitle: meta.jobTitle,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      reviewNote: params.note || null,
    };

    this.groupJoinRequests.push(req);
    return req;
  }

  /**
   * Get join requests for a group, optionally filtered by status.
   */
  public getGroupJoinRequests(
    groupId: string,
    status?: 'pending' | 'approved' | 'rejected'
  ): GroupJoinRequest[] {
    return this.groupJoinRequests.filter(
      (r) =>
        r.groupId.toLowerCase() === groupId.toLowerCase() && (!status || r.status === status)
    );
  }

  /**
   * Review (approve or reject) a group join request.
   */
  public reviewGroupJoinRequest(
    dto: ReviewJoinRequestDTO,
    reviewerUser: User
  ): { request: GroupJoinRequest; group: TrainingGroup; newlyEnrolledCoursesCount?: number } {
    const request = this.groupJoinRequests.find((r) => r.id === dto.requestId);
    if (!request) {
      throw new MockStoreError('طلب الانضمام غير موجود', 404);
    }

    if (request.status !== 'pending') {
      throw new MockStoreError('تمت مراجعة هذا الطلب مسبقاً', 400);
    }

    const group = this.groups.find((g) => g.id.toLowerCase() === request.groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    request.status = dto.decision;
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = reviewerUser.id;
    request.reviewedByName = reviewerUser.name;
    request.reviewNote = dto.reviewNote || request.reviewNote;

    if (dto.decision === 'approved') {
      const addRes = this.addGroupMember(group.id, request.userId, 'qr_code');
      return { request, group, newlyEnrolledCoursesCount: addRes.newlyEnrolledCoursesCount };
    }

    return { request, group };
  }

  /**
   * Rotate a group's QR enrollment token, invalidating the previous code.
   */
  public rotateGroupEnrollmentCode(groupId: string): RotateGroupQRCodeResponseDTO {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const newCode = `${group.name.slice(0, 3).toUpperCase()}-SEC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    group.enrollmentCode = newCode;
    group.updatedAt = new Date().toISOString();

    return {
      groupId: group.id,
      newEnrollmentCode: newCode,
      qrUrl: `https://metro-courses.internal/groups/join?code=${newCode}`,
      message: 'تمت إعادة توليد رمز الاستجابة السريعة بنجاح وإلغاء صلاحية الرمز السابق.',
    };
  }

  /**
   * Toggle enrollment open / closed master switch.
   */
  public toggleGroupEnrollment(groupId: string, isOpen: boolean): TrainingGroup {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }
    group.isEnrollmentOpen = isOpen;
    group.updatedAt = new Date().toISOString();
    return group;
  }

  /**
   * Returns list of candidate trainees for direct group membership assignment.
   * Derived dynamically from the centralized user directory:
   * Only active users with the trainee role ('user') are returned.
   */
  public getCandidateTrainees(): CandidateTraineeDTO[] {
    const activeTrainees = this.users.filter(
      (u) => u.role === 'user' && u.status === 'active'
    );
    return activeTrainees.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department,
      jobTitle: u.jobTitle,
    }));
  }

  // ── Increment 10: Group Materials Library ────────────────────────────

  /**
   * Create a material folder in a group.
   */
  public createMaterialFolder(
    groupId: string,
    dto: CreateMaterialFolderDTO
  ): GroupMaterialFolder {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const trimmedName = dto.name.trim();
    if (!trimmedName) {
      throw new MockStoreError('اسم المجلد مطلوب', 422);
    }

    const duplicate = this.materialFolders.some(
      (f) =>
        f.groupId.toLowerCase() === group.id.toLowerCase() &&
        (f.parentId || null) === (dto.parentId || null) &&
        f.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      throw new MockStoreError('يوجد مجلد آخر بنفس الاسم في هذه المجموعة', 409);
    }

    const existing = this.materialFolders.filter(
      (f) => f.groupId.toLowerCase() === group.id.toLowerCase()
    );

    const folder: GroupMaterialFolder = {
      id: `FLD-${group.id}-${Date.now().toString(36)}`,
      groupId: group.id,
      parentId: dto.parentId || null,
      cycleId: dto.cycleId ?? null,
      name: trimmedName,
      order: existing.length + 1,
      isVisibleToTrainees: dto.isVisibleToTrainees ?? true,
      filesCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.materialFolders.push(folder);
    group.foldersCount = (group.foldersCount || 0) + 1;
    return folder;
  }

  /**
   * Update folder name, visibility, order, or parentId.
   */
  public updateMaterialFolder(
    folderId: string,
    params: { name?: string; isVisibleToTrainees?: boolean; order?: number; parentId?: string | null }
  ): GroupMaterialFolder {
    const folder = this.materialFolders.find((f) => f.id === folderId);
    if (!folder) {
      throw new MockStoreError('المجلد غير موجود', 404);
    }

    if (params.name !== undefined) {
      const trimmed = params.name.trim();
      if (!trimmed) throw new MockStoreError('اسم المجلد مطلوب', 422);
      const targetParentId = params.parentId !== undefined ? params.parentId : folder.parentId;
      const duplicate = this.materialFolders.some(
        (f) =>
          f.id !== folder.id &&
          f.groupId.toLowerCase() === folder.groupId.toLowerCase() &&
          (f.parentId || null) === (targetParentId || null) &&
          f.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) throw new MockStoreError('يوجد مجلد آخر بنفس الاسم في هذه المجموعة', 409);
      folder.name = trimmed;
    }

    if (params.parentId !== undefined) {
      folder.parentId = params.parentId || null;
    }
    if (params.isVisibleToTrainees !== undefined) {
      folder.isVisibleToTrainees = params.isVisibleToTrainees;
    }
    if (params.order !== undefined) {
      folder.order = params.order;
    }
    folder.updatedAt = new Date().toISOString();

    return folder;
  }

  /**
   * Delete a folder and all its descendant subfolders and files.
   */
  public deleteMaterialFolder(folderId: string): { success: boolean; deletedFilesCount: number } {
    const folder = this.materialFolders.find((f) => f.id === folderId);
    if (!folder) {
      throw new MockStoreError('المجلد غير موجود', 404);
    }

    // Recursively collect all descendant folder IDs
    const getDescendants = (pid: string): string[] => {
      const direct = this.materialFolders.filter((f) => f.parentId === pid).map((f) => f.id);
      return [...direct, ...direct.flatMap((id) => getDescendants(id))];
    };
    const allFolderIdsToDelete = [folderId, ...getDescendants(folderId)];

    const files = this.materialFiles.filter((f) => allFolderIdsToDelete.includes(f.folderId));
    this.materialFiles = this.materialFiles.filter((f) => !allFolderIdsToDelete.includes(f.folderId));
    this.materialFolders = this.materialFolders.filter((f) => !allFolderIdsToDelete.includes(f.id));

    const group = this.groups.find((g) => g.id.toLowerCase() === folder.groupId.toLowerCase());
    if (group) {
      group.foldersCount = Math.max(0, (group.foldersCount || allFolderIdsToDelete.length) - allFolderIdsToDelete.length);
      group.filesCount = Math.max(0, (group.filesCount || files.length) - files.length);
    }

    return { success: true, deletedFilesCount: files.length };
  }

  /**
   * Upload / add a file to a folder with metadata validation.
   */
  public addMaterialFile(
    groupId: string,
    folderId: string,
    fileData: {
      title: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      isVisible?: boolean;
      cycleId?: string | null;
    },
    uploader: User
  ): GroupMaterialFile {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const folder = this.materialFolders.find((f) => f.id === folderId);
    if (!folder || folder.groupId.toLowerCase() !== group.id.toLowerCase()) {
      throw new MockStoreError('المجلد غير موجود في هذه المجموعة', 404);
    }

    const val = validateMaterialUpload({ name: fileData.fileName, size: fileData.sizeBytes });
    if (!val.isValid) {
      throw new MockStoreError(val.error || 'الملف غير صالح للرفع', 422);
    }

    const fileType = resolveMaterialFileType(fileData.fileName, fileData.mimeType);
    const existing = this.materialFiles.filter((f) => f.folderId === folderId);

    const file: GroupMaterialFile = {
      id: `FIL-${groupId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      folderId,
      groupId: group.id,
      cycleId: fileData.cycleId ?? folder.cycleId ?? null,
      title: fileData.title.trim() || fileData.fileName,
      originalFileName: fileData.fileName,
      fileSizeBytes: fileData.sizeBytes,
      mimeType: fileData.mimeType,
      fileType,
      url: `/dev-media/materials/${fileData.fileName}`,
      order: existing.length + 1,
      uploadedBy: uploader.id,
      uploadedByName: uploader.name,
      uploadedAt: new Date().toISOString(),
      isVisible: fileData.isVisible ?? true,
      downloadCount: 0,
    };

    this.materialFiles.push(file);
    folder.filesCount = (folder.filesCount || 0) + 1;
    group.filesCount = (group.filesCount || 0) + 1;

    return file;
  }

  /**
   * Replace an existing file record with a new file.
   */
  public replaceMaterialFile(
    fileId: string,
    newFileData: { fileName: string; sizeBytes: number; mimeType: string },
    uploader: User
  ): GroupMaterialFile {
    const file = this.materialFiles.find((f) => f.id === fileId);
    if (!file) {
      throw new MockStoreError('الملف غير موجود', 404);
    }

    const val = validateMaterialUpload({ name: newFileData.fileName, size: newFileData.sizeBytes });
    if (!val.isValid) {
      throw new MockStoreError(val.error || 'الملف البديل غير صالح', 422);
    }

    file.originalFileName = newFileData.fileName;
    file.fileSizeBytes = newFileData.sizeBytes;
    file.mimeType = newFileData.mimeType;
    file.fileType = resolveMaterialFileType(newFileData.fileName, newFileData.mimeType);
    file.url = `/dev-media/materials/${newFileData.fileName}`;
    file.uploadedBy = uploader.id;
    file.uploadedByName = uploader.name;
    file.uploadedAt = new Date().toISOString();

    return file;
  }

  /**
   * Delete a single material file.
   */
  public deleteMaterialFile(fileId: string): { success: boolean; message: string } {
    const file = this.materialFiles.find((f) => f.id === fileId);
    if (!file) {
      throw new MockStoreError('الملف غير موجود', 404);
    }

    this.materialFiles = this.materialFiles.filter((f) => f.id !== fileId);

    const folder = this.materialFolders.find((f) => f.id === file.folderId);
    if (folder) folder.filesCount = Math.max(0, (folder.filesCount || 1) - 1);

    const group = this.groups.find((g) => g.id.toLowerCase() === file.groupId.toLowerCase());
    if (group) group.filesCount = Math.max(0, (group.filesCount || 1) - 1);

    return { success: true, message: 'تم حذف الملف بنجاح.' };
  }

  /**
   * Move a material file to another folder in the same group.
   */
  public moveMaterialFile(fileId: string, targetFolderId: string): GroupMaterialFile {
    const file = this.materialFiles.find((f) => f.id === fileId);
    if (!file) {
      throw new MockStoreError('الملف غير موجود', 404);
    }

    const targetFolder = this.materialFolders.find((f) => f.id === targetFolderId);
    if (!targetFolder) {
      throw new MockStoreError('المجلد الوجهة غير موجود', 404);
    }

    if (targetFolder.groupId.toLowerCase() !== file.groupId.toLowerCase()) {
      throw new MockStoreError('لا يمكن نقل الملف إلى مجلد يتبع مجموعة تدريبية أخرى', 422);
    }

    if (file.folderId === targetFolderId) {
      return file;
    }

    const sourceFolder = this.materialFolders.find((f) => f.id === file.folderId);
    if (sourceFolder) {
      sourceFolder.filesCount = Math.max(0, (sourceFolder.filesCount || 1) - 1);
    }

    targetFolder.filesCount = (targetFolder.filesCount || 0) + 1;
    file.folderId = targetFolderId;
    file.cycleId = targetFolder.cycleId ?? file.cycleId;

    return file;
  }

  /**
   * Update title or visibility of a material file.
   */
  public updateMaterialFile(
    fileId: string,
    params: { title?: string; isVisible?: boolean }
  ): GroupMaterialFile {
    const file = this.materialFiles.find((f) => f.id === fileId);
    if (!file) {
      throw new MockStoreError('الملف غير موجود', 404);
    }

    if (params.title !== undefined) {
      const trimmed = params.title.trim();
      if (!trimmed) throw new MockStoreError('عنوان الملف مطلوب', 422);
      file.title = trimmed;
    }

    if (params.isVisible !== undefined) {
      file.isVisible = params.isVisible;
    }

    return file;
  }

  /**
   * Get all visible materials folders and files for a group.
   */
  public getGroupMaterials(
    groupId: string,
    userRole?: string,
    cycleId?: string | null
  ): { folders: (GroupMaterialFolder & { files: GroupMaterialFile[] })[]; rootFiles?: GroupMaterialFile[] } {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    let folders = this.materialFolders.filter(
      (f) => f.groupId.toLowerCase() === groupId.toLowerCase()
    );

    if (cycleId) {
      folders = folders.filter((f) => !f.cycleId || f.cycleId.toLowerCase() === cycleId.toLowerCase());
    }

    if (userRole === 'user') {
      folders = folders.filter((f) => f.isVisibleToTrainees !== false);
    }

    folders.sort((a, b) => a.order - b.order);

    const result = folders.map((fld) => {
      let files = this.materialFiles.filter((f) => f.folderId === fld.id);
      if (userRole === 'user') {
        files = files.filter((f) => f.isVisible !== false);
      }
      files.sort((a, b) => a.order - b.order);
      return {
        ...fld,
        files,
      };
    });

    let rootFiles = this.materialFiles.filter(
      (f) =>
        f.groupId.toLowerCase() === groupId.toLowerCase() &&
        (!f.folderId || f.folderId === 'root')
    );
    if (userRole === 'user') {
      rootFiles = rootFiles.filter((f) => f.isVisible !== false);
    }

    return { folders: result, rootFiles };
  }

  /**
   * Summary overview DTO for group management listings.
   */
  public getGroupSummary(groupId: string): GroupSummaryDTO | null {
    const group = this.groups.find((g) => g.id.toLowerCase() === groupId.toLowerCase());
    if (!group) return null;

    const metrics = this.getGroupMetrics(groupId);
    const currentCycle = this.getCurrentGroupCycle(groupId);
    const pendingReqs = this.getGroupJoinRequests(groupId, 'pending');

    const totalTrainees = group.traineeIds ? group.traineeIds.length : 0;
    const completedCount =
      metrics?.traineeMetricsList.filter((t) => t.isProgramCompleted).length || 0;
    const attentionCount =
      metrics?.traineeMetricsList.filter((t) => t.worstAttention.needsAttention).length || 0;
    const avgProgress =
      totalTrainees > 0 && metrics
        ? Math.round(
            metrics.traineeMetricsList.reduce((sum, t) => sum + t.programPercent, 0) /
              totalTrainees
          )
        : 0;

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      adminStatus: group.adminStatus || 'active',
      timeStatus: metrics?.status || 'active',
      timeStatusLabelAr: metrics?.statusLabelAr || 'نشطة',
      enrollmentPolicy: group.enrollmentPolicy || 'open',
      startDateTime: group.startDateTime,
      deadlineDateTime: group.deadlineDateTime,
      timeRemainingText: metrics?.timeRemainingText || '',
      totalCoursesCount: group.courses ? group.courses.length : 0,
      totalTraineesCount: totalTrainees,
      averageProgressPercent: avgProgress,
      completedTraineesCount: completedCount,
      attentionTraineesCount: attentionCount,
      isEnrollmentOpen: group.isEnrollmentOpen !== false,
      currentCycleNumber: currentCycle?.cycleNumber,
      currentCycleTitle: currentCycle?.title,
      pendingJoinRequestsCount: pendingReqs.length,
      createdAt: group.createdAt || new Date().toISOString(),
    };
  }

  // ── Increment 11: Central User Directory Management ─────────────────

  /**
   * Internal reference accessor for tests to inspect and modify users ledger
   */
  public getManagedUsersStore(): ManagedUserDTO[] {
    return this.users;
  }

  /**
   * Internal reference accessor for tests to inspect and modify courses ledger
   */
  public getCoursesStore(): Course[] {
    return this.courses;
  }

  /**
   * Returns filtered managed users list from the central directory
   */
  public getManagedUsers(params?: UserFilterParams): ManagedUserDTO[] {
    let result = [...this.users];

    if (!params) {
      return JSON.parse(JSON.stringify(result));
    }

    const { query, role, status, department } = params;

    if (role && role !== 'all') {
      result = result.filter((u) => u.role === role);
    }

    if (status && status !== 'all') {
      result = result.filter((u) => u.status === status);
    }

    if (department && department !== 'all') {
      result = result.filter((u) => u.department === department);
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      const canonicalQueryId = resolveCanonicalUserId(q).toLowerCase();

      result = result.filter((u) => {
        const matchesDirect =
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q)) ||
          u.jobTitle.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q) ||
          (u.legacyAliases && u.legacyAliases.some((a) => a.toLowerCase().includes(q)));

        const matchesCanonical = u.id.toLowerCase() === canonicalQueryId;

        return matchesDirect || matchesCanonical;
      });
    }

    return JSON.parse(JSON.stringify(result));
  }

  /**
   * Resolves a managed user by canonical ID or verified legacy alias
   */
  public getManagedUserById(id: string): ManagedUserDTO | undefined {
    if (!id) return undefined;
    const canonicalId = resolveCanonicalUserId(id).toLowerCase();
    const user = this.users.find(
      (u) =>
        u.id.toLowerCase() === canonicalId ||
        u.id.toLowerCase() === id.toLowerCase() ||
        u.username.toLowerCase() === id.toLowerCase() ||
        (u.legacyAliases && u.legacyAliases.some((a) => a.toLowerCase() === id.toLowerCase()))
    );
    if (user) {
      return JSON.parse(JSON.stringify(user));
    }

    const demo = Object.values(SYNTHETIC_DEMO_ACCOUNTS).find(
      (acc) =>
        acc.user.id.toLowerCase() === canonicalId ||
        acc.user.id.toLowerCase() === id.toLowerCase() ||
        acc.credentials.email.toLowerCase() === id.toLowerCase() ||
        (acc.user.email && acc.user.email.toLowerCase() === id.toLowerCase())
    );
    if (demo) {
      return {
        id: demo.user.id,
        name: demo.user.name,
        username:
          demo.user.id === 'USR016'
            ? 'assistant_admin_demo'
            : demo.user.id === 'USR017'
            ? 'assistant_lecturer_demo'
            : demo.user.id,
        email: demo.user.email,
        jobTitle: demo.user.jobTitle,
        department: demo.user.department,
        role: demo.user.role,
        status: 'active',
        legacyAliases: [demo.user.id.toLowerCase()],
      };
    }

    return undefined;
  }

  /**
   * Mock credential lookup helper (credentials isolated from ManagedUserDTO)
   */
  public getMockUserCredential(identifier: string): string | undefined {
    if (!identifier) return undefined;
    return this.mockUserCredentials[identifier.trim().toLowerCase()];
  }

  /**
   * Mock credential provisioning helper
   */
  public setMockUserCredential(identifier: string, password: string): void {
    if (!identifier || !password) return;
    this.mockUserCredentials[identifier.trim().toLowerCase()] = password;
  }

  /**
   * Adds a new managed user to the central directory (Phase 2)
   */
  public createUser(dto: CreateUserRequestDTO, actor?: { id: string; role: UserRole }): ManagedUserDTO {
    if (!dto.name || !dto.name.trim()) {
      throw new MockStoreError('الاسم الكامل للمستخدم مطلوب', 400);
    }
    if (!dto.username || !dto.username.trim()) {
      throw new MockStoreError('اسم المستخدم مطلوب', 400);
    }
    if (!dto.email || !dto.email.trim()) {
      throw new MockStoreError('البريد الإلكتروني مطلوب', 400);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.email.trim())) {
      throw new MockStoreError('صيغة البريد الإلكتروني غير صالحة', 400);
    }
    if (!dto.jobTitle || !dto.jobTitle.trim()) {
      throw new MockStoreError('المسمى الوظيفي مطلوب', 400);
    }
    if (!dto.department || !dto.department.trim()) {
      throw new MockStoreError('القطاع / الإدارة التابع لها مطلوب', 400);
    }
    if (!dto.role || !['admin', 'assistant_admin', 'lecturer', 'user'].includes(dto.role)) {
      throw new MockStoreError('الدور الوظيفي المحدد غير صالح', 400);
    }
    if (actor) {
      const check = this.hasPermission(actor, 'users.create', {
        targetRole: dto.role,
        targetUser: { id: '', role: dto.role },
      });
      if (!check.granted || check.executionMode === 'denied') {
        this.recordAuditLog({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'users.create',
          actionLabelAr: 'إنشاء حساب مستخدم',
          severity: 'critical',
          outcome: 'denied',
          resourceType: 'user',
          targetResourceName: dto.name,
          details: check.reasonAr || 'محاولة غير مصرح بها لإنشاء حساب مستخدم حُظرت بمحددات الأمان',
          metadata: { targetRole: dto.role, failureReason: check.reasonAr },
        });
        throw new MockStoreError(check.reasonAr || 'غير مصرح بإنشاء حسابات مستخدمين', 403);
      }
    }

    const trimmedUsername = dto.username.trim().toLowerCase();
    const trimmedEmail = dto.email.trim().toLowerCase();

    // Check unique username
    const usernameTaken = this.users.some(
      (u) =>
        u.username.toLowerCase() === trimmedUsername ||
        u.id.toLowerCase() === trimmedUsername ||
        (u.legacyAliases && u.legacyAliases.some((a) => a.toLowerCase() === trimmedUsername))
    );
    if (usernameTaken) {
      throw new MockStoreError('اسم المستخدم مسجل مسبقاً لمستخدم آخر', 409);
    }

    // Check unique email
    const emailTaken = this.users.some((u) => u.email.toLowerCase() === trimmedEmail);
    if (emailTaken) {
      throw new MockStoreError('البريد الإلكتروني مسجل مسبقاً لمستخدم آخر', 409);
    }

    // Calculate deterministic canonical ID (USR013, etc.)
    let maxNum = 12;
    for (const u of this.users) {
      const match = u.id.match(/^USR(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const newId = `USR${String(maxNum + 1).padStart(3, '0')}`;

    const newUser: ManagedUserDTO = {
      id: newId,
      name: dto.name.trim(),
      username: dto.username.trim(),
      email: dto.email.trim(),
      phone: dto.phone?.trim() || undefined,
      jobTitle: dto.jobTitle.trim(),
      department: dto.department.trim(),
      role: dto.role,
      status: dto.status || 'active',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      legacyAliases: [newId.toLowerCase(), trimmedUsername],
    };

    // Store credentials separately if provided
    if (dto.password && dto.password.trim()) {
      this.setMockUserCredential(newUser.email, dto.password.trim());
      this.setMockUserCredential(newUser.username, dto.password.trim());
      this.setMockUserCredential(newUser.id, dto.password.trim());
    }

    this.users.push(newUser);

    this.recordAuditLog({
      actorId: actor?.id || 'usr_admin_001',
      actorRole: actor?.role || 'admin',
      action: 'users.create',
      actionLabelAr: 'إنشاء حساب مستخدم',
      severity: 'info',
      outcome: 'success',
      resourceType: 'user',
      targetResourceId: newUser.id,
      targetResourceName: newUser.name,
      details: `تم إنشاء حساب مستخدم جديد (${newUser.name}) برتبة ${newUser.role}`,
      metadata: {
        role: newUser.role,
        department: newUser.department,
        jobTitle: newUser.jobTitle,
      },
    });

    return JSON.parse(JSON.stringify(newUser));
  }

  /**
   * Updates a user's role in the central directory (Phase 2)
   */
  public updateUserRole(
    userId: string,
    role: UserRole,
    actor?: { id: string; role: UserRole }
  ): ManagedUserDTO {
    if (!userId) {
      throw new MockStoreError('معرف المستخدم مطلوب', 400);
    }
    if (!role || !['admin', 'assistant_admin', 'lecturer', 'user'].includes(role)) {
      throw new MockStoreError('الدور الوظيفي المحدد غير صالح', 400);
    }

    const canonicalId = resolveCanonicalUserId(userId).toLowerCase();
    const user = this.users.find(
      (u) =>
        u.id.toLowerCase() === canonicalId ||
        u.id.toLowerCase() === userId.toLowerCase() ||
        u.username.toLowerCase() === userId.toLowerCase() ||
        (u.legacyAliases && u.legacyAliases.some((a) => a.toLowerCase() === userId.toLowerCase()))
    );

    if (!user) {
      throw new MockStoreError('المستخدم المطلوب غير موجود في دليل النظام', 404);
    }

    if (actor) {
      const invariant = this.evaluateProtectedInvariant(actor, 'users.change_role', {
        targetUser: user,
        targetRole: role,
      });
      if (!invariant.allowed) {
        this.recordAuditLog({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'users.change_role',
          actionLabelAr: 'تعديل الدور الوظيفي',
          severity: 'critical',
          outcome: 'denied',
          resourceType: 'user',
          targetResourceId: user.id,
          targetResourceName: user.name,
          details: invariant.messageAr || 'محاولة تعديل دور المستخدم حُظرت بمحددات الأمان',
          metadata: { targetRole: role, currentRole: user.role, failureCode: invariant.code },
        });
        throw new MockStoreError(invariant.messageAr || 'غير مصرح بتنفيذ هذه العملية', 403, invariant.code);
      }
    }

    const previousRole = user.role;
    user.role = role;

    // Re-evaluate individual overrides against the new role ceiling.
    // Any now-ineligible override must not grant effective access.
    const override = this.userPermissionOverrides[canonicalId];
    if (override) {
      const ceiling = ROLE_CAPABILITY_CEILINGS[role];
      const validGranted = (override.granted || []).filter((cap) => ceiling && ceiling.has(cap));
      const validGrantedPerms = (override.grantedPermissions || []).filter((cap) => ceiling && ceiling.has(cap));
      override.granted = validGranted;
      override.grantedPermissions = validGrantedPerms;
    }

    this.recordAuditLog({
      actorId: actor?.id || 'usr_admin_001',
      actorRole: actor?.role || 'admin',
      action: 'users.change_role',
      actionLabelAr: 'تعديل الدور الوظيفي',
      severity: 'warning',
      outcome: 'success',
      resourceType: 'user',
      targetResourceId: user.id,
      targetResourceName: user.name,
      details: `تم تعديل الدور الوظيفي للمستخدم (${user.name}) من ${previousRole} إلى ${role}`,
      metadata: { previousRole, newRole: role },
    });

    return JSON.parse(JSON.stringify(user));
  }

  /**
   * Updates a user's account status (suspend / reactivate) in the central directory (Phase 2)
   */
  public updateUserStatus(
    userId: string,
    status: UserStatus,
    _reason?: string,
    actor?: { id: string; role: UserRole }
  ): ManagedUserDTO {
    void _reason;
    if (!userId) {
      throw new MockStoreError('معرف المستخدم مطلوب', 400);
    }
    if (!status || !['active', 'suspended'].includes(status)) {
      throw new MockStoreError('حالة الحساب المحددة غير صالحة', 400);
    }

    const canonicalId = resolveCanonicalUserId(userId).toLowerCase();
    const user = this.users.find(
      (u) =>
        u.id.toLowerCase() === canonicalId ||
        u.id.toLowerCase() === userId.toLowerCase() ||
        u.username.toLowerCase() === userId.toLowerCase() ||
        (u.legacyAliases && u.legacyAliases.some((a) => a.toLowerCase() === userId.toLowerCase()))
    );

    if (!user) {
      throw new MockStoreError('المستخدم المطلوب غير موجود في دليل النظام', 404);
    }

    if (actor) {
      const invariant = this.evaluateProtectedInvariant(actor, 'users.change_status', {
        targetUser: user,
        targetStatus: status,
      });
      if (!invariant.allowed) {
        this.recordAuditLog({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'users.change_status',
          actionLabelAr: 'إيقاف وتنشيط الحساب',
          severity: 'critical',
          outcome: 'denied',
          resourceType: 'user',
          targetResourceId: user.id,
          targetResourceName: user.name,
          details: invariant.messageAr || 'محاولة تعديل حالة الحساب حُظرت بمحددات الأمان',
          metadata: { targetStatus: status, failureCode: invariant.code },
        });
        throw new MockStoreError(invariant.messageAr || 'غير مصرح بتنفيذ هذه العملية', 403, invariant.code);
      }
    }

    const previousStatus = user.status;
    user.status = status;

    this.recordAuditLog({
      actorId: actor?.id || 'usr_admin_001',
      actorRole: actor?.role || 'admin',
      action: 'users.change_status',
      actionLabelAr: 'إيقاف وتنشيط الحساب',
      severity: status === 'suspended' ? 'warning' : 'info',
      outcome: 'success',
      resourceType: 'user',
      targetResourceId: user.id,
      targetResourceName: user.name,
      details: status === 'suspended'
        ? `تم إيقاف حساب المستخدم (${user.name}) مؤقتاً`
        : `تم إعادة تنشيط حساب المستخدم (${user.name}) بنجاح`,
      metadata: { previousStatus, newStatus: status, reason: _reason },
    });

    return JSON.parse(JSON.stringify(user));
  }

  /**
   * Deletes a user from the central directory with invariant enforcement
   */
  public deleteUser(
    userId: string,
    actor?: { id: string; role: UserRole }
  ): boolean {
    if (!userId) {
      throw new MockStoreError('معرف المستخدم مطلوب', 400);
    }
    const canonicalId = resolveCanonicalUserId(userId).toLowerCase();
    const userIndex = this.users.findIndex(
      (u) =>
        u.id.toLowerCase() === canonicalId ||
        u.id.toLowerCase() === userId.toLowerCase() ||
        u.username.toLowerCase() === userId.toLowerCase() ||
        (u.legacyAliases && u.legacyAliases.some((a) => a.toLowerCase() === userId.toLowerCase()))
    );

    if (userIndex === -1) {
      throw new MockStoreError('المستخدم المطلوب غير موجود في دليل النظام', 404);
    }

    const targetUser = this.users[userIndex];

    if (actor) {
      const invariant = this.evaluateProtectedInvariant(actor, 'users.delete', {
        targetUser,
      });
      if (!invariant.allowed) {
        this.recordAuditLog({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'users.delete',
          actionLabelAr: 'حذف حساب مستخدم',
          severity: 'critical',
          outcome: 'denied',
          resourceType: 'user',
          targetResourceId: targetUser.id,
          targetResourceName: targetUser.name,
          details: invariant.messageAr || 'محاولة حذف حساب مستخدم حُظرت بمحددات الأمان',
          metadata: { failureCode: invariant.code },
        });
        throw new MockStoreError(invariant.messageAr || 'غير مصرح بحذف هذا الحساب', 403, invariant.code);
      }
    }

    this.users.splice(userIndex, 1);
    delete this.mockUserCredentials[targetUser.email.toLowerCase()];
    delete this.mockUserCredentials[targetUser.username.toLowerCase()];
    delete this.mockUserCredentials[targetUser.id.toLowerCase()];
    delete this.userPermissionOverrides[targetUser.id.toLowerCase()];

    this.recordAuditLog({
      actorId: actor?.id || 'usr_admin_001',
      actorRole: actor?.role || 'admin',
      action: 'users.delete',
      actionLabelAr: 'حذف حساب مستخدم',
      severity: 'critical',
      outcome: 'success',
      resourceType: 'user',
      targetResourceId: targetUser.id,
      targetResourceName: targetUser.name,
      details: `تم حذف حساب المستخدم (${targetUser.name}) من دليل النظام نهائياً`,
      metadata: { deletedUserRole: targetUser.role },
    });

    return true;
  }

  /**
   * Generates comprehensive learning transcript for a managed user (Phase 3)
   * Resolves canonical ID, verified legacy aliases, enrollments, and attempts.
   */
  public getUserTranscript(userId: string): UserTranscriptDTO | null {
    if (!userId) return null;

    const user = this.getManagedUserById(userId);
    if (!user) return null;

    const canonicalId = resolveCanonicalUserId(user.id).toLowerCase();
    const userIdentifiers = new Set<string>([
      user.id.toLowerCase().trim(),
      canonicalId,
      ...(user.legacyAliases || []).map((a) => a.toLowerCase().trim()),
    ]);

    // 1. Gather all individual enrollments for this user
    const userEnrollments = this.enrollments.filter((e) =>
      userIdentifiers.has(e.userId.toLowerCase().trim())
    );

    // 2. Gather all course attempts for this user
    const userAttempts = this.courseAttempts.filter((a) =>
      userIdentifiers.has(a.userId.toLowerCase().trim())
    );

    // 3. Identify all distinct course IDs the user is associated with
    const distinctCourseIds = new Set<string>();
    for (const enr of userEnrollments) {
      distinctCourseIds.add(enr.courseId.toLowerCase().trim());
    }
    for (const att of userAttempts) {
      distinctCourseIds.add(att.courseId.toLowerCase().trim());
    }

    // Also check if user has progress in this.userProgress
    for (const [uid, userProg] of Object.entries(this.userProgress)) {
      if (userIdentifiers.has(uid.toLowerCase().trim())) {
        for (const cid of Object.keys(userProg)) {
          distinctCourseIds.add(cid.toLowerCase().trim());
        }
      }
    }

    const coursesList: UserTranscriptCourseItem[] = [];

    // 4. Build course-by-course history
    for (const courseIdLower of distinctCourseIds) {
      const course = this.courses.find((c) => c.id.toLowerCase() === courseIdLower);
      const courseId = course ? course.id : courseIdLower.toUpperCase();
      const courseTitle = course ? course.title : `مقرر ${courseId}`;

      // Find attempts for this course
      const attemptsForCourse = userAttempts
        .filter((a) => a.courseId.toLowerCase() === courseIdLower)
        .sort((a, b) => {
          const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
          const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
          return timeB - timeA; // Newest first
        });

      // Deduplicate attempts that share the same cycleId to prevent multi-group duplicate records
      const uniqueAttemptsForCourse: CourseAttempt[] = [];
      const seenCycleKeys = new Set<string>();
      for (const att of attemptsForCourse) {
        const cycleKey = att.cycleId || `standalone_${att.id}`;
        if (!seenCycleKeys.has(cycleKey)) {
          seenCycleKeys.add(cycleKey);
          uniqueAttemptsForCourse.push(att);
        }
      }

      // Check enrollment
      const enrollment = userEnrollments.find(
        (e) => e.courseId.toLowerCase() === courseIdLower
      );

      // Enrolled date
      const enrolledAt =
        enrollment?.enrolledAt ||
        uniqueAttemptsForCourse[uniqueAttemptsForCourse.length - 1]?.createdAt ||
        user.createdAt ||
        new Date().toISOString();

      // Check current / latest attempt
      const currentAttempt = uniqueAttemptsForCourse[0] || null;

      // Overall course progress
      let progressPercent = 0;
      let isCompleted = false;

      if (currentAttempt) {
        progressPercent = currentAttempt.progressPercent;
        if (currentAttempt.status === 'completed' || isAttemptCompleted(currentAttempt)) {
          isCompleted = true;
        }
      }

      // If user has previous completed attempt, preserve completion
      if (uniqueAttemptsForCourse.some((a) => a.status === 'completed' || isAttemptCompleted(a))) {
        isCompleted = true;
      }

      // If progress is still 0, check userProgress in store
      for (const uid of userIdentifiers) {
        const prog = this.userProgress[uid]?.[courseIdLower];
        if (prog && Object.keys(prog).length > 0) {
          const completedCount = Object.values(prog).filter((p) => p.completed).length;
          const totalItems = course ? this.getCourseItems(course.id).length : 0;
          if (totalItems > 0) {
            const calculated = Math.round((completedCount / totalItems) * 100);
            if (calculated > progressPercent) progressPercent = calculated;
            if (completedCount >= totalItems) isCompleted = true;
          }
        }
      }

      // Determine course status
      let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
      if (isCompleted || progressPercent === 100) {
        status = 'completed';
      } else if (
        progressPercent > 0 ||
        uniqueAttemptsForCourse.some(isAttemptStarted)
      ) {
        status = 'in_progress';
      }

      // Last activity timestamp
      let lastActivityAt: string | null = null;
      for (const att of uniqueAttemptsForCourse) {
        if (att.lastActivityAt) {
          if (!lastActivityAt || new Date(att.lastActivityAt) > new Date(lastActivityAt)) {
            lastActivityAt = att.lastActivityAt;
          }
        } else if (att.completedAt) {
          if (!lastActivityAt || new Date(att.completedAt) > new Date(lastActivityAt)) {
            lastActivityAt = att.completedAt;
          }
        }
      }

      // Most watched lesson calculation policy:
      // A lesson is only designated as "most-watched" if genuine, reliable viewing-frequency
      // telemetry exists (e.g. watchCount > 0 on LessonProgress).
      // Completion records (completedItemIds), playback timeline scrub positions (furthestWatchedSeconds),
      // and last-opened pointers (lastWatchedItemId) prove completion or navigation, NOT viewing frequency.
      // In accordance with data integrity principles, do NOT substitute last-completed,
      // furthest-watched, or first-completed items. If reliable frequency telemetry is missing,
      // mostWatchedLessonTitle is explicitly returned as null.
      let mostWatchedLessonTitle: string | null = null;
      let mostWatchedCount: number | null = null;

      // Check if any genuine watchCount telemetry is recorded in attempts or userProgress
      const itemWatchCounts = new Map<string, number>();

      for (const att of uniqueAttemptsForCourse) {
        if (att.lessonProgress) {
          for (const [itemId, lp] of Object.entries(att.lessonProgress)) {
            if (typeof lp.watchCount === 'number' && lp.watchCount > 0) {
              const current = itemWatchCounts.get(itemId) || 0;
              itemWatchCounts.set(itemId, Math.max(current, lp.watchCount));
            }
          }
        }
      }

      for (const uid of userIdentifiers) {
        const prog = this.userProgress[uid]?.[courseIdLower];
        if (prog) {
          for (const [itemId, lp] of Object.entries(prog)) {
            if (typeof lp.watchCount === 'number' && lp.watchCount > 0) {
              const current = itemWatchCounts.get(itemId) || 0;
              itemWatchCounts.set(itemId, Math.max(current, lp.watchCount));
            }
          }
        }
      }

      if (itemWatchCounts.size > 0 && course) {
        let maxCount = 0;
        let bestItemId: string | null = null;
        for (const [itemId, count] of itemWatchCounts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            bestItemId = itemId;
          }
        }
        if (bestItemId && maxCount > 0) {
          const flatItems = this.getCourseItems(course.id);
          const matchedItem = flatItems.find((it) => it.id === bestItemId);
          if (matchedItem) {
            mostWatchedLessonTitle = matchedItem.title;
            mostWatchedCount = maxCount;
          }
        }
      }

      coursesList.push({
        courseId,
        title: courseTitle,
        description: course?.description,
        level: course?.level,
        thumbnailUrl: course?.thumbnail,
        progressPercent,
        status,
        enrolledAt,
        lastActivityAt,
        timesOpened: null, // Transparently null: React player does not track open frequencies
        mostWatchedLessonTitle,
        mostWatchedCount,
        attemptsCount: uniqueAttemptsForCourse.length > 0 ? uniqueAttemptsForCourse.length : 1,
        attempts: uniqueAttemptsForCourse,
      });
    }

    // Sort courses by enrolledAt descending
    coursesList.sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime());

    // 5. Aggregate metrics
    const enrolledCoursesCount = coursesList.length;
    const completedCoursesCount = coursesList.filter((c) => c.status === 'completed').length;

    let averageCompletionRate = 0;
    if (enrolledCoursesCount > 0) {
      const sum = coursesList.reduce((acc, c) => acc + c.progressPercent, 0);
      averageCompletionRate = Math.round(sum / enrolledCoursesCount);
    }

    let totalAttemptsCount = 0;
    let completedAttemptsCount = 0;
    for (const c of coursesList) {
      totalAttemptsCount += c.attempts.length;
      completedAttemptsCount += c.attempts.filter((a) => a.status === 'completed' || isAttemptCompleted(a)).length;
    }

    // Learning hours telemetry policy:
    // The current React content player does not record or persist multi-session cumulative
    // elapsed viewing duration across lessons or attempts. Timeline scrub coordinates
    // (furthestWatchedSeconds) and Google Drive active-tab gates (eligibleViewingSeconds)
    // do not represent verified cumulative learning time.
    // In accordance with data integrity principles, totalLearningHours is reported as null (غير مسجل).
    const totalLearningHours: number | null = null;

    return {
      user,
      metrics: {
        totalLearningHours,
        averageCompletionRate,
        enrolledCoursesCount,
        completedCoursesCount,
        totalAttemptsCount: totalAttemptsCount > 0 ? totalAttemptsCount : enrolledCoursesCount,
        completedAttemptsCount,
      },
      courses: coursesList,
    };
  }

  /**
   * Sets or records explicit lesson progress telemetry (including optional watchCount)
   * for testing or telemetry ingestion.
   */
  public setLessonProgressTelemetry(
    userId: string,
    courseId: string,
    itemId: string,
    telemetry: Partial<LessonProgress>
  ): void {
    const normalizedUserId = userId.toLowerCase().trim();
    const normalizedCourseId = courseId.toLowerCase().trim();

    if (!this.userProgress[normalizedUserId]) {
      this.userProgress[normalizedUserId] = {};
    }
    if (!this.userProgress[normalizedUserId][normalizedCourseId]) {
      this.userProgress[normalizedUserId][normalizedCourseId] = {};
    }

    const existing = this.userProgress[normalizedUserId][normalizedCourseId][itemId] || {
      itemId,
      completed: false,
      lastPositionSeconds: 0,
      furthestWatchedSeconds: 0,
      eligibleViewingSeconds: 0,
      updatedAt: new Date().toISOString(),
    };

    this.userProgress[normalizedUserId][normalizedCourseId][itemId] = {
      ...existing,
      ...telemetry,
      updatedAt: new Date().toISOString(),
    };

    for (const att of this.courseAttempts) {
      if (
        att.userId.toLowerCase().trim() === normalizedUserId &&
        att.courseId.toLowerCase().trim() === normalizedCourseId
      ) {
        if (!att.lessonProgress) att.lessonProgress = {};
        const attExisting = att.lessonProgress[itemId] || {
          itemId,
          completed: false,
          lastPositionSeconds: 0,
          furthestWatchedSeconds: 0,
          updatedAt: new Date().toISOString(),
        };
        att.lessonProgress[itemId] = {
          ...attExisting,
          ...telemetry,
          updatedAt: new Date().toISOString(),
        };
      }
    }
  }

  // ── Store Inspection Helpers ─────────────────────────────────────────

  public getAttemptsStore(): CourseAttempt[] {
    return JSON.parse(JSON.stringify(this.courseAttempts));
  }

  public getCyclesStore(): GroupRenewalCycle[] {
    return JSON.parse(JSON.stringify(this.renewalCycles));
  }

  public getJoinRequestsStore(): GroupJoinRequest[] {
    return JSON.parse(JSON.stringify(this.groupJoinRequests));
  }

  public getMaterialsStore(): { folders: GroupMaterialFolder[]; files: GroupMaterialFile[] } {
    return {
      folders: JSON.parse(JSON.stringify(this.materialFolders)),
      files: JSON.parse(JSON.stringify(this.materialFiles)),
    };
  }

  public getGroupMembersStore(): Record<string, GroupMember[]> {
    return JSON.parse(JSON.stringify(this.groupMembers));
  }

  /**
   * Development inspection helper
   */
  public getProgressStore(): {
    userProgress: Record<string, Record<string, Record<string, LessonProgress>>>;
    lastWatched: Record<string, Record<string, string>>;
  } {
    return {
      userProgress: JSON.parse(JSON.stringify(this.userProgress)),
      lastWatched: JSON.parse(JSON.stringify(this.lastWatched)),
    };
  }

  // ── Increment 11 Phase 4: Permissions & Governance Methods ───────────

  /**
   * Evaluates protected invariants for safety-critical actions.
   */
  public evaluateProtectedInvariant(
    actor: { id: string; role: UserRole },
    action: SystemCapability | 'users.change_role' | 'users.change_status' | 'users.delete',
    context?: {
      targetUser?: ManagedUserDTO;
      targetRole?: UserRole;
      targetStatus?: UserStatus;
    }
  ): { allowed: boolean; code?: string; messageAr?: string } {
    return evaluateProtectedInvariant(
      actor,
      action as SystemCapability,
      {
        targetUser: context?.targetUser,
        targetRole: context?.targetRole,
        targetStatus: context?.targetStatus,
      },
      this.users,
      {
        roleDefaults: this.getEffectiveRoleDefaults(),
        userOverrides: this.userPermissionOverrides,
      }
    );
  }

  /**
   * Deterministic Centralized Permission Evaluator Engine (Increment 11 Phase 4A)
   * Resolves:
   * 1. Protected Invariants (Hard safety stop)
   * 2. Immutable Assistant Admin Blocked Set
   * 3. User-Specific Overrides
   * 4. Role-Level Customizations
   * 5. Baseline Role Defaults
   * 6. Execution Mode (direct vs requires_approval vs denied)
   */
  public hasPermission(
    actor: { id: string; role: UserRole } | string,
    capability: SystemCapability,
    context?: EvaluationContext
  ): PermissionCheckResult {
    let actorObj: { id: string; role: UserRole };

    if (typeof actor === 'string') {
      const user = this.getManagedUserById(actor);
      if (!user) {
        return {
          granted: false,
          executionMode: 'denied',
          source: 'role_default',
          reason: 'USER_NOT_FOUND',
          reasonAr: 'المستخدم غير موجود في دليل النظام',
        };
      }
      actorObj = { id: user.id, role: user.role };
    } else {
      actorObj = actor;
    }

    const canonicalId = resolveCanonicalUserId(actorObj.id).toLowerCase();
    const hasDelegationBypass =
      context?.hasDelegationBypass ?? Boolean(this.delegatedOperationalAuthority[canonicalId]);

    const effectiveContext: EvaluationContext = {
      ...context,
      hasDelegationBypass,
    };

    // If context specifies a target group, enrich with supervisor and assistant lecturer status
    if (effectiveContext.targetGroupId && actorObj.role === 'lecturer') {
      const group = this.groups.find((g) => g.id === effectiveContext.targetGroupId);
      if (group) {
        if (effectiveContext.isGroupSupervisor === undefined) {
          effectiveContext.isGroupSupervisor = (group.supervisorIds || []).includes(actorObj.id);
        }
        if (effectiveContext.isGroupAssistant === undefined) {
          effectiveContext.isGroupAssistant = this.isGroupAssistant(effectiveContext.targetGroupId, actorObj.id);
        }
      }
    }

    return evaluatePermission(actorObj, capability, {
      context: effectiveContext,
      userOverrides: this.userPermissionOverrides,
      allUsers: this.users,
      roleDefaults: this.getEffectiveRoleDefaults(),
    });
  }

  /**
   * Retrieves effective default capabilities across all four canonical roles,
   * merging any admin-configured defaults over the code baseline.
   */
  public getEffectiveRoleDefaults(): Record<UserRole, Partial<Record<SystemCapability, boolean>>> {
    const roles: UserRole[] = ['admin', 'assistant_admin', 'lecturer', 'user'];
    const result: Record<UserRole, Partial<Record<SystemCapability, boolean>>> = {
      admin: {},
      assistant_admin: {},
      lecturer: {},
      user: {},
    };

    for (const r of roles) {
      const cfg = this.rolePermissionConfigs[r];
      if (cfg && cfg.capabilities) {
        result[r] = { ...cfg.capabilities };
      } else {
        result[r] = { ...(ROLE_DEFAULT_CAPABILITIES[r] || {}) };
      }
    }
    return result;
  }

  /**
   * Retrieves role permissions configuration for a specific role (Fixed Baseline Policy or configured defaults)
   */
  public getRolePermissions(role: UserRole): RolePermissionsConfig {
    if (this.rolePermissionConfigs[role]) {
      return JSON.parse(JSON.stringify(this.rolePermissionConfigs[role]!));
    }
    const defaultCaps = ROLE_DEFAULT_CAPABILITIES[role] || {};
    const defaultPerms = (Object.keys(defaultCaps) as SystemCapability[]).filter(
      (cap) => Boolean(defaultCaps[cap])
    );
    return {
      role,
      capabilities: { ...defaultCaps },
      permissions: defaultPerms,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }

  /**
   * Retrieves permissions configurations for all four canonical roles
   */
  public getAllRolePermissions(): RolePermissionsConfig[] {
    const roles: UserRole[] = ['admin', 'assistant_admin', 'lecturer', 'user'];
    return roles.map((r) => this.getRolePermissions(r));
  }

  /**
   * Updates default capabilities for a role within strict immutable capability ceilings.
   * Only the system administrator (admin) may modify role defaults.
   * Validated atomically: rejects above-ceiling requests and admin lockout attempts.
   */
  public updateRolePermissions(
    role: UserRole,
    permissionsOrConfig: PermissionKey[] | Partial<Record<SystemCapability, boolean>>,
    actorOrUserId: string | { id: string; role: UserRole }
  ): RolePermissionsConfig {
    if (!role || !['admin', 'assistant_admin', 'lecturer', 'user'].includes(role)) {
      throw new MockStoreError('الدور الوظيفي المحدد غير صالح', 400);
    }

    // 1. Verify actor is an authorized system administrator
    let actorRole: UserRole = 'user';
    let actorId = '';
    if (typeof actorOrUserId === 'object' && actorOrUserId !== null) {
      actorRole = actorOrUserId.role;
      actorId = actorOrUserId.id;
    } else if (typeof actorOrUserId === 'string') {
      actorId = actorOrUserId;
      const user = this.getManagedUserById(actorOrUserId);
      if (user) {
        actorRole = user.role;
      } else {
        const canonical = resolveCanonicalUserId(actorOrUserId);
        const canonUser = canonical ? this.getManagedUserById(canonical) : undefined;
        actorRole = canonUser ? canonUser.role : (actorOrUserId.toLowerCase().includes('admin') ? 'admin' : 'user');
      }
    }

    if (actorRole !== 'admin') {
      this.recordAuditLog({
        actorId: actorId || 'unknown',
        actorRole,
        action: 'permissions.configure_roles',
        actionLabelAr: 'تعديل الصلاحيات الافتراضية للدور',
        severity: 'critical',
        outcome: 'denied',
        details: 'محاولة غير مصرح بها لتعديل الصلاحيات الافتراضية للدور',
        metadata: { role },
      });
      throw new MockStoreError('غير مصرح: تعديل الصلاحيات الافتراضية للأدوار مخصص لمدير النظام فقط', 403);
    }

    // Normalize requested capabilities
    let requestedCaps: SystemCapability[] = [];
    if (Array.isArray(permissionsOrConfig)) {
      requestedCaps = [...new Set(permissionsOrConfig as SystemCapability[])];
    } else if (typeof permissionsOrConfig === 'object' && permissionsOrConfig !== null) {
      requestedCaps = (Object.keys(permissionsOrConfig) as SystemCapability[]).filter(
        (cap) => Boolean(permissionsOrConfig[cap])
      );
    }

    // 2. Atomically validate every requested capability against role's immutable ceiling
    const ceiling = ROLE_CAPABILITY_CEILINGS[role];
    for (const cap of requestedCaps) {
      if (!ceiling || !ceiling.has(cap)) {
        const roleLabel = ROLE_CANONICAL_LABELS_AR[role] || role;
        const msg = `غير مصرح: الصلاحية (${cap}) تتجاوز السقف الأقصى المحدد لدور (${roleLabel}). لا يمكن إدراجها ضمن الصلاحيات الافتراضية للدور.`;
        this.recordAuditLog({
          actorId: actorId || 'admin',
          actorRole: 'admin',
          action: 'permissions.configure_roles',
          actionLabelAr: 'تعديل الصلاحيات الافتراضية للدور',
          severity: 'critical',
          outcome: 'denied',
          details: msg,
          metadata: { role, attemptedCapability: cap, failureCode: 'INVARIANT_CEILING_VIOLATION' },
        });
        throw new MockStoreError(msg, 400);
      }
    }

    // 3. Administrative Lockout Prevention: Essential governance capabilities cannot be stripped from admin
    if (role === 'admin') {
      const ESSENTIAL_ADMIN_CAPABILITIES: SystemCapability[] = [
        'permissions.configure_roles',
        'permissions.configure_users',
        'users.view_directory',
        'users.change_role',
      ];
      const missingEssential = ESSENTIAL_ADMIN_CAPABILITIES.filter((c) => !requestedCaps.includes(c));
      if (missingEssential.length > 0) {
        const msg = `غير مصرح: لا يمكن إزالة الصلاحيات الإدارية الجوهرية (${missingEssential.join(', ')}) من رتبة مدير النظام لتفادي الإغلاق الإداري للمنظومة`;
        this.recordAuditLog({
          actorId: actorId || 'admin',
          actorRole: 'admin',
          action: 'permissions.configure_roles',
          actionLabelAr: 'تعديل الصلاحيات الافتراضية للدور',
          severity: 'critical',
          outcome: 'denied',
          details: msg,
          metadata: { role, missingEssential, failureCode: 'INVARIANT_ADMIN_LOCKOUT_PREVENTION' },
        });
        throw new MockStoreError(msg, 400);
      }
    }

    // 4. Construct updated role configuration
    const capabilities: Partial<Record<SystemCapability, boolean>> = {};
    if (ceiling) {
      for (const cap of ceiling) {
        capabilities[cap] = requestedCaps.includes(cap);
      }
    }

    const updatedConfig: RolePermissionsConfig = {
      role,
      capabilities,
      permissions: requestedCaps,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId || 'admin',
    };

    // Centralized Administrative Lockout Prevention:
    // Validate simulated role defaults combined with existing individual overrides across all active administrators
    const simulatedDefaults = {
      ...this.getEffectiveRoleDefaults(),
      [role]: capabilities,
    };

    const governanceCheck = validateAdminGovernanceIntegrity(this.users, {
      roleDefaults: simulatedDefaults,
      userOverrides: this.userPermissionOverrides,
    });

    if (!governanceCheck.valid) {
      const msg = governanceCheck.reasonAr || 'غير مصرح: لا يمكن تعديل الصلاحيات الافتراضية بما يؤدي إلى إغلاق إداري للمنظومة';
      this.recordAuditLog({
        actorId: actorId || 'admin',
        actorRole: 'admin',
        action: 'permissions.configure_roles',
        actionLabelAr: 'تعديل الصلاحيات الافتراضية للدور',
        severity: 'critical',
        outcome: 'denied',
        details: msg,
        metadata: { role, failureCode: 'INVARIANT_ADMIN_LOCKOUT_PREVENTION' },
      });
      throw new MockStoreError(msg, 400, 'INVARIANT_ADMIN_LOCKOUT_PREVENTION');
    }

    // Store centrally without touching individual user overrides
    this.rolePermissionConfigs[role] = updatedConfig;

    this.recordAuditLog({
      actorId: actorId || 'usr_admin_001',
      actorRole: 'admin',
      action: 'permissions.configure_roles',
      actionLabelAr: 'تعديل الصلاحيات الافتراضية للدور',
      severity: 'warning',
      outcome: 'success',
      details: `تم تحديث الصلاحيات الافتراضية المعتمدة لدور (${ROLE_CANONICAL_LABELS_AR[role] || role})`,
      metadata: { role, grantedCapabilitiesCount: requestedCaps.length },
    });

    return JSON.parse(JSON.stringify(updatedConfig));
  }

  /**
   * Retrieves permission override for a user
   */
  public getUserPermissionOverride(userId: string): UserPermissionOverride | null {
    if (!userId) return null;
    const canonicalId = resolveCanonicalUserId(userId).toLowerCase();
    const override = this.userPermissionOverrides[canonicalId];
    return override ? JSON.parse(JSON.stringify(override)) : null;
  }

  /**
   * Sets or updates permission override for a user, strictly validating against Role Capability Ceiling
   */
  public setUserPermissionOverride(
    override: Omit<UserPermissionOverride, 'updatedAt'>
  ): UserPermissionOverride {
    if (!override.userId) {
      throw new MockStoreError('معرف المستخدم مطلوب', 400);
    }
    const canonicalId = resolveCanonicalUserId(override.userId).toLowerCase();
    const user = this.getManagedUserById(override.userId);
    if (!user) {
      throw new MockStoreError('المستخدم المطلوب غير موجود', 404);
    }

    const granted = override.grantedPermissions || override.granted || [];
    const revoked = override.revokedPermissions || override.revoked || [];

    // Centralized Domain Guardrail: Enforce Role Capability Ceiling
    for (const cap of granted) {
      const validation = validatePermissionOverride(user.role, cap as SystemCapability);
      if (!validation.valid) {
        const msg = validation.reasonAr || 'الصلاحية المطلوبة تتجاوز السقف الأقصى للدور الوظيفي للمستخدم';
        this.recordAuditLog({
          actorId: override.updatedBy || 'usr_admin_001',
          action: 'permissions.configure_users',
          actionLabelAr: 'تخصيص صلاحيات المستخدم',
          severity: 'critical',
          outcome: 'denied',
          resourceType: 'user',
          targetResourceId: user.id,
          targetResourceName: user.name,
          details: msg,
          metadata: { attemptedCapability: cap, userRole: user.role, failureCode: 'INVARIANT_CEILING_VIOLATION' },
        });
        throw new MockStoreError(msg, 400);
      }
    }

    const completeOverride: UserPermissionOverride = {
      userId: user.id,
      granted: [...new Set(granted)],
      revoked: [...new Set(revoked)],
      grantedPermissions: [...new Set(granted)],
      revokedPermissions: [...new Set(revoked)],
      reason: override.reason?.trim() || '',
      updatedAt: new Date().toISOString(),
      updatedBy: override.updatedBy || 'admin',
    };

    // Centralized Administrative Lockout Prevention:
    // Simulate applying the proposed override to the user before committing.
    const simulatedOverrides = {
      ...this.userPermissionOverrides,
      [canonicalId]: completeOverride,
    };

    const governanceCheck = validateAdminGovernanceIntegrity(this.users, {
      roleDefaults: this.getEffectiveRoleDefaults(),
      userOverrides: simulatedOverrides,
    });

    if (!governanceCheck.valid) {
      const msg =
        governanceCheck.reasonAr ||
        'غير مصرح: لا يمكن تطبيق هذا التعديل لأنه سيؤدي إلى حرمان آخر مدير نظام نشط من الصلاحيات الإدارية الجوهرية';
      this.recordAuditLog({
        actorId: override.updatedBy || 'usr_admin_001',
        action: 'permissions.configure_users',
        actionLabelAr: 'تخصيص صلاحيات المستخدم',
        severity: 'critical',
        outcome: 'denied',
        resourceType: 'user',
        targetResourceId: user.id,
        targetResourceName: user.name,
        details: msg,
        metadata: { failureCode: 'INVARIANT_ADMIN_LOCKOUT_PREVENTION', userRole: user.role },
      });
      throw new MockStoreError(msg, 400, 'INVARIANT_ADMIN_LOCKOUT_PREVENTION');
    }

    this.userPermissionOverrides[canonicalId] = completeOverride;

    this.recordAuditLog({
      actorId: override.updatedBy || 'usr_admin_001',
      action: 'permissions.configure_users',
      actionLabelAr: 'تخصيص صلاحيات المستخدم',
      severity: 'info',
      outcome: 'success',
      resourceType: 'user',
      targetResourceId: user.id,
      targetResourceName: user.name,
      details: `تم تحديث استثناءات الصلاحيات الفردية للمستخدم (${user.name})`,
      metadata: {
        grantedCount: completeOverride.granted?.length ?? 0,
        revokedCount: completeOverride.revoked?.length ?? 0,
        reason: completeOverride.reason,
      },
    });

    return JSON.parse(JSON.stringify(completeOverride));
  }

  /**
   * Group-Scoped Assistant Lecturer Assignment Engine
   * A lecturer can be designated to assist with a specific training group.
   * The user remains canonical role 'lecturer' platform-wide.
   */
  public assignGroupAssistant(
    groupId: string,
    assistantLecturerId: string,
    assignedByLecturerId: string
  ): GroupAssistantAssignment {
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) {
      throw new MockStoreError('المجموعة التدريبية غير موجودة', 404);
    }

    const assistantUser = this.getManagedUserById(assistantLecturerId);
    if (!assistantUser || assistantUser.role !== 'lecturer') {
      throw new MockStoreError('المحاضر المساعد يجب أن يكون مستخدماً مسجلاً بدور محاضر معتمد', 400);
    }

    // Revoke any existing active assignment for this user in this group
    const existing = this.groupAssistantAssignments.find(
      (a) =>
        a.groupId === groupId &&
        (a.assistantLecturerId === assistantUser.id ||
          resolveCanonicalUserId(a.assistantLecturerId) === resolveCanonicalUserId(assistantUser.id)) &&
        a.status === 'active'
    );
    if (existing) {
      existing.status = 'revoked';
      existing.revokedAt = new Date().toISOString();
    }

    const assignment: GroupAssistantAssignment = {
      groupId,
      assistantLecturerId: assistantUser.id,
      assignedByLecturerId,
      status: 'active',
      assignedAt: new Date().toISOString(),
    };

    this.groupAssistantAssignments.push(assignment);
    return JSON.parse(JSON.stringify(assignment));
  }

  public revokeGroupAssistant(groupId: string, assistantLecturerId: string): boolean {
    const canonicalId = resolveCanonicalUserId(assistantLecturerId);
    const assignment = this.groupAssistantAssignments.find(
      (a) =>
        a.groupId === groupId &&
        (a.assistantLecturerId === assistantLecturerId ||
          resolveCanonicalUserId(a.assistantLecturerId) === canonicalId) &&
        a.status === 'active'
    );
    if (!assignment) return false;
    assignment.status = 'revoked';
    assignment.revokedAt = new Date().toISOString();
    return true;
  }

  public getGroupAssistants(groupId: string): GroupAssistantAssignment[] {
    return this.groupAssistantAssignments
      .filter((a) => a.groupId === groupId && a.status === 'active')
      .map((a) => JSON.parse(JSON.stringify(a)));
  }

  public isGroupAssistant(groupId: string, userId: string): boolean {
    const canonicalId = resolveCanonicalUserId(userId);
    return this.groupAssistantAssignments.some(
      (a) =>
        a.groupId === groupId &&
        a.status === 'active' &&
        (a.assistantLecturerId === userId || resolveCanonicalUserId(a.assistantLecturerId) === canonicalId)
    );
  }

  /**
   * Removes permission override for a user
   */
  public deleteUserPermissionOverride(userId: string): boolean {
    if (!userId) return false;
    const canonicalId = resolveCanonicalUserId(userId).toLowerCase();
    if (this.userPermissionOverrides[canonicalId]) {
      const targetUser = this.getManagedUserById(userId);
      delete this.userPermissionOverrides[canonicalId];

      this.recordAuditLog({
        actorId: 'usr_admin_001',
        action: 'permissions.configure_users',
        actionLabelAr: 'إلغاء استثناءات الصلاحيات',
        severity: 'info',
        outcome: 'success',
        resourceType: 'user',
        targetResourceId: targetUser?.id || userId,
        targetResourceName: targetUser?.name,
        details: `تمت إزالة التخصيصات الفردية لصلاحيات المستخدم (${targetUser?.name || userId}) والعودة للافتراضي`,
      });

      return true;
    }
    return false;
  }

  /**
   * Computes effective permissions for a user considering role baseline, overrides, and delegation
   */
  public getEffectiveUserPermissions(userId: string): {
    permissions: PermissionKey[];
    role: UserRole;
    hasDelegatedAuthority: boolean;
    override: UserPermissionOverride | null;
  } {
    const user = this.getManagedUserById(userId);
    if (!user) {
      return {
        permissions: [],
        role: 'user',
        hasDelegatedAuthority: false,
        override: null,
      };
    }

    const canonicalId = resolveCanonicalUserId(user.id).toLowerCase();
    const override = this.userPermissionOverrides[canonicalId] || null;
    const hasDelegation = Boolean(this.delegatedOperationalAuthority[canonicalId]);

    // Check all known capabilities from admin default matrix
    const allCapabilities = Object.keys(ROLE_DEFAULT_CAPABILITIES.admin) as SystemCapability[];
    const grantedPermissions = allCapabilities.filter((cap) => {
      const check = this.hasPermission(user, cap, { hasDelegationBypass: hasDelegation });
      return check.granted;
    });

    return {
      permissions: grantedPermissions,
      role: user.role,
      hasDelegatedAuthority: hasDelegation,
      override: override ? JSON.parse(JSON.stringify(override)) : null,
    };
  }

  /**
   * Checks whether a user possesses a specific permission
   */
  public hasUserPermission(userId: string, permission: PermissionKey): boolean {
    const result = this.hasPermission(userId, permission as SystemCapability);
    return result.granted;
  }

  /**
   * Sets delegated operational authority for assistant roles
   */
  public setDelegatedAuthority(userId: string, enabled: boolean): void {
    const canonicalId = resolveCanonicalUserId(userId).toLowerCase();
    const targetUser = this.getManagedUserById(userId);
    if (enabled) {
      this.delegatedOperationalAuthority[canonicalId] = true;
    } else {
      delete this.delegatedOperationalAuthority[canonicalId];
    }

    this.recordAuditLog({
      actorId: 'usr_admin_001',
      action: 'governance.delegation',
      actionLabelAr: 'إدارة التفويض التشغيلي',
      severity: 'warning',
      outcome: 'success',
      resourceType: 'user',
      targetResourceId: targetUser?.id || userId,
      targetResourceName: targetUser?.name,
      details: enabled
        ? `تم تفعيل التفويض التشغيلي للمساعد (${targetUser?.name || userId})`
        : `تم إلغاء التفويض التشغيلي للمساعد (${targetUser?.name || userId})`,
      metadata: { delegationState: enabled },
    });
  }

  public getDelegatedAuthority(userId: string): boolean {
    const canonicalId = resolveCanonicalUserId(userId).toLowerCase();
    return !!this.delegatedOperationalAuthority[canonicalId];
  }

  public isDelegatedAuthority(userId: string): boolean {
    return this.getDelegatedAuthority(userId);
  }

  /**
   * Governance Approval Requests (Dual Control)
   */
  public getApprovalRequests(): ApprovalRequest[] {
    return JSON.parse(JSON.stringify(this.approvalRequests));
  }

  public createApprovalRequest(
    req: Omit<ApprovalRequest, 'id' | 'createdAt' | 'status'>
  ): ApprovalRequest {
    if (
      (req.actionType === 'users.create' || req.actionType === 'USER_CREATE') &&
      req.payload &&
      typeof req.payload === 'object' &&
      (req.payload as Record<string, unknown>).role === 'admin'
    ) {
      this.recordAuditLog({
        actorId: req.requestedBy || req.requesterId || 'unknown',
        action: 'users.create',
        actionLabelAr: 'إنشاء حساب مستخدم',
        severity: 'critical',
        outcome: 'denied',
        resourceType: 'user',
        details: 'محاولة تقديم طلب اعتماد لإنشاء حساب برتبة مدير نظام حُظرت بمحدد الأمان (Invariant 1)',
        metadata: { failureCode: 'INVARIANT_ASSISTANT_CANNOT_CREATE_ADMIN' },
      });
      throw new MockStoreError(
        'غير مصرح: لا يمكن لمساعد مدير النظام إنشاء حساب برتبة مدير نظام حتى عبر طلبات الاعتماد',
        403,
        'INVARIANT_ASSISTANT_CANNOT_CREATE_ADMIN'
      );
    }

    const newReq: ApprovalRequest = {
      ...req,
      id: `REQ_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.approvalRequests.unshift(newReq);

    this.recordAuditLog({
      actorId: newReq.requestedBy || newReq.requesterId || 'unknown',
      action: 'approvals.submit_request',
      actionLabelAr: 'تقديم طلب اعتماد',
      severity: 'info',
      outcome: 'pending_approval',
      requestId: newReq.id,
      resourceType: newReq.targetResourceId ? 'resource' : 'approval_request',
      targetResourceId: newReq.targetResourceId || newReq.targetId,
      targetResourceName: newReq.targetResourceName,
      details: newReq.titleAr || `تقديم طلب اعتماد لعملية: ${newReq.actionType}`,
      metadata: {
        actionType: newReq.actionType,
        justification: newReq.justification,
      },
    });

    return JSON.parse(JSON.stringify(newReq));
  }

  public approveApprovalRequest(
    requestId: string,
    reviewedBy: string,
    notes?: string
  ): ApprovalRequest {
    const req = this.approvalRequests.find((r) => r.id === requestId);
    if (!req) {
      throw new MockStoreError('طلب الاعتماد غير موجود', 404);
    }
    if (req.status !== 'pending') {
      this.recordAuditLog({
        actorId: reviewedBy,
        action: 'approvals.decide_request',
        actionLabelAr: 'اعتماد طلب حوكمة',
        severity: 'warning',
        outcome: 'denied',
        requestId,
        details: 'محاولة متكررة لاعتماد طلب تم البت فيه مسبقاً',
        metadata: { currentStatus: req.status },
      });
      throw new MockStoreError('تم البت في هذا الطلب مسبقاً', 400);
    }

    // 1. Verify that the approver is an authorized system administrator
    const approver = this.getManagedUserById(reviewedBy);
    if (!approver || approver.role !== 'admin') {
      this.recordAuditLog({
        actorId: reviewedBy,
        action: 'approvals.decide_request',
        actionLabelAr: 'اعتماد طلب حوكمة',
        severity: 'critical',
        outcome: 'denied',
        requestId,
        details: 'محاولة غير مصرح بها لاعتماد طلب حوكمة؛ العملية مخصصة لمدير النظام فقط',
      });
      throw new MockStoreError('غير مصرح: اعتماد العمليات الحساسة مخصص لمديري النظام فقط', 403);
    }

    // 2. Dual-control rule: requester cannot approve their own request
    const requesterCanonical = resolveCanonicalUserId(req.requestedBy || req.requesterId || '');
    const approverCanonical = resolveCanonicalUserId(reviewedBy);
    if (requesterCanonical && approverCanonical && requesterCanonical === approverCanonical) {
      this.recordAuditLog({
        actorId: reviewedBy,
        action: 'approvals.decide_request',
        actionLabelAr: 'اعتماد طلب حوكمة',
        severity: 'critical',
        outcome: 'denied',
        requestId,
        details: 'محاولة اعتماد ذاتي مخالفة لقاعدة الرقابة الثنائية والحوكمة',
        metadata: { requester: req.requestedBy },
      });
      throw new MockStoreError(
        'غير مصرح: لا يمكن لمقدم الطلب اعتماد طلبه الذاتي؛ تتطلب الحوكمة رقابة ثنائية من مدير نظام آخر',
        403
      );
    }

    // 3. Revalidate action, actor, current target state, and protected invariants
    const payload = (req.payload || {}) as Record<string, unknown>;
    const approverActor = { id: approver.id, role: approver.role };

    try {
      if (req.actionType === 'users.change_role' || req.actionType === 'USER_ROLE_CHANGE') {
        const targetId = req.targetId || (payload.userId as string);
        const newRole = (payload.role as UserRole) || (req.role as UserRole);
        if (!targetId || !newRole) {
          throw new MockStoreError('بيانات طلب تغيير الدور غير مكتملة', 400);
        }
        const currentTarget = this.getManagedUserById(targetId);
        if (!currentTarget) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: المستخدم المستهدف لم يعد موجوداً في دليل النظام', 404);
        }
        const invariant = this.evaluateProtectedInvariant(approverActor, 'users.change_role', {
          targetUser: currentTarget,
          targetRole: newRole,
        });
        if (!invariant.allowed) {
          throw new MockStoreError(invariant.messageAr || 'تعذر الاعتماد لمخالفة محددات الأمان', 403, invariant.code);
        }
        this.updateUserRole(targetId, newRole, approverActor);

      } else if (req.actionType === 'users.change_status' || req.actionType === 'USER_STATUS_CHANGE') {
        const targetId = req.targetId || (payload.userId as string);
        const newStatus = (payload.status as UserStatus);
        const reason = (payload.reason as string) || req.justification;
        if (!targetId || !newStatus) {
          throw new MockStoreError('بيانات طلب تغيير الحالة غير مكتملة', 400);
        }
        const currentTarget = this.getManagedUserById(targetId);
        if (!currentTarget) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: المستخدم المستهدف لم يعد موجوداً في دليل النظام', 404);
        }
        const invariant = this.evaluateProtectedInvariant(approverActor, 'users.change_status', {
          targetUser: currentTarget,
          targetStatus: newStatus,
        });
        if (!invariant.allowed) {
          throw new MockStoreError(invariant.messageAr || 'تعذر الاعتماد لمخالفة محددات الأمان', 403, invariant.code);
        }
        this.updateUserStatus(targetId, newStatus, reason, approverActor);

      } else if (req.actionType === 'users.delete' || req.actionType === 'USER_DELETE') {
        const targetId = req.targetId || (payload.userId as string);
        if (!targetId) {
          throw new MockStoreError('بيانات طلب الحذف غير مكتملة', 400);
        }
        const currentTarget = this.getManagedUserById(targetId);
        if (!currentTarget) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: المستخدم المستهدف لم يعد موجوداً في دليل النظام', 404);
        }
        const invariant = this.evaluateProtectedInvariant(approverActor, 'users.delete', {
          targetUser: currentTarget,
        });
        if (!invariant.allowed) {
          throw new MockStoreError(invariant.messageAr || 'تعذر الاعتماد لمخالفة محددات الأمان', 403, invariant.code);
        }
        this.deleteUser(targetId, approverActor);

      } else if (req.actionType === 'users.create' || req.actionType === 'USER_CREATE') {
        const createDto = payload as unknown as CreateUserRequestDTO;
        if (!createDto.username || !createDto.email || !createDto.name) {
          throw new MockStoreError('بيانات طلب إنشاء المستخدم غير مكتملة', 400);
        }
        if (createDto.role === 'admin') {
          const requester = this.getManagedUserById(req.requestedBy || req.requesterId || '');
          if (requester && requester.role === 'assistant_admin') {
            throw new MockStoreError(
              'تعذر تنفيذ الاعتماد: لا يمكن لمساعد مدير النظام إنشاء حساب برتبة مدير نظام',
              403,
              'INVARIANT_ASSISTANT_CANNOT_CREATE_ADMIN'
            );
          }
        }
        this.createUser(createDto, approverActor);

      } else if (req.actionType === 'groups.create' || req.actionType === 'GROUP_CREATE') {
        const groupDto = payload as unknown as CreateGroupRequestDTO;
        if (!groupDto.name) {
          throw new MockStoreError('بيانات طلب إنشاء المجموعة غير مكتملة', 400);
        }
        this.createGroup(groupDto);

      } else if (req.actionType === 'groups.edit_config' || req.actionType === 'GROUP_CONFIG_UPDATE') {
        const groupId = req.targetId || req.targetResourceId || (payload.groupId as string);
        if (!groupId) {
          throw new MockStoreError('معرف المجموعة مطلوب', 400);
        }
        const group = this.groups.find((g) => g.id === groupId);
        if (!group) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: المجموعة المستهدفة غير موجودة', 404);
        }
        this.updateGroup(groupId, payload as unknown as UpdateGroupRequestDTO);

      } else if (req.actionType === 'groups.archive' || req.actionType === 'GROUP_ARCHIVE') {
        const groupId = req.targetId || req.targetResourceId || (payload.groupId as string);
        if (!groupId) {
          throw new MockStoreError('معرف المجموعة مطلوب', 400);
        }
        const group = this.groups.find((g) => g.id === groupId);
        if (!group) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: المجموعة المستهدفة غير موجودة', 404);
        }
        this.archiveGroup(groupId);

      } else if (req.actionType === 'courses.publish' || req.actionType === 'COURSE_PUBLISH') {
        const courseId = req.targetId || req.targetResourceId || (payload.courseId as string);
        if (!courseId) {
          throw new MockStoreError('معرف المقرر مطلوب', 400);
        }
        const course = this.courses.find((c) => c.id === courseId);
        if (!course) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: المقرر المستهدف غير موجود', 404);
        }
        course.status = 'published';
        this.recordAuditLog({
          actorId: approverActor.id,
          actorRole: approverActor.role,
          action: 'courses.publish',
          actionLabelAr: 'اعتماد ونشر مقرر',
          severity: 'info',
          outcome: 'success',
          resourceType: 'course',
          targetResourceId: course.id,
          targetResourceName: course.title,
          details: `تم اعتماد ونشر المقرر التدريبي عبر تدفق الاعتماد: ${course.title}`,
        });
      } else if (
        req.actionType === 'permissions.configure_departments' ||
        req.actionType === 'DEPARTMENT_CONFIG_UPDATE'
      ) {
        const targetDeptId = req.targetId || req.targetResourceId || (payload.departmentId as string);
        if (!targetDeptId) {
          throw new MockStoreError('معرف الإدارة مطلوب لتنفيذ طلب الاعتماد', 400);
        }
        const allowedTracks = (payload.allowedTracks as string[]) || [];
        this.updateDepartmentTracks(targetDeptId, allowedTracks, approverActor);
      } else if (req.actionType === 'comments.delete' || req.actionType === 'COMMENT_DELETE') {
        const commentId = req.targetId || req.targetResourceId || (payload.commentId as string);
        if (!commentId) {
          throw new MockStoreError('معرف التعليق مطلوب لتنفيذ طلب الاعتماد', 400);
        }
        const currentComment = this.getCommentById(commentId);
        if (!currentComment) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: التعليق المستهدف لم يعد موجوداً في السجل', 404);
        }
        this.deleteComment(commentId, approverActor);
      } else if (req.actionType === 'comments.toggle' || req.actionType === 'COMMENT_TOGGLE') {
        const courseId = req.targetId || req.targetResourceId || (payload.courseId as string);
        if (!courseId) {
          throw new MockStoreError('معرف المقرر مطلوب لتنفيذ طلب الاعتماد', 400);
        }
        const currentCourse = this.courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase());
        if (!currentCourse) {
          throw new MockStoreError('تعذر تنفيذ الاعتماد: المقرر المستهدف غير موجود', 404);
        }
        const desiredState = typeof payload.commentsEnabled === 'boolean' ? payload.commentsEnabled : undefined;
        this.toggleCourseComments(courseId, desiredState, approverActor);
      }
    } catch (err: unknown) {
      req.status = 'failed_execution';
      req.executionError = err instanceof Error ? err.message : 'فشل تنفيذ الإجراء المعتمد';
      req.reviewedBy = reviewedBy;
      req.reviewedAt = new Date().toISOString();
      if (notes) req.notes = notes;

      this.recordAuditLog({
        actorId: reviewedBy,
        action: 'approvals.decide_request',
        actionLabelAr: 'تنفيذ طلب معتمد',
        severity: 'critical',
        outcome: 'failed',
        requestId: req.id,
        details: `فشل تنفيذ العملية المعتمدة (${req.actionType}): ${req.executionError}`,
        metadata: { actionType: req.actionType, error: req.executionError },
      });

      throw err;
    }

    // 4. Record successful execution
    req.status = 'approved';
    req.reviewedBy = reviewedBy;
    req.reviewedAt = new Date().toISOString();
    req.executionError = undefined;
    if (notes) req.notes = notes;

    this.recordAuditLog({
      actorId: reviewedBy,
      action: 'approvals.decide_request',
      actionLabelAr: 'اعتماد طلب حوكمة',
      severity: 'info',
      outcome: 'success',
      requestId: req.id,
      details: `تم اعتماد وتنفيذ الطلب بنجاح: ${req.titleAr || req.actionType}`,
      metadata: { actionType: req.actionType, notes },
    });

    return JSON.parse(JSON.stringify(req));
  }

  public rejectApprovalRequest(
    requestId: string,
    reviewedBy: string,
    notes?: string
  ): ApprovalRequest {
    const req = this.approvalRequests.find((r) => r.id === requestId);
    if (!req) {
      throw new MockStoreError('طلب الاعتماد غير موجود', 404);
    }
    if (req.status !== 'pending') {
      this.recordAuditLog({
        actorId: reviewedBy,
        action: 'approvals.decide_request',
        actionLabelAr: 'رفض طلب حوكمة',
        severity: 'warning',
        outcome: 'denied',
        requestId,
        details: 'محاولة متكررة لرفض طلب تم البت فيه مسبقاً',
        metadata: { currentStatus: req.status },
      });
      throw new MockStoreError('تم البت في هذا الطلب مسبقاً', 400);
    }

    // Verify rejecter is an authorized system administrator
    const rejecter = this.getManagedUserById(reviewedBy);
    if (!rejecter || rejecter.role !== 'admin') {
      this.recordAuditLog({
        actorId: reviewedBy,
        action: 'approvals.decide_request',
        actionLabelAr: 'رفض طلب حوكمة',
        severity: 'critical',
        outcome: 'denied',
        requestId,
        details: 'محاولة غير مصرح بها لرفض طلب حوكمة؛ العملية مخصصة لمدير النظام فقط',
      });
      throw new MockStoreError('غير مصرح: رفض طلبات الاعتماد مخصص لمديري النظام فقط', 403);
    }

    req.status = 'rejected';
    req.reviewedBy = reviewedBy;
    req.reviewedAt = new Date().toISOString();
    if (notes) req.notes = notes;

    this.recordAuditLog({
      actorId: reviewedBy,
      action: 'approvals.decide_request',
      actionLabelAr: 'رفض طلب حوكمة',
      severity: 'warning',
      outcome: 'rejected',
      requestId: req.id,
      details: `تم رفض طلب الاعتماد: ${req.titleAr || req.actionType}`,
      metadata: { actionType: req.actionType, notes },
    });

    return JSON.parse(JSON.stringify(req));
  }

  // ── Increment 11 Phase 4D: System Security Audit Trail ──────────────

  /**
   * Recursively strips sensitive fields (passwords, tokens, credentials, authorization headers) from audit metadata.
   */
  private sanitizeAuditData(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((item) => this.sanitizeAuditData(item));

    const sanitized: Record<string, unknown> = {};
    const SENSITIVE_KEYS = ['password', 'token', 'secret', 'credential', 'authorization', 'apikey'];
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        continue;
      }
      sanitized[key] = this.sanitizeAuditData(value);
    }
    return sanitized;
  }

  /**
   * Appends an audit log entry to the in-memory ledger with authoritative actor resolution,
   * deterministic sequential IDs, timestamp, and sensitive data sanitization.
   */
  public recordAuditLog(
    entry: Omit<SystemAuditLogEntryDTO, 'id' | 'timestamp' | 'actorName' | 'actorRole'> & {
      id?: string;
      timestamp?: string;
      actorName?: string;
      actorRole?: UserRole;
    }
  ): SystemAuditLogEntryDTO {
    let resolvedActorName = entry.actorName;
    let resolvedActorRole = entry.actorRole;

    if (!resolvedActorName || !resolvedActorRole) {
      const managed = this.getManagedUserById(entry.actorId);
      if (managed) {
        resolvedActorName = resolvedActorName || managed.name;
        resolvedActorRole = resolvedActorRole || managed.role;
      } else {
        const canonical = resolveCanonicalUserId(entry.actorId);
        const canonUser = canonical ? this.getManagedUserById(canonical) : undefined;
        if (canonUser) {
          resolvedActorName = resolvedActorName || canonUser.name;
          resolvedActorRole = resolvedActorRole || canonUser.role;
        } else {
          resolvedActorName = resolvedActorName || entry.actorId;
          resolvedActorRole = resolvedActorRole || (entry.actorId.toLowerCase().includes('admin') ? 'admin' : 'user');
        }
      }
    }

    const sanitizedMetadata = entry.metadata
      ? (this.sanitizeAuditData(entry.metadata) as Record<string, unknown>)
      : undefined;

    const auditEntry: SystemAuditLogEntryDTO = {
      id: entry.id || `AUD-${++this.auditIdCounter}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      actorId: entry.actorId,
      actorName: resolvedActorName,
      actorRole: resolvedActorRole,
      action: entry.action,
      actionLabelAr: entry.actionLabelAr,
      severity: entry.severity,
      resourceType: entry.resourceType,
      targetResourceId: entry.targetResourceId,
      targetResourceName: entry.targetResourceName,
      details: entry.details,
      outcome: entry.outcome,
      requestId: entry.requestId,
      metadata: sanitizedMetadata,
      clientContext: entry.clientContext,
    };

    this.systemAuditLogs.push(auditEntry);
    return JSON.parse(JSON.stringify(auditEntry));
  }

  /**
   * Retrieves security audit logs with flexible filtering, search, sorting (descending by timestamp),
   * and pagination. Returns a paginated DTO with deep clones to prevent internal state mutation.
   */
  public getSystemAuditLogs(params?: AuditFilterParams): AuditLogResponseDTO {
    let filtered = [...this.systemAuditLogs];

    if (params) {
      if (params.search && params.search.trim()) {
        const q = params.search.trim().toLowerCase();
        filtered = filtered.filter((entry) => {
          return (
            entry.id.toLowerCase().includes(q) ||
            entry.action.toLowerCase().includes(q) ||
            entry.actionLabelAr.toLowerCase().includes(q) ||
            entry.actorName.toLowerCase().includes(q) ||
            entry.actorId.toLowerCase().includes(q) ||
            (entry.targetResourceId && entry.targetResourceId.toLowerCase().includes(q)) ||
            (entry.targetResourceName && entry.targetResourceName.toLowerCase().includes(q)) ||
            entry.details.toLowerCase().includes(q) ||
            (entry.requestId && entry.requestId.toLowerCase().includes(q))
          );
        });
      }

      if (params.action && params.action.trim()) {
        const actionQuery = params.action.trim().toLowerCase();
        filtered = filtered.filter((entry) => entry.action.toLowerCase() === actionQuery);
      }

      if (params.outcome && params.outcome !== 'all') {
        filtered = filtered.filter((entry) => entry.outcome === params.outcome);
      }

      if (params.severity && params.severity !== 'all') {
        filtered = filtered.filter((entry) => entry.severity === params.severity);
      }

      if (params.actorId && params.actorId.trim()) {
        const actorCanonical = resolveCanonicalUserId(params.actorId.trim()).toLowerCase();
        filtered = filtered.filter((entry) => {
          const entryCanonical = resolveCanonicalUserId(entry.actorId).toLowerCase();
          return entryCanonical === actorCanonical || entry.actorId.toLowerCase() === params.actorId!.trim().toLowerCase();
        });
      }

      if (params.startDate) {
        const startTs = new Date(params.startDate).getTime();
        if (!isNaN(startTs)) {
          filtered = filtered.filter((entry) => new Date(entry.timestamp).getTime() >= startTs);
        }
      }

      if (params.endDate) {
        const endTs = new Date(params.endDate).getTime();
        if (!isNaN(endTs)) {
          filtered = filtered.filter((entry) => new Date(entry.timestamp).getTime() <= endTs);
        }
      }
    }

    // Sort descending by timestamp (newest first). If identical, by id descending.
    filtered.sort((a, b) => {
      const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (diff !== 0) return diff;
      return b.id.localeCompare(a.id);
    });

    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? params.pageSize : 15;
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedEntries = filtered.slice(offset, offset + pageSize);

    return {
      entries: JSON.parse(JSON.stringify(paginatedEntries)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Retrieves a single security audit log entry by ID.
   */
  public getSystemAuditLogById(id: string): SystemAuditLogEntryDTO | undefined {
    const entry = this.systemAuditLogs.find((e) => e.id.toLowerCase() === id.toLowerCase().trim());
    return entry ? JSON.parse(JSON.stringify(entry)) : undefined;
  }

  // ── Increment 11 Phase 4E: Department Course-Track Configuration ────

  /**
   * Retrieves all canonical departments of Cairo Metro LMS.
   */
  public getCanonicalDepartments(): CanonicalDepartmentDTO[] {
    return JSON.parse(JSON.stringify(CANONICAL_DEPARTMENTS));
  }

  /**
   * Retrieves all canonical technical training tracks of Cairo Metro LMS.
   */
  public getCanonicalTracks(): CanonicalTrackDTO[] {
    return JSON.parse(JSON.stringify(CANONICAL_TRACKS));
  }

  /**
   * Retrieves all department-track configuration records.
   * Returns deep cloned array to prevent external mutation of store state.
   */
  public getAllDepartmentTracks(): DepartmentPermissionDTO[] {
    return Object.values(this.departmentTracks).map((d) => JSON.parse(JSON.stringify(d)));
  }

  /**
   * Retrieves a single department's course-track configuration by department ID or Arabic name.
   */
  public getDepartmentTracksById(departmentId: string): DepartmentPermissionDTO | null {
    const canonical = resolveCanonicalDepartment(departmentId);
    if (!canonical) return null;
    const config = this.departmentTracks[canonical.id];
    return config ? JSON.parse(JSON.stringify(config)) : null;
  }

  /**
   * Atomically updates the allowed tracks configuration for a canonical department.
   * Validates department and tracks against canonical fixtures, deduplicates track IDs,
   * updates the store state, and records a security audit log entry.
   */
  public updateDepartmentTracks(
    departmentId: string,
    allowedTracks: string[],
    actor?: { id: string; role?: UserRole }
  ): DepartmentPermissionDTO {
    const canonicalDept = resolveCanonicalDepartment(departmentId);
    if (!canonicalDept) {
      throw new MockStoreError(
        `تعذر تحديث المسارات: الإدارة المحددة (${departmentId}) غير موجودة في السجل القياسي للمنظومة`,
        404
      );
    }

    if (!Array.isArray(allowedTracks)) {
      throw new MockStoreError('بيانات المسارات التدريبية غير صالحة، يجب تمرير مصفوفة معرفات المسارات', 400);
    }

    // Validate and resolve each track
    const canonicalTrackIds: string[] = [];
    const seenTracks = new Set<string>();

    for (const rawTrack of allowedTracks) {
      if (typeof rawTrack !== 'string' || !rawTrack.trim()) {
        throw new MockStoreError('معرف المسار التدريبي غير صالح', 400);
      }
      const canonicalTrack = resolveCanonicalTrack(rawTrack);
      if (!canonicalTrack) {
        throw new MockStoreError(
          `تعذر تحديث المسارات: المسار التدريبي (${rawTrack}) غير معرف في قائمة المسارات المعتمدة للمنظومة`,
          400
        );
      }
      if (!seenTracks.has(canonicalTrack.id)) {
        seenTracks.add(canonicalTrack.id);
        canonicalTrackIds.push(canonicalTrack.id);
      }
    }

    const previousConfig = this.departmentTracks[canonicalDept.id];
    const previousTracks = previousConfig ? [...previousConfig.allowedTracks] : [];

    const updatedConfig: DepartmentPermissionDTO = {
      departmentId: canonicalDept.id,
      departmentName: canonicalDept.nameAr,
      allowedTracks: canonicalTrackIds,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.id || 'admin',
    };

    this.departmentTracks[canonicalDept.id] = updatedConfig;

    // Record audit log
    this.recordAuditLog({
      actorId: actor?.id || 'admin',
      actorRole: actor?.role || 'admin',
      action: 'permissions.configure_departments',
      actionLabelAr: 'تحديث مسارات الإدارة التدريبية',
      severity: 'info',
      outcome: 'success',
      resourceType: 'department',
      targetResourceId: canonicalDept.id,
      targetResourceName: canonicalDept.nameAr,
      details: `تم تحديث مسارات التدريب المعتمدة لإدارة (${canonicalDept.nameAr}) بنجاح (${canonicalTrackIds.length} مسار)`,
      metadata: {
        departmentId: canonicalDept.id,
        departmentName: canonicalDept.nameAr,
        allowedTracks: canonicalTrackIds,
        previousTracks,
      },
    });

    return JSON.parse(JSON.stringify(updatedConfig));
  }

  /**
   * Returns a copy of all course attempts across groups and cycles.
   */
  public getCourseAttempts(): CourseAttempt[] {
    return [...this.courseAttempts];
  }

  // ── Increment 11 Phase 5A: Comment Moderation & Discussion Management ────

  /**
   * Retrieves all reported comments across courses.
   * Restricted to admin and assistant_admin. Lecturers and trainees are forbidden.
   */
  public getReportedComments(actor?: { id: string; role?: UserRole }): CourseComment[] {
    if (actor?.role) {
      if (actor.role === 'user') {
        throw new MockStoreError('غير مصرح: استعراض قائمة التعليقات المُبلّغ عنها مخصص للإدارة فقط', 403);
      }
      if (actor.role === 'lecturer') {
        throw new MockStoreError('غير مصرح: استعراض قائمة التعليقات المُبلّغ عنها للمنظومة مخصص لمديري النظام فقط', 403);
      }
    }
    const reported = this.courseComments
      .filter((c) => c.reported === true)
      .map((c) => {
        const course = this.courses.find((crs) => crs.id.toLowerCase() === c.courseId.toLowerCase());
        return {
          ...c,
          commentsEnabled: course ? course.commentsEnabled !== false : true,
        };
      });
    return JSON.parse(JSON.stringify(reported));
  }

  /**
   * Retrieves all comments across courses with optional query search and course filtering.
   * System-wide directory restricted to admin and assistant_admin.
   * Lecturers may query comments strictly scoped to courses they instruct.
   */
  public getAllComments(
    actor?: { id: string; role?: UserRole },
    params?: CommentFilterParams
  ): CourseComment[] {
    if (actor?.role) {
      if (actor.role === 'user') {
        throw new MockStoreError('غير مصرح: استعراض دليل التعليقات الإداري مخصص للإدارة فقط', 403);
      }
      if (actor.role === 'lecturer') {
        if (!params?.courseId) {
          throw new MockStoreError('غير مصرح: استعراض الدليل الشامل لتعليقات المنظومة مخصص لمديري النظام فقط', 403);
        }
        const course = this.courses.find((c) => c.id.toLowerCase() === params.courseId!.toLowerCase());
        if (!course || (course.lecturerId !== actor.id && !course.coLecturers?.includes(actor.id))) {
          throw new MockStoreError('غير مصرح: لا يمتلك المحاضر صلاحية استعراض تعليقات مقرر غير مسند إليه', 403);
        }
      }
    }

    let filtered = [...this.courseComments];

    if (params?.courseId) {
      const cid = params.courseId.toLowerCase().trim();
      filtered = filtered.filter((c) => c.courseId.toLowerCase().trim() === cid);
    }

    if (params?.reportedOnly) {
      filtered = filtered.filter((c) => c.reported === true);
    }

    if (params?.query && params.query.trim()) {
      const q = params.query.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.userName.toLowerCase().includes(q) ||
          c.text.toLowerCase().includes(q) ||
          c.courseTitle.toLowerCase().includes(q)
      );
    }

    // Sort descending by createdAt
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Enrich with current course commentsEnabled status
    const enriched = filtered.map((c) => {
      const course = this.courses.find((crs) => crs.id.toLowerCase() === c.courseId.toLowerCase());
      return {
        ...c,
        commentsEnabled: course ? course.commentsEnabled !== false : true,
      };
    });

    return JSON.parse(JSON.stringify(enriched));
  }

  /**
   * Retrieves active comments for a specific course.
   * Accessible to all authenticated users.
   */
  public getCourseComments(courseId: string): CourseComment[] {
    const course = this.courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase().trim());
    if (!course) {
      throw new MockStoreError('المقرر المطلوب غير موجود', 404);
    }

    const comments = this.courseComments
      .filter((c) => c.courseId.toLowerCase() === course.id.toLowerCase())
      .map((c) => ({
        ...c,
        commentsEnabled: course.commentsEnabled !== false,
      }));
    comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return JSON.parse(JSON.stringify(comments));
  }

  /**
   * Retrieves a single comment by ID.
   */
  public getCommentById(commentId: string): CourseComment | undefined {
    const comment = this.courseComments.find(
      (c) => c.id.toLowerCase() === commentId.toLowerCase().trim()
    );
    if (!comment) return undefined;
    const course = this.courses.find((crs) => crs.id.toLowerCase() === comment.courseId.toLowerCase());
    return {
      ...JSON.parse(JSON.stringify(comment)),
      commentsEnabled: course ? course.commentsEnabled !== false : true,
    };
  }

  /**
   * Retrieves moderation KPI summary metrics.
   */
  public getCommentModerationSummary(actor?: { id: string; role?: UserRole }): CommentModerationSummaryDTO {
    if (actor?.role && actor.role !== 'admin' && actor.role !== 'assistant_admin') {
      throw new MockStoreError('غير مصرح: استعراض إحصائيات التعليقات مخصص للإدارة فقط', 403);
    }

    const totalComments = this.courseComments.length;
    const reportedCommentsCount = this.courseComments.filter((c) => c.reported).length;
    const coursesWithCommentsCount = new Set(this.courseComments.map((c) => c.courseId)).size;
    const coursesWithCommentsDisabledCount = this.courses.filter((c) => c.commentsEnabled === false).length;

    return {
      totalComments,
      reportedCommentsCount,
      coursesWithCommentsCount,
      coursesWithCommentsDisabledCount,
    };
  }

  /**
   * Creates and posts a new comment on a course.
   * Validates course existence, discussion open state, text presence, and enrollment for trainees.
   */
  public createComment(
    data: CreateCommentRequestDTO,
    actor: { id: string; role: UserRole; name?: string }
  ): CourseComment {
    if (!data.text || !data.text.trim()) {
      throw new MockStoreError('نص التعليق مطلوب ولا يمكن أن يكون فارغاً', 400);
    }

    const course = this.courses.find((c) => c.id.toLowerCase() === data.courseId.toLowerCase().trim());
    if (!course) {
      throw new MockStoreError('المقرر التدريبي المطلوب غير موجود', 404);
    }

    if (course.commentsEnabled === false) {
      throw new MockStoreError('التعليقات مغلقة على هذا المقرر التدريبي', 400);
    }

    // Resolve user details
    const managedUser = this.getManagedUserById(actor.id);
    const authorName = actor.name || managedUser?.name || actor.id;

    // Check role-based discussion participation permissions
    if (actor.role === 'user') {
      const isEnrolledDirectly = this.enrollments.some(
        (e) => e.userId.toLowerCase() === actor.id.toLowerCase() && e.courseId.toLowerCase() === course.id.toLowerCase()
      );
      const isEnrolledViaGroup = this.groups.some(
        (g) =>
          g.traineeIds.some((tid) => tid.toLowerCase() === actor.id.toLowerCase()) &&
          (g.courses || []).some((c) => c.courseId.toLowerCase() === course.id.toLowerCase())
      );
      if (!isEnrolledDirectly && !isEnrolledViaGroup) {
        throw new MockStoreError('يجب أن تكون مسجلاً في المقرر للمشاركة في النقاشات', 403);
      }
    } else if (actor.role === 'lecturer') {
      const isAssigned = isUserAuthorizedCourseInstructor(course, actor.id);
      if (!isAssigned) {
        throw new MockStoreError('غير مصرح: لا يمتلك المحاضر صلاحية المشاركة في نقاشات مقرر غير مسند إليه', 403);
      }
    } else if (actor.role === 'assistant_admin') {
      throw new MockStoreError(
        'غير مصرح: حساب مدير النظام المساعد مخصص للإشراف الإداري والاعتمادات فقط ولا يمتلك صلاحية نشر تعليقات في المقررات',
        403
      );
    }

    const newComment: CourseComment = {
      id: `CMT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId: course.id,
      courseTitle: course.title,
      userId: actor.id,
      userName: authorName,
      userRole: actor.role,
      userInitial: authorName.charAt(0),
      isLecturer: actor.role === 'lecturer',
      text: data.text.trim(),
      time: 'الآن',
      createdAt: new Date().toISOString(),
      reported: false,
      reportReason: null,
      reportReasonLabelAr: null,
      reportedBy: null,
      reportedByName: null,
      reportedAt: null,
    };

    this.courseComments.unshift(newComment);
    return JSON.parse(JSON.stringify(newComment));
  }

  /**
   * Reports an inappropriate comment.
   */
  public reportComment(
    commentId: string,
    reportData: ReportCommentRequestDTO,
    actor: { id: string; role: UserRole; name?: string }
  ): CourseComment {
    const comment = this.courseComments.find(
      (c) => c.id.toLowerCase() === commentId.toLowerCase().trim()
    );
    if (!comment) {
      throw new MockStoreError('التعليق المطلوب غير موجود', 404);
    }

    const course = this.courses.find((c) => c.id.toLowerCase() === comment.courseId.toLowerCase());
    if (!course) {
      throw new MockStoreError('المقرر التدريبي المرتبط بالتعليق غير موجود', 404);
    }

    // Role-based reporting authorization
    if (actor.role === 'user') {
      const isEnrolledDirectly = this.enrollments.some(
        (e) => e.userId.toLowerCase() === actor.id.toLowerCase() && e.courseId.toLowerCase() === course.id.toLowerCase()
      );
      const isEnrolledViaGroup = this.groups.some(
        (g) =>
          g.traineeIds.some((tid) => tid.toLowerCase() === actor.id.toLowerCase()) &&
          (g.courses || []).some((c) => c.courseId.toLowerCase() === course.id.toLowerCase())
      );
      if (!isEnrolledDirectly && !isEnrolledViaGroup) {
        throw new MockStoreError('يجب أن تكون مسجلاً في المقرر للإبلاغ عن التعليقات', 403);
      }
    } else if (actor.role === 'lecturer') {
      const isAssigned = isUserAuthorizedCourseInstructor(course, actor.id);
      if (!isAssigned) {
        throw new MockStoreError('غير مصرح: لا يمتلك المحاضر صلاحية الإبلاغ عن تعليقات مقرر غير مسند إليه', 403);
      }
    } else if (actor.role === 'assistant_admin') {
      throw new MockStoreError(
        'غير مصرح: الإبلاغ عن التعليقات متاح لمتدربي ومحاضري المقرر فقط؛ يرجى استخدام لوحة إدارة التعليقات للمنظومة',
        403
      );
    } else if (actor.role === 'admin') {
      throw new MockStoreError(
        'غير مصرح: الإبلاغ عن التعليقات متاح لمتدربي ومحاضري المقرر فقط؛ يمتلك مدير النظام صلاحية الحذف والإشراف المباشر عبر لوحة التحكم',
        403
      );
    }

    if (comment.reported && comment.reportedBy?.toLowerCase() === actor.id.toLowerCase()) {
      throw new MockStoreError('لقد قمت بالإبلاغ عن هذا التعليق مسبقاً', 400);
    }

    const managedUser = this.getManagedUserById(actor.id);
    const reporterName = actor.name || managedUser?.name || actor.id;

    comment.reported = true;
    comment.reportReason = reportData.reason;
    comment.reportReasonLabelAr = COMMENT_REPORT_REASONS_AR[reportData.reason] || 'أخرى';
    comment.reportedBy = actor.id;
    comment.reportedByName = reporterName;
    comment.reportedAt = new Date().toISOString();

    // Record security audit log
    this.recordAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'comments.report',
      actionLabelAr: 'الإبلاغ عن تعليق مخالف',
      severity: 'warning',
      outcome: 'success',
      resourceType: 'comment',
      targetResourceId: comment.id,
      targetResourceName: comment.text.slice(0, 30),
      details: `تم الإبلاغ عن تعليق في مقرر (${comment.courseTitle}) بسبب: ${comment.reportReasonLabelAr}`,
      metadata: {
        commentId: comment.id,
        courseId: comment.courseId,
        reason: reportData.reason,
        notes: reportData.notes,
      },
    });

    return JSON.parse(JSON.stringify(comment));
  }

  /**
   * Ignores a comment report, clearing report metadata while preserving the comment in the course discussion.
   * Non-destructive triage action per Decision 2.
   */
  public ignoreCommentReport(
    commentId: string,
    actor: { id: string; role: UserRole }
  ): CourseComment {
    const comment = this.courseComments.find(
      (c) => c.id.toLowerCase() === commentId.toLowerCase().trim()
    );
    if (!comment) {
      throw new MockStoreError('التعليق المطلوب غير موجود', 404);
    }

    // Role-based authorization
    if (actor.role === 'user') {
      throw new MockStoreError('غير مصرح: إدارة بلاغات التعليقات مخصصة للإدارة فقط', 403);
    }

    if (actor.role === 'lecturer') {
      const course = this.courses.find((c) => c.id.toLowerCase() === comment.courseId.toLowerCase());
      if (!course || (course.lecturerId !== actor.id && !course.coLecturers?.includes(actor.id))) {
        throw new MockStoreError('غير مصرح: لا يمتلك المحاضر صلاحية إدارة بلاغات مقرر غير مسند إليه', 403);
      }
    }

    comment.reported = false;
    comment.reportReason = null;
    comment.reportReasonLabelAr = null;
    comment.reportedBy = null;
    comment.reportedByName = null;
    comment.reportedAt = null;

    // Record security audit log
    this.recordAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'comments.ignore_report',
      actionLabelAr: 'تجاهل بلاغ تعليق',
      severity: 'info',
      outcome: 'success',
      resourceType: 'comment',
      targetResourceId: comment.id,
      targetResourceName: comment.text.slice(0, 30),
      details: `تم تجاهل البلاغ وإبقاء التعليق في مقرر (${comment.courseTitle})`,
      metadata: { commentId: comment.id, courseId: comment.courseId },
    });

    return JSON.parse(JSON.stringify(comment));
  }

  /**
   * Permanently deletes a comment from authoritative storage.
   * Direct execution for admin and authorized instructors;
   * Assistant admin requires approval by default unless operational delegation is active.
   */
  public deleteComment(
    commentId: string,
    actor: { id: string; role: UserRole }
  ): boolean {
    const commentIndex = this.courseComments.findIndex(
      (c) => c.id.toLowerCase() === commentId.toLowerCase().trim()
    );
    if (commentIndex === -1) {
      throw new MockStoreError('التعليق المطلوب غير موجود', 404);
    }

    const comment = this.courseComments[commentIndex];

    // Authorization evaluation
    if (actor.role === 'user') {
      throw new MockStoreError('غير مصرح: حذف التعليقات مخصص للإدارة والمحاضر المسؤول فقط', 403);
    }

    if (actor.role === 'lecturer') {
      const course = this.courses.find((c) => c.id.toLowerCase() === comment.courseId.toLowerCase());
      if (!course || (course.lecturerId !== actor.id && !course.coLecturers?.includes(actor.id))) {
        throw new MockStoreError('غير مصرح: لا يمتلك المحاضر صلاحية حذف تعليقات مقرر غير مسند إليه', 403);
      }
    }

    // Assistant admin dual-control check: requires delegation for direct execution
    if (actor.role === 'assistant_admin') {
      const hasDelegation = this.getDelegatedAuthority(actor.id);
      if (!hasDelegation) {
        throw new MockStoreError(
          'العملية تتطلب اعتماد مدير النظام قبل التنفيذ؛ يرجى تقديم طلب اعتماد',
          202,
          'APPROVAL_REQUIRED'
        );
      }
    }

    this.courseComments.splice(commentIndex, 1);

    // Record security audit log
    this.recordAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'comments.delete',
      actionLabelAr: 'حذف تعليق نهائياً',
      severity: 'warning',
      outcome: 'success',
      resourceType: 'comment',
      targetResourceId: comment.id,
      targetResourceName: comment.text.slice(0, 30),
      details: `تم حذف التعليق نهائياً من مقرر (${comment.courseTitle}) بواسطة (${actor.role})`,
      metadata: {
        commentId: comment.id,
        courseId: comment.courseId,
        author: comment.userName,
        wasReported: comment.reported,
      },
    });

    return true;
  }

  /**
   * Toggles the discussion / comments policy for a course.
   */
  public toggleCourseComments(
    courseId: string,
    enabled?: boolean,
    actor?: { id: string; role?: UserRole }
  ): Course {
    const course = this.courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase().trim());
    if (!course) {
      throw new MockStoreError('المقرر التدريبي المطلوب غير موجود', 404);
    }

    if (actor?.role) {
      if (actor.role === 'user') {
        throw new MockStoreError('غير مصرح: تعديل حالة النقاشات مخصص للإدارة والمحاضر فقط', 403);
      }
      if (actor.role === 'lecturer') {
        if (course.lecturerId !== actor.id && !course.coLecturers?.includes(actor.id)) {
          throw new MockStoreError('غير مصرح: لا يمتلك المحاضر صلاحية تعديل إعدادات مقرر غير مسند إليه', 403);
        }
      }
      if (actor.role === 'assistant_admin') {
        const hasDelegation = this.getDelegatedAuthority(actor.id);
        if (!hasDelegation) {
          throw new MockStoreError(
            'العملية تتطلب اعتماد مدير النظام قبل التنفيذ؛ يرجى تقديم طلب اعتماد',
            202,
            'APPROVAL_REQUIRED'
          );
        }
      }
    }

    course.commentsEnabled = enabled !== undefined ? enabled : !course.commentsEnabled;

    // Record security audit log
    this.recordAuditLog({
      actorId: actor?.id || 'admin',
      actorRole: actor?.role || 'admin',
      action: 'comments.toggle',
      actionLabelAr: 'تعديل حالة النقاشات للمقرر',
      severity: 'info',
      outcome: 'success',
      resourceType: 'course',
      targetResourceId: course.id,
      targetResourceName: course.title,
      details: `تم ${course.commentsEnabled ? 'تفعيل' : 'إغلاق'} النقاشات والتعليقات لمقرر (${course.title})`,
      metadata: { courseId: course.id, commentsEnabled: course.commentsEnabled },
    });

    return JSON.parse(JSON.stringify(course));
  }

  /**
   * Generates a comprehensive cohort performance report for a specific course (Increment 11 Phase 5D).
   *
   * Scoped Authorization:
   * - System Administrator (admin): Global access.
   * - Assistant Administrator (assistant_admin): Global read-only access.
   * - Assigned Lecturer (lecturer): Scoped access strictly for courses they instruct (primary or co-lecturer).
   * - Trainee (user) / unauthorized: HTTP 403 Forbidden.
   */
  public getCoursePerformanceReport(
    courseId: string,
    actor: { id: string; role: UserRole }
  ): CoursePerformanceReportDTO {
    const course = this.courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase().trim());
    if (!course) {
      throw new MockStoreError('المقرر التدريبي المطلوب غير موجود', 404);
    }

    // Role-based scoped access
    if (actor.role === 'user') {
      throw new MockStoreError('غير مصرح: استعراض تقارير الأداء مخصص للمحاضرين وإدارة التدريب فقط', 403);
    }

    if (actor.role === 'lecturer') {
      const isAssigned = isUserAuthorizedCourseInstructor(course, actor.id);
      if (!isAssigned) {
        throw new MockStoreError('غير مصرح: لا يمتلك المحاضر صلاحية استعراض أداء متدربي مقرر غير مسند إليه', 403);
      }
    }

    // Identify enrolled trainees: direct enrollments + course.enrolledUserIds + groups assigned this course
    const candidateTraineeIds = new Set<string>();

    // 1. Direct enrollments table
    this.enrollments
      .filter((e) => e.courseId.toLowerCase() === course.id.toLowerCase())
      .forEach((e) => candidateTraineeIds.add(e.userId.toLowerCase().trim()));

    // 2. Course-level direct list if present
    if (Array.isArray(course.enrolledUserIds)) {
      course.enrolledUserIds.forEach((uid) => candidateTraineeIds.add(uid.toLowerCase().trim()));
    }

    // 3. Training groups assigned this course
    this.groups.forEach((g) => {
      const hasCourse =
        g.courseId?.toLowerCase() === course.id.toLowerCase() ||
        (g.courses || []).some((c) => c.courseId.toLowerCase() === course.id.toLowerCase());
      if (hasCourse && Array.isArray(g.traineeIds)) {
        g.traineeIds.forEach((tid) => candidateTraineeIds.add(tid.toLowerCase().trim()));
      }
    });

    const trainees: TraineePerformanceDTO[] = [];

    candidateTraineeIds.forEach((traineeId) => {
      const managedUser = this.getManagedUserById(traineeId);
      const name = managedUser?.name || 'متدرب';
      const jobTitle = managedUser?.jobTitle || 'متدرب';
      const department = managedUser?.department || 'التشغيل والصيانة';
      const rawPhone = managedUser?.phone || null;
      const cleanPhone = cleanPhoneNumber(rawPhone);

      // Find course attempt(s) for this user and course
      const userAttempts = this.courseAttempts.filter(
        (a) =>
          a.userId.toLowerCase().trim() === traineeId &&
          a.courseId.toLowerCase().trim() === course.id.toLowerCase()
      );

      // Pick latest attempt by updatedAt / startedAt
      const latestAttempt = userAttempts.sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      )[0];

      let progressPercent = 0;
      let lastActivityAt: string | null = null;
      let daysSinceLastActivity: number | null = null;

      if (latestAttempt) {
        progressPercent = Math.min(100, Math.max(0, latestAttempt.progressPercent || 0));
        lastActivityAt = latestAttempt.lastActivityAt || latestAttempt.startedAt || null;
        if (lastActivityAt) {
          const diffMs = Date.now() - new Date(lastActivityAt).getTime();
          daysSinceLastActivity = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      // Status evaluation:
      // Completed: progress >= 100%
      // Late: progress > 0% && progress < 100% && daysSinceLastActivity > 5
      // Active: progress > 0% && progress < 100% && daysSinceLastActivity <= 5
      // Not Started: progress == 0% or unstarted
      let status: 'completed' | 'active' | 'late' | 'not_started' = 'not_started';
      let statusLabelAr = 'لم يبدأ بعد';

      if (progressPercent >= 100) {
        status = 'completed';
        statusLabelAr = 'مكتمل ✅';
      } else if (progressPercent > 0) {
        if (daysSinceLastActivity !== null && daysSinceLastActivity > 5) {
          status = 'late';
          statusLabelAr = 'متأخر ⚠️';
        } else {
          status = 'active';
          statusLabelAr = 'نشط ⏳';
        }
      }

      // WhatsApp nudge URL
      let whatsappUrl: string | null = null;
      if (cleanPhone) {
        const reminderMsg = buildLecturerReminderMessage(name, course.title);
        whatsappUrl = buildWhatsAppUrl(cleanPhone, reminderMsg);
      }

      trainees.push({
        userId: traineeId,
        name,
        jobTitle,
        department,
        phone: rawPhone,
        progressPercent,
        lastActivityAt,
        daysSinceLastActivity,
        status,
        statusLabelAr,
        whatsappUrl,
      });
    });

    // Sort: Late first, then Active, then Not Started, then Completed
    const statusOrder: Record<string, number> = {
      late: 1,
      active: 2,
      not_started: 3,
      completed: 4,
    };
    trainees.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    const totalEnrolled = trainees.length;
    const completedCount = trainees.filter((t) => t.status === 'completed').length;
    const activeCount = trainees.filter((t) => t.status === 'active').length;
    const lateCount = trainees.filter((t) => t.status === 'late').length;
    const notStartedCount = trainees.filter((t) => t.status === 'not_started').length;
    const averageProgressPercent =
      totalEnrolled > 0
        ? Math.round(trainees.reduce((sum, t) => sum + t.progressPercent, 0) / totalEnrolled)
        : 0;

    return {
      courseId: course.id,
      courseTitle: course.title,
      lecturerId: course.lecturerId,
      lecturerName: course.lecturerName || 'محاضر معتمد',
      totalEnrolled,
      completedCount,
      activeCount,
      lateCount,
      notStartedCount,
      averageProgressPercent,
      trainees,
    };
  }

  /**
   * Updates or overrides course-specific WhatsApp contacts (Increment 11 Phase 5D).
   *
   * Invariants:
   * 1. The assigned lecturer's registered account phone number is the default WhatsApp contact.
   * 2. An administrator or authorized course instructor can optionally override contact numbers for this course.
   * 3. Editing a course-specific contact number MUST NOT mutate the lecturer's registered account phone number.
   * 4. Clearing the override (passing empty array or null) restores inheritance from the lecturer's registered account phone.
   */
  public updateCourseWhatsAppContacts(
    courseId: string,
    contacts: Array<{ name: string; number: string; role?: string }> | null | undefined,
    actor?: { id: string; role?: UserRole }
  ): Course {
    const course = this.courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase().trim());
    if (!course) {
      throw new MockStoreError('المقرر التدريبي المطلوب غير موجود', 404);
    }

    // Administration boundary: Only administrators can configure, change, or clear WhatsApp contact overrides
    if (!actor || actor.role !== 'admin') {
      throw new MockStoreError('غير مصرح: إدارة وتخصيص أرقام واتساب للمقرر مقتصرة على مدير النظام فقط', 403);
    }

    if (!contacts || contacts.length === 0) {
      // Clear override -> restores default inheritance from lecturer account
      delete course.whatsappContacts;
    } else {
      course.whatsappContacts = JSON.parse(JSON.stringify(contacts));
    }

    // Sync draft if exists
    if (this.courseDrafts[course.id]) {
      if (!contacts || contacts.length === 0) {
        delete this.courseDrafts[course.id].whatsappContacts;
      } else {
        this.courseDrafts[course.id].whatsappContacts = JSON.parse(JSON.stringify(contacts));
      }
    }

    return JSON.parse(JSON.stringify(course));
  }

  /**
   * Assign primary course lecturer and co-lecturers (Administrator only).
   *
   * Invariants:
   * 1. Requires actor.role === 'admin' (throws 403 otherwise).
   * 2. Validates that primary lecturer exists with role 'lecturer'.
   * 3. Validates that co-lecturers exist with role 'lecturer'.
   * 4. Updates course.lecturerId, course.lecturerName, and course.coLecturers.
   * 5. Does NOT mutate user accounts or registered phone numbers.
   * 6. Syncs course draft if present.
   */
  public assignCourseInstructors(
    courseId: string,
    assignments: {
      lecturerId: string;
      coLecturers?: string[];
    },
    actor?: { id: string; role?: UserRole }
  ): Course {
    if (!actor || actor.role !== 'admin') {
      throw new MockStoreError('غير مصرح: تعيين وإسناد محاضري المقرر مقتصر على مدير النظام فقط', 403);
    }

    const course = this.courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase().trim());
    if (!course) {
      throw new MockStoreError('المقرر التدريبي المطلوب غير موجود', 404);
    }

    const primaryLecturer = this.getManagedUserById(assignments.lecturerId);
    if (!primaryLecturer || primaryLecturer.role !== 'lecturer') {
      throw new MockStoreError('المحاضر الرئيسي المحدد غير صالح أو ليس لديه صفة محاضر', 400);
    }

    course.lecturerId = primaryLecturer.id;
    course.lecturerName = primaryLecturer.name;

    if (assignments.coLecturers && assignments.coLecturers.length > 0) {
      const validatedCoLecturers: string[] = [];
      for (const coId of assignments.coLecturers) {
        if (coId.toLowerCase() === primaryLecturer.id.toLowerCase()) continue;
        const coUser = this.getManagedUserById(coId);
        if (coUser && coUser.role === 'lecturer') {
          validatedCoLecturers.push(coUser.id);
        }
      }
      course.coLecturers = validatedCoLecturers;
    } else {
      course.coLecturers = [];
    }

    // Sync draft if exists
    if (this.courseDrafts[course.id]) {
      this.courseDrafts[course.id].lecturerId = course.lecturerId;
      this.courseDrafts[course.id].lecturerName = course.lecturerName;
      this.courseDrafts[course.id].coLecturers = [...course.coLecturers];
    }

    return JSON.parse(JSON.stringify(course));
  }

  /**
   * Resolves the effective WhatsApp contacts for a course, applying inheritance and overrides.
   *
   * Invariants:
   * 1. Returns course-specific override contacts if configured.
   * 2. Otherwise inherits registered phone numbers of primary lecturer and co-lecturers.
   */
  public resolveCourseWhatsAppContacts(courseId: string): Array<{
    id: string;
    name: string;
    role: string;
    number: string;
    isOverride: boolean;
  }> {
    const course = this.courses.find((c) => c.id.toLowerCase() === courseId.toLowerCase().trim());
    if (!course) return [];

    if (course.whatsappContacts && course.whatsappContacts.length > 0) {
      return course.whatsappContacts.map((c, idx) => ({
        id: `override_${idx}`,
        name: c.name,
        role: c.role || 'دعم المقرر المخصص',
        number: c.number,
        isOverride: true,
      }));
    }

    const inherited: Array<{
      id: string;
      name: string;
      role: string;
      number: string;
      isOverride: boolean;
    }> = [];

    const lecturerIds = [course.lecturerId, ...(course.coLecturers || [])].filter(Boolean);
    for (const lid of lecturerIds) {
      const u = this.getManagedUserById(lid);
      if (u && u.phone) {
        inherited.push({
          id: u.id,
          name: u.name,
          role: lid === course.lecturerId ? 'محاضر المقرر' : 'محاضر مشارك',
          number: u.phone,
          isOverride: false,
        });
      }
    }

    return inherited;
  }
}

export const inMemoryStore = new InMemoryStore();
