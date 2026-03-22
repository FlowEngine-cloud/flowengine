'use client';

import { ChevronDown } from 'lucide-react';

interface TerminalSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  terminalOutput: string[];
  terminalInput: string;
  terminalLoading: boolean;
  hasCredentials: boolean;
  onInputChange: (value: string) => void;
  onExecute: (command: string) => void;
  onClear: () => void;
  onMaximize?: () => void;
}

export default function TerminalSection({
  isExpanded,
  onToggle,
  terminalOutput,
  terminalInput,
  terminalLoading,
  hasCredentials,
  onInputChange,
  onExecute,
  onClear,
  onMaximize,
}: TerminalSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className='w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors'
      >
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-green-900/30 rounded-lg'>
            <svg className='w-5 h-5 text-green-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
              />
            </svg>
          </div>
          <div className='text-left'>
            <p className='text-green-400 text-sm font-medium'>Terminal</p>
            <p className='text-white/50 text-xs'>Execute SQL commands directly</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className='mt-3'>
          {/* Terminal Window */}
          <div className='bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-2xl'>
            {/* Terminal Header */}
            <div
              className='bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700 cursor-pointer select-none'
              onDoubleClick={onMaximize}
              title='Double-click to expand'
            >
              <div className='flex items-center gap-2'>
                <div className='flex gap-1.5'>
                  <div className='w-3 h-3 rounded-full bg-red-500/80'></div>
                  <div
                    className='w-3 h-3 rounded-full bg-yellow-500/80 cursor-pointer hover:bg-yellow-400'
                    onClick={(e) => {
                      e.stopPropagation();
                      onMaximize?.();
                    }}
                    title='Maximize'
                  ></div>
                  <div className='w-3 h-3 rounded-full bg-green-500/80'></div>
                </div>
                <span className='text-gray-400 text-xs font-mono ml-2'>psql - PostgreSQL Terminal</span>
              </div>
              {terminalOutput.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                  className='text-gray-400 hover:text-white text-xs transition-colors'
                  title='Clear terminal'
                >
                  Clear
                </button>
              )}
            </div>

            {/* Terminal Body */}
            <div className='bg-black p-4'>
              {/* Welcome Message */}
              {terminalOutput.length === 0 && (
                <div className='font-mono text-xs text-gray-500 mb-3'>
                  <div>PostgreSQL interactive terminal</div>
                  <div className='mt-1'>Type SQL commands and press Enter to execute.</div>
                  <div className='mt-1'>
                    Example: <span className='text-green-400'>SELECT version();</span>
                  </div>
                </div>
              )}

              {/* Terminal Output */}
              <div className='max-h-64 overflow-y-auto mb-3 font-mono text-xs'>
                {terminalOutput.map((line, index) => (
                  <div key={index} className='mb-1'>
                    {line.startsWith('postgres>') ? (
                      <div className='text-green-400'>{line}</div>
                    ) : line.startsWith('Error:') ? (
                      <div className='text-red-400'>{line}</div>
                    ) : (
                      <div className='text-gray-300 whitespace-pre-wrap'>{line}</div>
                    )}
                  </div>
                ))}
                {terminalLoading && <div className='text-gray-500 animate-pulse'>Executing...</div>}
              </div>

              {/* Terminal Input Line */}
              <div className='flex items-center gap-2 font-mono text-sm'>
                <span className='text-green-400'>postgres{'>'}</span>
                <input
                  type='text'
                  value={terminalInput}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && terminalInput.trim() && !terminalLoading) {
                      onExecute(terminalInput.trim());
                    }
                  }}
                  placeholder='enter SQL command...'
                  disabled={terminalLoading || !hasCredentials}
                  className='flex-1 bg-transparent text-gray-100 placeholder:text-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'
                  autoComplete='off'
                  spellCheck='false'
                />
              </div>

              {!hasCredentials && (
                <div className='mt-3 pt-3 border-t border-gray-800'>
                  <p className='text-yellow-400/80 text-xs font-mono'>
                    ⚠ No credentials found. Expand "Database Access & Credentials" below and click refresh.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
