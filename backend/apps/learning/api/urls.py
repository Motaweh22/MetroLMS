"""URL routes for apps.learning."""
from django.urls import path

from apps.learning.api.views.assessments import (
    CertificateIssueView,
    CertificateRevokeView,
    CertificateVerifyPublicView,
    LecturerCoursePerformanceView,
    QuizSubmitView,
)
from apps.learning.api.views.dashboard import DashboardView
from apps.learning.api.views.learning import (
    CourseEnrollmentGroupGrantRevokeView,
    CourseEnrollmentStatusView,
    CourseEnrollmentsView,
    CourseProgressView,
    LessonActivityView,
    LessonCompleteView,
    MyEnrollmentsView,
    UserCourseAttemptsView,
)

urlpatterns = [
    path("dashboard", DashboardView.as_view(), name="dashboard"),
    path("enrollments/my", MyEnrollmentsView.as_view(), name="enrollments-my"),
    path("courses/<int:course_id>/enrollments", CourseEnrollmentsView.as_view(), name="course-enrollments"),
    path("courses/<int:course_id>/enrollment", CourseEnrollmentStatusView.as_view(), name="course-enrollment-status"),
    path(
        "courses/<int:course_id>/enrollments/<int:user_id>/group-grant",
        CourseEnrollmentGroupGrantRevokeView.as_view(),
        name="course-enrollment-group-grant",
    ),
    path(
        "users/<int:user_id>/courses/<int:course_id>/attempts",
        UserCourseAttemptsView.as_view(),
        name="user-course-attempts",
    ),
    path("courses/<int:course_id>/progress", CourseProgressView.as_view(), name="course-progress"),
    path(
        "courses/<int:course_id>/lessons/<int:lesson_id>/activity",
        LessonActivityView.as_view(),
        name="lesson-activity",
    ),
    path(
        "courses/<int:course_id>/lessons/<int:lesson_id>/complete",
        LessonCompleteView.as_view(),
        name="lesson-complete",
    ),
    path(
        "courses/<int:course_id>/items/<int:lesson_id>/activity",
        LessonActivityView.as_view(),
        name="item-activity",
    ),
    path(
        "courses/<int:course_id>/items/<int:lesson_id>/complete",
        LessonCompleteView.as_view(),
        name="item-complete",
    ),
    path(
        "courses/<int:course_id>/lessons/<int:lesson_id>/quiz/submit",
        QuizSubmitView.as_view(),
        name="lesson-quiz-submit",
    ),
    path(
        "attempts/<int:attempt_id>/certificate/issue",
        CertificateIssueView.as_view(),
        name="certificate-issue",
    ),
    path(
        "admin/certificates/<int:certificate_id>/revoke",
        CertificateRevokeView.as_view(),
        name="certificate-revoke",
    ),
    path(
        "certificates/verify/<str:code>",
        CertificateVerifyPublicView.as_view(),
        name="certificate-verify-public",
    ),
    path(
        "lecturer/courses/<int:course_id>/performance",
        LecturerCoursePerformanceView.as_view(),
        name="lecturer-course-performance",
    ),
]
