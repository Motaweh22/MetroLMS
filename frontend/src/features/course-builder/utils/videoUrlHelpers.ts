/**
 * Video URL Parsing and Validation Helpers
 */

/**
 * Parses and extracts a YouTube video ID from various standard URL formats.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();
  const match = clean.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Parses and extracts a Google Drive file ID from standard sharing URLs.
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();
  const match = clean.match(
    /(?:drive\.google\.com\/(?:file\/d\/|open\?id=))([a-zA-Z0-9_-]{20,})/
  );
  return match ? match[1] : null;
}
