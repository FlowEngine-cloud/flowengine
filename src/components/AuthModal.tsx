'use client';

import { useEffect, useRef } from 'react';
import Auth from './Auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'signin' | 'signup';
  redirectTo?: string;
  closeable?: boolean; // Whether the modal can be dismissed
  lockedEmail?: string; // Pre-filled and read-only email (for invites)
}

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'signin', redirectTo, closeable = true, lockedEmail }: AuthModalProps) {
  if (!isOpen) return null;
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Close modal when clicking outside (only if closeable)
  useEffect(() => {
    if (!closeable) return;

    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, closeable]);

  // Close modal with Escape key (only if closeable)
  useEffect(() => {
    if (!closeable) return;

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose, closeable]);

  return (
    <div className='fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4'>
      <div
        ref={modalRef}
        className='glass rounded-2xl glow-effect max-w-md w-full mx-4 transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95 border border-white/20'
      >
        <div className='relative p-8'>
          {closeable && (
            <button
              onClick={onClose}
              className='absolute top-4 right-4 text-white/60 hover:text-white transition-colors duration-200 rounded-full p-2 hover:bg-white/10 cursor-pointer'
            >
              <span className='sr-only'>Close</span>
              <svg className='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          )}
          <Auth onSuccess={onSuccess || onClose} initialMode={initialMode} redirectTo={redirectTo} lockedEmail={lockedEmail} />
        </div>
        <div className='accent-border' />
      </div>
    </div>
  );
}
