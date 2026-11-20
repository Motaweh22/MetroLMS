"""Training groups, assistants (API-REC-02a..c), renewals, QR join & resources views."""
from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.models import Course
from apps.groups.api.serializers.groups import (
    GroupAssistantSerializer,
    GroupJoinRequestSerializer,
    GroupRenewalCycleSerializer,
    GroupResourceSerializer,
    TrainingGroupSerializer,
)
from apps.groups.models import (
    GroupAssistantAssignment,
    GroupCourseAssignment,
    GroupJoinRequest,
    GroupMembership,
    GroupQrCode,
    GroupRenewalCycle,
    TrainingGroup,
)
from apps.groups.services.group_service import (
    GroupDomainError,
    add_group_resource,
    check_group_write_permission,
    create_training_group,
    decide_join_request,
    regenerate_group_qr,
    remove_group_deadline,
    renew_training_group,
    submit_qr_join_request,
)
from apps.identity.models import User
from shared.api import error_response, success_response
from shared.permissions import get_visible_user_or_none, has_capability


def _normalize_group_type(raw_type: str | None) -> str:
    val = str(raw_type or "regular").strip().lower()
    if val in {"reminder", "reminder_program"}:
        return "reminder"
    return "regular"


def _extract_renewal_fields(data: dict) -> tuple[bool, int | None]:
    schedule = data.get("renewalSchedule") if isinstance(data.get("renewalSchedule"), dict) else {}
    raw_auto = data.get("autoRenewalEnabled")
    if raw_auto is None:
        raw_auto = schedule.get("autoRenewalEnabled", False)
    auto_renewal = bool(raw_auto)

    raw_interval = data.get("intervalDays")
    if raw_interval is None:
        raw_interval = schedule.get("intervalDays") or schedule.get("renewalIntervalDays")
    interval = int(raw_interval) if raw_interval not in (None, "") else None
    return auto_renewal, interval


def _sync_group_instructors(group: TrainingGroup, primary_id, assistant_ids) -> None:
    if primary_id is not None:
        GroupAssistantAssignment.objects.filter(training_group=group, assignment_role="primary").delete()
        if str(primary_id).strip():
            user = User.objects.filter(pk=int(primary_id)).first()
            if user is not None:
                GroupAssistantAssignment.objects.get_or_create(
                    training_group=group,
                    user=user,
                    assignment_role="primary",
                )
    if isinstance(assistant_ids, list):
        GroupAssistantAssignment.objects.filter(training_group=group).exclude(assignment_role="primary").delete()
        for raw_uid in assistant_ids:
            if str(raw_uid).strip():
                user = User.objects.filter(pk=int(raw_uid)).first()
                if user is not None:
                    GroupAssistantAssignment.objects.get_or_create(
                        training_group=group,
                        user=user,
                        assignment_role="assistant_lecturer",
                    )


