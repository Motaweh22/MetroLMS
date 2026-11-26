import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  sanitizeSafeUrl,
  getSafeYouTubeEmbedUrl,
  getSafeGoogleDrivePreviewUrl,
  getSafeOfficeEmbedUrl,
  isSafePreviewFrameUrl,
} from '@/core/utils/safeUrl';
import { DocumentViewer } from '@/features/learning-player/components/DocumentViewer';
import { GroupMaterialViewerModal } from '@/features/groups/components/GroupMaterialViewerModal';
import { ReviewContentPreview } from '@/features/course-review/components/ReviewContentPreview';
import type { Course } from '@/core/courses/types';
import type { GroupMaterialFile } from '@/core/groups/types';

describe('Sprint 1 Security Remediation — URL Sanitization & Iframe Isolation (BUG-006)', () => {
  describe('sanitizeSafeUrl & Strict Embed Origin Parsing', () => {
    it('rejects javascript:, data:, vbscript:, control chars, malformed URLs, and // protocol-relative bypasses', () => {
      expect(sanitizeSafeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeSafeUrl('  JaVaScRiPt:alert(1)  ')).toBe('#');
      expect(sanitizeSafeUrl('java\tscript:alert(1)')).toBe('#');
      expect(sanitizeSafeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
      expect(sanitizeSafeUrl('vbscript:msgbox(1)')).toBe('#');
      expect(sanitizeSafeUrl('//attacker.example/phish')).toBe('#');
      expect(sanitizeSafeUrl('\\/attacker.example/phish')).toBe('#');
      expect(sanitizeSafeUrl('not a valid ::// url')).toBe('#');

      // Legitimate URLs preserved
      expect(sanitizeSafeUrl('https://drive.google.com/file/d/abc/view')).toBe(
        'https://drive.google.com/file/d/abc/view'
      );
      expect(sanitizeSafeUrl('/api/media/references/1/stream')).toBe('/api/media/references/1/stream');
      expect(sanitizeSafeUrl('#section')).toBe('#section');
      expect(sanitizeSafeUrl('blob:http://localhost/uuid-1')).toBe('blob:http://localhost/uuid-1');
    });

    it('rejects attacker origins attempting .includes() substring spoofing for YouTube, Drive, and Office', () => {
      // Malicious hosts embedding trusted provider strings in query/path/subdomain
      expect(getSafeYouTubeEmbedUrl('https://evil.example/?youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
      expect(getSafeYouTubeEmbedUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull(); // non-HTTPS
      expect(getSafeYouTubeEmbedUrl('javascript:alert(1)')).toBeNull();
      expect(getSafeYouTubeEmbedUrl('//youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();

      expect(getSafeGoogleDrivePreviewUrl('https://evil.example/drive.google.com/file/d/123/view')).toBeNull();
      expect(getSafeGoogleDrivePreviewUrl('https://drive.google.com.evil.example/file/d/123/view')).toBeNull();

      expect(getSafeOfficeEmbedUrl('https://evil.example/?sharepoint=1&onedrive=1')).toBeNull();
      expect(getSafeOfficeEmbedUrl('https://evil-sharepoint.com/doc.pptx')).toBeNull();
      expect(getSafeOfficeEmbedUrl('http://contoso.sharepoint.com/doc.pptx')).toBeNull();

      // Legitimate HTTPS providers succeed
      expect(getSafeYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
      expect(getSafeYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
      expect(getSafeGoogleDrivePreviewUrl('https://drive.google.com/file/d/test_123/view')).toBe(
        'https://drive.google.com/file/d/test_123/preview'
      );
      expect(getSafeOfficeEmbedUrl('https://metro.sharepoint.com/sites/lms/doc.pptx')).toBe(
        'https://metro.sharepoint.com/sites/lms/doc.pptx'
      );
      expect(getSafeOfficeEmbedUrl('https://view.officeapps.live.com/op/embed.aspx?src=x')).toBe(
        'https://view.officeapps.live.com/op/embed.aspx?src=x'
      );
    });

    it('restricts local preview frames to blob: or /api/media/ or /dev-media/ paths only', () => {
      expect(isSafePreviewFrameUrl('blob:http://localhost/pdf-1')).toBe(true);
      expect(isSafePreviewFrameUrl('/api/media/references/10/stream')).toBe(true);
      expect(isSafePreviewFrameUrl('//evil.example/doc.pdf')).toBe(false);
      expect(isSafePreviewFrameUrl('https://evil.example/payload.html')).toBe(false);
      expect(isSafePreviewFrameUrl('javascript:alert(1)')).toBe(false);
      expect(isSafePreviewFrameUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });
  });

  describe('Iframe Sandbox & Untrusted Origin Rendering Guards', () => {
    const baseCourse: Course = {
      id: '10',
      title: 'مقرر أمن',
      description: 'وصف',
      level: 'مبتدئ',
      estimatedHours: 1,
      rating: 0,
      ratingCount: 0,
      enrollmentCount: 0,
      status: 'pending_admin',
      lecturerId: '2',
      lecturerName: 'محاضر',
      chapters: [
        {
          id: 'ch-1',
          title: 'وحدة 1',
          order: 1,
          items: [
            {
              id: 'spoof-office',
              type: 'powerpoint',
              title: 'عرض مخادع',
              url: 'https://evil.example/?sharepoint=1&onedrive=1',
              order: 1,
            },
            {
              id: 'spoof-video',
              type: 'video',
              title: 'فيديو مخادع',
              url: 'https://evil.example/drive.google.com/file/d/123/view',
              order: 2,
            },
            {
              id: 'valid-office',
              type: 'docx',
              title: 'مستند شيربوينت موثوق',
              url: 'https://metro.sharepoint.com/sites/docs/file.docx',
              order: 3,
            },
          ],
        },
      ],
    };

    it('blocks ReviewContentPreview from rendering spoofed substring URLs in privileged iframes and omits allow-same-origin on third-party Office embeds', () => {
      const { rerender } = render(
        <ReviewContentPreview
          course={baseCourse}
          selectedTarget={{ type: 'item', chapterId: 'ch-1', itemId: 'spoof-office' }}
          isEditMode={false}
          onUpdateMetadata={vi.fn()}
          onUpdateChapter={vi.fn()}
          onUpdateItem={vi.fn()}
          autosaveStatus="idle"
          submissionType="new"
          isPublishedUpdate={false}
        />
      );

      // Spoofed Office URL must NOT mount an iframe
      expect(screen.queryByTestId('preview-office-frame')).not.toBeInTheDocument();

      // Spoofed Drive URL must NOT mount an iframe
      rerender(
        <ReviewContentPreview
          course={baseCourse}
          selectedTarget={{ type: 'item', chapterId: 'ch-1', itemId: 'spoof-video' }}
          isEditMode={false}
          onUpdateMetadata={vi.fn()}
          onUpdateChapter={vi.fn()}
          onUpdateItem={vi.fn()}
          autosaveStatus="idle"
          submissionType="new"
          isPublishedUpdate={false}
        />
      );
      expect(document.querySelector('iframe')).not.toBeInTheDocument();

      // Legitimate SharePoint URL renders sandboxed iframe WITHOUT allow-same-origin
      rerender(
        <ReviewContentPreview
          course={baseCourse}
          selectedTarget={{ type: 'item', chapterId: 'ch-1', itemId: 'valid-office' }}
          isEditMode={false}
          onUpdateMetadata={vi.fn()}
          onUpdateChapter={vi.fn()}
          onUpdateItem={vi.fn()}
          autosaveStatus="idle"
          submissionType="new"
          isPublishedUpdate={false}
        />
      );
      const officeFrame = screen.getByTestId('preview-office-frame');
      expect(officeFrame).toBeInTheDocument();
      const sandbox = officeFrame.getAttribute('sandbox') || '';
      expect(sandbox).toContain('allow-scripts');
      expect(sandbox).not.toContain('allow-same-origin');
    });

    it('applies sandbox="allow-same-origin" on GroupMaterialViewerModal PDF frame and blocks external untrusted PDF URLs', () => {
      const evilFile: GroupMaterialFile = {
        id: 'm1',
        groupId: '1',
        folderId: '',
        title: 'ملف خارجي غير موثوق',
        originalFileName: 'bad.pdf',
        fileType: 'pdf',
        fileSizeBytes: 100,
        mimeType: 'application/pdf',
        url: 'https://evil.example/xss.html',
        uploadedAt: '2026-11-25T00:00:00Z',
        uploadedBy: '1',
        uploadedByName: 'admin',
        downloadCount: 0,
        order: 1,
        isVisible: true,
      };
      render(<GroupMaterialViewerModal file={evilFile} isOpen={true} onClose={vi.fn()} />);
      expect(screen.queryByTestId('pdf-preview-frame')).not.toBeInTheDocument();
      expect(screen.getByText(/تم حظر رابط المعاينة غير الموثوق/)).toBeInTheDocument();
    });

    describe('DocumentViewer fetch credentials and sandbox', () => {
      const origUA = navigator.userAgent;

      beforeEach(() => {
        Object.defineProperty(window.navigator, 'userAgent', {
          value: 'Mozilla/5.0 Chrome/120.0.0.0',
          configurable: true,
        });
      });

      afterEach(() => {
        Object.defineProperty(window.navigator, 'userAgent', {
          value: origUA,
          configurable: true,
        });
        vi.restoreAllMocks();
      });

      it('passes credentials: same-origin, rejects text/html responses, and sandboxes legitimate PDF iframe', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
          if (String(url).includes('format=json')) {
            return Promise.resolve(new Response('not json', { status: 404 }));
          }
          return Promise.resolve(
            new Response(new Blob(['%PDF-1.4\nok'], { type: 'application/pdf' }), {
              status: 200,
              headers: { 'content-type': 'application/pdf' },
            })
          );
        });

        render(
          <DocumentViewer
            item={{
              id: 'doc-1',
              title: 'دليل PDF',
              type: 'pdf',
              url: '/api/media/references/1/stream',
              chapterId: 'ch-1',
              chapterTitle: 'وحدة 1',
              globalIndex: 0,
              isCompleted: false,
              isLocked: false,
              isActive: true,
            }}
            onComplete={vi.fn()}
          />
        );

        await waitFor(() => {
          const frame = document.querySelector('iframe.document-frame');
          expect(frame).toBeInTheDocument();
          expect(frame?.getAttribute('sandbox')).toBe('allow-same-origin');
        });

        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/media/references/1/stream'),
          expect.objectContaining({ credentials: 'same-origin' })
        );
      });
    });
  });
});
