import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { inMemoryStore } from '@/mocks/store/inMemoryStore';
import { authStorage } from '@/core/auth/authStorage';
import { AppRouter } from '@/app/router';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import type { User } from '@/core/auth/types';
import {
  detectMeetingPlatform,
  isMeetingResource,
  MEETING_PLATFORMS,
} from '@/features/groups/utils/meetingUtils';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  inMemoryStore.reset({ seedReviewDemo: false });
});

afterAll(() => server.close());

const adminUser = SYNTHETIC_DEMO_ACCOUNTS.admin.user;
const traineeUser = SYNTHETIC_DEMO_ACCOUNTS.trainee.user;

function renderWithApp(initialRoute: string, user: User = adminUser) {
  authStorage.setSession({
    token: `mock_jwt_${user.id}_test`,
    user,
    expiresAt: Date.now() + 3600000,
  });

  return render(<AppRouter initialEntries={[initialRoute]} />);
}

describe('Interactive Meeting Platforms & Auto-Detection (Teams, Zoom, Google Meet)', () => {
  describe('1. meetingUtils detection & classification', () => {
    it('detects Zoom URLs accurately', () => {
      expect(detectMeetingPlatform('https://us02web.zoom.us/j/1234567890?pwd=abc')).toBe('zoom');
      expect(detectMeetingPlatform('https://zoom.us/j/9988776655')).toBe('zoom');
      expect(detectMeetingPlatform('https://metro.zoomgov.com/j/5544332211')).toBe('zoom');
    });

    it('detects Google Meet URLs accurately', () => {
      expect(detectMeetingPlatform('https://meet.google.com/abc-defg-hij')).toBe('meet');
      expect(detectMeetingPlatform('http://google.com/meet/room123')).toBe('meet');
    });

    it('detects Microsoft Teams URLs accurately', () => {
      expect(detectMeetingPlatform('https://teams.microsoft.com/l/meetup-join/19%3a123')).toBe('teams');
      expect(detectMeetingPlatform('https://teams.live.com/meet/987654321')).toBe('teams');
    });

    it('defaults or falls back cleanly', () => {
      expect(detectMeetingPlatform('https://webex.cisco.com/m/123', 'other')).toBe('other');
      expect(detectMeetingPlatform(null, 'zoom')).toBe('zoom');
      expect(detectMeetingPlatform(null, 'meet')).toBe('meet');
    });

    it('identifies meeting resources vs documents', () => {
      expect(isMeetingResource({ type: 'zoom', url: 'https://zoom.us/j/1' })).toBe(true);
      expect(isMeetingResource({ type: 'meet', url: 'https://meet.google.com/abc' })).toBe(true);
      expect(isMeetingResource({ type: 'teams', url: 'https://teams.microsoft.com/1' })).toBe(true);
      expect(isMeetingResource({ type: 'link', url: 'https://zoom.us/my-room' })).toBe(true);
      expect(isMeetingResource({ type: 'pdf', url: '/files/manual.pdf' })).toBe(false);
      expect(isMeetingResource({ type: 'link', url: 'https://enr.gov.eg/regulations' })).toBe(false);
    });
  });

  describe('2. GroupMeetingsTab Auto-Detection & Platform Selection UI', () => {
    it('renders platform selector buttons in add meeting modal', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=meetings', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-meetings-tab')).toBeInTheDocument();
      });

      // Open add meeting modal
      fireEvent.click(screen.getByTestId('open-add-meeting-btn'));

      expect(screen.getByTestId('meeting-platform-teams')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-platform-zoom')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-platform-meet')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-platform-other')).toBeInTheDocument();
    });

    it('auto-detects Zoom platform when typing or pasting Zoom URL', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=meetings', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-meetings-tab')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-add-meeting-btn'));

      // Initially Teams
      expect(screen.getByTestId('meeting-platform-teams')).toHaveClass('bg-primary');

      // Type Zoom URL
      const urlInput = screen.getByTestId('meeting-url-input');
      fireEvent.change(urlInput, { target: { value: 'https://us04web.zoom.us/j/8839201928?pwd=xyz' } });

      // Auto-detected Zoom badge appears and platform switches to Zoom
      await waitFor(() => {
        expect(screen.getByTestId('platform-autodetect-badge')).toBeInTheDocument();
        expect(screen.getByTestId('platform-autodetect-badge')).toHaveTextContent('Zoom');
      });
      expect(screen.getByTestId('meeting-platform-zoom')).toHaveClass('bg-primary');
    });

    it('auto-detects Google Meet platform when typing Google Meet URL', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=meetings', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-meetings-tab')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-add-meeting-btn'));

      const urlInput = screen.getByTestId('meeting-url-input');
      fireEvent.change(urlInput, { target: { value: 'https://meet.google.com/qwe-rtyu-iop' } });

      await waitFor(() => {
        expect(screen.getByTestId('platform-autodetect-badge')).toBeInTheDocument();
        expect(screen.getByTestId('platform-autodetect-badge')).toHaveTextContent('Google Meet');
      });
      expect(screen.getByTestId('meeting-platform-meet')).toHaveClass('bg-primary');
    });

    it('allows manual platform selection to override and updates input placeholder', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=meetings', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-meetings-tab')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-add-meeting-btn'));

      // Click Zoom button manually
      fireEvent.click(screen.getByTestId('meeting-platform-zoom'));
      expect(screen.getByTestId('meeting-platform-zoom')).toHaveClass('bg-primary');
      expect(screen.getByTestId('meeting-url-input')).toHaveAttribute(
        'placeholder',
        MEETING_PLATFORMS.zoom.placeholder
      );

      // Click Google Meet button manually
      fireEvent.click(screen.getByTestId('meeting-platform-meet'));
      expect(screen.getByTestId('meeting-platform-meet')).toHaveClass('bg-primary');
      expect(screen.getByTestId('meeting-url-input')).toHaveAttribute(
        'placeholder',
        MEETING_PLATFORMS.meet.placeholder
      );
    });

    it('creates and saves Zoom and Google Meet meetings, rendering distinct badges', async () => {
      renderWithApp('/admin/groups/GRP-101/edit?tab=meetings', adminUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-meetings-tab')).toBeInTheDocument();
      });

      // 1. Add Zoom meeting
      fireEvent.click(screen.getByTestId('open-add-meeting-btn'));
      fireEvent.change(screen.getByTestId('meeting-title-input'), {
        target: { value: 'جلسة تدريب افتراضية عبر زووم — مسارات السكك الحديدية' },
      });
      fireEvent.change(screen.getByTestId('meeting-url-input'), {
        target: { value: 'https://zoom.us/j/9922334455' },
      });
      fireEvent.click(screen.getByTestId('confirm-save-meeting-btn'));

      await waitFor(() => {
        expect(screen.getByText('جلسة تدريب افتراضية عبر زووم — مسارات السكك الحديدية')).toBeInTheDocument();
      });
      expect(screen.getByText('Zoom')).toBeInTheDocument();

      // 2. Add Google Meet meeting
      fireEvent.click(screen.getByTestId('open-add-meeting-btn'));
      fireEvent.change(screen.getByTestId('meeting-title-input'), {
        target: { value: 'ورشة تشغيلية مباشرة عبر جوجل ميت' },
      });
      fireEvent.change(screen.getByTestId('meeting-url-input'), {
        target: { value: 'https://meet.google.com/abc-mnop-xyz' },
      });
      fireEvent.click(screen.getByTestId('confirm-save-meeting-btn'));

      await waitFor(() => {
        expect(screen.getByText('ورشة تشغيلية مباشرة عبر جوجل ميت')).toBeInTheDocument();
      });
      expect(screen.getByText('Google Meet')).toBeInTheDocument();
    });
  });

  describe('3. Trainee GroupDetailPage Multi-Platform Meeting Presentation', () => {
    it('displays distinct platform badges and handles joining for Zoom and Google Meet', async () => {
      // Seed Zoom and Meet meetings directly into GRP-101
      const group = inMemoryStore.getGroupById('GRP-101');
      if (group) {
        group.resources = [
          ...(group.resources || []),
          {
            id: 'RES-ZOOM-01',
            title: 'محاضرة تقنية الصيانة عبر Zoom',
            url: 'https://zoom.us/j/1122334455',
            description: 'لقاء تفاعلي لمهندسي الإشارات',
            order: 10,
            type: 'zoom',
          },
          {
            id: 'RES-MEET-02',
            title: 'جلسة حوارية عبر Google Meet',
            url: 'https://meet.google.com/mno-pqrs-tuv',
            description: 'مراجعة إجراءات السلامة الميدانية',
            order: 11,
            type: 'meet',
          },
        ];
      }

      renderWithApp('/my-groups/GRP-101', traineeUser);

      await waitFor(() => {
        expect(screen.getByTestId('group-detail-page')).toBeInTheDocument();
      });

      // Badges render platform labels correctly
      expect(screen.getByText('لقاء تفاعلي Zoom')).toBeInTheDocument();
      expect(screen.getByText('لقاء تفاعلي Google Meet')).toBeInTheDocument();
      expect(screen.getByText('لقاء تفاعلي Teams')).toBeInTheDocument();

      // Click Zoom join button
      const zoomJoinBtn = screen.getByTestId('join-meeting-btn-RES-ZOOM-01');
      await act(async () => {
        fireEvent.click(zoomJoinBtn);
      });

      expect(
        screen.getByText('هذا رابط تجريبي تمثيلي لجلسة التدريب الميدانية عبر Zoom.')
      ).toBeInTheDocument();
      expect(screen.getByText('رابط تدريب تجريبي')).toBeInTheDocument();
    });
  });
});
