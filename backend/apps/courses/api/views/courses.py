"""Courses, curriculum draft/publish, review (`API-REC-02`), and comments views."""
from __future__ import annotations

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.api.serializers.courses import (
    CourseCommentReportSerializer,
    CourseCommentSerializer,
    CourseReviewSubmissionSerializer,
    CourseSerializer,
    PublishedCourseVersionSerializer,
)
from apps.courses.models import (
    Course,
    CourseAssistantLecturer,
    CourseAudienceDepartment,
    CourseAudienceJobTitle,
    CourseAudienceMetroLine,
    CourseComment,
    CourseCommentReport,
    CourseDraft,
    CourseQrCode,
    CourseReviewSubmission,
    LessonItem,
    Module,
    PublishedCourseVersion,
    StagedAdminEdit,
)
from apps.organization.models import (
    JobTitle,
    LeadershipTitleCatalog,
    MetroLine,
    OrganizationalDepartment,
)
from apps.courses.services.course_service import (
    CourseDomainError,
    add_course_comment,
    can_edit_course_draft,
    create_course,
    decide_course_review,
    get_or_create_course_qr,
    is_course_visible_to_trainee,
    parse_stored_report_reason,
    report_course_comment,
    rotate_course_qr,
    save_course_draft,
    submit_course_for_review,
    update_course_qr_settings,
)
from apps.courses.services.review_studio_service import (
    REVIEWER_ROLES,
    StagedEditConflictError,
    build_course_review_data_payload,
    build_my_submissions_payload,
    build_review_queue_payload,
    clear_staged_edits_record,
    delete_working_notes_for_course,
    execute_review_decision,
    get_staged_edits_record,
    get_working_notes_for_course,
    notify_course_review_decision,
    save_staged_edits_record,
    save_working_notes_for_course,
)
from apps.communications.services.communications_service import notify_roles, notify_users, send_notification
from apps.identity.models import User
from shared.api import error_response, success_response
from shared.permissions import has_capability


def _sync_course_audience(course: Course, data: dict) -> None:
    """Sync Course access_mode, CourseAudienceDepartment, CourseAudienceJobTitle, CourseAudienceMetroLine."""
    if not isinstance(data, dict):
        return
    raw_access_mode = data.get("accessMode")
    if isinstance(raw_access_mode, str) and raw_access_mode in {"all_trainees", "targeted", "hidden"}:
        if course.access_mode != raw_access_mode:
            course.access_mode = raw_access_mode
            course.save(update_fields=["access_mode", "updated_at"])
    if "targetDepartmentIds" in data and isinstance(data.get("targetDepartmentIds"), list):
        dept_ids = [int(x) for x in data["targetDepartmentIds"] if str(x).isdigit()]
        valid_dept_ids = list(OrganizationalDepartment.objects.filter(pk__in=dept_ids).values_list("id", flat=True))
        CourseAudienceDepartment.objects.filter(course=course).delete()
        for did in valid_dept_ids:
            CourseAudienceDepartment.objects.create(course=course, department_id=did)

    if "targetJobTitleIds" in data and isinstance(data.get("targetJobTitleIds"), list):
        job_ids = [int(x) for x in data["targetJobTitleIds"] if str(x).isdigit()]
        valid_job_ids = list(JobTitle.objects.filter(pk__in=job_ids).values_list("id", flat=True))
        CourseAudienceJobTitle.objects.filter(course=course).delete()
        for jid in valid_job_ids:
            CourseAudienceJobTitle.objects.create(course=course, job_title_id=jid)
    elif "targetJobTitles" in data and isinstance(data.get("targetJobTitles"), list):
        names = [str(x).strip() for x in data["targetJobTitles"] if str(x).strip()]
        valid_job_ids = list(JobTitle.objects.filter(name_ar__in=names).values_list("id", flat=True))
        CourseAudienceJobTitle.objects.filter(course=course).delete()
        for jid in valid_job_ids:
            CourseAudienceJobTitle.objects.create(course=course, job_title_id=jid)

    if "targetMetroLineIds" in data and isinstance(data.get("targetMetroLineIds"), list):
        line_ids = [int(x) for x in data["targetMetroLineIds"] if str(x).isdigit()]
        valid_line_ids = list(MetroLine.objects.filter(pk__in=line_ids).values_list("id", flat=True))
        CourseAudienceMetroLine.objects.filter(course=course).delete()
        for lid in valid_line_ids:
            CourseAudienceMetroLine.objects.create(course=course, metro_line_id=lid)

    if "targetLeadershipTitles" in data and isinstance(data.get("targetLeadershipTitles"), list):
        from apps.courses.models import CourseAudienceLeadership

        titles = [str(x).strip() for x in data["targetLeadershipTitles"] if str(x).strip()]
        CourseAudienceLeadership.objects.filter(course=course).delete()
        for title in dict.fromkeys(titles):
            CourseAudienceLeadership.objects.create(course=course, leadership_title=title[:100])


class CourseCatalogListView(APIView):
    """GET /api/courses — Audience-filtered catalog for trainees; full catalog for staff."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        base_qs = Course.objects.select_related("primary_lecturer", "qr_code").order_by("id")
        if request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}:
            courses = list(base_qs)
        else:
            published = base_qs.filter(lifecycle_status="Published")
            courses = [c for c in published if is_course_visible_to_trainee(request.user, c)]
        return success_response({"courses": CourseSerializer(courses, many=True).data})


class CourseCatalogDetailView(APIView):
    """GET /api/courses/<course_id> — Course details for catalog & CourseDetailPage."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.select_related("primary_lecturer", "qr_code").filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            if course.primary_lecturer_id != request.user.id and not course.assistant_lecturers.filter(user=request.user).exists():
                if course.lifecycle_status != "Published":
                    return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
                if not is_course_visible_to_trainee(request.user, course):
                    return error_response(
                        "PERMISSION_DENIED",
                        "هذا المقرر مخفي أو مخصص لمجموعات محددة ولا تملك صلاحية الوصول إليه.",
                        status.HTTP_403_FORBIDDEN,
                    )
        return success_response({"course": CourseSerializer(course).data})


