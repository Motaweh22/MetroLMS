"""Role-adaptive operational Dashboard endpoint (GET /api/dashboard)."""
from __future__ import annotations

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.models import Course, LessonItem
from apps.groups.models import GroupAssistantAssignment, GroupCourseAssignment, GroupMembership, GroupRenewalCycle, TrainingGroup
from apps.learning.models import CourseAttempt, Enrollment, LessonProgress
from apps.learning.services.learning_service import compute_course_progress
from shared.api import success_response


def _compute_user_learning_hours(user) -> float:
    agg = LessonProgress.objects.filter(course_attempt__enrollment__user=user).aggregate(
        elig=Sum("eligible_viewing_seconds"),
        furth=Sum("furthest_watched_seconds"),
    )
    total_sec = int(agg.get("elig") or 0) or int(agg.get("furth") or 0)
    return round(total_sec / 3600, 1) if total_sec > 0 else 0


def _compute_courses_completion_rates(course_ids: list[int]) -> dict[int, int]:
    """Batch-compute average progress/completion percentage for a list of course IDs (3 queries)."""
    if not course_ids:
        return {}
    enr_rows = list(
        Enrollment.objects.filter(course_id__in=course_ids, source_grants__isnull=False)
        .values_list("id", "course_id")
        .distinct()
    )
    if not enr_rows:
        return {cid: 0 for cid in course_ids}

    enr_to_course = {eid: cid for eid, cid in enr_rows}
    enr_ids = list(enr_to_course.keys())

    latest_attempts: dict[int, tuple[int, int]] = {}
    for att_id, eid, pub_id in (
        CourseAttempt.objects.filter(enrollment_id__in=enr_ids)
        .order_by("id")
        .values_list("id", "enrollment_id", "published_version_id")
    ):
        latest_attempts[eid] = (att_id, pub_id)

    pub_ids = {pub_id for _, pub_id in latest_attempts.values() if pub_id}
    att_ids = [att_id for att_id, _ in latest_attempts.values()]

    total_lessons_by_pub: dict[int, int] = {}
    if pub_ids:
        for row in (
            LessonItem.objects.filter(module__published_version_id__in=pub_ids)
            .values("module__published_version_id")
            .annotate(cnt=Count("id"))
        ):
            total_lessons_by_pub[row["module__published_version_id"]] = row["cnt"]

    completed_by_att: dict[int, int] = {}
    if att_ids:
        for row in (
            LessonProgress.objects.filter(course_attempt_id__in=att_ids, is_completed=True)
            .values("course_attempt_id")
            .annotate(cnt=Count("id"))
        ):
            completed_by_att[row["course_attempt_id"]] = row["cnt"]

    sums: dict[int, int] = {cid: 0 for cid in course_ids}
    counts: dict[int, int] = {cid: 0 for cid in course_ids}
    for eid, cid in enr_rows:
        counts[cid] = counts.get(cid, 0) + 1
        att_info = latest_attempts.get(eid)
        if att_info is not None:
            att_id, pub_id = att_info
            total = total_lessons_by_pub.get(pub_id, 0)
            done = completed_by_att.get(att_id, 0)
            if total > 0:
                sums[cid] += round((done / total) * 100)

    return {
        cid: (round(sums[cid] / counts[cid]) if counts[cid] > 0 else 0)
        for cid in course_ids
    }


