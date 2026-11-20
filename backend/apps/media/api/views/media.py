"""Media upload, reference lifecycle & Range streaming API views."""
from __future__ import annotations

import re

from django.http import HttpResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.models import CourseDraft, PublishedCourseVersion
from apps.groups.models import GroupRenewalCycle
from apps.media.api.serializers.media import MediaAssetSerializer, MediaContentReferenceSerializer
from apps.media.models import MediaAsset, MediaContentReference
from apps.media.services.media_service import (
    MediaDomainError,
    attach_media_reference,
    authorize_stream_reference,
    delete_media_asset_if_unreferenced,
    detach_media_reference,
    move_media_reference,
    repoint_media_reference,
    restore_media_reference,
    update_media_reference_metadata,
    upload_media_asset,
)
from infrastructure.storage import LocalMediaStorage, MediaStorageError
from shared.api import error_response, success_response

_RANGE_HEADER_RE = re.compile(r"\Abytes=(\d*)-(\d*)\Z", re.ASCII)


class MediaAssetUploadView(APIView):
    """POST /api/media/assets/upload — Step 1 multipart upload creating MediaAsset."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request):
        uploaded = request.FILES.get("file")
        if uploaded is None:
            return error_response("VALIDATION_ERROR", "يرجى إرفاق الملف المطلوب.", status.HTTP_400_BAD_REQUEST)
        declared_mime = request.data.get("mimeType") or getattr(uploaded, "content_type", None)

        def _parse_pos_int(val: object) -> int | None:
            try:
                num = int(str(val).strip())
                return num if num > 0 else None
            except (TypeError, ValueError):
                return None

        course_id = _parse_pos_int(request.data.get("courseId"))
        group_id = _parse_pos_int(request.data.get("groupId"))
        chapter_id = str(request.data.get("chapterId") or "").strip() or None
        media_role = str(request.data.get("mediaRole") or "").strip() or None
        folder_id = str(request.data.get("folderId") or "").strip() or None

        try:
            asset = upload_media_asset(
                actor=request.user,
                uploaded_file=uploaded,
                declared_mime_type=str(declared_mime) if declared_mime else None,
                course_id=course_id,
                chapter_id=chapter_id,
                media_role=media_role,
                group_id=group_id,
                folder_id=folder_id,
            )
        except MediaDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"asset": MediaAssetSerializer(asset).data}, status_code=status.HTTP_201_CREATED)


class MediaAssetDetailView(APIView):
    """GET / DELETE /api/media/assets/<asset_id>."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, asset_id: int):
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response({"asset": MediaAssetSerializer(asset).data})

    def delete(self, request: Request, asset_id: int):
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            delete_media_asset_if_unreferenced(actor=request.user, asset=asset)
        except MediaDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"deleted": True, "id": asset_id})


class MediaReferenceListCreateView(APIView):
    """POST /api/media/references — Step 2 attach MediaAsset to mutable context."""

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request: Request):
        asset_id = request.data.get("mediaAssetId")
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        draft = CourseDraft.objects.filter(pk=request.data.get("courseDraftId")).first() if request.data.get("courseDraftId") else None
        pub = PublishedCourseVersion.objects.filter(pk=request.data.get("publishedVersionId")).first() if request.data.get("publishedVersionId") else None
        cycle = GroupRenewalCycle.objects.filter(pk=request.data.get("groupRenewalCycleId")).first() if request.data.get("groupRenewalCycleId") else None

        try:
            ref = attach_media_reference(
                actor=request.user,
                media_asset=asset,
                title=str(request.data.get("title", asset.file_name)),
                is_visible=bool(request.data.get("isVisible", True)),
                course_draft=draft,
                published_version=pub,
                group_renewal_cycle=cycle,
            )
        except MediaDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"reference": MediaContentReferenceSerializer(ref).data}, status_code=status.HTTP_201_CREATED)


