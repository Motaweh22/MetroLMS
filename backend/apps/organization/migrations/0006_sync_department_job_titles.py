"""Backfill DepartmentJobTitle composite link rows for all JobTitles with a department."""
from django.db import migrations


def backfill_department_job_titles(apps, schema_editor):
    JobTitle = apps.get_model("organization", "JobTitle")
    DepartmentJobTitle = apps.get_model("organization", "DepartmentJobTitle")

    for job in JobTitle.objects.exclude(department_id__isnull=True):
        DepartmentJobTitle.objects.get_or_create(
            department_id=job.department_id,
            job_title_id=job.id,
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0005_seed_marital_and_military_catalogs"),
    ]

    operations = [
        migrations.RunPython(backfill_department_job_titles, noop_reverse),
    ]
