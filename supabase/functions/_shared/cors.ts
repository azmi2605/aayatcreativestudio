// supabase/functions/_shared/cors.ts
// CORS handling for Edge Functions
// API.md 2.6: Echo back the matching origin, never a wildcard.
// Methods: POST and OPTIONS only. Headers: Content-Type, apikey, Authorization, X-Client-Info.
// Preflight cache: 24 hours.

export interface CorsConfig {
  allowedOrigins: string[];
}

export function parseAllowedOrigins(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue.split(',').map((o) => o.trim()).filter(Boolean);
}

export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) return true;
  return allowedOrigins.some((allowed) => {
    // Support simple pattern matching for dev preview domains (e.g. "*.preview.domain.com")
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(2);
      return origin.endsWith(suffix);
    }
    return origin === allowed;
  });
}

export function corsResponse(
  origin: string | null,
  allowedOrigins: string[],
  body: unknown,
  status: number = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  const isAllowed = isOriginAllowed(origin, allowedOrigins);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  };

  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, apikey, Authorization, X-Client-Info';
    headers['Access-Control-Max-Age'] = '86400'; // 24 hours
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function corsPreflightResponse(
  origin: string | null,
  allowedOrigins: string[]
): Response {
  const isAllowed = isOriginAllowed(origin, allowedOrigins);
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, apikey, Authorization, X-Client-Info';
    headers['Access-Control-Max-Age'] = '86400'; // 24 hours
  }

  return new Response(null, { status: 204, headers });
}

export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}