/**
 * Sanitizes a URL before rendering it in an anchor `href` or resource link.
 * Blocks dangerous schemes (`javascript:`, `data:`, `vbscript:`, etc.) to prevent XSS.
 */
export function sanitizeSafeUrl(rawUrl: string | null | undefined, fallback = '#'): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'https:' || protocol === 'http:' || protocol === 'blob:') {
      return trimmed;
    }
  } catch {
    return fallback;
  }
  return fallback;
}
