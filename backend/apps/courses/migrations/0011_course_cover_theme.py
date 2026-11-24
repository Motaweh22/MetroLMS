# Generated manually for CourseDraft & PublishedCourseVersion cover_type / cover_color

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("courses", "0010_lessonitem_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="coursedraft",
            name="cover_color",
            field=models.CharField(blank=True, default=None, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name="coursedraft",
            name="cover_type",
            field=models.CharField(blank=True, default=None, max_length=16, null=True),
        ),
        migrations.AddField(
            model_name="publishedcourseversion",
            name="cover_color",
            field=models.CharField(blank=True, default=None, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name="publishedcourseversion",
            name="cover_type",
            field=models.CharField(blank=True, default=None, max_length=16, null=True),
        ),
    ]
