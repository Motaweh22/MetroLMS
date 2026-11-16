"""Governance, PendingApprovalRequest & AuditLogEntry domain services (INV-R8, INV-R9, INV-R10, D-14)."""
from __future__ import annotations

from typing import Any, Callable
import uuid

from django.db import transaction
from django.utils import timezone

from apps.governance.models import AuditLogEntry, PendingApprovalRequest
from apps.identity.models import User
from shared.validators import normalize_nfc_preserve_whitespace


class ApprovalAlreadyDecidedError(Exception):
    """Raised with HTTP 409 ALREADY_DECIDED when a request is no longer Pending."""


class ApprovalNotFoundError(Exception):
    """Raised with HTTP 404 when PendingApprovalRequest does not exist."""


def record_audit_log(
    *,
    action: str,
    actor: User | None = None,
    actor_role_snapshot: str = "system",
    target_entity_type: str | None = None,
    target_entity_id: str | None = None,
    details_snapshot: dict[str, Any] | None = None,
    reason: str | None = None,
) -> AuditLogEntry:
    """Append an immutable AuditLogEntry (never exposes raw secrets/tokens)."""
    is_dev = bool(actor is not None and actor.role_id == "developer")
    norm_reason = normalize_nfc_preserve_whitespace(reason) if reason is not None else None
    return AuditLogEntry.objects.create(
        actor_user_id=str(actor.id) if actor is not None else None,
        actor_role_snapshot=actor.role_id if actor is not None else actor_role_snapshot,
        is_developer_masked=is_dev,
        action=action,
        target_entity_type=target_entity_type,
        target_entity_id=str(target_entity_id) if target_entity_id is not None else None,
        details_snapshot_json=details_snapshot,
        reason=norm_reason,
        created_at=timezone.now(),
    )


@transaction.atomic
def create_pending_approval(
    *,
    requester: User,
    action_type: str,
    target_entity_type: str,
    target_entity_id: str,
    payload_snapshot: dict[str, Any],
    reason: str | None = None,
) -> PendingApprovalRequest:
    """Create a deferred PendingApprovalRequest (INV-R9 / 202 Accepted)."""
    norm_reason = normalize_nfc_preserve_whitespace(reason) if reason is not None else None
    req = PendingApprovalRequest.objects.create(
        action_type=action_type,
        execution_status="Pending",
        requested_by_id=str(requester.id),
        target_entity_type=target_entity_type,
        target_entity_id=str(target_entity_id),
        payload_snapshot_json=payload_snapshot,
        reason=norm_reason,
        created_at=timezone.now(),
    )
    record_audit_log(
        action="approval.requested",
        actor=requester,
        target_entity_type="PendingApprovalRequest",
        target_entity_id=str(req.id),
        details_snapshot={"actionType": action_type, "targetEntityType": target_entity_type},
        reason=norm_reason,
    )
    return req


@transaction.atomic
def decide_pending_approval(
    *,
    request_id: uuid.UUID,
    reviewer: User,
    decision: str,
    reason: str | None = None,
    executor_fn: Callable[[PendingApprovalRequest], bool] | None = None,
) -> PendingApprovalRequest:
    """Decide and optionally execute a PendingApprovalRequest atomically (INV-R10)."""
    approval = PendingApprovalRequest.objects.select_for_update().filter(pk=request_id).first()
    if approval is None:
        raise ApprovalNotFoundError("طلب الموافقة المطلوب غير موجود.")

    if approval.execution_status != "Pending":
        raise ApprovalAlreadyDecidedError("تم البت في طلب الموافقة هذا بالفعل.")

    now = timezone.now()
    norm_reason = normalize_nfc_preserve_whitespace(reason) if reason is not None else None
    approval.reviewed_by_id = str(reviewer.id)
    approval.decided_at = now
    if norm_reason is not None:
        approval.reason = norm_reason

    if decision == "reject":
        approval.execution_status = "Rejected"
        approval.save(update_fields=["execution_status", "reviewed_by_id", "decided_at", "reason"])
        record_audit_log(
            action="approval.rejected",
            actor=reviewer,
            target_entity_type="PendingApprovalRequest",
            target_entity_id=str(approval.id),
            reason=norm_reason,
        )
        return approval

    # Approve & re-validate at execution time (INV-R10)
    approval.executed_by_id = str(reviewer.id)
    approval.executed_at = now
    if executor_fn is not None:
        try:
            ok = executor_fn(approval)
        except Exception:
            ok = False
        approval.execution_status = "Executed" if ok else "ExecutionFailed"
    else:
        approval.execution_status = "Executed"

    approval.save(
        update_fields=[
            "execution_status",
            "reviewed_by_id",
            "executed_by_id",
            "decided_at",
            "executed_at",
            "reason",
        ]
    )
    record_audit_log(
        action=f"approval.{approval.execution_status.lower()}",
        actor=reviewer,
        target_entity_type="PendingApprovalRequest",
        target_entity_id=str(approval.id),
        reason=norm_reason,
    )
    return approval

