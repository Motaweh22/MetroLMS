import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Modal } from '@/shared/ui/Modal';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { NAVIGATION_SECTIONS } from '@/shared/config/navigation';
import { useAuth } from '@/features/auth';
import { ROLE_CANONICAL_LABELS_AR } from '@/core/permissions/types';
import type { UserRole } from '@/core/auth/types';

const roleBadgeVariants: Record<string, 'primary' | 'warning' | 'info'> = {
  developer: 'primary',
  super_admin: 'primary',
  admin: 'primary',
  assistant_admin: 'warning',
  lecturer: 'warning',
  user: 'info',
};

export const DashboardPreviewPage: React.FC = () => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const { user, switchDemoUser, logout, isLoading } = useAuth();

  const increments = [
    { num: '0', title: 'الأساس التقني والرموز', status: 'completed', badge: 'مكتمل' },
    { num: '1', title: 'معمل التصميم والمكونات', status: 'completed', badge: 'مكتمل' },
    { num: '2', title: 'هيكل التطبيق والتجاوب', status: 'completed', badge: 'مكتمل' },
    { num: '3', title: 'تسجيل الدخول والجلسات', status: 'active', badge: 'المرحلة الحالية' },
    { num: '4', title: 'دليل الدورات التدريبية', status: 'next', badge: 'المرحلة التالية' },
    { num: '5', title: 'التسجيل في الدورات', status: 'planned', badge: 'مجدول' },
    { num: '6', title: 'مشغل التعلم ونسب الإنجاز', status: 'planned', badge: 'مجدول' },
    { num: '7', title: 'المجموعات ولوحات التحكم', status: 'planned', badge: 'مجدول' },
    { num: '8', title: 'منشئ المحتوى للمحاضرين', status: 'planned', badge: 'مجدول' },
    { num: '9', title: 'التدقيق واعتماد الجودة', status: 'planned', badge: 'مجدول' },
    { num: '10', title: 'مراقبة المواعيد الحرجة', status: 'planned', badge: 'مجدول' },
    { num: '11', title: 'الإدارة والتكامل الشامل', status: 'planned', badge: 'مجدول' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary-dark via-primary to-primary-light p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-accent-cyan border border-white/20">
            <Icon name="sparkles" size="sm" />
            <span>المرحلة 3: تسجيل الدخول والجلسات التجريبية (Increment 3)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
            هيكل المنظومة التدريبية الذكية لمترو القاهرة
          </h1>

          <p className="text-sm sm:text-base text-neutral-light/90 leading-relaxed font-normal">
            تم بنجاح تفعيل دورة حياة الجلسات الآمنة ونظام الدخول التجريبي عبر اعتراض الطلبات بواسطة Mock Service Worker (MSW v2)،
            مع حماية المسارات وتحديث بطاقة المستخدم في شريط التنقل فورياً.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {user?.role === 'developer' && (
              <Link to="/design-system">
                <Button variant="secondary" size="md" leftIcon="palette" className="shadow-xs font-bold">
                  استعراض معمل التصميم (Increment 1)
                </Button>
              </Link>
            )}

            <Button
              variant="outline"
              size="md"
              leftIcon="info"
              className="text-white border-white/40 hover:bg-white/10 hover:text-white"
              onClick={() => setIsDemoModalOpen(true)}
            >
              تعليمات فحص المصادقة والجلسات
            </Button>
          </div>
        </div>

        {/* Decorative Background Accents */}
        <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-accent-cyan/10 blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />
      </div>

      {/* Active User Session & Persona Switcher Card */}
      {user && (
        <Card variant="elevated" className="border-primary/20 bg-surface">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-dark text-white font-bold text-base shadow-sm shrink-0">
                  {user.initials}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{user.name}</CardTitle>
                    <Badge variant={roleBadgeVariants[user.role] || 'neutral'}>
                      {ROLE_CANONICAL_LABELS_AR[user.role as UserRole] || user.role}
                    </Badge>
                  </div>
                  <CardDescription>
                    {user.jobTitle} • {user.department}
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon="logout"
                  onClick={logout}
                  className="text-danger-dark border-danger/30 hover:bg-danger-light"
                >
                  تسجيل الخروج
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 border-t border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-text-heading flex items-center gap-1.5">
                <Icon name="refresh" size="sm" className="text-primary" />
                <span>التبديل الفوري بين الحسابات التجريبية (Quick Persona Swapper):</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={user.role === 'admin' ? 'primary' : 'outline'}
                  size="sm"
                  disabled={isLoading || user.role === 'admin'}
                  onClick={() => switchDemoUser('admin')}
                  className="text-xs"
                >
                  {ROLE_CANONICAL_LABELS_AR.admin}
                </Button>
                <Button
                  variant={user.role === 'lecturer' ? 'primary' : 'outline'}
                  size="sm"
                  disabled={isLoading || user.role === 'lecturer'}
                  onClick={() => switchDemoUser('lecturer')}
                  className="text-xs"
                >
                  {ROLE_CANONICAL_LABELS_AR.lecturer}
                </Button>
                <Button
                  variant={user.role === 'user' ? 'primary' : 'outline'}
                  size="sm"
                  disabled={isLoading || user.role === 'user'}
                  onClick={() => switchDemoUser('user')}
                  className="text-xs"
                >
                  {ROLE_CANONICAL_LABELS_AR.user}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Notice Banner */}
      {!dismissedNotice && (
        <Alert
          variant="info"
          title="معايير الحوكمة وضبط الروابط المجدولة"
          onClose={() => setDismissedNotice(true)}
        >
          تم عزل الروابط المجدولة للمراحل القادمة (مثل دليل الدورات، المجموعات، وإدارة النظام) عمداً في شريط التنقل
          مع وسمها بوضوح بأنها «مجدولة»، ومنع فتح أي روابط فارغة لمنع أي انطباع وهمي بجاهزية منطق الأعمال قبل موعده المعتمد.
        </Alert>
      )}

      {/* Shell Capabilities Inspection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="default">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-primary-light flex items-center justify-center text-primary-dark mb-3">
              <Icon name="shield" size="lg" />
            </div>
            <CardTitle>حماية المسارات (Route Guard)</CardTitle>
            <CardDescription>عزل التطبيق عن الزوار غير المسجلين</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-text-muted space-y-2">
            <p>
              يمنع الوصول للوحة المتابعة دون جلسة نشطة، مع حفظ المسار المطلوب وإعادة توجيه المستخدم إليه بعد الدخول.
            </p>
            <Badge variant="success">معتمد ومفعل</Badge>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-info-light flex items-center justify-center text-info-dark mb-3">
              <Icon name="user" size="lg" />
            </div>
            <CardTitle>جلسة المتصفح (Session Lifecycle)</CardTitle>
            <CardDescription>استرجاع فوري ومنع حفظ كلمات المرور</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-text-muted space-y-2">
            <p>
              تخزين منظم عبر sessionStorage يحافظ على استمرارية الجلسة عند التحديث دون كتابة أي كلمات مرور إطلاقاً.
            </p>
            <Badge variant="success">معتمد ومفعل</Badge>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-accent-coral/10 flex items-center justify-center text-accent-coral mb-3">
              <Icon name="sparkles" size="lg" />
            </div>
            <CardTitle>المحاكاة الشبكية (MSW v2)</CardTitle>
            <CardDescription>اعتراض REST API على مستوى Network</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-text-muted space-y-2">
            <p>
              اعتراض كامل لمسارات المصادقة (/api/auth/login, /api/auth/logout, /api/auth/me) بدقة وواقعية دون سيرفر حقيقي.
            </p>
            <Badge variant="success">معتمد ومفعل</Badge>
          </CardContent>
        </Card>

        {user?.role === 'developer' && (
          <Card variant="default">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-warning-light flex items-center justify-center text-warning-dark mb-3">
                <Icon name="palette" size="lg" />
              </div>
              <CardTitle>معمل التصميم للمطورين</CardTitle>
              <CardDescription>معمل التصميم ونظام المكونات</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-text-muted space-y-2">
              <p>
                مسار /design-system متاح حصرياً لحساب المطور لفحص واختبار المكونات.
              </p>
              <Badge variant="primary">مطور فقط</Badge>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Roadmap Progress Section */}
      <Card variant="elevated">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>خارطة طريق التطوير التدريجي (12 مرحلة)</CardTitle>
              <CardDescription>
                متابعة تقدم التنفيذ خطوة بخطوة وفق مبادئ الحوكمة والاعتماد المسبق
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="text-xs font-bold">
                إنجاز 33% من المراحل الأساسية
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProgressBar
            value={33}
            label="نسبة إنجاز الأساس المعماري والهيكل والمصادقة"
            showPercentage
            variant="primary"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {increments.map((inc) => (
              <div
                key={inc.num}
                className={`p-3 rounded-xl border text-center transition-all ${inc.status === 'completed'
                  ? 'bg-success-light/40 border-success/30 text-success'
                  : inc.status === 'active'
                    ? 'bg-primary-light border-primary text-primary-dark font-bold shadow-xs'
                    : inc.status === 'next'
                      ? 'bg-accent-coral/10 border-accent-coral/30 text-accent-coral'
                      : 'bg-surface border-border text-text-muted/60 opacity-75'
                  }`}
              >
                <div className="text-xs font-bold">مرحلة {inc.num}</div>
                <div className="text-xs truncate font-medium mt-1">{inc.title}</div>
                <div className="mt-2">
                  <Badge
                    variant={
                      inc.status === 'completed'
                        ? 'success'
                        : inc.status === 'active'
                          ? 'primary'
                          : inc.status === 'next'
                            ? 'warning'
                            : 'neutral'
                    }
                    className="text-[9px] px-1 py-0 font-normal"
                  >
                    {inc.badge}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation Registry Verification Card */}
      <Card variant="default">
        <CardHeader>
          <CardTitle>سجل الروابط والتنقل المركزي المعتمد</CardTitle>
          <CardDescription>
            مصفوفة تفصيلية توضح كل رابط ومساره والأيقونة المخصصة له وحالة تفعيله
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-light border-b border-border text-text-heading font-bold">
                <tr>
                  <th className="p-3">القسم</th>
                  <th className="p-3">الرابط</th>
                  <th className="p-3">المسار</th>
                  <th className="p-3">الأيقونة</th>
                  <th className="p-3">الحالة الحالية</th>
                  <th className="p-3">المرحلة المجدولة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {NAVIGATION_SECTIONS.flatMap((section) =>
                  section.items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-light/50 transition-colors">
                      <td className="p-3 font-semibold text-text-muted">{section.titleAr}</td>
                      <td className="p-3 font-bold text-text-heading">{item.titleAr}</td>
                      <td className="p-3 font-mono text-primary dir-ltr text-right">{item.path}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <Icon name={item.icon} size="sm" />
                          <span className="font-mono text-text-muted">{item.icon}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {item.status === 'implemented' ? (
                          <Badge variant="success">مفعل ويعمل</Badge>
                        ) : (
                          <Badge variant="neutral">معطل ومجدول</Badge>
                        )}
                      </td>
                      <td className="p-3 text-text-muted">
                        {item.plannedIncrement || 'المرحلة المعتمدة'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Modal for Verification Instructions */}
      <Modal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title="دليل فحص وتدقيق تسجيل الدخول والجلسات (Increment 3)"
        size="lg"
      >
        <div className="space-y-4 text-sm text-text leading-relaxed">
          <p>
            يرجى اتباع الخطوات التالية للتحقق من سلامة وجودة تنفيذ واجهة الدخول والجلسات المحاكية:
          </p>

          <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-text-muted font-medium">
            <li>
              <strong className="text-text-heading">تسجيل الخروج والتحويل لصفحة الدخول:</strong> انقر على زر «تسجيل الخروج» في شريط التنقل أو بطاقة المستخدم بالأعلى؛ ولاحظ إعادة التوجيه الفورية إلى صفحة الدخول المنفصلة (/login).
            </li>
            <li>
              <strong className="text-text-heading">حماية المسارات (Route Protection):</strong> حاول فتح رابط لوحة المتابعة (/dashboard) أثناء تسجيل الخروج، وتأكد من منع الوصول وإعادتك تلقائياً لصفحة الدخول مع تذكر المسار المطلوب.
            </li>
            <li>
              <strong className="text-text-heading">استخدام الحسابات التجريبية:</strong> في صفحة الدخول، انقر على أحد أزرار الحسابات الثلاثة (مسؤول النظام، محاضر، متدرب) لتعبئة البيانات تلقائياً، ثم انقر تسجيل الدخول.
            </li>
            <li>
              <strong className="text-text-heading">استمرارية الجلسة (Session Persistence):</strong> بعد تسجيل الدخول، قم بإعادة تحميل الصفحة (Refresh)؛ وتأكد من بقاء الجلسة نشطة وعرض اسم المستخدم الصحيح دون فقدان.
            </li>
            {user?.role === 'developer' && (
              <li>
                <strong className="text-text-heading">معمل التصميم للمطور:</strong> تحقق من إمكانية زيارة رابط (/design-system) أثناء الدخول بحساب المطور.
              </li>
            )}
          </ol>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" onClick={() => setIsDemoModalOpen(false)}>
              فهمت، إغلاق الدليل
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPreviewPage;
