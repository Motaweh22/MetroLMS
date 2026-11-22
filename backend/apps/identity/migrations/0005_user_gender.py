"""Add gender field ('male' | 'female') to identity.User for Arabic marital/military personalization."""
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("identity", "0004_user_leadership_title"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="gender",
            field=models.CharField(
                choices=[("male", "ذكر"), ("female", "أنثى")],
                db_default="male",
                default="male",
                max_length=10,
            ),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=Q(gender__in=["male", "female"]),
                name="ck_identity_user_gender_valid",
            ),
        ),
    ]
