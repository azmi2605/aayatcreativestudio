// supabase/functions/submit-enquiry/index.js
// Supabase Edge Function: handles project brief submission per API.md section 6
// Supports multiple category options, configurable notification toggles, and Resend notifications

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS_RAW = Deno.env.get('ALLOWED_ORIGINS') || '';
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW.split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY_BYTES = parseInt(Deno.env.get('MAX_BODY_BYTES') || '16384', 10);
const RATE_LIMIT_PER_HOUR = parseInt(Deno.env.get('RATE_LIMIT_PER_HOUR') || '5', 10);
const RATE_LIMIT_GLOBAL_PER_DAY = parseInt(Deno.env.get('RATE_LIMIT_GLOBAL_PER_DAY') || '100', 10);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const NOTIFY_EMAIL_TO = Deno.env.get('NOTIFY_EMAIL_TO') || 'aayatcreativestudio@gmail.com';
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'notifications@aayatcreativestudio.com';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://aayatcreativestudio.com';

// Master environment toggle (default: true)
const ENV_NOTIFICATIONS_TOGGLE = Deno.env.get('NOTIFICATIONS_ENABLED') || Deno.env.get('ENABLE_NOTIFICATIONS') || 'true';
const IS_ENV_NOTIFICATION_ENABLED = !['false', '0', 'off', 'no'].includes(ENV_NOTIFICATIONS_TOGGLE.toLowerCase().trim());

const SERVICE_OPTIONS = ['ad_creatives', 'poster_design', 'social_media_design', 'other'];
const CATEGORY_MAP = {
  ads: 'ad_creatives',
  ad_creatives: 'ad_creatives',
  posters: 'poster_design',
  poster_design: 'poster_design',
  social_media: 'social_media_design',
  social_media_design: 'social_media_design',
  other: 'other',
};
const SERVICE_LABELS = {
  ad_creatives: 'Ad Creatives',
  poster_design: 'Poster Design',
  social_media_design: 'Social Media Design',
  other: 'Other Creative Work',
  ads: 'Ad Creatives',
  posters: 'Poster Design',
  social_media: 'Social Media Design',
};

const BUDGET_RANGE_OPTIONS = ['under_10k', '10k_to_25k', '25k_to_50k', 'above_50k', 'not_sure_yet'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9\s\-().]*$/;
const REFERENCE_LINK_REGEX = /^https?:\/\/[^\s]+$/;
const SINGLE_LINE_REGEX = /^[^\n\r]*$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = [
  'submissionId', 'name', 'brandName', 'email', 'phone',
  'service', 'services', 'categories', 'notify', 'disableNotification',
  'projectDetails', 'budgetRange', 'referenceLink', 'timeline', 'website'
];

function generateRequestId() { return crypto.randomUUID(); }

function errorEnvelope(code, message, status, requestId, fields) {
  const body = { error: { code, message }, requestId };
  if (fields) body.error.fields = fields;
  return body;
}

function corsResponse(origin, allowedOrigins, body, status = 200, extraHeaders = {}) {
  const isAllowed = origin && allowedOrigins.some(allowed => {
    if (allowed.startsWith('*.')) return origin.endsWith(allowed.slice(2));
    return origin === allowed;
  });
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders };
  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, apikey, x-disable-notification, x-send-notification';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function corsPreflight(origin, allowedOrigins) {
  const isAllowed = origin && allowedOrigins.some(allowed => {
    if (allowed.startsWith('*.')) return origin.endsWith(allowed.slice(2));
    return origin === allowed;
  });
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey, x-disable-notification, x-send-notification',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (isAllowed && origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(null, { status: 204, headers });
}