class AdminGroupListView(APIView):
    """GET / POST /api/admin/groups."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), has_capability("groups.create")()]

    def get(self, request: Request):
        groups = TrainingGroup.objects.all().order_by("id")
        return success_response({"groups": TrainingGroupSerializer(groups, many=True).data})

    def post(self, request: Request):
        raw_deadline = request.data.get("deadlineDateTime")
        deadline = parse_datetime(raw_deadline) if isinstance(raw_deadline, str) and raw_deadline else None
        auto_renewal, interval = _extract_renewal_fields(request.data)
        try:
            group, cycle = create_training_group(
                actor=request.user,
                name=str(request.data.get("name", "")),
                description=str(request.data.get("description") or ""),
                group_type=_normalize_group_type(request.data.get("groupType")),
                auto_renewal_enabled=auto_renewal,
                interval_days=interval,
                deadline_datetime=deadline,
            )
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        _sync_group_instructors(
            group,
            request.data.get("primaryInstructorId"),
            request.data.get("assistantLecturerIds"),
        )
        return success_response(
            {
                "group": TrainingGroupSerializer(group).data,
                "initialCycle": GroupRenewalCycleSerializer(cycle).data,
            },
            status_code=status.HTTP_201_CREATED,
        )


class AdminGroupDetailView(APIView):
    """GET / PUT / DELETE /api/admin/groups/<group_id>."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response(TrainingGroupSerializer(group).data)

    def put(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        name = str(request.data.get("name", group.name)).strip()
        if not name:
            return error_response("VALIDATION_ERROR", "اسم المجموعة مطلوب.", status.HTTP_400_BAD_REQUEST)
        group.name = name
        if "description" in request.data:
            group.description = str(request.data.get("description") or "").strip()
        if "groupType" in request.data:
            group.group_type = _normalize_group_type(request.data.get("groupType"))
        if "adminStatus" in request.data:
            group.is_archived = str(request.data.get("adminStatus")) == "archived"
        if "deadlineDateTime" in request.data:
            raw_dl = request.data.get("deadlineDateTime")
            group.deadline_datetime = parse_datetime(raw_dl) if isinstance(raw_dl, str) and raw_dl else None
        if "autoRenewalEnabled" in request.data or "renewalSchedule" in request.data or "intervalDays" in request.data:
            auto_renewal, interval = _extract_renewal_fields(request.data)
            group.auto_renewal_enabled = auto_renewal
            group.interval_days = interval
        group.save()
        _sync_group_instructors(
            group,
            request.data.get("primaryInstructorId") if "primaryInstructorId" in request.data else None,
            request.data.get("assistantLecturerIds") if "assistantLecturerIds" in request.data else None,
        )
        return success_response(TrainingGroupSerializer(group).data)

    def delete(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        force_delete = str(request.query_params.get("force", "")).lower() in {"1", "true", "yes"}
        if force_delete:
            if request.user.role_id not in {"developer", "super_admin", "admin"}:
                return error_response(
                    "PERMISSION_DENIED",
                    "الحذف النهائي للمجموعات متاح لمدير النظام فقط.",
                    status.HTTP_403_FORBIDDEN,
                )
            from django.db import transaction
            from apps.groups.models import GroupQrCode
            from apps.learning.models import CourseAttempt, EnrollmentSourceGrant

            with transaction.atomic():
                CourseAttempt.objects.filter(group_renewal_cycle__training_group=group).update(
                    group_renewal_cycle=None
                )
                EnrollmentSourceGrant.objects.filter(training_group=group).delete()
                GroupCourseAssignment.objects.filter(group_renewal_cycle__training_group=group).delete()
                GroupRenewalCycle.objects.filter(training_group=group).delete()
                GroupMembership.objects.filter(training_group=group).delete()
                GroupJoinRequest.objects.filter(training_group=group).delete()
                GroupAssistantAssignment.objects.filter(training_group=group).delete()
                GroupQrCode.objects.filter(training_group=group).delete()
                TrainingGroup.objects.filter(pk=group.pk).delete()
            return success_response(
                {"success": True, "message": "تم حذف المجموعة التدريبية نهائياً.", "archivedInstead": False}
            )

        has_refs = (
            GroupMembership.objects.filter(training_group=group).exists()
            or GroupRenewalCycle.objects.filter(training_group=group).exists()
        )
        if has_refs:
            group.is_archived = True
            group.save(update_fields=["is_archived"])
            return success_response({"success": True, "message": "تمت أرشفة المجموعة لوجود بيانات مرتبطة بها.", "archivedInstead": True})
        group.delete()
        return success_response({"success": True, "message": "تم حذف المجموعة بنجاح.", "archivedInstead": False})


class AdminGroupDeadlineRemoveView(APIView):
    """DELETE /api/admin/groups/<group_id>/deadline — INV-DOM10-10 Option A."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
            updated = remove_group_deadline(actor=request.user, group=group)
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"group": TrainingGroupSerializer(updated).data})


class AdminGroupRenewView(APIView):
    """POST /api/admin/groups/<group_id>/renew — Manual renewal (API-REC-08A/B, INV-DOM10-11/12)."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
            new_cycle = renew_training_group(actor=request.user, group_id=group.id, is_automatic=False)
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"cycle": GroupRenewalCycleSerializer(new_cycle).data})


class GroupAssistantListCreateView(APIView):
    """GET / POST /api/groups/<group_id>/assistants (API-REC-02a, API-REC-02b)."""

    def get_permissions(self):
        return [IsAuthenticated()]

    def get(self, request: Request, group_id: int):
        rows = GroupAssistantAssignment.objects.filter(training_group_id=group_id).order_by("id")
        return success_response({"assistants": GroupAssistantSerializer(rows, many=True).data})

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعيين مساعدي المجموعات.", status.HTTP_403_FORBIDDEN)

        user_id = request.data.get("userId")
        role_name = str(request.data.get("assignmentRole", "assistant_admin"))
        target_user = get_visible_user_or_none(request.user, int(user_id)) if user_id is not None else None
        if target_user is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            with transaction.atomic():
                row = GroupAssistantAssignment.objects.create(
                    training_group=group,
                    user=target_user,
                    assignment_role=role_name,
                )
        except IntegrityError:
            return error_response("CONFLICT", "المساعد معين بالفعل في هذه المجموعة.", status.HTTP_409_CONFLICT)
        return success_response({"assistant": GroupAssistantSerializer(row).data}, status_code=status.HTTP_201_CREATED)


