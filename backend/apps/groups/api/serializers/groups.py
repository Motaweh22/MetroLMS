"""Serializers for apps.groups."""
from __future__ import annotations

from rest_framework import serializers

from apps.groups.models import (
    GroupAssistantAssignment,
    GroupCourseAssignment,
    GroupJoinRequest,
    GroupMembership,
    GroupRenewalCycle,
    GroupResource,
    TrainingGroup,
)


class GroupRenewalCycleSerializer(serializers.ModelSerializer):
    trainingGroupId = serializers.IntegerField(source="training_group_id", read_only=True)
    cycleCode = serializers.CharField(source="cycle_code", read_only=True)
    title = serializers.CharField(source="cycle_code", read_only=True)
    cycleNumber = serializers.IntegerField(source="cycle_number", read_only=True)
    startDateTime = serializers.DateTimeField(source="start_datetime", read_only=True)
    deadlineDateTime = serializers.DateTimeField(source="deadline_datetime", read_only=True)
    cycleStatus = serializers.CharField(source="cycle_status", read_only=True)
    status = serializers.SerializerMethodField()
    courses = serializers.SerializerMethodField()

    class Meta:
        model = GroupRenewalCycle
        fields = [
            "id",
            "trainingGroupId",
            "cycleCode",
            "title",
            "cycleNumber",
            "startDateTime",
            "deadlineDateTime",
            "cycleStatus",
            "status",
            "courses",
        ]

    def get_status(self, obj: GroupRenewalCycle) -> str:
        raw = (obj.cycle_status or "Active").lower()
        return "active" if raw in {"active", "scheduled"} else raw

    def get_courses(self, obj: GroupRenewalCycle) -> list[dict]:
        assignments = obj.course_assignments.select_related("course").order_by("id")
        return [
            {
                "id": str(a.course_id),
                "courseId": str(a.course_id),
                "title": a.course.title,
                "courseType": a.course.course_type,
                "courseRole": "reminder" if a.course.course_type == "reminder" else "core",
                "order": idx + 1,
                "customStartDateTime": None,
                "customDeadlineDateTime": None,
                "customPostDeadlinePolicy": None,
            }
            for idx, a in enumerate(assignments)
        ]


