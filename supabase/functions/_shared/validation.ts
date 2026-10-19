// supabase/functions/_shared/validation.ts
// Shared validation module for submit-enquiry Edge Function
// Mirrors contracts/enquiry-contract.json — client and server must not drift.

export interface FieldError {
  code: string;
  min?: number;
  max?: number;
}

export interface ValidationResult {
  valid: boolean;
  fields: Record<string, FieldError>;
}

// Enum values (snake_case codes on the wire, per API.md 2.2 and contracts/enquiry-contract.json)
export const SERVICE_OPTIONS = [
  'ad_creatives',
  'poster_design',
  'social_media_design',
  'other',
] as const;

export const BUDGET_RANGE_OPTIONS = [
  'under_10k',
  '10k_to_25k',
  '25k_to_50k',
  'above_50k',
  'not_sure_yet',
] as const;

// Email validation (simple but effective, no line breaks/whitespace)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation: digits with common separators
const PHONE_REGEX = /^[+0-9\s\-().]*$/;

// Reference link: must start with http:// or https://, no whitespace
const REFERENCE_LINK_REGEX = /^https?:\/\/[^\s]+$/;

// Single-line check (no line breaks)
const SINGLE_LINE_REGEX = /^[^\n\r]*$/;

// UUID validation (v4 format)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface EnquiryInput {
  submissionId: string;
  name: string;
  brandName: string;
  email: string;
  phone?: string | null;
  service: string;
  projectDetails: string;
  budgetRange?: string | null;
  referenceLink?: string | null;
  timeline?: string | null;
  website?: string;
}

export interface NormalizedEnquiry {
  submissionId: string;
  name: string;
  brandName: string;
  email: string;
  phone: string | null;
  service: string;
  projectDetails: string;
  budgetRange: string | null;
  referenceLink: string | null;
  timeline: string | null;
  website: string;
}

// Normalize input: trim, lowercase email, remove disallowed control characters
export function normalizeInput(raw: Record<string, unknown>): NormalizedEnquiry {
  const trim = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const str = String(v).trim();
    return str.length === 0 ? null : str;
  };

  const rawEmail = trim(raw.email)?.toLowerCase() ?? '';
  const rawName = trim(raw.name) ?? '';
  const rawBrandName = trim(raw.brandName) ?? '';
  const rawProjectDetails = trim(raw.projectDetails) ?? '';

  // Remove disallowed control characters from text fields
  const stripControlChars = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

  return {
    submissionId: String(raw.submissionId ?? '').trim(),
    name: stripControlChars(rawName),
    brandName: stripControlChars(rawBrandName),
    email: stripControlChars(rawEmail),
    phone: trim(raw.phone),
    service: String(raw.service ?? '').trim(),
    projectDetails: stripControlChars(rawProjectDetails),
    budgetRange: trim(raw.budgetRange),
    referenceLink: trim(raw.referenceLink),
    timeline: trim(raw.timeline) ? stripControlChars(String(raw.timeline).trim()) : null,
    website: String(raw.website ?? '').trim(),
  };
}

// Validate every field and collect all errors
export function validateEnquiry(input: NormalizedEnquiry): ValidationResult {
  const fields: Record<string, FieldError> = {};

  // submissionId: required, UUID v4
  if (!input.submissionId) {
    fields.submissionId = { code: 'required' };
  } else if (!UUID_REGEX.test(input.submissionId)) {
    fields.submissionId = { code: 'invalid_format' };
  }

  // name: required, 1-100 chars, single line
  if (!input.name) {
    fields.name = { code: 'required' };
  } else {
    if (input.name.length < 1) fields.name = { code: 'too_short', min: 1 };
    if (input.name.length > 100) fields.name = { code: 'too_long', max: 100 };
    if (!SINGLE_LINE_REGEX.test(input.name)) fields.name = { code: 'invalid_format' };
  }

  // brandName: required, 1-100 chars, single line
  if (!input.brandName) {
    fields.brandName = { code: 'required' };
  } else {
    if (input.brandName.length < 1) fields.brandName = { code: 'too_short', min: 1 };
    if (input.brandName.length > 100) fields.brandName = { code: 'too_long', max: 100 };
    if (!SINGLE_LINE_REGEX.test(input.brandName)) fields.brandName = { code: 'invalid_format' };
  }

  // email: required, valid format, max 254 chars
  if (!input.email) {
    fields.email = { code: 'required' };
  } else {
    if (!EMAIL_REGEX.test(input.email)) fields.email = { code: 'invalid_format' };
    if (input.email.length > 254) fields.email = { code: 'too_long', max: 254 };
  }

  // phone: optional, 5-30 chars, valid format
  if (input.phone !== null && input.phone !== '') {
    if (input.phone.length < 5) fields.phone = { code: 'too_short', min: 5 };
    if (input.phone.length > 30) fields.phone = { code: 'too_long', max: 30 };
    if (!PHONE_REGEX.test(input.phone)) fields.phone = { code: 'invalid_format' };
  }

  // service: required, must be one of the enum values
  if (!input.service) {
    fields.service = { code: 'required' };
  } else if (!SERVICE_OPTIONS.includes(input.service as (typeof SERVICE_OPTIONS)[number])) {
    fields.service = { code: 'invalid_option' };
  }

  // projectDetails: required, 20-1000 chars
  if (!input.projectDetails) {
    fields.projectDetails = { code: 'required' };
  } else {
    if (input.projectDetails.length < 20) fields.projectDetails = { code: 'too_short', min: 20 };
    if (input.projectDetails.length > 1000) fields.projectDetails = { code: 'too_long', max: 1000 };
  }

  // budgetRange: optional, must be valid option if provided
  if (input.budgetRange !== null && input.budgetRange !== '') {
    if (!BUDGET_RANGE_OPTIONS.includes(input.budgetRange as (typeof BUDGET_RANGE_OPTIONS)[number])) {
      fields.budgetRange = { code: 'invalid_option' };
    }
  }

  // referenceLink: optional, must start with http:// or https://
  if (input.referenceLink !== null && input.referenceLink !== '') {
    if (!REFERENCE_LINK_REGEX.test(input.referenceLink)) {
      fields.referenceLink = { code: 'invalid_format' };
    }
    if (input.referenceLink.length > 500) fields.referenceLink = { code: 'too_long', max: 500 };
  }

  // timeline: optional, max 100 chars, single line
  if (input.timeline !== null && input.timeline !== '') {
    if (input.timeline.length > 100) fields.timeline = { code: 'too_long', max: 100 };
    if (!SINGLE_LINE_REGEX.test(input.timeline)) fields.timeline = { code: 'invalid_format' };
  }

  return {
    valid: Object.keys(fields).length === 0,
    fields,
  };
}

// Check for unexpected fields (strict mode per contracts/enquiry-contract.json)
export function checkUnknownFields(
  raw: Record<string, unknown>,
  allowedFields: string[]
): string[] {
  const unexpected: string[] = [];
  for (const key of Object.keys(raw)) {
    if (!allowedFields.includes(key)) {
      unexpected.push(key);
    }
  }
  return unexpected;
}

export const ALLOWED_FIELDS = [
  'submissionId',
  'name',
  'brandName',
  'email',
  'phone',
  'service',
  'projectDetails',
  'budgetRange',
  'referenceLink',
  'timeline',
  'website',
];