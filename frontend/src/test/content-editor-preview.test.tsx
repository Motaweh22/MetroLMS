import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { ItemEditorModal } from '@/features/course-builder/components/ItemEditorModal';
import type { ChapterItem } from '@/core/courses/types';

describe('Content Editor Live Preview Verification', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let createdUrls: string[] = [];
  let revokedUrls: string[] = [];

  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    let counter = 0;
    URL.createObjectURL = vi.fn().mockImplementation(() => {
      counter++;
      const url = `blob:http://localhost/mock-blob-${counter}`;
      createdUrls.push(url);
      return url;
    });

    URL.revokeObjectURL = vi.fn().mockImplementation((url) => {
      revokedUrls.push(url);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('1. Selecting a video file displays a playable HTML5 preview before confirmation', async () => {
    const handleSave = vi.fn();

    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل السلامة المهنية"
        onClose={vi.fn()}
        onSave={handleSave}
      />
    );

    // Initial state: empty preview guidance
    expect(screen.getByTestId('preview-empty-upload')).toBeInTheDocument();

    // Select a video file
    const file = new File(['fake-video-bytes'], 'safety-video.mp4', {
      type: 'video/mp4',
    });
    const fileInput = screen.getByTestId('item-file-input');

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Verify video preview element rendered with controls
    const videoPreview = screen.getByTestId('video-preview-player');
    expect(videoPreview).toBeInTheDocument();
    expect(videoPreview).toHaveAttribute('controls');
    expect(videoPreview.getAttribute('src')).toMatch(/^blob:http:\/\/localhost\/mock-blob-/);

    // Save must NOT be called merely because file was previewed
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('2. Selecting a PDF file displays the actual document preview frame', async () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل الوثائق"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // Switch to PDF
    fireEvent.click(screen.getByTestId('item-type-btn-pdf'));
    expect(screen.getByTestId('preview-empty-pdf')).toBeInTheDocument();

    // Select a PDF file
    const file = new File(['fake-pdf-content'], 'manual.pdf', {
      type: 'application/pdf',
    });
    const fileInput = screen.getByTestId('item-file-input');

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const pdfFrame = screen.getByTestId('pdf-preview-frame');
    expect(pdfFrame).toBeInTheDocument();
    expect(pdfFrame.getAttribute('src')).toMatch(/^blob:http:\/\/localhost\/mock-blob-/);
  });

  it('3. Selecting an image displays the actual image preview', async () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل المخططات"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // Switch to image
    fireEvent.click(screen.getByTestId('item-type-btn-image'));
    expect(screen.getByTestId('preview-empty-image')).toBeInTheDocument();

    // Select an image file
    const file = new File(['fake-image-bytes'], 'metro-map.png', {
      type: 'image/png',
    });
    const fileInput = screen.getByTestId('item-file-input');

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const imageEl = screen.getByTestId('image-preview-element');
    expect(imageEl).toBeInTheDocument();
    expect(imageEl.getAttribute('src')).toMatch(/^blob:http:\/\/localhost\/mock-blob-/);
  });

  it('4. Unsupported viewer formats display accurate file metadata and a clear preview limitation notice', async () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل العروض التقديمية"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // Switch to PowerPoint
    fireEvent.click(screen.getByTestId('item-type-btn-powerpoint'));
    expect(screen.getByTestId('preview-empty-downloadable')).toBeInTheDocument();

    const file = new File(['fake-powerpoint-data'], 'presentation.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const fileInput = screen.getByTestId('item-file-input');

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Summary card rendered
    const card = screen.getByTestId('downloadable-summary-card');
    expect(card).toBeInTheDocument();
    expect(within(card).getByText('presentation.pptx')).toBeInTheDocument();
    expect(within(card).getAllByText('عرض تقديمي (PowerPoint)').length).toBeGreaterThan(0);

    // Clear limitation text
    expect(
      screen.getByText(/المعاينة المباشرة داخل المتصفح غير مدعومة لهذا النوع من الملفات/)
    ).toBeInTheDocument();

    // Confirm no fake viewer elements were created
    expect(screen.queryByTestId('video-preview-player')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-preview-frame')).not.toBeInTheDocument();
    expect(screen.queryByTestId('image-preview-element')).not.toBeInTheDocument();
  });

  it('5. Valid YouTube URL initiates YouTube preview in editor before saving', () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل المحاضرات الخارجية"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // Select YouTube source
    fireEvent.click(screen.getByTestId('video-source-youtube'));
    expect(screen.getByTestId('preview-empty-youtube')).toBeInTheDocument();

    // Type valid YouTube URL
    const urlInput = screen.getByTestId('youtube-url-input');
    fireEvent.change(urlInput, {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });

    const youtubeStage = screen.getByTestId('preview-youtube-stage');
    expect(youtubeStage).toBeInTheDocument();
    expect(within(youtubeStage).getByText(/dQw4w9WgXcQ/)).toBeInTheDocument();
  });

  it('6. Valid Google Drive URL initiates Drive preview, while invalid URL displays error', () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل ملفات السحابة"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // Select Drive source
    fireEvent.click(screen.getByTestId('video-source-drive'));
    expect(screen.getByTestId('preview-empty-drive')).toBeInTheDocument();

    const urlInput = screen.getByTestId('drive-url-input');

    // Invalid Drive URL
    fireEvent.change(urlInput, { target: { value: 'https://example.com/not-drive' } });
    expect(screen.getByTestId('preview-drive-error')).toBeInTheDocument();

    // Valid Drive URL
    fireEvent.change(urlInput, {
      target: {
        value: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing',
      },
    });

    expect(screen.getByTestId('preview-drive-stage')).toBeInTheDocument();
    expect(screen.getByTestId('drive-iframe')).toHaveAttribute(
      'src',
      'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/preview'
    );
  });

  it('7. Replacing a selection updates the preview and revokes previous object URLs', async () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل الاختبار"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('item-file-input');

    // First file
    const file1 = new File(['video-1'], 'video-1.mp4', { type: 'video/mp4' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file1] } });
    });

    expect(screen.getAllByText('video-1.mp4').length).toBeGreaterThan(0);
    expect(createdUrls).toHaveLength(1);
    const firstUrl = createdUrls[0];

    // Second file (replace selection)
    const file2 = new File(['video-2'], 'video-2.mp4', { type: 'video/mp4' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file2] } });
    });

    expect(screen.getAllByText('video-2.mp4').length).toBeGreaterThan(0);
    expect(createdUrls).toHaveLength(2);

    // Old object URL must be revoked to prevent memory leaks
    expect(revokedUrls).toContain(firstUrl);

    // Remove file explicitly
    const removeBtn = screen.getByTestId('remove-selected-file-btn');
    fireEvent.click(removeBtn);

    expect(screen.getByTestId('preview-empty-upload')).toBeInTheDocument();
    expect(revokedUrls).toContain(createdUrls[1]);
  });

  it('8. Confirming (حفظ الدرس) validates and applies the item to draft', async () => {
    const handleSave = vi.fn();

    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل الفحص الفني"
        onClose={vi.fn()}
        onSave={handleSave}
      />
    );

    // Enter title
    fireEvent.change(screen.getByTestId('item-title-input'), {
      target: { value: 'فحص قضبان المسير' },
    });

    // Select file
    const file = new File(['video-data'], 'track-inspection.mp4', {
      type: 'video/mp4',
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('item-file-input'), {
        target: { files: [file] },
      });
    });

    // Confirm save
    fireEvent.click(screen.getByTestId('item-save-btn'));

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'فحص قضبان المسير',
        type: 'video',
        originalFileName: 'track-inspection.mp4',
      })
    );
  });

  it('9. Cancelling discards pending changes and preserves the existing item unchanged', async () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    const existingItem: ChapterItem = {
      id: 'ITEM_PRESERVE',
      title: 'الدرس الأصلي بدون تعديل',
      type: 'video',
      url: '/dev-media/original.mp4',
      duration: '15:00',
      canDownload: false,
    };

    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل التجربة"
        item={existingItem}
        onClose={handleClose}
        onSave={handleSave}
      />
    );

    // Change title and pick new file without saving
    fireEvent.change(screen.getByTestId('item-title-input'), {
      target: { value: 'تعديل سيتم إلغاؤه' },
    });

    const newFile = new File(['new-data'], 'new.mp4', { type: 'video/mp4' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('item-file-input'), {
        target: { files: [newFile] },
      });
    });

    // Cancel modal
    const cancelBtn = screen.getByTestId('item-cancel-btn');
    fireEvent.click(cancelBtn);

    // onSave must NOT be called
    expect(handleSave).not.toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Created URL must be cleaned up
    expect(revokedUrls).toHaveLength(1);
  });

  it('10. Editor previews do not generate trainee progress or completion events', () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل المراجعة"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('video-source-drive'));
    fireEvent.change(screen.getByTestId('drive-url-input'), {
      target: {
        value: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
      },
    });

    // In previewMode, GoogleDrivePlayer does NOT render the trainee completion action button
    expect(screen.queryByTestId('drive-mark-complete-btn')).not.toBeInTheDocument();
    // Instead renders authoring preview info bar
    expect(screen.getByTestId('drive-preview-info-bar')).toBeInTheDocument();
  });

  it('11. Cleans up object URLs on modal unmount', async () => {
    const { unmount } = render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="فصل الاختبار"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    const file = new File(['data'], 'test.mp4', { type: 'video/mp4' });
    await act(async () => {
      fireEvent.change(screen.getByTestId('item-file-input'), {
        target: { files: [file] },
      });
    });

    expect(createdUrls).toHaveLength(1);
    const activeUrl = createdUrls[0];

    unmount();

    expect(revokedUrls).toContain(activeUrl);
  });
});
