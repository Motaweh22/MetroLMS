"""Organization & HR domain services (OR-DB-04, D-OWNER-REV-10, D-OWNER-REV-17)."""
from __future__ import annotations

from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.identity.models import User
from apps.organization.models import (
    DepartmentJobTitle,
    DepartmentTrack,
    HistoricalServiceTrainingRecord,
    JobTitle,
    LeadershipTitleCatalog,
    MetroLine,
    OrganizationalDepartment,
    UserJobTitle,
    UserOrganizationalDepartment,
)
from shared.validators import (
    normalize_nfc_preserve_whitespace,
    normalize_nfc_stripped,
    validate_non_empty_text,
)


class OrganizationConflictError(Exception):
    """Raised on D-OWNER-REV-10 / D-OWNER-REV-17 / duplicate constraint conflict (HTTP 409)."""


class OrganizationValidationError(Exception):
    """Raised on invalid catalog resolution payload (HTTP 400)."""


class OrganizationPermissionError(Exception):
    """Raised when actor violates RBAC hierarchy while resolving linked users (HTTP 403)."""


def can_actor_modify_user(actor: User, target: User) -> bool:
    """Mirror UserDetailView hierarchy rules (`admin`/`super_admin`/`developer`)."""
    actor_role = getattr(actor, "role_id", "")
    target_role = getattr(target, "role_id", "")
    if target_role == "developer":
        return actor_role == "developer"
    if actor_role == "developer":
        return True
    if actor_role == "super_admin":
        return target_role != "super_admin" or target.pk == actor.pk
    if actor_role == "admin":
        return target_role not in {"admin", "super_admin", "developer"}
    return False


def link_department_job_title(department: OrganizationalDepartment, job_title: JobTitle) -> DepartmentJobTitle:
    """Associate a JobTitle with an OrganizationalDepartment."""
    obj, _ = DepartmentJobTitle.objects.get_or_create(department=department, job_title=job_title)
    return obj


def assign_user_department(user: User, department: OrganizationalDepartment) -> UserOrganizationalDepartment:
    """Assign an OrganizationalDepartment to a User."""
    obj, _ = UserOrganizationalDepartment.objects.get_or_create(user=user, department=department)
    return obj


def assign_user_job_title(
    user: User,
    department: OrganizationalDepartment,
    job_title: JobTitle,
) -> UserJobTitle:
    """Assign a department-scoped JobTitle to a User (D-OWNER-REV-17)."""
    try:
        obj, _ = UserJobTitle.objects.get_or_create(user=user, department=department, job_title=job_title)
        return obj
    except IntegrityError as exc:
        raise OrganizationConflictError(
            "لا يمكن إسناد المسمى الوظيفي للمستخدم خارج نطاق الأقسام المعين عليها."
        ) from exc


def delete_catalog_record(instance) -> None:
    """Delete a catalog row enforcing D-OWNER-REV-10 ON DELETE NO ACTION guard."""
    from apps.courses.models import CourseAudienceJobTitle

    try:
        with transaction.atomic():
            if isinstance(instance, JobTitle):
                has_users = UserJobTitle.objects.filter(job_title=instance).exists()
                has_courses = CourseAudienceJobTitle.objects.filter(job_title=instance).exists()
                if not has_users and not has_courses:
                    DepartmentJobTitle.objects.filter(job_title=instance).delete()
            instance.delete()
    except IntegrityError as exc:
        raise OrganizationConflictError(
            "لا يمكن حذف هذا السجل المرجعي لارتباطه ببيانات مستخدمين أو دورات قائمة."
        ) from exc


def _resolve_catalog_model(catalog: str):
    mapping = {
        "departments": OrganizationalDepartment,
        "job-titles": JobTitle,
        "leadership-titles": LeadershipTitleCatalog,
        "metro-lines": MetroLine,
    }
    return mapping.get(catalog)


