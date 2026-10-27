import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/shared/ui/Modal/Modal';
import { Button } from '@/shared/ui/Button/Button';
import { Icon } from '@/shared/ui/Icon/Icon';

export interface CompletionCelebrationModalProps {
  isOpen: boolean;
  courseTitle: string;
  onClose: () => void;
}

export const CompletionCelebrationModal: React.FC<CompletionCelebrationModalProps> = ({
  isOpen,
  courseTitle,
  onClose,
}) => {
  const navigate = useNavigate();

  const handleReturnToCatalog = () => {
    onClose();
    navigate('/courses');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تهانينا! لقد أتممت الدورة التدريبية بنجاح"
      size="md"
      footer={
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '0.75rem' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            مراجعة محتوى الدورة
          </Button>
          <Button variant="primary" size="sm" onClick={handleReturnToCatalog}>
            العودة إلى قائمة الدورات
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem', padding: '0.5rem 0' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '2px solid rgba(34, 197, 94, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#22C55E',
          }}
        >
          <Icon name="award" size={36} />
        </div>

        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-primary-dark, #0369A1)', marginBottom: '0.35rem' }}>
            {courseTitle}
          </h3>
          <p style={{ color: 'var(--color-text, #334155)', fontSize: '0.92rem', lineHeight: '1.6' }}>
            أحسنت صنعاً! لقد أتممت جميع الدروس والأنشطة التعليمية المقررة في هذه الدورة بنسبة 100%.
          </p>
        </div>

        {/* Informational Certificate Notice */}
        <div
          style={{
            background: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            textAlign: 'right',
            width: '100%',
          }}
        >
          <Icon name="info" size="sm" className="text-primary-dark" style={{ marginTop: '2px', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted, #64748B)', lineHeight: '1.5' }}>
            <strong>إشعار الشهادة:</strong> شهادة إتمام الدورة ستكون متاحة للمراجعة والطباعة بعد تدقيق السجلات والاعتماد من قبل إدارة التدريب.
          </p>
        </div>
      </div>
    </Modal>
  );
};
