import type { MaterialFileType, GroupMaterialFile } from '@/core/groups/types';
import type { ICON_REGISTRY } from '@/shared/ui/Icon/registry';

export type IconName = keyof typeof ICON_REGISTRY;

/**
 * In-memory map to store actual File / Blob instances during browser session or test runs.
 * This guarantees that when a user uploads real bytes, downloading yields the genuine uploaded bytes.
 */
const materialBlobRegistry = new Map<string, Blob>();

export function registerMaterialBlob(fileId: string, blob: Blob): void {
  materialBlobRegistry.set(fileId, blob);
}

export function getMaterialBlob(fileId: string): Blob | undefined {
  return materialBlobRegistry.get(fileId);
}

export function clearMaterialBlobs(): void {
  materialBlobRegistry.clear();
}

/**
 * Formats byte size into human-readable Arabic text.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 بايت';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  const value = parseFloat((bytes / Math.pow(k, idx)).toFixed(dm));

  return `${value} ${sizes[idx]}`;
}

/**
 * Formats ISO date string to Arabic localized date.
 */
export function formatMaterialDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Returns UI metadata (label, semantic icon name, and badge variant) for a given MaterialFileType.
 */
export function getFileTypeMeta(fileType: MaterialFileType): {
  labelAr: string;
  iconName: IconName;
  variant: 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
  colorClass: string;
} {
  switch (fileType) {
    case 'pdf':
      return {
        labelAr: 'مستند PDF',
        iconName: 'fileText',
        variant: 'danger',
        colorClass: 'text-danger-dark bg-danger-light border-danger/20',
      };
    case 'image':
      return {
        labelAr: 'صورة',
        iconName: 'image',
        variant: 'primary',
        colorClass: 'text-info-dark bg-info-light border-info/20',
      };
    case 'word':
      return {
        labelAr: 'مستند Word',
        iconName: 'fileText',
        variant: 'primary',
        colorClass: 'text-primary-dark bg-primary-light border-primary/20',
      };
    case 'excel':
      return {
        labelAr: 'جدول بيانات Excel',
        iconName: 'chart',
        variant: 'success',
        colorClass: 'text-success bg-success-light border-success/20',
      };
    case 'powerpoint':
      return {
        labelAr: 'عرض تقديمي PPT',
        iconName: 'fileText',
        variant: 'warning',
        colorClass: 'text-warning-dark bg-warning-light border-warning/20',
      };
    case 'archive':
      return {
        labelAr: 'أرشيف مضغوط ZIP',
        iconName: 'archive',
        variant: 'neutral',
        colorClass: 'text-text-muted bg-neutral-light border-border',
      };
    case 'video':
      return {
        labelAr: 'ملف فيديو',
        iconName: 'video',
        variant: 'primary',
        colorClass: 'text-primary-dark bg-primary-light border-primary/20',
      };
    case 'audio':
      return {
        labelAr: 'ملف صوتي',
        iconName: 'music',
        variant: 'warning',
        colorClass: 'text-warning-dark bg-warning-light border-warning/20',
      };
    default:
      return {
        labelAr: 'ملف مرفق',
        iconName: 'file',
        variant: 'neutral',
        colorClass: 'text-text-muted bg-neutral-light border-border',
      };
  }
}

/**
 * Checks whether this file format can be previewed directly inside the application.
 */
export function isMaterialPreviewable(fileType: MaterialFileType): boolean {
  return fileType === 'pdf' || fileType === 'image' || fileType === 'video' || fileType === 'audio';
}

/**
 * Initiates browser download of the genuine file bytes.
 */
export function downloadMaterialFile(file: GroupMaterialFile): void {
  const registeredBlob = getMaterialBlob(file.id);

  let urlToRevoke: string | null = null;
  let targetUrl = file.url;

  if (registeredBlob) {
    targetUrl = URL.createObjectURL(registeredBlob);
    urlToRevoke = targetUrl;
  } else if (!targetUrl || targetUrl.startsWith('/dev-media/materials/')) {
    // If it's a mock file without dev server backing, create a synthetic text blob containing representative content
    const fallbackBlob = new Blob(
      [`محتوى تجريبي تمثيلي لملف تدريب مترو القاهرة: ${file.originalFileName}\nحجم الملف: ${file.fileSizeBytes} بايت`],
      { type: file.mimeType || 'application/octet-stream' }
    );
    targetUrl = URL.createObjectURL(fallbackBlob);
    urlToRevoke = targetUrl;
  }

  const link = document.createElement('a');
  link.href = targetUrl;
  link.download = file.originalFileName || file.title;
  link.style.display = 'none';
  link.onclick = (e) => {
    e.stopPropagation();
  };
  document.body.appendChild(link);
  try {
    link.click();
  } catch {
    // Gracefully handle environments like jsdom where navigation is not implemented
  }
  document.body.removeChild(link);

  if (urlToRevoke) {
    setTimeout(() => {
      URL.revokeObjectURL(urlToRevoke!);
    }, 1000);
  }
}
