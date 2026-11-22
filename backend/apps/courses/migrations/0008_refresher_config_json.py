# Generated manually for MetroLMS refresher curriculum extensions

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0007_alter_lessonitem_download_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="coursedraft",
            name="refresher_config_json",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name="publishedcourseversion",
            name="refresher_config_json",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
    ]
