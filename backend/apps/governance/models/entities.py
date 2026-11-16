"""Governance, approval workflow & immutable audit log models (2 active entities)."""
from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q

EXECUTION_STATUS_CHOICES = [
    ("Pending", "Pending"),
    ("Approved", "Approved"),
    ("Executed", "Executed"),
    ("ExecutionFailed", "ExecutionFailed"),
    ("Rejected", "Rejected"),
    ("Cancelled", "Cancelled"),
]


class PendingApprovalRequest(models.Model):
    """Deferred mutation approval request (INV-R9 / INV-R10) with UUID PK."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action_type = models.CharField(max_length=64)
    execution_status = models.CharField(max_length=32, choices=EXECUTION_STATUS_CHOICES)
    requested_by_id = models.CharField(max_length=64)
    reviewed_by_id = models.CharField(max_length=64, null=True, blank=True)
    executed_by_id = models.CharField(max_length=64, null=True, blank=True)
    target_entity_type = models.CharField(max_length=64)
    target_entity_id = models.CharField(max_length=64)
    payload_snapshot_json = models.JSONField()
    reason = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField()
    decided_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "governance_pendingapprovalrequest"
        indexes = [
            models.Index(fields=["target_entity_type", "target_entity_id"], name="ix_pending_target"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(
                    execution_status__in=[
                        "Pending",
                        "Approved",
                        "Executed",
                        "ExecutionFailed",
                        "Rejected",
                        "Cancelled",
                    ]
                ),
                name="ck_pending_exec_status_valid",
            ),
        ]


class AuditLogEntry(models.Model):
    """Immutable append-only operational & security audit log."""

    id = models.BigAutoField(primary_key=True)
    actor_user_id = models.CharField(max_length=64, null=True, blank=True)
    actor_role_snapshot = models.CharField(max_length=32)
    is_developer_masked = models.BooleanField(default=False, db_default=False)
    action = models.CharField(max_length=64)
    target_entity_type = models.CharField(max_length=64, null=True, blank=True)
    target_entity_id = models.CharField(max_length=64, null=True, blank=True)
    details_snapshot_json = models.JSONField(null=True, blank=True)
    reason = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "governance_auditlogentry"

