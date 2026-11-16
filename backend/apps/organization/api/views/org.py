"""Organization & HR API views."""
from __future__ import annotations

from django.db import IntegrityError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.organization.api.serializers.org import (
    BilingualCatalogSerializer,
    CodedCatalogSerializer,
    DepartmentTrackSerializer,
    HistoricalServiceTrainingSerializer,
)
from apps.organization.models import (
    DepartmentTrack,
    HistoricalServiceTrainingRecord,
    JobTitle,
    MaritalStatusCatalog,
    MetroLine,
    MilitaryServiceStatusCatalog,
    OrganizationalDepartment,
    UserJobTitle,
    UserOrganizationalDepartment,
)
from apps.organization.services.org_service import (
    OrganizationConflictError,
    assign_user_department,
    assign_user_job_title,
    create_historical_training_record,
    delete_catalog_record,
    upsert_department_track,
)
from shared.api import error_response, success_response
from shared.permissions import get_visible_user_or_none, has_capability


def _serialize_dept_permission(code: str, name_ar: str, track: DepartmentTrack | None) -> dict:
    return {
        "departmentId": code,
        "departmentName": name_ar,
        "allowedTracks": list(track.allowed_tracks_json) if track else [],
        "updatedAt": track.updated_at.isoformat() if track and track.updated_at else "",
        "updatedBy": track.updated_by if track else "",
    }


def _real_tracks_from_courses() -> list[dict]:
    from apps.courses.models import Course

    return [
        {
            "id": f"TRK-{c.id}",
            "code": f"CRS-{c.id}",
            "nameAr": c.title,
            "nameEn": c.title,
            "descriptionAr": c.description or "",
        }
        for c in Course.objects.all().order_by("id")
    ]


class DepartmentTrackListView(APIView):
    """GET / POST /api/admin/department-tracks."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("permissions.view_matrix")()]
        return [IsAuthenticated(), has_capability("permissions.configure_departments")()]

    def get(self, request: Request):
        tracks = list(DepartmentTrack.objects.all().order_by("department_code"))
        track_by_code = {t.department_code: t for t in tracks}

        org_depts = list(OrganizationalDepartment.objects.all().order_by("id"))
        canonical_departments: list[dict] = []
        departments_dto: list[dict] = []
        seen_codes: set[str] = set()

        for dept in org_depts:
            code = f"DEPT-{dept.id}"
            seen_codes.add(code)
            canonical_departments.append(
                {
                    "id": code,
                    "nameAr": dept.name_ar,
                    "nameEn": dept.name_en or dept.name_ar,
                }
            )
            departments_dto.append(_serialize_dept_permission(code, dept.name_ar, track_by_code.get(code)))

        for code, trk in track_by_code.items():
            if code not in seen_codes:
                seen_codes.add(code)
                canonical_departments.append({"id": code, "nameAr": code, "nameEn": code})
                departments_dto.append(_serialize_dept_permission(code, code, trk))

        return success_response(
            {
                "departmentTracks": DepartmentTrackSerializer(tracks, many=True).data,
                "departments": departments_dto,
                "canonicalDepartments": canonical_departments,
                "tracks": _real_tracks_from_courses(),
            }
        )

    def post(self, request: Request):
        serializer = DepartmentTrackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        track = upsert_department_track(
            department_code=serializer.validated_data["department_code"],
            allowed_tracks=serializer.validated_data["allowed_tracks_json"],
            actor_id=str(request.user.id),
        )
        return success_response(
            {"departmentTrack": DepartmentTrackSerializer(track).data},
            status_code=status.HTTP_201_CREATED,
        )


class DepartmentTrackDetailView(APIView):
    """GET / PUT / PATCH /api/admin/department-tracks/<department_code>."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("permissions.view_matrix")()]
        return [IsAuthenticated(), has_capability("permissions.configure_departments")()]

    def get(self, request: Request, department_code: str):
        track = DepartmentTrack.objects.filter(department_code=department_code).first()
        if track is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        return success_response({"departmentTrack": DepartmentTrackSerializer(track).data})

    def put(self, request: Request, department_code: str):
        return self._upsert(request, department_code)

    def patch(self, request: Request, department_code: str):
        return self._upsert(request, department_code)

    def _upsert(self, request: Request, department_code: str):
        allowed_tracks = request.data.get("allowedTracks", [])
        if not isinstance(allowed_tracks, list):
            return error_response("VALIDATION_ERROR", "يرجى إرسال قائمة صالحة للمسارات.", status.HTTP_400_BAD_REQUEST)
        track = upsert_department_track(
            department_code=department_code,
            allowed_tracks=[str(x) for x in allowed_tracks],
            actor_id=str(request.user.id),
        )
        dept_name = department_code
        if department_code.startswith("DEPT-") and department_code[5:].isdigit():
            org = OrganizationalDepartment.objects.filter(pk=int(department_code[5:])).first()
            if org is not None:
                dept_name = org.name_ar
        return success_response(
            {
                "departmentTrack": DepartmentTrackSerializer(track).data,
                "success": True,
                "messageAr": "تم تحديث مسارات الإدارة بنجاح.",
                "department": _serialize_dept_permission(department_code, dept_name, track),
            }
        )