class TrainingGroupSerializer(serializers.ModelSerializer):
    groupType = serializers.CharField(source="group_type", read_only=True)
    isArchived = serializers.BooleanField(source="is_archived", read_only=True)
    autoRenewalEnabled = serializers.BooleanField(source="auto_renewal_enabled", read_only=True)
    intervalDays = serializers.IntegerField(source="interval_days", read_only=True)
    deadlineDateTime = serializers.DateTimeField(source="deadline_datetime", read_only=True)
    nextScheduledRenewalDate = serializers.DateTimeField(source="next_scheduled_renewal_date", read_only=True)
    operationalStatus = serializers.SerializerMethodField()
    adminStatus = serializers.SerializerMethodField()
    enrollmentPolicy = serializers.SerializerMethodField()
    isEnrollmentOpen = serializers.SerializerMethodField()
    maxTrainees = serializers.SerializerMethodField()
    postDeadlinePolicy = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    traineeCount = serializers.SerializerMethodField()
    courseCount = serializers.SerializerMethodField()
    totalTraineesCount = serializers.SerializerMethodField()
    attentionTraineesCount = serializers.SerializerMethodField()
    totalCoursesCount = serializers.SerializerMethodField()
    averageProgressPercent = serializers.SerializerMethodField()
    timeStatus = serializers.SerializerMethodField()
    timeRemainingText = serializers.SerializerMethodField()
    renewalSchedule = serializers.SerializerMethodField()
    primaryInstructorId = serializers.SerializerMethodField()
    assistantLecturerIds = serializers.SerializerMethodField()
    supervisorIds = serializers.SerializerMethodField()
    traineeIds = serializers.SerializerMethodField()
    currentCycle = serializers.SerializerMethodField()
    courses = serializers.SerializerMethodField()
    instructors = serializers.SerializerMethodField()
    resources = serializers.SerializerMethodField()
    metrics = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    class Meta:
        model = TrainingGroup
        fields = [
            "id",
            "name",
            "description",
            "groupType",
            "isArchived",
            "autoRenewalEnabled",
            "intervalDays",
            "deadlineDateTime",
            "nextScheduledRenewalDate",
            "operationalStatus",
            "adminStatus",
            "enrollmentPolicy",
            "isEnrollmentOpen",
            "maxTrainees",
            "postDeadlinePolicy",
            "traineeCount",
            "courseCount",
            "totalTraineesCount",
            "attentionTraineesCount",
            "totalCoursesCount",
            "averageProgressPercent",
            "timeStatus",
            "timeRemainingText",
            "renewalSchedule",
            "primaryInstructorId",
            "assistantLecturerIds",
            "supervisorIds",
            "traineeIds",
            "currentCycle",
            "courses",
            "instructors",
            "resources",
            "metrics",
            "summary",
        ]

    def get_operationalStatus(self, obj: TrainingGroup) -> str:
        return "expired" if obj.is_archived else "active"

    def get_adminStatus(self, obj: TrainingGroup) -> str:
        return "archived" if obj.is_archived else "active"

    def get_enrollmentPolicy(self, obj: TrainingGroup) -> str:
        return "approval_required"

    def get_isEnrollmentOpen(self, obj: TrainingGroup) -> bool:
        qr = getattr(obj, "qr_code", None)
        return bool(qr.is_enabled) if qr is not None else True

    def get_maxTrainees(self, obj: TrainingGroup):
        return None

    def get_postDeadlinePolicy(self, obj: TrainingGroup) -> str:
        return "keep_no_cert"

    def _get_memberships(self, obj: TrainingGroup) -> list:
        if not hasattr(obj, "_ser_memberships"):
            obj._ser_memberships = list(
                GroupMembership.objects.filter(training_group=obj).select_related("user").order_by("id")
            )
        return obj._ser_memberships

    def _get_assistants(self, obj: TrainingGroup) -> list:
        if not hasattr(obj, "_ser_assistants"):
            obj._ser_assistants = list(obj.assistant_assignments.select_related("user").order_by("id"))
        return obj._ser_assistants

    def _get_active_cycle(self, obj: TrainingGroup):
        if not hasattr(obj, "_ser_active_cycle"):
            obj._ser_active_cycle = (
                GroupRenewalCycle.objects.filter(training_group=obj, cycle_status="Active")
                .order_by("-cycle_number")
                .first()
                or GroupRenewalCycle.objects.filter(training_group=obj).order_by("-cycle_number").first()
            )
        return obj._ser_active_cycle

    def get_description(self, obj: TrainingGroup) -> str:
        return obj.description or ""

    def get_traineeCount(self, obj: TrainingGroup) -> int:
        return len(self._get_memberships(obj))

    def get_courseCount(self, obj: TrainingGroup) -> int:
        return len(self.get_courses(obj))

    def get_totalTraineesCount(self, obj: TrainingGroup) -> int:
        return self.get_traineeCount(obj)

    def get_attentionTraineesCount(self, obj: TrainingGroup) -> int:
        return 0

    def get_totalCoursesCount(self, obj: TrainingGroup) -> int:
        return self.get_courseCount(obj)

    def get_averageProgressPercent(self, obj: TrainingGroup) -> int:
        metrics = self.get_metrics(obj)
        return int(metrics.get("cohortSummary", {}).get("averageProgressPercent", 0) or 0)

    def get_timeStatus(self, obj: TrainingGroup) -> str:
        from django.utils import timezone

        now = timezone.now()
        if obj.is_archived or (obj.deadline_datetime and obj.deadline_datetime < now):
            return "expired"
        return "active"

    def get_timeRemainingText(self, obj: TrainingGroup) -> str:
        if obj.is_archived:
            return "مؤرشفة"
        if not obj.deadline_datetime:
            return "مستمرة"
        from django.utils import timezone

        now = timezone.now()
        if obj.deadline_datetime < now:
            return "منتهية الصلاحية"
        days = max(0, (obj.deadline_datetime - now).days)
        return f"متبقي {days} يوم" if days > 0 else "تنتهي اليوم"

    def get_renewalSchedule(self, obj: TrainingGroup) -> dict:
        from datetime import timedelta

        next_renewal = obj.next_scheduled_renewal_date
        if (
            next_renewal is None
            and obj.auto_renewal_enabled
            and obj.deadline_datetime is not None
            and obj.interval_days
        ):
            next_renewal = obj.deadline_datetime + timedelta(days=obj.interval_days)
        return {
            "autoRenewalEnabled": obj.auto_renewal_enabled,
            "intervalDays": obj.interval_days,
            "renewalIntervalDays": obj.interval_days,
            "nextScheduledRenewalDate": next_renewal,
            "recurrenceType": "custom" if obj.auto_renewal_enabled else "none",
        }

    def get_primaryInstructorId(self, obj: TrainingGroup) -> str:
        for row in self._get_assistants(obj):
            if row.assignment_role == "primary":
                return str(row.user_id)
        return ""

    def get_assistantLecturerIds(self, obj: TrainingGroup) -> list[str]:
        return [str(r.user_id) for r in self._get_assistants(obj) if r.assignment_role != "primary"]

    def get_supervisorIds(self, obj: TrainingGroup) -> list[str]:
        return [str(r.user_id) for r in self._get_assistants(obj)]

    def get_traineeIds(self, obj: TrainingGroup) -> list[str]:
        return [str(m.user_id) for m in self._get_memberships(obj)]

    def get_currentCycle(self, obj: TrainingGroup):
        cycle = self._get_active_cycle(obj)
        return GroupRenewalCycleSerializer(cycle).data if cycle is not None else None

    def get_courses(self, obj: TrainingGroup) -> list[dict]:
        if hasattr(obj, "_ser_courses"):
            return obj._ser_courses
        cycle = self._get_active_cycle(obj)
        if cycle is None:
            obj._ser_courses = []
            return []
        assignments = cycle.course_assignments.select_related("course").order_by("id")
        obj._ser_courses = [
            {
                "id": str(a.course_id),
                "courseId": str(a.course_id),
                "title": a.course.title,
                "courseType": a.course.course_type,
                "courseRole": "reminder" if a.course.course_type == "reminder" else "core",
            }
            for a in assignments
        ]
        return obj._ser_courses

    def get_instructors(self, obj: TrainingGroup) -> list[dict]:
        rows = self._get_assistants(obj)
        return [
            {
                "userId": str(r.user_id),
                "name": r.user.full_name,
                "instructorRole": "primary" if r.assignment_role == "primary" else "assistant",
            }
            for r in rows
        ]

    def get_resources(self, obj: TrainingGroup) -> list[dict]:
        return GroupResourceSerializer(obj.resources.all().order_by("id"), many=True).data

    def get_metrics(self, obj: TrainingGroup) -> dict:
        if hasattr(obj, "_ser_metrics"):
            return obj._ser_metrics

        courses = self.get_courses(obj)
        memberships = self._get_memberships(obj)
        course_ids = [int(c["courseId"]) for c in courses if str(c["courseId"]).isdigit()]
        member_ids = [m.user_id for m in memberships]

        # Bulk-fetch attempts, published lesson counts, and completed lessons (zero N+1)
        attempt_by_user_course: dict[tuple[int, int], tuple[int, int]] = {}
        lesson_count_by_pub: dict[int, int] = {}
        completed_by_attempt: dict[int, int] = {}

        if member_ids and course_ids:
            from django.db.models import Count
            from apps.courses.models import LessonItem
            from apps.learning.models import CourseAttempt, LessonProgress

            attempts = (
                CourseAttempt.objects.filter(
                    enrollment__user_id__in=member_ids,
                    enrollment__course_id__in=course_ids,
                )
                .values("id", "enrollment__user_id", "enrollment__course_id", "published_version_id")
                .order_by("id")
            )
            pub_ids: set[int] = set()
            att_ids: list[int] = []
            for a in attempts:
                key = (a["enrollment__user_id"], a["enrollment__course_id"])
                attempt_by_user_course[key] = (a["id"], a["published_version_id"])
                pub_ids.add(a["published_version_id"])
            att_ids = [v[0] for v in attempt_by_user_course.values()]

            if pub_ids:
                for row in (
                    LessonItem.objects.filter(module__published_version_id__in=pub_ids)
                    .values("module__published_version_id")
                    .annotate(cnt=Count("id"))
                ):
                    lesson_count_by_pub[row["module__published_version_id"]] = row["cnt"]
            if att_ids:
                for row in (
                    LessonProgress.objects.filter(course_attempt_id__in=att_ids, is_completed=True)
                    .values("course_attempt_id")
                    .annotate(cnt=Count("id"))
                ):
                    completed_by_attempt[row["course_attempt_id"]] = row["cnt"]

        trainee_metrics = []
        trainees_started = 0
        trainees_completed_all_core = 0
        total_completed_attempts = 0
        program_percent_sum = 0

        course_stats: dict[int, dict[str, int]] = {
            cid: {"started": 0, "completed": 0, "pct_sum": 0, "total_lessons": 0}
            for cid in course_ids
        }
        core_course_ids = [int(c["courseId"]) for c in courses if c.get("courseRole") != "reminder" and str(c["courseId"]).isdigit()]

        for m in memberships:
            started_c = 0
            completed_c = 0
            completed_core_c = 0
            completed_lessons_total = 0
            required_lessons_total = 0
            pct_sum_user = 0
            progress_map: dict[str, dict] = {}

            for c in courses:
                cid = int(c["courseId"])
                att_info = attempt_by_user_course.get((m.user_id, cid))
                if att_info is not None:
                    att_id, pub_id = att_info
                    tot_l = lesson_count_by_pub.get(pub_id, 0)
                    done_l = min(tot_l, completed_by_attempt.get(att_id, 0)) if tot_l > 0 else 0
                    if tot_l == 0:
                        pct = 0
                    elif done_l >= tot_l:
                        pct = 100
                    else:
                        pct = min(99, (done_l * 100 + tot_l // 2) // tot_l)
                else:
                    tot_l = 0
                    done_l = 0
                    pct = 0

                if tot_l > course_stats[cid]["total_lessons"]:
                    course_stats[cid]["total_lessons"] = tot_l
                course_stats[cid]["pct_sum"] += pct

                if pct > 0:
                    started_c += 1
                    course_stats[cid]["started"] += 1
                if pct >= 100:
                    completed_c += 1
                    total_completed_attempts += 1
                    course_stats[cid]["completed"] += 1
                    if cid in core_course_ids:
                        completed_core_c += 1

                completed_lessons_total += done_l
                required_lessons_total += tot_l
                pct_sum_user += pct
                progress_map[str(cid)] = {
                    "progressPercent": pct,
                    "completedLessons": done_l,
                    "totalLessons": tot_l,
                    "isCompleted": pct >= 100,
                }

            prog_pct = round(pct_sum_user / len(courses)) if courses else 0
            program_percent_sum += prog_pct
            if started_c > 0:
                trainees_started += 1
            is_all_core_done = bool(core_course_ids) and completed_core_c >= len(core_course_ids)
            if is_all_core_done:
                trainees_completed_all_core += 1

            trainee_metrics.append(
                {
                    "userId": str(m.user_id),
                    "userName": m.user.full_name,
                    "email": m.user.email or m.user.phone_e164,
                    "phone": m.user.phone_e164 or "",
                    "department": "",
                    "jobTitle": "متدرب",
                    "enrolledAt": m.joined_at.isoformat() if m.joined_at else "",
                    "startedCoursesCount": started_c,
                    "completedCoursesCount": completed_c,
                    "totalRequiredCourses": len(courses),
                    "isAllCoreCompleted": is_all_core_done,
                    "programPercent": prog_pct,
                    "completedLessonsTotal": completed_lessons_total,
                    "totalRequiredLessons": required_lessons_total,
                    "courseProgressMap": progress_map,
                    "worstAttention": {"needsAttention": False, "level": "none", "reasonAr": ""},
                }
            )

        avg_group_pct = round(program_percent_sum / len(memberships)) if memberships else 0
        completion_rate = (
            round((trainees_completed_all_core * 100) / len(memberships))
            if memberships and core_course_ids
            else avg_group_pct
        )
        core_count = len(core_course_ids)
        rem_count = len(courses) - core_count
        obj._ser_metrics = {
            "status": "expired" if obj.is_archived else "active",
            "statusLabelAr": "منتهية الصلاحية" if obj.is_archived else "نشطة — قيد التدريب",
            "timeRemainingText": self.get_timeRemainingText(obj),
            "totalTrainees": len(memberships),
            "activeCourses": len(courses),
            "completionRate": completion_rate,
            "cohortSummary": {
                "totalMembers": len(memberships),
                "totalCourses": len(courses),
                "coreCoursesCount": core_count,
                "reminderCoursesCount": rem_count,
                "traineesStarted": trainees_started,
                "traineesCompletedAllCore": trainees_completed_all_core,
                "completedAttempts": total_completed_attempts,
                "averageProgressPercent": avg_group_pct,
                "warningAlertsCount": 0,
                "dangerAlertsCount": 0,
                "totalAttentionCount": 0,
            },
            "traineeMetricsList": trainee_metrics,
            "assignedCoursesMetrics": [
                {
                    "courseId": c["courseId"],
                    "courseTitle": c["title"],
                    "courseRole": c.get("courseRole", "core"),
                    "order": idx + 1,
                    "totalRequiredLessons": course_stats.get(int(c["courseId"]), {}).get("total_lessons", 0),
                    "traineesStartedCount": course_stats.get(int(c["courseId"]), {}).get("started", 0),
                    "traineesCompletedCount": course_stats.get(int(c["courseId"]), {}).get("completed", 0),
                    "averageProgressPercent": (
                        round(course_stats.get(int(c["courseId"]), {}).get("pct_sum", 0) / len(memberships))
                        if memberships
                        else 0
                    ),
                    "completedCount": course_stats.get(int(c["courseId"]), {}).get("completed", 0),
                    "timeRemainingText": "منتهية الصلاحية" if obj.is_archived else "متاحة",
                    "effective": {
                        "hasDeadlineOverride": False,
                        "isExpired": bool(obj.is_archived),
                        "effectivePostDeadlinePolicy": "keep_no_cert",
                        "postDeadlinePolicy": "keep_no_cert",
                        "deadlineDateTime": obj.deadline_datetime.isoformat() if obj.deadline_datetime else None,
                    },
                }
                for idx, c in enumerate(courses)
            ],
        }
        return obj._ser_metrics

    def get_summary(self, obj: TrainingGroup) -> dict:
        return {
            "totalTrainees": self.get_traineeCount(obj),
            "activeCourses": self.get_courseCount(obj),
        }


class GroupAssistantSerializer(serializers.ModelSerializer):
    trainingGroupId = serializers.IntegerField(source="training_group_id", read_only=True)
    userId = serializers.IntegerField(source="user_id", read_only=True)
    assignmentRole = serializers.CharField(source="assignment_role", read_only=True)

    class Meta:
        model = GroupAssistantAssignment
        fields = ["id", "trainingGroupId", "userId", "assignmentRole"]


class GroupJoinRequestSerializer(serializers.ModelSerializer):
    trainingGroupId = serializers.IntegerField(source="training_group_id", read_only=True)
    userId = serializers.IntegerField(source="user_id", read_only=True)
    requestStatus = serializers.CharField(source="request_status", read_only=True)
    requestedAt = serializers.DateTimeField(source="requested_at", read_only=True)
    decidedAt = serializers.DateTimeField(source="decided_at", read_only=True)

    class Meta:
        model = GroupJoinRequest
        fields = ["id", "trainingGroupId", "userId", "requestStatus", "requestedAt", "decidedAt"]


class GroupResourceSerializer(serializers.ModelSerializer):
    trainingGroupId = serializers.IntegerField(source="training_group_id", read_only=True)
    meetingUrl = serializers.CharField(source="meeting_url", read_only=True)

    class Meta:
        model = GroupResource
        fields = ["id", "trainingGroupId", "provider", "title", "meetingUrl"]

