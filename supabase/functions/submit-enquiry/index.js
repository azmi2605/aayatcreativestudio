// supabase/functions/submit-enquiry/index.js
// Supabase Edge Function: handles project brief submission per API.md section 6
// Processing order: method → origin → content-type → body size → JSON parse → honeypot → validate → rate limit → insert → respond + background email

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS_RAW = Deno.env.get('ALLOWED_ORIGINS') || '';
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW.split(',').map(s => s.trim()).filter(Boolean);
const MAX_BODY_BYTES = parseInt(Deno.env.get('MAX_BODY_BYTES') || '16384', 10);
const RATE_LIMIT_PER_HOUR = parseInt(Deno.env.get('RATE_LIMIT_PER_HOUR') || '5', 10);
const RATE_LIMIT_GLOBAL_PER_DAY = parseInt(Deno.env.get('RATE_LIMIT_GLOBAL_PER_DAY') || '100', 10);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const NOTIFY_EMAIL_TO = Deno.env.get('NOTIFY_EMAIL_TO') || '';
const MAIL_FROM = Deno.env.get('MAIL_FROM') || '';
const SITE_URL = Deno.env.get('SITE_URL') || '';

const SERVICE_OPTIONS = ['ad_creatives', 'poster_design', 'social_media_design', 'other'];
const BUDGET_RANGE_OPTIONS = ['not_sure_yet'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9\s\-().]*$/;
const REFERENCE_LINK_REGEX = /^https?:\/\/[^\s]+$/;
const SINGLE_LINE_REGEX = /^[^\n\r]*$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = ['submissionId', 'name', 'brandName', 'email', 'phone', 'service', 'projectDetails', 'budgetRange', 'referenceLink', 'timeline', 'website'];

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
    headers['Access-Control-Allow-Headers'] = 'Content-Type, apikey';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function corsPreflight(origin, allowedOrigins) {
  const isAllowed = origin && allowedOrigins.some(allowed => {
    if (allowed.startsWith('*.')) return origin.endsWith(allowed.slice(2));
    return origin === allowed;
  });
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, apikey';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(null, { status: 204, headers });
}

function normalizeInput(raw) {
  const trim = (v) => v === null || v === undefined ? null : String(v).trim();
  const stripControl = (s) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  return {
    submissionId: String(raw.submissionId ?? ''),
    name: stripControl(trim(raw.name) ?? ''),
    brandName: stripControl(trim(raw.brandName) ?? ''),
    email: stripControl(trim(raw.email) ?? '').toLowerCase(),
    phone: trim(raw.phone) ?? null,
    service: String(raw.service ?? ''),
    projectDetails: stripControl(trim(raw.projectDetails) ?? ''),
    budgetRange: trim(raw.budgetRange) ?? null,
    referenceLink: trim(raw.referenceLink) ?? null,
    timeline: stripControl(trim(raw.timeline)) ?? null,
    website: trim(raw.website) ?? '',
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
  if (!input.service) fields.service = { code: 'required' };
  else if (!SERVICE_OPTIONS.includes(input.service)) fields.service = { code: 'invalid_option' };
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

async function sendOwnerEmail(enquiry, requestId) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL_TO || !MAIL_FROM) {
    console.log(`[${requestId}] Email skipped: missing Resend config`);
    return;
  }
  const labels = { ad_creatives: 'Ad Creatives', poster_design: 'Poster Design', social_media_design: 'Social Media Design', other: 'Other Creative Work' };
  const serviceLabel = labels[enquiry.service] || enquiry.service;
  const rawSubject = `New enquiry: ${enquiry.brandName}, ${serviceLabel}`;
  const subject = rawSubject.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, 150);
  const lines = [
    'New project enquiry',
    `Submission ID: ${enquiry.submissionId}`,
    `Name: ${enquiry.name}`,
    `Brand: ${enquiry.brandName}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone ?? 'Not provided'}`,
    `Service: ${serviceLabel}`,
    `Budget: ${enquiry.budgetRange ?? 'Not specified'}`,
    `Timeline: ${enquiry.timeline ?? 'Not specified'}`,
    `Reference link: ${enquiry.referenceLink ?? 'Not provided'}`,
    '',
    'Project details:',
    enquiry.projectDetails,
    '',
    `Admin link: ${SITE_URL}/admin/enquiries/${enquiry.submissionId}`,
  ];
  const body = lines.map(l => l.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')).join('\n');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to: [NOTIFY_EMAIL_TO], subject, reply_to: enquiry.email, text: body, idempotency_key: `enquiry-${enquiry.submissionId}` }),
    });
    if (!res.ok) {
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
  if (!contentType.includes('application/json')) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('unsupported_media_type', 'Content-Type must be application/json', 415, requestId), 415);
  }

  // Step 4: Body size check (read with hard cap, not trusting Content-Length)
  const bodyChunks = [];
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

  // Step 8: Rate limit
  const forwardedFor = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || '';
  const callerIp = forwardedFor.split(',')[0]?.trim() || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const callerAllowed = await supabase.rpc('check_rate_limit', { p_key: `caller:${callerIp}`, p_limit: RATE_LIMIT_PER_HOUR, p_window_seconds: 3600 });
  const globalAllowed = await supabase.rpc('check_rate_limit', { p_key: 'global:daily', p_limit: RATE_LIMIT_GLOBAL_PER_DAY, p_window_seconds: 86400 });

  if (!callerAllowed.data || !globalAllowed.data) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('unavailable', 'Rate limit check failed. Please try again later.', 503, requestId), 503);
  }
  if (!callerAllowed.data) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('rate_limited', 'Too many attempts. Please try again later.', 429, requestId, {}, { retryAfterSeconds: 3600 }), 429);
  }
  if (!globalAllowed.data) {
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('rate_limited', 'Too many attempts. Please try again later.', 429, requestId, {}, { retryAfterSeconds: 86400 }), 429);
  }

  // Step 9: Insert enquiry
  const { error: insertError } = await supabase.from('enquiries').insert({
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

  if (insertError) {
    if (insertError.code === '23505') {
      return corsResponse(origin, ALLOWED_ORIGINS, { ok: true, submissionId: normalized.submissionId }, 200);
    }
    return corsResponse(origin, ALLOWED_ORIGINS, errorEnvelope('server_error', 'Database error. Please try again later.', 500, requestId), 500);
  }

  // Step 10: Respond success, then background email
  void sendOwnerEmail(normalized, requestId);

  return corsResponse(origin, ALLOWED_ORIGINS, { ok: true, submissionId: normalized.submissionId }, 200);
});
