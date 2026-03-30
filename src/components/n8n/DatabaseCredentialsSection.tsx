'use client';

import { ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface DatabaseCredentialsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  postgresUser: string;
  postgresDatabase: string;
  postgresPassword?: string | null;
  refreshingCredentials: boolean;
  onRefreshCredentials: () => void;
}

export default function DatabaseCredentialsSection({
  isExpanded,
  onToggle,
  postgresUser,
  postgresDatabase,
  postgresPassword,
  refreshingCredentials,
  onRefreshCredentials,
}: DatabaseCredentialsSectionProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className='border-t border-gray-700 pt-4'>
      <button
        onClick={onToggle}
        className='w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors'
      >
        <div className='flex items-center gap-3'>
          <div className='p-2 bg-blue-900/30 rounded-lg'>
            <svg className='w-5 h-5 text-blue-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
              />
            </svg>
          </div>
          <div className='text-left'>
            <p className='text-blue-400 text-sm font-medium'>Database Access & Credentials</p>
            <p className='text-white/50 text-xs'>Direct PostgreSQL access for advanced users</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className='mt-3 space-y-3'>
          <div className='bg-black/30 border border-gray-700/50 rounded-lg p-4'>
            <p className='text-white/70 text-xs mb-3'>
              Connect external tools like pgAdmin, TablePlus, or DBeaver to your PostgreSQL database. Use these
              credentials for backups, custom queries, or data migrations.
            </p>

            <div className='flex items-center justify-end mb-3'>
              <button
                onClick={onRefreshCredentials}
                disabled={refreshingCredentials}
                className='p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                title='Refresh database credentials'
              >
                <RefreshCw className={`w-4 h-4 ${refreshingCredentials ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className='bg-black/50 rounded-lg p-4 space-y-3'>
              {/* Username */}
              <div className='flex items-center justify-between'>
                <div className='flex-1'>
                  <p className='text-white/60 text-xs mb-1'>Username</p>
                  <code className='text-white text-sm font-mono'>{postgresUser || 'n8n'}</code>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(postgresUser || 'n8n')}
                  className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors'
                  title='Copy username'
                >
                  <Copy className='w-4 h-4' />
                </button>
              </div>

              {/* Database Name */}
              <div className='flex items-center justify-between'>
                <div className='flex-1'>
                  <p className='text-white/60 text-xs mb-1'>Database Name</p>
                  <code className='text-white text-sm font-mono'>{postgresDatabase || 'n8n'}</code>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(postgresDatabase || 'n8n')}
                  className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors'
                  title='Copy database name'
                >
                  <Copy className='w-4 h-4' />
                </button>
              </div>

              {/* Password with Show/Hide */}
              <div className='flex items-center justify-between'>
                <div className='flex-1'>
                  <p className='text-white/60 text-xs mb-1'>Password</p>
                  <code className='text-white text-sm font-mono break-all'>
                    {refreshingCredentials ? (
                      <span className='text-white/50'>Loading...</span>
                    ) : showPassword ? (
                      postgresPassword || <span className='text-white/50'>Click refresh to fetch</span>
                    ) : postgresPassword ? (
                      '••••••••••••••••'
                    ) : (
                      <span className='text-white/50'>Click refresh to fetch</span>
                    )}
                  </code>
                </div>
                <div className='flex gap-1'>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={!postgresPassword || refreshingCredentials}
                    className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
                        />
                      </svg>
                    ) : (
                      <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                        />
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (postgresPassword) {
                        navigator.clipboard.writeText(postgresPassword);
                        alert('Password copied to clipboard!');
                      }
                    }}
                    disabled={!postgresPassword || refreshingCredentials}
                    className='p-2 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    title='Copy password'
                  >
                    <Copy className='w-4 h-4' />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
