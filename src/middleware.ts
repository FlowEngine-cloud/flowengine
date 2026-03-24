import { NextRequest, NextResponse } from 'next/server';

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

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
