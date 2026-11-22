# Generated manually for MetroLMS course ZIP archive download policy

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0008_refresher_config_json"),
    ]

    operations = [
        migrations.AddField(
            model_name="coursedraft",
            name="course_zip_policy",
            field=models.CharField(db_default="disabled", default="disabled", max_length=32),
        ),
        migrations.AddField(
            model_name="publishedcourseversion",
            name="course_zip_policy",
            field=models.CharField(db_default="disabled", default="disabled", max_length=32),
        ),
    ]
