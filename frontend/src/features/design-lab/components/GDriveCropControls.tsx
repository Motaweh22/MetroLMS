import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type { GDriveCropConfig, VideoSourceType } from '../types/videoLabTypes';
import { BlockPopupsControl } from './BlockPopupsControl';

export interface GDriveCropControlsProps {
  config: GDriveCropConfig;
  onChange: (updated: Partial<GDriveCropConfig>) => void;
  sourceType: VideoSourceType;
  onSelectDrivePreset: () => void;
}

export const GDriveCropControls: React.FC<GDriveCropControlsProps> = ({
  config,
  onChange,
  sourceType,
  onSelectDrivePreset,
}) => {
  return (
    <div
      className="p-5 bg-surface border border-border rounded-xl space-y-4"
      data-testid="gdrive-crop-controls-panel"
    >
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="primary" className="text-xs font-bold">
            الوضع 6: Google Drive — Top Crop + Popup Blocking
          </Badge>
          <span className="text-xs text-text-muted font-medium">
            تقنية قص شريط Google Drive العلوي عبر CSS مع حظر النوافذ المنبثقة
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={sourceType === 'google-drive' ? 'success' : 'neutral'} className="text-[11px]">
            {sourceType === 'google-drive' ? 'مصدر متوافق (Google Drive)' : `المصدر الحالي: ${sourceType}`}
          </Badge>
        </div>
      </div>

      {/* ── Source Mismatch Warning (if not Google Drive) ── */}
      {sourceType !== 'google-drive' && (
        <div
          className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs text-amber-800 dark:text-amber-300"
          data-testid="crop-source-mismatch-banner"
        >
          <div className="flex items-center gap-2">
            <Icon name="alertCircle" size="sm" className="shrink-0 text-amber-600" />
            <span>
              هذه التجربة مخصصة لمشغل Google Drive. المصدر النشط حالياً هو ({sourceType}).
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectDrivePreset}
            className="text-xs h-7 bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
            data-testid="switch-to-drive-preset-btn"
          >
            التبديل إلى عينة Google Drive
          </Button>
        </div>
      )}

      {/* ── Crop Amount Configuration Card ── */}
      <div className="p-4 bg-bg rounded-xl border border-border space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="palette" size="sm" className="text-primary" />
            <span className="text-xs font-bold text-text">
              مقدار القص العلوي (Top Crop Offset):
            </span>
            <span
              className="font-mono text-sm font-bold text-primary px-2 py-0.5 bg-primary/10 rounded"
              data-testid="crop-pixels-value"
            >
              {config.cropPixels}px
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ cropPixels: 50 })}
            className="text-[11px] h-7"
            data-testid="reset-crop-pixels-btn"
          >
            استعادة القيمة الافتراضية (50px)
          </Button>
        </div>

        {/* Sliders & Direct Input */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
          <div className="sm:col-span-2 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>0px (بدون قص)</span>
              <span>50px (الافتراضي)</span>
              <span>150px (قص عميق)</span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              step={1}
              value={config.cropPixels}
              onChange={(e) => onChange({ cropPixels: Number(e.target.value) })}
              className="w-full accent-primary cursor-pointer"
              data-testid="crop-pixels-slider"
            />
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <label className="text-[11px] text-text-muted">القيمة بالبكسل:</label>
            <input
              type="number"
              min={0}
              max={200}
              value={config.cropPixels}
              onChange={(e) => onChange({ cropPixels: Math.max(0, Number(e.target.value)) })}
              className="w-20 px-2 py-1 text-xs font-mono font-bold text-text bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="crop-pixels-input"
            />
          </div>
        </div>

        {/* Quick Crop Presets */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50 text-xs">
          <span className="text-[11px] text-text-muted font-medium">قيم جاهزة سريعة:</span>
          <Button
            variant={config.cropPixels === 50 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onChange({ cropPixels: 50 })}
            className="text-[11px] h-6 px-2"
            data-testid="crop-preset-50-btn"
          >
            50px (الافتراضي)
          </Button>
          <Button
            variant={config.cropPixels === 40 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onChange({ cropPixels: 40 })}
            className="text-[11px] h-6 px-2"
            data-testid="crop-preset-40-btn"
          >
            40px (قص خفيف)
          </Button>
          <Button
            variant={config.cropPixels === 60 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onChange({ cropPixels: 60 })}
            className="text-[11px] h-6 px-2"
            data-testid="crop-preset-60-btn"
          >
            60px (قص واسع)
          </Button>
          <Button
            variant={config.cropPixels === 0 ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onChange({ cropPixels: 0 })}
            className="text-[11px] h-6 px-2"
            data-testid="crop-preset-0-btn"
          >
            0px (بدون قص)
          </Button>
        </div>
      </div>

      {/* ── Reused Independent Popup-Blocking Option ── */}
      <BlockPopupsControl
        blockPopups={config.blockPopups}
        onChange={(blockPopups) => onChange({ blockPopups })}
        title="حظر النوافذ المنبثقة لمشغل Google Drive المقصوص:"
        description="حظر النوافذ غير مفعل؛ المشغل يعمل بالصلاحيات الافتراضية للـ iframe. ينصح بتفعيله كخط دفاع إضافي بجانب القص الفيزيائي."
      />

      {/* ── CSS Technique & Manual Testing Advisory ── */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-primary-dark">
          <Icon name="info" size="sm" />
          <span>التقنية المطبقة عبر CSS (CSS Top-Crop Technique):</span>
        </div>

        <pre className="p-2.5 bg-slate-950 text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800" dir="ltr">
{`.gdrive-top-crop-wrapper {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.gdrive-top-crop-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(100% + ${config.cropPixels}px);
  margin-top: -${config.cropPixels}px;
  border: 0;
}`}
        </pre>

        <p className="leading-relaxed text-[11px] text-text-muted">
          <strong>تنبيه الفحص اليدوي المطلوب:</strong> تقوم هذه التقنية بإزاحة الإطار كاملاً لأعلى بمقدار ({config.cropPixels}px) لإخفاء شريط العنوان وزر الفتح الخارجي (Pop-out). يجب التحقق يدوياً داخل المتصفح من اختفاء الزر، والتأكد من بقاء شريط التحكم السفلي (التشغيل، الصوت، ملء الشاشة) مرئياً ومتاحاً للنقر دون اقتطاع.
        </p>
      </div>
    </div>
  );
};
