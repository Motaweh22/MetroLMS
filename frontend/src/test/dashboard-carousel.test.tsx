import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrainingGroupsCarousel } from '@/features/dashboard/components/TrainingGroupsCarousel';
import type { AdminGroupOverviewMetric } from '@/core/dashboard/types';

const mockGroups: AdminGroupOverviewMetric[] = [
  {
    id: 'GRP-101',
    name: 'برنامج تشغيل وتأمين الخط الثاني والتحكم الميداني',
    status: 'active',
    traineeCount: 18,
    deadlineText: 'متبقي 10 أيام',
    overallProgress: 45,
  },
  {
    id: 'GRP-102',
    name: 'دورة صيانة أجهزة الإشارات والتحكم المركزي SCADA',
    status: 'active',
    traineeCount: 14,
    deadlineText: 'متبقي 18 يوماً',
    overallProgress: 60,
  },
  {
    id: 'GRP-103',
    name: 'تأهيل وتدريب فنيي السلامة والصحة المهنية',
    status: 'active',
    traineeCount: 22,
    deadlineText: 'متبقي 5 أيام',
    overallProgress: 80,
  },
];

const renderCarousel = (groups: AdminGroupOverviewMetric[]) => {
  return render(
    <MemoryRouter>
      <TrainingGroupsCarousel groups={groups} />
    </MemoryRouter>
  );
};

describe('Increment 7: Training Groups Carousel Enhancement', () => {
  it('renders all group cards into the carousel track without omitting items', () => {
    renderCarousel(mockGroups);

    // Section title
    expect(screen.getByText('حالة المجموعات والدفعات الميدانية')).toBeInTheDocument();

    // Verify all 3 cards exist in the DOM (satisfies "Do not omit groups merely because they are outside the initially visible area")
    expect(screen.getByTestId('carousel-card-GRP-101')).toBeInTheDocument();
    expect(screen.getByTestId('carousel-card-GRP-102')).toBeInTheDocument();
    expect(screen.getByTestId('carousel-card-GRP-103')).toBeInTheDocument();

    // Content inside cards
    expect(screen.getByText('GRP-101')).toBeInTheDocument();
    expect(screen.getByText('GRP-102')).toBeInTheDocument();
    expect(screen.getByText('GRP-103')).toBeInTheDocument();
    expect(screen.getByText('عدد المتدربين: 18')).toBeInTheDocument();
    expect(screen.getAllByText('45%').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates through cards using visible right and left arrows with accessible Arabic labels', () => {
    renderCarousel(mockGroups);

    const prevBtn = screen.getByTestId('carousel-prev-btn');
    const nextBtn = screen.getByTestId('carousel-next-btn');

    // Check accessible Arabic labels
    expect(prevBtn).toHaveAttribute('aria-label', 'المجموعة السابقة');
    expect(nextBtn).toHaveAttribute('aria-label', 'المجموعة التالية');

    // Initial boundary: previous button should be disabled at start
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    const indicator = screen.getByTestId('carousel-indicator');
    expect(indicator).toHaveTextContent(/المجموعات 1 - 2 من 3/i);

    // Click Next (moves forward in Arabic RTL)
    fireEvent.click(nextBtn);

    // Indicator updates and next button reaches end
    expect(indicator).toHaveTextContent(/المجموعات 2 - 3 من 3/i);
    expect(nextBtn).toBeDisabled();
    expect(prevBtn).not.toBeDisabled();

    // Click Previous (moves back towards index 0)
    fireEvent.click(prevBtn);
    expect(indicator).toHaveTextContent(/المجموعات 1 - 2 من 3/i);
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it('supports keyboard navigation via ArrowLeft, ArrowRight, Home, and End keys', () => {
    renderCarousel(mockGroups);

    const carousel = screen.getByTestId('active-groups-carousel');
    const indicator = screen.getByTestId('carousel-indicator');

    expect(indicator).toHaveTextContent(/المجموعات 1 - 2 من 3/i);

    // Press ArrowLeft (forward in RTL)
    fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
    expect(indicator).toHaveTextContent(/المجموعات 2 - 3 من 3/i);

    // Press ArrowRight (backward in RTL)
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(indicator).toHaveTextContent(/المجموعات 1 - 2 من 3/i);

    // Press End key (go to last slide)
    fireEvent.keyDown(carousel, { key: 'End' });
    expect(indicator).toHaveTextContent(/المجموعات 2 - 3 من 3/i);

    // Press Home key (go to first slide)
    fireEvent.keyDown(carousel, { key: 'Home' });
    expect(indicator).toHaveTextContent(/المجموعات 1 - 2 من 3/i);
  });

  it('links each group card to its corresponding /my-groups/:groupId destination with dynamic ID', () => {
    renderCarousel(mockGroups);

    const link1 = screen.getByTestId('carousel-card-link-GRP-101');
    const link2 = screen.getByTestId('carousel-card-link-GRP-102');
    const link3 = screen.getByTestId('carousel-card-link-GRP-103');

    expect(link1).toHaveAttribute('href', '/my-groups/GRP-101');
    expect(link2).toHaveAttribute('href', '/my-groups/GRP-102');
    expect(link3).toHaveAttribute('href', '/my-groups/GRP-103');

    // Confirm accessible labels
    expect(link1).toHaveAttribute(
      'aria-label',
      expect.stringContaining('GRP-101')
    );
  });

  it('ensures carousel arrow clicks navigate slides without triggering card links', () => {
    renderCarousel(mockGroups);

    const nextBtn = screen.getByTestId('carousel-next-btn');
    const indicator = screen.getByTestId('carousel-indicator');

    expect(indicator).toHaveTextContent(/المجموعات 1 - 2 من 3/i);

    // Clicking arrow advances slide
    fireEvent.click(nextBtn);
    expect(indicator).toHaveTextContent(/المجموعات 2 - 3 من 3/i);

    // Cards remain intact and clickable independently
    const link3 = screen.getByTestId('carousel-card-link-GRP-103');
    expect(link3).toHaveAttribute('href', '/my-groups/GRP-103');
  });

  it('handles single-group state with disabled arrows and single card indicator', () => {
    const singleGroup = [mockGroups[0]];
    renderCarousel(singleGroup);

    expect(screen.getByTestId('carousel-card-GRP-101')).toBeInTheDocument();
    expect(screen.queryByTestId('carousel-card-GRP-102')).not.toBeInTheDocument();

    const prevBtn = screen.getByTestId('carousel-prev-btn');
    const nextBtn = screen.getByTestId('carousel-next-btn');
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();

    const indicator = screen.getByTestId('carousel-indicator');
    expect(indicator).toHaveTextContent('المجموعة 1 من 1');
  });

  it('handles empty-group state gracefully with empty card notification', () => {
    renderCarousel([]);

    expect(screen.getByTestId('carousel-empty-state')).toBeInTheDocument();
    expect(screen.getByText('لا توجد مجموعات تدريبية نشطة حالياً')).toBeInTheDocument();
    expect(screen.queryByTestId('carousel-prev-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('carousel-next-btn')).not.toBeInTheDocument();
  });
});

