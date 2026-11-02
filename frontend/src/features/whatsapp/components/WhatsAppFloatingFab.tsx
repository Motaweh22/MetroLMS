import React, { useState, useEffect, useRef } from 'react';
import { useWhatsAppContacts } from '../hooks/useWhatsAppContacts';
import type { WhatsAppContextConfig, WhatsAppContact } from '../types';
import '../styles/whatsapp-fab.css';

export interface WhatsAppFloatingFabProps {
  config: WhatsAppContextConfig;
  className?: string;
}

export const WhatsAppFloatingFab: React.FC<WhatsAppFloatingFabProps> = ({ config, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    contacts,
    hasContacts,
    contextTitle,
    unavailableReasonAr,
    getContactUrl,
  } = useWhatsAppContacts(config);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleContactClick = (contact: WhatsAppContact) => {
    const url = getContactUrl(contact);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={containerRef}
      className={`wa-fab ${className}`}
      id="wa-fab-container"
      data-testid="wa-fab-container"
    >
      {/* Floating Action Button */}
      <button
        type="button"
        id="wa-fab-btn"
        data-testid="wa-fab-btn"
        className="wa-fab-btn"
        title="تواصل عبر واتساب"
        aria-label="تواصل عبر واتساب"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="#ffffff"
          xmlns="http://www.w3.org/2000/svg"
          className="wa-fab-icon"
          aria-hidden="true"
        >
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zM12.04 3.67c4.46 0 8.08 3.62 8.08 8.08 0 4.46-3.62 8.08-8.08 8.08-1.42 0-2.81-.38-4.02-1.11l-.29-.17-3.02.79.81-2.94-.19-.31A7.973 7.973 0 0 1 3.96 11.75c0-4.46 3.62-8.08 8.08-8.08zm4.62 9.77c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.57.13-.17.25-.66.81-.81.98-.15.17-.31.19-.56.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.15-.25-.02-.39.11-.52.11-.11.25-.31.38-.47.13-.17.17-.29.25-.48.08-.19.04-.36-.02-.5-.06-.13-.57-1.38-.78-1.89-.2-.5-.41-.43-.57-.44h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.02 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.42 1.44.54.61.2 1.16.17 1.6-.1.49-.3 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29z" />
        </svg>
      </button>

      {/* Popover Menu */}
      <div
        id="wa-fab-menu"
        data-testid="wa-fab-menu"
        className={`wa-fab-menu ${isOpen ? 'show' : ''}`}
        role="dialog"
        aria-label={contextTitle}
      >
        {/* Menu Title Header */}
        <div className="wa-fab-menu-title">
          <div className="wa-fab-menu-title-content">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="#25D366"
              aria-hidden="true"
            >
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zM12.04 3.67c4.46 0 8.08 3.62 8.08 8.08 0 4.46-3.62 8.08-8.08 8.08-1.42 0-2.81-.38-4.02-1.11l-.29-.17-3.02.79.81-2.94-.19-.31A7.973 7.973 0 0 1 3.96 11.75c0-4.46 3.62-8.08 8.08-8.08zm4.62 9.77c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.57.13-.17.25-.66.81-.81.98-.15.17-.31.19-.56.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.15-.25-.02-.39.11-.52.11-.11.25-.31.38-.47.13-.17.17-.29.25-.48.08-.19.04-.36-.02-.5-.06-.13-.57-1.38-.78-1.89-.2-.5-.41-.43-.57-.44h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.02 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.42 1.44.54.61.2 1.16.17 1.6-.1.49-.3 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29z" />
            </svg>
            <span>{contextTitle}</span>
          </div>
          <button
            type="button"
            className="text-xs text-text-muted hover:text-text cursor-pointer bg-transparent border-0"
            onClick={() => setIsOpen(false)}
            aria-label="إغلاق قائمة التواصل"
          >
            ✕
          </button>
        </div>

        {/* Contacts List or Unavailable State */}
        {hasContacts ? (
          <div className="wa-fab-contacts-list" role="list">
            {contacts.map((contact, index) => (
              <button
                key={contact.id || index}
                type="button"
                className="wa-contact"
                data-testid={`wa-contact-item-${contact.id}`}
                onClick={() => handleContactClick(contact)}
              >
                <div className="wa-contact-avatar">
                  {contact.avatarInitial || contact.name[0] || 'م'}
                </div>
                <div className="wa-contact-info">
                  <div className="wa-contact-name">{contact.name}</div>
                  <div className="wa-contact-role">{contact.role}</div>
                </div>
                {contact.displayNumber && (
                  <span className="wa-contact-phone">{contact.displayNumber}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="wa-unavailable-card" data-testid="wa-unavailable-message">
            <div className="wa-unavailable-icon">💬</div>
            <div className="font-semibold text-text mb-1">غير متوفر حالياً</div>
            <div>{unavailableReasonAr}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppFloatingFab;
