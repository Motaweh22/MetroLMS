import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import {
  LAB_PRESET_SOURCES,
  parseVideoSourceUrl,
} from '../utils/sourceUrlParser';
import type {
  VideoSourceType,
  ExperimentMode,
  CssMaskConfig,
  SandboxConfig,
  InteractionLayerConfig,
  ClickThroughRegion,
  SourceParseResult,
  GDriveCropConfig,
} from '../types/videoLabTypes';
import {
  DEFAULT_INTERACTION_LAYER,
  INTERACTION_PRESETS,
  DEFAULT_GDRIVE_CROP,
} from '../types/videoLabTypes';
import { CssMaskControls } from './CssMaskControls';
import { SandboxControls } from './SandboxControls';
import { Html5PlayerControls } from './Html5PlayerControls';
import { InteractionLayerControls } from './InteractionLayerControls';
import { GDriveCropControls } from './GDriveCropControls';
import {
  deriveEffectiveSandbox,
  getTopCropIframeStyle,
} from '@/core/courses/videoEmbedPolicy';

const DEFAULT_CSS_MASK: CssMaskConfig = {
  enabled: true,
  width: 48,
  height: 48,
  top: 10,
  right: 12,
  opacity: 0.95,
  color: '#0f172a', // Slate-900
  label: 'حظر الفتح الخارجي',
  simulatedControlOnLocal: true,
};

const DEFAULT_SANDBOX: SandboxConfig = {
  preset: 'least-restrictive',
  allowScripts: true,
  allowSameOrigin: true,
  allowPopups: true,
  allowPopupsToEscapeSandbox: true,
  allowForms: true,
  allowPresentation: true,
};