class LecturerCourseListView(APIView):
    """GET / POST /api/lecturer/courses."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), has_capability("courses.create")()]

    def get(self, request: Request):
        from django.db.models import Q

        base_qs = Course.objects.select_related("primary_lecturer", "qr_code").order_by("id")
        if request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}:
            courses = list(base_qs)
        else:
            courses = list(
                base_qs.filter(
                    Q(primary_lecturer=request.user) | Q(assistant_lecturers__user=request.user)
                ).distinct()
            )
        return success_response({"courses": CourseSerializer(courses, many=True).data})

    def post(self, request: Request):
        title = str(request.data.get("title", ""))
        course_type = str(request.data.get("courseType", "main"))
        description = request.data.get("description")
        main_course_id = request.data.get("mainCourseId")
        lecturer_id = request.data.get("primaryLecturerId") or request.user.id

        primary_lecturer = User.objects.filter(pk=lecturer_id).first()
        if primary_lecturer is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        main_course = None
        if main_course_id is not None:
            main_course = Course.objects.filter(pk=main_course_id).first()
            if main_course is None:
                return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        try:
            course = create_course(
                actor=request.user,
                title=title,
                course_type=course_type,
                primary_lecturer=primary_lecturer,
                description=description,
                main_course=main_course,
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        except Exception:
            return error_response("VALIDATION_ERROR", "طلب غير صالح. يرجى مراجعة البيانات المدخلة.", status.HTTP_400_BAD_REQUEST)

        _sync_course_audience(course, request.data)
        return success_response({"course": CourseSerializer(course).data}, status_code=status.HTTP_201_CREATED)


class LecturerCourseDetailView(APIView):
    """GET /api/lecturer/courses/<course_id> — Course details for Course Builder editing."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل هذه الدورة.", status.HTTP_403_FORBIDDEN)
        return success_response({"course": CourseSerializer(course).data})

    def delete(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية حذف هذه الدورة.", status.HTTP_403_FORBIDDEN)

        from django.db import transaction
        from django.db.models import Q
        from apps.courses.models import (
            CourseAssistantLecturer,
            CourseDraft,
            LessonItem,
            Module,
            PublishedCourseVersion,
            QuizDefinition,
            WorkingNote,
        )
        from apps.governance.services.governance_service import record_audit_log
        from apps.groups.models import GroupCourseAssignment
        from apps.learning.models import (
            CertificateRecord,
            CourseAttempt,
            Enrollment,
            EnrollmentSourceGrant,
            LessonProgress,
        )
        from apps.media.models import MediaContentReference

        if CertificateRecord.objects.filter(published_version__course=course).exists():
            return error_response(
                "COURSE_HAS_CERTIFICATES",
                "لا يمكن حذف مقرر صدرت له شهادات معتمدة؛ يرجى أرشفته بدلاً من الحذف.",
                status.HTTP_409_CONFLICT,
            )
        if Course.objects.filter(main_course=course).exists():
            return error_response(
                "COURSE_HAS_REMINDERS",
                "لا يمكن حذف مقرر أساسي مرتبط به دورات تذكيرية؛ يرجى حذف الدورات التذكيرية أولاً.",
                status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            LessonProgress.objects.filter(course_attempt__enrollment__course=course).delete()
            CourseAttempt.objects.filter(enrollment__course=course).delete()
            EnrollmentSourceGrant.objects.filter(enrollment__course=course).delete()
            Enrollment.objects.filter(course=course).delete()
            GroupCourseAssignment.objects.filter(course=course).delete()

            CourseCommentReport.objects.filter(comment__course=course).delete()
            CourseComment.objects.filter(course=course).delete()

            lesson_q = Q(lesson_item__module__course_draft__course=course) | Q(
                lesson_item__module__published_version__course=course
            )
            QuizDefinition.objects.filter(lesson_q).delete()

            mod_q = Q(module__course_draft__course=course) | Q(module__published_version__course=course)
            LessonItem.objects.filter(mod_q).delete()

            draft_pub_q = Q(course_draft__course=course) | Q(published_version__course=course)
            Module.objects.filter(draft_pub_q).delete()
            asset_ids = list(
                MediaContentReference.objects.filter(draft_pub_q).values_list("media_asset_id", flat=True)
            )
            MediaContentReference.objects.filter(draft_pub_q).delete()

            from apps.communications.models import WhatsAppContact

            WhatsAppContact.objects.filter(course=course).delete()

            WorkingNote.objects.filter(submission__course=course).delete()
            StagedAdminEdit.objects.filter(submission__course=course).delete()
            CourseReviewSubmission.objects.filter(course=course).delete()

            CourseDraft.objects.filter(course=course).delete()
            PublishedCourseVersion.objects.filter(course=course).delete()

            CourseAudienceDepartment.objects.filter(course=course).delete()
            CourseAudienceJobTitle.objects.filter(course=course).delete()
            from apps.courses.models import CourseAudienceLeadership

            CourseAudienceLeadership.objects.filter(course=course).delete()
            CourseAudienceMetroLine.objects.filter(course=course).delete()
            CourseAssistantLecturer.objects.filter(course=course).delete()
            CourseQrCode.objects.filter(course=course).delete()

            course_title = course.title
            Course.objects.filter(pk=course.pk).delete()
            _purge_unreferenced_course_media(asset_ids)
            record_audit_log(
                action="course.deleted",
                actor=request.user,
                target_entity_type="Course",
                target_entity_id=str(course_id),
                details_snapshot={"title": course_title},
            )
        return success_response({"deleted": True, "message": "تم حذف الدورة التدريبية بنجاح."})


def _purge_unreferenced_course_media(asset_ids: list[int]) -> tuple[int, int]:
    """Delete unreferenced MediaAsset records and stored files after course deletion/purge."""
    if not asset_ids:
        return 0, 0
    from apps.media.models import MediaAsset, MediaContentReference
    from apps.media.services.media_service import LocalMediaStorage

    storage = LocalMediaStorage()
    purged_count = 0
    freed_bytes = 0
    for asset_id in set(asset_ids):
        if MediaContentReference.objects.filter(media_asset_id=asset_id).exists():
            continue
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            continue
        storage_key = asset.storage_key
        size_bytes = int(asset.size_bytes or 0)
        asset.delete()
        try:
            storage.delete_stored_file(storage_key)
        except Exception:
            pass
        purged_count += 1
        freed_bytes += size_bytes
    return purged_count, freed_bytes


class CoursePurgeAndArchiveView(APIView):
    """POST /api/courses/<course_id>/purge-and-archive."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية أرشفة وتفريغ هذه الدورة.", status.HTTP_403_FORBIDDEN)

        from django.db import transaction
        from django.db.models import Q
        from apps.governance.services.governance_service import record_audit_log
        from apps.media.models import MediaContentReference

        with transaction.atomic():
            course.lifecycle_status = "Archived"
            course.save(update_fields=["lifecycle_status"])

            draft_pub_q = Q(course_draft__course=course) | Q(published_version__course=course)
            asset_ids = list(
                MediaContentReference.objects.filter(draft_pub_q).values_list("media_asset_id", flat=True)
            )
            MediaContentReference.objects.filter(draft_pub_q).delete()
            purged_count, freed_bytes = _purge_unreferenced_course_media(asset_ids)

            record_audit_log(
                action="course.purged_and_archived",
                actor=request.user,
                target_entity_type="Course",
                target_entity_id=str(course_id),
                details_snapshot={
                    "title": course.title,
                    "purgedFilesCount": purged_count,
                    "freedBytes": freed_bytes,
                },
            )

        freed_mb = round(freed_bytes / (1024 * 1024), 2) if freed_bytes > 0 else 0
        msg = (
            f"تم تفريغ {purged_count} ملف ({freed_mb} MB) وأرشفة الدورة «{course.title}» مع الحفاظ على سجل الشهادات."
            if purged_count > 0
            else f"تمت أرشفة الدورة «{course.title}» بنجاح مع الحفاظ على سجل الشهادات."
        )
        return success_response(
            {
                "archived": True,
                "purgedFilesCount": purged_count,
                "freedBytes": freed_bytes,
                "message": msg,
            }
        )


class LecturerCourseDraftView(APIView):
    """PUT /api/lecturer/courses/<course_id>/draft."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        title_snapshot = str(request.data.get("titleSnapshot") or request.data.get("title") or course.title)
        modules_payload = request.data.get("chapters")
        if modules_payload is None:
            modules_payload = request.data.get("modules", [])
        if not isinstance(modules_payload, list):
            return error_response("VALIDATION_ERROR", "طلب غير صالح. يرجى مراجعة البيانات المدخلة.", status.HTTP_400_BAD_REQUEST)
        raw_thumb = request.data.get("thumbnailMediaId") or request.data.get("thumbnail")
        thumb_asset_id = None
        if isinstance(raw_thumb, int) or (isinstance(raw_thumb, str) and raw_thumb.isdigit()):
            thumb_asset_id = int(raw_thumb)
        elif isinstance(raw_thumb, str) and "/api/media/assets/" in raw_thumb:
            import re as _re

            m_thumb = _re.search(r"/api/media/assets/(\d+)/stream", raw_thumb)
            if m_thumb:
                thumb_asset_id = int(m_thumb.group(1))
        try:
            from apps.media.models import MediaContentReference

            previous_draft_asset_ids = list(
                MediaContentReference.objects.filter(course_draft__course=course).values_list(
                    "media_asset_id", flat=True
                )
            )
            draft = save_course_draft(
                actor=request.user,
                course=course,
                title_snapshot=title_snapshot,
                modules_payload=modules_payload,
                thumbnail_asset_id=thumb_asset_id,
                refresher_config=request.data.get("refresherConfig")
                if isinstance(request.data.get("refresherConfig"), dict)
                else None,
                course_zip_policy=str(request.data.get("courseZipPolicy"))
                if request.data.get("courseZipPolicy") is not None
                else None,
                cover_type=str(request.data.get("coverType"))
                if request.data.get("coverType") is not None
                else None,
                cover_color=str(request.data.get("coverColor"))
                if request.data.get("coverColor") is not None
                else None,
            )
            _purge_unreferenced_course_media(previous_draft_asset_ids)
            if course.lifecycle_status == "Draft":
                new_desc = request.data.get("description")
                course.title = draft.title_snapshot
                if new_desc is not None:
                    course.description = str(new_desc)
                course.save(update_fields=["title", "description", "updated_at"])
            _sync_course_audience(course, request.data)
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {
                "draftId": draft.id,
                "titleSnapshot": draft.title_snapshot,
                "course": CourseSerializer(course).data,
                "isPublishedPreserved": course.lifecycle_status == "Published",
            }
        )


class AdminCourseReviewSubmitView(APIView):
    """POST /api/admin/courses/<course_id>/review/submit."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            sub = submit_course_for_review(actor=request.user, course=course)
            if (
                request.user.role_id in {"developer", "super_admin", "admin"}
                and not request.path.endswith("/review/submit")
            ):
                CourseReviewSubmission.objects.filter(course=course, review_status="Pending").exclude(pk=sub.id).update(
                    review_status="Approved",
                    reviewed_by_user=request.user,
                    decided_at=timezone.now(),
                )
                sub, _ = decide_course_review(
                    reviewer=request.user,
                    submission=sub,
                    decision="approve",
                )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        course.refresh_from_db()
        if sub.review_status == "Pending":
            is_update = PublishedCourseVersion.objects.filter(course=course).exists()
            notify_roles(
                role_ids=REVIEWER_ROLES,
                title="تحديث مقرر بانتظار المراجعة" if is_update else "مقرر جديد بانتظار المراجعة",
                body=f"قدّم «{request.user.full_name}» المقرر «{course.title}» للمراجعة والاعتماد.",
                notif_type="content_pending_review",
                target_url=f"/admin/review/{course.id}",
                action_required=True,
                metadata={
                    "courseId": str(course.id),
                    "submissionId": str(sub.id),
                    "actorId": str(request.user.id),
                    "actorName": request.user.full_name,
                    "actorRole": request.user.role_id,
                },
                exclude_user_id=request.user.id,
            )
        elif sub.review_status == "Approved":
            notify_course_review_decision(course=course, reviewer=request.user, outcome="approved")
        return success_response(
            {
                "submission": CourseReviewSubmissionSerializer(sub).data,
                "course": CourseSerializer(course).data,
            },
            status_code=status.HTTP_201_CREATED,
        )


class AdminCourseReviewDecideView(APIView):
    """POST /api/admin/courses/<course_id>/review/decide (`API-REC-02`)."""

    permission_classes = [IsAuthenticated, has_capability("reviews.decide_course")]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        sub_id = request.data.get("submissionId")
        qs = CourseReviewSubmission.objects.filter(course=course)
        if sub_id is not None and str(sub_id).strip():
            if not str(sub_id).strip().isdigit():
                return error_response("VALIDATION_ERROR", "معرف طلب المراجعة غير صالح.", status.HTTP_400_BAD_REQUEST)
            sub = qs.filter(pk=int(str(sub_id).strip())).first()
        else:
            sub = qs.filter(review_status="Pending").order_by("-id").first()
        if sub is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        decision = str(request.data.get("decision", ""))
        note_body = request.data.get("noteBody")
        try:
            sub, pub_ver = decide_course_review(
                reviewer=request.user,
                submission=sub,
                decision=decision,
                note_body=str(note_body) if note_body is not None else None,
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        notify_course_review_decision(
            course=course,
            reviewer=request.user,
            outcome="approved" if decision == "approve" else "rejected",
            summary_message=str(note_body or ""),
        )
        return success_response(
            {
                "submission": CourseReviewSubmissionSerializer(sub).data,
                "publishedVersion": PublishedCourseVersionSerializer(pub_ver).data if pub_ver else None,
            }
        )


class AdminCourseStagedEditView(APIView):
    """GET / POST / PUT / DELETE staged admin edits for review studio."""

    def get_permissions(self):
        if getattr(self.request, "method", "GET") == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), has_capability("reviews.decide_course")()]

    def get(self, request: Request, course_id: int):
        if request.user.role_id not in REVIEWER_ROLES:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية الاطلاع على التعديلات المؤقتة.", status.HTTP_403_FORBIDDEN)
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        return success_response({"record": get_staged_edits_record(course)})

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        payload = dict(request.data) if isinstance(request.data, dict) else {}
        try:
            edit, record = save_staged_edits_record(course=course, actor=request.user, payload=payload)
        except StagedEditConflictError as exc:
            return error_response(exc.code, exc.message, status.HTTP_409_CONFLICT)
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {
                "record": record,
                "message": "تم حفظ التعديلات المؤقتة بنجاح.",
                "stagedEditId": edit.id,
                "saved": True,
                "revision": str(record.get("clientRevision", edit.id)),
            },
            status_code=status.HTTP_201_CREATED if request.method == "POST" else status.HTTP_200_OK,
        )

    def put(self, request: Request, course_id: int):
        return self.post(request, course_id)

    def delete(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        deleted = clear_staged_edits_record(course=course)
        return success_response(
            {
                "cleared": True,
                "discarded": True,
                "deletedCount": deleted,
                "message": "تم تجاهل التعديلات المؤقتة بنجاح.",
            }
        )


class CourseCommentListView(APIView):
    """GET / POST /api/courses/<course_id>/comments."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id == "trainee" and not is_course_visible_to_trainee(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية استعراض تعليقات هذه الدورة.", status.HTTP_403_FORBIDDEN)
        if (
            request.user.role_id == "lecturer"
            and course.lifecycle_status != "Published"
            and not _is_course_staff(request.user, course)
        ):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية استعراض تعليقات هذه الدورة.", status.HTTP_403_FORBIDDEN)
        comments = (
            CourseComment.objects.select_related("author_user", "course")
            .prefetch_related("reports__reporter_user")
            .filter(course_id=course_id)
            .order_by("id")
        )
        return success_response({"comments": CourseCommentSerializer(comments, many=True).data})

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id == "trainee" and not is_course_visible_to_trainee(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية التعليق على هذه الدورة.", status.HTTP_403_FORBIDDEN)
        if (
            request.user.role_id == "lecturer"
            and course.lifecycle_status != "Published"
            and not _is_course_staff(request.user, course)
        ):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية التعليق على هذه الدورة.", status.HTTP_403_FORBIDDEN)
        body = str(request.data.get("body") or request.data.get("text") or "")
        try:
            comment = add_course_comment(author=request.user, course=course, body=body)
        except Exception:
            return error_response("VALIDATION_ERROR", "نص التعليق مطلوب.", status.HTTP_400_BAD_REQUEST)

        course_lecturers = []
        if course.primary_lecturer is not None and course.primary_lecturer.status == "Active":
            course_lecturers.append(course.primary_lecturer)
        for rel in CourseAssistantLecturer.objects.filter(course=course).select_related("user"):
            if rel.user is not None and rel.user.status == "Active":
                course_lecturers.append(rel.user)
        notify_users(
            users=course_lecturers,
            title=f"تعليق جديد على مقرر: {course.title}",
            body=f"أضاف «{request.user.full_name}» تعليقاً جديداً على المقرر «{course.title}».",
            notif_type="new_comment",
            target_url=f"/courses/{course.id}",
            action_required=False,
            metadata={
                "courseId": str(course.id),
                "commentId": str(comment.id),
                "actorId": str(request.user.id),
                "actorName": request.user.full_name,
                "actorRole": request.user.role_id,
            },
            exclude_user_id=request.user.id,
        )
        return success_response({"comment": CourseCommentSerializer(comment).data}, status_code=status.HTTP_201_CREATED)


class CourseCommentReportView(APIView):
    """POST /api/comments/<comment_id>/report."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, comment_id: int):
        comment = (
            CourseComment.objects.select_related("course", "author_user")
            .filter(pk=comment_id)
            .first()
        )
        if comment is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id == "trainee" and not is_course_visible_to_trainee(request.user, comment.course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية الإبلاغ عن تعليقات هذه الدورة.", status.HTTP_403_FORBIDDEN)
        if (
            request.user.role_id == "lecturer"
            and comment.course.lifecycle_status != "Published"
            and not _is_course_staff(request.user, comment.course)
        ):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية الإبلاغ عن تعليقات هذه الدورة.", status.HTTP_403_FORBIDDEN)
        reason = str(request.data.get("reason", ""))
        notes = str(request.data.get("notes") or request.data.get("details") or "")
        try:
            rep = report_course_comment(
                reporter=request.user,
                comment=comment,
                reason=reason,
                notes=notes,
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        except Exception:
            return error_response("VALIDATION_ERROR", "سبب البلاغ مطلوب.", status.HTTP_400_BAD_REQUEST)

        reason_code, reason_label_ar, report_notes = parse_stored_report_reason(rep.reason)
        reason_display = (
            f"{reason_label_ar} — {report_notes}"
            if report_notes and report_notes != reason_label_ar
            else reason_label_ar
        )
        comment_author_name = (
            "مستخدم محذوف"
            if (comment.is_author_deleted or comment.author_user is None)
            else comment.author_user.full_name
        )
        comment_snippet = (comment.body or "").strip()
        if len(comment_snippet) > 120:
            comment_snippet = f"{comment_snippet[:117]}..."

        notify_roles(
            role_ids=REVIEWER_ROLES,
            title=f"إبلاغ عن تعليق ({reason_label_ar}) — {comment.course.title}",
            body=(
                f"أبلغ «{request.user.full_name}» عن تعليق لـ «{comment_author_name}» "
                f"في مقرر «{comment.course.title}». سبب البلاغ: {reason_display}"
                + (f" | نص التعليق: «{comment_snippet}»" if comment_snippet else "")
            ),
            notif_type="comment_reported",
            target_url="/admin/comment-moderation",
            action_required=True,
            metadata={
                "courseId": str(comment.course_id),
                "commentId": str(comment.id),
                "reportReason": reason_code,
                "reportReasonLabelAr": reason_label_ar,
                "reportNotes": report_notes,
                "actorId": str(request.user.id),
                "actorName": request.user.full_name,
                "actorRole": request.user.role_id,
            },
            exclude_user_id=request.user.id,
        )
        serialized_comment = CourseCommentSerializer(comment).data
        return success_response(
            {
                **serialized_comment,
                "report": CourseCommentReportSerializer(rep).data,
            },
            status_code=status.HTTP_201_CREATED,
        )


class AdminCommentModerationView(APIView):
    """POST / PATCH /api/admin/comments/<comment_id>/ignore-report."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def post(self, request: Request, comment_id: int):
        updated = CourseCommentReport.objects.filter(comment_id=comment_id, status="Pending").update(status="Dismissed")
        comment = CourseComment.objects.select_related("author_user", "course").filter(pk=comment_id).first()
        payload = CourseCommentSerializer(comment).data if comment is not None else {}
        return success_response({**payload, "dismissedCount": updated})

    def patch(self, request: Request, comment_id: int):
        return self.post(request, comment_id)


class ApprovalsQueueView(APIView):
    """GET /api/approvals/queue — Deterministic FIFO course review queue."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        if request.user.role_id not in REVIEWER_ROLES:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض قائمة المراجعات.", status.HTTP_403_FORBIDDEN)
        return success_response(build_review_queue_payload())


class ApprovalsMySubmissionsView(APIView):
    """GET /api/approvals/my-submissions — Lecturer's own review submissions & drafts."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        return success_response(build_my_submissions_payload(request.user))


class AdminCommentsListView(APIView):
    """GET /api/admin/comments — List all comments with optional query, courseId, and reportedOnly filters."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def get(self, request: Request):
        qs = (
            CourseComment.objects.select_related("author_user", "course")
            .prefetch_related("reports__reporter_user")
            .order_by("-id")
        )
        query_text = str(request.query_params.get("query") or "").strip()
        course_id = str(request.query_params.get("courseId") or "").strip()
        reported_only = str(request.query_params.get("reportedOnly") or "").lower() in {"1", "true", "yes"}

        if course_id.isdigit():
            qs = qs.filter(course_id=int(course_id))
        if reported_only:
            reported_ids = (
                CourseCommentReport.objects.filter(status="Pending")
                .values_list("comment_id", flat=True)
                .distinct()
            )
            qs = qs.filter(id__in=reported_ids)
        if query_text:
            from django.db.models import Q

            qs = qs.filter(
                Q(body__icontains=query_text)
                | Q(author_user__full_name__icontains=query_text)
                | Q(course__title__icontains=query_text)
            )
        return success_response(CourseCommentSerializer(qs, many=True).data)


class AdminCommentsReportedView(APIView):
    """GET /api/admin/comments/reported."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def get(self, request: Request):
        reported_ids = (
            CourseCommentReport.objects.filter(status="Pending")
            .values_list("comment_id", flat=True)
            .distinct()
        )
        qs = (
            CourseComment.objects.select_related("author_user", "course")
            .prefetch_related("reports__reporter_user")
            .filter(id__in=reported_ids)
            .order_by("-id")
        )
        return success_response(CourseCommentSerializer(qs, many=True).data)


class AdminCommentsSummaryView(APIView):
    """GET /api/admin/comments/summary."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def get(self, request: Request):
        total = CourseComment.objects.count()
        reported = CourseCommentReport.objects.filter(status="Pending").values("comment_id").distinct().count()
        return success_response(
            {
                "totalComments": total,
                "reportedComments": reported,
                "reportedCommentsCount": reported,
            }
        )


class AdminCommentDeleteView(APIView):
    """DELETE /api/admin/comments/<comment_id> & /api/courses/<course_id>/comments/<comment_id>."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, comment_id: int, course_id: int | None = None):
        qs = CourseComment.objects.filter(pk=comment_id)
        if course_id is not None:
            qs = qs.filter(course_id=course_id)
        comment = qs.first()
        if comment is None:
            return error_response("RESOURCE_NOT_FOUND", "التعليق غير موجود.", status.HTTP_404_NOT_FOUND)
        if comment.author_user_id != request.user.id and request.user.role_id not in {
            "developer",
            "super_admin",
            "admin",
        }:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية حذف هذا التعليق.", status.HTTP_403_FORBIDDEN)
        CourseCommentReport.objects.filter(comment=comment).delete()
        comment.delete()
        return success_response({"success": True, "deleted": True})


class AdminCourseCommentsToggleView(APIView):
    """POST / PUT / PATCH /api/admin/courses/<course_id>/comments-toggle."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def _toggle(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        raw_enabled = request.data.get("commentsEnabled")
        if raw_enabled is None:
            raw_enabled = request.data.get("enabled", True)
        enabled = bool(raw_enabled)
        return success_response({"courseId": str(course.id), "commentsEnabled": enabled})

    def post(self, request: Request, course_id: int):
        return self._toggle(request, course_id)

    def put(self, request: Request, course_id: int):
        return self._toggle(request, course_id)

    def patch(self, request: Request, course_id: int):
        return self._toggle(request, course_id)


class CourseInstructorsView(APIView):
    """PUT /api/courses/<course_id>/instructors."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, course_id: int):
        from apps.identity.models import User

        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id not in {"developer", "super_admin", "admin"} and course.primary_lecturer_id != request.user.id:
            return error_response(
                "PERMISSION_DENIED",
                "ليس لديك صلاحية تعديل محاضري هذه الدورة.",
                status.HTTP_403_FORBIDDEN,
            )
        lecturer_id = request.data.get("primaryLecturerId") or request.data.get("lecturerId")
        if lecturer_id and str(lecturer_id).isdigit():
            u = User.objects.filter(
                pk=int(lecturer_id),
                status="Active",
                role_id__in=["developer", "super_admin", "admin", "assistant_admin", "lecturer"],
            ).first()
            if u is not None:
                prev_lecturer_id = course.primary_lecturer_id
                course.primary_lecturer = u
                course.save(update_fields=["primary_lecturer"])
                if prev_lecturer_id != u.id and u.id != request.user.id:
                    send_notification(
                        user=u,
                        title=f"تم تعيينك محاضراً لمقرر: {course.title}",
                        body=f"أسند «{request.user.full_name}» مسؤولية التدريس للمقرر «{course.title}» إليك.",
                        notif_type="instructor_assigned",
                        target_url=f"/lecturer/builder/{course.id}",
                        action_required=False,
                        metadata={
                            "courseId": str(course.id),
                            "actorId": str(request.user.id),
                            "actorName": request.user.full_name,
                            "actorRole": request.user.role_id,
                        },
                    )
        return success_response(CourseSerializer(course).data)


class CourseReviewDataView(APIView):
    """GET /api/courses/<course_id>/review-data."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id not in REVIEWER_ROLES and not _is_course_staff(request.user, course):
            return error_response(
                "PERMISSION_DENIED",
                "ليس لديك صلاحية استعراض بيانات مراجعة هذه الدورة.",
                status.HTTP_403_FORBIDDEN,
            )
        return success_response(build_course_review_data_payload(course, request.user))


class AdminCourseReviewActionView(APIView):
    """POST /api/admin/courses/<course_id>/(approve|return-with-edits|reject) & /api/admin/review/<course_id>/decision."""

    permission_classes = [IsAuthenticated, has_capability("reviews.decide_course")]
    fixed_decision: str | None = None

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        payload = dict(request.data) if isinstance(request.data, dict) else {}
        if self.fixed_decision:
            payload["outcome"] = self.fixed_decision
        try:
            result = execute_review_decision(course=course, reviewer=request.user, payload=payload)
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(result)


class AdminCourseWorkingNotesView(APIView):
    """GET / POST / PUT / DELETE private reviewer working notes."""

    permission_classes = [IsAuthenticated]

    def _authorize_and_get_course(self, request: Request, course_id: int):
        if request.user.role_id not in REVIEWER_ROLES:
            return None, error_response(
                "PERMISSION_DENIED",
                "ملاحظات المراجع متاحة للإدارة وفريق الجودة فقط.",
                status.HTTP_403_FORBIDDEN,
            )
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return None, error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        return course, None

    def get(self, request: Request, course_id: int, target_type: str = "", target_id: str = ""):
        course, err = self._authorize_and_get_course(request, course_id)
        if err is not None or course is None:
            return err
        notes = get_working_notes_for_course(course, request.user)
        return success_response({"notes": notes, "stagedEdits": []})

    def post(self, request: Request, course_id: int, target_type: str = "", target_id: str = ""):
        course, err = self._authorize_and_get_course(request, course_id)
        if err is not None or course is None:
            return err
        payload = dict(request.data) if isinstance(request.data, dict) else {}
        try:
            notes = save_working_notes_for_course(course=course, reviewer=request.user, payload=payload)
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {"notes": notes, "saved": True, "message": "تم حفظ الملاحظات الخاصة بنجاح."},
            status_code=status.HTTP_201_CREATED if request.method == "POST" else status.HTTP_200_OK,
        )

    def put(self, request: Request, course_id: int, target_type: str = "", target_id: str = ""):
        return self.post(request, course_id, target_type, target_id)

    def delete(self, request: Request, course_id: int, target_type: str = "", target_id: str = ""):
        course, err = self._authorize_and_get_course(request, course_id)
        if err is not None or course is None:
            return err
        deleted = delete_working_notes_for_course(course=course, reviewer=request.user)
        return success_response({"deleted": True, "deletedCount": deleted})


def _is_course_staff(user: User, course: Course) -> bool:
    return (
        user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
        or course.primary_lecturer_id == user.id
        or course.assistant_lecturers.filter(user=user).exists()
    )


def _can_mutate_course_qr(user: User, course: Course) -> bool:
    return (
        user.role_id in {"developer", "super_admin", "admin"}
        or course.primary_lecturer_id == user.id
        or course.assistant_lecturers.filter(user=user).exists()
    )


def _serialize_course_qr(qr: CourseQrCode) -> dict:
    return {
        "token": qr.token,
        "isEnabled": qr.is_enabled,
        "qrMode": qr.qr_mode,
        "expiresAt": qr.expires_at.isoformat() if qr.expires_at else None,
        "updatedAt": qr.updated_at.isoformat() if qr.updated_at else None,
    }


class LecturerCourseGroupsView(APIView):
    """GET /api/lecturer/courses/<course_id>/groups — TrainingGroups linked to this course."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _is_course_staff(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض مجموعات هذه الدورة.", status.HTTP_403_FORBIDDEN)
        from apps.groups.models import TrainingGroup

        groups = (
            TrainingGroup.objects.filter(renewal_cycles__course_assignments__course=course)
            .distinct()
            .order_by("id")
        )
        items = [
            {
                "id": str(g.id),
                "name": g.name,
                "status": "archived" if g.is_archived else "active",
                "memberCount": g.memberships.count(),
            }
            for g in groups
        ]
        return success_response({"groups": items})


