"""Governance, approval workflow & audit log API views."""
from __future__ import annotations

import uuid

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.governance.api.serializers.governance import (
    AuditLogEntrySerializer,
    PendingApprovalRequestSerializer,
)
from apps.governance.models import AuditLogEntry, PendingApprovalRequest
from apps.governance.services.governance_service import (
    ApprovalAlreadyDecidedError,
    ApprovalNotFoundError,
    create_pending_approval,
    decide_pending_approval,
)
from shared.api import error_response, success_response
from shared.permissions import has_capability


class ApprovalListView(APIView):
    """GET / POST /api/admin/permissions/governance/approvals."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("permissions.view_matrix")()]
        return [IsAuthenticated()]

    def get(self, request: Request):
        qs = PendingApprovalRequest.objects.all().order_by("-created_at")
        return success_response({"approvals": PendingApprovalRequestSerializer(qs, many=True).data})

    def post(self, request: Request):
        if request.user.role_id not in {"assistant_admin", "admin", "super_admin", "developer"}:
            return error_response(
                "PERMISSION_DENIED",
                "ليس لديك صلاحية لإنشاء طلب موافقة.",
                status.HTTP_403_FORBIDDEN,
            )
        action_type = request.data.get("actionType")
        target_type = request.data.get("targetEntityType")
        target_id = request.data.get("targetEntityId")
        payload = request.data.get("payloadSnapshot")
        reason = request.data.get("reason")
        if not action_type or not target_type or not target_id or not isinstance(payload, dict):
            return error_response(
                "VALIDATION_ERROR",
                "طلب غير صالح. يرجى مراجعة البيانات المدخلة.",
                status.HTTP_400_BAD_REQUEST,
            )

        req = create_pending_approval(
            requester=request.user,
            action_type=str(action_type),
            target_entity_type=str(target_type),
            target_entity_id=str(target_id),
            payload_snapshot=payload,
            reason=str(reason) if reason is not None else None,
        )
        return success_response(
            {
                "status": "PendingApproval",
                "approvalRequestId": str(req.id),
                "actionType": req.action_type,
                "requestedByUserId": req.requested_by_id,
                "createdAt": req.created_at,
                "message": "تم إرسال الطلب للمراجعة والموافقة من قبل مدير النظام",
            },
            status_code=status.HTTP_202_ACCEPTED,
        )


class ApprovalDecisionView(APIView):
    """POST /api/admin/permissions/governance/approvals/<request_id>/decide."""

    permission_classes = [IsAuthenticated, has_capability("approvals.decide_request")]

    def post(self, request: Request, request_id: uuid.UUID):
        decision = request.data.get("decision")
        reason = request.data.get("reason")
        if decision not in {"approve", "reject"}:
            return error_response(
                "VALIDATION_ERROR",
                "يجب أن يكون القرار approve أو reject.",
                status.HTTP_400_BAD_REQUEST,
            )
        try:
            updated = decide_pending_approval(
                request_id=request_id,
                reviewer=request.user,
                decision=decision,
                reason=str(reason) if reason is not None else None,
            )
        except ApprovalNotFoundError:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        except ApprovalAlreadyDecidedError as exc:
            return error_response("ALREADY_DECIDED", str(exc), status.HTTP_409_CONFLICT)

        return success_response({"approval": PendingApprovalRequestSerializer(updated).data})


class AuditLogListView(APIView):
    """GET /api/admin/audit — Read-only audit trail with D-14 developer masking."""

    permission_classes = [IsAuthenticated, has_capability("audit.view_system_logs")]

    def get(self, request: Request):
        from django.db.models import Q

        qs = AuditLogEntry.objects.all().order_by("-created_at", "-id")
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(action__icontains=search)
                | Q(reason__icontains=search)
                | Q(target_entity_type__icontains=search)
                | Q(target_entity_id__icontains=search)
            )
        action = (request.query_params.get("action") or "").strip()
        if action:
            qs = qs.filter(action__icontains=action)
        start_date = (request.query_params.get("startDate") or "").strip()
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        end_date = (request.query_params.get("endDate") or "").strip()
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        total = qs.count()
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = max(1, min(200, int(request.query_params.get("pageSize", 15))))
        except (TypeError, ValueError):
            page_size = 15

        total_pages = max(1, (total + page_size - 1) // page_size)
        offset = (page - 1) * page_size
        page_items = qs[offset : offset + page_size]
        data = AuditLogEntrySerializer(page_items, many=True, context={"viewer": request.user}).data
        return success_response(
            {
                "logs": data,
                "entries": data,
                "total": total,
                "page": page,
                "pageSize": page_size,
                "totalPages": total_pages,
            }
        )


class AuditLogDetailView(APIView):
    """GET /api/admin/audit/<entry_id>."""

    permission_classes = [IsAuthenticated, has_capability("audit.view_system_logs")]

    def get(self, request: Request, entry_id: int):
        entry = AuditLogEntry.objects.filter(pk=entry_id).first()
        if entry is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response(AuditLogEntrySerializer(entry, context={"viewer": request.user}).data)

