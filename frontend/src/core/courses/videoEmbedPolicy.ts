import React from 'react';
import type { ChapterItem, VideoSourceType, VideoEmbedPolicy } from './types';

export type { VideoEmbedPolicy };

/**
 * Standard baseline sandbox tokens for embedded player iframes.
 * Represents the least-restrictive set of capabilities required by
 * modern embedded media players before popup restrictions are applied.
 */
export const BASELINE_IFRAME_SANDBOX_TOKENS = [
  'allow-scripts',
  'allow-same-origin',
  'allow-presentation',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
] as const;

/**
 * Restricted tokens explicitly removed when popup blocking is active.
 * Only these two tokens are omitted; all other baseline permissions are preserved.
 */
export const POPUP_BLOCKING_REMOVED_TOKENS = [
  'allow-popups',
  'allow-popups-to-escape-sandbox',
] as const;

/**
 * Standard baseline permissions for embedded media player iframes.
 * Represents essential capabilities required by embedded players before
 * popup or floating-player restrictions are applied.
 */
export const BASELINE_PLAYER_PERMISSIONS = [
  'accelerometer',
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'gyroscope',
  'picture-in-picture',
  'web-share',
] as const;

/**
 * Permissions explicitly removed when popup or floating-player restrictions are active.
 * Only 'picture-in-picture' is removed; all critical playback and sensor capabilities are preserved.
 */
export const POPUP_BLOCKING_REMOVED_PERMISSIONS = [
  'picture-in-picture',
] as const;

/**
 * Approved default policy for newly added Google Drive video embeds:
 * - Responsive CSS top crop defaults to 55px (clips top title bar and pop-out icon).
 * - Sandbox popup blocking defaults to enabled.
 */
export const DEFAULT_GDRIVE_EMBED_POLICY: Readonly<Required<VideoEmbedPolicy>> = Object.freeze({
  cropTopPixels: 55,
  blockPopups: true,
});

/**
 * Approved default policy for newly added YouTube video embeds:
 * - Sandbox popup blocking defaults to enabled.
 * - Top crop is strictly NOT applied (0px).
 */
export const DEFAULT_YOUTUBE_EMBED_POLICY: Readonly<Required<VideoEmbedPolicy>> = Object.freeze({
  cropTopPixels: 0,
  blockPopups: true,
});

/**
 * Default policy for uploaded videos and direct HTML5 media:
 * - No top crop (0px).
 * - No sandbox restrictions (native browser playback).
 */
export const DEFAULT_DIRECT_VIDEO_EMBED_POLICY: Readonly<Required<VideoEmbedPolicy>> = Object.freeze({
  cropTopPixels: 0,
  blockPopups: false,
});

/**
 * Mandatory platform policies enforced in production for all video sources.
 * In production, platform policies are internal invariants rather than administrator-configurable options.
 */
export const MANDATORY_GDRIVE_EMBED_POLICY: Readonly<Required<VideoEmbedPolicy>> = Object.freeze({
  cropTopPixels: 55,
  blockPopups: true,
});

export const MANDATORY_YOUTUBE_EMBED_POLICY: Readonly<Required<VideoEmbedPolicy>> = Object.freeze({
  cropTopPixels: 0,
  blockPopups: true,
});

export const MANDATORY_DIRECT_VIDEO_EMBED_POLICY: Readonly<Required<VideoEmbedPolicy>> = Object.freeze({
  cropTopPixels: 0,
  blockPopups: false,
});

/**
 * Universal provider identifier accepted across courses, player, and design lab.
 */
export type UniversalVideoProvider =
  | VideoSourceType
  | 'google-drive'
  | 'direct-video'
  | 'local-video'
  | string;

/**
 * Resolves the mandatory platform video embed policy for a provider.
 *
 * Requirements:
 * - Google Drive: 55px top crop, popup blocking enabled.
 * - YouTube: 0px top crop, popup blocking enabled.
 * - Direct / Upload / Local: 0px top crop, normal browser playback behavior preserved.
 *
 * @param provider - Video source provider type (e.g. 'drive', 'youtube', 'upload')
 * @returns Immutable mandatory VideoEmbedPolicy
 */
export function getMandatoryVideoEmbedPolicy(
  provider: UniversalVideoProvider | undefined
): Required<VideoEmbedPolicy> {
  const normalized = (provider || '').trim().toLowerCase();
  if (normalized === 'drive' || normalized === 'google-drive') {
    return { ...MANDATORY_GDRIVE_EMBED_POLICY };
  }
  if (normalized === 'youtube') {
    return { ...MANDATORY_YOUTUBE_EMBED_POLICY };
  }
  return { ...MANDATORY_DIRECT_VIDEO_EMBED_POLICY };
}

