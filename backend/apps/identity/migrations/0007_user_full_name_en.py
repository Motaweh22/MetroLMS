# Generated manually for User.full_name_en (الاسم بالإنجليزية)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0006_user_employee_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="full_name_en",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
