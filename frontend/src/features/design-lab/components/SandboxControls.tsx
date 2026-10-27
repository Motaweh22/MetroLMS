import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type { SandboxConfig, SandboxPreset } from '../types/videoLabTypes';

export interface SandboxControlsProps {
  config: SandboxConfig;
  onChange: (updated: Partial<SandboxConfig>) => void;
  sandboxString: string;
}

export const SandboxControls: React.FC<SandboxControlsProps> = ({
  config,
  onChange,
  sandboxString,
}) => {
  const handleApplyPreset = (preset: SandboxPreset) => {
    switch (preset) {
      case 'least-restrictive':
        onChange({
          preset,
          allowScripts: true,
          allowSameOrigin: true,
          allowPopups: true,
          allowPopupsToEscapeSandbox: true,
          allowForms: true,
          allowPresentation: true,
        });
        break;
      case 'block-popups':
        onChange({
          preset,
          allowScripts: true,
          allowSameOrigin: true,
          allowPopups: false,
          allowPopupsToEscapeSandbox: false,
          allowForms: true,
          allowPresentation: true,
        });
        break;
      case 'strict':
        onChange({
          preset,
          allowScripts: true,
          allowSameOrigin: false,
          allowPopups: false,
          allowPopupsToEscapeSandbox: false,
          allowForms: false,
          allowPresentation: false,
        });
        break;
      case 'custom':
        onChange({ preset: 'custom' });
        break;
    }
  };

  const handleFlagToggle = (flagKey: keyof Omit<SandboxConfig, 'preset'>, val: boolean) => {
    onChange({
      [flagKey]: val,
      preset: 'custom',
    });
  };

  return (
    <div
      className="p-5 bg-surface border border-border rounded-xl space-y-4"
      data-testid="sandbox-controls-panel"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="primary" className="text-xs">
            تجربة B: عزل بيئة الأمان (Sandboxed Iframe)
          </Badge>
          <span className="text-xs text-text-muted font-medium">
            اختبار قيود المتصفح على النوافذ المنبثقة والتنقل الخارجي
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono bg-bg-alt px-2.5 py-1 rounded border border-border">
          <span className="text-text-muted">السمة المطبقة:</span>
          <span className="text-primary font-bold">{sandboxString || '(ساندبوكس مقفل بالكامل)'}</span>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-text">نماذج التهيئة المسبقة (Presets):</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            variant={config.preset === 'least-restrictive' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleApplyPreset('least-restrictive')}
            className="text-xs justify-start"
            data-testid="sandbox-preset-least-restrictive"
          >
            <span>1. الأقل تقييداً (Baseline)</span>
          </Button>

          <Button
            variant={config.preset === 'block-popups' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleApplyPreset('block-popups')}
            className="text-xs justify-start"
            data-testid="sandbox-preset-block-popups"
          >
            <span>2. حظر النوافذ (Block Popups)</span>
          </Button>

          <Button
            variant={config.preset === 'strict' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleApplyPreset('strict')}
            className="text-xs justify-start"
            data-testid="sandbox-preset-strict"
          >
            <span>3. ساندبوكس صارم (Strict)</span>
          </Button>
        </div>
      </div>

      {/* Individual Flags Configuration */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-text">التحكم الدقيق في صلاحيات الساندبوكس (Custom Flags):</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-bg rounded-lg border border-border">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.allowScripts}
              onChange={(e) => handleFlagToggle('allowScripts', e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
              data-testid="flag-allow-scripts"
            />
            <div>
              <span className="font-semibold text-text">allow-scripts</span>
              <p className="text-[10px] text-text-muted">تشغيل JavaScript للمشغل</p>
            </div>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.allowSameOrigin}
              onChange={(e) => handleFlagToggle('allowSameOrigin', e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
              data-testid="flag-allow-same-origin"
            />
            <div>
              <span className="font-semibold text-text">allow-same-origin</span>
              <p className="text-[10px] text-text-muted">الاحتفاظ بملفات الجلسة والكوكيز</p>
            </div>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.allowPopups}
              onChange={(e) => handleFlagToggle('allowPopups', e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
              data-testid="flag-allow-popups"
            />
            <div>
              <span className="font-semibold text-text">allow-popups</span>
              <p className="text-[10px] text-text-muted">السماح بفتح نوافذ وعلامات تبويب جديدة</p>
            </div>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.allowPopupsToEscapeSandbox}
              onChange={(e) => handleFlagToggle('allowPopupsToEscapeSandbox', e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
              data-testid="flag-allow-popups-escape"
            />
            <div>
              <span className="font-semibold text-text">allow-popups-to-escape-sandbox</span>
              <p className="text-[10px] text-text-muted">منح النوافذ الجديدة حرية كاملة</p>
            </div>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.allowForms}
              onChange={(e) => handleFlagToggle('allowForms', e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
              data-testid="flag-allow-forms"
            />
            <div>
              <span className="font-semibold text-text">allow-forms</span>
              <p className="text-[10px] text-text-muted">إرسال استمارات المصادقة والتفاعل</p>
            </div>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.allowPresentation}
              onChange={(e) => handleFlagToggle('allowPresentation', e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
              data-testid="flag-allow-presentation"
            />
            <div>
              <span className="font-semibold text-text">allow-presentation</span>
              <p className="text-[10px] text-text-muted">دعم وضع ملء الشاشة والبث</p>
            </div>
          </label>
        </div>
      </div>

      {/* Real-time Diagnostics & Critical Warnings */}
      <div className="space-y-2">
        {!config.allowScripts && (
          <div
            className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-800 dark:text-rose-300 space-y-1"
            data-testid="sandbox-no-scripts-warning"
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Icon name="alertCircle" size="sm" className="text-rose-600" />
              <span>تحذير حرج — تعطل المشغل بالكامل:</span>
            </div>
            <p className="leading-relaxed">
              تعطيل <code className="font-mono bg-rose-100 dark:bg-rose-900/50 px-1 py-0.5 rounded">allow-scripts</code> يمنع تشغيل بيئة JavaScript تماماً داخل الـ iframe، مما يتسبب في شاشة سوداء أو انهيار فوري لمشغلات YouTube و Google Drive.
            </p>
          </div>
        )}

        {config.allowScripts && !config.allowSameOrigin && (
          <div
            className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-800 dark:text-amber-300 space-y-1"
            data-testid="sandbox-no-same-origin-warning"
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Icon name="alert" size="sm" className="text-amber-600" />
              <span>تنبيه سياق الأصل الفريد (Unique Origin):</span>
            </div>
            <p className="leading-relaxed">
              غياب <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">allow-same-origin</code> يمنع المشغل من الوصول إلى بيانات الاعتماد والملفات المخزنة لجلسة المستخدم، مما قد يُظهر شاشات طلب تسجيل الدخول المتكررة في Google Drive.
            </p>
          </div>
        )}

        {!config.allowPopups && (
          <div
            className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary-dark space-y-1"
            data-testid="sandbox-popups-blocked-info"
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Icon name="shield" size="sm" />
              <span>نتيجة تقييم النوافذ المنبثقة (Pop-out Behavior):</span>
            </div>
            <p className="leading-relaxed">
              <strong>حظر النوافذ المنبثقة:</strong> يظل زر الفتح الخارجي ظاهراً بصرياً داخل معاينة Google Drive (لأنه مرسوم داخل إطار الـ iframe)،
              ولكن عند النقر عليه من قِبل المستخدم، يرفض المتصفح فتح علامة التبويب الجديدة طبقاً لقيود الساندبوكس، مع إظهار إشعار حظر أمني في كونسول المتصفح.
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-text-muted italic">
        * يتم تطبيق إعدادات الساندبوكس حصرياً على إطار المعمل التجريبي، ولا تُطبق مطلقاً على مشغلات الإنتاج الخاصة بالمتدربين.
      </p>
    </div>
  );
};
