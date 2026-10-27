import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { FormInput } from '@/shared/ui/FormInput';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { Modal } from '@/shared/ui/Modal';
import { Alert } from '@/shared/ui/Alert';

describe('Shared UI Primitives & Design System Verification', () => {
  describe('BrandLogo', () => {
    it('renders the primary metro logo with Arabic name', () => {
      render(<BrandLogo variant="horizontal" />);
      expect(screen.getByText('مترو القاهرة')).toBeInTheDocument();
      expect(screen.getByText('المنظومة التدريبية الذكية')).toBeInTheDocument();
    });

    it('renders training center variant with specialized title', () => {
      render(<BrandLogo variant="training" />);
      expect(screen.getByText('المنظومة التدريبية')).toBeInTheDocument();
    });

    it('renders icon-only variant without text', () => {
      render(<BrandLogo variant="icon-only" />);
      expect(screen.queryByText('مترو القاهرة')).not.toBeInTheDocument();
    });
  });

  describe('Icon & Registry', () => {
    it('renders registered semantic icons', () => {
      const { container } = render(<Icon name="courses" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
    });

    it('handles unregistered icon names by rendering fallback and logging warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container } = render(<Icon name="nonexistent-icon" size="lg" />);
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not registered in ICON_REGISTRY')
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('text-warning-dark');
      warnSpy.mockRestore();
    });
  });

  describe('Button', () => {
    it('renders primary button with AAA contrast background class and triggers onClick', () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" onClick={handleClick}>
          تسجيل الدخول
        </Button>
      );
      const btn = screen.getByRole('button', { name: /تسجيل الدخول/i });
      expect(btn).toHaveClass('bg-primary-dark', 'text-white');
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles disabled state preventing clicks', () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" disabled onClick={handleClick}>
          معطل
        </Button>
      );
      const btn = screen.getByRole('button', { name: /معطل/i });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders loading state with disabled interaction and spinner', () => {
      render(<Button isLoading>تحميل</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('renders success and danger badges with accessible text color classes', () => {
      const { rerender } = render(<Badge variant="success">ناجح</Badge>);
      expect(screen.getByText('ناجح').parentElement).toHaveClass('bg-success-light', 'text-success');

      rerender(<Badge variant="danger">خطر</Badge>);
      expect(screen.getByText('خطر').parentElement).toHaveClass('bg-danger-light', 'text-danger-dark');
    });
  });

  describe('FormInput', () => {
    it('renders label, input, and helper text', () => {
      render(
        <FormInput label="الرقم الوظيفي" helperText="أدخل 5 أرقام" placeholder="12345" />
      );
      expect(screen.getByLabelText(/الرقم الوظيفي/i)).toBeInTheDocument();
      expect(screen.getByText('أدخل 5 أرقام')).toBeInTheDocument();
    });

    it('renders error state with aria-invalid', () => {
      render(<FormInput label="البريد" error="بريد خاطئ" />);
      const input = screen.getByLabelText(/البريد/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('بريد خاطئ')).toBeInTheDocument();
    });
  });

  describe('ProgressBar', () => {
    it('renders with clamped percentage and aria attributes', () => {
      render(<ProgressBar value={75} label="التقدم" />);
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('التقدم')).toBeInTheDocument();
    });
  });

  describe('Alert', () => {
    it('renders alert with title, description and handles dismiss', () => {
      const handleClose = vi.fn();
      render(
        <Alert variant="warning" title="تنبيه" onClose={handleClose}>
          نص التنبيه
        </Alert>
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('تنبيه')).toBeInTheDocument();
      expect(screen.getByText('نص التنبيه')).toBeInTheDocument();
      
      const closeBtn = screen.getByLabelText(/إغلاق التنبيه/i);
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Modal', () => {
    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={() => {}}>
          محتوى النافذة
        </Modal>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders when isOpen is true and closes on Escape key', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="نافذة الاختبار">
          محتوى النافذة
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('نافذة الاختبار')).toBeInTheDocument();
      expect(screen.getByText('محتوى النافذة')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
