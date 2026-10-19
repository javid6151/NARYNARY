/**
 * Data access for the resident portal. Queries carry no resident/building filter on purpose:
 * RLS returns only the signed-in resident's own charges, payments, complaints, meal responses
 * and the notices/menus of their building.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { DayMenu, MyCharge, MyComplaint, MyPayment, ResidentNotice, ResidentProfile } from './types';

/** The resident's current stay, or null when no active admission is linked to this login. */
export async function getMyProfile() {
  return (await rpc('my_resident_profile')) as unknown as ResidentProfile | null;
}

/** All my charges, latest due first (view rows are asserted). */
export function listMyCharges(): Promise<MyCharge[]> {
  return q(
    supabase
      .from('rent_charge_balances')
      .select('id,description,charge_type,due_date,amount,paid_amount,balance,status')
      .order('due_date', { ascending: false }),
  ) as unknown as Promise<MyCharge[]>;
}

/** My payments, newest first, with receipt number and the charges each payment was applied to. */
export function listMyPayments(): Promise<MyPayment[]> {
  return q(
    supabase
      .from('payment_transactions')
      .select(
        'id,amount,payment_method,paid_at,status,transaction_reference,receipts(receipt_number),' +
          'payment_allocations(allocated_amount,rent_charges(description,charge_type))',
      )
      .order('paid_at', { ascending: false }),
  ) as unknown as Promise<MyPayment[]>;
}

/** Today's (or any date's) menu summary for the home card. */
export function listMenuSummary(date: string) {
  return q(supabase.from('meal_menus').select('meal_type,items,serving_start,serving_end').eq('meal_date', date));
}

export function listDayMenus(date: string): Promise<DayMenu[]> {
  return q(supabase.from('meal_menus').select('id,meal_type,items,serving_start,serving_end,change_reason').eq('meal_date', date));
}

/** My "not eating" marks for a date. */
export function listMyMealAvailability(date: string) {
  return q(supabase.from('meal_availability').select('meal_type,is_unavailable').eq('meal_date', date));
}

/** Menus I have already rated. */
export function listMyMealReviews() {
  return q(supabase.from('meal_reviews').select('meal_menu_id,rating'));
}

/** Marks me as not eating (or eating again) for a meal; rejected after the cutoff. */
export function setMealAvailability(date: string, mealType: string, unavailable: boolean) {
  return rpc('set_meal_availability', { p_date: date, p_meal_type: mealType, p_unavailable: unavailable });
}

export function submitMealReview(menuId: string, rating: number, comment: string | null) {
  return rpc('submit_meal_review', { p_menu: menuId, p_rating: rating, p_comment: comment });
}

export function listMyComplaints(): Promise<MyComplaint[]> {
  return q(
    supabase
      .from('complaints')
      .select('id,title,category,status,priority,submitted_at,resolution_notes')
      .order('submitted_at', { ascending: false }),
  );
}

/** Raises a complaint; the server stamps my room and building at submission time. */
export function createComplaint(c: { category: string; title: string; description: string; priority: string }) {
  return rpc('create_complaint', { p_category: c.category, p_title: c.title, p_description: c.description, p_priority: c.priority });
}

/** All published notices visible to me, newest first. */
export function listPublishedNotices(): Promise<ResidentNotice[]> {
  return q(
    supabase.from('notices').select('id,title,body,category,published_at').eq('status', 'published').order('published_at', { ascending: false }),
  );
}

/** The three latest published notices (home card). */
export function listLatestNotices() {
  return q(
    supabase
      .from('notices')
      .select('id,title,category,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3),
  );
}

/** Records that I have seen a notice (feeds the staff "read by" count). */
export function markNoticeRead(noticeId: string) {
  return rpc('mark_notice_read', { p_notice: noticeId });
}