class LecturerCourseQrSettingsView(APIView):
    """GET / PATCH /api/lecturer/courses/<course_id>/qr-settings."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _is_course_staff(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إدارة رمز QR لهذه الدورة.", status.HTTP_403_FORBIDDEN)
        qr = get_or_create_course_qr(course)
        return success_response({"qrSettings": _serialize_course_qr(qr)})

    def patch(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _can_mutate_course_qr(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل إعدادات رمز QR لهذه الدورة.", status.HTTP_403_FORBIDDEN)

        is_enabled = request.data.get("isEnabled")
        qr_mode = request.data.get("qrMode")
        expires_at = ...
        if "expiresAt" in request.data:
            raw_exp = request.data.get("expiresAt")
            if raw_exp in (None, ""):
                expires_at = None
            else:
                parsed = parse_datetime(str(raw_exp))
                if parsed is None:
                    return error_response("VALIDATION_ERROR", "صيغة تاريخ انتهاء الصلاحية غير صالحة.", status.HTTP_400_BAD_REQUEST)
                if timezone.is_naive(parsed):
                    parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
                expires_at = parsed
        try:
            qr = update_course_qr_settings(
                course,
                is_enabled=is_enabled,
                qr_mode=qr_mode,
                expires_at=expires_at,
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"qrSettings": _serialize_course_qr(qr)})


class LecturerCourseQrRotateView(APIView):
    """POST /api/lecturer/courses/<course_id>/qr-settings/rotate."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _can_mutate_course_qr(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إعادة توليد رمز QR لهذه الدورة.", status.HTTP_403_FORBIDDEN)
        qr = rotate_course_qr(course)
        return success_response({"qrSettings": _serialize_course_qr(qr)})


