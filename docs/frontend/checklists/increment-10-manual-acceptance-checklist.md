# Increment 10: Training Groups Management & Follow-up
## Manual User Acceptance & Quality Verification Checklist

**Document Version:** 1.0.0  
**Target Milestone:** Milestone 4 (Enterprise Operations & Full Parity)  
**Verification Date:** 2026-10-21  
**Status:** **PENDING USER EXECUTION** (Automated gates 100% passed; reserved for manual browser audit)  
**Language Convention:** English specification with exact Arabic UI string matching.

---

## Instructions for Reviewer

> [!IMPORTANT]
> - All automated quality gates (717 unit/integration tests, ESLint, TypeScript compiler, and Vite production bundle) have passed with zero errors.
> - This checklist is designed for your manual browser review.
> - **Zero Browser Automation:** Antigravity has not executed any automated browser clicking or screenshot tools.
> - For each scenario, record the result as **Pass**, **Fail**, or **Blocked**, and document any remarks in the **Notes** column.
> - Default test credentials:
>   - **Administrator:** `admin@cairo-metro.com` (Full global administration)
>   - **Supervisor (Lecturer):** `lecturer@cairo-metro.com` (Assigned supervisor for `GRP-101`)
>   - **Trainee:** `trainee@cairo-metro.com` (Trainee account)
>   - Any password works in the offline mock session.

---

## Summary Matrix

| # | Workflow Domain | Total Scenarios | Pass | Fail | Blocked |
| :-: | :--- | :-: | :-: | :-: | :-: |
| 1 | Navigation & Canonical Route Aliases | 4 | | | |
| 2 | Group Creation, Editing & Safe Archival Lifecycle | 5 | | | |
| 3 | Course Assignments & Core/Reminder Roles | 4 | | | |
| 4 | Renewal Cycles & 3-Level Date Inheritance | 4 | | | |
| 5 | QR Code Generation, Rotation, Toggle & Scanning | 5 | | | |
| 6 | Trainee Self-Enrollment (Automatic vs Approval-Required) | 4 | | | |
| 7 | Join Request Review & Direct Trainee Assignment | 4 | | | |
| 8 | Group Materials Library (Folders, Uploads, Previews, Downloads) | 6 | | | |
| 9 | Scoped Supervisor Permissions vs Unauthorized Access | 4 | | | |
| 10 | Group Monitoring Dashboard & Historical Cycle Isolation | 5 | | | |
| 11 | Trainee Attempt History & Attention Badge Indicators | 4 | | | |
| 12 | Empty States, Validation Errors, Refresh & Responsive Layout | 4 | | | |
| 13 | Focused UI/UX Corrections After Increment 10 | 10 | | | |
| **Total** | **All Workflows** | **59** | | | |

---

