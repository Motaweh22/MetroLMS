const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;

/**
 * Sanitizes a URL before rendering it in an anchor `href` or resource link.
 * Blocks dangerous schemes (`javascript:`, `data:`, `vbscript:`, control chars)
 * and protocol-relative external URLs (`//...`) to prevent XSS and open redirects.
 */
export function sanitizeSafeUrl(rawUrl: string | null | undefined, fallback = '#'): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallback;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || CONTROL_CHAR_RE.test(trimmed)) {
    return fallback;
  }
  // Reject protocol-relative URLs (e.g. //evil.example) while allowing single-slash relative paths
  if (trimmed.startsWith('//') || trimmed.startsWith('\\/')) {
    return fallback;
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'https:' || protocol === 'http:' || protocol === 'blob:') {
      return trimmed;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

const YOUTUBE_ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

const GDRIVE_ALLOWED_HOSTS = new Set(['drive.google.com', 'docs.google.com']);

const OFFICE_EXACT_HOSTS = new Set([
  'view.officeapps.live.com',
  'onedrive.live.com',
  '1drv.ms',
]);

function hasExactOrSubdomainHost(hostname: string, rootDomain: string): boolean {
  const h = hostname.toLowerCase();
  return h === rootDomain || h.endsWith(`.${rootDomain}`);
}

function parseTrustedHttpsUrl(rawUrl: string | null | undefined): URL | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || CONTROL_CHAR_RE.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol.toLowerCase() !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Strictly parses a YouTube URL by hostname (never substring `.includes()`) and returns a canonical embed URL.
 */
export function getSafeYouTubeEmbedUrl(rawUrl: string | null | undefined): string | null {
  const parsed = parseTrustedHttpsUrl(rawUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_ALLOWED_HOSTS.has(host)) return null;

  let videoId = '';
  if (host === 'youtu.be') {
    videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0] || '';
  } else {
    const embedMatch = parsed.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,15})(?:\/|$)/);
    if (embedMatch) {
      videoId = embedMatch[1];
    } else if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v') || '';
    }
  }
  if (!/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) {
    return null;
  }
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Strictly parses a Google Drive / Docs URL by hostname and returns an isolated `/preview` URL.
 */
export function getSafeGoogleDrivePreviewUrl(rawUrl: string | null | undefined): string | null {
  const parsed = parseTrustedHttpsUrl(rawUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (!GDRIVE_ALLOWED_HOSTS.has(host)) return null;

  const fileMatch = parsed.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }
  if (parsed.pathname.endsWith('/preview') || parsed.pathname.endsWith('/view')) {
    const normalizedPath = parsed.pathname.replace(/\/view$/, '/preview');
    return `${parsed.origin}${normalizedPath}`;
  }
  const openId = parsed.searchParams.get('id');
  if (openId && /^[A-Za-z0-9_-]+$/.test(openId)) {
    return `https://drive.google.com/file/d/${openId}/preview`;
  }
  return null;
}

/**
 * Strictly validates Office Online / OneDrive / SharePoint preview URLs by HTTPS + hostname allowlist.
 */
export function getSafeOfficeEmbedUrl(rawUrl: string | null | undefined): string | null {
  const parsed = parseTrustedHttpsUrl(rawUrl);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (
    OFFICE_EXACT_HOSTS.has(host) ||
    hasExactOrSubdomainHost(host, 'sharepoint.com') ||
    hasExactOrSubdomainHost(host, 'onedrive.live.com')
  ) {
    return parsed.toString();
  }
  return null;
}

/**
 * Validates URLs rendered inside local same-origin document preview iframes (`blob:` or `/api/media/...` only).
 */
export function isSafePreviewFrameUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || CONTROL_CHAR_RE.test(trimmed)) return false;
  if (trimmed.startsWith('blob:')) return true;
  if (trimmed.startsWith('//') || trimmed.startsWith('\\/')) return false;
  if (trimmed.startsWith('/api/media/') || trimmed.startsWith('/dev-media/')) return true;
  return false;
}
