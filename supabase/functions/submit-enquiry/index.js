// supabase/functions/submit-enquiry/index.js
// Supabase Edge Function: handles project brief submission per API.md section 6

import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());
const MAX_BODY_BYTES = parseInt(Deno.env.get('MAX_BODY_BYTES') || '16384', 10);

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
    'Cache-Control': 'no-store'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = JSON.parse(rawBody);

    // 1. Honeypot check
    if (payload.website && payload.website.trim().length > 0) {
      return new Response(JSON.stringify({ ok: true, submissionId: payload.submissionId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Validation
    if (!payload.submissionId || !payload.name || !payload.brandName || !payload.email || !payload.service || !payload.projectDetails) {
      return new Response(JSON.stringify({ error: 'Validation failed: missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Insert into Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase
      .from('enquiries')
      .insert({
        submission_id: payload.submissionId,
        name: payload.name.trim(),
        brand_name: payload.brandName.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone ? payload.phone.trim() : null,
        service: payload.service,
        budget_range: payload.budgetRange || 'not_sure_yet',
        project_details: payload.projectDetails.trim(),
        reference_link: payload.referenceLink ? payload.referenceLink.trim() : null,
        timeline: payload.timeline ? payload.timeline.trim() : null
      });

    if (insertError) {
      // If repeat submission with same UUID, treat as success idempotently
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ ok: true, submissionId: payload.submissionId }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.error('Database insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to record enquiry' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return success to visitor immediately
    return new Response(JSON.stringify({ ok: true, submissionId: payload.submissionId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
