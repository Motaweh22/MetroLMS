import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast, checkBlockingOverlayActive } from '@/shared/ui/Toast';
import { Modal } from '@/shared/ui/Modal';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

// Test consumer component
const TestConsumer: React.FC<{
  onEmit?: (toast: ReturnType<typeof useToast>) => void;
}> = ({ onEmit }) => {
  const toast = useToast();

  return (
    <div>
      <button
        data-testid="emit-success-btn"
        onClick={() => toast.success('تم حفظ البيانات بنجاح', { title: 'نجاح العملية' })}
      >
        إشعار نجاح
      </button>
      <button
        data-testid="emit-error-btn"
        onClick={() => toast.error('حدث خطأ غير متوقع', { title: 'فشل العملية' })}
      >
        إشعار خطأ
      </button>
      <button
        data-testid="emit-warning-btn"
        onClick={() => toast.warning('يرجى الانتباه للموعد المحدد')}
      >
        إشعار تحذير
      </button>
      <button
        data-testid="emit-info-btn"
        onClick={() =>
          toast.info('هذا إشعار تجريبي استرشادي', {
            action: {
              label: 'متابعة الإجراء',
              onClick: () => {
                /* action handled */
              },
            },
          })
        }
      >
        إشعار معلومة
      </button>
      <button
        data-testid="emit-custom-duration-btn"
        onClick={() => toast.success('إشعار بمدة محددة', { duration: 3000 })}
      >
        مدة 3000
      </button>
      <button data-testid="dismiss-all-btn" onClick={() => toast.dismissAll()}>
        إغلاق الكل
      </button>
      <button
        data-testid="emit-via-prop-btn"
        onClick={() => onEmit && onEmit(toast)}
      >
        إرسال مخصص
      </button>
    </div>
  );
};

