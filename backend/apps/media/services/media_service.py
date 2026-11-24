"""MediaAsset & MediaContentReference domain services (INV-DOM21-05..21, TR-C2-06/07)."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
import threading

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import connections, transaction
from django.utils import timezone

from apps.courses.models import CourseDraft, PublishedCourseVersion
from apps.courses.services.course_service import can_edit_course_draft
from apps.governance.services.governance_service import record_audit_log
from apps.groups.models import GroupAssistantAssignment, GroupRenewalCycle
from apps.identity.models import User
from apps.media.models import MediaAsset, MediaContentReference
from infrastructure.media_processing import find_ffmpeg_binaries, transcode_to_mp4
from infrastructure.storage import LocalMediaStorage, MediaStorageError
from shared.permissions import evaluate_permission
from shared.validators import normalize_mime_type, normalize_nfc_stripped, validate_mime_type, validate_non_empty_text

logger = logging.getLogger(__name__)
_STREAM_SIGNER = TimestampSigner(salt="metrolms-media-stream")


class MediaDomainError(Exception):
    """Domain or authorization error in apps.media."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def upload_media_asset(
    *,
    actor: User,
    uploaded_file,
    declared_mime_type: str | None = None,
    course_id: int | None = None,
    chapter_id: str | None = None,
    media_role: str | None = None,
    group_id: int | None = None,
    folder_id: str | None = None,
    storage: LocalMediaStorage | None = None,
) -> MediaAsset:
    """Step 1: Validate, checksum, store binary, and create immutable MediaAsset."""
    decision = evaluate_permission(actor, "materials.upload_files")
    if not decision.granted and actor.role_id != "lecturer":
        raise MediaDomainError("PERMISSION_DENIED", decision.reason_ar, 403)

    raw_name = getattr(uploaded_file, "name", "") or "file"
    file_name = normalize_nfc_stripped(raw_name)[:255]
    try:
        validate_non_empty_text(file_name)
    except DjangoValidationError as exc:
        raise MediaDomainError("INVALID_FILE_NAME", "اسم الملف غير صالح.", 400) from exc

    raw_mime = declared_mime_type or getattr(uploaded_file, "content_type", "") or ""
    mime_type = normalize_mime_type(raw_mime.split(";")[0])
    try:
        validate_mime_type(mime_type)
    except Exception as exc:
        raise MediaDomainError("INVALID_MIME_TYPE", "صيغة MIME غير صالحة.", 400) from exc

    store = storage or LocalMediaStorage()
    scope_prefix: str | None = None
    if course_id is not None and int(course_id) > 0:
        if media_role == "cover":
            scope_prefix = f"courses/course_{int(course_id)}/cover"
        elif chapter_id:
            import re as _re

            safe_chap = _re.sub(r"[^A-Za-z0-9_-]", "", str(chapter_id).strip())[:64]
            if safe_chap:
                scope_prefix = f"courses/course_{int(course_id)}/chapter_{safe_chap}"
            else:
                scope_prefix = f"courses/course_{int(course_id)}"
        else:
            scope_prefix = f"courses/course_{int(course_id)}"
    elif group_id is not None and int(group_id) > 0:
        if folder_id:
            import re as _re

            safe_folder = _re.sub(r"[^A-Za-z0-9_-]", "", str(folder_id).strip())[:64]
            if safe_folder:
                scope_prefix = f"groups/group_{int(group_id)}/folder_{safe_folder}"
            else:
                scope_prefix = f"groups/group_{int(group_id)}"
        else:
            scope_prefix = f"groups/group_{int(group_id)}"

    try:
        storage_key, size_bytes, checksum = store.save_uploaded_file(
            uploaded_file,
            mime_type,
            scope_prefix=scope_prefix,
        )
    except MediaStorageError as exc:
        raise MediaDomainError(exc.code, exc.message, exc.status_code) from exc

    if scope_prefix:
        existing = (
            MediaAsset.objects.filter(
                sha256_checksum=checksum,
                mime_type=mime_type,
                storage_key__startswith=f"{scope_prefix}/",
            )
            .order_by("id")
            .first()
        )
        if existing is not None:
            try:
                if store.resolve_safe_path(existing.storage_key).exists():
                    store.delete_stored_file(storage_key)
                    return existing
            except Exception:
                pass

    asset = MediaAsset.objects.create(
        storage_key=storage_key,
        file_name=file_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
        sha256_checksum=checksum,
        uploaded_by_user=actor,
        created_at=timezone.now(),
    )
    record_audit_log(
        action="media.asset_uploaded",
        actor=actor,
        target_entity_type="MediaAsset",
        target_entity_id=str(asset.id),
        details_snapshot={"mimeType": mime_type, "sizeBytes": size_bytes},
    )

    if mime_type.startswith("video/") and find_ffmpeg_binaries()[0]:
        try:
            sync_limit_mb = int(os.environ.get("METROLMS_SYNC_TRANSCODE_MAX_MB", "100"))
        except ValueError:
            sync_limit_mb = 100
        if size_bytes <= max(1, sync_limit_mb) * 1024 * 1024:
            _transcode_video_asset_in_place(asset.id, store.root, scope_prefix=scope_prefix, raise_on_error=True)
            asset.refresh_from_db()
        else:
            _write_transcode_status(store.root, asset.id, {"status": "processing"})
            worker = threading.Thread(
                target=_transcode_video_asset_worker,
                args=(asset.id, store.root, scope_prefix),
                daemon=True,
            )
            worker.start()

    return asset


