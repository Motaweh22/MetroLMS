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

    def get_description(self, obj: TrainingGroup) -> str:
        return obj.description or ""

    def get_traineeCount(self, obj: TrainingGroup) -> int:
        return GroupMembership.objects.filter(training_group=obj).count()

    def get_courseCount(self, obj: TrainingGroup) -> int:
        return GroupCourseAssignment.objects.filter(group_renewal_cycle__training_group=obj).count()

    def get_totalTraineesCount(self, obj: TrainingGroup) -> int:
        return self.get_traineeCount(obj)

    def get_attentionTraineesCount(self, obj: TrainingGroup) -> int:
        return 0

    def get_totalCoursesCount(self, obj: TrainingGroup) -> int:
        return self.get_courseCount(obj)

    def get_averageProgressPercent(self, obj: TrainingGroup) -> int:
        return 0

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
        row = GroupAssistantAssignment.objects.filter(training_group=obj, assignment_role="primary").first()
        return str(row.user_id) if row is not None else ""

    def get_assistantLecturerIds(self, obj: TrainingGroup) -> list[str]:
        rows = GroupAssistantAssignment.objects.filter(training_group=obj).exclude(assignment_role="primary")
        return [str(r.user_id) for r in rows]

    def get_supervisorIds(self, obj: TrainingGroup) -> list[str]:
        rows = GroupAssistantAssignment.objects.filter(training_group=obj).order_by("id")
        return [str(r.user_id) for r in rows]

    def get_traineeIds(self, obj: TrainingGroup) -> list[str]:
        return [str(m.user_id) for m in GroupMembership.objects.filter(training_group=obj).order_by("id")]

    def get_currentCycle(self, obj: TrainingGroup):
        cycle = (
            GroupRenewalCycle.objects.filter(training_group=obj, cycle_status="Active")
            .order_by("-cycle_number")
            .first()
            or GroupRenewalCycle.objects.filter(training_group=obj).order_by("-cycle_number").first()
        )
        return GroupRenewalCycleSerializer(cycle).data if cycle is not None else None

    def get_courses(self, obj: TrainingGroup) -> list[dict]:
        cycle = (
            GroupRenewalCycle.objects.filter(training_group=obj, cycle_status="Active")
            .order_by("-cycle_number")
            .first()
            or GroupRenewalCycle.objects.filter(training_group=obj).order_by("-cycle_number").first()
        )
        if cycle is None:
            return []
        assignments = cycle.course_assignments.select_related("course").order_by("id")
        return [
            {
                "id": str(a.course_id),
                "courseId": str(a.course_id),
                "title": a.course.title,
                "courseType": a.course.course_type,
                "courseRole": "reminder" if a.course.course_type == "reminder" else "core",
            }
            for a in assignments
        ]

    def get_instructors(self, obj: TrainingGroup) -> list[dict]:
        rows = obj.assistant_assignments.select_related("user").order_by("id")
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
        courses = self.get_courses(obj)
        memberships = list(GroupMembership.objects.filter(training_group=obj).select_related("user").order_by("id"))
        trainee_metrics = [
            {
                "userId": str(m.user_id),
                "userName": m.user.full_name,
                "email": m.user.email or m.user.phone_e164,
                "phone": m.user.phone_e164 or "",
                "department": "",
                "jobTitle": "متدرب",
                "enrolledAt": m.joined_at.isoformat() if m.joined_at else "",
                "startedCoursesCount": 0,
                "completedCoursesCount": 0,
                "totalRequiredCourses": len(courses),
                "isAllCoreCompleted": False,
                "programPercent": 0,
                "completedLessonsTotal": 0,
                "totalRequiredLessons": 0,
                "courseProgressMap": {},
                "worstAttention": {"needsAttention": False, "level": "none", "reasonAr": ""},
            }
            for m in memberships
        ]
        core_count = sum(1 for c in courses if c.get("courseRole") != "reminder")
        rem_count = sum(1 for c in courses if c.get("courseRole") == "reminder")
        return {
            "status": "expired" if obj.is_archived else "active",
            "statusLabelAr": "منتهية الصلاحية" if obj.is_archived else "نشطة — قيد التدريب",
            "timeRemainingText": "منتهية الصلاحية" if obj.is_archived else "نشطة",
            "totalTrainees": len(memberships),
            "activeCourses": len(courses),
            "completionRate": 0,
            "cohortSummary": {
                "totalMembers": len(memberships),
                "totalCourses": len(courses),
                "coreCoursesCount": core_count,
                "reminderCoursesCount": rem_count,
                "traineesStarted": 0,
                "traineesCompletedAllCore": 0,
                "completedAttempts": 0,
                "averageProgressPercent": 0,
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
                    "totalRequiredLessons": 0,
                    "traineesStartedCount": 0,
                    "traineesCompletedCount": 0,
                    "averageProgressPercent": 0,
                    "completedCount": 0,
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

