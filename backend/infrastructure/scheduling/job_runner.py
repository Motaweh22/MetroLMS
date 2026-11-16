"""Idempotent ScheduledJob runner with Africa/Cairo DST handling & 0..2 retry guard (TR-C3-04, WP55-PT-05)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Callable
from zoneinfo import ZoneInfo

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.communications.models import ScheduledJob, ScheduledJobRun
from apps.groups.models import TrainingGroup
from apps.groups.services.group_service import renew_training_group

CAIRO_TZ = ZoneInfo("Africa/Cairo")


def get_cairo_bucket_key(dt: datetime | None = None, bucket_hours: int = 6) -> str:
    """Return a DST-safe Africa/Cairo 6-hour idempotency bucket key (includes UTC offset)."""
    utc_dt = dt or timezone.now()
    if timezone.is_naive(utc_dt):
        utc_dt = timezone.make_aware(utc_dt, timezone=ZoneInfo("UTC"))
    cairo_dt = utc_dt.astimezone(CAIRO_TZ)
    bucket = cairo_dt.hour // bucket_hours
    offset = cairo_dt.strftime("%z")  # e.g. +0200 or +0300 during Cairo DST
    return f"{cairo_dt.strftime('%Y-%m-%d')}-B{bucket}-UTC{offset}"


def run_scheduled_job_with_idempotency(
    *,
    job_key: str,
    idempotency_key: str,
    fn: Callable[[], dict[str, Any]],
    schedule_config: str = "0 */6 * * *",
) -> ScheduledJobRun:
    """Execute a scheduled job with TR-C3-04 idempotency and max retry_count 0..2."""
    job, _ = ScheduledJob.objects.get_or_create(
        job_key=job_key,
        defaults={
            "schedule_config": schedule_config,
            "timezone": "Africa/Cairo",
            "is_enabled": True,
        },
    )

    if not job.is_enabled:
        existing = ScheduledJobRun.objects.filter(idempotency_key=idempotency_key).first()
        if existing is not None:
            return existing
        return ScheduledJobRun.objects.create(
            job=job,
            idempotency_key=idempotency_key,
            status="Skipped",
            retry_count=0,
            started_at=timezone.now(),
            completed_at=timezone.now(),
            details_json={"reason": "job_disabled"},
        )

    now = timezone.now()
    run = ScheduledJobRun.objects.filter(idempotency_key=idempotency_key).first()
    if run is not None:
        if run.status in {"Succeeded", "Skipped"}:
            return run
        if run.status == "Failed":
            if run.retry_count >= 2:
                return run
            run.retry_count += 1
            run.status = "Running"
            run.error_message = None
            run.save(update_fields=["retry_count", "status", "error_message"])
    else:
        try:
            with transaction.atomic():
                run = ScheduledJobRun.objects.create(
                    job=job,
                    idempotency_key=idempotency_key,
                    status="Running",
                    retry_count=0,
                    started_at=now,
                )
        except IntegrityError:
            # Concurrent worker created the run first
            return ScheduledJobRun.objects.get(idempotency_key=idempotency_key)

    try:
        result = fn()
    except Exception as exc:
        run.status = "Failed"
        run.completed_at = timezone.now()
        run.error_message = str(exc)
        run.save(update_fields=["status", "completed_at", "error_message"])
        return run

    run.status = "Succeeded"
    run.completed_at = timezone.now()
    run.details_json = result
    run.save(update_fields=["status", "completed_at", "details_json"])
    return run


def process_due_group_renewals_task(now: datetime | None = None) -> dict[str, Any]:
    """Process all reminder TrainingGroups whose next_scheduled_renewal_date <= now."""
    effective_now = now or timezone.now()
    due_groups = list(
        TrainingGroup.objects.filter(
            group_type="reminder",
            is_archived=False,
            auto_renewal_enabled=True,
            next_scheduled_renewal_date__isnull=False,
            next_scheduled_renewal_date__lte=effective_now,
        ).order_by("id")
    )
    renewed_ids: list[int] = []
    errors: list[dict[str, Any]] = []

    for grp in due_groups:
        try:
            cycle = renew_training_group(actor=None, group_id=grp.id, is_automatic=True)
            renewed_ids.append(grp.id)
        except Exception as exc:
            errors.append({"groupId": grp.id, "error": str(exc)})

    return {
        "processedAtUtc": effective_now.isoformat(),
        "dueCount": len(due_groups),
        "renewedGroupIds": renewed_ids,
        "errors": errors,
    }