def get_catalog_usage_map(catalog: str, item_ids: list[int], *, actor: User) -> dict[int, dict[str, int]]:
    """Return usage counts per catalog row (usersCount, jobTitlesCount, coursesCount, totalBlockers)."""
    if not item_ids:
        return {}

    from apps.courses.models import (
        CourseAudienceDepartment,
        CourseAudienceJobTitle,
        CourseAudienceLeadership,
        CourseAudienceMetroLine,
    )

    is_dev = getattr(actor, "role_id", "") == "developer"
    result: dict[int, dict[str, int]] = {
        iid: {"usersCount": 0, "jobTitlesCount": 0, "coursesCount": 0, "totalBlockers": 0}
        for iid in item_ids
    }

    if catalog == "departments":
        u_qs = UserOrganizationalDepartment.objects.filter(department_id__in=item_ids)
        if not is_dev:
            u_qs = u_qs.exclude(user__role_id="developer")
        for row in u_qs.values("department_id").annotate(cnt=Count("user_id", distinct=True)):
            result[row["department_id"]]["usersCount"] = int(row["cnt"] or 0)

        jt_ids_by_dept: dict[int, set[int]] = {iid: set() for iid in item_ids}
        for row in JobTitle.objects.filter(department_id__in=item_ids).values("id", "department_id"):
            jt_ids_by_dept[row["department_id"]].add(row["id"])
        for row in DepartmentJobTitle.objects.filter(department_id__in=item_ids).values("department_id", "job_title_id"):
            jt_ids_by_dept[row["department_id"]].add(row["job_title_id"])
        for did, jset in jt_ids_by_dept.items():
            result[did]["jobTitlesCount"] = len(jset)

        for row in CourseAudienceDepartment.objects.filter(department_id__in=item_ids).values("department_id").annotate(
            cnt=Count("course_id", distinct=True)
        ):
            result[row["department_id"]]["coursesCount"] = int(row["cnt"] or 0)

    elif catalog == "job-titles":
        u_qs = UserJobTitle.objects.filter(job_title_id__in=item_ids)
        if not is_dev:
            u_qs = u_qs.exclude(user__role_id="developer")
        for row in u_qs.values("job_title_id").annotate(cnt=Count("user_id", distinct=True)):
            result[row["job_title_id"]]["usersCount"] = int(row["cnt"] or 0)

        for row in CourseAudienceJobTitle.objects.filter(job_title_id__in=item_ids).values("job_title_id").annotate(
            cnt=Count("course_id", distinct=True)
        ):
            result[row["job_title_id"]]["coursesCount"] = int(row["cnt"] or 0)

    elif catalog == "leadership-titles":
        id_by_name = {
            lt.name_ar: lt.id
            for lt in LeadershipTitleCatalog.objects.filter(pk__in=item_ids).only("id", "name_ar")
        }
        names = list(id_by_name.keys())
        if names:
            u_qs = User.objects.filter(leadership_title__in=names)
            if not is_dev:
                u_qs = u_qs.exclude(role_id="developer")
            for row in u_qs.values("leadership_title").annotate(cnt=Count("id", distinct=True)):
                lid = id_by_name.get(row["leadership_title"])
                if lid is not None:
                    result[lid]["usersCount"] = int(row["cnt"] or 0)
            for row in CourseAudienceLeadership.objects.filter(leadership_title__in=names).values(
                "leadership_title"
            ).annotate(cnt=Count("course_id", distinct=True)):
                lid = id_by_name.get(row["leadership_title"])
                if lid is not None:
                    result[lid]["coursesCount"] = int(row["cnt"] or 0)

    elif catalog == "metro-lines":
        u_qs = User.objects.filter(metro_line_id__in=item_ids)
        if not is_dev:
            u_qs = u_qs.exclude(role_id="developer")
        for row in u_qs.values("metro_line_id").annotate(cnt=Count("id", distinct=True)):
            result[row["metro_line_id"]]["usersCount"] = int(row["cnt"] or 0)
        for row in CourseAudienceMetroLine.objects.filter(metro_line_id__in=item_ids).values(
            "metro_line_id"
        ).annotate(cnt=Count("course_id", distinct=True)):
            result[row["metro_line_id"]]["coursesCount"] = int(row["cnt"] or 0)

    for entry in result.values():
        entry["totalBlockers"] = entry["usersCount"] + entry["jobTitlesCount"] + entry["coursesCount"]

    return result


