import { NextResponse } from 'next/server';

/**
 * Returns which OAuth providers are currently configured via environment
 * variables. The response contains only boolean flags — credential values
 * are never exposed to the client.
 *
 * Used by `OAuthButtons` to decide which (if any) provider buttons to render.
 * The route is public and intentionally cacheable for the duration of a page
 * view; providers don't change at runtime.
 */
export function GET() {
  return NextResponse.json(
    {
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
    {
      headers: {
        // Allow the browser to cache this for the tab lifetime.
        // SW / CDN should NOT cache it because the env can change on redeploy.
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}
