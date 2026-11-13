import React from 'react';
import { Modal } from '@/shared/ui/Modal/Modal';
import { Button } from '@/shared/ui/Button/Button';
import { Icon } from '@/shared/ui/Icon/Icon';
import type { EligibleAttemptOption } from '../types';

export interface AttemptContextSelectorModalProps {
  isOpen: boolean;
  courseTitle: string;
  eligibleAttempts: EligibleAttemptOption[];
  onSelectAttempt: (attemptId: string) => void;
  onCancel: () => void;
}

export const AttemptContextSelectorModal: React.FC<AttemptContextSelectorModalProps> = ({
  isOpen,
  courseTitle,
  eligibleAttempts,
  onSelectAttempt,
  onCancel,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="تحديد مسار التدريب المطلوب"
      description={`لديك أكثر من تسجيل متاح للمقرر التدريبي "${courseTitle}". يرجى اختيار السياق الذي ترغب في متابعة التعلم من خلاله:`}
      size="lg"
      data-testid="attempt-context-selector-modal"
      footer={
        <div style={{ display: 'flex', width: '100%', justifyContent: 'flex-start' }}>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            العودة لقائمة المقررات
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        {eligibleAttempts.map((option) => {
          const isReviewOnly = option.accessMode === 'review_only';
          const isSelf = option.kind === 'self';

          return (
            <div
              key={option.attemptId}
              data-testid={`attempt-option-${option.attemptId}`}
              style={{
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '1.25rem',
                background: 'rgba(15, 23, 42, 0.65)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: isSelf ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      color: isSelf ? '#38BDF8' : '#C084FC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={isSelf ? 'bookOpen' : 'users'} size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>
                      {option.contextLabel}
                    </h4>
                    {option.cycleTitle && (
                      <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                        {option.cycleTitle}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '9999px',
                      background: isReviewOnly ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: isReviewOnly ? '#F59E0B' : '#22C55E',
                      border: `1px solid ${isReviewOnly ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    }}
                  >
                    {isReviewOnly ? 'مراجعة واطلاع فقط' : 'مسار تدريب كامل'}
                  </span>
                </div>
              </div>

              {/* Progress details */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#94A3B8' }}>
                    نسبة الإنجاز ({option.completedLessons} من {option.totalLessons} درس)
                  </span>
                  <span style={{ fontWeight: 700, color: option.progressPercent === 100 ? '#22C55E' : '#38BDF8' }}>
                    {option.progressPercent}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${option.progressPercent}%`,
                      background: option.progressPercent === 100 ? '#22C55E' : '#0284C7',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Card Footer with Last Activity & Select Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {option.lastActivityAt
                    ? `آخر نشاط: ${new Date(option.lastActivityAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}`
                    : 'لم يبدأ بعد'}
                </span>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectAttempt(option.attemptId)}
                  data-testid={`select-attempt-btn-${option.attemptId}`}
                >
                  دخول هذا المسار
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

