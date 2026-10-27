import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  getMandatoryVideoEmbedPolicy,
  getDefaultVideoEmbedPolicy,
  deriveEffectiveSandbox,
  deriveEffectivePermissions,
  getTopCropIframeStyle,
  resolveItemVideoEmbedPolicy,
  BASELINE_IFRAME_SANDBOX_TOKENS,
  POPUP_BLOCKING_REMOVED_TOKENS,
  BASELINE_PLAYER_PERMISSIONS,
  POPUP_BLOCKING_REMOVED_PERMISSIONS,
  MANDATORY_GDRIVE_EMBED_POLICY,
  MANDATORY_YOUTUBE_EMBED_POLICY,
  MANDATORY_DIRECT_VIDEO_EMBED_POLICY,
} from '@/core/courses/videoEmbedPolicy';
import { GoogleDrivePlayer } from '@/features/learning-player/components/GoogleDrivePlayer';
import { YouTubePlayer } from '@/features/learning-player/components/YouTubePlayer';
import { ItemEditorModal } from '@/features/course-builder/components/ItemEditorModal';
import { VideoInteractionLab } from '@/features/design-lab/components/VideoInteractionLab';
import type { ChapterItem } from '@/core/courses/types';

// Mock YouTube API loader for player rendering tests
vi.mock('@/features/learning-player/utils/youtubeApiLoader', () => ({
  loadYouTubeIframeApi: vi.fn().mockResolvedValue(true),
  resetYouTubeApiLoaderForTesting: vi.fn(),
}));

