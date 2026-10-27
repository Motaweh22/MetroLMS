import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '@/shared/ui/Tooltip';

describe('Shared UI — Tooltip Component Design & Behavior', () => {
  it('renders children trigger element without showing tooltip initially', () => {
    render(
      <Tooltip content="رسالة توضيحية">
        <button type="button">زر الإجراء</button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'زر الإجراء' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on mouse enter and hides on mouse leave', () => {
    render(
      <Tooltip content="لتفعيل هذا الإجراء، فعّل وضع التعديل، وأجرِ تعديلًا واحدًا على الأقل، ثم انتظر حتى يتم حفظه بنجاح." testId="test-tooltip">
        <button type="button">زر تجريبي</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'زر تجريبي' });
    fireEvent.mouseEnter(trigger.parentElement!);

    const tooltip = screen.getByTestId('test-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('لتفعيل هذا الإجراء، فعّل وضع التعديل');

    fireEvent.mouseLeave(trigger.parentElement!);
    expect(screen.queryByTestId('test-tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus and hides on blur', () => {
    render(
      <Tooltip content="معلومات هامة للمراجع" testId="test-tooltip">
        <button type="button">زر تجريبي</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'زر تجريبي' });
    fireEvent.focus(trigger.parentElement!);

    expect(screen.getByTestId('test-tooltip')).toBeInTheDocument();

    fireEvent.blur(trigger.parentElement!);
    expect(screen.queryByTestId('test-tooltip')).not.toBeInTheDocument();
  });

  it('dismisses tooltip on Escape key press anywhere while open', () => {
    render(
      <Tooltip content="رسالة سيتم إغلاقها بمفتاح الهروب" testId="test-tooltip">
        <button type="button">زر تجريبي</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'زر تجريبي' });
    fireEvent.mouseEnter(trigger.parentElement!);
    expect(screen.getByTestId('test-tooltip')).toBeInTheDocument();

    // Global escape key press
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('test-tooltip')).not.toBeInTheDocument();
  });

  it('applies RTL direction, text-right, natural wrapping, and responsive desktop width bounds (260-320px)', () => {
    render(
      <Tooltip
        content="لتفعيل هذا الإجراء، فعّل وضع التعديل، وأجرِ تعديلًا واحدًا على الأقل، ثم انتظر حتى يتم حفظه بنجاح."
        testId="test-tooltip"
      >
        <button type="button">زر القرار</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: 'زر القرار' });
    fireEvent.mouseEnter(trigger.parentElement!);

    const tooltipWrapper = screen.getByTestId('test-tooltip');
    expect(tooltipWrapper).toHaveAttribute('dir', 'rtl');

    const bubble = tooltipWrapper.firstElementChild as HTMLElement;
    expect(bubble).toBeInTheDocument();

    // Verify inline responsive width clamps preventing narrow collapse
    expect(bubble.style.maxWidth).toContain('320px');
    expect(bubble.style.minWidth).toContain('260px');

    // Verify typography and padding classes
    expect(bubble.className).toContain('text-right');
    expect(bubble.className).toContain('break-words');
    expect(bubble.className).toContain('whitespace-normal');
    expect(bubble.className).toContain('leading-relaxed');
    expect(bubble.className).toContain('p-3');
    expect(bubble.className).toContain('rounded-lg');
  });

  it('renders directional arrows pointing toward trigger for start, end, and center alignments', () => {
    const { rerender } = render(
      <Tooltip content="إشعار يمين" align="start" position="top" testId="test-tooltip">
        <button type="button">زر 1</button>
      </Tooltip>
    );

    const trigger1 = screen.getByRole('button', { name: 'زر 1' });
    fireEvent.mouseEnter(trigger1.parentElement!);
    let arrow = screen.getByTestId('test-tooltip').querySelector('span[aria-hidden="true"]');
    expect(arrow).toHaveClass('start-6');
    expect(arrow).toHaveClass('top-full');

    rerender(
      <Tooltip content="إشعار يسار" align="end" position="top" testId="test-tooltip">
        <button type="button">زر 2</button>
      </Tooltip>
    );
    const trigger2 = screen.getByRole('button', { name: 'زر 2' });
    fireEvent.mouseEnter(trigger2.parentElement!);
    arrow = screen.getByTestId('test-tooltip').querySelector('span[aria-hidden="true"]');
    expect(arrow).toHaveClass('end-6');
    expect(arrow).toHaveClass('top-full');

    rerender(
      <Tooltip content="إشعار وسط" align="center" position="top" testId="test-tooltip">
        <button type="button">زر 3</button>
      </Tooltip>
    );
    const trigger3 = screen.getByRole('button', { name: 'زر 3' });
    fireEvent.mouseEnter(trigger3.parentElement!);
    arrow = screen.getByTestId('test-tooltip').querySelector('span[aria-hidden="true"]');
    expect(arrow).toHaveClass('left-1/2');
  });

  it('handles disabled triggers gracefully with accessible tabIndex and aria attributes', () => {
    render(
      <Tooltip
        content="الزر معطل ويحتاج إلى تعديلات إدارية أولاً"
        isTriggerDisabled={true}
        testId="test-tooltip"
      >
        <button type="button" disabled>زر معطل</button>
      </Tooltip>
    );

    const wrapper = screen.getByRole('region');
    expect(wrapper).toHaveAttribute('tabIndex', '0');
    expect(wrapper).toHaveAttribute('aria-label', 'الزر معطل ويحتاج إلى تعديلات إدارية أولاً');

    fireEvent.focus(wrapper);
    const tooltip = screen.getByTestId('test-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('aria-describedby', tooltip.id);
  });
});