export const VideoInteractionLab: React.FC = () => {
  // Source State
  const [activeSourceType, setActiveSourceType] = useState<VideoSourceType>('google-drive');
  const [inputUrl, setInputUrl] = useState<string>(LAB_PRESET_SOURCES.googleDrive.url);
  const [appliedUrl, setAppliedUrl] = useState<string>(LAB_PRESET_SOURCES.googleDrive.url);
  const [isUrlApplied, setIsUrlApplied] = useState<boolean>(true);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active Mode State
  const [activeMode, setActiveMode] = useState<ExperimentMode>('normal');

  // Mode Configurations
  const [cssMaskConfig, setCssMaskConfig] = useState<CssMaskConfig>(DEFAULT_CSS_MASK);
  const [sandboxConfig, setSandboxConfig] = useState<SandboxConfig>(DEFAULT_SANDBOX);
  const [interactionLayerConfig, setInteractionLayerConfig] =
    useState<InteractionLayerConfig>(DEFAULT_INTERACTION_LAYER);
  const [gdriveCropConfig, setGDriveCropConfig] =
    useState<GDriveCropConfig>(DEFAULT_GDRIVE_CROP);

  // Parse result derived from applied URL
  const parsedSource: SourceParseResult = useMemo(() => {
    return parseVideoSourceUrl(appliedUrl, activeSourceType);
  }, [appliedUrl, activeSourceType]);

  // Track simulated local control click
  const [simulatedClickSuccess, setSimulatedClickSuccess] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fullscreen container ref & state
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Listen to browser fullscreen changes & window resize
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentFs =
        typeof document !== 'undefined' &&
        document.fullscreenElement === playerContainerRef.current;
      setIsFullscreen(isCurrentFs);
      if (playerContainerRef.current) {
        const rect = playerContainerRef.current.getBoundingClientRect();
        setContainerDimensions({ width: rect.width, height: rect.height });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && playerContainerRef.current) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      observer.observe(playerContainerRef.current);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      if (observer) observer.disconnect();
    };
  }, []);

  const handleRequestFullscreen = async () => {
    setFullscreenError(null);
    const container = playerContainerRef.current;
    if (!container) return;
    try {
      const containerWithWebkit = container as HTMLDivElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (containerWithWebkit.webkitRequestFullscreen) {
        await containerWithWebkit.webkitRequestFullscreen();
      } else {
        throw new Error('خاصية ملء الشاشة (Fullscreen API) غير مدعومة في بيئة العرض الحالية.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تم رفض طلب ملء الشاشة من المتصفح.';
      setFullscreenError(`تعذر الانتقال إلى ملء الشاشة للحاوية: ${msg}`);
    }
  };

  const handleExitFullscreen = async () => {
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error exiting fullscreen:', err);
    }
  };

  const handleToggleFullscreen = () => {
    if (isFullscreen) {
      handleExitFullscreen();
    } else {
      handleRequestFullscreen();
    }
  };

  // Reset load states on applied URL change
  useEffect(() => {
    setHasLoaded(false);
    setLoadError(null);
  }, [appliedUrl, activeMode]);

  // Compute sandbox attribute string for sandbox mode
  const sandboxString = useMemo(() => {
    const flags: string[] = [];
    if (sandboxConfig.allowScripts) flags.push('allow-scripts');
    if (sandboxConfig.allowSameOrigin) flags.push('allow-same-origin');
    if (sandboxConfig.allowPopups) flags.push('allow-popups');
    if (sandboxConfig.allowPopupsToEscapeSandbox) flags.push('allow-popups-to-escape-sandbox');
    if (sandboxConfig.allowForms) flags.push('allow-forms');
    if (sandboxConfig.allowPresentation) flags.push('allow-presentation');
    return flags.join(' ');
  }, [sandboxConfig]);

  // Compute effective sandbox for the iframe across modes
  const effectiveIframeSandbox = useMemo(() => {
    if (activeMode === 'sandbox') {
      return sandboxString;
    }
    if (activeMode === 'interaction-layer' && interactionLayerConfig.blockPopups) {
      return deriveEffectiveSandbox(true);
    }
    if (activeMode === 'gdrive-top-crop' && gdriveCropConfig.blockPopups) {
      return deriveEffectiveSandbox(true);
    }
    return undefined;
  }, [activeMode, sandboxString, interactionLayerConfig.blockPopups, gdriveCropConfig.blockPopups]);

  // Compute SVG cutout path string with fillRule="evenodd"
  // Outer rectangle: 0 0 -> 100 0 -> 100 100 -> 0 100
  // Each enabled region with action !== 'fullscreen' is a hole punched into the path
  const cutoutPathD = useMemo(() => {
    let d = 'M 0 0 L 100 0 L 100 100 L 0 100 Z ';
    const passThroughRegions = interactionLayerConfig.regions.filter(
      (r) => r.enabled && r.action !== 'fullscreen' && r.type !== 'fullscreen'
    );
    for (const r of passThroughRegions) {
      const x1 = Math.max(0, Math.min(100, r.x));
      const y1 = Math.max(0, Math.min(100, r.y));
      const x2 = Math.max(0, Math.min(100, r.x + r.width));
      const y2 = Math.max(0, Math.min(100, r.y + r.height));
      d += `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2} L ${x1} ${y2} Z `;
    }
    return d;
  }, [interactionLayerConfig.regions]);

  // Handle URL change & Apply action
  const handleApplyUrl = () => {
    setAppliedUrl(inputUrl.trim());
    setIsUrlApplied(true);
  };

  const handleSelectPreset = (sourceKey: keyof typeof LAB_PRESET_SOURCES) => {
    const preset = LAB_PRESET_SOURCES[sourceKey];
    setActiveSourceType(preset.sourceType);
    setInputUrl(preset.url);
    setAppliedUrl(preset.url);
    setIsUrlApplied(true);
  };

  // Reset full experiment to default state
  const handleResetExperiment = () => {
    if (isFullscreen) {
      handleExitFullscreen();
    }
    setActiveMode('normal');
    setActiveSourceType('google-drive');
    setInputUrl(LAB_PRESET_SOURCES.googleDrive.url);
    setAppliedUrl(LAB_PRESET_SOURCES.googleDrive.url);
    setIsUrlApplied(true);
    setCssMaskConfig(DEFAULT_CSS_MASK);
    setSandboxConfig(DEFAULT_SANDBOX);
    setInteractionLayerConfig({
      ...DEFAULT_INTERACTION_LAYER,
      regions: INTERACTION_PRESETS['minimal-center'].map((r) => ({ ...r })),
    });
    setGDriveCropConfig(DEFAULT_GDRIVE_CROP);
    setHasLoaded(false);
    setLoadError(null);
    setFullscreenError(null);
  };

  const handleCustomLocalFile = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    setActiveSourceType('local-video');
    setInputUrl(blobUrl);
    setAppliedUrl(blobUrl);
    setIsUrlApplied(true);
  };

  // Render Click-Through Overlay elements (used over both iframe and video)
  const renderWhitelistedInteractionLayer = () => {
    if (activeMode !== 'interaction-layer' || !interactionLayerConfig.enabled) {
      return null;
    }

    const enabledRegions: ClickThroughRegion[] = interactionLayerConfig.regions.filter(
      (r) => r.enabled
    );

    const managedFullscreenRegions = enabledRegions.filter(
      (r) => r.action === 'fullscreen' || r.type === 'fullscreen'
    );

    return (
      <>
        {/* The SVG Blocker Layer: Blocks clicks everywhere EXCEPT in the cut-out regions */}
        <svg
          className="absolute inset-0 w-full h-full z-20"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ pointerEvents: 'none' }}
          data-testid="interaction-layer-svg"
          aria-hidden="true"
        >
          <path
            d={cutoutPathD}
            fillRule="evenodd"
            fill={
              interactionLayerConfig.showBlockedAreasTint
                ? 'rgba(15, 23, 42, 0.45)'
                : 'rgba(0, 0, 0, 0.001)'
            }
            style={{ pointerEvents: 'auto', cursor: 'not-allowed' }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInteractionLayerConfig((prev) => ({
                ...prev,
                interceptClickCount: prev.interceptClickCount + 1,
              }));
            }}
            data-testid="interaction-layer-blocker-path"
          />
        </svg>

        {/* Managed Fullscreen Action Interactive Hotspots (pointer-events: auto, z-25) */}
        {managedFullscreenRegions.map((region) => (
          <button
            key={`action-${region.id}`}
            type="button"
            style={{
              left: `${region.x}%`,
              top: `${region.y}%`,
              width: `${region.width}%`,
              height: `${region.height}%`,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleFullscreen();
            }}
            className="absolute z-25 pointer-events-auto cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/80 rounded bg-transparent"
            title="إجراء مدار: النقر هنا يطلب ملء الشاشة للحاوية الخارجية دون تسريب النقر للمشغل الأصلي"
            data-testid={`action-region-${region.id}`}
          />
        ))}

        {/* Visual Simulation Guides */}
        {interactionLayerConfig.showVisualGuide && (
          <div
            className="absolute inset-0 w-full h-full z-25 pointer-events-none select-none"
            data-testid="interaction-layer-visual-guides-container"
          >
            {enabledRegions.map((region) => {
              const isFsAction = region.action === 'fullscreen' || region.type === 'fullscreen';
              return (
                <div
                  key={region.id}
                  style={{
                    left: `${region.x}%`,
                    top: `${region.y}%`,
                    width: `${region.width}%`,
                    height: `${region.height}%`,
                  }}
                  className={`absolute pointer-events-none border-2 border-dashed ${
                    isFsAction
                      ? 'border-cyan-400 bg-cyan-500/15 shadow-cyan-500/20'
                      : 'border-emerald-400 bg-emerald-500/10'
                  } rounded-lg flex flex-col justify-between p-1.5 transition-all shadow-sm`}
                  data-testid={`visual-guide-${region.id}`}
                >
                  {/* Region Tag */}
                  <div
                    className={`flex items-center justify-between text-[10px] ${
                      isFsAction
                        ? 'text-cyan-300 bg-cyan-950/85 border border-cyan-500/30'
                        : 'text-emerald-300 bg-emerald-950/85 border border-emerald-500/30'
                    } px-2 py-0.5 rounded backdrop-blur-sm self-start`}
                  >
                    <span className="flex items-center gap-1">
                      <Icon
                        name={isFsAction ? 'maximize' : 'checkCircle'}
                        size="sm"
                        className={isFsAction ? 'text-cyan-400' : 'text-emerald-400'}
                      />
                      <span>{isFsAction ? `إجراء مدار: ${region.name}` : `منفذ تصريح: ${region.name}`}</span>
                    </span>
                  </div>

                  {/* Simulated Graphic based on region type */}
                  {region.type === 'center-play' && (
                    <div className="flex flex-col items-center justify-center my-auto text-white/70">
                      <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center border border-white/30 shadow-lg">
                        <Icon name="play" size="lg" className="translate-x-0.5" />
                      </div>
                      <span className="text-[10px] font-mono mt-1 bg-black/70 px-2 py-0.5 rounded text-slate-200">
                        محاكاة: النقر يمر للمشغل الأصلي
                      </span>
                    </div>
                  )}

                  {region.type === 'bottom-controls' && (
                    <div className="flex items-center justify-between px-3 py-1 bg-black/75 rounded border border-white/10 text-white/80 text-[11px] mt-auto">
                      <div className="flex items-center gap-2">
                        <Icon name="play" size="sm" />
                        <Icon name="volume" size="sm" />
                        <span className="font-mono text-[10px] text-slate-300">0:00 / 3:45</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-300 font-bold">شريط أزرار نافذ</span>
                      </div>
                    </div>
                  )}

                  {isFsAction && (
                    <div className="flex flex-col items-center justify-center my-auto text-cyan-200">
                      <Icon name="maximize" size="md" className="animate-pulse" />
                      <span className="text-[9px] font-mono mt-0.5 bg-black/80 px-1 rounded text-cyan-300">
                        اعتراض النقر &larr; ملء شاشة الحاوية
                      </span>
                    </div>
                  )}

                  {region.type === 'progress-bar' && (
                    <div className="w-full flex items-center my-auto px-2">
                      <div className="w-full h-1.5 bg-white/20 rounded-full relative">
                        <div className="w-1/3 h-full bg-emerald-400 rounded-full" />
                        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow" />
                      </div>
                    </div>
                  )}

                  {/* Coordinate Pill */}
                  <div
                    className={`self-end text-[9px] font-mono ${
                      isFsAction ? 'text-cyan-200' : 'text-emerald-200'
                    } bg-black/60 px-1.5 py-0.5 rounded`}
                  >
                    ({region.x}%, {region.y}%) {region.width}×{region.height}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <section
      id="section-video-interaction-lab"
      className="flex flex-col gap-6 p-6 sm:p-8 bg-surface/50 border border-border rounded-2xl shadow-sm"
      data-testid="video-interaction-lab-section"
    >
      {/* ── Section Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-primary rounded-full inline-block" />
            <h2 className="text-xl font-bold text-text flex items-center gap-2">
              <span>8. معمل تجارب التفاعل مع مشغلات الفيديو الخارجية</span>
              <Badge variant="neutral" className="text-[11px] font-mono">
                Design Lab Experiments
              </Badge>
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed max-w-4xl">
            بيئة تفاعلية معزولة مخصصة لاختبار وتقييم 5 مقارنات معمارية للتعامل مع مشغلات الفيديو الخارجية (YouTube و Google Drive و HTML5 المباشر)،
            مع تقييم أثر طبقة اعتراض النقر الانتقائية (Whitelisted Click-Through)، والقناع البصري المصغر (CSS Mask)، وعزل الساندبوكس (Sandboxed Iframe).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            leftIcon="rotateCcw"
            onClick={handleResetExperiment}
            data-testid="reset-experiment-btn"
          >
            إعادة ضبط التجربة
          </Button>
        </div>
      </div>

      {/* ── Source Selection & URL Input Bar ── */}
      <div className="p-4 bg-bg rounded-xl border border-border space-y-4">
        {/* Source Preset Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-text flex items-center gap-1.5">
            <Icon name="video" size="sm" className="text-primary" />
            <span>اختر عينة مصدر الفيديو للاختبار:</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeSourceType === 'google-drive' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('googleDrive')}
              className="text-xs h-8"
              data-testid="preset-google-drive-btn"
            >
              Google Drive
            </Button>
            <Button
              variant={activeSourceType === 'youtube' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('youtube')}
              className="text-xs h-8"
              data-testid="preset-youtube-btn"
            >
              YouTube
            </Button>
            <Button
              variant={activeSourceType === 'direct-video' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('directMp4')}
              className="text-xs h-8"
              data-testid="preset-direct-mp4-btn"
            >
              Direct MP4
            </Button>
            <Button
              variant={activeSourceType === 'local-video' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleSelectPreset('localBaseline')}
              className="text-xs h-8"
              data-testid="preset-local-baseline-btn"
            >
              Local Baseline
            </Button>
          </div>
        </div>

        {/* Custom URL Input & Apply Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                setIsUrlApplied(false);
              }}
              placeholder="أدخل رابط YouTube، أو Google Drive، أو رابط ملف وسائط MP4 مباشر..."
              className="w-full px-3.5 py-2 bg-surface text-xs text-text border border-border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              data-testid="video-lab-url-input"
            />
          </div>
          <Button
            variant={isUrlApplied ? 'outline' : 'primary'}
            size="sm"
            onClick={handleApplyUrl}
            leftIcon="check"
            className="shrink-0 text-xs"
            data-testid="apply-video-url-btn"
          >
            {isUrlApplied ? 'تم التطبيق' : 'تطبيق وتحميل الرابط'}
          </Button>
        </div>

        {/* Source Diagnosis Summary Badges */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-text-muted">النوع المكتشف:</span>
            <Badge variant="primary" className="text-[11px]">
              {parsedSource.sourceType.toUpperCase()}
            </Badge>

            {parsedSource.isValid ? (
              <Badge variant="success" className="text-[11px]">
                رابط صالح للتجربة
              </Badge>
            ) : (
              <Badge variant="danger" className="text-[11px]">
                رابط غير صالح
              </Badge>
            )}

            {parsedSource.requiresIframe ? (
              <Badge variant="neutral" className="text-[11px]">
                يتطلب إطار Iframe
              </Badge>
            ) : (
              <Badge variant="success" className="text-[11px]">
                متوافق مع HTML5 &lt;video&gt;
              </Badge>
            )}

            {hasLoaded && (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                <Icon name="checkCircle" size="sm" />
                <span>تم التحميل في المتصفح</span>
              </span>
            )}
            {!hasLoaded && !loadError && (
              <span className="text-text-muted font-mono text-[11px]">
                (قيد المعالجة أو بانتظار العرض)
              </span>
            )}
          </div>

          {parsedSource.securityNote && (
            <span className="text-[11px] text-text-muted max-w-lg truncate">
              {parsedSource.securityNote}
            </span>
          )}
        </div>
      </div>

      {/* ── 6 Comparison Modes Tab Selector ── */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-text">حدد وضع المقارنة التجريبي (6 Comparison Modes):</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2" data-testid="mode-selector-tabs">
          {/* Mode 1 */}
          <button
            type="button"
            onClick={() => setActiveMode('normal')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
              activeMode === 'normal'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface hover:bg-bg border-border text-text'
            }`}
            data-testid="tab-mode-normal"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>1. المشغل الافتراضي</span>
              <Icon name="play" size="sm" />
            </div>
            <p className={`text-[10px] leading-relaxed ${activeMode === 'normal' ? 'text-white/80' : 'text-text-muted'}`}>
              المشغل المدمج الطبيعي دون أي طبقات أو قيود أمان تجريبية.
            </p>
          </button>

          {/* Mode 2 */}
          <button
            type="button"
            onClick={() => setActiveMode('interaction-layer')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
              activeMode === 'interaction-layer'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface hover:bg-bg border-border text-text'
            }`}
            data-testid="tab-mode-interaction-layer"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>2. طبقة اعتراض النقر</span>
              <Icon name="shield" size="sm" />
            </div>
            <p className={`text-[10px] leading-relaxed ${activeMode === 'interaction-layer' ? 'text-white/80' : 'text-text-muted'}`}>
              حجب كامل للـ iframe باستثناء منافذ تصريح هندسية محددة.
            </p>
          </button>

          {/* Mode 3 */}
          <button
            type="button"
            onClick={() => setActiveMode('css-mask')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
              activeMode === 'css-mask'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface hover:bg-bg border-border text-text'
            }`}
            data-testid="tab-mode-css-mask"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>3. القناع البصري (A)</span>
              <Icon name="palette" size="sm" />
            </div>
            <p className={`text-[10px] leading-relaxed ${activeMode === 'css-mask' ? 'text-white/80' : 'text-text-muted'}`}>
              قناع CSS موضعي لحجب زر الفتح الخارجي في الزاوية العلوية.
            </p>
          </button>

          {/* Mode 4 */}
          <button
            type="button"
            onClick={() => setActiveMode('sandbox')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
              activeMode === 'sandbox'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface hover:bg-bg border-border text-text'
            }`}
            data-testid="tab-mode-sandbox"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>4. عزل الساندبوكس (B)</span>
              <Icon name="lock" size="sm" />
            </div>
            <p className={`text-[10px] leading-relaxed ${activeMode === 'sandbox' ? 'text-white/80' : 'text-text-muted'}`}>
              تطبيق قيود sandbox على الـ iframe لمنع النوافذ المنبثقة.
            </p>
          </button>

          {/* Mode 5 */}
          <button
            type="button"
            onClick={() => setActiveMode('html5-video')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
              activeMode === 'html5-video'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface hover:bg-bg border-border text-text'
            }`}
            data-testid="tab-mode-html5-video"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>5. مشغل HTML5 (C)</span>
              <Icon name="video" size="sm" />
            </div>
            <p className={`text-[10px] leading-relaxed ${activeMode === 'html5-video' ? 'text-white/80' : 'text-text-muted'}`}>
              بديل معماري يعتمد على عنصر &lt;video&gt; للمصادر المباشرة.
            </p>
          </button>

          {/* Mode 6: Google Drive Top Crop */}
          <button
            type="button"
            onClick={() => setActiveMode('gdrive-top-crop')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 ${
              activeMode === 'gdrive-top-crop'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface hover:bg-bg border-border text-text'
            }`}
            data-testid="tab-mode-gdrive-top-crop"
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>6. قص الجزء العلوي (Top Crop)</span>
              <Icon name="palette" size="sm" />
            </div>
            <p className={`text-[10px] leading-relaxed ${activeMode === 'gdrive-top-crop' ? 'text-white/80' : 'text-text-muted'}`}>
              Google Drive — Top Crop + Popup Blocking عبر CSS.
            </p>
          </button>
        </div>
      </div>

      {/* ── Contextual Controls Panel for Active Mode ── */}
      {activeMode === 'interaction-layer' && (
        <InteractionLayerControls
          config={interactionLayerConfig}
          onChange={(up) => setInteractionLayerConfig((prev) => ({ ...prev, ...up }))}
          onResetCounter={() =>
            setInteractionLayerConfig((prev) => ({ ...prev, interceptClickCount: 0 }))
          }
          onResetRegionsToDefault={() =>
            setInteractionLayerConfig((prev) => ({
              ...prev,
              activePreset: 'minimal-center',
              regions: INTERACTION_PRESETS['minimal-center'].map((r) => ({ ...r })),
            }))
          }
        />
      )}

      {activeMode === 'css-mask' && (
        <CssMaskControls
          config={cssMaskConfig}
          onChange={(up) => setCssMaskConfig((prev) => ({ ...prev, ...up }))}
          sourceType={parsedSource.sourceType}
        />
      )}

      {activeMode === 'sandbox' && (
        <SandboxControls
          config={sandboxConfig}
          onChange={(up) => setSandboxConfig((prev) => ({ ...prev, ...up }))}
          sandboxString={sandboxString}
        />
      )}

      {activeMode === 'html5-video' && (
        <Html5PlayerControls
          sourceResult={parsedSource}
          onSelectDirectPreset={() => handleSelectPreset('directMp4')}
          onSelectLocalPreset={() => handleSelectPreset('localBaseline')}
          onCustomLocalFileSelect={handleCustomLocalFile}
        />
      )}

      {activeMode === 'gdrive-top-crop' && (
        <GDriveCropControls
          config={gdriveCropConfig}
          onChange={(up) => setGDriveCropConfig((prev) => ({ ...prev, ...up }))}
          sourceType={parsedSource.sourceType}
          onSelectDrivePreset={() => handleSelectPreset('googleDrive')}
        />
      )}

      {/* ── Experimental Player Viewport Container ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-text">
          <span>شاشة المعاينة التجريبية (Experimental Player Container):</span>
          <span className="font-mono text-text-muted text-[11px]">
            {activeMode === 'html5-video' && parsedSource.canPlayHtml5
              ? '<video controls>'
              : '<iframe ...>'}
          </span>
        </div>

        <div
          ref={playerContainerRef}
          className={`relative w-full ${
            isFullscreen
              ? 'h-screen w-screen bg-black rounded-none border-0 shadow-none'
              : 'aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800'
          } flex items-center justify-center transition-all`}
          data-testid="experimental-player-viewport"
        >
          {/* Fullscreen Request Error Alert */}
          {fullscreenError && (
            <div
              className="absolute top-4 left-4 right-4 z-45 p-3 bg-rose-600/95 text-white rounded-xl flex items-center justify-between text-xs shadow-2xl backdrop-blur-md border border-rose-400"
              data-testid="fullscreen-error-alert"
            >
              <div className="flex items-center gap-2">
                <Icon name="alertCircle" size="sm" className="shrink-0" />
                <span>{fullscreenError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFullscreenError(null)}
                className="text-white hover:text-slate-200 text-xs px-2.5 py-1 rounded bg-black/40 font-bold"
                data-testid="dismiss-fullscreen-error-btn"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* On-Player HUD Bar during Fullscreen */}
          {isFullscreen && (
            <div
              className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl bg-slate-950/90 border border-slate-700/80 backdrop-blur-md shadow-2xl text-white"
              data-testid="player-fullscreen-hud"
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge variant="primary" className="bg-primary/20 text-primary-light border border-primary/40 text-xs">
                  وضع ملء الشاشة المدار للحاوية (Container Fullscreen Active)
                </Badge>
                <span className="text-xs text-slate-300 font-medium">
                  المصدر: {parsedSource.sourceType}
                </span>
                {activeMode === 'interaction-layer' && (
                  <>
                    <span className="text-xs text-emerald-400 font-bold font-mono">
                      المناطق المسموحة: {interactionLayerConfig.regions.filter((r) => r.enabled).length}
                    </span>
                    <span className="text-xs text-amber-300 font-mono">
                      النقرات المعترضة: {interactionLayerConfig.interceptClickCount}
                    </span>
                    {interactionLayerConfig.blockPopups && (
                      <Badge variant="info" className="text-[10px]">
                        حظر النوافذ نشط
                      </Badge>
                    )}
                  </>
                )}
                {activeMode === 'gdrive-top-crop' && (
                  <>
                    <span className="text-xs text-primary-light font-bold font-mono" data-testid="fs-hud-crop-value">
                      مقدار القص: {gdriveCropConfig.cropPixels}px
                    </span>
                    {gdriveCropConfig.blockPopups ? (
                      <Badge variant="info" className="text-[10px]" data-testid="fs-hud-crop-popups-badge">
                        حظر النوافذ نشط (Sandbox)
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="text-[10px]" data-testid="fs-hud-crop-popups-badge">
                        الساندبوكس غير مقيد
                      </Badge>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeMode === 'interaction-layer' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setInteractionLayerConfig((prev) => ({
                          ...prev,
                          showVisualGuide: !prev.showVisualGuide,
                        }))
                      }
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700"
                      data-testid="fs-hud-toggle-guides"
                    >
                      {interactionLayerConfig.showVisualGuide ? 'إخفاء الدلائل' : 'إظهار الدلائل'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setInteractionLayerConfig((prev) => ({
                          ...prev,
                          showBlockedAreasTint: !prev.showBlockedAreasTint,
                        }))
                      }
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700"
                      data-testid="fs-hud-toggle-tint"
                    >
                      {interactionLayerConfig.showBlockedAreasTint ? 'إلغاء التظليل' : 'تفعيل التظليل'}
                    </button>
                  </>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon="minimize"
                  onClick={handleExitFullscreen}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-7"
                  data-testid="exit-fullscreen-btn"
                >
                  إنهاء ملء الشاشة (Esc)
                </Button>
              </div>
            </div>
          )}

          {/* Dedicated Container Fullscreen Button in Normal View */}
          {!isFullscreen && (
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="absolute top-3 left-3 z-30 p-2 bg-black/60 hover:bg-black/90 text-white rounded-lg border border-white/20 backdrop-blur-sm transition-all shadow hover:scale-105"
              title="تكبير مشغل الحاوية مع طبقة الاعتراض (Managed Fullscreen)"
              data-testid="managed-fullscreen-btn"
            >
              <Icon name="maximize" size="sm" />
            </button>
          )}
          {/* A. HTML5 Native Player Rendering */}
          {activeMode === 'html5-video' && parsedSource.canPlayHtml5 ? (
            <video
              key={`video-${parsedSource.directMediaUrl}`}
              src={parsedSource.directMediaUrl || undefined}
              controls
              playsInline
              className="w-full h-full object-contain"
              onLoadedData={() => setHasLoaded(true)}
              onError={() => setLoadError('تعذر فك تشفير أو تحميل ملف الوسائط المحدد.')}
              data-testid="html5-native-video-element"
            />
          ) : activeMode === 'html5-video' && !parsedSource.canPlayHtml5 ? (
            /* HTML5 Incompatible Screen: Refuse to pass webpage URL to <video src> */
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-white space-y-4"
              data-testid="html5-refusal-screen"
            >
              <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Icon name="alertCircle" size="lg" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="font-bold text-base">تم منع تمرير رابط صفحة الويب إلى &lt;video src&gt;</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هذا الرابط يمثل صفحة HTML تفاعلية تابعة لـ ({parsedSource.sourceType}) وليس ملف MP4 ثنائي.
                  محاولة تشغيله كـ &lt;video&gt; ستفشل مع خطأ أمني (CORS).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => handleSelectPreset('directMp4')}>
                  تشغيل عينة MP4 المباشرة
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActiveMode('normal')}>
                  العودة للـ iframe المدمج
                </Button>
              </div>
            </div>
          ) : activeMode === 'gdrive-top-crop' ? (
            /* Mode 6: Google Drive Top Crop Wrapper + Popup Blocking */
            <div
              className="gdrive-top-crop-wrapper w-full h-full relative overflow-hidden"
              data-testid="gdrive-top-crop-wrapper"
            >
              {parsedSource.embedUrl ? (
                <iframe
                  key={`iframe-gdrive-crop-${parsedSource.embedUrl}-${effectiveIframeSandbox || 'unrestricted'}`}
                  src={parsedSource.embedUrl}
                  title="Google Drive Top Crop Experimental Player"
                  className="absolute left-0 w-full border-0"
                  style={getTopCropIframeStyle(gdriveCropConfig.cropPixels)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  sandbox={effectiveIframeSandbox}
                  onLoad={() => setHasLoaded(true)}
                  onError={() => setLoadError('فشل تحميل الإطار الخارجي.')}
                  data-testid="gdrive-top-crop-iframe"
                />
              ) : (
                <div className="text-xs text-slate-400 p-4 text-center">
                  لا يتوفر رابط تضمين صالح لهذا المصدر.
                </div>
              )}
            </div>
          ) : (
            /* B. Iframe Rendering (Modes 1, 2, 3, 4) */
            <>
              {parsedSource.embedUrl ? (
                <iframe
                  key={`iframe-${parsedSource.embedUrl}-${activeMode}-${effectiveIframeSandbox || 'unrestricted'}`}
                  src={parsedSource.embedUrl}
                  title="Design Lab Experimental Video Player"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  sandbox={effectiveIframeSandbox}
                  onLoad={() => setHasLoaded(true)}
                  onError={() => setLoadError('فشل تحميل الإطار الخارجي.')}
                  data-testid="experimental-iframe"
                />
              ) : (
                <div className="text-xs text-slate-400 p-4 text-center">
                  لا يتوفر رابط تضمين صالح لهذا المصدر.
                </div>
              )}

              {/* Mode 3: CSS Visual Mask Overlay (Experiment A) */}
              {activeMode === 'css-mask' && cssMaskConfig.enabled && (
                <div
                  className="absolute z-30 transition-all flex items-center justify-center rounded-lg shadow-lg select-none cursor-not-allowed border border-white/20"
                  style={{
                    width: `${cssMaskConfig.width}px`,
                    height: `${cssMaskConfig.height}px`,
                    top: `${cssMaskConfig.top}px`,
                    right: `${cssMaskConfig.right}px`,
                    backgroundColor: cssMaskConfig.color,
                    opacity: cssMaskConfig.opacity,
                  }}
                  title="قناع بصري مصغر لحجب زر الفتح الخارجي"
                  data-testid="css-mask-overlay-element"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <span className="text-[9px] font-bold text-white/90 truncate px-1 pointer-events-none">
                    {cssMaskConfig.width > 50 ? cssMaskConfig.label : 'حظر'}
                  </span>
                </div>
              )}

              {/* Mode 3 on Local Video: Simulated Control Demonstration */}
              {activeMode === 'css-mask' && parsedSource.sourceType === 'local-video' && (
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedClickSuccess(true);
                    if (timerRef.current) clearTimeout(timerRef.current);
                    timerRef.current = setTimeout(() => setSimulatedClickSuccess(false), 3000);
                  }}
                  className="absolute z-10 top-2.5 right-3 px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] rounded flex items-center gap-1 backdrop-blur-sm"
                  title="زر محاكاة لاختبار ما إذا كان القناع يحجبه أم لا"
                  data-testid="simulated-popout-control-btn"
                >
                  <Icon name="externalLink" size="sm" />
                  <span>زر محاكاة الفتح</span>
                </button>
              )}
            </>
          )}

          {/* Mode 2: Whitelisted Click-Through Interaction Layer (Active over iframe and local video) */}
          {renderWhitelistedInteractionLayer()}
        </div>

        {simulatedClickSuccess && (
          <div
            className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
            data-testid="simulated-click-alert"
          >
            <Icon name="checkCircle" size="sm" />
            <span>تم الضغط على زر المحاكاة بنجاح (القناع معطل أو لا يغطي الزر بالكامل)!</span>
          </div>
        )}
      </div>

      {/* ── Real-Time Status & Architectural Evaluation Card ── */}
      <div
        className="p-5 bg-bg rounded-xl border border-border space-y-3"
        data-testid="diagnostic-assessment-card"
      >
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="chart" size="sm" className="text-primary" />
            <h4 className="text-xs font-bold text-text">
              تقرير التقييم المعماري للوضع الحالي (Status &amp; Evaluation):
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">الوضع النشط:</span>
            <Badge variant="primary" className="text-[11px] font-bold">
              {activeMode === 'normal' && '1. المشغل الافتراضي المدمج'}
              {activeMode === 'interaction-layer' && '2. طبقة اعتراض النقر الانتقائية (Whitelisted Click-Through)'}
              {activeMode === 'css-mask' && '3. القناع البصري المصغر (A)'}
              {activeMode === 'sandbox' && '4. عزل الساندبوكس (B)'}
              {activeMode === 'html5-video' && '5. مشغل HTML5 الأصيل (C)'}
              {activeMode === 'gdrive-top-crop' && '6. قص الجزء العلوي وحظر النوافذ (Google Drive Top Crop)'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Column 1: Playback Capability */}
          <div className="space-y-1">
            <span className="font-bold text-text">1. صلاحية التشغيل (Playback):</span>
            <p className="text-text-muted leading-relaxed">
              {activeMode === 'html5-video'
                ? parsedSource.canPlayHtml5
                  ? 'يعمل عبر مشغل المتصفح الأصيل دون قيود طرف ثالث.'
                  : 'غير مدعوم: يتطلب ملف وسائط مباشر وليس صفحة ويب.'
                : activeMode === 'gdrive-top-crop'
                ? 'يتم تشغيل الفيديو عبر إطار الـ iframe الرسمي لـ Google Drive داخل حاوية مقصوصة علوياً.'
                : 'يتم تشغيل الفيديو عبر إطار الـ iframe الرسمي للمنصة.'}
            </p>
          </div>

          {/* Column 2: Pop-out / Navigation Limitation */}
          <div className="space-y-1">
            <span className="font-bold text-text">2. تقييد الفتح الخارجي (Pop-out Control):</span>
            <p className="text-text-muted leading-relaxed">
              {activeMode === 'normal' && 'متاح بالكامل دون أي حجب أو قيود.'}
              {activeMode === 'interaction-layer' &&
                (interactionLayerConfig.enabled
                  ? interactionLayerConfig.blockPopups
                    ? 'طبقة الاعتراض نشطة (محجوب تلقائياً خارج المناطق المصرح بها) مع تطبيق قيود ساندبوكس لحظر النوافذ المنبثقة.'
                    : 'محجوب تلقائياً خارج المناطق المصرح بها. يسمح بالمرور فقط عبر النوافذ الهندسية المحددة، بينما تُحجب النقرات على الزر الخارجي وشريط العنوان.'
                  : interactionLayerConfig.blockPopups
                    ? 'طبقة الاعتراض معطلة، ولكن قيود حظر النوافذ المنبثقة مفعلة على الـ iframe.'
                    : 'معطل، المشغل حر وتصل كافة النقرات للـ iframe.')}
              {activeMode === 'css-mask' &&
                (cssMaskConfig.enabled
                  ? 'محجوب بصرياً بالماوس فقط عبر القناع الموضعي (يمكن الالتفاف عليه بـ Tab أو DevTools).'
                  : 'معطل، الزر مكشوف كالمعتاد.')}
              {activeMode === 'sandbox' &&
                (!sandboxConfig.allowPopups
                  ? 'الزر ظاهر بصرياً داخل الـ iframe، ولكن المتصفح يحظر فتح النوافذ الجديدة عند النقر.'
                  : 'السماح بالنوافذ مفعّل؛ يفتح نافذة جديدة.')}
              {activeMode === 'html5-video' &&
                'لا وجود لأي زر فتح خارجي؛ المشغل محلي الصنع بالكامل داخل المنصة.'}
              {activeMode === 'gdrive-top-crop' &&
                `يتم إزاحة الشريط العلوي (الذي يحتوي زر الفتح الخارجي) إلى خارج إطار الرؤية بمقدار ${gdriveCropConfig.cropPixels}px عبر CSS margin-top سالب وحاوية مقنعة (overflow: hidden)${
                  gdriveCropConfig.blockPopups ? ' بالتكامل مع حظر النوافذ المنبثقة عبر الساندبوكس كخط دفاع ثانٍ.' : '.'
                }`}
            </p>
          </div>

          {/* Column 3: Production Recommendation */}
          <div className="space-y-1">
            <span className="font-bold text-text">3. التوصية المعمارية (Architectural Guidance):</span>
            <p className="text-text-muted leading-relaxed">
              {activeMode === 'interaction-layer' &&
                'توفر حماية جيدة لمنع النقر على الزر الخارجي دون العبث بالـ iframe، مع تطبيق ملء الشاشة على مستوى الحاوية الخارجية لضمان بقاء طبقة الاعتراض والدلائل مرئية وفعالة أثناء العرض الكامل.'}
              {activeMode === 'css-mask' &&
                'مناسب كحل ترقيعي سريع ومؤقت لواجهة Google Drive، مع إدراك أنه ليس حماية حقيقية.'}
              {activeMode === 'sandbox' &&
                'يجب توخي الحذر الشديد؛ الساندبوكس الصارم قد يكسر مشغل YouTube أو يمنع الدخول بحساب Google.'}
              {activeMode === 'html5-video' &&
                'الحل الأمثل والأنظف للمستقبل شريطة توفير استضافة سحابية خاصة للملفات وتوزيعها عبر CDN.'}
              {activeMode === 'normal' &&
                'الحل الأكثر استقراراً واعتمادية لمصادر الطرف الثالث دون مفاجآت في المتصفحات.'}
              {activeMode === 'gdrive-top-crop' &&
                'تقنية CSS فعالة وخفيفة لإخفاء شريط العنوان وزر الفتح الخارجي لـ Google Drive دون طبقة اعتراض إضافية. يُنصح بالتحقق اليدوي مما إذا كانت عناصر تحكم ملء الشاشة الأصلية أو أزرار المشغل السفلى تتأثر بالنسبة والتناسب.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
