import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import type { ManagedUserDTO } from '@/core/user-management/types';
import { USER_ROLE_LABELS_AR } from '@/core/user-management/types';
import type { SystemCapability } from '@/core/permissions/types';
import {
  ROLE_DEFAULT_CAPABILITIES,
  ROLE_CAPABILITY_CEILINGS,
  ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES,
  IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN,
  validatePermissionOverride,
} from '@/core/permissions/policy';
import { permissionsApi } from '../services/permissionsApi';
import {
  validateAndNormalizeEgyptianMobile,
  formatEgyptianMobileDisplay,
  whatsappApi,
} from '@/features/whatsapp';
import '../styles/user-permissions.css';


export interface UserPermissionsModalProps {
  isOpen: boolean;
  user: ManagedUserDTO | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface WhatsAppScenarioItem {
  key: 'account_registration' | 'password_recovery' | 'technical_support';
  labelAr: string;
  helperAr: string;
  iconName: string;
}

const WHATSAPP_SCENARIOS: WhatsAppScenarioItem[] = [
  {
    key: 'account_registration',
    labelAr: 'إنشاء حساب جديد',
    helperAr: 'يظهر ضمن جهات التواصل في نافذة إنشاء حساب جديد.',
    iconName: 'user',
  },
  {
    key: 'password_recovery',
    labelAr: 'استعادة كلمة المرور',
    helperAr: 'يظهر ضمن جهات التواصل في نافذة استعادة كلمة المرور.',
    iconName: 'lock',
  },
  {
    key: 'technical_support',
    labelAr: 'الدعم الفني العام',
    helperAr: 'يظهر ضمن جهات التواصل عند استخدام أيقونة واتساب العائمة.',
    iconName: 'helpCircle',
  },
];

interface CapabilityItem {
  key: SystemCapability;
  labelAr: string;
  descriptionAr: string;
  isGroupScoped?: boolean;
}

interface CapabilityCategory {
  id: string;
  titleAr: string;
  icon: string;
  items: CapabilityItem[];
}

const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  {
    id: 'user_management',
    titleAr: 'دليل المستخدمين وإدارة الهويات',
    icon: 'users',
    items: [
      {
        key: 'users.view_directory',
        labelAr: 'استعراض دليل المستخدمين',
        descriptionAr: 'البحث والاستعراض في سجلات ودفاتر المستخدمين بالمنظومة',
      },
      {
        key: 'users.view_transcript',
        labelAr: 'استعراض السجل التدريبي والأكاديمي',
        descriptionAr: 'الاطلاع على تفاصيل إتمام الكورسات وسجلات التقدم',
      },
      {
        key: 'users.export_roster',
        labelAr: 'تصدير كشوف المستخدمين',
        descriptionAr: 'تصدير بيانات المتدربين والمستخدمين بصيغ خارجية',
      },
      {
        key: 'users.create',
        labelAr: 'إنشاء مستخدمين جدد',
        descriptionAr: 'إضافة حسابات جديدة وتعيين الرتب الأولية والبيانات الوظيفية',
      },
      {
        key: 'users.change_role',
        labelAr: 'تعديل الأدوار الوظيفية',
        descriptionAr: 'ترقية الحسابات أو تعديل الرتب في الدليل الموحد',
      },
      {
        key: 'users.change_status',
        labelAr: 'إيقاف وتنشيط الحسابات',
        descriptionAr: 'التعليق الإداري للحسابات مع حظر الدخول أو إعادة التنشيط',
      },
      {
        key: 'users.delete',
        labelAr: 'حذف الحسابات نهائياً',
        descriptionAr: 'حذف سجلات المستخدمين (يتطلب موافقة مدير النظام للمساعد، ومحظور بحق مديري النظام)',
      },
    ],
  },
  {
    id: 'training_groups',
    titleAr: 'المجموعات التدريبية والتسجيل',
    icon: 'bookOpen',
    items: [
      {
        key: 'groups.create',
        labelAr: 'إنشاء مجموعات تدريبية',
        descriptionAr: 'تكوين دفعات تدريبية جديدة وجدولة الدورات',
      },
      {
        key: 'groups.edit_config',
        labelAr: 'تعديل إعدادات المجموعات',
        descriptionAr: 'تعديل المواعيد، دورات التجديد، وسياسات المجموعات',
      },
      {
        key: 'groups.archive',
        labelAr: 'أرشفة المجموعات',
        descriptionAr: 'أرشفة الدفعات التدريبية بعد انتهاء برامجها',
      },
      {
        key: 'groups.manage_members',
        labelAr: 'إدارة وتعيين المتدربين',
        descriptionAr: 'إضافة المتدربين للمجموعة أو حذفهم منها مع حفظ السجلات',
        isGroupScoped: true,
      },
      {
        key: 'groups.generate_qr',
        labelAr: 'توليد رموز QR للتسجيل',
        descriptionAr: 'إنشاء ومشاركة رمز الانضمام السريع للمجموعة',
        isGroupScoped: true,
      },
      {
        key: 'groups.review_join_requests',
        labelAr: 'مراجعة طلبات الانضمام',
        descriptionAr: 'قبول أو رفض طلبات المتدربين للانضمام للمجموعة',
        isGroupScoped: true,
      },
    ],
  },
  {
    id: 'group_materials',
    titleAr: 'مواد المجموعات والاجتماعات التفاعلية',
    icon: 'fileText',
    items: [
      {
        key: 'materials.manage_folders',
        labelAr: 'إدارة مجلدات المجموعة',
        descriptionAr: 'إنشاء وتنظيم بنية المجلدات الإثرائية داخل المجموعة',
        isGroupScoped: true,
      },
      {
        key: 'materials.upload_files',
        labelAr: 'رفع المواد الإثرائية والملفات',
        descriptionAr: 'إرفاق المستندات والعروض للمتدربين داخل المجموعة',
        isGroupScoped: true,
      },
      {
        key: 'materials.delete_files',
        labelAr: 'حذف ملفات المجموعة',
        descriptionAr: 'إلغاء المواد الإثرائية المرفوعة سابقاً',
        isGroupScoped: true,
      },
      {
        key: 'materials.manage_meetings',
        labelAr: 'إدارة الاجتماعات التفاعلية',
        descriptionAr: 'جدولة ورش العمل والروابط الافتراضية عبر Teams / Zoom / Meet',
        isGroupScoped: true,
      },
    ],
  },
  {
    id: 'course_authoring',
    titleAr: 'تأليف الكورسات والمناهج الرسمية',
    icon: 'edit',
    items: [
      {
        key: 'courses.create',
        labelAr: 'إنشاء كورسات جديدة',
        descriptionAr: 'تأسيس مسودات كورسات جديدة في المنصة',
      },
      {
        key: 'courses.edit_metadata',
        labelAr: 'تعديل البيانات العامة للكورس',
        descriptionAr: 'تحديث العنوان، الوصف، صورة الغلاف، والتصنيفات',
      },
      {
        key: 'courses.edit_curriculum',
        labelAr: 'تعديل شجرة المنهج والدروس',
        descriptionAr: 'هيكلة الفصول التعليمية، المحاور، والاختبارات الرسمية',
      },
      {
        key: 'courses.upload_lectures',
        labelAr: 'رفع المحاضرات المرئية الرسمية',
        descriptionAr: 'إدراج مقاطع الفيديو والدروس الرقمية المعتمدة في المنهج',
      },
      {
        key: 'courses.delete_lectures',
        labelAr: 'حذف المحاضرات والدروس',
        descriptionAr: 'إزالة دروس رسمية من شجرة المنهج',
      },
      {
        key: 'courses.publish',
        labelAr: 'نشر المقرر التدريبي',
        descriptionAr: 'تنفيذ نشر المقرر المعتمد في الدليل العام للمنصة',
      },
    ],
  },
  {
    id: 'governance_and_reviews',
    titleAr: 'الاعتماد، الرقابة الثنائية وسجلات التدقيق',
    icon: 'shield',
    items: [
      {
        key: 'reviews.submit_course',
        labelAr: 'إرسال الكورس للاعتماد',
        descriptionAr: 'طلب مراجعة واعتماد الحقيبة التدريبية رسمياً للنشر',
      },
      {
        key: 'reviews.decide_course',
        labelAr: 'البت في نشر الكورسات',
        descriptionAr: 'الموافقة السيادية النهائية على نشر الكورس (محجوز حصراً لمدير النظام الأصيل)',
      },
      {
        key: 'approvals.submit_request',
        labelAr: 'تقديم طلبات العمليات الحساسة',
        descriptionAr: 'رفع طلبات العمليات الإدارية الخاضعة للرقابة الثنائية',
      },
      {
        key: 'approvals.decide_request',
        labelAr: 'البت في طلبات الاعتماد',
        descriptionAr: 'اعتماد أو رفض طلبات المساعدين الإداريين قبل التنفيذ',
      },
      {
        key: 'audit.view_system_logs',
        labelAr: 'استعراض سجل الرقابة الأمني',
        descriptionAr: 'فحص سجلات النشاط والأحداث الأمنية والتغييرات الحساسة',
      },
      {
        key: 'permissions.configure_roles',
        labelAr: 'تعديل صلاحيات الأدوار الافتراضية',
        descriptionAr: 'تعديل مصفوفة الصلاحيات الأساسية للأدوار الوظيفية',
      },
      {
        key: 'permissions.configure_users',
        labelAr: 'تخصيص الصلاحيات الفردية للمستخدمين',
        descriptionAr: 'منح وسحب الصلاحيات الاستثنائية للمستخدمين داخل السقف المسموح',
      },
      {
        key: 'permissions.manage_delegation',
        labelAr: 'إدارة التفويض التشغيلي المباشر',
        descriptionAr: 'تفويض المساعد الإداري لتنفيذ العمليات دون اعتماد روتيني',
      },
      {
        key: 'permissions.configure_departments',
        labelAr: 'ضبط مسارات تدريب الإدارات',
        descriptionAr: 'تحديد الكورسات الإلزامية والاختيارية لكل قطاع',
      },
    ],
  },
];

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  isOpen,
  user,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();

  const [grantedPerms, setGrantedPerms] = useState<Set<SystemCapability>>(new Set());
  const [revokedPerms, setRevokedPerms] = useState<Set<SystemCapability>>(new Set());
  const [configuredRoleDefaults, setConfiguredRoleDefaults] = useState<Set<SystemCapability>>(new Set());
  const [reason, setReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Local UI-only state for WhatsApp contact visibility responsibilities (Phase 1 manual design review)
  const [whatsAppAssignments, setWhatsAppAssignments] = useState<Record<string, boolean>>({
    account_registration: false,
    password_recovery: false,
    technical_support: false,
  });

  // Strict Egyptian mobile validation (single source of truth: user.phone)
  const normalizedPhone = useMemo(() => {
    return validateAndNormalizeEgyptianMobile(user?.phone);
  }, [user?.phone]);

  const isPhoneValid = Boolean(normalizedPhone);

  const formattedDisplayPhone = useMemo(() => {
    return formatEgyptianMobileDisplay(normalizedPhone);
  }, [normalizedPhone]);

  const isUserSuspended = user?.status === 'suspended';

  const handleToggleWhatsApp = (scenarioKey: 'account_registration' | 'password_recovery' | 'technical_support') => {
    if (!isPhoneValid) return;
    setWhatsAppAssignments((prev) => ({
      ...prev,
      [scenarioKey]: !prev[scenarioKey],
    }));
  };

  // Load existing overrides and WhatsApp visibility assignments for selected user
  useEffect(() => {
    if (!isOpen || !user) {
      setGrantedPerms(new Set());
      setRevokedPerms(new Set());
      setConfiguredRoleDefaults(new Set());
      setReason('');
      setError(null);
      setWhatsAppAssignments({
        account_registration: false,
        password_recovery: false,
        technical_support: false,
      });
      return;
    }

    const loadUserOverrides = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [res, rolesRes, waRes] = await Promise.all([
          permissionsApi.getUserPermissionOverride(user.id),
          permissionsApi.getRolePermissions().catch(() => []),
          whatsappApi.getUserWhatsAppVisibility(user.id).catch(() => null),
        ]);

        if (res.override) {
          const granted = res.override.grantedPermissions || res.override.granted || [];
          const revoked = res.override.revokedPermissions || res.override.revoked || [];
          setGrantedPerms(new Set(granted));
          setRevokedPerms(new Set(revoked));
          setReason(res.override.reason || '');
        } else {
          setGrantedPerms(new Set());
          setRevokedPerms(new Set());
          setReason('');
        }

        // Populate WhatsApp responsibility switches from saved assignments
        if (waRes && waRes.assignments) {
          const map: Record<string, boolean> = {
            account_registration: false,
            password_recovery: false,
            technical_support: false,
          };
          for (const item of waRes.assignments) {
            map[item.scenario] = Boolean(item.isActive);
          }
          setWhatsAppAssignments(map);
        } else {
          setWhatsAppAssignments({
            account_registration: false,
            password_recovery: false,
            technical_support: false,
          });
        }

        const roleCfg = rolesRes.find((r) => r.role === user.role);
        if (roleCfg && roleCfg.permissions && roleCfg.permissions.length > 0) {
          setConfiguredRoleDefaults(new Set(roleCfg.permissions));
        } else if (roleCfg && roleCfg.capabilities) {
          const active = (Object.keys(roleCfg.capabilities) as SystemCapability[]).filter(
            (k) => Boolean(roleCfg.capabilities![k])
          );
          setConfiguredRoleDefaults(new Set(active));
        } else {
          const defaults = ROLE_DEFAULT_CAPABILITIES[user.role] || {};
          const active = (Object.keys(defaults) as SystemCapability[]).filter((k) => Boolean(defaults[k]));
          setConfiguredRoleDefaults(new Set(active));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'فشل تحميل تخصيصات الصلاحيات ومسؤوليات واتساب';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserOverrides();
  }, [isOpen, user]);


  // Derived baseline and ceiling sets for this user's role
  const roleDefaults = useMemo(() => {
    if (!user) return new Set<SystemCapability>();
    if (configuredRoleDefaults.size > 0) return configuredRoleDefaults;
    const defaults = ROLE_DEFAULT_CAPABILITIES[user.role] || {};
    return new Set(
      (Object.keys(defaults) as SystemCapability[]).filter((k) => Boolean(defaults[k]))
    );
  }, [user, configuredRoleDefaults]);

  const roleCeiling = useMemo(() => {
    if (!user) return new Set<SystemCapability>();
    return ROLE_CAPABILITY_CEILINGS[user.role] || new Set<SystemCapability>();
  }, [user]);

  if (!user) return null;

  // Toggle grant or revoke for an individual capability
  const handleToggleCapability = (capKey: SystemCapability) => {
    // 1. Guard against ceiling violations in UI
    const validation = validatePermissionOverride(user.role, capKey);
    if (!validation.valid) {
      toast.error(validation.reasonAr || 'هذه الصلاحية خارج السقف المحدد للدور الوظيفي.');
      return;
    }

    const isBaseline = roleDefaults.has(capKey);

    if (isBaseline) {
      // It's on by default. Toggling it means revoking or un-revoking.
      setRevokedPerms((prev) => {
        const next = new Set(prev);
        if (next.has(capKey)) {
          next.delete(capKey); // restore baseline
        } else {
          next.add(capKey); // explicit denial
        }
        return next;
      });
      // Ensure it's not in grants
      setGrantedPerms((prev) => {
        if (prev.has(capKey)) {
          const next = new Set(prev);
          next.delete(capKey);
          return next;
        }
        return prev;
      });
    } else {
      // It's off by default. Toggling it means granting or un-granting.
      setGrantedPerms((prev) => {
        const next = new Set(prev);
        if (next.has(capKey)) {
          next.delete(capKey); // back to default off
        } else {
          next.add(capKey); // explicit grant
        }
        return next;
      });
      // Ensure it's not in revocations
      setRevokedPerms((prev) => {
        if (prev.has(capKey)) {
          const next = new Set(prev);
          next.delete(capKey);
          return next;
        }
        return prev;
      });
    }
  };

  const handleSave = async () => {
    // Validate all grants against role ceiling before submitting
    for (const cap of grantedPerms) {
      const validation = validatePermissionOverride(user.role, cap);
      if (!validation.valid) {
        setError(validation.reasonAr || 'يوجد صلاحيات ممنوحة تتجاوز السقف المحدد للدور.');
        return;
      }
    }

    const hasAnyOverride = grantedPerms.size > 0 || revokedPerms.size > 0;

    setIsSaving(true);
    setError(null);

    let rbacSuccess = false;
    let rbacError: string | null = null;
    let waSuccess = false;
    let waError: string | null = null;

    // 1. RBAC Permissions Save Operation
    try {
      if (!hasAnyOverride) {
        await permissionsApi.deleteUserPermissionOverride(user.id);
      } else {
        await permissionsApi.setUserPermissionOverride(user.id, {
          userId: user.id,
          grantedPermissions: Array.from(grantedPerms),
          revokedPermissions: Array.from(revokedPerms),
          granted: Array.from(grantedPerms),
          revoked: Array.from(revokedPerms),
          reason: reason.trim(),
        });
      }
      rbacSuccess = true;
    } catch (err: unknown) {
      rbacError = err instanceof Error ? err.message : 'فشل حفظ تخصيص الصلاحيات';
    }

    // 2. WhatsApp Scenario Assignments Operation (Kept strictly separate from RBAC capability payload)
    try {
      await whatsappApi.setUserWhatsAppVisibility(user.id, {
        userId: user.id,
        assignments: [
          { scenario: 'account_registration', isActive: Boolean(whatsAppAssignments.account_registration) },
          { scenario: 'password_recovery', isActive: Boolean(whatsAppAssignments.password_recovery) },
          { scenario: 'technical_support', isActive: Boolean(whatsAppAssignments.technical_support) },
        ],
      });
      waSuccess = true;
    } catch (err: unknown) {
      waError = err instanceof Error ? err.message : 'فشل حفظ مسؤوليات التواصل عبر واتساب';
    }

    setIsSaving(false);

    // 3. Coordinated Honest Feedback
    if (rbacSuccess && waSuccess) {
      toast.success(`تم حفظ صلاحيات ومسؤوليات المستخدم "${user.name}" بنجاح.`);
      onSuccess();
      onClose();
    } else if (rbacSuccess && !waSuccess) {
      setError(`تم حفظ الصلاحيات بنجاح، ولكن تعذر حفظ إعدادات واتساب: ${waError}`);
      toast.warning('تم حفظ الصلاحيات، مع تعذر تحديث مسؤوليات واتساب.');
    } else if (!rbacSuccess && waSuccess) {
      setError(`تم حفظ إعدادات واتساب بنجاح، ولكن تعذر حفظ الصلاحيات: ${rbacError}`);
      toast.warning('تم حفظ مسؤوليات واتساب، مع تعذر تحديث الصلاحيات.');
    } else {
      setError(`فشل حفظ التعديلات: ${rbacError || waError || 'حدث خطأ غير متوقع'}`);
    }
  };


  const handleReset = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await permissionsApi.deleteUserPermissionOverride(user.id);
      setGrantedPerms(new Set());
      setRevokedPerms(new Set());
      setReason('');
      toast.info(`تمت استعادة الصلاحيات الأساسية لدور "${USER_ROLE_LABELS_AR[user.role]}".`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل إعادة التعيين';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تحديد الصلاحيات الفردية للمستخدم"
      size="2xl"
      data-testid="user-permissions-modal"
    >
      <div className="space-y-6 text-right" dir="rtl">
        {/* User Identity Header Card */}
        <div className="bg-surface p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20">
              {user.name.slice(0, 2)}
            </div>
            <div>
              <div className="font-bold text-text text-base flex items-center gap-2">
                <span>{user.name}</span>
                <span className="font-mono text-xs text-text-muted px-1.5 py-0.5 rounded bg-bg border border-border">
                  {user.id}
                </span>
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                {user.email} • {user.department} • {user.jobTitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium">الدور الوظيفي:</span>
            <Badge variant="primary" size="md">
              {USER_ROLE_LABELS_AR[user.role] || user.role}
            </Badge>
          </div>
        </div>

        {/* Controlled Role Boundary Notice */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-text leading-relaxed flex items-start gap-2.5">
          <Icon name="info" size="md" className="text-primary mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">سياسة السقف الأقصى للأدوار: </span>
            تُمنح التخصيصات الفردية بدقة داخل النطاق المسموح به للدور الوظيفي فقط. الصلاحيات المحجوبة بسقف الدور لا يمكن تمكينها بالتخصيص، بل تتطلب ترقية صريحة لرتبة المستخدم من جدول الحسابات.
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="danger" title="تعذر حفظ الصلاحيات" data-testid="permissions-error-alert">
            {error}
          </Alert>
        )}

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-12 text-center text-text-muted text-sm">
            <Icon name="refresh" size="lg" className="animate-spin inline-block ml-2 text-primary" />
            جارٍ تحميل الصلاحيات والتخصيصات الفردية...
          </div>
        ) : (
          <div className="space-y-6 max-h-[55vh] overflow-y-auto px-1 pr-2">
            {CAPABILITY_CATEGORIES.map((cat) => {
              return (
                <div key={cat.id} className="perm-category-card space-y-3.5">
                  <div className="perm-category-header">
                    <div className="flex items-center gap-2.5">
                      <div className="perm-icon-badge" aria-hidden="true">
                        <Icon name={cat.icon} size="md" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text">
                          {cat.titleAr}
                        </h3>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-text-muted bg-bg px-2.5 py-1 rounded-md border border-border shadow-2xs">
                      {cat.items.length} {cat.items.length === 1 ? 'صلاحية' : cat.items.length === 2 ? 'صلاحيتان' : cat.items.length <= 10 ? 'صلاحيات' : 'صلاحية'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {cat.items.map((item) => {
                      const isCeilingAllowed = roleCeiling.has(item.key);
                      const isBaseline = roleDefaults.has(item.key);
                      const isRevoked = revokedPerms.has(item.key);
                      const isGranted = grantedPerms.has(item.key);

                      // Effective active state for this user
                      const isActive = isBaseline ? !isRevoked : isGranted;

                      // Blocked status
                      const isCeilingBlocked = !isCeilingAllowed;
                      const isAssistantAdminImmutableBlocked =
                        user.role === 'assistant_admin' &&
                        IMMUTABLE_BLOCKED_FOR_ASSISTANT_ADMIN.has(item.key);

                      const isImmutable = isCeilingBlocked || isAssistantAdminImmutableBlocked;

                      // Badge rendering
                      let badgeText = 'غير مفعلة';
                      let badgeVariant: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral';

                      if (isCeilingBlocked) {
                        badgeText = 'خارج سقف الدور';
                        badgeVariant = 'neutral';
                      } else if (isBaseline && !isRevoked) {
                        badgeText = 'افتراضية للدور';
                        badgeVariant = 'success';
                      } else if (isBaseline && isRevoked) {
                        badgeText = 'مسحوبة صراحة';
                        badgeVariant = 'danger';
                      } else if (!isBaseline && isGranted) {
                        badgeText = 'ممنوحة فردياً';
                        badgeVariant = 'primary' as 'success';
                      }

                      return (
                        <div
                          key={item.key}
                          data-testid={`perm-row-${item.key}`}
                          className={`perm-item-row ${
                            isImmutable ? 'immutable' : isActive ? 'active' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-text">{item.labelAr}</span>
                              <span className="font-mono text-[10px] text-text-muted">
                                ({item.key})
                              </span>
                              {item.isGroupScoped && (
                                <Badge variant="warning" size="sm">
                                  نطاق المجموعة
                                </Badge>
                              )}
                              {user.role === 'assistant_admin' &&
                                ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES.has(item.key) && (
                                  <Badge variant="neutral" size="sm">
                                    تخضع للاعتماد
                                  </Badge>
                                )}
                            </div>
                            <div className="text-[11px] text-text-muted">{item.descriptionAr}</div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            <Badge variant={badgeVariant} size="sm">
                              {badgeText}
                            </Badge>

                            <button
                              type="button"
                              role="switch"
                              aria-checked={isActive}
                              disabled={isImmutable || isSaving}
                              onClick={() => handleToggleCapability(item.key)}
                              data-testid={`toggle-perm-${item.key}`}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isImmutable
                                  ? 'cursor-not-allowed bg-border opacity-50'
                                  : isActive
                                  ? 'bg-primary-dark'
                                  : 'bg-border'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  isActive ? '-translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* WhatsApp Communication Responsibilities Card */}
            <div
              className="wa-responsibilities-card space-y-4"
              data-testid="wa-responsibilities-section"
            >
              {/* Section Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-emerald-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="wa-icon-badge" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.174L2.054 21.52a.75.75 0 00.926.926l4.346-1.384A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-4.708 6.07c.22-.494.46-.504.675-.513.176-.008.377-.008.577-.008.2 0 .526.075.802.377.276.3 1.053 1.028 1.053 2.51 0 1.482 1.078 2.91 1.229 3.111.15.2 2.08 3.324 5.127 4.512.723.282 1.288.45 1.728.59.726.23 1.386.198 1.908.12.58-.087 1.779-.727 2.03-1.428.25-.702.25-1.304.175-1.429-.075-.125-.276-.2-.577-.35-.3-.151-1.78-.878-2.055-.978-.276-.1-.476-.15-.677.15-.2.301-.776.978-.952 1.179-.175.2-.35.226-.651.075-.3-.15-1.267-.467-2.414-1.49-.893-.796-1.496-1.78-1.671-2.08-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.15-.175.2-.3.301-.501.1-.2.05-.376-.025-.526-.076-.151-.677-1.631-.928-2.233z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-text flex items-center gap-2">
                      <span>مسؤوليات التواصل عبر واتساب</span>
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                      حدد الأماكن التي يظهر فيها رقم واتساب المسجل لهذا المستخدم. هذه الإعدادات مستقلة عن صلاحيات الوصول إلى النظام.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-bg text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-2xs">
                  قنوات الدعم والتواصل
                </span>
              </div>

              {/* Registered User Phone Metadata Strip (Single Source of Truth) */}
              <div className="wa-metadata-strip flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-text-muted font-medium">رقم الهاتف المسجل:</span>
                    <span className="font-mono font-bold text-text text-sm" dir="ltr">
                      {isPhoneValid ? formattedDisplayPhone : (user.phone || 'غير مسجل')}
                    </span>
                    {isPhoneValid ? (
                      <Badge variant="success" size="sm">
                        محمول مصري صالح
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="sm">
                        غير صالح للتواصل
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    مصدر الرقم: الملف التعريفي للمستخدم (users.phone) — للتعديل يرجى تحديث بيانات المستخدم من جدول الحسابات.
                  </p>
                </div>
              </div>

              {/* Missing or Invalid Egyptian Mobile Warning */}
              {!isPhoneValid && (
                <div
                  className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2.5"
                  data-testid="wa-invalid-phone-warning"
                >
                  <Icon name="alert" size="md" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">تنبيه رقم الهاتف: </span>
                    لا يمكن تفعيل مسؤوليات التواصل قبل تسجيل رقم محمول مصري صالح في بيانات المستخدم.
                    <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-1">
                      يجب أن يبدأ الرقم بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقماً محلياً، أو بالصيغة الدولية (+20). لتحديث الرقم، يرجى تعديل بيانات المستخدم من جدول الحسابات.
                    </div>
                  </div>
                </div>
              )}

              {/* Suspended User Exclusion Notice */}
              {isUserSuspended && (
                <div
                  className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed flex items-start gap-2.5"
                  data-testid="wa-suspended-user-warning"
                >
                  <Icon name="alert" size="md" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">تنبيه الحساب الموقوف: </span>
                    الحساب موقوف إدارياً حالياً — تُحجب جهات الاتصال الخاصة بالحسابات الموقوفة تلقائياً من الظهور العام في قنوات واتساب طالما استمر الإيقاف.
                  </div>
                </div>
              )}

              {/* Three Independent Responsibility Controls */}
              <div className="grid grid-cols-1 gap-2.5" data-testid="wa-scenarios-list">
                {WHATSAPP_SCENARIOS.map((scenario) => {
                  const isChecked = Boolean(whatsAppAssignments[scenario.key]);
                  const isDisabled = !isPhoneValid;

                  return (
                    <div
                      key={scenario.key}
                      data-testid={`wa-scenario-row-${scenario.key}`}
                      className={`wa-scenario-row ${isChecked ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon name={scenario.iconName} size="md" className="text-emerald-600 dark:text-emerald-400" />
                          <span className="font-bold text-xs text-text">{scenario.labelAr}</span>
                          <span className="font-mono text-[10px] text-text-muted">({scenario.key})</span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">{scenario.helperAr}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <Badge variant={isDisabled ? 'neutral' : isChecked ? 'success' : 'neutral'} size="sm">
                          {isDisabled ? 'معطلة' : isChecked ? 'مفعلة' : 'غير مفعلة'}
                        </Badge>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={isChecked}
                          aria-label={scenario.labelAr}
                          disabled={isDisabled}
                          onClick={() => handleToggleWhatsApp(scenario.key)}
                          data-testid={`toggle-wa-${scenario.key}`}
                          className={`wa-switch-btn ${isChecked ? 'on' : 'off'} ${isDisabled ? 'disabled' : ''}`}
                        >
                          <span aria-hidden="true" className="wa-switch-knob" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual Permission Justification / Audit Reason Card (Final Section) */}
            <div className="perm-justification-card space-y-3.5">
              <div className="perm-justification-header">
                <div className="flex items-center gap-2.5">
                  <div className="perm-justification-badge" aria-hidden="true">
                    <Icon name="shield" size="md" />
                  </div>
                  <div>
                    <label
                      htmlFor="permission-override-reason"
                      className="block text-sm font-bold text-text cursor-pointer"
                    >
                      مبرر التخصيص الفردي (لسجلات الرقابة والحوكمة)
                    </label>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                      سجل سبب منح أو سحب الصلاحيات الاستثنائية لهذا الحساب لضمان مسار التدقيق الرقابي.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-text-muted bg-bg px-2.5 py-1 rounded-md border border-border shadow-2xs">
                  تدقيق إداري
                </span>
              </div>

              <div>
                <textarea
                  id="permission-override-reason"
                  data-testid="permission-override-reason-input"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="أدخل سبب منح أو سحب الصلاحيات الاستثنائية لهذا الحساب (مثال: تكليف بإدارة حقائب دورات الصيانة)..."
                  className="w-full text-xs p-3 rounded-lg border border-border bg-bg text-text placeholder:text-text-muted/70 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none shadow-2xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isSaving || isLoading}
            data-testid="reset-user-permissions-btn"
            className="text-xs text-text-muted hover:text-danger w-full sm:w-auto"
          >
            <Icon name="rotateCcw" size="sm" className="ml-1.5" />
            استعادة الصلاحيات الأساسية للدور
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              data-testid="cancel-user-permissions-btn"
            >
              إلغاء
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={isSaving}
              disabled={isLoading}
              data-testid="save-user-permissions-btn"
            >
              <Icon name="save" size="sm" className="ml-1.5" />
              حفظ التعديلات
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default UserPermissionsModal;
