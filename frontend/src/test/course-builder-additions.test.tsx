import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MetadataEditor } from '@/features/course-builder/components/MetadataEditor';
import { ItemEditorModal } from '@/features/course-builder/components/ItemEditorModal';
import { ExternalResourcesEditor } from '@/features/courses/components/ExternalResourcesEditor';
import { ExternalResourcesList } from '@/features/courses/components/ExternalResourcesList';
import { QRCodeModal } from '@/shared/ui/QRCodeModal';
import { GoogleDrivePlayer } from '@/features/learning-player/components/GoogleDrivePlayer';
import { canDownloadItem, getEligibleZipItems } from '@/core/courses/downloadPolicy';
import { generateQrMatrix, generateQrSvg } from '@/core/utils/qrGenerator';
import { extractYouTubeVideoId, extractGoogleDriveFileId } from '@/features/course-builder/utils/videoUrlHelpers';
import type { Course, ChapterItem, ExternalResource } from '@/core/courses/types';

const mockBaseCourse: Course = {
  id: 'CRS999',
  title: 'سلامة تشغيل السكك الحديدية المتقدمة',
  description: 'دورة تدريبية معتمدة لمهندسي وفنيي الخطوط',
  level: 'متقدم',
  estimatedHours: 8,
  rating: 4.8,
  ratingCount: 30,
  enrollmentCount: 120,
  status: 'draft',
  lecturerId: 'usr_lect_002',
  lecturerName: 'د. طارق الجوهري',
  chapters: [
    {
      id: 'CH01',
      title: 'الفصل الأول: أسس السلامة الميدانية',
      order: 1,
      items: [
        {
          id: 'ITEM01',
          title: 'محاضرة قواعد العزل',
          type: 'video',
          videoSourceType: 'upload',
          downloadPolicy: 'immediate',
        },
      ],
    },
  ],
};

const mockAvailableCourses: Course[] = [
  {
    ...mockBaseCourse,
    id: 'CRS001',
    title: 'إشارات المترو والتحكم الآلي',
  },
  {
    ...mockBaseCourse,
    id: 'CRS002',
    title: 'أنظمة الجر والكهرباء',
  },
];

