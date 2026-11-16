"""Serializers for PendingApprovalRequest and AuditLogEntry (D-14 masking)."""
from __future__ import annotations

from rest_framework import serializers

from apps.governance.models import AuditLogEntry, PendingApprovalRequest


class PendingApprovalRequestSerializer(serializers.ModelSerializer):
    """Serializer for PendingApprovalRequest matching §2.3 contract."""

    id = serializers.UUIDField(read_only=True)
    approvalRequestId = serializers.UUIDField(source="id", read_only=True)
    actionType = serializers.CharField(source="action_type", read_only=True)
    executionStatus = serializers.CharField(source="execution_status", read_only=True)
    status = serializers.SerializerMethodField()
    requestedByUserId = serializers.CharField(source="requested_by_id", read_only=True)
    reviewedByUserId = serializers.CharField(source="reviewed_by_id", read_only=True)
    executedByUserId = serializers.CharField(source="executed_by_id", read_only=True)
    targetEntityType = serializers.CharField(source="target_entity_type", read_only=True)
    targetEntityId = serializers.CharField(source="target_entity_id", read_only=True)
    payloadSnapshot = serializers.JSONField(source="payload_snapshot_json", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    decidedAt = serializers.DateTimeField(source="decided_at", read_only=True)
    executedAt = serializers.DateTimeField(source="executed_at", read_only=True)

    class Meta:
        model = PendingApprovalRequest
        fields = [
            "id",
            "approvalRequestId",
            "actionType",
            "executionStatus",
            "status",
            "requestedByUserId",
            "reviewedByUserId",
            "executedByUserId",
            "targetEntityType",
            "targetEntityId",
            "payloadSnapshot",
            "reason",
            "createdAt",
            "decidedAt",
            "executedAt",
        ]

    def get_status(self, obj: PendingApprovalRequest) -> str:
        raw = (obj.execution_status or "").lower()
        if raw in {"pending", "pendingapproval"}:
            return "pending"
        if "reject" in raw:
            return "rejected"
        if "approv" in raw or "execut" in raw:
            return "approved"
        return raw or "pending"


class AuditLogEntrySerializer(serializers.ModelSerializer):
    """Read-only AuditLogEntry serializer enforcing D-14 / INV-R8 developer masking."""

    actorUserId = serializers.SerializerMethodField()
    actorRoleSnapshot = serializers.SerializerMethodField()
    targetEntityType = serializers.CharField(source="target_entity_type", read_only=True)
    targetEntityId = serializers.CharField(source="target_entity_id", read_only=True)
    detailsSnapshot = serializers.JSONField(source="details_snapshot_json", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)
    actorId = serializers.SerializerMethodField()
    actorName = serializers.SerializerMethodField()
    actorRole = serializers.SerializerMethodField()
    actionLabelAr = serializers.SerializerMethodField()
    severity = serializers.SerializerMethodField()
    resourceType = serializers.CharField(source="target_entity_type", read_only=True)
    targetResourceId = serializers.CharField(source="target_entity_id", read_only=True)
    details = serializers.SerializerMethodField()
    outcome = serializers.SerializerMethodField()
    metadata = serializers.JSONField(source="details_snapshot_json", read_only=True)

    class Meta:
        model = AuditLogEntry
        fields = [
            "id",
            "actorUserId",
            "actorRoleSnapshot",
            "action",
            "targetEntityType",
            "targetEntityId",
            "detailsSnapshot",
            "reason",
            "createdAt",
            "timestamp",
            "actorId",
            "actorName",
            "actorRole",
            "actionLabelAr",
            "severity",
            "resourceType",
            "targetResourceId",
            "details",
            "outcome",
            "metadata",
        ]

    def _is_masked_for_viewer(self, obj: AuditLogEntry) -> bool:
        viewer = self.context.get("viewer")
        viewer_role = getattr(viewer, "role_id", None)
        return bool(obj.is_developer_masked and viewer_role != "developer")

    def get_actorUserId(self, obj: AuditLogEntry) -> str | None:
        if self._is_masked_for_viewer(obj):
            return "SYSTEM"
        return obj.actor_user_id

    def get_actorRoleSnapshot(self, obj: AuditLogEntry) -> str:
        if self._is_masked_for_viewer(obj):
            return "النظام"
        return obj.actor_role_snapshot

    def get_actorId(self, obj: AuditLogEntry) -> str:
        if self._is_masked_for_viewer(obj):
            return "SYSTEM"
        return str(obj.actor_user_id or "")

    def get_actorName(self, obj: AuditLogEntry) -> str:
        if self._is_masked_for_viewer(obj):
            return "النظام"
        return obj.actor_role_snapshot or str(obj.actor_user_id or "النظام")

    def get_actorRole(self, obj: AuditLogEntry) -> str:
        if self._is_masked_for_viewer(obj):
            return "admin"
        role = obj.actor_role_snapshot or "user"
        return "user" if role == "trainee" else role

    def get_actionLabelAr(self, obj: AuditLogEntry) -> str:
        return obj.action

    def get_severity(self, obj: AuditLogEntry) -> str:
        act = (obj.action or "").lower()
        if any(k in act for k in ("revoke", "delete", "reject", "denied", "fail")):
            return "warning"
        return "info"

    def get_details(self, obj: AuditLogEntry) -> str:
        if obj.reason:
            return obj.reason
        if obj.target_entity_type and obj.target_entity_id:
            return f"{obj.target_entity_type} #{obj.target_entity_id}"
        return obj.action

    def get_outcome(self, obj: AuditLogEntry) -> str:
        act = (obj.action or "").lower()
        if any(k in act for k in ("denied", "blocked")):
            return "denied"
        if "fail" in act or "error" in act:
            return "failure"
        return "success"