class GroupAssistantDeleteView(APIView):
    """DELETE /api/groups/<group_id>/assistants/<lecturer_id> (API-REC-02c)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, group_id: int, lecturer_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إزالة مساعدي المجموعات.", status.HTTP_403_FORBIDDEN)
        deleted, _ = GroupAssistantAssignment.objects.filter(
            training_group_id=group_id, user_id=lecturer_id
        ).delete()
        if not deleted:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response({"removed": True, "userId": lecturer_id})


class GroupQrRegenerateView(APIView):
    """POST /api/admin/groups/<group_id>/qr/regenerate (TR-C3-01 Option B)."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.generate_qr")
            qr, raw_token = regenerate_group_qr(actor=request.user, group=group)
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"qrId": qr.id, "token": raw_token, "isEnabled": qr.is_enabled})


class GroupQrJoinView(APIView):
    """POST /api/groups/join-by-qr — Trainee submits QR join request."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        raw_token = str(request.data.get("token", "")).strip()
        if not raw_token:
            return error_response("VALIDATION_ERROR", "رمز الانضمام مطلوب.", status.HTTP_400_BAD_REQUEST)
        try:
            req = submit_qr_join_request(trainee=request.user, raw_token=raw_token)
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"joinRequest": GroupJoinRequestSerializer(req).data}, status_code=status.HTTP_201_CREATED)


class GroupJoinRequestDecideView(APIView):
    """POST /api/admin/groups/<group_id>/join-requests/<req_id>/decide."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int, req_id: int):
        join_req = GroupJoinRequest.objects.select_related("training_group").filter(
            pk=req_id, training_group_id=group_id
        ).first()
        if join_req is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, join_req.training_group, "groups.review_join_requests")
            raw_decision = str(request.data.get("decision", "")).strip().lower()
            normalized_decision = {"approved": "Approved", "rejected": "Rejected"}.get(raw_decision, str(request.data.get("decision", "")))
            decided = decide_join_request(
                actor=request.user,
                join_request=join_req,
                decision=normalized_decision,
            )
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"joinRequest": GroupJoinRequestSerializer(decided).data})


class GroupResourceCreateView(APIView):
    """POST /api/admin/groups/<group_id>/resources (INV-DOM16-03)."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "materials.manage_meetings")
            res = add_group_resource(
                actor=request.user,
                group=group,
                provider=str(request.data.get("provider", "")),
                title=str(request.data.get("title", "")),
                meeting_url=str(request.data.get("meetingUrl", "")),
            )
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"resource": GroupResourceSerializer(res).data}, status_code=status.HTTP_201_CREATED)


class MyGroupsView(APIView):
    """GET /api/groups/my — Groups assigned to the authenticated user."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        memberships = (
            GroupMembership.objects.filter(user=request.user)
            .select_related("training_group")
            .order_by("training_group_id")
        )
        now = timezone.now()
        from apps.communications.models import NotificationItem

        items = []
        for m in memberships:
            g = m.training_group
            expected_body = f"تمت إضافتك إلى المجموعة التدريبية: {g.name}"
            if not NotificationItem.objects.filter(user=request.user, body=expected_body).exists():
                NotificationItem.objects.create(
                    user=request.user,
                    title="تمت إضافتك إلى مجموعة تدريبية",
                    body=expected_body,
                    is_read=False,
                    created_at=m.joined_at or now,
                )
            active_cycle = (
                GroupRenewalCycle.objects.filter(training_group=g, cycle_status="Active")
                .order_by("-cycle_number")
                .first()
                or GroupRenewalCycle.objects.filter(training_group=g).order_by("-cycle_number").first()
            )
            courses_list = []
            if active_cycle is not None:
                for idx, a in enumerate(
                    active_cycle.course_assignments.select_related("course").order_by("id")
                ):
                    courses_list.append(
                        {
                            "courseId": str(a.course_id),
                            "courseTitle": a.course.title,
                            "courseRole": "reminder" if a.course.course_type == "reminder" else "core",
                            "order": idx,
                        }
                    )

            deadline = active_cycle.deadline_datetime if active_cycle and active_cycle.deadline_datetime else g.deadline_datetime
            is_overdue = bool(g.is_archived or (deadline and deadline < now))
            days_remaining = None
            hours_remaining = None
            days_passed = None
            if deadline:
                delta_sec = int((deadline - now).total_seconds())
                if delta_sec >= 0:
                    days_remaining = delta_sec // 86400
                    hours_remaining = (delta_sec % 86400) // 3600
                else:
                    days_passed = abs(delta_sec) // 86400

            if is_overdue:
                situation = (
                    "expired_reminder_with_next"
                    if g.group_type == "reminder" and g.next_scheduled_renewal_date
                    else ("expired_reminder_without_next" if g.group_type == "reminder" else "expired_regular")
                )
                op_status = "expired"
            else:
                situation = "active_reminder" if g.group_type == "reminder" else "active_regular"
                op_status = "active"

            items.append(
                {
                    "id": str(g.id),
                    "name": g.name,
                    "description": g.description or "",
                    "groupType": g.group_type,
                    "operationalStatus": op_status,
                    "traineeCount": GroupMembership.objects.filter(training_group=g).count(),
                    "startDateTime": active_cycle.start_datetime if active_cycle else None,
                    "deadlineDateTime": deadline,
                    "postDeadlinePolicy": "keep_no_cert",
                    "renewalSchedule": {
                        "autoRenewalEnabled": g.auto_renewal_enabled,
                        "intervalDays": g.interval_days,
                        "nextScheduledRenewalDate": g.next_scheduled_renewal_date,
                    },
                    "currentCycle": (
                        {
                            "id": str(active_cycle.id),
                            "cycleNumber": active_cycle.cycle_number,
                            "title": active_cycle.cycle_code,
                            "status": "archived" if g.is_archived else "active",
                            "startDateTime": active_cycle.start_datetime,
                            "deadlineDateTime": active_cycle.deadline_datetime,
                            "postDeadlinePolicy": "keep_no_cert",
                        }
                        if active_cycle is not None
                        else None
                    ),
                    "courses": courses_list,
                    "timeInfo": {
                        "situation": situation,
                        "primaryTargetDate": deadline,
                        "secondaryDate": g.next_scheduled_renewal_date,
                        "daysRemaining": days_remaining,
                        "hoursRemaining": hours_remaining,
                        "daysPassed": days_passed,
                        "isOverdue": is_overdue,
                    },
                    "navigationUrl": f"/my-groups/{g.id}",
                    "isArchived": g.is_archived,
                    "joinedAt": m.joined_at,
                }
            )
        return success_response(items)


