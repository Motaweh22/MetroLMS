"""Review studio, approval queue, staged edits & working notes services."""
from __future__ import annotations

import copy
import json
from typing import Any

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.courses.api.serializers.courses import (
    CourseReviewSubmissionSerializer,
    CourseSerializer,
    PublishedCourseVersionSerializer,
)
from apps.courses.models import (
    Course,
    CourseAssistantLecturer,
    CourseDraft,
    CourseReviewSubmission,
    LessonItem,
    Module,
    PublishedCourseVersion,
    StagedAdminEdit,
    WorkingNote,
)
from apps.communications.services.communications_service import notify_users
from apps.courses.services.course_service import (
    CourseDomainError,
    decide_course_review,
    save_course_draft,
)
from apps.governance.models import AuditLogEntry
from apps.governance.services.governance_service import record_audit_log
from apps.identity.models import User
from apps.media.models import MediaContentReference
from shared.validators import normalize_nfc_preserve_whitespace, normalize_nfc_stripped

WORKING_NOTES_KIND = "reviewer_working_notes"
REVIEWER_ROLES = {"developer", "super_admin", "admin", "assistant_admin"}
DECIDER_ROLES = {"developer", "super_admin", "admin"}


def _parse_duration_to_seconds(val: Any) -> int:
    """Parse numeric seconds or 'MM:SS' / 'HH:MM:SS' duration string into non-negative seconds."""
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return max(0, int(val))
    raw = str(val or "").strip()
    if not raw:
        return 0
    if raw.isdigit():
        return max(0, int(raw))
    parts = raw.split(":")
    if all(p.isdigit() for p in parts):
        if len(parts) == 2:
            return max(0, int(parts[0]) * 60 + int(parts[1]))
        if len(parts) == 3:
            return max(0, int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2]))
    return 0


def _collect_course_curriculum_stats(course_ids: list[int]) -> tuple[dict[int, int], dict[int, int], dict[int, float]]:
    """Return (chapter_counts, lesson_counts, estimated_hours) per course ID without N+1 queries."""
    chapter_counts: dict[int, int] = {cid: 0 for cid in course_ids}
    lesson_counts: dict[int, int] = {cid: 0 for cid in course_ids}
    duration_seconds: dict[int, int] = {cid: 0 for cid in course_ids}
    if not course_ids:
        return chapter_counts, lesson_counts, {}

    draft_by_course: dict[int, int] = {}
    for d in CourseDraft.objects.filter(course_id__in=course_ids).only("id", "course_id"):
        draft_by_course.setdefault(d.course_id, d.id)

    pub_by_course: dict[int, int] = {}
    missing_draft_ids = [cid for cid in course_ids if cid not in draft_by_course]
    if missing_draft_ids:
        for p in PublishedCourseVersion.objects.filter(course_id__in=missing_draft_ids).order_by(
            "course_id", "-version_number"
        ).only("id", "course_id"):
            pub_by_course.setdefault(p.course_id, p.id)

    draft_to_course = {did: cid for cid, did in draft_by_course.items()}
    pub_to_course = {pid: cid for cid, pid in pub_by_course.items()}

    mod_filter = Q()
    if draft_to_course:
        mod_filter |= Q(course_draft_id__in=list(draft_to_course.keys()))
    if pub_to_course:
        mod_filter |= Q(published_version_id__in=list(pub_to_course.keys()))

    mod_to_course: dict[int, int] = {}
    if draft_to_course or pub_to_course:
        for mod in Module.objects.filter(mod_filter).only("id", "course_draft_id", "published_version_id"):
            cid = draft_to_course.get(mod.course_draft_id) or pub_to_course.get(mod.published_version_id)
            if cid is not None:
                mod_to_course[mod.id] = cid
                chapter_counts[cid] = chapter_counts.get(cid, 0) + 1

    if mod_to_course:
        for lesson in LessonItem.objects.filter(module_id__in=list(mod_to_course.keys())).only(
            "module_id", "duration_seconds"
        ):
            cid = mod_to_course.get(lesson.module_id)
            if cid is not None:
                lesson_counts[cid] = lesson_counts.get(cid, 0) + 1
                duration_seconds[cid] = duration_seconds.get(cid, 0) + max(0, int(lesson.duration_seconds or 0))

    estimated_hours = {
        cid: (round(sec / 3600, 1) if sec > 0 else 0)
        for cid, sec in duration_seconds.items()
    }
    return chapter_counts, lesson_counts, estimated_hours


def _serialize_staged_record(
    *,
    course_id: int,
    submission: CourseReviewSubmission,
    edit: StagedAdminEdit,
) -> dict[str, Any] | None:
    """Normalize a StagedAdminEdit row into StagedAdminEditsRecord DTO."""
    raw = edit.edit_payload_json if isinstance(edit.edit_payload_json, dict) else {}
    if "patchedContent" in raw:
        patched = raw.get("patchedContent") if isinstance(raw.get("patchedContent"), dict) else {}
        baseline_id = str(raw.get("baselineId") or course_id)
        baseline_submitted_at = str(raw.get("baselineSubmittedAt") or "")
        client_rev = int(raw.get("clientRevision") or 1)
        last_saved_at = str(raw.get("lastSavedAt") or edit.created_at.isoformat())
        saved_by = str(raw.get("savedByAdminId") or "")
    else:
        patched = raw
        baseline_id = str(course_id)
        baseline_submitted_at = submission.submitted_at.isoformat() if submission.submitted_at else ""
        client_rev = 1
        last_saved_at = edit.created_at.isoformat() if edit.created_at else timezone.now().isoformat()
        saved_by = ""

    if not patched:
        return None

    sub_submitted_iso = submission.submitted_at.isoformat() if submission.submitted_at else ""
    is_stale = bool(baseline_submitted_at and sub_submitted_iso and baseline_submitted_at != sub_submitted_iso)
    return {
        "courseId": str(course_id),
        "baselineId": baseline_id,
        "baselineSubmittedAt": baseline_submitted_at or sub_submitted_iso,
        "clientRevision": client_rev,
        "patchedContent": patched,
        "lastSavedAt": last_saved_at,
        "savedByAdminId": saved_by,
        "isStale": is_stale,
    }