function normalizeInput(raw) {
  const trim = (v) => (v === null || v === undefined ? null : String(v).trim().length === 0 ? null : String(v).trim());
  const stripControl = (s) => (s ? s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') : s);

  // Extract multiple categories or services
  const extractItems = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(item => String(item).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
    return [];
  };

  const rawServicesList = [
    ...extractItems(raw.services),
    ...extractItems(raw.categories),
    ...extractItems(raw.service),
  ];

  const canonicalServices = Array.from(
    new Set(
      rawServicesList.map(s => {
        const lower = s.toLowerCase();
        return CATEGORY_MAP[lower] || lower;
      })
    )
  );

  let primaryService = '';
  if (canonicalServices.length > 0) {
    primaryService = canonicalServices.find(s => SERVICE_OPTIONS.includes(s)) || 'other';
  } else if (raw.service && typeof raw.service === 'string') {
    primaryService = String(raw.service).trim();
  }

  const servicesDisplay = canonicalServices.length > 0
    ? canonicalServices.map(s => SERVICE_LABELS[s] || s).join(', ')
    : (SERVICE_LABELS[primaryService] || primaryService);

  const notifyToggle = raw.notify !== false && raw.disableNotification !== true;

  return {
    submissionId: trim(raw.submissionId) || '',
    name: stripControl(trim(raw.name)) || '',
    brandName: stripControl(trim(raw.brandName)) || '',
    email: stripControl(trim(raw.email)) ? trim(raw.email).toLowerCase() : '',
    phone: stripControl(trim(raw.phone)) || null,
    service: primaryService,
    services: canonicalServices,
    servicesDisplay,
    notify: notifyToggle,
    projectDetails: stripControl(trim(raw.projectDetails)) || '',
    budgetRange: trim(raw.budgetRange) || null,
    referenceLink: trim(raw.referenceLink) || null,
    timeline: stripControl(trim(raw.timeline)) || null,
    website: trim(raw.website) || '',
  };
}

function validateEnquiry(input) {
  const fields = {};
  if (!input.submissionId) fields.submissionId = { code: 'required' };
  else if (!UUID_REGEX.test(input.submissionId)) fields.submissionId = { code: 'invalid_format' };
  if (!input.name) fields.name = { code: 'required' };
  else { if (input.name.length > 100) fields.name = { code: 'too_long', max: 100 }; if (!SINGLE_LINE_REGEX.test(input.name)) fields.name = { code: 'invalid_format' }; }
  if (!input.brandName) fields.brandName = { code: 'required' };
  else { if (input.brandName.length > 100) fields.brandName = { code: 'too_long', max: 100 }; if (!SINGLE_LINE_REGEX.test(input.brandName)) fields.brandName = { code: 'invalid_format' }; }
  if (!input.email) fields.email = { code: 'required' };
  else { if (!EMAIL_REGEX.test(input.email)) fields.email = { code: 'invalid_format' }; if (input.email.length > 254) fields.email = { code: 'too_long', max: 254 }; }
  if (input.phone && input.phone !== '') { if (input.phone.length < 5) fields.phone = { code: 'too_short', min: 5 }; if (input.phone.length > 30) fields.phone = { code: 'too_long', max: 30 }; if (!PHONE_REGEX.test(input.phone)) fields.phone = { code: 'invalid_format' }; }

  // Multi-category / service validation
  if (!input.service && input.services.length === 0) {
    fields.service = { code: 'required' };
  } else if (input.services.length > 0) {
    const hasInvalid = input.services.some(s => !SERVICE_OPTIONS.includes(s));
    if (hasInvalid) fields.services = { code: 'invalid_option' };
  } else if (input.service && !SERVICE_OPTIONS.includes(input.service)) {
    fields.service = { code: 'invalid_option' };
  }

  if (!input.projectDetails) fields.projectDetails = { code: 'required' };
  else { if (input.projectDetails.length < 20) fields.projectDetails = { code: 'too_short', min: 20 }; if (input.projectDetails.length > 1000) fields.projectDetails = { code: 'too_long', max: 1000 }; }
  if (input.budgetRange && input.budgetRange !== '') { if (input.budgetRange.length > 60) fields.budgetRange = { code: 'too_long', max: 60 }; if (!BUDGET_RANGE_OPTIONS.includes(input.budgetRange)) fields.budgetRange = { code: 'invalid_option' }; }
  if (input.referenceLink && input.referenceLink !== '') { if (!REFERENCE_LINK_REGEX.test(input.referenceLink)) fields.referenceLink = { code: 'invalid_format' }; if (input.referenceLink.length > 500) fields.referenceLink = { code: 'too_long', max: 500 }; }
  if (input.timeline && input.timeline !== '') { if (input.timeline.length > 100) fields.timeline = { code: 'too_long', max: 100 }; if (!SINGLE_LINE_REGEX.test(input.timeline)) fields.timeline = { code: 'invalid_format' }; }
  return { valid: Object.keys(fields).length === 0, fields };
}

function checkUnknownFields(raw) {
  const unexpected = [];
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_FIELDS.includes(key)) unexpected.push(key);
  }
  return unexpected;
}

