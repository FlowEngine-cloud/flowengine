'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SendIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  return { textareaRef, adjustHeight };
}

interface HomepageChatboxProps {
  onSubmit: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  initialValue?: string;
  shouldClearOnSubmit?: boolean;
  children?: React.ReactNode;
}

export function HomepageChatbox({
  onSubmit,
  placeholder = 'Describe your workflow idea...',
  disabled = false,
  initialValue = '',
  shouldClearOnSubmit = true,
  children,
}: HomepageChatboxProps) {
  const [value, setValue] = useState(initialValue);
  const [isTyping, setIsTyping] = useState(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 80,
    maxHeight: 200,
  });

  // Update value when initialValue changes
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
      adjustHeight();
    }
  }, [initialValue, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSendMessage();
      }
    }
  };

  const handleSendMessage = () => {
    if (value.trim() && !disabled) {
      setIsTyping(true);
      onSubmit(value.trim());

      // Only clear the message if shouldClearOnSubmit is true (user is logged in)
      if (shouldClearOnSubmit) {
        setValue('');
        adjustHeight(true);
      }

      // Reset typing state after a short delay
      setTimeout(() => {
        setIsTyping(false);
      }, 1000);
    }
  };

  return (
    <div className='w-full max-w-[1100px] mx-auto'>
      <motion.div
        className='relative rounded-2xl glow-effect bg-black/90 backdrop-blur-xl border border-white/20'
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
      >
        {/* Header */}
        <div className='px-8 py-5 text-center border-b border-white/10'>
          <p className='text-lg text-white/80'>Describe your workflow and watch it come to life.</p>
        </div>

        {/* Chat Input */}
        <div className='p-8'>
          <div className='relative'>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isTyping}
              className={cn(
                'w-full px-5 py-5 pr-16',
                'resize-none',
                'bg-transparent',
                'border border-white/20 rounded-xl',
                'text-white text-base',
                'focus:outline-none focus:border-white/40',
                'placeholder:text-white/40',
                'min-h-[100px]',
                'transition-all duration-200',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{
                overflow: 'hidden',
              }}
            />

            {/* Send Button */}
            <motion.button
              type='button'
              onClick={handleSendMessage}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={!value.trim() || disabled || isTyping}
              className={cn(
                'absolute bottom-3 right-3',
                'p-2 rounded-lg',
                'transition-all duration-200',
                'flex items-center justify-center',
                value.trim() && !disabled && !isTyping
                  ? 'btn-minimal-filled'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              )}
            >
              {isTyping ? (
                <Sparkles className='w-4 h-4 animate-pulse' />
              ) : (
                <SendIcon className='w-4 h-4' />
              )}
            </motion.button>
          </div>

          {/* Children (workflow ideas) */}
          {children && (
            <div className='mt-2'>
              {children}
            </div>
          )}
        </div>

        {/* Animated border effect */}
        <div className='accent-border' />
      </motion.div>

    </div>
  );
}
