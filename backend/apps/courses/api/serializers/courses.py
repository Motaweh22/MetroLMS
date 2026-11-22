"""Serializers for apps.courses."""
from __future__ import annotations

from django.db import models
from django.db.models import Count, Q
from rest_framework import serializers

from apps.courses.models import (
    Course,
    CourseAudienceDepartment,
    CourseAudienceJobTitle,
    CourseAudienceLeadership,
    CourseAudienceMetroLine,
    CourseComment,
    CourseCommentReport,
    CourseDraft,
    CourseReviewSubmission,
    LessonItem,
    Module,
    PublishedCourseVersion,
)


class CourseListSerializer(serializers.ListSerializer):
    """Bulk-prefetch course relations once per list response to eliminate N+1 queries."""

    def to_representation(self, data):
        courses = list(data.all() if isinstance(data, models.Manager) else data)
        if courses:
            self._prefetch_courses(courses)
        return [self.child.to_representation(item) for item in courses]

    @staticmethod
    def _prefetch_courses(courses: list[Course]) -> None:
        from apps.learning.models import Enrollment
        from apps.media.models import MediaContentReference

        course_ids = [c.id for c in courses]

        # 1. Drafts
        draft_by_course: dict[int, CourseDraft] = {}
        for d in CourseDraft.objects.filter(course_id__in=course_ids):
            draft_by_course.setdefault(d.course_id, d)

        # 2. Latest published versions
        pub_by_course: dict[int, PublishedCourseVersion] = {}
        for p in PublishedCourseVersion.objects.filter(course_id__in=course_ids).order_by(
            "course_id", "-version_number"
        ):
            pub_by_course.setdefault(p.course_id, p)

        draft_ids = [d.id for d in draft_by_course.values()]
        pub_ids = [p.id for p in pub_by_course.values()]

        # 3. Active media references (for drafts and latest published versions)
        refs_by_draft: dict[int, list] = {}
        refs_by_pub: dict[int, list] = {}
        ref_filter = Q()
        if draft_ids:
            ref_filter |= Q(course_draft_id__in=draft_ids)
        if pub_ids:
            ref_filter |= Q(published_version_id__in=pub_ids)
        if draft_ids or pub_ids:
            for ref in MediaContentReference.objects.filter(
                ref_filter, detached_at__isnull=True
            ).select_related("media_asset"):
                if ref.course_draft_id:
                    refs_by_draft.setdefault(ref.course_draft_id, []).append(ref)
                if ref.published_version_id:
                    refs_by_pub.setdefault(ref.published_version_id, []).append(ref)

        # 4. Modules & LessonItems
        mods_by_draft: dict[int, list[Module]] = {}
        mods_by_pub: dict[int, list[Module]] = {}
        all_mod_ids: list[int] = []
        mod_filter = Q()
        if draft_ids:
            mod_filter |= Q(course_draft_id__in=draft_ids)
        if pub_ids:
            mod_filter |= Q(published_version_id__in=pub_ids)
        if draft_ids or pub_ids:
            for m in Module.objects.filter(mod_filter).order_by("sort_order", "id"):
                all_mod_ids.append(m.id)
                if m.course_draft_id:
                    mods_by_draft.setdefault(m.course_draft_id, []).append(m)
                if m.published_version_id:
                    mods_by_pub.setdefault(m.published_version_id, []).append(m)

        lessons_by_mod: dict[int, list[LessonItem]] = {}
        if all_mod_ids:
            for lesson in LessonItem.objects.filter(module_id__in=all_mod_ids).order_by("sort_order", "id"):
                lessons_by_mod.setdefault(lesson.module_id, []).append(lesson)

        # 5. Audience tables (4 bulk queries)
        dept_map: dict[int, list[int]] = {}
        for cid, did in (
            CourseAudienceDepartment.objects.filter(course_id__in=course_ids)
            .order_by("department_id")
            .values_list("course_id", "department_id")
        ):
            dept_map.setdefault(cid, []).append(did)

        job_id_map: dict[int, list[int]] = {}
        job_name_map: dict[int, list[str]] = {}
        for cid, jid, jname in (
            CourseAudienceJobTitle.objects.filter(course_id__in=course_ids)
            .select_related("job_title")
            .order_by("job_title_id")
            .values_list("course_id", "job_title_id", "job_title__name_ar")
        ):
            job_id_map.setdefault(cid, []).append(jid)
            job_name_map.setdefault(cid, []).append(jname)

        line_map: dict[int, list[int]] = {}
        for cid, lid in (
            CourseAudienceMetroLine.objects.filter(course_id__in=course_ids)
            .order_by("metro_line_id")
            .values_list("course_id", "metro_line_id")
        ):
            line_map.setdefault(cid, []).append(lid)

        lead_map: dict[int, list[str]] = {}
        for cid, title in (
            CourseAudienceLeadership.objects.filter(course_id__in=course_ids)
            .order_by("id")
            .values_list("course_id", "leadership_title")
        ):
            lead_map.setdefault(cid, []).append(title)

        # 6. Enrollment counts (1 bulk query)
        enr_counts: dict[int, int] = {
            row["course_id"]: row["cnt"]
            for row in Enrollment.objects.filter(
                course_id__in=course_ids, source_grants__isnull=False
            )
            .values("course_id")
            .annotate(cnt=Count("id", distinct=True))
        }

        # Attach prefetched caches onto each Course instance
        for c in courses:
            draft = draft_by_course.get(c.id)
            pub = pub_by_course.get(c.id)
            c._ser_draft = draft
            c._ser_pub = pub
            if draft is not None:
                c._ser_refs = refs_by_draft.get(draft.id, [])
                c._ser_mods_raw = mods_by_draft.get(draft.id, [])
            elif pub is not None:
                c._ser_refs = refs_by_pub.get(pub.id, [])
                c._ser_mods_raw = mods_by_pub.get(pub.id, [])
            else:
                c._ser_refs = []
                c._ser_mods_raw = []
            pub_cover = None
            if pub is not None:
                for ref in refs_by_pub.get(pub.id, []):
                    if ref.title == "__course_cover__":
                        pub_cover = ref
                        break
            c._ser_pub_cover = pub_cover
            c._ser_lessons_by_mod = lessons_by_mod
            c._ser_dept_ids = dept_map.get(c.id, [])
            c._ser_job_ids = job_id_map.get(c.id, [])
            c._ser_job_names = job_name_map.get(c.id, [])
            c._ser_line_ids = line_map.get(c.id, [])
            c._ser_lead_titles = lead_map.get(c.id, [])
            c._ser_enrollment_count = enr_counts.get(c.id, 0)


