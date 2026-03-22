'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthErrorPage() {
  const router = useRouter();

  // Redirect to home after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 10000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-black px-4'>
      <div className='max-w-md w-full space-y-8 text-center'>
        <div className='mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-900/20'>
          <svg
            className='h-8 w-8 text-red-400'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        </div>

        <h1 className='text-3xl font-bold text-white'>Authentication Error</h1>

        <p className='text-gray-300 mt-2'>
          We encountered an issue while processing your authentication request. This could be due to
          an expired or invalid authentication link.
        </p>

        <div className='mt-8 space-y-4'>
          <Link
            href='/'
            className='btn-minimal-filled w-full flex justify-center py-3 px-4 rounded-md shadow-sm text-sm font-medium'
          >
            Return to Home
          </Link>

          <button
            onClick={() => (window.location.href = '/#signin')}
            className='btn-minimal w-full flex justify-center py-3 px-4 rounded-md shadow-sm text-sm font-medium'
          >
            Try Again
          </button>
        </div>

        <p className='text-sm text-gray-400 mt-8'>
          You will be automatically redirected to the home page in 10 seconds.
        </p>
      </div>
    </div>
  );
}
