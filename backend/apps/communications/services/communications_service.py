"""Notifications (D-08) and WhatsApp Support Contacts & Visibility (D-09) services."""
from __future__ import annotations

from django.utils import timezone

from apps.communications.models import NotificationItem, UserWhatsAppVisibility, WhatsAppContact
from apps.courses.models import Course
from apps.identity.models import User
from shared.validators import normalize_nfc_stripped, validate_egypt_phone_e164, validate_non_empty_text


class CommunicationsDomainError(Exception):
    """Domain validation or authorization error in apps.communications."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def send_notification(*, user: User, title: str, body: str) -> NotificationItem:
    """Create a D-08 NotificationItem for a target User."""
    norm_title = normalize_nfc_stripped(title)
    norm_body = normalize_nfc_stripped(body)
    validate_non_empty_text(norm_title)
    validate_non_empty_text(norm_body)
    return NotificationItem.objects.create(
        user=user,
        title=norm_title,
        body=norm_body,
        is_read=False,
        created_at=timezone.now(),
    )


def add_course_whatsapp_contact(*, course: Course, phone_e164: str, label: str) -> WhatsAppContact:
    """Create a validated WhatsAppContact for a Course (D-09)."""
    clean_phone = normalize_nfc_stripped(phone_e164)
    norm_label = normalize_nfc_stripped(label)
    try:
        validate_egypt_phone_e164(clean_phone)
        validate_non_empty_text(norm_label)
    except Exception as exc:
        raise CommunicationsDomainError("VALIDATION_ERROR", "بيانات جهة اتصال واتساب غير صالحة.") from exc
    return WhatsAppContact.objects.create(
        course=course,
        phone_e164=clean_phone,
        label=norm_label,
    )


def set_user_whatsapp_visibility(*, user: User, scenario_key: str, is_visible: bool) -> UserWhatsAppVisibility:
    """Set or update UserWhatsAppVisibility for a user & scenario_key (D-09)."""
    clean_key = normalize_nfc_stripped(scenario_key)
    validate_non_empty_text(clean_key)
    obj, _ = UserWhatsAppVisibility.objects.update_or_create(
        user=user,
        scenario_key=clean_key,
        defaults={"is_visible": is_visible},
    )
    return obj

