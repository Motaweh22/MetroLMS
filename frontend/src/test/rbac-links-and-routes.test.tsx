import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { RolePreviewProvider } from '@/core/auth/RolePreviewContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { EnrollmentProvider } from '@/features/courses/context/EnrollmentContext';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { GroupMonitoringPage } from '@/pages/GroupMonitoringPage';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { MemberProfilePage } from '@/pages/MemberProfilePage';
import { LecturerCoursesPage } from '@/pages/LecturerCoursesPage';
import { GroupDetailPage } from '@/pages/GroupDetailPage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { LearningPlayerPage } from '@/pages/LearningPlayerPage';
import { ItemEditorModal } from '@/features/course-builder/components/ItemEditorModal';
import { AddUserForm } from '@/features/user-management/components/AddUserForm';
import { EditUserModal } from '@/features/user-management/components/EditUserModal';
import { UserTable } from '@/features/user-management/components/UserTable';
import { CourseCard } from '@/features/courses/components/CourseCard';
import { CourseHero } from '@/features/courses/components/CourseHero';
import { ProfilePage } from '@/pages/ProfilePage';
import { ReportedCommentsQueue } from '@/features/comments/components/ReportedCommentsQueue';
import { AllCommentsTable } from '@/features/comments/components/AllCommentsTable';
import type { User } from '@/core/auth/types';
import type { ChapterItem } from '@/core/courses/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset();
  localStorage.clear();
});
afterAll(() => server.close());

const assistantAdminUser = SYNTHETIC_DEMO_ACCOUNTS.assistant_admin.user;
const lecturerUser = SYNTHETIC_DEMO_ACCOUNTS.lecturer.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function LocationProbe({ testId }: { testId: string }) {
  const loc = useLocation();
  return <div data-testid={testId}>{loc.pathname}</div>;
}