class CourseSerializer(serializers.ModelSerializer):
    """Serializer for Course summary & details."""

    id = serializers.CharField(read_only=True)
    courseType = serializers.CharField(source="course_type", read_only=True)
    mainCourseId = serializers.IntegerField(source="main_course_id", read_only=True)
    primaryLecturerId = serializers.IntegerField(source="primary_lecturer_id", read_only=True)
    lifecycleStatus = serializers.CharField(source="lifecycle_status", read_only=True)
    accessMode = serializers.CharField(source="access_mode", read_only=True)
    qrSettings = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    level = serializers.SerializerMethodField()
    lecturer = serializers.SerializerMethodField()
    lecturerName = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    hasDraft = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    ratingCount = serializers.SerializerMethodField()
    enrollmentCount = serializers.SerializerMethodField()
    targetDepartmentIds = serializers.SerializerMethodField()
    targetJobTitleIds = serializers.SerializerMethodField()
    targetJobTitles = serializers.SerializerMethodField()
    targetMetroLineIds = serializers.SerializerMethodField()
    targetLeadershipTitles = serializers.SerializerMethodField()
    estimatedHours = serializers.SerializerMethodField()
    prerequisites = serializers.SerializerMethodField()
    modules = serializers.SerializerMethodField()
    chapters = serializers.SerializerMethodField()
    courseZipPolicy = serializers.SerializerMethodField()
    refresherConfig = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Course
        list_serializer_class = CourseListSerializer
        fields = [
            "id",
            "title",
            "description",
            "courseType",
            "mainCourseId",
            "primaryLecturerId",
            "lifecycleStatus",
            "accessMode",
            "qrSettings",
            "status",
            "level",
            "lecturer",
            "lecturerName",
            "duration",
            "thumbnail",
            "hasDraft",
            "rating",
            "ratingCount",
            "enrollmentCount",
            "estimatedHours",
            "prerequisites",
            "targetDepartmentIds",
            "targetJobTitleIds",
            "targetJobTitles",
            "targetMetroLineIds",
            "targetLeadershipTitles",
            "modules",
            "chapters",
            "courseZipPolicy",
            "refresherConfig",
            "createdAt",
            "updatedAt",
        ]

    def get_status(self, obj: Course) -> str:
        mapping = {
            "Draft": "draft",
            "InReview": "pending_admin",
            "PendingReview": "pending_admin",
            "Published": "published",
            "Rejected": "rejected",
            "Archived": "archived",
        }
        return mapping.get(obj.lifecycle_status, "draft")

    def get_level(self, obj: Course) -> str:
        return "تذكيرية" if obj.course_type == "reminder" else "مبتدئ"

    def get_lecturer(self, obj: Course) -> str:
        return obj.primary_lecturer.full_name if obj.primary_lecturer else ""

    def get_lecturerName(self, obj: Course) -> str:
        return obj.primary_lecturer.full_name if obj.primary_lecturer else "محاضر معتمد"

    def _get_draft(self, obj: Course):
        if not hasattr(obj, "_ser_draft"):
            obj._ser_draft = CourseDraft.objects.filter(course=obj).first()
        return obj._ser_draft

    def _get_latest_pub(self, obj: Course):
        if not hasattr(obj, "_ser_pub"):
            obj._ser_pub = PublishedCourseVersion.objects.filter(course=obj).order_by("-version_number").first()
        return obj._ser_pub

    def _get_active_refs(self, obj: Course) -> list:
        if not hasattr(obj, "_ser_refs"):
            from apps.media.models import MediaContentReference

            draft = self._get_draft(obj)
            if draft is not None:
                obj._ser_refs = list(
                    MediaContentReference.objects.filter(
                        course_draft=draft, detached_at__isnull=True
                    ).select_related("media_asset")
                )
            else:
                pub = self._get_latest_pub(obj)
                obj._ser_refs = (
                    list(
                        MediaContentReference.objects.filter(
                            published_version=pub, detached_at__isnull=True
                        ).select_related("media_asset")
                    )
                    if pub is not None
                    else []
                )
        return obj._ser_refs

    def _total_duration_seconds(self, obj: Course) -> int:
        modules = self.get_modules(obj)
        total = 0
        for mod in modules:
            for item in mod.get("items", []):
                try:
                    total += max(0, int(item.get("durationSeconds") or 0))
                except (TypeError, ValueError):
                    pass
        return total

    def get_duration(self, obj: Course) -> str:
        total_sec = self._total_duration_seconds(obj)
        if total_sec <= 0:
            return "—"
        total_min = round(total_sec / 60)
        if total_min < 1:
            return "أقل من دقيقة"
        if total_min < 60:
            return f"{total_min} دقيقة"
        hours, rem_min = divmod(total_min, 60)
        if rem_min == 0:
            return f"{hours} ساعة"
        return f"{hours} ساعة و {rem_min} دقيقة"

    def get_rating(self, obj: Course) -> float:
        return 0.0

    def get_targetDepartmentIds(self, obj: Course) -> list[int]:
        if hasattr(obj, "_ser_dept_ids"):
            return obj._ser_dept_ids
        return list(
            CourseAudienceDepartment.objects.filter(course=obj)
            .order_by("department_id")
            .values_list("department_id", flat=True)
        )

    def get_targetJobTitleIds(self, obj: Course) -> list[int]:
        if hasattr(obj, "_ser_job_ids"):
            return obj._ser_job_ids
        return list(
            CourseAudienceJobTitle.objects.filter(course=obj)
            .order_by("job_title_id")
            .values_list("job_title_id", flat=True)
        )

    def get_targetJobTitles(self, obj: Course) -> list[str]:
        if hasattr(obj, "_ser_job_names"):
            return obj._ser_job_names
        return list(
            CourseAudienceJobTitle.objects.filter(course=obj)
            .select_related("job_title")
            .order_by("job_title_id")
            .values_list("job_title__name_ar", flat=True)
        )

    def get_targetMetroLineIds(self, obj: Course) -> list[int]:
        if hasattr(obj, "_ser_line_ids"):
            return obj._ser_line_ids
        return list(
            CourseAudienceMetroLine.objects.filter(course=obj)
            .order_by("metro_line_id")
            .values_list("metro_line_id", flat=True)
        )

    def get_targetLeadershipTitles(self, obj: Course) -> list[str]:
        if hasattr(obj, "_ser_lead_titles"):
            return obj._ser_lead_titles
        return list(
            CourseAudienceLeadership.objects.filter(course=obj)
            .order_by("id")
            .values_list("leadership_title", flat=True)
        )

    def get_ratingCount(self, obj: Course) -> int:
        return 0

    def get_enrollmentCount(self, obj: Course) -> int:
        if hasattr(obj, "_ser_enrollment_count"):
            return obj._ser_enrollment_count
        return obj.enrollments.filter(source_grants__isnull=False).distinct().count()

    def get_qrSettings(self, obj: Course) -> dict:
        qr = getattr(obj, "qr_code", None)
        if qr is None:
            return {
                "token": None,
                "isEnabled": True,
                "qrMode": "view_only",
                "expiresAt": None,
                "updatedAt": None,
            }
        return {
            "token": qr.token,
            "isEnabled": qr.is_enabled,
            "qrMode": qr.qr_mode,
            "expiresAt": qr.expires_at.isoformat() if qr.expires_at else None,
            "updatedAt": qr.updated_at.isoformat() if qr.updated_at else None,
        }

    def get_estimatedHours(self, obj: Course) -> float:
        total_sec = self._total_duration_seconds(obj)
        if total_sec <= 0:
            return 0
        return round(total_sec / 3600, 1)

    def get_thumbnail(self, obj: Course) -> str | None:
        for ref in self._get_active_refs(obj):
            if ref.title == "__course_cover__":
                return f"/api/media/assets/{ref.media_asset_id}/stream"
        # Fallback: if draft has no cover, check latest published version
        draft = self._get_draft(obj)
        if draft is not None:
            if hasattr(obj, "_ser_pub_cover"):
                pub_ref = obj._ser_pub_cover
            else:
                pub = self._get_latest_pub(obj)
                if pub is not None:
                    from apps.media.models import MediaContentReference

                    pub_ref = MediaContentReference.objects.filter(
                        published_version=pub, title="__course_cover__", detached_at__isnull=True
                    ).first()
                else:
                    pub_ref = None
            if pub_ref is not None:
                return f"/api/media/assets/{pub_ref.media_asset_id}/stream"
        return None

    def get_hasDraft(self, obj: Course) -> bool:
        if obj.lifecycle_status != "Published":
            return False
        draft = self._get_draft(obj)
        if draft is None:
            return False
        pub = self._get_latest_pub(obj)
        if pub is None:
            return True
        return bool(draft.updated_at and pub.published_at and draft.updated_at > pub.published_at)

    def get_prerequisites(self, obj: Course) -> list:
        return []

    def get_modules(self, obj: Course) -> list:
        if hasattr(obj, "_ser_modules"):
            return obj._ser_modules

        if hasattr(obj, "_ser_mods_raw"):
            mods = obj._ser_mods_raw
        else:
            draft = self._get_draft(obj)
            if draft is not None:
                mods = list(Module.objects.filter(course_draft=draft).order_by("sort_order", "id"))
            else:
                pub = self._get_latest_pub(obj)
                mods = list(Module.objects.filter(published_version=pub).order_by("sort_order", "id")) if pub else []

        refs = {r.title: r for r in self._get_active_refs(obj)}
        if hasattr(obj, "_ser_lessons_by_mod"):
            lessons_by_mod = obj._ser_lessons_by_mod
        else:
            mod_ids = [m.id for m in mods]
            lessons_by_mod = {mid: [] for mid in mod_ids}
            if mod_ids:
                for lesson in LessonItem.objects.filter(module_id__in=mod_ids).order_by("sort_order", "id"):
                    lessons_by_mod.setdefault(lesson.module_id, []).append(lesson)

        result = []
        for m in mods:
            items_out = []
            for l in lessons_by_mod.get(m.id, []):
                ref = refs.get(l.title)
                dl_policy = getattr(l, "download_policy", "never") or "never"
                item_dict = {
                    "id": str(l.id),
                    "title": l.title,
                    "type": l.lesson_type,
                    "durationSeconds": l.duration_seconds or 0,
                    "externalVideoUrl": l.external_video_url or "",
                    "downloadPolicy": dl_policy,
                    "canDownload": dl_policy != "never",
                }
                if ref is not None:
                    item_dict["mediaId"] = str(ref.media_asset_id)
                    item_dict["mediaReferenceId"] = str(ref.id)
                    item_dict["url"] = f"/api/media/references/{ref.id}/stream"
                    item_dict["originalFileName"] = ref.media_asset.file_name
                    item_dict["fileSizeBytes"] = ref.media_asset.size_bytes
                    item_dict["mimeType"] = ref.media_asset.mime_type
                    if l.lesson_type == "video":
                        item_dict["videoSourceType"] = "upload"
                elif l.external_video_url:
                    item_dict["url"] = l.external_video_url
                items_out.append(item_dict)
            result.append({"id": str(m.id), "title": m.title, "items": items_out})
        obj._ser_modules = result
        return result

    def get_chapters(self, obj: Course) -> list:
        return self.get_modules(obj)

    def get_courseZipPolicy(self, obj: Course) -> str:
        draft = self._get_draft(obj)
        if draft is not None:
            return getattr(draft, "course_zip_policy", "disabled") or "disabled"
        pub = self._get_latest_pub(obj)
        if pub is not None:
            return getattr(pub, "course_zip_policy", "disabled") or "disabled"
        return "disabled"

    def get_refresherConfig(self, obj: Course):
        import copy

        draft = self._get_draft(obj)
        if draft is not None:
            raw_cfg = draft.refresher_config_json
        else:
            pub = self._get_latest_pub(obj)
            raw_cfg = pub.refresher_config_json if pub is not None else None

        if not isinstance(raw_cfg, dict):
            return None

        refs = {r.title: r for r in self._get_active_refs(obj) if r.title.startswith("__refresher__")}
        cfg = copy.deepcopy(raw_cfg)

        def _hydrate_items(items_list):
            if not isinstance(items_list, list):
                return
            for item in items_list:
                if not isinstance(item, dict):
                    continue
                item_id = str(item.get("id") or "").strip()
                ref = refs.get(f"__refresher__{item_id}") if item_id else None
                if ref is not None:
                    item["mediaId"] = str(ref.media_asset_id)
                    item["mediaReferenceId"] = str(ref.id)
                    item["url"] = f"/api/media/references/{ref.id}/stream"
                    item["originalFileName"] = ref.media_asset.file_name
                    item["fileSizeBytes"] = ref.media_asset.size_bytes
                    item["mimeType"] = ref.media_asset.mime_type
                    if item.get("type") == "video":
                        item["videoSourceType"] = "upload"

        for ch in cfg.get("extraChapters", []) or []:
            if isinstance(ch, dict):
                _hydrate_items(ch.get("items"))

        extra_by_ch = cfg.get("extraItemsByChapter")
        if isinstance(extra_by_ch, dict):
            for items_list in extra_by_ch.values():
                _hydrate_items(items_list)

        return cfg


