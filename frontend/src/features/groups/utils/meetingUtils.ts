import type { GroupResource } from '@/core/groups/types';

export type MeetingPlatform = 'teams' | 'zoom' | 'meet' | 'other';

export interface MeetingPlatformMeta {
  key: MeetingPlatform;
  label: string;
  shortLabel: string;
  badgeVariant: 'primary' | 'info' | 'success' | 'neutral';
  placeholder: string;
  guideText: string;
  exampleDomain: string;
}

export const MEETING_PLATFORMS: Record<MeetingPlatform, MeetingPlatformMeta> = {
  teams: {
    key: 'teams',
    label: 'Microsoft Teams',
    shortLabel: 'Teams',
    badgeVariant: 'primary',
    placeholder: 'https://teams.microsoft.com/l/meetup-join/...',
    guideText: 'رابط اجتماع Microsoft Teams الرسمي (teams.microsoft.com)',
    exampleDomain: 'teams.microsoft.com',
  },
  zoom: {
    key: 'zoom',
    label: 'Zoom',
    shortLabel: 'Zoom',
    badgeVariant: 'info',
    placeholder: 'https://zoom.us/j/1234567890?pwd=...',
    guideText: 'رابط اجتماع Zoom Meeting المباشر (zoom.us)',
    exampleDomain: 'zoom.us',
  },
  meet: {
    key: 'meet',
    label: 'Google Meet',
    shortLabel: 'Google Meet',
    badgeVariant: 'success',
    placeholder: 'https://meet.google.com/abc-defg-hij',
    guideText: 'رابط جلسة Google Meet التفاعلية (meet.google.com)',
    exampleDomain: 'meet.google.com',
  },
  other: {
    key: 'other',
    label: 'منصة أخرى',
    shortLabel: 'لقاء تفاعلي',
    badgeVariant: 'neutral',
    placeholder: 'https://...',
    guideText: 'رابط مباشر لأي منصة بث أو اجتماع خارجي معتمد',
    exampleDomain: 'رابط مخصص',
  },
};

/**
 * Automatically inspects a URL string and/or stored resource type
 * to detect whether it corresponds to Microsoft Teams, Zoom, Google Meet, or Other.
 */
export function detectMeetingPlatform(url?: string | null, explicitType?: string | null): MeetingPlatform {
  const cleanUrl = (url || '').trim().toLowerCase();

  // Pattern detection from URL
  if (cleanUrl.includes('zoom.us') || cleanUrl.includes('zoomgov.com')) {
    return 'zoom';
  }
  if (cleanUrl.includes('meet.google.com') || cleanUrl.includes('google.com/meet')) {
    return 'meet';
  }
  if (
    cleanUrl.includes('teams.microsoft.com') ||
    cleanUrl.includes('teams.live.com') ||
    cleanUrl.includes('microsoft.com/teams')
  ) {
    return 'teams';
  }

  // Fallback to explicit resource type if provided
  if (explicitType === 'zoom') return 'zoom';
  if (explicitType === 'meet') return 'meet';
  if (explicitType === 'teams') return 'teams';
  if (explicitType === 'other' || explicitType === 'link') return 'other';

  return 'teams';
}

/**
 * Determines whether a GroupResource represents an interactive meeting session
 * (Teams, Zoom, Google Meet, or generic meeting URL).
 */
export function isMeetingResource(res: Pick<GroupResource, 'type' | 'url'>): boolean {
  const type = (res.type || '').toLowerCase();
  if (type === 'teams' || type === 'zoom' || type === 'meet') return true;

  const url = (res.url || '').toLowerCase();
  return (
    url.includes('teams.microsoft.com') ||
    url.includes('teams.live.com') ||
    url.includes('zoom.us') ||
    url.includes('zoomgov.com') ||
    url.includes('meet.google.com') ||
    url.includes('google.com/meet')
  );
}
