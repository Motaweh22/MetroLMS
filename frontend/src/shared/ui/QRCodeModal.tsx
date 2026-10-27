import React, { useState } from 'react';
import { generateQrSvg, downloadQrCodeImage } from '@/core/utils/qrGenerator';
import { Button } from './Button';
import { Badge } from './Badge';
import { Icon } from './Icon';

export interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  subtitle?: string;
  badgeLabel?: string;
  downloadFilename?: string;
  isExternalResource?: boolean;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  title,
  url,
  subtitle,
  badgeLabel,
  downloadFilename = 'cairo-metro-qr.png',
  isExternalResource = false,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const svgContent = generateQrSvg(url, { size: 220, margin: 3 });

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } catch {
          // JSDOM fallback
        }
        document.body.removeChild(textarea);
      }
    } catch {
      // Ignore copy error in restricted environments
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    downloadQrCodeImage(url, downloadFilename, 1024);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      data-testid="qr-code-modal"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-alt/40">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="link" size="sm" />
            </span>
            <div>
              <h2 id="qr-modal-title" className="text-sm font-bold text-text-heading">
                رمز الاستجابة السريعة (QR Code)
              </h2>
              {badgeLabel && (
                <Badge variant="primary" className="text-[10px] mt-0.5">
                  {badgeLabel}
                </Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-neutral-light transition-colors"
            aria-label="إغلاق النافذة"
            data-testid="qr-modal-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="space-y-1 max-w-xs">
            <h3 className="text-sm font-bold text-text-heading line-clamp-2">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-text-muted">{subtitle}</p>
            )}
          </div>

          {/* QR Code Container */}
          <div
            className="p-4 bg-white rounded-2xl border-2 border-border shadow-inner flex items-center justify-center"
            data-testid="qr-code-display"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {/* Encoded URL Box */}
          <div className="w-full p-2.5 rounded-xl bg-bg-alt/60 border border-border text-start">
            <span className="text-[10px] text-text-muted block font-semibold mb-1">
              {isExternalResource ? 'الرابط الخارجي المرمز:' : 'الرابط المباشر للمقرر:'}
            </span>
            <div className="text-xs font-mono text-primary-dark truncate select-all" dir="ltr" data-testid="qr-encoded-url">
              {url}
            </div>
          </div>

          {/* Security and Access Rules Note */}
          <div className="text-[11px] text-text-muted/80 leading-relaxed bg-primary/5 p-3 rounded-xl border border-primary/15 text-start w-full">
            {isExternalResource ? (
              <span>
                ● هذا الرمز يوجه مباشرة إلى المورد الخارجي المعتمد. يرجى التأكد من اتصال المتدرب بشبكة الإنترنت.
              </span>
            ) : (
              <span>
                ● مسح الرمز ينقل المتدرب مباشرة لصفحة تفاصيل المقرر. في حال تطلب المقرر تسجيلاً مسبقاً، تحتفظ المنظومة بمسار الانتقال وتطلب تسجيل الدخول وفق القواعد.
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={copied ? 'check' : 'copy'}
              onClick={handleCopyLink}
              className={`flex-1 text-xs font-bold ${copied ? 'text-success' : ''}`}
              data-testid="qr-copy-link-btn"
            >
              {copied ? 'تم النسخ!' : 'نسخ الرابط'}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="download"
              onClick={handleDownload}
              className="flex-1 text-xs font-bold"
              data-testid="qr-download-btn"
            >
              تنزيل الصورة (PNG)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
