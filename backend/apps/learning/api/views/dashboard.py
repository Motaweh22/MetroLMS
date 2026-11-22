"""Role-adaptive operational Dashboard endpoint (GET /api/dashboard)."""
from __future__ import annotations

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.models import Course
from apps.groups.models import GroupMembership, TrainingGroup
from apps.learning.models import Enrollment
from apps.learning.services.learning_service import compute_course_progress
from shared.api import success_response


class DashboardView(APIView):
    """GET /api/dashboard — Role-adaptive operational dashboard data."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        user = request.user
        role_id = user.role_id
        now = timezone.now()

        if role_id == "trainee":
            enrollments = (
                Enrollment.objects.filter(user=user, source_grants__isnull=False)
                .select_related("course__primary_lecturer")
                .prefetch_related("attempts")
                .distinct()
            )
            enrolled_count = enrollments.count()
            completed_count = 0
            continue_card = None
            for enr in enrollments:
                att = enr.attempts.order_by("-id").first()
                prog = compute_course_progress(att) if att else None
                pct = prog["progressPercent"] if prog else 0
                if pct == 100:
                    completed_count += 1
                elif continue_card is None:
                    continue_card = {
                        "courseId": str(enr.course_id),
                        "courseTitle": enr.course.title,
                        "lecturerName": enr.course.primary_lecturer.full_name,
                        "progressPercent": pct,
                        "resumeItemId": "",
                        "resumeLessonTitle": "",
                    }
            active_groups_count = GroupMembership.objects.filter(user=user, training_group__is_archived=False).count()
            return success_response(
                {
                    "role": "user",
                    "welcome": {
                        "name": user.full_name,
                        "dateAr": now.strftime("%Y-%m-%d"),
                        "jobTitle": "متدرب",
                        "department": "",
                    },
                    "continueLearning": continue_card,
                    "stats": {
                        "enrolledCount": enrolled_count,
                        "completedCount": completed_count,
                        "totalLearningHours": 0,
                        "activeGroupsCount": active_groups_count,
                    },
                    "attention": {
                        "hasEvaluated": True,
                        "items": [],
                        "allClear": True,
                        "allClearMessage": "لا توجد تنبيهات تعلم متأخرة حالياً.",
                    },
                    "upcomingSessions": [],
                }
            )

        if role_id == "lecturer":
            courses = Course.objects.filter(primary_lecturer=user).order_by("-id")[:10]
            assigned_courses = [
                {
                    "id": str(c.id),
                    "title": c.title,
                    "level": c.course_type,
                    "duration": "—",
                    "enrolledCount": Enrollment.objects.filter(course=c, source_grants__isnull=False).distinct().count(),
                    "rating": 0,
                    "status": c.lifecycle_status,
                }
                for c in courses
            ]
            return success_response(
                {
                    "role": "lecturer",
                    "welcome": {
                        "name": user.full_name,
                        "roleTitle": "محاضر معتمد",
                        "department": "",
                    },
                    "stats": {
                        "assignedCoursesCount": Course.objects.filter(primary_lecturer=user).count(),
                        "totalTraineesCount": Enrollment.objects.filter(course__primary_lecturer=user, source_grants__isnull=False).distinct().count(),
                        "averageRating": "0.0",
                        "supervisedGroupsCount": 0,
                    },
                    "assignedCourses": assigned_courses,
                    "supervisedGroups": [],
                }
            )

        # Admin / Super Admin / Assistant Admin / Developer
        top_courses = [
            {
                "id": str(c.id),
                "title": c.title,
                "lecturerName": c.primary_lecturer.full_name,
                "enrollmentCount": Enrollment.objects.filter(course=c, source_grants__isnull=False).distinct().count(),
                "completionRate": 0,
                "rating": 0,
            }
            for c in Course.objects.select_related("primary_lecturer").order_by("-id")[:5]
        ]
        active_groups = [
            {
                "id": str(g.id),
                "name": g.name,
                "status": "Active" if not g.is_archived else "Archived",
                "traineeCount": GroupMembership.objects.filter(training_group=g).count(),
                "deadlineText": g.deadline_datetime.strftime("%Y-%m-%d") if g.deadline_datetime else "بدون موعد",
                "overallProgress": 0,
            }
            for g in TrainingGroup.objects.filter(is_archived=False).order_by("-id")[:5]
        ]
        return success_response(
            {
                "role": role_id,
                "welcome": {
                    "name": user.full_name,
                    "roleTitle": role_id,
                },
                "stats": {
                    "totalCoursesCount": Course.objects.count(),
                    "totalEnrollmentsCount": Enrollment.objects.filter(source_grants__isnull=False).distinct().count(),
                    "activeGroupsCount": TrainingGroup.objects.filter(is_archived=False).count(),
                    "totalAttentionFlagsCount": 0,
                },
                "topCourses": top_courses,
                "activeGroupsOverview": active_groups,
            }
        )