def _compute_groups_overview_metrics(group_ids: list[int]) -> tuple[dict[int, int], dict[int, int]]:
    """Batch-compute (trainee_counts, avg_progress_percents) for a list of group IDs (5 queries max)."""
    if not group_ids:
        return {}, {}

    members_by_group: dict[int, list[int]] = {gid: [] for gid in group_ids}
    all_user_ids: set[int] = set()
    for gid, uid in GroupMembership.objects.filter(training_group_id__in=group_ids).values_list(
        "training_group_id", "user_id"
    ):
        members_by_group.setdefault(gid, []).append(uid)
        all_user_ids.add(uid)

    trainee_counts = {gid: len(uids) for gid, uids in members_by_group.items()}

    # Active cycles per group (fallback to latest cycle if none is Active)
    active_cycle_by_group: dict[int, int] = {}
    for cid, gid, status_val in (
        GroupRenewalCycle.objects.filter(training_group_id__in=group_ids)
        .order_by("-cycle_number")
        .values_list("id", "training_group_id", "cycle_status")
    ):
        if status_val == "Active":
            active_cycle_by_group[gid] = cid
        elif gid not in active_cycle_by_group:
            active_cycle_by_group[gid] = cid

    cycle_ids = list(active_cycle_by_group.values())
    courses_by_group: dict[int, list[int]] = {gid: [] for gid in group_ids}
    all_course_ids: set[int] = set()
    if cycle_ids:
        cycle_to_group = {cid: gid for gid, cid in active_cycle_by_group.items()}
        for cyc_id, course_id in GroupCourseAssignment.objects.filter(
            group_renewal_cycle_id__in=cycle_ids
        ).values_list("group_renewal_cycle_id", "course_id"):
            gid = cycle_to_group.get(cyc_id)
            if gid is not None:
                courses_by_group.setdefault(gid, []).append(course_id)
                all_course_ids.add(course_id)

    if not all_user_ids or not all_course_ids:
        return trainee_counts, {gid: 0 for gid in group_ids}

    latest_attempts: dict[tuple[int, int], tuple[int, int]] = {}
    for att_id, uid, cid, pub_id in (
        CourseAttempt.objects.filter(
            enrollment__user_id__in=all_user_ids,
            enrollment__course_id__in=all_course_ids,
        )
        .order_by("id")
        .values_list("id", "enrollment__user_id", "enrollment__course_id", "published_version_id")
    ):
        latest_attempts[(uid, cid)] = (att_id, pub_id)

    pub_ids = {pub_id for _, pub_id in latest_attempts.values() if pub_id}
    att_ids = [att_id for att_id, _ in latest_attempts.values()]

    total_lessons_by_pub: dict[int, int] = {}
    if pub_ids:
        for row in (
            LessonItem.objects.filter(module__published_version_id__in=pub_ids)
            .values("module__published_version_id")
            .annotate(cnt=Count("id"))
        ):
            total_lessons_by_pub[row["module__published_version_id"]] = row["cnt"]

    completed_by_att: dict[int, int] = {}
    if att_ids:
        for row in (
            LessonProgress.objects.filter(course_attempt_id__in=att_ids, is_completed=True)
            .values("course_attempt_id")
            .annotate(cnt=Count("id"))
        ):
            completed_by_att[row["course_attempt_id"]] = row["cnt"]

    avg_progress: dict[int, int] = {}
    for gid in group_ids:
        uids = members_by_group.get(gid, [])
        cids = courses_by_group.get(gid, [])
        if not uids or not cids:
            avg_progress[gid] = 0
            continue
        pct_sum = 0
        for uid in uids:
            for cid in cids:
                att_info = latest_attempts.get((uid, cid))
                if att_info is not None:
                    att_id, pub_id = att_info
                    total = total_lessons_by_pub.get(pub_id, 0)
                    done = completed_by_att.get(att_id, 0)
                    if total > 0:
                        pct_sum += round((done / total) * 100)
        avg_progress[gid] = round(pct_sum / (len(uids) * len(cids)))

    return trainee_counts, avg_progress


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
                        "resumeItemId": str(prog.get("lastWatchedItemId") or "") if prog else "",
                        "resumeLessonTitle": str(prog.get("lastWatchedLessonTitle") or "") if prog else "",
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
                        "totalLearningHours": _compute_user_learning_hours(user),
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
            courses = list(Course.objects.filter(primary_lecturer=user).order_by("-id")[:10])
            course_ids = [c.id for c in courses]
            enr_by_course = (
                {
                    row["course_id"]: row["cnt"]
                    for row in Enrollment.objects.filter(course_id__in=course_ids, source_grants__isnull=False)
                    .values("course_id")
                    .annotate(cnt=Count("id", distinct=True))
                }
                if course_ids
                else {}
            )
            assigned_courses = [
                {
                    "id": str(c.id),
                    "title": c.title,
                    "level": c.course_type,
                    "duration": "—",
                    "enrolledCount": enr_by_course.get(c.id, 0),
                    "rating": 0,
                    "status": c.lifecycle_status,
                }
                for c in courses
            ]
            sup_groups = list(
                TrainingGroup.objects.filter(assistant_assignments__user=user, is_archived=False)
                .distinct()
                .order_by("-id")[:10]
            )
            sup_group_ids = [g.id for g in sup_groups]
            sup_member_counts = (
                {
                    row["training_group_id"]: row["cnt"]
                    for row in GroupMembership.objects.filter(training_group_id__in=sup_group_ids)
                    .values("training_group_id")
                    .annotate(cnt=Count("id"))
                }
                if sup_group_ids
                else {}
            )
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
                        "supervisedGroupsCount": GroupAssistantAssignment.objects.filter(user=user)
                        .values("training_group_id")
                        .distinct()
                        .count(),
                    },
                    "assignedCourses": assigned_courses,
                    "supervisedGroups": [
                        {
                            "id": str(g.id),
                            "name": g.name,
                            "traineeCount": sup_member_counts.get(g.id, 0),
                            "status": "Active",
                        }
                        for g in sup_groups
                    ],
                }
            )

        # Admin / Super Admin / Assistant Admin / Developer
        top_course_objs = list(Course.objects.select_related("primary_lecturer").order_by("-id")[:5])
        top_course_ids = [c.id for c in top_course_objs]
        top_enr_counts = (
            {
                row["course_id"]: row["cnt"]
                for row in Enrollment.objects.filter(course_id__in=top_course_ids, source_grants__isnull=False)
                .values("course_id")
                .annotate(cnt=Count("id", distinct=True))
            }
            if top_course_ids
            else {}
        )
        top_completion_rates = _compute_courses_completion_rates(top_course_ids)
        top_courses = [
            {
                "id": str(c.id),
                "title": c.title,
                "lecturerName": c.primary_lecturer.full_name,
                "enrollmentCount": top_enr_counts.get(c.id, 0),
                "completionRate": top_completion_rates.get(c.id, 0),
                "rating": 0,
            }
            for c in top_course_objs
        ]

        active_group_objs = list(TrainingGroup.objects.filter(is_archived=False).order_by("-id")[:5])
        active_group_ids = [g.id for g in active_group_objs]
        group_trainee_counts, group_avg_progress = _compute_groups_overview_metrics(active_group_ids)
        active_groups = [
            {
                "id": str(g.id),
                "name": g.name,
                "status": "Active" if not g.is_archived else "Archived",
                "traineeCount": group_trainee_counts.get(g.id, 0),
                "deadlineText": g.deadline_datetime.strftime("%Y-%m-%d") if g.deadline_datetime else "بدون موعد",
                "overallProgress": group_avg_progress.get(g.id, 0),
            }
            for g in active_group_objs
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

