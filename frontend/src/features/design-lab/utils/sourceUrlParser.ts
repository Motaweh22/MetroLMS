import type { VideoSourceType, SourceParseResult } from '../types/videoLabTypes';

export const LAB_PRESET_SOURCES = {
  youtube: {
    name: 'YouTube — عينة رسمية معتمدة',
    url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    sourceType: 'youtube' as VideoSourceType,
    description: 'فيديو يوتيوب قياسي (M7lc1UVf-VE) للاختبار المعتمد بمشغل YouTube المدمج.',
  },
  googleDrive: {
    name: 'Google Drive — عينة درايف التجريبية',
    url: 'https://drive.google.com/file/d/1JGwMIY5fP3pBlPxO9J15K74Yh56BFxyx/view?usp=drive_link',
    sourceType: 'google-drive' as VideoSourceType,
    description: 'رابط ملف Google Drive تجريبي يستعرض نافذة المعاينة مع زر الفتح الخارجي في الزاوية العلوية.',
  },
  directMp4: {
    name: 'Direct MP4 — فيديو شبكي مباشر',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    sourceType: 'direct-video' as VideoSourceType,
    description: 'ملف وسائط MP4 مباشر يدعم تشغيل HTML5 والتحكم بالصوت والتشغيل والتخطي.',
  },
  localBaseline: {
    name: 'Local Video — فيديو محلي قياسي',
    url: '/dev-media/test-video.mp4',
    sourceType: 'local-video' as VideoSourceType,
    description: 'ملف فيديو محلي يعمل كخط مقارنة أساسي (Baseline) لتقييم سلوك المشغل المحلي دون قيود Cross-Origin.',
  },
};

/**
 * Extracts YouTube video ID from various link formats.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();

  // Plain 11-char alphanumeric ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean;
  }

  // youtu.be/<id>
  const shortMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=<id>
  const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch) return watchMatch[1];

  // youtube.com/embed/<id>
  const embedMatch = clean.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch) return embedMatch[1];

  // youtube.com/shorts/<id>
  const shortsMatch = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch) return shortsMatch[1];

  return null;
}

/**
 * Extracts Google Drive file ID from various link formats.
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();

  // Direct alphanumeric ID (20+ chars)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(clean)) {
    return clean;
  }

  // drive.google.com/file/d/<id>/...
  const fileDMatch = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch) return fileDMatch[1];

  // drive.google.com/open?id=<id>
  const openIdMatch = clean.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/i);
  if (openIdMatch) return openIdMatch[1];

  return null;
}

/**
 * Checks if a URL points directly to an HTML5-compatible media file or blob.
 */
export function isDirectMediaUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  if (clean.startsWith('blob:') || clean.startsWith('data:video/')) return true;
  if (clean.includes('.mp4') || clean.includes('.webm') || clean.includes('.ogg') || clean.includes('.ogv')) return true;
  if (clean.startsWith('/dev-media/') || clean.startsWith('/mock-video')) return true;
  return false;
}

/**
 * Parses and evaluates an input URL for the Design Lab experiment.
 */
export function parseVideoSourceUrl(inputUrl: string, requestedType?: VideoSourceType): SourceParseResult {
  const cleanUrl = (inputUrl || '').trim();

  if (!cleanUrl) {
    return {
      sourceType: requestedType || 'youtube',
      rawUrl: '',
      embedUrl: null,
      directMediaUrl: null,
      isValid: false,
      canPlayHtml5: false,
      requiresIframe: true,
      error: 'يرجى إدخال رابط فيديو صالح للاختبار.',
    };
  }

  // 1. YouTube Detection
  const ytId = extractYouTubeVideoId(cleanUrl);
  if (ytId || requestedType === 'youtube') {
    if (ytId) {
      return {
        sourceType: 'youtube',
        rawUrl: cleanUrl,
        videoId: ytId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&rel=0`,
        directMediaUrl: null,
        isValid: true,
        canPlayHtml5: false,
        requiresIframe: true,
        securityNote: 'فيديو يوتيوب يتطلب مشغل iframe الرسمي. لا يمكن تشغيله كملف وسائط HTML5 مباشر بسبب قيود تشفير وتوزيع منصة Google/YouTube.',
      };
    }
  }

  // 2. Google Drive Detection
  const driveId = extractGoogleDriveFileId(cleanUrl);
  if (driveId || requestedType === 'google-drive') {
    if (driveId) {
      return {
        sourceType: 'google-drive',
        rawUrl: cleanUrl,
        driveFileId: driveId,
        embedUrl: `https://drive.google.com/file/d/${driveId}/preview`,
        directMediaUrl: null,
        isValid: true,
        canPlayHtml5: false,
        requiresIframe: true,
        securityNote: 'صفحة معاينة Google Drive تتضمن ضوابط مضمنة وزر فتح خارجي. لا تُقدم الرابط كـ MP4 مباشر وتمنع CORS للصفحات العامة.',
      };
    }
  }

  // 3. Local video baseline
  if (cleanUrl.startsWith('/dev-media/') || cleanUrl.startsWith('blob:') || requestedType === 'local-video') {
    return {
      sourceType: 'local-video',
      rawUrl: cleanUrl,
      embedUrl: null,
      directMediaUrl: cleanUrl,
      isValid: true,
      canPlayHtml5: true,
      requiresIframe: false,
      securityNote: 'مصدر محلي أصيل (Same-Origin). متوافق بالكامل مع HTML5 <video> ويسمح بالتحكم البرمجي الكامل دون قيود Cross-Origin.',
    };
  }

  // 4. Direct video URL
  if (isDirectMediaUrl(cleanUrl) || requestedType === 'direct-video') {
    return {
      sourceType: 'direct-video',
      rawUrl: cleanUrl,
      embedUrl: null,
      directMediaUrl: cleanUrl,
      isValid: true,
      canPlayHtml5: true,
      requiresIframe: false,
      securityNote: 'رابط ملف وسائط مباشر. يمكن تغذيته لعنصر HTML5 <video src> مباشرة شريطة استجابة الخادم بترويسات CORS المناسبة.',
    };
  }

  // Fallback / Generic external URL
  const isHttp = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');
  if (isHttp) {
    return {
      sourceType: 'direct-video',
      rawUrl: cleanUrl,
      embedUrl: cleanUrl,
      directMediaUrl: null,
      isValid: true,
      canPlayHtml5: false,
      requiresIframe: true,
      securityNote: 'رابط خارجي عام. قد يخضع لسياسات X-Frame-Options أو CSP تمنع التضمين داخل الـ iframe.',
    };
  }

  return {
    sourceType: requestedType || 'youtube',
    rawUrl: cleanUrl,
    embedUrl: null,
    directMediaUrl: null,
    isValid: false,
    canPlayHtml5: false,
    requiresIframe: true,
    error: 'صيغة الرابط غير مدعومة أو غير قابلة للتعرف عليها كمشغل أو كملف وسائط مباشر.',
  };
}
