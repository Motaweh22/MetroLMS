import React, { useState } from 'react';
import type { ExternalResource } from '@/core/courses/types';
import { Card } from '@/shared/ui/Card';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { QRCodeModal } from '@/shared/ui/QRCodeModal';

export interface ExternalResourcesListProps {
  resources?: ExternalResource[];
  title?: string;
  description?: string;
  className?: string;
}

export const ExternalResourcesList: React.FC<ExternalResourcesListProps> = ({
  resources = [],
  title = 'المصادر والمراجع التعليمية الملحقة',
  description,
  className = '',
}) => {
  const [selectedQr, setSelectedQr] = useState<ExternalResource | null>(null);

  if (!resources || resources.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`} data-testid="external-resources-list">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div>
          <h3 className="text-sm font-bold text-text-heading flex items-center gap-2">
            <Icon name="link" size="sm" className="text-primary" />
            <span>{title}</span>
          </h3>
          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}
        </div>
        <span className="text-xs font-semibold text-text-muted">
          {resources.length} {resources.length === 1 ? 'مورد' : 'مصادر'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resources.map((res) => {
          let domain = '';
          try {
            domain = new URL(res.url).hostname;
          } catch {
            domain = 'رابط خارجي';
          }

          return (
            <Card
              key={res.id}
              className="p-4 flex flex-col justify-between space-y-3 hover:border-primary/40 hover:shadow-sm transition-all"
              data-testid={`external-resource-card-${res.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name={(res.icon as SemanticIconName) || 'link'} size="md" />
                </div>
                <div className="space-y-1 overflow-hidden">
                  <h4 className="text-xs font-bold text-text-heading line-clamp-1 leading-snug">
                    {res.title}
                  </h4>
                  {res.description && (
                    <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                      {res.description}
                    </p>
                  )}
                  <div className="text-[10px] text-text-muted font-mono" dir="ltr">
                    {domain}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                {/* Direct Open Link */}
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors"
                  aria-label={`فتح المورد: ${res.title}`}
                  data-testid={`open-resource-btn-${res.id}`}
                >
                  <span>فتح المورد</span>
                  <Icon name="link" size="sm" />
                </a>

                {/* QR Code trigger */}
                <button
                  type="button"
                  onClick={() => setSelectedQr(res)}
                  className="p-1.5 rounded-lg border border-border hover:bg-neutral-light text-text-muted hover:text-text transition-colors text-xs"
                  title="عرض رمز QR للمورد"
                  aria-label={`رمز QR للمورد ${res.title}`}
                  data-testid={`qr-resource-btn-${res.id}`}
                >
                  <Icon name="link" size="sm" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* QR Code Modal */}
      {selectedQr && (
        <QRCodeModal
          isOpen={Boolean(selectedQr)}
          onClose={() => setSelectedQr(null)}
          title={selectedQr.title}
          url={selectedQr.url}
          subtitle={selectedQr.description}
          badgeLabel="مورد خارجي مستقل"
          downloadFilename={`resource-${selectedQr.id}-qr.png`}
          isExternalResource={true}
        />
      )}
    </div>
  );
};

export default ExternalResourcesList;