def _serialize_linked_users(users_qs, *, actor: User) -> list[dict]:
    is_dev = getattr(actor, "role_id", "") == "developer"
    qs = users_qs.select_related("role", "metro_line").order_by("id")
    if not is_dev:
        qs = qs.exclude(role_id="developer")
    user_list = list(qs)
    user_ids = [u.id for u in user_list]

    dept_map: dict[int, str] = {}
    for link in (
        UserOrganizationalDepartment.objects.filter(user_id__in=user_ids)
        .select_related("department")
        .order_by("id")
    ):
        if link.user_id not in dept_map and link.department is not None:
            dept_map[link.user_id] = link.department.name_ar

    job_map: dict[int, str] = {}
    for jlink in (
        UserJobTitle.objects.filter(user_id__in=user_ids)
        .select_related("job_title")
        .order_by("id")
    ):
        if jlink.user_id not in job_map and jlink.job_title is not None:
            job_map[jlink.user_id] = jlink.job_title.name_ar

    return [
        {
            "id": str(u.id),
            "name": u.full_name,
            "employeeNumber": u.employee_number or "",
            "role": "user" if u.role_id == "trainee" else u.role_id,
            "department": dept_map.get(u.id, ""),
            "jobTitle": job_map.get(u.id, ""),
            "metroLine": u.metro_line.name_ar if u.metro_line else "",
            "leadershipTitle": u.leadership_title or "",
            "canModify": can_actor_modify_user(actor, u),
        }
        for u in user_list
    ]


def inspect_catalog_dependencies(catalog: str, item_id: int, *, actor: User) -> dict | None:
    """Inspect all blocking users, job titles, and courses referencing a catalog item."""
    model = _resolve_catalog_model(catalog)
    if model is None:
        return None
    obj = model.objects.filter(pk=item_id).first()
    if obj is None:
        return None

    from apps.courses.models import (
        Course,
        CourseAudienceDepartment,
        CourseAudienceJobTitle,
        CourseAudienceLeadership,
        CourseAudienceMetroLine,
    )

    users_payload: list[dict] = []
    job_titles_payload: list[dict] = []
    courses_payload: list[dict] = []

    if catalog == "departments":
        user_ids = set(UserOrganizationalDepartment.objects.filter(department=obj).values_list("user_id", flat=True))
        user_ids |= set(UserJobTitle.objects.filter(department=obj).values_list("user_id", flat=True))
        users_payload = _serialize_linked_users(User.objects.filter(pk__in=user_ids), actor=actor)

        scoped_ids = set(JobTitle.objects.filter(department=obj).values_list("id", flat=True))
        linked_ids = set(DepartmentJobTitle.objects.filter(department=obj).values_list("job_title_id", flat=True))
        all_jt_ids = scoped_ids | linked_ids
        jt_user_counts = {
            row["job_title_id"]: int(row["cnt"] or 0)
            for row in UserJobTitle.objects.filter(department=obj, job_title_id__in=all_jt_ids)
            .values("job_title_id")
            .annotate(cnt=Count("user_id", distinct=True))
        }
        for jt in JobTitle.objects.filter(pk__in=all_jt_ids).order_by("id"):
            job_titles_payload.append(
                {
                    "id": jt.id,
                    "nameAr": jt.name_ar,
                    "nameEn": jt.name_en,
                    "isPrimaryScoped": jt.department_id == obj.id,
                    "hasDepartmentLink": jt.id in linked_ids,
                    "linkedUsersCount": jt_user_counts.get(jt.id, 0),
                }
            )

        course_ids = list(
            CourseAudienceDepartment.objects.filter(department=obj).values_list("course_id", flat=True)
        )
        courses_payload = [
            {"id": c.id, "title": c.title, "lifecycleStatus": c.lifecycle_status}
            for c in Course.objects.filter(pk__in=course_ids).order_by("id")
        ]

    elif catalog == "job-titles":
        user_ids = set(UserJobTitle.objects.filter(job_title=obj).values_list("user_id", flat=True))
        users_payload = _serialize_linked_users(User.objects.filter(pk__in=user_ids), actor=actor)
        course_ids = list(
            CourseAudienceJobTitle.objects.filter(job_title=obj).values_list("course_id", flat=True)
        )
        courses_payload = [
            {"id": c.id, "title": c.title, "lifecycleStatus": c.lifecycle_status}
            for c in Course.objects.filter(pk__in=course_ids).order_by("id")
        ]

    elif catalog == "leadership-titles":
        users_payload = _serialize_linked_users(User.objects.filter(leadership_title=obj.name_ar), actor=actor)
        course_ids = list(
            CourseAudienceLeadership.objects.filter(leadership_title=obj.name_ar).values_list("course_id", flat=True)
        )
        courses_payload = [
            {"id": c.id, "title": c.title, "lifecycleStatus": c.lifecycle_status}
            for c in Course.objects.filter(pk__in=course_ids).order_by("id")
        ]

    elif catalog == "metro-lines":
        users_payload = _serialize_linked_users(User.objects.filter(metro_line=obj), actor=actor)
        course_ids = list(
            CourseAudienceMetroLine.objects.filter(metro_line=obj).values_list("course_id", flat=True)
        )
        courses_payload = [
            {"id": c.id, "title": c.title, "lifecycleStatus": c.lifecycle_status}
            for c in Course.objects.filter(pk__in=course_ids).order_by("id")
        ]

    has_protected = any(not u["canModify"] for u in users_payload)
    can_delete_directly = not users_payload and not job_titles_payload and not courses_payload
    return {
        "catalog": catalog,
        "item": {
            "id": obj.id,
            "nameAr": obj.name_ar,
            "nameEn": getattr(obj, "name_en", None),
        },
        "supportsUnassign": catalog != "metro-lines",
        "users": users_payload,
        "jobTitles": job_titles_payload,
        "courses": courses_payload,
        "hasProtectedUsers": has_protected,
        "canDeleteDirectly": can_delete_directly,
    }


