/**
 * Owner onboarding: a signed-in user with no membership applies for a business account.
 * ZIPCO reviews it in the platform portal; approval creates the tenant, buildings and trial subscription.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { OnboardingRequest } from './types';

/** The user's latest application, or null. RLS returns only the caller's own requests. */
export async function getLatestOnboardingRequest(): Promise<OnboardingRequest | null> {
  const rows = await q(supabase.from('tenant_onboarding_requests').select('*').order('created_at', { ascending: false }).limit(1));
  // business_details / contact_details are jsonb written by submit_onboarding; their shape is asserted here.
  return (rows as unknown as OnboardingRequest[])[0] ?? null;
}

export interface OnboardingInput {
  businessName: string;
  phone: string;
  city: string;
  notes: string | null;
  buildings: { name: string; address: string; city: string; floors: number | null; approx_beds: number | null }[];
}

/** Submits (or re-submits after "changes requested") the application. */
export function submitOnboarding(o: OnboardingInput) {
  return rpc('submit_onboarding', {
    p_business_name: o.businessName,
    p_phone: o.phone,
    p_city: o.city,
    p_notes: o.notes,
    p_buildings: o.buildings,
  });
}