describe('Increment 8 Additional Requirements: Unit & Integration Verification', () => {
  // ========================================================
  // 1. Multiple Course Prerequisites
  // ========================================================
  describe('Multiple Course Prerequisites', () => {
    it('supports adding, editing, and removing free-text knowledge prerequisites', () => {
      let currentCourse = { ...mockBaseCourse };
      const handleChange = vi.fn((updated) => {
        currentCourse = updated;
      });

      const { rerender } = render(
        <MetadataEditor
          course={currentCourse}
          onChange={handleChange}
          availableCourses={mockAvailableCourses}
        />
      );

      // Add a knowledge prerequisite
      const input = screen.getByTestId('knowledge-prereq-input');
      const addBtn = screen.getByTestId('add-knowledge-prereq-btn');

      fireEvent.change(input, { target: { value: 'أساسيات لغة جافا' } });
      fireEvent.click(addBtn);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgePrerequisites: ['أساسيات لغة جافا'],
        })
      );

      // Rerender with updated course
      rerender(
        <MetadataEditor
          course={currentCourse}
          onChange={handleChange}
          availableCourses={mockAvailableCourses}
        />
      );

      // Verify chip exists
      expect(screen.getByText('أساسيات لغة جافا')).toBeInTheDocument();

      // Remove the chip
      const removeBtn = screen.getByTestId('remove-knowledge-btn-0');
      fireEvent.click(removeBtn);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgePrerequisites: [],
        })
      );
    });

    it('supports selecting multiple prerequisite courses independently', () => {
      let currentCourse = { ...mockBaseCourse, prerequisiteCourseIds: ['CRS001'] };
      const handleChange = vi.fn((updated) => {
        currentCourse = updated;
      });

      const { rerender } = render(
        <MetadataEditor
          course={currentCourse}
          onChange={handleChange}
          availableCourses={mockAvailableCourses}
        />
      );

      // CRS001 chip should be visible
      expect(screen.getByTestId('prereq-course-chip-CRS001')).toBeInTheDocument();

      // Select and add CRS002
      const select = screen.getByTestId('builder-prereq-select');
      const addBtn = screen.getByTestId('add-prereq-course-btn');

      fireEvent.change(select, { target: { value: 'CRS002' } });
      fireEvent.click(addBtn);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          prerequisiteCourseIds: ['CRS001', 'CRS002'],
          prerequisiteCourseId: 'CRS001', // Keeps legacy synchronization
        })
      );

      // Rerender with both
      rerender(
        <MetadataEditor
          course={currentCourse}
          onChange={handleChange}
          availableCourses={mockAvailableCourses}
        />
      );

      // Remove CRS001
      const removeCrs1 = screen.getByTestId('remove-prereq-course-CRS001');
      fireEvent.click(removeCrs1);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          prerequisiteCourseIds: ['CRS002'],
          prerequisiteCourseId: 'CRS002',
        })
      );
    });
  });

  // ========================================================
  // 2. Optional Course Cover Image and Color
  // ========================================================
  describe('Optional Course Cover Image and Color', () => {
    it('supports switching cover modes and selecting brand colors', () => {
      let currentCourse = { ...mockBaseCourse, coverType: 'default' as const };
      const handleChange = vi.fn((updated) => {
        currentCourse = updated;
      });

      const { rerender } = render(
        <MetadataEditor
          course={currentCourse}
          onChange={handleChange}
          availableCourses={mockAvailableCourses}
        />
      );

      // Switch to color mode
      const colorModeBtn = screen.getByTestId('cover-mode-color-btn');
      fireEvent.click(colorModeBtn);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          coverType: 'color',
        })
      );

      // Rerender in color mode
      rerender(
        <MetadataEditor
          course={currentCourse}
          onChange={handleChange}
          availableCourses={mockAvailableCourses}
        />
      );

      // Select brand color #065F46
      const colorBtn = screen.getByTestId('color-choice-#065F46');
      fireEvent.click(colorBtn);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          coverColor: '#065F46',
          coverType: 'color',
        })
      );
    });

    it('allows explicitly removing cover image without leaving a broken state', () => {
      let currentCourse: Course = {
        ...mockBaseCourse,
        thumbnail: 'blob:http://localhost/test-cover.png',
        coverType: 'image',
      };
      const handleChange = vi.fn((updated) => {
        currentCourse = updated;
      });

      render(
        <MetadataEditor
          course={currentCourse}
          onChange={handleChange}
          availableCourses={mockAvailableCourses}
        />
      );

      const removeBtn = screen.getByTestId('remove-cover-image-btn');
      fireEvent.click(removeBtn);

      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnail: undefined,
          coverType: 'default',
        })
      );
    });
  });

  // ========================================================
  // 3. External Video Sources (YouTube & Google Drive)
  // ========================================================
  describe('External Video Sources', () => {
    it('correctly validates and extracts YouTube video IDs', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('invalid-url')).toBeNull();
    });

    it('correctly validates and extracts Google Drive file IDs', () => {
      expect(
        extractGoogleDriveFileId('https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing')
      ).toBe('1aBcDeFgHiJkLmNoPqRsTuVwXyZ');
      expect(
        extractGoogleDriveFileId('https://drive.google.com/open?id=1aBcDeFgHiJkLmNoPqRsTuVwXyZ')
      ).toBe('1aBcDeFgHiJkLmNoPqRsTuVwXyZ');
      expect(extractGoogleDriveFileId('https://example.com/not-drive')).toBeNull();
    });

    it('locks download policy to never for external video sources in ItemEditorModal', () => {
      const handleSave = vi.fn();

      render(
        <ItemEditorModal
          isOpen={true}
          chapterTitle="فصل الاختبار"
          onClose={vi.fn()}
          onSave={handleSave}
        />
      );

      // Switch video source to YouTube
      const ytSourceBtn = screen.getByTestId('video-source-youtube');
      fireEvent.click(ytSourceBtn);

      // Fill valid title and YouTube URL
      fireEvent.change(screen.getByTestId('item-title-input'), {
        target: { value: 'درس يوتيوب معتمد' },
      });
      fireEvent.change(screen.getByTestId('youtube-url-input'), {
        target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      });

      // Verify download lock warning is shown
      expect(screen.getByTestId('external-video-download-locked')).toBeInTheDocument();

      // Submit
      fireEvent.click(screen.getByTestId('item-save-btn'));

      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'video',
          videoSourceType: 'youtube',
          youtubeVideoId: 'dQw4w9WgXcQ',
          downloadPolicy: 'never',
          canDownload: false,
        })
      );
    });

    it('enforces download exclusion for external videos in downloadPolicy utility', () => {
      const externalItem: ChapterItem = {
        id: 'IT_EXT',
        title: 'فيديو خارجي',
        type: 'video',
        videoSourceType: 'youtube',
        externalUrl: 'https://youtube.com/...',
        downloadPolicy: 'immediate',
      };

      const result = canDownloadItem(externalItem, true, true, true, 'lecturer');
      expect(result.allowed).toBe(false);
      expect(result.reasonAr).toContain('روابط الفيديو الخارجية');

      const courseWithExternal: Course = {
        ...mockBaseCourse,
        chapters: [
          {
            id: 'CH01',
            title: 'الفصل الأول',
            order: 1,
            items: [externalItem],
          },
        ],
      };

      const eligible = getEligibleZipItems(courseWithExternal, true, ['IT_EXT'], true, 'lecturer');
      expect(eligible.length).toBe(0);
    });

    it('GoogleDrivePlayer requires explicit user confirmation to mark complete', async () => {
      const handleComplete = vi.fn();

      render(
        <GoogleDrivePlayer
          driveFileId="1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
          itemId="DRIVE_01"
          title="محاضرة جوجل درايف"
          isCompleted={false}
          onComplete={handleComplete}
        />
      );

      const completeBtn = screen.getByTestId('drive-mark-complete-btn');
      expect(completeBtn).toHaveTextContent('تأكيد المشاهدة والإكمال');

      await React.act(async () => {
        fireEvent.click(completeBtn);
      });
      expect(handleComplete).toHaveBeenCalledWith('DRIVE_01');
    });
  });

  // ========================================================
  // 4. QR Code Generator & Modal
  // ========================================================
  describe('QR Code Generation & Modal', () => {
    it('generates standard QR matrix and SVG accurately', () => {
      const sampleUrl = 'https://metro.gov.eg/courses/CRS003';
      const matrix = generateQrMatrix(sampleUrl);

      expect(Array.isArray(matrix)).toBe(true);
      expect(matrix.length).toBeGreaterThanOrEqual(21); // Valid QR size
      expect(matrix[0].length).toBe(matrix.length);

      const svg = generateQrSvg(sampleUrl, { size: 200 });
      expect(svg).toContain('<svg');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('viewBox');
      expect(svg).toContain('rect');
    });

    it('QRCodeModal renders preview and copies direct canonical URL', async () => {
      const canonicalUrl = `${window.location.origin}/courses/CRS999`;

      render(
        <QRCodeModal
          isOpen={true}
          onClose={vi.fn()}
          title="دورة الأمان"
          url={canonicalUrl}
          badgeLabel="المقرر CRS999"
        />
      );

      expect(screen.getByTestId('qr-code-display')).toBeInTheDocument();
      expect(screen.getByTestId('qr-encoded-url')).toHaveTextContent(canonicalUrl);

      // Copy Link Button
      const copyBtn = screen.getByTestId('qr-copy-link-btn');
      fireEvent.click(copyBtn);
      // Feedback
      expect(await screen.findByText('تم النسخ!')).toBeInTheDocument();
    });
  });

  // ========================================================
  // 5. External Learning Resources (Course & Lesson Level)
  // ========================================================
  describe('External Learning Resources', () => {
    it('validates URLs, adds, reorders, and deletes external resources', () => {
      let resources: ExternalResource[] = [];
      const handleChange = vi.fn((updated) => {
        resources = updated;
      });

      const { rerender } = render(
        <ExternalResourcesEditor
          resources={resources}
          onChange={handleChange}
          scopeLabel="للمقرر"
        />
      );

      // Try adding with invalid scheme
      fireEvent.change(screen.getByTestId('resource-title-input'), {
        target: { value: 'رابط غير آمن' },
      });
      fireEvent.change(screen.getByTestId('resource-url-input'), {
        target: { value: 'javascript:alert(1)' },
      });
      fireEvent.click(screen.getByTestId('save-resource-btn'));

      // Error shown, onChange not called
      expect(screen.getByText(/يرجى إدخال عنوان URL صالح/)).toBeInTheDocument();
      expect(handleChange).not.toHaveBeenCalled();

      // Add with valid HTTPS URL
      fireEvent.change(screen.getByTestId('resource-title-input'), {
        target: { value: 'مستودع الأكواد المرجعية' },
      });
      fireEvent.change(screen.getByTestId('resource-url-input'), {
        target: { value: 'https://github.com/cairo-metro/signals' },
      });
      fireEvent.click(screen.getByTestId('save-resource-btn'));

      expect(handleChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'مستودع الأكواد المرجعية',
            url: 'https://github.com/cairo-metro/signals',
            order: 1,
          }),
        ])
      );

      // Rerender with 2 items to test reordering
      resources = [
        { id: 'res_1', title: 'مورد 1', url: 'https://example.com/1', order: 1 },
        { id: 'res_2', title: 'مورد 2', url: 'https://example.com/2', order: 2 },
      ];

      rerender(
        <ExternalResourcesEditor
          resources={resources}
          onChange={handleChange}
          scopeLabel="للمقرر"
        />
      );

      // Reorder down item 1
      const downBtn = screen.getByTestId('resource-reorder-down-res_1');
      fireEvent.click(downBtn);

      expect(handleChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'res_2', order: 1 }),
        expect.objectContaining({ id: 'res_1', order: 2 }),
      ]);
    });

    it('renders ExternalResourcesList with clean cards and external open actions', () => {
      const mockResources: ExternalResource[] = [
        {
          id: 'res_docs',
          title: 'دليل مواصفات عربات الركاب',
          url: 'https://metro.gov.eg/docs/cars-spec.pdf',
          description: 'النسخة الرسمية المعتمدة من الهيئة القومية للأنفاق',
          order: 1,
        },
      ];

      render(
        <ExternalResourcesList
          resources={mockResources}
          title="مصادر إثرائية"
        />
      );

      expect(screen.getByText('دليل مواصفات عربات الركاب')).toBeInTheDocument();
      expect(screen.getByText('metro.gov.eg')).toBeInTheDocument();

      const openLink = screen.getByTestId('open-resource-btn-res_docs');
      expect(openLink).toHaveAttribute('href', 'https://metro.gov.eg/docs/cars-spec.pdf');
      expect(openLink).toHaveAttribute('target', '_blank');
      expect(openLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
