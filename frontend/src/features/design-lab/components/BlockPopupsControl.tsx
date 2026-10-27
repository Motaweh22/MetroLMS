import React from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';

export interface BlockPopupsControlProps {
  blockPopups: boolean;
  onChange: (enabled: boolean) => void;
  title?: string;
  description?: string;
}

export const BlockPopupsControl: React.FC<BlockPopupsControlProps> = ({
  blockPopups,
  onChange,
  title = 'حظر النوافذ المنبثقة (Block Pop-up Windows):',
  description = 'المشغل يعمل بالصلاحيات الافتراضية للـ iframe دون قيود ساندبوكس. يمكن تشغيل هذا الخيار بمفرده، أو دمجه مع تقنيات العزل الأخرى لحماية إضافية.',
}) => {
  return (
    <div
      className="p-4 bg-bg rounded-xl border border-border space-y-3"
      data-testid="block-popups-panel"
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon
            name="lock"
            size="sm"
            className={blockPopups ? 'text-primary' : 'text-text-muted'}
          />
          <span className="text-xs font-bold text-text">
            {title}
          </span>
          <Badge variant={blockPopups ? 'primary' : 'neutral'} className="text-[10px]">
            {blockPopups ? 'حظر النوافذ نشط (Active)' : 'غير مفعل (Baseline)'}
          </Badge>
        </div>

        <label className="text-xs font-bold text-text cursor-pointer flex items-center gap-2">
          <span>تفعيل حظر النوافذ:</span>
          <input
            type="checkbox"
            checked={blockPopups}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 text-primary rounded border-border focus:ring-primary focus:ring-offset-0"
            data-testid="block-popups-toggle"
          />
        </label>
      </div>

      {blockPopups ? (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 bg-primary/10 border border-primary/20 rounded-lg font-mono text-[11px] text-primary-dark">
            <span>السمة المطبقة على الـ iframe:</span>
            <span className="font-bold">sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"</span>
          </div>

          <p className="text-text-muted leading-relaxed text-[11px]">
            تم تطبيق ساندبوكس متوازن يمنع المشغل من فتح علامات تبويب أو نوافذ جديدة (عبر حجب <code>allow-popups</code> و <code>allow-popups-to-escape-sandbox</code>)، مع الحفاظ التام على تشغيل السكربتات والصوت وملء الشاشة.
          </p>

          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-800 dark:text-amber-300 text-[11px] space-y-1">
            <div className="flex items-center gap-1 font-bold">
              <Icon name="alertCircle" size="sm" className="text-amber-600" />
              <span>تنبيه سلوك المتصفح مع المشغلات الخارجية:</span>
            </div>
            <p className="leading-relaxed">
              حظر النوافذ لا يمنع كل أنواع التنقل الداخلية، وقد يُظهر المتصفح تحذيراً أمنياً في الكونسول عند الضغط على زر الفتح في Google Drive.
              إذا لاحظت أي تأثير سلبي على فك التشفير أو الدخول بحساب Google، يمكنك إلغاء التفعيل فورياً.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(false)}
              className="text-[11px] h-6 px-2 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
              data-testid="restore-baseline-sandbox-btn"
            >
              إلغاء حظر النوافذ واستعادة الإعداد الافتراضي
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-text-muted leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
};
