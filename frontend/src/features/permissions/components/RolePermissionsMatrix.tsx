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
const ALL_CANONICAL_ROLES: UserRole[] = [
  'developer',
  'super_admin',
  'admin',
  'assistant_admin',
  'lecturer',
  'user',
];

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

/**
 * Computes baseline permissions map per role derived from loaded configs or static defaults.
 * Guarantees that all six canonical roles (including developer and super_admin) are properly populated.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buildBaselineRoleState(
  configs?: RolePermissionsConfig[]
): Record<UserRole, Set<SystemCapability>> {
  const map: Record<UserRole, Set<SystemCapability>> = {
    developer: new Set(),
    super_admin: new Set(),
    admin: new Set(),
    assistant_admin: new Set(),
    lecturer: new Set(),
    user: new Set(),
  };

  for (const r of ALL_CANONICAL_ROLES) {
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
}

export const RolePermissionsMatrix: React.FC<RolePermissionsMatrixProps> = ({
  configs,
  onReload,
  readOnly = false,
}) => {
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedRoleView, setSelectedRoleView] = useState<'all' | UserRole>('admin');
  const [hideForbidden, setHideForbidden] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Baseline permissions map per role derived from loaded configs or static defaults
  const baselineRoleState = useMemo<Record<UserRole, Set<SystemCapability>>>(() => {
    return buildBaselineRoleState(configs);
  }, [configs]);

  // Working editable role permissions state
  const [workingRoleState, setWorkingRoleState] = useState<Record<UserRole, Set<SystemCapability>>>(
    () => ({
      developer: new Set(baselineRoleState.developer),
      super_admin: new Set(baselineRoleState.super_admin),
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
        developer: new Set(baselineRoleState.developer),
        super_admin: new Set(baselineRoleState.super_admin),
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
    for (const r of ALL_CANONICAL_ROLES) {
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
        developer: new Set(baselineRoleState.developer),
        super_admin: new Set(baselineRoleState.super_admin),
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

  const groupedCategories = useMemo(() => {
    return PERMISSION_CATEGORIES.map((cat) => {
      const items = filteredDefinitions.filter((d) => d.category === cat.id);
      return { category: cat, items };
    }).filter((g) => g.items.length > 0);
  }, [filteredDefinitions]);

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <div className="space-y-4" data-testid="role-permissions-matrix-container">
      {/* Compact Policy Notice + Legend Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface border border-border rounded-2xl px-4 py-3 shadow-xs">
        <div
          className="flex items-start sm:items-center gap-2.5 text-xs text-text-muted"
          data-testid="fixed-policy-notice"
        >
          <Icon name="info" size="sm" className="text-primary-dark shrink-0 mt-0.5 sm:mt-0" />
          <span>
            {readOnly
              ? 'وضع العرض المرجعي فقط: التعديل مخصص لمدير النظام، والاستثناءات الفردية تتم عبر إدارة المستخدمين.'
              : 'اختر الدور لتعديل صلاحياته الافتراضية بسهولة، أو اعرض جدول المقارنة الكامل.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowLegend((prev) => !prev)}
          className="text-xs font-semibold text-primary-dark hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer self-end lg:self-auto"
        >
          <Icon name="info" size="sm" />
          <span>{showLegend ? 'إخفاء دليل الحالات' : 'دليل الحالات والرموز'}</span>
        </button>
      </div>

      {/* Collapsible Legend Guide */}
      {showLegend && (
        <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Badge variant="success" size="sm" icon="check">
              مباشرة
            </Badge>
            <span className="text-text-muted">مفعّلة وتنفذ فوراً</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="warning" size="sm" icon="pending">
              اعتماد / تفويض
            </Badge>
            <span className="text-text-muted">تتطلب موافقة أو تفويضاً</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="info" size="sm" icon="users">
              نطاق مجموعة
            </Badge>
            <span className="text-text-muted">داخل المجموعة المخصصة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="primary" size="sm" icon="plus">
              قابلة للمنح الفردي
            </Badge>
            <span className="text-text-muted">معطلة افتراضياً وتُمنح فردياً</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="neutral" size="sm" icon="close">
              محظورة نهائياً
            </Badge>
            <span className="text-text-muted">غير متاحة لهذا الدور</span>
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

      {/* Role Selector & Filters */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {ROLES.map((r) => {
              const isDirty = dirtyRoles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRoleView(r)}
                  className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedRoleView === r
                      ? 'bg-primary-dark text-white shadow-sm'
                      : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt'
                  }`}
                  data-testid={`filter-role-${r}`}
                >
                  <span>{ROLE_DISPLAY_LABELS[r]}</span>
                  {isDirty && (
                    <span
                      className="w-2 h-2 rounded-full bg-warning inline-block"
                      title="تعديلات غير محفوظة"
                    />
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedRoleView('all')}
              className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                selectedRoleView === 'all'
                  ? 'bg-text-heading text-white border-text-heading shadow-sm'
                  : 'bg-surface text-text-muted border-border hover:text-text'
              }`}
              data-testid="filter-role-all"
            >
              <Icon name="grid" size="sm" />
              <span>مقارنة كل الأدوار</span>
            </button>
          </div>

          {selectedRoleView !== 'all' && (
            <label className="inline-flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideForbidden}
                onChange={(e) => setHideForbidden(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary-dark"
              />
              <span>إخفاء الصلاحيات المحظورة عن هذا الدور</span>
            </label>
          )}
        </div>

        {/* Category Filter Pills & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt'
              }`}
            >
              الكل ({PERMISSION_DEFINITIONS.length})
            </button>
            {PERMISSION_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                {cat.labelAr}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="بحث في الصلاحيات..."
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

      {/* Mode 1: Single-Role Clean Grouped Accordion View */}
      {selectedRoleView !== 'all' ? (
        <div className="space-y-3" data-testid="role-focused-permissions-view">
          {groupedCategories.map(({ category, items }) => {
            const role = selectedRoleView;
            const ceiling = ROLE_CAPABILITY_CEILINGS[role];
            const visibleItems = hideForbidden
              ? items.filter((d) => ceiling?.has(d.key))
              : items;
            if (visibleItems.length === 0) return null;

            const allowedCount = items.filter((d) => ceiling?.has(d.key)).length;
            const grantedCount = items.filter(
              (d) => ceiling?.has(d.key) && workingRoleState[role].has(d.key)
            ).length;
            const isCollapsed = Boolean(collapsedCategories[category.id]);

            return (
              <div
                key={category.id}
                className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(category.id)}
                  className="w-full px-4 py-3 bg-bg-alt/50 hover:bg-bg-alt/80 transition-colors flex items-center justify-between cursor-pointer text-right"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      name={isCollapsed ? 'chevronLeft' : 'chevronDown'}
                      size="sm"
                      className="text-text-muted"
                    />
                    <span className="text-sm font-bold text-text-heading">{category.labelAr}</span>
                    <Badge variant={grantedCount > 0 ? 'primary' : 'neutral'} size="sm">
                      {grantedCount} / {allowedCount} مفعّلة
                    </Badge>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-border/60">
                    {visibleItems.map((def) => {
                      const isWithinCeiling = ceiling ? ceiling.has(def.key) : false;
                      const isGranted = workingRoleState[role].has(def.key);
                      const status = resolveCapabilityStatus(role, def.key, isGranted);
                      const isEssential =
                        role === 'admin' && ESSENTIAL_ADMIN_CAPABILITIES.has(def.key);

                      return (
                        <div
                          key={def.key}
                          className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            !isWithinCeiling ? 'opacity-60 bg-bg/40' : 'hover:bg-bg/40'
                          }`}
                        >
                          <div className="space-y-0.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="font-semibold text-sm text-text-heading"
                                title={def.key}
                              >
                                {def.labelAr}
                              </span>
                              {def.isSovereign && (
                                <Badge variant="danger" size="sm">
                                  صلاحية سيادية
                                </Badge>
                              )}
                              {isEssential && (
                                <span className="text-[11px] text-text-muted inline-flex items-center gap-1">
                                  <Icon name="lock" size={11} />
                                  أساسية ومحصنة
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed">
                              {def.descriptionAr}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <Badge
                              variant={status.variant}
                              size="sm"
                              icon={status.icon}
                              title={status.tooltipText}
                              data-testid={`cell-status-${role}-${def.key}`}
                            >
                              {status.badgeLabel}
                            </Badge>

                            {!readOnly && isWithinCeiling && (
                              <label
                                className={`relative inline-flex items-center ${
                                  isEssential ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  disabled={isEssential}
                                  onChange={() => handleToggleCapability(role, def.key)}
                                  className="sr-only peer"
                                  data-testid={`toggle-role-capability-${role}-${def.key}`}
                                  aria-label={`تفعيل صلاحية ${def.labelAr} لدور ${ROLE_DISPLAY_LABELS[role]}`}
                                />
                                <div className="w-10 h-5 bg-border rounded-full peer peer-checked:bg-primary-dark transition-colors after:content-[''] after:absolute after:top-0.5 after:right-0.5 peer-checked:after:-translate-x-5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Mode 2: 4-Role Comparison Table View */
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table
              className="w-full text-right border-collapse"
              data-testid="role-permissions-matrix-table"
            >
              <thead>
                <tr className="bg-bg-alt/70 border-b border-border text-xs font-semibold text-text-muted select-none">
                  <th scope="col" className="py-3 px-4 font-bold min-w-[240px]">
                    الصلاحية
                  </th>
                  {visibleRoles.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="py-3 px-2 font-bold text-center min-w-[125px]"
                    >
                      <Badge
                        variant={
                          role === 'admin'
                            ? 'primary'
                            : role === 'lecturer'
                              ? 'success'
                              : 'neutral'
                        }
                        size="sm"
                      >
                        {ROLE_DISPLAY_LABELS[role]}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 text-sm">
                {groupedCategories.map(({ category, items }) => (
                  <React.Fragment key={category.id}>
                    <tr className="bg-bg-alt/40">
                      <td
                        colSpan={1 + visibleRoles.length}
                        className="py-2 px-4 text-xs font-bold text-primary-dark"
                      >
                        {category.labelAr} ({items.length})
                      </td>
                    </tr>
                    {items.map((def) => (
                      <tr key={def.key} className="hover:bg-bg/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-text text-xs sm:text-sm flex items-center gap-1.5">
                            <span title={def.key}>{def.labelAr}</span>
                            {def.isSovereign && (
                              <Badge variant="danger" size="sm">
                                سيادية
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                            {def.descriptionAr}
                          </div>
                        </td>

                        {visibleRoles.map((role) => {
                          const ceiling = ROLE_CAPABILITY_CEILINGS[role];
                          const isWithinCeiling = ceiling ? ceiling.has(def.key) : false;
                          const isGranted = workingRoleState[role].has(def.key);
                          const status = resolveCapabilityStatus(role, def.key, isGranted);
                          const isEssential =
                            role === 'admin' && ESSENTIAL_ADMIN_CAPABILITIES.has(def.key);

                          return (
                            <td key={role} className="py-2.5 px-2 text-center align-middle">
                              {!readOnly && isWithinCeiling ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={isGranted}
                                    disabled={isEssential}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleToggleCapability(role, def.key);
                                    }}
                                    className="h-4 w-4 rounded border-border accent-primary-dark cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    data-testid={`toggle-role-capability-${role}-${def.key}`}
                                    aria-label={`تفعيل صلاحية ${def.labelAr} لدور ${ROLE_DISPLAY_LABELS[role]}`}
                                  />
                                  <Badge
                                    variant={status.variant}
                                    size="sm"
                                    icon={status.icon}
                                    title={status.tooltipText}
                                    data-testid={`cell-status-${role}-${def.key}`}
                                    className={
                                      !isEssential ? 'cursor-pointer hover:opacity-90' : undefined
                                    }
                                    onClick={() => !isEssential && handleToggleCapability(role, def.key)}
                                  >
                                    {status.badgeLabel}
                                  </Badge>
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
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky Unsaved Changes Action Bar */}
      {!readOnly && dirtyRoles.length > 0 && (
        <div
          className="sticky bottom-4 z-30 bg-warning-light border border-warning-dark/40 rounded-2xl p-3.5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3"
          data-testid="unsaved-role-changes-bar"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-warning/20 text-warning-dark flex items-center justify-center shrink-0">
              <Icon name="alert" size="sm" />
            </span>
            <div className="text-xs">
              <div className="font-bold text-text-heading">
                تعديلات غير محفوظة ({dirtyRoles.map((r) => ROLE_DISPLAY_LABELS[r]).join('، ')})
              </div>
              <div className="text-text-muted">اضغط حفظ لتطبيق التعديلات على الدور.</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleResetRole()}
              data-testid="reset-role-defaults-btn"
              className="w-full sm:w-auto bg-surface"
            >
              <Icon name="rotateCcw" size="sm" className="ml-1" />
              تراجع
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleInitiateSave()}
              data-testid="save-role-defaults-btn"
              className="w-full sm:w-auto"
            >
              <Icon name="save" size="sm" className="ml-1" />
              حفظ التعديلات
            </Button>
          </div>
        </div>
      )}

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
