"""SQL Server non-empty CHECK and ISJSON constraints for courses."""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("courses", "0002_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE dbo.courses_course
            ADD CONSTRAINT ck_course_title_nonempty CHECK (LTRIM(RTRIM(title)) <> N'');

            ALTER TABLE dbo.courses_module
            ADD CONSTRAINT ck_module_title_nonempty CHECK (LTRIM(RTRIM(title)) <> N'');

            ALTER TABLE dbo.courses_lessonitem
            ADD CONSTRAINT ck_lesson_title_nonempty CHECK (LTRIM(RTRIM(title)) <> N'');

            ALTER TABLE dbo.courses_coursecommentreport
            ADD CONSTRAINT ck_commentreport_reason_nonempty CHECK (LTRIM(RTRIM(reason)) <> N'');

            ALTER TABLE dbo.courses_quizdefinition
            ADD CONSTRAINT ck_quiz_questions_isjson CHECK (ISJSON(questions_json) = 1 AND LEFT(LTRIM(questions_json), 1) = N'[');

            ALTER TABLE dbo.courses_stagedadminedit
            ADD CONSTRAINT ck_stagededit_payload_isjson CHECK (ISJSON(edit_payload_json) = 1 AND LEFT(LTRIM(edit_payload_json), 1) = N'{');
            """,
            reverse_sql="""
            ALTER TABLE dbo.courses_course DROP CONSTRAINT IF EXISTS ck_course_title_nonempty;
            ALTER TABLE dbo.courses_module DROP CONSTRAINT IF EXISTS ck_module_title_nonempty;
            ALTER TABLE dbo.courses_lessonitem DROP CONSTRAINT IF EXISTS ck_lesson_title_nonempty;
            ALTER TABLE dbo.courses_coursecommentreport DROP CONSTRAINT IF EXISTS ck_commentreport_reason_nonempty;
            ALTER TABLE dbo.courses_quizdefinition DROP CONSTRAINT IF EXISTS ck_quiz_questions_isjson;
            ALTER TABLE dbo.courses_stagedadminedit DROP CONSTRAINT IF EXISTS ck_stagededit_payload_isjson;
            """,
        ),
    ]