## 1. Navigation & Canonical Route Aliases

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **NAV-01** | Logged in as Administrator | Open `/groups` in browser | Role-adaptive redirect fires automatically; URL changes to `/admin/groups` displaying the training groups management table. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **NAV-02** | Logged in as Trainee | Open `/groups` in browser | Role-adaptive redirect fires; URL changes to `/my-groups` displaying trainee's assigned groups without admin controls. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **NAV-03** | Logged in as Administrator | Open `/admin/create-group` in browser | Canonical redirect fires; URL changes to `/admin/groups/new` loading the group creation workspace. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **NAV-04** | Logged in as Administrator | Open `/admin/group-monitoring/GRP-101` | Canonical param redirect fires; URL changes to `/admin/groups/GRP-101/monitoring` displaying the monitoring dashboard. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 2. Group Creation, Editing & Safe Archival Lifecycle

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **GRP-01** | Logged in as Administrator | 1. Navigate to `/admin/groups/new`<br>2. Fill in group name, description, start date, and deadline date<br>3. Select policy `انضمام تلقائي` (open)<br>4. Click `حفظ ومتابعة التكوين` | Group is created successfully. Toast notification appears; user is redirected to `/admin/groups/:newGroupId/edit?tab=courses`. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **GRP-02** | On group creation form (`/admin/groups/new`) | 1. Set start date to `2026-06-01`<br>2. Set deadline date to `2026-05-01` (earlier than start)<br>3. Click submit | Form submission is blocked. Red validation alert displays: `الموعد النهائي يجب أن يكون لاحقاً لتاريخ البداية`. No API mutation is sent. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **GRP-03** | Logged in as Administrator | 1. Navigate to `/admin/groups/GRP-101/edit`<br>2. Edit description or max trainees<br>3. Attempt to click a breadcrumb or navigation link | Unsaved changes modal opens: `لديك تعديلات غير محفوظة...`. Clicking `البقاء والمتابعة` keeps user on page. Clicking `مغادرة وتجاهل التعديلات` discards changes and navigates. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **GRP-04** | Logged in as Administrator | 1. In `/admin/groups/GRP-101/edit`, update capacity to `45`<br>2. Click `حفظ التعديلات` | Changes are saved. Success toast confirms update. Reloading the page retains the updated capacity. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **GRP-05** | Group `GRP-101` has active members and cycles | 1. Navigate to `/admin/groups`<br>2. Click delete icon (`archive-group-btn-GRP-101`) | Confirmation dialog warns that the group has members/records and will be **archived** rather than permanently deleted. Confirming changes status to `مؤرشفة` (`archived`) without deleting historical records. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 3. Course Assignments & Core/Reminder Roles

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **CRS-01** | Logged in as Administrator | 1. Open `/admin/groups/GRP-101/edit?tab=courses`<br>2. Review current assigned courses list | Displays assigned courses table with course title, role chips (`دورة أساسية` vs `دورة تنشيطية`), start/deadline dates, and actions. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **CRS-02** | In Course Assignment tab | 1. Click `إضافة مقرر تدريبي`<br>2. Select an unassigned course from the dropdown<br>3. Choose role `دورة تنشيطية` (reminder)<br>4. Click `إضافة المقرر` | New course appears in the assigned courses list with purple `دورة تنشيطية` badge. Total courses count increments. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **CRS-03** | In Course Assignment tab | 1. Click `إضافة مقرر تدريبي`<br>2. Select a course already assigned to this cycle | Dropdown disables already assigned courses or form displays validation error preventing duplicate assignment of the same course in a single cycle. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **CRS-04** | In Course Assignment tab | 1. Click remove icon on an assigned course<br>2. Confirm removal | Course is unassigned from the active cycle. Existing trainee historical attempt records for that course remain preserved in the store ledger. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 4. Renewal Cycles & 3-Level Date Inheritance

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **CYC-01** | Logged in as Administrator | 1. Open `/admin/groups/GRP-101/edit?tab=courses`<br>2. Click `تعديل المواعيد` on an assigned course<br>3. Set a custom start date and custom deadline<br>4. Save override | Course card now shows the custom dates with `مخصص للمقرر` badge. Other courses continue inheriting the group/cycle dates (`وراثة من المجموعة`). | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **CYC-02** | Course has custom date override | 1. Click `تعديل المواعيد` on that course<br>2. Toggle off custom dates (or clear fields)<br>3. Save | Course immediately restores inheritance (`Course Override > Cycle Date > Group Default`), displaying the cycle/group dates. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **CYC-03** | Active Cycle 1 exists | 1. In Course Assignment tab, click `بدء دورة تجديد جديدة`<br>2. Enter cycle title (e.g. `دورة الربع الثاني 2026`)<br>3. Set start/deadline dates<br>4. Configure course roles for new cycle<br>5. Confirm renewal | Cycle 1 is sealed as `completed`. New cycle is marked `active`. Trainees repeating courses in the new cycle have fresh attempts created at 0% upon study start. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **CYC-04** | After renewal to Cycle 2 | 1. Navigate to `/admin/groups/GRP-101/monitoring`<br>2. Use cycle dropdown to view Cycle 1 | Cycle 1 displays with historical archived banner. Trainee completions from Cycle 1 remain 100% intact and are not overwritten by Cycle 2. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 5. QR Code Generation, Rotation, Toggle & Scanning

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **QR-01** | Logged in as Administrator | 1. Open `/admin/groups/GRP-101/edit?tab=members`<br>2. Click `رمز الاستجابة السريعة (QR)` | Modal opens displaying pure TypeScript SVG QR code, join URL, enrollment policy badge, and action buttons (`نسخ الرابط`, `تحميل رمز QR`). | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **QR-02** | QR Modal open | Click `نسخ الرابط` (Copy Link) | Join link (`/groups/join?code=...`) is copied to clipboard. Toast notification confirms `تم نسخ رابط الانضمام بنجاح`. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **QR-03** | QR Modal open | Click `تحميل رمز QR` | A PNG image file is generated client-side from the vector canvas and downloaded without network requests. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **QR-04** | QR Modal open | 1. Note the existing enrollment code<br>2. Click `إعادة توليد الرمز` (Rotate Token)<br>3. Confirm in the dialog | New QR code is generated with a fresh token. The old enrollment URL becomes immediately invalid (returns 404/410). | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **QR-05** | Real Mobile Device / QR Scanner App | 1. Keep QR Modal open on screen<br>2. Point a real smartphone camera or scanner app at the screen QR code | QR scanner successfully decodes the standard URL pointing to `/groups/join?code=...`. No corrupt characters or encoding errors occur. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 6. Trainee Self-Enrollment (Automatic vs Approval-Required)

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **ENR-01** | Group policy is `انضمام تلقائي` (`open`); Logged in as Trainee | 1. Open `/groups/join?code=GRP101-VALID-TOKEN`<br>2. Verify preview card details<br>3. Click `انضمام الآن للمجموعة` | Instant enrollment completes. Success card displays confirmation. Trainee is added to group members; assigned courses appear under `/my-courses`. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **ENR-02** | Group policy is `موافقة المشرف` (`approval_required`); Logged in as Trainee | 1. Open `/groups/join?code=GRP102-APPROVAL-TOKEN`<br>2. Enter optional motivation note<br>3. Click `إرسال طلب الانضمام` | Request is submitted. Status card changes to `تم إرسال طلب الانضمام بنجاح — بانتظار موافقة مشرف المجموعة`. Trainee is not yet enrolled. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **ENR-03** | Enrollment is toggled off (`isEnrollmentOpen = false`) | Open `/groups/join?code=CLOSED-GROUP-TOKEN` | Alert banner indicates enrollment is closed: `الانضمام إلى هذه المجموعة مغلق حالياً بقرار من إدارة التدريب`. Submit button is disabled. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **ENR-04** | Invalid or rotated token | Open `/groups/join?code=EXPIRED-OR-REVOKED-TOKEN` | Alert indicates: `رمز الانضمام غير صالح أو منتهي الصلاحية`. Allows manual code entry input field. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 7. Join Request Review & Direct Trainee Assignment

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **REQ-01** | Pending join request exists for Trainee B; Logged in as Administrator or Assigned Supervisor | 1. Open `/admin/groups/GRP-101/edit?tab=requests`<br>2. Locate pending request with applicant name and note<br>3. Click `قبول` (Approve) | Request status changes to approved. Trainee B is immediately added to group members and course enrollments are synthesized idempotently. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **REQ-02** | Pending join request exists; Logged in as Supervisor | 1. Open `/admin/groups/GRP-101/edit?tab=requests`<br>2. Locate request<br>3. Click `رفض` (Reject)<br>4. Enter rejection note (e.g. `المجموعة مكتملة`)<br>5. Confirm rejection | Request is marked rejected with the reason saved. Trainee is not enrolled. Badge updates to `مرفوض`. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **REQ-03** | Logged in as Administrator or Assigned Supervisor | 1. Open `/admin/groups/GRP-101/edit?tab=members`<br>2. Click `إضافة متدربين مباشرة`<br>3. Search for candidate by name/ID<br>4. Check trainee checkbox<br>5. Click `تأكيد إضافة المتدربين` | Selected trainee is added to group members list. Group member count increments; trainee gains access to group courses. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **REQ-04** | Member exists in group | 1. In Members tab, click remove button (`remove-member-btn-...`)<br>2. Confirm in modal | Trainee is removed from active group membership. Existing course progress and attempts remain intact in user's learning history. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 8. Group Materials Library (Folders, Uploads, Previews, Downloads)

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **MAT-01** | Logged in as Administrator or Assigned Supervisor | 1. Open `/admin/groups/GRP-101/edit?tab=materials`<br>2. Click `إنشاء مجلد جديد`<br>3. Enter Arabic name (e.g. `تعليمات التشغيل والسلامة`)<br>4. Click `إنشاء المجلد` | Folder appears in folder grid with folder icon, 0 files count, and visibility badge. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MAT-02** | Inside a material folder | 1. Click `رفع ملفات`<br>2. Drag-and-drop or select a sample PDF and PNG image<br>3. Click `بدء الرفع` | Progress indicator completes. Files appear in folder list with correct file type badges (`PDF`, `صورة`) and size in KB/MB. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MAT-03** | Uploading unsupported file | In upload modal, select an executable file (`.exe` or `.bat`) | Client-side validation rejects file with Arabic warning: `نوع الملف غير مدعوم`. File is not added to upload queue. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MAT-04** | PDF file listed in materials | Click `معاينة` (Preview) on the PDF file | Embedded modal opens rendering the PDF document in an accessible viewer without leaving the page. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MAT-05** | Image file listed in materials | Click `معاينة` on the image | Lightbox preview opens displaying the image clearly with zoom/close controls. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MAT-06** | File in materials | Click `تحميل` (Download) on any file | Browser downloads the genuine file bytes via Object URL with correct file name and extension. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 9. Scoped Supervisor Permissions vs Unauthorized Access

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | Logged in as Lecturer (`lecturer@cairo-metro.com`) assigned as supervisor for `GRP-101` | Navigate to `/admin/groups/GRP-101/monitoring` | Access granted. Supervisor views metrics, countdown strip, and trainee progress for their assigned group. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **SEC-02** | Logged in as Lecturer (`lecturer@cairo-metro.com`) NOT assigned to `GRP-102` | Open `/admin/groups/GRP-102/monitoring` | Access blocked. Arabized 403 Forbidden alert displays: `غير مصرح لك بمتابعة هذه المجموعة التدريبية`. No metrics are leaked. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **SEC-03** | Logged in as Trainee (`trainee@cairo-metro.com`) | Open `/admin/groups` in browser | Redirected or blocked with 403 alert: `غير مصرح لك باستعراض لوحة المجموعات التدريبية`. Admin management controls are hidden. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **SEC-04** | Logged in as Lecturer | Navigate to `/admin/groups/new` | Blocked with warning: `صلاحية إنشاء المجموعات التدريبية تقتصر على مدراء النظام فقط`. Create form does not mount. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 10. Group Monitoring Dashboard & Historical Cycle Isolation

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **MON-01** | Logged in as Administrator | Navigate to `/admin/groups/GRP-101/monitoring` | Dashboard loads with header breadcrumb, countdown strip, cohort metric cards (enrolled, started, completed core, attempts, average progress %, attention alerts). | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MON-02** | On monitoring dashboard | Click `المقررات التدريبية` (Courses view) tab | Renders course progress cards showing effective start/deadline dates (respecting 3-level precedence), enrolled, started, completed, and overdue counts with progress bars. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MON-03** | On monitoring dashboard | 1. Use cycle selector dropdown (`data-testid="cycle-selector"`)<br>2. Select a prior cycle (e.g. Cycle 1) | Historical cycle banner displays: `أرشيف دورة سابقة — العرض للقراءة فقط`. Trainee progress matrix displays historical scores for that specific cycle. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MON-04** | In Trainees view | Type a trainee name in the search box | Trainee list filters instantly to matching names. Clear button resets list. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **MON-05** | In Trainees view | Select status filter (e.g. `يحتاج متابعة` - Attention Required) | Table updates to display only trainees with `danger` or `warning` attention badges. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 11. Trainee Attempt History & Attention Badge Indicators

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **ATT-01** | In `/admin/groups/GRP-101/monitoring` trainees table | Click `عرض التفاصيل` on any trainee row | `TraineeProgressModal` opens displaying trainee profile, core course completion badge, overall progress %, and course-by-course breakdown. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **ATT-02** | Trainee repeating a course in Cycle 2 | In `TraineeProgressModal`, inspect the course attempt widget | Displays badge: `محاولتك رقم 2 لهذا المقرر — إكمالات سابقة ناجحة: 1`. Expandable timeline shows prior attempts with cycle title, dates, and completion status. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **ATT-03** | Course assigned to trainee but not yet opened (`startedAt === null`) | In `TraineeProgressModal`, inspect unstarted course | Attempt status indicates `لم تبدأ بعد` (0%). Unstarted assignment does not increment the count of started attempts. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **ATT-04** | Trainee with elapsed time >= 20% and 0% progress | In monitoring trainees table, observe trainee's badge | Displays amber warning badge: `لم يبدأ بعد` with tooltip explaining the criteria. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 12. Empty States, Validation Errors, Refresh & Responsive Layout

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **SYS-01** | Empty draft group with 0 members and 0 courses | Navigate to monitoring dashboard for empty group | Renders clean empty state with 0% metrics without division by zero (`NaN`), crashes, or broken layout. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **SYS-02** | Active monitoring dashboard with filters applied | Refresh browser page (F5) | Page reloads gracefully, recovers authenticated state, and re-renders monitoring dashboard cleanly. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **SYS-03** | Responsive testing (Mobile viewport 375px & Tablet 768px) | Open `/admin/groups` and `/admin/groups/GRP-101/monitoring` in mobile view | Navigation collapses to mobile drawer, tables scroll horizontally or adapt to card stacks, buttons and QR codes remain fully touch-accessible. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **SYS-04** | RTL layout and Arabic typography inspection | Inspect text alignment and fonts across all Increment 10 pages | 100% Arabic-first RTL layout (`dir="rtl"`). Cairo font renders cleanly. Zero English text leaks in user-facing UI. Zero emojis. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## 13. Focused UI/UX Corrections After Increment 10