class AdminGroupsCheckDueRenewalsView(APIView):
    """POST /api/admin/groups/check-all-due-renewals — Run due reminder group renewals."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية فحص تجديد المجموعات.", status.HTTP_403_FORBIDDEN)
        from infrastructure.scheduling.job_runner import process_due_group_renewals_task

        result = process_due_group_renewals_task()
        return success_response(result)


class AdminCandidateLecturersView(APIView):
    """GET /api/admin/lecturers — Eligible staff only (admin, super_admin, assistant_admin, lecturer; never trainee)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض قائمة المحاضرين.", status.HTTP_403_FORBIDDEN)
        allowed_roles = ["super_admin", "admin", "assistant_admin", "lecturer"]
        if request.user.role_id == "developer":
            allowed_roles.append("developer")
        users = User.objects.filter(status="Active", role_id__in=allowed_roles).order_by("id")
        items = [
            {
                "id": str(u.id),
                "name": u.full_name,
                "role": u.role_id,
                "phone": u.phone_e164,
                "department": "",
                "jobTitle": u.role_id,
            }
            for u in users
        ]
        return success_response(items)


class AdminCandidateTraineesView(APIView):
    """GET /api/admin/trainees — Active trainees list for group enrollment."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض قائمة المتدربين.", status.HTTP_403_FORBIDDEN)
        users = User.objects.filter(status="Active", role_id="trainee").order_by("id")
        items = [
            {
                "id": str(u.id),
                "name": u.full_name,
                "role": "user",
                "phone": u.phone_e164,
                "department": "",
            }
            for u in users
        ]
        return success_response(items)


class GroupDetailView(APIView):
    """GET /api/groups/<group_id> — Trainee/authorized group detail."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response(TrainingGroupSerializer(group).data)


class AdminGroupCyclesView(APIView):
    """GET /api/admin/groups/<group_id>/cycles — List renewal cycles for a group."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        cycles = GroupRenewalCycle.objects.filter(training_group=group).order_by("-cycle_number")
        return success_response(GroupRenewalCycleSerializer(cycles, many=True).data)


class AdminGroupCoursesView(APIView):
    """POST /api/admin/groups/<group_id>/courses — Assign courses to active/target cycle."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        cycle_id = request.data.get("cycleId")
        if cycle_id:
            cycle = GroupRenewalCycle.objects.filter(pk=int(cycle_id), training_group=group).first()
        else:
            cycle = (
                GroupRenewalCycle.objects.filter(training_group=group, cycle_status="Active").order_by("-cycle_number").first()
                or GroupRenewalCycle.objects.filter(training_group=group).order_by("-cycle_number").first()
            )
        if cycle is None:
            return error_response("RESOURCE_NOT_FOUND", "لا توجد دورة تجديد نشطة لهذه المجموعة.", status.HTTP_404_NOT_FOUND)

        raw_ids: list[int] = []
        for key in ("coreCourseIds", "reminderCourseIds", "courseIds"):
            vals = request.data.get(key)
            if isinstance(vals, list):
                for v in vals:
                    if str(v).strip().isdigit():
                        raw_ids.append(int(v))
        if isinstance(request.data.get("courses"), list):
            for item in request.data["courses"]:
                cid = item.get("courseId") if isinstance(item, dict) else item
                if str(cid).strip().isdigit():
                    raw_ids.append(int(cid))

        unique_ids = list(dict.fromkeys(raw_ids))
        from apps.learning.services.learning_service import LearningDomainError, enroll_user_in_course

        members = list(GroupMembership.objects.filter(training_group=group).select_related("user"))
        with transaction.atomic():
            GroupCourseAssignment.objects.filter(group_renewal_cycle=cycle).delete()
            for cid in unique_ids:
                course = Course.objects.filter(pk=cid).first()
                if course is not None:
                    GroupCourseAssignment.objects.get_or_create(group_renewal_cycle=cycle, course=course)
                    for m in members:
                        try:
                            enroll_user_in_course(
                                actor=request.user,
                                user=m.user,
                                course=course,
                                source_type="group",
                                training_group=group,
                                group_renewal_cycle=cycle,
                            )
                        except LearningDomainError:
                            pass

        return success_response(GroupRenewalCycleSerializer(cycle).data)


