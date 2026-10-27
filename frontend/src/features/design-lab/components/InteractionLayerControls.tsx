import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type {
  InteractionLayerConfig,
  InteractionLayerPreset,
  ClickThroughRegion,
} from '../types/videoLabTypes';
import { INTERACTION_PRESETS } from '../types/videoLabTypes';
import { BlockPopupsControl } from './BlockPopupsControl';

export interface InteractionLayerControlsProps {
  config: InteractionLayerConfig;
  onChange: (updated: Partial<InteractionLayerConfig>) => void;
  onResetCounter: () => void;
  onResetRegionsToDefault: () => void;
}

export const InteractionLayerControls: React.FC<InteractionLayerControlsProps> = ({
  config,
  onChange,
  onResetCounter,
  onResetRegionsToDefault,
}) => {
  const handleApplyPreset = (preset: InteractionLayerPreset) => {
    if (preset === 'custom') {
      onChange({ activePreset: 'custom' });
      return;
    }
    const presetRegions = INTERACTION_PRESETS[preset] || [];
    onChange({
      activePreset: preset,
      regions: presetRegions.map((r) => ({ ...r })),
    });
  };

  const handleToggleRegion = (id: string, enabled: boolean) => {
    const updated = config.regions.map((r) => (r.id === id ? { ...r, enabled } : r));
    onChange({ regions: updated, activePreset: 'custom' });
  };

  const handleUpdateRegion = (id: string, partial: Partial<ClickThroughRegion>) => {
    const updated = config.regions.map((r) => (r.id === id ? { ...r, ...partial } : r));
    onChange({ regions: updated, activePreset: 'custom' });
  };

  const handleDeleteRegion = (id: string) => {
    const updated = config.regions.filter((r) => r.id !== id);
    onChange({ regions: updated, activePreset: 'custom' });
  };

  const handleAddRegion = () => {
    const newId = `reg-custom-${Date.now().toString(36)}`;
    const newRegion: ClickThroughRegion = {
      id: newId,
      name: `منطقة مخصصة #${config.regions.length + 1}`,
      description: 'منطقة تصريح بالنقر مخصصة.',
      enabled: true,
      x: 10 + (config.regions.length * 5) % 40,
      y: 10 + (config.regions.length * 5) % 40,
      width: 25,
      height: 25,
      type: 'custom',
      action: 'passthrough',
    };
    onChange({
      regions: [...config.regions, newRegion],
      activePreset: 'custom',
    });
  };

  const enabledRegionsCount = config.regions.filter((r) => r.enabled).length;

  return (
    <div
      className="p-5 bg-surface border border-border rounded-xl space-y-4"
      data-testid="interaction-layer-controls-panel"
    >
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="primary" className="text-xs">
            الوضع 2: طبقة اعتراض النقر الانتقائية (Whitelisted Click-Through Layer)
          </Badge>
          <span className="text-xs text-text-muted font-medium">
            حجب النقر عن كامل الـ iframe باستثناء منافذ تصريح هندسية محددة
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-text cursor-pointer flex items-center gap-2">
            <span>تفعيل طبقة الاعتراض:</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="w-4 h-4 text-primary rounded border-border"
              data-testid="interaction-layer-enable-checkbox"
            />
          </label>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs p-3 bg-bg rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <span className="text-text-muted">حالة الطبقة:</span>
          {config.enabled ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Icon name="shield" size="sm" />
              <span>مفعلة — النقرات محظورة افتراضياً إلا في المناطق المصرحة ({enabledRegionsCount})</span>
            </span>
          ) : (
            <span className="text-text-muted font-bold flex items-center gap-1">
              <Icon name="unlock" size="sm" />
              <span>معطلة — المشغل حر بالكامل والنقرات تصل لكافة أرجاء الـ iframe</span>
            </span>
          )}
        </div>

        {/* Click Interception Counter */}
        <div className="flex items-center gap-2">
          <span className="text-text-muted">النقرات المحظورة المعترضة:</span>
          <span
            className="font-mono text-base font-bold text-primary px-2 py-0.5 bg-primary/10 rounded"
            data-testid="intercepted-clicks-counter"
          >
            {config.interceptClickCount}
          </span>
          <Button variant="ghost" size="sm" onClick={onResetCounter} className="text-[11px] h-6 px-1.5">
            تصفير
          </Button>
        </div>
      </div>

      {/* ── Independent Toggle: Block Pop-up Windows ── */}
      <BlockPopupsControl
        blockPopups={config.blockPopups}
        onChange={(blockPopups) => onChange({ blockPopups })}
        description="المشغل يعمل بالصلاحيات الافتراضية للـ iframe دون قيود ساندبوكس. يمكن تشغيل هذا الخيار بمفرده، أو دمجه مع طبقة اعتراض النقر ومنافذ التصريح الهندسية لحماية مزدوجة."
      />

      {/* ── Presets Selection ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text">نماذج المحاذاة الجاهزة للمناطق (Presets):</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetRegionsToDefault}
            className="text-[11px] h-7"
            data-testid="reset-regions-default-btn"
          >
            استعادة الترتيب الافتراضي
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            variant={config.activePreset === 'minimal-center' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleApplyPreset('minimal-center')}
            disabled={!config.enabled}
            className="text-xs justify-start truncate"
            data-testid="preset-minimal-center-btn"
          >
            <span>1. تشغيل مركزي فقط (Minimal)</span>
          </Button>

          <Button
            variant={config.activePreset === 'standard-controls' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleApplyPreset('standard-controls')}
            disabled={!config.enabled}
            className="text-xs justify-start truncate"
            data-testid="preset-standard-controls-btn"
          >
            <span>2. أزرار التحكم الكاملة (Standard)</span>
          </Button>

          <Button
            variant={config.activePreset === 'google-drive-aligned' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleApplyPreset('google-drive-aligned')}
            disabled={!config.enabled}
            className="text-xs justify-start truncate"
            data-testid="preset-google-drive-aligned-btn"
          >
            <span>3. محاذاة Google Drive</span>
          </Button>

          <Button
            variant={config.activePreset === 'youtube-aligned' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleApplyPreset('youtube-aligned')}
            disabled={!config.enabled}
            className="text-xs justify-start truncate"
            data-testid="preset-youtube-aligned-btn"
          >
            <span>4. محاذاة YouTube</span>
          </Button>
        </div>
      </div>

      {/* ── Visual Guides Toggles ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 bg-bg rounded-lg border border-border text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.showVisualGuide}
            onChange={(e) => onChange({ showVisualGuide: e.target.checked })}
            disabled={!config.enabled}
            className="w-4 h-4 text-primary rounded border-border"
            data-testid="toggle-visual-guide-checkbox"
          />
          <span className="font-semibold text-text">
            إظهار الدليل المرئي للمناطق والمحاكاة (Visual Simulation Guide)
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.showBlockedAreasTint}
            onChange={(e) => onChange({ showBlockedAreasTint: e.target.checked })}
            disabled={!config.enabled}
            className="w-4 h-4 text-primary rounded border-border"
            data-testid="toggle-blocked-tint-checkbox"
          />
          <span className="font-semibold text-text">
            تظليل المناطق المحظورة (Shade Blocked Areas)
          </span>
        </label>
      </div>

      {/* ── Configurable Regions List ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text">
            المناطق المسموح بمرور النقر خلالها للـ iframe ({config.regions.length}):
          </span>
          <Button
            variant="outline"
            size="sm"
            leftIcon="plus"
            onClick={handleAddRegion}
            disabled={!config.enabled}
            className="text-xs h-7"
            data-testid="add-region-btn"
          >
            + إضافة منطقة مسموحة جديدة
          </Button>
        </div>

        {config.regions.length === 0 ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-800 dark:text-rose-300 text-center">
            لا توجد أي مناطق مسموحة مفعلة؛ المشغل محجوب بالكامل 100% ولا يمكن النقر على أي جزء منه.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1" data-testid="regions-list-container">
            {config.regions.map((region) => (
              <div
                key={region.id}
                className={`p-3 rounded-xl border transition-all space-y-3 ${
                  region.enabled
                    ? 'bg-bg border-emerald-500/40 shadow-xs'
                    : 'bg-surface/50 border-border opacity-60'
                }`}
                data-testid={`region-item-${region.id}`}
              >
                {/* Region Header */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={region.enabled}
                      onChange={(e) => handleToggleRegion(region.id, e.target.checked)}
                      disabled={!config.enabled}
                      className="w-4 h-4 text-emerald-600 rounded border-border"
                      data-testid={`region-toggle-${region.id}`}
                    />
                    <input
                      type="text"
                      value={region.name}
                      onChange={(e) => handleUpdateRegion(region.id, { name: e.target.value })}
                      disabled={!config.enabled}
                      className="font-bold text-text bg-transparent border-b border-dashed border-border focus:border-primary focus:outline-none text-xs px-1"
                    />
                    <Badge
                      variant={
                        region.action === 'fullscreen' || region.type === 'fullscreen'
                          ? 'primary'
                          : region.enabled
                            ? 'success'
                            : 'neutral'
                      }
                      className="text-[10px]"
                    >
                      {region.action === 'fullscreen' || region.type === 'fullscreen'
                        ? 'إجراء مدار: ملء الشاشة'
                        : region.enabled
                          ? 'نافذة مرور (Pass-Through)'
                          : 'معطلة (محجوبة)'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={region.action || (region.type === 'fullscreen' ? 'fullscreen' : 'passthrough')}
                      onChange={(e) => {
                        const act = e.target.value as 'passthrough' | 'fullscreen';
                        handleUpdateRegion(region.id, {
                          action: act,
                          type: act === 'fullscreen' ? 'fullscreen' : (region.type === 'fullscreen' ? 'custom' : region.type),
                        });
                      }}
                      disabled={!config.enabled || !region.enabled}
                      className="bg-bg border border-border rounded px-1.5 py-0.5 text-[10px] text-text focus:border-primary focus:outline-none"
                      data-testid={`region-action-select-${region.id}`}
                    >
                      <option value="passthrough">تمرير النقر (Pass-Through)</option>
                      <option value="fullscreen">إجراء مدار: ملء الشاشة (Managed Fullscreen)</option>
                    </select>

                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
                      <span>X:{region.x}%</span>
                      <span>Y:{region.y}%</span>
                      <span>W:{region.width}%</span>
                      <span>H:{region.height}%</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRegion(region.id)}
                        disabled={!config.enabled}
                        className="text-rose-600 hover:text-rose-700 h-6 w-6 p-0"
                        title="حذف هذه المنطقة"
                        data-testid={`delete-region-${region.id}`}
                      >
                        <Icon name="trash" size="sm" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Coordinate Sliders (Responsive Percentages) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-border/50">
                  {/* Left (X) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">الموضع الأفقي (Left X):</span>
                      <span className="font-mono font-bold text-primary">{region.x}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={95}
                      step={1}
                      value={region.x}
                      onChange={(e) => handleUpdateRegion(region.id, { x: Number(e.target.value) })}
                      disabled={!config.enabled || !region.enabled}
                      className="w-full accent-primary cursor-pointer disabled:opacity-40"
                      data-testid={`slider-x-${region.id}`}
                    />
                  </div>

                  {/* Top (Y) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">الموضع الرأسي (Top Y):</span>
                      <span className="font-mono font-bold text-primary">{region.y}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={95}
                      step={1}
                      value={region.y}
                      onChange={(e) => handleUpdateRegion(region.id, { y: Number(e.target.value) })}
                      disabled={!config.enabled || !region.enabled}
                      className="w-full accent-primary cursor-pointer disabled:opacity-40"
                      data-testid={`slider-y-${region.id}`}
                    />
                  </div>

                  {/* Width */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">العرض (Width):</span>
                      <span className="font-mono font-bold text-primary">{region.width}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={1}
                      value={region.width}
                      onChange={(e) => handleUpdateRegion(region.id, { width: Number(e.target.value) })}
                      disabled={!config.enabled || !region.enabled}
                      className="w-full accent-primary cursor-pointer disabled:opacity-40"
                      data-testid={`slider-w-${region.id}`}
                    />
                  </div>

                  {/* Height */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">الارتفاع (Height):</span>
                      <span className="font-mono font-bold text-primary">{region.height}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={1}
                      value={region.height}
                      onChange={(e) => handleUpdateRegion(region.id, { height: Number(e.target.value) })}
                      disabled={!config.enabled || !region.enabled}
                      className="w-full accent-primary cursor-pointer disabled:opacity-40"
                      data-testid={`slider-h-${region.id}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Honest Architectural Notice ── */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-text-muted space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-primary-dark">
          <Icon name="info" size="sm" />
          <span>المبدأ الهندسي لطبقة تصريح النقر (Geometric Pass-Through Architecture):</span>
        </div>
        <p className="leading-relaxed">
          تعمل هذه الطبقة عبر حجب سطح الـ iframe بالكامل افتراضياً بواسطة مسار SVG متكامل، ثم فتح نوافذ هندسية (Openings) فوق المناطق المسموحة فقط عبر خاصية <code>fill-rule=&quot;evenodd&quot;</code>.
        </p>
        <p className="leading-relaxed text-[11px]">
          <strong>تنبيه المحاذاة:</strong> النقرة تمر بالكامل إلى المشغل الأصلي عند نفس الإحداثيات؛ فإذا كانت المنطقة غير محاذية تماماً لعنصر التحكم الفعلي في Google Drive أو YouTube، ستصل النقرة للإحداثي الخاطئ ولن ينفذ الإجراء المطلوب.
          نحن <strong>لا نتحكم بالتشغيل</strong> ولا نرسل أوامر JavaScript إلى الـ iframe.
        </p>
      </div>
    </div>
  );
};
