/**
 * Design Lab — External Video Interaction Experiments Types
 */

export type VideoSourceType = 'youtube' | 'google-drive' | 'direct-video' | 'local-video';

export type ExperimentMode =
  | 'normal'
  | 'interaction-layer'
  | 'css-mask'
  | 'sandbox'
  | 'html5-video'
  | 'gdrive-top-crop';

export interface SourceParseResult {
  sourceType: VideoSourceType;
  rawUrl: string;
  embedUrl: string | null;
  directMediaUrl: string | null;
  videoId?: string;
  driveFileId?: string;
  isValid: boolean;
  canPlayHtml5: boolean;
  requiresIframe: boolean;
  error?: string;
  securityNote?: string;
}

export interface CssMaskConfig {
  enabled: boolean;
  width: number;       // in px
  height: number;      // in px
  top: number;         // in px
  right: number;       // in px
  opacity: number;     // 0.0 to 1.0
  color: string;       // hex or css color
  label: string;
  simulatedControlOnLocal?: boolean;
}

export type SandboxPreset = 'least-restrictive' | 'block-popups' | 'strict' | 'custom';

export interface SandboxConfig {
  preset: SandboxPreset;
  allowScripts: boolean;
  allowSameOrigin: boolean;
  allowPopups: boolean;
  allowPopupsToEscapeSandbox: boolean;
  allowForms: boolean;
  allowPresentation: boolean;
}

export type RegionActionType = 'passthrough' | 'fullscreen';

export interface ClickThroughRegion {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  x: number;       // left position percentage (0 to 100)
  y: number;       // top position percentage (0 to 100)
  width: number;   // width percentage (0 to 100)
  height: number;  // height percentage (0 to 100)
  type: 'center-play' | 'bottom-controls' | 'progress-bar' | 'fullscreen' | 'custom';
  action?: RegionActionType;
}

export type InteractionLayerPreset =
  | 'minimal-center'
  | 'standard-controls'
  | 'google-drive-aligned'
  | 'youtube-aligned'
  | 'custom';

export interface InteractionLayerConfig {
  enabled: boolean;
  blockPopups: boolean;
  showVisualGuide: boolean;
  showBlockedAreasTint: boolean;
  interceptClickCount: number;
  activePreset: InteractionLayerPreset;
  regions: ClickThroughRegion[];
}

export interface DiagnosticAssessment {
  mode: ExperimentMode;
  sourceType: VideoSourceType;
  playerEngine: 'iframe' | 'video' | 'none';
  status: 'ready' | 'warning' | 'error' | 'unsupported';
  summary: string;
  details: string[];
  limitations: string[];
}

export const INTERACTION_PRESETS: Record<InteractionLayerPreset, ClickThroughRegion[]> = {
  'minimal-center': [
    {
      id: 'reg-center-play',
      name: 'منطقة التشغيل والإيقاف المركزية',
      description: 'نافذة تسمح بالنقر على منتصف المشغل فقط للتشغيل والإيقاف المؤقت، مع حجب كافة الأزرار المحيطة.',
      enabled: true,
      x: 25,
      y: 20,
      width: 50,
      height: 60,
      type: 'center-play',
      action: 'passthrough',
    },
  ],
  'standard-controls': [
    {
      id: 'reg-center-play',
      name: 'منطقة التشغيل المركزية',
      description: 'نافذة تمرير النقر لوسط الشاشة (Play/Pause).',
      enabled: true,
      x: 25,
      y: 20,
      width: 50,
      height: 55,
      type: 'center-play',
      action: 'passthrough',
    },
    {
      id: 'reg-bottom-controls',
      name: 'شريط أزرار التحكم السفلي',
      description: 'نافذة تمرير النقر لأزرار التشغيل، الصوت، ومسار الوقت (Play/Mute/Timeline).',
      enabled: true,
      x: 0,
      y: 86,
      width: 91,
      height: 14,
      type: 'bottom-controls',
      action: 'passthrough',
    },
    {
      id: 'reg-fullscreen-action',
      name: 'منطقة ملء الشاشة المدارة (Managed Fullscreen)',
      description: 'إجراء مدار: يعترض النقر على زر ملء الشاشة الأصلي ويطلب ملء الشاشة للحاوية الخارجية مع الحفاظ على طبقة الاعتراض.',
      enabled: true,
      x: 91,
      y: 86,
      width: 9,
      height: 14,
      type: 'fullscreen',
      action: 'fullscreen',
    },
    {
      id: 'reg-progress-bar',
      name: 'شريط مسار التقدم (Scrubber Timeline)',
      description: 'نافذة تمرير النقر لخط التمرير الزمني.',
      enabled: true,
      x: 2,
      y: 80,
      width: 96,
      height: 6,
      type: 'progress-bar',
      action: 'passthrough',
    },
  ],
  'google-drive-aligned': [
    {
      id: 'reg-center-play',
      name: 'وسط مشغل Google Drive',
      description: 'منطقة النقر الرئيسية للتشغيل.',
      enabled: true,
      x: 25,
      y: 20,
      width: 50,
      height: 55,
      type: 'center-play',
      action: 'passthrough',
    },
    {
      id: 'reg-drive-bottom',
      name: 'شريط ضوابط Drive السفلية',
      description: 'شريط التحكم السفلي في Google Drive مع بقاء زر الفتح الخارجي العلوي محجوباً.',
      enabled: true,
      x: 0,
      y: 86,
      width: 91,
      height: 14,
      type: 'bottom-controls',
      action: 'passthrough',
    },
    {
      id: 'reg-drive-fullscreen',
      name: 'زر ملء الشاشة المدار لـ Google Drive',
      description: 'يعترض النقر في الزاوية السفلية ويطلب ملء الشاشة للحاوية الخارجية.',
      enabled: true,
      x: 91,
      y: 86,
      width: 9,
      height: 14,
      type: 'fullscreen',
      action: 'fullscreen',
    },
  ],
  'youtube-aligned': [
    {
      id: 'reg-center-play',
      name: 'وسط مشغل YouTube',
      description: 'منطقة النقر لوسط فيديو يوتيوب.',
      enabled: true,
      x: 20,
      y: 15,
      width: 60,
      height: 65,
      type: 'center-play',
      action: 'passthrough',
    },
    {
      id: 'reg-yt-bottom',
      name: 'شريط تحكم YouTube السفلي',
      description: 'أزرار تحكم يوتيوب القياسية ومسار التقدم.',
      enabled: true,
      x: 0,
      y: 84,
      width: 91,
      height: 16,
      type: 'bottom-controls',
      action: 'passthrough',
    },
    {
      id: 'reg-yt-fullscreen',
      name: 'زر ملء الشاشة المدار لـ YouTube',
      description: 'يعترض النقر في الزاوية السفلية ويطلب ملء الشاشة للحاوية الخارجية.',
      enabled: true,
      x: 91,
      y: 84,
      width: 9,
      height: 16,
      type: 'fullscreen',
      action: 'fullscreen',
    },
  ],
  'custom': [],
};

export const DEFAULT_INTERACTION_LAYER: InteractionLayerConfig = {
  enabled: true,
  blockPopups: false,
  showVisualGuide: true,
  showBlockedAreasTint: true,
  interceptClickCount: 0,
  activePreset: 'minimal-center',
  regions: INTERACTION_PRESETS['minimal-center'],
};

export interface GDriveCropConfig {
  cropPixels: number; // in px, default 50
  blockPopups: boolean; // default true
}

export const DEFAULT_GDRIVE_CROP: GDriveCropConfig = {
  cropPixels: 50,
  blockPopups: true,
};