class CourseQrJoinInfoView(APIView):
    """GET /api/courses/join/<token>/info — Preview course before QR join."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, token: str):
        qr = CourseQrCode.objects.select_related("course", "course__primary_lecturer").filter(token=token).first()
        if qr is None:
            return error_response("RESOURCE_NOT_FOUND", "رمز QR غير صالح أو تم استبداله.", status.HTTP_404_NOT_FOUND)
        is_expired = bool(qr.expires_at and qr.expires_at <= timezone.now())
        return success_response(
            {
                "course": {
                    "id": str(qr.course.id),
                    "title": qr.course.title,
                    "description": qr.course.description,
                    "lecturerName": qr.course.primary_lecturer.full_name if qr.course.primary_lecturer else "",
                    "lifecycleStatus": qr.course.lifecycle_status,
                    "accessMode": qr.course.access_mode,
                },
                "qrSettings": {
                    "isEnabled": qr.is_enabled,
                    "qrMode": qr.qr_mode,
                    "expiresAt": qr.expires_at.isoformat() if qr.expires_at else None,
                    "isExpired": is_expired,
                },
            }
        )


class CourseQrJoinView(APIView):
    """POST /api/courses/join-by-qr — Access or auto-enroll via Course QR token."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        token = str(request.data.get("token", "")).strip()
        if not token:
            return error_response("VALIDATION_ERROR", "رمز QR مطلوب.", status.HTTP_400_BAD_REQUEST)
        qr = CourseQrCode.objects.select_related("course").filter(token=token).first()
        if qr is None:
            return error_response("RESOURCE_NOT_FOUND", "رمز QR غير صالح أو تم استبداله.", status.HTTP_404_NOT_FOUND)
        if not qr.is_enabled:
            return error_response("QR_DISABLED", "تم إيقاف الدخول عبر رمز QR لهذا المقرر.", status.HTTP_403_FORBIDDEN)
        if qr.expires_at and qr.expires_at <= timezone.now():
            return error_response("QR_EXPIRED", "انتهت صلاحية رمز QR لهذا المقرر.", status.HTTP_403_FORBIDDEN)
        course = qr.course
        if course.lifecycle_status != "Published" and not _is_course_staff(request.user, course):
            return error_response("COURSE_NOT_PUBLISHED", "المقرر غير منشور حالياً.", status.HTTP_403_FORBIDDEN)

        enrolled = False
        if qr.qr_mode == "auto_enroll":
            from apps.learning.services.learning_service import enroll_user_in_course

            enroll_user_in_course(
                actor=request.user,
                user=request.user,
                course=course,
                source_type="qr_code",
            )
            enrolled = True

        return success_response(
            {
                "courseId": str(course.id),
                "qrMode": qr.qr_mode,
                "enrolled": enrolled,
            }
        )