def _find_course_submission(course: Course, *, prefer_pending: bool = True) -> CourseReviewSubmission | None:
    qs = CourseReviewSubmission.objects.filter(course=course).select_related(
        "submitted_by_user", "reviewed_by_user"
    )
    if prefer_pending:
        pending = qs.filter(review_status="Pending").order_by("-submitted_at", "-id").first()
        if pending is not None:
            return pending
    return qs.order_by("-submitted_at", "-id").first()


def _parse_working_note_envelope(row: WorkingNote) -> dict[str, Any] | None:
    body = row.note_body or ""
    if not body.startswith("{"):
        return None
    try:
        data = json.loads(body)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict) or data.get("__kind") != WORKING_NOTES_KIND:
        return None
    return data


def get_working_notes_for_course(
    course: Course,
    reviewer: User,
    *,
    submission: CourseReviewSubmission | None = None,
) -> dict[str, Any] | None:
    """Load private ReviewerWorkingNotes for reviewer on course's active/latest submission."""
    sub = submission or _find_course_submission(course, prefer_pending=True)
    if sub is None:
        return None

    notes_rows = list(WorkingNote.objects.filter(submission=sub).order_by("-created_at", "-id"))
    reviewer_key = str(reviewer.id)
    matched: dict[str, Any] | None = None
    matched_row: WorkingNote | None = None
    fallback: dict[str, Any] | None = None
    fallback_row: WorkingNote | None = None

    for row in notes_rows:
        env = _parse_working_note_envelope(row)
        if env is None:
            continue
        if str(env.get("reviewerId") or "") == reviewer_key:
            matched = env
            matched_row = row
            break
        if fallback is None:
            fallback = env
            fallback_row = row

    chosen = matched or fallback
    chosen_row = matched_row or fallback_row
    if chosen is None or chosen_row is None:
        return None

    return {
        "courseId": str(course.id),
        "reviewerId": reviewer_key,
        "generalNote": str(chosen.get("generalNote") or ""),
        "chapterNotes": chosen.get("chapterNotes") if isinstance(chosen.get("chapterNotes"), dict) else {},
        "itemNotes": chosen.get("itemNotes") if isinstance(chosen.get("itemNotes"), dict) else {},
        "lastSavedAt": str(chosen.get("lastSavedAt") or chosen_row.created_at.isoformat()),
    }


