"""MediaAsset & MediaContentReference domain services (INV-DOM21-05..21, TR-C2-06/07)."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.courses.models import CourseDraft, PublishedCourseVersion
from apps.courses.services.course_service import can_edit_course_draft
from apps.governance.services.governance_service import record_audit_log
from apps.groups.models import GroupAssistantAssignment, GroupRenewalCycle
from apps.identity.models import User
from apps.media.models import MediaAsset, MediaContentReference
from infrastructure.storage import LocalMediaStorage, MediaStorageError
from shared.permissions import evaluate_permission
from shared.validators import normalize_mime_type, normalize_nfc_stripped, validate_mime_type, validate_non_empty_text


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
    storage: LocalMediaStorage | None = None,
) -> MediaAsset:
    """Step 1: Validate, checksum, store binary, and create immutable MediaAsset."""
    decision = evaluate_permission(actor, "materials.upload_files")
    if not decision.granted and actor.role_id != "lecturer":
        raise MediaDomainError("PERMISSION_DENIED", decision.reason_ar, 403)

    raw_name = getattr(uploaded_file, "name", "") or "file"
    file_name = normalize_nfc_stripped(raw_name)[:255]
    validate_non_empty_text(file_name)

    raw_mime = declared_mime_type or getattr(uploaded_file, "content_type", "") or ""
    mime_type = normalize_mime_type(raw_mime.split(";")[0])
    try:
        validate_mime_type(mime_type)
    except Exception as exc:
        raise MediaDomainError("INVALID_MIME_TYPE", "صيغة MIME غير صالحة.", 400) from exc

    store = storage or LocalMediaStorage()
    try:
        storage_key, size_bytes, checksum = store.save_uploaded_file(uploaded_file, mime_type)
    except MediaStorageError as exc:
        raise MediaDomainError(exc.code, exc.message, exc.status_code) from exc

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
    return asset


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
    validate_non_empty_text(norm_title)
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
        validate_non_empty_text(norm)
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
    """Enforce logical detachment & INV-DOM21-15 immediate visibility before streaming."""
    if ref.detached_at is not None:
        raise MediaDomainError("REFERENCE_DETACHED", "هذا المحتوى لم يعد متاحًا للعرض.", 403)
    if actor.role_id == "trainee" and not ref.is_visible:
        raise MediaDomainError("REFERENCE_HIDDEN", "هذا المحتوى غير متاح للعرض حاليًا.", 403)