| ID | Preconditions | Navigation Steps | Expected Result | Status | Notes |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **UX-01** | Logged in as Administrator | 1. Navigate to `/admin/groups/GRP-101/edit?tab=materials`<br>2. Observe default sorting at root level<br>3. Click column headers: `الاسم`, `تاريخ التعديل / الرفع`, `النوع`, `الحجم` | Folders appear before files by default. Clickable sorting headers toggle direction (asc `▲` / desc `▼`) and apply sorting rules to displayed items without page reload or loss of group context. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-02** | In Group Materials library at root | 1. Click on folder `دليل التدريب واللوائح المعتمدة`<br>2. Observe contents inside the folder<br>3. Click column headers to sort inside the folder | Folder contents open smoothly in the same browser window. Immediate subfolders and files are shown together (folders first). Clickable sorting works consistently inside the folder. Breadcrumb shows `حقيبة المواد / دليل التدريب واللوائح المعتمدة`. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-03** | Inside a folder in Group Materials | 1. Click `إنشاء مجلد جديد`<br>2. Enter subfolder name (e.g. `تعليمات السلامة الكهربائية`) and save<br>3. Click `رفع ملفات` and upload a file into the active folder | Creating a folder or uploading files inside a nested folder automatically assigns the current active folder as the destination. Breadcrumb and back button (`← العودة للمجلد السابق`) allow direct navigation back to parent/root. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-04** | In Group Materials library | 1. Click `فتح المستكشف الموسع` (`toggle-focused-explorer-btn`)<br>2. Test navigation and search in focused view<br>3. Close focused window | Browser expands to a spacious, focused explorer window (Google Drive / Windows Explorer inspired) with dedicated header, breadcrumb path, search, sorting, and close button. Responsive on small screens. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-05** | Logged in as Trainee or Supervisor | 1. Navigate to `/my-groups/GRP-101`<br>2. Scroll to the group resources section | Section `المواد المرفقة` (`group-attachments-section`) is visibly rendered alongside other group sections. Displays attached documents (PDF/files), titles, descriptions, and download buttons. Shows distinct Arabic empty state if empty. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-06** | Logged in as Trainee or Supervisor | 1. Navigate to `/my-groups/GRP-101`<br>2. Inspect `اللقاءات التفاعلية` section<br>3. Click `الانضمام للقاء التجريبي` | Section `اللقاءات التفاعلية` (`group-meetings-section`) is visibly rendered with purple video icon, Microsoft Teams badges, and schedule details. Clicking join triggers established informative Teams session info toast. Shows distinct Arabic empty state if empty. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-07** | Logged in as Administrator | 1. Navigate to `/admin/groups/new`<br>2. Inspect the top tab navigation bar | All 6 tabs (`البيانات الأساسية`, `المقررات التدريبية`, `المتدربون ورمز QR`, `حقيبة المواد`, `المواد المرفقة`, `اللقاءات التفاعلية`) are visible from the start. Navigation strip supports horizontal scrolling on small screens without hiding tabs. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-08** | On `/admin/groups/new` | 1. Enter group name and description in basic tab<br>2. Click on tab `المقررات التدريبية` or `حقيبة المواد`<br>3. Return to `البيانات الأساسية` | Switching tabs does NOT discard entered form data. Non-general tabs display an inline explanation card (`تتطلب هذه الخاصية حفظ المجموعة أولاً`) with a return button. Saving basic info creates the group and remains in the same workspace without full reload. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-09** | Logged in as Administrator | 1. Open an existing group: `/admin/groups/GRP-101/edit`<br>2. Navigate between all 6 tabs<br>3. Test editing attachments and interactive meetings | Uses the exact same unified tab layout and ordering as group creation. Corresponding data loads seamlessly in each tab without page reloads. Direct link via query param (`?tab=...`) works as expected. Unsaved-changes guard remains functional. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |
| **UX-10** | Logged in as Administrator / Supervisor | 1. Check sidebar / navigation drawer on `/dashboard`<br>2. Observe `المجموعات التدريبية` item<br>3. Click the navigation item | Navigation item is fully enabled, active, and clickable (not greyed out or marked planned). Clicking navigates directly to `/admin/groups`. Active visual state highlights correctly when on training group pages. Route guard blocks unauthorized trainees. | [ ] Pass<br>[ ] Fail<br>[ ] Blocked | |

---

## Final Review Sign-Off (To be filled by User)

- [ ] All 59 verification scenarios executed manually in browser (49 baseline + 10 focused UX corrections).
- **Final Manual Acceptance Decision:**  
  - [ ] **ACCEPTED** (Ready for production merge)  
  - [ ] **REVISE** (Defects noted above must be addressed)  
- **Reviewer Name / Signature:** ___________________________  
- **Date:** ___________________________  
