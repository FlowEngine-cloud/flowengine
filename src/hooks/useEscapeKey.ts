import { useEffect } from 'react';

/**
 * Hook to handle Escape key press for closing modals
 * @param isOpen - Whether the modal is currently open
 * @param onClose - Function to call when Escape is pressed
 */
export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
}