function setSessionUser(user: User) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_rbac`,
    user,
    expiresAt: Date.now() + 3600000,
  });
}

describe('RBAC Links, Routes, and UI Exposure Regression Suite', () => {
  it('routes assigned lecturer on GroupMonitoringPage back to /my-groups (never /admin/groups)', async () => {
    setSessionUser(lecturerUser);
    server.use(
      http.get('/api/admin/groups/GRP-SEC-1/monitoring', () =>
        HttpResponse.json({
          group: {
            id: 'GRP-SEC-1',
            name: 'مجموعة السلامة',
            description: 'وصف المجموعة',
            groupType: 'regular',
            adminStatus: 'active',
            enrollmentPolicy: 'open',
            primaryInstructorId: lecturerUser.id,
            assistantLecturerIds: [],
            supervisorIds: [lecturerUser.id],
            traineeIds: ['usr_tr_1'],
          },
          selectedCycle: null,
          cycles: [],
          timeRemainingText: 'غير محدد',
          cohortSummary: {
            totalMembers: 1,
            averageProgressPercent: 50,
            attentionCount: 0,
            completedCount: 0,
            notStartedCount: 0,
          },
          assignedCoursesMetrics: [],
          traineeMetricsList: [],
        })
      ),
      http.get('/api/admin/groups/GRP-SEC-1/join-requests', () => HttpResponse.json([]))
    );

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/admin/groups/GRP-SEC-1/monitoring']}>
              <Routes>
                <Route path="/admin/groups/:groupId/monitoring" element={<GroupMonitoringPage />} />
                <Route path="/my-groups" element={<LocationProbe testId="my-groups-landing" />} />
                <Route path="/admin/groups" element={<LocationProbe testId="admin-groups-forbidden" />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('back-to-group-btn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('edit-group-settings-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('back-to-group-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('my-groups-landing')).toHaveTextContent('/my-groups');
    });
  });

  it('blocks assistant_admin from CourseBuilderPage directly', async () => {
    setSessionUser(assistantAdminUser);
    render(
      <AuthProvider>
        <RolePreviewProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/lecturer/builder/CRS001']}>
              <Routes>
                <Route path="/lecturer/builder/:courseId" element={<CourseBuilderPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('builder-access-denied')).toBeInTheDocument();
    });
  });

  it('renders forbidden card on MemberProfilePage when backend returns 403', async () => {
    setSessionUser(traineeUser);
    server.use(
      http.get('/api/users/999/overview', () =>
        HttpResponse.json(
          { code: 'PERMISSION_DENIED', message: 'ليس لديك صلاحية استعراض ملف هذا المستخدم.' },
          { status: 403 }
        )
      )
    );

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <MemoryRouter initialEntries={['/users/999']}>
            <Routes>
              <Route path="/users/:userId" element={<MemberProfilePage />} />
              <Route path="/dashboard" element={<LocationProbe testId="dashboard-landing" />} />
            </Routes>
          </MemoryRouter>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('member-profile-forbidden')).toBeInTheDocument();
    });
  });

  it('does not render duplicate preview button or builder edit button for assistant_admin on LecturerCoursesPage', async () => {
    setSessionUser(assistantAdminUser);
    server.use(
      http.get('/api/lecturer/courses', () =>
        HttpResponse.json({
          courses: [
            {
              id: 'CRS-ASST-1',
              title: 'مقرر تشغيل',
              description: 'وصف',
              level: 'أساسي',
              status: 'published',
              lecturerId: lecturerUser.id,
              lecturerName: lecturerUser.name,
              chapters: [],
              enrollmentCount: 2,
            },
          ],
        })
      )
    );

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <MemoryRouter initialEntries={['/lecturer/courses']}>
            <Routes>
              <Route path="/lecturer/courses" element={<LecturerCoursesPage />} />
            </Routes>
          </MemoryRouter>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('preview-course-btn-CRS-ASST-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('edit-builder-btn-CRS-ASST-1')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('preview-course-btn-CRS-ASST-1')).toHaveLength(1);
    expect(screen.queryByTestId('create-course-btn')).not.toBeInTheDocument();
  });

  it('hides peer trainee phone/email and peer progress from trainees inside GroupDetailPage members modal', async () => {
    setSessionUser(traineeUser);
    server.use(
      http.get('/api/groups/GRP-PEERS', () =>
        HttpResponse.json({
          id: 'GRP-PEERS',
          name: 'مجموعة المتدربين',
          description: 'وصف',
          groupType: 'regular',
          adminStatus: 'active',
          enrollmentPolicy: 'open',
          primaryInstructorId: lecturerUser.id,
          assistantLecturerIds: [],
          supervisorIds: [lecturerUser.id],
          traineeIds: [traineeUser.id, 'usr_peer_2'],
          courses: [],
          resources: [],
          metrics: {
            status: 'active',
            timeRemainingText: 'غير محدد',
            cohortSummary: { totalMembers: 2, averageProgressPercent: 50, attentionCount: 0 },
            courseStatsList: [],
            traineeMetricsList: [
              {
                userId: traineeUser.id,
                userName: traineeUser.name,
                phone: '+201000000001',
                email: 'self@metro.eg',
                department: 'التشغيل',
                jobTitle: 'متدرب',
                programPercent: 80,
                completedLessonsTotal: 4,
                totalRequiredLessons: 5,
              },
              {
                userId: 'usr_peer_2',
                userName: 'المتدرب الزميل',
                phone: '+201099998888',
                email: 'secret-peer@metro.eg',
                department: 'التشغيل',
                jobTitle: 'فني صيانة',
                programPercent: 35,
                completedLessonsTotal: 1,
                totalRequiredLessons: 5,
              },
            ],
          },
        })
      ),
      http.get('/api/admin/groups/GRP-PEERS/materials', () =>
        HttpResponse.json({ folders: [], rootFiles: [] })
      )
    );

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/my-groups/GRP-PEERS']}>
              <Routes>
                <Route path="/my-groups/:groupId" element={<GroupDetailPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('open-group-members-modal-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('open-group-members-modal-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('group-member-row-usr_peer_2')).toBeInTheDocument();
    });

    expect(screen.queryByText('+201099998888')).not.toBeInTheDocument();
    expect(screen.queryByText('secret-peer@metro.eg')).not.toBeInTheDocument();
    expect(screen.queryByText(/الإنجاز: 35%/)).not.toBeInTheDocument();
    // Trainee's own progress badge stays visible
    expect(screen.getByText(/الإنجاز: 80%/)).toBeInTheDocument();
  });
});

describe('Course Description vs Lesson/Video Description Across Detail, Player & Builder', () => {
  it('displays course.description on external CourseDetailPage', async () => {
    setSessionUser(traineeUser);
    server.use(
      http.get('/api/courses/CRS-DESC-1', () =>
        HttpResponse.json({
          course: {
            id: 'CRS-DESC-1',
            title: 'مقرر صيانة العربات',
            description: 'وصف خارجي شامل للدورة يوضح أهداف البرنامج ومخرجاته.',
            level: 'أساسي',
            status: 'published',
            lecturerId: lecturerUser.id,
            lecturerName: lecturerUser.name,
            estimatedHours: 3,
            chapters: [],
          },
        })
      ),
      http.get('/api/courses/CRS-DESC-1/enrollment', () =>
        HttpResponse.json({ isEnrolled: false, hasActiveAccess: false, enrollment: null })
      ),
      http.get('/api/courses/CRS-DESC-1/comments', () => HttpResponse.json({ comments: [] })),
      http.get('/api/courses/CRS-DESC-1/whatsapp-contacts', () =>
        HttpResponse.json({ visible: false, contacts: [] })
      )
    );

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={['/courses/CRS-DESC-1']}>
              <Routes>
                <Route path="/courses/:courseId" element={<CourseDetailPage />} />
              </Routes>
            </MemoryRouter>
          </ToastProvider>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('detail-course-description-card')).toBeInTheDocument();
    });
    expect(
      screen.getByText('وصف خارجي شامل للدورة يوضح أهداف البرنامج ومخرجاته.')
    ).toBeInTheDocument();
  });

  it('displays lesson-specific description (not course.description) under video in LearningPlayerPage', async () => {
    setSessionUser(traineeUser);
    server.use(
      http.get('/api/courses/CRS-DESC-2', () =>
        HttpResponse.json({
          course: {
            id: 'CRS-DESC-2',
            title: 'مقرر الإشارات',
            description: 'وصف الكورس العام الذي لا يجب ظهوره أسفل كل فيديو.',
            level: 'أساسي',
            status: 'published',
            lecturerId: lecturerUser.id,
            lecturerName: lecturerUser.name,
            estimatedHours: 2,
            chapters: [
              {
                id: 'CH-1',
                title: 'الفصل الأول',
                order: 1,
                items: [
                  {
                    id: 'IT-1',
                    title: 'فيديو فحص الإشارة',
                    description: 'وصف خاص بهذا الفيديو فقط لشرح خطوات الفحص.',
                    type: 'video',
                    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                    videoSourceType: 'youtube',
                    youtubeVideoId: 'dQw4w9WgXcQ',
                    duration: '05:00',
                    durationSeconds: 300,
                  },
                ],
              },
            ],
          },
        })
      ),
      http.get('/api/enrollments/my', () =>
        HttpResponse.json({
          enrollments: [{ id: 'ENR-1', courseId: 'CRS-DESC-2', hasActiveAccess: true }],
        })
      ),
      http.get('/api/courses/CRS-DESC-2/enrollment', () =>
        HttpResponse.json({ isEnrolled: true, hasActiveAccess: true, enrollment: { id: 'ENR-1' } })
      ),
      http.get('/api/courses/CRS-DESC-2/comments', () =>
        HttpResponse.json({ comments: [] })
      ),
      http.get('/api/courses/CRS-DESC-2/progress', () =>
        HttpResponse.json({
          progress: { progressPercent: 0, completedLessons: 0, totalLessons: 1, completedItemIds: [] },
          lessons: [],
        })
      ),
      http.get('/api/courses/CRS-DESC-2/whatsapp-contacts', () =>
        HttpResponse.json({ visible: false, contacts: [] })
      )
    );

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <EnrollmentProvider>
            <ToastProvider>
              <MemoryRouter initialEntries={['/courses/CRS-DESC-2/learn/IT-1']}>
                <Routes>
                  <Route path="/courses/:courseId/learn/:itemId" element={<LearningPlayerPage />} />
                </Routes>
              </MemoryRouter>
            </ToastProvider>
          </EnrollmentProvider>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('lesson-description-text')).toBeInTheDocument();
    });
    expect(
      screen.getByText('وصف خاص بهذا الفيديو فقط لشرح خطوات الفحص.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('وصف الكورس العام الذي لا يجب ظهوره أسفل كل فيديو.')
    ).not.toBeInTheDocument();
  });

  it('captures and saves lesson description inside ItemEditorModal in Course Builder', async () => {
    let savedItem: ChapterItem | null = null;
    render(
      <MemoryRouter>
        <ItemEditorModal
          isOpen
          chapterId="CH-1"
          chapterTitle="الفصل الأول"
          item={{
            id: 'IT-EDIT',
            title: 'درس تعريفي',
            description: 'وصف مبدئي للدرس',
            type: 'video',
            videoSourceType: 'youtube',
            externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            youtubeVideoId: 'dQw4w9WgXcQ',
            url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            duration: '04:00',
          }}
          onClose={() => {}}
          onSave={(updated) => {
            savedItem = updated;
          }}
        />
      </MemoryRouter>
    );

    const descInput = screen.getByTestId('item-description-input') as HTMLTextAreaElement;
    expect(descInput.value).toBe('وصف مبدئي للدرس');

    fireEvent.change(descInput, { target: { value: 'وصف محدث للفيديو التدريبي' } });
    fireEvent.click(screen.getByTestId('item-save-btn'));

    await waitFor(() => {
      expect(savedItem).not.toBeNull();
    });
    expect(savedItem!.description).toBe('وصف محدث للفيديو التدريبي');
  });

  it('supports employeeNumber in AddUserForm, EditUserModal, and UserTable', async () => {
    setSessionUser(assistantAdminUser);
    let capturedPutPayload: Record<string, unknown> | null = null;
    server.use(
      http.put('/api/admin/users/USR-EMP-1', async ({ request }) => {
        capturedPutPayload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            user: {
              id: 'USR-EMP-1',
              nameEn: String(capturedPutPayload.nameEn || ''),
              employeeNumber: String(capturedPutPayload.employeeNumber || ''),
            },
          },
        });
      }),
      http.get('/api/profile', () =>
        HttpResponse.json({
          status: 'OK',
          data: {
            user: {
              id: assistantAdminUser.id,
              name: assistantAdminUser.name,
              nameEn: 'Khaled Mahmoud',
              role: assistantAdminUser.role,
              phoneE164: '+201000000002',
              employeeNumber: 'EMP-1001',
              jobTitle: 'مساعد مدير',
              department: 'الإدارة',
              initials: 'خا',
            },
            stats: {
              totalLearningHours: 12,
              enrolledCoursesCount: 2,
              completedCoursesCount: 1,
            },
          },
        })
      )
    );

    render(
      <AuthProvider>
        <RolePreviewProvider>
          <ToastProvider>
            <MemoryRouter>
              <AddUserForm onCancel={() => {}} onUserCreated={() => {}} />
              <ProfilePage />
              <UserTable
                isLoading={false}
                users={[
                  {
                    id: 'USR-EMP-1',
                    name: 'مهندس أحمد طارق',
                    nameEn: 'Ahmed Tarek',
                    username: '01012345678',
                    employeeNumber: 'EMP-9042',
                    email: 'ahmed@metro.eg',
                    phone: '01012345678',
                    jobTitle: 'مهندس تشغيل',
                    department: 'التشغيل',
                    role: 'user',
                    status: 'active',
                    createdAt: '2024-01-01',
                  },
                ]}
              />
              <EditUserModal
                isOpen
                user={{
                  id: 'USR-EMP-1',
                  name: 'مهندس أحمد طارق',
                  nameEn: 'Ahmed Tarek',
                  username: '01012345678',
                  employeeNumber: 'EMP-9042',
                  email: 'ahmed@metro.eg',
                  phone: '01012345678',
                  nationalId: '29501010101122',
                  dateOfBirth: '1995-01-01',
                  address: 'القاهرة',
                  educationalQualification: 'بكالوريوس هندسة',
                  appointmentDate: '2022-01-01',
                  jobTitle: 'مهندس تشغيل',
                  department: 'التشغيل',
                  role: 'user',
                  status: 'active',
                  createdAt: '2024-01-01',
                }}
                onClose={() => {}}
                onSuccess={() => {}}
              />
            </MemoryRouter>
          </ToastProvider>
        </RolePreviewProvider>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-user-employee-number-input')).toBeInTheDocument();
      expect(screen.getByTestId('add-user-name-en-input')).toBeInTheDocument();
      expect(screen.queryByTestId('add-user-username-input')).not.toBeInTheDocument();
      expect(screen.getByTestId('edit-user-employee-number-input')).toHaveValue('EMP-9042');
      expect(screen.getByTestId('edit-user-name-en-input')).toHaveValue('Ahmed Tarek');
      expect(screen.getAllByText('Khaled Mahmoud').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('EMP-9042')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Tarek')).toBeInTheDocument();

    const editEmpInput = screen.getByTestId('edit-user-employee-number-input');
    const editNameEnInput = screen.getByTestId('edit-user-name-en-input');
    fireEvent.change(editEmpInput, { target: { value: 'EMP-9099' } });
    fireEvent.change(editNameEnInput, { target: { value: 'Ahmed Tarek Hassan' } });
    fireEvent.click(screen.getByTestId('edit-user-submit-btn'));

    await waitFor(() => {
      expect(capturedPutPayload).not.toBeNull();
    });
    expect(capturedPutPayload!.employeeNumber).toBe('EMP-9099');
    expect(capturedPutPayload!.nameEn).toBe('Ahmed Tarek Hassan');
  });

  it('renders selected coverColor in both CourseCard and CourseHero for published courses', () => {
    setSessionUser(traineeUser);
    const coloredCourse = {
      id: 'CRS-COLOR-1',
      title: 'دورة الألوان المعتمدة',
      description: 'وصف الدورة',
      lecturerId: lecturerUser.id,
      lecturerName: lecturerUser.name,
      category: 'السلامة',
      level: 'متوسط' as const,
      duration: '4 ساعات',
      status: 'published' as const,
      chapters: [],
      rating: 4.5,
      ratingCount: 10,
      enrollmentCount: 25,
      estimatedHours: 4,
      thumbnail: '/api/media/assets/999/stream',
      coverType: 'color' as const,
      coverColor: '#065F46',
      createdAt: '2025-01-01T00:00:00Z',
    };

    const { container } = render(
      <AuthProvider>
        <RolePreviewProvider>
          <EnrollmentProvider>
            <MemoryRouter>
              <CourseCard course={coloredCourse} index={0} />
              <CourseHero course={coloredCourse} />
            </MemoryRouter>
          </EnrollmentProvider>
        </RolePreviewProvider>
      </AuthProvider>
    );

    const cardThumb = container.querySelector('.course-card-thumb') as HTMLElement;
    expect(cardThumb).not.toBeNull();
    expect(cardThumb.style.background).toContain('rgb(6, 95, 70)');

    const hero = container.querySelector('.cd-hero') as HTMLElement;
    expect(hero).not.toBeNull();
    expect(hero.style.backgroundColor).toBe('rgb(6, 95, 70)');
  });

  it('makes course, author, and reporter names clickable links in ReportedCommentsQueue and AllCommentsTable', () => {
    render(
      <MemoryRouter>
        <ReportedCommentsQueue
          isLoading={false}
          onDelete={() => {}}
          onIgnoreReport={() => {}}
          comments={[
            {
              id: 'CMT-1',
              courseId: '10005',
              courseTitle: 'تجربة',
              userId: '42',
              userName: 'متدرب فني (تجريبي)',
              userRole: 'user',
              text: 'نستتن',
              createdAt: '2026-11-22T15:54:31Z',
              reported: true,
              reportReason: 'inappropriate_content',
              reportedBy: '7',
              reportedByName: 'مطاوع محمد مطاوع',
              reportedAt: '2026-11-24T10:00:00Z',
            },
            {
              id: 'CMT-2',
              courseId: '10006',
              courseTitle: 'دورة محذوف',
              userId: '',
              userName: 'مستخدم محذوف',
              isAuthorDeleted: true,
              userRole: 'user',
              text: 'تعليق قديم',
              createdAt: '2026-11-22T15:54:31Z',
              reported: true,
              reportReason: 'spam',
              reportedBy: null,
              reportedByName: 'مستخدم المنظومة',
              reportedAt: '2026-11-24T10:00:00Z',
            },
          ]}
        />
        <AllCommentsTable
          isLoading={false}
          courses={[]}
          onDelete={() => {}}
          onToggleCourseComments={() => {}}
          searchQuery=""
          onSearchChange={() => {}}
          selectedCourseFilter="all"
          onCourseFilterChange={() => {}}
          comments={[
            {
              id: 'CMT-3',
              courseId: '10005',
              courseTitle: 'تجربة جدول',
              userId: '42',
              userName: 'أحمد سامي',
              userRole: 'user',
              text: 'ملاحظة',
              createdAt: '2026-11-22T15:54:31Z',
              reported: false,
            },
          ]}
        />
      </MemoryRouter>
    );

    const courseLinks = screen.getAllByTestId('comment-course-title');
    expect(courseLinks[0].closest('a')).toHaveAttribute('href', '/courses/10005');

    const authorLinks = screen.getAllByTestId('comment-author-name');
    expect(authorLinks[0].closest('a')).toHaveAttribute('href', '/admin/users/42');
    expect(authorLinks[1].closest('a')).toBeNull();

    const reporterLink = screen.getByTestId('comment-reporter-link');
    expect(reporterLink.closest('a')).toHaveAttribute('href', '/admin/users/7');
    expect(reporterLink).toHaveTextContent('مطاوع محمد مطاوع');

    expect(screen.getByText('تجربة جدول').closest('a')).toHaveAttribute('href', '/courses/10005');
    expect(screen.getByText('أحمد سامي').closest('a')).toHaveAttribute('href', '/admin/users/42');
  });
});
