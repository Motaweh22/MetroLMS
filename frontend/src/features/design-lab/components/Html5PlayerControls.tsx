import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import type { SourceParseResult } from '../types/videoLabTypes';

export interface Html5PlayerControlsProps {
  sourceResult: SourceParseResult;
  onSelectDirectPreset: () => void;
  onSelectLocalPreset: () => void;
  onCustomLocalFileSelect: (file: File) => void;
}

export const Html5PlayerControls: React.FC<Html5PlayerControlsProps> = ({
  sourceResult,
  onSelectDirectPreset,
  onSelectLocalPreset,
  onCustomLocalFileSelect,
}) => {
  const isWebpageSource = sourceResult.sourceType === 'youtube' || sourceResult.sourceType === 'google-drive';

  return (
    <div
      className="p-5 bg-surface border border-border rounded-xl space-y-4"
      data-testid="html5-player-controls-panel"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="success" className="text-xs">
            تجربة C: مشغل HTML5 الأصيل (Native &lt;video&gt; Element)
          </Badge>
          <span className="text-xs text-text-muted font-medium">
            بديل معماري كامل لتجنب أطر الـ iframe وضوابط موفري الخدمة الخارجية
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-text-muted">حالة الدعم:</span>
          {sourceResult.canPlayHtml5 ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Icon name="checkCircle" size="sm" />
              <span>مدعوم كملف وسائط مباشر</span>
            </span>
          ) : (
            <span className="text-rose-600 font-bold flex items-center gap-1">
              <Icon name="alertCircle" size="sm" />
              <span>يتطلب مشغل iframe مدمج</span>
            </span>
          )}
        </div>
      </div>

      {isWebpageSource ? (
        <div
          className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3"
          data-testid="html5-incompatible-warning"
        >
          <div className="flex items-start gap-2.5">
            <Icon name="alert" size="md" className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
              <h4 className="font-bold text-sm">
                المصدر المحدد لا يمكن تغذيته مباشرة لوسم &lt;video src&gt;:
              </h4>
              <p className="leading-relaxed">
                رابط <strong>{sourceResult.sourceType === 'youtube' ? 'YouTube' : 'Google Drive Preview'}</strong> المحدد يُعيد صفحة ويب كاملة بصيغة <code>text/html</code> ومحمية بسياسات CORS وتشفير ثنائي، وليس تدفق وسائط نقي (Binary Media Stream).
                تمرير هذا الرابط إلى عنصر <code>&lt;video src&gt;</code> سيؤدي حتماً إلى خطأ في فك التشفير (MediaDecodeError) أو فشل تحميل المصدر.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20 text-xs">
            <span className="font-semibold text-text">جرّب المقارنة بمصادر وسائط متوافقة:</span>
            <Button variant="outline" size="sm" onClick={onSelectDirectPreset}>
              تحميل ملف MP4 شبكي مباشر
            </Button>
            <Button variant="outline" size="sm" onClick={onSelectLocalPreset}>
              تحميل فيديو محلي (Baseline)
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-2"
          data-testid="html5-compatible-success"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <Icon name="checkCircle" size="sm" className="text-emerald-700 dark:text-emerald-400" />
            <span>المصدر جاهز للتشغيل عبر عنصر HTML5 &lt;video&gt;:</span>
          </div>
          <p className="leading-relaxed">
            يتم تشغيل الفيديو عبر محرك الوسائط المحلي للمتصفح مع شريط التحكم القياسي. لا توجد أي أطر خارجية (iframes) أو أزرار فتح نوافذ منبثقة أو قيود Cross-Origin في هذا النمط.
          </p>
        </div>
      )}

      {/* Local Video Custom File Upload */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-3 bg-bg rounded-lg border border-border text-xs">
        <div className="space-y-0.5">
          <span className="font-bold text-text">اختبار ملف فيديو محلي مخصص:</span>
          <p className="text-[11px] text-text-muted">
            يمكنك اختيار أي ملف فيديو من جهازك (MP4 / WebM) لتجربة سلوك المشغل الأصيل فورياً.
          </p>
        </div>
        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-dark transition-colors">
          <Icon name="upload" size="sm" />
          <span>اختيار ملف محلي...</span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onCustomLocalFileSelect(file);
            }}
            data-testid="local-video-file-input"
          />
        </label>
      </div>

      {/* Architectural Comparison Note */}
      <div className="p-3 bg-surface border border-border rounded-lg text-xs text-text-muted space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-text">
          <Icon name="info" size="sm" className="text-primary" />
          <span>المقارنة المعمارية بين نمط الـ iframe ونمط مشغل HTML5:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 leading-relaxed text-[11px]">
          <li><strong>مشغل الـ iframe:</strong> ضروري لخدمات الطرف الثالث (YouTube / Vimeo / Drive)، لكنه يخضع لقيود سياسات الأمان والحماية والواجهة الخاصة بموفر الخدمة.</li>
          <li><strong>مشغل HTML5 الأصيل:</strong> يمنح المنصة سيطرة كاملة 100% على الواجهة والتصميم وسرعة التشغيل ومنع النوافذ المنبثقة، ولكنه يتطلب استضافة الملفات على خوادم سحابية مباشرة ذات سعات تخزينية وباندويث خاص.</li>
        </ul>
      </div>
    </div>
  );
};
