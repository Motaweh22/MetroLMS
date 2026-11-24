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
        self.marital = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})[0]
        self.military = MilitaryServiceStatusCatalog.objects.get_or_create(code="completed", defaults={"name_ar": "أنهى الخدمة"})[0]
        self.metro_line = MetroLine.objects.get_or_create(name_ar="الخط الأول")[0]

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
            access_mode="all_trainees",
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

    def test_2gb_video_limit_ffmpeg_adaptive_mp4_conversion_and_stream_tickets(self) -> None:
        from pathlib import Path
        import subprocess

        from apps.media.services.media_service import verify_stream_ticket
        from infrastructure.media_processing import (
            VideoProbeResult,
            choose_transcode_strategy,
            find_ffmpeg_binaries,
            probe_video,
        )
        from infrastructure.storage import ALLOWED_MEDIA_SPECS

        # 1. Verify 2GB (2048 MB) limit & container formats
        for mime in (
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-matroska",
            "video/ogg",
            "video/x-msvideo",
            "video/x-m4v",
        ):
            self.assertIn(mime, ALLOWED_MEDIA_SPECS)
            self.assertEqual(ALLOWED_MEDIA_SPECS[mime]["default_mb"], 2048)

        # 2. Verify adaptive strategy picks lossless copy vs smart transcode properly
        self.assertEqual(
            choose_transcode_strategy(
                VideoProbeResult("h264", "yuv420p", 1280, 720, 2_000_000, "aac", True, "mp4"),
                ".mp4",
            ),
            "faststart_copy",
        )
        self.assertEqual(
            choose_transcode_strategy(
                VideoProbeResult("h264", "yuv420p", 1920, 1080, 3_000_000, "opus", True, "matroska"),
                ".mkv",
            ),
            "remux_video_copy",
        )
        self.assertEqual(
            choose_transcode_strategy(
                VideoProbeResult("vp9", "yuv420p", 1920, 1080, 1_500_000, "opus", True, "webm"),
                ".webm",
            ),
            "smart_transcode",
        )
        self.assertEqual(
            choose_transcode_strategy(
                VideoProbeResult("h264", "yuv420p", 3840, 2160, 15_000_000, "aac", True, "mp4"),
                ".mp4",
            ),
            "smart_transcode",
        )

        # 3. Real FFmpeg upload conversion: generate an AVI video, upload it, verify converted MP4 & Range ticket
        ffmpeg_bin, _ = find_ffmpeg_binaries()
        self.assertIsNotNone(ffmpeg_bin, "FFmpeg must be installed for transcode test")

        avi_path = Path(self._tmp_dir.name) / "sample_source.avi"
        subprocess.run(
            [
                ffmpeg_bin,
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=1:size=320x240:rate=15",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=1",
                "-c:v",
                "mpeg4",
                "-c:a",
                "mp3",
                str(avi_path),
            ],
            check=True,
            capture_output=True,
            timeout=60,
        )

        lec_client = self._login(self.lecturer.phone_e164)
        trainee_client = self._login(self.trainee.phone_e164)
        with avi_path.open("rb") as fh:
            up_file = SimpleUploadedFile("  محاضرة_تجريبية.avi  ", fh.read(), content_type="video/x-msvideo")
        up_res = lec_client.post("/api/media/assets/upload", {"file": up_file, "courseId": str(self.course.id)})
        self.assertEqual(up_res.status_code, 201)
        asset_dto = up_res.json()["data"]["asset"]
        self.assertEqual(asset_dto["mimeType"], "video/mp4")
        self.assertTrue(asset_dto["fileName"].endswith(".mp4"))
        self.assertEqual(asset_dto["transcodeStatus"], "ready")

        asset_obj = MediaAsset.objects.get(pk=asset_dto["id"])
        stored_path = LocalMediaStorage(self._tmp_dir.name).resolve_safe_path(asset_obj.storage_key)
        probed = probe_video(stored_path)
        self.assertEqual(probed.video_codec, "h264")
        self.assertEqual(probed.pix_fmt, "yuv420p")
        self.assertEqual(probed.audio_codec, "aac")

        # Bind reference to draft and mint user-bound stream ticket
        ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": asset_dto["id"], "courseDraftId": self.draft.id, "title": "درس الفيديو المحول"},
            content_type="application/json",
        )
        self.assertEqual(ref_res.status_code, 201)
        ref_id = ref_res.json()["data"]["reference"]["id"]

        ticket_res = lec_client.post(
            "/api/media/stream-ticket",
            data={"url": f"/api/media/references/{ref_id}/stream"},
            content_type="application/json",
        )
        self.assertEqual(ticket_res.status_code, 200)
        ticket = ticket_res.json()["data"]["ticket"]
        self.assertTrue(verify_stream_ticket(ticket, user_id=self.lecturer.id, kind="ref", target_id=ref_id))
        self.assertFalse(verify_stream_ticket(ticket, user_id=self.trainee.id, kind="ref", target_id=ref_id))

        # Direct download without ticket/header on non-testserver (even with browser Accept: text/html) returns 403 JSON, never 500 TemplateDoesNotExist
        blocked_res = lec_client.get(
            f"/api/media/references/{ref_id}/stream",
            SERVER_NAME="localhost",
            HTTP_ACCEPT="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        self.assertEqual(blocked_res.status_code, 403)
        self.assertEqual(blocked_res.json()["code"], "DIRECT_DOWNLOAD_BLOCKED")

        # Wrong user's ticket cannot bypass direct-download protection
        stolen_res = trainee_client.get(
            f"/api/media/references/{ref_id}/stream?st={ticket}",
            SERVER_NAME="localhost",
        )
        self.assertEqual(stolen_res.status_code, 403)

        # Valid ticket streams HTTP 206 Partial Content natively as video/mp4
        stream_206 = lec_client.get(
            f"/api/media/references/{ref_id}/stream?st={ticket}",
            HTTP_RANGE="bytes=0-15",
            SERVER_NAME="localhost",
        )
        self.assertEqual(stream_206.status_code, 206)
        self.assertEqual(stream_206["Content-Type"], "video/mp4")
        self.assertEqual(len(b"".join(stream_206.streaming_content)), 16)

    def test_rbac_blocks_unrelated_lecturer_and_non_targeted_trainee_from_streaming(self) -> None:
        now = timezone.now()
        other_lecturer = User.objects.create_user(
            phone_e164="+201000000499",
            password="TestPassword@123",
            role=self.role_lecturer,
            full_name="محاضر آخر",
            national_id="29501010105099",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.metro_line,
        )
        draft_only_course = Course.objects.create(
            title="دورة مسودة خاصة",
            course_type="main",
            primary_lecturer=self.lecturer,
            lifecycle_status="Draft",
            access_mode="targeted",
            created_by_user=self.lecturer,
            created_at=now,
            updated_at=now,
        )
        private_draft = CourseDraft.objects.create(
            course=draft_only_course,
            title_snapshot="مسودة خاصة",
            updated_at=now,
            updated_by_user=self.lecturer,
        )

        lec_client = self._login(self.lecturer.phone_e164)
        other_lec_client = self._login(other_lecturer.phone_e164)
        trainee_client = self._login(self.trainee.phone_e164)

        pdf_file = SimpleUploadedFile("secret.pdf", b"%PDF-1.4\nPRIVATE-DATA", content_type="application/pdf")
        up_res = lec_client.post("/api/media/assets/upload", {"file": pdf_file})
        self.assertEqual(up_res.status_code, 201)
        asset_id = up_res.json()["data"]["asset"]["id"]

        ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": asset_id, "courseDraftId": private_draft.id, "title": "ملف خاص"},
            content_type="application/json",
        )
        self.assertEqual(ref_res.status_code, 201)
        ref_id = ref_res.json()["data"]["reference"]["id"]

        # Unrelated lecturer cannot read metadata, mint ticket, or stream another lecturer's draft asset/reference
        self.assertEqual(other_lec_client.get(f"/api/media/assets/{asset_id}").status_code, 403)
        self.assertEqual(other_lec_client.get(f"/api/media/assets/{asset_id}/stream").status_code, 403)
        self.assertEqual(other_lec_client.get(f"/api/media/references/{ref_id}/stream").status_code, 403)

        # Trainee without targeting/enrollment cannot stream targeted published course reference
        from apps.courses.models import CourseAudienceMetroLine

        other_line, _ = MetroLine.objects.get_or_create(name_ar="الخط الثالث")
        self.course.access_mode = "targeted"
        self.course.save(update_fields=["access_mode"])
        CourseAudienceMetroLine.objects.create(course=self.course, metro_line=other_line)
        pub_pdf = SimpleUploadedFile("targeted.pdf", b"%PDF-1.4\nTARGETED", content_type="application/pdf")
        pub_up = lec_client.post("/api/media/assets/upload", {"file": pub_pdf})
        pub_ref = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": pub_up.json()["data"]["asset"]["id"], "courseDraftId": self.draft.id, "title": "ملف موجه"},
            content_type="application/json",
        )
        self.assertEqual(pub_ref.status_code, 201)
        self.assertEqual(
            trainee_client.get(f"/api/media/references/{pub_ref.json()['data']['reference']['id']}/stream").status_code,
            403,
        )

