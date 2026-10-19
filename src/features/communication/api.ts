/**
 * Data access for notices, chat and in-app notifications.
 * Reads are scoped by RLS (tenant, building, and for residents their own channels);
 * writes go through RPCs that check the caller's role.
 */
import { q, rpc } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { AppNotification, ChatChannel, ChatMessage, Notice } from './types';

// ---------------------------------------------------------------- Notices

/** Non-archived notices for one building plus tenant-wide ones, newest first. */
export function listNotices(buildingId: string | null): Promise<Notice[]> {
  return q(
    supabase
      .from('notices')
      .select('id,title,body,category,status,building_id,published_at,expires_at,notice_reads(count)')
      .neq('status', 'archived')
      .or(`building_id.is.null,building_id.eq.${buildingId}`)
      .order('published_at', { ascending: false })
      .limit(100),
  );
}

/** Active residents of a building (ids only); used as the denominator for "read by x/y". */
export function listActiveResidentIds(buildingId: string | null) {
  if (!buildingId) return Promise.resolve([]);
  return q(
    supabase
      .from('resident_directory')
      .select('id', { count: 'exact', head: false })
      .eq('building_id', buildingId)
      .eq('status', 'active'),
  );
}

export interface PublishNoticeInput {
  /** null publishes to every building (owner only; enforced server-side). */
  buildingId: string | null;
  title: string;
  body: string;
  category: string;
  /** ISO timestamp, or null for no expiry. */
  expiresAt: string | null;
}

/** Publishes a notice and notifies the residents it targets. */
export function publishNotice(n: PublishNoticeInput) {
  return rpc('publish_notice', {
    p_building: n.buildingId,
    p_title: n.title,
    p_body: n.body,
    p_category: n.category,
    p_expires_at: n.expiresAt,
  });
}

/** Hides a notice from residents; the record is kept. */
export function archiveNotice(noticeId: string) {
  return rpc('archive_notice', { p_notice: noticeId });
}

// ---------------------------------------------------------------- Chat

/** Chat channels the user can see, optionally for one building. RLS decides visibility. */
export function listChatChannels(buildingId?: string | null): Promise<ChatChannel[]> {
  let b = supabase.from('chat_channels').select('id,kind,name,residents_can_post,building_id');
  if (buildingId) b = b.eq('building_id', buildingId);
  return q(b);
}

/** Latest 100 messages of a channel, newest first. */
export function listChatMessages(channelId: string): Promise<ChatMessage[]> {
  return q(
    supabase
      .from('chat_messages')
      .select('id,sender_user_id,sender_name,sender_is_staff,body,is_pinned,created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(100),
  );
}

export function sendChatMessage(channelId: string, body: string) {
  return rpc('send_chat_message', { p_channel: channelId, p_body: body });
}

/** Staff only. */
export function setMessagePinned(messageId: string, pinned: boolean) {
  return rpc('set_message_pinned', { p_message: messageId, p_pinned: pinned });
}

// ---------------------------------------------------------------- Notifications

/** The signed-in user's 20 latest notifications. */
export function listNotifications(): Promise<AppNotification[]> {
  return q(
    supabase.from('notifications').select('id,title,body,created_at,read_at').order('created_at', { ascending: false }).limit(20),
  );
}

export function markNotificationsRead() {
  return rpc('mark_notifications_read');
}