class AdminGroupMembersView(APIView):
    """GET / POST /api/admin/groups/<group_id>/members."""

    permission_classes = [IsAuthenticated]

    def _serialize_members(self, group: TrainingGroup) -> list[dict]:
        rows = GroupMembership.objects.filter(training_group=group).select_related("user").order_by("id")
        return [
            {
                "id": str(r.id),
                "userId": str(r.user_id),
                "name": r.user.full_name,
                "phone": r.user.phone_e164,
                "role": "user",
                "joinedAt": r.joined_at,
                "enrollmentSource": "direct",
            }
            for r in rows
        ]

    def get(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response(self._serialize_members(group))

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.manage_members")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        trainee_ids = request.data.get("traineeIds")
        if not isinstance(trainee_ids, list):
            return error_response("VALIDATION_ERROR", "قائمة المتدربين مطلوبة.", status.HTTP_400_BAD_REQUEST)

        added = 0
        already = 0
        now = timezone.now()
        with transaction.atomic():
            for raw_uid in trainee_ids:
                if not str(raw_uid).strip().isdigit():
                    continue
                target = get_visible_user_or_none(request.user, int(raw_uid))
                if target is None:
                    continue
                _, created = GroupMembership.objects.get_or_create(
                    training_group=group,
                    user=target,
                    defaults={"joined_at": now},
                )
                if created:
                    added += 1
                else:
                    already += 1
                from apps.communications.models import NotificationItem
                from apps.learning.services.learning_service import LearningDomainError, enroll_user_in_course

                expected_body = f"تمت إضافتك إلى المجموعة التدريبية: {group.name}"
                if created or not NotificationItem.objects.filter(user=target, body=expected_body).exists():
                    NotificationItem.objects.create(
                        user=target,
                        title="تمت إضافتك إلى مجموعة تدريبية",
                        body=expected_body,
                        is_read=False,
                        created_at=now,
                    )
                active_cycle = (
                    GroupRenewalCycle.objects.filter(training_group=group, cycle_status="Active")
                    .order_by("-cycle_number")
                    .first()
                    or GroupRenewalCycle.objects.filter(training_group=group).order_by("-cycle_number").first()
                )
                if active_cycle is not None:
                    for ca in active_cycle.course_assignments.select_related("course"):
                        try:
                            enroll_user_in_course(
                                actor=request.user,
                                user=target,
                                course=ca.course,
                                source_type="group",
                                training_group=group,
                                group_renewal_cycle=active_cycle,
                            )
                        except LearningDomainError:
                            pass

        return success_response(
            {
                "addedCount": added,
                "alreadyMemberCount": already,
                "members": self._serialize_members(group),
            },
            status_code=status.HTTP_201_CREATED,
        )


class AdminGroupMemberDeleteView(APIView):
    """DELETE /api/admin/groups/<group_id>/members/<user_id>."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, group_id: int, user_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.manage_members")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        deleted, _ = GroupMembership.objects.filter(training_group=group, user_id=user_id).delete()
        if not deleted:
            return error_response("RESOURCE_NOT_FOUND", "العضو غير موجود في هذه المجموعة.", status.HTTP_404_NOT_FOUND)
        return success_response({"success": True, "message": "تمت إزالة العضو من المجموعة."})


class AdminGroupJoinRequestsView(APIView):
    """GET /api/admin/groups/<group_id>/join-requests."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        qs = GroupJoinRequest.objects.filter(training_group=group).select_related("user").order_by("-id")
        raw_status = request.query_params.get("status")
        if raw_status:
            mapped = {"pending": "Pending", "approved": "Approved", "rejected": "Rejected"}.get(raw_status.lower())
            if mapped:
                qs = qs.filter(request_status=mapped)
        items = [
            {
                **GroupJoinRequestSerializer(r).data,
                "userName": r.user.full_name,
                "userPhone": r.user.phone_e164,
                "status": r.request_status.lower(),
            }
            for r in qs
        ]
        return success_response(items)


def _materials_manifest_path(group_id: int):
    import os
    from django.conf import settings

    base = os.path.join(str(settings.MEDIA_ROOT), "group_materials")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, f"group_{group_id}.json")


