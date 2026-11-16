"""TrainingGroups, RenewalCycles, QR Join & GroupResources services."""
from __future__ import annotations

from datetime import timedelta
import hashlib
import secrets

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone

from apps.governance.services.governance_service import record_audit_log
from apps.groups.models import (
    GroupAssistantAssignment,
    GroupCourseAssignment,
    GroupJoinRequest,
    GroupMembership,
    GroupQrCode,
    GroupRenewalCycle,
    GroupResource,
    TrainingGroup,
)
from apps.identity.models import User
from shared.permissions import evaluate_permission
from shared.validators import normalize_nfc_stripped, validate_https_url, validate_non_empty_text


class GroupDomainError(Exception):
    """Domain validation, authorization, or concurrency conflict error in apps.groups."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _is_group_assigned(actor: User, group: TrainingGroup) -> bool:
    if actor.role_id in {"developer", "super_admin", "admin"}:
        return True
    return GroupAssistantAssignment.objects.filter(training_group=group, user=actor).exists()


@transaction.atomic
def create_training_group(
    *,
    actor: User,
    name: str,
    group_type: str,
    auto_renewal_enabled: bool = False,
    interval_days: int | None = None,
    deadline_datetime=None,
) -> tuple[TrainingGroup, GroupRenewalCycle]:
    """Create a TrainingGroup and its initial GroupRenewalCycle (`CYC-<id>-01`)."""
    norm_name = normalize_nfc_stripped(name)
    validate_non_empty_text(norm_name)

    if group_type not in {"regular", "reminder"}:
        raise GroupDomainError("INVALID_GROUP_TYPE", "نوع المجموعة يجب أن يكون regular أو reminder.")

    if auto_renewal_enabled:
        if group_type != "reminder":
            raise GroupDomainError("AUTO_RENEWAL_REQUIRES_REMINDER", "التجديد التلقائي متاح للمجموعات التذكيرية فقط.")
        if deadline_datetime is None:
            raise GroupDomainError("DEADLINE_REQUIRED", "يرجى تحديد موعد انتهاء أولًا قبل تفعيل التجديد التلقائي.")
        if interval_days is None or not (1 <= interval_days <= 730):
            raise GroupDomainError("INVALID_INTERVAL_DAYS", "فترة التجديد يجب أن تكون بين 1 و 730 يومًا.")

    now = timezone.now()
    next_renewal = deadline_datetime if (auto_renewal_enabled and deadline_datetime is not None) else None
    group = TrainingGroup.objects.create(
        name=norm_name,
        group_type=group_type,
        is_archived=False,
        auto_renewal_enabled=auto_renewal_enabled,
        interval_days=interval_days,
        deadline_datetime=deadline_datetime,
        next_scheduled_renewal_date=next_renewal,
    )
    cycle = GroupRenewalCycle.objects.create(
        training_group=group,
        cycle_code=f"CYC-{group.id}-01",
        cycle_number=1,
        start_datetime=now,
        deadline_datetime=deadline_datetime,
        cycle_status="Active",
    )
    record_audit_log(
        action="group.created",
        actor=actor,
        target_entity_type="TrainingGroup",
        target_entity_id=str(group.id),
        details_snapshot={"groupType": group_type, "cycleCode": cycle.cycle_code},
    )
    return group, cycle


@transaction.atomic
def remove_group_deadline(*, actor: User, group: TrainingGroup) -> TrainingGroup:
    """INV-DOM10-10 Option A: Remove deadline, disable auto-renewal, keep reminder type, cancel future cycles."""
    locked = TrainingGroup.objects.select_for_update().get(pk=group.pk)
    now = timezone.now()
    locked.deadline_datetime = None
    locked.auto_renewal_enabled = False
    locked.next_scheduled_renewal_date = None
    locked.save(update_fields=["deadline_datetime", "auto_renewal_enabled", "next_scheduled_renewal_date"])

    # Cancel any already-created future scheduled cycles
    GroupRenewalCycle.objects.filter(
        training_group=locked,
        cycle_status="Scheduled",
        start_datetime__gt=now,
    ).update(cycle_status="Cancelled")

    record_audit_log(
        action="group.deadline_removed",
        actor=actor,
        target_entity_type="TrainingGroup",
        target_entity_id=str(locked.id),
    )
    return locked


@transaction.atomic
def renew_training_group(*, actor: User | None, group_id: int, is_automatic: bool = False) -> GroupRenewalCycle:
    """Unified atomic renewal for manual & automatic renewal (INV-DOM10-11, INV-DOM10-12, API-REC-08A/B)."""
    group = TrainingGroup.objects.select_for_update().filter(pk=group_id).first()
    if group is None:
        raise GroupDomainError("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", 404)

    if group.group_type != "reminder":
        raise GroupDomainError("RENEWAL_NOT_ELIGIBLE", "التجديد متاح للمجموعات التذكيرية فقط (API-REC-08B).", 400)

    if group.is_archived:
        raise GroupDomainError("GROUP_ARCHIVED", "لا يمكن تجديد مجموعة مؤرشفة (API-REC-08A).", 409)

    if group.deadline_datetime is None:
        raise GroupDomainError("DEADLINE_REQUIRED", "يرجى تحديد موعد انتهاء أولًا.", 400)

    if is_automatic and not group.auto_renewal_enabled:
        raise GroupDomainError("AUTO_RENEWAL_DISABLED", "التجديد التلقائي معطل لهذه المجموعة.", 409)

    now = timezone.now()
    active_cycle = (
        GroupRenewalCycle.objects.select_for_update()
        .filter(training_group=group, cycle_status="Active")
        .order_by("-cycle_number")
        .first()
    )
    effective_deadline = active_cycle.deadline_datetime if (active_cycle and active_cycle.deadline_datetime) else group.deadline_datetime
    if now < effective_deadline:
        raise GroupDomainError(
            "EARLY_RENEWAL_PROHIBITED",
            "لا يمكن تجديد الدورة قبل انتهاء موعدها الحالي (INV-DOM10-11).",
            409,
        )

    interval = group.interval_days or 30
    if active_cycle is not None:
        active_cycle.cycle_status = "Expired" if now > effective_deadline else "Completed"
        active_cycle.save(update_fields=["cycle_status"])

    max_num = GroupRenewalCycle.objects.filter(training_group=group).aggregate(m=Max("cycle_number"))["m"] or 0
    next_num = max_num + 1
    new_start = now
    new_deadline = new_start + timedelta(days=interval)

    new_cycle = GroupRenewalCycle.objects.create(
        training_group=group,
        cycle_code=f"CYC-{group.id}-{next_num:02d}",
        cycle_number=next_num,
        start_datetime=new_start,
        deadline_datetime=new_deadline,
        cycle_status="Active",
    )
    group.deadline_datetime = new_deadline
    group.next_scheduled_renewal_date = new_deadline if group.auto_renewal_enabled else None
    group.save(update_fields=["deadline_datetime", "next_scheduled_renewal_date"])

    record_audit_log(
        action="group.renewed",
        actor=actor,
        target_entity_type="GroupRenewalCycle",
        target_entity_id=str(new_cycle.id),
        details_snapshot={"groupId": group.id, "cycleCode": new_cycle.cycle_code, "automatic": is_automatic},
    )
    return new_cycle


@transaction.atomic
def regenerate_group_qr(*, actor: User, group: TrainingGroup) -> tuple[GroupQrCode, str]:
    """TR-C3-01 Option B & WP55-PT-04: Single mutable QR record storing SHA-256 hash only."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).digest()
    now = timezone.now()
    qr, _ = GroupQrCode.objects.update_or_create(
        training_group=group,
        defaults={
            "token_hash": token_hash,
            "is_enabled": True,
            "updated_at": now,
        },
    )
    record_audit_log(
        action="group.qr_regenerated",
        actor=actor,
        target_entity_type="GroupQrCode",
        target_entity_id=str(qr.id),
    )
    return qr, raw_token


