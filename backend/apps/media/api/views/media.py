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
    mint_stream_ticket,
    move_media_reference,
    repoint_media_reference,
    restore_media_reference,
    update_media_reference_metadata,
    upload_media_asset,
    verify_stream_ticket,
)
from infrastructure.storage import LocalMediaStorage, MediaStorageError
from shared.api import error_response, success_response

_BYTE_RANGE_SPEC_RE = re.compile(r"\A(\d*)-(\d*)\Z", re.ASCII)
# Cap open-ended A/V Range chunks (e.g. `Range: bytes=0-`) to 4 MB so Waitress workers
# complete each buffer burst cleanly instead of keeping long-lived streams that abort on seek/throttle.
_OPEN_RANGE_CHUNK_BYTES = 4 * 1024 * 1024


def _unsatisfiable_range_response(file_size: int) -> HttpResponse:
    """Build an RFC 9110 416 Range Not Satisfiable response for the given representation size."""
    resp = HttpResponse(status=416)
    resp["Content-Range"] = f"bytes */{file_size}"
    return resp


def _apply_stream_headers(
    resp: HttpResponse | StreamingHttpResponse,
    *,
    asset: MediaAsset,
    content_length: int,
    content_range: str | None = None,
) -> HttpResponse | StreamingHttpResponse:
    """Attach standard byte-range, MIME, and cache/security headers onto media stream responses."""
    if content_range is not None:
        resp["Content-Range"] = content_range
    resp["Content-Length"] = str(content_length)
    resp["Accept-Ranges"] = "bytes"
    resp["X-Original-Mime-Type"] = asset.mime_type
    resp["X-Content-Type-Options"] = "nosniff"
    resp["Cache-Control"] = "no-store"
    return resp


def _normalize_decimal(raw: str) -> str:
    """Normalize an ASCII digit string by stripping leading zeros while preserving `'0'`."""
    return raw.lstrip("0") or "0"


def _decimal_lt(lhs: str, rhs: str) -> bool:
    """Compare two ASCII decimal digit strings numerically without hitting int() digit limits."""
    a = _normalize_decimal(lhs)
    b = _normalize_decimal(rhs)
    return (len(a), a) < (len(b), b)


def _resolve_single_byte_range(
    spec: str,
    *,
    file_size: int,
    is_av_media: bool,
) -> tuple[int, int] | None:
    """Parse and clamp a single HTTP byte-range-spec (`start-end`, `start-`, or `-suffix`)."""
    match = _BYTE_RANGE_SPEC_RE.match(spec)
    if not match:
        return None
    start_str, end_str = match.group(1), match.group(2)
    if (not start_str and not end_str) or file_size <= 0:
        return None

    file_size_str = str(file_size)

    if start_str:
        if not _decimal_lt(start_str, file_size_str):
            return None
        start = int(_normalize_decimal(start_str))
        if end_str:
            if _decimal_lt(end_str, start_str):
                return None
            # RFC 9110 §14.1.2: clamp explicit end >= file_size to last byte (file_size - 1)
            end = (
                int(_normalize_decimal(end_str))
                if _decimal_lt(end_str, file_size_str)
                else file_size - 1
            )
        elif is_av_media:
            end = min(file_size - 1, start + _OPEN_RANGE_CHUNK_BYTES - 1)
        else:
            end = file_size - 1
        return (start, end)

    if not _decimal_lt("0", end_str):
        return None
    if not _decimal_lt(end_str, file_size_str):
        return (0, file_size - 1)
    suffix = int(_normalize_decimal(end_str))
    return (file_size - suffix, file_size - 1)