def _resolve_material_file_type(mime_type: str, file_name: str) -> str:
    m = (mime_type or "").lower()
    fn = (file_name or "").lower()
    if "pdf" in m or fn.endswith(".pdf"):
        return "pdf"
    if m.startswith("image/") or fn.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")):
        return "image"
    if m.startswith("video/") or fn.endswith((".mp4", ".webm", ".mov", ".avi")):
        return "video"
    if m.startswith("audio/") or fn.endswith((".mp3", ".wav", ".ogg", ".m4a")):
        return "audio"
    if "word" in m or fn.endswith((".doc", ".docx")):
        return "word"
    if "excel" in m or "spreadsheet" in m or fn.endswith((".xls", ".xlsx", ".csv")):
        return "excel"
    if "powerpoint" in m or "presentation" in m or fn.endswith((".ppt", ".pptx")):
        return "powerpoint"
    if "zip" in m or "rar" in m or "compressed" in m or fn.endswith((".zip", ".rar", ".7z")):
        return "archive"
    return "other"


def _repair_material_file_record(f: dict) -> bool:
    from apps.media.models import MediaAsset

    changed = False
    orig_name = str(f.get("originalFileName") or f.get("fileName") or f.get("title") or "file")
    mime = str(f.get("mimeType") or "application/octet-stream")
    if not f.get("fileType"):
        f["fileType"] = _resolve_material_file_type(mime, orig_name)
        changed = True
    media_id = f.get("mediaId") or f.get("mediaAssetId")
    size_val = int(f.get("fileSizeBytes") or f.get("sizeBytes") or 0)
    if (size_val <= 0 or not f.get("url")) and media_id and str(media_id).isdigit():
        asset = MediaAsset.objects.filter(pk=int(media_id)).first()
        if asset is not None:
            size_val = asset.size_bytes
            f["fileSizeBytes"] = size_val
            f["sizeBytes"] = size_val
            f["url"] = f"/api/media/assets/{asset.id}/stream"
            changed = True
    elif size_val <= 0 and not media_id:
        asset = MediaAsset.objects.filter(mime_type=mime).order_by("-id").first()
        if asset is not None:
            f["mediaId"] = str(asset.id)
            f["mediaAssetId"] = str(asset.id)
            f["fileSizeBytes"] = asset.size_bytes
            f["sizeBytes"] = asset.size_bytes
            f["url"] = f"/api/media/assets/{asset.id}/stream"
            changed = True
    return changed


def _load_materials_manifest(group_id: int) -> dict:
    import json
    import os

    path = _materials_manifest_path(group_id)
    if not os.path.exists(path):
        return {"folders": [], "rootFiles": []}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            data.setdefault("folders", [])
            data.setdefault("rootFiles", [])
            dirty = False
            for f in data["rootFiles"]:
                if isinstance(f, dict) and _repair_material_file_record(f):
                    dirty = True
            for fld in data["folders"]:
                for f in fld.get("files", []):
                    if isinstance(f, dict) and _repair_material_file_record(f):
                        dirty = True
            if dirty:
                _save_materials_manifest(group_id, data)
            return data
    except Exception:
        pass
    return {"folders": [], "rootFiles": []}


def _save_materials_manifest(group_id: int, data: dict) -> None:
    import json

    path = _materials_manifest_path(group_id)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)


class AdminGroupMaterialsView(APIView):
    """GET /api/admin/groups/<group_id>/materials."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response(_load_materials_manifest(group_id))


class AdminGroupMaterialFoldersView(APIView):
    """POST /api/admin/groups/<group_id>/materials/folders."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        import uuid

        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        name = str(request.data.get("name", "")).strip()
        if not name:
            return error_response("VALIDATION_ERROR", "اسم المجلد مطلوب.", status.HTTP_400_BAD_REQUEST)

        manifest = _load_materials_manifest(group_id)
        folder = {
            "id": f"FLD-{uuid.uuid4().hex[:8]}",
            "groupId": str(group_id),
            "name": name,
            "order": int(request.data.get("order", len(manifest["folders"]) + 1)),
            "isVisible": bool(request.data.get("isVisible", True)),
            "createdAt": timezone.now().isoformat(),
            "files": [],
        }
        manifest["folders"].append(folder)
        _save_materials_manifest(group_id, manifest)
        return success_response(folder, status_code=status.HTTP_201_CREATED)


