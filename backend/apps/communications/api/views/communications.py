"""Views for BP-11: Notifications (D-08), Course WhatsApp Contacts & Visibility (D-09)."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.communications.models import NotificationItem, UserWhatsAppVisibility, WhatsAppContact
from apps.communications.services.communications_service import (
    CommunicationsDomainError,
    add_course_whatsapp_contact,
    set_user_whatsapp_visibility,
)
from apps.courses.models import Course
from shared.api import error_response, success_response
from shared.permissions import get_visible_user_or_none


class NotificationsListView(APIView):
    """GET /api/notifications."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        from django.utils import timezone
        from apps.groups.models import GroupMembership

        for m in GroupMembership.objects.filter(user=request.user).select_related("training_group"):
            expected_body = f"تمت إضافتك إلى المجموعة التدريبية: {m.training_group.name}"
            if not NotificationItem.objects.filter(user=request.user, body=expected_body).exists():
                NotificationItem.objects.create(
                    user=request.user,
                    title="تمت إضافتك إلى مجموعة تدريبية",
                    body=expected_body,
                    is_read=False,
                    created_at=m.joined_at or timezone.now(),
                )

        qs = NotificationItem.objects.filter(user=request.user).order_by("-created_at", "-id")
        unread_count = qs.filter(is_read=False).count()
        if request.query_params.get("unreadOnly") == "true":
            qs = qs.filter(is_read=False)
        items = [
            {
                "id": str(n.id),
                "userId": str(n.user_id),
                "type": "forced_enrollment" if "مجموعة" in (n.title or "") else "general_alert",
                "title": n.title,
                "body": n.body,
                "message": n.body,
                "isRead": n.is_read,
                "read": n.is_read,
                "createdAt": n.created_at,
                "targetUrl": "/my-groups" if "مجموعة" in (n.title or "") else None,
            }
            for n in qs
        ]
        return success_response(
            {
                "unreadCount": unread_count,
                "totalCount": len(items),
                "notifications": items,
            }
        )


class NotificationMarkReadView(APIView):
    """POST / PATCH /api/notifications/<notification_id>/read."""

    permission_classes = [IsAuthenticated]

    def _mark(self, request: Request, notification_id: int):
        item = NotificationItem.objects.filter(pk=notification_id, user=request.user).first()
        if item is None:
            return error_response("RESOURCE_NOT_FOUND", "الإشعار المطلوب غير موجود.", status.HTTP_404_NOT_FOUND)
        if not item.is_read:
            item.is_read = True
            item.save(update_fields=["is_read"])
        unread = NotificationItem.objects.filter(user=request.user, is_read=False).count()
        return success_response(
            {
                "id": item.id,
                "isRead": item.is_read,
                "unreadCount": unread,
                "notification": {
                    "id": str(item.id),
                    "userId": str(item.user_id),
                    "type": "general_alert",
                    "title": item.title,
                    "body": item.body,
                    "message": item.body,
                    "isRead": item.is_read,
                    "read": item.is_read,
                    "createdAt": item.created_at,
                },
            }
        )

    def post(self, request: Request, notification_id: int):
        return self._mark(request, notification_id)

    def patch(self, request: Request, notification_id: int):
        return self._mark(request, notification_id)


class NotificationsReadAllView(APIView):
    """POST /api/notifications/read-all & /api/notifications/mark-all-read."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        updated = NotificationItem.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return success_response({"success": True, "markedRead": updated, "unreadCount": 0})


class CourseWhatsAppContactsView(APIView):
    """GET / POST /api/courses/<course_id>/whatsapp-contacts (D-09)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id == "trainee":
            from apps.courses.services.course_service import is_course_visible_to_trainee

            if not is_course_visible_to_trainee(request.user, course):
                return error_response("PERMISSION_DENIED", "ليس لديك صلاحية استعراض جهات دعم هذه الدورة.", status.HTTP_403_FORBIDDEN)
        vis = UserWhatsAppVisibility.objects.filter(user=request.user, scenario_key="course_support").first()
        if vis is not None and not vis.is_visible:
            return success_response({"visible": False, "contacts": []})

        contacts = [
            {"id": c.id, "phoneE164": c.phone_e164, "label": c.label}
            for c in WhatsAppContact.objects.filter(course=course).order_by("id")
        ]
        return success_response({"visible": True, "contacts": contacts})

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إضافة جهات دعم لهذه الدورة.", status.HTTP_403_FORBIDDEN)
        try:
            contact = add_course_whatsapp_contact(
                course=course,
                phone_e164=str(request.data.get("phoneE164", "")),
                label=str(request.data.get("label", "")),
            )
        except CommunicationsDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {"contact": {"id": contact.id, "phoneE164": contact.phone_e164, "label": contact.label}},
            status_code=status.HTTP_201_CREATED,
        )

    def put(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل جهات دعم هذه الدورة.", status.HTTP_403_FORBIDDEN)
        raw_contacts = request.data.get("contacts")
        if raw_contacts is not None and not isinstance(raw_contacts, list):
            return error_response("VALIDATION_ERROR", "قائمة جهات الاتصال غير صالحة.", status.HTTP_400_BAD_REQUEST)
        from django.db import transaction

        with transaction.atomic():
            WhatsAppContact.objects.filter(course=course).delete()
            saved = []
            for entry in raw_contacts or []:
                if not isinstance(entry, dict):
                    continue
                raw_phone = str(entry.get("phoneE164") or entry.get("number") or "").strip()
                if raw_phone.startswith("01") and len(raw_phone) == 11 and raw_phone.isdigit():
                    raw_phone = f"+2{raw_phone}"
                elif raw_phone.startswith("201") and len(raw_phone) == 12 and raw_phone.isdigit():
                    raw_phone = f"+{raw_phone}"
                label = str(entry.get("label") or entry.get("name") or "دعم المقرر").strip()
                if not raw_phone:
                    continue
                try:
                    c = add_course_whatsapp_contact(course=course, phone_e164=raw_phone, label=label)
                    saved.append({"id": c.id, "phoneE164": c.phone_e164, "label": c.label})
                except CommunicationsDomainError as exc:
                    return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"courseId": str(course.id), "contacts": saved})