def _transcode_status_path(root: Path, asset_id: int) -> Path:
    return root / "staging" / f"transcode_{asset_id}.json"


def _write_transcode_status(root: Path, asset_id: int, payload: dict[str, object]) -> None:
    try:
        p = _transcode_status_path(root, asset_id)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def get_asset_transcode_status(asset: MediaAsset, storage: LocalMediaStorage | None = None) -> str:
    """Return 'processing', 'failed', or 'ready' for a MediaAsset."""
    store = storage or LocalMediaStorage()
    status_file = _transcode_status_path(store.root, asset.id)
    if status_file.is_file():
        try:
            data = json.loads(status_file.read_text(encoding="utf-8"))
            st = str(data.get("status") or "")
            if st in {"processing", "failed", "ready"}:
                return st
        except Exception:
            pass
    return "ready"


def _transcode_video_asset_worker(asset_id: int, root_path: Path, scope_prefix: str | None) -> None:
    try:
        _transcode_video_asset_in_place(asset_id, root_path, scope_prefix=scope_prefix, raise_on_error=False)
    finally:
        connections.close_all()


def _transcode_video_asset_in_place(
    asset_id: int,
    root_path: Path,
    *,
    scope_prefix: str | None,
    raise_on_error: bool,
) -> None:
    asset = MediaAsset.objects.filter(pk=asset_id).first()
    if asset is None:
        return
    store = LocalMediaStorage(root_path)
    source_path = store.resolve_safe_path(asset.storage_key)
    target_key = store.build_storage_key(".mp4", scope_prefix=scope_prefix)
    target_path = store.resolve_safe_path(target_key)

    _write_transcode_status(root_path, asset_id, {"status": "processing"})
    try:
        outcome = transcode_to_mp4(source_path, target_path)
    except Exception as exc:
        logger.warning("FFmpeg transcode failed for MediaAsset %s: %s", asset_id, exc)
        if asset.mime_type == "video/mp4":
            _write_transcode_status(root_path, asset_id, {"status": "ready", "strategy": "passthrough"})
            return
        _write_transcode_status(root_path, asset_id, {"status": "failed", "error": str(exc)})
        if raise_on_error:
            try:
                source_path.unlink(missing_ok=True)
            except Exception:
                pass
            MediaAsset.objects.filter(pk=asset_id).delete()
            raise MediaDomainError(
                "VIDEO_TRANSCODE_FAILED",
                "تعذر تحويل ملف الفيديو إلى صيغة MP4. يرجى التأكد من سلامة الملف.",
                400,
            ) from exc
        return

    new_name = f"{Path(asset.file_name).stem or 'video'}.mp4"[:255]
    with transaction.atomic():
        locked = MediaAsset.objects.select_for_update().filter(pk=asset_id).first()
        if locked is not None:
            locked.storage_key = target_key
            locked.file_name = new_name
            locked.mime_type = "video/mp4"
            locked.size_bytes = outcome.size_bytes
            locked.sha256_checksum = outcome.sha256_checksum
            locked.save(update_fields=["storage_key", "file_name", "mime_type", "size_bytes", "sha256_checksum"])

    try:
        if source_path != target_path and source_path.exists():
            source_path.unlink(missing_ok=True)
    except Exception:
        pass
    _write_transcode_status(root_path, asset_id, {"status": "ready", "strategy": outcome.strategy})