class AdminGroupMaterialFolderDetailView(APIView):
    """PUT / DELETE /api/admin/groups/<group_id>/materials/folders/<folder_id>."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, group_id: int, folder_id: str):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        manifest = _load_materials_manifest(group_id)
        for fld in manifest["folders"]:
            if fld["id"] == folder_id:
                if "name" in request.data and str(request.data["name"]).strip():
                    fld["name"] = str(request.data["name"]).strip()
                if "isVisible" in request.data:
                    fld["isVisible"] = bool(request.data["isVisible"])
                if "order" in request.data:
                    fld["order"] = int(request.data["order"])
                _save_materials_manifest(group_id, manifest)
                return success_response(fld)
        return error_response("RESOURCE_NOT_FOUND", "المجلد غير موجود.", status.HTTP_404_NOT_FOUND)

    def delete(self, request: Request, group_id: int, folder_id: str):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        manifest = _load_materials_manifest(group_id)
        deleted_files = 0
        kept = []
        found = False
        for fld in manifest["folders"]:
            if fld["id"] == folder_id:
                found = True
                deleted_files = len(fld.get("files", []))
            else:
                kept.append(fld)
        if not found:
            return error_response("RESOURCE_NOT_FOUND", "المجلد غير موجود.", status.HTTP_404_NOT_FOUND)
        manifest["folders"] = kept
        _save_materials_manifest(group_id, manifest)
        return success_response({"success": True, "deletedFilesCount": deleted_files})


class AdminGroupMaterialFilesView(APIView):
    """POST /api/admin/groups/<group_id>/materials/files."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        import uuid

        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        folder_id = request.data.get("folderId")
        media_id = request.data.get("mediaAssetId") or request.data.get("mediaId")
        url = request.data.get("url")
        raw_size = (
            request.data.get("fileSizeBytes")
            if request.data.get("fileSizeBytes") is not None
            else request.data.get("sizeBytes")
        )
        size_bytes = int(raw_size or 0)
        orig_name = str(
            request.data.get("originalFileName")
            or request.data.get("fileName")
            or request.data.get("title")
            or "file"
        )
        mime_type = str(request.data.get("mimeType") or "application/octet-stream")

        if media_id and str(media_id).isdigit():
            if not url or str(url).startswith("blob:"):
                url = f"/api/media/assets/{media_id}/stream"
            if size_bytes <= 0:
                from apps.media.models import MediaAsset

                asset = MediaAsset.objects.filter(pk=int(media_id)).first()
                if asset is not None:
                    size_bytes = asset.size_bytes
                    if not mime_type or mime_type == "application/octet-stream":
                        mime_type = asset.mime_type

        file_rec = {
            "id": f"MAT-{uuid.uuid4().hex[:8]}",
            "groupId": str(group_id),
            "folderId": folder_id,
            "title": str(request.data.get("title") or orig_name or "ملف"),
            "originalFileName": orig_name,
            "fileName": orig_name,
            "mimeType": mime_type,
            "fileType": _resolve_material_file_type(mime_type, orig_name),
            "fileSizeBytes": size_bytes,
            "sizeBytes": size_bytes,
            "url": url or "",
            "mediaId": str(media_id) if media_id else None,
            "mediaAssetId": str(media_id) if media_id else None,
            "uploadedBy": str(request.user.id),
            "uploadedByName": request.user.full_name,
            "downloadCount": 0,
            "order": 1,
            "isVisible": bool(request.data.get("isVisible", True)),
            "uploadedAt": timezone.now().isoformat(),
        }

        manifest = _load_materials_manifest(group_id)
        if folder_id:
            placed = False
            for fld in manifest["folders"]:
                if fld["id"] == folder_id:
                    fld.setdefault("files", []).append(file_rec)
                    placed = True
                    break
            if not placed:
                return error_response("RESOURCE_NOT_FOUND", "المجلد المستهدف غير موجود.", status.HTTP_404_NOT_FOUND)
        else:
            manifest["rootFiles"].append(file_rec)

        _save_materials_manifest(group_id, manifest)
        return success_response(file_rec, status_code=status.HTTP_201_CREATED)


