import { NextRequest, NextResponse } from 'next/server';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

// API routes that are safe to allow even in demo mode (reads + auth)
const DEMO_ALLOWLIST = [
  '/api/auth',
  '/api/health',
  '/api/flowengine/pricing',
  '/api/flowengine/instances',  // GET only — blocked below for POST
  '/api/n8n/status',
  '/api/docker/status',
  '/api/openclaw',
  '/api/settings/portal',       // GET portal settings (needed for branding)
  '/api/user-settings',
  '/api/widget-studio',         // Allow saving UI components in demo mode
  '/api/public',                // Allow public widget fetch/submit
];

export function middleware(req: NextRequest) {
  if (!DEMO_MODE) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const { method } = req;

  // Only block mutating requests to API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return NextResponse.next();

  // Allow auth endpoints so login still works
  if (DEMO_ALLOWLIST.some(p => pathname.startsWith(p))) return NextResponse.next();

  return NextResponse.json(
    { error: 'Demo mode — this instance is read-only.' },
    { status: 403 }
  );
}

export const config = {
  matcher: '/api/:path*',
};
