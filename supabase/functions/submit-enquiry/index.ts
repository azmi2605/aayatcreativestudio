// supabase/functions/submit-enquiry/index.ts
// Supabase Edge Function: handles project enquiry submissions
// Implements API.md section 6, multi-category support, and configurable notification toggles.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalizeInput,
  validateEnquiry,
  checkUnknownFields,
  ALLOWED_FIELDS,
  SERVICE_LABELS,
  type NormalizedEnquiry,
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

  // Notification configuration & master environment toggle
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const notifyEmailTo = Deno.env.get('NOTIFY_EMAIL_TO') ?? 'aayatcreativestudio@gmail.com';
  const mailFrom = Deno.env.get('MAIL_FROM') ?? 'notifications@aayatcreativestudio.com';
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://aayatcreativestudio.com';

  // Master environment toggle (default: enabled unless set to false/0/off)
  const envNotificationsToggle = Deno.env.get('NOTIFICATIONS_ENABLED') ?? Deno.env.get('ENABLE_NOTIFICATIONS') ?? 'true';
  const isEnvNotificationEnabled = !['false', '0', 'off', 'no'].includes(envNotificationsToggle.toLowerCase().trim());

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

    // 9. Input Normalization & Validation (supports multiple categories & notification toggle)
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

    // Check header-level notification overrides
    const headerDisable = req.headers.get('x-disable-notification') === 'true' ||
                          req.headers.get('x-send-notification') === 'false';
    const isNotificationEnabled = isEnvNotificationEnabled && normalized.notify && !headerDisable;

    // 10. Database Persistence
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store both primary service enum and multiple services array
    const servicesArray = normalized.services.length > 0 ? normalized.services : [normalized.service];

    let insertResult = await supabase
      .from('enquiries')
      .insert({
        submission_id: normalized.submissionId,
        name: normalized.name,
        brand_name: normalized.brandName,
        email: normalized.email,
        phone: normalized.phone,
        service: normalized.service,
        services: servicesArray,
        budget_range: normalized.budgetRange ?? 'not_sure_yet',
        project_details: normalized.projectDetails,
        reference_link: normalized.referenceLink,
        timeline: normalized.timeline,
        status: 'new',
      });

    // Fallback if database doesn't have 'services' column yet
    if (insertResult.error && insertResult.error.message?.toLowerCase().includes('services')) {
      insertResult = await supabase
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
    }

    const { error: insertError } = insertResult;

    if (insertError) {
      // 23505 = Unique violation (same submissionId submitted again) -> Idempotent 200 OK
      if (insertError.code === '23505') {
        return corsResponse(
          origin,
          allowedOrigins,
          {
            ok: true,
            submissionId: normalized.submissionId,
            idempotent: true,
          },
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

    // 11. Notification Dispatch with Toggle
    if (!isNotificationEnabled) {
      console.log(
        `[${requestId}] Notification skipped: toggle is OFF (envEnabled=${isEnvNotificationEnabled}, requestEnabled=${normalized.notify}, headerDisable=${headerDisable})`
      );
    } else if (!resendApiKey) {
      console.log(
        `[${requestId}] Notification skipped: RESEND_API_KEY is not configured in environment.`
      );
    } else {
      // Dispatch background email without delaying the HTTP response
      void sendOwnerNotification({
        enquiry: normalized,
        requestId,
        resendApiKey,
        mailFrom,
        notifyEmailTo,
        siteUrl,
        supabase,
      });
    }

    // 12. Success Response
    return corsResponse(
      origin,
      allowedOrigins,
      {
        ok: true,
        submissionId: normalized.submissionId,
        services: servicesArray,
        notification: {
          enabled: isNotificationEnabled,
        },
      },
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

/**
 * Sends notification email to studio owner via Resend REST API
 * Updates 'notified_at' on the enquiry record on success.
 */
async function sendOwnerNotification(params: {
  enquiry: NormalizedEnquiry;
  requestId: string;
  resendApiKey: string;
  mailFrom: string;
  notifyEmailTo: string;
  siteUrl: string;
  supabase: any;
}): Promise<void> {
  const { enquiry, requestId, resendApiKey, mailFrom, notifyEmailTo, siteUrl, supabase } = params;

  const displayServices = enquiry.servicesDisplay || SERVICE_LABELS[enquiry.service] || enquiry.service;
  const rawSubject = `New Project Enquiry: ${enquiry.brandName} (${displayServices})`;
  const subject = rawSubject.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, 150);

  const lines = [
    '=== AAYAT CREATIVE STUDIO — NEW ENQUIRY ===',
    '',
    `Submission ID : ${enquiry.submissionId}`,
    `Client Name   : ${enquiry.name}`,
    `Brand / Studio: ${enquiry.brandName}`,
    `Email         : ${enquiry.email}`,
    `Phone         : ${enquiry.phone ?? 'Not provided'}`,
    `Categories    : ${displayServices}`,
    `Budget Range  : ${enquiry.budgetRange ?? 'Not specified'}`,
    `Timeline      : ${enquiry.timeline ?? 'Not specified'}`,
    `Reference Link: ${enquiry.referenceLink ?? 'Not provided'}`,
    '',
    '--- Project Brief / Details ---',
    enquiry.projectDetails,
    '',
    '-------------------------------',
    `Admin Portal  : ${siteUrl}/admin/`,
    `Request ID    : ${requestId}`,
  ];

  const body = lines.map((l) => l.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')).join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom,
        to: [notifyEmailTo],
        subject,
        reply_to: enquiry.email,
        text: body,
        idempotency_key: `enquiry-${enquiry.submissionId}`,
      }),
    });

    if (res.ok) {
      console.log(`[${requestId}] Owner notification delivered successfully to ${notifyEmailTo}`);
      const { error: updateError } = await supabase
        .from('enquiries')
        .update({ notified_at: new Date().toISOString() })
        .eq('submission_id', enquiry.submissionId);

      if (updateError) {
        console.warn(`[${requestId}] Failed to set notified_at timestamp:`, updateError);
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.error(`[${requestId}] Resend notification API error: ${res.status} ${errText}`);
    }
  } catch (err) {
    console.error(`[${requestId}] Failed to send notification email:`, err);
  }
}