import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type { CssMaskConfig, VideoSourceType } from '../types/videoLabTypes';

export interface CssMaskControlsProps {
  config: CssMaskConfig;
  onChange: (updated: Partial<CssMaskConfig>) => void;
  sourceType: VideoSourceType;
}

export const CssMaskControls: React.FC<CssMaskControlsProps> = ({
  config,
  onChange,
  sourceType,
}) => {
  // Boundary safety calculation
  const isWidthRisky = config.width > 120;
  const isHeightRisky = config.height > 80;
  const isBoundaryRisky = isWidthRisky || isHeightRisky;

  const isYouTube = sourceType === 'youtube';

  return (
    <div
      className="p-5 bg-surface border border-border rounded-xl space-y-4"
      data-testid="css-mask-controls-panel"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="text-xs">
            تجربة A: القناع البصري المصغر (CSS Visual Mask)
          </Badge>
          <span className="text-xs text-text-muted font-medium">
            تثبيت غطاء سطحي فوق زر الفتح الخارجي (Pop-out Control)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-text cursor-pointer flex items-center gap-2">
            <span>تفعيل القناع:</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-offset-0"
              data-testid="mask-enable-checkbox"
            />
          </label>
        </div>
      </div>

      {isYouTube && (
        <div
          className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 space-y-1"
          data-testid="youtube-mask-policy-warning"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <Icon name="alertCircle" size="sm" className="text-amber-600" />
            <span>قيود سياسة YouTube الرسمية:</span>
          </div>
          <p className="leading-relaxed">
            يُحظر في بيئة الإنتاج تغطية أو حجب أزرار التحكم وشعارات YouTube الرسمية طبقاً لبنود خدمة YouTube API.
            القناع التجريبي يمكن تفعيله كنموذج إثبات مفهوم، أو معاينته بأمان على مشغل محلي بمحاكاة زر التحكم.
          </p>
        </div>
      )}

      {isBoundaryRisky && (
        <div
          className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-800 dark:text-rose-300 space-y-1"
          data-testid="mask-boundary-risk-warning"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <Icon name="alert" size="sm" className="text-rose-600" />
            <span>تنبيه أبعاد القناع:</span>
          </div>
          <p className="leading-relaxed">
            الأبعاد الحالية (العرض: {config.width}px، الارتفاع: {config.height}px) تتجاوز المنطقة الآمنة للزاوية العلوية، مما يهدد بحجب مساحة الفيديو الحيوية أو التداخل مع أزرار التحكم الأخرى.
          </p>
        </div>
      )}

      {/* Sliders and Configuration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Width */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">عرض القناع (Width):</span>
            <span className="font-mono text-primary font-bold">{config.width}px</span>
          </div>
          <input
            type="range"
            min={20}
            max={180}
            step={2}
            value={config.width}
            onChange={(e) => onChange({ width: Number(e.target.value) })}
            disabled={!config.enabled}
            className="w-full accent-primary cursor-pointer disabled:opacity-40"
            data-testid="mask-width-slider"
          />
        </div>

        {/* Height */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">ارتفاع القناع (Height):</span>
            <span className="font-mono text-primary font-bold">{config.height}px</span>
          </div>
          <input
            type="range"
            min={20}
            max={120}
            step={2}
            value={config.height}
            onChange={(e) => onChange({ height: Number(e.target.value) })}
            disabled={!config.enabled}
            className="w-full accent-primary cursor-pointer disabled:opacity-40"
            data-testid="mask-height-slider"
          />
        </div>

        {/* Top Offset */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">الإزاحة من الأعلى (Top):</span>
            <span className="font-mono text-primary font-bold">{config.top}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={config.top}
            onChange={(e) => onChange({ top: Number(e.target.value) })}
            disabled={!config.enabled}
            className="w-full accent-primary cursor-pointer disabled:opacity-40"
            data-testid="mask-top-slider"
          />
        </div>

        {/* Right Offset */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">الإزاحة من اليمين (Right):</span>
            <span className="font-mono text-primary font-bold">{config.right}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={config.right}
            onChange={(e) => onChange({ right: Number(e.target.value) })}
            disabled={!config.enabled}
            className="w-full accent-primary cursor-pointer disabled:opacity-40"
            data-testid="mask-right-slider"
          />
        </div>
      </div>

      {/* Preset alignment quick buttons */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 text-xs">
        <span className="font-semibold text-text-muted">أوضاع محاذاة سريعة لـ Google Drive:</span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ width: 48, height: 48, top: 10, right: 12, enabled: true })}
            disabled={!config.enabled}
          >
            قياسي (48×48px)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ width: 64, height: 56, top: 8, right: 8, enabled: true })}
            disabled={!config.enabled}
          >
            تغطية واسعة (64×56px)
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ opacity: config.opacity > 0.5 ? 0.3 : 0.95 })}
            disabled={!config.enabled}
          >
            تبديل الشفافية ({Math.round(config.opacity * 100)}%)
          </Button>
        </div>
      </div>

      {/* Honest Architectural Disclaimer */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-text-muted space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-primary-dark">
          <Icon name="info" size="sm" />
          <span>التقييم المعماري للقناع البصري:</span>
        </div>
        <p className="leading-relaxed">
          القناع البصري هو طبقة CSS توضع فوق المشغل لحجب الضغط بالماوس على منطقة الزر، لكنه <strong>لا يمثل حماية أمنية حقيقية للمحتوى</strong>؛
          إذ يمكن لأي متدرب متمرس استخدام أدوات المطورين (DevTools)، أو اختصارات لوحة المفاتيح (Tab + Enter)، أو قراءة مصدر الصفحة للوصول للرابط الأصلي.
        </p>
      </div>
    </div>
  );
};
