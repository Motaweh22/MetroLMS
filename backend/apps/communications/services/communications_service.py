"""Notifications (D-08) and WhatsApp Support Contacts & Visibility (D-09) services."""
from __future__ import annotations

from collections.abc import Iterable
from typing import Any

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


def serialize_notification(n: NotificationItem) -> dict[str, Any]:
    """Serialize a NotificationItem into the frontend NotificationItem DTO."""
    meta = n.metadata_json if isinstance(n.metadata_json, dict) else {}
    eff_type = n.notif_type or "general_alert"
    eff_url = n.target_url
    if eff_type == "general_alert" and "مجموعة" in (n.title or ""):
        eff_type = "forced_enrollment"
        if not eff_url:
            eff_url = "/my-groups"

    return {
        "id": str(n.id),
        "userId": str(n.user_id),
        "type": eff_type,
        "title": n.title,
        "body": n.body,
        "message": n.body,
        "isRead": n.is_read,
        "read": n.is_read,
        "createdAt": n.created_at,
        "targetUrl": eff_url,
        "actionRequired": bool(n.action_required),
        "courseId": meta.get("courseId"),
        "groupId": meta.get("groupId"),
        "requestId": meta.get("requestId"),
        "commentId": meta.get("commentId"),
        "auditLogId": meta.get("auditLogId"),
        "actorId": meta.get("actorId"),
        "actorName": meta.get("actorName"),
        "actorRole": meta.get("actorRole"),
        "metadata": meta or None,
    }


def send_notification(
    *,
    user: User,
    title: str,
    body: str,
    notif_type: str = "general_alert",
    target_url: str | None = None,
    action_required: bool = False,
    metadata: dict[str, Any] | None = None,
) -> NotificationItem:
    """Create a D-08 NotificationItem for a target User."""
    norm_title = normalize_nfc_stripped(title)[:255]
    norm_body = normalize_nfc_stripped(body)
    validate_non_empty_text(norm_title)
    validate_non_empty_text(norm_body)
    return NotificationItem.objects.create(
        user=user,
        title=norm_title,
        body=norm_body,
        notif_type=(notif_type or "general_alert")[:64],
        target_url=target_url[:500] if target_url else None,
        action_required=bool(action_required),
        metadata_json=metadata,
        is_read=False,
        created_at=timezone.now(),
    )


def notify_users(
    *,
    users: Iterable[User],
    title: str,
    body: str,
    notif_type: str = "general_alert",
    target_url: str | None = None,
    action_required: bool = False,
    metadata: dict[str, Any] | None = None,
    exclude_user_id: int | None = None,
) -> int:
    """Bulk-create identical notifications for multiple users, deduplicated by user id."""
    norm_title = normalize_nfc_stripped(title)[:255]
    norm_body = normalize_nfc_stripped(body)
    if not norm_title or not norm_body:
        return 0
    seen_ids: set[int] = set()
    now = timezone.now()
    rows: list[NotificationItem] = []
    for u in users:
        if u is None or not getattr(u, "id", None):
            continue
        if exclude_user_id is not None and u.id == exclude_user_id:
            continue
        if u.id in seen_ids:
            continue
        seen_ids.add(u.id)
        rows.append(
            NotificationItem(
                user=u,
                title=norm_title,
                body=norm_body,
                notif_type=(notif_type or "general_alert")[:64],
                target_url=target_url[:500] if target_url else None,
                action_required=bool(action_required),
                metadata_json=metadata,
                is_read=False,
                created_at=now,
            )
        )
    if rows:
        NotificationItem.objects.bulk_create(rows)
    return len(rows)


def notify_roles(
    *,
    role_ids: Iterable[str],
    title: str,
    body: str,
    notif_type: str = "general_alert",
    target_url: str | None = None,
    action_required: bool = False,
    metadata: dict[str, Any] | None = None,
    exclude_user_id: int | None = None,
) -> int:
    """Send notifications to all active users holding any role in role_ids."""
    recipients = list(User.objects.filter(role_id__in=list(role_ids), status="Active"))
    return notify_users(
        users=recipients,
        title=title,
        body=body,
        notif_type=notif_type,
        target_url=target_url,
        action_required=action_required,
        metadata=metadata,
        exclude_user_id=exclude_user_id,
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


def _resolve_actionable_notifications(
    *,
    notif_type: str,
    matcher,
    outcome_key: str,
    outcome: str,
    resolved_flag_key: str,
    actor: User | None = None,
) -> int:
    """Resolve matching actionable notifications once their underlying workflow is completed."""
    now_iso = timezone.now().isoformat()
    actor_role = getattr(actor, "role_id", None) if actor is not None else None
    actor_name = (
        "النظام"
        if actor_role == "developer"
        else (getattr(actor, "full_name", "") or "") if actor is not None else ""
    )

    candidates = NotificationItem.objects.filter(notif_type=notif_type)
    updated_count = 0
    for item in candidates:
        meta = dict(item.metadata_json) if isinstance(item.metadata_json, dict) else {}
        if not matcher(item, meta):
            continue
        if not item.action_required and not (item.target_url or "").strip() and meta.get(resolved_flag_key) is True:
            continue

        meta["resolved"] = True
        meta[resolved_flag_key] = True
        meta[outcome_key] = outcome
        meta["resolvedAt"] = now_iso
        if actor_name:
            meta["resolvedByName"] = actor_name

        item.action_required = False
        item.target_url = None
        item.is_read = True
        item.metadata_json = meta
        item.save(update_fields=["action_required", "target_url", "is_read", "metadata_json"])
        updated_count += 1

    return updated_count


def resolve_pending_course_review_notifications(
    *,
    course_id: int,
    outcome: str,
    reviewer: User | None = None,
) -> int:
    """Resolve open content_pending_review notifications once a review decision is finalized."""
    course_id_str = str(course_id)
    expected_url = f"/admin/review/{course_id_str}"
    return _resolve_actionable_notifications(
        notif_type="content_pending_review",
        matcher=lambda item, meta: (
            str(meta.get("courseId") or "") == course_id_str
            or (item.target_url or "").strip() == expected_url
        ),
        outcome_key="reviewOutcome",
        outcome=outcome,
        resolved_flag_key="reviewResolved",
        actor=reviewer,
    )


def resolve_comment_report_notifications(
    *,
    outcome: str,
    moderator: User | None = None,
    comment_id: int | None = None,
    course_id: int | None = None,
) -> int:
    """Resolve open comment_reported notifications once dismissed or comment/course is deleted."""
    if comment_id is None and course_id is None:
        return 0
    comment_id_str = str(comment_id) if comment_id is not None else None
    course_id_str = str(course_id) if course_id is not None else None

    def _matches(item: NotificationItem, meta: dict[str, Any]) -> bool:
        if comment_id_str is not None and str(meta.get("commentId") or "") == comment_id_str:
            return True
        if course_id_str is not None and str(meta.get("courseId") or "") == course_id_str:
            return True
        return False

    return _resolve_actionable_notifications(
        notif_type="comment_reported",
        matcher=_matches,
        outcome_key="moderationOutcome",
        outcome=outcome,
        resolved_flag_key="commentReportResolved",
        actor=moderator,
    )