CANONICAL_LEADERSHIP_TITLES = [
    "رئيس قطاع / رئيس إدارة مركزية",
    "مدير عام",
    "مدير إدارة",
    "رئيس قسم / رئيس وحدة",
    "مشرف / رئيس وردية",
    "قائد فريق / منسق",
]


class AdminCourseVisibilityCatalogView(APIView):
    """GET /api/admin/course-visibility — Courses, Departments, Job Titles, and Leadership Titles visibility matrix."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response(
                "PERMISSION_DENIED",
                "هذه الصفحة مخصصة لمديري النظام والمساعدين الإداريين فقط.",
                status.HTTP_403_FORBIDDEN,
            )

        from apps.courses.models import (
            CourseAudienceDepartment,
            CourseAudienceJobTitle,
            CourseAudienceLeadership,
        )
        from apps.organization.models import JobTitle, OrganizationalDepartment

        dept_map: dict[int, list[str]] = {}
        for row in CourseAudienceDepartment.objects.all().values("course_id", "department_id"):
            dept_map.setdefault(row["course_id"], []).append(str(row["department_id"]))

        job_map: dict[int, list[str]] = {}
        for row in CourseAudienceJobTitle.objects.all().values("course_id", "job_title_id"):
            job_map.setdefault(row["course_id"], []).append(str(row["job_title_id"]))

        leadership_map: dict[int, list[str]] = {}
        for row in CourseAudienceLeadership.objects.all().values("course_id", "leadership_title"):
            leadership_map.setdefault(row["course_id"], []).append(str(row["leadership_title"]))

        courses_data = [
            {
                "id": str(c.id),
                "title": c.title,
                "lifecycleStatus": c.lifecycle_status,
                "accessMode": c.access_mode,
                "targetDepartmentIds": dept_map.get(c.id, []),
                "targetJobTitleIds": job_map.get(c.id, []),
                "targetLeadershipTitles": leadership_map.get(c.id, []),
            }
            for c in Course.objects.exclude(lifecycle_status="Archived").order_by("id")
        ]

        departments_data = [
            {
                "id": str(d.id),
                "nameAr": d.name_ar,
                "nameEn": d.name_en or "",
            }
            for d in OrganizationalDepartment.objects.all().order_by("id")
        ]

        job_titles_data = [
            {
                "id": str(j.id),
                "nameAr": j.name_ar,
                "nameEn": j.name_en or "",
                "departmentId": str(j.department_id) if j.department_id else None,
                "departmentNameAr": j.department.name_ar if j.department else None,
            }
            for j in JobTitle.objects.select_related("department").all().order_by("id")
        ]

        catalog_titles = list(
            LeadershipTitleCatalog.objects.all().order_by("id").values_list("name_ar", flat=True)
        )
        return success_response(
            {
                "courses": courses_data,
                "departments": departments_data,
                "jobTitles": job_titles_data,
                "leadershipTitles": catalog_titles or CANONICAL_LEADERSHIP_TITLES,
            }
        )


class AdminCourseVisibilityUpdateView(APIView):
    """PUT /api/admin/course-visibility/course/<course_id>."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, course_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response(
                "PERMISSION_DENIED",
                "ليس لديك صلاحية تعديل ظهور الدورات.",
                status.HTTP_403_FORBIDDEN,
            )
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response(
                "RESOURCE_NOT_FOUND",
                "المورد المطلوب غير موجود أو تم نقله.",
                status.HTTP_404_NOT_FOUND,
            )

        from django.db import transaction
        from apps.courses.models import (
            CourseAudienceDepartment,
            CourseAudienceJobTitle,
            CourseAudienceLeadership,
        )
        from apps.governance.services.governance_service import record_audit_log

        with transaction.atomic():
            _sync_course_audience(course, request.data)
            record_audit_log(
                action="course.visibility_updated",
                actor=request.user,
                target_entity_type="Course",
                target_entity_id=str(course.id),
                details_snapshot={
                    "targetDepartmentIds": request.data.get("targetDepartmentIds", []),
                    "targetJobTitleIds": request.data.get("targetJobTitleIds", []),
                    "targetLeadershipTitles": request.data.get("targetLeadershipTitles", []),
                },
            )

        dept_ids = [
            str(x)
            for x in CourseAudienceDepartment.objects.filter(course=course).values_list("department_id", flat=True)
        ]
        job_ids = [
            str(x)
            for x in CourseAudienceJobTitle.objects.filter(course=course).values_list("job_title_id", flat=True)
        ]
        leadership_titles = [
            str(x)
            for x in CourseAudienceLeadership.objects.filter(course=course).values_list("leadership_title", flat=True)
        ]
        return success_response(
            {
                "courseId": str(course.id),
                "targetDepartmentIds": dept_ids,
                "targetJobTitleIds": job_ids,
                "targetLeadershipTitles": leadership_titles,
                "message": f"تم تحديث قواعد ظهور الدورة «{course.title}» بنجاح.",
            }
        )


