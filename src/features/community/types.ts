/** Row shapes for resident community features (migration 15). */

export type PostKind = 'lost_found' | 'marketplace' | 'suggestion' | 'feedback';

export interface CommunityPost {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  price: number | null;
  /** open | closed */
  status: string;
  staff_response: string | null;
  responded_at: string | null;
  created_at: string;
  resident_id: string;
  building_id: string;
  /** Author first name (stored on the post). */
  author_name: string;
}

/** Result row of `poll_summaries()`. */
export interface PollSummary {
  id: string;
  question: string;
  building_id: string | null;
  created_at: string;
  closes_at: string | null;
  /** open | closed (a poll past `closes_at` is reported as closed) */
  status: string;
  total_votes: number;
  /** Option the caller voted for (residents only). */
  my_option: string | null;
  options: { id: string; label: string; votes: number }[];
}

export interface VisitorPass {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  visit_date: string;
  purpose: string | null;
  /** pending | approved | rejected | cancelled | checked_in | checked_out */
  status: string;
  pass_code: string | null;
  decision_note: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  residents: { full_name: string } | null;
}

/** Result row of `my_chat_overview()`. */
export interface ChatOverview {
  id: string;
  /** building | floor | room | staff | custom */
  kind: string;
  name: string;
  building_id: string;
  residents_can_post: boolean;
  last_body: string | null;
  last_sender: string | null;
  last_at: string | null;
  unread: number;
}

/** Result row of `building_birthdays()`. */
export interface Birthday {
  first_name: string;
  room_number: string;
  /** "DD Mon" — the year is never exposed. */
  birthday: string;
  days_away: number;
}

export const POST_KIND_LABEL: Record<PostKind, string> = {
  lost_found: 'Lost & Found',
  marketplace: 'Marketplace',
  suggestion: 'Suggestions',
  feedback: 'Feedback',
};
