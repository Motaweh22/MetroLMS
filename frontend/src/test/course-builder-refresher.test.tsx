import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CourseBuilderPage } from '@/pages/CourseBuilderPage';
import { CurriculumTreeEditor } from '@/features/course-builder/components/CurriculumTreeEditor';
import {
  isItemVisibleInRefresher,
  getRefresherItemTitle,
  hasRefresherTitleOverride,
  getRefresherChapterTitle,
  hasRefresherChapterTitleOverride,
  getEffectiveRefresherChapters,
  calculateRefresherStats,
  assessRefresherImpact,
} from '@/core/courses/refresher';
import type { Course, CourseChapter, ChapterItem, RefresherCourseConfig } from '@/core/courses/types';

// Mock Auth
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'USR002', name: 'م. خالد إبراهيم', role: 'lecturer' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

const mockChapters: CourseChapter[] = [
  {
    id: 'CH01',
    title: 'الفصل الأول: أساسيات السلامة المهنية',
    order: 1,
    items: [
      {
        id: 'ITEM01',
        type: 'video',
        title: 'قواعد السلامة في ورش الصيانة',
        duration: '12:40',
        url: 'https://example.com/video1.mp4',
        videoSourceType: 'upload',
      },
      {
        id: 'ITEM02',
        type: 'pdf',
        title: 'دليل الإخلاء والطوارئ',
        url: 'https://example.com/guide.pdf',
      },
    ],
  },
  {
    id: 'CH02',
    title: 'الفصل الثاني: إجراءات الطوارئ والحوادث',
    order: 2,
    items: [
      {
        id: 'ITEM03',
        type: 'video',
        title: 'التعامل مع انقطاع التيار الكهربائي',
        duration: '08:15',
        url: 'https://example.com/video2.mp4',
        videoSourceType: 'upload',
      },
    ],
  },
];

const mockCourse: Course = {
  id: 'CRS_TEST_REFRESHER',
  title: 'سلامة العمل والسلوك المهني',
  description: 'كورس شامل لقواعد السلامة المهنية في بيئة عمل مترو الأنفاق',
  lecturerId: 'USR002',
  lecturerName: 'م. خالد إبراهيم',
  level: 'مبتدئ',
  estimatedHours: 4,
  rating: 4.8,
  ratingCount: 15,
  enrollmentCount: 50,
  status: 'draft',
  chapters: mockChapters,
};

// Mock builderApi
vi.mock('@/features/course-builder/services/builderApi', () => ({
  builderApi: {
    getCourseForEditing: vi.fn(async () => mockCourse),
    saveCourseDraft: vi.fn(async (_id, draft) => ({ course: draft, isPublishedPreserved: false })),
  },
}));

