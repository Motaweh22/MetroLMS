"""SQL Server composite FKs, CHECK and ISJSON constraints for organization."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE dbo.organization_userjobtitle
            ADD CONSTRAINT fk_userjobtitle_user_dept
            FOREIGN KEY (user_id, department_id)
            REFERENCES dbo.organization_userorganizationaldepartment(user_id, department_id)
            ON DELETE NO ACTION;

            ALTER TABLE dbo.organization_userjobtitle
            ADD CONSTRAINT fk_userjobtitle_dept_job
            FOREIGN KEY (department_id, job_title_id)
            REFERENCES dbo.organization_departmentjobtitle(department_id, job_title_id)
            ON DELETE NO ACTION;

            ALTER TABLE dbo.organization_historicalservicetrainingrecord
            ADD CONSTRAINT ck_histtrain_course_name_nonempty CHECK (LTRIM(RTRIM(course_name)) <> N'');

            ALTER TABLE dbo.organization_historicalservicetrainingrecord
            ADD CONSTRAINT ck_histtrain_org_nonempty CHECK (LTRIM(RTRIM(providing_organization)) <> N'');

            ALTER TABLE dbo.organization_departmenttrack
            ADD CONSTRAINT ck_depttrack_allowed_isjson CHECK (ISJSON(allowed_tracks_json, ARRAY) = 1);
            """,
            reverse_sql="""
            ALTER TABLE dbo.organization_userjobtitle DROP CONSTRAINT IF EXISTS fk_userjobtitle_user_dept;
            ALTER TABLE dbo.organization_userjobtitle DROP CONSTRAINT IF EXISTS fk_userjobtitle_dept_job;
            ALTER TABLE dbo.organization_historicalservicetrainingrecord DROP CONSTRAINT IF EXISTS ck_histtrain_course_name_nonempty;
            ALTER TABLE dbo.organization_historicalservicetrainingrecord DROP CONSTRAINT IF EXISTS ck_histtrain_org_nonempty;
            ALTER TABLE dbo.organization_departmenttrack DROP CONSTRAINT IF EXISTS ck_depttrack_allowed_isjson;
            """,
        ),
    ]

