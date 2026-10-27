import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Badge, type BadgeVariant } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import type {
  UserRole,
  RolePermissionsConfig,
  SystemCapability,
} from '@/core/permissions/types';
import {
  PERMISSION_DEFINITIONS,
  PERMISSION_CATEGORIES,
  ROLE_DISPLAY_LABELS,
} from '@/core/permissions/types';
import {
  ROLE_DEFAULT_CAPABILITIES,
  ROLE_CAPABILITY_CEILINGS,
  ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES,
  GROUP_SCOPED_CAPABILITIES,
} from '@/core/permissions/policy';
import { permissionsApi } from '../services/permissionsApi';
import type { SemanticIconName } from '@/shared/ui/Icon';

export interface RolePermissionsMatrixProps {
  configs?: RolePermissionsConfig[];
  onReload?: () => Promise<void>;
  readOnly?: boolean;
}

const ROLES: UserRole[] = ['admin', 'assistant_admin', 'lecturer', 'user'];

const ESSENTIAL_ADMIN_CAPABILITIES = new Set<SystemCapability>([
  'permissions.configure_roles',
  'permissions.configure_users',
  'users.view_directory',
  'users.change_role',
]);

interface CapabilityCellStatus {
  kind: 'direct' | 'approval_delegated' | 'group_scoped' | 'override_eligible' | 'forbidden';
  badgeLabel: string;
  variant: BadgeVariant;
  icon: SemanticIconName;
  tooltipText: string;
}

function resolveCapabilityStatus(
  role: UserRole,
  capability: SystemCapability,
  isGrantedByDefault: boolean
): CapabilityCellStatus {
  const ceiling = ROLE_CAPABILITY_CEILINGS[role];
  const isWithinCeiling = ceiling ? ceiling.has(capability) : false;

  if (!isWithinCeiling) {
    return {
      kind: 'forbidden',
      badgeLabel: 'محظورة نهائياً',
      variant: 'neutral',
      icon: 'close',
      tooltipText: 'خارج السقف الأقصى المسموح به للدور؛ محظورة كودياً ولا يمكن منحها بالسياسة أو الاستثناء الفردي.',
    };
  }

  if (isGrantedByDefault) {
    if (role === 'assistant_admin' && ASSISTANT_ADMIN_APPROVAL_REQUIRED_CAPABILITIES.has(capability)) {
      return {
        kind: 'approval_delegated',
        badgeLabel: 'اعتماد / تفويض',
        variant: 'warning',
        icon: 'pending',
        tooltipText: 'تتطلب موافقة مدير النظام افتراضياً، وتنفذ مباشرة إذا كان التفويض التشغيلي مفعلاً.',
      };
    }

    if (role === 'lecturer' && GROUP_SCOPED_CAPABILITIES.has(capability)) {
      return {
        kind: 'group_scoped',
        badgeLabel: 'نطاق مجموعة',
        variant: 'info',
        icon: 'users',
        tooltipText: 'ممنوحة للمشرف أو المحاضر المساعد المصرح له داخل مجموعته التدريبية المحددة فقط.',
      };
    }

    return {
      kind: 'direct',
      badgeLabel: 'مباشرة',
      variant: 'success',
      icon: 'check',
      tooltipText: 'ممنوحة افتراضياً للدور وتنفذ مباشرة دون شروط إضافية.',
    };
  }

  return {
    kind: 'override_eligible',
    badgeLabel: 'قابلة للمنح الفردي',
    variant: 'primary',
    icon: 'plus',
    tooltipText: 'معطلة افتراضياً، ولكنها مؤهلة للمنح الاستثنائي لمستخدم محدد عبر إدارة المستخدمين.',
  };
}

