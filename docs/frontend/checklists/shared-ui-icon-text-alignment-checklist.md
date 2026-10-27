# Shared UI Icon–Text Alignment & Inline Typography System
## Implementation & Verification Checklist

**Target Milestone:** Milestone 3 (Dashboards, Authoring & Quality Assurance / Cross-Cutting Shared UI Primitives)  
**Modern Components Modified:**  
- `src/shared/ui/Button/Button.tsx` (Direct flex children, standardized sizing gaps, `whitespace-nowrap`)  
- `src/shared/ui/Icon/Icon.tsx` (`shrink-0 inline-block align-middle` constraints)  
- `src/shared/ui/Badge/Badge.tsx` (`inline-flex items-center gap-1`, `whitespace-nowrap`)  
**Affected Application Call Sites Standardized:**  
- `src/pages/LecturerCoursesPage.tsx`  
- `src/pages/CourseBuilderPage.tsx`  
- `src/features/course-builder/components/CurriculumTreeEditor.tsx`  
- `src/pages/NotificationsPage.tsx`  
- `src/pages/MyCoursesPage.tsx`  
- `src/pages/TraineeGroupsPage.tsx`  
- `src/features/learning-player/components/PlayerToolbar.tsx`  
- `src/shared/ui/QRCodeModal/QRCodeModal.tsx`  
- `src/features/course-builder/components/ExternalResourcesEditor.tsx`  
- `src/shared/ui/Sidebar/Sidebar.tsx`  
**Status:**  
- **Automated Verification:** **COMPLETED & VERIFIED (375 tests passing across 27 test files, 0 ESLint errors/warnings, clean production build)**  
- **Manual Visual Verification:** **PENDING MANUAL BROWSER VERIFICATION** (Preserved for manual user visual inspection; zero browser subagents or automated screenshots taken)  

---

## 1. Root Causes & Baseline Architectural Analysis

- [x] **Shared Component Root Causes:**
  - [x] **`Button.tsx` Wrapper Inconsistency:** An internal wrapping element around `{children}` disrupted the flexbox relationship between leading/trailing icons and the label text, leading to optical baseline misalignment and unwanted vertical shifting.
  - [x] **Uncontrolled Text Line Wrapping:** Lack of `whitespace-nowrap` on standard buttons allowed Arabic action text to wrap unexpectedly across multiple lines in responsive grid layouts, separating the icon from its associated label.
  - [x] **`Icon.tsx` Sizing & Expansion Constraints:** Lucide SVGs without explicit `shrink-0 inline-block align-middle` classes could collapse or expand inconsistently when nested inside flex containers with differing line-heights.
  - [x] **`Badge.tsx` Alignment & Whitespace:** Badges lacked consistent inline flex centering and `whitespace-nowrap`, causing status dots and icons to sit above or below the baseline of Arabic status text.
- [x] **Call Site Anti-Patterns:**
  - [x] **Redundant Literal Symbols:** Several button call sites prepended literal text characters (such as `+ ` or `←`) directly into the label string alongside or in place of formal semantic icon props (`leftIcon` / `rightIcon`). This produced unbalanced spacing and inconsistent visual weights.
  - [x] **Toolbar Horizontal Crowding:** The Course Builder top action toolbar lacked `flex-wrap`, causing buttons to collide with badges in intermediate desktop viewports.

---

## 2. Shared Primitive Enhancements

- [x] **`src/shared/ui/Button/Button.tsx`:**
  - [x] Removed arbitrary internal wrappers around `{children}` so `leftIcon`, `children`, and `rightIcon` are direct flex children of the button element.
  - [x] Maintained strict `inline-flex items-center justify-center` flexbox layout across all button variants (`primary`, `secondary`, `outline`, `ghost`, `danger`, `success`).
  - [x] Added `whitespace-nowrap` to base classes to prevent accidental multi-line text splitting in compact layouts.
  - [x] Enforced structured token spacing gaps between icons and text based on button size:
    - [x] Small (`sm`): `gap-1.5`
    - [x] Medium (`md`): `gap-2`
    - [x] Large (`lg`): `gap-2.5`
  - [x] Maintained full support for icon-only buttons (`isIconOnly`) and loading spinners (`isLoading`).
- [x] **`src/shared/ui/Icon/Icon.tsx`:**
  - [x] Added `shrink-0 inline-block align-middle` to the base SVG class definition.
  - [x] Ensures icons preserve exact pixel width/height without collapsing under flex pressure.
  - [x] Aligns SVG optical center with Cairo typography x-height in Arabic RTL contexts.
- [x] **`src/shared/ui/Badge/Badge.tsx`:**
  - [x] Added `whitespace-nowrap` to prevent status labels from wrapping.
  - [x] Wrapped badge children in `inline-flex items-center gap-1` while preserving `.parentElement` DOM structure for existing test assertions.
