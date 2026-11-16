"""Serializers for apps.learning (Enrollment, Grants, CourseAttempt, LessonProgress)."""
from __future__ import annotations

from rest_framework import serializers

from apps.learning.models import CourseAttempt, Enrollment, EnrollmentSourceGrant, LessonProgress
from apps.learning.services.learning_service import compute_course_progress


class EnrollmentSourceGrantSerializer(serializers.ModelSerializer):
    sourceType = serializers.CharField(source="source_type")
    trainingGroupId = serializers.IntegerField(source="training_group_id", allow_null=True)

    class Meta:
        model = EnrollmentSourceGrant
        fields = ["id", "sourceType", "trainingGroupId"]


class CourseAttemptSerializer(serializers.ModelSerializer):
    enrollmentId = serializers.IntegerField(source="enrollment_id")
    publishedVersionId = serializers.IntegerField(source="published_version_id")
    groupRenewalCycleId = serializers.IntegerField(source="group_renewal_cycle_id", allow_null=True)
    isSealed = serializers.BooleanField(source="is_sealed")
    progress = serializers.SerializerMethodField()

    class Meta:
        model = CourseAttempt
        fields = ["id", "enrollmentId", "publishedVersionId", "groupRenewalCycleId", "isSealed", "progress"]

    def get_progress(self, obj: CourseAttempt) -> dict:
        return compute_course_progress(obj)


class EnrollmentSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="user_id")
    courseId = serializers.IntegerField(source="course_id")
    enrolledAt = serializers.DateTimeField(source="enrolled_at")
    sourceGrants = EnrollmentSourceGrantSerializer(source="source_grants", many=True, read_only=True)
    hasActiveAccess = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ["id", "userId", "courseId", "enrolledAt", "hasActiveAccess", "sourceGrants"]

    def get_hasActiveAccess(self, obj: Enrollment) -> bool:
        return obj.source_grants.exists()


class LessonProgressSerializer(serializers.ModelSerializer):
    courseAttemptId = serializers.IntegerField(source="course_attempt_id")
    lessonItemId = serializers.IntegerField(source="lesson_item_id")
    isCompleted = serializers.BooleanField(source="is_completed")
    lastPositionSeconds = serializers.IntegerField(source="last_position_seconds")
    furthestWatchedSeconds = serializers.IntegerField(source="furthest_watched_seconds")
    eligibleViewingSeconds = serializers.IntegerField(source="eligible_viewing_seconds")
    watchCount = serializers.IntegerField(source="watch_count")
    updatedAt = serializers.DateTimeField(source="updated_at")

    class Meta:
        model = LessonProgress
        fields = [
            "id",
            "courseAttemptId",
            "lessonItemId",
            "isCompleted",
            "lastPositionSeconds",
            "furthestWatchedSeconds",
            "eligibleViewingSeconds",
            "watchCount",
            "updatedAt",
        ]

