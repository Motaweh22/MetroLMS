import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Icon, ICON_REGISTRY, type SemanticIconName, type IconSize } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/ui/Card';
import { FormInput } from '@/shared/ui/FormInput';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Alert } from '@/shared/ui/Alert';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { PageLoading, SectionSkeleton, type SkeletonVariant } from '@/shared/ui/Loading';
import { ErrorState } from '@/shared/ui/Error';
import { VideoInteractionLab } from '@/features/design-lab/components/VideoInteractionLab';

export const DesignSystemPreviewPage: React.FC = () => {
  const toast = useToast();
  // Interactive preview states
  const [buttonLoading, setButtonLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeProgress, setActiveProgress] = useState(65);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [selectedIconSize, setSelectedIconSize] = useState<IconSize>('lg');
  const [demoSkeletonVariant, setDemoSkeletonVariant] = useState<SkeletonVariant>('card');

  const registeredIconKeys = Object.keys(ICON_REGISTRY) as SemanticIconName[];

  return (
    <div className="min-h-screen bg-bg text-text pb-24 selection:bg-primary/20">
      {/* Design System Page Sub-banner */}
      <div className="border-b border-border bg-surface/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1"
            >
              <Icon name="arrowRight" size="sm" />
              <span>العودة للوحة المتابعة</span>
            </Link>
            <span className="text-border">|</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-light text-primary-dark border border-primary/20">
              Increment 1: Design System Laboratory
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon="video"
              onClick={() => {
                document.getElementById('section-video-interaction-lab')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              معمل تجارب الفيديو
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon="palette"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              أعلى الصفحة
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col gap-12">
        {/* Intro Hero */}
        <section className="bg-gradient-to-l from-primary-light/40 to-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-primary-dark font-bold text-sm">
            <Icon name="sparkles" size="md" />
            <span>المعمل البصري الموحد لمكونات الواجهة الأمامية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark tracking-tight">
            نظام تصميم منصة تدريب مترو القاهرة — Cairo Metro LMS
          </h1>
          <p className="text-sm text-text-muted max-w-3xl leading-relaxed">
            بيئة تفاعلية لاختبار المكونات الموحدة ومطابقة نسب التباين الدقيقة (WCAG 2.1 AA) والتحقق من التجاوب الكامل باللغة العربية (RTL) دون أي ارتباط بالبيانات أو بالصفحات التشغيلية.
          </p>
        </section>

        {/* ── Section 1: Brand & Logo Usage ── */}
        <section id="section-brand" className="flex flex-col gap-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-lg font-bold text-primary-dark flex items-center gap-2">
              <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
              1. استخدامات الهوية والشعار المؤسسي (Brand &amp; Logo Usage)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              مكون مركزي موحد <code className="text-primary-dark bg-bg-alt px-1 py-0.5 rounded">&lt;BrandLogo /&gt;</code> يستمد أصوله من إعدادات الهوية المركزية في <code className="text-primary-dark bg-bg-alt px-1 py-0.5 rounded">brand.ts</code>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="default">
              <CardHeader>
                <CardTitle>النمط الأفقي الكامل (Horizontal)</CardTitle>
                <CardDescription>الاستخدام القياسي في رأس الصفحات والقوائم العريضة</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center min-h-[90px] bg-bg rounded border border-border/50">
                <BrandLogo variant="horizontal" size="md" />
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>النمط المدمج (Compact)</CardTitle>
                <CardDescription>للشاشات الصغيرة والشرائح الضيقة دون العنوان الفرعي</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center min-h-[90px] bg-bg rounded border border-border/50">
                <BrandLogo variant="compact" size="md" />
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>الأيقونة الرمزية فقط (Icon-Only)</CardTitle>
                <CardDescription>للأشرطة الجانبية المصغرة وأيقونات التبويب</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center min-h-[90px] bg-bg rounded border border-border/50">
                <BrandLogo variant="icon-only" size="lg" />
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>شعار مركز التدريب (Training)</CardTitle>
                <CardDescription>الأصل الخاص بالمنظومة التدريبية لمركز المترو</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center min-h-[90px] bg-bg rounded border border-border/50">
                <BrandLogo variant="training" size="md" />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Section 2: Semantic Iconography ── */}
        <section id="section-icons" className="flex flex-col gap-4">
          <div className="border-b border-border pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-primary-dark flex items-center gap-2">
                <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
                2. سجل الأيقونات الدلالي الموحد (Semantic Icon Registry)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                مبني على <code className="text-primary-dark bg-bg-alt px-1 py-0.5 rounded">lucide-react</code> مع حظر الاستيراد المباشر، وتوفير أمان نوعي كامل ومعالجة الأيقونات المفقودة.
              </p>
            </div>

            {/* Size Switcher */}
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg p-1">
              <span className="text-[11px] text-text-muted px-2 font-medium">الحجم:</span>
              {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedIconSize(sz)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                    selectedIconSize === sz
                      ? 'bg-primary-dark text-white'
                      : 'text-text-muted hover:text-text hover:bg-bg-alt'
                  }`}
                >
                  {sz === 'sm' ? '14px' : sz === 'md' ? '16px' : sz === 'lg' ? '20px' : '24px'}
                </button>
              ))}
            </div>
          </div>

          <Card variant="default">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {registeredIconKeys.map((iconName) => (
                  <div
                    key={iconName}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-border/60 bg-bg hover:border-primary/50 hover:bg-surface/60 transition-all text-center group"
                  >
                    <div className="p-2.5 rounded-md bg-surface text-primary-dark group-hover:bg-primary-light group-hover:text-primary-dark transition-colors">
                      <Icon name={iconName} size={selectedIconSize} />
                    </div>
                    <span className="text-[11px] font-mono font-medium text-text-muted truncate max-w-full">
                      {iconName}
                    </span>
                  </div>
                ))}

                {/* Development Fallback Test Card */}
                <div className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-warning-dark/50 bg-warning-light/30 text-center">
                  <div className="p-2.5 rounded-md bg-warning-light text-warning-dark">
                    <Icon name="unregistered-icon-sample" size={selectedIconSize} />
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-warning-dark">
                    اختبار fallback
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 3: Color Tokens & WCAG Contrast ── */}
        <section id="section-colors" className="flex flex-col gap-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-lg font-bold text-primary-dark flex items-center gap-2">
              <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
              3. رموز الألوان المعتمدة ومصفوفة التباين النفاذية (WCAG 2.1 AA)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              القيم الرياضية المحسوبة دقيقة 100%، وتضمن أن جميع النصوص تحقق معايير النفاذية الدولية للرؤية بوضوح.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Primary Action Button Contrast */}
            <div className="bg-[#1A3F6F] text-white p-5 rounded-lg shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">زر الإجراء الرئيسي</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/20 text-white">10.58 : 1 (AAA)</span>
              </div>
              <div>
                <p className="text-sm font-bold">خلفية #1A3F6F مع نص أبيض #FFFFFF</p>
                <p className="text-xs opacity-80 mt-0.5">تتجاوز متطلبات النفاذية الصارمة لأزرار التسجيل والدخول</p>
              </div>
            </div>

            {/* Cyan Accent Contrast Rule */}
            <div className="bg-[#5BBFDE] text-[#1A3F6F] p-5 rounded-lg shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">السمة السماوية المميزة</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#1A3F6F] text-white">5.01 : 1 (AA)</span>
              </div>
              <div>
                <p className="text-sm font-bold">خلفية #5BBFDE مع نص كحلي #1A3F6F</p>
                <p className="text-xs opacity-80 mt-0.5">قاعدة معمارية: حظر النص الأبيض فوق السماوي (2.11:1)</p>
              </div>
            </div>

            {/* Success Status Contrast */}
            <div className="bg-[#E8F5E9] text-[#2E7D32] border border-[#2E7D32]/20 p-5 rounded-lg shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">حالة النجاح / الاكتمال</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#2E7D32] text-white">4.56 : 1 (AA)</span>
              </div>
              <div>
                <p className="text-sm font-bold">خلفية #E8F5E9 مع نص #2E7D32</p>
                <p className="text-xs opacity-80 mt-0.5">شارات إكمال الدورة واستحقاق الشهادة المعتمدة</p>
              </div>
            </div>

            {/* Warning Status Contrast */}
            <div className="bg-[#FEF3C7] text-[#B45309] border border-[#B45309]/20 p-5 rounded-lg shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">حالة التنبيه / الموعد القريب</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#B45309] text-white">4.51 : 1 (AA)</span>
              </div>
              <div>
                <p className="text-sm font-bold">خلفية #FEF3C7 مع نص #B45309</p>
                <p className="text-xs opacity-80 mt-0.5">شارات المواعيد القريبة وعدم بدء التدريب</p>
              </div>
            </div>

            {/* Danger Status Contrast (Corrected) */}
            <div className="bg-[#FEE2E2] text-[#B91C1C] border border-[#B91C1C]/20 p-5 rounded-lg shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">حالة الخطر / المتأخر (معدلة)</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#B91C1C] text-white">5.30 : 1 (AA)</span>
              </div>
              <div>
                <p className="text-sm font-bold">خلفية #FEE2E2 مع نص معدل #B91C1C</p>
                <p className="text-xs opacity-80 mt-0.5">استبدال النص القديم #D32F2F (4.08:1) لتحقيق النفاذية</p>
              </div>
            </div>

            {/* Info Status Contrast (Corrected) */}
            <div className="bg-[#E0F2FE] text-[#0369A1] border border-[#0369A1]/20 p-5 rounded-lg shadow-sm flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">المعلومات / الإلزامي (معدلة)</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#0369A1] text-white">5.17 : 1 (AA)</span>
              </div>
              <div>
                <p className="text-sm font-bold">خلفية #E0F2FE مع نص معدل #0369A1</p>
                <p className="text-xs opacity-80 mt-0.5">استبدال النص القديم #0284C7 (3.57:1) لتحقيق النفاذية</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: Typography & Spacing Hierarchy ── */}
        <section id="section-typography" className="flex flex-col gap-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-lg font-bold text-primary-dark flex items-center gap-2">
              <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
              4. الطباعة العربية المحلية وتدرج العناوين (Cairo Local Typography)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              خط Cairo المحزم محلياً (Zero External CDN Dependency) مع أوزان 400، 600، و700.
            </p>
          </div>

          <Card variant="default">
            <CardContent className="p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
                <span className="text-xs font-mono text-text-muted">Heading 1 — Bold 700 / text-2xl</span>
                <h1 className="text-2xl font-bold text-primary-dark">
                  منظومة تدريب وتشغيل قطارات مترو القاهرة الكبرى
                </h1>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
                <span className="text-xs font-mono text-text-muted">Heading 2 — Bold 700 / text-xl</span>
                <h2 className="text-xl font-bold text-primary-dark">
                  برنامج تدريب قائدي القطارات والفنيين على الخط الثالث (العتبة — عدلي منصور)
                </h2>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
                <span className="text-xs font-mono text-text-muted">Heading 3 — SemiBold 600 / text-base</span>
                <h3 className="text-base font-semibold text-text">
                  إجراءات السلامة وإدارة الطوارئ والاتصالات اللاسلكية بمركز التحكم المركزي (OCC)
                </h3>
              </div>

              <div className="flex flex-col gap-1 border-b border-border/50 pb-4">
                <span className="text-xs font-mono text-text-muted">Body Text — Regular 400 / text-sm leading-relaxed</span>
                <p className="text-sm text-text leading-relaxed">
                  يهدف هذا البرنامج التدريبي المعتمد إلى تزويد الكوادر الفنية بأحدث آليات التعامل مع أنظمة الإشارات الأوتوماتيكية، ومكابح الطوارئ، وبروتوكولات الإخلاء الآمن للركاب في المحطات النفقية والعلوية، طبقاً للمواصفات القياسية لهيئة مترو القاهرة.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-mono text-text-muted">Metadata / Caption — Medium 500 / text-xs</span>
                <p className="text-xs text-text-muted">
                  تاريخ الاعتماد الرسمي: 15 أكتوبر 2026 — الإدارة العامة للموارد البشرية ومركز التدريب التخصصي
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 5: Buttons & Form Controls ── */}
        <section id="section-controls" className="flex flex-col gap-4">
          <div className="border-b border-border pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-primary-dark flex items-center gap-2">
                <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
                5. الأزرار وحقول الإدخال (Buttons &amp; Form Controls)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                حالات تفاعلية متكاملة (افتراضي، تمرير، تركيز، تعطيل، وتحميل لحظي).
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon="refresh"
              onClick={() => setButtonLoading(!buttonLoading)}
            >
              {buttonLoading ? 'إلغاء وضع التحميل' : 'تبديل وضع التحميل (Loading State)'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Buttons Matrix */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>أنماط وأحجام الأزرار المعتمدة</CardTitle>
                <CardDescription>خمسة أنماط معيارية مطبقة في كافة شاشات المنظومة</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Primary */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="lg" leftIcon="check" isLoading={buttonLoading}>
                    رئيسي كبير
                  </Button>
                  <Button variant="primary" size="md" leftIcon="courses" isLoading={buttonLoading}>
                    تسجيل في الدورة
                  </Button>
                  <Button variant="primary" size="sm" isLoading={buttonLoading}>
                    صغير
                  </Button>
                  <Button variant="primary" size="md" disabled>
                    معطل (Disabled)
                  </Button>
                </div>

                {/* Secondary */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" size="md" leftIcon="eye">
                    معاينة المحتوى
                  </Button>
                  <Button variant="secondary" size="sm" leftIcon="download">
                    تحميل المذكرة
                  </Button>
                  <Button variant="secondary" size="md" disabled>
                    ثانوي معطل
                  </Button>
                </div>

                {/* Destructive & Outline */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="destructive" size="md" leftIcon="trash">
                    حذف الكورس
                  </Button>
                  <Button variant="outline" size="md" leftIcon="filter">
                    تصفية النتائج
                  </Button>
                  <Button variant="ghost" size="md" leftIcon="settings">
                    إعدادات
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Form Inputs */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>حقول الإدخال والتحقق (Form Inputs)</CardTitle>
                <CardDescription>دعم كامل للنصوص المساعدة ورسائل الخطأ والرموز الملحقة</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FormInput
                  label="اسم المتدرب أو الرقم الوظيفي"
                  placeholder="مثال: م. عبد الرحمن محمود (EMP-4091)"
                  helperText="أدخل الاسم الرباعي كما هو مدون في سجلات المترو"
                  startIcon="user"
                  required
                />

                <FormInput
                  label="البحث عن كورس أو محاضر"
                  placeholder="ابحث بالاسم أو رمز الدورة التدريبية..."
                  startIcon="search"
                  endIcon="filter"
                />

                <FormInput
                  label="البريد الإلكتروني المؤسسي"
                  value="invalid-email-metro"
                  error="صيغة البريد الإلكتروني غير صحيحة، يجب أن ينتهي بنطاق @cairometro.gov.eg"
                  startIcon="alert"
                  readOnly
                />

                <FormInput
                  label="رقم بطاقة التشغيل (معطل)"
                  value="METRO-CARD-99021"
                  disabled
                  helperText="هذا الحقل للقراءة فقط ولا يمكن تعديله"
                  startIcon="lock"
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Section 6: Cards, Badges & Progress Indicators ── */}
        <section id="section-cards" className="flex flex-col gap-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-lg font-bold text-primary-dark flex items-center gap-2">
              <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
              6. البطاقات والشارات وأشرطة التقدم (Cards, Badges &amp; Progress)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              مكونات العرض الميداني المستخدمة في بطاقات الكورسات ولوحات القيادة.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Badges Overview */}
            <Card variant="default" className="lg:col-span-1">
              <CardHeader>
                <CardTitle>شارات الحالة المعتمدة (Badges)</CardTitle>
                <CardDescription>بألوان متباينة تلائم معايير النفاذية الدولية</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2.5">
                <Badge variant="primary" icon="courses">كورس إلزامي</Badge>
                <Badge variant="success" icon="checkCircle">مكتمل 100%</Badge>
                <Badge variant="warning" icon="alert">موعد قريب (48h)</Badge>
                <Badge variant="danger" icon="xCircle">متأخر عن الجدول</Badge>
                <Badge variant="info" icon="info">مسودة قيد التدقيق</Badge>
                <Badge variant="neutral" dot>غير مسجل</Badge>
                <Badge variant="success" dot size="sm">مؤهل للشهادة</Badge>
                <Badge variant="warning" dot size="sm">لم يبدأ بعد</Badge>
              </CardContent>
            </Card>

            {/* Realistic Course Card Simulation */}
            <Card variant="interactive" className="lg:col-span-1 flex flex-col justify-between">
              <div>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="primary" icon="shield">تشغيل المترو</Badge>
                    <span className="text-xs font-semibold text-text-muted flex items-center gap-1">
                      <Icon name="clock" size="sm" /> 24 ساعة
                    </span>
                  </div>
                  <CardTitle>نظم الإشارات والتحكم في مسارات قطارات الخط الأول</CardTitle>
                  <CardDescription>
                    المحاضر: د. أسامة فاروق — الإدارة العامة للتحكم والإشارات
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-text-muted mb-4 leading-relaxed line-clamp-2">
                    دورة تدريبية متخصصة تغطي تشغيل دوائر القضبان، ومكابح الأمان الأوتوماتيكية، وأنظمة التداخل والتحويلات الكهربائية.
                  </p>
                  <ProgressBar
                    value={activeProgress}
                    label="نسبة الإنجاز الحالي للمتدرب"
                    variant={activeProgress >= 100 ? 'success' : activeProgress < 25 ? 'warning' : 'primary'}
                  />
                </CardContent>
              </div>
              <CardFooter>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Icon name="trainingGroups" size="sm" />
                  <span>340 متدرب مسجل</span>
                </div>
                <Button variant="primary" size="sm" leftIcon="play">
                  متابعة التدريب
                </Button>
              </CardFooter>
            </Card>

            {/* Interactive Progress Control */}
            <Card variant="default" className="lg:col-span-1">
              <CardHeader>
                <CardTitle>أشرطة الإنجاز والتحكم التفاعلي</CardTitle>
                <CardDescription>جرّب تغيير النسبة لمعاينة استجابة مؤشر التقدم</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>التحكم في نسبة التقدم:</span>
                    <span className="text-primary-dark font-mono">{activeProgress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={activeProgress}
                    onChange={(e) => setActiveProgress(Number(e.target.value))}
                    className="w-full accent-primary-dark cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <ProgressBar value={activeProgress} size="sm" label="مؤشر صغير (sm - 6px)" variant="primary" />
                  <ProgressBar value={activeProgress} size="md" label="مؤشر قياسي (md - 10px)" variant="success" />
                  <ProgressBar value={activeProgress} size="lg" label="مؤشر عريض (lg - 14px)" variant="danger" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Section 7: Alerts & Modal Interactions ── */}
        <section id="section-modals" className="flex flex-col gap-4">
          <div className="border-b border-border pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-primary-dark flex items-center gap-2">
                <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
                7. التنبيهات والنوافذ المنبثقة (Alerts &amp; Modal Dialogs)
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                تنبيهات حالة بألوان AA مع نوافذ حوارية تدعم إغلاق ESC وقفل التمرير التلقائي.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              leftIcon="send"
              onClick={() => setIsModalOpen(true)}
            >
              فتح نافذة الاختبار المنبثقة (Modal)
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Alert variant="info" title="تنبيه تنظيمي من إدارة التدريب">
              يرجى إنهاء كافة الوحدات التدريبية المخصصة للخط الثاني قبل يوم الخميس القادم لتأكيد حضور الاختبار العملي بمحطة شبرا الخيمة.
            </Alert>

            <Alert variant="success" title="تم اكتمال الدورة التدريبية بنجاح">
              تهانينا! لقد حققت نسبة 100% في دورة السلامة المهنية، وأصبحت شهادتك المعتمدة جاهزة للطباعة من سجل التدريب.
            </Alert>

            <Alert variant="warning" title="اقتراب الموعد النهائي للدورة">
              متبقي أقل من 48 ساعة على موعد تسليم مشروع المحاكاة؛ يرجى رفع الملفات المتبقية لتفادي تجميد الشهادة طبقاً لسياسة المنظومة.
            </Alert>

            {!dismissedAlert ? (
              <Alert
                variant="danger"
                title="تنبيه تأخير عن جدول الدفعة (قابل للإغلاق)"
                onClose={() => setDismissedAlert(true)}
              >
                نسبة تقدمك الحالية أقل من المعدل المتوقع للدفعة؛ انقر علامة الإغلاق لحفظ إشعار المتابعة والاطلاع عليه لاحقاً.
              </Alert>
            ) : (
              <div className="p-4 rounded-md border border-dashed border-border bg-surface/50 text-xs text-text-muted flex items-center justify-between">
                <span>تم إغلاق تنبيه الخطر بنجاح.</span>
                <Button variant="ghost" size="sm" onClick={() => setDismissedAlert(false)}>
                  إعادة إظهار التنبيه
                </Button>
              </div>
            )}
          </div>
        </section>
        
        {/* ── Section 8: Toasts & Transient Feedback ── */}
        <section className="space-y-4" data-testid="toasts-section">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">
              8. إشعارات وتنبيهات منبثقة (Toasts & Transient Feedback)
            </h2>
            <p className="text-sm text-text-muted mt-1">
              نظام إشعارات طافية خفيفة وعابرة تظهر بزاوية الشاشة دون حجب المحتوى أو إحداث اهتزاز في تخطيط الصفحة، مع تجميد العداد عند فتح النوافذ المنبثقة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-6 bg-surface border border-border rounded-xl">
            <Button
              variant="outline"
              size="sm"
              leftIcon="checkCircle"
              className="text-success-dark border-success/30 hover:bg-success/10"
              onClick={() => toast.success('تم حفظ التعديلات بنجاح في سجل النظام.')}
            >
              إشعار نجاح (Success)
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon="xCircle"
              className="text-danger-dark border-danger/30 hover:bg-danger/10"
              onClick={() => toast.error('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة لاحقاً.')}
            >
              إشعار خطأ (Error)
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon="alert"
              className="text-warning-dark border-warning/30 hover:bg-warning/10"
              onClick={() => toast.warning('تنبيه: اقتراب الموعد النهائي لتسليم التقرير.')}
            >
              إشعار تحذير (Warning)
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon="info"
              className="text-info-dark border-info/30 hover:bg-info/10"
              onClick={() =>
                toast.info('تم تحديث جدول المحاضرات الميدانية.', {
                  action: {
                    label: 'عرض التفاصيل',
                    onClick: () => {
                      /* demo action */
                    },
                  },
                })
              }
            >
              إشعار معلومة مع زر إجراء (Info + Action)
            </Button>
          </div>
        </section>

        {/* ── Section 9: Video Interaction Lab Experiments ── */}
        <VideoInteractionLab />

        {/* ── Section 10: Loading Indicators & Error Handling States ── */}
        <section id="section-loading-error" className="space-y-6" data-testid="loading-error-section">
          <div className="border-b border-border pb-2">
            <h2 className="text-xl font-bold text-primary-dark flex items-center gap-2">
              <span className="w-2 h-5 bg-primary-dark rounded-full inline-block" />
              10. منظومة التحميل وحالات الخطأ (Loading Systems & Error States)
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              مكونات تحميل متوافقة مع إمكانية الوصول وسياق الصفحة (داخل الصفحة، وهياكل عظمية Skeleton) مع حالات الخطأ القياسية 404، 403، و 500.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* In-Page Loading Demo */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>مؤشر التحميل الداخلي (PageLoading)</CardTitle>
                <CardDescription>يحافظ على هيكل وقوائم الصفحة أثناء جلب البيانات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-dashed border-border rounded-xl bg-bg-alt/30">
                  <PageLoading message="جارٍ استرجاع بيانات التدريب والمؤشرات..." minHeight="min-h-[160px]" />
                </div>
              </CardContent>
            </Card>

            {/* ErrorState Demo */}
            <Card variant="default">
              <CardHeader>
                <CardTitle>حالة الخطأ مع خيار الإعادة (ErrorState)</CardTitle>
                <CardDescription>عرض رسائل منقحة ومعربة مع إمكانية تكرار الطلب</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border border-dashed border-border rounded-xl bg-bg-alt/30">
                  <ErrorState
                    title="تعذر الاتصال بخادم التدريب"
                    message="تم فحص الاتصال وتأكد انقطاع الاستجابة المؤقت. يمكنك المحاولة مجدداً دون فقدان المدخلات."
                    onRetry={() => toast.info('تم استدعاء محاولة الاتصال المجدولة')}
                    minHeight="min-h-[160px]"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Skeletons Demo */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>الهياكل العظمية التكيفية (SectionSkeleton)</CardTitle>
              <CardDescription>أنماط بطاقات، جداول، مؤشرات، ونصوص تدعم تقليل الحركة (prefers-reduced-motion)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-2">
                <Button
                  size="sm"
                  variant={demoSkeletonVariant === 'card' ? 'primary' : 'outline'}
                  onClick={() => setDemoSkeletonVariant('card')}
                >
                  بطاقات (Cards)
                </Button>
                <Button
                  size="sm"
                  variant={demoSkeletonVariant === 'table' ? 'primary' : 'outline'}
                  onClick={() => setDemoSkeletonVariant('table')}
                >
                  جدول بيانات (Table)
                </Button>
                <Button
                  size="sm"
                  variant={demoSkeletonVariant === 'metric' ? 'primary' : 'outline'}
                  onClick={() => setDemoSkeletonVariant('metric')}
                >
                  مؤشرات رقمية (Metrics)
                </Button>
                <Button
                  size="sm"
                  variant={demoSkeletonVariant === 'text' ? 'primary' : 'outline'}
                  onClick={() => setDemoSkeletonVariant('text')}
                >
                  نصوص وفقرات (Text)
                </Button>
              </div>

              <div className="p-4 border border-border rounded-xl bg-bg">
                <SectionSkeleton variant={demoSkeletonVariant} count={demoSkeletonVariant === 'text' ? 2 : 3} />
              </div>
            </CardContent>
          </Card>

          {/* Direct Navigation to Error Pages */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>صفحات الخطأ المستقلة (Dedicated Error Pages)</CardTitle>
              <CardDescription>معاينة سريعة للصفحات المعتمدة للمنظومة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link to="/404">
                  <Button variant="outline" size="sm" leftIcon="alertCircle">
                    معاينة صفحة 404 (Not Found)
                  </Button>
                </Link>
                <Link to="/403">
                  <Button variant="outline" size="sm" leftIcon="lock">
                    معاينة صفحة 403 (Forbidden)
                  </Button>
                </Link>
                <Link to="/500">
                  <Button variant="outline" size="sm" leftIcon="alert">
                    معاينة صفحة 500 (Server Error)
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ── Working Modal Dialog Instance ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="تأكيد اعتماد الدورة التدريبية ونشرها"
        description="خطوة مراجعة نهائية قبل إتاحة محتوى التدريب لكافة متدربي هيئة مترو القاهرة"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              إلغاء الأمر
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon="check"
              onClick={() => {
                toast.success('تم اعتماد الإجراء التجريبي بنجاح!');
                setIsModalOpen(false);
              }}
            >
              تأكيد النشر والاعتماد
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert variant="info" title="ملاحظة هامة للمشرف">
            بمجرد النشر، سيصل إشعار فوري لجميع متدربي الدفعة المسجلين على هذا الخط، وستبدأ عدادات المواعيد التنازلية بالعمل تلقائياً.
          </Alert>

          <FormInput
            label="اسم المشرف المعتمد"
            value="م. رئيس قسم التفتيش الفني"
            readOnly
            startIcon="user"
          />

          <FormInput
            label="ملاحظات الاعتماد والتوصيات"
            placeholder="أدخل أي ملاحظات ترغب في توجيهها للمحاضر أو للمتدربين..."
            startIcon="edit"
          />
        </div>
      </Modal>
    </div>
  );
};

export default DesignSystemPreviewPage;