describe('Mandatory Source-Aware Video Embed Policy Platform Behavior', () => {
  describe('1. Centralized Policy Definitions', () => {
    it('enforces mandatory platform policy for Google Drive (55px top crop, popup blocking enabled)', () => {
      const drivePolicy = getMandatoryVideoEmbedPolicy('drive');
      expect(drivePolicy).toEqual({
        cropTopPixels: 55,
        blockPopups: true,
      });

      const gdrivePolicy = getMandatoryVideoEmbedPolicy('google-drive');
      expect(gdrivePolicy).toEqual(MANDATORY_GDRIVE_EMBED_POLICY);
    });

    it('enforces mandatory platform policy for YouTube (0px top crop, popup blocking enabled)', () => {
      const ytPolicy = getMandatoryVideoEmbedPolicy('youtube');
      expect(ytPolicy).toEqual({
        cropTopPixels: 0,
        blockPopups: true,
      });
      expect(ytPolicy).toEqual(MANDATORY_YOUTUBE_EMBED_POLICY);
    });

    it('preserves normal browser playback for uploaded and direct videos (0px crop, no popup blocking)', () => {
      const uploadPolicy = getMandatoryVideoEmbedPolicy('upload');
      expect(uploadPolicy).toEqual({
        cropTopPixels: 0,
        blockPopups: false,
      });

      const directPolicy = getMandatoryVideoEmbedPolicy('direct-video');
      expect(directPolicy).toEqual(MANDATORY_DIRECT_VIDEO_EMBED_POLICY);
    });

    it('getDefaultVideoEmbedPolicy aliases mandatory platform policy', () => {
      expect(getDefaultVideoEmbedPolicy('drive')).toEqual(MANDATORY_GDRIVE_EMBED_POLICY);
      expect(getDefaultVideoEmbedPolicy('youtube')).toEqual(MANDATORY_YOUTUBE_EMBED_POLICY);
      expect(getDefaultVideoEmbedPolicy('upload')).toEqual(MANDATORY_DIRECT_VIDEO_EMBED_POLICY);
    });
  });

  describe('2. Sandbox Token Derivation', () => {
    it('returns undefined when popup blocking is disabled or undefined', () => {
      expect(deriveEffectiveSandbox(false)).toBeUndefined();
      expect(deriveEffectiveSandbox(undefined)).toBeUndefined();
    });

    it('removes strictly ONLY allow-popups and allow-popups-to-escape-sandbox when enabled', () => {
      const effective = deriveEffectiveSandbox(true);
      expect(effective).toBeDefined();

      const tokens = effective!.split(' ');
      expect(tokens).not.toContain('allow-popups');
      expect(tokens).not.toContain('allow-popups-to-escape-sandbox');

      // Essential baseline playback tokens MUST be strictly preserved
      expect(tokens).toContain('allow-scripts');
      expect(tokens).toContain('allow-same-origin');
      expect(tokens).toContain('allow-presentation');
      expect(tokens).toContain('allow-forms');

      expect(tokens.length).toBe(
        BASELINE_IFRAME_SANDBOX_TOKENS.length - POPUP_BLOCKING_REMOVED_TOKENS.length
      );
    });

    it('returns full baseline permissions including picture-in-picture when popup blocking is false or undefined', () => {
      const permsFalse = deriveEffectivePermissions(false);
      expect(permsFalse).toBe(BASELINE_PLAYER_PERMISSIONS.join('; '));
      expect(permsFalse).toContain('picture-in-picture');

      const permsUndef = deriveEffectivePermissions(undefined);
      expect(permsUndef).toBe(BASELINE_PLAYER_PERMISSIONS.join('; '));
      expect(permsUndef).toContain('picture-in-picture');
    });

    it('strictly removes ONLY picture-in-picture from allow permissions when popup blocking is active', () => {
      const effectivePerms = deriveEffectivePermissions(true);
      const permList = effectivePerms.split('; ');

      // Strictly omits picture-in-picture
      expect(permList).not.toContain('picture-in-picture');

      // Preserves essential playback and sensor permissions
      expect(permList).toContain('accelerometer');
      expect(permList).toContain('autoplay');
      expect(permList).toContain('clipboard-write');
      expect(permList).toContain('encrypted-media');
      expect(permList).toContain('gyroscope');
      expect(permList).toContain('web-share');

      expect(permList.length).toBe(
        BASELINE_PLAYER_PERMISSIONS.length - POPUP_BLOCKING_REMOVED_PERMISSIONS.length
      );
    });
  });

  describe('3. Top-Crop CSS Style Calculation', () => {
    it('returns standard dimensions for 0px or negative crops', () => {
      const style0 = getTopCropIframeStyle(0);
      expect(style0.height).toBe('100%');
      expect(style0.marginTop).toBe('0px');

      const styleNegative = getTopCropIframeStyle(-20);
      expect(styleNegative.height).toBe('100%');
      expect(styleNegative.marginTop).toBe('0px');
    });

    it('returns responsive calc height and negative margin for 55px Google Drive crop', () => {
      const style55 = getTopCropIframeStyle(55);
      expect(style55.height).toBe('calc(100% + 55px)');
      expect(style55.marginTop).toBe('-55px');
      expect(style55.position).toBe('absolute');
      expect(style55.width).toBe('100%');
      expect(style55.top).toBe(0);
    });
  });

  describe('4. Runtime Policy Resolution & Historical Protection', () => {
    it('applies mandatory 55px crop and popup blocking to existing Drive videos without embedPolicy', () => {
      const historicalItem: Partial<ChapterItem> = {
        videoSourceType: 'drive',
      };
      const resolved = resolveItemVideoEmbedPolicy(historicalItem);
      expect(resolved).toEqual({ cropTopPixels: 55, blockPopups: true });
    });

    it('applies mandatory 0px crop and popup blocking to existing YouTube videos without embedPolicy', () => {
      const historicalItem: Partial<ChapterItem> = {
        videoSourceType: 'youtube',
      };
      const resolved = resolveItemVideoEmbedPolicy(historicalItem);
      expect(resolved).toEqual({ cropTopPixels: 0, blockPopups: true });
    });

    it('does NOT let stale saved metadata override mandatory Google Drive policy in production', () => {
      const itemWithStaleMetadata: Partial<ChapterItem> = {
        videoSourceType: 'drive',
        embedPolicy: { cropTopPixels: 80, blockPopups: false },
      };
      const resolved = resolveItemVideoEmbedPolicy(itemWithStaleMetadata);
      // Production platform policy takes absolute precedence
      expect(resolved).toEqual({ cropTopPixels: 55, blockPopups: true });
    });

    it('does NOT let stale saved metadata override mandatory YouTube policy in production', () => {
      const itemWithStaleMetadata: Partial<ChapterItem> = {
        videoSourceType: 'youtube',
        embedPolicy: { cropTopPixels: 50, blockPopups: false },
      };
      const resolved = resolveItemVideoEmbedPolicy(itemWithStaleMetadata);
      // YouTube must NEVER receive top crop, and popup blocking is mandatory
      expect(resolved).toEqual({ cropTopPixels: 0, blockPopups: true });
    });
  });
});

