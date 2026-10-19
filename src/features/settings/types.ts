/** Row shapes for the owner Settings tabs. */

export interface TeamMember {
  id: string;
  user_id: string | null;
  /** Email the invitation was sent to (until the person signs up). */
  invite_email: string | null;
  display_name: string | null;
  role: string;
  /** invited | active | suspended | revoked */
  status: string;
  created_at: string;
  building_memberships: { buildings: { name: string } }[];
  /** Profile of the linked login, once the invitation is claimed. */
  profiles: { full_name: string | null; email: string | null } | null;
}

export interface SubscriptionInfo {
  status: string;
  trial_end: string | null;
  resident_limit: number;
  manager_limit: number;
  chef_limit: number;
  price_override: number | null;
  subscription_plans: { name: string; monthly_price: number };
}

export interface MealSettings {
  tenant_id: string;
  /** HH:MM:SS; residents must mark "not eating" before this time on the day. */
  breakfast_cutoff: string;
  lunch_cutoff: string;
  dinner_cutoff: string;
  allow_reviews: boolean;
}

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  is_maintenance: boolean;
  is_active: boolean;
}
