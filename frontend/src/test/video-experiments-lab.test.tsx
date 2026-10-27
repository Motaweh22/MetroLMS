import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  extractYouTubeVideoId,
  extractGoogleDriveFileId,
  isDirectMediaUrl,
  parseVideoSourceUrl,
} from '../features/design-lab/utils/sourceUrlParser';
import { VideoInteractionLab } from '../features/design-lab/components/VideoInteractionLab';

describe('Design Lab — External Video Interaction Experiments', () => {
  describe('1. Source URL Parser & Security Verification', () => {
    it('correctly extracts YouTube IDs from standard, short, and embed formats', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=M7lc1UVf-VE')).toBe('M7lc1UVf-VE');
      expect(extractYouTubeVideoId('https://youtu.be/M7lc1UVf-VE')).toBe('M7lc1UVf-VE');
      expect(extractYouTubeVideoId('https://www.youtube.com/embed/M7lc1UVf-VE')).toBe('M7lc1UVf-VE');
      expect(extractYouTubeVideoId('M7lc1UVf-VE')).toBe('M7lc1UVf-VE');
      expect(extractYouTubeVideoId('')).toBeNull();
    });

    it('correctly extracts Google Drive IDs from view, preview, and open formats', () => {
      const driveId = '1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx';
      expect(
        extractGoogleDriveFileId(`https://drive.google.com/file/d/${driveId}/view?usp=drive_link`)
      ).toBe(driveId);
      expect(
        extractGoogleDriveFileId(`https://drive.google.com/file/d/${driveId}/preview`)
      ).toBe(driveId);
      expect(
        extractGoogleDriveFileId(`https://drive.google.com/open?id=${driveId}`)
      ).toBe(driveId);
      expect(extractGoogleDriveFileId(driveId)).toBe(driveId);
      expect(extractGoogleDriveFileId('')).toBeNull();
    });

    it('identifies direct media URLs and distinguishes them from HTML webpages', () => {
      expect(isDirectMediaUrl('https://example.com/media/video.mp4')).toBe(true);
      expect(isDirectMediaUrl('https://example.com/media/video.webm')).toBe(true);
      expect(isDirectMediaUrl('/dev-media/test-video.mp4')).toBe(true);
      expect(isDirectMediaUrl('blob:http://localhost:5173/12345')).toBe(true);
      expect(isDirectMediaUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE')).toBe(false);
      expect(isDirectMediaUrl('https://drive.google.com/file/d/12345/view')).toBe(false);
    });

    it('refuses to claim HTML5 playback for YouTube and Google Drive webpage URLs', () => {
      const ytResult = parseVideoSourceUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE');
      expect(ytResult.sourceType).toBe('youtube');
      expect(ytResult.canPlayHtml5).toBe(false);
      expect(ytResult.requiresIframe).toBe(true);
      expect(ytResult.embedUrl).toContain('youtube-nocookie.com/embed/M7lc1UVf-VE');

      const driveResult = parseVideoSourceUrl(
        'https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/view'
      );
      expect(driveResult.sourceType).toBe('google-drive');
      expect(driveResult.canPlayHtml5).toBe(false);
      expect(driveResult.requiresIframe).toBe(true);
      expect(driveResult.embedUrl).toBe('https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/preview');
    });

    it('allows HTML5 playback for direct MP4 and local video sources', () => {
      const directResult = parseVideoSourceUrl('https://example.com/sample.mp4');
      expect(directResult.sourceType).toBe('direct-video');
      expect(directResult.canPlayHtml5).toBe(true);
      expect(directResult.requiresIframe).toBe(false);

      const localResult = parseVideoSourceUrl('/dev-media/test-video.mp4');
      expect(localResult.sourceType).toBe('local-video');
      expect(localResult.canPlayHtml5).toBe(true);
      expect(localResult.requiresIframe).toBe(false);
    });
  });

  describe('2. Interactive Video Interaction Lab Component', () => {
    it('renders the Design Lab experiment section and source preset buttons', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      expect(screen.getByTestId('video-interaction-lab-section')).toBeInTheDocument();
      expect(screen.getByTestId('preset-google-drive-btn')).toBeInTheDocument();
      expect(screen.getByTestId('preset-youtube-btn')).toBeInTheDocument();
      expect(screen.getByTestId('preset-direct-mp4-btn')).toBeInTheDocument();
      expect(screen.getByTestId('preset-local-baseline-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reset-experiment-btn')).toBeInTheDocument();
    });

    it('switches source presets and updates the URL and diagnosis badges', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      // Switch to YouTube preset
      const ytBtn = screen.getByTestId('preset-youtube-btn');
      fireEvent.click(ytBtn);

      const urlInput = screen.getByTestId('video-lab-url-input') as HTMLInputElement;
      expect(urlInput.value).toContain('youtube.com/watch?v=M7lc1UVf-VE');

      // Switch to Direct MP4 preset
      const mp4Btn = screen.getByTestId('preset-direct-mp4-btn');
      fireEvent.click(mp4Btn);
      expect(urlInput.value).toContain('.mp4');
    });

    it('supports replacing the current URL and applying it', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      const urlInput = screen.getByTestId('video-lab-url-input') as HTMLInputElement;
      fireEvent.change(urlInput, {
        target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      });

      const applyBtn = screen.getByTestId('apply-video-url-btn');
      fireEvent.click(applyBtn);

      expect(screen.getByTestId('experimental-iframe')).toHaveAttribute(
        'src',
        expect.stringContaining('dQw4w9WgXcQ')
      );
    });
  });

  describe('3. Comparison Modes & Experimental Approaches', () => {
    it('Mode 1 (Normal): renders standard iframe without overlays or sandbox', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      const normalTab = screen.getByTestId('tab-mode-normal');
      fireEvent.click(normalTab);

      const iframe = screen.getByTestId('experimental-iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe).not.toHaveAttribute('sandbox');
      expect(screen.queryByTestId('interaction-layer-overlay')).not.toBeInTheDocument();
      expect(screen.queryByTestId('css-mask-overlay-element')).not.toBeInTheDocument();
    });

    it('Mode 2 (Whitelisted Click-Through Interaction Layer): renders SVG blocker and passes through whitelisted openings', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      const interactionTab = screen.getByTestId('tab-mode-interaction-layer');
      fireEvent.click(interactionTab);

      expect(screen.getByTestId('interaction-layer-controls-panel')).toBeInTheDocument();
      expect(screen.getByTestId('interaction-layer-svg')).toBeInTheDocument();

      // Blocker path is rendered with evenodd fill rule
      const blockerPath = screen.getByTestId('interaction-layer-blocker-path');
      expect(blockerPath).toBeInTheDocument();
      expect(blockerPath).toHaveAttribute('fill-rule', 'evenodd');

      // Click on blocker path increments click counter
      fireEvent.click(blockerPath);
      fireEvent.click(blockerPath);
      expect(screen.getByTestId('intercepted-clicks-counter')).toHaveTextContent('2');

      // Visual guide for minimal-center region is present and has pointer-events: none
      const centerGuide = screen.getByTestId('visual-guide-reg-center-play');
      expect(centerGuide).toBeInTheDocument();
      expect(centerGuide).toHaveClass('pointer-events-none');
    });

    it('Mode 2: allows switching presets, adding, editing, and deleting regions', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('tab-mode-interaction-layer'));

      // Switch to Standard Controls preset (3 regions)
      const standardBtn = screen.getByTestId('preset-standard-controls-btn');
      fireEvent.click(standardBtn);
      expect(screen.getByTestId('region-item-reg-bottom-controls')).toBeInTheDocument();
      expect(screen.getByTestId('region-item-reg-progress-bar')).toBeInTheDocument();

      // Add a custom region
      const addBtn = screen.getByTestId('add-region-btn');
      fireEvent.click(addBtn);
      expect(screen.getAllByText(/منطقة مخصصة/).length).toBeGreaterThan(0);

      // Adjust coordinate slider on bottom controls
      const sliderW = screen.getByTestId('slider-w-reg-bottom-controls');
      fireEvent.change(sliderW, { target: { value: '80' } });

      // Delete a region
      const deleteBottomBtn = screen.getByTestId('delete-region-reg-bottom-controls');
      fireEvent.click(deleteBottomBtn);
      expect(screen.queryByTestId('region-item-reg-bottom-controls')).not.toBeInTheDocument();

      // Reset to default minimal regions
      const resetRegionsBtn = screen.getByTestId('reset-regions-default-btn');
      fireEvent.click(resetRegionsBtn);
      expect(screen.getByTestId('region-item-reg-center-play')).toBeInTheDocument();
      expect(screen.queryByTestId('region-item-reg-bottom-controls')).not.toBeInTheDocument();

      // Disabling interaction layer removes SVG overlay
      const enableBox = screen.getByTestId('interaction-layer-enable-checkbox');
      fireEvent.click(enableBox);
      expect(screen.queryByTestId('interaction-layer-svg')).not.toBeInTheDocument();
    });

    it('Mode 2 (Interaction Layer): Block Pop-up Windows toggle works independently and combined with click-through regions', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      // Switch to Mode 2
      fireEvent.click(screen.getByTestId('tab-mode-interaction-layer'));
      const iframe = screen.getByTestId('experimental-iframe');

      // 1. Off by default: Baseline unrestricted iframe (no sandbox attribute)
      expect(iframe).not.toHaveAttribute('sandbox');
      const popupToggle = screen.getByTestId('block-popups-toggle') as HTMLInputElement;
      expect(popupToggle.checked).toBe(false);

      // 2. Turn ON Block Pop-up Windows
      fireEvent.click(popupToggle);
      expect(popupToggle.checked).toBe(true);

      // Verify sandbox attribute applied with safe minimal permissions, excluding popups
      const sandboxedIframe = screen.getByTestId('experimental-iframe');
      const sandboxAttr = sandboxedIframe.getAttribute('sandbox') || '';
      expect(sandboxAttr).toContain('allow-scripts');
      expect(sandboxAttr).toContain('allow-same-origin');
      expect(sandboxAttr).toContain('allow-presentation');
      expect(sandboxAttr).toContain('allow-forms');
      expect(sandboxAttr).not.toContain('allow-popups');
      expect(sandboxAttr).not.toContain('allow-popups-to-escape-sandbox');

      // 3. Combined state: Whitelisted click-through regions + Block Pop-ups active simultaneously
      expect(screen.getByTestId('interaction-layer-svg')).toBeInTheDocument();
      expect(screen.getByTestId('region-item-reg-center-play')).toBeInTheDocument();

      // 4. Restore Baseline button unchecks toggle and clears sandbox
      const restoreBtn = screen.getByTestId('restore-baseline-sandbox-btn');
      fireEvent.click(restoreBtn);
      const baselineIframe = screen.getByTestId('experimental-iframe');
      expect(baselineIframe).not.toHaveAttribute('sandbox');
      expect((screen.getByTestId('block-popups-toggle') as HTMLInputElement).checked).toBe(false);

      // 5. Independent usage: Can be enabled even when click-through layer itself is disabled
      const enableLayerCheckbox = screen.getByTestId('interaction-layer-enable-checkbox');
      fireEvent.click(enableLayerCheckbox); // Disable click-through layer
      expect(screen.queryByTestId('interaction-layer-svg')).not.toBeInTheDocument();

      // Re-enable popup toggle
      fireEvent.click(screen.getByTestId('block-popups-toggle'));
      const popupOnlyIframe = screen.getByTestId('experimental-iframe');
      expect(popupOnlyIframe.getAttribute('sandbox')).toContain('allow-scripts');
      expect(screen.queryByTestId('interaction-layer-svg')).not.toBeInTheDocument();
    });

    it('Mode 2 (Interaction Layer): manages container-level fullscreen, preserves overlay, and handles actions and errors', async () => {
      let currentFullscreenElement: Element | null = null;
      const requestFullscreenMock = vi.fn().mockImplementation(() => {
        currentFullscreenElement = document.querySelector('[data-testid="experimental-player-viewport"]');
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => currentFullscreenElement,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      });

      const exitFullscreenMock = vi.fn().mockImplementation(() => {
        currentFullscreenElement = null;
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => null,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      });

      HTMLElement.prototype.requestFullscreen = requestFullscreenMock;
      document.exitFullscreen = exitFullscreenMock;

      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      // Switch to Mode 2 (Interaction Layer)
      fireEvent.click(screen.getByTestId('tab-mode-interaction-layer'));

      // Apply standard-controls preset which has managed fullscreen region
      fireEvent.click(screen.getByTestId('preset-standard-controls-btn'));

      // Check managed fullscreen hotspot exists
      const fsHotspot = screen.getByTestId('action-region-reg-fullscreen-action');
      expect(fsHotspot).toBeInTheDocument();

      const viewportContainer = screen.getByTestId('experimental-player-viewport');
      expect(viewportContainer).not.toHaveClass('h-screen');

      // Click the managed fullscreen hotspot
      fireEvent.click(fsHotspot);
      expect(requestFullscreenMock).toHaveBeenCalledTimes(1);

      // Verify container is now in fullscreen mode
      expect(screen.getByTestId('player-fullscreen-hud')).toBeInTheDocument();
      expect(screen.getByText(/Container Fullscreen Active/i)).toBeInTheDocument();

      // Crucial: The SVG interaction layer and visual guides MUST remain present in fullscreen!
      expect(screen.getByTestId('interaction-layer-svg')).toBeInTheDocument();
      expect(screen.getByTestId('interaction-layer-visual-guides-container')).toBeInTheDocument();

      // Crucial: The experimental iframe is NOT recreated/reloaded
      const fsIframe = screen.getByTestId('experimental-iframe');
      expect(fsIframe).toBeInTheDocument();

      // Exit fullscreen via on-player HUD button
      const exitBtn = screen.getByTestId('exit-fullscreen-btn');
      fireEvent.click(exitBtn);
      expect(exitFullscreenMock).toHaveBeenCalledTimes(1);

      // Viewport exits fullscreen
      expect(screen.queryByTestId('player-fullscreen-hud')).not.toBeInTheDocument();

      // Test Error Handling: When requestFullscreen rejects
      requestFullscreenMock.mockRejectedValueOnce(new Error('Permission denied by browser policy'));
      fireEvent.click(screen.getByTestId('managed-fullscreen-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('fullscreen-error-alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/Permission denied by browser policy/)).toBeInTheDocument();

      // Dismiss error
      fireEvent.click(screen.getByTestId('dismiss-fullscreen-error-btn'));
      expect(screen.queryByTestId('fullscreen-error-alert')).not.toBeInTheDocument();

      // Cleanup
      Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
      Reflect.deleteProperty(document, 'exitFullscreen');
    });

    it('Mode 3 (CSS Mask - Experiment A): renders adjustable mask and enforces boundary safety', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      const maskTab = screen.getByTestId('tab-mode-css-mask');
      fireEvent.click(maskTab);

      expect(screen.getByTestId('css-mask-controls-panel')).toBeInTheDocument();
      const maskEl = screen.getByTestId('css-mask-overlay-element');
      expect(maskEl).toBeInTheDocument();
      expect(maskEl).toHaveStyle({ width: '48px', height: '48px' });

      // Increase width beyond safe boundary
      const widthSlider = screen.getByTestId('mask-width-slider');
      fireEvent.change(widthSlider, { target: { value: '140' } });

      // Boundary risk warning should be visible
      expect(screen.getByTestId('mask-boundary-risk-warning')).toBeInTheDocument();

      // Check YouTube policy warning when switching to YouTube
      fireEvent.click(screen.getByTestId('preset-youtube-btn'));
      expect(screen.getByTestId('youtube-mask-policy-warning')).toBeInTheDocument();
    });

    it('Mode 4 (Sandboxed Iframe - Experiment B): applies configurable sandbox attribute and presets', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      const sandboxTab = screen.getByTestId('tab-mode-sandbox');
      fireEvent.click(sandboxTab);

      expect(screen.getByTestId('sandbox-controls-panel')).toBeInTheDocument();

      // By default least-restrictive preset includes allow-scripts and allow-popups
      const iframe = screen.getByTestId('experimental-iframe');
      expect(iframe).toHaveAttribute(
        'sandbox',
        expect.stringContaining('allow-scripts')
      );
      expect(iframe).toHaveAttribute(
        'sandbox',
        expect.stringContaining('allow-popups')
      );

      // Apply Block Popups preset
      const blockPopupsBtn = screen.getByTestId('sandbox-preset-block-popups');
      fireEvent.click(blockPopupsBtn);

      const updatedIframe = screen.getByTestId('experimental-iframe');
      expect(updatedIframe.getAttribute('sandbox')).not.toContain('allow-popups');
      expect(screen.getByTestId('sandbox-popups-blocked-info')).toBeInTheDocument();

      // Uncheck allow-scripts and verify critical breakdown warning
      const allowScriptsBox = screen.getByTestId('flag-allow-scripts');
      fireEvent.click(allowScriptsBox);
      expect(screen.getByTestId('sandbox-no-scripts-warning')).toBeInTheDocument();
    });

    it('Mode 5 (HTML5 Video Player - Experiment C): refuses webpage URLs and plays direct media', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      const html5Tab = screen.getByTestId('tab-mode-html5-video');
      fireEvent.click(html5Tab);

      expect(screen.getByTestId('html5-player-controls-panel')).toBeInTheDocument();

      // Since default is Google Drive (webpage), refusal screen is shown
      expect(screen.getByTestId('html5-refusal-screen')).toBeInTheDocument();
      expect(screen.getByTestId('html5-incompatible-warning')).toBeInTheDocument();
      expect(screen.queryByTestId('html5-native-video-element')).not.toBeInTheDocument();

      // Switch to Direct MP4
      fireEvent.click(screen.getByTestId('preset-direct-mp4-btn'));

      expect(screen.getByTestId('html5-compatible-success')).toBeInTheDocument();
      expect(screen.getByTestId('html5-native-video-element')).toBeInTheDocument();
    });

    it('Reset button restores normal mode, default Drive URL, and default settings', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      // Switch to sandbox mode and YouTube
      fireEvent.click(screen.getByTestId('tab-mode-sandbox'));
      fireEvent.click(screen.getByTestId('preset-youtube-btn'));

      // Click Reset
      const resetBtn = screen.getByTestId('reset-experiment-btn');
      fireEvent.click(resetBtn);

      // Verify restored to normal mode and Google Drive
      expect(screen.getByTestId('tab-mode-normal')).toHaveClass('bg-primary');
      const urlInput = screen.getByTestId('video-lab-url-input') as HTMLInputElement;
      expect(urlInput.value).toContain('drive.google.com');
      const iframe = screen.getByTestId('experimental-iframe');
      expect(iframe).not.toHaveAttribute('sandbox');
    });

    it('Mode 6 (Google Drive Top Crop): renders isolated experiment separate from Interaction Layer and verifies top-crop CSS technique', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      // 1. Switch to Mode 6 (Google Drive — Top Crop + Popup Blocking)
      const topCropTab = screen.getByTestId('tab-mode-gdrive-top-crop');
      fireEvent.click(topCropTab);

      // Verify Mode 6 controls panel is active
      expect(screen.getByTestId('gdrive-crop-controls-panel')).toBeInTheDocument();
      // Crucial: Must be separate from Interaction Layer - no interaction layer controls or overlay
      expect(screen.queryByTestId('interaction-layer-controls-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('interaction-layer-svg')).not.toBeInTheDocument();

      // Verify wrapper and iframe elements exist
      const wrapper = screen.getByTestId('gdrive-top-crop-wrapper');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toHaveClass('gdrive-top-crop-wrapper');

      const iframe = screen.getByTestId('gdrive-top-crop-iframe');
      expect(iframe).toBeInTheDocument();

      // Default crop amount is 50px
      const cropInput = screen.getByTestId('crop-pixels-input') as HTMLInputElement;
      const cropSlider = screen.getByTestId('crop-pixels-slider') as HTMLInputElement;
      expect(cropInput.value).toBe('50');
      expect(cropSlider.value).toBe('50');

      // Styles applied to iframe
      expect(iframe.style.height).toBe('calc(100% + 50px)');
      expect(iframe.style.marginTop).toBe('-50px');
      expect(iframe.style.position).toBe('absolute');

      // 2. Crop amount is configurable: change slider to 65px
      fireEvent.change(cropSlider, { target: { value: '65' } });
      expect(cropInput.value).toBe('65');
      expect(iframe.style.height).toBe('calc(100% + 65px)');
      expect(iframe.style.marginTop).toBe('-65px');

      // Presets work
      fireEvent.click(screen.getByTestId('crop-preset-40-btn'));
      expect(cropInput.value).toBe('40');
      expect(iframe.style.marginTop).toBe('-40px');

      fireEvent.click(screen.getByTestId('crop-preset-60-btn'));
      expect(cropInput.value).toBe('60');
      expect(iframe.style.marginTop).toBe('-60px');

      fireEvent.click(screen.getByTestId('crop-preset-0-btn'));
      expect(cropInput.value).toBe('0');
      expect(iframe.style.marginTop).toBe('0px');

      // Reset crop to default 50px
      fireEvent.click(screen.getByTestId('reset-crop-pixels-btn'));
      expect(cropInput.value).toBe('50');
      expect(iframe.style.marginTop).toBe('-50px');
    });

    it('Mode 6: popup blocking defaults to ON, derives sandbox tokens from baseline without popups, and can restore baseline', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('tab-mode-gdrive-top-crop'));

      const iframe = screen.getByTestId('gdrive-top-crop-iframe');
      const toggle = screen.getByTestId('block-popups-toggle') as HTMLInputElement;

      // Popup blocking defaults to ON for Mode 6
      expect(toggle.checked).toBe(true);

      // Effective sandbox attribute removes allow-popups and allow-popups-to-escape-sandbox while preserving all other tokens
      const sandboxAttr = iframe.getAttribute('sandbox');
      expect(sandboxAttr).not.toBeNull();
      expect(sandboxAttr).toContain('allow-scripts');
      expect(sandboxAttr).toContain('allow-same-origin');
      expect(sandboxAttr).toContain('allow-presentation');
      expect(sandboxAttr).toContain('allow-forms');
      expect(sandboxAttr).not.toContain('allow-popups');
      expect(sandboxAttr).not.toContain('allow-popups-to-escape-sandbox');

      // Turn popup blocking OFF via toggle
      fireEvent.click(toggle);
      expect(toggle.checked).toBe(false);
      const unconstrainedIframe = screen.getByTestId('gdrive-top-crop-iframe');
      expect(unconstrainedIframe).not.toHaveAttribute('sandbox');

      // Re-enable and restore baseline via button
      fireEvent.click(toggle);
      expect(toggle.checked).toBe(true);
      const reblockedIframe = screen.getByTestId('gdrive-top-crop-iframe');
      expect(reblockedIframe).toHaveAttribute('sandbox');

      const restoreBtn = screen.getByTestId('restore-baseline-sandbox-btn');
      fireEvent.click(restoreBtn);
      expect(toggle.checked).toBe(false);
      const restoredBaselineIframe = screen.getByTestId('gdrive-top-crop-iframe');
      expect(restoredBaselineIframe).not.toHaveAttribute('sandbox');
    });

    it('Mode 6: warns when active source is not Google Drive and provides quick switch', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('tab-mode-gdrive-top-crop'));
      // Initially on Google Drive: no mismatch warning
      expect(screen.queryByTestId('crop-source-mismatch-banner')).not.toBeInTheDocument();

      // Switch to YouTube preset
      fireEvent.click(screen.getByTestId('preset-youtube-btn'));
      expect(screen.getByTestId('crop-source-mismatch-banner')).toBeInTheDocument();

      // Click quick switch back to Google Drive
      fireEvent.click(screen.getByTestId('switch-to-drive-preset-btn'));
      expect(screen.queryByTestId('crop-source-mismatch-banner')).not.toBeInTheDocument();
      expect(screen.getByTestId('gdrive-top-crop-iframe')).toBeInTheDocument();
    });

    it('Mode 6: preserves crop settings across container fullscreen transitions without resetting or remounting', async () => {
      let currentFullscreenElement: Element | null = null;
      const requestFullscreenMock = vi.fn().mockImplementation(() => {
        currentFullscreenElement = document.querySelector('[data-testid="experimental-player-viewport"]');
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => currentFullscreenElement,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      });

      const exitFullscreenMock = vi.fn().mockImplementation(() => {
        currentFullscreenElement = null;
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => null,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      });

      HTMLElement.prototype.requestFullscreen = requestFullscreenMock;
      document.exitFullscreen = exitFullscreenMock;

      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('tab-mode-gdrive-top-crop'));

      // Adjust crop to 58px
      const cropSlider = screen.getByTestId('crop-pixels-slider');
      fireEvent.change(cropSlider, { target: { value: '58' } });

      const iframeBefore = screen.getByTestId('gdrive-top-crop-iframe');
      expect(iframeBefore.style.marginTop).toBe('-58px');

      // Enter container fullscreen
      fireEvent.click(screen.getByTestId('managed-fullscreen-btn'));
      expect(requestFullscreenMock).toHaveBeenCalledTimes(1);

      // Verify fullscreen HUD shows crop value
      expect(screen.getByTestId('player-fullscreen-hud')).toBeInTheDocument();
      expect(screen.getByTestId('fs-hud-crop-value')).toHaveTextContent('58px');
      expect(screen.getByTestId('fs-hud-crop-popups-badge')).toBeInTheDocument();

      // Verify iframe remains cropped in fullscreen
      const iframeInFs = screen.getByTestId('gdrive-top-crop-iframe');
      expect(iframeInFs.style.marginTop).toBe('-58px');
      expect(iframeInFs.style.height).toBe('calc(100% + 58px)');

      // Exit fullscreen
      fireEvent.click(screen.getByTestId('exit-fullscreen-btn'));
      expect(exitFullscreenMock).toHaveBeenCalledTimes(1);

      // Crop remains 58px after exit
      const iframeAfter = screen.getByTestId('gdrive-top-crop-iframe');
      expect(iframeAfter.style.marginTop).toBe('-58px');
      const cropInputAfter = screen.getByTestId('crop-pixels-input') as HTMLInputElement;
      expect(cropInputAfter.value).toBe('58');

      // Cleanup
      Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
      Reflect.deleteProperty(document, 'exitFullscreen');
    });

    it('Mode 6 and Mode 2 maintain completely independent configurations and presets', () => {
      render(
        <MemoryRouter>
          <VideoInteractionLab />
        </MemoryRouter>
      );

      // 1. Configure Mode 2 (Interaction Layer)
      fireEvent.click(screen.getByTestId('tab-mode-interaction-layer'));
      const mode2Toggle = screen.getByTestId('block-popups-toggle') as HTMLInputElement;
      expect(mode2Toggle.checked).toBe(false); // Mode 2 defaults to OFF
      fireEvent.click(mode2Toggle); // Turn Mode 2 ON
      expect(mode2Toggle.checked).toBe(true);

      // 2. Switch to Mode 6
      fireEvent.click(screen.getByTestId('tab-mode-gdrive-top-crop'));
      const mode6Toggle = screen.getByTestId('block-popups-toggle') as HTMLInputElement;
      expect(mode6Toggle.checked).toBe(true); // Mode 6 defaults to ON
      // Configure Mode 6: turn popup blocking OFF and change crop to 72px
      fireEvent.click(mode6Toggle);
      expect(mode6Toggle.checked).toBe(false);
      fireEvent.change(screen.getByTestId('crop-pixels-slider'), { target: { value: '72' } });

      // 3. Switch back to Mode 2: verify Mode 2 settings were preserved
      fireEvent.click(screen.getByTestId('tab-mode-interaction-layer'));
      const mode2ToggleRestored = screen.getByTestId('block-popups-toggle') as HTMLInputElement;
      expect(mode2ToggleRestored.checked).toBe(true); // Still ON!

      // 4. Switch back to Mode 6: verify Mode 6 settings were preserved
      fireEvent.click(screen.getByTestId('tab-mode-gdrive-top-crop'));
      const mode6ToggleRestored = screen.getByTestId('block-popups-toggle') as HTMLInputElement;
      expect(mode6ToggleRestored.checked).toBe(false); // Still OFF!
      const cropInputRestored = screen.getByTestId('crop-pixels-input') as HTMLInputElement;
      expect(cropInputRestored.value).toBe('72'); // Still 72!
    });
  });
});