class AdminScopeCourseVisibilityUpdateView(APIView):
    """PUT /api/admin/course-visibility/scope — Assign courses to a department, job title, or leadership title."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response(
                "PERMISSION_DENIED",
                "ليس لديك صلاحية تعديل ظهور الدورات.",
                status.HTTP_403_FORBIDDEN,
            )

        scope_type = str(request.data.get("scopeType") or "").strip()
        raw_scope_id = str(request.data.get("scopeId") or "").strip()
        raw_course_ids = request.data.get("courseIds")
        if (
            scope_type not in {"department", "job_title", "leadership"}
            or not raw_scope_id
            or (scope_type in {"department", "job_title"} and not raw_scope_id.isdigit())
            or not isinstance(raw_course_ids, list)
        ):
            return error_response(
                "VALIDATION_ERROR",
                "بيانات التحديد غير صالحة.",
                status.HTTP_400_BAD_REQUEST,
            )

        selected_course_ids = {int(str(cid)) for cid in raw_course_ids if str(cid).isdigit()}

        from django.db import transaction
        from apps.courses.models import (
            CourseAudienceDepartment,
            CourseAudienceJobTitle,
            CourseAudienceLeadership,
        )
        from apps.governance.services.governance_service import record_audit_log

        with transaction.atomic():
            if scope_type == "department":
                scope_id = int(raw_scope_id)
                CourseAudienceDepartment.objects.filter(department_id=scope_id).delete()
                for cid in selected_course_ids:
                    if Course.objects.filter(pk=cid).exists():
                        CourseAudienceDepartment.objects.create(course_id=cid, department_id=scope_id)
            elif scope_type == "job_title":
                scope_id = int(raw_scope_id)
                CourseAudienceJobTitle.objects.filter(job_title_id=scope_id).delete()
                for cid in selected_course_ids:
                    if Course.objects.filter(pk=cid).exists():
                        CourseAudienceJobTitle.objects.create(course_id=cid, job_title_id=scope_id)
            else:
                CourseAudienceLeadership.objects.filter(leadership_title=raw_scope_id).delete()
                for cid in selected_course_ids:
                    if Course.objects.filter(pk=cid).exists():
                        CourseAudienceLeadership.objects.create(course_id=cid, leadership_title=raw_scope_id[:100])

            record_audit_log(
                action="course.scope_visibility_updated",
                actor=request.user,
                target_entity_type=(
                    "Department"
                    if scope_type == "department"
                    else ("JobTitle" if scope_type == "job_title" else "LeadershipTitle")
                ),
                target_entity_id=raw_scope_id,
                details_snapshot={"courseIds": [str(x) for x in selected_course_ids]},
            )

        return success_response(
            {
                "updated": True,
                "scopeType": scope_type,
                "scopeId": raw_scope_id,
                "courseIds": [str(x) for x in selected_course_ids],
                "message": "تم حفظ تخصيص الكورسات بنجاح.",
            }
        )


class CourseArchiveZipDownloadView(APIView):
    """Stream a ZIP archive of eligible downloadable course files when courseZipPolicy allows."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        import re as _re
        import tempfile
        import zipfile
        from urllib.parse import quote
        from django.http import StreamingHttpResponse
        from apps.learning.models import CertificateRecord, CourseAttempt, Enrollment, LessonProgress
        from apps.media.models import MediaContentReference
        from infrastructure.storage import LocalMediaStorage

        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response(
                "RESOURCE_NOT_FOUND",
                "المقرر المطلوب غير موجود.",
                status.HTTP_404_NOT_FOUND,
            )

        is_staff_or_lecturer = (
            request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
            or course.primary_lecturer_id == request.user.id
            or CourseAssistantLecturer.objects.filter(course=course, user=request.user).exists()
        )

        pub = PublishedCourseVersion.objects.filter(course=course).order_by("-version_number").first()
        draft = CourseDraft.objects.filter(course=course).first()
        source_obj = pub if pub is not None else draft
        zip_policy = getattr(source_obj, "course_zip_policy", "disabled") or "disabled"

        if not is_staff_or_lecturer:
            if zip_policy == "disabled":
                return error_response(
                    "ZIP_DOWNLOAD_DISABLED",
                    "تنزيل أرشيف الدورة المجمع غير مفعل لهذا المقرر.",
                    status.HTTP_403_FORBIDDEN,
                )
            enrolled = Enrollment.objects.filter(
                user=request.user,
                course=course,
            ).exists()
            if not enrolled:
                return error_response(
                    "ENROLLMENT_REQUIRED",
                    "يجب التسجيل في الدورة أولاً لتنزيل الأرشيف.",
                    status.HTTP_403_FORBIDDEN,
                )

        # Compute trainee completion status if needed
        is_course_completed = is_staff_or_lecturer
        completed_lesson_ids: set[int] = set()
        if not is_staff_or_lecturer:
            attempts = CourseAttempt.objects.filter(
                enrollment__user=request.user,
                enrollment__course=course,
            )
            completed_lesson_ids = set(
                LessonProgress.objects.filter(
                    course_attempt__in=attempts,
                    is_completed=True,
                ).values_list("lesson_item_id", flat=True)
            )
            if CertificateRecord.objects.filter(course_attempt__in=attempts).exists():
                is_course_completed = True
            elif pub is not None:
                pub_lesson_ids = set(
                    LessonItem.objects.filter(module__published_version=pub).values_list("id", flat=True)
                )
                if pub_lesson_ids and pub_lesson_ids.issubset(completed_lesson_ids):
                    is_course_completed = True

        if not is_staff_or_lecturer and zip_policy == "after_course_completion" and not is_course_completed:
            return error_response(
                "COURSE_NOT_COMPLETED",
                "الأرشيف المجمع متاح فقط بعد إتمام الدورة التدريبية بنسبة 100%.",
                status.HTTP_403_FORBIDDEN,
            )

        mods: list[Module]
        refs: dict[str, MediaContentReference]
        if pub is not None:
            mods = list(Module.objects.filter(published_version=pub).order_by("sort_order", "id"))
            refs = {
                r.title: r
                for r in MediaContentReference.objects.filter(
                    published_version=pub, detached_at__isnull=True
                ).select_related("media_asset")
            }
        elif draft is not None:
            mods = list(Module.objects.filter(course_draft=draft).order_by("sort_order", "id"))
            refs = {
                r.title: r
                for r in MediaContentReference.objects.filter(
                    course_draft=draft, detached_at__isnull=True
                ).select_related("media_asset")
            }
        else:
            mods = []
            refs = {}

        storage = LocalMediaStorage()
        tmp = tempfile.TemporaryFile()
        added_count = 0
        used_arcnames: set[str] = set()

        with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for mod in mods:
                safe_ch = _re.sub(r'[\\/:*?"<>|]+', "_", mod.title).strip() or f"Chapter_{mod.id}"
                lessons = LessonItem.objects.filter(module=mod).order_by("sort_order", "id")
                for lesson in lessons:
                    dl_policy = getattr(lesson, "download_policy", "never") or "never"
                    if not is_staff_or_lecturer:
                        if dl_policy == "never":
                            continue
                        if dl_policy == "after_item_completion" and lesson.id not in completed_lesson_ids:
                            continue
                        if dl_policy == "after_course_completion" and not is_course_completed:
                            continue
                    ref = refs.get(lesson.title)
                    if ref is None or not ref.media_asset.storage_key:
                        continue
                    try:
                        file_path = storage.resolve_safe_path(ref.media_asset.storage_key)
                    except Exception:
                        continue
                    if not file_path.exists() or not file_path.is_file():
                        continue
                    ext = file_path.suffix or ""
                    safe_item = _re.sub(r'[\\/:*?"<>|]+', "_", lesson.title).strip() or f"Lesson_{lesson.id}"
                    arcname = f"{safe_ch}/{safe_item}{ext}"
                    if arcname in used_arcnames:
                        arcname = f"{safe_ch}/{safe_item}_{lesson.id}{ext}"
                    used_arcnames.add(arcname)
                    zf.write(file_path, arcname=arcname)
                    added_count += 1

        if added_count == 0:
            tmp.close()
            return error_response(
                "NO_DOWNLOADABLE_FILES",
                "لا توجد ملفات مرفقة مؤهلة للتنزيل في هذا المقرر حالياً.",
                status.HTTP_404_NOT_FOUND,
            )

        total_size = tmp.tell()
        tmp.seek(0)

        def _stream_chunks():
            try:
                while True:
                    chunk = tmp.read(64 * 1024)
                    if not chunk:
                        break
                    yield chunk
            finally:
                tmp.close()

        safe_course = _re.sub(r'[\\/:*?"<>|]+', "_", course.title).strip() or f"Course_{course.id}"
        filename = f"{safe_course}_Bundle.zip"
        is_blob_fetch = request.headers.get("X-MetroLMS-Blob") == "1"
        content_type = "application/x-metrolms-bundle" if is_blob_fetch else "application/zip"
        response = StreamingHttpResponse(_stream_chunks(), content_type=content_type)
        response["Content-Length"] = str(total_size)
        response["Cache-Control"] = "no-store"
        if not is_blob_fetch:
            response["Content-Disposition"] = f"attachment; filename*=UTF-8''{quote(filename)}"
        return response


