# Generated manually for LessonItem.description

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0009_course_zip_policy"),
    ]

    operations = [
        migrations.AddField(
            model_name="lessonitem",
            name="description",
            field=models.TextField(blank=True, db_default="", default=""),
        ),
    ]
