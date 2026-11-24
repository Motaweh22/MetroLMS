# Generated manually for User.employee_number (الرقم الوظيفي)

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0005_user_gender"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="employee_number",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                condition=Q(("employee_number__isnull", False)),
                fields=("employee_number",),
                name="uq_identity_user_employee_number_not_null",
            ),
        ),
    ]