class PublishedCourseVersionSerializer(serializers.ModelSerializer):
    """Serializer for PublishedCourseVersion."""

    courseId = serializers.IntegerField(source="course_id", read_only=True)
    versionNumber = serializers.IntegerField(source="version_number", read_only=True)
    publishedAt = serializers.DateTimeField(source="published_at", read_only=True)

    class Meta:
        model = PublishedCourseVersion
        fields = ["id", "courseId", "versionNumber", "publishedAt"]


class CourseReviewSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for CourseReviewSubmission."""

    courseId = serializers.IntegerField(source="course_id", read_only=True)
    reviewStatus = serializers.CharField(source="review_status", read_only=True)
    submittedAt = serializers.DateTimeField(source="submitted_at", read_only=True)
    decidedAt = serializers.DateTimeField(source="decided_at", read_only=True)

    class Meta:
        model = CourseReviewSubmission
        fields = ["id", "courseId", "reviewStatus", "submittedAt", "decidedAt"]


class CourseCommentSerializer(serializers.ModelSerializer):
    """Serializer for CourseComment enforcing D-02 anonymization label."""

    id = serializers.CharField(read_only=True)
    courseId = serializers.CharField(source="course_id", read_only=True)
    courseTitle = serializers.CharField(source="course.title", read_only=True)
    authorName = serializers.SerializerMethodField()
    userName = serializers.SerializerMethodField()
    userId = serializers.SerializerMethodField()
    userRole = serializers.SerializerMethodField()
    text = serializers.CharField(source="body", read_only=True)
    reported = serializers.SerializerMethodField()
    isAuthorDeleted = serializers.BooleanField(source="is_author_deleted", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = CourseComment
        fields = [
            "id",
            "courseId",
            "courseTitle",
            "authorName",
            "userName",
            "userId",
            "userRole",
            "isAuthorDeleted",
            "body",
            "text",
            "reported",
            "createdAt",
        ]

    def get_authorName(self, obj: CourseComment) -> str:
        if obj.is_author_deleted or obj.author_user is None:
            return "مستخدم محذوف"
        return obj.author_user.full_name

    def get_userName(self, obj: CourseComment) -> str:
        return self.get_authorName(obj)

    def get_userId(self, obj: CourseComment) -> str:
        if obj.is_author_deleted or obj.author_user_id is None:
            return ""
        return str(obj.author_user_id)

    def get_userRole(self, obj: CourseComment) -> str:
        if obj.is_author_deleted or obj.author_user is None:
            return "user"
        return str(getattr(obj.author_user, "role_id", None) or "user")

    def get_reported(self, obj: CourseComment) -> bool:
        return CourseCommentReport.objects.filter(comment=obj, status="Pending").exists()


class CourseCommentReportSerializer(serializers.ModelSerializer):
    """Serializer for CourseCommentReport."""

    commentId = serializers.IntegerField(source="comment_id", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = CourseCommentReport
        fields = ["id", "commentId", "reason", "status", "createdAt"]