async function sendOwnerEmail(enquiry, requestId, supabase) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL_TO || !MAIL_FROM) {
    console.log(`[${requestId}] Email skipped: missing Resend config`);
    return;
  }
  const displayServices = enquiry.servicesDisplay || SERVICE_LABELS[enquiry.service] || enquiry.service;
  const rawSubject = `New enquiry: ${enquiry.brandName} (${displayServices})`;
  const subject = rawSubject.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, 150);
  const lines = [
    '=== AAYAT CREATIVE STUDIO — NEW ENQUIRY ===',
    '',
    `Submission ID : ${enquiry.submissionId}`,
    `Client Name   : ${enquiry.name}`,
    `Brand         : ${enquiry.brandName}`,
    `Email         : ${enquiry.email}`,
    `Phone         : ${enquiry.phone || 'Not provided'}`,
    `Categories    : ${displayServices}`,
    `Budget        : ${enquiry.budgetRange || 'Not specified'}`,
    `Timeline      : ${enquiry.timeline || 'Not specified'}`,
    `Reference link: ${enquiry.referenceLink || 'Not provided'}`,
    '',
    'Project details:',
    enquiry.projectDetails,
    '',
    `Admin link    : ${SITE_URL}/admin/`,
    `Request ID    : ${requestId}`,
  ];
  const body = lines.map(l => l.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')).join('\n');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [NOTIFY_EMAIL_TO], subject, reply_to: enquiry.email, text: body, idempotency_key: `enquiry-${enquiry.submissionId}` }),
    });
    if (res.ok) {
      console.log(`[${requestId}] Notification sent successfully to ${NOTIFY_EMAIL_TO}`);
      if (supabase) {
        await supabase.from('enquiries').update({ notified_at: new Date().toISOString() }).eq('submission_id', enquiry.submissionId);
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.log(`[${requestId}] Email send failed: ${res.status} ${errText}`);
    }
  } catch (err) {
    console.log(`[${requestId}] Email send error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const origin = req.headers.get('Origin') || '';

  // Step 1: Method check
  if (req.method === 'OPTIONS') {
    return corsPreflight(origin, ALLOWED_ORIGINS);
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorEnvelope('method_not_allowed', 'Method not allowed', 405, requestId)), {
      status: 405, headers: { 'Allow': 'POST', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    });
  }

  // Step 2: Origin check
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed => {
    if (allowed.startsWith('*.')) return origin.endsWith(allowed.slice(2));
    return origin === allowed;
  });
  if (!isAllowed) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('origin_not_allowed', 'Origin not allowed', 403, requestId), 403);
  }

  // Step 3: Content-Type check
  const contentType = req.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('unsupported_media_type', 'Content-Type must be application/json', 415, requestId), 415);
  }

  // Step 4: Body size check
  let bodyChunks = [];
  let totalBytes = 0;
  const reader = req.body?.getReader();
  if (!reader) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('invalid_json', 'No request body', 400, requestId), 400);
  }
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    if (totalBytes > MAX_BODY_BYTES) {
      return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('payload_too_large', 'Request body exceeds the size limit', 413, requestId), 413);
    }
    bodyChunks.push(value);
  }
  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of bodyChunks) { bodyBytes.set(chunk, offset); offset += chunk.length; }

  // Step 5: JSON parse
  let raw;
  try {
    const text = new TextDecoder().decode(bodyBytes);
    raw = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('not an object');
  } catch {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('invalid_json', 'Body is not valid JSON', 400, requestId), 400);
  }

  // Step 6: Honeypot check
  if (raw.website && String(raw.website).trim().length > 0) {
    return corsResponse(origin, ALLOWED_ORIGINS, { ok: true, submissionId: String(raw.submissionId || '') }, 200);
  }

  // Step 7: Normalize and validate
  const normalized = normalizeInput(raw);
  const unexpected = checkUnknownFields(raw);
  if (unexpected.length > 0) {
    const fields = {};
    for (const f of unexpected) fields[f] = { code: 'unknown_field' };
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('validation_failed', 'One or more fields are invalid.', 400, requestId, fields), 400);
  }
  const validation = validateEnquiry(normalized);
  if (!validation.valid) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('validation_failed', 'One or more fields are invalid.', 400, requestId, validation.fields), 400);
  }

  // Notification toggle evaluation
  const headerDisable = req.headers.get('x-disable-notification') === 'true' ||
                        req.headers.get('x-send-notification') === 'false';
  const isNotificationEnabled = IS_ENV_NOTIFICATION_ENABLED && normalized.notify && !headerDisable;

  // Step 8: Rate limit check (optional)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 9: Insert enquiry
  const servicesArray = normalized.services.length > 0 ? normalized.services : [normalized.service];

  let insertResult = await supabase.from('enquiries').insert({
    submission_id: normalized.submissionId,
    name: normalized.name,
    brand_name: normalized.brandName,
    email: normalized.email,
    phone: normalized.phone,
    service: normalized.service,
    services: servicesArray,
    project_details: normalized.projectDetails,
    budget_range: normalized.budgetRange,
    reference_link: normalized.referenceLink,
    timeline: normalized.timeline,
    status: 'new',
  });

  if (insertResult.error && insertResult.error.message && insertResult.error.message.toLowerCase().includes('services')) {
    insertResult = await supabase.from('enquiries').insert({
      submission_id: normalized.submissionId,
      name: normalized.name,
      brand_name: normalized.brandName,
      email: normalized.email,
      phone: normalized.phone,
      service: normalized.service,
      project_details: normalized.projectDetails,
      budget_range: normalized.budgetRange,
      reference_link: normalized.referenceLink,
      timeline: normalized.timeline,
      status: 'new',
    });
  }

  const { error: insertError } = insertResult;
  if (insertError) {
    if (insertError.code === '23505') {
      return corsResponse(origin, ALLOWED_ORIGINS, { ok: true, submissionId: normalized.submissionId }, 200);
    }
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('server_error', 'Database error. Please try again later.', 500, requestId), 500);
  }

  // Step 10: Notification dispatch with toggle
  if (!isNotificationEnabled) {
    console.log(`[${requestId}] Notification skipped: toggle is OFF (env=${IS_ENV_NOTIFICATION_ENABLED}, request=${normalized.notify}, header=${!headerDisable})`);
  } else {
    void sendOwnerEmail(normalized, requestId, supabase);
  }

  return corsResponse(origin, ALLOWED_ORIGINS, {
    ok: true,
    submissionId: normalized.submissionId,
    services: servicesArray,
    notification: { enabled: isNotificationEnabled }
  }, 200);
});