def _parse_int_list(raw: object) -> list[int]:
    if not isinstance(raw, list):
        return []
    parsed: list[int] = []
    for v in raw:
        if isinstance(v, bool):
            continue
        if isinstance(v, int) or (isinstance(v, str) and v.strip().isdigit()):
            parsed.append(int(v))
    return list(dict.fromkeys(parsed))


def _parse_optional_int(raw: object) -> int | None:
    if raw is None or raw == "" or isinstance(raw, bool):
        return None
    if isinstance(raw, int) or (isinstance(raw, str) and raw.strip().isdigit()):
        return int(raw)
    return None


@transaction.atomic
def resolve_catalog_dependencies(
    catalog: str,
    item_id: int,
    *,
    actor: User,
    payload: dict,
) -> dict | None:
    """Resolve user, job-title, and course blockers and optionally delete the catalog row."""
    model = _resolve_catalog_model(catalog)
    if model is None:
        return None
    obj = model.objects.filter(pk=item_id).first()
    if obj is None:
        return None

    from apps.courses.models import (
        CourseAudienceDepartment,
        CourseAudienceJobTitle,
        CourseAudienceLeadership,
        CourseAudienceMetroLine,
    )
    from apps.governance.services.governance_service import record_audit_log
    from apps.learning.services.learning_service import reconcile_user_enrollments_on_org_change

    user_action = str(payload.get("userAction") or "none").strip()
    user_ids = _parse_int_list(payload.get("userIds"))
    target_id = _parse_optional_int(payload.get("targetId"))
    target_job_id = _parse_optional_int(payload.get("targetJobTitleId"))

    job_title_action = str(payload.get("jobTitleAction") or "none").strip()
    job_title_ids = _parse_int_list(payload.get("jobTitleIds"))
    target_job_dept_id = _parse_optional_int(payload.get("targetJobDepartmentId"))

    course_action = str(payload.get("courseAction") or "none").strip()
    course_ids = _parse_int_list(payload.get("courseIds"))
    target_course_repl_id = _parse_optional_int(payload.get("targetCourseReplacementId"))

    delete_after = bool(payload.get("deleteAfter"))

    if user_action not in {"none", "transfer", "unassign"}:
        raise OrganizationValidationError("إجراء معالجة المستخدمين غير صالح.")
    if catalog == "metro-lines" and user_action == "unassign":
        raise OrganizationValidationError("خط المترو حقل إلزامي للموظف؛ يرجى النقل إلى خط مترو بديل.")
    if job_title_action not in {"none", "make_global", "transfer", "unlink_unused"}:
        raise OrganizationValidationError("إجراء معالجة المسميات الوظيفية غير صالح.")
    if course_action not in {"none", "remove", "replace"}:
        raise OrganizationValidationError("إجراء معالجة الدورات المستهدفة غير صالح.")

    # Resolve target objects upfront
    target_obj = None
    if user_action == "transfer":
        if target_id is None or target_id == item_id:
            raise OrganizationValidationError("يرجى اختيار وجهة بديلة صالحة مختلفة عن العنصر الحالي.")
        target_obj = model.objects.filter(pk=target_id).first()
        if target_obj is None:
            raise OrganizationValidationError("العنصر البديل المحدد غير موجود.")

    target_job_obj: JobTitle | None = None
    if catalog == "departments" and user_action == "transfer" and target_job_id is not None:
        target_job_obj = JobTitle.objects.filter(pk=target_job_id).first()
        if target_job_obj is None:
            raise OrganizationValidationError("المسمى الوظيفي البديل غير موجود.")
        if target_job_obj.department_id is not None and target_job_obj.department_id != target_id:
            raise OrganizationValidationError("المسمى الوظيفي البديل غير متاح تحت الإدارة البديلة المختارة.")

    target_job_dept_obj: OrganizationalDepartment | None = None
    if catalog == "departments" and job_title_action == "transfer":
        effective_dept_id = target_job_dept_id if target_job_dept_id is not None else target_id
        if effective_dept_id is None or effective_dept_id == item_id:
            raise OrganizationValidationError("يرجى اختيار إدارة بديلة لنقل المسميات الوظيفية إليها.")
        target_job_dept_obj = OrganizationalDepartment.objects.filter(pk=effective_dept_id).first()
        if target_job_dept_obj is None:
            raise OrganizationValidationError("الإدارة البديلة للمسميات الوظيفية غير موجودة.")

    course_repl_obj = None
    if course_action == "replace":
        effective_repl_id = target_course_repl_id if target_course_repl_id is not None else target_id
        if effective_repl_id is None or effective_repl_id == item_id:
            raise OrganizationValidationError("يرجى اختيار عنصر بديل لاستهداف الدورات.")
        course_repl_obj = model.objects.filter(pk=effective_repl_id).first()
        if course_repl_obj is None:
            raise OrganizationValidationError("العنصر البديل لاستهداف الدورات غير موجود.")

    # Validate & filter target users enforcing RBAC & INV-R8
    affected_users: list[User] = []
    if user_action != "none" and user_ids:
        candidate_users = list(User.objects.select_related("role").filter(pk__in=user_ids))
        is_dev = getattr(actor, "role_id", "") == "developer"
        for u in candidate_users:
            if u.role_id == "developer" and not is_dev:
                raise OrganizationPermissionError("لا يمكنك تعديل بعض المستخدمين المحددين.")
            if not can_actor_modify_user(actor, u):
                raise OrganizationPermissionError("بعض المستخدمين المحددين ذوو صلاحية أعلى ولا يمكنك تعديل بياناتهم.")
        affected_users = candidate_users

    updated_users_count = 0
    if catalog == "departments" and affected_users:
        affected_ids = [u.id for u in affected_users]
        if user_action == "unassign":
            UserJobTitle.objects.filter(user_id__in=affected_ids, department=obj).delete()
            UserOrganizationalDepartment.objects.filter(user_id__in=affected_ids, department=obj).delete()
            updated_users_count = len(affected_users)
        elif user_action == "transfer" and target_obj is not None:
            if target_job_obj is not None:
                link_department_job_title(target_obj, target_job_obj)
            for u in affected_users:
                existing_jts = [
                    ujt.job_title
                    for ujt in UserJobTitle.objects.filter(user=u, department=obj).select_related("job_title")
                ]
                UserJobTitle.objects.filter(user=u, department=obj).delete()
                UserOrganizationalDepartment.objects.filter(user=u, department=obj).delete()
                UserOrganizationalDepartment.objects.get_or_create(user=u, department=target_obj)
                if target_job_obj is not None:
                    UserJobTitle.objects.get_or_create(user=u, department=target_obj, job_title=target_job_obj)
                else:
                    for old_jt in existing_jts:
                        if old_jt.department_id is None or old_jt.department_id == target_obj.id:
                            link_department_job_title(target_obj, old_jt)
                            UserJobTitle.objects.get_or_create(user=u, department=target_obj, job_title=old_jt)
            updated_users_count = len(affected_users)

    elif catalog == "job-titles" and affected_users:
        affected_ids = [u.id for u in affected_users]
        if user_action == "unassign":
            updated_users_count = UserJobTitle.objects.filter(user_id__in=affected_ids, job_title=obj).delete()[0]
        elif user_action == "transfer" and target_obj is not None:
            for u in affected_users:
                links = list(UserJobTitle.objects.filter(user=u, job_title=obj).select_related("department"))
                for lnk in links:
                    dept = lnk.department
                    lnk.delete()
                    if target_obj.department_id is None or target_obj.department_id == dept.id:
                        link_department_job_title(dept, target_obj)
                        UserJobTitle.objects.get_or_create(user=u, department=dept, job_title=target_obj)
                if links:
                    updated_users_count += 1

    elif catalog == "leadership-titles" and affected_users:
        affected_ids = [u.id for u in affected_users]
        if user_action == "unassign":
            updated_users_count = User.objects.filter(
                pk__in=affected_ids, leadership_title=obj.name_ar
            ).update(leadership_title=None)
        elif user_action == "transfer" and target_obj is not None:
            updated_users_count = User.objects.filter(
                pk__in=affected_ids, leadership_title=obj.name_ar
            ).update(leadership_title=target_obj.name_ar)

    elif catalog == "metro-lines" and affected_users and user_action == "transfer" and target_obj is not None:
        affected_ids = [u.id for u in affected_users]
        updated_users_count = User.objects.filter(pk__in=affected_ids, metro_line=obj).update(metro_line=target_obj)

    for u in affected_users:
        u.refresh_from_db()
        reconcile_user_enrollments_on_org_change(actor=actor, user=u)

    # Resolve department job titles (when deleting/resolving a department)
    updated_job_titles_count = 0
    if catalog == "departments" and job_title_action != "none":
        target_jts_qs = JobTitle.objects.filter(
            Q(department=obj) | Q(job_title_departments__department=obj)
        ).distinct()
        if job_title_ids:
            target_jts_qs = target_jts_qs.filter(pk__in=job_title_ids)
        for jt in list(target_jts_qs):
            still_has_user_link = UserJobTitle.objects.filter(department=obj, job_title=jt).exists()
            if job_title_action == "make_global":
                if jt.department_id == obj.id:
                    jt.department = None
                    jt.save(update_fields=["department"])
                    updated_job_titles_count += 1
                if not still_has_user_link:
                    DepartmentJobTitle.objects.filter(department=obj, job_title=jt).delete()
                    updated_job_titles_count += 1
            elif job_title_action == "transfer" and target_job_dept_obj is not None:
                if jt.department_id == obj.id:
                    jt.department = target_job_dept_obj
                    jt.save(update_fields=["department"])
                link_department_job_title(target_job_dept_obj, jt)
                if not still_has_user_link:
                    DepartmentJobTitle.objects.filter(department=obj, job_title=jt).delete()
                updated_job_titles_count += 1
            elif job_title_action == "unlink_unused" and not still_has_user_link:
                if jt.department_id == obj.id:
                    jt.department = None
                    jt.save(update_fields=["department"])
                DepartmentJobTitle.objects.filter(department=obj, job_title=jt).delete()
                updated_job_titles_count += 1

    # Resolve course audience targeting
    updated_courses_count = 0
    if course_action != "none":
        if catalog == "departments":
            qs = CourseAudienceDepartment.objects.filter(department=obj)
            if course_ids:
                qs = qs.filter(course_id__in=course_ids)
            cids = list(qs.values_list("course_id", flat=True))
            updated_courses_count = qs.delete()[0]
            if course_action == "replace" and course_repl_obj is not None:
                for cid in cids:
                    CourseAudienceDepartment.objects.get_or_create(course_id=cid, department=course_repl_obj)
        elif catalog == "job-titles":
            qs = CourseAudienceJobTitle.objects.filter(job_title=obj)
            if course_ids:
                qs = qs.filter(course_id__in=course_ids)
            cids = list(qs.values_list("course_id", flat=True))
            updated_courses_count = qs.delete()[0]
            if course_action == "replace" and course_repl_obj is not None:
                for cid in cids:
                    CourseAudienceJobTitle.objects.get_or_create(course_id=cid, job_title=course_repl_obj)
        elif catalog == "leadership-titles":
            qs = CourseAudienceLeadership.objects.filter(leadership_title=obj.name_ar)
            if course_ids:
                qs = qs.filter(course_id__in=course_ids)
            cids = list(qs.values_list("course_id", flat=True))
            updated_courses_count = qs.delete()[0]
            if course_action == "replace" and course_repl_obj is not None:
                for cid in cids:
                    CourseAudienceLeadership.objects.get_or_create(
                        course_id=cid, leadership_title=course_repl_obj.name_ar
                    )
        elif catalog == "metro-lines":
            qs = CourseAudienceMetroLine.objects.filter(metro_line=obj)
            if course_ids:
                qs = qs.filter(course_id__in=course_ids)
            cids = list(qs.values_list("course_id", flat=True))
            updated_courses_count = qs.delete()[0]
            if course_action == "replace" and course_repl_obj is not None:
                for cid in cids:
                    CourseAudienceMetroLine.objects.get_or_create(course_id=cid, metro_line=course_repl_obj)

    deleted = False
    delete_blocked_reason: str | None = None
    if delete_after:
        try:
            with transaction.atomic():
                if catalog == "leadership-titles":
                    if (
                        User.objects.filter(leadership_title=obj.name_ar).exists()
                        or CourseAudienceLeadership.objects.filter(leadership_title=obj.name_ar).exists()
                    ):
                        raise OrganizationConflictError(
                            "لا تزال هذه الصفة القيادية مرتبطة بمستخدمين أو مقررات قائمة."
                        )
                    obj.delete()
                else:
                    delete_catalog_record(obj)
                deleted = True
        except OrganizationConflictError as exc:
            delete_blocked_reason = str(exc)

    record_audit_log(
        action="organization.dependencies_resolved",
        actor=actor,
        target_entity_type=model.__name__,
        target_entity_id=str(item_id),
        details_snapshot={
            "catalog": catalog,
            "userAction": user_action,
            "updatedUsersCount": updated_users_count,
            "jobTitleAction": job_title_action,
            "updatedJobTitlesCount": updated_job_titles_count,
            "courseAction": course_action,
            "updatedCoursesCount": updated_courses_count,
            "deleted": deleted,
        },
    )

    remaining = None if deleted else inspect_catalog_dependencies(catalog, item_id, actor=actor)
    return {
        "updatedUsersCount": updated_users_count,
        "updatedJobTitlesCount": updated_job_titles_count,
        "updatedCoursesCount": updated_courses_count,
        "deleted": deleted,
        "deleteBlockedReason": delete_blocked_reason,
        "dependencies": remaining,
    }


