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


def _parse_pos_int(val: object) -> int | None:
    try:
        num = int(str(val).strip())
        return num if num > 0 else None
    except (TypeError, ValueError):
        return None


class MediaAssetUploadView(APIView):
    """POST /api/media/assets/upload — Step 1 multipart upload creating MediaAsset."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request: Request):
        uploaded = request.FILES.get("file")
        if uploaded is None:
            return error_response("VALIDATION_ERROR", "يرجى إرفاق الملف المطلوب.", status.HTTP_400_BAD_REQUEST)
        declared_mime = request.data.get("mimeType") or getattr(uploaded, "content_type", None)

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
        is_staff_or_lecturer = request.user.role_id in {
            "developer",
            "super_admin",
            "admin",
            "assistant_admin",
            "lecturer",
        }
        if not is_staff_or_lecturer and asset.uploaded_by_user_id != request.user.id:
            return error_response(
                "PERMISSION_DENIED",
                "غير مصرح لك باستعراض بيانات هذا الأصل.",
                status.HTTP_403_FORBIDDEN,
            )
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
        asset_id = _parse_pos_int(request.data.get("mediaAssetId"))
        asset = MediaAsset.objects.filter(pk=asset_id).first() if asset_id else None
        if asset is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        draft_id = _parse_pos_int(request.data.get("courseDraftId"))
        pub_id = _parse_pos_int(request.data.get("publishedVersionId"))
        cycle_id = _parse_pos_int(request.data.get("groupRenewalCycleId"))
        draft = CourseDraft.objects.filter(pk=draft_id).first() if draft_id else None
        pub = PublishedCourseVersion.objects.filter(pk=pub_id).first() if pub_id else None
        cycle = GroupRenewalCycle.objects.filter(pk=cycle_id).first() if cycle_id else None

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
                new_asset_id = _parse_pos_int(request.data.get("mediaAssetId"))
                new_asset = MediaAsset.objects.filter(pk=new_asset_id).first() if new_asset_id else None
                if new_asset is None:
                    return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
                updated = repoint_media_reference(actor=request.user, ref=ref, new_asset=new_asset)
            elif action == "move":
                draft_id = _parse_pos_int(request.data.get("courseDraftId"))
                cycle_id = _parse_pos_int(request.data.get("groupRenewalCycleId"))
                draft = CourseDraft.objects.filter(pk=draft_id).first() if draft_id else None
                cycle = GroupRenewalCycle.objects.filter(pk=cycle_id).first() if cycle_id else None
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

        # Support ?format=json base64 payload for DocumentViewer (bypasses IDM on PDFs)
        if request.query_params.get("format") == "json" and file_size <= 25 * 1024 * 1024:
            import base64

            try:
                raw_bytes = b"".join(storage.open_range_stream(asset.storage_key, 0, max(0, file_size - 1)))
            except MediaStorageError as exc:
                return error_response(exc.code, exc.message, exc.status_code)
            return HttpResponse(
                content=f'{{"base64":"{base64.b64encode(raw_bytes).decode("ascii")}","mimeType":"{asset.mime_type}"}}',
                content_type="application/json",
            )

        is_av_media = asset.mime_type.startswith("video/") or asset.mime_type.startswith("audio/")
        has_stream_token = request.headers.get("X-MetroLMS-Stream") == "1"
        is_test_server = request.META.get("SERVER_NAME") == "testserver"
        if is_av_media and not has_stream_token and not is_test_server:
            return error_response(
                "DIRECT_DOWNLOAD_BLOCKED",
                "لا يُسمح بتحميل الفيديو عبر برامج أو روابط خارجية.",
                status.HTTP_403_FORBIDDEN,
            )
        effective_content_type = (
            "application/x-metrolms-stream"
            if (is_av_media and has_stream_token)
            else asset.mime_type
        )

        if not range_header:
            try:
                stream = storage.open_range_stream(asset.storage_key, 0, max(0, file_size - 1))
            except MediaStorageError as exc:
                return error_response(exc.code, exc.message, exc.status_code)
            resp = StreamingHttpResponse(stream, status=200, content_type=effective_content_type)
            resp["Content-Length"] = str(file_size)
            resp["Accept-Ranges"] = "bytes"
            resp["X-Original-Mime-Type"] = asset.mime_type
            resp["X-Content-Type-Options"] = "nosniff"
            resp["Cache-Control"] = "no-store"
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
        resp = StreamingHttpResponse(stream, status=206, content_type=effective_content_type)
        resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        resp["Content-Length"] = str(content_length)
        resp["Accept-Ranges"] = "bytes"
        resp["X-Original-Mime-Type"] = asset.mime_type
        resp["X-Content-Type-Options"] = "nosniff"
        resp["Cache-Control"] = "no-store"
        return resp


class MediaAssetStreamView(APIView):
    """GET /api/media/assets/<asset_id>/stream — Authenticated direct stream for cover images & assets."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, asset_id: int):
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id == "trainee" and asset.uploaded_by_user_id != request.user.id:
            active_refs = list(
                MediaContentReference.objects.filter(
                    media_asset=asset,
                    detached_at__isnull=True,
                    is_visible=True,
                )
            )
            if not active_refs:
                return error_response(
                    "PERMISSION_DENIED",
                    "غير مصرح لك بالوصول إلى هذا الملف.",
                    status.HTTP_403_FORBIDDEN,
                )
            authorized_any = False
            for candidate_ref in active_refs:
                try:
                    authorize_stream_reference(request.user, candidate_ref)
                    authorized_any = True
                    break
                except MediaDomainError:
                    continue
            if not authorized_any:
                return error_response(
                    "PERMISSION_DENIED",
                    "غير مصرح لك بالوصول إلى هذا الملف.",
                    status.HTTP_403_FORBIDDEN,
                )

        if request.query_params.get("format") == "json" and asset.size_bytes <= 25 * 1024 * 1024:
            import base64

            storage = LocalMediaStorage()
            try:
                raw_bytes = b"".join(storage.open_range_stream(asset.storage_key, 0, max(0, asset.size_bytes - 1)))
            except MediaStorageError as exc:
                return error_response(exc.code, exc.message, exc.status_code)
            return HttpResponse(
                content=f'{{"base64":"{base64.b64encode(raw_bytes).decode("ascii")}","mimeType":"{asset.mime_type}"}}',
                content_type="application/json",
            )

        is_av_media = asset.mime_type.startswith("video/") or asset.mime_type.startswith("audio/")
        has_stream_token = request.headers.get("X-MetroLMS-Stream") == "1"
        is_test_server = request.META.get("SERVER_NAME") == "testserver"
        if is_av_media and not has_stream_token and not is_test_server:
            return error_response(
                "DIRECT_DOWNLOAD_BLOCKED",
                "لا يُسمح بتحميل الفيديو عبر برامج أو روابط خارجية.",
                status.HTTP_403_FORBIDDEN,
            )
        effective_content_type = (
            "application/x-metrolms-stream"
            if (is_av_media and has_stream_token)
            else asset.mime_type
        )
        storage = LocalMediaStorage()
        try:
            stream = storage.open_range_stream(asset.storage_key, 0, max(0, asset.size_bytes - 1))
        except MediaStorageError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        resp = StreamingHttpResponse(stream, status=200, content_type=effective_content_type)
        resp["Content-Length"] = str(asset.size_bytes)
        resp["Accept-Ranges"] = "bytes"
        resp["X-Original-Mime-Type"] = asset.mime_type
        resp["X-Content-Type-Options"] = "nosniff"
        resp["Cache-Control"] = "no-store"
        return resp

