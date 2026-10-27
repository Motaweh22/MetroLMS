/**
 * Date and Time utilities for Training Groups & Renewal Cycles
 */

/**
 * Format ISO date string into input type="datetime-local" string (YYYY-MM-DDTHH:mm)
 */
export function toDatetimeLocal(isoStr?: string | null): string {
  if (!isoStr || !isoStr.trim()) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Format input type="datetime-local" string to ISO-8601 string for API payload
 */
export function toIsoString(val?: string | null): string {
  if (!val || !val.trim()) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toISOString();
  } catch {
    return val || '';
  }
}

/**
 * Format ISO date string to localized Arabic date (e.g. "20 أكتوبر 2026")
 */
export function formatArabicDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return 'غير محدد';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format ISO date string to localized Arabic date and time (e.g. "20 أكتوبر 2026، 08:00 ص")
 */
export function formatArabicDateTime(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return 'غير محدد';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
