"""BP-07 integration tests: Storage abstraction, magic bytes, INV-DOM21-07..18, Range 206/416."""
from __future__ import annotations

import datetime
import tempfile
from unittest.mock import patch

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

    def test_2gb_video_limit_direct_upload_and_progressive_range_tickets(self) -> None:
        from apps.media.services.media_service import verify_stream_ticket
        from infrastructure.storage import ALLOWED_MEDIA_SPECS

        # 1. Verify 2GB (2048 MB) limit & allowed video formats remain intact
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

        # 2. Upload valid MP4 directly without FFmpeg compression/transcoding
        mp4_payload = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"X" * 64
        lec_client = self._login(self.lecturer.phone_e164)
        trainee_client = self._login(self.trainee.phone_e164)
        up_file = SimpleUploadedFile("  محاضرة_تجريبية.mp4  ", mp4_payload, content_type="video/mp4")
        up_res = lec_client.post("/api/media/assets/upload", {"file": up_file, "courseId": str(self.course.id)})
        self.assertEqual(up_res.status_code, 201)
        asset_dto = up_res.json()["data"]["asset"]
        self.assertEqual(asset_dto["mimeType"], "video/mp4")
        self.assertEqual(asset_dto["sizeBytes"], len(mp4_payload))

        # Bind reference to draft and mint user-bound stream ticket
        ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": asset_dto["id"], "courseDraftId": self.draft.id, "title": "درس الفيديو التدرجي"},
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

        # Direct download without ticket/header on non-testserver returns 403 JSON, never 500 TemplateDoesNotExist
        blocked_res = lec_client.get(
            f"/api/media/references/{ref_id}/stream",
            SERVER_NAME="localhost",
            HTTP_ACCEPT="text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        )
        self.assertEqual(blocked_res.status_code, 403)
        self.assertEqual(blocked_res.json()["code"], "DIRECT_DOWNLOAD_BLOCKED")

        # Another user's ticket is rejected
        stolen_res = trainee_client.get(
            f"/api/media/references/{ref_id}/stream?st={ticket}",
            SERVER_NAME="localhost",
        )
        self.assertEqual(stolen_res.status_code, 403)

        # Valid ticket streams HTTP 206 Partial Content natively as video/mp4 (no waiting for 100% download)
        stream_206 = lec_client.get(
            f"/api/media/references/{ref_id}/stream?st={ticket}",
            HTTP_RANGE="bytes=0-15",
            SERVER_NAME="localhost",
        )
        self.assertEqual(stream_206.status_code, 206)
        self.assertEqual(stream_206["Content-Type"], "video/mp4")
        self.assertEqual(b"".join(stream_206.streaming_content), mp4_payload[:16])

        # Open-ended Range (`bytes=0-`) caps A/V chunks so Waitress finishes chunks cleanly without abort noise
        from apps.media.api.views.media import _OPEN_RANGE_CHUNK_BYTES

        big_mp4 = mp4_payload + (b"B" * (_OPEN_RANGE_CHUNK_BYTES + 4096))
        big_upload = SimpleUploadedFile("big.mp4", big_mp4, content_type="video/mp4")
        big_asset_res = lec_client.post(
            "/api/media/assets/upload",
            {"file": big_upload, "courseId": str(self.course.id)},
        )
        self.assertEqual(big_asset_res.status_code, 201)
        big_asset_id = big_asset_res.json()["data"]["asset"]["id"]
        big_ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": big_asset_id, "courseDraftId": self.draft.id, "title": "فيديو كبير"},
            content_type="application/json",
        )
        self.assertEqual(big_ref_res.status_code, 201)
        big_ref_id = big_ref_res.json()["data"]["reference"]["id"]
        big_ticket_res = lec_client.post(
            "/api/media/stream-ticket",
            data={"url": f"/api/media/references/{big_ref_id}/stream"},
            content_type="application/json",
        )
        self.assertEqual(big_ticket_res.status_code, 200)
        big_ticket = big_ticket_res.json()["data"]["ticket"]
        open_range_res = lec_client.get(
            f"/api/media/references/{big_ref_id}/stream?st={big_ticket}",
            HTTP_RANGE="bytes=0-",
            SERVER_NAME="localhost",
        )
        self.assertEqual(open_range_res.status_code, 206)
        self.assertEqual(
            open_range_res["Content-Range"],
            f"bytes 0-{_OPEN_RANGE_CHUNK_BYTES - 1}/{len(big_mp4)}",
        )
        self.assertEqual(int(open_range_res["Content-Length"]), _OPEN_RANGE_CHUNK_BYTES)

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

    def _create_streamable_video(
        self,
        lec_client: Client,
        payload: bytes,
        *,
        name: str = "range-sample.mp4",
    ) -> tuple[int, int, str]:
        """Helper to upload an MP4, attach it to self.draft, and return (asset_id, ref_id, ticket)."""
        upload = SimpleUploadedFile(name, payload, content_type="video/mp4")
        asset_res = lec_client.post(
            "/api/media/assets/upload",
            {"file": upload, "courseId": str(self.course.id)},
        )
        self.assertEqual(asset_res.status_code, 201)
        asset_id = asset_res.json()["data"]["asset"]["id"]
        ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": asset_id, "courseDraftId": self.draft.id, "title": f"فيديو {name}"},
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
        return asset_id, ref_id, ticket_res.json()["data"]["ticket"]

    def test_range_clamping_boundaries_suffix_multi_range_and_zero_byte(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        # Predictable deterministic 4,096-byte MP4 payload so every slice is verified byte-for-byte
        mp4_header = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2"
        payload = mp4_header + bytes((i % 251 for i in range(4096 - len(mp4_header))))
        file_size = len(payload)
        self.assertEqual(file_size, 4096)

        asset_id, ref_id, ticket = self._create_streamable_video(lec_client, payload)
        stream_url = f"/api/media/references/{ref_id}/stream?st={ticket}"

        # 1. Normal explicit range (bytes=0-1023)
        res = lec_client.get(stream_url, HTTP_RANGE="bytes=0-1023", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 0-1023/{file_size}")
        self.assertEqual(int(res["Content-Length"]), 1024)
        self.assertEqual(res["Accept-Ranges"], "bytes")
        self.assertEqual(b"".join(res.streaming_content), payload[:1024])

        # 2. Open-ended start on smaller asset (bytes=0-)
        res = lec_client.get(stream_url, HTTP_RANGE="bytes=0-", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 0-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(b"".join(res.streaming_content), payload)

        # 3. Open-ended offset range (bytes=1024-)
        res = lec_client.get(stream_url, HTTP_RANGE="bytes=1024-", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 1024-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size - 1024)
        self.assertEqual(b"".join(res.streaming_content), payload[1024:])

        # 4. Suffix range (bytes=-500) & oversized suffix (bytes=-999999) & zero suffix (bytes=-0)
        res = lec_client.get(stream_url, HTTP_RANGE="bytes=-500", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes {file_size - 500}-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), 500)
        self.assertEqual(b"".join(res.streaming_content), payload[-500:])

        res = lec_client.get(stream_url, HTTP_RANGE="bytes=-999999", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 0-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(b"".join(res.streaming_content), payload)

        res = lec_client.get(stream_url, HTTP_RANGE="bytes=-0", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 416)
        self.assertEqual(res["Content-Range"], f"bytes */{file_size}")

        # 5. Explicit end beyond file size (bytes=0-999999999999 & bytes=1000-999999999999) -> clamp to file_size - 1
        res = lec_client.get(stream_url, HTTP_RANGE="bytes=0-999999999999", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 0-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(res["Accept-Ranges"], "bytes")
        self.assertEqual(b"".join(res.streaming_content), payload)

        res = lec_client.get(stream_url, HTTP_RANGE="bytes=1000-999999999999", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 1000-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size - 1000)
        self.assertEqual(b"".join(res.streaming_content), payload[1000:])

        # Direct MediaAssetStreamView also clamps explicit end beyond file size
        asset_ticket = lec_client.post(
            "/api/media/stream-ticket",
            data={"url": f"/api/media/assets/{asset_id}/stream"},
            content_type="application/json",
        ).json()["data"]["ticket"]
        res = lec_client.get(
            f"/api/media/assets/{asset_id}/stream?st={asset_ticket}",
            HTTP_RANGE="bytes=10-999999999999",
            SERVER_NAME="localhost",
        )
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 10-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size - 10)
        self.assertEqual(b"".join(res.streaming_content), payload[10:])

        # 6. Start beyond EOF & inverted bounds still return 416
        for invalid_range in ("bytes=999999999999-", f"bytes={file_size}-{file_size}", "bytes=500-100"):
            res = lec_client.get(stream_url, HTTP_RANGE=invalid_range, SERVER_NAME="localhost")
            self.assertEqual(res.status_code, 416, f"Expected 416 for {invalid_range}")
            self.assertEqual(res["Content-Range"], f"bytes */{file_size}")

        # 7. Valid multi-range falls back safely to 200 OK full representation (never spurious 416)
        res = lec_client.get(stream_url, HTTP_RANGE="bytes=0-100,200-300", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(res["Accept-Ranges"], "bytes")
        self.assertNotIn("Content-Range", res)
        self.assertEqual(b"".join(res.streaming_content), payload)

        # Malformed multi-range still returns 416
        for bad_multi in ("bytes=0-100,bad", "bytes=500-100,200-300"):
            res = lec_client.get(stream_url, HTTP_RANGE=bad_multi, SERVER_NAME="localhost")
            self.assertEqual(res.status_code, 416, f"Expected 416 for {bad_multi}")
            self.assertEqual(res["Content-Range"], f"bytes */{file_size}")

        # 8. Zero-byte file handling: normal GET & HEAD -> 200 empty (without open_range_stream); Range -> 416
        import hashlib

        storage = LocalMediaStorage()
        zero_key = storage.build_storage_key(".mp4")
        zero_path = storage.resolve_safe_path(zero_key)
        zero_path.parent.mkdir(parents=True, exist_ok=True)
        zero_path.write_bytes(b"")
        zero_asset = MediaAsset.objects.create(
            storage_key=zero_key,
            file_name="zero.mp4",
            mime_type="video/mp4",
            size_bytes=0,
            sha256_checksum=hashlib.sha256(b"").hexdigest(),
            uploaded_by_user=self.lecturer,
            created_at=timezone.now(),
        )
        zero_ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": zero_asset.id, "courseDraftId": self.draft.id, "title": "ملف فارغ"},
            content_type="application/json",
        )
        self.assertEqual(zero_ref_res.status_code, 201)
        zero_ref_id = zero_ref_res.json()["data"]["reference"]["id"]
        zero_ticket = lec_client.post(
            "/api/media/stream-ticket",
            data={"url": f"/api/media/references/{zero_ref_id}/stream"},
            content_type="application/json",
        ).json()["data"]["ticket"]
        zero_url = f"/api/media/references/{zero_ref_id}/stream?st={zero_ticket}"

        with patch.object(LocalMediaStorage, "open_range_stream") as mock_open:
            zero_get = lec_client.get(zero_url, SERVER_NAME="localhost")
            self.assertEqual(zero_get.status_code, 200)
            self.assertEqual(int(zero_get["Content-Length"]), 0)
            self.assertEqual(zero_get["Accept-Ranges"], "bytes")
            self.assertEqual(zero_get.content, b"")

            zero_head = lec_client.head(zero_url, HTTP_RANGE="bytes=0-10", SERVER_NAME="localhost")
            self.assertEqual(zero_head.status_code, 200)
            self.assertEqual(int(zero_head["Content-Length"]), 0)
            self.assertEqual(zero_head["Accept-Ranges"], "bytes")
            self.assertEqual(zero_head.content, b"")
            mock_open.assert_not_called()

        for zero_range in ("bytes=0-", "bytes=0-10", "bytes=-500", "bytes=0-100,200-300"):
            zero_r = lec_client.get(zero_url, HTTP_RANGE=zero_range, SERVER_NAME="localhost")
            self.assertEqual(zero_r.status_code, 416)
            self.assertEqual(zero_r["Content-Range"], "bytes */0")

    def test_head_requests_return_full_metadata_without_body_or_storage_read_and_enforce_rbac(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        mp4_payload = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2" + (b"X" * 2048)
        file_size = len(mp4_payload)
        asset_id, ref_id, ref_ticket = self._create_streamable_video(lec_client, mp4_payload, name="head-sample.mp4")

        asset_ticket = lec_client.post(
            "/api/media/stream-ticket",
            data={"url": f"/api/media/assets/{asset_id}/stream"},
            content_type="application/json",
        ).json()["data"]["ticket"]

        # Unauthenticated HEAD must fail with 401 matching GET
        anon = Client()
        self.assertEqual(anon.head(f"/api/media/references/{ref_id}/stream?st={ref_ticket}").status_code, 401)
        self.assertEqual(anon.head(f"/api/media/assets/{asset_id}/stream?st={asset_ticket}").status_code, 401)

        # HEAD on A/V without stream ticket/header from non-testserver host must fail with 403 matching GET DIRECT_DOWNLOAD_BLOCKED
        no_ticket_head = lec_client.head(f"/api/media/references/{ref_id}/stream", SERVER_NAME="localhost")
        self.assertEqual(no_ticket_head.status_code, 403)
        self.assertEqual(no_ticket_head.content, b"")
        no_ticket_get = lec_client.get(f"/api/media/references/{ref_id}/stream", SERVER_NAME="localhost")
        self.assertEqual(no_ticket_get.status_code, 403)
        self.assertEqual(no_ticket_get.json()["code"], "DIRECT_DOWNLOAD_BLOCKED")

        # HEAD by non-authorized trainee on draft reference must fail with 403
        trainee_client = self._login(self.trainee.phone_e164)
        self.assertEqual(
            trainee_client.head(f"/api/media/references/{ref_id}/stream", SERVER_NAME="localhost").status_code,
            403,
        )
        self.assertEqual(
            trainee_client.head(f"/api/media/assets/{asset_id}/stream", SERVER_NAME="localhost").status_code,
            403,
        )

        # Authorized HEAD without Range and with Range -> both 200, full headers, empty body, zero storage stream reads
        with patch.object(LocalMediaStorage, "open_range_stream") as mock_open:
            head_plain = lec_client.head(
                f"/api/media/references/{ref_id}/stream?st={ref_ticket}",
                SERVER_NAME="localhost",
            )
            self.assertEqual(head_plain.status_code, 200)
            self.assertEqual(int(head_plain["Content-Length"]), file_size)
            self.assertEqual(head_plain["Accept-Ranges"], "bytes")
            self.assertEqual(head_plain["Content-Type"], "video/mp4")
            self.assertEqual(head_plain["X-Original-Mime-Type"], "video/mp4")
            self.assertEqual(head_plain["X-Content-Type-Options"], "nosniff")
            self.assertEqual(head_plain["Cache-Control"], "no-store")
            self.assertNotIn("Content-Range", head_plain)
            self.assertEqual(head_plain.content, b"")

            head_with_range = lec_client.head(
                f"/api/media/references/{ref_id}/stream?st={ref_ticket}",
                HTTP_RANGE="bytes=0-1023",
                SERVER_NAME="localhost",
            )
            self.assertEqual(head_with_range.status_code, 200)
            self.assertEqual(int(head_with_range["Content-Length"]), file_size)
            self.assertEqual(head_with_range["Accept-Ranges"], "bytes")
            self.assertNotIn("Content-Range", head_with_range)
            self.assertEqual(head_with_range.content, b"")

            asset_head = lec_client.head(
                f"/api/media/assets/{asset_id}/stream?st={asset_ticket}",
                HTTP_RANGE="bytes=0-100",
                SERVER_NAME="localhost",
            )
            self.assertEqual(asset_head.status_code, 200)
            self.assertEqual(int(asset_head["Content-Length"]), file_size)
            self.assertEqual(asset_head["Accept-Ranges"], "bytes")
            self.assertNotIn("Content-Range", asset_head)
            self.assertEqual(asset_head.content, b"")

            mock_open.assert_not_called()

    def test_extremely_large_range_numbers_above_python_digit_limit(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        mp4_header = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2"
        payload = mp4_header + bytes((i % 251 for i in range(4096 - len(mp4_header))))
        file_size = len(payload)
        _, ref_id, ticket = self._create_streamable_video(lec_client, payload, name="huge-range.mp4")
        stream_url = f"/api/media/references/{ref_id}/stream?st={ticket}"

        huge_9s = "9" * 4500
        huge_8s = "8" * 4500
        huge_zeros = "0" * 4500
        self.assertGreater(len(huge_9s), 4300)

        # 1. Extremely large first-byte position -> 416 without ValueError or 500
        for huge_start in (f"bytes={huge_9s}-", f"bytes={huge_9s}-9{'9' * 4500}"):
            res = lec_client.get(stream_url, HTTP_RANGE=huge_start, SERVER_NAME="localhost")
            self.assertEqual(res.status_code, 416)
            self.assertEqual(res["Content-Range"], f"bytes */{file_size}")

        # 2. Extremely large explicit end with valid start -> clamp to file_size - 1
        res = lec_client.get(stream_url, HTTP_RANGE=f"bytes=0-{huge_9s}", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 0-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(b"".join(res.streaming_content), payload)

        res = lec_client.get(stream_url, HTTP_RANGE=f"bytes=100-{huge_9s}", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 100-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size - 100)
        self.assertEqual(b"".join(res.streaming_content), payload[100:])

        # Leading-zero padded small range > 4,300 chars still resolves exact slice
        res = lec_client.get(
            stream_url,
            HTTP_RANGE=f"bytes={huge_zeros}10-{huge_zeros}99",
            SERVER_NAME="localhost",
        )
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 10-99/{file_size}")
        self.assertEqual(int(res["Content-Length"]), 90)
        self.assertEqual(b"".join(res.streaming_content), payload[10:100])

        # 3. Extremely large suffix length -> complete representation; huge all-zero suffix -> 416
        res = lec_client.get(stream_url, HTTP_RANGE=f"bytes=-{huge_9s}", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res["Content-Range"], f"bytes 0-{file_size - 1}/{file_size}")
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(b"".join(res.streaming_content), payload)

        res = lec_client.get(stream_url, HTTP_RANGE=f"bytes=-{huge_zeros}", SERVER_NAME="localhost")
        self.assertEqual(res.status_code, 416)
        self.assertEqual(res["Content-Range"], f"bytes */{file_size}")

        # 4. Extremely large numeric components inside multi-range headers
        res = lec_client.get(
            stream_url,
            HTTP_RANGE=f"bytes=0-100,200-{huge_9s}",
            SERVER_NAME="localhost",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(b"".join(res.streaming_content), payload)

        res = lec_client.get(
            stream_url,
            HTTP_RANGE=f"bytes=0-100,{huge_9s}-",
            SERVER_NAME="localhost",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(int(res["Content-Length"]), file_size)
        self.assertEqual(b"".join(res.streaming_content), payload)

        # Inverted huge range inside multi-range -> 416 without uncaught ValueError
        res = lec_client.get(
            stream_url,
            HTTP_RANGE=f"bytes={huge_9s}-{huge_8s},0-100",
            SERVER_NAME="localhost",
        )
        self.assertEqual(res.status_code, 416)
        self.assertEqual(res["Content-Range"], f"bytes */{file_size}")

    def test_head_with_format_json_matches_get_metadata_without_reading_or_encoding(self) -> None:
        import base64
        import hashlib

        lec_client = self._login(self.lecturer.phone_e164)
        trainee_client = self._login(self.trainee.phone_e164)

        # Non-empty PDF covering non-3-byte-multiple size (100 bytes -> `==` base64 padding)
        pdf_payload = b"%PDF-1.4\n" + (b"Q" * 91)
        self.assertEqual(len(pdf_payload), 100)
        up_res = lec_client.post(
            "/api/media/assets/upload",
            {"file": SimpleUploadedFile("doc.pdf", pdf_payload, content_type="application/pdf")},
        )
        self.assertEqual(up_res.status_code, 201)
        pdf_asset_id = up_res.json()["data"]["asset"]["id"]
        pdf_ref_res = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": pdf_asset_id, "courseDraftId": self.draft.id, "title": "مستند"},
            content_type="application/json",
        )
        self.assertEqual(pdf_ref_res.status_code, 201)
        pdf_ref_id = pdf_ref_res.json()["data"]["reference"]["id"]

        # Zero-byte PDF stored on disk
        storage = LocalMediaStorage()
        zero_pdf_key = storage.build_storage_key(".pdf")
        zero_pdf_path = storage.resolve_safe_path(zero_pdf_key)
        zero_pdf_path.parent.mkdir(parents=True, exist_ok=True)
        zero_pdf_path.write_bytes(b"")
        zero_pdf_asset = MediaAsset.objects.create(
            storage_key=zero_pdf_key,
            file_name="empty.pdf",
            mime_type="application/pdf",
            size_bytes=0,
            sha256_checksum=hashlib.sha256(b"").hexdigest(),
            uploaded_by_user=self.lecturer,
            created_at=timezone.now(),
        )
        zero_pdf_ref = lec_client.post(
            "/api/media/references",
            data={"mediaAssetId": zero_pdf_asset.id, "courseDraftId": self.draft.id, "title": "مستند فارغ"},
            content_type="application/json",
        )
        self.assertEqual(zero_pdf_ref.status_code, 201)
        zero_pdf_ref_id = zero_pdf_ref.json()["data"]["reference"]["id"]

        # Auth & RBAC preserved for HEAD ?format=json (hidden ref blocks trainee on both GET & HEAD)
        self.assertEqual(Client().head(f"/api/media/references/{pdf_ref_id}/stream?format=json").status_code, 401)
        self.assertEqual(
            lec_client.patch(
                f"/api/media/references/{pdf_ref_id}",
                data={"isVisible": False},
                content_type="application/json",
            ).status_code,
            200,
        )
        self.assertEqual(trainee_client.get(f"/api/media/references/{pdf_ref_id}/stream?format=json").status_code, 403)
        self.assertEqual(trainee_client.head(f"/api/media/references/{pdf_ref_id}/stream?format=json").status_code, 403)
        self.assertEqual(trainee_client.head(f"/api/media/assets/{pdf_asset_id}/stream?format=json").status_code, 403)
        self.assertEqual(
            lec_client.patch(
                f"/api/media/references/{pdf_ref_id}",
                data={"isVisible": True},
                content_type="application/json",
            ).status_code,
            200,
        )

        endpoints = (
            f"/api/media/references/{pdf_ref_id}/stream?format=json",
            f"/api/media/assets/{pdf_asset_id}/stream?format=json",
            f"/api/media/references/{zero_pdf_ref_id}/stream?format=json",
            f"/api/media/assets/{zero_pdf_asset.id}/stream?format=json",
        )

        # HEAD ?format=json must neither open/read the file nor base64-encode media bytes, nor return a body
        head_results = []
        with (
            patch.object(LocalMediaStorage, "open_range_stream") as mock_open,
            patch.object(base64, "b64encode", wraps=base64.b64encode) as mock_b64encode,
        ):
            for url in endpoints:
                h_res = lec_client.head(url, HTTP_RANGE="bytes=0-10")
                head_results.append((url, h_res))
            mock_open.assert_not_called()
            encoded_inputs = [call.args[0] for call in mock_b64encode.call_args_list if call.args]
            self.assertNotIn(pdf_payload, encoded_inputs)
            self.assertNotIn(b"", encoded_inputs)

        for url, h_res in head_results:
            g_res = lec_client.get(url)
            self.assertEqual(h_res.status_code, 200)
            self.assertEqual(g_res.status_code, 200)
            self.assertEqual(h_res["Content-Type"], "application/json")
            self.assertEqual(g_res["Content-Type"], "application/json")
            self.assertEqual(h_res.content, b"")
            self.assertEqual(int(h_res["Content-Length"]), len(g_res.content))
            self.assertEqual(int(g_res["Content-Length"]), len(g_res.content))

