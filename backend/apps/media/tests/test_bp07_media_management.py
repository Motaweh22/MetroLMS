"""BP-07 integration tests: Storage abstraction, magic bytes, INV-DOM21-07..18, Range 206/416."""
from __future__ import annotations

import datetime
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from apps.courses.models import Course, CourseDraft, PublishedCourseVersion
from apps.identity.models import RolePolicy, User
from apps.media.models import MediaAsset, MediaContentReference
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from infrastructure.storage import LocalMediaStorage, MediaStorageError
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp07MediaManagementTests(TestCase):
    """Verify MediaAsset upload, magic-bytes, path traversal, Detach/Restore, INV-DOM21-07, and Range 206/416."""

    def setUp(self) -> None:
        self._tmp_dir = tempfile.TemporaryDirectory()
        self._override = override_settings(MEDIA_ROOT=self._tmp_dir.name)
        self._override.enable()

        now = timezone.now()
        self.role_admin = RolePolicy.objects.create(
            role_key="admin",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["admin"]),
            updated_at=now,
            updated_by="system",
        )
        self.role_lecturer = RolePolicy.objects.create(
            role_key="lecturer",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["lecturer"]),
            updated_at=now,
            updated_by="system",
        )
        self.role_trainee = RolePolicy.objects.create(
            role_key="trainee",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["trainee"]),
            updated_at=now,
            updated_by="system",
        )
        self.marital = MaritalStatusCatalog.objects.create(code="single", name_ar="أعزب")
        self.military = MilitaryServiceStatusCatalog.objects.create(code="completed", name_ar="أنهى الخدمة")
        self.metro_line = MetroLine.objects.create(name_ar="الخط الأول")

        def make_user(phone: str, nid: str, role_policy: RolePolicy, name: str) -> User:
            return User.objects.create_user(
                phone_e164=phone,
                password="TestPassword@123",
                role=role_policy,
                full_name=name,
                national_id=nid,
                marital_status=self.marital,
                appointment_date=datetime.date(2020, 1, 1),
                military_service_status=self.military,
                educational_qualification="بكالوريوس",
                address="القاهرة",
                date_of_birth=datetime.date(1995, 1, 1),
                metro_line=self.metro_line,
            )

        self.admin = make_user("+201000000401", "29501010105001", self.role_admin, "مدير")
        self.lecturer = make_user("+201000000402", "29501010105002", self.role_lecturer, "محاضر")
        self.trainee = make_user("+201000000403", "29501010105003", self.role_trainee, "متدرب")

        self.course = Course.objects.create(
            title="دورة الوسائط",
            course_type="main",
            primary_lecturer=self.lecturer,
            lifecycle_status="Published",
            created_by_user=self.lecturer,
            created_at=now,
            updated_at=now,
        )
        self.draft = CourseDraft.objects.create(
            course=self.course,
            title_snapshot="مسودة",
            updated_at=now,
            updated_by_user=self.lecturer,
        )
        self.pub_ver = PublishedCourseVersion.objects.create(
            course=self.course,
            version_number=1,
            published_at=now,
            published_by_user=self.admin,
        )

    def tearDown(self) -> None:
        self._override.disable()
        self._tmp_dir.cleanup()

    def _login(self, phone: str) -> Client:
        c = Client()
        res = c.post(
            "/api/auth/login",
            data={"phone_e164": phone, "password": "TestPassword@123"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        return c

    def test_upload_magic_bytes_path_traversal_and_range_streaming(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        trainee_client = self._login(self.trainee.phone_e164)
        admin_client = self._login(self.admin.phone_e164)

        # Path traversal blocked
        store = LocalMediaStorage(self._tmp_dir.name)
        with self.assertRaises(MediaStorageError):
            store.resolve_safe_path("../../etc/passwd")

        # Spoofed PDF rejected by magic-bytes check
        spoof = SimpleUploadedFile("fake.pdf", b"MZ-NOT-A-PDF", content_type="application/pdf")
        bad_res = lec_client.post("/api/media/assets/upload", {"file": spoof})
        self.assertEqual(bad_res.status_code, 400)
        self.assertEqual(bad_res.json()["code"], "INVALID_FILE_SIGNATURE")

        # Valid PDF upload succeeds and hides storage_key
        pdf_bytes = b"%PDF-1.4\n0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        good = SimpleUploadedFile("  دليل التشغيل.pdf  ", pdf_bytes, content_type="application/pdf")
        up_res = lec_client.post("/api/media/assets/upload", {"file": good})
        self.assertEqual(up_res.status_code, 201)
        asset_dto = up_res.json()["data"]["asset"]
        self.assertEqual(asset_dto["fileName"], "دليل التشغيل.pdf")
        self.assertEqual(asset_dto["sizeBytes"], len(pdf_bytes))
        self.assertNotIn("storageKey", asset_dto)
        asset_id = asset_dto["id"]

        # Step 2: Published version attachment blocked (INV-DOM21-07)
        pub_attach = admin_client.post(
            "/api/media/references",
            data={"mediaAssetId": asset_id, "publishedVersionId": self.pub_ver.id, "title": "منشور"},
            content_type="application/json",
        )
        self.assertEqual(pub_attach.status_code, 403)
        self.assertEqual(pub_attach.json()["code"], "IMMUTABLE_PUBLISHED_VERSION")

        # Step 2: Draft attachment succeeds
        ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": asset_id, "courseDraftId": self.draft.id, "title": "دليل المتدرب"},
            content_type="application/json",
        )
        self.assertEqual(ref_res.status_code, 201)
        ref_id = ref_res.json()["data"]["reference"]["id"]

        # HTTP Range 206 Partial Content & 416 Range Not Satisfiable
        r206 = trainee_client.get(f"/api/media/references/{ref_id}/stream", HTTP_RANGE="bytes=0-8")
        self.assertEqual(r206.status_code, 206)
        self.assertEqual(r206["Content-Range"], f"bytes 0-8/{len(pdf_bytes)}")
        self.assertEqual(b"".join(r206.streaming_content), pdf_bytes[:9])

        r416 = trainee_client.get(f"/api/media/references/{ref_id}/stream", HTTP_RANGE="bytes=9999-10000")
        self.assertEqual(r416.status_code, 416)

        # INV-DOM21-15: Immediate visibility toggle hides stream from trainee
        self.assertEqual(
            lec_client.patch(
                f"/api/media/references/{ref_id}",
                data={"isVisible": False},
                content_type="application/json",
            ).status_code,
            200,
        )
        self.assertEqual(trainee_client.get(f"/api/media/references/{ref_id}/stream").status_code, 403)

        # Restore visibility, then test Detach -> Restore & INV-DOM21-17 409 Asset In Use
        lec_client.patch(f"/api/media/references/{ref_id}", data={"isVisible": True}, content_type="application/json")
        self.assertEqual(lec_client.post(f"/api/media/references/{ref_id}/detach", data={}, content_type="application/json").status_code, 200)
        self.assertEqual(trainee_client.get(f"/api/media/references/{ref_id}/stream").status_code, 403)

        # INV-DOM21-17: Even while detached, MediaAsset cannot be deleted (409)
        del_asset = admin_client.delete(f"/api/media/assets/{asset_id}")
        self.assertEqual(del_asset.status_code, 409)
        self.assertEqual(del_asset.json()["code"], "ASSET_IN_USE")

        self.assertEqual(lec_client.post(f"/api/media/references/{ref_id}/restore", data={}, content_type="application/json").status_code, 200)
        self.assertEqual(trainee_client.get(f"/api/media/references/{ref_id}/stream").status_code, 200)