describe('Refresher Course Version Feature & Course Builder Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // =========================================================================
  // Part 1: Domain Helpers & Refresher Invariants
  // =========================================================================
  describe('Domain Logic & Refresher Helpers', () => {
    it('defaults unconfigured items to visible (true) in the refresher version', () => {
      const config: RefresherCourseConfig = { enabled: true };
      expect(isItemVisibleInRefresher('ITEM01', config)).toBe(true);
      expect(isItemVisibleInRefresher('NON_EXISTENT', config)).toBe(true);
    });

    it('respects explicit item visibility settings in refresher version', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: false },
          ITEM02: { itemId: 'ITEM02', isVisible: true },
        },
      };

      expect(isItemVisibleInRefresher('ITEM01', config)).toBe(false);
      expect(isItemVisibleInRefresher('ITEM02', config)).toBe(true);
    });

    it('uses refresher-specific display name override if set, otherwise original title', () => {
      const item: ChapterItem = {
        id: 'ITEM01',
        type: 'video',
        title: 'قواعد السلامة في ورش الصيانة',
      };

      const configWithOverride: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true, customTitle: 'مراجعة سريعة لقواعد السلامة' },
        },
      };

      expect(getRefresherItemTitle(item, configWithOverride)).toBe('مراجعة سريعة لقواعد السلامة');
      expect(hasRefresherTitleOverride('ITEM01', configWithOverride)).toBe(true);

      const configWithoutOverride: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true },
        },
      };

      expect(getRefresherItemTitle(item, configWithoutOverride)).toBe('قواعد السلامة في ورش الصيانة');
      expect(hasRefresherTitleOverride('ITEM01', configWithoutOverride)).toBe(false);
    });

    it('generates effective refresher chapters excluding hidden items and empty sections', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true, customTitle: 'عنوان تذكيري مخصص' },
          ITEM02: { itemId: 'ITEM02', isVisible: false }, // Hidden
          ITEM03: { itemId: 'ITEM03', isVisible: false }, // All items in CH02 are hidden!
        },
      };

      const effective = getEffectiveRefresherChapters(mockChapters, config);

      // CH01 should have 1 item with the custom title
      expect(effective).toHaveLength(1);
      expect(effective[0].id).toBe('CH01');
      expect(effective[0].items).toHaveLength(1);
      expect(effective[0].items[0].id).toBe('ITEM01');
      expect(effective[0].items[0].title).toBe('عنوان تذكيري مخصص');
      expect(effective[0].items[0].duration).toBe('12:40'); // Preserves media data

      // CH02 had all items hidden, so it MUST NOT appear as an empty chapter
      const ch02 = effective.find((c) => c.id === 'CH02');
      expect(ch02).toBeUndefined();
    });

    it('calculates accurate refresher statistics', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true, customTitle: 'عنوان مخصص' },
          ITEM02: { itemId: 'ITEM02', isVisible: false },
          ITEM03: { itemId: 'ITEM03', isVisible: true },
        },
      };

      const stats = calculateRefresherStats(mockChapters, config);
      expect(stats.totalChapters).toBe(2);
      expect(stats.activeChaptersCount).toBe(2);
      expect(stats.totalOriginalItems).toBe(3);
      expect(stats.visibleRefresherItems).toBe(2);
      expect(stats.hiddenItemsCount).toBe(1);
      expect(stats.customTitlesCount).toBe(1);
    });

    it('defaults chapter title to original chapter title when no override exists', () => {
      const chapter = mockChapters[0];
      const config: RefresherCourseConfig = { enabled: true };

      expect(getRefresherChapterTitle(chapter, config)).toBe('الفصل الأول: أساسيات السلامة المهنية');
      expect(hasRefresherChapterTitleOverride('CH01', config)).toBe(false);
    });

    it('uses refresher-specific chapter title override if set, and preserves custom title when original chapter title changes', () => {
      const chapter = mockChapters[0];
      const configWithOverride: RefresherCourseConfig = {
        enabled: true,
        chapters: {
          CH01: { chapterId: 'CH01', customTitle: 'مراجعة مكثفة: قواعد السلامة الميدانية' },
        },
      };

      // Custom title is returned
      expect(getRefresherChapterTitle(chapter, configWithOverride)).toBe('مراجعة مكثفة: قواعد السلامة الميدانية');
      expect(hasRefresherChapterTitleOverride('CH01', configWithOverride)).toBe(true);

      // Renaming original chapter title leaves the refresher-specific title intact
      const renamedOriginalChapter: CourseChapter = {
        ...chapter,
        title: 'عنوان أصلي معدل للفصل الأول',
      };
      expect(getRefresherChapterTitle(renamedOriginalChapter, configWithOverride)).toBe('مراجعة مكثفة: قواعد السلامة الميدانية');
    });

    it('resets chapter title override back to original chapter title when cleared', () => {
      const chapter = mockChapters[0];
      const configCleared: RefresherCourseConfig = {
        enabled: true,
        chapters: {
          CH01: { chapterId: 'CH01', customTitle: undefined },
        },
      };

      expect(getRefresherChapterTitle(chapter, configCleared)).toBe(chapter.title);
      expect(hasRefresherChapterTitleOverride('CH01', configCleared)).toBe(false);
    });

    it('applies chapter title overrides in getEffectiveRefresherChapters alongside item title overrides', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        chapters: {
          CH01: { chapterId: 'CH01', customTitle: 'الفصل الأول: ملخص السلامة' },
        },
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true, customTitle: 'درس السلامة التذكيري' },
          ITEM02: { itemId: 'ITEM02', isVisible: false },
          ITEM03: { itemId: 'ITEM03', isVisible: false },
        },
      };

      const effective = getEffectiveRefresherChapters(mockChapters, config);
      expect(effective).toHaveLength(1);
      expect(effective[0].id).toBe('CH01');
      expect(effective[0].title).toBe('الفصل الأول: ملخص السلامة');
      expect(effective[0].items[0].title).toBe('درس السلامة التذكيري');
    });

    it('preserves existing item-level settings and includes chapter overrides in calculateRefresherStats', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        chapters: {
          CH01: { chapterId: 'CH01', customTitle: 'فصل مخصص' },
        },
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true, customTitle: 'درس مخصص' },
          ITEM02: { itemId: 'ITEM02', isVisible: false },
        },
      };

      const stats = calculateRefresherStats(mockChapters, config);
      expect(stats.customTitlesCount).toBe(2); // 1 chapter override + 1 item override
      expect(stats.visibleRefresherItems).toBe(2); // ITEM01 (true) + ITEM03 (default true)
      expect(stats.hiddenItemsCount).toBe(1); // ITEM02 (false)
    });
  });

  // =========================================================================
  // Part 2: Impact Assessment & Warning Logic
  // =========================================================================
  describe('assessRefresherImpact Warnings', () => {
    it('returns hasImpact: false when refresher version is disabled', () => {
      const config: RefresherCourseConfig = { enabled: false };
      const impact = assessRefresherImpact('delete_item', {
        refresherConfig: config,
        originalItem: mockChapters[0].items[0],
      });
      expect(impact.hasImpact).toBe(false);
    });

    it('warns when deleting an item that is visible in an enabled refresher version', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM01: { itemId: 'ITEM01', isVisible: true } },
      };

      const impact = assessRefresherImpact('delete_item', {
        refresherConfig: config,
        originalItem: mockChapters[0].items[0],
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('النسخة التذكيرية');
    });

    it('does not warn when deleting an item that is already hidden in the refresher version', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM01: { itemId: 'ITEM01', isVisible: false } },
      };

      const impact = assessRefresherImpact('delete_item', {
        refresherConfig: config,
        originalItem: mockChapters[0].items[0],
      });

      expect(impact.hasImpact).toBe(false);
    });

    it('warns when renaming an original item without a refresher title override', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM01: { itemId: 'ITEM01', isVisible: true } }, // No custom title
      };

      const originalItem = mockChapters[0].items[0];
      const updatedItem = { ...originalItem, title: 'عنوان أصلي جديد تماماً' };

      const impact = assessRefresherImpact('edit_item', {
        refresherConfig: config,
        originalItem,
        updatedItem,
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('النسخة التذكيرية');
    });

    it('does NOT warn when renaming an original item that already has an explicit custom title override', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true, customTitle: 'عنوان تذكيري محدد ومستقل' },
        },
      };

      const originalItem = mockChapters[0].items[0];
      const updatedItem = { ...originalItem, title: 'عنوان أصلي جديد' };

      const impact = assessRefresherImpact('edit_item', {
        refresherConfig: config,
        originalItem,
        updatedItem,
      });

      // Refresher display title is overridden, so renaming original has zero impact on refresher name!
      expect(impact.hasImpact).toBe(false);
    });

    it('warns when changing video URL or replacing uploaded video', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM01: { itemId: 'ITEM01', isVisible: true } },
      };

      const originalItem = mockChapters[0].items[0];
      const updatedItem = {
        ...originalItem,
        url: 'https://example.com/new_video_file.mp4',
        mediaId: 'MEDIA_NEW_123',
      };

      const impact = assessRefresherImpact('edit_item', {
        refresherConfig: config,
        originalItem,
        updatedItem,
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('الفيديو');
    });

    it('warns when replacing document/PDF/image or modifying referenced file metadata', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM02: { itemId: 'ITEM02', isVisible: true } },
      };

      const originalItem = mockChapters[0].items[1]; // PDF
      const updatedItem = {
        ...originalItem,
        originalFileName: 'new_safety_manual.pdf',
        fileSizeBytes: 8500000,
      };

      const impact = assessRefresherImpact('edit_item', {
        refresherConfig: config,
        originalItem,
        updatedItem,
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('الملف المرفق');
    });

    it('warns when changing duration or completion policy', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM01: { itemId: 'ITEM01', isVisible: true } },
      };

      const originalItem = mockChapters[0].items[0];
      const updatedItemDuration = {
        ...originalItem,
        duration: '18:50',
      };

      const impactDuration = assessRefresherImpact('edit_item', {
        refresherConfig: config,
        originalItem,
        updatedItem: updatedItemDuration,
      });
      expect(impactDuration.hasImpact).toBe(true);
      expect(impactDuration.impactMessage).toContain('مدة أو سياسة إتمام الدرس');

      const updatedItemPolicy = {
        ...originalItem,
        completionPolicy: { requireMinimumViewingTime: true },
      };

      const impactPolicy = assessRefresherImpact('edit_item', {
        refresherConfig: config,
        originalItem,
        updatedItem: updatedItemPolicy,
      });
      expect(impactPolicy.hasImpact).toBe(true);
    });

    it('warns when adding a new item to a chapter when refresher is enabled', () => {
      const config: RefresherCourseConfig = { enabled: true };
      const newItem: ChapterItem = {
        id: 'ITEM_NEW',
        title: 'درس تدريبي جديد مضاف',
        type: 'video',
      };

      const impact = assessRefresherImpact('add_item', {
        refresherConfig: config,
        newItem,
        chapter: mockChapters[0],
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('إضافة الدرس');
    });

    it('warns when moving an item within a chapter when refresher content is affected', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true },
          ITEM02: { itemId: 'ITEM02', isVisible: true },
        },
      };

      const impact = assessRefresherImpact('move_item', {
        refresherConfig: config,
        originalItem: mockChapters[0].items[0],
        chapter: mockChapters[0],
        direction: 'down',
        itemIndex: 0,
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('تغيير ترتيب الدرس');
    });

    it('does not warn when moving an item when neither swapped item is visible in refresher', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: false },
          ITEM02: { itemId: 'ITEM02', isVisible: false },
        },
      };

      const impact = assessRefresherImpact('move_item', {
        refresherConfig: config,
        originalItem: mockChapters[0].items[0],
        chapter: mockChapters[0],
        direction: 'down',
        itemIndex: 0,
      });

      expect(impact.hasImpact).toBe(false);
    });

    it('warns when moving a chapter when refresher content is affected', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: {
          ITEM01: { itemId: 'ITEM01', isVisible: true },
          ITEM03: { itemId: 'ITEM03', isVisible: true },
        },
      };

      const impact = assessRefresherImpact('move_chapter', {
        refresherConfig: config,
        chapters: mockChapters,
        index: 0,
        direction: 'down',
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('تغيير ترتيب الفصول');
    });

    it('warns when editing a chapter title when chapter contains visible refresher content', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM01: { itemId: 'ITEM01', isVisible: true } },
      };

      const impact = assessRefresherImpact('edit_chapter', {
        refresherConfig: config,
        chapter: mockChapters[0],
        newTitle: 'عنوان فصل معدل وجديد',
      });

      expect(impact.hasImpact).toBe(true);
      expect(impact.impactMessage).toContain('تعديل عنوان الفصل');
    });

    it('does not warn when editing chapter title if title did not change', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        items: { ITEM01: { itemId: 'ITEM01', isVisible: true } },
      };

      const impact = assessRefresherImpact('edit_chapter', {
        refresherConfig: config,
        chapter: mockChapters[0],
        newTitle: mockChapters[0].title, // Unchanged
      });

      expect(impact.hasImpact).toBe(false);
    });

    it('does NOT warn when editing original chapter title if a refresher chapter title override already exists', () => {
      const config: RefresherCourseConfig = {
        enabled: true,
        chapters: {
          CH01: { chapterId: 'CH01', customTitle: 'عنوان تذكيري مخصص ومستقل للفصل' },
        },
        items: { ITEM01: { itemId: 'ITEM01', isVisible: true } },
      };

      const impact = assessRefresherImpact('edit_chapter', {
        refresherConfig: config,
        chapter: mockChapters[0],
        newTitle: 'عنوان فصل أصلي جديد',
      });

      // Chapter has an explicit custom title override, so renaming original has zero impact on refresher name!
      expect(impact.hasImpact).toBe(false);
    });
  });

  // =========================================================================
  // Part 3: UI Integration into CourseBuilderPage & CurriculumTreeEditor
  // =========================================================================
  describe('CourseBuilderPage Tab Navigation & Refresher Tab Integration', () => {
    it('renders the new Refresher Tab at the end of the Course Builder tabs', async () => {
      render(
        <MemoryRouter initialEntries={['/lecturer/builder/CRS_TEST_REFRESHER']}>
          <Routes>
            <Route path="/lecturer/builder/:courseId" element={<CourseBuilderPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('builder-tab-refresher')).toBeInTheDocument();
      });

      const refresherTab = screen.getByTestId('builder-tab-refresher');
      expect(refresherTab).toHaveTextContent('النسخة التذكيرية');

      // Click to switch tab
      fireEvent.click(refresherTab);

      // Refresher tab container is active
      expect(screen.getByTestId('refresher-tab-container')).toBeInTheDocument();
      expect(screen.getByTestId('refresher-enable-checkbox')).toBeInTheDocument();
    });

    it('shows read-only preview and disabled notice when refresher version is not enabled', () => {
      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="refresher"
          refresherConfig={{ enabled: false }}
        />
      );

      // Enable checkbox should be unchecked
      const enableCheckbox = screen.getByTestId('refresher-enable-checkbox') as HTMLInputElement;
      expect(enableCheckbox.checked).toBe(false);

      // Status badge shows disabled
      expect(screen.getByTestId('refresher-status-badge')).toHaveTextContent('معطلة');

      // Notice explaining read-only preview is shown
      expect(screen.getByTestId('refresher-disabled-notice')).toHaveTextContent(
        /النسخة التذكيرية غير مفعلة لهذا المقرر حالياً/
      );

      // Individual item checkboxes must be disabled
      const itemCheckbox = screen.getByTestId('refresher-item-visibility-ITEM01') as HTMLInputElement;
      expect(itemCheckbox).toBeDisabled();

      // Original editing controls (move up/down, add chapter, delete) must not be rendered
      expect(screen.queryByTestId('add-chapter-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('item-delete-ITEM01')).not.toBeInTheDocument();
    });

    it('enables interactive configuration and summary metrics when enable checkbox is checked', () => {
      const handleRefresherChange = vi.fn();

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="refresher"
          refresherConfig={{ enabled: false }}
          onRefresherConfigChange={handleRefresherChange}
        />
      );

      const enableCheckbox = screen.getByTestId('refresher-enable-checkbox');
      fireEvent.click(enableCheckbox);

      expect(handleRefresherChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    });

    it('allows toggling item visibility in refresher mode and displays empty section notice', () => {
      const handleRefresherChange = vi.fn();

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="refresher"
          refresherConfig={{
            enabled: true,
            items: {
              ITEM01: { itemId: 'ITEM01', isVisible: true },
              ITEM02: { itemId: 'ITEM02', isVisible: false },
              ITEM03: { itemId: 'ITEM03', isVisible: false }, // CH02 all items hidden
            },
          }}
          onRefresherConfigChange={handleRefresherChange}
        />
      );

      // ITEM02 is unchecked and shows badge
      const item02Checkbox = screen.getByTestId('refresher-item-visibility-ITEM02') as HTMLInputElement;
      expect(item02Checkbox.checked).toBe(false);
      expect(screen.getAllByText('مخفي بالتذكيري').length).toBeGreaterThan(0);

      // CH02 has all items hidden: shows section notice that it will not appear as an empty section
      expect(screen.getByTestId('refresher-empty-section-notice-CH02')).toHaveTextContent(
        /لن يظهر هذا الفصل كقسم فارغ للمتدرب في النسخة التذكيرية/
      );

      // Toggle ITEM01 to hidden
      const item01Checkbox = screen.getByTestId('refresher-item-visibility-ITEM01');
      fireEvent.click(item01Checkbox);

      expect(handleRefresherChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          items: expect.objectContaining({
            ITEM01: expect.objectContaining({ isVisible: false }),
          }),
        })
      );
    });

    it('allows customizing refresher title override and resetting to original title', () => {
      const handleRefresherChange = vi.fn();

      const { rerender } = render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="refresher"
          refresherConfig={{ enabled: true }}
          onRefresherConfigChange={handleRefresherChange}
        />
      );

      // Initially shows: "الاسم بالتذكيري: مطابق للأصل"
      expect(screen.getAllByText('الاسم بالتذكيري: مطابق للأصل')[0]).toBeInTheDocument();

      // Click "تخصيص الاسم"
      const customizeBtn = screen.getByTestId('refresher-custom-title-btn-ITEM01');
      fireEvent.click(customizeBtn);

      // Inline input should be visible
      const titleInput = screen.getByTestId('refresher-title-input-ITEM01') as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'مفاهيم السلامة السريعة' } });

      // Click Save
      const saveBtn = screen.getByTestId('refresher-title-save-ITEM01');
      fireEvent.click(saveBtn);

      expect(handleRefresherChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          items: expect.objectContaining({
            ITEM01: expect.objectContaining({
              customTitle: 'مفاهيم السلامة السريعة',
            }),
          }),
        })
      );

      // Re-render with the saved custom title
      rerender(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="refresher"
          refresherConfig={{
            enabled: true,
            items: {
              ITEM01: { itemId: 'ITEM01', isVisible: true, customTitle: 'مفاهيم السلامة السريعة' },
            },
          }}
          onRefresherConfigChange={handleRefresherChange}
        />
      );

      expect(screen.getByTestId('refresher-custom-title-badge-ITEM01')).toHaveTextContent(
        'اسم مخصص بالتذكيري: "مفاهيم السلامة السريعة"'
      );

      // Reset to original title
      const resetBtn = screen.getByTestId('refresher-title-reset-ITEM01');
      fireEvent.click(resetBtn);

      expect(handleRefresherChange).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.objectContaining({
            ITEM01: expect.objectContaining({
              customTitle: undefined,
            }),
          }),
        })
      );
    });

    it('allows customizing refresher chapter title override, preserves original chapter, and resets override', () => {
      const handleRefresherChange = vi.fn();
      const handleChaptersChange = vi.fn();

      const { rerender } = render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="refresher"
          refresherConfig={{ enabled: true }}
          onChange={handleChaptersChange}
          onRefresherConfigChange={handleRefresherChange}
        />
      );

      // Initially shows: "اسم الفصل بالتذكيري: مطابق للأصل"
      expect(screen.getAllByText('اسم الفصل بالتذكيري: مطابق للأصل')[0]).toBeInTheDocument();

      // Click "تخصيص الاسم" for CH01
      const customizeChapterBtn = screen.getByTestId('refresher-custom-chapter-title-btn-CH01');
      expect(customizeChapterBtn).toHaveTextContent('تخصيص الاسم');
      fireEvent.click(customizeChapterBtn);

      // Inline input should be visible and prefilled
      const chapterTitleInput = screen.getByTestId('refresher-chapter-title-input-CH01') as HTMLInputElement;
      expect(chapterTitleInput.value).toBe('الفصل الأول: أساسيات السلامة المهنية');
      fireEvent.change(chapterTitleInput, { target: { value: 'مراجعة مكثفة لقواعد السلامة' } });

      // Click Save
      const saveBtn = screen.getByTestId('refresher-chapter-title-save-CH01');
      fireEvent.click(saveBtn);

      // Saved to refresherConfig.chapters
      expect(handleRefresherChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          chapters: expect.objectContaining({
            CH01: expect.objectContaining({
              customTitle: 'مراجعة مكثفة لقواعد السلامة',
            }),
          }),
        })
      );

      // Original chapters MUST NOT be modified!
      expect(handleChaptersChange).not.toHaveBeenCalled();

      // Re-render with the saved custom title
      rerender(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="refresher"
          refresherConfig={{
            enabled: true,
            chapters: {
              CH01: { chapterId: 'CH01', customTitle: 'مراجعة مكثفة لقواعد السلامة' },
            },
          }}
          onChange={handleChaptersChange}
          onRefresherConfigChange={handleRefresherChange}
        />
      );

      // Custom title badge is displayed
      expect(screen.getByTestId('refresher-custom-chapter-title-badge-CH01')).toHaveTextContent(
        'اسم مخصص بالتذكيري: "مراجعة مكثفة لقواعد السلامة"'
      );

      // Button changes to "تعديل الاسم"
      expect(screen.getByTestId('refresher-custom-chapter-title-btn-CH01')).toHaveTextContent('تعديل الاسم');

      // Chapter card header shows custom title in refresher mode
      expect(screen.getByTestId('chapter-card-CH01')).toHaveTextContent('مراجعة مكثفة لقواعد السلامة');

      // Click "استعادة الأصل"
      const resetBtn = screen.getByTestId('refresher-chapter-title-reset-CH01');
      fireEvent.click(resetBtn);

      expect(handleRefresherChange).toHaveBeenCalledWith(
        expect.objectContaining({
          chapters: expect.objectContaining({
            CH01: expect.objectContaining({
              customTitle: undefined,
            }),
          }),
        })
      );
    });

    it('warns in curriculum mode before deleting an item when refresher is enabled', () => {
      const handleChaptersChange = vi.fn();

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="curriculum"
          refresherConfig={{ enabled: true }}
          onChange={handleChaptersChange}
        />
      );

      // Click delete on ITEM01
      const deleteItemBtn = screen.getByTestId('item-delete-ITEM01');
      fireEvent.click(deleteItemBtn);

      // Warning dialog appears explaining impact on refresher version
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
        'تأثير الحذف على النسخة التذكيرية'
      );
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        /سيؤدي أيضًا إلى استبعاده من النسخة التذكيرية المفعلة للمقرر/
      );

      // Cancel button closes dialog without deleting
      const cancelBtn = screen.getByTestId('confirm-cancel-btn');
      fireEvent.click(cancelBtn);
      expect(handleChaptersChange).not.toHaveBeenCalled();

      // Re-open and confirm
      fireEvent.click(deleteItemBtn);
      const confirmBtn = screen.getByTestId('confirm-delete-btn');
      fireEvent.click(confirmBtn);

      expect(handleChaptersChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'CH01',
            items: expect.not.arrayContaining([expect.objectContaining({ id: 'ITEM01' })]),
          }),
        ])
      );
    });

    it('warns before moving an item in curriculum mode, cancels without moving, and moves on confirmation', () => {
      const handleChaptersChange = vi.fn();

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="curriculum"
          refresherConfig={{ enabled: true }}
          onChange={handleChaptersChange}
        />
      );

      // Move ITEM01 down (which is visible in refresher)
      const moveDownBtn = screen.getByTestId('item-move-down-ITEM01');
      fireEvent.click(moveDownBtn);

      // Confirmation dialog appears with impact message
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
        'تأثير تغيير ترتيب المحتوى على النسخة التذكيرية'
      );
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        'تغيير ترتيب الدرس "قواعد السلامة في ورش الصيانة" سيؤثر أيضًا على تسلسل المحتوى في النسخة التذكيرية للمقرر'
      );

      // Cancel: order remains unchanged
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(handleChaptersChange).not.toHaveBeenCalled();

      // Trigger again and confirm
      fireEvent.click(moveDownBtn);
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      expect(handleChaptersChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'CH01',
            items: [mockChapters[0].items[1], mockChapters[0].items[0]], // swapped
          }),
        ])
      );
    });

    it('warns before moving a chapter in curriculum mode, cancels without moving, and moves on confirmation', () => {
      const handleChaptersChange = vi.fn();

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="curriculum"
          refresherConfig={{ enabled: true }}
          onChange={handleChaptersChange}
        />
      );

      // Move CH01 down
      const moveChapterDownBtn = screen.getByTestId('chapter-move-down-CH01');
      fireEvent.click(moveChapterDownBtn);

      // Confirmation dialog appears
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
        'تأثير تغيير ترتيب الفصول على النسخة التذكيرية'
      );
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        'تغيير ترتيب الفصول سيؤثر أيضًا على تسلسل الفصول في النسخة التذكيرية للمقرر'
      );

      // Cancel: chapters remain unchanged
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(handleChaptersChange).not.toHaveBeenCalled();

      // Confirm move
      fireEvent.click(moveChapterDownBtn);
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      expect(handleChaptersChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'CH02', order: 1 }),
          expect.objectContaining({ id: 'CH01', order: 2 }),
        ])
      );
    });

    it('warns before adding a new item via ItemEditorModal, discards on cancel, and saves on confirm', async () => {
      const handleChaptersChange = vi.fn();

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="curriculum"
          refresherConfig={{ enabled: true }}
          onChange={handleChaptersChange}
        />
      );

      // Click "إضافة درس أو محتوى لهذا الفصل"
      const addItemBtn = screen.getByTestId('chapter-add-item-btn-CH01');
      fireEvent.click(addItemBtn);

      // ItemEditorModal is open; fill title and save
      const titleInput = screen.getByTestId('item-title-input');
      fireEvent.change(titleInput, { target: { value: 'فيديو إجراءات السلامة المحدث' } });

      const saveModalBtn = screen.getByTestId('item-save-btn');
      fireEvent.click(saveModalBtn);

      // Refresher addition impact warning appears
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
        'تأثير إضافة المحتوى على النسخة التذكيرية'
      );
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        'إضافة الدرس "فيديو إجراءات السلامة المحدث" سيؤدي أيضًا إلى إدراجه تلقائيًا ضمن النسخة التذكيرية المفعلة للمقرر'
      );

      // Cancel: pending addition is discarded
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(handleChaptersChange).not.toHaveBeenCalled();

      // Save again and confirm
      fireEvent.click(saveModalBtn);
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      expect(handleChaptersChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'CH01',
            items: expect.arrayContaining([
              expect.objectContaining({ title: 'فيديو إجراءات السلامة المحدث' }),
            ]),
          }),
        ])
      );
    });

    it('warns before modifying media/duration of an existing item and preserves original on cancel', () => {
      const handleChaptersChange = vi.fn();

      render(
        <CurriculumTreeEditor
          chapters={mockChapters}
          mode="curriculum"
          refresherConfig={{ enabled: true }}
          onChange={handleChaptersChange}
        />
      );

      // Click edit on ITEM01
      const editBtn = screen.getByTestId('item-edit-ITEM01');
      fireEvent.click(editBtn);

      // Change duration in modal
      const durationInput = screen.getByTestId('item-duration-input');
      fireEvent.change(durationInput, { target: { value: '45:00' } });

      const saveModalBtn = screen.getByTestId('item-save-btn');
      fireEvent.click(saveModalBtn);

      // Refresher impact warning appears for duration/policy update
      expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
        'تأثير التعديل على النسخة التذكيرية'
      );
      expect(screen.getByTestId('confirm-dialog-message')).toHaveTextContent(
        'تعديل مدة أو سياسة إتمام الدرس "قواعد السلامة في ورش الصيانة" سيؤثر أيضًا على متطلبات النسخة التذكيرية للمقرر'
      );

      // Cancel: original duration preserved, handleChaptersChange not called
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(handleChaptersChange).not.toHaveBeenCalled();

      // Save again and confirm
      fireEvent.click(saveModalBtn);
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));

      expect(handleChaptersChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'CH01',
            items: expect.arrayContaining([
              expect.objectContaining({ id: 'ITEM01', duration: '45:00' }),
            ]),
          }),
        ])
      );
    });
  });
});
