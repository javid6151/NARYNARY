/**
 * Data access for resident community features (migration 15): posts (lost & found, marketplace,
 * suggestions, feedback), polls, visitor passes, chat unread counts and opt-in birthdays.
 *
 * Visibility is enforced by RLS: lost & found / marketplace are shared with residents of the same
 * building; suggestions, feedback and visitor passes are visible only to their author and to the
 * building's owner/manager. All writes are RPCs that re-check the caller's stay or staff scope.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Birthday, ChatOverview, CommunityPost, PollSummary, PostKind, VisitorPass } from './types';

// ---------------------------------------------------------------- Posts

const POST_COLUMNS = 'id,kind,title,body,price,status,staff_response,responded_at,created_at,resident_id,building_id,author_name';

/** Posts of the given kinds visible to the caller, newest first (staff: optionally one building). */
export function listPosts(kinds: PostKind[], buildingId?: string | null): Promise<CommunityPost[]> {
  let b = supabase.from('community_posts').select(POST_COLUMNS).in('kind', kinds).order('created_at', { ascending: false }).limit(200);
  if (buildingId) b = b.eq('building_id', buildingId);
  return q(b) as Promise<CommunityPost[]>;
}

/** Resident creates a post in their own building. `price` is used for marketplace only. */
export function createPost(p: { kind: PostKind; title: string; body: string; price: number | null }) {
  return rpc('create_community_post', { p_kind: p.kind, p_title: p.title, p_body: p.body, p_price: p.price });
}

/** Author closes their post; staff may also reply (the author is notified). */
export function respondPost(postId: string, response: string | null, close: boolean) {
  return rpc('respond_community_post', { p_post: postId, p_response: response, p_close: close });
}

// ---------------------------------------------------------------- Polls

/** Polls visible to the caller with vote counts and the caller's own vote. */
export async function listPolls(buildingId?: string | null) {
  return (await rpc('poll_summaries', { p_building: buildingId ?? null })) as unknown as PollSummary[];
}

/** Owner/manager. `buildingId` null = every building (owner only). Residents of the building are notified. */
export function createPoll(p: { buildingId: string | null; question: string; options: string[]; closesAt: string | null }) {
  return rpc('create_poll', { p_building: p.buildingId, p_question: p.question, p_options: p.options, p_closes_at: p.closesAt });
}

/** Resident vote; voting again while the poll is open changes the vote. */
export function votePoll(pollId: string, optionId: string) {
  return rpc('vote_poll', { p_poll: pollId, p_option: optionId });
}

export function closePoll(pollId: string) {
  return rpc('close_poll', { p_poll: pollId });
}

// ---------------------------------------------------------------- Visitor passes

const PASS_COLUMNS =
  'id,visitor_name,visitor_phone,visit_date,purpose,status,pass_code,decision_note,checked_in_at,checked_out_at,created_at,residents(full_name)';

/** Passes visible to the caller (resident: own; staff: their buildings), latest visit first. */
export function listVisitorPasses(buildingId?: string | null): Promise<VisitorPass[]> {
  let b = supabase.from('visitor_passes').select(PASS_COLUMNS).order('visit_date', { ascending: false }).limit(200);
  if (buildingId) b = b.eq('building_id', buildingId);
  return q(b);
}

export function requestVisitorPass(p: { name: string; phone: string | null; date: string; purpose: string | null }) {
  return rpc('request_visitor_pass', { p_name: p.name, p_phone: p.phone, p_date: p.date, p_purpose: p.purpose });
}

export function cancelVisitorPass(passId: string) {
  return rpc('cancel_visitor_pass', { p_pass: passId });
}

/** Staff: approve (issues a pass code) | reject | check_in | check_out. */
export async function updateVisitorPass(passId: string, action: 'approve' | 'reject' | 'check_in' | 'check_out', note: string | null) {
  return (await rpc('update_visitor_pass', { p_pass: passId, p_action: action, p_note: note })) as unknown as {
    status: string;
    pass_code: string | null;
  };
}

// ---------------------------------------------------------------- Chat overview & birthdays

/** Every chat the caller can read with its latest message and unread count, most recent first. */
export async function getChatOverview() {
  return (await rpc('my_chat_overview')) as unknown as ChatOverview[];
}

/** Marks a chat as read up to now (clears its unread count). */
export function markChannelRead(channelId: string) {
  return rpc('mark_channel_read', { p_channel: channelId });
}

/** Opted-in residents of my building with a birthday in the next 30 days. */
export async function listBirthdays() {
  return (await rpc('building_birthdays')) as unknown as Birthday[];
}

export function setShareBirthday(share: boolean) {
  return rpc('set_share_birthday', { p_share: share });
}