def mint_stream_ticket(*, user_id: int, kind: str, target_id: int) -> str:
    """Create a short-lived HMAC-signed stream ticket bound to user_id and target resource."""
    return _STREAM_SIGNER.sign_object({"uid": int(user_id), "kind": str(kind), "tid": int(target_id)})


def verify_stream_ticket(
    token: str,
    *,
    user_id: int,
    kind: str,
    target_id: int,
    max_age: int = 7200,
) -> bool:
    """Verify signed stream ticket against user_id, target kind/id, and TTL."""
    if not token:
        return False
    try:
        data = _STREAM_SIGNER.unsign_object(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return False
    return (
        isinstance(data, dict)
        and data.get("uid") == int(user_id)
        and data.get("kind") == str(kind)
        and data.get("tid") == int(target_id)
    )


def _assert_context_mutable_and_authorized(
    actor: User,
    *,
    course_draft: CourseDraft | None = None,
    published_version: PublishedCourseVersion | None = None,
    group_renewal_cycle: GroupRenewalCycle | None = None,
) -> None:
    """Enforce INV-DOM21-07 historical immutability & INV-DOM21-20/21 context auth."""
    populated = sum(x is not None for x in (course_draft, published_version, group_renewal_cycle))
    if populated != 1:
        raise MediaDomainError("INVALID_TARGET_CONTEXT", "يجب تحديد سياق واحد فقط لمرجع الوسائط.", 400)

    if published_version is not None:
        raise MediaDomainError(
            "IMMUTABLE_PUBLISHED_VERSION",
            "لا يمكن تعديل أو استبدال أو فصل مراجع الوسائط في إصدار مقرر منشور (INV-DOM21-07).",
            403,
        )

    if course_draft is not None:
        if not can_edit_course_draft(actor, course_draft.course):
            raise MediaDomainError("PERMISSION_DENIED", "غير مصرح لك بإدارة وسائط مسودة هذا المقرر.", 403)
        return

    assert group_renewal_cycle is not None
    if group_renewal_cycle.cycle_status not in {"Scheduled", "Active"}:
        raise MediaDomainError(
            "IMMUTABLE_SEALED_CYCLE",
            "لا يمكن تعديل مراجع الوسائط في دورة مجموعة مغلقة أو منتهية (INV-DOM21-07).",
            403,
        )
    is_assigned = True
    if actor.role_id in {"assistant_admin", "lecturer"}:
        is_assigned = GroupAssistantAssignment.objects.filter(
            training_group=group_renewal_cycle.training_group,
            user=actor,
        ).exists()
    decision = evaluate_permission(actor, "materials.manage_references", is_group_assigned=is_assigned)
    if not decision.granted:
        raise MediaDomainError("PERMISSION_DENIED", decision.reason_ar, 403)


@transaction.atomic
def attach_media_reference(
    *,
    actor: User,
    media_asset: MediaAsset,
    title: str,
    is_visible: bool = True,
    course_draft: CourseDraft | None = None,
    published_version: PublishedCourseVersion | None = None,
    group_renewal_cycle: GroupRenewalCycle | None = None,
) -> MediaContentReference:
    """Step 2: Bind an uploaded MediaAsset to an authorized mutable target context."""
    _assert_context_mutable_and_authorized(
        actor,
        course_draft=course_draft,
        published_version=published_version,
        group_renewal_cycle=group_renewal_cycle,
    )
    norm_title = normalize_nfc_stripped(title)
    try:
        validate_non_empty_text(norm_title)
    except DjangoValidationError as exc:
        raise MediaDomainError("VALIDATION_ERROR", "عنوان مرجع الوسائط مطلوب.", 400) from exc
    ref = MediaContentReference.objects.create(
        media_asset=media_asset,
        course_draft=course_draft,
        published_version=published_version,
        group_renewal_cycle=group_renewal_cycle,
        title=norm_title,
        is_visible=is_visible,
    )
    record_audit_log(
        action="media.reference_attached",
        actor=actor,
        target_entity_type="MediaContentReference",
        target_entity_id=str(ref.id),
        details_snapshot={"mediaAssetId": media_asset.id},
    )
    return ref


@transaction.atomic
def repoint_media_reference(*, actor: User, ref: MediaContentReference, new_asset: MediaAsset) -> MediaContentReference:
    """INV-DOM21-12 Step 2: Repoint existing mutable reference to a new MediaAsset."""
    _assert_context_mutable_and_authorized(
        actor,
        course_draft=ref.course_draft,
        published_version=ref.published_version,
        group_renewal_cycle=ref.group_renewal_cycle,
    )
    old_id = ref.media_asset_id
    ref.media_asset = new_asset
    ref.save(update_fields=["media_asset"])
    record_audit_log(
        action="media.reference_repointed",
        actor=actor,
        target_entity_type="MediaContentReference",
        target_entity_id=str(ref.id),
        details_snapshot={"oldAssetId": old_id, "newAssetId": new_asset.id},
    )
    return ref


@transaction.atomic
def update_media_reference_metadata(
    *,
    actor: User,
    ref: MediaContentReference,
    title: str | None = None,
    is_visible: bool | None = None,
) -> MediaContentReference:
    """INV-DOM21-13/14/15: Update context-specific title/is_visible without altering MediaAsset."""
    _assert_context_mutable_and_authorized(
        actor,
        course_draft=ref.course_draft,
        published_version=ref.published_version,
        group_renewal_cycle=ref.group_renewal_cycle,
    )
    fields: list[str] = []
    if title is not None:
        norm = normalize_nfc_stripped(title)
        try:
            validate_non_empty_text(norm)
        except DjangoValidationError as exc:
            raise MediaDomainError("VALIDATION_ERROR", "عنوان مرجع الوسائط مطلوب.", 400) from exc
        ref.title = norm
        fields.append("title")
    if is_visible is not None:
        ref.is_visible = bool(is_visible)
        fields.append("is_visible")
    if fields:
        ref.save(update_fields=fields)
    return ref


@transaction.atomic
def detach_media_reference(*, actor: User, ref: MediaContentReference) -> MediaContentReference:
    """INV-DOM21-18 / TR-C2-06: Logical Detachment preserving MediaAsset and history."""
    _assert_context_mutable_and_authorized(
        actor,
        course_draft=ref.course_draft,
        published_version=ref.published_version,
        group_renewal_cycle=ref.group_renewal_cycle,
    )
    ref.detached_at = timezone.now()
    ref.save(update_fields=["detached_at"])
    record_audit_log(
        action="media.reference_detached",
        actor=actor,
        target_entity_type="MediaContentReference",
        target_entity_id=str(ref.id),
    )
    return ref


@transaction.atomic
def restore_media_reference(*, actor: User, ref: MediaContentReference) -> MediaContentReference:
    """TR-C2-06: Restore a logically detached MediaContentReference."""
    _assert_context_mutable_and_authorized(
        actor,
        course_draft=ref.course_draft,
        published_version=ref.published_version,
        group_renewal_cycle=ref.group_renewal_cycle,
    )
    ref.detached_at = None
    ref.save(update_fields=["detached_at"])
    record_audit_log(
        action="media.reference_restored",
        actor=actor,
        target_entity_type="MediaContentReference",
        target_entity_id=str(ref.id),
    )
    return ref


@transaction.atomic
def move_media_reference(
    *,
    actor: User,
    ref: MediaContentReference,
    target_course_draft: CourseDraft | None = None,
    target_group_renewal_cycle: GroupRenewalCycle | None = None,
) -> MediaContentReference:
    """TR-C2-06: Move reference between authorized mutable contexts preserving MediaAsset."""
    _assert_context_mutable_and_authorized(
        actor,
        course_draft=ref.course_draft,
        published_version=ref.published_version,
        group_renewal_cycle=ref.group_renewal_cycle,
    )
    _assert_context_mutable_and_authorized(
        actor,
        course_draft=target_course_draft,
        group_renewal_cycle=target_group_renewal_cycle,
    )
    ref.course_draft = target_course_draft
    ref.published_version = None
    ref.group_renewal_cycle = target_group_renewal_cycle
    ref.save(update_fields=["course_draft", "published_version", "group_renewal_cycle"])
    record_audit_log(
        action="media.reference_moved",
        actor=actor,
        target_entity_type="MediaContentReference",
        target_entity_id=str(ref.id),
    )
    return ref


@transaction.atomic
def delete_media_asset_if_unreferenced(
    *,
    actor: User,
    asset: MediaAsset,
    storage: LocalMediaStorage | None = None,
) -> None:
    """INV-DOM21-17 / TR-C2-07: Block deletion (409) if ANY reference exists (incl. detached/historical)."""
    if actor.role_id not in {"developer", "super_admin", "admin"}:
        raise MediaDomainError("PERMISSION_DENIED", "حذف الأصول غير المرتبطة مقتصر على مدير النظام.", 403)
    if MediaContentReference.objects.filter(media_asset=asset).exists():
        raise MediaDomainError(
            "ASSET_IN_USE",
            "لا يمكن حذف ملف الوسائط لوجود مراجع استخدام مرتبطة به (INV-DOM21-17).",
            409,
        )
    storage_key = asset.storage_key
    asset_id = asset.id
    asset.delete()
    (storage or LocalMediaStorage()).delete_stored_file(storage_key)
    record_audit_log(
        action="media.asset_deleted",
        actor=actor,
        target_entity_type="MediaAsset",
        target_entity_id=str(asset_id),
    )


def authorize_stream_reference(actor: User, ref: MediaContentReference) -> None:
    """Enforce logical detachment, INV-DOM21-15 immediate visibility, and group/course access before streaming."""
    if ref.detached_at is not None:
        raise MediaDomainError("REFERENCE_DETACHED", "هذا المحتوى لم يعد متاحًا للعرض.", 403)
    if actor.role_id in {"developer", "super_admin", "admin", "assistant_admin"}:
        return

    course = None
    if ref.course_draft_id is not None and ref.course_draft is not None:
        course = ref.course_draft.course
    elif ref.published_version_id is not None and ref.published_version is not None:
        course = ref.published_version.course

    if actor.role_id == "lecturer":
        if ref.group_renewal_cycle_id is not None:
            from apps.groups.models import GroupCourseAssignment

            cycle = ref.group_renewal_cycle
            if cycle is not None:
                is_group_lecturer = (
                    GroupAssistantAssignment.objects.filter(
                        training_group_id=cycle.training_group_id,
                        user=actor,
                    ).exists()
                    or GroupCourseAssignment.objects.filter(
                        group_renewal_cycle__training_group_id=cycle.training_group_id,
                        course__primary_lecturer=actor,
                    ).exists()
                )
                if not is_group_lecturer:
                    raise MediaDomainError("PERMISSION_DENIED", "غير مصرح لك بعرض ملفات هذه المجموعة التدريبية.", 403)
        elif course is not None:
            is_course_instructor = (
                course.primary_lecturer_id == actor.id
                or course.assistant_lecturers.filter(user=actor).exists()
            )
            if not is_course_instructor and (
                course.lifecycle_status != "Published"
                or (course.access_mode == "hidden" and ref.title != "__course_cover__")
            ):
                raise MediaDomainError("PERMISSION_DENIED", "غير مصرح لك بالوصول إلى محتوى هذا المقرر.", 403)
        return

    if actor.role_id == "trainee":
        if not ref.is_visible:
            raise MediaDomainError("REFERENCE_HIDDEN", "هذا المحتوى غير متاح للعرض حاليًا.", 403)
        if ref.group_renewal_cycle_id is not None:
            from apps.groups.models import GroupMembership

            cycle = ref.group_renewal_cycle
            if cycle is not None and not GroupMembership.objects.filter(
                training_group_id=cycle.training_group_id,
                user=actor,
            ).exists():
                raise MediaDomainError("PERMISSION_DENIED", "غير مصرح لك بعرض ملفات هذه المجموعة التدريبية.", 403)
        elif ref.title != "__course_cover__" and course is not None:
            if course.access_mode == "hidden" or course.lifecycle_status != "Published":
                from apps.learning.models import Enrollment

                if not Enrollment.objects.filter(user=actor, course=course, source_grants__isnull=False).exists():
                    raise MediaDomainError("PERMISSION_DENIED", "غير مصرح لك بالوصول إلى محتوى هذا المقرر.", 403)
            elif course.access_mode == "targeted":
                from apps.courses.services.course_service import is_course_visible_to_trainee

                if not is_course_visible_to_trainee(actor, course):
                    raise MediaDomainError("PERMISSION_DENIED", "غير مصرح لك بالوصول إلى محتوى هذا المقرر.", 403)