- [x] **Preserved Intentional Controls:**
  - [x] Intentionally vertical-stacked controls (e.g. `CurriculumSidebar.tsx` chapter accordion headers) remain vertical where required by design.
  - [x] Icon-only controls and drawer collapse toggles retain their dedicated circular/square hit areas.

---

## 3. Standardized Application Call Sites

- [x] **`src/pages/LecturerCoursesPage.tsx`:**
  - [x] Standardized "إنشاء مقرر جديد" button: removed literal `+ ` and wired semantic `leftIcon="plus"`.
  - [x] Standardized empty state action button: removed literal `+ ` and wired semantic `leftIcon="plus"`.
  - [x] Standardized course card "تعديل في المنشئ" button: wired semantic `leftIcon="edit"`.
- [x] **`src/pages/CourseBuilderPage.tsx`:**
  - [x] Added `flex-wrap` and `gap-2` to top action toolbar to prevent button overflow on smaller screens.
  - [x] Standardized "حفظ كمسودة" action button: wired semantic `leftIcon="save"`.
  - [x] Standardized "إعادة ضبط المعمل" action button: wired semantic `leftIcon="refresh"`.
  - [x] Standardized "رمز QR" action button: wired semantic `leftIcon="qrCode"`.
- [x] **`src/features/course-builder/components/CurriculumTreeEditor.tsx`:**
  - [x] Standardized "إضافة فصل جديد" header button: removed literal `+ ` and wired semantic `leftIcon="plus"`.
  - [x] Standardized "إضافة الفصل الأول الآن" empty state button: removed literal `+ ` and wired semantic `leftIcon="plus"`.
- [x] **`src/pages/NotificationsPage.tsx`:**
  - [x] Standardized "تحديد الكل كمقروء" header button: wired semantic `leftIcon="check"`.
- [x] **`src/pages/MyCoursesPage.tsx`:**
  - [x] Standardized return button: removed literal `←` and wired semantic `leftIcon="chevronRight"`.
- [x] **`src/pages/TraineeGroupsPage.tsx`:**
  - [x] Standardized return button: removed literal `←` and wired semantic `leftIcon="chevronRight"`.
- [x] **`src/features/learning-player/components/PlayerToolbar.tsx`:**
  - [x] Standardized navigation buttons: wired `leftIcon="chevronRight"` for "الدرس السابق" and `rightIcon="chevronLeft"` for "الدرس التالي".
- [x] **`src/shared/ui/QRCodeModal/QRCodeModal.tsx`:**
  - [x] Standardized "نسخ الرابط" button: wired semantic `leftIcon="copy"`.
  - [x] Standardized "تنزيل الصورة (PNG)" button: wired semantic `leftIcon="download"`.
- [x] **`src/features/course-builder/components/ExternalResourcesEditor.tsx`:**
  - [x] Standardized "إضافة المورد" action button: removed literal `+ ` and wired semantic `leftIcon="plus"`.
- [x] **`src/shared/ui/Sidebar/Sidebar.tsx`:**
  - [x] Standardized collapse toggle button with clean icon-only presentation.

---

## 4. Quality Gates & Verification Results

- [x] **Targeted Automated Test Verification:**
  - [x] `src/test/components.test.tsx`: **15/15 passed** (Button variants, disabled states, loading spinners, Badge statuses, Icon fallbacks).
  - [x] `src/test/lecturer-workspace.test.tsx`: **6/6 passed** (Lecturer courses listing, new course modal, filter tabs).
  - [x] `src/test/course-builder.test.tsx`: **14/14 passed** (Course builder toolbar, draft saving, test lab resets).
  - [x] `src/test/learning-player.test.tsx`: **28/28 passed** (Player toolbar previous/next buttons, navigation).
- [x] **Latest Checkpoint Full-Suite Results:**
  - [x] **Vitest Test Suite:** `npm run test` (`vitest run`): **375 passed across 27 test files** (100% pass rate).
  - [x] **Static Code Analysis:** `npm run lint` (`eslint .`): **0 errors, 0 warnings** (clean exit code 0).
  - [x] **Production Bundle Build:** `npm run build` (`tsc -b && vite build`): **Clean compilation in 8.00s**.
- [ ] **Manual Browser & Visual Verification:**
  - [ ] **Button Baseline Alignment:** Inspect optical vertical alignment between Lucide SVG icons and Arabic Cairo text across `sm`, `md`, and `lg` buttons in a real browser.
  - [ ] **Responsive Button Wrapping:** Verify that buttons wrap gracefully without awkward text fragmentation under narrow viewports (< 640px).
  - [ ] **Badge Alignment:** Verify badges with status icons across tables, cards, and metadata headers.
  - [ ] **RTL Directional Fidelity:** Verify that `leftIcon` renders leading (right side in RTL) and `rightIcon` renders trailing (left side in RTL).