class CourseWhatsAppContactDeleteView(APIView):
    """DELETE /api/courses/<course_id>/whatsapp-contacts/<contact_id>."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, course_id: int, contact_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية حذف جهة الدعم.", status.HTTP_403_FORBIDDEN)
        deleted, _ = WhatsAppContact.objects.filter(pk=contact_id, course=course).delete()
        if not deleted:
            return error_response("RESOURCE_NOT_FOUND", "جهة الدعم غير موجودة.", status.HTTP_404_NOT_FOUND)
        return success_response({"removed": True, "contactId": contact_id})


class AdminUserWhatsAppVisibilityView(APIView):
    """GET / PUT /api/admin/users/<user_id>/whatsapp-visibility (D-09)."""

    permission_classes = [IsAuthenticated]

    def _require_admin_and_visible_user(self, request: Request, user_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return None, error_response("PERMISSION_DENIED", "ليس لديك صلاحية إدارة إعدادات الظهور.", status.HTTP_403_FORBIDDEN)
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return None, error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)
        return target, None

    def _serialize_visibility(self, target) -> dict:
        rows = list(UserWhatsAppVisibility.objects.filter(user=target).order_by("scenario_key"))
        clean_phone = target.phone_e164.lstrip("+") if target.phone_e164 else None
        return {
            "userId": str(target.id),
            "userName": target.full_name,
            "userPhone": target.phone_e164,
            "cleanPhone": clean_phone,
            "displayPhone": target.phone_e164,
            "isPhoneValid": bool(clean_phone),
            "isAccountActive": target.status == "Active",
            "settings": [{"scenarioKey": r.scenario_key, "isVisible": r.is_visible} for r in rows],
            "assignments": [{"scenario": r.scenario_key, "isActive": r.is_visible} for r in rows],
        }

    def get(self, request: Request, user_id: int):
        target, err = self._require_admin_and_visible_user(request, user_id)
        if err is not None:
            return err
        return success_response(self._serialize_visibility(target))

    def put(self, request: Request, user_id: int):
        target, err = self._require_admin_and_visible_user(request, user_id)
        if err is not None:
            return err
        assignments = request.data.get("assignments")
        if isinstance(assignments, list):
            for item in assignments:
                if isinstance(item, dict) and str(item.get("scenario") or "").strip():
                    set_user_whatsapp_visibility(
                        user=target,
                        scenario_key=str(item["scenario"]).strip(),
                        is_visible=bool(item.get("isActive", True)),
                    )
            return success_response(self._serialize_visibility(target))
        scenario_key = str(request.data.get("scenarioKey", "")).strip()
        if not scenario_key:
            return error_response("VALIDATION_ERROR", "مفتاح السيناريو مطلوب.", status.HTTP_400_BAD_REQUEST)
        is_visible = bool(request.data.get("isVisible", True))
        obj = set_user_whatsapp_visibility(user=target, scenario_key=scenario_key, is_visible=is_visible)
        return success_response(
            {
                **self._serialize_visibility(target),
                "scenarioKey": obj.scenario_key,
                "isVisible": obj.is_visible,
            }
        )


class PublicSupportContactsView(APIView):
    """GET /api/public/support-contacts?scenario=... — Resolves Admin-assigned active support contacts."""

    permission_classes = [AllowAny]

    def get(self, request: Request):
        scenario = str(request.query_params.get("scenario", "technical_support")).strip() or "technical_support"
        rows = (
            UserWhatsAppVisibility.objects.select_related("user")
            .filter(scenario_key=scenario, is_visible=True, user__status="Active")
            .exclude(user__role_id="developer")
            .order_by("id")
        )
        contacts = []
        for row in rows:
            u = row.user
            digits = u.phone_e164.lstrip("+")
            contacts.append(
                {
                    "id": str(row.id),
                    "userId": str(u.id),
                    "name": u.full_name,
                    "number": digits,
                    "displayNumber": u.phone_e164,
                    "avatarInitial": u.full_name[:1] if u.full_name else "د",
                    "scenario": scenario,
                }
            )
        return success_response(
            {
                "scenario": scenario,
                "count": len(contacts),
                "visible": True,
                "contacts": contacts,
            }
        )

