// supabase/functions/submit-enquiry/index.ts
// Supabase Edge Function: handles project enquiry submissions
// Implements API.md section 6 and contracts/enquiry-contract.json

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeInput,
  validateEnquiry,
  checkUnknownFields,
  ALLOWED_FIELDS,
} from '../_shared/validation.ts';
import {
  corsResponse,
  corsPreflightResponse,
  generateRequestId,
  parseAllowedOrigins,
  isOriginAllowed,
} from '../_shared/cors.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  const requestId = generateRequestId();
  const origin = req.headers.get('Origin');

  // Load environment variables with sensible defaults
  const allowedOriginsEnv = Deno.env.get('ALLOWED_ORIGINS');
  const allowedOrigins = allowedOriginsEnv ? parseAllowedOrigins(allowedOriginsEnv) : ['*'];
  const maxBodyBytes = parseInt(Deno.env.get('MAX_BODY_BYTES') ?? '16384', 10);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(origin, allowedOrigins);
  }

  // 2. HTTP Method Check
  if (req.method !== 'POST') {
    return corsResponse(
      origin,
      allowedOrigins,
      { error: { code: 'method_not_allowed', message: 'Method not allowed' }, requestId },
      405,
      { 'Allow': 'POST, OPTIONS' }
    );
  }

  // 3. Origin Verification (skip if wildcard allowed or same-origin)
  if (origin && !isOriginAllowed(origin, allowedOrigins)) {
    return corsResponse(
      origin,
      allowedOrigins,
      { error: { code: 'origin_not_allowed', message: 'Origin not allowed' }, requestId },
      403
    );
  }

  // 4. Content-Type Header Verification
  const contentType = req.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return corsResponse(
      origin,
      allowedOrigins,
      { error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json' }, requestId },
      415
    );
  }

  try {
    // 5. Read body text and enforce payload size limits
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).length > maxBodyBytes) {
      return corsResponse(
        origin,
        allowedOrigins,
        { error: { code: 'payload_too_large', message: 'Request body exceeds the size limit' }, requestId },
        413
      );
    }

    // 6. Parse JSON payload
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(rawBody);
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error('Not an object');
      }
    } catch {
      return corsResponse(
        origin,
        allowedOrigins,
        { error: { code: 'invalid_json', message: 'Body is not valid JSON' }, requestId },
        400
      );
    }

    // 7. Bot Honeypot Check (field 'website' must be absent or empty)
    if (raw.website && String(raw.website).trim().length > 0) {
      // Return 200 silently to deceive spambots; do not store in database
      return corsResponse(
        origin,
        allowedOrigins,
        { ok: true, submissionId: String(raw.submissionId ?? '') },
        200
      );
    }

    // 8. Strict Field Whitelist Check
    const unexpected = checkUnknownFields(raw, ALLOWED_FIELDS);
    if (unexpected.length > 0) {
      const fieldErrors: Record<string, { code: string }> = {};
      for (const field of unexpected) {
        fieldErrors[field] = { code: 'unknown_field' };
      }
      return corsResponse(
        origin,
        allowedOrigins,
        {
          error: {
            code: 'validation_failed',
            message: 'One or more fields are invalid.',
            fields: fieldErrors,
          },
          requestId,
        },
        400
      );
    }

    // 9. Input Normalization & Validation
    const normalized = normalizeInput(raw);
    const validation = validateEnquiry(normalized);

    if (!validation.valid) {
      return corsResponse(
        origin,
        allowedOrigins,
        {
          error: {
            code: 'validation_failed',
            message: 'One or more fields are invalid.',
            fields: validation.fields,
          },
          requestId,
        },
        400
      );
    }

    // 10. Database Persistence
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase
      .from('enquiries')
      .insert({
        submission_id: normalized.submissionId,
        name: normalized.name,
        brand_name: normalized.brandName,
        email: normalized.email,
        phone: normalized.phone,
        service: normalized.service,
        budget_range: normalized.budgetRange ?? 'not_sure_yet',
        project_details: normalized.projectDetails,
        reference_link: normalized.referenceLink,
        timeline: normalized.timeline,
        status: 'new',
      });

    if (insertError) {
      // 23505 = Unique violation (same submissionId submitted again) -> Idempotent 200 OK
      if (insertError.code === '23505') {
        return corsResponse(
          origin,
          allowedOrigins,
          { ok: true, submissionId: normalized.submissionId },
          200
        );
      }
      console.error('Database insert error:', insertError);
      return corsResponse(
        origin,
        allowedOrigins,
        { error: { code: 'server_error', message: 'Failed to record enquiry' }, requestId },
        500
      );
    }

    // 11. Success Response
    return corsResponse(
      origin,
      allowedOrigins,
      { ok: true, submissionId: normalized.submissionId },
      200
    );

  } catch (err) {
    console.error('Submit enquiry function error:', err);
    return corsResponse(
      origin,
      allowedOrigins,
      { error: { code: 'server_error', message: 'An unexpected error occurred' }, requestId },
      500
    );
  }
});