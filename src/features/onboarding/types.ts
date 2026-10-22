/** Owner onboarding application shapes (stored as jsonb on `tenant_onboarding_requests`). */

/** A building as typed in the form (numbers kept as strings until submit). */
export interface BuildingDraft {
  name: string;
  address: string;
  city: string;
  floors: string;
  approx_beds: string;
}

export interface OnboardingRequest {
  id: string;
  tenant_id?: string;
  /** pending | approved | rejected | changes_requested */
  status: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  business_details: { business_name: string; buildings: BuildingDraft[]; notes?: string };
  contact_details: { phone: string; city: string };
}
