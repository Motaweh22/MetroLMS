"""Adaptive FFmpeg video probing and MP4 conversion/compression utilities."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from typing import Optional


@dataclass(frozen=True)
class VideoProbeResult:
    """Metadata extracted via ffprobe."""

    video_codec: str
    pix_fmt: str
    width: int
    height: int
    bitrate: int
    audio_codec: str
    has_audio: bool
    format_name: str


@dataclass(frozen=True)
class TranscodeOutcome:
    """Result of adaptive MP4 conversion."""

    strategy: str
    size_bytes: int
    sha256_checksum: str


def _resolve_winget_binary(exe_name: str) -> Optional[str]:
    """Locate binary in Windows WinGet Links / Packages if not in current process PATH."""
    local_app = os.environ.get("LOCALAPPDATA") or ""
    if not local_app:
        return None
    links_candidate = Path(local_app) / "Microsoft" / "WinGet" / "Links" / exe_name
    if links_candidate.is_file():
        return str(links_candidate)
    pkg_root = Path(local_app) / "Microsoft" / "WinGet" / "Packages"
    if pkg_root.is_dir():
        for match in pkg_root.glob(f"Gyan.FFmpeg*/**/{exe_name}"):
            if match.is_file():
                return str(match)
    return None


def find_ffmpeg_binaries() -> tuple[Optional[str], Optional[str]]:
    """Return (ffmpeg_path, ffprobe_path), checking env overrides, PATH, and WinGet."""
    ffmpeg_path = (os.environ.get("METROLMS_FFMPEG_PATH") or "").strip() or shutil.which("ffmpeg")
    if not ffmpeg_path and os.name == "nt":
        ffmpeg_path = _resolve_winget_binary("ffmpeg.exe")

    ffprobe_path = (os.environ.get("METROLMS_FFPROBE_PATH") or "").strip() or shutil.which("ffprobe")
    if not ffprobe_path and ffmpeg_path:
        sibling = Path(ffmpeg_path).with_name("ffprobe.exe" if os.name == "nt" else "ffprobe")
        if sibling.is_file():
            ffprobe_path = str(sibling)
    if not ffprobe_path and os.name == "nt":
        ffprobe_path = _resolve_winget_binary("ffprobe.exe")

    return ffmpeg_path, ffprobe_path


def probe_video(source_path: Path) -> VideoProbeResult:
    """Inspect video and audio streams via ffprobe."""
    _, ffprobe_path = find_ffmpeg_binaries()
    if not ffprobe_path:
        raise RuntimeError("لم يتم العثور على أداة ffprobe على الخادم.")

    cmd = [
        ffprobe_path,
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(source_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=60)
    data = json.loads(res.stdout or "{}")
    streams = data.get("streams") or []
    fmt = data.get("format") or {}

    v_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    a_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if v_stream is None:
        raise ValueError("الملف المرفوع لا يحتوي على مسار فيديو صالح.")

    def _safe_int(val: object) -> int:
        try:
            return max(0, int(float(str(val))))
        except (TypeError, ValueError):
            return 0

    bitrate = _safe_int(v_stream.get("bit_rate")) or _safe_int(fmt.get("bit_rate"))
    return VideoProbeResult(
        video_codec=str(v_stream.get("codec_name") or "").lower(),
        pix_fmt=str(v_stream.get("pix_fmt") or "").lower(),
        width=_safe_int(v_stream.get("width")),
        height=_safe_int(v_stream.get("height")),
        bitrate=bitrate,
        audio_codec=str(a_stream.get("codec_name") or "").lower() if a_stream else "",
        has_audio=a_stream is not None,
        format_name=str(fmt.get("format_name") or "").lower(),
    )


def choose_transcode_strategy(probe: VideoProbeResult, source_ext: str) -> str:
    """Choose lossless remux vs quality-preserving smart transcode."""
    try:
        max_copy_bps = int(os.environ.get("METROLMS_VIDEO_COPY_MAX_BITRATE_BPS", "5500000"))
    except ValueError:
        max_copy_bps = 5_500_000
    try:
        max_width = int(os.environ.get("METROLMS_VIDEO_MAX_WIDTH", "1920"))
    except ValueError:
        max_width = 1920

    ext = source_ext.lower()
    is_h264_web = (
        probe.video_codec == "h264"
        and (not probe.pix_fmt or probe.pix_fmt == "yuv420p")
        and (probe.width == 0 or probe.width <= max_width)
        and (probe.bitrate == 0 or probe.bitrate <= max_copy_bps)
    )
    if is_h264_web:
        if ext in {".mp4", ".m4v"} and (not probe.has_audio or probe.audio_codec == "aac"):
            return "faststart_copy"
        return "remux_video_copy"
    return "smart_transcode"


def _compute_sha256(file_path: Path) -> tuple[int, str]:
    sha256 = hashlib.sha256()
    total = 0
    with file_path.open("rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            sha256.update(chunk)
    return total, sha256.hexdigest()


def transcode_to_mp4(source_path: Path, dest_mp4_path: Path) -> TranscodeOutcome:
    """Convert any video file into web-streamable MP4 (H.264/AAC +faststart)."""
    ffmpeg_path, _ = find_ffmpeg_binaries()
    if not ffmpeg_path:
        raise RuntimeError("لم يتم العثور على أداة ffmpeg على الخادم.")

    probe = probe_video(source_path)
    strategy = choose_transcode_strategy(probe, source_path.suffix)
    crf = (os.environ.get("METROLMS_VIDEO_CRF") or "21").strip() or "21"
    preset = (os.environ.get("METROLMS_VIDEO_PRESET") or "faster").strip() or "faster"
    try:
        max_width = int(os.environ.get("METROLMS_VIDEO_MAX_WIDTH", "1920"))
    except ValueError:
        max_width = 1920

    dest_mp4_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_out = dest_mp4_path.with_name(f"{dest_mp4_path.stem}.transcoding.mp4")
    if tmp_out.exists():
        tmp_out.unlink(missing_ok=True)

    cmd: list[str] = [ffmpeg_path, "-y", "-i", str(source_path)]
    if strategy == "faststart_copy":
        cmd.extend(["-c", "copy", "-movflags", "+faststart", str(tmp_out)])
    elif strategy == "remux_video_copy":
        cmd.extend(["-c:v", "copy"])
        if probe.has_audio:
            if probe.audio_codec == "aac":
                cmd.extend(["-c:a", "copy"])
            else:
                cmd.extend(["-c:a", "aac", "-b:a", "128k"])
        else:
            cmd.append("-an")
        cmd.extend(["-movflags", "+faststart", str(tmp_out)])
    else:
        scale_filter = f"scale='if(gt(iw,{max_width}),{max_width},trunc(iw/2)*2)':-2"
        cmd.extend(
            [
                "-c:v",
                "libx264",
                "-preset",
                preset,
                "-crf",
                crf,
                "-pix_fmt",
                "yuv420p",
                "-vf",
                scale_filter,
            ]
        )
        if probe.has_audio:
            cmd.extend(["-c:a", "aac", "-b:a", "128k"])
        else:
            cmd.append("-an")
        cmd.extend(["-movflags", "+faststart", str(tmp_out)])

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=3600)
        os.replace(tmp_out, dest_mp4_path)
        size_bytes, checksum = _compute_sha256(dest_mp4_path)
        return TranscodeOutcome(strategy=strategy, size_bytes=size_bytes, sha256_checksum=checksum)
    except Exception:
        if tmp_out.exists():
            tmp_out.unlink(missing_ok=True)
        raise
