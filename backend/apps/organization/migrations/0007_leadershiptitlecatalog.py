"""Create LeadershipTitleCatalog model table."""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0006_sync_department_job_titles"),
    ]

    operations = [
        migrations.CreateModel(
            name="LeadershipTitleCatalog",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("name_ar", models.CharField(max_length=100, unique=True)),
                ("name_en", models.CharField(blank=True, max_length=100, null=True)),
            ],
            options={
                "db_table": "organization_leadershiptitlecatalog",
            },
        ),
    ]