class MediaReferenceDetailView(APIView):
    """PATCH /api/media/references/<ref_id> — Update context-specific title/isVisible."""

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, ref_id: int):
        ref = MediaContentReference.objects.select_related("course_draft", "published_version", "group_renewal_cycle").filter(pk=ref_id).first()
        if ref is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            updated = update_media_reference_metadata(
                actor=request.user,
                ref=ref,
                title=request.data.get("title"),
                is_visible=request.data.get("isVisible"),
            )
        except MediaDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"reference": MediaContentReferenceSerializer(updated).data})


class MediaReferenceLifecycleView(APIView):
    """POST /api/media/references/<ref_id>/<action> (detach|restore|move|repoint)."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, ref_id: int, action: str):
        ref = MediaContentReference.objects.select_related("course_draft", "published_version", "group_renewal_cycle").filter(pk=ref_id).first()
        if ref is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            if action == "detach":
                updated = detach_media_reference(actor=request.user, ref=ref)
            elif action == "restore":
                updated = restore_media_reference(actor=request.user, ref=ref)
            elif action == "repoint":
                new_asset = MediaAsset.objects.filter(pk=request.data.get("mediaAssetId")).first()
                if new_asset is None:
                    return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
                updated = repoint_media_reference(actor=request.user, ref=ref, new_asset=new_asset)
            elif action == "move":
                draft = CourseDraft.objects.filter(pk=request.data.get("courseDraftId")).first() if request.data.get("courseDraftId") else None
                cycle = GroupRenewalCycle.objects.filter(pk=request.data.get("groupRenewalCycleId")).first() if request.data.get("groupRenewalCycleId") else None
                updated = move_media_reference(
                    actor=request.user,
                    ref=ref,
                    target_course_draft=draft,
                    target_group_renewal_cycle=cycle,
                )
            else:
                return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        except MediaDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"reference": MediaContentReferenceSerializer(updated).data})


class MediaReferenceStreamView(APIView):
    """GET /api/media/references/<ref_id>/stream — Session-authenticated HTTP Range streaming."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, ref_id: int):
        ref = MediaContentReference.objects.select_related("media_asset").filter(pk=ref_id).first()
        if ref is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            authorize_stream_reference(request.user, ref)
        except MediaDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        asset = ref.media_asset
        file_size = asset.size_bytes
        range_header = request.META.get("HTTP_RANGE", "").strip()
        storage = LocalMediaStorage()

        if not range_header:
            try:
                stream = storage.open_range_stream(asset.storage_key, 0, max(0, file_size - 1))
            except MediaStorageError as exc:
                return error_response(exc.code, exc.message, exc.status_code)
            resp = StreamingHttpResponse(stream, status=200, content_type=asset.mime_type)
            resp["Content-Length"] = str(file_size)
            resp["Accept-Ranges"] = "bytes"
            return resp

        match = _RANGE_HEADER_RE.match(range_header)
        if not match or file_size == 0:
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{file_size}"
            return resp

        start_str, end_str = match.group(1), match.group(2)
        if not start_str and not end_str:
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{file_size}"
            return resp

        if start_str:
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1
        else:
            suffix = int(end_str)
            start = max(0, file_size - suffix)
            end = file_size - 1

        if start >= file_size or end < start or end >= file_size:
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{file_size}"
            return resp

        try:
            stream = storage.open_range_stream(asset.storage_key, start, end)
        except MediaStorageError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        content_length = (end - start) + 1
        resp = StreamingHttpResponse(stream, status=206, content_type=asset.mime_type)
        resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        resp["Content-Length"] = str(content_length)
        resp["Accept-Ranges"] = "bytes"
        return resp


class MediaAssetStreamView(APIView):
    """GET /api/media/assets/<asset_id>/stream — Authenticated direct stream for cover images & assets."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, asset_id: int):
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        storage = LocalMediaStorage()
        try:
            stream = storage.open_range_stream(asset.storage_key, 0, max(0, asset.size_bytes - 1))
        except MediaStorageError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        resp = StreamingHttpResponse(stream, status=200, content_type=asset.mime_type)
        resp["Content-Length"] = str(asset.size_bytes)
        resp["Accept-Ranges"] = "bytes"
        return resp