@transaction.atomic
def save_working_notes_for_course(
    *,
    course: Course,
    reviewer: User,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Persist private ReviewerWorkingNotes in WorkingNote for course's active/latest submission."""
    sub = _find_course_submission(course, prefer_pending=True)
    if sub is None:
        raise CourseDomainError(
            "NO_REVIEW_SUBMISSION",
            "لا يوجد طلب مراجعة مرتبط بهذا المقرر لحفظ الملاحظات الخاصة.",
            status_code=409,
        )

    now = timezone.now()
    now_iso = now.isoformat()
    reviewer_key = str(reviewer.id)

    general_raw = payload.get("generalNote") if "generalNote" in payload else payload.get("noteBody", "")
    general_note = normalize_nfc_preserve_whitespace(str(general_raw or "")).strip()
    chapter_notes = (
        {str(k): str(v).strip() for k, v in payload.get("chapterNotes", {}).items() if str(v or "").strip()}
        if isinstance(payload.get("chapterNotes"), dict)
        else {}
    )
    item_notes = (
        {str(k): str(v).strip() for k, v in payload.get("itemNotes", {}).items() if str(v or "").strip()}
        if isinstance(payload.get("itemNotes"), dict)
        else {}
    )

    envelope = {
        "__kind": WORKING_NOTES_KIND,
        "courseId": str(course.id),
        "reviewerId": reviewer_key,
        "generalNote": general_note,
        "chapterNotes": chapter_notes,
        "itemNotes": item_notes,
        "lastSavedAt": now_iso,
    }
    serialized = json.dumps(envelope, ensure_ascii=False)

    existing_row: WorkingNote | None = None
    for row in WorkingNote.objects.select_for_update().filter(submission=sub).order_by("-id"):
        env = _parse_working_note_envelope(row)
        if env is not None and str(env.get("reviewerId") or "") in {reviewer_key, ""}:
            existing_row = row
            break

    if existing_row is not None:
        existing_row.note_body = serialized
        existing_row.created_at = now
        existing_row.save(update_fields=["note_body", "created_at"])
    else:
        WorkingNote.objects.create(submission=sub, note_body=serialized, created_at=now)

    return {
        "courseId": str(course.id),
        "reviewerId": reviewer_key,
        "generalNote": general_note,
        "chapterNotes": chapter_notes,
        "itemNotes": item_notes,
        "lastSavedAt": now_iso,
    }


@transaction.atomic
def delete_working_notes_for_course(*, course: Course, reviewer: User) -> int:
    """Delete reviewer's private WorkingNote envelope(s) for course."""
    sub = _find_course_submission(course, prefer_pending=True)
    if sub is None:
        return 0
    reviewer_key = str(reviewer.id)
    deleted = 0
    for row in WorkingNote.objects.select_for_update().filter(submission=sub):
        env = _parse_working_note_envelope(row)
        if env is not None and str(env.get("reviewerId") or "") in {reviewer_key, ""}:
            row.delete()
            deleted += 1
    return deleted


def get_staged_edits_record(
    course: Course,
    *,
    submission: CourseReviewSubmission | None = None,
) -> dict[str, Any] | None:
    """Return latest StagedAdminEditsRecord DTO for course's pending/latest submission."""
    sub = submission or _find_course_submission(course, prefer_pending=True)
    if sub is None:
        return None
    edit = StagedAdminEdit.objects.filter(submission=sub).order_by("-id").first()
    if edit is None:
        return None
    return _serialize_staged_record(course_id=course.id, submission=sub, edit=edit)


class StagedEditConflictError(CourseDomainError):
    """HTTP 409 conflict carrying authoritative server StagedAdminEditsRecord."""

    def __init__(self, server_record: dict[str, Any] | None) -> None:
        super().__init__(
            "STAGED_EDIT_CONFLICT",
            "تعارض في نسخة التعديلات المؤقتة؛ توجد نسخة أحدث على الخادم.",
            status_code=409,
        )
        self.server_record = server_record


@transaction.atomic
def save_staged_edits_record(
    *,
    course: Course,
    actor: User,
    payload: dict[str, Any],
) -> tuple[StagedAdminEdit, dict[str, Any]]:
    """Save staged admin edits with optimistic revision concurrency checking."""
    sub = _find_course_submission(course, prefer_pending=True)
    if sub is None or sub.review_status != "Pending":
        raise CourseDomainError(
            "ALREADY_DECIDED",
            "لا يوجد طلب مراجعة قيد الانتظار لهذا المقرر.",
            status_code=409,
        )

    existing_edit = StagedAdminEdit.objects.select_for_update().filter(submission=sub).order_by("-id").first()
    existing_record = (
        _serialize_staged_record(course_id=course.id, submission=sub, edit=existing_edit)
        if existing_edit is not None
        else None
    )
    current_rev = int(existing_record["clientRevision"]) if existing_record is not None else 0

    if "patch" in payload or "patchedContent" in payload or "clientRevision" in payload:
        patched = payload.get("patch") if "patch" in payload else payload.get("patchedContent")
        if not isinstance(patched, dict):
            patched = {}
        raw_rev = payload.get("clientRevision")
        try:
            target_rev = int(raw_rev) if raw_rev is not None else current_rev + 1
        except (TypeError, ValueError):
            raise CourseDomainError("VALIDATION_ERROR", "قيمة clientRevision غير صالحة.", status_code=400)

        if target_rev != current_rev + 1:
            raise StagedEditConflictError(existing_record)
    else:
        # Backward-compatible payload mode (e.g. POST {"payload": {...}} or {"editPayload": {...}})
        raw_legacy = payload.get("payload") if "payload" in payload else payload.get("editPayload")
        if not isinstance(raw_legacy, dict) or not raw_legacy:
            raise CourseDomainError("VALIDATION_ERROR", "بيانات التعديل المؤقت مطلوبة.", status_code=400)
        patched = raw_legacy
        target_rev = current_rev + 1

    now = timezone.now()
    sub_submitted_iso = sub.submitted_at.isoformat() if sub.submitted_at else ""
    baseline_id = str(payload.get("baselineId") or course.id)
    baseline_submitted_at = str(payload.get("baselineSubmittedAt") or sub_submitted_iso)
    record_json = {
        "courseId": str(course.id),
        "baselineId": baseline_id,
        "baselineSubmittedAt": baseline_submitted_at,
        "clientRevision": target_rev,
        "patchedContent": patched,
        "lastSavedAt": now.isoformat(),
        "savedByAdminId": str(actor.id),
    }

    if existing_edit is not None:
        existing_edit.edit_payload_json = record_json
        existing_edit.created_at = now
        existing_edit.save(update_fields=["edit_payload_json", "created_at"])
        edit_obj = existing_edit
    else:
        edit_obj = StagedAdminEdit.objects.create(
            submission=sub,
            edit_payload_json=record_json,
            created_at=now,
        )

    record_out = _serialize_staged_record(course_id=course.id, submission=sub, edit=edit_obj) or record_json
    return edit_obj, record_out


@transaction.atomic
def clear_staged_edits_record(*, course: Course) -> int:
    """Discard staged edits for course's active/latest submission."""
    sub = _find_course_submission(course, prefer_pending=True)
    if sub is None:
        return 0
    deleted_count, _ = StagedAdminEdit.objects.filter(submission=sub).delete()
    return deleted_count


def _build_course_snapshot(
    course: Course,
    course_data: dict[str, Any],
    *,
    submitted_at: str | None = None,
) -> dict[str, Any]:
    return {
        "id": str(course_data.get("id", course.id)),
        "title": course_data.get("title", course.title),
        "description": course_data.get("description") or "",
        "level": course_data.get("level") or "مبتدئ",
        "estimatedHours": course_data.get("estimatedHours", 0),
        "thumbnail": course_data.get("thumbnail"),
        "coverType": course_data.get("coverType") or "default",
        "coverColor": course_data.get("coverColor"),
        "targetJobTitles": list(course_data.get("targetJobTitles") or []),
        "targetDepartmentIds": list(course_data.get("targetDepartmentIds") or []),
        "targetJobTitleIds": list(course_data.get("targetJobTitleIds") or []),
        "targetMetroLineIds": list(course_data.get("targetMetroLineIds") or []),
        "targetLeadershipTitles": list(course_data.get("targetLeadershipTitles") or []),
        "accessMode": course_data.get("accessMode") or "targeted",
        "qrSettings": course_data.get("qrSettings"),
        "courseZipPolicy": course_data.get("courseZipPolicy") or "disabled",
        "chapters": copy.deepcopy(course_data.get("chapters") or []),
        "capturedAt": timezone.now().isoformat(),
        "submittedAt": submitted_at,
    }


def _apply_patched_content_to_snapshot(snapshot: dict[str, Any], patched: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(snapshot)
    for key, val in patched.items():
        if val is not None:
            merged[key] = copy.deepcopy(val)
    if "chapters" in merged and isinstance(merged["chapters"], list):
        merged["modules"] = merged["chapters"]
    return merged


def _convert_patched_chapters_to_modules(chapters: list[Any]) -> list[dict[str, Any]]:
    modules_out: list[dict[str, Any]] = []
    for m_idx, ch in enumerate(chapters):
        if not isinstance(ch, dict):
            continue
        raw_items = ch.get("items") if ch.get("items") is not None else ch.get("lessons", [])
        lessons_out: list[dict[str, Any]] = []
        for l_idx, item in enumerate(raw_items or []):
            if not isinstance(item, dict):
                continue
            if isinstance(item.get("duration"), str) and item["duration"].strip():
                dur_sec = _parse_duration_to_seconds(item["duration"])
            else:
                dur_sec = item.get("durationSeconds")
            raw_item_url = str(item.get("url") or "").strip()
            raw_url = str(
                (raw_item_url if raw_item_url.startswith("https://") else "")
                or item.get("externalVideoUrl")
                or item.get("externalUrl")
                or raw_item_url
            ).strip()
            media_id = None if raw_url.startswith("https://") else (item.get("mediaId") or item.get("mediaAssetId"))
            ext_url = "" if (media_id or raw_url.startswith("/api/media/")) else raw_url
            lessons_out.append(
                {
                    "title": item.get("title") or "درس جديد",
                    "lessonType": item.get("lessonType") or item.get("type") or "video",
                    "sortOrder": item.get("sortOrder", l_idx),
                    "durationSeconds": max(0, int(dur_sec or 0)),
                    "externalVideoUrl": ext_url or None,
                    "mediaId": media_id,
                    "downloadPolicy": item.get("downloadPolicy") or ("immediate" if item.get("canDownload") else "never"),
                    "quiz": item.get("quiz"),
                }
            )
        modules_out.append(
            {
                "title": ch.get("title") or "فصل جديد",
                "sortOrder": ch.get("sortOrder", m_idx),
                "lessons": lessons_out,
            }
        )
    return modules_out


def _apply_staged_patch_to_course_and_draft(*, course: Course, patched: dict[str, Any], actor: User) -> None:
    """Persist staged admin edits onto Course and CourseDraft."""
    now = timezone.now()
    course_update_fields: list[str] = []

    if isinstance(patched.get("title"), str) and patched["title"].strip():
        course.title = normalize_nfc_stripped(patched["title"])
        course_update_fields.append("title")
    if "description" in patched and isinstance(patched["description"], str):
        course.description = normalize_nfc_preserve_whitespace(patched["description"])
        course_update_fields.append("description")
    if course_update_fields:
        course.updated_at = now
        course_update_fields.append("updated_at")
        course.save(update_fields=course_update_fields)

    draft = CourseDraft.objects.filter(course=course).first()
    raw_chapters = patched.get("chapters") if "chapters" in patched else patched.get("modules")
    if isinstance(raw_chapters, list):
        cover_asset_id: int | None = None
        if draft is not None:
            cover_ref = MediaContentReference.objects.filter(
                course_draft=draft, title="__course_cover__", detached_at__isnull=True
            ).first()
            if cover_ref is not None:
                cover_asset_id = cover_ref.media_asset_id
        save_course_draft(
            actor=actor,
            course=course,
            title_snapshot=course.title,
            modules_payload=_convert_patched_chapters_to_modules(raw_chapters),
            thumbnail_asset_id=cover_asset_id,
            course_zip_policy=patched.get("courseZipPolicy"),
            cover_type=patched.get("coverType"),
            cover_color=patched.get("coverColor"),
        )
    elif draft is not None:
        draft_fields = ["title_snapshot", "updated_at", "updated_by_user"]
        draft.title_snapshot = course.title
        draft.updated_at = now
        draft.updated_by_user = actor
        if isinstance(patched.get("courseZipPolicy"), str) and patched["courseZipPolicy"] in {
            "disabled",
            "immediate",
            "after_course_completion",
        }:
            draft.course_zip_policy = patched["courseZipPolicy"]
            draft_fields.append("course_zip_policy")
        if isinstance(patched.get("coverType"), str) and patched["coverType"] in {
            "image",
            "color",
            "default",
        }:
            draft.cover_type = patched["coverType"]
            draft_fields.append("cover_type")
        if "coverColor" in patched:
            raw_col = str(patched.get("coverColor") or "").strip()
            if not raw_col:
                draft.cover_color = None
                draft_fields.append("cover_color")
            else:
                import re as _re_color

                if _re_color.match(r"^#[0-9A-Fa-f]{3,8}$", raw_col):
                    draft.cover_color = raw_col.upper()
                    draft_fields.append("cover_color")
        draft.save(update_fields=draft_fields)


def _format_audit_entry(entry: AuditLogEntry, *, viewer_role: str, course_id: int, users_map: dict[str, User]) -> dict[str, Any] | None:
    """Convert an AuditLogEntry into CourseAuditLogEntry DTO, enforcing developer masking."""
    snap = entry.details_snapshot_json if isinstance(entry.details_snapshot_json, dict) else {}
    action_map = {
        "course.review_submitted": "submitted",
        "course.review_approved": "approved",
        "course.review_returned_with_admin_edits": "returned_with_admin_edits",
        "course.review_rejected": "rejected",
    }
    mapped_action = snap.get("auditAction") or action_map.get(entry.action)
    if mapped_action not in {"submitted", "resubmitted", "approved", "returned_with_admin_edits", "rejected"}:
        return None

    masked = bool(entry.is_developer_masked and viewer_role != "developer")
    actor_user = users_map.get(str(entry.actor_user_id or ""))
    if masked:
        actor_name = "إدارة النظام"
        actor_id = "system"
        actor_role = "admin"
    else:
        actor_name = snap.get("actorName") or (actor_user.full_name if actor_user else "مستخدم محذوف")
        actor_id = str(entry.actor_user_id or "")
        raw_role = entry.actor_role_snapshot or (actor_user.role_id if actor_user else "admin")
        actor_role = "lecturer" if raw_role == "lecturer" else "admin"

    out: dict[str, Any] = {
        "id": str(entry.id),
        "courseId": str(course_id),
        "action": mapped_action,
        "actorId": actor_id,
        "actorName": actor_name,
        "actorRole": actor_role,
        "timestamp": entry.created_at.isoformat() if entry.created_at else "",
        "summary": str(snap.get("summary") or entry.reason or ""),
    }
    if snap.get("approvalNote"):
        out["approvalNote"] = snap["approvalNote"]
    if isinstance(snap.get("feedback"), dict):
        fb = copy.deepcopy(snap["feedback"])
        if masked:
            fb["reviewerId"] = "system"
            fb["reviewerName"] = "إدارة النظام"
        out["feedback"] = fb
    if isinstance(snap.get("baselineSnapshot"), dict):
        out["baselineSnapshot"] = snap["baselineSnapshot"]
    if isinstance(snap.get("adminEditedSnapshot"), dict):
        out["adminEditedSnapshot"] = snap["adminEditedSnapshot"]
    return out


def get_course_audit_log(course: Course, *, viewer: User) -> list[dict[str, Any]]:
    """Fetch CourseAuditLogEntry list for a course from AuditLogEntry."""
    sub_ids = [
        str(sid)
        for sid in CourseReviewSubmission.objects.filter(course=course).values_list("id", flat=True)
    ]
    q = Q(target_entity_type="Course", target_entity_id=str(course.id))
    if sub_ids:
        q |= Q(target_entity_type="CourseReviewSubmission", target_entity_id__in=sub_ids)

    entries = list(
        AuditLogEntry.objects.filter(
            q,
            action__in=[
                "course.review_submitted",
                "course.review_approved",
                "course.review_returned_with_admin_edits",
                "course.review_rejected",
            ],
        ).order_by("-created_at", "-id")
    )
    user_ids = {int(e.actor_user_id) for e in entries if e.actor_user_id and str(e.actor_user_id).isdigit()}
    users_map = {str(u.id): u for u in User.objects.filter(id__in=user_ids).only("id", "full_name", "role_id")}
    viewer_role = getattr(viewer, "role_id", "trainee") or "trainee"

    result: list[dict[str, Any]] = []
    for entry in entries:
        formatted = _format_audit_entry(entry, viewer_role=viewer_role, course_id=course.id, users_map=users_map)
        if formatted is not None:
            result.append(formatted)
    return result


def notify_course_review_decision(
    *,
    course: Course,
    reviewer: User,
    outcome: str,
    summary_message: str = "",
) -> int:
    """Resolve pending admin review notifications and notify course lecturers of decision."""
    from apps.communications.services.communications_service import (
        resolve_pending_course_review_notifications,
    )

    resolve_pending_course_review_notifications(
        course_id=course.id,
        outcome=outcome,
        reviewer=reviewer,
    )

    lecturers: list[User] = []
    if course.primary_lecturer is not None and course.primary_lecturer.status == "Active":
        lecturers.append(course.primary_lecturer)
    for rel in CourseAssistantLecturer.objects.filter(course=course).select_related("user"):
        if rel.user is not None and rel.user.status == "Active":
            lecturers.append(rel.user)

    if not lecturers:
        return 0

    if outcome == "approved":
        notif_type = "content_approved"
        title = f"تم اعتماد ونشر المقرر: {course.title}"
        body = f"اعتمد المراجع «{reviewer.full_name}» المقرر «{course.title}» وتم نشره بنجاح."
        target_url = f"/courses/{course.id}"
        action_required = False
    else:
        notif_type = "content_rejected"
        title = f"ملاحظات مراجعة على المقرر: {course.title}"
        clean_msg = summary_message.strip()
        body = (
            f"أعاد «{reviewer.full_name}» المقرر «{course.title}» للمراجعة: {clean_msg}"
            if clean_msg
            else f"أعاد «{reviewer.full_name}» المقرر «{course.title}» لإجراء التعديلات المطلوبة."
        )
        target_url = f"/lecturer/builder/{course.id}"
        action_required = True

    return notify_users(
        users=lecturers,
        title=title,
        body=body,
        notif_type=notif_type,
        target_url=target_url,
        action_required=action_required,
        metadata={
            "courseId": str(course.id),
            "outcome": outcome,
            "actorId": str(reviewer.id),
            "actorName": reviewer.full_name,
            "actorRole": reviewer.role_id,
        },
        exclude_user_id=reviewer.id,
    )


def get_active_review_feedback(
    course: Course,
    *,
    latest_sub: CourseReviewSubmission | None,
    audit_log: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Return official feedback when the latest submission was returned for revision."""
    if latest_sub is None or latest_sub.review_status != "ReturnedForRevision":
        return None
    for entry in audit_log:
        if entry.get("feedback"):
            return entry["feedback"]
    return None


@transaction.atomic
def execute_review_decision(
    *,
    course: Course,
    reviewer: User,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Execute approve / return_with_edits / reject decision and record audit trail."""
    raw_outcome = str(payload.get("outcome") or payload.get("decision") or "").strip().lower()
    outcome_map = {
        "approved": "approved",
        "approve": "approved",
        "returned_with_admin_edits": "returned_with_admin_edits",
        "return_with_edits": "returned_with_admin_edits",
        "rejected": "rejected",
        "reject": "rejected",
        "return": "rejected",
    }
    outcome = outcome_map.get(raw_outcome)
    if outcome is None:
        raise CourseDomainError(
            "INVALID_DECISION",
            "القرار غير صالح. القيم المسموحة: approved أو returned_with_admin_edits أو rejected.",
            status_code=400,
        )

    sub = _find_course_submission(course, prefer_pending=True)
    if sub is None or sub.review_status != "Pending":
        raise CourseDomainError(
            "ALREADY_DECIDED",
            "لا يوجد طلب مراجعة قيد الانتظار لهذا المقرر.",
            status_code=409,
        )

    summary_message = normalize_nfc_preserve_whitespace(
        str(payload.get("summaryMessage") or payload.get("noteBody") or "")
    ).strip()
    approval_note = normalize_nfc_preserve_whitespace(str(payload.get("approvalNote") or "")).strip()
    publish_option = str(payload.get("publishOption") or "with_staged_edits").strip()
    items = payload.get("items") if isinstance(payload.get("items"), list) else []

    staged_record = get_staged_edits_record(course, submission=sub)
    patched = staged_record["patchedContent"] if staged_record and isinstance(staged_record.get("patchedContent"), dict) else {}
    has_staged = bool(patched)

    if outcome == "returned_with_admin_edits":
        if not has_staged:
            raise CourseDomainError(
                "STAGED_EDITS_REQUIRED",
                "لا يمكن إعادة المقرر بتعديلات الإدارة لعدم وجود تعديلات مؤقتة محفوظة.",
                status_code=400,
            )
        if not summary_message:
            raise CourseDomainError(
                "VALIDATION_ERROR",
                "رسالة التغذية الراجعة للمحاضر مطلوبة عند إعادة المقرر بتعديلات الإدارة.",
                status_code=400,
            )
    elif outcome == "rejected" and "outcome" in payload and not summary_message:
        raise CourseDomainError(
            "VALIDATION_ERROR",
            "سبب الإعادة والتغذية الراجعة للمحاضر مطلوبة.",
            status_code=400,
        )

    sub_submitted_iso = sub.submitted_at.isoformat() if sub.submitted_at else None
    baseline_data = CourseSerializer(course).data
    baseline_snapshot = _build_course_snapshot(course, baseline_data, submitted_at=sub_submitted_iso)
    admin_edited_snapshot: dict[str, Any] | None = None
    applied_edits = False

    if outcome == "returned_with_admin_edits" or (
        outcome == "approved" and publish_option == "with_staged_edits" and has_staged
    ):
        _apply_staged_patch_to_course_and_draft(course=course, patched=patched, actor=reviewer)
        course.refresh_from_db()
        edited_data = CourseSerializer(course).data
        admin_edited_snapshot = _build_course_snapshot(course, edited_data, submitted_at=sub_submitted_iso)
        applied_edits = True

    core_decision = "approve" if outcome == "approved" else "return"
    note_to_store = approval_note if outcome == "approved" else summary_message
    sub, pub_ver = decide_course_review(
        reviewer=reviewer,
        submission=sub,
        decision=core_decision,
        note_body=note_to_store or None,
    )

    # Clear staged edits once a formal decision has finalized this submission
    StagedAdminEdit.objects.filter(submission=sub).delete()

    now_iso = timezone.now().isoformat()
    feedback_obj: dict[str, Any] | None = None
    if outcome in {"returned_with_admin_edits", "rejected"}:
        feedback_obj = {
            "outcome": outcome,
            "reviewerId": str(reviewer.id),
            "reviewerName": reviewer.full_name,
            "reviewedAt": now_iso,
            "summaryMessage": summary_message,
            "items": items,
            "stagedEditsApplied": applied_edits,
        }

    summary_by_outcome = {
        "approved": "تم اعتماد ونشر المقرر التدريبي بنجاح.",
        "returned_with_admin_edits": "تمت إعادة المقرر للمحاضر مع تعديلات الإدارة.",
        "rejected": "تمت إعادة المقرر للمحاضر لطلب التعديلات.",
    }
    audit_snapshot: dict[str, Any] = {
        "courseId": course.id,
        "submissionId": sub.id,
        "outcome": outcome,
        "auditAction": outcome,
        "actorName": reviewer.full_name,
        "summary": summary_message or approval_note or summary_by_outcome[outcome],
        "baselineSnapshot": baseline_snapshot,
    }
    if approval_note:
        audit_snapshot["approvalNote"] = approval_note
    if feedback_obj is not None:
        audit_snapshot["feedback"] = feedback_obj
    if admin_edited_snapshot is not None:
        audit_snapshot["adminEditedSnapshot"] = admin_edited_snapshot

    audit_row = record_audit_log(
        action=f"course.review_{outcome}",
        actor=reviewer,
        target_entity_type="Course",
        target_entity_id=str(course.id),
        details_snapshot=audit_snapshot,
        reason=summary_message or approval_note or None,
    )

    viewer_role = getattr(reviewer, "role_id", "admin") or "admin"
    audit_entry_dto = _format_audit_entry(
        audit_row,
        viewer_role=viewer_role,
        course_id=course.id,
        users_map={str(reviewer.id): reviewer},
    )

    course.refresh_from_db()
    notify_course_review_decision(
        course=course,
        reviewer=reviewer,
        outcome=outcome,
        summary_message=summary_message or approval_note,
    )
    course_data = CourseSerializer(course).data
    course_data["submittedAt"] = sub_submitted_iso
    if feedback_obj is not None:
        course_data["activeReviewFeedback"] = feedback_obj

    return {
        "course": course_data,
        "submission": CourseReviewSubmissionSerializer(sub).data,
        "publishedVersion": PublishedCourseVersionSerializer(pub_ver).data if pub_ver is not None else None,
        "outcome": outcome,
        "message": summary_by_outcome[outcome],
        "auditEntry": audit_entry_dto,
    }


def build_review_queue_payload() -> dict[str, Any]:
    """Build enriched admin/quality review queue payload matching ReviewQueueResponseDTO."""
    pending_all = list(
        CourseReviewSubmission.objects.filter(review_status="Pending")
        .select_related("course", "course__primary_lecturer", "submitted_by_user")
        .order_by("-submitted_at", "-id")
    )

    deduped: list[CourseReviewSubmission] = []
    seen_courses: set[int] = set()
    for sub in pending_all:
        if sub.course_id not in seen_courses:
            seen_courses.add(sub.course_id)
            deduped.append(sub)

    course_ids = [s.course_id for s in deduped]
    sub_ids = [s.id for s in deduped]

    published_ids: set[int] = set()
    staged_sub_ids: set[int] = set()
    if course_ids:
        published_ids = set(
            PublishedCourseVersion.objects.filter(course_id__in=course_ids).values_list("course_id", flat=True)
        )
    if sub_ids:
        for edit in StagedAdminEdit.objects.filter(submission_id__in=sub_ids).only("submission_id", "edit_payload_json"):
            raw = edit.edit_payload_json if isinstance(edit.edit_payload_json, dict) else {}
            patched = raw.get("patchedContent") if "patchedContent" in raw else raw
            if isinstance(patched, dict) and bool(patched):
                staged_sub_ids.add(edit.submission_id)

    ch_counts, ls_counts, est_hours = _collect_course_curriculum_stats(course_ids)

    items: list[dict[str, Any]] = []
    for sub in deduped:
        course = sub.course
        lecturer_name = (
            course.primary_lecturer.full_name
            if course.primary_lecturer
            else (sub.submitted_by_user.full_name if sub.submitted_by_user else "مستخدم محذوف")
        )
        submitter_name = sub.submitted_by_user.full_name if sub.submitted_by_user else "مستخدم محذوف"
        items.append(
            {
                "id": str(course.id),
                "courseId": str(course.id),
                "submissionId": str(sub.id),
                "title": course.title,
                "courseTitle": course.title,
                "description": course.description or "",
                "courseType": course.course_type,
                "submissionType": "update" if course.id in published_ids else "new",
                "lecturerId": str(course.primary_lecturer_id) if course.primary_lecturer_id else "",
                "lecturerName": lecturer_name,
                "submittedBy": submitter_name,
                "submittedAt": sub.submitted_at.isoformat() if sub.submitted_at else None,
                "status": "pending_admin",
                "reviewStatus": sub.review_status,
                "chapterCount": ch_counts.get(course.id, 0),
                "lessonCount": ls_counts.get(course.id, 0),
                "estimatedHours": est_hours.get(course.id, 0),
                "hasStagedEdits": sub.id in staged_sub_ids,
            }
        )

    return {"items": items, "queue": items, "totalCount": len(items)}


def build_my_submissions_payload(actor: User) -> dict[str, Any]:
    """Build lecturer submissions & drafts payload matching LecturerSubmissionsResponseDTO."""
    submitted_course_ids = list(
        CourseReviewSubmission.objects.filter(submitted_by_user=actor).values_list("course_id", flat=True).distinct()
    )
    courses = list(
        Course.objects.filter(Q(primary_lecturer=actor) | Q(id__in=submitted_course_ids))
        .select_related("primary_lecturer")
        .order_by("-updated_at", "-id")
        .distinct()
    )
    course_ids = [c.id for c in courses]

    latest_sub_by_course: dict[int, CourseReviewSubmission] = {}
    if course_ids:
        for sub in (
            CourseReviewSubmission.objects.filter(course_id__in=course_ids)
            .select_related("submitted_by_user", "reviewed_by_user")
            .order_by("course_id", "-submitted_at", "-id")
        ):
            latest_sub_by_course.setdefault(sub.course_id, sub)

    ch_counts, ls_counts, _ = _collect_course_curriculum_stats(course_ids)

    returned_course_ids = [
        str(cid) for cid, sub in latest_sub_by_course.items() if sub.review_status == "ReturnedForRevision"
    ]
    feedback_by_course: dict[str, dict[str, Any]] = {}
    if returned_course_ids:
        for log in AuditLogEntry.objects.filter(
            target_entity_type="Course",
            target_entity_id__in=returned_course_ids,
            action__in=["course.review_returned_with_admin_edits", "course.review_rejected"],
        ).order_by("-created_at", "-id"):
            cid_str = str(log.target_entity_id or "")
            if cid_str in feedback_by_course:
                continue
            snap = log.details_snapshot_json if isinstance(log.details_snapshot_json, dict) else {}
            fb = snap.get("feedback")
            if isinstance(fb, dict):
                fb_copy = copy.deepcopy(fb)
                if log.is_developer_masked and actor.role_id != "developer":
                    fb_copy["reviewerId"] = "system"
                    fb_copy["reviewerName"] = "إدارة النظام"
                feedback_by_course[cid_str] = fb_copy

    items: list[dict[str, Any]] = []
    counts = {"pending": 0, "needsRevision": 0, "approved": 0, "draft": 0}

    for course in courses:
        sub = latest_sub_by_course.get(course.id)
        if sub is not None and sub.review_status == "Pending":
            review_state = "pending"
            ui_status = "pending_admin"
            counts["pending"] += 1
        elif sub is not None and sub.review_status == "ReturnedForRevision":
            review_state = "needs_revision"
            ui_status = "rejected"
            counts["needsRevision"] += 1
        elif course.lifecycle_status == "Published" or (sub is not None and sub.review_status == "Approved"):
            review_state = "approved"
            ui_status = "published"
            counts["approved"] += 1
        else:
            review_state = "draft"
            ui_status = "draft"
            counts["draft"] += 1

        fb = feedback_by_course.get(str(course.id)) if review_state == "needs_revision" else None
        is_update_pending = bool(
            course.lifecycle_status == "Published" and sub is not None and sub.review_status == "Pending"
        )
        items.append(
            {
                "id": str(course.id),
                "courseId": str(course.id),
                "submissionId": str(sub.id) if sub is not None else None,
                "title": course.title,
                "courseTitle": course.title,
                "reviewState": review_state,
                "status": ui_status,
                "submittedAt": sub.submitted_at.isoformat() if (sub is not None and sub.submitted_at) else None,
                "updatedAt": course.updated_at.isoformat() if course.updated_at else None,
                "chapterCount": ch_counts.get(course.id, 0),
                "lessonCount": ls_counts.get(course.id, 0),
                "isUpdatePendingApproval": is_update_pending,
                "activeReviewFeedback": fb,
                "decisionNotes": str(fb.get("summaryMessage") or "") if isinstance(fb, dict) else "",
            }
        )

    return {"items": items, "submissions": items, "counts": counts}


def build_course_review_data_payload(course: Course, actor: User) -> dict[str, Any]:
    """Build complete CourseReviewDataResponseDTO for Review Studio & CourseBuilder."""
    latest_sub = _find_course_submission(course, prefer_pending=True)
    has_published = PublishedCourseVersion.objects.filter(course=course).exists()
    submission_type = "update" if has_published else "new"
    is_published_update = bool(
        course.lifecycle_status == "Published" and latest_sub is not None and latest_sub.review_status == "Pending"
    )

    audit_log = get_course_audit_log(course, viewer=actor)
    active_feedback = get_active_review_feedback(course, latest_sub=latest_sub, audit_log=audit_log)

    course_data = CourseSerializer(course).data
    sub_iso = latest_sub.submitted_at.isoformat() if (latest_sub is not None and latest_sub.submitted_at) else None
    course_data["submittedAt"] = sub_iso
    course_data["auditLog"] = audit_log
    course_data["activeReviewFeedback"] = active_feedback

    is_reviewer = (getattr(actor, "role_id", None) or "") in REVIEWER_ROLES
    staged_edits = get_staged_edits_record(course, submission=latest_sub) if is_reviewer else None
    working_notes = (
        get_working_notes_for_course(course, actor, submission=latest_sub) if is_reviewer else None
    )

    if staged_edits and isinstance(staged_edits.get("patchedContent"), dict) and not staged_edits.get("isStale"):
        effective_content = _apply_patched_content_to_snapshot(course_data, staged_edits["patchedContent"])
    else:
        effective_content = course_data

    has_pending_submission = bool(latest_sub is not None and latest_sub.review_status == "Pending")

    return {
        "course": course_data,
        "draft": course_data,
        "effectiveContent": effective_content,
        "submission": CourseReviewSubmissionSerializer(latest_sub).data if latest_sub is not None else None,
        "hasPendingSubmission": has_pending_submission,
        "reviewStatus": latest_sub.review_status if latest_sub is not None else None,
        "stagedEdits": staged_edits,
        "activeReviewFeedback": active_feedback,
        "auditLog": audit_log,
        "submissionType": submission_type,
        "isPublishedUpdate": is_published_update,
        "workingNotes": working_notes,
    }
