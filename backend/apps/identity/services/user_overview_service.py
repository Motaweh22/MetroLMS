"""Aggregated courses & training groups overview for User Profile & Member Overview."""
from __future__ import annotations

from django.db.models import Q

from apps.courses.models import Course
from apps.groups.models import GroupAssistantAssignment, GroupMembership, TrainingGroup
from apps.identity.models import User
from apps.learning.models import CourseAttempt, Enrollment
from apps.learning.services.learning_service import compute_course_progress


def get_user_courses_and_groups_overview(target_user: User) -> dict:
    """Return enrolled courses, assigned/created courses, supervised groups (with cycle count), and member groups."""
    # 1. Enrolled courses (active source_grants)
    enrollments = (
        Enrollment.objects.filter(user=target_user, source_grants__isnull=False)
        .select_related("course")
        .prefetch_related("source_grants")
        .distinct()
        .order_by("-enrolled_at", "-id")
    )
    enrolled_courses = []
    for enr in enrollments:
        course = enr.course
        sources = sorted({g.source_type for g in enr.source_grants.all()})
        latest_attempt = CourseAttempt.objects.filter(enrollment=enr).order_by("-id").first()
        progress_pct = 0
        is_completed = False
        if latest_attempt is not None:
            prog = compute_course_progress(latest_attempt)
            progress_pct = int(prog.get("percentage", 0) or 0)
            is_completed = progress_pct >= 100
        enrolled_courses.append(
            {
                "id": str(course.id),
                "title": course.title,
                "lifecycleStatus": course.lifecycle_status,
                "accessMode": getattr(course, "access_mode", "targeted") or "targeted",
                "sources": sources,
                "enrolledAt": enr.enrolled_at.isoformat() if enr.enrolled_at else None,
                "progressPercentage": progress_pct,
                "isCompleted": is_completed,
            }
        )

    # 2. Assigned or created courses (primary_lecturer, assistant_lecturer, created_by_user)
    staff_courses = (
        Course.objects.filter(
            Q(primary_lecturer=target_user)
            | Q(assistant_lecturers__user=target_user)
            | Q(created_by_user=target_user)
        )
        .prefetch_related("assistant_lecturers")
        .distinct()
        .order_by("-updated_at", "-id")
    )
    assigned_or_created_courses = []
    for c in staff_courses:
        roles: list[str] = []
        if c.created_by_user_id == target_user.id:
            roles.append("created")
        if c.primary_lecturer_id == target_user.id:
            roles.append("primary_lecturer")
        if any(a.user_id == target_user.id for a in c.assistant_lecturers.all()):
            roles.append("assistant_lecturer")
        assigned_or_created_courses.append(
            {
                "id": str(c.id),
                "title": c.title,
                "courseType": c.course_type,
                "lifecycleStatus": c.lifecycle_status,
                "accessMode": getattr(c, "access_mode", "targeted") or "targeted",
                "roles": roles,
            }
        )

    # 3. Supervised training groups (GroupAssistantAssignment) + cycle supervision count
    assignments = (
        GroupAssistantAssignment.objects.filter(user=target_user)
        .select_related("training_group")
        .order_by("training_group_id", "id")
    )
    supervised_map: dict[int, dict] = {}
    for asgn in assignments:
        grp = asgn.training_group
        if grp.id not in supervised_map:
            cycles = list(grp.renewal_cycles.order_by("cycle_number", "id"))
            supervised_map[grp.id] = {
                "id": str(grp.id),
                "name": grp.name,
                "groupType": grp.group_type,
                "isArchived": grp.is_archived,
                "assignmentRoles": [],
                "supervisionCount": len(cycles) if len(cycles) > 0 else 1,
                "cyclesCount": len(cycles),
                "cycles": [
                    {
                        "cycleCode": cyc.cycle_code,
                        "cycleNumber": cyc.cycle_number,
                        "cycleStatus": cyc.cycle_status,
                        "startDatetime": cyc.start_datetime.isoformat() if cyc.start_datetime else None,
                        "deadlineDatetime": cyc.deadline_datetime.isoformat() if cyc.deadline_datetime else None,
                    }
                    for cyc in cycles
                ],
            }
        if asgn.assignment_role and asgn.assignment_role not in supervised_map[grp.id]["assignmentRoles"]:
            supervised_map[grp.id]["assignmentRoles"].append(asgn.assignment_role)

    # 4. Member training groups (GroupMembership)
    memberships = (
        GroupMembership.objects.filter(user=target_user)
        .select_related("training_group")
        .order_by("-joined_at", "-id")
    )
    member_groups = [
        {
            "id": str(m.training_group.id),
            "name": m.training_group.name,
            "groupType": m.training_group.group_type,
            "isArchived": m.training_group.is_archived,
            "joinedAt": m.joined_at.isoformat() if m.joined_at else None,
        }
        for m in memberships
    ]

    return {
        "enrolledCourses": enrolled_courses,
        "assignedOrCreatedCourses": assigned_or_created_courses,
        "supervisedGroups": list(supervised_map.values()),
        "memberGroups": member_groups,
    }