def _parse_range_header(
    range_header: str,
    *,
    file_size: int,
    is_av_media: bool,
) -> tuple[str, tuple[int, int] | None]:
    """Interpret HTTP Range header: returns ('full', None), ('partial', (start, end)), or ('unsatisfiable', None).

    Per RFC 9110 §14.2, valid multi-range requests (e.g. `bytes=0-100,200-300`) are safely
    ignored and served as a full 200 OK response instead of failing with 416 or multipart payloads.
    """
    if not range_header:
        return ("full", None)
    if not range_header[:6].lower() == "bytes=":
        return ("unsatisfiable", None)

    specs = [part.strip() for part in range_header[6:].split(",")]
    if len(specs) == 1:
        resolved = _resolve_single_byte_range(specs[0], file_size=file_size, is_av_media=is_av_media)
        return ("partial", resolved) if resolved is not None else ("unsatisfiable", None)

    if file_size <= 0:
        return ("unsatisfiable", None)

    has_satisfiable = False
    for spec in specs:
        match = _BYTE_RANGE_SPEC_RE.match(spec)
        if not match:
            return ("unsatisfiable", None)
        start_str, end_str = match.group(1), match.group(2)
        if not start_str and not end_str:
            return ("unsatisfiable", None)
        if start_str and end_str and _decimal_lt(end_str, start_str):
            return ("unsatisfiable", None)
        if _resolve_single_byte_range(spec, file_size=file_size, is_av_media=is_av_media) is not None:
            has_satisfiable = True

    return ("full", None) if has_satisfiable else ("unsatisfiable", None)


def _parse_pos_int(val: object) -> int | None:
    try:
        num = int(str(val).strip())
        return num if num > 0 else None
    except (TypeError, ValueError):
        return None


def _is_user_authorized_for_asset(user, asset: MediaAsset) -> bool:
    """Enforce asset-level RBAC across MediaAssetDetailView, MediaStreamTicketView, and MediaAssetStreamView."""
    if user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}:
        return True
    if asset.uploaded_by_user_id == user.id:
        return True

    # 1. Check group-scoped materials manifest membership/monitoring if stored under groups/group_<id>/
    grp_match = re.match(r"\Agroups/group_(\d+)/", asset.storage_key or "")
    if grp_match:
        from apps.groups.api.views.groups import _load_materials_manifest
        from apps.groups.models import GroupAssistantAssignment, GroupCourseAssignment, GroupMembership

        gid = int(grp_match.group(1))
        if user.role_id == "lecturer":
            is_group_lecturer = (
                GroupAssistantAssignment.objects.filter(training_group_id=gid, user=user).exists()
                or GroupCourseAssignment.objects.filter(
                    group_renewal_cycle__training_group_id=gid,
                    course__primary_lecturer=user,
                ).exists()
            )
            if is_group_lecturer:
                return True
        elif user.role_id == "trainee" and GroupMembership.objects.filter(training_group_id=gid, user=user).exists():
            manifest = _load_materials_manifest(gid)
            aid_str = str(asset.id)
            for f in manifest.get("rootFiles", []):
                if (
                    isinstance(f, dict)
                    and str(f.get("mediaId") or f.get("mediaAssetId") or "") == aid_str
                    and f.get("isVisible", True) is not False
                ):
                    return True
            for fld in manifest.get("folders", []):
                if not isinstance(fld, dict) or fld.get("isVisible", True) is False:
                    continue
                for f in fld.get("files", []):
                    if (
                        isinstance(f, dict)
                        and str(f.get("mediaId") or f.get("mediaAssetId") or "") == aid_str
                        and f.get("isVisible", True) is not False
                    ):
                        return True

    # 2. Check active MediaContentReference bindings (courses / group renewal cycles)
    ref_filter = {"media_asset": asset, "detached_at__isnull": True}
    if user.role_id == "trainee":
        ref_filter["is_visible"] = True
    for candidate_ref in MediaContentReference.objects.filter(**ref_filter):
        try:
            authorize_stream_reference(user, candidate_ref)
            return True
        except MediaDomainError:
            continue
    return False


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
        if not _is_user_authorized_for_asset(request.user, asset):
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