@transaction.atomic
def submit_qr_join_request(*, trainee: User, raw_token: str) -> GroupJoinRequest:
    """OD-PF-04: Validate SHA-256 token hash, block existing members & duplicate Pending requests."""
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).digest()
    qr = GroupQrCode.objects.select_related("training_group").filter(token_hash=token_hash, is_enabled=True).first()
    if qr is None:
        raise GroupDomainError("INVALID_QR_TOKEN", "رمز الانضمام غير صالح أو معطل.", 404)

    group = qr.training_group
    if GroupMembership.objects.filter(training_group=group, user=trainee).exists():
        raise GroupDomainError("ALREADY_MEMBER", "أنت عضو بالفعل في هذه المجموعة التدريبية.", 409)

    try:
        with transaction.atomic():
            req = GroupJoinRequest.objects.create(
                training_group=group,
                user=trainee,
                request_status="Pending",
                requested_at=timezone.now(),
            )
    except IntegrityError as exc:
        raise GroupDomainError("PENDING_REQUEST_EXISTS", "يوجد طلب انضمام قيد الانتظار بالفعل.", 409) from exc
    return req


@transaction.atomic
def decide_join_request(*, actor: User, join_request: GroupJoinRequest, decision: str) -> GroupJoinRequest:
    """Approve or reject a Pending GroupJoinRequest."""
    locked = GroupJoinRequest.objects.select_for_update().select_related("training_group", "user").get(pk=join_request.pk)
    if locked.request_status != "Pending":
        raise GroupDomainError("ALREADY_DECIDED", "تم البت في طلب الانضمام هذا بالفعل.", 409)

    now = timezone.now()
    locked.decided_at = now
    if decision == "reject":
        locked.request_status = "Rejected"
        locked.save(update_fields=["request_status", "decided_at"])
        return locked
    if decision != "approve":
        raise GroupDomainError("INVALID_DECISION", "يجب أن يكون القرار approve أو reject.")

    locked.request_status = "Approved"
    locked.save(update_fields=["request_status", "decided_at"])
    GroupMembership.objects.get_or_create(
        training_group=locked.training_group,
        user=locked.user,
        defaults={"joined_at": now},
    )
    return locked


def check_group_write_permission(actor: User, group: TrainingGroup, capability: str) -> str:
    """Enforce INV-R7 & INV-R9 for group operations; returns 'direct' or 'requires_approval'."""
    decision = evaluate_permission(actor, capability, is_group_assigned=_is_group_assigned(actor, group))
    if not decision.granted:
        raise GroupDomainError("PERMISSION_DENIED", decision.reason_ar, 403)
    return decision.execution_mode


def add_group_resource(
    *,
    actor: User,
    group: TrainingGroup,
    provider: str,
    title: str,
    meeting_url: str,
) -> GroupResource:
    """INV-DOM16-03: Create an HTTPS meeting link resource for a TrainingGroup."""
    if provider not in {"teams", "zoom", "meet", "other"}:
        raise GroupDomainError("INVALID_PROVIDER", "مزود الاجتماع غير صالح.")
    norm_title = normalize_nfc_stripped(title)
    validate_non_empty_text(norm_title)
    clean_url = meeting_url.strip()
    try:
        validate_https_url(clean_url)
    except Exception as exc:
        raise GroupDomainError("INVALID_HTTPS_URL", "رابط الاجتماع يجب أن يكون بصيغة HTTPS صالحة.") from exc
    return GroupResource.objects.create(
        training_group=group,
        provider=provider,
        title=norm_title,
        meeting_url=clean_url,
    )