class AdminGroupMaterialFileDetailView(APIView):
    """PUT / DELETE /api/admin/groups/<group_id>/materials/files/<file_id>."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, group_id: int, file_id: str):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        manifest = _load_materials_manifest(group_id)
        collections = [manifest["rootFiles"]] + [fld.setdefault("files", []) for fld in manifest["folders"]]
        for col in collections:
            for f in col:
                if f["id"] == file_id:
                    for k in ("title", "isVisible", "originalFileName", "mimeType", "fileSizeBytes", "url", "mediaId"):
                        if k in request.data:
                            f[k] = request.data[k]
                    _save_materials_manifest(group_id, manifest)
                    return success_response(f)
        return error_response("RESOURCE_NOT_FOUND", "الملف غير موجود.", status.HTTP_404_NOT_FOUND)

    def delete(self, request: Request, group_id: int, file_id: str):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        manifest = _load_materials_manifest(group_id)
        before = len(manifest["rootFiles"])
        manifest["rootFiles"] = [f for f in manifest["rootFiles"] if f["id"] != file_id]
        removed = len(manifest["rootFiles"]) < before
        for fld in manifest["folders"]:
            files = fld.get("files", [])
            new_files = [f for f in files if f["id"] != file_id]
            if len(new_files) < len(files):
                removed = True
            fld["files"] = new_files
        if not removed:
            return error_response("RESOURCE_NOT_FOUND", "الملف غير موجود.", status.HTTP_404_NOT_FOUND)
        _save_materials_manifest(group_id, manifest)
        return success_response({"success": True, "message": "تم حذف الملف بنجاح."})


class AdminGroupMaterialFileMoveView(APIView):
    """PUT /api/admin/groups/<group_id>/materials/files/<file_id>/move."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, group_id: int, file_id: str):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        target_folder_id = request.data.get("targetFolderId")
        manifest = _load_materials_manifest(group_id)
        found_file = None
        manifest["rootFiles"] = [f for f in manifest["rootFiles"] if not (f["id"] == file_id and (found_file := f))]
        if found_file is None:
            for fld in manifest["folders"]:
                new_files = []
                for f in fld.get("files", []):
                    if f["id"] == file_id:
                        found_file = f
                    else:
                        new_files.append(f)
                fld["files"] = new_files
        if found_file is None:
            return error_response("RESOURCE_NOT_FOUND", "الملف غير موجود.", status.HTTP_404_NOT_FOUND)

        found_file["folderId"] = target_folder_id
        if target_folder_id:
            for fld in manifest["folders"]:
                if fld["id"] == target_folder_id:
                    fld.setdefault("files", []).append(found_file)
                    break
        else:
            manifest["rootFiles"].append(found_file)
        _save_materials_manifest(group_id, manifest)
        return success_response(found_file)


class AdminGroupMonitoringView(APIView):
    """GET /api/admin/groups/<group_id>/monitoring."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        group_data = TrainingGroupSerializer(group).data
        metrics_data = group_data.get("metrics", {})
        cycles_qs = GroupRenewalCycle.objects.filter(training_group=group).order_by("-cycle_number")
        return success_response(
            {
                **metrics_data,
                "group": group_data,
                "selectedCycle": group_data.get("currentCycle"),
                "cycles": GroupRenewalCycleSerializer(cycles_qs, many=True).data,
                "metrics": metrics_data,
            }
        )


class AdminGroupAssistantsPutView(APIView):
    """GET / PUT / POST /api/admin/groups/<group_id>/assistants."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int):
        rows = GroupAssistantAssignment.objects.filter(training_group_id=group_id).order_by("id")
        return success_response({"assistants": GroupAssistantSerializer(rows, many=True).data})

    def put(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.edit_config")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        assistant_ids = request.data.get("assistantLecturerIds")
        if isinstance(assistant_ids, list):
            _sync_group_instructors(group, None, assistant_ids)
        return success_response(TrainingGroupSerializer(group).data)


class AdminGroupCycleDetailView(APIView):
    """GET /api/admin/groups/<group_id>/cycles/<cycle_id>."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, group_id: int, cycle_id: int):
        cycle = GroupRenewalCycle.objects.filter(pk=cycle_id, training_group_id=group_id).first()
        if cycle is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response(GroupRenewalCycleSerializer(cycle).data)


class AdminGroupCheckAutoRenewalView(APIView):
    """POST /api/admin/groups/<group_id>/check-auto-renewal."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response({"renewed": False, "group": TrainingGroupSerializer(group).data})


class GroupJoinInfoView(APIView):
    """GET /api/groups/join/<code>/info."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, code: str):
        import hashlib

        token_hash = hashlib.sha256(code.encode("utf-8")).digest()
        qr = GroupQrCode.objects.select_related("training_group").filter(token_hash=token_hash).first()
        if qr is None:
            return error_response("RESOURCE_NOT_FOUND", "رمز الانضمام غير صالح أو منتهي.", status.HTTP_404_NOT_FOUND)
        g = qr.training_group
        return success_response(
            {
                "id": str(g.id),
                "name": g.name,
                "groupType": g.group_type,
                "isEnrollmentOpen": qr.is_enabled,
            }
        )


class GroupQrToggleView(APIView):
    """POST /api/admin/groups/<group_id>/qr-code/toggle."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, group_id: int):
        group = TrainingGroup.objects.filter(pk=group_id).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            check_group_write_permission(request.user, group, "groups.generate_qr")
        except GroupDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        is_open = bool(request.data.get("isOpen", True))
        qr = GroupQrCode.objects.filter(training_group=group).first()
        if qr is not None:
            qr.is_enabled = is_open
            qr.updated_at = timezone.now()
            qr.save(update_fields=["is_enabled", "updated_at"])
        return success_response({"success": True, "isEnrollmentOpen": is_open})