describe('Phase 4: Toast and Transient Feedback System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
    // Clean up any remaining dialogs in document
    const dialogs = document.querySelectorAll('[role="dialog"]');
    dialogs.forEach((d) => d.remove());
  });

  describe('1. Core Variant Rendering & Accessibility', () => {
    it('renders all 4 toast variants with correct semantic roles and styling classes', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      // Success
      fireEvent.click(screen.getByTestId('emit-success-btn'));
      const successToast = screen.getByText('تم حفظ البيانات بنجاح').closest('[role="status"]');
      expect(successToast).toBeInTheDocument();
      expect(successToast).toHaveAttribute('aria-live', 'polite');
      expect(successToast).toHaveAttribute('data-variant', 'success');
      expect(screen.getByText('نجاح العملية')).toBeInTheDocument();

      // Error / Danger
      fireEvent.click(screen.getByTestId('emit-error-btn'));
      const errorToast = screen.getByText('حدث خطأ غير متوقع').closest('[role="alert"]');
      expect(errorToast).toBeInTheDocument();
      expect(errorToast).toHaveAttribute('aria-live', 'assertive');
      expect(errorToast).toHaveAttribute('data-variant', 'danger');

      // Warning
      fireEvent.click(screen.getByTestId('emit-warning-btn'));
      const warningToast = screen.getByText('يرجى الانتباه للموعد المحدد').closest('[role="alert"]');
      expect(warningToast).toBeInTheDocument();
      expect(warningToast).toHaveAttribute('data-variant', 'warning');

      // Info with action button
      fireEvent.click(screen.getByTestId('emit-info-btn'));
      const infoToast = screen.getByText('هذا إشعار تجريبي استرشادي').closest('[role="status"]');
      expect(infoToast).toBeInTheDocument();
      expect(infoToast).toHaveAttribute('data-variant', 'info');
      expect(screen.getByText('متابعة الإجراء')).toBeInTheDocument();
    });

    it('manually dismisses a toast when the close button is clicked', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-success-btn'));
      expect(screen.getByText('تم حفظ البيانات بنجاح')).toBeInTheDocument();

      const dismissBtn = screen.getByTestId('toast-dismiss-btn');
      expect(dismissBtn).toHaveAttribute('aria-label', 'إغلاق الإشعار');
      fireEvent.click(dismissBtn);

      expect(screen.queryByText('تم حفظ البيانات بنجاح')).not.toBeInTheDocument();
    });

    it('dismisses all toasts when dismissAll is invoked', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-success-btn'));
      fireEvent.click(screen.getByTestId('emit-error-btn'));
      expect(screen.getByText('تم حفظ البيانات بنجاح')).toBeInTheDocument();
      expect(screen.getByText('حدث خطأ غير متوقع')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('dismiss-all-btn'));
      expect(screen.queryByText('تم حفظ البيانات بنجاح')).not.toBeInTheDocument();
      expect(screen.queryByText('حدث خطأ غير متوقع')).not.toBeInTheDocument();
    });
  });

  describe('2. Auto-Dismissal Timer & Hover / Keyboard Focus Pausing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('auto-dismisses a toast after its specified duration', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-custom-duration-btn'));
      expect(screen.getByText('إشعار بمدة محددة')).toBeInTheDocument();

      // Advance by 2900ms (not yet dismissed)
      act(() => {
        vi.advanceTimersByTime(2900);
      });
      expect(screen.getByText('إشعار بمدة محددة')).toBeInTheDocument();

      // Advance remaining 200ms (exceeding 3000ms duration)
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByText('إشعار بمدة محددة')).not.toBeInTheDocument();
    });

    it('pauses the timer on mouse hover and resumes with remaining time on mouse leave', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-custom-duration-btn'));
      const toastEl = screen.getByText('إشعار بمدة محددة').closest('[role="status"]')!;

      // 1000ms elapses
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Hover over toast -> pauses timer (remaining ~2000ms)
      fireEvent.mouseEnter(toastEl);

      // 5000ms elapses while hovered -> must NOT dismiss
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText('إشعار بمدة محددة')).toBeInTheDocument();

      // Mouse leaves -> timer resumes with remaining duration
      fireEvent.mouseLeave(toastEl);

      // Advance 1500ms -> still in document
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText('إشعار بمدة محددة')).toBeInTheDocument();

      // Advance final 600ms -> dismissed
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.queryByText('إشعار بمدة محددة')).not.toBeInTheDocument();
    });

    it('pauses the timer on keyboard focus and resumes on blur', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-custom-duration-btn'));
      const toastEl = screen.getByText('إشعار بمدة محددة').closest('[role="status"]')!;

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Keyboard focus enters toast
      fireEvent.focus(toastEl);

      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByText('إشعار بمدة محددة')).toBeInTheDocument();

      // Focus leaves toast
      fireEvent.blur(toastEl);

      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(screen.queryByText('إشعار بمدة محددة')).not.toBeInTheDocument();
    });
  });

  describe('3. Modal Stacking & Overlay Timer Pausing with Exact Duration Preservation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('verifies checkBlockingOverlayActive detects dialogs and body scroll lock', () => {
      expect(checkBlockingOverlayActive()).toBe(false);

      // Simulate Modal mounting role="dialog"
      const modalDiv = document.createElement('div');
      modalDiv.setAttribute('role', 'dialog');
      modalDiv.setAttribute('aria-modal', 'true');
      document.body.appendChild(modalDiv);
      expect(checkBlockingOverlayActive()).toBe(true);

      modalDiv.remove();
      expect(checkBlockingOverlayActive()).toBe(false);

      // Simulate body scroll lock
      document.body.style.overflow = 'hidden';
      expect(checkBlockingOverlayActive()).toBe(true);
      document.body.style.overflow = '';
      expect(checkBlockingOverlayActive()).toBe(false);
    });

    it('pauses toast timers when a modal overlay opens and resumes with exact remaining duration when closed', () => {
      const ModalHostComponent: React.FC = () => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const toast = useToast();

        return (
          <div>
            <button
              data-testid="open-modal-btn"
              onClick={() => setIsModalOpen(true)}
            >
              فتح نافذة
            </button>
            <button
              data-testid="trigger-toast-btn"
              onClick={() => toast.success('إشعار مراقب النافذة', { duration: 3000 })}
            >
              إشعار
            </button>
            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="نافذة تأكيد الاختبار"
              dataTestId="test-modal"
            >
              <div>محتوى النافذة المنبثقة</div>
            </Modal>
          </div>
        );
      };

      render(
        <ToastProvider>
          <ModalHostComponent />
        </ToastProvider>
      );

      // 1. Emit toast (duration: 3000ms)
      fireEvent.click(screen.getByTestId('trigger-toast-btn'));
      expect(screen.getByText('إشعار مراقب النافذة')).toBeInTheDocument();

      // 2. Advance 1000ms -> remaining is 2000ms
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // 3. Open modal overlay (takes z-50 visual precedence)
      fireEvent.click(screen.getByTestId('open-modal-btn'));
      expect(screen.getByTestId('test-modal')).toBeInTheDocument();

      // 4. Advance 10000ms while modal is open -> toast must NOT expire!
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(screen.getByText('إشعار مراقب النافذة')).toBeInTheDocument();

      // 5. Close modal by Escape
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('test-modal')).not.toBeInTheDocument();

      // 6. Advance 1500ms -> still alive (remaining was 2000ms)
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText('إشعار مراقب النافذة')).toBeInTheDocument();

      // 7. Advance remaining 600ms -> now cleanly dismissed
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.queryByText('إشعار مراقب النافذة')).not.toBeInTheDocument();
    });

    it('pauses toast timer when ConfirmDialog opens and resumes cleanly on cancel', () => {
      const ConfirmDialogHost: React.FC = () => {
        const [isDialogOpen, setIsDialogOpen] = useState(false);
        const toast = useToast();

        return (
          <div>
            <button data-testid="open-confirm-btn" onClick={() => setIsDialogOpen(true)}>
              فتح حوار
            </button>
            <button
              data-testid="emit-toast-btn"
              onClick={() => toast.warning('إشعار قبل الحوار', { duration: 4000 })}
            >
              إشعار
            </button>
            <ConfirmDialog
              isOpen={isDialogOpen}
              title="تأكيد الحذف"
              message="هل أنت متأكد؟"
              onConfirm={() => setIsDialogOpen(false)}
              onCancel={() => setIsDialogOpen(false)}
            />
          </div>
        );
      };

      render(
        <ToastProvider>
          <ConfirmDialogHost />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-toast-btn'));
      expect(screen.getByText('إشعار قبل الحوار')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // Open ConfirmDialog
      fireEvent.click(screen.getByTestId('open-confirm-btn'));
      expect(screen.getByTestId('confirm-dialog-title')).toBeInTheDocument();

      // Advance 8000ms -> toast remains in DOM
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByText('إشعار قبل الحوار')).toBeInTheDocument();

      // Cancel dialog
      fireEvent.click(screen.getByTestId('confirm-cancel-btn'));
      expect(screen.queryByTestId('confirm-dialog-title')).not.toBeInTheDocument();

      // Advance remaining time (2500ms remaining + buffer)
      act(() => {
        vi.advanceTimersByTime(2600);
      });
      expect(screen.queryByText('إشعار قبل الحوار')).not.toBeInTheDocument();
    });

    it('handles toasts emitted while a modal is already open by retaining 100% duration until dismissal', () => {
      const ModalActiveEmitter: React.FC = () => {
        const [isModalOpen, setIsModalOpen] = useState(true);
        const toast = useToast();

        return (
          <div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="نافذة مفتوحة مسبقاً">
              <div>
                <button
                  data-testid="emit-while-open-btn"
                  onClick={() => toast.success('تم الحفظ بالخلفية', { duration: 3000 })}
                >
                  إشعار من داخل النافذة
                </button>
                <button
                  data-testid="close-modal-inner-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  إغلاق النافذة
                </button>
              </div>
            </Modal>
          </div>
        );
      };

      render(
        <ToastProvider>
          <ModalActiveEmitter />
        </ToastProvider>
      );

      // Modal is open from the start
      expect(screen.getByText('نافذة مفتوحة مسبقاً')).toBeInTheDocument();

      // Emit toast while modal is open
      fireEvent.click(screen.getByTestId('emit-while-open-btn'));
      expect(screen.getByText('تم الحفظ بالخلفية')).toBeInTheDocument();

      // Advance 10000ms -> Toast timer must NOT tick down while modal is active
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(screen.getByText('تم الحفظ بالخلفية')).toBeInTheDocument();

      // Close modal inside act to ensure mutation observer and state updates flush
      act(() => {
        fireEvent.click(screen.getByTestId('close-modal-inner-btn'));
      });
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(screen.queryByText('نافذة مفتوحة مسبقاً')).not.toBeInTheDocument();

      // The full 3000ms duration is now available to the user
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(screen.getByText('تم الحفظ بالخلفية')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByText('تم الحفظ بالخلفية')).not.toBeInTheDocument();
    });

    it('maintains timer pause when multiple simultaneous modals are open until the last closes', () => {
      const MultiModalComponent: React.FC = () => {
        const [modal1, setModal1] = useState(false);
        const [modal2, setModal2] = useState(false);
        const toast = useToast();

        return (
          <div>
            <button data-testid="open-m1" onClick={() => setModal1(true)}>
              M1
            </button>
            <button data-testid="open-m2" onClick={() => setModal2(true)}>
              M2
            </button>
            <button
              data-testid="emit-t"
              onClick={() => toast.info('إشعار متعدد النوافذ', { duration: 3000 })}
            >
              T
            </button>
            <Modal isOpen={modal1} onClose={() => setModal1(false)} title="النافذة الأولى">
              <button data-testid="close-m1" onClick={() => setModal1(false)}>
                C1
              </button>
            </Modal>
            <Modal isOpen={modal2} onClose={() => setModal2(false)} title="النافذة الثانية">
              <button data-testid="close-m2" onClick={() => setModal2(false)}>
                C2
              </button>
            </Modal>
          </div>
        );
      };

      render(
        <ToastProvider>
          <MultiModalComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-t'));
      act(() => {
        vi.advanceTimersByTime(1000);
      }); // 2000ms left

      // Open Modal 1
      fireEvent.click(screen.getByTestId('open-m1'));
      // Open Modal 2 (both active)
      fireEvent.click(screen.getByTestId('open-m2'));

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText('إشعار متعدد النوافذ')).toBeInTheDocument();

      // Close Modal 1, but Modal 2 is still open
      fireEvent.click(screen.getByTestId('close-m1'));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText('إشعار متعدد النوافذ')).toBeInTheDocument();

      // Close Modal 2 (now all closed)
      fireEvent.click(screen.getByTestId('close-m2'));

      // Now resumes with the remaining 2000ms
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText('إشعار متعدد النوافذ')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.queryByText('إشعار متعدد النوافذ')).not.toBeInTheDocument();
    });
  });

  describe('4. Missing Provider Fallback Diagnostics & Concurrency Cap', () => {
    it('provides actionable warning and safe no-op fallback when useToast is used outside ToastProvider', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const BareConsumer: React.FC = () => {
        const toast = useToast();
        return (
          <button data-testid="orphan-btn" onClick={() => toast.success('إشعار يتيم')}>
            إرسال
          </button>
        );
      };

      render(<BareConsumer />);

      // Should not throw
      expect(() => {
        fireEvent.click(screen.getByTestId('orphan-btn'));
      }).not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useToast] useToast was invoked outside of a <ToastProvider>')
      );
    });

    it('limits visible toasts to maxVisible cap and evicts oldest', () => {
      render(
        <ToastProvider maxVisible={3}>
          <TestConsumer
            onEmit={(toast) => {
              toast.show({ message: 'إشعار 1', variant: 'info' });
              toast.show({ message: 'إشعار 2', variant: 'info' });
              toast.show({ message: 'إشعار 3', variant: 'info' });
              toast.show({ message: 'إشعار 4', variant: 'info' });
            }}
          />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-via-prop-btn'));

      // Max is 3 -> oldest (إشعار 1) should be evicted from visible container
      expect(screen.queryByText('إشعار 1')).not.toBeInTheDocument();
      expect(screen.getByText('إشعار 2')).toBeInTheDocument();
      expect(screen.getByText('إشعار 3')).toBeInTheDocument();
      expect(screen.getByText('إشعار 4')).toBeInTheDocument();
    });

    it('verifies z-40 layering on ToastContainer', () => {
      render(
        <ToastProvider>
          <TestConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('emit-success-btn'));
      const container = screen.getByTestId('toast-container');
      expect(container).toHaveClass('z-40');
      expect(container).toHaveClass('pointer-events-none');
    });
  });
});
