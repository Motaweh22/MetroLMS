import React, { useState } from 'react';
import type { Course, CourseZipPolicy, ItemDownloadPolicy, ChapterItem } from '@/core/courses/types';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { getEligibleZipItems } from '@/core/courses/downloadPolicy';
import { createZipBlob } from '@/core/utils/zipGenerator';

export interface DownloadPoliciesEditorProps {
  course: Course;
  onChange: (updatedCourse: Course) => void;
}

export const DownloadPoliciesEditor: React.FC<DownloadPoliciesEditorProps> = ({
  course,
  onChange,
}) => {
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [zipMessage, setZipMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const currentZipPolicy: CourseZipPolicy = course.courseZipPolicy || 'disabled';

  const handleZipPolicyChange = (policy: CourseZipPolicy) => {
    onChange({
      ...course,
      courseZipPolicy: policy,
    });
  };

  const handleItemPolicyChange = (
    chapterId: string,
    itemId: string,
    policy: ItemDownloadPolicy
  ) => {
    const updatedChapters = course.chapters.map((ch) => {
      if (ch.id !== chapterId) return ch;
      const updatedItems = ch.items.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          downloadPolicy: policy,
          canDownload: policy !== 'never',
        };
      });
      return { ...ch, items: updatedItems };
    });

    onChange({
      ...course,
      chapters: updatedChapters,
    });
  };

  // Test / Prototype ZIP Generation
  const handleTestZipDownload = async () => {
    setZipMessage(null);
    setIsGeneratingZip(true);

    try {
      if (currentZipPolicy === 'disabled') {
        setZipMessage({
          text: 'تنزيل أرشيف الدورة معطل حالياً وفق الإعدادات أعلاه.',
          isError: true,
        });
        setIsGeneratingZip(false);
        return;
      }

      // Collect eligible items (simulating an instructor or completed trainee)
      const allItemIds = course.chapters.flatMap((c) => c.items.map((i) => i.id));
      const eligibleItems = getEligibleZipItems(
        course,
        true, // simulate completed
        allItemIds,
        true, // isEnrolled
        'lecturer'
      );

      if (eligibleItems.length === 0) {
        setZipMessage({
          text: 'لا توجد أي ملفات مؤهلة للتنزيل في هذا المقرر (جميع الملفات إما معطلة أو غير متوفرة).',
          isError: true,
        });
        setIsGeneratingZip(false);
        return;
      }

      // Prepare files for the ZIP
      const zipFiles = eligibleItems.map(({ chapterTitle, item }) => {
        const ext = item.type === 'pdf' ? 'pdf' : item.type === 'video' ? 'mp4' : 'txt';
        const safeChapter = chapterTitle.replace(/[\\/:*?"<>|]/g, '_');
        const safeItem = item.title.replace(/[\\/:*?"<>|]/g, '_');
        const fileName = `${safeChapter}/${safeItem}.${ext}`;

        // Create sample placeholder content for demonstration
        const sampleContent = `Cairo Metro LMS - Training Resource\nCourse: ${course.title}\nChapter: ${chapterTitle}\nItem: ${item.title}\nType: ${item.type}\nDownload Policy: ${item.downloadPolicy || 'default'}`;

        return {
          name: fileName,
          data: sampleContent,
        };
      });

      // Generate the ZIP blob
      const blob = createZipBlob(zipFiles);
      const url = URL.createObjectURL(blob);

      // Trigger browser download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${course.title || 'Course'}_Bundle.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setZipMessage({
        text: `تم توليد وتنزيل أرشيف ZIP بنجاح بحجم ${(blob.size / 1024).toFixed(1)} KB يشمل ${eligibleItems.length} ملفات مؤهلة.`,
      });
    } catch {
      setZipMessage({
        text: 'حدث خطأ أثناء محاولة تجميع حزمة ZIP للمقرر.',
        isError: true,
      });
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const allItems: { chapterId: string; chapterTitle: string; item: ChapterItem }[] = [];
  for (const ch of course.chapters) {
    for (const it of ch.items) {
      allItems.push({ chapterId: ch.id, chapterTitle: ch.title, item: it });
    }
  }

  return (
    <div className="space-y-6" data-testid="download-policies-editor">
      {/* Whole-Course ZIP Policy Card */}
      <div className="p-5 rounded-2xl border border-border bg-surface shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-text-heading flex items-center gap-2">
            <Icon name="download" size="sm" className="text-primary" />
            <span>سياسة تنزيل أرشيف الدورة كاملاً (ZIP Archive)</span>
          </h3>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            تتيح هذه الخاصية للمتدربين تنزيل حزمة مضغوطة تشمل كافة المرفقات والمستندات المصرح بتنزيلها دفعة واحدة.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              id: 'disabled',
              title: 'معطل (غير متاح)',
              desc: 'لا يمكن للمتدربين تنزيل الدورة كاملة في ملف ZIP',
            },
            {
              id: 'immediate',
              title: 'متاح فوراً',
              desc: 'متاح للتنزيل فور تسجيل المتدرب في الدورة التدريبية',
            },
            {
              id: 'after_course_completion',
              title: 'بعد إتمام الدورة 100%',
              desc: 'متاح كمكافأة وحقيبة مرجعية بعد استكمال كافة الدروس',
            },
          ].map((pol) => (
            <label
              key={pol.id}
              className={`p-3.5 rounded-xl border text-right cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                currentZipPolicy === pol.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:bg-neutral-light text-text-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${currentZipPolicy === pol.id ? 'text-primary' : 'text-text-heading'}`}>
                  {pol.title}
                </span>
                <input
                  type="radio"
                  name="course-zip-policy"
                  value={pol.id}
                  checked={currentZipPolicy === pol.id}
                  onChange={() => handleZipPolicyChange(pol.id as CourseZipPolicy)}
                  className="accent-primary"
                  data-testid={`zip-policy-${pol.id}`}
                />
              </div>
              <p className="text-[11px] text-text-muted">{pol.desc}</p>
            </label>
          ))}
        </div>

        {/* Test Download Prototype Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="text-xs text-text-muted">
            يمكنك اختبار توليد حزمة ZIP وتنزيلها محلياً للتأكد من شمول الملفات المصرح بها
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestZipDownload}
            disabled={isGeneratingZip || currentZipPolicy === 'disabled'}
            className="self-end gap-1.5 font-bold shrink-0"
            data-testid="test-zip-download-btn"
          >
            <Icon name="download" size="sm" />
            <span>{isGeneratingZip ? 'جاري التجميع...' : 'تجربة تنزيل أرشيف ZIP'}</span>
          </Button>
        </div>

        {zipMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              zipMessage.isError
                ? 'bg-danger/10 text-danger border border-danger/20'
                : 'bg-success/10 text-success border border-success/20'
            }`}
          >
            {zipMessage.text}
          </div>
        )}
      </div>

      {/* Individual File Download Policies Matrix */}
      <div className="p-5 rounded-2xl border border-border bg-surface shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-text-heading flex items-center gap-2">
            <Icon name="file" size="sm" className="text-primary" />
            <span>سياسات التنزيل الفردية لكل محتوى</span>
          </h3>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            تحكم في إمكانية تنزيل كل درس بشكل مستقل. يمكنك مثلاً حظر تنزيل مقاطع الفيديو مع السماح بتنزيل مستندات PDF.
          </p>
        </div>

        {allItems.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-text-muted">
            لا توجد دروس أو ملفات مضافة بعد لتحديد سياسات تنزيلها.
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-bg-alt/50 border-b border-border text-text-muted">
                <tr>
                  <th className="p-3 font-bold">العنصر التعليمي</th>
                  <th className="p-3 font-bold">النوع</th>
                  <th className="p-3 font-bold">سياسة التنزيل المقررة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allItems.map(({ chapterId, chapterTitle, item }) => {
                  const policy = item.downloadPolicy || (item.type === 'video' ? 'never' : 'immediate');
                  return (
                    <tr key={item.id} className="hover:bg-neutral-light/50 transition-colors">
                      <td className="p-3 font-semibold text-text-heading">
                        <div>{item.title}</div>
                        <div className="text-[10px] text-text-muted font-normal">{chapterTitle}</div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={item.type === 'video' ? 'primary' : 'neutral'}
                          className="text-[10px]"
                        >
                          {item.type}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {item.type === 'video' && (item.videoSourceType === 'youtube' || item.videoSourceType === 'drive') ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-text-muted" data-testid={`external-video-policy-${item.id}`}>
                            <Icon name="lock" size="sm" className="text-text-muted shrink-0" />
                            <span>
                              فيديو خارجي ({item.videoSourceType === 'youtube' ? 'YouTube' : 'Google Drive'}) — غير متاح للتنزيل المباشر
                            </span>
                          </div>
                        ) : (
                          <select
                            value={policy}
                            onChange={(e) =>
                              handleItemPolicyChange(
                                chapterId,
                                item.id,
                                e.target.value as ItemDownloadPolicy
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-text text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                            data-testid={`select-policy-${item.id}`}
                          >
                            <option value="never">غير متاح للتنزيل نهائياً (حظر)</option>
                            <option value="immediate">متاح للتنزيل فوراً</option>
                            <option value="after_item_completion">متاح بعد إتمام هذا الدرس</option>
                            <option value="after_course_completion">متاح بعد إتمام الكورس كاملاً</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage Architecture & Future Migration Notice */}
      <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 text-xs text-text-muted space-y-1.5">
        <div className="font-bold text-text-heading flex items-center gap-2">
          <Icon name="info" size="sm" className="text-warning-dark" />
          <span>تنويه المعمارية والبيئة التخزينية:</span>
        </div>
        <p className="leading-relaxed">
          في هذه المرحلة التحديثية، تُدار الملفات المرفقة والتعديلات في بيئة المتصفح والذاكرة المؤقتة (In-Memory / Local Storage Backup).
          سيتم ربط التخزين الدائم للوسائط الكبيرة وحزم الأرشيف مع خدمة التخزين السحابي الآمنة (Cloud Object Storage) في المراحل الخلفية.
        </p>
      </div>
    </div>
  );
};

export default DownloadPoliciesEditor;