/**
 * Alias for getMandatoryVideoEmbedPolicy
 */
export const resolveMandatoryVideoEmbedPolicy = getMandatoryVideoEmbedPolicy;

/**
 * Derives the source-aware default embed policy for newly configured videos.
 *
 * @param provider - Video source provider type (e.g. 'drive', 'youtube', 'upload')
 * @returns Immutable default VideoEmbedPolicy with approved presets
 */
export function getDefaultVideoEmbedPolicy(
  provider: UniversalVideoProvider | undefined
): Required<VideoEmbedPolicy> {
  return getMandatoryVideoEmbedPolicy(provider);
}

/**
 * Derives the effective iframe sandbox attribute string based on popup-blocking status.
 *
 * Requirements:
 * 1. Starts with the source's baseline sandbox token list.
 * 2. Removes only 'allow-popups' and 'allow-popups-to-escape-sandbox'.
 * 3. Preserves all other baseline tokens without unintended alterations.
 * 4. When popup blocking is inactive (false or undefined), returns undefined (unrestricted baseline).
 *
 * @param blockPopups - Whether popup blocking is enabled
 * @param baselineTokens - Optional custom baseline tokens (defaults to standard list)
 */
export function deriveEffectiveSandbox(
  blockPopups?: boolean,
  baselineTokens: readonly string[] = BASELINE_IFRAME_SANDBOX_TOKENS
): string | undefined {
  if (!blockPopups) {
    return undefined;
  }
  const removedSet = new Set<string>(POPUP_BLOCKING_REMOVED_TOKENS);
  const activeTokens = baselineTokens.filter((token) => !removedSet.has(token));
  return activeTokens.join(' ');
}

/**
 * Derives the effective iframe allow attribute string based on popup/floating-player policy.
 *
 * Requirements:
 * 1. Starts with baseline permissions for embedded media players.
 * 2. When blockPopups is true, strictly omits 'picture-in-picture' to prevent floating/pop-out player modes.
 * 3. Preserves all other essential playback and hardware permissions (autoplay, encrypted-media, accelerometer, etc.).
 * 4. When blockPopups is false or undefined, returns the full baseline permissions string.
 *
 * @param blockPopups - Whether popup and floating-player blocking is enabled
 * @param baselinePermissions - Optional custom baseline permissions
 * @returns Semicolon-separated permissions string for the iframe allow attribute
 */
export function deriveEffectivePermissions(
  blockPopups?: boolean,
  baselinePermissions: readonly string[] = BASELINE_PLAYER_PERMISSIONS
): string {
  if (!blockPopups) {
    return baselinePermissions.join('; ');
  }
  const removedSet = new Set<string>(POPUP_BLOCKING_REMOVED_PERMISSIONS);
  return baselinePermissions
    .filter((perm) => !removedSet.has(perm))
    .join('; ');
}

/**
 * Computes responsive inline CSS styles for Google Drive top-crop technique.
 * Strictly scoped to Google Drive. Returns baseline dimensions if cropPixels <= 0.
 *
 * Technique:
 * - Iframe height is extended to calc(100% + ${cropPixels}px)
 * - Iframe top margin is negative -${cropPixels}px to shift the upper title bar out of viewport
 * - Outer wrapper with overflow: hidden clips the overflowing top area
 *
 * @param cropPixels - Pixels to crop from the top (defaults to 50 for Google Drive)
 */
export function getTopCropIframeStyle(cropPixels: number = 0): React.CSSProperties {
  if (cropPixels <= 0) {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      marginTop: '0px',
      border: 0,
    };
  }

  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `calc(100% + ${cropPixels}px)`,
    marginTop: `-${cropPixels}px`,
    border: 0,
  };
}

/**
 * Resolves the effective video embed policy for a ChapterItem in production.
 *
 * Requirements:
 * - Enforces mandatory platform policies: Drive = 50px + popup blocking, YouTube = 0px + popup blocking.
 * - Stale saved settings or missing embedPolicy on existing/historical items do NOT override
 *   the mandatory platform policy in production.
 * - Backward compatible: does not require bulk database/JSON migration.
 * - Options flag `allowOverride` is provided exclusively for internal experimental environments (Design Lab).
 */
export function resolveItemVideoEmbedPolicy(
  item?: Partial<ChapterItem> | null,
  options?: { isNewItem?: boolean; allowOverride?: boolean }
): Required<VideoEmbedPolicy> {
  if (options?.allowOverride && item?.embedPolicy) {
    return {
      cropTopPixels: item.embedPolicy.cropTopPixels ?? 0,
      blockPopups: item.embedPolicy.blockPopups ?? false,
    };
  }
  return getMandatoryVideoEmbedPolicy(item?.videoSourceType);
}
