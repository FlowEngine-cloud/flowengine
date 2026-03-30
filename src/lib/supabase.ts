import { createBrowserClient } from '@supabase/ssr';

// Placeholder values allow the build to succeed without env vars.
// At runtime, real values MUST be provided via .env.local or Docker env.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (typeof window !== 'undefined' && supabaseUrl === 'https://placeholder.supabase.co') {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL - set it in .env.local');
}

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-application-name': 'flowengine-portal',
      },
    },
  }
);

// Helper function to get user session
export const getCurrentUser = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return session?.user;
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return !!user;
};