def create_historical_training_record(
    *,
    user: User,
    course_name: str,
    providing_organization: str,
    completion_date=None,
    certificate_info_or_notes: str | None = None,
) -> HistoricalServiceTrainingRecord:
    """Create a HistoricalServiceTrainingRecord with OR-DB-04 normalization."""
    norm_course = normalize_nfc_stripped(course_name)
    norm_org = normalize_nfc_stripped(providing_organization)
    validate_non_empty_text(norm_course)
    validate_non_empty_text(norm_org)
    norm_notes = (
        normalize_nfc_preserve_whitespace(certificate_info_or_notes)
        if certificate_info_or_notes is not None
        else None
    )
    return HistoricalServiceTrainingRecord.objects.create(
        user=user,
        course_name=norm_course,
        providing_organization=norm_org,
        completion_date=completion_date,
        certificate_info_or_notes=norm_notes,
    )


def upsert_department_track(
    *,
    department_code: str,
    allowed_tracks: list[str],
    actor_id: str,
) -> DepartmentTrack:
    """Create or update a DepartmentTrack (Option A single PK)."""
    norm_code = normalize_nfc_stripped(department_code)
    validate_non_empty_text(norm_code)
    norm_tracks = [normalize_nfc_stripped(t) for t in allowed_tracks if t and t.strip()]
    track, _ = DepartmentTrack.objects.update_or_create(
        department_code=norm_code,
        defaults={
            "allowed_tracks_json": list(dict.fromkeys(norm_tracks)),
            "updated_at": timezone.now(),
            "updated_by": str(actor_id),
        },
    )
    return track

