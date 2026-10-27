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
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="wa-fab-icon"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.174L2.054 21.52a.75.75 0 00.926.926l4.346-1.384A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-4.708 6.07c.22-.494.46-.504.675-.513.176-.008.377-.008.577-.008.2 0 .526.075.802.377.276.3 1.053 1.028 1.053 2.51 0 1.482 1.078 2.91 1.229 3.111.15.2 2.08 3.324 5.127 4.512.723.282 1.288.45 1.728.59.726.23 1.386.198 1.908.12.58-.087 1.779-.727 2.03-1.428.25-.702.25-1.304.175-1.429-.075-.125-.276-.2-.577-.35-.3-.151-1.78-.878-2.055-.978-.276-.1-.476-.15-.677.15-.2.301-.776.978-.952 1.179-.175.2-.35.226-.651.075-.3-.15-1.267-.467-2.414-1.49-.893-.796-1.496-1.78-1.671-2.08-.176-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.15-.175.2-.3.301-.501.1-.2.05-.376-.025-.526-.076-.151-.677-1.631-.928-2.233z"
            fill="#ffffff"
          />
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
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2Z" />
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
