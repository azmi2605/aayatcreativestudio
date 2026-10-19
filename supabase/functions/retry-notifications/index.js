// supabase/functions/retry-notifications/index.js
// Supabase Edge Function: re-sends unsent owner notifications per API.md section 8
// Called by pg_cron every 10 minutes. Protected by X-Cron-Secret header.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const NOTIFY_EMAIL_TO = Deno.env.get('NOTIFY_EMAIL_TO') || '';
const MAIL_FROM = Deno.env.get('MAIL_FROM') || '';
const SITE_URL = Deno.env.get('SITE_URL') || '';
const NOTIFY_BATCH_SIZE = parseInt(Deno.env.get('NOTIFY_BATCH_SIZE') || '20', 10);
const NOTIFY_RETRY_WINDOW_DAYS = parseInt(Deno.env.get('NOTIFY_RETRY_WINDOW_DAYS') || '7', 10);

function generateRequestId() { return crypto.randomUUID(); }

function errorEnvelope(code, message, status, requestId) {
  return { error: { code, message }, requestId };
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const SERVICE_LABELS = {
  ad_creatives: 'Ad Creatives',
  poster_design: 'Poster Design',
  social_media_design: 'Social Media Design',
  other: 'Other Creative Work',
};

function buildEmailBody(enquiry) {
  const serviceLabel = SERVICE_LABELS[enquiry.service] || enquiry.service;
  const rawSubject = `New enquiry: ${enquiry.brand_name}, ${serviceLabel}`;
  const subject = rawSubject.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, 150);
  const lines = [
    'New project enquiry',
    `Submission ID: ${enquiry.submission_id}`,
    `Name: ${enquiry.name}`,
    `Brand: ${enquiry.brand_name}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone ?? 'Not provided'}`,
    `Service: ${serviceLabel}`,
    `Budget: ${enquiry.budget_range ?? 'Not specified'}`,
    `Timeline: ${enquiry.timeline ?? 'Not specified'}`,
    `Reference link: ${enquiry.reference_link ?? 'Not provided'}`,
    '',
    'Project details:',
    enquiry.project_details,
    '',
    `Admin link: ${SITE_URL}/admin/enquiries/${enquiry.submission_id}`,
  ];
  const body = lines.map(l => l.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')).join('\n');
  return { subject, body };
}

async function sendEmail(resendApiKey, mailFrom, notifyEmailTo, enquiry, requestId) {
  const { subject, body } = buildEmailBody(enquiry);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: mailFrom,
        to: [notifyEmailTo],
        subject,
        reply_to: enquiry.email,
        text: body,
        idempotency_key: `enquiry-${enquiry.submission_id}`,
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.log(`[${requestId}] Email send error for ${enquiry.submission_id}: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, status: 0 };
  }
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();

  // Method check: POST only
  if (req.method !== 'POST') {
    return new Response(JSON.stringify(errorEnvelope('method_not_allowed', 'Method not allowed', 405, requestId)), {
      status: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // Cron secret verification (constant-time)
  const providedSecret = req.headers.get('X-Cron-Secret') || '';
  if (!constantTimeEqual(providedSecret, CRON_SECRET)) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const windowStart = new Date(Date.now() - NOTIFY_RETRY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: enquiries, error: selectError } = await supabase
    .from('enquiries')
    .select('*')
    .is('notified_at', null)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })
    .limit(NOTIFY_BATCH_SIZE);

  if (selectError) {
    return new Response(JSON.stringify(errorEnvelope('server_error', 'Database query failed', 500, requestId)), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const enquiry of (enquiries ?? [])) {
    processed++;

    const result = await sendEmail(RESEND_API_KEY, MAIL_FROM, NOTIFY_EMAIL_TO, enquiry, requestId);

    if (result.ok) {
      const { error: updateError } = await supabase
        .from('enquiries')
        .update({ notified_at: new Date().toISOString() })
        .eq('submission_id', enquiry.submission_id);

      if (updateError) {
        failed++;
        console.log(`[${requestId}] DB update failed after email sent for ${enquiry.submission_id}`);
      } else {
        sent++;
      }
    } else if (result.status === 401 || result.status === 403) {
      failed++;
      console.log(`[${requestId}] Email config error for enquiry ${enquiry.submission_id}: ${result.status}`);
      break;
    } else {
      failed++;
      console.log(`[${requestId}] Email transient error for enquiry ${enquiry.submission_id}: ${result.status}`);
    }

    if (processed < (enquiries ?? []).length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, sent, failed }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});