class _BaseCatalogListView(APIView):
    model = None
    serializer_class = BilingualCatalogSerializer
    key_name = "items"

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), has_capability("permissions.configure_departments")()]

    def get(self, request: Request):
        qs = self.model.objects.all().order_by("id")
        return success_response({self.key_name: self.serializer_class(qs, many=True).data})

    def post(self, request: Request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            obj = self.model.objects.create(**serializer.validated_data)
        except IntegrityError:
            return error_response(
                "CONFLICT",
                "تعارض في معالجة الطلب. قد تكون العملية مسجلة بالفعل.",
                status.HTTP_409_CONFLICT,
            )
        return success_response({self.key_name[:-1]: self.serializer_class(obj).data}, status_code=status.HTTP_201_CREATED)


class _BaseCatalogDetailView(APIView):
    model = None

    def get_permissions(self):
        return [IsAuthenticated(), has_capability("permissions.configure_departments")()]

    def delete(self, request: Request, item_id: int):
        obj = self.model.objects.filter(pk=item_id).first()
        if obj is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            delete_catalog_record(obj)
        except OrganizationConflictError as exc:
            return error_response("CATALOG_IN_USE", str(exc), status.HTTP_409_CONFLICT)
        return success_response({"deleted": True, "id": item_id})


class DepartmentListView(_BaseCatalogListView):
    model = OrganizationalDepartment
    key_name = "departments"


class DepartmentDetailView(_BaseCatalogDetailView):
    model = OrganizationalDepartment


class JobTitleListView(_BaseCatalogListView):
    model = JobTitle
    key_name = "jobTitles"


class JobTitleDetailView(_BaseCatalogDetailView):
    model = JobTitle


class MetroLineListView(_BaseCatalogListView):
    model = MetroLine
    key_name = "metroLines"


class MetroLineDetailView(_BaseCatalogDetailView):
    model = MetroLine


class MaritalStatusListView(_BaseCatalogListView):
    model = MaritalStatusCatalog
    serializer_class = CodedCatalogSerializer
    key_name = "maritalStatuses"


class MilitaryStatusListView(_BaseCatalogListView):
    model = MilitaryServiceStatusCatalog
    serializer_class = CodedCatalogSerializer
    key_name = "militaryStatuses"


class UserOrganizationAssignmentView(APIView):
    """GET / POST /api/admin/users/<user_id>/organization."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("users.view_directory")()]
        return [IsAuthenticated(), has_capability("permissions.configure_departments")()]

    def get(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        dept_ids = list(
            UserOrganizationalDepartment.objects.filter(user=target).values_list("department_id", flat=True)
        )
        job_links = list(
            UserJobTitle.objects.filter(user=target).values("department_id", "job_title_id")
        )
        return success_response({"userId": target.id, "departmentIds": dept_ids, "jobTitles": job_links})

    def post(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        dept_id = request.data.get("departmentId")
        job_title_id = request.data.get("jobTitleId")
        dept = OrganizationalDepartment.objects.filter(pk=dept_id).first()
        if dept is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if job_title_id is None:
            assign_user_department(target, dept)
            return success_response({"assignedDepartmentId": dept.id}, status_code=status.HTTP_201_CREATED)

        job = JobTitle.objects.filter(pk=job_title_id).first()
        if job is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            assign_user_job_title(target, dept, job)
        except OrganizationConflictError as exc:
            return error_response("DEPARTMENT_SCOPE_VIOLATION", str(exc), status.HTTP_409_CONFLICT)
        return success_response({"assignedDepartmentId": dept.id, "assignedJobTitleId": job.id}, status_code=status.HTTP_201_CREATED)


class UserHistoricalTrainingView(APIView):
    """GET / POST /api/admin/users/<user_id>/historical-training."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated(), has_capability("users.view_transcript")()]
        return [IsAuthenticated(), has_capability("users.create")()]

    def get(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        records = HistoricalServiceTrainingRecord.objects.filter(user=target).order_by("id")
        return success_response({"records": HistoricalServiceTrainingSerializer(records, many=True).data})

    def post(self, request: Request, user_id: int):
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        serializer = HistoricalServiceTrainingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = create_historical_training_record(
            user=target,
            course_name=serializer.validated_data["course_name"],
            providing_organization=serializer.validated_data["providing_organization"],
            completion_date=serializer.validated_data.get("completion_date"),
            certificate_info_or_notes=serializer.validated_data.get("certificate_info_or_notes"),
        )
        return success_response(
            {"record": HistoricalServiceTrainingSerializer(record).data},
            status_code=status.HTTP_201_CREATED,
        )

