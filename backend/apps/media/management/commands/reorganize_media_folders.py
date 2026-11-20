"""Management command to reorganize MediaAsset files into per-course/chapter/group folders and purge orphans."""
from __future__ import annotations

import json
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.media.models import MediaAsset, MediaContentReference
from infrastructure.storage.local_storage import LocalMediaStorage


class Command(BaseCommand):
    help = "Reorganize media assets into courses/course_<id>/chapter_<id>/ and groups/group_<id>/ and purge orphan files."

    def handle(self, *args, **options):
        storage = LocalMediaStorage()
        root = storage.root

        # Collect asset IDs referenced in group_materials/*.json
        group_json_assets: dict[int, int] = {}
        gm_dir = root / "group_materials"
        if gm_dir.exists():
            for jf in gm_dir.glob("group_*.json"):
                try:
                    gid = int(jf.stem.replace("group_", ""))
                    data = json.loads(jf.read_text(encoding="utf-8"))
                    for f in data.get("rootFiles", []):
                        aid = f.get("mediaAssetId") or f.get("mediaId")
                        if aid and str(aid).isdigit():
                            group_json_assets[int(aid)] = gid
                    for fld in data.get("folders", []):
                        for f in fld.get("files", []):
                            aid = f.get("mediaAssetId") or f.get("mediaId")
                            if aid and str(aid).isdigit():
                                group_json_assets[int(aid)] = gid
                except Exception:
                    continue

        moved_count = 0
        purged_count = 0

        for asset in MediaAsset.objects.all().order_by("id"):
            refs = list(
                MediaContentReference.objects.filter(media_asset=asset).select_related(
                    "course_draft",
                    "published_version",
                    "group_renewal_cycle",
                )
            )

            target_prefix: str | None = None
            if refs:
                chosen = next((r for r in refs if r.course_draft_id is not None), refs[0])
                if chosen.course_draft_id is not None:
                    cid = chosen.course_draft.course_id
                    if getattr(chosen.course_draft, "thumbnail_asset_id", None) == asset.id:
                        target_prefix = f"courses/course_{cid}/cover"
                    else:
                        from apps.courses.models import Module

                        first_mod = (
                            Module.objects.filter(course_draft_id=chosen.course_draft_id)
                            .order_by("sort_order", "id")
                            .first()
                        )
                        if first_mod is not None:
                            target_prefix = f"courses/course_{cid}/chapter_{first_mod.id}"
                        else:
                            target_prefix = f"courses/course_{cid}"
                elif chosen.published_version_id is not None:
                    cid = chosen.published_version.course_id
                    if getattr(chosen.published_version, "thumbnail_asset_id", None) == asset.id:
                        target_prefix = f"courses/course_{cid}/cover"
                    else:
                        from apps.courses.models import Module

                        first_mod = (
                            Module.objects.filter(published_version_id=chosen.published_version_id)
                            .order_by("sort_order", "id")
                            .first()
                        )
                        if first_mod is not None:
                            target_prefix = f"courses/course_{cid}/chapter_{first_mod.id}"
                        else:
                            target_prefix = f"courses/course_{cid}"
                elif chosen.group_renewal_cycle_id is not None:
                    gid = chosen.group_renewal_cycle.training_group_id
                    target_prefix = f"groups/group_{gid}"
            elif asset.id in group_json_assets:
                target_prefix = f"groups/group_{group_json_assets[asset.id]}"
            else:
                # Orphan asset (0 references everywhere) -> purge cleanly
                old_key = asset.storage_key
                asset.delete()
                try:
                    storage.delete_stored_file(old_key)
                except Exception:
                    pass
                purged_count += 1
                self.stdout.write(f"Purged orphan asset #{asset.id} ({old_key})")
                continue

            if not target_prefix:
                continue

            filename = Path(asset.storage_key).name
            new_key = f"{target_prefix}/{filename}"
            if new_key == asset.storage_key:
                continue

            old_path = root / asset.storage_key
            new_path = storage.resolve_safe_path(new_key)
            if old_path.exists():
                new_path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    os.replace(old_path, new_path)
                except PermissionError:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Skipped locked file #{asset.id} (close active stream/tab and re-run): {old_path}"
                        )
                    )
                    continue
            asset.storage_key = new_key
            asset.save(update_fields=["storage_key"])
            moved_count += 1
            self.stdout.write(f"Moved asset #{asset.id}: {old_path.name} -> {new_key}")

        # Clean up empty directories under assets/
        assets_dir = root / "assets"
        if assets_dir.exists():
            for dirpath, dirnames, filenames in os.walk(assets_dir, topdown=False):
                p = Path(dirpath)
                if not any(p.iterdir()):
                    p.rmdir()

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Moved: {moved_count}, Purged orphans: {purged_count}."
            )
        )