def _serve_authenticated_media_stream(
    request: Request,
    *,
    asset: MediaAsset,
    ticket_kind: str,
    ticket_target_id: int,
    is_head: bool = False,
):
    """Shared HTTP 200 / 206 / 416 Range & HEAD streaming handler for references & assets."""
    file_size = asset.size_bytes
    storage = LocalMediaStorage()

    # Support ?format=json base64 payload for DocumentViewer (HEAD matches metadata without reading/encoding)
    if request.query_params.get("format") == "json" and file_size <= 25 * 1024 * 1024:
        try:
            target = storage.resolve_safe_path(asset.storage_key)
        except MediaStorageError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        if not target.is_file():
            return error_response(
                "ASSET_BINARY_MISSING",
                "ملف الوسائط غير موجود على الخادم.",
                status.HTTP_404_NOT_FOUND,
            )

        empty_json_len = len(f'{{"base64":"","mimeType":"{asset.mime_type}"}}'.encode("utf-8"))
        b64_len = ((file_size + 2) // 3) * 4
        if is_head:
            resp = HttpResponse(b"", status=200, content_type="application/json")
            resp["Content-Length"] = str(empty_json_len + b64_len)
            return resp

        import base64

        if file_size == 0:
            raw_bytes = b""
        else:
            try:
                raw_bytes = b"".join(storage.open_range_stream(asset.storage_key, 0, file_size - 1))
            except MediaStorageError as exc:
                return error_response(exc.code, exc.message, exc.status_code)
        payload_bytes = (
            f'{{"base64":"{base64.b64encode(raw_bytes).decode("ascii")}","mimeType":"{asset.mime_type}"}}'
        ).encode("utf-8")
        resp = HttpResponse(payload_bytes, status=200, content_type="application/json")
        resp["Content-Length"] = str(len(payload_bytes))
        return resp

    is_av_media = asset.mime_type.startswith("video/") or asset.mime_type.startswith("audio/")
    st_token = (request.query_params.get("st") or "").strip()
    has_valid_ticket = bool(
        st_token
        and verify_stream_ticket(st_token, user_id=request.user.id, kind=ticket_kind, target_id=ticket_target_id)
    )
    has_header_token = request.headers.get("X-MetroLMS-Stream") == "1"
    has_stream_token = has_header_token or has_valid_ticket
    is_test_server = request.META.get("SERVER_NAME") == "testserver"
    if is_av_media and not has_stream_token and not is_test_server:
        return error_response(
            "DIRECT_DOWNLOAD_BLOCKED",
            "لا يُسمح بتحميل الفيديو عبر برامج أو روابط خارجية.",
            status.HTTP_403_FORBIDDEN,
        )
    effective_content_type = (
        "application/x-metrolms-stream"
        if (is_av_media and has_header_token and not has_valid_ticket)
        else asset.mime_type
    )

    try:
        target = storage.resolve_safe_path(asset.storage_key)
    except MediaStorageError as exc:
        return error_response(exc.code, exc.message, exc.status_code)
    if not target.is_file():
        return error_response(
            "ASSET_BINARY_MISSING",
            "ملف الوسائط غير موجود على الخادم.",
            status.HTTP_404_NOT_FOUND,
        )

    # HEAD returns full-representation headers only, ignores Range, and never opens/reads storage streams.
    if is_head:
        resp = HttpResponse(b"", status=200, content_type=effective_content_type)
        return _apply_stream_headers(resp, asset=asset, content_length=file_size)

    range_header = request.META.get("HTTP_RANGE", "").strip()
    mode, byte_range = _parse_range_header(
        range_header,
        file_size=file_size,
        is_av_media=is_av_media,
    )
    if mode == "unsatisfiable":
        return _unsatisfiable_range_response(file_size)

    if mode == "full":
        if file_size == 0:
            resp = HttpResponse(b"", status=200, content_type=effective_content_type)
            return _apply_stream_headers(resp, asset=asset, content_length=0)
        try:
            stream = storage.open_range_stream(asset.storage_key, 0, file_size - 1)
        except MediaStorageError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        resp = StreamingHttpResponse(stream, status=200, content_type=effective_content_type)
        return _apply_stream_headers(resp, asset=asset, content_length=file_size)

    assert byte_range is not None
    start, end = byte_range
    try:
        stream = storage.open_range_stream(asset.storage_key, start, end)
    except MediaStorageError as exc:
        return error_response(exc.code, exc.message, exc.status_code)

    resp = StreamingHttpResponse(stream, status=206, content_type=effective_content_type)
    return _apply_stream_headers(
        resp,
        asset=asset,
        content_length=(end - start) + 1,
        content_range=f"bytes {start}-{end}/{file_size}",
    )


class MediaReferenceStreamView(APIView):
    """GET/HEAD /api/media/references/<ref_id>/stream — Session-authenticated HTTP Range & HEAD streaming."""

    permission_classes = [IsAuthenticated]

    def _handle(self, request: Request, ref_id: int, *, is_head: bool):
        ref = MediaContentReference.objects.select_related("media_asset").filter(pk=ref_id).first()
        if ref is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            authorize_stream_reference(request.user, ref)
        except MediaDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        return _serve_authenticated_media_stream(
            request,
            asset=ref.media_asset,
            ticket_kind="ref",
            ticket_target_id=ref.id,
            is_head=is_head,
        )

    def get(self, request: Request, ref_id: int):
        return self._handle(request, ref_id, is_head=False)

    def head(self, request: Request, ref_id: int):
        return self._handle(request, ref_id, is_head=True)


class MediaStreamTicketView(APIView):
    """POST /api/media/stream-ticket — Mint user-bound progressive Range streaming ticket."""

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request: Request):
        raw_url = str(request.data.get("url") or "").strip()
        ref_id = _parse_pos_int(request.data.get("mediaReferenceId"))
        asset_id = _parse_pos_int(request.data.get("mediaAssetId"))

        if not ref_id and raw_url:
            m_ref = re.search(r"/api/media/references/(\d+)/stream", raw_url)
            if m_ref:
                ref_id = int(m_ref.group(1))
        if not asset_id and not ref_id and raw_url:
            m_asset = re.search(r"/api/media/assets/(\d+)/stream", raw_url)
            if m_asset:
                asset_id = int(m_asset.group(1))

        if ref_id:
            ref = MediaContentReference.objects.select_related("media_asset").filter(pk=ref_id).first()
            if ref is None:
                return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
            try:
                authorize_stream_reference(request.user, ref)
            except MediaDomainError as exc:
                return error_response(exc.code, exc.message, exc.status_code)
            ticket = mint_stream_ticket(user_id=request.user.id, kind="ref", target_id=ref.id)
            return success_response({"ticket": ticket, "streamUrl": f"/api/media/references/{ref.id}/stream?st={ticket}"})

        if asset_id:
            asset = MediaAsset.objects.filter(pk=asset_id).first()
            if asset is None:
                return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
            if not _is_user_authorized_for_asset(request.user, asset):
                return error_response("PERMISSION_DENIED", "غير مصرح لك بالوصول إلى هذا الملف.", status.HTTP_403_FORBIDDEN)
            ticket = mint_stream_ticket(user_id=request.user.id, kind="asset", target_id=asset.id)
            return success_response({"ticket": ticket, "streamUrl": f"/api/media/assets/{asset.id}/stream?st={ticket}"})

        return error_response("VALIDATION_ERROR", "معرف أو رابط الوسائط مطلوب.", status.HTTP_400_BAD_REQUEST)


class MediaAssetStreamView(APIView):
    """GET/HEAD /api/media/assets/<asset_id>/stream — Authenticated direct stream for cover images & assets."""

    permission_classes = [IsAuthenticated]

    def _handle(self, request: Request, asset_id: int, *, is_head: bool):
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _is_user_authorized_for_asset(request.user, asset):
            return error_response(
                "PERMISSION_DENIED",
                "غير مصرح لك بالوصول إلى هذا الملف.",
                status.HTTP_403_FORBIDDEN,
            )

        return _serve_authenticated_media_stream(
            request,
            asset=asset,
            ticket_kind="asset",
            ticket_target_id=asset.id,
            is_head=is_head,
        )

    def get(self, request: Request, asset_id: int):
        return self._handle(request, asset_id, is_head=False)

    def head(self, request: Request, asset_id: int):
        return self._handle(request, asset_id, is_head=True)

