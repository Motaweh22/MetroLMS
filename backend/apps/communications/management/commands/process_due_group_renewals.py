"""Management command: process_due_group_renewals (Windows Task Scheduler 6h)."""
from __future__ import annotations

import json

from django.core.management.base import BaseCommand

from infrastructure.scheduling.job_runner import (
    get_cairo_bucket_key,
    process_due_group_renewals_task,
    run_scheduled_job_with_idempotency,
)


class Command(BaseCommand):
    help = "Process due reminder TrainingGroup renewals idempotently (TR-C3-04, Africa/Cairo 6h bucket)."

    def handle(self, *args, **options) -> None:
        bucket_key = get_cairo_bucket_key()
        idempotency_key = f"process_due_group_renewals:{bucket_key}"
        run = run_scheduled_job_with_idempotency(
            job_key="process_due_group_renewals",
            idempotency_key=idempotency_key,
            fn=process_due_group_renewals_task,
        )
        self.stdout.write(
            json.dumps(
                {
                    "jobKey": "process_due_group_renewals",
                    "idempotencyKey": run.idempotency_key,
                    "status": run.status,
                    "retryCount": run.retry_count,
                    "details": run.details_json,
                },
                ensure_ascii=False,
            )
        )