export const RolePermissionsMatrix: React.FC<RolePermissionsMatrixProps> = ({
  configs,
  onReload,
  readOnly = false,
}) => {
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedRoleView, setSelectedRoleView] = useState<'all' | UserRole>('all');

  // Baseline permissions map per role derived from loaded configs or static defaults
  const baselineRoleState = useMemo<Record<UserRole, Set<SystemCapability>>>(() => {
    const map: Record<UserRole, Set<SystemCapability>> = {
      admin: new Set(),
      assistant_admin: new Set(),
      lecturer: new Set(),
      user: new Set(),
    };

    for (const r of ROLES) {
      const cfg = configs?.find((c) => c.role === r);
      if (cfg && cfg.permissions && cfg.permissions.length > 0) {
        map[r] = new Set(cfg.permissions);
      } else if (cfg && cfg.capabilities) {
        const active = (Object.keys(cfg.capabilities) as SystemCapability[]).filter(
          (k) => Boolean(cfg.capabilities![k])
        );
        map[r] = new Set(active);
      } else {
        const def = ROLE_DEFAULT_CAPABILITIES[r] || {};
        const active = (Object.keys(def) as SystemCapability[]).filter((k) => Boolean(def[k]));
        map[r] = new Set(active);
      }
    }
    return map;
  }, [configs]);

  // Working editable role permissions state
  const [workingRoleState, setWorkingRoleState] = useState<Record<UserRole, Set<SystemCapability>>>(
    () => ({
      admin: new Set(baselineRoleState.admin),
      assistant_admin: new Set(baselineRoleState.assistant_admin),
      lecturer: new Set(baselineRoleState.lecturer),
      user: new Set(baselineRoleState.user),
    })
  );

  // Sync working state when baseline updates from backend
  const prevConfigsRef = React.useRef(configs);
  useEffect(() => {
    if (configs !== prevConfigsRef.current) {
      prevConfigsRef.current = configs;
      setWorkingRoleState({
        admin: new Set(baselineRoleState.admin),
        assistant_admin: new Set(baselineRoleState.assistant_admin),
        lecturer: new Set(baselineRoleState.lecturer),
        user: new Set(baselineRoleState.user),
      });
    }
  }, [configs, baselineRoleState]);

  // Confirm dialog and saving states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [roleToSave, setRoleToSave] = useState<UserRole | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Detect which roles have unsaved edits
  const dirtyRoles = useMemo<UserRole[]>(() => {
    const dirty: UserRole[] = [];
    for (const r of ROLES) {
      const base = baselineRoleState[r];
      const work = workingRoleState[r];
      if (base.size !== work.size) {
        dirty.push(r);
        continue;
      }
      for (const cap of work) {
        if (!base.has(cap)) {
          dirty.push(r);
          break;
        }
      }
    }
    return dirty;
  }, [baselineRoleState, workingRoleState]);

  // Handle toggling capability in role defaults
  const handleToggleCapability = (role: UserRole, capability: SystemCapability) => {
    if (readOnly) return;

    const ceiling = ROLE_CAPABILITY_CEILINGS[role];
    if (!ceiling || !ceiling.has(capability)) {
      toast.error('هذه الصلاحية خارج السقف الأقصى للدور ولا يمكن تفعيلها افتراضياً');
      return;
    }

    if (role === 'admin' && ESSENTIAL_ADMIN_CAPABILITIES.has(capability)) {
      toast.warning('هذه صلاحية إدارية جوهرية لمدير النظام ولا يمكن إزالتها لمنع الإغلاق الإداري');
      return;
    }

    setWorkingRoleState((prev) => {
      const currentSet = new Set(prev[role]);
      if (currentSet.has(capability)) {
        currentSet.delete(capability);
      } else {
        currentSet.add(capability);
      }
      return {
        ...prev,
        [role]: currentSet,
      };
    });
  };

  // Reset changes for a specific role or all roles
  const handleResetRole = (role?: UserRole) => {
    if (role) {
      setWorkingRoleState((prev) => ({
        ...prev,
        [role]: new Set(baselineRoleState[role]),
      }));
    } else {
      setWorkingRoleState({
        admin: new Set(baselineRoleState.admin),
        assistant_admin: new Set(baselineRoleState.assistant_admin),
        lecturer: new Set(baselineRoleState.lecturer),
        user: new Set(baselineRoleState.user),
      });
    }
    setSaveError(null);
  };

  // Open confirmation dialog before saving
  const handleInitiateSave = (role?: UserRole) => {
    const target = role || dirtyRoles[0] || null;
    if (!target) return;
    setRoleToSave(target);
    setSaveError(null);
    setIsConfirmOpen(true);
  };

  // Execute API save upon confirmation
  const handleConfirmSave = async () => {
    if (!roleToSave) return;
    setIsSaving(true);
    setSaveError(null);

    const capsToSave = Array.from(workingRoleState[roleToSave]);

    try {
      await permissionsApi.updateRolePermissions(roleToSave, capsToSave);
      toast.success(
        `تم حفظ الصلاحيات الافتراضية لدور (${ROLE_DISPLAY_LABELS[roleToSave]}) بنجاح وتطبيقها على المستخدمين غير المستثنين.`
      );
      setIsConfirmOpen(false);
      setRoleToSave(null);
      if (onReload) {
        await onReload();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت معالجة طلب تحديث صلاحيات الدور';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter definitions by category and search query
  const filteredDefinitions = useMemo(() => {
    return PERMISSION_DEFINITIONS.filter((def) => {
      const matchesCategory = activeCategory === 'all' || def.category === activeCategory;
      const matchesSearch =
        !filterQuery.trim() ||
        def.labelAr.toLowerCase().includes(filterQuery.toLowerCase()) ||
        def.descriptionAr.toLowerCase().includes(filterQuery.toLowerCase()) ||
        def.key.toLowerCase().includes(filterQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, filterQuery]);

  // Visible roles in table based on selector
  const visibleRoles = useMemo(() => {
    if (selectedRoleView === 'all') return ROLES;
    return [selectedRoleView];
  }, [selectedRoleView]);

  return (
    <div className="space-y-6" data-testid="role-permissions-matrix-container">
      {/* Notice Banner: Fixed Baseline Policy / Configurable Role Defaults */}
      <Alert
        variant="info"
        title="سياسة الصلاحيات الافتراضية وسقوف الأدوار القياسية"
        data-testid="fixed-policy-notice"
      >
        {readOnly
          ? 'هذا الجدول يُعرض للاطلاع المرجعي الصارم على الصلاحيات الافتراضية وسقوف الأدوار القياسية الأربعة. تعديل الصلاحيات الافتراضية مخصص لمدير النظام فقط، وتمنح الاستثناءات الفردية حصراً عبر إدارة المستخدمين.'
          : 'يمكن لمدير النظام تهيئة الصلاحيات الافتراضية الممنوحة لكل دور قياسي ضمن سقوف الأمان الثابتة كودياً. يؤثر تعديل الصلاحيات الافتراضية على جميع مستخدمي الدور الذين لا يملكون تخصيصاً فردياً مسبقاً.'}
      </Alert>

      {/* Unsaved Changes Action Bar (when admin makes changes) */}
      {!readOnly && dirtyRoles.length > 0 && (
        <div
          className="bg-warning-light border border-warning-dark/30 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4"
          data-testid="unsaved-role-changes-bar"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-warning/20 text-warning-dark flex items-center justify-center shrink-0">
              <Icon name="alert" size="md" />
            </span>
            <div>
              <div className="text-sm font-bold text-text-heading">
                تعديلات غير محفوظة على الصلاحيات الافتراضية
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                الأدوار المعدلة: {dirtyRoles.map((r) => ROLE_DISPLAY_LABELS[r]).join('، ')}.
                تطبيق هذه التعديلات سيؤثر على جميع مستخدمي هذه الأدوار الذين ليس لديهم استثناءات فردية.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleResetRole()}
              data-testid="reset-role-defaults-btn"
              className="w-full sm:w-auto"
            >
              <Icon name="rotateCcw" size="sm" className="ml-1.5" />
              إلغاء التعديلات
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleInitiateSave()}
              data-testid="save-role-defaults-btn"
              className="w-full sm:w-auto"
            >
              <Icon name="save" size="sm" className="ml-1.5" />
              حفظ التعديلات الافتراضية
            </Button>
          </div>
        </div>
      )}

      {/* Save Error Alert */}
      {saveError && (
        <Alert
          variant="danger"
          title="فشل حفظ التعديلات الافتراضية"
          data-testid="role-defaults-save-error"
        >
          {saveError}
        </Alert>
      )}

      {/* Legend Guide */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-text ml-1">دليل حالات الصلاحيات:</span>
        <div className="flex items-center gap-1.5">
          <Badge variant="success" size="sm" icon="check">
            مباشرة
          </Badge>
          <span className="text-text-muted">ممنوحة افتراضياً وتنفذ فوراً</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="warning" size="sm" icon="pending">
            اعتماد / تفويض
          </Badge>
          <span className="text-text-muted">تتطلب اعتماداً أو تفويضاً مسبقاً للمساعد</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="info" size="sm" icon="users">
            نطاق مجموعة
          </Badge>
          <span className="text-text-muted">مقيدة بالمجموعة التدريبية المخصصة للمحاضر</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="primary" size="sm" icon="plus">
            قابلة للمنح الفردي
          </Badge>
          <span className="text-text-muted">معطلة افتراضياً ومؤهلة للمنح الاستثنائي بإدارة المستخدمين</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="neutral" size="sm" icon="close">
            محظورة نهائياً
          </Badge>
          <span className="text-text-muted">خارج السقف الأقصى للدور ولا يمكن تفعيلها</span>
        </div>
      </div>

      {/* Role View Selector & Category Filters */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Role Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border text-xs">
          <button
            type="button"
            onClick={() => setSelectedRoleView('all')}
            className={`px-3 py-2 rounded-xl font-semibold transition-all ${
              selectedRoleView === 'all'
                ? 'bg-primary-dark text-white shadow-sm'
                : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt transition-colors'
            }`}
            data-testid="filter-role-all"
          >
            عرض كافة الأدوار (مصفوفة المقارنة)
          </button>
          {ROLES.map((r) => {
            const isDirty = dirtyRoles.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRoleView(r)}
                className={`px-3 py-2 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                  selectedRoleView === r
                    ? 'bg-primary-dark text-white shadow-sm'
                    : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt transition-colors'
                }`}
                data-testid={`filter-role-${r}`}
              >
                <span>{ROLE_DISPLAY_LABELS[r]}</span>
                {isDirty && (
                  <span className="w-2 h-2 rounded-full bg-warning-dark inline-block" title="تعديلات غير محفوظة" />
                )}
              </button>
            );
          })}
        </div>

        {/* Categories Bar & Search Input */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === 'all'
                  ? 'bg-primary-dark text-white shadow-sm'
                  : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt transition-colors'
              }`}
            >
              كل الفئات ({PERMISSION_DEFINITIONS.length})
            </button>
            {PERMISSION_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-primary-dark text-white shadow-sm'
                    : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt transition-colors'
                }`}
              >
                {cat.labelAr}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="بحث في الصلاحيات والمسميات..."
              className="w-full text-xs pr-9 pl-3 py-2 bg-bg-alt/50 border border-border rounded-xl text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <Icon
              name="search"
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse" data-testid="role-permissions-matrix-table">
            <thead>
              <tr className="bg-bg-alt/70 border-b border-border text-xs font-semibold text-text-muted select-none">
                <th scope="col" className="py-3.5 px-4 font-bold min-w-[260px]">
                  الصلاحية / الوصف الوظيفي
                </th>
                {visibleRoles.includes('admin') && (
                  <th scope="col" className="py-3.5 px-3 font-bold text-center min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="primary" size="md">
                        {ROLE_DISPLAY_LABELS.admin}
                      </Badge>
                      {!readOnly && (
                        <span className="text-[10px] text-text-muted font-normal">افتراضيات قابلة للإدارة</span>
                      )}
                    </div>
                  </th>
                )}
                {visibleRoles.includes('assistant_admin') && (
                  <th scope="col" className="py-3.5 px-3 font-bold text-center min-w-[150px]">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="neutral" size="md">
                        {ROLE_DISPLAY_LABELS.assistant_admin}
                      </Badge>
                      {!readOnly && (
                        <span className="text-[10px] text-text-muted font-normal">افتراضيات قابلة للإدارة</span>
                      )}
                    </div>
                  </th>
                )}
                {visibleRoles.includes('lecturer') && (
                  <th scope="col" className="py-3.5 px-3 font-bold text-center min-w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="success" size="md">
                        {ROLE_DISPLAY_LABELS.lecturer}
                      </Badge>
                      {!readOnly && (
                        <span className="text-[10px] text-text-muted font-normal">افتراضيات قابلة للإدارة</span>
                      )}
                    </div>
                  </th>
                )}
                {visibleRoles.includes('user') && (
                  <th scope="col" className="py-3.5 px-3 font-bold text-center min-w-[130px]">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="neutral" size="md">
                        {ROLE_DISPLAY_LABELS.user}
                      </Badge>
                      {!readOnly && (
                        <span className="text-[10px] text-text-muted font-normal">افتراضيات قابلة للإدارة</span>
                      )}
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-sm">
              {filteredDefinitions.map((def) => {
                const categoryObj = PERMISSION_CATEGORIES.find((c) => c.id === def.category);

                return (
                  <tr
                    key={def.key}
                    className="hover:bg-bg/60 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-text text-xs sm:text-sm">
                        {def.labelAr}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {def.descriptionAr}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-mono text-[10px] text-text-muted bg-bg-alt/60 px-1.5 py-0.5 rounded border border-border/50">
                          {def.key}
                        </span>
                        {categoryObj && (
                          <span className="text-[10px] text-text-muted bg-bg-alt/40 px-1.5 py-0.5 rounded border border-border/40">
                            {categoryObj.labelAr}
                          </span>
                        )}
                        {def.isSovereign && (
                          <Badge variant="danger" size="sm">
                            صلاحية سيادية
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Columns for visible canonical roles */}
                    {visibleRoles.map((role) => {
                      const ceiling = ROLE_CAPABILITY_CEILINGS[role];
                      const isWithinCeiling = ceiling ? ceiling.has(def.key) : false;
                      const isGranted = workingRoleState[role].has(def.key);
                      const status = resolveCapabilityStatus(role, def.key, isGranted);
                      const isEssential = role === 'admin' && ESSENTIAL_ADMIN_CAPABILITIES.has(def.key);

                      return (
                        <td
                          key={role}
                          className="py-3.5 px-2 text-center align-middle"
                        >
                          {!readOnly && isWithinCeiling ? (
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <div className="inline-flex items-center gap-2 select-none">
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  disabled={isEssential}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleCapability(role, def.key);
                                  }}
                                  className="h-4 w-4 rounded border-border text-primary-dark focus:ring-primary/20 accent-primary-dark cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                  data-testid={`toggle-role-capability-${role}-${def.key}`}
                                  aria-label={`تفعيل صلاحية ${def.labelAr} لدور ${ROLE_DISPLAY_LABELS[role]}`}
                                />
                                <Badge
                                  variant={status.variant}
                                  size="sm"
                                  icon={status.icon}
                                  title={status.tooltipText}
                                  data-testid={`cell-status-${role}-${def.key}`}
                                  className={!isEssential ? 'cursor-pointer hover:opacity-90' : undefined}
                                  onClick={() => !isEssential && handleToggleCapability(role, def.key)}
                                >
                                  {status.badgeLabel}
                                </Badge>
                              </div>
                              {isEssential && (
                                <span className="text-[10px] text-text-muted inline-flex items-center gap-0.5">
                                  <Icon name="lock" size={10} />
                                  محصنة
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant={status.variant}
                              size="sm"
                              icon={status.icon}
                              title={status.tooltipText}
                              data-testid={`cell-status-${role}-${def.key}`}
                            >
                              {status.badgeLabel}
                            </Badge>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog before saving role defaults */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="تأكيد تعديل الصلاحيات الافتراضية للدور"
        message={
          roleToSave
            ? `تعديل الصلاحيات الافتراضية لدور (${ROLE_DISPLAY_LABELS[roleToSave]}) سيؤثر على جميع المستخدمين الذين يحملون هذا الدور ولا يملكون استثناءات فردية مسبقة. هل أنت متأكد من حفظ التعديلات؟`
            : 'تعديل الصلاحيات الافتراضية للأدوار سيؤثر على جميع المستخدمين الذين لا يملكون استثناءات فردية مسبقة. هل أنت متأكد من حفظ التعديلات؟'
        }
        confirmLabel="تأكيد وحفظ الصلاحيات"
        cancelLabel="تراجع"
        variant="warning"
        isConfirming={isSaving}
        onConfirm={handleConfirmSave}
        onCancel={() => setIsConfirmOpen(false)}
        onClose={() => setIsConfirmOpen(false)}
        testId="confirm-save-role-defaults-dialog"
        confirmTestId="confirm-dialog-confirm-btn"
        cancelTestId="confirm-dialog-cancel-btn"
      />
    </div>
  );
};

export default RolePermissionsMatrix;