describe('Production Learning Player Provider Neutrality & Mandatory Policies', () => {
  describe('GoogleDrivePlayer in Production', () => {
    it('always applies 55px top crop and popup blocking on initial iframe load', () => {
      render(
        <GoogleDrivePlayer
          driveFileId="test-drive-file-123"
          title="محاضرة إشارات مترو الأنفاق"
        />
      );

      const iframe = screen.getByTestId('drive-iframe');
      expect(iframe).toBeInTheDocument();

      // Top crop of exactly 55px
      expect(iframe).toHaveStyle({
        height: 'calc(100% + 55px)',
        marginTop: '-55px',
      });

      // Sandbox restrictions applied initially without allow-popups
      const sandboxAttr = iframe.getAttribute('sandbox');
      expect(sandboxAttr).toContain('allow-scripts');
      expect(sandboxAttr).toContain('allow-same-origin');
      expect(sandboxAttr).not.toContain('allow-popups');

      // Fullscreen and autoplay preserved
      expect(iframe).toHaveAttribute('allowFullScreen');
      expect(iframe.getAttribute('allow')).toContain('autoplay');

      // Container metadata reflects mandatory policy
      const container = screen.getByTestId('drive-player-container');
      expect(container).toHaveAttribute('data-crop-pixels', '55');
      expect(container).toHaveAttribute('data-popup-blocking', 'enabled');
    });

    it('ignores stale metadata or prop overrides and enforces 55px + popup blocking', () => {
      render(
        <GoogleDrivePlayer
          driveFileId="test-drive-stale"
          title="محاضرة سابقة"
          embedPolicy={{ cropTopPixels: 80, blockPopups: false }}
          cropTopPixels={90}
          blockPopups={false}
        />
      );

      const iframe = screen.getByTestId('drive-iframe');
      expect(iframe).toHaveStyle({
        height: 'calc(100% + 55px)',
        marginTop: '-55px',
      });

      const sandboxAttr = iframe.getAttribute('sandbox');
      expect(sandboxAttr).not.toContain('allow-popups');

      const container = screen.getByTestId('drive-player-container');
      expect(container).toHaveAttribute('data-crop-pixels', '55');
      expect(container).toHaveAttribute('data-popup-blocking', 'enabled');
    });

    it('does NOT expose provider badges, crop amounts, popup status badges, or external open links to trainees', () => {
      render(
        <GoogleDrivePlayer
          driveFileId="test-clean-drive"
          title="فحص المحركات الكهربائية"
        />
      );

      // Provider badge must NOT be present
      expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();

      // Crop badge must NOT be present
      expect(screen.queryByTestId('drive-crop-badge')).not.toBeInTheDocument();
      expect(screen.queryByText(/55px/)).not.toBeInTheDocument();

      // Popup blocked badge must NOT be present
      expect(screen.queryByTestId('drive-popups-blocked-badge')).not.toBeInTheDocument();
      expect(screen.queryByText(/حظر النوافذ نشط/)).not.toBeInTheDocument();

      // Custom pop-out / open-in-new-window link must NOT be present
      expect(screen.queryByTestId('open-drive-external-btn')).not.toBeInTheDocument();
      expect(screen.queryByText(/فتح في نافذة جديدة/)).not.toBeInTheDocument();

      // Experiment labels must NOT be present
      expect(screen.queryByText(/تجربة/)).not.toBeInTheDocument();

      // Neutral player aria-label
      const container = screen.getByTestId('drive-player-container');
      expect(container).toHaveAttribute('aria-label', 'مشغل الفيديو: فحص المحركات الكهربائية');

      // Explicit confirmation notice heading and explanatory paragraph must NOT be present
      expect(screen.queryByText(/توثيق مشاهدة الدرس/)).not.toBeInTheDocument();
      expect(screen.queryByText(/يتطلب إتمام هذا الدرس تأكيدك الصريح/)).not.toBeInTheDocument();

      // Ordinary completion action remains present and functional
      expect(screen.getByTestId('drive-mark-complete-btn')).toBeInTheDocument();
    });

    it('does NOT automatically mark lesson complete when confirmation notice is removed and preserves manual confirmation action', () => {
      const handleComplete = vi.fn();
      render(
        <GoogleDrivePlayer
          driveFileId="test-drive-complete-preserve"
          itemId="DRIVE_ITEM_99"
          title="محاضرة التحقق من الإكمال"
          isCompleted={false}
          onComplete={handleComplete}
        />
      );

      // Confirmation notice is absent
      expect(screen.queryByText(/توثيق مشاهدة الدرس/)).not.toBeInTheDocument();
      expect(screen.queryByText(/يتطلب إتمام هذا الدرس تأكيدك الصريح/)).not.toBeInTheDocument();

      // Completion callback must NOT be called automatically on render
      expect(handleComplete).not.toHaveBeenCalled();

      // Button remains present, enabled, and displays standard confirmation text
      const btn = screen.getByTestId('drive-mark-complete-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
      expect(btn).toHaveTextContent('تأكيد المشاهدة والإكمال');
    });

    it('ensures video viewport has responsive 16:9 aspect ratio and separates completion action container outside the viewport', async () => {
      const handleComplete = vi.fn().mockResolvedValue(true);
      render(
        <GoogleDrivePlayer
          driveFileId="test-drive-layout-viewport"
          itemId="DRIVE_ITEM_LAYOUT"
          title="محاضرة التحقق من التخطيط الهندسي"
          isCompleted={false}
          onComplete={handleComplete}
        />
      );

      // 1. Video viewport is the 16:9 responsive container
      const viewport = screen.getByTestId('drive-player-container');
      expect(viewport).toBeInTheDocument();
      expect(viewport).toHaveClass('custom-video-container', 'w-full', 'aspect-video', 'overflow-hidden');
      // Must NOT have flex-col squashing the video height
      expect(viewport).not.toHaveClass('flex-col');

      // 2. Iframe top-crop wrapper and iframe sizing
      const topCropWrapper = screen.getByTestId('drive-top-crop-wrapper');
      expect(viewport).toContainElement(topCropWrapper);
      expect(topCropWrapper).toHaveClass('w-full', 'h-full', 'relative', 'overflow-hidden', 'gdrive-top-crop-wrapper');

      const iframe = screen.getByTestId('drive-iframe');
      expect(topCropWrapper).toContainElement(iframe);
      expect(iframe).toHaveStyle({
        height: 'calc(100% + 55px)',
        marginTop: '-55px',
        position: 'absolute',
      });
      // Does not introduce a second competing aspect-ratio constraint inside the viewport
      expect(topCropWrapper).not.toHaveClass('aspect-video');
      expect(iframe).not.toHaveClass('aspect-video');

      // 3. Completion action container is strictly outside the video viewport
      const completionBar = screen.getByTestId('drive-completion-action-bar');
      expect(completionBar).toBeInTheDocument();
      expect(viewport).not.toContainElement(completionBar);

      const completeBtn = screen.getByTestId('drive-mark-complete-btn');
      expect(completionBar).toContainElement(completeBtn);
      expect(viewport).not.toContainElement(completeBtn);

      // 4. Clicking completion button triggers onComplete callback safely
      await act(async () => {
        fireEvent.click(completeBtn);
      });
      expect(handleComplete).toHaveBeenCalledTimes(1);
      expect(handleComplete).toHaveBeenCalledWith('DRIVE_ITEM_LAYOUT');
    });

    it('in preview mode, separates preview info bar outside the 16:9 video viewport', () => {
      render(
        <GoogleDrivePlayer
          driveFileId="test-drive-preview-viewport"
          title="معاينة محتوى الفيديو"
          previewMode={true}
        />
      );

      const viewport = screen.getByTestId('drive-player-container');
      expect(viewport).toHaveClass('custom-video-container', 'w-full', 'aspect-video');

      const previewBar = screen.getByTestId('drive-preview-info-bar');
      expect(previewBar).toBeInTheDocument();
      expect(viewport).not.toContainElement(previewBar);
      expect(screen.queryByTestId('drive-mark-complete-btn')).not.toBeInTheDocument();
    });
  });

  describe('YouTubePlayer in Production', () => {
    beforeEach(() => {
      window.YT = {
        Player: vi.fn().mockImplementation(() => ({
          playVideo: vi.fn(),
          pauseVideo: vi.fn(),
          seekTo: vi.fn(),
          getCurrentTime: vi.fn().mockReturnValue(0),
          getDuration: vi.fn().mockReturnValue(180),
          destroy: vi.fn(),
        })) as unknown as NonNullable<typeof window.YT>['Player'],
        PlayerState: {
          ENDED: 0,
          PLAYING: 1,
          PAUSED: 2,
          BUFFERING: 3,
          CUED: 5,
        },
      };
    });

    it('never receives Google Drive top-crop CSS and always enables popup blocking', () => {
      render(
        <YouTubePlayer
          videoId="dQw4w9WgXcQ"
          title="محاضرة أنظمة التحكم الآلي"
        />
      );

      const container = screen.getByTestId('youtube-player-container');
      expect(container).toHaveAttribute('data-crop-pixels', '0');
      expect(container).toHaveAttribute('data-popup-blocking', 'enabled');

      // Top-crop wrapper must NOT exist for YouTube
      expect(screen.queryByTestId('drive-top-crop-wrapper')).not.toBeInTheDocument();
    });

    it('ignores stale metadata or prop overrides and enforces 0px + popup blocking', () => {
      render(
        <YouTubePlayer
          videoId="dQw4w9WgXcQ"
          title="محاضرة يوتيوب سابقة"
          embedPolicy={{ cropTopPixels: 45, blockPopups: false }}
          blockPopups={false}
        />
      );

      const container = screen.getByTestId('youtube-player-container');
      expect(container).toHaveAttribute('data-crop-pixels', '0');
      expect(container).toHaveAttribute('data-popup-blocking', 'enabled');
    });

    it('does NOT expose provider badges, external links, or experiment overlays to trainees', () => {
      render(
        <YouTubePlayer
          videoId="dQw4w9WgXcQ"
          title="محاضرة صيانة السكة"
        />
      );

      // Provider overlay badge must NOT be present
      expect(screen.queryByText(/محاضرة عبر YouTube المعتمد/)).not.toBeInTheDocument();

      // Custom pop-out link must NOT be present
      expect(screen.queryByTestId('open-youtube-external-link')).not.toBeInTheDocument();

      // Experiment labels must NOT be present
      expect(screen.queryByText(/تجربة/)).not.toBeInTheDocument();

      // Explicit confirmation notice must NOT be present in YouTube
      expect(screen.queryByText(/توثيق مشاهدة الدرس/)).not.toBeInTheDocument();
      expect(screen.queryByText(/يتطلب إتمام هذا الدرس تأكيدك الصريح/)).not.toBeInTheDocument();

      // Neutral player aria-label
      const container = screen.getByTestId('youtube-player-container');
      expect(container).toHaveAttribute('aria-label', 'مشغل الفيديو: محاضرة صيانة السكة');
    });

    it('does NOT automatically mark lesson complete merely upon mount and preserves progress telemetry', async () => {
      const handleComplete = vi.fn();
      render(
        <YouTubePlayer
          videoId="dQw4w9WgXcQ"
          itemId="YT_ITEM_99"
          title="محاضرة بدون إكمال فوري"
          isCompleted={false}
          onComplete={handleComplete}
        />
      );

      await screen.findByTestId('youtube-iframe');

      // Confirmation notice must NOT be present
      expect(screen.queryByText(/توثيق مشاهدة الدرس/)).not.toBeInTheDocument();
      expect(screen.queryByText(/يتطلب إتمام هذا الدرس تأكيدك الصريح/)).not.toBeInTheDocument();

      // onComplete must NOT be called merely because component mounted
      expect(handleComplete).not.toHaveBeenCalled();
    });

    it('pre-creates iframe with mandatory sandbox applied before initial content load, strictly blocking popups and top navigation', async () => {
      render(
        <YouTubePlayer
          videoId="dQw4w9WgXcQ"
          title="محاضرة هندسة الإشارات"
        />
      );

      const iframe = await screen.findByTestId('youtube-iframe');
      expect(iframe).toBeInTheDocument();

      // Mandatory sandbox attribute present from initial mount
      const sandboxAttr = iframe.getAttribute('sandbox');
      expect(sandboxAttr).toBeDefined();

      // Core baseline execution tokens preserved
      expect(sandboxAttr).toContain('allow-scripts');
      expect(sandboxAttr).toContain('allow-same-origin');
      expect(sandboxAttr).toContain('allow-presentation');
      expect(sandboxAttr).toContain('allow-forms');

      // Popups and popouts strictly blocked (no new tab/window creation)
      expect(sandboxAttr).not.toContain('allow-popups');
      expect(sandboxAttr).not.toContain('allow-popups-to-escape-sandbox');

      // Top-level navigation strictly blocked (iframe cannot hijack top window)
      expect(sandboxAttr).not.toContain('allow-top-navigation');
      expect(sandboxAttr).not.toContain('allow-top-navigation-by-user-activation');

      // Embed URL configured for API handshake
      expect(iframe.getAttribute('src')).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(iframe.getAttribute('src')).toContain('enablejsapi=1');
    });

    it('restricts floating/pop-out player mode by strictly omitting picture-in-picture while preserving playback and fullscreen capabilities', async () => {
      render(
        <YouTubePlayer
          videoId="dQw4w9WgXcQ"
          title="محاضرة إلكترونيات الطاقة"
        />
      );

      const iframe = await screen.findByTestId('youtube-iframe');

      // Permissions policy strictly omits picture-in-picture
      const allowAttr = iframe.getAttribute('allow') || '';
      expect(allowAttr).not.toContain('picture-in-picture');

      // Critical playback and sensor capabilities are preserved
      expect(allowAttr).toContain('autoplay');
      expect(allowAttr).toContain('encrypted-media');
      expect(allowAttr).toContain('accelerometer');
      expect(allowAttr).toContain('gyroscope');

      // Standard fullscreen capabilities are preserved
      expect(iframe).toHaveAttribute('allowfullscreen');
    });

    it('enforces pre-navigation sandbox and strips picture-in-picture on historical items with stale or permissive metadata', async () => {
      render(
        <YouTubePlayer
          videoId="HISTORICAL_ID"
          title="درس قديم بإعدادات ملغاة"
          embedPolicy={{ cropTopPixels: 80, blockPopups: false }}
          cropTopPixels={80}
          blockPopups={false}
        />
      );

      const iframe = await screen.findByTestId('youtube-iframe');

      // Even with stale props attempting to disable blocking, mandatory platform policy takes precedence
      expect(iframe.getAttribute('sandbox')).not.toContain('allow-popups');
      expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation');
      expect(iframe.getAttribute('allow')).not.toContain('picture-in-picture');

      const container = screen.getByTestId('youtube-player-container');
      expect(container).toHaveAttribute('data-crop-pixels', '0');
      expect(container).toHaveAttribute('data-popup-blocking', 'enabled');
    });
  });
});

describe('Course Builder Administrator UI - Clean Experience without Technical Exposure', () => {
  it('does NOT expose technical crop controls or popup blocking toggles in the administrator UI', () => {
    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="الفصل الأول: أنظمة الإشارات"
        item={null}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // Switch to Google Drive source
    fireEvent.click(screen.getByTestId('video-source-drive'));

    // Technical policy section MUST be absent
    expect(screen.queryByTestId('drive-embed-policy-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drive-crop-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drive-crop-preset-50-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drive-crop-preset-0-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drive-block-popups-toggle')).not.toBeInTheDocument();
    expect(screen.queryByText(/اقتطاع الشريط العلوي/)).not.toBeInTheDocument();

    // Switch to YouTube source
    fireEvent.click(screen.getByTestId('video-source-youtube'));

    // YouTube technical policy section MUST be absent
    expect(screen.queryByTestId('youtube-embed-policy-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('youtube-block-popups-toggle')).not.toBeInTheDocument();
  });

  it('automatically applies mandatory platform policy when administrator saves a Google Drive video', () => {
    const handleSave = vi.fn();

    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="الفصل الأول"
        item={null}
        onClose={() => {}}
        onSave={handleSave}
      />
    );

    // Enter title & Drive URL
    fireEvent.change(screen.getByTestId('item-title-input'), {
      target: { value: 'درس إشارات مترو القاهرة' },
    });

    fireEvent.click(screen.getByTestId('video-source-drive'));
    fireEvent.change(screen.getByTestId('drive-url-input'), {
      target: {
        value: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
      },
    });

    fireEvent.click(screen.getByTestId('item-save-btn'));

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedItem: ChapterItem = handleSave.mock.calls[0][0];
    expect(savedItem.videoSourceType).toBe('drive');
    // Mandatory policy automatically attached
    expect(savedItem.embedPolicy).toEqual({
      cropTopPixels: 55,
      blockPopups: true,
    });
  });

  it('automatically applies mandatory platform policy when administrator saves a YouTube video', () => {
    const handleSave = vi.fn();

    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="الفصل الأول"
        item={null}
        onClose={() => {}}
        onSave={handleSave}
      />
    );

    fireEvent.change(screen.getByTestId('item-title-input'), {
      target: { value: 'محاضرة صيانة السكة' },
    });

    fireEvent.click(screen.getByTestId('video-source-youtube'));
    fireEvent.change(screen.getByTestId('youtube-url-input'), {
      target: {
        value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    });

    fireEvent.click(screen.getByTestId('item-save-btn'));

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedItem: ChapterItem = handleSave.mock.calls[0][0];
    expect(savedItem.videoSourceType).toBe('youtube');
    // Mandatory policy automatically attached (0px crop, popup blocking enabled)
    expect(savedItem.embedPolicy).toEqual({
      cropTopPixels: 0,
      blockPopups: true,
    });
  });

  it('automatically detects Google Drive provider when pasting Drive URL into YouTube field', () => {
    const handleSave = vi.fn();

    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="الفصل الأول"
        item={null}
        onClose={() => {}}
        onSave={handleSave}
      />
    );

    fireEvent.change(screen.getByTestId('item-title-input'), {
      target: { value: 'درس اختبار الكشف التلقائي' },
    });

    // Start on YouTube
    fireEvent.click(screen.getByTestId('video-source-youtube'));

    // Admin pastes a Google Drive URL
    fireEvent.change(screen.getByTestId('youtube-url-input'), {
      target: {
        value: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view',
      },
    });

    // Submitting applies detected Drive provider and mandatory policy
    fireEvent.click(screen.getByTestId('item-save-btn'));

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedItem: ChapterItem = handleSave.mock.calls[0][0];
    expect(savedItem.videoSourceType).toBe('drive');
    expect(savedItem.driveFileId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    expect(savedItem.embedPolicy).toEqual({
      cropTopPixels: 55,
      blockPopups: true,
    });
  });

  it('normalizes existing items with stale custom settings to mandatory policies without UI exposure', () => {
    const handleSave = vi.fn();
    const existingStaleItem: ChapterItem = {
      id: 'item-stale-custom',
      title: 'درس قديم بإعدادات ملغاة',
      type: 'video',
      videoSourceType: 'drive',
      driveFileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      embedPolicy: {
        cropTopPixels: 85,
        blockPopups: false,
      },
    };

    render(
      <ItemEditorModal
        isOpen={true}
        chapterTitle="الفصل الأول"
        item={existingStaleItem}
        onClose={() => {}}
        onSave={handleSave}
      />
    );

    // Stale controls must NOT appear even when editing existing item
    expect(screen.queryByTestId('drive-embed-policy-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drive-crop-input')).not.toBeInTheDocument();

    // Saving normalizes to mandatory policy
    fireEvent.click(screen.getByTestId('item-save-btn'));

    const savedItem: ChapterItem = handleSave.mock.calls[0][0];
    expect(savedItem.embedPolicy).toEqual({
      cropTopPixels: 55,
      blockPopups: true,
    });
  });
});

describe('Design Lab Isolation & Intact Experimental Setup', () => {
  it('preserves all 6 Design Lab comparison modes and experimental controls intact', () => {
    render(<VideoInteractionLab />);

    // Check all 6 mode selector tabs exist
    expect(screen.getByTestId('tab-mode-normal')).toBeInTheDocument();
    expect(screen.getByTestId('tab-mode-interaction-layer')).toBeInTheDocument();
    expect(screen.getByTestId('tab-mode-css-mask')).toBeInTheDocument();
    expect(screen.getByTestId('tab-mode-sandbox')).toBeInTheDocument();
    expect(screen.getByTestId('tab-mode-html5-video')).toBeInTheDocument();
    expect(screen.getByTestId('tab-mode-gdrive-top-crop')).toBeInTheDocument();

    // Switch to Mode 6: Google Drive Top Crop
    fireEvent.click(screen.getByTestId('tab-mode-gdrive-top-crop'));

    // Mode 6 experimental controls must remain fully interactive in Design Lab
    expect(screen.getByTestId('gdrive-crop-controls-panel')).toBeInTheDocument();
    expect(screen.getByTestId('crop-pixels-slider')).toBeInTheDocument();
    expect(screen.getByTestId('block-popups-toggle')).toBeInTheDocument();

    // Architectural assessment report remains intact
    expect(screen.getByTestId('diagnostic-assessment-card')).toBeInTheDocument();
  });
});
