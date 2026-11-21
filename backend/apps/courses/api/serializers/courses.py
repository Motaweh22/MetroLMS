"""Serializers for apps.courses."""
from __future__ import annotations

from rest_framework import serializers

from apps.courses.models import (
    Course,
    CourseAudienceDepartment,
    CourseAudienceJobTitle,
    CourseAudienceMetroLine,
    CourseComment,
    CourseCommentReport,
    CourseDraft,
    CourseReviewSubmission,
    LessonItem,
    Module,
    PublishedCourseVersion,
)


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
    estimatedHours = serializers.SerializerMethodField()
    prerequisites = serializers.SerializerMethodField()
    modules = serializers.SerializerMethodField()
    chapters = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Course
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
            "modules",
            "chapters",
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

    def get_duration(self, obj: Course) -> str:
        return "—"

    def get_rating(self, obj: Course) -> float:
        return 0.0

    def get_targetDepartmentIds(self, obj: Course) -> list[int]:
        return list(
            CourseAudienceDepartment.objects.filter(course=obj)
            .order_by("department_id")
            .values_list("department_id", flat=True)
        )

    def get_targetJobTitleIds(self, obj: Course) -> list[int]:
        return list(
            CourseAudienceJobTitle.objects.filter(course=obj)
            .order_by("job_title_id")
            .values_list("job_title_id", flat=True)
        )

    def get_targetJobTitles(self, obj: Course) -> list[str]:
        return list(
            CourseAudienceJobTitle.objects.filter(course=obj)
            .select_related("job_title")
            .order_by("job_title_id")
            .values_list("job_title__name_ar", flat=True)
        )

    def get_targetMetroLineIds(self, obj: Course) -> list[int]:
        return list(
            CourseAudienceMetroLine.objects.filter(course=obj)
            .order_by("metro_line_id")
            .values_list("metro_line_id", flat=True)
        )

    def get_ratingCount(self, obj: Course) -> int:
        return 0

    def get_enrollmentCount(self, obj: Course) -> int:
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

    def get_estimatedHours(self, obj: Course) -> int:
        return 0

    def get_thumbnail(self, obj: Course) -> str | None:
        from apps.media.models import MediaContentReference

        draft = CourseDraft.objects.filter(course=obj).first()
        if draft is not None:
            ref = MediaContentReference.objects.filter(
                course_draft=draft, title="__course_cover__", detached_at__isnull=True
            ).first()
            if ref is not None:
                return f"/api/media/assets/{ref.media_asset_id}/stream"
        pub = PublishedCourseVersion.objects.filter(course=obj).order_by("-version_number").first()
        if pub is not None:
            ref = MediaContentReference.objects.filter(
                published_version=pub, title="__course_cover__", detached_at__isnull=True
            ).first()
            if ref is not None:
                return f"/api/media/assets/{ref.media_asset_id}/stream"
        return None

    def get_hasDraft(self, obj: Course) -> bool:
        if obj.lifecycle_status != "Published":
            return False
        draft = CourseDraft.objects.filter(course=obj).first()
        if draft is None:
            return False
        pub = PublishedCourseVersion.objects.filter(course=obj).order_by("-version_number").first()
        if pub is None:
            return True
        return bool(draft.updated_at and pub.published_at and draft.updated_at > pub.published_at)

    def get_prerequisites(self, obj: Course) -> list:
        return []

    def get_modules(self, obj: Course) -> list:
        from apps.media.models import MediaContentReference

        draft = CourseDraft.objects.filter(course=obj).first()
        if draft is not None:
            mods = Module.objects.filter(course_draft=draft).order_by("sort_order", "id")
            refs = {
                r.title: r
                for r in MediaContentReference.objects.filter(
                    course_draft=draft, detached_at__isnull=True
                ).select_related("media_asset")
            }
        else:
            pub = PublishedCourseVersion.objects.filter(course=obj).order_by("-version_number").first()
            mods = Module.objects.filter(published_version=pub).order_by("sort_order", "id") if pub else []
            refs = (
                {
                    r.title: r
                    for r in MediaContentReference.objects.filter(
                        published_version=pub, detached_at__isnull=True
                    ).select_related("media_asset")
                }
                if pub
                else {}
            )

        result = []
        for m in mods:
            lessons = LessonItem.objects.filter(module=m).order_by("sort_order", "id")
            items_out = []
            for l in lessons:
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
        return result

    def get_chapters(self, obj: Course) -> list:
        return self.get_modules(obj)


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

    courseId = serializers.IntegerField(source="course_id", read_only=True)
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

