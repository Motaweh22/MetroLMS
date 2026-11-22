"""D-01 Atomic User Deletion Cascade across all 8 Features (ON DELETE NO ACTION)."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.communications.models import NotificationItem, UserWhatsAppVisibility
from apps.courses.models import (
    Course,
    CourseAssistantLecturer,
    CourseComment,
    CourseCommentReport,
    CourseDraft,
    CourseReviewSubmission,
    PublishedCourseVersion,
)
from apps.governance.services.governance_service import record_audit_log
from apps.groups.models import GroupAssistantAssignment, GroupJoinRequest, GroupMembership
from apps.identity.models import (
    DelegatedAuthority,
    DeletedUserTombstone,
    ServerSession,
    User,
    UserPermissionOverride,
)
from apps.learning.models import (
    CertificateRecord,
    CourseAttempt,
    Enrollment,
    EnrollmentSourceGrant,
    LessonProgress,
)
from apps.media.models import MediaAsset
from apps.organization.models import (
    HistoricalServiceTrainingRecord,
    UserJobTitle,
    UserOrganizationalDepartment,
)


class UserDeletionError(Exception):
    """Domain guard error during D-01 user deletion."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@transaction.atomic
def delete_user_with_d01_cascade(
    *,
    actor: User,
    target_user: User,
    reason: str = "",
) -> DeletedUserTombstone:
    """D-01: Create Tombstone, anonymize/preserve historical records, delete user-owned data across 8 Features."""
    if target_user.role_id == "developer":
        if actor.role_id != "developer":
            raise UserDeletionError("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", 404)
        raise UserDeletionError("DEVELOPER_IMMUTABLE", "لا يمكن حذف حساب المطور (INV-R3).", 403)

    if target_user.id == actor.id:
        raise UserDeletionError("SELF_DELETION_PROHIBITED", "لا يمكنك حذف حسابك الحالي.", 409)

    if target_user.role_id == "super_admin" and actor.role_id != "developer":
        raise UserDeletionError("PERMISSION_DENIED", "حذف السوبر أدمن مقصور على المطور فقط (INV-R4).", 403)

    if target_user.role_id == "admin" and actor.role_id not in {"developer", "super_admin"}:
        raise UserDeletionError("PERMISSION_DENIED", "حذف مدير النظام مقصور على مدير النظام الأعلى أو المطور (INV-R3).", 403)

    if Course.objects.filter(primary_lecturer=target_user).exists():
        raise UserDeletionError(
            "PRIMARY_LECTURER_ACTIVE",
            "لا يمكن حذف محاضر يمتلك دورات أساسية نشطة قبل نقل ملكيتها.",
            409,
        )

    now = timezone.now()
    tombstone = DeletedUserTombstone.objects.create(
        canonical_user_id=str(target_user.id),
        deleted_at=now,
        deleted_by_actor_id=str(actor.id),
        reason=reason.strip() or None,
    )

    # 1. Preserve historical & authored records via Tombstone XOR / nullable FKs
    Course.objects.filter(created_by_user=target_user).update(
        created_by_user=None, created_by_tombstone=tombstone
    )
    CourseDraft.objects.filter(updated_by_user=target_user).update(
        updated_by_user=None, updated_by_tombstone=tombstone
    )
    PublishedCourseVersion.objects.filter(published_by_user=target_user).update(
        published_by_user=None, published_by_tombstone=tombstone
    )
    CourseReviewSubmission.objects.filter(submitted_by_user=target_user).update(
        submitted_by_user=None, submitted_by_tombstone=tombstone
    )
    CourseReviewSubmission.objects.filter(reviewed_by_user=target_user).update(
        reviewed_by_user=None, reviewed_by_tombstone=tombstone
    )
    CourseComment.objects.filter(author_user=target_user).update(
        author_user=None, is_author_deleted=True
    )
    CourseCommentReport.objects.filter(reporter_user=target_user).update(reporter_user=None)
    MediaAsset.objects.filter(uploaded_by_user=target_user).update(
        uploaded_by_user=None, uploaded_by_tombstone=tombstone
    )
    HistoricalServiceTrainingRecord.objects.filter(user=target_user).update(
        user=None, tombstone=tombstone
    )
    DelegatedAuthority.objects.filter(user=target_user).update(
        user=None, grantee_tombstone=tombstone, is_active=False
    )
    DelegatedAuthority.objects.filter(granted_by_user=target_user).update(
        granted_by_user=None, granted_by_tombstone=tombstone
    )

    # 2. Preserve issued CertificateRecords (D-01 / TR-C3-03) while detaching from CourseAttempt
    CertificateRecord.objects.filter(course_attempt__enrollment__user=target_user).update(
        course_attempt=None
    )

    # 3. Delete user-owned child rows in strict child-before-parent order (ON DELETE NO ACTION)
    LessonProgress.objects.filter(course_attempt__enrollment__user=target_user).delete()
    CourseAttempt.objects.filter(enrollment__user=target_user).delete()
    EnrollmentSourceGrant.objects.filter(enrollment__user=target_user).delete()
    Enrollment.objects.filter(user=target_user).delete()

    NotificationItem.objects.filter(user=target_user).delete()
    UserWhatsAppVisibility.objects.filter(user=target_user).delete()

    GroupJoinRequest.objects.filter(user=target_user).delete()
    GroupMembership.objects.filter(user=target_user).delete()
    GroupAssistantAssignment.objects.filter(user=target_user).delete()
    CourseAssistantLecturer.objects.filter(user=target_user).delete()

    UserJobTitle.objects.filter(user=target_user).delete()
    UserOrganizationalDepartment.objects.filter(user=target_user).delete()

    ServerSession.objects.filter(user=target_user).delete()
    UserPermissionOverride.objects.filter(user=target_user).delete()

    # 4. Delete User (frees phone_e164, national_id, and email per OD-PF-01)
    User.objects.filter(pk=target_user.pk).delete()

    # 5. Record deletion audit entry
    record_audit_log(
        action="identity.user_deleted_d01",
        actor=actor,
        target_entity_type="DeletedUserTombstone",
        target_entity_id=tombstone.canonical_user_id,
        details_snapshot={"reason": tombstone.reason},
    )
    return tombstone
